import {
	collection,
	doc,
	getDoc,
	onSnapshot,
	setDoc,
	writeBatch,
} from "firebase/firestore";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { type AuthorDef, KNOWN_AUTHORS } from "../data/authors";
import { BHAJANS_DATA } from "../data/bhajansData";
import { BOOKS_DATA } from "../data/books";
import { LECTURES_DATA } from "../data/lectures";
import { db } from "../services/firebase";
import type { FilterCategoryDef } from "../src/utils/githubAppConfigStorage";
import type {
	Bhajan,
	BhajanAudio,
	Book,
	DownloadConfirmation,
	DownloadItem,
	EventData,
	HistoryEntry,
	LectureData,
	Playlist,
} from "../types";
import {
	type AudioCategory,
	getPlayableUrl,
	saveTrack,
} from "../utils/audioStorage";
import { applyBackupData, parseBackupFile } from "../utils/backup/backupData";
import {
	buildDriveBackup,
	markDriveBackupSaved,
} from "../utils/backup/driveAutoBackup";
import {
	DRIVE_FOLDER_NAME,
	DriveError,
	getDriveAccessToken,
	loadBackupFromDrive,
	saveBackupToDrive,
} from "../utils/backup/driveBackup";
import {
	getDirectPdfUrl,
	reconcileDownloadedBooks,
	saveBook,
	syncWebBookRegistry,
} from "../utils/bookStorage";
import {
	iosGetDoc,
	iosOnSnapshotCollection,
	iosOnSnapshotDoc,
	shouldUseRestFallback,
} from "../utils/firebaseRest";
import { fetchGithubReleaseJson, getRemoteFileSize } from "../utils/network";
import { safeLocalGet } from "../utils/safeLocalSet";
import { parseRawBhajanText } from "../utils/textProcessor";
import { useToast } from "./ToastContext";

// M2: Migration version is manually managed — only bump this string when the
// local data schema actually breaks (e.g., a field rename or format change).
// DO NOT tie it to APP_VERSION: that forces a full re-sync on every minor update,
// which is painful for users on slow/metered connections.
const DATA_MIGRATION_VERSION = "data_schema_v4";
const CONTENT_SYNC_SIGNAL_KEY = "cpbs_content_sync_applied_version";
const MIN_SPLASH_DURATION_MS = 2100;

type SyncableContent = "bhajans" | "books" | "lectures";
type ContentSyncStep =
	| "idle"
	| "checking"
	| "downloading"
	| "parsing"
	| "done"
	| "error";

interface ContentSyncProgress {
	isSyncing: boolean;
	progress: number;
	detail: string;
	step: ContentSyncStep;
}

interface CloudFetchOptions {
	forceSync?: boolean;
	silent?: boolean;
	savedBhajans?: Bhajan[];
}

const createIdleSyncProgress = (): ContentSyncProgress => ({
	isSyncing: false,
	progress: 0,
	detail: "",
	step: "idle",
});

interface DataContextType {
	allBhajans: Bhajan[];
	bhajans: Bhajan[];
	setBhajans: (data: Bhajan[]) => void;
	allBooks: Book[];
	books: Book[];
	setBooks: (data: Book[]) => void;
	allLectures: LectureData[];
	lectures: LectureData[];
	setLectures: (data: LectureData[]) => void;
	events: EventData[];
	setEvents: (data: EventData[]) => void;
	playlists: Playlist[];
	historyItems: HistoryEntry[];
	activeDownloads: Record<string, DownloadItem>;
	isLoading: boolean;
	bookmarks: Record<string, number>;

	// Download Modal State
	downloadConfirmation: DownloadConfirmation | null;

	syncStatus: { isSyncing: boolean; progress: number; total: number };
	isBhajanSyncing: boolean;
	isBookSyncing: boolean;
	isLectureSyncing: boolean;
	bhajanSyncProgress: ContentSyncProgress;
	bookSyncProgress: ContentSyncProgress;
	lectureSyncProgress: ContentSyncProgress;
	forceSyncStatus: {
		isRunning: boolean;
		step: string;
		detail: string;
		stepIndex: number;
		totalSteps: number;
	} | null;

	// Actions
	forceSyncCloudData: () => Promise<void>;
	retryBhajanSync: () => Promise<boolean>;
	retryBookSync: () => Promise<boolean>;
	retryLectureSync: () => Promise<boolean>;
	fetchEvents: (force?: boolean) => Promise<boolean>;
	createPlaylist: (name: string) => void;
	renamePlaylist: (id: string, newName: string) => void;
	deletePlaylist: (id: string) => void;
	addToPlaylist: (playlistId: string, bhajanId: string) => void;
	removeFromPlaylist: (playlistId: string, bhajanId: string) => void;
	addToHistory: (id: string, type: "song" | "book" | "lecture") => void;
	clearHistory: () => void;
	downloadBook: (book: Book) => void;
	downloadTrack: (
		track: BhajanAudio,
		title: string,
		category?: AudioCategory,
	) => void;
	cancelDownload: (id: string) => void;
	importData: (json: string) => boolean;
	resetData: () => void;
	saveBhajanLocally: (id: string, title: string, content: string) => void;
	setBookmark: (bookId: string, pageNum: number) => void;
	removeBookmark: (bookId: string) => void;

	// Backup & Restore
	/** Save a copy to Google Drive ("Prem Bhakti App" folder). */
	backupUserData: () => Promise<boolean>;
	/** `fromDrive` also turns on the automatic Drive backup for this device. */
	restoreUserData: (
		jsonString: string,
		options?: { fromDrive?: boolean; message?: string },
	) => boolean;
	restoreFromCloud: () => Promise<boolean>;

	// Dynamic App Config
	filterCategories: FilterCategoryDef[];
	knownAuthors: Record<string, AuthorDef>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Improved hashing function that looks at the entire string
const hashString = (str: string) => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return (hash >>> 0).toString(16) + str.length; // Added length for extra safety
};

const dedupeBhajans = (items: Bhajan[]): Bhajan[] => {
	const map = new Map<string, Bhajan>();
	items.forEach((item) => {
		const key = item.id || item.songNumber || item.title;
		map.set(key, item);
	});
	return Array.from(map.values());
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const { showToast } = useToast();
	const [isLoading, setIsLoading] = useState(true);

	// --- Data State ---
	const [bhajans, setBhajans] = useState<Bhajan[]>([]);
	const [books, setBooks] = useState<Book[]>([]);
	const [lectures, setLectures] = useState<LectureData[]>([]);

	// Events: Start empty or from local storage.
	const [events, setEventsState] = useState<EventData[]>(() => {
		try {
			return JSON.parse(localStorage.getItem("cpbs_events") || "") || [];
		} catch {
			return [];
		}
	});

	const [playlists, setPlaylists] = useState<Playlist[]>(() => {
		try {
			return JSON.parse(localStorage.getItem("cpbs_playlists") || "") || [];
		} catch {
			return [];
		}
	});
	const [historyItems, setHistoryItems] = useState<HistoryEntry[]>(() => {
		try {
			return JSON.parse(localStorage.getItem("cpbs_history") || "") || [];
		} catch {
			return [];
		}
	});
	const [bookmarks, setBookmarks] = useState<Record<string, number>>(() => {
		try {
			return JSON.parse(localStorage.getItem("cpbs_bookmarks") || "{}");
		} catch {
			return {};
		}
	});

	const [activeDownloads, setActiveDownloads] = useState<
		Record<string, DownloadItem>
	>({});
	const downloadControllers = useRef<Record<string, AbortController>>({});
	const pendingBookDownloads = useRef<Set<string>>(new Set());
	const [syncStatus, setSyncStatus] = useState({
		isSyncing: false,
		progress: 0,
		total: 0,
	});
	const [contentSyncProgress, setContentSyncProgress] = useState<
		Record<SyncableContent, ContentSyncProgress>
	>({
		bhajans: createIdleSyncProgress(),
		books: createIdleSyncProgress(),
		lectures: createIdleSyncProgress(),
	});
	const [forceSyncStatus, setForceSyncStatus] = useState<{
		isRunning: boolean;
		step: string;
		detail: string;
		stepIndex: number;
		totalSteps: number;
	} | null>(null);
	const remoteSyncVersionRef = useRef(0);
	const queuedSyncVersionRef = useRef(0);
	const backgroundSyncPromiseRef = useRef<Promise<void> | null>(null);
	// Published version (from app_config/content_sync) that the running
	// background sync is sure to include. 0 when idle or not known yet.
	const inFlightSyncVersionRef = useRef(0);

	// Confirmation Modal State
	const [downloadConfirmation, setDownloadConfirmation] =
		useState<DownloadConfirmation | null>(null);

	// Dynamic App Config State
	const [filterCategories, setFilterCategories] = useState<FilterCategoryDef[]>(
		() => {
			try {
				const saved = localStorage.getItem("cpbs_filter_categories");
				if (saved) {
					const parsed: FilterCategoryDef[] = JSON.parse(saved);
					// Guard against previously saved garbled data
					const hasDevanagari = (t: string) => /[\u0900-\u097F]/.test(t);
					if (
						Array.isArray(parsed) &&
						parsed.length > 0 &&
						parsed.some((c) => hasDevanagari(c.labelHi || ""))
					) {
						return parsed;
					}
					// Garbled — clear it so next sync fetches clean data
					localStorage.removeItem("cpbs_filter_categories");
				}
			} catch {}
			return [];
		},
	);
	const [knownAuthorsState, setKnownAuthorsState] = useState<
		Record<string, AuthorDef>
	>(() => {
		try {
			const saved = localStorage.getItem("cpbs_known_authors");
			if (saved) {
				const parsed = JSON.parse(saved);
				if (Object.keys(parsed).length > 0) {
					// Guard against previously saved garbled data
					const hasDevanagari = (t: string) => /[\u0900-\u097F]/.test(t);
					const sampleValues = Object.values(parsed).slice(0, 5) as any[];
					if (sampleValues.some((a: any) => hasDevanagari(a.deva || ""))) {
						return parsed;
					}
					// Garbled — clear it
					localStorage.removeItem("cpbs_known_authors");
				}
			}
		} catch {}
		return KNOWN_AUTHORS;
	});

	const updateSyncProgress = useCallback(
		(key: SyncableContent, patch: Partial<ContentSyncProgress>) => {
			setContentSyncProgress((prev) => ({
				...prev,
				[key]: {
					...prev[key],
					...patch,
				},
			}));
		},
		[],
	);

	const isBhajanSyncing = contentSyncProgress.bhajans.isSyncing;
	const isBookSyncing = contentSyncProgress.books.isSyncing;
	const isLectureSyncing = contentSyncProgress.lectures.isSyncing;

	// --- Persistence Effects ---
	useEffect(() => {
		if (!isLoading && books.length > 0)
			localStorage.setItem("cpbs_all_books", JSON.stringify(books));
	}, [books, isLoading]);

	useEffect(() => {
		if (!isLoading && lectures.length > 0)
			localStorage.setItem("cpbs_all_lectures", JSON.stringify(lectures));
	}, [lectures, isLoading]);

	useEffect(() => {
		if (!isLoading && events.length > 0)
			localStorage.setItem("cpbs_events", JSON.stringify(events));
	}, [events, isLoading]);

	useEffect(
		() => localStorage.setItem("cpbs_playlists", JSON.stringify(playlists)),
		[playlists],
	);
	useEffect(
		() => localStorage.setItem("cpbs_history", JSON.stringify(historyItems)),
		[historyItems],
	);
	useEffect(
		() => localStorage.setItem("cpbs_bookmarks", JSON.stringify(bookmarks)),
		[bookmarks],
	);

	// Ensure Default Playlist exists
	useEffect(() => {
		const hasFavorites = playlists.some(
			(p) => p.isDefault || p.name === "Favorites",
		);
		if (!hasFavorites && !isLoading) {
			const defaultPl: Playlist = {
				id: "pl-default-fav",
				name: "Favorites",
				items: [],
				createdAt: Date.now(),
				isDefault: true,
			};
			setPlaylists((prev) => [defaultPl, ...prev]);
		}
	}, [playlists, isLoading]);

	// Events Fetch from Firebase
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		let unsub: (() => void) | undefined;

		const handleSnapshot = (querySnapshot: any) => {
			const newEvents: EventData[] = [];
			let idCounter = 1;

			querySnapshot.forEach((docSnap: any) => {
				const data = docSnap.data();
				if (data) {
					for (const dateKey in data) {
						const dayEvents = data[dateKey];
						if (Array.isArray(dayEvents)) {
							dayEvents.forEach((ev) => {
								newEvents.push({
									id: `fb-${idCounter++}`,
									date: dateKey,
									title: ev.eventName || ev.title || "",
									time: ev.time || "",
									breakTime: ev.breakTime || ev.time || "",
									eventTime: ev.eventTime || "",
									isEkadashi: ev.isEkadashi || false,
									description: ev.description || "",
									location: ev.location || "",
									type: ev.type || "other",
								});
							});
						}
					}
				}
			});

			setEventsState(newEvents);
			localStorage.setItem("cpbs_events", JSON.stringify(newEvents));
		};

		const handleError = (error: any) => {
			console.error("Error fetching events from Firebase:", error);
			showToast(
				"Please connect to internet to get latest updated data",
				"error",
			);
		};

		if (shouldUseRestFallback()) {
			unsub = iosOnSnapshotCollection("Calendar", handleSnapshot, handleError);
		} else {
			unsub = onSnapshot(
				collection(db, "Calendar"),
				handleSnapshot,
				handleError,
			);
		}

		return () => {
			if (unsub) unsub();
		};
	}, []);

	const setEvents = async (data: EventData[]) => {
		try {
			const monthNames = [
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec",
			];
			const groupedByMonth: Record<string, Record<string, any[]>> = {};
			monthNames.forEach((m) => (groupedByMonth[m] = {}));

			data.forEach((ev) => {
				if (!ev.date) return;
				const parts = ev.date.split("-");
				if (parts.length >= 2) {
					const monthIndex = parseInt(parts[1], 10) - 1;
					if (monthIndex >= 0 && monthIndex <= 11) {
						const monthName = monthNames[monthIndex];
						if (!groupedByMonth[monthName][ev.date]) {
							groupedByMonth[monthName][ev.date] = [];
						}
						groupedByMonth[monthName][ev.date].push({
							eventName: ev.title,
							time: ev.time || "",
							breakTime: ev.breakTime || ev.time || "",
							eventTime: ev.eventTime || "",
							isEkadashi: ev.isEkadashi || false,
							description: ev.description || "",
							location: ev.location || "",
							type: ev.type || "other",
						});
					}
				}
			});

			const batch = writeBatch(db);
			monthNames.forEach((month) => {
				const monthRef = doc(db, "Calendar", month);
				batch.set(monthRef, groupedByMonth[month]);
			});

			await batch.commit();
			showToast("Events updated in database", "success");
		} catch (error) {
			console.error("Error updating events in Firebase:", error);
			showToast("Failed to update events", "error");
		}
	};

	const fetchEvents = useCallback(
		async (force = false) => {
			// Legacy fetchEvents is no longer needed as we use onSnapshot
			if (force) {
				showToast("Events are synced automatically", "info");
			}
			return true;
		},
		[showToast],
	);

	const fetchBhajansFromCloud = useCallback(
		async (options: CloudFetchOptions = {}) => {
			const {
				forceSync = false,
				silent = false,
				savedBhajans: savedBhajansParam,
			} = options;
			let localBhajans: Bhajan[] = savedBhajansParam || [];
			if (localBhajans.length === 0) {
				try {
					localBhajans = dedupeBhajans(
						JSON.parse(localStorage.getItem("cpbs_all_bhajans") || "[]"),
					);
				} catch {}
			}
			if (!Array.isArray(localBhajans)) localBhajans = [];

			updateSyncProgress("bhajans", {
				isSyncing: true,
				progress: 8,
				detail: "Checking bhajan updates...",
				step: "checking",
			});
			setSyncStatus({ isSyncing: true, progress: 8, total: 100 });

			try {
				const indexData = await fetchGithubReleaseJson(
					"bhajandata",
					"index.json",
					{
						freshFetch: forceSync,
						onRetry: (nextAttempt, maxAttempts) => {
							updateSyncProgress("bhajans", {
								isSyncing: true,
								progress: 12,
								detail: `Retrying bhajan metadata... (${nextAttempt}/${maxAttempts})`,
								step: "checking",
							});
						},
					},
				);

				// Quick Sync Strategy using bundle timestamp
				const remoteBundleTime =
					indexData.bundleUpdated || indexData.lastUpdated || 0;
				const localBundleTime = parseInt(
					localStorage.getItem("cpbs_bhajans_bundle_time") || "0",
					10,
				);

				if (
					!forceSync &&
					localBhajans.length > 0 &&
					localBundleTime === remoteBundleTime
				) {
					let changed = false;
					const remoteBhajansList = Array.isArray(indexData?.bhajans)
						? indexData.bhajans
						: [];
					const localMap = new Map<string, Bhajan>(
						localBhajans.map((b) => [b.id, b]),
					);
					remoteBhajansList.forEach((remote: any) => {
						const local = localMap.get(remote.id);
						if (local && (local as any).isHidden !== remote.isHidden) {
							(local as any).isHidden = remote.isHidden;
							changed = true;
						}
					});
					if (changed) {
						const newBhajans = Array.from(localMap.values());
						setBhajans(newBhajans);
						localStorage.setItem(
							"cpbs_all_bhajans",
							JSON.stringify(newBhajans),
						);
					}
					updateSyncProgress("bhajans", {
						isSyncing: false,
						progress: 100,
						detail: "Bhajans already up to date.",
						step: "done",
					});
					return true;
				}

				updateSyncProgress("bhajans", {
					isSyncing: true,
					progress: 38,
					detail: "Downloading bhajan bundle...",
					step: "downloading",
				});
				setSyncStatus({ isSyncing: true, progress: 45, total: 100 });
				const bundleArray = await fetchGithubReleaseJson(
					"bhajandata",
					"bundle.json",
					{
						freshFetch: forceSync,
						onRetry: (nextAttempt, maxAttempts) => {
							updateSyncProgress("bhajans", {
								isSyncing: true,
								progress: 44,
								detail: `Retrying bhajan bundle... (${nextAttempt}/${maxAttempts})`,
								step: "downloading",
							});
						},
					},
				);
				let finalBundleArray = bundleArray;
				if (!Array.isArray(finalBundleArray)) {
					if (finalBundleArray && Array.isArray(finalBundleArray.bhajans)) {
						finalBundleArray = finalBundleArray.bhajans;
					} else {
						throw new Error("Invalid bundle.json array format");
					}
				}

				updateSyncProgress("bhajans", {
					isSyncing: true,
					progress: 78,
					detail: "Updating bhajan list...",
					step: "parsing",
				});
				const newBhajans = dedupeBhajans(parseRawBhajanText(finalBundleArray));
				setBhajans(newBhajans);
				localStorage.setItem("cpbs_all_bhajans", JSON.stringify(newBhajans));
				localStorage.setItem(
					"cpbs_bhajans_bundle_time",
					String(remoteBundleTime),
				);

				updateSyncProgress("bhajans", {
					isSyncing: false,
					progress: 100,
					detail: "Bhajans updated.",
					step: "done",
				});
				setSyncStatus({ isSyncing: false, progress: 100, total: 100 });
				if (forceSync && !silent)
					showToast(
						"Bhajans downloaded via Bundle synced perfectly!",
						"success",
					);
				return true;
			} catch (error: any) {
				console.error("Cloud Sync Error (fetchBhajansFromCloud):", error);
				updateSyncProgress("bhajans", {
					isSyncing: false,
					progress: 0,
					detail:
						"Bhajan list could not load after retry. Tap Fetch to try again.",
					step: "error",
				});
				if (!silent && (forceSync || localBhajans.length === 0)) {
					showToast(
						`Failed to sync data: ${error.message || "Network error"}`,
						"error",
					);
				}
				return false;
			} finally {
				setSyncStatus({ isSyncing: false, progress: 0, total: 0 });
			}
		},
		[showToast, updateSyncProgress],
	);

	const fetchBooksFromCloud = useCallback(
		async (options: CloudFetchOptions = {}) => {
			const { forceSync = false, silent = false } = options;
			updateSyncProgress("books", {
				isSyncing: true,
				progress: 8,
				detail: "Checking book updates...",
				step: "checking",
			});

			try {
				const indexData = await fetchGithubReleaseJson(
					"bookdata",
					"index.json",
					{
						freshFetch: forceSync,
						onRetry: (nextAttempt, maxAttempts) => {
							updateSyncProgress("books", {
								isSyncing: true,
								progress: 12,
								detail: `Retrying book metadata... (${nextAttempt}/${maxAttempts})`,
								step: "checking",
							});
						},
					},
				);

				const remoteBundleTime =
					indexData.bundleUpdated || indexData.lastUpdated || 0;
				const localBundleTime = parseInt(
					localStorage.getItem("cpbs_books_bundle_time") || "0",
					10,
				);

				const indexBooks = Array.isArray(indexData?.books)
					? indexData.books
					: [];
				const savedBooksStr = localStorage.getItem("cpbs_all_books");
				let localBooks: Book[] = [];
				try {
					localBooks = JSON.parse(savedBooksStr || "");
				} catch {}

				if (
					!forceSync &&
					localBooks.length > 0 &&
					localBundleTime === remoteBundleTime
				) {
					let changed = false;
					const localMap = new Map<string, Book>(
						localBooks.map((b) => [b.id, b]),
					);
					indexBooks.forEach((remote: any) => {
						const local = localMap.get(remote.id) as any;
						if (local && local.isHidden !== remote.isHidden) {
							local.isHidden = remote.isHidden;
							changed = true;
						}
					});
					// Fill in any missing hardcoded base books (safety net)
					BOOKS_DATA.forEach((base) => {
						if (!localMap.has(base.id)) {
							localMap.set(base.id, base);
							changed = true;
						}
					});
					if (changed) {
						const newBooks = Array.from(localMap.values());
						setBooks(newBooks);
						localStorage.setItem("cpbs_all_books", JSON.stringify(newBooks));
					}
					updateSyncProgress("books", {
						isSyncing: false,
						progress: 100,
						detail: "Books already up to date.",
						step: "done",
					});
					return true;
				}

				updateSyncProgress("books", {
					isSyncing: true,
					progress: 40,
					detail: "Downloading books bundle...",
					step: "downloading",
				});
				const bundleArray = await fetchGithubReleaseJson(
					"bookdata",
					"bundle.json",
					{
						freshFetch: forceSync,
						onRetry: (nextAttempt, maxAttempts) => {
							updateSyncProgress("books", {
								isSyncing: true,
								progress: 44,
								detail: `Retrying books bundle... (${nextAttempt}/${maxAttempts})`,
								step: "downloading",
							});
						},
					},
				);
				let finalBundleArray = bundleArray;
				if (!Array.isArray(finalBundleArray)) {
					if (finalBundleArray && Array.isArray(finalBundleArray.books)) {
						finalBundleArray = finalBundleArray.books;
					} else {
						throw new Error("Invalid bundle.json array format");
					}
				}

				updateSyncProgress("books", {
					isSyncing: true,
					progress: 80,
					detail: "Updating books list...",
					step: "parsing",
				});
				const cloudBooks = finalBundleArray.map((book: any) => {
					const remoteMeta = indexBooks.find((b: any) => b.id === book.id);
					return {
						...book,
						isHidden: remoteMeta ? remoteMeta.isHidden : book.isHidden,
					};
				});

				// ── Merge with hardcoded base books ─────────────────────────────────
				// Cloud bundle may be incomplete if some books were never re-saved via admin.
				// Fill any gaps from BOOKS_DATA; cloud entries take priority for the same id.
				const cloudBookIds = new Set(cloudBooks.map((b: any) => b.id));
				const missingBaseBooks = BOOKS_DATA.filter(
					(b) => !cloudBookIds.has(b.id),
				);
				const finalBooks = [...missingBaseBooks, ...cloudBooks];
				// ────────────────────────────────────────────────────────────────────

				setBooks(finalBooks);
				localStorage.setItem("cpbs_all_books", JSON.stringify(finalBooks));
				localStorage.setItem(
					"cpbs_books_bundle_time",
					String(remoteBundleTime),
				);

				updateSyncProgress("books", {
					isSyncing: false,
					progress: 100,
					detail: "Books updated.",
					step: "done",
				});
				if (forceSync && !silent)
					showToast("Books synced successfully", "success");
				return true;
			} catch (error: any) {
				console.error("Book Cloud Sync Error:", error);
				updateSyncProgress("books", {
					isSyncing: false,
					progress: 0,
					detail:
						"Book list could not load after retry. Tap Fetch to try again.",
					step: "error",
				});
				if (forceSync && !silent) {
					showToast("Books sync failed", "error");
				}
				return false;
			}
		},
		[showToast, updateSyncProgress],
	);

	const fetchLecturesFromCloud = useCallback(
		async (options: CloudFetchOptions = {}) => {
			const { forceSync = false, silent = false } = options;
			updateSyncProgress("lectures", {
				isSyncing: true,
				progress: 8,
				detail: "Checking lecture updates...",
				step: "checking",
			});

			try {
				const indexData = await fetchGithubReleaseJson(
					"lecturedata",
					"index.json",
					{
						freshFetch: forceSync,
						onRetry: (nextAttempt, maxAttempts) => {
							updateSyncProgress("lectures", {
								isSyncing: true,
								progress: 12,
								detail: `Retrying lecture metadata... (${nextAttempt}/${maxAttempts})`,
								step: "checking",
							});
						},
					},
				);

				const remoteBundleTime =
					indexData.bundleUpdated || indexData.lastUpdated || 0;
				const localBundleTime = parseInt(
					localStorage.getItem("cpbs_lectures_bundle_time") || "0",
					10,
				);

				const indexLectures = Array.isArray(indexData?.lectures)
					? indexData.lectures
					: [];
				const savedLecturesStr = localStorage.getItem("cpbs_all_lectures");
				let localLectures: LectureData[] = [];
				try {
					localLectures = JSON.parse(savedLecturesStr || "");
				} catch {}

				if (
					!forceSync &&
					localLectures.length > 0 &&
					localBundleTime === remoteBundleTime
				) {
					let changed = false;
					const localMap = new Map<string, LectureData>(
						localLectures.map((l) => [l.id, l]),
					);
					indexLectures.forEach((remote: any) => {
						const local = localMap.get(remote.id) as any;
						if (local && local.isHidden !== remote.isHidden) {
							local.isHidden = remote.isHidden;
							changed = true;
						}
					});
					// Also fill in any missing hardcoded base lectures (e.g. 001/002/003 not in local cache)
					LECTURES_DATA.forEach((base) => {
						if (!localMap.has(base.id)) {
							localMap.set(base.id, base);
							changed = true;
						}
					});
					if (changed) {
						const newLectures = Array.from(localMap.values());
						setLectures(newLectures);
						localStorage.setItem(
							"cpbs_all_lectures",
							JSON.stringify(newLectures),
						);
					}
					updateSyncProgress("lectures", {
						isSyncing: false,
						progress: 100,
						detail: "Lectures already up to date.",
						step: "done",
					});
					return true;
				}

				updateSyncProgress("lectures", {
					isSyncing: true,
					progress: 40,
					detail: "Downloading lectures bundle...",
					step: "downloading",
				});
				const bundleArray = await fetchGithubReleaseJson(
					"lecturedata",
					"bundle.json",
					{
						freshFetch: forceSync,
						onRetry: (nextAttempt, maxAttempts) => {
							updateSyncProgress("lectures", {
								isSyncing: true,
								progress: 44,
								detail: `Retrying lectures bundle... (${nextAttempt}/${maxAttempts})`,
								step: "downloading",
							});
						},
					},
				);
				let finalBundleArray = bundleArray;
				if (!Array.isArray(finalBundleArray)) {
					if (finalBundleArray && Array.isArray(finalBundleArray.lectures)) {
						finalBundleArray = finalBundleArray.lectures;
					} else {
						throw new Error("Invalid bundle.json array format");
					}
				}

				updateSyncProgress("lectures", {
					isSyncing: true,
					progress: 80,
					detail: "Updating lecture list...",
					step: "parsing",
				});
				const cloudLectures = finalBundleArray.map((lecture: any) => {
					const remoteMeta = indexLectures.find(
						(l: any) => l.id === lecture.id,
					);
					return {
						...lecture,
						isHidden: remoteMeta ? remoteMeta.isHidden : lecture.isHidden,
					};
				});

				// ── Merge with hardcoded base lectures ──────────────────────────────
				// The cloud bundle.json may be incomplete if some lectures (001, 002, 003)
				// were never re-saved via the admin panel after migrating to Firebase Storage.
				// We fill in any gaps from LECTURES_DATA so they are never lost.
				// Cloud entries always take priority over hardcoded ones for the same id.
				const cloudIds = new Set(cloudLectures.map((l: any) => l.id));
				const missingBase = LECTURES_DATA.filter((l) => !cloudIds.has(l.id));
				const finalLectures = [...missingBase, ...cloudLectures];
				// ────────────────────────────────────────────────────────────────────

				setLectures(finalLectures);
				localStorage.setItem(
					"cpbs_all_lectures",
					JSON.stringify(finalLectures),
				);
				localStorage.setItem(
					"cpbs_lectures_bundle_time",
					String(remoteBundleTime),
				);

				updateSyncProgress("lectures", {
					isSyncing: false,
					progress: 100,
					detail: "Lectures updated.",
					step: "done",
				});
				if (forceSync && !silent)
					showToast("Lectures synced successfully", "success");
				return true;
			} catch (error: any) {
				console.error("Lecture Cloud Sync Error:", error);
				updateSyncProgress("lectures", {
					isSyncing: false,
					progress: 0,
					detail:
						"Audio or lecture list could not load after retry. Tap Fetch to try again.",
					step: "error",
				});
				if (forceSync && !silent) {
					showToast("Lectures sync failed", "error");
				}
				return false;
			}
		},
		[showToast, updateSyncProgress],
	);

	// Latest published content version, read from the server (0 if unknown).
	const readPublishedSyncVersion = useCallback(async (): Promise<number> => {
		try {
			const snap = shouldUseRestFallback()
				? await iosGetDoc("app_config/content_sync")
				: await getDoc(doc(db, "app_config", "content_sync"));
			const version = Number(snap.data()?.version || 0);
			return Math.max(version, remoteSyncVersionRef.current);
		} catch (error) {
			console.warn("Could not read content_sync version:", error);
			return remoteSyncVersionRef.current;
		}
	}, []);

	const queueBackgroundContentSync = useCallback(
		async (requestedVersion: number) => {
			if (!requestedVersion) return;
			// A sync that is already running fetches the latest files, so it covers
			// any version published before it started. Without this, a first visit
			// downloaded every bundle twice: once for the first-time sync and again
			// when the content_sync listener fired while that sync was still running.
			if (
				backgroundSyncPromiseRef.current &&
				requestedVersion <= inFlightSyncVersionRef.current
			) {
				return backgroundSyncPromiseRef.current;
			}
			queuedSyncVersionRef.current = Math.max(
				queuedSyncVersionRef.current,
				requestedVersion,
			);

			if (backgroundSyncPromiseRef.current) {
				return backgroundSyncPromiseRef.current;
			}

			backgroundSyncPromiseRef.current = (async () => {
				while (queuedSyncVersionRef.current > 0) {
					const targetVersion = queuedSyncVersionRef.current;
					queuedSyncVersionRef.current = 0;

					// ✅ Pre-set UI to syncing state BEFORE the mandatory propagation wait
					// to prevent users from seeing the "Fetch" error/empty state and manually clicking it.
					updateSyncProgress("bhajans", {
						isSyncing: true,
						progress: 2,
						detail: "Preparing to sync...",
					});
					updateSyncProgress("books", {
						isSyncing: true,
						progress: 2,
						detail: "Preparing to sync...",
					});
					updateSyncProgress("lectures", {
						isSyncing: true,
						progress: 2,
						detail: "Preparing to sync...",
					});

					// Wait for GitHub CDN propagation + Cloudflare edge cache to be warmed with the fresh data.
					// 1500ms was too short for some Cloudflare edge nodes in different regions.
					await new Promise((r) => setTimeout(r, 3000));

					// The applied version must come from the server, never from this
					// phone's clock: a phone running fast would otherwise save a
					// "future" version and ignore the next real publish. The admin
					// uploads the files before bumping content_sync, so whatever
					// version is published right now is included in the fetch below.
					const coveredVersion = await readPublishedSyncVersion();
					inFlightSyncVersionRef.current = coveredVersion;

					const results = await Promise.all([
						fetchBhajansFromCloud({ forceSync: true, silent: true }),
						fetchBooksFromCloud({ forceSync: true, silent: true }),
						fetchLecturesFromCloud({ forceSync: true, silent: true }),
					]);

					if (results.every(Boolean)) {
						// If the version could not be read, keep the old value: the
						// listener then asks for one more sync, which is safe.
						if (coveredVersion > 0) {
							localStorage.setItem(
								CONTENT_SYNC_SIGNAL_KEY,
								String(coveredVersion),
							);
						}
						// A signal that arrived during the wait above is already covered.
						if (queuedSyncVersionRef.current <= coveredVersion) {
							queuedSyncVersionRef.current = 0;
						}
					} else {
						queuedSyncVersionRef.current = Math.max(
							queuedSyncVersionRef.current,
							targetVersion,
						);
						break;
					}
				}
			})().finally(() => {
				backgroundSyncPromiseRef.current = null;
				inFlightSyncVersionRef.current = 0;
			});

			return backgroundSyncPromiseRef.current;
		},
		[
			fetchBhajansFromCloud,
			fetchBooksFromCloud,
			fetchLecturesFromCloud,
			readPublishedSyncVersion,
			updateSyncProgress,
		],
	);

	const fetchAppConfigFromCloud = useCallback(async (silent = false) => {
		try {
			const [catData, authData] = await Promise.all([
				fetchGithubReleaseJson("appconfig", "categories.json", {
					freshFetch: true,
				}).catch(() => null),
				fetchGithubReleaseJson("appconfig", "authors.json", {
					freshFetch: true,
				}).catch(() => null),
			]);

			// Validate: check if Devanagari is present — guards against double-encoded cloud data
			const hasDevanagari = (text: string) => /[\u0900-\u097F]/.test(text);

			if (
				catData &&
				Array.isArray(catData.categories) &&
				catData.categories.length > 0
			) {
				const sample = catData.categories.slice(0, 3);
				const isClean = sample.some((c: any) => hasDevanagari(c.labelHi || ""));
				if (isClean) {
					setFilterCategories(catData.categories);
					localStorage.setItem(
						"cpbs_filter_categories",
						JSON.stringify(catData.categories),
					);
				} else {
					console.warn(
						"[DataContext] Garbled categories.json detected, keeping local defaults",
					);
				}
			}

			if (authData?.authors && Object.keys(authData.authors).length > 0) {
				const sampleValues = Object.values(authData.authors).slice(
					0,
					5,
				) as any[];
				const isClean = sampleValues.some((a: any) =>
					hasDevanagari(a.deva || ""),
				);
				if (isClean) {
					setKnownAuthorsState(authData.authors);
					localStorage.setItem(
						"cpbs_known_authors",
						JSON.stringify(authData.authors),
					);
				} else {
					console.warn(
						"[DataContext] Garbled authors.json detected, keeping KNOWN_AUTHORS",
					);
				}
			}
		} catch (e) {
			if (!silent) console.warn("App config fetch failed:", e);
		}
	}, []);

	const forceSyncCloudData = async () => {
		const totalSteps = 4;
		try {
			setForceSyncStatus({
				isRunning: true,
				step: "भजन",
				detail: "Connecting to cloud...",
				stepIndex: 1,
				totalSteps,
			});
			const bhajansOk = await fetchBhajansFromCloud({ forceSync: true });
			if (!bhajansOk) throw new Error("Bhajan sync failed");

			setForceSyncStatus({
				isRunning: true,
				step: "पुस्तकें",
				detail: "Fetching books bundle...",
				stepIndex: 2,
				totalSteps,
			});
			const booksOk = await fetchBooksFromCloud({ forceSync: true });
			if (!booksOk) throw new Error("Books sync failed");

			setForceSyncStatus({
				isRunning: true,
				step: "कथा",
				detail: "Fetching lecture bundle...",
				stepIndex: 3,
				totalSteps,
			});
			const lecturesOk = await fetchLecturesFromCloud({ forceSync: true });
			if (!lecturesOk) throw new Error("Lecture sync failed");

			const publishedVersion = Date.now();
			setForceSyncStatus({
				isRunning: true,
				step: "प्रकाशन",
				detail: "Publishing update for all users...",
				stepIndex: 4,
				totalSteps,
			});
			await setDoc(doc(db, "app_config", "content_sync"), {
				version: publishedVersion,
				updatedAt: publishedVersion,
			});
			remoteSyncVersionRef.current = publishedVersion;
			localStorage.setItem(CONTENT_SYNC_SIGNAL_KEY, String(publishedVersion));

			// Also sync app config (categories/authors)
			await fetchAppConfigFromCloud(true);

			setForceSyncStatus({
				isRunning: false,
				step: "Done",
				detail: "All data synced and published successfully!",
				stepIndex: 4,
				totalSteps,
			});
			setTimeout(() => setForceSyncStatus(null), 3000);
		} catch (_e) {
			setForceSyncStatus({
				isRunning: false,
				step: "Error",
				detail: "Sync failed. Check your internet.",
				stepIndex: 0,
				totalSteps,
			});
			setTimeout(() => setForceSyncStatus(null), 4000);
		}
	};

	const retryBhajanSync = useCallback(async () => {
		return await fetchBhajansFromCloud({ forceSync: true, silent: true });
	}, [fetchBhajansFromCloud]);

	const retryBookSync = useCallback(async () => {
		return await fetchBooksFromCloud({ forceSync: true, silent: true });
	}, [fetchBooksFromCloud]);

	const retryLectureSync = useCallback(async () => {
		return await fetchLecturesFromCloud({ forceSync: true, silent: true });
	}, [fetchLecturesFromCloud]);

	// Initial Load: local-first so splash does not wait on network fetches
	useEffect(() => {
		const startTime = Date.now();

		// ✅ FIX: Migration detected hone par needsSync = true karo
		// Jab app update hoti hai, DATA_MIGRATION_VERSION change hoti hai → localStorage clear hoti hai
		// → savedBhajansString null hoga → isFirstTime = true → sync trigger hoga
		let needsSync = false;
		const lastMigration = localStorage.getItem("cpbs_data_migration_version");
		if (lastMigration !== DATA_MIGRATION_VERSION) {
			console.log("Performing data migration to:", DATA_MIGRATION_VERSION);
			localStorage.removeItem("cpbs_all_bhajans");
			localStorage.removeItem("cpbs_all_books");
			localStorage.removeItem("cpbs_all_lectures");
			// bundle_time keys bhi clear karo taaki bhajans forcibly re-download hon
			localStorage.removeItem("cpbs_bhajans_bundle_time");
			localStorage.removeItem("cpbs_books_bundle_time");
			localStorage.removeItem("cpbs_lectures_bundle_time");
			// M10: Clear sync signal so a stale signal from an old version can't
			// suppress the mandatory post-update re-sync.
			localStorage.removeItem(CONTENT_SYNC_SIGNAL_KEY);
			localStorage.setItem(
				"cpbs_data_migration_version",
				DATA_MIGRATION_VERSION,
			);
			needsSync = true; // app update hua — sync must happen

			// M7: Prune history entries for bhajan IDs that no longer exist in the
			// base dataset. After a migration that removes old IDs, history shows
			// blank unplayable entries for songs that no longer exist.
			try {
				const baseIds = new Set(
					parseRawBhajanText(BHAJANS_DATA).map((b: any) => b.id),
				);
				const history = JSON.parse(
					localStorage.getItem("cpbs_history") || "[]",
				);
				const cleanHistory = history.filter(
					(h: any) => h.type !== "song" || baseIds.has(h.id),
				);
				if (cleanHistory.length !== history.length) {
					localStorage.setItem("cpbs_history", JSON.stringify(cleanHistory));
					console.log(
						`[Migration M7] Pruned ${history.length - cleanHistory.length} stale history entries`,
					);
				}
			} catch {}
		}

		// M1/D9 + M4: Non-blocking startup health check.
		// Runs in the background — doesn't block splash or content load.
		// • Android: one-time migration out of the old public books folder (wipes
		//   its duplicate files), then rebuilds the registry from the files really
		//   on disk (finalizing downloads that finished while the app was closed).
		// • Web PWA: cleans up stale book IDs whose Cache API entries were deleted.
		reconcileDownloadedBooks().catch(console.warn);
		syncWebBookRegistry().catch(console.warn);

		let hydratedBhajans: Bhajan[] = [];
		const savedBhajansString = localStorage.getItem("cpbs_all_bhajans");
		const isFirstTime = !savedBhajansString;
		if (savedBhajansString) {
			try {
				hydratedBhajans = dedupeBhajans(JSON.parse(savedBhajansString));
			} catch {}
		}

		if (hydratedBhajans.length === 0) {
			hydratedBhajans = dedupeBhajans(parseRawBhajanText(BHAJANS_DATA));
			localStorage.setItem("cpbs_all_bhajans", JSON.stringify(hydratedBhajans));
		}
		setBhajans(hydratedBhajans);

		const currentBookHash = hashString(JSON.stringify(BOOKS_DATA));
		const currentLectureHash = hashString(JSON.stringify(LECTURES_DATA));

		const savedBookHash = localStorage.getItem("cpbs_hash_books");
		const savedLectureHash = localStorage.getItem("cpbs_hash_lectures");

		if (savedBookHash !== currentBookHash) {
			// Hash changed (app update) — DON'T overwrite cloud-synced data.
			// Keep existing saved books if any; fall back to hardcoded only if nothing saved.
			localStorage.setItem("cpbs_hash_books", currentBookHash);
			try {
				const savedBooks = JSON.parse(
					localStorage.getItem("cpbs_all_books") || "",
				);
				if (savedBooks && savedBooks.length > 0) {
					setBooks(savedBooks);
				} else {
					setBooks(BOOKS_DATA);
					localStorage.setItem("cpbs_all_books", JSON.stringify(BOOKS_DATA));
				}
			} catch {
				setBooks(BOOKS_DATA);
				localStorage.setItem("cpbs_all_books", JSON.stringify(BOOKS_DATA));
			}
			needsSync = true; // Re-sync from cloud to get latest data after code update
		} else {
			try {
				const savedBooks = JSON.parse(
					localStorage.getItem("cpbs_all_books") || "",
				);
				if (savedBooks && savedBooks.length > 0) setBooks(savedBooks);
				else setBooks(BOOKS_DATA);
			} catch {
				setBooks(BOOKS_DATA);
			}
		}

		if (savedLectureHash !== currentLectureHash) {
			// Hash changed (app update) — DON'T overwrite cloud-synced lecture data.
			// Keep existing saved lectures if any; fall back to hardcoded only if nothing saved.
			localStorage.setItem("cpbs_hash_lectures", currentLectureHash);
			try {
				const savedLectures = JSON.parse(
					localStorage.getItem("cpbs_all_lectures") || "",
				);
				if (savedLectures && savedLectures.length > 0) {
					setLectures(savedLectures);
				} else {
					setLectures(LECTURES_DATA);
					localStorage.setItem(
						"cpbs_all_lectures",
						JSON.stringify(LECTURES_DATA),
					);
				}
			} catch {
				setLectures(LECTURES_DATA);
				localStorage.setItem(
					"cpbs_all_lectures",
					JSON.stringify(LECTURES_DATA),
				);
			}
			needsSync = true; // Re-sync from cloud to get latest data after code update
		} else {
			try {
				const savedLectures = JSON.parse(
					localStorage.getItem("cpbs_all_lectures") || "",
				);
				if (savedLectures && savedLectures.length > 0)
					setLectures(savedLectures);
				else setLectures(LECTURES_DATA);
			} catch {
				setLectures(LECTURES_DATA);
			}
		}

		const elapsed = Date.now() - startTime;
		setTimeout(
			() => {
				setIsLoading(false);
				// ✅ pehli baar (fresh install) ya app update (needsSync) dono cases mein sync karo
				// taaki latest bhajans aur audio data immediately download ho jaye
				if (isFirstTime || needsSync) {
					queueBackgroundContentSync(Date.now()).catch(console.error);
				}
			},
			Math.max(0, MIN_SPLASH_DURATION_MS - elapsed),
		);

		// Fetch app config (categories/authors) in background
		fetchAppConfigFromCloud(true).catch(console.error);
	}, [
		queueBackgroundContentSync, // Fetch app config (categories/authors) in background
		fetchAppConfigFromCloud,
	]);

	// Listen for published force-sync signals only after the app reaches home
	useEffect(() => {
		if (isLoading) return;

		const handleSnapshot = (snap: any) => {
			const remoteVersion = Number(snap.data()?.version || 0);
			remoteSyncVersionRef.current = remoteVersion;
			if (!remoteVersion) return;

			const appliedVersion = Number(
				localStorage.getItem(CONTENT_SYNC_SIGNAL_KEY) || "0",
			);
			// Older app versions saved this phone's clock here, which can be
			// ahead of the server. A version above the published one can only be
			// such a value, so replace it with the server's (no re-download).
			if (
				appliedVersion > remoteVersion &&
				!backgroundSyncPromiseRef.current &&
				!snap.metadata?.fromCache
			) {
				localStorage.setItem(CONTENT_SYNC_SIGNAL_KEY, String(remoteVersion));
				return;
			}
			if (remoteVersion > appliedVersion) {
				queueBackgroundContentSync(remoteVersion).catch((error) => {
					console.error("Background content sync failed:", error);
				});
			}
		};

		const handleError = (error: any) => {
			console.error("Content sync listener failed:", error);
		};

		let unsubscribe: (() => void) | undefined;
		if (shouldUseRestFallback()) {
			unsubscribe = iosOnSnapshotDoc(
				"app_config/content_sync",
				handleSnapshot,
				handleError,
			);
		} else {
			unsubscribe = onSnapshot(
				doc(db, "app_config", "content_sync"),
				handleSnapshot,
				handleError,
			);
		}

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [isLoading, queueBackgroundContentSync]);

	useEffect(() => {
		if (isLoading) return;

		const handleReconnect = () => {
			const appliedVersion = Number(
				localStorage.getItem(CONTENT_SYNC_SIGNAL_KEY) || "0",
			);
			if (remoteSyncVersionRef.current > appliedVersion) {
				queueBackgroundContentSync(remoteSyncVersionRef.current).catch(
					(error) => {
						console.error("Reconnect sync failed:", error);
					},
				);
			}
		};

		window.addEventListener("online", handleReconnect);
		return () => window.removeEventListener("online", handleReconnect);
	}, [isLoading, queueBackgroundContentSync]);

	// --- Actions ---

	const createPlaylist = (name: string) => {
		const newPlaylist: Playlist = {
			id: `pl-${Date.now()}`,
			name,
			items: [],
			createdAt: Date.now(),
		};
		setPlaylists((prev) => [...prev, newPlaylist]);
		showToast(`Created playlist: ${name}`, "success");
	};

	const renamePlaylist = (id: string, newName: string) => {
		setPlaylists((prev) =>
			prev.map((p) => (p.id === id ? { ...p, name: newName } : p)),
		);
		showToast("Playlist renamed", "success");
	};

	const deletePlaylist = (id: string) => {
		setPlaylists((prev) => prev.filter((p) => p.id !== id));
		showToast("Playlist deleted", "info");
	};

	const addToPlaylist = (playlistId: string, bhajanId: string) => {
		setPlaylists((prev) =>
			prev.map((p) => {
				if (p.id === playlistId && !p.items.includes(bhajanId)) {
					return { ...p, items: [...p.items, bhajanId] };
				}
				return p;
			}),
		);
	};

	const removeFromPlaylist = (playlistId: string, bhajanId: string) => {
		setPlaylists((prev) =>
			prev.map((p) => {
				if (p.id === playlistId) {
					return { ...p, items: p.items.filter((id) => id !== bhajanId) };
				}
				return p;
			}),
		);
	};

	const addToHistory = (id: string, type: "song" | "book" | "lecture") => {
		setHistoryItems((prev) => {
			const filtered = prev.filter(
				(item) => !(item.id === id && item.type === type),
			);
			return [{ id, type, timestamp: Date.now() }, ...filtered].slice(0, 100);
		});
	};

	const clearHistory = () => {
		setHistoryItems([]);
		showToast("History cleared", "success");
	};

	const setBookmark = (bookId: string, pageNum: number) => {
		setBookmarks((prev) => ({ ...prev, [bookId]: pageNum }));
		showToast(`Bookmark saved at page ${pageNum}`, "success");
	};

	const removeBookmark = (bookId: string) => {
		setBookmarks((prev) => {
			const next = { ...prev };
			delete next[bookId];
			return next;
		});
		showToast("Bookmark removed", "info");
	};

	// --- Download Logic with Pre-Check & Cancel ---

	const downloadBook = async (book: Book) => {
		// Guard double taps while the size check / confirmation dialog is pending:
		// activeDownloads is only set once the user confirms.
		if (
			activeDownloads[book.id] !== undefined ||
			pendingBookDownloads.current.has(book.id)
		)
			return;
		pendingBookDownloads.current.add(book.id);

		const directUrl = getDirectPdfUrl(book.url || "");
		// Step 1: Fetch Size
		let size = book.sizeBytes || 0;
		if (size === 0) {
			showToast("Checking file size...", "info");
			size = await getRemoteFileSize(directUrl);
		}

		// Step 2: Show Confirmation
		const release = () => pendingBookDownloads.current.delete(book.id);
		setDownloadConfirmation({
			isOpen: true,
			itemTitle: book.title,
			url: directUrl,
			sizeBytes: size,
			type: "book",
			onCancel: () => {
				release();
				setDownloadConfirmation(null);
			},
			onConfirm: () => {
				release();
				setDownloadConfirmation(null);
				startBookDownload(book, size);
			},
		});
	};

	const startBookDownload = async (book: Book, knownSize: number) => {
		const controller = new AbortController();
		downloadControllers.current[book.id] = controller;

		setActiveDownloads((prev) => ({
			...prev,
			[book.id]: {
				progress: 0,
				loaded: 0,
				total: knownSize,
				title: book.title,
				type: "book",
			},
		}));

		// Update: Create a book object with the known size so saveBook doesn't need to fetch it again.
		// Use the old saveBook signature (no 4th argument).
		const bookWithSize = { ...book, sizeBytes: knownSize || book.sizeBytes };

		const success = await saveBook(
			bookWithSize,
			(percent, loaded, total) => {
				setActiveDownloads((prev) => ({
					...prev,
					[book.id]: {
						progress: percent,
						loaded,
						total,
						title: book.title,
						type: "book",
					},
				}));
			},
			controller.signal,
		);

		if (success) showToast(`Downloaded: ${book.title}`, "success");
		else if (!controller.signal.aborted)
			showToast(`Failed: ${book.title}`, "error");

		delete downloadControllers.current[book.id];
		setTimeout(() => {
			setActiveDownloads((prev) => {
				const newState = { ...prev };
				delete newState[book.id];
				return newState;
			});
		}, 1000);
	};

	const downloadTrack = async (
		track: BhajanAudio,
		title: string,
		category: AudioCategory = "audio",
	) => {
		if (activeDownloads[track.id] !== undefined) return;

		showToast("Checking file size...", "info");

		const directUrl = getPlayableUrl(track.url);
		const size = await getRemoteFileSize(directUrl);

		setDownloadConfirmation({
			isOpen: true,
			itemTitle: `${title} (${track.singer})`,
			url: directUrl,
			sizeBytes: size,
			type: "audio",
			onCancel: () => setDownloadConfirmation(null),
			onConfirm: () => {
				setDownloadConfirmation(null);
				startTrackDownload(track, title, size, category);
			},
		});
	};

	const startTrackDownload = async (
		track: BhajanAudio,
		title: string,
		knownSize: number,
		category: AudioCategory = "audio",
	) => {
		const controller = new AbortController();
		downloadControllers.current[track.id] = controller;

		setActiveDownloads((prev) => ({
			...prev,
			[track.id]: {
				progress: 0,
				loaded: 0,
				total: knownSize,
				title: title,
				type: "audio",
			},
		}));

		const success = await saveTrack(
			track,
			title,
			(percent, loaded, total) => {
				setActiveDownloads((prev) => ({
					...prev,
					[track.id]: {
						progress: percent,
						loaded,
						total,
						title: title,
						type: "audio",
					},
				}));
			},
			controller.signal,
			knownSize,
			category,
		);

		if (success) {
			const safeName = (s: string) =>
				s
					.replace(/[\\/:*?"<>|]/g, "")
					.trim()
					.slice(0, 60);
			const t = safeName(title) || "audio";
			const s = safeName(track.singer || "");
			const fileName = s ? `${t} - ${s}.m4a` : `${t}.m4a`;
			const folder =
				category === "lecture" ? "Prem Bhakti/Lectures" : "Prem Bhakti/Audios";
			showToast(`✅ Saved: ${fileName}\n📁 Downloads/${folder}`, "success");
		} else if (!controller.signal.aborted)
			showToast(`Download Failed`, "error");

		delete downloadControllers.current[track.id];
		setTimeout(() => {
			setActiveDownloads((prev) => {
				const newState = { ...prev };
				delete newState[track.id];
				return newState;
			});
		}, 1000);
	};

	const cancelDownload = (id: string) => {
		if (downloadControllers.current[id]) {
			downloadControllers.current[id].abort();
			delete downloadControllers.current[id];

			setActiveDownloads((prev) => {
				const newState = { ...prev };
				delete newState[id];
				return newState;
			});
			showToast("Download cancelled", "info");
		}
	};

	// --- Import / Export (Admin & User Backup) ---

	const importData = (json: string): boolean => {
		try {
			const data = JSON.parse(json);

			// 1. Check for User Backup (contains settings, playlists etc)
			if (data.isUserBackup) {
				return restoreUserData(json);
			}

			// 2. Admin Content Patch Logic
			let workingBhajans = [...bhajans];
			let updated = false;

			if (data.deleted && Array.isArray(data.deleted)) {
				const deletedIds = new Set(data.deleted);
				workingBhajans = workingBhajans.filter((b) => !deletedIds.has(b.id));
				updated = true;
			}
			if (data.bhajans && Array.isArray(data.bhajans)) {
				const map = new Map(workingBhajans.map((b) => [b.id, b]));
				data.bhajans.forEach((b: Bhajan) => map.set(b.id, b));
				workingBhajans = Array.from(map.values());
				updated = true;
			}
			if (data.added || data.modified) {
				const patchItems = [...(data.added || []), ...(data.modified || [])];
				const map = new Map(workingBhajans.map((b) => [b.id, b]));
				patchItems.forEach((b: Bhajan) => map.set(b.id, b));
				workingBhajans = Array.from(map.values());
				updated = true;
			}

			if (updated) {
				setBhajans(workingBhajans);
				localStorage.setItem(
					"cpbs_all_bhajans",
					JSON.stringify(workingBhajans),
				);
				// Invalidate hash so next load knows we've modified data manually
				localStorage.setItem("cpbs_hash_bhajans", "admin_modified");
			}
			if (data.books) {
				setBooks(data.books);
				localStorage.setItem("cpbs_hash_books", "admin_modified");
			}
			if (data.lectures) {
				setLectures(data.lectures);
				localStorage.setItem("cpbs_hash_lectures", "admin_modified");
			}
			if (data.events) {
				// Do NOT overwrite Firebase events with local JSON import
				// The JSON might contain old data that wipes out Firebase data
				showToast(
					"Calendar events cannot be imported. Use the Calendar Editor to manage events online.",
					"info",
				);
			}
			showToast("Content Imported Successfully", "success");
			return true;
		} catch (_e) {
			showToast("Invalid JSON Data", "error");
			return false;
		}
	};

	// --- Google Drive backup / restore ---
	// Token, folder and file handling live in utils/backup/driveBackup.ts; the
	// backup contents in utils/backup/backupData.ts, and the silent automatic
	// Drive backup in utils/backup/driveAutoBackup.ts.
	const isHindiUi = () => safeLocalGet("cpbs_settings_lang") === "hi";

	const showDriveError = (e: unknown) => {
		const hi = isHindiUi();
		const code = e instanceof DriveError ? e.code : "failed";
		if (code === "cancelled") return;
		const messages: Record<string, [string, string]> = {
			"not-signed-in": [
				"Please log in to your profile first.",
				"कृपया पहले प्रोफ़ाइल में लॉगिन करें।",
			],
			"not-google": [
				"Google Drive backup needs a Google login. Please log in with Google, or use the Android app.",
				"Google Drive बैकअप के लिए Google से लॉगिन चाहिए। कृपया Google से लॉगिन करें या Android ऐप इस्तेमाल करें।",
			],
			"wrong-account": [
				"Please choose the same Google account you logged in with.",
				"कृपया वही Google अकाउंट चुनें जिससे आपने लॉगिन किया है।",
			],
			"popup-blocked": [
				"Your browser blocked the Google window. Please allow pop-ups and try again.",
				"ब्राउज़र ने Google विंडो रोक दी। कृपया pop-ups की अनुमति दें और फिर प्रयास करें।",
			],
			"needs-consent": [
				"Google Drive permission is needed.",
				"Google Drive की अनुमति आवश्यक है।",
			],
			api: [
				"Google Drive did not respond. Please try again.",
				"Google Drive से जवाब नहीं मिला। कृपया फिर से प्रयास करें।",
			],
			failed: [
				"Could not connect to Google Drive. Please try again.",
				"Google Drive से कनेक्ट नहीं हो सका। कृपया फिर से प्रयास करें।",
			],
		};
		const [en, hin] = messages[code] || messages.failed;
		console.error("[Drive backup]", e);
		showToast(hi ? hin : en, "error");
	};

	const backupUserData = async (): Promise<boolean> => {
		try {
			const token = await getDriveAccessToken(true);
			if (!token) return false;
			showToast(
				isHindiUi()
					? "Google Drive में सहेजा जा रहा है..."
					: "Saving to Google Drive...",
				"info",
			);
			const { json, signature } = buildDriveBackup();
			await saveBackupToDrive(token, json);
			markDriveBackupSaved(signature);
			showToast(
				isHindiUi()
					? `Google Drive में "${DRIVE_FOLDER_NAME}" फ़ोल्डर में बैकअप सहेजा गया ✅`
					: `Backup saved to Google Drive → "${DRIVE_FOLDER_NAME}" ✅`,
				"success",
			);
			return true;
		} catch (e) {
			showDriveError(e);
			return false;
		}
	};

	const restoreUserData = (
		jsonString: string,
		options: { fromDrive?: boolean; message?: string } = {},
	): boolean => {
		const parsed = parseBackupFile(jsonString);
		if (!parsed) {
			showToast(
				isHindiUi() ? "बैकअप फ़ाइल सही नहीं है" : "Invalid Backup File",
				"error",
			);
			return false;
		}
		try {
			const { data } = parsed;
			// React state too, so nothing writes the old lists back to storage in
			// the moment before the reload.
			if (Array.isArray(data.playlists)) setPlaylists(data.playlists);
			if (data.bookmarks && typeof data.bookmarks === "object")
				setBookmarks(data.bookmarks);
			if (Array.isArray(data.history)) setHistoryItems(data.history);
			applyBackupData(data);
			if (options.fromDrive) markDriveBackupSaved();

			// Force Reload to apply settings context
			showToast(
				options.message ||
					(isHindiUi()
						? "डेटा रिस्टोर हो गया! ऐप दोबारा शुरू हो रहा है..."
						: "Data restored! Restarting app to apply settings..."),
				"success",
			);
			setTimeout(() => {
				window.location.reload();
			}, 2000);
			return true;
		} catch (e) {
			console.error(e);
			showToast(
				isHindiUi() ? "डेटा रिस्टोर नहीं हो सका" : "Failed to restore data.",
				"error",
			);
			return false;
		}
	};

	const restoreFromCloud = async (): Promise<boolean> => {
		try {
			const token = await getDriveAccessToken(true);
			if (!token) return false;
			showToast(
				isHindiUi()
					? "Google Drive में बैकअप खोजा जा रहा है..."
					: "Searching Google Drive for backups...",
				"info",
			);
			const found = await loadBackupFromDrive(token);
			if (!found) {
				showToast(
					isHindiUi()
						? "Google Drive में कोई बैकअप नहीं मिला।"
						: "No backup found on Google Drive.",
					"error",
				);
				return false;
			}
			return restoreUserData(found.json, { fromDrive: true });
		} catch (e) {
			showDriveError(e);
			return false;
		}
	};

	const resetData = () => {
		localStorage.removeItem("cpbs_all_bhajans");
		localStorage.removeItem("cpbs_all_books");
		localStorage.removeItem("cpbs_all_lectures");
		localStorage.removeItem("cpbs_hash_bhajans");
		localStorage.removeItem("cpbs_hash_books");
		localStorage.removeItem("cpbs_hash_lectures");
		localStorage.removeItem("cpbs_hash_static_events");
		localStorage.removeItem(CONTENT_SYNC_SIGNAL_KEY);
		// M9: Also clear bundle_time keys and migration version so next launch
		// triggers a clean re-sync and re-migration from scratch.
		localStorage.removeItem("cpbs_bhajans_bundle_time");
		localStorage.removeItem("cpbs_books_bundle_time");
		localStorage.removeItem("cpbs_lectures_bundle_time");
		localStorage.removeItem("cpbs_data_migration_version");

		const freshBhajans = dedupeBhajans(parseRawBhajanText(BHAJANS_DATA));
		setBhajans(freshBhajans);
		setBooks(BOOKS_DATA);
		setLectures(LECTURES_DATA);
		// We DO NOT reset events, as they are synced from Firebase

		showToast("Data reset successfully", "success");
	};

	const saveBhajanLocally = (id: string, title: string, content: string) => {
		setBhajans((prev) => {
			const newBhajans = prev.map((b) =>
				b.id === id ? { ...b, title, content } : b,
			);
			localStorage.setItem("cpbs_all_bhajans", JSON.stringify(newBhajans));
			// Invalidate hash so local edits persist
			localStorage.setItem("cpbs_hash_bhajans", "user_modified");
			return newBhajans;
		});
		showToast("Saved locally", "success");
	};

	return (
		<DataContext.Provider
			value={{
				allBhajans: bhajans,
				bhajans: bhajans.filter((b) => !b.isHidden),
				setBhajans,
				allBooks: books,
				books: books.filter((b) => !b.isHidden),
				setBooks,
				allLectures: lectures,
				lectures: lectures.filter((l) => !l.isHidden),
				setLectures,
				events,
				setEvents,
				playlists,
				historyItems,
				activeDownloads,
				isLoading,
				bookmarks,
				syncStatus,
				isBhajanSyncing,
				isBookSyncing,
				isLectureSyncing,
				bhajanSyncProgress: contentSyncProgress.bhajans,
				bookSyncProgress: contentSyncProgress.books,
				lectureSyncProgress: contentSyncProgress.lectures,
				forceSyncStatus,
				downloadConfirmation,
				retryBhajanSync,
				retryBookSync,
				retryLectureSync,
				fetchEvents,
				createPlaylist,
				renamePlaylist,
				deletePlaylist,
				addToPlaylist,
				removeFromPlaylist,
				addToHistory,
				clearHistory,
				downloadBook,
				downloadTrack,
				cancelDownload,
				importData,
				forceSyncCloudData,
				resetData,
				saveBhajanLocally,
				backupUserData,
				restoreUserData,
				restoreFromCloud,
				setBookmark,
				removeBookmark,
				filterCategories,
				knownAuthors: knownAuthorsState,
			}}
		>
			{children}
		</DataContext.Provider>
	);
};

export const useData = () => {
	const context = useContext(DataContext);
	if (!context) throw new Error("useData must be used within DataProvider");
	return context;
};

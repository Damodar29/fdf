import {
	arrayUnion,
	collection,
	doc,
	getDoc,
	getDocFromServer,
	getDocs,
	runTransaction,
	setDoc,
} from "firebase/firestore";
import {
	ArrowLeft,
	Calendar,
	CheckCircle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Clock,
	Edit2,
	Eye,
	Image as ImageIcon,
	Link,
	Loader2,
	MapPin,
	Plus,
	Save,
	Trash2,
	Upload,
	Users,
	Video,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "../../../services/firebase";
import { formatForDateInput } from "../../../utils/dateFormatter";
import { validateAndFormatUrl } from "../../../utils/url";
import { useAdminBack } from "../../hooks/useAdminBack";
import { usePopupBackHandler } from "../../hooks/usePopupBackHandler";
import {
	type GalleryItem,
	MANDAL_LIST,
	type MandalData,
	type MandalVideo,
	type TempleTiming,
	type WeeklyProgram,
} from "../../types/mandal";
import {
	normalizeB2Url,
	softDeleteFromB2,
	uploadFileToB2,
} from "../../utils/b2Uploader";
import { deleteGithubAssetForItem } from "../../utils/githubReleaseAssets";
import { uploadToGithubRelease } from "../../utils/githubUploader";
import { scheduleMandalNotification } from "../../utils/mandalNotificationHelper";
import { UploadBlockerModal } from "./UploadBlockerModal";
import { DevoteeProfileManager } from "./DevoteeProfileManager";
import { MandalAdminPanel } from "./MandalAdminPanel";

const getISTDocId = () => {
	const d = new Date();
	const istOffset = 5.5 * 60 * 60 * 1000;
	const istDate = new Date(d.getTime() + istOffset);
	return (
		istDate.toISOString().split(".")[0].replace(/[:]/g, "-") +
		"-IST-" +
		Math.random().toString(36).substring(2, 7)
	);
};

export interface BulkUploadTask {
	id: string;
	name: string;
	progress: number;
	status: "pending" | "uploading" | "completed" | "error";
	error?: string;
}

interface MandalManagerProps {
	mandalId: string;
	isSuperAdmin: boolean;
	permissions?: string[];
}

const NAV_VIEWS = [
	"menu",
	"activity",
	"darshan",
	"timings",
	"devotees",
	"devotees_advanced",
] as const;
type NavView = (typeof NAV_VIEWS)[number];

export const MandalManager: React.FC<MandalManagerProps> = ({
	mandalId: initialMandalId,
	isSuperAdmin,
	permissions,
}) => {
	const [dbMandals, setDbMandals] = useState<any[]>([]);
	const allMandals = [
		...MANDAL_LIST,
		...dbMandals.filter((m) => !MANDAL_LIST.find((sm) => sm.id === m.id)),
	];
	const [selectedMandalId, setSelectedMandalId] = useState(
		initialMandalId || [...MANDAL_LIST].reverse()[0].id,
	);
	const [mandalData, setMandalData] = useState<MandalData | null>(null);
	const [loading, setLoading] = useState(true);
	const [currentView, setCurrentView] = useState<NavView>("menu");

	// Mandal Dropdown State
	const [isMandalDropdownOpen, setIsMandalDropdownOpen] = useState(false);
	const handleClose_mandal_dropdown = usePopupBackHandler(
		isMandalDropdownOpen,
		"mandal-dropdown",
		() => setIsMandalDropdownOpen(false),
	);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				handleClose_mandal_dropdown();
			}
		};
		if (isMandalDropdownOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isMandalDropdownOpen]);

	// Temple Timings State
	const [timingsDraft, setTimingsDraft] = useState<TempleTiming[]>([]);
	const [savingTimings, setSavingTimings] = useState(false);

	// Weekly Program Scope Selection
	const [selectedProgramScope, setSelectedProgramScope] =
		useState<string>("global"); // 'global' by default

	const [weeklyDraft, setWeeklyDraft] = useState<WeeklyProgram>({
		title: "",
		description: "",
		locationUrl: "",
		date: "",
		enabled: false,
	});
	const [savingWeekly, setSavingWeekly] = useState(false);

	// Gallery State
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [selectedFiles, setSelectedFiles] = useState<
		{
			id: string;
			file: File;
			displayName: string;
			date: string;
			order: number;
			previewUrl: string;
		}[]
	>([]);
	const [previewSelectedDate, setPreviewSelectedDate] = useState<string | null>(
		null,
	);
	const [globalName, setGlobalName] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Video Management State
	const [videoForm, setVideoForm] = useState<{
		title: string;
		url: string;
		date: string;
		thumbnailUrl: string;
		thumbnailXOffset?: number;
		thumbnailYOffset?: number;
		useDefaultThumbnail?: boolean;
		description?: string;
	}>({
		title: "",
		url: "",
		date: new Date().toISOString().split("T")[0],
		thumbnailUrl: "",
		thumbnailXOffset: 50,
		thumbnailYOffset: 50,
		useDefaultThumbnail: false,
		description: "",
	});
	const [videoFormOpen, setVideoFormOpen] = useState(false);
	const [savingVideo, setSavingVideo] = useState(false);
	const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
	const [editingVideo, setEditingVideo] = useState<MandalVideo | null>(null);
	const [uploadingVideo, setUploadingVideo] = useState(false);
	const [uploadVideoProgress, setUploadVideoProgress] = useState(0);
	const [uploadingFileName, setUploadingFileName] = useState("");
	const [bulkUploadTasks, setBulkUploadTasks] = useState<BulkUploadTask[]>([]);
	const videoInputRef = useRef<HTMLInputElement>(null);
	const bulkVideoInputRef = useRef<HTMLInputElement>(null);
	// AbortController for cancelling in-flight B2 video uploads
	const uploadAbortControllerRef = useRef<AbortController | null>(null);
	// Tracks which video ID (in the mandal doc) is currently uploading (for cleanup on cancel)
	const uploadingVideoIdRef = useRef<string | null>(null);

	// Auto Approve setting
	const [autoApprove, setAutoApprove] = useState(false);

	// Edit Gallery Item State
	const [editingGalleryItem, setEditingGalleryItem] =
		useState<GalleryItem | null>(null);
	const [deletingItemIds, setDeletingItemIds] = useState<Set<string>>(
		() => new Set(),
	);
	// URLs of photos deleted in the last couple of minutes. GitHub's release
	// listing can keep returning a just-deleted asset for a while, and the sync
	// below would otherwise put it straight back on screen.
	const recentlyDeletedUrls = useRef<Map<string, number>>(new Map());
	// Only the newest fetchMandalData() call may write state — an older, slower
	// one finishing last would otherwise bring back what was just changed.
	const fetchSeqRef = useRef(0);

	// Feedback State
	const [toastMessage, setToastMessage] = useState<{
		text: string;
		type: "success" | "error";
	} | null>(null);
	const [confirmDialog, setConfirmDialog] = useState<{
		message: string;
		onConfirm: () => void;
	} | null>(null);

	// ── BACK BUTTON SUPPORT FOR POPUPS ──
	const closeVideoForm = usePopupBackHandler(
		videoFormOpen,
		"mandal-video-form",
		() => setVideoFormOpen(false),
	);
	const closeEditingGalleryItem = usePopupBackHandler(
		!!editingGalleryItem,
		"mandal-edit-gallery",
		() => setEditingGalleryItem(null),
	);
	const closeConfirmDialog = usePopupBackHandler(
		!!confirmDialog,
		"mandal-confirm",
		() => setConfirmDialog(null),
	);

	const showToast = (text: string, type: "success" | "error" = "success") => {
		setToastMessage({ text, type });
		setTimeout(() => setToastMessage(null), 3000);
	};

	useEffect(() => {
		const fetchDbMandals = async () => {
			try {
				const snap = await getDocs(collection(db, "mandals"));
				const list: any[] = [];
				snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
				setDbMandals(list);
			} catch (e) {
				console.error(e);
			}
		};
		fetchDbMandals();
	}, []);

	// Reset date selection when switching views
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setPreviewSelectedDate(null);
	}, [currentView, selectedMandalId]);

	const fetchSettings = async () => {
		try {
			const docRef = await getDoc(doc(db, "app_config", "mandal_settings"));
			if (docRef.exists()) {
				setAutoApprove(docRef.data().autoApprove || false);
			}
		} catch (e) {
			console.error(e);
		}
	};

	/**
	 * `silent` refreshes after a save/delete/upload keep the current screen up.
	 * Showing the full-screen spinner there unmounted the whole gallery, so every
	 * delete looked like the screen reloading (images, scroll and open date lost).
	 */
	const fetchMandalData = async (opts?: { silent?: boolean }) => {
		const seq = ++fetchSeqRef.current;
		if (!opts?.silent) setLoading(true);
		try {
			const docRef = await getDoc(doc(db, "mandals", selectedMandalId));
			let data: MandalData = {
				id: selectedMandalId,
				name: allMandals.find((m) => m.id === selectedMandalId)?.name || "",
				weeklyProgram: {
					title: "",
					description: "",
					locationUrl: "",
					date: "",
					enabled: false,
				},
				gallery: [],
				templeTimings: [],
			};

			if (docRef.exists()) {
				// clone so we don't mutate firestore cache
				data = JSON.parse(JSON.stringify(docRef.data())) as MandalData;
				if (!data.gallery) data.gallery = [];
			}

			// SYNCHRONIZE GITHUB RELEASES WITH ADMIN PANEL
			// This ensures Admin Panel sees exactly what Darshan Screen sees, including orphaned logic
			try {
				const tokenDoc = await getDoc(doc(db, "damtoken", "github"));
				const token = tokenDoc.exists() ? tokenDoc.data().token?.trim() : null;

				if (token) {
					const response = await fetch(
						`https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?per_page=100`,
						{
							headers: {
								Authorization: `token ${token}`,
								Accept: "application/vnd.github.v3+json",
							},
						},
					);
					if (response.ok) {
						const releases = await response.json();
						const githubGalleryItems: GalleryItem[] = [];

						const actDoc = await getDoc(
							doc(db, "app_config", "activity_folders"),
						);
						const darDoc = await getDoc(
							doc(db, "app_config", "darshan_folders"),
						);
						const actIds: number[] = actDoc.exists()
							? actDoc.data().visibleIds || []
							: [];
						const darIds: number[] = darDoc.exists()
							? darDoc.data().visibleIds || []
							: [];

						releases.forEach((release: any) => {
							const isDarshan = darIds.includes(release.id);
							const isActivity = actIds.includes(release.id);
							if (!isDarshan && !isActivity) return;

							const lowerReleaseName = release.name.toLowerCase();
							const foundMandal = MANDAL_LIST.find((m) => {
								const coreName = m.name
									.toLowerCase()
									.replace(" mandal", "")
									.trim();
								const id = m.id.toLowerCase();
								return (
									lowerReleaseName.includes(coreName) ||
									lowerReleaseName.includes(id)
								);
							});

							const targetMandalId = foundMandal?.id || `github-${release.id}`;
							if (targetMandalId === selectedMandalId) {
								release.assets.forEach((asset: any) => {
									const dateObj = new Date(asset.created_at);
									let dateOnly = !Number.isNaN(dateObj.getTime())
										? dateObj.toISOString().split("T")[0]
										: asset.created_at;
									let displayName = asset.name;
									let order = 0;

									const match = asset.name.match(
										/^\[(.*?)\]\[(.*?)\]\[(.*?)\]\.(.*)$/,
									);
									if (match) {
										dateOnly = match[1];
										order = parseInt(match[2], 10) || 0;
										displayName = match[3];
									} else {
										displayName = asset.name.replace(/\.[^/.]+$/, "");
									}

									githubGalleryItems.push({
										id: asset.id.toString(),
										url: asset.browser_download_url,
										displayName,
										date: dateOnly,
										order,
										type: isDarshan ? "darshan" : "activity",
										releaseId: release.id,
									} as any);
								});
							}
						});

						// Same rule as the Darshan / Activities screens: GitHub files are
						// only shown for a type when the database has no photos of that
						// type. Adding them on top listed photos users never see —
						// including ones "deleted" earlier whose file stayed on GitHub,
						// so a deleted photo seemed to come straight back.
						const now = Date.now();
						recentlyDeletedUrls.current.forEach((ts, url) => {
							if (now - ts > 120_000) recentlyDeletedUrls.current.delete(url);
						});
						const dbTypes = new Set((data.gallery || []).map((g) => g.type));
						const uniqueUrls = new Set<string>(
							(data.gallery || []).map((g) => g.url),
						);
						githubGalleryItems.forEach((item) => {
							if (
								!dbTypes.has(item.type) &&
								!uniqueUrls.has(item.url) &&
								!recentlyDeletedUrls.current.has(item.url)
							) {
								uniqueUrls.add(item.url);
								(data.gallery as any).push(item);
							}
						});
					}
				}
			} catch (err) {
				console.error("Error fetching GitHub releases for admin sync:", err);
			}

			if (seq !== fetchSeqRef.current) return;
			setMandalData(data);
			// A silent refresh must not throw away timing edits that aren't saved yet.
			if (!opts?.silent) setTimingsDraft(data.templeTimings || []);
		} catch (error) {
			console.error("Error fetching mandal data:", error);
		}
		if (seq === fetchSeqRef.current) setLoading(false);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchMandalData, fetchSettings are recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (selectedMandalId) {
			fetchMandalData();
			fetchSettings();
			setSelectedProgramScope("global");
		}
	}, [selectedMandalId]);

	useEffect(() => {
		if (!mandalData) return;
		if (selectedProgramScope === "global") {
			setWeeklyDraft(
				mandalData.weeklyProgram || {
					title: "",
					description: "",
					locationUrl: "",
					date: "",
					enabled: false,
				},
			);
		} else {
			setWeeklyDraft(
				mandalData.dailyPrograms?.[selectedProgramScope] || {
					title: "",
					description: "",
					locationUrl: "",
					date: "",
					enabled: false,
				},
			);
		}
	}, [selectedProgramScope, mandalData]);

	const submitRequest = async (
		type:
			| "weekly_program"
			| "daily_program"
			| "gallery_item"
			| "delete_gallery_item"
			| "temple_timings"
			| "edit_gallery_item",
		data: any,
	) => {
		const mandalName =
			allMandals.find((m) => m.id === selectedMandalId)?.name ||
			selectedMandalId;
		const email = auth.currentUser?.email || "unknown";

		if (autoApprove || isSuperAdmin) {
			const mandalRef = doc(db, "mandals", selectedMandalId);
			if (type === "weekly_program") {
				await setDoc(mandalRef, { weeklyProgram: data }, { merge: true });
			} else if (type === "daily_program") {
				// Read FRESH to avoid spreading stale daily programs over current ones
				const mandalDoc = await getDocFromServer(mandalRef);
				const currentData = mandalDoc.exists() ? mandalDoc.data() : {};
				const currentDailyPrograms = currentData.dailyPrograms || {};

				await setDoc(
					mandalRef,
					{
						dailyPrograms: {
							...currentDailyPrograms,
							[data.dateKey]: data.program,
						},
					},
					{ merge: true },
				);
			} else if (type === "gallery_item") {
				await setDoc(mandalRef, { gallery: arrayUnion(data) }, { merge: true });
			} else if (type === "delete_gallery_item") {
				const isTarget = (g: GalleryItem) =>
					String(g.id) === String(data.id) && g.url === data.url;

				// ── Step 1: Optimistic UI update — remove from local state immediately ─
				setMandalData((prev) =>
					prev
						? { ...prev, gallery: prev.gallery.filter((g) => !isTarget(g)) }
						: prev,
				);

				// ── Step 2: Delete the file from GitHub first ─────────────────────────
				// If this fails the database entry is kept (and the photo put back on
				// screen): dropping it anyway left the file in the release, where the
				// app falls back to it once a mandal has no database photos.
				try {
					await deleteGithubAssetForItem(data);
				} catch (err) {
					fetchMandalData({ silent: true });
					throw err;
				}
				if (data.url) recentlyDeletedUrls.current.set(data.url, Date.now());

				// ── Step 3: Remove from the database in a transaction ─────────────────
				// Two deletes tapped quickly each read the gallery and wrote it back;
				// the slower write restored the photo the other one had just removed.
				const updatedGallery = await runTransaction(db, async (tx) => {
					const snap = await tx.get(mandalRef);
					const gallery: GalleryItem[] = snap.exists()
						? snap.data().gallery || []
						: [];
					const next = gallery.filter((g) => !isTarget(g));
					if (next.length !== gallery.length) {
						tx.set(mandalRef, { gallery: next }, { merge: true });
					}
					return next;
				});

				// ── Step 4: Hide the release from the app if no items of this type left ─
				const remainingItems = updatedGallery.filter(
					(g) => g.type === data.type,
				);
				if (remainingItems.length === 0) {
					const configDocName =
						data.type === "activity" ? "activity_folders" : "darshan_folders";
					const releaseKey =
						data.type === "activity" ? "activityRelease" : "githubRelease";
					const mandalDocSnap = await getDocFromServer(mandalRef);
					const releaseInfo = mandalDocSnap.exists()
						? mandalDocSnap.data()[releaseKey]
						: null;

					if (releaseInfo?.id) {
						const currentConfigDoc = await getDocFromServer(
							doc(db, "app_config", configDocName),
						);
						const currentVisibleIds = currentConfigDoc.exists()
							? currentConfigDoc.data().visibleIds || []
							: [];
						const newVisibleIds = currentVisibleIds.filter(
							(id: number) => id !== releaseInfo.id,
						);
						await setDoc(
							doc(db, "app_config", configDocName),
							{ visibleIds: newVisibleIds },
							{ merge: true },
						);
					}
				}
			} else if (type === "edit_gallery_item") {
				// Transaction, so an edit can't overwrite a delete/upload that landed
				// between reading the gallery and writing it back.
				const found = await runTransaction(db, async (tx) => {
					const snap = await tx.get(mandalRef);
					const gallery: GalleryItem[] = snap.exists()
						? snap.data().gallery || []
						: [];
					let hit = false;
					const next = gallery.map((g) => {
						if (String(g.id) === String(data.id) && g.url === data.url) {
							hit = true;
							return data;
						}
						return g;
					});
					if (hit) tx.set(mandalRef, { gallery: next }, { merge: true });
					return hit;
				});
				if (!found) {
					// A GitHub-only file (no database entry) — there was nothing to
					// save, so don't report success.
					showToast(
						"This photo exists only on GitHub. Edit it from Gallery UI.",
						"error",
					);
					return;
				}
			} else if (type === "temple_timings") {
				await setDoc(mandalRef, { templeTimings: data }, { merge: true });
			}
			showToast(
				type === "delete_gallery_item"
					? "Deleted successfully!"
					: "Saved successfully!",
			);
			fetchMandalData({ silent: true });
		} else {
			const docId = getISTDocId();
			await setDoc(doc(db, "approvals", docId), {
				mandalId: selectedMandalId,
				mandalName,
				type,
				data,
				status: "pending",
				requestedBy: email,
				timestamp: Date.now(),
			});
			showToast("Request sent for approval to Super Admin.");
		}
	};

	const handleSaveWeekly = async () => {
		const validatedUrl = validateAndFormatUrl(weeklyDraft.locationUrl);
		if (validatedUrl === null && weeklyDraft.locationUrl.trim() !== "") {
			showToast("Please enter a valid Google Maps Link URL.", "error");
			return;
		}
		setSavingWeekly(true);
		try {
			const payload = { ...weeklyDraft, locationUrl: validatedUrl || "" };
			if (selectedProgramScope === "global") {
				await submitRequest("weekly_program", payload);
			} else {
				await submitRequest("daily_program", {
					dateKey: selectedProgramScope,
					program: payload,
				});
			}
		} catch (_e) {
			showToast("Failed to save program.", "error");
		}
		setSavingWeekly(false);
	};

	const handleSaveTimings = async () => {
		setSavingTimings(true);
		try {
			await submitRequest("temple_timings", timingsDraft);
		} catch (_e) {
			showToast("Failed to save temple timings.", "error");
		}
		setSavingTimings(false);
	};

	const [globalDate, setGlobalDate] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	});

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!e.target.files) return;
		const files = Array.from(e.target.files);
		const newFiles = await Promise.all(
			files.map(async (file, index) => {
				const buffer = await file.arrayBuffer();
				const safeFile = new File([buffer], file.name, { type: file.type });
				return {
					id: Math.random().toString(36).substr(2, 9),
					file: safeFile,
					displayName: globalName.trim()
						? `${globalName.trim()} ${selectedFiles.length + index + 1}`
						: file.name.split(".")[0],
					date: globalDate,
					order: selectedFiles.length + index + 1,
					previewUrl: URL.createObjectURL(safeFile),
				};
			}),
		);
		setSelectedFiles((prev) => [...prev, ...newFiles]);
		e.target.value = "";
	};

	const handleUploadGallery = async () => {
		if (selectedFiles.length === 0) {
			showToast("Please select at least one file.", "error");
			return;
		}
		for (const f of selectedFiles) {
			if (!f.displayName.trim()) {
				showToast("Please enter a display name for all files.", "error");
				return;
			}
		}

		setUploading(true);
		const uploadedItems: GalleryItem[] = [];
		const releaseIds: number[] = [];
		let hasError = false;
		try {
			const mandalName =
				allMandals.find((m) => m.id === selectedMandalId)?.name ||
				selectedMandalId;
			const email = auth.currentUser?.email || "unknown";
			const mandalRef = doc(db, "mandals", selectedMandalId);

			let completedCount = 0;
			const uploadPromises = selectedFiles.map(async (f, index) => {
				try {
					const safeName = f.displayName.replace(/[[\]]/g, "").trim();
					const customFileName = `[${f.date}][${f.order}][${safeName}]`;
					const uploadResult = await uploadToGithubRelease(
						f.file,
						selectedMandalId,
						customFileName,
						currentView as "darshan" | "activity",
						{ totalFiles: selectedFiles.length, currentIndex: index + 1 },
					);

					const match = uploadResult.url.match(/assets\/(\d+)/);
					const assetId = match
						? match[1]
						: `gal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

					const item: GalleryItem = {
						id: assetId,
						url: uploadResult.url,
						displayName: f.displayName,
						date: f.date,
						order: f.order,
						type: currentView as "darshan" | "activity",
					};

					if (autoApprove || isSuperAdmin) {
						await setDoc(
							mandalRef,
							{ gallery: arrayUnion(item) },
							{ merge: true },
						);
						if (
							uploadResult.releaseId &&
							!releaseIds.includes(uploadResult.releaseId)
						) {
							releaseIds.push(uploadResult.releaseId);
							const configDocName =
								currentView === "activity"
									? "activity_folders"
									: "darshan_folders";
							const currentConfigDoc = await getDocFromServer(
								doc(db, "app_config", configDocName),
							);
							const currentVisibleIds = currentConfigDoc.exists()
								? currentConfigDoc.data().visibleIds || []
								: [];
							const newVisibleIds = Array.from(
								new Set([...currentVisibleIds, uploadResult.releaseId]),
							);
							await setDoc(
								doc(db, "app_config", configDocName),
								{ visibleIds: newVisibleIds },
								{ merge: true },
							);
						}
					} else {
						const docId = getISTDocId();
						await setDoc(doc(db, "approvals", docId), {
							mandalId: selectedMandalId,
							mandalName,
							type: "gallery_item",
							data: item,
							status: "pending",
							requestedBy: email,
							timestamp: Date.now(),
						});
					}

					uploadedItems.push(item);
					if (
						uploadResult.releaseId &&
						!releaseIds.includes(uploadResult.releaseId)
					) {
						releaseIds.push(uploadResult.releaseId);
					}
				} catch (itemError: any) {
					hasError = true;
					console.error(`Failed to upload file ${f.displayName}:`, itemError);
					showToast(
						`Failed to upload "${f.displayName}": ${itemError.message}`,
						"error",
					);
				} finally {
					completedCount++;
					setUploadProgress(
						Math.round((completedCount / selectedFiles.length) * 100),
					);
				}
			});

			// Wait for all concurrent uploads to finish
			await Promise.all(uploadPromises);

			if (uploadedItems.length > 0 && !hasError) {
				showToast(
					`All ${uploadedItems.length} photo${uploadedItems.length > 1 ? "s" : ""} uploaded successfully!`,
				);
			} else if (uploadedItems.length > 0 && hasError) {
				showToast(
					`${uploadedItems.length} of ${selectedFiles.length} photos uploaded. Some failed.`,
					"error",
				);
			} else if (!hasError) {
				showToast(
					autoApprove || isSuperAdmin
						? "Saved successfully!"
						: "Requests sent for approval to Super Admin.",
				);
			}

			// ── Schedule push notification (deferred, with CDN delay + timing window) ──
			if (uploadedItems.length > 0 && (autoApprove || isSuperAdmin)) {
				try {
					const notifType = currentView as "darshan" | "activity";
					const firstImageUrl = uploadedItems[0]?.url;
					const uploadDate =
						uploadedItems[0]?.date || new Date().toISOString().split("T")[0];
					await scheduleMandalNotification({
						mandalId: selectedMandalId,
						mandalName,
						type: notifType,
						uploadDate,
						imageUrl: firstImageUrl,
					});
				} catch (notifErr) {
					// Don't surface notification scheduling errors to the user
					console.error(
						"[MandalManager] Failed to schedule upload notification:",
						notifErr,
					);
				}
			}

			fetchMandalData({ silent: true });
			selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
			setSelectedFiles([]);
		} catch (e: any) {
			showToast(`Upload failed: ${e.message}`, "error");
		}
		setUploading(false);
		setUploadProgress(0);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: showToast is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (uploading) {
				const msg = "Uploads are in progress. Are you sure you want to leave?";
				e.preventDefault();
				e.returnValue = msg;
				return msg;
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [uploading]);

	// Hardware back: a section (Darshan, Activities, Timings, Devotees) returns
	// to this mandal's menu instead of closing the whole Mandal Manager, and back
	// is held while photos upload. (A video upload's UploadBlockerModal holds
	// back itself, with its own cancel flow.)
	useAdminBack(currentView !== "menu", () => setCurrentView("menu"));
	useAdminBack(
		uploading,
		() =>
			showToast(
				"Uploads are currently in progress. Please wait for them to finish before navigating back.",
				"error",
			),
		{ blocking: true },
	);

	const handleDeleteGalleryItem = (item: GalleryItem) => {
		setConfirmDialog({
			message: `Delete "${item.displayName}"?`,
			onConfirm: async () => {
				const key = String(item.id);
				setDeletingItemIds((prev) => new Set(prev).add(key));
				try {
					await submitRequest("delete_gallery_item", item);
					// Soft delete from B2
					if (item.url?.includes("videos.chaitanyaprembhakti.org")) {
						try {
							await softDeleteFromB2(item.url);
						} catch (e) {
							console.error("Failed to soft delete from B2:", e);
						}
					}
				} catch (e: any) {
					showToast(
						`Failed to delete${e?.message ? `: ${e.message}` : "."}`,
						"error",
					);
				}
				setDeletingItemIds((prev) => {
					const next = new Set(prev);
					next.delete(key);
					return next;
				});
			},
		});
	};

	const handleSaveGalleryEdit = async (updatedItem: GalleryItem) => {
		try {
			await submitRequest("edit_gallery_item", updatedItem);
			closeEditingGalleryItem();
		} catch (_e) {
			showToast("Failed to update item.", "error");
		}
	};

	const hasAccess = (folderId: string) => {
		if (isSuperAdmin) return true;
		if (!permissions || permissions.length === 0) return true;
		return permissions.includes(folderId);
	};

	const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !selectedMandalId) return;

		let currentVideoId = editingVideo?.id;
		if (!currentVideoId) {
			currentVideoId = `mv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
			const mandalRef = doc(db, "mandals", selectedMandalId);
			const existingVideos = mandalData?.videos || [];
			const newVideo: MandalVideo = {
				id: currentVideoId,
				title: videoForm.title.trim() || file.name,
				url: "Processing...",
				date: videoForm.date || new Date().toISOString().split("T")[0],
				thumbnailUrl: videoForm.thumbnailUrl || "",
				useDefaultThumbnail: true,
				description: videoForm.description || "",
				order: existingVideos.length,
			};
			await setDoc(
				mandalRef,
				{ videos: [...existingVideos, newVideo] },
				{ merge: true },
			);
			setEditingVideo(newVideo);
			setVideoForm((prev) => ({ ...prev, url: "Processing..." }));
			fetchMandalData({ silent: true });
		} else {
			setVideoForm((prev) => ({ ...prev, url: "Processing..." }));
		}

		// Create abort controller for this upload so cancel button can stop it
		const controller = new AbortController();
		uploadAbortControllerRef.current = controller;
		uploadingVideoIdRef.current = currentVideoId;

		setUploadingVideo(true);
		setUploadVideoProgress(0);
		setUploadingFileName(file.name);

		try {
			const mandalName =
				allMandals.find((m) => m.id === selectedMandalId)?.name ||
				selectedMandalId;
			const uploadDate =
				videoForm.date || new Date().toISOString().split("T")[0];
			const folderPath = `Uploaded from app/Mandal Uploads/${mandalName}/${uploadDate}/`;

			const dlUrl = await uploadFileToB2(
				file,
				(progress) => {
					setUploadVideoProgress(progress);
				},
				folderPath,
				controller.signal,
			);
			const mandalRef = doc(db, "mandals", selectedMandalId);
			// Read FRESH — avoid stale cache overwriting concurrent video changes
			const snap = await getDocFromServer(mandalRef);
			if (snap.exists()) {
				const data = snap.data();
				const updatedVideos = (data.videos || []).map((v: any) =>
					v.id === currentVideoId ? { ...v, url: dlUrl } : v,
				);
				await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
			}
			showToast("Video uploaded successfully to B2!", "success");
			setUploadingVideo(false);
			setUploadingFileName("");
			setVideoForm((prev) => ({ ...prev, url: dlUrl }));
			setEditingVideo((prev) => (prev ? { ...prev, url: dlUrl } : null));
			fetchMandalData({ silent: true });
		} catch (error: any) {
			if (error?.name !== "AbortError") {
				showToast(`Video upload failed: ${error.message}`, "error");
			}
			setUploadingVideo(false);
			setUploadingFileName("");
			setEditingVideo((prev) => (prev ? { ...prev, url: "" } : null));
		}
		uploadAbortControllerRef.current = null;
		uploadingVideoIdRef.current = null;
		if (videoInputRef.current) videoInputRef.current.value = "";
	};

	const handleBulkVideoUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(e.target.files || []);
		if (files.length === 0 || !selectedMandalId) return;

		const queue: {
			task: BulkUploadTask;
			file: File;
			targetFileName: string;
		}[] = [];
		const newTasks: BulkUploadTask[] = [];
		const mandalRef = doc(db, "mandals", selectedMandalId);
		const existingVideos = mandalData?.videos || [];
		const newVideosToSave: MandalVideo[] = [];

		for (const file of files) {
			const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
			const targetFileName = `${Date.now()}_${safeFileName}`;
			const videoId = `mv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

			newVideosToSave.push({
				id: videoId,
				title: file.name.replace(/\.[^/.]+$/, ""),
				url: "Processing...",
				date: new Date().toISOString().split("T")[0],
				thumbnailUrl: "",
				useDefaultThumbnail: true,
				order: existingVideos.length + newVideosToSave.length,
			});

			const task: BulkUploadTask = {
				id: videoId,
				name: file.name,
				progress: 0,
				status: "pending",
			};
			newTasks.push(task);
			queue.push({ task, file, targetFileName });
		}

		if (newVideosToSave.length > 0) {
			await setDoc(
				mandalRef,
				{ videos: [...existingVideos, ...newVideosToSave] },
				{ merge: true },
			);
			fetchMandalData({ silent: true });
		}

		setBulkUploadTasks((prev) => [...prev, ...newTasks]);

		// Create a shared abort controller for the bulk session
		const controller = new AbortController();
		uploadAbortControllerRef.current = controller;
		setUploadingVideo(true);
		setUploadVideoProgress(0);

		for (const item of queue) {
			if (controller.signal.aborted) break;

			setUploadingFileName(item.file.name);
			uploadingVideoIdRef.current = item.task.id;
			setBulkUploadTasks((prev) =>
				prev.map((t) =>
					t.id === item.task.id ? { ...t, status: "uploading" } : t,
				),
			);
			try {
				const mandalName =
					allMandals.find((m) => m.id === selectedMandalId)?.name ||
					selectedMandalId;
				const uploadDate = new Date().toISOString().split("T")[0];
				const folderPath = `Uploaded from app/mandal upload folder/${mandalName}/${uploadDate}/`;

				const dlUrl = await uploadFileToB2(
					item.file,
					(progress) => {
						setUploadVideoProgress(progress);
						setBulkUploadTasks((prev) =>
							prev.map((t) => (t.id === item.task.id ? { ...t, progress } : t)),
						);
					},
					folderPath,
					controller.signal,
				);
				const mandalRef = doc(db, "mandals", selectedMandalId);
				// Read FRESH from server to avoid overwriting concurrent changes
				const snap = await getDocFromServer(mandalRef);
				if (snap.exists()) {
					const data = snap.data();
					const updatedVideos = (data.videos || []).map((v: any) =>
						v.id === item.task.id ? { ...v, url: dlUrl } : v,
					);
					await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
				}
				setBulkUploadTasks((prev) =>
					prev.map((t) =>
						t.id === item.task.id
							? { ...t, status: "completed", progress: 100 }
							: t,
					),
				);
				fetchMandalData({ silent: true });
			} catch (error: any) {
				if (error?.name === "AbortError") break;
				setBulkUploadTasks((prev) =>
					prev.map((t) =>
						t.id === item.task.id
							? { ...t, status: "error", error: error.message }
							: t,
					),
				);
			}
		}
		setUploadingVideo(false);
		setUploadingFileName("");
		uploadAbortControllerRef.current = null;
		if (bulkVideoInputRef.current) bulkVideoInputRef.current.value = "";
	};

	/**
	 * Called when admin confirms Cancel in the upload blocker.
	 * Aborts in-flight XHR and resets the Firestore video URL to "" (Option B).
	 */
	const handleCancelUpload = async () => {
		uploadAbortControllerRef.current?.abort();
		setUploadingVideo(false);
		setUploadVideoProgress(0);
		setUploadingFileName("");

		// Reset the current file's URL plus any other bulk-queued files that
		// never got a chance to start — otherwise those stay as "Processing..."
		// forever.
		const videoId = uploadingVideoIdRef.current;
		const cleanupIds = new Set<string>();
		if (videoId) cleanupIds.add(videoId);
		for (const t of bulkUploadTasks) {
			if (t.status === "pending" || t.status === "uploading") {
				cleanupIds.add(t.id);
			}
		}
		if (cleanupIds.size > 0 && selectedMandalId) {
			try {
				const mandalRef = doc(db, "mandals", selectedMandalId);
				const snap = await getDocFromServer(mandalRef);
				if (snap.exists()) {
					const updatedVideos = (snap.data().videos || []).map((v: any) =>
						cleanupIds.has(v.id) ? { ...v, url: "" } : v,
					);
					await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
				}
			} catch (_e) {
				// Best-effort
			}
		}
		uploadingVideoIdRef.current = null;
	};

	const handleSaveVideo = async () => {
		if (!videoForm.title.trim()) {
			showToast("Please enter a video title.", "error");
			return;
		}
		if (!videoForm.url.trim()) {
			showToast("Please enter a video URL.", "error");
			return;
		}
		if (!videoForm.date) {
			showToast("Please select a date.", "error");
			return;
		}
		setSavingVideo(true);
		try {
			const mandalRef = doc(db, "mandals", selectedMandalId);
			// Read FRESH from server to avoid stale video list
			const mandalDoc = await getDocFromServer(mandalRef);
			const existingVideos: MandalVideo[] = mandalDoc.exists()
				? mandalDoc.data().videos || []
				: [];
			let updatedVideos: MandalVideo[];
			if (editingVideo) {
				updatedVideos = existingVideos.map((v) =>
					v.id === editingVideo.id
						? { ...v, ...videoForm, id: editingVideo.id }
						: v,
				);
			} else {
				const newVideo: MandalVideo = {
					id: `mv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
					title: videoForm.title.trim(),
					url: videoForm.url.trim(),
					date: videoForm.date,
					thumbnailUrl: videoForm.thumbnailUrl.trim() || "",
					thumbnailXOffset: videoForm.thumbnailXOffset || 50,
					thumbnailYOffset: videoForm.thumbnailYOffset || 50,
					useDefaultThumbnail: videoForm.useDefaultThumbnail || false,
					order: existingVideos.length,
				};
				updatedVideos = [...existingVideos, newVideo];
			}
			await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
			showToast(editingVideo ? "Video updated!" : "Video added!");
			setVideoForm({
				title: "",
				url: "",
				date: new Date().toISOString().split("T")[0],
				thumbnailUrl: "",
				thumbnailXOffset: 50,
				thumbnailYOffset: 50,
				useDefaultThumbnail: false,
			});
			setEditingVideo(null);
			closeVideoForm();
			fetchMandalData({ silent: true });
		} catch (e: any) {
			showToast(`Failed to save video: ${e.message}`, "error");
		}
		setSavingVideo(false);
	};

	const handleDeleteVideo = (video: MandalVideo) => {
		setConfirmDialog({
			message: `Delete video "${video.title}"?`,
			onConfirm: async () => {
				setDeletingVideoId(video.id);
				try {
					const mandalRef = doc(db, "mandals", selectedMandalId);
					// Read FRESH from server to avoid stale cache
					const mandalDoc = await getDocFromServer(mandalRef);
					const existingVideos: MandalVideo[] = mandalDoc.exists()
						? mandalDoc.data().videos || []
						: [];
					await setDoc(
						mandalRef,
						{ videos: existingVideos.filter((v) => v.id !== video.id) },
						{ merge: true },
					);

					// Soft delete from B2
					if (video.url) {
						try {
							await softDeleteFromB2(video.url);
						} catch (e) {
							console.error("Failed to soft delete from B2:", e);
						}
					}

					showToast("Video deleted.");
					fetchMandalData({ silent: true });
				} catch (_e) {
					showToast("Failed to delete video.", "error");
				}
				setDeletingVideoId(null);
			},
		});
	};

	// Compute gallery items
	const currentGallery = (mandalData?.gallery || []).filter(
		(i) => i.type === (currentView as string),
	);
	const sortedGallery = [...currentGallery].sort((a, b) => {
		const dateDiff =
			new Date(formatForDateInput(b.date)).getTime() -
			new Date(formatForDateInput(a.date)).getTime();
		if (dateDiff !== 0) return dateDiff;
		return a.order - b.order;
	});
	const groupedGallery: Record<string, GalleryItem[]> = {};
	sortedGallery.forEach((item) => {
		const match = item.displayName.match(/^\[(.*?)\]/);
		let actualDate = item.date;
		if (match?.[1]) {
			actualDate = match[1];
		}

		if (!groupedGallery[actualDate]) groupedGallery[actualDate] = [];
		groupedGallery[actualDate].push(item);
	});

	// Ensure dates with only videos also appear in the date selector
	if (currentView === "activity") {
		(mandalData?.videos || []).forEach((v) => {
			if (v.date && !groupedGallery[v.date]) {
				groupedGallery[v.date] = [];
			}
		});
	}

	const availableDates = Object.keys(groupedGallery).sort(
		(a, b) => new Date(b).getTime() - new Date(a).getTime(),
	);
	// Deleting the last photo of the selected date removes that date; fall back to
	// the newest one instead of an empty "Select a date" grid with nothing selected.
	const activeDate =
		previewSelectedDate && availableDates.includes(previewSelectedDate)
			? previewSelectedDate
			: availableDates.length > 0
				? availableDates[0]
				: null;

	const formatDisplayDate = (date: string) => {
		try {
			const d = new Date(date);
			if (!Number.isNaN(d.getTime()))
				return d.toLocaleDateString("en-US", {
					day: "numeric",
					month: "short",
				});
		} catch (_e) {}
		return date;
	};

	const menuItems = [
		{
			id: "activity",
			icon: Calendar,
			label: "Weekly Program & Activities",
			color: "text-blue-600",
			bg: "bg-blue-50 dark:bg-blue-900/20",
			border: "border-blue-100 dark:border-blue-800/40",
			accessIds: ["weekly", "activity"],
		},
		{
			id: "darshan",
			icon: Eye,
			label: "Darshan Gallery",
			color: "text-orange-600",
			bg: "bg-orange-50 dark:bg-orange-900/20",
			border: "border-orange-100 dark:border-orange-800/40",
			accessIds: ["darshan"],
		},
		{
			id: "timings",
			icon: Clock,
			label: "Temple Timings",
			color: "text-purple-600",
			bg: "bg-purple-50 dark:bg-purple-900/20",
			border: "border-purple-100 dark:border-purple-800/40",
			accessIds: ["timings"],
		},
		{
			id: "devotees",
			icon: Users,
			label: "Devotee Management (Basic)",
			color: "text-indigo-600",
			bg: "bg-indigo-50 dark:bg-indigo-900/20",
			border: "border-indigo-100 dark:border-indigo-800/40",
			accessIds: ["devotees", "mandal_admin"],
		},
		{
			id: "devotees_advanced",
			icon: Users,
			label: "Devotee Management (Advanced)",
			color: "text-emerald-600",
			bg: "bg-emerald-50 dark:bg-emerald-900/20",
			border: "border-emerald-100 dark:border-emerald-800/40",
			accessIds: ["devotees", "mandal_admin"],
		},
	].filter((item) =>
		item.accessIds.some((aid) => hasAccess(aid) || aid === "mandal_admin"),
	);

	const isGalleryView = currentView === "activity" || currentView === "darshan";

	return (
		<>
			<div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right pb-[calc(5rem+env(safe-area-inset-bottom))]">
				{/* Sticky Header */}
				<div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
					{/* Super Admin Mandal Selector */}
					{isSuperAdmin && (
						<div
							className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700"
							ref={dropdownRef}
						>
							<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase tracking-widest block mb-1">
								Managing Mandal
							</label>
							<div className="relative">
								<button
									onClick={() => setIsMandalDropdownOpen(!isMandalDropdownOpen)}
									className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center"
								>
									<span>
										{allMandals.find((m) => m.id === selectedMandalId)?.name ||
											"Select Mandal"}
									</span>
									<ChevronDown
										size={16}
										className={`transition-transform ${isMandalDropdownOpen ? "rotate-180" : ""}`}
									/>
								</button>

								{isMandalDropdownOpen && (
									<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50 overflow-hidden">
										{[...allMandals].reverse().map((m) => (
											<button
												key={m.id}
												onClick={() => {
													setSelectedMandalId(m.id);
													setCurrentView("menu");
													handleClose_mandal_dropdown();
												}}
												className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${selectedMandalId === m.id ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700"}`}
											>
												{m.name}
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					)}
					{/* Breadcrumb */}
					<div className="flex items-center gap-2 px-4 py-3">
						{currentView !== "menu" ? (
							<button
								onClick={() => setCurrentView("menu")}
								className="flex items-center gap-2 text-slate-500 dark:text-ink-300 hover:text-slate-800 dark:hover:text-white transition-colors"
							>
								<ArrowLeft size={18} />
								<span className="font-medium text-sm">Menu</span>
							</button>
						) : null}
						<span
							className={`font-bold text-base text-slate-800 dark:text-white ${currentView !== "menu" ? "ml-1" : ""}`}
						>
							{currentView === "menu" &&
								(allMandals.find((m) => m.id === selectedMandalId)?.name ||
									"Mandal")}
							{currentView === "activity" && "📅 Weekly Program & Activities"}
							{currentView === "darshan" && "🙏 Darshan Gallery"}
							{currentView === "timings" && "⏰ Temple Timings"}
							{currentView === "devotees" && "👥 Devotee Management"}
							{currentView === "devotees_advanced" &&
								"👥 Advanced Devotee Management"}
						</span>
					</div>
				</div>

				<div className="p-4 space-y-4">
					{/* ── MENU VIEW ── */}
					{currentView === "menu" && (
						<div className="grid grid-cols-2 gap-3">
							{menuItems.map((item) => {
								const Icon = item.icon;
								return (
									<button
										key={item.id}
										onClick={() => setCurrentView(item.id as NavView)}
										className={`bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform`}
									>
										<div
											className={`w-14 h-14 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center`}
										>
											<Icon size={28} />
										</div>
										<span className="font-bold text-slate-700 dark:text-slate-200 text-sm text-center">
											{item.label}
										</span>
									</button>
								);
							})}
						</div>
					)}

					{/* ── LOADING STATE ── */}
					{currentView !== "menu" && loading && (
						<div className="flex justify-center py-16">
							<Loader2 className="animate-spin text-blue-500" size={32} />
						</div>
					)}

					{/* ── WEEKLY PROGRAM FORM (shown at top of Activity view) ── */}
					{currentView === "activity" && !loading && (
						<div className="space-y-3 pb-1">
							<div className="flex items-center gap-2 px-1">
								<Calendar size={16} className="text-blue-500" />
								<h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
									Program Details
								</h4>
							</div>

							{/* Date Scope Selector */}
							<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
									Apply Program To
								</label>
								<select
									className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white"
									value={selectedProgramScope || "global"}
									onChange={(e) => setSelectedProgramScope(e.target.value)}
								>
									<option value="global">
										Global (Default Weekly Program)
									</option>
									{availableDates.map((date) => (
										<option key={date} value={date}>
											Specific Date: {formatDisplayDate(date)}
										</option>
									))}
								</select>
								<p className="text-[10px] text-slate-400 dark:text-ink-400 mt-1.5 ml-1">
									{selectedProgramScope === "global"
										? "This program shows at the top by default."
										: "This program only shows when the user clicks on this specific date."}
								</p>
							</div>

							{selectedProgramScope && (
								<>
									<label className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer mt-4">
										<div
											className={`w-12 h-7 rounded-full transition-colors relative ${weeklyDraft.enabled ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`}
										>
											<div
												className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${weeklyDraft.enabled ? "translate-x-5" : "translate-x-0.5"}`}
											/>
										</div>
										<input
											type="checkbox"
											className="sr-only"
											checked={weeklyDraft.enabled}
											onChange={(e) =>
												setWeeklyDraft({
													...weeklyDraft,
													enabled: e.target.checked,
												})
											}
										/>
										<div>
											<p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
												Enable Program for this Scope
											</p>
											<p className="text-xs text-slate-500 dark:text-ink-300">
												{weeklyDraft.enabled
													? "Visible in app"
													: "Hidden from app"}
											</p>
										</div>
									</label>

									<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
										<div className="p-4 space-y-4">
											{[
												{
													key: "title",
													label: "Program Title",
													placeholder: "e.g., Sunday Special Kirtan",
													type: "text",
												},
												{
													key: "date",
													label: "Display Date & Time",
													placeholder: "e.g., Sunday, 5:00 PM",
													type: "text",
												},
											].map((field) => (
												<div key={field.key}>
													<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
														{field.label}
													</label>
													<input
														type={field.type}
														className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
														placeholder={field.placeholder}
														value={(weeklyDraft as any)[field.key]}
														onChange={(e) =>
															setWeeklyDraft({
																...weeklyDraft,
																[field.key]: e.target.value,
															})
														}
													/>
												</div>
											))}
											<div>
												<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
													Description
												</label>
												<textarea
													className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white h-24 resize-none outline-none focus:ring-2 focus:ring-blue-500"
													placeholder="Details about the program..."
													value={weeklyDraft.description}
													onChange={(e) =>
														setWeeklyDraft({
															...weeklyDraft,
															description: e.target.value,
														})
													}
												/>
											</div>
											<div>
												<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider flex items-center gap-1 mb-1.5">
													<MapPin size={12} /> Google Maps Link
												</label>
												<input
													className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
													placeholder="https://maps.google.com/..."
													value={weeklyDraft.locationUrl}
													onChange={(e) =>
														setWeeklyDraft({
															...weeklyDraft,
															locationUrl: e.target.value,
														})
													}
												/>
											</div>
										</div>
									</div>

									<button
										onClick={handleSaveWeekly}
										disabled={savingWeekly}
										className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm mb-4"
									>
										{savingWeekly ? (
											<Loader2 className="animate-spin" size={18} />
										) : (
											<Save size={18} />
										)}
										{!autoApprove && !isSuperAdmin
											? "Submit for Approval"
											: "Save Program Details"}
									</button>
								</>
							)}

							<div className="flex items-center gap-3 pt-2 pb-2">
								<div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
								<span className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase tracking-wider flex items-center gap-1">
									<ImageIcon size={12} /> Activity Photos
								</span>
								<div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
							</div>

							<div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center mb-2">
								<p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
									Photos are now automatically managed and synced via GitHub
									Activity Folders.
								</p>
							</div>
						</div>
					)}

					{/* ── GALLERY VIEW (ACTIVITY & DARSHAN) ── */}
					{isGalleryView && !loading && (
						<div className="space-y-5">
							{/* Upload Card */}
							<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
								<div className="bg-gradient-to-r from-pink-50 to-orange-50 dark:from-pink-900/20 dark:to-orange-900/20 p-4 border-b border-slate-200 dark:border-slate-700">
									<div className="flex items-center justify-between mb-3">
										<h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
											📤 Upload Photos
										</h4>
										<div className="flex flex-col sm:flex-row items-center gap-2">
											<div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
												<Calendar
													size={13}
													className="text-slate-500 dark:text-ink-300"
												/>
												<input
													type="date"
													className="bg-transparent text-xs font-bold outline-none text-slate-700 dark:text-slate-300"
													value={formatForDateInput(globalDate) || ""}
													onChange={(e) => setGlobalDate(e.target.value)}
												/>
											</div>
											<div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
												<input
													type="text"
													placeholder="Global Name (e.g. Darshan)"
													className="bg-transparent text-xs font-bold outline-none text-slate-700 dark:text-slate-300 w-32 sm:w-40"
													value={globalName}
													onChange={(e) => {
														const newName = e.target.value;
														setGlobalName(newName);
														if (selectedFiles.length > 0 && newName.trim()) {
															const updated = selectedFiles.map((f, i) => ({
																...f,
																displayName: `${newName.trim()} ${i + 1}`,
															}));
															setSelectedFiles(updated);
														}
													}}
												/>
											</div>
										</div>
									</div>
									<input
										ref={fileInputRef as any}
										type="file"
										multiple
										accept="image/*"
										onChange={handleFileSelect}
										className="hidden"
									/>
									<button
										onClick={() => fileInputRef.current?.click()}
										className="w-full border-2 border-dashed border-pink-300 dark:border-pink-700 rounded-xl p-4 flex flex-col items-center gap-2 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors"
									>
										<Plus size={24} />
										<span className="text-sm font-bold">
											Tap to select photos
										</span>
										<span className="text-xs opacity-70">
											JPG, PNG, WEBP supported
										</span>
									</button>
								</div>

								{selectedFiles.length > 0 && (
									<div className="p-4 space-y-3 max-h-72 overflow-y-auto">
										<p className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider">
											{selectedFiles.length} file
											{selectedFiles.length > 1 ? "s" : ""} selected
										</p>
										{selectedFiles.map((f, index) => (
											<div
												key={f.id}
												className="flex gap-3 items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
											>
												<div className="flex flex-col gap-1 shrink-0">
													<button
														disabled={index === 0}
														onClick={() => {
															const n = [...selectedFiles];
															[n[index], n[index - 1]] = [
																n[index - 1],
																n[index],
															];
															n.forEach((f, i) => (f.order = i + 1));
															setSelectedFiles(n);
														}}
														className="p-1 bg-slate-200 dark:bg-slate-700 rounded disabled:opacity-30 active:scale-90"
													>
														<ChevronUp size={14} />
													</button>
													<span className="text-center text-[10px] font-bold text-slate-500 dark:text-ink-300">
														{index + 1}
													</span>
													<button
														disabled={index === selectedFiles.length - 1}
														onClick={() => {
															const n = [...selectedFiles];
															[n[index], n[index + 1]] = [
																n[index + 1],
																n[index],
															];
															n.forEach((f, i) => (f.order = i + 1));
															setSelectedFiles(n);
														}}
														className="p-1 bg-slate-200 dark:bg-slate-700 rounded disabled:opacity-30 active:scale-90"
													>
														<ChevronDown size={14} />
													</button>
												</div>
												<img
													src={f.previewUrl}
													alt="preview"
													className="w-14 h-14 object-cover rounded-lg shrink-0"
												/>
												<div className="flex-1 min-w-0 space-y-1.5">
													<input
														className="w-full p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-white outline-none"
														placeholder="Display name"
														value={f.displayName}
														onChange={(e) => {
															const n = [...selectedFiles];
															n[index].displayName = e.target.value;
															setSelectedFiles(n);
														}}
													/>
													<input
														type="date"
														className="w-full p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-white outline-none"
														value={formatForDateInput(f.date) || ""}
														onChange={(e) => {
															const n = [...selectedFiles];
															n[index].date = e.target.value;
															setSelectedFiles(n);
														}}
													/>
												</div>
												<button
													onClick={() => {
														URL.revokeObjectURL(f.previewUrl);
														const n = selectedFiles.filter(
															(_, i) => i !== index,
														);
														n.forEach((f, i) => (f.order = i + 1));
														setSelectedFiles(n);
													}}
													className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0 active:scale-90"
												>
													<Trash2 size={16} />
												</button>
											</div>
										))}
									</div>
								)}

								{selectedFiles.length > 0 && (
									<div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
										{uploading && (
											<div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
												<div
													className="bg-pink-600 h-2.5 rounded-full transition-all duration-300"
													style={{ width: `${uploadProgress}%` }}
												/>
											</div>
										)}
										<button
											onClick={handleUploadGallery}
											disabled={uploading}
											className="w-full bg-pink-600 hover:bg-pink-700 active:scale-95 text-white px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm mb-4"
										>
											{uploading ? (
												<Loader2 className="animate-spin" size={18} />
											) : (
												<Upload size={18} />
											)}
											{uploading
												? `Uploading... ${uploadProgress}%`
												: !autoApprove && !isSuperAdmin
													? `Submit ${selectedFiles.length} for Approval`
													: `Upload ${selectedFiles.length} Photo${selectedFiles.length > 1 ? "s" : ""}`}
										</button>
									</div>
								)}
							</div>

							{/* Gallery Preview */}
							<div>
								<div className="flex items-center justify-between mb-3">
									<h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
										{currentView === "activity" ? "📸" : "🙏"} Current Photos{" "}
										<span className="font-normal text-slate-400 dark:text-ink-400">
											({currentGallery.length})
										</span>
									</h4>
								</div>

								{availableDates.length === 0 ? (
									<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center gap-3 text-slate-400 dark:text-ink-400">
										<ImageIcon size={40} className="opacity-40" />
										<p className="text-sm font-medium">
											No photos uploaded yet
										</p>
										<p className="text-xs opacity-70">
											Use the upload section above to add photos
										</p>
									</div>
								) : (
									<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6">
										{/* Story-style Date Selector */}
										<div className="flex overflow-x-auto gap-3 p-4 pb-3 border-b border-slate-100 dark:border-slate-700 scrollbar-hide">
											{availableDates.map((date) => {
												const isSelected = activeDate === date;
												const firstImage = groupedGallery[date][0]?.url;
												return (
													<button
														key={date}
														onClick={() => setPreviewSelectedDate(date)}
														className="flex flex-col items-center gap-1.5 min-w-[60px] outline-none"
													>
														<div
															className={`w-14 h-14 rounded-full p-[2.5px] ${isSelected ? "bg-gradient-to-tr from-pink-500 to-orange-400" : "bg-slate-200 dark:bg-slate-700"}`}
														>
															<div className="w-full h-full rounded-full border-2 border-white dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-700">
																{firstImage ? (
																	<img
																		src={firstImage}
																		alt={date}
																		className="w-full h-full object-cover"
																		loading="lazy"
																	/>
																) : (
																	<div className="w-full h-full flex items-center justify-center">
																		{groupedGallery[date].length === 0 ? (
																			<Video
																				size={18}
																				className="text-slate-400 dark:text-ink-400"
																			/>
																		) : (
																			<ImageIcon
																				size={18}
																				className="text-slate-400 dark:text-ink-400"
																			/>
																		)}
																	</div>
																)}
															</div>
														</div>
														<span
															className={`text-[10px] font-bold ${isSelected ? "text-pink-600 dark:text-pink-400" : "text-slate-500 dark:text-slate-400"}`}
														>
															{formatDisplayDate(date)}
														</span>
														{isSelected && (
															<span className="text-[9px] text-slate-400 dark:text-ink-400 -mt-1">
																{groupedGallery[date].length > 0
																	? `${groupedGallery[date].length} photos`
																	: "Video"}
															</span>
														)}
													</button>
												);
											})}
										</div>

										{/* ── ACTIVITY VIDEOS (Right below date selector) ── */}
										{currentView === "activity" && (
											<div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
												<div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
													<h4 className="font-bold text-sm text-rose-500 flex items-center gap-1.5">
														<Video size={14} /> Activity Videos
													</h4>
													<div className="flex gap-2">
														<button
															onClick={() => {
																setEditingVideo(null);
																setVideoForm({
																	title: "",
																	url: "",
																	date:
																		activeDate ||
																		new Date().toISOString().split("T")[0],
																	thumbnailUrl: "",
																});
																setVideoFormOpen(true);
															}}
															className="flex items-center gap-1 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-md text-xs font-bold active:scale-95 transition-transform"
														>
															<Plus size={12} /> Add Video
														</button>
														<input
															type="file"
															ref={bulkVideoInputRef}
															onChange={handleBulkVideoUpload}
															accept="video/mp4,video/mkv,video/avi"
															multiple
															className="hidden"
														/>
														<button
															onClick={() => bulkVideoInputRef.current?.click()}
															className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md text-xs font-bold active:scale-95 transition-transform"
														>
															<Upload size={12} /> Bulk Upload
														</button>
													</div>
												</div>

												{bulkUploadTasks.length > 0 && (
													<div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-3 m-3 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
														<div className="flex items-center justify-between">
															<h4 className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
																Bulk Uploads (
																{
																	bulkUploadTasks.filter(
																		(t) => t.status === "completed",
																	).length
																}
																/{bulkUploadTasks.length})
															</h4>
															<button
																onClick={() =>
																	setBulkUploadTasks((prev) =>
																		prev.filter(
																			(t) =>
																				t.status !== "completed" &&
																				t.status !== "error",
																		),
																	)
																}
																className="text-[10px] text-slate-500 dark:text-ink-300 hover:underline"
															>
																Clear Finished
															</button>
														</div>
														<div className="max-h-32 overflow-y-auto space-y-1.5 custom-scrollbar">
															{bulkUploadTasks.map((task) => (
																<div
																	key={task.id}
																	className="bg-slate-50 dark:bg-slate-900 rounded p-2 flex items-center justify-between gap-2 border border-slate-100 dark:border-slate-800"
																>
																	<span className="text-[10px] font-bold truncate flex-1">
																		{task.name}
																	</span>
																	<div className="flex items-center gap-2 w-24">
																		<div className="flex-1 h-1 bg-slate-200 dark:bg-ink-700 rounded-full">
																			<div
																				className={`h-full rounded-full ${task.status === "completed" ? "bg-emerald-500" : "bg-emerald-400"}`}
																				style={{ width: `${task.progress}%` }}
																			/>
																		</div>
																		<span className="text-[9px] text-slate-500 dark:text-ink-300">
																			{task.progress}%
																		</span>
																	</div>
																</div>
															))}
														</div>
													</div>
												)}

												{/* Video Form (Only visible when adding/editing) */}
												{(editingVideo || videoFormOpen) && (
													<div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
														<div className="space-y-3">
															<div>
																<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1">
																	Video Title
																</label>
																<input
																	type="text"
																	className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400"
																	placeholder="e.g., Bhajan Sandhya 2024"
																	value={videoForm.title}
																	onChange={(e) =>
																		setVideoForm({
																			...videoForm,
																			title: e.target.value,
																		})
																	}
																/>
															</div>
															<div>
																<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1 flex items-center gap-1">
																	<Link size={10} /> Video URL
																</label>
																<div className="flex gap-2">
																	<input
																		type="url"
																		className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400 font-mono"
																		placeholder="YouTube, MP4, Drive link..."
																		value={videoForm.url}
																		onChange={(e) =>
																			setVideoForm({
																				...videoForm,
																				url: normalizeB2Url(e.target.value),
																			})
																		}
																	/>
																	<input
																		type="file"
																		ref={videoInputRef}
																		onChange={handleVideoUpload}
																		accept="video/mp4,video/mkv,video/avi"
																		className="hidden"
																	/>
																	<button
																		onClick={() =>
																			videoInputRef.current?.click()
																		}
																		disabled={uploadingVideo}
																		className="bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 active:scale-95 transition-all text-xs"
																	>
																		{uploadingVideo ? (
																			<Loader2
																				size={14}
																				className="animate-spin"
																			/>
																		) : (
																			<Upload size={14} />
																		)}
																		{uploadingVideo
																			? `${uploadVideoProgress}%`
																			: "Upload"}
																	</button>
																</div>
																{uploadingVideo && (
																	<div className="mt-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
																		<div
																			className="bg-rose-500 h-full rounded-full transition-all duration-300"
																			style={{
																				width: `${uploadVideoProgress}%`,
																			}}
																		/>
																	</div>
																)}
															</div>
															<div className="grid grid-cols-2 gap-2">
																<div>
																	<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1">
																		Date
																	</label>
																	<input
																		type="date"
																		className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400"
																		value={
																			formatForDateInput(videoForm.date) || ""
																		}
																		onChange={(e) =>
																			setVideoForm({
																				...videoForm,
																				date: e.target.value,
																			})
																		}
																	/>
																</div>
																<div>
																	<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1">
																		Thumbnail URL
																	</label>
																	<input
																		type="url"
																		className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400 font-mono"
																		placeholder="https://..."
																		value={videoForm.thumbnailUrl}
																		onChange={(e) =>
																			setVideoForm({
																				...videoForm,
																				thumbnailUrl: e.target.value,
																			})
																		}
																	/>
																	<div className="flex items-center justify-between mt-1 mb-1">
																		<label className="flex items-center gap-2 cursor-pointer">
																			<input
																				type="checkbox"
																				checked={videoForm.useDefaultThumbnail}
																				onChange={(e) =>
																					setVideoForm({
																						...videoForm,
																						useDefaultThumbnail:
																							e.target.checked,
																					})
																				}
																				className="rounded text-rose-500 focus:ring-rose-500 border-slate-300 dark:border-slate-600"
																			/>
																			<span className="text-[10px] font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider">
																				Use original without crop
																			</span>
																		</label>
																	</div>
																	{!videoForm.useDefaultThumbnail && (
																		<div className="flex flex-row gap-2 sm:gap-4 items-center justify-between sm:justify-around bg-slate-50 dark:bg-slate-900 p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-2">
																			<div className="flex flex-col items-center gap-1 shrink-0">
																				<button
																					onClick={() =>
																						setVideoForm((p) => ({
																							...p,
																							thumbnailYOffset: Math.max(
																								0,
																								(p.thumbnailYOffset ?? 50) - 5,
																							),
																						}))
																					}
																					className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
																				>
																					<ChevronUp size={18} />
																				</button>
																				<div className="flex gap-1 items-center">
																					<button
																						onClick={() =>
																							setVideoForm((p) => ({
																								...p,
																								thumbnailXOffset: Math.max(
																									0,
																									(p.thumbnailXOffset ?? 50) -
																										5,
																								),
																							}))
																						}
																						className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
																					>
																						<ChevronLeft size={18} />
																					</button>
																					<div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center shadow-inner">
																						<div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm"></div>
																					</div>
																					<button
																						onClick={() =>
																							setVideoForm((p) => ({
																								...p,
																								thumbnailXOffset: Math.min(
																									100,
																									(p.thumbnailXOffset ?? 50) +
																										5,
																								),
																							}))
																						}
																						className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
																					>
																						<ChevronRight size={18} />
																					</button>
																				</div>
																				<button
																					onClick={() =>
																						setVideoForm((p) => ({
																							...p,
																							thumbnailYOffset: Math.min(
																								100,
																								(p.thumbnailYOffset ?? 50) + 5,
																							),
																						}))
																					}
																					className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
																				>
																					<ChevronDown size={18} />
																				</button>
																			</div>
																			<div className="flex-1 flex justify-center items-center">
																				<div className="w-full max-w-[140px] aspect-[4/3] rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600 shadow-sm relative">
																					{videoForm.thumbnailUrl ? (
																						<img
																							src={videoForm.thumbnailUrl}
																							alt="Preview"
																							className="absolute inset-0 w-full h-full object-cover"
																							style={{
																								objectPosition: `${videoForm.thumbnailXOffset ?? 50}% ${videoForm.thumbnailYOffset ?? 50}%`,
																							}}
																						/>
																					) : (
																						<span className="text-[10px] text-slate-400 dark:text-ink-400 text-center px-2">
																							No Image
																						</span>
																					)}
																				</div>
																			</div>
																		</div>
																	)}
																</div>
															</div>
															<div className="mb-3 pt-2 border-t border-slate-100 dark:border-slate-800">
																<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1">
																	Description (Optional)
																</label>
																<textarea
																	placeholder="Enter video description..."
																	value={videoForm.description || ""}
																	onChange={(e) =>
																		setVideoForm((prev) => ({
																			...prev,
																			description: e.target.value,
																		}))
																	}
																	className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white focus:border-rose-400 outline-none resize-none h-20"
																/>
															</div>
															<div className="flex gap-2 pt-1">
																<button
																	onClick={() => {
																		setEditingVideo(null);
																		setVideoForm({
																			title: "",
																			url: "",
																			date:
																				activeDate ||
																				new Date().toISOString().split("T")[0],
																			thumbnailUrl: "",
																			thumbnailXOffset: 50,
																			thumbnailYOffset: 50,
																			useDefaultThumbnail: false,
																			description: "",
																		});
																		closeVideoForm();
																	}}
																	className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-xs active:scale-95 transition-transform"
																>
																	Cancel
																</button>
																<button
																	onClick={handleSaveVideo}
																	disabled={savingVideo}
																	className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm disabled:opacity-50"
																>
																	{savingVideo ? (
																		<Loader2
																			size={14}
																			className="animate-spin"
																		/>
																	) : (
																		<Save size={14} />
																	)}
																	{editingVideo ? "Update Video" : "Save Video"}
																</button>
															</div>
														</div>
													</div>
												)}

												{/* Videos List (Filtered to activeDate if activeDate exists and videos exist for it, otherwise show all if no date selected) */}
												<div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
													{(() => {
														const videosToShow = (mandalData?.videos || [])
															.filter((v) =>
																activeDate ? v.date === activeDate : true,
															)
															.sort(
																(a, b) =>
																	new Date(
																		formatForDateInput(b.date),
																	).getTime() -
																	new Date(
																		formatForDateInput(a.date),
																	).getTime(),
															);

														if (videosToShow.length === 0) {
															return activeDate ? null : (
																<div className="p-4 text-center text-slate-400 dark:text-ink-400 text-xs">
																	No videos found.
																</div>
															);
														}

														return videosToShow.map((video) => (
															<div
																key={video.id}
																className="flex items-center gap-2 p-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
															>
																<div className="w-10 h-7 rounded overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
																	{video.thumbnailUrl ? (
																		<img
																			src={video.thumbnailUrl}
																			alt="thumb"
																			className="w-full h-full object-cover"
																			style={
																				!(video as any).useDefaultThumbnail
																					? {
																							objectPosition: `${(video as any).thumbnailXOffset ?? 50}% ${(video as any).thumbnailYOffset ?? 50}%`,
																						}
																					: {}
																			}
																		/>
																	) : (
																		<Video
																			size={14}
																			className="text-slate-400 dark:text-ink-400"
																		/>
																	)}
																</div>
																<div className="flex-1 min-w-0">
																	<p className="text-xs font-bold text-slate-800 dark:text-white truncate">
																		{video.title}
																	</p>
																	{!activeDate && (
																		<p className="text-[10px] text-slate-500 dark:text-slate-400">
																			{video.date}
																		</p>
																	)}
																</div>
																<button
																	onClick={() => {
																		setEditingVideo(video);
																		setVideoForm({
																			title: video.title,
																			url: video.url,
																			date: video.date,
																			thumbnailUrl: video.thumbnailUrl || "",
																			thumbnailXOffset:
																				(video as any).thumbnailXOffset ?? 50,
																			thumbnailYOffset:
																				(video as any).thumbnailYOffset ?? 50,
																			useDefaultThumbnail:
																				(video as any).useDefaultThumbnail ??
																				false,
																			description: video.description || "",
																		});
																		setVideoFormOpen(true);
																	}}
																	className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 rounded active:scale-90 shrink-0"
																>
																	<Edit2 size={12} />
																</button>
																<button
																	onClick={() => handleDeleteVideo(video)}
																	disabled={deletingVideoId === video.id}
																	className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded active:scale-90 shrink-0 disabled:opacity-50"
																>
																	{deletingVideoId === video.id ? (
																		<Loader2
																			size={12}
																			className="animate-spin"
																		/>
																	) : (
																		<Trash2 size={12} />
																	)}
																</button>
															</div>
														));
													})()}
												</div>
											</div>
										)}

										{/* Image Grid */}
										<div className="p-3">
											{activeDate && groupedGallery[activeDate] ? (
												<div className="grid grid-cols-2 gap-2">
													{groupedGallery[activeDate].map((item) => (
														<div
															key={item.id}
															className="relative bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
														>
															<img
																src={item.url}
																alt={item.displayName}
																className="w-full aspect-square object-cover"
																loading="lazy"
															/>

															{/* Always-visible title bar */}
															<div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent absolute inset-x-0 bottom-0 p-2 pt-6">
																<p className="text-white text-xs font-bold line-clamp-1">
																	{item.displayName}
																</p>
															</div>

															{/* Action Buttons - top right, always visible */}
															<div className="absolute top-2 right-2 flex gap-1.5">
																<button
																	onClick={() => setEditingGalleryItem(item)}
																	className="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg active:scale-90 transition-all"
																	title="Edit"
																>
																	<Edit2 size={13} />
																</button>
																<button
																	onClick={() => handleDeleteGalleryItem(item)}
																	disabled={deletingItemIds.has(
																		String(item.id),
																	)}
																	className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-60"
																	title="Delete"
																>
																	{deletingItemIds.has(String(item.id)) ? (
																		<Loader2
																			size={13}
																			className="animate-spin"
																		/>
																	) : (
																		<Trash2 size={13} />
																	)}
																</button>
															</div>
														</div>
													))}
												</div>
											) : (
												<p className="text-center text-sm text-slate-400 dark:text-ink-400 py-8">
													Select a date above to view photos
												</p>
											)}
										</div>
									</div>
								)}
							</div>
						</div>
					)}

					{/* ── TEMPLE TIMINGS VIEW ── */}
					{currentView === "timings" && !loading && (
						<div className="space-y-4">
							<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
								<div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
									<h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
										Daily Schedule
									</h4>
									<button
										onClick={() =>
											setTimingsDraft([
												...timingsDraft,
												{
													id: Date.now().toString(),
													eventName: "",
													time: "",
													order: timingsDraft.length,
												},
											])
										}
										className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
									>
										<Plus size={14} /> Add Event
									</button>
								</div>

								{timingsDraft.length === 0 ? (
									<div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm flex flex-col items-center gap-2">
										<Clock size={32} className="opacity-30" />
										<p>No timings added yet</p>
										<p className="text-xs">Tap "Add Event" to start</p>
									</div>
								) : (
									<div className="divide-y divide-slate-100 dark:divide-slate-700">
										{timingsDraft
											.sort((a, b) => a.order - b.order)
											.map((timing, index) => (
												<div
													key={timing.id}
													className="flex items-center gap-3 p-3"
												>
													<div className="flex flex-col gap-0.5 shrink-0">
														<button
															onClick={() => {
																if (index === 0) return;
																const n = [...timingsDraft];
																[n[index].order, n[index - 1].order] = [
																	n[index - 1].order,
																	n[index].order,
																];
																setTimingsDraft(n);
															}}
															disabled={index === 0}
															className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 active:scale-90"
														>
															<ChevronUp size={14} />
														</button>
														<button
															onClick={() => {
																if (index === timingsDraft.length - 1) return;
																const n = [...timingsDraft];
																[n[index].order, n[index + 1].order] = [
																	n[index + 1].order,
																	n[index].order,
																];
																setTimingsDraft(n);
															}}
															disabled={index === timingsDraft.length - 1}
															className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 active:scale-90"
														>
															<ChevronDown size={14} />
														</button>
													</div>
													<div className="flex-1 grid grid-cols-2 gap-2">
														<input
															className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-purple-400 text-slate-700 dark:text-white"
															placeholder="Event name"
															value={timing.eventName}
															onChange={(e) => {
																const n = [...timingsDraft];
																n[index].eventName = e.target.value;
																setTimingsDraft(n);
															}}
														/>
														<input
															className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-purple-400 text-slate-700 dark:text-white"
															placeholder="Time (e.g. 4:30 AM)"
															value={timing.time}
															onChange={(e) => {
																const n = [...timingsDraft];
																n[index].time = e.target.value;
																setTimingsDraft(n);
															}}
														/>
													</div>
													<button
														onClick={() =>
															setTimingsDraft(
																timingsDraft.filter((t) => t.id !== timing.id),
															)
														}
														className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg active:scale-90 transition-all"
													>
														<Trash2 size={16} />
													</button>
												</div>
											))}
									</div>
								)}
							</div>

							<button
								onClick={handleSaveTimings}
								disabled={savingTimings}
								className="w-full bg-purple-600 hover:bg-purple-700 active:scale-95 text-white px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm mb-4"
							>
								{savingTimings ? (
									<Loader2 className="animate-spin" size={18} />
								) : (
									<Save size={18} />
								)}
								{!autoApprove && !isSuperAdmin
									? "Submit for Approval"
									: "Save Timings"}
							</button>
						</div>
					)}

					{/* ── DEVOTEES VIEW ── */}
					{currentView === "devotees" && !loading && (
						<div className="flex-1 -mx-4 -mt-4">
							<MandalAdminPanel
								currentUser={auth.currentUser as any}
								onClose={() => setCurrentView("menu")}
								settingsLanguage="hi"
								overrideMandalId={selectedMandalId}
							/>
						</div>
					)}

					{/* ── ADVANCED DEVOTEES VIEW ── */}
					{currentView === "devotees_advanced" && !loading && (
						<div className="flex-1 -mx-4 -mt-4">
							<DevoteeProfileManager
								settingsLanguage="hi"
								overrideMandalId={selectedMandalId}
							/>
						</div>
					)}
				</div>

				{/* ── EDIT GALLERY ITEM MODAL ── */}
				{editingGalleryItem && (
					<div
						className="fixed inset-0 bg-black/70 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
						onClick={() => closeEditingGalleryItem()}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mt-3 sm:hidden mb-1" />
							<div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
								<h3 className="font-bold text-slate-800 dark:text-white">
									Edit Photo Details
								</h3>
								<button
									onClick={() => closeEditingGalleryItem()}
									className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-ink-300 active:scale-90"
								>
									<X size={18} />
								</button>
							</div>
							<div className="p-4 space-y-4">
								<img
									src={editingGalleryItem.url}
									alt="Preview"
									className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
								/>
								<div>
									<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-1.5">
										Display Name
									</label>
									<input
										type="text"
										value={editingGalleryItem.displayName || ""}
										onChange={(e) =>
											setEditingGalleryItem({
												...editingGalleryItem,
												displayName: e.target.value,
											})
										}
										className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
									/>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-1.5">
											Date
										</label>
										<input
											type="date"
											value={formatForDateInput(editingGalleryItem.date) || ""}
											onChange={(e) =>
												setEditingGalleryItem({
													...editingGalleryItem,
													date: e.target.value,
												})
											}
											className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-1.5">
											Order
										</label>
										<input
											type="number"
											value={editingGalleryItem.order}
											onChange={(e) =>
												setEditingGalleryItem({
													...editingGalleryItem,
													order: parseInt(e.target.value, 10) || 0,
												})
											}
											className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
										/>
									</div>
								</div>
							</div>
							<div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
								<button
									onClick={() => closeEditingGalleryItem()}
									className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
								>
									Cancel
								</button>
								<button
									onClick={() => handleSaveGalleryEdit(editingGalleryItem)}
									className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
								>
									<Save size={16} /> Save Changes
								</button>
							</div>
						</div>
					</div>
				)}

				{/* ── CONFIRM DIALOG ── */}
				{confirmDialog && (
					<div
						className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
						onClick={() => closeConfirmDialog()}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
								<Trash2 size={24} className="text-red-500" />
							</div>
							<h3 className="text-lg font-bold text-slate-800 dark:text-white text-center mb-2">
								Confirm Delete
							</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
								{confirmDialog.message}
							</p>
							<div className="flex gap-3">
								<button
									onClick={() => closeConfirmDialog()}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 active:scale-95 transition-transform"
								>
									Cancel
								</button>
								<button
									onClick={() => {
										confirmDialog.onConfirm();
										closeConfirmDialog();
									}}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white active:scale-95 transition-all shadow-sm"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				)}

				{/* ── TOAST NOTIFICATION ── */}
				{toastMessage && (
					<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] animate-in slide-in-from-bottom-4 duration-200 pointer-events-none">
						<div
							className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[200px] ${toastMessage.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
						>
							{toastMessage.type === "success" ? (
								<CheckCircle size={18} />
							) : (
								<X size={18} />
							)}
							<span className="font-bold text-sm">{toastMessage.text}</span>
						</div>
					</div>
				)}
			</div>

			{/* ── Upload Blocker: locks screen during B2 video uploads ── */}
			<UploadBlockerModal
				isVisible={uploadingVideo}
				progress={uploadVideoProgress}
				fileName={uploadingFileName}
				onCancel={handleCancelUpload}
			/>
		</>
	);
};

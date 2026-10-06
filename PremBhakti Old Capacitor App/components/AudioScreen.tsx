import { Capacitor } from "@capacitor/core";
import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Disc,
	Download,
	History,
	ListMusic,
	Loader2,
	Mic,
	Music,
	Pause,
	Pencil,
	Play,
	PlayCircle,
	Plus,
	Repeat,
	Repeat1,
	RotateCcw,
	RotateCw,
	Search,
	SkipBack,
	SkipForward,
	Trash2,
	User,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAudio } from "../context/AudioContext";
import { useData } from "../context/DataContext";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { useTourUiAction } from "../src/tour/tourBus";
import type {
	Bhajan,
	BhajanAudio,
	LectureData,
	Playlist,
	ScriptType,
} from "../types";
import { isTrackDownloaded } from "../utils/audioStorage";
import { getSingersList, normalizeSingerName } from "../utils/bhajanClassifier";
import { triggerHaptic } from "../utils/haptic";
import {
	addRecentSearch,
	clearRecentSearches,
	getRecentSearches,
} from "../utils/recentSearches";
import { smartNormalize, transliterateForSearch } from "../utils/textProcessor";
import { BackupRestoreSection } from "./BackupRestoreSection";
import { HighlightText } from "./HighlightText";
import { LectureList } from "./LectureList";
import { MiniPlayer } from "./MiniPlayer";
import { VoiceSearchButton } from "./VoiceSearchButton";

interface AudioScreenProps {
	bhajans: Bhajan[];
	onOpenBhajan: (
		bhajan: Bhajan,
		contextQueue?: BhajanAudio[],
		queueName?: string,
	) => void;
	script: ScriptType;
	searchQuery: string;
	rawSearchQuery?: string;
	debouncedQuery?: string;
	onSearchChange?: (query: string) => void;
	playlists: Playlist[];
	onCreatePlaylist: (name: string) => void;
	onDeletePlaylist: (id: string) => void;
	onRemoveFromPlaylist: (playlistId: string, bhajanId: string) => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage: "en" | "hi";
	onSettingsLanguageChange: (lang: "en" | "hi") => void;
	katha: LectureData[];
	kirtan: LectureData[];
	activeDownloads: Record<string, any>;
	onDownloadTrack: (
		track: any,
		title: string,
		category?: "audio" | "lecture",
	) => void;
	onOpenLecture: (
		lecture: LectureData,
		targetTrack?: BhajanAudio,
		contextQueue?: BhajanAudio[],
	) => void;
	isSyncing?: boolean;
	bhajanSyncProgress?: {
		isSyncing?: boolean;
		progress: number;
		detail: string;
		step?: string;
	};
	lectureSyncProgress?: {
		isSyncing?: boolean;
		progress: number;
		detail: string;
		step?: string;
	};
	onRetryKirtanSync?: () => Promise<boolean>;
	onRetryKathaSync?: () => Promise<boolean>;
}

type SubTab = "bhajans" | "kathas" | "singers" | "playlists";

export const AudioScreen: React.FC<AudioScreenProps> = ({
	bhajans,
	onOpenBhajan,
	script,
	searchQuery,
	rawSearchQuery = "",
	debouncedQuery = "",
	onSearchChange,
	playlists,
	onCreatePlaylist,
	onDeletePlaylist,
	onRemoveFromPlaylist,
	scrollBarSide = "left",
	settingsLanguage,
	onSettingsLanguageChange,
	katha,
	kirtan,
	activeDownloads,
	onDownloadTrack,
	onOpenLecture,
	isSyncing,
	bhajanSyncProgress,
	lectureSyncProgress,
	onRetryKirtanSync,
	onRetryKathaSync,
}) => {
	const { showToast } = useToast();
	const {
		queue,
		currentTrack,
		isPlaying,
		isLoading,
		progress,
		duration,
		togglePlay,
		seek,
		playNext,
		playPrevious,
		repeatMode,
		toggleRepeat,
		trackTitle = "महामंत्र हरे कृष्णा",
		trackImage,
		playTrack,
		selectTrack,
	} = useAudio();
	const { renamePlaylist } = useData();
	const { uiScale } = useSettings();

	const baseContainerHeight = 18;
	const scaledContainerHeight = Math.max(baseContainerHeight * uiScale, 14);
	const _headerHeightRem = scaledContainerHeight * 0.25;

	const [subTab, setSubTab] = useState<SubTab>("bhajans");
	const [animDirection, setAnimDirection] = useState<"left" | "right" | "none">(
		"none",
	);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [showRecentSearches, setShowRecentSearches] = useState(false);
	const [recentSearches, setRecentSearches] = useState<string[]>([]);

	useEffect(() => {
		setRecentSearches(getRecentSearches());
	}, []);

	const [_volume, _setVolume] = useState(1);
	const [_isMuted, _setIsMuted] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [dragProgress, setDragProgress] = useState(0);

	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showRenameModal, setShowRenameModal] = useState(false);
	const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);
	const [playlistToRename, setPlaylistToRename] = useState<Playlist | null>(
		null,
	);
	const [newPlaylistName, setNewPlaylistName] = useState("");
	const [renameInputValue, setRenameInputValue] = useState("");
	const [expandedSinger, setExpandedSinger] = useState<string | null>(null);
	const [expandedBhajan, setExpandedBhajan] = useState<string | null>(null);
	const [expandedKatha, setExpandedKatha] = useState<string | null>(null);
	const [viewPlaylistId, setViewPlaylistId] = useState<string | null>(null);
	const [showSingerSelect, setShowSingerSelect] = useState(false);
	const [showQueueModal, setShowQueueModal] = useState(false);
	const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

	// --- SEARCH RESULTS DATA ---
	const searchResults = useMemo(() => {
		if (!searchQuery.trim()) return [];

		const results: BhajanAudio[] = [];

		// Only search in the active tab's category
		if (subTab === "bhajans") {
			// Add Bhajans (Kirtans)
			bhajans.forEach((b) => {
				if (b.audio && b.audio.length > 0) {
					b.audio.forEach((track) => {
						results.push({
							...track,
							bhajanTitle: script === "iast" ? b.titleIAST : b.title,
							parentBhajan: b,
						});
					});
				}
			});
		} else if (subTab === "kathas") {
			// Add Kathas
			katha.forEach((k) => {
				if (k.audio && k.audio.length > 0) {
					k.audio.forEach((track) => {
						results.push({
							...track,
							bhajanTitle: k.title,
							parentBhajan: undefined,
						});
					});
				}
			});
		}

		return results;
	}, [bhajans, katha, searchQuery, script, subTab]);

	// Push history when modals open so back button closes them instead of navigating away
	useEffect(() => {
		if (showQueueModal)
			window.history.pushState({ isPopup: true, view: "queue-modal" }, "");
	}, [showQueueModal]);

	useEffect(() => {
		if (showSingerSelect)
			window.history.pushState({ isPopup: true, view: "singer-select" }, "");
	}, [showSingerSelect]);

	useEffect(() => {
		const handler = (e: PopStateEvent) => {
			const view = e.state?.view;
			if (showQueueModal && view !== "queue-modal") setShowQueueModal(false);
			if (showSingerSelect && view !== "singer-select")
				setShowSingerSelect(false);
		};
		window.addEventListener("popstate", handler);
		return () => window.removeEventListener("popstate", handler);
	}, [showQueueModal, showSingerSelect]);

	const handleCloseQueueModal = () => {
		if (window.history.state?.view === "queue-modal") window.history.back();
		else setShowQueueModal(false);
	};

	const handleCloseSingerSelect = () => {
		if (window.history.state?.view === "singer-select") window.history.back();
		else setShowSingerSelect(false);
	};

	// Back-button support for Create/Rename Playlist modals
	useEffect(() => {
		if (showCreateModal)
			window.history.pushState({ isPopup: true, view: "create-playlist" }, "");
	}, [showCreateModal]);

	useEffect(() => {
		if (showRenameModal)
			window.history.pushState({ isPopup: true, view: "rename-playlist" }, "");
	}, [showRenameModal]);

	useEffect(() => {
		const handler = (e: PopStateEvent) => {
			const view = e.state?.view;
			if (showCreateModal && view !== "create-playlist")
				setShowCreateModal(false);
			if (showRenameModal && view !== "rename-playlist")
				setShowRenameModal(false);
		};
		window.addEventListener("popstate", handler);
		return () => window.removeEventListener("popstate", handler);
	}, [showCreateModal, showRenameModal]);

	const handleCloseCreateModal = () => {
		if (window.history.state?.view === "create-playlist") window.history.back();
		else setShowCreateModal(false);
	};

	const handleCloseRenameModal = () => {
		if (window.history.state?.view === "rename-playlist") window.history.back();
		else setShowRenameModal(false);
	};

	const activeAudioSyncs = [
		bhajanSyncProgress?.isSyncing
			? {
					label: settingsLanguage === "hi" ? "कीर्तन" : "Kirtan",
					progress: bhajanSyncProgress.progress,
					detail: bhajanSyncProgress.detail,
				}
			: null,
		lectureSyncProgress?.isSyncing
			? {
					label: settingsLanguage === "hi" ? "कथा" : "Katha",
					progress: lectureSyncProgress.progress,
					detail: lectureSyncProgress.detail,
				}
			: null,
	].filter(Boolean) as Array<{
		label: string;
		progress: number;
		detail: string;
	}>;
	const failedAudioSyncs = [
		bhajanSyncProgress?.step === "error"
			? {
					label: settingsLanguage === "hi" ? "कीर्तन" : "Kirtan",
					detail: bhajanSyncProgress.detail,
				}
			: null,
		lectureSyncProgress?.step === "error"
			? {
					label: settingsLanguage === "hi" ? "कथा" : "Katha",
					detail: lectureSyncProgress.detail,
				}
			: null,
	].filter(Boolean) as Array<{ label: string; detail: string }>;

	const isAudioSyncing = isSyncing || activeAudioSyncs.length > 0;
	const combinedAudioProgress =
		activeAudioSyncs.length > 0
			? Math.round(
					activeAudioSyncs.reduce((sum, item) => sum + item.progress, 0) /
						activeAudioSyncs.length,
				)
			: 0;

	const isIOSWeb =
		typeof window !== "undefined" &&
		Capacitor.getPlatform() === "web" &&
		(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
			(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

	const t = {
		player: settingsLanguage === "hi" ? "प्लेयर" : "Player",
		list: settingsLanguage === "hi" ? "प्लेलिस्ट" : "Playlists",
		singers: settingsLanguage === "hi" ? "गायक" : "Singers",
		lectures: settingsLanguage === "hi" ? "कथा" : "Katha",
		emptyPlaylist: settingsLanguage === "hi" ? "खाली प्लेलिस्ट" : "Empty Playlist",
		createPlaylist:
			settingsLanguage === "hi" ? "नई प्लेलिस्ट बनाएं" : "Create New Playlist",
		noPlaylists:
			settingsLanguage === "hi" ? "अभी कोई प्लेलिस्ट नहीं है" : "No playlists yet.",
		songs: settingsLanguage === "hi" ? "भजन" : "Songs",
		bhajans: settingsLanguage === "hi" ? "कीर्तन" : "Kirtans",
		kathas: settingsLanguage === "hi" ? "कथा" : "Katha",
		back: settingsLanguage === "hi" ? "वापस" : "Back",
		cancel: settingsLanguage === "hi" ? "रद्द करें" : "Cancel",
		create: settingsLanguage === "hi" ? "बनाएं" : "Create",
		rename: settingsLanguage === "hi" ? "नाम बदलें" : "Rename",
		delete: settingsLanguage === "hi" ? "हटाएं" : "Delete",
		confirm: settingsLanguage === "hi" ? "पुष्टि करें?" : "Confirm?",
		newPlaylistTitle: settingsLanguage === "hi" ? "नई प्लेलिस्ट" : "New Playlist",
		playlistNamePlaceholder:
			settingsLanguage === "hi" ? "प्लेलिस्ट का नाम" : "Playlist Name",
		renamePlaylistTitle:
			settingsLanguage === "hi" ? "प्लेलिस्ट का नाम बदलें" : "Rename Playlist",
		deletePlaylistTitle:
			settingsLanguage === "hi" ? "प्लेलिस्ट हटाएं?" : "Delete Playlist?",
		deletePlaylistDesc:
			settingsLanguage === "hi"
				? "क्या आप वाकई इस प्लेलिस्ट को हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।"
				: "Are you sure you want to delete this playlist? This action cannot be undone.",
		selectSinger: settingsLanguage === "hi" ? "गायक चुनें" : "Select Singer",
		availableAudio:
			settingsLanguage === "hi" ? "उपलब्ध ऑडियो" : "Available Audio",
		unknownSinger: settingsLanguage === "hi" ? "अज्ञात गायक" : "Unknown Singer",
		download: settingsLanguage === "hi" ? "डाउनलोड" : "Download",
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const scrollContainer = document.querySelector(".scroll-container");
		if (scrollContainer) {
			scrollContainer.scrollTo({ top: 0, behavior: "auto" });
		}
	}, [searchQuery]);

	const scrollPositions = useRef<Record<SubTab, number>>({
		bhajans: 0,
		kathas: 0,
		singers: 0,
		playlists: 0,
	});

	const subTabs: SubTab[] = ["bhajans", "kathas", "singers", "playlists"];

	const handleSubTabChange = (tab: SubTab) => {
		if (tab === subTab) return;

		// Save current scroll position
		const scrollContainer = document.querySelector(".scroll-container");
		if (scrollContainer) {
			scrollPositions.current[subTab] = scrollContainer.scrollTop;
		}

		const currentIndex = subTabs.indexOf(subTab);
		const newIndex = subTabs.indexOf(tab);
		setAnimDirection(newIndex > currentIndex ? "right" : "left");
		setSubTab(tab);
	};

	// The guided tour shows the Playlists tab for one step, then comes back.
	useTourUiAction((action) => {
		if (action.type === "audio-subtab") handleSubTabChange(action.tab);
	});

	useEffect(() => {
		// Restore scroll position when subTab changes
		const scrollContainer = document.querySelector(".scroll-container");
		if (scrollContainer) {
			// Use setTimeout to ensure DOM has rendered the new tab content before scrolling
			setTimeout(() => {
				scrollContainer.scrollTo({
					top: scrollPositions.current[subTab],
					behavior: "instant",
				});
			}, 10);
		}
	}, [subTab]);

	const formatTime = (seconds: number) => {
		if (!seconds || Number.isNaN(seconds)) return "00:00";
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value);
		setDragProgress(val);
	};

	const handleSeekEnd = () => {
		setIsDragging(false);
		seek(dragProgress);
	};

	const currentProgress = isDragging ? dragProgress : progress;
	const currentDuration = duration || 1;
	const progressPercent = (currentProgress / currentDuration) * 100;

	// --- SINGERS DATA ---
	const singersList = useMemo(() => getSingersList(bhajans), [bhajans]);
	const filteredSingers = useMemo(() => {
		const queryToUse = debouncedQuery || searchQuery;
		if (!queryToUse) return singersList;
		const normQuery = smartNormalize(
			transliterateForSearch(queryToUse.toLowerCase()),
		);
		return singersList.filter((s) => {
			const normName = smartNormalize(
				transliterateForSearch(s.name.toLowerCase()),
			);
			return normName.includes(normQuery);
		});
	}, [singersList, searchQuery, debouncedQuery]);

	// --- PLAYLIST DATA ---
	const handleCreate = () => {
		if (newPlaylistName.trim()) {
			onCreatePlaylist(newPlaylistName.trim());
			setNewPlaylistName("");
			handleCloseCreateModal();
		}
	};

	const handleRenameClick = (playlist: Playlist) => {
		setPlaylistToRename(playlist);
		setRenameInputValue(playlist.name);
		setShowRenameModal(true);
	};

	const confirmRename = () => {
		if (playlistToRename && renameInputValue.trim()) {
			renamePlaylist(playlistToRename.id, renameInputValue.trim());
			handleCloseRenameModal();
			setPlaylistToRename(null);
		}
	};

	const confirmDelete = () => {
		if (playlistToDelete) {
			onDeletePlaylist(playlistToDelete);
			setPlaylistToDelete(null);
		}
	};

	// Helper to extract digits for numeric sorting
	const extractNum = (str?: string) => {
		if (!str) return 0;
		const match = str.match(/\d+/);
		return match ? parseInt(match[0], 10) : 0;
	};

	// --- BHAJANS WITH AUDIO ---
	// biome-ignore lint/correctness/useExhaustiveDependencies: extractNum is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	const bhajansWithAudio = useMemo(() => {
		return bhajans
			.filter((b) => b.audio && b.audio.length > 0)
			.sort((a, b) => {
				const numA = extractNum(a.songNumber || a.id);
				const numB = extractNum(b.songNumber || b.id);
				return numA - numB;
			});
	}, [bhajans]);

	const filteredBhajansWithAudio = bhajansWithAudio;

	// --- KATHA WITH AUDIO ---
	// biome-ignore lint/correctness/useExhaustiveDependencies: extractNum is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	const allKathas = useMemo(() => {
		return katha
			.filter((k) => k.audio && k.audio.length > 0)
			.sort((a, b) => extractNum(a.id) - extractNum(b.id));
	}, [katha]);

	const filteredKathasWithAudio = allKathas;

	const [renderCount, setRenderCount] = useState(20);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setRenderCount(20);
	}, [searchQuery, debouncedQuery, subTab]);

	useEffect(() => {
		let totalItems = 0;
		if (subTab === "bhajans") totalItems = filteredBhajansWithAudio.length;
		if (subTab === "kathas") totalItems = filteredKathasWithAudio.length;
		if (subTab === "singers") totalItems = filteredSingers.length;

		if (renderCount < totalItems) {
			const timer = setTimeout(() => {
				setRenderCount((prev) => Math.min(prev + 50, totalItems));
			}, 30);
			return () => clearTimeout(timer);
		}
	}, [
		renderCount,
		filteredBhajansWithAudio.length,
		filteredKathasWithAudio.length,
		filteredSingers.length,
		subTab,
	]);

	const _activePlaylist = useMemo(() => {
		if (!viewPlaylistId) return null;
		return playlists.find((p) => p.id === viewPlaylistId);
	}, [playlists, viewPlaylistId]);

	const getPlaylistTracks = (playlist: Playlist) => {
		const tracks: BhajanAudio[] = [];
		playlist.items.forEach((id) => {
			const b = bhajans.find((bh) => bh.id === id);
			if (b?.audio && b.audio.length > 0) {
				const firstTrack = b.audio[0];
				tracks.push({
					...firstTrack,
					bhajanTitle: script === "iast" ? b.titleIAST : b.title,
					parentBhajan: b,
				});
			}
		});
		return tracks;
	};

	const renderListTab = () => {
		return (
			<div className="pb-4 p-2 space-y-2">
				<div dir={scrollBarSide === "left" ? "ltr" : undefined}>
					<BackupRestoreSection settingsLanguage={settingsLanguage} />
					<button
						onClick={() => setShowCreateModal(true)}
						data-tour="audio-create-playlist"
						className="w-full py-4 rounded-xl border-2 border-dashed border-saffron-300 dark:border-slate-600 text-slate-500 dark:text-ink-300 font-bold flex items-center justify-center gap-2 hover:bg-saffron-50 dark:hover:bg-slate-800 hover:text-saffron-600 hover:border-saffron-500 transition-all mb-4"
					>
						<Plus size={20} /> {t.createPlaylist}
					</button>

					<div className="grid grid-cols-1 gap-2 mt-2">
						{playlists.map((playlist, idx) => {
							const isExpanded = viewPlaylistId === playlist.id;
							return (
								<div
									key={playlist.id}
									className={`rounded-2xl transition-all duration-300 border ${isExpanded ? "bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-saffron-200 dark:border-slate-600 shadow-md" : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800"} animate-fade-in-up opacity-0 fill-mode-forwards`}
									style={{ animationDelay: `${(idx % 20) * 40}ms` }}
								>
									<div className="w-full flex items-center justify-between p-3 group">
										<button
											onClick={() =>
												setViewPlaylistId(isExpanded ? null : playlist.id)
											}
											className="flex-1 flex items-center gap-3 text-left"
										>
											<div
												className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${isExpanded ? "bg-saffron-100 dark:bg-slate-700 text-saffron-600 border-saffron-200" : "bg-slate-100 dark:bg-slate-800 text-saffron-500 dark:text-saffron-400 border-transparent group-hover:bg-saffron-50 group-hover:text-saffron-600 dark:group-hover:text-saffron-300"}`}
											>
												<ListMusic size={18} />
											</div>
											<div>
												<div
													className={`font-bold text-sm transition-colors ${isExpanded ? "text-saffron-600" : "text-slate-700 dark:text-slate-200 group-hover:text-saffron-600"}`}
												>
													{playlist.name}
												</div>
												<div className="text-xs text-slate-500 dark:text-ink-300">
													{playlist.items.length} {t.songs}
												</div>
											</div>
										</button>
										<div className="flex items-center gap-1">
											<button
												onClick={(e) => {
													e.stopPropagation();
													handleRenameClick(playlist);
												}}
												className="p-2 text-slate-400 dark:text-ink-400 hover:text-saffron-600 hover:bg-saffron-50 dark:hover:bg-slate-700 rounded-full transition-colors"
											>
												<Pencil size={16} />
											</button>
											<button
												onClick={(e) => {
													e.stopPropagation();
													setPlaylistToDelete(playlist.id);
												}}
												className="p-2 text-slate-400 dark:text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
											>
												<Trash2 size={16} />
											</button>
											<button
												onClick={() =>
													setViewPlaylistId(isExpanded ? null : playlist.id)
												}
												className="p-2"
											>
												{isExpanded ? (
													<ChevronUp className="text-saffron-600" size={18} />
												) : (
													<ChevronDown
														className="text-slate-400 dark:text-ink-400 group-hover:text-saffron-600"
														size={18}
													/>
												)}
											</button>
										</div>
									</div>

									{isExpanded && (
										<div className="px-3 pb-3 pt-0 animate-fade-in">
											{playlist.items.length === 0 ? (
												<div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-ink-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
													<Music className="w-8 h-8 opacity-20 mb-2 text-saffron-500" />
													<p className="text-sm">{t.emptyPlaylist}</p>
												</div>
											) : (
												<ul className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-1.5 space-y-1 border border-slate-100 dark:border-slate-700">
													{playlist.items.map((bhajanId, sIdx) => {
														const b = bhajans.find((bh) => bh.id === bhajanId);
														if (!b) return null;
														return (
															<li
																key={bhajanId}
																className="animate-fade-in-up opacity-0 fill-mode-forwards flex items-center justify-between group/item hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-saffron-200 hover:shadow-sm transition-all pr-2"
																style={{
																	animationDelay: `${Math.min(sIdx, 15) * 30}ms`,
																}}
															>
																<button
																	onClick={() => {
																		const playlistQueue =
																			getPlaylistTracks(playlist);
																		const trackToPlay = playlistQueue.find(
																			(t) => t.parentBhajan?.id === b.id,
																		);
																		if (trackToPlay) {
																			handlePlayTrack(
																				trackToPlay,
																				playlistQueue,
																				playlist.name,
																			);
																		}
																	}}
																	className="flex-1 min-w-0 text-left py-2 px-3 flex items-center gap-3"
																>
																	<PlayCircle
																		size={16}
																		className="text-slate-400 dark:text-ink-400 group-hover/item:text-saffron-600 transition-colors shrink-0"
																	/>
																	<span className="flex-1 min-w-0 text-sm font-medium truncate font-hindi text-slate-700 dark:text-slate-300 group-hover/item:text-saffron-600 transition-colors">
																		{script === "iast" ? b.titleIAST : b.title}
																	</span>
																</button>
																<div className="flex items-center">
																	{(() => {
																		const playlistQueue =
																			getPlaylistTracks(playlist);
																		const trackToPlay = playlistQueue.find(
																			(t) => t.parentBhajan?.id === b.id,
																		);
																		if (!trackToPlay) return null;
																		return (
																			<>
																				{isIOSWeb ? (
																					<a
																						href={trackToPlay.url}
																						target="_blank"
																						rel="noopener noreferrer"
																						className="p-2 transition-colors drop-shadow-md text-blue-500 hover:text-blue-600 flex flex-col items-center justify-center"
																						title="Direct Browser Download (For iOS)"
																					>
																						<Download size={18} />
																						<span className="text-[8px] font-bold uppercase leading-none mt-0.5">
																							iOS DL
																						</span>
																					</a>
																				) : (
																					<button
																						onClick={(e) => {
																							e.stopPropagation();
																							const isDownloaded =
																								isTrackDownloaded(
																									trackToPlay.id,
																								);
																							if (
																								!navigator.onLine &&
																								!isDownloaded
																							) {
																								showToast(
																									"Turn on internet to download.",
																									"error",
																								);
																								return;
																							}
																							onDownloadTrack(
																								trackToPlay,
																								trackToPlay.bhajanTitle ||
																									"Audio Track",
																							);
																						}}
																						disabled={
																							isTrackDownloaded(
																								trackToPlay.id,
																							) ||
																							!!activeDownloads[trackToPlay.id]
																						}
																						className={`p-2 transition-colors drop-shadow-md relative ${isTrackDownloaded(trackToPlay.id) ? "text-green-500 dark:text-green-400" : activeDownloads[trackToPlay.id] ? "text-saffron-500 dark:text-saffron-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}
																						title={t.download}
																					>
																						{activeDownloads[trackToPlay.id] ? (
																							<div className="relative flex items-center justify-center w-[18px] h-[18px]">
																								<span className="text-[10px] font-black text-saffron-600 dark:text-saffron-400">
																									{Math.round(
																										activeDownloads[
																											trackToPlay.id
																										]?.progress || 0,
																									)}
																								</span>
																							</div>
																						) : isTrackDownloaded(
																								trackToPlay.id,
																							) ? (
																							<Check size={18} />
																						) : (
																							<Download size={18} />
																						)}
																					</button>
																				)}
																			</>
																		);
																	})()}
																	<DeleteConfirmButton
																		onConfirm={() =>
																			onRemoveFromPlaylist(playlist.id, b.id)
																		}
																		confirmText={t.confirm}
																	/>
																</div>
															</li>
														);
													})}
												</ul>
											)}
										</div>
									)}
								</div>
							);
						})}
						{playlists.length === 0 && (
							<div className="text-center py-10 text-slate-400 dark:text-ink-400">
								<ListMusic className="w-12 h-12 mx-auto mb-2 opacity-30 text-saffron-500" />
								<p>{t.noPlaylists}</p>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	};

	// --- FULL QUEUE CONSTRUCTION ---
	const fullBhajanQueue = useMemo(() => {
		return filteredBhajansWithAudio.flatMap((b) =>
			(b.audio || []).map((track) => ({
				...track,
				bhajanTitle: script === "iast" ? b.titleIAST : b.title,
				parentBhajan: b,
			})),
		);
	}, [filteredBhajansWithAudio, script]);

	const handlePlayTrack = (
		track: BhajanAudio,
		contextQueue: BhajanAudio[],
		queueName: string,
	) => {
		triggerHaptic("medium");
		playTrack(
			track,
			track.bhajanTitle || "",
			track.parentBhajan,
			"/icon.webp",
			contextQueue,
			queueName,
		);
	};

	const renderBhajansTab = () => {
		if (filteredBhajansWithAudio.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 dark:text-ink-400 animate-fade-in-up">
					<div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5 relative">
						<Music className="w-10 h-10 text-slate-300 dark:text-slate-600" />
						{bhajanSyncProgress?.isSyncing && (
							<div className="absolute inset-0 rounded-full border-2 border-gold-600 border-t-transparent animate-spin" />
						)}
					</div>
					<p className="font-hindi font-bold text-slate-700 dark:text-slate-200 text-lg text-center px-6">
						{bhajanSyncProgress?.isSyncing
							? settingsLanguage === "hi"
								? "कीर्तन लोड हो रहे हैं..."
								: "Loading Kirtans..."
							: settingsLanguage === "hi"
								? "कोई कीर्तन नहीं मिला"
								: "No Kirtans found"}
					</p>
					{searchQuery ? (
						<p className="text-slate-400 dark:text-ink-400 text-sm mt-2 leading-relaxed font-hindi text-center px-6">
							{settingsLanguage === "hi"
								? "कृपया स्पेलिंग सही से टाइप करें।"
								: "Please check the spelling and try typing correctly."}
						</p>
					) : (
						!bhajanSyncProgress?.isSyncing && (
							<button
								onClick={() => {
									void onRetryKirtanSync?.();
								}}
								className="mt-6 rounded-full bg-gold-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-gold-700 transition-colors flex items-center gap-2"
							>
								<Download size={18} />
								{settingsLanguage === "hi" ? "कीर्तन Fetch करें" : "Fetch Kirtans"}
							</button>
						)
					)}
				</div>
			);
		}

		return (
			<div className="pb-4 p-2 space-y-2">
				<div
					className="grid grid-cols-1 xl:grid-cols-2 gap-2"
					dir={scrollBarSide === "left" ? "ltr" : undefined}
				>
					{filteredBhajansWithAudio.slice(0, renderCount).map((bhajan, idx) => {
						const isExpanded = expandedBhajan === bhajan.id;
						return (
							<div
								key={bhajan.id}
								data-tour="audio-item"
								className={`rounded-2xl transition-all duration-300 border ${isExpanded ? "bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-saffron-200 dark:border-slate-600 shadow-md" : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800"} animate-fade-in-up opacity-0 fill-mode-forwards`}
								style={{ animationDelay: `${(idx % 20) * 40}ms` }}
							>
								<button
									onClick={() =>
										setExpandedBhajan(isExpanded ? null : bhajan.id)
									}
									className="w-full flex items-center justify-between p-3 group"
								>
									<div className="flex items-center gap-3">
										<div
											className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${isExpanded ? "bg-saffron-100 dark:bg-slate-700 text-saffron-600 border-saffron-200" : "bg-slate-100 dark:bg-slate-800 text-saffron-500 dark:text-saffron-400 border-transparent group-hover:bg-saffron-50 group-hover:text-saffron-600 dark:group-hover:text-saffron-300"}`}
										>
											<Music size={18} />
										</div>
										<div className="text-left">
											<div
												className={`font-bold text-sm transition-colors ${isExpanded ? "text-saffron-600" : "text-slate-700 dark:text-slate-200 group-hover:text-saffron-600"}`}
											>
												<HighlightText
													text={
														script === "iast" ? bhajan.titleIAST : bhajan.title
													}
													highlight={searchQuery}
												/>
											</div>
											<div className="text-xs text-slate-500 dark:text-ink-300">
												{bhajan.audio?.length || 0} {t.songs}
											</div>
										</div>
									</div>
									{isExpanded ? (
										<ChevronUp className="text-saffron-600" size={18} />
									) : (
										<ChevronDown
											className="text-slate-400 dark:text-ink-400 group-hover:text-saffron-600"
											size={18}
										/>
									)}
								</button>

								{isExpanded && (
									<div className="px-3 pb-3 pt-0 animate-fade-in">
										<ul className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-1.5 space-y-1 border border-slate-100 dark:border-slate-700">
											{bhajan.audio?.map((track, sIdx) => {
												// Find the track in fullBhajanQueue to ensure we pass the correct object with metadata
												const queueTrack = fullBhajanQueue.find(
													(t) => t.id === track.id,
												) || {
													...track,
													bhajanTitle:
														script === "iast" ? bhajan.titleIAST : bhajan.title,
													parentBhajan: bhajan,
												};

												return (
													<li
														key={sIdx}
														className="animate-fade-in-up opacity-0 fill-mode-forwards flex items-center gap-2 pr-2"
														style={{
															animationDelay: `${Math.min(sIdx, 15) * 30}ms`,
														}}
													>
														<button
															onClick={() =>
																handlePlayTrack(
																	queueTrack,
																	fullBhajanQueue,
																	t.bhajans,
																)
															}
															className="flex-1 min-w-0 text-left py-2 px-3 rounded-lg flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-saffron-200 hover:shadow-sm transition-all group/item"
														>
															<PlayCircle
																size={16}
																className="text-slate-400 dark:text-ink-400 group-hover/item:text-saffron-600 transition-colors shrink-0"
															/>
															<span className="flex-1 min-w-0 text-sm font-medium truncate text-slate-700 dark:text-slate-300 group-hover/item:text-saffron-600 transition-colors">
																{track.singer?.replace(/\s+\)/g, ")")}
															</span>
														</button>
														{isIOSWeb ? (
															<a
																href={track.url}
																target="_blank"
																rel="noopener noreferrer"
																className="p-2 transition-colors drop-shadow-md text-blue-500 hover:text-blue-600 flex flex-col items-center justify-center"
																title="Direct Browser Download (For iOS)"
															>
																<Download size={18} />
																<span className="text-[8px] font-bold uppercase leading-none mt-0.5">
																	iOS DL
																</span>
															</a>
														) : (
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	const isDownloaded = isTrackDownloaded(
																		track.id,
																	);
																	if (!navigator.onLine && !isDownloaded) {
																		showToast(
																			"Turn on internet to download.",
																			"error",
																		);
																		return;
																	}
																	onDownloadTrack(
																		queueTrack,
																		queueTrack.bhajanTitle || "Audio Track",
																	);
																}}
																disabled={
																	isTrackDownloaded(track.id) ||
																	!!activeDownloads[track.id]
																}
																className={`p-2 transition-colors drop-shadow-md relative ${isTrackDownloaded(track.id) ? "text-green-500 dark:text-green-400" : activeDownloads[track.id] ? "text-saffron-500 dark:text-saffron-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}
																title={t.download}
															>
																{activeDownloads[track.id] ? (
																	<div className="relative flex items-center justify-center w-[18px] h-[18px]">
																		<span className="text-[10px] font-black text-saffron-600 dark:text-saffron-400">
																			{Math.round(
																				activeDownloads[track.id]?.progress ||
																					0,
																			)}
																		</span>
																	</div>
																) : isTrackDownloaded(track.id) ? (
																	<Check size={18} />
																) : (
																	<Download size={18} />
																)}
															</button>
														)}
													</li>
												);
											})}
										</ul>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	// --- FULL KATHA QUEUE CONSTRUCTION ---
	const fullKathaQueue = useMemo(() => {
		return filteredKathasWithAudio.flatMap((k) =>
			(k.audio || []).map((track) => ({
				...track,
				bhajanTitle: k.title,
				parentBhajan: undefined,
			})),
		);
	}, [filteredKathasWithAudio]);

	const _renderKathasTab = () => {
		return (
			<div className="pb-4 p-2 space-y-2">
				<div
					className="grid grid-cols-1 md:grid-cols-2 gap-2"
					dir={scrollBarSide === "left" ? "ltr" : undefined}
				>
					{filteredKathasWithAudio.slice(0, renderCount).map((k, idx) => {
						const isExpanded = expandedKatha === k.id;
						return (
							<div
								key={k.id}
								className={`rounded-2xl transition-all duration-300 border ${isExpanded ? "bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-saffron-200 dark:border-slate-600 shadow-md" : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800"} animate-fade-in-up opacity-0 fill-mode-forwards`}
								style={{ animationDelay: `${(idx % 20) * 40}ms` }}
							>
								<button
									onClick={() => setExpandedKatha(isExpanded ? null : k.id)}
									className="w-full flex items-center justify-between p-3 group"
								>
									<div className="flex items-center gap-3">
										<div
											className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${isExpanded ? "bg-saffron-100 dark:bg-slate-700 text-saffron-600 border-saffron-200" : "bg-slate-100 dark:bg-slate-800 text-saffron-500 dark:text-saffron-400 border-transparent group-hover:bg-saffron-50 group-hover:text-saffron-600 dark:group-hover:text-saffron-300"}`}
										>
											<Mic size={18} />
										</div>
										<div className="text-left">
											<div
												className={`font-bold text-[13px] leading-snug transition-colors ${isExpanded ? "text-saffron-600" : "text-slate-700 dark:text-slate-200 group-hover:text-saffron-600"}`}
											>
												<HighlightText text={k.title} highlight={searchQuery} />
											</div>
											<div className="text-xs text-slate-500 dark:text-ink-300">
												{k.audio?.length || 0} {t.songs}
											</div>
										</div>
									</div>
									{isExpanded ? (
										<ChevronUp className="text-saffron-600" size={18} />
									) : (
										<ChevronDown
											className="text-slate-400 dark:text-ink-400 group-hover:text-saffron-600"
											size={18}
										/>
									)}
								</button>

								{isExpanded && (
									<div className="px-3 pb-3 pt-0 animate-fade-in">
										<ul className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-1.5 space-y-1 border border-slate-100 dark:border-slate-700">
											{k.audio?.map((track, sIdx) => {
												const queueTrack = fullKathaQueue.find(
													(t) => t.id === track.id,
												) || {
													...track,
													bhajanTitle: k.title,
													parentBhajan: undefined,
												};
												return (
													<li
														key={sIdx}
														className="animate-fade-in-up opacity-0 fill-mode-forwards flex items-center gap-2 pr-2"
														style={{
															animationDelay: `${Math.min(sIdx, 15) * 30}ms`,
														}}
													>
														<button
															onClick={() =>
																handlePlayTrack(
																	queueTrack,
																	fullKathaQueue,
																	t.kathas,
																)
															}
															className="flex-1 min-w-0 text-left py-2 px-3 rounded-lg flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-saffron-200 hover:shadow-sm transition-all group/item"
														>
															<PlayCircle
																size={16}
																className="text-slate-400 dark:text-ink-400 group-hover/item:text-saffron-600 transition-colors shrink-0"
															/>
															<span className="flex-1 min-w-0 text-sm font-medium truncate text-slate-700 dark:text-slate-300 group-hover/item:text-saffron-600 transition-colors">
																{track.singer}
															</span>
														</button>
														{isIOSWeb ? (
															<a
																href={track.url}
																target="_blank"
																rel="noopener noreferrer"
																className="p-2 transition-colors drop-shadow-md text-blue-500 hover:text-blue-600 flex flex-col items-center justify-center"
																title="Direct Browser Download (For iOS)"
															>
																<Download size={18} />
																<span className="text-[8px] font-bold uppercase leading-none mt-0.5">
																	iOS DL
																</span>
															</a>
														) : (
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	const isDownloaded = isTrackDownloaded(
																		track.id,
																	);
																	if (!navigator.onLine && !isDownloaded) {
																		showToast(
																			"Turn on internet to download.",
																			"error",
																		);
																		return;
																	}
																	onDownloadTrack(
																		queueTrack,
																		queueTrack.bhajanTitle || "Audio Track",
																		"lecture",
																	);
																}}
																disabled={
																	isTrackDownloaded(track.id) ||
																	!!activeDownloads[track.id]
																}
																className={`p-2 transition-colors drop-shadow-md relative ${isTrackDownloaded(track.id) ? "text-green-500 dark:text-green-400" : activeDownloads[track.id] ? "text-saffron-500 dark:text-saffron-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}
																title={t.download}
															>
																{activeDownloads[track.id] ? (
																	<div className="relative flex items-center justify-center w-[18px] h-[18px]">
																		<span className="text-[10px] font-black text-saffron-600 dark:text-saffron-400">
																			{Math.round(
																				activeDownloads[track.id]?.progress ||
																					0,
																			)}
																		</span>
																	</div>
																) : isTrackDownloaded(track.id) ? (
																	<Check size={18} />
																) : (
																	<Download size={18} />
																)}
															</button>
														)}
													</li>
												);
											})}
										</ul>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	const renderSingersTab = () => {
		if (filteredSingers.length === 0) {
			return (
				<div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 dark:text-ink-400 animate-fade-in-up">
					<div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5 relative">
						<User className="w-10 h-10 text-slate-300 dark:text-slate-600" />
						{bhajanSyncProgress?.isSyncing && (
							<div className="absolute inset-0 rounded-full border-2 border-gold-600 border-t-transparent animate-spin" />
						)}
					</div>
					<p className="font-hindi font-bold text-slate-700 dark:text-slate-200 text-lg text-center px-6">
						{bhajanSyncProgress?.isSyncing
							? settingsLanguage === "hi"
								? "गायक लोड हो रहे हैं..."
								: "Loading Singers..."
							: settingsLanguage === "hi"
								? "कोई गायक नहीं मिला"
								: "No Singers found"}
					</p>
					{searchQuery ? (
						<p className="text-slate-400 dark:text-ink-400 text-sm mt-2 leading-relaxed font-hindi text-center px-6">
							{settingsLanguage === "hi"
								? "कृपया स्पेलिंग सही से टाइप करें।"
								: "Please check the spelling and try typing correctly."}
						</p>
					) : (
						!bhajanSyncProgress?.isSyncing && (
							<button
								onClick={() => {
									void onRetryKirtanSync?.();
								}}
								className="mt-6 rounded-full bg-gold-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-gold-700 transition-colors flex items-center gap-2"
							>
								<Download size={18} />
								{settingsLanguage === "hi" ? "कीर्तन Fetch करें" : "Fetch Kirtans"}
							</button>
						)
					)}
				</div>
			);
		}

		return (
			<div className="pb-4 p-2 space-y-2">
				<div
					className="grid grid-cols-1 xl:grid-cols-2 gap-2"
					dir={scrollBarSide === "left" ? "ltr" : undefined}
				>
					{filteredSingers.slice(0, renderCount).map((singer, idx) => {
						const isExpanded = expandedSinger === singer.name;
						return (
							<div
								key={idx}
								className={`rounded-2xl transition-all duration-300 border ${isExpanded ? "bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-saffron-200 dark:border-slate-600 shadow-md" : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800"} animate-fade-in-up opacity-0 fill-mode-forwards`}
								style={{ animationDelay: `${(idx % 20) * 40}ms` }}
							>
								<button
									onClick={() =>
										setExpandedSinger(isExpanded ? null : singer.name)
									}
									className="w-full flex items-center justify-between p-3 group"
								>
									<div className="flex items-center gap-3">
										<div
											className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${isExpanded ? "bg-saffron-100 dark:bg-slate-700 text-saffron-600 border-saffron-200" : "bg-slate-100 dark:bg-slate-800 text-saffron-500 dark:text-saffron-400 border-transparent group-hover:bg-saffron-50 group-hover:text-saffron-600 dark:group-hover:text-saffron-300"}`}
										>
											<User size={18} />
										</div>
										<div className="text-left">
											<div
												className={`font-bold text-sm transition-colors ${isExpanded ? "text-saffron-600" : "text-slate-700 dark:text-slate-200 group-hover:text-saffron-600"}`}
											>
												<HighlightText
													text={singer.name}
													highlight={searchQuery}
												/>
											</div>
											<div className="text-xs text-slate-500 dark:text-ink-300">
												{singer.bhajanIds.length} {t.bhajans}
											</div>
										</div>
									</div>
									{isExpanded ? (
										<ChevronUp className="text-saffron-600" size={18} />
									) : (
										<ChevronDown
											className="text-slate-400 dark:text-ink-400 group-hover:text-saffron-600"
											size={18}
										/>
									)}
								</button>

								{isExpanded && (
									<div className="px-3 pb-3 pt-0 animate-fade-in">
										<ul className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-1.5 space-y-1 border border-slate-100 dark:border-slate-700">
											{singer.bhajanIds.map((id, sIdx) => {
												const b = bhajans.find((bh) => bh.id === id);
												if (!b) return null;
												const targetTracks =
													b.audio?.filter(
														(t) =>
															normalizeSingerName(t.singer) === singer.name,
													) || [];
												if (targetTracks.length === 0) return null;

												return (
													<li
														key={id}
														className="animate-fade-in-up opacity-0 fill-mode-forwards flex items-center gap-2 pr-2"
														style={{
															animationDelay: `${Math.min(sIdx, 15) * 30}ms`,
														}}
													>
														<button
															onClick={() => {
																const singerQueue = singer.bhajanIds
																	.map((bid) => {
																		const bh = bhajans.find(
																			(x) => x.id === bid,
																		);
																		if (!bh) return null;
																		const tr = bh.audio?.find(
																			(t) =>
																				normalizeSingerName(t.singer) ===
																				singer.name,
																		);
																		if (!tr) return null;
																		return {
																			...tr,
																			bhajanTitle:
																				script === "iast"
																					? bh.titleIAST
																					: bh.title,
																			parentBhajan: bh,
																		};
																	})
																	.filter((t) => t !== null) as BhajanAudio[];

																const trackToPlay = targetTracks[0];
																if (trackToPlay) {
																	const queueTrack = singerQueue.find(
																		(t) => t.id === trackToPlay.id,
																	) || {
																		...trackToPlay,
																		bhajanTitle:
																			script === "iast" ? b.titleIAST : b.title,
																		parentBhajan: b,
																	};
																	handlePlayTrack(
																		queueTrack,
																		singerQueue,
																		`Singer: ${singer.name}`,
																	);
																}
															}}
															className="flex-1 min-w-0 text-left py-2 px-3 rounded-lg flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-saffron-200 hover:shadow-sm transition-all group/item"
														>
															<PlayCircle
																size={16}
																className="text-slate-400 dark:text-ink-400 group-hover/item:text-saffron-600 transition-colors shrink-0"
															/>
															<span className="flex-1 min-w-0 text-sm font-medium truncate font-hindi text-slate-700 dark:text-slate-300 group-hover/item:text-saffron-600 transition-colors">
																{script === "iast" ? b.titleIAST : b.title}
															</span>
														</button>
														{targetTracks[0] &&
															(isIOSWeb ? (
																<a
																	href={targetTracks[0].url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="p-2 transition-colors drop-shadow-md text-blue-500 hover:text-blue-600 flex flex-col items-center justify-center"
																	title="Direct Browser Download (For iOS)"
																>
																	<Download size={18} />
																	<span className="text-[8px] font-bold uppercase leading-none mt-0.5">
																		iOS DL
																	</span>
																</a>
															) : (
																<button
																	onClick={(e) => {
																		e.stopPropagation();
																		const track = targetTracks[0];
																		const isDownloaded = isTrackDownloaded(
																			track.id,
																		);
																		if (!navigator.onLine && !isDownloaded) {
																			showToast(
																				"Turn on internet to download.",
																				"error",
																			);
																			return;
																		}
																		const queueTrack = {
																			...track,
																			bhajanTitle:
																				script === "iast"
																					? b.titleIAST
																					: b.title,
																			parentBhajan: b,
																		};
																		onDownloadTrack(
																			queueTrack,
																			queueTrack.bhajanTitle || "Audio Track",
																			"audio",
																		);
																	}}
																	disabled={
																		isTrackDownloaded(targetTracks[0].id) ||
																		!!activeDownloads[targetTracks[0].id]
																	}
																	className={`p-2 transition-colors drop-shadow-md relative ${isTrackDownloaded(targetTracks[0].id) ? "text-green-500 dark:text-green-400" : activeDownloads[targetTracks[0].id] ? "text-saffron-500 dark:text-saffron-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}
																	title={t.download}
																>
																	{activeDownloads[targetTracks[0].id] ? (
																		<div className="relative flex items-center justify-center w-[18px] h-[18px]">
																			<span className="text-[10px] font-black text-saffron-600 dark:text-saffron-400">
																				{Math.round(
																					activeDownloads[targetTracks[0].id]
																						?.progress || 0,
																				)}
																			</span>
																		</div>
																	) : isTrackDownloaded(targetTracks[0].id) ? (
																		<Check size={18} />
																	) : (
																		<Download size={18} />
																	)}
																</button>
															))}
													</li>
												);
											})}
										</ul>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	const renderSearchResults = () => {
		return (
			<div className="pt-2 px-3 pb-20 space-y-3">
				{searchResults.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 dark:text-ink-400">
						<div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5">
							<Search className="w-10 h-10 text-slate-300 dark:text-slate-600" />
						</div>
						<p className="font-hindi font-bold text-slate-700 dark:text-slate-200 text-lg text-center px-6">
							{settingsLanguage === "hi"
								? "कोई ऑडियो नहीं मिला"
								: "No Audio Found"}
						</p>
						<p className="text-slate-400 dark:text-ink-400 text-sm mt-2 leading-relaxed font-hindi text-center px-6">
							{settingsLanguage === "hi"
								? "कृपया स्पेलिंग सही से टाइप करें।"
								: "Please check the spelling and try typing correctly."}
						</p>
					</div>
				) : (
					searchResults.slice(0, renderCount).map((track, idx) => (
						<div key={`${track.id}-${idx}`} className="animate-fade-in-up">
							<button
								onClick={() =>
									handlePlayTrack(track, searchResults, "Search Results")
								}
								className="w-full text-left p-4 bg-saffron-50/50 dark:bg-slate-800 rounded-2xl shadow-sm border border-saffron-100 active:scale-[0.98] transition-all duration-200 flex items-center gap-4 group hover:border-saffron-200 hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800/50"
							>
								<div className="w-10 h-10 rounded-full flex items-center justify-center border transition-colors shrink-0 bg-saffron-100 dark:bg-slate-700 text-saffron-600 border-saffron-200 group-hover:bg-saffron-50 group-hover:text-saffron-600 dark:group-hover:text-saffron-300">
									{track.parentBhajan ? <Music size={18} /> : <Mic size={18} />}
								</div>
								<div className="flex-1 min-w-0">
									<h3 className="font-bold text-[13px] leading-snug text-slate-700 dark:text-slate-200 group-hover:text-saffron-600 transition-colors cursor-pointer truncate mb-0.5">
										<HighlightText
											text={track.bhajanTitle || ""}
											highlight={searchQuery}
										/>
									</h3>
									<p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
										<HighlightText
											text={track.singer || ""}
											highlight={searchQuery}
										/>
									</p>
								</div>
								<div className="shrink-0 flex items-center gap-2">
									{isIOSWeb ? (
										<a
											href={track.url}
											target="_blank"
											rel="noopener noreferrer"
											className="p-2 text-blue-500 hover:text-blue-600 flex flex-col items-center justify-center"
											onClick={(e) => e.stopPropagation()}
										>
											<Download size={18} />
											<span className="text-[8px] font-bold uppercase leading-none mt-0.5">
												iOS DL
											</span>
										</a>
									) : (
										<button
											onClick={(e) => {
												e.stopPropagation();
												onDownloadTrack(
													track,
													track.bhajanTitle || "Audio Track",
													track.parentBhajan ? "audio" : "lecture",
												);
											}}
											disabled={
												isTrackDownloaded(track.id) ||
												!!activeDownloads[track.id]
											}
											className={`p-2 ${isTrackDownloaded(track.id) ? "text-green-500" : "text-slate-400 dark:text-ink-400 hover:text-saffron-600"}`}
										>
											{activeDownloads[track.id] ? (
												<div className="relative flex items-center justify-center w-[18px] h-[18px]">
													<span className="text-[10px] font-black text-gold-700">
														{Math.round(
															activeDownloads[track.id]?.progress || 0,
														)}
													</span>
												</div>
											) : isTrackDownloaded(track.id) ? (
												<Check size={18} />
											) : (
												<Download size={18} />
											)}
										</button>
									)}
									<ChevronRight
										className="text-slate-300 group-hover:text-saffron-500"
										size={20}
									/>
								</div>
							</button>
						</div>
					))
				)}
			</div>
		);
	};

	return (
		<div className="flex flex-col min-h-screen bg-transparent font-sans relative">
			{/* Background Pattern */}
			<div
				className="absolute inset-0 opacity-10 pointer-events-none"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
				}}
			></div>

			<div className="relative z-10 w-full flex flex-col">
				{/* Top Navigation: Sub-Tabs */}
				<div
					className="flex bg-ry-cream/90 dark:bg-ink-800/90 backdrop-blur-md border-b border-ry-gold/40 sticky top-0 landscape:!top-0 z-20 items-center overflow-x-auto no-scrollbar landscape:pr-14"
					data-tour="audio-tabs"
				>
					<div className="flex-1 flex w-full">
						<TabButton
							active={subTab === "bhajans"}
							onClick={() => handleSubTabChange("bhajans")}
							label={t.bhajans}
							icon={<Disc size={18} />}
						/>
						<TabButton
							active={subTab === "kathas"}
							onClick={() => handleSubTabChange("kathas")}
							label={t.kathas}
							icon={<Mic size={18} />}
						/>
						<TabButton
							active={subTab === "singers"}
							onClick={() => handleSubTabChange("singers")}
							label={t.singers}
							icon={<User size={18} />}
						/>
						<TabButton
							active={subTab === "playlists"}
							onClick={() => handleSubTabChange("playlists")}
							label={t.list}
							icon={<ListMusic size={18} />}
						/>
					</div>
				</div>
				{/* Syncing Banner */}
				{isAudioSyncing && (
					<div className="mx-4 mt-3 px-3 py-3 bg-saffron-50 dark:bg-slate-800 rounded-xl border border-saffron-100 dark:border-slate-700 shadow-sm text-center">
						<div className="flex items-center gap-3">
							<Loader2
								className="animate-spin text-saffron-500 shrink-0"
								size={16}
							/>
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm font-hindi text-saffron-700 dark:text-saffron-400 font-medium leading-tight text-left">
										{settingsLanguage === "hi"
											? "☁️ ऑडियो बैकग्राउंड में अपडेट हो रहा है"
											: "☁️ Audio is syncing in background"}
									</span>
									<span className="text-xs font-black text-saffron-600 dark:text-saffron-400">
										{combinedAudioProgress}%
									</span>
								</div>
								<div className="mt-1.5 h-1.5 w-full bg-white/70 dark:bg-slate-700 rounded-full overflow-hidden">
									<div
										className="h-full bg-saffron-500 transition-all duration-300"
										style={{ width: `${Math.max(8, combinedAudioProgress)}%` }}
									/>
								</div>
								{activeAudioSyncs.length > 0 && (
									<div className="mt-2 flex flex-wrap gap-2 text-[11px] text-saffron-700 dark:text-saffron-300">
										{activeAudioSyncs.map((item) => (
											<span
												key={item.label}
												className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-700 border border-saffron-100 dark:border-slate-600"
											>
												{item.label} {Math.round(item.progress)}%
											</span>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{failedAudioSyncs.length > 0 && (
					<div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-sm font-bold text-red-700">
									{settingsLanguage === "hi"
										? "ऑडियो सूची लोड करने में दिक्कत आई"
										: "Audio list had trouble loading"}
								</p>
								<p className="mt-1 text-xs text-red-600">
									{failedAudioSyncs[0]?.detail ||
										(settingsLanguage === "hi"
											? "कृपया Fetch बटन दबाकर फिर प्रयास करें।"
											: "Please tap Fetch and try again.")}
								</p>
								<div className="mt-2 flex flex-wrap gap-2 text-[11px] text-red-700">
									{failedAudioSyncs.map((item) => (
										<span
											key={item.label}
											className="rounded-full border border-red-200 bg-white/80 px-2 py-0.5"
										>
											{item.label}
										</span>
									))}
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{bhajanSyncProgress?.step === "error" && (
										<button
											onClick={() => {
												void onRetryKirtanSync?.();
											}}
											className="rounded-full bg-gold-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
										>
											{settingsLanguage === "hi"
												? "कीर्तन Fetch करें"
												: "Fetch Kirtan"}
										</button>
									)}
									{lectureSyncProgress?.step === "error" && (
										<button
											onClick={() => {
												void onRetryKathaSync?.();
											}}
											className="rounded-full bg-gold-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
										>
											{settingsLanguage === "hi"
												? "कथा Fetch करें"
												: "Fetch Katha"}
										</button>
									)}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Search Bar Header (Sticky) */}
				{subTab !== "playlists" &&
					(isSearchOpen || rawSearchQuery.trim().length > 0) && (
						<div
							className={`sticky z-30 bg-cream-25/95 dark:bg-slate-900/95 backdrop-blur-md py-2 px-4 border-b border-gold-600/20 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 top-[49px] landscape:!top-[49px]`}
						>
							<Search className="shrink-0 text-gold-700" size={20} />
							<input
								className="flex-1 min-w-0 bg-transparent outline-none py-2 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
								placeholder={
									settingsLanguage === "hi"
										? "खोजें (Hinglish).."
										: "Search (Hinglish)..."
								}
								value={rawSearchQuery}
								onChange={(e) => onSearchChange?.(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && rawSearchQuery.trim()) {
										addRecentSearch(rawSearchQuery.trim());
										setRecentSearches(getRecentSearches());
										e.currentTarget.blur();
									}
								}}
							/>
							<VoiceSearchButton
								onResult={(text) => {
									onSearchChange?.(text);
									setShowRecentSearches(false);
								}}
							/>
							<button
								aria-label="Close search"
								onClick={() => {
									onSearchChange?.("");
									setIsSearchOpen(false);
									setShowRecentSearches(false);
								}}
								className="shrink-0 p-2 text-slate-400 dark:text-ink-400 hover:text-red-500 transition-colors"
							>
								<X size={20} />
							</button>
							{recentSearches.length > 0 && (
								<div className="relative shrink-0">
									<button
										aria-label="Recent searches"
										onClick={() => setShowRecentSearches(!showRecentSearches)}
										className={`p-2 transition-colors ${showRecentSearches ? "text-gold-700" : "text-slate-400 dark:text-ink-400 hover:text-gold-700"}`}
									>
										<History size={20} />
									</button>

									{showRecentSearches && (
										<div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
											<div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
												<span className="text-xs font-semibold text-slate-500 dark:text-ink-300 uppercase tracking-wider">
													Recent Searches
												</span>
												<button
													onClick={() => {
														clearRecentSearches();
														setRecentSearches([]);
														setShowRecentSearches(false);
													}}
													className="text-xs text-red-500 hover:text-red-600 font-medium"
												>
													Clear
												</button>
											</div>
											<ul className="max-h-60 overflow-y-auto">
												{recentSearches.map((term, i) => (
													<li key={i}>
														<button
															onClick={() => {
																onSearchChange?.(term);
																setShowRecentSearches(false);
															}}
															className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
														>
															<History
																size={14}
																className="text-slate-400 dark:text-ink-400"
															/>
															<span className="truncate">{term}</span>
														</button>
													</li>
												))}
											</ul>
										</div>
									)}
								</div>
							)}
						</div>
					)}

				{/* Floating Search Button */}
				{subTab !== "playlists" && !rawSearchQuery.trim() && !isSearchOpen && (
					<div
						className={`sticky z-20 flex justify-end h-0 overflow-visible pointer-events-none px-4 top-[49px] landscape:!top-0 landscape:-mt-[49px] landscape:items-start landscape:pr-2`}
					>
						<div className="py-2 pointer-events-auto flex items-center gap-2 mt-2 landscape:mt-0 landscape:py-[5px]">
							<button
								aria-label="Search"
								data-tour="audio-search"
								onClick={() => {
									triggerHaptic("light");
									setIsSearchOpen(true);
								}}
								className="p-2 rounded-full text-gold-700/80 hover:text-gold-700 hover:bg-gold-600/10 transition-colors bg-cream-25/90 dark:bg-slate-900/90 shadow-sm border border-gold-600/20 backdrop-blur-sm"
							>
								<Search size={20} />
							</button>
						</div>
					</div>
				)}

				{/* Main Content Area */}
				<div className="pb-64 relative">
					<div
						key={subTab}
						className={
							animDirection === "right"
								? "animate-slide-in-right"
								: animDirection === "left"
									? "animate-slide-in-left"
									: "h-full"
						}
					>
						{searchQuery.trim() &&
						(subTab === "bhajans" || subTab === "kathas") ? (
							renderSearchResults()
						) : (
							<>
								{subTab === "bhajans" && renderBhajansTab()}
								{subTab === "kathas" && (
									<LectureList
										items={filteredKathasWithAudio}
										type="katha"
										onSelect={(lecture, track, contextQueue) => {
											if (track && contextQueue) {
												handlePlayTrack(track, contextQueue, t.kathas);
											} else {
												onOpenLecture(lecture, track, contextQueue);
											}
										}}
										searchQuery={searchQuery}
										activeDownloads={activeDownloads}
										onDownloadTrack={onDownloadTrack}
										settingsLanguage={settingsLanguage}
										category="lecture"
										onRetrySync={onRetryKathaSync}
										isSyncing={lectureSyncProgress?.isSyncing}
									/>
								)}
								{subTab === "singers" && renderSingersTab()}
								{subTab === "playlists" && renderListTab()}
							</>
						)}
					</div>
				</div>

				{/* Bottom Player Section - FIXED */}
				{currentTrack &&
					createPortal(
						isPlayerMinimized ? (
							<MiniPlayer onExpand={() => setIsPlayerMinimized(false)} />
						) : (
							<div
								className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-0 right-0 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-saffron-200 dark:border-slate-800 p-3 sm:p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-30 landscape:bottom-0 landscape:right-[calc(5rem+env(safe-area-inset-right))] landscape:left-[calc(16rem+env(safe-area-inset-left))] landscape:w-auto landscape:border-l landscape:border-t-0"
								onTouchStart={(e) => e.stopPropagation()}
								onTouchMove={(e) => e.stopPropagation()}
								onTouchEnd={(e) => e.stopPropagation()}
							>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setIsPlayerMinimized(true);
									}}
									className="absolute top-1 right-2 p-1.5 text-slate-400 dark:text-ink-400 hover:text-saffron-600 dark:hover:text-saffron-400 z-10 landscape:top-2 landscape:right-2"
									title="Minimize Player"
								>
									<ChevronDown size={22} />
								</button>
								<div className="flex flex-col xl:flex-row items-center justify-between gap-4 max-w-6xl mx-auto w-full relative pt-4 xl:pt-0">
									{/* Track Info */}
									<div className="w-full xl:w-1/3 flex items-center justify-between xl:justify-start gap-2 px-1">
										<button
											onClick={(e) => {
												e.stopPropagation();
												triggerHaptic("light");
												playPrevious();
											}}
											className="p-2 text-slate-400 hover:text-saffron-600 dark:text-slate-500 dark:hover:text-saffron-400 transition-colors shrink-0"
										>
											<SkipBack size={24} fill="currentColor" />
										</button>

										<button
											onClick={() => {
												if (currentTrack?.parentBhajan) {
													onOpenBhajan(currentTrack.parentBhajan);
												}
											}}
											className="flex-1 group inline-flex flex-col items-center md:items-start min-w-0 text-center md:text-left overflow-hidden mx-2"
										>
											<div className="flex items-center justify-center md:justify-start gap-2 w-full mb-0.5">
												{isPlaying && currentTrack && (
													<div className="flex items-end justify-center gap-0.5 h-4 shrink-0">
														<div className="w-1 bg-saffron-500 rounded-full animate-audio-bar audio-bar-1"></div>
														<div className="w-1 bg-saffron-500 rounded-full animate-audio-bar audio-bar-2"></div>
														<div className="w-1 bg-saffron-500 rounded-full animate-audio-bar audio-bar-3"></div>
													</div>
												)}
												<h2
													className={`text-lg sm:text-xl font-hindi font-bold truncate transition-all duration-300 ${
														currentTrack?.parentBhajan
															? "text-saffron-600 dark:text-saffron-400 drop-shadow-[0_0_8px_rgba(234,88,12,0.5)] animate-pulse"
															: "text-slate-800 dark:text-white drop-shadow-md group-hover:text-saffron-600"
													}`}
												>
													{trackTitle || "No Audio Playing"}
												</h2>
											</div>
											<p
												className={`text-xs sm:text-sm truncate font-hindi transition-colors w-full ${
													currentTrack?.parentBhajan
														? "text-saffron-500 dark:text-saffron-300 drop-shadow-[0_0_5px_rgba(234,88,12,0.3)]"
														: "text-slate-500 dark:text-slate-400 group-hover:text-saffron-500"
												}`}
											>
												{currentTrack?.singer || "Select a track to play"}
											</p>
										</button>

										<button
											onClick={(e) => {
												e.stopPropagation();
												triggerHaptic("light");
												playNext();
											}}
											className="p-2 text-slate-400 hover:text-saffron-600 dark:text-slate-500 dark:hover:text-saffron-400 transition-colors shrink-0"
										>
											<SkipForward size={24} fill="currentColor" />
										</button>
									</div>

									{/* Controls */}
									<div className="w-full xl:w-1/3 flex flex-col items-center justify-center gap-2">
										<div className="flex items-center justify-center gap-3 sm:gap-4">
											<button
												onClick={toggleRepeat}
												className={`p-2 transition-colors drop-shadow-md ${repeatMode !== "off" ? "text-saffron-600 dark:text-saffron-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}
											>
												{repeatMode === "one" ? (
													<Repeat1 size={18} />
												) : (
													<Repeat size={18} />
												)}
											</button>
											<button
												onClick={() => {
													triggerHaptic("light");
													seek(Math.max(0, progress - 10));
												}}
												className="p-2 text-slate-500 hover:text-saffron-600 dark:text-slate-400 dark:hover:text-saffron-400 transition-colors"
											>
												<RotateCcw size={18} />
											</button>

											<button
												onClick={() => {
													triggerHaptic("medium");
													togglePlay();
												}}
												className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-saffron-500 hover:bg-saffron-600 shadow-md text-white hover:scale-105 transition-transform"
											>
												{isLoading ? (
													<Loader2 size={20} className="animate-spin" />
												) : isPlaying ? (
													<Pause size={20} fill="currentColor" />
												) : (
													<Play
														size={20}
														fill="currentColor"
														className="ml-1"
													/>
												)}
											</button>

											<button
												onClick={() => {
													triggerHaptic("light");
													seek(Math.min(duration, progress + 10));
												}}
												className="p-2 text-slate-500 hover:text-saffron-600 dark:text-slate-400 dark:hover:text-saffron-400 transition-colors"
											>
												<RotateCw size={18} />
											</button>
											<button
												onClick={() => setShowQueueModal(true)}
												data-tour="audio-queue"
												className={`p-2 transition-colors drop-shadow-md ${showQueueModal ? "text-saffron-600 dark:text-saffron-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}
											>
												<ListMusic size={18} />
											</button>
											{currentTrack?.parentBhajan?.audio &&
												currentTrack.parentBhajan.audio.length > 1 && (
													<button
														onClick={() => setShowSingerSelect(true)}
														className="p-2 transition-colors drop-shadow-md text-saffron-500 hover:text-saffron-600 dark:text-saffron-400 dark:hover:text-saffron-300"
														title={t.selectSinger}
													>
														<User size={18} />
													</button>
												)}
											{isIOSWeb && currentTrack && (
												<a
													href={currentTrack.url}
													target="_blank"
													rel="noopener noreferrer"
													className="p-2 transition-colors drop-shadow-md text-blue-500 hover:text-blue-600 flex flex-col items-center justify-center"
													title="Direct Browser Download (For iOS)"
												>
													<Download size={18} />
													<span className="text-[8px] font-bold uppercase leading-none mt-0.5">
														iOS DL
													</span>
												</a>
											)}
											{!isIOSWeb && currentTrack && (
												<button
													onClick={() => {
														if (currentTrack) {
															const isDownloaded = isTrackDownloaded(
																currentTrack.id,
															);
															if (!navigator.onLine && !isDownloaded) {
																showToast(
																	"Turn on internet to download.",
																	"error",
																);
																return;
															}
															onDownloadTrack(
																currentTrack,
																trackTitle || "Audio Track",
																currentTrack.parentBhajan ? "audio" : "lecture",
															);
														}
													}}
													disabled={
														isTrackDownloaded(currentTrack.id) ||
														!!activeDownloads[currentTrack.id]
													}
													className={`p-2 transition-colors drop-shadow-md relative ${isTrackDownloaded(currentTrack.id) ? "text-green-500 dark:text-green-400" : activeDownloads[currentTrack.id] ? "text-saffron-500 dark:text-saffron-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}
													title={t.download}
												>
													{activeDownloads[currentTrack.id] ? (
														<div className="relative flex items-center justify-center w-[18px] h-[18px]">
															<span className="text-[10px] font-black text-saffron-600 dark:text-saffron-400">
																{Math.round(
																	activeDownloads[currentTrack.id]?.progress ||
																		0,
																)}
															</span>
														</div>
													) : isTrackDownloaded(currentTrack.id) ? (
														<Check size={18} />
													) : (
														<Download size={18} />
													)}
												</button>
											)}
										</div>

										{/* Progress Bar */}
										<div className="w-full flex items-center gap-2 px-4 xl:px-0">
											<span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 w-8 text-right">
												{formatTime(currentProgress)}
											</span>
											<div className="relative flex-1 h-1.5 bg-saffron-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner border border-saffron-200 dark:border-slate-600">
												<div
													className="absolute top-0 left-0 h-full bg-gradient-to-r from-saffron-400 to-saffron-600"
													style={{ width: `${progressPercent}%` }}
												></div>
												<input
													type="range"
													min="0"
													max={currentDuration}
													value={currentProgress}
													onChange={handleSeek}
													onMouseDown={(e) => {
														e.stopPropagation();
														setIsDragging(true);
													}}
													onMouseUp={handleSeekEnd}
													onTouchStart={(e) => {
														e.stopPropagation();
														setIsDragging(true);
													}}
													onTouchMove={(e) => e.stopPropagation()}
													onTouchEnd={handleSeekEnd}
													className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
												/>
											</div>
											<span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 w-8">
												{formatTime(currentDuration)}
											</span>
										</div>
									</div>

									{/* Empty space for balance on desktop */}
									<div className="hidden xl:block xl:w-1/3"></div>
								</div>
							</div>
						),
						document.body,
					)}
			</div>

			{/* Modals */}
			{showQueueModal &&
				createPortal(
					<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
						<div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-saffron-200 dark:border-slate-700 max-h-[80vh] overflow-hidden flex flex-col">
							<div className="flex items-center justify-between mb-4 shrink-0">
								<h3 className="text-lg font-bold text-saffron-600 dark:text-saffron-400 flex items-center gap-2">
									<ListMusic size={20} /> Current Queue
								</h3>
								<button
									aria-label="Close"
									onClick={handleCloseQueueModal}
									className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-ink-400"
								>
									<X size={20} />
								</button>
							</div>
							<div className="overflow-y-auto space-y-2 pr-2">
								{queue.length === 0 ? (
									<div className="text-center py-8 text-slate-400 dark:text-ink-400">
										<p>Queue is empty</p>
									</div>
								) : (
									queue.map((track, idx) => {
										const isCurrent = currentTrack?.id === track.id;
										return (
											<button
												key={`${track.id}-${idx}`}
												onClick={() => {
													handlePlayTrack(track, queue, "Queue");
												}}
												className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
													isCurrent
														? "bg-saffron-50 dark:bg-slate-700/50 border border-saffron-200 dark:border-slate-600"
														: "hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
												}`}
											>
												<div className="flex items-center gap-3 min-w-0">
													<div
														className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
															isCurrent
																? "bg-saffron-500 text-white"
																: "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-ink-300"
														}`}
													>
														{idx + 1}
													</div>
													<div className="min-w-0">
														<div
															className={`text-sm font-bold truncate ${isCurrent ? "text-saffron-700 dark:text-saffron-400" : "text-slate-700 dark:text-slate-300"}`}
														>
															{track.bhajanTitle || trackTitle}
														</div>
														<div className="text-xs text-slate-500 dark:text-ink-300 truncate">
															{track.singer}
														</div>
													</div>
												</div>
												{isCurrent && (
													<div className="w-2 h-2 rounded-full bg-saffron-500 shrink-0 ml-2 animate-pulse" />
												)}
											</button>
										);
									})
								)}
							</div>
						</div>
					</div>,
					document.body,
				)}

			{showCreateModal &&
				createPortal(
					<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
						<div className="bg-white dark:bg-slate-800 w-full max-w-xs landscape:max-w-md rounded-3xl p-6 shadow-2xl border border-saffron-200 dark:border-slate-700 landscape:max-h-[90vh] overflow-y-auto">
							<h3 className="text-lg font-bold mb-4 text-saffron-600 dark:text-saffron-400">
								{t.newPlaylistTitle}
							</h3>
							<input
								className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl mb-4 border border-saffron-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-saffron-500/50 text-slate-800 dark:text-white placeholder:text-slate-400 shadow-inner transition-all"
								placeholder={t.playlistNamePlaceholder}
								value={newPlaylistName}
								onChange={(e) => setNewPlaylistName(e.target.value)}
							/>
							<div className="flex gap-3">
								<button
									onClick={() => handleCloseCreateModal()}
									className="flex-1 py-2.5 text-slate-500 dark:text-ink-300 font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-ink-600 transition-colors"
								>
									{t.cancel}
								</button>
								<button
									onClick={handleCreate}
									disabled={!newPlaylistName.trim()}
									className="flex-1 py-2.5 bg-saffron-500 text-white rounded-xl font-bold shadow-md hover:bg-saffron-600 disabled:opacity-50 transition-all"
								>
									{t.create}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{showRenameModal &&
				createPortal(
					<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
						<div className="bg-white dark:bg-slate-800 w-full max-w-xs landscape:max-w-md rounded-3xl p-6 shadow-2xl border border-saffron-200 dark:border-slate-700 landscape:max-h-[90vh] overflow-y-auto">
							<h3 className="text-lg font-bold mb-4 text-saffron-600 dark:text-saffron-400">
								{t.renamePlaylistTitle}
							</h3>
							<input
								className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl mb-4 border border-saffron-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-saffron-500/50 text-slate-800 dark:text-white placeholder:text-slate-400 shadow-inner transition-all"
								placeholder={t.playlistNamePlaceholder}
								value={renameInputValue}
								onChange={(e) => setRenameInputValue(e.target.value)}
							/>
							<div className="flex gap-3">
								<button
									onClick={() => handleCloseRenameModal()}
									className="flex-1 py-2.5 text-slate-500 dark:text-ink-300 font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-ink-600 transition-colors"
								>
									{t.cancel}
								</button>
								<button
									onClick={confirmRename}
									disabled={!renameInputValue.trim()}
									className="flex-1 py-2.5 bg-saffron-500 text-white rounded-xl font-bold shadow-md hover:bg-saffron-600 disabled:opacity-50 transition-all"
								>
									{t.rename}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{playlistToDelete &&
				createPortal(
					<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
						<div className="bg-cream-25 dark:bg-slate-800 w-full max-w-xs landscape:max-w-md rounded-3xl p-6 shadow-2xl text-center border border-red-200 dark:border-red-900 landscape:max-h-[90vh] overflow-y-auto">
							<div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200 dark:border-red-800">
								<AlertTriangle size={28} />
							</div>
							<h3 className="text-xl font-bold mb-2 text-slate-800 dark:text-white">
								{t.deletePlaylistTitle}
							</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
								{t.deletePlaylistDesc}
							</p>
							<div className="flex gap-3">
								<button
									onClick={() => setPlaylistToDelete(null)}
									className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-ink-600 transition-colors"
								>
									{t.cancel}
								</button>
								<button
									onClick={confirmDelete}
									className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-md transition-colors"
								>
									{t.delete}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
			{showSingerSelect &&
				currentTrack?.parentBhajan?.audio &&
				createPortal(
					<div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
						<div className="bg-white dark:bg-slate-800 w-[90vw] max-w-md rounded-3xl p-5 shadow-2xl border border-saffron-200 dark:border-slate-700 max-h-[80vh] flex flex-col">
							<div className="flex items-center justify-between mb-4 shrink-0 px-1">
								<h3 className="text-lg font-bold text-saffron-600 dark:text-saffron-400">
									{t.availableAudio}
								</h3>
								<button
									aria-label="Close"
									onClick={handleCloseSingerSelect}
									className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-ink-400"
								>
									<X size={20} />
								</button>
							</div>
							<div className="space-y-2 overflow-y-auto pr-1">
								{currentTrack.parentBhajan.audio.map((track, idx) => {
									const isCurrentTrack = track.id === currentTrack.id;
									return (
										<div
											key={idx}
											className={`flex items-center group rounded-xl transition-colors border ${isCurrentTrack ? "bg-saffron-50 dark:bg-slate-700 border-saffron-200 dark:border-saffron-500" : "bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 border-transparent hover:border-saffron-200"}`}
										>
											<button
												onClick={() => {
													triggerHaptic("medium");
													if (currentTrack?.parentBhajan?.audio) {
														const queue = currentTrack.parentBhajan.audio.map(
															(t) => ({
																...t,
																bhajanTitle: trackTitle,
																parentBhajan: currentTrack.parentBhajan,
															}),
														);
														// Reorder queue to start with selected track
														const reorderedQueue = [
															...queue.slice(idx),
															...queue.slice(0, idx),
														];

														playTrack(
															track,
															trackTitle,
															currentTrack.parentBhajan,
															trackImage,
															reorderedQueue,
															"Song List",
														);
														handleCloseSingerSelect();
													}
												}}
												className="flex-1 text-left px-3 py-2.5 flex items-center gap-3"
											>
												<div
													className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${isCurrentTrack ? "bg-saffron-100 text-saffron-600" : "bg-saffron-100 dark:bg-slate-700 text-saffron-600 dark:text-saffron-400 group-hover:bg-saffron-500 group-hover:text-white"}`}
												>
													{isCurrentTrack ? (
														isPlaying ? (
															<div className="flex items-end justify-center gap-0.5 h-4 w-5">
																<div className="w-1 bg-gold-600 rounded-full animate-audio-bar audio-bar-1"></div>
																<div className="w-1 bg-gold-600 rounded-full animate-audio-bar audio-bar-2"></div>
																<div className="w-1 bg-gold-600 rounded-full animate-audio-bar audio-bar-3"></div>
															</div>
														) : (
															<Music size={20} />
														)
													) : (
														<PlayCircle size={20} />
													)}
												</div>
												<div className="flex-1 min-w-0 py-1">
													<div
														className={`text-sm font-bold leading-tight ${isCurrentTrack ? "text-saffron-700 dark:text-saffron-400" : "text-slate-700 dark:text-slate-200 group-hover:text-saffron-700 dark:group-hover:text-saffron-300"}`}
													>
														{track.singer?.replace(/\s+\)/g, ")") ||
															t.unknownSinger}
													</div>
													<div className="text-xs text-slate-400 dark:text-ink-400 mt-0.5">
														{formatTime(track.duration || 0)}
													</div>
												</div>
											</button>
											{isIOSWeb ? (
												<a
													href={track.url}
													target="_blank"
													rel="noopener noreferrer"
													className="p-3 mr-1 transition-colors drop-shadow-md text-blue-500 hover:text-blue-600 flex flex-col items-center justify-center"
													title="Direct Browser Download (For iOS)"
												>
													<Download size={20} />
													<span className="text-[8px] font-bold uppercase leading-none mt-0.5">
														iOS DL
													</span>
												</a>
											) : (
												<button
													onClick={(e) => {
														e.stopPropagation();
														if (
															!navigator.onLine &&
															!isTrackDownloaded(track.id)
														) {
															showToast(
																"Turn on internet to download.",
																"error",
															);
															return;
														}
														if (currentTrack?.parentBhajan) {
															const queueTrack = {
																...track,
																bhajanTitle: trackTitle,
																parentBhajan: currentTrack.parentBhajan,
															};
															onDownloadTrack(
																queueTrack,
																trackTitle || "Audio Track",
																"audio",
															);
														}
													}}
													disabled={
														isTrackDownloaded(track.id) ||
														!!activeDownloads[track.id]
													}
													className={`p-3 mr-1 transition-colors relative ${isTrackDownloaded(track.id) ? "text-green-500" : activeDownloads[track.id] ? "text-saffron-500" : "text-slate-400 dark:text-ink-400 hover:text-slate-600"}`}
													title={t.download}
												>
													{activeDownloads[track.id] ? (
														<div className="relative flex items-center justify-center w-5 h-5">
															<span className="text-[10px] font-black text-saffron-600 dark:text-saffron-400">
																{Math.round(
																	activeDownloads[track.id]?.progress || 0,
																)}
															</span>
														</div>
													) : isTrackDownloaded(track.id) ? (
														<Check size={20} />
													) : (
														<Download size={20} />
													)}
												</button>
											)}
										</div>
									);
								})}
							</div>
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
};

const DeleteConfirmButton: React.FC<{
	onConfirm: () => void;
	confirmText?: string;
}> = ({ onConfirm, confirmText = "Confirm?" }) => {
	const [confirming, setConfirming] = useState(false);
	useEffect(() => {
		if (confirming) {
			const timer = setTimeout(() => setConfirming(false), 3000);
			return () => clearTimeout(timer);
		}
	}, [confirming]);
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		if (confirming) {
			onConfirm();
			setConfirming(false);
		} else {
			setConfirming(true);
		}
	};
	return (
		<button
			type="button"
			onClick={handleClick}
			className={`p-2 rounded-full transition-all active:scale-95 flex items-center gap-2 ${confirming ? "bg-red-500 text-white px-3 shadow-md" : "text-slate-300 hover:text-red-500 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
			title={confirming ? "Click to Confirm Removal" : "Remove from Playlist"}
		>
			{confirming ? (
				<span className="text-xs font-bold whitespace-nowrap">
					{confirmText}
				</span>
			) : (
				<Trash2 size={18} />
			)}
		</button>
	);
};

const TabButton = ({
	active,
	onClick,
	label,
	icon,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	icon: React.ReactNode;
}) => (
	<button
		onClick={onClick}
		className={`flex-1 py-2 sm:py-3.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm font-bold border-b-[3px] transition-all ${active ? "border-saffron-500 text-saffron-600 bg-saffron-50 dark:bg-slate-800 dark:text-saffron-400" : "border-transparent text-slate-400 hover:text-saffron-600 hover:bg-saffron-50/50 dark:hover:text-saffron-400 dark:hover:bg-slate-800/50"}`}
	>
		{icon} <span>{label}</span>
	</button>
);

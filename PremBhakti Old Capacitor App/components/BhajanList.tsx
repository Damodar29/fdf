import {
	Bell,
	Book,
	Check,
	ChevronRight,
	CloudRain,
	Filter,
	Flame,
	Flower2,
	Gift,
	Heart,
	History,
	Languages,
	ListMusic,
	Moon,
	Music,
	Music2,
	Plus,
	Search,
	Sparkles,
	Star,
	Sun,
	Tag,
	X,
} from "lucide-react";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useAudio } from "../context/AudioContext";
import { useData } from "../context/DataContext";
import { useSettings } from "../context/SettingsContext";
import { useTourUiAction } from "../src/tour/tourBus";
import type { Bhajan, BhajanCategory, Playlist, ScriptType } from "../types";
import { getBhajanCategory } from "../utils/bhajanClassifier";
import { triggerHaptic } from "../utils/haptic";
import {
	addRecentSearch,
	clearRecentSearches,
	getRecentSearches,
} from "../utils/recentSearches";
import {
	getDevanagariBaseChar,
	getListFirstLine,
	getMatchingSnippet,
} from "../utils/textProcessor";
import { AzSlider } from "./AzSlider";
import { HighlightText } from "./HighlightText";
import { VoiceSearchButton } from "./VoiceSearchButton";

// Icon map for dynamic filter categories — maps category ID to a lucide icon
const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
	badhai: <Gift size={20} />,
	holi: <Flame size={20} />,
	jhula: <CloudRain size={20} />,
	aarti: <Bell size={20} />,
	ashtak: <Book size={20} />,
	// Additional icons for new categories added by admin
	bhajan: <Music size={20} />,
	kirtan: <Music2 size={20} />,
	stuti: <Star size={20} />,
	prarthana: <Heart size={20} />,
	pad: <Sparkles size={20} />,
	vasant: <Flower2 size={20} />,
};

interface BhajanListProps {
	bhajans: Bhajan[];
	onSelect: (bhajan: Bhajan) => void;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	script: ScriptType;
	indexMode: "latin" | "devanagari";
	onIndexModeChange: (mode: "latin" | "devanagari") => void;
	azSliderSide: "left" | "right";
	playlists: Playlist[];
	onCreatePlaylist: (name: string) => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage?: "en" | "hi";
	onSettingsLanguageChange?: (lang: "en" | "hi") => void;
	isSyncing?: boolean;
	syncProgress?: {
		progress: number;
		detail: string;
		step?: string;
		isSyncing?: boolean;
	};
	onRetrySync?: () => Promise<boolean>;
}

// ----------------------------------------------------------------------
// Memoized List Item to prevent re-renders of the whole list
// ----------------------------------------------------------------------
const BhajanItem = React.memo(
	({
		bhajan,
		script,
		searchQuery,
		onSelect,
		knownAuthors,
	}: {
		bhajan: Bhajan;
		script: ScriptType;
		searchQuery: string;
		onSelect: (b: Bhajan) => void;
		knownAuthors: Record<string, any>;
	}) => {
		const displayTitle = script === "iast" ? bhajan.titleIAST : bhajan.title;
		const matchedSnippet = getMatchingSnippet(bhajan, searchQuery, script);
		const isContentMatch = !!matchedSnippet;
		const subtitle =
			matchedSnippet ||
			(script === "iast"
				? getListFirstLine(bhajan.firstLineIAST, bhajan.contentIAST)
				: getListFirstLine(bhajan.firstLine, bhajan.content));

		const authorName = (() => {
			if (!bhajan.author) return null;
			if (script === "iast") {
				return (
					knownAuthors[bhajan.author]?.iast ||
					bhajan.authorIAST ||
					bhajan.author
				);
			}
			return knownAuthors[bhajan.author]?.deva || bhajan.author;
		})();

		const handleClick = () => {
			triggerHaptic("medium");
			onSelect(bhajan);
		};

		return (
			<div
				className="animate-fade-in-up"
				style={{ contentVisibility: "auto", containIntrinsicSize: "0 88px" }}
			>
				<button
					onClick={handleClick}
					// Updated to Cream/Gold card styling
					className="w-full text-left p-5 bg-ry-cream dark:bg-slate-800 rounded-2xl shadow-sm border border-ry-gold/20 active:scale-[0.98] transition-all duration-200 flex items-center gap-4 group hover:border-ry-gold/60 hover:shadow-md"
				>
					<div className="flex-1 min-w-0">
						<h3 className="text-xl font-hindi font-bold text-slate-800 dark:text-slate-100 truncate mb-1.5 leading-snug group-hover:text-ry-gold transition-colors flex items-center gap-2">
							<span className="truncate">
								<HighlightText text={displayTitle} highlight={searchQuery} />
							</span>
							{bhajan.audio && bhajan.audio.length > 0 && (
								<span className="shrink-0 flex items-center gap-1 bg-ry-gold/10 text-ry-gold px-2 py-0.5 rounded-full border border-ry-gold/20">
									<Music size={12} />
								</span>
							)}
						</h3>
						<div className="flex items-start gap-2">
							<p
								className={`text-base font-hindi leading-snug line-clamp-2 ${isContentMatch ? "text-ry-gold" : "text-slate-500 dark:text-slate-400"}`}
							>
								<HighlightText text={subtitle} highlight={searchQuery} />
							</p>
						</div>
						{authorName && (
							<div className="mt-2 text-xs uppercase tracking-wide text-ry-gold font-bold font-hindi">
								{authorName}
							</div>
						)}
					</div>
					<ChevronRight
						className="text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-ry-gold transition-colors"
						size={24}
					/>
				</button>
			</div>
		);
	},
);

const SimpleBhajanItem = React.memo(
	({
		bhajan,
		script,
		onSelect,
		paddingClass,
		knownAuthors,
	}: {
		bhajan: Bhajan;
		script: ScriptType;
		onSelect: (b: Bhajan) => void;
		paddingClass: string;
		knownAuthors: Record<string, any>;
	}) => {
		const displayTitle = script === "iast" ? bhajan.titleIAST : bhajan.title;
		const subtitle =
			script === "iast"
				? getListFirstLine(bhajan.firstLineIAST, bhajan.contentIAST)
				: getListFirstLine(bhajan.firstLine, bhajan.content);

		const authorName = (() => {
			if (!bhajan.author) return null;
			if (script === "iast") {
				return (
					knownAuthors[bhajan.author]?.iast ||
					bhajan.authorIAST ||
					bhajan.author
				);
			}
			return knownAuthors[bhajan.author]?.deva || bhajan.author;
		})();

		const handleClick = () => {
			triggerHaptic("medium");
			onSelect(bhajan);
		};

		return (
			<li
				className="animate-fade-in-up"
				style={{ contentVisibility: "auto", containIntrinsicSize: "0 72px" }}
				data-tour="bhajans-item"
			>
				<button
					onClick={handleClick}
					className={`w-full text-left py-5 active:bg-ry-gold/5 dark:active:bg-slate-800/50 transition-all flex items-center justify-between group ${paddingClass}`}
				>
					<div className="flex-1 min-w-0">
						<h3 className="text-xl font-hindi font-bold text-slate-800 dark:text-slate-200 truncate leading-snug mb-1.5 group-hover:text-ry-gold transition-colors flex items-center gap-2">
							<span className="truncate">{displayTitle}</span>
							{bhajan.audio && bhajan.audio.length > 0 && (
								<span className="shrink-0 flex items-center gap-1 bg-ry-gold/10 text-ry-gold px-2 py-0.5 rounded-full border border-ry-gold/20">
									<Music size={12} />
								</span>
							)}
						</h3>
						<div className="flex items-center gap-2 truncate">
							{authorName && (
								<span className="text-xs uppercase tracking-wider text-ry-gold font-bold shrink-0">
									{authorName} •
								</span>
							)}
							<p className="text-sm text-slate-400 dark:text-slate-500 truncate font-hindi">
								{subtitle}
							</p>
						</div>
					</div>
				</button>
			</li>
		);
	},
);

export const BhajanList: React.FC<BhajanListProps> = ({
	bhajans,
	onSelect,
	searchQuery,
	onSearchChange,
	script,
	indexMode,
	onIndexModeChange,
	azSliderSide,
	playlists,
	onCreatePlaylist,
	scrollBarSide = "left",
	settingsLanguage = "en",
	onSettingsLanguageChange,
	isSyncing = false,
	syncProgress,
	onRetrySync,
}) => {
	const { filterCategories, knownAuthors } = useData();
	const { currentBhajan } = useAudio();
	const { uiScale } = useSettings();
	const baseContainerHeight = 18;
	const scaledContainerHeight = Math.max(baseContainerHeight * uiScale, 14);
	const _headerHeightRem = scaledContainerHeight * 0.25;

	const [activeFilter, setActiveFilter] = useState<string>("all");
	const [showFilterModal, setShowFilterModal] = useState(false);
	// The guided tour shows the filter sheet to explain it. It must not push
	// history entries (the tour owns Back while it runs), so it is a separate
	// flag that the history effects below ignore.
	const [tourFilterPreview, setTourFilterPreview] = useState(false);
	const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
	const [newPlaylistName, setNewPlaylistName] = useState("");
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [showRecentSearches, setShowRecentSearches] = useState(false);
	const [showAllRecent, setShowAllRecent] = useState(false);
	const [recentSearches, setRecentSearches] = useState<string[]>([]);
	const hasSyncError = syncProgress?.step === "error";
	const shouldAutoFocusRef = useRef(false);

	const handleOpenSearch = () => {
		triggerHaptic("light");
		shouldAutoFocusRef.current = true;
		setIsSearchOpen(true);
	};

	// Callback ref: fires the instant the input mounts → focus + keyboard
	const searchInputCbRef = useCallback((el: HTMLInputElement | null) => {
		if (el && shouldAutoFocusRef.current) {
			el.focus();
			shouldAutoFocusRef.current = false;
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const scrollContainer = document.querySelector(".scroll-container");
		if (scrollContainer) {
			scrollContainer.scrollTo({ top: 0, behavior: "auto" });
		}
	}, [searchQuery, activeFilter]);

	useEffect(() => {
		setRecentSearches(getRecentSearches());
	}, []);

	// The guided tour opens the search bar to point at recent searches, and
	// closes it again afterwards. Nothing else sends this.
	useTourUiAction((action) => {
		if (action.type === "bhajans-filter") {
			setTourFilterPreview(action.open);
			return;
		}
		if (action.type !== "bhajans-search") return;
		setIsSearchOpen(action.open);
		if (!action.open) {
			setShowRecentSearches(false);
			setShowAllRecent(false);
		}
	});

	const handleCloseFilterModal = () => {
		if (window.history.state?.view === "filter-modal") window.history.back();
		else setShowFilterModal(false);
	};

	// Handle Hardware Back Button for Filter Modal
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleCloseFilterModal is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (showFilterModal) {
			const stateId = `filter-modal-${Date.now()}`;
			window.history.pushState({ isPopup: true, modalId: stateId }, "");

			const handlePopState = () => {
				handleCloseFilterModal();
			};

			window.addEventListener("popstate", handlePopState);

			return () => {
				window.removeEventListener("popstate", handlePopState);
				if (window.history.state?.modalId === stateId) {
					window.history.back();
				}
			};
		}
	}, [showFilterModal]);

	// Translations
	const t = {
		filterTitle:
			settingsLanguage === "hi" ? "फ़िल्टर और संग्रह" : "Filter & Collections",
		nityaKriya: settingsLanguage === "hi" ? "नित्य क्रिया" : "Nitya Kriya",
		morning: settingsLanguage === "hi" ? "प्रातः (Morning)" : "Morning",
		evening: settingsLanguage === "hi" ? "सायं (Evening)" : "Evening",
		collections: settingsLanguage === "hi" ? "मेरे संग्रह" : "My Collections",
		customList: settingsLanguage === "hi" ? "कस्टम सूची" : "Custom List",
		listName: settingsLanguage === "hi" ? "सूची का नाम" : "List Name",
		add: settingsLanguage === "hi" ? "जोड़ें" : "Add",
		categories: settingsLanguage === "hi" ? "श्रेणियाँ" : "Categories",
		allBhajans: settingsLanguage === "hi" ? "सभी भजन" : "All Bhajans",
		badhai: settingsLanguage === "hi" ? "बधाई / जन्मोत्सव" : "Badhai / Janmotsav",
		holi: settingsLanguage === "hi" ? "होली / फाग" : "Holi / Phag",
		jhula: settingsLanguage === "hi" ? "झूलन / सावन" : "Jhulan / Sawan",
		aarti: settingsLanguage === "hi" ? "आरतियाँ" : "Aartis",
		ashtak: settingsLanguage === "hi" ? "अष्टक और स्तोत्र" : "Ashtakas & Stotras",
		morningNitya:
			settingsLanguage === "hi" ? "प्रातः नित्य क्रिया" : "Morning Nitya Kriya",
		eveningNitya:
			settingsLanguage === "hi" ? "सायं नित्य क्रिया" : "Evening Nitya Kriya",
		searchPlaceholder:
			settingsLanguage === "hi" ? "खोजें (Hinglish).." : "Search (Hinglish)...",
	};

	// Duplicate removed

	// Default hardcoded categories as fallback
	const defaultCategories = [
		{
			id: "badhai",
			labelHi: "बधाई / जन्मोत्सव",
			labelEn: "Badhai / Janmotsav",
			keywords: [],
			order: 1,
		},
		{
			id: "holi",
			labelHi: "होली / फाग",
			labelEn: "Holi / Phag",
			keywords: [],
			order: 2,
		},
		{
			id: "jhula",
			labelHi: "झूलन / सावन",
			labelEn: "Jhulan / Sawan",
			keywords: [],
			order: 3,
		},
		{
			id: "aarti",
			labelHi: "आरतियाँ",
			labelEn: "Aartis",
			keywords: [],
			order: 4,
		},
		{
			id: "ashtak",
			labelHi: "अष्टक और स्तोत्र",
			labelEn: "Ashtakas & Stotras",
			keywords: [],
			order: 5,
		},
	];
	const activeCategories =
		filterCategories.length > 0 ? filterCategories : defaultCategories;

	// Filter Logic
	const filteredBhajans = useMemo(() => {
		if (activeFilter === "all") return bhajans;

		if (activeFilter === "morning") {
			return bhajans.filter((b) => typeof b.categories?.morning === "number");
		}

		if (activeFilter === "evening") {
			return bhajans.filter((b) => typeof b.categories?.evening === "number");
		}

		if (activeFilter.startsWith("playlist-")) {
			const playlistId = activeFilter.replace("playlist-", "");
			const playlist = playlists.find((p) => p.id === playlistId);
			if (!playlist) return [];
			return bhajans.filter((b) => playlist.items.includes(b.id));
		}

		return bhajans.filter((b) => {
			const cats = getBhajanCategory(b);
			return cats.includes(activeFilter as BhajanCategory);
		});
	}, [bhajans, activeFilter, playlists]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: per-render functions/callbacks left out on purpose (as deps they re-ran this hook every render)
	const groupedBhajans = useMemo(() => {
		const groups: Record<string, Bhajan[]> = {};

		// Sort logic
		const sorted = [...filteredBhajans].sort((a, b) => {
			// For category filters, sort by the sequence number stored inline on each bhajan
			if (activeFilter === "morning" || activeFilter === "evening") {
				const seqA = a.categories?.[activeFilter] ?? 9999;
				const seqB = b.categories?.[activeFilter] ?? 9999;
				return seqA - seqB;
			}

			if (activeFilter !== "all") {
				const numA = parseInt(a.songNumber || "0", 10);
				const numB = parseInt(b.songNumber || "0", 10);
				if (numA > 0 && numB > 0) return numA - numB;
			}

			if (indexMode === "devanagari") {
				return a.title.localeCompare(b.title, "hi");
			}
			return a.titleIAST.localeCompare(b.titleIAST);
		});

		sorted.forEach((bhajan) => {
			const targetKeys: string[] = [];
			if (activeFilter !== "all") {
				targetKeys.push(getFilterLabel(activeFilter));
			} else {
				if (indexMode === "latin") {
					const devaChar = getDevanagariBaseChar(bhajan.title);
					const hinglishMap: Record<string, string[]> = {
						ऐ: ["A", "E"],
						ए: ["E"],
						औ: ["A", "O"],
						ओ: ["O"],
						ज्ञ: ["G", "J"],
						क्ष: ["K"],
						ऋ: ["R"],
					};
					if (hinglishMap[devaChar]) {
						targetKeys.push(...hinglishMap[devaChar]);
					} else {
						const rawChar = bhajan.titleIAST.charAt(0).toUpperCase();
						const normalizedChar = rawChar
							.normalize("NFD")
							.replace(/[\u0300-\u036f]/g, "");
						const key = /^[A-Z]/.test(normalizedChar) ? normalizedChar : "#";
						targetKeys.push(key);
					}
				} else {
					const baseChar = getDevanagariBaseChar(bhajan.title);
					const vowelMap: Record<string, string> = {
						आ: "अ",
						ई: "इ",
						ऊ: "उ",
						ऐ: "ए",
						औ: "ओ",
					};
					targetKeys.push(vowelMap[baseChar] || baseChar);
				}
			}
			targetKeys.forEach((k) => {
				if (!groups[k]) groups[k] = [];
				if (!groups[k].includes(bhajan)) groups[k].push(bhajan);
			});
		});
		return groups;
	}, [filteredBhajans, indexMode, activeFilter, settingsLanguage, playlists]);

	const sortedKeys = useMemo(() => {
		return Object.keys(groupedBhajans).sort((a, b) => {
			if (activeFilter !== "all") return 0; // Single group
			if (a === "#") return 1;
			if (b === "#") return -1;
			return a.localeCompare(b, indexMode === "devanagari" ? "hi" : "en");
		});
	}, [groupedBhajans, indexMode, activeFilter]);

	const [renderCount, setRenderCount] = useState(20);
	// Back-button support for Filter Modal
	useEffect(() => {
		if (showFilterModal)
			window.history.pushState({ isPopup: true, view: "filter-modal" }, "");
	}, [showFilterModal]);
	useEffect(() => {
		const h = (e: PopStateEvent) => {
			if (showFilterModal && e.state?.view !== "filter-modal")
				setShowFilterModal(false);
		};
		window.addEventListener("popstate", h);
		return () => window.removeEventListener("popstate", h);
	}, [showFilterModal]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setRenderCount(20);
	}, [activeFilter, searchQuery, indexMode]);

	useEffect(() => {
		const totalItems = searchQuery.trim()
			? bhajans.length
			: filteredBhajans.length;
		if (renderCount < totalItems) {
			const timer = setTimeout(() => {
				setRenderCount((prev) => Math.min(prev + 50, totalItems));
			}, 30);
			return () => clearTimeout(timer);
		}
	}, [renderCount, bhajans.length, filteredBhajans.length, searchQuery]);

	const scrollToSection = (key: string) => {
		triggerHaptic("light");
		const element = document.getElementById(`section-${key}`);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	const listPaddingClass =
		azSliderSide === "left" ? "pl-12 pr-4" : "pr-12 pl-4";
	const headerPaddingClass =
		azSliderSide === "left" ? "pl-12 pr-4" : "pr-12 pl-4";

	function getFilterLabel(filter: string) {
		if (filter.startsWith("playlist-")) {
			const pid = filter.replace("playlist-", "");
			const p = playlists.find((pl) => pl.id === pid);
			return p ? p.name : t.customList;
		}
		if (filter === "morning") return t.morningNitya;
		if (filter === "evening") return t.eveningNitya;
		if (filter === "all") return t.allBhajans;
		// Dynamic category lookup
		const cat = activeCategories.find((c) => c.id === filter);
		if (cat) return settingsLanguage === "hi" ? cat.labelHi : cat.labelEn;
		return t.allBhajans;
	}

	const handleCreatePlaylist = () => {
		if (newPlaylistName.trim()) {
			onCreatePlaylist(newPlaylistName.trim());
			setNewPlaylistName("");
			setIsCreatingPlaylist(false);
		}
	};

	// Filter options styled with gold
	const FilterOption = ({
		type,
		label,
		icon,
	}: {
		type: string;
		label: string;
		icon: React.ReactNode;
	}) => (
		<button
			onClick={() => {
				setActiveFilter(type);
				handleCloseFilterModal();
				triggerHaptic("light");
			}}
			className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${activeFilter === type ? "bg-ry-gold/10 dark:bg-slate-800 border border-ry-gold/40" : "hover:bg-ry-gold/5 dark:hover:bg-slate-800 border border-transparent"}`}
		>
			<div className="flex items-center gap-3">
				<div
					className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${activeFilter === type ? "bg-ry-gold/20 text-ry-gold dark:bg-slate-700" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-ink-400"}`}
				>
					{icon}
				</div>
				<span
					className={`font-bold text-sm ${activeFilter === type ? "text-ry-gold" : "text-slate-600 dark:text-slate-300"}`}
				>
					{label}
				</span>
			</div>
			{activeFilter === type && <Check size={18} className="text-ry-gold" />}
		</button>
	);

	const isFilterSticky = activeFilter !== "all";
	const _stickyClass = isFilterSticky
		? "sticky top-0 z-20 shadow-sm"
		: "relative";

	return (
		<div className="relative pb-2">
			{/* ── SYNCING BANNER (has data but updating) ── */}
			{isSyncing && bhajans.length > 0 && (
				<div className="px-4 py-2.5 mx-3 mt-3 mb-1 bg-ry-gold/10 border border-ry-gold/30 rounded-xl">
					<div className="flex items-center gap-3">
						<div className="w-4 h-4 rounded-full border-2 border-ry-gold border-t-transparent animate-spin shrink-0" />
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between gap-3">
								<span className="text-xs font-bold text-ry-gold">
									{settingsLanguage === "hi"
										? "☁️ भजन बैकग्राउंड में अपडेट हो रहे हैं"
										: "☁️ Bhajans are syncing in background"}
								</span>
								<span className="text-xs font-black text-ry-gold">
									{Math.round(syncProgress?.progress || 0)}%
								</span>
							</div>
							<div className="mt-1 h-1.5 w-full bg-white/60 dark:bg-slate-800 rounded-full overflow-hidden">
								<div
									className="h-full bg-ry-gold transition-all duration-300"
									style={{
										width: `${Math.max(8, syncProgress?.progress || 0)}%`,
									}}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{hasSyncError && (
				<div className="mx-3 mt-3 mb-1 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-bold text-red-700">
								{settingsLanguage === "hi"
									? "भजन सूची लोड करने में दिक्कत आई"
									: "Bhajan list had trouble loading"}
							</p>
							<p className="mt-1 text-xs text-red-600">
								{syncProgress?.detail ||
									(settingsLanguage === "hi"
										? "कृपया Fetch बटन दबाकर फिर प्रयास करें।"
										: "Please tap Fetch and try again.")}
							</p>
						</div>
						<button
							onClick={() => {
								void onRetrySync?.();
							}}
							className="shrink-0 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
						>
							{settingsLanguage === "hi" ? "Fetch करें" : "Fetch"}
						</button>
					</div>
				</div>
			)}

			{/* ── FIRST TIME LOADING (no data, fetching) ── */}
			{isSyncing && bhajans.length === 0 && (
				<div className="flex flex-col items-center justify-center h-[65vh] gap-6 animate-fade-in">
					<div className="relative">
						<div className="w-20 h-20 rounded-full bg-ry-gold/10 border-2 border-ry-gold/30 flex items-center justify-center">
							<Music className="w-9 h-9 text-ry-gold/60" />
						</div>
						<div className="absolute inset-0 rounded-full border-2 border-ry-gold border-t-transparent animate-spin" />
					</div>
					<div className="text-center">
						<p className="font-hindi font-bold text-ry-gold text-lg">
							{settingsLanguage === "hi"
								? "भजन सूची लोड हो रही है..."
								: "Loading Bhajan list..."}
						</p>
						<p className="text-slate-400 dark:text-ink-400 text-sm mt-1">
							{settingsLanguage === "hi"
								? `${Math.round(syncProgress?.progress || 0)}% पूरा${syncProgress?.detail ? ` • ${syncProgress.detail}` : ""}`
								: `${Math.round(syncProgress?.progress || 0)}% complete${syncProgress?.detail ? ` • ${syncProgress.detail}` : ""}`}
						</p>
					</div>
					<div className="flex gap-1.5">
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className="w-2 h-2 rounded-full bg-ry-gold/50 animate-bounce"
								style={{ animationDelay: `${i * 150}ms` }}
							/>
						))}
					</div>
				</div>
			)}

			{/* ── NO INTERNET + NO DATA ── */}
			{!isSyncing &&
				bhajans.length === 0 &&
				!hasSyncError &&
				!searchQuery.trim() && (
					<div className="flex flex-col items-center justify-center h-[65vh] gap-5 px-8 animate-fade-in">
						<div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
							<Music className="w-10 h-10 text-slate-300 dark:text-slate-600" />
						</div>
						<div className="text-center">
							<p className="font-hindi font-bold text-slate-700 dark:text-slate-200 text-lg">
								{settingsLanguage === "hi"
									? "भजन उपलब्ध नहीं"
									: "No Bhajans Available"}
							</p>
							<p className="text-slate-400 dark:text-ink-400 text-sm mt-2 leading-relaxed font-hindi">
								{settingsLanguage === "hi"
									? "भजन लोड करने के लिए इंटरनेट से जोड़ें।"
									: "Connect to the internet to load & save bhajans for offline use."}
							</p>
						</div>
						<div className="flex items-center gap-2 px-4 py-2.5 bg-ry-gold/10 border border-ry-gold/30 rounded-full">
							<div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
							<span className="text-xs font-bold text-ry-gold">
								{settingsLanguage === "hi"
									? "इंटरनेट से जोड़ें"
									: "Connect to Internet"}
							</span>
						</div>
						<button
							onClick={() => {
								void onRetrySync?.();
							}}
							className="rounded-full bg-ry-gold px-5 py-2.5 text-sm font-bold text-white shadow-sm"
						>
							{settingsLanguage === "hi"
								? "नवीनतम भजन Fetch करें"
								: "Fetch Latest Bhajans"}
						</button>
					</div>
				)}

			{!isSyncing &&
				bhajans.length === 0 &&
				hasSyncError &&
				!searchQuery.trim() && (
					<div className="flex flex-col items-center justify-center h-[65vh] gap-5 px-8 animate-fade-in text-center">
						<div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
							<Music className="w-10 h-10 text-red-300" />
						</div>
						<div>
							<p className="font-hindi font-bold text-slate-700 dark:text-slate-200 text-lg">
								{settingsLanguage === "hi"
									? "भजन सूची अभी लोड नहीं हो पाई"
									: "Bhajan list could not load yet"}
							</p>
							<p className="text-slate-400 dark:text-ink-400 text-sm mt-2 leading-relaxed font-hindi">
								{syncProgress?.detail ||
									(settingsLanguage === "hi"
										? "कृपया Fetch बटन दबाकर फिर प्रयास करें।"
										: "Please tap Fetch and try again.")}
							</p>
						</div>
						<button
							onClick={() => {
								void onRetrySync?.();
							}}
							className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm"
						>
							{settingsLanguage === "hi" ? "भजन Fetch करें" : "Fetch Bhajans"}
						</button>
					</div>
				)}

			{/* Search Bar Header (Sticky) */}
			{(isSearchOpen || searchQuery.trim().length > 0) && (
				<div
					className={`sticky z-30 bg-ry-cream/95 dark:bg-slate-900/95 backdrop-blur-md py-2 border-b border-ry-gold/20 flex items-center gap-2 ${headerPaddingClass} animate-in slide-in-from-top-2 duration-200 top-0 landscape:!top-0`}
				>
					<Search className="shrink-0 text-ry-gold" size={20} />
					<input
						ref={searchInputCbRef}
						className="flex-1 min-w-0 bg-transparent outline-none py-2 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
						placeholder={t.searchPlaceholder}
						value={searchQuery}
						onFocus={() => {
							if (!searchQuery.trim()) setShowRecentSearches(true);
						}}
						onChange={(e) => {
							onSearchChange(e.target.value);
							if (e.target.value.trim()) {
								setShowRecentSearches(false);
							} else {
								setShowRecentSearches(true);
							}
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && searchQuery.trim()) {
								addRecentSearch(searchQuery.trim());
								setRecentSearches(getRecentSearches());
								e.currentTarget.blur();
							}
						}}
					/>
					<VoiceSearchButton
						onResult={(text) => {
							onSearchChange(text);
							setShowRecentSearches(false);
						}}
					/>
					<button
						aria-label="Close search"
						onClick={() => {
							onSearchChange("");
							setIsSearchOpen(false);
							setShowRecentSearches(false);
							setShowAllRecent(false);
						}}
						className="shrink-0 p-2 text-slate-400 dark:text-ink-400 hover:text-red-500 transition-colors"
					>
						<X size={20} />
					</button>
					{recentSearches.length > 0 && (
						<div className="relative shrink-0">
							<button
								aria-label="Recent searches"
								data-tour="bhajans-recent"
								onClick={() => {
									setShowRecentSearches(!showRecentSearches);
									if (showRecentSearches) setShowAllRecent(false);
								}}
								className={`p-2 transition-colors ${showRecentSearches ? "text-ry-gold" : "text-slate-400 dark:text-ink-400 hover:text-ry-gold"}`}
							>
								<History size={20} />
							</button>

							{showRecentSearches && !searchQuery.trim() && (
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
												setShowAllRecent(false);
											}}
											className="text-xs text-red-500 hover:text-red-600 font-medium"
										>
											Clear
										</button>
									</div>
									<ul className="max-h-60 overflow-y-auto">
										{(showAllRecent
											? recentSearches
											: recentSearches.slice(0, 3)
										).map((term, i) => (
											<li key={i}>
												<button
													onClick={() => {
														onSearchChange(term);
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
										{!showAllRecent && recentSearches.length > 3 && (
											<li>
												<button
													onClick={() => setShowAllRecent(true)}
													className="w-full text-center px-4 py-2 text-xs text-ry-gold font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-t border-slate-100 dark:border-slate-700"
												>
													See More
												</button>
											</li>
										)}
									</ul>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* Filter Header - Updated to Cream/Gold */}
			{!searchQuery.trim() && !isSearchOpen && activeFilter !== "all" && (
				<div
					className={`${isFilterSticky ? "sticky z-20 shadow-sm top-0 landscape:!top-0" : "relative"} bg-ry-cream/95 dark:bg-slate-900/95 backdrop-blur-md py-3 border-b border-ry-gold/20 flex justify-between items-center ${headerPaddingClass}`}
				>
					<div className="flex items-center gap-2 mt-4">
						{activeFilter !== "all" && (
							<button
								onClick={() => setActiveFilter("all")}
								className="p-1.5 bg-ry-gold/10 hover:bg-ry-gold/20 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors"
							>
								<X size={14} className="text-ry-gold dark:text-ry-gold" />
							</button>
						)}
						<span
							className={`text-sm font-bold uppercase tracking-wider ${activeFilter !== "all" ? "text-ry-gold" : "text-slate-500 dark:text-ink-300"}`}
						>
							{getFilterLabel(activeFilter)}
						</span>
					</div>

					<div className="flex items-center gap-2 mt-4">
						<button
							onClick={handleOpenSearch}
							className="p-2 rounded-full transition-all active:scale-95 bg-ry-gold/10 text-ry-gold dark:bg-slate-800 hover:bg-ry-gold/20"
							data-tour="bhajans-search"
						>
							<Search size={16} />
						</button>
						<button
							onClick={() => setShowFilterModal(true)}
							className={`p-2 rounded-full transition-all active:scale-95 ${activeFilter !== "all" ? "bg-ry-gold/10 text-ry-gold dark:bg-slate-800" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-ink-300 border border-slate-200 dark:border-ink-700"}`}
							data-tour="bhajans-filter"
						>
							<Filter size={16} />
						</button>
					</div>
				</div>
			)}

			{/* Floating Filter Button - Gold styling */}
			{!searchQuery.trim() &&
				!isSearchOpen &&
				activeFilter === "all" &&
				sortedKeys.length > 0 && (
					<div
						className={`sticky z-20 flex justify-end h-0 overflow-visible pointer-events-none ${headerPaddingClass} top-0 landscape:!top-0`}
					>
						<div className="py-2 pointer-events-auto flex items-center gap-2 mt-4">
							<button
								aria-label="Search"
								data-tour="bhajans-search"
								onClick={handleOpenSearch}
								className="p-2 rounded-full text-ry-gold/80 hover:text-ry-gold hover:bg-ry-gold/10 transition-colors bg-ry-cream/90 dark:bg-slate-900/90 shadow-sm border border-ry-gold/20 backdrop-blur-sm"
							>
								<Search size={20} />
							</button>
							<button
								aria-label="Filter"
								data-tour="bhajans-filter"
								onClick={() => {
									triggerHaptic("light");
									setShowFilterModal(true);
								}}
								className="p-2 rounded-full text-ry-gold/80 hover:text-ry-gold hover:bg-ry-gold/10 transition-colors bg-ry-cream/90 dark:bg-slate-900/90 shadow-sm border border-ry-gold/20 backdrop-blur-sm"
							>
								<Filter size={20} />
							</button>
						</div>
					</div>
				)}

			{/* SEARCH RESULTS VIEW */}
			{searchQuery.trim() ? (
				<div className="pt-2 px-3 pb-20 space-y-3">
					{bhajans.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 dark:text-ink-400">
							<div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5">
								<Search className="w-10 h-10 text-slate-300 dark:text-slate-600" />
							</div>
							<p className="font-hindi font-bold text-slate-700 dark:text-slate-200 text-lg text-center px-6">
								{settingsLanguage === "hi"
									? "भजन नहीं मिला"
									: "No Bhajans Found"}
							</p>
							<p className="text-slate-400 dark:text-ink-400 text-sm mt-2 leading-relaxed font-hindi text-center px-6">
								{settingsLanguage === "hi"
									? "कृपया भजन का नाम या स्पेलिंग सही से टाइप करें।"
									: "Please check the spelling and try typing correctly."}
							</p>
						</div>
					) : (
						bhajans.slice(0, renderCount).map((bhajan) => (
							<BhajanItem
								key={bhajan.id}
								bhajan={bhajan}
								script={script}
								searchQuery={searchQuery}
								onSelect={(b) => {
									if (searchQuery.trim()) {
										addRecentSearch(searchQuery);
										setRecentSearches(getRecentSearches());
									}
									onSelect(b);
								}}
								knownAuthors={knownAuthors}
							/>
						))
					)}
				</div>
			) : (
				/* STANDARD / FILTERED LIST VIEW */
				<div className="px-0 space-y-4">
					{sortedKeys.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-ink-400">
							<Filter className="w-12 h-12 opacity-20 mb-2" />
							<p>No bhajans in this category</p>
							{activeFilter.startsWith("playlist-") && (
								<p className="text-xs mt-2">Add songs from the reader view</p>
							)}
						</div>
					) : (
						(() => {
							let currentCount = 0;
							return sortedKeys.map((key) => {
								if (currentCount >= renderCount) return null;
								const groupItems = groupedBhajans[key];
								const itemsToRender = groupItems.slice(
									0,
									renderCount - currentCount,
								);
								currentCount += itemsToRender.length;

								if (itemsToRender.length === 0) return null;

								return (
									<div key={key} id={`section-${key}`} className="scroll-mt-28">
										{/* Alphabet Section Headers - Gold themed */}
										{activeFilter === "all" && (
											<div
												className={`sticky z-10 bg-ry-cream/95 dark:bg-slate-950/95 backdrop-blur-md py-2 border-b border-dashed border-ry-gold/30 text-ry-gold text-sm font-black uppercase tracking-widest flex items-center justify-between ${headerPaddingClass} top-0 landscape:!top-0`}
											>
												<span className="bg-ry-gold/10 dark:bg-slate-800 w-8 h-8 flex items-center justify-center rounded-lg shadow-sm border border-ry-gold/20 dark:border-slate-700">
													{key}
												</span>
											</div>
										)}
										<ul className="divide-y divide-slate-100 dark:divide-slate-800/50">
											{itemsToRender.map((bhajan) => (
												<SimpleBhajanItem
													key={bhajan.id}
													bhajan={bhajan}
													script={script}
													onSelect={onSelect}
													paddingClass={listPaddingClass}
													knownAuthors={knownAuthors}
												/>
											))}
										</ul>
									</div>
								);
							});
						})()
					)}
				</div>
			)}

			{/* AZ Slider */}
			{!searchQuery && activeFilter === "all" && (
				<AzSlider
					sortedKeys={sortedKeys}
					onSelect={scrollToSection}
					indexMode={indexMode}
					onToggleMode={() => {
						triggerHaptic("light");
						onIndexModeChange(indexMode === "latin" ? "devanagari" : "latin");
					}}
					side={azSliderSide}
				/>
			)}

			{/* Filter Modal - Redesigned for Gold Theme */}
			{(showFilterModal || tourFilterPreview) &&
				createPortal(
					<div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
						<div className="bg-ry-cream dark:bg-slate-900 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col border border-ry-gold/20">
							<div className="flex items-center justify-between p-5 border-b border-ry-gold/20 bg-ry-cream dark:bg-slate-900 rounded-t-3xl">
								<div className="flex items-center gap-3">
									<h3 className="font-bold text-lg text-ry-gold dark:text-white">
										{t.filterTitle}
									</h3>
									{onSettingsLanguageChange && (
										<button
											data-tour="bhajans-filter-lang"
											onClick={() => {
												triggerHaptic("light");
												onSettingsLanguageChange(
													settingsLanguage === "en" ? "hi" : "en",
												);
											}}
											className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-ry-gold/10 dark:bg-slate-800 text-ry-gold dark:text-ry-gold hover:bg-ry-gold/20 transition-colors"
										>
											<Languages size={14} />
											<span className="text-xs font-bold uppercase">
												{settingsLanguage === "en" ? "HI" : "EN"}
											</span>
										</button>
									)}
								</div>
								<button
									aria-label="Close"
									onClick={() => handleCloseFilterModal()}
									className="p-2 bg-ry-gold/10 dark:bg-slate-800 rounded-full text-ry-gold hover:bg-ry-gold/20 transition-colors"
								>
									<X size={20} />
								</button>
							</div>

							<div
								className={`flex-1 overflow-y-auto ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-5 space-y-6`}
							>
								<div dir={scrollBarSide === "left" ? "ltr" : undefined}>
									{/* Section 1: Nitya Kriya */}
									<div className="mb-6" data-tour="bhajans-filter-nitya">
										<h4 className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase mb-3 px-1 tracking-wider">
											{t.nityaKriya}
										</h4>
										<div className="grid grid-cols-2 gap-3">
											{/* Morning Button */}
											<button
												onClick={() => {
													setActiveFilter("morning");
													handleCloseFilterModal();
												}}
												className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 shadow-sm ${activeFilter === "morning" ? "bg-ry-gold/10 border-ry-gold/40 text-ry-gold" : "bg-white dark:bg-slate-800 border-ry-gold/20 text-slate-500 dark:text-ink-300 hover:border-ry-gold/40"}`}
											>
												<Sun
													size={28}
													className={
														activeFilter === "morning"
															? "text-ry-gold"
															: "text-ry-gold/70"
													}
												/>
												<span className="text-xs font-bold">{t.morning}</span>
											</button>
											{/* Evening Button */}
											<button
												onClick={() => {
													setActiveFilter("evening");
													handleCloseFilterModal();
												}}
												className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 shadow-sm ${activeFilter === "evening" ? "bg-ry-gold/10 border-ry-gold/40 text-ry-gold" : "bg-white dark:bg-slate-800 border-ry-gold/20 text-slate-500 dark:text-ink-300 hover:border-ry-gold/40"}`}
											>
												<Moon
													size={28}
													className={
														activeFilter === "evening"
															? "text-ry-gold"
															: "text-ry-gold/70"
													}
												/>
												<span className="text-xs font-bold">{t.evening}</span>
											</button>
										</div>
									</div>

									{/* Section 2: My Collections */}
									<div className="mb-6" data-tour="bhajans-filter-collections">
										<h4 className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase mb-3 px-1 tracking-wider">
											{t.collections}
										</h4>
										<div className="flex flex-wrap gap-2">
											{playlists.map((p) => (
												<button
													key={p.id}
													onClick={() => {
														setActiveFilter(`playlist-${p.id}`);
														handleCloseFilterModal();
													}}
													className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors shadow-sm ${activeFilter === `playlist-${p.id}` ? "bg-ry-gold/10 text-ry-gold border-ry-gold/40" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-ink-300 border-ry-gold/20 hover:bg-ry-gold/5"}`}
												>
													{p.name}
												</button>
											))}

											{!isCreatingPlaylist ? (
												<button
													onClick={() => setIsCreatingPlaylist(true)}
													className="px-4 py-2 rounded-full text-xs font-bold bg-ry-gold/10 text-ry-gold border border-ry-gold/30 flex items-center gap-1 hover:bg-ry-gold/20 transition-colors"
												>
													<Plus size={14} /> {t.customList}
												</button>
											) : (
												<div className="flex gap-1 w-full animate-in fade-in mt-1">
													<input
														className="flex-1 px-4 py-2 rounded-full text-xs bg-white dark:bg-slate-800 outline-none border border-ry-gold/40 text-ry-gold placeholder:text-ry-gold/50 shadow-sm"
														placeholder={t.listName}
														value={newPlaylistName}
														onChange={(e) => setNewPlaylistName(e.target.value)}
													/>
													<button
														onClick={handleCreatePlaylist}
														className="px-4 py-2 bg-ry-gold text-white rounded-full text-xs font-bold shadow-md hover:brightness-110"
													>
														{t.add}
													</button>
													<button
														onClick={() => setIsCreatingPlaylist(false)}
														className="px-2 text-slate-400 dark:text-ink-400 hover:text-red-500"
													>
														<X size={16} />
													</button>
												</div>
											)}
										</div>
									</div>

									{/* Section 3: Categories */}
									<div data-tour="bhajans-filter-categories">
										<h4 className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase mb-3 px-1 tracking-wider">
											{t.categories}
										</h4>
										<div className="space-y-2">
											<FilterOption
												type="all"
												label={t.allBhajans}
												icon={<ListMusic size={20} />}
											/>
											{activeCategories.map((cat) => (
												<FilterOption
													key={cat.id}
													type={cat.id}
													label={
														settingsLanguage === "hi"
															? cat.labelHi
															: cat.labelEn
													}
													icon={CATEGORY_ICON_MAP[cat.id] || <Tag size={20} />}
												/>
											))}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Floating Voice Search FAB — portaled to <body> like the A–Z bar, so
			    the tab's slide-in transform can't put it in the wrong place.
			    z-20 keeps it under the header, bottom nav and mini player, as it
			    was when it sat inside <main>. */}
			{createPortal(
				<div
					className={`fixed z-20 transition-all duration-500 ease-in-out right-4 landscape:right-[calc(6.5rem+env(safe-area-inset-right))] ${currentBhajan ? "bottom-[calc(11.5rem+env(safe-area-inset-bottom))] landscape:bottom-[calc(6rem+env(safe-area-inset-bottom))]" : "bottom-[calc(7rem+env(safe-area-inset-bottom))] landscape:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"}`}
				>
					<div
						className="w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all group"
						data-tour="bhajans-voice"
						style={{
							backgroundColor: "var(--color-primary-600)",
							boxShadow: "0 4px 15px var(--color-primary-600)",
						}}
					>
						<VoiceSearchButton
							onResult={(text) => {
								onSearchChange(text);
								setShowRecentSearches(false);
							}}
							size={24}
							className="!text-white"
						/>
					</div>
				</div>,
				document.body,
			)}
		</div>
	);
};

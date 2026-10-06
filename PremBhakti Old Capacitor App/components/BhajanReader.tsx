import { Capacitor } from "@capacitor/core";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	ArrowLeft,
	BookOpen,
	Check,
	CheckSquare,
	Download,
	Hash,
	Layout,
	Link,
	Loader2,
	Maximize,
	Moon,
	Music,
	Pause,
	Play,
	PlayCircle,
	Plus,
	RotateCcw,
	Save,
	Share2,
	Square,
	Star,
	Sun,
	Type,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAudio } from "../context/AudioContext";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import type {
	Bhajan,
	BhajanAudio,
	DownloadItem,
	FontSize,
	Playlist,
	ScriptType,
} from "../types";
import { useAdminBack } from "../src/hooks/useAdminBack";
import { isTrackDownloaded } from "../utils/audioStorage";
import { triggerHaptic } from "../utils/haptic";
import {
	KeepAwakeOwner,
	releaseKeepAwake,
	setKeepAwakeFor,
} from "../utils/keepAwakeManager";
import { shareAppContent } from "../utils/shareService";

interface BhajanReaderProps {
	bhajan: Bhajan;
	onBack: () => void;
	fontSize: FontSize;
	onChangeFontSize: (size: FontSize) => void;
	searchQuery: string;
	script: ScriptType;
	darkMode: boolean;
	onToggleTheme: () => void;
	keepAwake: boolean;
	devMode: boolean;
	onSave?: (id: string, title: string, content: string) => void;
	onDelete?: (id: string) => void;
	autoEdit?: boolean;
	scrollBarSide?: "left" | "right";
	activeDownloads?: Record<string, DownloadItem>;
	onDownloadTrack?: (track: BhajanAudio, title: string) => void;

	// Playlist Props
	playlists?: Playlist[];
	onAddToPlaylist?: (playlistId: string, bhajanId: string) => void;
	onRemoveFromPlaylist?: (playlistId: string, bhajanId: string) => void;
	onCreatePlaylist?: (name: string) => void;

	// Context Queue for Playlist Playback
	contextQueue?: BhajanAudio[];
	queueName?: string; // New Prop
	settingsLanguage: "en" | "hi";
	onOpenAudioScreen?: () => void;
	// Admin editor preview: shows an unsaved draft exactly as readers will see
	// it. Personal edits saved on this device are not applied, Save/Share are
	// hidden, and nothing pushes browser history (the admin panel owns Back).
	previewMode?: boolean;
}

type ViewFormat = "center" | "left" | "justify" | "wide-center" | "wide-left";

export const BhajanReader: React.FC<BhajanReaderProps> = ({
	bhajan,
	onBack,
	fontSize,
	onChangeFontSize,
	searchQuery,
	script,
	darkMode,
	onToggleTheme,
	keepAwake,
	devMode,
	onSave,
	onDelete,
	autoEdit = false,
	scrollBarSide = "left",
	activeDownloads,
	onDownloadTrack,
	playlists = [],
	onAddToPlaylist,
	onRemoveFromPlaylist,
	onCreatePlaylist,
	contextQueue,
	queueName,
	settingsLanguage,
	onOpenAudioScreen,
	previewMode = false,
}) => {
	const contentRef = useRef<HTMLDivElement>(null);
	const { showToast } = useToast();
	const { knownAuthors } = useData();
	const {
		setQueueOpen,
		playTrack,
		currentTrack,
		isPlaying,
		isLoading,
		togglePlay,
		progress,
		duration,
		seek,
		closePlayer,
	} = useAudio();
	const isIOSWeb =
		typeof window !== "undefined" &&
		Capacitor.getPlatform() === "web" &&
		(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
			(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

	// States for editing
	const [isEditing, setIsEditing] = useState(autoEdit);
	const [isPersonalEdit, setIsPersonalEdit] = useState(false);

	// Content states - Initialize with actual content to prevent empty state flash
	const [editedTitle, setEditedTitle] = useState(() => {
		const personalKey = `cpbs_personal_${bhajan.id}`;
		try {
			const savedPersonal = previewMode
				? null
				: localStorage.getItem(personalKey);
			if (savedPersonal) {
				const parsed = JSON.parse(savedPersonal);
				return (
					parsed.title || (script === "iast" ? bhajan.titleIAST : bhajan.title)
				);
			}
		} catch (_e) {}
		return script === "iast" ? bhajan.titleIAST : bhajan.title;
	});

	const [editedContent, setEditedContent] = useState(() => {
		const personalKey = `cpbs_personal_${bhajan.id}`;
		try {
			const savedPersonal = previewMode
				? null
				: localStorage.getItem(personalKey);
			if (savedPersonal) {
				const parsed = JSON.parse(savedPersonal);
				return (
					parsed.content ||
					(script === "iast" ? bhajan.contentIAST : bhajan.content)
				);
			}
		} catch (_e) {}
		return script === "iast" ? bhajan.contentIAST : bhajan.content;
	});

	// Derived Author Name — looks up full display name from knownAuthors
	const authorName = (() => {
		if (!bhajan.author) return null;
		if (script === "iast") {
			// English mode: use IAST name from knownAuthors, fallback to authorIAST field, then raw key
			return (
				knownAuthors[bhajan.author]?.iast || bhajan.authorIAST || bhajan.author
			);
		}
		// Hindi mode: use Devanagari display name from knownAuthors, fallback to raw key
		return knownAuthors[bhajan.author]?.deva || bhajan.author;
	})();

	// UI States
	const [showFontPanel, setShowFontPanel] = useState(false);
	const [lineGap, setLineGap] = useState(() =>
		parseInt(localStorage.getItem("cpbs_line_gap") || "0", 10),
	);
	const [showHeaderTitle, setShowHeaderTitle] = useState(false);
	const [showShareConfirm, setShowShareConfirm] = useState(false);
	const [showPlaylistModal, setShowPlaylistModal] = useState(false);
	const [newPlaylistName, setNewPlaylistName] = useState("");
	const [showAudioList, setShowAudioList] = useState(false);

	// Push history when audio list popup opens so back button closes it, not the reader
	useEffect(() => {
		if (showAudioList && !previewMode)
			window.history.pushState({ isPopup: true, view: "audio-list" }, "");
	}, [showAudioList, previewMode]);

	// In the admin preview, Back closes the audio list / font panel first,
	// then the preview (the admin panel owns the history entry).
	useAdminBack(previewMode && showFontPanel, () => setShowFontPanel(false));
	useAdminBack(previewMode && showAudioList, () => setShowAudioList(false));

	useEffect(() => {
		const handler = (e: PopStateEvent) => {
			if (showAudioList && e.state?.view !== "audio-list")
				setShowAudioList(false);
		};
		window.addEventListener("popstate", handler);
		return () => window.removeEventListener("popstate", handler);
	}, [showAudioList]);

	const handleCloseAudioList = () => {
		if (window.history.state?.view === "audio-list") window.history.back();
		else setShowAudioList(false);
	};

	// Back-button support for Share & Playlist popups
	useEffect(() => {
		if (showShareConfirm)
			window.history.pushState({ isPopup: true, view: "share-confirm" }, "");
	}, [showShareConfirm]);

	useEffect(() => {
		if (showPlaylistModal)
			window.history.pushState({ isPopup: true, view: "playlist-modal" }, "");
	}, [showPlaylistModal]);

	useEffect(() => {
		const handler = (e: PopStateEvent) => {
			const view = e.state?.view;
			if (showShareConfirm && view !== "share-confirm")
				setShowShareConfirm(false);
			if (showPlaylistModal && view !== "playlist-modal")
				setShowPlaylistModal(false);
		};
		window.addEventListener("popstate", handler);
		return () => window.removeEventListener("popstate", handler);
	}, [showShareConfirm, showPlaylistModal]);

	const handleCloseShareConfirm = () => {
		if (window.history.state?.view === "share-confirm") window.history.back();
		else setShowShareConfirm(false);
	};

	const handleClosePlaylistModal = () => {
		if (window.history.state?.view === "playlist-modal") window.history.back();
		else setShowPlaylistModal(false);
	};

	// BookMode States (Now Persistent)
	const [isBookMode, setIsBookMode] = useState(
		() => localStorage.getItem("cpbs_reader_bookmode") === "true",
	);
	const [bookScale, setBookScale] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });

	// Check if bhajan is in ANY playlist
	const isLiked = playlists.some((p) => p.items.includes(bhajan.id));
	const isPlayingCurrentBhajan =
		currentTrack && bhajan.audio?.some((a) => a.id === currentTrack.id);

	// View Format State
	const [viewFormat, setViewFormat] = useState<ViewFormat>(
		() => (localStorage.getItem("cpbs_view_format") as ViewFormat) || "center",
	);

	// Pinch/Drag Zoom Refs
	const touchStartDist = useRef<number | null>(null);
	const startFontSizeRef = useRef<number>(fontSize);
	const startLineGapRef = useRef<number>(lineGap);
	const startBookScaleRef = useRef<number>(1);

	const isDragging = useRef(false);
	const dragStart = useRef({ x: 0, y: 0 });

	const isHindi = settingsLanguage === "hi";

	const formatDuration = (seconds?: number) => {
		if (!seconds) return "";
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, "0")}`;
	};

	const t = {
		cancel: isHindi ? "रद्द करें" : "Cancel",
		confirm: isHindi ? "पुष्टि करें" : "Confirm",
		shareTitle: isHindi ? "भजन शेयर करें" : "Share Bhajan",
		shareLink: isHindi ? "लिंक शेयर करें" : "Share Link",
		savePlaylists: isHindi ? "प्लेलिस्ट में सहेजें" : "Save to Playlists",
		newPlaylist: isHindi ? "नई प्लेलिस्ट" : "New Playlist Name",
		done: isHindi ? "हो गया" : "Done",
		songs: isHindi ? "भजन" : "songs",
		noPlaylists: isHindi ? "कोई प्लेलिस्ट नहीं।" : "No playlists yet.",
	};

	// --- Screen Wake Lock Logic ---
	//
	// Goes through keepAwakeManager rather than calling the plugin directly. The
	// underlying Android FLAG_KEEP_SCREEN_ON is a single global window flag, so
	// this cleanup used to switch the screen off from under an active playback
	// session that still wanted it on. The manager only clears the flag once
	// every holder — this reader and AudioContext — has released it.
	useEffect(() => {
		setKeepAwakeFor(KeepAwakeOwner.BHAJAN_READER, keepAwake);

		return () => {
			releaseKeepAwake(KeepAwakeOwner.BHAJAN_READER);
		};
	}, [keepAwake]);

	// Load content updates when bhajan or script changes (if not personal)
	useEffect(() => {
		const personalKey = `cpbs_personal_${bhajan.id}`;
		const savedPersonal = previewMode ? null : localStorage.getItem(personalKey);

		if (savedPersonal) {
			try {
				const parsed = JSON.parse(savedPersonal);
				setEditedTitle(parsed.title);
				setEditedContent(parsed.content);
			} catch (_e) {
				setEditedTitle(script === "iast" ? bhajan.titleIAST : bhajan.title);
				setEditedContent(
					script === "iast" ? bhajan.contentIAST : bhajan.content,
				);
			}
		} else {
			setEditedTitle(script === "iast" ? bhajan.titleIAST : bhajan.title);
			setEditedContent(script === "iast" ? bhajan.contentIAST : bhajan.content);
		}
	}, [bhajan, script, previewMode]);

	useEffect(() => {
		localStorage.setItem("cpbs_line_gap", String(lineGap));
	}, [lineGap]);

	useEffect(() => {
		localStorage.setItem("cpbs_view_format", viewFormat);
	}, [viewFormat]);

	// Persist Book Mode
	useEffect(() => {
		localStorage.setItem("cpbs_reader_bookmode", String(isBookMode));
	}, [isBookMode]);

	useEffect(() => {
		const handleScroll = () => {
			if (contentRef.current)
				setShowHeaderTitle(contentRef.current.scrollTop > 60);
		};
		const el = contentRef.current;
		el?.addEventListener("scroll", handleScroll, { passive: true });
		return () => el?.removeEventListener("scroll", handleScroll);
	}, []);

	// Helper to clamp pan values to keep content in view (relaxed for free movement)
	const getClampedPan = (x: number, y: number, scale: number) => {
		if (!contentRef.current) return { x, y };

		const container = contentRef.current;
		const content = container.firstElementChild as HTMLElement;

		if (!content) return { x, y };

		const cW = container.clientWidth;
		const cH = container.clientHeight;
		// Use offset dimensions of the inner content wrapper
		const contentW = content.offsetWidth;
		const contentH = content.offsetHeight;

		const scaledW = contentW * scale;
		const scaledH = contentH * scale;

		// Safety margin to allow dragging content almost entirely off screen but keeping a handle
		// This allows free movement and prevents getting "stuck" at edges when zooming
		const margin = 100;

		// Calculate bounds such that at least 'margin' pixels of content remain visible on relevant sides
		// or allows empty space up to 'margin' if content is small.
		// Essentially allowing "Free Pan" behavior.

		const minX = cW - scaledW - margin;
		const maxX = margin;

		// If content is smaller than screen, these bounds might cross.
		// We relax it to allow centering or placing anywhere.
		const effectiveMinX = Math.min(minX, 0 - scaledW + margin); // Ensure we can drag far left
		const effectiveMaxX = Math.max(maxX, cW - margin); // Ensure we can drag far right

		// Vertical bounds
		const minY = cH - scaledH - margin;
		const maxY = margin;

		const effectiveMinY = Math.min(minY, 0 - scaledH + margin);
		const effectiveMaxY = Math.max(maxY, cH - margin);

		return {
			x: Math.min(Math.max(x, effectiveMinX), effectiveMaxX),
			y: Math.min(Math.max(y, effectiveMinY), effectiveMaxY),
		};
	};

	// --- Touch Handlers (Pinch Zoom + Drag) ---
	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length === 2) {
			// Pinch Start
			const dist = Math.hypot(
				e.touches[0].clientX - e.touches[1].clientX,
				e.touches[0].clientY - e.touches[1].clientY,
			);
			touchStartDist.current = dist;

			if (isBookMode) {
				startBookScaleRef.current = bookScale;
			} else {
				startFontSizeRef.current = fontSize;
				startLineGapRef.current = lineGap;
			}
		} else if (e.touches.length === 1 && isBookMode) {
			// Drag Start (Allowed even at 100% zoom)
			isDragging.current = true;
			dragStart.current = {
				x: e.touches[0].clientX - pan.x,
				y: e.touches[0].clientY - pan.y,
			};
		}
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (e.touches.length === 2 && touchStartDist.current !== null) {
			// Pinch Move
			if (e.cancelable) e.preventDefault();

			const dist = Math.hypot(
				e.touches[0].clientX - e.touches[1].clientX,
				e.touches[0].clientY - e.touches[1].clientY,
			);
			const scale = dist / touchStartDist.current;

			if (isBookMode) {
				let newScale = startBookScaleRef.current * scale;
				newScale = Math.max(1, Math.min(4, newScale));
				setBookScale(newScale);
			} else {
				let newSize = startFontSizeRef.current * scale;
				newSize = Math.max(12, Math.min(60, newSize));
				onChangeFontSize(Math.round(newSize));

				let newGap = startLineGapRef.current * scale;
				newGap = Math.max(0, Math.min(16, newGap));
				setLineGap(Math.round(newGap));
			}
		} else if (e.touches.length === 1 && isDragging.current && isBookMode) {
			// Drag Move
			if (e.cancelable) e.preventDefault();
			const rawX = e.touches[0].clientX - dragStart.current.x;
			const rawY = e.touches[0].clientY - dragStart.current.y;

			const clamped = getClampedPan(rawX, rawY, bookScale);
			setPan(clamped);
		}
	};

	const handleTouchEnd = (_e: React.TouchEvent) => {
		touchStartDist.current = null;
		isDragging.current = false;
	};

	// --- Mouse Handlers (Desktop Drag & Wheel) ---
	const handleMouseDown = (e: React.MouseEvent) => {
		if (isBookMode) {
			e.preventDefault();
			isDragging.current = true;
			dragStart.current = {
				x: e.clientX - pan.x,
				y: e.clientY - pan.y,
			};
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging.current && isBookMode) {
			e.preventDefault();
			const rawX = e.clientX - dragStart.current.x;
			const rawY = e.clientY - dragStart.current.y;

			const clamped = getClampedPan(rawX, rawY, bookScale);
			setPan(clamped);
		}
	};

	const handleMouseUp = () => {
		isDragging.current = false;
	};

	const handleWheel = (e: React.WheelEvent) => {
		if (!isBookMode) return;
		// Simple wheel zoom logic
		const delta = -e.deltaY * 0.001;
		setBookScale((prev) => Math.min(Math.max(1, prev + delta), 4));
	};

	const toggleBookMode = () => {
		const newVal = !isBookMode;
		setIsBookMode(newVal);
		// Reset scale and pan when toggling
		if (!newVal) {
			setBookScale(1);
			setPan({ x: 0, y: 0 });
		}
	};

	const executeShare = async () => {
		handleCloseShareConfirm();
		triggerHaptic("light");

		// Extract first 2 non-empty lines (excluding subheadings) for preview
		const contentLines = editedContent
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "" && !line.startsWith("#"));
		const previewLines = contentLines.slice(0, 2).join("\n");

		const isLecture =
			bhajan.id.startsWith("lecture-") || bhajan.id.startsWith("lecture_");
		const paramName = isLecture ? "bhajanId" : "bhajanId"; // always use bhajanId; deep link handler auto-detects lecture_ prefix
		const cleanId = bhajan.id
			.replace(/^bhajan[_-]/i, "")
			.replace(/^lecture[_-]/i, "");
		// For lectures: use "lecture_" prefix so the deep link handler auto-detects the type.
		// For bhajans: use song number or clean id.
		const finalId = isLecture
			? `lecture_${cleanId}`
			: (bhajan.songNumber ?? cleanId);
		const deepLinkUrl = `https://chaitanyaprembhakti.org/?${paramName}=${finalId}`;
		const baseShareText = isHindi
			? "🙏 और पढ़ने तथा ऑडियो के लिए इस लिंक पर क्लिक करें 👇"
			: "🙏 To read more and listen audio click this link 👇";

		// Construct final share message
		const fullShareMessage = `${editedTitle}\n\n${previewLines}\n\n${baseShareText}`;

		await shareAppContent(
			{
				title: editedTitle,
				text: fullShareMessage,
				url: deepLinkUrl,
				dialogTitle: isHindi ? "भजन शेयर करें" : "Share Bhajan",
			},
			() => {
				showToast(isHindi ? "लिंक कॉपी हो गया!" : "Link copied!");
			},
		);
	};

	const savePersonalized = () => {
		triggerHaptic("medium");
		localStorage.setItem(
			`cpbs_personal_${bhajan.id}`,
			JSON.stringify({
				title: editedTitle,
				content: editedContent,
			}),
		);
		setIsPersonalEdit(false);
		setIsEditing(false);
	};

	const handleSystemSave = () => {
		triggerHaptic("heavy");
		onSave?.(bhajan.id, editedTitle, editedContent);
		setIsEditing(false);
		setIsPersonalEdit(false);
	};

	const toggleViewFormat = () => {
		triggerHaptic("light");
		const formats: ViewFormat[] = [
			"center",
			"left",
			"justify",
			"wide-center",
			"wide-left",
		];
		const nextIndex = (formats.indexOf(viewFormat) + 1) % formats.length;
		setViewFormat(formats[nextIndex]);
	};

	const getViewIcon = () => {
		switch (viewFormat) {
			case "left":
				return <AlignLeft size={22} />;
			case "justify":
				return <AlignJustify size={22} />;
			case "wide-center":
				return <Maximize size={22} />;
			case "wide-left":
				return <Layout size={22} />;
			default:
				return <AlignCenter size={22} />;
		}
	};

	const handleTogglePlaylist = (playlist: Playlist) => {
		const isAdded = playlist.items.includes(bhajan.id);
		if (isAdded) {
			if (onRemoveFromPlaylist) onRemoveFromPlaylist(playlist.id, bhajan.id);
		} else {
			if (onAddToPlaylist) onAddToPlaylist(playlist.id, bhajan.id);
		}
		triggerHaptic("light");
	};

	const handleCreateAndAdd = () => {
		if (newPlaylistName.trim() && onCreatePlaylist && onAddToPlaylist) {
			onCreatePlaylist(newPlaylistName.trim());
			setNewPlaylistName("");
		}
	};

	const renderFormattedContent = (content: string) => {
		const alignClass =
			viewFormat.includes("left") || viewFormat === "wide-left"
				? "text-left"
				: viewFormat === "justify"
					? "text-justify"
					: "text-center";

		const subheadingJustify =
			viewFormat.includes("left") || viewFormat === "wide-left"
				? "justify-start"
				: "justify-center";

		return content.split("\n").map((line, index) => {
			const trimmed = line.trim();
			if (!trimmed) return <div key={index} className="h-4" />;

			if (
				trimmed.startsWith("#") &&
				trimmed.endsWith("#") &&
				trimmed.length > 1
			) {
				const text = trimmed.slice(1, -1).trim();
				const processedLine = text
					.replace(/।।/g, "॥")
					.replace(/\s+([।॥])/g, "\u00A0$1");

				return (
					<div key={index} className={`flex ${subheadingJustify} my-2 px-2`}>
						<div
							className={`
              text-center px-4 py-1 rounded-lg border-y border-x-[3px] shadow-sm
              ${
								darkMode
									? "bg-ink-900 border-saffron-500"
									: "bg-saffron-50 border-saffron-400"
							}
            `}
						>
							<span
								className={`
                font-hindi font-bold text-sm tracking-wider
                ${darkMode ? "text-saffron-500" : "text-saffron-800"}
              `}
							>
								{processedLine}
							</span>
						</div>
					</div>
				);
			}

			const processedLine = trimmed
				.replace(/।।/g, "॥")
				.replace(/\s+([।॥])/g, "\u00A0$1");
			const hasDoubleDanda = processedLine.includes("॥");

			return (
				<div
					key={index}
					className={`
                ${alignClass} px-1 font-hindi text-slate-800 dark:text-slate-200 select-none font-bold
                ${hasDoubleDanda ? "border-b-[1.5px] border-saffron-400 dark:border-saffron-600" : ""}
            `}
					style={{
						lineHeight: Math.max(1.6, 1.5 + (fontSize - 20) * 0.02),
						paddingBottom: hasDoubleDanda ? "4px" : `${lineGap * 4}px`,
						marginBottom: hasDoubleDanda ? `${lineGap * 4 + 4}px` : "0px",
					}}
				>
					{processedLine}
				</div>
			);
		});
	};

	const maxWidthClass = viewFormat.startsWith("wide")
		? "max-w-full"
		: "max-w-3xl";
	const isLeftAligned =
		viewFormat.includes("left") || viewFormat === "wide-left";

	// Logic to adjust right spacing for zoom controls in landscape
	const showAudioSidebar =
		!(isEditing || isPersonalEdit) && bhajan.audio && bhajan.audio.length > 0;

	return (
		<div className="fixed inset-0 bg-paper dark:bg-slate-950 z-50 flex flex-col h-full w-full animate-in slide-in-from-bottom duration-300 landscape:flex-row">
			{/* Header Bar - Increased Z-Index to 30 */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-2 pt-[calc(0.5rem+env(safe-area-inset-top))] flex items-center justify-between z-30 relative landscape:w-16 landscape:h-full landscape:flex-col landscape:border-b-0 landscape:border-r landscape:pt-[env(safe-area-inset-top)]">
				{/* Left Actions - Removed Title from here to prevent crowding */}
				<div className="flex items-center gap-3 shrink-0 landscape:flex-col landscape:flex-none">
					<button
						onClick={onBack}
						className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all duration-200 shrink-0"
						data-tour="reader-back"
					>
						<ArrowLeft
							size={24}
							className="text-slate-700 dark:text-slate-200"
						/>
					</button>
					{previewMode && (
						<span className="px-2 py-0.5 rounded-full bg-white/25 text-white text-[10px] font-bold uppercase tracking-wider landscape:px-1 landscape:text-[9px] landscape:tracking-normal">
							{isHindi ? "पूर्वावलोकन" : "Preview"}
						</span>
					)}
				</div>

				{/* Right Actions */}
				<div className="flex items-center gap-1 shrink-0 landscape:flex-col landscape:gap-4 landscape:pb-4">
					{(isEditing || isPersonalEdit) && (
						<button
							onClick={isEditing ? handleSystemSave : savePersonalized}
							className="p-2.5 text-green-600 active:scale-90 transition-transform duration-200"
						>
							<Save size={22} />
						</button>
					)}

					<button
						onClick={toggleViewFormat}
						data-tour="reader-view"
						className="p-2.5 text-slate-500 dark:text-ink-300 active:text-saffron-500 active:scale-90 transition-all duration-200"
					>
						{getViewIcon()}
					</button>

					<button
						onClick={() => {
							triggerHaptic("light");
							setShowFontPanel(!showFontPanel);
						}}
						data-tour="reader-font"
						className={`p-2.5 active:scale-90 transition-all duration-200 ${showFontPanel ? "text-saffron-500" : "text-slate-500 dark:text-ink-300"}`}
					>
						<Type size={22} />
					</button>
					<button
						onClick={() => {
							triggerHaptic("light");
							onToggleTheme();
						}}
						data-tour="reader-theme"
						className="p-2.5 text-slate-500 dark:text-ink-300 active:scale-90 transition-all duration-200"
					>
						{darkMode ? <Sun size={22} /> : <Moon size={22} />}
					</button>
				</div>
			</div>

			{/* Secondary Header (Title & Author) - Slides from under top bar */}
			<div
				className={`absolute left-0 right-0 z-20 flex flex-col items-start justify-center py-1 px-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b dark:border-slate-800 shadow-sm transition-all duration-300 ease-in-out landscape:hidden ${
					showHeaderTitle || isEditing || isPersonalEdit
						? "translate-y-0 opacity-100"
						: "-translate-y-full opacity-0 pointer-events-none"
				}`}
				style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
			>
				{authorName && (
					<div className="text-[8px] font-hindi font-bold text-saffron-600 dark:text-saffron-400 truncate uppercase tracking-wider mb-0 w-full text-left">
						{authorName}
					</div>
				)}
				<div className="font-hindi font-bold text-base text-slate-800 dark:text-slate-100 w-full text-right leading-tight truncate">
					{isEditing || isPersonalEdit ? (
						<span className="pointer-events-auto border-b border-saffron-400 pb-0.5">
							{editedTitle || "Bhajan Title"}
						</span>
					) : (
						editedTitle
					)}
				</div>
			</div>

			{showFontPanel && (
				<div className="absolute top-[calc(4rem+env(safe-area-inset-top))] right-2 z-40 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 w-72 border dark:border-slate-700 animate-pop landscape:left-[17rem] landscape:right-auto landscape:top-4">
					<div className="space-y-4">
						<div>
							<div className="flex justify-between text-xs font-bold mb-2 uppercase text-slate-400 dark:text-ink-400">
								Size: {fontSize}px
							</div>
							<input
								type="range"
								min="12"
								max="60"
								step="2"
								value={fontSize}
								onChange={(e) => onChangeFontSize(parseInt(e.target.value, 10))}
								className="w-full h-1.5 accent-saffron-500 rounded-lg appearance-none bg-slate-100 dark:bg-slate-700"
							/>
						</div>

						<div className="pt-2 border-t dark:border-slate-700">
							<div className="flex justify-between text-xs font-bold mb-2 uppercase text-slate-400 dark:text-ink-400">
								Spacing
								<span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 rounded text-[10px]">
									{lineGap}
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="16"
								step="1"
								value={lineGap}
								onChange={(e) => setLineGap(parseInt(e.target.value, 10))}
								className="w-full h-1.5 accent-saffron-500 rounded-lg appearance-none bg-slate-100 dark:bg-slate-700"
							/>
						</div>

						<div className="flex items-center justify-between pt-2 border-t dark:border-slate-700">
							<div className="flex items-center gap-1.5">
								<BookOpen
									size={14}
									className="text-slate-400 dark:text-ink-400"
								/>
								<span className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase">
									Book Mode (Zoom/Pan)
								</span>
							</div>
							<button
								onClick={() => {
									triggerHaptic("light");
									toggleBookMode();
								}}
								className={`w-10 h-5 rounded-full transition-colors duration-200 relative ${isBookMode ? "bg-saffron-500" : "bg-slate-200 dark:bg-slate-600"}`}
							>
								<div
									className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${isBookMode ? "translate-x-5" : "translate-x-0"}`}
								/>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Main Content & Audio Player Wrapper */}
			<div className="flex-1 flex flex-col h-full overflow-hidden landscape:flex-row">
				<div
					ref={contentRef}
					className={`flex-1 scroll-container select-none ${scrollBarSide === "left" ? "left-scrollbar" : ""} ${isBookMode ? "overflow-hidden cursor-grab active:cursor-grabbing" : "overflow-y-auto overflow-x-auto"} relative`}
					style={{ touchAction: isBookMode ? "none" : "pan-y" }}
					onClick={() => setShowFontPanel(false)}
					onWheel={handleWheel}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
					onTouchCancel={handleTouchEnd}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseUp}
				>
					<div
						dir={scrollBarSide === "left" ? "ltr" : undefined}
						className={`${maxWidthClass} mx-auto px-3 sm:px-6 py-8 pb-32 transition-transform duration-100 ease-out origin-center`}
						style={
							isBookMode
								? {
										transform: `translate(${pan.x}px, ${pan.y}px) scale(${bookScale})`,
									}
								: {}
						}
					>
						{!(isEditing || isPersonalEdit) && (
							<div
								className={`mb-8 mt-4 animate-fade-in-up ${isLeftAligned ? "text-left" : "text-center"}`}
							>
								<div
									className={`flex flex-col ${isLeftAligned ? "items-start" : "items-center"} mb-4 px-2`}
								>
									{/* Author Name and Bhajan Number - Top Bar */}
									<div className="flex items-center justify-between w-full mb-1">
										<div className="text-[10px] font-hindi font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">
											{authorName || ""}
										</div>
										<div className="text-sm font-mono font-bold text-slate-500 dark:text-slate-400 opacity-90 bg-slate-100 dark:bg-slate-800/60 px-3 py-1 rounded-full">
											{bhajan.songNumber ?? bhajan.id}
										</div>
									</div>

									<div className="flex items-center gap-3">
										<h1 className="font-hindi font-bold text-3xl text-saffron-700 dark:text-saffron-400 leading-snug">
											{editedTitle}
										</h1>
									</div>
								</div>
								<div
									className={`h-px w-24 bg-saffron-200 dark:bg-slate-800 ${isLeftAligned ? "mr-auto" : "mx-auto"}`}
								/>
							</div>
						)}
						{isEditing || isPersonalEdit ? (
							<textarea
								value={editedContent}
								onChange={(e) => setEditedContent(e.target.value)}
								className="w-full h-[60vh] p-4 font-hindi bg-white/50 dark:bg-slate-900/50 border border-saffron-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-saffron-400 transition-all"
								style={{ fontSize: `${fontSize}px` }}
								placeholder="Enter Bhajan Content..."
							/>
						) : (
							<div style={{ fontSize: `${fontSize}px` }}>
								{renderFormattedContent(editedContent)}
							</div>
						)}

						{!(isEditing || isPersonalEdit) && (
							<div className="mt-16 flex flex-col items-center">
								<div className="font-logo text-2xl text-saffron-500 dark:text-saffron-400">
									RadheShyam
								</div>

								<div className="mt-2 px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-mono text-slate-400 dark:text-slate-500 flex items-center gap-2">
									<Hash size={14} /> {bhajan.songNumber ?? bhajan.id}
								</div>
							</div>
						)}
					</div>

					{/* Book Mode Zoom Controls */}
					{isBookMode && (
						<div
							className={`fixed ${isPlayingCurrentBhajan ? "bottom-36" : "bottom-24"} left-1/2 -translate-x-1/2 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-xl flex items-center gap-1 animate-in slide-in-from-bottom-4 landscape:bottom-auto landscape:top-1/2 landscape:-translate-y-1/2 landscape:left-auto landscape:translate-x-0 landscape:flex-col ${showAudioSidebar ? "landscape:right-24" : "landscape:right-4"}`}
						>
							<button
								onClick={() => {
									triggerHaptic("light");
									setBookScale((s) => Math.max(1, s - 0.5));
								}}
								className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
							>
								<ZoomOut size={20} />
							</button>
							<div className="w-12 text-center font-bold font-mono text-xs text-slate-800 dark:text-slate-200 landscape:py-1">
								{Math.round(bookScale * 100)}%
							</div>
							<button
								onClick={() => {
									triggerHaptic("light");
									setBookScale((s) => Math.min(4, s + 0.5));
								}}
								className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
							>
								<ZoomIn size={20} />
							</button>
							<div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 landscape:w-6 landscape:h-px landscape:my-1 landscape:mx-0"></div>
							<button
								onClick={() => {
									triggerHaptic("light");
									setBookScale(1);
									setPan({ x: 0, y: 0 });
								}}
								className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-400 dark:text-ink-400 hover:text-red-500 transition-colors"
								title="Reset Zoom"
							>
								<RotateCcw size={18} />
							</button>
						</div>
					)}
				</div>

				{!(isEditing || isPersonalEdit) && (
					<>
						{isPlayingCurrentBhajan && (
							<div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl border border-slate-200 dark:border-slate-800 rounded-full px-3 py-1.5 flex items-center gap-3">
								<button
									onClick={(e) => {
										e.stopPropagation();
										triggerHaptic("light");
										if (onOpenAudioScreen) onOpenAudioScreen();
									}}
									className="text-slate-400 dark:text-ink-400 hover:text-saffron-500 p-1.5 transition-colors"
									title="Open Audio Player"
								>
									<Maximize size={16} />
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										triggerHaptic("light");
										seek(Math.max(0, progress - 10));
									}}
									className="text-slate-600 dark:text-slate-300 hover:text-saffron-600 dark:hover:text-saffron-400 p-1 active:scale-90 transition-transform"
								>
									<RotateCcw size={18} />
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										triggerHaptic("medium");
										togglePlay();
									}}
									className="bg-saffron-500 hover:bg-saffron-600 text-white rounded-full p-2 shadow-md hover:scale-105 active:scale-95 transition-all mx-1"
								>
									{isLoading ? (
										<Loader2 size={20} className="animate-spin text-white" />
									) : isPlaying ? (
										<Pause size={20} fill="currentColor" />
									) : (
										<Play size={20} fill="currentColor" className="ml-0.5" />
									)}
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										triggerHaptic("light");
										seek(Math.min(duration, progress + 10));
									}}
									className="text-slate-600 dark:text-slate-300 hover:text-saffron-600 dark:hover:text-saffron-400 p-1 active:scale-90 transition-transform"
								>
									<RotateCcw size={18} className="scale-x-[-1]" />
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										triggerHaptic("medium");
										closePlayer();
									}}
									className="text-slate-400 dark:text-ink-400 hover:text-red-500 p-1.5 transition-colors"
									title="Close Audio"
								>
									<X size={16} />
								</button>
							</div>
						)}

						{!previewMode && (
						<div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-4 z-40 animate-in fade-in slide-in-from-bottom-4 flex gap-2 items-end">
							<button
								onClick={() => {
									triggerHaptic("light");
									setShowPlaylistModal(true);
								}}
								data-tour="reader-save"
								className={`p-3 rounded-full shadow-lg transition-all duration-200 ${isLiked ? "bg-amber-50 text-amber-500 dark:bg-amber-900/30" : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"} hover:scale-105`}
							>
								<Star size={22} className={isLiked ? "fill-current" : ""} />
							</button>
							<button
								onClick={() => {
									triggerHaptic("light");
									setShowShareConfirm(true);
								}}
								data-tour="reader-share"
								className="p-3 bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300 rounded-full shadow-lg hover:scale-105 transition-all duration-200"
							>
								<Share2 size={22} />
							</button>
						</div>
						)}
						{bhajan.audio && bhajan.audio.length > 0 && (
							<div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-40 animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-2 items-end">
								{bhajan.audio.length > 1 ? (
									<>
										{showAudioList &&
											createPortal(
												<div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
													<div className="bg-white dark:bg-slate-800 w-[90vw] max-w-md rounded-3xl p-5 shadow-2xl border border-saffron-200 dark:border-slate-700 max-h-[80vh] flex flex-col">
														<div className="flex items-center justify-between mb-4 shrink-0 px-1">
															<h3 className="text-lg font-bold text-saffron-600 dark:text-saffron-400">
																{isHindi ? "उपलब्ध ऑडियो" : "Available Audio"}
															</h3>
															<button
																onClick={() => handleCloseAudioList()}
																className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-ink-400"
															>
																<X size={20} />
															</button>
														</div>
														<div className="space-y-2 overflow-y-auto pr-1">
															{bhajan.audio.map((track, idx) => (
																<div
																	key={idx}
																	className="flex items-center group rounded-xl transition-colors border bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 border-transparent hover:border-saffron-200"
																>
																	<button
																		onClick={() => {
																			triggerHaptic("medium");
																			if (bhajan.audio) {
																				let queueToUse: BhajanAudio[] =
																					bhajan.audio.map((t) => ({
																						...t,
																						bhajanTitle: editedTitle,
																						parentBhajan: bhajan,
																					}));
																				if (
																					contextQueue &&
																					contextQueue.length > 0 &&
																					contextQueue.find(
																						(t) => t.id === track.id,
																					)
																				) {
																					queueToUse = contextQueue;
																				} else {
																					const localIdx = queueToUse.findIndex(
																						(t) => t.id === track.id,
																					);
																					if (localIdx !== -1) {
																						queueToUse = [
																							...queueToUse.slice(localIdx),
																							...queueToUse.slice(0, localIdx),
																						];
																					}
																				}
																				playTrack(
																					track,
																					editedTitle,
																					bhajan,
																					"/icon.webp",
																					queueToUse,
																					queueName || "Song List",
																				);
																				handleCloseAudioList();
																			}
																		}}
																		className="flex-1 text-left px-3 py-2.5 flex items-center gap-3"
																	>
																		<div className="w-10 h-10 rounded-full bg-saffron-100 dark:bg-slate-700 flex items-center justify-center text-saffron-600 dark:text-saffron-400 group-hover:bg-saffron-500 group-hover:text-white transition-colors shrink-0">
																			<PlayCircle size={20} />
																		</div>
																		<div className="flex-1 min-w-0 py-1">
																			<div className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-saffron-700 dark:group-hover:text-saffron-300 leading-tight">
																				{track.singer?.replace(/\s+\)/g, ")") ||
																					(isHindi
																						? "अज्ञात गायक"
																						: "Unknown Singer")}
																			</div>
																			<div className="text-xs text-slate-400 dark:text-ink-400 mt-0.5">
																				{formatDuration(track.duration)}
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
																				if (onDownloadTrack)
																					onDownloadTrack(
																						track,
																						editedTitle || "Audio Track",
																					);
																			}}
																			disabled={
																				isTrackDownloaded(track.id) ||
																				!!activeDownloads?.[track.id]
																			}
																			className={`p-3 mr-1 transition-colors relative ${isTrackDownloaded(track.id) ? "text-green-500" : (activeDownloads?.[track.id]) ? "text-saffron-500" : "text-slate-400 dark:text-ink-400 hover:text-slate-600"}`}
																			title={isHindi ? "डाउनलोड" : "Download"}
																		>
																			{activeDownloads?.[track.id] ? (
																				<div className="relative flex items-center justify-center w-5 h-5">
																					<span className="text-[10px] font-black text-saffron-600 dark:text-saffron-400">
																						{Math.round(
																							activeDownloads[track.id]
																								?.progress || 0,
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
															))}
														</div>
													</div>
												</div>,
												document.body,
											)}
										<button
											onClick={() => {
												triggerHaptic("light");
												setShowAudioList(true);
											}}
											data-tour="reader-audio"
											className="flex items-center gap-2 px-4 py-2 bg-saffron-500 text-white rounded-full shadow-lg text-sm font-bold hover:scale-105 transition-all"
										>
											<Music size={18} />
											<span>{isHindi ? "ऑडियो चुनें" : "Select Audio"}</span>
											<span className="bg-white/20 px-1.5 rounded-full text-[10px]">
												{bhajan.audio.length}
											</span>
										</button>
									</>
								) : (
									/* Single Track - Standard Button */
									<button
										onClick={() => {
											triggerHaptic("medium");
											if (bhajan.audio && bhajan.audio.length > 0) {
												const track = bhajan.audio[0];
												let queueToUse: BhajanAudio[] = bhajan.audio.map(
													(t) => ({
														...t,
														bhajanTitle: editedTitle,
														parentBhajan: bhajan,
													}),
												);

												// Use contextQueue if available and track is in it
												if (contextQueue && contextQueue.length > 0) {
													const found = contextQueue.find(
														(t) => t.id === track.id,
													);
													if (found) {
														queueToUse = contextQueue;
													}
												}

												// Only reorder if using local queue
												if (queueToUse !== contextQueue) {
													const localIdx = queueToUse.findIndex(
														(t) => t.id === track.id,
													);
													if (localIdx !== -1) {
														queueToUse = [
															...queueToUse.slice(localIdx),
															...queueToUse.slice(0, localIdx),
														];
													}
												}

												playTrack(
													track,
													editedTitle,
													bhajan,
													"/icon.webp",
													queueToUse,
													queueName || "Song List",
												);
											}
										}}
										className="flex items-center gap-2 px-4 py-2 bg-saffron-500 text-white rounded-full shadow-lg text-sm font-bold hover:scale-105 hover:bg-saffron-600 transition-all"
										data-tour="reader-audio"
									>
										<PlayCircle size={18} />
										{isHindi ? "ऑडियो चलाएं" : "Play Audio"}
									</button>
								)}
							</div>
						)}
					</>
				)}
			</div>

			{/* Playlist Modal */}
			{showPlaylistModal &&
				createPortal(
					<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
						<div className="bg-white dark:bg-slate-800 w-full max-w-sm landscape:max-w-lg rounded-2xl shadow-2xl p-5 flex flex-col max-h-[70vh] landscape:max-h-[90vh]">
							<div className="flex items-center justify-between mb-4">
								<h3 className="font-bold text-lg dark:text-white">
									{t.savePlaylists}
								</h3>
								<button
									onClick={() => handleClosePlaylistModal()}
									className="p-1 text-slate-400 dark:text-ink-400"
								>
									<X size={20} />
								</button>
							</div>

							<div className="flex-1 overflow-y-auto space-y-2 mb-4 scroll-container">
								{playlists.map((p) => {
									const isAdded = p.items.includes(bhajan.id);
									return (
										<button
											key={p.id}
											onClick={() => handleTogglePlaylist(p)}
											className={`w-full text-left p-3 rounded-xl flex justify-between items-center transition-all border ${
												isAdded
													? "bg-saffron-50 dark:bg-slate-700 border-saffron-200 dark:border-saffron-500"
													: "bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 border-transparent"
											}`}
										>
											<div className="flex-1 min-w-0">
												<span
													className={`font-bold block truncate ${isAdded ? "text-saffron-700 dark:text-saffron-400" : "text-slate-700 dark:text-white"}`}
												>
													{p.name}
												</span>
												<span className="text-xs text-slate-400 dark:text-ink-400">
													{p.items.length} {t.songs}
												</span>
											</div>
											<div
												className={`p-1 rounded-full ${isAdded ? "text-saffron-600 dark:text-saffron-400" : "text-slate-300 dark:text-slate-500"}`}
											>
												{isAdded ? (
													<CheckSquare size={22} className="fill-current" />
												) : (
													<Square size={22} />
												)}
											</div>
										</button>
									);
								})}
								{playlists.length === 0 && (
									<p className="text-center text-slate-400 dark:text-ink-400 text-sm py-4">
										{t.noPlaylists}
									</p>
								)}
							</div>

							<div className="pt-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
								<div className="flex gap-2">
									<input
										className="flex-1 p-3 bg-slate-100 dark:bg-slate-900 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-saffron-500 dark:text-white"
										placeholder={t.newPlaylist}
										value={newPlaylistName}
										onChange={(e) => setNewPlaylistName(e.target.value)}
									/>
									<button
										onClick={handleCreateAndAdd}
										disabled={!newPlaylistName.trim()}
										className="bg-saffron-500 text-white p-3 rounded-xl disabled:opacity-50"
									>
										<Plus size={20} />
									</button>
								</div>
							</div>

							<button
								onClick={() => handleClosePlaylistModal()}
								className="mt-3 w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl shrink-0"
							>
								{t.done}
							</button>
						</div>
					</div>,
					document.body,
				)}

			{/* Premium Share Modal */}
			{showShareConfirm &&
				createPortal(
					<div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
						<div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 md:p-8 transform scale-100 transition-all animate-in slide-in-from-bottom sm:zoom-in-95">
							<div className="flex justify-between items-center mb-6">
								<h3 className="text-xl font-bold text-slate-800 dark:text-white">
									{t.shareTitle}
								</h3>
								<button
									onClick={() => handleCloseShareConfirm()}
									className="p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700/50 rounded-full transition-colors"
								>
									<X size={20} />
								</button>
							</div>

							{/* Link Preview Card */}
							<div className="mb-6 bg-saffron-50 dark:bg-slate-900/50 border border-saffron-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2">
								<div className="flex items-center gap-2 text-saffron-600 dark:text-saffron-400 text-sm font-bold mb-1">
									<Link size={16} /> chaitanyaprembhakti.org
								</div>
								<div className="font-bold text-slate-800 dark:text-gray-100 line-clamp-2">
									{editedTitle}
								</div>
								{authorName && (
									<div className="text-xs text-slate-500 dark:text-slate-400">
										{authorName}
									</div>
								)}
							</div>

							{/* Actions */}
							<div className="flex flex-col gap-3">
								<button
									onClick={executeShare}
									className="w-full py-3.5 bg-saffron-500 hover:bg-saffron-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-saffron-500/20 transition-colors"
								>
									<Share2 size={18} /> {t.shareLink}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
};

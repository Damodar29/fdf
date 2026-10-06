import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { doc, getDoc } from "firebase/firestore";
import {
	ArrowLeft,
	Download,
	Eye,
	GalleryHorizontal,
	Heart,
	Image as ImageIcon,
	LayoutGrid,
	Loader2,
	Maximize2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useSharedFirebase } from "../context/SharedFirebaseContext";
import { useMetrics } from "../hooks/useMetrics";
import {
	hasUnseen,
	idsByRecency,
	markSeen,
	useMarkVisitedOnMount,
	useSeenVersion,
} from "../hooks/useNewBadge";
import { useViewTracker } from "../hooks/useViewTracker";
import { db } from "../services/firebase";
import {
	type GalleryItem,
	MANDAL_LIST,
	type MandalData,
} from "../src/types/mandal";
import {
	formatDateChipLabel,
	formatForDateInput,
	toLocalDateKey,
} from "../utils/dateFormatter";
import { iosGetDoc, shouldUseRestFallback } from "../utils/firebaseRest";
import { downloadImage } from "../utils/imageStorage";
import { THUMB } from "../utils/imageThumb";
import { CachedImage } from "./CachedImage";
import { HorizontalGallery } from "./HorizontalGallery";
import { OfflineBanner } from "./OfflineBanner";
import { Toast, type ToastType } from "./Toast";
import { useStoryImageZoom, useViewportSize } from "./useStoryImageZoom";

// ---------------------------------------------------------------------------
// Web-only: module-level cache so we don't re-fetch GitHub on every Firestore
// snapshot update. TTL = 5 minutes. Android uses native filesystem caching
// via CachedImage, so this block is intentionally skipped on native.
// ---------------------------------------------------------------------------
interface _GHReleaseCache {
	releases: GitHubRelease[];
	ts: number;
	token: string;
}
let _darshanGHCache: _GHReleaseCache | null = null;
const GH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchDarshanReleases(
	token: string,
	isNative: boolean,
): Promise<GitHubRelease[]> {
	const parseCache = (val: string) => {
		try {
			const parsed = JSON.parse(val);
			if (Array.isArray(parsed)) return parsed;
			if (parsed && Array.isArray(parsed.releases)) return parsed.releases;
		} catch (_e) {}
		return [];
	};

	if (!isNative) {
		const now = Date.now();
		if (
			_darshanGHCache &&
			_darshanGHCache.token === token &&
			now - _darshanGHCache.ts < GH_CACHE_TTL_MS
		) {
			return _darshanGHCache.releases;
		}
	} else {
		try {
			const cached = await Preferences.get({ key: "gh_darshan_cache" });
			if (cached.value) {
				const parsed = JSON.parse(cached.value);
				if (
					!Array.isArray(parsed) &&
					parsed.token === token &&
					Date.now() - parsed.ts < GH_CACHE_TTL_MS
				) {
					return parsed.releases || [];
				}
			}
		} catch (_e) {}
	}

	try {
		const url = isNative
			? `https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?t=${Date.now()}&per_page=100`
			: `https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?per_page=100`;

		const response = await fetch(url, {
			headers: {
				Authorization: `token ${token}`,
				Accept: "application/vnd.github.v3+json",
			},
		});

		if (!response.ok) {
			if (isNative) {
				const cached = await Preferences.get({ key: "gh_darshan_cache" });
				if (cached.value) return parseCache(cached.value);
			}
			return [];
		}

		const releases: GitHubRelease[] = await response.json();

		if (!isNative) {
			_darshanGHCache = { releases, ts: Date.now(), token };
		} else {
			await Preferences.set({
				key: "gh_darshan_cache",
				value: JSON.stringify({ releases, ts: Date.now(), token }),
			});
		}
		return Array.isArray(releases) ? releases : [];
	} catch (_e) {
		if (isNative) {
			try {
				const cached = await Preferences.get({ key: "gh_darshan_cache" });
				if (cached.value) return parseCache(cached.value);
			} catch (_err) {}
		}
		return [];
	}
}

interface DailyDarshanScreenProps {
	onBack: () => void;
	scrollBarSide?: "left" | "right";
	onOpenProfile?: () => void;
	/** When set (from a notification tap), auto-opens this mandal at the given date */
	initialMandalTarget?: { mandalId: string; date: string } | null;
	/** Called once the initialMandalTarget has been consumed so parent clears it */
	onMandalTargetConsumed?: () => void;
}

interface GitHubAsset {
	id: number;
	name: string;
	browser_download_url: string;
	content_type: string;
	size: number;
	created_at: string;
}

interface GitHubRelease {
	id: number;
	name: string;
	tag_name: string;
	assets: GitHubAsset[];
	created_at: string;
}

// --- Story Viewer Component ---
const StoryViewer: React.FC<{
	images: GalleryItem[];
	initialIndex: number;
	onClose: () => void;
	getMetrics: (id: string) => { likes: number; views: number };
	incrementLike: (id: string) => void;
	incrementView: (id: string) => void;
	hasLiked: (id: string) => boolean;
	isPaused?: boolean;
}> = ({
	images,
	initialIndex,
	onClose,
	getMetrics,
	incrementLike,
	incrementView,
	hasLiked,
	isPaused,
}) => {
	const [isHolding, setIsHolding] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const currentItem = images[currentIndex];
	const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
	const viewportSize = useViewportSize();
	const imageTransformRef = useRef<HTMLDivElement | null>(null);
	const pinch = useStoryImageZoom({
		containerSize: viewportSize,
		mediaSize: imageSize,
		targetRef: imageTransformRef,
	});
	const STORY_DURATION_MS = 5000;

	const touchStartXRef = useRef<number | null>(null);
	const touchStartYRef = useRef<number | null>(null);
	const touchStartTimeRef = useRef<number>(0);
	const isSwipingRef = useRef(false);
	const touchHandledRef = useRef(false);

	const navigate = (dir: "next" | "prev") => {
		if (dir === "next") {
			setCurrentIndex((c) => {
				if (c < images.length - 1) return c + 1;
				window.history.back();
				return c;
			});
		} else {
			setCurrentIndex((c) => (c > 0 ? c - 1 : c));
		}
	};

	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	const storyHistoryPushed = useRef(false);
	useEffect(() => {
		if (!storyHistoryPushed.current) {
			storyHistoryPushed.current = true;
			window.history.pushState(
				{ isPopup: true, id: "darshan_story_viewer", view: "darshan" },
				"",
			);
		}
		const handlePopState = (e: PopStateEvent) => {
			if (e.state?.id !== "darshan_story_viewer") onCloseRef.current();
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setImageSize({ width: 0, height: 0 });
		pinch.reset();
		if (currentItem?.id) incrementView(currentItem.id);
	}, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
		const { naturalWidth, naturalHeight } = e.currentTarget;
		if (naturalWidth > 0 && naturalHeight > 0) {
			setImageSize({ width: naturalWidth, height: naturalHeight });
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (pinch.isZoomed || pinch.isInteracting || isPaused || isHolding) return;

		const timer = window.setTimeout(() => {
			setCurrentIndex((c) => {
				if (c < images.length - 1) return c + 1;
				window.history.back();
				return c;
			});
		}, STORY_DURATION_MS);

		return () => window.clearTimeout(timer);
	}, [
		currentIndex,
		images.length,
		pinch.isZoomed,
		pinch.isInteracting,
		isPaused,
		isHolding,
	]);

	const onTouchStart = (e: React.TouchEvent) => {
		setIsHolding(true);
		touchHandledRef.current = false;
		if (e.touches.length === 2 || pinch.isZoomed || pinch.hasActiveGesture()) {
			touchStartXRef.current = null;
			touchStartYRef.current = null;
			isSwipingRef.current = false;
			pinch.handleTouchStart(e);
			return;
		}
		touchStartXRef.current = e.touches[0].clientX;
		touchStartYRef.current = e.touches[0].clientY;
		touchStartTimeRef.current = Date.now();
		isSwipingRef.current = false;
	};

	const onTouchMove = (e: React.TouchEvent) => {
		if (e.touches.length === 2 || pinch.isZoomed || pinch.hasActiveGesture()) {
			pinch.handleTouchMove(e);
			return;
		}
		if (touchStartXRef.current === null) return;
		const dx = e.touches[0].clientX - touchStartXRef.current;
		const dy = e.touches[0].clientY - (touchStartYRef.current ?? 0);
		if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
			isSwipingRef.current = true;
		}
	};

	const onTouchEnd = (e: React.TouchEvent) => {
		setIsHolding(false);
		if (pinch.isZoomed || pinch.hasActiveGesture()) {
			pinch.handleTouchEnd(e);
			return;
		}
		if (touchStartXRef.current === null) return;

		const endX = e.changedTouches[0].clientX;
		const endY = e.changedTouches[0].clientY;
		const dx = endX - touchStartXRef.current;
		const dy = endY - (touchStartYRef.current ?? endY);
		const elapsed = Date.now() - touchStartTimeRef.current;

		touchStartXRef.current = null;
		touchStartYRef.current = null;

		if (
			isSwipingRef.current &&
			Math.abs(dx) > Math.abs(dy) &&
			Math.abs(dx) > 40 &&
			elapsed < 500
		) {
			isSwipingRef.current = false;
			touchHandledRef.current = true;
			e.preventDefault();
			if (dx < 0) navigate("next");
			else navigate("prev");
			return;
		}
		isSwipingRef.current = false;

		if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && elapsed < 350) {
			touchHandledRef.current = true;
			e.preventDefault();
			if (endX < window.innerWidth / 3) navigate("prev");
			else navigate("next");
		}
	};

	if (!currentItem) return null;

	return createPortal(
		<div className="fixed inset-0 z-[100] bg-black flex flex-col">
			<div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-[calc(env(safe-area-inset-top)+6px)] pb-1">
				{images.map((_, idx) => (
					<div
						key={idx}
						className="h-[3px] flex-1 bg-white/30 rounded-full overflow-hidden"
					>
						<div
							className="h-full bg-white rounded-full"
							style={{
								transformOrigin: "left center",
								transform: idx < currentIndex ? "scaleX(1)" : "scaleX(0)",
								animationName:
									idx === currentIndex ? "story-progress-fill" : "none",
								animationDuration:
									idx === currentIndex ? `${STORY_DURATION_MS}ms` : "0ms",
								animationTimingFunction: "linear",
								animationFillMode: "forwards",
								animationPlayState:
									pinch.isZoomed || pinch.isInteracting || isPaused || isHolding
										? "paused"
										: "running",
								willChange: "transform",
							}}
						/>
					</div>
				))}
			</div>

			<div
				className="absolute top-0 left-0 right-0 z-10 pt-[calc(env(safe-area-inset-top)+18px)] pb-4 px-3 flex items-center justify-between gap-2 pointer-events-none"
				style={{
					background:
						"linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)",
				}}
			>
				<div className="flex items-center gap-2 min-w-0 flex-1">
					<div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/40 shrink-0">
						<CachedImage
							thumbWidth={THUMB.small}
							src={currentItem?.url || ""}
							alt=""
							className="w-full h-full object-cover"
						/>
					</div>
					<div className="min-w-0">
						{/* Name hidden as requested */}
						<p className="text-white/60 text-[10px] leading-none">
							{currentIndex + 1} / {images.length}
						</p>
					</div>
				</div>
				<button
					onTouchEnd={(e) => {
						e.stopPropagation();
						e.preventDefault();
						window.history.back();
					}}
					onClick={(e) => {
						e.stopPropagation();
						window.history.back();
					}}
					className="p-2.5 rounded-full bg-black/30 text-white active:scale-90 transition-transform shrink-0 pointer-events-auto"
				>
					<X size={20} />
				</button>
			</div>

			<div
				className="absolute inset-0 flex items-center justify-center overflow-hidden"
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
				onTouchCancel={(e) => {
					setIsHolding(false);
					onTouchEnd(e);
				}}
				onClick={(e) => {
					// Skip if touch already handled navigation (prevents double-fire)
					if (touchHandledRef.current) {
						touchHandledRef.current = false;
						return;
					}
					if (pinch.isZoomed) return;
					const x = e.clientX;
					if (x < window.innerWidth / 3) navigate("prev");
					else navigate("next");
				}}
				style={{ touchAction: "none" }}
			>
				<div
					ref={imageTransformRef}
					className="w-full h-full flex items-center justify-center pointer-events-none"
					style={{
						transform: "translate3d(0, 0, 0) scale(1)",
						transformOrigin: "center center",
						willChange: "transform",
					}}
				>
					<CachedImage
						progressiveWidth={THUMB.card}
						src={currentItem?.url || ""}
						alt={currentItem?.displayName || ""}
						onLoad={handleImageLoad}
						className="w-full h-full object-contain select-none"
						style={
							{
								userSelect: "none",
								pointerEvents: "none",
							} as React.CSSProperties
						}
						draggable={false}
					/>
				</div>
			</div>

			<div
				className="absolute bottom-0 left-0 right-0 z-10 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-10 flex flex-col items-center pointer-events-none"
				style={{
					background:
						"linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)",
				}}
			>
				<div className="flex items-center gap-8 mb-4 pointer-events-auto">
					<button
						onClick={(e) => {
							e.stopPropagation();
							if (currentItem?.id) incrementLike(currentItem.id);
						}}
						className="flex flex-col items-center gap-1 text-white active:scale-90 transition-transform"
					>
						<Heart
							size={28}
							className={
								currentItem?.id && hasLiked(currentItem.id)
									? "fill-red-500 text-red-500"
									: ""
							}
						/>
						<span className="text-xs font-medium drop-shadow">
							{currentItem?.id ? getMetrics(currentItem.id).likes || 0 : 0}
						</span>
					</button>
					<div className="flex flex-col items-center gap-1 text-white/90">
						<Eye size={28} />
						<span className="text-xs font-medium drop-shadow">
							{currentItem?.id ? getMetrics(currentItem.id).views || 0 : 0}
						</span>
					</div>
				</div>

				{images.length > 1 && (
					<div className="flex gap-1.5 items-center">
						{images.map((_, idx) => (
							<div
								key={idx}
								className={`rounded-full transition-all duration-200 ${idx === currentIndex ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
							/>
						))}
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
};

// --- Mandal Detail Screen Component ---
const MandalDetailScreen: React.FC<{
	mandal: MandalData;
	onClose: () => void;
	isHindi: boolean;
	onOpenProfile?: () => void;
	initialDate?: string | null;
}> = ({ mandal, onClose, isHindi, onOpenProfile, initialDate }) => {
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [storyViewerData, setStoryViewerData] = useState<{
		images: GalleryItem[];
		initialIndex: number;
	} | null>(null);
	const [downloadingId, setDownloadingId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<{
		text: string;
		type: ToastType;
	} | null>(null);
	const [transitioning, setTransitioning] = useState(false);
	const [confirmDialog, setConfirmDialog] = useState<{
		message: string;
		onConfirm: () => void;
	} | null>(null);
	const [viewMode, setViewMode] = useState<"horizontal" | "strip" | "grid">(
		() => {
			return (
				(localStorage.getItem("cpbs_darshan_view_mode") as
					| "horizontal"
					| "strip"
					| "grid") || "horizontal"
			);
		},
	);

	useEffect(() => {
		localStorage.setItem("cpbs_darshan_view_mode", viewMode);
	}, [viewMode]);
	const { getMetrics, incrementLike, incrementView, incrementViews, hasLiked } =
		useMetrics("darshan");
	const { user, profile } = useAuth();

	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	const detailHistoryPushed = useRef(false);
	useEffect(() => {
		if (!detailHistoryPushed.current) {
			detailHistoryPushed.current = true;
			window.history.pushState(
				{ isPopup: true, id: "darshan_mandal_detail", view: "darshan" },
				"",
			);
		}
		const handlePopState = (e: PopStateEvent) => {
			const state = e.state;
			if (
				state?.id === "darshan_mandal_detail" ||
				state?.id === "darshan_story_viewer"
			) {
				// Stay here. StoryViewer will handle its own closing
			} else {
				onCloseRef.current();
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	// Back-button support for popups
	useEffect(() => {
		if (confirmDialog) {
			window.history.pushState({ isPopup: true, view: "darshan_popup" }, "");
		}
	}, [confirmDialog]);

	useEffect(() => {
		const handlePopState = (e: PopStateEvent) => {
			if (confirmDialog && e.state?.view !== "darshan_popup")
				setConfirmDialog(null);
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [confirmDialog]);

	const handleIncrementLike = (id: string) => {
		incrementLike(id);
	};

	const openStory = (index: number) => {
		setTransitioning(true);
		setTimeout(() => {
			if (selectedDate) {
				setStoryViewerData({
					images: groupedGallery[selectedDate],
					initialIndex: index,
				});
			}
			setTransitioning(false);
		}, 40);
	};

	const closeStory = () => {
		setTransitioning(true);
		setStoryViewerData(null);
		setTimeout(() => {
			setTransitioning(false);
		}, 40);
	};

	const handlePhotoDownload = async (
		e: React.MouseEvent,
		item: GalleryItem,
		index?: number,
	) => {
		e.stopPropagation();
		if (downloadingId === item.id) return;
		setDownloadingId(item.id);
		try {
			const date = item.date
				? new Date(formatForDateInput(item.date))
				: new Date();
			const shortId =
				index !== undefined
					? `${index + 1}`
					: Math.random().toString(36).substring(2, 6);
			const safeName = `photo_${shortId}`;
			const mandalSubfolder = mandal.name
				.replace(/mandal/i, "")
				.replace(/[^a-zA-Z0-9\s-_]/g, "")
				.trim();
			const resultPath = await downloadImage(
				item.url,
				"Darshan",
				date,
				`${safeName}.jpg`,
				mandalSubfolder,
			);
			if (Capacitor.isNativePlatform()) {
				setToastMessage({
					text: `Photo saved to ${resultPath || "Pictures/Prem Bhakti/Darshan/"}`,
					type: "success",
				});
			} else {
				setToastMessage({
					text: isHindi
						? "फोटो डाउनलोड हो गई है"
						: "Photo downloaded successfully",
					type: "success",
				});
			}
		} catch (e) {
			console.error("Download failed", e);
			setToastMessage({
				text: "Download failed. Check internet connection.",
				type: "error",
			});
		} finally {
			setDownloadingId(null);
		}
	};

	const t = {
		noImages: isHindi ? "कोई दर्शन उपलब्ध नहीं है" : "No darshan available",
	};

	const sortedGallery = [...(mandal.gallery || [])].sort((a, b) => {
		const dateDiff =
			new Date(formatForDateInput(b.date)).getTime() -
			new Date(formatForDateInput(a.date)).getTime();
		if (dateDiff !== 0) return dateDiff;
		if (a.order !== b.order) return a.order - b.order;
		return a.id.localeCompare(b.id);
	});

	const groupedGallery = useMemo(() => {
		const groups: Record<string, typeof mandal.gallery> = {};
		sortedGallery.forEach((item) => {
			if (!groups[formatForDateInput(item.date)])
				groups[formatForDateInput(item.date)] = [];
			groups[formatForDateInput(item.date)].push(item);
		});
		return groups;
	}, [sortedGallery]);

	const availableDates = Object.keys(groupedGallery).sort(
		(a, b) => new Date(b).getTime() - new Date(a).getTime(),
	);

	// The date a notification asked for, kept until the user picks a chip
	// themselves. A tap on a notification often opens this screen
	// on Firestore's cached snapshot, which does not have the new photos yet, so
	// the requested date is missing on the first pass. Locking onto the newest
	// cached date there opened the notification on the previous upload's day.
	const pendingDateRef = useRef(
		initialDate ? formatForDateInput(initialDate) : "",
	);
	const pickDate = (date: string) => {
		pendingDateRef.current = "";
		setSelectedDate(date);
	};

	useEffect(() => {
		if (availableDates.length === 0) return;
		const requested = pendingDateRef.current;
		// Not cleared here, so a second run of this effect (StrictMode) cannot
		// fall through to the newest date; a chip tap clears it.
		if (requested && availableDates.includes(requested)) {
			if (selectedDate !== requested) setSelectedDate(requested);
			return;
		}
		if (!selectedDate) setSelectedDate(availableDates[0]);
	}, [availableDates, selectedDate]);

	const hideDetail = !!storyViewerData || transitioning;

	// Count a photo as viewed once it has actually been on screen for a moment,
	// so browsing a date's photos counts views without needing to open each one
	// full-screen. Suspended while the full-screen viewer is up — that path does
	// its own per-image `incrementView`, and double counting is prevented anyway
	// by the permanent per-device dedup inside useMetrics.
	const trackView = useViewTracker(incrementViews, { enabled: !hideDetail });

	return createPortal(
		<div className="fixed inset-0 z-[70] bg-amber-50 dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
			<div
				className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 shadow-lg z-10"
				style={{ display: hideDetail ? "none" : "flex" }}
			>
				<button
					onClick={() => window.history.back()}
					className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>
				<div className="flex-1 min-w-0">
					<h2 className="text-xl font-bold flex items-center gap-2 tracking-wide leading-none drop-shadow-md truncate">
						{mandal.name.replace(/\s*mandal\s*/i, "")}
					</h2>
				</div>
				<button
					onClick={() =>
						setViewMode((v) =>
							v === "horizontal"
								? "strip"
								: v === "strip"
									? "grid"
									: "horizontal",
						)
					}
					className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors active:scale-95 shrink-0"
					title={
						viewMode === "horizontal"
							? "Switch to Strip View"
							: viewMode === "strip"
								? "Switch to Grid View"
								: "Switch to Swipe View"
					}
				>
					{viewMode === "horizontal" ? (
						<Maximize2 size={20} />
					) : viewMode === "strip" ? (
						<GalleryHorizontal size={20} />
					) : (
						<LayoutGrid size={20} />
					)}
				</button>
			</div>

			<div
				className="flex-1 overflow-y-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]"
				style={{ display: hideDetail ? "none" : "block" }}
			>
				{availableDates.length > 0 ? (
					<div className="md:max-w-4xl md:mx-auto">
						<div className="flex overflow-x-auto gap-4 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800 scrollbar-hide shrink-0">
							{availableDates.map((date) => {
								const isSelected = selectedDate === date;
								const firstImage = groupedGallery[date][0]?.url;

								// Current year: "5 Jan" as before. Other years: "5 Jan 2025",
								// so a new year can't produce two identical-looking chips.
								const displayDate = formatDateChipLabel(date, isHindi);

								return (
									<button
										key={date}
										onClick={() => pickDate(date)}
										className="flex flex-col items-center gap-1 min-w-[72px] outline-none focus:outline-none"
										style={{ WebkitTapHighlightColor: "transparent" }}
									>
										<div
											className={`w-16 h-16 rounded-full p-[2px] ${isSelected ? "bg-gradient-to-tr from-saffron-500 to-orange-500" : "bg-slate-300 dark:bg-slate-700"}`}
										>
											<div className="w-full h-full rounded-full border-2 border-white dark:border-slate-950 overflow-hidden bg-slate-100 dark:bg-slate-800">
												{firstImage ? (
													<CachedImage
														thumbWidth={THUMB.small}
														src={firstImage}
														alt={date}
														className="w-full h-full object-cover"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center">
														<ImageIcon
															size={20}
															className="text-slate-400 dark:text-ink-400"
														/>
													</div>
												)}
											</div>
										</div>
										<span
											className={`text-[10px] font-medium whitespace-nowrap ${isSelected ? "text-saffron-600 dark:text-saffron-400 font-bold" : "text-slate-600 dark:text-slate-400"}`}
										>
											{displayDate}
										</span>
									</button>
								);
							})}
						</div>

						{viewMode === "horizontal" ? (
							<HorizontalGallery
								items={selectedDate ? groupedGallery[selectedDate] || [] : []}
								getMetrics={getMetrics}
								hasLiked={hasLiked}
								openStory={openStory}
								handlePhotoDownload={handlePhotoDownload}
								downloadingId={downloadingId}
								trackView={trackView}
							/>
						) : viewMode === "strip" ? (
							<div className="flex items-start overflow-x-auto gap-3 pb-4 scrollbar-hide snap-x">
								{selectedDate &&
									groupedGallery[selectedDate]?.map((item, index, arr) => {
										const metrics = getMetrics(item.id);
										return (
											<div
												key={item.id}
												ref={trackView(item.id)}
												className="w-[60vw] shrink-0 snap-start mb-3 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex flex-col cursor-pointer active:scale-95 transition-transform break-inside-avoid relative"
												onClick={() => openStory(index)}
											>
												<div className="relative">
													<CachedImage
														thumbWidth={THUMB.card}
														src={item.url}
														alt={item.displayName}
														loading="lazy"
														className="w-full h-auto md:max-h-[70vh] object-contain bg-slate-100 dark:bg-slate-900"
													/>
													<div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
													<div className="absolute bottom-2 left-2 flex gap-3 text-white text-xs font-medium drop-shadow-md z-10 pointer-events-none">
														<span className="flex items-center gap-1">
															<Eye size={12} className="opacity-90" />{" "}
															{metrics.views || 0}
														</span>
														<span className="flex items-center gap-1">
															<Heart
																size={12}
																className={
																	hasLiked(item.id)
																		? "fill-red-500 text-red-500"
																		: "opacity-90"
																}
															/>{" "}
															{metrics.likes || 0}
														</span>
													</div>
												</div>
												<button
													onClick={(e) => handlePhotoDownload(e, item, index)}
													disabled={downloadingId === item.id}
													className="absolute top-2 right-2 bg-black/40 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm transition-all z-10 disabled:opacity-50"
													title="Download photo"
												>
													{downloadingId === item.id ? (
														<Loader2 size={14} className="animate-spin" />
													) : (
														<Download size={14} />
													)}
												</button>
												<div className="absolute top-2 left-2 bg-black/40 text-white px-2 py-1 rounded-md backdrop-blur-sm text-[10px] font-bold z-10 pointer-events-none">
													{index + 1} / {arr.length}
												</div>
											</div>
										);
									})}
							</div>
						) : (
							<div className="columns-2 gap-3 pb-4">
								{selectedDate &&
									groupedGallery[selectedDate]?.map((item, index, arr) => {
										const metrics = getMetrics(item.id);
										return (
											<div
												key={item.id}
												ref={trackView(item.id)}
												className="mb-3 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex flex-col cursor-pointer active:scale-95 transition-transform break-inside-avoid relative"
												onClick={() => openStory(index)}
											>
												<div className="relative">
													<CachedImage
														thumbWidth={THUMB.card}
														src={item.url}
														alt={item.displayName}
														loading="lazy"
														className="w-full h-auto md:max-h-[70vh] object-contain bg-slate-100 dark:bg-slate-900"
													/>
													<div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
													<div className="absolute bottom-2 left-2 flex gap-3 text-white text-xs font-medium drop-shadow-md z-10 pointer-events-none">
														<span className="flex items-center gap-1">
															<Eye size={12} className="opacity-90" />{" "}
															{metrics.views || 0}
														</span>
														<span className="flex items-center gap-1">
															<Heart
																size={12}
																className={
																	hasLiked(item.id)
																		? "fill-red-500 text-red-500"
																		: "opacity-90"
																}
															/>{" "}
															{metrics.likes || 0}
														</span>
													</div>
												</div>
												{/* Name hidden as requested */}
												<button
													onClick={(e) => handlePhotoDownload(e, item, index)}
													disabled={downloadingId === item.id}
													className="absolute top-2 right-2 bg-black/40 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm transition-all z-10 disabled:opacity-50"
													title="Download photo"
												>
													{downloadingId === item.id ? (
														<Loader2 size={14} className="animate-spin" />
													) : (
														<Download size={14} />
													)}
												</button>
												<div className="absolute top-2 left-2 bg-black/40 text-white px-2 py-1 rounded-md backdrop-blur-sm text-[10px] font-bold z-10 pointer-events-none">
													{index + 1} / {arr.length}
												</div>
											</div>
										);
									})}
							</div>
						)}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-ink-400">
						<ImageIcon size={48} className="mb-4 opacity-50" />
						<p>{t.noImages}</p>
					</div>
				)}
			</div>

			{transitioning && !storyViewerData && (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="animate-spin text-saffron-500" size={32} />
				</div>
			)}

			{storyViewerData && (
				<StoryViewer
					images={storyViewerData.images}
					initialIndex={storyViewerData.initialIndex}
					onClose={closeStory}
					getMetrics={getMetrics}
					incrementLike={handleIncrementLike}
					incrementView={incrementView}
					hasLiked={hasLiked}
					isPaused={!!confirmDialog}
				/>
			)}

			{confirmDialog &&
				createPortal(
					<div
						className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
						onClick={() => {
							if (window.history.state?.view === "darshan_popup")
								window.history.back();
							else setConfirmDialog(null);
						}}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
								<Heart size={24} className="fill-current" />
							</div>
							<h3 className="text-lg font-bold text-slate-800 dark:text-white text-center mb-2">
								{isHindi ? "प्रोफाइल आवश्यक" : "Profile Required"}
							</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
								{confirmDialog.message}
							</p>
							<div className="flex gap-3">
								<button
									onClick={() => {
										if (window.history.state?.view === "darshan_popup")
											window.history.back();
										else setConfirmDialog(null);
									}}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 active:scale-95 transition-transform"
								>
									{isHindi ? "रद्द करें" : "Cancel"}
								</button>
								<button
									onClick={() => {
										setConfirmDialog(null);
										if (window.history.state?.view === "darshan_popup") {
											window.history.back();
											setTimeout(() => confirmDialog.onConfirm(), 50);
										} else {
											confirmDialog.onConfirm();
										}
									}}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm bg-pink-500 hover:bg-pink-600 text-white active:scale-95 transition-all shadow-md"
								>
									{isHindi ? "प्रोफाइल बनाएं" : "Make Profile"}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{toastMessage && (
				<Toast
					message={toastMessage.text}
					type={toastMessage.type}
					onClose={() => setToastMessage(null)}
				/>
			)}
		</div>,
		document.body,
	);
};

export const DailyDarshanScreen: React.FC<DailyDarshanScreenProps> = ({
	onBack,
	scrollBarSide = "left",
	onOpenProfile,
	initialMandalTarget,
	onMandalTargetConsumed,
}) => {
	const { settingsLanguage } = useSettings();
	const isHindi = settingsLanguage === "hi";

	const {
		dbMandals: sharedMandals,
		darshanFoldersConfig,
		loadingMandals,
		loadingDarshanFolders,
	} = useSharedFirebase();
	const [mandals, setMandals] = useState<MandalData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedMandal, setSelectedMandal] = useState<MandalData | null>(null);
	// Stores the date to pre-select when a notification deep-links here
	const [selectedMandalInitialDate, setSelectedMandalInitialDate] = useState<
		string | null
	>(null);
	const [transitioning, setTransitioning] = useState(false);

	// Recompute every `hasUnseen` below whenever any screen writes seen-state.
	// This screen previously dispatched `cpbs_storage_update` but never listened
	// for it, so a mandal marked seen elsewhere kept its badge until remount.
	useSeenVersion();

	// Tell HomeScreen its Darshan tile has been visited — however the user got
	// here (tile, bottom nav, side menu, notification, deep link). App.tsx mounts
	// this screen conditionally, so one mount is exactly one visit.
	useMarkVisitedOnMount("darshan");

	const t = {
		title: isHindi ? "ठाकुर जी के दर्शन" : "Deity Darshan",
		loading: isHindi ? "लोड हो रहा है..." : "Loading...",
		noDarshan: isHindi
			? "अभी कोई दर्शन उपलब्ध नहीं है"
			: "No darshan available yet",
	};

	const onBackRef = useRef(onBack);
	useEffect(() => {
		onBackRef.current = onBack;
	}, [onBack]);

	const mainHistoryPushed = useRef(false);
	useEffect(() => {
		if (!mainHistoryPushed.current) {
			mainHistoryPushed.current = true;
			window.history.pushState(
				{ isPopup: true, id: "darshan_main", view: "darshan" },
				"",
			);
		}
		const handlePopState = (e: PopStateEvent) => {
			const state = e.state;
			if (!state?.id?.startsWith("darshan_")) {
				onBackRef.current();
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const openMandal = (mandal: MandalData, date?: string | null) => {
		setTransitioning(true);
		setTimeout(() => {
			setSelectedMandal(mandal);
			setSelectedMandalInitialDate(date || null);
			setTransitioning(false);
		}, 40);
	};

	const closeMandal = () => {
		setTransitioning(true);
		setSelectedMandal(null);
		setSelectedMandalInitialDate(null);
		setTimeout(() => {
			setTransitioning(false);
		}, 40);
	};

	// Auto-navigate when notification brings user here with a specific mandal + date
	const initialMandalTargetRef = useRef(initialMandalTarget);
	useEffect(() => {
		initialMandalTargetRef.current = initialMandalTarget;
	}, [initialMandalTarget]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: openMandal is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (!initialMandalTarget?.mandalId || loading || mandals.length === 0)
			return;
		const target = mandals.find((m) => m.id === initialMandalTarget.mandalId);
		if (target) {
			openMandal(target, initialMandalTarget.date || null);
			onMandalTargetConsumed?.();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialMandalTarget, loading, mandals]);

	const [githubToken, setGithubToken] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;
		const fetchToken = async () => {
			try {
				const tokenDoc = shouldUseRestFallback()
					? await iosGetDoc("damtoken/github_public")
					: await getDoc(doc(db, "damtoken", "github_public"));
				if (isMounted && tokenDoc.exists()) {
					setGithubToken(tokenDoc.data()?.token?.trim() || null);
				}
			} catch (e) {
				console.error("Token error:", e);
			}
		};
		fetchToken();
		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		let isMounted = true;
		const isNative = Capacitor.isNativePlatform();

		const processData = async () => {
			if (loadingMandals || loadingDarshanFolders) return;
			if (!darshanFoldersConfig) {
				if (isMounted) setLoading(false);
				return;
			}

			const visibleIds: number[] = darshanFoldersConfig.visibleIds || [];
			const folderOrder: number[] = darshanFoldersConfig.folderOrder || [];

			const dbMandals: Record<string, MandalData> = {};
			sharedMandals.forEach((d: any) => {
				dbMandals[d.id] = { ...d } as MandalData;
			});

			const githubDarshanGallery: Record<string, GalleryItem[]> = {};
			const mandalIdToReleaseId: Record<string, number> = {};
			const hiddenMandals = new Set<string>();

			if (githubToken) {
				try {
					const releases = await fetchDarshanReleases(githubToken, isNative);
					if (releases.length > 0) {
						const mandalReleasesMap = new Map<string, number[]>();

						releases.forEach((release) => {
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
							const mId = foundMandal ? foundMandal.id : `github-${release.id}`;

							if (!mandalReleasesMap.has(mId)) mandalReleasesMap.set(mId, []);
							mandalReleasesMap.get(mId)?.push(release.id);
						});

						mandalReleasesMap.forEach((rIds, mId) => {
							const hasVisible = rIds.some((id) => visibleIds.includes(id));
							if (!hasVisible) {
								hiddenMandals.add(mId);
							}
						});

						const filteredReleases = releases.filter((r) =>
							visibleIds.includes(r.id),
						);

						filteredReleases.forEach((release) => {
							const lowerReleaseName = release.name.toLowerCase();
							const mandalName = release.name
								.replace(/Release for /i, "")
								.replace(/\s*\(.*?\)\s*$/, "")
								.trim();

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

							const mandalId = foundMandal?.id || `github-${release.id}`;
							mandalIdToReleaseId[mandalId] = release.id;

							const newAssets = release.assets.map((asset) => {
								const dateObj = new Date(asset.created_at);
								let dateOnly = !Number.isNaN(dateObj.getTime())
									? toLocalDateKey(dateObj)
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

								return {
									id: asset.id.toString(),
									url: asset.browser_download_url,
									displayName,
									date: dateOnly,
									order,
									type: "darshan",
									releaseId: release.id,
								} as GalleryItem & { releaseId: number };
							});

							if (!githubDarshanGallery[mandalId])
								githubDarshanGallery[mandalId] = [];
							githubDarshanGallery[mandalId].push(...newAssets);

							(githubDarshanGallery as any)[`${mandalId}_name`] = mandalName;
						});
					}
				} catch (err) {
					console.error("Error fetching GitHub releases:", err);
				}
			}

			const mergedMandalsMap = new Map<string, MandalData>();

			MANDAL_LIST.forEach((staticMandal) => {
				if (hiddenMandals.has(staticMandal.id)) return;

				const dbData = dbMandals[staticMandal.id] || { gallery: [] };
				const ghGallery = githubDarshanGallery[staticMandal.id] || [];

				const firestoreItems = (dbData.gallery || []).filter(
					(g) => g.type === "darshan",
				);
				const githubSupplement = firestoreItems.length > 0 ? [] : ghGallery;

				const uniqueUrls = new Set<string>();
				const deduplicatedGallery: GalleryItem[] = [];

				[...firestoreItems, ...githubSupplement].forEach((item) => {
					if (!uniqueUrls.has(item.url)) {
						uniqueUrls.add(item.url);
						deduplicatedGallery.push(item);
					}
				});

				const combinedGallery = deduplicatedGallery.sort((a, b) => {
					const dateDiff =
						new Date(formatForDateInput(b.date)).getTime() -
						new Date(formatForDateInput(a.date)).getTime();
					if (dateDiff !== 0) return dateDiff;
					return a.order - b.order;
				});

				if (combinedGallery.length > 0) {
					mergedMandalsMap.set(staticMandal.id, {
						id: staticMandal.id,
						name: staticMandal.name,
						weeklyProgram: { enabled: false } as any,
						gallery: combinedGallery,
					});
				}
			});

			Object.keys(githubDarshanGallery).forEach((key) => {
				if (hiddenMandals.has(key)) return;

				if (key.startsWith("github-") && !key.endsWith("_name")) {
					const gallery = githubDarshanGallery[key];
					const name =
						(githubDarshanGallery as any)[`${key}_name`] || "Gallery Folder";
					const dbData = dbMandals[key] || ({} as Partial<MandalData>);

					if (gallery.length > 0 || dbData.weeklyProgram?.enabled) {
						mergedMandalsMap.set(key, {
							id: key,
							name: name,
							weeklyProgram:
								dbData.weeklyProgram || ({ enabled: false } as any),
							videos: dbData.videos || [],
							gallery: gallery.sort((a, b) => {
								const dateDiff =
									new Date(formatForDateInput(b.date)).getTime() -
									new Date(formatForDateInput(a.date)).getTime();
								if (dateDiff !== 0) return dateDiff;
								if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
								return a.id.localeCompare(b.id);
							}),
						});
					}
				}
			});

			if (isMounted) {
				const finalMandals = Array.from(mergedMandalsMap.values());

				if (folderOrder.length > 0) {
					finalMandals.sort((a, b) => {
						const releaseIdA = mandalIdToReleaseId[a.id];
						const releaseIdB = mandalIdToReleaseId[b.id];
						const indexA = releaseIdA ? folderOrder.indexOf(releaseIdA) : -1;
						const indexB = releaseIdB ? folderOrder.indexOf(releaseIdB) : -1;

						if (indexA !== -1 && indexB !== -1) return indexA - indexB;
						if (indexA !== -1) return -1;
						if (indexB !== -1) return 1;
						return 0;
					});
				} else {
					finalMandals.reverse();
				}

				setMandals(finalMandals);
				setLoading(false);
			}
		};

		processData();

		return () => {
			isMounted = false;
		};
	}, [
		sharedMandals,
		darshanFoldersConfig,
		loadingMandals,
		loadingDarshanFolders,
		githubToken,
	]);

	// `selectedMandal` is a snapshot from the moment it was opened. Show the
	// latest data for it instead, so photos that land after opening (the server
	// snapshot following the cached one) appear in the open screen.
	const liveSelectedMandal = selectedMandal
		? (mandals.find((m) => m.id === selectedMandal.id) ?? selectedMandal)
		: null;

	// Opening a mandal counts as seeing it, however it was opened. The tile's
	// onClick marked it, but a notification opens the mandal directly, so its
	// NEW badge stayed. Re-runs as more photos load while it is open.
	const openGalleryIds = liveSelectedMandal?.gallery?.length
		? idsByRecency(liveSelectedMandal.gallery)
		: [];
	const openGalleryFingerprint = openGalleryIds.join(",");
	// biome-ignore lint/correctness/useExhaustiveDependencies: the fingerprint stands in for the id list, which is rebuilt every render
	useEffect(() => {
		if (!liveSelectedMandal || !openGalleryFingerprint) return;
		markSeen(`cpbs_darshan_mandal_${liveSelectedMandal.id}`, openGalleryIds);
	}, [liveSelectedMandal?.id, openGalleryFingerprint]);

	const hideMain = !!selectedMandal || transitioning;

	return (
		<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
			<div
				className="absolute inset-0 opacity-10 pointer-events-none"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
					display: hideMain ? "none" : "block",
				}}
			></div>

			<div
				className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 shadow-lg z-10 sticky top-0 rounded-b-3xl border-b-2 border-ry-gold/40"
				style={{ display: hideMain ? "none" : "flex" }}
			>
				<button
					onClick={() => window.history.back()}
					className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>
				<h2 className="font-display text-xl font-semibold flex items-center gap-2 tracking-wide leading-none drop-shadow-md">
					<ImageIcon className="w-6 h-6" />
					{t.title}
				</h2>
			</div>

			<div
				className={`flex-1 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-0`}
				style={{ display: hideMain ? "none" : "block" }}
			>
				<OfflineBanner className="mb-4" />
				{loading ? (
					<div className="flex flex-col items-center justify-center py-20">
						<Loader2 className="animate-spin text-saffron-500 mb-4" size={32} />
						<p className="text-slate-500 dark:text-ink-300 font-medium">
							{t.loading}
						</p>
					</div>
				) : (
					<div
						className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 landscape:lg:gap-y-6"
						data-tour="darshan-grid"
					>
						{mandals.map((mandal, index) => {
							const hasUpdates = mandal.gallery && mandal.gallery.length > 0;

							// Id-set newness. The old token was
							// `String(gallery[0].releaseId || gallery[0].id)`, which
							// collapsed every asset in a GitHub release into one value —
							// so photos added to an existing release never badged — and
							// flipped from releaseId to Firestore id the moment Firestore
							// filled, badging for everyone at once.
							const galleryIds = hasUpdates ? idsByRecency(mandal.gallery) : [];
							const isNewToUser = hasUnseen(
								`cpbs_darshan_mandal_${mandal.id}`,
								galleryIds,
							);

							return (
								<div
									key={mandal.id}
									onClick={() => {
										if (hasUpdates) {
											markSeen(`cpbs_darshan_mandal_${mandal.id}`, galleryIds);
										} else {
											window.dispatchEvent(new Event("cpbs_storage_update"));
										}
										openMandal(mandal);
									}}
									className="flex flex-col items-center gap-2 cursor-pointer group animate-fade-in-up md:relative"
									style={{ animationDelay: `${index * 50}ms` }}
									data-tour="darshan-mandal"
								>
									<div
										className={`relative w-20 h-20 sm:w-24 sm:h-24 landscape:lg:w-36 landscape:lg:h-36 rounded-full p-1 transition-transform group-active:scale-95 ${hasUpdates ? "bg-gradient-to-tr from-saffron-400 to-pink-500" : "bg-slate-200 dark:bg-slate-700"}`}
									>
										<div className="w-full h-full bg-white dark:bg-slate-900 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center overflow-hidden relative">
											{mandal.gallery && mandal.gallery.length > 0 ? (
												<CachedImage
													thumbWidth={THUMB.tile}
													src={mandal.gallery[0].url}
													alt={mandal.name}
													className="w-full h-full object-cover"
												/>
											) : (
												<span className="text-2xl sm:text-3xl font-bold text-slate-300 dark:text-slate-600">
													{mandal.name.charAt(0)}
												</span>
											)}
										</div>
										{isNewToUser && (
											<div className="absolute top-0 right-0 sm:-right-1 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md shadow-red-500/40 z-20 animate-pulse border border-white dark:border-slate-900 pointer-events-none">
												NEW
											</div>
										)}
									</div>

									<span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 text-center line-clamp-2">
										{mandal.name.replace(/\s*mandal\s*/i, "")}
									</span>
								</div>
							);
						})}
						{mandals.length === 0 && (
							<div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-ink-400">
								<ImageIcon size={48} className="mb-4 opacity-50" />
								<p>{t.noDarshan}</p>
							</div>
						)}
					</div>
				)}
			</div>

			{transitioning && !selectedMandal && (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="animate-spin text-saffron-500" size={32} />
				</div>
			)}

			{liveSelectedMandal && (
				<MandalDetailScreen
					mandal={liveSelectedMandal}
					onClose={closeMandal}
					isHindi={isHindi}
					onOpenProfile={onOpenProfile}
					initialDate={selectedMandalInitialDate}
				/>
			)}
		</div>
	);
};

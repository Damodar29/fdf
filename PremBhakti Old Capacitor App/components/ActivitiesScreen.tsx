import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { doc, getDoc } from "firebase/firestore";
import {
	ArrowLeft,
	Calendar,
	Download,
	Eye,
	GalleryHorizontal,
	Heart,
	Image as ImageIcon,
	LayoutGrid,
	Loader2,
	Maximize2,
	Play,
	PlayCircle,
	Share2,
	SkipBack,
	SkipForward,
	Video as VideoIcon,
	X,
	Youtube,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APP_BASE_URL } from "../constants";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useSharedFirebase } from "../context/SharedFirebaseContext";
import { useMetrics } from "../hooks/useMetrics";
import {
	contentFingerprint,
	hasUnseen,
	idsByRecency,
	markSeen,
	useMarkVisitedOnMount,
	useSeenVersion,
} from "../hooks/useNewBadge";
import { useViewTracker } from "../hooks/useViewTracker";
import { db } from "../services/firebase";
import { useDevicePerformance } from "../src/hooks/useDevicePerformance";
import {
	type GalleryItem,
	MANDAL_LIST,
	type MandalData,
	type MandalVideo,
} from "../src/types/mandal";
import { copyToClipboard } from "../utils/clipboard";
import {
	formatDateChipLabel,
	formatDisplayDate,
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
import { VideosScreen } from "./VideosScreen";
import CustomVideoPlayer from "./YouTubePlayer";

// ---------------------------------------------------------------------------
// Web-only: module-level cache so we don't re-fetch GitHub on every Firestore
// snapshot update. TTL = 5 minutes. Android uses native filesystem caching
// via CachedImage, so this block is intentionally skipped on native.
// ---------------------------------------------------------------------------
interface _GHReleaseCacheAct {
	releases: GitHubRelease[];
	ts: number;
	token: string;
}
let _activityGHCache: _GHReleaseCacheAct | null = null;
const GH_CACHE_TTL_MS_ACT = 5 * 60 * 1000; // 5 minutes

async function fetchActivityReleases(
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
			_activityGHCache &&
			_activityGHCache.token === token &&
			now - _activityGHCache.ts < GH_CACHE_TTL_MS_ACT
		) {
			return _activityGHCache.releases;
		}
	} else {
		try {
			const cached = await Preferences.get({ key: "gh_activities_cache" });
			if (cached.value) {
				const parsed = JSON.parse(cached.value);
				if (
					!Array.isArray(parsed) &&
					parsed.token === token &&
					Date.now() - parsed.ts < GH_CACHE_TTL_MS_ACT
				) {
					return parsed.releases || [];
				}
			}
		} catch (_e) {}
	}

	const url = isNative
		? `https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?t=${Date.now()}&per_page=100`
		: `https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?per_page=100`;

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `token ${token}`,
				Accept: "application/vnd.github.v3+json",
			},
		});

		if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
		const releases: GitHubRelease[] = await response.json();

		if (!isNative) {
			_activityGHCache = { releases, ts: Date.now(), token };
		}

		if (isNative) {
			Preferences.set({
				key: "gh_activities_cache",
				value: JSON.stringify({ releases, ts: Date.now(), token }),
			});
		}

		return Array.isArray(releases) ? releases : [];
	} catch (_e) {
		if (isNative) {
			try {
				const cached = await Preferences.get({ key: "gh_activities_cache" });
				if (cached.value) return parseCache(cached.value);
			} catch (_err) {}
		}
		return [];
	}
}

interface ActivitiesScreenProps {
	onBack: () => void;
	scrollBarSide?: "left" | "right";
	initialShowPhotos?: boolean;
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
	body: string;
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
	mandal: MandalData;
	isPaused?: boolean;
	isHindi: boolean;
}> = ({
	images,
	initialIndex,
	onClose,
	getMetrics,
	incrementLike,
	incrementView,
	hasLiked,
	mandal,
	isPaused,
	isHindi,
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
				{ isPopup: true, view: "activities", layer: "activities_story_viewer" },
				"",
			);
		}
		const handlePopState = (e: PopStateEvent) => {
			if (e.state?.layer !== "activities_story_viewer") onCloseRef.current();
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
		const img = e.currentTarget;
		setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
	};

	const handleShare = async (e: React.MouseEvent | React.TouchEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const currentDate = images[currentIndex]?.date;
		const dateStr = currentDate ? formatForDateInput(currentDate) : "all";
		const url = `https://chaitanyaprembhakti.org/v/mandal-photos/${mandal.id}/${dateStr}`;
		try {
			const displayDateStr = currentDate
				? ` (${formatDisplayDate(currentDate)})`
				: "";
			await Share.share({
				title: isHindi ? "तस्वीरें साझा करें" : "Share Photos",
				text: isHindi
					? `🙏 'Prem Bhakti' app पर '${mandal.name}'${displayDateStr} की तस्वीरें देखें:\n\n`
					: `🙏 Watch these photos of '${mandal.name}'${displayDateStr} on 'Prem Bhakti' app:\n\n`,
				url: url,
				dialogTitle: isHindi ? "साझा करें" : "Share",
			});
		} catch (err) {
			console.error("Share failed", err);
			void copyToClipboard(url);
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
		<div className="fixed inset-0 z-[100] bg-black/90 flex justify-center">
			<div className="w-full sm:max-w-md bg-black h-full flex flex-col relative overflow-hidden shadow-2xl">
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
										pinch.isZoomed ||
										pinch.isInteracting ||
										isPaused ||
										isHolding
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
					<div className="flex gap-2 shrink-0 pointer-events-auto">
						<button
							onTouchEnd={handleShare}
							onClick={handleShare}
							className="p-2.5 rounded-full bg-black/30 text-white active:scale-90 transition-transform"
						>
							<Share2 size={20} />
						</button>
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
							className="p-2.5 rounded-full bg-black/30 text-white active:scale-90 transition-transform"
						>
							<X size={20} />
						</button>
					</div>
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
			</div>
		</div>,
		document.body,
	);
};
// --- Activity Video Player Modal Component ---
const getYouTubeVideoId = (url: string) => {
	const regExp =
		/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/;
	const match = url.match(regExp);
	return match ? match[1] : null;
};

const ActivityVideoPlayer: React.FC<{
	video: MandalVideo;
	mandal: MandalData;
	mandalVideos: MandalVideo[];
	onSelectVideo: (v: MandalVideo) => void;
	onShowToast: (text: string, type: ToastType) => void;
	getMetrics: (id: string) => { likes: number; views: number };
	incrementLike: (id: string) => void;
	incrementView: (id: string) => void;
	hasLiked: (id: string) => boolean;
	onClose: () => void;
}> = ({
	video,
	mandal,
	mandalVideos,
	onSelectVideo,
	onShowToast,
	getMetrics,
	incrementLike,
	incrementView,
	hasLiked,
	onClose,
}) => {
	const { settingsLanguage } = useSettings();
	const isHindi = settingsLanguage === "hi";
	const [isDescExpanded, setIsDescExpanded] = useState(false);
	const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);

	const isYouTube = !!getYouTubeVideoId(video.url);
	const ytId = getYouTubeVideoId(video.url);

	const getVideoThumb = (v: MandalVideo) => {
		if (v.thumbnailUrl) return v.thumbnailUrl;
		const id = getYouTubeVideoId(v.url);
		if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
		return null;
	};

	const [ytError, setYtError] = useState(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setYtError(false);
	}, [video.id]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		incrementView(video.id);
	}, [video.id]);

	useEffect(() => {
		if (!isYouTube) return;
		const handleMessage = (event: MessageEvent) => {
			if (typeof event.data !== "string") return;
			try {
				const data = JSON.parse(event.data);

				// Fallback catch-all for when iframe fails to load or play
				if (data.event === "onError" || data.event === "error") {
					setYtError(true);
				}

				if (data.event === "infoDelivery" && data.info) {
					// errorCode 150 or 101 means restricted from playing in embedded players
					if (
						data.info.videoData &&
						(data.info.videoData.errorCode === 150 ||
							data.info.videoData.errorCode === 101)
					) {
						setYtError(true);
					}
				}
			} catch (_e) {}
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [isYouTube]);

	const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
		e.currentTarget.contentWindow?.postMessage(
			JSON.stringify({ event: "listening", id: 1 }),
			"*",
		);
	};

	const currentIndex = mandalVideos.findIndex((v) => v.id === video.id);
	const hasNext = currentIndex !== -1 && currentIndex < mandalVideos.length - 1;
	const hasPrev = currentIndex > 0;

	const handleShareVideo = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const url = `https://chaitanyaprembhakti.org/v/mandal/${mandal.id}/${video.id}`;
		try {
			const mandalDateStr = video.date
				? ` (${formatDisplayDate(video.date)})`
				: "";
			await Share.share({
				title: isHindi ? "वीडियो साझा करें" : "Share Video",
				text: isHindi
					? `🙏 'Prem Bhakti' app पर '${mandal.name}'${mandalDateStr} का यह वीडियो देखें:\n\n${video.title}\n\n`
					: `🙏 Watch this video of '${mandal.name}'${mandalDateStr} on 'Prem Bhakti' app:\n\n${video.title}\n\n`,
				url: url,
				dialogTitle: isHindi ? "साझा करें" : "Share",
			});
		} catch (err) {
			console.error("Share failed", err);
			void copyToClipboard(url);
			onShowToast(
				isHindi ? "लिंक कॉपी हो गया!" : "Link copied to clipboard!",
				"success",
			);
		}
	};

	const handleNext = () => {
		if (hasNext) {
			window.history.replaceState(
				{
					isPopup: true,
					view: "activities",
					layer: "activities_video_player",
					videoId: mandalVideos[currentIndex + 1].id,
				},
				"",
			);
			onSelectVideo(mandalVideos[currentIndex + 1]);
		}
	};
	const handlePrev = () => {
		if (hasPrev) {
			window.history.replaceState(
				{
					isPopup: true,
					view: "activities",
					layer: "activities_video_player",
					videoId: mandalVideos[currentIndex - 1].id,
				},
				"",
			);
			onSelectVideo(mandalVideos[currentIndex - 1]);
		}
	};

	// Note: fullscreen is now CSS-based in YouTubePlayer — no native requestFullscreen needed here

	const renderUpNext = () => (
		<>
			{mandalVideos.length > 1 && (
				<div className="border-t border-neutral-800 px-4 pt-3 md:border-t-0 md:pt-4">
					<h3 className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">
						Up Next
					</h3>
					<div className="flex flex-col gap-2.5">
						{mandalVideos
							.filter((v) => v.id !== video.id)
							.map((v) => {
								const thumb = getVideoThumb(v);
								return (
									<div
										key={v.id}
										onClick={() => {
											window.history.replaceState(
												{
													isPopup: true,
													view: "activities",
													layer: "activities_video_player",
													videoId: v.id,
												},
												"",
											);
											onSelectVideo(v);
										}}
										className="flex gap-3 cursor-pointer group hover:bg-neutral-800/60 rounded-xl p-1.5 transition-colors active:scale-[0.98]"
									>
										<div className="w-[120px] min-w-[120px] aspect-video bg-neutral-800 rounded-lg overflow-hidden relative">
											{thumb ? (
												<CachedImage
													thumbWidth={THUMB.tile}
													src={thumb}
													alt={v.title}
													className="w-full h-full object-cover"
													loading="lazy"
													style={
														!v.useDefaultThumbnail
															? {
																	objectPosition: `${v.thumbnailXOffset ?? 50}% ${v.thumbnailYOffset ?? 50}%`,
																}
															: {}
													}
												/>
											) : (
												<div className="w-full h-full flex items-center justify-center text-neutral-600">
													<VideoIcon size={24} />
												</div>
											)}
											<div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
												<Play size={20} className="text-white fill-current" />
											</div>
											<div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm border border-white/10 backdrop-blur-sm tracking-wider">
												{mandalVideos.findIndex((vid) => vid.id === v.id) + 1}/
												{mandalVideos.length}
											</div>
										</div>
										<div className="flex-1 min-w-0 py-0.5">
											<p className="text-white text-sm font-medium line-clamp-2 leading-tight group-hover:text-red-400 transition-colors">
												{v.title}
											</p>
											{v.date && (
												<span className="text-neutral-500 text-xs mt-1 block">
													{formatDisplayDate(v.date)}
												</span>
											)}
										</div>
									</div>
								);
							})}
					</div>
				</div>
			)}
		</>
	);

	return createPortal(
		<div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200 font-sans">
			{/* Universal Navigation Header — hidden while the custom player is fullscreen,
			    since it renders its own title bar and the two would overlap at the top */}
			<div
				className="w-full flex-none bg-neutral-900 border-b border-neutral-800 px-2 pt-[env(safe-area-inset-top)] items-center z-30 h-14 md:h-16 shrink-0"
				style={{ display: isPlayerFullscreen ? "none" : "flex" }}
			>
				<button
					onClick={() => window.history.back()}
					className="p-2 ml-1 rounded-full hover:bg-neutral-800 text-white transition active:scale-95"
				>
					<ArrowLeft size={24} />
				</button>
				<h2 className="text-white text-base md:text-lg font-semibold line-clamp-1 ml-2 mr-4">
					{video.title}
				</h2>
			</div>

			<div className="w-full flex-1 min-h-0 bg-black flex flex-col md:flex-row relative overflow-hidden">
				{/* Left Column (Video + Info) */}
				<div className="flex-1 flex flex-col md:block bg-black h-full overflow-hidden md:overflow-y-auto md:custom-scrollbar">
					<div className="w-full relative bg-black flex flex-col items-center shrink-0 z-20 border-b border-neutral-800">
						{isYouTube ? (
							<div className="w-full bg-black flex flex-col items-center">
								{ytError ? (
									<div className="w-full flex flex-col bg-neutral-900 border-b border-neutral-800">
										<div className="w-full aspect-video relative bg-black flex items-center justify-center overflow-hidden">
											<CachedImage
												thumbWidth={THUMB.medium}
												src={getVideoThumb(video) || ""}
												alt={video.title}
												className="w-full h-full object-cover opacity-50"
											/>
											<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
												<div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg">
													<Youtube size={32} className="text-red-500" />
												</div>
											</div>
										</div>
										<div className="w-full px-4 py-5 flex flex-col items-center text-center">
											<p className="text-neutral-300 text-sm mb-4">
												{isHindi
													? "यह वीडियो केवल YouTube पर ही देखा जा सकता है।"
													: "This video can only be watched directly on YouTube."}
											</p>

											<button
												onClick={() =>
													Browser.open({
														url: `https://www.youtube.com/watch?v=${ytId}`,
													})
												}
												className="w-full max-w-[280px] bg-red-600 hover:bg-red-500 active:scale-95 transition-all text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
											>
												<Play size={20} className="fill-current" />{" "}
												{isHindi ? "YouTube पर देखें" : "Watch on YouTube"}
											</button>
										</div>
									</div>
								) : (
									<>
										<div className="w-full max-w-4xl aspect-video md:rounded-xl overflow-hidden shadow-2xl border-0 md:border border-neutral-800 bg-black landscape:max-h-[100vh] landscape:h-[100vh]">
											<iframe
												onLoad={handleIframeLoad}
												src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(APP_BASE_URL)}&widgetid=1`}
												title={video.title}
												allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
												allowFullScreen
												className="w-full h-full"
											></iframe>
										</div>
										<div className="w-full bg-neutral-900 border-t border-neutral-800 p-2 flex items-center justify-between px-4">
											<span className="text-neutral-500 text-xs font-medium">
												Video unavailable?
											</span>
											<button
												onClick={() => setYtError(true)}
												className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-bold transition-colors bg-red-400/10 px-3 py-2 rounded-lg active:scale-95 uppercase tracking-wide"
											>
												<Youtube size={14} /> Open Youtube
											</button>
										</div>
									</>
								)}
							</div>
						) : (
							<div className="w-full shrink-0 aspect-video max-h-[40vh] md:max-h-[70vh] bg-black relative overflow-hidden md:rounded-xl shadow-2xl md:border border-neutral-800">
								<CustomVideoPlayer
									video={{
										id: video.id,
										title: video.title,
										url: video.url,
										date: video.date,
										folderId: "",
									}}
									onNext={handleNext}
									onPrev={handlePrev}
									hasNext={hasNext}
									hasPrev={hasPrev}
									hdUrl={video.hdUrl}
									onFullscreenChange={setIsPlayerFullscreen}
								/>
							</div>
						)}
					</div>

					<div className="bg-neutral-900 px-4 pt-4 pb-3 shadow-md z-10 md:shadow-none">
						<h2 className="text-white text-base sm:text-lg font-semibold leading-snug">
							{video.title}
						</h2>
						<div className="flex items-center justify-between mt-2">
							{video.date ? (
								<div className="flex items-center gap-2 text-neutral-400 text-xs">
									<Calendar size={13} />
									<span>{formatDisplayDate(video.date)}</span>
								</div>
							) : (
								<div />
							)}
							<div className="flex items-center gap-4">
								<button
									onClick={() => incrementLike(video.id)}
									className="flex items-center gap-1.5 text-neutral-300 hover:text-white transition active:scale-95"
								>
									<Heart
										size={18}
										className={
											hasLiked(video.id) ? "fill-red-500 text-red-500" : ""
										}
									/>
									<span className="text-sm font-medium">
										{getMetrics(video.id).likes || 0}
									</span>
								</button>
								<div className="flex items-center gap-1.5 text-neutral-400">
									<Eye size={18} />
									<span className="text-sm font-medium">
										{getMetrics(video.id).views || 0}
									</span>
								</div>
								<button
									onClick={handleShareVideo}
									className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-medium transition active:scale-95 ml-2"
								>
									<Share2 size={16} />
									<span>{isHindi ? "शेयर" : "Share"}</span>
								</button>
							</div>
						</div>
						{/* Prev/Next buttons for YouTube embeds */}
						{isYouTube && (
							<div className="flex items-center gap-3 mt-3 pt-3 border-t border-neutral-800">
								<button
									onClick={handlePrev}
									disabled={!hasPrev}
									className={`flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 py-2 rounded-full transition ${hasPrev ? "bg-neutral-800 text-white hover:bg-neutral-700 active:scale-95" : "bg-neutral-800/50 text-neutral-600 cursor-not-allowed"}`}
								>
									<SkipBack size={14} /> Prev
								</button>
								<button
									onClick={handleNext}
									disabled={!hasNext}
									className={`flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 py-2 rounded-full transition ${hasNext ? "bg-neutral-800 text-white hover:bg-neutral-700 active:scale-95" : "bg-neutral-800/50 text-neutral-600 cursor-not-allowed"}`}
								>
									Next <SkipForward size={14} />
								</button>
							</div>
						)}
					</div>

					<div className="flex-1 min-h-0 bg-neutral-900 overflow-y-auto md:overflow-visible pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
						{/* Description */}
						{video.description && (
							<div className="px-4 pb-4">
								<div
									className={`text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap ${!isDescExpanded ? "line-clamp-3" : "max-h-[250px] overflow-y-auto pr-2 custom-scrollbar border border-neutral-800 rounded-xl p-3 bg-neutral-900/50"}`}
								>
									{video.description}
								</div>
								{video.description.length > 100 && (
									<button
										onClick={() => setIsDescExpanded(!isDescExpanded)}
										className="text-neutral-400 hover:text-white text-sm font-semibold mt-1 active:scale-95 transition-transform"
									>
										{isDescExpanded
											? isHindi
												? "कम दिखाएं"
												: "Show Less"
											: isHindi
												? "और पढ़ें"
												: "Show More"}
									</button>
								)}
							</div>
						)}

						{/* Mobile Only: Up Next */}
						<div className="md:hidden">{renderUpNext()}</div>
					</div>
				</div>

				{/* Right Sidebar (Desktop Only) */}
				<div className="hidden md:flex w-80 lg:w-96 flex-col border-l border-neutral-800 bg-neutral-900 h-full overflow-y-auto custom-scrollbar shrink-0">
					{renderUpNext()}
				</div>
			</div>
		</div>,
		document.body,
	);
};

// --- Activity Detail Modal Component ---
const ActivityDetailScreen: React.FC<{
	mandal: MandalData;
	onClose: () => void;
	isHindi: boolean;
	onOpenProfile?: () => void;
	initialDate?: string | null;
	initialVideoId?: string | null;
}> = ({
	mandal,
	onClose,
	isHindi,
	onOpenProfile,
	initialDate,
	initialVideoId,
}) => {
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
	const [playingVideo, setPlayingVideo] = useState<MandalVideo | null>(() => {
		if (initialVideoId && mandal.videos) {
			return mandal.videos.find((v) => v.id === initialVideoId) || null;
		}
		return null;
	});
	const [confirmDialog, setConfirmDialog] = useState<{
		message: string;
		onConfirm: () => void;
	} | null>(null);
	const [viewMode, setViewMode] = useState<"horizontal" | "strip" | "grid">(
		() => {
			return (
				(localStorage.getItem("cpbs_activity_view_mode") as
					| "horizontal"
					| "strip"
					| "grid") || "horizontal"
			);
		},
	);

	useEffect(() => {
		localStorage.setItem("cpbs_activity_view_mode", viewMode);
	}, [viewMode]);

	// So the "Watch All Videos" NEW badge below clears the moment it is tapped.
	useSeenVersion();

	const { getMetrics, incrementLike, incrementView, incrementViews, hasLiked } =
		useMetrics("activities");
	const { user, profile } = useAuth();

	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	const stateRef = useRef({ storyViewerData, playingVideo });
	useEffect(() => {
		stateRef.current = { storyViewerData, playingVideo };
	}, [storyViewerData, playingVideo]);

	const detailHistoryPushed = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (!detailHistoryPushed.current) {
			detailHistoryPushed.current = true;
			if (
				window.history.state?.layer !== "activities_mandal_detail" &&
				window.history.state?.layer !== "activities_video_player"
			) {
				window.history.pushState(
					{
						isPopup: true,
						view: "activities",
						layer: "activities_mandal_detail",
						mandalId: mandal.id,
					},
					"",
				);
				if (initialVideoId) {
					window.history.pushState(
						{
							isPopup: true,
							view: "activities",
							layer: "activities_video_player",
							videoId: initialVideoId,
						},
						"",
					);
				}
			}
		}
		const handlePopState = (e: PopStateEvent) => {
			const state = e.state;

			// If story viewer is open, it has its own handler — don't act
			if (state?.layer === "activities_story_viewer") return;

			if (
				!state ||
				state.layer === "activities_main" ||
				state.layer === "activities_photos"
			) {
				onCloseRef.current();
				return;
			}

			if (state.layer === "activities_mandal_detail") {
				setPlayingVideo(null);
			} else if (state.layer === "activities_video_player") {
				if (state.videoId && stateRef.current.playingVideo) {
					// Try to restore previous video. But wait, `mandal.videos` is accessible right here!
					if (mandal.videos) {
						const v = mandal.videos.find((x) => x.id === state.videoId);
						if (v) setPlayingVideo(v);
					}
				}
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [mandal.id]); // eslint-disable-line react-hooks/exhaustive-deps

	// Back-button support for popups
	useEffect(() => {
		if (confirmDialog) {
			window.history.pushState(
				{ isPopup: true, view: "activities", layer: "activities_popup" },
				"",
			);
		}
	}, [confirmDialog]);

	useEffect(() => {
		const handlePopState = (e: PopStateEvent) => {
			if (confirmDialog && e.state?.layer !== "activities_popup")
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
			if (isGallery) {
				// Gallery mode: show all photos directly (no date grouping)
				setStoryViewerData({ images: sortedGallery, initialIndex: index });
			} else if (selectedDate) {
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
				"Activities",
				date,
				`${safeName}.jpg`,
				mandalSubfolder,
			);
			if (Capacitor.isNativePlatform()) {
				setToastMessage({
					text: `Photo saved to ${resultPath || "Pictures/Prem Bhakti/Activities/"}`,
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

	const sortedGallery = useMemo(() => {
		return [...(mandal.gallery || [])].sort((a, b) => {
			const dateDiff =
				new Date(formatForDateInput(b.date)).getTime() -
				new Date(formatForDateInput(a.date)).getTime();
			if (dateDiff !== 0) return dateDiff;
			if (a.order !== b.order) return a.order - b.order;
			return a.id.localeCompare(b.id);
		});
	}, [mandal.gallery]);

	const groupedGallery = useMemo(() => {
		const groups: Record<string, typeof mandal.gallery> = {};
		sortedGallery.forEach((item) => {
			if (!groups[formatForDateInput(item.date)])
				groups[formatForDateInput(item.date)] = [];
			groups[formatForDateInput(item.date)].push(item);
		});
		return groups;
	}, [sortedGallery]);

	const availableDates = useMemo(() => {
		const dates = new Set<string>();
		Object.keys(groupedGallery).forEach((date) => dates.add(date));
		(mandal.videos || []).forEach((video) => {
			// Normalise like the gallery keys above. Video dates arrive in both
			// DD-MM-YYYY and YYYY-MM-DD; adding a raw one produced a SECOND chip for
			// a day that already had a gallery chip, and that duplicate chip showed
			// no photos (groupedGallery is keyed YYYY-MM-DD) and sorted wrongly.
			if (video.date) dates.add(formatForDateInput(video.date));
		});
		return Array.from(dates).sort(
			(a, b) => new Date(b).getTime() - new Date(a).getTime(),
		);
	}, [groupedGallery, mandal.videos]);

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

	const globalProgram = mandal.weeklyProgram?.enabled
		? mandal.weeklyProgram
		: null;
	// Date-specific program lookup, tolerant of both stored key formats. The admin
	// panel keys `dailyPrograms` by the RAW gallery date, which can be DD-MM-YYYY,
	// while `selectedDate` here is always normalised to YYYY-MM-DD — so a plain
	// lookup silently missed and the day's program card never appeared.
	const dailyProg = selectedDate
		? (mandal.dailyPrograms?.[selectedDate] ??
			mandal.dailyPrograms?.[formatDisplayDate(selectedDate)])
		: null;
	const activeDailyProgram = dailyProg?.enabled ? dailyProg : null;

	const isGallery = mandal.name.toLowerCase().endsWith("gallery");

	return createPortal(
		<div className="fixed inset-0 z-[70] bg-rose-50 dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
			<div
				className="flex-none shrink-0 bg-gradient-to-r from-saffron-500 to-orange-600 text-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 shadow-lg z-10"
				style={{ display: hideDetail ? "none" : "flex" }}
			>
				<button
					onClick={() => window.history.back()}
					className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>
				<div className="flex-1 min-w-0">
					<h2 className="text-xl font-bold truncate leading-tight drop-shadow-md">
						{mandal.name.replace(/\s*mandal\s*/i, "")}
					</h2>
					<p className="text-xs opacity-90 truncate">Activity Gallery</p>
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
				className="flex-1 min-h-0 overflow-y-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]"
				style={{ display: hideDetail ? "none" : "block" }}
			>
				<div className="md:max-w-4xl md:mx-auto w-full">
					{/* Global Program Card - STAYS ABOVE DATE CIRCLES */}
					{globalProgram && (
						<div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-4 shrink-0 relative overflow-hidden border-l-4 border-l-blue-500">
							<div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-400/20 to-transparent rounded-bl-full pointer-events-none"></div>
							<h3 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
								<Calendar size={18} className="text-blue-500" />
								{globalProgram.title}
							</h3>
							<p className="text-sm text-slate-600 dark:text-slate-300 mb-3 whitespace-pre-wrap">
								{globalProgram.description}
							</p>

							<div className="flex items-center justify-between text-xs font-medium bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl">
								<span className="text-slate-500 dark:text-slate-400">
									{formatDisplayDate(globalProgram.date)}
								</span>
								{globalProgram.locationUrl && (
									<button
										onClick={() =>
											window.open(
												globalProgram.locationUrl,
												"_blank",
												"noopener,noreferrer",
											)
										}
										className="text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30"
									>
										{isHindi ? "मैप पर देखें" : "View on Map"}
									</button>
								)}
							</div>
						</div>
					)}

					{isGallery &&
						(mandal.videos || []).length > 0 &&
						(() => {
							const sortedVids = [...mandal.videos!].sort(
								(a, b) => a.order - b.order,
							);
							const videosKey = `cpbs_activity_videos_latest_${mandal.id}`;
							const vIds = idsByRecency(mandal.videos!);
							// This badge is now reachable: the mandal tile no longer marks
							// videos seen on the way in, so it survives until the user
							// actually taps through to them.
							const isVideosNewToUser = hasUnseen(videosKey, vIds);

							return (
								<div className="mb-4">
									<button
										onClick={() => {
											markSeen(videosKey, vIds);
											const firstVideo = sortedVids[0];
											if (firstVideo) {
												window.history.pushState(
													{
														isPopup: true,
														view: "activities",
														layer: "activities_video_player",
														videoId: firstVideo.id,
													},
													"",
												);
												setPlayingVideo(firstVideo);
											}
										}}
										className="w-full bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl p-4 flex items-center justify-between text-white shadow-lg shadow-rose-500/30 active:scale-[0.98] transition-transform overflow-hidden relative group"
									>
										{isVideosNewToUser && (
											<div className="absolute top-2 right-12 bg-white text-rose-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md z-20 animate-pulse">
												NEW
											</div>
										)}
										<div className="flex items-center gap-4 z-10">
											<div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
												<PlayCircle size={28} className="text-white" />
											</div>
											<div className="text-left">
												<h3 className="font-bold text-lg leading-tight">
													{isHindi ? "सभी वीडियो देखें" : "Watch All Videos"}
												</h3>
												<p className="text-sm text-pink-100">
													{isHindi
														? `${mandal.videos?.length || 0} वीडियो उपलब्ध`
														: `${mandal.videos?.length || 0} videos available`}
												</p>
											</div>
										</div>
										<div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm z-10">
											<PlayCircle size={20} className="text-white" />
										</div>
									</button>
								</div>
							);
						})()}

					{availableDates.length > 0 ||
					(isGallery &&
						((mandal.videos || []).length > 0 || sortedGallery.length > 0)) ? (
						<div>
							{!isGallery && availableDates.length > 0 && (
								<div className="flex overflow-x-auto gap-4 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800 scrollbar-hide shrink-0">
									{availableDates.map((date) => {
										const isSelected = selectedDate === date;
										const firstImage =
											groupedGallery[date]?.[0]?.url ||
											(mandal.videos || []).find(
												(v) =>
													formatForDateInput(v.date) ===
													formatForDateInput(date),
											)?.thumbnailUrl;

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
													className={`w-16 h-16 rounded-full p-[2px] ${isSelected ? "bg-gradient-to-tr from-pink-500 to-rose-500" : "bg-slate-300 dark:bg-slate-700"}`}
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
													className={`text-[10px] font-medium whitespace-nowrap ${isSelected ? "text-pink-600 dark:text-pink-400 font-bold" : "text-slate-600 dark:text-slate-400"}`}
												>
													{displayDate}
												</span>
											</button>
										);
									})}
								</div>
							)}

							{/* Daily Specific Program Card - NOW BELOW DATE CIRCLES */}
							{activeDailyProgram && (
								<div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 shrink-0 relative overflow-hidden border-l-4 border-l-pink-500">
									<div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-pink-400/20 to-transparent rounded-bl-full pointer-events-none"></div>
									<h3 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
										<Calendar size={18} className="text-pink-500" />
										{activeDailyProgram.title}
									</h3>
									<p className="text-sm text-slate-600 dark:text-slate-300 mb-3 whitespace-pre-wrap">
										{activeDailyProgram.description}
									</p>

									<div className="flex items-center justify-between text-xs font-medium bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl">
										<span className="text-slate-500 dark:text-slate-400">
											{formatDisplayDate(activeDailyProgram.date)}
										</span>
										{activeDailyProgram.locationUrl && (
											<button
												onClick={() =>
													window.open(
														activeDailyProgram.locationUrl,
														"_blank",
														"noopener,noreferrer",
													)
												}
												className="text-pink-600 dark:text-pink-400 hover:underline px-2 py-1 rounded-lg bg-pink-50 dark:bg-pink-900/30"
											>
												{isHindi ? "मैप पर देखें" : "View on Map"}
											</button>
										)}
									</div>
								</div>
							)}

							{/* Videos for selected date — shown ABOVE photos */}
							{!isGallery &&
								selectedDate &&
								(mandal.videos || []).filter(
									(v) =>
										formatForDateInput(v.date) ===
										formatForDateInput(selectedDate),
								).length > 0 && (
									<div className="mb-4">
										<div className="flex items-center gap-2 mb-3">
											<PlayCircle size={16} className="text-rose-500" />
											<h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
												{isHindi ? "वीडियो" : "Videos"}
											</h4>
										</div>
										<div className="space-y-2">
											{(mandal.videos || [])
												.filter(
													(v) =>
														formatForDateInput(v.date) ===
														formatForDateInput(selectedDate),
												)
												.sort((a, b) => a.order - b.order)
												.map((video) => {
													const metrics = getMetrics(video.id);
													return (
														<button
															key={video.id}
															onClick={() => {
																window.history.pushState(
																	{
																		isPopup: true,
																		view: "activities",
																		layer: "activities_video_player",
																		videoId: video.id,
																	},
																	"",
																);
																setPlayingVideo(video);
															}}
															className="w-full flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm active:scale-[0.98] transition-transform text-left"
														>
															<div className="w-16 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 relative">
																{video.thumbnailUrl ? (
																	<CachedImage
																		thumbWidth={THUMB.small}
																		src={video.thumbnailUrl}
																		alt={video.title}
																		className="w-full h-full object-cover"
																		style={
																			!video.useDefaultThumbnail
																				? {
																						objectPosition: `${video.thumbnailXOffset ?? 50}% ${video.thumbnailYOffset ?? 50}%`,
																					}
																				: {}
																		}
																	/>
																) : (
																	<div className="w-full h-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
																		<PlayCircle
																			size={22}
																			className="text-white"
																		/>
																	</div>
																)}
																<div className="absolute inset-0 flex items-center justify-center bg-black/20">
																	<PlayCircle
																		size={18}
																		className="text-white drop-shadow"
																	/>
																</div>
															</div>
															<div className="flex-1 min-w-0">
																<p className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2">
																	{video.title}
																</p>
																<div className="flex items-center gap-3 mt-1">
																	<p className="text-xs text-slate-500 dark:text-slate-400">
																		{formatDisplayDate(video.date)}
																	</p>
																	<div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-ink-400">
																		<span className="flex items-center gap-0.5">
																			<Eye size={10} />
																			{metrics.views || 0}
																		</span>
																		<span className="flex items-center gap-0.5">
																			<Heart
																				size={10}
																				className={
																					hasLiked(video.id)
																						? "fill-red-500 text-red-500"
																						: ""
																				}
																			/>
																			{metrics.likes || 0}
																		</span>
																	</div>
																</div>
															</div>
														</button>
													);
												})}
										</div>
									</div>
								)}

							{viewMode === "horizontal" ? (
								<HorizontalGallery
									items={
										isGallery
											? sortedGallery
											: selectedDate
												? groupedGallery[selectedDate] || []
												: []
									}
									getMetrics={getMetrics}
									hasLiked={hasLiked}
									openStory={openStory}
									handlePhotoDownload={handlePhotoDownload}
									downloadingId={downloadingId}
									trackView={trackView}
								/>
							) : viewMode === "strip" ? (
								<div className="flex items-start overflow-x-auto gap-3 pb-4 scrollbar-hide snap-x">
									{(isGallery
										? sortedGallery
										: selectedDate && groupedGallery[selectedDate]
											? groupedGallery[selectedDate]
											: []
									)?.map((item, index, arr) => {
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
							) : (
								<div className="columns-2 gap-3 pb-4">
									{(isGallery
										? sortedGallery
										: selectedDate && groupedGallery[selectedDate]
											? groupedGallery[selectedDate]
											: []
									)?.map((item, index, arr) => {
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
						<div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-ink-400 opacity-60">
							<ImageIcon size={48} className="mb-4" />
							<p>
								{isHindi
									? "कोई गतिविधि उपलब्ध नहीं है"
									: "No activities available"}
							</p>
						</div>
					)}
				</div>
			</div>

			{transitioning && !storyViewerData && (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="animate-spin text-pink-500" size={32} />
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
					mandal={mandal}
					isPaused={!!confirmDialog}
					isHindi={isHindi}
				/>
			)}

			{/* Activity Video Player Modal */}
			{playingVideo && (
				<ActivityVideoPlayer
					video={playingVideo}
					mandal={mandal}
					mandalVideos={(mandal.videos || []).sort((a, b) => a.order - b.order)}
					onSelectVideo={setPlayingVideo}
					onShowToast={(text, type) => setToastMessage({ text, type })}
					getMetrics={getMetrics}
					incrementLike={handleIncrementLike}
					incrementView={incrementView}
					hasLiked={hasLiked}
					onClose={() => setPlayingVideo(null)}
				/>
			)}

			{confirmDialog &&
				createPortal(
					<div
						className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
						onClick={() => {
							if (window.history.state?.layer === "activities_popup")
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
										if (window.history.state?.layer === "activities_popup")
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
										if (window.history.state?.layer === "activities_popup") {
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

/**
 * Newness state for one mandal tile.
 *
 * Extracted because this logic existed twice, character for character — once for
 * the main mandals and once for the "gallery" folders. It was in sync at the time
 * of writing and would not have stayed that way.
 *
 * Safe to call during render, including inside `.map()`: `hasUnseen` only reads
 * localStorage. Pair it with one `useSeenVersion()` in the component so the
 * results refresh when anything writes.
 */
function mandalBadgeState(mandal: MandalData) {
	const hasGallery = !!(mandal.gallery && mandal.gallery.length > 0);
	const hasVideo = !!(mandal.videos && mandal.videos.length > 0);
	const hasGlobalInfo = !!mandal.weeklyProgram?.enabled;
	const dailyPrograms = mandal.dailyPrograms || {};
	const hasDailyInfo = Object.values(dailyPrograms).some((p) => p?.enabled);
	const hasInfo = hasGlobalInfo || hasDailyInfo;

	const galleryKey = `cpbs_activity_gallery_${mandal.id}`;
	const videosKey = `cpbs_activity_videos_latest_${mandal.id}`;
	const infoKey = `cpbs_activity_info_${mandal.id}`;

	const galleryIds = hasGallery ? idsByRecency(mandal.gallery) : [];
	const videoIds = hasVideo ? idsByRecency(mandal.videos!) : [];

	// Info has no ids of its own, so it becomes a one-element set holding a hash
	// of the actual program content. The old stamp fell back to
	// `Object.keys(dailyPrograms).length`, so editing a program's title, time or
	// description without changing *how many* there were produced no badge; and
	// it counted disabled programs while visibility checks `.some(enabled)`, so
	// toggling one off changed the screen without changing the stamp. Hashing
	// only the enabled programs fixes both.
	const infoIds = hasInfo
		? [
				contentFingerprint(
					hasGlobalInfo
						? [
								"weekly",
								mandal.weeklyProgram?.title,
								mandal.weeklyProgram?.date,
								mandal.weeklyProgram?.description,
							]
						: [
								"daily",
								...Object.keys(dailyPrograms)
									.sort()
									.filter((k) => dailyPrograms[k]?.enabled)
									.flatMap((k) => [
										k,
										dailyPrograms[k]?.title,
										dailyPrograms[k]?.date,
										dailyPrograms[k]?.description,
									]),
							],
				),
			]
		: [];

	const isNewToUser =
		hasUnseen(galleryKey, galleryIds) ||
		hasUnseen(infoKey, infoIds) ||
		hasUnseen(videosKey, videoIds);

	/**
	 * Opening the tile shows the gallery and the info — but the videos sit behind
	 * a further "Watch All Videos" tap, so they are deliberately NOT marked here.
	 * The old handler wrote all three keys before navigating, which pre-cleared
	 * the inner videos badge: the user was told something was new, then lost the
	 * pointer to what it was.
	 */
	const markTileSeen = () => {
		if (hasGallery) markSeen(galleryKey, galleryIds);
		if (hasInfo) markSeen(infoKey, infoIds);
		if (!hasGallery && !hasInfo) {
			window.dispatchEvent(new Event("cpbs_storage_update"));
		}
	};

	return {
		hasGallery,
		hasVideo,
		hasInfo,
		isNewToUser,
		markTileSeen,
		galleryIds,
		infoIds,
		videosKey,
		videoIds,
	};
}

export const ActivitiesScreen: React.FC<ActivitiesScreenProps> = ({
	onBack,
	scrollBarSide = "left",
	initialShowPhotos = false,
	onOpenProfile,
	initialMandalTarget,
	onMandalTargetConsumed,
}) => {
	const { settingsLanguage } = useSettings();
	const isHindi = settingsLanguage === "hi";
	const { isLowEnd } = useDevicePerformance();

	const {
		dbMandals: sharedMandals,
		activityFoldersConfig,
		dbVideos,
		loadingMandals,
		loadingActivityFolders,
		loadingVideos,
	} = useSharedFirebase();
	const [mandals, setMandals] = useState<MandalData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedMandal, setSelectedMandal] = useState<MandalData | null>(null);
	// Stores the date to pre-select when a notification deep-links here
	const [selectedMandalInitialDate, setSelectedMandalInitialDate] = useState<
		string | null
	>(null);
	const [_selectedMandalInitialVideoId, setSelectedMandalInitialVideoId] =
		useState<string | null>(null);
	const [transitioning, setTransitioning] = useState(false);
	const [showVideos, setShowVideos] = useState(false);
	const [showPhotos, setShowPhotos] = useState(initialShowPhotos);

	const t = {
		title: isHindi ? "हमारी गतिविधियाँ और गैलरी" : "Our Activities & Gallery",
		loading: isHindi ? "लोड हो रहा है..." : "Loading...",
		noData: isHindi
			? "अभी कोई गतिविधि उपलब्ध नहीं है"
			: "No activities available yet",
	};

	const onBackRef = useRef(onBack);
	useEffect(() => {
		onBackRef.current = onBack;
	}, [onBack]);

	const stateRefMain = useRef({ showVideos, showPhotos, selectedMandal });
	useEffect(() => {
		stateRefMain.current = { showVideos, showPhotos, selectedMandal };
	}, [showVideos, showPhotos, selectedMandal]);

	const mainHistoryPushed = useRef(false);
	useEffect(() => {
		if (!mainHistoryPushed.current) {
			mainHistoryPushed.current = true;
			if (
				!initialShowPhotos &&
				window.history.state?.layer !== "activities_main"
			) {
				window.history.pushState(
					{ isPopup: true, view: "activities", layer: "activities_main" },
					"",
				);
			} else if (
				initialShowPhotos &&
				window.history.state?.layer !== "activities_photos"
			) {
				window.history.pushState(
					{ isPopup: true, view: "activities", layer: "activities_photos" },
					"",
				);
			}
		}
		const handlePopState = (e: PopStateEvent) => {
			const state = e.state;

			if (state?.layer === "activities_main") {
				setShowVideos(false);
				setShowPhotos(false);
				setSelectedMandal(null);
				return;
			}

			if (
				!state ||
				(!state.layer?.startsWith("activities_") &&
					!state.layer?.startsWith("videos_"))
			) {
				onBackRef.current();
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [initialShowPhotos]); // eslint-disable-line react-hooks/exhaustive-deps

	const openMandal = (
		mandal: MandalData,
		date?: string | null,
		videoId?: string | null,
	) => {
		setTransitioning(true);
		setTimeout(() => {
			setSelectedMandal(mandal);
			setSelectedMandalInitialDate(date || null);
			setSelectedMandalInitialVideoId(videoId || null);
			setTransitioning(false);
		}, 40);
	};

	const closeMandal = () => {
		setTransitioning(true);
		setSelectedMandal(null);
		setSelectedMandalInitialDate(null);
		setSelectedMandalInitialVideoId(null);
		setTimeout(() => {
			setTransitioning(false);
		}, 40);
	};

	// Auto-navigate when notification brings user here with a specific mandal + date
	// biome-ignore lint/correctness/useExhaustiveDependencies: openMandal is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (!initialMandalTarget?.mandalId || loading || mandals.length === 0)
			return;
		const target = mandals.find((m) => m.id === initialMandalTarget.mandalId);
		if (target) {
			setShowPhotos(true);
			openMandal(target, initialMandalTarget.date || null);
		}
		// Always consume the target once data is loaded — whether or not the mandal
		// was found. Without this, the effect re-fires on every Firestore snapshot.
		onMandalTargetConsumed?.();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialMandalTarget, loading, mandals]);

	// Auto-navigate for deep-linked mandalVideoId and mandalPhotos
	// biome-ignore lint/correctness/useExhaustiveDependencies: openMandal is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (loading || mandals.length === 0) return;
		try {
			const params = new URLSearchParams(window.location.search);
			const mVId = params.get("mandalVideoId");
			const isPhotos = params.get("mandalPhotos") === "true";

			if (mVId) {
				const targetMandal = mandals.find((m) =>
					(m.videos || []).some((v) => v.id === mVId),
				);
				if (targetMandal) {
					openMandal(targetMandal, null, mVId);
				}
				const newUrl = new URL(window.location.href);
				newUrl.searchParams.delete("mandalVideoId");
				window.history.replaceState(
					window.history.state,
					"",
					newUrl.toString(),
				);
			} else if (isPhotos) {
				const mandalId = params.get("mandalId");
				const mandalDate = params.get("mandalDate");
				if (mandalId) {
					const targetMandal = mandals.find((m) => m.id === mandalId);
					if (targetMandal) {
						setShowPhotos(true);
						openMandal(targetMandal, mandalDate || null);
					}
					const newUrl = new URL(window.location.href);
					newUrl.searchParams.delete("mandalPhotos");
					newUrl.searchParams.delete("mandalId");
					newUrl.searchParams.delete("mandalDate");
					window.history.replaceState(
						window.history.state,
						"",
						newUrl.toString(),
					);
				}
			}
		} catch (e) {
			console.error("Error parsing deep links", e);
		}
	}, [loading, mandals]);

	const [githubToken, setGithubToken] = useState<string | null | undefined>(
		undefined,
	);

	useEffect(() => {
		let isMounted = true;
		const fetchToken = async () => {
			try {
				const tokenDoc = shouldUseRestFallback()
					? await iosGetDoc("damtoken/github_public")
					: await getDoc(doc(db, "damtoken", "github_public"));
				if (isMounted) {
					if (tokenDoc.exists()) {
						setGithubToken(tokenDoc.data()?.token?.trim() || null);
					} else {
						setGithubToken(null);
					}
				}
			} catch (e) {
				console.error("Token error:", e);
				if (isMounted) setGithubToken(null);
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
			if (loadingMandals || loadingActivityFolders || githubToken === undefined)
				return;
			if (!activityFoldersConfig) {
				if (isMounted) setLoading(false);
				return;
			}

			const visibleIds: number[] = activityFoldersConfig.visibleIds || [];
			const folderOrder: number[] = activityFoldersConfig.folderOrder || [];

			const dbMandals: Record<string, MandalData> = {};
			sharedMandals.forEach((d: any) => {
				dbMandals[d.id] = { ...d } as MandalData;
			});

			const githubActivityGallery: Record<string, GalleryItem[]> = {};
			const mandalIdToReleaseId: Record<string, number> = {};
			const hiddenMandals = new Set<string>();

			if (githubToken) {
				try {
					const allReleases = await fetchActivityReleases(
						githubToken,
						isNative,
					);
					if (allReleases.length > 0) {
						const mandalReleasesMap = new Map<string, number[]>();

						allReleases.forEach((r) => {
							if (
								r.body?.includes("Auto-generated activity release for") ||
								r.name?.startsWith("Activity Release for ")
							) {
								const lowerReleaseName = r.name.toLowerCase();
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
								const mId = foundMandal ? foundMandal.id : `github-${r.id}`;

								if (!mandalReleasesMap.has(mId)) mandalReleasesMap.set(mId, []);
								mandalReleasesMap.get(mId)?.push(r.id);
							}
						});

						mandalReleasesMap.forEach((rIds, mId) => {
							const hasVisible = rIds.some((id) => visibleIds.includes(id));
							if (!hasVisible) {
								hiddenMandals.add(mId);
							}
						});

						const activityReleases = allReleases.filter(
							(r) =>
								visibleIds.includes(r.id) &&
								(r.body?.includes("Auto-generated activity release for") ||
									r.name?.startsWith("Activity Release for ")),
						);

						activityReleases.forEach((release) => {
							const lowerReleaseName = release.name.toLowerCase();
							const mandalName = release.name
								.replace(/Activity Release for /i, "")
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
									type: "activity",
									releaseId: release.id,
								} as GalleryItem & { releaseId: number };
							});

							if (!githubActivityGallery[mandalId])
								githubActivityGallery[mandalId] = [];
							githubActivityGallery[mandalId].push(...newAssets);

							(githubActivityGallery as any)[`${mandalId}_name`] = mandalName;
						});
					}
				} catch (err) {
					console.error("Error fetching GitHub releases:", err);
				}
			}

			const mergedMandalsMap = new Map<string, MandalData>();

			MANDAL_LIST.forEach((staticMandal) => {
				if (hiddenMandals.has(staticMandal.id)) return;

				const dbData =
					dbMandals[staticMandal.id] ||
					({ gallery: [] } as Partial<MandalData>);
				const ghGallery = githubActivityGallery[staticMandal.id] || [];

				const firestoreItems = (dbData.gallery || []).filter(
					(g) => g.type === "activity",
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
					if (a.order !== b.order) return a.order - b.order;
					return a.id.localeCompare(b.id);
				});

				const isVideo = (url: string) => /\.(mp4|mkv|webm|ogg)$/i.test(url);
				const actualGalleryItems = combinedGallery.filter(
					(g) => !isVideo(g.url),
				);
				const extractedVideos: MandalVideo[] = combinedGallery
					.filter((g) => isVideo(g.url))
					.map((g) => ({
						id: g.id,
						title: g.displayName || g.id,
						url: g.url,
						date: g.date || "",
						thumbnailUrl: "",
						order: g.order || 0,
					}));
				const finalVideos = [...(dbData.videos || []), ...extractedVideos];

				if (
					dbData.weeklyProgram?.enabled ||
					Object.keys(dbData.dailyPrograms || {}).length > 0 ||
					actualGalleryItems.length > 0 ||
					finalVideos.length > 0
				) {
					mergedMandalsMap.set(staticMandal.id, {
						id: staticMandal.id,
						name: staticMandal.name,
						weeklyProgram: dbData.weeklyProgram || ({ enabled: false } as any),
						dailyPrograms: dbData.dailyPrograms || {},
						gallery: actualGalleryItems,
						videos: finalVideos,
					});
				}
			});

			Object.keys(githubActivityGallery).forEach((key) => {
				if (hiddenMandals.has(key)) return;

				if (key.startsWith("github-") && !key.endsWith("_name")) {
					const gallery = githubActivityGallery[key];
					const name =
						(githubActivityGallery as any)[`${key}_name`] || "Activity Folder";
					const dbData = dbMandals[key] || ({} as Partial<MandalData>);

					const isVideo = (url: string) => /\.(mp4|mkv|webm|ogg)$/i.test(url);
					const actualGalleryItems = gallery.filter((g) => !isVideo(g.url));
					const extractedVideos: MandalVideo[] = gallery
						.filter((g) => isVideo(g.url))
						.map((g) => ({
							id: g.id,
							title: g.displayName || g.id,
							url: g.url,
							date: g.date || "",
							thumbnailUrl: "",
							order: g.order || 0,
						}));
					const finalVideos = [...(dbData.videos || []), ...extractedVideos];

					if (
						actualGalleryItems.length > 0 ||
						finalVideos.length > 0 ||
						dbData.weeklyProgram?.enabled
					) {
						mergedMandalsMap.set(key, {
							id: key,
							name: name,
							weeklyProgram:
								dbData.weeklyProgram || ({ enabled: false } as any),
							dailyPrograms: dbData.dailyPrograms || {},
							videos: finalVideos,
							gallery: actualGalleryItems.sort((a, b) => {
								const dateDiff =
									new Date(formatForDateInput(b.date)).getTime() -
									new Date(formatForDateInput(a.date)).getTime();
								if (dateDiff !== 0) return dateDiff;
								if (a.order !== b.order) return a.order - b.order;
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
		activityFoldersConfig,
		loadingMandals,
		loadingActivityFolders,
		githubToken,
	]);

	// Re-render on any seen-state write, from this screen or another.
	const seenVersion = useSeenVersion();

	// Clears HomeScreen's "Our Activities" badge however the user arrived.
	useMarkVisitedOnMount("activities");

	// The "Past Event Media" view lives inside this screen (App.tsx mounts
	// ActivitiesScreen with `initialShowPhotos` for Home's tile), so report the
	// photos visit whenever that view is actually showing — that clears Home's
	// tile badge whether the user came from the tile or from the banner below.
	useMarkVisitedOnMount("photos", showPhotos);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	const { videoIds, photoIds, isVideoNew, isPhotosNew } = useMemo(() => {
		// Every video's id, newest-first. The old signal was `count_${n}`:
		// add-one-and-delete-one netted to no badge, a lone deletion produced a
		// phantom badge, and editing a video in place was invisible.
		const vIds = loadingVideos ? [] : idsByRecency(dbVideos as any);

		// Ids from every "gallery" folder rather than one shared releaseId — see
		// the same note in HomeScreen. Each `gallery` is already newest-first.
		const PER_FOLDER = 12;
		const pIds: string[] = [];
		mandals.forEach((m) => {
			if (
				m.name.toLowerCase().endsWith("gallery") &&
				m.gallery &&
				m.gallery.length > 0
			) {
				for (const g of m.gallery.slice(0, PER_FOLDER)) {
					if (g?.id !== undefined && g?.id !== null) pIds.push(String(g.id));
				}
			}
		});

		return {
			videoIds: vIds,
			photoIds: pIds,
			isVideoNew: hasUnseen("cpbs_activity_video_main_latest", vIds),
			isPhotosNew: hasUnseen("cpbs_activity_photos_main_latest", pIds),
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mandals, dbVideos, loadingVideos, seenVersion]);

	// `selectedMandal` is a snapshot from the moment it was opened. Show the
	// latest data for it instead, so photos that land after opening (the server
	// snapshot following the cached one) appear in the open screen.
	const liveSelectedMandal = selectedMandal
		? (mandals.find((m) => m.id === selectedMandal.id) ?? selectedMandal)
		: null;

	// Opening a mandal counts as seeing it, however it was opened. The tile's
	// onClick marked it, but a notification opens the mandal directly, so its
	// NEW badge stayed. Re-runs as more photos load while it is open. Videos
	// stay unmarked, same as the tile (they sit behind another tap).
	const openBadge = liveSelectedMandal
		? mandalBadgeState(liveSelectedMandal)
		: null;
	const openBadgeFingerprint = openBadge
		? `${liveSelectedMandal?.id}|${openBadge.galleryIds.join(",")}|${openBadge.infoIds.join(",")}`
		: "";
	// biome-ignore lint/correctness/useExhaustiveDependencies: the fingerprint stands in for the id lists, which are rebuilt every render
	useEffect(() => {
		if (!openBadge || (!openBadge.hasGallery && !openBadge.hasInfo)) return;
		openBadge.markTileSeen();
	}, [openBadgeFingerprint]);

	const hideMain = !!selectedMandal || transitioning;

	return (
		<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
			<div
				className="absolute inset-0 opacity-[0.03] pointer-events-none"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e11d48' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
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
					<Calendar className="w-6 h-6" />
					{t.title}
				</h2>
			</div>

			<div
				className={`flex-1 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-0`}
				style={{ display: hideMain ? "none" : "block" }}
			>
				<OfflineBanner className="mb-4" />
				{!loading && (
					<div className="mb-6 landscape:lg:max-w-4xl landscape:lg:mx-auto animate-fade-in-up">
						<button
							onClick={() => {
								markSeen("cpbs_activity_video_main_latest", videoIds);
								setShowVideos(true);
							}}
							className="w-full bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl p-4 flex items-center justify-between text-white shadow-lg shadow-pink-500/30 active:scale-[0.98] transition-transform overflow-hidden relative group"
						>
							{isVideoNew && (
								<div className="absolute top-2 right-12 bg-white text-rose-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md z-20 animate-pulse">
									NEW
								</div>
							)}
							<div
								className={`absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 ${isLowEnd ? "" : "group-hover:scale-150 transition-transform duration-700 ease-out"} pointer-events-none`}
							></div>
							<div className="flex items-center gap-4 z-10">
								<div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
									<PlayCircle size={28} className="text-white drop-shadow-sm" />
								</div>
								<div className="text-left">
									<h3 className="font-bold text-lg leading-tight">
										{isHindi ? "वीडियो" : "Videos"}
									</h3>
									<p className="text-sm text-pink-100">
										{isHindi ? "वीडियो संग्रह देखें" : "Watch video collections"}
									</p>
								</div>
							</div>
							<div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm z-10">
								<ArrowLeft className="w-4 h-4 rotate-180" />
							</div>
						</button>
					</div>
				)}

				{loading ? (
					<div className="flex flex-col items-center justify-center py-20">
						<Loader2 className="animate-spin text-pink-500 mb-4" size={32} />
						<p className="text-slate-500 dark:text-ink-300 font-medium">
							{t.loading}
						</p>
					</div>
				) : (
					<>
						<div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 landscape:lg:gap-y-6 mb-6">
							{(() => {
								const mainMandals = mandals.filter(
									(m) => !m.name.toLowerCase().endsWith("gallery"),
								);
								return mainMandals.map((mandal, index) => {
									const {
										hasGallery,
										hasVideo,
										hasInfo,
										isNewToUser,
										markTileSeen,
									} = mandalBadgeState(mandal);

									return (
										<div
											key={mandal.id}
											onClick={() => {
												markTileSeen();
												openMandal(mandal);
											}}
											className="flex flex-col items-center gap-2 cursor-pointer group animate-fade-in-up relative"
											style={{ animationDelay: `${index * 50}ms` }}
										>
											<div
												className={`relative w-20 h-20 sm:w-24 sm:h-24 landscape:lg:w-36 landscape:lg:h-36 rounded-2xl p-1 transition-transform group-active:scale-95 ${hasGallery || hasInfo || hasVideo ? "bg-gradient-to-tr from-pink-400 to-rose-500 shadow-md shadow-pink-500/20" : "bg-slate-200 dark:bg-slate-700"}`}
											>
												<div className="w-full h-full bg-white dark:bg-slate-900 rounded-xl border-2 border-white dark:border-slate-900 flex items-center justify-center overflow-hidden relative">
													{hasGallery ? (
														<CachedImage
															thumbWidth={THUMB.tile}
															src={mandal.gallery[0].url}
															alt={mandal.name}
															className="w-full h-full object-cover"
														/>
													) : (
														<Calendar
															size={32}
															className="text-pink-300 dark:text-pink-800"
														/>
													)}
												</div>

												{isNewToUser && (
													<div className="absolute -top-1 -right-1 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md shadow-red-500/40 z-20 animate-pulse border border-white dark:border-slate-900">
														NEW
													</div>
												)}

												<div className="absolute -bottom-2 inset-x-0 flex justify-center gap-1">
													{hasInfo && (
														<div className="bg-blue-500 border border-white dark:border-slate-900 text-white p-0.5 rounded-full shadow-sm">
															<Calendar size={10} />
														</div>
													)}
													{hasGallery && (
														<div className="bg-pink-500 border border-white dark:border-slate-900 text-white p-0.5 rounded-full shadow-sm">
															<ImageIcon size={10} />
														</div>
													)}
													{hasVideo && (
														<div className="bg-rose-500 border border-white dark:border-slate-900 text-white p-0.5 rounded-full shadow-sm">
															<Play size={10} />
														</div>
													)}
												</div>
											</div>

											<span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 text-center line-clamp-2 mt-1">
												{mandal.name.replace(/\s*mandal\s*/i, "")}
											</span>
										</div>
									);
								});
							})()}
							{mandals.filter((m) => !m.name.toLowerCase().endsWith("gallery"))
								.length === 0 && (
								<div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-ink-400">
									<ImageIcon size={48} className="mb-4 opacity-50" />
									<p>{t.noData}</p>
								</div>
							)}
						</div>
						<div
							className="max-w-4xl mx-auto w-full animate-fade-in-up"
							style={{ animationDelay: "100ms" }}
						>
							<button
								onClick={() => {
									markSeen("cpbs_activity_photos_main_latest", photoIds);
									window.history.pushState(
										{
											isPopup: true,
											view: "activities",
											layer: "activities_photos",
										},
										"",
									);
									setShowPhotos(true);
								}}
								className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl p-4 flex items-center justify-between text-white shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform overflow-hidden relative group"
							>
								{isPhotosNew && (
									<div className="absolute top-2 right-12 bg-white text-blue-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md z-20 animate-pulse">
										NEW
									</div>
								)}
								<div
									className={`absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 ${isLowEnd ? "" : "group-hover:scale-150 transition-transform duration-700 ease-out"} pointer-events-none`}
								></div>
								<div className="flex items-center gap-4 z-10">
									<div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
										<ImageIcon
											size={28}
											className="text-white drop-shadow-sm"
										/>
									</div>
									<div className="text-left">
										<h3 className="font-bold text-lg leading-tight">
											{isHindi ? "पिछले इवेंट्स (मीडिया)" : "Past Events Media"}
										</h3>
										<p className="text-sm text-blue-100">
											{isHindi
												? "तस्वीरें और वीडियो देखें"
												: "View photos and videos"}
										</p>
									</div>
								</div>
								<div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm z-10">
									<ArrowLeft className="w-4 h-4 rotate-180" />
								</div>
							</button>
						</div>
					</>
				)}
			</div>

			{showPhotos && (
				<div className="fixed inset-0 z-[40] bg-rose-50 dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
					<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 shadow-lg z-10 sticky top-0 rounded-b-3xl">
						<button
							onClick={() => window.history.back()}
							className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
						>
							<ArrowLeft className="w-6 h-6" />
						</button>
						<h2 className="font-display text-xl font-semibold flex items-center gap-2 tracking-wide leading-none drop-shadow-md">
							<ImageIcon className="w-6 h-6" />
							{isHindi ? "पिछली मीडिया गैलरी" : "Past Media Gallery"}
						</h2>
					</div>
					<div
						className={`flex-1 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-0`}
					>
						{loading ? (
							<div className="flex flex-col items-center justify-center py-20">
								<Loader2
									className="animate-spin text-pink-500 mb-4"
									size={32}
								/>
								<p className="text-slate-500 dark:text-ink-300 font-medium">
									{t.loading}
								</p>
							</div>
						) : (
							<div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 landscape:lg:gap-y-6">
								{(() => {
									const galleryMandals = mandals.filter((m) =>
										m.name.toLowerCase().endsWith("gallery"),
									);
									return galleryMandals.map((mandal, index) => {
										const {
											hasGallery,
											hasVideo,
											hasInfo,
											isNewToUser,
											markTileSeen,
										} = mandalBadgeState(mandal);

										return (
											<div
												key={mandal.id}
												onClick={() => {
													markTileSeen();
													openMandal(mandal);
												}}
												className="flex flex-col items-center gap-2 cursor-pointer group animate-fade-in-up relative"
												style={{ animationDelay: `${index * 50}ms` }}
											>
												<div
													className={`relative w-20 h-20 sm:w-24 sm:h-24 landscape:lg:w-36 landscape:lg:h-36 rounded-2xl p-1 transition-transform group-active:scale-95 ${hasGallery || hasInfo || hasVideo ? "bg-gradient-to-tr from-pink-400 to-rose-500 shadow-md shadow-pink-500/20" : "bg-slate-200 dark:bg-slate-700"}`}
												>
													<div className="w-full h-full bg-white dark:bg-slate-900 rounded-xl border-2 border-white dark:border-slate-900 flex items-center justify-center overflow-hidden relative">
														{hasGallery ? (
															<CachedImage
																thumbWidth={THUMB.tile}
																src={mandal.gallery[0].url}
																alt={mandal.name}
																className="w-full h-full object-cover"
															/>
														) : (
															<Calendar
																size={32}
																className="text-pink-300 dark:text-pink-800"
															/>
														)}
													</div>
													{isNewToUser && (
														<div className="absolute -top-1 -right-1 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md shadow-red-500/40 z-20 animate-pulse border border-white dark:border-slate-900">
															NEW
														</div>
													)}
													<div className="absolute -bottom-2 inset-x-0 flex justify-center gap-1">
														{hasInfo && (
															<div className="bg-blue-500 border border-white dark:border-slate-900 text-white p-0.5 rounded-full shadow-sm">
																<Calendar size={10} />
															</div>
														)}
														{hasGallery && (
															<div className="bg-pink-500 border border-white dark:border-slate-900 text-white p-0.5 rounded-full shadow-sm">
																<ImageIcon size={10} />
															</div>
														)}
														{hasVideo && (
															<div className="bg-rose-500 border border-white dark:border-slate-900 text-white p-0.5 rounded-full shadow-sm">
																<Play size={10} />
															</div>
														)}
													</div>
												</div>
												<span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 text-center line-clamp-2 mt-1">
													{mandal.name.replace(/\s*mandal\s*/i, "")}
												</span>
											</div>
										);
									});
								})()}
								{mandals.filter((m) => m.name.toLowerCase().endsWith("gallery"))
									.length === 0 && (
									<div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-ink-400">
										<ImageIcon size={48} className="mb-4 opacity-50" />
										<p>
											{isHindi
												? "कोई फोटो गैलरी उपलब्ध नहीं है"
												: "No photo galleries available"}
										</p>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{transitioning && !selectedMandal && (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="animate-spin text-pink-500" size={32} />
				</div>
			)}

			{liveSelectedMandal && (
				<ActivityDetailScreen
					mandal={liveSelectedMandal}
					onClose={closeMandal}
					isHindi={isHindi}
					onOpenProfile={onOpenProfile}
					initialDate={selectedMandalInitialDate}
				/>
			)}

			{showVideos && (
				<VideosScreen
					onClose={() => setShowVideos(false)}
					scrollBarSide={scrollBarSide}
				/>
			)}
		</div>
	);
};

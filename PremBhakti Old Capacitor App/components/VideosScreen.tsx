import { Browser } from "@capacitor/browser";
import { Share } from "@capacitor/share";
import {
	ArrowLeft,
	Calendar,
	Eye,
	Folder,
	Heart,
	Loader2,
	Play,
	PlayCircle,
	Share2,
	SkipBack,
	SkipForward,
	Video as VideoIcon,
	Youtube,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APP_BASE_URL } from "../constants";
import { useSettings } from "../context/SettingsContext";
import { useSharedFirebase } from "../context/SharedFirebaseContext";
import { useToast } from "../context/ToastContext";
import { useMetrics } from "../hooks/useMetrics";
import {
	hasUnseen,
	idsByRecency,
	markSeen,
	useMarkVisitedOnMount,
	useSeenVersion,
} from "../hooks/useNewBadge";
import { useDevicePerformance } from "../src/hooks/useDevicePerformance";
import { copyToClipboard } from "../utils/clipboard";
import { formatDisplayDate } from "../utils/dateFormatter";
import { triggerHaptic } from "../utils/haptic";
import { THUMB } from "../utils/imageThumb";
import { CachedImage } from "./CachedImage";
import { OfflineBanner } from "./OfflineBanner";
import { CustomVideoPlayer } from "./YouTubePlayer";

export interface VideoFolderData {
	id: string;
	name: string;
	thumbnailUrl?: string;
	thumbnailXOffset?: number;
	thumbnailYOffset?: number;
	useDefaultThumbnail?: boolean;
	order: number;
}

export interface VideoData {
	id: string;
	title: string;
	url: string;
	folderId: string;
	thumbnailUrl?: string;
	thumbnailXOffset?: number;
	thumbnailYOffset?: number;
	useDefaultThumbnail?: boolean;
	date?: string;
	description?: string;
	order?: number;
	hdUrl?: string;
}

const getYouTubeVideoId = (url: string) => {
	const regExp =
		/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/;
	const match = url.match(regExp);
	return match ? match[1] : null;
};

const VideoPlayerModal: React.FC<{
	video: VideoData;
	folderVideos: VideoData[];
	onClose: () => void;
	onSelectVideo: (v: VideoData) => void;
	getMetrics: (id: string) => { likes: number; views: number };
	incrementLike: (id: string) => void;
	incrementView: (id: string) => void;
	hasLiked: (id: string) => boolean;
	onOpenProfile?: () => void;
	autoFullscreen?: boolean;
}> = ({
	video,
	folderVideos,
	onClose,
	onSelectVideo,
	getMetrics,
	incrementLike,
	incrementView,
	hasLiked,
	onOpenProfile,
	autoFullscreen,
}) => {
	const { settingsLanguage } = useSettings();
	const { showToast } = useToast();
	const isHindi = settingsLanguage === "hi";
	const [isDescExpanded, setIsDescExpanded] = useState(false);
	const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);

	const handleShareVideo = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const url = `https://chaitanyaprembhakti.org/v/video/${video.id}`;
		try {
			await Share.share({
				title: isHindi ? "वीडियो शेयर करें" : "Share Video",
				text: isHindi
					? `🙏 'Prem Bhakti' app पर यह वीडियो देखें:\n\n${video.title}\n\n`
					: `🙏 Watch this video on 'Prem Bhakti' app:\n\n${video.title}\n\n`,
				url: url,
				dialogTitle: isHindi ? "शेयर करें" : "Share",
			});
		} catch (err) {
			console.error("Share failed", err);
			void copyToClipboard(url);
			showToast(
				isHindi ? "लिंक कॉपी किया गया!" : "Link copied to clipboard!",
				"success",
			);
		}
	};

	const isYouTube = !!getYouTubeVideoId(video.url);
	const ytId = getYouTubeVideoId(video.url);

	const getVideoThumb = (v: VideoData) => {
		if (!v.useDefaultThumbnail && v.thumbnailUrl) return v.thumbnailUrl;
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
	}, [video.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

	const currentIndex = folderVideos.findIndex((v) => v.id === video.id);
	const hasNext = currentIndex !== -1 && currentIndex < folderVideos.length - 1;
	const hasPrev = currentIndex > 0;

	const handleNext = () => {
		if (hasNext) {
			window.history.replaceState(
				{
					isPopup: true,
					view: window.history.state?.view || "videos",
					layer: "videos_player",
					folderId: video.folderId,
					videoId: folderVideos[currentIndex + 1].id,
				},
				"",
			);
			onSelectVideo(folderVideos[currentIndex + 1]);
		}
	};
	const handlePrev = () => {
		if (hasPrev) {
			window.history.replaceState(
				{
					isPopup: true,
					view: window.history.state?.view || "videos",
					layer: "videos_player",
					folderId: video.folderId,
					videoId: folderVideos[currentIndex - 1].id,
				},
				"",
			);
			onSelectVideo(folderVideos[currentIndex - 1]);
		}
	};

	// No popstate here — parent VideosScreen handles all back navigation layers
	// Note: fullscreen is now handled via CSS in YouTubePlayer (no native requestFullscreen)

	const renderUpNext = () => (
		<>
			{folderVideos.length > 1 && (
				<div className="border-t border-neutral-800 px-4 pt-3 md:border-t-0 md:pt-4">
					<h3 className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">
						Up Next
					</h3>
					<div className="flex flex-col gap-2.5">
						{folderVideos
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
													view: window.history.state?.view || "videos",
													layer: "videos_player",
													folderId: v.folderId,
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
													style={{
														objectPosition: `${v.thumbnailXOffset ?? 50}% ${v.thumbnailYOffset ?? 50}%`,
													}}
													className="w-full h-full object-cover"
													loading="lazy"
													onError={(e: any) => {
														e.currentTarget.style.opacity = "0";
													}}
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
												{folderVideos.findIndex((vid) => vid.id === v.id) + 1}/
												{folderVideos.length}
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
					{/* Video Player Area */}
					<div className="w-full bg-black flex flex-col items-center shrink-0 relative z-20 border-b border-neutral-800">
						{isYouTube ? (
							<div className="w-full bg-black flex flex-col items-center">
								{ytError ? (
									<div className="w-full flex flex-col bg-neutral-900 border-b border-neutral-800">
										<div className="w-full aspect-video relative bg-black flex items-center justify-center overflow-hidden">
											<CachedImage
												thumbWidth={THUMB.medium}
												src={getVideoThumb(video) || ""}
												alt={video.title}
												style={{
													objectPosition: `${video.thumbnailXOffset ?? 50}% ${video.thumbnailYOffset ?? 50}%`,
												}}
												className="w-full h-full object-cover opacity-50"
												onError={(e: any) => {
													e.currentTarget.style.display = "none";
												}}
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
										<div className="w-full max-w-4xl aspect-video md:rounded-xl overflow-hidden shadow-2xl border-0 md:border border-neutral-800 bg-black">
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
									video={video}
									onNext={handleNext}
									onPrev={handlePrev}
									hasNext={hasNext}
									hasPrev={hasPrev}
									hdUrl={video.hdUrl}
									autoFullscreen={autoFullscreen}
									onFullscreenChange={setIsPlayerFullscreen}
								/>
							</div>
						)}
					</div>

					{/* Title & Date (Sticky on mobile) */}
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
									onClick={async () => {
										await triggerHaptic("medium");
										incrementLike(video.id);
									}}
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

					{/* Video Info Panel — scrollable below the player on mobile */}
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

export const VideosScreen: React.FC<{
	onClose: () => void;
	scrollBarSide?: "left" | "right";
	onOpenProfile?: () => void;
}> = ({ onClose, scrollBarSide = "left", onOpenProfile }) => {
	const { settingsLanguage } = useSettings();
	const { showToast } = useToast();
	const isHindi = settingsLanguage === "hi";
	const { isLowEnd } = useDevicePerformance();
	const {
		dbVideos: videos,
		dbVideoFolders: folders,
		loadingVideos,
		loadingVideoFolders,
	} = useSharedFirebase();
	const loading = loadingVideos || loadingVideoFolders;

	const [selectedFolder, setSelectedFolder] = useState<VideoFolderData | null>(
		null,
	);
	const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
	const [autoFullscreen, setAutoFullscreen] = useState(false);

	// Re-render this screen whenever seen-state changes anywhere, so folder NEW
	// badges update live. (Replaces a local `forceRender` counter that listened
	// for the same event.)
	useSeenVersion();

	// Clears HomeScreen's Videos tile badge no matter which entry point was used.
	useMarkVisitedOnMount("videos");

	const { getMetrics, incrementLike, incrementView, hasLiked } =
		useMetrics("videos");

	const t = {
		title: isHindi ? "वीडियो" : "Videos",
		foldersTitle: isHindi ? "वीडियो संग्रह" : "Video Collections",
		loading: isHindi ? "वीडियो लोड हो रहे हैं..." : "Loading videos...",
		noFolders: isHindi
			? "अभी कोई संग्रह उपलब्ध नहीं है"
			: "No collections available yet",
		noVideos: isHindi
			? "इस संग्रह में कोई वीडियो नहीं है"
			: "No videos in this collection",
	};

	const stateRef = useRef({ selectedFolder, selectedVideo });
	useEffect(() => {
		stateRef.current = { selectedFolder, selectedVideo };
	}, [selectedFolder, selectedVideo]);

	// Parents pass an inline `onClose`, so read it through a ref — as an effect
	// dep it re-ran the effect below on every parent render.
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);
	// Push the main layer once per mount. The effect below re-runs whenever
	// folders/videos change (and used to on every parent render); re-running the
	// push while something else sat on top (Profile from comments, the player's
	// speed menu) stacked a stray `videos_main` entry above it, so the next back
	// press closed this whole screen instead of the thing on top.
	const mainHistoryPushedRef = useRef(false);
	// onClose can make the parent pop its own history entry, which fires one more
	// popstate here before we unmount — close only once.
	const closingRef = useRef(false);

	// Single unified popstate handler for all layers
	useEffect(() => {
		if (!mainHistoryPushedRef.current) {
			mainHistoryPushedRef.current = true;
			if (!window.history.state?.layer?.startsWith("videos_")) {
				window.history.pushState(
					{
						isPopup: true,
						view: window.history.state?.view || "videos",
						layer: "videos_main",
					},
					"",
				);
			}
		}

		const handlePopState = (e: PopStateEvent) => {
			const state = e.state;

			if (!state?.layer?.startsWith("videos_")) {
				if (closingRef.current) return;
				closingRef.current = true;
				onCloseRef.current();
				return;
			}

			if (state.layer === "videos_main") {
				setSelectedFolder(null);
				setSelectedVideo(null);
			} else if (state.layer === "videos_folder") {
				if (state.folderId && folders.length > 0) {
					const f = folders.find((x) => x.id === state.folderId);
					if (f) setSelectedFolder(f);
				}
				setSelectedVideo(null);
			} else if (state.layer === "videos_player") {
				if (state.folderId && folders.length > 0) {
					const f = folders.find((x) => x.id === state.folderId);
					if (f) setSelectedFolder(f);
				}
				if (state.videoId && videos.length > 0) {
					const v = videos.find((x) => x.id === state.videoId);
					if (v) setSelectedVideo(v);
				}
			}
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [folders, videos]);

	const hasCheckedDeepLinkRef = useRef(false);

	useEffect(() => {
		if (loading || hasCheckedDeepLinkRef.current) return;
		if (folders.length === 0 || videos.length === 0) return;

		hasCheckedDeepLinkRef.current = true;
		const params = new URLSearchParams(window.location.search);
		const folderId = params.get("videoFolder");
		const videoId = params.get("videoId");

		if (videoId) {
			const v = videos.find((x) => x.id === videoId);
			if (v) {
				const f = folders.find((x) => x.id === v.folderId);
				if (f) {
					window.history.replaceState(
						{
							isPopup: true,
							view: window.history.state?.view || "videos",
							layer: "videos_main",
						},
						"",
					);
					window.history.pushState(
						{
							isPopup: true,
							view: window.history.state?.view || "videos",
							layer: "videos_folder",
							folderId: f.id,
						},
						"",
					);
					window.history.pushState(
						{
							isPopup: true,
							view: window.history.state?.view || "videos",
							layer: "videos_player",
							folderId: f.id,
							videoId: v.id,
						},
						"",
					);
					setSelectedFolder(f);
					setSelectedVideo(v);
					setAutoFullscreen(true);
				}
			}
		} else if (folderId) {
			const f = folders.find((x) => x.id === folderId);
			if (f) {
				window.history.replaceState(
					{
						isPopup: true,
						view: window.history.state?.view || "videos",
						layer: "videos_main",
					},
					"",
				);
				window.history.pushState(
					{
						isPopup: true,
						view: window.history.state?.view || "videos",
						layer: "videos_folder",
						folderId: f.id,
					},
					"",
				);
				setSelectedFolder(f);
			}
		}
	}, [loading, folders, videos]);

	const getThumbnailUrl = (video: VideoData) => {
		if (!video.useDefaultThumbnail && video.thumbnailUrl)
			return video.thumbnailUrl;
		const ytId = getYouTubeVideoId(video.url);
		if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
		return null;
	};

	const getFolderThumbnailUrl = (folder: VideoFolderData) => {
		if (!folder.useDefaultThumbnail && folder.thumbnailUrl)
			return folder.thumbnailUrl;
		const firstVideo = videos.find((v) => v.folderId === folder.id);
		if (firstVideo) return getThumbnailUrl(firstVideo);
		return null;
	};

	const handleShareFolder = async (
		e: React.MouseEvent,
		folder: VideoFolderData,
	) => {
		e.stopPropagation();
		const url = `https://chaitanyaprembhakti.org/v/folder/${folder.id}`;
		try {
			await Share.share({
				title: isHindi ? "वीडियो संग्रह शेयर करें" : "Share Video Collection",
				text: isHindi
					? `🙏 'Prem Bhakti' app पर '${folder.name}' वीडियो देखें:\n\n`
					: `🙏 Watch the '${folder.name}' video collection on 'Prem Bhakti' app:\n\n`,
				url: url,
				dialogTitle: isHindi ? "शेयर करें" : "Share",
			});
		} catch (err) {
			console.error("Share failed", err);
			void copyToClipboard(url);
			showToast(
				isHindi ? "लिंक कॉपी किया गया!" : "Link copied to clipboard!",
				"success",
			);
		}
	};

	const openFolder = (folder: VideoFolderData) => {
		const folderVideos = videos.filter((v) => v.folderId === folder.id);
		if (folderVideos.length > 0) {
			// Mark every video in the folder seen, not just the last one. The old
			// code stored a single id read from `folderVideos[length - 1]`, which
			// assumed the array stays sorted ascending — reordering or deleting the
			// last video silently re-badged an already-read folder.
			markSeen(
				`cpbs_video_folder_latest_${folder.id}`,
				idsByRecency(folderVideos),
			);
		}
		window.history.pushState(
			{
				isPopup: true,
				view: window.history.state?.view || "videos",
				layer: "videos_folder",
				folderId: folder.id,
			},
			"",
		);
		setSelectedFolder(folder);
	};

	const handleBack = () => {
		if (selectedFolder) {
			window.history.back(); // Pops the state, triggers popstate to set null
		} else {
			window.history.back(); // Closes main screen
		}
	};

	return (
		<div className="fixed inset-0 z-[60] bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 shadow-lg z-10 sticky top-0 shrink-0 border-b-2 border-ry-gold/40">
				<button
					onClick={handleBack}
					className="p-2 hover:bg-white/20 rounded-full transition active:scale-95"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>
				<h2 className="text-xl font-bold flex items-center gap-2 drop-shadow-md">
					{selectedFolder ? (
						<Folder className="w-6 h-6" />
					) : (
						<PlayCircle className="w-6 h-6" />
					)}
					{selectedFolder ? selectedFolder.name : t.title}
				</h2>
			</div>

			<OfflineBanner className="mx-4 mt-4 shrink-0" />

			{/* LOADING VIEW */}
			{loading && (
				<div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4">
					<Loader2 className="animate-spin text-pink-500 mb-4" size={32} />
					<p className="text-slate-500 dark:text-ink-300 font-medium">
						{t.loading}
					</p>
				</div>
			)}

			{/* FOLDERS VIEW - Hidden when loading or inside a folder to preserve scroll */}
			<div
				className={`flex-1 min-h-0 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] ${loading || selectedFolder ? "hidden" : "block"}`}
			>
				{folders.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
						{folders.map((folder, idx) => {
							const thumb = getFolderThumbnailUrl(folder);
							const folderVideos = videos.filter(
								(v) => v.folderId === folder.id,
							);
							const vCount = folderVideos.length;

							const autoThumbVid = folder.useDefaultThumbnail
								? folderVideos.find(
										(v) => v.thumbnailUrl && !v.useDefaultThumbnail,
									)
								: null;
							const displayThumbX = folder.useDefaultThumbnail
								? autoThumbVid?.thumbnailXOffset
								: folder.thumbnailXOffset;
							const displayThumbY = folder.useDefaultThumbnail
								? autoThumbVid?.thumbnailYOffset
								: folder.thumbnailYOffset;

							const isNewToUser = hasUnseen(
								`cpbs_video_folder_latest_${folder.id}`,
								idsByRecency(folderVideos),
							);

							return (
								<div
									key={folder.id}
									onClick={() => openFolder(folder)}
									data-tour="videos-folder"
									className={`relative bg-ry-cream dark:bg-ink-800 rounded-2xl overflow-hidden shadow-sm border-2 border-ry-gold/60 cursor-pointer group active:scale-[0.98] transition-all ${isLowEnd ? "" : "hover:shadow-md hover:border-ry-gold/90"}`}
									style={{ animationDelay: isLowEnd ? "0ms" : `${idx * 50}ms` }}
								>
									{isNewToUser && (
										<div className="absolute top-3 left-3 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-20 animate-pulse border border-white/20">
											NEW
										</div>
									)}
									<div className="aspect-video bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
										{thumb ? (
											<CachedImage
												thumbWidth={THUMB.medium}
												src={thumb}
												alt={folder.name}
												style={
													!folder.useDefaultThumbnail
														? {
																objectPosition: `${displayThumbX ?? 50}% ${displayThumbY ?? 50}%`,
															}
														: {}
												}
												className={`w-full h-full object-cover ${isLowEnd ? "" : "group-hover:scale-105 transition-transform duration-700"}`}
												loading="lazy"
												onError={(e: any) => {
													e.currentTarget.style.opacity = "0";
												}}
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
												<Folder size={48} />
											</div>
										)}
										<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
											<div className="flex items-center gap-2 text-white/90 text-sm font-bold bg-black/40 w-fit px-3 py-1 rounded-full backdrop-blur-sm mb-2">
												<PlayCircle size={16} /> {vCount}{" "}
												{isHindi ? "वीडियो" : "Videos"}
											</div>
										</div>
										<button
											onClick={(e) => handleShareFolder(e, folder)}
											data-tour="videos-share"
											className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition shadow-sm border border-white/20"
										>
											<Share2 size={18} />
										</button>
									</div>
									<div className="p-5">
										<h3 className="font-bold text-lg text-slate-800 dark:text-white line-clamp-1 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
											{folder.name}
										</h3>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-ink-400 opacity-80">
						<Folder
							size={64}
							className="mb-4 text-slate-300 dark:text-slate-700"
						/>
						<p className="text-lg font-medium">{t.noFolders}</p>
					</div>
				)}
			</div>

			{/* VIDEOS VIEW (Inside a folder) */}
			{selectedFolder && !loading && (
				<div
					className={`flex-1 min-h-0 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]`}
				>
					{(() => {
						const folderVideos = videos.filter(
							(v) => v.folderId === selectedFolder.id,
						);
						if (folderVideos.length === 0)
							return (
								<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-ink-400 opacity-80">
									<VideoIcon
										size={64}
										className="mb-4 text-slate-300 dark:text-slate-700"
									/>
									<p className="text-lg font-medium">{t.noVideos}</p>
								</div>
							);
						return (
							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4">
								{folderVideos.map((video, index) => {
									const thumb = getThumbnailUrl(video);
									const metrics = getMetrics(video.id);
									return (
										<div
											key={video.id}
											onClick={() => {
												window.history.pushState(
													{
														isPopup: true,
														view: window.history.state?.view || "videos",
														layer: "videos_player",
														folderId: selectedFolder.id,
														videoId: video.id,
													},
													"",
												);
												setSelectedVideo(video);
											}}
											className={`bg-ry-cream dark:bg-ink-800 rounded-2xl overflow-hidden shadow-sm border-2 border-ry-gold/60 cursor-pointer group active:scale-[0.98] transition-all ${isLowEnd ? "" : "hover:shadow-md hover:border-ry-gold/90"}`}
											style={{
												animationDelay: isLowEnd ? "0ms" : `${index * 50}ms`,
											}}
										>
											<div className="aspect-video bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
												{thumb ? (
													<CachedImage
														thumbWidth={THUMB.tile}
														src={thumb}
														alt={video.title}
														style={
															!video.useDefaultThumbnail
																? {
																		objectPosition: `${video.thumbnailXOffset ?? 50}% ${video.thumbnailYOffset ?? 50}%`,
																	}
																: {}
														}
														className={`w-full h-full object-cover ${isLowEnd ? "" : "group-hover:scale-105 transition-transform duration-500"}`}
														loading="lazy"
														onError={(e: any) => {
															e.currentTarget.style.opacity = "0";
														}}
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
														<VideoIcon size={48} />
													</div>
												)}
												<div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition flex items-center justify-center">
													<div className="w-12 h-12 bg-rose-500/90 text-white rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg transform group-hover:scale-110 transition">
														<PlayCircle className="w-6 h-6" />
													</div>
												</div>
												<div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
													#{video.order}
												</div>
											</div>
											<div className="p-4">
												<h3 className="font-bold text-slate-800 dark:text-white line-clamp-2 leading-tight group-hover:text-pink-600 dark:group-hover:text-pink-400 transition">
													{video.title}
												</h3>
												<div className="mt-2 flex items-center justify-between">
													{(video.date || video.description) && (
														<div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
															{video.date && (
																<span className="flex items-center gap-1">
																	<Calendar size={12} />{" "}
																	{formatDisplayDate(video.date)}
																</span>
															)}
														</div>
													)}
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
										</div>
									);
								})}
							</div>
						);
					})()}
				</div>
			)}

			{selectedVideo && selectedFolder && (
				<VideoPlayerModal
					video={selectedVideo}
					folderVideos={videos.filter((v) => v.folderId === selectedFolder.id)}
					onClose={() => setSelectedVideo(null)}
					onSelectVideo={setSelectedVideo}
					getMetrics={getMetrics}
					incrementLike={incrementLike}
					incrementView={incrementView}
					hasLiked={hasLiked}
					onOpenProfile={onOpenProfile}
					autoFullscreen={autoFullscreen}
				/>
			)}
		</div>
	);
};

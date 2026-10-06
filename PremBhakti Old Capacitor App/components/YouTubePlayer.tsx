import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import {
	Maximize2,
	Minimize2,
	Pause,
	Play,
	RotateCw,
	Settings,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crashlytics } from "../utils/Crashlytics";
import { isThumbUrl, THUMB, thumbUrl } from "../utils/imageThumb";
import { setVideoPlaybackActive } from "./CachedImage";

interface VideoData {
	id: string;
	title: string;
	url: string;
	folderId: string;
	thumbnailUrl?: string;
	useDefaultThumbnail?: boolean;
	date?: string;
	description?: string;
	order?: number;
}

const getYouTubeVideoId = (url: string) => {
	const regExp =
		/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/;
	const match = url.match(regExp);
	return match ? match[1] : null;
};

const formatTime = (seconds: number) => {
	if (Number.isNaN(seconds)) return "0:00";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
	return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// --- Double Tap Ripple ---
const DoubleTapRipple: React.FC<{
	side: "left" | "right";
	seconds: number;
	onDone: () => void;
}> = ({ side, seconds, onDone }) => {
	useEffect(() => {
		const t = setTimeout(onDone, 700);
		return () => clearTimeout(t);
	}, [onDone]);
	return (
		<div
			className={`absolute top-0 bottom-0 ${side === "left" ? "left-0 right-1/2" : "left-1/2 right-0"} z-30 flex items-center justify-center pointer-events-none`}
		>
			<div className="flex flex-col items-center animate-yt-ripple">
				<div className="flex gap-0.5 mb-1">
					{side === "left"
						? [1, 2, 3].map((i) => (
								<svg
									key={i}
									className="w-4 h-4 text-white"
									style={{ animationDelay: `${i * 80}ms` }}
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
								</svg>
							))
						: [1, 2, 3].map((i) => (
								<svg
									key={i}
									className="w-4 h-4 text-white"
									style={{ animationDelay: `${i * 80}ms` }}
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
								</svg>
							))}
				</div>
				<span className="text-white text-sm font-bold drop-shadow-lg">
					{seconds} seconds
				</span>
			</div>
			<div
				className={`absolute inset-0 ${side === "left" ? "rounded-r-full" : "rounded-l-full"} bg-white/10 animate-yt-ripple-bg`}
			/>
		</div>
	);
};

export const CustomVideoPlayer: React.FC<{
	video: VideoData;
	onNext?: () => void;
	onPrev?: () => void;
	hasNext: boolean;
	hasPrev: boolean;
	hdUrl?: string;
	autoFullscreen?: boolean;
	onFullscreenChange?: (isFullscreen: boolean) => void;
}> = ({
	video,
	onNext,
	onPrev,
	hasNext,
	hasPrev,
	hdUrl,
	autoFullscreen,
	onFullscreenChange,
}) => {
	const [isHD, setIsHD] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const progressBarRef = useRef<HTMLDivElement>(null);
	// Unique ID per instance to avoid SVG gradient ID collision when multiple players exist in DOM
	const gradientId = useRef(
		`rose-grad-${Math.random().toString(36).slice(2, 7)}`,
	).current;

	const [isPlaying, setIsPlaying] = useState(false); // false until onPlay fires — autoplay may be blocked
	const [isBuffering, setIsBuffering] = useState(true);
	const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
	const [hasError, setHasError] = useState(false);
	const isSeekingRef = useRef(false); // ref avoids stale closure in handleTimeUpdate

	// Compute poster thumbnail — use custom thumbnail, or YouTube auto-thumbnail
	const posterUrl =
		!video.useDefaultThumbnail && video.thumbnailUrl
			? video.thumbnailUrl
			: (() => {
					const id = getYouTubeVideoId(video.url);
					return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
				})();

	// The poster is a resized copy (the custom thumbnail can be a full-size
	// photo, loading while the video itself needs the bandwidth). If the resize
	// service fails, show the original; if that fails too, hide the poster.
	const handlePosterError = (e: React.SyntheticEvent<HTMLImageElement>) => {
		const img = e.currentTarget;
		if (posterUrl && isThumbUrl(img.src)) img.src = posterUrl;
		else img.style.display = "none";
	};

	// Reset state when video changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setHasStartedPlaying(false);
		setIsBuffering(true);
		setHasError(false);
		setProgress(0);
		setCurrentTime(0);
		setDuration(0);
		setBuffered(0);
	}, [video.id]);

	// Attempt autoplay manually to catch failures
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (!videoRef.current) return;
		const playPromise = videoRef.current.play();
		if (playPromise !== undefined) {
			playPromise.catch((error) => {
				console.log("Autoplay prevented:", error);
				setIsPlaying(false);
				setIsBuffering(false);
				setShowControls(true);
			});
		}
	}, [video.id]);
	// While this video plays, gallery thumbnails still loading behind it (the
	// Activities / Videos screens stay mounted underneath) download one at a
	// time instead of four, so they stop taking the bandwidth the video needs.
	useEffect(() => {
		setVideoPlaybackActive(isPlaying);
	}, [isPlaying]);
	useEffect(() => () => setVideoPlaybackActive(false), []);

	const [progress, setProgress] = useState(0);
	const [buffered, setBuffered] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [isMuted, setIsMuted] = useState(false);
	const [volume, setVolume] = useState(1);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [videoAspect, setVideoAspect] = useState<"landscape" | "portrait">(
		"landscape",
	);
	const [showControls, setShowControls] = useState(false);
	const [rotation, setRotation] = useState(0);
	const [playbackSpeed, setPlaybackSpeed] = useState(1);
	const [showSpeedMenu, setShowSpeedMenu] = useState(false);
	// Back-button: showSpeedMenu
	useEffect(() => {
		if (showSpeedMenu)
			window.history.pushState({ isPopup: true, view: "speed-menu" }, "");
	}, [showSpeedMenu]);
	const handleClose_speed_menu = () => {
		if (window.history.state?.view === "speed-menu") window.history.back();
		else setShowSpeedMenu(false);
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_speed_menu is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const _h_speed_menu = (e: PopStateEvent) => {
			if (showSpeedMenu && e.state?.view !== "speed-menu")
				handleClose_speed_menu();
		};
		window.addEventListener("popstate", _h_speed_menu);
		return () => window.removeEventListener("popstate", _h_speed_menu);
	}, [showSpeedMenu]);
	const [seekHoverPos, setSeekHoverPos] = useState<number | null>(null);
	const [seekHoverTime, setSeekHoverTime] = useState("");
	const [isSeeking, setIsSeeking] = useState(false); // keep for UI thumb, but use isSeekingRef in callbacks

	// Double tap state
	const [doubleTapRipple, setDoubleTapRipple] = useState<{
		side: "left" | "right";
		seconds: number;
	} | null>(null);
	const tapTimerRef = useRef<any>(null);
	const tapCountRef = useRef(0);
	const lastTapXRef = useRef(0);

	const controlsTimeoutRef = useRef<any>(null);

	// --- Controls visibility ---
	const resetControlsTimeoutRef = useRef<() => void>(() => {});
	const resetControlsTimeout = useCallback(() => {
		if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
		controlsTimeoutRef.current = setTimeout(() => {
			if (!showSpeedMenu) setShowControls(false);
		}, 3500);
	}, [showSpeedMenu]);
	resetControlsTimeoutRef.current = resetControlsTimeout;

	const showControlsBriefly = useCallback(() => {
		setShowControls(true);
		resetControlsTimeoutRef.current();
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
		};
	}, []);

	// --- Video event handlers ---
	const togglePlay = useCallback(() => {
		if (videoRef.current) {
			if (videoRef.current.paused) {
				// Un-caught, a broken source rejected with NotSupportedError on every
				// tap ("The element has no supported sources.") and flooded Crashlytics.
				videoRef.current.play().catch((error) => {
					if (error?.name === "AbortError") return;
					if (error?.name === "NotSupportedError") {
						setHasError(true);
						setIsBuffering(false);
					}
					console.warn("Video play failed:", error);
				});
			} else videoRef.current.pause();
		}
	}, []);

	const handleTimeUpdate = () => {
		if (videoRef.current && !isSeekingRef.current) {
			setCurrentTime(videoRef.current.currentTime);
			if (videoRef.current.duration) {
				setProgress(
					(videoRef.current.currentTime / videoRef.current.duration) * 100,
				);
			}
			// Update buffered
			if (videoRef.current.buffered.length > 0) {
				const end = videoRef.current.buffered.end(
					videoRef.current.buffered.length - 1,
				);
				setBuffered((end / videoRef.current.duration) * 100);
			}
		}
	};

	const handleLoadedMetadata = () => {
		if (videoRef.current) {
			setDuration(videoRef.current.duration);
			const { videoWidth, videoHeight } = videoRef.current;
			setVideoAspect(videoWidth >= videoHeight ? "landscape" : "portrait");
		}
	};

	// --- Seek bar ---
	const handleSeekStartFromNative = useCallback(
		(e: TouchEvent) => {
			e.stopPropagation();
			e.preventDefault();
			isSeekingRef.current = true;
			setIsSeeking(true);
			showControlsBriefly();
			updateSeekRef.current(e as any);
			const handleMove = (ev: TouchEvent | MouseEvent) => {
				ev.preventDefault();
				ev.stopPropagation();
				updateSeekRef.current(ev as any);
			};
			const handleEnd = (ev: TouchEvent | MouseEvent) => {
				ev.preventDefault();
				ev.stopPropagation();
				isSeekingRef.current = false;
				setIsSeeking(false);
				document.removeEventListener("touchmove", handleMove);
				document.removeEventListener("touchend", handleEnd);
			};
			document.addEventListener("touchmove", handleMove, { passive: false });
			document.addEventListener("touchend", handleEnd, { passive: false });
		},
		[showControlsBriefly],
	);

	const handleSeekStart = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		isSeekingRef.current = true;
		setIsSeeking(true);
		updateSeekPosition(e);
		const handleMove = (ev: MouseEvent) => {
			ev.preventDefault();
			ev.stopPropagation();
			updateSeekPosition(ev as any);
		};
		const handleEnd = (ev: MouseEvent) => {
			ev.preventDefault();
			ev.stopPropagation();
			isSeekingRef.current = false;
			setIsSeeking(false);
			document.removeEventListener("mousemove", handleMove);
			document.removeEventListener("mouseup", handleEnd);
		};
		document.addEventListener("mousemove", handleMove);
		document.addEventListener("mouseup", handleEnd);
	};

	// Attach native touchstart with { passive: false } to allow preventDefault
	useEffect(() => {
		const el = progressBarRef.current;
		if (!el) return;
		const handler = (e: TouchEvent) => handleSeekStartFromNative(e);
		el.addEventListener("touchstart", handler, { passive: false });
		return () => el.removeEventListener("touchstart", handler);
	}, [handleSeekStartFromNative]);

	const updateSeekPosition = useCallback((e: any) => {
		if (!progressBarRef.current || !videoRef.current) return;
		const rect = progressBarRef.current.getBoundingClientRect();
		// Use changedTouches as fallback for touchend (where touches[] is empty)
		const touch = e.touches?.[0] ?? e.changedTouches?.[0];
		const clientX = touch ? touch.clientX : e.clientX;
		if (clientX === undefined) return;
		const dur = videoRef.current.duration || 0;
		const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const newTime = pos * dur;
		videoRef.current.currentTime = newTime;
		setProgress(pos * 100);
		setCurrentTime(newTime);
	}, []);

	// Keep a ref so native event listeners always use the latest function
	const updateSeekRef = useRef(updateSeekPosition);
	updateSeekRef.current = updateSeekPosition;

	const handleSeekHover = (e: React.MouseEvent) => {
		if (!progressBarRef.current) return;
		const rect = progressBarRef.current.getBoundingClientRect();
		const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		setSeekHoverPos(pos * 100);
		setSeekHoverTime(formatTime(pos * duration));
	};

	// --- Mute/Volume ---
	const toggleMute = () => {
		if (videoRef.current) {
			videoRef.current.muted = !videoRef.current.muted;
			setIsMuted(videoRef.current.muted);
		}
	};

	// --- CSS-based Fullscreen (no native requestFullscreen — avoids janky browser animation) ---
	const toggleFullscreen = useCallback(async () => {
		const newFs = !isFullscreen;
		setIsFullscreen(newFs);
		try {
			let targetOrientation: "landscape" | "portrait" = "landscape";
			if (newFs && videoRef.current) {
				const { videoWidth, videoHeight } = videoRef.current;
				if (videoHeight > videoWidth) targetOrientation = "portrait";
			}
			if (Capacitor.isNativePlatform()) {
				await ScreenOrientation.lock({
					orientation: newFs ? targetOrientation : "portrait",
				});
			} else if (
				newFs &&
				screen.orientation &&
				(screen.orientation as any).lock
			) {
				await (screen.orientation as any)
					.lock(targetOrientation)
					.catch(() => {});
			} else if (!newFs && screen.orientation?.unlock) {
				screen.orientation.unlock();
			}
		} catch (_e) {}
	}, [isFullscreen]);

	// Auto Fullscreen
	const autoFsDone = useRef(false);
	useEffect(() => {
		if (
			autoFullscreen &&
			!autoFsDone.current &&
			!isFullscreen &&
			Capacitor.isNativePlatform()
		) {
			autoFsDone.current = true;
			toggleFullscreen();
		}
	}, [autoFullscreen, isFullscreen, toggleFullscreen]);

	// Cleanup orientation on unmount
	useEffect(() => {
		return () => {
			try {
				if (Capacitor.isNativePlatform()) {
					ScreenOrientation.lock({ orientation: "portrait" }).catch(() => {});
				} else if (screen.orientation?.unlock) {
					screen.orientation.unlock();
				}
			} catch (_e) {}
		};
	}, []);

	// --- Playback speed ---
	const changeSpeed = (speed: number) => {
		setPlaybackSpeed(speed);
		if (videoRef.current) videoRef.current.playbackRate = speed;
		handleClose_speed_menu();
	};

	// --- Rotation ---
	const toggleRotation = () => setRotation((prev) => (prev + 90) % 360);

	// --- Controls auto-hide ---
	useEffect(() => {
		if (isPlaying && !showSpeedMenu) {
			resetControlsTimeout();
		} else {
			setShowControls(true);
			if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
		}
		return () => {
			if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
		};
	}, [isPlaying, showSpeedMenu, resetControlsTimeout]);

	// --- Tap / Double Tap (YouTube style) ---
	const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
		if (showSpeedMenu) {
			handleClose_speed_menu();
			return;
		}
		const rect = e.currentTarget.getBoundingClientRect();
		lastTapXRef.current = e.clientX - rect.left;
		tapCountRef.current += 1;

		if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
		tapTimerRef.current = setTimeout(() => {
			if (tapCountRef.current === 1) {
				// Single tap: toggle controls
				if (showControls && isPlaying) {
					setShowControls(false);
				} else {
					setShowControls(true);
					if (isPlaying) resetControlsTimeout();
				}
			} else if (tapCountRef.current >= 2) {
				// Double tap: seek
				if (!videoRef.current) {
					tapCountRef.current = 0;
					return;
				}
				const x = lastTapXRef.current;
				const w = rect.width;
				if (x > w / 2) {
					videoRef.current.currentTime = Math.min(
						videoRef.current.currentTime + 10,
						duration,
					);
					setDoubleTapRipple({ side: "right", seconds: 10 });
				} else {
					videoRef.current.currentTime = Math.max(
						videoRef.current.currentTime - 10,
						0,
					);
					setDoubleTapRipple({ side: "left", seconds: 10 });
				}
				showControlsBriefly();
			}
			tapCountRef.current = 0;
		}, 250);
	};

	// --- Keyboard shortcuts (YouTube standard) ---
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			)
				return;
			const vid = videoRef.current;
			if (!vid) return;
			switch (e.key.toLowerCase()) {
				case " ":
				case "k":
					e.preventDefault();
					togglePlay();
					showControlsBriefly();
					break;
				case "f":
					e.preventDefault();
					toggleFullscreen();
					break;
				case "m":
					e.preventDefault();
					vid.muted = !vid.muted;
					setIsMuted(vid.muted);
					break;
				case "arrowleft":
				case "j":
					e.preventDefault();
					vid.currentTime = Math.max(vid.currentTime - 10, 0);
					showControlsBriefly();
					break;
				case "arrowright":
				case "l":
					e.preventDefault();
					vid.currentTime = Math.min(vid.currentTime + 10, vid.duration || 0);
					showControlsBriefly();
					break;
				case "arrowup":
					e.preventDefault();
					vid.volume = Math.min(1, vid.volume + 0.1);
					setVolume(vid.volume);
					break;
				case "arrowdown":
					e.preventDefault();
					vid.volume = Math.max(0, vid.volume - 0.1);
					setVolume(vid.volume);
					break;
			}
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [duration, togglePlay, toggleFullscreen, showControlsBriefly]);

	const controlsVisible = showControls || !isPlaying;

	const handleMouseMove = useCallback(() => {
		if (isPlaying) showControlsBriefly();
	}, [isPlaying, showControlsBriefly]);

	const handleMouseLeave = useCallback(() => {
		if (isPlaying && !showSpeedMenu) setShowControls(false);
	}, [isPlaying, showSpeedMenu]);

	// Notify parent so it can hide its own header/title while we're fullscreen —
	// otherwise the parent's back-button header stays mounted and overlaps the
	// title bar we render below, right at the top of the screen.
	useEffect(() => {
		onFullscreenChange?.(isFullscreen);
	}, [isFullscreen, onFullscreenChange]);

	// Live viewport orientation — NOT just "are we the compiled native app".
	// A plain mobile WebView also reports isNative=false, so without this,
	// fullscreen on a landscape video always force-rotated it even when the
	// webview/device was already landscape, corrupting the layout.
	const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
		typeof window !== "undefined"
			? window.innerHeight > window.innerWidth
			: true,
	);
	useEffect(() => {
		const updateOrientation = () =>
			setIsPortraitViewport(window.innerHeight > window.innerWidth);
		window.addEventListener("resize", updateOrientation);
		window.addEventListener("orientationchange", updateOrientation);
		return () => {
			window.removeEventListener("resize", updateOrientation);
			window.removeEventListener("orientationchange", updateOrientation);
		};
	}, []);

	// CSS fullscreen styles — for browser, rotate landscape videos instead of locking orientation.
	// Only needed when the viewport itself is still portrait (i.e. there's no real
	// fullscreen/orientation-lock available) — if the webview/device is already
	// landscape, the video is already the right way up and rotating it again breaks
	// the layout (and flips Tailwind's sm:/md: breakpoints since width/height swap).
	const isNative = Capacitor.isNativePlatform();
	const needsRotation =
		isFullscreen &&
		!isNative &&
		videoAspect === "landscape" &&
		isPortraitViewport;

	const fullscreenStyle: React.CSSProperties = isFullscreen
		? needsRotation
			? {
					// Fake landscape: swap vw/vh and rotate 90deg
					position: "fixed",
					zIndex: 200,
					width: "100vh",
					height: "100vw",
					top: "calc((100vh - 100vw) / 2)",
					left: "calc((100vw - 100vh) / 2)",
					transform: "rotate(90deg)",
				}
			: {
					position: "fixed",
					inset: 0,
					zIndex: 200,
					width: "100vw",
					height: "100vh",
				}
		: { width: "100%", height: "100%" };

	return (
		<div
			ref={containerRef}
			className="relative bg-black flex items-center justify-center overflow-hidden select-none font-sans"
			style={{ ...fullscreenStyle }}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
		>
			{/* Thumbnail poster — shows during initial load/buffering */}
			{!hasStartedPlaying && posterUrl && (
				<div className="absolute inset-0 z-[1] bg-black">
					<img
						src={thumbUrl(posterUrl, THUMB.card)}
						alt=""
						className="absolute inset-0 w-full h-full object-cover opacity-40 blur-2xl scale-110"
						onError={handlePosterError}
					/>
					<img
						src={thumbUrl(posterUrl, THUMB.card)}
						alt=""
						className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl"
						onError={handlePosterError}
					/>
				</div>
			)}

			{/* Error state overlay */}
			{hasError && (
				<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 pointer-events-none">
					<svg
						className="w-12 h-12 text-white/30"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
					<p className="text-white/50 text-sm font-medium">
						Video could not be loaded
					</p>
				</div>
			)}

			{/* Video Element */}
			<video
				ref={videoRef}
				src={isHD && hdUrl ? hdUrl : video.url}
				poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
				style={{ transform: `rotate(${rotation}deg)` }}
				className={`absolute inset-0 w-full h-full object-contain transition-transform duration-300 ${hasStartedPlaying ? "z-[2]" : "z-0"}`}
				onTimeUpdate={handleTimeUpdate}
				onLoadedMetadata={handleLoadedMetadata}
				onEnded={() => onNext?.()}
				onPlay={() => {
					setIsPlaying(true);
					setIsBuffering(false);
					setHasStartedPlaying(true);
				}}
				onPause={() => setIsPlaying(false)}
				onWaiting={() => setIsBuffering(true)}
				onPlaying={() => {
					setIsBuffering(false);
					setHasStartedPlaying(true);
				}}
				onCanPlay={() => {
					setIsBuffering(false);
					setHasStartedPlaying(true);
					showControlsBriefly();
				}}
				onError={(e) => {
					setHasError(true);
					setIsBuffering(false);
					// Report which video is broken (the generic "no supported sources"
					// play() rejection is filtered globally and carries no URL).
					const el = e.currentTarget;
					Crashlytics.recordException(
						`[Video] load failed (code ${el.error?.code ?? "?"}): ${el.currentSrc || el.src}`,
					);
				}}
				autoPlay
				playsInline
				preload="metadata"
			/>

			{/* Click/Tap Interaction Layer */}
			<div
				className="absolute inset-0 z-10 cursor-pointer"
				onClick={handleTap}
			/>

			{/* Gradient overlay when controls visible */}
			<div
				className={`absolute inset-0 z-[11] pointer-events-none transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"}`}
			>
				<div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
				<div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
			</div>

			{/* Double Tap Ripple */}
			{doubleTapRipple && (
				<DoubleTapRipple
					side={doubleTapRipple.side}
					seconds={doubleTapRipple.seconds}
					onDone={() => setDoubleTapRipple(null)}
				/>
			)}

			{/* Center Buffering Spinner — only when buffering, always visible */}
			{isBuffering && isPlaying && (
				<div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
					<div className="w-14 h-14 md:w-18 md:h-18 flex items-center justify-center drop-shadow-lg">
						<svg
							className="animate-spin w-12 h-12 md:w-14 md:h-14"
							viewBox="0 0 50 50"
						>
							<defs>
								<linearGradient
									id={gradientId}
									x1="0%"
									y1="0%"
									x2="100%"
									y2="100%"
								>
									<stop offset="0%" stopColor="#f43f5e" />
									<stop offset="100%" stopColor="#ec4899" />
								</linearGradient>
							</defs>
							<circle
								cx="25"
								cy="25"
								r="20"
								fill="none"
								stroke={`url(#${gradientId})`}
								strokeWidth="4"
								strokeLinecap="round"
								strokeDasharray="90 40"
							/>
						</svg>
					</div>
				</div>
			)}

			{/* Center Prev / Play-Pause / Next — only when controls visible AND not buffering */}
			{(!isBuffering || !isPlaying) && (
				<div
					className={`absolute inset-0 z-20 flex items-center justify-center gap-8 sm:gap-12 md:gap-16 pointer-events-none transition-all duration-200 ${controlsVisible ? "opacity-100" : "opacity-0"}`}
				>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onPrev?.();
						}}
						disabled={!hasPrev}
						className={`${controlsVisible ? "pointer-events-auto" : "pointer-events-none"} p-2 md:p-2 rounded-full transition-all active:scale-90 ${!hasPrev ? "opacity-20" : "text-white hover:bg-white/10"}`}
					>
						<SkipBack className="fill-current w-9 h-9 md:w-10 md:h-10" />
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							togglePlay();
						}}
						className={`${controlsVisible ? "pointer-events-auto" : "pointer-events-none"} w-16 h-16 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90`}
					>
						{isPlaying ? (
							<Pause className="fill-current w-12 h-12 md:w-14 md:h-14" />
						) : (
							<Play className="fill-current w-12 h-12 md:w-14 md:h-14 ml-1" />
						)}
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onNext?.();
						}}
						disabled={!hasNext}
						className={`${controlsVisible ? "pointer-events-auto" : "pointer-events-none"} p-2 md:p-2 rounded-full transition-all active:scale-90 ${!hasNext ? "opacity-20" : "text-white hover:bg-white/10"}`}
					>
						<SkipForward className="fill-current w-9 h-9 md:w-10 md:h-10" />
					</button>
				</div>
			)}

			{/* Title bar at top (Only in Fullscreen) */}
			{isFullscreen && (
				<div
					className={`absolute top-0 left-0 right-0 z-20 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 transition-all duration-300 pointer-events-none ${controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
				>
					<div className="absolute inset-0 bg-gradient-to-b from-black/70 to-transparent -z-10" />
					<p className="text-white text-sm md:text-base font-medium line-clamp-1 drop-shadow-lg">
						{video.title}
					</p>
				</div>
			)}

			{/* Bottom Controls — YouTube Style */}
			<div
				className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 pointer-events-none pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
			>
				{/* Progress/Seek Bar Wrapper */}
				<div className="w-full px-3 md:px-5 pointer-events-none">
					<div
						ref={progressBarRef}
						className={`relative w-full h-6 md:h-8 group/seek flex items-center ${controlsVisible ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}`}
						style={{ touchAction: "none" }}
						onMouseDown={handleSeekStart}
						onMouseMove={handleSeekHover}
						onMouseLeave={() => setSeekHoverPos(null)}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Hover time tooltip */}
						{seekHoverPos !== null && (
							<div
								className="absolute top-0 -translate-y-full -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-0.5 rounded pointer-events-none"
								style={{ left: `${seekHoverPos}%` }}
							>
								{seekHoverTime}
							</div>
						)}
						<div
							className={`relative w-full transition-all duration-150 rounded-full overflow-visible ${isSeeking ? "h-[5px]" : "h-[3px] group-hover/seek:h-[5px]"}`}
						>
							{/* Background track */}
							<div className="absolute inset-0 bg-white/25 rounded-full" />
							{/* Buffered */}
							<div
								className="absolute top-0 left-0 h-full bg-white/40 rounded-full"
								style={{ width: `${buffered}%` }}
							/>
							{/* Played (app theme) */}
							<div
								className="absolute top-0 left-0 h-full bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)]"
								style={{ width: `${progress}%` }}
							/>
							{/* Hover highlight */}
							{seekHoverPos !== null && (
								<div
									className="absolute top-0 left-0 h-full bg-white/20 rounded-full"
									style={{ width: `${seekHoverPos}%` }}
								/>
							)}
							{/* Thumb — always visible on mobile when controls shown, hover on desktop */}
							<div
								className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 md:w-[14px] md:h-[14px] bg-rose-500 rounded-full transition-transform shadow-[0_0_10px_rgba(244,63,94,0.8)] ${isSeeking ? "scale-125" : "scale-100 md:scale-0 md:group-hover/seek:scale-100"}`}
								style={{ left: `calc(${progress}% - 6px)` }}
							/>
						</div>
					</div>
				</div>

				{/* Time & Controls Row */}
				<div
					className={`flex items-center justify-between text-white px-1 md:px-4 py-1 md:py-3 pb-1 md:pb-4 ${controlsVisible ? "pointer-events-auto" : "pointer-events-none"}`}
					onClick={(e) => e.stopPropagation()}
				>
					{/* Left side */}
					<div className="flex items-center gap-0.5 sm:gap-1 md:gap-3 shrink-0 min-w-0">
						{/* Play/Pause */}
						<button
							onClick={togglePlay}
							className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
						>
							{isPlaying ? (
								<Pause size={18} className="fill-current" />
							) : (
								<Play size={18} className="fill-current ml-0.5" />
							)}
						</button>

						{/* Next (desktop only) */}
						<button
							onClick={() => onNext?.()}
							disabled={!hasNext}
							className={`hidden md:flex min-w-[36px] min-h-[36px] items-center justify-center hover:bg-white/10 rounded-full transition-colors ${!hasNext ? "opacity-30" : ""}`}
						>
							<SkipForward size={18} className="fill-current" />
						</button>

						{/* Mute */}
						<button
							onClick={toggleMute}
							className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
						>
							{isMuted || volume === 0 ? (
								<VolumeX size={16} />
							) : (
								<Volume2 size={16} />
							)}
						</button>

						{/* Time — shrinks on small screens */}
						<span className="text-[9px] xs:text-[10px] sm:text-xs font-medium tabular-nums whitespace-nowrap ml-0.5 truncate max-w-[72px] sm:max-w-none">
							{formatTime(currentTime)}
							<span className="opacity-40 mx-0.5">/</span>
							{formatTime(duration)}
						</span>
					</div>

					{/* Right side */}
					<div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 shrink-0">
						{/* HD Toggle — only if hdUrl exists */}
						{hdUrl && (
							<button
								onClick={() => {
									const t = videoRef.current?.currentTime || 0;
									setIsHD((h) => !h);
									// restore time after src change
									setTimeout(() => {
										if (videoRef.current) videoRef.current.currentTime = t;
									}, 300);
								}}
								className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full transition-all text-[9px] font-black border ${
									isHD
										? "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/40"
										: "border-white/30 text-white/70 hover:bg-white/10"
								}`}
								title={isHD ? "Switch to SD" : "Switch to HD"}
							>
								HD
							</button>
						)}

						{/* Speed */}
						<button
							onClick={() => setShowSpeedMenu((p) => !p)}
							className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
						>
							{playbackSpeed !== 1 ? (
								<span className="text-[9px] font-bold">{playbackSpeed}x</span>
							) : (
								<Settings size={16} />
							)}
						</button>

						{/* Rotate */}
						<button
							onClick={toggleRotation}
							className="min-w-[36px] min-h-[36px] hidden sm:flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
						>
							<RotateCw size={16} />
						</button>

						{/* Fullscreen — large enough touch target */}
						<button
							onClick={toggleFullscreen}
							className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
						>
							{isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
						</button>
					</div>
				</div>
			</div>

			{/* Speed Menu — portal to container in fullscreen, body otherwise */}
			{showSpeedMenu &&
				(containerRef.current || document.body) &&
				createPortal(
					<div
						className="absolute inset-0 z-[200] flex items-end justify-center font-sans"
						onClick={handleClose_speed_menu}
					>
						<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
						<div
							className="relative w-full max-w-sm bg-neutral-900 rounded-t-3xl border-t border-white/10 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4" />
							<div className="px-5 pb-2 text-xs text-white/50 font-bold uppercase tracking-widest">
								Playback Speed
							</div>
							<div className="grid grid-cols-4 gap-2 px-4 pb-4">
								{PLAYBACK_SPEEDS.map((s) => (
									<button
										key={s}
										onClick={() => changeSpeed(s)}
										className={`py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
											playbackSpeed === s
												? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
												: "bg-white/10 text-white hover:bg-white/20"
										}`}
									>
										{s === 1 ? "Normal" : `${s}×`}
									</button>
								))}
							</div>
						</div>
					</div>,
					isFullscreen && containerRef.current
						? containerRef.current
						: document.body,
				)}
		</div>
	);
};

export default CustomVideoPlayer;

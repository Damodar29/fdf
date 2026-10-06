import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { MediaSession } from "@capgo/capacitor-media-session";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useAudioStore } from "../store/audioStore";
import type { Bhajan, BhajanAudio, RepeatMode } from "../types";
import {
	getCachedAudioUrl,
	getNativeAudioSrc,
	getPlayableUrl,
	isTrackDownloaded,
} from "../utils/audioStorage";
import {
	KeepAwakeOwner,
	releaseKeepAwake,
	setKeepAwakeFor,
} from "../utils/keepAwakeManager";
import { useData } from "./DataContext";
import { useSettings } from "./SettingsContext";

// Thin bridge to native CrashlyticsPlugin for non-fatal error reporting.
// Only used to forward media session errors that were previously silently dropped.
const CrashlyticsNative = Capacitor.isNativePlatform()
	? registerPlugin<{
			log: (opts: { message: string }) => Promise<void>;
			recordException: (opts: {
				message: string;
				stack?: string;
			}) => Promise<void>;
		}>("Crashlytics")
	: null;

// Public HTTPS URL of the app icon — used as fallback artwork in Android media notification.
// Android's native media session cannot fetch images from capacitor://localhost, so we need
// an absolute public URL. Update this if your Firebase hosting domain changes.
// Import the icon as a base64 string directly so Capacitor Android plugin can read it natively
import { defaultIconBase64 } from "../src/iconBase64";

const PUBLIC_ICON_URL = defaultIconBase64;
const defaultIcon = "/icon.webp";

// ─── iOS Audio Unlock ─────────────────────────────────────────────────────────
// iOS Safari/Chrome require a user gesture to unlock the audio context.
// We play a silent 1-frame AudioContext buffer on the first touch event so
// that subsequent programmatic play() calls (even after async awaits) succeed.
//
// Module-level flag is intentional: we only need to unlock once per page load.
// It is reset to false if AudioProvider unmounts (e.g. during dev hot-reload)
// so the next mount can re-register listeners if needed.
let iosAudioUnlocked = false;
const resetIOSAudioUnlock = () => {
	iosAudioUnlocked = false;
};
const unlockIOSAudio = () => {
	if (iosAudioUnlocked) return;
	iosAudioUnlocked = true;

	// Only run this Web Audio hack on iOS devices, as Chrome on Android/Desktop logs warnings
	const isIOS =
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
	if (!isIOS) return;

	try {
		// Method 1: Web Audio API silent buffer
		const AudioContextCtor =
			(window as any).AudioContext || (window as any).webkitAudioContext;
		if (AudioContextCtor) {
			const ctx = new AudioContextCtor();
			// BUG FIX: Resume BEFORE start() — iOS 13+ requires the context to be
			// in "running" state before a BufferSourceNode fires audio. Calling
			// resume() after start() is a no-op because start() immediately queues
			// the sample and the context may still be suspended when it fires.
			const resumePromise =
				ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
			resumePromise
				.then(() => {
					const buf = ctx.createBuffer(1, 1, 22050);
					const src = ctx.createBufferSource();
					src.buffer = buf;
					src.connect(ctx.destination);
					src.start(0);
				})
				.catch(() => {
					/* ignore — gesture context may have expired */
				});
		}
	} catch (_e) {
		/* ignore */
	}
};

// ─── MediaSession Concurrency + Background Fix ────────────────────────────────
// 1. Android 12+ throws ForegroundServiceStartNotAllowedException when
//    MediaSessionService.startForeground() is called while the app is in the
//    background. We track app state and skip non-essential MediaSession calls
//    while backgrounded.
// 2. Rapid concurrent updates can cause ConcurrentModificationException.
//    We serialize all native MediaSession calls via a queue.
let mediaSessionQueue: Promise<void> = Promise.resolve();
let _appIsInForeground = true; // assume foreground at startup

// ── Low-end device protection ────────────────────────────────────────────────
// Track how many calls are pending in the queue. On Snapdragon 4xx / Helio G85,
// Java-side MediaSession processing is slow. If we queue calls faster than Java
// can handle them, the promise chain grows unboundedly → jank & battery drain.
// We give each call a priority:
//   'high' = metadata, playback state  → always enqueue
//   'low'  = position state updates    → dropped when queue is backlogged
let mediaSessionQueueDepth = 0;
const MAX_QUEUE_DEPTH = 3; // max pending low-priority calls before we start dropping

// ── appStateChange listener ───────────────────────────────────────────────────
// Tracks foreground/background state for crash prevention.
// When the app returns to foreground, the audio element may have been paused by
// OEM battery managers (Xiaomi MIUI, Samsung OneUI, Oppo ColorOS) even though
// we call wv.onResume() in MainActivity.onStop(). The audioRef is checked in
// AudioProvider.useEffect below to re-trigger playback if needed.
let _audioRefForResume: React.RefObject<HTMLAudioElement> | null = null;
let _wasPlayingBeforeBackground = false;

// BUG FIX: Store the listener handle so it can be removed if the module is
// reloaded (Vite HMR) or AudioProvider mounts/unmounts. Previously, every
// hot-reload accumulated another listener, causing duplicate OEM-recovery
// plays and potential memory leaks.
let _appStateChangeHandle: any = null;
const ensureAppStateListener = () => {
	if (!Capacitor.isNativePlatform()) return;
	if (_appStateChangeHandle) return; // already registered
	CapacitorApp.addListener("appStateChange", ({ isActive }) => {
		_appIsInForeground = isActive;
		if (isActive) {
			// Reset depth counter (old promises may have resolved during background)
			mediaSessionQueueDepth = 0;
			// OEM battery-optimizer recovery: if audio was playing before we went to
			// background and the audio element is now paused, resume playback.
			if (_wasPlayingBeforeBackground && _audioRefForResume?.current?.paused) {
				_audioRefForResume.current.play().catch((e) => {
					if (e.name !== "AbortError")
						console.warn(
							"[AudioContext] Foreground resume play failed:",
							e.name,
						);
				});
			}
		} else {
			// Record whether audio was active before going to background
			_wasPlayingBeforeBackground = !(
				_audioRefForResume?.current?.paused ?? true
			);
		}
	}).then((handle) => {
		_appStateChangeHandle = handle;
	});
};
ensureAppStateListener();

/**
 * Safely invoke a native MediaSession API call.
 * All calls are serialized through a queue to prevent ConcurrentModificationException.
 * Errors are forwarded to Crashlytics as non-fatal events for visibility.
 *
 * priority='high' : metadata, playbackState, bootstrap — always enqueued.
 * priority='low'  : setPositionState — dropped when queue has >= MAX_QUEUE_DEPTH
 *                   pending calls (low-end device protection).
 */
const safeMediaSessionCall = (
	fn: () => Promise<any>,
	priority: "high" | "low" = "low",
) => {
	if (!Capacitor.isNativePlatform()) return;
	// Drop low-priority calls if Java is already backlogged
	if (priority === "low" && mediaSessionQueueDepth >= MAX_QUEUE_DEPTH) return;
	mediaSessionQueueDepth++;
	mediaSessionQueue = mediaSessionQueue.then(async () => {
		try {
			await fn();
		} catch (e: any) {
			const rawMsg = e?.message || String(e);
			// Truncate to prevent oversized payloads crashing CrashlyticsPlugin
			const msg = rawMsg.length > 1024 ? `${rawMsg.slice(0, 1024)}…` : rawMsg;
			const stack = e?.stack
				? e.stack.length > 4096
					? `${e.stack.slice(0, 4096)}…`
					: e.stack
				: undefined;
			console.warn("Native MediaSession error:", e);
			// Forward to Crashlytics as a non-fatal event so errors are visible
			// in the Firebase dashboard instead of being silently swallowed.
			CrashlyticsNative?.recordException({
				message: `[MediaSession] ${msg}`,
				stack,
			}).catch(() => {
				/* Crashlytics logging must never throw */
			});
		} finally {
			mediaSessionQueueDepth = Math.max(0, mediaSessionQueueDepth - 1);
		}
	});
};

interface AudioContextType {
	currentTrack: BhajanAudio | null;
	currentBhajan: Bhajan | null;
	isPlaying: boolean;
	isLoading: boolean;
	progress: number;
	duration: number;
	// Queue & Repeat state
	repeatMode: RepeatMode;
	toggleRepeat: () => void;
	playTrack: (
		track: BhajanAudio,
		title: string,
		parentBhajan?: Bhajan,
		imageUrl?: string,
		contextQueue?: BhajanAudio[],
		queueTitle?: string,
	) => void;
	playNext: () => void;
	playPrevious: () => void;
	togglePlay: () => void;
	seek: (time: number) => void;
	closePlayer: () => void;
	trackTitle: string;
	trackImage: string;
	queue: BhajanAudio[];
	queueTitle: string;
	updateQueueItem: (newTrack: BhajanAudio) => void;
	addToQueue: (newTrack: BhajanAudio) => void;
	removeFromQueue: (trackId: string) => void;
	clearQueue: () => void;
	playQueueTrack: (index: number) => void;

	// UI State
	isQueueOpen: boolean;
	setQueueOpen: (open: boolean) => void;
	selectTrack: (
		track: BhajanAudio,
		title: string,
		parentBhajan?: Bhajan,
		imageUrl?: string,
	) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	// Unlock iOS audio on first user interaction
	useEffect(() => {
		const events = ["touchstart", "touchend", "mousedown", "keydown", "click"];
		const handler = () => {
			unlockIOSAudio();
			events.forEach((e) => document.removeEventListener(e, handler, true));
		};
		events.forEach((e) =>
			document.addEventListener(e, handler, { once: true, capture: true }),
		);
		return () => {
			events.forEach((e) => document.removeEventListener(e, handler, true));
			// Reset unlock flag on unmount (e.g. HMR / dev hot-reload) so the
			// next AudioProvider mount can re-register listeners correctly.
			resetIOSAudioUnlock();
		};
	}, []);
	const { bhajans } = useData();
	const { keepAwake } = useSettings();
	const [currentTrack, setCurrentTrack] = useState<BhajanAudio | null>(null);
	const [currentBhajan, setCurrentBhajan] = useState<Bhajan | null>(null);
	const [trackTitle, setTrackTitle] = useState("");
	const [trackImage, setTrackImage] = useState(defaultIcon);
	const [isPlaying, setIsPlaying_local] = useState(false);
	const [isLoading, setIsLoading_local] = useState(false);
	const [progress, setProgress_local] = useState(0);
	const [duration, setDuration_local] = useState(0);

	// Dual-write helpers: keep React Context state in sync AND write to audioStore
	// so components can subscribe granularly to high-frequency audio state without
	// needing to consume the full AudioContext.
	const {
		setIsPlaying: setIsPlayingStore,
		setIsLoading: setIsLoadingStore,
		setProgress: setProgressStore,
		setDuration: setDurationStore,
		resetPlayback,
	} = useAudioStore.getState();
	const setIsPlaying = (val: boolean) => {
		setIsPlaying_local(val);
		useAudioStore.getState().setIsPlaying(val);
	};
	const setIsLoading = (val: boolean) => {
		setIsLoading_local(val);
		useAudioStore.getState().setIsLoading(val);
	};
	const setProgress = (val: number) => {
		setProgress_local(val);
		useAudioStore.getState().setProgress(val);
	};
	const setDuration = (val: number) => {
		setDuration_local(val);
		useAudioStore.getState().setDuration(val);
	};
	// Suppress unused var warnings for store setters captured in closure above
	void setIsPlayingStore;
	void setIsLoadingStore;
	void setProgressStore;
	void setDurationStore;
	void resetPlayback;

	// Queue UI State
	const [isQueueOpen, setIsQueueOpen] = useState(false);
	// Back-button: isQueueOpen
	useEffect(() => {
		if (isQueueOpen)
			window.history.pushState({ isPopup: true, view: "audio-queue" }, "");
	}, [isQueueOpen]);
	const handleClose_audio_queue = () => {
		if (window.history.state?.view === "audio-queue") window.history.back();
		else setIsQueueOpen(false);
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_audio_queue is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const _h_audio_queue = (e: PopStateEvent) => {
			if (isQueueOpen && e.state?.view !== "audio-queue")
				handleClose_audio_queue();
		};
		window.addEventListener("popstate", _h_audio_queue);
		return () => window.removeEventListener("popstate", _h_audio_queue);
	}, [isQueueOpen]);

	// Enrich default track with parentBhajan once data is loaded
	useEffect(() => {
		if (
			bhajans.length > 0 &&
			currentTrack?.id === "269-v1" &&
			!currentTrack.parentBhajan
		) {
			const mahamantra = bhajans.find(
				(b) => b.songNumber === "269" || b.title.includes("महामंत्र हरे कृष्णा"),
			);
			if (mahamantra) {
				setCurrentTrack((prev) =>
					prev
						? {
								...prev,
								parentBhajan: mahamantra,
								bhajanTitle: prev.bhajanTitle || mahamantra.title,
							}
						: prev,
				);
				setCurrentBhajan(mahamantra);
			}
		}
	}, [bhajans, currentTrack?.id, currentTrack?.parentBhajan]);

	const [repeatMode, setRepeatMode_local] = useState<RepeatMode>(() => {
		try {
			const saved = localStorage.getItem("cpbs_repeat_mode");
			if (saved === "off" || saved === "one" || saved === "all") return saved;
			return "one";
		} catch {
			return "one";
		}
	});
	const setRepeatMode = (
		updater: RepeatMode | ((prev: RepeatMode) => RepeatMode),
	) => {
		setRepeatMode_local((prev) => {
			const next = typeof updater === "function" ? updater(prev) : updater;
			useAudioStore.getState().setRepeatMode(next);
			return next;
		});
	};

	useEffect(() => {
		try {
			localStorage.setItem("cpbs_repeat_mode", repeatMode);
		} catch (e) {
			console.warn("Failed to save repeat mode", e);
		}
	}, [repeatMode]);

	// Screen Wake Lock Logic: Keep device awake during playback if user setting is ON.
	//
	// Goes through keepAwakeManager rather than calling the plugin directly: the
	// underlying Android FLAG_KEEP_SCREEN_ON is global, so releasing it here used
	// to also cancel BhajanReader's claim on it. The manager only clears the flag
	// once every holder has let go.
	useEffect(() => {
		setKeepAwakeFor(KeepAwakeOwner.AUDIO_PLAYBACK, isPlaying && keepAwake);

		return () => {
			releaseKeepAwake(KeepAwakeOwner.AUDIO_PLAYBACK);
		};
	}, [isPlaying, keepAwake]);

	const [queue, setQueue] = useState<BhajanAudio[]>([]);
	const [queueTitle, setQueueTitle] = useState<string>("Song List");

	const audioRef = useRef<HTMLAudioElement>(null);
	const currentTrackIdRef = useRef<string | null>(null);

	// Wire audioRef to module-level variable so the appStateChange listener
	// (defined outside this component) can access it for OEM resume recovery.
	// Safe: the ref object identity is stable across renders.
	_audioRefForResume = audioRef;

	// Background mode is handled automatically by @capgo/capacitor-media-session
	// which runs its own MediaSessionService foreground service on Android.
	// No cordova-plugin-background-mode needed.

	const closePlayer = useCallback(() => {
		// If we're closing the default track, mark it as dismissed in localStorage
		if (currentTrack?.id === "269-v1") {
			try {
				localStorage.setItem("cpbs_mahamantra_dismissed", "true");
			} catch (e) {
				console.warn("Failed to save dismissal to localStorage", e);
			}
		}

		currentTrackIdRef.current = null;
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.removeAttribute("src");
			audioRef.current.load();
		}
		setCurrentTrack(null);
		setCurrentBhajan(null);
		setTrackTitle("महामंत्र हरे कृष्णा"); // Default title fallback
		setTrackImage(defaultIcon);
		setIsPlaying(false);
		setProgress(0);
		setDuration(0);
		setQueue([]);
		setQueueTitle("Song List");

		// Stop the MediaSession foreground service cleanly.
		if (Capacitor.isNativePlatform()) {
			safeMediaSessionCall(() =>
				MediaSession.setPlaybackState({ playbackState: "none" }),
			);
			// Report position=0 so seekbar resets
			safeMediaSessionCall(() =>
				MediaSession.setPositionState({
					duration: 0,
					playbackRate: 1,
					position: 0,
				}),
			);
		}
		if ("mediaSession" in navigator) {
			navigator.mediaSession.playbackState = "none";
		}
	}, [currentTrack?.id]);

	const handlePlay = useCallback(() => {
		audioRef.current?.play().catch((e) => {
			if (e.name !== "AbortError") console.error("Play failed", e);
		});
	}, []);

	const handlePause = useCallback(() => audioRef.current?.pause(), []);
	const handleStop = useCallback(() => closePlayer(), [closePlayer]);
	const handleSeek = useCallback((details: any) => {
		if (details?.seekTime != null && audioRef.current) {
			audioRef.current.currentTime = details.seekTime;
		}
	}, []);

	/**
	 * Skip forward 10 seconds — shows as a dedicated button in the expanded
	 * Android media notification alongside prev/play/next.
	 * seekOffset is provided by the OS (defaulting to 10s if not specified).
	 */
	const handleSeekForward = useCallback((details?: any) => {
		if (!audioRef.current) return;
		const offset = details?.seekOffset ?? 10;
		const newTime = Math.min(
			audioRef.current.currentTime + offset,
			audioRef.current.duration || audioRef.current.currentTime,
		);
		audioRef.current.currentTime = newTime;
		if (Capacitor.isNativePlatform()) {
			const dur = audioRef.current.duration || 0;
			safeMediaSessionCall(() =>
				MediaSession.setPositionState({
					duration: dur,
					playbackRate: 1,
					position: newTime,
				}),
			);
		}
	}, []);

	/**
	 * Skip backward 10 seconds — symmetric to handleSeekForward.
	 */
	const handleSeekBackward = useCallback((details?: any) => {
		if (!audioRef.current) return;
		const offset = details?.seekOffset ?? 10;
		const newTime = Math.max(audioRef.current.currentTime - offset, 0);
		audioRef.current.currentTime = newTime;
		if (Capacitor.isNativePlatform()) {
			const dur = audioRef.current.duration || 0;
			safeMediaSessionCall(() =>
				MediaSession.setPositionState({
					duration: dur,
					playbackRate: 1,
					position: newTime,
				}),
			);
		}
	}, []);

	const updateQueueItem = (newTrack: BhajanAudio) => {
		setQueue((prevQueue) => {
			const currentIndex = prevQueue.findIndex(
				(t) => t.id === currentTrack?.id,
			);
			if (currentIndex === -1) return prevQueue;

			const updatedQueue = [...prevQueue];
			const oldTrack = updatedQueue[currentIndex];
			updatedQueue[currentIndex] = {
				...newTrack,
				bhajanTitle: oldTrack.bhajanTitle,
				parentBhajan: oldTrack.parentBhajan,
			};
			return updatedQueue;
		});
	};

	const addToQueue = (newTrack: BhajanAudio) => {
		setQueue((prev) => [...prev, newTrack]);
	};

	const removeFromQueue = (trackId: string) => {
		setQueue((prev) => prev.filter((t) => t.id !== trackId));
	};

	const clearQueue = () => {
		setQueue([]);
	};

	const playQueueTrack = (index: number) => {
		if (index >= 0 && index < queue.length) {
			const track = queue[index];
			const title = track.bhajanTitle || trackTitle;
			const parent = track.parentBhajan || currentBhajan || undefined;
			playTrack(track, title, parent, trackImage, queue, queueTitle);
		}
	};

	const playTrack = async (
		track: BhajanAudio,
		title: string,
		parentBhajan?: Bhajan,
		imageUrl: string = defaultIcon,
		contextQueue?: BhajanAudio[],
		contextTitle?: string,
	) => {
		const isSameTrack = currentTrackIdRef.current === track.id;
		// Ensure the track object stored in state has the title metadata
		// This is crucial for QueueManager to display the title correctly instead of "Unknown Title"
		const enhancedTrack = {
			...track,
			bhajanTitle: title || track.bhajanTitle || parentBhajan?.title,
			parentBhajan: parentBhajan || track.parentBhajan,
		};

		setCurrentTrack(enhancedTrack);
		currentTrackIdRef.current = track.id;
		setTrackTitle(title);
		setTrackImage(imageUrl);
		if (parentBhajan) setCurrentBhajan(parentBhajan);

		if (contextQueue) {
			// Safe mapping to ensure every item in the queue has a title
			// If an item lacks a title, fall back to the context title (e.g. Playlist Name or Lecture Title)
			const safeQueue = contextQueue.map((t) => ({
				...t,
				bhajanTitle:
					t.bhajanTitle ||
					(t.id === track.id ? title : undefined) ||
					t.parentBhajan?.title ||
					contextTitle ||
					"Unknown Title",
				parentBhajan:
					t.parentBhajan || (t.id === track.id ? parentBhajan : undefined),
			}));

			setQueue(safeQueue);
			setQueueTitle(contextTitle || "Playlist");
		} else {
			if (!contextQueue && queue.length === 0) {
				setQueue([enhancedTrack]);
				setQueueTitle(contextTitle || "Song List");
			}
		}

		if (isSameTrack) {
			if (audioRef.current?.paused) {
				audioRef.current.play().catch(console.error);
				setIsPlaying(true);
			}
			return;
		}

		setIsLoading(true);
		setIsPlaying(false);

		const isDownloaded = isTrackDownloaded(track.id);
		// Android doesn't need the gesture pre-play below: Capacitor disables the
		// WebView's user-gesture requirement for media. For a downloaded track the
		// remote pre-load would only stream from the internet for a moment (and
		// fail offline, flickering the loading state) before switching to the
		// local file, so go straight to the local file there.
		const skipRemotePreload =
			isDownloaded && Capacitor.getPlatform() === "android";

		// ── iOS FIX: Touch gesture context is active RIGHT NOW. ──────────────────
		// iOS Safari's gesture trust EXPIRES the moment execution hits an `await`.
		// We MUST call audio.play() synchronously here, before any async work.
		// This "unlocks" the audio element — even if play() gets aborted later,
		// the element stays unlocked so the final play() after await succeeds.
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.removeAttribute("crossOrigin");
			if (!skipRemotePreload) {
				audioRef.current.currentTime = 0;
				const immediateUrl = getPlayableUrl(track.url);
				audioRef.current.src = immediateUrl;
				audioRef.current.load();
				// *** CRITICAL: call play() NOW while still in the synchronous gesture handler ***
				audioRef.current.play().catch((e) => {
					if (e.name !== "AbortError")
						console.warn("[AudioContext] Initial play catch:", e.name);
				});
			}
		}

		try {
			let src = getPlayableUrl(track.url); // default

			if (Capacitor.isNativePlatform()) {
				// Native Path Handling
				if (isDownloaded) {
					const nativeSrc = await getNativeAudioSrc(
						track.id,
						title,
						track.singer,
					);
					src = nativeSrc || getPlayableUrl(track.url);
				} else {
					src = getPlayableUrl(track.url);
				}
			} else {
				// Web Cache Handling
				if (isDownloaded) {
					const cached = await getCachedAudioUrl(track.url);
					src = cached || getPlayableUrl(track.url);
				} else {
					src = getPlayableUrl(track.url);
				}
			}

			if (currentTrackIdRef.current !== track.id) {
				return;
			}

			if (audioRef.current) {
				if (!src) {
					console.error("No playable source found for track:", track.id);
					setIsLoading(false);
					return;
				}

				// Only update src if it changed from what we pre-loaded. Without a
				// pre-load the element still holds the previous track, so always load
				// fresh (two tracks can resolve to the same named local file).
				if (
					skipRemotePreload ||
					(audioRef.current.src !== src &&
						!audioRef.current.src.endsWith(src))
				) {
					audioRef.current.src = src;
					audioRef.current.load();
				}

				console.log(`[AudioContext] Playing: ${src}`);

				const tryPlay = () => {
					if (!audioRef.current || currentTrackIdRef.current !== track.id)
						return;
					const playPromise = audioRef.current.play();
					if (playPromise !== undefined) {
						playPromise
							.then(() => {
								if (currentTrackIdRef.current === track.id) setIsPlaying(true);
							})
							.catch((e) => {
								if (
									e.name === "AbortError" ||
									e.message?.includes("interrupted") ||
									e.message?.includes("was removed from the document")
								) {
									// Safe to ignore — another track started or element unmounted
									return;
								}
								if (e.name === "NotAllowedError") {
									// iOS: autoplay blocked. Audio is loaded, user taps Play to start.
									console.warn(
										"[AudioContext] iOS autoplay blocked – showing paused state, user can tap Play.",
									);
									if (currentTrackIdRef.current === track.id) {
										setIsLoading(false);
										setIsPlaying(false);
									}
								} else {
									console.error("[AudioContext] Playback failed:", e);
									if (currentTrackIdRef.current === track.id)
										setIsLoading(false);
								}
							});
					}
				};

				// If audio is already in a ready state, play immediately;
				// otherwise wait for canplay event (needed when src was just changed).
				if (audioRef.current.readyState >= 3) {
					tryPlay();
				} else {
					const onReady = () => {
						audioRef.current?.removeEventListener("canplay", onReady);
						tryPlay();
					};
					audioRef.current.addEventListener("canplay", onReady, { once: true });
				}
			}
		} catch (e) {
			console.error("Error setting up track", e);
			if (currentTrackIdRef.current === track.id) setIsLoading(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	const playNext = useCallback(() => {
		if (queue.length <= 1) return;
		let currentIndex = queue.findIndex(
			(t) => t.id === currentTrackIdRef.current,
		);

		if (currentIndex === -1 && currentBhajan) {
			currentIndex = queue.findIndex(
				(t) => t.parentBhajan?.id === currentBhajan.id,
			);
		}

		if (currentIndex === -1 && trackTitle) {
			currentIndex = queue.findIndex((t) => t.bhajanTitle === trackTitle);
		}

		if (currentIndex === -1) return;

		const nextIndex = (currentIndex + 1) % queue.length;
		const nextTrack = queue[nextIndex];

		const nextTitle = nextTrack.bhajanTitle || trackTitle;
		const nextParent = nextTrack.parentBhajan || currentBhajan || undefined;

		playTrack(nextTrack, nextTitle, nextParent, trackImage, queue, queueTitle);
	}, [queue, trackTitle, currentBhajan, trackImage, queueTitle]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	const playPrevious = useCallback(() => {
		if (queue.length <= 1) return;
		let currentIndex = queue.findIndex(
			(t) => t.id === currentTrackIdRef.current,
		);

		if (currentIndex === -1 && currentBhajan) {
			currentIndex = queue.findIndex(
				(t) => t.parentBhajan?.id === currentBhajan.id,
			);
		}

		if (currentIndex === -1 && trackTitle) {
			currentIndex = queue.findIndex((t) => t.bhajanTitle === trackTitle);
		}

		if (currentIndex === -1) return;

		let prevIndex = currentIndex - 1;
		if (prevIndex < 0) prevIndex = queue.length - 1;
		const prevTrack = queue[prevIndex];

		const prevTitle = prevTrack.bhajanTitle || trackTitle;
		const prevParent = prevTrack.parentBhajan || currentBhajan || undefined;

		playTrack(prevTrack, prevTitle, prevParent, trackImage, queue, queueTitle);
	}, [queue, trackTitle, currentBhajan, trackImage, queueTitle]);

	useEffect(() => {
		if (Capacitor.isNativePlatform()) {
			MediaSession.setActionHandler({ action: "play" }, handlePlay);
			MediaSession.setActionHandler({ action: "pause" }, handlePause);
			MediaSession.setActionHandler({ action: "stop" }, handleStop);
			MediaSession.setActionHandler({ action: "seekto" }, handleSeek);
			// seekbackward/seekforward: show as ⏪-10s and +10s⏩ buttons in expanded notification.
			// These do NOT replace prev/next — Android shows all 5 in expanded view:
			//   ⏮  |  ⏪-10s  |  ⏯ Play/Pause  |  +10s⏩  |  ⏭
			// In compact (lockscreen) view, Android picks the 3 most relevant (prev/play/next).
			MediaSession.setActionHandler(
				{ action: "seekbackward" },
				handleSeekBackward,
			);
			MediaSession.setActionHandler(
				{ action: "seekforward" },
				handleSeekForward,
			);
			MediaSession.setActionHandler({ action: "nexttrack" }, playNext);
			MediaSession.setActionHandler({ action: "previoustrack" }, playPrevious);
		}

		if ("mediaSession" in navigator) {
			navigator.mediaSession.setActionHandler("play", handlePlay);
			navigator.mediaSession.setActionHandler("pause", handlePause);
			navigator.mediaSession.setActionHandler("stop", handleStop);
			navigator.mediaSession.setActionHandler("seekto", (details) =>
				handleSeek(details),
			);
			navigator.mediaSession.setActionHandler("seekbackward", (details) =>
				handleSeekBackward(details),
			);
			navigator.mediaSession.setActionHandler("seekforward", (details) =>
				handleSeekForward(details),
			);
			navigator.mediaSession.setActionHandler("nexttrack", playNext);
			navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
		}
	}, [
		handlePlay,
		handlePause,
		handleStop,
		handleSeek,
		handleSeekForward,
		handleSeekBackward,
		playNext,
		playPrevious,
	]);

	// ── Queue position memoization ────────────────────────────────────────────────
	// Declared BEFORE updateMediaSession (which references them) because TypeScript
	// const is not hoisted. updateMediaSession depends on this number (not the queue
	// array), so it still only re-runs when the position actually changes.
	// (The old dep list used `queue.findIndex` — the same prototype function for
	// every array — so the index never refreshed when the queue was edited.)
	const currentQueueIndex = React.useMemo(
		() => queue.findIndex((t) => t.id === currentTrack?.id),
		[currentTrack?.id, queue],
	);
	const queueLength = queue.length;
	// ─────────────────────────────────────────────────────────────

	const updateMediaSession = useCallback(async () => {
		if (!currentTrack) return;

		// On Android (Capacitor), the MediaSessionPlugin Java code downloads artwork via HttpURLConnection.
		// It cannot access 'capacitor://localhost' or 'file://' paths. It ONLY supports HTTP/HTTPS or Base64.
		// If we have a local relative path, we use the base64-encoded image we imported above.
		let artworkSrc: string;
		if (
			trackImage.startsWith("https://") ||
			trackImage.startsWith("http://") ||
			trackImage.startsWith("data:image")
		) {
			artworkSrc = trackImage;
		} else {
			artworkSrc = PUBLIC_ICON_URL;
		}

		// Queue position label: "3 / 10 • Chaitanya Prem Bhakti Sangh"
		// NOTE: we use pre-computed currentQueueIndex + queue.length (not full queue array)
		// so this callback doesn't re-run when queue ITEMS change, only when position changes.
		const queuePos =
			currentQueueIndex !== -1
				? `${currentQueueIndex + 1} / ${queueLength} • `
				: "";
		const albumLabel = `${queuePos}${queueTitle || "Chaitanya Prem Bhakti Sangh"}`;

		if (Capacitor.isNativePlatform()) {
			// 'high' priority: metadata is critical — never drop even on backlogged queue
			safeMediaSessionCall(
				() =>
					MediaSession.setMetadata({
						title: trackTitle || "Bhajan",
						artist: currentTrack.singer || "Prem Bhakti",
						album: albumLabel,
						artwork: [
							{ src: artworkSrc, sizes: "1024x1024", type: "image/png" },
						],
					}),
				"high",
			);

			// 'high' priority: playback state must be accurate at all times
			safeMediaSessionCall(
				() =>
					MediaSession.setPlaybackState({
						playbackState: isPlaying ? "playing" : "paused",
					}),
				"high",
			);
		}

		if ("mediaSession" in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: trackTitle || "Bhajan",
				artist: currentTrack.singer || "Prem Bhakti",
				album: albumLabel,
				artwork: [{ src: artworkSrc, sizes: "1024x1024", type: "image/png" }],
			});
			navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
		}
		// currentQueueIndex + queueLength replace full 'queue' array as deps:
		// prevents re-running on every queue item mutation that doesn't affect position.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		currentTrack,
		trackTitle,
		trackImage,
		isPlaying,
		queueTitle,
		currentQueueIndex,
		queueLength,
	]);

	const toggleRepeat = () => {
		setRepeatMode((prev) => {
			if (prev === "off") return "one";
			if (prev === "one") return "all";
			return "off";
		});
	};

	useEffect(() => {
		updateMediaSession();
	}, [updateMediaSession]);

	/**
	 * Atomically bootstraps the Android MediaSession notification with
	 * metadata + playing state + position in one synchronous batch.
	 *
	 * WHY THIS IS NEEDED:
	 *  Android only renders play/pause/next/prev buttons in the media notification
	 *  AFTER it receives a setPlaybackState('playing') call. Currently these calls
	 *  happen reactively (via updateMediaSession useEffect which waits for React
	 *  state updates) — there's a race window where the notification is created
	 *  without buttons. By calling this directly inside onPlay() (which fires the
	 *  moment audio.play() resolves), we guarantee all required info is pushed
	 *  before Android renders the notification for the first time.
	 *
	 *  Called from: onPlay() audio event (fires immediately on first playback)
	 */
	type BootstrapFn = (
		title: string,
		singer: string,
		artwork: string,
		album: string,
		dur: number,
		pos: number,
	) => void;
	const bootstrapMediaSessionRef = useRef<BootstrapFn>(
		(title, singer, artwork, album, dur, pos) => {
			if (!Capacitor.isNativePlatform()) return;
			// Bootstrap is critical — always 'high' priority, never dropped
			safeMediaSessionCall(
				() =>
					MediaSession.setMetadata({
						title: title || "Bhajan",
						artist: singer || "Prem Bhakti",
						album: album || "Chaitanya Prem Bhakti Sangh",
						artwork: [{ src: artwork, sizes: "1024x1024", type: "image/png" }],
					}),
				"high",
			);
			safeMediaSessionCall(
				() => MediaSession.setPlaybackState({ playbackState: "playing" }),
				"high",
			);
			if (dur > 0) {
				// Position included in bootstrap — also high priority so seekbar is accurate immediately
				safeMediaSessionCall(
					() =>
						MediaSession.setPositionState({
							duration: dur,
							playbackRate: 1,
							position: pos,
						}),
					"high",
				);
			}
		},
	);

	// Keep the ref in sync with latest closure values so onPlay (a stable ref)
	// always sees up-to-date trackTitle / trackImage / etc.
	const trackTitleRef = useRef(trackTitle);
	const trackImageRef = useRef(trackImage);
	const queueTitleRef = useRef(queueTitle);
	const currentTrackRef2 = useRef(currentTrack);
	useEffect(() => {
		trackTitleRef.current = trackTitle;
	}, [trackTitle]);
	useEffect(() => {
		trackImageRef.current = trackImage;
	}, [trackImage]);
	useEffect(() => {
		queueTitleRef.current = queueTitle;
	}, [queueTitle]);
	useEffect(() => {
		currentTrackRef2.current = currentTrack;
	}, [currentTrack]);

	const selectTrack = useCallback(
		(
			track: BhajanAudio,
			title: string,
			parentBhajan?: Bhajan,
			imageUrl: string = defaultIcon,
		) => {
			const enhancedTrack = {
				...track,
				bhajanTitle: title || track.bhajanTitle || parentBhajan?.title,
				parentBhajan: parentBhajan || track.parentBhajan,
			};
			setCurrentTrack(enhancedTrack);
			currentTrackIdRef.current = track.id; // Mark as selected but don't play
			setTrackTitle(title);
			setTrackImage(imageUrl);
			if (parentBhajan) setCurrentBhajan(parentBhajan);
		},
		[],
	);

	const togglePlay = () => {
		if (audioRef.current) {
			if (
				currentTrack &&
				(!audioRef.current.src || audioRef.current.src === window.location.href)
			) {
				playTrack(
					currentTrack,
					trackTitle,
					currentBhajan || undefined,
					trackImage,
				);
				return;
			}
			if (isPlaying) {
				audioRef.current.pause();
			} else {
				const p = audioRef.current.play();
				if (p !== undefined) {
					p.catch((e) => {
						if (e.name !== "AbortError") console.error("Toggle play failed", e);
					});
				}
			}
		}
	};

	const positionReportRef = useRef<number>(0);
	const lastReportedPosRef = useRef<number>(-1); // last position we sent to Android
	// Track whether we've done the initial bootstrap for the current track.
	// Prevents redundant bootstrap calls on every play/unpause event.
	const bootstrappedTrackRef = useRef<string | null>(null);

	// Reset bootstrap flag when track changes (so new track always gets bootstrapped)
	useEffect(() => {
		if (currentTrack?.id !== bootstrappedTrackRef.current) {
			bootstrappedTrackRef.current = null;
		}
	}, [currentTrack?.id]);

	const seek = (time: number) => {
		if (audioRef.current) {
			audioRef.current.currentTime = time;
			setProgress(time);
			// Immediately update notification seekbar position (seek is user-initiated → high priority)
			if (Capacitor.isNativePlatform()) {
				const dur = audioRef.current.duration || 0;
				lastReportedPosRef.current = time; // sync delta guard
				safeMediaSessionCall(
					() =>
						MediaSession.setPositionState({
							duration: dur,
							playbackRate: 1,
							position: time,
						}),
					"high",
				);
			}
		}
	};

	const lastProgressUpdateRef = useRef<number>(0);

	const onTimeUpdate = () => {
		if (audioRef.current) {
			const cur = audioRef.current.currentTime;
			const dur = audioRef.current.duration || 0;

			// Throttle React state updates to ~1/sec — prevents 4 re-renders/sec on all
			// AudioContext consumers (story viewer, slideshow, etc.) while audio plays.
			const now = Date.now();
			if (now - lastProgressUpdateRef.current >= 1000) {
				lastProgressUpdateRef.current = now;
				setProgress(cur);
				setDuration(dur);
			}

			// Update notification seekbar every 2s AND only when position moved ≥ 1.5s.
			// • 2s interval:   halves bridge calls vs 1s (Capacitor JS→Java is not free)
			// • 1.5s delta:    skips report if audio was buffering/stalled at same position
			// Android extrapolates the seekbar between reports using playbackRate=1,
			// so 2s intervals still feel perfectly smooth to the user.
			if (Capacitor.isNativePlatform() && dur > 0) {
				const posChanged = Math.abs(cur - lastReportedPosRef.current) >= 1.5;
				if (now - positionReportRef.current > 2000 && posChanged) {
					positionReportRef.current = now;
					lastReportedPosRef.current = cur;
					safeMediaSessionCall(() =>
						MediaSession.setPositionState({
							duration: dur,
							playbackRate: 1,
							position: cur,
						}),
					);
				}
			}
		}
	};

	const onPlay = () => {
		if (currentTrackIdRef.current) {
			setIsPlaying(true);
		}
		if (Capacitor.isNativePlatform()) {
			// ── Bootstrap fix: push full session info immediately on first play ──
			// Android won't show notification buttons until it receives a
			// setPlaybackState('playing'). The reactive updateMediaSession() fires
			// after React re-renders, which can be too late (race with notification
			// creation). Calling bootstrapMediaSession here — inside the audio
			// 'play' event — guarantees all buttons appear the moment the notification shows.
			//
			// LOW-END OPTIMIZATION: Only bootstrap ONCE per track (not on every unpause).
			// After the first bootstrap the notification is fully set up; subsequent
			// play events only need setPlaybackState + position (cheap).
			const trackId = currentTrackIdRef.current;
			if (trackId && bootstrappedTrackRef.current !== trackId) {
				// ── First play for this track: full bootstrap ──
				bootstrappedTrackRef.current = trackId;
				const track = currentTrackRef2.current;
				const title = trackTitleRef.current;
				const album = queueTitleRef.current;
				const singer = track?.singer || "Prem Bhakti";
				const rawImg = trackImageRef.current;
				const artwork =
					rawImg.startsWith("https://") ||
					rawImg.startsWith("http://") ||
					rawImg.startsWith("data:image")
						? rawImg
						: PUBLIC_ICON_URL;
				const dur = audioRef.current?.duration || 0;
				const pos = audioRef.current?.currentTime || 0;
				lastReportedPosRef.current = pos;
				// Bootstrap already sends metadata + playing state + position — all done.
				bootstrapMediaSessionRef.current(
					title,
					singer,
					artwork,
					album,
					dur,
					pos,
				);
			} else {
				// ── Unpause (same track): lightweight update only ──
				safeMediaSessionCall(
					() => MediaSession.setPlaybackState({ playbackState: "playing" }),
					"high",
				);
				// Also send current position so seekbar is accurate after unpause.
				// (Bootstrap handled first-play position; this covers subsequent unpauses.)
				if (audioRef.current && audioRef.current.duration > 0) {
					const dur2 = audioRef.current.duration;
					const cur = audioRef.current.currentTime;
					lastReportedPosRef.current = cur; // sync delta guard
					safeMediaSessionCall(
						() =>
							MediaSession.setPositionState({
								duration: dur2,
								playbackRate: 1,
								position: cur,
							}),
						"high",
					);
				}
			}
		}
		if ("mediaSession" in navigator)
			navigator.mediaSession.playbackState = "playing";
	};

	const onPause = () => {
		setIsPlaying(false);
		if (Capacitor.isNativePlatform()) {
			// 'high' priority: pause state must always be accurate (affects notification button shown)
			safeMediaSessionCall(
				() => MediaSession.setPlaybackState({ playbackState: "paused" }),
				"high",
			);
			// Snapshot position at pause so seekbar doesn't drift
			if (audioRef.current && audioRef.current.duration > 0) {
				const dur = audioRef.current.duration;
				const cur = audioRef.current.currentTime;
				lastReportedPosRef.current = cur; // sync delta guard
				safeMediaSessionCall(() =>
					MediaSession.setPositionState({
						duration: dur,
						playbackRate: 0, // 0 = not advancing (paused)
						position: cur,
					}),
				);
			}
		}
		if ("mediaSession" in navigator)
			navigator.mediaSession.playbackState = "paused";
	};

	const onEnded = () => {
		// "Repeat all" over a one-track queue is the same as repeating that track;
		// playNext() bails out when queue.length <= 1, so it would just stop.
		if (repeatMode === "one" || (repeatMode === "all" && queue.length <= 1)) {
			if (audioRef.current) {
				audioRef.current.currentTime = 0;
				audioRef.current.play().catch(console.error);
			}
		} else if (repeatMode === "all") {
			playNext();
		} else {
			if (queue.length > 0) {
				const currentIndex = queue.findIndex(
					(t) => t.id === currentTrackIdRef.current,
				);
				if (currentIndex !== -1 && currentIndex < queue.length - 1) {
					playNext();
				} else {
					setIsPlaying(false);
				}
			} else {
				setIsPlaying(false);
			}
		}
	};

	const onDurationChange = () => {
		if (audioRef.current) {
			setDuration(audioRef.current.duration);
		}
	};

	const onLoadedMetadata = () => {
		if (audioRef.current) {
			setDuration(audioRef.current.duration);
			setIsLoading(false);
		}
	};

	const onLoadStart = () => setIsLoading(true);
	const onWaiting = () => setIsLoading(true);
	const onPlaying = () => setIsLoading(false);
	const onCanPlay = () => setIsLoading(false);

	const onAudioError = (_e: any) => {
		if (!audioRef.current?.src || audioRef.current.src === window.location.href)
			return;
		const error = audioRef.current.error;
		const currentSrc = audioRef.current.src;
		let errorMsg = "Unknown audio error";
		if (error) {
			switch (error.code) {
				case 1:
					errorMsg = "Aborted";
					break;
				case 2:
					errorMsg = "Network error";
					break;
				case 3:
					errorMsg = "Decode error";
					break;
				case 4:
					errorMsg = "Source not supported";
					break;
			}
		}
		console.error(
			`[AudioContext] Audio element error: ${errorMsg} (Code: ${error?.code}) for URL: ${currentSrc}`,
			error,
		);
		// Ensure loading state is cleared so UI doesn't look broken
		setIsLoading(false);
		setIsPlaying(false);
	};

	return (
		<AudioContext.Provider
			value={{
				currentTrack,
				currentBhajan,
				isPlaying,
				isLoading,
				progress,
				duration,
				playTrack,
				togglePlay,
				seek,
				closePlayer,
				trackTitle,
				trackImage,
				repeatMode,
				toggleRepeat,
				updateQueueItem,
				queueTitle,
				addToQueue,
				playNext,
				playPrevious,
				queue,
				removeFromQueue,
				clearQueue,
				playQueueTrack,
				isQueueOpen,
				setQueueOpen: setIsQueueOpen,
				selectTrack,
			}}
		>
			{children}
			<audio
				ref={audioRef}
				onTimeUpdate={onTimeUpdate}
				onDurationChange={onDurationChange}
				onLoadedMetadata={onLoadedMetadata}
				onLoadStart={onLoadStart}
				onWaiting={onWaiting}
				onPlaying={onPlaying}
				onCanPlay={onCanPlay}
				onPlay={onPlay}
				onPause={onPause}
				onEnded={onEnded}
				onError={onAudioError}
				preload="metadata"
				playsInline
				x-webkit-airplay="allow"
				style={{ display: "none" }}
			/>
		</AudioContext.Provider>
	);
};

export const useAudio = () => {
	const context = useContext(AudioContext);
	if (!context) throw new Error("useAudio must be used within AudioProvider");
	return context;
};

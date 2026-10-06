import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { create } from "zustand";
import { getPlayableUrl } from "../lib/cdnUrl";
import type { Bhajan, BhajanAudio, RepeatMode } from "../types";
import { getDownloadedUri } from "./downloadStore";
import { showToast } from "./toastStore";

// App-wide audio engine: native replacement for context/AudioContext.tsx.
//
// There is exactly ONE native player for the whole app (created lazily
// below, outside React), so audio keeps playing across screen changes and
// in the background, and the lock-screen/notification controls always point
// at it. The Capacitor app needed a hidden <audio> element, a media-session
// plugin and hand-written OEM battery-killer recovery for this; expo-audio's
// foreground media service covers that natively.
//
// Queue/repeat semantics are carried over from AudioContext.tsx: next/prev
// wrap around, repeat cycles off → one → all, and with repeat off playback
// continues through the queue and stops after the last track.

export interface QueueTrack extends BhajanAudio {
	bhajanTitle: string;
	parentBhajan?: Bhajan;
}

interface AudioState {
	currentTrack: QueueTrack | null;
	queue: QueueTrack[];
	queueTitle: string;
	repeatMode: RepeatMode;
	isPlaying: boolean;
	isLoading: boolean;
	position: number;
	duration: number;

	playTrack: (track: BhajanAudio, title: string, parentBhajan?: Bhajan, contextQueue?: BhajanAudio[], queueTitle?: string) => void;
	togglePlay: () => void;
	seek: (seconds: number) => void;
	playNext: () => void;
	playPrevious: () => void;
	playQueueTrack: (index: number) => void;
	toggleRepeat: () => void;
	addToQueue: (track: BhajanAudio, title: string, parentBhajan?: Bhajan) => void;
	removeFromQueue: (trackId: string) => void;
	closePlayer: () => void;
}

const LOAD_TIMEOUT_MS = 20_000;

// The native player is parked on globalThis so a Fast Refresh of this module
// in development re-attaches to it instead of creating a second player that
// plays over the first (a refreshed module would otherwise lose the handle).
const globalAudio = globalThis as {
	__cpbsPlayer?: AudioPlayer;
	__cpbsPlayerSub?: { remove: () => void };
};
let player: AudioPlayer | null = globalAudio.__cpbsPlayer ?? null;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
if (player) {
	globalAudio.__cpbsPlayerSub?.remove();
	globalAudio.__cpbsPlayerSub = player.addListener("playbackStatusUpdate", onStatus);
	player.pause();
}

function enhance(track: BhajanAudio, title: string, parentBhajan?: Bhajan): QueueTrack {
	return {
		...track,
		bhajanTitle: track.bhajanTitle || title || parentBhajan?.title || "",
		parentBhajan: track.parentBhajan || parentBhajan,
	};
}

function getPlayer(): AudioPlayer {
	if (player) return player;

	// doNotMix is required for lock-screen controls; shouldPlayInBackground +
	// the lock-screen session is what keeps Android from stopping playback a
	// few minutes after the screen turns off.
	setAudioModeAsync({
		playsInSilentMode: true,
		shouldPlayInBackground: true,
		interruptionMode: "doNotMix",
	}).catch(() => {});

	player = createAudioPlayer(null, { updateInterval: 500 });
	globalAudio.__cpbsPlayer = player;
	globalAudio.__cpbsPlayerSub = player.addListener("playbackStatusUpdate", onStatus);
	return player;
}

function onStatus(status: AudioStatus) {
	const state = useAudioStore.getState();
	if (!state.currentTrack) return;

	if (status.isLoaded && loadTimer) {
		clearTimeout(loadTimer);
		loadTimer = undefined;
	}

	useAudioStore.setState({
		isPlaying: status.playing,
		isLoading: !status.isLoaded || (status.isBuffering && !status.playing),
		position: status.currentTime ?? 0,
		duration: status.duration || state.currentTrack.duration || 0,
	});

	if (status.didJustFinish) onEnded();
}

function onEnded() {
	const { repeatMode, queue, playNext } = useAudioStore.getState();
	if (repeatMode === "one") {
		player?.seekTo(0).then(() => player?.play());
		return;
	}
	if (repeatMode === "all") {
		playNext();
		return;
	}
	const index = currentIndex();
	if (index !== -1 && index < queue.length - 1) playNext();
	else useAudioStore.setState({ isPlaying: false });
}

// Falls back to the parent bhajan when the playing track isn't itself in the
// queue — e.g. the Song List queue holds each bhajan's first singer, but the
// user picked another singer in the reader (same fallback as AudioContext).
function currentIndex() {
	const { queue, currentTrack } = useAudioStore.getState();
	const exact = queue.findIndex((t) => t.id === currentTrack?.id);
	if (exact !== -1 || !currentTrack?.parentBhajan) return exact;
	return queue.findIndex((t) => t.parentBhajan?.id === currentTrack.parentBhajan?.id);
}

export const useAudioStore = create<AudioState>((set, get) => ({
	currentTrack: null,
	queue: [],
	queueTitle: "",
	repeatMode: "off",
	isPlaying: false,
	isLoading: false,
	position: 0,
	duration: 0,

	playTrack: (track, title, parentBhajan, contextQueue, queueTitle) => {
		const enhanced = enhance(track, title, parentBhajan);
		const p = getPlayer();
		const isSameTrack = get().currentTrack?.id === enhanced.id;

		set({
			currentTrack: enhanced,
			...(contextQueue
				? {
						queue: contextQueue.map((t) => enhance(t, title, parentBhajan)),
						queueTitle: queueTitle ?? title,
					}
				: get().queue.length === 0
					? { queue: [enhanced], queueTitle: queueTitle ?? title }
					: {}),
		});

		if (isSameTrack) {
			p.play();
			return;
		}

		set({ isLoading: true, isPlaying: false, position: 0, duration: enhanced.duration ?? 0 });
		// Downloaded tracks play from disk; streams go through the media CDN
		// exactly as the Capacitor app's getPlayableUrl routed them.
		p.replace({ uri: getDownloadedUri(enhanced.id) ?? getPlayableUrl(enhanced.url) });
		p.play();

		const metadata = {
			title: enhanced.bhajanTitle,
			artist: enhanced.singer,
			albumTitle: "Prem Bhakti",
		};
		// Also refreshes the metadata once the media service is bound; a separate
		// updateLockScreenMetadata() call here only warns while it is binding.
		p.setActiveForLockScreen(true, metadata, { showSeekForward: true, showSeekBackward: true });

		if (loadTimer) clearTimeout(loadTimer);
		loadTimer = setTimeout(() => {
			if (get().currentTrack?.id === enhanced.id && get().isLoading) {
				set({ isLoading: false, isPlaying: false });
				p.pause();
				showToast("Could not load audio. Please check your internet connection.", "error");
			}
		}, LOAD_TIMEOUT_MS);
	},

	togglePlay: () => {
		if (!player || !get().currentTrack) return;
		if (get().isPlaying) player.pause();
		else player.play();
	},

	seek: (seconds) => {
		player?.seekTo(Math.max(0, seconds));
		set({ position: seconds });
	},

	playNext: () => {
		const { queue } = get();
		if (queue.length <= 1) return;
		const index = currentIndex();
		if (index === -1) return;
		get().playQueueTrack((index + 1) % queue.length);
	},

	playPrevious: () => {
		const { queue } = get();
		// Like most players: >3s in, "previous" restarts the current track.
		if (get().position > 3 || queue.length <= 1) {
			get().seek(0);
			return;
		}
		const index = currentIndex();
		if (index === -1) return;
		get().playQueueTrack(index === 0 ? queue.length - 1 : index - 1);
	},

	playQueueTrack: (index) => {
		const track = get().queue[index];
		if (!track) return;
		get().playTrack(track, track.bhajanTitle, track.parentBhajan);
	},

	toggleRepeat: () =>
		set(({ repeatMode }) => ({
			repeatMode: repeatMode === "off" ? "one" : repeatMode === "one" ? "all" : "off",
		})),

	addToQueue: (track, title, parentBhajan) => {
		if (get().queue.some((t) => t.id === track.id)) return;
		set(({ queue }) => ({ queue: [...queue, enhance(track, title, parentBhajan)] }));
	},

	removeFromQueue: (trackId) => {
		if (get().currentTrack?.id === trackId) return;
		set(({ queue }) => ({ queue: queue.filter((t) => t.id !== trackId) }));
	},

	closePlayer: () => {
		if (loadTimer) clearTimeout(loadTimer);
		if (player) {
			player.pause();
			player.clearLockScreenControls();
		}
		set({
			currentTrack: null,
			queue: [],
			queueTitle: "",
			isPlaying: false,
			isLoading: false,
			position: 0,
			duration: 0,
		});
	},
}));

// m:ss, or h:mm:ss for multi-hour katha recordings.
export function formatTime(seconds: number) {
	if (!seconds || Number.isNaN(seconds)) return "0:00";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60).toString().padStart(2, "0");
	return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}

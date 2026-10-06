import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { RepeatMode } from "../types";

// ---------------------------------------------------------------------------
// Audio Store — High-frequency playback state
// ---------------------------------------------------------------------------
// The AudioContext.tsx React Context updates `isPlaying`, `progress`, and
// `duration` very frequently (every second during playback). Previously, any
// component that called `useAudio()` re-rendered on every tick — even if it
// only cared about the track title.
//
// This store holds ONLY the values that change at high frequency.
// Components subscribe granularly:
//
//   // Re-renders only when isPlaying changes, NOT on every progress tick:
//   const isPlaying = useAudioStore((s) => s.isPlaying);
//
//   // Re-renders on every second (only use in AudioPlayer progress bar):
//   const progress = useAudioStore((s) => s.progress);
//
// AudioContext writes to this store via `useAudioStore.setState(...)` inside
// the audio element''s event handlers. The context still owns the audio element
// ref, the queue, and all the complex logic (iOS unlock, MediaSession, OEM
// resume recovery). This store is a lightweight read-layer on top.
//
// subscribeWithSelector middleware is included so non-React code (e.g. future
// keep-awake manager, analytics) can subscribe to specific slices without
// triggering React renders.
// ---------------------------------------------------------------------------

interface AudioPlaybackState {
	isPlaying: boolean;
	isLoading: boolean;
	progress: number; // 0–100
	duration: number; // seconds
	repeatMode: RepeatMode;

	setIsPlaying: (val: boolean) => void;
	setIsLoading: (val: boolean) => void;
	setProgress: (val: number) => void;
	setDuration: (val: number) => void;
	setRepeatMode: (mode: RepeatMode) => void;
	/** Reset all playback state (called by closePlayer) */
	resetPlayback: () => void;
}

export const useAudioStore = create<AudioPlaybackState>()(
	subscribeWithSelector((set) => ({
		isPlaying: false,
		isLoading: false,
		progress: 0,
		duration: 0,
		repeatMode: "one",

		setIsPlaying: (val) => set({ isPlaying: val }),
		setIsLoading: (val) => set({ isLoading: val }),
		setProgress: (val) => set({ progress: val }),
		setDuration: (val) => set({ duration: val }),
		setRepeatMode: (mode) => set({ repeatMode: mode }),
		resetPlayback: () =>
			set({ isPlaying: false, isLoading: false, progress: 0, duration: 0 }),
	})),
);

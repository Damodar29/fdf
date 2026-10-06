import { create } from "zustand";
import type { Bhajan, BhajanAudio, Book } from "../types";

// ---------------------------------------------------------------------------
// Reader Store
// ---------------------------------------------------------------------------
// Holds the currently-open Bhajan, Book, and their audio queue context.
// Extracted from MainApp''s useState so that audio-progress ticks and search
// input changes cannot cause the reader state setters to re-render.
// ---------------------------------------------------------------------------

interface ReaderState {
	selectedBhajan: Bhajan | null;
	selectedBook: Book | null;
	selectedContextQueue: BhajanAudio[] | undefined;
	selectedQueueName: string | undefined;
	isNewBhajan: boolean;

	setSelectedBhajan: (bhajan: Bhajan | null) => void;
	setSelectedBook: (book: Book | null) => void;
	setSelectedContextQueue: (queue: BhajanAudio[] | undefined) => void;
	setSelectedQueueName: (name: string | undefined) => void;
	setIsNewBhajan: (val: boolean) => void;
	/** Open a bhajan reader — atomically sets bhajan + queue + queueName */
	openBhajan: (
		bhajan: Bhajan,
		contextQueue?: BhajanAudio[],
		queueName?: string,
	) => void;
	/** Close reader — clears all reader state */
	closeReader: () => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
	selectedBhajan: null,
	selectedBook: null,
	selectedContextQueue: undefined,
	selectedQueueName: undefined,
	isNewBhajan: false,

	setSelectedBhajan: (bhajan) => set({ selectedBhajan: bhajan }),
	setSelectedBook: (book) => set({ selectedBook: book }),
	setSelectedContextQueue: (queue) => set({ selectedContextQueue: queue }),
	setSelectedQueueName: (name) => set({ selectedQueueName: name }),
	setIsNewBhajan: (val) => set({ isNewBhajan: val }),

	openBhajan: (bhajan, contextQueue, queueName) =>
		set({
			selectedBhajan: bhajan,
			selectedContextQueue: contextQueue,
			selectedQueueName: queueName,
			isNewBhajan: false,
		}),

	closeReader: () =>
		set({
			selectedBhajan: null,
			selectedContextQueue: undefined,
			selectedQueueName: undefined,
			isNewBhajan: false,
		}),
}));

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { storage } from "../lib/storage";
import type { HistoryEntry } from "../types";
import { showToast } from "./toastStore";

// Recently opened bhajans, lectures and books — the historyItems /
// addToHistory / clearHistory part of context/DataContext.tsx. Same rules:
// re-opening an item moves it to the top, and only the latest 100 are kept.
const MAX_HISTORY = 100;

interface HistoryState {
	items: HistoryEntry[];
	addToHistory: (id: string, type: HistoryEntry["type"]) => void;
	clearHistory: () => void;
}

const mmkvStorage: StateStorage = {
	getItem: (name) => storage.getString(name) ?? null,
	setItem: (name, value) => storage.set(name, value),
	removeItem: (name) => {
		storage.remove(name);
	},
};

export const useHistoryStore = create<HistoryState>()(
	persist(
		(set) => ({
			items: [],
			addToHistory: (id, type) =>
				set(({ items }) => ({
					items: [
						{ id, type, timestamp: Date.now() },
						...items.filter((item) => !(item.id === id && item.type === type)),
					].slice(0, MAX_HISTORY),
				})),
			clearHistory: () => {
				set({ items: [] });
				showToast("History cleared", "success");
			},
		}),
		{
			name: "cpbs_history",
			storage: createJSONStorage(() => mmkvStorage),
			partialize: ({ items }) => ({ items }),
		},
	),
);

export const addToHistory = (id: string, type: HistoryEntry["type"]) =>
	useHistoryStore.getState().addToHistory(id, type);

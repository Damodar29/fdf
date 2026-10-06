import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { storage } from "../lib/storage";
import { showToast } from "./toastStore";

// One bookmarked page per book — the bookmarks / setBookmark / removeBookmark
// part of context/DataContext.tsx. The book reader reopens a book at its
// bookmark. Same key as the Capacitor app (cpbs_bookmarks).
interface BookmarkState {
	bookmarks: Record<string, number>;
	setBookmark: (bookId: string, page: number) => void;
	removeBookmark: (bookId: string) => void;
}

const mmkvStorage: StateStorage = {
	getItem: (name) => storage.getString(name) ?? null,
	setItem: (name, value) => storage.set(name, value),
	removeItem: (name) => {
		storage.remove(name);
	},
};

export const useBookmarkStore = create<BookmarkState>()(
	persist(
		(set) => ({
			bookmarks: {},
			setBookmark: (bookId, page) => {
				set(({ bookmarks }) => ({ bookmarks: { ...bookmarks, [bookId]: page } }));
				showToast(`Bookmark saved at page ${page}`, "success");
			},
			removeBookmark: (bookId) => {
				set(({ bookmarks }) => {
					const { [bookId]: _, ...rest } = bookmarks;
					return { bookmarks: rest };
				});
				showToast("Bookmark removed", "info");
			},
		}),
		{
			name: "cpbs_bookmarks",
			storage: createJSONStorage(() => mmkvStorage),
			partialize: ({ bookmarks }) => ({ bookmarks }),
		},
	),
);

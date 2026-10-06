import { useEffect } from "react";
import { create } from "zustand";
import { BOOKS_DATA } from "../data/books";
import { LECTURES_DATA } from "../data/lectures";
import { getCachedBhajans, refreshBhajans } from "../lib/bhajanApi";
import {
	BOOKS_SOURCE,
	getCachedList,
	LECTURES_SOURCE,
	syncBooks,
	syncLectures,
} from "../lib/contentApi";
import { remove } from "../lib/storage";
import type { Bhajan, Book, LectureData } from "../types";
import { showToast } from "./toastStore";

// Single source of truth for downloaded content (the data half of
// context/DataContext.tsx). Each list starts from its MMKV cache — or the
// hardcoded base list for books/lectures — so screens render instantly and
// offline; sync() then checks the remote index at most once per app session
// unless forced (pull-to-refresh / retry).
export type ContentKind = "bhajans" | "books" | "lectures";

interface SyncState {
	isSyncing: boolean;
	error: string | null;
	syncedThisSession: boolean;
}

interface ContentState {
	bhajans: Bhajan[];
	books: Book[];
	lectures: LectureData[];
	status: Record<ContentKind, SyncState>;
	sync: (kind: ContentKind, force?: boolean) => Promise<void>;
}

const idle: SyncState = { isSyncing: false, error: null, syncedThisSession: false };

function initialList<T>(cacheKey: string, base: T[]): T[] {
	const cached = getCachedList<T>(cacheKey);
	return cached.length > 0 ? cached : base;
}

export const useContentStore = create<ContentState>((set, get) => ({
	bhajans: getCachedBhajans(),
	books: initialList(BOOKS_SOURCE.cacheKey, BOOKS_DATA),
	lectures: initialList(LECTURES_SOURCE.cacheKey, LECTURES_DATA),
	status: { bhajans: idle, books: idle, lectures: idle },

	sync: async (kind, force = false) => {
		const current = get().status[kind];
		if (current.isSyncing || (current.syncedThisSession && !force)) return;

		const setStatus = (patch: Partial<SyncState>) =>
			set((s) => ({ status: { ...s.status, [kind]: { ...s.status[kind], ...patch } } }));

		setStatus({ isSyncing: true, error: null });
		try {
			if (kind === "bhajans") {
				const { bhajans } = await refreshBhajans(force);
				set({ bhajans });
			} else if (kind === "books") {
				set({ books: await syncBooks(BOOKS_DATA, force) });
			} else {
				set({ lectures: await syncLectures(LECTURES_DATA, force) });
			}
			setStatus({ isSyncing: false, syncedThisSession: true });
			if (force) showToast("Synced successfully", "success");
		} catch (e) {
			const message = e instanceof Error ? e.message : "Sync failed";
			setStatus({ isSyncing: false, error: message });
			if (force) showToast("Please connect to internet to get latest updated data", "error");
		}
	},
}));

/** Subscribe to one content list and kick off its (once-per-session) sync. */
function useContent<K extends ContentKind>(kind: K) {
	const items = useContentStore((s) => s[kind]) as ContentState[K];
	const status = useContentStore((s) => s.status[kind]);
	const sync = useContentStore((s) => s.sync);

	useEffect(() => {
		sync(kind);
	}, [kind, sync]);

	return {
		items,
		isSyncing: status.isSyncing,
		error: status.error,
		refresh: () => sync(kind, true),
	};
}

export const useBooks = () => useContent("books");
export const useLectures = () => useContent("lectures");
export const useBhajansContent = () => useContent("bhajans");

// Settings → Clear App Cache → "Content Sync Cache" (the Capacitor app's
// CONTENT_KEYS). The lists on screen stay until the fresh copies arrive; the
// Capacitor app reloaded instead, which re-fetched the same way.
const CONTENT_CACHE_KEYS = [
	"cpbs_all_bhajans",
	"cpbs_bhajans_bundle_time",
	BOOKS_SOURCE.cacheKey,
	BOOKS_SOURCE.bundleTimeKey,
	LECTURES_SOURCE.cacheKey,
	LECTURES_SOURCE.bundleTimeKey,
];

export function clearContentCache() {
	for (const key of CONTENT_CACHE_KEYS) remove(key);
	useContentStore.setState({ status: { bhajans: idle, books: idle, lectures: idle } });
	const { sync } = useContentStore.getState();
	for (const kind of ["bhajans", "books", "lectures"] as const) sync(kind);
}

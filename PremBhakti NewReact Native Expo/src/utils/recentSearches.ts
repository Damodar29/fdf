import { getObject, setObject, remove } from "../lib/storage";

// Ported from utils/recentSearches.ts in the Capacitor app; localStorage
// swapped for MMKV. Key kept identical so the shape stays recognisable.
const RECENT_SEARCHES_KEY = "recent_bhajan_searches";
const MAX_RECENT = 10;

export const getRecentSearches = (): string[] =>
	getObject<string[]>(RECENT_SEARCHES_KEY) ?? [];

export const addRecentSearch = (query: string): void => {
	const trimmed = query.trim();
	if (!trimmed) return;
	const lowered = trimmed.toLowerCase();
	const searches = getRecentSearches().filter(
		(s) => s.toLowerCase() !== lowered,
	);
	searches.unshift(trimmed);
	setObject(RECENT_SEARCHES_KEY, searches.slice(0, MAX_RECENT));
};

export const clearRecentSearches = (): void => {
	remove(RECENT_SEARCHES_KEY);
};

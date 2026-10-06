import { safeLocalSet } from "./safeLocalSet";

const RECENT_SEARCHES_KEY = "recent_bhajan_searches";

export const getRecentSearches = (): string[] => {
	try {
		const data = localStorage.getItem(RECENT_SEARCHES_KEY);
		return data ? JSON.parse(data) : [];
	} catch {
		return [];
	}
};

export const addRecentSearch = (query: string) => {
	if (!query.trim()) return;
	const q = query.trim().toLowerCase();
	let searches = getRecentSearches();
	searches = searches.filter((s) => s.toLowerCase() !== q);
	searches.unshift(query.trim());
	if (searches.length > 10) searches = searches.slice(0, 10);
	safeLocalSet(RECENT_SEARCHES_KEY, JSON.stringify(searches));
};

export const clearRecentSearches = () => {
	localStorage.removeItem(RECENT_SEARCHES_KEY);
};

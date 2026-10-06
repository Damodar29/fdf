import { create } from "zustand";

// ---------------------------------------------------------------------------
// Search Store
// ---------------------------------------------------------------------------
// Moves search state out of MainApp''s useState. The debounced query updates
// happen every ~250ms while the user types. With React Context or root-level
// useState those updates re-render every consumer. Zustand subscribers
// re-render only if the slice they read changed.
// ---------------------------------------------------------------------------

interface SearchState {
	searchQuery: string;
	debouncedQuery: string;
	isSearchFocused: boolean;
	showLandscapeSearch: boolean;

	setSearchQuery: (query: string) => void;
	setDebouncedQuery: (query: string) => void;
	setIsSearchFocused: (val: boolean) => void;
	setShowLandscapeSearch: (val: boolean) => void;
	clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
	searchQuery: "",
	debouncedQuery: "",
	isSearchFocused: false,
	showLandscapeSearch: false,

	setSearchQuery: (query) => set({ searchQuery: query }),
	setDebouncedQuery: (query) => set({ debouncedQuery: query }),
	setIsSearchFocused: (val) => set({ isSearchFocused: val }),
	setShowLandscapeSearch: (val) => set({ showLandscapeSearch: val }),
	clearSearch: () =>
		set({
			searchQuery: "",
			debouncedQuery: "",
			isSearchFocused: false,
		}),
}));

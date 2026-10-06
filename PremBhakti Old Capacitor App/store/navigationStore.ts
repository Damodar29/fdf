import { create } from "zustand";
import type { AppTab } from "../types";

// ---------------------------------------------------------------------------
// Navigation Store
// ---------------------------------------------------------------------------
// Moves activeTab / tabHistory / animDirection out of MainApp''s useState so
// that typing in the search bar (or any other unrelated state update) does NOT
// cause the tab-switching logic or the whole MainApp to re-render.
// ---------------------------------------------------------------------------

interface NavigationState {
	activeTab: AppTab;
	tabHistory: AppTab[];
	animDirection: "left" | "right" | "none";

	setActiveTab: (tab: AppTab) => void;
	setTabHistory: (history: AppTab[]) => void;
	setAnimDirection: (dir: "left" | "right" | "none") => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
	activeTab: "home",
	tabHistory: ["home"],
	animDirection: "none",

	setActiveTab: (tab) => set({ activeTab: tab }),
	setTabHistory: (history) => set({ tabHistory: history }),
	setAnimDirection: (dir) => set({ animDirection: dir }),
}));

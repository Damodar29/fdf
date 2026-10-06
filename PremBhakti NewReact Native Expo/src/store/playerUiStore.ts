import { create } from "zustand";

/** Whether the Audio tab's docked player is minimised to the mini player. */
export const usePlayerUiStore = create<{ minimized: boolean; setMinimized: (minimized: boolean) => void }>((set) => ({
	minimized: false,
	setMinimized: (minimized) => set({ minimized }),
}));

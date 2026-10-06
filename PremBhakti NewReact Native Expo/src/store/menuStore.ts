import { create } from "zustand";

/** Whether the side menu (components/SideMenu.tsx) is open. */
export const useMenuStore = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
	open: false,
	setOpen: (open) => set({ open }),
}));

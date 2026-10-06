import { create } from "zustand";

// Port of context/ToastContext.tsx: one toast at a time, auto-dismissed.
// A plain function (showToast) is exported alongside the hook so non-React
// code such as the audio service can raise toasts too.
export type ToastType = "success" | "error" | "info";

interface ToastState {
	message: string | null;
	type: ToastType;
	id: number;
	show: (message: string, type?: ToastType) => void;
	hide: () => void;
}

const DURATION_MS = 3000;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set, get) => ({
	message: null,
	type: "info",
	id: 0,
	show: (message, type = "info") => {
		if (timer) clearTimeout(timer);
		const id = get().id + 1;
		set({ message, type, id });
		timer = setTimeout(() => {
			if (get().id === id) set({ message: null });
		}, DURATION_MS);
	},
	hide: () => set({ message: null }),
}));

export const showToast = (message: string, type?: ToastType) =>
	useToastStore.getState().show(message, type);

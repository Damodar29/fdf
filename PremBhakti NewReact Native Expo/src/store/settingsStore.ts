import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { storage } from "../lib/storage";
import { DEFAULT_THEME_COLOR } from "../theme/palettes";
import type { FontSize, ScriptType, ThemeColor, ThemeMode } from "../types";

// Device-local preferences from context/SettingsContext.tsx in the Capacitor
// app. There, each setting was its own localStorage key with its own
// useEffect writer; here they're one persisted Zustand store so any screen can
// subscribe to just the slice it needs without a Provider re-rendering the tree.
//
// The Firestore-backed parts of SettingsContext (information screen, social
// media live status, banners) are remote content, not preferences, and are
// ported separately alongside the screens that show them.
export type SettingsLanguage = "en" | "hi";

interface SettingsState {
	themeMode: ThemeMode;
	themeColor: ThemeColor;
	fontSize: FontSize;
	script: ScriptType;
	keepAwake: boolean;
	hapticsEnabled: boolean;
	settingsLanguage: SettingsLanguage;
	/** Bhajan list A–Z index letters: Hindi (अ…) or English (A…). */
	indexMode: "latin" | "devanagari";
	azSliderSide: "left" | "right";
	/** "App UI Size" (cpbs_ui_scale), 0.85–1.15. */
	uiScale: number;
	/** Scrollbar side for left/right-handed use (cpbs_scrollbar_side). */
	scrollBarSide: "left" | "right";
	/** Bhajan reader layout (BhajanReader.tsx: cpbs_line_gap / cpbs_view_format / cpbs_reader_bookmode). */
	lineGap: number;
	viewFormat: ViewFormat;
	bookMode: boolean;
	setThemeMode: (mode: ThemeMode) => void;
	setThemeColor: (color: ThemeColor) => void;
	setFontSize: (size: FontSize) => void;
	setScript: (script: ScriptType) => void;
	setKeepAwake: (keep: boolean) => void;
	setHapticsEnabled: (enabled: boolean) => void;
	setSettingsLanguage: (lang: SettingsLanguage) => void;
	setIndexMode: (mode: "latin" | "devanagari") => void;
	setAzSliderSide: (side: "left" | "right") => void;
	setUiScale: (scale: number) => void;
	setScrollBarSide: (side: "left" | "right") => void;
	/** "Clear App Cache → App Preferences": back to the defaults below. */
	resetPreferences: () => void;
	setLineGap: (gap: number) => void;
	setViewFormat: (format: ViewFormat) => void;
	setBookMode: (on: boolean) => void;
}

export type ViewFormat = "center" | "left" | "justify" | "wide-center" | "wide-left";

// The reader's size slider (and pinch) ranges 12–60px, as in BhajanReader.tsx.
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 60;

const mmkvStorage: StateStorage = {
	getItem: (name) => storage.getString(name) ?? null,
	setItem: (name, value) => storage.set(name, value),
	removeItem: (name) => {
		storage.remove(name);
	},
};

// Defaults match SettingsContext's initializers. These are the keys the
// Capacitor app's "App Preferences Cache" option wiped (PREFS_KEYS); the
// reader layout below them is kept.
const DEFAULT_PREFERENCES = {
	themeMode: "auto" as ThemeMode,
	themeColor: DEFAULT_THEME_COLOR,
	fontSize: 20 as FontSize,
	script: "devanagari" as ScriptType,
	keepAwake: true,
	hapticsEnabled: true,
	settingsLanguage: "en" as SettingsLanguage,
	indexMode: "devanagari" as "latin" | "devanagari",
	azSliderSide: "left" as "left" | "right",
	uiScale: 1,
	scrollBarSide: "left" as "left" | "right",
};

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			...DEFAULT_PREFERENCES,
			lineGap: 0,
			viewFormat: "center",
			bookMode: false,
			setThemeMode: (themeMode) => set({ themeMode }),
			setThemeColor: (themeColor) => set({ themeColor }),
			setFontSize: (fontSize) =>
				set({ fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize)) }),
			setScript: (script) => set({ script }),
			setKeepAwake: (keepAwake) => set({ keepAwake }),
			setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
			setSettingsLanguage: (settingsLanguage) => set({ settingsLanguage }),
			setIndexMode: (indexMode) => set({ indexMode }),
			setAzSliderSide: (azSliderSide) => set({ azSliderSide }),
			setUiScale: (uiScale) => set({ uiScale: Math.min(1.15, Math.max(0.85, Math.round(uiScale * 100) / 100)) }),
			setScrollBarSide: (scrollBarSide) => set({ scrollBarSide }),
			resetPreferences: () => set(DEFAULT_PREFERENCES),
			setLineGap: (lineGap) => set({ lineGap: Math.min(16, Math.max(0, lineGap)) }),
			setViewFormat: (viewFormat) => set({ viewFormat }),
			setBookMode: (bookMode) => set({ bookMode }),
		}),
		{
			name: "cpbs_settings",
			storage: createJSONStorage(() => mmkvStorage),
		},
	),
);

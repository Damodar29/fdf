import { Capacitor } from "@capacitor/core";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// App-level Store
// ---------------------------------------------------------------------------
// Force update, OTA update, splash, and onboarding state — all things that
// block the main UI. Previously useState in MainApp.
// ---------------------------------------------------------------------------

// Compute initial onboarding state ONCE at module load time — same logic that
// was previously in the useState(() => ...) initializer in MainApp.
// This runs synchronously before any React render, so no flash.
function getInitialShowOnboarding(): boolean {
	try {
		if (!Capacitor.isNativePlatform()) {
			const isMobileWeb = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
			if (!isMobileWeb) return false;
		}
		return !localStorage.getItem("cpbs_intro_completed");
	} catch {
		return false;
	}
}

interface ForceUpdateConfig {
	minNativeVersion: string;
	updateTitle: string;
	updateMessage: string;
	playStoreUrl: string;
}

interface AppState {
	// Splash
	isSplashAnimatingOut: boolean;
	isSplashRemoved: boolean;
	mainAppMounted: boolean;
	minTimeElapsed: boolean;

	// Onboarding
	showOnboarding: boolean;

	// Force update (native store update)
	forceUpdateConfig: ForceUpdateConfig | null;

	// OTA update
	forceOtaUpdate: boolean;
	forceOtaProgress: number;

	// Updater screen (manual OTA UI)
	isUpdaterOpen: boolean;

	setIsSplashAnimatingOut: (val: boolean) => void;
	setIsSplashRemoved: (val: boolean) => void;
	setMainAppMounted: (val: boolean) => void;
	setMinTimeElapsed: (val: boolean) => void;
	setShowOnboarding: (val: boolean) => void;
	setForceUpdateConfig: (config: ForceUpdateConfig | null) => void;
	setForceOtaUpdate: (val: boolean) => void;
	setForceOtaProgress: (progress: number) => void;
	setIsUpdaterOpen: (val: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
	isSplashAnimatingOut: false,
	isSplashRemoved: false,
	mainAppMounted: false,
	minTimeElapsed: false,
	showOnboarding: getInitialShowOnboarding(),
	forceUpdateConfig: null,
	forceOtaUpdate: false,
	forceOtaProgress: 0,
	isUpdaterOpen: false,

	setIsSplashAnimatingOut: (val) => set({ isSplashAnimatingOut: val }),
	setIsSplashRemoved: (val) => set({ isSplashRemoved: val }),
	setMainAppMounted: (val) => set({ mainAppMounted: val }),
	setMinTimeElapsed: (val) => set({ minTimeElapsed: val }),
	setShowOnboarding: (val) => set({ showOnboarding: val }),
	setForceUpdateConfig: (config) => set({ forceUpdateConfig: config }),
	setForceOtaUpdate: (val) => set({ forceOtaUpdate: val }),
	setForceOtaProgress: (progress) => set({ forceOtaProgress: progress }),
	setIsUpdaterOpen: (val) => set({ isUpdaterOpen: val }),
}));

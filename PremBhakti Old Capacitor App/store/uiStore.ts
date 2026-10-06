import { create } from "zustand";

// --- Types -------------------------------------------------------------------

interface NotifMandalTarget {
	mandalId: string;
	date: string;
}

// --- Store --------------------------------------------------------------------

interface UIState {
	// Modals
	isSideMenuOpen: boolean;
	isSettingsOpen: boolean;
	isAboutOpen: boolean;
	isDonateOpen: boolean;
	isDailyQuotesOpen: boolean;
	isDailyInfoOpen: boolean;
	isEventsOpen: boolean;
	isDailyDarshanOpen: boolean;
	isSevaCenterOpen: boolean;
	isTempleTimingsOpen: boolean;
	selectedTempleId: string | undefined;
	isActivitiesOpen: boolean;
	isYouTubeOpen: boolean;
	isFacebookOpen: boolean;
	isInstagramOpen: boolean;
	isPrivacyOpen: boolean;
	isTermsOpen: boolean;
	isInformationOpen: boolean;
	isVideosOpen: boolean;
	isGuruMaharajOpen: boolean;
	isVirahiMaharajOpen: boolean;
	isProfileOpen: boolean;
	isActivitiesPhotosOpen: boolean;
	showQuotePopup: string | false;
	notifMandalTarget: NotifMandalTarget | null;
	notifInfoItemId: string | null;
	isForcedUpdateInProgress: boolean;
	notificationPermissionDenied: boolean;

	// Setters
	setIsSideMenuOpen: (v: boolean) => void;
	setIsSettingsOpen: (v: boolean) => void;
	setIsAboutOpen: (v: boolean) => void;
	setIsDonateOpen: (v: boolean) => void;
	setIsDailyQuotesOpen: (v: boolean) => void;
	setIsDailyInfoOpen: (v: boolean) => void;
	setIsEventsOpen: (v: boolean) => void;
	setIsDailyDarshanOpen: (v: boolean) => void;
	setIsSevaCenterOpen: (v: boolean) => void;
	setIsTempleTimingsOpen: (v: boolean) => void;
	setSelectedTempleId: (v: string | undefined) => void;
	setIsActivitiesOpen: (v: boolean) => void;
	setIsYouTubeOpen: (v: boolean) => void;
	setIsFacebookOpen: (v: boolean) => void;
	setIsInstagramOpen: (v: boolean) => void;
	setIsPrivacyOpen: (v: boolean) => void;
	setIsTermsOpen: (v: boolean) => void;
	setIsInformationOpen: (v: boolean) => void;
	setIsVideosOpen: (v: boolean) => void;
	setIsGuruMaharajOpen: (v: boolean) => void;
	setIsVirahiMaharajOpen: (v: boolean) => void;
	setIsProfileOpen: (v: boolean) => void;
	setIsActivitiesPhotosOpen: (v: boolean) => void;
	setShowQuotePopup: (v: string | false) => void;
	setNotifMandalTarget: (v: NotifMandalTarget | null) => void;
	setNotifInfoItemId: (v: string | null) => void;
	setIsForcedUpdateInProgress: (v: boolean) => void;
	setNotificationPermissionDenied: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
	// Initial values
	isSideMenuOpen: false,
	isSettingsOpen: false,
	isAboutOpen: false,
	isDonateOpen: false,
	isDailyQuotesOpen: false,
	isDailyInfoOpen: false,
	isEventsOpen: false,
	isDailyDarshanOpen: false,
	isSevaCenterOpen: false,
	isTempleTimingsOpen: false,
	selectedTempleId: undefined,
	isActivitiesOpen: false,
	isYouTubeOpen: false,
	isFacebookOpen: false,
	isInstagramOpen: false,
	isPrivacyOpen: false,
	isTermsOpen: false,
	isInformationOpen: false,
	isVideosOpen: false,
	isGuruMaharajOpen: false,
	isVirahiMaharajOpen: false,
	isProfileOpen: false,
	isActivitiesPhotosOpen: false,
	showQuotePopup: false,
	notifMandalTarget: null,
	notifInfoItemId: null,
	isForcedUpdateInProgress: false,
	notificationPermissionDenied: false,

	// Setters
	setIsSideMenuOpen: (v) => set({ isSideMenuOpen: v }),
	setIsSettingsOpen: (v) => set({ isSettingsOpen: v }),
	setIsAboutOpen: (v) => set({ isAboutOpen: v }),
	setIsDonateOpen: (v) => set({ isDonateOpen: v }),
	setIsDailyQuotesOpen: (v) => set({ isDailyQuotesOpen: v }),
	setIsDailyInfoOpen: (v) => set({ isDailyInfoOpen: v }),
	setIsEventsOpen: (v) => set({ isEventsOpen: v }),
	setIsDailyDarshanOpen: (v) => set({ isDailyDarshanOpen: v }),
	setIsSevaCenterOpen: (v) => set({ isSevaCenterOpen: v }),
	setIsTempleTimingsOpen: (v) => set({ isTempleTimingsOpen: v }),
	setSelectedTempleId: (v) => set({ selectedTempleId: v }),
	setIsActivitiesOpen: (v) => set({ isActivitiesOpen: v }),
	setIsYouTubeOpen: (v) => set({ isYouTubeOpen: v }),
	setIsFacebookOpen: (v) => set({ isFacebookOpen: v }),
	setIsInstagramOpen: (v) => set({ isInstagramOpen: v }),
	setIsPrivacyOpen: (v) => set({ isPrivacyOpen: v }),
	setIsTermsOpen: (v) => set({ isTermsOpen: v }),
	setIsInformationOpen: (v) => set({ isInformationOpen: v }),
	setIsVideosOpen: (v) => set({ isVideosOpen: v }),
	setIsGuruMaharajOpen: (v) => set({ isGuruMaharajOpen: v }),
	setIsVirahiMaharajOpen: (v) => set({ isVirahiMaharajOpen: v }),
	setIsProfileOpen: (v) => set({ isProfileOpen: v }),
	setIsActivitiesPhotosOpen: (v) => set({ isActivitiesPhotosOpen: v }),
	setShowQuotePopup: (v) => set({ showQuotePopup: v }),
	setNotifMandalTarget: (v) => set({ notifMandalTarget: v }),
	setNotifInfoItemId: (v) => set({ notifInfoItemId: v }),
	setIsForcedUpdateInProgress: (v) => set({ isForcedUpdateInProgress: v }),
	setNotificationPermissionDenied: (v) =>
		set({ notificationPermissionDenied: v }),
}));

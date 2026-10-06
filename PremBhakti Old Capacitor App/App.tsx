import { Loader2, Search, X } from "lucide-react";
import React, {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { BhajanList } from "./components/BhajanList";
import { useAppStore } from "./store/appStore";
import { useNavigationStore } from "./store/navigationStore";
import { useReaderStore } from "./store/readerStore";
import { useSearchStore } from "./store/searchStore";
import { useUIStore } from "./store/uiStore";
import type { AppTab, Bhajan, BhajanAudio, Book, LectureData } from "./types";
import { addRecentSearch, getRecentSearches } from "./utils/recentSearches";
import {
	calculateBookScore,
	calculateLectureScore,
	calculateSearchScore,
} from "./utils/textProcessor";

// Lazy load heavy components
const BhajanReader = React.lazy(() =>
	import("./components/BhajanReader").then((module) => ({
		default: module.BhajanReader,
	})),
);
const BookReader = React.lazy(() =>
	import("./components/BookReader").then((module) => ({
		default: module.BookReader,
	})),
);
const SettingsScreen = React.lazy(() =>
	import("./components/SettingsScreen").then((module) => ({
		default: module.SettingsScreen,
	})),
);
const AboutScreen = React.lazy(() =>
	import("./components/AboutScreen").then((module) => ({
		default: module.AboutScreen,
	})),
);
const DonateScreen = React.lazy(() =>
	import("./components/DonateScreen").then((module) => ({
		default: module.DonateScreen,
	})),
);
const DownloadedList = React.lazy(() =>
	import("./components/DownloadedList").then((module) => ({
		default: module.DownloadedList,
	})),
);
const DailyQuotes = React.lazy(() =>
	import("./components/DailyQuotes").then((module) => ({
		default: module.DailyQuotes,
	})),
);
const EventsScreen = React.lazy(() =>
	import("./components/EventsScreen").then((module) => ({
		default: module.EventsScreen,
	})),
);
const DailyDarshanScreen = React.lazy(() =>
	import("./components/DailyDarshanScreen").then((module) => ({
		default: module.DailyDarshanScreen,
	})),
);
const SevaCenterScreen = React.lazy(() =>
	import("./components/SevaCenterScreen").then((module) => ({
		default: module.SevaCenterScreen,
	})),
);
const TempleTimingsScreen = React.lazy(
	() => import("./components/TempleTimingsScreen"),
);
const QuotePopup = React.lazy(() =>
	import("./components/QuotePopup").then((module) => ({
		default: module.QuotePopup,
	})),
);
const AudioScreen = React.lazy(() =>
	import("./components/AudioScreen").then((module) => ({
		default: module.AudioScreen,
	})),
);
const HistoryAuthorsScreen = React.lazy(() =>
	import("./components/HistoryAuthorsScreen").then((module) => ({
		default: module.HistoryAuthorsScreen,
	})),
);
const PrivacyPolicyScreen = React.lazy(() =>
	import("./components/PrivacyPolicyScreen").then((module) => ({
		default: module.PrivacyPolicyScreen,
	})),
);
const TermsOfServiceScreen = React.lazy(() =>
	import("./components/TermsOfServiceScreen").then((module) => ({
		default: module.TermsOfServiceScreen,
	})),
);
const ActivitiesScreen = React.lazy(() =>
	import("./components/ActivitiesScreen").then((module) => ({
		default: module.ActivitiesScreen,
	})),
);
const InformationScreen = React.lazy(() =>
	import("./components/InformationScreen").then((module) => ({
		default: module.InformationScreen,
	})),
);
const GuruMaharajScreen = React.lazy(() =>
	import("./components/GuruMaharajScreen").then((module) => ({
		default: module.GuruMaharajScreen,
	})),
);
const VirahiMaharajScreen = React.lazy(() =>
	import("./components/VirahiMaharajScreen").then((module) => ({
		default: module.VirahiMaharajScreen,
	})),
);
const YouTubeScreen = React.lazy(() =>
	import("./components/screens/YouTubeScreen").then((module) => ({
		default: module.YouTubeScreen,
	})),
);
const VideosScreen = React.lazy(() =>
	import("./components/VideosScreen").then((module) => ({
		default: module.VideosScreen,
	})),
);
const FacebookScreen = React.lazy(() =>
	import("./components/screens/FacebookScreen").then((module) => ({
		default: module.FacebookScreen,
	})),
);
const InstagramScreen = React.lazy(() =>
	import("./components/screens/InstagramScreen").then((module) => ({
		default: module.InstagramScreen,
	})),
);
// Profile (~140 KB with its family/relation helpers) and first-run onboarding
// are not on the first screen, so they load on demand instead of with Home.
const ProfileScreen = React.lazy(() =>
	import("./components/ProfileScreen").then((module) => ({
		default: module.ProfileScreen,
	})),
);
const OnboardingScreen = React.lazy(() =>
	import("./components/OnboardingScreen").then((module) => ({
		default: module.OnboardingScreen,
	})),
);
const ForceUpdateScreen = React.lazy(() =>
	import("./components/ForceUpdateScreen").then((module) => ({
		default: module.ForceUpdateScreen,
	})),
);

import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { SplashScreen as NativeSplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { AppUpdaterScreen } from "./components/AppUpdaterScreen";
import { AutoBackupManager } from "./components/AutoBackupManager";
import { BookList } from "./components/BookList";
import { BottomNav } from "./components/BottomNav";
import { DownloadConfirmModal } from "./components/DownloadConfirmModal";
import { DownloadManager } from "./components/DownloadManager";
import { ForceOtaUpdateScreen } from "./components/ForceOtaUpdateScreen";
import { Header } from "./components/Header";
import { HomeScreen } from "./components/HomeScreen";
import { LastSeenTracker } from "./components/LastSeenTracker";
import { UsageTracker } from "./components/UsageTracker";
import { MiniPlayer } from "./components/MiniPlayer";
import { NotificationsPermissionScreen } from "./components/NotificationsPermissionScreen";
import { SideMenu } from "./components/SideMenu";
import { SmartAppBanner } from "./components/SmartAppBanner";
import { SplashScreen } from "./components/SplashScreen";
import { VoiceSearchButton } from "./components/VoiceSearchButton";
import { AudioProvider, useAudio } from "./context/AudioContext";
import { TourHost } from "./src/tour/TourHost";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider, useData } from "./context/DataContext";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { SharedFirebaseProvider } from "./context/SharedFirebaseContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { useAppConfig } from "./hooks/useAppConfig";
import { useDeepLinking } from "./hooks/useDeepLinking";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useQuotePopup } from "./hooks/useQuotePopup";
import { triggerHaptic } from "./utils/haptic";
import { historyPopInFlight, popHistory } from "./utils/historyPop";
import { handleNotificationClick } from "./utils/NotificationActionHandler";
import { safeLocalSet } from "./utils/safeLocalSet";

export const App: React.FC = () => {
	return (
		<ToastProvider>
			<SettingsProvider>
				<DataProvider>
					<AudioProvider>
						<SharedFirebaseProvider>
							<AuthProvider>
								<MainApp />
								<AutoBackupManager />
								<LastSeenTracker />
								<UsageTracker />
							</AuthProvider>
						</SharedFirebaseProvider>
					</AudioProvider>
				</DataProvider>
			</SettingsProvider>
		</ToastProvider>
	);
};

const MainApp: React.FC = () => {
	const {
		fontSize,
		setFontSize,
		uiScale,
		setUiScale,
		script,
		setScript,
		darkMode,
		handleThemeChange,
		themeMode,
		setThemeMode,
		keepAwake,
		setKeepAwake,
		settingsLanguage,
		setSettingsLanguage,
		scrollBarSide,
		setScrollBarSide,
		azSliderSide,
		setAzSliderSide,
		devMode,
		setDevMode,
		indexMode,
		setIndexMode,
		themeColor,
		setThemeColor,
		hapticsEnabled,
		setHapticsEnabled,
		informationData,
		hasNewOtaUpdate,
		setHasNewOtaUpdate,
	} = useSettings();

	const handleTriggerManualOtaUpdate = async (url: string, version: string) => {
		setForceOtaUpdate(true);
		setForceOtaProgress(0);
		const progressListener = CapacitorUpdater.addListener(
			"download",
			(info: any) => {
				setForceOtaProgress(Math.round(info.percent));
			},
		);
		try {
			const dl = await CapacitorUpdater.download({ url, version });
			await CapacitorUpdater.set({ id: dl.id });
		} catch (e) {
			console.warn("Manual OTA Failed:", e);
			try {
				const list = await CapacitorUpdater.list();
				const existing = list.bundles.find((b: any) => b.version === version);
				if (
					existing &&
					(existing.status === "success" || existing.status === "pending")
				) {
					await CapacitorUpdater.set({ id: existing.id });
				}
			} catch (_err) {}
			// set() reloads the app on success, so reaching here means the update
			// didn't apply. Drop the full-screen progress overlay, or the user is
			// stuck on it (back is blocked while forceOtaUpdate is true).
			setForceOtaUpdate(false);
			showToast(
				settingsLanguage === "hi"
					? "अपडेट नहीं हो पाया, बाद में फिर कोशिश करें"
					: "Update failed, please try again later",
			);
		} finally {
			(await progressListener).remove();
		}
	};

	// Splash + App state from appStore
	const {
		isUpdaterOpen,
		setIsUpdaterOpen,
		isSplashAnimatingOut,
		setIsSplashAnimatingOut,
		isSplashRemoved,
		setIsSplashRemoved,
		mainAppMounted,
		setMainAppMounted,
		minTimeElapsed,
		setMinTimeElapsed,
		showOnboarding,
		setShowOnboarding,
		forceUpdateConfig,
		setForceUpdateConfig,
		forceOtaUpdate,
		setForceOtaUpdate,
		forceOtaProgress,
		setForceOtaProgress,
	} = useAppStore();
	const SPLASH_MIN_VISIBLE_DURATION_MS = 900;
	const SPLASH_MAX_VISIBLE_DURATION_MS = 1200;
	// Frame delay after paint, before the splash starts fading out.
	const SPLASH_FADE_OUT_DELAY_MS = 150;
	// Upper bound for hiding the native splash when rAF never fires (screen off
	// or app backgrounded during startup). Comfortably past a normal first paint.
	const NATIVE_SPLASH_HIDE_FALLBACK_MS = 1500;

	useEffect(() => {
		const timer = setTimeout(() => {
			setMinTimeElapsed(true);
		}, SPLASH_MIN_VISIBLE_DURATION_MS);
		return () => clearTimeout(timer);
	}, []);

	const baseContainerHeight = 18;
	const scaledContainerHeight = Math.max(baseContainerHeight * uiScale, 14);
	const headerHeightRem = scaledContainerHeight * 0.25;

	const {
		bhajans,
		setBhajans,
		allBhajans,
		books,
		setBooks,
		allBooks,
		lectures,
		setLectures,
		allLectures,
		events,
		setEvents,
		playlists,
		historyItems,
		activeDownloads,
		isLoading,
		syncStatus,
		isBhajanSyncing,
		isBookSyncing,
		isLectureSyncing,
		bhajanSyncProgress,
		bookSyncProgress,
		lectureSyncProgress,
		createPlaylist,
		deletePlaylist,
		addToPlaylist,
		removeFromPlaylist,
		retryBhajanSync,
		retryBookSync,
		retryLectureSync,
		addToHistory,
		clearHistory,
		downloadBook,
		cancelDownload,
		downloadTrack,
		importData,
		resetData,
		saveBhajanLocally,
		downloadConfirmation,
	} = useData();

	const { currentBhajan, closePlayer, playTrack } = useAudio();
	const { showToast } = useToast();

	// --- View State ---
	// Navigation state from navigationStore
	const {
		activeTab,
		setActiveTab,
		tabHistory,
		setTabHistory,
		animDirection,
		setAnimDirection,
	} = useNavigationStore();

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (animDirection !== "none") {
			const timer = setTimeout(() => {
				setAnimDirection("none");
			}, 350);
			return () => clearTimeout(timer);
		}
	}, [animDirection]);

	// Search state from searchStore
	const {
		searchQuery,
		setSearchQuery,
		debouncedQuery,
		setDebouncedQuery,
		isSearchFocused,
		setIsSearchFocused,
		showLandscapeSearch,
		setShowLandscapeSearch,
	} = useSearchStore();

	// Reader state from readerStore
	const {
		selectedBhajan,
		setSelectedBhajan,
		selectedBook,
		setSelectedBook,
		selectedContextQueue,
		setSelectedContextQueue,
		selectedQueueName,
		setSelectedQueueName,
		isNewBhajan,
		setIsNewBhajan,
	} = useReaderStore();

	const [_showRecentSearches, setShowRecentSearches] = useState(false);
	const [_recentSearches, setRecentSearches] = useState<string[]>([]);

	useEffect(() => {
		setRecentSearches(getRecentSearches());
		if (Capacitor.isNativePlatform()) {
			ScreenOrientation.lock({ orientation: "portrait" }).catch(() => {});

			// ── Hide native splash AFTER first paint ─────────────────────────────
			// launchAutoHide is disabled in capacitor.config.json so we control this.
			// Double-rAF is the FAST path: it fires right after the first painted
			// frame, so the splash disappears as early as possible.
			//
			// CRITICAL: rAF is driven by compositor frame production. If the device
			// screen turns off (or the app is backgrounded) before the first frame
			// lands, Chromium suspends rAF indefinitely and these callbacks never
			// run — leaving the splash up until the user unlocks the phone.
			// The setTimeout below is the SLOW path that is immune to that: timers
			// are throttled while hidden but never suspended outright, and
			// MainActivity.onStop() calls wv.onResume() to keep them running for
			// background audio.
			// Whichever fires first wins; `hidden` makes the second one a no-op.
			let hidden = false;
			const hideNativeSplash = () => {
				if (hidden) return;
				hidden = true;
				NativeSplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
			};

			requestAnimationFrame(() => {
				requestAnimationFrame(hideNativeSplash);
			});
			setTimeout(hideNativeSplash, NATIVE_SPLASH_HIDE_FALLBACK_MS);
		}
	}, []);

	// 1. Determine when to mount the main app (data-ready fast path)
	useEffect(() => {
		if (!mainAppMounted && !isLoading && minTimeElapsed) {
			setMainAppMounted(true);
		}
	}, [isLoading, mainAppMounted, minTimeElapsed]);

	// Safety timeout: guarantees the app mounts even if data never loads.
	// Guard with !mainAppMounted so the timeout is a true fallback — it won't
	// fire an extra state update if the fast path above already ran first,
	// preventing a redundant re-render at startup.
	useEffect(() => {
		if (mainAppMounted) return; // fast path already ran, nothing to do
		const timer = setTimeout(() => {
			setMainAppMounted(true);
		}, SPLASH_MAX_VISIBLE_DURATION_MS);
		return () => clearTimeout(timer);
	}, [mainAppMounted]);

	// 2. Trigger animation OUT
	//
	// This flag is the ONLY thing that makes the app visible: the main container
	// below renders at `opacity: 0` until it flips. It must therefore never
	// depend on requestAnimationFrame.
	//
	// It used to be set inside a double-rAF. rAF only fires while the WebView is
	// producing frames, so if the device screen turned off during startup the
	// callback was suspended forever — the app stayed mounted at opacity 0 behind
	// an opaque splash overlay, and only appeared once the user unlocked the
	// phone. Timers are merely throttled while hidden, never suspended, so the
	// app is always visible by the time the screen comes back.
	useEffect(() => {
		if (mainAppMounted && !isSplashAnimatingOut && !isSplashRemoved) {
			const timer = setTimeout(() => {
				setIsSplashAnimatingOut(true);
			}, SPLASH_FADE_OUT_DELAY_MS);

			return () => clearTimeout(timer);
		}
	}, [mainAppMounted, isSplashAnimatingOut, isSplashRemoved]);

	// 3. Remove Splash entirely after animation
	useEffect(() => {
		if (isSplashAnimatingOut) {
			const timer = setTimeout(() => {
				setIsSplashRemoved(true);
			}, 400); // 400ms for smooth 3D animation
			return () => clearTimeout(timer);
		}
	}, [isSplashAnimatingOut]);

	// --- Modals State (Zustand — prevents full re-render on modal open/close) ---
	const {
		isSideMenuOpen,
		setIsSideMenuOpen,
		isSettingsOpen,
		setIsSettingsOpen,
		isAboutOpen,
		setIsAboutOpen,
		isDonateOpen,
		setIsDonateOpen,
		isDailyQuotesOpen,
		setIsDailyQuotesOpen,
		isDailyInfoOpen,
		setIsDailyInfoOpen,
		isEventsOpen,
		setIsEventsOpen,
		isDailyDarshanOpen,
		setIsDailyDarshanOpen,
		isSevaCenterOpen,
		setIsSevaCenterOpen,
		isTempleTimingsOpen,
		setIsTempleTimingsOpen,
		selectedTempleId,
		setSelectedTempleId,
		isActivitiesOpen,
		setIsActivitiesOpen,
		isYouTubeOpen,
		setIsYouTubeOpen,
		isFacebookOpen,
		setIsFacebookOpen,
		isInstagramOpen,
		setIsInstagramOpen,
		isPrivacyOpen,
		setIsPrivacyOpen,
		isTermsOpen,
		setIsTermsOpen,
		isInformationOpen,
		setIsInformationOpen,
		isVideosOpen,
		setIsVideosOpen,
		isGuruMaharajOpen,
		setIsGuruMaharajOpen,
		isVirahiMaharajOpen,
		setIsVirahiMaharajOpen,
		isProfileOpen,
		setIsProfileOpen,
		isActivitiesPhotosOpen,
		setIsActivitiesPhotosOpen,
		showQuotePopup,
		setShowQuotePopup,
		notifMandalTarget,
		setNotifMandalTarget,
		notifInfoItemId,
		setNotifInfoItemId,
		isForcedUpdateInProgress,
		setIsForcedUpdateInProgress,
		notificationPermissionDenied,
		setNotificationPermissionDenied,
	} = useUIStore();

	const isAdminPanelOpen =
		isSettingsOpen && window.history.state?.view === "admin";

	// Native Android only — show blocker immediately if notifications denied.
	// Web users are NEVER blocked; we try to request permission but don't force it.
	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;
		if (typeof Notification === "undefined") return;
		if (Notification.permission !== "denied") return;
		if (!import.meta.env.DEV) {
			setNotificationPermissionDenied(true);
		}
	}, [setNotificationPermissionDenied]);

	// forceUpdateConfig, forceOtaUpdate, forceOtaProgress come from appStore (initialized above)

	// showOnboarding comes from appStore (initialized above)
	// Its initial value is computed once at store creation time (same logic as before)

	const _searchContainerRef = useRef<HTMLDivElement>(null);
	const mainScrollRef = useRef<HTMLDivElement>(null);
	const scrollPositionRef = useRef(0);

	// Swipe State
	const touchStart = useRef({ x: 0, y: 0 });
	const touchEnd = useRef({ x: 0, y: 0 });

	// Exit Logic Refs
	const exitAttemptRef = useRef(0);
	const exitTimeoutRef = useRef<any>(null);
	// --- Custom Hooks Integration ---
	useAppConfig({
		settingsLanguage,
		setForceUpdateConfig,
		setIsForcedUpdateInProgress,
		setForceOtaUpdate,
		setForceOtaProgress,
		setHasNewOtaUpdate,
	});

	const { navigateToBhajanById, pendingActionRef } = useDeepLinking({
		bhajans,
		lectures,
		isLoading,
		addToHistory,
		setSelectedBhajan,
		setSelectedContextQueue,
		setSelectedQueueName,
		setActiveTab,
		setIsVideosOpen,
		setIsActivitiesOpen,
		setIsPrivacyOpen,
		setIsTermsOpen,
		setIsAboutOpen,
		handleScreenAction: useCallback((screen: string) => {
			handleNotificationClick(
				{ action_type: "screen", target_screen: screen },
				callbacksRef.current,
			);
		}, []),
		handleNotificationData: useCallback((data: any) => {
			handleNotificationClick(data, callbacksRef.current);
		}, []),
		onPlayLecture: useCallback(
			(lecture: LectureData) => {
				setActiveTab("lectures");
				if (lecture.audio && lecture.audio.length > 0) {
					const queue = lecture.audio.map((t) => ({
						...t,
						bhajanTitle: lecture.title,
						parentBhajan: undefined,
					}));
					playTrack(queue[0], lecture.title, undefined, undefined, queue);
				}
			},
			[playTrack],
		),
	});

	const callbacksRef = useRef<any>(null);
	callbacksRef.current = {
		setActiveTab,
		setTabHistory,
		setAnimDirection,
		setIsDailyQuotesOpen,
		setIsEventsOpen,
		setIsDailyDarshanOpen,
		setIsSevaCenterOpen,
		setIsActivitiesOpen,
		setIsInformationOpen,
		setIsGuruMaharajOpen,
		setIsVirahiMaharajOpen,
		setIsAboutOpen,
		setIsDonateOpen,
		setIsPrivacyOpen,
		setIsTermsOpen,
		setIsSettingsOpen,
		setShowOnboarding,
		setIsDailyInfoOpen,
		setIsYoutubeOpen: setIsYouTubeOpen,
		setIsTempleTimingsOpen,
		setIsVideosOpen: setIsVideosOpen,
		setIsProfileOpen: setIsProfileOpen,
		setIsActivitiesPhotosOpen: setIsActivitiesPhotosOpen,
		setNotifMandalTarget,
		setNotifInfoItemId,
		handleDeepLink: (id: string, type?: "bhajan" | "lecture") => {
			if (isLoading || (bhajans.length === 0 && lectures.length === 0)) {
				pendingActionRef.current = { type: type || "bhajan", data: id };
			} else {
				navigateToBhajanById(id, type || "bhajan");
			}
		},
		setNotificationPermissionDenied,
	};

	usePushNotifications(callbacksRef.current, settingsLanguage);

	useQuotePopup({
		showOnboarding,
		setShowQuotePopup,
	});

	const tabs: AppTab[] = useMemo(
		() => ["books", "lectures", "home", "songs", "library"],
		[],
	);

	useEffect(() => {
		if (!searchQuery.trim()) {
			setDebouncedQuery("");
			return;
		}
		const handler = setTimeout(() => {
			setDebouncedQuery(searchQuery);
		}, 250);
		return () => {
			clearTimeout(handler);
		};
	}, [searchQuery]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const metaThemeColor = document.querySelector('meta[name="theme-color"]');
		const appBgColor = darkMode ? "#2A0808" : "#F2EBDA";

		if (metaThemeColor) {
			metaThemeColor.setAttribute("content", appBgColor);
		}

		if (Capacitor.isNativePlatform()) {
			StatusBar.setBackgroundColor({ color: appBgColor }).catch(() => {});
			const style = darkMode ? Style.Dark : Style.Light;
			StatusBar.setStyle({ style }).catch(() => {});
		}
	}, [darkMode, selectedBhajan]);

	const stateRef = useRef({
		hasSelectedBhajan: !!selectedBhajan,
		hasSelectedBook: !!selectedBook,
		isSettingsOpen,
		isAboutOpen,
		isDonateOpen,
		isSideMenuOpen,
		isSearchFocused,
		searchQuery,
		isDailyQuotesOpen,
		isDailyInfoOpen,
		isEventsOpen,
		isDailyDarshanOpen,
		isSevaCenterOpen,
		isTempleTimingsOpen,
		isActivitiesOpen,
		isYouTubeOpen,
		isFacebookOpen,
		isInstagramOpen,
		isPrivacyOpen,
		isTermsOpen,
		isInformationOpen,
		isGuruMaharajOpen,
		isVirahiMaharajOpen,
		showQuotePopup,
		isVideosOpen,
		activeTab,
		showLandscapeSearch,
		tabHistory,
		showOnboarding,
		isForcedUpdateInProgress,
		forceOtaUpdate,
		notificationPermissionDenied,
		isAdminPanelOpen: false,
		isForceUpdateBlocked: !!forceUpdateConfig || forceOtaUpdate,
		isProfileOpen,
		isActivitiesPhotosOpen,
	});

	const adminPanelRef = useRef<{ popScreen: () => boolean }>(null);

	useEffect(() => {
		stateRef.current = {
			hasSelectedBhajan: !!selectedBhajan,
			hasSelectedBook: !!selectedBook,
			isSettingsOpen,
			isAboutOpen,
			isDonateOpen,
			isSideMenuOpen,
			isSearchFocused,
			searchQuery,
			activeTab,
			isDailyQuotesOpen,
			isDailyInfoOpen,
			isEventsOpen,
			isDailyDarshanOpen,
			isSevaCenterOpen,
			isTempleTimingsOpen,
			isActivitiesOpen,
			isYouTubeOpen,
			isFacebookOpen,
			isInstagramOpen,
			isPrivacyOpen,
			isTermsOpen,
			isInformationOpen,
			isGuruMaharajOpen,
			isVirahiMaharajOpen,
			isVideosOpen,
			showQuotePopup,
			showLandscapeSearch,
			tabHistory,
			showOnboarding,
			isForcedUpdateInProgress,
			forceOtaUpdate,
			notificationPermissionDenied,
			isAdminPanelOpen:
				isSettingsOpen && window.history.state?.view === "admin",
			isForceUpdateBlocked: !!forceUpdateConfig || forceOtaUpdate,
			isProfileOpen,
			isActivitiesPhotosOpen,
		};
	}, [
		selectedBhajan,
		selectedBook,
		isSettingsOpen,
		isAboutOpen,
		isDonateOpen,
		isSideMenuOpen,
		isSearchFocused,
		searchQuery,
		activeTab,
		isDailyQuotesOpen,
		isDailyInfoOpen,
		isEventsOpen,
		isDailyDarshanOpen,
		isSevaCenterOpen,
		isTempleTimingsOpen,
		isActivitiesOpen,
		isYouTubeOpen,
		isFacebookOpen,
		isInstagramOpen,
		isPrivacyOpen,
		isTermsOpen,
		isInformationOpen,
		isGuruMaharajOpen,
		isVirahiMaharajOpen,
		isVideosOpen,
		showQuotePopup,
		showLandscapeSearch,
		tabHistory,
		showOnboarding,
		isForcedUpdateInProgress,
		forceOtaUpdate,
		notificationPermissionDenied,
		forceUpdateConfig,
		isProfileOpen,
		isActivitiesPhotosOpen,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const handlePopState = (event: PopStateEvent) => {
			const state = event.state || {};
			const view = state.view;
			// "tour" is the guided tour's own popup entry (src/tour/ProductTour.tsx).
			// It sits on top of whatever screen is open, so landing on it must not
			// close that screen; the tour handles the entry itself (a stale one is
			// skipped with another back step).
			if (view === "tour") return;
			// If the new (landed-on) state is itself a child popup, it means a child
			// popup's history entry is still on the stack — App-level handlers must
			// NOT react so child usePopupBackHandler listeners handle it themselves.
			if (
				state.isPopup &&
				![
					"settings",
					"admin",
					"menu",
					"about",
					"donate",
					"quotes",
					"info",
					"events",
					"darshan",
					"darshan-category",
					"darshan-image",
					"seva",
					"temple-timings",
					"activities",
					"youtube",
					"facebook",
					"instagram",
					"privacy",
					"terms",
					"information",
					"info-detail",
					"info-image-zoom",
					"videos",
					"guru-maharaj",
					"virahi-maharaj",
					"profile",
					"activities_photos",
					"reader",
					"book",
					"onboarding",
					"photos",
					"mic-permission",
				].includes(view)
			)
				return;
			const s = stateRef.current;
			if (s.isSettingsOpen && view !== "settings" && view !== "admin")
				setIsSettingsOpen(false);
			if (s.isAboutOpen && view !== "about") setIsAboutOpen(false);
			if (s.isDonateOpen && view !== "donate") setIsDonateOpen(false);
			if (s.isSideMenuOpen && view !== "menu") setIsSideMenuOpen(false);
			if (s.isDailyQuotesOpen && view !== "quotes") setIsDailyQuotesOpen(false);
			if (s.isDailyInfoOpen && view !== "info") setIsDailyInfoOpen(false);
			if (s.isEventsOpen && view !== "events") setIsEventsOpen(false);
			if (
				s.isDailyDarshanOpen &&
				view !== "darshan" &&
				view !== "darshan-category" &&
				view !== "darshan-image"
			)
				setIsDailyDarshanOpen(false);
			if (s.isSevaCenterOpen && view !== "seva") setIsSevaCenterOpen(false);
			if (s.isTempleTimingsOpen && view !== "temple-timings")
				setIsTempleTimingsOpen(false);
			if (s.isActivitiesOpen && view !== "activities")
				setIsActivitiesOpen(false);
			if (s.isYouTubeOpen && view !== "youtube") setIsYouTubeOpen(false);
			if (s.isFacebookOpen && view !== "facebook") setIsFacebookOpen(false);
			if (s.isInstagramOpen && view !== "instagram") setIsInstagramOpen(false);
			if (s.isPrivacyOpen && view !== "privacy") setIsPrivacyOpen(false);
			if (s.isTermsOpen && view !== "terms") setIsTermsOpen(false);
			if (
				s.isInformationOpen &&
				view !== "information" &&
				view !== "info-detail" &&
				view !== "info-image-zoom"
			)
				setIsInformationOpen(false);
			if (s.isVideosOpen && view !== "videos") setIsVideosOpen(false);
			if (s.isGuruMaharajOpen && view !== "guru-maharaj")
				setIsGuruMaharajOpen(false);
			if (s.isVirahiMaharajOpen && view !== "virahi-maharaj")
				setIsVirahiMaharajOpen(false);
			if (s.isProfileOpen && view !== "profile") setIsProfileOpen(false);
			if (s.isActivitiesPhotosOpen && view !== "activities_photos")
				setIsActivitiesPhotosOpen(false);
			if (s.hasSelectedBhajan && view !== "reader") {
				setSelectedBhajan(null);
				setSelectedContextQueue(undefined);
				setIsNewBhajan(false);
			}
			if (s.hasSelectedBook && view !== "book") setSelectedBook(null);
			// if (s.activeTab === "downloaded" && view !== "downloaded") { setActiveTab("home"); setAnimDirection("left"); }

			// Handle tab navigation from history
			if (view?.startsWith("tab-")) {
				const tabName = view.replace("tab-", "") as AppTab;
				if (s.activeTab !== tabName) {
					setAnimDirection("left"); // Or determine direction based on tab index
					setActiveTab(tabName);
				}
			} else if ((!view || view === "root") && s.activeTab !== "home") {
				setAnimDirection("left");
				setActiveTab("home");
			}
		};
		window.addEventListener("popstate", handlePopState);

		const handleOpenProfileEvent = () => {
			if (!stateRef.current.isProfileOpen) {
				window.history.pushState({ isPopup: true, view: "profile" }, "");
				setIsProfileOpen(true);
			}
		};
		window.addEventListener("cpbs:openProfile" as any, handleOpenProfileEvent);

		return () => {
			window.removeEventListener("popstate", handlePopState);
			window.removeEventListener(
				"cpbs:openProfile" as any,
				handleOpenProfileEvent,
			);
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	const closeTopmostView = useCallback(() => {
		/* Every branch below decides what to close by reading
		   `window.history.state`, and that state stays stale until an in-flight
		   `history.back()` actually lands (see utils/historyPop.ts). A second back
		   gesture inside that window would therefore re-read the entry we are
		   already leaving and pop one entry too many — closing the screen
		   underneath. The traversal already on its way will do the closing, so
		   swallow the gesture and report it as handled. */
		if (historyPopInFlight()) return true;

		// If a popup pushed its state, let the browser history back pop it and trigger the popstate listener.
		if (window.history.state?.isPopup) {
			popHistory();
			return true;
		}

		const s = stateRef.current;
		if (
			s.isForceUpdateBlocked ||
			s.isForcedUpdateInProgress ||
			s.forceOtaUpdate ||
			s.notificationPermissionDenied ||
			s.showOnboarding
		)
			return true;
		if (s.showLandscapeSearch) {
			setShowLandscapeSearch(false);
			return true;
		}
		if (s.showQuotePopup) {
			setShowQuotePopup(false);
			return true;
		}
		const checkAndClose = (
			isOpen: boolean,
			viewName: string,
			closeFn: () => void,
		) => {
			if (isOpen) {
				if (window.history.state?.view === viewName) popHistory();
				else closeFn();
				return true;
			}
			return false;
		};
		if (s.hasSelectedBhajan) {
			if (window.history.state?.view === "reader") popHistory();
			else {
				setSelectedBhajan(null);
				setSelectedContextQueue(undefined);
				setIsNewBhajan(false);
			}
			return true;
		}
		if (s.hasSelectedBook) {
			if (window.history.state?.view === "book") popHistory();
			else setSelectedBook(null);
			return true;
		}
		if (
			checkAndClose(s.isDailyQuotesOpen, "quotes", () =>
				setIsDailyQuotesOpen(false),
			)
		)
			return true;
		if (
			checkAndClose(s.isDailyInfoOpen, "info", () => setIsDailyInfoOpen(false))
		)
			return true;
		if (s.isDailyDarshanOpen) {
			const v = window.history.state?.view;
			if (v === "darshan" || v === "darshan-category" || v === "darshan-image")
				popHistory();
			else setIsDailyDarshanOpen(false);
			return true;
		}
		if (
			checkAndClose(s.isSevaCenterOpen, "seva", () =>
				setIsSevaCenterOpen(false),
			)
		)
			return true;
		if (
			checkAndClose(s.isTempleTimingsOpen, "temple-timings", () =>
				setIsTempleTimingsOpen(false),
			)
		)
			return true;
		if (
			checkAndClose(s.isActivitiesOpen, "activities", () =>
				setIsActivitiesOpen(false),
			)
		)
			return true;
		if (
			checkAndClose(s.isYouTubeOpen, "youtube", () => setIsYouTubeOpen(false))
		)
			return true;
		if (
			checkAndClose(s.isFacebookOpen, "facebook", () =>
				setIsFacebookOpen(false),
			)
		)
			return true;
		if (
			checkAndClose(s.isInstagramOpen, "instagram", () =>
				setIsInstagramOpen(false),
			)
		)
			return true;
		if (
			checkAndClose(s.isPrivacyOpen, "privacy", () => setIsPrivacyOpen(false))
		)
			return true;
		if (checkAndClose(s.isTermsOpen, "terms", () => setIsTermsOpen(false)))
			return true;
		if (checkAndClose(s.isVideosOpen, "videos", () => setIsVideosOpen(false)))
			return true;
		if (s.isInformationOpen) {
			const v = window.history.state?.view;
			if (v === "information" || v === "info-detail" || v === "info-image-zoom")
				popHistory();
			else setIsInformationOpen(false);
			return true;
		}
		if (
			checkAndClose(s.isGuruMaharajOpen, "guru-maharaj", () =>
				setIsGuruMaharajOpen(false),
			)
		)
			return true;
		if (
			checkAndClose(s.isVirahiMaharajOpen, "virahi-maharaj", () =>
				setIsVirahiMaharajOpen(false),
			)
		)
			return true;
		if (
			checkAndClose(s.isProfileOpen, "profile", () => setIsProfileOpen(false))
		)
			return true;
		if (
			checkAndClose(s.isActivitiesPhotosOpen, "activities_photos", () =>
				setIsActivitiesPhotosOpen(false),
			)
		)
			return true;
		if (checkAndClose(s.isEventsOpen, "events", () => setIsEventsOpen(false)))
			return true;
		if (checkAndClose(s.isDonateOpen, "donate", () => setIsDonateOpen(false)))
			return true;
		if (s.isSettingsOpen) {
			if (s.isAdminPanelOpen && adminPanelRef.current) {
				if (adminPanelRef.current.popScreen()) return true;
			}
			if (
				window.history.state?.view === "settings" ||
				window.history.state?.view === "admin"
			)
				popHistory();
			else setIsSettingsOpen(false);
			return true;
		}
		if (checkAndClose(s.isAboutOpen, "about", () => setIsAboutOpen(false)))
			return true;
		if (checkAndClose(s.isSideMenuOpen, "menu", () => setIsSideMenuOpen(false)))
			return true;
		if (searchQuery.trim().length > 0 || isSearchFocused) {
			setSearchQuery("");
			setIsSearchFocused(false);
			if (document.activeElement instanceof HTMLElement)
				document.activeElement.blur();
			return true;
		}
		if (s.activeTab !== "home") {
			if (
				window.history.state?.view?.startsWith("tab-") ||
				window.history.state?.view === "downloaded"
			) {
				popHistory();
				return true;
			}
			setTabHistory(["home"]);
			setActiveTab("home");
			setAnimDirection("left");
			return "tab_switch";
		}
		return false;
	}, [searchQuery, isSearchFocused]);

	useEffect(() => {
		try {
			if (!window.history.state || window.history.state.view === undefined) {
				window.history.replaceState({ view: "root" }, "");
			}
		} catch (_e) {}
		const backButtonListener = CapApp.addListener(
			"backButton",
			({ canGoBack }) => {
				const handledInternally = closeTopmostView();
				if (handledInternally === true) {
					exitAttemptRef.current = 0;
					return;
				}
				if (handledInternally === "tab_switch") {
					exitAttemptRef.current = 1;
					if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
					exitTimeoutRef.current = setTimeout(() => {
						exitAttemptRef.current = 0;
					}, 3000);
					return;
				}
				exitAttemptRef.current += 1;
				if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
				exitTimeoutRef.current = setTimeout(() => {
					exitAttemptRef.current = 0;
				}, 3000);
				if (exitAttemptRef.current === 2) {
					showToast(
						settingsLanguage === "hi"
							? "बाहर निकलने के लिए फिर से दबाएं"
							: "Press back again to exit",
					);
				} else if (exitAttemptRef.current >= 3) {
					closePlayer();
					setTimeout(() => {
						CapApp.exitApp();
					}, 100);
				}
			},
		);
		return () => {
			backButtonListener.then((handler) => handler.remove());
		};
	}, [closeTopmostView, settingsLanguage, showToast, closePlayer]);

	const goBack = useCallback(() => {
		closeTopmostView();
	}, [closeTopmostView]);

	const handleTabChange = useCallback(
		(tab: AppTab) => {
			if (tab === activeTab) return;
			setSearchQuery("");
			setDebouncedQuery("");
			setIsSearchFocused(false);
			const currentIndex = tabs.indexOf(activeTab);
			const newIndex = tabs.indexOf(tab);
			setAnimDirection(newIndex > currentIndex ? "right" : "left");
			setActiveTab(tab);
			setTabHistory([...tabHistory, tab]);
			if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;

			// Push state so back button works for tabs
			if (window.history.state?.view !== `tab-${tab}`) {
				window.history.pushState({ view: `tab-${tab}` }, "");
			}
		},
		[activeTab, tabs],
	);

	// ─── Stable HomeScreen callbacks (useCallback prevents HomeScreen re-render) ─
	const hsOpenDailyQuotes = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "quotes" }, "");
		setIsDailyQuotesOpen(true);
	}, [setIsDailyQuotesOpen]);

	const hsOpenDailyInfo = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "info" }, "");
		setIsDailyInfoOpen(true);
	}, [setIsDailyInfoOpen]);

	const hsOpenInformation = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "information" }, "");
		setIsInformationOpen(true);
	}, [setIsInformationOpen]);

	const hsOpenEvents = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "events" }, "");
		setIsEventsOpen(true);
	}, [setIsEventsOpen]);

	const hsOpenDailyDarshan = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "darshan" }, "");
		setIsDailyDarshanOpen(true);
	}, [setIsDailyDarshanOpen]);

	const hsOpenSevaCenter = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "seva" }, "");
		setIsSevaCenterOpen(true);
	}, [setIsSevaCenterOpen]);

	const hsOpenActivities = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "activities" }, "");
		setIsActivitiesOpen(true);
	}, [setIsActivitiesOpen]);

	const hsOpenYouTube = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "youtube" }, "");
		setIsYouTubeOpen(true);
	}, [setIsYouTubeOpen]);

	const hsOpenFacebook = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "facebook" }, "");
		setIsFacebookOpen(true);
	}, [setIsFacebookOpen]);

	const hsOpenInstagram = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "instagram" }, "");
		setIsInstagramOpen(true);
	}, [setIsInstagramOpen]);

	const hsOpenDonate = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "donate" }, "");
		setIsDonateOpen(true);
	}, [setIsDonateOpen]);

	const hsOpenBhajanList = useCallback(
		() => handleTabChange("songs"),
		[handleTabChange],
	);

	const hsOpenAbout = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "about" }, "");
		setIsAboutOpen(true);
	}, [setIsAboutOpen]);

	const hsOpenOnboarding = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "onboarding" }, "");
		setShowOnboarding(true);
	}, []);

	const hsOpenGuruMaharaj = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "guru-maharaj" }, "");
		setIsGuruMaharajOpen(true);
	}, [setIsGuruMaharajOpen]);

	const hsOpenVirahiMaharaj = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "virahi-maharaj" }, "");
		setIsVirahiMaharajOpen(true);
	}, [setIsVirahiMaharajOpen]);

	const hsOpenTempleTimings = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "temple-timings" }, "");
		setSelectedTempleId(undefined);
		setIsTempleTimingsOpen(true);
	}, [setSelectedTempleId, setIsTempleTimingsOpen]);

	const hsOpenSettings = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "settings" }, "");
		setIsSettingsOpen(true);
	}, [setIsSettingsOpen]);

	const hsOpenProfile = useCallback(() => {
		if (!isProfileOpen) {
			window.history.pushState({ isPopup: true, view: "profile" }, "");
			setIsProfileOpen(true);
		}
	}, [isProfileOpen, setIsProfileOpen]);

	const hsOpenPrivacy = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "privacy" }, "");
		setIsPrivacyOpen(true);
	}, [setIsPrivacyOpen]);

	const hsOpenVideos = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "videos" }, "");
		setIsVideosOpen(true);
	}, [setIsVideosOpen]);

	// VideosScreen pushes its own layer entries on top of the "videos" entry
	// hsOpenVideos pushed. When its last layer is popped it lands on ours — pop
	// that too (popstate then closes the screen) instead of leaving it orphaned,
	// which made every later back press land on a dead entry. Deep links open
	// Videos without our entry, so there we just close.
	const closeVideos = useCallback(() => {
		const state = window.history.state;
		if (state?.view === "videos" && !state.layer) popHistory();
		else setIsVideosOpen(false);
	}, [setIsVideosOpen]);

	const hsOpenPhotos = useCallback(() => {
		window.history.pushState({ isPopup: true, view: "activities_photos" }, "");
		setIsActivitiesPhotosOpen(true);
	}, [setIsActivitiesPhotosOpen]);

	const hsNavigate = useCallback(
		(screen: string) => {
			if (
				[
					"home",
					"songs",
					"lectures",
					"books",
					"library",
					"downloaded",
				].includes(screen)
			) {
				handleTabChange(screen as AppTab);
			} else if (screen === "downloads") {
				handleTabChange("downloaded");
			}
		},
		[handleTabChange],
	);

	const hsOpenDeepLink = useCallback(
		(id: string, type?: "bhajan" | "lecture") =>
			callbacksRef.current?.handleDeepLink?.(id, type),
		[],
	);

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStart.current = {
			x: e.targetTouches[0].clientX,
			y: e.targetTouches[0].clientY,
		};
		touchEnd.current = { x: 0, y: 0 };
	};
	const handleTouchMove = (e: React.TouchEvent) => {
		touchEnd.current = {
			x: e.targetTouches[0].clientX,
			y: e.targetTouches[0].clientY,
		};
	};
	const handleTouchEnd = (_e: React.TouchEvent) => {
		if (touchEnd.current.x === 0 && touchEnd.current.y === 0) return;
		const dx = touchStart.current.x - touchEnd.current.x;
		const dy = touchStart.current.y - touchEnd.current.y;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
			const currentIndex = tabs.indexOf(activeTab);
			if (dx > 0) {
				if (currentIndex < tabs.length - 1)
					handleTabChange(tabs[currentIndex + 1]);
			} else {
				if (currentIndex > 0) handleTabChange(tabs[currentIndex - 1]);
			}
		}
		touchStart.current = { x: 0, y: 0 };
		touchEnd.current = { x: 0, y: 0 };
	};

	const handleOpenReader = (
		bhajan: Bhajan,
		contextQueue?: BhajanAudio[],
		queueName?: string,
	) => {
		triggerHaptic("medium");
		if (searchQuery.trim()) {
			addRecentSearch(searchQuery);
			setRecentSearches(getRecentSearches());
		}
		window.history.pushState({ view: "reader" }, "");
		if (mainScrollRef.current)
			scrollPositionRef.current = mainScrollRef.current.scrollTop;
		addToHistory(bhajan.id, "song");
		setSelectedBhajan(bhajan);
		setSelectedContextQueue(contextQueue);
		setSelectedQueueName(queueName);
		setIsNewBhajan(false);
		setIsSearchFocused(false);
	};

	const handleOpenLecture = (
		lecture: LectureData,
		targetTrack?: BhajanAudio,
		contextQueue?: BhajanAudio[],
	) => {
		triggerHaptic("medium");
		if (searchQuery.trim()) {
			addRecentSearch(searchQuery);
			setRecentSearches(getRecentSearches());
		}
		window.history.pushState({ view: "lecture" }, "");
		addToHistory(lecture.id, "lecture");
		let queue = contextQueue;
		if (!queue && targetTrack && lecture.audio) {
			const idx = lecture.audio.findIndex((t) => t.id === targetTrack.id);
			if (idx !== -1) {
				const rawQueue = [
					...lecture.audio.slice(idx),
					...lecture.audio.slice(0, idx),
				];
				queue = rawQueue.map((t) => ({
					...t,
					bhajanTitle: lecture.title,
					parentBhajan: undefined,
				}));
			}
		} else if (!queue && lecture.audio && lecture.audio.length > 0) {
			queue = lecture.audio.map((t) => ({
				...t,
				bhajanTitle: lecture.title,
				parentBhajan: undefined,
			}));
		}
		setSelectedBhajan({
			id: `lecture_${lecture.id}`,
			title: lecture.title,
			titleIAST: lecture.title,
			firstLine: lecture.description.substring(0, 30),
			firstLineIAST: lecture.description.substring(0, 30),
			content: lecture.description,
			contentIAST: lecture.description,
			searchIndex: "",
			searchTokens: [],
			audio: lecture.audio,
			author: lecture.date ? `Date: ${lecture.date}` : undefined,
		});
		setSelectedContextQueue(queue);
		setSelectedQueueName(lecture.title);
	};

	const handleOpenBook = async (
		book: Book,
		openedNatively: boolean = false,
	) => {
		triggerHaptic("medium");
		if (searchQuery.trim()) {
			addRecentSearch(searchQuery);
			setRecentSearches(getRecentSearches());
		}
		if (book.url) {
			if (openedNatively) {
				addToHistory(book.id, "book");
				return;
			}

			if (Capacitor.getPlatform() === "android") {
				const { openDownloadedBook, isBookDownloaded } = await import(
					"./utils/bookStorage"
				);
				if (!isBookDownloaded(book.id)) {
					showToast(
						settingsLanguage === "hi"
							? "पढ़ने के लिए पहले किताब डाउनलोड करें।"
							: "Download this book first to read it.",
						"info",
					);
					return;
				}
				const result = await openDownloadedBook(book);
				if (result === "opened") {
					addToHistory(book.id, "book");
					return;
				}
				if (result === "not_found") {
					showToast(
						settingsLanguage === "hi"
							? "किताब की फ़ाइल नहीं मिली, कृपया फिर से डाउनलोड करें।"
							: "Book file not found. Please download it again.",
						"error",
					);
					return;
				}
				// "no_viewer" / "error": fall through to the in-app reader.
			}

			window.history.pushState({ view: "book" }, "");
			addToHistory(book.id, "book");
			setSelectedBook(book);
		} else {
			showToast(
				settingsLanguage === "hi"
					? "पुस्तक अभी उपलब्ध नहीं है।"
					: "Book is not available right now.",
			);
		}
	};

	const handleDownloadedItemSelect = (item: any) => {
		if (item.fileName) handleOpenBook(item as Book);
		else if (item.description && item.date)
			handleOpenLecture(item as LectureData);
		else handleOpenReader(item as Bhajan);
	};

	const getNextBhajanId = () => {
		const maxId = bhajans.reduce((max, b) => {
			const match = b.id.match(/(\d+)/);
			const num = match ? parseInt(match[0], 10) : 0;
			return !Number.isNaN(num) && num > max ? num : max;
		}, 0);
		return `bhajan-${maxId + 1}`;
	};

	const handleAddBhajan = () => {
		window.history.pushState({ view: "reader" }, "");
		setIsNewBhajan(true);
		setSelectedBhajan({
			id: getNextBhajanId(),
			title: "New",
			titleIAST: "New",
			content: "",
			contentIAST: "",
			firstLine: "",
			firstLineIAST: "",
			searchIndex: "",
			searchTokens: [],
		});
		setSelectedContextQueue(undefined);
		setSelectedQueueName(undefined);
	};

	const filteredBhajans = useMemo(() => {
		if (!debouncedQuery.trim()) return bhajans;
		return bhajans
			.map((b) => ({
				bhajan: b,
				score: calculateSearchScore(b, debouncedQuery, script),
			}))
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((m) => m.bhajan);
	}, [bhajans, debouncedQuery, script]);

	const filteredBooks = useMemo(() => {
		if (!debouncedQuery.trim()) return books;
		return books
			.map((b) => ({ book: b, score: calculateBookScore(b, debouncedQuery) }))
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.book);
	}, [debouncedQuery, books]);

	const { filteredKatha, filteredKirtan } = useMemo(() => {
		const audioBhajans = bhajans
			.filter((b) => b.audio && b.audio.length > 0)
			.map((b) => ({
				id: b.id,
				title: script === "iast" ? b.titleIAST : b.title,
				description: script === "iast" ? b.contentIAST : b.content,
				date: "Kirtan",
				audio: b.audio,
			}));
		if (!debouncedQuery.trim())
			return { filteredKatha: lectures, filteredKirtan: audioBhajans };
		const scoreAndSort = (items: LectureData[]) =>
			items
				.map((l) => ({
					lecture: l,
					score: calculateLectureScore(l, debouncedQuery),
				}))
				.filter((item) => item.score > 0)
				.sort((a, b) => b.score - a.score)
				.map((item) => item.lecture);
		return {
			filteredKatha: scoreAndSort(lectures),
			filteredKirtan: scoreAndSort(audioBhajans),
		};
	}, [debouncedQuery, bhajans, lectures, script]);

	const handleOnboardingComplete = () => {
		safeLocalSet("cpbs_intro_completed", "true");
		setShowOnboarding(false);
	};

	const searchPlaceholder =
		settingsLanguage === "hi" ? "खोजें (Hinglish).." : "Search (Hinglish)...";

	return (
		<>
			{!isSplashRemoved && (
				<div
					className="fixed inset-0 z-[100] origin-center pointer-events-none"
					style={{
						transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)",
						opacity: isSplashAnimatingOut ? 0 : 1,
						// Keep capturing touches while the splash is opaque: the main app
						// below is rendered at opacity 0 once mainAppMounted flips, and
						// letting taps through would hit invisible controls.
						// (Note: this does NOT affect the device screen timeout —
						// Android resets that at input dispatch, before the event ever
						// reaches the WebView.)
						pointerEvents: isSplashAnimatingOut ? "none" : "auto",
					}}
				>
					<SplashScreen isAnimatingOut={isSplashAnimatingOut} />
				</div>
			)}

			{mainAppMounted && (
				<div
					className="flex flex-col h-[100dvh] bg-ry-sand dark:bg-[#1a0505] overflow-hidden relative origin-bottom shadow-2xl"
					style={{
						transition: "opacity 400ms ease-out",
						opacity: !isSplashAnimatingOut && !isSplashRemoved ? 0 : 1,
					}}
				>
					{!devMode && !isAdminPanelOpen && <SmartAppBanner />}
					<NotificationsPermissionScreen
						isVisible={notificationPermissionDenied}
					/>
					<Suspense
						fallback={
							<div className="fixed inset-0 z-[80] bg-paper dark:bg-slate-900 flex items-center justify-center">
								<Loader2 className="w-10 h-10 text-saffron-500 animate-spin" />
							</div>
						}
					>
						{forceUpdateConfig && (
							<ForceUpdateScreen config={forceUpdateConfig} />
						)}
					</Suspense>
					{forceOtaUpdate && (
						<ForceOtaUpdateScreen progress={forceOtaProgress} />
					)}

					{!selectedBhajan && currentBhajan && activeTab !== "lectures" && (
						<MiniPlayer onExpand={(bhajan) => handleOpenReader(bhajan)} />
					)}
					<DownloadManager />
					<DownloadConfirmModal confirmation={downloadConfirmation} />
					<AppUpdaterScreen
						isOpen={isUpdaterOpen}
						settingsLanguage={settingsLanguage}
						onClose={() => setIsUpdaterOpen(false)}
						onTriggerManualOtaUpdate={handleTriggerManualOtaUpdate}
					/>
					<SideMenu
						isOpen={isSideMenuOpen}
						onClose={goBack}
						onOpenAbout={() => {
							window.history.pushState({ isPopup: true, view: "about" }, "");
							setIsAboutOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenDonate={() => {
							window.history.pushState({ isPopup: true, view: "donate" }, "");
							setIsDonateOpen(true);
							setIsSideMenuOpen(false);
						}}
						onHome={() => {
							setTabHistory(["home"]);
							setActiveTab("home");
							goBack();
						}}
						onOpenDownloaded={() => {
							window.history.replaceState({ view: "tab-downloaded" }, "");
							handleTabChange("downloaded");
							setIsSideMenuOpen(false);
						}}
						onOpenDailyQuotes={() => {
							window.history.pushState({ isPopup: true, view: "quotes" }, "");
							setIsDailyQuotesOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenDailyInfo={() => {
							window.history.pushState({ isPopup: true, view: "info" }, "");
							setIsDailyInfoOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenEvents={() => {
							window.history.pushState({ isPopup: true, view: "events" }, "");
							setIsEventsOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenDailyDarshan={() => {
							window.history.pushState({ isPopup: true, view: "darshan" }, "");
							setIsDailyDarshanOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenSevaCenter={() => {
							window.history.pushState({ isPopup: true, view: "seva" }, "");
							setIsSevaCenterOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenTempleTimings={() => {
							window.history.pushState(
								{ isPopup: true, view: "temple-timings" },
								"",
							);
							setSelectedTempleId(undefined);
							setIsTempleTimingsOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenPrivacy={() => {
							window.history.pushState({ isPopup: true, view: "privacy" }, "");
							setIsPrivacyOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenTerms={() => {
							window.history.pushState({ isPopup: true, view: "terms" }, "");
							setIsTermsOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenInformation={() => {
							window.history.pushState(
								{ isPopup: true, view: "information" },
								"",
							);
							setIsInformationOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenOnboarding={() => {
							window.history.pushState(
								{ isPopup: true, view: "onboarding" },
								"",
							);
							setShowOnboarding(true);
							setIsSideMenuOpen(false);
						}}
						onOpenSettings={() => {
							window.history.pushState({ isPopup: true, view: "settings" }, "");
							setIsSettingsOpen(true);
							setIsSideMenuOpen(false);
						}}
						onOpenProfile={() => {
							window.history.pushState({ isPopup: true, view: "profile" }, "");
							setIsProfileOpen(true);
							setIsSideMenuOpen(false);
						}}
						scrollBarSide={scrollBarSide}
						settingsLanguage={settingsLanguage}
						hasNewOtaUpdate={hasNewOtaUpdate}
						onOpenUpdater={() => setIsUpdaterOpen(true)}
					/>
					<Suspense
						fallback={
							<div className="fixed inset-0 z-[60] bg-paper dark:bg-slate-900 flex items-center justify-center">
								<Loader2 className="w-10 h-10 text-saffron-500 animate-spin" />
							</div>
						}
					>
						{showOnboarding && (
							<OnboardingScreen onComplete={handleOnboardingComplete} />
						)}
						{isSettingsOpen && (
							<SettingsScreen
								isOpen={isSettingsOpen}
								onClose={goBack}
								uiScale={uiScale}
								onUiScaleChange={setUiScale}
								script={script}
								onScriptChange={setScript}
								darkMode={darkMode}
								onThemeChange={handleThemeChange}
								themeMode={themeMode}
								onThemeModeChange={setThemeMode}
								keepAwake={keepAwake}
								onKeepAwakeChange={setKeepAwake}
								settingsLanguage={settingsLanguage}
								onSettingsLanguageChange={setSettingsLanguage}
								scrollBarSide={scrollBarSide}
								onScrollBarSideChange={setScrollBarSide}
								azSliderSide={azSliderSide}
								onAzSliderSideChange={setAzSliderSide}
								indexMode={indexMode}
								themeColor={themeColor}
								onThemeColorChange={setThemeColor}
								hapticsEnabled={hapticsEnabled}
								onHapticsEnabledChange={setHapticsEnabled}
								devMode={devMode}
								onDevModeChange={setDevMode}
								onResetData={resetData}
								allBhajans={allBhajans}
								onImportData={importData}
								onAddBhajan={handleAddBhajan}
								allBooks={allBooks}
								allLectures={allLectures}
								events={events}
								onUpdateBhajans={setBhajans}
								onUpdateBooks={setBooks}
								onUpdateLectures={setLectures}
								onUpdateEvents={setEvents}
							/>
						)}
						{isAboutOpen && (
							<AboutScreen
								isOpen={isAboutOpen}
								onClose={goBack}
								onOpenDonate={() => {
									window.history.pushState(
										{ isPopup: true, view: "donate" },
										"",
									);
									setIsDonateOpen(true);
									setIsAboutOpen(false);
								}}
								onOpenSevaCenter={() => {
									window.history.pushState({ isPopup: true, view: "seva" }, "");
									setIsSevaCenterOpen(true);
									setIsAboutOpen(false);
								}}
								settingsLanguage={settingsLanguage}
							/>
						)}
						{isDonateOpen && (
							<DonateScreen
								isOpen={isDonateOpen}
								onClose={goBack}
								settingsLanguage={settingsLanguage}
							/>
						)}
						{isDailyQuotesOpen && (
							<DailyQuotes
								onBack={goBack}
								scrollBarSide={scrollBarSide}
								devMode={devMode}
							/>
						)}
						{isEventsOpen && (
							<EventsScreen
								onBack={goBack}
								scrollBarSide={scrollBarSide}
								settingsLanguage={settingsLanguage}
								events={events}
							/>
						)}
						{isDailyDarshanOpen && (
							<DailyDarshanScreen
								onBack={goBack}
								scrollBarSide={scrollBarSide}
								onOpenProfile={() => {
									if (!isProfileOpen) {
										window.history.pushState(
											{ isPopup: true, view: "profile" },
											"",
										);
										setIsProfileOpen(true);
									}
								}}
								initialMandalTarget={notifMandalTarget}
								onMandalTargetConsumed={() => setNotifMandalTarget(null)}
							/>
						)}
						{isSevaCenterOpen && (
							<SevaCenterScreen
								onBack={goBack}
								scrollBarSide={scrollBarSide}
								settingsLanguage={settingsLanguage}
								onOpenDonate={() => {
									window.history.pushState(
										{ isPopup: true, view: "donate" },
										"",
									);
									setIsDonateOpen(true);
									setIsSevaCenterOpen(false);
								}}
								onOpenTempleTimings={(mandalId?: string) => {
									window.history.pushState(
										{ isPopup: true, view: "temple-timings" },
										"",
									);
									setSelectedTempleId(mandalId);
									setIsTempleTimingsOpen(true);
								}}
							/>
						)}
						{isTempleTimingsOpen && (
							<TempleTimingsScreen
								onBack={goBack}
								scrollBarSide={scrollBarSide}
								settingsLanguage={settingsLanguage}
								initialMandalId={selectedTempleId}
							/>
						)}
						{(isActivitiesOpen || isActivitiesPhotosOpen) && (
							<ActivitiesScreen
								onBack={goBack}
								initialShowPhotos={isActivitiesPhotosOpen}
								onOpenProfile={() => {
									if (!isProfileOpen) {
										window.history.pushState(
											{ isPopup: true, view: "profile" },
											"",
										);
										setIsProfileOpen(true);
									}
								}}
								initialMandalTarget={notifMandalTarget}
								onMandalTargetConsumed={() => setNotifMandalTarget(null)}
							/>
						)}
						{isPrivacyOpen && (
							<PrivacyPolicyScreen
								onBack={goBack}
								scrollBarSide={scrollBarSide}
								settingsLanguage={settingsLanguage}
							/>
						)}
						{isTermsOpen && (
							<TermsOfServiceScreen
								onBack={goBack}
								scrollBarSide={scrollBarSide}
								settingsLanguage={settingsLanguage}
							/>
						)}
						{isInformationOpen && informationData && (
							<InformationScreen
								data={informationData}
								onBack={goBack}
								settingsLanguage={settingsLanguage}
								initialItemId={notifInfoItemId}
								onInitialItemConsumed={() => setNotifInfoItemId(null)}
							/>
						)}
						{isVideosOpen && (
							<VideosScreen
								onClose={closeVideos}
								scrollBarSide={scrollBarSide}
								onOpenProfile={() => {
									if (!isProfileOpen) {
										window.history.pushState(
											{ isPopup: true, view: "profile" },
											"",
										);
										setIsProfileOpen(true);
									}
								}}
							/>
						)}
						{isGuruMaharajOpen && <GuruMaharajScreen onBack={goBack} />}
						{isVirahiMaharajOpen && <VirahiMaharajScreen onBack={goBack} />}
						{isProfileOpen && <ProfileScreen onClose={goBack} />}
						{isYouTubeOpen && (
							<YouTubeScreen
								onBack={goBack}
								settingsLanguage={settingsLanguage}
							/>
						)}
						{isFacebookOpen && (
							<FacebookScreen
								onBack={goBack}
								settingsLanguage={settingsLanguage}
							/>
						)}
						{isInstagramOpen && (
							<InstagramScreen
								onBack={goBack}
								settingsLanguage={settingsLanguage}
							/>
						)}
						{showQuotePopup && (
							<QuotePopup
								preloadedUrl={showQuotePopup}
								onClose={() => setShowQuotePopup(false)}
								onOpenFull={() => {
									window.history.pushState(
										{ isPopup: true, view: "quotes" },
										"",
									);
									setShowQuotePopup(false);
									setIsDailyQuotesOpen(true);
								}}
							/>
						)}
						{selectedBhajan && (
							<BhajanReader
								bhajan={selectedBhajan}
								onBack={goBack}
								fontSize={fontSize}
								onChangeFontSize={setFontSize}
								searchQuery={debouncedQuery}
								script={script}
								darkMode={darkMode}
								onToggleTheme={() => handleThemeChange(!darkMode)}
								keepAwake={keepAwake}
								devMode={devMode}
								scrollBarSide={scrollBarSide}
								onSave={saveBhajanLocally}
								autoEdit={isNewBhajan}
								activeDownloads={activeDownloads}
								onDownloadTrack={downloadTrack}
								playlists={playlists}
								onAddToPlaylist={addToPlaylist}
								onRemoveFromPlaylist={removeFromPlaylist}
								onCreatePlaylist={createPlaylist}
								contextQueue={selectedContextQueue}
								queueName={selectedQueueName}
								settingsLanguage={settingsLanguage}
								onOpenAudioScreen={() => {
									goBack();
									setTimeout(() => {
										handleTabChange("lectures");
									}, 50);
								}}
							/>
						)}
						{selectedBook && (
							<BookReader
								book={selectedBook}
								onBack={goBack}
								scrollBarSide={scrollBarSide}
								settingsLanguage={settingsLanguage}
							/>
						)}
						{activeTab === "downloaded" && (
							<div className="fixed inset-0 z-40 bg-white dark:bg-slate-900 animate-slide-in-bottom landscape:pl-[calc(16rem+env(safe-area-inset-left))]">
								<DownloadedList
									allBhajans={allBhajans}
									onSelect={handleDownloadedItemSelect}
									onBack={() => {
										if (
											window.history.state?.view === "downloaded" ||
											window.history.state?.view?.startsWith("tab-")
										)
											popHistory();
										else {
											setTabHistory(["home"]);
											setActiveTab("home");
											setAnimDirection("left");
										}
									}}
									script={script}
									scrollBarSide={scrollBarSide}
								/>
							</div>
						)}
					</Suspense>
					<Header
						onOpenMenu={() => {
							window.history.pushState({ isPopup: true, view: "menu" }, "");
							setIsSideMenuOpen(true);
						}}
						onOpenSettings={() => {
							window.history.pushState({ isPopup: true, view: "settings" }, "");
							setIsSettingsOpen(true);
						}}
						onOpenProfile={() => {
							if (!isProfileOpen) {
								window.history.pushState(
									{ isPopup: true, view: "profile" },
									"",
								);
								setIsProfileOpen(true);
							}
						}}
					/>
					{showLandscapeSearch && (
						<div className="fixed top-2 left-20 right-20 landscape:left-[17rem] z-40 bg-white/95 dark:bg-slate-800/95 p-2 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 border border-slate-200 dark:border-slate-700">
							<Search
								className="shrink-0 text-slate-400 dark:text-ink-400 ml-2"
								size={20}
							/>
							<input
								className="flex-1 min-w-0 bg-transparent outline-none py-2 text-slate-900 dark:text-white"
								placeholder={searchPlaceholder}
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
							<VoiceSearchButton
								onResult={(text) => {
									setSearchQuery(text);
									setShowRecentSearches(false);
								}}
							/>
							<button
								onClick={() => {
									setShowLandscapeSearch(false);
									setShowRecentSearches(false);
								}}
								className="shrink-0 p-2 text-slate-400 dark:text-ink-400 hover:text-red-500"
							>
								<X size={20} />
							</button>
						</div>
					)}
					<main
						ref={mainScrollRef}
						className={`relative z-10 flex-1 overflow-y-auto w-full max-w-3xl mx-auto scroll-container pt-[var(--header-offset)] landscape:pt-[env(safe-area-inset-top)] ${activeTab === "lectures" ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : "pb-[calc(6rem+env(safe-area-inset-bottom))]"} landscape:pl-[calc(16rem+env(safe-area-inset-left))] landscape:pr-[calc(5rem+env(safe-area-inset-right))] landscape:max-w-none ${scrollBarSide === "left" ? "left-scrollbar" : ""}`}
						style={
							{
								"--header-offset": `calc(${headerHeightRem}rem + env(safe-area-inset-top))`,
							} as React.CSSProperties
						}
					>
						<div
							key={activeTab}
							className={
								animDirection === "right"
									? "animate-slide-in-right"
									: animDirection === "left"
										? "animate-slide-in-left"
										: ""
							}
						>
							{activeTab === "home" && (
								<HomeScreen
									onOpenDailyQuotes={hsOpenDailyQuotes}
									onOpenDailyInfo={hsOpenDailyInfo}
									onOpenInformation={hsOpenInformation}
									onOpenEvents={hsOpenEvents}
									onOpenDailyDarshan={hsOpenDailyDarshan}
									onOpenSevaCenter={hsOpenSevaCenter}
									onOpenActivities={hsOpenActivities}
									onOpenYouTube={hsOpenYouTube}
									onOpenFacebook={hsOpenFacebook}
									onOpenInstagram={hsOpenInstagram}
									onOpenDonate={hsOpenDonate}
									onOpenBhajanList={hsOpenBhajanList}
									onOpenAbout={hsOpenAbout}
									onOpenOnboarding={hsOpenOnboarding}
									onOpenGuruMaharaj={hsOpenGuruMaharaj}
									onOpenVirahiMaharaj={hsOpenVirahiMaharaj}
									onOpenTempleTimings={hsOpenTempleTimings}
									onOpenSettings={hsOpenSettings}
									onOpenProfile={hsOpenProfile}
									onOpenPrivacy={hsOpenPrivacy}
									onOpenVideos={hsOpenVideos}
									onOpenPhotos={hsOpenPhotos}
									settingsLanguage={settingsLanguage}
									isActive={activeTab === "home"}
									onNavigate={hsNavigate}
									onOpenDeepLink={hsOpenDeepLink}
								/>
							)}
							{activeTab === "songs" && (
								<BhajanList
									bhajans={filteredBhajans}
									onSelect={(b) => {
										const queue: BhajanAudio[] = [];
										filteredBhajans.forEach((bh) => {
											if (bh.audio?.length)
												queue.push({
													...bh.audio[0],
													bhajanTitle: bh.title,
													parentBhajan: bh,
												});
										});
										handleOpenReader(
											b,
											queue.length ? queue : undefined,
											"Song List",
										);
									}}
									searchQuery={searchQuery}
									onSearchChange={setSearchQuery}
									script={script}
									indexMode={indexMode}
									onIndexModeChange={setIndexMode}
									azSliderSide={azSliderSide}
									playlists={playlists}
									onCreatePlaylist={createPlaylist}
									scrollBarSide={scrollBarSide}
									settingsLanguage={settingsLanguage}
									onSettingsLanguageChange={setSettingsLanguage}
									isSyncing={isBhajanSyncing}
									syncProgress={bhajanSyncProgress}
									onRetrySync={retryBhajanSync}
								/>
							)}
							{activeTab === "books" && (
								<BookList
									books={filteredBooks}
									onSelect={handleOpenBook}
									searchQuery={debouncedQuery}
									rawSearchQuery={searchQuery}
									onSearchChange={setSearchQuery}
									activeDownloads={activeDownloads}
									onDownload={downloadBook}
									onCancelDownload={cancelDownload}
									settingsLanguage={settingsLanguage}
									isSyncing={isBookSyncing}
									syncProgress={bookSyncProgress}
									onRetrySync={retryBookSync}
								/>
							)}
							{activeTab === "lectures" && (
								<AudioScreen
									bhajans={filteredBhajans}
									onOpenBhajan={handleOpenReader}
									script={script}
									searchQuery={debouncedQuery}
									rawSearchQuery={searchQuery}
									onSearchChange={setSearchQuery}
									playlists={playlists}
									onCreatePlaylist={createPlaylist}
									onDeletePlaylist={deletePlaylist}
									onRemoveFromPlaylist={removeFromPlaylist}
									scrollBarSide={scrollBarSide}
									settingsLanguage={settingsLanguage}
									onSettingsLanguageChange={setSettingsLanguage}
									katha={filteredKatha}
									kirtan={filteredKirtan}
									activeDownloads={activeDownloads}
									onDownloadTrack={downloadTrack}
									onOpenLecture={handleOpenLecture}
									isSyncing={isLectureSyncing}
									bhajanSyncProgress={bhajanSyncProgress}
									lectureSyncProgress={lectureSyncProgress}
									onRetryKirtanSync={retryBhajanSync}
									onRetryKathaSync={retryLectureSync}
								/>
							)}
							{activeTab === "library" && (
								<HistoryAuthorsScreen
									historyItems={historyItems}
									books={books}
									lectures={lectures}
									bhajans={bhajans}
									onClearHistory={clearHistory}
									onOpenBook={handleOpenBook}
									onOpenLecture={handleOpenLecture}
									onOpenBhajan={handleOpenReader}
									script={script}
									searchQuery={debouncedQuery}
									scrollBarSide={scrollBarSide}
									settingsLanguage={settingsLanguage}
									onSettingsLanguageChange={setSettingsLanguage}
								/>
							)}
						</div>
					</main>
					<BottomNav
						activeTab={activeTab === "downloaded" ? "songs" : activeTab}
						onTabChange={handleTabChange}
						devMode={devMode}
						settingsLanguage={settingsLanguage}
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
					/>
					<TourHost />
				</div>
			)}
		</>
	);
};

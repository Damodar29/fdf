import { markDeepLinkNavigation } from "../src/tour/tourBus";
import type { AppTab } from "../types";
import {
	applyShareTargetToUrl,
	parseSharePath,
	shareTargetScreen,
} from "./shareLinks";

export interface NavigationCallbacks {
	setActiveTab: (tab: AppTab) => void;
	setTabHistory: (history: AppTab[]) => void;
	setAnimDirection: (dir: "left" | "right" | "none") => void;
	setIsDailyQuotesOpen: (open: boolean) => void;
	setIsEventsOpen: (open: boolean) => void;
	setIsDailyDarshanOpen: (open: boolean) => void;
	setIsSevaCenterOpen: (open: boolean) => void;
	setIsActivitiesOpen: (open: boolean) => void;
	setIsInformationOpen: (open: boolean) => void;
	setIsGuruMaharajOpen: (open: boolean) => void;
	setIsVirahiMaharajOpen: (open: boolean) => void;
	setIsAboutOpen: (open: boolean) => void;
	setIsDonateOpen: (open: boolean) => void;
	setIsPrivacyOpen: (open: boolean) => void;
	setIsSettingsOpen: (open: boolean) => void;
	setShowOnboarding: (open: boolean) => void;
	setIsDailyInfoOpen: (open: boolean) => void;
	setIsYoutubeOpen: (open: boolean) => void;
	setIsTempleTimingsOpen: (open: boolean) => void;
	setIsVideosOpen: (open: boolean) => void;
	setIsProfileOpen: (open: boolean) => void;
	setIsActivitiesPhotosOpen: (open: boolean) => void;
	handleDeepLink?: (id: string, type?: "bhajan" | "lecture") => void;
	/** Called when a mandal_darshan or mandal_activity notification is tapped */
	setNotifMandalTarget?: (
		target: { mandalId: string; date: string } | null,
	) => void;
	/** Called when an information notification is tapped */
	setNotifInfoItemId?: (id: string | null) => void;
}

const PROCESSED_NOTIFICATIONS_KEY = "cpbs_processed_notification_ids";

const getNotificationSignature = (data: any): string => {
	if (!data) return "";
	const messageId =
		data["google.message_id"] ||
		data.google?.message_id ||
		data.messageId ||
		data.id;
	if (messageId) {
		return `id_${messageId}`;
	}
	const parts = [
		data.action_type || data.action || data.type || "",
		data.target_screen || data.screen || "",
		data.target_link || data.link || "",
		data.target_mandal || "",
		data.target_date || "",
		data.target_info_id || "",
		data.bhajanId || "",
		data.lectureId || "",
		data.videoId || "",
	];
	const body = data.body || data["gcm.notification.body"] || "";
	const title = data.title || data["gcm.notification.title"] || "";
	if (body || title) {
		parts.push(`${title}_${body}`);
	} else {
		// Include today's date so notifications without unique text can trigger once per day
		parts.push(new Date().toISOString().slice(0, 10));
	}
	return parts.filter(Boolean).join("||");
};

const isNotificationAlreadyProcessed = (signature: string): boolean => {
	if (!signature) return false;
	try {
		const raw = localStorage.getItem(PROCESSED_NOTIFICATIONS_KEY);
		const processedMap: Record<string, number> = raw ? JSON.parse(raw) : {};
		const lastTimestamp = processedMap[signature];
		if (lastTimestamp) {
			// Ignore if this exact notification was already processed within the last 18 hours
			if (Date.now() - lastTimestamp < 18 * 60 * 60 * 1000) {
				return true;
			}
		}
	} catch (e) {
		console.error("[NotificationActionHandler] Storage check error:", e);
	}
	return false;
};

const markNotificationProcessed = (signature: string): void => {
	if (!signature) return;
	try {
		const raw = localStorage.getItem(PROCESSED_NOTIFICATIONS_KEY);
		const processedMap: Record<string, number> = raw ? JSON.parse(raw) : {};
		processedMap[signature] = Date.now();

		const now = Date.now();
		const pruned: Record<string, number> = {};
		Object.entries(processedMap).forEach(([key, timestamp]) => {
			if (now - timestamp < 24 * 60 * 60 * 1000) {
				pruned[key] = timestamp;
			}
		});
		localStorage.setItem(PROCESSED_NOTIFICATIONS_KEY, JSON.stringify(pruned));
	} catch (e) {
		console.error("[NotificationActionHandler] Storage save error:", e);
	}
};

export const handleNotificationClick = (
	data: any,
	callbacks: NavigationCallbacks,
) => {
	if (!data) return;

	// ── Deduplicate stale push/launch notifications ─────────────────────────
	// Prevents the app from re-opening the last clicked notification screen
	// when the user closes and freshly re-opens the app.
	const signature = getNotificationSignature(data);
	if (signature && isNotificationAlreadyProcessed(signature)) {
		console.log(
			"[NotificationActionHandler] Ignoring already processed notification:",
			signature,
		);
		return;
	}
	if (signature) {
		markNotificationProcessed(signature);
	}
	// The screen this opens should not start its guided-tour chapter on top of
	// the content the person came for; it runs on a later visit instead.
	markDeepLinkNavigation();

	// Handle legacy information type
	if (data.type === "information") {
		window.history.pushState({ isPopup: true, view: "information" }, "");
		callbacks.setIsInformationOpen(true);
		return;
	}

	// ── Mandal photo upload notifications ──
	// action_type = 'mandal_darshan' or 'mandal_activity'
	// Carries: target_mandal (mandalId), target_date (YYYY-MM-DD)
	if (
		data.action_type === "mandal_darshan" ||
		data.action_type === "mandal_activity"
	) {
		const mandalId: string = data.target_mandal || "";
		const date: string = data.target_date || "";
		if (mandalId) {
			callbacks.setNotifMandalTarget?.({ mandalId, date });
		}
		const view =
			data.action_type === "mandal_darshan" ? "darshan" : "activities";
		window.history.pushState({ isPopup: true, view }, "");
		if (data.action_type === "mandal_darshan") {
			callbacks.setIsDailyDarshanOpen(true);
		} else {
			callbacks.setIsActivitiesOpen(true);
		}
		return;
	}

	// Handle new action types
	const actionType = data.action_type;

	if (actionType === "link" && data.target_link) {
		try {
			const url = new URL(data.target_link);
			const isOurDomain =
				url.hostname === "chaitanyaprembhakti.org" ||
				url.hostname === "www.chaitanyaprembhakti.org";

			if (isOurDomain) {
				const bhajanId = url.searchParams.get("bhajanId");
				const lectureId = url.searchParams.get("lectureId");
				if (bhajanId && callbacks.handleDeepLink) {
					callbacks.handleDeepLink(bhajanId, "bhajan");
					return;
				} else if (lectureId && callbacks.handleDeepLink) {
					callbacks.handleDeepLink(lectureId, "lecture");
					return;
				}

				const videoFolder = url.searchParams.get("videoFolder");
				const videoId = url.searchParams.get("videoId");

				// A /v/... share link: same parser as links opened in the app.
				const share = parseSharePath(url.pathname);
				if (share) {
					applyShareTargetToUrl(share);
					if (shareTargetScreen(share) === "videos")
						callbacks.setIsVideosOpen(true);
					else callbacks.setIsActivitiesOpen(true);
					return;
				}

				if (videoFolder || videoId) {
					const newUrl = new URL(window.location.href);
					if (videoFolder) newUrl.searchParams.set("videoFolder", videoFolder);
					if (videoId) newUrl.searchParams.set("videoId", videoId);
					window.history.replaceState(
						window.history.state,
						"",
						newUrl.toString(),
					);
					callbacks.setIsVideosOpen(true);
					return;
				}

				// ?screen=profile etc. — open that screen in the app, not a new tab.
				const screen = url.searchParams.get("screen");
				if (screen) {
					handleNotificationClick(
						{ action_type: "screen", target_screen: screen },
						callbacks,
					);
					return;
				}
			}
		} catch (_e) {}
		window.open(data.target_link, "_blank", "noopener,noreferrer");
		return;
	}

	if (actionType === "screen" && data.target_screen) {
		const screen = data.target_screen;

		// Handle main tabs
		if (["home", "songs", "lectures", "books", "library"].includes(screen)) {
			callbacks.setAnimDirection("right");
			callbacks.setActiveTab(screen as AppTab);
			callbacks.setTabHistory(["home", screen as AppTab]);
			return;
		}

		// Handle downloaded list specially as it acts like a tab but is a view
		if (screen === "downloaded") {
			window.history.replaceState({ view: "downloaded" }, "");
			callbacks.setActiveTab("downloaded" as any); // Casting as any since 'downloaded' might not be in AppTab type strictly but handled in App.tsx
			return;
		}

		// Handle modal screens
		window.history.pushState({ isPopup: true, view: screen }, "");

		switch (screen) {
			case "quotes":
				callbacks.setIsDailyQuotesOpen(true);
				break;
			case "events":
				callbacks.setIsEventsOpen(true);
				break;
			case "darshan":
				callbacks.setIsDailyDarshanOpen(true);
				break;
			case "seva":
				callbacks.setIsSevaCenterOpen(true);
				break;
			case "activities":
				callbacks.setIsActivitiesOpen(true);
				break;
			case "information":
				if (data.target_info_id) {
					callbacks.setNotifInfoItemId?.(data.target_info_id);
				}
				callbacks.setIsInformationOpen(true);
				break;
			case "guru-maharaj":
				callbacks.setIsGuruMaharajOpen(true);
				break;
			case "virahi-maharaj":
				callbacks.setIsVirahiMaharajOpen(true);
				break;
			case "about":
				callbacks.setIsAboutOpen(true);
				break;
			case "donate":
				callbacks.setIsDonateOpen(true);
				break;
			case "privacy":
				callbacks.setIsPrivacyOpen(true);
				break;
			case "settings":
				callbacks.setIsSettingsOpen(true);
				break;
			case "onboarding":
				callbacks.setShowOnboarding(true);
				break;
			case "info":
				callbacks.setIsDailyInfoOpen(true);
				break;
			case "youtube":
				callbacks.setIsYoutubeOpen(true);
				break;
			case "temple-timings":
				callbacks.setIsTempleTimingsOpen(true);
				break;
			case "videos":
				callbacks.setIsVideosOpen(true);
				break;
			case "profile":
				callbacks.setIsProfileOpen(true);
				break;
			case "photos":
				callbacks.setIsActivitiesPhotosOpen(true);
				break;
		}
	}
};

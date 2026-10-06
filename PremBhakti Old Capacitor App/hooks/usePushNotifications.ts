/**
 * usePushNotifications.ts
 *
 * Handles all push notification concerns on native platforms:
 *  - Initial setup (FCM / Push permissions)
 *  - Consuming pending launch notification actions
 *  - Listening for BigPicture notification actions while app is open
 *  - Re-checking permission when app comes to foreground
 */

import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useEffect, useRef } from "react";
import BigPictureNotification from "../services/BigPictureNotification";
import { setupPushNotifications } from "../services/firebase";
import type { AppTab } from "../types";
import { handleNotificationClick } from "../utils/NotificationActionHandler";
import { NotificationService } from "../utils/notificationService";

interface UseNotificationCallbacks {
	setIsDailyQuotesOpen: (v: boolean) => void;
	setIsInformationOpen: (v: boolean) => void;
	setActiveTab: (tab: AppTab) => void;
	setTabHistory: (tabs: any) => void;
	setAnimDirection: (d: "left" | "right" | "none") => void;
	setIsEventsOpen: (v: boolean) => void;
	setIsDailyDarshanOpen: (v: boolean) => void;
	setIsSevaCenterOpen: (v: boolean) => void;
	setIsActivitiesOpen: (v: boolean) => void;
	setIsGuruMaharajOpen: (v: boolean) => void;
	setIsVirahiMaharajOpen: (v: boolean) => void;
	setIsAboutOpen: (v: boolean) => void;
	setIsDonateOpen: (v: boolean) => void;
	setIsPrivacyOpen: (v: boolean) => void;
	setIsSettingsOpen: (v: boolean) => void;
	setShowOnboarding: (v: boolean) => void;
	setIsDailyInfoOpen: (v: boolean) => void;
	setIsYoutubeOpen: (v: boolean) => void;
	setIsTempleTimingsOpen: (v: boolean) => void;
	setIsVideosOpen: (v: boolean) => void;
	setIsProfileOpen: (v: boolean) => void;
	setIsActivitiesPhotosOpen: (v: boolean) => void;
	handleDeepLink: (id: string, type?: "bhajan" | "lecture") => void;
	setNotificationPermissionDenied: (v: boolean) => void;
	setNotifMandalTarget?: (
		target: { mandalId: string; date: string } | null,
	) => void;
}

export function usePushNotifications(
	callbacks: UseNotificationCallbacks,
	settingsLanguage: "en" | "hi",
) {
	// Always hold a ref to the latest callbacks so listeners don't go stale
	const callbacksRef = useRef<UseNotificationCallbacks>(callbacks);
	callbacksRef.current = callbacks;

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		// ── Native Platform (Android / iOS) ───────────────────────────────────────
		if (!Capacitor.isNativePlatform()) return;

		let bigPictureHandle: any = null;
		let appStateHandle: Promise<any> | null = null;

		const openScreenFromNotificationAction = (data: any) => {
			if (!data?.action && !data?.action_type) return;

			if (data.action === "open_quotes") {
				handleNotificationClick(
					{ action_type: "screen", target_screen: "quotes", ...data },
					callbacksRef.current,
				);
				return;
			}

			if (data.action === "open_info") {
				handleNotificationClick(
					{ action_type: "screen", target_screen: "information", ...data },
					callbacksRef.current,
				);
				return;
			}

			handleNotificationClick(
				{
					action_type:
						data.action === "open_screen"
							? "screen"
							: data.action === "open_link"
								? "link"
								: data.action_type,
					target_screen: data.screen || data.target_screen,
					target_link: data.link || data.target_link,
					...data,
				},
				callbacksRef.current,
			);
		};

		const consumePendingLaunchNotification = async () => {
			try {
				const pendingAction =
					await BigPictureNotification.consumeLaunchAction();
				if (pendingAction?.action) {
					openScreenFromNotificationAction(pendingAction);
				}
			} catch (e) {
				console.error("[PushNotifications] Failed to consume launch action", e);
			}
		};

		const setup = async () => {
			try {
				// 1. FCM Push setup (Native only)
				const notificationGranted = await setupPushNotifications((data) => {
					handleNotificationClick(data, callbacksRef.current);
				});

				// Native Android/iOS: enforce notifications — app is blocked until granted.
				// Never block in dev/debug builds.
				const isDev = import.meta.env.DEV;
				const isDebugBuild =
					import.meta.env.MODE === "development" ||
					(window as any).__capacitor_debug__ === true;

				if (!notificationGranted && !isDev && !isDebugBuild) {
					callbacksRef.current.setNotificationPermissionDenied(true);
				} else {
					callbacksRef.current.setNotificationPermissionDenied(false);
				}

				// 2. Re-check permissions when app comes to foreground
				appStateHandle = CapApp.addListener(
					"appStateChange",
					async ({ isActive }) => {
						if (isActive) await consumePendingLaunchNotification();

						if (isActive && callbacksRef.current) {
							const permStatus = await PushNotifications.checkPermissions();
							if (permStatus.receive === "granted") {
								callbacksRef.current.setNotificationPermissionDenied(false);
							}
						}
					},
				);
			} catch (e) {
				console.error("[PushNotifications] Push setup failed", e);
			}

			try {
				// 3. Local notification infrastructure (channels, quote cache)
				await NotificationService.requestPermissions();
				await NotificationService.createChannel();

				// 4. Listen for BigPicture notification actions while app is open
				bigPictureHandle = await BigPictureNotification.addListener(
					"notificationActionPerformed",
					(data) => openScreenFromNotificationAction(data),
				);

				// 5. Consume any pending launch notification
				await consumePendingLaunchNotification();
			} catch (e) {
				console.error("[PushNotifications] Notification setup failed", e);
			}
		};

		setup();

		return () => {
			bigPictureHandle?.remove?.();
			// Remove the appStateChange listener — previously leaked because only
			// bigPictureHandle was cleaned up. Without this, each effect re-run
			// (settingsLanguage change) stacked a new foreground listener.
			appStateHandle?.then?.((h: any) => h?.remove?.())?.catch?.(() => {});
		};
	}, [settingsLanguage]);

	// ── Web Platform ───────────────────────────────────────────────────────────
	useEffect(() => {
		if (Capacitor.isNativePlatform()) return;
		if (typeof Notification === "undefined") return; // SW not supported (e.g. iOS < 16.4)

		const checkWebPermission = async () => {
			// Web users: silently try to request notification permission.
			// NEVER block the app — if denied or failed, just continue normally.
			try {
				await setupPushNotifications((data) => {
					handleNotificationClick(data, callbacksRef.current);
				});
				// Do NOT call setNotificationPermissionDenied on web — web is always unblocked.
			} catch (e) {
				console.warn("[Web Push] Silent setup failed (non-blocking):", e);
			}
		};

		checkWebPermission();

		// Listen for NOTIFICATION_CLICK messages from the service worker
		// so tapping a web push notification deep-links inside the open app.
		const handleSwMessage = (event: MessageEvent) => {
			if (event.data?.type !== "NOTIFICATION_CLICK") return;
			handleNotificationClick(event.data, callbacksRef.current);
		};

		navigator.serviceWorker?.addEventListener("message", handleSwMessage);

		return () => {
			navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
		};
	}, []);
}

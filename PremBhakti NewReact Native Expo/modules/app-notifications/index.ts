import { requireOptionalNativeModule } from "expo";
import type { EventSubscription } from "expo-modules-core";

// Native side: android/.../AppNotificationsModule.kt. Optional so the browser
// preview (and a build made before this module existed) simply has no pushes.
export type NotificationData = Record<string, string>;

const Native = requireOptionalNativeModule<{
	takeLaunchData(): NotificationData | null;
	areEnabled(): boolean;
	openSettings(): void;
	addListener(event: "onNotificationTap", listener: (data: NotificationData) => void): EventSubscription;
}>("AppNotifications");

export const hasNativeNotifications = !!Native;

/** The push the app was opened from (once), or null. */
export function takeLaunchNotification(): NotificationData | null {
	return Native?.takeLaunchData() ?? null;
}

/** A push tapped while the app was already running. */
export function addNotificationTapListener(listener: (data: NotificationData) => void): { remove(): void } {
	return Native?.addListener("onNotificationTap", listener) ?? { remove() {} };
}

/** Whether the app may show notifications (the system setting). */
export function notificationsEnabled(): boolean {
	return Native?.areEnabled() ?? true;
}

/** Opens the app's notification settings. */
export function openNotificationSettings() {
	Native?.openSettings();
}

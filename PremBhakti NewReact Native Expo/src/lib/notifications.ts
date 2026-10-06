import { doc, getFirestore, setDoc } from "@react-native-firebase/firestore";
import { getMessaging, getToken, subscribeToTopic } from "@react-native-firebase/messaging";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { create } from "zustand";
import {
	addNotificationTapListener,
	hasNativeNotifications,
	notificationsEnabled,
	takeLaunchNotification,
} from "../../modules/app-notifications";
import { openNotification } from "./appNav";
import { storage } from "./storage";

// Pushes, as the Capacitor app's usePushNotifications + setupPushNotifications:
// ask for permission at start, subscribe to the "all" topic, keep this
// device's token in fcm_tokens/android, open what a tapped push points at.
// Showing them is native (modules/app-notifications, PushMessagingService).
//
// Like the Capacitor app, the app is blocked (NotificationsGate) while
// notifications are off; it lets go as soon as they are allowed.

export const useNotificationGate = create<{ blocked: boolean }>(() => ({ blocked: false }));

/** Token steps (save, topic) are repeated when the token changes, or weekly. */
const TOKEN_REFRESH_MS = 7 * 24 * 3600_000;
const stepDue = (step: string, token: string) => {
	try {
		const saved = JSON.parse(storage.getString(`cpbs_fcm_${step}`) || "null");
		return saved?.token !== token || !(Date.now() - Number(saved?.at) < TOKEN_REFRESH_MS);
	} catch {
		return true;
	}
};
const stepDone = (step: string, token: string) => storage.set(`cpbs_fcm_${step}`, JSON.stringify({ token, at: Date.now() }));

async function askPermission(): Promise<boolean> {
	if (notificationsEnabled()) return true;
	if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
		const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => null);
		if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
	}
	return notificationsEnabled();
}

async function register() {
	const messaging = getMessaging();
	const token = await getToken(messaging);
	if (!token) return;
	if (stepDue("topic_all", token)) {
		await subscribeToTopic(messaging, "all");
		stepDone("topic_all", token);
	}
	if (stepDue("saved_android", token)) {
		await setDoc(
			doc(getFirestore(), "fcm_tokens", "android"),
			{ [token.slice(-20)]: token, updatedAt: Date.now() },
			{ merge: true },
		);
		stepDone("saved_android", token);
	}
}

let started = false;

/** Once, at app start (App.tsx). */
export function startNotifications() {
	if (started || !hasNativeNotifications) return;
	started = true;

	(async () => {
		const granted = await askPermission();
		useNotificationGate.setState({ blocked: !granted });
		if (granted) register().catch(() => {});
	})();

	// Allowed in the system settings meanwhile: let the app go and register.
	AppState.addEventListener("change", (state) => {
		if (state !== "active" || !useNotificationGate.getState().blocked) return;
		if (notificationsEnabled()) {
			useNotificationGate.setState({ blocked: false });
			register().catch(() => {});
		}
	});

	const launch = takeLaunchNotification();
	if (launch) openNotification(launch);
	addNotificationTapListener(openNotification);
	// A push tapped while the app was in the background but not killed lands as a
	// new intent; one tapped from a cold start is the launch data above.
	AppState.addEventListener("change", (state) => {
		if (state !== "active") return;
		const data = takeLaunchNotification();
		if (data) openNotification(data);
	});
}

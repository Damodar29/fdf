import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { FCM } from "@capacitor-community/fcm";
import { initializeApp } from "firebase/app";
import {
	browserLocalPersistence,
	getAuth,
	indexedDBLocalPersistence,
	initializeAuth,
} from "firebase/auth";
import {
	doc,
	initializeFirestore,
	memoryLocalCache,
	persistentLocalCache,
	persistentMultipleTabManager,
	setDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
	getMessaging,
	getToken,
	isSupported,
	onMessage,
} from "firebase/messaging";
import { getStorage } from "firebase/storage";
import { safeLocalGet, safeLocalSet } from "../utils/safeLocalSet";

/* =========================
   Firebase Configs
========================= */

// All Firebase credentials are loaded from .env — never hard-coded.
// VITE_* variables are embedded at build time by Vite but are only
// exposed via this controlled import, NOT as global strings in source.
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Alias — same project is used for both main app and functions
const mainFirebaseConfig = firebaseConfig;
const functionsFirebaseConfig = firebaseConfig;

/* =========================
   Initialize Apps
========================= */

// Initialize Main App
const app = initializeApp(mainFirebaseConfig);

// Initialize Profile App (for Devotee Login isolation)
const profileApp = initializeApp(mainFirebaseConfig, "profileApp");

// Initialize Functions App (Unique Name)
const _functionsApp = initializeApp(functionsFirebaseConfig, "functionsApp");

/* =========================
   Services
========================= */

// Use explicit persistence on ALL native platforms (Android + iOS).
// Android WebViews (e.g. Nothing Phone) lose session with default getAuth(),
// so we force indexedDBLocalPersistence for all Capacitor environments.
// Falls back to browserLocalPersistence if IndexedDB is unavailable
// (corrupted storage on low-end Samsung/Redmi/Vivo devices, full storage, etc.)
function createAuth(app: ReturnType<typeof initializeApp>) {
	if (Capacitor.isNativePlatform()) {
		try {
			return initializeAuth(app, {
				persistence: [indexedDBLocalPersistence, browserLocalPersistence],
			});
		} catch (e) {
			console.warn(
				"[Auth] indexedDBLocalPersistence failed, falling back to browserLocalPersistence:",
				e,
			);
			return initializeAuth(app, {
				persistence: [browserLocalPersistence],
			});
		}
	}
	return getAuth(app);
}

export const auth = createAuth(app);
export const profileAuth = createAuth(profileApp);

// Local `npm run dev` only: reCAPTCHA is rejected on localhost
// (auth/invalid-app-credential), so phone OTP skips app verification here.
// With this on, only the test numbers added in Firebase Console →
// Authentication → Sign-in method → Phone work. Never set in builds.
if (import.meta.env.DEV && !Capacitor.isNativePlatform()) {
	profileAuth.settings.appVerificationDisabledForTesting = true;
}

export let currentFcmToken: string | null = null;
export const getCurrentFcmToken = () => currentFcmToken;

// Callback invoked once when the FCM token first becomes available.
// AuthContext registers this to save the token to the user's profile
// even if the token arrives after the profile is already loaded.
let onFcmTokenReadyCallback: ((token: string) => void) | null = null;
export const setOnFcmTokenReady = (cb: ((token: string) => void) | null) => {
	onFcmTokenReadyCallback = cb;
	// If token is already available (e.g. hot reload) and a real callback is given, call immediately
	if (currentFcmToken && cb) cb(currentFcmToken);
};

/* =========================
   Device token bookkeeping
========================= */

// The device token lists (fcm_tokens/*) and the web "all" topic subscription
// used to be rewritten on every app start — one Firestore write, and on the web
// one Cloud Function call, per launch. The token itself rarely changes, so
// only repeat them when it did, or once a week. The weekly refresh keeps the
// admin device list current (a device deleted there comes back within a week,
// as it used to on the next launch).
const TOKEN_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const tokenStepDue = (step: string, token: string): boolean => {
	try {
		const saved = JSON.parse(safeLocalGet(`cpbs_fcm_${step}`) || "null");
		return (
			saved?.token !== token ||
			!(Date.now() - Number(saved?.at) < TOKEN_REFRESH_MS)
		);
	} catch {
		return true;
	}
};

const markTokenStepDone = (step: string, token: string) =>
	safeLocalSet(`cpbs_fcm_${step}`, JSON.stringify({ token, at: Date.now() }));

/** Adds this device's token to fcm_tokens/{platformDoc} when due. */
const saveDeviceToken = async (platformDoc: string, token: string) => {
	const step = `saved_${platformDoc}`;
	if (!tokenStepDue(step, token)) return;
	await setDoc(
		doc(db, "fcm_tokens", platformDoc),
		{ [token.slice(-20)]: token, updatedAt: Date.now() },
		{ merge: true }, // merge: true adds/updates without deleting other devices
	);
	markTokenStepDone(step, token);
	console.log(`[FCM] token saved to fcm_tokens/${platformDoc}`);
};

// Initialize main Firestore with persistent cache.
// Falls back to memory-only cache if IndexedDB is unavailable (low-RAM devices,
// private browsing, or first-cold-start race on Android WebView).
function createFirestore(app: ReturnType<typeof initializeApp>, label: string) {
	// experimentalForceLongPolling: force HTTP long-polling instead of WebSockets.
	// Only enable on native Android/iOS — some OEM network stacks block WebSocket
	// upgrades (seen on Xiaomi MIUI, OPPO ColorOS). On web, use default (WebSocket)
	// for better performance and lower battery drain.
	const forceLongPolling = Capacitor.isNativePlatform();
	try {
		return initializeFirestore(app, {
			localCache: persistentLocalCache({
				tabManager: persistentMultipleTabManager(),
			}),
			experimentalForceLongPolling: forceLongPolling,
		});
	} catch (e) {
		console.warn(
			`[Firestore] persistentLocalCache init failed for "${label}", falling back to memoryLocalCache:`,
			e,
		);
		return initializeFirestore(app, {
			localCache: memoryLocalCache(),
			experimentalForceLongPolling: forceLongPolling,
		});
	}
}

export const db = createFirestore(app, "main");
export const profileDb = createFirestore(profileApp, "profile");

// Call functions from the main app (cpbs-admin) where all functions are deployed
export const functions = getFunctions(app);
// Same project, but callables made through this carry the devotee's profileAuth
// login. Use it for anything that needs `request.auth` to be the devotee (family
// linking) — through `functions` they arrive unauthenticated.
export const profileFunctions = getFunctions(profileApp);

// Firebase Storage for fast image uploads (used by upload manager)
export const storage = getStorage(app);
export const profileStorage = getStorage(profileApp);

// Messaging for Web — safely initialized only if supported by the browser (avoids unhandled promise rejections)
export let messaging: ReturnType<typeof getMessaging> | null = null;
if (!Capacitor.isNativePlatform()) {
	isSupported()
		.then((supported) => {
			if (supported) {
				messaging = getMessaging(app);
			}
		})
		.catch(() => {
			// Silently ignore support check failures
		});
}

/* =========================
   Data Model
========================= */

export interface InformationItem {
	id: string;
	isEnabled?: boolean; // Draft/Publish toggle
	expiryDate?: number; // Auto-hide after this timestamp
	title: string;
	text: string;
	images?: string[]; // Array of unlimited images
	imageUrl?: string; // Legacy
	imageUrl2?: string; // Legacy
	imageUrl3?: string; // Legacy
	actionType?: "none" | "phone" | "location" | "link";
	actionTarget?: string;
	actionLabel?: string;
	createdAt: number;
}

export interface InformationData {
	enabled: boolean;
	items?: InformationItem[];
	// Legacy support
	title?: string;
	text?: string;
	imageUrl?: string;
	imageUrl2?: string;
	imageUrl3?: string;
}

/* =========================
   Push Notifications Setup (Keep existing)
========================= */
export const setupPushNotifications = async (
	onNotificationClick: (data: any) => void,
): Promise<boolean> => {
	if (Capacitor.isNativePlatform()) {
		try {
			let permStatus = await PushNotifications.checkPermissions();
			if (permStatus.receive === "prompt") {
				permStatus = await PushNotifications.requestPermissions();
			}
			if (permStatus.receive !== "granted") return false;

			PushNotifications.addListener("registration", async (token) => {
				console.log(`Push registration success, token: ${token.value}`);
				try {
					// Subscribe to broadcast topic
					await FCM.subscribeTo({ topic: "all" });

					// Get the actual FCM token (different from APNS/device token)
					const { token: fcmToken } = await FCM.getToken();
					currentFcmToken = fcmToken;
					onFcmTokenReadyCallback?.(fcmToken);

					// ─────────────────────────────────────────────────────────────────
					// FCM TOKEN STORAGE STRUCTURE — DO NOT CHANGE
					// Tokens are stored in separate Firestore documents per platform:
					//   fcm_tokens/android  → Android device tokens
					//   fcm_tokens/ios      → iOS device tokens
					//   fcm_tokens/web      → Web browser tokens (saved in firebase.ts web branch)
					//
					// Format per document: { [last20charsOfToken]: fullToken, updatedAt: timestamp }
					// The last-20-chars key is used to avoid Firestore field name length limits.
					// DO NOT merge these into a single document — platform separation is intentional
					// so the NotificationSender can target specific platforms independently.
					// ─────────────────────────────────────────────────────────────────
					const platform = Capacitor.getPlatform(); // 'android' or 'ios'
					await saveDeviceToken(platform, fcmToken);
				} catch (err) {
					console.error(err);
				}
			});

			PushNotifications.addListener("registrationError", (error: any) => {
				console.error("Error on registration: ", JSON.stringify(error));
			});

			PushNotifications.addListener(
				"pushNotificationReceived",
				(notification) => {
					console.log("Push received: ", JSON.stringify(notification));
				},
			);

			PushNotifications.addListener(
				"pushNotificationActionPerformed",
				(notification) => {
					console.log("Push action performed: ", JSON.stringify(notification));
					if (notification.notification.data)
						onNotificationClick(notification.notification.data);
				},
			);

			await PushNotifications.register();
			return true;
		} catch (error) {
			console.error("Error setting up push notifications: ", error);
			return false;
		}
	} else {
		// ── Web Push Notifications (Chrome, Edge, Firefox, iOS Safari PWA) ──
		try {
			const supported = await isSupported().catch(() => false);
			if (!supported) return false;
			const messagingInstance = getMessaging(app);

			// Only request permission if not yet decided. If already granted, skip prompt.
			let permission = Notification.permission;
			if (permission === "default") {
				permission = await Notification.requestPermission();
			}
			if (permission !== "granted") return false;

			// Reuse the app service worker registered by index.html. It imports the
			// Firebase messaging worker, so push and PWA updates share one scope.
			let swReg: ServiceWorkerRegistration | undefined;
			const isLocalDevHost =
				window.location.hostname === "localhost" ||
				window.location.hostname === "127.0.0.1" ||
				window.location.hostname === "::1";
			if ("serviceWorker" in navigator && !isLocalDevHost) {
				swReg = await Promise.race<ServiceWorkerRegistration | undefined>([
					navigator.serviceWorker.ready,
					new Promise((resolve) => setTimeout(() => resolve(undefined), 5000)),
				]);
				if (!swReg) {
					swReg = await navigator.serviceWorker.register("/sw.js", {
						scope: "/",
					});
				}
			}

			const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
			const token = await getToken(messagingInstance, {
				vapidKey: vapidKey || undefined,
				serviceWorkerRegistration: swReg,
			}).catch((err: any) => {
				console.warn("[Web Push] Could not retrieve token:", err);
				return null;
			});

			if (token) {
				console.log("[Web Push] Token:", token);
				currentFcmToken = token;
				onFcmTokenReadyCallback?.(token);

				// ─────────────────────────────────────────────────────────────────
				// FCM TOKEN STORAGE STRUCTURE
				// Android native tokens → fcm_tokens/android
				// iOS native tokens     → fcm_tokens/ios
				// Web tokens            → fcm_tokens/web
				// iOS Web/PWA tokens    → fcm_tokens/ios (routed here dynamically)
				// ─────────────────────────────────────────────────────────────────
				const ua = window.navigator.userAgent.toLowerCase();
				const isIOSWeb =
					/iphone|ipad|ipod/.test(ua) || /mac os|macintosh/.test(ua);
				const targetDocName = isIOSWeb ? "ios" : "web";

				await saveDeviceToken(targetDocName, token);

				// Subscribe to the 'all' broadcast topic via backend function. The
				// subscription lasts as long as the token, so this is only repeated
				// when the token changed (or weekly), not on every visit.
				try {
					if (tokenStepDue("topic_all", token)) {
						const subscribeToTopic = httpsCallable(
							getFunctions(app),
							"subscribeToTopic",
						);
						await subscribeToTopic({ token, topic: "all" });
						markTokenStepDone("topic_all", token);
						console.log("[Web Push] Subscribed to topic: all");
					}
				} catch (subErr) {
					console.warn(
						"[Web Push] Topic subscribe failed (will still receive direct messages):",
						subErr,
					);
				}
			}

			// ── Foreground message handler ─────────────────────────────────────────
			// When the app is in the foreground, Firebase suppresses the default
			// notification. We show it manually but use a stable 'tag' to prevent
			// duplicates if the same message is delivered multiple times.
			onMessage(messagingInstance, async (payload) => {
				console.log("[Web Push] Foreground message:", payload);

				const data = (payload.data || {}) as Record<string, string>;
				const notif = payload.notification || {};
				const title = data.title || notif.title || "Prem Bhakti";
				const body = data.body || notif.body || "";
				const imageUrl =
					data.image || data.imageUrl || (notif as any).image || undefined;

				if (
					"serviceWorker" in navigator &&
					Notification.permission === "granted"
				) {
					try {
						const reg = await navigator.serviceWorker.ready;
						// Use a stable tag to collapse duplicates
						const notificationTag =
							data.tag || `cpbs-notif-${title.length}-${body.length}`;

						await reg.showNotification(title, {
							body,
							icon: "/notification-icon.png",
							badge: "/notification-icon.png",
							image: imageUrl,
							data: { ...data },
							vibrate: [200, 100, 200],
							tag: notificationTag,
							requireInteraction: false,
						} as any);
					} catch (e) {
						console.warn(
							"[Web Push] Could not show foreground notification:",
							e,
						);
					}
				}
			});

			return true;
		} catch (error) {
			console.error("Error setting up web push notifications: ", error);
			return false;
		}
	}
};

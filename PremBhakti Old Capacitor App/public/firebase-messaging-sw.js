// ─── Workbox Precache Manifest ────────────────────────────────────────────────
// vite-plugin-pwa (injectManifest strategy) replaces self.__WB_MANIFEST at
// build time with the full list of hashed assets, enabling offline caching
// and automatic update when a new version is deployed.
// During development this array is empty (devOptions.enabled = false).

importScripts(
	"https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js",
);

const WB_MANIFEST = self.__WB_MANIFEST || [];
if (WB_MANIFEST.length > 0) {
	workbox.precaching.precacheAndRoute(WB_MANIFEST);
	// Clean up caches from previous SW versions automatically
	workbox.precaching.cleanupOutdatedCaches();
}

importScripts(
	"https://www.gstatic.com/firebasejs/10.15.1/firebase-app-compat.js",
);
importScripts(
	"https://www.gstatic.com/firebasejs/10.15.1/firebase-messaging-compat.js",
);

firebase.initializeApp({
	apiKey: "__VITE_FIREBASE_API_KEY__",
	authDomain: "__VITE_FIREBASE_AUTH_DOMAIN__",
	projectId: "__VITE_FIREBASE_PROJECT_ID__",
	storageBucket: "__VITE_FIREBASE_STORAGE_BUCKET__",
	messagingSenderId: "__VITE_FIREBASE_MESSAGING_SENDER_ID__",
	appId: "__VITE_FIREBASE_APP_ID__",
});

const messaging = firebase.messaging();

// ─── Background Message Handler ───────────────────────────────────────────────
// Fires when a push arrives while the page is in the BACKGROUND / CLOSED.
// For foreground notifications, see onMessage() in firebase.ts (main thread).
messaging.onBackgroundMessage((payload) => {
	console.log("[SW] Background message received:", payload);

	const data = payload.data || {};
	const notif = payload.notification || {};

	// If the payload already has a notification object, the Firebase SDK
	// will AUTOMATICALLY display a notification. We should NOT display another one,
	// or the user will get duplicate notifications.
	if (payload.notification) {
		console.log("[SW] Notification payload present, letting FCM handle it.");
		return;
	}

	const title = data.title || notif.title || "Prem Bhakti";
	const body = data.body || notif.body || "";
	const imageUrl = data.image || data.imageUrl || notif.image || undefined;

	// Use a stable tag based on title/body hash or specific data field if available
	// to prevent duplicate displays of the exact same message.
	const notificationTag =
		data.tag || `cpbs-notif-${title.length}-${body.length}`;

	const options = {
		body,
		icon: "/notification-icon.png",
		badge: "/notification-icon.png",
		image: imageUrl,
		data: { ...data },
		vibrate: [200, 100, 200],
		tag: notificationTag,
		requireInteraction: false,
	};

	return self.registration.showNotification(title, options);
});

// ─── Notification Click Handler ────────────────────────────────────────────────
// Unified deep-link navigation for Android, iOS PWA, and desktop.
self.addEventListener("notificationclick", (event) => {
	console.log("[SW] Notification clicked:", event.notification.data);
	event.notification.close();

	const data = event.notification.data || {};
	let urlToOpen = "/";

	if (data.action_type === "link" && data.target_link) {
		urlToOpen = data.target_link;
	} else if (data.action_type) {
		const params = new URLSearchParams();
		for (const key in data) {
			if (Object.hasOwn(data, key)) {
				params.append(key, data[key]);
			}
		}
		urlToOpen = `/?${params.toString()}`;
	}

	event.waitUntil(
		clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((windowClients) => {
				for (const client of windowClients) {
					try {
						const clientOrigin = new URL(client.url).origin;
						if (clientOrigin === self.location.origin && "focus" in client) {
							// Post deep-link to the open app so it can navigate internally
							client.postMessage({
								type: "NOTIFICATION_CLICK",
								...data,
							});
							return client.focus();
						}
					} catch (_) {
						/* ignore URL parse errors */
					}
				}
				if (clients.openWindow) {
					return clients.openWindow(urlToOpen);
				}
			}),
	);
});

// ─── Auto-Update: SKIP_WAITING ─────────────────────────────────────────────────
// When the main thread detects a new SW version and posts SKIP_WAITING,
// the new SW takes control immediately → page reloads → user gets latest build.
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

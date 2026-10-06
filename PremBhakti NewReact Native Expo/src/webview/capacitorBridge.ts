import { getAuth as getNativeAuth, verifyPhoneNumber } from "@react-native-firebase/auth";
import { getCrashlytics, log as crashLog, recordError } from "@react-native-firebase/crashlytics";
import { getMessaging, getToken, hasPermission, requestPermission, subscribeToTopic } from "@react-native-firebase/messaging";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "@firebase/auth";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform, Share } from "react-native";
import { type HapticType, triggerHaptic } from "../lib/haptics";
import { storage } from "../lib/storage";
import { configureGoogle, signOut as appSignOut, webAuth } from "../lib/webAuth";
import { FILE_HANDLERS, shareFile } from "./filePlugins";

// The native side of Capacitor's bridge, for the OG web screens running in a
// WebView (rollout "3B"; spec: docs/context/WEBVIEW-BRIDGE.md).
//
// The page gets Capacitor's own native-bridge.js plus `window.androidBridge`
// (WebScreen), so @capacitor/core in the OG build sees an Android app and
// routes plugin calls here as {callbackId, pluginId, methodName, options}.
// Each reply goes back through `Capacitor.fromNative`. Only plugins listed in
// PLUGIN_HEADERS exist for the page; any other plugin — or method — gets
// Capacitor's usual "not implemented" error, so the web code takes its own
// fallback instead of hanging.

type Options = Record<string, any>;

export interface BridgeContext {
	/** Sends an event to every listener the page registered for it. */
	emit: (plugin: string, event: string, data: unknown) => void;
	/** The page asked the app to close (App.exitApp). */
	exit: () => void;
	/** A push the page should open once it has registered for pushes (WebTarget `notification`). */
	takeLaunchNotification: () => Record<string, string> | undefined;
}

type Handler = (options: Options, ctx: BridgeContext) => unknown | Promise<unknown>;

class BridgeError extends Error {
	constructor(
		message: string,
		public code?: string,
	) {
		super(message);
	}
}

const noop = () => ({});
const hapticFor: Record<string, HapticType> = { LIGHT: "light", MEDIUM: "medium", HEAVY: "heavy" };
const notifyFor: Record<string, HapticType> = { SUCCESS: "success", WARNING: "warning", ERROR: "error" };
const appVersion = () => Constants.expoConfig?.version ?? "";
const PREF_PREFIX = "cap_pref:";

/** Plugin → method → handler. `addListener`/`removeListener` are handled for every plugin. */
const HANDLERS: Record<string, Record<string, Handler>> = {
	App: {
		exitApp: (_o, ctx) => ctx.exit(),
		minimizeApp: (_o, ctx) => ctx.exit(),
		getInfo: () => ({
			name: "Prem Bhakti",
			id: Constants.expoConfig?.android?.package ?? "com.cpbs.bhajans",
			build: String(Constants.expoConfig?.android?.versionCode ?? ""),
			version: appVersion(),
		}),
		getLaunchUrl: () => ({}),
		getState: () => ({ isActive: true }),
	},
	SplashScreen: { show: noop, hide: noop },
	StatusBar: {
		setStyle: noop,
		setBackgroundColor: noop,
		setOverlaysWebView: noop,
		show: noop,
		hide: noop,
		getInfo: () => ({ visible: true, style: "DEFAULT", overlays: false }),
	},
	TextZoom: { get: () => ({ value: 1 }), getPreferred: () => ({ value: 1 }), set: noop },
	ScreenOrientation: { lock: noop, unlock: noop, orientation: () => ({ type: "portrait-primary" }) },
	Haptics: {
		impact: (o) => triggerHaptic(hapticFor[o.style] ?? "medium"),
		notification: (o) => triggerHaptic(notifyFor[o.type] ?? "success"),
		vibrate: () => triggerHaptic("heavy"),
		selectionStart: noop,
		selectionChanged: () => triggerHaptic("light"),
		selectionEnd: noop,
	},
	KeepAwake: {
		keepAwake: () => activateKeepAwakeAsync("webview"),
		allowSleep: () => deactivateKeepAwake("webview"),
		isSupported: () => ({ isSupported: true }),
		isKeptAwake: () => ({ isKeptAwake: false }),
	},
	Share: {
		canShare: () => ({ value: true }),
		share: async (o) => {
			// A photo the page saved: share the file itself (imageStorage.shareImage).
			if (await shareFile(o)) return {};
			const message = [o.text, o.url].filter(Boolean).join("\n");
			const result = await Share.share({ title: o.title, message: message || o.title || "" }, { dialogTitle: o.dialogTitle });
			if (result.action === Share.dismissedAction) throw new BridgeError("Share canceled", "CANCELED");
			return { activityType: result.activityType ?? undefined };
		},
	},
	Clipboard: {
		write: async (o) => {
			await Clipboard.setStringAsync(String(o.string ?? o.url ?? o.label ?? ""));
		},
		read: async () => ({ type: "text/plain", value: await Clipboard.getStringAsync() }),
	},
	Browser: {
		open: async (o) => {
			await WebBrowser.openBrowserAsync(String(o.url)).catch(() => Linking.openURL(String(o.url)));
		},
		close: () => WebBrowser.dismissBrowser(),
	},
	Device: {
		getId: () => ({ identifier: deviceId() }),
		getInfo: () => {
			const c = Platform.constants as { Model?: string; Manufacturer?: string; Release?: string };
			return {
				platform: "android",
				operatingSystem: "android",
				osVersion: c.Release ?? String(Platform.Version),
				androidSDKVersion: Platform.Version,
				model: c.Model ?? "",
				manufacturer: c.Manufacturer ?? "",
				isVirtual: false,
				webViewVersion: "",
			};
		},
		getLanguageCode: () => ({ value: "en" }),
		getLanguageTag: () => ({ value: "en-IN" }),
		getBatteryInfo: () => ({}),
	},
	// The OG code keeps only caches here (GitHub feeds, version stamps).
	Preferences: {
		configure: noop,
		get: (o) => ({ value: storage.getString(PREF_PREFIX + o.key) ?? null }),
		set: (o) => storage.set(PREF_PREFIX + o.key, String(o.value)),
		remove: (o) => storage.remove(PREF_PREFIX + o.key),
		keys: () => ({ keys: storage.getAllKeys().filter((k) => k.startsWith(PREF_PREFIX)).map((k) => k.slice(PREF_PREFIX.length)) }),
		clear: () => {
			for (const k of storage.getAllKeys()) if (k.startsWith(PREF_PREFIX)) storage.remove(k);
		},
		migrate: () => ({ migrated: [], existing: [] }),
		removeOld: noop,
	},
	// No OTA here: the web screens update with the app.
	CapacitorUpdater: {
		notifyAppReady: () => ({ bundle: builtinBundle() }),
		current: () => ({ bundle: builtinBundle(), native: appVersion() }),
		list: () => ({ bundles: [] }),
		setMultiDelay: noop,
		getLatest: () => ({ version: "builtin" }),
	},
	Crashlytics: {
		log: (o) => crashLog(getCrashlytics(), String(o.message ?? "")),
		recordException: (o) => recordError(getCrashlytics(), new Error(String(o.message ?? "WebView error"))),
	},
	PushNotifications: {
		checkPermissions: async () => ({ receive: (await hasPermission(getMessaging())) > 0 ? "granted" : "prompt" }),
		requestPermissions: async () => ({ receive: (await requestPermission(getMessaging())) > 0 ? "granted" : "denied" }),
		register: async (_o, ctx) => {
			getToken(getMessaging())
				.then((token) => ctx.emit("PushNotifications", "registration", { value: token }))
				.catch((e: Error) => ctx.emit("PushNotifications", "registrationError", { error: e?.message ?? String(e) }));
			// The page's listeners are all added before register(), as in usePushNotifications.
			const data = ctx.takeLaunchNotification();
			if (data) {
				setTimeout(
					() =>
						ctx.emit("PushNotifications", "pushNotificationActionPerformed", {
							actionId: "tap",
							notification: { id: data["google.message_id"] ?? "", data },
						}),
					50,
				);
			}
		},
		unregister: noop,
		createChannel: noop,
		listChannels: () => ({ channels: [] }),
		getDeliveredNotifications: () => ({ notifications: [] }),
		removeAllDeliveredNotifications: noop,
	},
	FCM: {
		getToken: async () => ({ token: await getToken(getMessaging()) }),
		subscribeTo: async (o) => {
			await subscribeToTopic(getMessaging(), String(o.topic));
			return { message: `subscribed to ${o.topic}` };
		},
		unsubscribeFrom: noop,
		setAutoInit: noop,
		isAutoInitEnabled: () => ({ enabled: true }),
	},
	// Login inside a web screen (AuthContext with skipNativeAuth): the native
	// side only obtains the credential; the page signs in with it itself. The
	// app's own session follows (Google: here; phone: WebScreen picks the
	// page's session up when it appears).
	FirebaseAuthentication: {
		signInWithGoogle: async (o) => {
			configureGoogle();
			await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
			const response = await GoogleSignin.signIn();
			if (!isSuccessResponse(response)) throw new BridgeError("The user canceled the sign-in flow. (12501)", "12501");
			if (Array.isArray(o.scopes) && o.scopes.length) await GoogleSignin.addScopes({ scopes: o.scopes });
			const tokens = await GoogleSignin.getTokens();
			const idToken = response.data.idToken ?? tokens.idToken;
			if (!webAuth.currentUser && idToken) {
				await signInWithCredential(webAuth, GoogleAuthProvider.credential(idToken)).catch(() => {});
			}
			const u = response.data.user;
			return {
				user: { uid: u.id, email: u.email, displayName: u.name, photoUrl: u.photo, providerId: "google.com" },
				credential: { providerId: "google.com", idToken, accessToken: tokens.accessToken },
				additionalUserInfo: { isNewUser: false, providerId: "google.com" },
			};
		},
		signInWithPhoneNumber: (o, ctx) => {
			verifyPhoneNumber(getNativeAuth(), String(o.phoneNumber), 60, !!o.resendCode).on(
				"state_changed",
				(snap) => {
					if (snap.state === "sent") {
						ctx.emit("FirebaseAuthentication", "phoneCodeSent", { verificationId: snap.verificationId });
					} else if (snap.state === "verified") {
						ctx.emit("FirebaseAuthentication", "phoneVerificationCompleted", {
							verificationId: snap.verificationId,
							verificationCode: snap.code,
							credential: { providerId: "phone", verificationId: snap.verificationId, verificationCode: snap.code },
						});
					} else if (snap.state === "error") {
						ctx.emit("FirebaseAuthentication", "phoneVerificationFailed", { message: snap.error?.message ?? "error" });
					}
				},
				(error) => ctx.emit("FirebaseAuthentication", "phoneVerificationFailed", { message: error.message }),
			);
		},
		confirmVerificationCode: (o) => ({
			user: null,
			credential: { providerId: "phone", verificationId: o.verificationId, verificationCode: o.verificationCode },
		}),
		signOut: () => appSignOut(),
		getCurrentUser: () => ({ user: null }),
		getIdToken: async () => ({ token: (await webAuth.currentUser?.getIdToken()) ?? "" }),
		useAppLanguage: noop,
		setLanguageCode: noop,
	},
	// utils/backup/driveBackup.ts: a Drive (drive.file) access token.
	// Silent requests always fail here: the app keeps the Drive backup itself
	// (Settings, lib/driveBackup), and the page's automatic backup/restore
	// (AutoBackupManager) would otherwise upload the page's old copy of the
	// data over it, or restore into the page and reload it.
	DriveAuth: {
		authorize: async (o) => {
			if (!o.interactive) throw new BridgeError("Drive backup is kept by the app", "NEEDS_CONSENT");
			configureGoogle();
			const scopes: string[] = Array.isArray(o.scopes) ? o.scopes : [];
			let user = GoogleSignin.getCurrentUser();
			if (!user && GoogleSignin.hasPreviousSignIn()) {
				const silent = await GoogleSignin.signInSilently();
				user = silent.type === "success" ? silent.data : null;
			}
			const missing = scopes.filter((s) => !user?.scopes?.includes(s));
			if (!o.interactive && (!user || missing.length)) throw new BridgeError("Drive access not granted", "NEEDS_CONSENT");
			if (!user) {
				const signed = await GoogleSignin.signIn();
				if (!isSuccessResponse(signed)) throw new BridgeError("canceled", "CANCELED");
			}
			if (missing.length && !(await GoogleSignin.addScopes({ scopes: missing }))) throw new BridgeError("canceled", "CANCELED");
			return { accessToken: (await GoogleSignin.getTokens()).accessToken };
		},
	},
	// Filesystem, FileTransfer, NativeDownload, NativeUpload, MediaSession, BigPictureNotification.
	...FILE_HANDLERS,
};

function builtinBundle() {
	return { id: "builtin", version: "builtin", downloaded: "", checksum: "", status: "success" };
}

function deviceId() {
	let id = storage.getString(PREF_PREFIX + "__device_id");
	if (!id) {
		id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
		storage.set(PREF_PREFIX + "__device_id", id);
	}
	return id;
}

/** Capacitor's PluginHeaders for the plugins above, as its Android runtime would inject them. */
export const PLUGIN_HEADERS = Object.entries(HANDLERS).map(([name, methods]) => ({
	name,
	methods: [
		...Object.keys(methods).map((m) => ({ name: m, rtype: "promise" })),
		{ name: "addListener", rtype: "callback" },
		{ name: "removeListener", rtype: "promise" },
		{ name: "removeAllListeners", rtype: "promise" },
	],
}));

export interface BridgeCall {
	callbackId: string;
	pluginId: string;
	methodName: string;
	options?: Options;
}

export interface BridgeResult {
	callbackId: string;
	pluginId: string;
	methodName: string;
	success: boolean;
	data?: unknown;
	error?: { message: string; code?: string };
	save?: boolean;
}

/**
 * Keeps the page's event listeners and answers its plugin calls. One per
 * WebView; `send` delivers a result to the page.
 */
export class CapacitorBridge {
	private listeners = new Map<string, Set<string>>();

	constructor(
		private send: (result: BridgeResult) => void,
		private ctxBase: { exit: () => void; launchNotification?: Record<string, string> },
	) {}

	private takeLaunchNotification = () => {
		const data = this.ctxBase.launchNotification;
		this.ctxBase.launchNotification = undefined;
		return data;
	};

	/** True when the page listens for this event (e.g. App "backButton"). */
	hasListener(plugin: string, event: string) {
		return (this.listeners.get(`${plugin}:${event}`)?.size ?? 0) > 0;
	}

	emit = (plugin: string, event: string, data: unknown) => {
		for (const callbackId of this.listeners.get(`${plugin}:${event}`) ?? []) {
			this.send({ callbackId, pluginId: plugin, methodName: "addListener", success: true, data, save: true });
		}
	};

	async handle(call: BridgeCall) {
		const { callbackId, pluginId, methodName } = call;
		const options = call.options ?? {};
		const reply = (r: Partial<BridgeResult>) => {
			if (callbackId !== "-1") this.send({ callbackId, pluginId, methodName, success: true, ...r });
		};

		if (methodName === "addListener") {
			const key = `${pluginId}:${options.eventName}`;
			if (!this.listeners.has(key)) this.listeners.set(key, new Set());
			this.listeners.get(key)?.add(callbackId);
			return; // events arrive later on this callbackId
		}
		if (methodName === "removeListener") {
			this.listeners.get(`${pluginId}:${options.eventName}`)?.delete(String(options.callbackId));
			reply({ data: {} });
			return;
		}
		if (methodName === "removeAllListeners") {
			for (const key of [...this.listeners.keys()]) if (key.startsWith(`${pluginId}:`)) this.listeners.delete(key);
			reply({ data: {} });
			return;
		}

		const handler = HANDLERS[pluginId]?.[methodName];
		if (!handler) {
			reply({ success: false, error: { message: `"${pluginId}.${methodName}()" is not implemented on android`, code: "UNIMPLEMENTED" } });
			return;
		}
		try {
			const data = await handler(options, {
				emit: this.emit,
				exit: this.ctxBase.exit,
				takeLaunchNotification: this.takeLaunchNotification,
			});
			reply({ data: data && typeof data === "object" ? data : {} });
		} catch (e) {
			const err = e as { message?: string; code?: string };
			reply({ success: false, error: { message: err?.message ?? String(e), code: err?.code } });
		}
	}
}

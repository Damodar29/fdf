import { getAuth as getNativeAuth, verifyPhoneNumber } from "@react-native-firebase/auth";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { deleteApp, getApps, initializeApp } from "@firebase/app";
import {
	type Auth,
	GoogleAuthProvider,
	initializeAuth,
	PhoneAuthProvider,
	signInWithCredential,
	signOut as firebaseSignOut,
	type User,
	updateCurrentUser,
} from "@firebase/auth";
import * as firebaseAuth from "@firebase/auth";
import { WEB_FIREBASE_CONFIG } from "../config/firebaseWeb";
import { storage } from "./storage";

// Devotee login, shared with the bundled web screens.
//
// The Capacitor app's login lives in its web code (AuthContext, the
// "profileApp" Firebase app). Its Profile screen still runs as a web screen
// here, and Google refuses Google sign-in inside a WebView, so the login is
// done natively instead and handed to the web page:
//  - the session itself is a Firebase JS SDK session on the web app's config
//    and app name, so it is exactly the record the web page keeps
//    (`firebase:authUser:<apiKey>:profileApp`), written into the WebView
//    before the page starts (WebScreen) — and read back from there for
//    devotees who were logged in to the old app (data migration);
//  - the Google ID token comes from the native Google sign-in;
//  - for phone OTP the native Firebase SDK sends and checks the SMS (Play
//    Integrity / reCAPTCHA handled natively) and its verification ID is
//    redeemed by the JS SDK — the same pairing AuthContext uses on Android.

// @firebase/auth lists its plain "types" entry before the "react-native" one,
// so TypeScript never sees the React Native build Metro actually loads.
type AsyncKeyValue = {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<void>;
	removeItem(key: string): Promise<void>;
};
const { getReactNativePersistence } = firebaseAuth as typeof firebaseAuth & {
	getReactNativePersistence(storage: AsyncKeyValue): firebaseAuth.Persistence;
};

export const WEB_APP_NAME = "profileApp";
export const WEB_AUTH_KEY = `firebase:authUser:${WEB_FIREBASE_CONFIG.apiKey}:${WEB_APP_NAME}`;
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// The web API key may be limited to the web app's own pages (the WebViews
// run at https://localhost); say so on Firebase Auth calls made from here.
const AUTH_HOSTS = /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//;
const baseFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	if (AUTH_HOSTS.test(url)) {
		const headers = new Headers(init?.headers);
		if (!headers.has("Referer")) headers.set("Referer", "https://localhost/");
		return baseFetch(input, { ...init, headers });
	}
	return baseFetch(input, init);
}) as typeof fetch;

// AsyncStorage-shaped wrapper around MMKV for the JS SDK's persistence.
const mmkvAsync = {
	getItem: async (key: string) => storage.getString(key) ?? null,
	setItem: async (key: string, value: string) => storage.set(key, value),
	removeItem: async (key: string) => {
		storage.remove(key);
	},
};

export const webApp = getApps().find((a) => a.name === WEB_APP_NAME) ?? initializeApp(WEB_FIREBASE_CONFIG, WEB_APP_NAME);
// (The browser preview, `npm run web`, gets the browser build without getReactNativePersistence.)
export const webAuth: Auth = initializeAuth(webApp, {
	persistence: getReactNativePersistence ? getReactNativePersistence(mmkvAsync) : firebaseAuth.browserLocalPersistence,
});

/** OAuth web client (type 3) from google-services.json — Google returns ID tokens for it. */
function webClientId(): string {
	const services = require("../../google-services.json") as {
		client: { oauth_client?: { client_id: string; client_type: number }[] }[];
	};
	for (const c of services.client) {
		const web = c.oauth_client?.find((o) => o.client_type === 3);
		if (web) return web.client_id;
	}
	return "";
}

let googleConfigured = false;
export function configureGoogle() {
	if (googleConfigured) return;
	GoogleSignin.configure({ webClientId: webClientId(), offlineAccess: false });
	googleConfigured = true;
}

export type LoginResult = "ok" | "cancelled";

/** Google login (AuthContext signInWithGoogle). */
export async function signInWithGoogle(): Promise<LoginResult> {
	configureGoogle();
	await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
	const response = await GoogleSignin.signIn();
	if (!isSuccessResponse(response)) return "cancelled";
	const idToken = response.data.idToken;
	if (!idToken) throw new Error("Google did not return an ID token");
	await signInWithCredential(webAuth, GoogleAuthProvider.credential(idToken));
	storage.remove(WEB_SIGNOUT_PENDING_KEY);
	return "ok";
}

/**
 * Sends the OTP. Resolves with the verification ID, or with a code when
 * Android read the SMS itself (instant verification).
 */
export function sendPhoneOtp(phone: string, resend = false): Promise<{ verificationId: string; autoCode?: string }> {
	return new Promise((resolve, reject) => {
		let settled = false;
		verifyPhoneNumber(getNativeAuth(), phone, 60, resend).on(
			"state_changed",
			(snapshot) => {
				if (settled) return;
				if (snapshot.state === "sent" && snapshot.verificationId) {
					settled = true;
					resolve({ verificationId: snapshot.verificationId });
				} else if (snapshot.state === "verified" && snapshot.verificationId) {
					settled = true;
					resolve({ verificationId: snapshot.verificationId, autoCode: snapshot.code ?? undefined });
				} else if (snapshot.state === "error") {
					settled = true;
					reject(snapshot.error ?? new Error("Could not send OTP"));
				}
			},
			(error) => {
				if (!settled) {
					settled = true;
					reject(error);
				}
			},
		);
	});
}

/** Checks the OTP and logs in. */
export async function confirmPhoneOtp(verificationId: string, code: string) {
	await signInWithCredential(webAuth, PhoneAuthProvider.credential(verificationId, code));
	storage.remove(WEB_SIGNOUT_PENDING_KEY);
}

/**
 * Set when the devotee logs out in the app, so the next web screen drops the
 * page's copy of the session too (the page can't be told while it is closed).
 */
export const WEB_SIGNOUT_PENDING_KEY = "cpbs_web_signout_pending";

export async function signOut() {
	storage.set(WEB_SIGNOUT_PENDING_KEY, true);
	await firebaseSignOut(webAuth);
	if (googleConfigured || (await GoogleSignin.hasPreviousSignIn?.())) {
		configureGoogle();
		await GoogleSignin.signOut().catch(() => {});
	}
}

/** The session as the web page stores it, or null when logged out. */
export function webSessionRecord(user: User | null = webAuth.currentUser): string | null {
	return user ? JSON.stringify(user.toJSON()) : null;
}

/**
 * Adopts a session the web page holds (the old app's login, read from the
 * WebView storage) when nobody is logged in here yet. The record is loaded
 * into a throwaway Firebase app and its user handed over with the public
 * updateCurrentUser().
 */
export async function adoptWebSession(record: string): Promise<boolean> {
	await webAuth.authStateReady();
	if (webAuth.currentUser) return false;
	const name = `adopt-${Date.now()}`;
	const temp = initializeApp(WEB_FIREBASE_CONFIG, name);
	try {
		const memory = new Map<string, string>();
		memory.set(`firebase:authUser:${WEB_FIREBASE_CONFIG.apiKey}:${name}`, JSON.stringify({ ...JSON.parse(record), appName: name }));
		const tempAuth = initializeAuth(temp, {
			persistence: getReactNativePersistence({
				getItem: async (k: string) => memory.get(k) ?? null,
				setItem: async (k: string, v: string) => {
					memory.set(k, v);
				},
				removeItem: async (k: string) => {
					memory.delete(k);
				},
			}),
		});
		await tempAuth.authStateReady();
		if (!tempAuth.currentUser) return false;
		await updateCurrentUser(webAuth, tempAuth.currentUser);
		storage.remove(WEB_SIGNOUT_PENDING_KEY);
		return true;
	} finally {
		await deleteApp(temp).catch(() => {});
	}
}

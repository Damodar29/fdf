import { doc as webDoc, increment as webIncrement, serverTimestamp as webServerTimestamp, setDoc as webSetDoc } from "@firebase/firestore";
import { doc, getFirestore, increment, serverTimestamp, setDoc } from "@react-native-firebase/firestore";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { create } from "zustand";
import { useAuthStore } from "../store/authStore";
import { profileDb, useProfileStore } from "../store/profileStore";
import { storage } from "./storage";

// What the Capacitor app records for the admin panel, from the app itself
// (not only when a web screen happens to be opened):
//  - app_version_stats  — devices per app / Android version (useAppConfig "trackUsage")
//  - user_last_seen/{uid} — when a devotee last opened the app (LastSeenTracker)
//  - user_usage/{uid}   — how long and when they use it (UsageTracker)
// Nothing is written from the browser preview (`npm run web`).

const live = Platform.OS === "android";

// ── Version stats ───────────────────────────────────────────────────────────

/** Kept where the web screens' Capacitor Preferences live, so both count a device once. */
const prefKey = (k: string) => `cap_pref:${k}`;

async function trackStat(current: string, key: string) {
	if (!current) return;
	const last = storage.getString(prefKey(key));
	if (last === current) return;
	const db = getFirestore();
	if (last) {
		await setDoc(
			doc(db, "app_version_stats", last.replace(/\./g, "_")),
			{ version: last, count: increment(-1) },
			{ merge: true },
		).catch(() => {});
	}
	await setDoc(
		doc(db, "app_version_stats", current.replace(/\./g, "_")),
		{ version: current, count: increment(1), lastSeen: serverTimestamp() },
		{ merge: true },
	).catch(() => {});
	storage.set(prefKey(key), current);
}

function trackVersions() {
	const version = (Constants.expoConfig?.version ?? "").replace(/^v/, "") || "unknown";
	const release = String((Platform.constants as { Release?: string }).Release ?? "");
	(async () => {
		if (release) await trackStat(`os_android_${release}`, "last_tracked_os_version");
		await trackStat(`android_native_${version}`, "last_tracked_version");
	})().catch(() => {});
}

// ── Last seen ───────────────────────────────────────────────────────────────

const LAST_SEEN_GAP_MS = 30 * 60_000;

function recordLastSeen(uid: string) {
	const key = `cpbs_last_seen_sent_${uid}`;
	const last = Number(storage.getString(key));
	if (last && Date.now() - last < LAST_SEEN_GAP_MS) return;
	storage.set(key, String(Date.now()));
	webSetDoc(webDoc(profileDb(), "user_last_seen", uid), { lastSeenAt: webServerTimestamp() }).catch(() => {
		storage.set(key, "");
	});
}

// ── Usage time (utils/usageStats.ts) ────────────────────────────────────────

type Pending = { d: Record<string, [number, number]>; h: Record<string, number> };

const TICK_MS = 30_000;
const MAX_STEP_S = 90;
const NEW_SESSION_MS = 5 * 60_000;
const FLUSH_ON_HIDE_MS = 15 * 60_000;
const FLUSH_WHILE_OPEN_MS = 60 * 60_000;

const dayKey = (t: number) => {
	const d = new Date(t);
	return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

function usageTracker(uid: string) {
	const pendingKey = `cpbs_usage_pending_v1_${uid}`;
	const sentKey = `cpbs_usage_sent_v1_${uid}`;
	const hiddenKey = `cpbs_usage_hidden_v1_${uid}`;

	let pending: Pending = { d: {}, h: {} };
	try {
		const p = JSON.parse(storage.getString(pendingKey) || "");
		if (p && typeof p.d === "object" && typeof p.h === "object") pending = p;
	} catch {}
	let lastTick = 0;
	let timer: ReturnType<typeof setInterval> | undefined;

	const save = () => storage.set(pendingKey, JSON.stringify(pending));

	const count = () => {
		if (!lastTick) return;
		const now = Date.now();
		const step = Math.round(Math.min((now - lastTick) / 1000, MAX_STEP_S));
		lastTick = now;
		if (!(step > 0)) return;
		const k = dayKey(now);
		const day = pending.d[k] || [0, 0];
		day[0] += step;
		pending.d[k] = day;
		const hr = String(new Date(now).getHours());
		pending.h[hr] = (pending.h[hr] || 0) + step;
		save();
	};

	const flush = (minGap: number) => {
		const total = Object.values(pending.d).reduce((a, [s]) => a + s, 0);
		if (total < 5) return;
		if (Date.now() - (Number(storage.getString(sentKey)) || 0) < minGap) return;
		const d: Record<string, { s: unknown; n?: unknown }> = {};
		for (const [k, [s, n]] of Object.entries(pending.d)) d[k] = n ? { s: webIncrement(s), n: webIncrement(n) } : { s: webIncrement(s) };
		const h: Record<string, unknown> = {};
		for (const [k, s] of Object.entries(pending.h)) h[k] = webIncrement(s);
		const sending = pending;
		pending = { d: {}, h: {} };
		save();
		storage.set(sentKey, String(Date.now()));
		const profile = useProfileStore.getState().profile;
		const user = useAuthStore.getState().user;
		const info = {
			nm: profile?.realName || user?.displayName || "",
			ph: profile?.photoURL || "",
			md: profile?.mandalId === "custom" ? profile?.customMandalName || "custom" : profile?.mandalId || "",
		};
		webSetDoc(webDoc(profileDb(), "user_usage", uid), { d, h, ...info, updatedAt: webServerTimestamp() }, { merge: true }).catch(() => {
			// Put the time back for the next try.
			for (const [k, [s, n]] of Object.entries(sending.d)) {
				const day = pending.d[k] || [0, 0];
				pending.d[k] = [day[0] + s, day[1] + n];
			}
			for (const [k, s] of Object.entries(sending.h)) pending.h[k] = (pending.h[k] || 0) + s;
			save();
		});
	};

	const start = () => {
		if (lastTick) return;
		const hiddenAt = Number(storage.getString(hiddenKey)) || 0;
		if (!hiddenAt || Date.now() - hiddenAt > NEW_SESSION_MS) {
			const k = dayKey(Date.now());
			const day = pending.d[k] || [0, 0];
			day[1] += 1;
			pending.d[k] = day;
			save();
		}
		lastTick = Date.now();
		timer = setInterval(() => {
			count();
			flush(FLUSH_WHILE_OPEN_MS);
		}, TICK_MS);
		flush(FLUSH_ON_HIDE_MS);
	};

	const stop = () => {
		if (!lastTick) return;
		count();
		lastTick = 0;
		if (timer) clearInterval(timer);
		timer = undefined;
		storage.set(hiddenKey, String(Date.now()));
		flush(FLUSH_ON_HIDE_MS);
	};

	return { start, stop };
}

/**
 * Web screens open right now. Their page runs the Capacitor app's own
 * UsageTracker while open, so the app's count pauses meanwhile (no double time).
 */
export const useOpenWebScreens = create<{ count: number }>(() => ({ count: 0 }));

let started = false;

/** Once, at app start. */
export function startAppTracking() {
	if (started || !live) return;
	started = true;
	trackVersions();

	let tracker: ReturnType<typeof usageTracker> | null = null;
	let uid: string | null = null;
	const follow = () => {
		const next = useAuthStore.getState().user?.uid ?? null;
		if (next === uid) return;
		tracker?.stop();
		tracker = null;
		uid = next;
		if (!uid) return;
		recordLastSeen(uid);
		tracker = usageTracker(uid);
		if (AppState.currentState === "active" && useOpenWebScreens.getState().count === 0) tracker.start();
	};
	useAuthStore.subscribe(follow);
	follow();

	const counting = () => AppState.currentState === "active" && useOpenWebScreens.getState().count === 0;
	const update = () => (counting() ? tracker?.start() : tracker?.stop());
	useOpenWebScreens.subscribe(update);
	AppState.addEventListener("change", (state) => {
		if (state === "active" && uid) recordLastSeen(uid);
		update();
	});
}

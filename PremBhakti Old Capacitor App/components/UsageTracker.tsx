import { doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import type React from "react";
import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { profileDb } from "../services/firebase";
import { safeLocalGet, safeLocalSet } from "../utils/safeLocalSet";
import {
	addSession,
	addTime,
	emptyPending,
	type PendingUsage,
	pendingSeconds,
} from "../utils/usageStats";

/** Time is added up every this often while the app is on screen. */
const TICK_MS = 30_000;
/** A gap longer than one tick (phone asleep, app frozen) is not counted. */
const MAX_STEP_S = 90;
/** Back after this long in the background = a new session. */
const NEW_SESSION_MS = 5 * 60_000;
/** Writes: when the app goes to the background, at most this often… */
const FLUSH_ON_HIDE_MS = 15 * 60_000;
/** …and while it stays open, at most this often. */
const FLUSH_WHILE_OPEN_MS = 60 * 60_000;

const pendingKey = (uid: string) => `cpbs_usage_pending_v1_${uid}`;
const sentKey = (uid: string) => `cpbs_usage_sent_v1_${uid}`;
const hiddenKey = (uid: string) => `cpbs_usage_hidden_v1_${uid}`;

const readPending = (uid: string): PendingUsage => {
	try {
		const p = JSON.parse(safeLocalGet(pendingKey(uid)) || "");
		if (p && typeof p.d === "object" && typeof p.h === "object") return p;
	} catch {}
	return emptyPending();
};

/**
 * Adds up how long a logged-in devotee has the app on screen, per day and by
 * hour, for Admin → Usage. The time is kept on the phone and written to
 * user_usage/{uid} only a few times a day (usually 1–3 small writes), not on
 * every screen change. Renders nothing.
 */
export const UsageTracker: React.FC = () => {
	const { user, profile } = useAuth();
	const uid = user?.uid;
	// Name/photo/mandal travel with each write so the admin list needs no
	// extra reads; kept in a ref so a profile change doesn't restart tracking.
	const info = useRef({ nm: "", ph: "", md: "" });
	info.current = {
		nm: profile?.realName || user?.displayName || "",
		ph: profile?.photoURL || "",
		md:
			profile?.mandalId === "custom"
				? profile?.customMandalName || "custom"
				: profile?.mandalId || "",
	};

	useEffect(() => {
		if (!uid) return;
		let pending = readPending(uid);
		let lastTick = 0; // 0 = not on screen
		let timer: ReturnType<typeof setInterval> | undefined;

		const save = () => safeLocalSet(pendingKey(uid), JSON.stringify(pending));

		const count = () => {
			if (!lastTick) return;
			const now = Date.now();
			const step = Math.min((now - lastTick) / 1000, MAX_STEP_S);
			lastTick = now;
			addTime(pending, Math.round(step), now);
			save();
		};

		const flush = (minGap: number) => {
			if (pendingSeconds(pending) < 5) return;
			const last = Number(safeLocalGet(sentKey(uid))) || 0;
			if (Date.now() - last < minGap) return;
			if (typeof navigator !== "undefined" && navigator.onLine === false)
				return;
			const d: Record<string, { s: unknown; n?: unknown }> = {};
			for (const [k, [s, n]] of Object.entries(pending.d))
				d[k] = n ? { s: increment(s), n: increment(n) } : { s: increment(s) };
			const h: Record<string, unknown> = {};
			for (const [k, s] of Object.entries(pending.h)) h[k] = increment(s);
			const sending = pending;
			// Cleared before the write finishes: Firestore queues the write
			// itself, so the same seconds are never sent twice.
			pending = emptyPending();
			save();
			safeLocalSet(sentKey(uid), String(Date.now()));
			setDoc(
				doc(profileDb, "user_usage", uid),
				{ d, h, ...info.current, updatedAt: serverTimestamp() },
				{ merge: true },
			).catch((e) => {
				console.warn("[Usage] Could not save", e);
				// Put the time back for the next try.
				for (const [k, [s, n]] of Object.entries(sending.d)) {
					const day = pending.d[k] || [0, 0];
					pending.d[k] = [day[0] + s, day[1] + n];
				}
				for (const [k, s] of Object.entries(sending.h))
					pending.h[k] = (pending.h[k] || 0) + s;
				save();
				// Try again after the usual gap, not on every screen switch.
			});
		};

		const start = () => {
			if (lastTick) return;
			const hiddenAt = Number(safeLocalGet(hiddenKey(uid))) || 0;
			if (!hiddenAt || Date.now() - hiddenAt > NEW_SESSION_MS) {
				addSession(pending);
				save();
			}
			lastTick = Date.now();
			timer = setInterval(() => {
				count();
				flush(FLUSH_WHILE_OPEN_MS);
			}, TICK_MS);
			// Time left over from an earlier visit (app closed before writing).
			flush(FLUSH_ON_HIDE_MS);
		};

		const stop = () => {
			if (!lastTick) return;
			count();
			lastTick = 0;
			if (timer) clearInterval(timer);
			timer = undefined;
			safeLocalSet(hiddenKey(uid), String(Date.now()));
			flush(FLUSH_ON_HIDE_MS);
		};

		const onVisibility = () =>
			document.visibilityState === "visible" ? start() : stop();

		onVisibility();
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("pagehide", stop);
		return () => {
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("pagehide", stop);
			stop();
		};
	}, [uid]);

	return null;
};

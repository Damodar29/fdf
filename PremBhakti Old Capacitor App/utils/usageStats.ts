/**
 * App usage time — how long and when each logged-in devotee uses the app.
 *
 * Kept cheap on purpose: the phone adds up the time itself and writes one
 * small document per devotee, user_usage/{uid}, only a few times a day (see
 * components/UsageTracker.tsx). The admin screen keeps a copy of all the
 * documents on the device and asks only for the ones that changed since.
 *
 * Document: {
 *   d:  { "YYYYMMDD": { s: seconds, n: sessions } },   // per day, device-local date
 *   h:  { "0".."23": seconds },                         // all-time, by hour of day
 *   nm: name, ph: photo URL, md: mandal id,             // so the admin list needs no users/ reads
 *   updatedAt: server time of the last write
 * }
 */

export interface UsageDay {
	s?: number;
	n?: number;
}

export interface UsageDoc {
	d?: Record<string, UsageDay>;
	h?: Record<string, number>;
	nm?: string;
	ph?: string;
	md?: string;
	/** ms (converted from the Firestore timestamp). */
	updatedAt?: number;
}

/** Local-time day key, e.g. "20261001". */
export const dayKey = (t: number | Date = Date.now()): string => {
	const d = t instanceof Date ? t : new Date(t);
	return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

/** Day keys of the last `n` days, today first. */
export const lastDays = (n: number, now = Date.now()): string[] => {
	const out: string[] = [];
	const d = new Date(now);
	for (let i = 0; i < n; i++) {
		out.push(dayKey(d));
		d.setDate(d.getDate() - 1);
	}
	return out;
};

export const keyToDate = (k: string): Date =>
	new Date(
		Number(k.slice(0, 4)),
		Number(k.slice(4, 6)) - 1,
		Number(k.slice(6, 8)),
	);

// ── On the phone: time not yet written ─────────────────────────────────────

export interface PendingUsage {
	d: Record<string, [number, number]>; // day → [seconds, sessions]
	h: Record<string, number>; // hour → seconds
}

export const emptyPending = (): PendingUsage => ({ d: {}, h: {} });

export const addTime = (p: PendingUsage, seconds: number, at = Date.now()) => {
	if (!(seconds > 0)) return;
	const k = dayKey(at);
	const hr = String(new Date(at).getHours());
	const day = p.d[k] || [0, 0];
	day[0] += seconds;
	p.d[k] = day;
	p.h[hr] = (p.h[hr] || 0) + seconds;
};

export const addSession = (p: PendingUsage, at = Date.now()) => {
	const k = dayKey(at);
	const day = p.d[k] || [0, 0];
	day[1] += 1;
	p.d[k] = day;
};

export const pendingSeconds = (p: PendingUsage) =>
	Object.values(p.d).reduce((a, [s]) => a + s, 0);

// ── In the admin panel: totals ──────────────────────────────────────────────

export interface UserUsage {
	uid: string;
	name: string;
	photo: string;
	mandal: string;
	/** Seconds in the chosen days. */
	seconds: number;
	sessions: number;
	activeDays: number;
	totalSeconds: number;
	/** Last day with any use (key), "" if none. */
	lastDay: string;
	updatedAt: number;
}

export const userUsage = (
	uid: string,
	doc: UsageDoc,
	days: Set<string> | null,
): UserUsage => {
	let seconds = 0;
	let sessions = 0;
	let activeDays = 0;
	let totalSeconds = 0;
	let lastDay = "";
	for (const [k, v] of Object.entries(doc.d || {})) {
		const s = Math.round(v?.s || 0);
		totalSeconds += s;
		if (s > 0 && k > lastDay) lastDay = k;
		if (days && !days.has(k)) continue;
		seconds += s;
		sessions += v?.n || 0;
		if (s > 0) activeDays++;
	}
	return {
		uid,
		name: doc.nm || "",
		photo: doc.ph || "",
		mandal: doc.md || "",
		seconds,
		sessions,
		activeDays,
		totalSeconds,
		lastDay,
		updatedAt: doc.updatedAt || 0,
	};
};

/** Per day for the given keys: devotees who used the app, and total seconds. */
export const dailyTotals = (docs: UsageDoc[], keys: string[]) =>
	keys.map((k) => {
		let users = 0;
		let seconds = 0;
		for (const d of docs) {
			const s = d.d?.[k]?.s || 0;
			if (s > 0) {
				users++;
				seconds += s;
			}
		}
		return { key: k, users, seconds };
	});

/** Seconds by hour of day (0–23), all devotees together. */
export const hourTotals = (docs: UsageDoc[]) => {
	const out = new Array(24).fill(0) as number[];
	for (const d of docs)
		for (const [h, s] of Object.entries(d.h || {})) {
			const i = Number(h);
			if (i >= 0 && i < 24) out[i] += s || 0;
		}
	return out;
};

/** "1 घं 20 मि" / "1h 20m"; under a minute is "<1 मि". */
export const formatDuration = (seconds: number, hindi: boolean): string => {
	const m = Math.round(seconds / 60);
	if (seconds > 0 && m < 1) return hindi ? "<1 मि" : "<1m";
	const h = Math.floor(m / 60);
	const mm = m % 60;
	if (h === 0) return hindi ? `${mm} मि` : `${mm}m`;
	return hindi ? `${h} घं ${mm} मि` : `${h}h ${mm}m`;
};

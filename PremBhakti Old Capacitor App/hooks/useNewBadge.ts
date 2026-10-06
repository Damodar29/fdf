/**
 * useNewBadge.ts — one source of truth for every "NEW" badge in the app.
 *
 * Replaces nine ad-hoc localStorage reads spread across HomeScreen,
 * ActivitiesScreen, DailyDarshanScreen and VideosScreen. The audit found that
 * almost every NEW-badge bug came from each screen inventing its own "has this
 * changed?" token:
 *
 *   - `String(gallery[0].releaseId || gallery[0].id)` — a GitHub releaseId is
 *     shared by every asset in the release, so photos added to an existing
 *     release produced no badge; and because Firestore items have no releaseId,
 *     the token flipped type the moment Firestore filled, giving every user a
 *     phantom NEW.
 *   - `count_${n}` and `Object.keys(dailyPrograms).length` — add-one-delete-one
 *     nets to no badge, a lone deletion gives a phantom badge, and in-place
 *     edits are invisible.
 *   - `videos.sort(by order).map(v => v.id).join(",")` — an identity-and-order
 *     hash used as a recency signal, so reordering or deleting fired NEW for
 *     content the user had already seen.
 *   - raw image URLs — any cache-buster, CDN move or re-upload read as new.
 *
 * ── The model ────────────────────────────────────────────────────────────────
 *
 * Instead of a single token we store the *set of item ids the user has already
 * seen*. `hasUnseen(key, ids)` is then simply "is any current id missing from
 * that set". This is immune to reordering, deletion, URL churn, releaseId
 * collapse, same-day additions (gallery dates are day-granular `YYYY-MM-DD`,
 * so any timestamp scheme silently misses a second upload on the same day) and
 * to items backfilled with an older date.
 *
 * Stored value: `{"v":1,"ids":[...],"at":<epoch ms>}` under the SAME keys as
 * before, which is what makes this a zero-migration change — see `readRecord`.
 *
 * ── Why plain functions and not one hook ─────────────────────────────────────
 *
 * Per-mandal newness is computed inside `.map()` callbacks, where hooks are
 * illegal. So `hasUnseen` / `markSeen` are pure-ish helpers safe to call
 * anywhere, and the single hook `useSeenVersion()` provides the reactivity:
 * call it once per component, and every `hasUnseen` in that render is
 * recomputed whenever any screen writes seen-state.
 */
import { useEffect, useRef, useState } from "react";
import { safeLocalSet } from "../utils/safeLocalSet";

/** Window event every screen already uses to cross-notify seen-state writes. */
export const SEEN_EVENT = "cpbs_storage_update";

/**
 * We never ask about more than the newest 200 ids, and we always remember the
 * newest 400 seen. `MAX_SEEN > CHECK_LIMIT` is load-bearing: it guarantees that
 * anything we could still be asked about is inside the retained window, so
 * eviction can never resurrect a phantom NEW.
 */
const CHECK_LIMIT = 200;
const MAX_SEEN = 400;

type SeenRecord = { ids: Set<string>; at: number };

/** A value written by the pre-id-set code: a bare token, not JSON. */
const LEGACY = "legacy" as const;

/**
 * Normalise a caller's id list: drop empties, de-duplicate, keep the newest
 * `CHECK_LIMIT`. Callers pass ids newest-first (see `idsByRecency`).
 */
function normalise(ids: readonly (string | null | undefined)[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of ids) {
		if (raw === null || raw === undefined) continue;
		const id = String(raw);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
		if (out.length >= CHECK_LIMIT) break;
	}
	return out;
}

/**
 * Read the seen-record for a key.
 *
 * Three outcomes, and the distinction between them is the whole migration
 * strategy:
 *
 *   `null`     — nothing stored. Fresh install: everything is new to this user,
 *                which is the behaviour the app already has today.
 *   `LEGACY`   — a pre-upgrade token (a URL, a releaseId, `count_7`, a joined
 *                hash…). It does not parse as our record, and we cannot know
 *                which ids it covered — but we *do* know the user had dismissed
 *                that badge. So the caller upgrades it in place, marking the
 *                currently-visible ids as seen. Existing users get no phantom
 *                NEW on upgrade, and future content still badges correctly.
 *   record     — the real thing.
 *
 * Because the key names are unchanged, `DataContext`'s backup/restore (which
 * captures these by exact name and by prefix) keeps working untouched.
 */
function readRecord(key: string): SeenRecord | typeof LEGACY | null {
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(key);
	} catch {
		// Private-mode / disabled storage. Treat as fresh.
		return null;
	}
	if (raw === null || raw === "") return null;
	try {
		const parsed = JSON.parse(raw);
		if (
			parsed &&
			typeof parsed === "object" &&
			!Array.isArray(parsed) &&
			Array.isArray((parsed as { ids?: unknown }).ids)
		) {
			const rec = parsed as { ids: unknown[]; at?: unknown };
			return {
				ids: new Set(rec.ids.map((v) => String(v))),
				at: typeof rec.at === "number" ? rec.at : 0,
			};
		}
	} catch {
		// Not JSON at all — definitely a legacy token.
	}
	return LEGACY;
}

/**
 * Write a seen-record.
 *
 * Union rather than replace, capped to the most recently added `MAX_SEEN`.
 * Union matters because `cpbs_activity_photos_main_latest` is read by both
 * HomeScreen (which knows about its newest few items) and ActivitiesScreen
 * (which knows about all of them). If writes replaced, the two screens would
 * clobber each other's ids and one of them would show a permanently stuck
 * badge. Union means neither can lose the other's knowledge.
 *
 * Stale ids for deleted items linger in the set; that is harmless (they simply
 * never match again) and the cap bounds growth to a few KB per key.
 */
function writeRecord(
	key: string,
	ids: readonly (string | null | undefined)[],
	at: number,
	notify: boolean,
): void {
	const existing = readRecord(key);
	const merged: string[] =
		existing && existing !== LEGACY ? Array.from(existing.ids) : [];
	const known = new Set(merged);
	for (const raw of ids) {
		if (raw === null || raw === undefined) continue;
		const id = String(raw);
		if (!id || known.has(id)) continue;
		known.add(id);
		merged.push(id);
	}
	const capped =
		merged.length > MAX_SEEN ? merged.slice(merged.length - MAX_SEEN) : merged;

	safeLocalSet(key, JSON.stringify({ v: 1, ids: capped, at }));
	if (notify) {
		try {
			window.dispatchEvent(new Event(SEEN_EVENT));
		} catch {
			/* non-browser context */
		}
	}
}

/**
 * Subscribe to seen-state changes. Call once per component; every `hasUnseen`
 * in that component's render is then recomputed when anything writes.
 *
 * Returns a counter purely so it can be listed in `useEffect`/`useMemo`
 * dependency arrays.
 */
export function useSeenVersion(): number {
	const [version, setVersion] = useState(0);
	useEffect(() => {
		const bump = () => setVersion((v) => v + 1);
		window.addEventListener(SEEN_EVENT, bump);
		// `storage` fires for writes from other tabs/webviews.
		window.addEventListener("storage", bump);
		return () => {
			window.removeEventListener(SEEN_EVENT, bump);
			window.removeEventListener("storage", bump);
		};
	}, []);
	return version;
}

/**
 * Is any of `ids` unseen under `key`? Safe to call during render, including
 * inside a `.map()`.
 *
 * Pass ids newest-first. An empty list is never "new" — that keeps a badge from
 * flashing while data is still loading.
 */
export function hasUnseen(
	key: string,
	ids: readonly (string | null | undefined)[],
): boolean {
	const current = normalise(ids);
	if (current.length === 0) return false;

	const rec = readRecord(key);
	if (rec === null) return true; // fresh install — all new, as today
	if (rec === LEGACY) {
		// Upgrade in place. Writing to localStorage during render is safe (no
		// React state is touched); we deliberately skip the event dispatch,
		// since dispatching mid-render would re-enter this component. The write
		// is idempotent, so React 19's double-invoked render is fine.
		writeRecord(key, current, 0, false);
		return false;
	}
	return current.some((id) => !rec.ids.has(id));
}

/** Mark `ids` as seen under `key` and notify every mounted screen. */
export function markSeen(
	key: string,
	ids: readonly (string | null | undefined)[],
): void {
	writeRecord(key, ids, Date.now(), true);
}

/* ────────────────────────── visit markers ──────────────────────────────────
 *
 * The worst NEW-badge bug was that the three HomeScreen tiles marked themselves
 * seen in their own `onClick`. Reach Darshan / Activities / Videos by the bottom
 * nav, the side menu, a push notification or a deep link and the Home badge
 * stayed lit forever, no matter how much of the content you read — the badge had
 * stopped tracking content and started tracking "did you tap this square".
 *
 * The fix has to survive the fact that HomeScreen and the destination screen
 * compute *different* id sets (Home aggregates the newest five across all
 * mandals; the destination knows every item). If the destination wrote Home's
 * key directly, the two id derivations would have to agree forever or the badge
 * would never clear — a nasty failure mode.
 *
 * So the destination publishes only a timestamp ("I was opened at T") and each
 * screen keeps ownership of its own badge key, reconciling against that
 * timestamp with its own ids. No shared id contract, nothing to drift.
 */

const VISIT_PREFIX = "cpbs_seen_visit_";

export type VisitTarget = "darshan" | "activities" | "videos" | "photos";

function visitKey(target: VisitTarget): string {
	return `${VISIT_PREFIX}${target}`;
}

function readVisitedAt(target: VisitTarget): number {
	try {
		const raw = localStorage.getItem(visitKey(target));
		if (!raw) return 0;
		const n = Number(raw);
		return Number.isFinite(n) ? n : 0;
	} catch {
		return 0;
	}
}

/** Record that the user opened a destination screen or view. */
export function markVisited(target: VisitTarget): void {
	safeLocalSet(visitKey(target), String(Date.now()));
	try {
		window.dispatchEvent(new Event(SEEN_EVENT));
	} catch {
		/* non-browser context */
	}
}

/**
 * Call from the destination screen. Fires once per mount — and since App.tsx
 * mounts these screens conditionally (`{isDailyDarshanOpen && <…/>}`), one mount
 * is exactly one visit.
 *
 * `active` lets a view inside a screen opt in only while it is showing, which is
 * how the Activities "Past Event Media" view reports itself.
 *
 * The visit is stamped again on the way out. Opened from a notification on a
 * cold start, Home first marks its *cached* ids against the entry stamp; the
 * new photos arrive afterwards, now older than that seen-record, so Home's
 * badge stayed on even after the user had looked at them. The exit stamp is
 * newer than that record, so Home re-marks with the ids it has by then.
 */
export function useMarkVisitedOnMount(
	target: VisitTarget,
	active: boolean = true,
): void {
	useEffect(() => {
		if (!active) return;
		markVisited(target);
		return () => markVisited(target);
	}, [target, active]);
}

/**
 * Clear `badgeKey` once the user has actually visited `target`.
 *
 * Convergence: the visit write bumps `useSeenVersion`, this effect re-runs and
 * marks seen with `at = now >= visitedAt`, which bumps the version once more,
 * and the second pass is a no-op. Two rounds, then stable.
 *
 * The `ids.length === 0` guard matters: marking an empty set while the merge
 * effects are still loading would stamp `at` without recording anything, and the
 * badge would pop back on the moment data arrived. Skipping instead lets the
 * effect re-run with real ids (they are in its dependency list) and mark then.
 */
export function useClearOnVisit(
	target: VisitTarget,
	badgeKey: string,
	ids: readonly (string | null | undefined)[],
): void {
	const version = useSeenVersion();
	const fingerprint = normalise(ids).join(",");
	// Avoid re-running on every render when the id list is recreated but equal.
	const idsRef = useRef<readonly (string | null | undefined)[]>(ids);
	idsRef.current = ids;

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (!fingerprint) return;
		const visitedAt = readVisitedAt(target);
		if (visitedAt === 0) return;
		const rec = readRecord(badgeKey);
		const seenAt = rec && rec !== LEGACY ? rec.at : 0;
		if (visitedAt > seenAt) markSeen(badgeKey, idsRef.current);
	}, [target, badgeKey, fingerprint, version]);
}

/* ────────────────────────── id helpers ─────────────────────────────────────*/

type Recency = {
	id?: string | number | null;
	date?: string | null;
	order?: number | null;
};

/**
 * Ids newest-first, for anything carrying `{ id, date?, order? }` — gallery
 * items, videos, merged home items.
 *
 * Order only decides which ids survive the `CHECK_LIMIT` slice (id-set
 * comparison is order-insensitive), but getting it right means the *newest*
 * items are the ones we track.
 */
export function idsByRecency(
	items: readonly Recency[] | null | undefined,
): string[] {
	if (!items || items.length === 0) return [];
	return [...items]
		.sort((a, b) => {
			const da = a.date ?? "";
			const db = b.date ?? "";
			if (da !== db) return db.localeCompare(da); // ISO strings sort lexically
			return (b.order ?? 0) - (a.order ?? 0);
		})
		.map((i) => (i.id === null || i.id === undefined ? "" : String(i.id)))
		.filter(Boolean);
}

/**
 * A stable one-element "id" for content that has no id of its own — the mandal
 * info badge, which watches a weekly program or a set of daily programs.
 *
 * The old stamp fell back to `Object.keys(dailyPrograms).length`, so editing a
 * program's title, time or description without changing *how many* there were
 * produced no badge at all. Hashing the actual content fixes that, and folding
 * it into a single-element id set means the info badge uses the same code path
 * as everything else.
 */
export function contentFingerprint(
	parts: readonly (string | number | boolean | null | undefined)[],
): string {
	const joined = parts
		.map((p) => (p === null || p === undefined ? "" : String(p)))
		.join("␟");
	// djb2 — short, stable, and we only need change-detection, not security.
	let h = 5381;
	for (let i = 0; i < joined.length; i++) {
		h = ((h << 5) + h + joined.charCodeAt(i)) | 0;
	}
	return `fp_${(h >>> 0).toString(36)}`;
}

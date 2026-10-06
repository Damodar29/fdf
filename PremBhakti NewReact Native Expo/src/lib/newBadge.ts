import { useEffect, useRef } from "react";
import { useWebStoreVersion, webGet, webSet } from "./webStore";

// hooks/useNewBadge.ts of the OG app: every NEW badge is "is any current item
// id missing from the set of ids already seen", stored as
// {"v":1,"ids":[...],"at":<ms>} under the same keys. The keys live in the
// app's copy of the web screens' storage (lib/webStore), because the screens
// that clear them (Darshan, Activities, Videos) still run as web screens:
// they stamp `cpbs_seen_visit_<screen>` when opened and Home reconciles its
// own badge against that, exactly as in the OG app.

const CHECK_LIMIT = 200;
const MAX_SEEN = 400;
const VISIT_PREFIX = "cpbs_seen_visit_";

type SeenRecord = { ids: Set<string>; at: number };
const LEGACY = "legacy" as const;

export type VisitTarget = "darshan" | "activities" | "videos" | "photos";

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

function readRecord(key: string): SeenRecord | typeof LEGACY | null {
	const raw = webGet(key);
	if (raw === null || raw === "") return null;
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.ids)) {
			return { ids: new Set((parsed.ids as unknown[]).map(String)), at: typeof parsed.at === "number" ? parsed.at : 0 };
		}
	} catch {
		// a bare pre-id-set token
	}
	return LEGACY;
}

/** Union with what is stored, newest MAX_SEEN kept (two screens share some keys). */
function writeRecord(key: string, ids: readonly (string | null | undefined)[], at: number) {
	const existing = readRecord(key);
	const merged: string[] = existing && existing !== LEGACY ? Array.from(existing.ids) : [];
	const known = new Set(merged);
	for (const raw of ids) {
		if (raw === null || raw === undefined) continue;
		const id = String(raw);
		if (!id || known.has(id)) continue;
		known.add(id);
		merged.push(id);
	}
	const capped = merged.length > MAX_SEEN ? merged.slice(merged.length - MAX_SEEN) : merged;
	webSet(key, JSON.stringify({ v: 1, ids: capped, at }));
}

/** Re-render on any seen-state change; call once per component that uses hasUnseen. */
export const useSeenVersion = useWebStoreVersion;

/** Is any of `ids` (newest first) unseen under `key`? An empty list is never new. */
export function hasUnseen(key: string, ids: readonly (string | null | undefined)[]): boolean {
	const current = normalise(ids);
	if (current.length === 0) return false;
	const rec = readRecord(key);
	if (rec === null) return true;
	if (rec === LEGACY) {
		// Upgrade in place: the devotee had dismissed this badge. After the
		// render, since the write re-renders every badge reader.
		queueMicrotask(() => writeRecord(key, current, 0));
		return false;
	}
	return current.some((id) => !rec.ids.has(id));
}

export function markSeen(key: string, ids: readonly (string | null | undefined)[]) {
	writeRecord(key, ids, Date.now());
}

function readVisitedAt(target: VisitTarget): number {
	const n = Number(webGet(`${VISIT_PREFIX}${target}`) ?? 0);
	return Number.isFinite(n) ? n : 0;
}

/** Clears `badgeKey` once the devotee has visited `target` (stamped by that screen). */
export function useClearOnVisit(target: VisitTarget, badgeKey: string, ids: readonly (string | null | undefined)[]) {
	const version = useSeenVersion();
	const fingerprint = normalise(ids).join(",");
	const idsRef = useRef(ids);
	idsRef.current = ids;

	// biome-ignore lint/correctness/useExhaustiveDependencies: version and fingerprint are the triggers
	useEffect(() => {
		if (!fingerprint) return;
		const visitedAt = readVisitedAt(target);
		if (visitedAt === 0) return;
		const rec = readRecord(badgeKey);
		const seenAt = rec && rec !== LEGACY ? rec.at : 0;
		if (visitedAt > seenAt) markSeen(badgeKey, idsRef.current);
	}, [target, badgeKey, fingerprint, version]);
}

export function useMarkVisitedOnMount(target: VisitTarget) {
	useEffect(() => {
		webSet(`${VISIT_PREFIX}${target}`, String(Date.now()));
	}, [target]);
}

export function idsByRecency(items: readonly any[]): string[] {
	if (!items) return [];
	return [...items].sort((a, b) => {
		const da = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
		const db = b.createdAt || (b.date ? new Date(b.date).getTime() : 0);
		return db - da;
	}).map((i) => i.id);
}

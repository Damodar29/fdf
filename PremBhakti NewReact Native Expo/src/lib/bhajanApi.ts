import { parseRawBhajanText } from "../utils/textProcessor";
import type { RawBhajanEntry } from "../data/bhajansData";
import type { Bhajan } from "../types";
import { fetchStorageJson } from "./contentApi";
import { getObject, setObject } from "./storage";

// Ported from utils/network.ts + context/DataContext.tsx (fetchBhajansFromCloud)
// in the Capacitor app. Bhajan/book/lecture content is NOT bundled with the
// app or stored in Firestore — it's served as JSON from Firebase Storage
// under app-data/<tag>/<file>, versioned by a bundleUpdated/lastUpdated
// timestamp in index.json. This keeps that same source and sync strategy so
// content stays identical across both apps with zero backend changes.
const CACHE_KEY_BHAJANS = "cpbs_all_bhajans";
const CACHE_KEY_BUNDLE_TIME = "cpbs_bhajans_bundle_time";

// Ported verbatim from context/DataContext.tsx.
function dedupeBhajans(items: Bhajan[]): Bhajan[] {
	const map = new Map<string, Bhajan>();
	for (const item of items) {
		const key = item.id || item.songNumber || item.title;
		map.set(key, item);
	}
	return Array.from(map.values());
}

export interface LoadBhajansResult {
	bhajans: Bhajan[];
	fromCache: boolean;
}

/**
 * Offline-first load: returns cached bhajans immediately if present, and
 * separately exposes refresh() to check/pull the latest bundle. Mirrors the
 * "quick sync via bundle timestamp" strategy in DataContext.tsx without the
 * admin-panel force-sync/Firestore push-sync machinery (that's a later phase).
 */
export function getCachedBhajans(): Bhajan[] {
	return getObject<Bhajan[]>(CACHE_KEY_BHAJANS) ?? [];
}

export async function refreshBhajans(force = false): Promise<LoadBhajansResult> {
	const indexData = await fetchStorageJson("bhajandata", "index.json");
	const remoteBundleTime: number = indexData?.bundleUpdated || indexData?.lastUpdated || 0;
	const localBundleTime = Number(getObject<string>(CACHE_KEY_BUNDLE_TIME) ?? 0);
	const cached = getCachedBhajans();

	if (!force && cached.length > 0 && localBundleTime === remoteBundleTime) {
		return { bhajans: cached, fromCache: true };
	}

	const bundle = await fetchStorageJson("bhajandata", "bundle.json");
	const rawEntries: RawBhajanEntry[] = Array.isArray(bundle)
		? bundle
		: Array.isArray(bundle?.bhajans)
			? bundle.bhajans
			: (() => {
					throw new Error("Invalid bundle.json array format");
				})();

	const bhajans = dedupeBhajans(parseRawBhajanText(rawEntries));
	setObject(CACHE_KEY_BHAJANS, bhajans);
	setObject(CACHE_KEY_BUNDLE_TIME, String(remoteBundleTime));
	return { bhajans, fromCache: false };
}

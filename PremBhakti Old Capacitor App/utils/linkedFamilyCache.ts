/**
 * Device copy of the "Family on the app" list (what getLinkedFamilyProfiles
 * returns), so the profile screen shows the family at once, works without
 * internet, and does not call the server on every visit.
 */
import { safeLocalGet, safeLocalRemove, safeLocalSet } from "./safeLocalSet";

/** A saved list younger than this is used as is — no server call. */
export const LINKED_FAMILY_FRESH_MS = 6 * 60 * 60 * 1000;

export interface SavedLinkedFamily {
	/** When the list was fetched (ms). */
	at: number;
	/** The linked uids that were asked for (deleted accounts drop out of `members`). */
	ids: string[];
	members: any[];
}

// v2: members carry `handAdded` (the people they added by hand) — a new key so
// every saved list is fetched once more instead of waiting 6 hours.
export const linkedFamilyCacheKey = (uid: string) =>
	`cpbs_linked_family_v2_${uid}`;

export function readLinkedFamily(uid: string): SavedLinkedFamily | null {
	try {
		const raw = safeLocalGet(linkedFamilyCacheKey(uid));
		if (!raw) return null;
		const saved = JSON.parse(raw);
		if (
			typeof saved?.at !== "number" ||
			!Array.isArray(saved.ids) ||
			!Array.isArray(saved.members)
		)
			return null;
		return saved as SavedLinkedFamily;
	} catch {
		return null;
	}
}

export function saveLinkedFamily(uid: string, ids: string[], members: any[]) {
	// If storage is full or blocked the list still shows, just not offline.
	const saved: SavedLinkedFamily = { at: Date.now(), ids, members };
	safeLocalSet(linkedFamilyCacheKey(uid), JSON.stringify(saved));
	safeLocalRemove(`cpbs_linked_family_v1_${uid}`); // the older copy
}

export function clearLinkedFamily(uid: string) {
	safeLocalRemove(linkedFamilyCacheKey(uid));
}

/**
 * What to do with a saved list for the current linked uids: the members to
 * show now, and whether it still needs a server fetch (stale, or someone new
 * was linked since it was saved).
 */
export function planLinkedFamily(
	saved: SavedLinkedFamily | null,
	ids: string[],
	now = Date.now(),
): { members: any[]; needsFetch: boolean } {
	if (!saved) return { members: [], needsFetch: ids.length > 0 };
	const want = new Set(ids);
	const members = saved.members.filter((m) => want.has(m?.id));
	const had = new Set(saved.ids);
	const coversAll = ids.every((id) => had.has(id));
	const fresh = now - saved.at >= 0 && now - saved.at < LINKED_FAMILY_FRESH_MS;
	return { members, needsFetch: !coversAll || !fresh };
}

/** "updated 2 hours ago" for the saved-list note. */
export function savedAgo(at: number, hindi: boolean, now = Date.now()): string {
	const min = Math.max(0, Math.round((now - at) / 60_000));
	if (min < 1) return hindi ? "अभी अपडेट हुई" : "updated just now";
	if (min < 60)
		return hindi ? `${min} मिनट पहले अपडेट` : `updated ${min} min ago`;
	const hr = Math.round(min / 60);
	if (hr < 24)
		return hindi
			? `${hr} घंटे पहले अपडेट`
			: `updated ${hr} hour${hr > 1 ? "s" : ""} ago`;
	const day = Math.round(hr / 24);
	return hindi
		? `${day} दिन पहले अपडेट`
		: `updated ${day} day${day > 1 ? "s" : ""} ago`;
}

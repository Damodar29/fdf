/**
 * How a change to a devotee's hand-added family list is written into their
 * edit history, so the admin can see what changed.
 *
 * Older app versions wrote `{ field: "familyMembers", old: "...", new: "..." }`
 * — only "something changed". Now `old` / `new` hold a short JSON list of the
 * members (only the fields a devotee edits), and the admin screen shows who
 * was added, removed or changed. `parseFamilySummary` returns null for the old
 * "..." records, which are shown as "family list changed".
 */

export interface FamilySnap {
	/** Member id — matches the same person across the two lists. */
	i: string;
	/** Name. */
	n: string;
	/** Relation id (src/constants/relations.ts). */
	r?: string;
	/** Diksha name. */
	d?: string;
	/** Guru name. */
	g?: string;
	/** Diksha date. */
	dd?: string;
	/** Aspiring for diksha. */
	a?: boolean;
	/** Photo URL. */
	p?: string;
	/** Why added by hand instead of linked. */
	x?: string;
}

type MemberLike = {
	id: string;
	realName?: string;
	relation?: string;
	dikshaName?: string;
	guruName?: string;
	dikshaDate?: string;
	isAspiring?: boolean;
	photoURL?: string;
	noAppReason?: string;
};

export const snapFamily = (list: MemberLike[] | undefined): FamilySnap[] =>
	(list || []).map((m) => {
		const s: FamilySnap = { i: m.id, n: m.realName || "" };
		if (m.relation) s.r = m.relation;
		if (m.dikshaName) s.d = m.dikshaName;
		if (m.guruName) s.g = m.guruName;
		if (m.dikshaDate) s.dd = m.dikshaDate;
		if (m.isAspiring) s.a = true;
		if (m.photoURL) s.p = m.photoURL;
		if (m.noAppReason) s.x = m.noAppReason;
		return s;
	});

export const summarizeFamily = (list: MemberLike[] | undefined): string =>
	JSON.stringify(snapFamily(list));

export const parseFamilySummary = (s: string): FamilySnap[] | null => {
	if (s?.[0] !== "[") return null;
	try {
		const v = JSON.parse(s);
		return Array.isArray(v) ? (v as FamilySnap[]) : null;
	} catch {
		return null;
	}
};

export type FamilySnapField = Exclude<keyof FamilySnap, "i">;

export interface FamilyDiff {
	added: FamilySnap[];
	removed: FamilySnap[];
	changed: {
		before: FamilySnap;
		after: FamilySnap;
		fields: FamilySnapField[];
	}[];
}

const FIELDS: FamilySnapField[] = ["n", "r", "d", "g", "dd", "a", "p", "x"];

export const diffFamily = (
	before: FamilySnap[],
	after: FamilySnap[],
): FamilyDiff => {
	const was = new Map(before.map((m) => [m.i, m]));
	const now = new Map(after.map((m) => [m.i, m]));
	const changed: FamilyDiff["changed"] = [];
	for (const m of after) {
		const old = was.get(m.i);
		if (!old) continue;
		const fields = FIELDS.filter((f) => (old[f] ?? "") !== (m[f] ?? ""));
		if (fields.length > 0) changed.push({ before: old, after: m, fields });
	}
	return {
		added: after.filter((m) => !was.has(m.i)),
		removed: before.filter((m) => !now.has(m.i)),
		changed,
	};
};

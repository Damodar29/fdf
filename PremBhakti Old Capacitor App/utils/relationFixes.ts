/**
 * Admin → Community Manager → "Fix relations": relations between linked
 * accounts that can be filled in or need a look, worked out from what the
 * family already saved.
 *
 *  - fill:     A (female) calls B "daughter" ⇒ B calls A "mother". Certain —
 *              the same rule the Cloud Function uses for new links
 *              (autoInverseRelation), for links made before it existed.
 *  - gender:   nobody set B's gender, but the family calls B "daughter" /
 *              "sister" ⇒ female. Setting it also lets more relations fill.
 *  - needGender: A calls B "sister"; what B calls A depends on A's gender,
 *              which is not set — pick A's gender.
 *  - choose:   several answers are possible (a "bhatija" calls you chacha
 *              or tau) — pick one.
 *  - chain:    neither side set; through a relative both are linked to
 *              ("my mother's son" ⇒ brother) — a likely answer to confirm.
 *  - conflict: the two sides don't fit (both say "father"), or a relation
 *              contradicts a set gender — look and fix.
 *
 * Pure; `npm run test:devotees` checks it.
 */
import {
	autoInverseRelation,
	type Gender,
	isKnownRelation,
	RELATION_INVERSE,
	relationGender,
	suggestChainRelations,
	suggestInverseRelations,
} from "../src/constants/relations";

export interface RelProfile {
	uid: string;
	realName?: string;
	dikshaName?: string;
	gender?: string;
	isDeleted?: boolean;
	mergedIntoUid?: string;
	linkedFamilyMembers?: string[];
	linkedFamilyRelations?: Record<string, string>;
}

/** Set `owner`'s relation for `other` to `value`. */
export interface RelationWrite {
	owner: string;
	other: string;
	value: string;
}

export type RelationFix =
	| {
			kind: "fill";
			key: string;
			/** The relation that decides it: what `from` calls `to`. */
			from: string;
			to: string;
			relation: string;
			write: RelationWrite;
	  }
	| {
			kind: "gender";
			key: string;
			uid: string;
			gender: Gender;
			/** Who calls them what. */
			because: { from: string; relation: string }[];
	  }
	| {
			kind: "needGender";
			key: string;
			/** Whose gender is missing (the one who set the relation). */
			uid: string;
			to: string;
			relation: string;
			/** What `to` calls `uid` for each gender. */
			ifMale: string;
			ifFemale: string;
			/** The gender the family's relations point to, if they agree. */
			hint?: Gender;
	  }
	| {
			kind: "mixedGender";
			key: string;
			uid: string;
			/** Relations that disagree ("son" from one, "daughter" from another). */
			because: { from: string; relation: string }[];
	  }
	| {
			kind: "choose";
			key: string;
			from: string;
			to: string;
			relation: string;
			/** Possible relations for `to`'s side (what `to` calls `from`). */
			options: string[];
	  }
	| {
			kind: "chain";
			key: string;
			/** Owner of the missing relation: what `owner` calls `other`. */
			owner: string;
			other: string;
			via: string;
			options: string[];
	  }
	| {
			kind: "conflict";
			key: string;
			a: string;
			b: string;
			/** What a calls b / b calls a (either may be empty). */
			ab: string;
			ba: string;
			reason: "both_sides" | "gender";
			/** reason "gender": whose set gender the relation contradicts. */
			genderOf?: string;
	  };

const asGender = (g?: string): Gender | "" =>
	g === "male" || g === "female" ? g : "";
const isActive = (p?: RelProfile): p is RelProfile =>
	!!p && p.isDeleted !== true && !p.mergedIntoUid;
const linksOf = (p?: RelProfile) =>
	Array.isArray(p?.linkedFamilyMembers) ? p.linkedFamilyMembers : [];
const rel = (p: RelProfile | undefined, other: string) => {
	const v = p?.linkedFamilyRelations?.[other];
	return typeof v === "string" ? v : "";
};

/** Gender a set of relations points to, if they all agree. */
function impliedGender(relations: string[]): Gender | "" | "mixed" {
	let g: Gender | "" = "";
	for (const r of relations) {
		const x = relationGender(r);
		if (!x) continue;
		if (g && g !== x) return "mixed";
		g = x;
	}
	return g;
}

export function findRelationFixes(profiles: RelProfile[]): RelationFix[] {
	const byUid = new Map(
		profiles.filter(isActive).map((p) => [p.uid, p] as const),
	);
	// Mutual links only (as the Cloud Functions do).
	const linked = (a: string, b: string) =>
		linksOf(byUid.get(a)).includes(b) && linksOf(byUid.get(b)).includes(a);

	const out: RelationFix[] = [];

	// What everyone is called by their linked family.
	const calledBy = new Map<string, { from: string; relation: string }[]>();
	for (const p of byUid.values()) {
		for (const other of linksOf(p)) {
			if (other === p.uid || !linked(p.uid, other)) continue;
			const r = rel(p, other);
			if (!r) continue;
			const list = calledBy.get(other) ?? [];
			list.push({ from: p.uid, relation: r });
			calledBy.set(other, list);
		}
	}

	// Gender: missing, but every relation the family chose agrees. Only a
	// gender someone actually set decides a relation below; one worked out
	// here is offered first, and only a hint until it is confirmed.
	const genderNow = new Map<string, Gender | "">();
	for (const p of byUid.values()) genderNow.set(p.uid, asGender(p.gender));
	const inferred = new Map<string, Gender>();
	for (const [uid, list] of calledBy) {
		if (genderNow.get(uid)) continue;
		const g = impliedGender(list.map((x) => x.relation));
		if (g === "male" || g === "female") {
			inferred.set(uid, g);
			out.push({
				kind: "gender",
				key: `gender:${uid}`,
				uid,
				gender: g,
				because: list.filter((x) => relationGender(x.relation) === g),
			});
		} else if (g === "mixed") {
			out.push({
				kind: "mixedGender",
				key: `mixed:${uid}`,
				uid,
				because: list.filter((x) => !!relationGender(x.relation)),
			});
		}
	}

	const done = new Set<string>();
	for (const a of byUid.values()) {
		for (const b of linksOf(a)) {
			if (b === a.uid || !linked(a.uid, b)) continue;
			const pair = [a.uid, b].sort().join("|");
			if (done.has(pair)) continue;
			done.add(pair);
			const B = byUid.get(b)!;
			const ab = rel(a, b);
			const ba = rel(B, a.uid);

			// A relation that contradicts a gender someone set.
			let genderClash = false;
			for (const [from, to, r] of [
				[a.uid, b, ab],
				[b, a.uid, ba],
			] as const) {
				const implied = relationGender(r);
				const set = asGender(byUid.get(to)?.gender);
				if (implied && set && implied !== set) {
					out.push({
						kind: "conflict",
						key: `clash:${from}:${to}`,
						a: from,
						b: to,
						ab: r,
						ba: rel(byUid.get(to), from),
						reason: "gender",
						genderOf: to,
					});
					genderClash = true;
				}
			}
			if (genderClash) continue;

			if (ab && ba) {
				// Both set: do they fit each other?
				if (!isKnownRelation(ab) || !isKnownRelation(ba)) continue;
				const fitsAB = suggestInverseRelations(ab, genderNow.get(a.uid));
				const fitsBA = suggestInverseRelations(ba, genderNow.get(b));
				if (
					RELATION_INVERSE[ab] &&
					RELATION_INVERSE[ba] &&
					!fitsAB.includes(ba) &&
					!fitsBA.includes(ab)
				)
					out.push({
						kind: "conflict",
						key: `both:${pair}`,
						a: a.uid,
						b,
						ab,
						ba,
						reason: "both_sides",
					});
				continue;
			}

			if (ab || ba) {
				const [from, to, r] = ab ? [a.uid, b, ab] : [b, a.uid, ba];
				if (!RELATION_INVERSE[r]) continue; // typed by hand: can't tell
				const fromGender = genderNow.get(from) || "";
				const toGender = genderNow.get(to) || "";
				const certain = autoInverseRelation(r, fromGender, toGender);
				if (certain) {
					out.push({
						kind: "fill",
						key: `fill:${to}:${from}`,
						from,
						to,
						relation: r,
						write: { owner: to, other: from, value: certain },
					});
					continue;
				}
				const [ifMale, ifFemale] = RELATION_INVERSE[r];
				if (!fromGender && ifMale.length === 1 && ifFemale.length === 1) {
					out.push({
						kind: "needGender",
						key: `need:${from}:${to}`,
						uid: from,
						to,
						relation: r,
						ifMale: ifMale[0],
						ifFemale: ifFemale[0],
						...(inferred.has(from) ? { hint: inferred.get(from) } : {}),
					});
					continue;
				}
				const options = suggestInverseRelations(r, fromGender);
				if (options.length > 1)
					out.push({
						kind: "choose",
						key: `choose:${to}:${from}`,
						from,
						to,
						relation: r,
						options,
					});
				continue;
			}

			// Neither side set: through a relative both are linked to.
			for (const [owner, other] of [
				[a.uid, b],
				[b, a.uid],
			] as const) {
				const options: string[] = [];
				let via = "";
				for (const c of linksOf(byUid.get(owner))) {
					if (c === other || c === owner || !linked(owner, c)) continue;
					if (!linked(c, other)) continue;
					// What owner calls c (set, or the one inverse of c's word).
					const mine = rel(byUid.get(owner), c)
						? [rel(byUid.get(owner), c)]
						: suggestInverseRelations(
								rel(byUid.get(c), owner),
								genderNow.get(c),
							);
					const theirs = rel(byUid.get(c), other);
					if (!theirs || mine.length !== 1) continue;
					for (const id of suggestChainRelations(
						[{ mine: mine[0], theirs }],
						genderNow.get(other),
					)) {
						if (!options.includes(id)) {
							options.push(id);
							via ||= c;
						}
					}
				}
				if (options.length > 0) {
					out.push({
						kind: "chain",
						key: `chain:${owner}:${other}`,
						owner,
						other,
						via,
						options,
					});
					break; // one side is enough; the other then fills itself
				}
			}
		}
	}
	return out;
}

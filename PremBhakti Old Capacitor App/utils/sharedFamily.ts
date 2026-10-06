/**
 * Family members a linked relative added by hand, shown to the rest of the
 * linked family too: mausa added his mother (who can't make her own profile),
 * so mausi sees her as well — read-only, with the relation worked out through
 * mausa ("husband's mother" ⇒ सास). Only the person who added them can edit.
 *
 * Shown once per person: not when it is actually me (added before I made my
 * profile), not when they are a linked account already, not when I added them
 * myself, and once when several relatives added the same person.
 * `npm run test:devotees` checks it.
 */
import {
	type Gender,
	relationGender,
	suggestChainRelations,
	suggestInverseRelations,
} from "../src/constants/relations";
import { nameMatchScore, samePerson } from "./personMatch";

/** A hand-added member as getLinkedFamilyProfiles returns it (no phone). */
export interface SharedHandAdded {
	id: string;
	realName: string;
	dikshaName?: string;
	guruName?: string;
	dikshaDate?: string;
	isAspiring?: boolean;
	photoURL?: string;
	/** What the relative who added them calls them. */
	relation?: string;
}

/** A linked account with the members it added by hand. */
export interface LinkedWithHandAdded {
	id: string;
	realName?: string;
	dikshaName?: string;
	dikshaDate?: string;
	gender?: Gender | "";
	/** What this relative calls me. */
	theirRelationForMe?: string;
	/** What this relative calls my other linked family members. */
	familyRelations?: Record<string, string>;
	handAdded?: SharedHandAdded[];
}

export interface SharedFamilyPerson {
	/** Stable key: `s_<first owner uid>_<member id>`. */
	key: string;
	member: SharedHandAdded;
	/** Who added them, and what each of them calls the member. */
	owners: { id: string; name: string; relation?: string }[];
	/** What I most likely call them, when there is one clear answer. */
	relation?: string;
	/** Every likely relation, most likely first. */
	suggestions: string[];
}

export interface SharedFamilyMe {
	realName?: string;
	dikshaName?: string;
	dikshaDate?: string;
	/** People I added by hand myself. */
	handAdded?: {
		realName?: string;
		dikshaName?: string;
		dikshaDate?: string;
	}[];
	/** What I call each linked account. */
	relations?: Record<string, string>;
}

const nameOf = (p: { realName?: string; dikshaName?: string }) =>
	p.realName || p.dikshaName || "";

/** Hand-added members of my linked family, once each, for me. */
export function sharedFamilyMembers(
	linked: LinkedWithHandAdded[],
	me: SharedFamilyMe,
): SharedFamilyPerson[] {
	const out: SharedFamilyPerson[] = [];
	const myRelations = me.relations || {};

	for (const owner of linked) {
		for (const m of owner.handAdded || []) {
			if (!m?.id || !nameOf(m)) continue;

			// Me, added by this relative before I had my own profile.
			const callsMeThat =
				!!owner.theirRelationForMe && owner.theirRelationForMe === m.relation;
			if (samePerson(m, me, callsMeThat ? 50 : 90)) continue;

			// A linked account already (shown as that account).
			const isLinkedAccount = linked.some(
				(x) =>
					x.id !== owner.id &&
					(samePerson(m, x) ||
						(!!m.relation &&
							owner.familyRelations?.[x.id] === m.relation &&
							nameMatchScore(m.realName, x.realName) >= 50)),
			);
			if (isLinkedAccount) continue;

			// Someone I added by hand myself.
			if ((me.handAdded || []).some((h) => samePerson(h, m))) continue;

			const ownerEntry = {
				id: owner.id,
				name: nameOf(owner),
				relation: m.relation,
			};
			const existing = out.find((s) => samePerson(s.member, m));
			if (existing) {
				if (!existing.owners.some((o) => o.id === owner.id))
					existing.owners.push(ownerEntry);
				// Keep the copy with a photo.
				if (!existing.member.photoURL && m.photoURL)
					existing.member = { ...existing.member, photoURL: m.photoURL };
				continue;
			}
			out.push({
				key: `s_${owner.id}_${m.id}`,
				member: m,
				owners: [ownerEntry],
				suggestions: [],
			});
		}
	}

	const byId = new Map(linked.map((l) => [l.id, l]));
	for (const person of out) {
		const gender = relationGender(person.member.relation) || "";
		const options: string[] = [];
		for (const o of person.owners) {
			const owner = byId.get(o.id);
			if (!owner || !o.relation) continue;
			// What I call the relative who added them.
			const mine = myRelations[o.id]
				? [myRelations[o.id]]
				: suggestInverseRelations(owner.theirRelationForMe, owner.gender);
			for (const id of suggestChainRelations(
				mine.map((x) => ({ mine: x, theirs: o.relation })),
				gender,
			))
				if (!options.includes(id)) options.push(id);
		}
		person.suggestions = options;
		if (options.length === 1) person.relation = options[0];
	}
	return out;
}

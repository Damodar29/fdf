import { relationGeneration } from "../src/constants/relations";

/** The fields of a hand-added member used to spot a double entry. */
export interface HandAddedLike {
	id: string;
	realName?: string;
	dikshaName?: string;
	dikshaDate?: string;
	/** How the devotee described them. */
	relation?: string;
}

/** The fields of a linked account used to spot a double entry. */
export interface LinkedLike {
	id: string;
	realName?: string;
	dikshaName?: string;
	dikshaDate?: string;
}

const norm = (s?: string) =>
	(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The linked account that is (very likely) the same person as a member the
 * devotee also added by hand — so the family list can warn and the family
 * tree can show them once. Careful rather than eager:
 * - same real name, or same diksha name *and* diksha date (diksha names
 *   repeat);
 * - never when both diksha dates are known and differ;
 * - never when the two relations sit in different generations (a grandfather
 *   "Ram" is not the cousin "Ram");
 * - no answer when more than one linked account fits.
 */
export function findLinkedTwin<L extends LinkedLike>(
	member: HandAddedLike,
	linked: L[],
	myRelations?: Record<string, string>,
): L | undefined {
	const name = norm(member.realName);
	const diksha = norm(member.dikshaName);
	const fits = linked.filter((l) => {
		const sameName = !!name && norm(l.realName) === name;
		const sameDiksha = !!diksha && norm(l.dikshaName) === diksha;
		if (!sameName && !sameDiksha) return false;
		const bothDates = !!member.dikshaDate && !!l.dikshaDate;
		if (bothDates && member.dikshaDate !== l.dikshaDate) return false;
		if (!sameName && !bothDates) return false;
		const a = relationGeneration(member.relation);
		const b = relationGeneration(myRelations?.[l.id]);
		if (a !== null && b !== null && a !== b) return false;
		return true;
	});
	return fits.length === 1 ? fits[0] : undefined;
}

/**
 * Hand-added members that repeat an earlier one in the list (same real name,
 * and no conflicting diksha date). The first stays; later ones are extra.
 */
export function repeatedHandAddedIds(members: HandAddedLike[]): Set<string> {
	const repeated = new Set<string>();
	members.forEach((m, i) => {
		const name = norm(m.realName);
		if (!name) return;
		const earlier = members
			.slice(0, i)
			.some(
				(o) =>
					norm(o.realName) === name &&
					!(o.dikshaDate && m.dikshaDate && o.dikshaDate !== m.dikshaDate),
			);
		if (earlier) repeated.add(m.id);
	});
	return repeated;
}

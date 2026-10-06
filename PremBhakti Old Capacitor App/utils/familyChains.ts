import {
	type Gender,
	suggestChainRelations,
	suggestInverseRelations,
} from "../src/constants/relations";

/** A linked family member as getLinkedFamilyProfiles returns it. */
export interface LinkedFamilyInfo {
	id: string;
	gender?: Gender | "";
	/** What this member calls me. */
	theirRelationForMe?: string;
	/** What this member calls my other linked family members (uid → relation). */
	familyRelations?: Record<string, string>;
}

/**
 * Relations to suggest for one linked member: first the inverse of what they
 * call me ("they call me Mausi" → Bhanja), then through the people in between
 * (my mausi calls them "son" → मौसेरा भाई), the person they were linked through
 * first. Suggestions only — the devotee picks.
 */
export function relationSuggestionsFor(
	memberId: string,
	members: LinkedFamilyInfo[],
	myRelations: Record<string, string> | undefined,
	viaId?: string,
	limit = 6,
): string[] {
	const member = members.find((m) => m.id === memberId);
	if (!member) return [];
	const gender = member.gender || "";

	const between = members
		.filter((m) => m.id !== memberId && myRelations?.[m.id])
		.sort((a, b) => Number(b.id === viaId) - Number(a.id === viaId));

	const chains: { mine: string; theirs: string }[] = [];
	for (const person of between) {
		const mine = myRelations?.[person.id] || "";
		const theirs = person.familyRelations?.[memberId];
		if (theirs) {
			chains.push({ mine, theirs });
			continue;
		}
		// They haven't described the member, but the member described them.
		const memberCallsThem = member.familyRelations?.[person.id];
		for (const t of suggestInverseRelations(memberCallsThem, gender)) {
			chains.push({ mine, theirs: t });
		}
	}

	const out: string[] = [];
	for (const id of [
		...suggestInverseRelations(member.theirRelationForMe, gender),
		...suggestChainRelations(chains, gender),
	]) {
		if (!out.includes(id)) out.push(id);
	}
	return out.slice(0, limit);
}

/** Why a relation is suggested — shown so the devotee can trust (or spot) it. */
export type RelationReason =
	| { kind: "theyCallMe"; relation: string }
	| { kind: "via"; viaId: string; mine: string; theirs: string }
	/** No name for it, but how they are connected: "X's chachi" (theirs) or
	 *  "calls X their bhatija" (memberCalls). */
	| {
			kind: "connected";
			viaId: string;
			mine: string;
			theirs?: string;
			memberCalls?: string;
	  };

/**
 * The first reason relationSuggestionsFor found something, in the same order:
 * what they call me, else the person in between ("Vishakha is your
 * mother-in-law, and they are her son").
 */
export function relationReasonFor(
	memberId: string,
	members: LinkedFamilyInfo[],
	myRelations: Record<string, string> | undefined,
	viaId?: string,
): RelationReason | null {
	const member = members.find((m) => m.id === memberId);
	if (!member) return null;
	const gender = member.gender || "";
	if (
		member.theirRelationForMe &&
		suggestInverseRelations(member.theirRelationForMe, gender).length > 0
	)
		return { kind: "theyCallMe", relation: member.theirRelationForMe };

	const between = members
		.filter((m) => m.id !== memberId && myRelations?.[m.id])
		.sort((a, b) => Number(b.id === viaId) - Number(a.id === viaId));
	for (const person of between) {
		const mine = myRelations?.[person.id] || "";
		const theirs = person.familyRelations?.[memberId];
		const tries = theirs
			? [theirs]
			: suggestInverseRelations(member.familyRelations?.[person.id], gender);
		for (const t of tries) {
			if (suggestChainRelations([{ mine, theirs: t }], gender).length > 0)
				return { kind: "via", viaId: person.id, mine, theirs: t };
		}
	}
	// Nothing to suggest — still say how they are connected, if anyone knows.
	for (const person of between) {
		const mine = myRelations?.[person.id] || "";
		const theirs = person.familyRelations?.[memberId];
		const memberCalls = member.familyRelations?.[person.id];
		if (theirs || memberCalls)
			return {
				kind: "connected",
				viaId: person.id,
				mine,
				...(theirs ? { theirs } : { memberCalls }),
			};
	}
	return null;
}

import {
	type LinkedFamilyInfo,
	type RelationReason,
	relationReasonFor,
	relationSuggestionsFor,
} from "./familyChains";

/** One "how is this person related to you?" for the relation helper. */
export interface RelationQuestion {
	id: string;
	/** Likely answers, best first (may be empty — then only "something else"). */
	options: string[];
	reason: RelationReason | null;
}

/** Only one person can be one's husband / wife. */
const ONLY_ONE = new Set(["husband", "wife"]);

/**
 * The questions the devotee still has to answer: every linked member they
 * have not given a relation, with suggested answers. Those with exactly one
 * answer come first (they can be confirmed together), then the ones with a
 * choice, then the ones nothing is known about.
 */
export function relationQuestions(
	members: LinkedFamilyInfo[],
	myRelations: Record<string, string> | undefined,
	via?: Record<string, string>,
): RelationQuestion[] {
	const taken = new Set(
		Object.values(myRelations || {}).filter((r) => ONLY_ONE.has(r)),
	);
	const out = members
		.filter((m) => m.id && !myRelations?.[m.id])
		.map((m) => ({
			id: m.id,
			options: relationSuggestionsFor(
				m.id,
				members,
				myRelations,
				via?.[m.id],
				6,
			)
				// A spouse is already set: don't offer a second one.
				.filter((r) => !taken.has(r)),
			reason: relationReasonFor(m.id, members, myRelations, via?.[m.id]),
		}));
	const rank = (q: RelationQuestion) =>
		q.options.length === 1 ? 0 : q.options.length > 1 ? 1 : 2;
	return out.sort((a, b) => rank(a) - rank(b));
}

import { autoInverseRelation } from "../src/constants/relations";

/** The profile fields the family-group fix reads. */
export interface FamilyGroupProfile {
	uid: string;
	linkedFamilyMembers?: string[];
	linkedFamilyRelations?: Record<string, string>;
	gender?: string;
	isDeleted?: boolean;
	mergedIntoUid?: string;
}

export interface FamilyGroupFix {
	/** Everyone in the family group, starting profile first. */
	members: string[];
	/** Group is over the size cap — nothing is planned. */
	tooBig: boolean;
	/** uid → accounts to link onto it, each with the member it came through. */
	linkAdds: Map<string, { other: string; via: string }[]>;
	/** uid → relations to set on it (other uid → relation). */
	relationAdds: Map<string, Record<string, string>>;
	/** Number of new two-way links. */
	newLinks: number;
	/** Number of relations filled in. */
	newRelations: number;
}

/** Same cap as FAMILY_GROUP_MAX_SIZE in functions/src/index.ts. */
export const FAMILY_GROUP_MAX_SIZE = 60;

const isActive = (p: FamilyGroupProfile | undefined): p is FamilyGroupProfile =>
	!!p && p.isDeleted !== true && !p.mergedIntoUid;

/**
 * Plans linking a whole family group together — for links made before the
 * syncFamilyLinkGroups Cloud Function existed, which only merges groups when a
 * new link is made.
 *
 * The group is everyone reachable from `startUid` through two-way links. Each
 * missing pair gets linked, with a `linkedFamilyVia` marker naming the member
 * it came through (as the Cloud Function does). Where one side of a link has a
 * relation and the other has none, the other side gets the matching relation
 * when it is certain (autoInverseRelation). Nothing existing is changed.
 */
export function planFamilyGroupFix(
	startUid: string,
	profiles: FamilyGroupProfile[],
	maxSize = FAMILY_GROUP_MAX_SIZE,
): FamilyGroupFix {
	const byUid = new Map<string, FamilyGroupProfile>();
	for (const p of profiles) if (isActive(p)) byUid.set(p.uid, p);

	const linksOf = (uid: string) =>
		new Set((byUid.get(uid)?.linkedFamilyMembers || []).filter(Boolean));
	/** Two-way links between active profiles. */
	const neighbours = (uid: string) =>
		[...linksOf(uid)].filter(
			(other) => other !== uid && byUid.has(other) && linksOf(other).has(uid),
		);

	const empty = (members: string[], tooBig: boolean): FamilyGroupFix => ({
		members,
		tooBig,
		linkAdds: new Map(),
		relationAdds: new Map(),
		newLinks: 0,
		newRelations: 0,
	});
	if (!byUid.has(startUid)) return empty([], false);

	// Everyone reachable through two-way links.
	const members = [startUid];
	const seen = new Set(members);
	for (let i = 0; i < members.length; i++) {
		for (const next of neighbours(members[i])) {
			if (seen.has(next)) continue;
			seen.add(next);
			members.push(next);
		}
		if (members.length > maxSize) return empty(members, true);
	}

	/** Steps from `from` to every member, through two-way links. */
	const distancesFrom = (from: string) => {
		const dist = new Map([[from, 0]]);
		const queue = [from];
		for (let i = 0; i < queue.length; i++) {
			const d = (dist.get(queue[i]) ?? 0) + 1;
			for (const next of neighbours(queue[i])) {
				if (dist.has(next)) continue;
				dist.set(next, d);
				queue.push(next);
			}
		}
		return dist;
	};

	const linkAdds = new Map<string, { other: string; via: string }[]>();
	let newLinks = 0;
	for (let i = 0; i < members.length; i++)
		for (let j = i + 1; j < members.length; j++)
			if (
				!linksOf(members[i]).has(members[j]) ||
				!linksOf(members[j]).has(members[i])
			)
				newLinks++;
	for (const target of members) {
		let dist: Map<string, number> | null = null;
		for (const member of members) {
			if (member === target || linksOf(member).has(target)) continue;
			dist ??= distancesFrom(target);
			const steps = (uid: string) => dist?.get(uid) ?? Number.POSITIVE_INFINITY;
			// "Linked through" the member's own family member nearest to target.
			const via = neighbours(member).reduce((best, n) =>
				steps(n) < steps(best) ? n : best,
			);
			linkAdds.set(member, [
				...(linkAdds.get(member) || []),
				{ other: target, via },
			]);
		}
	}

	// Relations set on one side of an existing link only.
	const relationAdds = new Map<string, Record<string, string>>();
	let newRelations = 0;
	for (const describer of members) {
		const d = byUid.get(describer);
		if (!d) continue;
		for (const described of neighbours(describer)) {
			const theirs = byUid.get(described);
			if (!theirs || theirs.linkedFamilyRelations?.[describer]) continue;
			const relation = autoInverseRelation(
				d.linkedFamilyRelations?.[described],
				d.gender === "male" || d.gender === "female" ? d.gender : "",
				theirs.gender === "male" || theirs.gender === "female"
					? theirs.gender
					: "",
			);
			if (!relation) continue;
			relationAdds.set(described, {
				...(relationAdds.get(described) || {}),
				[describer]: relation,
			});
			newRelations++;
		}
	}

	return {
		members,
		tooBig: false,
		linkAdds,
		relationAdds,
		newLinks,
		newRelations,
	};
}

export interface AllFamilyGroupFixes {
	/** Groups with something to fix, biggest first. */
	plans: FamilyGroupFix[];
	/** Groups over the size cap — left alone; likely a wrong link. */
	tooBig: FamilyGroupFix[];
	newLinks: number;
	newRelations: number;
}

/**
 * planFamilyGroupFix for every family group among `profiles` (each group
 * once). Groups over the size cap are reported, not planned.
 */
export function planAllFamilyGroupFixes(
	profiles: FamilyGroupProfile[],
	maxSize = FAMILY_GROUP_MAX_SIZE,
): AllFamilyGroupFixes {
	const byUid = new Map<string, FamilyGroupProfile>();
	for (const p of profiles) if (isActive(p)) byUid.set(p.uid, p);
	const links = new Map<string, Set<string>>();
	for (const [uid, p] of byUid)
		links.set(uid, new Set((p.linkedFamilyMembers || []).filter(Boolean)));
	const neighbours = (uid: string) =>
		[...(links.get(uid) || [])].filter(
			(o) => o !== uid && byUid.has(o) && links.get(o)?.has(uid),
		);

	const done = new Set<string>();
	const plans: FamilyGroupFix[] = [];
	const tooBig: FamilyGroupFix[] = [];
	for (const uid of byUid.keys()) {
		if (done.has(uid)) continue;
		// The whole group, uncapped, so a big one is reported only once.
		const group = [uid];
		done.add(uid);
		for (let i = 0; i < group.length; i++) {
			for (const next of neighbours(group[i])) {
				if (done.has(next)) continue;
				done.add(next);
				group.push(next);
			}
		}
		if (group.length < 2) continue;
		if (group.length > maxSize) {
			tooBig.push({
				members: group,
				tooBig: true,
				linkAdds: new Map(),
				relationAdds: new Map(),
				newLinks: 0,
				newRelations: 0,
			});
			continue;
		}
		const plan = planFamilyGroupFix(uid, profiles, maxSize);
		if (plan.newLinks > 0 || plan.newRelations > 0) plans.push(plan);
	}
	plans.sort((a, b) => b.members.length - a.members.length);
	return {
		plans,
		tooBig,
		newLinks: plans.reduce((n, p) => n + p.newLinks, 0),
		newRelations: plans.reduce((n, p) => n + p.newRelations, 0),
	};
}

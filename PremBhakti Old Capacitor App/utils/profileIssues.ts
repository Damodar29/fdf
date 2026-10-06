/**
 * Admin → Community Manager → "Duplicates & problems": finds what is wrong in
 * the devotee profiles, carefully (a wrong "duplicate" is worse than a missed
 * one), so each problem can be fixed from one screen.
 *
 *  1. duplicate accounts — the same devotee with two profiles (two emails,
 *     two numbers, or one of each);
 *  2. a family member added twice by hand in one profile;
 *  3. a hand-added member who is also linked (the same person twice);
 *  4. a hand-added member who has their own account but is not linked;
 *  5. the same person added by hand by several relatives in one family;
 *  6. broken links (one-sided, to a removed / merged account, to oneself).
 *
 * Pure: give it the users list (and optionally each account's login phone /
 * email), get the problems back. `npm run test:devotees` checks it.
 */
import { relationGeneration } from "../src/constants/relations";
import {
	compareDates,
	emailKey,
	firstNameKey,
	nameMatchScore,
	phoneKey,
	samePerson,
} from "./personMatch";

export interface IssueMember {
	id: string;
	realName?: string;
	dikshaName?: string;
	dikshaDate?: string;
	guruName?: string;
	relation?: string;
	photoURL?: string;
	approvalStatus?: string;
}

export interface IssueProfile {
	uid: string;
	realName?: string;
	dikshaName?: string;
	dikshaDate?: string;
	guruName?: string;
	phoneNumber?: string;
	email?: string;
	photoURL?: string;
	mandalId?: string;
	gender?: string;
	isDeleted?: boolean;
	mergedIntoUid?: string;
	isApproved?: boolean;
	familyMembers?: IssueMember[];
	linkedFamilyMembers?: string[];
	linkedFamilyRelations?: Record<string, string>;
}

/** The phone / email an account logs in with (Firebase Auth). */
export interface LoginIds {
	phone?: string;
	email?: string;
}

export const isActive = (p: IssueProfile | undefined): p is IssueProfile =>
	!!p && p.isDeleted !== true && !p.mergedIntoUid;

const links = (p: IssueProfile | undefined) =>
	Array.isArray(p?.linkedFamilyMembers)
		? p.linkedFamilyMembers.filter((x) => typeof x === "string" && x)
		: [];
const members = (p: IssueProfile | undefined) =>
	Array.isArray(p?.familyMembers)
		? p.familyMembers.filter((m) => m && typeof m.id === "string")
		: [];
const hasGender = (g?: string) => g === "male" || g === "female";

// ── 1. Duplicate accounts ──────────────────────────────────────────────

export type DuplicateReason =
	| "same_phone"
	| "same_email"
	| "same_photo"
	| "same_date"
	| "same_name"
	| "similar_name"
	| "same_mandal"
	/** A warning, not a match: the two diksha dates don't agree. */
	| "different_date";

export interface DuplicatePair {
	key: string;
	a: string;
	b: string;
	/** "high" = almost surely one person; "possible" = worth a look. */
	level: "high" | "possible";
	reasons: DuplicateReason[];
}

/** Every phone / email an account can be reached on (profile + login). */
function contactKeys(p: IssueProfile, login?: LoginIds) {
	const phones = new Set(
		[phoneKey(p.phoneNumber), phoneKey(login?.phone)].filter(Boolean),
	);
	const emails = new Set(
		[emailKey(p.email), emailKey(login?.email)].filter(Boolean),
	);
	return { phones, emails };
}

const shares = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x));

const pairKey = (prefix: string, a: string, b: string) =>
	`${prefix}:${[a, b].sort().join("|")}`;

/**
 * Two profiles of one devotee: the name fits (Hindi / English / typos) AND
 * something only one person has — the same phone number, email, photo or
 * diksha date. Same phone with a different name is a shared family phone,
 * not a duplicate. Different genders: never. Different diksha dates: only
 * as "maybe" when the name AND a phone / email are the same (a date typed
 * wrong, or copied from a relative, must not hide a second account).
 */
export function findDuplicateAccounts(
	profiles: IssueProfile[],
	logins: Record<string, LoginIds> = {},
): DuplicatePair[] {
	const live = profiles.filter(isActive);
	const byUid = new Map(live.map((p) => [p.uid, p]));
	const contacts = new Map(
		live.map((p) => [p.uid, contactKeys(p, logins[p.uid])]),
	);

	// Only people who share something are compared (not every pair).
	const buckets = new Map<string, string[]>();
	const put = (key: string, uid: string) => {
		if (!key) return;
		const list = buckets.get(key) ?? [];
		list.push(uid);
		buckets.set(key, list);
	};
	for (const p of live) {
		const c = contacts.get(p.uid)!;
		for (const ph of c.phones) put(`p:${ph}`, p.uid);
		for (const e of c.emails) put(`e:${e}`, p.uid);
		if (p.photoURL) put(`f:${p.photoURL}`, p.uid);
		put(`n:${firstNameKey(p.realName)}`, p.uid);
		if (p.dikshaName) put(`d:${firstNameKey(p.dikshaName)}`, p.uid);
	}

	const seen = new Set<string>();
	const out: DuplicatePair[] = [];
	for (const uids of buckets.values()) {
		if (uids.length < 2 || uids.length > 300) continue;
		for (let i = 0; i < uids.length; i++) {
			for (let j = i + 1; j < uids.length; j++) {
				const key = pairKey("dup", uids[i], uids[j]);
				if (seen.has(key)) continue;
				seen.add(key);
				const a = byUid.get(uids[i])!;
				const b = byUid.get(uids[j])!;
				const found = judgeDuplicate(a, b, contacts);
				if (found) out.push({ key, a: a.uid, b: b.uid, ...found });
			}
		}
	}
	return out.sort(
		(x, y) =>
			Number(y.level === "high") - Number(x.level === "high") ||
			y.reasons.length - x.reasons.length,
	);
}

function judgeDuplicate(
	a: IssueProfile,
	b: IssueProfile,
	contacts: Map<string, { phones: Set<string>; emails: Set<string> }>,
): Pick<DuplicatePair, "level" | "reasons"> | null {
	// Family members who are linked to each other with a relation are two people.
	if (
		links(a).includes(b.uid) &&
		(a.linkedFamilyRelations?.[b.uid] || b.linkedFamilyRelations?.[a.uid])
	)
		return null;
	if (hasGender(a.gender) && hasGender(b.gender) && a.gender !== b.gender)
		return null;
	const dates = compareDates(a.dikshaDate, b.dikshaDate);

	const realScore = nameMatchScore(a.realName, b.realName);
	const dikshaScore =
		a.dikshaName && b.dikshaName
			? nameMatchScore(a.dikshaName, b.dikshaName)
			: 0;
	const name = Math.max(realScore, dikshaScore);
	if (name < 80) return null;

	const ca = contacts.get(a.uid)!;
	const cb = contacts.get(b.uid)!;
	const reasons: DuplicateReason[] = [];
	if (shares(ca.phones, cb.phones)) reasons.push("same_phone");
	if (shares(ca.emails, cb.emails)) reasons.push("same_email");
	if (a.photoURL && a.photoURL === b.photoURL) reasons.push("same_photo");
	if (dates === "same") reasons.push("same_date");
	reasons.push(name >= 90 ? "same_name" : "similar_name");
	if (a.mandalId && a.mandalId === b.mandalId) reasons.push("same_mandal");

	if (dates === "different") {
		const contact =
			reasons.includes("same_phone") || reasons.includes("same_email");
		return name >= 90 && contact
			? { level: "possible", reasons: [...reasons, "different_date"] }
			: null;
	}

	const strong = reasons.some((r) =>
		["same_phone", "same_email", "same_photo", "same_date"].includes(r),
	);
	if (strong) return { level: "high", reasons };
	// Same name, nothing else to go on: only a lead when one of the two is
	// barely filled in (a second account someone started and left).
	const thin = (p: IssueProfile) => !p.dikshaDate && !p.photoURL;
	if (name >= 90 && reasons.includes("same_mandal") && (thin(a) || thin(b)))
		return { level: "possible", reasons };
	return null;
}

// ── 2. A member added twice in one profile ─────────────────────────────

export interface RepeatedMember {
	key: string;
	uid: string;
	keepId: string;
	repeatId: string;
}

/** Same generation (or unknown) — a grandfather "Ram" is not the cousin "Ram". */
const sameGeneration = (a?: string, b?: string) => {
	const x = relationGeneration(a);
	const y = relationGeneration(b);
	return x === null || y === null || x === y;
};

export function findRepeatedMembers(
	profiles: IssueProfile[],
): RepeatedMember[] {
	const out: RepeatedMember[] = [];
	for (const p of profiles.filter(isActive)) {
		const list = members(p);
		list.forEach((m, i) => {
			const first = list
				.slice(0, i)
				.find(
					(o) => samePerson(o, m) && sameGeneration(o.relation, m.relation),
				);
			if (first)
				out.push({
					key: `rep:${p.uid}:${m.id}`,
					uid: p.uid,
					keepId: first.id,
					repeatId: m.id,
				});
		});
	}
	return out;
}

// ── 3. Added by hand AND linked ────────────────────────────────────────

export interface MemberAlsoLinked {
	key: string;
	uid: string;
	memberId: string;
	linkedUid: string;
}

export function findMembersAlsoLinked(
	profiles: IssueProfile[],
): MemberAlsoLinked[] {
	const byUid = new Map(profiles.map((p) => [p.uid, p]));
	const out: MemberAlsoLinked[] = [];
	for (const p of profiles.filter(isActive)) {
		const linked = links(p)
			.map((u) => byUid.get(u))
			.filter(isActive);
		for (const m of members(p)) {
			const fits = linked.filter(
				(l) =>
					samePerson(m, l) &&
					sameGeneration(m.relation, p.linkedFamilyRelations?.[l.uid]),
			);
			if (fits.length === 1)
				out.push({
					key: `twin:${p.uid}:${m.id}`,
					uid: p.uid,
					memberId: m.id,
					linkedUid: fits[0].uid,
				});
		}
	}
	return out;
}

// ── 4. Added by hand, has their own account, not linked ────────────────

export interface MemberHasAccount {
	key: string;
	uid: string;
	memberId: string;
	accountUid: string;
	/** The account holder also added `uid` by hand: that member's id. */
	reverseMemberId?: string;
}

/**
 * Only with the same diksha date (a name alone repeats too often), the only
 * such account, and not the devotee's own second account.
 */
export function findMembersWithAccount(
	profiles: IssueProfile[],
): MemberHasAccount[] {
	const live = profiles.filter(isActive);
	const byFirst = new Map<string, IssueProfile[]>();
	for (const p of live) {
		for (const k of new Set([
			firstNameKey(p.realName),
			firstNameKey(p.dikshaName),
		])) {
			if (!k) continue;
			const list = byFirst.get(k) ?? [];
			list.push(p);
			byFirst.set(k, list);
		}
	}
	const out: MemberHasAccount[] = [];
	for (const p of live) {
		const linked = new Set(links(p));
		for (const m of members(p)) {
			if (!m.dikshaDate) continue;
			const pool = new Set([
				...(byFirst.get(firstNameKey(m.realName)) ?? []),
				...(byFirst.get(firstNameKey(m.dikshaName)) ?? []),
			]);
			const fits = [...pool].filter(
				(x) =>
					x.uid !== p.uid &&
					!linked.has(x.uid) &&
					!links(x).includes(p.uid) &&
					compareDates(m.dikshaDate, x.dikshaDate) === "same" &&
					samePerson(m, x) &&
					!samePerson(p, x),
			);
			if (fits.length === 1)
				out.push({
					key: `acct:${p.uid}:${m.id}`,
					uid: p.uid,
					memberId: m.id,
					accountUid: fits[0].uid,
				});
		}
	}
	// Two devotees who added each other by hand: one problem, fixed by one
	// link (and both hand-added copies go).
	const merged: MemberHasAccount[] = [];
	for (const item of out) {
		const pair = merged.find(
			(x) => x.uid === item.accountUid && x.accountUid === item.uid,
		);
		if (pair && !pair.reverseMemberId) pair.reverseMemberId = item.memberId;
		else if (!pair) merged.push({ ...item });
	}
	return merged;
}

// ── 5. Same person added by several relatives ──────────────────────────

export interface SharedMemberCopies {
	key: string;
	/** Each copy: whose profile, which member. The first is the best to keep. */
	copies: { uid: string; memberId: string }[];
	/** The keeper is linked to every other owner, so they all still see it. */
	canTidy: boolean;
}

/** Linked-family groups (accounts connected through mutual links). */
export function familyGroups(profiles: IssueProfile[]): string[][] {
	const byUid = new Map(profiles.filter(isActive).map((p) => [p.uid, p]));
	const seen = new Set<string>();
	const groups: string[][] = [];
	for (const start of byUid.keys()) {
		if (seen.has(start)) continue;
		const group: string[] = [];
		const queue = [start];
		seen.add(start);
		while (queue.length) {
			const u = queue.pop()!;
			group.push(u);
			for (const x of links(byUid.get(u))) {
				if (seen.has(x) || !byUid.has(x)) continue;
				if (!links(byUid.get(x)).includes(u)) continue;
				seen.add(x);
				queue.push(x);
			}
		}
		if (group.length > 1) groups.push(group);
	}
	return groups;
}

const memberRichness = (m: IssueMember) =>
	(m.photoURL ? 4 : 0) +
	(m.dikshaDate ? 2 : 0) +
	(m.dikshaName ? 1 : 0) +
	(m.guruName ? 1 : 0) +
	(m.approvalStatus === "approved" ? 2 : 0);

export function findSharedMemberCopies(
	profiles: IssueProfile[],
): SharedMemberCopies[] {
	const byUid = new Map(profiles.map((p) => [p.uid, p]));
	const out: SharedMemberCopies[] = [];
	for (const group of familyGroups(profiles)) {
		const clusters: { uid: string; m: IssueMember }[][] = [];
		for (const uid of group) {
			for (const m of members(byUid.get(uid))) {
				const c = clusters.find((cl) => cl.some((x) => samePerson(x.m, m)));
				if (c) c.push({ uid, m });
				else clusters.push([{ uid, m }]);
			}
		}
		for (const c of clusters) {
			const owners = new Set(c.map((x) => x.uid));
			if (owners.size < 2) continue;
			// One copy per owner (a repeat inside one profile is problem 2).
			const perOwner = [...owners].map(
				(uid) =>
					c
						.filter((x) => x.uid === uid)
						.sort((x, y) => memberRichness(y.m) - memberRichness(x.m))[0],
			);
			perOwner.sort((x, y) => {
				const linkedToAll = (uid: string) =>
					perOwner.every(
						(o) => o.uid === uid || links(byUid.get(uid)).includes(o.uid),
					);
				return (
					Number(linkedToAll(y.uid)) - Number(linkedToAll(x.uid)) ||
					memberRichness(y.m) - memberRichness(x.m)
				);
			});
			const keeper = perOwner[0].uid;
			const canTidy = perOwner.every(
				(o) => o.uid === keeper || links(byUid.get(keeper)).includes(o.uid),
			);
			const copies = perOwner.map((x) => ({ uid: x.uid, memberId: x.m.id }));
			out.push({
				key: `across:${copies
					.map((x) => `${x.uid}/${x.memberId}`)
					.sort()
					.join("|")}`,
				copies,
				canTidy,
			});
		}
	}
	return out;
}

// ── 6. Broken links ────────────────────────────────────────────────────

export type BrokenLinkKind =
	| "self"
	| "missing"
	| "deleted"
	| "merged"
	| "one_sided";

export interface BrokenLink {
	key: string;
	uid: string;
	otherUid: string;
	kind: BrokenLinkKind;
	/** "merged": the account it was merged into. */
	mergedInto?: string;
}

export function findBrokenLinks(profiles: IssueProfile[]): BrokenLink[] {
	const byUid = new Map(profiles.map((p) => [p.uid, p]));
	const out: BrokenLink[] = [];
	for (const p of profiles.filter(isActive)) {
		for (const x of new Set(links(p))) {
			const other = byUid.get(x);
			const base = { key: `link:${p.uid}:${x}`, uid: p.uid, otherUid: x };
			if (x === p.uid) out.push({ ...base, kind: "self" });
			else if (!other) out.push({ ...base, kind: "missing" });
			else if (other.mergedIntoUid)
				out.push({ ...base, kind: "merged", mergedInto: other.mergedIntoUid });
			else if (other.isDeleted) out.push({ ...base, kind: "deleted" });
			else if (!links(other).includes(p.uid))
				out.push({ ...base, kind: "one_sided" });
		}
	}
	return out;
}

/** Everything at once, without the ones an admin marked "not a problem". */
export function findAllIssues(
	profiles: IssueProfile[],
	logins: Record<string, LoginIds> = {},
	ignored: Set<string> = new Set(),
) {
	const keep = <T extends { key: string }>(list: T[]) =>
		list.filter((x) => !ignored.has(x.key));
	return {
		duplicates: keep(findDuplicateAccounts(profiles, logins)),
		repeated: keep(findRepeatedMembers(profiles)),
		alsoLinked: keep(findMembersAlsoLinked(profiles)),
		hasAccount: keep(findMembersWithAccount(profiles)),
		sharedCopies: keep(findSharedMemberCopies(profiles)),
		brokenLinks: keep(findBrokenLinks(profiles)),
	};
}

export type AllIssues = ReturnType<typeof findAllIssues>;

/**
 * Splits everything found into what still needs a look and what an admin
 * marked "not a problem" (so those can be looked at again). Keys of fixed
 * problems are simply not found any more and drop out of both.
 */
export function splitIgnored(
	all: AllIssues,
	ignored: Set<string>,
): { open: AllIssues; hidden: AllIssues } {
	const part = (hidden: boolean): AllIssues => {
		const keep = <T extends { key: string }>(list: T[]) =>
			list.filter((x) => ignored.has(x.key) === hidden);
		return {
			duplicates: keep(all.duplicates),
			repeated: keep(all.repeated),
			alsoLinked: keep(all.alsoLinked),
			hasAccount: keep(all.hasAccount),
			sharedCopies: keep(all.sharedCopies),
			brokenLinks: keep(all.brokenLinks),
		};
	};
	return { open: part(false), hidden: part(true) };
}

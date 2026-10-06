/**
 * Review status of the family members a devotee adds to their profile.
 *
 * Each member has its own status, so rejecting the main devotee no longer
 * rejects the whole family (and rejecting one member touches only that member).
 *
 * Rules:
 *  - A member with no saved status (every member added before this existed)
 *    shows the main devotee's status.
 *  - Approving the main devotee also approves members still waiting for review;
 *    a member the admin rejected stays rejected.
 *  - Rejecting or revoking the main devotee first writes every member's current
 *    status down (`freezeMemberStatuses`), so the change doesn't spread to them.
 *  - When the devotee adds a member or changes one, it goes back to "pending".
 */
import type { FamilyMember, UserProfile } from "../context/AuthContext";

export type MemberStatus = "pending" | "approved" | "rejected";

type ParentStatusFields = Pick<UserProfile, "isApproved" | "rejectionNote">;

export const profileStatus = (parent: ParentStatusFields): MemberStatus =>
	parent.isApproved
		? "approved"
		: parent.rejectionNote
			? "rejected"
			: "pending";

export const getFamilyMemberStatus = (
	member: FamilyMember,
	parent: ParentStatusFields,
): MemberStatus => member.approvalStatus ?? profileStatus(parent);

/** A member with its status set — never with undefined keys (Firestore rejects them). */
export const withMemberStatus = (
	member: FamilyMember,
	status: MemberStatus,
	note = "",
	now = Date.now(),
): FamilyMember => {
	const {
		approvalStatus: _s,
		rejectionNote: _n,
		approvalDate: _d,
		...rest
	} = member;
	return {
		...rest,
		approvalStatus: status,
		...(status === "rejected" && note ? { rejectionNote: note } : {}),
		...(status === "approved" ? { approvalDate: now } : {}),
	};
};

/**
 * Writes every inherited status down, before the parent's status changes.
 * An inherited rejection becomes "pending": those members were never judged
 * on their own, only swept along by the old whole-family rejection.
 */
export const freezeMemberStatuses = (
	members: FamilyMember[],
	parent: ParentStatusFields,
): FamilyMember[] => {
	const inherited = profileStatus(parent);
	return members.map((m) =>
		m.approvalStatus
			? m
			: {
					...m,
					approvalStatus: inherited === "rejected" ? "pending" : inherited,
				},
	);
};

/**
 * The parent is being approved: members without their own decision are approved
 * with it. Only a member the admin rejected on its own stays rejected — one that
 * merely inherited an old rejection of the whole family is approved too.
 */
export const approvePendingMembers = (
	members: FamilyMember[],
	now = Date.now(),
): FamilyMember[] =>
	members.map((m) =>
		m.approvalStatus === "rejected" || m.approvalStatus === "approved"
			? m
			: withMemberStatus(m, "approved", "", now),
	);

/** Fields whose change sends a member back for review (relation doesn't). */
const REVIEWED_FIELDS: (keyof FamilyMember)[] = [
	"realName",
	"dikshaName",
	"guruName",
	"dikshaDate",
	"isAspiring",
	"photoURL",
];

export const memberNeedsReview = (
	before: FamilyMember | undefined,
	after: FamilyMember,
): boolean =>
	!before ||
	REVIEWED_FIELDS.some((f) => (before[f] ?? "") !== (after[f] ?? ""));

/**
 * The profile form holds the family list as it was when the screen opened. An
 * admin may have approved or rejected a member since then, so before saving,
 * take each unchanged member's review status from the live document — a Save
 * must never wipe an admin's decision. A member the devotee changed is sent
 * back for review instead.
 */
export const mergeReviewState = (
	formMembers: FamilyMember[],
	liveMembers: FamilyMember[] = [],
): FamilyMember[] =>
	formMembers.map((m) => {
		const live = liveMembers.find((l) => l.id === m.id);
		if (!live) return m;
		if (memberNeedsReview(live, m))
			return m.approvalStatus === "pending"
				? m
				: withMemberStatus(m, "pending");
		const {
			approvalStatus: _s,
			rejectionNote: _n,
			approvalDate: _d,
			...rest
		} = m;
		return {
			...rest,
			...(live.approvalStatus ? { approvalStatus: live.approvalStatus } : {}),
			...(live.rejectionNote ? { rejectionNote: live.rejectionNote } : {}),
			...(live.approvalDate ? { approvalDate: live.approvalDate } : {}),
		};
	});

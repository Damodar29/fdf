/**
 * What the devotee must fix after an admin review: their own profile and the
 * family members they added by hand. Drives the red dot on the header's
 * profile button, the notice at the top of Home and the one at the top of the
 * profile screen.
 *
 * Linked accounts (family on their own phones) are not included — they fix
 * their own profile; the profile screen shows their status separately.
 */
import type { UserProfile } from "../context/AuthContext";

export interface RejectionAlert {
	/** "self" = the devotee's own profile; otherwise a hand-added member. */
	kind: "self" | "member";
	name: string;
	/** The admin's reason (may be empty for old rejections). */
	note: string;
	memberId?: string;
}

type ProfileLike = Pick<
	UserProfile,
	"isApproved" | "rejectionNote" | "isDeleted" | "familyMembers" | "realName"
>;

export const rejectionAlerts = (
	profile: ProfileLike | null | undefined,
): RejectionAlert[] => {
	if (!profile || profile.isDeleted) return [];
	const out: RejectionAlert[] = [];
	if (!profile.isApproved && profile.rejectionNote)
		out.push({
			kind: "self",
			name: profile.realName || "",
			note: profile.rejectionNote === "—" ? "" : profile.rejectionNote,
		});
	// Only members the admin rejected on their own. A member without a status
	// of its own merely follows the devotee, whose rejection is listed above.
	for (const m of profile.familyMembers || [])
		if (m.approvalStatus === "rejected")
			out.push({
				kind: "member",
				name: m.realName || "",
				note: m.rejectionNote || "",
				memberId: m.id,
			});
	return out;
};

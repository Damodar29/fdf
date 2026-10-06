/**
 * Why a family member is added by hand instead of being linked: only for
 * those who can't make their own profile. Anyone who runs the app on their own
 * phone should be linked (their own account), so the "add by hand" form asks
 * for one of these first. Stored on the member as `noAppReason`. Not a
 * reviewed field (utils/familyApproval.ts).
 */
export type NoAppReason = "shared_phone" | "cannot_use" | "other";

export interface NoAppReasonOption {
	id: NoAppReason;
	emoji: string;
	/** As a choice in the form. */
	hi: string;
	en: string;
	/** Short badge on the member card; none for "other". */
	badgeHi?: string;
	badgeEn?: string;
}

export const NO_APP_REASONS: NoAppReasonOption[] = [
	{
		id: "shared_phone",
		emoji: "📱",
		hi: "घर में एक ही फ़ोन है",
		en: "We share one phone at home",
		badgeHi: "साझा फ़ोन",
		badgeEn: "Shared phone",
	},
	{
		id: "cannot_use",
		emoji: "🙋",
		hi: "फ़ोन या ऐप नहीं चला पाते",
		en: "Can't use a phone or the app",
		badgeHi: "ऐप नहीं चलाते",
		badgeEn: "Doesn't use the app",
	},
	{ id: "other", emoji: "✏️", hi: "कोई और कारण", en: "Another reason" },
];

export const noAppReasonOf = (
	value: string | undefined | null,
): NoAppReasonOption | undefined => NO_APP_REASONS.find((r) => r.id === value);

import { formatDistanceToNow } from "date-fns";
import { hi as hiLocale } from "date-fns/locale";
import {
	arrayRemove,
	arrayUnion,
	collection,
	deleteDoc,
	deleteField,
	doc,
	documentId,
	FieldPath,
	getDocs,
	onSnapshot,
	query,
	serverTimestamp,
	updateDoc,
	where,
	writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
	AlertTriangle,
	ArrowLeft,
	Bell,
	BellOff,
	Calendar,
	Camera,
	Check,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Clock,
	Copy,
	Crop,
	Download,
	Edit2,
	GitBranch,
	History,
	Info,
	KeyRound,
	Link,
	Link2Off,
	Loader2,
	MapPin,
	Mars,
	MessageCircle,
	Network,
	Phone,
	Search,
	Trash2,
	User,
	Users,
	Venus,
	X,
	XCircle,
} from "lucide-react";
import type React from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
	hasStartedProfile,
	type ReviewLogEntry,
	type UserProfile,
} from "../../../context/AuthContext";
import { PhotoCropper } from "../../../components/profile/PhotoCropper";
import { RelationPicker } from "../../../components/profile/RelationPicker";
import { useToast } from "../../../context/ToastContext";
// Fix: use main `storage` (not profileStorage) because the admin is authenticated via
// the main `auth` instance (AdminPanel.tsx line 6). profileStorage uses profileApp's auth
// which has no admin session → request.auth = null → Storage rules return 403.
import { auth, db, storage } from "../../../services/firebase";
import { MANDAL_LIST } from "../../../src/types/mandal";
import {
	deriveGuruSelection,
	GURU_OPTIONS,
	resolveGuruName,
} from "../../constants/guru";
import { noAppReasonOf } from "../../constants/familyMemberReasons";
import { getRelationLabel, normalizeRelation } from "../../constants/relations";
import { useAdminBack } from "../../hooks/useAdminBack";
import { usePopupBackHandler } from "../../hooks/usePopupBackHandler";
import { sendPushNotification } from "../../utils/sendPushNotification";
import {
	approvePendingMembers,
	freezeMemberStatuses,
	getFamilyMemberStatus,
	type MemberStatus,
	withMemberStatus,
} from "../../../utils/familyApproval";
import {
	type FamilyGroupFix,
	planAllFamilyGroupFixes,
	planFamilyGroupFix,
} from "../../../utils/familyGroupFix";
import {
	buildSearchEntry,
	type DevoteeSearchEntry,
	prepareDevoteeQuery,
	scoreDevotee,
} from "../../../utils/devoteeSearch";
import type { NetworkProfile } from "../../../utils/familyNetwork";
import { afterHistorySettles } from "../../../utils/historyPop";
import { EditHistorySheet } from "./EditHistorySheet";
import {
	type LoginFilter,
	LoginChip,
	LoginOverview,
	loginSummary,
	type OrphanLogin,
	samePhone,
} from "./LoginMethodsBar";
import { loginKind, useLoginMethods } from "./loginMethods";
import { AdminFamilyTreeSheet } from "./family/AdminFamilyTreeSheet";
import { ThumbImg } from "../../../components/ui/ThumbImg";
import { THUMB } from "../../../utils/imageThumb";

const formatDisplayDate = (dateStr: string, isHindi: boolean) => {
	if (!dateStr) return "";
	let yyyy, mm, dd;
	if (dateStr.includes("/")) {
		const parts = dateStr.split("/");
		if (parts.length === 3) {
			if (parts[2].length === 4) {
				// DD/MM/YYYY
				dd = parseInt(parts[0], 10);
				mm = parseInt(parts[1], 10);
				yyyy = parseInt(parts[2], 10);
			} else if (parts[0].length === 4) {
				// YYYY/MM/DD
				yyyy = parseInt(parts[0], 10);
				mm = parseInt(parts[1], 10);
				dd = parseInt(parts[2], 10);
			}
		}
	} else if (dateStr.includes("-")) {
		const parts = dateStr.split("-");
		if (parts.length === 3) {
			if (parts[0].length === 4) {
				// YYYY-MM-DD
				yyyy = parseInt(parts[0], 10);
				mm = parseInt(parts[1], 10);
				dd = parseInt(parts[2], 10);
			} else if (parts[2].length === 4) {
				// DD-MM-YYYY
				dd = parseInt(parts[0], 10);
				mm = parseInt(parts[1], 10);
				yyyy = parseInt(parts[2], 10);
			}
		}
	}

	if (
		yyyy &&
		mm &&
		dd &&
		!Number.isNaN(yyyy) &&
		!Number.isNaN(mm) &&
		!Number.isNaN(dd)
	) {
		try {
			const date = new Date(yyyy, mm - 1, dd);
			return date.toLocaleDateString(isHindi ? "hi-IN" : "en-US", {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
		} catch (_e) {
			return dateStr;
		}
	}
	return dateStr;
};

const toDateInputFormat = (dateStr: string) => {
	if (!dateStr) return "";
	if (dateStr.includes("/")) {
		const parts = dateStr.split("/");
		if (parts.length === 3) {
			const pad = (x: string) => x.padStart(2, "0");
			// YYYY/MM/DD (older entries) stays in order; DD/MM/YYYY is turned round.
			return parts[0].length === 4
				? `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`
				: `${parts[2]}-${pad(parts[1])}-${pad(parts[0])}`;
		}
	}
	if (dateStr.includes("-")) {
		const parts = dateStr.split("-");
		if (parts.length === 3 && parts[0].length === 2)
			return `${parts[2]}-${parts[1]}-${parts[0]}`;
	}
	return dateStr;
};

const fromDateInputFormat = (dateStr: string) => {
	if (!dateStr) return "";
	const parts = dateStr.split("-");
	if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
	return dateStr;
};

const CustomDropdown = ({
	value,
	onChange,
	options,
	placeholder,
	className,
	placeholderSelectable = true,
}: {
	value: string;
	onChange: (val: string) => void;
	options: { id: string; label: string }[];
	placeholder: string;
	className?: string;
	/**
	 * The placeholder is also a choice meaning "all" (list filters). Turn off
	 * in forms: choosing it there saved the text "all" as the mandal or guru.
	 */
	placeholderSelectable?: boolean;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	// Back closes the open list, not the form around it.
	useAdminBack(isOpen, () => setIsOpen(false));
	const selectedLabel =
		options.find((o) => o.id === value)?.label || placeholder;

	return (
		<div className={`relative ${className || ""}`}>
			{isOpen && (
				<div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
			)}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={`w-full min-h-[40px] flex items-center justify-between px-4 py-2 text-sm text-left bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 relative transition-colors ${
					// Above its backdrop only while open; closed, it must scroll under the
					// sticky search bar instead of over it.
					isOpen ? "z-40" : ""
				}`}
			>
				<span
					className={`truncate ${!value || value === "all" ? "text-slate-500" : "text-slate-800 dark:text-white"}`}
				>
					{selectedLabel}
				</span>
				<ChevronDown
					size={16}
					className={`text-slate-400 dark:text-ink-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>
			{isOpen && (
				<div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1">
					{placeholderSelectable && (
						<button
							type="button"
							className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${!value || value === "all" ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/20 font-medium" : "text-slate-700 dark:text-slate-300"}`}
							onClick={() => {
								onChange("all");
								setIsOpen(false);
							}}
						>
							{placeholder}
						</button>
					)}
					{options.map((opt) => (
						<button
							key={opt.id}
							type="button"
							className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${value === opt.id ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/20 font-medium" : "text-slate-700 dark:text-slate-300"}`}
							onClick={() => {
								onChange(opt.id);
								setIsOpen(false);
							}}
						>
							{opt.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
};

const PAGE_SIZE = 40;

/** Appends one admin decision to users/{uid}.reviewLog (see ReviewLogEntry). */
const logReview = (
	a: ReviewLogEntry["a"],
	extra: { note?: string; member?: string } = {},
	t = Date.now(),
) => {
	const by = auth.currentUser?.email?.split("@")[0] || "";
	const entry: ReviewLogEntry = { t, a };
	if (extra.note) entry.note = extra.note;
	if (extra.member) entry.member = extra.member;
	if (by) entry.by = by;
	return arrayUnion(entry);
};

/** Which tab a row belongs on (a row can be on "pending" and nowhere else). */
const rowTab = (
	p: DevoteeListRow,
): "deleted" | "pending" | "rejected" | "approved" | "other" =>
	p.isDeleted
		? "deleted"
		: // A devotee who merely dismissed the profile welcome wizard has a
			// placeholder users/{uid} document with nothing to review — it
			// stays out of the queue (still listed under "All").
			hasStartedProfile(p) &&
				((!p.isApproved && !p.rejectionNote) || p.hasPendingEdits)
			? "pending"
			: !p.isApproved && p.rejectionNote
				? "rejected"
				: p.isApproved && !p.hasPendingEdits
					? "approved"
					: "other";

type RowStatus = "pending" | "approved" | "rejected" | "deleted";

/** The one status a card shows (edits waiting show as their own badge). */
const rowStatus = (p: DevoteeListRow): RowStatus =>
	p.isDeleted
		? "deleted"
		: p.isApproved
			? "approved"
			: p.rejectionNote
				? "rejected"
				: "pending";

const StatusChip: React.FC<{ status: RowStatus; isHindi: boolean }> = ({
	status,
	isHindi,
}) => {
	const look: Record<RowStatus, [string, string, string]> = {
		pending: [
			"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
			"लंबित",
			"Pending",
		],
		approved: [
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
			"स्वीकृत",
			"Approved",
		],
		rejected: [
			"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
			"अस्वीकृत",
			"Rejected",
		],
		deleted: [
			"bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
			"डिलीट",
			"Deleted",
		],
	};
	const [cls, hi, en] = look[status];
	return (
		<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cls}`}>
			{isHindi ? hi : en}
		</span>
	);
};

/** Round photo (or a person icon) for rows inside the edit screen. */
const MiniAvatar: React.FC<{ photoURL?: string }> = ({ photoURL }) => (
	<span className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
		{photoURL ? (
			<ThumbImg src={photoURL} className="w-full h-full object-cover" />
		) : (
			<User size={18} className="text-slate-400" />
		)}
	</span>
);

/** One "label: value" line in an opened card. */
const DetailRow: React.FC<{
	icon: React.ReactNode;
	label: string;
	children: React.ReactNode;
}> = ({ icon, label, children }) => (
	<div className="flex items-start gap-1.5 min-w-0">
		<span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
		<dt className="shrink-0 text-slate-400 dark:text-slate-500">{label}:</dt>
		<dd className="min-w-0 break-words font-medium text-slate-700 dark:text-slate-200">
			{children}
		</dd>
	</div>
);

const ACTION_TONES = {
	approve: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
	warn: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40",
	danger:
		"bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40",
	"danger-solid": "bg-red-500 text-white hover:bg-red-600 shadow-sm",
	neutral:
		"bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700",
	info: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40",
} as const;

const ActionButton: React.FC<{
	tone: keyof typeof ACTION_TONES;
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
}> = ({ tone, icon, label, onClick }) => (
	<button
		type="button"
		onClick={onClick}
		className={`sm:flex-1 min-h-touch px-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors active:scale-95 ${ACTION_TONES[tone]}`}
	>
		{icon}
		{label}
	</button>
);

const editInputClass =
	"w-full min-h-touch bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all";

/** A titled group of fields in the edit screen. */
const EditSection: React.FC<{ title: string; children: React.ReactNode }> = ({
	title,
	children,
}) => (
	<section className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3.5">
		<h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
			{title}
		</h3>
		{children}
	</section>
);

const EditField: React.FC<{
	label: string;
	hint?: string;
	children: React.ReactNode;
}> = ({ label, hint, children }) => (
	<div>
		<p className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
			{label}
		</p>
		{children}
		{hint && (
			<p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
				{hint}
			</p>
		)}
	</div>
);

/** The fields the edit screen changes — to tell if anything is unsaved. */
const editSignature = (p: DevoteeListRow | null) =>
	p
		? JSON.stringify([
				p.realName,
				p.dikshaName,
				p.guruName,
				p.dikshaDate,
				p.mandalId,
				p.phoneNumber,
				p.personalExperience,
				!!p.isAspiring,
				p.photoURL,
				p.familyRelation,
				p.gender,
				p.customMandalName,
			])
		: "";

/**
 * Last-seen times read in this app session, reused for 10 minutes: opening
 * Devotee Management again doesn't read every user_last_seen document again.
 */
let lastSeenCache: {
	key: string;
	at: number;
	map: Record<string, number>;
} | null = null;
const LAST_SEEN_TTL = 10 * 60 * 1000;

/**
 * One spelling for a typed Indian number ("98290 12345", "098290…",
 * "+91-98290…" → "+919829012345") so phone search and family linking find
 * it. Anything else is kept as typed.
 */
const cleanPhone = (phone: string | undefined) => {
	const t = (phone || "").trim();
	if (!t || t === "+91") return "";
	const digits = t.replace(/\D/g, "");
	const last10 =
		digits.length === 10
			? digits
			: (digits.length === 11 && digits.startsWith("0")) ||
					(digits.length === 12 && digits.startsWith("91"))
				? digits.slice(-10)
				: "";
	return last10 ? `+91${last10}` : t;
};

/** WhatsApp needs the country code: a plain 10-digit number is Indian. */
const whatsappNumber = (phone: string) => {
	const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
	return digits.length === 10 ? `91${digits}` : digits;
};

type DevoteeListRow = UserProfile & {
	rowId: string;
	parentUid: string;
	memberType: "primary" | "family";
	familyMemberId?: string;
	familyIndex?: number;
	parentName?: string;
	/** Family rows only: how this member is related to the parent devotee. */
	familyRelation?: string;
	/** Family rows only: why they were added by hand instead of linked. */
	familyNoAppReason?: string;
	/** Family rows only: this member's own review status. */
	familyStatus?: MemberStatus;
};

// ════════════════════════════════════════════════════════════════
// buildProfileRows: pure function — no closure over component state.
// Moved outside the component to avoid useMemo dep suppression.
// ════════════════════════════════════════════════════════════════
const buildProfileRows = (profile: UserProfile): DevoteeListRow[] => {
	const primaryRow: DevoteeListRow = {
		...profile,
		rowId: `${profile.uid}__primary`,
		parentUid: profile.uid,
		memberType: "primary",
	};

	const familyRows: DevoteeListRow[] = (profile.familyMembers || []).map(
		(member, index) => {
			const status = getFamilyMemberStatus(member, profile);
			return {
				...profile,
				// Each member has its own review status (utils/familyApproval.ts) —
				// rejecting the devotee no longer shows the whole family as rejected.
				isApproved: status === "approved",
				rejectionNote:
					status === "rejected"
						? member.rejectionNote ||
							(member.approvalStatus ? "" : profile.rejectionNote) ||
							"—"
						: "",
				approvalDate:
					status === "approved"
						? member.approvalDate || profile.approvalDate
						: undefined,
				hasPendingEdits: false,
				resubmitted: false,
				familyStatus: status,
				realName: member.realName,
				dikshaName: member.dikshaName,
				guruName: member.guruName,
				dikshaDate: member.dikshaDate,
				isAspiring: member.isAspiring,
				photoURL: member.photoURL || "", // ← use member's own photo, not primary user's
				// The devotee's own text, not the member's — keep it off their card.
				personalExperience: "",
				rowId: `${profile.uid}__family__${member.id}`,
				parentUid: profile.uid,
				memberType: "family",
				familyMemberId: member.id,
				familyIndex: index,
				parentName: profile.realName || profile.email || "",
				familyRelation: member.relation || "",
				familyNoAppReason: member.noAppReason || "",
			};
		},
	);

	return [primaryRow, ...familyRows];
};

// ════════════════════════════════════════════════════════════════
// ADMIN FAMILY LINKING PANEL
// Full admin control over family account linkage for any user.
// ════════════════════════════════════════════════════════════════

/**
 * updateDoc/batch.update field–value pairs that link `otherUid` onto a profile.
 * Mirrors familyLinkFields() in functions/src/index.ts. The syncFamilyLinkGroups
 * Cloud Function then links the rest of both families automatically.
 */
export const familyLinkArgs = (
	otherUid: string,
	relation: string,
): [FieldPath, unknown, ...unknown[]] => [
	new FieldPath("linkedFamilyMembers"),
	arrayUnion(otherUid),
	// A direct link replaces any "linked through someone" marker.
	new FieldPath("linkedFamilyVia", otherUid),
	deleteField(),
	// A relation given here is a chosen one, not filled in automatically.
	new FieldPath("linkedFamilyRelationsAuto", otherUid),
	deleteField(),
	...(relation
		? [new FieldPath("linkedFamilyRelations", otherUid), relation]
		: []),
];

export const familyUnlinkArgs = (
	otherUid: string,
): [FieldPath, unknown, ...unknown[]] => [
	new FieldPath("linkedFamilyMembers"),
	arrayRemove(otherUid),
	new FieldPath("linkedFamilyRelations", otherUid),
	deleteField(),
	new FieldPath("linkedFamilyRelationsAuto", otherUid),
	deleteField(),
	new FieldPath("linkedFamilyVia", otherUid),
	deleteField(),
];

/**
 * Writes planned family-group fixes: new links with a "linked through" marker
 * and filled-in relations (recorded as automatic). Adds only. A batch holds at
 * most 500 writes, so profiles go in chunks. Returns how many were updated.
 */
async function commitFamilyPlans(plans: FamilyGroupFix[]): Promise<number> {
	const perUid = new Map<string, unknown[]>();
	for (const plan of plans) {
		const uids = new Set([
			...plan.linkAdds.keys(),
			...plan.relationAdds.keys(),
		]);
		for (const uid of uids) {
			const fields = perUid.get(uid) || [];
			const adds = plan.linkAdds.get(uid) || [];
			if (adds.length > 0) {
				fields.push(
					new FieldPath("linkedFamilyMembers"),
					arrayUnion(...adds.map((a) => a.other)),
				);
				for (const { other, via } of adds) {
					fields.push(new FieldPath("linkedFamilyVia", other), via);
				}
			}
			for (const [other, relation] of Object.entries(
				plan.relationAdds.get(uid) || {},
			)) {
				// Recorded as filled-in, so the Cloud Function may update it later.
				fields.push(
					new FieldPath("linkedFamilyRelations", other),
					relation,
					new FieldPath("linkedFamilyRelationsAuto", other),
					relation,
				);
			}
			perUid.set(uid, fields);
		}
	}
	const entries = [...perUid].filter(([, fields]) => fields.length > 0);
	let written = 0;
	for (let i = 0; i < entries.length; i += 400) {
		const batch = writeBatch(db);
		for (const [uid, fields] of entries.slice(i, i + 400)) {
			const [field, value, ...rest] = fields;
			batch.update(doc(db, "users", uid), field as FieldPath, value, ...rest);
		}
		await batch.commit();
		written += Math.min(400, entries.length - i);
	}
	return written;
}

const profileName = (p?: Partial<UserProfile> | null) =>
	p?.realName || p?.dikshaName || p?.email || p?.phoneNumber || "—";

/**
 * Super admin only: families whose links were made before automatic group
 * merging (26 Sep 2026) and so never joined up — e.g. A–B and B–C linked but
 * not A–C. Shows how many, and links them all in one go.
 */
export const FamilyGroupsReport: React.FC<{
	profiles: UserProfile[];
	isHindi: boolean;
}> = ({ profiles, isHindi }) => {
	const { showToast } = useToast();
	const [fixing, setFixing] = useState(false);
	const report = useMemo(() => planAllFamilyGroupFixes(profiles), [profiles]);
	if (report.plans.length === 0 && report.tooBig.length === 0) return null;

	const nameOf = (uid: string) =>
		profileName(profiles.find((p) => p.uid === uid));

	const fixAll = async () => {
		const examples = report.plans
			.slice(0, 5)
			.map((plan) => plan.members.slice(0, 3).map(nameOf).join(", "))
			.join("\n• ");
		if (
			!confirm(
				isHindi
					? `${report.plans.length} परिवारों में ${report.newLinks} नए लिंक और ${report.newRelations} रिश्ते जोड़े जाएँगे। कुछ भी हटाया या बदला नहीं जाएगा।\n\n• ${examples}\n\nआगे बढ़ें?`
					: `${report.newLinks} new link(s) and ${report.newRelations} relation(s) will be added across ${report.plans.length} families. Nothing is removed or changed.\n\n• ${examples}\n\nContinue?`,
			)
		)
			return;
		setFixing(true);
		try {
			const n = await commitFamilyPlans(report.plans);
			showToast(
				isHindi
					? `सभी परिवार जोड़ दिए गए ✅ (${n} प्रोफ़ाइल)`
					: `All families linked ✅ (${n} profiles)`,
				"success",
			);
		} catch (err) {
			console.error("Fix all families error:", err);
			showToast(
				isHindi
					? "कुछ परिवार नहीं जुड़ सके। दोबारा दबाएँ — जो जुड़ चुके हैं वे दोबारा नहीं बदलेंगे।"
					: "Some families could not be linked. Press again — ones already done are not touched twice.",
				"error",
			);
		} finally {
			setFixing(false);
		}
	};

	return (
		<div className="rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5 space-y-2">
			{report.plans.length > 0 && (
				<div className="flex items-center gap-3">
					<Users
						size={16}
						className="shrink-0 text-amber-600 dark:text-amber-400"
					/>
					<p className="flex-1 min-w-0 text-xs font-bold text-amber-800 dark:text-amber-300 leading-snug">
						{isHindi
							? `${report.plans.length} परिवार अधूरे जुड़े हैं — ${report.newLinks} लिंक, ${report.newRelations} रिश्ते बाकी`
							: `${report.plans.length} families only partly linked — ${report.newLinks} links, ${report.newRelations} relations missing`}
					</p>
					<button
						type="button"
						onClick={fixAll}
						disabled={fixing}
						className="shrink-0 min-h-touch px-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
					>
						{fixing ? (
							<Loader2 size={14} className="animate-spin" />
						) : (
							<Link size={14} />
						)}
						{isHindi ? "सब ठीक करें" : "Fix all"}
					</button>
				</div>
			)}
			{report.tooBig.length > 0 && (
				<p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
					{isHindi
						? `${report.tooBig.length} परिवार समूह बहुत बड़े हैं (60+ खाते) और छोड़े गए — शायद कोई गलत लिंक है: `
						: `${report.tooBig.length} family group(s) are too big (60+ accounts) and were skipped — probably a wrong link: `}
					{report.tooBig
						.map((g) => g.members.slice(0, 2).map(nameOf).join(", "))
						.join(" · ")}
				</p>
			)}
		</div>
	);
};

/** One side of a link's relation ("Suresh is Ramesh's Father"), editable inline. */
const AdminRelationRow: React.FC<{
	label: string;
	value: string;
	isHindi: boolean;
	onSave: (value: string) => Promise<boolean>;
}> = ({ label, value, isHindi, onSave }) => {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const [saving, setSaving] = useState(false);
	// Back cancels this inline edit (like its X), not the whole profile.
	useAdminBack(editing, () => setEditing(false));

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => {
					setDraft(value);
					setEditing(true);
				}}
				className="w-full flex items-center gap-2 text-left text-[11px] rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
			>
				<span className="flex-1 min-w-0 truncate text-slate-500 dark:text-slate-400">
					{label}
				</span>
				<span
					className={`shrink-0 max-w-[45%] truncate ${value ? "font-bold text-blue-600 dark:text-blue-400" : "italic text-slate-400 dark:text-ink-400"}`}
				>
					{value
						? getRelationLabel(value, isHindi)
						: isHindi
							? "सेट नहीं"
							: "not set"}
				</span>
				<Edit2 size={11} className="shrink-0 text-slate-400" />
			</button>
		);
	}

	return (
		<div className="rounded-lg bg-slate-100/70 dark:bg-slate-800/70 p-2 space-y-2">
			<p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
				{label}
			</p>
			<RelationPicker
				value={draft}
				onChange={setDraft}
				isHindi={isHindi}
				accent="blue"
				size="sm"
			/>
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => setEditing(false)}
					className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300"
				>
					{isHindi ? "रद्द" : "Cancel"}
				</button>
				<button
					type="button"
					disabled={saving}
					onClick={async () => {
						setSaving(true);
						const ok = await onSave(normalizeRelation(draft));
						setSaving(false);
						if (ok) setEditing(false);
					}}
					className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-blue-500 text-white disabled:opacity-50 flex items-center justify-center gap-1"
				>
					{saving ? (
						<Loader2 size={12} className="animate-spin" />
					) : (
						<Check size={12} />
					)}
					{isHindi ? "सेव" : "Save"}
				</button>
			</div>
		</div>
	);
};

const AdminFamilyLinkingPanel: React.FC<{
	profile: DevoteeListRow;
	allProfiles: UserProfile[];
	isHindi: boolean;
	/** Opens another person's edit screen (a linked relative, a requester). */
	onOpenProfile?: (uid: string, memberId?: string) => void;
}> = ({ profile, allProfiles, isHindi, onOpenProfile }) => {
	/** A name that opens that person's edit screen. */
	const nameLink = (uid: string | undefined, name: React.ReactNode) =>
		onOpenProfile && uid ? (
			<button
				type="button"
				onClick={() => onOpenProfile(uid)}
				className="text-left text-blue-700 dark:text-blue-300 underline decoration-dotted underline-offset-2"
			>
				{name}
			</button>
		) : (
			name
		);
	const { showToast } = useToast();
	const [pendingRequests, setPendingRequests] = useState<any[]>([]);
	const [sentRequests, setSentRequests] = useState<any[]>([]);
	const [forceSearchQuery, setForceSearchQuery] = useState("");
	const [forceSearchResults, setForceSearchResults] = useState<UserProfile[]>(
		[],
	);
	const [forceTarget, setForceTarget] = useState<UserProfile | null>(null);
	const [forceRelationThis, setForceRelationThis] = useState("");
	const [forceRelationOther, setForceRelationOther] = useState("");
	const [forceSearchError, setForceSearchError] = useState("");
	const [forceLinking, setForceLinking] = useState(false);
	const [unlinking, setUnlinking] = useState<string | null>(null);
	const [joiningFamily, setJoiningFamily] = useState(false);
	const [loadingRequests, setLoadingRequests] = useState(true);
	const [treeFor, setTreeFor] = useState<string | null>(null);

	// Live copy of this devotee's document (the edit panel holds a snapshot).
	const self = allProfiles.find((p) => p.uid === profile.uid) || profile;
	const selfName = profileName(self);

	// Listen to pending requests TO this user
	useEffect(() => {
		setLoadingRequests(true);
		const q = query(
			collection(db, "familyLinkRequests"),
			where("toUserId", "==", profile.uid),
			where("status", "==", "pending"),
		);
		const unsub = onSnapshot(
			q,
			(snap) => {
				setPendingRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
				setLoadingRequests(false);
			},
			(err) => {
				console.error("Failed to listen to link requests", err);
				setLoadingRequests(false);
			},
		);
		return () => unsub();
	}, [profile.uid]);

	// …and requests this user SENT that are still waiting
	useEffect(() => {
		const q = query(
			collection(db, "familyLinkRequests"),
			where("fromUserId", "==", profile.uid),
			where("status", "==", "pending"),
		);
		const unsub = onSnapshot(
			q,
			(snap) =>
				setSentRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
			(err) => console.error("Failed to listen to sent link requests", err),
		);
		return () => unsub();
	}, [profile.uid]);

	const linkedMembers = useMemo(() => {
		const uids = self.linkedFamilyMembers || [];
		return allProfiles.filter((p) => uids.includes(p.uid));
	}, [self.linkedFamilyMembers, allProfiles]);
	// Linked uids the admin cannot see (e.g. another mandal for a mandal admin).
	const hiddenLinkedCount =
		(self.linkedFamilyMembers?.length || 0) - linkedMembers.length;

	// Force-link search — every match, not just the first, so a common name
	// doesn't hide the right person.
	const handleForceSearch = () => {
		const q = prepareDevoteeQuery(forceSearchQuery);
		if (!q.text) return;
		const alreadyLinked = new Set(self.linkedFamilyMembers || []);
		// Hindi, English and Hinglish spellings all match ("vishakha" / "विशाखा").
		const found = allProfiles
			.filter((p) => {
				if (p.uid === profile.uid || p.isDeleted) return false;
				if (alreadyLinked.has(p.uid)) return false;
				return !(p.linkedFamilyMembers || []).includes(profile.uid);
			})
			.map((p) => ({
				p,
				score: scoreDevotee(
					buildSearchEntry(
						[p.realName, p.dikshaName],
						[p.email, p.uid],
						[p.phoneNumber],
					),
					q,
				),
			}))
			.filter((r) => r.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, 8)
			.map((r) => r.p);
		setForceSearchResults(found);
		setForceTarget(found.length === 1 ? found[0] : null);
		setForceRelationThis("");
		setForceRelationOther("");
		setForceSearchError(
			found.length === 0
				? isHindi
					? "कोई उपयोगकर्ता नहीं मिला"
					: "No user found"
				: "",
		);
	};

	// Force-link two users directly (admin-only). One batch, so a permission
	// failure on either document leaves neither half-linked.
	const handleForceLink = async () => {
		if (!forceTarget) return;
		setForceLinking(true);
		try {
			const batch = writeBatch(db);
			batch.update(
				doc(db, "users", profile.uid),
				...familyLinkArgs(
					forceTarget.uid,
					normalizeRelation(forceRelationThis),
				),
			);
			batch.update(
				doc(db, "users", forceTarget.uid),
				...familyLinkArgs(profile.uid, normalizeRelation(forceRelationOther)),
			);
			await batch.commit();
			setForceSearchResults([]);
			setForceTarget(null);
			setForceSearchQuery("");
			setForceRelationThis("");
			setForceRelationOther("");
			showToast(
				isHindi
					? "परिवार खाते जोड़ दिए गए ✅"
					: "Accounts linked successfully ✅",
				"success",
			);
		} catch (err) {
			console.error("Force link error:", err);
			showToast(isHindi ? "जोड़ने में त्रुटि" : "Error linking accounts", "error");
			setForceLinking(false);
			return;
		}
		// Housekeeping: requests between the two are now moot. Failure here does
		// not undo the link, so it must not be reported as a linking error.
		try {
			const reqSnap = await getDocs(
				query(
					collection(db, "familyLinkRequests"),
					where("fromUserId", "in", [profile.uid, forceTarget.uid]),
					where("toUserId", "in", [profile.uid, forceTarget.uid]),
				),
			);
			if (!reqSnap.empty) {
				const batch = writeBatch(db);
				reqSnap.docs.forEach((d) => batch.delete(d.ref));
				await batch.commit();
			}
		} catch (err) {
			console.warn("Link request cleanup failed:", err);
		} finally {
			setForceLinking(false);
		}
	};

	// Unlink two users, clearing both sides' relation / "linked through" labels.
	const handleUnlink = async (other: UserProfile) => {
		if (
			!confirm(
				isHindi
					? `${selfName} और ${profileName(other)} का लिंक हटाएं?`
					: `Unlink ${selfName} and ${profileName(other)}?`,
			)
		)
			return;
		setUnlinking(other.uid);
		try {
			const batch = writeBatch(db);
			batch.update(
				doc(db, "users", profile.uid),
				...familyUnlinkArgs(other.uid),
			);
			batch.update(
				doc(db, "users", other.uid),
				...familyUnlinkArgs(profile.uid),
			);
			await batch.commit();
			showToast(isHindi ? "खाते अलग कर दिए गए" : "Accounts unlinked", "success");
		} catch (err) {
			console.error("Unlink error:", err);
			showToast(isHindi ? "अलग करने में त्रुटि" : "Error unlinking", "error");
		} finally {
			setUnlinking(null);
		}
	};

	// Links made before automatic group merging (26 Sep 2026) never joined the
	// rest of the family: link everyone in this devotee's family group to each
	// other, and fill in relations only one side has set. Adds only — nothing
	// existing is changed. The Cloud Function skips these writes (they carry a
	// linkedFamilyVia marker), so it does not merge anything further.
	const handleJoinWholeFamily = async () => {
		const plan = planFamilyGroupFix(profile.uid, allProfiles);
		if (plan.tooBig) {
			showToast(
				isHindi
					? `यह परिवार समूह बहुत बड़ा है (${plan.members.length}+ खाते)। किसी गलत लिंक की जाँच करें।`
					: `This family group is too big (${plan.members.length}+ accounts). Check for a wrong link.`,
				"error",
			);
			return;
		}
		if (plan.newLinks === 0 && plan.newRelations === 0) {
			showToast(
				isHindi
					? "इस परिवार के सभी खाते पहले से आपस में जुड़े हैं"
					: "Everyone in this family is already linked",
				"info",
			);
			return;
		}
		const names = plan.members
			.map((uid) => profileName(allProfiles.find((p) => p.uid === uid)))
			.join(", ");
		if (
			!confirm(
				isHindi
					? `परिवार: ${names}\n\n${plan.newLinks} नए लिंक और ${plan.newRelations} रिश्ते जोड़े जाएँगे। आगे बढ़ें?`
					: `Family: ${names}\n\n${plan.newLinks} new link(s) and ${plan.newRelations} relation(s) will be added. Continue?`,
			)
		)
			return;

		setJoiningFamily(true);
		try {
			await commitFamilyPlans([plan]);
			showToast(
				isHindi
					? `परिवार जोड़ दिया गया ✅ (${plan.newLinks} लिंक, ${plan.newRelations} रिश्ते)`
					: `Family linked ✅ (${plan.newLinks} links, ${plan.newRelations} relations)`,
				"success",
			);
		} catch (err) {
			console.error("Join whole family error:", err);
			showToast(
				isHindi
					? "परिवार जोड़ने में त्रुटि। कुछ भी नहीं बदला गया।"
					: "Could not link the family. Nothing was changed.",
				"error",
			);
		} finally {
			setJoiningFamily(false);
		}
	};

	// Admin accept a link request — same result as the devotee accepting it.
	const handleAdminAccept = async (req: any) => {
		try {
			const batch = writeBatch(db);
			batch.update(
				doc(db, "users", req.fromUserId),
				...familyLinkArgs(req.toUserId, normalizeRelation(req.fromRelation)),
			);
			batch.update(
				doc(db, "users", req.toUserId),
				...familyLinkArgs(req.fromUserId, ""),
			);
			batch.update(doc(db, "familyLinkRequests", req.id), {
				status: "accepted",
			});
			await batch.commit();
			showToast(isHindi ? "अनुरोध स्वीकार किया" : "Request accepted", "success");
		} catch (err) {
			console.error("Admin accept error:", err);
			showToast(isHindi ? "स्वीकार करने में त्रुटि" : "Error accepting", "error");
		}
	};

	// Admin reject a link request
	const handleAdminReject = async (reqId: string) => {
		try {
			await updateDoc(doc(db, "familyLinkRequests", reqId), {
				status: "rejected",
				rejectedBy: "admin",
				updatedAt: serverTimestamp(),
			});
			showToast(isHindi ? "अनुरोध अस्वीकार किया" : "Request rejected", "success");
		} catch (err) {
			console.error("Admin reject error:", err);
			showToast(isHindi ? "अस्वीकार करने में त्रुटि" : "Error rejecting", "error");
		}
	};

	const handleCancelSent = async (reqId: string) => {
		try {
			await deleteDoc(doc(db, "familyLinkRequests", reqId));
			showToast(isHindi ? "अनुरोध रद्द किया" : "Request cancelled", "success");
		} catch (err) {
			console.error("Cancel request error:", err);
			showToast(isHindi ? "रद्द करने में त्रुटि" : "Error cancelling", "error");
		}
	};

	// Saves the relation `ownerUid` has set for `otherUid`.
	const saveRelation = async (
		ownerUid: string,
		otherUid: string,
		value: string,
	): Promise<boolean> => {
		try {
			await updateDoc(
				doc(db, "users", ownerUid),
				new FieldPath("linkedFamilyRelations", otherUid),
				value || deleteField(),
				// Chosen by an admin: no longer an automatic one.
				new FieldPath("linkedFamilyRelationsAuto", otherUid),
				deleteField(),
			);
			showToast(isHindi ? "रिश्ता सहेजा गया" : "Relation saved", "success");
			return true;
		} catch (err) {
			console.error("Save relation error:", err);
			showToast(
				isHindi ? "रिश्ता सहेजने में त्रुटि" : "Error saving relation",
				"error",
			);
			return false;
		}
	};

	/** "B is A's …" in the admin's language. */
	const relationLabel = (subject: string, owner: string) =>
		isHindi ? `${subject} — ${owner} के…` : `${subject} is ${owner}'s…`;

	return (
		<div className="space-y-4 mt-2">
			{/* Section header */}
			<div className="flex items-center gap-2 px-1">
				<div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
				<span className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
					<Users size={13} /> {isHindi ? "परिवार लिंकिंग" : "Family Linking"}
				</span>
				<div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
			</div>

			{/* Currently linked accounts */}
			<div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
				<p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
					🔗 {isHindi ? "जुड़े हुए खाते" : "Linked Accounts"} (
					{self.linkedFamilyMembers?.length || 0})
				</p>
				{(linkedMembers.length > 0 ||
					(self.familyMembers?.length ?? 0) > 0) && (
					<button
						type="button"
						onClick={() => setTreeFor(profile.uid)}
						className="mb-3 w-full min-h-touch flex items-center justify-center gap-2 rounded-xl bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-900 text-sm font-bold text-pink-600 dark:text-pink-400 active:scale-[0.98] transition"
					>
						<GitBranch size={15} />
						{isHindi ? "परिवार वृक्ष देखें" : "View family tree"}
					</button>
				)}
				{linkedMembers.length === 0 ? (
					<p className="text-sm text-slate-400 dark:text-ink-400">
						{isHindi ? "कोई जुड़ा हुआ खाता नहीं है" : "No linked accounts"}
					</p>
				) : (
					<div className="space-y-2">
						{linkedMembers.map((m) => {
							const viaUid = self.linkedFamilyVia?.[m.uid];
							const via = viaUid
								? allProfiles.find((p) => p.uid === viaUid)
								: undefined;
							return (
								<div
									key={m.uid}
									className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2.5"
								>
									<div className="flex items-center gap-3">
										{m.photoURL ? (
											<ThumbImg
												src={m.photoURL}
												alt=""
												className="w-9 h-9 rounded-full object-cover shrink-0"
											/>
										) : (
											<div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
												<User size={16} className="text-emerald-600" />
											</div>
										)}
										<div className="flex-1 min-w-0">
											<p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
												{nameLink(m.uid, profileName(m))}
												{m.isDeleted && (
													<span className="ml-1 text-[10px] font-bold text-red-400">
														{isHindi ? "(हटाई गई)" : "(deleted)"}
													</span>
												)}
											</p>
											<p className="text-[11px] text-slate-400 dark:text-ink-400 truncate">
												{viaUid
													? isHindi
														? `🔗 ${via ? profileName(via) : "परिवार"} के ज़रिए अपने-आप जुड़ा`
														: `🔗 Auto-linked via ${via ? profileName(via) : "family"}`
													: m.phoneNumber || m.email}
											</p>
										</div>
										<button
											type="button"
											onClick={() => handleUnlink(m)}
											disabled={unlinking === m.uid}
											className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-50 active:scale-95 shrink-0"
											title={isHindi ? "अलग करें" : "Unlink"}
											aria-label={isHindi ? "अलग करें" : "Unlink"}
										>
											{unlinking === m.uid ? (
												<Loader2 size={14} className="animate-spin" />
											) : (
												<Link2Off size={14} />
											)}
										</button>
									</div>
									<div className="mt-1.5 space-y-0.5">
										<AdminRelationRow
											label={relationLabel(profileName(m), selfName)}
											value={self.linkedFamilyRelations?.[m.uid] || ""}
											isHindi={isHindi}
											onSave={(v) => saveRelation(profile.uid, m.uid, v)}
										/>
										<AdminRelationRow
											label={relationLabel(selfName, profileName(m))}
											value={m.linkedFamilyRelations?.[profile.uid] || ""}
											isHindi={isHindi}
											onSave={(v) => saveRelation(m.uid, profile.uid, v)}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
				{hiddenLinkedCount > 0 && (
					<p className="text-[11px] text-slate-400 dark:text-ink-400 mt-2">
						{isHindi
							? `+${hiddenLinkedCount} खाते जो आपकी सूची में नहीं हैं (दूसरे मंडल के या हटाए गए)`
							: `+${hiddenLinkedCount} account(s) outside your list (another mandal, or removed)`}
					</p>
				)}
				{linkedMembers.length > 0 && (
					<>
						<button
							type="button"
							onClick={handleJoinWholeFamily}
							disabled={joiningFamily}
							className="mt-3 w-full min-h-touch flex items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800/50 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 active:scale-[0.98]"
						>
							{joiningFamily ? (
								<Loader2 size={15} className="animate-spin" />
							) : (
								<Network size={15} />
							)}
							{isHindi
								? "पूरे परिवार को आपस में जोड़ें"
								: "Link the whole family together"}
						</button>
						<p className="text-[11px] text-slate-400 dark:text-ink-400 mt-1.5 leading-snug">
							{isHindi
								? "पुराने लिंक वाले परिवारों के लिए: इस परिवार के सभी खाते एक-दूसरे से जुड़ जाएँगे।"
								: "For families linked before auto-linking: everyone in this family gets linked to each other."}
						</p>
					</>
				)}
			</div>

			{/* Pending requests */}
			{!loadingRequests && pendingRequests.length > 0 && (
				<div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/30">
					<p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-3">
						🕐 {isHindi ? "लंबित अनुरोध" : "Pending Requests"} (
						{pendingRequests.length})
					</p>
					<div className="space-y-2">
						{pendingRequests.map((req) => (
							<div
								key={req.id}
								className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl p-3"
							>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
										{nameLink(
											req.fromUserId,
											req.fromUserName || req.fromUserId?.slice(0, 10),
										)}
									</p>
									<p className="text-[11px] text-amber-500 truncate">
										{req.fromRelation
											? isHindi
												? `"${getRelationLabel(req.fromRelation, true)}" के रूप में जोड़ना चाहते हैं`
												: `wants to link as their ${getRelationLabel(req.fromRelation, false)}`
											: isHindi
												? "लिंक करना चाहता है"
												: "wants to link"}
									</p>
								</div>
								<button
									type="button"
									onClick={() => handleAdminAccept(req)}
									className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center active:scale-95 transition shrink-0"
									title={isHindi ? "स्वीकार करें" : "Accept"}
									aria-label={isHindi ? "स्वीकार करें" : "Accept"}
								>
									<Check size={14} />
								</button>
								<button
									type="button"
									onClick={() => handleAdminReject(req.id)}
									className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-400 flex items-center justify-center active:scale-95 transition shrink-0"
									title={isHindi ? "अस्वीकार करें" : "Reject"}
									aria-label={isHindi ? "अस्वीकार करें" : "Reject"}
								>
									<X size={14} />
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Requests this devotee sent */}
			{sentRequests.length > 0 && (
				<div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
					<p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
						📤 {isHindi ? "भेजे गए अनुरोध" : "Sent Requests"} (
						{sentRequests.length})
					</p>
					<div className="space-y-2">
						{sentRequests.map((req) => (
							<div
								key={req.id}
								className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2.5"
							>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
										{nameLink(
											req.toUserId,
											req.toUserName || req.toUserId?.slice(0, 10),
										)}
									</p>
									<p className="text-[11px] text-slate-400 dark:text-ink-400 truncate">
										🕐 {isHindi ? "जवाब का इंतज़ार" : "Awaiting reply"}
										{req.fromRelation
											? ` • ${getRelationLabel(req.fromRelation, isHindi)}`
											: ""}
									</p>
								</div>
								<button
									type="button"
									onClick={() => handleCancelSent(req.id)}
									className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center active:scale-95 transition shrink-0"
									title={isHindi ? "रद्द करें" : "Cancel"}
									aria-label={isHindi ? "रद्द करें" : "Cancel"}
								>
									<X size={14} />
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Admin Force-Link */}
			<div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
				<p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
					⚡ {isHindi ? "सीधे जोड़ें (Admin)" : "Force Link (Admin)"}
				</p>
				<p className="text-[11px] text-slate-400 dark:text-ink-400 mb-3 leading-relaxed">
					{isHindi
						? "दोनों के परिवार के बाकी लिंक्ड सदस्य भी अपने-आप आपस में जुड़ जाएंगे।"
						: "Everyone already linked to either of them is linked to the other family automatically."}
				</p>
				<div className="flex gap-2">
					<input
						type="text"
						value={forceSearchQuery}
						onChange={(e) => {
							setForceSearchQuery(e.target.value);
							setForceSearchResults([]);
							setForceTarget(null);
							setForceSearchError("");
						}}
						onKeyDown={(e) => e.key === "Enter" && handleForceSearch()}
						placeholder={
							isHindi
								? "नाम, ईमेल या फोन से खोजें..."
								: "Search by name, email or phone..."
						}
						className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
					/>
					<button
						type="button"
						onClick={handleForceSearch}
						aria-label={isHindi ? "खोजें" : "Search"}
						className="px-3 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 active:scale-95 transition shrink-0"
					>
						<Search size={16} />
					</button>
				</div>
				{forceSearchError && (
					<p className="text-xs text-red-400 mt-2">{forceSearchError}</p>
				)}
				{forceSearchResults.length > 0 && (
					<div className="mt-3 space-y-1.5">
						{forceSearchResults.map((result) => {
							const selected = forceTarget?.uid === result.uid;
							return (
								<button
									type="button"
									key={result.uid}
									onClick={() => {
										setForceTarget(result);
										setForceRelationThis("");
										setForceRelationOther("");
									}}
									className={`w-full flex items-center gap-3 rounded-xl p-2.5 border text-left transition-colors ${
										selected
											? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
											: "bg-slate-50 dark:bg-slate-900/50 border-transparent"
									}`}
								>
									{result.photoURL ? (
										<ThumbImg
											src={result.photoURL}
											alt=""
											className="w-9 h-9 rounded-full object-cover shrink-0"
										/>
									) : (
										<div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
											<User size={16} className="text-blue-500" />
										</div>
									)}
									<div className="flex-1 min-w-0">
										<p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
											{profileName(result)}
										</p>
										<p className="text-[11px] text-slate-400 dark:text-ink-400 truncate">
											{[result.phoneNumber, result.email]
												.filter(Boolean)
												.join(" • ")}
										</p>
									</div>
									{selected && (
										<CheckCircle size={18} className="text-blue-500 shrink-0" />
									)}
								</button>
							);
						})}
					</div>
				)}
				{forceTarget && (
					<div className="mt-3 space-y-3 rounded-xl border border-blue-200 dark:border-blue-800/40 p-3">
						<div>
							<p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
								{relationLabel(profileName(forceTarget), selfName)}
							</p>
							<RelationPicker
								value={forceRelationThis}
								onChange={setForceRelationThis}
								isHindi={isHindi}
								accent="blue"
								size="sm"
							/>
						</div>
						<div>
							<p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
								{relationLabel(selfName, profileName(forceTarget))}
							</p>
							<RelationPicker
								value={forceRelationOther}
								onChange={setForceRelationOther}
								isHindi={isHindi}
								accent="blue"
								size="sm"
							/>
						</div>
						<button
							type="button"
							onClick={handleForceLink}
							disabled={forceLinking}
							className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
						>
							{forceLinking ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Link size={14} />
							)}
							{isHindi
								? `${profileName(forceTarget)} को जोड़ें`
								: `Link ${profileName(forceTarget)}`}
						</button>
					</div>
				)}
			</div>
			<AdminFamilyTreeSheet
				startUid={treeFor}
				onOpenProfile={
					onOpenProfile ? (t) => onOpenProfile(t.uid, t.memberId) : undefined
				}
				profiles={allProfiles as NetworkProfile[]}
				isHindi={isHindi}
				onClose={() => setTreeFor(null)}
			/>
		</div>
	);
};

export const DevoteeProfileManager = ({
	settingsLanguage = "en",
	overrideMandalId,
	isSuperAdmin,
	focus,
	onFocusClose,
}: {
	settingsLanguage?: "en" | "hi";
	overrideMandalId?: string;
	isSuperAdmin?: boolean;
	/**
	 * Opened from another admin screen (a name tapped there): show only this
	 * person's edit screen, no list. Closing it calls `onFocusClose`.
	 */
	focus?: { uid: string; memberId?: string };
	/** `changed`: the users list changed while it was open (reload yours). */
	onFocusClose?: (changed: boolean) => void;
}) => {
	const isHindi = settingsLanguage === "hi";
	const canDelete = isSuperAdmin === true;
	const [profiles, setProfiles] = useState<UserProfile[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<
		"all" | "pending" | "approved" | "rejected" | "deleted"
	>("pending");
	const [mandalFilter, setMandalFilter] = useState<string>(
		overrideMandalId || "all",
	);

	// Keep it synced if overrideMandalId changes
	useEffect(() => {
		if (overrideMandalId) {
			setMandalFilter(overrideMandalId);
		}
	}, [overrideMandalId]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [bulkLoading, setBulkLoading] = useState(false);
	const [sortBy, setSortBy] = useState<"newest" | "lastSeen" | "name">(
		"newest",
	);
	// Long lists are drawn a page at a time (hundreds of cards froze old phones).
	const [shownCount, setShownCount] = useState(PAGE_SIZE);

	// Image Zoom State
	const [zoomImage, setZoomImage] = useState<string | null>(null);

	// Disapprove modal state
	const [showRejectModal, setShowRejectModal] = useState<string | null>(null); // uid or null
	// Set when the reject modal is for one family member of `showRejectModal`.
	const [rejectMemberId, setRejectMemberId] = useState<string | null>(null);
	const [rejectNote, setRejectNote] = useState("");
	const [rejectLoading, setRejectLoading] = useState(false);
	const [rejectSilent, setRejectSilent] = useState(false);

	// History View State
	const [historyProfile, setHistoryProfile] = useState<DevoteeListRow | null>(
		null,
	);
	const [expandedExps, setExpandedExps] = useState<Set<string>>(new Set());
	// Cards open one at a time on tap; "expand all" opens every card.
	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
	const [expandAll, setExpandAll] = useState(false);
	const toggleRow = (rowId: string) =>
		setExpandedRows((prev) => {
			const next = new Set(prev);
			if (next.has(rowId)) next.delete(rowId);
			else next.add(rowId);
			return next;
		});

	// Edit and Delete state
	const [editProfile, setEditProfile] = useState<DevoteeListRow | null>(null);
	// Rows this edit screen came from (a linked relative, the family head…
	// tapped inside it): back returns to them one by one.
	const [editTrail, setEditTrail] = useState<string[]>([]);
	// What the edit screen opened with, to warn before losing changes.
	const [editOpenedAs, setEditOpenedAs] = useState("");
	const editOpenedRow = useRef<DevoteeListRow | null>(null);
	const [guruSelection, setGuruSelection] = useState<string>("");
	const [customGuruName, setCustomGuruName] = useState<string>("");
	const [deleteTarget, setDeleteTarget] = useState<DevoteeListRow | null>(null);
	const [permanentDeleteTarget, setPermanentDeleteTarget] =
		useState<DevoteeListRow | null>(null);
	const [actionLoading, setActionLoading] = useState(false);
	const [uploadingPhoto, setUploadingPhoto] = useState(false);
	const [adminCrop, setAdminCrop] = useState<{
		src: string;
		revoke?: boolean;
		/**
		 * Set when cropping from the list or the photo viewer: the new photo is
		 * saved to this devotee / family member at once. Unset inside the edit
		 * screen, where it waits for Save like every other field there.
		 */
		target?: DevoteeListRow;
	} | null>(null);
	// The row whose photo the full-screen viewer shows (for "Crop").
	const [zoomRow, setZoomRow] = useState<DevoteeListRow | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { showToast } = useToast();
	// Focus mode: did the users list change after it first loaded?
	const firstSnapshot = useRef(true);
	const listChanged = useRef(false);

	// ── BACK BUTTON SUPPORT FOR POPUPS ──
	const closeZoomImage = usePopupBackHandler(
		!!zoomImage,
		"devotee-zoom",
		() => {
			setZoomImage(null);
			setZoomRow(null);
		},
	);
	const closeRejectModal = usePopupBackHandler(
		!!showRejectModal,
		"devotee-reject",
		() => setShowRejectModal(null),
	);
	const closeHistoryProfile = usePopupBackHandler(
		!!historyProfile,
		"devotee-history",
		() => setHistoryProfile(null),
	);
	const closeEditProfile = usePopupBackHandler(
		!!editProfile,
		"devotee-edit",
		() => {
			setEditProfile(null);
			setEditTrail([]);
		},
	);
	const editDirty =
		!!editProfile && editSignature(editProfile) !== editOpenedAs;
	const confirmDiscard = () =>
		confirm(
			isHindi
				? "बदलाव सेव नहीं हुए हैं। इन्हें छोड़कर बाहर जाएँ?"
				: "You have unsaved changes. Leave without saving?",
		);
	/**
	 * Back arrow / hardware back from the edit screen: to the person it was
	 * opened from, else out of it.
	 */
	const requestCloseEdit = () => {
		if (editDirty && !confirmDiscard()) return;
		if (editTrail.length > 0) stepBackInTrail();
		else closeEditProfile();
	};
	// Hardware back asks first too, instead of dropping the changes.
	useAdminBack(editDirty || editTrail.length > 0, requestCloseEdit);

	const openEdit = (profile: DevoteeListRow) => {
		setEditProfile(profile);
		setEditOpenedAs(editSignature(profile));
		editOpenedRow.current = profile;
		const { selection, custom } = deriveGuruSelection(profile.guruName || "");
		setGuruSelection(selection);
		setCustomGuruName(custom);
	};

	/** A devotee's own row, or one of their hand-added family members. */
	const findRow = (uid: string, memberId?: string) =>
		allRows.find(
			(r) =>
				r.parentUid === uid &&
				(memberId ? r.familyMemberId === memberId : r.memberType === "primary"),
		);

	/** Opens someone's edit screen; from inside another one, back returns there. */
	const jumpToProfile = (uid: string, memberId?: string) => {
		const row = findRow(uid, memberId);
		if (!row) {
			showToast(
				isHindi
					? "यह प्रोफाइल इस सूची में नहीं है (दूसरे मंडल की या हटाई गई)"
					: "This profile isn't in this list (another mandal, or removed)",
				"info",
			);
			return;
		}
		if (editProfile) {
			if (row.rowId === editProfile.rowId) return;
			if (editDirty && !confirmDiscard()) return;
			setEditTrail((t) => [...t, editProfile.rowId]);
		}
		openEdit(row);
	};

	const stepBackInTrail = () => {
		const prevId = editTrail[editTrail.length - 1];
		setEditTrail((t) => t.slice(0, -1));
		const row = allRows.find((r) => r.rowId === prevId);
		if (row) openEdit(row);
		else closeEditProfile();
	};

	const tabLabel = (
		f: "pending" | "approved" | "rejected" | "deleted" | "all",
	) =>
		({
			pending: isHindi ? "लंबित" : "Pending",
			approved: isHindi ? "स्वीकृत" : "Approved",
			rejected: isHindi ? "अस्वीकृत" : "Rejected",
			deleted: isHindi ? "डिलीट" : "Deleted",
			all: isHindi ? "सभी" : "All",
		})[f];
	const closeDeleteProfile = usePopupBackHandler(
		!!deleteTarget,
		"devotee-delete",
		() => setDeleteTarget(null),
	);
	const closePermanentDelete = usePopupBackHandler(
		!!permanentDeleteTarget,
		"devotee-perm-delete",
		() => setPermanentDeleteTarget(null),
	);

	// When each account last opened the app (user_last_seen/{uid}, written by
	// components/LastSeenTracker.tsx). Loaded once per list — not live — to
	// keep reads low.
	const [lastSeen, setLastSeen] = useState<Record<string, number>>({});

	// How each account logs in (Google / phone / both) — super admins only,
	// from Firebase Auth via one function call, kept on the device 6 h.
	const logins = useLoginMethods(isSuperAdmin === true && !overrideMandalId);
	const loginMap = logins.map;
	const [loginFilter, setLoginFilter] = useState<LoginFilter>("all");

	const getParentProfile = (parentUid: string) =>
		profiles.find((p) => p.uid === parentUid) || null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: a new toast or language must not restart the listener
	useEffect(() => {
		const q = overrideMandalId
			? query(
					collection(db, "users"),
					where("mandalId", "==", overrideMandalId),
				)
			: query(collection(db, "users"));
		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const list: UserProfile[] = [];
				snapshot.forEach((doc) => {
					const data = doc.data() as UserProfile;
					if (!data.uid) data.uid = doc.id; // Fallback for older documents missing the uid field
					list.push(data);
				});
				// Sort: Pending first, then by date
				list.sort((a, b) => {
					if (a.isApproved === b.isApproved)
						return (b.createdAt || 0) - (a.createdAt || 0);
					return a.isApproved ? 1 : -1;
				});
				setProfiles(list);
				setLoading(false);
				if (!firstSnapshot.current) listChanged.current = true;
				firstSnapshot.current = false;
			},
			(error) => {
				console.error("[DevoteeProfiles] users listener", error);
				setLoading(false);
				showToast(
					isHindi
						? "भक्तों की सूची लोड नहीं हो सकी। इंटरनेट देखकर दोबारा खोलें।"
						: "Could not load devotees. Check the internet and open again.",
					"error",
				);
			},
		);

		return () => unsubscribe();
	}, [overrideMandalId]);

	// A mandal admin only sees their mandal's devotees, so only fetch theirs.
	const mandalUidsKey = overrideMandalId
		? profiles
				.map((p) => p.uid)
				.sort()
				.join(",")
		: "";
	useEffect(() => {
		// Focus mode shows one edit screen, no list: nothing to sort or show.
		if (focus) return;
		let cancelled = false;
		const cacheKey = overrideMandalId ? `m:${mandalUidsKey}` : "all";
		if (
			lastSeenCache?.key === cacheKey &&
			Date.now() - lastSeenCache.at < LAST_SEEN_TTL
		) {
			setLastSeen(lastSeenCache.map);
			return;
		}
		const load = async () => {
			const snaps = [];
			if (!overrideMandalId) {
				snaps.push(await getDocs(collection(db, "user_last_seen")));
			} else {
				const uids = mandalUidsKey ? mandalUidsKey.split(",") : [];
				for (let i = 0; i < uids.length; i += 30) {
					snaps.push(
						await getDocs(
							query(
								collection(db, "user_last_seen"),
								where(documentId(), "in", uids.slice(i, i + 30)),
							),
						),
					);
				}
			}
			const map: Record<string, number> = {};
			for (const snap of snaps) {
				snap.forEach((d) => {
					const ts = d.data().lastSeenAt;
					if (typeof ts?.toMillis === "function") map[d.id] = ts.toMillis();
				});
			}
			lastSeenCache = { key: cacheKey, at: Date.now(), map };
			if (!cancelled) setLastSeen(map);
		};
		load().catch((e) => console.warn("[DevoteeProfiles] Last seen", e));
		return () => {
			cancelled = true;
		};
	}, [overrideMandalId, mandalUidsKey, focus]);

	const formatLastSeen = (uid: string) => {
		const ms = lastSeen[uid];
		if (!ms) return isHindi ? "पता नहीं" : "Unknown";
		return formatDistanceToNow(ms, {
			addSuffix: true,
			locale: isHindi ? hiLocale : undefined,
		});
	};

	const toggleApproval = async (uid: string, currentStatus: boolean) => {
		try {
			const userRef = doc(db, "users", uid);
			const updates: any = { isApproved: !currentStatus, rejectionNote: "" };
			const current = profiles.find((p) => p.uid === uid);
			const members = current?.familyMembers || [];
			if (!currentStatus) {
				// transitioning to approved
				updates.approvalDate = Date.now();
				updates.resubmitted = false;
				updates.hasPendingEdits = false; // clear pending edits on approval
				// …and marks them as seen in the history, which otherwise kept
				// showing them as "to review" after approval.
				if (current?.editHistory?.some((h) => h.status === "pending"))
					updates.editHistory = current.editHistory.map((h) =>
						h.status === "pending" ? { ...h, status: "reviewed" as const } : h,
					);
				// Members still waiting are approved with the devotee; a member the
				// admin rejected stays rejected.
				if (current && members.length > 0)
					updates.familyMembers = approvePendingMembers(
						members,
						updates.approvalDate,
					);
			} else {
				// revoking approval
				updates.approvalDate = null;
				// …for the devotee only — the family keeps its own status.
				if (current && members.length > 0)
					updates.familyMembers = freezeMemberStatuses(members, current);
			}
			updates.reviewLog = logReview(currentStatus ? "revoked" : "approved");
			await updateDoc(userRef, updates);
			showToast(
				!currentStatus
					? isHindi
						? "प्रोफाइल स्वीकृत ✅"
						: "Profile approved ✅"
					: isHindi
						? "अनुमोदन रद्द किया गया"
						: "Approval revoked",
				"success",
			);

			// Send push notification if transitioning to approved
			if (!currentStatus) {
				const targetProfile = profiles.find((p) => p.uid === uid);
				if (targetProfile?.fcmTokens && targetProfile.fcmTokens.length > 0) {
					try {
						const result = await sendPushNotification({
							tokens: targetProfile.fcmTokens,
							title:
								settingsLanguage === "hi"
									? "प्रोफ़ाइल स्वीकृत"
									: "Profile Approved",
							body:
								settingsLanguage === "hi"
									? "आपकी प्रोफ़ाइल सफलतापूर्वक स्वीकृत कर ली गई है।"
									: "Your profile has been successfully approved.",
							silent: false,
							actionType: "screen",
							targetScreen: "profile",
						});
						console.log(
							`Approval notification: sent=${result.sent}, invalid=${result.invalidTokens.length}`,
						);
						if (result.invalidTokens.length > 0) {
							const cleanedTokens = targetProfile.fcmTokens.filter(
								(t) => !result.invalidTokens.includes(t),
							);
							updateDoc(doc(db, "users", uid), {
								fcmTokens: cleanedTokens,
							}).catch((err) =>
								console.error("Failed to clean stale FCM tokens:", err),
							);
						}
					} catch (pushErr) {
						console.error(
							"Failed to send approval push notification:",
							pushErr,
						);
					}
				}
			}
		} catch (error) {
			console.error("Error toggling approval status:", error);
			showToast(
				isHindi
					? "अनुमोदन स्थिति अपडेट नहीं हो सकी"
					: "Failed to update approval status",
				"error",
			);
		}
	};

	const handleDisapprove = async () => {
		if (!showRejectModal || !rejectNote.trim()) return;
		if (rejectMemberId) {
			setRejectLoading(true);
			const ok = await setFamilyMemberStatus(
				showRejectModal,
				rejectMemberId,
				"rejected",
				rejectNote.trim(),
				rejectSilent,
			);
			setRejectLoading(false);
			if (ok) {
				closeRejectModal();
				setRejectNote("");
				setRejectSilent(false);
				setRejectMemberId(null);
			}
			return;
		}
		setRejectLoading(true);
		try {
			const userRef = doc(db, "users", showRejectModal);
			const targetProfile = profiles.find((p) => p.uid === showRejectModal);
			const members = targetProfile?.familyMembers || [];

			await updateDoc(userRef, {
				isApproved: false,
				rejectionNote: rejectNote.trim(),
				reviewLog: logReview("rejected", { note: rejectNote.trim() }),
				approvalDate: null,
				resubmitted: false,
				// Rejecting reviews the waiting edits too. Left pending, they kept
				// the devotee in the "Pending" tab after rejection (see rowTab); a
				// later edit by the devotee sets them again and brings them back.
				hasPendingEdits: false,
				...(targetProfile?.editHistory?.some((h) => h.status === "pending")
					? {
							editHistory: targetProfile.editHistory.map((h) =>
								h.status === "pending"
									? { ...h, status: "reviewed" as const }
									: h,
							),
						}
					: {}),
				// Only the devotee is rejected: each family member keeps the status
				// it had, instead of silently following the devotee.
				...(targetProfile && members.length > 0
					? { familyMembers: freezeMemberStatuses(members, targetProfile) }
					: {}),
			});

			// Send Push Notification if user has FCM tokens
			if (targetProfile?.fcmTokens && targetProfile.fcmTokens.length > 0) {
				try {
					const result = await sendPushNotification({
						tokens: targetProfile.fcmTokens,
						title:
							settingsLanguage === "hi" ? "प्रोफ़ाइल अपडेट" : "Profile Update",
						body: rejectNote.trim(),
						silent: rejectSilent,
						actionType: "screen",
						targetScreen: "profile",
					});
					console.log(
						`Rejection notification: sent=${result.sent}, invalid=${result.invalidTokens.length}`,
					);
					// Auto-clean stale tokens (uninstalled app, token rotated, etc.)
					if (result.invalidTokens.length > 0) {
						const cleanedTokens = targetProfile.fcmTokens.filter(
							(t) => !result.invalidTokens.includes(t),
						);
						updateDoc(doc(db, "users", showRejectModal), {
							fcmTokens: cleanedTokens,
						}).catch((err) =>
							console.error("Failed to clean stale FCM tokens:", err),
						);
					}
				} catch (pushErr) {
					console.error("Failed to send rejection push notification:", pushErr);
				}
			}

			closeRejectModal();
			setRejectNote("");
			setRejectSilent(false);
			showToast(
				isHindi ? "प्रोफाइल अस्वीकार की गई" : "Profile rejected",
				"success",
			);
		} catch (error) {
			console.error("Error disapproving:", error);
			showToast(
				isHindi
					? "अस्वीकार नहीं हो सका, दोबारा कोशिश करें"
					: "Could not reject, please try again",
				"error",
			);
		} finally {
			setRejectLoading(false);
		}
	};

	/**
	 * Approve / reject / reset ONE family member, leaving the devotee and the
	 * other members alone. Notifies the devotee's devices.
	 */
	const setFamilyMemberStatus = async (
		parentUid: string,
		memberId: string,
		status: MemberStatus,
		note = "",
		silent = false,
	): Promise<boolean> => {
		const parent = profiles.find((p) => p.uid === parentUid);
		const member = parent?.familyMembers?.find((m) => m.id === memberId);
		if (!parent || !member) return false;
		try {
			const updated = (parent.familyMembers || []).map((m) =>
				m.id === memberId ? withMemberStatus(m, status, note) : m,
			);
			await updateDoc(doc(db, "users", parentUid), {
				familyMembers: updated,
				reviewLog: logReview(
					status === "approved"
						? "approved"
						: status === "rejected"
							? "rejected"
							: "revoked",
					{ note, member: member.realName || "—" },
				),
			});
			showToast(
				status === "approved"
					? isHindi
						? `${member.realName} स्वीकृत ✅`
						: `${member.realName} approved ✅`
					: status === "rejected"
						? isHindi
							? `${member.realName} अस्वीकार किया गया`
							: `${member.realName} rejected`
						: isHindi
							? "स्वीकृति रद्द की गई"
							: "Approval revoked",
				"success",
			);
			if (status !== "pending" && parent.fcmTokens?.length) {
				const hi = settingsLanguage === "hi";
				sendPushNotification({
					tokens: parent.fcmTokens,
					title:
						status === "approved"
							? hi
								? "परिवार सदस्य स्वीकृत"
								: "Family member approved"
							: hi
								? "परिवार सदस्य — बदलाव ज़रूरी"
								: "Family member needs changes",
					body:
						status === "approved"
							? hi
								? `${member.realName} की जानकारी स्वीकृत हो गई है।`
								: `${member.realName}'s details have been approved.`
							: `${member.realName}: ${note}`,
					silent,
					actionType: "screen",
					targetScreen: "profile",
				}).catch((err) => console.error("Family member push failed:", err));
			}
			return true;
		} catch (error) {
			console.error("Family member status error:", error);
			showToast(
				isHindi ? "स्थिति अपडेट नहीं हो सकी" : "Could not update the status",
				"error",
			);
			return false;
		}
	};

	const handleAdminPhotoUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0];
		if (!file || !editProfile?.uid) return;

		if (!file.type.startsWith("image/")) {
			showToast(
				isHindi ? "कृपया एक इमेज फ़ाइल चुनें" : "Please select an image file",
				"warning",
			);
			return;
		}

		if (fileInputRef.current) fileInputRef.current.value = "";
		// Crop first (it used to be a blind centre square that cut off heads).
		setAdminCrop({ src: URL.createObjectURL(file), revoke: true });
	};

	const closeAdminCrop = () =>
		setAdminCrop((current) => {
			if (current?.revoke) URL.revokeObjectURL(current.src);
			return null;
		});

	const uploadAdminPhoto = async (compressed: Blob): Promise<boolean> => {
		const target = adminCrop?.target;
		const row = target || editProfile;
		if (!row?.uid) return false;
		setUploadingPhoto(true);
		try {
			const isFamily = row.memberType === "family";
			const photoPath = isFamily
				? `profile_photos/${row.uid}/family_${row.familyMemberId}.jpg`
				: `profile_photos/${row.uid}/profile.jpg`;
			const photoRef = ref(storage, photoPath);
			await uploadBytes(photoRef, compressed, { contentType: "image/jpeg" });
			const url = await getDownloadURL(photoRef);
			// Versioned so a re-cropped photo is a new URL and no cached copy of
			// the old crop shows anywhere (Storage ignores the extra parameter).
			const downloadURL = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;

			if (target) {
				await saveRowPhoto(target, downloadURL);
				setZoomImage((z) => (z ? downloadURL : z));
				showToast(isHindi ? "फोटो सेट हो गई ✅" : "Photo updated ✅", "success");
				return true;
			}

			setEditProfile((prev) =>
				prev ? { ...prev, photoURL: downloadURL } : null,
			);
			showToast(
				isHindi
					? "फोटो अपलोड हो गई ✅ — सेव करना न भूलें"
					: "Photo uploaded ✅ — remember to Save",
				"success",
			);
			return true;
		} catch (error) {
			console.error("Photo upload error:", error);
			showToast(isHindi ? "फोटो अपलोड विफल" : "Photo upload failed", "error");
			return false;
		} finally {
			setUploadingPhoto(false);
		}
	};

	/** Writes a new photo URL to the devotee, or to one family member. */
	const saveRowPhoto = async (row: DevoteeListRow, photoURL: string) => {
		if (row.memberType === "family" && row.familyMemberId) {
			const parent = getParentProfile(row.parentUid);
			if (!parent) throw new Error("Parent profile not found");
			await updateDoc(doc(db, "users", parent.uid), {
				familyMembers: (parent.familyMembers || []).map((m) =>
					m.id === row.familyMemberId ? { ...m, photoURL } : m,
				),
			});
		} else {
			await updateDoc(doc(db, "users", row.parentUid), { photoURL });
		}
	};

	/** Re-crop the photo a devotee uploaded (too far away, too many people…). */
	const cropExistingPhoto = (row: DevoteeListRow) => {
		if (!row.photoURL) return;
		setAdminCrop({ src: row.photoURL, target: row });
	};

	const handleSaveEdit = async () => {
		if (!editProfile) return;
		if (!editProfile.realName?.trim()) {
			showToast(
				isHindi ? "नाम खाली नहीं हो सकता" : "Name can't be empty",
				"error",
			);
			return;
		}
		if (uploadingPhoto) {
			showToast(
				isHindi
					? "फोटो अपलोड होने दें, फिर सेव करें"
					: "Wait for the photo to finish uploading, then save",
				"info",
			);
			return;
		}
		const customMandal =
			editProfile.mandalId === "custom"
				? (editProfile.customMandalName || "").trim()
				: "";
		// "Other" needs a name — unless it opened that way (older profiles have
		// "custom" with no name) and the admin is changing something else.
		const opened = editOpenedRow.current;
		const openedWithoutName =
			opened?.mandalId === "custom" && !opened.customMandalName?.trim();
		if (
			editProfile.memberType === "primary" &&
			editProfile.mandalId === "custom" &&
			!customMandal &&
			!openedWithoutName
		) {
			showToast(isHindi ? "मंडल का नाम लिखें" : "Type the mandal's name", "error");
			return;
		}
		setActionLoading(true);
		try {
			const parentProfile = getParentProfile(editProfile.parentUid);
			if (!parentProfile) throw new Error("Parent profile not found");

			if (editProfile.memberType === "family" && editProfile.familyMemberId) {
				const relation = normalizeRelation(editProfile.familyRelation);
				const updatedFamilyMembers = (parentProfile.familyMembers || []).map(
					(member) => {
						if (member.id !== editProfile.familyMemberId) return member;
						// Optional keys are left out rather than set to undefined:
						// Firestore rejects an undefined value anywhere in the array,
						// which made saving a member without a photo fail outright.
						const { photoURL: _photo, relation: _relation, ...rest } = member;
						return {
							...rest,
							realName: editProfile.realName.trim(),
							dikshaName: editProfile.dikshaName?.trim() || "",
							guruName: editProfile.guruName || "",
							dikshaDate: editProfile.dikshaDate || "",
							isAspiring: editProfile.isAspiring || false,
							...(editProfile.photoURL
								? { photoURL: editProfile.photoURL }
								: {}),
							...(relation ? { relation } : {}),
						};
					},
				);

				// Only the member list: the devotee's own mandal, phone and
				// experience are not on this form, and writing back the copy
				// taken when it opened undid any change made since.
				await updateDoc(doc(db, "users", parentProfile.uid), {
					familyMembers: updatedFamilyMembers,
				});
			} else {
				const updatedProfile: UserProfile = {
					...parentProfile,
					realName: editProfile.realName.trim(),
					dikshaName: editProfile.dikshaName?.trim() || "",
					guruName: editProfile.guruName || "",
					dikshaDate: editProfile.dikshaDate || "",
					mandalId: editProfile.mandalId || "",
					phoneNumber: cleanPhone(editProfile.phoneNumber),
					personalExperience: editProfile.personalExperience || "",
					isAspiring: editProfile.isAspiring || false,
					photoURL: editProfile.photoURL || "",
				};

				await updateDoc(doc(db, "users", parentProfile.uid), {
					realName: updatedProfile.realName,
					dikshaName: updatedProfile.dikshaName || "",
					guruName: updatedProfile.guruName || "",
					dikshaDate: updatedProfile.dikshaDate || "",
					mandalId: updatedProfile.mandalId || "",
					// The name a devotee typed for a mandal not in the list; cleared
					// when the admin picks a listed one.
					customMandalName: customMandal,
					phoneNumber: updatedProfile.phoneNumber || "",
					personalExperience: updatedProfile.personalExperience || "",
					isAspiring: updatedProfile.isAspiring || false,
					photoURL: updatedProfile.photoURL || "",
					// Only a chosen gender is written; an unset one stays unset.
					...(editProfile.gender === "male" || editProfile.gender === "female"
						? { gender: editProfile.gender }
						: {}),
				});
			}
			// Back to the person this one was opened from, if any.
			if (editTrail.length > 0) stepBackInTrail();
			else closeEditProfile();
			showToast(
				isHindi ? "प्रोफाइल अपडेट हो गई ✅" : "Profile updated ✅",
				"success",
			);
		} catch (error) {
			console.error("Edit error:", error);
			showToast(isHindi ? "अपडेट में त्रुटि हुई" : "Error saving changes", "error");
		} finally {
			setActionLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setActionLoading(true);
		try {
			const parentProfile = getParentProfile(deleteTarget.parentUid);
			if (!parentProfile) throw new Error("Parent profile not found");

			if (deleteTarget.memberType === "family" && deleteTarget.familyMemberId) {
				const updatedFamilyMembers = (parentProfile.familyMembers || []).filter(
					(member) => member.id !== deleteTarget.familyMemberId,
				);
				await updateDoc(doc(db, "users", parentProfile.uid), {
					familyMembers: updatedFamilyMembers,
				});
			} else {
				await updateDoc(doc(db, "users", parentProfile.uid), {
					isDeleted: true,
					deletedAt: Date.now(),
					fcmTokens: [], // clear tokens so deleted user doesn't receive push notifications
				});
			}
			const wasFamily = deleteTarget.memberType === "family";
			closeDeleteProfile();
			showToast(
				wasFamily
					? isHindi
						? "परिवार सदस्य हटा दिया गया"
						: "Family member removed"
					: isHindi
						? "प्रोफाइल “डिलीट” टैब में भेजी गई — वहाँ से रीस्टोर हो सकती है"
						: "Moved to the Deleted tab — it can be restored from there",
				"success",
			);
		} catch (error) {
			console.error("Delete error:", error);
			showToast(
				isHindi
					? "डिलीट नहीं हो सका, दोबारा कोशिश करें"
					: "Could not delete, please try again",
				"error",
			);
		} finally {
			setActionLoading(false);
		}
	};

	const handleRestore = async (uid: string) => {
		setActionLoading(true);
		try {
			await updateDoc(doc(db, "users", uid), {
				isDeleted: false,
				deletedAt: null,
			});
			showToast(
				isHindi
					? "प्रोफाइल सफलतापूर्वक रीस्टोर की गई"
					: "Profile restored successfully",
				"success",
			);
		} catch (error) {
			console.error("Restore error:", error);
			showToast(
				isHindi ? "रीस्टोर करने में त्रुटि" : "Error restoring profile",
				"error",
			);
		} finally {
			setActionLoading(false);
		}
	};

	const handlePermanentDelete = async () => {
		if (!permanentDeleteTarget) return;
		setActionLoading(true);
		try {
			const parentProfile = getParentProfile(permanentDeleteTarget.parentUid);
			if (!parentProfile) throw new Error("Parent profile not found");

			if (
				permanentDeleteTarget.memberType === "family" &&
				permanentDeleteTarget.familyMemberId
			) {
				const updatedFamilyMembers = (parentProfile.familyMembers || []).filter(
					(member) => member.id !== permanentDeleteTarget.familyMemberId,
				);
				await updateDoc(doc(db, "users", parentProfile.uid), {
					familyMembers: updatedFamilyMembers,
				});
			} else {
				await deleteDoc(doc(db, "users", parentProfile.uid));
			}
			closePermanentDelete();
			showToast(
				isHindi
					? "प्रोफाइल स्थायी रूप से डिलीट कर दी गई"
					: "Profile permanently deleted",
				"success",
			);
		} catch (error: any) {
			console.error("Permanent delete error:", error);
			showToast(
				isHindi
					? `डिलीट करने में त्रुटि: ${error.message}`
					: `Error: ${error.message}`,
				"error",
			);
		} finally {
			setActionLoading(false);
		}
	};

	const handleBulkApprove = async () => {
		// Deleted accounts are never approved by a bulk action.
		const selectedRows = visibleSelected.filter((r) => !r.isDeleted);
		if (selectedRows.length === 0) return;
		setBulkLoading(true);
		try {
			const selectedParentUids = Array.from(
				new Set(selectedRows.map((profile) => profile.parentUid)),
			);

			// FIX: Capture pre-batch approval status BEFORE committing to avoid race condition
			// in notifications (after batch.commit, profiles state may not reflect new values yet)
			const uidsToNotify = selectedParentUids.filter((uid) => {
				const targetProfile = profiles.find((p) => p.uid === uid);
				const primarySelected = selectedRows.some(
					(r) => r.parentUid === uid && r.memberType === "primary",
				);
				return (
					primarySelected &&
					targetProfile &&
					!targetProfile.isApproved &&
					targetProfile.fcmTokens &&
					targetProfile.fcmTokens.length > 0
				);
			});

			const batch = writeBatch(db);
			const approvalDate = Date.now();
			selectedParentUids.forEach((uid) => {
				const parent = profiles.find((p) => p.uid === uid);
				const rows = selectedRows.filter((r) => r.parentUid === uid);
				const primarySelected = rows.some((r) => r.memberType === "primary");
				const memberIds = new Set(
					rows
						.filter((r) => r.memberType === "family")
						.map((r) => r.familyMemberId),
				);
				const members = parent?.familyMembers || [];
				if (primarySelected) {
					batch.update(doc(db, "users", uid), {
						isApproved: true,
						rejectionNote: "",
						approvalDate,
						resubmitted: false,
						hasPendingEdits: false,
						reviewLog: logReview("approved", {}, approvalDate),
						...(parent?.editHistory?.some((h) => h.status === "pending")
							? {
									editHistory: parent.editHistory.map((h) =>
										h.status === "pending"
											? { ...h, status: "reviewed" as const }
											: h,
									),
								}
							: {}),
						...(parent && members.length > 0
							? {
									familyMembers: approvePendingMembers(
										members,
										approvalDate,
									).map((m) =>
										memberIds.has(m.id)
											? withMemberStatus(m, "approved", "", approvalDate)
											: m,
									),
								}
							: {}),
					});
				} else if (parent && memberIds.size > 0) {
					// Only family rows selected — approve just those members.
					batch.update(doc(db, "users", uid), {
						familyMembers: members.map((m) =>
							memberIds.has(m.id)
								? withMemberStatus(m, "approved", "", approvalDate)
								: m,
						),
					});
				}
			});
			await batch.commit();
			showToast(
				isHindi
					? `${selectedRows.length} प्रोफाइल स्वीकृत ✅`
					: `${selectedRows.length} profile(s) approved ✅`,
				"success",
			);

			// Send push notifications only to users who were previously not approved
			const notificationPromises = uidsToNotify.map(async (uid) => {
				const targetProfile = profiles.find((p) => p.uid === uid);
				if (!targetProfile) return;
				try {
					const result = await sendPushNotification({
						tokens: targetProfile.fcmTokens!,
						title:
							settingsLanguage === "hi" ? "प्रोफ़ाइल स्वीकृत" : "Profile Approved",
						body:
							settingsLanguage === "hi"
								? "आपकी प्रोफ़ाइल सफलतापूर्वक स्वीकृत कर ली गई है।"
								: "Your profile has been successfully approved.",
						silent: false,
						actionType: "screen",
						targetScreen: "profile",
					});
					if (result.invalidTokens.length > 0) {
						const cleanedTokens = targetProfile.fcmTokens?.filter(
							(t) => !result.invalidTokens.includes(t),
						);
						updateDoc(doc(db, "users", uid), {
							fcmTokens: cleanedTokens,
						}).catch((err) =>
							console.error("Failed to clean stale FCM tokens:", err),
						);
					}
				} catch (pushErr) {
					console.error(
						`Failed to send bulk approval push to ${uid}:`,
						pushErr,
					);
				}
			});
			await Promise.all(notificationPromises);

			setSelectedIds(new Set());
		} catch (error) {
			console.error("Bulk approve error:", error);
			showToast(
				isHindi
					? "मंज़ूरी नहीं हो सकी — कुछ नहीं बदला। दोबारा कोशिश करें।"
					: "Could not approve — nothing was changed. Please try again.",
				"error",
			);
		} finally {
			setBulkLoading(false);
		}
	};

	const handleMarkReviewed = async (row: DevoteeListRow) => {
		// The live document: the row is a snapshot from when the popup opened,
		// and writing its old history back would drop newer edits.
		const profile = getParentProfile(row.parentUid) || row;
		try {
			const updatedHistory = (profile.editHistory || []).map((h) =>
				h.status === "pending" ? { ...h, status: "reviewed" as const } : h,
			);
			await updateDoc(doc(db, "users", profile.uid), {
				hasPendingEdits: false,
				editHistory: updatedHistory,
				reviewLog: logReview("reviewed"),
			});
			closeHistoryProfile();
			showToast(isHindi ? "समीक्षा पूरी ✅" : "Marked as reviewed ✅", "success");
		} catch (error) {
			console.error("Mark reviewed error:", error);
			showToast(
				isHindi
					? "सेव नहीं हो सका, दोबारा कोशिश करें"
					: "Could not save, please try again",
				"error",
			);
		}
	};

	const toggleSelection = (rowId: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(rowId)) next.delete(rowId);
			else next.add(rowId);
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (
			filteredProfiles.length > 0 &&
			visibleSelected.length === filteredProfiles.length
		) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(filteredProfiles.map((p) => p.rowId)));
		}
	};

	const getMandalName = (mandalId?: string, customName?: string) => {
		if (!mandalId) return "N/A";
		if (mandalId === "custom") {
			const label = isHindi ? "कस्टम" : "Custom";
			const name = (customName || "").trim();
			return name ? `${label}: ${name}` : label;
		}
		const mandal = MANDAL_LIST.find((m) => m.id === mandalId);
		if (!mandal) return mandalId;
		return isHindi ? mandal.shortNameHi : mandal.shortNameEn;
	};

	// Every row (devotee + hand-added family), in the chosen order — a
	// family always stays right under its devotee.
	const allRows = useMemo(() => {
		const parents = [...profiles];
		if (sortBy === "name")
			parents.sort((a, b) =>
				(a.realName || a.email || "").localeCompare(
					b.realName || b.email || "",
					isHindi ? "hi" : "en",
					{ sensitivity: "base" },
				),
			);
		else if (sortBy === "lastSeen")
			parents.sort((a, b) => (lastSeen[b.uid] || 0) - (lastSeen[a.uid] || 0));
		return parents.flatMap(buildProfileRows);
	}, [profiles, sortBy, lastSeen, isHindi]);

	// Search index, built once per list: names in Hindi / English / Hinglish,
	// mandal, guru, relation; email and id as typed; phone by digits.
	const searchEntries = useMemo(() => {
		const map = new Map<string, DevoteeSearchEntry>();
		for (const row of allRows) {
			const m = MANDAL_LIST.find((x) => x.id === row.mandalId);
			const relation = row.familyRelation
				? [
						getRelationLabel(row.familyRelation, true),
						getRelationLabel(row.familyRelation, false),
					]
				: [];
			map.set(
				row.rowId,
				buildSearchEntry(
					[
						row.realName,
						row.dikshaName,
						row.guruName,
						m?.shortNameEn,
						m?.shortNameHi,
						row.customMandalName,
						...relation,
					],
					[
						row.email,
						row.parentUid,
						row.shortId,
						row.memberType === "primary"
							? loginMap?.[row.parentUid]?.loginEmail
							: undefined,
					],
					[
						row.phoneNumber,
						// The number they log in with may differ from the profile's.
						row.memberType === "primary"
							? loginMap?.[row.parentUid]?.loginPhone
							: undefined,
					],
				),
			);
		}
		return map;
	}, [allRows, loginMap]);

	// Rows matching the search and mandal (the tabs are applied after, so
	// each tab can show its count).
	const deferredQuery = useDeferredValue(searchQuery);
	const searchedRows = useMemo(() => {
		const q = prepareDevoteeQuery(deferredQuery);
		return allRows.filter((p) => {
			const matchesMandal =
				mandalFilter === "all" || !mandalFilter
					? true
					: mandalFilter === "none"
						? !p.mandalId
						: p.mandalId === mandalFilter;
			if (!matchesMandal) return false;
			if (loginMap && loginFilter !== "all") {
				// Logins belong to accounts: hand-added family rows drop out.
				if (p.memberType !== "primary") return false;
				const info = loginMap[p.parentUid];
				if (loginFilter === "none" ? !!info || p.isDeleted : !info)
					return false;
				if (info && loginKind(info) !== loginFilter) return false;
			}
			if (!q.text) return true;
			const entry = searchEntries.get(p.rowId);
			return !!entry && scoreDevotee(entry, q) > 0;
		});
	}, [
		allRows,
		searchEntries,
		deferredQuery,
		mandalFilter,
		loginMap,
		loginFilter,
	]);

	// Login-method counts for the devotees in this mandal (deleted ones left out).
	const loginCounts = useMemo(() => {
		const c: Record<LoginFilter, number> = {
			all: 0,
			google: 0,
			phone: 0,
			both: 0,
			other: 0,
			none: 0,
		};
		if (!loginMap) return c;
		for (const p of profiles) {
			if (p.isDeleted) continue;
			if (
				mandalFilter !== "all" &&
				mandalFilter &&
				(mandalFilter === "none" ? !!p.mandalId : p.mandalId !== mandalFilter)
			)
				continue;
			c.all++;
			const info = loginMap[p.uid];
			c[info ? loginKind(info) : "none"]++;
		}
		return c;
	}, [profiles, loginMap, mandalFilter]);

	// Google / phone logins with no profile document at all.
	const orphanLogins = useMemo<OrphanLogin[]>(() => {
		if (!loginMap) return [];
		const known = new Set(profiles.map((p) => p.uid));
		return Object.entries(loginMap)
			.filter(([uid, info]) => !known.has(uid) && (info.google || info.phone))
			.map(([uid, info]) => ({ uid, info }))
			.sort((a, b) => (b.info.lastSignIn || 0) - (a.info.lastSignIn || 0));
	}, [profiles, loginMap]);

	const tabCounts = useMemo(() => {
		const counts = { all: 0, pending: 0, approved: 0, rejected: 0, deleted: 0 };
		for (const row of searchedRows) {
			counts.all++;
			const tab = rowTab(row);
			if (tab !== "other") counts[tab]++;
		}
		return counts;
	}, [searchedRows]);

	const filteredProfiles = useMemo(
		() =>
			filter === "all"
				? searchedRows
				: searchedRows.filter((p) => rowTab(p) === filter),
		[searchedRows, filter],
	);

	// Back to the first page whenever what is listed changes.
	const listKey = `${searchQuery}|${filter}|${mandalFilter}|${sortBy}|${loginFilter}`;
	const [pagedFor, setPagedFor] = useState(listKey);
	if (pagedFor !== listKey) {
		setPagedFor(listKey);
		setShownCount(PAGE_SIZE);
	}
	// …and back to the top of the list.
	const listScrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (listKey) listScrollRef.current?.scrollTo({ top: 0 });
	}, [listKey]);

	// Only rows still in the list count as selected (an approved row leaves
	// the "pending" tab but its id could stay in the set).
	const visibleSelected = useMemo(
		() => filteredProfiles.filter((p) => selectedIds.has(p.rowId)),
		[filteredProfiles, selectedIds],
	);

	// ── Focus mode (opened from another admin screen) ──
	// Open the person's edit screen once the list is in…
	const focusOpened = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the list has loaded
	useEffect(() => {
		if (!focus || loading || focusOpened.current) return;
		focusOpened.current = true;
		const row = findRow(focus.uid, focus.memberId);
		if (row) {
			openEdit(row);
			return;
		}
		showToast(
			isHindi
				? "यह प्रोफाइल नहीं मिली (हटाई गई या आपकी सूची में नहीं)"
				: "Profile not found (removed, or not in your list)",
			"error",
		);
		onFocusClose?.(false);
	}, [focus, loading]);
	// …and hand back once it is closed.
	const focusShown = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: only the edit screen opening / closing matters
	useEffect(() => {
		if (!focus) return;
		if (editProfile) focusShown.current = true;
		else if (focusShown.current) onFocusClose?.(listChanged.current);
	}, [editProfile]);
	// Back while it is still loading cancels.
	useAdminBack(!!focus && loading, () => onFocusClose?.(false));

	const handleExportCSV = () => {
		if (filteredProfiles.length === 0) return;

		const headers = [
			"Name",
			"Diksha Name",
			"Email",
			"Phone",
			"Mandal",
			"Guru",
			"Diksha Date",
			"Status",
			"Member Type",
			"Parent Name",
			"Relation",
			"Experience",
			"Last Seen",
			...(loginMap ? ["Login"] : []),
		];
		const rows = filteredProfiles.map((p) => {
			const status = p.isDeleted
				? "Deleted"
				: p.isApproved
					? "Approved"
					: p.rejectionNote
						? "Rejected"
						: "Pending";
			return (
				[
					p.realName || "",
					p.dikshaName || "",
					p.email || "",
					p.phoneNumber || "",
					getMandalName(p.mandalId, p.customMandalName),
					p.guruName || "",
					p.dikshaDate || "",
					status,
					p.memberType === "primary" ? "Primary" : "Family",
					p.parentName || "",
					getRelationLabel(p.familyRelation, false),
					(p.personalExperience || "").replace(/\r?\n/g, " "),
					p.memberType === "primary" && lastSeen[p.parentUid]
						? new Date(lastSeen[p.parentUid]).toLocaleString("en-IN")
						: "",
					...(loginMap
						? [
								p.memberType !== "primary"
									? ""
									: loginMap[p.parentUid]
										? loginSummary(loginMap[p.parentUid], false)
										: "No login",
							]
						: []),
				]
					// Every value quoted and its quotes doubled (a name with a quote
					// used to break the row).
					.map((v) => `"${String(v).replace(/"/g, '""')}"`)
					.join(",")
			);
		});

		const csvContent = `\uFEFF${[headers.join(","), ...rows].join("\n")}`;
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.setAttribute("href", url);
		link.setAttribute(
			"download",
			`devotees_export_${new Date().toISOString().split("T")[0]}.csv`,
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	if (loading && focus) {
		return (
			<div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-4 p-8">
				<Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
				<p className="text-sm text-slate-500 dark:text-slate-400">
					{isHindi ? "प्रोफाइल खुल रही है…" : "Opening the profile…"}
				</p>
				<button
					type="button"
					onClick={() => onFocusClose?.(false)}
					className="min-h-touch px-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300"
				>
					{isHindi ? "रद्द करें" : "Cancel"}
				</button>
			</div>
		);
	}
	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
			</div>
		);
	}

	return (
		<div
			className={
				focus
					? "contents"
					: "flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden animate-in fade-in"
			}
		>
			{/* One scroll area: search + tabs stay on top, filters scroll away
			    so the list gets the screen. Focus mode has no list. */}
			{!focus && (
				<div
					ref={listScrollRef}
					className="flex-1 overflow-y-auto overscroll-contain"
				>
					<div className="sticky top-0 z-20 px-3 pt-3 pb-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-b border-slate-200 dark:border-slate-700 space-y-2">
						<div className="flex gap-2">
							<div className="relative flex-1 min-w-0">
								<Search
									className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ink-400"
									size={18}
								/>
								<input
									type="search"
									value={searchQuery}
									onChange={(e) => {
										setSearchQuery(e.target.value);
										// FIX 2: Clear stale selections when search changes
										setSelectedIds(new Set());
									}}
									placeholder={
										isHindi
											? "नाम (हिंदी/English), फ़ोन, मंडल, गुरु…"
											: "Name (Hindi/English), phone, mandal, guru…"
									}
									className="w-full min-h-touch pl-10 pr-10 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent rounded-xl text-sm focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
								/>
								{searchQuery && (
									<button
										type="button"
										onClick={() => {
											setSearchQuery("");
											setSelectedIds(new Set());
										}}
										aria-label={isHindi ? "खोज साफ़ करें" : "Clear search"}
										className="absolute right-0 top-1/2 -translate-y-1/2 min-w-touch min-h-touch flex items-center justify-center text-slate-400 hover:text-slate-600"
									>
										<X size={16} />
									</button>
								)}
							</div>
							<button
								type="button"
								onClick={() => {
									setExpandAll((v) => !v);
									setExpandedRows(new Set());
								}}
								aria-pressed={expandAll}
								title={
									expandAll
										? isHindi
											? "सब बंद करें"
											: "Collapse all"
										: isHindi
											? "सबकी पूरी जानकारी खोलें"
											: "Expand all"
								}
								aria-label={
									expandAll
										? isHindi
											? "सब बंद करें"
											: "Collapse all"
										: isHindi
											? "सब खोलें"
											: "Expand all"
								}
								className={`flex-none min-w-touch min-h-touch rounded-xl flex items-center justify-center transition-colors ${
									expandAll
										? "bg-emerald-500 text-white"
										: "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400"
								}`}
							>
								{expandAll ? (
									<ChevronsDownUp size={18} />
								) : (
									<ChevronsUpDown size={18} />
								)}
							</button>
							<button
								type="button"
								onClick={handleExportCSV}
								className="flex-none min-w-touch min-h-touch px-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center justify-center gap-1.5"
								title={
									isHindi
										? `दिख रही ${filteredProfiles.length} प्रोफाइल CSV में`
										: `Export the ${filteredProfiles.length} listed profiles to CSV`
								}
								aria-label={isHindi ? "CSV डाउनलोड" : "Download CSV"}
							>
								<Download size={18} />
								<span className="hidden sm:inline font-bold text-sm">CSV</span>
							</button>
						</div>

						<div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-x-auto scrollbar-hide snap-x">
							{(
								["pending", "approved", "rejected", "deleted", "all"] as const
							).map((f) => (
								<button
									type="button"
									key={f}
									onClick={() => {
										setFilter(f);
										setSelectedIds(new Set());
									}}
									aria-pressed={filter === f}
									className={`flex-none sm:flex-1 min-h-[38px] px-3 rounded-lg text-[13px] font-bold transition-all snap-start whitespace-nowrap flex items-center justify-center gap-1.5 ${
										filter === f
											? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
											: "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/50"
									}`}
								>
									{tabLabel(f)}
									<span
										className={`text-[11px] tabular-nums rounded-full px-1.5 ${
											f === "pending" && tabCounts.pending > 0
												? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
												: "bg-slate-200/70 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
										}`}
									>
										{tabCounts[f]}
									</span>
								</button>
							))}
						</div>
					</div>

					<div className="px-3 pt-3 space-y-2.5">
						<div className="flex gap-2">
							{!overrideMandalId && (
								<CustomDropdown
									value={mandalFilter}
									onChange={(v) => {
										setMandalFilter(v);
										setSelectedIds(new Set());
									}}
									options={[
										...[...MANDAL_LIST].reverse().map((m) => ({
											id: m.id,
											label: isHindi ? m.shortNameHi : m.shortNameEn,
										})),
										{
											id: "custom",
											label: isHindi ? "अन्य (भक्त ने लिखा)" : "Other (typed)",
										},
										{
											id: "none",
											label: isHindi ? "मंडल नहीं चुना" : "No mandal",
										},
									]}
									placeholder={isHindi ? "सभी मंडल" : "All Mandals"}
									className="flex-1 min-w-0"
								/>
							)}
							<CustomDropdown
								value={sortBy}
								onChange={(v) =>
									setSortBy(v === "all" ? "newest" : (v as typeof sortBy))
								}
								options={[
									{
										id: "newest",
										label: isHindi ? "↓ नए पहले" : "↓ Newest first",
									},
									{
										id: "lastSeen",
										label: isHindi ? "↓ हाल में सक्रिय" : "↓ Recently active",
									},
									{ id: "name", label: isHindi ? "↓ नाम A–Z" : "↓ Name A–Z" },
								]}
								placeholder={isHindi ? "क्रम" : "Order"}
								placeholderSelectable={false}
								className="flex-1 min-w-0"
							/>
						</div>

						{isSuperAdmin && !overrideMandalId && (
							<FamilyGroupsReport profiles={profiles} isHindi={isHindi} />
						)}

						{isSuperAdmin && !overrideMandalId && (
							<LoginOverview
								isHindi={isHindi}
								counts={loginCounts}
								filter={loginFilter}
								onFilter={(f) => {
									setLoginFilter(f);
									setSelectedIds(new Set());
								}}
								orphans={orphanLogins}
								loading={logins.loading}
								error={logins.error}
								at={logins.at}
								loaded={!!loginMap}
								onRefresh={logins.refresh}
							/>
						)}

						{/* Bulk Actions */}
						{filteredProfiles.length > 0 && (
							<div className="flex items-center gap-3 min-h-[36px]">
								<label className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-600 dark:text-slate-400 min-h-touch">
									<input
										type="checkbox"
										checked={
											visibleSelected.length === filteredProfiles.length &&
											filteredProfiles.length > 0
										}
										onChange={toggleSelectAll}
										className="w-5 h-5 rounded accent-emerald-500"
									/>
									{isHindi
										? `सभी चुनें (${filteredProfiles.length})`
										: `Select all (${filteredProfiles.length})`}
								</label>
							</div>
						)}
					</div>

					{/* List */}
					<div className="px-3 py-3 space-y-2">
						{filteredProfiles.length === 0 ? (
							<div className="text-center py-12 text-slate-400 dark:text-ink-400">
								<User size={48} className="mx-auto mb-3 opacity-50" />
								<p className="px-6">
									{searchQuery.trim()
										? isHindi
											? `“${searchQuery.trim()}” से कोई नहीं मिला — दूसरी स्पेलिंग या फ़ोन नंबर से खोजें`
											: `No one matches “${searchQuery.trim()}” — try another spelling or a phone number`
										: isHindi
											? "इस टैब में कोई प्रोफाइल नहीं"
											: "No profiles in this tab"}
								</p>
								{(searchQuery.trim() ||
									mandalFilter !== (overrideMandalId || "all")) &&
									tabCounts.all > 0 &&
									filter !== "all" && (
										<button
											type="button"
											onClick={() => setFilter("all")}
											className="mt-3 min-h-touch px-4 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
										>
											{isHindi
												? `“सभी” टैब में ${tabCounts.all} मिले`
												: `${tabCounts.all} found under “All”`}
										</button>
									)}
							</div>
						) : (
							filteredProfiles.slice(0, shownCount).map((profile) => {
								const isFamily = profile.memberType === "family";
								const open = expandAll || expandedRows.has(profile.rowId);
								const selected = selectedIds.has(profile.rowId);
								const status = rowStatus(profile);
								const reason = isFamily
									? noAppReasonOf(profile.familyNoAppReason)
									: null;
								const metaLine = [
									isFamily
										? `${isHindi ? "परिवार" : "Family"}${profile.parentName ? ` · ${profile.parentName}` : ""}${profile.familyRelation ? ` · ${getRelationLabel(profile.familyRelation, isHindi)}` : ""}`
										: profile.dikshaName && profile.realName
											? profile.dikshaName
											: "",
									getMandalName(profile.mandalId, profile.customMandalName),
									!isFamily && lastSeen[profile.parentUid]
										? formatLastSeen(profile.parentUid)
										: "",
								]
									.filter(Boolean)
									.join(" · ");
								return (
									<div
										key={profile.rowId}
										className={`relative rounded-2xl border transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_76px] ${
											selected
												? "border-emerald-400 dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/10"
												: isFamily
													? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
													: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
										} ${isFamily ? "ml-6 before:absolute before:-left-3.5 before:top-0 before:bottom-1/2 before:w-3 before:border-l-2 before:border-b-2 before:rounded-bl-lg before:border-slate-300 dark:before:border-slate-600" : "shadow-sm"}`}
									>
										{/* Summary row — tap to open the details */}
										<div className="flex items-center gap-2.5 p-2.5 pr-1">
											<input
												type="checkbox"
												checked={selected}
												onChange={() => toggleSelection(profile.rowId)}
												aria-label={
													isHindi
														? `${profile.realName || profile.email} चुनें`
														: `Select ${profile.realName || profile.email}`
												}
												className="w-5 h-5 rounded accent-emerald-500 shrink-0"
											/>
											<button
												type="button"
												onClick={() => {
													if (!profile.photoURL) return;
													setZoomRow(profile);
													setZoomImage(profile.photoURL);
												}}
												aria-label={isHindi ? "फोटो बड़ी करें" : "Zoom photo"}
												className={`${isFamily ? "w-10 h-10" : "w-11 h-11"} rounded-full overflow-hidden shrink-0 bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center ring-2 ${
													status === "approved"
														? "ring-emerald-400/70"
														: status === "rejected"
															? "ring-red-300 dark:ring-red-800"
															: status === "deleted"
																? "ring-slate-300 dark:ring-slate-600"
																: "ring-amber-300 dark:ring-amber-700"
												}`}
											>
												{profile.photoURL ? (
													<ThumbImg
														src={profile.photoURL}
														alt=""
														loading="lazy"
														decoding="async"
														className="w-full h-full object-cover"
													/>
												) : (
													<User size={20} className="text-emerald-600" />
												)}
											</button>
											<button
												type="button"
												onClick={() => toggleRow(profile.rowId)}
												aria-expanded={open}
												className="flex-1 min-w-0 text-left min-h-touch flex items-center gap-2"
											>
												<span className="flex-1 min-w-0">
													<span className="flex items-center gap-1.5">
														<span
															className={`font-bold text-slate-800 dark:text-white truncate ${isFamily ? "text-sm" : "text-[15px]"}`}
														>
															{profile.realName || profile.email || "—"}
														</span>
														{!isFamily && profile.gender && (
															<span
																className="shrink-0 text-slate-400"
																title={
																	profile.gender === "female"
																		? isHindi
																			? "महिला"
																			: "Female"
																		: isHindi
																			? "पुरुष"
																			: "Male"
																}
															>
																{profile.gender === "female" ? (
																	<Venus size={13} />
																) : (
																	<Mars size={13} />
																)}
															</span>
														)}
													</span>
													{metaLine && (
														<span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
															{metaLine}
														</span>
													)}
													<span className="flex flex-wrap items-center gap-1 mt-1">
														<StatusChip status={status} isHindi={isHindi} />
														{profile.mergedIntoUid && (
															<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
																{isHindi
																	? "दूसरी प्रोफ़ाइल में मिलाई गई"
																	: "Merged into another profile"}
															</span>
														)}
														{!isFamily && loginMap && (
															<LoginChip
																info={loginMap[profile.parentUid]}
																loaded
																isHindi={isHindi}
															/>
														)}
														{profile.resubmitted && (
															<span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
																🔄 {isHindi ? "दोबारा भेजा" : "Resubmitted"}
															</span>
														)}
														{profile.hasPendingEdits && (
															// Inside the card's open/close button, so a span, not a nested button.
															// biome-ignore lint/a11y/useSemanticElements: a <button> can't sit inside the row's button
															<span
																role="button"
																tabIndex={0}
																onClick={(e) => {
																	e.stopPropagation();
																	setHistoryProfile(profile);
																}}
																onKeyDown={(e) => {
																	if (e.key === "Enter" || e.key === " ") {
																		e.preventDefault();
																		e.stopPropagation();
																		setHistoryProfile(profile);
																	}
																}}
																title={
																	isHindi ? "क्या बदला, देखें" : "See what changed"
																}
																className="text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-md underline decoration-dotted underline-offset-2 cursor-pointer active:scale-95"
															>
																📝 {isHindi ? "बदलाव देखें" : "See edits"}
															</span>
														)}
														{!profile.submittedForReview &&
															!profile.isApproved &&
															!profile.isDeleted && (
																<span className="text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded-md">
																	✍️ {isHindi ? "ड्राफ्ट" : "Draft"}
																</span>
															)}
														{isFamily && !reason && (
															<span
																className="text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 px-1.5 py-0.5 rounded-md"
																title={
																	isHindi
																		? "कारण नहीं बताया (पुराना सदस्य) — ऐप पर हों तो लिंक होना चाहिए"
																		: "No reason given (older entry) — should be linked if they use the app"
																}
															>
																⚠ {isHindi ? "कारण नहीं" : "No reason"}
															</span>
														)}
													</span>
												</span>
												<ChevronDown
													size={18}
													className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
												/>
											</button>
										</div>

										{open && (
											<div className="px-3 pb-3 animate-in fade-in duration-150">
												<div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 p-3 space-y-2 text-[13px] text-slate-600 dark:text-slate-300">
													<dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
														{isFamily && (
															<DetailRow
																icon={<Users size={13} />}
																label={isHindi ? "किसके परिवार में" : "Family of"}
															>
																<button
																	type="button"
																	onClick={() =>
																		jumpToProfile(profile.parentUid)
																	}
																	className="text-blue-600 dark:text-blue-400 underline decoration-dotted text-left"
																>
																	{profile.parentName || "—"}
																</button>
															</DetailRow>
														)}
														{profile.dikshaName && (
															<DetailRow
																icon={<User size={13} />}
																label={isHindi ? "दीक्षित नाम" : "Diksha name"}
															>
																{profile.dikshaName}
															</DetailRow>
														)}
														{profile.guruName && (
															<DetailRow
																icon={<User size={13} />}
																label={isHindi ? "गुरु" : "Guru"}
															>
																{profile.guruName}
															</DetailRow>
														)}
														{profile.dikshaDate && (
															<DetailRow
																icon={<Calendar size={13} />}
																label={isHindi ? "दीक्षा" : "Diksha"}
															>
																{formatDisplayDate(profile.dikshaDate, isHindi)}
															</DetailRow>
														)}
														<DetailRow
															icon={<MapPin size={13} />}
															label={isHindi ? "मंडल" : "Mandal"}
														>
															{getMandalName(
																profile.mandalId,
																profile.customMandalName,
															)}
														</DetailRow>
														{profile.phoneNumber && (
															<DetailRow
																icon={<Phone size={13} />}
																label={
																	isFamily
																		? isHindi
																			? "फ़ोन (भक्त का)"
																			: "Phone (devotee's)"
																		: isHindi
																			? "फ़ोन"
																			: "Phone"
																}
															>
																<a
																	href={`https://wa.me/${whatsappNumber(profile.phoneNumber)}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium underline decoration-dotted"
																	title={
																		isHindi
																			? "WhatsApp पर मैसेज भेजें"
																			: "Send WhatsApp Message"
																	}
																>
																	{profile.phoneNumber}
																	<MessageCircle size={13} />
																</a>
															</DetailRow>
														)}
														{!isFamily && (
															<DetailRow
																icon={<Clock size={13} />}
																label={isHindi ? "आख़िरी बार" : "Last seen"}
															>
																<span
																	title={
																		lastSeen[profile.parentUid]
																			? new Date(
																					lastSeen[profile.parentUid],
																				).toLocaleString(
																					isHindi ? "hi-IN" : "en-IN",
																				)
																			: isHindi
																				? "ऐप 47.0.2 से पहले का रिकॉर्ड नहीं है"
																				: "Not recorded before app 47.0.2"
																	}
																>
																	{formatLastSeen(profile.parentUid)}
																</span>
															</DetailRow>
														)}
														{!isFamily && loginMap && (
															<DetailRow
																icon={<KeyRound size={13} />}
																label={isHindi ? "लॉगिन" : "Login"}
															>
																{loginMap[profile.parentUid] ? (
																	<>
																		{loginSummary(
																			loginMap[profile.parentUid],
																			isHindi,
																		)}
																		{loginMap[profile.parentUid].loginPhone &&
																			profile.phoneNumber &&
																			!samePhone(
																				loginMap[profile.parentUid].loginPhone,
																				profile.phoneNumber,
																			) && (
																				<span className="block text-[11px] text-amber-700 dark:text-amber-400">
																					{isHindi
																						? "⚠ प्रोफाइल में दूसरा फ़ोन नंबर लिखा है"
																						: "⚠ Profile shows a different phone number"}
																				</span>
																			)}
																	</>
																) : isHindi ? (
																	"लॉगिन खाता नहीं (हटाया गया)"
																) : (
																	"No login account (removed)"
																)}
															</DetailRow>
														)}
														{!isFamily && (
															<DetailRow
																icon={<User size={13} />}
																label={isHindi ? "लिंग" : "Gender"}
															>
																{profile.gender === "female"
																	? isHindi
																		? "महिला"
																		: "Female"
																	: profile.gender === "male"
																		? isHindi
																			? "पुरुष"
																			: "Male"
																		: isHindi
																			? "सेट नहीं (एडिट में चुनें)"
																			: "Not set (choose in Edit)"}
															</DetailRow>
														)}
														{profile.submissionDate && (
															<DetailRow
																icon={<Calendar size={13} />}
																label={isHindi ? "सबमिट" : "Submitted"}
															>
																{new Date(
																	profile.submissionDate,
																).toLocaleDateString(
																	isHindi ? "hi-IN" : "en-US",
																	{
																		day: "numeric",
																		month: "short",
																		year: "numeric",
																	},
																)}
															</DetailRow>
														)}
														{profile.isApproved && profile.approvalDate && (
															<DetailRow
																icon={<CheckCircle size={13} />}
																label={isHindi ? "मंज़ूर" : "Approved"}
															>
																{new Date(
																	profile.approvalDate,
																).toLocaleDateString(
																	isHindi ? "hi-IN" : "en-US",
																	{
																		day: "numeric",
																		month: "short",
																		year: "numeric",
																	},
																)}
															</DetailRow>
														)}
													</dl>

													{isFamily && (
														<p
															className={`text-xs ${reason ? "text-slate-500 dark:text-slate-400" : "text-amber-700 dark:text-amber-400"}`}
														>
															{reason
																? `${reason.emoji} ${isHindi ? reason.hi : reason.en}`
																: isHindi
																	? "⚠ कारण नहीं बताया (पुराना सदस्य) — ऐप पर हों तो लिंक होना चाहिए"
																	: "⚠ No reason given (older entry) — should be linked if they use the app"}
														</p>
													)}

													{profile.isAspiring && (
														<p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
															<Info size={13} />
															{isHindi ? "दीक्षा के इच्छुक" : "Aspiring for Diksha"}
														</p>
													)}

													{profile.personalExperience && (
														<div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-100 dark:border-slate-700">
															<p
																className={`whitespace-pre-wrap text-slate-600 dark:text-slate-300 ${!expandedExps.has(profile.rowId) ? "line-clamp-3" : ""}`}
															>
																{profile.personalExperience}
															</p>
															{profile.personalExperience.length > 120 && (
																<button
																	type="button"
																	onClick={() =>
																		setExpandedExps((prev) => {
																			const next = new Set(prev);
																			if (next.has(profile.rowId))
																				next.delete(profile.rowId);
																			else next.add(profile.rowId);
																			return next;
																		})
																	}
																	className="mt-1 text-[11px] font-bold text-blue-600 dark:text-blue-400"
																>
																	{expandedExps.has(profile.rowId)
																		? isHindi
																			? "कम दिखाएं"
																			: "Show less"
																		: isHindi
																			? "और पढ़ें..."
																			: "Read more..."}
																</button>
															)}
														</div>
													)}

													{profile.rejectionNote && !profile.isApproved && (
														<p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
															<AlertTriangle
																size={13}
																className="shrink-0 mt-px"
															/>
															{profile.rejectionNote}
														</p>
													)}

													<div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400 dark:text-slate-500">
														<span className="truncate max-w-full">
															ID: {profile.email || profile.parentUid}
														</span>
														{!isFamily &&
															profile.fcmTokens &&
															profile.fcmTokens.length > 0 && (
																<button
																	type="button"
																	onClick={async () => {
																		const textToCopy =
																			profile.fcmTokens?.join(", ");
																		const { copyToClipboard } = await import(
																			"../../../utils/clipboard"
																		);
																		const success =
																			await copyToClipboard(textToCopy);
																		showToast(
																			success
																				? isHindi
																					? "टोकन कॉपी हो गया"
																					: "Token Copied"
																				: isHindi
																					? "कॉपी विफल रहा"
																					: "Copy Failed",
																			success ? "success" : "error",
																		);
																	}}
																	className="px-1.5 py-0.5 bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-ink-300 flex items-center gap-1"
																	title="Copy FCM Tokens"
																>
																	<Copy size={10} />
																	{isHindi ? "टोकन कॉपी करें" : "Copy Token"}
																</button>
															)}
													</div>
												</div>

												{/* Actions */}
												<div className="grid grid-cols-2 sm:flex gap-2 mt-2.5">
													{profile.isDeleted ? (
														<>
															{profile.mergedIntoUid ? (
																// Restoring a merged profile would bring the
																// duplicate back with its links already moved.
																<p className="col-span-2 sm:flex-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
																	{isHindi
																		? `यह ${profiles.find((p) => p.uid === profile.mergedIntoUid)?.realName || "दूसरी प्रोफ़ाइल"} में मिलाई गई थी — इसलिए रीस्टोर नहीं होती। सारी जानकारी और लिंक अब वहीं हैं।`
																		: `Merged into ${profiles.find((p) => p.uid === profile.mergedIntoUid)?.realName || "another profile"} — so it can't be restored. Its details and links are there now.`}
																</p>
															) : (
																<ActionButton
																	tone="approve"
																	icon={<CheckCircle size={16} />}
																	label={isHindi ? "रीस्टोर करें" : "Restore"}
																	onClick={() =>
																		handleRestore(profile.parentUid)
																	}
																/>
															)}
															{canDelete && (
																<ActionButton
																	tone="danger-solid"
																	icon={<Trash2 size={16} />}
																	label={
																		isHindi ? "स्थायी डिलीट" : "Perm Delete"
																	}
																	onClick={() =>
																		setPermanentDeleteTarget(profile)
																	}
																/>
															)}
														</>
													) : (
														<>
															{!profile.isApproved ? (
																<ActionButton
																	tone="approve"
																	icon={<Check size={16} />}
																	label={isHindi ? "मंज़ूरी" : "Approve"}
																	onClick={() =>
																		isFamily && profile.familyMemberId
																			? setFamilyMemberStatus(
																					profile.parentUid,
																					profile.familyMemberId,
																					"approved",
																				)
																			: toggleApproval(profile.parentUid, false)
																	}
																/>
															) : (
																<ActionButton
																	tone="warn"
																	icon={<XCircle size={16} />}
																	label={isHindi ? "मंज़ूरी रद्द" : "Revoke"}
																	onClick={() =>
																		isFamily && profile.familyMemberId
																			? setFamilyMemberStatus(
																					profile.parentUid,
																					profile.familyMemberId,
																					"pending",
																				)
																			: toggleApproval(profile.parentUid, true)
																	}
																/>
															)}
															<ActionButton
																tone="danger"
																icon={<X size={16} />}
																label={isHindi ? "अस्वीकार" : "Reject"}
																onClick={() => {
																	setShowRejectModal(profile.parentUid);
																	setRejectMemberId(
																		isFamily
																			? profile.familyMemberId || null
																			: null,
																	);
																	setRejectNote("");
																}}
															/>
															<ActionButton
																tone="neutral"
																icon={<Edit2 size={16} />}
																label={isHindi ? "एडिट" : "Edit"}
																onClick={() => openEdit(profile)}
															/>
															{profile.photoURL && (
																<ActionButton
																	tone="neutral"
																	icon={<Crop size={16} />}
																	label={isHindi ? "फोटो क्रॉप" : "Crop photo"}
																	onClick={() => cropExistingPhoto(profile)}
																/>
															)}
														</>
													)}
													<ActionButton
														tone="info"
														icon={<History size={16} />}
														label={isHindi ? "इतिहास" : "History"}
														onClick={() => setHistoryProfile(profile)}
													/>
													{!profile.isDeleted &&
														canDelete &&
														!overrideMandalId && (
															<ActionButton
																tone="danger"
																icon={<Trash2 size={16} />}
																label={isHindi ? "डिलीट" : "Delete"}
																onClick={() => setDeleteTarget(profile)}
															/>
														)}
												</div>
											</div>
										)}
									</div>
								);
							})
						)}
						{filteredProfiles.length > shownCount && (
							<button
								type="button"
								onClick={() => setShownCount((n) => n + PAGE_SIZE)}
								className="w-full min-h-touch rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-emerald-600 dark:text-emerald-400 active:scale-[0.99]"
							>
								{isHindi
									? `और दिखाएँ (${filteredProfiles.length - shownCount} बाकी)`
									: `Show more (${filteredProfiles.length - shownCount} more)`}
							</button>
						)}
					</div>

					{/* Selection bar */}
					{visibleSelected.length > 0 && filter !== "deleted" && (
						<div className="sticky bottom-0 z-20 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-slate-50 via-slate-50/95 dark:from-slate-900 dark:via-slate-900/95 to-transparent">
							<div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg p-2 pl-3">
								<span className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">
									{isHindi
										? `${visibleSelected.length} चुने`
										: `${visibleSelected.length} selected`}
								</span>
								<button
									type="button"
									onClick={() => setSelectedIds(new Set())}
									className="min-h-touch px-3 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400"
								>
									{isHindi ? "हटाएँ" : "Clear"}
								</button>
								<button
									type="button"
									onClick={handleBulkApprove}
									disabled={bulkLoading}
									className="min-h-touch px-4 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
								>
									{bulkLoading ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Check size={14} />
									)}
									{isHindi ? "मंज़ूर करें" : "Approve"}
								</button>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Reject Modal (above the edit screen, which can open it) */}
			{showRejectModal && (
				<div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
						<h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
							<AlertTriangle className="text-red-500" size={20} />
							{rejectMemberId
								? isHindi
									? "परिवार सदस्य अस्वीकार करें"
									: "Reject Family Member"
								: isHindi
									? "प्रोफाइल अस्वीकार करें"
									: "Reject Profile"}
						</h3>
						{(() => {
							const parent = profiles.find((p) => p.uid === showRejectModal);
							const member = rejectMemberId
								? parent?.familyMembers?.find((m) => m.id === rejectMemberId)
								: undefined;
							return (
								<p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
									{member
										? `${member.realName} • ${isHindi ? "परिवार" : "family of"} ${parent?.realName || ""}`
										: parent?.realName || parent?.email || ""}
									{!rejectMemberId &&
										(parent?.familyMembers?.length || 0) > 0 && (
											<span className="block font-normal text-slate-400 dark:text-ink-400 mt-0.5">
												{isHindi
													? "परिवार के सदस्यों की स्थिति नहीं बदलेगी।"
													: "Family members keep their own status."}
											</span>
										)}
								</p>
							);
						})()}
						<p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
							{isHindi
								? "अस्वीकार करने का कारण लिखें (यह भक्त को दिखेगा):"
								: "Write a reason for rejection (will be shown to the devotee):"}
						</p>
						<textarea
							value={rejectNote}
							onChange={(e) => setRejectNote(e.target.value)}
							placeholder={isHindi ? "कारण लिखें..." : "Write reason..."}
							rows={3}
							className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all resize-none"
						/>
						<label className="flex items-center gap-2.5 mt-4 mb-2 cursor-pointer group w-fit">
							<div className="relative flex items-center justify-center">
								<input
									type="checkbox"
									checked={!rejectSilent}
									onChange={() => setRejectSilent(!rejectSilent)}
									className="peer appearance-none w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded focus:ring-0 checked:bg-blue-500 checked:border-blue-500 transition-colors cursor-pointer"
								/>
								<Check
									size={14}
									className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"
									strokeWidth={3}
								/>
							</div>
							<span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors flex items-center gap-1.5">
								{!rejectSilent ? (
									<Bell size={16} className="text-blue-500" />
								) : (
									<BellOff
										size={16}
										className="text-slate-400 dark:text-ink-400"
									/>
								)}
								{isHindi
									? !rejectSilent
										? "अलर्ट के साथ नोटिफिकेशन भेजें"
										: "साइलेंट नोटिफिकेशन भेजें (बिना आवाज़)"
									: !rejectSilent
										? "Send notification with alert"
										: "Send silent notification"}
							</span>
						</label>
						<div className="flex gap-3 mt-4">
							<button
								onClick={() => {
									closeRejectModal();
									setRejectNote("");
									setRejectSilent(false);
									setRejectMemberId(null);
								}}
								className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-ink-600 transition-colors"
							>
								{isHindi ? "रद्द" : "Cancel"}
							</button>
							<button
								onClick={handleDisapprove}
								disabled={!rejectNote.trim() || rejectLoading}
								className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300 transition-colors flex items-center justify-center gap-2"
							>
								{rejectLoading ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<X size={16} />
								)}
								{isHindi ? "अस्वीकार करें" : "Reject"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ════ FULL SCREEN EDIT PANEL ════ */}
			{editProfile && (
				<div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col animate-in slide-in-from-right duration-300">
					{/* Header */}
					<div className="shrink-0 flex items-center gap-2 px-3 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
						<button
							type="button"
							onClick={requestCloseEdit}
							aria-label={isHindi ? "पीछे" : "Back"}
							className="min-w-touch min-h-touch flex items-center justify-center text-slate-500 dark:text-ink-300 hover:text-slate-800 dark:hover:text-white rounded-full transition-colors active:bg-slate-100 dark:active:bg-slate-700"
						>
							<ArrowLeft size={22} />
						</button>
						<div className="flex-1 min-w-0">
							<h2 className="font-bold text-slate-800 dark:text-white truncate">
								{editProfile.realName || editProfile.email || "—"}
							</h2>
							<p className="text-xs text-slate-500 dark:text-slate-400 truncate">
								{editProfile.memberType === "family"
									? isHindi
										? `परिवार सदस्य · ${editProfile.parentName || ""}`
										: `Family member · ${editProfile.parentName || ""}`
									: isHindi
										? "प्रोफाइल संपादित करें"
										: "Edit profile"}
								{editDirty && (
									<span className="ml-1.5 font-bold text-amber-600 dark:text-amber-400">
										• {isHindi ? "बदलाव सेव नहीं हुए" : "unsaved"}
									</span>
								)}
							</p>
						</div>
						<button
							type="button"
							onClick={handleSaveEdit}
							disabled={actionLoading || uploadingPhoto}
							className="min-h-touch px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 active:scale-95 shadow-sm"
						>
							{actionLoading ? (
								<Loader2 size={16} className="animate-spin" />
							) : (
								<Check size={16} />
							)}
							{isHindi ? "सेव करें" : "Save"}
						</button>
					</div>

					{/* Scrollable body (a new person starts at the top) */}
					<div key={editProfile.rowId} className="flex-1 overflow-y-auto">
						<div className="max-w-lg mx-auto p-4 space-y-4 pb-24">
							{/* Photo + who */}
							<div className="flex items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									aria-label={isHindi ? "फोटो बदलें" : "Change photo"}
									className="relative w-20 h-20 shrink-0 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-700 shadow bg-slate-100 dark:bg-slate-800 group"
								>
									{editProfile.photoURL ? (
										<ThumbImg
											src={editProfile.photoURL}
											thumbWidth={THUMB.tile}
											alt=""
											className="w-full h-full object-cover"
										/>
									) : (
										<span className="w-full h-full flex items-center justify-center">
											<User
												size={32}
												className="text-slate-400 dark:text-ink-400"
											/>
										</span>
									)}
									<span
										className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${uploadingPhoto ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
									>
										{uploadingPhoto ? (
											<Loader2 size={24} className="text-white animate-spin" />
										) : (
											<Camera size={22} className="text-white" />
										)}
									</span>
								</button>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleAdminPhotoUpload}
									className="hidden"
								/>
								<div className="flex-1 min-w-0 space-y-1.5">
									<p className="text-xs text-slate-500 dark:text-slate-400">
										{uploadingPhoto
											? isHindi
												? "अपलोड हो रहा है…"
												: "Uploading…"
											: isHindi
												? "फोटो बदलने के लिए उस पर दबाएँ"
												: "Tap the photo to change it"}
									</p>
									{!uploadingPhoto && editProfile.photoURL && (
										<button
											type="button"
											onClick={() =>
												setAdminCrop({ src: editProfile.photoURL || "" })
											}
											className="min-h-[36px] px-3 rounded-full text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 active:scale-95"
										>
											{isHindi
												? "मौजूदा फोटो सेट करें (ज़ूम / जगह)"
												: "Adjust current photo (zoom / position)"}
										</button>
									)}
								</div>
							</div>

							{/* Status, with the list's actions, so it can be handled here too */}
							{(() => {
								const live = allRows.find((r) => r.rowId === editProfile.rowId);
								if (!live) return null;
								const isFam =
									live.memberType === "family" && !!live.familyMemberId;
								return (
									<div className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 space-y-2.5">
										<div className="flex flex-wrap items-center gap-1.5">
											<StatusChip status={rowStatus(live)} isHindi={isHindi} />
											{live.hasPendingEdits && (
												<button
													type="button"
													onClick={() => setHistoryProfile(live)}
													className="text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-md underline decoration-dotted underline-offset-2"
												>
													📝 {isHindi ? "बदलाव देखें" : "See edits"}
												</button>
											)}
											{!live.submittedForReview &&
												!live.isApproved &&
												!live.isDeleted && (
													<span className="text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded-md">
														✍️ {isHindi ? "ड्राफ्ट" : "Draft"}
													</span>
												)}
											{live.memberType === "primary" &&
												lastSeen[live.parentUid] && (
													<span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
														<Clock size={12} />
														{formatLastSeen(live.parentUid)}
													</span>
												)}
										</div>
										{live.rejectionNote && !live.isApproved && (
											<p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
												<AlertTriangle size={13} className="shrink-0 mt-px" />
												{live.rejectionNote}
											</p>
										)}
										{!live.isDeleted && (
											<div className="grid grid-cols-3 gap-2">
												{!live.isApproved ? (
													<ActionButton
														tone="approve"
														icon={<Check size={16} />}
														label={isHindi ? "मंज़ूरी" : "Approve"}
														onClick={() =>
															isFam && live.familyMemberId
																? setFamilyMemberStatus(
																		live.parentUid,
																		live.familyMemberId,
																		"approved",
																	)
																: toggleApproval(live.parentUid, false)
														}
													/>
												) : (
													<ActionButton
														tone="warn"
														icon={<XCircle size={16} />}
														label={isHindi ? "मंज़ूरी रद्द" : "Revoke"}
														onClick={() =>
															isFam && live.familyMemberId
																? setFamilyMemberStatus(
																		live.parentUid,
																		live.familyMemberId,
																		"pending",
																	)
																: toggleApproval(live.parentUid, true)
														}
													/>
												)}
												<ActionButton
													tone="danger"
													icon={<X size={16} />}
													label={isHindi ? "अस्वीकार" : "Reject"}
													onClick={() => {
														setShowRejectModal(live.parentUid);
														setRejectMemberId(
															isFam ? live.familyMemberId || null : null,
														);
														setRejectNote("");
													}}
												/>
												<ActionButton
													tone="info"
													icon={<History size={16} />}
													label={isHindi ? "इतिहास" : "History"}
													onClick={() => setHistoryProfile(live)}
												/>
											</div>
										)}
									</div>
								);
							})()}

							{/* A hand-added member: the devotee who added them */}
							{editProfile.memberType === "family" &&
								(() => {
									const head = findRow(editProfile.parentUid);
									if (!head) return null;
									return (
										<button
											type="button"
											onClick={() => jumpToProfile(editProfile.parentUid)}
											className="w-full flex items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 text-left active:scale-[0.99] transition"
										>
											<MiniAvatar photoURL={head.photoURL} />
											<span className="flex-1 min-w-0">
												<span className="block text-[11px] text-slate-500 dark:text-slate-400">
													{isHindi
														? "इन्होंने परिवार में जोड़ा"
														: "Added to the family by"}
												</span>
												<span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
													{head.realName || head.email || "—"}
												</span>
											</span>
											<ChevronRight
												size={18}
												className="text-slate-300 shrink-0"
											/>
										</button>
									);
								})()}

							{/* Identity */}
							<EditSection title={isHindi ? "पहचान" : "Identity"}>
								<EditField label={isHindi ? "असली नाम" : "Full Name"}>
									<input
										type="text"
										value={editProfile.realName}
										onChange={(e) =>
											setEditProfile({
												...editProfile,
												realName: e.target.value,
											})
										}
										className={editInputClass}
									/>
								</EditField>
								<EditField label={isHindi ? "दीक्षित नाम" : "Diksha Name"}>
									<input
										type="text"
										value={editProfile.dikshaName || ""}
										onChange={(e) =>
											setEditProfile({
												...editProfile,
												dikshaName: e.target.value,
											})
										}
										className={editInputClass}
									/>
								</EditField>
								{editProfile.memberType === "family" && (
									<EditField
										label={
											isHindi
												? `${editProfile.parentName || "भक्त"} से रिश्ता`
												: `Relation to ${editProfile.parentName || "devotee"}`
										}
									>
										<RelationPicker
											value={editProfile.familyRelation || ""}
											onChange={(familyRelation) =>
												setEditProfile((prev) =>
													prev ? { ...prev, familyRelation } : prev,
												)
											}
											isHindi={isHindi}
											accent="blue"
										/>
									</EditField>
								)}
								{editProfile.memberType === "primary" && (
									<EditField
										label={isHindi ? "लिंग" : "Gender"}
										hint={
											isHindi
												? "परिवार के रिश्ते अपने-आप भरने में मदद करता है"
												: "Helps fill in family relations automatically"
										}
									>
										<div className="grid grid-cols-2 gap-2">
											{(
												[
													["male", "पुरुष", "Male"],
													["female", "महिला", "Female"],
												] as const
											).map(([g, hi, en]) => (
												<button
													type="button"
													key={g}
													aria-pressed={editProfile.gender === g}
													onClick={() =>
														setEditProfile({ ...editProfile, gender: g })
													}
													className={`min-h-touch rounded-xl border-2 text-sm font-bold transition active:scale-[0.98] ${
														editProfile.gender === g
															? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
															: "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
													}`}
												>
													{isHindi ? hi : en}
												</button>
											))}
										</div>
									</EditField>
								)}
							</EditSection>

							{/* Diksha */}
							<EditSection title={isHindi ? "दीक्षा" : "Diksha"}>
								<EditField label={isHindi ? "गुरु का नाम" : "Guru Name"}>
									<CustomDropdown
										value={guruSelection}
										onChange={(val) => {
											setGuruSelection(val);
											if (val !== "other") {
												const resolved = resolveGuruName(val, customGuruName);
												setEditProfile({
													...editProfile,
													guruName: resolved,
													isAspiring: val === "aspiring",
												});
											} else {
												setEditProfile({
													...editProfile,
													guruName: customGuruName,
													isAspiring: false,
												});
											}
										}}
										options={GURU_OPTIONS.map((g) => ({
											id: g.id,
											label: isHindi ? g.labelHi : g.labelEn,
										}))}
										placeholder={isHindi ? "गुरु चुनें..." : "Select Guru..."}
										placeholderSelectable={false}
									/>
									{guruSelection === "other" && (
										<input
											type="text"
											placeholder={
												isHindi ? "गुरु का नाम दर्ज करें" : "Enter Guru name"
											}
											value={customGuruName}
											onChange={(e) => {
												const val = e.target.value;
												setCustomGuruName(val);
												setEditProfile({
													...editProfile,
													guruName: val,
													isAspiring: false,
												});
											}}
											className={`${editInputClass} mt-2`}
										/>
									)}
								</EditField>
								<EditField label={isHindi ? "दीक्षा की तारीख" : "Diksha Date"}>
									<input
										type="date"
										value={toDateInputFormat(editProfile.dikshaDate || "")}
										onChange={(e) =>
											setEditProfile({
												...editProfile,
												dikshaDate: fromDateInputFormat(e.target.value),
											})
										}
										className={editInputClass}
									/>
								</EditField>
								<label className="flex items-center gap-3 min-h-touch cursor-pointer">
									<input
										type="checkbox"
										checked={editProfile.isAspiring || false}
										onChange={(e) =>
											setEditProfile({
												...editProfile,
												isAspiring: e.target.checked,
											})
										}
										className="w-5 h-5 rounded accent-blue-500 cursor-pointer shrink-0"
									/>
									<span className="text-sm font-medium text-slate-700 dark:text-slate-300">
										{isHindi ? "दीक्षा के इच्छुक हैं" : "Aspiring for Diksha"}
									</span>
								</label>
							</EditSection>

							{editProfile.memberType === "primary" && (
								<EditSection
									title={isHindi ? "संपर्क व मंडल" : "Contact & mandal"}
								>
									<EditField label={isHindi ? "फोन नंबर" : "Phone Number"}>
										<input
											type="tel"
											inputMode="tel"
											maxLength={13}
											value={editProfile.phoneNumber || ""}
											onChange={(e) =>
												setEditProfile({
													...editProfile,
													phoneNumber: e.target.value,
												})
											}
											className={editInputClass}
										/>
										{loginMap?.[editProfile.parentUid] && (
											<p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
												{isHindi ? "लॉगिन: " : "Logs in with: "}
												{loginSummary(loginMap[editProfile.parentUid], isHindi)}
											</p>
										)}
									</EditField>
									<EditField label={isHindi ? "मंडल" : "Mandal"}>
										<CustomDropdown
											value={editProfile.mandalId || ""}
											onChange={(val) =>
												setEditProfile({ ...editProfile, mandalId: val })
											}
											options={[
												...MANDAL_LIST.map((m) => ({
													id: m.id,
													label: isHindi ? m.shortNameHi : m.shortNameEn,
												})),
												// A mandal that is not in the list: its name is typed below.
												{
													id: "custom",
													label: isHindi
														? "अन्य (नाम लिखें)"
														: "Other (type the name)",
												},
											]}
											placeholder={isHindi ? "मंडल चुनें" : "Select Mandal"}
											placeholderSelectable={false}
										/>
										{editProfile.mandalId === "custom" && (
											<div className="mt-2">
												<input
													type="text"
													value={editProfile.customMandalName || ""}
													onChange={(e) =>
														setEditProfile({
															...editProfile,
															customMandalName: e.target.value,
														})
													}
													maxLength={20}
													placeholder={
														isHindi
															? "मंडल का नाम लिखें"
															: "Type the mandal's name"
													}
													aria-label={isHindi ? "मंडल का नाम" : "Mandal name"}
													className={editInputClass}
												/>
												<p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
													{isHindi
														? "सूची में न हो तो यहाँ नाम लिखें (ज़्यादा से ज़्यादा 20 अक्षर)। सूची वाला मंडल चुनने पर यह नाम हट जाएगा।"
														: "For a mandal not in the list (up to 20 letters). Picking a listed mandal clears it."}
												</p>
											</div>
										)}
									</EditField>
									<EditField
										label={isHindi ? "व्यक्तिगत अनुभव" : "Personal Experience"}
									>
										<textarea
											value={editProfile.personalExperience || ""}
											onChange={(e) =>
												setEditProfile({
													...editProfile,
													personalExperience: e.target.value,
												})
											}
											rows={4}
											className={`${editInputClass} resize-y`}
										/>
									</EditField>
								</EditSection>
							)}

							{/* The members this devotee added by hand (each opens their own edit) */}
							{editProfile.memberType === "primary" &&
								(() => {
									const members = allRows.filter(
										(r) =>
											r.parentUid === editProfile.parentUid &&
											r.memberType === "family",
									);
									if (members.length === 0) return null;
									return (
										<EditSection
											title={
												isHindi
													? `हाथ से जोड़े परिवार सदस्य (${members.length})`
													: `Family added by hand (${members.length})`
											}
										>
											<ul className="-my-1 divide-y divide-slate-100 dark:divide-slate-700/60">
												{members.map((m) => (
													<li key={m.rowId}>
														<button
															type="button"
															onClick={() =>
																jumpToProfile(m.parentUid, m.familyMemberId)
															}
															className="w-full min-h-touch flex items-center gap-3 py-2 text-left"
														>
															<MiniAvatar photoURL={m.photoURL} />
															<span className="flex-1 min-w-0">
																<span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
																	{m.realName || m.dikshaName || "—"}
																</span>
																<span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
																	{m.familyRelation
																		? getRelationLabel(
																				m.familyRelation,
																				isHindi,
																			)
																		: isHindi
																			? "रिश्ता नहीं भरा"
																			: "No relation set"}
																</span>
															</span>
															<StatusChip
																status={rowStatus(m)}
																isHindi={isHindi}
															/>
															<ChevronRight
																size={16}
																className="text-slate-300 shrink-0"
															/>
														</button>
													</li>
												))}
											</ul>
										</EditSection>
									);
								})()}

							{/* ════ ADMIN: FAMILY LINKING PANEL (primary profiles only) ════ */}
							{editProfile.memberType === "primary" && (
								<AdminFamilyLinkingPanel
									profile={editProfile}
									allProfiles={profiles}
									isHindi={isHindi}
									onOpenProfile={jumpToProfile}
								/>
							)}

							<button
								type="button"
								onClick={handleSaveEdit}
								disabled={actionLoading || uploadingPhoto}
								className="w-full min-h-touch bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] shadow-sm"
							>
								{actionLoading ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<Check size={16} />
								)}
								{isHindi ? "बदलाव सेव करें" : "Save changes"}
							</button>
						</div>
					</div>
				</div>
			)}

			{adminCrop && (
				<PhotoCropper
					src={adminCrop.src}
					isHindi={isHindi}
					onCancel={closeAdminCrop}
					onConfirm={uploadAdminPhoto}
					maxZoom={12}
					title={
						adminCrop.target
							? isHindi
								? `${adminCrop.target.realName || "भक्त"} की फोटो क्रॉप करें`
								: `Crop ${adminCrop.target.realName || "devotee"}'s photo`
							: undefined
					}
				/>
			)}

			{/* Delete Confirmation Modal */}
			{deleteTarget && (
				<div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 text-center">
						<div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
							<Trash2 size={32} />
						</div>
						<h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
							{isHindi ? "क्या आप सुनिश्चित हैं?" : "Are you sure?"}
						</h3>
						<p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
							<span className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
								{deleteTarget.realName || deleteTarget.email}
							</span>
							{deleteTarget.memberType === "family"
								? isHindi
									? `यह सदस्य ${deleteTarget.parentName || "भक्त"} की परिवार सूची से हट जाएगा। इसे वापस नहीं लाया जा सकता।`
									: `This member will be removed from ${deleteTarget.parentName || "the devotee"}'s family list. This can't be undone.`
								: isHindi
									? "प्रोफाइल “डिलीट” टैब में चली जाएगी और भक्त को सूचनाएँ नहीं जाएँगी। वहाँ से रीस्टोर की जा सकती है।"
									: "The profile moves to the Deleted tab and gets no more notifications. It can be restored from there."}
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => closeDeleteProfile()}
								className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
							>
								{isHindi ? "रद्द करें" : "Cancel"}
							</button>
							<button
								onClick={handleDelete}
								disabled={actionLoading}
								className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-red-500/20"
							>
								{actionLoading ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<Trash2 size={16} />
								)}
								{isHindi ? "डिलीट करें" : "Delete"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Permanent Delete Confirmation Modal */}
			{permanentDeleteTarget && (
				<div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 text-center border border-red-500/20">
						<div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-50 dark:border-red-900/10">
							<Trash2 size={32} />
						</div>
						<h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
							{isHindi ? "स्थायी रूप से डिलीट?" : "Permanent Delete?"}
						</h3>
						<p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
							{isHindi
								? "यह प्रोफाइल स्थायी रूप से डेटाबेस से हटा दी जाएगी और इसे कभी वापस नहीं लाया जा सकता। क्या आप सचमुच ऐसा करना चाहते हैं?"
								: "This profile will be PERMANENTLY DELETED from the database. It cannot be recovered. Are you absolutely sure?"}
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => closePermanentDelete()}
								className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
							>
								{isHindi ? "रद्द करें" : "Cancel"}
							</button>
							<button
								onClick={handlePermanentDelete}
								disabled={actionLoading}
								className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-red-600/20"
							>
								{actionLoading ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<Trash2 size={16} />
								)}
								{isHindi ? "हमेशा के लिए डिलीट" : "Delete Forever"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Image Zoom Modal */}
			{zoomImage && (
				<div className="fixed inset-0 z-[120] bg-black flex flex-col animate-in fade-in duration-200">
					<div className="flex justify-between items-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent">
						<button
							onClick={() => closeZoomImage()}
							className="p-2 text-white/80 hover:text-white rounded-full transition-colors active:bg-white/10"
						>
							<ArrowLeft size={24} />
						</button>
						{zoomRow && !zoomRow.isDeleted && (
							<button
								type="button"
								onClick={() =>
									cropExistingPhoto({ ...zoomRow, photoURL: zoomImage })
								}
								className="ml-auto mr-1 min-h-touch px-4 rounded-full bg-white/15 text-white text-sm font-bold flex items-center gap-2 active:scale-95"
							>
								<Crop size={18} />
								{isHindi ? "क्रॉप करें" : "Crop"}
							</button>
						)}
						<a
							href={zoomImage}
							download="profile_photo.jpg"
							target="_blank"
							rel="noopener noreferrer"
							className="p-2 text-gold-700 hover:bg-gold-600/20 rounded-full transition-colors active:bg-gold-600/30"
							title="Download Photo"
							onClick={(e) => e.stopPropagation()}
						>
							<Download size={24} />
						</a>
					</div>
					<div
						className="flex-1 flex items-center justify-center overflow-hidden"
						onClick={() => closeZoomImage()}
					>
						<img
							src={zoomImage}
							alt="Zoomed Profile"
							className="w-full h-full object-contain animate-in zoom-in-95 duration-200"
							onClick={(e) => e.stopPropagation()} // Prevent click from closing when clicking image
						/>
					</div>
				</div>
			)}
			{/* Edit history */}
			{historyProfile &&
				(() => {
					// Live data: the row is a copy from when it opened.
					const live =
						allRows.find((r) => r.rowId === historyProfile.rowId) ||
						historyProfile;
					const owner = getParentProfile(live.parentUid) || live;
					const isFam = live.memberType === "family";
					return (
						<EditHistorySheet
							name={live.realName || live.email || ""}
							photo={live.photoURL}
							history={owner.editHistory || []}
							reviewLog={owner.reviewLog || []}
							facts={{
								status: rowStatus(live),
								rejectionNote: live.rejectionNote,
								createdAt: isFam ? undefined : owner.createdAt,
								submissionDate: isFam ? undefined : owner.submissionDate,
								approvalDate: live.approvalDate || undefined,
								lastSeen: isFam ? undefined : lastSeen[live.parentUid],
							}}
							isHindi={isHindi}
							familyOf={isFam ? live.parentName || "—" : undefined}
							onClose={() => closeHistoryProfile()}
							onZoomPhoto={(url) => {
								setZoomRow(null);
								setZoomImage(url);
							}}
							onApprove={
								!isFam && !live.isApproved && !live.isDeleted
									? async () => {
											await toggleApproval(live.parentUid, false);
											closeHistoryProfile();
										}
									: undefined
							}
							onMarkReviewed={
								owner.hasPendingEdits
									? () => handleMarkReviewed(live)
									: undefined
							}
							onReject={
								live.isDeleted
									? undefined
									: () => {
											closeHistoryProfile();
											// After the history's own back entry is gone.
											afterHistorySettles(() => {
												setShowRejectModal(live.parentUid);
												setRejectMemberId(
													isFam ? live.familyMemberId || null : null,
												);
												setRejectNote("");
											});
										}
							}
							onEdit={
								live.isDeleted
									? undefined
									: () => {
											closeHistoryProfile();
											afterHistorySettles(() =>
												jumpToProfile(live.parentUid, live.familyMemberId),
											);
										}
							}
						/>
					);
				})()}
		</div>
	);
};

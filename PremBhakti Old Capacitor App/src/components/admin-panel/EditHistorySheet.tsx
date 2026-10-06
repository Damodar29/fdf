import { formatDistanceToNow } from "date-fns";
import { hi as hiLocale } from "date-fns/locale";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	CheckCheck,
	Edit2,
	Eye,
	Minus,
	Pencil,
	Plus,
	Sparkles,
	Undo2,
	X,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { ThumbImg } from "../../../components/ui/ThumbImg";
import type {
	ProfileEditRecord,
	ReviewLogEntry,
} from "../../../context/AuthContext";
import {
	diffFamily,
	type FamilySnap,
	type FamilySnapField,
	parseFamilySummary,
} from "../../../utils/familyChangeSummary";
import { noAppReasonOf } from "../../constants/familyMemberReasons";
import { getRelationLabel } from "../../constants/relations";
import { MANDAL_LIST } from "../../types/mandal";

const FIELD_LABEL: Record<string, { hi: string; en: string }> = {
	realName: { hi: "नाम", en: "Name" },
	dikshaName: { hi: "दीक्षित नाम", en: "Diksha name" },
	guruName: { hi: "गुरु", en: "Guru" },
	dikshaDate: { hi: "दीक्षा की तारीख", en: "Diksha date" },
	mandalId: { hi: "मंडल", en: "Mandal" },
	customMandalName: {
		hi: "मंडल का नाम (सूची से बाहर)",
		en: "Mandal name (not in list)",
	},
	phoneNumber: { hi: "फ़ोन नंबर", en: "Phone number" },
	isAspiring: { hi: "दीक्षा के इच्छुक", en: "Aspiring for diksha" },
	personalExperience: { hi: "व्यक्तिगत अनुभव", en: "Personal experience" },
	photoURL: { hi: "प्रोफाइल फोटो", en: "Profile photo" },
	familyMembers: { hi: "परिवार के सदस्य", en: "Family members" },
	email: { hi: "ईमेल", en: "Email" },
};

const MEMBER_FIELD_LABEL: Record<FamilySnapField, { hi: string; en: string }> =
	{
		n: { hi: "नाम", en: "name" },
		r: { hi: "रिश्ता", en: "relation" },
		d: { hi: "दीक्षित नाम", en: "diksha name" },
		g: { hi: "गुरु", en: "guru" },
		dd: { hi: "दीक्षा तारीख", en: "diksha date" },
		a: { hi: "दीक्षा के इच्छुक", en: "aspiring" },
		p: { hi: "फोटो", en: "photo" },
		x: { hi: "कारण", en: "reason" },
	};

export type HistoryStatus = "pending" | "approved" | "rejected" | "deleted";

/** Facts about the account shown above the timeline (all optional). */
export interface HistoryFacts {
	status?: HistoryStatus;
	rejectionNote?: string;
	createdAt?: number;
	/** Last time the devotee sent the profile for review. */
	submissionDate?: number;
	approvalDate?: number;
	/** Last time the devotee opened the app. */
	lastSeen?: number;
}

type Filter = "all" | "pending" | "edits" | "admin";

type Item =
	| { kind: "edit"; t: number; record: ProfileEditRecord }
	| { kind: "admin"; t: number; entry: ReviewLogEntry }
	| { kind: "milestone"; t: number; what: "created" | "approved" };

/**
 * Everything that happened to a devotee's profile, full screen: what they
 * changed and when (each change as before → now), what the admins decided
 * (who, when, why), and a few account facts. Ends with the actions an admin
 * takes after reading it (approve, mark as seen, reject, edit).
 *
 * Family members have no history of their own — theirs is the devotee's,
 * where each change to the family list is broken down into who was added,
 * removed or changed.
 */
export const EditHistorySheet: React.FC<{
	name: string;
	photo?: string;
	history: ProfileEditRecord[];
	reviewLog?: ReviewLogEntry[];
	facts?: HistoryFacts;
	isHindi: boolean;
	/** Set for a hand-added family member (the history is this devotee's). */
	familyOf?: string;
	onClose: () => void;
	onZoomPhoto: (url: string) => void;
	onApprove?: () => void;
	onMarkReviewed?: () => void;
	onReject?: () => void;
	onEdit?: () => void;
}> = ({
	name,
	photo: avatar,
	history,
	reviewLog = [],
	facts = {},
	isHindi,
	familyOf,
	onClose,
	onZoomPhoto,
	onApprove,
	onMarkReviewed,
	onReject,
	onEdit,
}) => {
	const pending = history.filter((h) => h.status === "pending").length;
	const [filter, setFilter] = useState<Filter>(
		pending > 0 && pending < history.length ? "pending" : "all",
	);
	const [field, setField] = useState<string | null>(null);
	const locale = isHindi ? "hi-IN" : "en-IN";

	const label = (f: string) =>
		FIELD_LABEL[f] ? (isHindi ? FIELD_LABEL[f].hi : FIELD_LABEL[f].en) : f;

	const ago = (t: number) =>
		formatDistanceToNow(t, {
			addSuffix: true,
			locale: isHindi ? hiLocale : undefined,
		});
	const dateOf = (t: number) =>
		new Date(t).toLocaleDateString(locale, {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	const timeOf = (t: number) =>
		new Date(t).toLocaleTimeString(locale, {
			hour: "numeric",
			minute: "2-digit",
		});

	/** How often each field was changed, most changed first. */
	const fieldCounts = useMemo(() => {
		const c = new Map<string, { n: number; last: number }>();
		for (const r of history)
			for (const ch of r.changes) {
				const v = c.get(ch.field) || { n: 0, last: 0 };
				c.set(ch.field, { n: v.n + 1, last: Math.max(v.last, r.timestamp) });
			}
		return [...c.entries()].sort((a, b) => b[1].n - a[1].n);
	}, [history]);

	const firstEdit = history.length
		? Math.min(...history.map((h) => h.timestamp))
		: 0;
	const lastEdit = history.length
		? Math.max(...history.map((h) => h.timestamp))
		: 0;

	/** Edits, admin decisions and milestones, newest first. */
	const items = useMemo(() => {
		const out: Item[] = [];
		if (filter !== "admin")
			for (const record of history) {
				if (filter === "pending" && record.status !== "pending") continue;
				if (field && !record.changes.some((c) => c.field === field)) continue;
				out.push({ kind: "edit", t: record.timestamp, record });
			}
		if ((filter === "all" || filter === "admin") && !field) {
			for (const entry of reviewLog)
				out.push({ kind: "admin", t: entry.t, entry });
			// Approvals from before the log existed: the approval date is all
			// there is.
			if (
				facts.approvalDate &&
				!reviewLog.some(
					(e) =>
						e.a === "approved" &&
						!e.member &&
						Math.abs(e.t - (facts.approvalDate || 0)) < 60_000,
				)
			)
				out.push({
					kind: "milestone",
					t: facts.approvalDate,
					what: "approved",
				});
			if (facts.createdAt && filter === "all")
				out.push({ kind: "milestone", t: facts.createdAt, what: "created" });
		}
		return out.sort((a, b) => b.t - a.t);
	}, [history, reviewLog, facts.approvalDate, facts.createdAt, filter, field]);

	/** Items grouped by calendar day, for the day headers. */
	const days = useMemo(() => {
		const g: { key: string; label: string; items: Item[] }[] = [];
		const today = new Date().toDateString();
		const yesterday = new Date(Date.now() - 86_400_000).toDateString();
		for (const it of items) {
			const d = new Date(it.t).toDateString();
			let group = g[g.length - 1];
			if (!group || group.key !== d) {
				group = {
					key: d,
					label:
						d === today
							? isHindi
								? "आज"
								: "Today"
							: d === yesterday
								? isHindi
									? "कल"
									: "Yesterday"
								: new Date(it.t).toLocaleDateString(locale, {
										day: "numeric",
										month: "short",
										year: "numeric",
									}),
					items: [],
				};
				g.push(group);
			}
			group.items.push(it);
		}
		return g;
	}, [items, isHindi, locale]);

	const plain = (f: string, value: string) => {
		if (!value) return isHindi ? "(खाली)" : "(empty)";
		if (f === "isAspiring")
			return value === "Yes" || value === "true"
				? isHindi
					? "हाँ"
					: "Yes"
				: isHindi
					? "नहीं"
					: "No";
		if (f === "mandalId") {
			if (value === "custom")
				return isHindi ? "अन्य (नाम अलग लिखा)" : "Other (typed name)";
			const m = MANDAL_LIST.find((x) => x.id === value);
			return m ? (isHindi ? m.shortNameHi : m.shortNameEn) : value;
		}
		return value;
	};

	const photo = (url: string) =>
		url ? (
			<button
				type="button"
				onClick={() => onZoomPhoto(url)}
				aria-label={isHindi ? "फोटो बड़ी करें" : "Zoom photo"}
				className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 active:scale-95"
			>
				<ThumbImg src={url} className="w-full h-full object-cover" />
			</button>
		) : (
			<span className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-[11px] text-slate-400 shrink-0">
				{isHindi ? "कोई नहीं" : "None"}
			</span>
		);

	const memberValue = (m: FamilySnap, f: FamilySnapField) => {
		const v = m[f];
		if (f === "r") return v ? getRelationLabel(String(v), isHindi) : "—";
		if (f === "a") return v ? (isHindi ? "हाँ" : "yes") : isHindi ? "नहीं" : "no";
		if (f === "x") {
			const r = noAppReasonOf(v as string);
			return r ? (isHindi ? r.hi : r.en) : "—";
		}
		return v ? String(v) : "—";
	};

	const memberName = (m: FamilySnap) =>
		`${m.n || "—"}${m.r ? ` (${getRelationLabel(m.r, isHindi)})` : ""}`;

	const familyChange = (oldV: string, newV: string) => {
		const before = parseFamilySummary(oldV);
		const after = parseFamilySummary(newV);
		if (!before || !after)
			return (
				<p className="text-xs text-slate-500 dark:text-slate-400">
					{isHindi
						? "परिवार की सूची बदली (पुराने ऐप से भेजा गया — विस्तार दर्ज नहीं)"
						: "The family list changed (sent from an older app — no details)"}
				</p>
			);
		const d = diffFamily(before, after);
		if (!d.added.length && !d.removed.length && !d.changed.length)
			return (
				<p className="text-xs text-slate-500 dark:text-slate-400">
					{isHindi ? "कोई दिखने लायक बदलाव नहीं" : "No visible change"}
				</p>
			);
		return (
			<ul className="space-y-1.5">
				{d.added.map((m) => (
					<li
						key={`a-${m.i}`}
						className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400"
					>
						<Plus size={14} className="shrink-0 mt-px" />
						<span>
							<b>{isHindi ? "जोड़ा: " : "Added: "}</b>
							{memberName(m)}
						</span>
					</li>
				))}
				{d.removed.map((m) => (
					<li
						key={`r-${m.i}`}
						className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400"
					>
						<Minus size={14} className="shrink-0 mt-px" />
						<span>
							<b>{isHindi ? "हटाया: " : "Removed: "}</b>
							{memberName(m)}
						</span>
					</li>
				))}
				{d.changed.map((c) => (
					<li
						key={`c-${c.after.i}`}
						className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200"
					>
						<Pencil size={13} className="shrink-0 mt-0.5 text-blue-500" />
						<span className="min-w-0">
							<b>{c.after.n || c.before.n}: </b>
							{c.fields.map((f, i) => (
								<span key={f}>
									{i > 0 && "; "}
									{isHindi
										? MEMBER_FIELD_LABEL[f].hi
										: MEMBER_FIELD_LABEL[f].en}{" "}
									{f === "p" ? (
										<span className="inline-flex items-center gap-1 align-middle">
											{photo(c.before.p || "")}
											<ArrowRight size={12} />
											{photo(c.after.p || "")}
										</span>
									) : (
										<>
											<span className="line-through text-slate-400">
												{memberValue(c.before, f)}
											</span>
											{" → "}
											<span className="text-emerald-700 dark:text-emerald-400">
												{memberValue(c.after, f)}
											</span>
										</>
									)}
								</span>
							))}
						</span>
					</li>
				))}
			</ul>
		);
	};

	const editCard = (record: ProfileEditRecord) => {
		const isPending = record.status === "pending";
		return (
			<div
				className={`rounded-2xl border p-3 ${
					isPending
						? "border-amber-300 dark:border-amber-600/50 bg-amber-50/60 dark:bg-amber-900/10"
						: "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60"
				}`}
			>
				<div className="flex items-center gap-2 mb-2.5">
					<span className="text-xs font-bold text-slate-700 dark:text-slate-200">
						{isHindi ? "भक्त ने बदला" : "Devotee edited"}
					</span>
					<span
						className="text-[11px] text-slate-400"
						title={new Date(record.timestamp).toLocaleString(locale)}
					>
						{timeOf(record.timestamp)} · {ago(record.timestamp)}
					</span>
					<span
						className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
							isPending
								? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
								: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
						}`}
					>
						{isPending
							? isHindi
								? "जाँच बाकी"
								: "To review"
							: isHindi
								? "देख लिया"
								: "Reviewed"}
					</span>
				</div>
				<ul className="space-y-2.5">
					{record.changes
						.filter((c) => !field || c.field === field)
						.map((change) => (
							<li
								key={change.field}
								className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 p-2.5"
							>
								<p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
									{label(change.field)}
								</p>
								{change.field === "photoURL" ? (
									<div className="flex items-center gap-2">
										{photo(change.old)}
										<ArrowRight size={16} className="text-slate-400" />
										{photo(change.new)}
									</div>
								) : change.field === "familyMembers" ? (
									familyChange(change.old, change.new)
								) : (
									<>
										<dl className="text-sm space-y-1">
											<div className="flex gap-2">
												<dt className="shrink-0 w-10 text-[11px] font-bold text-slate-400 pt-0.5">
													{isHindi ? "पहले" : "Before"}
												</dt>
												<dd className="min-w-0 break-words whitespace-pre-wrap text-slate-500 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-slate-600">
													{plain(change.field, change.old)}
												</dd>
											</div>
											<div className="flex gap-2">
												<dt className="shrink-0 w-10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-0.5">
													{isHindi ? "अब" : "Now"}
												</dt>
												<dd className="min-w-0 break-words whitespace-pre-wrap font-medium text-slate-800 dark:text-slate-100">
													{plain(change.field, change.new)}
												</dd>
											</div>
										</dl>
										{typeof change.old === "string" &&
											typeof change.new === "string" &&
											change.old !== change.new &&
											change.old.trim() === change.new.trim() && (
												<p className="mt-1.5 text-[11px] text-slate-400">
													{isHindi
														? "सिर्फ़ आगे-पीछे की खाली जगह (स्पेस) का फ़र्क — असल में कुछ नहीं बदला"
														: "Only extra spaces differ — nothing really changed"}
												</p>
											)}
									</>
								)}
							</li>
						))}
				</ul>
			</div>
		);
	};

	const ADMIN_LOOK: Record<
		ReviewLogEntry["a"],
		{ icon: React.ReactNode; cls: string; hi: string; en: string }
	> = {
		approved: {
			icon: <Check size={14} />,
			cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
			hi: "मंज़ूर किया",
			en: "Approved",
		},
		rejected: {
			icon: <X size={14} />,
			cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
			hi: "अस्वीकार किया",
			en: "Rejected",
		},
		revoked: {
			icon: <Undo2 size={14} />,
			cls: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
			hi: "मंज़ूरी वापस ली",
			en: "Approval revoked",
		},
		reviewed: {
			icon: <Eye size={14} />,
			cls: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
			hi: "बदलाव देख लिए",
			en: "Marked edits as reviewed",
		},
	};

	const adminRow = (e: ReviewLogEntry) => {
		const look = ADMIN_LOOK[e.a] || ADMIN_LOOK.reviewed;
		return (
			<div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-3">
				<span
					className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${look.cls}`}
				>
					{look.icon}
				</span>
				<div className="min-w-0 flex-1 text-sm">
					<p className="text-slate-800 dark:text-slate-100">
						<b>{isHindi ? "एडमिन" : "Admin"}</b>
						{e.by ? ` (${e.by})` : ""}{" "}
						{isHindi ? look.hi : look.en.toLowerCase()}
						{e.member &&
							(isHindi
								? ` — परिवार सदस्य: ${e.member}`
								: ` — family member: ${e.member}`)}
					</p>
					{e.note && (
						<p className="mt-1 text-[13px] italic text-slate-600 dark:text-slate-300 break-words">
							“{e.note}”
						</p>
					)}
					<p className="text-[11px] text-slate-400 mt-0.5">
						{timeOf(e.t)} · {ago(e.t)}
					</p>
				</div>
			</div>
		);
	};

	const milestoneRow = (what: "created" | "approved", t: number) => (
		<div className="flex items-center gap-2.5 px-1 py-1 text-sm text-slate-500 dark:text-slate-400">
			<span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
				{what === "created" ? (
					<Sparkles size={14} />
				) : (
					<Check size={14} className="text-emerald-600" />
				)}
			</span>
			<span>
				{what === "created"
					? isHindi
						? "प्रोफ़ाइल बनी"
						: "Profile created"
					: isHindi
						? "प्रोफ़ाइल मंज़ूर हुई"
						: "Profile approved"}{" "}
				<span className="text-[11px] text-slate-400">· {timeOf(t)}</span>
			</span>
		</div>
	);

	const status = facts.status;
	const STATUS_LOOK: Record<HistoryStatus, [string, string, string]> = {
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

	const factRows: [string, number | undefined][] = [
		[isHindi ? "प्रोफ़ाइल बनी" : "Created", facts.createdAt],
		[isHindi ? "आख़िरी बार भेजी" : "Last sent", facts.submissionDate],
		[isHindi ? "मंज़ूर हुई" : "Approved", facts.approvalDate],
		[isHindi ? "ऐप आख़िरी बार खोला" : "Last opened app", facts.lastSeen],
	];

	const FILTERS: [Filter, string][] = [
		["all", isHindi ? "सब" : "All"],
		[
			"pending",
			isHindi
				? `जाँच बाकी${pending ? ` (${pending})` : ""}`
				: `To review${pending ? ` (${pending})` : ""}`,
		],
		["edits", isHindi ? "भक्त के बदलाव" : "Devotee edits"],
		["admin", isHindi ? "एडमिन के फ़ैसले" : "Admin decisions"],
	];

	return (
		<div
			role="dialog"
			aria-label={isHindi ? "प्रोफ़ाइल का इतिहास" : "Profile history"}
			className="fixed inset-0 z-[105] bg-slate-50 dark:bg-slate-900 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
		>
			{/* Top bar */}
			<div className="shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 pt-[env(safe-area-inset-top)]">
				<div className="max-w-2xl mx-auto flex items-center gap-3 px-2 py-2">
					<button
						type="button"
						onClick={onClose}
						aria-label={isHindi ? "वापस" : "Back"}
						className="min-w-touch min-h-touch flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
					>
						<ArrowLeft size={22} />
					</button>
					{avatar ? (
						<button
							type="button"
							onClick={() => onZoomPhoto(avatar)}
							aria-label={isHindi ? "फोटो बड़ी करें" : "Zoom photo"}
							className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-600"
						>
							<ThumbImg src={avatar} className="w-full h-full object-cover" />
						</button>
					) : (
						<span className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold flex items-center justify-center shrink-0">
							{(name || "?").charAt(0).toUpperCase()}
						</span>
					)}
					<div className="flex-1 min-w-0">
						<h2 className="font-bold text-slate-800 dark:text-white truncate">
							{name || "—"}
						</h2>
						<p className="text-xs text-slate-500 dark:text-slate-400 truncate">
							{isHindi ? "बदलाव और फ़ैसलों का इतिहास" : "Edits and decisions"}
						</p>
					</div>
					{status && (
						<span
							className={`text-[11px] font-bold px-2 py-1 rounded-full shrink-0 mr-2 ${STATUS_LOOK[status][0]}`}
						>
							{isHindi ? STATUS_LOOK[status][1] : STATUS_LOOK[status][2]}
						</span>
					)}
				</div>
			</div>

			{/* Body */}
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-2xl mx-auto p-4 space-y-4">
					{familyOf && (
						<p className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 leading-snug">
							{isHindi
								? `परिवार सदस्यों का अलग इतिहास नहीं रखा जाता — यह ${familyOf} के अकाउंट का इतिहास है। परिवार के बदलाव “परिवार के सदस्य” में दिखते हैं।`
								: `Family members have no history of their own — this is ${familyOf}'s account. Family changes are under “Family members”.`}
						</p>
					)}

					{status === "rejected" && facts.rejectionNote && (
						<div className="rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/15 p-3">
							<p className="text-[11px] font-bold uppercase tracking-wide text-red-500 mb-1">
								{isHindi ? "अभी अस्वीकृत — कारण" : "Rejected now — reason"}
							</p>
							<p className="text-sm text-red-800 dark:text-red-200 break-words">
								{facts.rejectionNote}
							</p>
						</div>
					)}

					{/* Summary */}
					<div className="grid grid-cols-3 gap-2">
						{[
							[String(history.length), isHindi ? "कुल बदलाव" : "Edits"],
							[String(pending), isHindi ? "जाँच बाकी" : "To review"],
							[
								lastEdit ? ago(lastEdit) : "—",
								isHindi ? "आख़िरी बदलाव" : "Last edit",
							],
						].map(([v, l]) => (
							<div
								key={l}
								className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-center"
							>
								<p className="font-bold text-slate-800 dark:text-white text-base leading-tight">
									{v}
								</p>
								<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
									{l}
								</p>
							</div>
						))}
					</div>

					{/* Account facts */}
					{factRows.some(([, t]) => t) && (
						<dl className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
							{factRows
								.filter(([, t]) => t)
								.map(([l, t]) => (
									<div
										key={l}
										className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
									>
										<dt className="text-slate-500 dark:text-slate-400">{l}</dt>
										<dd
											className="text-slate-800 dark:text-slate-100 font-medium text-right"
											title={new Date(t as number).toLocaleString(locale)}
										>
											{dateOf(t as number)}{" "}
											<span className="text-[11px] text-slate-400 font-normal">
												({ago(t as number)})
											</span>
										</dd>
									</div>
								))}
							{firstEdit > 0 && (
								<div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
									<dt className="text-slate-500 dark:text-slate-400">
										{isHindi ? "पहला बदलाव" : "First edit"}
									</dt>
									<dd className="text-slate-800 dark:text-slate-100 font-medium">
										{dateOf(firstEdit)}
									</dd>
								</div>
							)}
						</dl>
					)}

					{/* What changed, how often — tap to show only that */}
					{fieldCounts.length > 0 && (
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
								{isHindi
									? "क्या-क्या बदला (छूकर सिर्फ़ वही देखें)"
									: "What changed (tap to show only that)"}
							</p>
							<div className="flex flex-wrap gap-1.5">
								{fieldCounts.map(([f, { n, last }]) => (
									<button
										key={f}
										type="button"
										aria-pressed={field === f}
										onClick={() => {
											setField(field === f ? null : f);
											if (filter === "admin") setFilter("all");
										}}
										title={`${isHindi ? "आख़िरी बार" : "Last"}: ${dateOf(last)}`}
										className={`min-h-[34px] px-3 rounded-full text-xs font-bold border transition ${
											field === f
												? "bg-blue-600 border-blue-600 text-white"
												: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
										}`}
									>
										{label(f)} <span className="opacity-70">×{n}</span>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Filter */}
					<div className="flex gap-1 p-1 bg-slate-200/60 dark:bg-slate-800 rounded-xl overflow-x-auto">
						{FILTERS.map(([f, l]) => (
							<button
								key={f}
								type="button"
								aria-pressed={filter === f}
								onClick={() => setFilter(f)}
								className={`flex-1 whitespace-nowrap min-h-[36px] px-2 rounded-lg text-xs font-bold transition ${
									filter === f
										? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm"
										: "text-slate-500"
								}`}
							>
								{l}
							</button>
						))}
					</div>

					{/* Timeline */}
					{days.length === 0 ? (
						<p className="text-center text-sm text-slate-500 dark:text-slate-400 py-10">
							{filter === "pending"
								? isHindi
									? "जाँचने को कुछ बाकी नहीं 🎉"
									: "Nothing left to review 🎉"
								: filter === "admin"
									? isHindi
										? "अभी तक कोई एडमिन फ़ैसला दर्ज नहीं (यह रिकॉर्ड अब से बनता है)"
										: "No admin decisions recorded yet (recorded from now on)"
									: isHindi
										? "भक्त ने प्रोफाइल भेजने के बाद अभी तक कुछ नहीं बदला।"
										: "The devotee hasn't changed anything since sending the profile."}
						</p>
					) : (
						days.map((day) => (
							<section key={day.key}>
								<h3 className="sticky top-0 z-10 -mx-4 px-4 py-1.5 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur text-xs font-bold text-slate-500 dark:text-slate-400">
									{day.label}
								</h3>
								<ol className="mt-1 space-y-2 border-l-2 border-slate-200 dark:border-slate-700 ml-2 pl-4">
									{day.items.map((it) => (
										<li
											key={`${it.kind}-${it.t}-${it.kind === "admin" ? it.entry.a : ""}`}
											className="relative"
										>
											<span
												aria-hidden="true"
												className={`absolute -left-[23px] top-4 w-3 h-3 rounded-full border-2 border-slate-50 dark:border-slate-900 ${
													it.kind === "edit"
														? it.record.status === "pending"
															? "bg-amber-400"
															: "bg-slate-300 dark:bg-slate-600"
														: it.kind === "admin"
															? "bg-blue-500"
															: "bg-emerald-400"
												}`}
											/>
											{it.kind === "edit"
												? editCard(it.record)
												: it.kind === "admin"
													? adminRow(it.entry)
													: milestoneRow(it.what, it.t)}
										</li>
									))}
								</ol>
							</section>
						))
					)}
				</div>
			</div>

			{/* Actions */}
			{(onApprove || onMarkReviewed || onReject || onEdit) && (
				<div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pb-[env(safe-area-inset-bottom)]">
					<div className="max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
						{onApprove && (
							<button
								type="button"
								onClick={onApprove}
								className="min-h-touch rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95"
							>
								<Check size={16} />
								{isHindi ? "मंज़ूर करें" : "Approve"}
							</button>
						)}
						{onMarkReviewed && (
							<button
								type="button"
								onClick={onMarkReviewed}
								className="min-h-touch rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95"
							>
								<CheckCheck size={16} />
								{isHindi ? "बदलाव देख लिए" : "Mark reviewed"}
							</button>
						)}
						{onReject && (
							<button
								type="button"
								onClick={onReject}
								className="min-h-touch rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95"
							>
								<X size={16} />
								{isHindi ? "अस्वीकार" : "Reject"}
							</button>
						)}
						{onEdit && (
							<button
								type="button"
								onClick={onEdit}
								className="min-h-touch rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95"
							>
								<Edit2 size={16} />
								{isHindi ? "एडिट करें" : "Edit"}
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

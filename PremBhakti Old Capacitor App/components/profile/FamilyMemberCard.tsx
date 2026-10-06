import {
	Calendar,
	Edit2,
	MoveDown,
	MoveUp,
	Search,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import type { FamilyMember } from "../../context/AuthContext";
import { noAppReasonOf } from "../../src/constants/familyMemberReasons";
import { getRelationLabel } from "../../src/constants/relations";
import type { MemberStatus } from "../../utils/familyApproval";
import { ThumbImg } from "../ui/ThumbImg";

interface FamilyMemberCardProps {
	member: FamilyMember;
	index: number;
	total: number;
	isHindi: boolean;
	onEdit: (idx: number) => void;
	onDelete: (idx: number) => void;
	onMoveUp: (idx: number) => void;
	onMoveDown: (idx: number) => void;
	isLinkedAccount?: boolean;
	onUnlink?: (idx: number) => void;
	/** Admin review status of this member; omit to hide the badge. */
	status?: MemberStatus;
	/** Look this member up among app accounts to link them; omit to hide. */
	onFindOnApp?: (idx: number) => void;
	/** Name of a linked account that looks like this same person. */
	linkedTwinName?: string;
	/** The same person is already higher up in this list. */
	repeated?: boolean;
}

const STATUS_BADGE: Record<
	MemberStatus,
	{ en: string; hi: string; className: string }
> = {
	approved: {
		en: "✓ Approved",
		hi: "✓ स्वीकृत",
		className:
			"bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
	},
	pending: {
		en: "Awaiting review",
		hi: "समीक्षा बाकी",
		className:
			"bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
	},
	rejected: {
		en: "Needs changes",
		hi: "बदलाव ज़रूरी",
		className: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
	},
};

/* Generate a stable color from a name string */
const nameToColor = (name: string): string => {
	const colors = [
		"bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400",
		"bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
		"bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
		"bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
		"bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
		"bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
		"bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
		"bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
	];
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string => {
	const words = name.trim().split(/\s+/);
	if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
	return name.charAt(0).toUpperCase();
};

export const FamilyMemberCard: React.FC<FamilyMemberCardProps> = ({
	member,
	index,
	total,
	isHindi,
	onEdit,
	onDelete,
	onMoveUp,
	onMoveDown,
	isLinkedAccount,
	onUnlink,
	status,
	onFindOnApp,
	linkedTwinName,
	repeated,
}) => {
	const reason = noAppReasonOf(member.noAppReason);
	const colorClasses = useMemo(
		() => nameToColor(member.realName),
		[member.realName],
	);
	const initials = useMemo(
		() => getInitials(member.realName),
		[member.realName],
	);

	return (
		<div
			className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 group hover:border-pink-200 dark:hover:border-pink-800/40 transition-all"
			data-tour="profile-family-member"
		>
			{/* Avatar: photo if available, else colored initials */}
			{member.photoURL ? (
				<div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-white dark:border-slate-700 shadow-sm">
					<ThumbImg
						src={member.photoURL}
						alt={member.realName}
						className="w-full h-full object-cover"
					/>
				</div>
			) : (
				<div
					className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${colorClasses}`}
				>
					{initials}
				</div>
			)}

			{/* Info */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
						{member.realName}
					</p>
					{member.relation && (
						<span className="shrink-0 max-w-[45%] truncate px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
							{getRelationLabel(member.relation, isHindi)}
						</span>
					)}
					{isLinkedAccount && (
						<span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400">
							{isHindi ? "लिंक्ड अकाउंट" : "Linked Account"}
						</span>
					)}
				</div>
				{member.dikshaName && (
					<p className="text-xs text-slate-500 dark:text-ink-300 truncate">
						{member.dikshaName}
					</p>
				)}
				<div className="flex items-center gap-2 mt-0.5 flex-wrap">
					<span className="text-[10px] text-pink-500 dark:text-pink-400 font-medium truncate">
						{member.isAspiring
							? isHindi
								? "आकांक्षी 🌱"
								: "Aspiring 🌱"
							: member.guruName || "—"}
					</span>
					{!member.isAspiring && member.dikshaDate && (
						<span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full">
							<Calendar size={8} />
							{member.dikshaDate}
						</span>
					)}
					{reason?.badgeEn && (
						<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
							{reason.emoji} {isHindi ? reason.badgeHi : reason.badgeEn}
						</span>
					)}
					{status && (
						<span
							className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[status].className}`}
						>
							{isHindi ? STATUS_BADGE[status].hi : STATUS_BADGE[status].en}
						</span>
					)}
				</div>
				{status === "rejected" && member.rejectionNote && (
					<p className="text-[10px] text-red-500 mt-1 leading-snug">
						{member.rejectionNote}
					</p>
				)}
				{repeated && !linkedTwinName && (
					<div className="mt-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-2 py-1.5">
						<p className="text-[10px] text-amber-700 dark:text-amber-400 leading-snug">
							{isHindi
								? "ये इस सूची में ऊपर पहले से जुड़े हैं — दोहराया हुआ हटा दें।"
								: "Already higher up in this list — remove the repeat."}
						</p>
						<button
							type="button"
							onClick={() => onDelete(index)}
							className="mt-1 text-[10px] font-bold text-red-600 dark:text-red-400 underline underline-offset-2"
						>
							{isHindi ? "यह वाला हटाएँ" : "Remove this one"}
						</button>
					</div>
				)}
				{linkedTwinName && (
					<div className="mt-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-2 py-1.5">
						<p className="text-[10px] text-amber-700 dark:text-amber-400 leading-snug">
							{isHindi
								? `ये "${linkedTwinName}" के रूप में ऐप पर लिंक्ड लगते हैं — तब इन्हें यहाँ से हटा दें।`
								: `This looks like "${linkedTwinName}", already linked on the app — if so, remove them here.`}
						</p>
						<button
							type="button"
							onClick={() => onDelete(index)}
							className="mt-1 text-[10px] font-bold text-red-600 dark:text-red-400 underline underline-offset-2"
						>
							{isHindi ? "यहाँ से हटाएँ" : "Remove from here"}
						</button>
					</div>
				)}
				{onFindOnApp && (
					<button
						type="button"
						onClick={() => onFindOnApp(index)}
						className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-500/30 px-2.5 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 active:scale-95 transition"
					>
						<Search size={10} />
						{isHindi ? "ऐप पर खोजें और लिंक करें" : "Find on the app & link"}
					</button>
				)}
			</div>

			{/* Actions */}
			{isLinkedAccount ? (
				<div className="flex shrink-0">
					<button
						type="button"
						onClick={() => onUnlink?.(index)}
						title={isHindi ? "लिंक हटाएं" : "Unlink"}
						className="p-2 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-center justify-center"
					>
						<Trash2 size={16} />
					</button>
				</div>
			) : (
				<div className="flex flex-col gap-0.5 shrink-0">
					<div className="flex gap-0.5">
						<button
							type="button"
							onClick={() => onMoveUp(index)}
							disabled={index === 0}
							aria-label={isHindi ? "ऊपर ले जाएं" : "Move up"}
							className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-30 disabled:pointer-events-none"
						>
							<MoveUp size={13} />
						</button>
						<button
							type="button"
							onClick={() => onMoveDown(index)}
							disabled={index === total - 1}
							aria-label={isHindi ? "नीचे ले जाएं" : "Move down"}
							className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-30 disabled:pointer-events-none"
						>
							<MoveDown size={13} />
						</button>
					</div>
					<div className="flex gap-0.5">
						<button
							type="button"
							onClick={() => onEdit(index)}
							aria-label={isHindi ? "संपादित करें" : "Edit"}
							className="p-1.5 rounded-lg text-slate-400 dark:text-ink-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
						>
							<Edit2 size={13} />
						</button>
						<button
							type="button"
							onClick={() => onDelete(index)}
							aria-label={isHindi ? "हटाएं" : "Delete"}
							className="p-1.5 rounded-lg text-slate-400 dark:text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
						>
							<Trash2 size={13} />
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

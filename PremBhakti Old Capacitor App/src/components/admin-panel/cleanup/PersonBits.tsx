import { User } from "lucide-react";
import type React from "react";
import { ThumbImg } from "../../../../components/ui/ThumbImg";
import { MANDAL_LIST } from "../../../types/mandal";
import { EditProfileButton } from "../devoteeEditLink";

/** The profile fields the cleanup screens show. */
export interface PersonLike {
	uid?: string;
	realName?: string;
	dikshaName?: string;
	photoURL?: string;
	mandalId?: string;
	customMandalName?: string;
}

export const personName = (p?: PersonLike | null) =>
	p?.realName || p?.dikshaName || "—";

export const mandalLabel = (p: PersonLike | undefined, isHindi: boolean) => {
	if (!p?.mandalId) return "";
	if (p.mandalId === "custom") return p.customMandalName || "";
	const m = MANDAL_LIST.find((x) => x.id === p.mandalId);
	return m ? (isHindi ? m.shortNameHi : m.shortNameEn) : "";
};

export const Avatar: React.FC<{
	photoURL?: string;
	name?: string;
	size?: string;
}> = ({ photoURL, name, size = "w-10 h-10" }) =>
	photoURL ? (
		<ThumbImg
			src={photoURL}
			alt=""
			className={`${size} rounded-full object-cover shrink-0`}
		/>
	) : (
		<span
			className={`${size} rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm font-bold flex items-center justify-center shrink-0`}
		>
			{name?.trim() ? name.trim().charAt(0).toUpperCase() : <User size={16} />}
		</span>
	);

/** One person in a list row: photo, name, a line under it, and Edit. */
export const PersonRow: React.FC<{
	person?: PersonLike;
	uid?: string;
	isHindi: boolean;
	sub?: React.ReactNode;
	/** Hand-added member: its photo/name, edit opens the owner's member. */
	memberId?: string;
	onClosed?: (changed: boolean) => void;
}> = ({ person, uid, isHindi, sub, memberId, onClosed }) => (
	<div className="flex items-center gap-2.5 min-w-0">
		<Avatar photoURL={person?.photoURL} name={personName(person)} />
		<div className="flex-1 min-w-0">
			<p className="text-sm font-bold text-slate-800 dark:text-white truncate">
				{personName(person)}
			</p>
			{sub && (
				<div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
					{sub}
				</div>
			)}
		</div>
		{uid && (
			<EditProfileButton
				target={{ uid, memberId }}
				isHindi={isHindi}
				name={personName(person)}
				iconOnly
				onClosed={onClosed}
			/>
		)}
	</div>
);

/** Small coloured tag. */
export const Tag: React.FC<{
	tone?: "slate" | "amber" | "red" | "emerald" | "blue" | "violet";
	children: React.ReactNode;
}> = ({ tone = "slate", children }) => {
	const cls = {
		slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
		amber:
			"bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
		red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
		emerald:
			"bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
		blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
		violet:
			"bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
	}[tone];
	return (
		<span
			className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cls}`}
		>
			{children}
		</span>
	);
};

/** Card around one problem. */
export const IssueCard: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => (
	<li className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 space-y-2.5">
		{children}
	</li>
);

const BTN = {
	primary: "bg-emerald-500 hover:bg-emerald-600 text-white",
	blue: "bg-blue-500 hover:bg-blue-600 text-white",
	soft: "bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200",
	danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
} as const;

export const ActionBtn: React.FC<{
	tone?: keyof typeof BTN;
	onClick: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}> = ({ tone = "soft", onClick, disabled, children }) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		className={`flex-1 min-w-[8rem] min-h-touch px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition ${BTN[tone]}`}
	>
		{children}
	</button>
);

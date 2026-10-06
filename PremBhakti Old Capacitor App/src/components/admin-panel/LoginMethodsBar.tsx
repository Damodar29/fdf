import { formatDistanceToNow } from "date-fns";
import { hi as hiLocale } from "date-fns/locale";
import { KeyRound, Loader2, RefreshCw, UserX } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { type LoginInfo, type LoginKind, loginKind } from "./loginMethods";

export type LoginFilter = "all" | LoginKind | "none";

const KIND_LOOK: Record<LoginKind, [string, string, string]> = {
	google: [
		"bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
		"Google",
		"Google",
	],
	phone: [
		"bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
		"📱 फ़ोन",
		"📱 Phone",
	],
	both: [
		"bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
		"Google + 📱",
		"Google + 📱",
	],
	other: [
		"bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
		"ईमेल",
		"Email",
	],
};

/** Small tag on a devotee's card: how this account logs in. */
export const LoginChip: React.FC<{
	info: LoginInfo | undefined;
	/** The list of logins has loaded (so "missing" really means no account). */
	loaded: boolean;
	isHindi: boolean;
}> = ({ info, loaded, isHindi }) => {
	if (!info) {
		if (!loaded) return null;
		return (
			<span
				className="text-[10px] font-bold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-1.5 py-0.5 rounded-md"
				title={
					isHindi
						? "इस प्रोफाइल का लॉगिन खाता नहीं है (हटाया गया)"
						: "This profile has no login account (removed)"
				}
			>
				{isHindi ? "लॉगिन नहीं" : "No login"}
			</span>
		);
	}
	const [cls, hi, en] = KIND_LOOK[loginKind(info)];
	return (
		<span
			className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cls}`}
			title={isHindi ? "लॉगिन का तरीका" : "Logs in with"}
		>
			{isHindi ? hi : en}
		</span>
	);
};

/** "Google (a@gmail.com) + phone (+91…)" for an opened card. */
export const loginSummary = (info: LoginInfo, isHindi: boolean) => {
	const parts: string[] = [];
	if (info.google)
		parts.push(`Google${info.loginEmail ? ` (${info.loginEmail})` : ""}`);
	if (info.phone)
		parts.push(
			`${isHindi ? "फ़ोन" : "Phone"}${info.loginPhone ? ` (${info.loginPhone})` : ""}`,
		);
	if (info.password && !info.google)
		parts.push(`${isHindi ? "ईमेल" : "Email"} (${info.loginEmail || "—"})`);
	return parts.join(" + ") || (isHindi ? "पता नहीं" : "Unknown");
};

/** Same 10 digits, whatever the spelling ("+91 98…", "098…"). */
export const samePhone = (a?: string, b?: string) => {
	const x = (a || "").replace(/\D/g, "").slice(-10);
	const y = (b || "").replace(/\D/g, "").slice(-10);
	return x.length === 10 && x === y;
};

export interface OrphanLogin {
	uid: string;
	info: LoginInfo;
}

/**
 * Super admin bar in Devotee Management: how many devotees log in with
 * Google, phone, or both (tap one to show only them), and logins that never
 * made a profile.
 */
export const LoginOverview: React.FC<{
	isHindi: boolean;
	counts: Record<LoginFilter, number>;
	filter: LoginFilter;
	onFilter: (f: LoginFilter) => void;
	orphans: OrphanLogin[];
	loading: boolean;
	error: "" | "denied" | "failed";
	at: number;
	loaded: boolean;
	onRefresh: () => void;
}> = ({
	isHindi,
	counts,
	filter,
	onFilter,
	orphans,
	loading,
	error,
	at,
	loaded,
	onRefresh,
}) => {
	const [showOrphans, setShowOrphans] = useState(false);
	const [orphanCount, setOrphanCount] = useState(20);
	if (error === "denied") return null;

	const options: [LoginFilter, string][] = [
		["all", isHindi ? "सभी" : "All"],
		["google", "Google"],
		["phone", isHindi ? "📱 फ़ोन" : "📱 Phone"],
		["both", isHindi ? "दोनों" : "Both"],
		["none", isHindi ? "लॉगिन नहीं" : "No login"],
	];
	const when = (ms?: number) =>
		ms
			? formatDistanceToNow(ms, {
					addSuffix: true,
					locale: isHindi ? hiLocale : undefined,
				})
			: "—";

	return (
		<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 space-y-2">
			<div className="flex items-center gap-2">
				<KeyRound size={15} className="shrink-0 text-violet-500" />
				<p className="flex-1 min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 leading-snug">
					{isHindi ? "लॉगिन का तरीका" : "How devotees log in"}
					{at > 0 && (
						<span className="font-normal text-slate-400">
							{" · "}
							{when(at)}
						</span>
					)}
				</p>
				<button
					type="button"
					onClick={onRefresh}
					disabled={loading}
					aria-label={isHindi ? "लॉगिन जानकारी ताज़ा करें" : "Refresh logins"}
					className="shrink-0 min-w-touch min-h-touch -my-2 -mr-2 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 disabled:opacity-50"
				>
					{loading ? (
						<Loader2 size={16} className="animate-spin" />
					) : (
						<RefreshCw size={16} />
					)}
				</button>
			</div>

			{error === "failed" && (
				<p className="text-[11px] text-red-600 dark:text-red-400">
					{isHindi
						? "लॉगिन जानकारी नहीं आ सकी — इंटरनेट जाँचकर ताज़ा करें।"
						: "Could not load logins — check the internet and refresh."}
				</p>
			)}

			{loaded && (
				<div className="flex flex-wrap gap-1">
					{options.map(([f, label]) => (
						<button
							key={f}
							type="button"
							aria-pressed={filter === f}
							onClick={() => onFilter(filter === f && f !== "all" ? "all" : f)}
							className={`flex-none min-h-[36px] px-2.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-colors ${
								filter === f
									? "bg-violet-500 text-white"
									: "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
							}`}
						>
							{label}
							<span className="tabular-nums opacity-75">{counts[f]}</span>
						</button>
					))}
				</div>
			)}

			{loaded && orphans.length > 0 && (
				<div>
					<button
						type="button"
						onClick={() => setShowOrphans((v) => !v)}
						aria-expanded={showOrphans}
						className="w-full min-h-touch flex items-center gap-2 text-left text-xs font-bold text-amber-700 dark:text-amber-400"
					>
						<UserX size={14} className="shrink-0" />
						<span className="flex-1">
							{isHindi
								? `${orphans.length} लोगों ने लॉगिन किया पर प्रोफाइल नहीं बनाई`
								: `${orphans.length} logged in but never made a profile`}
						</span>
						<span className="text-slate-400">{showOrphans ? "▲" : "▼"}</span>
					</button>
					{showOrphans && (
						<ul className="mt-1 rounded-lg bg-slate-50 dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-700/60 text-[12px]">
							{orphans.slice(0, orphanCount).map(({ uid, info }) => (
								<li key={uid} className="px-2.5 py-2 space-y-0.5">
									<p className="font-medium text-slate-700 dark:text-slate-200 break-all">
										{loginSummary(info, isHindi)}
									</p>
									<p className="text-[11px] text-slate-400">
										{isHindi ? "खाता बना" : "Joined"} {when(info.created)}
										{" · "}
										{isHindi ? "आख़िरी लॉगिन" : "last login"}{" "}
										{when(info.lastSignIn)}
									</p>
								</li>
							))}
							{orphans.length > orphanCount && (
								<li>
									<button
										type="button"
										onClick={() => setOrphanCount((n) => n + 50)}
										className="w-full min-h-touch text-xs font-bold text-slate-600 dark:text-slate-300"
									>
										{isHindi
											? `और दिखाएँ (${orphans.length - orphanCount})`
											: `Show more (${orphans.length - orphanCount})`}
									</button>
								</li>
							)}
						</ul>
					)}
				</div>
			)}
		</div>
	);
};

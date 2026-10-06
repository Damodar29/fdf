import {
	collection,
	getDocs,
	query,
	Timestamp,
	where,
} from "firebase/firestore";
import {
	ArrowLeft,
	BarChart3,
	Clock,
	Loader2,
	RefreshCw,
	Search,
	Users,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ThumbImg } from "../../../components/ui/ThumbImg";
import { db } from "../../../services/firebase";
import { safeLocalGet, safeLocalSet } from "../../../utils/safeLocalSet";
import {
	dailyTotals,
	formatDuration,
	hourTotals,
	keyToDate,
	lastDays,
	type UsageDoc,
	type UserUsage,
	userUsage,
} from "../../../utils/usageStats";
import { useAdminBack } from "../../hooks/useAdminBack";
import { MANDAL_LIST } from "../../types/mandal";
import { EditProfileButton } from "./devoteeEditLink";

type Period = "today" | "week" | "month" | "all";

const CACHE_KEY = "cpbs_admin_usage_cache_v1";

interface Cache {
	/** Newest updatedAt seen (ms) — next load asks only for newer documents. */
	at: number;
	docs: Record<string, UsageDoc>;
}

const readCache = (): Cache => {
	try {
		const c = JSON.parse(safeLocalGet(CACHE_KEY) || "");
		if (typeof c?.at === "number" && c.docs && typeof c.docs === "object")
			return c;
	} catch {}
	return { at: 0, docs: {} };
};

const PAGE = 50;

/**
 * Admin → Usage: how long and when devotees use the app — today, this week,
 * this month — with a per-day chart, the busiest hours and a list of devotees
 * by time spent (tap one for their own days).
 *
 * Reads: the first visit reads every user_usage document once; after that
 * only the documents changed since the last visit (kept on this device).
 */
export const UsageManager: React.FC<{ isHindi: boolean }> = ({ isHindi }) => {
	const [cache, setCache] = useState<Cache>(readCache);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [lastFetched, setLastFetched] = useState(0);
	const [fetchedCount, setFetchedCount] = useState<number | null>(null);
	const [period, setPeriod] = useState<Period>("week");
	const [search, setSearch] = useState("");
	const [shown, setShown] = useState(PAGE);
	const [selected, setSelected] = useState<string | null>(null);

	useAdminBack(!!selected, () => setSelected(null));

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const base = readCache();
			const col = collection(db, "user_usage");
			const snap = await getDocs(
				base.at
					? query(col, where("updatedAt", ">", Timestamp.fromMillis(base.at)))
					: col,
			);
			const docs = { ...base.docs };
			let at = base.at;
			snap.forEach((d) => {
				const data = d.data();
				const t = data.updatedAt?.toMillis?.() || 0;
				docs[d.id] = { ...(data as UsageDoc), updatedAt: t };
				if (t > at) at = t;
			});
			const next = { at, docs };
			safeLocalSet(CACHE_KEY, JSON.stringify(next));
			setCache(next);
			setFetchedCount(snap.size);
			setLastFetched(Date.now());
		} catch (e) {
			console.error("[Usage] load failed", e);
			setError(
				isHindi
					? "डेटा नहीं आ सका — इंटरनेट या लॉगिन जाँचें"
					: "Could not load — check internet or login",
			);
		} finally {
			setLoading(false);
		}
	}, [isHindi]);

	useEffect(() => {
		load();
	}, [load]);

	const docs = useMemo(() => Object.values(cache.docs), [cache]);
	const entries = useMemo(() => Object.entries(cache.docs), [cache]);

	const periodDays = useMemo(() => {
		if (period === "all") return null;
		return new Set(
			lastDays(period === "today" ? 1 : period === "week" ? 7 : 30),
		);
	}, [period]);

	const rows = useMemo(() => {
		const q = search.trim().toLowerCase();
		return entries
			.map(([uid, d]) => userUsage(uid, d, periodDays))
			.filter((u) => u.seconds > 0 || (q && u.totalSeconds > 0))
			.filter((u) => !q || u.name.toLowerCase().includes(q))
			.sort((a, b) => b.seconds - a.seconds || b.totalSeconds - a.totalSeconds);
	}, [entries, periodDays, search]);

	const totals = useMemo(() => {
		const active = rows.filter((r) => r.seconds > 0);
		const seconds = active.reduce((a, r) => a + r.seconds, 0);
		const sessions = active.reduce((a, r) => a + r.sessions, 0);
		return {
			users: active.length,
			seconds,
			sessions,
			avg: active.length ? seconds / active.length : 0,
		};
	}, [rows]);

	const month = useMemo(
		() => dailyTotals(docs, lastDays(30).reverse()),
		[docs],
	);
	const hours = useMemo(() => hourTotals(docs), [docs]);
	const tracked = entries.length;

	const mandalName = (id: string) => {
		const m = MANDAL_LIST.find((x) => x.id === id);
		return m ? (isHindi ? m.shortNameHi : m.shortNameEn) : id;
	};
	const dayLabel = (k: string, long = false) =>
		keyToDate(k).toLocaleDateString(isHindi ? "hi-IN" : "en-IN", {
			day: "numeric",
			month: "short",
			...(long ? { weekday: "short" as const } : {}),
		});
	const hourLabel = (h: number) =>
		`${h % 12 === 0 ? 12 : h % 12}${h < 12 ? (isHindi ? " सुबह" : "am") : isHindi ? " शाम" : "pm"}`;
	const topHours = (h: number[]) =>
		h
			.map((s, i) => [i, s] as const)
			.filter(([, s]) => s > 0)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([i]) => hourLabel(i));

	const PERIODS: [Period, string][] = [
		["today", isHindi ? "आज" : "Today"],
		["week", isHindi ? "7 दिन" : "7 days"],
		["month", isHindi ? "30 दिन" : "30 days"],
		["all", isHindi ? "सब" : "All time"],
	];

	const bars = (
		data: { key: string; value: number; hint: string }[],
		color: string,
	) => {
		const max = Math.max(1, ...data.map((d) => d.value));
		return (
			<div className="flex items-end gap-[3px] h-28">
				{data.map((d) => (
					<div
						key={d.key}
						title={d.hint}
						className="flex-1 h-full flex flex-col justify-end"
					>
						<div
							className={`${color} rounded-t-sm min-h-[2px]`}
							style={{ height: `${(d.value / max) * 100}%` }}
						/>
					</div>
				))}
			</div>
		);
	};

	const avatar = (u: { name: string; photo: string }, size = "w-10 h-10") =>
		u.photo ? (
			<ThumbImg
				src={u.photo}
				alt=""
				className={`${size} rounded-full object-cover shrink-0`}
			/>
		) : (
			<span
				className={`${size} rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold flex items-center justify-center shrink-0`}
			>
				{(u.name || "?").charAt(0).toUpperCase()}
			</span>
		);

	if (!tracked && loading)
		return (
			<div className="flex-1 flex items-center justify-center p-10">
				<Loader2 className="animate-spin text-indigo-500" size={32} />
			</div>
		);

	const sel = selected ? cache.docs[selected] : null;

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-3xl mx-auto p-4 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
				{/* Period + refresh */}
				<div className="flex items-center gap-2">
					<div className="flex-1 flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
						{PERIODS.map(([p, l]) => (
							<button
								key={p}
								type="button"
								aria-pressed={period === p}
								onClick={() => {
									setPeriod(p);
									setShown(PAGE);
								}}
								className={`flex-1 min-h-[36px] rounded-lg text-xs font-bold transition ${
									period === p
										? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
										: "text-slate-500"
								}`}
							>
								{l}
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={load}
						disabled={loading}
						aria-label={isHindi ? "ताज़ा करें" : "Refresh"}
						className="min-w-touch min-h-touch flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50"
					>
						<RefreshCw size={18} className={loading ? "animate-spin" : ""} />
					</button>
				</div>

				{error && (
					<p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
						{error}
					</p>
				)}

				{tracked === 0 && error ? null : tracked === 0 && !loading ? (
					<div className="text-center py-12 px-4">
						<BarChart3 className="mx-auto text-slate-300 mb-3" size={40} />
						<p className="font-bold text-slate-700 dark:text-slate-200">
							{isHindi ? "अभी कोई डेटा नहीं" : "No data yet"}
						</p>
						<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
							{isHindi
								? "नया ऐप अपडेट पहुँचने के बाद, लॉगिन किए भक्तों का समय यहाँ दिखने लगेगा।"
								: "Once the app update reaches devotees, logged-in devotees' time shows here."}
						</p>
					</div>
				) : (
					<>
						{/* Totals for the period */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
							{[
								[
									<Users key="i" size={16} />,
									String(totals.users),
									isHindi ? "भक्तों ने चलाया" : "Devotees used",
								],
								[
									<Clock key="i" size={16} />,
									formatDuration(totals.seconds, isHindi),
									isHindi ? "कुल समय" : "Total time",
								],
								[
									<Clock key="i" size={16} />,
									formatDuration(totals.avg, isHindi),
									isHindi ? "औसत प्रति भक्त" : "Avg per devotee",
								],
								[
									<BarChart3 key="i" size={16} />,
									String(totals.sessions),
									isHindi ? "बार खोला" : "Times opened",
								],
							].map(([icon, v, l]) => (
								<div
									key={String(l)}
									className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3"
								>
									<span className="text-indigo-500">{icon}</span>
									<p className="font-bold text-lg text-slate-800 dark:text-white leading-tight mt-1">
										{v}
									</p>
									<p className="text-[11px] text-slate-500 dark:text-slate-400">
										{l}
									</p>
								</div>
							))}
						</div>

						{/* Last 30 days */}
						<section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
							<div className="flex items-baseline justify-between mb-2">
								<h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
									{isHindi
										? "पिछले 30 दिन — रोज़ कितने भक्त"
										: "Last 30 days — devotees per day"}
								</h3>
								<span className="text-[11px] text-slate-400">
									{isHindi ? "आज" : "Today"}:{" "}
									{month[month.length - 1]?.users || 0}
								</span>
							</div>
							{bars(
								month.map((d) => ({
									key: d.key,
									value: d.users,
									hint: `${dayLabel(d.key, true)}: ${d.users} ${isHindi ? "भक्त" : "devotees"}, ${formatDuration(d.seconds, isHindi)}`,
								})),
								"bg-indigo-400 dark:bg-indigo-500",
							)}
							<div className="flex justify-between text-[10px] text-slate-400 mt-1">
								<span>{month[0] && dayLabel(month[0].key)}</span>
								<span>{isHindi ? "आज" : "Today"}</span>
							</div>
						</section>

						{/* Busiest hours */}
						<section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
							<div className="flex items-baseline justify-between mb-2 gap-2">
								<h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
									{isHindi ? "किस समय सबसे ज़्यादा चलता है" : "Busiest hours"}
								</h3>
								<span className="text-[11px] text-slate-400 truncate">
									{topHours(hours).join(", ")}
								</span>
							</div>
							{bars(
								hours.map((s, h) => ({
									key: String(h),
									value: s,
									hint: `${hourLabel(h)}: ${formatDuration(s, isHindi)}`,
								})),
								"bg-amber-400 dark:bg-amber-500",
							)}
							<div className="flex justify-between text-[10px] text-slate-400 mt-1">
								<span>{hourLabel(0)}</span>
								<span>{hourLabel(6)}</span>
								<span>{hourLabel(12)}</span>
								<span>{hourLabel(18)}</span>
								<span>{hourLabel(23)}</span>
							</div>
						</section>

						{/* Devotees */}
						<section className="space-y-2">
							<div className="flex items-center gap-2">
								<h3 className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">
									{isHindi
										? "भक्त — ज़्यादा समय वाले पहले"
										: "Devotees — most time first"}
								</h3>
								<span className="text-[11px] text-slate-400">
									{rows.length}
								</span>
							</div>
							<div className="relative">
								<Search
									size={16}
									className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
								/>
								<input
									type="search"
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setShown(PAGE);
									}}
									placeholder={isHindi ? "नाम से खोजें" : "Search by name"}
									aria-label={isHindi ? "नाम से खोजें" : "Search by name"}
									className="w-full min-h-touch pl-9 pr-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-400"
								/>
							</div>
							{rows.length === 0 ? (
								<p className="text-center text-sm text-slate-500 py-6">
									{isHindi
										? "इस समय में किसी ने ऐप नहीं चलाया"
										: "Nobody used the app in this period"}
								</p>
							) : (
								<ul className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
									{rows.slice(0, shown).map((u, i) => (
										<li key={u.uid}>
											<button
												type="button"
												onClick={() => setSelected(u.uid)}
												className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
											>
												<span className="w-5 text-[11px] text-slate-400 text-right shrink-0">
													{i + 1}
												</span>
												{avatar(u)}
												<span className="flex-1 min-w-0">
													<span className="block text-sm font-bold text-slate-800 dark:text-white truncate">
														{u.name || (isHindi ? "(नाम नहीं)" : "(no name)")}
													</span>
													<span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
														{[
															u.mandal && mandalName(u.mandal),
															u.lastDay &&
																`${isHindi ? "आख़िरी" : "last"}: ${dayLabel(u.lastDay)}`,
															period !== "today" &&
																u.activeDays &&
																(isHindi
																	? `${u.activeDays} दिन`
																	: `${u.activeDays} day${u.activeDays > 1 ? "s" : ""}`),
														]
															.filter(Boolean)
															.join(" · ")}
													</span>
												</span>
												<span className="text-right shrink-0">
													<span className="block text-sm font-bold text-indigo-600 dark:text-indigo-300">
														{formatDuration(u.seconds, isHindi)}
													</span>
													<span className="block text-[10px] text-slate-400">
														{isHindi ? `${u.sessions} बार` : `${u.sessions}×`}
													</span>
												</span>
											</button>
										</li>
									))}
								</ul>
							)}
							{rows.length > shown && (
								<button
									type="button"
									onClick={() => setShown((n) => n + PAGE)}
									className="w-full min-h-touch rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300"
								>
									{isHindi
										? `और दिखाएँ (${rows.length - shown})`
										: `Show more (${rows.length - shown})`}
								</button>
							)}
						</section>

						<p className="text-[11px] text-slate-400 leading-snug">
							{isHindi
								? `सिर्फ़ लॉगिन किए भक्तों का समय गिना जाता है (ऐप स्क्रीन पर खुला हो तब)। ${tracked} भक्तों का डेटा।`
								: `Only logged-in devotees are counted (while the app is on screen). Data for ${tracked} devotees.`}
							{lastFetched > 0 &&
								fetchedCount !== null &&
								(isHindi
									? ` इस बार ${fetchedCount} नए अपडेट पढ़े।`
									: ` ${fetchedCount} updates read this time.`)}
						</p>
					</>
				)}
			</div>

			{/* One devotee */}
			{sel && selected && (
				<UserDetail
					uid={selected}
					doc={sel}
					isHindi={isHindi}
					onClose={() => setSelected(null)}
					avatar={avatar}
					bars={bars}
					dayLabel={dayLabel}
					hourLabel={hourLabel}
					topHours={topHours}
					mandalName={mandalName}
				/>
			)}
		</div>
	);
};

const UserDetail: React.FC<{
	uid: string;
	doc: UsageDoc;
	isHindi: boolean;
	onClose: () => void;
	avatar: (
		u: { name: string; photo: string },
		size?: string,
	) => React.ReactNode;
	bars: (
		data: { key: string; value: number; hint: string }[],
		color: string,
	) => React.ReactNode;
	dayLabel: (k: string, long?: boolean) => string;
	hourLabel: (h: number) => string;
	topHours: (h: number[]) => string[];
	mandalName: (id: string) => string;
}> = ({
	uid,
	doc,
	isHindi,
	onClose,
	avatar,
	bars,
	dayLabel,
	hourLabel,
	topHours,
	mandalName,
}) => {
	const stat = (days: number | null) =>
		userUsage(uid, doc, days ? new Set(lastDays(days)) : null);
	const today = stat(1);
	const week = stat(7);
	const month = stat(30);
	const all = stat(null);
	const keys = lastDays(30).reverse();
	const hours = hourTotals([doc]);
	const firstDay = Object.keys(doc.d || {})
		.filter((k) => (doc.d?.[k]?.s || 0) > 0)
		.sort()[0];
	const recent = Object.entries(doc.d || {})
		.filter(([, v]) => (v?.s || 0) > 0)
		.sort((a, b) => (a[0] < b[0] ? 1 : -1))
		.slice(0, 14);
	const u: UserUsage = all;

	return (
		<div
			role="dialog"
			aria-label={u.name}
			className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col animate-in fade-in slide-in-from-right-4 duration-200"
		>
			<div className="shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 pt-[env(safe-area-inset-top)]">
				<div className="max-w-3xl mx-auto flex items-center gap-3 px-2 py-2">
					<button
						type="button"
						onClick={onClose}
						aria-label={isHindi ? "वापस" : "Back"}
						className="min-w-touch min-h-touch flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300"
					>
						<ArrowLeft size={22} />
					</button>
					{avatar(u)}
					<div className="flex-1 min-w-0">
						<h2 className="font-bold text-slate-800 dark:text-white truncate">
							{u.name || "—"}
						</h2>
						<p className="text-xs text-slate-500 dark:text-slate-400 truncate">
							{u.mandal
								? mandalName(u.mandal)
								: isHindi
									? "ऐप का उपयोग"
									: "App usage"}
						</p>
					</div>
					<EditProfileButton
						target={{ uid }}
						isHindi={isHindi}
						name={u.name}
						iconOnly
					/>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-3xl mx-auto p-4 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
						{(
							[
								[isHindi ? "आज" : "Today", today],
								[isHindi ? "7 दिन" : "7 days", week],
								[isHindi ? "30 दिन" : "30 days", month],
								[isHindi ? "कुल" : "All time", all],
							] as const
						).map(([l, s]) => (
							<div
								key={l}
								className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3"
							>
								<p className="text-[11px] text-slate-500 dark:text-slate-400">
									{l}
								</p>
								<p className="font-bold text-lg text-slate-800 dark:text-white leading-tight">
									{formatDuration(s.seconds, isHindi)}
								</p>
								<p className="text-[10px] text-slate-400">
									{isHindi
										? `${s.sessions} बार · ${s.activeDays} दिन`
										: `${s.sessions}× · ${s.activeDays} day${s.activeDays === 1 ? "" : "s"}`}
								</p>
							</div>
						))}
					</div>

					<dl className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
						{(
							[
								[
									isHindi ? "औसत, जिस दिन चलाया" : "Average on days used",
									all.activeDays
										? formatDuration(all.seconds / all.activeDays, isHindi)
										: "—",
								],
								[
									isHindi ? "एक बार में औसत" : "Average per visit",
									all.sessions
										? formatDuration(all.seconds / all.sessions, isHindi)
										: "—",
								],
								[
									isHindi ? "अक्सर इस समय" : "Usually at",
									topHours(hours).join(", ") || "—",
								],
								[
									isHindi ? "पहली बार (गिनती शुरू)" : "First counted",
									firstDay ? dayLabel(firstDay) : "—",
								],
								[
									isHindi ? "आख़िरी बार" : "Last used",
									u.lastDay ? dayLabel(u.lastDay, true) : "—",
								],
							] as const
						).map(([l, v]) => (
							<div key={l} className="flex justify-between gap-3 px-3 py-2">
								<dt className="text-slate-500 dark:text-slate-400">{l}</dt>
								<dd className="font-medium text-slate-800 dark:text-slate-100 text-right">
									{v}
								</dd>
							</div>
						))}
					</dl>

					<section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
						<h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
							{isHindi ? "पिछले 30 दिन" : "Last 30 days"}
						</h3>
						{bars(
							keys.map((k) => ({
								key: k,
								value: doc.d?.[k]?.s || 0,
								hint: `${dayLabel(k, true)}: ${formatDuration(doc.d?.[k]?.s || 0, isHindi)}`,
							})),
							"bg-indigo-400 dark:bg-indigo-500",
						)}
						<div className="flex justify-between text-[10px] text-slate-400 mt-1">
							<span>{dayLabel(keys[0])}</span>
							<span>{isHindi ? "आज" : "Today"}</span>
						</div>
					</section>

					<section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
						<h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
							{isHindi ? "किस समय चलाते हैं" : "Time of day"}
						</h3>
						{bars(
							hours.map((s, h) => ({
								key: String(h),
								value: s,
								hint: `${hourLabel(h)}: ${formatDuration(s, isHindi)}`,
							})),
							"bg-amber-400 dark:bg-amber-500",
						)}
						<div className="flex justify-between text-[10px] text-slate-400 mt-1">
							<span>{hourLabel(0)}</span>
							<span>{hourLabel(12)}</span>
							<span>{hourLabel(23)}</span>
						</div>
					</section>

					{recent.length > 0 && (
						<section>
							<h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
								{isHindi ? "हाल के दिन" : "Recent days"}
							</h3>
							<ul className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
								{recent.map(([k, v]) => (
									<li key={k} className="flex justify-between px-3 py-2">
										<span className="text-slate-600 dark:text-slate-300">
											{dayLabel(k, true)}
										</span>
										<span className="font-medium text-slate-800 dark:text-slate-100">
											{formatDuration(v?.s || 0, isHindi)}
											<span className="text-[11px] text-slate-400 font-normal">
												{isHindi ? ` · ${v?.n || 0} बार` : ` · ${v?.n || 0}×`}
											</span>
										</span>
									</li>
								))}
							</ul>
						</section>
					)}
				</div>
			</div>
		</div>
	);
};

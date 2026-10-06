import { formatDistanceToNow } from "date-fns";
import { hi as hiLocale } from "date-fns/locale";
import {
	collection,
	deleteDoc,
	deleteField,
	doc,
	documentId,
	getDocs,
	query,
	serverTimestamp,
	updateDoc,
	where,
	writeBatch,
} from "firebase/firestore";
import {
	ArrowDown,
	Check,
	Clock,
	Link,
	Loader2,
	RefreshCw,
	RotateCcw,
	Search,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { ThumbImg } from "../../../components/ui/ThumbImg";
import { db } from "../../../services/firebase";
import {
	buildSearchEntry,
	prepareDevoteeQuery,
	scoreDevotee,
} from "../../../utils/devoteeSearch";
import { getRelationLabel, normalizeRelation } from "../../constants/relations";
import { MANDAL_LIST } from "../../types/mandal";
import { familyLinkArgs } from "./DevoteeProfileManager";
import { EditProfileButton } from "./devoteeEditLink";

/** familyLinkRequests/{id} as sendFamilyLinkRequest writes it. */
interface LinkRequest {
	id: string;
	fromUserId: string;
	fromUserName?: string;
	fromUserPhoto?: string;
	toUserId: string;
	toUserName?: string;
	/** "father" = the receiver is the sender's father. */
	fromRelation?: string;
	createdAt?: number;
	status?: "pending" | "accepted" | "rejected";
	/** "admin" when an admin rejected it; otherwise the receiver did. */
	rejectedBy?: string;
	/** Server time of the last answer. */
	updatedAt?: { toMillis?: () => number } | number;
}

const answeredAt = (r: LinkRequest): number | undefined =>
	typeof r.updatedAt === "number"
		? r.updatedAt
		: r.updatedAt?.toMillis?.() || undefined;

type Person = Pick<
	UserProfile,
	| "uid"
	| "realName"
	| "dikshaName"
	| "photoURL"
	| "mandalId"
	| "customMandalName"
	| "isDeleted"
	| "linkedFamilyMembers"
> & { mergedIntoUid?: string };

const OLD_AFTER = 7 * 24 * 60 * 60 * 1000;
const PAGE = 40;

/**
 * Admin → Community Manager → Link requests (super admins): every family
 * link request still waiting for an answer — who asked whom, the relation
 * they gave, how long it has waited. An admin can accept it for them,
 * reject it, or delete a stale one. One read of the pending requests plus
 * the people in them; refreshed by hand.
 */
export const LinkRequestsManager: React.FC<{ isHindi: boolean }> = ({
	isHindi,
}) => {
	const { showToast } = useToast();
	const [pending, setPending] = useState<LinkRequest[] | null>(null);
	const [rejected, setRejected] = useState<LinkRequest[]>([]);
	/** "pending" = waiting for an answer; "rejected" = said no, to look at again. */
	const [view, setView] = useState<"pending" | "rejected">("pending");
	const requests =
		pending === null ? null : view === "rejected" ? rejected : pending;
	const [people, setPeople] = useState<Record<string, Person>>({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [search, setSearch] = useState("");
	const [onlyOld, setOnlyOld] = useState(false);
	const [shown, setShown] = useState(PAGE);
	const [busy, setBusy] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(false);
		try {
			const byStatus = async (status: "pending" | "rejected") =>
				(
					await getDocs(
						query(
							collection(db, "familyLinkRequests"),
							where("status", "==", status),
						),
					)
				).docs
					.map((d) => ({ id: d.id, ...(d.data() as Omit<LinkRequest, "id">) }))
					.filter((r) => r.fromUserId && r.toUserId);
			const [list, said] = await Promise.all([
				byStatus("pending").then((l) =>
					l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
				),
				byStatus("rejected").then((l) =>
					l.sort(
						(a, b) =>
							(answeredAt(b) || b.createdAt || 0) -
							(answeredAt(a) || a.createdAt || 0),
					),
				),
			]);

			// The people in them, for current names / photos and to spot
			// requests that can no longer work (account removed, already linked).
			const uids = Array.from(
				new Set([...list, ...said].flatMap((r) => [r.fromUserId, r.toUserId])),
			).filter((u) => typeof u === "string" && u && !u.includes("/"));
			const found: Record<string, Person> = {};
			for (let i = 0; i < uids.length; i += 30) {
				const part = await getDocs(
					query(
						collection(db, "users"),
						where(documentId(), "in", uids.slice(i, i + 30)),
					),
				);
				part.forEach((d) => {
					found[d.id] = { ...(d.data() as Person), uid: d.id };
				});
			}
			setPeople(found);
			setPending(list);
			setRejected(said);
		} catch (e) {
			console.error("[LinkRequests] load failed", e);
			setError(true);
			setPending((r) => r ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const nameOf = (uid: string, fallback?: string) => {
		const p = people[uid];
		return p?.realName || p?.dikshaName || fallback || "—";
	};
	const mandalOf = (uid: string) => {
		const p = people[uid];
		if (!p?.mandalId) return "";
		if (p.mandalId === "custom") return p.customMandalName || "";
		const m = MANDAL_LIST.find((x) => x.id === p.mandalId);
		return m ? (isHindi ? m.shortNameHi : m.shortNameEn) : "";
	};
	/** Why this request can't do anything any more, if so. */
	const problemOf = (r: LinkRequest) => {
		const from = people[r.fromUserId];
		const to = people[r.toUserId];
		if (!from || !to || from.isDeleted || to.isDeleted)
			return isHindi ? "एक खाता हटाया जा चुका है" : "One account was removed";
		if (from.mergedIntoUid || to.mergedIntoUid)
			return isHindi
				? "एक खाता दूसरे में मिला दिया गया"
				: "One account was merged into another";
		if (
			(from.linkedFamilyMembers || []).includes(r.toUserId) ||
			(to.linkedFamilyMembers || []).includes(r.fromUserId)
		)
			return isHindi ? "पहले से जुड़े हुए हैं" : "Already linked";
		if (
			r.status === "rejected" &&
			pending?.some(
				(p) =>
					(p.fromUserId === r.fromUserId && p.toUserId === r.toUserId) ||
					(p.fromUserId === r.toUserId && p.toUserId === r.fromUserId),
			)
		)
			return isHindi
				? "इन दोनों के बीच नया अनुरोध पहले से इंतज़ार में है"
				: "A newer request between them is already waiting";
		return "";
	};

	const now = Date.now();
	const isOld = (r: LinkRequest) =>
		r.status !== "rejected" && !!r.createdAt && now - r.createdAt > OLD_AFTER;

	// biome-ignore lint/correctness/useExhaustiveDependencies: nameOf / isOld only read `people` and the clock
	const rows = useMemo(() => {
		if (!requests) return [];
		const q = prepareDevoteeQuery(search);
		return requests.filter((r) => {
			if (onlyOld && !isOld(r)) return false;
			if (!q.text) return true;
			return (
				scoreDevotee(
					buildSearchEntry(
						[
							nameOf(r.fromUserId, r.fromUserName),
							nameOf(r.toUserId, r.toUserName),
							people[r.fromUserId]?.dikshaName,
							people[r.toUserId]?.dikshaName,
						],
						[r.fromUserId, r.toUserId],
						[],
					),
					q,
				) > 0
			);
		});
	}, [requests, pending, people, search, onlyOld]);

	const oldCount = requests?.filter(isOld).length ?? 0;
	const stuckCount = requests?.filter((r) => !!problemOf(r)).length ?? 0;

	const drop = (id: string) => {
		setPending((list) => (list ? list.filter((r) => r.id !== id) : list));
		setRejected((list) => list.filter((r) => r.id !== id));
	};

	// Same result as the devotee pressing Accept (see AdminFamilyLinkingPanel).
	const accept = async (r: LinkRequest) => {
		if (
			!confirm(
				isHindi
					? `${nameOf(r.toUserId, r.toUserName)} की ओर से यह अनुरोध स्वीकार करें? दोनों खाते जुड़ जाएँगे।`
					: `Accept this for ${nameOf(r.toUserId, r.toUserName)}? Both accounts will be linked.`,
			)
		)
			return;
		setBusy(r.id);
		try {
			const batch = writeBatch(db);
			batch.update(
				doc(db, "users", r.fromUserId),
				...familyLinkArgs(r.toUserId, normalizeRelation(r.fromRelation)),
			);
			batch.update(
				doc(db, "users", r.toUserId),
				...familyLinkArgs(r.fromUserId, ""),
			);
			batch.update(doc(db, "familyLinkRequests", r.id), {
				status: "accepted",
			});
			await batch.commit();
			drop(r.id);
			showToast(
				isHindi
					? "स्वीकार किया — खाते जुड़ गए ✅"
					: "Accepted — accounts linked ✅",
				"success",
			);
		} catch (e) {
			console.error("[LinkRequests] accept failed", e);
			showToast(
				isHindi
					? "स्वीकार नहीं हो सका। कुछ भी नहीं बदला — दोबारा कोशिश करें।"
					: "Could not accept. Nothing changed — try again.",
				"error",
			);
		} finally {
			setBusy(null);
		}
	};

	const reject = async (r: LinkRequest) => {
		setBusy(r.id);
		try {
			await updateDoc(doc(db, "familyLinkRequests", r.id), {
				status: "rejected",
				rejectedBy: "admin",
				updatedAt: serverTimestamp(),
			});
			drop(r.id);
			setRejected((list) => [
				{
					...r,
					status: "rejected",
					rejectedBy: "admin",
					updatedAt: Date.now(),
				},
				...list,
			]);
			showToast(isHindi ? "अनुरोध अस्वीकार किया" : "Request rejected", "success");
		} catch (e) {
			console.error("[LinkRequests] reject failed", e);
			showToast(
				isHindi
					? "अस्वीकार नहीं हो सका, दोबारा कोशिश करें"
					: "Could not reject, try again",
				"error",
			);
		} finally {
			setBusy(null);
		}
	};

	/** A rejected request goes back to the receiver to answer again. */
	const reopen = async (r: LinkRequest) => {
		if (
			!confirm(
				isHindi
					? `यह अनुरोध फिर से ${nameOf(r.toUserId, r.toUserName)} के पास जवाब के लिए जाएगा (ऐप में उनकी प्रोफ़ाइल पर दिखेगा)। आगे बढ़ें?`
					: `This request goes back to ${nameOf(r.toUserId, r.toUserName)} to answer again (shown on their profile in the app). Continue?`,
			)
		)
			return;
		setBusy(r.id);
		try {
			const at = Date.now();
			await updateDoc(doc(db, "familyLinkRequests", r.id), {
				status: "pending",
				createdAt: at,
				reopenedAt: at,
				rejectedBy: deleteField(),
				updatedAt: serverTimestamp(),
			});
			drop(r.id);
			setPending((list) => [
				{ ...r, status: "pending", createdAt: at, rejectedBy: undefined },
				...(list || []),
			]);
			showToast(
				isHindi ? "अनुरोध फिर से भेज दिया ✅" : "Request sent again ✅",
				"success",
			);
		} catch (e) {
			console.error("[LinkRequests] reopen failed", e);
			showToast(
				isHindi
					? "फिर से नहीं भेजा जा सका, दोबारा कोशिश करें"
					: "Could not send again, try again",
				"error",
			);
		} finally {
			setBusy(null);
		}
	};

	const remove = async (r: LinkRequest) => {
		if (
			!confirm(
				isHindi
					? "यह अनुरोध हटा दें? भेजने वाला चाहे तो दोबारा भेज सकता है।"
					: "Delete this request? The sender can send it again if they want.",
			)
		)
			return;
		setBusy(r.id);
		try {
			await deleteDoc(doc(db, "familyLinkRequests", r.id));
			drop(r.id);
			showToast(isHindi ? "अनुरोध हटाया" : "Request deleted", "success");
		} catch (e) {
			console.error("[LinkRequests] delete failed", e);
			showToast(
				isHindi
					? "हटाया नहीं जा सका, दोबारा कोशिश करें"
					: "Could not delete, try again",
				"error",
			);
		} finally {
			setBusy(null);
		}
	};

	const avatar = (uid: string, fallbackPhoto?: string) => {
		const photo = people[uid]?.photoURL || fallbackPhoto;
		return photo ? (
			<ThumbImg
				src={photo}
				alt=""
				className="w-9 h-9 rounded-full object-cover shrink-0"
			/>
		) : (
			<span className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm font-bold flex items-center justify-center shrink-0">
				{nameOf(uid).charAt(0).toUpperCase()}
			</span>
		);
	};

	const personLine = (uid: string, fallbackName?: string, photo?: string) => (
		<div className="flex items-center gap-2.5 min-w-0">
			{avatar(uid, photo)}
			<div className="flex-1 min-w-0">
				<p className="text-sm font-bold text-slate-800 dark:text-white truncate">
					{nameOf(uid, fallbackName)}
				</p>
				{mandalOf(uid) && (
					<p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
						{mandalOf(uid)}
					</p>
				)}
			</div>
			{people[uid] && (
				<EditProfileButton
					target={{ uid }}
					isHindi={isHindi}
					name={nameOf(uid, fallbackName)}
					iconOnly
					onClosed={(changed) => changed && load()}
				/>
			)}
		</div>
	);

	if (requests === null)
		return (
			<div className="flex-1 flex items-center justify-center p-10">
				<Loader2 className="animate-spin text-blue-500" size={32} />
			</div>
		);

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-3xl mx-auto p-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
				<div className="flex items-center gap-2">
					<div className="relative flex-1 min-w-0">
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
							className="w-full min-h-touch pl-9 pr-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-400"
						/>
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
						{isHindi
							? "अनुरोध नहीं आ सके — इंटरनेट या लॉगिन जाँचें"
							: "Could not load requests — check internet or login"}
					</p>
				)}

				{!(error && requests.length === 0) && (
					<div className="flex gap-1">
						{(
							[
								[
									"pending",
									isHindi ? "जवाब के इंतज़ार में" : "Waiting",
									pending?.length ?? 0,
								],
								["rejected", isHindi ? "अस्वीकृत" : "Rejected", rejected.length],
							] as const
						).map(([id, label, n]) => (
							<button
								key={id}
								type="button"
								aria-pressed={view === id}
								onClick={() => {
									setView(id);
									setOnlyOld(false);
									setShown(PAGE);
								}}
								className={`flex-1 min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
									view === id
										? id === "rejected"
											? "bg-slate-600 text-white"
											: "bg-blue-500 text-white"
										: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
								}`}
							>
								{id === "rejected" ? <X size={14} /> : <Clock size={14} />}
								{label}
								<span className="tabular-nums opacity-80">{n}</span>
							</button>
						))}
					</div>
				)}

				{view === "rejected" && rejected.length > 0 && (
					<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
						{isHindi
							? "जिन अनुरोधों को मना किया गया। गलती से मना हुआ हो तो “फिर से भेजें” — वह व्यक्ति ऐप में दोबारा जवाब दे सकेगा। या उनकी ओर से स्वीकार करें।"
							: "Requests that were turned down. If one was a mistake, “Send again” lets that person answer again in the app — or accept it for them."}
					</p>
				)}

				{view === "pending" && !(error && requests.length === 0) && (
					<div className="flex flex-wrap items-center gap-2 text-xs">
						{oldCount > 0 && (
							<button
								type="button"
								aria-pressed={onlyOld}
								onClick={() => {
									setOnlyOld((v) => !v);
									setShown(PAGE);
								}}
								className={`min-h-[32px] px-2.5 rounded-lg font-bold flex items-center gap-1 ${
									onlyOld
										? "bg-amber-500 text-white"
										: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
								}`}
							>
								<Clock size={12} />
								{isHindi
									? `${oldCount} एक हफ़्ते से पुराने`
									: `${oldCount} older than a week`}
							</button>
						)}
						{stuckCount > 0 && (
							<span className="px-2 py-1 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-bold">
								{isHindi
									? `${stuckCount} अब बेकार (हटा सकते हैं)`
									: `${stuckCount} no longer valid (safe to delete)`}
							</span>
						)}
					</div>
				)}

				{error && requests.length === 0 ? null : rows.length === 0 ? (
					<div className="text-center py-12 px-4">
						<Link className="mx-auto text-slate-300 mb-3" size={40} />
						<p className="font-bold text-slate-700 dark:text-slate-200">
							{requests.length === 0
								? view === "rejected"
									? isHindi
										? "कोई अस्वीकृत अनुरोध नहीं"
										: "No rejected requests"
									: isHindi
										? "कोई अनुरोध लंबित नहीं"
										: "No requests waiting"
								: isHindi
									? "इस खोज से कोई अनुरोध नहीं मिला"
									: "No request matches"}
						</p>
					</div>
				) : (
					<ul className="space-y-2">
						{rows.slice(0, shown).map((r) => {
							const problem = problemOf(r);
							const rel = getRelationLabel(r.fromRelation, isHindi);
							const working = busy === r.id;
							return (
								<li
									key={r.id}
									className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 space-y-2"
								>
									<div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
										<span className="flex items-center gap-1">
											<Clock size={12} />
											{r.createdAt
												? formatDistanceToNow(r.createdAt, {
														addSuffix: true,
														locale: isHindi ? hiLocale : undefined,
													})
												: "—"}
										</span>
										{isOld(r) && (
											<span className="font-bold text-amber-700 dark:text-amber-400">
												{isHindi ? "पुराना" : "Old"}
											</span>
										)}
										{r.status === "rejected" && (
											<span className="font-bold text-slate-600 dark:text-slate-300 text-right">
												{r.rejectedBy === "admin"
													? isHindi
														? "एडमिन ने अस्वीकार किया"
														: "Rejected by an admin"
													: isHindi
														? `${nameOf(r.toUserId, r.toUserName)} ने मना किया`
														: `Declined by ${nameOf(r.toUserId, r.toUserName)}`}
												{answeredAt(r)
													? ` · ${formatDistanceToNow(answeredAt(r) as number, {
															addSuffix: true,
															locale: isHindi ? hiLocale : undefined,
														})}`
													: ""}
											</span>
										)}
									</div>
									{personLine(r.fromUserId, r.fromUserName, r.fromUserPhoto)}
									<div className="flex items-center gap-2 pl-2.5 text-[11px] text-slate-500 dark:text-slate-400">
										<ArrowDown size={14} className="shrink-0 text-blue-400" />
										<span className="min-w-0">
											{isHindi ? "ने जुड़ने का अनुरोध भेजा" : "asked to link with"}
											{rel &&
												(isHindi
													? ` — बताया रिश्ता: ${rel}`
													: ` — as their ${rel}`)}
										</span>
									</div>
									{personLine(r.toUserId, r.toUserName)}
									{problem && (
										<p className="text-[11px] font-bold text-red-600 dark:text-red-400">
											⚠ {problem}
										</p>
									)}
									<div className="flex gap-2 pt-1">
										{!problem && (
											<button
												type="button"
												onClick={() => accept(r)}
												disabled={working}
												className="flex-1 min-h-touch rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5"
											>
												{working ? (
													<Loader2 size={14} className="animate-spin" />
												) : (
													<Check size={14} />
												)}
												{isHindi ? "स्वीकार" : "Accept"}
											</button>
										)}
										{!problem && r.status === "rejected" && (
											<button
												type="button"
												onClick={() => reopen(r)}
												disabled={working}
												className="flex-1 min-h-touch rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 disabled:opacity-50 text-xs font-bold flex items-center justify-center gap-1.5"
											>
												<RotateCcw size={14} />
												{isHindi ? "फिर से भेजें" : "Send again"}
											</button>
										)}
										{!problem && r.status !== "rejected" && (
											<button
												type="button"
												onClick={() => reject(r)}
												disabled={working}
												className="flex-1 min-h-touch rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 disabled:opacity-50 text-xs font-bold flex items-center justify-center gap-1.5"
											>
												<X size={14} />
												{isHindi ? "अस्वीकार" : "Reject"}
											</button>
										)}
										<button
											type="button"
											onClick={() => remove(r)}
											disabled={working}
											className="flex-1 min-h-touch rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 disabled:opacity-50 text-xs font-bold flex items-center justify-center gap-1.5"
										>
											<Trash2 size={14} />
											{isHindi ? "हटाएँ" : "Delete"}
										</button>
									</div>
								</li>
							);
						})}
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
				<p className="text-[11px] text-slate-400 leading-snug">
					{isHindi
						? "स्वीकार = जिसे अनुरोध मिला, उसकी ओर से स्वीकार करना। “हटाएँ” पुराने या बेकार अनुरोधों के लिए है।"
						: "Accept = accepting on behalf of the person who received it. “Delete” is for old or stale requests."}
				</p>
			</div>
		</div>
	);
};

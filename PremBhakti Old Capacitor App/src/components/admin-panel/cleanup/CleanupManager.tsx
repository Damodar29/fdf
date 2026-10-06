import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
	ArrowDownUp,
	Check,
	Copy,
	EyeOff,
	GitMerge,
	Link,
	Link2Off,
	Loader2,
	RefreshCw,
	RotateCcw,
	ShieldCheck,
	Trash2,
	UserCheck,
	Users,
	Wand2,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	FamilyMember,
	UserProfile,
} from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import { auth, db } from "../../../../services/firebase";
import {
	type AllIssues,
	type BrokenLink,
	findAllIssues,
	type LoginIds,
	splitIgnored,
} from "../../../../utils/profileIssues";
import { getRelationLabel } from "../../../constants/relations";
import { useAdminBack } from "../../../hooks/useAdminBack";
import { FamilyGroupsReport } from "../DevoteeProfileManager";
import { useLoginMethods } from "../loginMethods";
import { loginSummary } from "../LoginMethodsBar";
import {
	dropTwinMember,
	type IgnoreMeta,
	ignoredBy,
	ignoreIssue,
	linkAccounts,
	loadIgnored,
	relinkToMerged,
	removeLinkEntry,
	removeMembers,
	unignoreIssues,
} from "./cleanupWrites";
import { MergeSheet } from "./MergeSheet";
import {
	ActionBtn,
	IssueCard,
	mandalLabel,
	PersonRow,
	personName,
	Tag,
} from "./PersonBits";

type Cat = keyof AllIssues;

const CATS: {
	id: Cat;
	icon: React.ReactNode;
	hi: string;
	en: string;
	hiDesc: string;
	enDesc: string;
}[] = [
	{
		id: "duplicates",
		icon: <GitMerge size={20} />,
		hi: "एक भक्त की दो प्रोफ़ाइल",
		en: "One devotee, two profiles",
		hiDesc: "दो ईमेल, दो नंबर या एक-एक से बनी दो प्रोफ़ाइल — एक करें",
		enDesc: "Made with two emails, two numbers, or one of each — merge",
	},
	{
		id: "repeated",
		icon: <Copy size={20} />,
		hi: "एक परिवारजन दो बार जोड़ा",
		en: "Family member added twice",
		hiDesc: "एक ही प्रोफ़ाइल में एक ही व्यक्ति दो बार",
		enDesc: "The same person twice in one profile",
	},
	{
		id: "alsoLinked",
		icon: <Users size={20} />,
		hi: "लिंक भी, हाथ से भी",
		en: "Linked and also added by hand",
		hiDesc: "जो लिंक हैं, उन्हें 'अन्य परिवारजन' में भी जोड़ा है",
		enDesc: "A linked account also added under 'Other family members'",
	},
	{
		id: "hasAccount",
		icon: <UserCheck size={20} />,
		hi: "परिवारजन का अपना खाता है",
		en: "Family member has their own account",
		hiDesc: "हाथ से जोड़ा, पर ऐप पर उनकी प्रोफ़ाइल है — लिंक नहीं",
		enDesc: "Added by hand, but they have a profile — not linked",
	},
	{
		id: "sharedCopies",
		icon: <ArrowDownUp size={20} />,
		hi: "कई रिश्तेदारों ने एक ही व्यक्ति जोड़ा",
		en: "Same person added by several relatives",
		hiDesc: "एक परिवार में एक व्यक्ति कई प्रोफ़ाइल में",
		enDesc: "One person in several profiles of one family",
	},
	{
		id: "brokenLinks",
		icon: <Link2Off size={20} />,
		hi: "टूटे लिंक",
		en: "Broken links",
		hiDesc: "एक तरफ़ा, या हटाए / मिलाए गए खाते से लिंक",
		enDesc: "One-sided, or to a removed / merged account",
	},
];

const PAGE = 30;

/** Dead links grouped by the account they point at. */
const deadLinkGroups = (links: BrokenLink[]) => {
	const groups: {
		key: string;
		kind: BrokenLink["kind"];
		otherUid: string;
		mergedInto?: string;
		items: BrokenLink[];
	}[] = [];
	for (const b of links) {
		if (b.kind === "self" || b.kind === "one_sided") continue;
		const g = groups.find(
			(x) => x.kind === b.kind && x.otherUid === b.otherUid,
		);
		if (g) g.items.push(b);
		else
			groups.push({
				key: `dead:${b.kind}:${b.otherUid}`,
				kind: b.kind,
				otherUid: b.otherUid,
				mergedInto: b.mergedInto,
				items: [b],
			});
	}
	return groups;
};

/** Problems as the admin sees them (dead links count once per account). */
const shownCount = (issues: AllIssues, c: keyof AllIssues) =>
	c === "brokenLinks"
		? deadLinkGroups(issues.brokenLinks).length +
			issues.brokenLinks.filter(
				(b) => b.kind === "self" || b.kind === "one_sided",
			).length
		: issues[c].length;

/**
 * Admin → Community Manager → "Duplicates & problems": everything that is
 * doubled or broken in devotee profiles (utils/profileIssues.ts), each with a
 * fix, or "not a problem" so it stops showing for every admin.
 *
 * Reads the users list once (refresh by hand); after a fix only the touched
 * profiles are read again.
 */
export const CleanupManager: React.FC<{
	isHindi: boolean;
	isSuperAdmin: boolean;
}> = ({ isHindi, isSuperAdmin }) => {
	const { showToast } = useToast();
	const [profiles, setProfiles] = useState<UserProfile[] | null>(null);
	const [ignoredMeta, setIgnoredMeta] = useState<Record<string, IgnoreMeta>>(
		{},
	);
	const ignored = useMemo(
		() => new Set(Object.keys(ignoredMeta)),
		[ignoredMeta],
	);
	/** "open" = still to look at; "hidden" = marked "not a problem". */
	const [view, setView] = useState<"open" | "hidden">("open");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [cat, setCat] = useState<Cat | null>(null);
	const [shown, setShown] = useState(PAGE);
	const [busy, setBusy] = useState<string | null>(null);
	const [merge, setMerge] = useState<{ a: UserProfile; b: UserProfile } | null>(
		null,
	);
	const logins = useLoginMethods(isSuperAdmin);

	useAdminBack(!!cat, () => setCat(null));
	useAdminBack(view === "hidden" && !cat, () => setView("open"));

	const load = useCallback(async () => {
		setLoading(true);
		setError(false);
		try {
			const [snap, ign] = await Promise.all([
				getDocs(collection(db, "users")),
				loadIgnored(),
			]);
			setProfiles(
				snap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id })),
			);
			setIgnoredMeta(ign);
		} catch (e) {
			console.error("[Cleanup] load failed", e);
			setError(true);
			setProfiles((p) => p ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	/** Read only these profiles again (after a fix). */
	const refresh = async (uids: string[]) => {
		const fresh = await Promise.all(
			[...new Set(uids)].map(async (uid) => {
				const s = await getDoc(doc(db, "users", uid));
				return s.exists() ? { ...(s.data() as UserProfile), uid } : null;
			}),
		);
		setProfiles((list) => {
			if (!list) return list;
			const byUid = new Map(list.map((p) => [p.uid, p]));
			for (const p of fresh) if (p) byUid.set(p.uid, p);
			return [...byUid.values()];
		});
	};

	const byUid = useMemo(
		() => new Map((profiles || []).map((p) => [p.uid, p])),
		[profiles],
	);
	const loginIds = useMemo(() => {
		const out: Record<string, LoginIds> = {};
		for (const [uid, l] of Object.entries(logins.map || {}))
			out[uid] = { phone: l.loginPhone, email: l.loginEmail };
		return out;
	}, [logins.map]);
	const allIssues = useMemo(
		() => (profiles ? findAllIssues(profiles, loginIds) : null),
		[profiles, loginIds],
	);
	const split = useMemo(
		() => (allIssues ? splitIgnored(allIssues, ignored) : null),
		[allIssues, ignored],
	);
	/** What the screen shows: open problems, or the hidden ones. */
	const issues = split ? (view === "hidden" ? split.hidden : split.open) : null;

	const memberOf = (uid: string, id: string): FamilyMember | undefined =>
		byUid.get(uid)?.familyMembers?.find((m) => m.id === id);

	/** Runs one fix, then re-reads the profiles it touched. */
	const run = async (
		key: string,
		fix: () => Promise<unknown>,
		touched: string[],
		done: string,
	) => {
		setBusy(key);
		try {
			await fix();
			await refresh(touched);
			showToast(done, "success");
		} catch (e) {
			console.error("[Cleanup] fix failed", e);
			showToast(
				isHindi
					? "ठीक नहीं हो सका — इंटरनेट देखकर दोबारा कोशिश करें"
					: "Could not fix — check the internet and try again",
				"error",
			);
		} finally {
			setBusy(null);
		}
	};

	const forget = (keys: string[]) =>
		setIgnoredMeta((m) => {
			const next = { ...m };
			for (const k of keys) delete next[k];
			return next;
		});

	const notAProblem = async (key: string) => {
		const by = auth.currentUser?.email || auth.currentUser?.phoneNumber || "";
		setIgnoredMeta((m) => ({ ...m, [key]: { at: Date.now(), by } }));
		try {
			await ignoreIssue(key);
			showToast(
				isHindi
					? "ठीक है — “छिपी हुई बातें” में चला गया"
					: "OK — moved to “Hidden items”",
				"success",
			);
		} catch (e) {
			console.error("[Cleanup] ignore failed", e);
			forget([key]);
			showToast(
				isHindi
					? "सहेजा नहीं जा सका (Firestore rules deploy हैं?)"
					: "Could not save (are the Firestore rules deployed?)",
				"error",
			);
		}
	};

	/** A hidden item goes back to the open list, for every admin. */
	const bringBack = async (keys: string[]) => {
		const before = ignoredMeta;
		forget(keys);
		try {
			await unignoreIssues(keys);
			showToast(
				isHindi ? "वापस “देखनी हैं” में आ गया" : "Back in the open list",
				"success",
			);
		} catch (e) {
			console.error("[Cleanup] unhide failed", e);
			setIgnoredMeta(before);
			showToast(
				isHindi
					? "सहेजा नहीं जा सका, दोबारा कोशिश करें"
					: "Could not save, try again",
				"error",
			);
		}
	};

	/**
	 * "Not a problem" on an open item; on a hidden one, who hid it and a
	 * button to bring it back.
	 */
	const hideBtn = (keys: string[], label: string) =>
		view === "hidden" ? (
			<>
				<ActionBtn disabled={!!busy} onClick={() => bringBack(keys)}>
					<RotateCcw size={14} />
					{isHindi ? "वापस लाएँ" : "Bring back"}
				</ActionBtn>
				{ignoredBy(ignoredMeta[keys[0]], isHindi) && (
					<span className="self-center text-[11px] text-slate-400">
						{isHindi ? "छिपाया: " : "Hidden by: "}
						{ignoredBy(ignoredMeta[keys[0]], isHindi)}
					</span>
				)}
			</>
		) : (
			<ActionBtn
				disabled={!!busy}
				onClick={() => {
					for (const k of keys) notAProblem(k);
				}}
			>
				<Check size={14} />
				{label}
			</ActionBtn>
		);

	/** Several safe fixes in a row. */
	const runAll = async (
		items: { key: string; fix: () => Promise<unknown>; touched: string[] }[],
	) => {
		if (
			!confirm(
				isHindi
					? `${items.length} सुधार एक साथ होंगे। आगे बढ़ें?`
					: `${items.length} fixes will be made. Continue?`,
			)
		)
			return;
		setBusy("all");
		let ok = 0;
		const touched: string[] = [];
		for (const it of items) {
			try {
				await it.fix();
				ok++;
				touched.push(...it.touched);
			} catch (e) {
				console.warn("[Cleanup] one fix failed", it.key, e);
			}
		}
		await refresh(touched).catch(() => {});
		setBusy(null);
		showToast(
			isHindi
				? `${ok} ठीक किए${ok < items.length ? `, ${items.length - ok} नहीं हो सके` : " ✅"}`
				: `${ok} fixed${ok < items.length ? `, ${items.length - ok} failed` : " ✅"}`,
			ok === items.length ? "success" : "error",
		);
	};

	if (!profiles)
		return (
			<div className="flex-1 flex items-center justify-center p-10">
				<Loader2 className="animate-spin text-emerald-500" size={32} />
			</div>
		);

	const details = (p?: UserProfile) => {
		if (!p) return isHindi ? "प्रोफ़ाइल नहीं मिली" : "Profile not found";
		const login = logins.map?.[p.uid];
		return (
			<>
				<span className="block">
					{[mandalLabel(p, isHindi), p.dikshaDate, p.phoneNumber, p.email]
						.filter(Boolean)
						.join(" · ") || "—"}
				</span>
				{login && (
					<span className="block break-all">
						{isHindi ? "लॉगिन" : "Login"}: {loginSummary(login, isHindi)}
					</span>
				)}
				<span className="flex flex-wrap gap-1 mt-0.5">
					{p.isApproved ? (
						<Tag tone="emerald">{isHindi ? "स्वीकृत" : "Approved"}</Tag>
					) : (
						<Tag tone="amber">{isHindi ? "लंबित" : "Pending"}</Tag>
					)}
					{(p.linkedFamilyMembers?.length || 0) > 0 && (
						<Tag tone="blue">🔗 {p.linkedFamilyMembers?.length}</Tag>
					)}
					{(p.familyMembers?.length || 0) > 0 && (
						<Tag>👪 {p.familyMembers?.length}</Tag>
					)}
				</span>
			</>
		);
	};

	const memberSub = (m?: FamilyMember) =>
		m
			? [getRelationLabel(m.relation, isHindi), m.dikshaDate]
					.filter(Boolean)
					.join(" · ") || "—"
			: "—";

	const reasonLabel: Record<string, [string, string]> = {
		same_phone: ["एक ही फ़ोन", "Same phone"],
		same_email: ["एक ही ईमेल", "Same email"],
		same_photo: ["एक ही फ़ोटो", "Same photo"],
		same_date: ["एक ही दीक्षा तिथि", "Same diksha date"],
		same_name: ["नाम एक", "Same name"],
		similar_name: ["नाम मिलता-जुलता", "Similar name"],
		same_mandal: ["एक ही मंडल", "Same mandal"],
		different_date: ["⚠ दीक्षा तिथि अलग लिखी", "⚠ Diksha dates differ"],
	};

	const count = (c: Cat) => (issues ? shownCount(issues, c) : 0);
	const total = CATS.reduce((n, c) => n + count(c.id), 0);
	const hiddenTotal = split
		? CATS.reduce((n, c) => n + shownCount(split.hidden, c.id), 0)
		: 0;
	const working = (key: string) => busy === key || busy === "all";

	// ── One category's list ──────────────────────────────────────────
	const renderList = (c: Cat) => {
		if (!issues) return null;
		const list = issues[c] as { key: string }[];
		const items = list.slice(0, shown);
		let bulk: React.ReactNode = null;

		if (c === "repeated" && issues.repeated.length > 1)
			bulk = (
				<ActionBtn
					tone="primary"
					disabled={!!busy}
					onClick={() =>
						runAll(
							issues.repeated.map((r) => ({
								key: r.key,
								fix: () =>
									removeMembers(r.uid, [r.repeatId], {
										keepId: r.keepId,
										fromId: r.repeatId,
									}),
								touched: [r.uid],
							})),
						)
					}
				>
					<Wand2 size={14} />
					{isHindi ? "सभी दोहराए हटाएँ" : "Remove all repeats"}
				</ActionBtn>
			);
		if (c === "alsoLinked" && issues.alsoLinked.length > 1)
			bulk = (
				<ActionBtn
					tone="primary"
					disabled={!!busy}
					onClick={() =>
						runAll(
							issues.alsoLinked.map((r) => ({
								key: r.key,
								fix: () => dropTwinMember(r.uid, r.memberId, r.linkedUid),
								touched: [r.uid],
							})),
						)
					}
				>
					<Wand2 size={14} />
					{isHindi ? "सभी हाथ वाले हटाएँ" : "Remove all hand-added copies"}
				</ActionBtn>
			);
		const safeBroken = issues.brokenLinks.filter((b) => b.kind !== "one_sided");
		if (c === "brokenLinks" && deadLinkGroups(issues.brokenLinks).length > 1)
			bulk = (
				<ActionBtn
					tone="primary"
					disabled={!!busy}
					onClick={() =>
						runAll(
							safeBroken.map((b) => ({
								key: b.key,
								fix: () =>
									b.kind === "merged" && b.mergedInto
										? relinkToMerged(
												b.uid,
												b.otherUid,
												b.mergedInto,
												byUid.get(b.uid)?.linkedFamilyRelations?.[b.otherUid] ||
													"",
											)
										: removeLinkEntry(b.uid, b.otherUid),
								touched: [b.uid, ...(b.mergedInto ? [b.mergedInto] : [])],
							})),
						)
					}
				>
					<Wand2 size={14} />
					{isHindi
						? `${safeBroken.length} सुरक्षित सुधार एक साथ`
						: `Fix ${safeBroken.length} safe ones at once`}
				</ActionBtn>
			);

		return (
			<div className="space-y-3">
				<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
					{isHindi
						? CATS.find((x) => x.id === c)?.hiDesc
						: CATS.find((x) => x.id === c)?.enDesc}
				</p>
				{bulk && view === "open" && <div className="flex">{bulk}</div>}
				{list.length === 0 ? (
					<div className="text-center py-10">
						<ShieldCheck className="mx-auto text-emerald-400 mb-2" size={36} />
						<p className="font-bold text-slate-700 dark:text-slate-200">
							{view === "hidden"
								? isHindi
									? "यहाँ कुछ छिपा नहीं है"
									: "Nothing hidden here"
								: isHindi
									? "सब ठीक है"
									: "All good"}
						</p>
					</div>
				) : (
					<ul className="space-y-2">
						{c === "duplicates" &&
							issues.duplicates.slice(0, shown).map((d) => {
								const a = byUid.get(d.a);
								const b = byUid.get(d.b);
								return (
									<IssueCard key={d.key}>
										<div className="flex flex-wrap gap-1">
											{d.level === "high" ? (
												<Tag tone="red">
													{isHindi
														? "लगभग पक्का एक ही भक्त"
														: "Almost surely one devotee"}
												</Tag>
											) : (
												<Tag tone="amber">
													{isHindi ? "शायद — जाँच लें" : "Maybe — please check"}
												</Tag>
											)}
											{d.reasons.map((r) => (
												<Tag key={r}>
													{isHindi ? reasonLabel[r]?.[0] : reasonLabel[r]?.[1]}
												</Tag>
											))}
										</div>
										<PersonRow
											person={a}
											uid={d.a}
											isHindi={isHindi}
											sub={details(a)}
											onClosed={(ch) => ch && refresh([d.a])}
										/>
										<PersonRow
											person={b}
											uid={d.b}
											isHindi={isHindi}
											sub={details(b)}
											onClosed={(ch) => ch && refresh([d.b])}
										/>
										<div className="flex flex-wrap gap-2">
											{isSuperAdmin && a && b && (
												<ActionBtn
													tone="blue"
													disabled={!!busy}
													onClick={() => setMerge({ a, b })}
												>
													<GitMerge size={14} />
													{isHindi ? "एक करें…" : "Merge…"}
												</ActionBtn>
											)}
											{hideBtn(
												[d.key],
												isHindi ? "अलग लोग हैं" : "Different people",
											)}
										</div>
									</IssueCard>
								);
							})}

						{c === "repeated" &&
							issues.repeated.slice(0, shown).map((r) => {
								const owner = byUid.get(r.uid);
								const keep = memberOf(r.uid, r.keepId);
								const rep = memberOf(r.uid, r.repeatId);
								return (
									<IssueCard key={r.key}>
										<p className="text-xs text-slate-600 dark:text-slate-300">
											{isHindi
												? `${personName(owner)} की प्रोफ़ाइल में “${keep?.realName}” दो बार है।`
												: `“${keep?.realName}” is twice in ${personName(owner)}'s profile.`}
										</p>
										<PersonRow
											person={keep}
											isHindi={isHindi}
											sub={
												<>
													{memberSub(keep)} ·{" "}
													<b>{isHindi ? "रहेगा" : "stays"}</b>
												</>
											}
										/>
										<PersonRow
											person={rep}
											uid={r.uid}
											memberId={r.repeatId}
											isHindi={isHindi}
											sub={
												<>
													{memberSub(rep)} ·{" "}
													<b className="text-red-500">
														{isHindi ? "हटेगा" : "removed"}
													</b>
												</>
											}
											onClosed={(ch) => ch && refresh([r.uid])}
										/>
										<div className="flex flex-wrap gap-2">
											<ActionBtn
												tone="primary"
												disabled={working(r.key)}
												onClick={() =>
													run(
														r.key,
														() =>
															removeMembers(r.uid, [r.repeatId], {
																keepId: r.keepId,
																fromId: r.repeatId,
															}),
														[r.uid],
														isHindi
															? "दोहराया हटा दिया ✅"
															: "Repeat removed ✅",
													)
												}
											>
												{working(r.key) ? (
													<Loader2 size={14} className="animate-spin" />
												) : (
													<Trash2 size={14} />
												)}
												{isHindi ? "दूसरा हटाएँ" : "Remove the repeat"}
											</ActionBtn>
											{hideBtn(
												[r.key],
												isHindi ? "दोनों अलग हैं" : "Two different people",
											)}
										</div>
									</IssueCard>
								);
							})}

						{c === "alsoLinked" &&
							issues.alsoLinked.slice(0, shown).map((r) => {
								const owner = byUid.get(r.uid);
								const m = memberOf(r.uid, r.memberId);
								const linked = byUid.get(r.linkedUid);
								return (
									<IssueCard key={r.key}>
										<p className="text-xs text-slate-600 dark:text-slate-300">
											{isHindi
												? `${personName(owner)} ने “${m?.realName}” को हाथ से भी जोड़ा है, जबकि उनका खाता लिंक है — वे दो बार दिखते हैं।`
												: `${personName(owner)} added “${m?.realName}” by hand, but their account is linked too — they show twice.`}
										</p>
										<PersonRow
											person={m}
											uid={r.uid}
											memberId={r.memberId}
											isHindi={isHindi}
											sub={
												<>
													{memberSub(m)} ·{" "}
													{isHindi ? "हाथ से जोड़ा" : "added by hand"}
												</>
											}
										/>
										<PersonRow
											person={linked}
											uid={r.linkedUid}
											isHindi={isHindi}
											sub={
												isHindi
													? "🔗 लिंक खाता — रहेगा"
													: "🔗 Linked account — stays"
											}
										/>
										<div className="flex flex-wrap gap-2">
											<ActionBtn
												tone="primary"
												disabled={working(r.key)}
												onClick={() =>
													run(
														r.key,
														() =>
															dropTwinMember(r.uid, r.memberId, r.linkedUid),
														[r.uid],
														isHindi
															? "हाथ वाला हटा दिया ✅"
															: "Hand-added copy removed ✅",
													)
												}
											>
												{working(r.key) ? (
													<Loader2 size={14} className="animate-spin" />
												) : (
													<Trash2 size={14} />
												)}
												{isHindi
													? "हाथ वाला हटाएँ"
													: "Remove the hand-added copy"}
											</ActionBtn>
											{hideBtn(
												[r.key],
												isHindi ? "दोनों अलग हैं" : "Two different people",
											)}
										</div>
									</IssueCard>
								);
							})}

						{c === "hasAccount" &&
							issues.hasAccount.slice(0, shown).map((r) => {
								const owner = byUid.get(r.uid);
								const m = memberOf(r.uid, r.memberId);
								const acct = byUid.get(r.accountUid);
								const rel = m?.relation || "";
								const back = r.reverseMemberId
									? memberOf(r.accountUid, r.reverseMemberId)
									: undefined;
								const relBack = back?.relation || "";
								const dropCopies = async () => {
									await removeMembers(r.uid, [r.memberId]);
									if (r.reverseMemberId)
										await removeMembers(r.accountUid, [r.reverseMemberId]);
								};
								return (
									<IssueCard key={r.key}>
										<p className="text-xs text-slate-600 dark:text-slate-300">
											{isHindi
												? `${personName(owner)} ने “${m?.realName}” को हाथ से जोड़ा है, पर ऐप पर उनकी अपनी प्रोफ़ाइल है (नाम और दीक्षा तिथि मिलती है)। दोनों खाते लिंक नहीं हैं।`
												: `${personName(owner)} added “${m?.realName}” by hand, but they have their own profile (name and diksha date match). The accounts are not linked.`}
											{back &&
												(isHindi
													? ` ${personName(acct)} ने भी ${personName(owner)} को हाथ से जोड़ा है — एक लिंक से दोनों ठीक होंगे।`
													: ` ${personName(acct)} also added ${personName(owner)} by hand — one link fixes both.`)}
										</p>
										<PersonRow
											person={owner}
											uid={r.uid}
											isHindi={isHindi}
											sub={details(owner)}
										/>
										<PersonRow
											person={acct}
											uid={r.accountUid}
											isHindi={isHindi}
											sub={
												<>
													{rel ? `${getRelationLabel(rel, isHindi)} · ` : ""}
													{details(acct)}
												</>
											}
										/>
										<div className="flex flex-wrap gap-2">
											<ActionBtn
												tone="primary"
												disabled={working(r.key)}
												onClick={() =>
													run(
														r.key,
														async () => {
															await linkAccounts(
																r.uid,
																r.accountUid,
																rel,
																relBack,
															);
															await dropCopies();
														},
														[r.uid, r.accountUid],
														isHindi
															? "लिंक कर दिया, हाथ वाला हटाया ✅"
															: "Linked, hand-added copy removed ✅",
													)
												}
											>
												{working(r.key) ? (
													<Loader2 size={14} className="animate-spin" />
												) : (
													<Link size={14} />
												)}
												{isHindi
													? back
														? "लिंक करें + दोनों हाथ वाले हटाएँ"
														: "लिंक करें + हाथ वाला हटाएँ"
													: back
														? "Link + remove both copies"
														: "Link + remove the copy"}
											</ActionBtn>
											<ActionBtn
												disabled={!!busy}
												onClick={() =>
													run(
														r.key,
														() =>
															linkAccounts(r.uid, r.accountUid, rel, relBack),
														[r.uid, r.accountUid],
														isHindi ? "लिंक कर दिया ✅" : "Linked ✅",
													)
												}
											>
												<Link size={14} />
												{isHindi ? "सिर्फ़ लिंक करें" : "Link only"}
											</ActionBtn>
											{hideBtn(
												[r.key],
												isHindi ? "अलग व्यक्ति हैं" : "Different person",
											)}
										</div>
									</IssueCard>
								);
							})}

						{c === "sharedCopies" &&
							issues.sharedCopies.slice(0, shown).map((s) => {
								const first = memberOf(s.copies[0].uid, s.copies[0].memberId);
								const keeper = byUid.get(s.copies[0].uid);
								return (
									<IssueCard key={s.key}>
										<p className="text-xs text-slate-600 dark:text-slate-300">
											{isHindi
												? `“${first?.realName}” को ${s.copies.length} रिश्तेदारों ने अपनी-अपनी प्रोफ़ाइल में जोड़ा है:`
												: `“${first?.realName}” was added by ${s.copies.length} relatives, each in their own profile:`}
										</p>
										{s.copies.map((cp, i) => {
											const owner = byUid.get(cp.uid);
											const m = memberOf(cp.uid, cp.memberId);
											return (
												<PersonRow
													key={`${cp.uid}/${cp.memberId}`}
													person={{ ...m, realName: personName(owner) }}
													uid={cp.uid}
													memberId={cp.memberId}
													isHindi={isHindi}
													sub={
														<>
															{isHindi ? "उनके लिए" : "for them"}:{" "}
															{getRelationLabel(m?.relation, isHindi) || "—"}
															{i === 0 && s.canTidy
																? ` · ${isHindi ? "रहेगा" : "stays"}`
																: ""}
														</>
													}
												/>
											);
										})}
										{s.canTidy && (
											<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
												{isHindi
													? `सिर्फ़ ${personName(keeper)} के पास रखने पर भी बाकी सबको यह “परिवार द्वारा जोड़े गए” में दिखेगा (नए ऐप अपडेट में), रिश्ता अपने-आप निकलेगा।`
													: `Kept only with ${personName(keeper)}, the others still see them under “Added by your family” (new app update), with the relation worked out.`}
											</p>
										)}
										<div className="flex flex-wrap gap-2">
											{s.canTidy && (
												<ActionBtn
													tone="primary"
													disabled={working(s.key)}
													onClick={() =>
														run(
															s.key,
															async () => {
																for (const cp of s.copies.slice(1))
																	await removeMembers(cp.uid, [cp.memberId]);
															},
															s.copies.map((x) => x.uid),
															isHindi
																? "एक जगह रखा ✅"
																: "Kept in one place ✅",
														)
													}
												>
													{working(s.key) ? (
														<Loader2 size={14} className="animate-spin" />
													) : (
														<Wand2 size={14} />
													)}
													{isHindi
														? `सिर्फ़ ${personName(keeper)} के पास रखें`
														: `Keep only with ${personName(keeper)}`}
												</ActionBtn>
											)}
											{hideBtn(
												[s.key],
												isHindi ? "ऐसे ही रहने दें" : "Leave as is",
											)}
										</div>
									</IssueCard>
								);
							})}

						{/* Links to a missing / removed / merged account: one card per
						    account, however many profiles still point at it. */}
						{c === "brokenLinks" &&
							deadLinkGroups(issues.brokenLinks).map((g) => {
								const other = byUid.get(g.otherUid);
								const target = g.mergedInto
									? byUid.get(g.mergedInto)
									: undefined;
								const names = g.items.map((b) => personName(byUid.get(b.uid)));
								const fixAll = () =>
									run(
										g.key,
										async () => {
											for (const b of g.items)
												if (g.kind === "merged" && g.mergedInto)
													await relinkToMerged(
														b.uid,
														b.otherUid,
														g.mergedInto,
														byUid.get(b.uid)?.linkedFamilyRelations?.[
															b.otherUid
														] || "",
													);
												else await removeLinkEntry(b.uid, b.otherUid);
										},
										[
											...g.items.map((b) => b.uid),
											...(g.mergedInto ? [g.mergedInto] : []),
										],
										isHindi ? "ठीक कर दिया ✅" : "Fixed ✅",
									);
								return (
									<IssueCard key={g.key}>
										<p className="text-xs text-slate-600 dark:text-slate-300">
											{g.kind === "missing"
												? isHindi
													? `${names.length} लोग एक ऐसे खाते से लिंक हैं जो अब है ही नहीं (खाता पूरी तरह हटाया जा चुका है)।`
													: `${names.length} profile(s) are linked to an account that no longer exists (it was deleted).`
												: g.kind === "deleted"
													? isHindi
														? `${names.length} लोग ${personName(other)} के हटाए गए खाते से लिंक हैं।`
														: `${names.length} profile(s) are linked to ${personName(other)}'s removed account.`
													: isHindi
														? `${names.length} लोग ${personName(other)} की पुरानी प्रोफ़ाइल से लिंक हैं, जो ${personName(target)} में मिला दी गई थी।`
														: `${names.length} profile(s) are linked to an old profile of ${personName(other)}, merged into ${personName(target)}.`}
										</p>
										<p className="text-[12px] font-medium text-slate-700 dark:text-slate-200 leading-snug">
											{names.join(", ")}
										</p>
										<p className="text-[11px] text-slate-400 break-all">
											{isHindi ? "खाता" : "Account"}: {g.otherUid}
										</p>
										<div className="flex flex-wrap gap-2">
											<ActionBtn
												tone="primary"
												disabled={working(g.key)}
												onClick={fixAll}
											>
												{working(g.key) ? (
													<Loader2 size={14} className="animate-spin" />
												) : g.kind === "merged" ? (
													<Link size={14} />
												) : (
													<Link2Off size={14} />
												)}
												{g.kind === "merged"
													? isHindi
														? "सबको सही खाते से जोड़ें"
														: "Link everyone to the right account"
													: isHindi
														? "सबसे यह टूटा लिंक हटाएँ"
														: "Remove this broken link everywhere"}
											</ActionBtn>
											{hideBtn(
												g.items.map((b) => b.key),
												isHindi ? "समस्या नहीं" : "Not a problem",
											)}
										</div>
									</IssueCard>
								);
							})}

						{c === "brokenLinks" &&
							issues.brokenLinks
								.filter((b) => b.kind === "self" || b.kind === "one_sided")
								.slice(0, shown)
								.map((b) => {
									const owner = byUid.get(b.uid);
									const other = byUid.get(b.otherUid);
									const target = b.mergedInto
										? byUid.get(b.mergedInto)
										: undefined;
									const text = {
										self: isHindi
											? `${personName(owner)} ख़ुद से लिंक हैं।`
											: `${personName(owner)} is linked to themselves.`,
										missing: isHindi
											? `${personName(owner)} एक ऐसे खाते से लिंक हैं जो अब है ही नहीं।`
											: `${personName(owner)} is linked to an account that no longer exists.`,
										deleted: isHindi
											? `${personName(owner)} एक हटाए गए खाते (${personName(other)}) से लिंक हैं।`
											: `${personName(owner)} is linked to a removed account (${personName(other)}).`,
										merged: isHindi
											? `${personName(owner)} का लिंक ${personName(other)} की पुरानी प्रोफ़ाइल से है, जो ${personName(target)} में मिला दी गई थी।`
											: `${personName(owner)} is linked to an old profile of ${personName(other)}, merged into ${personName(target)}.`,
										one_sided: isHindi
											? `${personName(owner)} की सूची में ${personName(other)} हैं, पर ${personName(other)} की सूची में ${personName(owner)} नहीं — लिंक अधूरा है।`
											: `${personName(owner)} lists ${personName(other)}, but not the other way round — a half link.`,
									}[b.kind];
									return (
										<IssueCard key={b.key}>
											<p className="text-xs text-slate-600 dark:text-slate-300">
												{text}
											</p>
											<PersonRow
												person={owner}
												uid={b.uid}
												isHindi={isHindi}
												sub={mandalLabel(owner, isHindi)}
											/>
											{b.kind === "one_sided" && (
												<PersonRow
													person={other}
													uid={b.otherUid}
													isHindi={isHindi}
													sub={mandalLabel(other, isHindi)}
												/>
											)}
											<div className="flex flex-wrap gap-2">
												{b.kind === "merged" && b.mergedInto ? (
													<ActionBtn
														tone="primary"
														disabled={working(b.key)}
														onClick={() =>
															run(
																b.key,
																() =>
																	relinkToMerged(
																		b.uid,
																		b.otherUid,
																		b.mergedInto!,
																		owner?.linkedFamilyRelations?.[
																			b.otherUid
																		] || "",
																	),
																[b.uid, b.mergedInto!],
																isHindi
																	? "सही खाते से जोड़ दिया ✅"
																	: "Linked to the right account ✅",
															)
														}
													>
														<Link size={14} />
														{isHindi
															? "सही खाते से जोड़ें"
															: "Link the right account"}
													</ActionBtn>
												) : b.kind === "one_sided" ? (
													<>
														<ActionBtn
															tone="primary"
															disabled={working(b.key)}
															onClick={() =>
																run(
																	b.key,
																	() =>
																		linkAccounts(
																			b.uid,
																			b.otherUid,
																			owner?.linkedFamilyRelations?.[
																				b.otherUid
																			] || "",
																		),
																	[b.uid, b.otherUid],
																	isHindi
																		? "पूरा लिंक कर दिया ✅"
																		: "Linked both ways ✅",
																)
															}
														>
															<Link size={14} />
															{isHindi ? "दोनों तरफ़ जोड़ें" : "Link both ways"}
														</ActionBtn>
														<ActionBtn
															tone="danger"
															disabled={!!busy}
															onClick={() =>
																run(
																	b.key,
																	() => removeLinkEntry(b.uid, b.otherUid),
																	[b.uid],
																	isHindi ? "लिंक हटा दिया" : "Link removed",
																)
															}
														>
															<Link2Off size={14} />
															{isHindi ? "लिंक हटाएँ" : "Remove link"}
														</ActionBtn>
													</>
												) : (
													<ActionBtn
														tone="primary"
														disabled={working(b.key)}
														onClick={() =>
															run(
																b.key,
																() => removeLinkEntry(b.uid, b.otherUid),
																[b.uid],
																isHindi
																	? "टूटा लिंक हटाया ✅"
																	: "Broken link removed ✅",
															)
														}
													>
														<Link2Off size={14} />
														{isHindi
															? "टूटा लिंक हटाएँ"
															: "Remove the broken link"}
													</ActionBtn>
												)}
												{hideBtn(
													[b.key],
													isHindi ? "समस्या नहीं" : "Not a problem",
												)}
											</div>
										</IssueCard>
									);
								})}
					</ul>
				)}
				{list.length > items.length && (
					<button
						type="button"
						onClick={() => setShown((n) => n + PAGE)}
						className="w-full min-h-touch rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300"
					>
						{isHindi
							? `और दिखाएँ (${list.length - items.length})`
							: `Show more (${list.length - items.length})`}
					</button>
				)}
			</div>
		);
	};

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-3xl mx-auto p-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
				<div className="flex items-center gap-2">
					{cat || view === "hidden" ? (
						<button
							type="button"
							onClick={() => (cat ? setCat(null) : setView("open"))}
							className="min-h-touch px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300"
						>
							← {isHindi ? "सभी" : "All"}
						</button>
					) : null}
					<p className="flex-1 min-w-0 text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
						{view === "hidden" && (
							<EyeOff
								size={14}
								className="inline -mt-0.5 mr-1 text-slate-400"
							/>
						)}
						{cat
							? isHindi
								? CATS.find((x) => x.id === cat)?.hi
								: CATS.find((x) => x.id === cat)?.en
							: view === "hidden"
								? isHindi
									? `${total} छिपी हुई बातें`
									: `${total} hidden item${total === 1 ? "" : "s"}`
								: isHindi
									? `${total} बातें देखनी हैं`
									: `${total} thing${total === 1 ? "" : "s"} to look at`}
					</p>
					<button
						type="button"
						onClick={() => {
							load();
							logins.refresh();
						}}
						disabled={loading || !!busy}
						aria-label={isHindi ? "ताज़ा करें" : "Refresh"}
						className="min-w-touch min-h-touch flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50"
					>
						<RefreshCw size={18} className={loading ? "animate-spin" : ""} />
					</button>
				</div>

				{error && (
					<p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
						{isHindi
							? "प्रोफ़ाइल नहीं आ सकीं — इंटरनेट या लॉगिन जाँचें"
							: "Could not load profiles — check internet or login"}
					</p>
				)}

				{cat ? (
					renderList(cat)
				) : (
					<>
						<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
							{view === "hidden"
								? isHindi
									? "जिन्हें किसी एडमिन ने “समस्या नहीं” माना था। दोबारा देखें — ज़रूरत हो तो यहीं से ठीक करें, या “वापस लाएँ” दबाकर फिर से सूची में लाएँ।"
									: "Items an admin marked “not a problem”. Look again — fix one right here, or press “Bring back” to put it in the open list again."
								: isHindi
									? "भक्तों की प्रोफ़ाइल में जो दोहराया गया या टूटा है, वह यहाँ अपने-आप मिलता है। हर एक खोलकर देखें और ठीक करें — या “समस्या नहीं” दबाएँ, तो वह “छिपी हुई बातें” में चला जाएगा (वहाँ से कभी भी वापस ला सकते हैं)।"
									: "What is doubled or broken in devotee profiles is found here. Open each one and fix it — or press “Not a problem” to move it to “Hidden items” (you can bring it back any time)."}
						</p>
						{view === "open" && isSuperAdmin && !logins.map && (
							<p className="text-[11px] text-amber-700 dark:text-amber-400">
								{logins.loading
									? isHindi
										? "लॉगिन जानकारी आ रही है…"
										: "Loading login details…"
									: isHindi
										? "लॉगिन जानकारी नहीं मिली — लॉगिन वाले फ़ोन/ईमेल से मिलने वाली दोहरी प्रोफ़ाइल छूट सकती हैं।"
										: "Login details not loaded — duplicates found only through the login phone/email may be missed."}
							</p>
						)}
						{view === "open" && (
							<FamilyGroupsReport profiles={profiles} isHindi={isHindi} />
						)}
						<ul className="space-y-2">
							{CATS.map((c) => {
								const n = count(c.id);
								return (
									<li key={c.id}>
										<button
											type="button"
											onClick={() => {
												setCat(c.id);
												setShown(PAGE);
											}}
											className="w-full text-left p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 active:scale-[0.99] transition"
										>
											<span
												className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
													n
														? view === "hidden"
															? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
															: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
														: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
												}`}
											>
												{c.icon}
											</span>
											<span className="flex-1 min-w-0">
												<span className="block text-sm font-bold text-slate-800 dark:text-white">
													{isHindi ? c.hi : c.en}
												</span>
												<span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
													{isHindi ? c.hiDesc : c.enDesc}
												</span>
											</span>
											<span
												className={`shrink-0 min-w-[2rem] text-center text-sm font-bold rounded-full px-2 py-0.5 ${
													n
														? view === "hidden"
															? "bg-slate-500 text-white"
															: "bg-amber-500 text-white"
														: "text-emerald-600 dark:text-emerald-400"
												}`}
											>
												{n || (view === "hidden" ? "0" : "✓")}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
						{view === "open" && hiddenTotal > 0 && (
							<button
								type="button"
								onClick={() => {
									setView("hidden");
									setShown(PAGE);
								}}
								className="w-full min-h-touch p-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center gap-3 text-left active:scale-[0.99] transition"
							>
								<EyeOff size={18} className="shrink-0 text-slate-400" />
								<span className="flex-1 min-w-0 text-sm font-bold text-slate-600 dark:text-slate-300">
									{isHindi
										? `छिपी हुई बातें देखें (${hiddenTotal})`
										: `See hidden items (${hiddenTotal})`}
									<span className="block text-[11px] font-normal text-slate-400">
										{isHindi
											? "जिन्हें “समस्या नहीं” माना गया — दोबारा देखें या वापस लाएँ"
											: "Marked “not a problem” — look again or bring back"}
									</span>
								</span>
								<span className="shrink-0 text-slate-400">›</span>
							</button>
						)}
					</>
				)}
			</div>

			{merge && (
				<MergeSheet
					a={merge.a}
					b={merge.b}
					logins={logins.map}
					isHindi={isHindi}
					onClose={() => setMerge(null)}
					onDone={() => {
						load();
						logins.refresh();
					}}
				/>
			)}
		</div>
	);
};

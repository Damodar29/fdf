import {
	collection,
	deleteField,
	doc,
	FieldPath,
	getDoc,
	getDocs,
	runTransaction,
	updateDoc,
} from "firebase/firestore";
import {
	ArrowRight,
	Check,
	EyeOff,
	Loader2,
	RefreshCw,
	RotateCcw,
	ShieldCheck,
	Wand2,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import { auth, db } from "../../../../services/firebase";
import {
	findRelationFixes,
	type RelationFix,
} from "../../../../utils/relationFixes";
import {
	autoInverseRelation,
	type Gender,
	getRelationLabel,
	suggestInverseRelations,
} from "../../../constants/relations";
import {
	type IgnoreMeta,
	ignoredBy,
	ignoreIssue,
	loadIgnored,
	unignoreIssues,
} from "../cleanup/cleanupWrites";
import {
	ActionBtn,
	IssueCard,
	PersonRow,
	personName,
	Tag,
} from "../cleanup/PersonBits";

type Tab =
	| "fill"
	| "gender"
	| "needGender"
	| "choose"
	| "chain"
	| "problems"
	| "skipped";

const TABS: {
	id: Tab;
	hi: string;
	en: string;
	hiDesc: string;
	enDesc: string;
}[] = [
	{
		id: "fill",
		hi: "पक्के",
		en: "Certain",
		hiDesc:
			"एक तरफ़ का रिश्ता और लिंग पता है, तो दूसरी तरफ़ का पक्का है (बेटी + माँ महिला ⇒ बेटी के लिए “माता”)। सब एक साथ भर सकते हैं।",
		enDesc:
			"One side's relation and gender are known, so the other side is certain (daughter + mother female ⇒ “mother”). Fill all at once.",
	},
	{
		id: "gender",
		hi: "लिंग पता है",
		en: "Gender known",
		hiDesc:
			"लिंग सेट नहीं, पर परिवार जो रिश्ते कहता है (बेटी, बहन…) सब एक ही लिंग बताते हैं। सेट करते ही और रिश्ते अपने-आप भरेंगे।",
		enDesc:
			"No gender set, but every relation the family uses (daughter, sister…) points one way. Setting it fills more relations.",
	},
	{
		id: "needGender",
		hi: "लिंग चुनें",
		en: "Pick gender",
		hiDesc: "दूसरी तरफ़ का रिश्ता इस पर टिका है कि रिश्ता चुनने वाला पुरुष है या महिला।",
		enDesc:
			"The other side depends on whether the one who set the relation is male or female.",
	},
	{
		id: "choose",
		hi: "रिश्ता चुनें",
		en: "Pick relation",
		hiDesc: "कई जवाब हो सकते हैं (भतीजा ⇒ चाचा या ताऊ) — सही वाला चुनें।",
		enDesc:
			"Several answers are possible (bhatija ⇒ chacha or tau) — pick the right one.",
	},
	{
		id: "chain",
		hi: "संभावित",
		en: "Likely",
		hiDesc:
			"दोनों ने रिश्ता नहीं चुना, पर बीच के रिश्तेदार से अंदाज़ा है (माँ का बेटा ⇒ भाई)। देखकर पुष्टि करें।",
		enDesc:
			"Neither side set, but a relative in between suggests it (mother's son ⇒ brother). Check and confirm.",
	},
	{
		id: "problems",
		hi: "गड़बड़",
		en: "Problems",
		hiDesc: "दोनों तरफ़ के रिश्ते आपस में नहीं मिलते, या रिश्ता सेट लिंग से उल्टा है।",
		enDesc: "The two sides don't fit, or a relation contradicts a set gender.",
	},
	{
		id: "skipped",
		hi: "छोड़े गए",
		en: "Skipped",
		hiDesc:
			"जिन्हें किसी एडमिन ने “छोड़ें” किया था। दोबारा सोचें — सही लगे तो यहीं से भरें, या “वापस लाएँ” से अपनी सूची में लौटाएँ।",
		enDesc:
			"Ones an admin skipped. Think again — fill one right here if it is right, or “Bring back” returns it to its list.",
	},
];

type FixTab = Exclude<Tab, "skipped">;

const tabOf = (f: RelationFix): FixTab =>
	f.kind === "conflict" || f.kind === "mixedGender" ? "problems" : f.kind;

const PAGE = 30;

const userRef = (uid: string) => doc(db, "users", uid);

/**
 * `owner`'s relation for `other`. `auto`: worked out, recorded in
 * linkedFamilyRelationsAuto like the Cloud Function does; otherwise a
 * choice. `onlyIfEmpty`: skip when one was set meanwhile.
 */
async function setRelation(
	owner: string,
	other: string,
	value: string,
	auto: boolean,
	onlyIfEmpty = false,
): Promise<boolean> {
	return runTransaction(db, async (tx) => {
		const snap = await tx.get(userRef(owner));
		if (!snap.exists()) return false;
		if (onlyIfEmpty && snap.data().linkedFamilyRelations?.[other]) return false;
		tx.update(
			userRef(owner),
			new FieldPath("linkedFamilyRelations", other),
			value,
			new FieldPath("linkedFamilyRelationsAuto", other),
			auto ? value : deleteField(),
		);
		return true;
	});
}

async function removeRelation(owner: string, other: string) {
	await updateDoc(
		userRef(owner),
		new FieldPath("linkedFamilyRelations", other),
		deleteField(),
		new FieldPath("linkedFamilyRelationsAuto", other),
		deleteField(),
	);
}

const setGender = (uid: string, gender: Gender) =>
	updateDoc(userRef(uid), { gender });

/**
 * Admin → Community Manager → "Fix relations": relations between linked
 * devotees that can be filled in from what is already saved
 * (utils/relationFixes.ts) — the certain ones in bulk, the rest one by one.
 * Reads the users list once; after a fix only the touched profiles again.
 */
export const RelationFixManager: React.FC<{ isHindi: boolean }> = ({
	isHindi,
}) => {
	const { showToast } = useToast();
	const [profiles, setProfiles] = useState<UserProfile[] | null>(null);
	const [ignoredMeta, setIgnoredMeta] = useState<Record<string, IgnoreMeta>>(
		{},
	);
	const ignored = useMemo(
		() => new Set(Object.keys(ignoredMeta)),
		[ignoredMeta],
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [tab, setTab] = useState<Tab | null>(null);
	const [shown, setShown] = useState(PAGE);
	const [busy, setBusy] = useState<string | null>(null);

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
			console.error("[Relations] load failed", e);
			setError(true);
			setProfiles((p) => p ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const refresh = async (uids: string[]) => {
		const fresh = await Promise.all(
			[...new Set(uids)].map(async (uid) => {
				const s = await getDoc(userRef(uid));
				return s.exists() ? { ...(s.data() as UserProfile), uid } : null;
			}),
		);
		setProfiles((list) => {
			if (!list) return list;
			const m = new Map(list.map((p) => [p.uid, p]));
			for (const p of fresh) if (p) m.set(p.uid, p);
			return [...m.values()];
		});
	};

	const byUid = useMemo(
		() => new Map((profiles || []).map((p) => [p.uid, p])),
		[profiles],
	);
	const allFixes = useMemo(
		() => (profiles ? findRelationFixes(profiles) : []),
		[profiles],
	);
	const isSkipped = (f: RelationFix) => ignored.has(`rel:${f.key}`);
	// biome-ignore lint/correctness/useExhaustiveDependencies: isSkipped only reads `ignored`
	const [fixes, skipped] = useMemo(
		() => [
			allFixes.filter((f) => !isSkipped(f)),
			allFixes.filter((f) => isSkipped(f)),
		],
		[allFixes, ignored],
	);
	const counts = useMemo(() => {
		const c: Record<Tab, number> = {
			fill: 0,
			gender: 0,
			needGender: 0,
			choose: 0,
			chain: 0,
			problems: 0,
			skipped: skipped.length,
		};
		for (const f of fixes) c[tabOf(f)]++;
		return c;
	}, [fixes, skipped]);
	const current: Tab =
		tab ??
		TABS.find((t) => t.id !== "skipped" && counts[t.id] > 0)?.id ??
		"fill";
	const list =
		current === "skipped" ? skipped : fixes.filter((f) => tabOf(f) === current);

	const name = (uid: string) => personName(byUid.get(uid));
	const rel = (r?: string) => `“${getRelationLabel(r, isHindi) || "—"}”`;
	const genderWord = (g?: string) =>
		g === "male"
			? isHindi
				? "पुरुष"
				: "male"
			: g === "female"
				? isHindi
					? "महिला"
					: "female"
				: "";

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
			console.error("[Relations] fix failed", e);
			showToast(
				isHindi
					? "सहेजा नहीं जा सका — दोबारा कोशिश करें"
					: "Could not save — try again",
				"error",
			);
		} finally {
			setBusy(null);
		}
	};

	const skip = async (key: string) => {
		const by = auth.currentUser?.email || auth.currentUser?.phoneNumber || "";
		setIgnoredMeta((m) => ({ ...m, [`rel:${key}`]: { at: Date.now(), by } }));
		try {
			await ignoreIssue(`rel:${key}`);
		} catch (e) {
			console.warn("[Relations] skip not saved", e);
			showToast(
				isHindi
					? "सिर्फ़ इस बार के लिए छोड़ा (सहेजा नहीं जा सका)"
					: "Skipped for now only (could not save)",
				"info",
			);
		}
	};

	/** A skipped one goes back to its own list, for every admin. */
	const bringBack = async (key: string) => {
		const k = `rel:${key}`;
		const before = ignoredMeta;
		setIgnoredMeta((m) => {
			const next = { ...m };
			delete next[k];
			return next;
		});
		try {
			await unignoreIssues([k]);
			showToast(
				isHindi ? "वापस अपनी सूची में आ गया" : "Back in its list",
				"success",
			);
		} catch (e) {
			console.error("[Relations] unskip failed", e);
			setIgnoredMeta(before);
			showToast(
				isHindi
					? "सहेजा नहीं जा सका, दोबारा कोशिश करें"
					: "Could not save, try again",
				"error",
			);
		}
	};

	const runAll = async (
		items: RelationFix[],
		what: "fill" | "gender" | "chain",
	) => {
		if (
			!confirm(
				what === "chain"
					? isHindi
						? `${items.length} संभावित रिश्ते (जिनका एक ही जवाब है) भरे जाएँगे। ये अंदाज़े हैं — पहले सूची एक बार देख लें। जो पहले से भरा है वह नहीं बदलेगा। आगे बढ़ें?`
						: `${items.length} likely relations (one answer each) will be filled. These are guesses — look through the list first. Nothing already set is changed. Continue?`
					: isHindi
						? `${items.length} ${what === "fill" ? "रिश्ते भरे" : "लोगों का लिंग सेट"} होंगे। जो पहले से भरा है वह नहीं बदलेगा। आगे बढ़ें?`
						: `${items.length} ${what === "fill" ? "relations will be filled" : "genders will be set"}. Nothing already set is changed. Continue?`,
			)
		)
			return;
		setBusy("all");
		let ok = 0;
		const touched: string[] = [];
		for (const f of items) {
			try {
				if (f.kind === "fill") {
					if (
						await setRelation(
							f.write.owner,
							f.write.other,
							f.write.value,
							true,
							true,
						)
					)
						ok++;
					touched.push(f.write.owner);
				} else if (f.kind === "gender") {
					await setGender(f.uid, f.gender);
					ok++;
					touched.push(f.uid);
				} else if (f.kind === "chain" && f.options.length === 1) {
					if (await setRelation(f.owner, f.other, f.options[0], false, true))
						ok++;
					touched.push(f.owner, f.other);
				}
			} catch (e) {
				console.warn("[Relations] one failed", f.key, e);
			}
		}
		await refresh(touched).catch(() => {});
		setBusy(null);
		showToast(
			isHindi ? `${ok} सहेजे ✅` : `${ok} saved ✅`,
			ok > 0 ? "success" : "error",
		);
	};

	if (!profiles)
		return (
			<div className="flex-1 flex items-center justify-center p-10">
				<Loader2 className="animate-spin text-violet-500" size={32} />
			</div>
		);

	const working = (key: string) => busy === key || busy === "all";
	const spin = (key: string, icon: React.ReactNode) =>
		working(key) ? <Loader2 size={14} className="animate-spin" /> : icon;

	const skipBtn = (key: string, label?: string) => {
		if (!ignored.has(`rel:${key}`))
			return (
				<ActionBtn disabled={!!busy} onClick={() => skip(key)}>
					<Check size={14} />
					{label || (isHindi ? "छोड़ें" : "Skip")}
				</ActionBtn>
			);
		const by = ignoredBy(ignoredMeta[`rel:${key}`], isHindi);
		return (
			<>
				<ActionBtn disabled={!!busy} onClick={() => bringBack(key)}>
					<RotateCcw size={14} />
					{isHindi ? "वापस लाएँ" : "Bring back"}
				</ActionBtn>
				{by && (
					<span className="self-center text-[11px] text-slate-400">
						{isHindi ? "छोड़ा: " : "Skipped by: "}
						{by}
					</span>
				)}
			</>
		);
	};

	const renderFix = (f: RelationFix) => {
		switch (f.kind) {
			case "fill":
				return (
					<IssueCard key={f.key}>
						<p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">
							<b>{name(f.from)}</b>
							{byUid.get(f.from)?.gender
								? ` (${genderWord(byUid.get(f.from)?.gender)})`
								: ""}
							{isHindi ? " ने " : " calls "}
							<b>{name(f.to)}</b>
							{isHindi
								? ` को ${rel(f.relation)} चुना है`
								: ` their ${rel(f.relation)}`}
						</p>
						<p className="text-[13px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 flex-wrap">
							<ArrowRight size={14} />
							{isHindi
								? `तो ${name(f.to)} के लिए ${name(f.from)}: ${rel(f.write.value)}`
								: `so for ${name(f.to)}, ${name(f.from)} is ${rel(f.write.value)}`}
						</p>
						<div className="flex flex-wrap gap-2">
							<ActionBtn
								tone="primary"
								disabled={working(f.key)}
								onClick={() =>
									run(
										f.key,
										() =>
											setRelation(
												f.write.owner,
												f.write.other,
												f.write.value,
												true,
												true,
											),
										[f.write.owner],
										isHindi ? "रिश्ता भरा ✅" : "Relation filled ✅",
									)
								}
							>
								{spin(f.key, <Wand2 size={14} />)}
								{isHindi ? "भरें" : "Fill"}
							</ActionBtn>
							{skipBtn(f.key, isHindi ? "गलत है, छोड़ें" : "Wrong, skip")}
						</div>
					</IssueCard>
				);
			case "gender": {
				const other: Gender = f.gender === "male" ? "female" : "male";
				return (
					<IssueCard key={f.key}>
						<PersonRow
							person={byUid.get(f.uid)}
							uid={f.uid}
							isHindi={isHindi}
						/>
						<p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">
							{f.because
								.map((b) => `${name(b.from)}: ${rel(b.relation)}`)
								.join(", ")}
						</p>
						<p className="text-[13px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
							<ArrowRight size={14} />
							{genderWord(f.gender)}
						</p>
						<div className="flex flex-wrap gap-2">
							<ActionBtn
								tone="primary"
								disabled={working(f.key)}
								onClick={() =>
									run(
										f.key,
										() => setGender(f.uid, f.gender),
										[f.uid],
										isHindi ? "लिंग सेट ✅" : "Gender set ✅",
									)
								}
							>
								{spin(f.key, <Check size={14} />)}
								{isHindi
									? `${genderWord(f.gender)} सेट करें`
									: `Set ${genderWord(f.gender)}`}
							</ActionBtn>
							<ActionBtn
								disabled={!!busy}
								onClick={() =>
									run(
										f.key,
										() => setGender(f.uid, other),
										[f.uid],
										isHindi ? "लिंग सेट ✅" : "Gender set ✅",
									)
								}
							>
								{isHindi
									? `नहीं, ${genderWord(other)}`
									: `No, ${genderWord(other)}`}
							</ActionBtn>
						</div>
					</IssueCard>
				);
			}
			case "needGender":
				return (
					<IssueCard key={f.key}>
						<p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">
							<b>{name(f.uid)}</b>
							{isHindi ? " ने " : " calls "}
							<b>{name(f.to)}</b>
							{isHindi
								? ` को ${rel(f.relation)} चुना है।`
								: ` their ${rel(f.relation)}.`}{" "}
							{isHindi
								? `${name(f.uid)} का लिंग सेट नहीं है:`
								: `${name(f.uid)}'s gender is not set:`}
						</p>
						<ul className="text-[12px] text-slate-600 dark:text-slate-300 space-y-0.5">
							<li>
								{isHindi ? "पुरुष हों" : "If male"} → {name(f.to)}
								{isHindi ? " के लिए " : ": "}
								{rel(f.ifMale)}
							</li>
							<li>
								{isHindi ? "महिला हों" : "If female"} → {name(f.to)}
								{isHindi ? " के लिए " : ": "}
								{rel(f.ifFemale)}
							</li>
						</ul>
						{f.hint && (
							<Tag tone="violet">
								{isHindi
									? `परिवार के रिश्तों से: ${genderWord(f.hint)}`
									: `Family relations say: ${genderWord(f.hint)}`}
							</Tag>
						)}
						<div className="flex flex-wrap gap-2">
							{(["male", "female"] as const).map((g) => (
								<ActionBtn
									key={g}
									tone={f.hint === g ? "primary" : "soft"}
									disabled={working(f.key)}
									onClick={() =>
										run(
											f.key,
											async () => {
												await setGender(f.uid, g);
												await setRelation(
													f.to,
													f.uid,
													g === "male" ? f.ifMale : f.ifFemale,
													true,
													true,
												);
											},
											[f.uid, f.to],
											isHindi
												? "लिंग और रिश्ता सेट ✅"
												: "Gender and relation set ✅",
										)
									}
								>
									{spin(f.key, <Check size={14} />)}
									{genderWord(g)}
								</ActionBtn>
							))}
							{skipBtn(f.key)}
						</div>
					</IssueCard>
				);
			case "choose":
				return (
					<IssueCard key={f.key}>
						<p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">
							<b>{name(f.from)}</b>
							{isHindi ? " ने " : " calls "}
							<b>{name(f.to)}</b>
							{isHindi
								? ` को ${rel(f.relation)} चुना है।`
								: ` their ${rel(f.relation)}.`}{" "}
							{isHindi
								? `${name(f.to)} के लिए ${name(f.from)} क्या हैं?`
								: `What is ${name(f.from)} to ${name(f.to)}?`}
						</p>
						<div className="flex flex-wrap gap-2">
							{f.options.map((o) => (
								<ActionBtn
									key={o}
									disabled={working(f.key)}
									onClick={() =>
										run(
											f.key,
											() => setRelation(f.to, f.from, o, false),
											[f.to],
											isHindi ? "रिश्ता सेट ✅" : "Relation set ✅",
										)
									}
								>
									{getRelationLabel(o, isHindi)}
								</ActionBtn>
							))}
							{skipBtn(f.key)}
						</div>
					</IssueCard>
				);
			case "chain": {
				const owner = byUid.get(f.owner);
				const via = byUid.get(f.via);
				const mine = owner?.linkedFamilyRelations?.[f.via];
				const theirs = via?.linkedFamilyRelations?.[f.other];
				return (
					<IssueCard key={f.key}>
						<p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">
							{isHindi
								? `${name(f.owner)} और ${name(f.other)} ने एक-दूसरे का रिश्ता नहीं चुना। बीच में ${name(f.via)}: `
								: `${name(f.owner)} and ${name(f.other)} haven't set each other. In between, ${name(f.via)}: `}
							{mine &&
								(isHindi
									? `${name(f.owner)} के ${rel(mine)}`
									: `${name(f.owner)}'s ${rel(mine)}`)}
							{mine && theirs ? ", " : ""}
							{theirs &&
								(isHindi
									? `जिनके लिए ${name(f.other)} ${rel(theirs)}`
									: `whose ${rel(theirs)} is ${name(f.other)}`)}
						</p>
						<p className="text-[12px] text-slate-500 dark:text-slate-400">
							{isHindi
								? `${name(f.owner)} के लिए ${name(f.other)} शायद:`
								: `${name(f.other)} is probably ${name(f.owner)}'s:`}
						</p>
						<div className="flex flex-wrap gap-2">
							{f.options.map((o, i) => (
								<ActionBtn
									key={o}
									tone={i === 0 && f.options.length === 1 ? "primary" : "soft"}
									disabled={working(f.key)}
									onClick={() =>
										run(
											f.key,
											() => setRelation(f.owner, f.other, o, false),
											[f.owner, f.other],
											isHindi ? "रिश्ता सेट ✅" : "Relation set ✅",
										)
									}
								>
									{getRelationLabel(o, isHindi)}
								</ActionBtn>
							))}
							{skipBtn(f.key, isHindi ? "सही नहीं, छोड़ें" : "Not right, skip")}
						</div>
					</IssueCard>
				);
			}
			case "conflict": {
				const A = byUid.get(f.a);
				const B = byUid.get(f.b);
				if (f.reason === "gender") {
					return (
						<IssueCard key={f.key}>
							<p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">
								<b>{name(f.a)}</b>
								{isHindi ? " ने " : " calls "}
								<b>{name(f.b)}</b>
								{isHindi
									? ` को ${rel(f.ab)} चुना है, पर ${name(f.b)} का लिंग ${genderWord(B?.gender)} सेट है।`
									: ` their ${rel(f.ab)}, but ${name(f.b)} is set as ${genderWord(B?.gender)}.`}
							</p>
							<PersonRow person={A} uid={f.a} isHindi={isHindi} />
							<PersonRow person={B} uid={f.b} isHindi={isHindi} />
							<div className="flex flex-wrap gap-2">
								<ActionBtn
									disabled={working(f.key)}
									onClick={() =>
										run(
											f.key,
											() =>
												setGender(
													f.b,
													B?.gender === "male" ? "female" : "male",
												),
											[f.b],
											isHindi ? "लिंग बदला ✅" : "Gender changed ✅",
										)
									}
								>
									{isHindi
										? `${name(f.b)} का लिंग ${genderWord(B?.gender === "male" ? "female" : "male")} करें`
										: `Make ${name(f.b)} ${genderWord(B?.gender === "male" ? "female" : "male")}`}
								</ActionBtn>
								<ActionBtn
									tone="danger"
									disabled={!!busy}
									onClick={() =>
										run(
											f.key,
											() => removeRelation(f.a, f.b),
											[f.a],
											isHindi ? "रिश्ता हटाया" : "Relation removed",
										)
									}
								>
									{isHindi
										? `${name(f.a)} का चुना रिश्ता हटाएँ`
										: `Remove ${name(f.a)}'s relation`}
								</ActionBtn>
								{skipBtn(f.key)}
							</div>
						</IssueCard>
					);
				}
				const fixB = suggestInverseRelations(
					f.ab,
					A?.gender as Gender | undefined,
				);
				const fixA = suggestInverseRelations(
					f.ba,
					B?.gender as Gender | undefined,
				);
				const certainB = autoInverseRelation(
					f.ab,
					A?.gender as Gender,
					B?.gender as Gender,
				);
				const certainA = autoInverseRelation(
					f.ba,
					B?.gender as Gender,
					A?.gender as Gender,
				);
				return (
					<IssueCard key={f.key}>
						<p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">
							{isHindi
								? `${name(f.a)} कहते हैं ${name(f.b)} उनके ${rel(f.ab)} हैं, और ${name(f.b)} कहते हैं ${name(f.a)} उनके ${rel(f.ba)} — दोनों साथ सही नहीं हो सकते। जो सही है उसे चुनें:`
								: `${name(f.a)} says ${name(f.b)} is their ${rel(f.ab)}, and ${name(f.b)} says ${name(f.a)} is their ${rel(f.ba)} — both can't be right. Pick the right one:`}
						</p>
						<PersonRow
							person={A}
							uid={f.a}
							isHindi={isHindi}
							sub={genderWord(A?.gender)}
						/>
						<PersonRow
							person={B}
							uid={f.b}
							isHindi={isHindi}
							sub={genderWord(B?.gender)}
						/>
						<div className="flex flex-wrap gap-2">
							{(certainB ? [certainB] : fixB).map((o) => (
								<ActionBtn
									key={`b-${o}`}
									disabled={working(f.key)}
									onClick={() =>
										run(
											f.key,
											() => setRelation(f.b, f.a, o, false),
											[f.b],
											isHindi ? "ठीक किया ✅" : "Fixed ✅",
										)
									}
								>
									{isHindi
										? `${name(f.a)} सही: ${name(f.b)} के लिए ${rel(o)}`
										: `${name(f.a)} is right: ${rel(o)} for ${name(f.b)}`}
								</ActionBtn>
							))}
							{(certainA ? [certainA] : fixA).map((o) => (
								<ActionBtn
									key={`a-${o}`}
									disabled={working(f.key)}
									onClick={() =>
										run(
											f.key,
											() => setRelation(f.a, f.b, o, false),
											[f.a],
											isHindi ? "ठीक किया ✅" : "Fixed ✅",
										)
									}
								>
									{isHindi
										? `${name(f.b)} सही: ${name(f.a)} के लिए ${rel(o)}`
										: `${name(f.b)} is right: ${rel(o)} for ${name(f.a)}`}
								</ActionBtn>
							))}
							{skipBtn(f.key)}
						</div>
					</IssueCard>
				);
			}
			case "mixedGender":
				return (
					<IssueCard key={f.key}>
						<PersonRow
							person={byUid.get(f.uid)}
							uid={f.uid}
							isHindi={isHindi}
						/>
						<p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">
							{isHindi
								? "परिवार के रिश्ते आपस में नहीं मिलते: "
								: "The family's relations disagree: "}
							{f.because
								.map((b) => `${name(b.from)}: ${rel(b.relation)}`)
								.join(", ")}
						</p>
						<p className="text-[11px] text-slate-500 dark:text-slate-400">
							{isHindi
								? "सही लिंग सेट करें — फिर गलत रिश्ता “गड़बड़” में दिखेगा।"
								: "Set the right gender — the wrong relation then shows under Problems."}
						</p>
						<div className="flex flex-wrap gap-2">
							{(["male", "female"] as const).map((g) => (
								<ActionBtn
									key={g}
									disabled={working(f.key)}
									onClick={() =>
										run(
											f.key,
											() => setGender(f.uid, g),
											[f.uid],
											isHindi ? "लिंग सेट ✅" : "Gender set ✅",
										)
									}
								>
									{genderWord(g)}
								</ActionBtn>
							))}
							{skipBtn(f.key)}
						</div>
					</IssueCard>
				);
		}
	};

	const bulkFill = current === "fill" && list.length > 1;
	const bulkGender = current === "gender" && list.length > 1;
	const singleChains =
		current === "chain"
			? list.filter((f) => f.kind === "chain" && f.options.length === 1)
			: [];

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-3xl mx-auto p-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
				<div className="flex items-center gap-2">
					<p className="flex-1 text-xs text-slate-500 dark:text-slate-400 leading-snug">
						{isHindi
							? "जुड़े हुए भक्तों के रिश्ते, जो पहले से सहेजी जानकारी से भरे जा सकते हैं। जो कोई भक्त ख़ुद चुन चुका है, वह कभी नहीं बदलता।"
							: "Relations between linked devotees that can be filled from what is already saved. Anything a devotee chose is never changed."}
					</p>
					<button
						type="button"
						onClick={load}
						disabled={loading || !!busy}
						aria-label={isHindi ? "ताज़ा करें" : "Refresh"}
						className="shrink-0 min-w-touch min-h-touch flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50"
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

				<div className="flex flex-wrap gap-1">
					{TABS.filter(
						(t) => t.id !== "skipped" || counts.skipped > 0 || current === t.id,
					).map((t) => (
						<button
							key={t.id}
							type="button"
							aria-pressed={current === t.id}
							onClick={() => {
								setTab(t.id);
								setShown(PAGE);
							}}
							className={`min-h-[36px] px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
								current === t.id
									? t.id === "skipped"
										? "bg-slate-600 text-white"
										: "bg-violet-500 text-white"
									: t.id === "skipped"
										? "border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400"
										: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
							}`}
						>
							{t.id === "skipped" && <EyeOff size={12} />}
							{isHindi ? t.hi : t.en}
							<span className="tabular-nums opacity-75">{counts[t.id]}</span>
						</button>
					))}
				</div>

				<p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">
					{isHindi
						? TABS.find((t) => t.id === current)?.hiDesc
						: TABS.find((t) => t.id === current)?.enDesc}
				</p>

				{(bulkFill || bulkGender) && (
					<div className="flex">
						<ActionBtn
							tone="primary"
							disabled={!!busy}
							onClick={() => runAll(list, bulkFill ? "fill" : "gender")}
						>
							{busy === "all" ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Wand2 size={14} />
							)}
							{bulkFill
								? isHindi
									? `सभी ${list.length} रिश्ते भरें`
									: `Fill all ${list.length}`
								: isHindi
									? `सभी ${list.length} का लिंग सेट करें`
									: `Set all ${list.length} genders`}
						</ActionBtn>
					</div>
				)}
				{singleChains.length > 1 && (
					<div className="flex">
						<ActionBtn
							disabled={!!busy}
							onClick={() => runAll(singleChains, "chain")}
						>
							{busy === "all" ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Wand2 size={14} />
							)}
							{isHindi
								? `एक-जवाब वाले सभी ${singleChains.length} भरें`
								: `Fill all ${singleChains.length} with one answer`}
						</ActionBtn>
					</div>
				)}

				{list.length === 0 ? (
					<div className="text-center py-10">
						<ShieldCheck className="mx-auto text-emerald-400 mb-2" size={36} />
						<p className="font-bold text-slate-700 dark:text-slate-200">
							{isHindi ? "यहाँ कुछ बाकी नहीं" : "Nothing left here"}
						</p>
					</div>
				) : (
					<ul className="space-y-2">{list.slice(0, shown).map(renderFix)}</ul>
				)}
				{list.length > shown && (
					<button
						type="button"
						onClick={() => setShown((n) => n + PAGE)}
						className="w-full min-h-touch rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300"
					>
						{isHindi
							? `और दिखाएँ (${list.length - shown})`
							: `Show more (${list.length - shown})`}
					</button>
				)}
			</div>
		</div>
	);
};

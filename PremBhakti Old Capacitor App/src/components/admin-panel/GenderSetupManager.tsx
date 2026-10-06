import {
	collection,
	doc,
	getDocs,
	updateDoc,
	writeBatch,
} from "firebase/firestore";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle,
	Clock,
	Layers,
	Lightbulb,
	List,
	Loader2,
	RefreshCw,
	Search,
	User,
	Wand2,
	X,
} from "lucide-react";
import type React from "react";
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	hasStartedProfile,
	type UserProfile,
} from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { db } from "../../../services/firebase";
import {
	buildSearchEntry,
	prepareDevoteeQuery,
	scoreDevotee,
} from "../../../utils/devoteeSearch";
import { type GenderGuess, guessGender } from "../../../utils/genderGuess";
import type { Gender } from "../../constants/relations";
import { MANDAL_LIST } from "../../types/mandal";
import { ThumbImg } from "../../../components/ui/ThumbImg";
import { EditProfileButton } from "./devoteeEditLink";
import { THUMB } from "../../../utils/imageThumb";

type Scope = "approved" | "all";
type Mode = "list" | "cards";
type Show = "unset" | "set" | "later" | "all";

const PAGE = 50;
const LATER_KEY = "cpbs_gender_later_v1";

const hasGender = (p: Partial<UserProfile>) =>
	p.gender === "male" || p.gender === "female";

/** "Decide later" is kept on this device, so those people aren't asked again first. */
const readLater = (): Set<string> => {
	try {
		const raw = localStorage.getItem(LATER_KEY);
		const list = raw ? JSON.parse(raw) : [];
		return new Set(
			Array.isArray(list) ? list.filter((x) => typeof x === "string") : [],
		);
	} catch {
		return new Set();
	}
};
const writeLater = (later: Set<string>) => {
	try {
		localStorage.setItem(LATER_KEY, JSON.stringify([...later]));
	} catch {
		// Storage full or blocked — only a convenience.
	}
};

/**
 * Community Manager → set devotees' gender. The gender lives on the
 * devotee's own profile (users/{uid}.gender), so it shows in their Profile at
 * once, and the syncFamilyLinkGroups function uses it to fill in family
 * relations. A suggestion (from linked family's relations or the name) is only
 * shown — the admin decides, one by one or all suggestions at once.
 *
 * Two ways to work: a list of everyone (filter set / not set / later, search,
 * change anyone's gender) and one card at a time. Whoever is set is never
 * asked again, and "later" is remembered on this device.
 */
export const GenderSetupManager: React.FC<{ isHindi: boolean }> = ({
	isHindi,
}) => {
	const { showToast } = useToast();
	const [profiles, setProfiles] = useState<UserProfile[] | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [scope, setScope] = useState<Scope>("approved");
	const [mode, setMode] = useState<Mode>("list");
	const [show, setShow] = useState<Show>("unset");
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);
	const [limit, setLimit] = useState(PAGE);
	const [later, setLater] = useState<Set<string>>(readLater);
	const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
	// Changed in this visit: they stay in view until the filter changes,
	// instead of jumping out of the "not set" list under the finger.
	const [touched, setTouched] = useState<Set<string>>(new Set());
	const [bulkSaving, setBulkSaving] = useState(false);
	// Card mode works through a fixed queue, so saving doesn't shift it.
	const [cardQueue, setCardQueue] = useState<string[]>([]);
	const [cardIndex, setCardIndex] = useState(0);

	const load = useCallback(async () => {
		setRefreshing(true);
		try {
			const snap = await getDocs(collection(db, "users"));
			setProfiles(
				snap.docs.map((d) => {
					const data = d.data() as UserProfile;
					return { ...data, uid: data.uid || d.id };
				}),
			);
		} catch (e) {
			console.error("Gender setup: users not loaded", e);
			setProfiles((p) => p ?? []);
			showToast(
				isHindi
					? "सूची लोड नहीं हो सकी — इंटरनेट देखकर ताज़ा करें"
					: "Could not load the list — check the internet and refresh",
				"error",
			);
		} finally {
			setRefreshing(false);
		}
	}, [isHindi, showToast]);

	useEffect(() => {
		load();
	}, [load]);

	// What linked family call each devotee — the strongest hint.
	const relationsAbout = useMemo(() => {
		const about = new Map<string, string[]>();
		for (const p of profiles || []) {
			for (const [uid, rel] of Object.entries(p.linkedFamilyRelations || {})) {
				if (typeof rel !== "string" || !rel) continue;
				about.set(uid, [...(about.get(uid) || []), rel]);
			}
		}
		return about;
	}, [profiles]);

	/** Everyone who can be set in this scope (real profiles, not deleted). */
	const people = useMemo(
		() =>
			(profiles || [])
				.filter(
					(p) =>
						!p.isDeleted &&
						!(p as { mergedIntoUid?: string }).mergedIntoUid &&
						(hasStartedProfile(p) ||
							(p.linkedFamilyMembers?.length ?? 0) > 0) &&
						(scope === "all" || p.isApproved),
				)
				.sort(
					(a, b) =>
						Number(!!b.isApproved) - Number(!!a.isApproved) ||
						(a.realName || "").localeCompare(b.realName || ""),
				),
		[profiles, scope],
	);

	const guesses = useMemo(() => {
		const map = new Map<string, GenderGuess>();
		for (const p of people) {
			if (hasGender(p)) continue;
			const g = guessGender(p, relationsAbout.get(p.uid) || []);
			if (g) map.set(p.uid, g);
		}
		return map;
	}, [people, relationsAbout]);

	const counts = useMemo(() => {
		let set = 0;
		let unset = 0;
		let laterN = 0;
		for (const p of people) {
			if (hasGender(p)) set++;
			else if (later.has(p.uid)) laterN++;
			else unset++;
		}
		return { set, unset, later: laterN, all: people.length };
	}, [people, later]);

	const suggestible = useMemo(
		() =>
			people.filter(
				(p) => !hasGender(p) && !later.has(p.uid) && guesses.has(p.uid),
			),
		[people, later, guesses],
	);

	const searchEntries = useMemo(() => {
		const map = new Map<string, ReturnType<typeof buildSearchEntry>>();
		for (const p of people) {
			const m = MANDAL_LIST.find((x) => x.id === p.mandalId);
			map.set(
				p.uid,
				buildSearchEntry(
					[p.realName, p.dikshaName, m?.shortNameEn, m?.shortNameHi],
					[p.email],
					[p.phoneNumber],
				),
			);
		}
		return map;
	}, [people]);

	const listed = useMemo(() => {
		const q = prepareDevoteeQuery(deferredSearch);
		return people.filter((p) => {
			if (q.text) {
				const e = searchEntries.get(p.uid);
				if (!e || scoreDevotee(e, q) === 0) return false;
			}
			if (touched.has(p.uid)) return true;
			switch (show) {
				case "unset":
					return !hasGender(p) && !later.has(p.uid);
				case "set":
					return hasGender(p);
				case "later":
					return !hasGender(p) && later.has(p.uid);
				default:
					return true;
			}
		});
	}, [people, deferredSearch, searchEntries, show, later, touched]);

	const changeShow = (s: Show) => {
		setShow(s);
		setTouched(new Set());
		setLimit(PAGE);
	};

	const markLater = useCallback((uid: string, on: boolean) => {
		setLater((prev) => {
			const next = new Set(prev);
			if (on) next.add(uid);
			else next.delete(uid);
			writeLater(next);
			return next;
		});
	}, []);

	const setGender = useCallback(
		async (uid: string, gender: Gender) => {
			if (savingIds.has(uid)) return false;
			setSavingIds((s) => new Set(s).add(uid));
			try {
				await updateDoc(doc(db, "users", uid), { gender });
				setProfiles((list) =>
					(list || []).map((p) => (p.uid === uid ? { ...p, gender } : p)),
				);
				setTouched((t) => new Set(t).add(uid));
				if (later.has(uid)) markLater(uid, false);
				return true;
			} catch (e) {
				console.error("Gender save failed", e);
				showToast(
					isHindi
						? "सहेजा नहीं जा सका। दोबारा दबाएँ।"
						: "Could not save. Tap again.",
					"error",
				);
				return false;
			} finally {
				setSavingIds((s) => {
					const next = new Set(s);
					next.delete(uid);
					return next;
				});
			}
		},
		[savingIds, later, isHindi, showToast, markLater],
	);

	const acceptAllSuggestions = async () => {
		if (suggestible.length === 0) return;
		const men = suggestible.filter(
			(p) => guesses.get(p.uid)?.gender === "male",
		).length;
		const women = suggestible.length - men;
		if (
			!confirm(
				isHindi
					? `${suggestible.length} भक्तों का लिंग सुझाव के अनुसार सेट होगा (${men} पुरुष, ${women} महिला)। बाद में किसी का भी बदल सकते हैं। आगे बढ़ें?`
					: `Set ${suggestible.length} devotees' gender as suggested (${men} male, ${women} female)? You can change anyone later. Continue?`,
			)
		)
			return;
		setBulkSaving(true);
		const done: Record<string, Gender> = {};
		try {
			for (let i = 0; i < suggestible.length; i += 400) {
				const batch = writeBatch(db);
				for (const p of suggestible.slice(i, i + 400)) {
					const g = guesses.get(p.uid)?.gender;
					if (!g) continue;
					batch.update(doc(db, "users", p.uid), { gender: g });
					done[p.uid] = g;
				}
				await batch.commit();
			}
			showToast(
				isHindi
					? `${Object.keys(done).length} का लिंग सेट हुआ ✅`
					: `Gender set for ${Object.keys(done).length} ✅`,
				"success",
			);
		} catch (e) {
			console.error("Bulk gender failed", e);
			showToast(
				isHindi
					? "कुछ सेव नहीं हुए — दोबारा दबाएँ, जो हो चुके वे नहीं बदलेंगे"
					: "Some were not saved — press again; ones already done stay",
				"error",
			);
		} finally {
			// Keep what did go through (batches before a failure).
			setProfiles((list) =>
				(list || []).map((p) =>
					done[p.uid] ? { ...p, gender: done[p.uid] } : p,
				),
			);
			setBulkSaving(false);
		}
	};

	// ── Card mode ──
	const startCards = () => {
		setCardQueue(
			people
				.filter((p) => !hasGender(p) && !later.has(p.uid))
				.map((p) => p.uid),
		);
		setCardIndex(0);
		setMode("cards");
	};
	const byUid = useMemo(() => new Map(people.map((p) => [p.uid, p])), [people]);
	const current =
		mode === "cards" ? byUid.get(cardQueue[cardIndex] || "") : undefined;
	const cardDone = cardQueue.filter((uid) =>
		hasGender(byUid.get(uid) || {}),
	).length;
	const next = useCallback(
		() => setCardIndex((i) => Math.min(i + 1, cardQueue.length)),
		[cardQueue.length],
	);

	// Keyboard on a computer (card mode): M / F to set, L later, → skip, ← back.
	useEffect(() => {
		if (mode !== "cards") return;
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target?.closest("input, textarea, select")) return;
			if (!current) return;
			const k = e.key.toLowerCase();
			if (k === "m" || k === "f")
				setGender(current.uid, k === "m" ? "male" : "female").then(
					(ok) => ok && next(),
				);
			else if (k === "l") {
				markLater(current.uid, true);
				next();
			} else if (e.key === "ArrowRight") next();
			else if (e.key === "ArrowLeft") setCardIndex((i) => Math.max(i - 1, 0));
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [mode, current, setGender, markLater, next]);

	if (profiles === null) {
		return (
			<div className="flex-1 flex items-center justify-center p-10">
				<Loader2 className="animate-spin text-emerald-500" size={32} />
			</div>
		);
	}

	const mandalOf = (p: UserProfile) => {
		if (p.mandalId === "custom")
			return (p as { customMandalName?: string }).customMandalName || "";
		const m = MANDAL_LIST.find((x) => x.id === p.mandalId);
		return m ? (isHindi ? m.shortNameHi : m.shortNameEn) : "";
	};

	/** Male / Female buttons for one person. */
	const genderToggle = (p: UserProfile, big = false, after?: () => void) => {
		const guess = guesses.get(p.uid);
		const saving = savingIds.has(p.uid);
		return (
			<div className={`grid grid-cols-2 ${big ? "gap-3" : "gap-1.5"}`}>
				{(
					[
						["male", "पुरुष", "Male"],
						["female", "महिला", "Female"],
					] as const
				).map(([g, hi, en]) => {
					const chosen = p.gender === g;
					const suggested = !hasGender(p) && guess?.gender === g;
					return (
						<button
							type="button"
							key={g}
							disabled={saving}
							aria-pressed={chosen}
							onClick={async () => {
								if (chosen) {
									after?.();
									return;
								}
								const ok = await setGender(p.uid, g);
								if (ok) after?.();
							}}
							className={`relative rounded-xl border-2 font-bold transition active:scale-[0.97] disabled:opacity-60 ${
								big
									? "min-h-[64px] text-lg rounded-2xl"
									: "min-h-touch px-3 text-sm"
							} ${
								chosen
									? "bg-emerald-500 border-emerald-500 text-white"
									: suggested
										? "border-amber-400 bg-amber-50 dark:bg-amber-500/10 text-slate-800 dark:text-white"
										: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
							}`}
						>
							{saving && !chosen ? (
								<Loader2 size={16} className="animate-spin mx-auto" />
							) : (
								<>
									{chosen && <span aria-hidden>✓ </span>}
									{isHindi ? hi : en}
								</>
							)}
							{suggested && big && (
								<span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
									{isHindi ? "सुझाव" : "Suggested"}
								</span>
							)}
						</button>
					);
				})}
			</div>
		);
	};

	const avatar = (p: UserProfile, size: string) => (
		<div
			className={`${size} rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 flex items-center justify-center`}
		>
			{p.photoURL ? (
				<ThumbImg
					src={p.photoURL}
					thumbWidth={size.includes("28") ? THUMB.tile : THUMB.small}
					className="w-full h-full object-cover"
				/>
			) : (
				<User size={20} className="text-slate-400" />
			)}
		</div>
	);

	const pct = counts.all ? Math.round((counts.set / counts.all) * 100) : 100;

	return (
		<div className="flex-1 overflow-y-auto animate-in slide-in-from-right">
			<div className="max-w-2xl mx-auto p-3 space-y-3 pb-10">
				{/* Progress */}
				<div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 shadow-sm">
					<div className="flex items-center justify-between gap-2">
						<p className="text-sm font-bold text-slate-800 dark:text-white">
							{isHindi
								? `${counts.set} / ${counts.all} का लिंग सेट है`
								: `${counts.set} of ${counts.all} have a gender`}
						</p>
						<button
							type="button"
							onClick={load}
							disabled={refreshing}
							aria-label={isHindi ? "ताज़ा करें" : "Refresh"}
							className="min-w-touch min-h-touch -m-2 flex items-center justify-center text-slate-400 disabled:opacity-50"
						>
							<RefreshCw
								size={16}
								className={refreshing ? "animate-spin" : ""}
							/>
						</button>
					</div>
					<div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
						<div
							className="h-full rounded-full bg-emerald-500 transition-all duration-300"
							style={{ width: `${pct}%` }}
						/>
					</div>
					<p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
						{isHindi
							? "चुनते ही भक्त की प्रोफ़ाइल में सेव हो जाता है और परिवार के रिश्ते अपने-आप भरने में मदद करता है। जिनका सेट है, उनसे दोबारा नहीं पूछा जाता।"
							: "Saved to the devotee's profile at once; it helps fill in family relations. Anyone already set is not asked again."}
					</p>
				</div>

				{/* Scope + mode */}
				<div className="grid grid-cols-2 gap-2">
					<div className="flex gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800">
						{(
							[
								["approved", "स्वीकृत", "Approved"],
								["all", "सभी", "Everyone"],
							] as const
						).map(([id, hi, en]) => (
							<button
								type="button"
								key={id}
								onClick={() => {
									setScope(id);
									setTouched(new Set());
									setLimit(PAGE);
									if (mode === "cards") setMode("list");
								}}
								aria-pressed={scope === id}
								className={`flex-1 min-h-[38px] rounded-lg text-xs font-bold transition ${
									scope === id
										? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
										: "text-slate-500 dark:text-slate-400"
								}`}
							>
								{isHindi ? hi : en}
							</button>
						))}
					</div>
					<div className="flex gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800">
						<button
							type="button"
							onClick={() => setMode("list")}
							aria-pressed={mode === "list"}
							className={`flex-1 min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${
								mode === "list"
									? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
									: "text-slate-500 dark:text-slate-400"
							}`}
						>
							<List size={13} />
							{isHindi ? "सूची" : "List"}
						</button>
						<button
							type="button"
							onClick={startCards}
							aria-pressed={mode === "cards"}
							className={`flex-1 min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${
								mode === "cards"
									? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
									: "text-slate-500 dark:text-slate-400"
							}`}
						>
							<Layers size={13} />
							{isHindi ? "एक-एक" : "One by one"}
						</button>
					</div>
				</div>

				{mode === "list" ? (
					<>
						{suggestible.length > 0 && (
							<button
								type="button"
								onClick={acceptAllSuggestions}
								disabled={bulkSaving}
								className="w-full min-h-touch rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 flex items-center gap-2.5 text-left disabled:opacity-60 active:scale-[0.99]"
							>
								{bulkSaving ? (
									<Loader2
										size={18}
										className="animate-spin text-amber-600 shrink-0"
									/>
								) : (
									<Wand2
										size={18}
										className="text-amber-600 dark:text-amber-400 shrink-0"
									/>
								)}
								<span className="flex-1 text-sm text-amber-900 dark:text-amber-200">
									<b>
										{isHindi
											? `सभी ${suggestible.length} सुझाव मानें`
											: `Accept all ${suggestible.length} suggestions`}
									</b>
									<span className="block text-[11px] text-amber-800/80 dark:text-amber-300/80">
										{isHindi
											? "परिवार के रिश्ते या नाम से अंदाज़ा — पहले एक बार सूची देख लें"
											: "Guessed from family relations or the name — look over the list first"}
									</span>
								</span>
							</button>
						)}

						<div className="relative">
							<Search
								size={17}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
							/>
							<input
								type="search"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setLimit(PAGE);
								}}
								placeholder={
									isHindi
										? "नाम (हिंदी/English), फ़ोन, मंडल…"
										: "Name (Hindi/English), phone, mandal…"
								}
								className="w-full min-h-touch pl-9 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
							/>
							{search && (
								<button
									type="button"
									onClick={() => setSearch("")}
									aria-label={isHindi ? "खोज साफ़ करें" : "Clear search"}
									className="absolute right-0 top-1/2 -translate-y-1/2 min-w-touch min-h-touch flex items-center justify-center text-slate-400"
								>
									<X size={16} />
								</button>
							)}
						</div>

						<div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-3 px-3">
							{(
								[
									["unset", "सेट नहीं", "Not set", counts.unset],
									["set", "सेट है", "Set", counts.set],
									["later", "बाद में", "Later", counts.later],
									["all", "सभी", "All", counts.all],
								] as const
							).map(([id, hi, en, n]) => (
								<button
									type="button"
									key={id}
									onClick={() => changeShow(id)}
									aria-pressed={show === id}
									className={`shrink-0 min-h-[36px] px-3 rounded-full text-xs font-bold border transition ${
										show === id
											? "bg-emerald-500 border-emerald-500 text-white"
											: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
									}`}
								>
									{isHindi ? hi : en} · {n}
								</button>
							))}
						</div>

						{listed.length === 0 ? (
							<div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 text-center">
								<CheckCircle
									size={36}
									className="mx-auto text-emerald-500 mb-2"
								/>
								<p className="font-bold text-slate-800 dark:text-white">
									{search.trim()
										? isHindi
											? "कोई नहीं मिला"
											: "No one found"
										: show === "unset"
											? isHindi
												? "सबका लिंग सेट है 🎉"
												: "Everyone has a gender 🎉"
											: isHindi
												? "यहाँ कोई नहीं"
												: "No one here"}
								</p>
							</div>
						) : (
							<ul className="space-y-2">
								{listed.slice(0, limit).map((p) => {
									const guess = guesses.get(p.uid);
									const isLater = !hasGender(p) && later.has(p.uid);
									return (
										<li
											key={p.uid}
											className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 [content-visibility:auto] [contain-intrinsic-size:auto_110px]"
										>
											<div className="flex items-center gap-2.5">
												{avatar(p, "w-11 h-11")}
												<div className="flex-1 min-w-0">
													<p className="font-bold text-sm text-slate-800 dark:text-white truncate">
														{p.realName || p.email || "—"}
													</p>
													<p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
														{[
															p.dikshaName && p.realName ? p.dikshaName : "",
															mandalOf(p),
															p.isApproved
																? ""
																: isHindi
																	? "स्वीकृत नहीं"
																	: "not approved",
														]
															.filter(Boolean)
															.join(" · ")}
													</p>
												</div>
												<EditProfileButton
													target={{ uid: p.uid }}
													isHindi={isHindi}
													name={p.realName || p.email}
													onClosed={(changed) => changed && load()}
													iconOnly
												/>
												{!hasGender(p) && (
													<button
														type="button"
														onClick={() => {
															markLater(p.uid, !isLater);
															setTouched((t) => new Set(t).add(p.uid));
														}}
														aria-pressed={isLater}
														title={
															isLater
																? isHindi
																	? "“बाद में” से हटाएँ"
																	: "Remove from “later”"
																: isHindi
																	? "बाद में तय करें"
																	: "Decide later"
														}
														aria-label={
															isHindi ? "बाद में तय करें" : "Decide later"
														}
														className={`min-w-touch min-h-touch rounded-full flex items-center justify-center ${
															isLater
																? "text-amber-600 bg-amber-50 dark:bg-amber-500/10"
																: "text-slate-400"
														}`}
													>
														<Clock size={17} />
													</button>
												)}
											</div>
											{guess && !hasGender(p) && (
												<p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
													<Lightbulb size={12} className="shrink-0 mt-px" />
													{isHindi ? guess.hi : guess.en}
												</p>
											)}
											<div className="mt-2">{genderToggle(p)}</div>
										</li>
									);
								})}
							</ul>
						)}
						{listed.length > limit && (
							<button
								type="button"
								onClick={() => setLimit((n) => n + PAGE)}
								className="w-full min-h-touch rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-emerald-600 dark:text-emerald-400"
							>
								{isHindi
									? `और दिखाएँ (${listed.length - limit} बाकी)`
									: `Show more (${listed.length - limit} more)`}
							</button>
						)}
					</>
				) : (
					<>
						<div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
							<span>
								{Math.min(cardIndex + 1, cardQueue.length)} / {cardQueue.length}
							</span>
							<span>{isHindi ? `${cardDone} सेट हुए` : `${cardDone} set`}</span>
						</div>
						{!current ? (
							<div className="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 text-center">
								<CheckCircle
									size={40}
									className="mx-auto text-emerald-500 mb-3"
								/>
								<p className="font-bold text-slate-800 dark:text-white">
									{cardQueue.length === 0
										? isHindi
											? "सबका लिंग सेट है 🎉"
											: "Everyone has a gender 🎉"
										: isHindi
											? `सूची पूरी हुई — ${cardDone} सेट हुए 🎉`
											: `Done — ${cardDone} set 🎉`}
								</p>
								{counts.later > 0 && (
									<button
										type="button"
										onClick={() => {
											setMode("list");
											changeShow("later");
										}}
										className="mt-4 min-h-touch px-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200"
									>
										{isHindi
											? `“बाद में” वाले ${counts.later} देखें`
											: `See the ${counts.later} marked “later”`}
									</button>
								)}
							</div>
						) : (
							<div className="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
								<div className="flex flex-col items-center text-center">
									{avatar(current, "w-28 h-28")}
									<h3 className="mt-3 text-lg font-bold text-slate-800 dark:text-white break-words">
										{current.realName || current.email || "—"}
									</h3>
									{current.dikshaName && (
										<p className="text-sm text-slate-500 dark:text-slate-400">
											{current.dikshaName}
										</p>
									)}
									<EditProfileButton
										target={{ uid: current.uid }}
										isHindi={isHindi}
										name={current.realName || current.email}
										onClosed={(changed) => changed && load()}
										className="mt-2 min-h-[36px] px-3 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 flex items-center gap-1.5 active:scale-95"
									/>
									<p className="mt-1 text-xs text-slate-400 dark:text-ink-400">
										{[
											mandalOf(current),
											current.isApproved
												? isHindi
													? "स्वीकृत"
													: "Approved"
												: isHindi
													? "स्वीकृत नहीं"
													: "Not approved",
										]
											.filter(Boolean)
											.join(" · ")}
									</p>
								</div>
								{guesses.get(current.uid) && !hasGender(current) && (
									<div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2">
										<Lightbulb
											size={14}
											className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
										/>
										<p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">
											{isHindi
												? guesses.get(current.uid)?.hi
												: guesses.get(current.uid)?.en}
										</p>
									</div>
								)}
								<div className="mt-5">{genderToggle(current, true, next)}</div>
								<div className="mt-3 grid grid-cols-3 gap-2">
									<button
										type="button"
										onClick={() => setCardIndex((i) => Math.max(i - 1, 0))}
										disabled={cardIndex === 0}
										className="min-h-touch flex items-center justify-center gap-1 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 disabled:opacity-40"
									>
										<ArrowLeft size={15} />
										{isHindi ? "पिछला" : "Back"}
									</button>
									<button
										type="button"
										onClick={() => {
											markLater(current.uid, true);
											next();
										}}
										className="min-h-touch flex items-center justify-center gap-1 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10"
									>
										<Clock size={15} />
										{isHindi ? "बाद में" : "Later"}
									</button>
									<button
										type="button"
										onClick={next}
										className="min-h-touch flex items-center justify-center gap-1 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60"
									>
										{isHindi ? "छोड़ें" : "Skip"}
										<ArrowRight size={15} />
									</button>
								</div>
								<p className="mt-3 text-center text-[10px] text-slate-400 hidden sm:block">
									{isHindi
										? "कीबोर्ड: M पुरुष · F महिला · L बाद में · → छोड़ें"
										: "Keys: M male · F female · L later · → skip"}
								</p>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};

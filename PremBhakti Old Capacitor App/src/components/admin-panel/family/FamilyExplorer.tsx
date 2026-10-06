import { formatDistanceToNow } from "date-fns";
import { hi as hiLocale } from "date-fns/locale";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
	AlertTriangle,
	ArrowLeft,
	ChevronDown,
	ChevronRight,
	GitBranch,
	Link2,
	Loader2,
	MapPin,
	Network,
	Phone,
	RefreshCw,
	Search,
	User,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	hasStartedProfile,
	type UserProfile,
} from "../../../../context/AuthContext";
import { db } from "../../../../services/firebase";
import {
	buildSearchEntry,
	type DevoteeSearchEntry,
	prepareDevoteeQuery,
	scoreDevotee,
} from "../../../../utils/devoteeSearch";
import {
	buildFamilyNetwork,
	type FamilyGroup,
	type NetworkProfile,
	ownHandAdded,
} from "../../../../utils/familyNetwork";
import { noAppReasonOf } from "../../../constants/familyMemberReasons";
import { getRelationLabel } from "../../../constants/relations";
import { useAdminBack } from "../../../hooks/useAdminBack";
import { MANDAL_LIST } from "../../../types/mandal";
import { EditProfileButton, useOpenDevoteeEdit } from "../devoteeEditLink";
import { AdminFamilyTreeSheet } from "./AdminFamilyTreeSheet";
import { FamilyGroupGraph, FamilyNetworkMap } from "./FamilyNetworkMap";
import { ThumbImg } from "../../../../components/ui/ThumbImg";

type FamilyFilter =
	| "all"
	| "partly"
	| "noRelations"
	| "crossMandal"
	| "handAdded";

const MAP_PAGE = 60;
const LIST_PAGE = 30;

const nameOfProfile = (p?: Partial<UserProfile> | null) =>
	p?.realName || p?.dikshaName || p?.email || p?.phoneNumber || "—";

const Avatar: React.FC<{ name: string; photoURL?: string; size?: number }> = ({
	name,
	photoURL,
	size = 40,
}) => (
	<div
		className="shrink-0 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center"
		style={{ width: size, height: size }}
	>
		{photoURL ? (
			<ThumbImg
				src={photoURL}
				alt=""
				loading="lazy"
				className="w-full h-full object-cover"
			/>
		) : name.trim() && name !== "—" ? (
			<span className="text-sm font-bold text-slate-500 dark:text-slate-300">
				{name.trim().charAt(0).toUpperCase()}
			</span>
		) : (
			<User size={size / 2.4} className="text-slate-400" />
		)}
	</div>
);

const Card: React.FC<{
	title: string;
	subtitle?: string;
	icon?: React.ReactNode;
	children: React.ReactNode;
	action?: React.ReactNode;
}> = ({ title, subtitle, icon, children, action }) => (
	<section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
		<div className="flex items-start gap-2 mb-3">
			{icon && <span className="mt-0.5 text-pink-500 shrink-0">{icon}</span>}
			<div className="flex-1 min-w-0">
				<h3 className="font-bold text-slate-800 dark:text-white leading-snug">
					{title}
				</h3>
				{subtitle && (
					<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
						{subtitle}
					</p>
				)}
			</div>
			{action}
		</div>
		{children}
	</section>
);

const StatTile: React.FC<{
	label: string;
	value: string | number;
	note?: string;
	onClick?: () => void;
}> = ({ label, value, note, onClick }) => {
	const body = (
		<>
			<p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
				{label}
			</p>
			<p className="text-2xl font-bold text-slate-800 dark:text-white mt-1 tabular-nums">
				{value}
			</p>
			{note && (
				<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
					{note}
				</p>
			)}
		</>
	);
	const cls =
		"text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-3";
	return onClick ? (
		<button
			type="button"
			onClick={onClick}
			className={`${cls} active:scale-[0.98] transition hover:border-pink-300 dark:hover:border-pink-800`}
		>
			{body}
		</button>
	) : (
		<div className={cls}>{body}</div>
	);
};

/** One horizontal bar: label, bar (share of `max`), value text. */
const BarRow: React.FC<{
	label: string;
	value: number;
	max: number;
	text: string;
	title?: string;
	onClick?: () => void;
	active?: boolean;
}> = ({ label, value, max, text, title, onClick, active }) => {
	const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
	const inner = (
		<>
			<span className="w-20 shrink-0 text-xs text-slate-600 dark:text-slate-300 truncate text-left">
				{label}
			</span>
			<span className="flex-1 h-3 rounded bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
				<span
					className={`block h-full rounded ${active ? "bg-pink-600 dark:bg-pink-400" : "bg-pink-500 dark:bg-pink-500"}`}
					style={{ width: `${pct}%` }}
				/>
			</span>
			<span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">
				{text}
			</span>
		</>
	);
	const cls = "w-full flex items-center gap-2 min-h-[32px]";
	return onClick ? (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className={`${cls} rounded-lg px-1 -mx-1 hover:bg-slate-50 dark:hover:bg-slate-700/40 ${active ? "bg-pink-50 dark:bg-pink-500/10" : ""}`}
		>
			{inner}
		</button>
	) : (
		<div className={cls} title={title}>
			{inner}
		</div>
	);
};

/**
 * Community Manager → Family Explorer: every devotee's family in one place.
 * The overview shows how connected the community is (numbers, a map of all
 * families, family sizes, mandal-wise share) and what needs fixing; a family
 * opens with its link graph, members and relations, and any devotee's family
 * tree can be viewed as they see it. Read-only; one read of the users list
 * (refresh by hand) to keep reads low.
 */
export const FamilyExplorer: React.FC<{ isHindi: boolean }> = ({ isHindi }) => {
	const [profiles, setProfiles] = useState<UserProfile[] | null>(null);
	const [loadError, setLoadError] = useState(false);
	const [loadedAt, setLoadedAt] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const [pendingRequests, setPendingRequests] = useState<number | null>(null);

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
			setLoadError(false);
			setLoadedAt(Date.now());
		} catch (e) {
			console.error("[FamilyExplorer] users not loaded", e);
			setLoadError(true);
			setProfiles((p) => p ?? []);
		} finally {
			setRefreshing(false);
		}
		try {
			const req = await getDocs(
				query(
					collection(db, "familyLinkRequests"),
					where("status", "==", "pending"),
				),
			);
			setPendingRequests(req.size);
		} catch (e) {
			console.warn("[FamilyExplorer] link requests", e);
			setPendingRequests(null);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	return (
		<FamilyExplorerView
			isHindi={isHindi}
			profiles={profiles}
			loadError={loadError}
			loadedAt={loadedAt}
			refreshing={refreshing}
			pendingRequests={pendingRequests}
			onRefresh={load}
		/>
	);
};

/** The explorer's screens for an already loaded list (see FamilyExplorer). */
export const FamilyExplorerView: React.FC<{
	isHindi: boolean;
	/** null while loading. */
	profiles: UserProfile[] | null;
	loadError: boolean;
	loadedAt: number;
	refreshing: boolean;
	pendingRequests: number | null;
	onRefresh: () => void;
}> = ({
	isHindi,
	profiles,
	loadError,
	loadedAt,
	refreshing,
	pendingRequests,
	onRefresh: load,
}) => {
	const [search, setSearch] = useState("");
	const [mandal, setMandal] = useState("all");
	const [mandalOpen, setMandalOpen] = useState(false);
	const [familyFilter, setFamilyFilter] = useState<FamilyFilter>("all");
	const [mapLimit, setMapLimit] = useState(MAP_PAGE);
	const [listLimit, setListLimit] = useState(LIST_PAGE);
	const [showOneWay, setShowOneWay] = useState(false);

	const [openGroupId, setOpenGroupId] = useState<string | null>(null);
	const [centre, setCentre] = useState<string>("");
	const [treeUid, setTreeUid] = useState<string | null>(null);
	// Names open that person's edit screen (Admin Panel); reload after a change.
	const openEdit = useOpenDevoteeEdit();
	const afterEdit = (changed: boolean) => {
		if (changed) load();
	};

	useAdminBack(mandalOpen, () => setMandalOpen(false));
	useAdminBack(!!openGroupId, () => setOpenGroupId(null));

	const byUid = useMemo(
		() => new Map((profiles || []).map((p) => [p.uid, p])),
		[profiles],
	);
	const nameOf = useCallback(
		(uid: string) => nameOfProfile(byUid.get(uid)),
		[byUid],
	);
	const photoOf = useCallback(
		(uid: string) => byUid.get(uid)?.photoURL || undefined,
		[byUid],
	);

	const mandalName = useCallback(
		(id?: string) => {
			if (!id) return isHindi ? "मंडल नहीं" : "No mandal";
			if (id === "custom") return isHindi ? "अन्य मंडल" : "Other mandal";
			const m = MANDAL_LIST.find((x) => x.id === id);
			return m ? (isHindi ? m.shortNameHi : m.shortNameEn) : id;
		},
		[isHindi],
	);
	/** A person's mandal, with the name they typed for one not in the list. */
	const personMandal = (p?: Partial<UserProfile> | null) =>
		p?.mandalId === "custom" && p.customMandalName?.trim()
			? p.customMandalName.trim()
			: mandalName(p?.mandalId);

	const network = useMemo(
		() =>
			buildFamilyNetwork((profiles || []) as NetworkProfile[], (p) =>
				hasStartedProfile(p as UserProfile),
			),
		[profiles],
	);

	const inMandal = useCallback(
		(g: FamilyGroup) =>
			mandal === "all" ||
			g.members.some((uid) => (byUid.get(uid)?.mandalId || "") === mandal),
		[mandal, byUid],
	);
	const mandalGroups = useMemo(
		() => network.groups.filter(inMandal),
		[network, inMandal],
	);

	const stats = useMemo(() => {
		const share =
			mandal === "all"
				? {
						total: network.accounts,
						connected: network.connected,
					}
				: network.byMandal.find((m) => m.mandalId === mandal) || {
						total: 0,
						connected: 0,
					};
		const solo = network.soloWithFamily.filter(
			(uid) => mandal === "all" || (byUid.get(uid)?.mandalId || "") === mandal,
		);
		const handAdded =
			mandalGroups.reduce((n, g) => n + g.handAdded, 0) +
			solo.reduce(
				(n, uid) =>
					n + ownHandAdded(byUid.get(uid) as NetworkProfile, []).length,
				0,
			);
		return {
			...share,
			families: mandalGroups.length,
			largest: mandalGroups[0]?.members.length || 0,
			handAdded,
			solo: solo.length,
			partly: mandalGroups.filter((g) => g.missingPairs > 0).length,
			noRelations: mandalGroups.filter((g) => g.relationsSet === 0).length,
			crossMandal: mandalGroups.filter((g) => g.mandals.length > 1).length,
		};
	}, [network, mandal, mandalGroups, byUid]);

	const sizeBuckets = useMemo(
		() =>
			network.sizeBuckets.map((b) => ({
				...b,
				count: mandalGroups.filter(
					(g) => g.members.length >= b.min && g.members.length <= b.max,
				).length,
			})),
		[network, mandalGroups],
	);

	const oneWay = useMemo(
		() =>
			network.oneWayLinks.filter(
				(l) =>
					mandal === "all" ||
					(byUid.get(l.from)?.mandalId || "") === mandal ||
					(byUid.get(l.to)?.mandalId || "") === mandal,
			),
		[network, mandal, byUid],
	);

	const listedGroups = useMemo(
		() =>
			mandalGroups.filter((g) => {
				switch (familyFilter) {
					case "partly":
						return g.missingPairs > 0;
					case "noRelations":
						return g.relationsSet === 0;
					case "crossMandal":
						return g.mandals.length > 1;
					case "handAdded":
						return g.handAdded > 0;
					default:
						return true;
				}
			}),
		[mandalGroups, familyFilter],
	);

	// ── Search (Hindi / English / Hinglish, phone, email) ──
	const searchIndex = useMemo(() => {
		const out: {
			kind: "account" | "member";
			uid: string;
			memberId?: string;
			entry: DevoteeSearchEntry;
		}[] = [];
		for (const p of profiles || []) {
			if (p.isDeleted || (p as NetworkProfile).mergedIntoUid) continue;
			if (!hasStartedProfile(p) && !network.groupOf.has(p.uid)) continue;
			const m = MANDAL_LIST.find((x) => x.id === p.mandalId);
			out.push({
				kind: "account",
				uid: p.uid,
				entry: buildSearchEntry(
					[
						p.realName,
						p.dikshaName,
						m?.shortNameEn,
						m?.shortNameHi,
						p.customMandalName,
					],
					[p.email, p.uid, p.shortId],
					[p.phoneNumber],
				),
			});
			for (const fm of p.familyMembers || []) {
				if (!fm?.id) continue;
				out.push({
					kind: "member",
					uid: p.uid,
					memberId: fm.id,
					entry: buildSearchEntry([fm.realName, fm.dikshaName]),
				});
			}
		}
		return out;
	}, [profiles, network]);

	const results = useMemo(() => {
		const q = prepareDevoteeQuery(search);
		if (!q.text) return [];
		return searchIndex
			.map((r) => ({ ...r, score: scoreDevotee(r.entry, q) }))
			.filter((r) => r.score > 0)
			.filter(
				(r) =>
					mandal === "all" || (byUid.get(r.uid)?.mandalId || "") === mandal,
			)
			.sort(
				(a, b) =>
					b.score - a.score ||
					Number(a.kind === "member") - Number(b.kind === "member"),
			)
			.slice(0, 25);
	}, [search, searchIndex, mandal, byUid]);

	const openFamilyOf = (uid: string) => {
		const g = network.groupOf.get(uid);
		if (g) {
			setOpenGroupId(g.id);
			setCentre(uid);
		} else {
			setTreeUid(uid);
		}
	};

	const openGroup = network.groups.find((g) => g.id === openGroupId) || null;

	if (!profiles) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-slate-500 dark:text-slate-400">
				<Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
				<p className="text-sm">
					{isHindi ? "परिवार लोड हो रहे हैं…" : "Loading families…"}
				</p>
			</div>
		);
	}

	const treeSheet = (
		<AdminFamilyTreeSheet
			startUid={treeUid}
			profiles={profiles as NetworkProfile[]}
			isHindi={isHindi}
			onClose={() => setTreeUid(null)}
			onProfileClosed={afterEdit}
		/>
	);

	// ════════════ ONE FAMILY ════════════
	if (openGroup) {
		const sel = openGroup.members.includes(centre)
			? centre
			: openGroup.members[0];
		const selProfile = byUid.get(sel);
		const selName = nameOf(sel);
		const selFirst = selName.split(" ")[0] || selName;
		const handAddedByOwner = openGroup.members
			.map((uid) => {
				const p = byUid.get(uid) as NetworkProfile | undefined;
				if (!p) return null;
				const linked = openGroup.members
					.filter((o) => o !== uid)
					.map((o) => byUid.get(o) as NetworkProfile)
					.filter(Boolean);
				return { uid, members: ownHandAdded(p, linked) };
			})
			.filter(
				(x): x is { uid: string; members: ReturnType<typeof ownHandAdded> } =>
					!!x && x.members.length > 0,
			);
		const relPct = openGroup.relationsTotal
			? Math.round((openGroup.relationsSet / openGroup.relationsTotal) * 100)
			: 0;

		return (
			<div
				key={`family-${openGroup.id}`}
				className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 animate-in fade-in"
			>
				<div className="max-w-3xl mx-auto p-4 space-y-4 pb-10">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setOpenGroupId(null)}
							className="min-h-touch px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 active:scale-95"
						>
							<ArrowLeft size={16} />
							{isHindi ? "सभी परिवार" : "All families"}
						</button>
					</div>

					<Card
						icon={<Network size={18} />}
						title={
							isHindi
								? `${nameOf(openGroup.members[0])} का परिवार`
								: `${nameOf(openGroup.members[0])}'s family`
						}
						subtitle={
							isHindi
								? `${openGroup.members.length} ऐप पर${openGroup.handAdded ? ` · ${openGroup.handAdded} हाथ से जोड़े` : ""} · ${openGroup.mandals.map(mandalName).join(", ") || "मंडल नहीं"}`
								: `${openGroup.members.length} on the app${openGroup.handAdded ? ` · ${openGroup.handAdded} added by hand` : ""} · ${openGroup.mandals.map(mandalName).join(", ") || "no mandal"}`
						}
					>
						<FamilyGroupGraph
							group={openGroup}
							nameOf={nameOf}
							photoOf={photoOf}
							selected={sel}
							onSelect={setCentre}
						/>
						<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
							<span className="flex items-center gap-1.5">
								<span className="w-5 border-t-2 border-slate-400" />
								{isHindi ? "खुद जोड़ा" : "Linked by them"}
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-5 border-t-2 border-dashed border-slate-400" />
								{isHindi ? "अपने-आप जुड़ा" : "Linked automatically"}
							</span>
						</div>

						<div className="grid grid-cols-3 gap-2 mt-4">
							<div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2.5 text-center">
								<p className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
									{openGroup.edges.length}
								</p>
								<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
									{isHindi ? "लिंक" : "links"}
								</p>
							</div>
							<div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2.5 text-center">
								<p className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
									{relPct}%
								</p>
								<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
									{isHindi ? "रिश्ते भरे" : "relations set"}
								</p>
							</div>
							<div
								className={`rounded-xl p-2.5 text-center ${openGroup.missingPairs > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-slate-50 dark:bg-slate-900/50"}`}
							>
								<p className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
									{openGroup.missingPairs}
								</p>
								<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
									{isHindi ? "लिंक बाकी" : "links missing"}
								</p>
							</div>
						</div>
						{openGroup.missingPairs > 0 && (
							<p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 leading-snug flex gap-1.5">
								<AlertTriangle size={13} className="shrink-0 mt-px" />
								{isHindi
									? "सब आपस में नहीं जुड़े हैं। ठीक करने के लिए: इनमें से किसी की प्रोफाइल एडिट करें → “पूरे परिवार को आपस में जोड़ें”।"
									: "Not everyone is linked to each other. To fix: edit any of them → “Link the whole family together”."}
							</p>
						)}
						{openGroup.missingPairs > 0 && (
							<div className="mt-2 flex justify-end">
								<EditProfileButton
									target={{ uid: sel }}
									isHindi={isHindi}
									name={selName}
									onClosed={afterEdit}
								/>
							</div>
						)}
					</Card>

					{/* Selected person */}
					<Card
						title={selName}
						subtitle={
							isHindi
								? `हर व्यक्ति ${selFirst} का क्या लगता है, और वे ${selFirst} को क्या बताते हैं। किसी और पर दबाकर उनकी ओर से देखें।`
								: `What each person is to ${selFirst}, and what they call ${selFirst}. Tap someone to see it from their side.`
						}
						action={
							<div className="shrink-0 flex flex-col sm:flex-row gap-2">
								<button
									type="button"
									onClick={() => setTreeUid(sel)}
									className="shrink-0 min-h-touch px-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95"
								>
									<GitBranch size={14} />
									{isHindi ? "परिवार वृक्ष" : "Family tree"}
								</button>
								<EditProfileButton
									target={{ uid: sel }}
									isHindi={isHindi}
									name={selName}
									onClosed={afterEdit}
								/>
							</div>
						}
					>
						<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 mb-3">
							<span className="flex items-center gap-1">
								<MapPin size={13} className="text-slate-400" />
								{selProfile?.mandalId === "custom" &&
								selProfile.customMandalName?.trim()
									? selProfile.customMandalName
									: mandalName(selProfile?.mandalId)}
							</span>
							{selProfile?.phoneNumber && (
								<span className="flex items-center gap-1">
									<Phone size={13} className="text-slate-400" />
									{selProfile.phoneNumber}
								</span>
							)}
							{selProfile?.dikshaName && selProfile.realName && (
								<span>{selProfile.dikshaName}</span>
							)}
						</div>
						<ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
							{openGroup.members
								.filter((uid) => uid !== sel)
								.map((uid) => {
									const p = byUid.get(uid);
									const theyAre = selProfile?.linkedFamilyRelations?.[uid];
									const theyCall = p?.linkedFamilyRelations?.[sel];
									const linked =
										!!selProfile?.linkedFamilyMembers?.includes(uid);
									const viaUid =
										selProfile?.linkedFamilyVia?.[uid] ||
										p?.linkedFamilyVia?.[sel];
									return (
										<li key={uid} className="flex items-center gap-1">
											<button
												type="button"
												onClick={() => setCentre(uid)}
												className="flex-1 min-w-0 min-h-touch flex items-center gap-3 py-2 text-left active:bg-slate-50 dark:active:bg-slate-700/30 rounded-lg"
											>
												<Avatar name={nameOf(uid)} photoURL={p?.photoURL} />
												<span className="flex-1 min-w-0">
													<span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
														{nameOf(uid)}
													</span>
													<span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
														{isHindi
															? `${selFirst} ने बताया: `
															: `${selFirst} says: `}
														<b
															className={
																theyAre
																	? "text-slate-700 dark:text-slate-200"
																	: "text-amber-600 dark:text-amber-400 font-normal italic"
															}
														>
															{theyAre
																? getRelationLabel(theyAre, isHindi)
																: isHindi
																	? "रिश्ता नहीं भरा"
																	: "not set"}
														</b>
														{" · "}
														{isHindi ? "ये बताते हैं: " : "They say: "}
														<b
															className={
																theyCall
																	? "text-slate-700 dark:text-slate-200"
																	: "text-amber-600 dark:text-amber-400 font-normal italic"
															}
														>
															{theyCall
																? getRelationLabel(theyCall, isHindi)
																: isHindi
																	? "नहीं भरा"
																	: "not set"}
														</b>
													</span>
													<span className="block text-[11px] text-slate-400 dark:text-slate-500">
														{!linked
															? isHindi
																? "⚠ सीधे नहीं जुड़े"
																: "⚠ Not linked directly"
															: viaUid
																? isHindi
																	? `🔗 ${nameOf(viaUid)} के ज़रिए`
																	: `🔗 via ${nameOf(viaUid)}`
																: isHindi
																	? "🔗 सीधे जुड़े"
																	: "🔗 Linked directly"}
														{" · "}
														{personMandal(p)}
													</span>
												</span>
												<ChevronRight
													size={16}
													className="text-slate-300 shrink-0"
												/>
											</button>
											<EditProfileButton
												target={{ uid }}
												isHindi={isHindi}
												name={nameOf(uid)}
												onClosed={afterEdit}
												iconOnly
											/>
										</li>
									);
								})}
						</ul>
					</Card>

					{handAddedByOwner.length > 0 && (
						<Card
							icon={<UserPlus size={18} />}
							title={isHindi ? "हाथ से जोड़े गए सदस्य" : "Added by hand"}
							subtitle={
								isHindi
									? "जिनका अपना अकाउंट नहीं है"
									: "People without an account of their own"
							}
						>
							<div className="space-y-3">
								{handAddedByOwner.map(({ uid, members }) => (
									<div key={uid}>
										<p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
											{isHindi
												? `${nameOf(uid)} ने जोड़े`
												: `Added by ${nameOf(uid)}`}
										</p>
										<div className="flex flex-wrap gap-2">
											{members.map((m) => {
												const r = noAppReasonOf(m.noAppReason);
												return (
													<button
														type="button"
														key={m.id}
														disabled={!openEdit}
														onClick={() =>
															openEdit?.({ uid, memberId: m.id }, afterEdit)
														}
														title={
															openEdit
																? isHindi
																	? "प्रोफाइल एडिट करें"
																	: "Edit profile"
																: undefined
														}
														className="inline-flex items-center gap-2 rounded-full bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-600 pl-1 pr-3 py-1 text-left enabled:active:scale-95 enabled:hover:border-blue-400 transition"
													>
														<Avatar
															name={m.realName || "—"}
															photoURL={m.photoURL}
															size={26}
														/>
														<span className="text-xs text-slate-700 dark:text-slate-200">
															{m.realName || m.dikshaName || "—"}
															{m.relation && (
																<span className="text-slate-500 dark:text-slate-400">
																	{` · ${getRelationLabel(m.relation, isHindi)}`}
																</span>
															)}
															{r && <span className="ml-1">{r.emoji}</span>}
														</span>
													</button>
												);
											})}
										</div>
									</div>
								))}
							</div>
						</Card>
					)}
				</div>
				{treeSheet}
			</div>
		);
	}

	// ════════════ OVERVIEW ════════════
	const pct = (n: number, of: number) =>
		of > 0 ? Math.round((n / of) * 100) : 0;
	const maxBucket = Math.max(1, ...sizeBuckets.map((b) => b.count));
	const mandalRows = network.byMandal.filter((m) => m.total > 0);
	const filterChips: { id: FamilyFilter; hi: string; en: string; n: number }[] =
		[
			{ id: "all", hi: "सभी", en: "All", n: mandalGroups.length },
			{ id: "partly", hi: "अधूरे जुड़े", en: "Partly linked", n: stats.partly },
			{
				id: "noRelations",
				hi: "रिश्ते नहीं भरे",
				en: "No relations",
				n: stats.noRelations,
			},
			{
				id: "crossMandal",
				hi: "कई मंडल",
				en: "Across mandals",
				n: stats.crossMandal,
			},
			{
				id: "handAdded",
				hi: "हाथ से जोड़े सदस्य",
				en: "With hand-added",
				n: mandalGroups.filter((g) => g.handAdded > 0).length,
			},
		];
	const showFamilies = (f: FamilyFilter) => {
		setFamilyFilter(f);
		setListLimit(LIST_PAGE);
		document
			.getElementById("family-explorer-list")
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div
			key="overview"
			className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 animate-in fade-in"
		>
			<div className="max-w-3xl mx-auto p-4 space-y-4 pb-10">
				{/* Search + mandal */}
				<div className="space-y-2">
					<div className="relative">
						<Search
							size={18}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
						/>
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={
								isHindi
									? "किसी भी भक्त को खोजें — नाम (हिंदी/English), फ़ोन…"
									: "Find any devotee — name (Hindi/English), phone…"
							}
							className="w-full min-h-touch pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20"
						/>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								aria-label={isHindi ? "खोज साफ़ करें" : "Clear search"}
								className="absolute right-1 top-1/2 -translate-y-1/2 min-w-touch min-h-touch flex items-center justify-center text-slate-400"
							>
								<X size={16} />
							</button>
						)}
					</div>
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<button
								type="button"
								onClick={() => setMandalOpen((o) => !o)}
								className="w-full min-h-touch px-3 flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200"
							>
								<MapPin size={15} className="text-slate-400 shrink-0" />
								<span className="flex-1 text-left truncate">
									{mandal === "all"
										? isHindi
											? "सभी मंडल"
											: "All mandals"
										: mandalName(mandal)}
								</span>
								<ChevronDown
									size={15}
									className={`text-slate-400 transition-transform ${mandalOpen ? "rotate-180" : ""}`}
								/>
							</button>
							{mandalOpen && (
								<>
									<button
										type="button"
										aria-label={isHindi ? "बंद करें" : "Close"}
										className="fixed inset-0 z-20 cursor-default"
										onClick={() => setMandalOpen(false)}
									/>
									<div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1">
										{[
											{ mandalId: "all", total: network.accounts },
											...mandalRows,
										].map((m) => (
											<button
												key={m.mandalId || "none"}
												type="button"
												onClick={() => {
													setMandal(m.mandalId);
													setMandalOpen(false);
													setListLimit(LIST_PAGE);
													setMapLimit(MAP_PAGE);
												}}
												className={`w-full min-h-[40px] px-4 flex items-center justify-between text-sm text-left hover:bg-pink-50 dark:hover:bg-pink-500/10 ${mandal === m.mandalId ? "text-pink-600 dark:text-pink-400 font-bold" : "text-slate-700 dark:text-slate-200"}`}
											>
												<span>
													{m.mandalId === "all"
														? isHindi
															? "सभी मंडल"
															: "All mandals"
														: mandalName(m.mandalId)}
												</span>
												<span className="text-xs text-slate-400 tabular-nums">
													{m.total}
												</span>
											</button>
										))}
									</div>
								</>
							)}
						</div>
						<button
							type="button"
							onClick={load}
							disabled={refreshing}
							title={
								loadedAt
									? `${isHindi ? "अपडेट:" : "Updated"} ${formatDistanceToNow(loadedAt, { addSuffix: true, locale: isHindi ? hiLocale : undefined })}`
									: undefined
							}
							aria-label={isHindi ? "ताज़ा करें" : "Refresh"}
							className="min-w-touch min-h-touch flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-50"
						>
							<RefreshCw
								size={16}
								className={refreshing ? "animate-spin" : ""}
							/>
						</button>
					</div>
					{loadError && (
						<p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
							<AlertTriangle size={13} />
							{isHindi
								? "सूची लोड नहीं हो सकी। इंटरनेट देखकर ताज़ा करें दबाएँ।"
								: "Could not load the list. Check the internet and press refresh."}
						</p>
					)}
				</div>

				{/* Search results */}
				{search.trim() ? (
					<Card
						icon={<Search size={18} />}
						title={
							isHindi
								? `${results.length} मिले${results.length === 25 ? "+" : ""}`
								: `${results.length} found${results.length === 25 ? "+" : ""}`
						}
						subtitle={
							isHindi
								? "किसी पर दबाकर उनका परिवार देखें"
								: "Tap someone to see their family"
						}
					>
						{results.length === 0 ? (
							<p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
								{isHindi
									? "कोई नहीं मिला। नाम की दूसरी स्पेलिंग या फ़ोन नंबर से खोजें।"
									: "No one found. Try another spelling or a phone number."}
							</p>
						) : (
							<ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
								{results.map((r) => {
									const owner = byUid.get(r.uid);
									const member =
										r.kind === "member"
											? owner?.familyMembers?.find((m) => m.id === r.memberId)
											: undefined;
									const g = network.groupOf.get(r.uid);
									const name = member
										? member.realName || member.dikshaName || "—"
										: nameOf(r.uid);
									return (
										<li
											key={`${r.uid}-${r.memberId || ""}`}
											className="flex items-center gap-1"
										>
											<button
												type="button"
												onClick={() => openFamilyOf(r.uid)}
												className="flex-1 min-w-0 min-h-touch flex items-center gap-3 py-2 text-left"
											>
												<Avatar
													name={name}
													photoURL={member ? member.photoURL : owner?.photoURL}
												/>
												<span className="flex-1 min-w-0">
													<span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
														{name}
													</span>
													<span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
														{member
															? isHindi
																? `हाथ से जोड़ा — ${nameOf(r.uid)} के परिवार में`
																: `Added by hand — in ${nameOf(r.uid)}'s family`
															: [
																	owner?.dikshaName && owner.realName
																		? owner.dikshaName
																		: "",
																	personMandal(owner),
																	owner?.phoneNumber || "",
																]
																	.filter(Boolean)
																	.join(" · ")}
													</span>
												</span>
												<span
													className={`shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5 ${g ? "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}
												>
													{g
														? isHindi
															? `${g.members.length} का परिवार`
															: `family of ${g.members.length}`
														: isHindi
															? "कोई लिंक नहीं"
															: "no links"}
												</span>
											</button>
											<EditProfileButton
												target={{ uid: r.uid, memberId: r.memberId }}
												isHindi={isHindi}
												name={name}
												onClosed={afterEdit}
												iconOnly
											/>
										</li>
									);
								})}
							</ul>
						)}
					</Card>
				) : (
					<>
						{/* Numbers */}
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
							<StatTile
								label={isHindi ? "ऐप पर भक्त" : "Devotees on the app"}
								value={stats.total}
							/>
							<StatTile
								label={isHindi ? "परिवार से जुड़े" : "Linked to family"}
								value={stats.connected}
								note={
									isHindi
										? `${pct(stats.connected, stats.total)}% भक्त`
										: `${pct(stats.connected, stats.total)}% of devotees`
								}
							/>
							<StatTile
								label={isHindi ? "जुड़े परिवार" : "Linked families"}
								value={stats.families}
								onClick={() => showFamilies("all")}
								note={
									stats.families
										? isHindi
											? `औसत ${(stats.connected / stats.families).toFixed(1)} लोग`
											: `avg ${(stats.connected / stats.families).toFixed(1)} people`
										: undefined
								}
							/>
							<StatTile
								label={isHindi ? "सबसे बड़ा परिवार" : "Largest family"}
								value={stats.largest}
								onClick={
									mandalGroups[0]
										? () => {
												setOpenGroupId(mandalGroups[0].id);
												setCentre(mandalGroups[0].members[0]);
											}
										: undefined
								}
								note={
									mandalGroups[0]
										? nameOf(mandalGroups[0].members[0])
										: undefined
								}
							/>
							<StatTile
								label={isHindi ? "हाथ से जोड़े सदस्य" : "Added by hand"}
								value={stats.handAdded}
								note={
									stats.solo
										? isHindi
											? `${stats.solo} बिना लिंक वाले भक्तों के भी`
											: `incl. ${stats.solo} devotees with no links`
										: undefined
								}
							/>
							<StatTile
								label={isHindi ? "लिंक अनुरोध बाकी" : "Link requests waiting"}
								value={pendingRequests ?? "—"}
							/>
						</div>

						{/* The global chart */}
						<Card
							icon={<Network size={18} />}
							title={isHindi ? "सभी परिवारों का नक्शा" : "Map of all families"}
							subtitle={
								isHindi
									? "हर गोला एक परिवार, हर बिंदु एक भक्त, रेखा = आपस में लिंक। बड़े परिवार ऊपर। दबाकर खोलें।"
									: "Each bubble is a family, each dot a devotee, lines are links. Biggest on top. Tap to open."
							}
						>
							{mandalGroups.length === 0 ? (
								<p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
									{isHindi
										? "अभी कोई परिवार आपस में लिंक नहीं है।"
										: "No families are linked yet."}
								</p>
							) : (
								<>
									<FamilyNetworkMap
										groups={mandalGroups.slice(0, mapLimit)}
										nameOf={nameOf}
										isHindi={isHindi}
										onOpen={(g) => {
											setOpenGroupId(g.id);
											setCentre(g.members[0]);
										}}
									/>
									<div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
										<span className="flex items-center gap-1.5">
											<span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
											{isHindi ? "सब आपस में जुड़े" : "Everyone linked"}
										</span>
										<span className="flex items-center gap-1.5">
											<span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
											<AlertTriangle size={11} className="text-amber-500" />
											{isHindi ? "अधूरे जुड़े" : "Partly linked"}
										</span>
										<span className="flex items-center gap-1.5">
											<span className="w-5 border-t border-dashed border-slate-400" />
											{isHindi ? "अपने-आप जुड़ा" : "Linked automatically"}
										</span>
									</div>
									{mandalGroups.length > mapLimit && (
										<button
											type="button"
											onClick={() => setMapLimit((n) => n + MAP_PAGE * 2)}
											className="mt-3 w-full min-h-touch rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-pink-600 dark:text-pink-400"
										>
											{isHindi
												? `और परिवार दिखाएँ (${mandalGroups.length - mapLimit} बाकी)`
												: `Show more families (${mandalGroups.length - mapLimit} more)`}
										</button>
									)}
								</>
							)}
						</Card>

						{/* Family sizes */}
						<Card
							icon={<Users size={18} />}
							title={isHindi ? "परिवार कितने बड़े हैं" : "How big families are"}
							subtitle={
								isHindi
									? "एक परिवार में ऐप पर कितने लोग आपस में जुड़े हैं"
									: "Linked accounts per family"
							}
						>
							<div className="space-y-1">
								{sizeBuckets.map((b) => (
									<BarRow
										key={b.label}
										label={isHindi ? `${b.label} लोग` : `${b.label} people`}
										value={b.count}
										max={maxBucket}
										text={
											isHindi
												? `${b.count} परिवार`
												: `${b.count} ${b.count === 1 ? "family" : "families"}`
										}
									/>
								))}
							</div>
						</Card>

						{/* Mandal-wise */}
						{mandalRows.length > 1 && (
							<Card
								icon={<MapPin size={18} />}
								title={isHindi ? "मंडल के अनुसार" : "By mandal"}
								subtitle={
									isHindi
										? "हर मंडल के कितने भक्त परिवार से जुड़े हैं। दबाकर उस मंडल को चुनें।"
										: "How many devotees of each mandal are linked to family. Tap to pick that mandal."
								}
							>
								<div className="space-y-0.5">
									{mandalRows.map((m) => (
										<BarRow
											key={m.mandalId || "none"}
											label={mandalName(m.mandalId)}
											value={m.connected}
											max={m.total}
											active={mandal === m.mandalId}
											text={`${m.connected}/${m.total} · ${pct(m.connected, m.total)}%`}
											title={
												isHindi
													? `${m.total} में से ${m.connected} परिवार से जुड़े`
													: `${m.connected} of ${m.total} linked to family`
											}
											onClick={() => {
												setMandal(mandal === m.mandalId ? "all" : m.mandalId);
												setListLimit(LIST_PAGE);
												setMapLimit(MAP_PAGE);
											}}
										/>
									))}
								</div>
							</Card>
						)}

						{/* Needs attention */}
						{(stats.partly > 0 ||
							oneWay.length > 0 ||
							stats.noRelations > 0) && (
							<Card
								icon={<AlertTriangle size={18} />}
								title={isHindi ? "ध्यान दें" : "Needs attention"}
							>
								<div className="space-y-2">
									{stats.partly > 0 && (
										<button
											type="button"
											onClick={() => showFamilies("partly")}
											className="w-full min-h-touch flex items-center gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 px-3 py-2 text-left"
										>
											<span className="flex-1 text-sm text-amber-800 dark:text-amber-300">
												{isHindi
													? `${stats.partly} परिवार अधूरे जुड़े हैं — भक्त प्रोफाइल मैनेजमेंट में “सब ठीक करें” दबाएँ`
													: `${stats.partly} families are only partly linked — use “Fix all” in Devotee Management`}
											</span>
											<ChevronRight
												size={16}
												className="text-amber-500 shrink-0"
											/>
										</button>
									)}
									{stats.noRelations > 0 && (
										<button
											type="button"
											onClick={() => showFamilies("noRelations")}
											className="w-full min-h-touch flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-left"
										>
											<span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
												{isHindi
													? `${stats.noRelations} परिवारों में कोई रिश्ता नहीं भरा`
													: `${stats.noRelations} families have no relations set`}
											</span>
											<ChevronRight
												size={16}
												className="text-slate-400 shrink-0"
											/>
										</button>
									)}
									{oneWay.length > 0 && (
										<div className="rounded-xl bg-slate-50 dark:bg-slate-900/50">
											<button
												type="button"
												onClick={() => setShowOneWay((s) => !s)}
												className="w-full min-h-touch flex items-center gap-3 px-3 py-2 text-left"
											>
												<span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
													{isHindi
														? `${oneWay.length} आधे लिंक — एक ने जोड़ा, दूसरे की प्रोफाइल में नहीं`
														: `${oneWay.length} half links — one side has it, the other doesn't`}
												</span>
												<ChevronDown
													size={16}
													className={`text-slate-400 shrink-0 transition-transform ${showOneWay ? "rotate-180" : ""}`}
												/>
											</button>
											{showOneWay && (
												<ul className="px-3 pb-2 space-y-1">
													{oneWay.slice(0, 50).map((l) => (
														<li
															key={`${l.from}-${l.to}`}
															className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
														>
															<button
																type="button"
																onClick={() => setTreeUid(l.from)}
																className="font-bold underline decoration-dotted"
															>
																{nameOf(l.from)}
															</button>
															<Link2 size={11} className="text-slate-400" />
															<button
																type="button"
																onClick={() => setTreeUid(l.to)}
																className="underline decoration-dotted"
															>
																{nameOf(l.to)}
															</button>
														</li>
													))}
													<li className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-snug">
														{isHindi
															? "ठीक करने के लिए: भक्त प्रोफाइल मैनेजमेंट → पहले व्यक्ति को एडिट → दूसरे को “सीधे जोड़ें” से दोबारा जोड़ें, या अलग करें।"
															: "To fix: Devotee Management → edit the first person → link the other again with “Force Link”, or unlink."}
													</li>
												</ul>
											)}
										</div>
									)}
								</div>
							</Card>
						)}

						{/* Family list */}
						<div id="family-explorer-list" className="scroll-mt-4 space-y-3">
							<div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
								{filterChips.map((c) => (
									<button
										key={c.id}
										type="button"
										onClick={() => {
											setFamilyFilter(c.id);
											setListLimit(LIST_PAGE);
										}}
										aria-pressed={familyFilter === c.id}
										className={`shrink-0 min-h-[36px] px-3 rounded-full text-xs font-bold border transition ${
											familyFilter === c.id
												? "bg-pink-500 border-pink-500 text-white"
												: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
										}`}
									>
										{isHindi ? c.hi : c.en} · {c.n}
									</button>
								))}
							</div>

							{listedGroups.length === 0 ? (
								<p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
									{isHindi ? "यहाँ कोई परिवार नहीं" : "No families here"}
								</p>
							) : (
								listedGroups.slice(0, listLimit).map((g) => (
									<button
										key={g.id}
										type="button"
										onClick={() => {
											setOpenGroupId(g.id);
											setCentre(g.members[0]);
										}}
										className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 flex items-center gap-3 active:scale-[0.99] transition"
									>
										<div className="flex -space-x-3 shrink-0">
											{g.members.slice(0, 3).map((uid) => (
												<Avatar
													key={uid}
													name={nameOf(uid)}
													photoURL={photoOf(uid)}
													size={36}
												/>
											))}
										</div>
										<span className="flex-1 min-w-0">
											<span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
												{g.members.slice(0, 3).map(nameOf).join(", ")}
												{g.members.length > 3
													? ` +${g.members.length - 3}`
													: ""}
											</span>
											<span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
												{isHindi
													? `${g.members.length} ऐप पर${g.handAdded ? ` · ${g.handAdded} हाथ से` : ""} · ${g.mandals.map(mandalName).join(", ") || "मंडल नहीं"}`
													: `${g.members.length} on the app${g.handAdded ? ` · ${g.handAdded} by hand` : ""} · ${g.mandals.map(mandalName).join(", ") || "no mandal"}`}
											</span>
											{(g.missingPairs > 0 || g.relationsSet === 0) && (
												<span className="flex flex-wrap gap-1 mt-1">
													{g.missingPairs > 0 && (
														<span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
															⚠{" "}
															{isHindi
																? `${g.missingPairs} लिंक बाकी`
																: `${g.missingPairs} ${g.missingPairs === 1 ? "link" : "links"} missing`}
														</span>
													)}
													{g.relationsSet === 0 && (
														<span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
															{isHindi ? "रिश्ते नहीं भरे" : "no relations"}
														</span>
													)}
												</span>
											)}
										</span>
										<ChevronRight
											size={18}
											className="text-slate-300 shrink-0"
										/>
									</button>
								))
							)}
							{listedGroups.length > listLimit && (
								<button
									type="button"
									onClick={() => setListLimit((n) => n + LIST_PAGE)}
									className="w-full min-h-touch rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-pink-600 dark:text-pink-400"
								>
									{isHindi
										? `और दिखाएँ (${listedGroups.length - listLimit} बाकी)`
										: `Show more (${listedGroups.length - listLimit} more)`}
								</button>
							)}
						</div>
					</>
				)}
			</div>
			{treeSheet}
		</div>
	);
};

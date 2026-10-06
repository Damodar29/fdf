import { relationSuggestionsFor } from "./familyChains";
import { findLinkedTwin, repeatedHandAddedIds } from "./familyDedupe";

/**
 * The whole community's family links, for the admin Family Explorer
 * (Community Manager → Family Explorer): who is connected to whom, how big
 * each family is, and what needs fixing. Read-only — nothing here writes.
 *
 * A family group is everyone reachable through two-way links (both profiles
 * list each other in linkedFamilyMembers), the same rule as
 * utils/familyGroupFix.ts and the syncFamilyLinkGroups Cloud Function.
 */

export interface NetworkMember {
	id: string;
	realName?: string;
	dikshaName?: string;
	dikshaDate?: string;
	relation?: string;
	photoURL?: string;
	noAppReason?: string;
}

/** The profile fields the explorer reads. */
export interface NetworkProfile {
	uid: string;
	realName?: string;
	dikshaName?: string;
	dikshaDate?: string;
	email?: string | null;
	phoneNumber?: string;
	photoURL?: string;
	mandalId?: string;
	customMandalName?: string;
	gender?: string;
	isDeleted?: boolean;
	mergedIntoUid?: string;
	linkedFamilyMembers?: string[];
	linkedFamilyRelations?: Record<string, string>;
	linkedFamilyVia?: Record<string, string>;
	familyMembers?: NetworkMember[];
}

export interface FamilyEdge {
	a: string;
	b: string;
	/** Made automatically (linked through someone), not by the two of them. */
	auto: boolean;
	/** How many of the two sides have set a relation (0, 1 or 2). */
	relationsSet: number;
}

export interface FamilyGroup {
	/** Stable id: the smallest uid in the group. */
	id: string;
	/** Accounts in the group, the best-connected first. */
	members: string[];
	edges: FamilyEdge[];
	/** Hand-added members of everyone in the group (doubles left out). */
	handAdded: number;
	/** Pairs in the group that are not linked to each other yet. */
	missingPairs: number;
	/** Relations set, out of every "A calls B …" slot on the links. */
	relationsSet: number;
	relationsTotal: number;
	/** Mandal ids of the members, most common first. */
	mandals: string[];
}

export interface SizeBucket {
	label: string;
	min: number;
	max: number;
	count: number;
}

export interface MandalShare {
	mandalId: string;
	total: number;
	connected: number;
}

export interface FamilyNetwork {
	/** Groups of two or more accounts, biggest first. */
	groups: FamilyGroup[];
	groupOf: Map<string, FamilyGroup>;
	/** Accounts not linked to anyone that have hand-added family members. */
	soloWithFamily: string[];
	/** Counted accounts (active, with a started profile or a link). */
	accounts: number;
	/** Accounts in a family group. */
	connected: number;
	handAddedTotal: number;
	largest: number;
	/** A lists B, but B does not list A — half a link. */
	oneWayLinks: { from: string; to: string }[];
	sizeBuckets: SizeBucket[];
	byMandal: MandalShare[];
	/** Groups whose members come from more than one mandal. */
	crossMandal: number;
}

const isActive = (p: NetworkProfile | undefined): p is NetworkProfile =>
	!!p && p.isDeleted !== true && !p.mergedIntoUid;

/** Hand-added members of `owner` that are not doubles of a linked account. */
export function ownHandAdded(
	owner: NetworkProfile,
	linked: NetworkProfile[],
): NetworkMember[] {
	const members = (owner.familyMembers || []).filter((m) => m?.id);
	const repeated = repeatedHandAddedIds(members);
	const linkedLike = linked.map((l) => ({
		id: l.uid,
		realName: l.realName,
		dikshaName: l.dikshaName,
		dikshaDate: l.dikshaDate,
	}));
	return members.filter(
		(m) =>
			!repeated.has(m.id) &&
			!findLinkedTwin(m, linkedLike, owner.linkedFamilyRelations),
	);
}

const BUCKETS: Omit<SizeBucket, "count">[] = [
	{ label: "2", min: 2, max: 2 },
	{ label: "3", min: 3, max: 3 },
	{ label: "4", min: 4, max: 4 },
	{ label: "5", min: 5, max: 5 },
	{ label: "6–9", min: 6, max: 9 },
	{ label: "10+", min: 10, max: Number.POSITIVE_INFINITY },
];

/**
 * Builds the network. `isCounted` picks the accounts that count as devotees
 * (default: every active one); linked accounts always count.
 */
export function buildFamilyNetwork(
	profiles: NetworkProfile[],
	isCounted: (p: NetworkProfile) => boolean = () => true,
): FamilyNetwork {
	const byUid = new Map<string, NetworkProfile>();
	for (const p of profiles) if (isActive(p)) byUid.set(p.uid, p);
	const links = new Map<string, Set<string>>();
	for (const [uid, p] of byUid)
		links.set(uid, new Set((p.linkedFamilyMembers || []).filter(Boolean)));
	const twoWay = (a: string, b: string) =>
		a !== b && !!links.get(a)?.has(b) && !!links.get(b)?.has(a);
	const neighbours = (uid: string) =>
		[...(links.get(uid) || [])].filter((o) => byUid.has(o) && twoWay(uid, o));

	const oneWayLinks: { from: string; to: string }[] = [];
	for (const [uid, set] of links)
		for (const other of set)
			if (other !== uid && byUid.has(other) && !links.get(other)?.has(uid))
				oneWayLinks.push({ from: uid, to: other });

	const groups: FamilyGroup[] = [];
	const groupOf = new Map<string, FamilyGroup>();
	const done = new Set<string>();
	for (const uid of byUid.keys()) {
		if (done.has(uid)) continue;
		const members = [uid];
		done.add(uid);
		for (let i = 0; i < members.length; i++)
			for (const next of neighbours(members[i])) {
				if (done.has(next)) continue;
				done.add(next);
				members.push(next);
			}
		if (members.length < 2) continue;

		const inGroup = new Set(members);
		const degree = new Map<string, number>();
		const edges: FamilyEdge[] = [];
		let relationsSet = 0;
		for (const a of members)
			for (const b of neighbours(a)) {
				degree.set(a, (degree.get(a) || 0) + 1);
				if (a >= b || !inGroup.has(b)) continue;
				const pa = byUid.get(a);
				const pb = byUid.get(b);
				const set =
					Number(!!pa?.linkedFamilyRelations?.[b]) +
					Number(!!pb?.linkedFamilyRelations?.[a]);
				relationsSet += set;
				edges.push({
					a,
					b,
					auto: !!pa?.linkedFamilyVia?.[b] || !!pb?.linkedFamilyVia?.[a],
					relationsSet: set,
				});
			}
		members.sort(
			(x, y) => (degree.get(y) || 0) - (degree.get(x) || 0) || (x < y ? -1 : 1),
		);
		const n = members.length;
		const mandalCount = new Map<string, number>();
		let handAdded = 0;
		for (const uid of members) {
			const p = byUid.get(uid);
			if (!p) continue;
			const m = p.mandalId || "";
			if (m) mandalCount.set(m, (mandalCount.get(m) || 0) + 1);
			const linked = neighbours(uid)
				.map((o) => byUid.get(o))
				.filter(isActive);
			handAdded += ownHandAdded(p, linked).length;
		}
		const group: FamilyGroup = {
			id: [...members].sort()[0],
			members,
			edges,
			handAdded,
			missingPairs: (n * (n - 1)) / 2 - edges.length,
			relationsSet,
			relationsTotal: edges.length * 2,
			mandals: [...mandalCount].sort((x, y) => y[1] - x[1]).map(([id]) => id),
		};
		groups.push(group);
		for (const m of members) groupOf.set(m, group);
	}
	groups.sort(
		(a, b) =>
			b.members.length - a.members.length ||
			b.handAdded - a.handAdded ||
			(a.id < b.id ? -1 : 1),
	);

	let accounts = 0;
	let handAddedTotal = 0;
	const soloWithFamily: string[] = [];
	const mandals = new Map<string, MandalShare>();
	for (const [uid, p] of byUid) {
		const inGroup = groupOf.has(uid);
		if (!inGroup && !isCounted(p)) continue;
		accounts++;
		const key = p.mandalId || "";
		const share = mandals.get(key) || { mandalId: key, total: 0, connected: 0 };
		share.total++;
		if (inGroup) share.connected++;
		mandals.set(key, share);
		if (!inGroup) {
			const own = ownHandAdded(p, []).length;
			if (own > 0) {
				soloWithFamily.push(uid);
				handAddedTotal += own;
			}
		}
	}
	for (const g of groups) handAddedTotal += g.handAdded;
	const connected = groups.reduce((n, g) => n + g.members.length, 0);

	return {
		groups,
		groupOf,
		soloWithFamily,
		accounts,
		connected,
		handAddedTotal,
		largest: groups[0]?.members.length || 0,
		oneWayLinks,
		sizeBuckets: BUCKETS.map((b) => ({
			...b,
			count: groups.filter(
				(g) => g.members.length >= b.min && g.members.length <= b.max,
			).length,
		})),
		byMandal: [...mandals.values()].sort(
			(a, b) => b.total - a.total || (a.mandalId < b.mandalId ? -1 : 1),
		),
		crossMandal: groups.filter((g) => g.mandals.length > 1).length,
	};
}

/** One person in a family tree (same shape as FamilyTreeView's FamilyTreePerson). */
export interface TreePerson {
	key: string;
	name: string;
	photoURL?: string;
	relation?: string;
	linked: boolean;
	via?: string;
	suggested?: string;
}

const displayName = (p?: {
	realName?: string;
	dikshaName?: string;
	email?: string | null;
}) => p?.realName || p?.dikshaName || p?.email || "";

/**
 * The family tree as `centerUid` sees it: their linked accounts (with the
 * relation they set, or a likely one) and the members they added by hand —
 * each person once, like the devotee's own Profile → Family Tree.
 */
export function familyTreeFor(
	centerUid: string,
	byUid: Map<string, NetworkProfile>,
): { me: { name: string; photoURL?: string }; people: TreePerson[] } {
	const center = byUid.get(centerUid);
	if (!center) return { me: { name: "" }, people: [] };
	const myRelations = center.linkedFamilyRelations;
	const linked = (center.linkedFamilyMembers || [])
		.filter((uid) => uid !== centerUid)
		.map((uid) => byUid.get(uid))
		.filter(isActive);

	const info = linked.map((m) => ({
		id: m.uid,
		gender: m.gender === "male" || m.gender === "female" ? m.gender : "",
		theirRelationForMe: m.linkedFamilyRelations?.[centerUid],
		familyRelations: m.linkedFamilyRelations,
	})) as Parameters<typeof relationSuggestionsFor>[1];

	// A hand-added double of a linked account lends it relation and photo.
	const members = (center.familyMembers || []).filter((m) => m?.id);
	const repeated = repeatedHandAddedIds(members);
	const linkedLike = linked.map((l) => ({
		id: l.uid,
		realName: l.realName,
		dikshaName: l.dikshaName,
		dikshaDate: l.dikshaDate,
	}));
	const twinOf = new Map<string, NetworkMember>();
	const handAdded = members.filter((m) => {
		if (repeated.has(m.id)) return false;
		const twin = findLinkedTwin(m, linkedLike, myRelations);
		if (twin && !twinOf.has(twin.id)) {
			twinOf.set(twin.id, m);
			return false;
		}
		return true;
	});

	return {
		me: { name: displayName(center), photoURL: center.photoURL },
		people: [
			...handAdded.map((m) => ({
				key: `m_${m.id}`,
				name: m.realName || m.dikshaName || "",
				photoURL: m.photoURL,
				relation: m.relation,
				linked: false,
			})),
			...linked.map((m) => {
				const viaUid = center.linkedFamilyVia?.[m.uid];
				const twin = twinOf.get(m.uid);
				const relation = myRelations?.[m.uid];
				return {
					key: `l_${m.uid}`,
					name: displayName(m),
					photoURL: m.photoURL || twin?.photoURL,
					relation,
					linked: true,
					via: viaUid ? `l_${viaUid}` : undefined,
					suggested: relation
						? undefined
						: twin?.relation ||
							relationSuggestionsFor(m.uid, info, myRelations, viaUid)[0],
				};
			}),
		],
	};
}

/** Points evenly on a circle (one in the middle, two side by side). */
export function ringLayout(
	n: number,
	radius: number,
): { x: number; y: number }[] {
	if (n <= 0) return [];
	if (n === 1) return [{ x: 0, y: 0 }];
	// Start at the top so the best-connected member sits highest.
	return Array.from({ length: n }, (_, i) => {
		const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
		return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
	});
}

/**
 * Circles laid out in rows like words in a paragraph, each row centred —
 * given biggest first, the biggest families sit on top. Returns centres and
 * the total height.
 */
export function packRows(
	radii: number[],
	width: number,
	gap: number,
): { centres: { x: number; y: number }[]; height: number } {
	const centres: { x: number; y: number }[] = [];
	let row: number[] = [];
	let rowWidth = 0;
	let y = gap;
	const flush = () => {
		if (!row.length) return;
		const tallest = Math.max(...row.map((i) => radii[i]));
		let x = (width - rowWidth) / 2;
		for (const i of row) {
			x += radii[i];
			centres[i] = { x, y: y + tallest };
			x += radii[i] + gap;
		}
		y += tallest * 2 + gap;
		row = [];
		rowWidth = 0;
	};
	radii.forEach((r, i) => {
		const needed = r * 2 + (row.length ? gap : 0);
		if (row.length && rowWidth + needed > width - gap * 2) flush();
		rowWidth += row.length ? r * 2 + gap : r * 2;
		row.push(i);
	});
	flush();
	return { centres, height: y };
}

import {
	collection,
	doc,
	getDoc,
	getFirestore,
	onSnapshot,
	orderBy,
	query,
} from "@react-native-firebase/firestore";
import { create } from "zustand";
import type { EventData } from "../types";
import { toCdnUrl } from "../lib/cdnUrl";

// What the Home screen shows from the cloud — in the OG app this comes from
// SharedFirebaseContext (mandals, videos, video folders, the darshan/activity
// folder configs), SettingsContext (banners, live status, the information
// screen) and HomeScreen itself (glorification publish state, the GitHub
// darshan/activity releases and the daily quote images). Firestore keeps its
// own offline cache, so Home fills from the last session when offline.

export type BannerActionType = "link" | "bhajan" | "lecture" | "screen";
export interface BannerConfig {
	id: string;
	enabled: boolean;
	title: string;
	body: string;
	actionType?: BannerActionType;
	actionTarget?: string;
	actionLabel?: string;
	color?: string;
}

export interface SocialStatus {
	isYoutubeLive: boolean;
	youtubeLiveLink?: string;
	isFacebookLive: boolean;
	facebookLiveLink?: string;
	isInstagramLive: boolean;
	instagramLiveLink?: string;
}

export interface InformationItem {
	id: string;
	title: string;
	text: string;
	images?: string[];
	imageUrl?: string;
	imageUrl2?: string;
	imageUrl3?: string;
	actionType?: "none" | "link" | "phone" | "location";
	actionLabel?: string;
	actionTarget?: string;
	isEnabled?: boolean;
	expiryDate?: number;
	createdAt?: number;
}
export interface InformationData {
	enabled: boolean;
	items?: InformationItem[];
	title?: string;
	text?: string;
	imageUrl?: string;
	imageUrl2?: string;
	imageUrl3?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: Firestore documents are loosely shaped, as in the OG app
type AnyDoc = any;

interface HomeDataState {
	mandals: AnyDoc[];
	videos: AnyDoc[];
	videoFolders: AnyDoc[];
	activityFolders: AnyDoc | null;
	darshanFolders: AnyDoc | null;
	banners: BannerConfig[];
	social: SocialStatus;
	information: InformationData | null;
	glorificationPublished: boolean;
	glorificationIds: string[];
	howToUseUrl: string;
	quotesImages: string[];
	/** Today's quote image (the daily quote popup), null until known / when there is none. */
	quoteToday: string | null;
	darshanReleases: AnyDoc[];
	activityReleases: AnyDoc[];
	events: EventData[];
}

export const useHomeDataStore = create<HomeDataState>(() => ({
	mandals: [],
	videos: [],
	videoFolders: [],
	activityFolders: null,
	darshanFolders: null,
	banners: [],
	social: { isYoutubeLive: false, isFacebookLive: false, isInstagramLive: false },
	information: null,
	glorificationPublished: false,
	glorificationIds: [],
	howToUseUrl: "https://www.youtube.com/watch?v=kYIIfyRk49k",
	quotesImages: [],
	quoteToday: null,
	darshanReleases: [],
	activityReleases: [],
	events: [],
}));

const set = useHomeDataStore.setState;
const truthy = (v: unknown) => v === true || v === "true";
const docsOf = (snap: { docs: { id: string; data(): AnyDoc }[] }) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/* ─────────────────────────── GitHub ─────────────────────────── */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
// Day of year on a fixed leap-year calendar, as the quote files are named.
const staticDayOfYear = (d: Date) => {
	const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	let doy = 0;
	for (let i = 0; i < d.getMonth(); i++) doy += days[i];
	return doy + d.getDate();
};

let githubToken: string | null = null;
const github = (url: string) =>
	fetch(url, { headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github.v3+json" } }).then((r) => {
		if (!r.ok) throw new Error(`GitHub API ${r.status}`);
		return r.json();
	});

/** The last five days' quote images (newest first) from release "1". */
async function loadQuotes() {
	const data = await github("https://api.github.com/repos/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/releases/tags/1");
	const assets: { name: string; browser_download_url: string }[] = data.assets || [];
	const out: string[] = [];
	const today = new Date();
	for (let i = 0; i < 5; i++) {
		const d = new Date(today);
		d.setDate(d.getDate() - i);
		const base = `${String(staticDayOfYear(d)).padStart(3, "0")}.${d.getDate()}.${MONTHS[d.getMonth()]}`;
		const match = assets.find((a) => a.name.startsWith(base));
		if (match) out.push(toCdnUrl(match.browser_download_url));
		if (i === 0) set({ quoteToday: match ? toCdnUrl(match.browser_download_url) : null });
	}
	set({ quotesImages: out });
}

// Darshan and Activities read the same release list (~160 KB): one request
// when both ask within a few seconds, as the OG Home does.
let releasesRequest: { at: number; promise: Promise<AnyDoc[]> } | null = null;
function fetchReleaseList(): Promise<AnyDoc[]> {
	if (releasesRequest && Date.now() - releasesRequest.at < 10000) return releasesRequest.promise;
	const promise: Promise<AnyDoc[]> = github(
		`https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?t=${Date.now()}&per_page=100`,
	);
	releasesRequest = { at: Date.now(), promise };
	// A failed request must not be reused by the next caller.
	promise.catch(() => {
		if (releasesRequest?.promise === promise) releasesRequest = null;
	});
	return promise;
}

async function loadReleases(kind: "darshan" | "activity") {
	const config = kind === "darshan" ? useHomeDataStore.getState().darshanFolders : useHomeDataStore.getState().activityFolders;
	if (!githubToken || !config) return;
	const visible: number[] = config.visibleIds || [];
	const releases: AnyDoc[] = await fetchReleaseList();
	const filtered = releases.filter((r) => visible.includes(r.id));
	set(kind === "darshan" ? { darshanReleases: filtered } : { activityReleases: filtered });
}

/* ─────────────────────────── start ─────────────────────────── */

let started = false;
/** Starts the listeners once for the app's lifetime. */
export function startHomeData() {
	if (started) return;
	started = true;
	const db = getFirestore();
	const quiet = () => {};

	onSnapshot(collection(db, "mandals"), (s) => set({ mandals: docsOf(s) }), quiet);
	onSnapshot(query(collection(db, "videos"), orderBy("order", "asc")), (s) => set({ videos: docsOf(s) }), quiet);
	onSnapshot(query(collection(db, "video_folders"), orderBy("order", "asc")), (s) => set({ videoFolders: docsOf(s) }), quiet);
	onSnapshot(
		doc(db, "app_config", "activity_folders"),
		(s) => {
			set({ activityFolders: s.exists() ? { id: s.id, ...s.data() } : null });
			loadReleases("activity").catch(quiet);
		},
		quiet,
	);
	onSnapshot(
		doc(db, "app_config", "darshan_folders"),
		(s) => {
			set({ darshanFolders: s.exists() ? { id: s.id, ...s.data() } : null });
			loadReleases("darshan").catch(quiet);
		},
		quiet,
	);
	onSnapshot(
		doc(db, "app_config", "app_settings"),
		(s) => {
			const list = s.exists() ? s.data()?.banners : null;
			set({ banners: Array.isArray(list) ? list.filter((b: BannerConfig) => b?.enabled) : [] });
		},
		quiet,
	);
	onSnapshot(
		doc(db, "app_config", "social_media"),
		(s) => {
			const d = s.exists() ? s.data() : null;
			if (!d) return;
			set({
				social: {
					isYoutubeLive: truthy(d.isYoutubeLive),
					youtubeLiveLink: d.youtubeLiveLink,
					isFacebookLive: truthy(d.isFacebookLive),
					facebookLiveLink: d.facebookLiveLink,
					isInstagramLive: truthy(d.isInstagramLive),
					instagramLiveLink: d.instagramLiveLink,
				},
			});
		},
		quiet,
	);
	onSnapshot(
		doc(db, "app_config", "information_screen"),
		(s) => {
			const d = s.exists() ? s.data() : null;
			if (!d) return;
			set({ information: { enabled: truthy(d.enabled), items: d.items, title: d.title || "" } });
		},
		quiet,
	);
	onSnapshot(
		doc(db, "app-settings", "glorification-reader"),
		(s) => {
			const d = s.exists() ? s.data() : null;
			set({ glorificationPublished: d?.isPublished === true, glorificationIds: d?.publishedIds || [] });
		},
		() => set({ glorificationPublished: false, glorificationIds: [] }),
	);
	getDoc(doc(db, "app_config", "settings"))
		.then((s) => {
			const url = s.data()?.youtubeHowToUseUrl;
			if (typeof url === "string" && url) set({ howToUseUrl: url });
		})
		.catch(quiet);

	getDoc(doc(db, "damtoken", "github_public"))
		.then((s) => {
			const token = s.data()?.token?.trim();
			if (!token) return;
			githubToken = token;
			loadQuotes().catch(quiet);
			loadReleases("darshan").catch(quiet);
			loadReleases("activity").catch(quiet);
		})
		.catch(quiet);

	onSnapshot(
		collection(db, "Calendar"),
		(querySnapshot) => {
			const newEvents: EventData[] = [];
			let idCounter = 1;

			querySnapshot.forEach((docSnap) => {
				const data = docSnap.data();
				if (data) {
					for (const dateKey in data) {
						const dayEvents = data[dateKey];
						if (Array.isArray(dayEvents)) {
							dayEvents.forEach((ev) => {
								newEvents.push({
									id: `fb-${idCounter++}`,
									date: dateKey,
									title: ev.eventName || ev.title || "",
									time: ev.time || "",
									breakTime: ev.breakTime || ev.time || "",
									eventTime: ev.eventTime || "",
									isEkadashi: ev.isEkadashi || false,
									description: ev.description || "",
									location: ev.location || "",
									type: ev.type || "other",
								});
							});
						}
					}
				}
			});
			set({ events: newEvents });
		},
		quiet,
	);
}

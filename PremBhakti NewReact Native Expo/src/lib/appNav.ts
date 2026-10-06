import { Linking, Platform } from "react-native";
import { navigationRef } from "../navigation/RootNavigator";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import type { WebTarget } from "../screens/WebScreen";
import { useAuthStore } from "../store/authStore";
import { useContentStore } from "../store/contentStore";
import { showToast } from "../store/toastStore";
import { useSettingsStore } from "../store/settingsStore";
import type { Bhajan, LectureData } from "../types";
import { storage } from "./storage";

// Opening places in the app from anywhere: Home tiles and banners, pushes,
// links to chaitanyaprembhakti.org. Native screens open natively; the others
// are the Capacitor app's own web screens (WebScreen).

/** Screens that are native now. Remove a line to send that screen back to the WebView. */
export const NATIVE_SCREENS: Partial<Record<string, keyof RootStackParamList>> = {
	about: "About",
	privacy: "Privacy",
	terms: "Terms",
	"guru-maharaj": "GuruMaharaj",
	"virahi-maharaj": "VirahiMaharaj",
	"temple-timings": "TempleTimings",
	seva: "OurCenters",
	quotes: "DailyQuotes",
	information: "Information",
	"glorification-reader": "GlorificationReader",
	events: "VaishnavCalendar",
	videos: "Videos",
	donate: "Donate",
	darshan: "DeityDarshan",
	activities: "Activities",
	photos: "Activities",
};

/** Runs `fn` once the navigator is up (a push or link can arrive before it). */
function whenReady(fn: () => void) {
	if (navigationRef.isReady()) return fn();
	const started = Date.now();
	const timer = setInterval(() => {
		if (navigationRef.isReady() || Date.now() - started > 15000) {
			clearInterval(timer);
			if (navigationRef.isReady()) fn();
		}
	}, 100);
}

export function openWeb(target: WebTarget) {
	whenReady(() => navigationRef.navigate("Web", { target }));
}

export function openTab(name: keyof TabParamList) {
	whenReady(() => navigationRef.navigate("Tabs", { screen: name }));
}

export function openProfile() {
	whenReady(() => {
		if (useAuthStore.getState().user) navigationRef.navigate("Web", { target: { event: "cpbs:openProfile" } });
		else navigationRef.navigate("Login");
	});
}

/** A screen name as the Capacitor app's banners, pushes and `?screen=` links use them. */
export function openScreen(target: string) {
	switch (target) {
		case "home":
			return openTab("Home");
		case "books":
			return openTab("Books");
		case "songs":
			return openTab("Songs");
		case "lectures":
			return openTab("Lectures");
		case "authors":
		case "library":
			return openTab("Library");
		case "settings":
			return whenReady(() => navigationRef.navigate("Settings"));
		case "profile":
			return openProfile();
		case "photos":
			return whenReady(() => navigationRef.navigate("Activities", { initialShowPhotos: true }));
		case "downloads":
		case "downloaded":
			return openTab("Downloads");
		default: {
			const nativeRoute = NATIVE_SCREENS[target];
			if (nativeRoute) return whenReady(() => navigationRef.navigate(nativeRoute as never));
			return openWeb({ screen: target });
		}
	}
}

/** Waits (up to 20s) for the bhajan/katha lists, which are empty on a first start. */
function whenContentLoaded(fn: () => void) {
	const has = () => {
		const s = useContentStore.getState();
		return s.bhajans.length > 0 || s.lectures.length > 0;
	};
	if (has()) return fn();
	const timer = setTimeout(() => {
		unsub();
		fn();
	}, 20000);
	const unsub = useContentStore.subscribe(() => {
		if (!has()) return;
		clearTimeout(timer);
		unsub();
		fn();
	});
}

/**
 * Opens a bhajan or katha by id, as useDeepLinking's navigateToBhajanById:
 * "bhajan-5", "5" or "005" find song number 5; "lecture_003" is a katha.
 */
export function openContentById(id: string, type?: "bhajan" | "lecture") {
	if (!id) return;
	whenContentLoaded(() => {
		const { bhajans, lectures } = useContentStore.getState();
		const num = id.replace(/^bhajan[_-]/i, "").replace(/^lecture[_-]/i, "");
		const numInt = Number.parseInt(num, 10);
		let kind = type;
		if ((kind === undefined || kind === "bhajan") && /^lecture[_-]/i.test(id)) kind = "lecture";

		const findBhajan = (): Bhajan | undefined =>
			bhajans.find(
				(b) =>
					b.id === id ||
					b.songNumber === num ||
					(!Number.isNaN(numInt) && !!b.songNumber && Number.parseInt(b.songNumber, 10) === numInt),
			);
		const findLecture = (): LectureData | undefined => lectures.find((l) => l.id === id || l.id === num);

		let bhajan: Bhajan | undefined;
		let lecture: LectureData | undefined;
		if (kind === "lecture") lecture = findLecture();
		else if (kind === "bhajan") bhajan = findBhajan();
		else {
			bhajan = findBhajan();
			if (!bhajan) lecture = findLecture();
		}

		whenReady(() => {
			if (bhajan) navigationRef.navigate("Reader", { bhajan });
			else if (lecture) navigationRef.navigate("Lecture", { lecture });
			else {
				const hi = useSettingsStore.getState().settingsLanguage === "hi";
				showToast(hi ? "सामग्री नहीं मिली" : "Content not found", "info");
			}
		});
	});
}

const SITE = /^https?:\/\/(?:www\.)?chaitanyaprembhakti\.org(\/[^?#]*)?(\?[^#]*)?/i;

function queryParams(query: string): Map<string, string> {
	return new Map(
		query
			.replace(/^\?/, "")
			.split("&")
			.filter(Boolean)
			.map((kv) => {
				const i = kv.indexOf("=");
				const dec = (s: string) => {
					try {
						return decodeURIComponent(s.replace(/\+/g, " "));
					} catch {
						return s;
					}
				};
				return i < 0 ? [dec(kv), ""] : [dec(kv.slice(0, i)), dec(kv.slice(i + 1))];
			}),
	);
}

/**
 * A chaitanyaprembhakti.org link (shared bhajan, /v/… video or photo link,
 * ?screen=…), opened in the app as useDeepLinking does. False when it is not
 * one of ours.
 */
export function openSiteLink(url: string): boolean {
	const m = SITE.exec(url);
	if (!m) return false;
	const path = m[1] || "/";
	const query = m[2] || "";
	const p = queryParams(query);
	if (p.get("action_type")) {
		openNotification(Object.fromEntries(p));
		return true;
	}
	if (p.get("bhajanId")) {
		openContentById(p.get("bhajanId") as string, "bhajan");
		return true;
	}
	if (p.get("lectureId")) {
		openContentById(p.get("lectureId") as string, "lecture");
		return true;
	}
	if (
		p.get("mandalVideoId") ||
		p.get("mandalPhotos") === "true"
	) {
		whenReady(() => navigationRef.navigate("Activities", {
			initialShowPhotos: p.get("mandalPhotos") === "true",
			target_mandal: p.get("mandalId") || undefined,
			target_date: p.get("mandalDate") || undefined,
			initialVideoId: p.get("mandalVideoId") || undefined,
		}));
		return true;
	}
	if (path.startsWith("/v/folder/")) {
		const folderId = path.replace("/v/folder/", "").replace(/\/$/, "");
		whenReady(() => navigationRef.navigate("Videos", { initialFolderId: folderId }));
		return true;
	}
	if (path.startsWith("/v/video/")) {
		const videoId = path.replace("/v/video/", "").replace(/\/$/, "");
		whenReady(() => navigationRef.navigate("Videos", { initialVideoId: videoId }));
		return true;
	}
	if (path.startsWith("/v/")) {
		// some legacy links might be just /v/xyz
		const videoId = path.replace("/v/", "").replace(/\/$/, "");
		whenReady(() => navigationRef.navigate("Videos", { initialVideoId: videoId }));
		return true;
	}
	if (p.get("videoId") || p.get("videoFolder")) {
		whenReady(() => navigationRef.navigate("Videos", { 
			initialVideoId: p.get("videoId") || undefined,
			initialFolderId: p.get("videoFolder") || undefined
		}));
		return true;
	}
	if (p.get("screen")) {
		openScreen(p.get("screen") as string);
		return true;
	}
	// Site paths that map to screens: /about, /privacy, /terms
	const SITE_PATH_SCREENS: Record<string, string> = {
		"/about": "about",
		"/privacy": "privacy",
		"/terms": "terms",
	};
	const screenForPath = SITE_PATH_SCREENS[path];
	if (screenForPath) {
		openScreen(screenForPath);
		return true;
	}
	return path === "/" ? (openTab("Home"), true) : false;
}

/** Opens a link: ours inside the app, anything else outside. */
export function openLink(url: string) {
	if (!openSiteLink(url)) Linking.openURL(url).catch(() => {});
}

// ── Pushes (utils/NotificationActionHandler.ts) ─────────────────────────────


const PROCESSED_KEY = "cpbs_processed_notification_ids";

function signature(data: Record<string, string>): string {
	const id = data["google.message_id"] || data.messageId || data.id;
	if (id) return `id_${id}`;
	const parts = [
		data.action_type || data.action || data.type || "",
		data.target_screen || data.screen || "",
		data.target_link || data.link || "",
		data.target_mandal || "",
		data.target_date || "",
		data.target_info_id || "",
		data.bhajanId || "",
		data.lectureId || "",
		data.videoId || "",
	];
	const body = data.body || data["gcm.notification.body"] || "";
	const title = data.title || data["gcm.notification.title"] || "";
	parts.push(body || title ? `${title}_${body}` : new Date().toISOString().slice(0, 10));
	return parts.filter(Boolean).join("||");
}

/** The same push is opened once (within 18h), not again on the next app start. */
function firstTime(sig: string): boolean {
	let map: Record<string, number> = {};
	try {
		map = JSON.parse(storage.getString(PROCESSED_KEY) || "{}") || {};
	} catch {}
	const now = Date.now();
	if (map[sig] && now - map[sig] < 18 * 3600_000) return false;
	map[sig] = now;
	const pruned: Record<string, number> = {};
	for (const [k, t] of Object.entries(map)) if (now - t < 24 * 3600_000) pruned[k] = t;
	storage.set(PROCESSED_KEY, JSON.stringify(pruned));
	return true;
}

/** A tapped push: native screens here, everything else by the web app's own handler. */
export function openNotification(raw: Record<string, string>) {
	if (!raw) return;
	// BigPicture actions ("open_quotes", "open_info", "open_screen") as usePushNotifications maps them.
	const data: Record<string, string> =
		raw.action === "open_quotes"
			? { action_type: "screen", target_screen: "quotes", ...raw }
			: raw.action === "open_info"
				? { action_type: "screen", target_screen: "information", ...raw }
				: raw.action && !raw.action_type
					? { ...raw, action_type: raw.action === "open_screen" ? "screen" : raw.action }
					: raw;
	const sig = signature(data);
	if (sig && !firstTime(sig)) return;

	const action = data.action_type;
	if (action === "link" && data.target_link) {
		if (openSiteLink(data.target_link)) return;
		Linking.openURL(data.target_link).catch(() => {});
		return;
	}
	if (action === "screen" && data.target_screen) {
		const screen = data.target_screen;
		// Always-native screens (tabs, Settings, Profile)
		if (["home", "songs", "lectures", "books", "library", "downloaded", "settings", "profile"].includes(screen)) {
			openScreen(screen);
			return;
		}
		// Ported screens: open natively with push params (target_info_id, etc.)
		const nativeRoute = NATIVE_SCREENS[screen];
		if (nativeRoute) {
			const params: Record<string, string> = {};
			if (screen === "photos") params.initialShowPhotos = "true";
			if (data.target_info_id) {
				params.target_info_id = data.target_info_id;
				params.initialItemId = data.target_info_id;
			}
			if (data.target_mandal) {
				params.target_mandal = data.target_mandal;
				params.initialMandalId = data.target_mandal; // for TempleTimings and others
			}
			if (data.target_date) params.target_date = data.target_date;
			if (data.videoId) params.initialVideoId = data.videoId;
			if (data.videoFolder) params.initialFolderId = data.videoFolder;
			whenReady(() => {
				// @ts-ignore
				navigationRef.navigate(nativeRoute, Object.keys(params).length > 0 ? params : undefined);
			});
			return;
		}
	}
	if (data.bhajanId) return openContentById(data.bhajanId, "bhajan");
	if (data.lectureId) return openContentById(data.lectureId, "lecture");
	// Mandal photos/darshan, information items, web screens: the page gets the
	// push like the Capacitor app did (pushNotificationActionPerformed).
	if (action || data.type) openWeb({ notification: data });
}

// Browser preview (`npm run web`): lets checks open pushes and links from the console.
if (__DEV__ && Platform.OS === "web") {
	(globalThis as { __appNav?: unknown }).__appNav = { openNotification, openSiteLink, openScreen, openContentById };
}

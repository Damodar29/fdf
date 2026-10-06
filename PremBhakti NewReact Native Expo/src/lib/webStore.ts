import { useEffect, useState } from "react";
import { createMMKV } from "react-native-mmkv";

// The part of the web screens' localStorage the app also reads or writes:
// NEW-badge seen-state, information read-state, liked/viewed markers, the web
// screens' own view settings. The web screens keep their localStorage (the
// WebView's, at https://localhost) and the app keeps this copy of the shared
// keys; WebScreen writes the copy into the page before it starts and the page
// sends every change back. So the native Home can show the web screens' NEW
// badges, a badge cleared natively stays cleared in the web screens, and the
// Drive backup (lib/backup) carries all of it — as the OG app's backup did.

const local = createMMKV({ id: "web-local" });

/** utils/backup/backupData.ts: backup field → localStorage key, settings part. */
export const BACKUP_SETTINGS_KEYS: Record<string, string> = {
	fontSize: "cpbs_fontsize",
	script: "cpbs_script",
	language: "cpbs_settings_lang",
	scrollSide: "cpbs_scrollbar_side",
	sliderSide: "cpbs_slider_side",
	themeColor: "cpbs_theme_color",
	themeMode: "cpbs_theme_mode",
	textBold: "cpbs_text_bold",
	lineGap: "cpbs_line_gap",
	viewFormat: "cpbs_view_format",
	uiScale: "cpbs_ui_scale",
	keepAwake: "cpbs_awake",
	haptics: "cpbs_haptics",
	indexMode: "cpbs_index_mode",
	readerBookMode: "cpbs_reader_bookmode",
	activityViewMode: "cpbs_activity_view_mode",
	darshanViewMode: "cpbs_darshan_view_mode",
	eventsViewMode: "cpbs_events_view_mode",
	panchangLocation: "panchang_location",
	preferredTemple: "preferred_temple",
	repeatMode: "cpbs_repeat_mode",
	readInfoIds: "cpbs_read_info_ids",
	deviceId: "cpbs_device_id",
	introCompleted: "cpbs_intro_completed",
	mahamantraDismissed: "cpbs_mahamantra_dismissed",
	androidPromoDismissed: "cpbs_android_promo_dismissed",
};

/** backupData.ts: single-key fields. */
export const BACKUP_SINGLE_KEYS: Record<string, string> = {
	recentSearches: "cpbs_recent_searches",
	infoViewedItems: "cpbs_viewed_info",
	infoLikedItems: "cpbs_liked_info",
	lastReadInfoTitle: "cpbs_last_read_info_title",
	quoteLastSeenDate: "cpbs_quote_last_seen_date",
	quoteLastSeenAfternoon: "cpbs_quote_last_seen_afternoon",
	homeActivityLatest: "cpbs_home_activity_latest",
	homeDarshanLatest: "cpbs_home_darshan_latest",
	homeVideoLatest: "cpbs_home_video_latest",
	activityVideoMainLatest: "cpbs_activity_video_main_latest",
	activityPhotosMainLatest: "cpbs_activity_photos_main_latest",
	glorificationReadHash: "allGlorificationsReadHash",
	glorificationVisited: "visitedGlorifications",
};

/** backupData.ts: fields holding every key with these prefixes. */
export const BACKUP_PREFIXED: Record<string, string[]> = {
	personalizedSongs: ["cpbs_personal_"],
	dynamicSeenKeys: [
		"cpbs_activity_gallery_",
		"cpbs_activity_videos_latest_",
		"cpbs_activity_info_",
		"cpbs_darshan_mandal_",
		"cpbs_video_folder_latest_",
		"cpbs_seen_visit_",
	],
	metricsKeys: ["cpbs_likes_", "cpbs_views_"],
};

/**
 * Settings the web screens own. The rest of BACKUP_SETTINGS_KEYS are the
 * app's own settings (WebScreen hands those to the page), and the intro flag
 * is set by WebScreen for every page.
 */
const WEB_SETTINGS = [
	"textBold",
	"activityViewMode",
	"darshanViewMode",
	"eventsViewMode",
	"panchangLocation",
	"preferredTemple",
	"repeatMode",
	"readInfoIds",
	"deviceId",
	"mahamantraDismissed",
	"androidPromoDismissed",
];
// The quote "last seen" dates are left out: WebScreen sets them to today so
// the daily quote popup never covers a screen the devotee opened.
const SHARED_KEYS = new Set([
	...WEB_SETTINGS.map((f) => BACKUP_SETTINGS_KEYS[f]),
	...Object.entries(BACKUP_SINGLE_KEYS)
		.filter(([f]) => f !== "quoteLastSeenDate" && f !== "quoteLastSeenAfternoon" && f !== "recentSearches")
		.map(([, k]) => k),
]);
const SHARED_PREFIXES = Object.values(BACKUP_PREFIXED).flat();

export const isSharedWebKey = (key: string) => SHARED_KEYS.has(key) || SHARED_PREFIXES.some((p) => key.startsWith(p));

/** For the page script: which keys to send back. */
export const SHARED_WEB_KEYS = { keys: [...SHARED_KEYS], prefixes: SHARED_PREFIXES };

export const webGet = (key: string): string | null => local.getString(key) ?? null;

export function webSet(key: string, value: string) {
	if (local.getString(key) !== value) local.set(key, value);
}

export function webRemove(key: string) {
	if (local.contains(key)) local.remove(key);
}

export function webEntries(): Record<string, string> {
	const out: Record<string, string> = {};
	for (const key of local.getAllKeys()) {
		const v = local.getString(key);
		if (v !== undefined) out[key] = v;
	}
	return out;
}

/** Changes reported by a web page. */
export function applyWebChanges(set: Record<string, string>, removed: string[]) {
	for (const [k, v] of Object.entries(set)) if (isSharedWebKey(k) && typeof v === "string") webSet(k, v);
	for (const k of removed) if (isSharedWebKey(k)) webRemove(k);
}

/** Old app's localStorage → the copy, for keys not set here yet (data migration). */
export function seedWebStore(entries: Record<string, string>) {
	for (const [k, v] of Object.entries(entries)) if (isSharedWebKey(k) && !local.contains(k)) local.set(k, v);
}

/** Re-renders the caller whenever a shared key changes (here or in a web screen). */
export function useWebStoreVersion(): number {
	const [version, setVersion] = useState(0);
	useEffect(() => {
		const sub = local.addOnValueChangedListener(() => setVersion((v) => v + 1));
		return () => sub.remove();
	}, []);
	return version;
}

/* ─────────────────────── backup fields ─────────────────────── */

/** The web-owned backup fields, from the copy. */
export function webBackupFields(): { fields: Record<string, unknown>; settings: Record<string, string> } {
	const fields: Record<string, unknown> = {};
	for (const [field, key] of Object.entries(BACKUP_SINGLE_KEYS)) {
		const v = webGet(key);
		if (v !== null) fields[field] = v;
	}
	const keys = local.getAllKeys().sort();
	for (const [field, prefixes] of Object.entries(BACKUP_PREFIXED)) {
		const out: Record<string, string> = {};
		for (const key of keys) if (prefixes.some((p) => key.startsWith(p))) out[key] = webGet(key) ?? "";
		if (Object.keys(out).length) fields[field] = out;
	}
	const settings: Record<string, string> = {};
	for (const field of WEB_SETTINGS) {
		const v = webGet(BACKUP_SETTINGS_KEYS[field]);
		if (v !== null) settings[field] = v;
	}
	return { fields, settings };
}

/** A restored backup's web-owned fields → the copy (and so into the web screens). */
export function applyWebBackupFields(data: Record<string, unknown>) {
	for (const [field, key] of Object.entries(BACKUP_SINGLE_KEYS)) {
		const v = data[field];
		if (typeof v === "string" && isSharedWebKey(key)) webSet(key, v);
	}
	for (const field of Object.keys(BACKUP_PREFIXED)) {
		const obj = data[field];
		if (obj && typeof obj === "object") {
			for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
				if (typeof v === "string" && isSharedWebKey(k)) webSet(k, v);
			}
		}
	}
	const s = (data.settings ?? {}) as Record<string, unknown>;
	for (const field of WEB_SETTINGS) {
		const v = s[field];
		if (typeof v === "string") webSet(BACKUP_SETTINGS_KEYS[field], v);
	}
}

/**
 * What a user backup contains, and how it is written back.
 *
 * Everything here lives in localStorage (DataContext mirrors playlists,
 * bookmarks and history there), so a backup can be built from anywhere without
 * React state — the automatic backup and the Google Drive button share it.
 *
 * Content itself (bhajans, books, lectures, photos, videos) is never included:
 * it re-syncs from the server. Only the devotee's own data and "what I have
 * already seen / liked / read" state is.
 */
import { safeLocalSet } from "../safeLocalSet";

/** Backup field → localStorage key, for simple string settings. */
const SETTINGS_KEYS: Record<string, string> = {
	// Reader/Display Settings
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
	// Accessibility & UI
	uiScale: "cpbs_ui_scale",
	keepAwake: "cpbs_awake",
	haptics: "cpbs_haptics",
	indexMode: "cpbs_index_mode",
	readerBookMode: "cpbs_reader_bookmode",
	// View Mode Preferences
	activityViewMode: "cpbs_activity_view_mode",
	darshanViewMode: "cpbs_darshan_view_mode",
	eventsViewMode: "cpbs_events_view_mode",
	// Location & Selection Preferences
	panchangLocation: "panchang_location",
	preferredTemple: "preferred_temple",
	// Audio
	repeatMode: "cpbs_repeat_mode",
	// App State
	readInfoIds: "cpbs_read_info_ids",
	deviceId: "cpbs_device_id",
	// Dismissed Prompts
	introCompleted: "cpbs_intro_completed",
	mahamantraDismissed: "cpbs_mahamantra_dismissed",
	androidPromoDismissed: "cpbs_android_promo_dismissed",
};

/** Top-level backup field → localStorage key, for other single values. */
const SINGLE_KEYS: Record<string, string> = {
	recentSearches: "cpbs_recent_searches",
	// Information Screen interaction state
	infoViewedItems: "cpbs_viewed_info",
	infoLikedItems: "cpbs_liked_info",
	lastReadInfoTitle: "cpbs_last_read_info_title",
	// Quote popup seen dates
	quoteLastSeenDate: "cpbs_quote_last_seen_date",
	quoteLastSeenAfternoon: "cpbs_quote_last_seen_afternoon",
	// Static home screen latest seen
	homeActivityLatest: "cpbs_home_activity_latest",
	homeDarshanLatest: "cpbs_home_darshan_latest",
	homeVideoLatest: "cpbs_home_video_latest",
	// Main activity/photos latest seen
	activityVideoMainLatest: "cpbs_activity_video_main_latest",
	activityPhotosMainLatest: "cpbs_activity_photos_main_latest",
	// Glorifications already read — without these, every glorification shows
	// "NEW" again after a restore (the Home tile and the reader list both).
	glorificationReadHash: "allGlorificationsReadHash",
};

/** JSON-array values that are merged with what the device already has. */
const MERGED_ARRAY_KEYS: Record<string, string> = {
	glorificationVisited: "visitedGlorifications",
};

// Per-item keys, grouped by what they are. Restore only ever writes keys that
// start with one of these, so a hand-edited backup file cannot plant arbitrary
// localStorage entries (developer flags and the like).
const PERSONAL_PREFIXES = ["cpbs_personal_"];
const SEEN_PREFIXES = [
	"cpbs_activity_gallery_",
	"cpbs_activity_videos_latest_",
	"cpbs_activity_info_",
	"cpbs_darshan_mandal_",
	"cpbs_video_folder_latest_",
	"cpbs_seen_visit_",
];
// Which darshan/activity/video items this device already liked or viewed:
// restoring them stops a like being counted twice and keeps hearts filled.
const METRIC_PREFIXES = ["cpbs_likes_", "cpbs_views_"];

const read = (key: string): string | null => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};

const readJson = <T>(key: string, fallback: T): T => {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
};

const collectPrefixed = (prefixes: string[]): Record<string, string> => {
	const out: Record<string, string> = {};
	try {
		for (const key of Object.keys(localStorage).sort()) {
			if (!prefixes.some((p) => key.startsWith(p))) continue;
			const value = localStorage.getItem(key);
			if (value !== null) out[key] = value;
		}
	} catch {
		/* storage unavailable */
	}
	return out;
};

export interface UserBackupFile {
	isUserBackup: true;
	version: 2;
	app: "Prem Bhakti";
	timestamp: number;
	dateString: string;
	data: Record<string, unknown>;
}

/** Everything that goes into a backup, read fresh from storage. */
export const buildBackupData = (): Record<string, unknown> => {
	const settings: Record<string, string | null> = {};
	for (const [field, key] of Object.entries(SETTINGS_KEYS)) {
		settings[field] = read(key);
	}
	const data: Record<string, unknown> = {
		playlists: readJson("cpbs_playlists", []),
		bookmarks: readJson("cpbs_bookmarks", {}),
		history: readJson("cpbs_history", []),
		settings,
	};
	for (const [field, key] of Object.entries(SINGLE_KEYS)) {
		data[field] = read(key);
	}
	for (const [field, key] of Object.entries(MERGED_ARRAY_KEYS)) {
		data[field] = read(key);
	}
	data.personalizedSongs = collectPrefixed(PERSONAL_PREFIXES);
	data.dynamicSeenKeys = collectPrefixed(SEEN_PREFIXES);
	data.metricsKeys = collectPrefixed(METRIC_PREFIXES);
	return data;
};

export const buildBackupFile = (): UserBackupFile => ({
	isUserBackup: true,
	version: 2,
	app: "Prem Bhakti",
	timestamp: Date.now(),
	dateString: new Date().toLocaleDateString(),
	data: buildBackupData(),
});

/** True when this device has any of the devotee's own data worth keeping. */
export const deviceHasUserData = (): boolean => {
	const playlists = readJson<unknown[]>("cpbs_playlists", []);
	const history = readJson<unknown[]>("cpbs_history", []);
	const bookmarks = readJson<Record<string, unknown>>("cpbs_bookmarks", {});
	return (
		(Array.isArray(playlists) && playlists.length > 0) ||
		(Array.isArray(history) && history.length > 0) ||
		(!!bookmarks && Object.keys(bookmarks).length > 0)
	);
};

/**
 * Short fingerprint of a backup's data (not its timestamp), so the automatic
 * backup can skip uploading when nothing changed. djb2 — collisions only cost
 * one skipped upload until the next change.
 */
export const backupSignature = (data: Record<string, unknown>): string => {
	const text = JSON.stringify(data);
	let hash = 5381;
	for (let i = 0; i < text.length; i++) {
		hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
	}
	return `${text.length}:${(hash >>> 0).toString(36)}`;
};

export const parseBackupFile = (
	json: string,
): { data: Record<string, any>; timestamp?: number } | null => {
	try {
		const parsed = JSON.parse(json);
		if (
			!parsed?.isUserBackup ||
			!parsed.data ||
			typeof parsed.data !== "object"
		)
			return null;
		return { data: parsed.data, timestamp: parsed.timestamp };
	} catch {
		return null;
	}
};

const mergeJsonArrays = (existing: string | null, incoming: string): string => {
	try {
		const a = existing ? JSON.parse(existing) : [];
		const b = JSON.parse(incoming);
		if (!Array.isArray(a) || !Array.isArray(b)) return incoming;
		return JSON.stringify(Array.from(new Set([...a, ...b])));
	} catch {
		return incoming;
	}
};

const writePrefixed = (
	entries: unknown,
	prefixes: string[],
	merge: boolean,
) => {
	if (!entries || typeof entries !== "object") return;
	for (const [key, value] of Object.entries(
		entries as Record<string, unknown>,
	)) {
		if (typeof value !== "string") continue;
		if (!prefixes.some((p) => key.startsWith(p))) continue;
		safeLocalSet(key, merge ? mergeJsonArrays(read(key), value) : value);
	}
};

/**
 * Writes a backup's data into localStorage (playlists, bookmarks and history
 * included). The caller reloads the app afterwards so every context re-reads it.
 * Works for backups from older app versions too — missing fields are skipped.
 *
 * safeLocalSet everywhere: a raw setItem that trips the ~5MB quota would throw
 * and abort the rest of the restore, leaving a half-restored app.
 */
export const applyBackupData = (data: Record<string, any>) => {
	if (Array.isArray(data.playlists))
		safeLocalSet("cpbs_playlists", JSON.stringify(data.playlists));
	if (data.bookmarks && typeof data.bookmarks === "object")
		safeLocalSet("cpbs_bookmarks", JSON.stringify(data.bookmarks));
	if (Array.isArray(data.history))
		safeLocalSet("cpbs_history", JSON.stringify(data.history));

	if (data.settings && typeof data.settings === "object") {
		for (const [field, key] of Object.entries(SETTINGS_KEYS)) {
			const value = data.settings[field];
			if (typeof value === "string" && value !== "") safeLocalSet(key, value);
		}
	}
	for (const [field, key] of Object.entries(SINGLE_KEYS)) {
		const value = data[field];
		if (typeof value === "string" && value !== "") safeLocalSet(key, value);
	}
	for (const [field, key] of Object.entries(MERGED_ARRAY_KEYS)) {
		const value = data[field];
		if (typeof value === "string" && value !== "")
			safeLocalSet(key, mergeJsonArrays(read(key), value));
	}
	writePrefixed(data.personalizedSongs, PERSONAL_PREFIXES, false);
	writePrefixed(data.dynamicSeenKeys, SEEN_PREFIXES, false);
	writePrefixed(data.metricsKeys, METRIC_PREFIXES, true);
};

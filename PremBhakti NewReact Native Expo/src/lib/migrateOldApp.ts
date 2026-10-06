import ReactNativeBlobUtil from "react-native-blob-util";
import { useBookStore } from "../store/bookStore";
import { useContentStore } from "../store/contentStore";
import { type AudioCategory, useDownloadStore } from "../store/downloadStore";
import { useSettingsStore } from "../store/settingsStore";
import type { BhajanAudio } from "../types";
import { applyBackupData, deviceHasUserData } from "./backup";
import { storage } from "./storage";
import { applyUiScale } from "./uiScale";
import { adoptWebSession } from "./webAuth";
import { BACKUP_PREFIXED, BACKUP_SETTINGS_KEYS, BACKUP_SINGLE_KEYS, seedWebStore } from "./webStore";

// One-time move of the Capacitor app's data into the app (rollout "3B": this
// app installs as an update of com.cpbs.bhajans). The old app kept everything
// in its WebView storage at https://localhost; components/OldAppMigration
// reads that and hands it over here as a snapshot. On test builds
// (.rntest) there is no old data and nothing happens.

export const MIGRATED_KEY = "cpbs_rn_migrated_v1";

export interface OldAppSnapshot {
	/** The old app's localStorage (content caches left out). */
	local: Record<string, string>;
	/** Its Firebase login record (firebaseLocalStorageDb), if logged in. */
	authRecord: string | null;
}

const json = <T>(raw: string | undefined, fallback: T): T => {
	try {
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
};

/** The old localStorage as a backup's `data` (backupData.ts buildBackupData). */
function snapshotAsBackup(local: Record<string, string>) {
	const settings: Record<string, string | null> = {};
	for (const [field, key] of Object.entries(BACKUP_SETTINGS_KEYS)) settings[field] = local[key] ?? null;
	const data: Record<string, unknown> = {
		playlists: json(local.cpbs_playlists, []),
		bookmarks: json(local.cpbs_bookmarks, {}),
		history: json(local.cpbs_history, []),
		settings,
	};
	for (const [field, key] of Object.entries(BACKUP_SINGLE_KEYS)) data[field] = local[key] ?? null;
	for (const [field, prefixes] of Object.entries(BACKUP_PREFIXED)) {
		const out: Record<string, string> = {};
		for (const key of Object.keys(local).sort()) if (prefixes.some((p) => key.startsWith(p))) out[key] = local[key];
		data[field] = out;
	}
	return data;
}

// utils/audioStorage.ts: where the old app saved downloaded audio
// (Directory.ExternalStorage), under a "title - singer" or "track-<id>" name.
const EXTERNAL = "/storage/emulated/0";
const AUDIO_DIRS: Record<AudioCategory, string[]> = {
	audio: ["Music/Prem Bhakti/Audios", "Music/Prem Bhakti/Lectures", "Download/Prem Bhakti/Audios", "Download/Prem Bhakti/Lectures"],
	lecture: ["Music/Prem Bhakti/Lectures", "Music/Prem Bhakti/Audios", "Download/Prem Bhakti/Lectures", "Download/Prem Bhakti/Audios"],
};
const namedFile = (title: string, singer: string) => {
	const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 60);
	const t = safe(title) || "audio";
	const s = safe(singer);
	return s ? `${t} - ${s}.m4a` : `${t}.m4a`;
};

async function firstExisting(paths: string[]) {
	for (const p of paths) {
		if (await ReactNativeBlobUtil.fs.exists(p).catch(() => false)) return p;
	}
	return null;
}

async function migrateAudio(ids: string[]) {
	const { bhajans, lectures } = useContentStore.getState();
	const byId = new Map<string, { track: BhajanAudio; title: string; category: AudioCategory; parentId: string }>();
	for (const b of bhajans) for (const t of b.audio ?? []) byId.set(t.id, { track: t, title: b.title, category: "audio", parentId: b.id });
	for (const l of lectures) for (const t of l.audio ?? []) byId.set(t.id, { track: t, title: l.title, category: "lecture", parentId: l.id });

	const found: Record<string, ReturnType<typeof useDownloadStore.getState>["downloaded"][string]> = {};
	for (const id of ids) {
		const item = byId.get(id);
		if (!item) continue;
		const names = [namedFile(item.title, item.track.singer || ""), `track-${id}.m4a`];
		const path = await firstExisting(AUDIO_DIRS[item.category].flatMap((dir) => names.map((n) => `${EXTERNAL}/${dir}/${n}`)));
		if (!path) continue;
		const stat = await ReactNativeBlobUtil.fs.stat(path).catch(() => null);
		found[id] = {
			id,
			path,
			title: item.title,
			singer: item.track.singer || "",
			duration: item.track.duration,
			url: item.track.url,
			category: item.category,
			parentId: item.parentId,
			sizeBytes: Number(stat?.size) || 0,
			downloadedAt: Date.now(),
		};
	}
	if (Object.keys(found).length) useDownloadStore.setState(({ downloaded }) => ({ downloaded: { ...found, ...downloaded } }));
}

async function migrateBooks(ids: string[], paths: Record<string, string>) {
	const found: Record<string, { path: string; sizeBytes: number; downloadedAt: number }> = {};
	for (const id of ids) {
		const raw = paths[id];
		if (!raw) continue;
		const path = raw.replace(/^file:\/\//, "");
		if (!(await ReactNativeBlobUtil.fs.exists(path).catch(() => false))) continue;
		const stat = await ReactNativeBlobUtil.fs.stat(path).catch(() => null);
		found[id] = { path, sizeBytes: Number(stat?.size) || 0, downloadedAt: Date.now() };
	}
	if (Object.keys(found).length) useBookStore.setState(({ downloaded }) => ({ downloaded: { ...found, ...downloaded } }));
}

/**
 * Moves the old app's data in, once. Lists and settings only when this app
 * has none of the devotee's data yet (never overwrite what they made here).
 */
export async function runOldAppMigration(snapshot: OldAppSnapshot) {
	if (storage.getBoolean(MIGRATED_KEY)) return;
	const { local, authRecord } = snapshot;
	const hasOldData = Object.keys(local).some((k) => k.startsWith("cpbs_")) || !!authRecord;
	if (hasOldData) {
		const scaleBefore = useSettingsStore.getState().uiScale;
		if (!deviceHasUserData()) applyBackupData(snapshotAsBackup(local));
		// The web screens' seen/liked markers and view settings, for the app's copy.
		seedWebStore(local);
		// cpbs_intro_completed: the old app's intro was done, so it is not shown again (AppStartup).
		for (const key of ["cpbs_drive_backup_at", "cpbs_drive_backup_sig", "recent_bhajan_searches", "cpbs_intro_completed"]) {
			if (local[key] && !storage.contains(key)) storage.set(key, local[key]);
		}
		await migrateBooks(json(local.cpbs_downloaded_books, []), json(local.cpbs_book_paths_v2, {})).catch(() => {});
		await migrateAudio(json(local.cpbs_downloaded_tracks, [])).catch(() => {});
		if (authRecord) await adoptWebSession(authRecord).catch(() => {});
		storage.set(MIGRATED_KEY, true);
		const scale = useSettingsStore.getState().uiScale;
		if (Math.abs(scale - scaleBefore) > 0.001) applyUiScale(scale, false);
		return;
	}
	storage.set(MIGRATED_KEY, true);
}

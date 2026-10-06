import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { useBookmarkStore } from "../store/bookmarkStore";
import { useHistoryStore } from "../store/historyStore";
import { usePlaylistStore } from "../store/playlistStore";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import type { FontSize, HistoryEntry, Playlist, ScriptType, ThemeColor, ThemeMode } from "../types";
import { getObject, setObject, storage } from "./storage";
import { applyUiScale } from "./uiScale";
import { configureGoogle, DRIVE_SCOPE } from "./webAuth";
import { applyWebBackupFields, webBackupFields } from "./webStore";

// The devotee's Google Drive backup — utils/backup/{backupData,driveBackup,
// driveAutoBackup}.ts of the OG app, in the same file format and the same
// Drive file ("Prem Bhakti App/Prem Bhakti Backup.json", drive.file scope),
// so a backup made by either app restores in the other.
//
// The app owns playlists, bookmarks, history and the display settings. The
// web screens own the rest (seen/liked markers, personalised songs, their view
// settings): those come from the app's copy of their storage (lib/webStore),
// and any field neither knows is kept as it came, so a backup from here never
// drops anything.

export const DRIVE_FOLDER_NAME = "Prem Bhakti App";
export const DRIVE_FILE_NAME = "Prem Bhakti Backup.json";
const LEGACY_FILE_NAME = "Prem_Bhakti_Backup.json";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

const EXTRAS_KEY = "cpbs_backup_extras";
const SAVED_AT_KEY = "cpbs_drive_backup_at";
const SIG_KEY = "cpbs_drive_backup_sig";

/* ─────────────────────────── Backup contents ─────────────────────────── */

type BackupData = Record<string, unknown>;

/** backupData.ts SETTINGS_KEYS fields the app has, as the strings localStorage held. */
function settingsForBackup(): Record<string, string> {
	const s = useSettingsStore.getState();
	return {
		fontSize: String(s.fontSize),
		script: s.script,
		language: s.settingsLanguage,
		scrollSide: s.scrollBarSide,
		sliderSide: s.azSliderSide,
		themeColor: s.themeColor,
		themeMode: s.themeMode,
		lineGap: String(s.lineGap),
		viewFormat: s.viewFormat,
		uiScale: String(s.uiScale),
		keepAwake: String(s.keepAwake),
		haptics: String(s.hapticsEnabled),
		indexMode: s.indexMode,
		readerBookMode: String(s.bookMode),
	};
}

export function buildBackupData(): BackupData {
	const extras = getObject<BackupData>(EXTRAS_KEY) ?? {};
	const extraSettings = (extras.settings as Record<string, unknown>) ?? {};
	const web = webBackupFields();
	return {
		...extras,
		...web.fields,
		playlists: usePlaylistStore.getState().playlists,
		bookmarks: useBookmarkStore.getState().bookmarks,
		history: useHistoryStore.getState().items,
		settings: { ...extraSettings, ...web.settings, ...settingsForBackup() },
	};
}

export function buildBackupFile() {
	return {
		isUserBackup: true as const,
		version: 2 as const,
		app: "Prem Bhakti" as const,
		timestamp: Date.now(),
		dateString: new Date().toLocaleDateString(),
		data: buildBackupData(),
	};
}

/** True when this device has any of the devotee's own data worth keeping. */
export function deviceHasUserData() {
	return (
		usePlaylistStore.getState().playlists.length > 0 ||
		useHistoryStore.getState().items.length > 0 ||
		Object.keys(useBookmarkStore.getState().bookmarks).length > 0
	);
}

/** backupData.ts backupSignature (djb2 of the data), to skip unchanged uploads. */
export function backupSignature(data: BackupData) {
	const text = JSON.stringify(data);
	let hash = 5381;
	for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
	return `${text.length}:${(hash >>> 0).toString(36)}`;
}

export function parseBackupFile(json: string): { data: BackupData; timestamp?: number } | null {
	try {
		const parsed = JSON.parse(json);
		if (!parsed?.isUserBackup || !parsed.data || typeof parsed.data !== "object") return null;
		return { data: parsed.data, timestamp: parsed.timestamp };
	} catch {
		return null;
	}
}

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
const num = (v: unknown) => {
	const n = Number(str(v));
	return Number.isFinite(n) ? n : undefined;
};
const bool = (v: unknown) => (str(v) === undefined ? undefined : str(v) !== "false");

/** applyBackupData: the app's own parts into its stores, the web screens' into theirs, the rest kept for the next backup. */
export function applyBackupData(data: BackupData) {
	if (Array.isArray(data.playlists)) usePlaylistStore.setState({ playlists: data.playlists as Playlist[] });
	if (data.bookmarks && typeof data.bookmarks === "object") {
		useBookmarkStore.setState({ bookmarks: data.bookmarks as Record<string, number> });
	}
	if (Array.isArray(data.history)) useHistoryStore.setState({ items: data.history as HistoryEntry[] });

	const s = (data.settings ?? {}) as Record<string, unknown>;
	const store = useSettingsStore.getState();
	const patch: Partial<ReturnType<typeof useSettingsStore.getState>> = {};
	const fontSize = num(s.fontSize);
	if (fontSize) patch.fontSize = fontSize as FontSize;
	if (str(s.script)) patch.script = s.script as ScriptType;
	if (s.language === "en" || s.language === "hi") patch.settingsLanguage = s.language;
	if (s.scrollSide === "left" || s.scrollSide === "right") patch.scrollBarSide = s.scrollSide;
	if (s.sliderSide === "left" || s.sliderSide === "right") patch.azSliderSide = s.sliderSide;
	if (str(s.themeColor)) patch.themeColor = s.themeColor as ThemeColor;
	if (str(s.themeMode)) patch.themeMode = s.themeMode as ThemeMode;
	const lineGap = num(s.lineGap);
	if (lineGap !== undefined) patch.lineGap = lineGap;
	if (str(s.viewFormat)) patch.viewFormat = s.viewFormat as typeof store.viewFormat;
	const uiScale = num(s.uiScale);
	if (uiScale) patch.uiScale = Math.min(1.15, Math.max(0.85, uiScale));
	if (bool(s.keepAwake) !== undefined) patch.keepAwake = bool(s.keepAwake);
	if (bool(s.haptics) !== undefined) patch.hapticsEnabled = bool(s.haptics);
	if (s.indexMode === "latin" || s.indexMode === "devanagari") patch.indexMode = s.indexMode;
	if (bool(s.readerBookMode) !== undefined) patch.bookMode = bool(s.readerBookMode);
	useSettingsStore.setState(patch);

	applyWebBackupFields(data);
	const { playlists: _p, bookmarks: _b, history: _h, ...extras } = data;
	setObject(EXTRAS_KEY, extras);
}

/* ─────────────────────────── Drive ─────────────────────────── */

export type DriveErrorCode = "cancelled" | "needs-consent" | "api" | "failed";
export class DriveError extends Error {
	constructor(
		public code: DriveErrorCode,
		message?: string,
	) {
		super(message || code);
	}
}

/**
 * A Drive access token for the devotee's Google account. `interactive: false`
 * never shows anything (null when Drive access wasn't granted before).
 */
export async function getDriveAccessToken(interactive: boolean): Promise<string | null> {
	configureGoogle();
	let user = GoogleSignin.getCurrentUser();
	if (!user && GoogleSignin.hasPreviousSignIn()) {
		const silent = await GoogleSignin.signInSilently().catch(() => null);
		user = silent?.type === "success" ? silent.data : null;
	}
	const granted = !!user?.scopes?.includes(DRIVE_SCOPE);
	if (!interactive) return user && granted ? (await GoogleSignin.getTokens()).accessToken : null;
	try {
		if (!user) {
			const signed = await GoogleSignin.signIn();
			if (!isSuccessResponse(signed)) throw new DriveError("cancelled");
			user = signed.data;
		}
		if (!user.scopes?.includes(DRIVE_SCOPE) && !(await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] }))) {
			throw new DriveError("cancelled");
		}
		return (await GoogleSignin.getTokens()).accessToken;
	} catch (e) {
		if (e instanceof DriveError) throw e;
		const code = (e as { code?: string })?.code;
		if (code === "SIGN_IN_CANCELLED" || code === "12501") throw new DriveError("cancelled");
		throw new DriveError("failed", (e as Error)?.message);
	}
}

async function driveRequest(token: string, url: string, init: RequestInit = {}): Promise<any> {
	const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
	if (res.status === 401) await GoogleSignin.clearCachedAccessToken(token).catch(() => {});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new DriveError("api", `Drive ${res.status}: ${text.slice(0, 300)}`);
	}
	const type = res.headers.get("content-type") ?? "";
	return type.includes("application/json") ? res.json() : res.text();
}

interface DriveFile {
	id: string;
	name: string;
	modifiedTime?: string;
}

const escapeQuery = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function listFiles(token: string, q: string): Promise<DriveFile[]> {
	const params = new URLSearchParams({ q, orderBy: "modifiedTime desc", fields: "files(id,name,modifiedTime)", spaces: "drive" });
	const data = await driveRequest(token, `${API}/files?${params}`);
	return Array.isArray(data?.files) ? data.files : [];
}

async function findFolderId(token: string) {
	const files = await listFiles(token, `name='${escapeQuery(DRIVE_FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and trashed=false`);
	return files[0]?.id ?? null;
}

async function ensureFolderId(token: string) {
	const existing = await findFolderId(token);
	if (existing) return existing;
	const created = await driveRequest(token, `${API}/files?fields=id`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: FOLDER_MIME }),
	});
	return created.id as string;
}

const backupFilesIn = (token: string, folderId: string) =>
	listFiles(token, `name='${escapeQuery(DRIVE_FILE_NAME)}' and '${folderId}' in parents and trashed=false`);
const legacyFiles = (token: string) => listFiles(token, `name='${LEGACY_FILE_NAME}' and trashed=false`);

/** Creates or replaces the one backup file, then bins old copies (driveBackup.ts). */
export async function saveBackupToDrive(token: string, json: string) {
	const folderId = await ensureFolderId(token);
	const [current, ...duplicates] = await backupFilesIn(token, folderId);
	if (current) {
		await driveRequest(token, `${UPLOAD_API}/files/${current.id}?uploadType=media&fields=id`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: json,
		});
	} else {
		const boundary = `pb${Date.now().toString(36)}`;
		const body =
			`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
			JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: "application/json", parents: [folderId] }) +
			`\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
		await driveRequest(token, `${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
			method: "POST",
			headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
			body,
		});
	}
	const old = [...duplicates, ...(await legacyFiles(token).catch(() => []))];
	await Promise.all(
		old.map((f) =>
			driveRequest(token, `${API}/files/${f.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ trashed: true }),
			}).catch(() => {}),
		),
	);
}

async function findBackupFile(token: string) {
	const folderId = await findFolderId(token);
	const candidates = folderId ? await backupFilesIn(token, folderId) : [];
	return candidates[0] ?? (await legacyFiles(token))[0] ?? null;
}

/** When the Drive backup was last saved, without downloading it. */
export async function getDriveBackupInfo(token: string) {
	const file = await findBackupFile(token);
	return file ? { modifiedTime: file.modifiedTime } : null;
}

export async function loadBackupFromDrive(token: string) {
	const file = await findBackupFile(token);
	if (!file) return null;
	const json = await driveRequest(token, `${API}/files/${file.id}?alt=media`);
	return { json: typeof json === "string" ? json : JSON.stringify(json), modifiedTime: file.modifiedTime };
}

/* ─────────────────────────── Automatic backup ─────────────────────────── */

// driveAutoBackup.ts: only a "linked" device (one that saved to or restored
// from Drive) uploads, so a fresh install never overwrites the real backup.
const MIN_GAP_MS = 15 * 60 * 1000;
const listeners = new Set<() => void>();

export function getLastDriveBackupAt(): number | null {
	const n = Number(storage.getString(SAVED_AT_KEY));
	return Number.isFinite(n) && n > 0 ? n : null;
}
export const isDriveBackupLinked = () => getLastDriveBackupAt() !== null;

export function markDriveBackupSaved(signature?: string) {
	storage.set(SAVED_AT_KEY, String(Date.now()));
	if (signature) storage.set(SIG_KEY, signature);
	for (const cb of listeners) cb();
}

export function onDriveBackupSaved(cb: () => void) {
	listeners.add(cb);
	return () => {
		listeners.delete(cb);
	};
}

export function buildDriveBackup() {
	const file = buildBackupFile();
	return { json: JSON.stringify(file), signature: backupSignature(file.data) };
}

/** Silent background save; skips without a UI-free token or when nothing changed. */
export async function autoSaveToDrive() {
	const last = getLastDriveBackupAt();
	if (!last || Date.now() - last < MIN_GAP_MS) return false;
	const { json, signature } = buildDriveBackup();
	if (storage.getString(SIG_KEY) === signature) return false;
	const token = await getDriveAccessToken(false).catch(() => null);
	if (!token) return false;
	await saveBackupToDrive(token, json);
	markDriveBackupSaved(signature);
	return true;
}

/* ─────────────────────────── Restore ─────────────────────────── */

/**
 * DataContext restoreUserData: puts a backup's data into the app. A changed UI
 * size takes effect through a reload, as the Capacitor app reloaded itself.
 */
export function restoreBackupJson(json: string, options: { fromDrive?: boolean; message?: string } = {}) {
	const isHindi = useSettingsStore.getState().settingsLanguage === "hi";
	const parsed = parseBackupFile(json);
	if (!parsed) {
		showToast(isHindi ? "बैकअप फ़ाइल सही नहीं है" : "Invalid Backup File", "error");
		return false;
	}
	try {
		applyBackupData(parsed.data);
		if (options.fromDrive) markDriveBackupSaved();
		const after = useSettingsStore.getState().settingsLanguage === "hi";
		showToast(options.message ?? (after ? "डेटा रिस्टोर हो गया!" : "Data restored!"), "success");
		setTimeout(() => applyUiScale(useSettingsStore.getState().uiScale, false), 1500);
		return true;
	} catch {
		showToast(isHindi ? "डेटा रिस्टोर नहीं हो सका" : "Failed to restore data.", "error");
		return false;
	}
}

/** DataContext showDriveError's messages. */
export function showDriveError(e: unknown) {
	const hi = useSettingsStore.getState().settingsLanguage === "hi";
	const code = e instanceof DriveError ? e.code : "failed";
	if (code === "cancelled") return;
	const messages: Record<string, [string, string]> = {
		"needs-consent": ["Google Drive permission is needed.", "Google Drive की अनुमति आवश्यक है।"],
		api: ["Google Drive did not respond. Please try again.", "Google Drive से जवाब नहीं मिला। कृपया फिर से प्रयास करें।"],
		failed: ["Could not connect to Google Drive. Please try again.", "Google Drive से कनेक्ट नहीं हो सका। कृपया फिर से प्रयास करें।"],
	};
	const [en, hin] = messages[code] ?? messages.failed;
	showToast(hi ? hin : en, "error");
}

/** Settings "Turn on" / "Back up now" (DataContext backupUserData). */
export async function backupNow() {
	const hi = () => useSettingsStore.getState().settingsLanguage === "hi";
	try {
		const token = await getDriveAccessToken(true);
		if (!token) return false;
		showToast(hi() ? "Google Drive में सहेजा जा रहा है..." : "Saving to Google Drive...", "info");
		const { json, signature } = buildDriveBackup();
		await saveBackupToDrive(token, json);
		markDriveBackupSaved(signature);
		showToast(
			hi()
				? `Google Drive में "${DRIVE_FOLDER_NAME}" फ़ोल्डर में बैकअप सहेजा गया ✅`
				: `Backup saved to Google Drive → "${DRIVE_FOLDER_NAME}" ✅`,
			"success",
		);
		return true;
	} catch (e) {
		showDriveError(e);
		return false;
	}
}

/** Settings "Bring back" (DataContext restoreFromCloud). */
export async function restoreFromDrive() {
	const hi = () => useSettingsStore.getState().settingsLanguage === "hi";
	try {
		const token = await getDriveAccessToken(true);
		if (!token) return false;
		showToast(hi() ? "Google Drive में बैकअप खोजा जा रहा है..." : "Searching Google Drive for backups...", "info");
		const found = await loadBackupFromDrive(token);
		if (!found) {
			showToast(hi() ? "Google Drive में कोई बैकअप नहीं मिला।" : "No backup found on Google Drive.", "error");
			return false;
		}
		return restoreBackupJson(found.json, { fromDrive: true });
	} catch (e) {
		showDriveError(e);
		return false;
	}
}

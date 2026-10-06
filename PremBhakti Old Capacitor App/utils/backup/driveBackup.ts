/**
 * Google Drive copy of the user backup.
 *
 * Layout: one file, "Prem Bhakti App/Prem Bhakti Backup.json", updated in
 * place on every backup. Older app versions created a new
 * "Prem_Bhakti_Backup.json" in the Drive root on every tap; those are still
 * read on restore and moved to Drive's bin (recoverable for 30 days) once the
 * new file exists.
 *
 * Scope is drive.file, so the app only ever sees files it created itself.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { profileAuth } from "../../services/firebase";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_FOLDER_NAME = "Prem Bhakti App";
export const DRIVE_FILE_NAME = "Prem Bhakti Backup.json";
const LEGACY_FILE_NAME = "Prem_Bhakti_Backup.json";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export type DriveErrorCode =
	| "cancelled"
	| "needs-consent"
	| "not-google"
	| "wrong-account"
	| "popup-blocked"
	| "not-signed-in"
	| "api"
	| "failed";

export class DriveError extends Error {
	constructor(
		public code: DriveErrorCode,
		message?: string,
	) {
		super(message || code);
	}
}

/* ─────────────────────────── Access token ─────────────────────────── */

interface DriveAuthPlugin {
	authorize(options: {
		scopes: string[];
		interactive: boolean;
		email?: string;
	}): Promise<{ accessToken: string }>;
}

// Native Android plugin (android/app/src/main/java/.../DriveAuthPlugin.java).
// It asks Google only for Drive access — no account picker, no re-login, and
// no UI at all once access was granted. Builds without it use the fallback.
const DriveAuth = registerPlugin<DriveAuthPlugin>("DriveAuth");

let cachedToken: { token: string; expiresAt: number } | null = null;
// Google access tokens live for an hour; stop reusing one a little early.
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

const remember = (token: string) => {
	cachedToken = { token, expiresAt: Date.now() + TOKEN_LIFETIME_MS };
	return token;
};

export const forgetDriveToken = () => {
	cachedToken = null;
};

const isCancel = (e: any) => {
	const text = `${e?.code || ""} ${e?.message || ""}`.toLowerCase();
	return (
		text.includes("cancel") ||
		text.includes("12501") ||
		text.includes("popup-closed") ||
		text.includes("closed-by-user")
	);
};

/**
 * A Drive access token for the signed-in devotee.
 *
 * `interactive: false` never shows anything — it returns null instead, which is
 * what the automatic backup wants. `interactive: true` may show Google's
 * one-time Drive permission screen.
 */
export async function getDriveAccessToken(
	interactive: boolean,
): Promise<string | null> {
	if (cachedToken && cachedToken.expiresAt > Date.now())
		return cachedToken.token;

	const user = profileAuth.currentUser;
	if (!user) {
		if (!interactive) return null;
		throw new DriveError("not-signed-in");
	}
	const googleEmail =
		user.providerData.find((p) => p.providerId === "google.com")?.email ||
		undefined;

	if (Capacitor.isNativePlatform()) {
		if (Capacitor.isPluginAvailable("DriveAuth")) {
			try {
				const { accessToken } = await DriveAuth.authorize({
					scopes: [DRIVE_SCOPE],
					interactive,
					email: googleEmail,
				});
				return accessToken ? remember(accessToken) : null;
			} catch (e: any) {
				if (!interactive) return null;
				if (e?.code === "NEEDS_CONSENT") throw new DriveError("needs-consent");
				if (isCancel(e)) throw new DriveError("cancelled");
				throw new DriveError("failed", e?.message);
			}
		}
		// App builds from before DriveAuth: the sign-in plugin is the only way.
		// useCredentialManager: false — its Credential Manager path returns no
		// access token once Drive access was already granted, which made every
		// backup after the first one fail. skipNativeAuth: true — this must only
		// fetch a token, never change who is logged in to the app.
		if (!interactive) return null;
		try {
			const result = await FirebaseAuthentication.signInWithGoogle({
				scopes: [DRIVE_SCOPE],
				skipNativeAuth: true,
				useCredentialManager: false,
			});
			const token = result.credential?.accessToken;
			if (!token) throw new DriveError("failed", "No access token returned");
			return remember(token);
		} catch (e: any) {
			if (e instanceof DriveError) throw e;
			if (isCancel(e)) throw new DriveError("cancelled");
			throw new DriveError("failed", e?.message);
		}
	}

	// Web: re-confirm the SAME Google account the devotee logged in with and ask
	// for Drive access on it. reauthenticate (not signInWithPopup) so the
	// app's login can never switch to another account — or, for a phone-login
	// devotee, to a brand-new one.
	if (!interactive) return null;
	if (!googleEmail) throw new DriveError("not-google");
	const provider = new GoogleAuthProvider();
	provider.addScope(DRIVE_SCOPE);
	provider.setCustomParameters({ login_hint: googleEmail });
	try {
		const result = await reauthenticateWithPopup(user, provider);
		const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
		if (!token) throw new DriveError("failed", "No access token returned");
		return remember(token);
	} catch (e: any) {
		if (e instanceof DriveError) throw e;
		if (e?.code === "auth/user-mismatch") throw new DriveError("wrong-account");
		if (e?.code === "auth/popup-blocked") throw new DriveError("popup-blocked");
		if (isCancel(e) || e?.code === "auth/cancelled-popup-request")
			throw new DriveError("cancelled");
		throw new DriveError("failed", e?.message);
	}
}

/* ─────────────────────────── Drive REST ─────────────────────────── */

async function driveRequest(
	token: string,
	url: string,
	init: RequestInit = {},
): Promise<any> {
	const res = await fetch(url, {
		...init,
		headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
	});
	if (res.status === 401) {
		// Revoked or expired early — make the next attempt fetch a fresh one.
		forgetDriveToken();
	}
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new DriveError("api", `Drive ${res.status}: ${text.slice(0, 300)}`);
	}
	const type = res.headers.get("content-type") || "";
	return type.includes("application/json") ? res.json() : res.text();
}

interface DriveFile {
	id: string;
	name: string;
	modifiedTime?: string;
}

const escapeQuery = (value: string) =>
	value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function listFiles(token: string, q: string): Promise<DriveFile[]> {
	const url = new URL(`${API}/files`);
	url.searchParams.set("q", q);
	url.searchParams.set("orderBy", "modifiedTime desc");
	url.searchParams.set("fields", "files(id,name,modifiedTime)");
	url.searchParams.set("spaces", "drive");
	const data = await driveRequest(token, url.toString());
	return Array.isArray(data?.files) ? data.files : [];
}

async function findFolderId(token: string): Promise<string | null> {
	const files = await listFiles(
		token,
		`name='${escapeQuery(DRIVE_FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and trashed=false`,
	);
	return files[0]?.id ?? null;
}

async function ensureFolderId(token: string): Promise<string> {
	const existing = await findFolderId(token);
	if (existing) return existing;
	const created = await driveRequest(token, `${API}/files?fields=id`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: FOLDER_MIME }),
	});
	return created.id;
}

const backupFilesIn = (token: string, folderId: string) =>
	listFiles(
		token,
		`name='${escapeQuery(DRIVE_FILE_NAME)}' and '${folderId}' in parents and trashed=false`,
	);

const legacyFiles = (token: string) =>
	listFiles(token, `name='${LEGACY_FILE_NAME}' and trashed=false`);

async function moveToBin(token: string, files: DriveFile[]) {
	await Promise.all(
		files.map((f) =>
			driveRequest(token, `${API}/files/${f.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ trashed: true }),
			}).catch((e) =>
				console.warn("[Drive] Could not bin old backup", f.id, e),
			),
		),
	);
}

/** Creates or replaces the one backup file. */
export async function saveBackupToDrive(token: string, json: string) {
	const folderId = await ensureFolderId(token);
	const [current, ...duplicates] = await backupFilesIn(token, folderId);

	if (current) {
		await driveRequest(
			token,
			`${UPLOAD_API}/files/${current.id}?uploadType=media&fields=id`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: json,
			},
		);
	} else {
		const form = new FormData();
		form.append(
			"metadata",
			new Blob(
				[
					JSON.stringify({
						name: DRIVE_FILE_NAME,
						mimeType: "application/json",
						parents: [folderId],
					}),
				],
				{ type: "application/json" },
			),
		);
		form.append("file", new Blob([json], { type: "application/json" }));
		await driveRequest(
			token,
			`${UPLOAD_API}/files?uploadType=multipart&fields=id`,
			{
				method: "POST",
				body: form,
			},
		);
	}

	// The new file is safely written — tidy up the old one-file-per-tap copies.
	const old = [...duplicates, ...(await legacyFiles(token).catch(() => []))];
	if (old.length > 0) await moveToBin(token, old);
}

async function findBackupFile(token: string): Promise<DriveFile | null> {
	const folderId = await findFolderId(token);
	const candidates = folderId ? await backupFilesIn(token, folderId) : [];
	return candidates[0] ?? (await legacyFiles(token))[0] ?? null;
}

/** When the backup on Drive was last saved, without downloading it. */
export async function getDriveBackupInfo(
	token: string,
): Promise<{ modifiedTime?: string } | null> {
	const file = await findBackupFile(token);
	return file ? { modifiedTime: file.modifiedTime } : null;
}

/** Newest backup on Drive: the folder file first, else an old root file. */
export async function loadBackupFromDrive(
	token: string,
): Promise<{ json: string; modifiedTime?: string } | null> {
	const file = await findBackupFile(token);
	if (!file) return null;
	const json = await driveRequest(token, `${API}/files/${file.id}?alt=media`);
	return {
		json: typeof json === "string" ? json : JSON.stringify(json),
		modifiedTime: file.modifiedTime,
	};
}

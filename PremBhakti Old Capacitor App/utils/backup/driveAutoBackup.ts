/**
 * Keeping the Google Drive backup up to date by itself.
 *
 * A device is "linked" once the devotee has saved to or restored from Drive on
 * it (or the app restored their Drive backup by itself). Only linked devices
 * upload: a fresh install must never overwrite the devotee's real backup with
 * an empty one.
 */
import { safeLocalGet, safeLocalSet } from "../safeLocalSet";
import { backupSignature, buildBackupFile } from "./backupData";
import { getDriveAccessToken, saveBackupToDrive } from "./driveBackup";

const SAVED_AT_KEY = "cpbs_drive_backup_at";
const SIG_KEY = "cpbs_drive_backup_sig";
const STATUS_EVENT = "cpbs:drive-backup";
// Uploads only when something changed, and at most this often.
const MIN_GAP_MS = 15 * 60 * 1000;

export const getLastDriveBackupAt = (): number | null => {
	const n = Number(safeLocalGet(SAVED_AT_KEY));
	return Number.isFinite(n) && n > 0 ? n : null;
};

export const isDriveBackupLinked = () => getLastDriveBackupAt() !== null;

/** Records a successful save (or restore) so this device keeps the copy fresh. */
export const markDriveBackupSaved = (signature?: string) => {
	safeLocalSet(SAVED_AT_KEY, String(Date.now()));
	if (signature) safeLocalSet(SIG_KEY, signature);
	window.dispatchEvent(new Event(STATUS_EVENT));
};

/** Fires after every Drive save, for "Last backup" labels. */
export const onDriveBackupSaved = (cb: () => void) => {
	window.addEventListener(STATUS_EVENT, cb);
	return () => window.removeEventListener(STATUS_EVENT, cb);
};

/** The current backup file and its fingerprint, for a manual save. */
export const buildDriveBackup = () => {
	const file = buildBackupFile();
	return { json: JSON.stringify(file), signature: backupSignature(file.data) };
};

/**
 * Silent background save. Never shows anything: without a Drive token that
 * Google hands out with no UI, it just skips. Returns whether it uploaded.
 */
export async function autoSaveToDrive(): Promise<boolean> {
	const last = getLastDriveBackupAt();
	if (!last || Date.now() - last < MIN_GAP_MS) return false;
	const { json, signature } = buildDriveBackup();
	if (safeLocalGet(SIG_KEY) === signature) return false;
	const token = await getDriveAccessToken(false).catch(() => null);
	if (!token) return false;
	await saveBackupToDrive(token, json);
	markDriveBackupSaved(signature);
	return true;
}

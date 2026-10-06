import { App as CapApp } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import type React from "react";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { deviceHasUserData } from "../utils/backup/backupData";
import {
	autoSaveToDrive,
	isDriveBackupLinked,
} from "../utils/backup/driveAutoBackup";
import {
	getDriveAccessToken,
	loadBackupFromDrive,
} from "../utils/backup/driveBackup";
import { safeLocalGet, safeLocalSet } from "../utils/safeLocalSet";

// Backup data only changes while the app is open, so "background" means: a
// little after start, every few minutes while in use, and whenever the app or
// tab goes to the background. autoSaveToDrive uploads only if something
// changed, and at most every 15 minutes.
const FIRST_RUN_DELAY_MS = 20 * 1000;
const INTERVAL_MS = 5 * 60 * 1000;

const restoreCheckedKey = (uid: string) => `cpbs_drive_restore_checked_${uid}`;

/**
 * Google Drive backup that needs no attention and never shows a dialog.
 *
 * - New phone / reinstall: if this device has none of the devotee's data yet
 *   and Google already allows Drive access for their account, their Drive
 *   backup is brought back by itself (checked once per account per device).
 * - Afterwards, on any device where Drive backup is on, the Drive copy is kept
 *   up to date in the background.
 *
 * Everything else (turning Drive backup on, restoring by hand) lives in
 * Settings → Backup & Restore.
 */
export const AutoBackupManager: React.FC = () => {
	const { user } = useAuth();
	const { restoreUserData } = useData();
	const uid = user?.uid;

	// 1. Bring the Drive backup back on a fresh install.
	// biome-ignore lint/correctness/useExhaustiveDependencies: restoreUserData is recreated every render; this must run once per account
	useEffect(() => {
		if (!uid || safeLocalGet(restoreCheckedKey(uid))) return;
		let cancelled = false;
		const markChecked = () => safeLocalSet(restoreCheckedKey(uid), "1");

		const check = async () => {
			if (deviceHasUserData() || isDriveBackupLinked()) {
				markChecked();
				return;
			}
			// Offline: ask again next launch rather than decide on no answer.
			if (!navigator.onLine) return;
			// No UI: a token only if Drive access was granted to this account before.
			const token = await getDriveAccessToken(false).catch(() => null);
			if (cancelled) return;
			if (!token) {
				markChecked();
				return;
			}
			const found = await loadBackupFromDrive(token);
			if (cancelled) return;
			markChecked();
			// Re-check: the devotee may have started using the app meanwhile.
			if (!found || deviceHasUserData()) return;
			const isHindi = safeLocalGet("cpbs_settings_lang") === "hi";
			restoreUserData(found.json, {
				fromDrive: true,
				message: isHindi
					? "आपका पुराना डेटा Google Drive से वापस आ गया 🙏"
					: "Your saved data is back from Google Drive 🙏",
			});
		};

		const timer = setTimeout(() => {
			check().catch((e) =>
				console.warn("[DriveBackup] Could not check Drive backup", e),
			);
		}, 3000);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [uid]);

	// 2. Keep the Drive copy fresh.
	useEffect(() => {
		if (!uid) return;
		let running = false;
		const run = async () => {
			if (running) return;
			running = true;
			try {
				await autoSaveToDrive();
			} catch (e) {
				console.warn("[DriveBackup] Backup failed; will retry", e);
			} finally {
				running = false;
			}
		};
		const first = setTimeout(run, FIRST_RUN_DELAY_MS);
		const interval = setInterval(() => {
			if (document.visibilityState === "visible") run();
		}, INTERVAL_MS);
		const onVisibility = () => {
			if (document.visibilityState === "hidden") run();
		};
		document.addEventListener("visibilitychange", onVisibility);
		let pauseHandle: PluginListenerHandle | undefined;
		let disposed = false;
		if (Capacitor.isNativePlatform()) {
			CapApp.addListener("pause", run).then((h) => {
				if (disposed) h.remove();
				else pauseHandle = h;
			});
		}
		return () => {
			disposed = true;
			clearTimeout(first);
			clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisibility);
			pauseHandle?.remove();
		};
	}, [uid]);

	return null;
};

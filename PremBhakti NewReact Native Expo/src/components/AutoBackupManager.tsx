import { useEffect } from "react";
import { AppState } from "react-native";
import {
	autoSaveToDrive,
	deviceHasUserData,
	getDriveAccessToken,
	isDriveBackupLinked,
	loadBackupFromDrive,
	restoreBackupJson,
} from "../lib/backup";
import { MIGRATED_KEY } from "../lib/migrateOldApp";
import { storage } from "../lib/storage";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";

// components/AutoBackupManager.tsx: the Drive backup that needs no attention.
//  - New phone / reinstall: if this device has none of the devotee's data yet
//    and Google already allows Drive access, the Drive backup comes back by
//    itself (checked once per account per device).
//  - On a device where Drive backup is on, the Drive copy is kept fresh: a
//    little after start, every few minutes while in use, and on going to the
//    background (autoSaveToDrive uploads only changes, at most every 15 min).
const FIRST_RUN_DELAY_MS = 20 * 1000;
const INTERVAL_MS = 5 * 60 * 1000;
const restoreCheckedKey = (uid: string) => `cpbs_drive_restore_checked_${uid}`;

export function AutoBackupManager() {
	const uid = useAuthStore((s) => s.user?.uid);

	useEffect(() => {
		if (!uid || storage.getBoolean(restoreCheckedKey(uid))) return;
		let cancelled = false;
		const markChecked = () => storage.set(restoreCheckedKey(uid), true);
		let timer: ReturnType<typeof setTimeout>;
		const check = async () => {
			// The old app's own data comes first (OldAppMigration).
			if (!storage.getBoolean(MIGRATED_KEY)) {
				timer = setTimeout(check, 5000);
				return;
			}
			try {
				if (deviceHasUserData() || isDriveBackupLinked()) return markChecked();
				const token = await getDriveAccessToken(false).catch(() => null);
				if (cancelled) return;
				if (!token) return markChecked();
				const found = await loadBackupFromDrive(token);
				if (cancelled) return;
				markChecked();
				if (!found || deviceHasUserData()) return;
				const isHindi = useSettingsStore.getState().settingsLanguage === "hi";
				restoreBackupJson(found.json, {
					fromDrive: true,
					message: isHindi ? "आपका पुराना डेटा Google Drive से वापस आ गया 🙏" : "Your saved data is back from Google Drive 🙏",
				});
			} catch {
				// Offline or Drive unavailable: ask again next launch.
			}
		};
		timer = setTimeout(check, 3000);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [uid]);

	useEffect(() => {
		if (!uid) return;
		let running = false;
		const run = async () => {
			if (running) return;
			running = true;
			await autoSaveToDrive().catch(() => {});
			running = false;
		};
		const first = setTimeout(run, FIRST_RUN_DELAY_MS);
		const interval = setInterval(() => {
			if (AppState.currentState === "active") run();
		}, INTERVAL_MS);
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "background") run();
		});
		return () => {
			clearTimeout(first);
			clearInterval(interval);
			sub.remove();
		};
	}, [uid]);

	return null;
}

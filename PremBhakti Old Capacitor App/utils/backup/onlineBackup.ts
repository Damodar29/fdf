/**
 * Legacy: app 47.0.x also kept an automatic backup in Firebase Storage
 * (user_backups/{uid}). Backups now live only in the devotee's own Google
 * Drive; this is kept only so account deletion still removes that old copy.
 */
import { deleteObject, ref } from "firebase/storage";
import { profileStorage } from "../../services/firebase";
import { safeLocalRemove } from "../safeLocalSet";

const backupRef = (uid: string) =>
	ref(profileStorage, `user_backups/${uid}/prem-bhakti-backup.json`);

/** Account deletion: remove the backup and this device's bookkeeping for it. */
export async function deleteOnlineBackup(uid: string) {
	try {
		await deleteObject(backupRef(uid));
	} catch (e: any) {
		if (e?.code !== "storage/object-not-found") throw e;
	}
	safeLocalRemove(`cpbs_online_backup_sig_${uid}`);
	safeLocalRemove(`cpbs_online_backup_at_${uid}`);
	safeLocalRemove(`cpbs_online_backup_ready_${uid}`);
}

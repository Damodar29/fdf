/**
 * useTourProgress.ts — which tour chapters this person has seen.
 *
 * Progress is `{ [chapterId]: versionSeen }`.
 *
 *  - Local copy: localStorage `cpbs_tour_progress`. Guests use only this.
 *  - Signed-in copy: `user_prefs/{uid}` → `{ tourProgress, updatedAt }`.
 *    NOT `users/{uid}`: that document has an onWrite Cloud Function
 *    (`syncFamilyLinkGroups`), so every write there costs a function call.
 *  - Read once per signed-in account per session (no realtime listener).
 *    Local and remote are merged chapter by chapter (the higher version wins)
 *    and remote is written only when the merge added something it lacked.
 *  - Written only when a chapter ends (finished or skipped), never per step.
 *  - A failed remote write is fine: the local copy is kept and the next
 *    session's merge pushes it up.
 *  - Replay resets everything. Because "higher version wins" cannot express a
 *    reset, a pending reset is remembered locally until the remote copy has
 *    been overwritten too.
 */
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { profileDb } from "../../services/firebase";
import {
	safeLocalGet,
	safeLocalRemove,
	safeLocalSet,
} from "../../utils/safeLocalSet";
import type { ChapterId } from "./tourSteps";

export type TourProgress = Partial<Record<ChapterId, number>>;

const LOCAL_KEY = "cpbs_tour_progress";
const RESET_PENDING_KEY = "cpbs_tour_reset_pending";
const PREFS_COLLECTION = "user_prefs";

function sanitize(raw: unknown): TourProgress {
	const out: TourProgress = {};
	if (!raw || typeof raw !== "object") return out;
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof value === "number" && Number.isFinite(value) && value > 0) {
			out[key as ChapterId] = Math.floor(value);
		}
	}
	return out;
}

export function readLocalProgress(): TourProgress {
	try {
		return sanitize(JSON.parse(safeLocalGet(LOCAL_KEY) || "{}"));
	} catch {
		return {};
	}
}

function writeLocalProgress(progress: TourProgress) {
	safeLocalSet(LOCAL_KEY, JSON.stringify(progress));
}

export function mergeProgress(a: TourProgress, b: TourProgress): TourProgress {
	const out: TourProgress = { ...a };
	for (const [key, value] of Object.entries(b)) {
		const id = key as ChapterId;
		if (typeof value === "number" && value > (out[id] ?? 0)) out[id] = value;
	}
	return out;
}

function isSameProgress(a: TourProgress, b: TourProgress): boolean {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const key of keys) {
		if ((a[key as ChapterId] ?? 0) !== (b[key as ChapterId] ?? 0)) return false;
	}
	return true;
}

const isResetPending = () => safeLocalGet(RESET_PENDING_KEY) === "1";

export function useTourProgress() {
	const { user } = useAuth();
	const uid = user?.uid ?? null;
	const [progress, setProgress] = useState<TourProgress>(readLocalProgress);
	const progressRef = useRef(progress);
	const uidRef = useRef(uid);
	uidRef.current = uid;
	const syncedUidRef = useRef<string | null>(null);

	const commit = useCallback((next: TourProgress) => {
		progressRef.current = next;
		setProgress(next);
		writeLocalProgress(next);
	}, []);

	/** Replaces the remote copy with the local one; clears a pending reset. */
	const overwriteRemote = useCallback(async (forUid: string) => {
		await setDoc(doc(profileDb, PREFS_COLLECTION, forUid), {
			tourProgress: progressRef.current,
			updatedAt: serverTimestamp(),
		});
		safeLocalRemove(RESET_PENDING_KEY);
	}, []);

	// One read per signed-in account per session, then merge.
	useEffect(() => {
		if (!uid || syncedUidRef.current === uid) return;
		syncedUidRef.current = uid;
		let cancelled = false;
		(async () => {
			try {
				if (isResetPending()) {
					await overwriteRemote(uid);
					return;
				}
				const snap = await getDoc(doc(profileDb, PREFS_COLLECTION, uid));
				if (cancelled || uidRef.current !== uid) return;
				const remote = sanitize(snap.exists() ? snap.data()?.tourProgress : {});
				const merged = mergeProgress(progressRef.current, remote);
				if (!isSameProgress(merged, progressRef.current)) commit(merged);
				if (!isSameProgress(merged, remote)) {
					await setDoc(
						doc(profileDb, PREFS_COLLECTION, uid),
						{ tourProgress: merged, updatedAt: serverTimestamp() },
						{ merge: true },
					);
				}
			} catch (e) {
				// Offline, rules, App Check… the local copy is enough for now.
				console.warn("[tour] progress sync skipped:", e);
				syncedUidRef.current = null;
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [uid, commit, overwriteRemote]);

	const markChapterDone = useCallback(
		(id: ChapterId, version: number) => {
			if ((progressRef.current[id] ?? 0) >= version) return;
			commit({ ...progressRef.current, [id]: version });
			const currentUid = uidRef.current;
			if (!currentUid) return;
			const write = isResetPending()
				? overwriteRemote(currentUid)
				: setDoc(
						doc(profileDb, PREFS_COLLECTION, currentUid),
						{ tourProgress: { [id]: version }, updatedAt: serverTimestamp() },
						{ merge: true },
					);
			write.catch((e) => console.warn("[tour] progress save skipped:", e));
		},
		[commit, overwriteRemote],
	);

	const resetAll = useCallback(() => {
		commit({});
		safeLocalSet(RESET_PENDING_KEY, "1");
		const currentUid = uidRef.current;
		if (!currentUid) return;
		overwriteRemote(currentUid).catch((e) =>
			console.warn("[tour] progress reset will sync later:", e),
		);
	}, [commit, overwriteRemote]);

	return { progress, progressRef, markChapterDone, resetAll };
}

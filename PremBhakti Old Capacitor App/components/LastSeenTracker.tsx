import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import type React from "react";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { profileDb } from "../services/firebase";
import { safeLocalGet, safeLocalSet } from "../utils/safeLocalSet";

// One write per device at most this often — enough for "last opened" in the
// admin panel without a Firestore write on every tab switch.
const MIN_GAP_MS = 30 * 60 * 1000;

const sentKey = (uid: string) => `cpbs_last_seen_sent_${uid}`;

/**
 * Records when a logged-in devotee last opened the app, for Admin → Devotee
 * Management. Kept in user_last_seen/{uid}, not users/{uid}: that document has
 * a paid onWrite Cloud Function. Renders nothing.
 */
export const LastSeenTracker: React.FC = () => {
	const { user } = useAuth();
	const uid = user?.uid;

	useEffect(() => {
		if (!uid) return;
		const record = () => {
			if (document.visibilityState !== "visible") return;
			const last = Number(safeLocalGet(sentKey(uid)));
			if (last && Date.now() - last < MIN_GAP_MS) return;
			safeLocalSet(sentKey(uid), String(Date.now()));
			setDoc(doc(profileDb, "user_last_seen", uid), {
				lastSeenAt: serverTimestamp(),
			}).catch((e) => {
				console.warn("[LastSeen] Could not record", e);
				// Let the next open try again.
				safeLocalSet(sentKey(uid), "");
			});
		};
		record();
		document.addEventListener("visibilitychange", record);
		return () => document.removeEventListener("visibilitychange", record);
	}, [uid]);

	return null;
};

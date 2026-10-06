import {
	addDoc,
	collection,
	doc,
	getDocs,
	limit,
	query,
	updateDoc,
	where,
} from "firebase/firestore";
import { profileDb as db } from "../../services/firebase";

export interface HHBSMGlorificationSubmission {
	name: string;
	location: string;
	glorification: string;
	uid?: string;
	phone?: string;
	email?: string;
	type?: "text" | "audio";
	audioUrl?: string;
	duration?: number;
	status?: "uploading" | "pending" | "approved";
}

export interface HHBSMGlorificationEntry extends HHBSMGlorificationSubmission {
	id: string;
	createdAt: number;
}

export const saveHHBSMGlorification = async (
	submission: HHBSMGlorificationSubmission,
): Promise<string> => {
	const data: Record<string, unknown> = {
		name: submission.name.trim(),
		location: submission.location.trim(),
		glorification: submission.glorification.trim(),
		createdAt: Date.now(),
		type: submission.type || "text",
	};
	if (submission.uid) data.uid = submission.uid;
	if (submission.phone) data.phone = submission.phone;
	if (submission.email) data.email = submission.email;
	if (submission.audioUrl) data.audioUrl = submission.audioUrl;
	if (submission.duration) data.duration = submission.duration;
	if (submission.status) data.status = submission.status;

	const docRef = await addDoc(collection(db, "hhbsm-2026-glorification"), data);
	return docRef.id;
};

/** Fetch a user's existing glorification submissions by their uid. Returns up to 3. */
export const getUserGlorifications = async (
	uid: string,
): Promise<HHBSMGlorificationEntry[]> => {
	const q = query(
		collection(db, "hhbsm-2026-glorification"),
		where("uid", "==", uid),
		limit(3),
	);
	const snap = await getDocs(q);
	if (snap.empty) return [];
	return snap.docs
		.map((d) => {
			const data = d.data();
			return {
				id: d.id,
				name: data.name || "",
				location: data.location || "",
				glorification: data.glorification || "",
				uid: data.uid || uid,
				phone: data.phone,
				email: data.email,
				createdAt: data.createdAt || 0,
				type: data.type || "text",
				audioUrl: data.audioUrl,
				duration: data.duration,
				status: data.status,
			};
		})
		.filter((entry) => entry.status !== "uploading");
};

/** Update the glorification for an existing submission.
 *  Only the owner (matched by uid) can call this — enforced by Firestore rules. */
export const updateHHBSMGlorification = async (
	docId: string,
	fields: {
		glorification: string;
		name: string;
		location: string;
		uid: string;
		phone?: string;
		email?: string;
		createdAt?: number;
		type?: "text" | "audio";
		audioUrl?: string;
		duration?: number;
		status?: "uploading" | "pending" | "approved";
	},
): Promise<void> => {
	const data: Record<string, any> = {
		glorification: fields.glorification.trim(),
		name: fields.name.trim(),
		location: fields.location.trim(),
		uid: fields.uid,
	};
	// createdAt must never change after creation — Firestore rules reject an
	// owner update that alters it, so only include it if the caller has the
	// original (unchanged) value and explicitly wants to send it back.
	if (fields.createdAt !== undefined) data.createdAt = fields.createdAt;
	if (fields.phone !== undefined) data.phone = fields.phone;
	if (fields.email !== undefined) data.email = fields.email;
	if (fields.type !== undefined) data.type = fields.type;
	if (fields.audioUrl !== undefined) data.audioUrl = fields.audioUrl;
	if (fields.duration !== undefined) data.duration = fields.duration;
	if (fields.status !== undefined) data.status = fields.status;

	await updateDoc(doc(db, "hhbsm-2026-glorification", docId), data);
};

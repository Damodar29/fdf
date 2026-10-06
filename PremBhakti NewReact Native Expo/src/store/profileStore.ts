import {
	collection,
	doc,
	type Firestore,
	initializeFirestore,
	onSnapshot,
	query,
	where,
} from "@firebase/firestore";
import { create } from "zustand";
import { webApp, webAuth } from "../lib/webAuth";

// The logged-in devotee's profile (users/{uid}) and their waiting family link
// requests — the `profile` / `pendingFamilyRequests` part of the OG
// AuthContext, read with the devotee's own login (the JS SDK session in
// lib/webAuth), as the profile rules require. Drives the notice at the top of
// Home, the diksha greeting and the dot on the header's profile button.

export interface FamilyMemberLite {
	id?: string;
	realName?: string;
	approvalStatus?: "pending" | "approved" | "rejected";
	rejectionNote?: string;
}

export interface DevoteeProfile {
	realName?: string;
	photoURL?: string;
	isApproved?: boolean;
	isAspiring?: boolean;
	isDeleted?: boolean;
	rejectionNote?: string;
	dikshaDate?: string;
	mandalId?: string;
	customMandalName?: string;
	familyMembers?: FamilyMemberLite[];
}

interface ProfileState {
	profile: DevoteeProfile | null;
	pendingFamilyRequests: number;
}

export const useProfileStore = create<ProfileState>(() => ({ profile: null, pendingFamilyRequests: 0 }));

let db: Firestore | null = null;
/** Firestore on the devotee's login (the web app's `profileDb`). */
export const profileDb = () => {
	// Long polling: React Native has no streaming fetch for Firestore's WebChannel.
	db ??= initializeFirestore(webApp, { experimentalForceLongPolling: true });
	return db;
};

let started = false;
/** Follows the login; idempotent. */
export function startProfileSync() {
	if (started) return;
	started = true;
	let unsubs: (() => void)[] = [];
	webAuth.onAuthStateChanged((user) => {
		for (const u of unsubs) u();
		unsubs = [];
		useProfileStore.setState({ profile: null, pendingFamilyRequests: 0 });
		if (!user) return;
		const fs = profileDb();
		unsubs.push(
			onSnapshot(
				doc(fs, "users", user.uid),
				(snap) => useProfileStore.setState({ profile: snap.exists() ? (snap.data() as DevoteeProfile) : null }),
				() => {},
			),
			onSnapshot(
				query(collection(fs, "familyLinkRequests"), where("toUserId", "==", user.uid), where("status", "==", "pending")),
				(snap) => useProfileStore.setState({ pendingFamilyRequests: snap.size }),
				() => {},
			),
		);
	});
}

export interface RejectionAlert {
	kind: "self" | "member";
	name: string;
	note: string;
	memberId?: string;
}

/** utils/reviewAlerts.ts: what the devotee must fix after an admin review. */
export function rejectionAlerts(profile: DevoteeProfile | null | undefined): RejectionAlert[] {
	if (!profile || profile.isDeleted) return [];
	const out: RejectionAlert[] = [];
	if (!profile.isApproved && profile.rejectionNote) {
		out.push({ kind: "self", name: profile.realName || "", note: profile.rejectionNote === "—" ? "" : profile.rejectionNote });
	}
	for (const m of profile.familyMembers || []) {
		if (m.approvalStatus === "rejected") {
			out.push({ kind: "member", name: m.realName || "", note: m.rejectionNote || "", memberId: m.id });
		}
	}
	return out;
}

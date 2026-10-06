import { onAuthStateChanged } from "@firebase/auth";
import { create } from "zustand";
import { webAuth } from "../lib/webAuth";

// Who is logged in (the devotee login shared with the web screens; see
// lib/webAuth). `ready` turns true once the saved session has been read.
export interface AuthUser {
	uid: string;
	displayName: string | null;
	email: string | null;
	phoneNumber: string | null;
	photoURL: string | null;
	/** Logged in with Google (Drive backup needs a Google account). */
	isGoogle: boolean;
}

export const useAuthStore = create<{ user: AuthUser | null; ready: boolean }>(() => ({ user: null, ready: false }));

onAuthStateChanged(webAuth, (u) => {
	useAuthStore.setState({
		ready: true,
		user: u
			? {
					uid: u.uid,
					displayName: u.displayName,
					email: u.email,
					phoneNumber: u.phoneNumber,
					photoURL: u.photoURL,
					isGoogle: u.providerData.some((p) => p.providerId === "google.com"),
				}
			: null,
	});
});

// Browser stand-in for @react-native-firebase/firestore. Its modular API has
// the same names as the web SDK's, so this is the web SDK on the default app.
// The preview reads the live project but never writes to it.
import { getFirestore as webGetFirestore } from "@firebase/firestore";
import { defaultApp } from "./rnfirebase-app";

export * from "@firebase/firestore";
export function getFirestore() {
	return webGetFirestore(defaultApp);
}
const skipped = async (..._args: unknown[]) => {
	console.warn("[preview] Firestore write skipped");
};
export const setDoc = skipped;
export const updateDoc = skipped;
export const deleteDoc = skipped;
export const addDoc = skipped;

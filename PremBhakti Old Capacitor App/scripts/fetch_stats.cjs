const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
require("dotenv").config();

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

async function run() {
	try {
		await signInWithEmailAndPassword(
			auth,
			process.env.ADMIN_EMAIL,
			process.env.ADMIN_PASSWORD,
		);
		const snap = await getDocs(collection(db, "app_version_stats"));
		const stats = [];
		snap.forEach((doc) => {
			stats.push({ id: doc.id, ...doc.data() });
		});
		const fs = require("node:fs");
		fs.writeFileSync("db_stats.json", JSON.stringify(stats, null, 2));
		console.log("Written to db_stats.json");
		process.exit(0);
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
}
run();

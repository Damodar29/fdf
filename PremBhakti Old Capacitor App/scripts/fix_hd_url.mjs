import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
	collection,
	doc,
	getDocs,
	getFirestore,
	updateDoc,
} from "firebase/firestore";

const app = initializeApp({
	apiKey: "AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY",
	authDomain: "cpbs-admin.firebaseapp.com",
	projectId: "cpbs-admin",
});
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
	console.log("Authenticating...");
	await signInWithEmailAndPassword(auth, "damodar@cpbs.com", "413541");
	console.log("✅ Authenticated!");

	console.log("Fetching videos from database...");
	const qs = await getDocs(collection(db, "videos"));
	const updates = [];

	qs.forEach((d) => {
		const v = d.data();
		const changes = {};
		let needsUpdate = false;

		if (v.hdUrl?.includes("archive.org")) {
			changes.hdUrl = v.url; // Replace with the new B2 url
			needsUpdate = true;
		}
		if (v.hd_url?.includes("archive.org")) {
			changes.hd_url = v.url;
			needsUpdate = true;
		}

		if (needsUpdate) {
			updates.push({ ref: doc(db, "videos", d.id), changes, title: v.title });
		}
	});

	console.log(
		`Found ${updates.length} videos with old Archive.org hd_url fields.`,
	);
	if (updates.length > 0) {
		console.log("Updating database...");
		for (const update of updates) {
			await updateDoc(update.ref, update.changes);
			console.log(`✅ Updated hd_url for: ${update.title}`);
		}
		console.log("All hd_url fields have been successfully fixed!");
	}

	process.exit(0);
}
run();

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
	collection,
	doc,
	getDocs,
	getFirestore,
	updateDoc,
} from "firebase/firestore";

// Load .env variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

const firebaseConfig = {
	apiKey: process.env.VITE_FIREBASE_API_KEY,
	authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const replaceExtension = (url: string) => {
	if (!url) return url;
	if (url.includes(".m4v")) return url.replace(/\.m4v/g, ".mp4");
	if (url.includes(".mov")) return url.replace(/\.mov/g, ".mp4");
	if (url.includes(".M4V")) return url.replace(/\.M4V/g, ".mp4");
	if (url.includes(".MOV")) return url.replace(/\.MOV/g, ".mp4");
	return url;
};

async function main() {
	console.log("Authenticating with Firebase...");
	try {
		await signInWithEmailAndPassword(
			auth,
			process.env.ADMIN_EMAIL!,
			process.env.ADMIN_PASSWORD!,
		);
		console.log("Successfully authenticated as Admin.");
	} catch (e: any) {
		console.error("Failed to authenticate:", e.message);
		process.exit(1);
	}

	console.log("-----------------------------------------");
	console.log("Scanning 'videos' collection...");
	const videosSnap = await getDocs(collection(db, "videos"));
	let videosUpdated = 0;

	for (const videoDoc of videosSnap.docs) {
		const data = videoDoc.data();
		let changed = false;
		const updates: any = {};

		if (
			data.url &&
			(data.url.toLowerCase().includes(".m4v") ||
				data.url.toLowerCase().includes(".mov"))
		) {
			updates.url = replaceExtension(data.url);
			changed = true;
		}

		if (
			data.hdUrl &&
			(data.hdUrl.toLowerCase().includes(".m4v") ||
				data.hdUrl.toLowerCase().includes(".mov"))
		) {
			updates.hdUrl = replaceExtension(data.hdUrl);
			changed = true;
		}

		if (changed) {
			console.log(
				`[videos] Updating doc ${videoDoc.id} (title: ${data.title})`,
			);
			await updateDoc(doc(db, "videos", videoDoc.id), updates);
			videosUpdated++;
		}
	}
	console.log(`Updated ${videosUpdated} documents in 'videos' collection.`);

	console.log("-----------------------------------------");
	console.log("Scanning 'mandals' collection...");
	const mandalsSnap = await getDocs(collection(db, "mandals"));
	let mandalsUpdated = 0;

	for (const mandalDoc of mandalsSnap.docs) {
		const data = mandalDoc.data();
		let changed = false;
		const updates: any = {};

		// Check videos array
		if (data.videos && Array.isArray(data.videos)) {
			const updatedVideos = data.videos.map((v: any) => {
				if (
					v.url &&
					(v.url.toLowerCase().includes(".m4v") ||
						v.url.toLowerCase().includes(".mov"))
				) {
					changed = true;
					return { ...v, url: replaceExtension(v.url) };
				}
				return v;
			});
			if (changed) updates.videos = updatedVideos;
		}

		// Check gallery array
		if (data.gallery && Array.isArray(data.gallery)) {
			const updatedGallery = data.gallery.map((g: any) => {
				if (
					g.url &&
					(g.url.toLowerCase().includes(".m4v") ||
						g.url.toLowerCase().includes(".mov"))
				) {
					changed = true;
					return { ...g, url: replaceExtension(g.url) };
				}
				return g;
			});
			// Only update gallery if it changed
			// Ensure we don't accidentally override the videos updates boolean state
			if (JSON.stringify(data.gallery) !== JSON.stringify(updatedGallery)) {
				updates.gallery = updatedGallery;
				changed = true;
			}
		}

		if (changed) {
			console.log(
				`[mandals] Updating doc ${mandalDoc.id} (name: ${data.name})`,
			);
			await updateDoc(doc(db, "mandals", mandalDoc.id), updates);
			mandalsUpdated++;
		}
	}
	console.log(`Updated ${mandalsUpdated} documents in 'mandals' collection.`);

	console.log("-----------------------------------------");
	console.log("Database update complete! You can safely close this script.");
	process.exit(0);
}

main().catch(console.error);

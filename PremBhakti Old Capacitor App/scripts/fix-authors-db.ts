import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getBytes, getStorage, ref, uploadString } from "firebase/storage";

dotenv.config();

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
const storage = getStorage(app);

const STORAGE_BASE = "app-data";
const storagePath = (tag: string, fileName: string) =>
	`${STORAGE_BASE}/${tag}/${fileName}`;

const readJson = async (tag: string, fileName: string) => {
	const storageRef = ref(storage, storagePath(tag, fileName));
	const bytes = await getBytes(storageRef);
	const text = new TextDecoder("utf-8").decode(bytes);
	return JSON.parse(text);
};

const saveJson = async (tag: string, fileName: string, data: any) => {
	const storageRef = ref(storage, storagePath(tag, fileName));
	await uploadString(storageRef, JSON.stringify(data, null, 2), "raw", {
		contentType: "application/json; charset=utf-8",
	});
};

const normalizeAuthorMatch = (val: string): string => {
	if (!val) return "";
	let ungarbled = val;
	try {
		if (val.includes("Ó") || val.includes("ñ")) {
			const arr = new Uint8Array([...val].map((c) => c.charCodeAt(0)));
			ungarbled = new TextDecoder("utf-8").decode(arr);
		}
	} catch (_e) {}
	return ungarbled;
};

const run = async () => {
	try {
		console.log("Logging in...");
		await signInWithEmailAndPassword(auth, "damodar@cpbs.com", "413541");
		console.log("Logged in successfully!");

		console.log("Fetching authors config...");
		const authorsData = await readJson("appconfig", "authors.json");
		const authors = authorsData.authors || {};

		console.log("Fetching bhajandata/bundle.json...");
		const bundle = await readJson("bhajandata", "bundle.json");

		console.log("Fetching bhajandata/index.json...");
		const index = await readJson("bhajandata", "index.json");

		// Backup
		const backupDir = path.join(process.cwd(), "backup");
		if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
		fs.writeFileSync(
			path.join(backupDir, "bundle_backup.json"),
			JSON.stringify(bundle, null, 2),
		);
		fs.writeFileSync(
			path.join(backupDir, "index_backup.json"),
			JSON.stringify(index, null, 2),
		);
		console.log("✅ Local backup saved to /backup");

		let changesCount = 0;

		const processBhajans = (bhajanArray: any[]) => {
			return bhajanArray.map((b) => {
				if (!b.author) return b;

				const normEffective = normalizeAuthorMatch(b.author);
				let matchedKey = normEffective;

				if (!authors[normEffective]) {
					const found = Object.entries(authors).find(
						([_k, v]: [string, any]) =>
							v.deva === normEffective || v.iast === normEffective,
					);
					if (found) matchedKey = found[0];
				}

				if (b.author !== matchedKey) {
					console.log(
						`[Change] ID: ${b.id} | "${b.author}" -> "${matchedKey}"`,
					);
					changesCount++;
					return { ...b, author: matchedKey };
				}

				return b;
			});
		};

		console.log("Processing bundle.json...");
		const updatedBundle = processBhajans(bundle);

		console.log("Processing index.json (bhajans array)...");
		index.bhajans = processBhajans(index.bhajans);

		console.log(
			`\nFound ${changesCount / 2} bhajans to update (changes apply to both bundle and index).`,
		);

		if (changesCount > 0) {
			console.log("Uploading fixed bundle.json...");
			await saveJson("bhajandata", "bundle.json", updatedBundle);

			console.log("Uploading fixed index.json...");
			index.bundleUpdated = Date.now();
			index.lastUpdated = Date.now();
			await saveJson("bhajandata", "index.json", index);

			console.log("✅ Database successfully fixed!");
		} else {
			console.log("No changes were needed.");
		}

		process.exit(0);
	} catch (e) {
		console.error("Error:", e);
		process.exit(1);
	}
};

run();

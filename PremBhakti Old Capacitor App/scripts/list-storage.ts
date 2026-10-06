import fs from "node:fs";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getStorage, listAll, ref } from "firebase/storage";

dotenv.config();

const app = initializeApp({
	apiKey: process.env.VITE_FIREBASE_API_KEY,
	authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.VITE_FIREBASE_APP_ID,
});
const storage = getStorage(app);

const getFilesRecursive = async (path: string, allFiles: any[]) => {
	const folderRef = ref(storage, path);
	const result = await listAll(folderRef);

	for (const itemRef of result.items) {
		allFiles.push(itemRef.fullPath);
	}
	for (const prefixRef of result.prefixes) {
		await getFilesRecursive(prefixRef.fullPath, allFiles);
	}
};

const run = async () => {
	try {
		console.log("Fetching list of files in storage...");
		const allFiles: string[] = [];
		await getFilesRecursive("app-data", allFiles);

		fs.writeFileSync("storage_files.json", JSON.stringify(allFiles, null, 2));
		console.log(`Saved ${allFiles.length} file paths to storage_files.json`);
		process.exit(0);
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
};

run();

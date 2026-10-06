import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	DeleteObjectCommand,
	ListObjectsV2Command,
	S3Client,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

// 1. Initialize Firebase Admin
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.resolve(__dirname, "../serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
	console.error("Error: serviceAccountKey.json not found in root directory.");
	process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

if (getApps().length === 0) {
	initializeApp({
		credential: cert(serviceAccount),
	});
}
const db = getFirestore();

// 2. Initialize B2 S3 Client
const b2 = new S3Client({
	region: process.env.B2_REGION,
	endpoint: process.env.B2_ENDPOINT,
	credentials: {
		accessKeyId: process.env.B2_KEY_ID,
		secretAccessKey: process.env.B2_APP_KEY,
	},
});

const BUCKET = process.env.B2_BUCKET;
const PREFIX = "hhbsm-2026-glorification-audios/";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

async function cleanupGhosts() {
	console.log("🚀 Starting Ghost Cleanup for Glorification Audios...");
	const now = Date.now();
	const threshold = now - TWO_HOURS_MS;

	// --- PART 1: Cleanup Firestore Documents ---
	console.log("\n🧹 Checking Firestore for stuck 'uploading' documents...");
	const snapshot = await db
		.collection("hhbsm-2026-glorification")
		.where("status", "==", "uploading")
		.get();

	let deletedDocsCount = 0;
	const batch = db.batch();

	snapshot.forEach((doc) => {
		const data = doc.data();
		if (data.createdAt && data.createdAt < threshold) {
			console.log(
				` - Deleting stuck document: ${doc.id} (Created: ${new Date(data.createdAt).toLocaleString()})`,
			);
			batch.delete(doc.ref);
			deletedDocsCount++;
		}
	});

	if (deletedDocsCount > 0) {
		await batch.commit();
		console.log(
			`✅ Deleted ${deletedDocsCount} stuck documents from Firestore.`,
		);
	} else {
		console.log("✅ No stuck documents found to delete.");
	}

	// --- PART 2: Cleanup Backblaze B2 Orphan Files ---
	console.log("\n🧹 Checking Backblaze B2 for orphaned audio files...");

	// Fetch ALL documents to ensure we don't delete files for 'rejected' or custom statuses
	const allDocs = await db.collection("hhbsm-2026-glorification").get();
	const validFileKeys = new Set();

	allDocs.forEach((doc) => {
		const data = doc.data();
		// If a document exists and has an audioUrl, we MUST consider it valid and keep its file
		if (data.status !== "uploading" && data.audioUrl) {
			try {
				const urlObj = new URL(data.audioUrl);
				let key = decodeURIComponent(urlObj.pathname);
				if (key.startsWith("/")) key = key.substring(1);
				validFileKeys.add(key);
			} catch (_e) {
				// Ignore invalid URLs
			}
		}
	});

	console.log(
		`📊 Found ${validFileKeys.size} valid audio files referenced in the database.`,
	);

	let continuationToken;
	let deletedFilesCount = 0;

	do {
		const listCommand = new ListObjectsV2Command({
			Bucket: BUCKET,
			Prefix: PREFIX,
			ContinuationToken: continuationToken,
		});

		const response = await b2.send(listCommand);

		if (response.Contents) {
			for (const file of response.Contents) {
				if (!file.Key || !file.LastModified) continue;

				// Skip if file is newer than 2 hours (might still be uploading)
				if (file.LastModified.getTime() > threshold) continue;

				// If file is older than 2 hours and NOT in the database, it's an orphan!
				if (!validFileKeys.has(file.Key)) {
					console.log(
						` - Deleting orphan file from B2: ${file.Key} (Last Modified: ${file.LastModified.toLocaleString()})`,
					);

					await b2.send(
						new DeleteObjectCommand({
							Bucket: BUCKET,
							Key: file.Key,
						}),
					);
					deletedFilesCount++;
				}
			}
		}

		continuationToken = response.NextContinuationToken;
	} while (continuationToken);

	console.log(
		`✅ Deleted ${deletedFilesCount} orphaned files from Backblaze B2.`,
	);
	console.log("\n🎉 Cleanup complete!");
}

cleanupGhosts().catch((err) => {
	console.error("❌ Error during cleanup:", err);
	process.exit(1);
});

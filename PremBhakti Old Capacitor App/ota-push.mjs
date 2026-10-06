/**
 * ota-push.mjs
 *
 * OTA Update Push Script — Self-hosted on Backblaze B2 + Cloudflare CDN
 *
 * Usage:
 *   npm run build && node ota-push.mjs
 *
 * What it does:
 *   1. Reads version from package.json
 *   2. Zips the dist/ folder
 *   3. Uploads the zip to Backblaze B2  (ota-bundles/<version>.zip)
 *   4. Serves publicly via Cloudflare   (ota.chaitanyaprembhakti.org/ota-bundles/<version>.zip)
 *   5. Updates Firestore doc "ota_config/latest" with the new version & CDN URL
 *   6. App auto-downloads and applies on next launch!
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { config } from "dotenv";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load .env variables
config();

const require = createRequire(import.meta.url);
const { zip } = require("zip-a-folder");

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = join(__dirname, "serviceAccountKey.json");
const PACKAGE_JSON_PATH = join(__dirname, "package.json");
const DIST_DIR = join(__dirname, "dist");

// Backblaze B2  (reads from .env)
const B2_BUCKET = process.env.B2_BUCKET || "cpbs-videos";
const B2_ENDPOINT =
	process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com";
const B2_REGION = process.env.B2_REGION || "us-east-005";

// Cloudflare CDN base URL for OTA bundles
const CDN_BASE = "https://ota.chaitanyaprembhakti.org";
const OTA_PREFIX = "ota-bundles";
// ─────────────────────────────────────────────────────────────────────────────

function makeS3Client() {
	return new S3Client({
		region: B2_REGION,
		endpoint: B2_ENDPOINT,
		credentials: {
			accessKeyId: process.env.B2_KEY_ID,
			secretAccessKey: process.env.B2_APP_KEY,
		},
	});
}

async function uploadToB2(s3, localPath, s3Key) {
	const stream = createReadStream(localPath);
	const size = statSync(localPath).size;

	const upload = new Upload({
		client: s3,
		params: {
			Bucket: B2_BUCKET,
			Key: s3Key,
			Body: stream,
			ContentType: "application/zip",
			ContentLength: size,
		},
		partSize: 10 * 1024 * 1024, // 10 MB per part
		queueSize: 1, // one part at a time (stable on slow connections)
		leavePartsOnError: false,
	});

	// Show progress
	upload.on("httpUploadProgress", (progress) => {
		const pct = Math.round((progress.loaded / progress.total) * 100);
		process.stdout.write(
			`\r   Progress: ${pct}% (${(progress.loaded / 1024 / 1024).toFixed(1)} / ${(progress.total / 1024 / 1024).toFixed(1)} MB)`,
		);
	});

	await upload.done();
	process.stdout.write("\n");
}

function computeChecksum(filePath) {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		const stream = createReadStream(filePath);
		stream.on("data", (d) => hash.update(d));
		stream.on("end", () => resolve(hash.digest("hex")));
		stream.on("error", (err) => reject(err));
	});
}

async function main() {
	console.log("\n🚀 OTA Push — Prem Bhakti App (Backblaze B2 + Cloudflare)\n");

	// ── 1. Read version ────────────────────────────────────────────────────────
	const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
	const version = pkg.version;
	console.log(`📦 Version: ${version}`);

	// ── 2. Check dist/ exists ──────────────────────────────────────────────────
	if (!existsSync(DIST_DIR)) {
		console.error('❌ dist/ folder not found! Run "npm run build" first.');
		process.exit(1);
	}

	// ── 3. Check B2 credentials ────────────────────────────────────────────────
	if (!process.env.B2_KEY_ID || !process.env.B2_APP_KEY) {
		console.error("❌ B2_KEY_ID and B2_APP_KEY must be set in .env");
		process.exit(1);
	}

	// ── 4. Check Firebase service account ─────────────────────────────────────
	if (!existsSync(SERVICE_ACCOUNT_PATH)) {
		console.error("❌ serviceAccountKey.json not found!");
		process.exit(1);
	}

	// ── 5. Init Firebase Admin (Firestore only — no Firebase Storage) ──────────
	const serviceAccount = JSON.parse(
		readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"),
	);
	initializeApp({ credential: cert(serviceAccount) });
	const db = getFirestore();

	// ── 6. Create ZIP of dist/ ────────────────────────────────────────────────
	const zipPath = join(__dirname, `ota-bundle-${version}.zip`);
	console.log(`\n📦 Zipping dist/ → ${zipPath}`);
	await zip(DIST_DIR, zipPath);
	const sizeMB = (statSync(zipPath).size / 1024 / 1024).toFixed(2);
	console.log(`✅ Zip created (${sizeMB} MB)`);

	// ── 7. Compute SHA-256 checksum ────────────────────────────────────────────
	const checksum = await computeChecksum(zipPath);
	console.log(`🔒 SHA-256: ${checksum}`);

	// ── 8. Upload ZIP to Backblaze B2 ──────────────────────────────────────────
	const s3Key = `${OTA_PREFIX}/${version}.zip`;
	const s3 = makeS3Client();

	console.log(`\n☁️  Uploading to Backblaze B2...`);
	console.log(`   Bucket : ${B2_BUCKET}`);
	console.log(`   Key    : ${s3Key}`);

	await uploadToB2(s3, zipPath, s3Key);

	const cdnUrl = `${CDN_BASE}/${s3Key}`;
	console.log(`✅ Upload complete!`);
	console.log(`   CDN URL: ${cdnUrl}`);

	// ── 9. Update Firestore ota_config/latest ─────────────────────────────────
	console.log(`\n🔥 Updating Firestore ota_config/latest...`);
	await db
		.collection("ota_config")
		.doc("latest")
		.set({
			version,
			url: cdnUrl,
			checksum,
			message: `Version ${version}`,
			updatedAt: new Date().toISOString(),
		});
	console.log(`✅ Firestore updated!`);

	// ── 10. Cleanup local ZIP ──────────────────────────────────────────────────
	const { unlink } = await import("node:fs/promises");
	await unlink(zipPath);
	console.log(`🗑️  Local zip deleted.`);

	// ── Done ───────────────────────────────────────────────────────────────────
	console.log(`\n🎉 OTA Update pushed successfully!`);
	console.log(`   Version : ${version}`);
	console.log(`   URL     : ${cdnUrl}`);
	console.log(
		`\n📱 Users will get this update automatically on next app launch!\n`,
	);
}

main().catch((err) => {
	console.error("❌ OTA Push failed:", err.message);
	process.exit(1);
});

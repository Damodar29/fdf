import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SERVICE_ACCOUNT_PATH = join(__dirname, "serviceAccountKey.json");
const PACKAGE_JSON_PATH = join(__dirname, "package.json");

async function main() {
	console.log("🔍 Checking version before deployment...");

	// 1. Read local package.json version
	if (!existsSync(PACKAGE_JSON_PATH)) {
		console.error("❌ package.json not found!");
		process.exit(1);
	}
	const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
	const localVersion = pkg.version;

	// 2. Init Firebase Admin
	if (!existsSync(SERVICE_ACCOUNT_PATH)) {
		console.error("❌ serviceAccountKey.json not found!");
		process.exit(1);
	}
	const serviceAccount = JSON.parse(
		readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"),
	);
	initializeApp({ credential: cert(serviceAccount) });
	const db = getFirestore();

	// 3. Fetch remote version
	const docRef = db.collection("ota_config").doc("latest");
	const snap = await docRef.get();

	if (snap.exists) {
		const data = snap.data();
		const remoteVersion = data.version;

		// Check if localVersion is <= remoteVersion
		const isNewer = (local, remote) => {
			const l = local.replace("v", "").split(".").map(Number);
			const r = remote.replace("v", "").split(".").map(Number);
			for (let i = 0; i < Math.max(l.length, r.length); i++) {
				const c1 = l[i] || 0;
				const c2 = r[i] || 0;
				if (c1 > c2) return true;
				if (c1 < c2) return false;
			}
			return false; // They are equal
		};

		if (!isNewer(localVersion, remoteVersion)) {
			console.error(`\n======================================================`);
			console.error(`🚨 FATAL ERROR: Version conflict detected!`);
			console.error(`======================================================`);
			console.error(
				`You are trying to deploy version v${localVersion}, but the`,
			);
			console.error(
				`active OTA version in Firestore is already v${remoteVersion}.`,
			);
			console.error(`\nYour local package.json version MUST BE GREATER than`);
			console.error(`the live version to prevent a split-brain state where`);
			console.error(`native users do not receive the update.`);
			console.error(`\n👉 PLEASE BUMP THE VERSION IN package.json FIRST!`);
			console.error(`======================================================\n`);
			process.exit(1);
		}
	}

	console.log(`✅ Version v${localVersion} is fresh! Deployment can proceed.`);
	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Version check failed:", err.message);
	process.exit(1);
});

// Recover 293 using Firebase Damtoken
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
const fs = require("node:fs");

async function main() {
	try {
		console.log("Loading firebase config...");
		// Hacky way to pull firebase config from utils/firebase.ts
		const firebaseStr = fs.readFileSync("./utils/firebase.ts", "utf-8");
		const configStrMatch = firebaseStr.match(
			/const firebaseConfig = ({[\s\S]*?});/,
		);

		if (!configStrMatch) throw new Error("Could not find firebaseConfig");

		let configStr = configStrMatch[1];
		// Clean up keys to be valid JSON
		configStr = configStr.replace(/(\w+):/g, '"$1":').replace(/'/g, '"');

		// Because there's a trailing comma we might need to remove it
		configStr = configStr.replace(/,\s*}/g, "}");

		const firebaseConfig = JSON.parse(configStr);

		console.log("Initializing Firebase...");
		const app = initializeApp(firebaseConfig);
		const db = getFirestore(app);

		console.log("Fetching Github token from Firestore...");
		const tokenDoc = await getDoc(doc(db, "damtoken", "github"));
		const token = tokenDoc.data().token;

		if (!token) throw new Error("Token not found in document");
		console.log("✅ Token successfully fetched");

		const fetch = (await import("node-fetch")).default;

		const OWNER = "chaitanyaprembhakti";
		const REPO = "CPBS-APP-ORIGNAL-PHASE-1";
		const TAG = "bhajandata";
		const headers = { Authorization: `Bearer ${token}` };

		// 1. Fetch bundle.json
		console.log("📦 Fetching bundle.json...");
		const bundleUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/bundle.json`;
		const bundleRes = await fetch(bundleUrl);
		const bundle = await bundleRes.json();

		// 2. Find bhajan 293 in bundle
		const bhajan293 = bundle.find(
			(b) => b.bhajan_id === "293" || b.id === "293",
		);
		if (!bhajan293) throw new Error("Bhajan 293 not found in bundle");

		console.log(`✅ Found bhajan 293: "${bhajan293.title}"`);

		// 3. Get release upload URL
		console.log("🔗 Fetching GitHub release info...");
		const releaseRes = await fetch(
			`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
			{ headers },
		);
		const release = await releaseRes.json();

		// Check if 293.json already exists and delete if it does
		const assetsRes = await fetch(
			`https://api.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?per_page=100`,
			{ headers },
		);
		const assets = await assetsRes.json();
		const existing = assets.find((a) => a.name === "293.json");
		if (existing) {
			console.log("⚠️  293.json already exists! Deleting old one first...");
			await fetch(
				`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${existing.id}`,
				{ method: "DELETE", headers },
			);
		}

		const uploadUrl = release.upload_url.replace(
			"{?name,label}",
			"?name=293.json",
		);
		console.log("⬆️  Uploading to:", uploadUrl);

		const uploadRes = await fetch(uploadUrl, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify(bhajan293, null, 2),
		});

		if (!uploadRes.ok) {
			const err = await uploadRes.text();
			throw new Error(`Upload failed (${uploadRes.status}): ${err}`);
		}

		console.log("✅ 293.json successfully recovered via DAMTOKEN!");
		process.exit(0);
	} catch (e) {
		console.error("💥 Error:", e.message);
		process.exit(1);
	}
}

main();

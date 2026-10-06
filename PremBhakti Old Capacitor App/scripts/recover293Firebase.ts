import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import fetch from "node-fetch";

const mainFirebaseConfig = {
	apiKey: "AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY",
	authDomain: "cpbs-admin.firebaseapp.com",
	projectId: "cpbs-admin",
	storageBucket: "cpbs-admin.firebasestorage.app",
	messagingSenderId: "33454825743",
	appId: "1:33454825743:web:aa6a872cf5058b284b9e7a",
};

async function main() {
	try {
		console.log("Initializing Firebase with config...");
		const app = initializeApp(mainFirebaseConfig);
		const db = getFirestore(app);

		console.log("Fetching Github token from Firestore (damtoken/github)...");
		const tokenDoc = await getDoc(doc(db, "damtoken", "github"));
		const tokenData = tokenDoc.data();
		if (!tokenData?.token) throw new Error("Token not found in document");

		const token = tokenData.token;
		console.log("✅ Token successfully fetched from Firebase");

		const OWNER = "chaitanyaprembhakti";
		const REPO = "CPBS-APP-ORIGNAL-PHASE-1";
		const TAG = "bhajandata";
		const headers = { Authorization: `Bearer ${token}` };

		// 1. Fetch bundle.json
		console.log("📦 Fetching bundle.json...");
		const bundleUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/bundle.json`;
		const bundleRes = await fetch(bundleUrl);
		const bundle = (await bundleRes.json()) as any[];

		// 2. Find bhajan 293 in bundle
		const bhajan293 = bundle.find(
			(b) => String(b.bhajan_id) === "293" || String(b.id) === "293",
		);
		if (!bhajan293) throw new Error("Bhajan 293 not found in bundle");

		console.log(`✅ Found bhajan 293: "${bhajan293.title || "Unknown Title"}"`);

		// 3. Get release upload URL
		console.log("🔗 Fetching GitHub release info...");
		const releaseRes = await fetch(
			`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
			{ headers },
		);
		const release: any = await releaseRes.json();

		// 4. Check if 293.json already exists and delete if it does
		const assetsRes = await fetch(
			`https://api.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?per_page=100`,
			{ headers },
		);
		const assets = (await assetsRes.json()) as any[];

		const existing = assets.find((a) => a.name === "293.json");
		if (existing) {
			console.log("⚠️  293.json already exists! Deleting old one first...");
			await fetch(
				`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${existing.id}`,
				{ method: "DELETE", headers },
			);
		}

		console.log("⬆️  Uploading 293.json...");
		const uploadUrl = release.upload_url.replace(
			"{?name,label}",
			"?name=293.json",
		);

		const uploadRes = await fetch(uploadUrl, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify(bhajan293, null, 2),
		});

		if (!uploadRes.ok) {
			const err = await uploadRes.text();
			throw new Error(`Upload failed (${uploadRes.status}): ${err}`);
		}

		console.log("✅ 293.json successfully recovered and uploaded to GitHub!");
		process.exit(0);
	} catch (e: any) {
		console.error("💥 Error:", e.message);
		process.exit(1);
	}
}

main();

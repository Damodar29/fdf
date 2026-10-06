/**
 * Recovery Script: Re-upload 293.json from bundle.json
 * Run: npx ts-node scripts/recover293.ts
 */

import fetch from "node-fetch";

const OWNER = "chaitanyaprembhakti";
const REPO = "CPBS-APP-ORIGNAL-PHASE-1";
const TAG = "bhajandata";

// ─── PASTE YOUR GITHUB TOKEN BELOW ───────────────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	if (!GITHUB_TOKEN) {
		console.error("❌ Set GITHUB_TOKEN environment variable first.");
		process.exit(1);
	}

	const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };

	// 1. Fetch bundle.json
	console.log("📦 Fetching bundle.json...");
	const bundleUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/bundle.json`;
	const bundleRes = await fetch(bundleUrl);
	if (!bundleRes.ok)
		throw new Error(`Could not fetch bundle.json: ${bundleRes.status}`);
	const bundle: any[] = (await bundleRes.json()) as any[];
	console.log(`✅ bundle.json fetched — ${bundle.length} bhajans`);

	// 2. Find bhajan 293 in bundle
	const bhajan293 = bundle.find(
		(b: any) => b.bhajan_id === "293" || b.id === "293",
	);
	if (!bhajan293) {
		console.error("❌ Bhajan with bhajan_id=293 not found in bundle.json!");
		console.log(
			"Available ids:",
			bundle.slice(0, 10).map((b: any) => b.bhajan_id),
		);
		process.exit(1);
	}
	console.log(`✅ Found bhajan 293: "${bhajan293.title}"`);

	// 3. Get release info
	console.log("🔗 Fetching GitHub release info...");
	const releaseRes = await fetch(
		`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
		{ headers },
	);
	if (!releaseRes.ok)
		throw new Error(`Failed to fetch release: ${releaseRes.status}`);
	const release: any = await releaseRes.json();
	const uploadUrlBase: string = release.upload_url;
	console.log(`✅ Release ID: ${release.id}`);

	// 4. Check that 293.json doesn't already exist
	const assetsRes = await fetch(
		`https://api.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?per_page=100`,
		{ headers },
	);
	const assets: any[] = (await assetsRes.json()) as any[];
	const existing = assets.find((a: any) => a.name === "293.json");
	if (existing) {
		console.log("⚠️  293.json already exists! Deleting old one first...");
		const delRes = await fetch(
			`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${existing.id}`,
			{ method: "DELETE", headers },
		);
		console.log(
			delRes.ok
				? "✅ Deleted old 293.json"
				: `❌ Delete failed: ${delRes.status}`,
		);
	}

	// 5. Upload 293.json
	console.log("⬆️  Uploading 293.json...");
	const uploadUrl = uploadUrlBase.replace("{?name,label}", "?name=293.json");
	const uploadRes = await fetch(uploadUrl, {
		method: "POST",
		headers: { ...headers, "Content-Type": "application/json" },
		body: JSON.stringify(bhajan293, null, 2),
	});
	if (!uploadRes.ok) {
		const errText = await uploadRes.text();
		throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
	}

	console.log("✅ 293.json successfully recovered and uploaded to GitHub!");
	console.log(`📋 Bhajan: ${bhajan293.title} | ID: ${bhajan293.bhajan_id}`);
}

main().catch((e) => {
	console.error("💥 Recovery failed:", e.message);
	process.exit(1);
});

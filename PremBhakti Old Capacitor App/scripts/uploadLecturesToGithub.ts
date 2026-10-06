/**
 * One-time script: Upload all lectures to GitHub Release "lecturedata"
 * Run with: npx tsx scripts/uploadLecturesToGithub.ts
 *
 * PAT token is read from GITHUB_TOKEN env variable:
 *   set GITHUB_TOKEN=ghp_xxxxx && npx tsx scripts/uploadLecturesToGithub.ts
 */

import * as fs from "node:fs";

const OWNER = "chaitanyaprembhakti";
const REPO = "CPBS-APP-ORIGNAL-PHASE-1";
const TAG = "lecturedata";
const TOKEN = process.env.GITHUB_TOKEN || "";

if (!TOKEN) {
	console.error("❌ Set GITHUB_TOKEN env variable before running this script.");
	process.exit(1);
}

// Read and parse lectures data
const lecturesRaw = fs.readFileSync("./data/lectures.ts", "utf-8");
const LECTURES_DATA: any[] = [];
try {
	const stripped = lecturesRaw
		.replace(/import.*\n/g, "")
		.replace(/export const LECTURES_DATA.*?=\s*/, "LECTURES_DATA = ")
		.replace(/:\s*LectureData\[\]/g, "");
	eval(stripped);
} catch (e) {
	console.error("Failed to parse lectures data:", e);
	process.exit(1);
}

function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return (hash >>> 0).toString(16) + str.length;
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${TOKEN}`,
			Accept: "application/vnd.github+json",
			...((options.headers as any) || {}),
		},
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`GitHub API error ${response.status}: ${text.substring(0, 200)}`,
		);
	}
	if (response.status === 204) return null;
	return response.json();
}

async function getAllAssets(releaseId: number): Promise<any[]> {
	let assets: any[] = [];
	let page = 1;
	while (true) {
		const pageAssets = await apiFetch(
			`https://api.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?per_page=100&page=${page}`,
		);
		if (!Array.isArray(pageAssets) || pageAssets.length === 0) break;
		assets = assets.concat(pageAssets);
		if (pageAssets.length < 100) break;
		page++;
	}
	return assets;
}

async function deleteAsset(assetId: number): Promise<void> {
	await fetch(
		`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${assetId}`,
		{
			method: "DELETE",
			headers: { Authorization: `Bearer ${TOKEN}` },
		},
	);
}

async function uploadAsset(
	uploadUrlBase: string,
	name: string,
	content: string,
): Promise<void> {
	const uploadUrl = uploadUrlBase.replace(
		"{?name,label}",
		`?name=${encodeURIComponent(name)}`,
	);
	const res = await fetch(uploadUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${TOKEN}`,
			"Content-Type": "application/json",
		},
		body: content,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Upload failed for ${name}: ${text.substring(0, 200)}`);
	}
	console.log(`  ✅ Uploaded: ${name}`);
}

async function main() {
	console.log(
		`\n🎙️ Uploading ${LECTURES_DATA.length} lectures to GitHub Release: ${TAG}\n`,
	);

	const release = await apiFetch(
		`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
	);
	const uploadUrlBase = release.upload_url;
	const releaseId = release.id;
	console.log(`✅ Found release: ${release.name || TAG} (ID: ${releaseId})`);

	console.log("Fetching existing assets...");
	const existingAssets = await getAllAssets(releaseId);
	console.log(`  Found ${existingAssets.length} existing assets`);

	for (const asset of existingAssets) {
		if (asset.name.endsWith(".json")) {
			console.log(`  🗑️ Deleting: ${asset.name}`);
			await deleteAsset(asset.id);
			await new Promise((r) => setTimeout(r, 300));
		}
	}

	const indexLectures: any[] = [];
	const bundleData: any[] = [];
	for (const lecture of LECTURES_DATA) {
		// Lecture IDs are slug strings like "jhansi-katha" — use directly as filename
		const fileName = `${lecture.id}.json`;
		console.log(
			`\n🎙️ Uploading: ${fileName} — ${lecture.title.substring(0, 40)}...`,
		);
		await uploadAsset(
			uploadUrlBase,
			fileName,
			JSON.stringify(lecture, null, 2),
		);

		const contentHash = hashString(
			lecture.title + lecture.description + JSON.stringify(lecture.audio || []),
		);
		indexLectures.push({
			id: lecture.id,
			title: lecture.title,
			description: lecture.description,
			date: lecture.date || "",
			audioCount: lecture.audio?.length || 0,
			isHidden: false,
			contentHash,
		});

		bundleData.push({ ...lecture, isHidden: false });

		await new Promise((r) => setTimeout(r, 500));
	}

	// Upload bundle.json
	console.log("\n📦 Uploading bundle.json...");
	await uploadAsset(
		uploadUrlBase,
		"bundle.json",
		JSON.stringify(bundleData, null, 2),
	);

	const indexData = {
		lastUpdated: Date.now(),
		bundleUpdated: Date.now(),
		total: indexLectures.length,
		lectures: indexLectures,
	};
	console.log("\n📋 Uploading index.json...");
	await uploadAsset(
		uploadUrlBase,
		"index.json",
		JSON.stringify(indexData, null, 2),
	);

	console.log(
		`\n🎉 Done! Uploaded ${LECTURES_DATA.length} lectures + index.json to release: ${TAG}`,
	);
}

main().catch((err) => {
	console.error("\n❌ Script failed:", err);
	process.exit(1);
});

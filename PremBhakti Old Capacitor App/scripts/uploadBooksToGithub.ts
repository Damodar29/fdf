/**
 * One-time script: Upload all books to GitHub Release "bookdata"
 * Run with: npx ts-node -e "require('./scripts/uploadBooksToGithub.ts')"
 * Or: npx tsx scripts/uploadBooksToGithub.ts
 *
 * PAT token is read from GITHUB_TOKEN env variable.
 *   set GITHUB_TOKEN=ghp_xxxxx && npx tsx scripts/uploadBooksToGithub.ts
 */

import * as fs from "node:fs";

const OWNER = "chaitanyaprembhakti";
const REPO = "CPBS-APP-ORIGNAL-PHASE-1";
const TAG = "bookdata";
const TOKEN = process.env.GITHUB_TOKEN || "";

if (!TOKEN) {
	console.error("❌ Set GITHUB_TOKEN env variable before running this script.");
	process.exit(1);
}

// ---- Import books data ----
// We inline/require it since ts-node resolves from project root
const booksDataPath = "./data/books.ts";
// Parse the BOOKS_DATA array from the file using regex (since this is a one-time script)
const booksRaw = fs.readFileSync(booksDataPath, "utf-8");

// Extract JSON-like array from TS file using eval (safe for local script)
const BOOKS_DATA: any[] = [];
try {
	// Strip TS-specific parts, eval the array
	const stripped = booksRaw
		.replace(/import.*\n/g, "")
		.replace(/export const BOOKS_DATA.*?=\s*/, "BOOKS_DATA = ")
		.replace(/:\s*Book\[\]/g, "");
	eval(stripped);
} catch (e) {
	console.error("Failed to parse books data:", e);
	process.exit(1);
}

// ---- Helpers ----
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

// ---- Main ----
async function main() {
	console.log(
		`\n📚 Uploading ${BOOKS_DATA.length} books to GitHub Release: ${TAG}\n`,
	);

	// Get release
	const release = await apiFetch(
		`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
	);
	const uploadUrlBase = release.upload_url;
	const releaseId = release.id;
	console.log(`✅ Found release: ${release.name || TAG} (ID: ${releaseId})`);

	// Get existing assets
	console.log("Fetching existing assets...");
	const existingAssets = await getAllAssets(releaseId);
	console.log(`  Found ${existingAssets.length} existing assets`);

	// Delete existing book JSON files and index
	for (const asset of existingAssets) {
		if (asset.name.endsWith(".json")) {
			console.log(`  🗑️ Deleting: ${asset.name}`);
			await deleteAsset(asset.id);
			await new Promise((r) => setTimeout(r, 300)); // Rate limit
		}
	}

	// Upload each book
	const indexBooks: any[] = [];
	const bundleData: any[] = [];
	for (const book of BOOKS_DATA) {
		const fileName = `${book.id}.json`;
		console.log(
			`\n📖 Uploading: ${fileName} — ${book.title.substring(0, 40)}...`,
		);
		await uploadAsset(uploadUrlBase, fileName, JSON.stringify(book, null, 2));

		const contentHash = hashString(book.title + (book.url || ""));
		indexBooks.push({
			id: book.id,
			title: book.title,
			fileName: book.fileName,
			url: book.url,
			sizeBytes: book.sizeBytes,
			displaySize: book.displaySize,
			isHidden: false,
			contentHash,
		});

		bundleData.push({ ...book, isHidden: false });

		await new Promise((r) => setTimeout(r, 500)); // Rate limit
	}

	// Upload bundle.json
	console.log("\n📦 Uploading bundle.json...");
	await uploadAsset(
		uploadUrlBase,
		"bundle.json",
		JSON.stringify(bundleData, null, 2),
	);

	// Upload index.json
	const indexData = {
		lastUpdated: Date.now(),
		bundleUpdated: Date.now(),
		total: indexBooks.length,
		books: indexBooks,
	};
	console.log("\n📋 Uploading index.json...");
	await uploadAsset(
		uploadUrlBase,
		"index.json",
		JSON.stringify(indexData, null, 2),
	);

	console.log(
		`\n🎉 Done! Uploaded ${BOOKS_DATA.length} books + index.json to release: ${TAG}`,
	);
}

main().catch((err) => {
	console.error("\n❌ Script failed:", err);
	process.exit(1);
});

import fs from "node:fs";
import path from "node:path";

// Load unused assets from first pass
const raw = fs.readFileSync("unused_assets_raw.json", "utf-8");
const unusedAssets = JSON.parse(raw);

// Load all project files in src/
// We can use a simple grep approach in code, or just read all files in src and data bundles and storage.
const readAllFilesSync = (dir: string): string[] => {
	let results: string[] = [];
	if (!fs.existsSync(dir)) return results;
	const list = fs.readdirSync(dir);
	list.forEach((file) => {
		const fullPath = path.resolve(dir, file);
		const stat = fs.statSync(fullPath);
		if (stat?.isDirectory()) {
			results = results.concat(readAllFilesSync(fullPath));
		} else {
			results.push(fullPath);
		}
	});
	return results;
};

const run = () => {
	const srcFiles = readAllFilesSync("src");
	const storageFiles = JSON.parse(
		fs.readFileSync("storage_files.json", "utf-8"),
	);

	// We will dump the contents of all SRC files into a big string for fast searching.
	let ALL_DATA = "";
	for (const f of srcFiles) {
		ALL_DATA += `${fs.readFileSync(f, "utf-8")}\n`;
	}
	// Also include bundle data in case something was in a bundle but we missed it due to string parsing.
	ALL_DATA += `${fs.readFileSync("backup/bundle_backup.json", "utf-8")}\n`;
	ALL_DATA += `${fs.readFileSync("backup/index_backup.json", "utf-8")}\n`;
	ALL_DATA += JSON.stringify(storageFiles);

	const trulyUnused = [];
	const codeDbUsed = [];

	for (const asset of unusedAssets) {
		// Look for the asset name
		const encodedName = encodeURIComponent(asset.assetName);
		const decodedName = decodeURIComponent(asset.assetName);

		if (
			ALL_DATA.includes(asset.assetName) ||
			ALL_DATA.includes(encodedName) ||
			ALL_DATA.includes(decodedName)
		) {
			codeDbUsed.push(asset);
		} else {
			trulyUnused.push(asset);
		}
	}

	console.log(
		`Found ${codeDbUsed.length} assets used in Codebase/Firestore/Storage.`,
	);
	console.log(`Found ${trulyUnused.length} TRULY UNUSED assets.`);

	fs.writeFileSync(
		"truly_unused_assets.json",
		JSON.stringify(trulyUnused, null, 2),
	);
};

run();

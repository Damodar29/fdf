import fs from "node:fs";
import path from "node:path";

const run = async () => {
	console.log("Fetching CPBS-DAILY releases to check Gallery rules...");

	let page = 1;
	let allReleases: any[] = [];
	while (true) {
		const res = await fetch(
			`https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?per_page=100&page=${page}`,
		);
		const data = await res.json();
		if (data.length === 0) break;
		allReleases = allReleases.concat(data);
		page++;
	}

	const rawAssets = JSON.parse(
		fs.readFileSync("unused_assets_raw.json", "utf-8"),
	);
	const dailyAssets = rawAssets.filter(
		(a: any) => a.repo === "chaitanyaprembhakti/CPBS-DAILY",
	);

	const unusedFiles: any[] = [];

	// Audio extensions to exclude
	const audioExts = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".wma"];

	for (const asset of dailyAssets) {
		// Exclude audios
		const ext = path.extname(asset.assetName).toLowerCase();
		if (audioExts.includes(ext)) {
			continue;
		}

		// Find the release for this asset
		const release = allReleases.find((r) => r.id === asset.releaseId);

		let isUsedInGallery = false;
		if (release) {
			const name = release.name || "";
			const body = release.body || "";

			// GalleryUI filter logic:
			const isActivity =
				name.startsWith("Activity Release for ") ||
				body.includes("Auto-generated activity release for");
			const isDarshan =
				(name.startsWith("Release for ") ||
					body.includes("Auto-generated release for")) &&
				!isActivity;

			if (isActivity || isDarshan) {
				isUsedInGallery = true;
			}
		}

		if (!isUsedInGallery) {
			unusedFiles.push(asset);
		}
	}

	console.log(
		`Found ${unusedFiles.length} unused non-audio files in CPBS-DAILY.`,
	);

	let md = `# Unused Non-Audio Files in CPBS-DAILY\n\n`;
	md += `> [!WARNING]\n> Found **${unusedFiles.length}** unused files.\n\n`;

	const grouped: any = {};
	for (const asset of unusedFiles) {
		if (!grouped[asset.releaseName]) grouped[asset.releaseName] = [];
		grouped[asset.releaseName].push(asset);
	}

	for (const release in grouped) {
		md += `## Release: ${release}\n\n`;
		md += `| File Name | Size (MB) | Link |\n`;
		md += `|-----------|-----------|------|\n`;
		for (const a of grouped[release]) {
			md += `| \`${a.assetName}\` | ${(a.size / (1024 * 1024)).toFixed(2)} MB | [Download](${a.assetUrl}) |\n`;
		}
		md += `\n`;
	}

	fs.writeFileSync("unused_assets_CPBS_DAILY_Final.md", md);
	console.log("Saved to unused_assets_CPBS_DAILY_Final.md");
};

run().catch(console.error);

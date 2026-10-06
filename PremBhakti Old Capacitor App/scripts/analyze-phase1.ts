import fs from "node:fs";
import path from "node:path";

const run = () => {
	// If truly_unused_assets.json doesn't exist, this will throw, but it's okay for restoration.
	try {
		const rawAssets = JSON.parse(
			fs.readFileSync("truly_unused_assets.json", "utf-8"),
		);

		const phase1Assets = rawAssets.filter(
			(a: any) => a.repo === "chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1",
		);

		const unusedFiles: any[] = [];
		const audioExts = [
			".mp3",
			".wav",
			".m4a",
			".aac",
			".ogg",
			".flac",
			".wma",
			".m4b",
		];

		for (const asset of phase1Assets) {
			const ext = path.extname(asset.assetName).toLowerCase();
			if (audioExts.includes(ext)) continue;
			if (asset.tagName === "1" || asset.releaseName === "dailyquotes")
				continue;

			unusedFiles.push(asset);
		}

		console.log(
			`Found ${unusedFiles.length} truly unused NON-AUDIO files in CPBS-APP-ORIGNAL-PHASE-1.`,
		);
		let md = `# Unused Non-Audio Files in CPBS-APP-ORIGNAL-PHASE-1\n\n`;
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

		fs.writeFileSync("unused_assets_PHASE1_Final.md", md);
		console.log("Saved to unused_assets_PHASE1_Final.md");
	} catch (_e) {
		console.log("Could not find truly_unused_assets.json to run this script.");
	}
};

run();

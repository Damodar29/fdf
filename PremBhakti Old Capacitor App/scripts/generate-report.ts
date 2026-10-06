import fs from "node:fs";

const raw = fs.readFileSync("truly_unused_assets.json", "utf-8");
const unusedAssets = JSON.parse(raw);

// Group by repository and release
const grouped: any = {};
let totalUnusedSize = 0;

for (const asset of unusedAssets) {
	if (!grouped[asset.repo]) {
		grouped[asset.repo] = {};
	}
	if (!grouped[asset.repo][asset.releaseName]) {
		grouped[asset.repo][asset.releaseName] = [];
	}
	grouped[asset.repo][asset.releaseName].push(asset);
	totalUnusedSize += asset.size;
}

let md = `# Unused GitHub Assets Report\n\n`;
md += `> [!WARNING]\n> Found **${unusedAssets.length}** completely unused files across your GitHub releases.\n`;
md += `> Total storage wasted: **${(totalUnusedSize / (1024 * 1024)).toFixed(2)} MB**\n\n`;

for (const repo in grouped) {
	md += `## Repository: ${repo}\n\n`;
	for (const release in grouped[repo]) {
		const assets = grouped[repo][release];
		const releaseSize = assets.reduce(
			(acc: number, val: any) => acc + val.size,
			0,
		);

		md += `### Release: ${release} (${assets.length} unused files)\n`;
		md += `Total Size: ${(releaseSize / (1024 * 1024)).toFixed(2)} MB\n\n`;
		md += `| File Name | Size (MB) |\n`;
		md += `|-----------|-----------|\n`;

		for (const asset of assets) {
			md += `| \`${asset.assetName}\` | ${(asset.size / (1024 * 1024)).toFixed(2)} |\n`;
		}
		md += `\n`;
	}
}

fs.writeFileSync("unused_assets_report.md", md);
console.log("Report generated at unused_assets_report.md");

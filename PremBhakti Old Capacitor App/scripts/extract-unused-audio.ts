import fs from "node:fs";

const raw = fs.readFileSync("truly_unused_assets.json", "utf-8");
const unusedAssets = JSON.parse(raw);

const targetRepo = "chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1";

// Filter for only the requested repo and only audio files
const audioExts = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".wma"];

const phase1Audios = unusedAssets.filter((a: any) => {
	if (a.repo !== targetRepo) return false;
	const lowerName = a.assetName.toLowerCase();
	return audioExts.some((ext) => lowerName.endsWith(ext));
});

let md = `# Unused Audio Files in CPBS-APP-ORIGNAL-PHASE-1\n\n`;
md += `> [!WARNING]\n> Found **${phase1Audios.length}** unused audio files.\n\n`;

for (const asset of phase1Audios) {
	md += `- **${asset.assetName}** (${(asset.size / (1024 * 1024)).toFixed(2)} MB)\n`;
	md += `  [Download Link](${asset.assetUrl})\n\n`;
}

fs.writeFileSync("unused_audio_phase1.md", md);
console.log("Saved to unused_audio_phase1.md");

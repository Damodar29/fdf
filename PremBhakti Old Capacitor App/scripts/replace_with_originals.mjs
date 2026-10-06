import path from "node:path";
import sharp from "sharp";

const artifactsDir =
	"C:\\\\Users\\\\damod\\\\.gemini\\\\antigravity-ide\\\\brain\\\\ee7a2319-f926-4e31-ac26-06dcfb3d5bc7";
const publicDir = "./public";

async function processOriginals() {
	console.log("Processing IG...");
	await sharp(path.join(artifactsDir, "media__1781565018542.png"))
		.webp({ quality: 90 })
		.toFile(path.join(publicDir, "ig_profile.webp"));
	console.log("IG processed.");

	console.log("Processing FB...");
	await sharp(path.join(artifactsDir, "media__1781565029600.png"))
		.webp({ quality: 90 })
		.toFile(path.join(publicDir, "fb_profile.webp"));
	console.log("FB processed.");
}

processOriginals().catch(console.error);

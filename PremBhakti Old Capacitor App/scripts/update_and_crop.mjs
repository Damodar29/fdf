import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const artifactsDir =
	"C:\\Users\\damod\\.gemini\\antigravity-ide\\brain\\ee7a2319-f926-4e31-ac26-06dcfb3d5bc7";
const publicDir = "./public";

const newReplacements = [
	{ src: "fb_light_1781561828264.png", dest: "fblogo.webp" },
	{ src: "fb_dark_1781561840389.png", dest: "fblogo.dark.webp" },
	{ src: "how_to_use_light_1781561852497.png", dest: "touse.webp" },
	{ src: "how_to_use_dark_1781561865048.png", dest: "touse.dark.webp" },
	{ src: "activities_dark_1781561883149.png", dest: "activityic.dark.webp" },
	{ src: "instagram_light_1781561894383.png", dest: "instlogo.webp" },
	{ src: "instagram_dark_1781561905544.png", dest: "instlogo.dark.webp" },
];

const excludeAggressiveCrop = ["gallryic.webp", "activityic.webp"];

async function processNewIcons() {
	for (const item of newReplacements) {
		const srcPath = path.join(artifactsDir, item.src);
		const destPath = path.join(publicDir, item.dest);

		if (fs.existsSync(srcPath)) {
			console.log(`Processing new icon ${item.src} -> ${item.dest}`);

			const imgBuffer = fs.readFileSync(srcPath);
			const metadata = await sharp(imgBuffer).metadata();
			// Even though we asked for no frame, AI might add a slight border. We crop 8% just to be safe.
			const marginX = Math.floor((metadata.width || 1024) * 0.08);
			const marginY = Math.floor((metadata.height || 1024) * 0.08);

			const outBuffer = await sharp(imgBuffer)
				.extract({
					left: marginX,
					top: marginY,
					width: (metadata.width || 1024) - marginX * 2,
					height: (metadata.height || 1024) - marginY * 2,
				})
				.resize(256, 256)
				.webp({ quality: 70 })
				.toBuffer();

			fs.writeFileSync(destPath, outBuffer);
			console.log(`Saved ${item.dest}`);
		} else {
			console.warn(`Missing artifact: ${srcPath}`);
		}
	}
}

async function removeFramesFromExisting() {
	const allFiles = fs
		.readdirSync(publicDir)
		.filter(
			(f) =>
				(f.endsWith(".webp") && f.includes("icon")) ||
				f.includes("logo") ||
				f.includes("profile") ||
				f.includes("temple") ||
				f.includes("donate") ||
				f.includes("information") ||
				f.includes("downloads") ||
				f.includes("share") ||
				f.includes("feedback") ||
				f.includes("videos") ||
				f.includes("activityic") ||
				f.includes("our.centers") ||
				f.includes("touse") ||
				f.includes("vaishnav.calender") ||
				f.includes("music") ||
				f.includes("Audio") ||
				f.includes("Books") ||
				f.includes("Library") ||
				f.includes("aboutUs") ||
				f.includes("daily.information"),
		);

	const newDests = newReplacements.map((r) => r.dest);

	for (const file of allFiles) {
		if (newDests.includes(file)) continue; // Handled above
		if (excludeAggressiveCrop.includes(file)) continue; // Photos, no frames

		const srcPath = path.join(publicDir, file);
		try {
			const imgBuffer = fs.readFileSync(srcPath);
			const metadata = await sharp(imgBuffer).metadata();

			console.log(`Removing inner frame from existing icon ${file}...`);

			// Aggressively crop 17% from edges to remove the painted golden frames
			const marginX = Math.floor((metadata.width || 256) * 0.17);
			const marginY = Math.floor((metadata.height || 256) * 0.17);

			const outBuffer = await sharp(imgBuffer)
				.extract({
					left: marginX,
					top: marginY,
					width: (metadata.width || 256) - marginX * 2,
					height: (metadata.height || 256) - marginY * 2,
				})
				.resize(256, 256)
				.webp({ quality: 70 })
				.toBuffer();

			fs.writeFileSync(srcPath, outBuffer);
		} catch (e) {
			console.error(`Error processing ${file}:`, e.message);
		}
	}
}

async function main() {
	await processNewIcons();
	await removeFramesFromExisting();
	console.log("All done!");
}

main().catch(console.error);

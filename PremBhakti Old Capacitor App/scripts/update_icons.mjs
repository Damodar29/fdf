import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const artifactsDir =
	"C:\\Users\\damod\\.gemini\\antigravity-ide\\brain\\ee7a2319-f926-4e31-ac26-06dcfb3d5bc7";
const publicDir = "./public";

const newIcons = [
	{
		src: "bhajan_icon_1781560599431.png",
		dest: "Bhajan.webp",
		darkDest: "Bhajan.dark.webp",
	},
	{
		src: "audios_icon_1781560611284.png",
		dest: "Audio.webp",
		darkDest: "Audio.dark.webp",
	},
	{
		src: "books_icon_1781560622686.png",
		dest: "Books.webp",
		darkDest: "Books.dark.webp",
	},
	{
		src: "library_icon_1781560634399.png",
		dest: "Library.webp",
		darkDest: "Library.dark.webp",
	},
];

async function processNewIcons() {
	for (const icon of newIcons) {
		const srcPath = path.join(artifactsDir, icon.src);
		const destPath = path.join(publicDir, icon.dest);
		const darkDestPath = path.join(publicDir, icon.darkDest);

		if (fs.existsSync(srcPath)) {
			console.log(`Processing ${icon.src}...`);

			const metadata = await sharp(srcPath).metadata();
			const margin = Math.floor((metadata.width || 1024) * 0.05);

			const buffer = await sharp(srcPath)
				.extract({
					left: margin,
					top: margin,
					width: (metadata.width || 1024) - margin * 2,
					height: (metadata.height || 1024) - margin * 2,
				})
				.resize(256, 256)
				.webp({ quality: 60 })
				.toBuffer();

			fs.writeFileSync(destPath, buffer);
			fs.writeFileSync(darkDestPath, buffer);
			console.log(`Saved to ${destPath} and ${darkDestPath}`);
		}
	}
}

async function processExistingIcons() {
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
				f.includes("vaishnav.calender"),
		);

	for (const file of allFiles) {
		if (newIcons.some((i) => i.dest === file || i.darkDest === file)) continue;

		const srcPath = path.join(publicDir, file);
		try {
			const imgBuffer = fs.readFileSync(srcPath);
			const metadata = await sharp(imgBuffer).metadata();
			if ((metadata.width || 0) < 300 && imgBuffer.length < 30000) {
				continue;
			}

			console.log(`Optimizing existing icon ${file}...`);

			const marginX = Math.floor((metadata.width || 512) * 0.04);
			const marginY = Math.floor((metadata.height || 512) * 0.04);

			const outBuffer = await sharp(imgBuffer)
				.extract({
					left: marginX,
					top: marginY,
					width: (metadata.width || 512) - marginX * 2,
					height: (metadata.height || 512) - marginY * 2,
				})
				.resize(256, 256)
				.webp({ quality: 65 })
				.toBuffer();

			fs.writeFileSync(srcPath, outBuffer);
		} catch (e) {
			console.error(`Error processing ${file}:`, e.message);
		}
	}
}

async function main() {
	await processNewIcons();
	await processExistingIcons();
	console.log("All done!");
}

main();

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const artifactsDir =
	"C:\\Users\\damod\\.gemini\\antigravity-ide\\brain\\ee7a2319-f926-4e31-ac26-06dcfb3d5bc7";
const publicDir = "./public";

const replacements = [
	{ src: "bhajan_icon_dark_1781561100165.png", dest: "Bhajan.dark.webp" },
	{ src: "audios_icon_dark_1781561112915.png", dest: "Audio.dark.webp" },
	{ src: "books_icon_dark_1781561123806.png", dest: "Books.dark.webp" },
	{ src: "library_icon_dark_1781561135742.png", dest: "Library.dark.webp" },
	{ src: "videos_icon_light_1781561146999.png", dest: "videos.webp" },
];

async function main() {
	for (const item of replacements) {
		const srcPath = path.join(artifactsDir, item.src);
		const destPath = path.join(publicDir, item.dest);

		if (fs.existsSync(srcPath)) {
			console.log(`Processing ${item.src} -> ${item.dest}`);

			const imgBuffer = fs.readFileSync(srcPath);
			const metadata = await sharp(imgBuffer).metadata();
			const marginX = Math.floor((metadata.width || 1024) * 0.05);
			const marginY = Math.floor((metadata.height || 1024) * 0.05);

			const outBuffer = await sharp(imgBuffer)
				.extract({
					left: marginX,
					top: marginY,
					width: (metadata.width || 1024) - marginX * 2,
					height: (metadata.height || 1024) - marginY * 2,
				})
				.resize(256, 256)
				.webp({ quality: 65 })
				.toBuffer();

			fs.writeFileSync(destPath, outBuffer);
			console.log(`Saved ${item.dest}`);
		} else {
			console.warn(`Missing artifact: ${srcPath}`);
		}
	}
}

main().catch(console.error);

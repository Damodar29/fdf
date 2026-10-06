const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const publicDir = path.join(__dirname, "../public");

async function processImages() {
	const files = fs.readdirSync(publicDir);

	for (const file of files) {
		if (file === "icon.png" || file.startsWith("temp_")) continue;

		const ext = path.extname(file).toLowerCase();
		if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
			const filePath = path.join(publicDir, file);
			const isAlreadyWebp = ext === ".webp";
			const outputName = file.replace(new RegExp(`\\${ext}$`, "i"), ".webp");
			const outputPath = path.join(
				publicDir,
				isAlreadyWebp ? `temp_${file}` : outputName,
			);

			try {
				console.log(`Processing ${file}...`);

				// Read file into buffer to avoid Windows file locks by sharp
				const buffer = fs.readFileSync(filePath);
				const metadata = await sharp(buffer).metadata();

				let s = sharp(buffer);
				if (metadata.width > 1200) {
					s = s.resize({ width: 1200, withoutEnlargement: true });
				}

				await s.webp({ quality: 65, effort: 6 }).toFile(outputPath);

				if (isAlreadyWebp) {
					// Delete old file and rename temp file to original name
					fs.unlinkSync(filePath);
					fs.renameSync(outputPath, filePath);
					console.log(`Compressed and replaced ${file}`);
				} else {
					// It was jpg/png, we created webp. Delete original.
					fs.unlinkSync(filePath);
					console.log(`Converted and deleted ${file}`);
				}
			} catch (err) {
				console.error(`Error processing ${file}:`, err);
			}
		}
	}

	// Clean up any remaining temp files
	const remainingFiles = fs.readdirSync(publicDir);
	for (const file of remainingFiles) {
		if (file.startsWith("temp_")) {
			try {
				fs.unlinkSync(path.join(publicDir, file));
			} catch (_e) {}
		}
	}

	console.log("Done!");
}

processImages();

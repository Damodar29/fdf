// ──────────────────────────────────────────────────────────────────────
// Icon Processing Script — reads settings from scripts/icon-config.json
// Usage: npm run generate-icons
// To change crop area visually: npm run setup-icon
// ──────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// ── Read config ──
const configPath = path.resolve("./scripts/icon-config.json");
if (!fs.existsSync(configPath)) {
	console.error(
		'❌ scripts/icon-config.json not found! Run "npm run setup-icon" first.',
	);
	process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const inputPath = config.inputPath;
const crop = config.crop; // { left, top, width, height }

const publicIcon = "./public/icon.webp";
const assetsIcon = "./assets/icon.webp";
const iconBase64Ts = "./src/iconBase64.ts";
const pwaSizes = [48, 72, 96, 128, 192, 256, 512];
const notificationIconPath = "./public/notification-icon.webp";

async function main() {
	if (!fs.existsSync(inputPath)) {
		console.error(`❌ Source icon not found at: ${inputPath}`);
		console.error(
			'   Update "inputPath" in scripts/icon-config.json or run "npm run setup-icon".',
		);
		process.exit(1);
	}

	console.log(`📦 Source: ${inputPath}`);
	console.log(
		`✂️  Crop: left=${crop.left}, top=${crop.top}, width=${crop.width}, height=${crop.height}`,
	);

	// 1. Copy original icon to public and assets
	console.log("\n1️⃣  Copying original icons...");
	fs.copyFileSync(inputPath, publicIcon);
	if (!fs.existsSync("./assets")) fs.mkdirSync("./assets", { recursive: true });
	fs.copyFileSync(inputPath, assetsIcon);

	// 2. Generate src/iconBase64.ts (WEBP, with Blurred Background Padding)
	console.log(
		"2️⃣  Generating src/iconBase64.ts (Blurred Background Padding)...",
	);

	// Create a wide blurred background
	const bgBuffer = await sharp(inputPath)
		.resize(1280, 512, { fit: "cover" })
		.blur(25)
		.modulate({ brightness: 0.4 }) // Darkened so media controls are visible
		.toBuffer();

	// Resize foreground to fit height exactly
	const fgBuffer = await sharp(inputPath)
		.resize(512, 512, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.toBuffer();

	// Composite foreground on top of the blurred background
	const finalBuffer = await sharp(bgBuffer)
		.composite([{ input: fgBuffer, gravity: "center" }])
		.webp({ quality: 90 })
		.toBuffer();

	const base64 = finalBuffer.toString("base64");
	const dataUrl = `data:image/webp;base64,${base64}`;
	const tsContent = `// Auto-generated: Padded icon with blurred background for Android media notification artwork.
// Ensures the entire square icon is visible and media controls don't overlap faces.
export const defaultIconBase64 = "${dataUrl}";
`;
	fs.writeFileSync(iconBase64Ts, tsContent, "utf8");
	console.log(`   ✅ Saved (${(base64.length / 1024).toFixed(2)} KB)`);

	// 3. Generate PWA icons
	console.log("3️⃣  Generating PWA .webp icons...");
	if (!fs.existsSync("./public/icons"))
		fs.mkdirSync("./public/icons", { recursive: true });
	for (const size of pwaSizes) {
		const outPath = `./public/icons/icon-${size}.webp`;
		await sharp(inputPath)
			.resize(size, size, {
				fit: "contain",
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.webp({ quality: 90 })
			.toFile(outPath);
		console.log(`   ✅ ${outPath}`);
	}

	// 4. Generate notification-icon.webp (96x96 grayscale for Android push notifications)
	console.log("4️⃣  Generating notification icon...");
	await sharp(inputPath)
		.resize(96, 96, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.grayscale()
		.png({ quality: 90, compressionLevel: 9 })
		.toFile(notificationIconPath);
	console.log(`   ✅ ${notificationIconPath}`);

	console.log("\n🎉 All image processing complete!");
}

main().catch(console.error);

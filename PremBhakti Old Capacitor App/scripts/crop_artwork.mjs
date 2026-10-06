import fs from "node:fs";
import sharp from "sharp";

const inputPath = "./icons/icon-512.webp";
const outputPath = "./icons/icon-artwork.png";

// Original image: 512x512
// Mahaprabhuji's face is in the upper-center portion (approx y: 20-200 out of 512)
// We'll crop to: full width (512), but only top 260px (face + halo area)
// Then resize to 512x512 square so it fills the notification nicely

const cropHeight = 280; // top 280px captures face + halo perfectly
const cropTop = 0; // start from the very top

async function main() {
	// Step 1: Crop to upper portion (face area)
	const croppedBuffer = await sharp(inputPath)
		.extract({ left: 0, top: cropTop, width: 512, height: cropHeight })
		// Resize back to 512x512 so the face fills the square
		.resize(512, 512, { fit: "fill" })
		.png()
		.toBuffer();

	// Save cropped preview
	fs.writeFileSync(outputPath, croppedBuffer);
	console.log(`✅ Cropped image saved to ${outputPath}`);

	// Step 2: Convert to base64 data URL
	const base64 = croppedBuffer.toString("base64");
	const dataUrl = `data:image/png;base64,${base64}`;

	// Step 3: Write to iconBase64.ts
	const tsContent = `// Auto-generated: Cropped icon for Android media notification artwork.
// Shows Mahaprabhuji's face (upper portion of icon-512.webp).
// Do not edit manually — regenerate using crop_artwork.mjs
export const defaultIconBase64 = "${dataUrl}";
`;

	fs.writeFileSync("./src/iconBase64.ts", tsContent, "utf8");
	console.log(`✅ iconBase64.ts updated with face-cropped artwork!`);
	console.log(`   Data URL length: ${dataUrl.length} chars`);
}

main().catch(console.error);

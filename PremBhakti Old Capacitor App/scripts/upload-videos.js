import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const accessKeyId = process.env.IA_ACCESS_KEY;
const secretAccessKey = process.env.IA_SECRET_KEY;

if (!accessKeyId || !secretAccessKey) {
	console.error("Missing Internet Archive credentials in .env file.");
	process.exit(1);
}

const BUCKET_NAME = `online-katha-parts-1-to-3-${Date.now()}`;
const filesToUpload = [
	"C:\\Users\\damod\\Downloads\\Part 1.mp4",
	"C:\\Users\\damod\\Downloads\\Part 2.mp4",
	"C:\\Users\\damod\\Downloads\\Part 3.mp4",
];

async function uploadFileWithProgress(filePath, fileName) {
	return new Promise((resolve, reject) => {
		const stats = fs.statSync(filePath);
		const totalBytes = stats.size;
		const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

		console.log(`\n⬆️ Uploading ${fileName} (${totalMB} MB)...`);

		const options = {
			hostname: "s3.us.archive.org",
			port: 443,
			path: `/${BUCKET_NAME}/${encodeURIComponent(fileName)}`,
			method: "PUT",
			headers: {
				Authorization: `LOW ${accessKeyId}:${secretAccessKey}`,
				"Content-Type": "video/mp4",
				"Content-Length": totalBytes,
				"x-archive-auto-make-bucket": "1", // This creates the item if it doesn't exist yet
			},
		};

		const req = https.request(options, (res) => {
			let responseBody = "";
			res.on("data", (chunk) => {
				responseBody += chunk.toString();
			});

			res.on("end", () => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					console.log(`\n✅ Successfully uploaded ${fileName}!`);
					resolve();
				} else {
					console.error(
						`\n❌ Failed to upload ${fileName}: HTTP ${res.statusCode} ${res.statusMessage}`,
					);
					console.error(`Details: ${responseBody}`);
					reject(new Error(`HTTP ${res.statusCode}`));
				}
			});
		});

		req.on("error", (e) => {
			console.error(`\n❌ Network error while uploading ${fileName}:`, e);
			reject(e);
		});

		const fileStream = fs.createReadStream(filePath);
		let uploadedBytes = 0;

		fileStream.on("data", (chunk) => {
			uploadedBytes += chunk.length;
			const uploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(2);
			const percent = ((uploadedBytes / totalBytes) * 100).toFixed(1);

			// Update progress on the same line in the terminal
			process.stdout.write(
				`\rProgress: ${uploadedMB} MB / ${totalMB} MB (${percent}%)`,
			);
		});

		// Pipe the file stream directly to the HTTP request
		fileStream.pipe(req);
	});
}

async function uploadFiles() {
	console.log(`Starting upload to Internet Archive item: ${BUCKET_NAME}`);

	for (const filePath of filesToUpload) {
		if (!fs.existsSync(filePath)) {
			console.error(`❌ File not found: ${filePath}`);
			continue;
		}

		const fileName = path.basename(filePath);

		try {
			await uploadFileWithProgress(filePath, fileName);
		} catch (_error) {
			console.error(`Error with ${fileName}, skipping to next...`);
		}
	}

	console.log("\n🎉 All uploads finished.");
}

uploadFiles();

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
	collection,
	doc,
	getDocs,
	getFirestore,
	updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
	apiKey: "AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY",
	authDomain: "cpbs-admin.firebaseapp.com",
	projectId: "cpbs-admin",
	storageBucket: "cpbs-admin.firebasestorage.app",
	messagingSenderId: "33454825743",
	appId: "1:33454825743:web:aa6a872cf5058b284b9e7a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Backblaze B2 Config
const B2_KEY_ID = "005281b623ef32b0000000001";
const B2_APP_KEY = "K005KG0gTQVPFRf9csLYfks+e/X26XI";
const B2_BUCKET = "cpbs-videos";
const B2_REGION = "us-east-005";
const B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";

const s3 = new S3Client({
	endpoint: B2_ENDPOINT,
	region: B2_REGION,
	credentials: {
		accessKeyId: B2_KEY_ID,
		secretAccessKey: B2_APP_KEY,
	},
});

async function downloadFile(url, dest, prefix) {
	const headRes = await fetch(url, { method: "HEAD" });
	let totalBytes = parseInt(headRes.headers.get("content-length") || "0", 10);

	if (
		totalBytes === 0 ||
		!headRes.ok ||
		headRes.headers.get("accept-ranges") !== "bytes"
	) {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
		totalBytes = parseInt(res.headers.get("content-length") || "0", 10);
		let downloadedBytes = 0;
		const fileStream = fs.createWriteStream(dest);
		for await (const chunk of res.body) {
			downloadedBytes += chunk.length;
			fileStream.write(chunk);
			if (prefix) {
				if (totalBytes > 0) {
					process.stdout.write(
						`\r${prefix} | ⏳ Downloading HD... ${((downloadedBytes / totalBytes) * 100).toFixed(1)}%`.padEnd(
							85,
						),
					);
				} else {
					process.stdout.write(
						`\r${prefix} | ⏳ Downloading HD... ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB`.padEnd(
							85,
						),
					);
				}
			}
		}
		fileStream.end();
		return;
	}

	const numThreads = 16;
	const chunkSize = Math.ceil(totalBytes / numThreads);
	let downloadedBytes = 0;

	const fd = fs.openSync(dest, "w");
	fs.ftruncateSync(fd, totalBytes);
	fs.closeSync(fd);

	const ranges = [];
	for (let i = 0; i < numThreads; i++) {
		const start = i * chunkSize;
		const end = i === numThreads - 1 ? totalBytes - 1 : start + chunkSize - 1;
		ranges.push({ start, end });
	}

	async function downloadRange(start, end) {
		const res = await fetch(url, {
			headers: { Range: `bytes=${start}-${end}` },
		});
		if (!res.ok) throw new Error(`Failed to fetch range: ${res.status}`);

		const fdWrite = fs.openSync(dest, "r+");
		let currentPos = start;
		for await (const chunk of res.body) {
			fs.writeSync(fdWrite, chunk, 0, chunk.length, currentPos);
			currentPos += chunk.length;
			downloadedBytes += chunk.length;
			if (prefix) {
				const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
				const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
				const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
				process.stdout.write(
					`\r${prefix} | ⚡ Fast Downloading... ${percent}% (${mb}MB / ${totalMb}MB)`.padEnd(
						85,
					),
				);
			}
		}
		fs.closeSync(fdWrite);
	}

	await Promise.all(ranges.map((r) => downloadRange(r.start, r.end)));

	if (downloadedBytes !== totalBytes) {
		throw new Error(`Incomplete download`);
	}
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function run() {
	console.log(
		"=== Archive.org to Backblaze B2 Migration (FAST JS VERSION) ===",
	);

	const tempDir = path.join(process.cwd(), "temp_videos");
	if (fs.existsSync(tempDir)) {
		console.log("🧹 Cleaning up old temporary files from previous run...");
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
	fs.mkdirSync(tempDir);

	console.log("Authenticating with Firebase...");
	const email = "damodar@cpbs.com";
	const password = "413541";
	const customDomain = "videos.chaitanyaprembhakti.org";

	try {
		await signInWithEmailAndPassword(auth, email, password);
		console.log("✅ Logged into Firebase successfully.");
	} catch (e) {
		console.error("❌ Firebase login failed:", e.message);
		process.exit(1);
	}

	console.log("\nFetching folders from Firestore...");
	const folderSnapshot = await getDocs(collection(db, "video_folders"));
	const folderMap = {};
	folderSnapshot.forEach((doc) => {
		folderMap[doc.id] = doc.data().name;
	});

	console.log("\nFetching videos from Firestore...");
	const querySnapshot = await getDocs(collection(db, "videos"));
	const videos = [];
	querySnapshot.forEach((doc) => {
		videos.push({ id: doc.id, ...doc.data() });
	});

	const pendingDbUpdates = [];

	async function getArchiveDownloadInfo(video) {
		let itemId = null;
		let baseName = null;

		if (video.thumbnailUrl?.includes("archive.org")) {
			const match = video.thumbnailUrl.match(/\/(?:items|download)\/([^/]+)/);
			if (match) itemId = match[1];
		}
		if (video.url?.includes("archive.org")) {
			const match = video.url.match(/\/(?:items|download)\/([^/]+)/);
			if (match) itemId = match[1];
		}

		if (video.url) {
			baseName = decodeURIComponent(
				video.url.split("/").pop().split("?")[0],
			).replace(/\.[^/.]+$/, "");
		}
		if (!baseName) baseName = video.title.trim();
		if (!itemId) itemId = "unorganized_videos";

		let data = null;
		if (itemId !== "unorganized_videos") {
			for (let i = 0; i < 3; i++) {
				try {
					const res = await fetch(`https://archive.org/metadata/${itemId}`);
					if (res.ok) {
						data = await res.json();
						break;
					}
				} catch (_e) {
					await delay(2000);
				}
			}
		}

		if (data?.files) {
			const normalizedBase = baseName.replace(/[-_ ]/g, "").toLowerCase();
			let candidateFiles = data.files.filter((f) => {
				const fName = decodeURIComponent(f.name)
					.replace(/\.[^/.]+$/, "")
					.replace(/[-_ ]/g, "")
					.toLowerCase();
				const isVideo = f.name.match(/\.(mp4|m4v|mov|mkv|avi)$/i);
				return (
					isVideo &&
					(fName.includes(normalizedBase) ||
						normalizedBase.includes(fName) ||
						fName === normalizedBase)
				);
			});

			if (candidateFiles.length === 0) {
				candidateFiles = data.files.filter((f) =>
					f.name.match(/\.(mp4|m4v|mov)$/i),
				);
			}

			if (candidateFiles.length > 0) {
				candidateFiles.sort((a, b) => {
					if (a.source === "original" && b.source !== "original") return -1;
					if (b.source === "original" && a.source !== "original") return 1;
					return parseInt(b.size || "0", 10) - parseInt(a.size || "0", 10);
				});
				const bestFile = candidateFiles[0];
				return {
					itemId: itemId,
					archiveTitle: data?.metadata?.title || null,
					downloadUrl: `https://archive.org/download/${itemId}/${bestFile.name}`,
					originalFileName: bestFile.name,
				};
			}
		}

		return {
			itemId: itemId,
			archiveTitle: data?.metadata?.title || null,
			downloadUrl: video.url,
			originalFileName: video.url.split("/").pop().split("?")[0],
		};
	}

	console.log(
		`\nFound ${videos.length} total videos. Grouping them into folders... \n`,
	);

	console.log("Fetching existing files from B2 to prevent duplicates...");
	const uploadedKeys = new Set();
	let continuationToken;
	do {
		const res = await s3.send(
			new ListObjectsV2Command({
				Bucket: B2_BUCKET,
				ContinuationToken: continuationToken,
			}),
		);
		for (const obj of res.Contents || []) {
			uploadedKeys.add(obj.Key);
		}
		continuationToken = res.NextContinuationToken;
	} while (continuationToken);
	console.log(`Found ${uploadedKeys.size} files in B2.\n`);

	for (let i = 0; i < videos.length; i++) {
		const video = videos[i];
		const prefix = `[${i + 1}/${videos.length}] ${video.title.substring(0, 30)}...`;

		const info = await getArchiveDownloadInfo(video);
		if (!info?.downloadUrl?.startsWith("http")) {
			console.log(`\r${prefix} | ⚠️ Skipping, invalid source.`);
			continue;
		}

		let decodedFileName = decodeURIComponent(info.originalFileName);
		if (!decodedFileName.match(/\.(mp4|m4v|mov)$/i)) decodedFileName += ".mp4";

		const safeFileName = decodedFileName
			.replace(/\s+/g, "-")
			.replace(/[/\\?%*:|"<>]/g, "-");

		let rawFolderName = info.archiveTitle;
		if (!rawFolderName) {
			rawFolderName =
				folderMap[video.folderId] || video.title || "Uncategorized";
		}

		const safeFolderName = rawFolderName.replace(/[/\\?%*:|"<>]/g, "-").trim();
		const s3Key = `${safeFolderName}/${safeFileName}`;

		const localPath = path.join(tempDir, safeFileName);

		const expectedNewUrl =
			customDomain.trim() !== ""
				? `https://${customDomain.trim()}/file/${B2_BUCKET}/${s3Key}`
				: `https://f005.backblazeb2.com/file/${B2_BUCKET}/${s3Key}`;

		if (video.url === expectedNewUrl) {
			console.log(
				`\r${prefix} | ✅ Already migrated to folder: ${safeFolderName}`,
			);
			continue;
		}

		// Robust check: Ignore folder name differences (caused by Archive API flakiness)
		const alreadyUploadedKey = Array.from(uploadedKeys).find(
			(k) => k.endsWith(`/${safeFileName}`) || k === safeFileName,
		);
		if (alreadyUploadedKey) {
			const actualUrl =
				customDomain.trim() !== ""
					? `https://${customDomain.trim()}/file/${B2_BUCKET}/${alreadyUploadedKey}`
					: `https://f005.backblazeb2.com/file/${B2_BUCKET}/${alreadyUploadedKey}`;
			console.log(
				`\r${prefix} | ⏩ Already found in B2. (Queuing for DB Update)`,
			);
			pendingDbUpdates.push({
				videoRef: doc(db, "videos", video.id),
				expectedNewUrl: actualUrl,
			});
			continue;
		}

		console.log(`\n🚀 Processing video: ${video.title}`);

		// --- DOWNLOAD RETRY LOOP ---
		let attempts = 0;
		let downloadSuccess = false;
		while (attempts < 3 && !downloadSuccess) {
			attempts++;
			try {
				if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
				process.stdout.write(
					`\r${prefix} | ⏳ Downloading HD... (Attempt ${attempts})`.padEnd(80),
				);

				await downloadFile(info.downloadUrl, localPath, prefix);
				const stats = fs.statSync(localPath);
				if (stats.size === 0) throw new Error("Downloaded file is 0 bytes");
				downloadSuccess = true;
			} catch (error) {
				process.stdout.write(
					`\r${prefix} | ❌ Download Error: ${error.message}\n`,
				);
				if (attempts < 3) await delay(5000);
			}
		}

		if (!downloadSuccess) continue;

		const stats = fs.statSync(localPath);
		const sizeMb = (stats.size / 1024 / 1024).toFixed(1);

		// --- UPLOAD RETRY LOOP ---
		attempts = 0;
		let uploadSuccess = false;
		while (attempts < 3 && !uploadSuccess) {
			attempts++;
			try {
				process.stdout.write(
					`\r${prefix} | ⏳ Uploading to B2 (${sizeMb}MB)... (Attempt ${attempts})`.padEnd(
						80,
					),
				);

				const fileContentStream = fs.createReadStream(localPath);
				const uploadParams = {
					Bucket: B2_BUCKET,
					Key: s3Key,
					Body: fileContentStream,
					ContentLength: stats.size,
					ContentType: safeFileName.toLowerCase().endsWith(".m4v")
						? "video/x-m4v"
						: "video/mp4",
				};

				const parallelUploads3 = new Upload({
					client: s3,
					params: uploadParams,
					queueSize: 4,
					partSize: 1024 * 1024 * 10, // 10MB chunks
					leavePartsOnError: false,
				});

				await parallelUploads3.done();
				uploadSuccess = true;
			} catch (error) {
				process.stdout.write(
					`\r${prefix} | ❌ Upload Error: ${error.message}\n`,
				);
				if (attempts < 3) await delay(5000);
			}
		}

		if (uploadSuccess) {
			process.stdout.write(
				`\r${prefix} | ⏳ Queuing Database Update...`.padEnd(80),
			);
			pendingDbUpdates.push({
				videoRef: doc(db, "videos", video.id),
				expectedNewUrl,
			});
			process.stdout.write(
				`\r${prefix} | ✅ Folder: ${safeFolderName} (${sizeMb}MB)\n`,
			);
		}

		if (fs.existsSync(localPath)) {
			fs.unlinkSync(localPath);
		}
	}

	if (pendingDbUpdates.length > 0) {
		console.log(
			`\nReady to update ${pendingDbUpdates.length} links in the database.`,
		);
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		const answer = await new Promise((resolve) => {
			rl.question(
				"Do you want to proceed with the database updates? (y/n): ",
				resolve,
			);
		});

		rl.close();

		if (answer.toLowerCase() === "y") {
			console.log("\nUpdating database...");
			let updatedCount = 0;
			for (const update of pendingDbUpdates) {
				try {
					await updateDoc(update.videoRef, { url: update.expectedNewUrl });
					updatedCount++;
					process.stdout.write(
						`\rUpdated ${updatedCount}/${pendingDbUpdates.length} links...`.padEnd(
							50,
						),
					);
				} catch (e) {
					console.error(`\n❌ Error updating document: ${e.message}`);
				}
			}
			console.log(`\n✅ Database updates complete.`);
		} else {
			console.log("\n⚠️ Database updates skipped by user.");
		}
	}

	console.log("\n🎉 Migration Process Complete!");
	process.exit(0);
}

run();

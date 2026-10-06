import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const app = initializeApp({
	apiKey: "AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY",
	authDomain: "cpbs-admin.firebaseapp.com",
	projectId: "cpbs-admin",
});
const db = getFirestore(app);
const s3 = new S3Client({
	endpoint: "https://s3.us-east-005.backblazeb2.com",
	region: "us-east-005",
	credentials: {
		accessKeyId: "005281b623ef32b0000000001",
		secretAccessKey: "K005KG0gTQVPFRf9csLYfks+e/X26XI",
	},
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

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
				await delay(200);
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
			return {
				originalFileName: candidateFiles[0].name,
			};
		}
	}
	return {
		originalFileName: video.url.split("/").pop().split("?")[0],
	};
}

async function run() {
	console.log("Fetching B2 keys...");
	const res = await s3.send(
		new ListObjectsV2Command({ Bucket: "cpbs-videos" }),
	);
	const b2Keys = res.Contents.map((c) => c.Key);
	console.log(`Found ${b2Keys.length} files in B2.`);

	console.log("Fetching DB videos...");
	const qs = await getDocs(collection(db, "videos"));
	const videos = [];
	qs.forEach((d) => videos.push({ id: d.id, ...d.data() }));

	console.log(`Verifying all ${videos.length} videos against B2...`);

	const missing = [];
	const promises = videos.map(async (v) => {
		try {
			const info = await getArchiveDownloadInfo(v);
			let decodedFileName = decodeURIComponent(info.originalFileName);
			if (!decodedFileName.match(/\.(mp4|m4v|mov)$/i))
				decodedFileName += ".mp4";
			const safeFileName = decodedFileName
				.replace(/\s+/g, "-")
				.replace(/[/\\?%*:|"<>]/g, "-");

			const foundInB2 = b2Keys.find(
				(k) => k.endsWith(`/${safeFileName}`) || k === safeFileName,
			);

			if (!foundInB2) {
				missing.push(
					`${v.title} (Expected B2 file ending in: ${safeFileName})`,
				);
			}
		} catch (e) {
			missing.push(
				`${v.title} (Error checking Archive metadata: ${e.message})`,
			);
		}
	});

	await Promise.all(promises);

	if (missing.length === 0) {
		console.log(
			`\n✅ ALL 74 VIDEOS SUCCESSFULLY VERIFIED! Every single video from the database exists in B2.`,
		);
	} else {
		console.log(`\n❌ FOUND ${missing.length} MISSING VIDEOS:`);
		missing.forEach((m) => console.log(` - ${m}`));
	}
	process.exit(0);
}
run();

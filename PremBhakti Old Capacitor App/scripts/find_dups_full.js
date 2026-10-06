import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const app = initializeApp({
	apiKey: "AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY",
	authDomain: "cpbs-admin.firebaseapp.com",
	projectId: "cpbs-admin",
});
const db = getFirestore(app);

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
			const bestFile = candidateFiles[0];
			return {
				originalFileName: bestFile.name,
			};
		}
	}
	return {
		originalFileName: video.url.split("/").pop().split("?")[0],
	};
}

async function run() {
	const qs = await getDocs(collection(db, "videos"));
	const fileToTitles = {};
	const promises = [];
	qs.forEach((d) => {
		const v = d.data();
		promises.push(
			getArchiveDownloadInfo(v).then((info) => {
				let decodedFileName = decodeURIComponent(info.originalFileName);
				if (!decodedFileName.match(/\.(mp4|m4v|mov)$/i))
					decodedFileName += ".mp4";
				const safeFileName = decodedFileName
					.replace(/\s+/g, "-")
					.replace(/[/\\?%*:|"<>]/g, "-");

				if (!fileToTitles[safeFileName]) {
					fileToTitles[safeFileName] = [];
				}
				fileToTitles[safeFileName].push(v.title);
			}),
		);
	});
	await Promise.all(promises);

	Object.entries(fileToTitles)
		.filter(([_k, v]) => v.length > 1)
		.forEach(([k, v]) => {
			console.log(`Duplicate Filename Mapped by Script: ${k}`);
			console.log(`Used by Database Videos: \n - ${v.join("\n - ")}\n`);
		});
	process.exit(0);
}
run();

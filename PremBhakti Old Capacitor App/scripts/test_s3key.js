import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const app = initializeApp({
	apiKey: "AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY",
	authDomain: "cpbs-admin.firebaseapp.com",
	projectId: "cpbs-admin",
	storageBucket: "cpbs-admin.firebasestorage.app",
});
const db = getFirestore(app);
async function run() {
	const qs = await getDocs(collection(db, "videos"));
	const v = [];
	qs.forEach((d) => v.push({ id: d.id, ...d.data() }));
	const video = v[0];
	console.log("Video:", video.title);

	const baseName = decodeURIComponent(
		video.url.split("/").pop().split("?")[0],
	).replace(/\.[^/.]+$/, "");
	const normalizedBase = baseName.replace(/[-_ ]/g, "").toLowerCase();
	const itemId = video.url.match(/\/(?:items|download)\/([^/]+)/)[1];
	const res = await fetch(`https://archive.org/metadata/${itemId}`);
	const data = await res.json();

	const candidateFiles = data.files.filter((f) => {
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
	const bestFile = candidateFiles[0];

	let decodedFileName = decodeURIComponent(bestFile.name);
	if (!decodedFileName.match(/\.(mp4|m4v|mov)$/i)) decodedFileName += ".mp4";
	const safeFileName = decodedFileName
		.replace(/\s+/g, "-")
		.replace(/[/\\?%*:|"<>]/g, "-");
	const rawFolderName = data.metadata.title;
	const safeFolderName = rawFolderName.replace(/[/\\?%*:|"<>]/g, "-").trim();
	const s3Key = `${safeFolderName}/${safeFileName}`;
	console.log("S3KEY:", s3Key);
	process.exit(0);
}
run();

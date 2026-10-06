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
async function run() {
	const qs = await getDocs(collection(db, "videos"));
	const res = await s3.send(
		new ListObjectsV2Command({ Bucket: "cpbs-videos" }),
	);
	const b2Keys = res.Contents.map((c) => c.Key);
	console.log(`B2 Keys Total: ${b2Keys.length}`);

	let dbCount = 0;
	const dbExpectedKeys = [];

	qs.forEach((d) => {
		dbCount++;
		const v = d.data();
		let decodedFileName = decodeURIComponent(
			v.url.split("/").pop().split("?")[0],
		);
		if (!decodedFileName.match(/\.(mp4|m4v|mov)$/i)) decodedFileName += ".mp4";
		const safeFileName = decodedFileName
			.replace(/\s+/g, "-")
			.replace(/[/\\?%*:|"<>]/g, "-");
		dbExpectedKeys.push({ title: v.title, safeFileName });
	});
	console.log(`DB Videos Total: ${dbCount}`);

	dbExpectedKeys.forEach((dbk) => {
		const found = b2Keys.find(
			(k) => k.endsWith(`/${dbk.safeFileName}`) || k === dbk.safeFileName,
		);
		if (!found) {
			console.log(`MISSING IN B2: ${dbk.title} (${dbk.safeFileName})`);
		}
	});

	process.exit(0);
}
run();

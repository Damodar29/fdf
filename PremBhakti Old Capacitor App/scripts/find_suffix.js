import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const app = initializeApp({
	apiKey: "AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY",
	authDomain: "cpbs-admin.firebaseapp.com",
	projectId: "cpbs-admin",
});
const db = getFirestore(app);
async function run() {
	const qs = await getDocs(collection(db, "videos"));
	const safeFileNames = [];
	qs.forEach((d) => {
		const v = d.data();
		let decodedFileName = decodeURIComponent(
			v.url.split("/").pop().split("?")[0],
		);
		if (!decodedFileName.match(/\.(mp4|m4v|mov)$/i)) decodedFileName += ".mp4";
		const safeFileName = decodedFileName
			.replace(/\s+/g, "-")
			.replace(/[/\\?%*:|"<>]/g, "-");
		safeFileNames.push({ title: v.title, name: safeFileName, id: d.id });
	});
	let found = false;
	for (let i = 0; i < safeFileNames.length; i++) {
		for (let j = 0; j < safeFileNames.length; j++) {
			if (i !== j && safeFileNames[j].name.endsWith(safeFileNames[i].name)) {
				console.log(
					`Conflict: ${safeFileNames[i].title} (${safeFileNames[i].name}) is suffix of ${safeFileNames[j].title} (${safeFileNames[j].name})`,
				);
				found = true;
			}
		}
	}
	if (!found) console.log("No suffix conflicts found.");
	process.exit(0);
}
run();

const https = require("node:https");
const fs = require("node:fs");
require("dotenv").config();

const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const url = `https://firestore.googleapis.com/v1/projects/cpbs-admin/databases/(default)/documents/mandals/github-316562105?key=${API_KEY}`;

https.get(url, (res) => {
	let data = "";
	res.on("data", (c) => (data += c));
	res.on("end", () => {
		const d = JSON.parse(data);
		const name = d.fields?.name?.stringValue;
		console.log("Mandal Name:", name);
		const videos = d.fields?.videos?.arrayValue?.values || [];
		console.log("Videos count:", videos.length);
		if (videos.length > 0) {
			const urls = videos.map((v) => v.mapValue.fields.url.stringValue);
			fs.writeFileSync("gaur_purnima_videos.txt", urls.join("\n"));
			console.log("Saved to gaur_purnima_videos.txt");
		}
	});
});

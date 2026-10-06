import { initializeApp } from "firebase/app";
import {
	collection,
	doc,
	getDocs,
	getFirestore,
	setDoc,
} from "firebase/firestore";

// The rules allow public write, so we don't need authentication right now.
const firebaseConfig = {
	projectId: "cpbs-admin",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const fixStr = (str) => {
	if (typeof str !== "string") return str;
	let clean = str.trim();
	clean = clean.replace(/^(?:पारण\s*[-–—:]*\s*)/i, "");
	clean = clean.replace(/^(?:अगले दिन|अगली सुबह|कल)\s*[,:-]?\s*/i, "");
	clean = clean.replace(/\(दूसरे दिन\)/i, "");
	clean = clean.replace(/\s*l\s*$/, " ।");
	clean = clean.replace(/ ,/g, ", ");
	clean = clean.replace(/बल्लाभाचार्य/g, "वल्लभाचार्य");
	clean = clean.replace(/ठक्कुर/g, "ठाकुर");
	return clean.trim();
};

async function fixCalendar() {
	const snapshot = await getDocs(collection(db, "Calendar"));
	console.log(`Checking all ${snapshot.size} months...`);

	let totalFixes = 0;

	for (const docSnap of snapshot.docs) {
		const data = docSnap.data();
		let docHasChanges = false;
		const fixedData = {};

		for (const [dateKey, eventsArray] of Object.entries(data)) {
			if (!Array.isArray(eventsArray)) {
				fixedData[dateKey] = eventsArray;
				continue;
			}

			const newEventsArray = eventsArray.map((event) => {
				const e = { ...event };

				["breakTime", "time"].forEach((field) => {
					if (e[field]) {
						const original = e[field];
						const fixed = fixStr(original);
						if (original !== fixed) {
							e[field] = fixed;
							docHasChanges = true;
							totalFixes++;
							console.log(
								`[${docSnap.id}] ${field} Fixed: "${original}" -> "${fixed}"`,
							);
						}
					}
				});

				["eventName", "description", "location"].forEach((field) => {
					if (e[field]) {
						const original = e[field];
						const fixed = original
							.replace(/बल्लाभाचार्य/g, "वल्लभाचार्य")
							.replace(/ठक्कुर/g, "ठाकुर")
							.replace(/ ,/g, ", ")
							.replace(/\s*l\s*$/, " ।");
						if (original !== fixed) {
							e[field] = fixed;
							docHasChanges = true;
							totalFixes++;
							console.log(
								`[${docSnap.id}] ${field} Fixed: "${original}" -> "${fixed}"`,
							);
						}
					}
				});

				return e;
			});

			fixedData[dateKey] = newEventsArray;
		}

		if (docHasChanges) {
			console.log(`Updating Database Month: ${docSnap.id}...`);
			await setDoc(doc(db, "Calendar", docSnap.id), fixedData, {
				merge: false,
			});
		}
	}
	console.log(
		`Finished! Applied ${totalFixes} permanent fixes to the database.`,
	);
	process.exit(0);
}

fixCalendar().catch(console.error);

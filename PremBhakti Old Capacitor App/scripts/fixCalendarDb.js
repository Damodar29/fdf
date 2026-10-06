const admin = require("../functions/node_modules/firebase-admin");
admin.initializeApp({ projectId: "cpbs-admin" });
const db = admin.firestore();

const fixStr = (str) => {
	if (typeof str !== "string") return str;
	let s = str;
	// Replace ' l' or ' l ' at the end with ' ।'
	s = s.replace(/ l\s*$/, " ।");
	// Spelling fixes
	s = s.replace(/बल्लाभाचार्य/g, "वल्लभाचार्य");
	s = s.replace(/ठक्कुर/g, "ठाकुर");
	// Formatting fixes
	s = s.replace(/ ,सुबह/g, ", सुबह");
	return s;
};

async function fixCalendar() {
	const snapshot = await db.collection("Calendar").get();
	console.log(`Checking ${snapshot.size} months...`);

	let totalDocsUpdated = 0;
	let totalFixes = 0;

	for (const doc of snapshot.docs) {
		const data = doc.data();
		let docHasChanges = false;
		const fixedData = {};

		for (const [dateKey, eventsArray] of Object.entries(data)) {
			if (!Array.isArray(eventsArray)) {
				fixedData[dateKey] = eventsArray;
				continue;
			}

			const newEventsArray = eventsArray.map((event) => {
				const e = { ...event };

				const fieldsToFix = [
					"eventName",
					"description",
					"time",
					"breakTime",
					"location",
				];

				for (const field of fieldsToFix) {
					if (e[field]) {
						const original = e[field];
						const fixed = fixStr(original);
						if (original !== fixed) {
							e[field] = fixed;
							docHasChanges = true;
							totalFixes++;
							console.log(
								`[${doc.id}] Fixed in ${dateKey} (${field}): "${original}" -> "${fixed}"`,
							);
						}
					}
				}
				return e;
			});

			fixedData[dateKey] = newEventsArray;
		}

		if (docHasChanges) {
			console.log(`Updating month doc: ${doc.id}`);
			await db
				.collection("Calendar")
				.doc(doc.id)
				.set(fixedData, { merge: false });
			totalDocsUpdated++;
		}
	}

	console.log(
		`\nFinished! Applied ${totalFixes} fixes across ${totalDocsUpdated} months.`,
	);
	process.exit(0);
}

fixCalendar().catch((e) => {
	console.error(e);
	process.exit(1);
});

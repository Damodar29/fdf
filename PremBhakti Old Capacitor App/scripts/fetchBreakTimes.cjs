const fs = require("node:fs");
fetch(
	"https://firestore.googleapis.com/v1/projects/cpbs-admin/databases/(default)/documents/Calendar",
)
	.then((r) => r.json())
	.then((data) => {
		const breakTimes = new Set();
		const allEntries = [];
		if (!data.documents) return console.log("No documents found.");
		data.documents.forEach((doc) => {
			const fields = doc.fields;
			if (!fields) return;
			Object.keys(fields).forEach((dateKey) => {
				const eventsArray = fields[dateKey].arrayValue?.values || [];
				eventsArray.forEach((evObj) => {
					const ev = evObj.mapValue?.fields;
					if (ev?.breakTime?.stringValue) {
						breakTimes.add(ev.breakTime.stringValue);
						allEntries.push({
							date: dateKey,
							breakTime: ev.breakTime.stringValue,
						});
					} else if (ev?.time?.stringValue) {
						breakTimes.add(ev.time.stringValue);
						allEntries.push({ date: dateKey, time: ev.time.stringValue });
					}
				});
			});
		});
		fs.writeFileSync(
			"breakTimes.json",
			JSON.stringify(
				{
					uniqueBreakTimes: Array.from(breakTimes),
					allEntries,
				},
				null,
				2,
			),
		);
		console.log(
			`Found ${breakTimes.size} unique break times. Saved to breakTimes.json`,
		);
	})
	.catch((e) => console.error(e));

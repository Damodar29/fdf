// Admin devotee search (utils/devoteeSearch.ts): Hindi / English / Hinglish,
// half-typed words, small typos, phone digits and emails must find the right
// devotee — and must not find the wrong one. Run with `npm run test:devotees`.
import { devoteeMatches } from "../utils/devoteeSearch";

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (!cond) {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

console.log("1. Finds the devotee");
const finds: [string, string[]][] = [
	["vishakha", ["विशाखा श्रीवास्तव"]],
	["Vishaka", ["विशाखा"]],
	["vish", ["विशाखा"]],
	["विशाखा", ["Vishakha Shrivastava"]],
	["shrivastav", ["Vishakha Srivastava"]],
	["srivastava", ["विशाखा श्रीवास्तव"]],
	["radhe shyam", ["राधेश्याम"]],
	["radheshyam", ["Radhey Shyam"]],
	["krishna", ["कृष्ण कुमार"]],
	["krishn kumar", ["Krishna Kumar Sharma"]],
	["pooja", ["पूजा"]],
	["puja", ["Pooja Sharma"]],
	["deepak", ["दीपक यादव"]],
	["laxmi", ["Lakshmi Devi"]],
	["लक्ष्मी", ["Lakshmi Devi"]],
	["gaurav", ["गौरव"]],
	["sobha", ["Shobha"]],
	["mahesh", ["", "महेश दास"]],
	["jhansi", ["Ramesh", "झांसी"]],
	["झांसी", ["Ramesh", "Jhansi"]],
	["sharma", ["Rahul Kumar Sharma"]],
	["rahul sharma", ["Rahul Kumar Sharma"]],
];
for (const [q, names] of finds)
	check(devoteeMatches(q, names), `"${q}" should find ${names.join(" / ")}`);

check(
	devoteeMatches("98765", ["Ram"], [], ["+91 98765 43210"]),
	"phone digits",
);
check(
	devoteeMatches("9876543210", ["Ram"], [], ["+919876543210"]),
	"phone without country code",
);
check(
	devoteeMatches("ram@gmail", ["Ram"], ["ram@gmail.com"]),
	"email as typed",
);
check(devoteeMatches("", ["anyone"]), "empty query finds all");

console.log("2. Does not find someone else");
const misses: [string, string[]][] = [
	["mohan", ["Sohan Lal"]],
	["rahul sharma", ["Rahul Verma"]],
	["geeta", ["Seeta"]],
	["vishakha", ["Radha"]],
	["98765", ["Ram"]],
];
for (const [q, names] of misses)
	check(
		!devoteeMatches(q, names),
		`"${q}" should NOT find ${names.join(" / ")}`,
	);
check(
	!devoteeMatches("12345", ["Ram"], [], ["+91 98765 43210"]),
	"wrong phone digits",
);

if (failures) {
	console.log(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll devotee search checks passed");

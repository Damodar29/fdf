// "Find on the app" name matching (functions/src/familySearch.ts): the same
// devotee typed in Hindi / English / Hinglish, with typos or titles, must
// match — and different people must not. Run with `npm run test:names`.
// The functions package is CommonJS: named imports need the namespace form.
import * as fnSearchModule from "../functions/src/familySearch";
import {
	compareDates,
	nameMatchScore as appNameMatchScore,
	phoneKey,
	samePerson,
} from "../utils/personMatch";

const fnSearch = ((fnSearchModule as any).default ??
	fnSearchModule) as typeof fnSearchModule;
const { cleanEmail, dikshaDateVariants, nameMatchScore } = fnSearch;

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (!cond) {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

console.log("1. Same person, written differently");
const same: [string, string][] = [
	["विशाखा", "Vishakha"],
	["Vishakha Shrivastava", "विशाखा श्रीवास्तव"],
	["Vishaka Srivastav", "Vishakha Shrivastava"],
	["Shrivastava", "Srivastava"],
	["कृष्ण कुमार श्रीवास्तव", "Krishna Kumar Shrivastava"],
	["Krishn Kumar", "Krishna Kumar Shrivastava"],
	["Mahesh Narayan", "महेश नारायण श्रीवास्तव"],
	["Rahul Sharma", "Rahul Kumar Sharma"],
	["Adwaitdas", "Advait Das"],
	["Shri Ram Prasad ji", "Ram Prasad"],
	["Shobha", "Sobha"],
	["Radhey Shyam", "राधेश्याम"],
	["Pooja", "पूजा"],
	["Deepak", "दीपक"],
	["Lakshmi", "लक्ष्मी"],
	["Priya", "प्रिया"],
	["Gaurav", "गौरव"],
	["Shivani", "शिवानी"],
];
for (const [a, b] of same)
	check(nameMatchScore(a, b) > 0, `"${a}" ~ "${b}" (got ${nameMatchScore(a, b)})`);

console.log("2. Different people stay apart");
const diff: [string, string][] = [
	["Ram", "Shyam"],
	["Rahul Sharma", "Rohit Verma"],
	["Vishakha", "Vaishali"],
	["Mohan", "Sohan"],
	["Ram", "Ramesh"],
	["Anil", "Sunil"],
	["Rajesh", "Mahesh"],
	["Suresh", "Naresh"],
	["Shri", "Shri"], // titles only — nothing to compare
	["", "Rahul"],
];
for (const [a, b] of diff)
	check(nameMatchScore(a, b) === 0, `"${a}" ≠ "${b}" (got ${nameMatchScore(a, b)})`);

console.log("3. Better matches score higher");
check(
	nameMatchScore("Vishakha Shrivastava", "Vishakha Shrivastava") >
		nameMatchScore("Vishakha Shrivastava", "Vishakha Gupta"),
	"full name above first name only",
);

console.log("4. Diksha date spellings");
const v = dikshaDateVariants("05/03/2010");
for (const s of ["05/03/2010", "5/3/2010", "2010-03-05", "05-03-2010", "2010-3-5"])
	check(v.includes(s), `05/03/2010 also finds ${s}`);
check(dikshaDateVariants("2010-03-05").includes("05/03/2010"), "ISO → DD/MM/YYYY");
check(v.length <= 30, "fits a Firestore in-query");
check(dikshaDateVariants("sometime 2010").join() === "sometime 2010", "unreadable as typed");
check(dikshaDateVariants("").length === 0, "empty → nothing");

console.log("5. Email");
check(cleanEmail("  Devotee@Gmail.com ") === "devotee@gmail.com", "trimmed, lower case");
check(cleanEmail("not-an-email") === "", "rejects non-email");
check(cleanEmail("+917000000000") === "", "phone is not an email");

console.log("6. The app's copy (utils/personMatch.ts) scores the same");
for (const [a, b] of [...same, ...diff, ["Vishakha Shrivastava", "Vishakha Gupta"]] as [
	string,
	string,
][])
	check(
		appNameMatchScore(a, b) === nameMatchScore(a, b),
		`"${a}" / "${b}": app ${appNameMatchScore(a, b)}, server ${nameMatchScore(a, b)}`,
	);
check(compareDates("05/03/2010", "2010-03-05") === "same", "dates: same day, two spellings");
check(compareDates("05/03/2010", "06/03/2010") === "different", "dates: different day");
check(compareDates("", "06/03/2010") === "unknown", "dates: one missing");
check(phoneKey("+91 98290-12345") === "9829012345", "phone key from a spaced number");
check(phoneKey("12345") === "", "short number is no phone");
check(
	samePerson(
		{ realName: "विशाखा श्रीवास्तव", dikshaDate: "05/03/2010" },
		{ realName: "Vishakha Shrivastava", dikshaDate: "2010-03-05" },
	),
	"same person across scripts and date spellings",
);
check(
	!samePerson(
		{ realName: "Vishakha", dikshaDate: "05/03/2010" },
		{ realName: "Vishakha", dikshaDate: "05/03/2011" },
	),
	"same name, different diksha date: not the same person",
);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

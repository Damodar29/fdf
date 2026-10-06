// Admin "Duplicates & problems" analysis (utils/profileIssues.ts).
// Run with `npm run test:devotees`.
import {
	findAllIssues,
	findBrokenLinks,
	findDuplicateAccounts,
	findMembersAlsoLinked,
	findMembersWithAccount,
	findRepeatedMembers,
	findSharedMemberCopies,
	type IssueProfile,
	splitIgnored,
} from "../utils/profileIssues";

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (cond) console.log(`  PASS ${msg}`);
	else {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

console.log("1. Duplicate accounts");
const dupes: IssueProfile[] = [
	// One devotee: Google account + phone account, Hindi and English name.
	{
		uid: "g1",
		realName: "Vishakha Shrivastava",
		email: "v@gmail.com",
		phoneNumber: "+919800000001",
		dikshaDate: "05/03/2010",
	},
	{ uid: "p1", realName: "विशाखा श्रीवास्तव", phoneNumber: "9800000001" },
	// Husband and wife sharing one phone: two people.
	{ uid: "h", realName: "Ramesh Gupta", phoneNumber: "+919800000002" },
	{ uid: "w", realName: "Sunita Gupta", phoneNumber: "+919800000002" },
	// Same name + same phone, different diksha dates: only a "maybe" (one
	// date may be a typo or copied from a relative).
	{
		uid: "r1",
		realName: "Radha Sharma",
		dikshaDate: "01/01/2000",
		phoneNumber: "+919800000003",
	},
	{
		uid: "r2",
		realName: "Radha Sharma",
		dikshaDate: "02/02/2002",
		phoneNumber: "+919800000003",
	},
	// Same name, different dates, nothing shared: two people.
	{ uid: "t1", realName: "Govind Das", dikshaDate: "01/01/2001" },
	{ uid: "t2", realName: "Govind Das", dikshaDate: "03/03/2003" },
	// Same name + same diksha date, no shared contact: one person.
	{ uid: "k1", realName: "Krishna Das", dikshaDate: "2015-07-10" },
	{ uid: "k2", realName: "Krishn Das", dikshaDate: "10/07/2015" },
	// Already merged: never reported again.
	{ uid: "m1", realName: "Mohan Lal", phoneNumber: "+919800000004" },
	{
		uid: "m2",
		realName: "Mohan Lal",
		phoneNumber: "+919800000004",
		mergedIntoUid: "m1",
		isDeleted: true,
	},
	// Different genders: two people.
	{
		uid: "x1",
		realName: "Shyam Sundar",
		phoneNumber: "+919800000005",
		gender: "male",
	},
	{
		uid: "x2",
		realName: "Shyama Sundari",
		phoneNumber: "+919800000005",
		gender: "female",
	},
	// Login phone only (profile field empty) still counts.
	{ uid: "l1", realName: "Gopal Krishna", email: "gopal@gmail.com" },
	{ uid: "l2", realName: "Gopal Krishna" },
];
const pairs = findDuplicateAccounts(dupes, {
	l1: { phone: "+919800000009" },
	l2: { phone: "+919800000009" },
});
const has = (a: string, b: string) =>
	pairs.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
check(has("g1", "p1"), "Google + phone account of one devotee");
check(
	pairs.find((p) => has("g1", "p1") && p.a)?.level === "high",
	"…marked high",
);
check(!has("h", "w"), "shared family phone is not a duplicate");
check(
	pairs.find((p) => has("r1", "r2") && [p.a, p.b].includes("r1"))?.level ===
		"possible",
	"same name + phone, different dates: only a maybe",
);
check(
	!!pairs
		.find((p) => [p.a, p.b].includes("r1"))
		?.reasons.includes("different_date"),
	"…with a different-dates warning",
);
check(
	!has("t1", "t2"),
	"same name, different dates, nothing shared: two people",
);
check(has("k1", "k2"), "same name + same diksha date (two spellings)");
check(!has("m1", "m2"), "merged account not reported");
check(!has("x1", "x2"), "different genders are two people");
check(has("l1", "l2"), "same login phone found");
check(pairs.length === 4, `exactly 4 pairs (got ${pairs.length})`);

console.log("2. Member added twice in one profile");
const rep = findRepeatedMembers([
	{
		uid: "a",
		familyMembers: [
			{ id: "1", realName: "Kamla Devi", relation: "mother" },
			{ id: "2", realName: "कमला देवी", relation: "mother" },
			{ id: "3", realName: "Ram", relation: "grandfather_paternal" },
			{ id: "4", realName: "Ram", relation: "son" },
		],
	},
]);
check(
	rep.length === 1 && rep[0].keepId === "1" && rep[0].repeatId === "2",
	"Hindi/English repeat found once",
);

console.log("3. Hand-added and also linked");
const tw = findMembersAlsoLinked([
	{
		uid: "a",
		linkedFamilyMembers: ["b"],
		linkedFamilyRelations: { b: "son" },
		familyMembers: [{ id: "1", realName: "Arjun Gupta", relation: "son" }],
	},
	{ uid: "b", realName: "Arjun Gupta", linkedFamilyMembers: ["a"] },
]);
check(
	tw.length === 1 && tw[0].linkedUid === "b",
	"son added by hand and linked",
);

console.log("4. Hand-added who has their own account");
const acc = findMembersWithAccount([
	{
		uid: "a",
		realName: "Asha",
		familyMembers: [
			{
				id: "1",
				realName: "Kishan Lal",
				dikshaDate: "01/02/2003",
				relation: "father",
			},
		],
	},
	{ uid: "k", realName: "किशन लाल", dikshaDate: "2003-02-01" },
	{ uid: "z", realName: "Kishan Lal", dikshaDate: "05/05/2005" },
]);
check(
	acc.length === 1 && acc[0].accountUid === "k",
	"found by name + same diksha date",
);

console.log("5. Same person added by several relatives");
const copies = findSharedMemberCopies([
	{
		uid: "a",
		linkedFamilyMembers: ["b"],
		familyMembers: [{ id: "1", realName: "Dadi Ma" }],
	},
	{
		uid: "b",
		linkedFamilyMembers: ["a"],
		familyMembers: [{ id: "9", realName: "Dadi Ma", photoURL: "x.jpg" }],
	},
]);
check(copies.length === 1, "one person, two copies");
check(copies[0]?.copies[0].uid === "b", "the copy with a photo is kept");
check(copies[0]?.canTidy === true, "keeper is linked to the other owner");

console.log("6. Broken links");
const broken = findBrokenLinks([
	{ uid: "a", linkedFamilyMembers: ["a", "b", "c", "d", "e"] },
	{ uid: "b", linkedFamilyMembers: [] },
	{ uid: "c", isDeleted: true },
	{ uid: "d", mergedIntoUid: "e", isDeleted: true },
	{ uid: "e", linkedFamilyMembers: ["a"] },
]);
const kinds = broken
	.map((b) => `${b.otherUid}:${b.kind}`)
	.sort()
	.join(",");
check(kinds === "a:self,b:one_sided,c:deleted,d:merged", `kinds: ${kinds}`);

console.log("7. Ignored problems stay hidden");
const all = findAllIssues(dupes, {}, new Set(pairs.map((p) => p.key)));
check(all.duplicates.length === 0, "ignored duplicates hidden");

console.log("8. Hidden ones can be looked at again");
const hiddenKey = pairs[0]?.key ?? "";
const split = splitIgnored(
	findAllIssues(dupes, {
		l1: { phone: "+919800000009" },
		l2: { phone: "+919800000009" },
	}),
	new Set([hiddenKey, "gone:key"]),
);
check(
	split.hidden.duplicates.length === 1 &&
		split.hidden.duplicates[0].key === hiddenKey,
	"the hidden one is listed as hidden",
);
check(split.open.duplicates.length === pairs.length - 1, "the rest stay open");
check(
	Object.values(split.hidden).flat().length === 1,
	"a key whose problem is gone counts nowhere",
);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

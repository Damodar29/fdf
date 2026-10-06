// Hand-added family members shared with the linked family
// (utils/sharedFamily.ts). Run with `npm run test:devotees`.
import { sharedFamilyMembers } from "../utils/sharedFamily";

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (cond) console.log(`  PASS ${msg}`);
	else {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

// Mausi (me) is linked to mausa and their son. Mausa added his mother by
// hand, and also — before mausi made her own profile — mausi herself and
// the son. The son added the same grandmother again.
const mausa = {
	id: "mausa",
	realName: "Ramesh Shrivastava",
	gender: "male" as const,
	theirRelationForMe: "wife",
	familyRelations: { son: "son" },
	handAdded: [
		{ id: "m1", realName: "Kamla Devi", relation: "mother" },
		{ id: "m2", realName: "विशाखा श्रीवास्तव", relation: "wife" },
		{ id: "m3", realName: "Arjun", relation: "son" },
	],
};
const son = {
	id: "son",
	realName: "Arjun Shrivastava",
	gender: "male" as const,
	theirRelationForMe: "mother",
	handAdded: [
		{
			id: "s1",
			realName: "कमला देवी",
			relation: "grandmother_paternal",
			photoURL: "https://example.com/k.jpg",
		},
	],
};
const me = {
	realName: "Vishakha Shrivastava",
	relations: { mausa: "husband", son: "son" },
	handAdded: [],
};

console.log("1. Mausa's mother reaches mausi as her mother-in-law");
let shared = sharedFamilyMembers([mausa, son], me);
check(
	shared.length === 1,
	`one shared person (got ${shared.map((s) => s.member.realName).join(", ")})`,
);
const kamla = shared[0];
check(kamla?.member.realName === "Kamla Devi", "it is Kamla Devi");
check(
	kamla?.owners.length === 2,
	"added by both mausa and the son — shown once",
);
check(
	kamla?.relation === "mother_in_law",
	`relation for me: ${kamla?.relation}`,
);
check(
	kamla?.member.photoURL === "https://example.com/k.jpg",
	"photo taken from the copy that has one",
);

console.log("2. My own relation not set: worked out from what mausa calls me");
shared = sharedFamilyMembers([mausa], { ...me, relations: {} });
check(
	shared[0]?.relation === "mother_in_law",
	`from "wife" + male (got ${shared[0]?.relation})`,
);

console.log("3. Not shown when I already added them myself");
shared = sharedFamilyMembers([mausa, son], {
	...me,
	handAdded: [{ realName: "Kamla devi" }],
});
check(shared.length === 0, "nothing shared");

console.log("4. Several possible relations stay suggestions");
shared = sharedFamilyMembers(
	[
		{
			id: "dad",
			realName: "Suresh",
			gender: "male",
			theirRelationForMe: "son",
			handAdded: [{ id: "b", realName: "Mahesh", relation: "brother" }],
		},
	],
	{ realName: "Rahul", relations: { dad: "father" } },
);
check(shared.length === 1, "father's brother shared");
check(!shared[0]?.relation, "chacha or tau — no single answer");
check(
	shared[0]?.suggestions.includes("chacha") &&
		shared[0]?.suggestions.includes("tau"),
	`suggestions: ${shared[0]?.suggestions.join(", ")}`,
);

console.log("5. Different people with the same first name both show");
shared = sharedFamilyMembers(
	[
		{
			id: "a",
			realName: "A",
			handAdded: [
				{ id: "1", realName: "Radha Sharma", dikshaDate: "01/01/2000" },
				{ id: "2", realName: "Radha Sharma", dikshaDate: "02/02/2002" },
			],
		},
	],
	{ realName: "Me" },
);
check(shared.length === 2, "different diksha dates are different people");

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

// "Complete relations" helper on the profile (utils/relationQuestions.ts).
// Run with `npm run test:devotees`.
import { relationReasonFor } from "../utils/familyChains";
import { relationQuestions } from "../utils/relationQuestions";

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (cond) console.log(`  PASS ${msg}`);
	else {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

// Me: Shivani. I set only my mother-in-law; the rest I haven't answered.
const members = [
	{
		id: "vishakha",
		gender: "female" as const,
		familyRelations: { adwait: "son", gourang: "brother" },
	},
	{ id: "adwait", gender: "male" as const },
	{ id: "gourang", gender: "male" as const },
	{
		id: "krishna",
		gender: "male" as const,
		theirRelationForMe: "daughter_in_law",
	},
	{ id: "stranger", gender: "" as const },
];
const mine = { vishakha: "mother_in_law" };

console.log("1. Questions, easy ones first");
const qs = relationQuestions(members, mine);
const ids = qs.map((q) => q.id);
check(!ids.includes("vishakha"), "someone I answered is not asked");
check(
	ids.indexOf("krishna") < ids.indexOf("adwait") &&
		ids.indexOf("gourang") < ids.indexOf("adwait"),
	`one-answer ones come first (${ids.join(",")})`,
);
check(ids[ids.length - 1] === "stranger", "nothing known: asked last");
const q = (id: string) => qs.find((x) => x.id === id);
check(
	q("krishna")?.options.join() === "father_in_law",
	`they call me bahu ⇒ father-in-law (${q("krishna")?.options})`,
);
check(
	q("gourang")?.options.join() === "uncle_in_law",
	`mother-in-law's brother (${q("gourang")?.options})`,
);
check(
	q("adwait")?.options.includes("husband") &&
		q("adwait")?.options.includes("brother_in_law"),
	`mother-in-law's son: husband or devar/jeth (${q("adwait")?.options})`,
);
check(q("stranger")?.options.length === 0, "no guess for a stranger");

console.log("2. A spouse already set is not offered again");
const withHusband = relationQuestions(
	[...members, { id: "real-husband", gender: "male" as const }],
	{ ...mine, "real-husband": "husband" },
);
check(
	withHusband.find((x) => x.id === "adwait")?.options.join() ===
		"brother_in_law",
	"only devar/jeth left",
);

console.log("3. Why it is suggested");
const r1 = relationReasonFor("krishna", members, mine);
check(
	r1?.kind === "theyCallMe" && r1.relation === "daughter_in_law",
	"they call me…",
);
const r2 = relationReasonFor("gourang", members, mine);
check(
	r2?.kind === "via" &&
		r2.viaId === "vishakha" &&
		r2.mine === "mother_in_law" &&
		r2.theirs === "brother",
	"through the mother-in-law",
);
check(relationReasonFor("stranger", members, mine) === null, "no reason");

console.log("4. A cousin's mother; a cousin's chachi (no name)");
// Me: Damodar. Shruti is my cousin and calls Manjusha "mother"; Adwait is my
// mausera bhai and calls Manjusha "chachi".
const fam = [
	{
		id: "shruti",
		gender: "female" as const,
		familyRelations: { manjusha: "mother" },
	},
	{
		id: "adwait",
		gender: "male" as const,
		familyRelations: { manjusha: "chachi" },
	},
	{ id: "manjusha", gender: "female" as const },
];
const q2 = relationQuestions(fam, { shruti: "cousin", adwait: "mausera_bhai" });
check(
	["chachi", "tai", "bua", "aunt_maternal", "mausi"].every((r) =>
		q2[0]?.options.includes(r),
	),
	`cousin's mother: one of the aunts (${q2[0]?.options})`,
);
const onlyAdwait = relationQuestions(fam.slice(1), { adwait: "mausera_bhai" });
check(onlyAdwait[0]?.options.length === 0, "mausera bhai's chachi: no name");
const r3 = relationReasonFor("manjusha", fam.slice(1), {
	adwait: "mausera_bhai",
});
check(
	r3?.kind === "connected" && r3.viaId === "adwait" && r3.theirs === "chachi",
	"…but it says how she is connected",
);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

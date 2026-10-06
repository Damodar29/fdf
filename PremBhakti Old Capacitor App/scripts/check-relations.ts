// Checks the family relation tables: the app copy (src/constants/relations.ts)
// and the Cloud Functions copy (functions/src/familyRelations.ts) must match,
// and every inverse must make sense. Run with `npm run test:relations`.
import * as fnDikshaModule from "../functions/src/dikshaAnniversary";
import * as fnModule from "../functions/src/familyRelations";
import * as app from "../src/constants/relations";
import * as dk from "../utils/dikshaDate";
import { findLinkedTwin, repeatedHandAddedIds } from "../utils/familyDedupe";
import {
	type FamilyGroupProfile,
	planAllFamilyGroupFixes,
	planFamilyGroupFix,
} from "../utils/familyGroupFix";
import { guessGender } from "../utils/genderGuess";
import { searchRelations } from "../utils/relationSearch";

// functions/ is a CommonJS package, so tsx may hand its exports over as `default`.
const fn: typeof fnModule =
	(fnModule as { default?: typeof fnModule }).default ?? fnModule;
const fnDiksha: typeof fnDikshaModule =
	(fnDikshaModule as { default?: typeof fnDikshaModule }).default ??
	fnDikshaModule;

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (!cond) {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

const options = app.RELATION_GROUPS.flatMap((g) => g.options);
const ids = new Set(options.map((o) => o.id));

console.log("1. Ids are unique and every relation has an inverse entry");
check(ids.size === options.length, "duplicate relation id");
for (const o of options) {
	check(o.id in app.RELATION_INVERSE, `${o.id} has no RELATION_INVERSE entry`);
	check(!!o.en && !!o.hi, `${o.id} needs both labels`);
}

console.log("2. Inverse lists only name known relations of the right gender");
for (const [id, [ifMale, ifFemale]] of Object.entries(app.RELATION_INVERSE)) {
	check(ids.has(id), `RELATION_INVERSE key ${id} is not an option`);
	for (const [list, gender] of [
		[ifMale, "male"],
		[ifFemale, "female"],
	] as const) {
		for (const target of list) {
			check(ids.has(target), `${id} → unknown ${target}`);
			const g = app.relationGender(target);
			// The inverse describes the describer, so it carries their gender.
			check(!g || g === gender, `${id} → ${target} for a ${gender} describer`);
		}
	}
}

console.log("3. Functions copy matches the app copy");
check(
	JSON.stringify(fn.RELATION_INVERSE) === JSON.stringify(app.RELATION_INVERSE),
	"RELATION_INVERSE differs between app and functions",
);
for (const o of options) {
	check(
		fn.RELATION_GENDER[o.id] === o.g,
		`gender of ${o.id}: functions ${fn.RELATION_GENDER[o.id]} vs app ${o.g}`,
	);
}
check(
	Object.keys(fn.RELATION_GENDER).every((id) => ids.has(id)),
	"functions RELATION_GENDER has an id the app doesn't",
);

console.log("4. Automatic inverse: certain answers only");
const genders = ["male", "female", ""] as const;
for (const id of [...ids, "custom text", ""]) {
	for (const a of genders)
		for (const b of genders) {
			const x = app.autoInverseRelation(id, a, b);
			const y = fn.autoInverseRelation(id, a, b);
			check(x === y, `auto(${id}, ${a}, ${b}): app ${x} vs functions ${y}`);
		}
}
const cases: [string, string, string, string | null][] = [
	// relation, describer gender, described gender, expected
	["sister", "male", "female", "brother"],
	["sister", "female", "", "sister"],
	["sister", "", "female", null], // my gender unknown: brother or sister
	["sister", "male", "male", null], // called sister but set as male
	["brother", "female", "male", "sister"],
	["father", "male", "", "son"],
	["mother", "female", "female", "daughter"],
	["son", "female", "male", "mother"],
	["husband", "", "", "wife"],
	["husband", "male", "", null],
	["wife", "", "", "husband"],
	["mausi", "male", "female", "bhanja"],
	["bua", "female", "", "bhatiji"],
	["chacha", "male", "", "bhatija"],
	["bhatija", "male", "", null], // chacha or tau
	["jija", "male", "", "sala"],
	["jija", "female", "", "sali"],
	["sala", "", "", "jija"],
	["bhabhi", "female", "", "nanad"],
	["bhabhi", "male", "", null], // devar or jeth
	["devar", "female", "", "bhabhi"],
	["jeth", "female", "", null],
	["grandfather_paternal", "male", "", "pota"],
	["nani", "female", "", null], // not an id
	["grandmother_maternal", "female", "", "natin"],
	["pota", "male", "", "grandfather_paternal"],
	["grandson", "male", "", null], // dada or nana
	["mamera_bhai", "male", "", "fufera_bhai"],
	["mauseri_behen", "female", "", "mauseri_behen"],
	["samdhi", "female", "", "samdhan"],
	["cousin", "", "", "cousin"],
	// Grandchildren's spouses and the grandparents-in-law they call us.
	["nat_bahu", "male", "", "nana_sasur"],
	["nat_bahu", "female", "female", "nani_saas"],
	["pot_bahu", "female", "", "dadi_saas"],
	["pot_damad", "male", "male", "dada_sasur"],
	["nat_bahu", "", "", null], // nana or nani
	["nat_bahu", "male", "male", null], // called bahu but set as male
	["dadi_saas", "female", "", "pot_bahu"],
	["nana_sasur", "male", "", "nat_damad"],
	["bhatij_bahu", "male", "", "uncle_in_law"],
	["bhanji_damad", "female", "", "aunt_in_law"],
	["uncle_in_law", "female", "", null], // bhatij- or bhanj-bahu
];
for (const [rel, a, b, expected] of cases) {
	const got = app.autoInverseRelation(rel, a, b);
	check(
		got === expected,
		`auto(${rel}, ${a}, ${b}) = ${got}, want ${expected}`,
	);
}

console.log("4b. Chain suggestions name known relations of the right gender");
for (const [mine, byTheirs] of Object.entries(app.RELATION_CHAIN)) {
	check(ids.has(mine), `RELATION_CHAIN key ${mine} is not an option`);
	for (const [theirs, results] of Object.entries(byTheirs)) {
		check(ids.has(theirs), `chain ${mine}+${theirs}: unknown ${theirs}`);
		for (const r of results) {
			check(ids.has(r), `chain ${mine}+${theirs} → unknown ${r}`);
			// Both describe the same person, so the gender must agree.
			check(
				app.relationGender(r) === app.relationGender(theirs),
				`chain ${mine}+${theirs} → ${r}: gender mismatch`,
			);
		}
	}
}
const chainCases: [string, string, string, string[]][] = [
	["mausi", "son", "", ["mausera_bhai"]],
	["mausi", "daughter", "female", ["mauseri_behen"]],
	["mausi", "son", "female", []], // gender contradicts
	["father", "brother", "", ["chacha", "tau"]],
	["mother", "sister", "", ["mausi"]],
	["sister", "husband", "", ["jija"]],
	["wife", "brother", "", ["sala"]],
	["son", "daughter", "", ["poti"]],
	["cousin", "son", "", []],
	["nati", "wife", "", ["nat_bahu"]],
	["pota", "wife", "", ["pot_bahu"]],
	["natin", "husband", "", ["nat_damad"]],
	["grandson", "wife", "", ["pot_bahu", "nat_bahu"]],
	["daughter_in_law", "son", "", ["pota"]],
	["husband", "grandmother_paternal", "", ["dadi_saas"]],
	["wife", "grandfather_maternal", "", ["nana_sasur"]],
	["wife", "mausi", "", ["aunt_in_law"]],
	["father_in_law", "brother", "", ["uncle_in_law"]],
	["bhanja", "wife", "", ["bhanj_bahu"]],
];
for (const [mine, theirs, g, want] of chainCases) {
	const got = app.suggestChainRelations([{ mine, theirs }], g as app.Gender);
	check(
		JSON.stringify(got) === JSON.stringify(want),
		`chain(${mine}, ${theirs}, ${g}) = ${got}, want ${want}`,
	);
}
check(
	JSON.stringify(
		app.suggestChainRelations([
			{ mine: "father", theirs: "son" },
			{ mine: "mother", theirs: "son" },
			{ mine: "", theirs: "son" },
		]),
	) === JSON.stringify(["brother"]),
	"several chains merge without duplicates",
);

console.log("5. Linking an old family group together (admin fix)");
{
	// Me ↔ Mausi (old link), Mausi ↔ A, Mausi ↔ B (admin), A ↔ C.
	// D is deleted, E only has a one-sided entry for Mausi.
	const people: FamilyGroupProfile[] = [
		{
			uid: "me",
			gender: "male",
			linkedFamilyMembers: ["mausi"],
			linkedFamilyRelations: { mausi: "mausi" },
		},
		{
			uid: "mausi",
			gender: "female",
			linkedFamilyMembers: ["me", "a", "b", "d"],
		},
		{
			uid: "a",
			linkedFamilyMembers: ["mausi", "c"],
			linkedFamilyRelations: { mausi: "mother" },
		},
		{ uid: "b", gender: "female", linkedFamilyMembers: ["mausi"] },
		{ uid: "c", linkedFamilyMembers: ["a"] },
		{ uid: "d", isDeleted: true, linkedFamilyMembers: ["mausi"] },
		{ uid: "e", linkedFamilyMembers: ["mausi"] },
	];
	const plan = planFamilyGroupFix("mausi", people);
	check(
		JSON.stringify([...plan.members].sort()) ===
			JSON.stringify(["a", "b", "c", "mausi", "me"]),
		`group = me, mausi, a, b, c (got ${plan.members})`,
	);
	const adds = (uid: string) =>
		(plan.linkAdds.get(uid) || []).map((x) => `${x.other}~${x.via}`).sort();
	check(
		JSON.stringify(adds("me")) ===
			JSON.stringify(["a~mausi", "b~mausi", "c~mausi"]),
		`me gets a, b, c via mausi (${adds("me")})`,
	);
	check(
		JSON.stringify(adds("c")) === JSON.stringify(["b~a", "mausi~a", "me~a"]),
		`c gets b, mausi, me via a (${adds("c")})`,
	);
	check(
		adds("mausi").length === 1 && adds("mausi")[0] === "c~a",
		"mausi gets c",
	);
	check(plan.linkAdds.get("e") === undefined, "one-sided e left out");
	check(plan.linkAdds.get("d") === undefined, "deleted d left out");
	// Pairs: 5 people = 10, already two-way: me-mausi, mausi-a, mausi-b, a-c.
	check(plan.newLinks === 6, `6 new links (got ${plan.newLinks})`);
	check(
		plan.relationAdds.get("mausi")?.me === "bhanja",
		`mausi's relation for me = bhanja (${plan.relationAdds.get("mausi")?.me})`,
	);
	// a calls mausi "mother" but a's gender is unknown: son or daughter.
	check(!plan.relationAdds.get("mausi")?.a, "no guess for a (gender unknown)");
	check(
		plan.newRelations === 1,
		`1 relation filled (got ${plan.newRelations})`,
	);

	const big: FamilyGroupProfile[] = Array.from({ length: 70 }, (_, i) => ({
		uid: `u${i}`,
		linkedFamilyMembers: [i > 0 ? `u${i - 1}` : "", `u${i + 1}`].filter(
			(u) => u !== "u70",
		),
	}));
	const bigPlan = planFamilyGroupFix("u0", big);
	check(
		bigPlan.tooBig && bigPlan.linkAdds.size === 0,
		"70-person chain refused",
	);
	check(
		planFamilyGroupFix("nobody", people).members.length === 0,
		"unknown start does nothing",
	);
}

console.log("6. Every old family group at once (admin report)");
{
	const lp = (uid: string, links: string[], extra = {}) => ({
		uid,
		linkedFamilyMembers: links,
		...extra,
	});
	const people: FamilyGroupProfile[] = [
		// Family 1: a–b, b–c (a–c missing)
		lp("a", ["b"]),
		lp("b", ["a", "c"]),
		lp("c", ["b"]),
		// Family 2: complete already
		lp("x", ["y"]),
		lp("y", ["x"]),
		// Family 3: complete links, one relation to fill
		lp("p", ["q"], {
			gender: "male",
			linkedFamilyRelations: { q: "sister" },
		}),
		lp("q", ["p"], { gender: "female" }),
		// Alone
		lp("z", []),
		// Family 4: a 70-person chain — too big
		...Array.from({ length: 70 }, (_, i) =>
			lp(
				`k${i}`,
				[i > 0 ? `k${i - 1}` : "", i < 69 ? `k${i + 1}` : ""].filter(Boolean),
			),
		),
	];
	const all = planAllFamilyGroupFixes(people);
	check(all.plans.length === 2, `2 groups to fix (got ${all.plans.length})`);
	check(all.newLinks === 1, `1 missing link (got ${all.newLinks})`);
	check(all.newRelations === 1, `1 relation (got ${all.newRelations})`);
	check(
		all.tooBig.length === 1 && all.tooBig[0].members.length === 70,
		`big chain reported once with all 70 (got ${all.tooBig.map((t) => t.members.length)})`,
	);
	check(
		all.plans.every((p) => !p.members.includes("x")),
		"complete family left out",
	);
}

console.log("7. Diksha anniversaries");
{
	const today = { y: 2026, m: 9, d: 27 };
	const dates: [unknown, [number, number, number] | null][] = [
		["27/09/2020", [2020, 9, 27]],
		["2019-09-27", [2019, 9, 27]],
		["27-09-2018", [2018, 9, 27]],
		[" 7/9/2021 ", [2021, 9, 7]],
		["", null],
		["abc", null],
		["31/13/2020", null],
		[null, null],
		[20200927, null],
	];
	for (const [raw, want] of dates) {
		const a = dk.parseDikshaDate(raw);
		const b = fnDiksha.parseDikshaDate(raw);
		const got = a ? [a.y, a.m, a.d] : null;
		check(
			JSON.stringify(got) === JSON.stringify(want),
			`parse(${JSON.stringify(raw)}) = ${JSON.stringify(got)}`,
		);
		check(
			JSON.stringify(a) === JSON.stringify(b),
			`parse same in both (${raw})`,
		);
	}
	const years = (v: string, t = today) =>
		dk.anniversaryYears(dk.parseDikshaDate(v), t);
	check(years("27/09/2020") === 6, "6 years");
	check(
		years("27/09/2026") === 0,
		"diksha today (same year) is not an anniversary",
	);
	check(years("28/09/2020") === 0, "other day");
	check(
		years("29/02/2020", { y: 2027, m: 2, d: 28 }) === 7,
		"29 Feb on 28 Feb",
	);
	check(years("29/02/2020", { y: 2028, m: 2, d: 28 }) === 0, "leap year waits");
	check(
		years("29/02/2020", { y: 2028, m: 2, d: 29 }) === 8,
		"29 Feb in leap year",
	);
	check(
		JSON.stringify(dk.istToday(Date.UTC(2026, 8, 26, 19, 0))) ===
			JSON.stringify({ y: 2026, m: 9, d: 27, id: "2026-09-27" }),
		"19:00 UTC is already the next day in India",
	);
	check(
		dk.istToday(Date.UTC(2026, 0, 1, 12)).id ===
			fnDiksha.istToday(Date.UTC(2026, 0, 1, 12)).id,
		"istToday same in both",
	);
	const list = fnDiksha.buildAnniversaryList(
		[
			{ isApproved: true, realName: "Asha", dikshaDate: "27/09/2020" },
			{
				isApproved: true,
				realName: "Bala",
				dikshaDate: "2010-09-27",
				phoneNumber: "+919999999999",
				email: "b@x.com",
			},
			{ isApproved: false, realName: "Chitra", dikshaDate: "27/09/2020" },
			{
				isApproved: true,
				isDeleted: true,
				realName: "Dev",
				dikshaDate: "27/09/2020",
			},
			{
				isApproved: true,
				isAspiring: true,
				realName: "Esha",
				dikshaDate: "27/09/2020",
			},
			{ isApproved: true, realName: "Farah", dikshaDate: "26/09/2020" },
		],
		today,
	);
	check(
		JSON.stringify(list.map((x) => `${x.name}:${x.years}`)) ===
			JSON.stringify(["Bala:16", "Asha:6"]),
		`approved, active, today only, most years first (${list.map((x) => x.name)})`,
	);
	check(
		list.every(
			(x) => !("phoneNumber" in x) && !("email" in x) && !("uid" in x),
		),
		"no phone, email or id in the public list",
	);
}

console.log("8. Gender suggestions for the admin screen");
{
	const g = (
		p: { realName?: string; dikshaName?: string },
		rels: string[] = [],
	) => guessGender(p, rels)?.gender ?? null;
	check(g({ dikshaName: "राधा दासी" }) === "female", "दासी → female");
	check(g({ dikshaName: "Damodar Das" }) === "male", "Das → male");
	check(g({ dikshaName: "Vishakha Dasi" }) === "female", "Dasi → female");
	check(g({ realName: "Sunita Devi" }) === "female", "Devi → female");
	check(g({ realName: "Rahul Kumar Sharma" }) === "male", "Kumar → male");
	check(
		g({ realName: "Asha Kumari" }) === "female",
		"Kumari → female, not Kumar",
	);
	check(
		g({ realName: "Damodar Shrivastava" }) === null,
		"no guess from a plain name",
	);
	check(g({}, ["sister", "bua"]) === "female", "family agree: female");
	check(
		g({ dikshaName: "Radha Dasi" }, ["brother"]) === "male",
		"family relation beats the name",
	);
	check(
		g({ dikshaName: "Radha Dasi" }, ["brother", "sister"]) === "female",
		"family disagree → fall back to the name",
	);
	check(g({}, ["cousin"]) === null, "a relation with no gender says nothing");
}

console.log("9. Double entries: hand-added vs linked");
{
	const linked = [
		{
			id: "L1",
			realName: "Vishakha Shrivastava",
			dikshaName: "Vishakha Dasi",
			dikshaDate: "10/07/2020",
		},
		{ id: "L2", realName: "Ram Prasad", dikshaDate: "01/01/2015" },
		{
			id: "L3",
			realName: "Mohan",
			dikshaName: "Madhav Das",
			dikshaDate: "05/05/2019",
		},
		{ id: "L4", realName: "Shyam" },
		{ id: "L5", realName: "Shyam" },
	];
	const mine = { L2: "cousin" };
	const twin = (m: Parameters<typeof findLinkedTwin>[0]) =>
		findLinkedTwin(m, linked, mine)?.id ?? null;
	check(
		twin({ id: "a", realName: "vishakha  shrivastava" }) === "L1",
		"same name (case, spaces)",
	);
	check(
		twin({
			id: "b",
			realName: "V. S.",
			dikshaName: "Vishakha Dasi",
			dikshaDate: "10/07/2020",
		}) === "L1",
		"same diksha name and date",
	);
	check(
		twin({ id: "c", realName: "Other", dikshaName: "Madhav Das" }) === null,
		"diksha name alone is not enough",
	);
	check(
		twin({
			id: "d",
			realName: "Vishakha Shrivastava",
			dikshaDate: "11/11/2011",
		}) === null,
		"different diksha dates = different people",
	);
	check(
		twin({
			id: "e",
			realName: "Ram Prasad",
			relation: "grandfather_paternal",
		}) === null,
		"grandfather Ram is not cousin Ram",
	);
	check(
		twin({ id: "f", realName: "Ram Prasad", relation: "brother" }) === "L2",
		"same generation, same name",
	);
	check(
		twin({ id: "g", realName: "Shyam" }) === null,
		"two linked Shyams — no guess",
	);
	check(twin({ id: "h", realName: "" }) === null, "empty name");

	const rep = repeatedHandAddedIds([
		{ id: "1", realName: "Ramesh" },
		{ id: "2", realName: " ramesh " },
		{ id: "3", realName: "Suresh", dikshaDate: "01/01/2000" },
		{ id: "4", realName: "Suresh", dikshaDate: "02/02/2002" },
	]);
	check(
		JSON.stringify([...rep]) === JSON.stringify(["2"]),
		`second Ramesh repeated; two Sureshes with different dates are not (${[...rep]})`,
	);
}

console.log("10. Relation search: Hindi, English, Hinglish, across scripts");
{
	const first = (q: string, g?: "male" | "female") =>
		searchRelations(q, g)[0]?.id ?? null;
	const has = (q: string, id: string) =>
		searchRelations(q).some((o) => o.id === id);
	const cases: [string, string][] = [
		["mausi", "mausi"],
		["मौसी", "mausi"],
		["masi", "mausi"],
		["maa ki behen", "mausi"],
		["माँ की बहन", "mausi"],
		["mother's sister", "mausi"],
		["papa", "father"],
		["पापा", "father"],
		["father", "father"],
		["पिता", "father"],
		["maa", "mother"],
		["माँ", "mother"],
		["behen", "sister"],
		["didi", "sister"],
		["jija ji", "jija"],
		["jijaji", "jija"],
		["जीजा", "jija"],
		["sasur", "father_in_law"],
		["bahu", "daughter_in_law"],
		["बहू", "daughter_in_law"],
		["tauji", "tau"],
		["bade papa", "tau"],
		["dadi", "grandmother_paternal"],
		["nani", "grandmother_maternal"],
		["damad", "son_in_law"],
		["fufa", "phupha"],
		["mausera", "mausera_bhai"],
		["devar", "devar"],
		["naati ki bahu", "nat_bahu"],
		["नात-बहू", "nat_bahu"],
		["pote ki bahu", "pot_bahu"],
		["dadi saas", "dadi_saas"],
		["नानी सास", "nani_saas"],
		["bhanje ki bahu", "bhanj_bahu"],
		["chachiya sasur", "uncle_in_law"],
	];
	for (const [q, want] of cases) {
		const got = first(q);
		check(got === want, `search "${q}" → ${got}, want ${want}`);
	}
	check(
		has("aunt", "mausi") && has("aunt", "bua"),
		"English 'aunt' finds mausi and bua",
	);
	check(
		["jija", "sala", "devar", "father_in_law"].every((id) => has("in law", id)),
		"'in law' finds the in-laws",
	);
	check(searchRelations("xyzqw").length === 0, "nonsense finds nothing");
	check(searchRelations("").length === 0, "empty finds nothing");
	check(
		searchRelations("aunt", "male").length === 0,
		"male filter drops aunts",
	);
	check(first("bhai", "female") !== "brother", "female filter drops brother");
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

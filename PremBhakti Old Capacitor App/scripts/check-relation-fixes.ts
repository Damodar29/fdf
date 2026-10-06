// Admin "Fix relations" (utils/relationFixes.ts). Run with `npm run test:devotees`.
import { findRelationFixes, type RelProfile } from "../utils/relationFixes";

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (cond) console.log(`  PASS ${msg}`);
	else {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

const link = (a: RelProfile, b: RelProfile, ab = "", ba = "") => {
	a.linkedFamilyMembers = [...(a.linkedFamilyMembers || []), b.uid];
	b.linkedFamilyMembers = [...(b.linkedFamilyMembers || []), a.uid];
	if (ab) a.linkedFamilyRelations = { ...a.linkedFamilyRelations, [b.uid]: ab };
	if (ba) b.linkedFamilyRelations = { ...b.linkedFamilyRelations, [a.uid]: ba };
};

console.log("1. Daughter + mother's gender ⇒ mother (certain)");
{
	const mom: RelProfile = { uid: "mom", gender: "female" };
	const girl: RelProfile = { uid: "girl" };
	link(mom, girl, "daughter");
	const fixes = findRelationFixes([mom, girl]);
	const fill = fixes.find((f) => f.kind === "fill");
	check(
		fill?.kind === "fill" &&
			fill.write.owner === "girl" &&
			fill.write.other === "mom" &&
			fill.write.value === "mother",
		`girl's relation for mom = mother (${JSON.stringify(fill)})`,
	);
	const g = fixes.find((f) => f.kind === "gender");
	check(
		g?.kind === "gender" && g.uid === "girl" && g.gender === "female",
		"girl's gender: female",
	);
}

console.log("2. Sister, but the one who set it has no gender ⇒ ask the gender");
{
	const a: RelProfile = { uid: "a" };
	const b: RelProfile = { uid: "b", gender: "female" };
	const c: RelProfile = { uid: "c" };
	link(a, b, "sister");
	link(c, a, "brother"); // someone calls a "brother" ⇒ a is probably male
	const fixes = findRelationFixes([a, b, c]);
	const need = fixes.find((f) => f.kind === "needGender" && f.uid === "a");
	check(
		need?.kind === "needGender" &&
			need.ifMale === "brother" &&
			need.ifFemale === "sister",
		"male → brother, female → sister",
	);
	check(
		need?.kind === "needGender" && need.hint === "male",
		"hint from the family: male",
	);
	check(
		!fixes.some((f) => f.kind === "fill" && f.from === "a"),
		"nothing filled on a guess",
	);
}

console.log("3. Several answers ⇒ choose");
{
	const uncle: RelProfile = { uid: "u", gender: "male" };
	const boy: RelProfile = { uid: "boy", gender: "male" };
	link(uncle, boy, "bhatija");
	const fixes = findRelationFixes([uncle, boy]);
	const ch = fixes.find((f) => f.kind === "choose");
	check(
		ch?.kind === "choose" && ch.options.join() === "chacha,tau",
		`options: ${ch?.kind === "choose" ? ch.options.join() : "-"}`,
	);
}

console.log("4. Both sides set and wrong ⇒ conflict");
{
	const a: RelProfile = { uid: "a", gender: "male" };
	const b: RelProfile = { uid: "b", gender: "male" };
	link(a, b, "father", "father");
	const fixes = findRelationFixes([a, b]);
	check(
		fixes.some((f) => f.kind === "conflict" && f.reason === "both_sides"),
		"both say father",
	);
	const c: RelProfile = { uid: "c", gender: "male" };
	const d: RelProfile = { uid: "d", gender: "male" };
	link(c, d, "father", "son");
	check(
		!findRelationFixes([c, d]).some((f) => f.kind === "conflict"),
		"father / son fits",
	);
}

console.log("5. Relation contradicts a set gender ⇒ conflict");
{
	const a: RelProfile = { uid: "a", gender: "female" };
	const b: RelProfile = { uid: "b", gender: "male" };
	link(a, b, "daughter");
	const fixes = findRelationFixes([a, b]);
	check(
		fixes.some(
			(f) =>
				f.kind === "conflict" && f.reason === "gender" && f.genderOf === "b",
		),
		"called daughter but set as male",
	);
	check(
		!fixes.some((f) => f.kind === "fill"),
		"nothing filled from a contradiction",
	);
}

console.log("6. Neither side set ⇒ through a common relative");
{
	const mom: RelProfile = { uid: "mom", gender: "female" };
	const s1: RelProfile = { uid: "s1", gender: "male" };
	const s2: RelProfile = { uid: "s2", gender: "female" };
	link(s1, mom, "mother", "son");
	link(s2, mom, "mother", "daughter");
	link(s1, s2);
	const fixes = findRelationFixes([mom, s1, s2]);
	const chain = fixes.find((f) => f.kind === "chain");
	check(
		chain?.kind === "chain" &&
			chain.via === "mom" &&
			chain.options.length === 1,
		`one likely answer (${chain?.kind === "chain" ? `${chain.owner}→${chain.other}: ${chain.options}` : "-"})`,
	);
}

console.log("7. Family disagrees about someone's gender");
{
	const a: RelProfile = { uid: "a" };
	const b: RelProfile = { uid: "b" };
	const x: RelProfile = { uid: "x" };
	link(a, x, "son");
	link(b, x, "daughter");
	check(
		findRelationFixes([a, b, x]).some(
			(f) => f.kind === "mixedGender" && f.uid === "x",
		),
		"son and daughter",
	);
}

console.log("8. Removed accounts and one-sided links are left alone");
{
	const a: RelProfile = { uid: "a", gender: "female" };
	const b: RelProfile = { uid: "b", isDeleted: true };
	link(a, b, "daughter");
	check(findRelationFixes([a, b]).length === 0, "deleted account skipped");
	const c: RelProfile = {
		uid: "c",
		gender: "female",
		linkedFamilyMembers: ["d"],
		linkedFamilyRelations: { d: "daughter" },
	};
	const d: RelProfile = { uid: "d" };
	check(findRelationFixes([c, d]).length === 0, "one-sided link skipped");
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

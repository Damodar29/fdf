// Family Explorer numbers (utils/familyNetwork.ts): family groups, one-way
// links, hand-added doubles and the tree built for one devotee. Part of
// `npm run test:devotees`.
import {
	buildFamilyNetwork,
	familyTreeFor,
	type NetworkProfile,
	packRows,
} from "../utils/familyNetwork";
import {
	diffFamily,
	parseFamilySummary,
	summarizeFamily,
} from "../utils/familyChangeSummary";

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (!cond) {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

const profiles: NetworkProfile[] = [
	// Family 1: A–B–C, A–C missing (old link), B has a relation for A.
	{
		uid: "a",
		realName: "Ramesh",
		mandalId: "jhansi",
		linkedFamilyMembers: ["b"],
		gender: "male",
	},
	{
		uid: "b",
		realName: "Suresh",
		mandalId: "jhansi",
		linkedFamilyMembers: ["a", "c"],
		linkedFamilyRelations: { a: "father" },
		familyMembers: [
			// Double of linked "Ramesh" — not counted twice.
			{ id: "m1", realName: "Ramesh", relation: "father" },
			{ id: "m2", realName: "Dadi" },
			{ id: "m3", realName: "Dadi" }, // repeated
		],
	},
	{
		uid: "c",
		realName: "Geeta",
		mandalId: "indore",
		linkedFamilyMembers: ["b"],
		linkedFamilyVia: { b: "x" },
	},
	// Family 2: D–E.
	{ uid: "d", realName: "Mohan", linkedFamilyMembers: ["e"] },
	{ uid: "e", realName: "Sohan", linkedFamilyMembers: ["d"] },
	// One-way link F → A.
	{ uid: "f", realName: "Lone", linkedFamilyMembers: ["a"] },
	// Alone with a hand-added member.
	{
		uid: "g",
		realName: "Solo",
		familyMembers: [{ id: "x1", realName: "Maa" }],
	},
	// Deleted: ignored everywhere.
	{ uid: "h", realName: "Gone", isDeleted: true, linkedFamilyMembers: ["d"] },
];

const net = buildFamilyNetwork(profiles);
check(net.groups.length === 2, `2 groups (got ${net.groups.length})`);
const [big, small] = net.groups;
check(big.members.length === 3, "biggest group first, 3 accounts");
check(big.members[0] === "b", "best-connected member first");
check(big.missingPairs === 1, `A–C missing (got ${big.missingPairs})`);
check(
	big.handAdded === 1,
	`hand-added doubles left out (got ${big.handAdded})`,
);
check(big.relationsSet === 1 && big.relationsTotal === 4, "relations 1 of 4");
check(
	big.edges.some((e) => e.auto),
	"auto link marked",
);
check(big.mandals[0] === "jhansi" && big.mandals.length === 2, "mandals");
check(small.members.length === 2, "second group");
check(net.connected === 5, `5 connected (got ${net.connected})`);
check(net.accounts === 7, `7 accounts (got ${net.accounts})`);
check(net.oneWayLinks.length === 1, "one-way link F → A");
check(net.soloWithFamily.join() === "g", "solo with hand-added family");
check(net.handAddedTotal === 2, `hand-added total (got ${net.handAddedTotal})`);
check(net.largest === 3, "largest");
check(net.crossMandal === 1, "one cross-mandal family");
check(
	net.sizeBuckets.find((b) => b.label === "2")?.count === 1 &&
		net.sizeBuckets.find((b) => b.label === "3")?.count === 1,
	"size buckets",
);

const byUid = new Map(profiles.map((p) => [p.uid, p]));
const tree = familyTreeFor("b", byUid);
check(tree.me.name === "Suresh", "tree centre");
check(
	tree.people.filter((p) => p.name === "Ramesh").length === 1,
	"linked + hand-added double shown once",
);
check(
	tree.people.find((p) => p.key === "l_a")?.relation === "father",
	"relation set by the centre",
);
check(tree.people.filter((p) => p.name === "Dadi").length === 1, "repeat once");
check(
	familyTreeFor("c", byUid).people.find((p) => p.key === "l_b")?.via === "l_x",
	"via marker kept",
);

const packed = packRows([30, 20, 20, 10], 100, 4);
check(packed.centres.length === 4, "all circles placed");
check(
	packed.centres.every((c, i) => c.x - [30, 20, 20, 10][i] >= 0),
	"inside the width",
);

// Family changes in the edit history
const before = summarizeFamily([
	{ id: "1", realName: "Kamla", relation: "mother" },
	{ id: "2", realName: "Chhotu" },
]);
const after = summarizeFamily([
	{ id: "1", realName: "Kamla", relation: "grandmother", photoURL: "x" },
	{ id: "3", realName: "Guddi" },
]);
const fam = diffFamily(
	parseFamilySummary(before) || [],
	parseFamilySummary(after) || [],
);
check(fam.added.map((m) => m.n).join() === "Guddi", "family: added");
check(fam.removed.map((m) => m.n).join() === "Chhotu", "family: removed");
check(
	fam.changed.length === 1 && fam.changed[0].fields.join() === "r,p",
	"family: relation and photo changed",
);
check(parseFamilySummary("...") === null, "family: old records are not parsed");

if (failures) {
	console.log(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("All family network checks passed");

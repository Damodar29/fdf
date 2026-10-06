// Bhajan search checks on the real bhajans in data/bhajans: known searches
// find the right bhajan, and typing stays fast. Run with `npm run test:search`.
import fs from "node:fs";
import path from "node:path";
import type { Bhajan } from "../types";
import {
	calculateSearchScore,
	getMatchingSnippet,
	parseRawBhajanText,
} from "../utils/textProcessor";

let failures = 0;
const check = (cond: boolean, msg: string) => {
	if (!cond) {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

const dir = path.join(process.cwd(), "data", "bhajans");
const entries = fs
	.readdirSync(dir)
	.filter((f) => /^\d+\.json$/.test(f))
	.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const bhajans = parseRawBhajanText(entries);

const search = (q: string, script: "devanagari" | "iast" = "devanagari") =>
	bhajans
		.map((b) => ({ b, s: calculateSearchScore(b, q, script) }))
		.filter((x) => x.s > 0)
		.sort((a, b) => b.s - a.s)
		.map((x) => x.b);

const find = (pred: (b: Bhajan) => boolean) => bhajans.find(pred);
const first = bhajans.find((b) => b.songNumber === "001");

console.log(`1. Finds bhajans (${bhajans.length} loaded)`);
check(bhajans.length > 400, "bhajans loaded");
if (first) {
	check(search("001")[0]?.id === first.id, "song number 001 first");
	check(search("1")[0]?.id === first.id, "number 1 finds 001 first");
	check(
		search(first.title)[0]?.id === first.id,
		`own title "${first.title}" first`,
	);
	check(
		search(first.titleIAST, "iast")[0]?.id === first.id,
		"IAST title first (IAST script)",
	);
}
// A Devanagari title typed in Hinglish finds it near the top.
const withTitle = find(
	(b) => b.title.includes("गोविन्द") || b.title.includes("गोविंद"),
);
if (withTitle) {
	check(
		search("govind")
			.slice(0, 10)
			.some((b) => b.id === withTitle.id),
		`"govind" finds "${withTitle.title}" in the top 10`,
	);
}
const bahan = find((b) => b.content.includes("बहन"));
if (bahan) {
	check(
		search("behen").some((b) => b.id === bahan.id),
		'Hinglish "behen" finds a bhajan with बहन',
	);
	check(
		getMatchingSnippet(bahan, "behen", "devanagari") !== null,
		'"behen" shows the matching line',
	);
}
check(search("").length === 0, "empty search finds nothing");

console.log("2. Typing stays fast");
{
	const typed = ["radhe shyam", "govind", "krishna chaitanya", "गौर"].flatMap(
		(q) => Array.from({ length: q.length }, (_, i) => q.slice(0, i + 1)),
	);
	const t = performance.now();
	for (const q of typed)
		for (const b of bhajans) calculateSearchScore(b, q, "devanagari");
	const perKey = (performance.now() - t) / typed.length;
	console.log(
		`  ${perKey.toFixed(1)} ms per keystroke over ${bhajans.length} bhajans`,
	);
	// Generous: a desktop does this in ~8 ms; this only catches a big slowdown.
	check(perKey < 60, `per keystroke ${perKey.toFixed(1)} ms < 60 ms`);
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

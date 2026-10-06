#!/usr/bin/env node
/**
 * Backup of the app's content JSON from Firebase Storage into the repo.
 *
 *   npm run backup:data            download, verify, then replace the local backup
 *   npm run backup:data -- --dry-run   download + verify only, change nothing
 *   npm run backup:data -- --force     allow replacing even if Storage has far fewer files
 *
 * Firebase Storage (app-data/<tag>/*.json)  →  data/<folder>/*.json
 *   bhajandata  → data/bhajans
 *   lecturedata → data/lectures
 *   bookdata    → data/books
 * Every individual item file plus index.json and bundle.json.
 *
 * Safety (the backup is the only copy that survives a Storage mistake):
 *  - Firebase is only READ. Nothing is written or deleted there.
 *  - Everything is downloaded into data/.backup-tmp first and checked:
 *    size + MD5 match Storage's metadata, every file parses as JSON,
 *    index.json and bundle.json exist, and the file count did not collapse
 *    (>20% fewer files than the current backup aborts unless --force).
 *  - Only if ALL three categories pass are the folders swapped in. Until then
 *    the existing backup is untouched; a failed swap is rolled back.
 *  - Files are written byte-for-byte (Hindi text untouched); .gitattributes
 *    keeps git from rewriting their line endings.
 *
 * These folders are never imported by app code, so they are not part of the
 * Vite build (dist/), the APK or OTA bundles.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// BACKUP_DATA_DIR only exists to test the safety paths against a scratch folder.
const DATA_DIR = process.env.BACKUP_DATA_DIR
	? path.resolve(process.env.BACKUP_DATA_DIR)
	: path.join(ROOT, "data");
const TMP_DIR = path.join(DATA_DIR, ".backup-tmp");
const BUCKET =
	process.env.VITE_FIREBASE_STORAGE_BUCKET || "cpbs-admin.firebasestorage.app";
const API = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;

const CATEGORIES = [
	{ tag: "bhajandata", folder: "bhajans" },
	{ tag: "lecturedata", folder: "lectures" },
	{ tag: "bookdata", folder: "books" },
];
const REQUIRED_FILES = ["index.json", "bundle.json"];
const MAX_DROP_RATIO = 0.2; // abort if >20% fewer files than the current backup
const CONCURRENCY = 8;
const ATTEMPTS = 4;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const FORCE = args.has("--force");

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with retries (network blips, 429/5xx). Returns a Response with ok=true. */
async function fetchRetry(url, what) {
	let lastErr;
	for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
			if (res.ok) return res;
			lastErr = new Error(`${what}: HTTP ${res.status}`);
			if (res.status < 500 && res.status !== 429) break; // 4xx won't fix itself
		} catch (e) {
			lastErr = new Error(`${what}: ${e.message}`);
		}
		if (attempt < ATTEMPTS) await sleep(1000 * attempt);
	}
	throw lastErr;
}

/** All object names directly under app-data/<tag>/ (handles pagination). */
async function listObjects(tag) {
	const prefix = `app-data/${tag}/`;
	const names = [];
	let pageToken = "";
	do {
		const url = `${API}?prefix=${encodeURIComponent(prefix)}&maxResults=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
		const data = await (await fetchRetry(url, `list ${tag}`)).json();
		for (const item of data.items ?? []) names.push(item.name);
		pageToken = data.nextPageToken ?? "";
	} while (pageToken);
	return { prefix, names };
}

/** Download one object and verify it against Storage's own size + MD5. */
async function downloadVerified(objectName) {
	const enc = encodeURIComponent(objectName);
	const meta = await (await fetchRetry(`${API}/${enc}`, `metadata ${objectName}`)).json();
	let lastErr;
	for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
		try {
			const res = await fetchRetry(`${API}/${enc}?alt=media`, `download ${objectName}`);
			const buf = Buffer.from(await res.arrayBuffer());
			if (String(buf.length) !== String(meta.size)) {
				throw new Error(`size ${buf.length} ≠ Storage ${meta.size}`);
			}
			if (meta.md5Hash) {
				const md5 = createHash("md5").update(buf).digest("base64");
				if (md5 !== meta.md5Hash) throw new Error("MD5 mismatch");
			}
			JSON.parse(buf.toString("utf8")); // must be valid JSON
			return buf;
		} catch (e) {
			lastErr = new Error(`${objectName}: ${e.message}`);
			if (attempt < ATTEMPTS) await sleep(1000 * attempt);
		}
	}
	throw lastErr;
}

async function mapLimit(items, limit, fn) {
	const results = new Array(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			results[i] = await fn(items[i], i);
		}
	});
	await Promise.all(workers);
	return results;
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

async function readDirHashes(dir) {
	const map = new Map();
	if (!existsSync(dir)) return map;
	for (const name of await fs.readdir(dir)) {
		if (!name.endsWith(".json")) continue;
		map.set(name, sha(await fs.readFile(path.join(dir, name))));
	}
	return map;
}

/** fs.rename with retries — OneDrive / antivirus briefly lock freshly written files on Windows. */
async function renameRetry(from, to) {
	let lastErr;
	for (let attempt = 1; attempt <= 10; attempt++) {
		try {
			await fs.rename(from, to);
			return;
		} catch (e) {
			lastErr = e;
			await sleep(500 * attempt);
		}
	}
	throw lastErr;
}

async function stageCategory({ tag, folder }, runDir) {
	const { prefix, names } = await listObjects(tag);
	const direct = names.filter((n) => !n.slice(prefix.length).includes("/"));
	const jsonNames = direct.filter((n) => n.endsWith(".json"));
	const skipped = direct.filter((n) => !n.endsWith(".json"));
	const nested = names.length - direct.length;

	const problems = [];
	if (jsonNames.length === 0) problems.push("Storage returned no JSON files");
	for (const req of REQUIRED_FILES) {
		if (!jsonNames.includes(prefix + req)) problems.push(`${req} missing in Storage`);
	}

	const stageDir = path.join(runDir, folder);
	await fs.mkdir(stageDir, { recursive: true });
	let done = 0;
	const failures = [];
	await mapLimit(jsonNames, CONCURRENCY, async (objectName) => {
		const fileName = objectName.slice(prefix.length);
		try {
			const buf = await downloadVerified(objectName);
			await fs.writeFile(path.join(stageDir, fileName), buf);
		} catch (e) {
			failures.push(e.message);
		}
		done++;
		if (done % 50 === 0 || done === jsonNames.length) {
			process.stdout.write(`\r  ${folder}: ${done}/${jsonNames.length} downloaded`);
		}
	});
	if (jsonNames.length) process.stdout.write("\n");
	if (failures.length) {
		problems.push(`${failures.length} file(s) failed after ${ATTEMPTS} attempts:\n      ${failures.slice(0, 10).join("\n      ")}`);
	}

	// Every staged file must be present (defends against partial writes).
	const staged = new Set((await fs.readdir(stageDir)).filter((n) => n.endsWith(".json")));
	if (!failures.length && staged.size !== jsonNames.length) {
		problems.push(`staged ${staged.size} files, expected ${jsonNames.length}`);
	}

	// bundle.json must be a list of items (or { <key>: [...] }).
	const bundlePath = path.join(stageDir, "bundle.json");
	if (existsSync(bundlePath)) {
		const bundle = JSON.parse(await fs.readFile(bundlePath, "utf8"));
		const arr = Array.isArray(bundle) ? bundle : Object.values(bundle).find(Array.isArray);
		if (!Array.isArray(arr) || arr.length === 0) problems.push("bundle.json has no items");
	}

	// Refuse to replace a good backup with a much smaller one.
	const oldHashes = await readDirHashes(path.join(DATA_DIR, folder));
	if (oldHashes.size > 0 && staged.size < oldHashes.size * (1 - MAX_DROP_RATIO) && !FORCE) {
		problems.push(`only ${staged.size} files vs ${oldHashes.size} in the current backup (>${MAX_DROP_RATIO * 100}% drop). Check Storage; re-run with --force if this is intended.`);
	}

	// Diff against the current backup for the report.
	const newHashes = await readDirHashes(stageDir);
	const added = [...newHashes.keys()].filter((n) => !oldHashes.has(n));
	const removed = [...oldHashes.keys()].filter((n) => !newHashes.has(n));
	const changed = [...newHashes.keys()].filter((n) => oldHashes.has(n) && oldHashes.get(n) !== newHashes.get(n));

	return { folder, tag, stageDir, count: staged.size, skipped, nested, problems, added, removed, changed };
}

/**
 * A previous run killed mid-swap can leave data/<folder> missing with the old
 * copy parked in data/.backup-tmp/run-*\/old-<folder>. Put it back first.
 */
async function recoverInterruptedRuns() {
	if (!existsSync(TMP_DIR)) return;
	for (const run of await fs.readdir(TMP_DIR)) {
		const runPath = path.join(TMP_DIR, run);
		for (const { folder } of CATEGORIES) {
			const aside = path.join(runPath, `old-${folder}`);
			const target = path.join(DATA_DIR, folder);
			if (existsSync(aside) && !existsSync(target)) {
				await renameRetry(aside, target);
				log(`↺ Restored data/${folder} from an interrupted earlier run.`);
			}
		}
		await fs.rm(runPath, { recursive: true, force: true });
	}
}

async function main() {
	log(`Firebase Storage backup  (bucket: ${BUCKET})${DRY_RUN ? "  [dry run]" : ""}${FORCE ? "  [--force]" : ""}\n`);
	await recoverInterruptedRuns();
	const runDir = path.join(TMP_DIR, `run-${Date.now()}`);
	await fs.mkdir(runDir, { recursive: true });

	let results;
	try {
		results = [];
		for (const cat of CATEGORIES) {
			log(`▶ ${cat.tag} → data/${cat.folder}`);
			results.push(await stageCategory(cat, runDir));
		}
	} catch (e) {
		log(`\n✖ Failed while downloading: ${e.message}\n  Nothing was changed.`);
		await fs.rm(runDir, { recursive: true, force: true });
		process.exitCode = 1;
		return;
	}

	log("\nSummary:");
	for (const r of results) {
		log(`  data/${r.folder}: ${r.count} files  (+${r.added.length} new, ~${r.changed.length} changed, -${r.removed.length} removed)`);
		if (r.removed.length) log(`      removed (no longer in Storage): ${r.removed.slice(0, 15).join(", ")}${r.removed.length > 15 ? ", …" : ""}`);
		if (r.skipped.length) log(`      ignored non-JSON files: ${r.skipped.length}`);
		if (r.nested) log(`      ignored files in sub-folders: ${r.nested}`);
		for (const p of r.problems) log(`  ✖ ${p}`);
	}

	const failed = results.filter((r) => r.problems.length);
	if (failed.length) {
		log(`\n✖ ${failed.length} categor${failed.length === 1 ? "y" : "ies"} failed verification — the existing backup was NOT touched.`);
		await fs.rm(runDir, { recursive: true, force: true });
		process.exitCode = 1;
		return;
	}
	if (DRY_RUN) {
		log("\n✔ Dry run: everything downloaded and verified. Nothing was replaced.");
		await fs.rm(runDir, { recursive: true, force: true });
		return;
	}

	// All verified: swap each folder in. Old copy is moved aside first so a
	// failed swap can be rolled back; it is deleted only after the new one is in place.
	for (const r of results) {
		const target = path.join(DATA_DIR, r.folder);
		const aside = path.join(runDir, `old-${r.folder}`);
		const hadOld = existsSync(target);
		if (hadOld) await renameRetry(target, aside);
		try {
			await renameRetry(r.stageDir, target);
		} catch (e) {
			if (hadOld) await renameRetry(aside, target).catch(() => {});
			log(`\n✖ Could not move the new data/${r.folder} into place (${e.message}).`);
			if (hadOld) log(`  The previous data/${r.folder} was restored.`);
			log("  Folders already replaced before this one are complete and verified.");
			log("  Re-run the script to finish.");
			process.exitCode = 1;
			return;
		}
	}
	await fs.rm(runDir, { recursive: true, force: true });
	await fs.rmdir(TMP_DIR).catch(() => {}); // only if empty

	log("\n✔ Backup updated. Review with `git status` and commit it.");
}

main().catch((e) => {
	console.error(`\n✖ Unexpected error: ${e.stack || e}`);
	console.error("  If data/.backup-tmp exists, the previous backup may be inside it (old-<folder>).");
	process.exitCode = 1;
});

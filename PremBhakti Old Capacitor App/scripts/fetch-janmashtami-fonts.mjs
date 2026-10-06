#!/usr/bin/env node
/**
 * fetch-janmashtami-fonts.mjs
 * ===========================
 *
 * Downloads the typefaces of the Janmashtami design system into `public/fonts/`
 * so the app can ship them and work offline.
 *
 * Only ONE of them is load-bearing today: Comfortaa, which carries every Latin
 * role. The Devanagari pair is required for Hindi content. The four remaining
 * Latin faces (Cinzel, Marcellus, Inter, Cormorant Garamond) are the previous
 * type system, still fetched so it can be restored without a re-download.
 *
 *     node scripts/fetch-janmashtami-fonts.mjs           # fetch what's missing
 *     node scripts/fetch-janmashtami-fonts.mjs --force   # re-download everything
 *     node scripts/fetch-janmashtami-fonts.mjs --check    # validate, download nothing
 *     node scripts/fetch-janmashtami-fonts.mjs --ttf      # prefer full-coverage TTF
 *
 * ── Why this script exists ─────────────────────────────────────────────────
 * This is an offline-first Capacitor app: `fonts.googleapis.com` is unreachable
 * inside the WebView on a device with no connection, so a remote stylesheet
 * would leave every screen in a system fallback. The binaries must be in the
 * bundle. They are not committed to git (they are large, and they are
 * regenerable), so this script is the one-time setup step.
 *
 * ── Why it validates so aggressively ──────────────────────────────────────
 * Before the Janmashtami migration, `public/fonts/` contained eleven files
 * named `*.woff2` that were each a 1.6 KB Google "Error 404 (Not Found)" HTML
 * page. A previous download had failed, written the error body to disk under a
 * font filename, and nobody noticed — the PWA precache glob in
 * `vite.config.ts` then shipped eleven error pages to every install.
 *
 * So: every response is checked for an actual font magic number before it is
 * written, HTTP status is checked, and a suspiciously small payload is
 * rejected. A failure here leaves NO file on disk. `--check` re-runs that same
 * validation against whatever is already there, which makes it safe to wire
 * into a predeploy step.
 *
 * ── Sources, in priority order ────────────────────────────────────────────
 *   1. The Google Fonts CSS2 API, with a modern Chrome User-Agent. Google then
 *      serves woff2 and splits the family into unicode-range subsets; we pick
 *      the subset that actually contains the script we need (basic Latin for
 *      the Latin faces, the Devanagari block for the Hindi faces). These files
 *      are small — typically 15-40 KB.
 *   2. Raw TTFs from the `google/fonts` GitHub repo. Full character coverage
 *      and no subsetting, but 5-20x larger. Several path variants are tried
 *      because upstream reorganises static/variable layouts over time.
 *
 * Because upstream paths do drift, every target carries a LIST of candidates
 * and the script walks it until one yields a valid font. It reports which
 * source won, so a silent downgrade is visible.
 *
 * ── The subset trade-off ──────────────────────────────────────────────────
 * Google's `latin` subset omits Latin Extended-A/B and the rupee sign (U+20B9).
 * That is deliberate and harmless here: `unicode-range` in
 * `public/fonts/fonts.css` only decides whether a file is DOWNLOADED, not
 * whether a glyph exists. A character that is missing from the file still
 * falls through to the next family in the stack, and the stacks in
 * `src/theme/typography.ts` list "Noto Sans Devanagari" — which does carry ₹ —
 * ahead of the system fonts. Pass `--ttf` if you want full coverage from the
 * primary face instead, at the cost of roughly 2 MB of bundle.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(HERE, "..", "public", "fonts");

/** Google serves woff2 + unicode-range only to a UA it believes supports them. */
const MODERN_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const GH = "https://raw.githubusercontent.com/google/fonts/main";
const CSS2 = "https://fonts.googleapis.com/css2";

/**
 * Which unicode-range subset to keep, per target.
 *
 * `latin` means "the block containing U+0041" — i.e. the file with basic Latin,
 * not the `latin-ext` companion, which starts at U+0100 and would give us a
 * font with no ASCII in it.
 */
const SCRIPT_PROBE = {
	latin: 0x0041, // "A"
	devanagari: 0x0915, // "क"
};

/**
 * The files `public/fonts/fonts.css` expects.
 *
 * `name` is the basename without extension and MUST match the `url()` values
 * in fonts.css. `css2` is the query for source 1; `github` is the ordered
 * candidate list for source 2.
 */
const TARGETS = [
	{
		// THE app typeface — carries every Latin role (lockup, titles, headings,
		// body, UI, verse). Must succeed; the four Latin faces after it are now
		// unreferenced by `src/theme/typography.ts` and are fetched only so the
		// previous type system can be restored without a re-download.
		name: "Comfortaa-Variable",
		label: "Comfortaa (everything)",
		script: "latin",
		css2: "family=Comfortaa:wght@300..700",
		github: [
			`${GH}/ofl/comfortaa/Comfortaa%5Bwght%5D.ttf`,
			`${GH}/ofl/comfortaa/static/Comfortaa-Regular.ttf`,
			`${GH}/ofl/comfortaa/Comfortaa-Regular.ttf`,
		],
	},
	{
		name: "Cinzel-Variable",
		label: "Cinzel (display)",
		script: "latin",
		css2: "family=Cinzel:wght@400..900",
		github: [
			`${GH}/ofl/cinzel/Cinzel%5Bwght%5D.ttf`,
			`${GH}/ofl/cinzel/static/Cinzel-Regular.ttf`,
			`${GH}/ofl/cinzel/Cinzel-Regular.ttf`,
		],
	},
	{
		name: "Marcellus-Regular",
		label: "Marcellus (headings)",
		script: "latin",
		css2: "family=Marcellus",
		github: [
			`${GH}/ofl/marcellus/Marcellus-Regular.ttf`,
			`${GH}/ofl/marcellus/static/Marcellus-Regular.ttf`,
		],
	},
	{
		name: "Inter-Variable",
		label: "Inter (body)",
		script: "latin",
		css2: "family=Inter:wght@100..900",
		github: [
			`${GH}/ofl/inter/Inter%5Bopsz,wght%5D.ttf`,
			`${GH}/ofl/inter/Inter%5Bwght%5D.ttf`,
			`${GH}/ofl/inter/static/Inter-Regular.ttf`,
		],
	},
	{
		name: "CormorantGaramond-Regular",
		label: "Cormorant Garamond 400",
		script: "latin",
		css2: "family=Cormorant+Garamond:wght@400",
		github: [
			`${GH}/ofl/cormorantgaramond/static/CormorantGaramond-Regular.ttf`,
			`${GH}/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf`,
			`${GH}/ofl/cormorantgaramond/CormorantGaramond-Regular.ttf`,
		],
	},
	{
		name: "CormorantGaramond-Italic",
		label: "Cormorant Garamond 400 italic",
		script: "latin",
		css2: "family=Cormorant+Garamond:ital,wght@1,400",
		github: [
			`${GH}/ofl/cormorantgaramond/static/CormorantGaramond-Italic.ttf`,
			`${GH}/ofl/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf`,
		],
	},
	{
		name: "CormorantGaramond-SemiBold",
		label: "Cormorant Garamond 600",
		script: "latin",
		css2: "family=Cormorant+Garamond:wght@600",
		github: [
			`${GH}/ofl/cormorantgaramond/static/CormorantGaramond-SemiBold.ttf`,
			`${GH}/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf`,
		],
	},
	{
		name: "NotoSansDevanagari-Variable",
		label: "Noto Sans Devanagari (Hindi body)",
		script: "devanagari",
		css2: "family=Noto+Sans+Devanagari:wght@100..900",
		github: [
			`${GH}/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf`,
			`${GH}/ofl/notosansdevanagari/NotoSansDevanagari%5Bwght%5D.ttf`,
			`${GH}/ofl/notosansdevanagari/static/NotoSansDevanagari-Regular.ttf`,
		],
	},
	{
		name: "NotoSerifDevanagari-Variable",
		label: "Noto Serif Devanagari (Hindi headings)",
		script: "devanagari",
		css2: "family=Noto+Serif+Devanagari:wght@100..900",
		github: [
			`${GH}/ofl/notoserifdevanagari/NotoSerifDevanagari%5Bwdth,wght%5D.ttf`,
			`${GH}/ofl/notoserifdevanagari/NotoSerifDevanagari%5Bwght%5D.ttf`,
			`${GH}/ofl/notoserifdevanagari/static/NotoSerifDevanagari-Regular.ttf`,
		],
	},
];

/* ────────────────────────────── validation ────────────────────────────── */

/**
 * Font magic numbers. This is the check that would have caught the eleven
 * 404-pages-named-.woff2 in the first place.
 */
const MAGIC = [
	{ bytes: [0x77, 0x4f, 0x46, 0x32], ext: "woff2", label: "woff2" }, // wOF2
	{ bytes: [0x77, 0x4f, 0x46, 0x46], ext: "woff", label: "woff" }, // wOFF
	{ bytes: [0x00, 0x01, 0x00, 0x00], ext: "ttf", label: "truetype" },
	{ bytes: [0x74, 0x72, 0x75, 0x65], ext: "ttf", label: "truetype" }, // true
	{ bytes: [0x74, 0x74, 0x63, 0x66], ext: "ttf", label: "collection" }, // ttcf
	{ bytes: [0x4f, 0x54, 0x54, 0x4f], ext: "otf", label: "opentype" }, // OTTO
];

/** Smallest plausible font. Google's 404 body was ~1.6 KB, so this excludes it. */
const MIN_BYTES = 4096;

/**
 * @param {Buffer} buf
 * @returns {{ ok: true, ext: string, label: string } | { ok: false, reason: string }}
 */
function identifyFont(buf) {
	if (buf.length < MIN_BYTES) {
		const head = buf.subarray(0, 64).toString("utf8").replace(/\s+/g, " ");
		return {
			ok: false,
			reason: `only ${buf.length} bytes — not a font. Starts: "${head.slice(0, 48)}"`,
		};
	}
	for (const m of MAGIC) {
		if (m.bytes.every((b, i) => buf[i] === b)) {
			return { ok: true, ext: m.ext, label: m.label };
		}
	}
	const head = buf.subarray(0, 32).toString("utf8").replace(/\s+/g, " ");
	return {
		ok: false,
		reason: `unrecognised magic bytes ${[...buf.subarray(0, 4)]
			.map((b) => b.toString(16).padStart(2, "0"))
			.join(" ")} — looks like "${head.slice(0, 32)}"`,
	};
}

/* ─────────────────────────────── fetching ─────────────────────────────── */

async function get(url, { accept = "*/*" } = {}) {
	const res = await fetch(url, {
		redirect: "follow",
		headers: { "User-Agent": MODERN_UA, Accept: accept },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
	return res;
}

/**
 * Source 1 — resolve a woff2 URL out of the CSS2 API response.
 *
 * A response looks like a run of `@font-face { ... unicode-range: ...; }`
 * blocks, one per subset. We want the block whose range actually covers the
 * script we intend to render, because picking `latin-ext` by accident yields a
 * font with no ASCII.
 */
async function resolveFromGoogleCss(target) {
	const url = `${CSS2}?${target.css2}&display=swap`;
	const css = await (await get(url, { accept: "text/css,*/*" })).text();

	const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
	const probe = SCRIPT_PROBE[target.script];
	const candidates = [];

	for (const block of blocks) {
		const src = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
		if (!src) continue;
		const rangeDecl = block.match(/unicode-range:\s*([^;}]+)/);
		if (!rangeDecl) {
			// No range at all — the file is the whole family. Always acceptable.
			candidates.push({ url: src[1], exact: true });
			continue;
		}
		if (unicodeRangeCovers(rangeDecl[1], probe)) {
			candidates.push({ url: src[1], exact: true });
		}
	}

	if (!candidates.length) {
		// Nothing matched the probe. Rather than fail, take the first woff2 —
		// better a partial face than none — but say so.
		const any = css.match(/url\((https:\/\/[^)]+\.woff2)\)/);
		if (any) return { url: any[1], approximate: true };
		throw new Error("CSS2 response contained no woff2 URL");
	}
	return { url: candidates[0].url, approximate: false };
}

/**
 * Does a CSS `unicode-range` value cover `code`?
 * Handles `U+0-10FFFF`, `U+0900-097F`, `U+20B9`, and `U+09??` wildcard form.
 */
function unicodeRangeCovers(decl, code) {
	for (const raw of decl.split(",")) {
		const tok = raw.trim().replace(/^[Uu]\+/, "");
		if (!tok) continue;
		if (tok.includes("?")) {
			const lo = parseInt(tok.replace(/\?/g, "0"), 16);
			const hi = parseInt(tok.replace(/\?/g, "F"), 16);
			if (code >= lo && code <= hi) return true;
			continue;
		}
		const [a, b] = tok.split("-");
		const lo = parseInt(a, 16);
		const hi = b === undefined ? lo : parseInt(b, 16);
		if (Number.isNaN(lo)) continue;
		if (code >= lo && code <= hi) return true;
	}
	return false;
}

/** Ordered list of things to try for one target. */
function sourcesFor(target, preferTtf) {
	const google = {
		kind: "google-woff2",
		resolve: () => resolveFromGoogleCss(target),
	};
	const github = target.github.map((url) => ({
		kind: "github-ttf",
		resolve: async () => ({ url, approximate: false }),
	}));
	return preferTtf ? [...github, google] : [google, ...github];
}

/* ──────────────────────────────── driver ──────────────────────────────── */

async function existingFile(name) {
	for (const ext of ["woff2", "ttf", "otf", "woff"]) {
		const p = path.join(FONT_DIR, `${name}.${ext}`);
		try {
			const buf = await readFile(p);
			return { path: p, ext, buf };
		} catch {
			/* not this extension */
		}
	}
	return null;
}

async function run() {
	const args = new Set(process.argv.slice(2));
	const force = args.has("--force");
	const checkOnly = args.has("--check");
	const preferTtf = args.has("--ttf");

	await mkdir(FONT_DIR, { recursive: true });

	const rows = [];
	let failures = 0;
	let invalidExisting = 0;

	for (const target of TARGETS) {
		const found = await existingFile(target.name);

		// Anything already on disk gets validated, always. This is how a stale
		// bad download gets caught instead of shipped.
		if (found) {
			const id = identifyFont(found.buf);
			if (!id.ok) {
				invalidExisting++;
				console.error(
					`  ✗ ${path.basename(found.path)} is on disk but INVALID: ${id.reason}`,
				);
				if (checkOnly) {
					rows.push({ t: target, status: "corrupt", detail: id.reason });
					failures++;
					continue;
				}
				// fall through and re-download over it
			} else if (!force) {
				rows.push({
					t: target,
					status: "present",
					detail: `${id.label}, ${kb(found.buf.length)}`,
					file: path.basename(found.path),
				});
				continue;
			}
		} else if (checkOnly) {
			rows.push({ t: target, status: "missing", detail: "not downloaded" });
			failures++;
			continue;
		}

		// ── download ──
		let done = false;
		let lastError = "";
		for (const source of sourcesFor(target, preferTtf)) {
			try {
				const { url, approximate } = await source.resolve();
				const buf = Buffer.from(await (await get(url)).arrayBuffer());
				const id = identifyFont(buf);
				if (!id.ok) throw new Error(id.reason);

				const outPath = path.join(FONT_DIR, `${target.name}.${id.ext}`);
				await writeFile(outPath, buf);
				rows.push({
					t: target,
					status: "downloaded",
					detail: `${id.label}, ${kb(buf.length)}, ${source.kind}${
						approximate ? " (subset approximate)" : ""
					}`,
					file: path.basename(outPath),
					hash: createHash("sha256").update(buf).digest("hex").slice(0, 12),
				});
				done = true;
				break;
			} catch (err) {
				lastError = err instanceof Error ? err.message : String(err);
			}
		}

		if (!done) {
			failures++;
			rows.push({ t: target, status: "failed", detail: lastError });
			console.error(`  ✗ ${target.label}: ${lastError}`);
		}
	}

	report(rows);

	if (invalidExisting && !checkOnly) {
		console.log(
			`\nReplaced ${invalidExisting} invalid file(s) that were already on disk.`,
		);
	}

	if (failures) {
		console.error(
			`\n${failures} of ${TARGETS.length} typefaces unavailable.\n` +
				"The app still runs: every family in src/theme/typography.ts declares a\n" +
				"full fallback chain, so text renders in the platform UI face / Nirmala UI\n" +
				"instead of Comfortaa. Re-run this script from a machine with unrestricted\n" +
				"network access (a corporate proxy blocking fonts.googleapis.com and\n" +
				"raw.githubusercontent.com is the usual cause).\n" +
				"If ONLY Comfortaa failed, nothing in the app renders in its intended\n" +
				"typeface — that one is not optional.",
		);
		process.exitCode = 1;
		return;
	}

	if (!checkOnly) {
		console.log(
			`\nAll ${TARGETS.length} files present. They are matched by the PWA precache glob in\n` +
				"vite.config.ts (woff2) — if any landed as .ttf, add 'ttf' to\n" +
				"workbox.globPatterns so the service worker caches them too.",
		);
	}
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function report(rows) {
	const icon = {
		downloaded: "✓",
		present: "·",
		missing: "✗",
		failed: "✗",
		corrupt: "!",
	};
	const width = Math.max(...rows.map((r) => r.t.label.length));
	console.log(`\n  ${"Typeface".padEnd(width)}  Status`);
	console.log(`  ${"─".repeat(width)}  ${"─".repeat(46)}`);
	for (const r of rows) {
		console.log(
			`${icon[r.status]} ${r.t.label.padEnd(width)}  ${r.status.padEnd(11)} ${r.detail}`,
		);
	}
}

run().catch((err) => {
	console.error("\nfetch-janmashtami-fonts failed outright:", err);
	process.exitCode = 1;
});

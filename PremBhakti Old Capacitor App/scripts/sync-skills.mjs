#!/usr/bin/env node
/**
 * sync-skills.mjs
 * ===============
 *
 * Makes every agent skill usable by every agent in this repo.
 *
 * `.agents/skills/` is the one real copy — Codex, Antigravity (all its models),
 * Gemini CLI and Cursor read it directly. Claude Code only reads
 * `.claude/skills/`, so this script links each skill there (a directory
 * junction on Windows, a symlink elsewhere) and checks every SKILL.md against
 * the Agent Skills format, since Codex skips skills with invalid frontmatter.
 *
 *     node scripts/sync-skills.mjs           # check + link missing skills into .claude/skills
 *     node scripts/sync-skills.mjs --check   # check only, change nothing
 *
 * Existing entries in `.claude/skills/` are never replaced or deleted.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, ".agents", "skills");
const CLAUDE = path.join(ROOT, ".claude", "skills");
const CHECK_ONLY = process.argv.includes("--check");

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;

/** Reads `name` and `description` from YAML frontmatter (plain, quoted, or folded `>`/`|`). */
function readFrontmatter(file) {
	const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
	const match = text.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;
	const lines = match[1].split("\n");
	const fields = {};
	for (let i = 0; i < lines.length; i++) {
		const field = lines[i].match(/^([a-zA-Z-]+):\s*(.*)$/);
		if (!field) continue;
		let value = field[2].trim();
		if (value === "" || /^[>|][-+]?$/.test(value)) {
			const parts = [];
			while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
			value = parts.join(" ");
		}
		fields[field[1]] = value.replace(/^(["'])([\s\S]*)\1$/, "$2");
	}
	return fields;
}

/** Counts SKILL.md files below the skill's own one; Codex lists each as a separate skill. */
function countNested(dir, depth = 0) {
	if (depth > 6) return 0;
	let count = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === ".git") continue;
		const sub = path.join(dir, entry.name);
		if (fs.existsSync(path.join(sub, "SKILL.md"))) count++;
		count += countNested(sub, depth + 1);
	}
	return count;
}

function checkSkill(dir, name) {
	const problems = [];
	const fm = readFrontmatter(path.join(dir, "SKILL.md"));
	if (!fm) return ["no YAML frontmatter"];
	if (!fm.name) problems.push("missing name");
	else {
		if (fm.name !== name) problems.push(`name "${fm.name}" differs from folder "${name}"`);
		if (!NAME_RE.test(fm.name) || fm.name.length > MAX_NAME)
			problems.push(`name "${fm.name}" must be lowercase-hyphen, max ${MAX_NAME} chars`);
	}
	if (!fm.description) problems.push("missing description");
	else if (fm.description.length > MAX_DESCRIPTION)
		problems.push(`description is ${fm.description.length} chars (max ${MAX_DESCRIPTION})`);
	const nested = countNested(dir);
	if (nested) problems.push(`${nested} nested SKILL.md files (each shows up as an extra skill in Codex)`);
	return problems;
}

// Also runs from `npm install` (postinstall), so it must never fail an install.
if (!fs.existsSync(SOURCE)) process.exit(0);

const linked = [];
const warnings = [];
let total = 0;
let descriptionChars = 0;

for (const entry of fs.readdirSync(SOURCE, { withFileTypes: true })) {
	const dir = path.join(SOURCE, entry.name);
	if (!entry.isDirectory() || !fs.existsSync(path.join(dir, "SKILL.md"))) continue;
	total++;
	descriptionChars += (readFrontmatter(path.join(dir, "SKILL.md"))?.description ?? "").length;
	for (const problem of checkSkill(dir, entry.name)) warnings.push(`${entry.name}: ${problem}`);

	const target = path.join(CLAUDE, entry.name);
	let exists = true;
	try {
		fs.lstatSync(target);
	} catch {
		exists = false;
	}
	if (exists || CHECK_ONLY) continue;
	try {
		fs.mkdirSync(CLAUDE, { recursive: true });
		if (process.platform === "win32") fs.symlinkSync(dir, target, "junction");
		else fs.symlinkSync(path.relative(CLAUDE, dir), target, "dir");
		linked.push(entry.name);
	} catch (error) {
		warnings.push(`${entry.name}: could not link into .claude/skills (${error.message})`);
	}
}

console.log(`${total} skills in .agents/skills (${descriptionChars} description chars).`);
if (linked.length) console.log(`Linked into .claude/skills: ${linked.join(", ")}`);
else if (!CHECK_ONLY) console.log("Nothing new to link into .claude/skills.");
if (warnings.length) {
	console.log(`\n${warnings.length} warning(s):`);
	for (const warning of warnings) console.log(`  - ${warning}`);
}

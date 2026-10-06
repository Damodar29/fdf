#!/usr/bin/env node
// Windows-only build fix, safe to run on any OS (no-ops elsewhere).
//
// This repo lives under a long git-worktree path
// (...\.claude\worktrees\<branch>\mobile\...). Native modules that compile
// C++ via CMake/Ninja (react-native-worklets, react-native-nitro-modules,
// and potentially others added later) generate object-file paths under
// node_modules/<pkg>/android/.cxx/... that blow past Windows' ~250-char
// CMAKE_OBJECT_PATH_MAX, failing with "ninja: error: manifest 'build.ninja'
// still dirty after 100 tries".
//
// Fix: redirect each affected module's CMake intermediate build output
// (buildStagingDirectory) to a short path under ~/.rncxx. Not the OS temp
// dir: Windows' temp cleanup deletes files out of it between builds, leaving
// half-empty staging dirs that fail with "cmake_pch.hxx ... missing". Source
// locations, and the build on macOS/Linux/CI, are untouched. This edits
// node_modules directly (like patch-package), so it re-runs on every
// `npm install` via the postinstall hook below.
const fs = require("fs");
const path = require("path");

if (process.platform !== "win32") {
	process.exit(0);
}

const projectRoot = path.resolve(__dirname, "..");
const nodeModules = path.join(projectRoot, "node_modules");

// Some modules have TWO externalNativeBuild.cmake blocks: a per-variant one
// under defaultConfig (arguments/cppFlags/abiFilters — no `buildStagingDirectory`
// property exists there) and the top-level android.externalNativeBuild.cmake
// one (path/version/buildStagingDirectory). The lookahead requires the next
// token to be `path`, which only the top-level block has, so only that one matches.
const CMAKE_BLOCK_RE = /(externalNativeBuild\s*\{\s*cmake\s*\{)(?=\s*path\b)/;
const MARKER = "buildStagingDirectory";
const OLD_STAGING = 'System.getProperty("java.io.tmpdir") + "/rncxx/';
const NEW_STAGING = 'System.getProperty("user.home") + "/.rncxx/';
const WINDOWS_GUARD_START =
	'if (org.apache.tools.ant.taskdefs.condition.Os.isFamily(org.apache.tools.ant.taskdefs.condition.Os.FAMILY_WINDOWS)) {\n';

function candidateGradleFiles() {
	const results = [];
	function scan(dir, depth) {
		if (depth > 3) return;
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const full = path.join(dir, entry.name);
			if (entry.name === "android") {
				for (const name of ["build.gradle", "build.gradle.kts"]) {
					const gradleFile = path.join(full, name);
					if (fs.existsSync(gradleFile)) results.push(gradleFile);
				}
			}
			if (entry.name === "node_modules" || depth < 2) scan(full, depth + 1);
		}
	}
	scan(nodeModules, 0);
	return results;
}

let patchedCount = 0;
for (const file of candidateGradleFiles()) {
	const contents = fs.readFileSync(file, "utf8");
	// Files patched by the earlier temp-dir version move to the stable dir.
	if (contents.includes(OLD_STAGING)) {
		fs.writeFileSync(file, contents.split(OLD_STAGING).join(NEW_STAGING), "utf8");
		patchedCount++;
		continue;
	}
	if (!CMAKE_BLOCK_RE.test(contents)) continue;
	if (contents.includes(MARKER)) continue; // already has an explicit staging dir

	const pkgName = path
		.relative(nodeModules, path.dirname(path.dirname(file)))
		.replace(/[\\/]/g, "_");

	const injection =
		`$1\n` +
		`            ${WINDOWS_GUARD_START}` +
		`                buildStagingDirectory = file(System.getProperty("user.home") + "/.rncxx/${pkgName}")\n` +
		`            }\n`;

	const patched = contents.replace(CMAKE_BLOCK_RE, injection);
	if (patched !== contents) {
		fs.writeFileSync(file, patched, "utf8");
		patchedCount++;
		console.log(`[fix-windows-cxx-paths] patched ${path.relative(projectRoot, file)}`);
	}
}

if (patchedCount > 0) {
	console.log(`[fix-windows-cxx-paths] done (${patchedCount} file(s) patched)`);
}

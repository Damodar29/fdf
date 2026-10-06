// Builds the Capacitor app's web code for the WebView screens (rollout "3B").
//
//   npm run web:build                      (aaaacursor's latest local commit, HEAD)
//   npm run web:build -- <ref>             (a specific commit or branch)
//   npm run web:build -- --working-tree    (include uncommitted edits — only when asked)
//
// The OG repo is only read: `git archive` (or a plain copy for
// --working-tree) puts its files in C:\rn\web-src (outside both repos), the
// build runs there, and its output goes to web-bundle/ in this repo
// (gitignored). The withWebBundle config plugin copies web-bundle/ into the
// Android assets, where the app serves it at https://localhost (see
// patches/react-native-webview+*.patch). Re-run `npx expo prebuild` after
// this, or the APK keeps the previous web build.
//
// Uncommitted edits are left out by default: the user always has unfinished
// work there, and it must not ship inside an APK.
const { execSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MAIN_REPO = "C:\\Users\\damod\\OneDrive\\Desktop\\aaaacursor";
const SRC = path.resolve(__dirname, "..", "..", "web-src");
const OUT = path.resolve(__dirname, "..", "web-bundle");
const APP_PATHS = [
	"components/", "src/", "context/", "hooks/", "lib/", "pages/", "utils/", "public/", "services/",
	"store/", "data/", "types.ts", "App.tsx", "index.tsx", "index.html", "index.css", "package.json",
	"vite.config.ts", "tailwind.config.js",
];
// Never copied for --working-tree.
const SKIP = new Set([
	"node_modules", ".git", "dist", "android", "ios", "functions", "ruflo", "graphify-out", ".claude",
	".agents", ".cursor", ".gemini", ".swarm", ".claude-flow", "backup", "reports", "test_dist",
]);

const args = process.argv.slice(2);
const workingTree = args.includes("--working-tree");
const ref = args.find((a) => !a.startsWith("--")) || "HEAD";

const git = (cmd) => execSync(`git -C "${MAIN_REPO}" ${cmd}`).toString().trim();
const run = (cmd, cwd = SRC) => execSync(cmd, { cwd, stdio: "inherit" });
const hash = (file) =>
	fs.existsSync(file) ? crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex") : "";

const commit = git(`rev-parse --short ${ref}`);
const dirty = git(`status --porcelain -- ${APP_PATHS.join(" ")}`);
if (dirty && !workingTree) {
	console.warn(
		"\n⚠️  aaaacursor has uncommitted app changes — they are NOT in this bundle:\n" +
			dirty
				.split("\n")
				.map((l) => `     ${l}`)
				.join("\n") +
			"\n   (use --working-tree only if the user asks to ship them)\n",
	);
}
console.log(`[web] building ${workingTree ? "the working tree" : ref} (${commit}) in ${SRC}`);

// Fresh copy of the sources; node_modules is kept so unchanged dependencies
// don't reinstall.
fs.mkdirSync(SRC, { recursive: true });
const oldLock = hash(path.join(SRC, "package-lock.json"));
for (const entry of fs.readdirSync(SRC)) {
	if (entry !== "node_modules") fs.rmSync(path.join(SRC, entry), { recursive: true, force: true });
}
if (workingTree) {
	for (const entry of fs.readdirSync(MAIN_REPO)) {
		if (SKIP.has(entry)) continue;
		fs.cpSync(path.join(MAIN_REPO, entry), path.join(SRC, entry), { recursive: true });
	}
} else {
	execSync(`git -C "${MAIN_REPO}" archive --format=tar ${ref} | tar -x -C "${SRC.replace(/\\/g, "/")}"`, {
		stdio: "inherit",
		shell: "bash",
	});
}

if (!fs.existsSync(path.join(SRC, "node_modules")) || hash(path.join(SRC, "package-lock.json")) !== oldLock) {
	// --ignore-scripts: the OG repo's postinstall also syncs agent skills.
	run("npm ci --ignore-scripts --no-audit --no-fund");
}
run("npx patch-package");
run("npx vite build");

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(SRC, "dist"), OUT, { recursive: true });
// Capacitor's own page-side bridge (normally injected by its Android
// runtime); WebScreen loads it before the page so the web code finds the
// native platform it was written for (src/webview/capacitorBridge.ts).
fs.copyFileSync(
	path.join(SRC, "node_modules", "@capacitor", "android", "capacitor", "src", "main", "assets", "native-bridge.js"),
	path.join(OUT, "native-bridge.js"),
);
fs.writeFileSync(path.join(OUT, ".source-commit"), `${commit}${workingTree ? " + working tree" : ""}\n`);
console.log(`[web] done: web-bundle/ from ${commit}. Now run: npx expo prebuild`);

// Runs Wrangler with a login that belongs to this repo only.
//
//   node wr.mjs login --browser=false   (open the printed link, sign in)
//   node wr.mjs whoami
//   node wr.mjs deploy
//
// Wrangler keeps its login under XDG_CONFIG_HOME. Pointing that at the repo's
// .wrangler-auth folder (git-ignored, shared by share-preview-worker/ and
// workers/ — same Cloudflare account) means signing in or out here never
// touches the global `wrangler login` that other projects use.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = {
	...process.env,
	XDG_CONFIG_HOME: path.join(here, "..", ".wrangler-auth"),
};
// A token in the shell would override the repo login — keep it out.
delete env.CLOUDFLARE_API_TOKEN;
delete env.CLOUDFLARE_API_KEY;

const result = spawnSync("npx", ["wrangler", ...process.argv.slice(2)], {
	cwd: here,
	env,
	stdio: "inherit",
	shell: process.platform === "win32",
});
process.exit(result.status ?? 1);

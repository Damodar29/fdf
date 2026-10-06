# Agent Access Rights: BigQuery Crashlytics

The agent has access to BigQuery to analyze Firebase Crashlytics data. 
To investigate crashes efficiently without wasting time, follow this protocol:

1. **Use the automated script**: Run `.\fetch_crash.ps1 -Version "TARGET_VERSION"` from the workspace root.
2. **Why this is better**: The script automatically targets the `_REALTIME` table, bounds the query to the last 7 days to save query costs, extracts the exact crashing file and line number from the stack trace (`exceptions[0].frames[0]`), and handles all PowerShell string-escaping issues automatically.

# Agent Access Rights: Cloudflare Workers

The Workers (`share-preview-worker/`, `workers/`, `b2-worker/`) are in Cloudflare account `f2788c3a7cff336f1bd18f9417239ef8`, which owns `chaitanyaprembhakti.org`. The machine's global `wrangler login` is a different account used by another project — never log it out or replace it.

1. **Use the repo-only login**: from `share-preview-worker/` or `workers/`, run `node wr.mjs whoami` / `node wr.mjs deploy`. The login is stored in `.wrangler-auth/` at the repo root (gitignored) and is already signed in to the right account (2026-09-26).
2. **If it has expired**: `node wr.mjs login --browser=false`, and the user opens the printed link in an incognito window and signs in with the domain-owning account.
3. **Plain `npx wrangler deploy` will fail** (`Authentication error [code: 10000]`) because it uses the global login.

Full rules: see "Cloudflare Workers (Deploy & Auth)" in AGENTS.md.

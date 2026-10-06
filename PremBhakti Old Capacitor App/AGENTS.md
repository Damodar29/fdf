## Directory Exclusions (ALL Agents Must Respect)

The following directories are **AI agent infrastructure**, not application source code.
**Never** browse, index, search, read, or include files from these directories when answering questions or generating code — they contain thousands of irrelevant files that will pollute context:

| Directory | What it is |
|---|---|
| `ruflo/` | Cloned Ruflo agent harness source (5000+ files, not this app) |
| `.swarm/` | Ruflo's vector memory database |
| `.claude-flow/` | Ruflo runtime data (logs, sessions, config) |
| `.claude/` | Claude Code settings, hooks, and agent configs |
| `.agents/` | Cross-agent skills and MCP configs (meta-config only) |
| `graphify-out/` | Auto-generated knowledge graph output |
| `dist/` | Build output |
| `.wrangler-auth/`, `.gcloud/` | Folder-local Cloudflare / gcloud logins (tokens) — never read or print; use them only through `node wr.mjs` / `fetch_crash.ps1` |

When a user asks about "the codebase", focus on `components/`, `src/`, `hooks/`, `context/`, `services/`, `store/`, `utils/`, `public/`, `functions/src/`, the Worker folders (`share-preview-worker/`, `workers/`, `b2-worker/`) and root-level config files (`.ts`, `.tsx`, `.json`) only.

Exception: skills in `.agents/skills/` (see "Agent Skills" below) are meant to be read when that kind of task comes up — just don't search `.agents/` as if it were app code.

## Working Rules (from the owner)
- **Don't commit, push or deploy** (git, `firebase deploy`, `npm run ota:push`, `node wr.mjs deploy`) unless the user explicitly asks for it in the current task. Tell them the exact command instead.
- **Don't break anything**: prefer small, backward-compatible changes; older app versions in the field must keep working.
- **Never print secrets** (`.env`, tokens, keys, service-account files) in output or logs. Committed credentials in this private repo are a known, accepted risk — don't re-flag them.
- **Home screen back button**: needing 3 presses to exit from Home is intentional — don't "fix" it.
- **Keep both copies in sync**: `AGENTS.md` (root) and `.agents/AGENTS.md` must stay identical. After editing one, copy it over the other.

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.


Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## BigQuery Crashlytics Protocol
When asked to investigate a recent crash:
1. **Use the Helper Script**: Do not write SQL manually. Run the helper script `.\fetch_crash.ps1 -Version "TARGET_VERSION"` to instantly fetch the most recent crashes (omit `-Version` for the latest build; `-Events` for individual events; `-Type FATAL|NON_FATAL|ANR`; `-Days N`).
2. **What the Script Does**:
   - Queries the `_REALTIME` table for instant results.
   - Extracts the exact **file and line number** of the crash (blamed frame, falling back to `exceptions[0].frames[0]`, then the blamed thread for ANRs).
   - Extracts the **OS Version** for reproducing device-specific bugs.
   - Restricts the query to the **last 7 days** (`TIMESTAMP_SUB`) to optimize BigQuery data scanning costs.
   - Automatically handles PowerShell escaping and SQL file generation.
3. **Auth**: The Crashlytics data lives in project `cpbs-admin`; the global gcloud account cannot read it. The script automatically uses the folder-local login in `.gcloud/` (gitignored), created with `$env:CLOUDSDK_CONFIG = "$PWD\.gcloud"; gcloud auth login`. For ad-hoc `bq` commands, set `CLOUDSDK_CONFIG` to that folder the same way.
4. **JS errors share one issue**: every web/JS error is reported through `CrashlyticsPlugin.recordException`, so Crashlytics groups them all under a single issue (`CrashlyticsPlugin.recordException`). Break that issue down by `exceptions[0].exception_message` to see the real distinct errors.

## UI Modification Rules
To avoid unnecessary back-and-forth when modifying UI components:
1. **Preserve Element Structure**: When asked to apply a "theme color" to a button or icon, DO NOT change the background or turn it into a solid filled button unless explicitly told to. Only apply the color to the relevant icon, text, or border to preserve the original design.

## B2 Storage
- The `cpbs-videos` Backblaze B2 bucket is **private**. It requires authentication (e.g. `aws4fetch` signed requests) to access files. Never assume it is public or proxy to it without signing.

## Cloudflare Workers (Deploy & Auth)
| Folder | Worker | What it does |
|---|---|---|
| `share-preview-worker/` | `share-preview` | Share links `chaitanyaprembhakti.org/v/*`: people get a 302 to the app page, link-preview bots get OG tags (cached 10 min), mandal previews and any error fall back to the `serveVideoPreview` function |
| `workers/` | `github-cdn` | GitHub release CDN proxy |
| `b2-worker/` | `b2-video-proxy` | `videos.` / `audios.` / `images.` / `ota.` subdomains → private B2 bucket |

1. **Two Cloudflare accounts**: the Workers and the domain live in account `f2788c3a7cff336f1bd18f9417239ef8` (set in each `wrangler.toml`). The global `wrangler login` on this machine is a *different* account (`de1041307075246ab0f31e4c9c0b66dd`) used by another project, so plain `npx wrangler deploy` here fails with `Authentication error [code: 10000]`.
2. **Never** run `wrangler logout` / global `wrangler login`, and never change `account_id` to the other account — the user's other project depends on the global login, and the routes need the domain-owning account.
3. **Use the repo-only login**: from `share-preview-worker/` or `workers/`, run `node wr.mjs <command>` (`login --browser=false`, `whoami`, `deploy`). `wr.mjs` sets `XDG_CONFIG_HOME=<repo>/.wrangler-auth` (gitignored), so this login is separate from the global one — same idea as the folder-local `.gcloud/` login above. One login serves both folders. `b2-worker/` has no `wr.mjs` yet; copy the file there if it needs deploying.
4. **Tokens in `.env`**: the root `.env` has `CLOUDFLARE_USER_API_TOKEN`, `CLOUDFLARE_GLOBAL_API_KEY`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`. Wrangler only reads `CLOUDFLARE_API_TOKEN` (or `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL`), and only from a `.env` in the folder it runs in — the root names are not picked up automatically. Prefer `node wr.mjs`; never print token values.
5. **Free plan**: 100,000 requests/day shared by all Workers (the B2 media proxy already uses a lot) and 10 ms CPU per request. Keep Workers light and give them a fallback to the origin; don't add high-traffic routes without checking the daily usage first.
6. **Share-link formats** (`/v/video/{id}`, `/v/{id}`, `/v/folder/{id}`, `/v/mandal/{mandalId}/{videoId}`, `/v/mandal-photos/{mandalId}/{date}`) are parsed in three places that must stay in sync: `utils/shareLinks.ts` (app), `share-preview-worker/src/index.js`, and `serveVideoPreview` in `functions/src/index.ts`.

## Cost Rules (Firebase)
- **Cloud Functions are the main bill, not Firestore.** Look at function invocations first when cutting cost; Firestore reads/writes are low priority unless asked.
- Lists shown live in the app (mandals, videos, video folders, Calendar) must stay **instant** — do not replace their listeners with JSON-file snapshots.
- Do not move family linking, notifications, Firestore triggers or scheduled jobs to Workers (small saving, real risk).
- Artifact Registry cleanup policy (1 day) is already set in `us-central1` and `asia-south1`.
- The device-token write (`fcm_tokens/*`) and the web `subscribeToTopic` call happen only when the token changes or once a week (`services/firebase.ts`) — don't make them per-launch again.

## Environment & Credentials (`.env` Fallback)
Before working on any service-related task, always check the environment (.env) file first and use the available credentials/configurations from it.

The .env file may contain access credentials/configuration for:
- Backblaze B2 Storage
- YouTube API
- Cloudflare
- GitHub
- Firebase

For GitHub and Firebase specifically:
- If terminal authentication/login is already available, use it.
- If GitHub is not authenticated through the terminal, use the GitHub Personal Access Token (PAT) stored in the .env file.
- If Firebase Admin is not configured or terminal authentication is not available, use the Firebase credentials available in the .env file.

For other services like Backblaze B2 Storage, YouTube API, and Cloudflare:
- Use the credentials/configuration available in the .env file directly when required.
- Exception — **deploying Cloudflare Workers**: use `node wr.mjs` (see "Cloudflare Workers (Deploy & Auth)"), not the `.env` tokens and not the global `wrangler login`.

Always check the available environment variables and existing project configuration first before assuming any service is unavailable or asking for manual credentials.

Keep this workflow in mind for all future development, debugging, and infrastructure-related tasks.

## B2 Video Optimization Pipeline
- **Problem**: MP4 videos uploaded directly to cloud storage often buffer endlessly because the `moov` atom is at the end of the file, preventing the browser from parsing metadata until the whole video is downloaded.
- **Solution**: The project uses a zero-cost FFmpeg optimization pipeline via GitHub Actions to run `ffmpeg -movflags +faststart` on all videos.
- **How it works**:
  1. **New Uploads**: When the app (React/Capacitor) uploads a video using `b2Uploader.ts`, it automatically calls the Cloudflare Worker webhook at `/api/trigger-optimization`. The Cloudflare worker securely triggers the `.github/workflows/optimize-new-video.yml` GitHub Action using a PAT.
  2. **Batch/Direct Uploads**: The `.github/workflows/optimize-batch-videos.yml` runs weekly (or manually) to scan the entire B2 bucket, uses `ffprobe` to check for unoptimized videos (where `mdat` comes before `moov`), and optimizes them.
- **Rules**:
  - Never change the public video URLs, names, or B2 bucket folder structures during optimization. The GitHub Actions download, optimize, and *overwrite* the file in place.
  - Do NOT give GitHub Actions direct access to Firebase Database. The Actions should only interact with B2 storage or Cloudflare workers to keep concerns separated.
  - Notifications for successes and failures are sent to Telegram using `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` secrets.
  - **Zero-Egress B2 Access**: When writing any new GitHub Actions (YAML files) or scripts that download or scan files from Backblaze B2, NEVER use direct `b2 file url` or `fXXX.backblazeb2.com` endpoints. ALWAYS use the Cloudflare CDN proxy URLs (e.g., `https://audios.chaitanyaprembhakti.org/...` or `videos...`) to ensure Bandwidth Alliance zero-egress billing applies.

## Client-Side Uploads to B2 (Preventing Ghost Files)
When implementing direct client-side uploads (e.g., from the React frontend to Backblaze B2 via Cloudflare worker), ALWAYS use the **Draft/Placeholder Pattern** to prevent orphaned "ghost" files in B2 if the app is killed during upload:
1. **Pre-Save**: Save a placeholder document in Firestore with `status: "uploading"` *before* starting the B2 upload.
2. **Upload**: Perform the `uploadFileToB2` call.
3. **Commit**: Update the Firestore document to `status: "pending" / "published"` with the actual CDN URL.
4. **Filter**: Ensure `getUserGlorifications` or equivalent queries explicitly filter out `status === "uploading"` so drafts never appear in the UI. 
**Tracking Ghost Files is Easy**: Ghost files will no longer be hidden! If you ever need to delete incomplete files, just look for the documents in Firebase that have had the `status` of `"uploading"` for several hours. (In the future, you can write a small script to clean up these documents and B2 files all at once).

## PowerShell & Unicode File Safety (CRITICAL)

This project contains **Hindi (Devanagari) text** inside source files (`.tsx`, `.ts`). Using PowerShell to read and rewrite these files without explicit UTF-8 encoding **will corrupt all Hindi text** (turns `ठाकुर जी के दर्शन` into mojibake like `à¤ à¤¾à¤•à¥à¤° à¤œà¥€`).

**Rules — strictly follow every time:**
- **NEVER** use bare `Get-Content` + `Set-Content` on any `.tsx`/`.ts`/`.json` file in this project.
- If PowerShell reads are unavoidable, ALWAYS specify `-Encoding UTF8`:
  ```powershell
  Get-Content $path -Encoding UTF8
  Set-Content $path $lines -Encoding UTF8
  ```
- **Preferred approach**: Use the built-in `replace_file_content` or `multi_replace_file_content` editor tools instead of PowerShell for any source file edits — these are UTF-8 safe by design.
- If a file gets corrupted by encoding issue: run `git stash -- <file>` to restore the original, then re-apply only the needed change using editor tools.
- **Files most at risk**: `components/HomeScreen.tsx`, any file with `isHindi ?` ternaries, or any file with inline Devanagari string literals.


## Skill: Design System Generator

When the user asks to create a design system, generate a color palette, build a theme, create UI tokens, or set up brand styles, follow `.agents/skills/design-system-generator/SKILL.md` (same copy in `.cursor/skills/` and `.claude/skills/`). Its references are in `references/` and templates in `templates/` next to that file.

- 5 phases in order (brand input → OKLCH colors → tokens → component CSS → preview page); confirm with the user between phases.
- All colors in OKLCH; components use only `var(--token-name)`; Light + Dark via `light-dark()` + `[data-theme]`; WCAG 2.2 AA contrast.
- Output goes to `design-system/` (`tokens.json`, `tokens.css`, `components.css`, `preview.html`).
- The app's own theme work (e.g. the Janmashtami theme) lives in the app code and `reports/` — this skill is only for building a new design system.

## Agent Skills (Claude, Codex, Antigravity, Gemini)

**Where they live**: `.agents/skills/` is the one real copy — Codex, Antigravity (Gemini and Claude models), Gemini CLI and Cursor read it. Claude Code reads `.claude/skills/`, which holds links to the same folders. To add a skill: `npx skills add <owner/repo> --skill <name> -a universal --copy -y` (or copy the folder into `.agents/skills/`), add a short "In this repo" note under its frontmatter if project rules apply, then run `node scripts/sync-skills.mjs` — it links the skill for Claude Code and checks the frontmatter (`name` = folder name, lowercase-hyphen; description ≤ 1024 chars). Read a skill before installing it.

**For teammates**: skills are committed in `.agents/skills/`, so Codex, Antigravity, Gemini and Cursor work right after `git pull`. For Claude Code, `npm install` runs the sync script (postinstall) to create the `.claude/skills/` links; or run `npm run skills:sync`. `book-to-skill` is a git submodule — `git submodule update --init` if you need it. `omni-route` is a personal tool and stays out of git.

Use these automatically when the task fits — the user doesn't need to name them. Project rules (this file, `prem-bhakti-ui`) win over general skill advice.

| Task | Skills |
|---|---|
| **Any UI change in the app** | `prem-bhakti-ui` first (Janmashtami tokens, fonts, Hindi, dark mode, checks) |
| New UI / visual direction | `frontend-design`, `taste-skill` — inside the house theme unless a redesign is asked for |
| Improving an existing screen | `redesign-skill`, `web-design-guidelines` (UI/accessibility review) |
| Polish, motion, "feels native" | `emil-design-eng`, `improve-animations` (read-only audit), `mobile-native`, `safe-area-handling` |
| UI from an image / brand references | `image-to-code-skill`, `awesome-design-md` (`design-md/`) |
| Store screenshots / preview video | `goldie` |
| React code | `react-best-practices` (client-side rules; no Next.js here), `composition-patterns`, `typescript-expert` |
| Bugs | `systematic-debugging` (root cause before fixes), `debugging-capacitor` (device/WebView), Crashlytics protocol above |
| Before saying "done" / shipping | `verification-before-completion`, `prem-bhakti-ship` (checks, deploy commands and order) |
| Browser tests without a built-in browser | `webapp-testing` (Playwright) |
| Capacitor / Android | `capacitor-best-practices`, `debugging-capacitor`, `safe-area-handling`, `mobile-developer` |
| Firebase rules | `firebase-security-rules-auditor`, `firebase` |
| Cloudflare Workers | `workers-best-practices` (+ "Cloudflare Workers" rules above) |
| New design system from scratch | `design-system-generator`, `design-farmer` |
| Finding more skills | `find-skills` |

Writing and workflow (always on):
1. **No AI Slop**: apply `no-ai-slop` so text reads natural and human.
2. **I Have ADHD**: follow `i-have-adhd` — shorter, clearer, straight to the point.
3. **Book to Skill**: `book-to-skill` when the user wants to turn books or documents into reusable knowledge.
4. **Omni Route**: `omni-route` for multi-model routing or checking AI API quotas and health (not part of the app).

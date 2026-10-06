---
name: prem-bhakti-ship
description: How to verify and release changes in the Prem Bhakti repo — which checks to run for app, Cloud Functions, Firestore/Storage rules and Cloudflare Worker changes (typecheck, build, emulator tests), and which deploy command ships each kind of change (OTA push, hosting, functions, rules, Worker, Android build) in a safe order. Use before saying work is done, when asked "is it ready", "how do I ship this", or to deploy. Never deploys or commits unless the user asks.
---

# Verify and ship (Prem Bhakti)

**Never run a deploy, `npm run ota:push`, `git commit` or `git push` unless the user asked for it in this task.** When they didn't, finish with the exact commands they should run, in order.

## 1. Checks for each kind of change

| What changed | Run | Notes |
|---|---|---|
| App code (`components/`, `context/`, `hooks/`, `services/`, `utils/`, `src/`, `App.tsx`) | `npx tsc --noEmit` | Fast; must be clean. |
| Anything going to users | `npm run build` | `tsc && vite build`. Run on Windows (esbuild binary is platform-specific). |
| UI | Dev server `npm run dev` → http://localhost:3000 | Check at 375×812, light + dark, English + Hindi (`prem-bhakti-ui` §5). |
| Cloud Functions (`functions/src/`) | `npm --prefix functions run build`, then `npm run test:family` | Emulator tests, see §2. |
| `firestore.rules` / `storage.rules` | `npm run test:rules` | Emulator tests, see §2. |
| A Worker (`share-preview-worker/`, `workers/`, `b2-worker/`) | `node --check <file>`; `node wr.mjs deploy --dry-run` from its folder | Share-link parsing must stay in sync in 3 places (AGENTS.md, "Cloudflare Workers"). |
| Any code | `graphify update .` | Keeps the knowledge graph current (AST only, free). |

Report results honestly: paste the failing output instead of summarising it away.

## 2. Emulator tests (functions and rules)

- The Firebase emulators need Java 21+; the default `java` on this machine is 1.8. Set `JAVA_HOME` first:
  - Git Bash: `export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-25.0.2.10-hotspot"`
  - PowerShell: `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot"`
- Tests run against the offline `demo-family` project; the auth emulator isn't configured — tests use unsigned JWTs.
- In the functions emulator `admin.firestore.FieldValue` / `FieldPath` are undefined: import them from `firebase-admin/firestore`.
- The emulator leaves `firestore-debug.log` in the repo root (gitignored); remove it afterwards.

## 3. What ships each kind of change

| Change | Command (only when asked) | Reaches |
|---|---|---|
| Web/app code, CSS, `public/` | 1. Bump `version` in `package.json` — it must be higher than the live OTA version (`ota-predeploy.mjs` checks Firestore `ota_config/latest` and stops otherwise). 2. `npm run ota:push` 3. `firebase deploy --only hosting` | Installed Android apps (OTA) and the website/PWA |
| Cloud Functions | `firebase deploy --only functions:<name>[,functions:<name2>]` — only the changed ones | Server |
| Firestore rules / indexes | `firebase deploy --only firestore:rules` / `firebase deploy --only firestore:indexes` | Server |
| Storage rules | `firebase deploy --only storage` | Server |
| A Worker | `node wr.mjs deploy` from the Worker's folder — never `npx wrangler deploy`, never `wrangler logout` | Cloudflare |
| Native Android (`android/`, `capacitor.config.json`, a new Capacitor plugin) | `npm run build && npx cap sync android`, bump `versionCode`/`versionName` in `android/app/build.gradle`, build the AAB in Android Studio, upload to Play | Play Store only — OTA can't ship native changes |

## 4. Order and compatibility

- Old app versions stay installed for weeks. Every server change must keep them working.
- Ship what others depend on first: new functions → then the app (OTA + hosting) → then rules that remove old access. (In Sept 2026 the rules that hid phone numbers went live before the app update, so older apps showed an empty linked-family list until they updated.)
- One OTA push per batch of app changes; don't push half-finished features — there is no staged rollout.

## 5. Commits (only when asked)

- Check `git status` first; stage only files that belong to the change (the tree often has unrelated edits).
- Message style from history: `type: what changed and why` — `feat:`, `fix:`, `chore:`, `docs:`.
- Never commit secrets beyond what's already there, never use `--no-verify`.

Related: `verification-before-completion`, `prem-bhakti-ui`, `firebase-security-rules-auditor`, `workers-best-practices`.

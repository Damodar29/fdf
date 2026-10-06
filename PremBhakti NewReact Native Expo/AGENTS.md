# AGENTS.md — Prem Bhakti RN (read this before every task)

> **Expo HAS CHANGED.** Read the exact versioned docs at
> https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This file is for every AI coding agent: Claude Code, Antigravity (Claude or Gemini), and
others. `GEMINI.md` has the same content. **When you change one, change the other the same
way.**

You are working on **Prem Bhakti RN**. It is a React Native (Expo SDK 57, React Native 0.86,
New Architecture, TypeScript) rewrite of the Play Store app `com.cpbs.bhajans`
("Prem Bhakti", Shree Chaitanya Prem Bhakti Sangh).

This file is self-contained on purpose. Do not assume another file was loaded automatically.
Before any work, read these files yourself:

1. `docs/handoff/ANTIGRAVITY-HANDOFF.md`: the rules and the step-by-step plan for your
   main task (porting the remaining WebView screens).
2. `docs/context/PROJECT-CONTEXT.md`: project memory, decisions, status.
3. `docs/context/WEBVIEW-BRIDGE.md`: how WebView screens, the login and the shared storage
   work.
4. `docs/context/HISTORY.md`: what was done, bugs already solved, things not to retry.

If something here disagrees with those files, the files win. Tell the user about the
conflict.

---

## 1. Talking to the user

- The user writes in **Hinglish** (Hindi in Latin letters, mixed with English). Reply in
  **simple Hinglish**. Keep code, code comments, commit messages and docs in **English**.
- The user is not a professional developer. Explain in plain words, without jargon.
- After every task, report three things:
  1. **Kya kiya**: what you did.
  2. **Kya test kiya, kaise**: what you tested and how (screenshots where useful).
  3. **Kya baaki hai**: what is left, and what can only be tested on the phone.

  Then ask: **"commit/push kar doon?"**
- Do not ask again about things already decided in `PROJECT-CONTEXT.md`. Ask only when
  something is really unclear or risky.
- Never claim something works if you did not test it. Say exactly what was and was not
  tested.

---

## 2. Absolute rules (never break these, even if a task seems to need it)

**Folders**
- Work **only** in `C:\rn\mobile`.
- `C:\Users\damod\OneDrive\Desktop\aaaacursor` is the **OG app** (React 19 + Vite +
  Capacitor 7). It is **READ-ONLY** for you.
  - You may read its files, `git log`, `git status`, `git diff` and `git show`.
  - **Never** write, edit, format, build, `npm install`, `git checkout`, `git switch`,
    `git stash`, `git reset`, `git restore`, `git clean`, commit, or create branches or
    worktrees there.
  - The user always has unfinished work in that folder. One wrong command destroys it.
- Never delete or mention `aaaacursor\.claude\worktrees\react-native-android-migration-db652b`.
- `C:\rn\web-src` is a build copy of the OG. It holds **secret files**:
  `serviceAccountKey.json`, `play-store-key.json`, `b2_keys.json`, `.env`. Never open,
  print, copy, upload, commit or bundle them.

**Git**
- Commit and push **only after the user says yes** in chat. Ask after each finished piece
  of work.
- Never `git push --force`. Never rewrite history. Never commit secrets, `android/`,
  `web-bundle/`, `node_modules/` or build output.
- End commit messages with a `Co-Authored-By:` line naming the model that did the work.

**Toolchain**
- Gradle **9.3.1** and JDK **17** stay. Refuse any upgrade prompt from Android Studio.
- Never set `newArchEnabled=false`.
- Do not upgrade Expo, React Native or any package. Do not run `npm audit fix`.
- **Do not add any npm package without asking the user first.**
  - A package with native code also needs a new APK build.
  - Always prefer what is already installed (section 4).
- `android/` is **generated** by `npx expo prebuild` and gitignored. Never edit it by hand.
  Native changes go into `plugins/`, `modules/`, `patches/` or `app.json`.
- Keep `plugins/withTestBuild.js` in `app.json`. It may be removed only when the user asks
  for the Play Store release.
- Build only from `C:\rn\mobile`. Longer Windows paths break the C++ build.
- Do not start an APK or Gradle build unless the user asks. A release build takes
  12–15 minutes.

**Phone and emulators**
- The user's phone is a **Samsung Galaxy M55**. **Ask the user to plug it in before any
  phone test**, and only when they want a phone test.
- Install only `com.cpbs.bhajans.rntest` ("Prem Bhakti RN"), always with
  `adb -s <serial>`.
- **Never** uninstall, clear, or install over `com.cpbs.bhajans`. That is the real app
  with real users' data.
- Never open or double-click an `.apk` on the PC (it starts BlueStacks). Never start
  BlueStacks. Never reset the Android emulator. Use the **browser preview** (section 5) for
  testing.

**Live data**
- The app reads the live Firebase project `cpbs-admin`.
- **Nothing you run on the PC may write to it.**
- Every Firestore/Storage write you add must be skipped on web
  (`if (Platform.OS === "web") return;`). The browser preview also blocks writes. Keep it
  that way.
- Never "try out" a write against the real database.
- Never type real passwords, payment details, UPI IDs or personal data anywhere while
  testing.

**Scope**
- **Do not redesign.** Native screens must look and behave **exactly** like the OG
  Capacitor screens: same colours, icons, spacing, order, Hindi/English text, animations
  and states. Fix clear bugs only, and tell the user which ones.
- The **guided product tour** ("App Tour", "Replay guided tour") comes **last**. Do not
  start it.
- **Profile, Admin panel, Onboarding/intro** stay as WebView screens. Do not port them.
- **Expo SDK 57 changed many APIs.** Before using any Expo API, read
  https://docs.expo.dev/versions/v57.0.0/. Do not trust memory of older SDKs.

If a task would break any rule above, **stop and ask the user**.

---

## 3. The project in short

| | OG app (reference) | This app |
|---|---|---|
| Folder | `C:\Users\damod\OneDrive\Desktop\aaaacursor` (read-only) | `C:\rn\mobile` |
| GitHub | `chaitanyaprembhakti/cbps-admin` | `chaitanyaprembhakti/prem-bhakti-rn` |
| Stack | React 19, Vite, Tailwind, Capacitor 7, Firebase | Expo 57, RN 0.86, zustand, MMKV, React Navigation |

- **Plan "3B":** this app ships as an **update** of `com.cpbs.bhajans`, so users keep
  their data. The screens that are not native yet show the **OG web build inside a
  WebView**. It is bundled in the APK and served at `https://localhost` (the Capacitor
  app's origin), so the old web data and login carry over.
- **Already native:**
  - Home, Bhajans list, Bhajan reader, Audio, Books and the PDF reader, History,
    Settings, Login, Side menu, Downloads.
  - App-level parts: push notifications, notification permission, quote popup, force
    update, deep links, first-run intro trigger, admin trackers.
- **Still WebView (your work):** About, Privacy, Terms, Guru Maharaj, Virahi Maharaj,
  Temple timings, Our centers, Daily quotes, Information, Glorification reader/write,
  Vaishnav calendar, Videos, Donate, Deity darshan, Activities. The order and per-screen
  notes are in `docs/handoff/ANTIGRAVITY-HANDOFF.md`, section 6.
- **Sync with the OG:** the OG changes almost daily. The last synced commit (the "sync
  point") is written in `PROJECT-CONTEXT.md` (`503dc44` when this file was written).
  Before porting a screen, run (read-only):
  ```
  git -C C:\Users\damod\OneDrive\Desktop\aaaacursor log --oneline <sync>..HEAD -- <files>
  git -C C:\Users\damod\OneDrive\Desktop\aaaacursor status --short -- <files>
  ```
  Then port from the **current working-tree files**, including uncommitted edits.

---

## 4. Code map and conventions

**Where things are**
- `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx`: the root stack (Tabs,
  Reader, Lecture, BookViewer, Settings, Web, Login) and the bottom tabs. A ported screen
  becomes a new root-stack route with `animation: "slide_from_right"`.
- `src/lib/appNav.ts`: **all** "open screen X" logic:
  - `openScreen(name)`: banners, pushes, `?screen=` links.
  - `openNotification(data)`: tapped pushes.
  - `openSiteLink(url)`: chaitanyaprembhakti.org links.
  - `openWeb(target)`: the WebView fallback.
- `src/screens/HomeScreen.tsx` + `src/components/home/*`: Home and its tiles.
  `src/components/SideMenu.tsx`: the menu.
- `src/screens/WebScreen.tsx`, `src/webview/*`: the WebView screens and the Capacitor
  bridge. You normally do not change these.
- `src/store/*`: zustand stores. `homeDataStore.ts` already loads `mandals`, `videos`,
  `videoFolders`, activity/darshan folders and releases, `information`, `quotesImages`,
  `banners`, `social` and the glorification flags. **Reuse it.** Never fetch the same data
  twice.
- `src/store/authStore.ts`, `src/store/profileStore.ts`, `src/lib/webAuth.ts`: the
  logged-in devotee. It is a Firebase JS SDK session shared with the WebView pages.
- `src/lib/webStore.ts`, `src/lib/newBadge.ts`: **the web screens' localStorage, mirrored
  natively.**
  - Use `webGet` / `webSet` / `markSeen` / `useClearOnVisit` with the **exact same keys
    as the OG** (e.g. `cpbs_read_info_ids`, `cpbs_darshan_view_mode`,
    `cpbs_seen_visit_*`).
  - That keeps Home's NEW badges, the Drive backup and the remaining web screens in sync.
    Never invent new keys for data the OG already stores.
- `src/theme/jmColors.ts`, `src/theme/colors.ts`, `src/theme/useAppTheme.ts`: colours
  (copied from the OG Tailwind tokens).
  - **Never hardcode a hex colour.** Use the theme. If one is missing, add it from the OG
    `tailwind.config.*`.
  - `useAppTheme()` gives `isDark`, `primary` and the palette ramp `p[50..900]`.
- `src/lib/cdnUrl.ts` (`toCdnUrl`), `src/lib/imageThumb.ts` (`thumbUrl`, `THUMB.*`): every
  media URL goes through these, as in the OG. Fall back to the original URL if a thumb
  fails.
- `src/lib/haptics.ts` (`triggerHaptic`), `src/store/toastStore.ts` (`showToast`),
  `src/store/settingsStore.ts` (language `hi`/`en`, theme, sizes).

**Installed libraries to use (no new ones without asking)**
- **UI:** `expo-image`, `expo-linear-gradient`, `react-native-svg`,
  `lucide-react-native` (same icon names as OG `lucide-react`).
- **Gestures and animation:** `react-native-reanimated`, `react-native-gesture-handler`.
- **Lists:** `@shopify/flash-list`.
- **Data:** `firebase` (JS SDK), `@react-native-firebase/*`, `zustand`,
  `react-native-mmkv`, `astronomy-engine`.
- **Files and sharing:** `react-native-blob-util`, `expo-sharing`, `expo-clipboard`,
  `expo-web-browser`.
- **Video:** `react-native-youtube-iframe`.
- **Not installed:** `date-fns`, any HTML renderer. Ask before adding.

**Code style**
- TypeScript, functional components, tabs for indentation (match the existing files).
- Comments explain *why*, in short English sentences, like the existing code.
- Copy pure logic from the OG **verbatim** and add types: date maths, classifiers,
  formatters, `services/GaurabdaService.ts`. Do not rewrite it.
- Copy every user-visible string from the OG, in Hindi **and** English.
- Entering animations (reanimated `entering=`) must be `undefined` on web. See `enterUp`
  in `src/components/home/HomeTiles.tsx`.
- Big screens are split into `src/components/<screen>/*`, the way `components/home/` is.

---

## 5. Commands and testing

Run in `C:\rn\mobile`:

| Command | What it does |
|---|---|
| `npx tsc --noEmit` | Type check. Must be clean before you say "done". |
| `npm run web:preview` | Serves the OG web build (`web-bundle/`) on http://localhost:8090. WebView screens need it. |
| `npm run web` | Runs this app in the browser on http://localhost:8081. |
| `npx expo start --web --clear` | Same, with Metro's cache cleared (for a stale UI). |
| `npm run web:build` | Rebuilds `web-bundle/` from the OG's latest **commit** (it copies to `C:\rn\web-src`, never builds in aaaacursor). |

**Browser preview** (the main way to test; human guide: `WEB-PREVIEW-GUIDE.html`):
- Keep both servers running.
- Open http://localhost:8081 in **one tab only**. The WebView iframes share storage, so two
  app tabs interfere with each other.
- Use a phone viewport of **375×812**.
- The OG app itself runs at http://localhost:8090. Compare every ported screen **side by
  side** with it: light and dark, Hindi and English.
- Native-only packages are swapped for `web-shims/` (`metro.config.js`), and WebViews
  become iframes.
- Console helpers:
  - `__nav.navigate("Settings")`
  - `__appNav.openScreen("darshan")`
  - `__appNav.openNotification({ action_type: "screen", target_screen: "information", target_info_id: "<id>" })`
- **Not testable in the browser:** real pushes, Google/OTP login, downloads/PDF, UI size,
  the native YouTube player, haptics. List these for the user's phone test round.

Phone (only with the user's permission): `EXPO-PHONE-GUIDE.html` (debug build + Metro) and
`ANDROID-BUILD-GUIDE.html` (release APK).

---

## 6. How to port one WebView screen (summary)

The full procedure is in `docs/handoff/ANTIGRAVITY-HANDOFF.md`, sections 3–4 and 8.

- **Step 0, once:** add `NATIVE_SCREENS` (OG screen name → native route) in
  `src/lib/appNav.ts`. Route every opener through `openScreen`: Home tiles, SideMenu,
  pushes, site links, quotes. With an empty map, nothing may change.

Then, **one screen per chat/session**:
1. **Sync check** on the OG files (read-only git commands, section 3).
2. **Read** the OG screen and all its local imports. Write a plan listing:
   - every state, data read/write and storage key
   - every hi/en string
   - every loading/empty/error state

   Show the plan and wait for approval.
3. **Screenshot** the OG screen at :8090 (375×812, light/dark, hi/en). These are the spec.
4. **Build** `src/screens/<Name>Screen.tsx` (+ `src/components/<name>/*`):
   - Add the route to `types.ts` and `RootNavigator.tsx`, then to `NATIVE_SCREENS`.
   - Reuse `homeDataStore`. Use the same webStore keys. Guard writes on web.
5. **Verify:**
   - `tsc` is clean.
   - Side-by-side comparison with the OG.
   - Every entry point opens the native screen: tile, menu, banner, push with params, site
     link.
   - Home NEW badges clear and stay cleared.
   - The Android back button closes the screen.
   - Removing the screen from `NATIVE_SCREENS` sends it back to the WebView.
6. **Docs:** update `docs/context/PROJECT-CONTEXT.md` (status, sync point) and add a dated
   entry to `docs/context/HISTORY.md`.
7. **Report** in Hinglish (section 1) and ask before commit/push.

---

## 7. Mistakes already made once — do not repeat

- Building outside `C:\rn\mobile`: long Windows paths broke the C++ build.
- A WebView in the browser preview wrote +1 to `app_version_stats` before writes were
  blocked. Every new write needs a web guard.
- Reanimated entering animations piled the Home tiles on top of each other on web. Keep
  them off on web.
- The OG web app ignores the same `?screen=` for 18 h. The WebView preload clears
  `cpbs_processed_notification_ids`. Do not remove that line from `WebScreen.tsx`.
- Two browser tabs of the app shared iframe storage and the intro closed itself. Test with
  one tab.
- A colour referenced from `firebase.json` broke the Android resource build (AAPT). Keep
  native colours and icons inside `modules/app-notifications`.
- Darshan and Activities used to download the same GitHub release list twice. Use
  `fetchReleaseList()` in `homeDataStore.ts`.

---

## 8. Done means

- [ ] Ported from the current OG files, after a sync check.
- [ ] Looks and behaves like the OG (light/dark, hi/en, all states), compared side by side.
- [ ] Same storage keys; Home badges correct; no duplicated data fetching.
- [ ] Every entry point opens the native screen; the back button works.
- [ ] No writes to Firebase from the PC; no hardcoded colours; no new packages without a
      yes.
- [ ] `npx tsc --noEmit` clean.
- [ ] Docs updated.
- [ ] Hinglish report given; asked "commit/push kar doon?".

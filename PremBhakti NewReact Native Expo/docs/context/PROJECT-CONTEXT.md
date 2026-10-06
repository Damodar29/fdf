# Prem Bhakti RN — project context (read this first)

This file is the single source of truth for any agent/chat working on this repo. It is loaded
automatically through `CLAUDE.md`. Details live in the two sibling files:
- [WEBVIEW-BRIDGE.md](WEBVIEW-BRIDGE.md) — how WebView screens get Capacitor features + login
- [HISTORY.md](HISTORY.md) — what was done so far, problems already solved, things not to retry
- [../handoff/ANTIGRAVITY-HANDOFF.md](../handoff/ANTIGRAVITY-HANDOFF.md) — rules + step-by-step plan for porting the
  remaining WebView screens (written 2026-10-05 for Antigravity agents); prompts in `../handoff/PROMPTS.md`

The user talks in Hinglish; reply in simple Hinglish.

---

## 1. Which repo / folder is which

| What | Local folder | GitHub | Role |
|---|---|---|---|
| **OG app + website** (React 19 + Vite + Capacitor 7, Firebase) | `C:\Users\damod\OneDrive\Desktop\aaaacursor` (branch `main`) | `chaitanyaprembhakti/cbps-admin` (private) | The shipped Play Store app `com.cpbs.bhajans` and the site chaitanyaprembhakti.org. **Read-only reference for us.** |
| **This RN app** (Expo SDK 57, React Native 0.86) | `C:\rn\mobile` (branch `main`) | `chaitanyaprembhakti/prem-bhakti-rn` (private) | The native rewrite. All our work happens here. |

**The user works on the OG app every day in that local aaaacursor folder, so it is always the
latest code** (often newer than its last commit and newer than GitHub). Whenever you need to know
how a screen looks or works, **read the files in `C:\Users\damod\OneDrive\Desktop\aaaacursor`
directly** — no need to go to GitHub or `git show`. Real code is in `components/`, `src/`,
`context/`, `hooks/`, `lib/`, `pages/`, `utils/`, `public/`, `functions/`, `tailwind.config.*`;
ignore AI tooling folders (`ruflo/`, `.claude/`, `.agents/`, `.cursor/`, `graphify-out/`).

Hard rules for aaaacursor:
- Never write, build, `npm install`, checkout, stash, reset, or create branches/worktrees there.
  The user has uncommitted work in it at all times.
- On 2026-10-03 the user had every trace of the RN project removed from it. Keep it that way.
- To build the WebView bundle, `npm run web:build` copies the source to `C:\rn\web-src` and builds there.

**Reading vs. bundling (decided 2026-10-04, user said "do what's best"):**
- *Reading/porting* → the local working tree, including uncommitted edits (always the latest).
- *The web build bundled into the APK* → the **latest local commit** of aaaacursor (`HEAD`, which
  includes local commits not yet pushed), not uncommitted edits. Reason: the user always has
  half-finished work in progress there; shipping it inside an APK could put a broken screen in
  front of users, and a commit is reproducible (`web-bundle/.source-commit` records it).
  `web:build` must warn when aaaacursor has uncommitted changes in app code (they are NOT in the
  bundle) and offer `--working-tree` to bundle them only when the user explicitly asks.

Staying in sync: before porting or touching a screen, check what changed in the OG files since
the last port — `git -C <aaaacursor> log --oneline df0b289..HEAD -- <files>` plus
`git -C <aaaacursor> status --short -- <files>` — and port from the current files. After a port,
update the sync point here and in memory. **Current sync point: `503dc44` (OTA 47.0.7, 2026-10-05; since `2868d57`: web SEO/landscape layout, header refactor, content-sync version fix — native ports were the shared release request, 540 px Home tile thumbs and the smaller Home tile images). `web-bundle/` is built from `503dc44`.**

## 2. Goal and decisions (all agreed with the user)

- **Plan "3B":** the RN app will ship as an *update* of `com.cpbs.bhajans` (same package, users
  keep their data). Screens that are not native yet open the OG web screens in a WebView.
- **UI parity:** every native screen must look and behave exactly like the Capacitor app — same
  Janmashtami design tokens, colours, icons (lucide), spacing, Hindi text. Not a redesign. UX bugs
  may be fixed.
- **Home:** must be **native** (changed 2026-10-04; earlier plan was WebView), exactly like the
  Capacitor Home in UI and features.
- **Login:** native UI copied from the OG login (Google + phone OTP, same Firebase project
  `cpbs-admin`, same uids). The session is a **Firebase JS SDK** session on the OG *web* config and
  app name `profileApp` (`src/lib/webAuth.ts`) — byte-for-byte the record the WebView pages keep —
  with the Google ID token from `@react-native-google-signin` and the SMS check from
  `@react-native-firebase/auth` (`verifyPhoneNumber` → verificationId redeemed by the JS SDK, the
  same pairing the OG AuthContext uses on Android). No Cloud Function needed. See WEBVIEW-BRIDGE.md.
- **App version:** `app.json` version is `48.0.0` (OG native is 47) so the web code's
  `minNativeVersion` check passes; versionCode still to bump at release.
- **Profile:** its inside (family tree, QR, onboarding, ~6k lines) opens in a WebView.
- **WebView source:** the OG web build **bundled inside the APK**, served at `https://localhost`
  (same origin as the Capacitor app → old WebView data/login carry over after the update, works
  offline). Never point WebViews at the live website. Needs the Capacitor bridge + login handoff
  in [WEBVIEW-BRIDGE.md](WEBVIEW-BRIDGE.md) (user ordered it 2026-10-04).
- **Admin CMS** (~26.5k lines) is not ported — WebView.
- **Remaining screens (decided 2026-10-04):** everything not native yet (Calendar,
  Videos, Information, Donate, Glorification, Intro) stays a WebView screen for the first
  Play release; port them natively one by one after it. Activities is now native.
- **Guided product tour** and Settings' "Replay guided tour" row: do it **last** (user, 2026-10-04).
- **Testing:** keep building; test everything together on the phone later (user, 2026-10-04).
- Toolchain: Expo prebuild + dev client only. `expo-audio` (not react-native-track-player v4 /
  paid @rntp/player). Known gap: lock-screen controls are play/pause/seek only.

## 3. Status (2026-10-04)

Native and ported (code done, phone testing pending for the newer ones):
- Home (`HomeScreen` + `src/components/home/`) — exactly the Capacitor Home: profile notices,
  Aavirbhav card, Guru Maharaj carousel, diksha anniversaries, admin banners, the 24-tile grid
  (icons converted 1:1 to react-native-svg in `HomeIcons.tsx`, photo slideshows, NEW/LIVE flags),
  App Sevak, About footer. Data: `homeDataStore` (Firestore + GitHub releases/quotes, as in
  SharedFirebaseContext/SettingsContext) and `profileStore` (users/{uid} + family requests via the
  JS SDK on the devotee's login). Tiles for web screens open `Web {screen}` (`/?screen=…`).
  NEW badges: `lib/newBadge.ts` on the shared web storage (`lib/webStore.ts`, see WEBVIEW-BRIDGE).
  Not yet: the help pop-up's "App Tour" row (comes with the tour).
- Bhajans list (`SongsScreen`) — sticky letters, A–Z slider, search with highlight, filter sheet, voice search
- Bhajan reader (`BhajanReaderScreen`) — font panel, pinch zoom, book mode, playlist star, share, audio
- Audio tab (`LecturesScreen`) — Kirtans / Katha / Singers / Playlists, docked player, downloads
- Books (`BooksScreen`) + PDF reader (`BookViewerScreen`, opens the downloaded file, bookmarks)
- History (`HistoryScreen`) — tabs like HistoryAuthorsScreen
- Settings (`SettingsScreen`) — 5 cards; UI size works (`modules/ui-scale`: scales React Native's
  density, JS reload, Settings reopens); scrollbar side works (`SideScrollView`, RTL trick);
  Drive backup (`src/lib/backup.ts`, `BackupRestoreSection`, `AutoBackupManager` — same file format
  and Drive file as OG); Developer Mode opens the web Settings and triple-taps its button
- Login (`LoginScreen`), Profile = web screen with the login handed over
- About (`AboutScreen`) — mapped all UI elements, layout, and language toggles natively
- Privacy policy (`PrivacyPolicyScreen`) — static text natively, "Delete Account" opens web screen per rule
- Terms of service (`TermsOfServiceScreen`) — mapped UI natively
- Temple timings (`TempleTimingsScreen`) — natively mapped UI, reads admin_roles for available mandals, properly synced with `preferred_temple` localStorage key via `webGet`/`webSet`.
- Our Centers (`OurCentersScreen`) — mapped UI natively with `jmColors`, added WhatsApp and Maps linking.
- Daily Quotes (`DailyQuotesScreen`) — ported UI natively, matching date calculations and gesture-based pinch zoom lightbox.
- Glorification Reader (`GlorificationReaderScreen`) — ported natively. Reads from Firestore `hhbsm-2026-glorification` (published IDs from `app-settings/glorification-reader`). Groups entries by uid, sorts unvisited first. Tracks visited entries via `webStore` keys `visitedGlorifications` / `allGlorificationsReadHash` (same as OG). No Firestore writes. "Write now" button still opens WebView (audio permission + rebuild needed).
- Vaishnav Calendar (`VaishnavCalendarScreen`) — ported UI natively. Uses `astronomy-engine` for celestial math and `date-fns` for layout, identically to the OG app (`gaurabda.ts`). Fetches `Calendar` Firestore collection via `homeDataStore`. Reads/writes `cpbs_events_view_mode` and `cpbs_events_location` to `webStore` for cross-platform persistence.
- Side menu (`SideMenu`), Downloads (`DownloadsScreen`)
- Donate (`DonateScreen`) — ported UI natively with multi-step flow (selection, payment, confirm). Uses `react-native-blob-util` for QR download.
- WebView screens (`WebScreen`) with the Capacitor bridge (`src/webview/capacitorBridge.ts`,
  file/download/upload plugins in `src/webview/filePlugins.ts`)
- Data migration from the old app (`src/lib/migrateOldApp.ts`, `OldAppMigration`)
- App shell: `AppHeader`, floating `BottomNav`, `MiniPlayer`, toasts, download confirm
- App-level parts of the OG App.tsx (`src/components/AppStartup.tsx`, added 2026-10-04 after a
  parity audit): push notifications (`modules/app-notifications` = port of
  CustomFirebaseMessagingService + channels + notisound3, `plugins/withAppNotifications.js`
  removes RNFirebase's own messaging service; `src/lib/notifications.ts` = permission, topic
  "all", token in fcm_tokens/android, tap → `lib/appNav.openNotification`), the
  NotificationsPermissionScreen blocker (`NotificationsGate`), chaitanyaprembhakti.org links
  (`lib/deepLinks.ts` → `appNav.openSiteLink`), the first-run intro (web OnboardingScreen; its
  language/theme/size picks are copied into native settings), the daily quote popup
  (`QuotePopup`), ForceUpdateScreen (`ForceUpdateGate`, app_config/version_control), and the
  admin records app_version_stats / user_last_seen / user_usage (`lib/appTracking.ts`).
  Downloads is a hidden tab inside the tab shell (as App.tsx's "downloaded" view). History and
  Audio → Playlists show the titled Backup & Restore card; a "Favorites" playlist always exists.

Parity audit 2026-10-04 (browser, side by side with the OG web build): Home, Bhajans, reader,
Audio, Books, History, Settings, side menu, Downloads, Login match in text and look (light and
dark). Known deliberate differences: no "Replay guided tour" row (tour comes last), "Check for
Updates" opens the Play Store (no OTA in RN), the menu footer shows the app version (48.x).

Still to do, in order (everything above is code-complete, untested on the phone):
1. Full phone test round (ask the user first; not started yet)
2. Guided tour (last)
3. Play release: remove `withTestBuild` from app.json, real upload key, versionCode bump
4. Port the WebView screens natively, one by one (Step 0 done — see below)

**Step 0 complete (2026-10-05, Antigravity):** `NATIVE_SCREENS` map added to `src/lib/appNav.ts`.
All screen-name openers now route through it:
- `openScreen()` checks the map before falling back to `openWeb`
- `openNotification()` checks the map for `action_type: "screen"` pushes
- `openSiteLink()` now handles `/about`, `/privacy`, `/terms` site paths
- `HomeScreen` local `screen()` helper calls `openScreen()` instead of `openWeb` directly
- `SideMenu` items (information, donate, timings, about, privacy) call `openScreen()` instead of `openWeb({ menu: ... })`
- `AppStartup` QuotePopup `onOpenFull` calls `openScreen("quotes")`
To turn a screen native: uncomment its line in `NATIVE_SCREENS`. To revert: comment it out.

**Activities native port (2026-10-06):** `ActivitiesScreen` now uses `homeDataStore` for
mandals, activity folders, releases and videos. It preserves the OG activity, photo-gallery,
mandal-detail, date-chip, view-mode, story, metrics, download and NEW-badge flows. Shared
web storage keys include `cpbs_activity_view_mode`, `cpbs_activity_video_main_latest`,
`cpbs_activity_photos_main_latest`, `cpbs_activity_gallery_*`, `cpbs_activity_info_*`,
`cpbs_activity_videos_latest_*`, `cpbs_home_activity_latest` and `cpbs_seen_visit_photos`.
Browser preview comparison was done at 375x812 in Hindi/English and light/dark. Phone-only
checks remain for native photo sharing/download behaviour, haptics, and real Firestore metrics.

## 4. How to build and test

- Build only from `C:\rn\mobile` (short path — long Windows paths break the C++ build).
  Android Studio opens `C:\rn\mobile\android`. Gradle **9.3.1**, JDK **17** (pinned by
  `plugins/withTestBuild.js`); refuse Studio's Gradle/AGP upgrade prompts; never
  `newArchEnabled=false`.
- `android/` is gitignored; `npx expo prebuild` regenerates it. Native changes go into
  `plugins/`, `modules/`, `patches/` or `scripts/fix-windows-cxx-paths.js`, never by hand.
- User-facing step-by-step guide: `ANDROID-BUILD-GUIDE.html` (Hinglish). Update it if build steps change.
- Every test build installs as **`com.cpbs.bhajans.rntest`** ("Prem Bhakti RN"), beside the real app.
- Build settings (2026-10-05, `plugins/withBuildSettings.js` + `withTestBuild.js` + app.json
  expo-build-properties): Gradle 4 GB + build cache, ABIs armeabi-v7a+arm64-v8a (test builds
  arm64-v8a only), R8 minify + resource shrinking in release with keep rules in app.json, PNG
  crunch off. FCM default channel in `firebase.json` (push_notifications_v6, as OG); status-bar icon `ic_stat_notify` (modules/app-notifications). Icons and
  splash are the OG art (they were Expo placeholders until 2026-10-05).
- User guides (Hinglish, HTML): `ANDROID-BUILD-GUIDE.html` (APKs), `WEB-PREVIEW-GUIDE.html`
  (browser preview), `EXPO-PHONE-GUIDE.html` (debug/dev build + Metro on the phone). Keep each
  current when its process changes.
- **Browser preview** (user asked 2026-10-04 to test in the browser, not the emulator): `npm run
  web:preview` (serves `web-bundle/` on :8090 for the WebView screens) + `npm run web` (the app on
  :8081), or the two entries in `.claude/launch.json`. Native-only packages are swapped for
  `web-shims/` by `metro.config.js` (web only); WebViews become iframes. It reads the live
  Firebase project but never writes: the RN side's writes are skipped and the preview server
  blocks Firestore writes from the web pages. No pushes, Google/phone login, downloads or PDFs
  in the browser — those need the phone. Use one browser tab for the app (iframes share storage).
- Phone: Samsung Galaxy M55. **Ask the user to plug it in before testing.** Use `adb -s <serial>`.
  Never uninstall/clear/overwrite `com.cpbs.bhajans`. Never open an APK on the PC (it launches
  BlueStacks). Don't reset the Android emulator.

## 5. Working rules

- Commit and push in this repo only after the user says yes.
- Write user-facing replies in simple Hinglish; say what was done, what was tested, what is left.
- Media URLs go through the CDN helpers in `src/lib/cdnUrl.ts` (copied from the OG app).
- Copy shared logic (theme `src/theme/jmColors.ts`, `textProcessor`, `bhajanClassifier`, `data/*`)
  from the OG app instead of rewriting it.

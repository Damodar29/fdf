# Handoff: porting the remaining WebView screens to native

Read this whole file before you change anything. It is written for an AI coding agent
(Antigravity with Claude or Gemini) taking over from an earlier Claude Code session.
Then read `docs/context/PROJECT-CONTEXT.md`, `docs/context/WEBVIEW-BRIDGE.md` and
`docs/context/HISTORY.md`. Those three files are the project's memory. Keep them current.

The user talks in Hinglish (Hindi in Latin letters + English). Reply in simple Hinglish.
Keep code, comments and docs in English.

---

## 0. Hard rules (breaking any of these causes real damage)

1. **Work only in `C:\rn\mobile`.** Never write, build, `npm install`, `git checkout`,
   `git stash`, `git reset`, `git clean`, or create branches or worktrees in
   `C:\Users\damod\OneDrive\Desktop\aaaacursor`. That folder is the OG app. It is
   **read-only** for you, and the user has uncommitted work in it all the time.
   Reading files there is fine and expected.
2. **Never open, read, upload, commit or bundle** `C:\rn\web-src\serviceAccountKey.json`,
   `play-store-key.json`, `b2_keys.json` or `.env`. They are secrets.
3. **Git:** commit and push only after the user says yes in chat. After each finished
   screen, ask: "commit/push kar doon?". Never use `--force`. Never rewrite history.
4. **Toolchain is pinned.** Gradle **9.3.1**, JDK **17**. Do not upgrade them. Never set
   `newArchEnabled=false`. Do not upgrade Expo, React Native or any package unless the
   user asks. Do not run `npm audit fix`.
5. **Do not touch `android/` by hand.** It is generated (`npx expo prebuild`) and gitignored.
   Native changes go into `plugins/`, `modules/`, `patches/` or `app.json`.
6. **Keep `plugins/withTestBuild.js` in `app.json`.** Remove it only when the user asks
   for the Play Store release.
7. **Phone testing:** the user's phone is a Samsung Galaxy M55.
   - Ask the user to plug it in **before** any phone test.
   - Install only `com.cpbs.bhajans.rntest` ("Prem Bhakti RN"), with `adb -s <serial>`.
   - **Never** uninstall, clear or overwrite `com.cpbs.bhajans`. That is the real app with
     real users' data.
   - Never open an `.apk` on the PC (it launches BlueStacks). Never start BlueStacks.
     Never reset the Android emulator. Prefer the browser preview (section 5) over any
     emulator.
8. **The browser preview must never write to the live Firebase.** It is built that way
   (section 5). Do not add code that writes to Firestore from the web shims or the
   preview server. Do not "test" a write against the real database.
9. **Do not delete or mention** `aaaacursor\.claude\worktrees\react-native-android-migration-db652b`.
10. **The guided product tour** ("App Tour", "Replay guided tour") comes **last**.
    Do not start it.
11. **Do not redesign.** Every native screen must look and behave exactly like the OG
    (Capacitor) screen: same colours, icons, spacing, Hindi/English text, order and states.
    You may fix clear UX bugs, but say which ones you fixed.
12. **Expo SDK 57 changed APIs.** Before using an Expo API, read the versioned docs at
    https://docs.expo.dev/versions/v57.0.0/. Do not rely on memory of older SDKs.
13. **If unsure, stop and ask the user.** Do not guess about anything in rules 1–8.

---

## 1. What exists today

- **OG app:** React 19 + Vite + Capacitor 7 + Firebase, in `aaaacursor`. It is the Play
  Store app `com.cpbs.bhajans` and the site chaitanyaprembhakti.org.
- **This repo:** Expo SDK 57 / React Native 0.86 (New Architecture), TypeScript, zustand
  stores, MMKV storage, React Navigation (native stack + bottom tabs). It will ship as an
  update of `com.cpbs.bhajans` (plan "3B").

**Already native:**
- Home, Bhajans list, Bhajan reader, Audio (Lectures), Books and the PDF reader, History,
  Settings, Login, Side menu, Downloads.
- App-level parts: notifications, quote popup, force update, deep links, trackers.

**Still WebView screens** (the OG web build is bundled in the APK and served at
`https://localhost` inside `src/screens/WebScreen.tsx`):

| Screen | OG file (aaaacursor) | Lines | `?screen=` name | Opened from (RN) |
|---|---|---|---|---|
| About | `components/AboutScreen.tsx` | 506 | `about` | Home tile, SideMenu (`menu-about`) |
| Privacy policy | `components/PrivacyPolicyScreen.tsx` | 265 | `privacy` | SideMenu (`menu-privacy`) |
| Terms of service | `components/TermsOfServiceScreen.tsx` | 158 | — | Only the site link `chaitanyaprembhakti.org/terms` (OG `hooks/useDeepLinking.ts`). The OG SideMenu has an unused `onOpenTerms` prop and shows no Terms item. |
| Guru Maharaj | `components/GuruMaharajScreen.tsx` | 170 | `guru-maharaj` | Home `HeroCarousel` (`onOpenGuru` in `HomeScreen.tsx`), banners, pushes |
| Virahi Maharaj | `components/VirahiMaharajScreen.tsx` | 134 | `virahi-maharaj` | Home `HeroCarousel` (`onOpenVirahi`), banners, pushes |
| Temple timings | `components/TempleTimingsScreen.tsx` | 463 | `temple-timings` | Home tile, SideMenu (`menu-timings`) |
| Our centers (Seva) | `components/SevaCenterScreen.tsx` | 487 | `seva` | Home tile |
| Daily quotes | `components/DailyQuotes.tsx` | 824 | `quotes` | Home tile, QuotePopup, pushes |
| Information | `components/InformationScreen.tsx` (+ `CommentsSection`) | 767 | `information` (`target_info_id`) | Home tile, SideMenu, pushes |
| Glorification reader | `components/GlorificationReaderScreen.tsx` | 428 | — (`buttonText`) | Home Aavirbhav card |
| Glorification write | `components/GlorificationModal.tsx` | 1056 | — (`buttonText`) | Home Aavirbhav card |
| Vaishnav calendar | `components/EventsScreen.tsx` + `services/GaurabdaService.ts` | 1173 + 404 | `events` | Home tile |
| Videos | `components/VideosScreen.tsx` (+ `YouTubePlayer`) | 1049 | `videos` | Home tile, pushes |
| Donate | `components/DonateScreen.tsx` | 1332 | `donate` | Home tile, SideMenu |
| Deity darshan | `components/DailyDarshanScreen.tsx` | 1570 | `darshan` (`target_mandal`, `target_date`) | Home tile, pushes |
| Activities / past event media | `components/ActivitiesScreen.tsx` | 2952 | `activities`, `photos` | Home tiles, pushes |

**Stay WebView (do NOT port):**
- Profile (`ProfileScreen.tsx`, ~6k lines plus family tree and QR).
- Admin panel (~26k lines).
- Onboarding/intro.
- The Instagram/Facebook pages.

Line counts are from OG commit `503dc44`. Re-check them, because the OG keeps changing.

---

## 2. Architecture you must understand first

Read these files fully before porting anything:

- `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx`: the root stack (Tabs,
  Reader, Lecture, BookViewer, Settings, Web, Login) and the tabs. A ported screen becomes
  a **new root-stack route** (like `Settings`), opened with
  `animation: "slide_from_right"`.
- `src/lib/appNav.ts`: the **single place** that decides where a screen name goes:
  - `openScreen(name)`: Home banners, pushes and `?screen=` links.
  - `openNotification(data)`: tapped pushes. Its native list is
    `["home","songs",…,"profile"]`.
  - `openSiteLink(url)`: chaitanyaprembhakti.org links.
  - Anything it does not know goes to `openWeb(...)`.
- `src/screens/HomeScreen.tsx`: the Home tiles call `screen("darshan")`,
  `screen("events")` and so on. This is a local helper that opens the web screen. When a
  screen becomes native, these calls must use the native route.
- `src/components/SideMenu.tsx`: menu items call `openWeb({ menu: "menu-…" })`.
- `src/screens/WebScreen.tsx`, `src/webview/capacitorBridge.ts`: how web screens run.
  You do not need to change them for a port. Just stop sending that screen there.
- `src/lib/webStore.ts`, `src/lib/newBadge.ts`: **shared web storage**. The web screens'
  localStorage keys (NEW-badge "seen" markers, `cpbs_read_info_ids`, `cpbs_liked_info`,
  `cpbs_viewed_info`, view modes like `cpbs_darshan_view_mode`, `cpbs_seen_visit_*`, and so
  on) are mirrored into MMKV.
  - A native screen **must read and write the same keys** through `webGet` / `webSet` /
    `markSeen` / `useClearOnVisit`.
  - Then Home's NEW badges, the Drive backup and any web screen stay consistent.
  - The exact key names are in `BACKUP_SETTINGS_KEYS`, `BACKUP_SINGLE_KEYS` and
    `BACKUP_PREFIXED`. Copy key names from the OG source. Never invent new ones for
    existing data.
- `src/store/homeDataStore.ts`: data Home already loads and you should **reuse**, not
  fetch twice:
  - `mandals`, `videos`, `videoFolders`
  - `activityFolders`, `activityReleases`, `darshanFolders`, `darshanReleases`
  - `information`, `quotesImages`, `quoteToday`, `social`, `banners`
  - glorification flags
- `src/store/profileStore.ts`, `src/store/authStore.ts`, `src/lib/webAuth.ts`: the
  logged-in user (Firebase JS SDK session, app name `profileApp`).
  - Screens that need the user (likes, comments, donate form) use this.
  - Firestore reads in screens use the JS SDK or `@react-native-firebase/firestore`, the
    same way existing stores do. Look at `homeDataStore.ts` and copy its style.
- **Theme:**
  - `src/theme/jmColors.ts`: copied from the OG `tailwind` tokens. It is the only source
    of colours.
  - `src/theme/colors.ts`: `cream`, `gold`, `ink`, `krishna`, `janmashtami`, `serif`, …
  - `src/theme/useAppTheme.ts`: `useAppTheme()` gives `isDark`, `primary` and the palette
    ramp `p[50..900]`.
  - **Never hardcode a hex colour.** If a colour is missing, add it to the theme file,
    taken from the OG `tailwind.config.*` / `jmColors`.
  - Dark mode = the OG `dark:` classes. Every screen must be checked in light **and**
    dark.
- **Icons:** `lucide-react-native`, with the same icon names as `lucide-react` in the OG.
  Custom OG SVG icons are converted 1:1 with `react-native-svg`. See
  `src/components/home/HomeIcons.tsx` for examples.
- **Text:** Hindi/English from `useSettingsStore` (`settingsLanguage`). Copy every string
  exactly from the OG file, in both languages.
- **Images:** `expo-image`. Media URLs go through `src/lib/cdnUrl.ts` (`toCdnUrl`) and
  `src/lib/imageThumb.ts` (`thumbUrl`, `THUMB.*`), exactly as the OG calls
  `utils/imageThumb.ts` / CDN helpers. Always fall back to the original URL when the thumb
  fails (see `SlideshowCard` in `src/components/home/HomeTiles.tsx`).
- **Lists:** `@shopify/flash-list` for long lists (see `HistoryScreen.tsx`, `SongsScreen.tsx`).
- **Haptics:** `triggerHaptic("light")` from `src/lib/haptics.ts` wherever the OG calls
  `triggerHaptic`.
- **Toasts:** `showToast` from `src/store/toastStore.ts`.
- **UI size:** the app scales the whole density natively (`modules/ui-scale`). Do not
  multiply sizes by `uiScale` yourself unless the OG does it for that element.
- **Back button:** Android back must close the screen (stack pop). Look at how
  `SettingsScreen` gets `onBack` from its route wrapper in `RootNavigator.tsx`.

**Good examples to copy patterns from:**
- `src/screens/SettingsScreen.tsx`: a full-screen overlay with a header, cards and dark
  mode.
- `src/screens/HistoryScreen.tsx`: tabs and lists.
- `src/components/home/*`: cards, gradients, slideshows, flags.
- `src/components/QuotePopup.tsx`, `src/components/ForceUpdateGate.tsx`: small ports of
  OG components.

---

## 3. Step 0 — do this once, before the first screen

**Goal:** turning a screen native (or back to web) is a one-line change.

1. In `src/lib/appNav.ts`, add one map: OG screen name → native route. For example:
   ```ts
   /** Screens that are native now. Remove a line to send that screen back to the WebView. */
   export const NATIVE_SCREENS: Partial<Record<string, keyof RootStackParamList>> = {
     // about: "About",
   };
   ```
2. Use it in every place that opens a screen by name:
   - `openScreen()`: if `NATIVE_SCREENS[name]`, navigate there. Otherwise `openWeb`.
   - `openNotification()`: when `action === "screen"` and the target is in
     `NATIVE_SCREENS`, open it natively, passing push params such as `target_info_id`,
     `target_mandal` and `target_date` as route params.
   - `openSiteLink()`: if a site path maps to a ported screen.
   - `HomeScreen.tsx`: change the local `screen(name)` helper to call
     `openScreen(name)`.
   - `SideMenu.tsx`: map `menu-about → about`, `menu-privacy → privacy`,
     `menu-timings → temple-timings`, `menu-donate → donate`,
     `menu-information → information`, and call `openScreen`.
   - `AppStartup.tsx` / `QuotePopup`: they open `quotes`, so route them through
     `openScreen`.
3. Run `npx tsc --noEmit`. It must be clean.
4. Check in the browser preview that every tile and menu item still opens the web screen.
   The map is still empty, so nothing should change yet.
5. Commit only after the user says yes.

---

## 4. Porting one screen — the procedure (repeat per screen)

Do **one screen per session/branch**. Finish it completely (UI + data + states + dark mode +
both languages + navigation + verification) before starting the next.

**A. Sync check (mandatory)**

In PowerShell, using the current sync point from `docs/context/PROJECT-CONTEXT.md`
(currently `503dc44`):
```
git -C C:\Users\damod\OneDrive\Desktop\aaaacursor log --oneline 503dc44..HEAD -- components/<File>.tsx <its imports>
git -C C:\Users\damod\OneDrive\Desktop\aaaacursor status --short -- components/<File>.tsx <its imports>
```
- Always port from the **current files in the working tree**, including uncommitted edits.
- Note what changed, if anything.

**B. Read the OG screen completely**
- Read the screen file and every local import it uses: contexts, hooks, utils, child
  components.
- Find how `App.tsx` opens it, with which props, and what happens on close/back.
- List all of the following in a short note in your plan before you write code:
  - every piece of state, every Firestore/REST/GitHub read and write, and every
    localStorage key
  - every string (hi + en)
  - every animation
  - every empty/loading/error/offline state

**C. Look at the real OG screen**
- Start the preview (section 5).
- Open `http://localhost:8090` (the OG web build) in a phone-sized viewport (375×812).
  Open the screen there the same way a user would.
- Take screenshots in light and dark, in Hindi and English, scrolled through the whole
  screen. These screenshots are your spec.

**D. Write the native screen**
- `src/screens/<Name>Screen.tsx`. Split big screens into `src/components/<name>/*`, the way
  `components/home/` is split.
- Data helpers go in `src/store/` or `src/lib/`. **Reuse `homeDataStore`** when it already
  has the data.
- Add the route to `RootStackParamList` (`types.ts`), with params for push targets, and a
  route wrapper plus `<RootStack.Screen>` in `RootNavigator.tsx`.
- Add the screen to `NATIVE_SCREENS`.
- Copy pure logic (date maths, classifiers, formatters) from the OG file **verbatim**,
  then add types. Do not rewrite it. For example, `services/GaurabdaService.ts` →
  `src/lib/gaurabda.ts`. `astronomy-engine` is already installed.
- Writes the OG makes (likes, views, comments, donation records):
  - Port them with the same collection/field names.
  - Guard every write with `if (Platform.OS === "web") return;` (or go through the
    existing web shim), so the browser preview never writes to live Firebase.
- **No new npm packages without asking the user first.**
  - A package with native code also needs a new APK build (`npx expo prebuild`, then a
    Gradle build).
  - Prefer what is installed: expo-image, expo-linear-gradient, react-native-svg,
    reanimated, gesture-handler, flash-list, react-native-youtube-iframe, expo-sharing,
    expo-clipboard, expo-web-browser, react-native-blob-util, date maths with plain JS.
- If the OG renders HTML (Guru/Virahi use DOMPurify + `dangerouslySetInnerHTML`):
  1. First look at the real content in Firestore (read only) to see which tags are used.
  2. If it is simple (`p`, `br`, `b`, `strong`, `i`, `em`, `h1–h4`, `ul/li`, `a`), write a
     small HTML-to-`<Text>` renderer in `src/lib/simpleHtml.tsx`.
  3. Ask the user before adding a library for it.

**E. Verify (all must pass before you say "done")**
1. `npx tsc --noEmit`: no errors.
2. The browser preview, side by side with the OG at `:8090`, same viewport. Compare:
   layout, spacing, fonts, colours, icons, texts, light + dark, hi + en, empty/loading
   states, long text, scrolling, back button, every tap target.
3. Every entry point opens the native screen: Home tile, side menu, `__appNav.openScreen("<name>")`,
   and a push. In the browser console:
   ```
   __appNav.openNotification({action_type:"screen", target_screen:"<name>"})
   ```
   Also check the push params (`target_info_id`, `target_mandal`/`target_date`).
4. NEW badges on Home still clear when you visit the screen, and stay cleared after a
   reload (same webStore keys).
5. Remove the screen from `NATIVE_SCREENS` once. It must open as a web screen again.
   Then put it back.
6. Things the browser cannot test go in a list for the phone round: real push taps,
   downloads/sharing files, YouTube player, haptics. Tell the user.

**F. Finish**
- Update `docs/context/PROJECT-CONTEXT.md` (status list, sync point if it moved) and
  `docs/context/HISTORY.md` (date, what was ported, bugs found, what is untested).
- Report to the user in Hinglish:
  - what was done
  - what was tested and how
  - what is left or untested on the phone
- Ask "commit/push kar doon?".

---

## 5. Browser preview (how to see and test the app)

Guide for humans: `WEB-PREVIEW-GUIDE.html`. Short version, with two terminals in
`C:\rn\mobile`:
```
npm run web:preview     # OG web build (web-bundle/) on http://localhost:8090 — needed by WebView screens
npm run web             # the RN app on http://localhost:8081
```
- Open `http://localhost:8081` in **one** browser tab only. Iframes share storage, so two
  app tabs interfere with each other.
- Use DevTools device mode at 375×812.
- `metro.config.js` swaps native-only packages for `web-shims/` on web, and WebViews become
  iframes.
- Firestore writes are skipped on the RN side, and the preview server blocks them for the
  web pages.
- Dev hooks in the console:
  - `__nav`: the navigation ref, for example `__nav.navigate("Settings")`.
  - `__appNav`: `openScreen`, `openNotification`, `openSiteLink`, `openContentById`.
- If `web-bundle/` is missing or the OG has a newer commit, run `npm run web:build`. It
  copies the OG's latest **commit** to `C:\rn\web-src` and builds there. Never build inside
  aaaacursor.
- Not testable in the browser: pushes, Google/OTP login, downloads, PDFs, UI-size, the real
  YouTube player. Those need the phone, and the user must agree to a phone test first.
- If Metro shows a stale UI: `npx expo start --web --clear`.

On the phone, with the user's permission only: see `EXPO-PHONE-GUIDE.html` (debug build +
Metro) and `ANDROID-BUILD-GUIDE.html` (release APK). A full release build takes about
12–15 minutes. Do not start one unless the user asks.

---

## 6. Recommended order (easy → hard) and screen notes

Port in this order. Each step teaches the patterns the next one needs.

1. **About** (`AboutScreen.tsx`): static content (imports only `react` and
   `lucide-react`). Opened from the Home tile, the side menu (two places), `?screen=about`
   and the site link `/about`.
2. **Privacy policy** (`PrivacyPolicyScreen.tsx`): static text in hi/en, with its own
   language toggle (`lang` state). It has one action, **"Delete Account & Data"**:
   - It shows a confirm dialog, then calls `AuthContext.deleteAccount()`, then
     `localStorage.clear()`, then closes.
   - `deleteAccount` (OG `context/AuthContext.tsx`, around line 1613) does all of this:
     1. a soft delete in `users/{uid}`: `isDeleted`, `deletedAt`, `scheduledDeletionDate`
        (merge)
     2. deletes the online backup
     3. `deleteUser`
     4. signs out
     5. removes `onboarding_dismissed_<uid>`, `profile_draft_<uid>` and
        `cpbs_linked_family_v1_<uid>`
   - The RN app has **no** `deleteAccount` yet. Port it into `src/lib/webAuth.ts` /
     `authStore` with exactly these steps, then call the existing `signOut()` in `src/lib/webAuth.ts` (it also signs out
     Google).
   - **This button deletes a real account. Never press it while testing, never test it
     against a real user, and guard it on web.** Ask the user how they want to test it
     (for example a throwaway test account they create themselves). Until then you may
     leave only this button opening the web Privacy screen.
3. **Terms of service** (`TermsOfServiceScreen.tsx`): static. The only way in is the site
   link `/terms`.
   - **Site paths:** `openSiteLink()` in `src/lib/appNav.ts` does not handle `/privacy`,
     `/terms` or `/about` yet, and returns false for them, so they open in the browser.
     The OG opens them in the app (`hooks/useDeepLinking.ts`, around line 313). Add them
     when you port these three screens.
4. **Guru Maharaj / Virahi Maharaj**: one Firestore doc each, read once with `getDoc`:
   - `app_config/guru_maharaj` for Guru Maharaj and `app_config/virahi_maharaj` for Virahi
     Maharaj.
   - The content is HTML sanitised with DOMPurify. Use a small native renderer (section
     4D). Share one component between the two screens.
5. **Temple timings** (`TempleTimingsScreen.tsx`): uses `mandals`. Reuse
   `homeDataStore.mandals` and `src/data/mandals.ts`. Uses the `preferred_temple` key.
6. **Our centers** (`SevaCenterScreen.tsx`): the same mandal data. Map/phone/WhatsApp links
   use `Linking`.
7. **Daily quotes** (`DailyQuotes.tsx`): quote images from GitHub release "1". Reuse
   `homeDataStore.quotesImages`. Covers save/share of an image (expo-sharing + blob-util)
   and the `cpbs_quote_last_seen_*` keys.
8. **Information** (`InformationScreen.tsx` + `CommentsSection.tsx`):
   - Items come from `homeDataStore.information`.
   - Read/like/view markers: `cpbs_read_info_ids`, `cpbs_liked_info`, `cpbs_viewed_info`,
     `cpbs_last_read_info_title`. Home's "new information" dot depends on them.
   - Push param `target_info_id` opens one item.
   - Comments write to Firestore, so guard them on web.
9. **Glorification reader** (`GlorificationReaderScreen.tsx`):
   - Keys `allGlorificationsReadHash` and `visitedGlorifications`. Home's "नई महिमाएं"
     badge depends on them.
   - The reader reads the Firestore collection `hhbsm-2026-glorification`.
   - Then the **write form** (`GlorificationModal.tsx`, 1k lines). It has a **text** tab
     and an **audio** tab.
     - Audio is recorded with the browser's `getUserMedia` / `MediaRecorder` and uploaded
       to Backblaze B2 through `src/utils/b2Uploader.ts` (`uploadFileToB2` → a Cloudflare
       worker), into `hhbsm-2026-glorification-audios/`. Helpers are in
       `src/utils/hhbsmGlorificationStorage.ts`.
     - Natively, recording would need `expo-audio`'s recorder (installed) **plus** the
       `RECORD_AUDIO` permission in `app.json`. That means a new APK build, and it is a
       user decision.
     - **Recommended:** port the reader natively, and keep the write form as a WebView
       screen (it is opened with `buttonText: ["Write now", "अभी लिखें"]`) until the user
       agrees to the audio permission and the rebuild.
10. **Vaishnav calendar** (`EventsScreen.tsx` + `GaurabdaService.ts`):
    - Copy the service verbatim. `date-fns` is not installed. Either ask the user to add it
      (JS-only, no rebuild) or replace the few calls with small helpers.
    - Key `cpbs_events_view_mode`, plus `panchang_location`.
11. **Videos** (`VideosScreen.tsx` + `YouTubePlayer.tsx`):
    - Data in `homeDataStore.videos` / `videoFolders`.
    - Player: `react-native-youtube-iframe` (installed).
    - Keys `cpbs_video_folder_latest_*`, `cpbs_home_video_latest`. Includes share/copy
      link.
    - The `/v/<id>` and `?videoId=` links (`openSiteLink`) should open the native player
      when ported.
12. **Donate** (`DonateScreen.tsx`):
    - Form, QR/UPI, receipt/file download (`@capacitor/file-transfer`, `filesystem`), so
      use react-native-blob-util like `src/webview/filePlugins.ts` does.
    - Uses the logged-in user.
    - **Never enter real payment details while testing.**
    - The UPI intent opens the user's payment app. Test that only on the phone, and only
      with the user.
13. **Deity darshan** (`DailyDarshanScreen.tsx`, 1.5k lines):
    - Mandal list → dates → story-style photo viewer with zoom (`useStoryImageZoom`,
      `HorizontalGallery`). Reuse `homeDataStore.darshanFolders` / `darshanReleases`.
    - Keys `cpbs_darshan_view_mode`, `cpbs_darshan_mandal_*`, `cpbs_home_darshan_latest`,
      `cpbs_seen_visit_*`.
    - Push params `target_mandal`, `target_date`.
    - Use gesture-handler + reanimated for pinch zoom. The Bhajan reader already has
      pinch zoom you can learn from.
14. **Activities** (`ActivitiesScreen.tsx`, ~3k lines, the biggest):
    - Photos, videos and info per mandal. It reuses parts of Videos and Darshan, so port
      it last.
    - `?screen=photos` (`activities_photos`) opens its photo view.
    - Keys `cpbs_activity_*`, `cpbs_home_activity_latest`.

Profile, Admin and Onboarding stay WebView. Do not start them.

---

## 7. Known pitfalls (already solved — do not reintroduce)

- **Long Windows paths break the C++ build.** Only build from `C:\rn\mobile`.
- **The web app dedups `?screen=` opens for 18 h.** The WebView preload removes
  `cpbs_processed_notification_ids` (see HISTORY 2026-10-05). Native screens don't need
  this, but don't remove that preload line.
- **Reanimated entering animations stack items on web.** `enterUp` returns `undefined` on
  web (see `HomeTiles.tsx`). Do the same for any entering animation you add.
- **Inactive tabs showed on web.** `enableScreens(true)` is set on web in `index.ts`. Keep
  it.
- **Writes from the preview.** Once, before writes were blocked, a WebView in the preview
  wrote +1 to `app_version_stats`. Every new write path needs a web guard.
- **Two browser tabs share iframe storage.** Test with one tab.
- **AAPT "color not found"** happened when a colour was referenced from `firebase.json`.
  Keep native resources inside `modules/app-notifications`.
- **Don't fetch the same data twice.** `homeDataStore` already listens to most of the
  collections. The GitHub release list is shared through `fetchReleaseList()`.

---

## 8. Definition of done (per screen)

- [ ] Sync check done; ported from the current OG files.
- [ ] UI matches the OG screen in light/dark and hi/en (screenshots compared).
- [ ] All states: loading, empty, error/offline, long content.
- [ ] Same storage keys as the OG; Home NEW badges/dots behave the same.
- [ ] Every entry point (tile, menu, banner, push with params, site link) opens it natively.
- [ ] Back button and gestures close it; no flash or jump on open.
- [ ] No Firestore writes from the browser preview.
- [ ] `npx tsc --noEmit` clean; no new warnings in the Metro console.
- [ ] No new packages added without the user's yes.
- [ ] Docs updated (PROJECT-CONTEXT status, HISTORY entry).
- [ ] Reported to the user in Hinglish; asked before commit/push.

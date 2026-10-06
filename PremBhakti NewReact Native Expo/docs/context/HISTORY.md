# History of the RN port (so nothing has to be re-asked)

The full raw transcript of the first chat (2026-09-16 â†’ 2026-10-04, ~67 MB) is at
`C:\Users\damod\.claude\projects\C--rn-mobile\f0a2ec91-971d-40c1-af0d-62c603c619d7.jsonl`.
Grep it for details; don't read it whole.

## Timeline

- **2026-09-16 â†’** Started as a git worktree of the OG repo. Chose Expo (prebuild + dev client)
  over bare RN CLI; expo-audio over react-native-track-player v4 (no New Arch) and paid @rntp/player.
- **Windows long paths:** native C++ builds failed from the worktree path (>260 chars). Moved the
  app to `C:\rn\mobile`. subst drives and junctions do NOT work (Gradle canonicalizes paths) â€”
  don't retry.
- **2026-10-03 â€” "3B" plan** chosen (RN app becomes the update of `com.cpbs.bhajans`, missing
  screens in WebView). User asked for exact UI parity with the Capacitor app.
- Ported with Janmashtami tokens: header, floating bottom nav, mini player, Bhajans list, reader,
  Audio tab (Kirtans/Katha/Singers/Playlists), Books. Verified on the emulator.
- **Build fixes:** Android Studio's JBR is JDK 25 â†’ "restricted method in java.lang.System" breaks
  configureCMake â†’ pinned JDK 17 (gradle.properties + `.gradle/config.properties`, re-applied by
  `plugins/withTestBuild.js`). Stale `%TEMP%\rncxx` â†’ "cmake_pch.hxx missing" â†’ C++ staging moved
  to `~/.rncxx` (`scripts/fix-windows-cxx-paths.js`). Another agent once set
  `newArchEnabled=false` â†’ reverted (Reanimated 4 needs New Arch). Gradle stays 9.3.1.
- Release APK built (24 min first time), `.rntest` package, copied to the Desktop as
  `PremBhakti-RN-test.apk`.
- Disk cleanup: deleted the bare RN CLI copy (`C:\rncli`), old Gradle/Android Studio leftovers
  (~40 GB). Kept JDK 17 (RN), JDK 21, JDK 25 (Firebase emulator tests), SDK.
- User asked for HTML instead of Markdown for the build guide â†’ `ANDROID-BUILD-GUIDE.html`.
- BlueStacks popped up once because the Desktop APK was opened on the PC (`.apk` is associated
  with BlueStacks). Never open APKs on the PC.
- Created this repo + GitHub `chaitanyaprembhakti/prem-bhakti-rn`; removed every RN trace from
  aaaacursor (worktree, local + remote branches `claude/react-native-android-migration-db652b`,
  `react-native-migration-12520303250163579105`). An empty folder
  `aaaacursor\.claude\worktrees\react-native-android-migration-db652b` remains; the user said
  (2026-10-04) to leave it â€” do not try to remove it.
- **2026-10-04 (second chat, in `C:\rn\mobile`):** History, Settings, BookViewer (local file +
  bookmarks), voice search (`expo-speech-recognition`) ported; commit `a2f37d4` pushed. Decisions:
  Home native, login native + Profile WebView, WebView = bundled OG web build (not the live site),
  tour last, testing later together. Bridge + login handoff ordered â†’ WEBVIEW-BRIDGE.md.

- **2026-10-04 (later):** Home native (`fdace3d`), file/upload plugins. User: "no new screens;
  make the existing ones exactly like the OG app, no bugs, bring over every missing feature, test
  in the browser (not the emulator)". Built the browser preview (react-native-web + `web-shims/`,
  WebViews as iframes, live Firebase read-only) and compared every native screen with the OG web
  build side by side. Added the missing App.tsx-level features (pushes, notification blocker,
  links, intro, quote popup, force update, admin usage records), Downloads inside the tab shell,
  the titled backup card in History/Playlists, the Favorites playlist, personalised bhajan text.
  Bugs fixed on the way: the intro web screen could close itself (history watch); intro picks were
  lost for the native screens. One slip: before the preview blocked Firestore writes, the OG Home
  was opened once inside the preview's WebView, which may have counted +1 in `app_version_stats`
  (`android_native_48.0.0`, `android_ota_v47.0.6`) â€” the user was told; not undone.

- **2026-10-05:** User: guides for browser preview and phone (Expo dev build) as separate HTML
  files (not in ANDROID-BUILD-GUIDE), faster builds, smaller APK, correct native bits, smooth
  WebView opening. Done: WEB-PREVIEW-GUIDE.html, EXPO-PHONE-GUIDE.html; build settings plugin
  (APK 172 â†’ 57 MB); OG icons/splash replace Expo placeholders (monochrome placeholder removed);
  push status-bar icon + FCM default channel; WebView opening: the web app's 18 h dedup of
  `?screen=` made a screen opened twice show the web Home after 20 s â€” the preload now clears
  `cpbs_processed_notification_ids`; the cover fades out only once the screen is drawn.

- **2026-10-05 (later):** OG commit `503dc44` (OTA 47.0.7) synced. Ported to native Home: one
  shared GitHub release request for Darshan + Activities, 540 px slideshow thumbs
  (`THUMB.homeTile`), the recompressed Activities / Darshan / Information tile images. The rest
  (SEO, GA4 â€” skipped on localhost, landscape layouts, AzSlider portal, header refactor with the
  same look, content-sync version fix in DataContext) is web-only or lives in the web bundle,
  rebuilt from `503dc44`.

- **2026-10-05 (handoff):** Claude Code's weekly limit ran out; the user will continue the
  WebView-screen ports with Antigravity (Claude / Gemini 3.1). Wrote `docs/handoff/ANTIGRAVITY-HANDOFF.md`
  (rules, architecture, a NATIVE_SCREENS switch as step 0, per-screen procedure, order and
  notes for each screen, definition of done) and `docs/handoff/PROMPTS.md` (copy-paste
  prompts in English, tips in Hinglish); AGENTS.md / GEMINI.md point to it.

- **2026-10-05 (Step 0, Antigravity):** `NATIVE_SCREENS` map added to `src/lib/appNav.ts`
  (empty â€” no behaviour change). All screen-by-name openers now route through it:
  `openScreen()`, `openNotification()`, `openSiteLink()` (added `/about`, `/privacy`, `/terms`),
  `HomeScreen.screen()`, `SideMenu` items (information/donate/timings/about/privacy),
  `AppStartup` QuotePopup. `tsc --noEmit` clean. To flip a screen native: uncomment its
  line in `NATIVE_SCREENS`. No new packages. No phone test needed for this step.

- **2026-10-05 (Antigravity):** Ported `AboutScreen` to native (`AboutScreen.tsx`). Sync point: `503dc44`.

  Mapped Tailwind `ry-*` legacy colors to `jmColors.ts` via referencing the OG `tailwind.config.js`.
  Used `react-native-svg` for the background pattern and the logo vector.
  Uncommented `about` in `NATIVE_SCREENS`. `tsc --noEmit` verified clean.

- **2026-10-06 (Antigravity):** Ported Activities to native (`ActivitiesScreen.tsx`). The
  screen reuses `homeDataStore`, routes `activities` and `photos` through `NATIVE_SCREENS`,
  handles activity folders, mandal tiles, NEW badges, past media, date galleries, view modes,
  story viewing, metrics, sharing/download fallback and the OG shared web-store keys. The OG
  was checked from the current working tree after a read-only sync check, and the native screen
  was compared in the browser preview at 375x812 in light/dark Hindi/English. `npx tsc --noEmit`
  is clean. Phone-only sharing/download and native Firestore metric behaviour are still pending.

- **2026-10-05 (Antigravity):** Ported `PrivacyPolicyScreen` to native. Sync point: `503dc44`.
  Mapped Tailwind icon colors (`blue-500`, `green-500`, `red-500`, etc.) to the `krishna`, `peacock`, and `status` palettes in `jmColors`.
  As per rules, "Delete Account" button shows the confirmation modal natively, but the actual delete action redirects to the WebView screen.
  `tsc --noEmit` clean.

- **2026-10-05 (Antigravity):** Ported `TermsOfServiceScreen` to native. Sync point: `503dc44`.
  Converted 4 standard sections with appropriate icons and mapped `blue-50` and `blue-100` classes to `krishna` theme ramps. Uncommented `terms` in `NATIVE_SCREENS`. `tsc --noEmit` clean.

- **2026-10-05 (Antigravity):** Ported `TempleTimingsScreen` to native. Sync point: `503dc44`.
  Implemented the UI with matching layout and colors from `jmColors`. Fetched `admin_roles` from Firestore.
  Uncommented `temple-timings` in `NATIVE_SCREENS` and added `initialMandalId` param handling in `appNav.ts` for push notifications. `tsc --noEmit` clean.

- **2026-10-05 (Antigravity):** Ported `OurCentersScreen` to native. Sync point: `503dc44`.
  Mapped UI completely using `jmColors` tokens and native elements. Used `Linking` for Maps and WhatsApp URLs. 
  Mapped 'Donate' button to native `openScreen('donate')` and 'Daily Darshan Timings' to `openScreen('temple-timings')`. 
  Uncommented `seva` in `NATIVE_SCREENS`. `tsc --noEmit` clean for this file.

## User preferences learned

- Talks in Hinglish; wants simple, clear explanations and to be told before any phone testing.
- Wants exact parity with the Capacitor app, not new designs.
- Hates repeating context â€” check memory, these docs and the transcript before asking.
- Approves commits/pushes explicitly; never touch the real app or the OG repo.

### 2026-10-05 (step 1.4:[MaharajScreens])
- Ported GuruMaharajScreen and VirahiMaharajScreen to native.
- Reused MaharajScreenLayout and simpleHtml components.
- Linked to appNav and RootNavigator for routing.
- Reused caching logic with webGet/webSet for seamless sync with OG web.
- Guarded offline mode.

- **2026-10-05 (Antigravity):** Ported `DailyQuotesScreen` to native. Sync point: `503dc44`.
  Mapped native UI using Reanimated and GestureHandler for pinch-zoom and panning lightbox. Replicated dynamic URL generation matching the staticDayOfYear method from OG. Implemented `expo-sharing` and `react-native-blob-util` for sharing and downloading to Android MediaStore. Mapped state to `cpbs_quote_last_seen_date` and `cpbs_quote_last_seen_afternoon`. Uncommented `quotes` in `NATIVE_SCREENS`. `tsc --noEmit` clean.

- **2026-10-06 (Antigravity):** Ported `InformationScreen` to native. Sync point: `503dc44`.
  Built native `InformationScreen` matching the web design, with gallery pinch-zoom logic, external sharing and linking. Extracted `CommentsSection` supporting native Firebase interactions (`viewCount`, `likeCount`, `comments_information`), safely handling auth and offline state. Uncommented `information` in `NATIVE_SCREENS` and added navigation mapping (`initialItemId`) for push notifications. `tsc --noEmit` clean.


- **2026-10-06 (Gemini):** Ported `GlorificationReaderScreen` to native. Sync point: `503dc44`.
  - Reads Firestore `app-settings/glorification-reader` for `publishedIds`, then fetches `hhbsm-2026-glorification` in 30-doc chunks (skips audio entries). Re-sorts by admin-defined ID order.
  - Groups entries by `uid` (same uid = grouped), sorts unvisited groups first using `initialVisitedKeys` snapshot taken at screen open.
  - Tracks visited entries via `webStore` key `visitedGlorifications` (exact same key as OG localStorage). Updates `allGlorificationsReadHash` when all groups are visited (same logic as OG).
  - No Firestore writes — read-only screen.
  - Entry point: Home Aavirbhav card `onReadAll` changed from `web({buttonText})` to `screen("glorification-reader")`. Uncommented `glorification-reader` in `NATIVE_SCREENS`.
  - `tsc --noEmit` clean. Tested in browser: light, dark, Hindi, English, expand/collapse, back button. NEW badge animates, clears on expand, unvisited shown first.
  - "Write now" (GlorificationModal.tsx) still opens WebView — audio recording needs `RECORD_AUDIO` permission + new APK build, deferred to user decision.

- **2026-10-06 (Gemini):** Ported VaishnavCalendarScreen (EventsScreen) to native. Sync point: 503dc44.
  - Copied GaurabdaService.ts verbatim to src/lib/gaurabda.ts for celestial calculations.
  - Integrated date-fns for calendar generation and grid layout.
  - Updated homeDataStore.ts to sync the Calendar Firestore collection via onSnapshot and provided EventData typing.
  - Read/writes cpbs_events_view_mode and cpbs_events_location via webStore for cross-platform persistence, identically to OG app.
  - Used AppTheme colors and manually fixed theme references to adhere to new API.
  - Uncommented events in NATIVE_SCREENS. tsc --noEmit clean. Tested in browser preview: light, dark, Hindi, English, lists vs grids, location picker.

- **2026-10-06 (Gemini):** Ported VideosScreen to native. Sync point: 503dc44. Implemented video folders grid, FlashList video grid, YouTube fallback modal, and CustomVideoPlayer for MP4 files using expo-video. Persists and tracks metrics via useMetrics (skipping writes on web), and manages NEW badges using cpbs_video_folder_latest_. Uncommented videos in NATIVE_SCREENS.

- **2026-10-06 (Antigravity):** Ported `DonateScreen` to native. Sync point: `503dc44`.
  - Replicated the 3-step workflow (selection, payment, confirm).
  - Used `react-native-blob-util` to download the QR code.
  - Built a `CustomDateInput` mimicking the web component.
  - Uncommented `donate` in `NATIVE_SCREENS` and added `saffron`, `orange`, `pink`, `green`, `blue` standard tailwind palettes to `jmColors.ts`.
  - `tsc --noEmit` clean.


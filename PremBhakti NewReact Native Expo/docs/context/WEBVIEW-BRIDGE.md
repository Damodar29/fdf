# WebView screens: Capacitor bridge + login handoff

**Status:** first version built 2026-10-04 (code-complete, not yet tested on the phone) — see "As built" at the end. Read [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) first.

## Why this is needed

WebView screens (Profile inside, admin, and any screen not yet native) run the OG app's own web
build, bundled in the APK and served at `https://localhost` (`patches/react-native-webview+*.patch`,
`plugins/withWebBundle.js`, `npm run web:build`). That code was written for Capacitor: it checks
`Capacitor.isNativePlatform()` in ~46 files and imports these plugins (count = files):

| Plugin | Files | Plugin | Files |
|---|---|---|---|
| @capacitor/core | 47 | @capacitor/screen-orientation | 2 |
| @capacitor/app | 9 | @capacitor/push-notifications | 2 |
| @capacitor/filesystem | 7 | @capacitor/device | 2 |
| @capacitor/preferences | 5 | @capacitor-firebase/authentication | 2 |
| @capacitor/file-transfer | 5 | @capgo/capacitor-media-session | 1 |
| @capacitor/share | 4 | @capacitor/text-zoom | 1 |
| @capgo/capacitor-updater | 3 | @capacitor/status-bar, splash-screen, haptics | 1 each |
| @capacitor/clipboard | 3 | @capacitor-community/keep-awake, fcm | 1 each |
| @capacitor/browser | 3 | | |

Plus custom `registerPlugin` native plugins in `utils/nativeDownload.ts`, `utils/uploadManager.ts`,
`utils/Crashlytics.ts`, `utils/backup/driveBackup.ts`, `context/AudioContext.tsx`.

Inside a plain RN WebView none of these exist, so without a bridge those buttons fail or the
code falls back to browser paths (e.g. Google login popup, which Google blocks in WebViews).

## Approach (recommended): speak Capacitor's own bridge protocol

Capacitor's web side (`@capacitor/core`, bundled into the web build) talks to native through
`window.androidBridge.postMessage(json)` and receives results via `window.Capacitor.fromNative(...)`.
If the RN WebView provides that same channel, **the OG web code runs unchanged** — no edits in
aaaacursor (which must stay read-only).

1. Read the exact protocol from the Capacitor 7 sources in aaaacursor's
   `node_modules/@capacitor/core` and `node_modules/@capacitor/android` (native-bridge.js,
   plugin headers / `PluginHeaders`, callback ids, `fromNative` result shape, event listeners).
2. `injectedJavaScriptBeforeContentLoaded`: define `window.androidBridge.postMessage` →
   `window.ReactNativeWebView.postMessage`, and the plugin headers for the plugins we implement,
   so `isNativePlatform()` is true and `getPlatform()` is `"android"`.
3. RN side: one `onMessage` dispatcher `{pluginId, methodName, options, callbackId}` → handler
   map → reply with `webViewRef.injectJavaScript("window.Capacitor.fromNative(...)")`.
   Support listener-style calls (`addListener` / events) too.
4. Implement handlers with RN/Expo modules we already have (expo-file-system / blob-util,
   expo-sharing, expo-clipboard, expo-haptics, keep-awake, RN Firebase messaging, etc.).
   `Preferences` must read/write the same store the native screens use where data is shared.
5. Unknown plugin/method → reject with Capacitor's "not implemented" error so the web code takes
   its existing fallback path instead of hanging.
6. Priority: whatever the first WebView screens (Profile, then admin) actually call. Grep those
   screens' imports in aaaacursor to get the minimal list first; extend later.

If a full protocol shim proves impractical for a plugin, a per-plugin JS shim injected before
load is acceptable — but still no edits inside aaaacursor.

## Login handoff (native ↔ WebView)

Facts from the OG app: `capacitor.config` has `FirebaseAuthentication.skipNativeAuth: true`, and
`context/AuthContext.tsx` signs in with the **Firebase JS SDK** (`signInWithCredential` after the
native Google/phone plugin call). So the web session lives in the WebView's IndexedDB at
`https://localhost`; the RN app's native session (`@react-native-firebase/auth`) is separate.

Requirements:
1. **Login inside a WebView screen** must work: bridge `FirebaseAuthentication.signInWithGoogle`,
   `signInWithPhoneNumber` + its listeners, `confirmVerificationCode`, `signOut`,
   `getCurrentUser` to the native Google Sign-In / RN Firebase phone auth, returning the same
   result shape the Capacitor plugin returns (credential idToken / verificationId etc.).
2. **Native login → WebView already logged in:** when the user logged in natively and opens a
   WebView screen, the web side must not ask again. Options to evaluate: (a) on WebView open, if
   web `auth.currentUser` is null and native is signed in, get a credential the JS SDK accepts
   (Google: fresh Google idToken from native sign-in → `signInWithCredential`; phone: needs a
   custom token from a callable Cloud Function in aaaacursor's `functions/` — that requires a
   change in the OG repo, so ask the user first); (b) JS SDK persistence means this is needed
   once per device, not per open.
3. **WebView login → native logged in** (so native Settings/Drive backup work): reverse direction,
   same options.
4. **After the Play update** (same package `com.cpbs.bhajans`, same `https://localhost` origin)
   existing users are already logged in on the web side; detect that and sign native in too,
   without asking them to log in again.
5. Sign-out in either place signs out both.

Cost note: Cloud Functions are the main Firebase bill for this project — any callable must run
only when a session is missing, not on every WebView open.

## Data migration hook

The same bridge lets native code read the old app's WebView storage (localStorage / Preferences /
IndexedDB at `https://localhost`) once after the update to migrate history, playlists, downloads
and settings into the native stores (task 6 in PROJECT-CONTEXT.md).

## As built (2026-10-04)

- **Bridge:** `src/screens/WebScreen.tsx` injects, before the page: `window.androidBridge`
  (→ `ReactNativeWebView.postMessage("cap:" + json)`), Capacitor's own `native-bridge.js`
  (shipped in `web-bundle/` by `npm run web:build`, loaded with a sync XHR), and
  `Capacitor.PluginHeaders`. `src/webview/capacitorBridge.ts` answers calls via
  `Capacitor.fromNative`; listeners are kept per callbackId; unknown plugin/method → `UNIMPLEMENTED`.
- **Plugins implemented:** App (exitApp closes the screen, backButton/appStateChange/pause/resume
  events from RN), SplashScreen/StatusBar/TextZoom/ScreenOrientation (no-ops), Haptics, KeepAwake,
  Share, Clipboard, Browser, Device, Preferences (MMKV, prefix `cap_pref:`; OG keeps only caches
  there), CapacitorUpdater (no OTA: reports the built-in bundle), Crashlytics, PushNotifications +
  FCM (RN messaging), FirebaseAuthentication (signInWithGoogle, signInWithPhoneNumber + events,
  confirmVerificationCode, signOut), DriveAuth (interactive only — see below).
- **Login handoff, no Cloud Function:** the app's session *is* a Firebase JS SDK session on the web
  config/app name (`src/lib/webAuth.ts`), so WebScreen writes `user.toJSON()` into the page's
  IndexedDB `firebaseLocalStorageDb` + localStorage (`firebase:authUser:<apiKey>:profileApp`)
  before the page starts → native→web. A page login (or the old app's login after the Play
  update) is picked up from there with `adoptWebSession` (throwaway Firebase app +
  `updateCurrentUser`) → web→native. Logout: the page's `FirebaseAuthentication.signOut` and a
  disappearing record both sign the app out; an app logout sets `cpbs_web_signout_pending`, and the
  next web screen drops the page's copy.
- **Drive backup lives in the app only.** `DriveAuth.authorize` with `interactive:false` always
  fails in WebViews, so the page's `AutoBackupManager` can never upload the page's stale copy over
  the real backup or restore into the page.
- **Migration:** `OldAppMigration` loads a blank page at `https://localhost` once, posts the old
  localStorage + login record; `runOldAppMigration` maps it through the OG backup format
  (`applyBackupData`), carries Drive-backup linkage + recent searches, registers downloaded books
  (`cpbs_book_paths_v2`) and audio files found in `Music|Download/Prem Bhakti/...`, adopts the
  login. Untested: whether the public Music files are readable after the update without
  READ_MEDIA_AUDIO.
- **Opening a screen** (`WebTarget`): `screen` loads `/?screen=<name>` (the web app's own deep
  link, utils/NotificationActionHandler: darshan, activities, events, quotes, videos, photos, seva,
  information, donate, about, temple-timings, youtube, guru-maharaj, virahi-maharaj, …); `path`
  loads any path+query (`/v/…` share links, `?videoId=`); `menu` / `click` / `buttonText` press
  an element of the web Home or side menu (Facebook/Instagram tiles, the Aavirbhav write/read
  buttons); `event` (profile); `onboarding`. The page stays hidden until a history entry shows
  the screen opened, and the WebView closes when the history is back at the start.
- **Shared storage** (`src/lib/webStore.ts`): the web screens' seen/read/liked markers and view
  settings (the OG backup's single/prefixed keys + web-owned settings) are kept in an MMKV copy
  (`web-local`). WebScreen writes the copy into localStorage before the page runs; the page posts
  every change to those keys (`webStore` message, every 1.5 s and on close). Native Home reads
  NEW badges / read-state from it; the Drive backup builds and restores those fields from it;
  migration seeds it from the old app.
- **File plugins** (`src/webview/filePlugins.ts`, react-native-blob-util): Filesystem (Capacitor
  Directory → Android folders as @capacitor/filesystem resolves them), FileTransfer.downloadFile,
  NativeDownload.downloadToPublicFolder (→ MediaStore Pictures/Music/Download, no permission;
  openExternalUrl; the Books methods stay unimplemented — Books is native), NativeUpload.uploadFile
  (Cloudflare worker `/upload`, uploadProgress/Done/Error events), MediaSession and
  BigPictureNotification as no-ops (the app owns audio + notifications). Share sends a file:// URL
  as the file (expo-sharing). The WebView patch serves `https://localhost/_capacitor_file_/<path>`
  (Capacitor.convertFileSrc) from the app's own folders and shared storage only.
- **Pushes** (2026-10-04): the app shows them natively (`modules/app-notifications`), so taps
  arrive as intent extras; `lib/appNav.openNotification` opens tabs/Settings/Downloads/Profile
  and bhajans natively and everything else as WebTarget `notification`: the page loads `/` and,
  when its usePushNotifications calls `PushNotifications.register`, the bridge emits
  `pushNotificationActionPerformed` with the push data — so mandal photos/darshan, information
  items and links are handled by the web app's own NotificationActionHandler.
- **Intro:** WebTarget `onboarding` ends by the page's `cpbs_intro_completed` flag only (the
  history watch is off for it); the close message carries the language, theme colour/mode and UI
  size picked in it, which WebScreen copies into the native settings (`finishIntro`). The app's
  own "intro done" flag is `cpbs_intro_completed` in MMKV (set there, or by the migration).
- **Usage time:** while a web screen is open the page's own UsageTracker counts, so the app's
  count (`lib/appTracking`) pauses (`useOpenWebScreens`).
- **Browser preview:** `web-shims/webview.tsx` is an iframe on `http://localhost:8090`
  (`scripts/web-preview-server.js`), which hands the preload script over in `window.name` and
  relays `ReactNativeWebView.postMessage` / `injectJavaScript` with `postMessage`.

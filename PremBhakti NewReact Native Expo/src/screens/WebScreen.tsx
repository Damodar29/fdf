import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, BackHandler, Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { useOpenWebScreens } from "../lib/appTracking";
import { storage } from "../lib/storage";
import { adoptWebSession, signOut, WEB_AUTH_KEY, WEB_SIGNOUT_PENDING_KEY, webSessionRecord } from "../lib/webAuth";
import { applyWebChanges, SHARED_WEB_KEYS, webEntries } from "../lib/webStore";
import { applyUiScale } from "../lib/uiScale";
import { useSettingsStore } from "../store/settingsStore";
import { THEME_PALETTES } from "../theme/palettes";
import type { ThemeColor } from "../types";
import { ink } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";
import { type BridgeCall, CapacitorBridge, PLUGIN_HEADERS } from "../webview/capacitorBridge";

// Rollout "3B": a screen that isn't native yet opens the OG app's own web
// screen. The web build is bundled in the APK and served at https://localhost
// (the Capacitor app's origin — patches/react-native-webview+*.patch,
// plugins/withWebBundle.js), so it works offline and sees the old app's web
// storage and login. Capacitor's bridge is recreated (webview/capacitorBridge)
// so the web code runs its Android paths unchanged.
//
// The web app is opened as a whole and then asked to show one screen:
//  - `screen`: opens the page as `/?screen=<name>`, the app's own deep link
//    (utils/NotificationActionHandler: darshan, activities, events, …);
//  - `menu`: clicks that side-menu item (`data-tour="menu-…"`; the web
//    side menu is always in the DOM);
//  - `buttonText`: clicks the first button whose text is one of these (a web
//    Home tile, the Aavirbhav buttons);
//  - `click`: clicks the first element matching a CSS selector — and then,
//    optionally, a button inside the opened screen (Developer Mode's
//    triple tap in the web Settings);
//  - `event`: dispatches a window event the web app listens for
//    (`cpbs:openProfile`);
//  - `onboarding`: shows the intro slides (they appear on their own when
//    `cpbs_intro_completed` is missing).
// The page stays hidden until that screen has opened. Every web screen pushes
// a history entry, so when the history is back at the start the screen was
// closed and this one closes too. Android back goes to the page's own
// back-button handler (App "backButton").
//
// Login is shared both ways (lib/webAuth): the app's session is written into
// the page's Firebase storage before it starts; a login made in the page is
// taken over by the app, and a logout in either place logs out of both.
//
// So is the storage the app reads too (lib/webStore — NEW badges, read
// markers): the app's copy goes into the page's localStorage before it starts
// and the page reports every change to those keys.

export type WebTarget =
	| { screen: string }
	/** Opens the page at this path + query (a /v/… share link, ?videoId=…); the page handles it. */
	| { path: string }
	| { menu: string }
	| { buttonText: string[] }
	/** `afterOpen`: once the screen is open, tap the button whose text starts with one of these, `times` times. */
	| { click: string; afterOpen?: { textStartsWith: string[]; times: number } }
	| { event: string }
	| { onboarding: true }
	/** A tapped push: the page gets it as Capacitor's pushNotificationActionPerformed and opens its screen. */
	| { notification: Record<string, string> };

const ORIGIN = "https://localhost";
const TOUR_CHAPTERS = [
	"core", "bhajans", "audio", "books", "library", "reader", "bookReader", "profile", "profileGuest",
	"menu", "settings", "information", "events", "darshan", "templeTimings", "seva", "donate", "videos",
];

/** Runs before the web app: Capacitor bridge, native settings, login, first-run popups off, history watch. */
function buildPreload(
	target: WebTarget,
	settings: Record<string, string>,
	session: string | null,
	dropSession: boolean,
	shared: Record<string, string>,
) {
	return `(function () {
  var post = function (m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var target = ${JSON.stringify(target)};

  // The keys the app shares with the web screens: its copy in, and every
  // change reported back.
  var shared = ${JSON.stringify(shared)};
  var SHARED = ${JSON.stringify(SHARED_WEB_KEYS)};
  try { Object.keys(shared).forEach(function (k) { localStorage.setItem(k, shared[k]); }); } catch (e) {}
  var isShared = function (k) {
    return SHARED.keys.indexOf(k) >= 0 || SHARED.prefixes.some(function (p) { return k.indexOf(p) === 0; });
  };
  var lastShared = shared;
  var syncShared = function () {
    try {
      var now = {}, set = {}, removed = [], changed = false;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && isShared(k)) now[k] = localStorage.getItem(k);
      }
      Object.keys(now).forEach(function (k) { if (lastShared[k] !== now[k]) { set[k] = now[k]; changed = true; } });
      Object.keys(lastShared).forEach(function (k) { if (!(k in now)) { removed.push(k); changed = true; } });
      lastShared = now;
      if (changed) post({ type: "webStore", set: set, removed: removed });
    } catch (e) {}
  };
  setInterval(syncShared, 1500);
  window.addEventListener("pagehide", syncShared);

  // Capacitor's Android bridge: the channel, its page-side script, and the
  // plugins the app implements.
  window.WEBVIEW_SERVER_URL = ${JSON.stringify(ORIGIN)};
  window.androidBridge = { postMessage: function (s) { window.ReactNativeWebView.postMessage("cap:" + s); } };
  try {
    var x = new XMLHttpRequest();
    x.open("GET", "/native-bridge.js", false);
    x.send(null);
    if (x.status === 200) (0, eval)(x.responseText);
  } catch (e) {}
  window.Capacitor = window.Capacitor || {};
  window.Capacitor.PluginHeaders = ${JSON.stringify(PLUGIN_HEADERS)};

  // The login: IndexedDB first, then localStorage — where the page's
  // Firebase Auth looks.
  var AUTH_KEY = ${JSON.stringify(WEB_AUTH_KEY)};
  var session = ${JSON.stringify(session)};
  var withAuthStore = function (cb) {
    try {
      var req = indexedDB.open("firebaseLocalStorageDb", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" }); };
      req.onsuccess = function () {
        var db = req.result;
        try {
          var tx = db.transaction("firebaseLocalStorage", "readwrite");
          cb(tx.objectStore("firebaseLocalStorage"));
          tx.oncomplete = function () { db.close(); };
        } catch (e) { db.close(); }
      };
    } catch (e) {}
  };
  if (session) {
    try { localStorage.setItem(AUTH_KEY, session); } catch (e) {}
    withAuthStore(function (store) { store.put({ fbase_key: AUTH_KEY, value: JSON.parse(session) }); });
  } else if (${dropSession}) {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
    withAuthStore(function (store) { store.delete(AUTH_KEY); });
  }
  // Tell the app when the page logs in or out.
  var hadSession = !!session;
  var checkSession = function () {
    withAuthStore(function (store) {
      var get = store.get(AUTH_KEY);
      get.onsuccess = function () {
        var local = null;
        try { local = localStorage.getItem(AUTH_KEY); } catch (e) {}
        var record = get.result ? JSON.stringify(get.result.value) : local;
        if (record && !hadSession) { hadSession = true; post({ type: "signedIn", record: record }); }
        else if (!record && hadSession) { hadSession = false; post({ type: "signedOut" }); }
      };
    });
  };
  setTimeout(checkSession, 800);
  setInterval(checkSession, 1500);

  try {
    var ls = window.localStorage;
    var native = ${JSON.stringify(settings)};
    Object.keys(native).forEach(function (k) { ls.setItem(k, native[k]); });
    ls.setItem("cpbs_cyan_theme_v2", "true");
    if (target.onboarding) ls.removeItem("cpbs_intro_completed"); else ls.setItem("cpbs_intro_completed", "true");
    var d = new Date();
    var today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    // The page treats ?screen= like a tapped push and ignores the same one again
    // for 18 hours (NotificationActionHandler); here it is a tile tap every time,
    // and the app already filters repeated pushes itself (lib/appNav).
    ls.removeItem("cpbs_processed_notification_ids");
    ls.setItem("cpbs_quote_last_seen_date", today);
    ls.setItem("cpbs_quote_last_seen_afternoon", today);
    var tour = {};
    try { tour = JSON.parse(ls.getItem("cpbs_tour_progress") || "{}") || {}; } catch (e) {}
    ${JSON.stringify(TOUR_CHAPTERS)}.forEach(function (c) { if (!(tour[c] > 0)) tour[c] = 999; });
    ls.setItem("cpbs_tour_progress", JSON.stringify(tour));
  } catch (e) {}

  var hide = document.createElement("style");
  hide.textContent = "html{visibility:hidden!important}";
  document.documentElement.appendChild(hide);
  var reveal = function () { if (hide.parentNode) hide.parentNode.removeChild(hide); };
  // The app lifts its cover only once the screen is really drawn: shown, its
  // lazy-loaded code in (no Suspense spinner left), painted —
  // or after 1.5 s at most, so a slow screen still shows its own loader.
  var showWhenDrawn = function (delay) {
    var until = Date.now() + 1500;
    var settle = function () {
      var spinning = document.querySelector(".fixed.inset-0 .animate-spin");
      if (spinning && Date.now() < until) { setTimeout(settle, 80); return; }
      reveal();
      // A hidden page may get no animation frames, so a short timer covers the first paint.
      setTimeout(function () { post({ type: "opened" }); }, 50);
    };
    setTimeout(settle, delay);
  };

  var opened = false, closed = false;
  var isScreen = function (s) { return !!(s && (s.isPopup || (s.view && s.view !== "root" && String(s.view).indexOf("tab-") !== 0))); };
  var check = function () {
    // The intro is no screen of the page's history; it ends by its own flag (below).
    if (closed || target.onboarding) return;
    if (!opened && isScreen(history.state)) {
      opened = true;
      showWhenDrawn(120);
      if (target.afterOpen) setTimeout(afterOpen, 400);
    } else if (opened && !isScreen(history.state)) {
      closed = true;
      syncShared();
      post({ type: "closed" });
    }
  };
  ["pushState", "replaceState"].forEach(function (name) {
    var original = history[name];
    history[name] = function () { var r = original.apply(this, arguments); setTimeout(check, 0); return r; };
  });
  window.addEventListener("popstate", function () { setTimeout(check, 0); });

  var afterOpen = function () {
    var a = target.afterOpen;
    var buttons = Array.prototype.slice.call(document.querySelectorAll("button"));
    var btn = buttons.find(function (b) {
      var text = (b.textContent || "").trim();
      return a.textStartsWith.some(function (p) { return text.indexOf(p) === 0; });
    });
    if (!btn) return;
    for (var i = 0; i < a.times; i++) setTimeout(function () { btn.click(); }, i * 120);
  };

  var deadline = Date.now() + 20000;
  var attempt = function () {
    if (opened || closed) return;
    if (Date.now() > deadline) { reveal(); post({ type: "timeout" }); return; }
    try {
      if (target.onboarding) {
        if (document.body && document.body.children.length) {
          opened = true; showWhenDrawn(300);
          var poll = setInterval(function () {
            if (localStorage.getItem("cpbs_intro_completed")) {
              clearInterval(poll); closed = true; syncShared();
              // What the devotee picked in the intro, for the app's own settings.
              var ls = window.localStorage;
              post({ type: "closed", intro: { lang: ls.getItem("cpbs_settings_lang"), color: ls.getItem("cpbs_theme_color"), mode: ls.getItem("cpbs_theme_mode"), scale: ls.getItem("cpbs_ui_scale") } });
            }
          }, 300);
          return;
        }
      } else if (target.screen || target.path) {
        // The page opens it by itself from the URL once its data is in.
      } else if (target.event) {
        window.dispatchEvent(new Event(target.event));
      } else if (target.buttonText) {
        var match = Array.prototype.slice.call(document.querySelectorAll("button")).find(function (b) {
          return target.buttonText.indexOf((b.textContent || "").trim()) >= 0;
        });
        if (match) match.click();
      } else {
        var sel = target.menu ? '[data-tour="' + target.menu + '"]' : target.click;
        var el = document.querySelector(sel);
        if (el) el.click();
      }
    } catch (e) {}
    setTimeout(attempt, 250);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(attempt, 200); });
  else setTimeout(attempt, 200);
})(); true;`;
}

export const INTRO_DONE_KEY = "cpbs_intro_completed";

/** The intro (OnboardingScreen) is done: keep that, and take over the language, theme and size picked in it. */
function finishIntro(picked?: { lang?: string | null; color?: string | null; mode?: string | null; scale?: string | null }) {
	storage.set(INTRO_DONE_KEY, "true");
	if (!picked) return;
	const s = useSettingsStore.getState();
	if (picked.lang === "en" || picked.lang === "hi") s.setSettingsLanguage(picked.lang);
	if (picked.color && picked.color in THEME_PALETTES) s.setThemeColor(picked.color as ThemeColor);
	if (picked.mode === "auto" || picked.mode === "light" || picked.mode === "dark") s.setThemeMode(picked.mode);
	const scale = Number(picked.scale);
	if (scale > 0 && Math.abs(scale - s.uiScale) > 0.001) {
		s.setUiScale(scale);
		applyUiScale(useSettingsStore.getState().uiScale, false);
	}
}

export function WebScreen({ target, onClose }: { target: WebTarget; onClose: () => void }) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const ref = useRef<WebView>(null);
	const [ready, setReady] = useState(false);
	// The cover over the page while it loads fades out once the screen is drawn;
	// its spinner only appears when loading takes a moment.
	const cover = useRef(new Animated.Value(1)).current;
	const [coverShown, setCoverShown] = useState(true);
	const [slow, setSlow] = useState(false);
	useEffect(() => {
		const t = setTimeout(() => setSlow(true), 350);
		return () => clearTimeout(t);
	}, []);
	useEffect(() => {
		if (!ready) return;
		Animated.timing(cover, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setCoverShown(false));
	}, [ready, cover]);
	const closedRef = useRef(false);

	const close = useCallback(() => {
		if (closedRef.current) return;
		closedRef.current = true;
		onClose();
	}, [onClose]);

	const bridge = useMemo(
		() =>
			new CapacitorBridge(
				(result) =>
					ref.current?.injectJavaScript(
						`window.Capacitor && window.Capacitor.fromNative && window.Capacitor.fromNative(${JSON.stringify(result)}); true;`,
					),
				{ exit: close, launchNotification: "notification" in target ? target.notification : undefined },
			),
		[close, target],
	);

	// Settings and login are read once: the web page reads them when it starts.
	const preload = useMemo(() => {
		const s = useSettingsStore.getState();
		const dropSession = !!storage.getBoolean(WEB_SIGNOUT_PENDING_KEY);
		const session = webSessionRecord();
		if (dropSession && !session) storage.remove(WEB_SIGNOUT_PENDING_KEY);
		return buildPreload(
			target,
			{
				cpbs_theme_mode: s.themeMode,
				cpbs_theme_color: s.themeColor,
				cpbs_settings_lang: s.settingsLanguage,
				cpbs_script: s.script,
				cpbs_haptics: String(s.hapticsEnabled),
				cpbs_awake: String(s.keepAwake),
				cpbs_scrollbar_side: s.scrollBarSide,
				cpbs_slider_side: s.azSliderSide,
				cpbs_index_mode: s.indexMode,
			},
			session,
			dropSession && !session,
			webEntries(),
		);
	}, [target]);
	const uri =
		"screen" in target
			? `${ORIGIN}/?screen=${encodeURIComponent(target.screen)}`
			: "path" in target
				? `${ORIGIN}${target.path.startsWith("/") ? target.path : `/${target.path}`}`
				: `${ORIGIN}/`;

	// The page counts usage time itself while it is open (lib/appTracking).
	useEffect(() => {
		useOpenWebScreens.setState((s) => ({ count: s.count + 1 }));
		return () => useOpenWebScreens.setState((s) => ({ count: Math.max(0, s.count - 1) }));
	}, []);

	// The page's App plugin listeners hear the app going to the background and back.
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			const isActive = state === "active";
			bridge.emit("App", "appStateChange", { isActive });
			bridge.emit("App", isActive ? "resume" : "pause", {});
		});
		return () => sub.remove();
	}, [bridge]);

	// Android back goes to the page's back-button handler, which closes its
	// screens; when nothing is left open this screen closes (history watch).
	useFocusEffect(
		useCallback(() => {
			const sub = BackHandler.addEventListener("hardwareBackPress", () => {
				if (!ready) {
					close();
					return true;
				}
				if (bridge.hasListener("App", "backButton")) bridge.emit("App", "backButton", { canGoBack: false });
				else ref.current?.injectJavaScript("history.back(); true;");
				return true;
			});
			return () => sub.remove();
		}, [ready, close, bridge]),
	);

	const onMessage = (e: WebViewMessageEvent) => {
		const raw = e.nativeEvent.data;
		if (raw.startsWith("cap:")) {
			let call: BridgeCall | null = null;
			try {
				call = JSON.parse(raw.slice(4));
			} catch {
				return;
			}
			if (call?.pluginId) bridge.handle(call);
			return;
		}
		let msg: {
			type?: string;
			record?: string;
			set?: Record<string, string>;
			removed?: string[];
			intro?: Parameters<typeof finishIntro>[0];
		} = {};
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		if (msg.type === "webStore") applyWebChanges(msg.set ?? {}, msg.removed ?? []);
		else if (msg.type === "opened" || msg.type === "timeout") setReady(true);
		else if (msg.type === "closed") {
			if ("onboarding" in target) finishIntro(msg.intro);
			close();
		}
		else if (msg.type === "signedIn" && msg.record) adoptWebSession(msg.record).catch(() => {});
		else if (msg.type === "signedOut") {
			signOut().catch(() => {});
			close();
		}
	};

	return (
		<View
			style={[
				styles.flex,
				{ backgroundColor: theme.isDark ? ink[900] : theme.page, paddingTop: insets.top, paddingBottom: insets.bottom },
			]}
		>
			<WebView
				ref={ref}
				source={{ uri }}
				originWhitelist={["https://*", "http://*"]}
				injectedJavaScriptBeforeContentLoaded={preload}
				onMessage={onMessage}
				javaScriptEnabled
				domStorageEnabled
				mediaPlaybackRequiresUserAction={false}
				allowsInlineMediaPlayback
				setSupportMultipleWindows
				// Links to other sites (WhatsApp, YouTube, payment apps, Play Store) open outside.
				onShouldStartLoadWithRequest={(req) => {
					if (req.url.startsWith(ORIGIN) || req.url.startsWith("about:") || req.url.startsWith("data:")) return true;
					if (!req.isTopFrame) return true;
					Linking.openURL(req.url).catch(() => {});
					return false;
				}}
				onOpenWindow={(e) => {
					Linking.openURL(e.nativeEvent.targetUrl).catch(() => {});
				}}
				style={[styles.flex, { backgroundColor: "transparent" }]}
			/>
			{coverShown ? (
				<Animated.View
					pointerEvents={ready ? "none" : "auto"}
					style={[styles.loading, { backgroundColor: theme.isDark ? ink[900] : theme.page, opacity: cover }]}
				>
					{slow ? <ActivityIndicator size="large" color={theme.p[500]} /> : null}
				</Animated.View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	loading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});

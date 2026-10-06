import { useState } from "react";
import { StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import { MIGRATED_KEY, type OldAppSnapshot, runOldAppMigration } from "../lib/migrateOldApp";
import { storage } from "../lib/storage";
import { WEB_AUTH_KEY } from "../lib/webAuth";
import { useContentStore } from "../store/contentStore";

// Reads the Capacitor app's WebView storage once (lib/migrateOldApp): a tiny
// invisible page on the old app's origin, https://localhost, posts its
// localStorage (minus the big content caches) and its Firebase login record.

const READER = `<!doctype html><script>
(function () {
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var local = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (/^cpbs_all_|^cpbs_events|_cache$|^firebase:/.test(k)) continue;
      var v = localStorage.getItem(k);
      if (v !== null && v.length < 200000) local[k] = v;
    }
  } catch (e) {}
  var done = function (record) { post({ local: local, authRecord: record }); };
  try {
    var req = indexedDB.open("firebaseLocalStorageDb");
    req.onerror = function () { done(null); };
    req.onsuccess = function () {
      var db = req.result;
      try {
        var get = db.transaction("firebaseLocalStorage", "readonly").objectStore("firebaseLocalStorage").get(${JSON.stringify(WEB_AUTH_KEY)});
        get.onsuccess = function () { done(get.result ? JSON.stringify(get.result.value) : (localStorage.getItem(${JSON.stringify(WEB_AUTH_KEY)}) || null)); };
        get.onerror = function () { done(null); };
      } catch (e) { done(null); }
    };
  } catch (e) { done(null); }
})();
</script>`;

/** Content lists, so downloaded tracks can be matched to their bhajan/katha. */
async function contentReady() {
	const { sync } = useContentStore.getState();
	await Promise.race([
		Promise.all([sync("bhajans"), sync("lectures")]),
		new Promise((resolve) => setTimeout(resolve, 30000)),
	]);
}

export function OldAppMigration() {
	const [pending, setPending] = useState(() => !storage.getBoolean(MIGRATED_KEY));
	if (!pending) return null;
	return (
		<View style={styles.hidden} pointerEvents="none">
			<WebView
				source={{ html: READER, baseUrl: "https://localhost" }}
				originWhitelist={["*"]}
				javaScriptEnabled
				domStorageEnabled
				onMessage={async (e) => {
					let snapshot: OldAppSnapshot | null = null;
					try {
						snapshot = JSON.parse(e.nativeEvent.data);
					} catch {}
					if (snapshot) {
						if (Object.keys(snapshot.local).length) await contentReady();
						await runOldAppMigration(snapshot).catch(() => {});
					}
					setPending(false);
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	hidden: { position: "absolute", width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});

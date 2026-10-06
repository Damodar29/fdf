// Serves web-bundle/ on http://localhost:8090 for the browser preview of the
// app (`npm run web`), where WebView screens are <iframe>s (web-shims/webview.tsx).
// Every HTML page gets a first script that plays the part of
// react-native-webview: it runs the "before content loaded" script the frame
// was given (window.name), posts page messages to the app, and runs scripts
// the app injects later. Dev only — the Android app serves the bundle itself.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "web-bundle");
const PORT = 8090;
const TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".webp": "image/webp",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".mp3": "audio/mpeg",
	".webmanifest": "application/manifest+json",
	".txt": "text/plain",
};

// The preview runs against the live Firebase project: the page may read,
// but its Firestore writes (usage stats, tokens…) are dropped here.
const BRIDGE = `<script>(function(){
  var isWrite = function (u) { u = String(u || ""); return u.indexOf("firestore.googleapis.com") >= 0 && (u.indexOf("/Write/") >= 0 || u.indexOf(":commit") >= 0 || u.indexOf(":batchWrite") >= 0); };
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { if (isWrite(u)) { console.warn("[preview] Firestore write blocked"); arguments[1] = "data:,"; } return open.apply(this, arguments); };
  var f = window.fetch;
  window.fetch = function (input, init) { var u = typeof input === "string" ? input : (input && input.url); if (isWrite(u)) { console.warn("[preview] Firestore write blocked"); return Promise.reject(new TypeError("blocked in preview")); } return f.apply(this, arguments); };
  // The page's errors show in the app tab's console (iframe consoles are easy to miss).
  ["error", "warn"].forEach(function (k) { var o = console[k]; console[k] = function () { try { parent.postMessage({ __rnwvLog: k + ": " + Array.prototype.map.call(arguments, String).join(" ").slice(0, 500) }, "*"); } catch (e) {} return o.apply(console, arguments); }; });
  window.addEventListener("error", function (e) { try { parent.postMessage({ __rnwvLog: "uncaught: " + e.message }, "*"); } catch (x) {} });
  window.ReactNativeWebView = { postMessage: function (d) { parent.postMessage({ __rnwv: String(d) }, "*"); } };
  window.addEventListener("message", function (e) {
    if (e.source === parent && e.data && typeof e.data.__rnwvInject === "string") { try { (0, eval)(e.data.__rnwvInject); } catch (err) { console.error(err); } }
  });
  var pre = window.name; window.name = "";
  if (pre) { try { (0, eval)(pre); } catch (err) { console.error("preload failed", err); } }
})();</script>`;

http
	.createServer((req, res) => {
		const url = new URL(req.url, `http://localhost:${PORT}`);
		let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
		if (!file.startsWith(ROOT)) {
			res.writeHead(403).end();
			return;
		}
		if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
			const index = path.join(file, "index.html");
			file = fs.existsSync(index) ? index : path.join(ROOT, "index.html");
		}
		const ext = path.extname(file).toLowerCase();
		let body = fs.readFileSync(file);
		if (ext === ".html") body = body.toString("utf8").replace(/<head[^>]*>/i, (m) => m + BRIDGE);
		res.writeHead(200, {
			"Content-Type": TYPES[ext] || "application/octet-stream",
			"Cache-Control": "no-cache",
			// The app (port 8081) loads the Devanagari fonts from here.
			"Access-Control-Allow-Origin": "*",
		});
		res.end(body);
	})
	.listen(PORT, () => console.log(`web-bundle preview on http://localhost:${PORT}`));

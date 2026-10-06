// Copies the Capacitor app's web build (web-bundle/, made by
// `npm run web:build`) into the Android assets as assets/web, where the
// patched react-native-webview serves it at https://localhost for the
// screens that open in a WebView.
const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

module.exports = function withWebBundle(config) {
	return withDangerousMod(config, [
		"android",
		async (c) => {
			const source = path.join(c.modRequest.projectRoot, "web-bundle");
			const target = path.join(c.modRequest.platformProjectRoot, "app", "src", "main", "assets", "web");
			fs.rmSync(target, { recursive: true, force: true });
			if (!fs.existsSync(path.join(source, "index.html"))) {
				console.warn("\n⚠️  web-bundle/ is missing — run `npm run web:build`, then prebuild again.\n");
				return c;
			}
			fs.mkdirSync(path.dirname(target), { recursive: true });
			fs.cpSync(source, target, { recursive: true });
			return c;
		},
	]);
};

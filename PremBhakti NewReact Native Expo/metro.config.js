// Metro config. The only addition to Expo's defaults: when the app is run in a
// browser (`npm run web`, used to check screens on the PC), native-only
// packages are swapped for the stand-ins in web-shims/. Android builds are
// untouched.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const shim = (name) => path.join(__dirname, "web-shims", name);
const WEB_SHIMS = {
	"@react-native-firebase/app": shim("rnfirebase-app.ts"),
	"@react-native-firebase/auth": shim("rnfirebase-auth.ts"),
	"@react-native-firebase/firestore": shim("rnfirebase-firestore.ts"),
	"@react-native-firebase/messaging": shim("rnfirebase-messaging.ts"),
	"@react-native-firebase/crashlytics": shim("rnfirebase-crashlytics.ts"),
	"@react-native-google-signin/google-signin": shim("google-signin.ts"),
	"react-native-blob-util": shim("blob-util.ts"),
	"react-native-pdf": shim("pdf.tsx"),
	"react-native-webview": shim("webview.tsx"),
	"react-native-web-webview": shim("react-native-web-webview.tsx"),
};

const baseResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (platform === "web") {
		if (WEB_SHIMS[moduleName]) return { type: "sourceFile", filePath: WEB_SHIMS[moduleName] };
		if (/modules[\/]ui-scale$/.test(moduleName)) return { type: "sourceFile", filePath: shim("ui-scale.ts") };
	}
	return (baseResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

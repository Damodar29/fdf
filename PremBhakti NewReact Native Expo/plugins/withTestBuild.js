// Expo config plugin for the side-by-side test build of the React Native app.
//
// While the Capacitor app is still the one on the Play Store under
// com.cpbs.bhajans, every RN build (debug and release) installs as a separate
// app — com.cpbs.bhajans.rntest, "Prem Bhakti RN" — so it never replaces or
// touches the real app or its data on a phone. Crash reports from these
// builds are switched off so they don't land in the real app's Crashlytics.
//
// It also pins the JDK Gradle uses (Android Studio's bundled JDK 25 breaks
// the C++ module builds), in both places: gradle.properties for command-line
// builds and .gradle/config.properties, which Android Studio's default Gradle
// JDK setting (GRADLE_LOCAL_JAVA_HOME) reads. Because it's a plugin, all of
// this survives `npx expo prebuild --clean`. Test builds are also built for
// arm64-v8a only (the test phone), which saves build time and APK size.
//
// For the real Play Store release, remove this plugin from app.json.
const fs = require("node:fs");
const path = require("node:path");
const {
	AndroidConfig,
	withAndroidManifest,
	withAppBuildGradle,
	withDangerousMod,
	withGradleProperties,
	withStringsXml,
} = require("expo/config-plugins");

const DEFAULT_JDK = "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.17.10-hotspot";

module.exports = function withTestBuild(
	config,
	{ applicationIdSuffix = ".rntest", appName = "Prem Bhakti RN", jdkHome = DEFAULT_JDK } = {},
) {
	const basePackage = config.android?.package ?? "com.cpbs.bhajans";
	const testPackage = `${basePackage}${applicationIdSuffix}`;

	config = withAppBuildGradle(config, (c) => {
		c.modResults.contents = c.modResults.contents.replace(
			/applicationId\s+['"][^'"]+['"]/,
			`applicationId '${testPackage}'`,
		);
		return c;
	});

	config = withStringsXml(config, (c) => {
		c.modResults = AndroidConfig.Strings.setStringItem(
			[{ $: { name: "app_name", translatable: "false" }, _: appName }],
			c.modResults,
		);
		return c;
	});

	// Test builds only go to the user's phone (Samsung Galaxy M55, arm64): one
	// CPU type instead of two halves the C++ build and the APK. The Play
	// release (without this plugin) keeps armeabi-v7a too (withBuildSettings).
	config = withGradleProperties(config, (c) => {
		const existing = c.modResults.find((item) => item.type === "property" && item.key === "reactNativeArchitectures");
		if (existing) existing.value = "arm64-v8a";
		else c.modResults.push({ type: "property", key: "reactNativeArchitectures", value: "arm64-v8a" });
		return c;
	});

	config = withAndroidManifest(config, (c) => {
		const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
		AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, "firebase_crashlytics_collection_enabled", "false");
		return c;
	});

	if (process.platform === "win32" && jdkHome) {
		config = withGradleProperties(config, (c) => {
			const key = "org.gradle.java.home";
			const value = jdkHome.replace(/\\/g, "\\\\");
			const existing = c.modResults.find((item) => item.type === "property" && item.key === key);
			if (existing) existing.value = value;
			else c.modResults.push({ type: "property", key, value });
			return c;
		});

		config = withDangerousMod(config, [
			"android",
			async (c) => {
				const dir = path.join(c.modRequest.platformProjectRoot, ".gradle");
				fs.mkdirSync(dir, { recursive: true });
				const escaped = jdkHome.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
				fs.writeFileSync(path.join(dir, "config.properties"), `java.home=${escaped}\n`);
				return c;
			},
		]);
	}

	return config;
};

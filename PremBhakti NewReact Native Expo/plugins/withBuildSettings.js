// Build speed and APK size (kept for the Play release too).
//
//  - Gradle gets 4 GB and its build cache, so repeat builds reuse earlier work.
//  - Native code is built for real phones only (ARM). x86/x86_64 are for
//    emulators on a PC; they doubled the C++ build time and added ~63 MB.
//    plugins/withTestBuild.js narrows test builds further to arm64-v8a.
//  - Release builds shrink Java/Kotlin code and unused resources (R8); the
//    keep rules for libraries that use reflection are in app.json
//    (expo-build-properties → extraProguardRules).
const { withGradleProperties } = require("expo/config-plugins");

const PROPS = {
	"org.gradle.jvmargs": "-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8",
	"org.gradle.caching": "true",
	"org.gradle.parallel": "true",
	"org.gradle.daemon": "true",
	// PNGs in the app are already small (webp); crunching only costs time.
	"android.enablePngCrunchInReleaseBuilds": "false",
};

function setProps(list, props) {
	for (const [key, value] of Object.entries(props)) {
		const existing = list.find((item) => item.type === "property" && item.key === key);
		if (existing) existing.value = value;
		else list.push({ type: "property", key, value });
	}
}

module.exports = function withBuildSettings(config, props = {}) {
	return withGradleProperties(config, (c) => {
		setProps(c.modResults, { ...PROPS, ...props });
		// Drop the emulator CPUs from Expo's default list; a narrower list set by
		// withTestBuild (in whichever order the mods run) is left alone.
		const arch = c.modResults.find((item) => item.type === "property" && item.key === "reactNativeArchitectures");
		if (!arch) c.modResults.push({ type: "property", key: "reactNativeArchitectures", value: "armeabi-v7a,arm64-v8a" });
		else if (arch.value.includes("x86")) arch.value = "armeabi-v7a,arm64-v8a";
		return c;
	});
};
module.exports.setProps = setProps;

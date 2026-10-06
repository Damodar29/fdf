// Writes android/local.properties (sdk.dir) on every prebuild, which
// regenerates the android folder without it. Uses ANDROID_HOME, or the
// default Android Studio SDK location on Windows. Machine-local only: the
// file is in the generated (gitignored) android folder.
const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

module.exports = function withLocalSdk(config) {
	return withDangerousMod(config, [
		"android",
		async (c) => {
			const sdk =
				process.env.ANDROID_HOME ||
				process.env.ANDROID_SDK_ROOT ||
				(process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk") : "");
			if (sdk && fs.existsSync(sdk)) {
				const escaped = sdk.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
				fs.writeFileSync(path.join(c.modRequest.platformProjectRoot, "local.properties"), `sdk.dir=${escaped}\n`);
			}
			return c;
		},
	]);
};

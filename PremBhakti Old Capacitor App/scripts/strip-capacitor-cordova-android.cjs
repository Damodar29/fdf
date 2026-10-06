const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const androidDir = path.join(root, "android");
const files = [
	{
		path: path.join(androidDir, "settings.gradle"),
		transforms: [
			(text) =>
				text.replace(
					/\ninclude ':capacitor-cordova-android-plugins'\nproject\(':capacitor-cordova-android-plugins'\)\.projectDir = new File\('\.\/capacitor-cordova-android-plugins\/'\)\n/g,
					"\n",
				),
		],
	},
	{
		path: path.join(androidDir, "app", "build.gradle"),
		transforms: [
			(text) =>
				text.replace(
					/\n\s*implementation fileTree\(include: \['\*\.jar', '\*\.aar'\], dir: '\.\.\/capacitor-cordova-android-plugins\/src\/main\/libs'\)/g,
					"",
				),
			(text) =>
				text.replace(
					/\n\s*implementation project\(':capacitor-cordova-android-plugins'\)/g,
					"",
				),
		],
	},
	{
		path: path.join(androidDir, "variables.gradle"),
		transforms: [
			(text) => text.replace(/\n\s*cordovaAndroidVersion = '.*?'/g, ""),
		],
	},
	{
		path: path.join(androidDir, "app", "capacitor.build.gradle"),
		transforms: [
			(text) =>
				text.replace(
					/\napply from: "\.\.\/capacitor-cordova-android-plugins\/cordova\.variables\.gradle"/g,
					"",
				),
		],
	},
];

for (const file of files) {
	if (!fs.existsSync(file.path)) {
		continue;
	}

	const original = fs.readFileSync(file.path, "utf8");
	const updated = file.transforms.reduce(
		(text, transform) => transform(text),
		original,
	);

	if (updated !== original) {
		fs.writeFileSync(file.path, updated);
		console.log(`Updated ${path.relative(root, file.path)}`);
	}
}

const cordovaDir = path.join(androidDir, "capacitor-cordova-android-plugins");
if (fs.existsSync(cordovaDir)) {
	fs.rmSync(cordovaDir, { recursive: true, force: true });
	console.log("Removed android/capacitor-cordova-android-plugins");
}

const generatedCordovaAssets = [
	path.join(androidDir, "app", "src", "main", "assets", "public", "cordova.js"),
	path.join(
		androidDir,
		"app",
		"src",
		"main",
		"assets",
		"public",
		"cordova_plugins.js",
	),
	path.join(
		androidDir,
		"app",
		"src",
		"main",
		"assets",
		"public",
		"plugins",
		"cordova-plugin-device",
	),
];

for (const target of generatedCordovaAssets) {
	if (!fs.existsSync(target)) {
		continue;
	}

	fs.rmSync(target, { recursive: true, force: true });
	console.log(`Removed ${path.relative(root, target)}`);
}

console.log("Capacitor Cordova Android bridge cleanup complete.");

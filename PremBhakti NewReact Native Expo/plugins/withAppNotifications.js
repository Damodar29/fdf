// Push notifications are shown by modules/app-notifications (PushMessagingService,
// a port of the Capacitor app's CustomFirebaseMessagingService). Firebase hands
// a push to one messaging service only, so @react-native-firebase/messaging's
// own service and its broadcast receiver (which would start a headless JS task
// for every push) are taken out of the merged manifest. Its JS calls the app
// uses (getToken, subscribeToTopic) do not need them.
const { withAndroidManifest } = require("expo/config-plugins");

const REMOVE = [
	["service", "io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService"],
	["service", "io.invertase.firebase.messaging.ReactNativeFirebaseMessagingHeadlessService"],
	["receiver", "io.invertase.firebase.messaging.ReactNativeFirebaseMessagingReceiver"],
];

module.exports = function withAppNotifications(config) {
	return withAndroidManifest(config, (c) => {
		const manifest = c.modResults.manifest;
		manifest.$["xmlns:tools"] = manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";
		const app = manifest.application[0];
		for (const [tag, name] of REMOVE) {
			app[tag] = (app[tag] || []).filter((e) => e.$["android:name"] !== name);
			app[tag].push({ $: { "android:name": name, "tools:node": "remove" } });
		}
		return c;
	});
};

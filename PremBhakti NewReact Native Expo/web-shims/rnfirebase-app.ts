// Browser stand-in for @react-native-firebase/app: the default Firebase app on
// the web SDK, with the web app's client config.
import { getApps, initializeApp } from "@firebase/app";
import { WEB_FIREBASE_CONFIG } from "../src/config/firebaseWeb";

export const defaultApp = getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(WEB_FIREBASE_CONFIG);
export function getApp() {
	return defaultApp;
}
export default { app: getApp };

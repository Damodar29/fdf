// Browser stand-in for @react-native-firebase/crashlytics: errors go to the console.
export const getCrashlytics = () => ({});
export const log = (_c: unknown, msg: string) => console.log("[crashlytics]", msg);
export const recordError = (_c: unknown, e: unknown) => console.warn("[crashlytics]", e);
export const setCrashlyticsCollectionEnabled = async () => {};

// Browser stand-in for @react-native-firebase/messaging. Permission reads as
// granted (so web screens don't show their notification blocker); there is
// no token, so nothing is ever registered for pushes from the browser.
export const getMessaging = () => ({});
export const getToken = async (): Promise<string> => {
	throw new Error("No push token in the browser preview");
};
export const hasPermission = async () => 1;
export const requestPermission = async () => 1;
export const subscribeToTopic = async () => {};
export const onMessage = () => () => {};
export const onTokenRefresh = () => () => {};
export const setBackgroundMessageHandler = () => {};
export const getInitialNotification = async () => null;
export const onNotificationOpenedApp = () => () => {};

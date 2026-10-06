// Browser stand-in for @react-native-google-signin: Google sign-in is native only.
const unavailable = async (): Promise<never> => {
	throw new Error("Google sign-in works only in the Android app");
};
export const GoogleSignin = {
	configure: () => {},
	hasPlayServices: async () => true,
	hasPreviousSignIn: () => false,
	getCurrentUser: () => null,
	signIn: unavailable,
	signInSilently: unavailable,
	addScopes: unavailable,
	getTokens: unavailable,
	clearCachedAccessToken: async () => {},
	signOut: async () => {},
};
export const isSuccessResponse = (r: { type?: string } | null | undefined) => r?.type === "success";
export const statusCodes = { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED", IN_PROGRESS: "IN_PROGRESS" };

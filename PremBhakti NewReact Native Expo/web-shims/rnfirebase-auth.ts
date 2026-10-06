// Browser stand-in for @react-native-firebase/auth (only used for phone OTP).
export function getAuth() {
	return {};
}
export function verifyPhoneNumber(): never {
	throw new Error("Phone OTP works only in the Android app");
}

import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Phone, User, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { triggerHaptic } from "../lib/haptics";
import { confirmPhoneOtp, sendPhoneOtp, signInWithGoogle } from "../lib/webAuth";
import type { RootNavigation } from "../navigation/types";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import { cream, ink, serif } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

// The signed-out state of components/ProfileScreen.tsx — "Welcome", Google
// login, and the phone OTP sheet — done natively (Google refuses its sign-in
// inside a WebView). Once logged in, the profile itself opens as the
// Capacitor web screen with this login handed to it (lib/webAuth).

const PINK = { 50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d" };
const EMERALD_500 = "#10b981";

const maskPhone = (phone: string) => {
	const digits = phone.replace(/\D/g, "");
	return digits.length >= 12 ? `+${digits.slice(0, 2)} ${digits.slice(2, 7)} XXXXX` : `${phone.slice(0, phone.length - 5)} XXXXX`;
};

/** AuthContext sendOtp's messages for Firebase phone-auth errors. */
function otpError(code: string | undefined) {
	switch (code) {
		case "auth/invalid-phone-number":
			return "फोन नंबर सही नहीं है। +91 के साथ 10 अंक डालें।";
		case "auth/too-many-requests":
			return "बहुत अधिक प्रयास हो गए। कुछ देर बाद दोबारा कोशिश करें।";
		case "auth/quota-exceeded":
			return "SMS limit पहुँच गई। बाद में कोशिश करें।";
		case "auth/network-request-failed":
			return "Internet connection check करें और दोबारा कोशिश करें।";
		case "auth/operation-not-allowed":
			return "Phone Login Firebase Console में चालू नहीं है। एडमिन से संपर्क करें।";
		case "auth/app-not-authorized":
		case "auth/missing-client-identifier":
			return "Android App Verification (SHA-1) failed. कृपया सेटिंग्स जांचें।";
		default:
			return "OTP नहीं भेजा जा सका। दोबारा कोशिश करें।";
	}
}

export function LoginScreen() {
	const theme = useAppTheme();
	const dark = theme.isDark;
	const insets = useSafeAreaInsets();
	const navigation = useNavigation<RootNavigation>();
	const isHindi = useSettingsStore((s) => s.settingsLanguage) === "hi";
	const [googleBusy, setGoogleBusy] = useState(false);
	const [showPhone, setShowPhone] = useState(false);

	const done = () => {
		showToast("Login successful ✅", "success");
		navigation.replace("Web", { target: { event: "cpbs:openProfile" } });
	};

	const google = async () => {
		if (googleBusy) return;
		triggerHaptic("light");
		setGoogleBusy(true);
		showToast("Google से कनेक्ट हो रहा है...", "info");
		try {
			if ((await signInWithGoogle()) === "ok") done();
		} catch (e) {
			const code = (e as { code?: string })?.code;
			if (code !== "SIGN_IN_CANCELLED" && code !== "12501") showToast("Sign-in failed. Please try again.", "error");
		} finally {
			setGoogleBusy(false);
		}
	};

	return (
		<View style={[styles.flex, { backgroundColor: dark ? ink[900] : cream[25] }]}>
			<LinearGradient
				colors={[theme.p[500], "#f97316"]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.header, { paddingTop: insets.top + 16 }]}
			>
				<Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
					<ArrowLeft size={24} color={cream[50]} />
				</Pressable>
				<Text style={styles.heading}>{isHindi ? "भक्त प्रोफाइल" : "Devotee Profile"}</Text>
			</LinearGradient>

			<View style={[styles.body, { paddingBottom: 64 + insets.bottom }]}>
				<View style={[styles.avatar, { backgroundColor: dark ? "rgba(131, 24, 67, 0.3)" : PINK[100] }]}>
					<User size={48} color={PINK[500]} />
				</View>
				<View style={styles.center}>
					<Text style={[styles.welcome, { color: dark ? "#fff" : ink[800] }]}>{isHindi ? "आपका स्वागत है" : "Welcome"}</Text>
					<Text style={[styles.welcomeSub, { color: dark ? ink[400] : ink[500] }]}>
						{isHindi ? "लाइक करने के लिए कृपया अपनी प्रोफाइल बनाएं।" : "Please create your profile to like."}
					</Text>
				</View>
				<Pressable
					onPress={google}
					disabled={googleBusy}
					style={({ pressed }) => [
						styles.googleButton,
						{ backgroundColor: dark ? ink[800] : "#fff", borderColor: dark ? ink[700] : ink[200] },
						pressed && styles.pressed,
					]}
				>
					{googleBusy ? (
						<ActivityIndicator size="small" color={ink[400]} />
					) : (
						<Svg width={20} height={20} viewBox="0 0 24 24">
							<Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
							<Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
							<Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
							<Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
						</Svg>
					)}
					<Text style={[styles.googleText, { color: dark ? "#fff" : ink[800] }]}>
						{isHindi ? "Google से लॉगिन करें" : "Login with Google"}
					</Text>
				</Pressable>

				<View style={styles.orRow}>
					<View style={[styles.orLine, { backgroundColor: dark ? ink[700] : ink[200] }]} />
					<Text style={[styles.orText, { color: ink[400] }]}>{isHindi ? "या" : "OR"}</Text>
					<View style={[styles.orLine, { backgroundColor: dark ? ink[700] : ink[200] }]} />
				</View>

				<Pressable
					onPress={() => setShowPhone(true)}
					style={({ pressed }) => [
						styles.phoneButton,
						{
							backgroundColor: dark ? "rgba(236, 72, 153, 0.1)" : PINK[50],
							borderColor: dark ? "rgba(236, 72, 153, 0.3)" : PINK[200],
						},
						pressed && styles.pressed,
					]}
				>
					<Phone size={18} color={PINK[500]} />
					<Text style={[styles.phoneText, { color: dark ? PINK[300] : PINK[700] }]}>
						{isHindi ? "Phone OTP से लॉगिन करें" : "Login with Phone OTP"}
					</Text>
				</Pressable>
			</View>

			<PhoneLoginSheet
				visible={showPhone}
				isHindi={isHindi}
				dark={dark}
				onClose={() => setShowPhone(false)}
				onDone={() => {
					setShowPhone(false);
					done();
				}}
			/>
		</View>
	);
}

/** ProfileScreen's "Login with Phone" sheet: number → OTP (auto-submits at 6 digits), resend after 30s. */
function PhoneLoginSheet({
	visible,
	isHindi,
	dark,
	onClose,
	onDone,
}: {
	visible: boolean;
	isHindi: boolean;
	dark: boolean;
	onClose: () => void;
	onDone: () => void;
}) {
	const [phone, setPhone] = useState("+91");
	const [code, setCode] = useState("");
	const [verificationId, setVerificationId] = useState<string | null>(null);
	const [timer, setTimer] = useState(0);
	const [loading, setLoading] = useState(false);
	const verifying = useRef(false);

	useEffect(() => {
		if (!visible) return;
		setPhone("+91");
		setCode("");
		setVerificationId(null);
		setTimer(0);
	}, [visible]);

	useEffect(() => {
		if (timer <= 0) return;
		const t = setTimeout(() => setTimer((s) => s - 1), 1000);
		return () => clearTimeout(t);
	}, [timer]);

	const verify = async (otp: string, id = verificationId) => {
		if (verifying.current || !id) return;
		verifying.current = true;
		setLoading(true);
		showToast("Verifying...", "info");
		try {
			await confirmPhoneOtp(id, otp);
			onDone();
		} catch {
			showToast(isHindi ? "गलत OTP, दोबारा कोशिश करें" : "Wrong OTP, try again", "error");
		} finally {
			verifying.current = false;
			setLoading(false);
		}
	};

	const send = async (resend = false) => {
		if (phone.length < 13) return;
		setLoading(true);
		showToast("OTP भेजा जा रहा है...", "info");
		try {
			const result = await sendPhoneOtp(phone, resend);
			setVerificationId(result.verificationId);
			setCode("");
			setTimer(30);
			if (result.autoCode) {
				setCode(result.autoCode);
				setLoading(false);
				await verify(result.autoCode, result.verificationId);
				return;
			}
			showToast("OTP भेजा गया ✅", "success");
		} catch (e) {
			showToast(otpError((e as { code?: string })?.code), "error");
		} finally {
			setLoading(false);
		}
	};

	const fieldStyle = [
		styles.field,
		{ backgroundColor: dark ? ink[800] : ink[100], borderColor: dark ? ink[700] : ink[200], color: dark ? "#fff" : ink[800] },
	];

	return (
		<Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
			<KeyboardAvoidingView behavior="padding" style={styles.sheetWrap}>
				<Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
				<View style={[styles.sheet, { backgroundColor: dark ? ink[900] : "#fff" }]}>
					<View style={styles.sheetHead}>
						<View style={styles.sheetTitleRow}>
							<Phone size={18} color={PINK[500]} />
							<Text style={[styles.sheetTitle, { color: dark ? "#fff" : ink[800] }]}>
								{isHindi ? "Phone से लॉगिन" : "Login with Phone"}
							</Text>
						</View>
						<Pressable hitSlop={8} onPress={onClose}>
							<X size={20} color={ink[400]} />
						</Pressable>
					</View>

					{!verificationId ? (
						<View style={styles.gap12}>
							<Text style={[styles.hint, { color: dark ? ink[400] : ink[500] }]}>
								{isHindi ? "अपना फोन नंबर दर्ज करें, OTP से वेरिफाई करें।" : "Enter your phone number and verify via OTP."}
							</Text>
							<View style={styles.phoneRow}>
								<Text style={[styles.prefix, { backgroundColor: dark ? ink[800] : ink[100], borderColor: dark ? ink[700] : ink[200], color: dark ? ink[300] : ink[600] }]}>
									+91
								</Text>
								<TextInput
									value={phone.replace(/^\+91/, "")}
									onChangeText={(v) => setPhone(`+91${v.replace(/\D/g, "").slice(0, 10)}`)}
									placeholder={isHindi ? "10 अंक डालें" : "Enter 10 digits"}
									placeholderTextColor={ink[400]}
									keyboardType="phone-pad"
									maxLength={10}
									autoFocus
									style={[fieldStyle, styles.flex]}
								/>
							</View>
							<Pressable
								onPress={() => send()}
								disabled={loading || phone.length < 13}
								style={[styles.action, { backgroundColor: PINK[500] }, (loading || phone.length < 13) && styles.disabled]}
							>
								{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{isHindi ? "OTP भेजें" : "Send OTP"}</Text>}
							</Pressable>
						</View>
					) : (
						<View style={styles.gap12}>
							<Text style={[styles.hint, styles.textCenter, { color: dark ? ink[400] : ink[500] }]}>
								{isHindi ? "OTP भेजा गया:" : "OTP sent to:"}{" "}
								<Text style={[styles.masked, { color: dark ? ink[200] : ink[700] }]}>{maskPhone(phone)}</Text>{" "}
								<Text
									onPress={() => {
										setCode("");
										setTimer(0);
										setVerificationId(null);
									}}
									style={styles.change}
								>
									{isHindi ? "बदलें" : "Change"}
								</Text>
							</Text>
							<TextInput
								value={code}
								onChangeText={(v) => {
									const next = v.replace(/\D/g, "").slice(0, 6);
									setCode(next);
									if (next.length === 6) verify(next);
								}}
								keyboardType="number-pad"
								textContentType="oneTimeCode"
								autoComplete="sms-otp"
								placeholder="6-digit OTP"
								placeholderTextColor={ink[400]}
								autoFocus
								style={[fieldStyle, styles.otp]}
							/>
							<Pressable
								onPress={() => verify(code)}
								disabled={loading || code.length < 6}
								style={[styles.action, { backgroundColor: EMERALD_500 }, (loading || code.length < 6) && styles.disabled]}
							>
								{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{isHindi ? "वेरिफाई करें" : "Verify & Login"}</Text>}
							</Pressable>
							<View style={styles.resendRow}>
								{timer > 0 ? (
									<Text style={[styles.resendWait, { color: ink[400] }]}>
										{isHindi ? `पुन: भेजें ${timer}s में` : `Resend in ${timer}s`}
									</Text>
								) : (
									<Pressable disabled={loading} onPress={() => send(true)}>
										<Text style={[styles.resend, loading && styles.disabled]}>{isHindi ? "मुझे OTP फिर से भेजें" : "Resend OTP"}</Text>
									</Pressable>
								)}
							</View>
						</View>
					)}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	pressed: { transform: [{ scale: 0.95 }] },
	disabled: { opacity: 0.5 },
	gap12: { gap: 12 },
	textCenter: { textAlign: "center" },
	center: { alignItems: "center" },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		padding: 16,
		borderBottomWidth: 2,
		borderBottomColor: "rgba(212, 160, 23, 0.4)",
		elevation: 4,
	},
	back: { padding: 8, marginLeft: -8, borderRadius: 999 },
	heading: { flex: 1, color: cream[50], fontFamily: serif, fontSize: 20, fontWeight: "600" },
	body: { flex: 1, alignSelf: "center", width: "100%", maxWidth: 384, padding: 20, alignItems: "stretch", justifyContent: "center", gap: 24 },
	avatar: { alignSelf: "center", width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
	welcome: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
	welcomeSub: { fontSize: 14, textAlign: "center" },
	googleButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 16,
		borderWidth: 1,
		elevation: 1,
	},
	googleText: { fontSize: 16, fontWeight: "700" },
	orRow: { flexDirection: "row", alignItems: "center", gap: 12 },
	orLine: { flex: 1, height: 1 },
	orText: { fontSize: 12, fontWeight: "500" },
	phoneButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 16,
		borderWidth: 1,
	},
	phoneText: { fontSize: 16, fontWeight: "700" },
	backdrop: { backgroundColor: "rgba(0, 0, 0, 0.6)" },
	sheetWrap: { flex: 1, justifyContent: "flex-end", padding: 16 },
	sheet: { borderRadius: 24, padding: 24, elevation: 16 },
	sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
	sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	sheetTitle: { fontSize: 18, fontWeight: "700" },
	hint: { fontSize: 12 },
	phoneRow: { flexDirection: "row", gap: 8 },
	prefix: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, fontWeight: "700", overflow: "hidden" },
	field: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontWeight: "500" },
	otp: { fontSize: 18, fontWeight: "700", letterSpacing: 6, textAlign: "center" },
	masked: { fontWeight: "700", letterSpacing: 1 },
	change: { color: PINK[500], fontWeight: "700", textDecorationLine: "underline" },
	action: { paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 48 },
	actionText: { color: "#fff", fontSize: 16, fontWeight: "700" },
	resendRow: { alignItems: "center" },
	resendWait: { fontSize: 12 },
	resend: { fontSize: 12, fontWeight: "700", color: PINK[500], textDecorationLine: "underline" },
});

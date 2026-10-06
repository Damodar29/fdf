import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { AlertCircle, Mic, MicOff, Settings, X } from "lucide-react-native";
import { useEffect, useId, useRef, useState } from "react";
import { Animated, Easing, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { triggerHaptic } from "../lib/haptics";
import { showToast } from "../store/toastStore";
import { ink } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

// components/VoiceSearchButton.tsx: the 🎤 button in every search bar. Uses
// the phone's Google speech recogniser (expo-speech-recognition) in hi-IN,
// which understands Hindi as well as English/Hinglish, shows the words live
// as they are recognised, and offers to open the app's settings when the
// microphone permission was denied.

const RED_500 = "#ef4444";

// Recognition events are global; only the button that started listening
// reacts to them (a screen can show two, e.g. the search bar and the FAB).
let activeOwner: string | null = null;

export function VoiceSearchButton({
	onResult,
	lang = "hi-IN",
	size = 18,
	color,
}: {
	onResult: (transcript: string) => void;
	lang?: string;
	size?: number;
	/** Icon colour when idle (`!text-white` on the Bhajans FAB). */
	color?: string;
}) {
	const id = useId();
	const [listening, setListening] = useState(false);
	const [showPermission, setShowPermission] = useState(false);
	const ping = useRef(new Animated.Value(0)).current;
	const mine = () => activeOwner === id;

	useEffect(() => {
		if (!listening) return;
		const loop = Animated.loop(
			Animated.timing(ping, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
		);
		loop.start();
		return () => {
			loop.stop();
			ping.setValue(0);
		};
	}, [listening, ping]);

	// Stop listening when the button goes away.
	useEffect(
		() => () => {
			if (activeOwner === id) {
				activeOwner = null;
				ExpoSpeechRecognitionModule.abort();
			}
		},
		[id],
	);

	useSpeechRecognitionEvent("start", () => {
		if (!mine()) return;
		setListening(true);
		showToast("सुन रहे हैं... (Speak now)", "info");
	});

	useSpeechRecognitionEvent("result", (event) => {
		if (!mine()) return;
		const text = event.results[0]?.transcript?.trim();
		if (text) onResult(text);
	});

	useSpeechRecognitionEvent("error", (event) => {
		if (!mine()) return;
		setListening(false);
		switch (event.error) {
			case "not-allowed":
				setShowPermission(true);
				break;
			case "no-speech":
			case "speech-timeout":
				showToast("कोई आवाज़ नहीं सुनी गई। फिर से प्रयास करें। (No speech detected)", "info");
				break;
			case "aborted":
				// Stopped by the user, or another recognition took over — not an error.
				break;
			case "network":
				showToast("इंटरनेट कनेक्शन नहीं है। (Voice Search needs internet)", "error");
				break;
			case "audio-capture":
				showToast("माइक्रोफ़ोन नहीं मिला। (No microphone found)", "error");
				break;
			default:
				showToast(`Voice Search Error: ${event.error}`, "error");
		}
	});

	useSpeechRecognitionEvent("end", () => {
		if (!mine()) return;
		activeOwner = null;
		setListening(false);
	});

	const toggle = async () => {
		if (listening) {
			triggerHaptic("light");
			ExpoSpeechRecognitionModule.stop();
			setListening(false);
			return;
		}
		const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
		if (!permission.granted) {
			setShowPermission(true);
			return;
		}
		triggerHaptic("medium");
		try {
			activeOwner = id;
			ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: false, maxAlternatives: 1 });
		} catch {
			activeOwner = null;
			setListening(false);
			showToast("Voice Search प्रारंभ करने में विफल। कृपया फिर से प्रयास करें।", "error");
		}
	};

	return (
		<>
			<Pressable
				accessibilityLabel="Google Voice Search (बोलकर खोजें)"
				onPress={toggle}
				hitSlop={6}
				style={({ pressed }) => [
					styles.button,
					listening && styles.listening,
					pressed && !listening && { transform: [{ scale: 1.05 }] },
				]}
			>
				{listening ? (
					<Animated.View
						pointerEvents="none"
						style={[
							styles.ping,
							{
								opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
								transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
							},
						]}
					/>
				) : null}
				<Mic size={size} color={listening ? RED_500 : (color ?? ink[400])} />
			</Pressable>
			<PermissionDialog visible={showPermission} onClose={() => setShowPermission(false)} />
		</>
	);
}

/** The "microphone permission needed" recovery dialog. */
function PermissionDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
	const theme = useAppTheme();
	const dark = theme.isDark;
	const openSettings = () => {
		Linking.openSettings().catch(() =>
			showToast("सेटिंग्स नहीं खुल सकी। कृपया अपने फोन की Settings -> Apps में जाएँ।", "error"),
		);
		onClose();
	};
	return (
		<Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
			<View style={styles.center}>
				<Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
				<View style={[styles.dialog, { backgroundColor: dark ? ink[900] : "#fff", borderColor: dark ? ink[800] : ink[200] }]}>
					<Pressable accessibilityLabel="Close modal" onPress={onClose} style={styles.close}>
						<X size={20} color={ink[400]} />
					</Pressable>
					<View style={[styles.icon, { backgroundColor: dark ? "rgba(127, 29, 29, 0.3)" : "#fee2e2" }]}>
						<MicOff size={32} color={dark ? "#f87171" : "#dc2626"} />
					</View>
					<View style={styles.titleRow}>
						<AlertCircle size={20} color={RED_500} />
						<Text style={[styles.title, { color: dark ? "#fff" : ink[800] }]}>माइक्रोफ़ोन अनुमति आवश्यक</Text>
					</View>
					<Text style={[styles.body, { color: dark ? ink[300] : ink[600] }]}>
						आपने माइक्रोफ़ोन की अनुमति अस्वीकार (Deny) कर दी है। बोलकर भजन या पुस्तकें खोजने के लिए कृपया ऐप सेटिंग्स में जाकर{" "}
						<Text style={styles.bold}>Microphone</Text> की अनुमति (Allow) दें।
					</Text>
					<Text style={[styles.note, { color: dark ? ink[500] : ink[400] }]}>
						You have denied microphone access. Please enable microphone permission in App Settings to use Voice Search.
					</Text>
					<View style={styles.actions}>
						<Pressable onPress={onClose} style={[styles.cancel, { backgroundColor: dark ? ink[800] : ink[100] }]}>
							<Text style={[styles.cancelText, { color: dark ? ink[300] : ink[700] }]}>रद्द करें (Cancel)</Text>
						</Pressable>
						<Pressable onPress={openSettings} style={styles.flex}>
							<LinearGradient
								colors={[RED_500, "#ec4899"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 0 }}
								style={styles.settings}
							>
								<Settings size={18} color="#fff" />
								<Text style={styles.settingsText}>सेटिंग्स खोलें (Open Settings)</Text>
							</LinearGradient>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	bold: { fontWeight: "700" },
	button: { padding: 6, borderRadius: 999, alignItems: "center", justifyContent: "center" },
	listening: { backgroundColor: "rgba(239, 68, 68, 0.1)", transform: [{ scale: 1.1 }] },
	ping: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, backgroundColor: "rgba(239, 68, 68, 0.2)" },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
	backdrop: { backgroundColor: "rgba(0, 0, 0, 0.6)" },
	dialog: { width: "100%", maxWidth: 448, borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center", elevation: 16 },
	close: { position: "absolute", right: 16, top: 16, padding: 4, zIndex: 1 },
	icon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
	titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
	title: { fontSize: 18, fontWeight: "700" },
	body: { fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 8 },
	note: { fontSize: 12, textAlign: "center", marginBottom: 24 },
	actions: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" },
	cancel: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
	cancelText: { fontSize: 14, fontWeight: "500" },
	settings: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 12,
		elevation: 3,
	},
	settingsText: { color: "#fff", fontSize: 14, fontWeight: "600", flexShrink: 1 },
});

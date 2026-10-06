import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";
import Constants from "expo-constants";
import { Download } from "lucide-react-native";
import { useEffect, useState } from "react";
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
	Easing,
	FadeIn,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
	ZoomIn,
} from "react-native-reanimated";
import { useAppTheme } from "../theme/useAppTheme";

// ForceUpdateScreen of the Capacitor app: when app_config/version_control
// asks for a newer app (minNativeVersion), the app is blocked with a link to
// the Play Store (useAppConfig).

interface ForceUpdateConfig {
	updateTitle: string;
	updateMessage: string;
	playStoreUrl: string;
}

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.cpbs.bhajans";

/** utils/versioning.ts isVersionOlder. */
function isVersionOlder(current: string, required: string): boolean {
	const norm = (v: string) => (v || "").trim().replace(/^v/i, "");
	if (!norm(current) || !norm(required)) return false;
	const a = norm(current).split(".").map(Number);
	const b = norm(required).split(".").map(Number);
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const x = Number.isFinite(a[i]) ? a[i] : 0;
		const y = Number.isFinite(b[i]) ? b[i] : 0;
		if (x < y) return true;
		if (x > y) return false;
	}
	return false;
}

export function ForceUpdateGate() {
	const { isDark } = useAppTheme();
	const [config, setConfig] = useState<ForceUpdateConfig | null>(null);
	const bounce = useSharedValue(0);

	useEffect(
		() =>
			onSnapshot(
				doc(getFirestore(), "app_config", "version_control"),
				(snap) => {
					const data = snap.exists() ? snap.data() : null;
					const version = Constants.expoConfig?.version ?? "";
					if (data?.minNativeVersion && isVersionOlder(version, String(data.minNativeVersion))) {
						setConfig({
							updateTitle: data.updateTitle || "Update Required",
							updateMessage: data.updateMessage || "A new version of the app is available. Please update to continue.",
							playStoreUrl: data.playStoreUrl || PLAY_URL,
						});
					} else setConfig(null);
				},
				() => {},
			),
		[],
	);

	useEffect(() => {
		if (!config) return;
		bounce.value = withRepeat(
			withSequence(
				withTiming(-9, { duration: 500, easing: Easing.out(Easing.cubic) }),
				withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }),
			),
			-1,
		);
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			BackHandler.exitApp();
			return true;
		});
		return () => sub.remove();
	}, [config, bounce]);

	const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.value }] }));

	if (!config) return null;

	return (
		<Animated.View entering={FadeIn.duration(300)} style={[StyleSheet.absoluteFill, styles.root]}>
			<View style={[styles.blob, styles.blobTop]} />
			<View style={[styles.blob, styles.blobBottom]} />
			<Animated.View entering={ZoomIn.duration(500).delay(100)} style={[styles.card, { backgroundColor: isDark ? "#1e293b" : "#fff" }]}>
				<View style={[styles.iconCircle, { backgroundColor: isDark ? "rgba(30,58,138,0.3)" : "#dbeafe" }]}>
					<Animated.View style={iconStyle}>
						<Download size={36} color={isDark ? "#60a5fa" : "#2563eb"} />
					</Animated.View>
				</View>
				<Text style={[styles.title, { color: isDark ? "#fff" : "#1e293b" }]}>{config.updateTitle}</Text>
				<Text style={[styles.message, { color: isDark ? "#cbd5e1" : "#475569" }]}>{config.updateMessage}</Text>
				<Pressable style={styles.update} onPress={() => Linking.openURL(config.playStoreUrl).catch(() => {})}>
					<Text style={styles.updateText}>Update Now</Text>
				</Pressable>
				<Pressable style={styles.close} onPress={() => BackHandler.exitApp()}>
					<Text style={[styles.closeText, { color: isDark ? "#C0CDE4" : "#64748b" }]}>Close App</Text>
				</Pressable>
			</Animated.View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	root: { backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" },
	blob: { position: "absolute", width: "60%", aspectRatio: 1, borderRadius: 999, opacity: 0.2 },
	blobTop: { top: "-10%", left: "-10%", backgroundColor: "#3b82f6" },
	blobBottom: { bottom: "-10%", right: "-10%", backgroundColor: "#6366f1" },
	card: {
		width: "100%",
		maxWidth: 384,
		borderRadius: 24,
		padding: 32,
		alignItems: "center",
		shadowColor: "#000",
		shadowOpacity: 0.25,
		shadowRadius: 50,
		shadowOffset: { width: 0, height: 25 },
		elevation: 24,
	},
	iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 24 },
	title: { fontSize: 24, fontWeight: "700", marginBottom: 12, textAlign: "center" },
	message: { fontSize: 14, lineHeight: 22, marginBottom: 32, textAlign: "center" },
	update: {
		width: "100%",
		paddingVertical: 14,
		borderRadius: 16,
		backgroundColor: "#2563eb",
		alignItems: "center",
		shadowColor: "#000",
		shadowOpacity: 0.2,
		shadowRadius: 10,
		elevation: 6,
	},
	updateText: { color: "#fff", fontWeight: "700", fontSize: 16 },
	close: { width: "100%", paddingVertical: 12, borderRadius: 16, alignItems: "center", marginTop: 12 },
	closeText: { fontWeight: "700", fontSize: 16 },
});

import { LinearGradient } from "expo-linear-gradient";
import { Bell, Settings } from "lucide-react-native";
import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
	Easing,
	FadeInDown,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { openNotificationSettings } from "../../modules/app-notifications";
import { useNotificationGate } from "../lib/notifications";
import { cream, krishna } from "../theme/jmColors";

/**
 * NotificationsPermissionScreen of the Capacitor app (native state): covers the
 * whole app while notifications are off; the button opens the app's
 * notification settings. No way past it — as in the Capacitor app.
 */
export function NotificationsGate() {
	const blocked = useNotificationGate((s) => s.blocked);
	const pulse = useSharedValue(1);
	const glow = useSharedValue(0);

	// Back leaves the app instead of reaching the screens behind.
	useEffect(() => {
		if (!blocked) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			BackHandler.exitApp();
			return true;
		});
		return () => sub.remove();
	}, [blocked]);

	useEffect(() => {
		if (!blocked) return;
		pulse.value = withRepeat(withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
		glow.value = withRepeat(withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.ease) }), -1, true);
	}, [blocked, pulse, glow]);

	const iconStyle = useAnimatedStyle(() => ({
		opacity: 0.6 + 0.4 * pulse.value,
		transform: [{ scale: 0.95 + 0.05 * pulse.value }],
	}));
	const buttonStyle = useAnimatedStyle(() => ({
		shadowOpacity: 0.25 + 0.25 * glow.value,
		shadowRadius: 16 + 12 * glow.value,
	}));

	if (!blocked) return null;

	return (
		<View style={StyleSheet.absoluteFill}>
			<LinearGradient
				colors={[krishna[500], krishna[600], krishna[800]]}
				locations={[0, 0.5, 1]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={styles.root}
			>
				<View style={styles.column}>
					<Animated.View style={[styles.icon, iconStyle]}>
						<Bell size={80} color="#fff" />
					</Animated.View>

					<Animated.View entering={FadeInDown.duration(800)} style={styles.texts}>
						<Text style={styles.title}>Enable Notifications</Text>
						<Text style={styles.subtitle}>Notifications are required to use this app</Text>
						<View style={styles.divider} />
						<Text style={styles.titleHi}>सूचनाएं सक्षम करें</Text>
						<Text style={styles.subtitleHi}>इस ऐप को उपयोग करने के लिए सूचनाओं की अनुमति आवश्यक है</Text>
					</Animated.View>

					<Animated.View entering={FadeInDown.duration(800)} style={[styles.buttonWrap, buttonStyle]}>
						<Pressable onPress={openNotificationSettings} style={styles.button}>
							<Settings size={22} color={krishna[700]} />
							<Text style={styles.buttonText}>Enable Notifications</Text>
						</Pressable>
					</Animated.View>
				</View>
			</LinearGradient>
		</View>
	);
}

const textShadow = { textShadowColor: "rgba(0,0,0,0.3)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 };

const styles = StyleSheet.create({
	root: { flex: 1, alignItems: "center", justifyContent: "center" },
	column: { width: "100%", maxWidth: 448, paddingHorizontal: 32, alignItems: "center", gap: 24 },
	icon: { shadowColor: "#fff", shadowOpacity: 0.4, shadowRadius: 20 },
	texts: { alignItems: "center" },
	title: { fontSize: 30, lineHeight: 36, fontWeight: "700", color: "#fff", textAlign: "center", ...textShadow },
	subtitle: { marginTop: 8, fontSize: 18, lineHeight: 28, color: cream[100], opacity: 0.9, textAlign: "center" },
	divider: { width: 64, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.3)", marginVertical: 24 },
	titleHi: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: "#fff", textAlign: "center", ...textShadow },
	subtitleHi: { marginTop: 8, fontSize: 16, lineHeight: 24, color: cream[100], opacity: 0.9, textAlign: "center" },
	buttonWrap: { width: "100%", borderRadius: 16, shadowColor: "#fff", shadowOffset: { width: 0, height: 0 } },
	button: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		paddingVertical: 16,
		borderRadius: 16,
		backgroundColor: "rgba(255,255,255,0.95)",
	},
	buttonText: { fontSize: 18, fontWeight: "700", color: krishna[700] },
});

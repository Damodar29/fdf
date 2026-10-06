import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Settings, User } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { triggerHaptic } from "../lib/haptics";
import type { RootNavigation } from "../navigation/types";
import { THUMB, thumbUrl } from "../lib/imageThumb";
import { useAuthStore } from "../store/authStore";
import { useMenuStore } from "../store/menuStore";
import { rejectionAlerts, startProfileSync, useProfileStore } from "../store/profileStore";
import { useSettingsStore } from "../store/settingsStore";
import { cream, gold, krishna, royalGradient, serif, status } from "../theme/colors";
import { GoldRule } from "./GoldRule";
import { GoldenMandala, Tilak } from "./Ornaments";

/** Header bar height below the status bar (web: 18 × 0.25rem at uiScale 1). */
export const HEADER_HEIGHT = 72;
const TILAK_HEIGHT = 32;

/**
 * The app bar from components/JanmashtamiHeader.tsx: Krishna-blue gradient,
 * menu on the left, the gold tilak + "Shree Chaitanya / Prem Bhakti Sangh"
 * lockup in the centre, profile and settings on the right, and a gold
 * hairline along the base.
 */
export function AppHeader() {
	const insets = useSafeAreaInsets();
	const navigation = useNavigation<RootNavigation>();
	const isHindi = useSettingsStore((s) => s.settingsLanguage) === "hi";
	const user = useAuthStore((s) => s.user);
	const profile = useProfileStore((s) => s.profile);
	const requests = useProfileStore((s) => s.pendingFamilyRequests);
	const needsFix = rejectionAlerts(profile).length > 0;
	useEffect(() => startProfileSync(), []);

	// Logged in: the profile (Capacitor web screen); otherwise the native login.
	const openProfile = () => {
		triggerHaptic("light");
		if (useAuthStore.getState().user) navigation.navigate("Web", { target: { event: "cpbs:openProfile" } });
		else navigation.navigate("Login");
	};

	return (
		<LinearGradient
			colors={royalGradient}
			locations={[0, 0.55, 1]}
			start={{ x: 0.3, y: 0 }}
			end={{ x: 0.7, y: 1 }}
			style={[styles.header, { paddingTop: insets.top, height: HEADER_HEIGHT + insets.top }]}
		>
			<View style={styles.row}>
				<Pressable
					accessibilityLabel="Open menu"
					onPress={() => {
						triggerHaptic("light");
						useMenuStore.getState().setOpen(true);
					}}
					style={styles.touch}
				>
					<View style={styles.burger}>
						<View style={styles.burgerLine} />
						<View style={styles.burgerLine} />
						<View style={styles.burgerLine} />
					</View>
				</Pressable>

				<View style={styles.lockup}>
					<View style={styles.glow} />
					<View style={styles.tilak}>
						<View style={styles.halo} pointerEvents="none">
							<GoldenMandala size={Math.round(TILAK_HEIGHT * 1.9)} color="rgba(255, 213, 79, 0.2)" />
						</View>
						<Tilak height={TILAK_HEIGHT} color={gold[300]} />
					</View>
					<View style={styles.wordmark}>
						<Text style={[styles.title, isHindi ? styles.titleHi : null]}>
							{isHindi ? "श्री चैतन्य" : "Shree Chaitanya"}
						</Text>
						<View style={styles.titleRule} />
						<Text style={[styles.subtitle, isHindi ? styles.subtitleHi : null]}>
							{isHindi ? "प्रेम भक्ति संघ" : "PREM BHAKTI SANGH"}
						</Text>
					</View>
				</View>

				<View style={styles.actions}>
					<Pressable
						accessibilityLabel={`Open profile${needsFix ? " — needs changes" : ""}${requests > 0 ? ` — ${requests} family request${requests > 1 ? "s" : ""}` : ""}`}
						onPress={openProfile}
						style={styles.touch}
					>
						{profile?.photoURL ? (
							<Image source={{ uri: thumbUrl(profile.photoURL, THUMB.small) }} style={styles.avatar} contentFit="cover" />
						) : (
							<User size={24} strokeWidth={2} color={cream[50]} />
						)}
						{requests > 0 ? (
							// Family link requests waiting for an answer.
							<View style={styles.requests}>
								<Text style={styles.requestsText}>{requests > 9 ? "9+" : requests}</Text>
							</View>
						) : null}
						{user ? (
							// Profile state: needs changes / approved / awaiting approval.
							<View
								style={[
									styles.statusDot,
									{ backgroundColor: needsFix ? "#EF4444" : profile?.isApproved ? status.success : gold[300] },
								]}
							/>
						) : null}
					</Pressable>
					<Pressable
						accessibilityLabel="Open settings"
						onPress={() => {
							triggerHaptic("light");
							navigation.navigate("Settings");
						}}
						style={styles.touch}
					>
						<Settings size={24} strokeWidth={2} color={cream[50]} />
					</Pressable>
				</View>
			</View>
			<GoldRule opacity={0.7} style={styles.baseRule} />
		</LinearGradient>
	);
}

const styles = StyleSheet.create({
	header: {
		elevation: 8,
		shadowColor: "#071529",
		shadowOpacity: 0.28,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		zIndex: 30,
	},
	row: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
	},
	touch: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
	avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: gold[300] },
	requests: {
		position: "absolute",
		top: 2,
		left: 2,
		minWidth: 16,
		height: 16,
		paddingHorizontal: 4,
		borderRadius: 8,
		backgroundColor: "#EF4444",
		borderWidth: 1,
		borderColor: krishna[700],
		alignItems: "center",
		justifyContent: "center",
	},
	requestsText: { color: "#fff", fontSize: 9, fontWeight: "700", lineHeight: 12 },
	statusDot: {
		position: "absolute",
		top: 6,
		right: 6,
		width: 10,
		height: 10,
		borderRadius: 5,
		borderWidth: 2,
		borderColor: krishna[700],
	},
	burger: { gap: 6 },
	burgerLine: { width: 24, height: 2, borderRadius: 1, backgroundColor: cream[50] },
	lockup: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
	glow: {
		position: "absolute",
		alignSelf: "center",
		left: "10%",
		right: "10%",
		height: 32,
		borderRadius: 16,
		backgroundColor: "rgba(255, 213, 79, 0.08)",
	},
	tilak: { height: TILAK_HEIGHT, alignItems: "center", justifyContent: "center" },
	halo: { position: "absolute", alignItems: "center", justifyContent: "center" },
	wordmark: { alignItems: "center" },
	title: {
		color: gold[300],
		fontFamily: serif,
		fontWeight: "600",
		fontSize: 15,
		letterSpacing: 0.4,
		lineHeight: 17,
	},
	titleHi: { fontSize: 15, letterSpacing: 0, lineHeight: 20, marginTop: 2 },
	titleRule: { alignSelf: "stretch", height: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(255, 213, 79, 0.5)", marginVertical: 3 },
	subtitle: {
		color: "rgba(255, 248, 231, 0.85)",
		fontSize: 9,
		fontWeight: "600",
		letterSpacing: 1.4,
	},
	subtitleHi: { fontSize: 12.5, letterSpacing: 0 },
	actions: { flexDirection: "row", alignItems: "center", gap: 4 },
	baseRule: { position: "absolute", left: 0, right: 0, bottom: 0 },
});

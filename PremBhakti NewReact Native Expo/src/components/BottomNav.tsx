import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { BookOpen, Headphones, Home, type LucideIcon, Music, ScrollText } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { triggerHaptic } from "../lib/haptics";
import type { TabParamList } from "../navigation/types";
import { usePlayerUiStore } from "../store/playerUiStore";
import { useSettingsStore } from "../store/settingsStore";
import { gold, royalGradient } from "../theme/colors";
import { GoldRule } from "./GoldRule";
import { MiniPlayer } from "./MiniPlayer";
import { TempleNiche } from "./Ornaments";

const NAV_HEIGHT = 64;
const NAV_MARGIN = 16;

/**
 * Space a tab screen must leave at the bottom of its scroll content so the
 * last row clears the floating nav (App.tsx's `pb-[calc(6rem+safe-area)]`).
 */
export function useTabBarSpace() {
	return NAV_MARGIN * 2 + NAV_HEIGHT + useSafeAreaInsets().bottom;
}

type NavTab = Exclude<keyof TabParamList, "Downloads">;
const TABS: Record<NavTab, { icon: LucideIcon; en: string; hi: string }> = {
	Books: { icon: BookOpen, en: "Books", hi: "ग्रंथ" },
	Lectures: { icon: Headphones, en: "Audio", hi: "ऑडियो" },
	Home: { icon: Home, en: "Home", hi: "होम" },
	Songs: { icon: Music, en: "Bhajans", hi: "भजन" },
	Library: { icon: ScrollText, en: "History", hi: "इतिहास" },
};

const REST = "rgba(255, 248, 231, 0.55)";

/**
 * The floating Krishna-blue pill from components/JanmashtamiBottomNav.tsx,
 * with the mini player riding just above it (hidden on the Audio tab, as in
 * App.tsx). Rendered as the tab navigator's tabBar, floating over content.
 */
export function BottomNav({ state, navigation }: BottomTabBarProps) {
	const insets = useSafeAreaInsets();
	const isHindi = useSettingsStore((s) => s.settingsLanguage) === "hi";
	const activeName = state.routes[state.index].name as keyof TabParamList;
	// Downloads has no button; Bhajans stays lit meanwhile (App.tsx).
	const litName: NavTab = activeName === "Downloads" ? "Songs" : activeName;
	const panelMinimized = usePlayerUiStore((s) => s.minimized);

	return (
		<View pointerEvents="box-none" style={styles.wrapper}>
			{/* On the Audio tab the docked player takes over unless minimised. */}
			{activeName !== "Lectures" || panelMinimized ? (
				<MiniPlayer bottom={72 + insets.bottom} onAudioTab={activeName === "Lectures"} />
			) : null}
			<View style={[styles.outer, { paddingBottom: NAV_MARGIN + insets.bottom }]}>
				<LinearGradient
					colors={royalGradient}
					locations={[0, 0.55, 1]}
					start={{ x: 0.3, y: 0 }}
					end={{ x: 0.7, y: 1 }}
					style={styles.nav}
				>
					<GoldRule opacity={0.5} style={styles.topRule} />
					{state.routes.map((route) => {
						const name = route.name as keyof TabParamList;
						if (name === "Downloads") return null;
						const tab = TABS[name];
						const active = name === litName;
						const isHome = name === "Home";
						const Icon = tab.icon;
						const label = isHindi ? tab.hi : tab.en;
						return (
							<Pressable
								key={route.key}
								accessibilityRole="tab"
								accessibilityLabel={label}
								accessibilityState={{ selected: active }}
								onPress={() => {
									if (name === activeName) return;
									triggerHaptic("light");
									navigation.navigate(route.name);
								}}
								style={styles.button}
							>
								<View style={styles.iconWrap}>
									{active ? (
										<View style={styles.niche} pointerEvents="none">
											<TempleNiche home={isHome} color="rgba(255, 213, 79, 0.8)" />
										</View>
									) : null}
									<View
										style={[
											styles.medallion,
											active ? styles.medallionActive : isHome ? styles.medallionHome : null,
										]}
									>
										<Icon size={24} strokeWidth={active ? 2.4 : 1.8} color={active ? gold[300] : REST} />
									</View>
								</View>
								{active ? (
									<>
										<Text style={styles.label} numberOfLines={1}>
											{label}
										</Text>
										<GoldRule opacity={0.75} style={styles.threshold} />
									</>
								) : null}
							</Pressable>
						);
					})}
				</LinearGradient>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrapper: { position: "absolute", left: 0, right: 0, bottom: 0 },
	outer: { paddingHorizontal: NAV_MARGIN, paddingTop: NAV_MARGIN },
	nav: {
		height: NAV_HEIGHT,
		borderRadius: 24,
		borderWidth: 1,
		borderColor: "rgba(255, 213, 79, 0.25)",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-around",
		overflow: "hidden",
		elevation: 10,
		shadowColor: "#071529",
		shadowOpacity: 0.26,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: -6 },
	},
	topRule: { position: "absolute", top: 0, left: 0, right: 0 },
	button: { flex: 1, height: "100%", minHeight: 44, alignItems: "center", justifyContent: "center" },
	iconWrap: { alignItems: "center", justifyContent: "center" },
	niche: { position: "absolute", alignItems: "center", justifyContent: "center" },
	medallion: { padding: 6, borderRadius: 16 },
	medallionHome: {
		backgroundColor: "rgba(255, 213, 79, 0.1)",
		borderWidth: 1,
		borderColor: "rgba(255, 213, 79, 0.25)",
		padding: 5,
	},
	medallionActive: {
		shadowColor: gold[300],
		shadowOpacity: 0.45,
		shadowRadius: 6,
	},
	label: { fontSize: 10, fontWeight: "600", color: gold[300], marginTop: 1, letterSpacing: -0.2 },
	threshold: { width: 20, marginTop: 4 },
});

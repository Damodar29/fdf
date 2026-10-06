import { useNavigation } from "@react-navigation/native";
import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import {
	Bell,
	CircleHelp,
	Clock,
	Download,
	Heart,
	Info,
	type LucideIcon,
	MessageCircle,
	Play,
	RefreshCcw,
	Share2,
	ShieldCheck,
	Smartphone,
	X,
	Sparkles
} from "lucide-react-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	Animated,
	BackHandler,
	Easing,
	Linking,
	Modal,
	Pressable,
	Share,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import type { RootNavigation } from "../navigation/types";
import type { WebTarget } from "../screens/WebScreen";
import { openScreen } from "../lib/appNav";
import { useMenuStore } from "../store/menuStore";
import { useSettingsStore } from "../store/settingsStore";
import { cream, gold, ink, janmashtami, krishna, serif } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import { FeedbackDialog } from "./FeedbackDialog";
import { SideScrollView } from "./SideScrollView";
import { useHomeDataStore } from "../store/homeDataStore";
import { webGet, useWebStoreVersion } from "../lib/webStore";

// Native rebuild of components/SideMenu.tsx (portrait): the cream drawer with
// the gold tilak lockup (tap → About), the menu items, and the version in the
// footer. Items whose screens aren't native yet open the Capacitor web screen
// (WebScreen). "App Tour" in How-to-use waits for the tour port (done last).

const RY_GOLD = janmashtami.deepGold;
const goldA = (a: number) => `rgba(212, 160, 23, ${a})`;
const DEFAULT_HOW_TO_VIDEO = "https://www.youtube.com/watch?v=kYIIfyRk49k";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.cpbs.bhajans";

const T = {
	en: {
		information: "Information",
		donate: "Donate",
		downloads: "Downloads / Offline",
		about: "About Us",
		privacy: "Privacy Policy",
		feedback: "Feedback / Queries",
		feedbackSub: "(replied within a day)",
		howToUse: "How to use App",
		introSlides: "Intro Slides",
		introSlidesDesc: "See the welcome slides again",
		watchVideo: "Watch Video Demo",
		videoDesc: "Watch on YouTube",
		templeTimings: "Temple Timings",
		checkUpdates: "Check for Updates",
		share: "Share App",
	},
	hi: {
		information: "सूचना",
		donate: "सहयोग करें",
		downloads: "डाउनलोड्स / ऑफलाइन",
		about: "हमारे बारे में",
		privacy: "गोपनीयता नीति",
		feedback: "सुझाव / संपर्क",
		feedbackSub: "(एक दिन में उत्तर)",
		howToUse: "उपयोग कैसे करें",
		introSlides: "परिचय स्लाइड्स",
		introSlidesDesc: "शुरुआती परिचय फिर से देखें",
		watchVideo: "वीडियो डेमो देखें",
		videoDesc: "यूट्यूब पर वीडियो देखें",
		templeTimings: "मंदिर दर्शन समय",
		checkUpdates: "अपडेट चेक करें",
		share: "ऐप शेयर करें",
	},
};

export function SideMenu() {
	const theme = useAppTheme();
	const dark = theme.isDark;
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const navigation = useNavigation<RootNavigation>();
	const open = useMenuStore((s) => s.open);
	const setOpen = useMenuStore((s) => s.setOpen);
	const language = useSettingsStore((s) => s.settingsLanguage);
	const isHindi = language === "hi";
	const t = T[language];
	const drawerWidth = Math.min(320, width * 0.85);
	const progress = useRef(new Animated.Value(0)).current;
	const [mounted, setMounted] = useState(false);
	const [showHelp, setShowHelp] = useState(false);
	const [showFeedback, setShowFeedback] = useState(false);
	const [youtubeLink, setYoutubeLink] = useState(DEFAULT_HOW_TO_VIDEO);
	const [hasNewInformation, setHasNewInformation] = useState(false);
	const infoData = useHomeDataStore((s) => s.information);
	
	// Re-render when webStore changes so badges update
	useWebStoreVersion();

	useEffect(() => {
		if (!open) return;
		if (infoData?.enabled && infoData.items && infoData.items.length > 0) {
			let readIds: string[] = [];
			try { readIds = JSON.parse(webGet("cpbs_read_info_ids") || "[]"); } catch {}
			const now = Date.now();
			const hasNew = infoData.items.some(i => i.isEnabled !== false && (!i.expiryDate || i.expiryDate > now) && !readIds.includes(i.id));
			setHasNewInformation(hasNew);
		} else if (infoData?.enabled && (infoData.title || infoData.text)) {
			const lastTitle = webGet("cpbs_last_read_info_title");
			setHasNewInformation(lastTitle !== infoData.title);
		} else {
			setHasNewInformation(false);
		}
	}, [open, infoData]);

	useEffect(() => {
		if (open) setMounted(true);
		Animated.timing(progress, {
			toValue: open ? 1 : 0,
			duration: 300,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start(({ finished }) => {
			if (finished && !open) setMounted(false);
		});
	}, [open, progress]);

	// Back closes the menu first.
	useEffect(() => {
		if (!open) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			setOpen(false);
			return true;
		});
		return () => sub.remove();
	}, [open, setOpen]);

	// The how-to video link is configurable (app_config/settings), as in SideMenu.
	useEffect(() => {
		if (!open) return;
		getDoc(doc(getFirestore(), "app_config", "settings"))
			.then((snap) => {
				const url = snap.data()?.youtubeHowToUseUrl;
				if (typeof url === "string" && url) setYoutubeLink(url);
			})
			.catch(() => {});
	}, [open]);

	const close = () => setOpen(false);
	const openWeb = (target: WebTarget) => {
		close();
		navigation.navigate("Web", { target });
	};
	const share = () => {
		Share.share({
			title: "Shree Chaitanya Prem Bhakti Sangh",
			message: "Download the Prem Bhakti app & visit our website:\nhttps://chaitanyaprembhakti.org",
		}).catch(() => {});
	};

	if (!mounted) return null;

	const iconColor = dark ? gold[300] : krishna[600];
	return (
		<>
			<Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={close}>
				<Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
					<Pressable accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={close} />
				</Animated.View>
				<Animated.View
					style={[
						styles.drawer,
						{
							width: drawerWidth,
							backgroundColor: dark ? ink[900] : cream[50],
							transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) }],
						},
					]}
				>
					<Pressable
						onPress={() => { close(); openScreen("about"); }}
						style={({ pressed }) => [
							styles.header,
							{ paddingTop: 56 + insets.top, backgroundColor: dark ? ink[900] : cream[50] },
							pressed && { opacity: 0.95 },
						]}
					>
						<LinearGradient
							pointerEvents="none"
							colors={["rgba(255, 213, 79, 0.20)", "rgba(255, 213, 79, 0.07)", "transparent"]}
							locations={[0, 0.45, 0.78]}
							style={StyleSheet.absoluteFill}
						/>
						<Svg viewBox="0 0 100 220" width={29} height={64} style={styles.logo}>
							<Path d="M30 10v85q0 40 20 40t20-40V10" fill="transparent" stroke="#bc8d31" strokeWidth={10} strokeLinecap="round" />
							<Path
								d="M50 135 C28 135, 20 165, 50 200 C80 165, 72 135, 50 135 Z"
								fill="#bc8d31"
								stroke="#bc8d31"
								strokeWidth={4}
								strokeLinecap="round"
							/>
						</Svg>
						<Text style={[styles.title, isHindi ? styles.titleHi : null]}>{isHindi ? "श्री चैतन्य" : "Shree Chaitanya"}</Text>
						<View style={styles.titleRule} />
						<Text style={[styles.subtitle, isHindi ? styles.subtitleHi : null]}>
							{isHindi ? "प्रेम भक्ति संघ" : "PREM BHAKTI SANGH"}
						</Text>
					</Pressable>

					<Pressable
						accessibilityLabel="Close menu"
						onPress={close}
						hitSlop={8}
						style={[styles.close, { top: 40 + insets.top }]}
					>
						<X size={24} color={goldA(0.7)} />
					</Pressable>

					<SideScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: dark ? ink[900] : cream[50] }} contentContainerStyle={styles.items}>
						<MenuItem theme={theme} icon={Bell} iconColor="#3b82f6" label={t.information} badge={hasNewInformation} onPress={() => { close(); openScreen("information"); }} />
						<MenuItem theme={theme} icon={Heart} iconColor={iconColor} label={t.donate} onPress={() => { close(); openScreen("donate"); }} />
						<MenuItem theme={theme} icon={Clock} iconColor="#a855f7" label={t.templeTimings} onPress={() => { close(); openScreen("temple-timings"); }} />
						<MenuItem
							theme={theme}
							icon={Download}
							iconColor={iconColor}
							label={t.downloads}
							onPress={() => {
								close();
								navigation.navigate("Tabs", { screen: "Downloads" });
							}}
						/>
						<Divider />
						<MenuItem
							theme={theme}
							icon={RefreshCcw}
							iconColor={dark ? "#22c55e" : "#16a34a"}
							label={t.checkUpdates}
							onPress={() => {
								close();
								Linking.openURL(PLAY_STORE).catch(() => {});
							}}
						/>
						<MenuItem theme={theme} icon={Share2} iconColor={iconColor} label={t.share} onPress={share} />
						<MenuItem theme={theme} icon={Info} iconColor={iconColor} label={t.about} onPress={() => { close(); openScreen("about"); }} />
						<MenuItem theme={theme} icon={ShieldCheck} iconColor={iconColor} label={t.privacy} onPress={() => { close(); openScreen("privacy"); }} />
						<MenuItem theme={theme} icon={CircleHelp} iconColor={iconColor} label={t.howToUse} onPress={() => setShowHelp(true)} />
						<Divider />
						<MenuItem
							theme={theme}
							icon={MessageCircle}
							iconColor={iconColor}
							label={t.feedback}
							subtext={t.feedbackSub}
							onPress={() => setShowFeedback(true)}
						/>
					</SideScrollView>

					<View style={[styles.footer, { paddingBottom: 16 + insets.bottom, backgroundColor: dark ? ink[900] : cream[50] }]}>
						<Text style={styles.version}>v{Constants.expoConfig?.version ?? ""}</Text>
					</View>
				</Animated.View>

				<HelpDialog
					visible={showHelp}
					theme={theme}
					t={t}
					onClose={() => setShowHelp(false)}
					onIntro={() => {
						setShowHelp(false);
						openWeb({ onboarding: true });
					}}
					onVideo={() => Linking.openURL(youtubeLink).catch(() => {})}
				/>
				<FeedbackDialog visible={showFeedback} onClose={() => setShowFeedback(false)} />
			</Modal>
		</>
	);
}

function MenuItem({
	theme,
	icon: Icon,
	iconColor,
	label,
	subtext,
	onPress,
	badge,
}: {
	theme: AppTheme;
	icon: LucideIcon;
	iconColor: string;
	label: string;
	subtext?: string;
	onPress: () => void;
	badge?: boolean;
}) {
	const dark = theme.isDark;
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.item,
				pressed && { backgroundColor: dark ? ink[800] : krishna[50], borderColor: dark ? "transparent" : krishna[200] },
			]}
		>
			{({ pressed }) => (
				<>
					<View
						style={[
							styles.itemIcon,
							{ backgroundColor: pressed ? (dark ? ink[700] : krishna[100]) : dark ? ink[800] : krishna[50] },
						]}
					>
						<Icon size={20} color={iconColor} />
						{badge && (
							<View style={styles.badgeContainer}>
								<View style={styles.badgeDot} />
								<Sparkles size={14} color="#ef4444" fill={RY_GOLD} style={styles.badgeSparkle} />
							</View>
						)}
					</View>
					<View style={styles.flexShrink}>
						<Text style={[styles.itemLabel, { color: dark ? cream[50] : ink[900] }]} numberOfLines={1}>
							{label}
						</Text>
						{subtext ? (
							<Text style={[styles.itemSub, { color: dark ? ink[400] : ink[500] }]} numberOfLines={1}>
								{subtext}
							</Text>
						) : null}
					</View>
				</>
			)}
		</Pressable>
	);
}

function Divider() {
	return <View style={styles.divider} />;
}

/** The "How to use App" popup (App Tour comes back with the tour). */
function HelpDialog({
	visible,
	theme,
	t,
	onClose,
	onIntro,
	onVideo,
}: {
	visible: boolean;
	theme: AppTheme;
	t: (typeof T)["en"];
	onClose: () => void;
	onIntro: () => void;
	onVideo: () => void;
}) {
	const dark = theme.isDark;
	const option = (icon: ReactNode, bg: string, title: string, desc: string, onPress: () => void, red = false) => (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.helpOption,
				{
					backgroundColor: dark ? "rgba(22, 48, 92, 0.5)" : "#fff",
					borderColor: pressed ? (red ? "#f87171" : goldA(0.6)) : goldA(0.2),
				},
				pressed && styles.pressed,
			]}
		>
			<View style={[styles.helpIcon, { backgroundColor: bg }]}>{icon}</View>
			<View style={styles.flexShrink}>
				<Text style={[styles.helpTitle, { color: dark ? ink[200] : ink[700] }]}>{title}</Text>
				<Text style={[styles.helpDesc, { color: dark ? ink[400] : ink[500] }]}>{desc}</Text>
			</View>
		</Pressable>
	);
	return (
		<Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
			<View style={styles.center}>
				<Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
				<View style={[styles.help, { backgroundColor: dark ? ink[800] : cream[50], borderColor: goldA(0.2) }]}>
					<Pressable hitSlop={8} onPress={onClose} style={styles.helpClose}>
						<X size={20} color={ink[400]} />
					</Pressable>
					<Text style={styles.helpHeading}>{t.howToUse}</Text>
					<View style={styles.helpList}>
						{option(<Smartphone size={24} color={RY_GOLD} />, goldA(0.1), t.introSlides, t.introSlidesDesc, onIntro)}
						{option(
							<Play size={24} color="#ef4444" style={{ marginLeft: 4 }} />,
							dark ? "rgba(127, 29, 29, 0.3)" : "#fef2f2",
							t.watchVideo,
							t.videoDesc,
							onVideo,
							true,
						)}
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flexShrink: { flexShrink: 1 },
	pressed: { transform: [{ scale: 0.95 }] },
	backdrop: { backgroundColor: "rgba(0, 0, 0, 0.6)" },
	drawer: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: 0,
		elevation: 24,
		shadowColor: "#000",
		shadowOpacity: 0.25,
		shadowRadius: 25,
		shadowOffset: { width: 0, height: 25 },
	},
	header: {
		height: 224,
		justifyContent: "flex-end",
		padding: 24,
		borderBottomWidth: 1.5,
		borderBottomColor: goldA(0.4),
		overflow: "hidden",
	},
	logo: { marginBottom: 12 },
	title: { color: RY_GOLD, fontFamily: serif, fontWeight: "600", fontSize: 24, lineHeight: 26, letterSpacing: 0.6 },
	titleHi: { marginTop: 8, letterSpacing: 0, lineHeight: 32 },
	titleRule: { width: "100%", maxWidth: 180, height: 1.5, backgroundColor: "rgba(212, 160, 23, 0.8)", marginVertical: 8 },
	subtitle: { color: RY_GOLD, fontWeight: "600", fontSize: 10.4, letterSpacing: 2.6 },
	subtitleHi: { fontSize: 14.4, letterSpacing: 0 },
	close: { position: "absolute", right: 16, padding: 8, borderRadius: 999, zIndex: 20 },
	items: { padding: 16, gap: 4 },
	item: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		padding: 12,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "transparent",
	},
	itemIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
	badgeContainer: { position: "absolute", top: -4, right: -4, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
	badgeDot: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "#ef4444" },
	badgeSparkle: { zIndex: 1 },
	itemLabel: { fontSize: 16, fontWeight: "700" },
	itemSub: { fontSize: 12, fontWeight: "500" },
	divider: { height: 1, backgroundColor: goldA(0.2), marginVertical: 8, marginHorizontal: 8 },
	footer: { padding: 16, alignItems: "center", borderTopWidth: 1, borderTopColor: goldA(0.2) },
	version: { fontSize: 12, fontWeight: "500", color: goldA(0.5) },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
	help: { width: "100%", maxWidth: 320, borderRadius: 16, borderWidth: 1, padding: 24, elevation: 16 },
	helpClose: { position: "absolute", top: 16, right: 16, padding: 4, zIndex: 1 },
	helpHeading: { fontSize: 20, fontWeight: "700", color: RY_GOLD, textAlign: "center", marginBottom: 24 },
	helpList: { gap: 16 },
	helpOption: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: 12, borderWidth: 1, elevation: 1 },
	helpIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
	helpTitle: { fontSize: 16, fontWeight: "700" },
	helpDesc: { fontSize: 12 },
});

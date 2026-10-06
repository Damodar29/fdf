import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
	Check,
	ChevronRight,
	Clock,
	HardDrive,
	Info,
	Languages,
	Layout,
	type LucideIcon,
	MessageCircle,
	Monitor,
	Moon,
	Palette,
	ShieldCheck,
	Smartphone,
	Sun,
	Trash2,
	X,
} from "lucide-react-native";
import { type ReactNode, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CrossPattern } from "../components/AudioListParts";
import { BackupRestoreSection } from "../components/BackupRestoreSection";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { RangeSlider } from "../components/RangeSlider";
import { SideScrollView } from "../components/SideScrollView";
import { triggerHaptic } from "../lib/haptics";
import { applyUiScale } from "../lib/uiScale";
import type { RootNavigation } from "../navigation/types";
import { clearContentCache } from "../store/contentStore";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import { cream, gold, ink, janmashtami, krishna, serif } from "../theme/colors";
import { THEME_PALETTES } from "../theme/palettes";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import type { ThemeColor, ThemeMode } from "../types";
import { clearRecentSearches } from "../utils/recentSearches";

// Native rebuild of components/SettingsScreen.tsx: the saffron header, then
// five cards (Display, Content & Language, Interface Layout, System &
// Support, Storage) and the Developer Mode button, with the same info
// popups, colour-theme sheet, WhatsApp feedback dialog and clear-cache sheet.
//
// Not here yet, because what they open doesn't exist natively yet:
//  - the Mandal Admin card (needs the profile's role; later);
//  - "Replay guided tour" (the tour isn't ported);

/** `ry-gold`: the Janmashtami deep gold. */
const RY_GOLD = janmashtami.deepGold;
const goldA = (a: number) => `rgba(212, 160, 23, ${a})`;
const ORANGE_500 = "#f97316";
const RED_500 = "#ef4444";

const T = {
	en: {
		title: "Settings",
		sectionDisplay: "Display & Text",
		descDisplay: "Adjust text size and app theme (Light/Dark mode).",
		sectionContent: "Content & Language",
		descContent: "Choose App language and Bhajan script (Hindi/English).",
		sectionInterface: "Interface Layout",
		descInterface: "Customize layout for left/right handed use.",
		sectionSystem: "System & Support",
		descSystem: "Screen wake lock and support options.",
		sectionStorage: "Storage & Maintenance",
		descStorage: "Manage app data and cache.",
		uiScale: "App UI Size",
		theme: "App Theme",
		themeAuto: "Auto",
		themeLight: "Light",
		themeDark: "Dark",
		moreThemes: "Color Themes",
		scrollBarPos: "Scrollbar",
		left: "Left",
		right: "Right",
		bhajanLang: "Bhajan Script",
		appLang: "App Language",
		keepAwake: "Keep Screen Awake",
		keepAwakeDesc: "Prevents screen from turning off while reading",
		feedback: "Send Feedback",
		feedbackDesc: "Contact us on WhatsApp",
		clearCache: "Clear App Cache",
		clearCacheDesc: "Fix issues by resetting local data",
		devOptions: "Developer Mode",
		devEnabled: "Active (Tap 3x to Disable)",
		devDisabled: "Inactive",
		systemHaptics: "Vibrations",
		systemHapticsDesc: "Vibration on interactions",
		cancel: "Cancel",
		close: "Close",
		infoDisplay:
			"Adjust text size, spacing, and app appearance.\nChoose Light, Dark, or Auto mode for reading.",
		infoContent: "Select App Language and Bhajan Script.\nChoose between Hindi or English script.",
		infoInterface:
			"Customize controls for left/right-hand usage.\nMove scrollbars and sliders to preferred side.",
		infoSystem:
			"Keep screen awake while reading.\nEnable haptic feedback for vibration on interactions.\nContact us directly on WhatsApp for help.",
		infoStorage: "Manage app storage and cache.\nClear local data to fix loading issues.",
		infoHaptics:
			"When Haptics are enabled, your phone will lightly vibrate when you press buttons or change pages. This improves the app experience.",
		clearTitle: "Clear Cache",
		clearSub: "Choose what to clear",
	},
	hi: {
		title: "सेटिंग्स",
		sectionDisplay: "दिखावट और अक्षर",
		descDisplay: "अक्षर का आकार और ऐप का थीम (लाइट/डार्क) बदलें।",
		sectionContent: "भाषा और सामग्री",
		descContent: "ऐप की भाषा और भजन की लिपि (हिंदी/अंग्रेजी) चुनें।",
		sectionInterface: "इंटरफ़ेस लेआउट",
		descInterface: "बाएं/दाएं हाथ के उपयोग के लिए लेआउट बदलें।",
		sectionSystem: "सिस्टम और सहायता",
		descSystem: "स्क्रीन ऑन रखने और सहायता के विकल्प।",
		sectionStorage: "स्टोरेज और रखरखाव",
		descStorage: "ऐप डेटा और कैश प्रबंधित करें।",
		uiScale: "ऐप का आकार",
		theme: "ऐप का थीम",
		themeAuto: "ऑटो",
		themeLight: "लाइट",
		themeDark: "डार्क",
		moreThemes: "रंग थीम",
		scrollBarPos: "स्क्रोलबार",
		left: "बायाँ",
		right: "दायाँ",
		bhajanLang: "भजन की लिपि",
		appLang: "ऐप की भाषा",
		keepAwake: "स्क्रीन को जगाए रखें",
		keepAwakeDesc: "पढ़ते समय स्क्रीन बंद नहीं होगी",
		feedback: "सुझाव भेजें",
		feedbackDesc: "व्हाट्सएप पर संपर्क करें",
		clearCache: "ऐप कैश मिटाएं",
		clearCacheDesc: "डेटा रीसेट करके समस्याएं ठीक करें",
		devOptions: "डेवलपर मोड",
		devEnabled: "सक्रिय (बंद करने के लिए 3 बार टैप करें)",
		devDisabled: "निष्क्रिय",
		systemHaptics: "कंपन",
		systemHapticsDesc: "स्पर्श करने पर कंपन",
		cancel: "रद्द करें",
		close: "बंद करें",
		infoDisplay:
			"अक्षर का आकार, अंतराल और ऐप का रंग-रूप बदलें।\nपढ़ने के लिए आरामदायक लाइट, डार्क या ऑटो मोड चुनें।",
		infoContent:
			"ऐप की भाषा और भजन की लिपि (हिंदी/अंग्रेजी) चुनें।\nभजन पढ़ने के लिए अपनी पसंदीदा लिपि सेट करें।",
		infoInterface:
			"बाएं/दाएं हाथ के उपयोग के लिए लेआउट बदलें।\nकंट्रोल और स्क्रोलबार की दिशा अपनी सुविधानुसार सेट करें।",
		infoSystem:
			"पढ़ते समय स्क्रीन को बंद होने से रोकें।\nबटन दबाने पर कंपन के लिए हैप्टिक्स चालू करें।\nकिसी भी समस्या या सहायता के लिए सीधे व्हाट्सएप पर संपर्क करें।",
		infoStorage: "ऐप डेटा और कैश प्रबंधित करें।\nलोडिंग समस्याओं को ठीक करने के लिए डेटा साफ़ करें।",
		infoHaptics:
			"हैप्टिक्स चालू रहने से जब भी आप कोई बटन दबाएंगे या पेज बदलेंगे, तो आपका फोन हल्का सा कंपन करेगा। इससे ऐप इस्तेमाल करने का अनुभव बेहतर होता है।",
		clearTitle: "कैश साफ करें",
		clearSub: "क्या साफ करना है चुनें",
	},
};
type Strings = (typeof T)["en"];

// The colour-theme sheet's list and labels, in SettingsScreen's order.
const THEME_COLORS: { key: ThemeColor; label: string }[] = [
	{ key: "deepBlue", label: "Deep Blue" },
	{ key: "lime", label: "Lime" },
	{ key: "emerald", label: "Emerald" },
	{ key: "teal", label: "Teal" },
	{ key: "cyan", label: "Cyan" },
	{ key: "sky", label: "Sky" },
	{ key: "blue", label: "Ocean" },
	{ key: "indigo", label: "Indigo" },
	{ key: "violet", label: "Violet" },
	{ key: "purple", label: "Royal" },
	{ key: "fuchsia", label: "Fuchsia" },
	{ key: "pink", label: "Pink" },
	{ key: "rose", label: "Rose" },
];

// The clear-cache options shown on Android (the web-only Service Worker
// option is filtered out there, as in the Capacitor app). Wording is English
// only in the original too.
type CacheId = "appPrefs" | "contentCache" | "miscCache";
const CACHE_OPTIONS: { id: CacheId; label: string; desc: string; icon: string }[] = [
	{
		id: "appPrefs",
		label: "App Preferences Cache",
		desc: "Resets theme, language, font size and other display settings",
		icon: "⚙️",
	},
	{
		id: "contentCache",
		label: "Content Sync Cache",
		desc: "Clears local bhajans/books/lectures data — re-synced from server on next open",
		icon: "🔄",
	},
	{ id: "miscCache", label: "Misc App Cache", desc: "Quote popup date, recent searches, file size cache", icon: "📦" },
];
const SAFE_DEFAULT_IDS: CacheId[] = ["appPrefs", "contentCache", "miscCache"];

interface Props {
	onBack: () => void;
}

export function SettingsScreen({ onBack }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const navigation = useNavigation<RootNavigation>();
	const s = useSettingsStore();
	const t = T[s.settingsLanguage];
	const dark = theme.isDark;
	const [infoPopup, setInfoPopup] = useState<{ title: string; description: string } | null>(null);
	const [showThemeModal, setShowThemeModal] = useState(false);
	const [showFeedback, setShowFeedback] = useState(false);
	const [showCacheModal, setShowCacheModal] = useState(false);
	// Not persisted, as in SettingsContext.
	const [devMode, setDevMode] = useState(false);
	const clickCount = useRef(0);
	const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const info = (title: string, description: string) => () => setInfoPopup({ title, description });

	// Three taps within a second toggle Developer Mode (handleSecretClick).
	const handleSecretClick = () => {
		if (clickTimer.current) clearTimeout(clickTimer.current);
		clickCount.current += 1;
		clickTimer.current = setTimeout(() => {
			clickCount.current = 0;
		}, 1000);
		if (clickCount.current < 3) return;
		clickCount.current = 0;
		if (devMode) {
			setDevMode(false);
			showToast(s.settingsLanguage === "en" ? "Developer Mode Disabled" : "डेवलपर मोड अक्षम किया गया");
		} else {
			// Developer login and the admin panel are the OG web screens: open the
			// web Settings and give its Developer Mode button the same triple tap.
			navigation.navigate("Web", {
				target: {
					click: '[data-tour="header-settings"]',
					afterOpen: { textStartsWith: ["Developer Mode:", "डेवलपर मोड:"], times: 3 },
				},
			});
		}
	};

	const labelColor = dark ? ink[300] : ink[600];
	const segmentedThemes: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
		{ value: "auto", label: t.themeAuto, icon: Clock },
		{ value: "light", label: t.themeLight, icon: Sun },
		{ value: "dark", label: t.themeDark, icon: Moon },
	];

	return (
		<View style={[styles.flex, { backgroundColor: dark ? ink[900] : cream[50] }]}>
			<CrossPattern />

			<LinearGradient
				colors={[theme.p[500], ORANGE_500]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.header, { paddingTop: insets.top + 16 }]}
			>
				<Pressable accessibilityLabel={t.close} onPress={onBack} style={({ pressed }) => [styles.headerClose, pressed && styles.pressed]}>
					<X size={24} color={cream[50]} />
				</Pressable>
				<Text style={styles.headerTitle}>{t.title}</Text>
			</LinearGradient>

			<SideScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
				{/* Card 1: Display & Appearance */}
				<SectionCard
					theme={theme}
					title={t.sectionDisplay}
					icon={Monitor}
					description={t.descDisplay}
					onInfo={info(t.sectionDisplay, t.infoDisplay)}
				>
					<View style={styles.mb24}>
						<View style={styles.scaleHead}>
							<Text style={[styles.label, { color: labelColor }]}>{t.uiScale}</Text>
							<Text style={[styles.scaleBadge, { backgroundColor: dark ? ink[700] : goldA(0.1) }]}>
								{Math.round(s.uiScale * 100)}%
							</Text>
						</View>
						<View style={styles.scaleRow}>
							<Text style={[styles.scaleSmall, { color: ink[400] }]}>A</Text>
							<View style={styles.flex}>
								<RangeSlider
									value={s.uiScale}
									min={0.85}
									max={1.15}
									step={0.05}
									onChange={s.setUiScale}
									onSlidingChange={(sliding) => {
										if (!sliding) applyUiScale(useSettingsStore.getState().uiScale);
									}}
									accent={RY_GOLD}
									track={dark ? ink[700] : goldA(0.2)}
								/>
							</View>
							<Text style={[styles.scaleLarge, { color: labelColor }]}>A</Text>
						</View>
					</View>

					<Text style={[styles.label, styles.fieldLabel, { color: labelColor }]}>{t.theme}</Text>
					<Segmented theme={theme} gap>
						{segmentedThemes.map((m) => (
							<SegmentedButton
								key={m.value}
								theme={theme}
								active={s.themeMode === m.value}
								onPress={() => s.setThemeMode(m.value)}
								label={m.label}
								icon={m.icon}
							/>
						))}
					</Segmented>

					<Pressable
						onPress={() => setShowThemeModal(true)}
						style={({ pressed }) => [
							styles.colorsButton,
							{
								backgroundColor: pressed ? (dark ? ink[700] : goldA(0.05)) : dark ? ink[800] : "#fff",
								borderColor: goldA(0.3),
							},
						]}
					>
						<View style={styles.rowGap12}>
							<View style={[styles.paletteDot, { backgroundColor: THEME_PALETTES[s.themeColor]?.[500] ?? THEME_PALETTES.saffron[500] }]}>
								<Palette size={16} color="#fff" />
							</View>
							<Text style={[styles.colorsLabel, { color: dark ? ink[200] : ink[700] }]}>{t.moreThemes}</Text>
						</View>
						<View style={styles.rowGap8}>
							<View style={styles.rowGap4}>
								{THEME_COLORS.slice(0, 3).map((tc) => (
									<View key={tc.key} style={[styles.miniDot, { backgroundColor: THEME_PALETTES[tc.key][500] }]} />
								))}
							</View>
							<ChevronRight size={16} color={ink[400]} />
						</View>
					</Pressable>
				</SectionCard>

				{/* Card 2: Content & Language */}
				<SectionCard
					theme={theme}
					title={t.sectionContent}
					icon={Languages}
					description={t.descContent}
					onInfo={info(t.sectionContent, t.infoContent)}
				>
					<View style={styles.mb20}>
						<Text style={[styles.label, styles.fieldLabel, { color: labelColor }]}>{t.appLang}</Text>
						<Segmented theme={theme}>
							<SegmentedButton theme={theme} active={s.settingsLanguage === "hi"} onPress={() => s.setSettingsLanguage("hi")} label="हिन्दी" />
							<SegmentedButton theme={theme} active={s.settingsLanguage === "en"} onPress={() => s.setSettingsLanguage("en")} label="English" />
						</Segmented>
					</View>
					<Text style={[styles.label, styles.fieldLabel, { color: labelColor }]}>{t.bhajanLang}</Text>
					<Segmented theme={theme}>
						<SegmentedButton theme={theme} active={s.script === "devanagari"} onPress={() => s.setScript("devanagari")} label="हिन्दी" />
						<SegmentedButton theme={theme} active={s.script === "iast"} onPress={() => s.setScript("iast")} label="English" />
					</Segmented>
				</SectionCard>

				{/* Card 3: Interface Layout */}
				<SectionCard
					theme={theme}
					title={t.sectionInterface}
					icon={Layout}
					description={t.descInterface}
					onInfo={info(t.sectionInterface, t.infoInterface)}
				>
					<View style={styles.mb20}>
						<Text style={[styles.label, styles.fieldLabel, { color: labelColor }]}>
							{s.indexMode === "latin" ? "A-Z Slider" : "अ-ज्ञ Slider"}
						</Text>
						<Segmented theme={theme}>
							<SegmentedButton theme={theme} active={s.azSliderSide === "left"} onPress={() => s.setAzSliderSide("left")} label={t.left} />
							<SegmentedButton theme={theme} active={s.azSliderSide === "right"} onPress={() => s.setAzSliderSide("right")} label={t.right} />
						</Segmented>
					</View>
					<Text style={[styles.label, styles.fieldLabel, { color: labelColor }]}>{t.scrollBarPos}</Text>
					<Segmented theme={theme}>
						<SegmentedButton theme={theme} active={s.scrollBarSide === "left"} onPress={() => s.setScrollBarSide("left")} label={t.left} />
						<SegmentedButton theme={theme} active={s.scrollBarSide === "right"} onPress={() => s.setScrollBarSide("right")} label={t.right} />
					</Segmented>
				</SectionCard>

				{/* Card 4: System & Support */}
				<SectionCard
					theme={theme}
					title={t.sectionSystem}
					icon={Smartphone}
					description={t.descSystem}
					onInfo={info(t.sectionSystem, t.infoSystem)}
				>
					<ActionRow
						theme={theme}
						icon={Smartphone}
						label={t.keepAwake}
						desc={t.keepAwakeDesc}
						action={<Toggle theme={theme} value={s.keepAwake} onChange={s.setKeepAwake} />}
					/>
					<Divider theme={theme} />
					<ActionRow
						theme={theme}
						icon={Smartphone}
						label={t.systemHaptics}
						desc={t.systemHapticsDesc}
						onInfo={info(t.systemHaptics, t.infoHaptics)}
						action={
							<Toggle
								theme={theme}
								value={s.hapticsEnabled}
								onChange={(v) => {
									s.setHapticsEnabled(v);
									if (v) triggerHaptic("medium", true);
								}}
							/>
						}
					/>
					<Divider theme={theme} />
					<ActionRow
						theme={theme}
						icon={MessageCircle}
						label={t.feedback}
						desc={t.feedbackDesc}
						onPress={() => setShowFeedback(true)}
						showChevron
					/>
				</SectionCard>

				{/* Card 5: Storage & Maintenance */}
				<SectionCard
					theme={theme}
					title={t.sectionStorage}
					icon={HardDrive}
					description={t.descStorage}
					onInfo={info(t.sectionStorage, t.infoStorage)}
				>
					<View style={styles.pb8}>
						<BackupRestoreSection />
					</View>
					<View style={[styles.storageFoot, { borderTopColor: dark ? ink[700] : goldA(0.1) }]}>
						<ActionRow
							theme={theme}
							icon={Trash2}
							iconColor={RED_500}
							label={t.clearCache}
							labelColor={dark ? "#f87171" : "#dc2626"}
							desc={t.clearCacheDesc}
							onPress={() => setShowCacheModal(true)}
						/>
					</View>
				</SectionCard>

				{/* Developer Options (entry only) */}
				<View style={styles.pt16}>
					<Pressable
						onPress={handleSecretClick}
						style={[styles.devButton, { backgroundColor: devMode ? "#16a34a" : RY_GOLD }]}
					>
						<Text style={styles.devText}>
							{t.devOptions}: {devMode ? t.devEnabled : t.devDisabled}
						</Text>
					</Pressable>
				</View>
			</SideScrollView>

			<ThemeColorSheet
				visible={showThemeModal}
				theme={theme}
				t={t}
				current={s.themeColor}
				onSelect={(c) => {
					s.setThemeColor(c);
					setShowThemeModal(false);
				}}
				onClose={() => setShowThemeModal(false)}
			/>
			<InfoPopup popup={infoPopup} theme={theme} t={t} onClose={() => setInfoPopup(null)} />
			<FeedbackDialog visible={showFeedback} onClose={() => setShowFeedback(false)} />
			<ClearCacheSheet
				visible={showCacheModal}
				theme={theme}
				t={t}
				bottomInset={insets.bottom}
				onClose={() => setShowCacheModal(false)}
			/>
		</View>
	);
}

/* ─────────────────────────── Building blocks ─────────────────────────── */

function SectionCard({
	theme,
	title,
	icon: Icon,
	description,
	onInfo,
	children,
}: {
	theme: AppTheme;
	title: string;
	icon: LucideIcon;
	description: string;
	onInfo: () => void;
	children: ReactNode;
}) {
	const dark = theme.isDark;
	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: dark ? ink[800] : cream[50], borderColor: dark ? ink[700] : goldA(0.3) },
			]}
		>
			<View style={[styles.cardHead, { borderBottomColor: goldA(0.1) }]}>
				<View style={styles.rowGap12}>
					<View
						style={[
							styles.cardIcon,
							{ backgroundColor: dark ? ink[800] : krishna[50], borderColor: dark ? ink[700] : krishna[200] },
						]}
					>
						<Icon size={20} color={RY_GOLD} />
					</View>
					<Text style={[styles.cardTitle, { color: dark ? cream[50] : krishna[700] }]}>{title}</Text>
				</View>
				<Pressable hitSlop={6} onPress={onInfo} style={({ pressed }) => [styles.infoButton, pressed && { backgroundColor: goldA(0.1) }]}>
					<Info size={18} color={ink[400]} />
				</Pressable>
			</View>
			<View style={styles.pl4}>
				<Text style={[styles.cardDesc, { color: dark ? ink[400] : ink[500] }]}>{description}</Text>
				<View style={styles.pl4}>{children}</View>
			</View>
		</View>
	);
}

function Segmented({ theme, gap, children }: { theme: AppTheme; gap?: boolean; children: ReactNode }) {
	return (
		<View
			style={[
				styles.segmented,
				gap && styles.rowGap4,
				{ backgroundColor: theme.isDark ? "rgba(7, 21, 41, 0.5)" : goldA(0.05), borderColor: goldA(0.2) },
			]}
		>
			{children}
		</View>
	);
}

function SegmentedButton({
	theme,
	active,
	onPress,
	label,
	icon: Icon,
}: {
	theme: AppTheme;
	active: boolean;
	onPress: () => void;
	label: string;
	icon?: LucideIcon;
}) {
	const dark = theme.isDark;
	const color = active ? (dark ? gold[300] : krishna[700]) : dark ? ink[400] : ink[500];
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			onPress={onPress}
			style={[
				styles.segment,
				active
					? [
							styles.segmentActive,
							{ backgroundColor: dark ? ink[700] : krishna[50], borderColor: dark ? ink[600] : krishna[200] },
						]
					: null,
			]}
		>
			{Icon ? <Icon size={16} color={color} /> : null}
			<Text style={[styles.segmentText, { color }]}>{label}</Text>
		</Pressable>
	);
}

function Toggle({ theme, value, onChange }: { theme: AppTheme; value: boolean; onChange: (v: boolean) => void }) {
	return (
		<Pressable
			accessibilityRole="switch"
			accessibilityState={{ checked: value }}
			onPress={() => onChange(!value)}
			style={[styles.toggle, { backgroundColor: value ? RY_GOLD : theme.isDark ? ink[600] : ink[200] }]}
		>
			<View style={[styles.knob, { left: value ? 24 : 4 }]} />
		</Pressable>
	);
}

function ActionRow({
	theme,
	icon: Icon,
	iconColor = RY_GOLD,
	label,
	labelColor,
	desc,
	action,
	onPress,
	onInfo,
	showChevron,
}: {
	theme: AppTheme;
	icon: LucideIcon;
	iconColor?: string;
	label: string;
	labelColor?: string;
	desc?: string;
	action?: ReactNode;
	onPress?: () => void;
	onInfo?: () => void;
	showChevron?: boolean;
}) {
	const dark = theme.isDark;
	return (
		<Pressable
			disabled={!onPress}
			onPress={onPress}
			style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: dark ? ink[700] : krishna[100] }]}
		>
			<View style={[styles.rowGap16, styles.flex]}>
				<View
					style={[
						styles.actionIcon,
						{ backgroundColor: dark ? ink[800] : krishna[50], borderColor: dark ? ink[700] : krishna[100] },
					]}
				>
					<Icon size={20} color={iconColor} />
				</View>
				<View style={styles.flex}>
					<View style={styles.rowGap8}>
						<Text style={[styles.actionLabel, { color: labelColor ?? (dark ? cream[50] : ink[900]) }]}>{label}</Text>
						{onInfo ? (
							<Pressable hitSlop={8} onPress={onInfo} style={styles.p4}>
								<Info size={14} color={ink[400]} />
							</Pressable>
						) : null}
					</View>
					{desc ? <Text style={[styles.actionDesc, { color: dark ? ink[500] : ink[400] }]}>{desc}</Text> : null}
				</View>
			</View>
			{action}
			{showChevron ? <ChevronRight size={18} color={ink[300]} /> : null}
		</Pressable>
	);
}

function Divider({ theme }: { theme: AppTheme }) {
	return <View style={[styles.divider, { backgroundColor: theme.isDark ? ink[700] : goldA(0.1) }]} />;
}

/* ─────────────────────────── Sheets and dialogs ─────────────────────────── */

function Backdrop({ onPress }: { onPress: () => void }) {
	return <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onPress} />;
}

function ThemeColorSheet({
	visible,
	theme,
	t,
	current,
	onSelect,
	onClose,
}: {
	visible: boolean;
	theme: AppTheme;
	t: Strings;
	current: ThemeColor;
	onSelect: (c: ThemeColor) => void;
	onClose: () => void;
}) {
	const dark = theme.isDark;
	const insets = useSafeAreaInsets();
	return (
		<Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
			<View style={styles.sheetWrap}>
				<Backdrop onPress={onClose} />
				<View
					style={[
						styles.themeSheet,
						{ backgroundColor: dark ? ink[900] : cream[50], borderColor: goldA(0.3), paddingBottom: 24 + insets.bottom },
					]}
				>
					<View style={styles.sheetHead}>
						<Text style={[styles.sheetTitle, { color: dark ? "#fff" : RY_GOLD }]}>{t.moreThemes}</Text>
						<Pressable onPress={onClose} style={[styles.roundClose, { backgroundColor: dark ? ink[800] : goldA(0.1) }]}>
							<X size={20} color={RY_GOLD} />
						</Pressable>
					</View>
					<ScrollView style={styles.flexShrink} showsVerticalScrollIndicator={false}>
						<View style={styles.colorGrid}>
							{THEME_COLORS.map((tc) => {
								const selected = tc.key === current;
								return (
									<Pressable
										key={tc.key}
										onPress={() => onSelect(tc.key)}
										style={[
											styles.colorCell,
											selected
												? { backgroundColor: dark ? ink[800] : goldA(0.1), borderColor: RY_GOLD }
												: { borderColor: "transparent" },
										]}
									>
										<View style={[styles.colorCircle, { backgroundColor: THEME_PALETTES[tc.key][500] }]}>
											{selected ? <View style={styles.colorSelectedDot} /> : null}
										</View>
										<Text style={[styles.colorLabel, { color: dark ? ink[300] : ink[600] }]}>{tc.label}</Text>
									</Pressable>
								);
							})}
						</View>
					</ScrollView>
					<View style={[styles.sheetFoot, { borderTopColor: goldA(0.2) }]}>
						<Pressable onPress={onClose} style={({ pressed }) => [styles.goldButton, pressed && styles.pressed]}>
							<Text style={styles.goldButtonText}>{t.cancel}</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function InfoPopup({
	popup,
	theme,
	t,
	onClose,
}: {
	popup: { title: string; description: string } | null;
	theme: AppTheme;
	t: Strings;
	onClose: () => void;
}) {
	const dark = theme.isDark;
	return (
		<Modal visible={!!popup} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
			<View style={styles.centerWrap}>
				<Backdrop onPress={onClose} />
				<View style={[styles.dialog, { backgroundColor: dark ? ink[800] : cream[50], borderColor: goldA(0.3) }]}>
					<Pressable onPress={onClose} style={[styles.dialogClose, { backgroundColor: dark ? ink[700] : "#fff" }]}>
						<X size={18} color={ink[400]} />
					</Pressable>
					<View style={styles.dialogBody}>
						<View style={[styles.dialogIcon, { backgroundColor: dark ? ink[700] : goldA(0.1), borderColor: goldA(0.2) }]}>
							<Info size={28} color={RY_GOLD} />
						</View>
						<Text style={[styles.dialogTitle, { color: dark ? "#fff" : RY_GOLD }]}>{popup?.title}</Text>
						<Text
							style={[
								styles.dialogText,
								{
									color: dark ? ink[300] : ink[600],
									backgroundColor: dark ? "rgba(7, 21, 41, 0.5)" : "#fff",
									borderColor: goldA(0.2),
								},
							]}
						>
							{popup?.description}
						</Text>
						<Pressable onPress={onClose} style={({ pressed }) => [styles.goldButton, styles.mt24, pressed && styles.pressed]}>
							<Text style={styles.goldButtonText}>{t.close}</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function ClearCacheSheet({
	visible,
	theme,
	t,
	bottomInset,
	onClose,
}: {
	visible: boolean;
	theme: AppTheme;
	t: Strings;
	bottomInset: number;
	onClose: () => void;
}) {
	const dark = theme.isDark;
	const [selected, setSelected] = useState<Set<CacheId>>(() => new Set(SAFE_DEFAULT_IDS));
	const [clearing, setClearing] = useState(false);
	const allSelected = selected.size === CACHE_OPTIONS.length;

	const toggle = (id: CacheId) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	// executeClearCache. User data (history, playlists, downloads, bookmarks)
	// is never touched. Where the Capacitor app reloaded itself afterwards,
	// the stores here are reset in place.
	const clear = () => {
		if (selected.size === 0) return;
		setClearing(true);
		try {
			if (selected.has("appPrefs")) {
				useSettingsStore.getState().resetPreferences();
				applyUiScale(1);
			}
			if (selected.has("contentCache")) clearContentCache();
			if (selected.has("miscCache")) clearRecentSearches();
			onClose();
			showToast("✅ Cache cleared!", "success");
		} catch (e) {
			showToast(`Failed: ${e instanceof Error ? e.message : String(e)}`, "error");
		} finally {
			setClearing(false);
		}
	};

	return (
		<Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
			<View style={styles.sheetWrap}>
				<Backdrop onPress={onClose} />
				<View style={[styles.cacheSheet, { backgroundColor: dark ? ink[900] : cream[50], borderColor: goldA(0.2) }]}>
					<View style={[styles.cacheHead, { borderBottomColor: dark ? ink[800] : goldA(0.1) }]}>
						<View style={styles.rowGap12}>
							<View style={[styles.cacheHeadIcon, { backgroundColor: dark ? "rgba(127, 29, 29, 0.2)" : "#fef2f2" }]}>
								<Trash2 size={20} color={RED_500} />
							</View>
							<View>
								<Text style={[styles.cacheTitle, { color: dark ? "#fff" : ink[800] }]}>{t.clearTitle}</Text>
								<Text style={[styles.cacheSub, { color: dark ? ink[500] : ink[400] }]}>{t.clearSub}</Text>
							</View>
						</View>
						<Pressable onPress={onClose} style={[styles.roundClose, { backgroundColor: dark ? ink[800] : ink[100] }]}>
							<X size={18} color={dark ? ink[300] : ink[500]} />
						</Pressable>
					</View>

					<View style={styles.cachePad}>
						<View
							style={[
								styles.platform,
								{
									backgroundColor: dark ? "rgba(30, 58, 138, 0.2)" : "#eff6ff",
									borderColor: dark ? "rgba(30, 64, 175, 0.4)" : "#dbeafe",
								},
							]}
						>
							<Smartphone size={14} color="#3b82f6" />
							<Text style={[styles.platformText, { color: dark ? "#93c5fd" : "#1d4ed8" }]}>
								Platform: <Text style={styles.bold}>Android</Text> — Service Worker Cache not applicable
							</Text>
						</View>
					</View>

					<View style={[styles.cachePad, styles.cacheButtons]}>
						<Pressable onPress={() => setSelected(new Set(SAFE_DEFAULT_IDS))} style={styles.smallButton}>
							<ShieldCheck size={14} color={dark ? "#34d399" : "#059669"} />
							<Text style={[styles.smallButtonText, { color: dark ? "#34d399" : "#059669" }]}>Safe Defaults</Text>
						</Pressable>
						<Pressable
							onPress={() => setSelected(allSelected ? new Set() : new Set(CACHE_OPTIONS.map((o) => o.id)))}
							style={styles.smallButton}
						>
							<Text style={[styles.smallButtonText, { color: RY_GOLD }]}>{allSelected ? "Deselect All" : "Select All"}</Text>
						</Pressable>
					</View>

					<ScrollView style={styles.flexShrink} contentContainerStyle={styles.cacheOptions}>
						{CACHE_OPTIONS.map((opt) => {
							const checked = selected.has(opt.id);
							return (
								<Pressable
									key={opt.id}
									onPress={() => toggle(opt.id)}
									style={[
										styles.cacheOption,
										checked
											? {
													backgroundColor: dark ? "rgba(127, 29, 29, 0.1)" : "rgba(254, 242, 242, 0.6)",
													borderColor: dark ? "rgba(153, 27, 27, 0.4)" : "#fecaca",
												}
											: { backgroundColor: dark ? ink[800] : "#fff", borderColor: dark ? ink[700] : ink[200] },
									]}
								>
									<View
										style={[
											styles.checkbox,
											checked
												? { backgroundColor: RED_500, borderColor: RED_500 }
												: { borderColor: dark ? ink[600] : ink[300] },
										]}
									>
										{checked ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
									</View>
									<Text style={styles.cacheEmoji}>{opt.icon}</Text>
									<View style={styles.flex}>
										<Text style={[styles.cacheLabel, { color: dark ? ink[200] : ink[700] }]}>{opt.label}</Text>
										<Text style={[styles.cacheDesc, { color: dark ? ink[500] : ink[400] }]}>{opt.desc}</Text>
									</View>
								</Pressable>
							);
						})}
					</ScrollView>

					<View
						style={[
							styles.cacheFoot,
							{
								borderTopColor: dark ? ink[800] : goldA(0.1),
								backgroundColor: dark ? ink[900] : "#fff",
								paddingBottom: 20 + bottomInset,
							},
						]}
					>
						<Pressable
							onPress={clear}
							disabled={clearing || selected.size === 0}
							style={({ pressed }) => [
								styles.clearButton,
								{ backgroundColor: pressed ? "#dc2626" : RED_500 },
								(clearing || selected.size === 0) && styles.disabled,
							]}
						>
							{clearing ? <ActivityIndicator size="small" color="#fff" /> : <Trash2 size={18} color="#fff" />}
							<Text style={styles.clearButtonText}>
								{clearing ? "Clearing..." : `Clear ${selected.size} Item${selected.size !== 1 ? "s" : ""}`}
							</Text>
						</Pressable>
						<Pressable
							onPress={onClose}
							disabled={clearing}
							style={[styles.cancelButton, { backgroundColor: dark ? ink[800] : ink[100] }]}
						>
							<Text style={[styles.cancelText, { color: dark ? ink[300] : ink[500] }]}>Cancel</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	flexShrink: { flexShrink: 1 },
	pressed: { transform: [{ scale: 0.95 }] },
	disabled: { opacity: 0.5 },
	bold: { fontWeight: "700" },
	rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
	rowGap8: { flexDirection: "row", alignItems: "center", gap: 8 },
	rowGap12: { flexDirection: "row", alignItems: "center", gap: 12 },
	rowGap16: { flexDirection: "row", alignItems: "center", gap: 16 },
	gap12: { gap: 12 },
	mb20: { marginBottom: 20 },
	mb24: { marginBottom: 24 },
	mt24: { marginTop: 24 },
	pb8: { paddingBottom: 8 },
	pt16: { paddingTop: 16 },
	pl4: { paddingLeft: 4 },
	p4: { padding: 4 },

	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		padding: 16,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		borderBottomWidth: 2,
		borderBottomColor: goldA(0.4),
		elevation: 8,
		zIndex: 10,
	},
	headerClose: { padding: 8, borderRadius: 999 },
	headerTitle: { color: cream[50], fontFamily: serif, fontSize: 20, fontWeight: "600", letterSpacing: 0.5 },
	content: { padding: 16, marginTop: 8, gap: 24 },

	card: { borderRadius: 24, padding: 20, borderWidth: 1, overflow: "hidden", elevation: 1 },
	cardHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
		paddingBottom: 12,
		borderBottomWidth: 1,
	},
	cardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
	cardTitle: { fontFamily: serif, fontSize: 18, letterSpacing: 0.4, flexShrink: 1 },
	infoButton: { padding: 8, borderRadius: 999 },
	cardDesc: { fontSize: 12, lineHeight: 19, fontWeight: "500", marginBottom: 20 },

	label: { fontSize: 14, fontWeight: "500" },
	fieldLabel: { marginBottom: 8, paddingHorizontal: 4 },
	scaleHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 },
	scaleBadge: {
		fontSize: 12,
		fontWeight: "700",
		color: RY_GOLD,
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 4,
		borderWidth: 1,
		borderColor: goldA(0.2),
		overflow: "hidden",
	},
	scaleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
	scaleSmall: { fontSize: 12, fontWeight: "700" },
	scaleLarge: { fontSize: 18, fontWeight: "700" },

	segmented: { flexDirection: "row", padding: 4, borderRadius: 12, borderWidth: 1 },
	segment: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "transparent",
	},
	segmentActive: { elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
	segmentText: { fontSize: 14, fontWeight: "700" },

	colorsButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 12,
		marginTop: 16,
		borderRadius: 12,
		borderWidth: 1,
		elevation: 1,
	},
	paletteDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", elevation: 1 },
	colorsLabel: { fontSize: 14, fontWeight: "700" },
	miniDot: { width: 12, height: 12, borderRadius: 6 },

	toggle: { width: 48, height: 28, borderRadius: 14 },
	knob: { position: "absolute", top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", elevation: 1 },
	actionRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
		paddingVertical: 12,
		paddingHorizontal: 8,
		borderRadius: 12,
	},
	actionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
	actionLabel: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
	actionDesc: { fontSize: 12, fontWeight: "500", marginTop: 2 },
	divider: { height: 1, marginVertical: 4 },
	storageFoot: { paddingTop: 16, borderTopWidth: 1 },

	devButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", elevation: 1 },
	devText: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" },

	backdrop: { backgroundColor: "rgba(0, 0, 0, 0.6)" },
	sheetWrap: { flex: 1, justifyContent: "flex-end" },
	centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
	themeSheet: {
		maxHeight: "85%",
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		borderWidth: 1,
		padding: 24,
		elevation: 16,
	},
	sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
	sheetTitle: { fontSize: 18, fontWeight: "700" },
	roundClose: { padding: 8, borderRadius: 999 },
	colorGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: 8 },
	colorCell: { width: "25%", alignItems: "center", gap: 8, padding: 8, borderRadius: 12, borderWidth: 1.5 },
	colorCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", elevation: 3 },
	colorSelectedDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff", elevation: 1 },
	colorLabel: { fontSize: 10, fontWeight: "700" },
	sheetFoot: { paddingTop: 16, marginTop: 8, borderTopWidth: 1 },
	goldButton: { alignSelf: "stretch", paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: RY_GOLD, elevation: 3 },
	goldButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

	dialog: { width: "100%", maxWidth: 320, borderRadius: 24, borderWidth: 1, padding: 24, elevation: 16 },
	dialogClose: { position: "absolute", top: 16, right: 16, padding: 8, borderRadius: 999, elevation: 1, zIndex: 1 },
	dialogBody: { alignItems: "center", marginTop: 8 },
	dialogIcon: {
		width: 56,
		height: 56,
		borderRadius: 28,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		marginBottom: 16,
	},
	dialogTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16, textAlign: "center" },
	dialogText: { alignSelf: "stretch", fontSize: 14, lineHeight: 23, padding: 16, borderRadius: 12, borderWidth: 1 },

	cacheSheet: { maxHeight: "90%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, elevation: 16 },
	cacheHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 20,
		borderBottomWidth: 1,
	},
	cacheHeadIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
	cacheTitle: { fontSize: 16, fontWeight: "700" },
	cacheSub: { fontSize: 12, marginTop: 2 },
	cachePad: { paddingHorizontal: 20, paddingTop: 16 },
	platform: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderRadius: 12,
		borderWidth: 1,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	platformText: { flex: 1, fontSize: 12, fontWeight: "500" },
	cacheButtons: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
	smallButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
	smallButtonText: { fontSize: 12, fontWeight: "700" },
	cacheOptions: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
	cacheOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
	checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
	cacheEmoji: { fontSize: 20 },
	cacheLabel: { fontSize: 14, fontWeight: "700" },
	cacheDesc: { fontSize: 12, marginTop: 2 },
	cacheFoot: {
		padding: 20,
		borderTopWidth: 1,
	},
	clearButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		borderRadius: 12,
		elevation: 3,
	},
	clearButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
	cancelButton: { marginTop: 8, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
	cancelText: { fontSize: 16, fontWeight: "700" },
});

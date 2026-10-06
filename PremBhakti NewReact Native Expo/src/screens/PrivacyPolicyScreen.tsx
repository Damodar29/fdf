import { LinearGradient } from "expo-linear-gradient";
import {
	AlertTriangle,
	ArrowLeft,
	Database,
	Globe,
	Languages,
	Loader2,
	Lock,
	ShieldCheck,
	Smartphone,
	Trash2,
	User,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SideScrollView } from "../components/SideScrollView";
import { openWeb } from "../lib/appNav";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import { cream, ink, krishna, peacock, status } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

// Tailwind purple-500 (#a855f7) has no equivalent in jmColors; named here as
// a constant to make it easy to track if we add a purple ramp later.
const PURPLE_500 = "#a855f7";

// Tailwind orange-500 — header gradient end, as in OG and AboutScreen.
const ORANGE_500 = "#f97316";

// Strings — exact copies from the OG PrivacyPolicyScreen.tsx
const T = {
	hi: {
		title: "गोपनीयता नीति",
		intro:
			"Prem Bhakti भजन ऐप आपकी गोपनीयता का सम्मान करता है। हम पारदर्शिता और सुरक्षा के लिए प्रतिबद्ध हैं।",
		contact: "संपर्क करें",
		contactDesc: "यदि आपके पास गोपनीयता नीति के बारे में कोई प्रश्न हैं, तो आप हमसे संपर्क कर सकते हैं।",
		deleteTitle: "अकाउंट और डेटा डिलीट करें",
		deleteDesc:
			"आप अपने अकाउंट को यहाँ से डी-एक्टिवेट कर सकते हैं। सुरक्षा कारणों से आपका डेटा 30 दिनों तक सुरक्षित रखा जाएगा, जिसके बाद इसे हमेशा के लिए मिटा दिया जाएगा।",
		deleteBtn: "मेरा अकाउंट डिलीट करें",
		notLoggedIn: "डेटा डिलीट करने के लिए कृपया पहले ऐप में लॉगिन करें।",
		confirmTitle: "अकाउंट डिलीट करें?",
		confirmDesc:
			"क्या आप वाकई अपना अकाउंट डिलीट करना चाहते हैं? आपका अकाउंट तुरंत डी-एक्टिवेट हो जाएगा और 30 दिनों के बाद आपका डेटा स्थायी रूप से मिटा दिया जाएगा।",
		cancel: "रद्द करें",
		delete: "डिलीट करें",
		sections: [
			{
				title: "डेटा संग्रह (Data Collection)",
				content:
					'जब आप Google के माध्यम से लॉग इन करते हैं, तो हम आपकी बुनियादी प्रोफ़ाइल जानकारी (नाम, ईमेल, प्रोफ़ाइल फ़ोटो) एकत्र करते हैं। हम ऐप के भीतर आपकी गतिविधि (जैसे लाइक) भी सुरक्षित रूप से सहेजते हैं। इसके अतिरिक्त, यदि आप "Google Drive बैकअप" सुविधा का उपयोग करते हैं, तो आपकी प्लेलिस्ट और सेटिंग्स सीधे आपके Google Drive खाते में सहेजी जाती हैं।',
			},
			{
				title: "अनुमतियाँ (Permissions)",
				content:
					"• स्टोरेज (Storage): इसका उपयोग केवल आपके द्वारा डाउनलोड की गई पीडीएफ पुस्तकों, ऑडियो ट्रैक और दर्शन छवियों को आपके डिवाइस में सहेजने के लिए किया जाता है।\n• इंटरनेट (Internet): इसका उपयोग ऑनलाइन सामग्री (दैनिक सुविचार, दर्शन, ऑडियो) लाने और Google सेवाओं से कनेक्ट करने के लिए किया जाता है।",
			},
			{
				title: "सुरक्षा (Security)",
				content:
					"आपका डेटा (प्रोफाइल, लाइक) Google Firebase के सुरक्षित सर्वर पर संग्रहीत किया जाता है। हम आपके डेटा को किसी भी तीसरे पक्ष (Third Party) के साथ नहीं बेचते या साझा नहीं करते हैं। आपकी व्यक्तिगत बैकअप फ़ाइलें आपके स्वयं के Google Drive पर सुरक्षित रहती हैं।",
			},
			{
				title: "तृतीय-पक्ष सेवाएँ (Third-Party Services)",
				content:
					"हम मुख्य रूप से प्रमाणीकरण (Authentication), डेटाबेस (Firestore) और बैकअप के लिए Google सेवाओं (Firebase, Google Drive API) का उपयोग करते हैं। मीडिया सामग्री वितरित करने के लिए अन्य क्लाउड सेवाओं (जैसे GitHub) का उपयोग किया जा सकता है। वेबसाइट पर, कितने लोग साइट देखते हैं यह समझने के लिए Google Analytics कुकीज़ का उपयोग करता है; इसमें आपका नाम या ईमेल नहीं भेजा जाता।",
			},
			{
				title: "डेटा हटाना (Data Deletion Rights)",
				content:
					'यदि आप ऐप में लॉग इन करते हैं (Google के माध्यम से), तो हम केवल बुनियादी प्रोफ़ाइल जानकारी संग्रहीत करते हैं। आप ऐप के "प्रोफाइल" अनुभाग में जाकर किसी भी समय "अकाउंट डिलीट करें" बटन का उपयोग करके अपना अकाउंट डी-एक्टिवेट कर सकते हैं। सुरक्षा कारणों से आपका डेटा 30 दिनों तक सुरक्षित रखा जाएगा, जिसके बाद इसे स्थायी रूप से मिटा दिया जाएगा।',
			},
		],
	},
	en: {
		title: "Privacy Policy",
		intro:
			"Prem Bhakti Bhajan App respects your privacy. We are committed to transparency and security.",
		contact: "Contact Us",
		contactDesc:
			"If you have any questions regarding this Privacy Policy, you can contact us.",
		deleteTitle: "Delete Account & Data",
		deleteDesc:
			"You can deactivate your account from here. For security reasons, your data will be retained for 30 days before being permanently deleted.",
		deleteBtn: "Delete My Account",
		notLoggedIn: "Please log in to the app to delete your data.",
		confirmTitle: "Delete Account?",
		confirmDesc:
			"Are you sure you want to delete your account? Your account will be deactivated immediately and your data will be permanently removed after 30 days.",
		cancel: "Cancel",
		delete: "Delete",
		sections: [
			{
				title: "Data Collection",
				content:
					'When you log in via Google, we collect basic profile information (Name, Email, Profile Picture). We also securely store your activity within the app (such as Likes). Additionally, if you use the "Google Drive Backup" feature, your playlists and settings are saved directly to your Google Drive account.',
			},
			{
				title: "Permissions",
				content:
					"• Storage: Used solely to save PDF books, audio tracks, and darshan images that you explicitly choose to download.\n• Internet: Used to fetch online content (Daily Quotes, Darshan, Audio) and connect to Google services.",
			},
			{
				title: "Security",
				content:
					"Your data (profile, likes) is stored on Google Firebase secure servers. We do not sell or share your data with any third parties. Your personal backup files remain secure on your own Google Drive.",
			},
			{
				title: "Third-Party Services",
				content:
					"We primarily use Google Services (Firebase, Google Drive API) for authentication, database, and backups. Other cloud services (like GitHub) may be used strictly for delivering media content. On the website, Google Analytics uses cookies to count visits and see which pages are used; your name or email is not sent to it.",
			},
			{
				title: "Data Deletion Rights",
				content:
					'If you choose to log in (via Google), we store basic profile information. You have the right to deactivate your account at any time using the "Delete Account & Data" button located in the Profile section. For security reasons, your data will be retained for 30 days before being permanently deleted.',
			},
		],
	},
};

// Icon color for each section — same intent as OG Tailwind class colours.
// blue-500 → krishna[500], green-500 → peacock[400], saffron-500 → theme.p[500],
// purple-500 → PURPLE_500 constant, red-500 → status.error
const SECTION_ICON_COLORS = [
	krishna[500],    // Database — blue-500
	peacock[400],    // Smartphone — green-500
	null,            // Lock — saffron-500, filled in at render time from theme.p[500]
	PURPLE_500,      // Globe — purple-500
	status.error,    // User — red-500
] as const;

interface Props {
	onBack: () => void;
}

export function PrivacyPolicyScreen({ onBack }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const settings = useSettingsStore();
	const { user } = useAuthStore();
	const dark = theme.isDark;

	// OG: lang state starts from settingsLanguage prop, independently toggleable.
	const [lang, setLang] = useState<"hi" | "en">(settings.settingsLanguage);
	
	// Mirror OG's (and AboutScreen's) useEffect: re-sync lang when global setting changes
	useEffect(() => {
		setLang(settings.settingsLanguage);
	}, [settings.settingsLanguage]);

	// OG: delete confirmation modal state.
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	// OG: isDeleting spinner state. Not used natively yet (delete opens web screen),
	// kept for UI parity so the modal looks correct.
	const [isDeleting, setIsDeleting] = useState(false);

	const t = T[lang];

	// OG header: from-saffron-500 to-orange-500 gradient, cream text, border-ry-gold/40
	const ryGoldBorder = "rgba(212, 160, 23, 0.4)";

	// Delete section: per HANDOFF section 6, the delete action opens the web
	// Privacy screen until a safe test account is set up and deleteAccount() is
	// ported into authStore. The confirm modal UI is shown for parity, but the
	// final Delete tap goes to the web screen.
	const handleDeleteTap = () => {
		setShowDeleteConfirm(true);
	};

	const handleConfirmDelete = () => {
		// Guard: must never write to Firebase from the browser preview.
		if (Platform.OS === "web") {
			setShowDeleteConfirm(false);
			return;
		}
		// Opens the web Privacy screen so the user can complete deletion there
		// (native deleteAccount() not yet wired — see HANDOFF section 6).
		setShowDeleteConfirm(false);
		openWeb({ screen: "privacy" });
	};

	// Section icon color array: index 2 (Lock) uses theme.p[500] (saffron-500)
	const iconColors = [
		SECTION_ICON_COLORS[0],
		SECTION_ICON_COLORS[1],
		theme.p[500],
		SECTION_ICON_COLORS[3],
		SECTION_ICON_COLORS[4],
	] as const;

	return (
		<View style={[styles.flex, { backgroundColor: dark ? ink[900] : cream[50] }]}>
			{/* Header — gradient from-saffron-500 to-orange-500, rounded-b-3xl */}
			<LinearGradient
				colors={[theme.p[500], ORANGE_500]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[
					styles.header,
					{
						paddingTop: insets.top + 16,
						borderBottomColor: ryGoldBorder,
					},
				]}
			>
				{/* Left: back button + ShieldCheck icon + title */}
				<View style={styles.headerLeft}>
					<Pressable
						accessibilityLabel="Back"
						onPress={onBack}
						style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}
					>
						<ArrowLeft size={24} color="#fff" />
					</Pressable>
					<View style={styles.headerTitleRow}>
						<ShieldCheck size={22} color="#fff" />
						<Text style={styles.headerTitle} numberOfLines={1}>
							{t.title}
						</Text>
					</View>
				</View>

				{/* Right: language toggle — "English" or "हिंदी" */}
				<Pressable
					onPress={() => setLang((l) => (l === "hi" ? "en" : "hi"))}
					style={({ pressed }) => [styles.langToggle, pressed && styles.langTogglePressed]}
				>
					<Languages size={15} color={theme.p[700] ?? theme.p[600]} />
					<Text style={[styles.langToggleText, { color: theme.p[700] ?? theme.p[600] }]}>
						{lang === "hi" ? "English" : "हिंदी"}
					</Text>
				</Pressable>
			</LinearGradient>

			{/* Scrollable content */}
			<SideScrollView
				style={styles.flex}
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: 32 + insets.bottom },
				]}
				showsVerticalScrollIndicator={false}
			>
				{/* Intro box — OG: bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-200 */}
				<View
					style={[
						styles.introBox,
						{
							backgroundColor: dark
								? `rgba(${hexToRgb(krishna[900])}, 0.2)`
								: krishna[50],
							borderColor: dark ? krishna[800] : krishna[100],
						},
					]}
				>
					<Text
						style={[
							styles.introText,
							{ color: dark ? krishna[200] : krishna[800] },
						]}
					>
						{t.intro}
					</Text>
				</View>

				{/* Section cards */}
				<View style={styles.sections}>
					{t.sections.map((section, idx) => (
						<SectionCard
							key={idx}
							idx={idx}
							title={section.title}
							content={section.content}
							iconColor={iconColors[idx]}
							dark={dark}
							theme={theme}
						/>
					))}
				</View>

				{/* Contact footer */}
				<View style={styles.contactSection}>
					<Text style={[styles.contactDesc, { color: dark ? ink[500] : ink[400] }]}>
						{t.contactDesc}
					</Text>
					<Text style={[styles.contactEmail, { color: dark ? ink[500] : ink[400] }]}>
						Email: cpbssangh@gmail.com
					</Text>
				</View>

				{/* Delete Account section — OG: mt-8 pt-6 border-t */}
				<View
					style={[
						styles.deleteSection,
						{ borderTopColor: dark ? ink[800] : ink[200] },
					]}
				>
					<View
						style={[
							styles.deleteCard,
							{
								backgroundColor: dark
									? `rgba(${hexToRgb(status.error)}, 0.06)`
									: "#FEF2F2",
								borderColor: dark
									? `rgba(${hexToRgb(status.error)}, 0.2)`
									: "#FECACA",
							},
						]}
					>
						{/* Title */}
						<View style={styles.deleteTitleRow}>
							<AlertTriangle size={20} color={dark ? "#F87171" : status.error} />
							<Text
								style={[
									styles.deleteTitle,
									{ color: dark ? "#F87171" : status.error },
								]}
							>
								{t.deleteTitle}
							</Text>
						</View>

						{/* Description */}
						<Text
							style={[
								styles.deleteDesc,
								{
									color: dark
										? `rgba(${hexToRgb("#FCA5A5")}, 0.85)`
										: `rgba(${hexToRgb(status.errorStrong ?? status.error)}, 0.8)`,
								},
							]}
						>
							{t.deleteDesc}
						</Text>

						{/* Logged in: show Delete button / Not logged in: info message */}
						{user ? (
							<Pressable
								onPress={handleDeleteTap}
								style={({ pressed }) => [
									styles.deleteBtn,
									{ backgroundColor: status.error },
									pressed && { opacity: 0.85 },
								]}
							>
								<Trash2 size={18} color="#fff" />
								<Text style={styles.deleteBtnText}>{t.deleteBtn}</Text>
							</Pressable>
						) : (
							<View
								style={[
									styles.notLoggedInBox,
									{
										backgroundColor: dark
											? `rgba(${hexToRgb(ink[800])}, 0.6)`
											: "rgba(255,255,255,0.6)",
										borderColor: dark
											? `rgba(${hexToRgb(status.error)}, 0.2)`
											: "#FECACA",
									},
								]}
							>
								<Text
									style={[
										styles.notLoggedInText,
										{ color: dark ? ink[300] : ink[600] },
									]}
								>
									{t.notLoggedIn}
								</Text>
							</View>
						)}
					</View>
				</View>
			</SideScrollView>

			{/* Delete Confirmation Modal — OG: fixed inset-0 z-[100] bg-black/60 backdrop-blur */}
			<Modal
				visible={showDeleteConfirm}
				transparent
				animationType="fade"
				onRequestClose={() => setShowDeleteConfirm(false)}
				statusBarTranslucent
			>
				<View style={styles.modalOverlay}>
					<View
						style={[
							styles.modalCard,
							{
								backgroundColor: dark ? ink[800] : "#fff",
								borderColor: dark ? ink[700] : ink[100],
							},
						]}
					>
						{/* Warning icon circle */}
						<View
							style={[
								styles.modalIconCircle,
								{
									backgroundColor: dark
										? `rgba(${hexToRgb(status.error)}, 0.2)`
										: "#FEE2E2",
								},
							]}
						>
							<AlertTriangle size={24} color={status.error} />
						</View>

						{/* Title */}
						<Text
							style={[
								styles.modalTitle,
								{ color: dark ? "#fff" : ink[800] },
							]}
						>
							{t.confirmTitle}
						</Text>

						{/* Description */}
						<Text
							style={[
								styles.modalDesc,
								{ color: dark ? ink[400] : ink[500] },
							]}
						>
							{t.confirmDesc}
						</Text>

						{/* Buttons */}
						<View style={styles.modalButtons}>
							<Pressable
								onPress={() => setShowDeleteConfirm(false)}
								disabled={isDeleting}
								style={({ pressed }) => [
									styles.modalCancelBtn,
									{
										backgroundColor: dark ? ink[700] : ink[100],
									},
									pressed && { opacity: 0.7 },
								]}
							>
								<Text
									style={[
										styles.modalCancelText,
										{ color: dark ? ink[300] : ink[600] },
									]}
								>
									{t.cancel}
								</Text>
							</Pressable>

							<Pressable
								onPress={handleConfirmDelete}
								disabled={isDeleting}
								style={({ pressed }) => [
									styles.modalDeleteBtn,
									{
										backgroundColor: isDeleting
											? `rgba(${hexToRgb(status.error)}, 0.5)`
											: status.error,
									},
									pressed && { opacity: 0.8 },
								]}
							>
								{isDeleting ? (
									<ActivityIndicator size="small" color="#fff" />
								) : (
									<Trash2 size={16} color="#fff" />
								)}
								<Text style={styles.modalDeleteText}>{t.delete}</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}

// One section card — OG: bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border-slate-100 dark:border-slate-700
function SectionCard({
	idx,
	title,
	content,
	iconColor,
	dark,
	theme,
}: {
	idx: number;
	title: string;
	content: string;
	iconColor: string;
	dark: boolean;
	theme: ReturnType<typeof useAppTheme>;
}) {
	const Icon = SECTION_ICONS[idx];
	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: dark ? ink[800] : "#fff",
					borderColor: dark ? ink[700] : ink[100],
				},
			]}
		>
			{/* Icon row */}
			<View style={styles.cardIconRow}>
				<View
					style={[
						styles.cardIconWell,
						{ backgroundColor: dark ? ink[700] : ink[50] },
					]}
				>
					<Icon size={20} color={iconColor} />
				</View>
				<Text
					style={[
						styles.cardTitle,
						{ color: dark ? "#fff" : ink[800] },
					]}
				>
					{title}
				</Text>
			</View>
			{/* Content */}
			<Text
				style={[
					styles.cardContent,
					{ color: dark ? ink[300] : ink[600] },
				]}
			>
				{content}
			</Text>
		</View>
	);
}

// Icons in section order: Database, Smartphone, Lock, Globe, User
const SECTION_ICONS = [Database, Smartphone, Lock, Globe, User] as const;

/** "#RRGGBB" → "R, G, B" for rgba() without hardcoding decimals. */
function hexToRgb(hex: string): string {
	// Fallback safely for non-hex strings
	const safe = hex.startsWith("#") ? hex : "#808080";
	const r = Number.parseInt(safe.slice(1, 3), 16);
	const g = Number.parseInt(safe.slice(3, 5), 16);
	const b = Number.parseInt(safe.slice(5, 7), 16);
	return `${r}, ${g}, ${b}`;
}

const styles = StyleSheet.create({
	flex: { flex: 1 },

	// Header
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingBottom: 16,
		borderBottomWidth: 2,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		elevation: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		zIndex: 10,
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
		paddingRight: 8,
		gap: 8,
	},
	headerBack: {
		padding: 8,
		marginLeft: -8,
		borderRadius: 20,
	},
	pressed: { backgroundColor: "rgba(255, 255, 255, 0.2)" },
	headerTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		flex: 1,
	},
	headerTitle: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "600",
		flexShrink: 1,
	},

	// Language toggle — OG: bg-saffron-50 dark:bg-slate-800 border-saffron-200 dark:border-slate-700
	// On the gradient header we use a light cream/white pill instead.
	langToggle: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: "rgba(255,255,255,0.9)",
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.6)",
	},
	langTogglePressed: {
		backgroundColor: "rgba(255,255,255,0.75)",
	},
	langToggleText: {
		fontSize: 13,
		fontWeight: "700",
	},

	// Scroll content
	content: {
		padding: 16,
		paddingTop: 20,
		maxWidth: 672,
		alignSelf: "center",
		width: "100%",
	},

	// Intro box — OG: bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800
	introBox: {
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 20,
	},
	introText: {
		fontSize: 14,
		lineHeight: 22,
		fontWeight: "500",
	},

	// Section cards
	sections: {
		gap: 16,
	},
	card: {
		padding: 20,
		borderRadius: 16,
		borderWidth: 1,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 2,
		elevation: 1,
	},
	cardIconRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 12,
	},
	cardIconWell: {
		padding: 8,
		borderRadius: 8,
	},
	cardTitle: {
		fontWeight: "700",
		fontSize: 16,
		flex: 1,
	},
	cardContent: {
		fontSize: 14,
		lineHeight: 22,
	},

	// Contact footer
	contactSection: {
		alignItems: "center",
		paddingTop: 24,
		paddingBottom: 16,
	},
	contactDesc: {
		fontSize: 12,
		textAlign: "center",
		lineHeight: 18,
	},
	contactEmail: {
		fontSize: 12,
		textAlign: "center",
		marginTop: 4,
	},

	// Delete account section — OG: mt-8 pt-6 border-t
	deleteSection: {
		marginTop: 32,
		paddingTop: 24,
		borderTopWidth: 1,
	},
	deleteCard: {
		borderRadius: 16,
		padding: 20,
		borderWidth: 1,
	},
	deleteTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 8,
	},
	deleteTitle: {
		fontSize: 18,
		fontWeight: "700",
		flex: 1,
	},
	deleteDesc: {
		fontSize: 14,
		lineHeight: 22,
		fontWeight: "500",
		marginBottom: 16,
	},
	deleteBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 14,
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	deleteBtnText: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "700",
	},
	notLoggedInBox: {
		padding: 12,
		borderRadius: 12,
		borderWidth: 1,
		alignItems: "center",
	},
	notLoggedInText: {
		fontSize: 14,
		fontWeight: "700",
		textAlign: "center",
	},

	// Confirm modal — OG: fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		alignItems: "center",
		justifyContent: "center",
		padding: 16,
	},
	modalCard: {
		width: "100%",
		maxWidth: 384,
		borderRadius: 20,
		padding: 24,
		borderWidth: 1,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 16,
		elevation: 12,
	},
	modalIconCircle: {
		width: 48,
		height: 48,
		borderRadius: 24,
		alignItems: "center",
		justifyContent: "center",
		alignSelf: "center",
		marginBottom: 16,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "700",
		textAlign: "center",
		marginBottom: 8,
	},
	modalDesc: {
		fontSize: 14,
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 24,
	},
	modalButtons: {
		flexDirection: "row",
		gap: 12,
	},
	modalCancelBtn: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 12,
		alignItems: "center",
	},
	modalCancelText: {
		fontSize: 14,
		fontWeight: "700",
	},
	modalDeleteBtn: {
		flex: 1,
		flexDirection: "row",
		paddingVertical: 12,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	modalDeleteText: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "700",
	},
});

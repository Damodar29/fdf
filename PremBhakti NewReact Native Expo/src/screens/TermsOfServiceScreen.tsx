import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, FileText, HeartHandshake, Languages, Scale, ScrollText, ShieldAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SideScrollView } from "../components/SideScrollView";
import { useSettingsStore } from "../store/settingsStore";
import { cream, ink, janmashtami, krishna, peacock, status } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

const ORANGE_500 = "#f97316";

const T = {
	en: {
		title: "Terms of Service",
		intro: "Thank you for using the Prem Bhakti Bhajan App. By using the app, you agree to the following terms and conditions.",
		sections: [
			{
				icon: ScrollText,
				iconColorLight: krishna[500],
				iconColorDark: krishna[400],
				title: "App Purpose",
				content: "This app is created purely for spiritual and devotional purposes. It contains bhajans, kirtans, spiritual books, and information related to Shree Chaitanya Prem Bhakti Sangh (CPBS).",
			},
			{
				icon: Scale,
				iconColorLight: status.success,
				iconColorDark: status.success,
				title: "Usage Terms",
				content: "• You may use the content (audio, PDF, images) available in the app for personal and spiritual benefit.\n• Commercial use of any content is strictly prohibited.",
			},
			{
				icon: HeartHandshake,
				iconColorLight: janmashtami.deepGold,
				iconColorDark: janmashtami.gold,
				title: "User Account & Data",
				content: "When you log in via Google, we collect your basic profile (Name, Email) and app activity (Likes). Upon account deletion request, data is retained for 30 days for security purposes. The administrators reserve the right to suspend or delete any account without prior notice in case of inappropriate behavior, abusive language, or spam in the community features.",
			},
			{
				icon: ShieldAlert,
				iconColorLight: peacock[500],
				iconColorDark: peacock[400],
				title: "Limitation of Liability",
				content: "We strive to keep the app error-free and continuously available, but we will not be held liable for any technical issues, data loss, or service interruptions.",
			},
		],
		contact: "Contact Us",
		contactDesc: "If you have any questions regarding these terms, you can contact us.",
	},
	hi: {
		title: "सेवा की शर्तें",
		intro: "Prem Bhakti भजन ऐप का उपयोग करने के लिए धन्यवाद। ऐप का उपयोग करके, आप निम्नलिखित शर्तों से सहमत होते हैं।",
		sections: [
			{
				icon: ScrollText,
				iconColorLight: krishna[500],
				iconColorDark: krishna[400],
				title: "ऐप का उद्देश्य (App Purpose)",
				content: "यह ऐप विशुद्ध रूप से आध्यात्मिक और भक्ति उद्देश्यों के लिए बनाया गया है। इसमें भजन, कीर्तन, आध्यात्मिक पुस्तकें और श्री चैतन्य प्रेम भक्ति संघ (CPBS) से संबंधित जानकारी शामिल है।",
			},
			{
				icon: Scale,
				iconColorLight: status.success,
				iconColorDark: status.success,
				title: "उपयोग की शर्तें (Usage Terms)",
				content: "• आप ऐप में उपलब्ध सामग्री (ऑडियो, पीडीएफ, चित्र) का उपयोग व्यक्तिगत और आध्यात्मिक लाभ के लिए कर सकते हैं।\n• किसी भी सामग्री का व्यावसायिक (Commercial) उपयोग सख्त वर्जित है।",
			},
			{
				icon: HeartHandshake,
				iconColorLight: janmashtami.deepGold,
				iconColorDark: janmashtami.gold,
				title: "उपयोगकर्ता खाता और डेटा (User Account & Data)",
				content: "जब आप Google के माध्यम से लॉगिन करते हैं, तो हम आपकी बुनियादी प्रोफ़ाइल (नाम, ईमेल) और ऐप गतिविधि (लाइक) एकत्र करते हैं। खाता डिलीट करने का अनुरोध करने पर, सुरक्षा कारणों से डेटा 30 दिनों तक सुरक्षित रखा जाता है। ऐप में किसी भी प्रकार की अभद्र भाषा या अनुचित सामग्री पोस्ट करने पर एडमिनिस्ट्रेटर को आपका खाता बिना किसी पूर्व सूचना के निलंबित (Suspend) या हटाने का अधिकार है।",
			},
			{
				icon: ShieldAlert,
				iconColorLight: peacock[500],
				iconColorDark: peacock[400],
				title: "दायित्व की सीमा (Limitation of Liability)",
				content: "हम ऐप को त्रुटि-मुक्त और निरंतर उपलब्ध रखने का प्रयास करते हैं, लेकिन हम किसी भी तकनीकी समस्या, डेटा हानि, या सेवा में रुकावट के लिए जिम्मेदार नहीं होंगे।",
			},
		],
		contact: "संपर्क करें",
		contactDesc: "यदि आपके पास इन शर्तों के बारे में कोई प्रश्न हैं, तो आप हमसे संपर्क कर सकते हैं।",
	}
};

function hexToRgb(hex: string): string {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return `${r}, ${g}, ${b}`;
}

interface Props {
	navigation: any;
}

export function TermsOfServiceScreen({ navigation }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const s = useSettingsStore();
	const [lang, setLang] = useState<"hi" | "en">(s.settingsLanguage);
	const t = T[lang];
	const dark = theme.isDark;

	useEffect(() => {
		setLang(s.settingsLanguage);
	}, [s.settingsLanguage]);

	const ryGoldBorder = "rgba(212, 160, 23, 0.4)";
	const introBg = dark ? `rgba(${hexToRgb(krishna[900])}, 0.2)` : krishna[50];
	const introBorder = dark ? krishna[800] : krishna[100];
	const introText = dark ? krishna[200] : krishna[800];

	const cardBg = dark ? ink[800] : "#fff";
	const cardBorder = dark ? ink[700] : ink[100];
	const iconBg = dark ? ink[700] : ink[50];
	const titleColor = dark ? "#fff" : ink[800];
	const textColor = dark ? ink[300] : ink[600];

	const contactBg = dark ? `rgba(${hexToRgb(ink[800])}, 0.5)` : ink[100];
	const contactBorder = dark ? ink[700] : ink[200];
	const linkColor = dark ? krishna[400] : krishna[500];

	const handleEmail = () => {
		Linking.openURL("mailto:contact@chaitanyaprembhakti.org").catch(() => {});
	};

	return (
		<View style={[styles.flex, { backgroundColor: dark ? ink[950] : ink[50] }]}>
			{/* Header */}
			<LinearGradient
				colors={[theme.p[500], ORANGE_500]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: ryGoldBorder }]}
			>
				<View style={styles.headerLeft}>
					<Pressable
						accessibilityLabel="Back"
						onPress={() => navigation.goBack()}
						style={({ pressed }) => [styles.headerClose, pressed && styles.pressed]}
					>
						<ArrowLeft size={24} color={cream[50]} />
					</Pressable>
					<View style={styles.headerTitleRow}>
						<FileText size={20} color={janmashtami.deepGold} style={styles.headerIcon} />
						<Text style={styles.headerTitle} numberOfLines={1}>{t.title}</Text>
					</View>
				</View>
				<Pressable
					onPress={() => setLang(l => (l === "hi" ? "en" : "hi"))}
					style={({ pressed }) => [styles.langToggle, pressed && styles.pressed]}
				>
					<Languages size={14} color={cream[50]} />
					<Text style={styles.langToggleText}>{lang === "hi" ? "English" : "हिंदी"}</Text>
				</Pressable>
			</LinearGradient>

			<SideScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
				<View style={[styles.introBox, { backgroundColor: introBg, borderColor: introBorder }]}>
					<Text style={[styles.introText, { color: introText }]}>{t.intro}</Text>
				</View>

				<View style={styles.sections}>
					{t.sections.map((sec, idx) => {
						const Icon = sec.icon;
						return (
							<View key={idx} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
								<View style={styles.cardHeader}>
									<View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
										<Icon size={20} color={dark ? sec.iconColorDark : sec.iconColorLight} />
									</View>
									<Text style={[styles.cardTitle, { color: titleColor }]}>{sec.title}</Text>
								</View>
								<Text style={[styles.cardContent, { color: textColor }]}>{sec.content}</Text>
							</View>
						);
					})}
				</View>

				<View style={[styles.contactBox, { backgroundColor: contactBg, borderColor: contactBorder }]}>
					<Text style={[styles.contactTitle, { color: titleColor }]}>{t.contact}</Text>
					<Text style={[styles.contactDesc, { color: dark ? ink[400] : ink[500] }]}>
						{t.contactDesc}
					</Text>
					<Pressable onPress={handleEmail} style={styles.emailBtn}>
						<Text style={[styles.emailText, { color: linkColor }]}>contact@chaitanyaprembhakti.org</Text>
					</Pressable>
				</View>
			</SideScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
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
	},
	headerClose: {
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
	headerIcon: {},
	headerTitle: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "700",
		letterSpacing: 0.5,
		flexShrink: 1,
	},
	langToggle: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(255, 255, 255, 0.2)",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.3)",
		gap: 4,
	},
	langToggleText: {
		color: "#fff",
		fontSize: 12,
		fontWeight: "700",
	},
	content: {
		padding: 16,
		maxWidth: 896,
		alignSelf: "center",
		width: "100%",
		gap: 24,
	},
	introBox: {
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
	},
	introText: {
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 22,
	},
	sections: {
		gap: 16,
	},
	card: {
		padding: 20,
		borderRadius: 16,
		borderWidth: 1,
		elevation: 1,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 12,
	},
	iconWrap: {
		padding: 8,
		borderRadius: 8,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: "700",
		flex: 1,
	},
	cardContent: {
		fontSize: 14,
		lineHeight: 22,
		marginLeft: 44,
	},
	contactBox: {
		marginTop: 8,
		padding: 24,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: "center",
	},
	contactTitle: {
		fontSize: 16,
		fontWeight: "700",
		marginBottom: 8,
	},
	contactDesc: {
		fontSize: 14,
		textAlign: "center",
		lineHeight: 20,
	},
	emailBtn: {
		marginTop: 4,
	},
	emailText: {
		fontSize: 14,
		fontWeight: "500",
		textDecorationLine: "underline",
	},
});
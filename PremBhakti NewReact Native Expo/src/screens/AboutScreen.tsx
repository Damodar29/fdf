import { LinearGradient } from "expo-linear-gradient";
import { Building2, Heart, History, Info, Languages, Sparkles, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { SideScrollView } from "../components/SideScrollView";
import { openScreen } from "../lib/appNav";
import { useSettingsStore } from "../store/settingsStore";
import { cream, gold, ink, janmashtami, krishna } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";

// Tailwind blue-* colors used in the OG (blue-50, blue-100, blue-300, blue-500, blue-700, blue-800, blue-900)
// Not in jmColors.ts (which has krishna/peacock for blues). We use the krishna ramp for the
// info box and centers button, matching the OG's intent without new hardcoded hex values.
// OG's bg-blue-50 dark:bg-blue-900/10 → krishna[50] / krishna[950] with opacity
// OG's text-blue-700 dark:text-blue-300 → krishna[700] / krishna[200]
// OG's text-blue-500 (Sparkles icon) → krishna[500]

const ORANGE_500 = "#f97316"; // Tailwind orange-500 — for gradient only, no theme token exists

const T = {
	en: {
		title: "Shri Chaitanya Prem Bhakti Sangh",
		supportBtn: "Support Seva / Donate",
		centersBtn: "View Our Centers & Seva",
		p1_title: "Shree Chaitanya Prem Bhakti Sangh ",
		p1: "is a Gaudiya Vaishnava community formed to preach the Holy Names of the Lord across the northwestern and central regions of India.",
		p2_1: "Gaudiya Vaishnavism is based on the life and teachings of Shri Chaitanya Mahaprabhu, who is also known as ",
		p2_2: "Gauranga Mahaprabhu",
		p2_3: ".",
		p3: "Vaishnavism signifies the worship of Lord Vishnu and His incarnations, while 'Gauda' refers to the region of West Bengal, the birthplace of this divine tradition.",
		p4: "Shri Chaitanya Mahaprabhu rejuvenated the culture of Krishna bhakti in India during the fifteenth century.",
		p5_1: "This movement is traditionally known as the ",
		p5_2: "Brahma-Madhva-Gaudiya Vaishnava Sampradaya",
		p5_3: ".",
		p6: "The ultimate goal of this movement is to develop a loving, eternal relationship with the Supreme Lord, Shri Krishna.",
		mahaTitle: "The Mahamantra",
		mahaDesc1: "Shri Chaitanya Mahaprabhu promoted the Mahamantra as the most effective means of self-purification in this age of Kali.",
		mahaDesc2: "Srimad Bhagavad Gita and Shri Bhagavata Purana are the primary scriptures followed by Gaudiya Vaishnavas.",
		lineageTitle: "Our Lineage",
		t1_title: "Establishment of Gaudiya Math",
		t1_content: "The first preaching center was established on September 6, 1920, by Sri Srimad Bhaktisiddhanta Saraswati Goswami 'Prabhupada', and was named 'Gaudiya Math'.",
		t2_title: "Srila Bhaktisiddhanta Saraswati Goswami Prabhupada",
		t2_c1: "Srila Bhaktisiddhanta Saraswati Goswami Prabhupada appeared in Shri Kshetra Dham (Jagannatha Puri) on February 6, 1874, as the son of Srila Sac-cid-ananda Bhaktivinoda Thakura.",
		t2_c2: "He preached Shri Chaitanya Mahaprabhu's message of Divine Love across India with immense vigor, opposing philosophical deviations and social barriers to provide spiritual fulfillment for all.",
		t2_c3: "He established the central Gaudiya Math in Mayapur, West Bengal, which grew into a dynamic missionary movement with sixty-four branches across India during his presence.",
		t3_title: "Srila Bhakti Dayita Madhava Goswami Maharaja",
		t3_c1: "Srila Bhakti Dayita Madhava Goswami Maharaja appeared in Kanchanpara on November 18, 1904, on the auspicious Utthan Ekadashi tithi.",
		t3_c2: "He was a dearmost disciple and successor of Srila Prabhupada. He established many large preaching centers and founded the All India Shri Chaitanya Gaudiya Math in Kolkata in 1953.",
		t3_c3: "One of his most significant contributions was recovering the appearance site of his spiritual master, Srila Prabhupada, in Shri Jagannatha Puri.",
		t4_title: "Shri Vasudev Sharan 'Virahi' Ji Maharaja",
		t4_c1_1: "Following the orders of his spiritual master, ",
		t4_c1_2: "Sri Sri 108 Shri Vasudev Sharan 'Virahi' Ji Maharaja",
		t4_c1_3: " expanded the mission significantly in Central and Northwestern India.",
		t4_c2_1: "He established the ",
		t4_c2_2: "'Shree Chaitanya Prem Bhakti Sangh'",
		t4_c2_3: " to provide a dedicated platform for spiritual practices based entirely on the pure teachings of Lord Chaitanya.",
	},
	hi: {
		title: "श्री चैतन्य प्रेम भक्ति संघ",
		supportBtn: "सेवा सहयोग / दान करें",
		centersBtn: "हमारे केंद्र और सेवा देखें",
		p1_title: "श्री चैतन्य प्रेम भक्ति संघ ",
		p1: "मूल रूप से एक गौड़ीय वैष्णव समुदाय है जिसका गठन देश के उत्तर-पश्चिमी और मध्य भागों में भगवान के पवित्र नामों का प्रचार करने के उद्देश्य से किया गया था।",
		p2_1: "गौड़ीय वैष्णव धर्म भगवान चैतन्य के जीवन और शिक्षाओं पर आधारित है, जिन्हें ",
		p2_2: "गौरांग महाप्रभु",
		p2_3: " के नाम से भी जाना जाता है।",
		p3: "वैष्णववाद का अर्थ है 'भगवान विष्णु और उनके अवतारों की भक्ति', जबकि 'गौड़' पश्चिम बंगाल के उस क्षेत्र को संदर्भित करता है जहाँ से इस संप्रदाय की उत्पत्ति हुई।",
		p4: "श्री चैतन्य महाप्रभु ने पंद्रहवीं शताब्दी में भारत में श्रीकृष्ण भक्ति की संस्कृति को पुनर्जीवित किया।",
		p5_1: "इस आंदोलन को मूल रूप से ",
		p5_2: "ब्रह्म-माध्व-गौड़ीय वैष्णव संप्रदाय",
		p5_3: " कहा जाता है।",
		p6: "इस आंदोलन का अंतिम लक्ष्य सर्वोच्च भगवान श्री कृष्ण के साथ प्रेमपूर्ण संबंध विकसित करना है।",
		mahaTitle: "महामंत्र",
		mahaDesc1: "श्री चैतन्य महाप्रभु ने इस कलियुग में आत्म-शुद्धि के सबसे प्रभावी साधन के रूप में महामंत्र का प्रचार किया।",
		mahaDesc2: "श्रीमद्भगवद्गीता और श्री भागवत पुराण, गौड़ीय वैष्णवों द्वारा पालन किए जाने वाले प्रमुख ग्रंथ हैं।",
		lineageTitle: "गुरु परंपरा",
		t1_title: "गौड़ीय मठ की स्थापना",
		t1_content: "पहला प्रचार केंद्र 6 सितंबर 1920 को श्री श्रीमद् भक्तिसिद्धांत सरस्वती गोस्वामी 'प्रभुपाद' द्वारा स्थापित किया गया था, जिसे 'गौड़ीय मठ' नाम दिया गया।",
		t2_title: "श्रील भक्तिसिद्धांत सरस्वती गोस्वामी प्रभुपाद",
		t2_c1: "श्रील भक्तिसिद्धांत सरस्वती गोस्वामी प्रभुपाद 6 फरवरी 1874 को श्रील सच्चिदानंद भक्तिविनोद ठाकुर के पुत्र के रूप में श्री क्षेत्र धाम (जगन्नाथ पुरी) में प्रकट हुए।",
		t2_c2: "उन्होंने पूरे भारत में श्री चैतन्य महाप्रभु के भगवद प्रेम के संदेश का बड़े जोश के साथ प्रचार किया और सभी के लिए आध्यात्मिक कल्याण का मार्ग प्रशस्त किया।",
		t2_c3: "उन्होंने मायापुर में गौड़ीय मठ की स्थापना की, जो बाद में सभी शाखाओं का मूल केंद्र बना। उनके समय में पूरे भारत में चौंसठ शाखाएं सक्रिय थीं।",
		t3_title: "श्रील भक्ति दयित माधव गोस्वामी महाराज",
		t3_c1: "श्रील भक्ति दयित माधव गोस्वामी महाराज का प्राकट्य 18 नवंबर, 1904 को पवित्र उत्थान एकादशी तिथि पर कंचनपाड़ा में हुआ था।",
		t3_c2: "वे श्रील प्रभुपाद के प्रिय शिष्य और उत्तराधिकारी थे। उन्होंने 1953 में कोलकाता में 'अखिल भारतीय श्री चैतन्य गौड़ीय मठ' की स्थापना की।",
		t3_c3: "उनका एक महत्वपूर्ण योगदान श्री जगन्नाथ पुरी में अपने गुरुदेव श्रील प्रभुपाद के प्राकट्य स्थल को पुनः प्राप्त कर वहां भव्य मंदिर स्थापित करना था।",
		t4_title: "श्री वासुदेव शरण 'विरही' जी महाराज",
		t4_c1_1: "अपने गुरुदेव के आदेशानुसार, उनके प्रिय शिष्य ",
		t4_c1_2: "श्री श्री 108 श्री वासुदेव शरण 'विरही' जी महाराज",
		t4_c1_3: " ने देश के उत्तर-पश्चिम और मध्य क्षेत्रों में प्रचार का व्यापक विस्तार किया।",
		t4_c2_1: "उन्होंने ",
		t4_c2_2: "'श्री चैतन्य प्रेम भक्ति संघ'",
		t4_c2_3: " की स्थापना की, जो पूरी तरह से भगवान चैतन्य की शिक्षाओं और शुद्ध भक्ति के सिद्धांतों पर आधारित है।",
	}
};

// OG uses saffron-* (user accent) for these, mirrored as theme.p[*]
// OG blue-* (info box, centers button) → krishna ramp (closest Janmashtami equivalent)
// We avoid hardcoding hex; all colour references must be from theme / jmColors tokens.

interface Props {
	onBack: () => void;
}

export function AboutScreen({ onBack }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const s = useSettingsStore();
	const [lang, setLang] = useState<"hi" | "en">(s.settingsLanguage);
	const t = T[lang];
	const dark = theme.isDark;

	// Mirror OG's useEffect: re-sync lang whenever the global setting changes (or screen re-mounts)
	useEffect(() => {
		setLang(s.settingsLanguage);
	}, [s.settingsLanguage]);

	const textColor = dark ? ink[300] : ink[600];

	// OG bg-ry-gold/40 border = janmashtami.deepGold at 40% opacity
	const ryGoldBorder = "rgba(212, 160, 23, 0.4)";
	// OG blue-* info box / centers button colours → krishna ramp
	const infoBoxBg = dark ? `rgba(${hexToRgb(krishna[950])}, 0.1)` : krishna[50];
	const infoBoxBorder = dark ? `rgba(${hexToRgb(krishna[900])}, 0.3)` : krishna[100];
	const centersBtnBg = dark ? `rgba(${hexToRgb(krishna[900])}, 0.2)` : krishna[50];
	const centersBtnBorder = dark ? krishna[800] : krishna[100];
	const centersBtnText = dark ? krishna[200] : krishna[700];
	const sparklesColor = krishna[500];

	return (
		<View style={[styles.flex, { backgroundColor: dark ? ink[900] : cream[25] }]}>
			{/* Background Pattern — exact SVG from OG, opacity 10% */}
			<View style={[StyleSheet.absoluteFill, { opacity: 0.1 }]} pointerEvents="none">
				<Svg width="100%" height="100%">
					<Defs>
						<Pattern id="bgPattern" patternUnits="userSpaceOnUse" width="60" height="60">
							<Path
								fill="#d97706"
								d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"
							/>
						</Pattern>
					</Defs>
					<Rect width="100%" height="100%" fill="url(#bgPattern)" />
				</Svg>
			</View>

			{/* Header — gradient from-saffron-500 to-orange-500, rounded-b-3xl, border-ry-gold/40 */}
			<LinearGradient
				colors={[theme.p[500], ORANGE_500]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: ryGoldBorder }]}
			>
				{/* OG: X button + h2(Info icon + title) on left; language toggle on right */}
				<View style={styles.headerLeft}>
					<Pressable accessibilityLabel="Close" onPress={onBack} style={({ pressed }) => [styles.headerClose, pressed && styles.pressed]}>
						<X size={24} color={cream[50]} />
					</Pressable>
					<View style={styles.headerTitleRow}>
						<Info size={20} color={cream[50]} style={styles.headerIcon} />
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
				{/* Hero Section */}
				<View style={styles.heroSection}>
					{/* OG: w-20 h-20 bg-gradient-to-br from-ry-maroon to-ink-800 border border-ry-gold/40 rounded-2xl rotate-3 */}
					<LinearGradient
						colors={[janmashtami.krishnaBlue, ink[800]]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={[styles.logoContainer, { borderColor: ryGoldBorder }]}
					>
						<Svg viewBox="0 0 100 220" width={48} height={48} style={styles.logoSvg}>
							<Path d="M30 10v85q0 40 20 40t20-40V10" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
							<Path d="M50 135 C28 135, 20 165, 50 200 C80 165, 72 135, 50 135 Z" fill="#fff" />
						</Svg>
					</LinearGradient>
					{/* OG: text-slate-800 dark:text-white / span text-ry-maroon dark:text-ry-gold */}
					<Text style={[styles.heroText, { color: dark ? "#fff" : ink[800] }]}>
						Shree Chaitanya{"\n"}
						<Text style={{ color: dark ? gold[300] : janmashtami.krishnaBlue }}>Prem Bhakti Sangh</Text>
					</Text>
				</View>

				{/* Top Action Buttons */}
				<View style={styles.buttonGroup}>
					{/* OG: bg-ry-maroon text-ry-gold border border-ry-gold/40 shadow-ry-maroon/30 */}
					<Pressable
						onPress={() => openScreen("donate")}
						style={({ pressed }) => [
							styles.donateBtn,
							{
								backgroundColor: janmashtami.krishnaBlue,
								borderColor: ryGoldBorder,
								shadowColor: janmashtami.krishnaBlue,
							},
							pressed && { opacity: 0.8 },
						]}
					>
						<Heart size={22} color={janmashtami.deepGold} fill={janmashtami.deepGold} />
						<Text style={[styles.donateBtnText, { color: janmashtami.deepGold }]}>{t.supportBtn}</Text>
					</Pressable>

					{/* OG: bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800 */}
					<Pressable
						onPress={() => openScreen("seva")}
						style={({ pressed }) => [
							styles.centersBtn,
							{ backgroundColor: centersBtnBg, borderColor: centersBtnBorder },
							pressed && { opacity: 0.8 },
						]}
					>
						<Building2 size={18} color={centersBtnText} />
						<Text style={[styles.centersBtnText, { color: centersBtnText }]}>{t.centersBtn}</Text>
					</Pressable>
				</View>

				{/* Introduction Section */}
				<View style={styles.paragraphs}>
					{/* OG: <strong class="text-saffron-600 dark:text-saffron-400"> then rest of text */}
					<Text style={[styles.pText, { color: textColor }]}>
						<Text style={[styles.boldSaffron, { color: dark ? theme.p[400] : theme.p[600] }]}>{t.p1_title}</Text>
						{t.p1}
					</Text>
					{/* OG: Gauranga in font-semibold text-slate-800 dark:text-slate-100 */}
					<Text style={[styles.pText, { color: textColor }]}>
						{t.p2_1}
						<Text style={[styles.boldText, { color: dark ? ink[100] : ink[800] }]}>{t.p2_2}</Text>
						{t.p2_3}
					</Text>

					{/* OG: bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 */}
					<View style={[styles.infoBox, { backgroundColor: infoBoxBg, borderColor: infoBoxBorder }]}>
						<Sparkles size={20} color={sparklesColor} style={styles.infoBoxIcon} />
						<Text style={[styles.infoBoxText, { color: textColor }]}>{t.p3}</Text>
					</View>

					<Text style={[styles.pText, { color: textColor }]}>{t.p4}</Text>
					{/* OG: sampradaya in font-medium text-gold-700 dark:text-gold-300 */}
					<Text style={[styles.pText, { color: textColor }]}>
						{t.p5_1}
						<Text style={[styles.mediumGold, { color: dark ? gold[300] : gold[700] }]}>{t.p5_2}</Text>
						{t.p5_3}
					</Text>
					<Text style={[styles.pText, { color: textColor }]}>{t.p6}</Text>
				</View>

				{/* Mahamantra Card — OG: bg-gradient-to-br from-saffron-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 border-saffron-200 dark:border-slate-700 */}
				<View style={styles.mahaCardWrap}>
					<LinearGradient
						colors={dark ? [ink[800], ink[800]] : [theme.p[50], "#fff7ed"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={[styles.mahaCard, { borderColor: dark ? ink[700] : theme.p[200] }]}
					>
						<Text style={[styles.mahaTitle, { color: dark ? theme.p[400] : theme.p[600] }]}>{t.mahaTitle}</Text>
						{/* OG: text-lg sm:text-2xl font-hindi font-bold text-slate-800 dark:text-white */}
						<Text style={[styles.mahaText, { color: dark ? "#fff" : ink[800] }]}>
							हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे{"\n"}
							हरे राम हरे राम राम राम हरे हरे
						</Text>
					</LinearGradient>
					<View style={styles.mahaFooter}>
						{/* OG: text-slate-500 dark:text-slate-400 */}
						<Text style={[styles.mahaFooterDesc, { color: dark ? ink[400] : ink[500] }]}>{t.mahaDesc1}</Text>
						{/* OG: font-medium text-slate-600 dark:text-slate-300 */}
						<Text style={[styles.mahaFooterBold, { color: dark ? ink[300] : ink[600] }]}>{t.mahaDesc2}</Text>
					</View>
				</View>

				{/* Timeline / Lineage Section */}
				<View style={styles.lineageSection}>
					{/* OG: absolute left-3.5 top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-slate-700 */}
					<View style={[styles.lineageLine, { backgroundColor: dark ? ink[700] : ink[200] }]} />

					{/* OG: text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-10 */}
					<View style={styles.lineageHeader}>
						<History size={16} color={dark ? ink[500] : ink[400]} />
						<Text style={[styles.lineageTitle, { color: dark ? ink[500] : ink[400] }]}>{t.lineageTitle}</Text>
					</View>

					<View style={styles.timeline}>
						<TimelineItem
							theme={theme}
							year="1920"
							title={t.t1_title}
							content={<Text style={[styles.pText, { color: textColor }]}>{t.t1_content}</Text>}
						/>
						<TimelineItem
							theme={theme}
							title={t.t2_title}
							content={
								<>
									<Text style={[styles.pText, styles.mb8, { color: textColor }]}>{t.t2_c1}</Text>
									<Text style={[styles.pText, styles.mb8, { color: textColor }]}>{t.t2_c2}</Text>
									<Text style={[styles.pText, { color: textColor }]}>{t.t2_c3}</Text>
								</>
							}
						/>
						<TimelineItem
							theme={theme}
							year="1904"
							title={t.t3_title}
							content={
								<>
									<Text style={[styles.pText, styles.mb8, { color: textColor }]}>{t.t3_c1}</Text>
									<Text style={[styles.pText, styles.mb8, { color: textColor }]}>{t.t3_c2}</Text>
									<Text style={[styles.pText, { color: textColor }]}>{t.t3_c3}</Text>
								</>
							}
						/>
						<TimelineItem
							theme={theme}
							title={t.t4_title}
							isLast
							content={
								<>
									{/* OG: "Virahi Ji Maharaja" in font-bold text-saffron-600 dark:text-saffron-400 */}
									<Text style={[styles.pText, styles.mb8, { color: textColor }]}>
										{t.t4_c1_1}
										<Text style={[styles.boldSaffron, { color: dark ? theme.p[400] : theme.p[600] }]}>{t.t4_c1_2}</Text>
										{t.t4_c1_3}
									</Text>
									{/* OG: "'Shree Chaitanya..." in plain <strong> — bold ink */}
									<Text style={[styles.pText, { color: textColor }]}>
										{t.t4_c2_1}
										<Text style={[styles.boldText, { color: dark ? ink[100] : ink[800] }]}>{t.t4_c2_2}</Text>
										{t.t4_c2_3}
									</Text>
								</>
							}
						/>
					</View>
				</View>

				{/* Bottom Actions */}
				<View style={styles.bottomSection}>
					{/* OG: bg-saffron-500 shadow-saffron-500/30 text-white */}
					<Pressable
						onPress={() => openScreen("donate")}
						style={({ pressed }) => [
							styles.donateBtnBottom,
							{ backgroundColor: theme.p[500], shadowColor: theme.p[500] },
							pressed && { opacity: 0.8 },
						]}
					>
						<Heart size={22} color={cream[50]} fill={cream[50]} />
						<Text style={styles.donateBtnBottomText}>{t.supportBtn}</Text>
					</Pressable>

					{/* OG: w-16 h-1 bg-gradient-to-r from-saffron-300 to-saffron-500 dark:from-slate-700 dark:to-slate-600 */}
					<View style={styles.footerBranding}>
						<View style={[styles.footerLine, { backgroundColor: dark ? ink[600] : theme.p[500] }]} />
						{/* OG: text-saffron-600 dark:text-saffron-400 font-logo text-2xl */}
						<Text style={[styles.footerText, { color: dark ? theme.p[400] : theme.p[600] }]}>RadheShyam</Text>
					</View>
				</View>
			</SideScrollView>
		</View>
	);
}

/** Simple helper: "#RRGGBB" → "R, G, B" for rgba() construction without hardcoding decimals. */
function hexToRgb(hex: string): string {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return `${r}, ${g}, ${b}`;
}

function TimelineItem({
	theme,
	year,
	title,
	content,
	isLast,
}: {
	theme: AppTheme;
	year?: string;
	title: string;
	content: React.ReactNode;
	isLast?: boolean;
}) {
	const dark = theme.isDark;
	return (
		<View style={styles.timelineItem}>
			{/* OG: w-7 h-7 bg-white dark:bg-slate-900 border-4 border-saffron-200 dark:border-slate-600 rounded-full */}
			<View style={[styles.timelineDotWrap, { backgroundColor: dark ? ink[900] : "#fff", borderColor: dark ? ink[600] : theme.p[200] }]}>
				{/* OG: w-2.5 h-2.5 bg-saffron-500 rounded-full */}
				<View style={[styles.timelineDot, { backgroundColor: theme.p[500] }]} />
			</View>
			{/* OG: border-b border-slate-100 dark:border-slate-800 (except last) */}
			<View style={[styles.timelineContent, !isLast && { borderBottomColor: dark ? ink[800] : ink[100], borderBottomWidth: 1 }]}>
				{year ? (
					/* OG: text-xs font-bold text-saffron-500 dark:text-saffron-400 bg-saffron-50 dark:bg-slate-800 px-2 py-0.5 rounded */
					<View style={[styles.yearBadge, { backgroundColor: dark ? ink[800] : theme.p[50] }]}>
						<Text style={[styles.yearText, { color: dark ? theme.p[400] : theme.p[500] }]}>{year}</Text>
					</View>
				) : null}
				{/* OG: text-lg font-bold text-slate-800 dark:text-white */}
				<Text style={[styles.timelineCardTitle, { color: dark ? "#fff" : ink[800] }]}>{title}</Text>
				{/* OG: text-slate-600 dark:text-slate-300 wrapper */}
				<View style={styles.timelineBody}>{content}</View>
			</View>
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
	headerIcon: {
		// OG gap-2 between icon and title
	},
	headerTitle: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "600",
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
		padding: 20,
		maxWidth: 896,
		alignSelf: "center",
		width: "100%",
	},
	heroSection: {
		alignItems: "center",
		paddingTop: 16,
		paddingBottom: 8,
	},
	logoContainer: {
		width: 80,
		height: 80,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
		transform: [{ rotate: "3deg" }],
		elevation: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		borderWidth: 1,
	},
	logoSvg: {
		transform: [{ rotate: "-3deg" }],
	},
	heroText: {
		fontSize: 24,
		fontWeight: "700",
		textAlign: "center",
		lineHeight: 32,
	},
	buttonGroup: {
		gap: 12,
		marginTop: 24,
		marginBottom: 32,
	},
	donateBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 16,
		borderRadius: 12,
		borderWidth: 1,
		gap: 12,
		elevation: 4,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	donateBtnText: {
		fontSize: 18,
		fontWeight: "700",
	},
	centersBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 12,
		borderRadius: 12,
		borderWidth: 1,
		gap: 8,
	},
	centersBtnText: {
		fontSize: 16,
		fontWeight: "700",
	},
	paragraphs: {
		gap: 16,
	},
	pText: {
		fontSize: 15,
		lineHeight: 24,
	},
	boldSaffron: {
		fontWeight: "700",
		fontSize: 18,
	},
	boldText: {
		fontWeight: "600",
	},
	mediumGold: {
		fontWeight: "500",
	},
	infoBox: {
		flexDirection: "row",
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
		gap: 16,
		alignItems: "flex-start",
	},
	infoBoxIcon: {
		marginTop: 2,
	},
	infoBoxText: {
		flex: 1,
		fontSize: 14,
		lineHeight: 20,
	},
	mahaCardWrap: {
		marginTop: 32,
	},
	mahaCard: {
		marginBottom: 0,
		padding: 24,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: "center",
		overflow: "hidden",
	},
	mahaTitle: {
		fontSize: 12,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: 12,
	},
	mahaText: {
		fontSize: 18,
		fontWeight: "700",
		textAlign: "center",
		lineHeight: 28,
	},
	mahaFooter: {
		paddingHorizontal: 16,
		paddingTop: 16,
		alignItems: "center",
		gap: 8,
	},
	mahaFooterDesc: {
		fontSize: 14,
		textAlign: "center",
		lineHeight: 20,
	},
	mahaFooterBold: {
		fontSize: 14,
		fontWeight: "500",
		textAlign: "center",
		lineHeight: 20,
	},
	lineageSection: {
		marginTop: 32,
		paddingTop: 16,
	},
	lineageLine: {
		position: "absolute",
		left: 14,
		top: 24,
		bottom: 24,
		width: 2,
	},
	lineageHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingLeft: 40,
		marginBottom: 24,
		gap: 8,
	},
	lineageTitle: {
		fontSize: 14,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	timeline: {
		gap: 0,
	},
	timelineItem: {
		paddingLeft: 40,
	},
	timelineDotWrap: {
		position: "absolute",
		left: 0,
		top: 4,
		width: 28,
		height: 28,
		borderRadius: 14,
		borderWidth: 4,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 10,
	},
	timelineDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
	},
	timelineContent: {
		paddingBottom: 32,
	},
	yearBadge: {
		alignSelf: "flex-start",
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 4,
		marginBottom: 4,
	},
	yearText: {
		fontSize: 12,
		fontWeight: "700",
	},
	timelineCardTitle: {
		fontSize: 18,
		fontWeight: "700",
		marginBottom: 8,
	},
	timelineBody: {},
	mb8: {
		marginBottom: 8,
	},
	bottomSection: {
		paddingTop: 32,
		alignItems: "center",
	},
	donateBtnBottom: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 16,
		width: "100%",
		borderRadius: 12,
		gap: 12,
		elevation: 4,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	donateBtnBottomText: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "700",
	},
	footerBranding: {
		marginTop: 32,
		alignItems: "center",
		opacity: 0.6,
	},
	footerLine: {
		width: 64,
		height: 4,
		borderRadius: 2,
		marginBottom: 12,
	},
	footerText: {
		fontSize: 24,
		letterSpacing: 1,
	},
});

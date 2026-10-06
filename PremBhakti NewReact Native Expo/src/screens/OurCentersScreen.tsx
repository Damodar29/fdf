import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Linking,
	Platform,
} from "react-native";
import {
	ArrowLeft,
	BookOpen,
	Building2,
	Clock,
	Heart,
	HeartHandshake,
	Languages,
	MapPin,
	MessageCircle,
	Navigation,
	Phone,
	Sparkles,
	Utensils,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Pattern, Path, Rect, G } from "react-native-svg";
import { collection, getDocs, getFirestore } from "@react-native-firebase/firestore";

import { useSettingsStore } from "../store/settingsStore";
import { useAppTheme } from "../theme/useAppTheme";
import { ink, janmashtami, krishna, gold } from "../theme/colors";
import { openScreen } from "../lib/appNav";

interface CenterData {
	id: string;
	nameHi: string;
	nameEn: string;
	addressHi: string;
	addressEn: string;
	phone: string;
	locationUrl?: string;
	isWhatsappLocation?: boolean;
	locationPhone?: string;
}

const CENTERS: CenterData[] = [
	{
		id: "kota",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति धाम",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Dham",
		addressHi: "OCF 5, गणेश नगर, कोटा, राजस्थान",
		addressEn: "OCF 5, Ganesh Nagar, Kota, Rajasthan",
		phone: "9636943046, 9828235583",
		locationUrl: "https://maps.app.goo.gl/qFPr5dTKrK8MrGg6A",
	},
	{
		id: "vrindavan",
		nameHi: "श्री चैतन्य प्रेम भक्ति संघ आश्रम",
		nameEn: "Shree Chaitanya Prem Bhakti Sangh Ashram",
		addressHi: "गोपाल खार, परिक्रमा मार्ग, वृंदावन",
		addressEn: "Gopal Khar, Parikrama Marg, Vrindavan",
		phone: "9039484855, 9887880429",
		locationUrl: "https://maps.app.goo.gl/ikVk7U5WXGWc3Qxb9",
	},
	{
		id: "sagar",
		nameHi: "श्री गुरुधाम",
		nameEn: "Shri Gurudham",
		addressHi: "भूतेश्वर पथ, सागर, मध्य प्रदेश",
		addressEn: "Bhuteshwar Path, Sagar, M.P.",
		phone: "8839123276",
		locationUrl: "https://maps.app.goo.gl/gaPkLkDFvxoLvGRA6",
	},
	{
		id: "damoh",
		nameHi: "श्री गौर राधा रमण मंदिर",
		nameEn: "Shri Gaur Radha Raman Mandir",
		addressHi: "उमा मिस्त्री की तलैया, दमोह, मध्य प्रदेश",
		addressEn: "Uma Mistri Ki Talaiya, Damoh, M.P.",
		phone: "9407542046, 8770665363",
		locationUrl: "https://maps.app.goo.gl/bBHqbcv8zYz1TBpy8",
	},
	{
		id: "harrai",
		nameHi: "श्री श्री गौर राधा गोपीनाथ जू मंदिर",
		nameEn: "Shri Shri Gaur Radha Gopinath Ju Mandir",
		addressHi: "बटका रोड, हर्रई, छिंदवाड़ा, मध्य प्रदेश",
		addressEn: "Batka Road, Harrai, Chhindwara, M.P.",
		phone: "9424324565, 6260583949",
		locationUrl: "https://maps.app.goo.gl/NpX8xg8m5M7UbwMfA",
	},
	{
		id: "khurai",
		nameHi: "श्री श्री राधा कृष्ण सदन",
		nameEn: "Shri Shri Radha Krishna Sadan",
		addressHi: "शास्त्री वार्ड, खुरई, मध्य प्रदेश",
		addressEn: "Shastri Ward, Khurai, M.P.",
		phone: "9926927164",
		locationUrl: "https://maps.app.goo.gl/CtPXT5BrRcjGMawE6",
	},
	{
		id: "bhopal",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति संकीर्तन मंडल",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Sankirtan Mandal",
		addressHi: "गौर कृष्ण कुंज, कंफर्ट पार्क, अयोध्या बायपास, भोपाल",
		addressEn: "Gaur Krishna Kunj, Comfort Park, Ayodhya Bypass, Bhopal",
		phone: "9406523141",
		locationUrl: "https://maps.app.goo.gl/P2UjL51YCuVBHUE28",
	},
	{
		id: "bharatpur",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति संकीर्तन मंडल",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Sankirtan Mandal",
		addressHi: "विदेह कौर कालोनी, भरतपुर, राजस्थान",
		addressEn: "Videh Kaur Colony, Bharatpur, Rajasthan",
		phone: "8003987027",
		locationPhone: "9887880429", // Naman Prabhuji for location
		isWhatsappLocation: true,
	},
	{
		id: "bangaon",
		nameHi: 'श्री "विरही" सत्संग भवन',
		nameEn: 'Shri "Virahi" Satsang Bhawan',
		addressHi: "ग्राम बनगांव, मध्य प्रदेश",
		addressEn: "Gram Bangaon, M.P.",
		phone: "8770665363, 9755050177",
		locationPhone: "9755050177",
		isWhatsappLocation: true,
	},
	{
		id: "jhansi",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति संकीर्तन मंडल",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Sankirtan Mandal",
		addressHi: "झांसी",
		addressEn: "Jhansi",
		phone: "9521254309",
		locationPhone: "9521254309",
		isWhatsappLocation: true,
	},
	{
		id: "nariaoli",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति संकीर्तन मंडल",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Sankirtan Mandal",
		addressHi: "नारयावली",
		addressEn: "Nariaoli",
		phone: "9893371463",
		locationPhone: "9893371463",
		isWhatsappLocation: true,
	},
];

interface OurCentersScreenProps {
	onBack: () => void;
}

export const OurCentersScreen: React.FC<OurCentersScreenProps> = ({ onBack }) => {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage, setSettingsLanguage } = useSettingsStore();

	const isHindi = settingsLanguage === "hi";

	const [allowedMandals, setAllowedMandals] = useState<string[]>([]);

	useEffect(() => {
		const fetchAllowedMandals = async () => {
			try {
				const snapshot = await getDocs(collection(getFirestore(), "admin_roles"));
				const allowed = new Set<string>();
				snapshot.forEach((doc) => {
					const data = doc.data();
					if (
						data.role === "mandal" &&
						data.mandalId &&
						data.permissions?.includes("timings")
					) {
						allowed.add(data.mandalId);
					}
				});
				setAllowedMandals(Array.from(allowed));
			} catch (error) {
				console.error("Error fetching allowed mandals:", error);
			}
		};
		fetchAllowedMandals();
	}, []);

	const t = {
		title: isHindi ? "सेवा और केंद्र परिचय" : "Our Seva & Centers",
		subtitle: isHindi ? "श्री चैतन्य प्रेम भक्ति संघ" : "Shree Chaitanya Prem Bhakti Sangh",
		centerInfo: isHindi ? "हमारे प्रमुख केंद्र" : "Our Main Centers",
		getDirections: isHindi ? "मैप पर देखें" : "Get Directions",
		askLocation: isHindi ? "लोकेशन मांगें" : "Ask Location",
		ourSeva: isHindi ? "हमारी सेवा गतिविधियाँ" : "Our Seva Activities",
		sevaIntro: isHindi
			? "श्री चैतन्य प्रेम भक्ति संघ का उद्देश्य श्री चैतन्य महाप्रभु के संदेश को जन-जन तक पहुँचाना है। हमारी प्रमुख सेवाएँ निम्नलिखित हैं:"
			: "The mission of Shree Chaitanya Prem Bhakti Sangh is to spread the message of Sri Chaitanya Mahaprabhu. Our diverse seva activities include:",
		seva1: isHindi ? "हरिनाम प्रचार" : "Preaching",
		seva2: isHindi ? "विग्रह सेवा" : "Deity Seva",
		seva3: isHindi ? "अन्नदान" : "Prasadam",
		donateBtn: isHindi ? "सेवा सहयोग / दान करें" : "Offer Seva / Donate",
		joinUs: isHindi ? "हमसे जुड़ें" : "Join Us",
		joinUsDesc: isHindi
			? "आप भी इस ईश्वरीय कार्य में अपना योगदान दे सकते हैं। तन, मन या धन से सेवा अर्पण कर अपने जीवन को सफल बनाएं।"
			: "You too can contribute to this divine cause. Offer your service through body, mind, or wealth and make your life successful.",
	};

	const handleLocationClick = (center: CenterData) => {
		if (center.isWhatsappLocation) {
			const targetNumber = center.locationPhone || center.phone.split(",")[0].trim();
			const msg = isHindi
				? `हरे कृष्णा! कृपया ${center.nameHi} (${center.addressHi}) की लोकेशन भेजें।`
				: `Hare Krishna! Please send the location for ${center.nameEn} (${center.addressEn}).`;
			Linking.openURL(`https://wa.me/91${targetNumber}?text=${encodeURIComponent(msg)}`).catch(() => {});
		} else if (center.locationUrl) {
			Linking.openURL(center.locationUrl).catch(() => {});
		}
	};

	const handleCall = (number: string) => {
		Linking.openURL(`tel:${number.replace(/\s+/g, "")}`).catch(() => {});
	};

	return (
		<View style={{ flex: 1, backgroundColor: theme.page }}>
			{/* Background Pattern */}
			<View style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.1, pointerEvents: "none" }}>
				<Svg width="100%" height="100%">
					<Defs>
						<Pattern id="bg-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
							<G fill="none" fillRule="evenodd">
								<G fill="#d97706" fillOpacity="1">
									<Path d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z" />
								</G>
							</G>
						</Pattern>
					</Defs>
					<Rect width="100%" height="100%" fill="url(#bg-pattern)" />
				</Svg>
			</View>

			{/* Header */}
			<LinearGradient
				colors={[theme.p[500], "#f97316"]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={{
					paddingTop: insets.top,
					borderBottomWidth: 2,
					borderBottomColor: "rgba(232, 200, 120, 0.4)",
					borderBottomLeftRadius: 24,
					borderBottomRightRadius: 24,
					elevation: 10,
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 4 },
					shadowOpacity: 0.2,
					shadowRadius: 8,
					zIndex: 10,
				}}
			>
				<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 64, paddingHorizontal: 16 }}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
						<TouchableOpacity
							onPress={onBack}
							style={{ padding: 8, marginLeft: -8, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)" }}
						>
							<ArrowLeft size={24} color={janmashtami.cream} />
						</TouchableOpacity>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Building2 size={24} color={janmashtami.cream} />
							<Text style={{ fontSize: 20, fontWeight: "600", color: janmashtami.cream, letterSpacing: 0.5 }}>
								{t.title}
							</Text>
						</View>
					</View>

					<TouchableOpacity
						onPress={() => setSettingsLanguage(isHindi ? "en" : "hi")}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 4,
							backgroundColor: "rgba(255,255,255,0.2)",
							paddingHorizontal: 12,
							paddingVertical: 6,
							borderRadius: 16,
							borderWidth: 1,
							borderColor: "rgba(255,255,255,0.3)",
						}}
					>
						<Languages size={14} color={janmashtami.cream} />
						<Text style={{ fontSize: 12, fontWeight: "700", color: janmashtami.cream }}>
							{isHindi ? "English" : "हिंदी"}
						</Text>
					</TouchableOpacity>
				</View>
			</LinearGradient>

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, paddingTop: 24 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Hero Banner */}
				<View style={{ marginBottom: 32, borderRadius: 24, overflow: "hidden", elevation: 4, shadowColor: "#ea580c", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}>
					<LinearGradient
						colors={[janmashtami.deepGold, "#ea580c"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={{ padding: 32, alignItems: "center" }}
					>
						<View style={{ width: 64, height: 64, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }}>
							<HeartHandshake size={32} color="#fff" />
						</View>
						<Text style={{ fontSize: 24, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 8, letterSpacing: 0.5 }}>
							{t.subtitle}
						</Text>
						<Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.9)", textAlign: "center", textTransform: "uppercase", letterSpacing: 2 }}>
							{isHindi ? "मंदिर एवं प्रचार केंद्र" : "Temples & Preaching Centers"}
						</Text>
					</LinearGradient>
				</View>

				{/* Center List */}
				<View style={{ marginBottom: 32 }}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, paddingHorizontal: 8 }}>
						<MapPin size={20} color={theme.isDark ? gold[300] : janmashtami.deepGold} />
						<Text style={{ fontSize: 14, fontWeight: "700", color: theme.isDark ? gold[300] : janmashtami.deepGold, textTransform: "uppercase", letterSpacing: 1 }}>
							{t.centerInfo}
						</Text>
					</View>

					<View style={{ gap: 16 }}>
						{CENTERS.map((center) => (
							<View
								key={center.id}
								style={{
									backgroundColor: theme.card,
									padding: 20,
									borderRadius: 24,
									borderWidth: 1,
									borderColor: theme.isDark ? ink[700] : "rgba(232, 200, 120, 0.4)",
									elevation: 2,
									shadowColor: "#000",
									shadowOffset: { width: 0, height: 2 },
									shadowOpacity: 0.05,
									shadowRadius: 4,
								}}
							>
								<View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
									<View style={{ width: 48, height: 48, backgroundColor: theme.isDark ? ink[700] : janmashtami.cream, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.isDark ? ink[600] : "rgba(232, 200, 120, 0.4)" }}>
										<Building2 size={24} color={theme.isDark ? gold[300] : janmashtami.deepGold} />
									</View>
									<View style={{ flex: 1, paddingTop: 4 }}>
										<Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 6 }}>
											{isHindi ? center.nameHi : center.nameEn}
										</Text>
										<Text style={{ fontSize: 12, fontWeight: "500", color: theme.textSecondary, lineHeight: 18 }}>
											{isHindi ? center.addressHi : center.addressEn}
										</Text>
									</View>
								</View>

								<View style={{ height: 1, backgroundColor: theme.isDark ? ink[700] : janmashtami.cream, marginBottom: 16 }} />

								<View style={{ gap: 10 }}>
									<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
										{center.phone.split(",").map((num, idx) => (
											<TouchableOpacity
												key={idx}
												onPress={() => handleCall(num.trim())}
												style={{
													flex: 1,
													minWidth: "45%",
													flexDirection: "row",
													alignItems: "center",
													justifyContent: "center",
													gap: 8,
													backgroundColor: theme.isDark ? ink[700] : janmashtami.cardCream,
													paddingHorizontal: 12,
													paddingVertical: 10,
													borderRadius: 12,
													borderWidth: 1,
													borderColor: theme.isDark ? ink[600] : "rgba(232, 200, 120, 0.4)",
												}}
											>
												<Phone size={14} color={theme.isDark ? gold[300] : janmashtami.deepGold} />
												<Text style={{ fontSize: 12, fontWeight: "700", color: theme.isDark ? gold[300] : janmashtami.deepGold }}>
													{num.trim()}
												</Text>
											</TouchableOpacity>
										))}
									</View>

									<TouchableOpacity
										onPress={() => handleLocationClick(center)}
										style={{
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "center",
											gap: 8,
											backgroundColor: theme.isDark ? ink[700] : janmashtami.cream,
											paddingHorizontal: 16,
											paddingVertical: 12,
											borderRadius: 12,
											borderWidth: 1,
											borderColor: theme.isDark ? ink[600] : "rgba(232, 200, 120, 0.4)",
										}}
									>
										{center.isWhatsappLocation ? (
											<MessageCircle size={16} color={theme.isDark ? gold[300] : janmashtami.krishnaBlue} />
										) : (
											<Navigation size={16} color={theme.isDark ? gold[300] : janmashtami.krishnaBlue} />
										)}
										<Text style={{ fontSize: 12, fontWeight: "700", color: theme.isDark ? gold[300] : janmashtami.krishnaBlue }}>
											{center.isWhatsappLocation ? t.askLocation : t.getDirections}
										</Text>
									</TouchableOpacity>

									{allowedMandals.includes(center.id) && (
										<TouchableOpacity
											onPress={() => {
												// @ts-ignore
												__appNav.openScreen("temple-timings", { initialMandalId: center.id });
											}}
											style={{
												marginTop: 2,
												flexDirection: "row",
												alignItems: "center",
												justifyContent: "center",
												gap: 8,
												backgroundColor: theme.isDark ? "rgba(88, 28, 135, 0.2)" : "#faf5ff",
												paddingHorizontal: 16,
												paddingVertical: 12,
												borderRadius: 12,
												borderWidth: 1,
												borderColor: theme.isDark ? "rgba(107, 33, 168, 0.5)" : "#e9d5ff",
											}}
										>
											<Clock size={16} color={theme.isDark ? "#c084fc" : "#7e22ce"} />
											<Text style={{ fontSize: 12, fontWeight: "700", color: theme.isDark ? "#c084fc" : "#7e22ce" }}>
												{isHindi ? "दैनिक दर्शन समय" : "Daily Darshan Timings"}
											</Text>
										</TouchableOpacity>
									)}
								</View>
							</View>
						))}
					</View>
				</View>

				{/* Our Seva */}
				<View
					style={{
						backgroundColor: theme.card,
						padding: 24,
						borderRadius: 24,
						borderWidth: 1,
						borderColor: theme.isDark ? ink[700] : "rgba(232, 200, 120, 0.4)",
						marginBottom: 24,
						elevation: 2,
						shadowColor: "#000",
						shadowOffset: { width: 0, height: 2 },
						shadowOpacity: 0.05,
						shadowRadius: 4,
					}}
				>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
						<HeartHandshake size={20} color={theme.isDark ? gold[300] : janmashtami.deepGold} />
						<Text style={{ fontSize: 14, fontWeight: "700", color: theme.isDark ? gold[300] : janmashtami.deepGold, textTransform: "uppercase", letterSpacing: 1 }}>
							{t.ourSeva}
						</Text>
					</View>

					<Text style={{ fontSize: 14, fontWeight: "500", color: theme.textSecondary, lineHeight: 22, marginBottom: 24 }}>
						{t.sevaIntro}
					</Text>

					<View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
						{[
							{ icon: BookOpen, label: t.seva1 },
							{ icon: Sparkles, label: t.seva2 },
							{ icon: Utensils, label: t.seva3 },
						].map((item, idx) => (
							<View
								key={idx}
								style={{
									flex: 1,
									backgroundColor: theme.isDark ? ink[700] : janmashtami.cardCream,
									padding: 16,
									borderRadius: 16,
									borderWidth: 1,
									borderColor: theme.isDark ? ink[600] : janmashtami.cream,
									alignItems: "center",
									gap: 12,
								}}
							>
								<View style={{ backgroundColor: theme.card, padding: 12, borderRadius: 24, borderWidth: 1, borderColor: theme.isDark ? ink[600] : janmashtami.cream }}>
									<item.icon size={22} color={theme.isDark ? gold[300] : janmashtami.deepGold} />
								</View>
								<Text style={{ fontSize: 11, fontWeight: "700", color: theme.text, textAlign: "center", textTransform: "uppercase" }}>
									{item.label}
								</Text>
							</View>
						))}
					</View>

					<View style={{ height: 1, backgroundColor: theme.isDark ? ink[700] : janmashtami.cream, marginBottom: 20 }} />

					<TouchableOpacity
						onPress={() => {
							// @ts-ignore
							__appNav.openScreen("donate");
						}}
						style={{ borderRadius: 12, overflow: "hidden" }}
					>
						<LinearGradient
							colors={[janmashtami.deepGold, "#ea580c"]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 0 }}
							style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 }}
						>
							<Heart size={18} color="#fff" fill="#fff" />
							<Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
								{t.donateBtn}
							</Text>
						</LinearGradient>
					</TouchableOpacity>
				</View>

				{/* Join Us Footer */}
				<View
					style={{
						backgroundColor: theme.isDark ? ink[800] : janmashtami.cardCream,
						padding: 24,
						borderRadius: 24,
						borderWidth: 1,
						borderColor: theme.isDark ? ink[700] : "rgba(232, 200, 120, 0.4)",
					}}
				>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
						<Sparkles size={18} color={theme.isDark ? gold[300] : janmashtami.deepGold} />
						<Text style={{ fontSize: 18, fontWeight: "700", color: theme.isDark ? gold[300] : janmashtami.deepGold }}>
							{t.joinUs}
						</Text>
					</View>
					<Text style={{ fontSize: 14, fontWeight: "500", color: theme.textSecondary, lineHeight: 22 }}>
						{t.joinUsDesc}
					</Text>
				</View>
			</ScrollView>
		</View>
	);
};

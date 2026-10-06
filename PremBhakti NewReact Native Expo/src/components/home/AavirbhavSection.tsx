import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BookOpen, ChevronRight } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { ink, janmashtami, serif } from "../../theme/colors";

// AavirbhavMahotsavSection of the Capacitor Home: the Guru Maharaj
// glorification card — write one, or read all once the admins publish them.
// Its own A/अ toggle switches only this card's language.

const RY = {
	maroon: janmashtami.krishnaBlue,
	cream: janmashtami.cream,
	gold: janmashtami.deepGold,
	brown: janmashtami.textSecondary,
	sand: janmashtami.cardCream,
};

function Frieze() {
	return (
		<View style={styles.frieze}>
			<View style={styles.bead} />
			<LinearGradient
				colors={[RY.gold, RY.maroon, RY.gold]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={styles.friezeBar}
			/>
			<View style={styles.bead} />
		</View>
	);
}

function NewGlorificationsTag({ isHindi }: { isHindi: boolean }) {
	const o = useSharedValue(1);
	useEffect(() => {
		o.value = withRepeat(withSequence(withTiming(0.5, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1);
	}, [o]);
	const style = useAnimatedStyle(() => ({ opacity: o.value }));
	return (
		<Animated.View style={[styles.newTag, style]}>
			<Text style={styles.newTagText}>{isHindi ? "✨ नई महिमाएं" : "✨ NEW GLORIFICATIONS"}</Text>
		</Animated.View>
	);
}

export function AavirbhavSection({
	isHindi,
	isDark,
	onToggleLanguage,
	onWrite,
	showReadAll,
	hasUnread,
	onReadAll,
}: {
	isHindi: boolean;
	isDark: boolean;
	onToggleLanguage: () => void;
	onWrite: () => void;
	showReadAll: boolean;
	hasUnread: boolean;
	onReadAll: () => void;
}) {
	const titleColor = isDark ? RY.gold : RY.maroon;
	return (
		<View style={[styles.card, { borderColor: "rgba(212,160,23,0.3)" }]}>
			<LinearGradient
				colors={isDark ? [ink[800], "rgba(15,34,66,0.8)"] : [RY.cream, RY.sand]}
				style={StyleSheet.absoluteFill}
			/>
			<Frieze />
			<View style={styles.body}>
				<Pressable
					onPress={onToggleLanguage}
					accessibilityLabel={isHindi ? "Switch to English" : "हिंदी में बदलें"}
					style={styles.langToggle}
				>
					<Text style={[styles.langText, { color: isDark ? RY.gold : RY.maroon }]}>{isHindi ? "A" : "अ"}</Text>
				</Pressable>

				<View style={styles.avatar}>
					<Image source={require("../../../assets/home/avirbhav.webp")} style={StyleSheet.absoluteFill} contentFit="cover" />
				</View>
				<Text style={styles.eyebrow}>{isHindi ? "आविर्भाव महोत्सव" : "AAVIRBHAV MAHOTSAV"}</Text>
				<Text style={[styles.title, { color: titleColor }]}>
					{isHindi ? "गुरु महाराज जी की महिमा" : "Glorify Our Guru Maharaj"}
				</Text>
				<Text style={[styles.lead, { color: isDark ? ink[300] : RY.brown }]}>
					{isHindi
						? "आविर्भाव दिवस भले ही सम्पूर्ण हो गया हो, पर गुरु महाराज जी की महिमा हमेशा कही जा सकती है।"
						: "Even though Aavirbhav Diwas has been celebrated, you can always glorify Guru Maharaj Ji."}
				</Text>
				<Text style={[styles.note, { color: isDark ? ink[400] : "rgba(90,97,112,0.7)" }]}>
					{isHindi
						? "अब आप १२०० शब्द तक लिख सकते हैं — या आवाज़ में ऑडियो संदेश भेजें 🎙"
						: "Now you can write up to 1200 words — or send a voice audio message 🎙"}
				</Text>

				<Pressable onPress={onWrite} style={({ pressed }) => [styles.writeButton, pressed && styles.pressed]}>
					<Text style={styles.writeText}>{isHindi ? "अभी लिखें" : "Write now"}</Text>
					<ChevronRight size={16} color={RY.cream} />
				</Pressable>

				{showReadAll ? (
					<View style={styles.readAllWrap}>
						<Pressable onPress={onReadAll} style={({ pressed }) => [styles.readAllButton, pressed && styles.pressed]}>
							<BookOpen size={15} color={isDark ? RY.gold : RY.maroon} />
							<Text style={[styles.readAllText, { color: isDark ? RY.gold : RY.maroon }]}>
								{isHindi ? "सभी महिमा पढ़ें" : "Read All Glorifications"}
							</Text>
						</Pressable>
						{hasUnread ? <NewGlorificationsTag isHindi={isHindi} /> : null}
					</View>
				) : null}
			</View>
			<Frieze />
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: 24,
		borderWidth: 1,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 6 },
		elevation: 4,
	},
	frieze: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
	bead: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(212,160,23,0.7)" },
	friezeBar: { flex: 1, height: 6, borderRadius: 3, opacity: 0.7 },
	body: { paddingHorizontal: 24, paddingVertical: 8, alignItems: "center" },
	langToggle: {
		position: "absolute",
		top: -8,
		right: 16,
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "rgba(212,160,23,0.4)",
		backgroundColor: "rgba(11,46,107,0.1)",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
	},
	langText: { fontWeight: "700", fontSize: 14 },
	avatar: {
		width: 80,
		height: 80,
		borderRadius: 40,
		overflow: "hidden",
		borderWidth: 3,
		borderColor: "rgba(212,160,23,0.5)",
		backgroundColor: "rgba(11,46,107,0.05)",
		marginBottom: 12,
	},
	eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2.2, color: RY.gold, marginBottom: 4 },
	title: { fontFamily: serif, fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
	lead: { maxWidth: 384, fontSize: 14, fontWeight: "700", lineHeight: 22, textAlign: "center" },
	note: { maxWidth: 384, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 6 },
	writeButton: {
		marginTop: 20,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderRadius: 999,
		backgroundColor: RY.maroon,
		paddingHorizontal: 24,
		paddingVertical: 12,
		shadowColor: RY.maroon,
		shadowOpacity: 0.3,
		shadowRadius: 10,
		elevation: 5,
	},
	writeText: { color: RY.cream, fontSize: 14, fontWeight: "700" },
	pressed: { transform: [{ scale: 0.95 }] },
	readAllWrap: { marginTop: 28, alignItems: "center" },
	readAllButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: "rgba(212,160,23,0.6)",
		backgroundColor: "rgba(212,160,23,0.1)",
		paddingHorizontal: 24,
		paddingVertical: 10,
		shadowColor: "#DAA520",
		shadowOpacity: 0.35,
		shadowRadius: 14,
		elevation: 3,
	},
	readAllText: { fontSize: 14, fontWeight: "700" },
	newTag: {
		position: "absolute",
		top: -12,
		borderRadius: 999,
		backgroundColor: "#DC2626",
		paddingHorizontal: 8,
		paddingVertical: 2,
		shadowColor: "#DC2626",
		shadowOpacity: 0.5,
		shadowRadius: 12,
		elevation: 6,
		zIndex: 10,
	},
	newTagText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: "#fff" },
});

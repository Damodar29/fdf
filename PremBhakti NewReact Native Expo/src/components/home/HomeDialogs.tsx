import { LinearGradient } from "expo-linear-gradient";
import { ExternalLink, type LucideIcon, Play, Smartphone, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";
import { cream, gold, ink, krishna, serif, status } from "../../theme/colors";

// The two pop-ups of the Capacitor Home: "How to Use App" (intro slides, the
// YouTube demo) and the "Open Link?" check before leaving the app for a live
// stream. The guided-tour row joins the help pop-up with the tour itself.

function Scrim({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
	return (
		<Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
			<Pressable style={styles.scrim} onPress={onClose}>
				<Pressable onPress={() => {}} style={styles.cardWrap}>
					{children}
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function ModalCard({ isDark, children }: { isDark: boolean; children: ReactNode }) {
	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: isDark ? ink[800] : cream[25], borderColor: isDark ? "rgba(255,213,79,0.3)" : gold[400] },
			]}
		>
			{children}
		</View>
	);
}

function HelpOption({
	isDark,
	icon: Icon,
	iconColor,
	iconBg,
	title,
	desc,
	onPress,
}: {
	isDark: boolean;
	icon: LucideIcon;
	iconColor: string;
	iconBg: string;
	title: string;
	desc: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.option,
				{ backgroundColor: isDark ? ink[900] : cream[25], borderColor: "rgba(255,231,155,0.7)" },
				pressed && styles.pressed,
			]}
		>
			<View style={[styles.optionIcon, { backgroundColor: iconBg }]}>
				<Icon size={24} color={iconColor} />
			</View>
			<View style={styles.flex}>
				<Text style={[styles.optionTitle, { color: isDark ? cream[50] : ink[900] }]}>{title}</Text>
				<Text style={[styles.optionDesc, { color: isDark ? ink[300] : ink[500] }]}>{desc}</Text>
			</View>
		</Pressable>
	);
}

export function HelpModal({
	visible,
	isHindi,
	isDark,
	onClose,
	onIntro,
	onVideo,
}: {
	visible: boolean;
	isHindi: boolean;
	isDark: boolean;
	onClose: () => void;
	onIntro: () => void;
	onVideo: () => void;
}) {
	return (
		<Scrim visible={visible} onClose={onClose}>
			<ModalCard isDark={isDark}>
				<Pressable onPress={onClose} accessibilityLabel={isHindi ? "बंद करें" : "Close"} style={styles.close}>
					<X size={20} color={ink[400]} />
				</Pressable>
				<Text style={[styles.heading, { color: isDark ? gold[300] : gold[700] }]}>
					{isHindi ? "ऐप कैसे उपयोग करें" : "How to Use App"}
				</Text>
				<View style={styles.options}>
					<HelpOption
						isDark={isDark}
						icon={Smartphone}
						iconColor={isDark ? gold[300] : gold[700]}
						iconBg={isDark ? "rgba(255,213,79,0.1)" : gold[100]}
						title={isHindi ? "परिचय स्लाइड्स" : "Intro Slides"}
						desc={isHindi ? "शुरुआती परिचय फिर से देखें" : "See the welcome slides again"}
						onPress={onIntro}
					/>
					<HelpOption
						isDark={isDark}
						icon={Play}
						iconColor={status.error}
						iconBg={isDark ? "rgba(192,57,43,0.2)" : status.errorSoft}
						title={isHindi ? "वीडियो डेमो देखें" : "Watch Video Demo"}
						desc={isHindi ? "यूट्यूब पर वीडियो देखें" : "Watch on YouTube"}
						onPress={onVideo}
					/>
				</View>
			</ModalCard>
		</Scrim>
	);
}

export interface PendingLink {
	url: string;
	title: string;
	icon: ReactNode;
	tint: { bg: string; fg: string };
}

export function OpenLinkModal({
	link,
	isHindi,
	isDark,
	onCancel,
	onOpen,
}: {
	link: PendingLink | null;
	isHindi: boolean;
	isDark: boolean;
	onCancel: () => void;
	onOpen: () => void;
}) {
	return (
		<Scrim visible={!!link} onClose={onCancel}>
			<ModalCard isDark={isDark}>
				{link ? (
					<View style={styles.center}>
						<View style={[styles.linkIcon, { backgroundColor: link.tint.bg }]}>{link.icon}</View>
						<Text style={[styles.linkHeading, { color: isDark ? cream[50] : ink[900] }]}>{isHindi ? "लिंक खोलें?" : "Open Link?"}</Text>
						<Text style={[styles.linkDesc, { color: isDark ? ink[300] : ink[600] }]}>
							{isHindi ? "आप ऐप से बाहर जा रहे हैं:" : "You are leaving the app to visit:"}
						</Text>
						<Text style={[styles.linkTitle, { color: isDark ? cream[50] : ink[900] }]}>{link.title}</Text>
						<View style={styles.buttons}>
							<Pressable
								onPress={onCancel}
								style={({ pressed }) => [styles.cancel, { backgroundColor: isDark ? ink[700] : ink[100] }, pressed && styles.pressedSmall]}
							>
								<Text style={[styles.cancelText, { color: isDark ? ink[200] : ink[600] }]}>{isHindi ? "रद्द करें" : "Cancel"}</Text>
							</Pressable>
							<Pressable onPress={onOpen} style={({ pressed }) => [styles.openWrap, pressed && styles.pressedSmall]}>
								<LinearGradient colors={[krishna[500], krishna[600]]} style={styles.open}>
									<Text style={styles.openText}>{isHindi ? "खोलें" : "Open"}</Text>
									<ExternalLink size={16} color={cream[50]} />
								</LinearGradient>
							</Pressable>
						</View>
					</View>
				) : null}
			</ModalCard>
		</Scrim>
	);
}

const styles = StyleSheet.create({
	scrim: { flex: 1, backgroundColor: "rgba(3,12,28,0.7)", alignItems: "center", justifyContent: "center", padding: 16 },
	cardWrap: { width: "100%", maxWidth: 320 },
	card: { borderRadius: 40, borderWidth: 1, padding: 24, elevation: 20 },
	close: { position: "absolute", top: 12, right: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center", zIndex: 2 },
	heading: { fontFamily: serif, fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 24 },
	options: { gap: 16 },
	option: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: 20, borderWidth: 1, minHeight: 44 },
	pressed: { transform: [{ scale: 0.98 }] },
	pressedSmall: { transform: [{ scale: 0.95 }] },
	optionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
	flex: { flex: 1 },
	optionTitle: { fontFamily: serif, fontSize: 16 },
	optionDesc: { fontSize: 13, marginTop: 2 },
	center: { alignItems: "center" },
	linkIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 20 },
	linkHeading: { fontFamily: serif, fontSize: 18, marginBottom: 8 },
	linkDesc: { fontSize: 14, textAlign: "center" },
	linkTitle: { fontFamily: serif, fontSize: 16, fontWeight: "600", marginTop: 4, marginBottom: 32, textAlign: "center" },
	buttons: { flexDirection: "row", gap: 12, alignSelf: "stretch" },
	cancel: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
	cancelText: { fontWeight: "600", fontSize: 14 },
	openWrap: { flex: 1 },
	open: {
		minHeight: 44,
		borderRadius: 999,
		flexDirection: "row",
		gap: 8,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: krishna[700],
	},
	openText: { color: cream[50], fontWeight: "600", fontSize: 14 },
});

/** Lucide's YouTube / Instagram / Facebook glyphs (brand icons were dropped from lucide 1.x). */
export function BrandIcon({ name, size = 24, color }: { name: "youtube" | "instagram" | "facebook"; size?: number; color: string }) {
	const common = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24">
			{name === "youtube" ? (
				<>
					<Path
						{...common}
						d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"
					/>
					<Path {...common} d="m10 15 5-3-5-3z" />
				</>
			) : name === "instagram" ? (
				<>
					<Rect {...common} width={20} height={20} x={2} y={2} rx={5} ry={5} />
					<Path {...common} d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
					<Line {...common} x1={17.5} x2={17.51} y1={6.5} y2={6.5} />
				</>
			) : (
				<Path {...common} d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
			)}
		</Svg>
	);
}

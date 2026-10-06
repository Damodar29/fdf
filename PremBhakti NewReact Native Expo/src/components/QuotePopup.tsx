import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ImageIcon, RefreshCw, Sparkles, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { cream, gold, ink, krishna } from "../theme/jmColors";
import { useAppTheme } from "../theme/useAppTheme";

/**
 * QuotePopup of the Capacitor app: today's quote, shown once a day (and once
 * more after 4 pm) when the app opens. Tapping the picture opens Daily Quotes.
 */
export function QuotePopup({ url, onClose, onOpenFull }: { url: string; onClose: () => void; onOpenFull: () => void }) {
	const { isDark } = useAppTheme();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" });

	return (
		<Modal transparent statusBarTranslucent animationType="none" visible onRequestClose={onClose}>
			<Animated.View entering={FadeIn.duration(500)} style={styles.backdrop}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
				<Animated.View
					entering={ZoomIn.duration(500)}
					style={[
						styles.card,
						{
							backgroundColor: isDark ? ink[800] : cream[25],
							borderColor: isDark ? "rgba(255,213,79,0.1)" : "rgba(255,213,79,0.3)",
						},
					]}
				>
					<View
						style={[
							styles.header,
							{
								backgroundColor: isDark ? "rgba(7,21,41,0.5)" : "rgba(253,241,214,0.5)",
								borderBottomColor: isDark ? "rgba(99,73,11,0.2)" : "rgba(255,231,155,0.4)",
							},
						]}
					>
						<View style={styles.headerLeft}>
							<View style={[styles.badge, { backgroundColor: isDark ? ink[800] : gold[100] }]}>
								<Sparkles size={20} color={isDark ? gold[400] : gold[700]} />
							</View>
							<View>
								<Text style={[styles.title, { color: isDark ? cream[50] : ink[900] }]}>नित्य वाणी</Text>
								<Text style={[styles.overline, { color: isDark ? ink[400] : ink[500] }]}>
									DAILY WISDOM • {date.toUpperCase()}
								</Text>
							</View>
						</View>
						<Pressable onPress={onClose} hitSlop={8} style={styles.close}>
							<X size={20} color={isDark ? ink[400] : ink[500]} />
						</Pressable>
					</View>

					<Pressable onPress={onOpenFull} style={[styles.imageBox, { backgroundColor: isDark ? ink[950] : cream[50] }]}>
						{loading && !error ? (
							<View style={styles.center}>
								<Svg viewBox="0 0 100 100" width={48} height={48} stroke="#D4AF37" fill="none" opacity={0.8}>
									<Circle cx={50} cy={50} r={42} strokeWidth={6} />
									<Circle cx={50} cy={50} r={34} strokeWidth={2} strokeDasharray="4 4" />
									<Circle cx={50} cy={50} r={10} strokeWidth={4} />
									<Circle cx={50} cy={50} r={4} fill="#D4AF37" />
									<Path
										d="M50 8 L50 92 M8 50 L92 50 M20 20 L80 80 M20 80 L80 20 M34 11 L66 89 M66 11 L34 89 M11 34 L89 66 M11 66 L89 34"
										strokeWidth={2.5}
									/>
								</Svg>
								<Text style={[styles.seeking, { color: isDark ? ink[400] : ink[500] }]}>SEEKING VANI...</Text>
							</View>
						) : null}

						{!error ? (
							<>
								<Image
									key={attempt}
									source={{ uri: url }}
									contentFit="contain"
									transition={700}
									style={[StyleSheet.absoluteFill, { opacity: loading ? 0 : 1 }]}
									onLoad={() => setLoading(false)}
									onError={() => {
										setError(true);
										setLoading(false);
									}}
								/>
								{!loading ? (
									<>
										<View style={styles.hint}>
											<ImageIcon size={14} color="rgba(255,255,255,0.8)" />
										</View>
										<LinearGradient colors={["transparent", "rgba(0,0,0,0.5)"]} style={styles.footer} pointerEvents="none">
											<Text style={styles.footerText}>Tap to view in Full</Text>
										</LinearGradient>
									</>
								) : null}
							</>
						) : (
							<View style={styles.center}>
								<View style={[styles.errorIcon, { backgroundColor: isDark ? ink[800] : ink[100] }]}>
									<RefreshCw size={24} color={isDark ? ink[300] : ink[600]} />
								</View>
								<Text style={[styles.errorText, { color: isDark ? ink[300] : ink[600] }]}>CONNECTION LOST</Text>
								<Pressable
									onPress={() => {
										setError(false);
										setLoading(true);
										setAttempt((a) => a + 1);
									}}
								>
									<LinearGradient colors={[gold[400], gold[500]]} style={styles.retry}>
										<RefreshCw size={14} color={krishna[900]} />
										<Text style={styles.retryText}>Retry Now</Text>
									</LinearGradient>
								</Pressable>
							</View>
						)}
					</Pressable>
				</Animated.View>
			</Animated.View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(3,11,26,0.6)" },
	card: {
		width: "100%",
		maxWidth: 384,
		maxHeight: "80%",
		borderRadius: 32,
		borderWidth: 1,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOpacity: 0.3,
		shadowRadius: 30,
		shadowOffset: { width: 0, height: 20 },
		elevation: 16,
	},
	header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
	headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
	badge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
	title: { fontSize: 18, lineHeight: 22, fontWeight: "700" },
	overline: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 2 },
	close: { padding: 8, borderRadius: 999 },
	imageBox: { minHeight: 320, flexShrink: 1, aspectRatio: 0.8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
	center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
	seeking: { fontSize: 12, fontWeight: "700", letterSpacing: -0.5 },
	hint: {
		position: "absolute",
		top: 16,
		right: 16,
		padding: 6,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.1)",
		backgroundColor: "rgba(0,0,0,0.2)",
	},
	footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 24, alignItems: "center" },
	footerText: {
		color: "#fff",
		fontSize: 12,
		fontWeight: "700",
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 999,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.2)",
		backgroundColor: "rgba(255,255,255,0.1)",
	},
	errorIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
	errorText: { fontSize: 14, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
	retry: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 24,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(176,131,19,0.4)",
	},
	retryText: { fontSize: 12, fontWeight: "700", color: krishna[900] },
});

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { cream, gold, krishna, serif } from "../../theme/colors";

// HeroCarousel of the Capacitor Home: Guru Maharaj Ji and Virahi Ji Maharaj,
// cross-fading every 4 s, swipe or arrows to change, tap to open the slide's
// page.

const SLIDES = [
	{ image: require("../../../assets/home/guru-maharaj.webp"), type: "guru" as const },
	{ image: require("../../../assets/home/virahi-maharaj.webp"), type: "virahi" as const },
];

function Slide({ image, visible }: { image: number; visible: boolean }) {
	const style = useAnimatedStyle(() => ({ opacity: withTiming(visible ? 1 : 0, { duration: 700 }) }));
	return (
		<Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
			<Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" />
			{/* Krishna-blue scrim so the gold title stays legible. */}
			<LinearGradient
				colors={["transparent", "rgba(3,12,28,0.2)", "rgba(3,12,28,0.8)"]}
				locations={[0, 0.5, 1]}
				style={StyleSheet.absoluteFill}
			/>
		</Animated.View>
	);
}

export function HeroCarousel({
	isHindi,
	isDark,
	onOpenGuru,
	onOpenVirahi,
}: {
	isHindi: boolean;
	isDark: boolean;
	onOpenGuru: () => void;
	onOpenVirahi: () => void;
}) {
	const [index, setIndex] = useState(0);
	const touchStart = useRef(0);
	const swiped = useRef(false);

	useEffect(() => {
		const t = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), 4000);
		return () => clearTimeout(t);
	}, [index]);

	const label = (type: "guru" | "virahi") =>
		type === "guru" ? (isHindi ? "गुरु महाराज जी" : "Guru MaharajG") : isHindi ? "विरही जी महाराज" : "Virahi Ji Maharaj";

	const step = (by: number) => setIndex((i) => (i + by + SLIDES.length) % SLIDES.length);
	const arrow = (by: number) => (e: GestureResponderEvent) => {
		e.stopPropagation();
		step(by);
	};

	return (
		<Pressable
			onPress={() => {
				if (swiped.current) return;
				if (SLIDES[index].type === "guru") onOpenGuru();
				else onOpenVirahi();
			}}
			onTouchStart={(e) => {
				touchStart.current = e.nativeEvent.pageX;
				swiped.current = false;
			}}
			onTouchEnd={(e) => {
				const distance = touchStart.current - e.nativeEvent.pageX;
				if (Math.abs(distance) > 50) {
					swiped.current = true;
					step(distance > 0 ? 1 : -1);
				}
			}}
			style={[
				styles.frame,
				{
					borderColor: isDark ? "rgba(255,213,79,0.30)" : "#E8C878",
					backgroundColor: isDark ? "#0F2242" : cream[50],
				},
			]}
		>
			{SLIDES.map((s, i) => (
				<Slide key={s.type} image={s.image} visible={i === index} />
			))}

			<Pressable onPress={arrow(-1)} accessibilityLabel="Previous slide" style={[styles.arrow, { left: 12 }]}>
				<ChevronLeft size={24} color={cream[50]} />
			</Pressable>
			<Pressable onPress={arrow(1)} accessibilityLabel="Next slide" style={[styles.arrow, { right: 12 }]}>
				<ChevronRight size={24} color={cream[50]} />
			</Pressable>

			<View style={styles.footer} pointerEvents="none">
				<Text style={styles.title}>{label(SLIDES[index].type)}</Text>
				<View style={styles.dots}>
					{SLIDES.map((s, i) => (
						<View key={s.type} style={[styles.dot, { backgroundColor: i === index ? gold[300] : "rgba(255,248,231,0.5)" }]} />
					))}
				</View>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	frame: {
		width: "100%",
		aspectRatio: 16 / 9,
		borderRadius: 40,
		borderWidth: 1,
		overflow: "hidden",
		shadowColor: krishna[600],
		shadowOpacity: 0.16,
		shadowOffset: { width: 0, height: 12 },
		shadowRadius: 28,
		elevation: 6,
	},
	arrow: {
		position: "absolute",
		top: "50%",
		marginTop: -22,
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(5,20,46,0.6)",
		borderWidth: 1,
		borderColor: "rgba(255,213,79,0.3)",
		borderRadius: 20,
		zIndex: 20,
	},
	footer: {
		position: "absolute",
		bottom: 12,
		left: 16,
		right: 16,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
	},
	title: {
		color: gold[300],
		fontFamily: serif,
		fontWeight: "600",
		fontSize: 20,
		letterSpacing: 0.5,
		textShadowColor: "rgba(0,0,0,0.8)",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 2,
	},
	dots: { flexDirection: "row", gap: 6 },
	dot: { width: 6, height: 6, borderRadius: 3 },
});

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import { type ImageSourcePropType, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
	Easing,
	Keyframe,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { THUMB, thumbUrl } from "../../lib/imageThumb";
import { cream, gold, ink, janmashtami, krishna, serif } from "../../theme/colors";
import { GoldRule } from "../GoldRule";
import { TileNiche } from "../Ornaments";

// The Home grid tiles (GlassCard, ImageCard, SlideshowCard and their shared
// chrome in components/HomeScreen.tsx of the Capacitor app): a warm cream card
// with a gold edge and an inner keyline, a temple alcove with a lit icon, and
// a NEW / LIVE flag.

const TILE_RADIUS = 32; // rounded-jm-card
const KEYLINE_RADIUS = 16;

/**
 * slideUpFade (index.css `.stagger-item`): rise 40px and fade in over 1s.
 * Not in the browser preview (`npm run web`): Reanimated's web entering
 * animations lay the items out on top of each other.
 */
export const enterUp = (delay: number) =>
	Platform.OS === "web"
		? undefined
		: new Keyframe({
				0: { opacity: 0, transform: [{ translateY: 40 }] },
				100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(0.25, 0.8, 0.25, 1) },
			})
				.duration(1000)
				.delay(delay);

/** Devanagari titles keep a Devanagari face. */
const isDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

function TileSurface({ isDark, children }: { isDark: boolean; children: ReactNode }) {
	return (
		<View
			style={[
				styles.surface,
				{
					borderColor: isDark ? "rgba(255,213,79,0.20)" : "rgba(232,200,120,0.70)",
					shadowOpacity: isDark ? 0 : 0.1,
				},
			]}
		>
			<LinearGradient
				colors={isDark ? [ink[800], ink[900]] : [cream[25], cream[100]]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={StyleSheet.absoluteFill}
			/>
			{children}
			<View
				pointerEvents="none"
				style={[styles.keyline, { borderColor: isDark ? "rgba(255,213,79,0.10)" : "rgba(255,213,79,0.25)" }]}
			/>
		</View>
	);
}

/** The lit alcove: niche, warm bloom, the icon and its gold threshold. */
const TileIconInterior = memo(function TileIconInterior({ icon, isDark }: { icon: ReactNode; isDark: boolean }) {
	return (
		<>
			<TileNiche color={isDark ? "rgba(255,213,79,0.45)" : "rgba(11,46,107,0.70)"} />
			<Svg style={StyleSheet.absoluteFill} pointerEvents="none">
				<Defs>
					<RadialGradient id="tile-bloom" cx="50%" cy="47%" rx="40%" ry="32%">
						<Stop offset="0" stopColor={janmashtami.gold} stopOpacity={0.28} />
						<Stop offset="0.55" stopColor={janmashtami.gold} stopOpacity={0.08} />
						<Stop offset="0.74" stopColor={janmashtami.gold} stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect width="100%" height="100%" fill="url(#tile-bloom)" />
			</Svg>
			<View style={styles.iconStack}>
				{icon}
				<GoldRule style={styles.threshold} opacity={0.8} />
			</View>
		</>
	);
});

function PulsingDot() {
	const o = useSharedValue(0.45);
	useEffect(() => {
		o.value = withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0.45, { duration: 1400 })), -1);
	}, [o]);
	const style = useAnimatedStyle(() => ({ opacity: o.value }));
	return <Animated.View style={[styles.liveDot, style]} />;
}

/** LIVE (flat error red + pulsing dot) or NEW (red gradient pill, pulsing). */
const TileFlag = memo(function TileFlag({ isLive, hasNew }: { isLive?: boolean; hasNew?: boolean }) {
	const pulse = useSharedValue(1);
	useEffect(() => {
		if (!hasNew || isLive) return;
		pulse.value = withRepeat(withSequence(withTiming(0.5, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1);
	}, [hasNew, isLive, pulse]);
	const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

	if (isLive) {
		return (
			<View style={[styles.flag, styles.live]}>
				<PulsingDot />
				<Text style={styles.liveText}>LIVE</Text>
			</View>
		);
	}
	if (hasNew) {
		return (
			<Animated.View style={[styles.flag, styles.newShadow, pulseStyle]}>
				<LinearGradient
					colors={["#DC2626", "#F43F5E"]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0 }}
					style={styles.newPill}
				>
					<Text style={styles.newText}>NEW</Text>
				</LinearGradient>
			</Animated.View>
		);
	}
	return null;
});

interface TileProps {
	title: string;
	onPress: () => void;
	isDark: boolean;
	isLive?: boolean;
	hasNew?: boolean;
	delay: number;
	width: number;
}

function TileShell({ title, onPress, isDark, delay, width, children }: TileProps & { children: ReactNode }) {
	return (
		<Animated.View entering={enterUp(delay)} style={{ width }}>
			<Pressable
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={title}
				style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
			>
				{children}
				<Text
					style={[
						styles.title,
						{ color: isDark ? cream[50] : ink[900], fontFamily: isDevanagari(title) ? undefined : serif },
					]}
					numberOfLines={2}
				>
					{title}
				</Text>
			</Pressable>
		</Animated.View>
	);
}

/** An icon tile (GlassCard). */
export const GlassCard = memo(function GlassCard(props: TileProps & { icon: ReactNode }) {
	return (
		<TileShell {...props}>
			<TileSurface isDark={props.isDark}>
				<View style={styles.center}>
					<TileIconInterior icon={props.icon} isDark={props.isDark} />
				</View>
				<TileFlag isLive={props.isLive} hasNew={props.hasNew} />
			</TileSurface>
		</TileShell>
	);
});

/** A picture tile (ImageCard). */
export const ImageCard = memo(function ImageCard(props: TileProps & { image: ImageSourcePropType }) {
	return (
		<TileShell {...props}>
			<TileSurface isDark={props.isDark}>
				<Image source={props.image} style={StyleSheet.absoluteFill} contentFit="cover" />
				<TileFlag isLive={props.isLive} hasNew={props.hasNew} />
			</TileSurface>
		</TileShell>
	);
});

/**
 * A tile that cycles through photos (SlideshowCard): the fallback artwork
 * shows until a photo has loaded, then the photos cross-fade every 4 s.
 * Photos load as resized copies, the original when that fails.
 */
export const SlideshowCard = memo(function SlideshowCard(
	props: TileProps & { imageUrls: string[]; fallbackImage?: ImageSourcePropType; fallbackIcon?: ReactNode },
) {
	const { imageUrls, fallbackImage, fallbackIcon, isDark } = props;
	const key = imageUrls.join(",");
	const [valid, setValid] = useState<string[]>([]);
	const [index, setIndex] = useState(0);

	// Which photos load (resized copy first), in the given order.
	useEffect(() => {
		let cancelled = false;
		setValid([]);
		setIndex(0);
		const urls = key ? key.split(",") : [];
		(async () => {
			const ok: string[] = [];
			for (const url of urls) {
				const thumb = thumbUrl(url, THUMB.homeTile);
				let src: string | null = null;
				if (await Image.prefetch(thumb).catch(() => false)) src = thumb;
				else if (thumb !== url && (await Image.prefetch(url).catch(() => false))) src = url;
				if (cancelled) return;
				if (src) {
					ok.push(src);
					setValid([...ok]);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [key]);

	useEffect(() => {
		if (valid.length <= 1) return;
		const t = setInterval(() => setIndex((i) => (i + 1) % valid.length), 4000);
		return () => clearInterval(t);
	}, [valid.length]);

	const showSlideshow = valid.length > 0;
	const safeIndex = valid.length ? index % valid.length : 0;
	const fallbackStyle = useAnimatedStyle(() => ({ opacity: withTiming(showSlideshow ? 0 : 1, { duration: 700 }) }));
	const source = useMemo(() => (showSlideshow ? { uri: valid[safeIndex] } : undefined), [showSlideshow, valid, safeIndex]);

	return (
		<TileShell {...props}>
			<TileSurface isDark={isDark}>
				{source ? (
					<Image
						source={source}
						style={StyleSheet.absoluteFill}
						contentFit="cover"
						transition={{ duration: 800, effect: "cross-dissolve" }}
					/>
				) : null}
				<Animated.View style={[StyleSheet.absoluteFill, styles.center, fallbackStyle]} pointerEvents="none">
					{fallbackImage ? (
						<Image source={fallbackImage} style={StyleSheet.absoluteFill} contentFit="cover" />
					) : fallbackIcon ? (
						<TileIconInterior icon={fallbackIcon} isDark={isDark} />
					) : null}
				</Animated.View>
				{valid.length > 1 ? (
					<View style={styles.dots} pointerEvents="none">
						{valid.map((u, i) => (
							<View key={u} style={i === safeIndex ? styles.dotActive : styles.dot} />
						))}
					</View>
				) : null}
				<TileFlag isLive={props.isLive} hasNew={props.hasNew} />
			</TileSurface>
		</TileShell>
	);
});

const styles = StyleSheet.create({
	tile: { alignItems: "center", gap: 8 },
	pressed: { transform: [{ scale: 0.97 }] },
	surface: {
		width: "100%",
		aspectRatio: 4 / 3,
		borderRadius: TILE_RADIUS,
		borderWidth: 1,
		overflow: "hidden",
		shadowColor: krishna[600],
		shadowOffset: { width: 0, height: 2 },
		shadowRadius: 8,
		elevation: 2,
	},
	keyline: {
		position: "absolute",
		top: 4,
		left: 4,
		right: 4,
		bottom: 4,
		borderRadius: KEYLINE_RADIUS,
		borderWidth: 1,
		zIndex: 10,
	},
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
	iconStack: { alignItems: "center", zIndex: 10 },
	threshold: { width: 32, marginTop: 8 },
	title: { fontSize: 14, lineHeight: 18, letterSpacing: 0.4, textAlign: "center", paddingHorizontal: 4, marginTop: 4 },
	flag: { position: "absolute", top: 8, right: 8, zIndex: 20 },
	live: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: janmashtami.error,
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
	liveText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
	newShadow: { shadowColor: "#EF4444", shadowOpacity: 0.4, shadowRadius: 8, elevation: 4, borderRadius: 999 },
	newPill: {
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderWidth: 1,
		borderColor: "rgba(248,113,113,0.5)",
	},
	newText: { color: "#fff", fontSize: 10, fontWeight: "700" },
	dots: { position: "absolute", bottom: 8, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 4, zIndex: 20 },
	dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,248,231,0.7)" },
	dotActive: { width: 16, height: 6, borderRadius: 3, backgroundColor: gold[300] },
});

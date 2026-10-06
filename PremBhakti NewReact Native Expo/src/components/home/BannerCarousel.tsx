import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedProps, FadeIn, FadeOut } from "react-native-reanimated";
import { useHomeDataStore, type BannerConfig } from "../../store/homeDataStore";
import { useSettingsStore } from "../../store/settingsStore";
import { ink } from "../../theme/colors";
import { THEME_PALETTES } from "../../theme/palettes";

// BannerContainer + Banner of the Capacitor Home: the admins' announcement
// banners, one at a time, auto-advancing every 3 s (5 s after a manual
// change), closable for this session.

const RY_GOLD = "#D4A017";
const dismissed = new Set<string>(); // sessionStorage "dismissedBanners"

function BannerCard({ config, onClose, onAction }: { config: BannerConfig; onClose: () => void; onAction: () => void }) {
	const themeColor = useSettingsStore((s) => s.themeColor);
	const palette = (THEME_PALETTES as Record<string, Record<number, string>>)[config.color || themeColor] ?? THEME_PALETTES.blue;
	return (
		<View style={[styles.banner, { backgroundColor: `${palette[600]}F2` }]}>
			<View style={styles.bannerBody}>
				<Text style={styles.bannerTitle}>{config.title}</Text>
				<Text style={styles.bannerText}>{config.body}</Text>
				{config.actionType && config.actionTarget ? (
					<Pressable onPress={onAction} style={styles.actionButton}>
						<Text style={[styles.actionText, { color: palette[700] }]}>{(config.actionLabel || "View Action").toUpperCase()}</Text>
					</Pressable>
				) : null}
			</View>
			<Pressable onPress={onClose} accessibilityLabel="Close banner" hitSlop={8} style={styles.close}>
				<X size={18} color="#fff" />
			</Pressable>
		</View>
	);
}

export function BannerCarousel({
	active,
	onAction,
	entering,
	style,
}: {
	active: boolean;
	onAction: (b: BannerConfig) => void;
	entering?: AnimatedProps<object>["entering"];
	style?: StyleProp<ViewStyle>;
}) {
	const banners = useHomeDataStore((s) => s.banners);
	const [, setTick] = useState(0);
	const [index, setIndex] = useState(0);
	const [delay, setDelay] = useState(3000);
	const visible = useMemo(() => banners.filter((b) => b.enabled && !dismissed.has(b.id)), [banners, dismissed.size]);
	const current = visible.length ? visible[index % visible.length] : null;

	useEffect(() => {
		if (visible.length <= 1 || !active) return;
		const t = setTimeout(() => {
			setIndex((i) => (i + 1) % visible.length);
			setDelay(3000);
		}, delay);
		return () => clearTimeout(t);
	}, [visible.length, active, index, delay]);

	if (!current) return null;
	const close = (id: string) => {
		dismissed.add(id);
		setTick((t) => t + 1);
	};
	const go = (to: number) => {
		setDelay(5000);
		setIndex((to + visible.length) % visible.length);
	};
	const card = (
		<View style={styles.frame}>
			<Animated.View key={current.id} entering={FadeIn.duration(500)} exiting={FadeOut.duration(300)}>
				<BannerCard config={current} onClose={() => close(current.id)} onAction={() => onAction(current)} />
			</Animated.View>
		</View>
	);

	if (visible.length === 1) {
		return (
			<Animated.View entering={entering} style={[styles.single, style]}>
				{card}
			</Animated.View>
		);
	}
	const safe = index % visible.length;
	return (
		<Animated.View entering={entering} style={[styles.multi, style]}>
			<View style={styles.row}>
				<Pressable onPress={() => go(safe - 1)} accessibilityLabel="Previous banner" style={styles.arrow}>
					<ChevronLeft size={22} color={ink[400]} />
				</Pressable>
				<View style={styles.flex}>{card}</View>
				<Pressable onPress={() => go(safe + 1)} accessibilityLabel="Next banner" style={styles.arrow}>
					<ChevronRight size={22} color={ink[400]} />
				</Pressable>
			</View>
			<View style={styles.dots}>
				{visible.map((b, i) => (
					<Pressable key={b.id} onPress={() => go(i)} hitSlop={6} accessibilityLabel={`Go to banner ${i + 1}`}>
						<View style={[styles.dot, i === safe ? styles.dotActive : null]} />
					</Pressable>
				))}
			</View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	single: { paddingHorizontal: 12, paddingVertical: 8 },
	multi: { paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
	row: { flexDirection: "row", alignItems: "center", gap: 6 },
	arrow: { padding: 4, borderRadius: 8 },
	frame: {
		borderRadius: 16,
		overflow: "hidden",
		borderWidth: 1.5,
		borderColor: "rgba(212,160,23,0.6)",
		shadowColor: "#000",
		shadowOpacity: 0.12,
		shadowRadius: 10,
		elevation: 4,
	},
	banner: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.2)",
	},
	bannerBody: { paddingRight: 24 },
	bannerTitle: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.4 },
	bannerText: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500", marginTop: 4, lineHeight: 19 },
	actionButton: {
		marginTop: 8,
		alignSelf: "flex-start",
		backgroundColor: "#fff",
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 6,
		elevation: 2,
	},
	actionText: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
	close: { position: "absolute", top: 8, right: 8, padding: 6, borderRadius: 999 },
	dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 6 },
	dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(212,160,23,0.3)" },
	dotActive: { width: 32, backgroundColor: RY_GOLD },
});

import { useNavigation } from "@react-navigation/native";
import { Music, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { RootNavigation } from "../navigation/types";
import { useAudioStore } from "../store/audioStore";
import { usePlayerUiStore } from "../store/playerUiStore";
import { ink, janmashtami } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

/**
 * components/MiniPlayer.tsx: the dark bar above the bottom nav with a gold
 * progress line, the playing title and singer, and prev / play / next /
 * repeat / close. Tapping the title opens the bhajan's reader (where the full
 * player lives), as in the Capacitor app.
 */
export function MiniPlayer({ bottom, onAudioTab }: { bottom: number; onAudioTab?: boolean }) {
	const theme = useAppTheme();
	const navigation = useNavigation<RootNavigation>();
	const track = useAudioStore((s) => s.currentTrack);
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const isLoading = useAudioStore((s) => s.isLoading);
	const position = useAudioStore((s) => s.position);
	const duration = useAudioStore((s) => s.duration);
	const repeatMode = useAudioStore((s) => s.repeatMode);
	const queueLength = useAudioStore((s) => s.queue.length);
	const { togglePlay, playNext, playPrevious, toggleRepeat, closePlayer } = useAudioStore.getState();
	const [feedback, setFeedback] = useState<string | null>(null);
	const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => () => clearTimeout(feedbackTimer.current), []);

	if (!track) return null;

	const progress = duration ? Math.min(1, position / duration) : 0;
	const single = queueLength <= 1;

	const onRepeat = () => {
		toggleRepeat();
		const msg = repeatMode === "off" ? "Looping Current Song" : repeatMode === "one" ? "Looping Queue" : "Repeat Off";
		clearTimeout(feedbackTimer.current);
		setFeedback(msg);
		feedbackTimer.current = setTimeout(() => setFeedback(null), 1500);
	};

	// On the Audio tab this restores the docked player; elsewhere it opens the
	// bhajan's reader, or the Audio tab for katha (which has no reader page).
	const expand = () => {
		if (onAudioTab) usePlayerUiStore.getState().setMinimized(false);
		else if (track.parentBhajan) navigation.navigate("Reader", { bhajan: track.parentBhajan });
		else navigation.navigate("Tabs", { screen: "Lectures" });
	};

	return (
		<View style={[styles.wrapper, { bottom }]} pointerEvents="box-none">
			<View
				style={[
					styles.card,
					{ backgroundColor: theme.isDark ? "rgba(0,0,0,0.95)" : "rgba(11, 46, 107, 0.95)" },
				]}
			>
				<View style={styles.track}>
					<View style={[styles.fill, { width: `${progress * 100}%` }]} />
				</View>

				<View style={styles.row}>
					{feedback ? (
						<View style={styles.tooltip} pointerEvents="none">
							<Text style={styles.tooltipText}>{feedback}</Text>
							<View style={styles.tooltipArrow} />
						</View>
					) : null}

					<Pressable style={styles.info} onPress={expand}>
						<View style={styles.art}>
							{isPlaying ? <EqualizerBars /> : <Music size={20} color={janmashtami.deepGold} />}
						</View>
						<View style={styles.text}>
							<Text style={styles.title} numberOfLines={1}>
								{track.bhajanTitle || "Bhajan"}
							</Text>
							<Text style={styles.singer} numberOfLines={1}>
								{track.singer}
							</Text>
						</View>
					</Pressable>

					<View style={styles.controls}>
						<Pressable disabled={single} onPress={playPrevious} style={styles.button} hitSlop={4}>
							<SkipBack size={18} color={single ? ink[600] : ink[300]} fill={single ? ink[600] : ink[300]} />
						</Pressable>
						<Pressable onPress={togglePlay} style={styles.playButton} hitSlop={4}>
							{isLoading ? (
								<ActivityIndicator size="small" color="#fff" />
							) : isPlaying ? (
								<Pause size={20} color="#fff" fill="#fff" />
							) : (
								<Play size={20} color="#fff" fill="#fff" />
							)}
						</Pressable>
						<Pressable disabled={single} onPress={playNext} style={styles.button} hitSlop={4}>
							<SkipForward size={18} color={single ? ink[600] : ink[300]} fill={single ? ink[600] : ink[300]} />
						</Pressable>
						<Pressable onPress={onRepeat} style={styles.button} hitSlop={4}>
							{repeatMode === "one" ? (
								<Repeat1 size={16} color={janmashtami.deepGold} />
							) : (
								<Repeat size={16} color={repeatMode === "all" ? janmashtami.deepGold : ink[500]} />
							)}
						</Pressable>
						<Pressable onPress={closePlayer} style={styles.button} hitSlop={4}>
							<X size={18} color={ink[400]} />
						</Pressable>
					</View>
				</View>
			</View>
		</View>
	);
}

/** The three bouncing gold bars shown while audio plays (animate-audio-bar). */
function EqualizerBars() {
	const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

	useEffect(() => {
		const loops = bars.map((v, i) =>
			Animated.loop(
				Animated.sequence([
					Animated.timing(v, { toValue: 1, duration: 400 + i * 120, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
					Animated.timing(v, { toValue: 0.3, duration: 400 + i * 120, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
				]),
			),
		);
		for (const l of loops) l.start();
		return () => {
			for (const l of loops) l.stop();
		};
	}, [bars]);

	return (
		<View style={styles.bars}>
			{bars.map((v, i) => (
				<Animated.View key={i} style={[styles.bar, { transform: [{ scaleY: v }] }]} />
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	wrapper: { position: "absolute", left: 8, right: 8, zIndex: 40 },
	card: {
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(212, 160, 23, 0.4)",
		elevation: 16,
		shadowColor: "#000",
		shadowOpacity: 0.35,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
	},
	track: {
		height: 4,
		backgroundColor: "rgba(0,0,0,0.4)",
		borderTopLeftRadius: 12,
		borderTopRightRadius: 12,
		overflow: "hidden",
	},
	fill: { height: "100%", backgroundColor: janmashtami.deepGold },
	row: { flexDirection: "row", alignItems: "center", padding: 8, paddingLeft: 12 },
	info: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
	art: {
		width: 40,
		height: 40,
		borderRadius: 8,
		backgroundColor: "rgba(0,0,0,0.4)",
		alignItems: "center",
		justifyContent: "center",
	},
	text: { flex: 1, minWidth: 0 },
	title: { color: "#fff", fontSize: 14, fontWeight: "700" },
	singer: { color: ink[400], fontSize: 12 },
	controls: { flexDirection: "row", alignItems: "center", gap: 2 },
	button: { padding: 8, borderRadius: 20 },
	playButton: { padding: 10, borderRadius: 22, minWidth: 40, alignItems: "center" },
	tooltip: {
		position: "absolute",
		bottom: "100%",
		right: 16,
		marginBottom: 8,
		paddingHorizontal: 12,
		paddingVertical: 6,
		backgroundColor: janmashtami.deepGold,
		borderRadius: 8,
		zIndex: 50,
	},
	tooltipText: { color: "#fff", fontSize: 10, fontWeight: "700" },
	tooltipArrow: {
		position: "absolute",
		bottom: -4,
		right: 32,
		width: 8,
		height: 8,
		backgroundColor: janmashtami.deepGold,
		transform: [{ rotate: "45deg" }],
	},
	bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 16 },
	bar: { width: 4, height: 16, borderRadius: 2, backgroundColor: janmashtami.deepGold, transformOrigin: "bottom" },
});

import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
	ChevronDown,
	ListMusic,
	Music,
	Pause,
	Play,
	PlayCircle,
	Repeat,
	Repeat1,
	RotateCcw,
	RotateCw,
	SkipBack,
	SkipForward,
	User,
	X,
} from "lucide-react-native";
import { useRef, useState } from "react";
import {
	ActivityIndicator,
	type GestureResponderEvent,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { triggerHaptic } from "../lib/haptics";
import type { RootNavigation } from "../navigation/types";
import { useAudioStore } from "../store/audioStore";
import { ink } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import { TrackDownloadButton } from "./AudioListParts";

const pad = (n: number) => n.toString().padStart(2, "0");
// AudioScreen's formatTime: always mm:ss.
const formatTime = (s: number) => (!s || Number.isNaN(s) ? "00:00" : `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`);

/**
 * The Audio tab's docked player (AudioScreen.tsx "Bottom Player Section"):
 * prev / title (opens the bhajan) / next, then repeat, −10s, play, +10s,
 * queue, other singers and download, then the seek bar. The chevron
 * minimises it to the regular mini player.
 */
export function AudioPlayerPanel({ bottom, isHindi, onMinimize }: { bottom: number; isHindi: boolean; onMinimize: () => void }) {
	const theme = useAppTheme();
	const navigation = useNavigation<RootNavigation>();
	const track = useAudioStore((s) => s.currentTrack);
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const isLoading = useAudioStore((s) => s.isLoading);
	const position = useAudioStore((s) => s.position);
	const duration = useAudioStore((s) => s.duration);
	const repeatMode = useAudioStore((s) => s.repeatMode);
	const { togglePlay, seek, playNext, playPrevious, toggleRepeat } = useAudioStore.getState();
	const [showQueue, setShowQueue] = useState(false);
	const [showSingers, setShowSingers] = useState(false);
	const [dragRatio, setDragRatio] = useState<number | null>(null);
	const barWidth = useRef(1);

	if (!track) return null;

	const hasBhajan = !!track.parentBhajan?.content && !track.parentBhajan.id.startsWith("lecture_");
	const total = duration || 1;
	const ratio = dragRatio ?? Math.min(1, position / total);
	const muted = theme.isDark ? ink[500] : ink[400];
	const ratioFrom = (e: GestureResponderEvent) => Math.min(1, Math.max(0, e.nativeEvent.locationX / barWidth.current));
	const skip = (delta: number) => {
		triggerHaptic("light");
		seek(Math.min(duration, Math.max(0, position + delta)));
	};

	return (
		<View
			style={[
				styles.panel,
				{
					bottom,
					backgroundColor: theme.isDark ? ink[900] : "#ffffff",
					borderTopColor: theme.isDark ? ink[800] : theme.p[200],
				},
			]}
		>
			<Pressable accessibilityLabel="Minimize Player" onPress={onMinimize} style={styles.minimize}>
				<ChevronDown size={22} color={ink[400]} />
			</Pressable>

			<View style={styles.infoRow}>
				<Pressable
					accessibilityLabel="Previous"
					onPress={() => {
						triggerHaptic("light");
						playPrevious();
					}}
					style={styles.skip}
				>
					<SkipBack size={24} color={muted} fill={muted} />
				</Pressable>
				<Pressable
					style={styles.titleBox}
					onPress={() => {
						if (track.parentBhajan) navigation.navigate("Reader", { bhajan: track.parentBhajan });
					}}
				>
					<View style={styles.titleLine}>
						{isPlaying ? <Bars color={theme.p[500]} /> : null}
						<Text
							style={[styles.title, { color: hasBhajan ? (theme.isDark ? theme.p[400] : theme.p[600]) : theme.isDark ? "#fff" : ink[800] }]}
							numberOfLines={1}
						>
							{track.bhajanTitle || "No Audio Playing"}
						</Text>
					</View>
					<Text
						style={[styles.singer, { color: hasBhajan ? (theme.isDark ? theme.p[300] : theme.p[500]) : theme.isDark ? ink[400] : ink[500] }]}
						numberOfLines={1}
					>
						{track.singer || "Select a track to play"}
					</Text>
				</Pressable>
				<Pressable
					accessibilityLabel="Next"
					onPress={() => {
						triggerHaptic("light");
						playNext();
					}}
					style={styles.skip}
				>
					<SkipForward size={24} color={muted} fill={muted} />
				</Pressable>
			</View>

			<View style={styles.controls}>
				<Pressable accessibilityLabel="Repeat" onPress={toggleRepeat} style={styles.control}>
					{repeatMode === "one" ? (
						<Repeat1 size={18} color={theme.isDark ? theme.p[400] : theme.p[600]} />
					) : (
						<Repeat size={18} color={repeatMode === "all" ? (theme.isDark ? theme.p[400] : theme.p[600]) : muted} />
					)}
				</Pressable>
				<Pressable accessibilityLabel="Back 10 seconds" onPress={() => skip(-10)} style={styles.control}>
					<RotateCcw size={18} color={theme.isDark ? ink[400] : ink[500]} />
				</Pressable>
				<Pressable
					accessibilityLabel={isPlaying ? "Pause" : "Play"}
					onPress={() => {
						triggerHaptic("medium");
						togglePlay();
					}}
					style={[styles.play, { backgroundColor: theme.p[500] }]}
				>
					{isLoading ? (
						<ActivityIndicator color="#fff" />
					) : isPlaying ? (
						<Pause size={20} color="#fff" fill="#fff" />
					) : (
						<Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
					)}
				</Pressable>
				<Pressable accessibilityLabel="Forward 10 seconds" onPress={() => skip(10)} style={styles.control}>
					<RotateCw size={18} color={theme.isDark ? ink[400] : ink[500]} />
				</Pressable>
				<Pressable accessibilityLabel="Queue" onPress={() => setShowQueue(true)} style={styles.control}>
					<ListMusic size={18} color={showQueue ? theme.p[600] : muted} />
				</Pressable>
				{(track.parentBhajan?.audio?.length ?? 0) > 1 ? (
					<Pressable accessibilityLabel="Select Singer" onPress={() => setShowSingers(true)} style={styles.control}>
						<User size={18} color={theme.isDark ? theme.p[400] : theme.p[500]} />
					</Pressable>
				) : null}
				<TrackDownloadButton
					track={track}
					title={track.bhajanTitle || "Audio Track"}
					parent={track.parentBhajan}
					category={hasBhajan ? "audio" : "lecture"}
				/>
			</View>

			<View style={styles.progressRow}>
				<Text style={[styles.time, styles.timeLeft, { color: theme.isDark ? ink[400] : ink[500] }]}>{formatTime(ratio * total)}</Text>
				<View
					onLayout={(e) => {
						barWidth.current = e.nativeEvent.layout.width || 1;
					}}
					hitSlop={{ top: 14, bottom: 14 }}
					onStartShouldSetResponder={() => !!duration}
					onMoveShouldSetResponder={() => !!duration}
					onResponderGrant={(e) => setDragRatio(ratioFrom(e))}
					onResponderMove={(e) => setDragRatio(ratioFrom(e))}
					onResponderRelease={(e) => {
						seek(ratioFrom(e) * duration);
						setDragRatio(null);
					}}
					onResponderTerminate={() => setDragRatio(null)}
					style={[styles.bar, { backgroundColor: theme.isDark ? ink[700] : theme.p[100], borderColor: theme.isDark ? ink[600] : theme.p[200] }]}
				>
					<LinearGradient
						colors={[theme.p[400], theme.p[600]]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						pointerEvents="none"
						style={[styles.barFill, { width: `${ratio * 100}%` }]}
					/>
				</View>
				<Text style={[styles.time, { color: theme.isDark ? ink[400] : ink[500] }]}>{formatTime(total)}</Text>
			</View>

			<QueueModal visible={showQueue} onClose={() => setShowQueue(false)} theme={theme} />
			<SingerModal visible={showSingers} onClose={() => setShowSingers(false)} theme={theme} isHindi={isHindi} />
		</View>
	);
}

function Bars({ color }: { color: string }) {
	return (
		<View style={styles.bars}>
			<View style={[styles.barSeg, { height: 8, backgroundColor: color }]} />
			<View style={[styles.barSeg, { height: 14, backgroundColor: color }]} />
			<View style={[styles.barSeg, { height: 10, backgroundColor: color }]} />
		</View>
	);
}

function QueueModal({ visible, onClose, theme }: { visible: boolean; onClose: () => void; theme: AppTheme }) {
	const queue = useAudioStore((s) => s.queue);
	const currentId = useAudioStore((s) => s.currentTrack?.id);
	const playQueueTrack = useAudioStore((s) => s.playQueueTrack);
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
			<Pressable style={styles.scrim} onPress={onClose}>
				<Pressable style={[styles.card, { backgroundColor: theme.card, borderColor: theme.isDark ? ink[700] : theme.p[200] }]} onPress={() => {}}>
					<View style={styles.cardHead}>
						<View style={styles.row}>
							<ListMusic size={20} color={theme.isDark ? theme.p[400] : theme.p[600]} />
							<Text style={[styles.cardTitle, { color: theme.isDark ? theme.p[400] : theme.p[600] }]}>Current Queue</Text>
						</View>
						<Pressable accessibilityLabel="Close" onPress={onClose} style={{ padding: 4 }}>
							<X size={20} color={ink[400]} />
						</Pressable>
					</View>
					<ScrollView contentContainerStyle={{ gap: 8 }}>
						{queue.length === 0 ? (
							<Text style={styles.empty}>Queue is empty</Text>
						) : (
							queue.map((t, i) => {
								const current = t.id === currentId;
								return (
									<Pressable
										key={`${t.id}-${i}`}
										onPress={() => {
											triggerHaptic("medium");
											playQueueTrack(i);
										}}
										style={[
											styles.queueRow,
											current
												? { backgroundColor: theme.isDark ? "rgba(22,48,92,0.5)" : theme.p[50], borderColor: theme.isDark ? ink[600] : theme.p[200] }
												: null,
										]}
									>
										<View style={[styles.queueIndex, { backgroundColor: current ? theme.p[500] : theme.isDark ? ink[700] : ink[200] }]}>
											<Text style={[styles.queueIndexText, { color: current ? "#fff" : theme.isDark ? ink[300] : ink[500] }]}>{i + 1}</Text>
										</View>
										<View style={{ flex: 1, minWidth: 0 }}>
											<Text
												style={[styles.queueTitle, { color: current ? (theme.isDark ? theme.p[400] : theme.p[700]) : theme.isDark ? ink[300] : ink[700] }]}
												numberOfLines={1}
											>
												{t.bhajanTitle}
											</Text>
											<Text style={[styles.queueSinger, { color: theme.isDark ? ink[300] : ink[500] }]} numberOfLines={1}>
												{t.singer}
											</Text>
										</View>
										{current ? <View style={[styles.dot, { backgroundColor: theme.p[500] }]} /> : null}
									</Pressable>
								);
							})
						)}
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function SingerModal({ visible, onClose, theme, isHindi }: { visible: boolean; onClose: () => void; theme: AppTheme; isHindi: boolean }) {
	const track = useAudioStore((s) => s.currentTrack);
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const playTrack = useAudioStore((s) => s.playTrack);
	const bhajan = track?.parentBhajan;
	if (!track || !bhajan?.audio) return null;
	const title = track.bhajanTitle;

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
			<Pressable style={styles.scrim} onPress={onClose}>
				<Pressable style={[styles.card, { backgroundColor: theme.card, borderColor: theme.isDark ? ink[700] : theme.p[200] }]} onPress={() => {}}>
					<View style={styles.cardHead}>
						<Text style={[styles.cardTitle, { color: theme.isDark ? theme.p[400] : theme.p[600] }]}>
							{isHindi ? "उपलब्ध ऑडियो" : "Available Audio"}
						</Text>
						<Pressable accessibilityLabel="Close" onPress={onClose} style={{ padding: 4 }}>
							<X size={20} color={ink[400]} />
						</Pressable>
					</View>
					<ScrollView contentContainerStyle={{ gap: 8 }}>
						{bhajan.audio.map((t, idx) => {
							const current = t.id === track.id;
							return (
								<View
									key={t.id}
									style={[
										styles.singerRow,
										current
											? { backgroundColor: theme.isDark ? ink[700] : theme.p[50], borderColor: theme.isDark ? theme.p[500] : theme.p[200] }
											: { backgroundColor: theme.isDark ? "rgba(7,21,41,0.5)" : ink[50], borderColor: "transparent" },
									]}
								>
									<Pressable
										style={styles.singerMain}
										onPress={() => {
											triggerHaptic("medium");
											const all = bhajan.audio ?? [];
											playTrack(t, title, bhajan, [...all.slice(idx), ...all.slice(0, idx)], "Song List");
											onClose();
										}}
									>
										<View style={[styles.singerIcon, { backgroundColor: theme.isDark && !current ? ink[700] : theme.p[100] }]}>
											{current ? (
												isPlaying ? (
													<Bars color="#B08313" />
												) : (
													<Music size={20} color={theme.p[600]} />
												)
											) : (
												<PlayCircle size={20} color={theme.isDark ? theme.p[400] : theme.p[600]} />
											)}
										</View>
										<View style={{ flex: 1 }}>
											<Text
												style={[styles.singerName, { color: current ? (theme.isDark ? theme.p[400] : theme.p[700]) : theme.isDark ? ink[200] : ink[700] }]}
											>
												{t.singer?.replace(/\s+\)/g, ")") || (isHindi ? "अज्ञात गायक" : "Unknown Singer")}
											</Text>
											<Text style={styles.singerTime}>{formatTime(t.duration || 0)}</Text>
										</View>
									</Pressable>
									<TrackDownloadButton track={t} title={title || "Audio Track"} parent={bhajan} size={20} />
								</View>
							);
						})}
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	panel: {
		position: "absolute",
		left: 0,
		right: 0,
		zIndex: 30,
		padding: 12,
		borderTopWidth: 1,
		elevation: 12,
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowRadius: 20,
		shadowOffset: { width: 0, height: -4 },
	},
	minimize: { position: "absolute", top: 4, right: 8, padding: 6, zIndex: 10 },
	infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 16, paddingHorizontal: 4 },
	skip: { padding: 8 },
	titleBox: { flex: 1, alignItems: "center", marginHorizontal: 8, minWidth: 0 },
	titleLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2, maxWidth: "100%" },
	title: { fontSize: 18, fontWeight: "700", flexShrink: 1 },
	singer: { fontSize: 12 },
	controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 },
	control: { padding: 8 },
	play: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", elevation: 4 },
	progressRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginTop: 8 },
	time: { fontSize: 10, fontWeight: "700", width: 34 },
	timeLeft: { textAlign: "right" },
	bar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden", borderWidth: 1 },
	barFill: { position: "absolute", left: 0, top: 0, bottom: 0 },
	bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 16 },
	barSeg: { width: 4, borderRadius: 2 },
	scrim: { flex: 1, backgroundColor: "rgba(7,21,41,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
	card: { width: "100%", maxWidth: 448, maxHeight: "80%", borderRadius: 24, padding: 20, borderWidth: 1, elevation: 24 },
	cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
	row: { flexDirection: "row", alignItems: "center", gap: 8 },
	cardTitle: { fontSize: 18, fontWeight: "700" },
	empty: { textAlign: "center", paddingVertical: 32, color: ink[400] },
	queueRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
	queueIndex: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
	queueIndexText: { fontSize: 12, fontWeight: "700" },
	queueTitle: { fontSize: 14, fontWeight: "700" },
	queueSinger: { fontSize: 12 },
	dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
	singerRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1 },
	singerMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
	singerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
	singerName: { fontSize: 14, fontWeight: "700" },
	singerTime: { fontSize: 12, color: ink[400], marginTop: 2 },
});

import { useNavigation } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	ArrowLeft,
	BookOpen,
	Check,
	CheckSquare,
	Download,
	Hash,
	Layout,
	Link,
	Maximize,
	Moon,
	Music,
	Pause,
	Play,
	PlayCircle,
	Plus,
	RotateCcw,
	RotateCw,
	Share2,
	Square,
	Star,
	Sun,
	Type,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated as RNAnimated,
	Modal,
	Pressable,
	ScrollView as RNScrollView,
	Share,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground } from "../components/PaperBackground";
import { RangeSlider } from "../components/RangeSlider";
import { useScrollbarSideStyles } from "../components/SideScrollView";
import { triggerHaptic } from "../lib/haptics";
import { webGet } from "../lib/webStore";
import type { RootNavigation } from "../navigation/types";
import { authorDisplayName, useAppConfigStore } from "../store/appConfigStore";
import { type QueueTrack, useAudioStore } from "../store/audioStore";
import { useContentStore } from "../store/contentStore";
import { useDownloadStore } from "../store/downloadStore";
import { addToHistory } from "../store/historyStore";
import { usePlaylistStore } from "../store/playlistStore";
import { MAX_FONT_SIZE, MIN_FONT_SIZE, useSettingsStore, type ViewFormat } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import { ink, serif } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import type { Bhajan, BhajanAudio } from "../types";

// Native rebuild of components/BhajanReader.tsx: the saffron header with
// view-format / text-size / theme controls, a title bar that slides in once
// the title scrolls away, pinch-to-resize text, Book Mode (pinch-zoom + pan
// of the whole page), save-to-playlist and share, and audio — "Play Audio"
// or "Select Audio" with per-singer download, plus the floating mini
// controls while this bhajan is playing.

const KEEP_AWAKE_TAG = "bhajan-reader";
const HEADER_HEIGHT = 64;
const VIEW_FORMATS: ViewFormat[] = ["center", "left", "justify", "wide-center", "wide-left"];
const VIEW_ICONS = { center: AlignCenter, left: AlignLeft, justify: AlignJustify, "wide-center": Maximize, "wide-left": Layout };

interface Props {
	bhajan: Bhajan;
	/**
	 * Opened from a full bhajan list (Bhajans tab, Authors): play with every
	 * bhajan queued under this name, e.g. "Song List".
	 */
	listQueueName?: string;
	onBack: () => void;
}

type Line = { key: number; kind: "gap" | "subheading" | "line" | "line-end"; text: string };

// renderFormattedContent: "#…#" lines are subheadings, "।।" becomes "॥", and
// a danda never wraps onto its own line.
function formatContent(content: string): Line[] {
	return content.split("\n").map((line, key) => {
		const trimmed = line.trim();
		if (!trimmed) return { key, kind: "gap", text: "" };
		const clean = (s: string) => s.replace(/।।/g, "॥").replace(/\s+([।॥])/g, " $1");
		if (trimmed.startsWith("#") && trimmed.endsWith("#") && trimmed.length > 1) {
			return { key, kind: "subheading", text: clean(trimmed.slice(1, -1).trim()) };
		}
		const text = clean(trimmed);
		return { key, kind: text.includes("॥") ? "line-end" : "line", text };
	});
}

export function BhajanReaderScreen({ bhajan, listQueueName, onBack }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const scrollSide = useScrollbarSideStyles();
	const navigation = useNavigation<RootNavigation>();
	const settings = useSettingsStore();
	const { fontSize, lineGap, viewFormat, bookMode, script, keepAwake } = settings;
	const isHindi = settings.settingsLanguage === "hi";
	const knownAuthors = useAppConfigStore((s) => s.knownAuthors);
	const currentTrack = useAudioStore((s) => s.currentTrack);
	const [showFontPanel, setShowFontPanel] = useState(false);
	const [showPlaylists, setShowPlaylists] = useState(false);
	const [showShare, setShowShare] = useState(false);
	const [showAudioList, setShowAudioList] = useState(false);
	const titleBar = useRef(new RNAnimated.Value(0)).current;
	const titleBarShown = useRef(false);

	// Katha pages are recorded as lectures by their route instead.
	useEffect(() => {
		if (!bhajan.id.startsWith("lecture_")) addToHistory(bhajan.id, "song");
	}, [bhajan.id]);

	// "Keep Screen Awake" applies while a bhajan is open.
	useEffect(() => {
		if (!keepAwake) return;
		activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
		return () => {
			deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
		};
	}, [keepAwake]);

	const iast = script === "iast";
	// A devotee's own version of this bhajan (cpbs_personal_<id>, kept from older app versions) wins, as in BhajanReader.
	const personal = useMemo(() => {
		try {
			const saved = JSON.parse(webGet(`cpbs_personal_${bhajan.id}`) || "null");
			return saved && typeof saved === "object" ? (saved as { title?: string; content?: string }) : null;
		} catch {
			return null;
		}
	}, [bhajan.id]);
	const title = personal?.title || (iast ? bhajan.titleIAST || bhajan.title : bhajan.title);
	const content = personal?.content || (iast ? bhajan.contentIAST || bhajan.content : bhajan.content);
	const author = authorDisplayName(knownAuthors, bhajan.author, bhajan.authorIAST, iast);
	const lines = useMemo(() => formatContent(content), [content]);
	const isLeft = viewFormat.includes("left");
	const align = isLeft ? "left" : viewFormat === "justify" ? "justify" : "center";
	const isLiked = usePlaylistStore((s) => s.playlists.some((p) => p.items.includes(bhajan.id)));
	const isPlayingHere = !!currentTrack && !!bhajan.audio?.some((a) => a.id === currentTrack.id);
	const ViewIcon = VIEW_ICONS[viewFormat];
	const iconColor = theme.isDark ? ink[300] : ink[500];

	const onScroll = (y: number) => {
		const show = y > 60;
		if (show === titleBarShown.current) return;
		titleBarShown.current = show;
		RNAnimated.timing(titleBar, { toValue: show ? 1 : 0, duration: 300, useNativeDriver: true }).start();
	};

	// ── Pinch: text size (+ line gap) normally, page zoom in Book Mode ──────
	const pinchStart = useRef({ size: fontSize, gap: lineGap });
	const textPinch = Gesture.Pinch()
		.runOnJS(true)
		.onStart(() => {
			pinchStart.current = { size: useSettingsStore.getState().fontSize, gap: useSettingsStore.getState().lineGap };
		})
		.onUpdate((e) => {
			const size = Math.round(Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, pinchStart.current.size * e.scale)));
			if (size !== useSettingsStore.getState().fontSize) settings.setFontSize(size);
			const gap = Math.round(Math.max(0, Math.min(16, pinchStart.current.gap * e.scale)));
			if (gap !== useSettingsStore.getState().lineGap) settings.setLineGap(gap);
		});
	const nativeScroll = Gesture.Native();

	const scale = useSharedValue(1);
	const savedScale = useSharedValue(1);
	const tx = useSharedValue(0);
	const ty = useSharedValue(0);
	const savedTx = useSharedValue(0);
	const savedTy = useSharedValue(0);
	const [zoomPercent, setZoomPercent] = useState(100);
	const bookPinch = Gesture.Pinch()
		.onStart(() => {
			savedScale.value = scale.value;
		})
		.onUpdate((e) => {
			scale.value = Math.max(1, Math.min(4, savedScale.value * e.scale));
		})
		.onEnd(() => {
			runOnJS(setZoomPercent)(Math.round(scale.value * 100));
		});
	const bookPan = Gesture.Pan()
		.onStart(() => {
			savedTx.value = tx.value;
			savedTy.value = ty.value;
		})
		.onUpdate((e) => {
			tx.value = savedTx.value + e.translationX;
			ty.value = savedTy.value + e.translationY;
		});
	const bookStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
	}));
	const setZoom = (next: number) => {
		triggerHaptic("light");
		scale.value = withTiming(next);
		setZoomPercent(Math.round(next * 100));
		if (next === 1) {
			tx.value = withTiming(0);
			ty.value = withTiming(0);
		}
	};
	const toggleBookMode = () => {
		triggerHaptic("light");
		settings.setBookMode(!bookMode);
		scale.value = 1;
		tx.value = 0;
		ty.value = 0;
		setZoomPercent(100);
	};

	const openAudioScreen = () => {
		triggerHaptic("light");
		onBack();
		setTimeout(() => navigation.navigate("Tabs", { screen: "Lectures" }), 50);
	};

	const page = (
		<View style={[styles.page, viewFormat.startsWith("wide") ? null : styles.pageNarrow]}>
			<View style={[styles.titleBlock, { alignItems: isLeft ? "flex-start" : "center" }]}>
				<View style={styles.metaRow}>
					<Text style={[styles.metaAuthor, { color: theme.isDark ? ink[400] : ink[500] }]} numberOfLines={1}>
						{(author || "").toUpperCase()}
					</Text>
					<View style={[styles.numberPill, { backgroundColor: theme.isDark ? "rgba(15,34,66,0.6)" : ink[100] }]}>
						<Text style={[styles.numberText, { color: theme.isDark ? ink[400] : ink[500] }]}>{bhajan.songNumber ?? bhajan.id}</Text>
					</View>
				</View>
				<Text style={[styles.title, { color: theme.isDark ? theme.p[400] : theme.p[700], textAlign: isLeft ? "left" : "center" }]}>
					{title}
				</Text>
			</View>
			<View style={[styles.titleRule, { backgroundColor: theme.isDark ? ink[800] : theme.p[200], alignSelf: isLeft ? "flex-start" : "center" }]} />

			{lines.map((line) => {
				if (line.kind === "gap") return <View key={line.key} style={styles.gap} />;
				if (line.kind === "subheading") {
					return (
						<View key={line.key} style={[styles.subRow, { justifyContent: isLeft ? "flex-start" : "center" }]}>
							<View
								style={[
									styles.subBox,
									theme.isDark
										? { backgroundColor: ink[900], borderColor: theme.p[500] }
										: { backgroundColor: theme.p[50], borderColor: theme.p[400] },
								]}
							>
								<Text style={[styles.subText, { color: theme.isDark ? theme.p[500] : theme.p[800] }]}>{line.text}</Text>
							</View>
						</View>
					);
				}
				const end = line.kind === "line-end";
				return (
					<Text
						key={line.key}
						style={[
							styles.line,
							{
								textAlign: align,
								color: theme.isDark ? ink[200] : ink[800],
								fontSize,
								lineHeight: fontSize * Math.max(1.6, 1.5 + (fontSize - 20) * 0.02),
								paddingBottom: end ? 4 : lineGap * 4,
								marginBottom: end ? lineGap * 4 + 4 : 0,
								borderBottomWidth: end ? 1.5 : 0,
								borderBottomColor: theme.isDark ? theme.p[600] : theme.p[400],
							},
						]}
					>
						{line.text}
					</Text>
				);
			})}

			<View style={styles.footer}>
				<Text style={[styles.signature, { color: theme.isDark ? theme.p[400] : theme.p[500] }]}>RadheShyam</Text>
				<View style={[styles.footerPill, { backgroundColor: theme.isDark ? ink[800] : ink[100] }]}>
					<Hash size={14} color={theme.isDark ? ink[500] : ink[400]} />
					<Text style={[styles.footerNumber, { color: theme.isDark ? ink[500] : ink[400] }]}>{bhajan.songNumber ?? bhajan.id}</Text>
				</View>
			</View>
		</View>
	);

	return (
		<View style={styles.flex}>
			<PaperBackground />

			{/* Header bar */}
			<LinearGradient
				colors={[theme.p[500], "#f97316"]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.header, { paddingTop: 8 + insets.top }]}
			>
				<Pressable accessibilityLabel="Back" onPress={onBack} style={styles.backButton}>
					<ArrowLeft size={24} color={theme.isDark ? ink[200] : ink[700]} />
				</Pressable>
				<View style={styles.headerActions}>
					<Pressable
						accessibilityLabel="Text alignment"
						onPress={() => {
							triggerHaptic("light");
							settings.setViewFormat(VIEW_FORMATS[(VIEW_FORMATS.indexOf(viewFormat) + 1) % VIEW_FORMATS.length]);
						}}
						style={styles.headerButton}
					>
						<ViewIcon size={22} color={iconColor} />
					</Pressable>
					<Pressable
						accessibilityLabel="Text size"
						onPress={() => {
							triggerHaptic("light");
							setShowFontPanel(!showFontPanel);
						}}
						style={styles.headerButton}
					>
						<Type size={22} color={showFontPanel ? theme.p[500] : iconColor} />
					</Pressable>
					<Pressable
						accessibilityLabel="Toggle dark mode"
						onPress={() => {
							triggerHaptic("light");
							settings.setThemeMode(theme.isDark ? "light" : "dark");
						}}
						style={styles.headerButton}
					>
						{theme.isDark ? <Sun size={22} color={iconColor} /> : <Moon size={22} color={iconColor} />}
					</Pressable>
				</View>
			</LinearGradient>

			<View style={styles.flex}>
				{/* Title bar that slides in from under the header once scrolled. */}
				<RNAnimated.View
					pointerEvents="none"
					style={[
						styles.titleBar,
						{
							backgroundColor: theme.isDark ? "rgba(7,21,41,0.95)" : "rgba(255,255,255,0.95)",
							borderBottomColor: theme.isDark ? ink[800] : ink[200],
							opacity: titleBar,
							transform: [{ translateY: titleBar.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] }) }],
						},
					]}
				>
					{author ? (
						<Text style={[styles.titleBarAuthor, { color: theme.isDark ? theme.p[400] : theme.p[600] }]} numberOfLines={1}>
							{author.toUpperCase()}
						</Text>
					) : null}
					<Text style={[styles.titleBarTitle, { color: theme.isDark ? ink[100] : ink[800] }]} numberOfLines={1}>
						{title}
					</Text>
				</RNAnimated.View>

				{bookMode ? (
					<GestureDetector gesture={Gesture.Simultaneous(bookPinch, bookPan)}>
						<View style={[styles.flex, styles.clip]} onTouchStart={() => setShowFontPanel(false)}>
							<Animated.View style={bookStyle}>{page}</Animated.View>
						</View>
					</GestureDetector>
				) : (
					<GestureDetector gesture={Gesture.Simultaneous(textPinch, nativeScroll)}>
						<ScrollView
							style={scrollSide.style}
							onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
							scrollEventThrottle={32}
							onTouchStart={() => setShowFontPanel(false)}
							contentContainerStyle={[{ paddingBottom: 128 + insets.bottom }, scrollSide.contentContainerStyle]}
						>
							{page}
						</ScrollView>
					</GestureDetector>
				)}

				{showFontPanel ? (
					<FontPanel
						theme={theme}
						fontSize={fontSize}
						lineGap={lineGap}
						bookMode={bookMode}
						onFontSize={settings.setFontSize}
						onLineGap={settings.setLineGap}
						onToggleBookMode={toggleBookMode}
					/>
				) : null}

				{bookMode ? (
					<View style={[styles.zoomBar, floatCard(theme), { bottom: (isPlayingHere ? 144 : 96) + insets.bottom }]}>
						<Pressable onPress={() => setZoom(Math.max(1, scale.value - 0.5))} style={styles.zoomButton}>
							<ZoomOut size={20} color={theme.isDark ? ink[300] : ink[600]} />
						</Pressable>
						<Text style={[styles.zoomText, { color: theme.isDark ? ink[200] : ink[800] }]}>{zoomPercent}%</Text>
						<Pressable onPress={() => setZoom(Math.min(4, scale.value + 0.5))} style={styles.zoomButton}>
							<ZoomIn size={20} color={theme.isDark ? ink[300] : ink[600]} />
						</Pressable>
						<View style={[styles.zoomDivider, { backgroundColor: theme.isDark ? ink[700] : ink[200] }]} />
						<Pressable onPress={() => setZoom(1)} style={styles.zoomButton}>
							<RotateCcw size={18} color={ink[400]} />
						</Pressable>
					</View>
				) : null}

				{isPlayingHere ? <PlayingPill theme={theme} bottom={80 + insets.bottom} onOpenAudioScreen={openAudioScreen} /> : null}

				{/* Save to playlist + share */}
				<View style={[styles.leftActions, { bottom: 24 + insets.bottom }]}>
					<Pressable
						accessibilityLabel="Save to playlist"
						onPress={() => {
							triggerHaptic("light");
							setShowPlaylists(true);
						}}
						style={[
							styles.roundAction,
							isLiked
								? { backgroundColor: theme.isDark ? "rgba(120,53,15,0.3)" : "#fffbeb" }
								: { backgroundColor: theme.isDark ? ink[800] : "#fff" },
						]}
					>
						<Star size={22} color={isLiked ? "#f59e0b" : theme.isDark ? ink[300] : ink[500]} fill={isLiked ? "#f59e0b" : "none"} />
					</Pressable>
					<Pressable
						accessibilityLabel="Share"
						onPress={() => {
							triggerHaptic("light");
							setShowShare(true);
						}}
						style={[styles.roundAction, { backgroundColor: theme.isDark ? ink[800] : "#fff" }]}
					>
						<Share2 size={22} color={theme.isDark ? ink[300] : ink[500]} />
					</Pressable>
				</View>

				{bhajan.audio?.length ? (
					<View style={[styles.rightActions, { bottom: 24 + insets.bottom }]}>
						<AudioButton
							bhajan={bhajan}
							title={title}
							listQueueName={listQueueName}
							theme={theme}
							isHindi={isHindi}
							onOpenList={() => {
								triggerHaptic("light");
								setShowAudioList(true);
							}}
						/>
					</View>
				) : null}
			</View>

			<AudioListModal
				visible={showAudioList}
				onClose={() => setShowAudioList(false)}
				bhajan={bhajan}
				title={title}
				listQueueName={listQueueName}
				theme={theme}
				isHindi={isHindi}
			/>
			<PlaylistModal visible={showPlaylists} onClose={() => setShowPlaylists(false)} bhajanId={bhajan.id} theme={theme} isHindi={isHindi} />
			<ShareModal
				visible={showShare}
				onClose={() => setShowShare(false)}
				bhajan={bhajan}
				title={title}
				content={content}
				author={author}
				theme={theme}
				isHindi={isHindi}
			/>
		</View>
	);
}

const floatCard = (theme: AppTheme) => ({
	backgroundColor: theme.isDark ? "rgba(7,21,41,0.97)" : "rgba(255,255,255,0.97)",
	borderColor: theme.isDark ? ink[800] : ink[200],
});

function FontPanel({
	theme,
	fontSize,
	lineGap,
	bookMode,
	onFontSize,
	onLineGap,
	onToggleBookMode,
}: {
	theme: AppTheme;
	fontSize: number;
	lineGap: number;
	bookMode: boolean;
	onFontSize: (n: number) => void;
	onLineGap: (n: number) => void;
	onToggleBookMode: () => void;
}) {
	const label = [styles.panelLabel, { color: ink[400] }];
	const divider = { borderTopWidth: 1, borderTopColor: theme.isDark ? ink[700] : ink[100], paddingTop: 8 };
	const track = theme.isDark ? ink[700] : ink[100];
	return (
		<View style={[styles.fontPanel, { backgroundColor: theme.card, borderColor: theme.isDark ? ink[700] : "transparent" }]}>
			<View>
				<Text style={label}>SIZE: {fontSize}PX</Text>
				<RangeSlider value={fontSize} min={12} max={60} step={2} onChange={onFontSize} accent={theme.p[500]} track={track} />
			</View>
			<View style={divider}>
				<View style={styles.panelRow}>
					<Text style={label}>SPACING</Text>
					<Text style={[styles.gapChip, { backgroundColor: track, color: theme.isDark ? ink[300] : ink[600] }]}>{lineGap}</Text>
				</View>
				<RangeSlider value={lineGap} min={0} max={16} step={1} onChange={onLineGap} accent={theme.p[500]} track={track} />
			</View>
			<View style={[divider, styles.panelRow]}>
				<View style={styles.rowCenter}>
					<BookOpen size={14} color={ink[400]} />
					<Text style={[label, { marginBottom: 0 }]}>BOOK MODE (ZOOM/PAN)</Text>
				</View>
				<Pressable
					accessibilityRole="switch"
					accessibilityState={{ checked: bookMode }}
					onPress={onToggleBookMode}
					style={[styles.switch, { backgroundColor: bookMode ? theme.p[500] : theme.isDark ? ink[600] : ink[200] }]}
				>
					<View style={[styles.switchKnob, { transform: [{ translateX: bookMode ? 20 : 0 }] }]} />
				</Pressable>
			</View>
		</View>
	);
}

// Whole-list queue, as App.tsx built it for the songs and authors lists: the
// first recording of every visible bhajan, with this bhajan's entry swapped
// for the singer the user picked.
function buildListQueue(all: Bhajan[], bhajan: Bhajan, chosen: BhajanAudio): QueueTrack[] {
	const queue: QueueTrack[] = [];
	for (const b of all) {
		if (b.isHidden || !b.audio?.length) continue;
		const track = b.id === bhajan.id ? chosen : b.audio[0];
		queue.push({ ...track, bhajanTitle: b.title, parentBhajan: b });
	}
	return queue;
}

function playFromReader(track: BhajanAudio, bhajan: Bhajan, title: string, listQueueName?: string) {
	const { playTrack } = useAudioStore.getState();
	if (listQueueName) {
		const all = useContentStore.getState().bhajans;
		playTrack(track, title, bhajan, buildListQueue(all, bhajan, track), listQueueName);
		return;
	}
	// This bhajan's own recordings, starting from the chosen one.
	const local = bhajan.audio ?? [];
	const i = Math.max(0, local.findIndex((t) => t.id === track.id));
	playTrack(track, title, bhajan, [...local.slice(i), ...local.slice(0, i)], "Song List");
}

function AudioButton({
	bhajan,
	title,
	listQueueName,
	theme,
	isHindi,
	onOpenList,
}: {
	bhajan: Bhajan;
	title: string;
	listQueueName?: string;
	theme: AppTheme;
	isHindi: boolean;
	onOpenList: () => void;
}) {
	const tracks = bhajan.audio ?? [];
	if (tracks.length > 1) {
		return (
			<Pressable onPress={onOpenList} style={[styles.audioPill, { backgroundColor: theme.p[500] }]}>
				<Music size={18} color="#fff" />
				<Text style={styles.audioPillText}>{isHindi ? "ऑडियो चुनें" : "Select Audio"}</Text>
				<Text style={styles.audioCount}>{tracks.length}</Text>
			</Pressable>
		);
	}
	return (
		<Pressable
			onPress={() => {
				triggerHaptic("medium");
				playFromReader(tracks[0], bhajan, title, listQueueName);
			}}
			style={[styles.audioPill, { backgroundColor: theme.p[500] }]}
		>
			<PlayCircle size={18} color="#fff" />
			<Text style={styles.audioPillText}>{isHindi ? "ऑडियो चलाएं" : "Play Audio"}</Text>
		</Pressable>
	);
}

function PlayingPill({ theme, bottom, onOpenAudioScreen }: { theme: AppTheme; bottom: number; onOpenAudioScreen: () => void }) {
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const isLoading = useAudioStore((s) => s.isLoading);
	const { togglePlay, seek, closePlayer } = useAudioStore.getState();
	const skip = (delta: number) => {
		triggerHaptic("light");
		const { position, duration } = useAudioStore.getState();
		seek(Math.min(duration || Number.MAX_SAFE_INTEGER, Math.max(0, position + delta)));
	};
	const muted = theme.isDark ? ink[300] : ink[600];
	return (
		<View style={[styles.playingPill, { bottom }]}>
			<View style={[styles.playingInner, floatCard(theme)]}>
				<Pressable accessibilityLabel="Open audio player" onPress={onOpenAudioScreen} style={styles.pillButton}>
					<Maximize size={16} color={ink[400]} />
				</Pressable>
				<Pressable accessibilityLabel="Back 10 seconds" onPress={() => skip(-10)} style={styles.pillButtonSmall}>
					<RotateCcw size={18} color={muted} />
				</Pressable>
				<Pressable
					accessibilityLabel={isPlaying ? "Pause" : "Play"}
					onPress={() => {
						triggerHaptic("medium");
						togglePlay();
					}}
					style={[styles.pillPlay, { backgroundColor: theme.p[500] }]}
				>
					{isLoading ? (
						<ActivityIndicator size="small" color="#fff" />
					) : isPlaying ? (
						<Pause size={20} color="#fff" fill="#fff" />
					) : (
						<Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
					)}
				</Pressable>
				<Pressable accessibilityLabel="Forward 10 seconds" onPress={() => skip(10)} style={styles.pillButtonSmall}>
					<RotateCw size={18} color={muted} />
				</Pressable>
				<Pressable
					accessibilityLabel="Close audio"
					onPress={() => {
						triggerHaptic("medium");
						closePlayer();
					}}
					style={styles.pillButton}
				>
					<X size={16} color={ink[400]} />
				</Pressable>
			</View>
		</View>
	);
}

function AudioListModal({
	visible,
	onClose,
	bhajan,
	title,
	listQueueName,
	theme,
	isHindi,
}: {
	visible: boolean;
	onClose: () => void;
	bhajan: Bhajan;
	title: string;
	listQueueName?: string;
	theme: AppTheme;
	isHindi: boolean;
}) {
	const downloaded = useDownloadStore((s) => s.downloaded);
	const active = useDownloadStore((s) => s.active);
	const requestDownload = useDownloadStore((s) => s.requestTrackDownload);
	const fmt = (s?: number) => (s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}` : "");

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
			<Pressable style={styles.centerScrim} onPress={onClose}>
				<Pressable style={[styles.audioCard, { backgroundColor: theme.card, borderColor: theme.isDark ? ink[700] : theme.p[200] }]} onPress={() => {}}>
					<View style={styles.modalHead}>
						<Text style={[styles.audioTitle, { color: theme.isDark ? theme.p[400] : theme.p[600] }]}>
							{isHindi ? "उपलब्ध ऑडियो" : "Available Audio"}
						</Text>
						<Pressable onPress={onClose} style={{ padding: 4 }}>
							<X size={20} color={ink[400]} />
						</Pressable>
					</View>
					<RNScrollView contentContainerStyle={{ gap: 8 }}>
						{(bhajan.audio ?? []).map((track) => {
							const isDone = !!downloaded[track.id];
							const progress = active[track.id]?.progress;
							return (
								<View key={track.id} style={[styles.trackRow, { backgroundColor: theme.isDark ? "rgba(7,21,41,0.5)" : ink[50] }]}>
									<Pressable
										style={styles.trackMain}
										onPress={() => {
											triggerHaptic("medium");
											playFromReader(track, bhajan, title, listQueueName);
											onClose();
										}}
									>
										<View style={[styles.trackIcon, { backgroundColor: theme.isDark ? ink[700] : theme.p[100] }]}>
											<PlayCircle size={20} color={theme.isDark ? theme.p[400] : theme.p[600]} />
										</View>
										<View style={styles.flex}>
											<Text style={[styles.trackSinger, { color: theme.isDark ? ink[200] : ink[700] }]}>
												{track.singer?.replace(/\s+\)/g, ")") || (isHindi ? "अज्ञात गायक" : "Unknown Singer")}
											</Text>
											<Text style={[styles.trackDuration, { color: ink[400] }]}>{fmt(track.duration)}</Text>
										</View>
									</Pressable>
									<Pressable
										accessibilityLabel={isHindi ? "डाउनलोड" : "Download"}
										disabled={isDone || progress !== undefined}
										onPress={() => requestDownload(track, title, bhajan)}
										style={styles.downloadButton}
									>
										{progress !== undefined ? (
											<Text style={[styles.progressText, { color: theme.isDark ? theme.p[400] : theme.p[600] }]}>{Math.round(progress)}</Text>
										) : isDone ? (
											<Check size={20} color="#22c55e" />
										) : (
											<Download size={20} color={ink[400]} />
										)}
									</Pressable>
								</View>
							);
						})}
					</RNScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function PlaylistModal({
	visible,
	onClose,
	bhajanId,
	theme,
	isHindi,
}: {
	visible: boolean;
	onClose: () => void;
	bhajanId: string;
	theme: AppTheme;
	isHindi: boolean;
}) {
	const { playlists, addToPlaylist, removeFromPlaylist, createPlaylist } = usePlaylistStore();
	const [name, setName] = useState("");
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
			<Pressable style={styles.centerScrim} onPress={onClose}>
				<Pressable style={[styles.playlistCard, { backgroundColor: theme.card }]} onPress={() => {}}>
					<View style={styles.modalHead}>
						<Text style={[styles.modalTitle, { color: theme.isDark ? "#fff" : ink[900] }]}>
							{isHindi ? "प्लेलिस्ट में सहेजें" : "Save to Playlists"}
						</Text>
						<Pressable onPress={onClose} style={{ padding: 4 }}>
							<X size={20} color={ink[400]} />
						</Pressable>
					</View>
					<RNScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
						{playlists.map((p) => {
							const added = p.items.includes(bhajanId);
							return (
								<Pressable
									key={p.id}
									onPress={() => {
										triggerHaptic("light");
										if (added) removeFromPlaylist(p.id, bhajanId);
										else addToPlaylist(p.id, bhajanId);
									}}
									style={[
										styles.playlistRow,
										added
											? { backgroundColor: theme.isDark ? ink[700] : theme.p[50], borderColor: theme.isDark ? theme.p[500] : theme.p[200] }
											: { backgroundColor: theme.isDark ? "rgba(7,21,41,0.5)" : ink[50], borderColor: "transparent" },
									]}
								>
									<View style={styles.flex}>
										<Text
											style={[styles.playlistName, { color: added ? (theme.isDark ? theme.p[400] : theme.p[700]) : theme.isDark ? "#fff" : ink[700] }]}
											numberOfLines={1}
										>
											{p.name}
										</Text>
										<Text style={{ fontSize: 12, color: ink[400] }}>
											{p.items.length} {isHindi ? "भजन" : "songs"}
										</Text>
									</View>
									{added ? (
										<CheckSquare size={22} color={theme.isDark ? theme.p[400] : theme.p[600]} />
									) : (
										<Square size={22} color={theme.isDark ? ink[500] : ink[300]} />
									)}
								</Pressable>
							);
						})}
						{playlists.length === 0 ? (
							<Text style={styles.noPlaylists}>{isHindi ? "कोई प्लेलिस्ट नहीं।" : "No playlists yet."}</Text>
						) : null}
					</RNScrollView>
					<View style={[styles.newRow, { borderTopColor: theme.isDark ? ink[700] : ink[100] }]}>
						<TextInput
							value={name}
							onChangeText={setName}
							placeholder={isHindi ? "नई प्लेलिस्ट" : "New Playlist Name"}
							placeholderTextColor={ink[400]}
							style={[styles.newInput, { backgroundColor: theme.isDark ? ink[900] : ink[100], color: theme.isDark ? "#fff" : ink[900] }]}
						/>
						<Pressable
							accessibilityLabel="Create playlist"
							disabled={!name.trim()}
							onPress={() => {
								createPlaylist(name.trim());
								setName("");
							}}
							style={[styles.newAdd, { backgroundColor: theme.p[500], opacity: name.trim() ? 1 : 0.5 }]}
						>
							<Plus size={20} color="#fff" />
						</Pressable>
					</View>
					<Pressable onPress={onClose} style={[styles.doneButton, { backgroundColor: theme.isDark ? ink[700] : ink[100] }]}>
						<Text style={[styles.doneText, { color: theme.isDark ? ink[300] : ink[600] }]}>{isHindi ? "हो गया" : "Done"}</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function ShareModal({
	visible,
	onClose,
	bhajan,
	title,
	content,
	author,
	theme,
	isHindi,
}: {
	visible: boolean;
	onClose: () => void;
	bhajan: Bhajan;
	title: string;
	content: string;
	author: string | null;
	theme: AppTheme;
	isHindi: boolean;
}) {
	const insets = useSafeAreaInsets();
	const share = async () => {
		onClose();
		triggerHaptic("light");
		// Title, the first two lyric lines and a deep link (BhajanReader executeShare).
		const preview = content
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l && !l.startsWith("#"))
			.slice(0, 2)
			.join("\n");
		const cleanId = bhajan.id.replace(/^bhajan[_-]/i, "").replace(/^lecture[_-]/i, "");
		const isLecture = /^lecture[-_]/.test(bhajan.id);
		const url = `https://chaitanyaprembhakti.org/?bhajanId=${isLecture ? `lecture_${cleanId}` : (bhajan.songNumber ?? cleanId)}`;
		const cta = isHindi
			? "🙏 और पढ़ने तथा ऑडियो के लिए इस लिंक पर क्लिक करें 👇"
			: "🙏 To read more and listen audio click this link 👇";
		try {
			await Share.share({ title, message: `${title}\n\n${preview}\n\n${cta}\n${url}` }, { dialogTitle: isHindi ? "भजन शेयर करें" : "Share Bhajan" });
		} catch {
			showToast(isHindi ? "शेयर नहीं हो सका" : "Could not share", "error");
		}
	};
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
			<Pressable style={styles.bottomScrim} onPress={onClose}>
				<Pressable style={[styles.shareCard, { backgroundColor: theme.card, paddingBottom: 24 + insets.bottom }]} onPress={() => {}}>
					<View style={[styles.modalHead, { marginBottom: 24 }]}>
						<Text style={[styles.shareTitle, { color: theme.isDark ? "#fff" : ink[800] }]}>{isHindi ? "भजन शेयर करें" : "Share Bhajan"}</Text>
						<Pressable onPress={onClose} style={[styles.closeRound, { backgroundColor: theme.isDark ? "rgba(22,48,92,0.5)" : ink[100] }]}>
							<X size={20} color={ink[400]} />
						</Pressable>
					</View>
					<View
						style={[
							styles.linkCard,
							theme.isDark
								? { backgroundColor: "rgba(7,21,41,0.5)", borderColor: ink[700] }
								: { backgroundColor: theme.p[50], borderColor: theme.p[200] },
						]}
					>
						<View style={styles.rowCenter}>
							<Link size={16} color={theme.isDark ? theme.p[400] : theme.p[600]} />
							<Text style={[styles.linkHost, { color: theme.isDark ? theme.p[400] : theme.p[600] }]}>chaitanyaprembhakti.org</Text>
						</View>
						<Text style={[styles.linkTitle, { color: theme.isDark ? "#f3f4f6" : ink[800] }]} numberOfLines={2}>
							{title}
						</Text>
						{author ? <Text style={{ fontSize: 12, color: theme.isDark ? ink[400] : ink[500] }}>{author}</Text> : null}
					</View>
					<Pressable onPress={share} style={[styles.shareButton, { backgroundColor: theme.p[500] }]}>
						<Share2 size={18} color="#fff" />
						<Text style={styles.shareButtonText}>{isHindi ? "लिंक शेयर करें" : "Share Link"}</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	clip: { overflow: "hidden" },
	rowCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 8,
		paddingBottom: 8,
		minHeight: HEADER_HEIGHT,
		borderBottomWidth: 2,
		borderBottomColor: "rgba(212,160,23,0.4)",
		elevation: 6,
		zIndex: 30,
	},
	backButton: { padding: 12, borderRadius: 24 },
	headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
	headerButton: { padding: 10 },
	titleBar: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 20,
		paddingVertical: 4,
		paddingHorizontal: 12,
		borderBottomWidth: 1,
		elevation: 2,
	},
	titleBarAuthor: { fontSize: 8, fontWeight: "700", letterSpacing: 0.8 },
	titleBarTitle: { fontSize: 16, fontWeight: "700", textAlign: "right" },
	page: { paddingHorizontal: 12, paddingTop: 32, width: "100%" },
	pageNarrow: { maxWidth: 768, alignSelf: "center" },
	titleBlock: { marginTop: 16, paddingHorizontal: 8, marginBottom: 16 },
	metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", marginBottom: 4 },
	metaAuthor: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, flex: 1 },
	numberPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
	numberText: { fontSize: 14, fontWeight: "700", fontFamily: "monospace" },
	title: { fontSize: 30, fontWeight: "700", lineHeight: 41 },
	titleRule: { height: 1, width: 96, marginBottom: 32 },
	gap: { height: 16 },
	subRow: { flexDirection: "row", marginVertical: 8, paddingHorizontal: 8 },
	subBox: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 8, borderTopWidth: 1, borderBottomWidth: 1, borderLeftWidth: 3, borderRightWidth: 3 },
	subText: { fontSize: 14, fontWeight: "700", letterSpacing: 0.4, textAlign: "center" },
	line: { paddingHorizontal: 4, fontWeight: "700" },
	footer: { marginTop: 64, alignItems: "center" },
	signature: { fontFamily: serif, fontSize: 24 },
	footerPill: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
	footerNumber: { fontSize: 14, fontFamily: "monospace" },
	fontPanel: {
		position: "absolute",
		top: 0,
		right: 8,
		zIndex: 40,
		width: 288,
		padding: 16,
		gap: 16,
		borderRadius: 16,
		borderWidth: 1,
		elevation: 16,
		shadowColor: "#000",
		shadowOpacity: 0.2,
		shadowRadius: 16,
	},
	panelLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
	panelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	gapChip: { paddingHorizontal: 6, borderRadius: 4, fontSize: 10, fontWeight: "700", marginBottom: 8, overflow: "hidden" },
	switch: { width: 40, height: 20, borderRadius: 10, padding: 2 },
	switchKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
	zoomBar: {
		position: "absolute",
		alignSelf: "center",
		zIndex: 40,
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		padding: 4,
		borderRadius: 12,
		borderWidth: 1,
		elevation: 12,
	},
	zoomButton: { padding: 8, borderRadius: 8 },
	zoomText: { width: 48, textAlign: "center", fontSize: 12, fontWeight: "700", fontFamily: "monospace" },
	zoomDivider: { width: 1, height: 24, marginHorizontal: 4 },
	playingPill: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 40 },
	playingInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1,
		elevation: 12,
		shadowColor: "#000",
		shadowOpacity: 0.15,
		shadowRadius: 12,
	},
	pillButton: { padding: 6 },
	pillButtonSmall: { padding: 4 },
	pillPlay: { padding: 8, borderRadius: 999, marginHorizontal: 4, minWidth: 36, alignItems: "center" },
	leftActions: { position: "absolute", left: 16, flexDirection: "row", gap: 8, zIndex: 40 },
	rightActions: { position: "absolute", right: 16, zIndex: 40 },
	roundAction: { padding: 12, borderRadius: 999, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8 },
	audioPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 999,
		elevation: 8,
		shadowColor: "#000",
		shadowOpacity: 0.15,
		shadowRadius: 8,
	},
	audioPillText: { color: "#fff", fontSize: 14, fontWeight: "700" },
	audioCount: { color: "#fff", fontSize: 10, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 6, borderRadius: 999, overflow: "hidden" },
	centerScrim: { flex: 1, backgroundColor: "rgba(7,21,41,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
	bottomScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end", padding: 16, paddingBottom: 0 },
	modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingHorizontal: 4 },
	audioCard: { width: "90%", maxWidth: 448, maxHeight: "80%", borderRadius: 24, padding: 20, borderWidth: 1, elevation: 24 },
	audioTitle: { fontSize: 18, fontWeight: "700" },
	trackRow: { flexDirection: "row", alignItems: "center", borderRadius: 12 },
	trackMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
	trackIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
	trackSinger: { fontSize: 14, fontWeight: "700" },
	trackDuration: { fontSize: 12, marginTop: 2 },
	downloadButton: { padding: 12, marginRight: 4, minWidth: 44, alignItems: "center" },
	progressText: { fontSize: 10, fontWeight: "900" },
	playlistCard: { width: "100%", maxWidth: 384, maxHeight: "70%", borderRadius: 16, padding: 20, elevation: 24 },
	modalTitle: { fontSize: 18, fontWeight: "700" },
	playlistRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1 },
	playlistName: { fontWeight: "700" },
	noPlaylists: { textAlign: "center", color: ink[400], fontSize: 14, paddingVertical: 16 },
	newRow: { flexDirection: "row", gap: 8, paddingTop: 16, borderTopWidth: 1 },
	newInput: { flex: 1, padding: 12, borderRadius: 12, fontSize: 14 },
	newAdd: { padding: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
	doneButton: { marginTop: 12, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
	doneText: { fontWeight: "700" },
	shareCard: { width: "100%", maxWidth: 448, alignSelf: "center", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
	shareTitle: { fontSize: 20, fontWeight: "700" },
	closeRound: { padding: 8, borderRadius: 999 },
	linkCard: { marginBottom: 24, borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
	linkHost: { fontSize: 14, fontWeight: "700" },
	linkTitle: { fontWeight: "700" },
	shareButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
	shareButtonText: { color: "#fff", fontWeight: "700" },
});

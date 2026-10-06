import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ArrowLeft, Download, Eye, GalleryHorizontal, Heart, Image as ImageIcon, LayoutGrid, Loader2, Maximize2, X } from "lucide-react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import * as Sharing from "expo-sharing";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/types";
import { useHomeDataStore } from "../store/homeDataStore";
import { useSettingsStore } from "../store/settingsStore";
import { useAppTheme } from "../theme/useAppTheme";
import { MANDAL_LIST } from "../data/mandals";
import { THUMB, thumbUrl } from "../lib/imageThumb";
import { webGet, webSet, useWebStoreVersion } from "../lib/webStore";
import { hasUnseen, idsByRecency, markSeen, useMarkVisitedOnMount } from "../lib/newBadge";
import { useMetrics } from "../hooks/useMetrics";

type Props = NativeStackScreenProps<RootStackParamList, "DeityDarshan">;
type GalleryItem = { id: string; url: string; date: string; order: number };
type Mandal = { id: string; name: string; gallery: GalleryItem[] };
type ViewMode = "horizontal" | "strip" | "grid";

const dateKey = (value?: string) => {
	if (!value) return "";
	const parts = value.trim().split("-");
	return parts.length === 3 && parts[0].length === 2 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value;
};

const localDateKey = (value: string) => {
	const parsed = new Date(dateKey(value));
	return Number.isNaN(parsed.getTime()) ? value : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

function assetMeta(asset: any) {
	const match = /^\[(.*?)\]\[(.*?)\]\[(.*?)\]\./.exec(String(asset.name || ""));
	if (match) return { date: match[1], order: Number.parseInt(match[2], 10) || 0 };
	const created = new Date(asset.created_at);
	return { date: Number.isNaN(created.getTime()) ? String(asset.created_at || "") : localDateKey(created.toISOString().slice(0, 10)), order: 0 };
}

function mandalName(id: string, fallback: string) {
	return MANDAL_LIST.find((item) => item.id === id)?.name || fallback;
}

function mergeMandals(rawMandals: any[], releases: any[], config: any): Mandal[] {
	const visible = new Set<number>((config?.visibleIds || []).map(Number));
	const order = (config?.folderOrder || []) as number[];
	const github: Record<string, GalleryItem[]> = {};
	const githubNames: Record<string, string> = {};
	const hidden = new Set<string>();

	for (const release of releases || []) {
		const lower = String(release.name || "").toLowerCase();
		const known = MANDAL_LIST.find((item) => lower.includes(item.id) || lower.includes(item.name.toLowerCase().replace(" mandal", "")));
		const id = known?.id || `github-${release.id}`;
		if (!visible.has(Number(release.id))) hidden.add(id);
		githubNames[id] = String(release.name || "").replace(/Release for /i, "").replace(/\s*\(.*?\)\s*$/, "").trim();
		for (const asset of release.assets || []) {
			const meta = assetMeta(asset);
			(github[id] ||= []).push({ id: String(asset.id || asset.browser_download_url), url: asset.browser_download_url, ...meta });
		}
	}

	const result = new Map<string, Mandal>();
	for (const item of MANDAL_LIST) {
		if (hidden.has(item.id)) continue;
		const db = rawMandals.find((mandal) => mandal.id === item.id) || {};
		const firestoreGallery = (db.gallery || []).filter((gallery: any) => gallery.type === "darshan").map((gallery: any) => ({
			id: String(gallery.id || gallery.url), url: gallery.url, date: gallery.date || "", order: gallery.order || 0,
		}));
		const source = firestoreGallery.length ? firestoreGallery : github[item.id] || [];
		const unique = new Map<string, GalleryItem>(source.map((gallery: GalleryItem) => [gallery.url, gallery]));
		const gallery: GalleryItem[] = [...unique.values()].sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)) || a.order - b.order);
		if (gallery.length) result.set(item.id, { id: item.id, name: item.name, gallery });
	}
	for (const [id, gallery] of Object.entries(github)) {
		if (!id.startsWith("github-") || hidden.has(id) || !gallery.length) continue;
		result.set(id, { id, name: githubNames[id] || "Gallery Folder", gallery });
	}
	const values = [...result.values()];
	if (order.length) {
		values.sort((a, b) => {
			const ra = (releases || []).find((release: any) => {
				const lower = String(release.name || "").toLowerCase();
				return (MANDAL_LIST.find((m) => m.id === a.id && (lower.includes(m.id) || lower.includes(m.name.toLowerCase().replace(" mandal", "")))) || (a.id === `github-${release.id}`));
			})?.id;
			const rb = (releases || []).find((release: any) => {
				const lower = String(release.name || "").toLowerCase();
				return (MANDAL_LIST.find((m) => m.id === b.id && (lower.includes(m.id) || lower.includes(m.name.toLowerCase().replace(" mandal", "")))) || (b.id === `github-${release.id}`));
			})?.id;
			const ia = ra ? order.indexOf(Number(ra)) : -1;
			const ib = rb ? order.indexOf(Number(rb)) : -1;
			if (ia >= 0 && ib >= 0) return ia - ib;
			if (ia >= 0) return -1;
			if (ib >= 0) return 1;
			return 0;
		});
	} else values.reverse();
	return values;
}

function useSeenIds(key: string) {
	useWebStoreVersion();
	return (ids: string[]) => hasUnseen(key, ids);
}

function PhotoImage({ url, small = false, onLoad }: { url: string; small?: boolean; onLoad?: () => void }) {
	return <Image source={{ uri: thumbUrl(url, small ? THUMB.tile : THUMB.card) }} contentFit="cover" style={StyleSheet.absoluteFill} onLoad={onLoad} />;
}

function StoryViewer({ images, initialIndex, onClose, getMetrics, incrementLike, incrementView, hasLiked }: any) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const [index, setIndex] = useState(initialIndex);
	const [paused, setPaused] = useState(false);
	const scale = useSharedValue(1);
	const tx = useSharedValue(0);
	const ty = useSharedValue(0);
	const savedScale = useSharedValue(1);
	const start = useRef({ x: 0, y: 0 });
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const current = images[index];

	const reset = () => { scale.value = withTiming(1); savedScale.value = 1; tx.value = withTiming(0); ty.value = withTiming(0); };
	const advance = (next: number) => {
		reset();
		if (next >= images.length) onClose(); else if (next >= 0) setIndex(next);
	};
	useEffect(() => {
		if (current?.id) incrementView(current.id);
	}, [current?.id, incrementView]);
	useEffect(() => {
		if (paused || scale.value > 1) return;
		timer.current = setTimeout(() => advance(index + 1), 5000);
		return () => { if (timer.current) clearTimeout(timer.current); };
	}, [index, paused]);

	const pinch = Gesture.Pinch().onBegin(() => setPaused(true)).onUpdate((event) => { scale.value = Math.max(1, Math.min(4, savedScale.value * event.scale)); }).onEnd(() => { savedScale.value = scale.value; setPaused(false); });
	const pan = Gesture.Pan().onBegin(() => { start.current = { x: tx.value, y: ty.value }; setPaused(true); }).onUpdate((event) => { if (scale.value > 1) { tx.value = start.current.x + event.translationX; ty.value = start.current.y + event.translationY; } }).onEnd(() => setPaused(false));
	const gestures = Gesture.Simultaneous(pinch, pan);
	const imageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
	if (!current) return null;
	return <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
		<View style={styles.storyRoot}>
			<View style={[styles.storyProgress, { top: insets.top + 6 }]}>{images.map((_: any, itemIndex: number) => <View key={itemIndex} style={styles.progressTrack}><View style={[styles.progressFill, { width: itemIndex < index ? "100%" : itemIndex === index ? "100%" : 0, backgroundColor: theme.card }]} /></View>)}</View>
			<View style={[styles.storyHeader, { paddingTop: insets.top + 20 }]}>
				<View style={styles.storyCount}><Image source={{ uri: thumbUrl(current.url, THUMB.small) }} style={styles.storyAvatar} /><Text style={{ color: theme.card }}>{index + 1} / {images.length}</Text></View>
				<Pressable onPress={onClose} style={styles.circleButton}><X color={theme.card} size={20} /></Pressable>
			</View>
			<GestureDetector gesture={gestures}><Animated.View style={[styles.storyImageBox, imageStyle]}>
				<Pressable style={styles.storyTapArea} onPress={(event) => event.nativeEvent.locationX < 125 ? advance(index - 1) : advance(index + 1)} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)}>
					<Image source={{ uri: current.url }} contentFit="contain" style={styles.storyImage} />
				</Pressable>
			</Animated.View></GestureDetector>
			<View style={[styles.storyFooter, { paddingBottom: insets.bottom + 12 }]}>
				<View style={styles.storyActions}>
					<Pressable onPress={() => incrementLike(current.id)} style={styles.storyAction}><Heart color={hasLiked(current.id) ? theme.p[500] : theme.card} fill={hasLiked(current.id) ? theme.p[500] : "transparent"} size={28} /><Text style={styles.storyText}>{getMetrics(current.id).likes || 0}</Text></Pressable>
					<View style={styles.storyAction}><Eye color={theme.card} size={28} /><Text style={styles.storyText}>{getMetrics(current.id).views || 0}</Text></View>
				</View>
				{images.length > 1 && <View style={styles.dots}>{images.map((_: any, itemIndex: number) => <View key={itemIndex} style={[styles.dot, { backgroundColor: itemIndex === index ? theme.card : theme.textMuted }]} />)}</View>}
			</View>
		</View>
	</Modal>;
}

function MandalDetail({ mandal, initialDate, onBack }: { mandal: Mandal; initialDate?: string; onBack: () => void }) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage } = useSettingsStore();
	const isHindi = settingsLanguage === "hi";
	const [viewMode, setViewMode] = useState<ViewMode>(() => (webGet("cpbs_darshan_view_mode") as ViewMode) || "horizontal");
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [story, setStory] = useState<{ images: GalleryItem[]; index: number } | null>(null);
	const [downloading, setDownloading] = useState<string | null>(null);
	const [toast, setToast] = useState<string | null>(null);
	const { getMetrics, incrementLike, incrementView, incrementViews, hasLiked } = useMetrics("darshan");
	const sorted = useMemo(() => [...mandal.gallery].sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)) || a.order - b.order || a.id.localeCompare(b.id)), [mandal.gallery]);
	const groups = useMemo(() => sorted.reduce<Record<string, GalleryItem[]>>((result, item) => { const key = dateKey(item.date); (result[key] ||= []).push(item); return result; }, {}), [sorted]);
	const dates = useMemo(() => Object.keys(groups).sort((a, b) => b.localeCompare(a)), [groups]);
	const activeImages = selectedDate ? groups[selectedDate] || [] : [];
	const listRef = useRef<FlatList<GalleryItem>>(null);
	useEffect(() => { webSet("cpbs_darshan_view_mode", viewMode); }, [viewMode]);
	useEffect(() => { if (!selectedDate && dates.length) setSelectedDate(initialDate && dates.includes(dateKey(initialDate)) ? dateKey(initialDate) : dates[0]); }, [dates, initialDate, selectedDate]);
	useEffect(() => { if (activeImages.length) incrementViews(activeImages.map((item) => item.id)); }, [selectedDate]);

	const download = async (item: GalleryItem) => {
		if (downloading === item.id || Platform.OS === "web") { if (Platform.OS === "web") setToast(isHindi ? "फोटो डाउनलोड हो गई है" : "Photo downloaded successfully"); return; }
		setDownloading(item.id);
		try {
			const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/darshan_${item.id}.jpg`;
			await ReactNativeBlobUtil.config({ fileCache: true, path }).fetch("GET", item.url);
			await Sharing.shareAsync(`file://${path}`, { dialogTitle: isHindi ? "दर्शन फोटो" : "Darshan photo", mimeType: "image/jpeg" });
			setToast(isHindi ? "फोटो डाउनलोड हो गई है" : "Photo downloaded successfully");
		} catch { setToast("Download failed. Check internet connection."); }
		setDownloading(null);
	};
	const cycleMode = () => setViewMode((mode) => mode === "horizontal" ? "strip" : mode === "strip" ? "grid" : "horizontal");
	const modeIcon = viewMode === "horizontal" ? <Maximize2 color={theme.card} size={20} /> : viewMode === "strip" ? <GalleryHorizontal color={theme.card} size={20} /> : <LayoutGrid color={theme.card} size={20} />;
	const renderCard = ({ item, index }: { item: GalleryItem; index: number }) => <Pressable style={[styles.photoCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setStory({ images: activeImages, index })}>
		<View style={styles.photoImage}><PhotoImage url={item.url} /><View style={styles.photoShade} /><View style={styles.photoStats}><Eye color={theme.card} size={12} /><Text style={styles.photoStatText}>{getMetrics(item.id).views || 0}</Text><Heart color={hasLiked(item.id) ? theme.p[500] : theme.card} fill={hasLiked(item.id) ? theme.p[500] : "transparent"} size={12} /><Text style={styles.photoStatText}>{getMetrics(item.id).likes || 0}</Text></View><View style={styles.indexPill}><Text style={styles.indexText}>{index + 1} / {activeImages.length}</Text></View><Pressable style={styles.downloadButton} onPress={() => download(item)} disabled={downloading === item.id}>{downloading === item.id ? <ActivityIndicator color={theme.card} size="small" /> : <Download color={theme.card} size={14} />}</Pressable></View>
	</Pressable>;

	return <View style={[styles.root, { backgroundColor: theme.page }]}>
		<LinearGradient colors={[theme.p[500], theme.p[600]]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
			<Pressable onPress={onBack} style={styles.headerButton}><ArrowLeft color={theme.card} size={24} /></Pressable><ImageIcon color={theme.card} size={23} /><Text style={[styles.headerTitle, { color: theme.card }]}>{isHindi ? "ठाकुर जी के दर्शन" : "Deity Darshan"}</Text>
		</LinearGradient>
		<View style={styles.detailHeader}><Pressable onPress={onBack} style={styles.headerButton}><ArrowLeft color={theme.text} size={24} /></Pressable><Text style={[styles.detailTitle, { color: theme.text }]} numberOfLines={1}>{mandal.name.replace(/\s*mandal\s*/i, "")}</Text><Pressable onPress={cycleMode} style={[styles.modeButton, { backgroundColor: theme.p[500] }]}>{modeIcon}</Pressable></View>
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>{dates.map((date) => <Pressable key={date} onPress={() => setSelectedDate(date)} style={styles.dateButton}><View style={[styles.dateImage, { borderColor: selectedDate === date ? theme.p[500] : theme.border }]}><PhotoImage url={groups[date][0].url} small /></View><Text style={[styles.dateText, { color: selectedDate === date ? theme.p[600] : theme.textMuted }]}>{new Date(`${date}T00:00:00`).toLocaleDateString(isHindi ? "hi-IN" : "en-US", { day: "numeric", month: "short" })}</Text></Pressable>)}</ScrollView>
		{dates.length === 0 ? <View style={styles.empty}><ImageIcon color={theme.textMuted} size={48} /><Text style={{ color: theme.textMuted }}>{isHindi ? "कोई दर्शन उपलब्ध नहीं है" : "No darshan available"}</Text></View> : viewMode === "horizontal" ? <FlatList ref={listRef} data={activeImages} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(item) => item.id} renderItem={renderCard} contentContainerStyle={styles.horizontalList} getItemLayout={(_, index) => ({ length: 344, offset: 344 * index, index })} /> : viewMode === "strip" ? <FlatList data={activeImages} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(item) => item.id} renderItem={renderCard} contentContainerStyle={styles.stripList} /> : <FlatList data={activeImages} numColumns={2} keyExtractor={(item) => item.id} renderItem={renderCard} contentContainerStyle={[styles.gridList, { paddingBottom: insets.bottom + 24 }]} />}
		{story && <StoryViewer images={story.images} initialIndex={story.index} onClose={() => setStory(null)} getMetrics={getMetrics} incrementLike={incrementLike} incrementView={incrementView} hasLiked={hasLiked} />}
		{toast && <Pressable onPress={() => setToast(null)} style={[styles.toast, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={{ color: theme.text }}>{toast}</Text></Pressable>}
	</View>;
}

export function DeityDarshanScreen({ route, navigation }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage, scrollBarSide } = useSettingsStore();
	const { mandals, darshanFolders, darshanReleases } = useHomeDataStore();
	const [selected, setSelected] = useState<Mandal | null>(null);
	const [loading, setLoading] = useState(true);
	useMarkVisitedOnMount("darshan");
	const unseen = useSeenIds("cpbs_home_darshan_latest");
	const computed = useMemo(() => mergeMandals(mandals, darshanReleases, darshanFolders), [mandals, darshanReleases, darshanFolders]);
	useEffect(() => { if (darshanFolders || mandals.length || darshanReleases.length) setLoading(false); }, [darshanFolders, mandals.length, darshanReleases.length]);
	useEffect(() => {
		const id = route.params?.target_mandal;
		if (!id || selected || !computed.length) return;
		const target = computed.find((item) => item.id === id || item.name.toLowerCase().includes(id.toLowerCase()));
		if (target) setSelected(target);
	}, [computed, route.params?.target_mandal, selected]);
	useEffect(() => {
		if (!computed.length) return;
		markSeen("cpbs_home_darshan_latest", computed.flatMap((item) => idsByRecency(item.gallery)).slice(0, 5));
	}, [computed.length]);
	if (selected) return <MandalDetail mandal={selected} initialDate={route.params?.target_date} onBack={() => setSelected(null)} />;
	return <View style={[styles.root, { backgroundColor: theme.page }]}>
		<LinearGradient colors={[theme.p[500], theme.p[600]]} style={[styles.header, { paddingTop: insets.top + 8 }]}><Pressable onPress={() => navigation.goBack()} style={styles.headerButton}><ArrowLeft color={theme.card} size={24} /></Pressable><ImageIcon color={theme.card} size={23} /><Text style={[styles.headerTitle, { color: theme.card }]}>{settingsLanguage === "hi" ? "ठाकुर जी के दर्शन" : "Deity Darshan"}</Text></LinearGradient>
		{loading ? <View style={styles.empty}><ActivityIndicator color={theme.p[500]} size="large" /><Text style={{ color: theme.textMuted }}>{settingsLanguage === "hi" ? "लोड हो रहा है..." : "Loading..."}</Text></View> : <FlatList data={computed} numColumns={2} keyExtractor={(item) => item.id} contentContainerStyle={[styles.mandalGrid, { paddingBottom: insets.bottom + 24 }]} renderItem={({ item }) => {
			const ids = idsByRecency(item.gallery);
			return <Pressable onPress={() => { markSeen(`cpbs_darshan_mandal_${item.id}`, ids); setSelected(item); }} style={styles.mandalTile}><View style={[styles.mandalImage, { borderColor: item.gallery.length ? theme.p[500] : theme.border, backgroundColor: theme.card }]}>{item.gallery[0] ? <PhotoImage url={item.gallery[0].url} small /> : <Text style={{ color: theme.textMuted, fontSize: 26 }}>{item.name.charAt(0)}</Text>}{unseen(ids) && <View style={[styles.newBadge, { backgroundColor: theme.p[600] }]}><Text style={{ color: theme.card, fontSize: 9, fontWeight: "800" }}>NEW</Text></View>}</View><Text style={[styles.mandalName, { color: theme.text }]}>{item.name.replace(/\s*mandal\s*/i, "")}</Text></Pressable>;
		}} ListEmptyComponent={<View style={styles.empty}><ImageIcon color={theme.textMuted} size={48} /><Text style={{ color: theme.textMuted }}>{settingsLanguage === "hi" ? "अभी कोई दर्शन उपलब्ध नहीं है" : "No darshan available yet"}</Text></View>} />}
	</View>;
}

const styles = StyleSheet.create({
	// @ts-expect-error React Native web typings omit this legacy alias.
	root: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 4 }, headerButton: { padding: 8 }, headerTitle: { fontSize: 20, fontWeight: "700", flex: 1 }, mandalGrid: { padding: 16, alignItems: "center" }, mandalTile: { width: "50%", alignItems: "center", marginBottom: 18 }, mandalImage: { width: 88, height: 88, borderRadius: 50, borderWidth: 3, alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }, mandalName: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 7 }, newBadge: { position: "absolute", top: -1, right: -3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }, empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }, detailHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 5 }, detailTitle: { flex: 1, fontSize: 20, fontWeight: "700" }, modeButton: { padding: 9, borderRadius: 20 }, dateRow: { gap: 12, paddingHorizontal: 14, paddingBottom: 10 }, dateButton: { alignItems: "center", width: 72 }, dateImage: { width: 62, height: 62, borderRadius: 32, borderWidth: 3, overflow: "hidden" }, dateText: { fontSize: 11, fontWeight: "700", marginTop: 4 }, horizontalList: { paddingHorizontal: 10 }, stripList: { paddingHorizontal: 10, gap: 10 }, gridList: { paddingHorizontal: 10, gap: 8 }, photoCard: { width: 334, marginHorizontal: 5, marginBottom: 12, borderRadius: 14, borderWidth: 1, overflow: "hidden" }, photoImage: { height: 430, backgroundColor: "transparent" }, photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)" }, photoStats: { position: "absolute", bottom: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 5 }, photoStatText: { color: "#fff", fontSize: 12, fontWeight: "700" }, indexPill: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 }, indexText: { color: "#fff", fontSize: 10, fontWeight: "800" }, downloadButton: { position: "absolute", top: 9, right: 9, backgroundColor: "rgba(0,0,0,0.45)", padding: 7, borderRadius: 20 }, toast: { position: "absolute", bottom: 24, left: 16, right: 16, padding: 14, borderRadius: 16, borderWidth: 1 }, storyRoot: { flex: 1, backgroundColor: "#000" }, storyProgress: { position: "absolute", left: 8, right: 8, flexDirection: "row", gap: 4, zIndex: 4 }, progressTrack: { height: 3, flex: 1, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" }, progressFill: { height: "100%", borderRadius: 3 }, storyHeader: { position: "absolute", left: 12, right: 12, zIndex: 3, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, storyCount: { flexDirection: "row", alignItems: "center", gap: 8 }, storyAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" }, circleButton: { padding: 10, borderRadius: 30, backgroundColor: "rgba(0,0,0,0.3)" }, storyImageBox: { flex: 1, alignItems: "center", justifyContent: "center" }, storyTapArea: { width: "100%", height: "100%" }, storyImage: { width: "100%", height: "100%" }, storyFooter: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingTop: 24 }, storyActions: { flexDirection: "row", gap: 36 }, storyAction: { alignItems: "center", gap: 4 }, storyText: { color: "#fff", fontSize: 12, fontWeight: "700" }, dots: { flexDirection: "row", gap: 6, marginTop: 14 }, dot: { width: 6, height: 6, borderRadius: 3 },
});

import React, { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	FlatList,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	ArrowLeft,
	Calendar,
	Download,
	Eye,
	GalleryHorizontal,
	Heart,
	Image as ImageIcon,
	LayoutGrid,
	Play,
	PlayCircle,
	Share2,
	X,
} from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ReactNativeBlobUtil from "react-native-blob-util";
import * as Sharing from "expo-sharing";

import type { RootStackParamList } from "../navigation/types";
import { MANDAL_LIST } from "../data/mandals";
import { useHomeDataStore } from "../store/homeDataStore";
import { useSettingsStore } from "../store/settingsStore";
import { useAppTheme } from "../theme/useAppTheme";
import { blue, cream, pink, saffron } from "../theme/jmColors";
import { THUMB, thumbUrl } from "../lib/imageThumb";
import { webGet, webSet } from "../lib/webStore";
import { hasUnseen, idsByRecency, markSeen, useMarkVisitedOnMount, useSeenVersion } from "../lib/newBadge";
import { useMetrics } from "../hooks/useMetrics";
import { showToast } from "../store/toastStore";
import { VideoPlayerModal } from "../components/videos/VideoPlayerModal";

type Props = NativeStackScreenProps<RootStackParamList, "Activities">;
type GalleryItem = { id: string; url: string; date: string; order: number; displayName?: string };
type MandalVideo = { id: string; title: string; url: string; date?: string; thumbnailUrl?: string; order?: number };
type MandalData = {
	id: string;
	name: string;
	gallery: GalleryItem[];
	videos: MandalVideo[];
	weeklyProgram?: any;
	dailyPrograms?: Record<string, any>;
};
type ViewMode = "horizontal" | "strip" | "grid";

const dateKey = (value?: string) => {
	if (!value) return "";
	const parts = value.trim().split("-");
	return parts.length === 3 && parts[0].length === 2 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value.slice(0, 10);
};

const displayDate = (value: string, hindi: boolean) => {
	const d = new Date(`${dateKey(value)}T00:00:00`);
	if (Number.isNaN(d.getTime())) return value;
	return d.toLocaleDateString(hindi ? "hi-IN" : "en-US", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};

function photoSource(url: string, width: number) {
	return { uri: thumbUrl(url, width) };
}

function mergeActivities(rawMandals: any[], releases: any[], config: any): MandalData[] {
	const visible = new Set<number>((config?.visibleIds || []).map(Number));
	const order = (config?.folderOrder || []) as number[];
	const github: Record<string, GalleryItem[]> = {};
	const names: Record<string, string> = {};
	const releaseIds: Record<string, number> = {};
	const hidden = new Set<string>();

	for (const release of releases || []) {
		const lower = String(release.name || "").toLowerCase();
		const known = MANDAL_LIST.find((item: any) => lower.includes(item.id) || lower.includes(item.name.toLowerCase().replace(" mandal", "")));
		const id = known?.id || `github-${release.id}`;
		releaseIds[id] = Number(release.id);
		if (visible.size && !visible.has(Number(release.id))) hidden.add(id);
		names[id] = String(release.name || "").replace(/Activity Release for /i, "").replace(/Release for /i, "").replace(/\s*\(.*?\)\s*$/, "").trim();
		for (const asset of release.assets || []) {
			const match = String(asset.name || "").match(/^\[(.*?)\]\[(.*?)\]\[(.*?)\]\.(.*)$/);
			const created = new Date(asset.created_at);
			const date = match?.[1] || (Number.isNaN(created.getTime()) ? String(asset.created_at || "") : created.toISOString().slice(0, 10));
			(github[id] ||= []).push({ id: String(asset.id || asset.browser_download_url), url: asset.browser_download_url, date, order: Number(match?.[2] || 0), displayName: match?.[3] || String(asset.name || "").replace(/\.[^/.]+$/, "") });
		}
	}

	const output = new Map<string, MandalData>();
	for (const item of MANDAL_LIST as any[]) {
		if (hidden.has(item.id)) continue;
		const db = rawMandals.find((m) => m.id === item.id) || {};
		const firestoreGallery = (db.gallery || []).filter((g: any) => g.type === "activity").map((g: any) => ({ id: String(g.id || g.url), url: g.url, date: g.date || "", order: g.order || 0, displayName: g.displayName }));
		const source = firestoreGallery.length ? firestoreGallery : github[item.id] || [];
		const unique: GalleryItem[] = Array.from(new Map<string, GalleryItem>(source.map((g: GalleryItem) => [g.url, g])).values());
		const gallery = unique.filter((g) => !/\.(mp4|mkv|webm|ogg)$/i.test(g.url)).sort((a, b) => new Date(dateKey(b.date)).getTime() - new Date(dateKey(a.date)).getTime() || a.order - b.order);
		const extracted = unique.filter((g) => /\.(mp4|mkv|webm|ogg)$/i.test(g.url)).map((g) => ({ id: g.id, title: g.displayName || g.id, url: g.url, date: g.date, order: g.order }));
		const videos = [...(db.videos || []), ...extracted];
		if (gallery.length || videos.length || db.weeklyProgram?.enabled || Object.values(db.dailyPrograms || {}).some((p: any) => p?.enabled)) output.set(item.id, { id: item.id, name: item.name, gallery, videos, weeklyProgram: db.weeklyProgram, dailyPrograms: db.dailyPrograms || {} });
	}
	for (const id of Object.keys(github)) {
		if (!id.startsWith("github-") || hidden.has(id)) continue;
		const items = github[id];
		const gallery = items.filter((g) => !/\.(mp4|mkv|webm|ogg)$/i.test(g.url));
		const videos = items.filter((g) => /\.(mp4|mkv|webm|ogg)$/i.test(g.url)).map((g) => ({ id: g.id, title: g.displayName || g.id, url: g.url, date: g.date, order: g.order }));
		output.set(id, { id, name: names[id] || "Activity Folder", gallery, videos });
	}
	const values = Array.from(output.values());
	if (order.length) values.sort((a, b) => {
		const ia = order.indexOf(releaseIds[a.id] ?? -1);
		const ib = order.indexOf(releaseIds[b.id] ?? -1);
		return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
	});
	else values.reverse();
	return values;
}

function GalleryImage({ url, small = false }: { url: string; small?: boolean }) {
	const [source, setSource] = useState(photoSource(url, small ? THUMB.tile : THUMB.card));
	useEffect(() => setSource(photoSource(url, small ? THUMB.tile : THUMB.card)), [url, small]);
	return <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} onError={() => setSource({ uri: url })} />;
}

function StoryViewer({ images, initialIndex, onClose, getMetrics, incrementLike, incrementView, hasLiked }: any) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const [index, setIndex] = useState(initialIndex);
	const current = images[index];
	useEffect(() => { if (current?.id) incrementView(current.id); }, [current?.id, incrementView]);
	useEffect(() => {
		const timer = setTimeout(() => setIndex((old: number) => old + 1 >= images.length ? 0 : old + 1), 5000);
		return () => clearTimeout(timer);
	}, [index, images.length]);
	if (!current) return null;
	return <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
		<View style={[styles.storyRoot, { backgroundColor: theme.sunken }]}>
			<View style={[styles.storyTop, { paddingTop: insets.top + 8 }]}>
				<Text style={{ color: cream[25], fontWeight: "700" }}>{index + 1} / {images.length}</Text>
				<Pressable onPress={onClose} style={styles.circleButton}><X color={cream[25]} size={22} /></Pressable>
			</View>
			<Pressable style={styles.storyImageBox} onPress={(event) => setIndex((old: number) => event.nativeEvent.locationX < 125 ? Math.max(0, old - 1) : (old + 1) % images.length)}>
				<GalleryImage url={current.url} />
			</Pressable>
			<View style={[styles.storyFooter, { paddingBottom: insets.bottom + 14 }]}>
				<View style={styles.storyActions}>
					<Pressable onPress={() => incrementLike(current.id)} style={styles.storyAction}><Heart color={hasLiked(current.id) ? pink[500] : cream[25]} fill={hasLiked(current.id) ? pink[500] : "transparent"} size={28} /><Text style={styles.storyText}>{getMetrics(current.id).likes || 0}</Text></Pressable>
					<View style={styles.storyAction}><Eye color={cream[25]} size={28} /><Text style={styles.storyText}>{getMetrics(current.id).views || 0}</Text></View>
				</View>
			</View>
		</View>
	</Modal>;
}

function ActivityDetail({ mandal, initialDate, onBack }: { mandal: MandalData; initialDate?: string; onBack: () => void }) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage } = useSettingsStore();
	const isHindi = settingsLanguage === "hi";
	const [viewMode, setViewMode] = useState<ViewMode>(() => (webGet("cpbs_activity_view_mode") as ViewMode) || "horizontal");
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [story, setStory] = useState<{ images: GalleryItem[]; index: number } | null>(null);
	const [downloading, setDownloading] = useState<string | null>(null);
	const [selectedVideo, setSelectedVideo] = useState<MandalVideo | null>(null);
	const { getMetrics, incrementLike, incrementView, incrementViews, hasLiked } = useMetrics("activities");
	const sorted = useMemo(() => [...mandal.gallery].sort((a, b) => new Date(dateKey(b.date)).getTime() - new Date(dateKey(a.date)).getTime() || a.order - b.order || a.id.localeCompare(b.id)), [mandal.gallery]);
	const groups = useMemo(() => sorted.reduce<Record<string, GalleryItem[]>>((acc, item) => { (acc[dateKey(item.date)] ||= []).push(item); return acc; }, {}), [sorted]);
	const dates = useMemo(() => Array.from(new Set([...Object.keys(groups), ...mandal.videos.map((v) => dateKey(v.date))])).filter(Boolean).sort((a, b) => b.localeCompare(a)), [groups, mandal.videos]);
	const activeImages = selectedDate ? groups[selectedDate] || [] : sorted;
	useEffect(() => { webSet("cpbs_activity_view_mode", viewMode); }, [viewMode]);
	useEffect(() => { if (!selectedDate && dates.length) setSelectedDate(initialDate && dates.includes(dateKey(initialDate)) ? dateKey(initialDate) : dates[0]); }, [dates, initialDate, selectedDate]);
	useEffect(() => { if (activeImages.length) incrementViews(activeImages.map((item) => item.id)); }, [activeImages.length, selectedDate]);

	const download = async (item: GalleryItem) => {
		if (downloading) return;
		if (Platform.OS === "web") { showToast(isHindi ? "फोटो डाउनलोड हो गई है" : "Photo downloaded successfully", "success"); return; }
		setDownloading(item.id);
		try {
			const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/activity_${item.id}.jpg`;
			await ReactNativeBlobUtil.config({ fileCache: true, path }).fetch("GET", item.url);
			await Sharing.shareAsync(`file://${path}`, { dialogTitle: isHindi ? "तस्वीर साझा करें" : "Share photo", mimeType: "image/jpeg" });
			showToast(isHindi ? "फोटो डाउनलोड हो गई है" : "Photo downloaded successfully", "success");
		} catch { showToast("Download failed. Check internet connection.", "error"); }
		setDownloading(null);
	};
	const cycleMode = () => setViewMode((mode) => mode === "horizontal" ? "strip" : mode === "strip" ? "grid" : "horizontal");
	const card = ({ item, index }: { item: GalleryItem; index: number }) => <Pressable style={[styles.photoCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setStory({ images: activeImages, index })}>
		<View style={styles.photoImage}><GalleryImage url={item.url} /><View style={[styles.photoShade, { backgroundColor: theme.scrim }]} /><View style={styles.photoStats}><Eye color={cream[25]} size={12} /><Text style={styles.photoStatText}>{getMetrics(item.id).views || 0}</Text><Heart color={hasLiked(item.id) ? pink[500] : cream[25]} fill={hasLiked(item.id) ? pink[500] : "transparent"} size={12} /><Text style={styles.photoStatText}>{getMetrics(item.id).likes || 0}</Text></View><View style={styles.indexPill}><Text style={styles.indexText}>{index + 1} / {activeImages.length}</Text></View><Pressable style={styles.downloadButton} onPress={() => download(item)} disabled={downloading === item.id}>{downloading === item.id ? <ActivityIndicator color={cream[25]} size="small" /> : <Download color={cream[25]} size={14} />}</Pressable></View>
	</Pressable>;
	const modeIcon = viewMode === "horizontal" ? <PlayCircle color={cream[25]} size={20} /> : viewMode === "strip" ? <GalleryHorizontal color={cream[25]} size={20} /> : <LayoutGrid color={cream[25]} size={20} />;
	const dailyProgram = selectedDate ? (mandal.dailyPrograms?.[selectedDate] || mandal.dailyPrograms?.[displayDate(selectedDate, false)]) : null;
	return <View style={[styles.root, { backgroundColor: theme.page }]}>
		<LinearGradient colors={[theme.p[500], saffron[500]]} style={[styles.header, { paddingTop: insets.top + 8 }]}><Pressable onPress={onBack} style={styles.backButton}><ArrowLeft color={cream[25]} size={24} /></Pressable><View style={{ flex: 1 }}><Text style={styles.headerTitle}>{mandal.name.replace(/\s*mandal\s*/i, "")}</Text><Text style={styles.headerSubtitle}>Activity Gallery</Text></View><Pressable onPress={cycleMode} style={styles.headerAction}>{modeIcon}</Pressable></LinearGradient>
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>{dates.map((date) => <Pressable key={date} onPress={() => setSelectedDate(date)} style={styles.dateButton}><View style={[styles.dateImage, { borderColor: selectedDate === date ? pink[500] : theme.border }]}>{groups[date]?.[0] ? <GalleryImage url={groups[date][0].url} small /> : <Calendar color={theme.textMuted} size={22} />}</View><Text style={[styles.dateText, { color: selectedDate === date ? pink[600] : theme.textMuted }]}>{displayDate(date, isHindi)}</Text></Pressable>)}</ScrollView>
		{mandal.weeklyProgram?.enabled && <ProgramCard program={mandal.weeklyProgram} theme={theme} />}
		{dailyProgram?.enabled && <ProgramCard program={dailyProgram} theme={theme} />}
		{mandal.videos.length > 0 && <Pressable style={styles.videoStrip} onPress={() => setSelectedVideo(mandal.videos[0])}><PlayCircle color={cream[25]} size={27} /><View style={{ flex: 1 }}><Text style={styles.videoStripTitle}>{isHindi ? "सभी वीडियो देखें" : "Watch All Videos"}</Text><Text style={styles.videoStripText}>{isHindi ? `${mandal.videos.length} वीडियो उपलब्ध` : `${mandal.videos.length} videos available`}</Text></View><Share2 color={cream[25]} size={20} /></Pressable>}
		{activeImages.length === 0 ? <View style={styles.empty}><ImageIcon color={theme.textMuted} size={48} /><Text style={{ color: theme.textMuted }}>{isHindi ? "कोई गतिविधि उपलब्ध नहीं है" : "No activities available"}</Text></View> : viewMode === "horizontal" ? <FlatList data={activeImages} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(item) => item.id} renderItem={card} contentContainerStyle={styles.horizontalList} /> : viewMode === "strip" ? <FlatList data={activeImages} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(item) => item.id} renderItem={card} contentContainerStyle={styles.stripList} /> : <FlatList data={activeImages} numColumns={2} keyExtractor={(item) => item.id} renderItem={card} contentContainerStyle={[styles.gridList, { paddingBottom: insets.bottom + 24 }]} />}
		{story && <StoryViewer images={story.images} initialIndex={story.index} onClose={() => setStory(null)} getMetrics={getMetrics} incrementLike={incrementLike} incrementView={incrementView} hasLiked={hasLiked} />}
		{selectedVideo && <VideoPlayerModal video={selectedVideo} folderVideos={mandal.videos} onClose={() => setSelectedVideo(null)} onSelectVideo={setSelectedVideo} />}
	</View>;
}

function ProgramCard({ program, theme }: { program: any; theme: ReturnType<typeof useAppTheme> }) {
	return <View style={[styles.programCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.programTitle, { color: theme.text }]}><Calendar color={blue[500]} size={18} /> {program.title}</Text><Text style={[styles.programDescription, { color: theme.textSecondary }]}>{program.description}</Text><Text style={[styles.programDate, { color: theme.textMuted }]}>{program.date}</Text></View>;
}

export function ActivitiesScreen({ route, navigation }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage } = useSettingsStore();
	const isHindi = settingsLanguage === "hi";
	const { mandals, activityFolders, activityReleases, videos } = useHomeDataStore();
	const [selected, setSelected] = useState<MandalData | null>(null);
	const [showPhotos, setShowPhotos] = useState(Boolean(route.params?.initialShowPhotos));
	const [loading, setLoading] = useState(true);
	useSeenVersion();
	useMarkVisitedOnMount("activities");
	useEffect(() => { if (showPhotos) webSet("cpbs_seen_visit_photos", String(Date.now())); }, [showPhotos]);
	const computed = useMemo(() => mergeActivities(mandals, activityReleases, activityFolders), [mandals, activityReleases, activityFolders]);
	const mainMandals = computed.filter((item) => !item.name.toLowerCase().endsWith("gallery"));
	const galleryMandals = computed.filter((item) => item.name.toLowerCase().endsWith("gallery"));
	const videoIds = idsByRecency(videos);
	const photoIds = galleryMandals.flatMap((item) => idsByRecency(item.gallery).slice(0, 12));
	const videoNew = hasUnseen("cpbs_activity_video_main_latest", videoIds);
	const photoNew = hasUnseen("cpbs_activity_photos_main_latest", photoIds);
	useEffect(() => { if (activityFolders || mandals.length || activityReleases.length) setLoading(false); }, [activityFolders, mandals.length, activityReleases.length]);
	useEffect(() => { if (!route.params?.target_mandal || !computed.length) return; const target = computed.find((item) => item.id === route.params?.target_mandal || item.name.toLowerCase().includes(String(route.params?.target_mandal).toLowerCase())); if (target) { setShowPhotos(true); setSelected(target); } }, [computed, route.params?.target_mandal]);
	useEffect(() => { const onBack = () => { if (selected) { setSelected(null); return true; } if (showPhotos) { setShowPhotos(false); return true; } return false; }; const sub = BackHandler.addEventListener("hardwareBackPress", onBack); return () => sub.remove(); }, [selected, showPhotos]);
	const openMandal = (item: MandalData) => { markSeen(`cpbs_activity_gallery_${item.id}`, idsByRecency(item.gallery)); markSeen(`cpbs_activity_info_${item.id}`, item.weeklyProgram?.enabled ? [item.weeklyProgram.title || item.id] : []); setSelected(item); };
	const back = () => { if (selected) setSelected(null); else if (showPhotos) setShowPhotos(false); else navigation.goBack(); };
	const tile = ({ item }: { item: MandalData }) => { const galleryIds = idsByRecency(item.gallery); const videoIdsForItem = idsByRecency(item.videos); const infoIds = item.weeklyProgram?.enabled ? [item.weeklyProgram.title || item.id] : []; const isNew = hasUnseen(`cpbs_activity_gallery_${item.id}`, galleryIds) || hasUnseen(`cpbs_activity_info_${item.id}`, infoIds) || hasUnseen(`cpbs_activity_videos_latest_${item.id}`, videoIdsForItem); return <Pressable onPress={() => openMandal(item)} style={styles.mandalTile}><View style={[styles.mandalImage, { borderColor: isNew ? pink[500] : theme.border, backgroundColor: theme.card }]}>{item.gallery[0] ? <GalleryImage url={item.gallery[0].url} small /> : <Calendar color={pink[300]} size={32} />}{isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}<View style={styles.tileIcons}>{item.weeklyProgram?.enabled && <Calendar color={cream[25]} size={10} />}{item.gallery.length > 0 && <ImageIcon color={cream[25]} size={10} />}{item.videos.length > 0 && <Play color={cream[25]} size={10} />}</View></View><Text style={[styles.mandalName, { color: theme.text }]}>{item.name.replace(/\s*mandal\s*/i, "")}</Text></Pressable>; };
	if (selected) return <ActivityDetail mandal={selected} initialDate={route.params?.target_date} onBack={() => setSelected(null)} />;
	return <View style={[styles.root, { backgroundColor: theme.page }]}>
		<LinearGradient colors={[theme.p[500], saffron[500]]} style={[styles.header, { paddingTop: insets.top + 8, display: showPhotos ? "none" : "flex" }]}><Pressable onPress={back} style={styles.backButton}><ArrowLeft color={cream[25]} size={24} /></Pressable><Calendar color={cream[25]} size={23} /><Text style={styles.headerTitle}>{isHindi ? "हमारी गतिविधियाँ और गैलरी" : "Our Activities & Gallery"}</Text></LinearGradient>
		{showPhotos ? <View style={{ flex: 1 }}><LinearGradient colors={[theme.p[500], saffron[500]]} style={[styles.subHeader, { paddingTop: insets.top + 8 }]}><Pressable onPress={() => setShowPhotos(false)} style={styles.backButton}><ArrowLeft color={cream[25]} size={22} /></Pressable><ImageIcon color={cream[25]} size={22} /><Text style={[styles.subHeaderTitle, { color: cream[25] }]}>{isHindi ? "पिछली मीडिया गैलरी" : "Past Media Gallery"}</Text></LinearGradient>{loading ? <Loading theme={theme} hindi={isHindi} /> : galleryMandals.length === 0 ? <Empty icon="photos" theme={theme} hindi={isHindi} /> : <FlatList data={galleryMandals} numColumns={2} keyExtractor={(item) => item.id} contentContainerStyle={styles.grid} renderItem={tile} />}</View> : <View style={{ flex: 1 }}>{loading ? <Loading theme={theme} hindi={isHindi} /> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}><Pressable style={styles.videoCard} onPress={() => { markSeen("cpbs_activity_video_main_latest", videoIds); navigation.navigate("Videos"); }}><PlayCircle color={cream[25]} size={28} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{isHindi ? "वीडियो" : "Videos"}</Text><Text style={styles.cardSubtitle}>{isHindi ? "वीडियो संग्रह देखें" : "Watch video collections"}</Text></View>{videoNew && <Text style={styles.cardNew}>NEW</Text>}<ArrowLeft color={cream[25]} size={18} style={{ transform: [{ rotate: "180deg" }] }} /></Pressable><View style={styles.grid}>{mainMandals.length === 0 ? <Empty icon="photos" theme={theme} hindi={isHindi} /> : mainMandals.map((item) => <View key={item.id} style={{ width: "50%" }}>{tile({ item })}</View>)}</View><Pressable style={styles.photosCard} onPress={() => { markSeen("cpbs_activity_photos_main_latest", photoIds); setShowPhotos(true); }}><ImageIcon color={cream[25]} size={28} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{isHindi ? "पिछले इवेंट्स (मीडिया)" : "Past Events Media"}</Text><Text style={styles.cardSubtitle}>{isHindi ? "तस्वीरें और वीडियो देखें" : "View photos and videos"}</Text></View>{photoNew && <Text style={styles.cardNew}>NEW</Text>}<ArrowLeft color={cream[25]} size={18} style={{ transform: [{ rotate: "180deg" }] }} /></Pressable></ScrollView>}</View>}
	</View>;
}

function Loading({ theme, hindi }: { theme: ReturnType<typeof useAppTheme>; hindi: boolean }) { return <View style={styles.empty}><ActivityIndicator color={pink[500]} size="large" /><Text style={{ color: theme.textMuted }}>{hindi ? "लोड हो रहा है..." : "Loading..."}</Text></View>; }
function Empty({ theme, hindi, icon }: { theme: ReturnType<typeof useAppTheme>; hindi: boolean; icon: "photos" }) { return <View style={styles.empty}><ImageIcon color={theme.textMuted} size={48} /><Text style={{ color: theme.textMuted }}>{icon === "photos" ? (hindi ? "अभी कोई गतिविधि उपलब्ध नहीं है" : "No activities available yet") : ""}</Text></View>; }

const styles = StyleSheet.create({
	root: { flex: 1 },
	header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 4, gap: 8 },
	backButton: { padding: 8 },
	headerTitle: { color: cream[25], fontSize: 20, fontWeight: "700", flex: 1 },
	headerSubtitle: { color: cream[25], opacity: 0.9, fontSize: 12 },
	headerAction: { padding: 9, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)" },
	content: { padding: 16 },
	videoCard: { backgroundColor: pink[600], borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22, elevation: 4 },
	photosCard: { backgroundColor: blue[500], borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginTop: 12, elevation: 4 },
	cardTitle: { color: cream[25], fontSize: 18, fontWeight: "800" },
	cardSubtitle: { color: cream[25], opacity: 0.9, fontSize: 13, marginTop: 2 },
	cardNew: { color: pink[600], backgroundColor: cream[25], fontSize: 10, fontWeight: "900", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
	grid: { padding: 8, alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", width: "100%" },
	mandalTile: { width: "100%", alignItems: "center", marginBottom: 18, paddingHorizontal: 4 },
	mandalImage: { width: 80, height: 80, borderRadius: 16, borderWidth: 3, alignItems: "center", justifyContent: "center", overflow: "visible", position: "relative" },
	mandalName: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 7 },
	newBadge: { position: "absolute", top: -7, right: -8, backgroundColor: pink[600], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: cream[25] },
	newBadgeText: { color: cream[25], fontSize: 9, fontWeight: "900" },
	tileIcons: { position: "absolute", bottom: -7, alignSelf: "center", flexDirection: "row", gap: 2, backgroundColor: pink[500], padding: 2, borderRadius: 8 },
	subHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 8 },
	subHeaderTitle: { fontSize: 19, fontWeight: "700" },
	dateRow: { gap: 12, paddingHorizontal: 14, paddingBottom: 10 },
	dateButton: { alignItems: "center", width: 72 },
	dateImage: { width: 62, height: 62, borderRadius: 32, borderWidth: 3, overflow: "hidden", alignItems: "center", justifyContent: "center" },
	dateText: { fontSize: 11, fontWeight: "700", marginTop: 4 },
	programCard: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
	programTitle: { fontWeight: "800", fontSize: 16 },
	programDescription: { fontSize: 14, marginTop: 8 },
	programDate: { fontSize: 12, marginTop: 8 },
	videoStrip: { marginHorizontal: 16, marginBottom: 12, backgroundColor: pink[600], borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
	videoStripTitle: { color: cream[25], fontWeight: "800", fontSize: 17 },
	videoStripText: { color: cream[25], opacity: 0.9, fontSize: 13 },
	horizontalList: { paddingHorizontal: 10 },
	stripList: { paddingHorizontal: 10, gap: 10 },
	gridList: { paddingHorizontal: 10, gap: 8 },
	photoCard: { width: 334, marginHorizontal: 5, marginBottom: 12, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
	photoImage: { height: 430, backgroundColor: "transparent" },
	photoShade: { ...StyleSheet.absoluteFill },
	photoStats: { position: "absolute", bottom: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 5 },
	photoStatText: { color: cream[25], fontSize: 12, fontWeight: "700" },
	indexPill: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
	indexText: { color: cream[25], fontSize: 10, fontWeight: "800" },
	downloadButton: { position: "absolute", top: 9, right: 9, backgroundColor: "rgba(0,0,0,0.45)", padding: 7, borderRadius: 20 },
	empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
	storyRoot: { flex: 1 },
	storyTop: { position: "absolute", left: 14, right: 14, zIndex: 2, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	circleButton: { padding: 10, borderRadius: 30, backgroundColor: "rgba(0,0,0,0.3)" },
	storyImageBox: { flex: 1, alignItems: "center", justifyContent: "center" },
	storyFooter: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
	storyActions: { flexDirection: "row", gap: 36 },
	storyAction: { alignItems: "center", gap: 4 },
	storyText: { color: cream[25], fontSize: 12, fontWeight: "700" },
});

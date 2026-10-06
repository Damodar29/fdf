import React, { useEffect, useState, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Pressable, BackHandler, ActivityIndicator, Platform, Dimensions } from "react-native";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import { ArrowLeft, PlayCircle, Folder, Play, Heart, Eye, Share2, Calendar } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { FlashList } from "@shopify/flash-list";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ReactNativeBlobUtil from "react-native-blob-util";

import type { RootStackParamList } from "../navigation/types";
import { useHomeDataStore } from "../store/homeDataStore";
import { useSettingsStore } from "../store/settingsStore";
import { useAppTheme } from "../theme/useAppTheme";
import { useMarkVisitedOnMount, useSeenVersion, hasUnseen, markSeen, idsByRecency } from "../lib/newBadge";
import { useMetrics } from "../hooks/useMetrics";
import { toCdnUrl } from "../lib/cdnUrl";
import { THUMB, thumbUrl } from "../lib/imageThumb";
import { triggerHaptic } from "../lib/haptics";
import { showToast } from "../store/toastStore";
import { VideoPlayerModal } from "../components/videos/VideoPlayerModal";

type Props = NativeStackScreenProps<RootStackParamList, "Videos">;

export function VideosScreen({ route, navigation }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage } = useSettingsStore();
	const isHindi = settingsLanguage === "hi";

	const { videos, videoFolders } = useHomeDataStore();
	const loading = videos.length === 0 && videoFolders.length === 0;

	useSeenVersion(); // Re-render for NEW badges
	useMarkVisitedOnMount("videos");

	const { getMetrics, incrementLike, incrementViews, hasLiked } = useMetrics("videos");

	const t = {
		title: isHindi ? "वीडियो" : "Videos",
		foldersTitle: isHindi ? "वीडियो संग्रह" : "Video Collections",
		loading: isHindi ? "वीडियो लोड हो रहे हैं..." : "Loading videos...",
		noFolders: isHindi ? "अभी कोई संग्रह उपलब्ध नहीं है" : "No collections available yet",
		noVideos: isHindi ? "इस संग्रह में कोई वीडियो नहीं है" : "No videos in this collection",
	};

	const [selectedFolder, setSelectedFolder] = useState<any | null>(null);
	const [selectedVideo, setSelectedVideo] = useState<any | null>(null);

	// Handle initial route params for deep links
	useEffect(() => {
		if (loading) return;
		if (route.params?.initialFolderId) {
			const f = videoFolders.find((f) => f.id === route.params?.initialFolderId);
			if (f) setSelectedFolder(f);
		}
		if (route.params?.initialVideoId) {
			const v = videos.find((v) => v.id === route.params?.initialVideoId);
			if (v) {
				const f = videoFolders.find((f) => f.id === v.folderId);
				if (f) setSelectedFolder(f);
				setSelectedVideo(v);
			}
		}
	}, [loading, route.params?.initialFolderId, route.params?.initialVideoId, videos, videoFolders]);

	// Hardware Back Button
	useEffect(() => {
		const onBackPress = () => {
			if (selectedVideo) {
				setSelectedVideo(null);
				return true;
			}
			if (selectedFolder) {
				setSelectedFolder(null);
				return true;
			}
			return false;
		};
		const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
		return () => sub.remove();
	}, [selectedVideo, selectedFolder]);

	const handleBack = () => {
		if (selectedVideo) {
			setSelectedVideo(null);
		} else if (selectedFolder) {
			setSelectedFolder(null);
		} else {
			navigation.goBack();
		}
	};

	const getYouTubeVideoId = (url: string) => {
		const regExp = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/;
		const match = url.match(regExp);
		return match ? match[1] : null;
	};

	const getThumbnailUrl = (video: any) => {
		if (!video.useDefaultThumbnail && video.thumbnailUrl) return video.thumbnailUrl;
		const ytId = getYouTubeVideoId(video.url);
		if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
		return null;
	};

	const getFolderThumbnailUrl = (folder: any) => {
		if (!folder.useDefaultThumbnail && folder.thumbnailUrl) return folder.thumbnailUrl;
		const firstVideo = videos.find((v) => v.folderId === folder.id);
		if (firstVideo) return getThumbnailUrl(firstVideo);
		return null;
	};

	const handleShareFolder = async (folder: any) => {
		const url = `https://chaitanyaprembhakti.org/v/folder/${folder.id}`;
		const msg = isHindi
			? `🙏 'Prem Bhakti' app पर '${folder.name}' वीडियो देखें:\n\n${url}`
			: `🙏 Watch the '${folder.name}' video collection on 'Prem Bhakti' app:\n\n${url}`;
		try {
			const { Share } = require("react-native");
			await Share.share({ message: msg, title: folder.name });
		} catch (err) {}
	};

	const openFolder = (folder: any) => {
		const fv = videos.filter((v) => v.folderId === folder.id);
		if (fv.length > 0) {
			markSeen(`cpbs_video_folder_latest_${folder.id}`, idsByRecency(fv));
		}
		setSelectedFolder(folder);
	};

	// For Videos list metrics batch increment
	// Visible videos logic removed to match OG web app logic.

	const renderFolder = ({ item }: { item: any }) => {
		const thumb = getFolderThumbnailUrl(item);
		const fv = videos.filter((v) => v.folderId === item.id);
		const isNew = hasUnseen(`cpbs_video_folder_latest_${item.id}`, idsByRecency(fv));
		
		return (
			<Pressable style={[styles.folderCard, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => openFolder(item)}>
				<View style={styles.folderThumbWrapper}>
					{thumb ? (
						<Image 
							source={{ uri: thumbUrl(thumb, THUMB.medium) }} 
							style={styles.folderThumb} 
							contentPosition={{ left: `${item.thumbnailXOffset ?? 50}%`, top: `${item.thumbnailYOffset ?? 50}%` }}
						/>
					) : (
						<View style={[styles.folderThumbPlaceholder, { backgroundColor: theme.border }]}>
							<Folder color={theme.textMuted} size={32} />
						</View>
					)}
					<View style={styles.folderCountBadge}>
						<Play size={12} color="#fff" fill="#fff" />
						<Text style={styles.folderCountText}>{fv.length}</Text>
					</View>
				</View>
				<View style={styles.folderInfo}>
					<View style={styles.folderTitleRow}>
						<Text style={[styles.folderTitle, { color: theme.text }]} numberOfLines={2}>{item.name}</Text>
						{isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
					</View>
					<Pressable 
						style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.7 : 1 }]}
						onPress={() => handleShareFolder(item)}
					>
						<Share2 size={16} color={theme.textMuted} />
						<Text style={[styles.shareText, { color: theme.textMuted }]}>{isHindi ? "शेयर" : "Share"}</Text>
					</Pressable>
				</View>
			</Pressable>
		);
	};

	const renderVideo = ({ item, index }: { item: any; index: number }) => {
		const thumb = getThumbnailUrl(item);
		const metrics = getMetrics(item.id);
		const liked = hasLiked(item.id);

		return (
			<Pressable style={styles.videoCard} onPress={() => setSelectedVideo(item)}>
				<View style={[styles.videoThumbWrapper, { backgroundColor: theme.surface }]}>
					{thumb ? (
						<Image 
							source={{ uri: thumbUrl(thumb, THUMB.tile) }} 
							style={styles.videoThumb} 
							contentPosition={{ left: `${item.thumbnailXOffset ?? 50}%`, top: `${item.thumbnailYOffset ?? 50}%` }}
						/>
					) : (
						<View style={[styles.folderThumbPlaceholder, { backgroundColor: theme.border }]}>
							<PlayCircle color={theme.textMuted} size={32} />
						</View>
					)}
					<View style={styles.videoOverlay}>
						<Play size={24} color="#fff" fill="#fff" />
					</View>
					<View style={styles.videoOrderBadge}>
						<Text style={styles.videoOrderText}>#{item.order ?? index + 1}</Text>
					</View>
				</View>
				<View style={styles.videoInfo}>
					<Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
					<View style={styles.videoMetaRow}>
						<View style={styles.videoMetaLeft}>
							<View style={styles.metaStat}>
								<Heart size={12} color={liked ? "#ef4444" : theme.textMuted} fill={liked ? "#ef4444" : "transparent"} />
								<Text style={[styles.metaText, { color: theme.textMuted }]}>{metrics.likes || 0}</Text>
							</View>
							<View style={styles.metaStat}>
								<Eye size={12} color={theme.textMuted} />
								<Text style={[styles.metaText, { color: theme.textMuted }]}>{metrics.views || 0}</Text>
							</View>
						</View>
					</View>
				</View>
			</Pressable>
		);
	};

	const folderVideos = useMemo(() => {
		if (!selectedFolder) return [];
		return videos.filter((v) => v.folderId === selectedFolder.id);
	}, [selectedFolder, videos]);

	return (
		<View style={[styles.root, { backgroundColor: theme.page }]}>
			<LinearGradient colors={[theme.p[500], "#f97316"]} style={[styles.header, { paddingTop: insets.top }]}>
				<Pressable onPress={handleBack} style={styles.backBtn}>
					<ArrowLeft color="#fff" size={24} />
				</Pressable>
				<View style={styles.headerTitleRow}>
					{selectedFolder ? <Folder color="#fff" size={20} /> : <PlayCircle color="#fff" size={20} />}
					<Text style={styles.headerTitle}>{selectedFolder ? selectedFolder.name : t.title}</Text>
				</View>
			</LinearGradient>

			<View style={styles.content}>
				{loading ? (
					<View style={styles.center}>
						<ActivityIndicator size="large" color={theme.accent} />
						<Text style={[styles.centerText, { color: theme.textMuted, marginTop: 12 }]}>{t.loading}</Text>
					</View>
				) : !selectedFolder ? (
					videoFolders.length === 0 ? (
						<View style={styles.center}>
							<Folder size={48} color={theme.textMuted} style={{ opacity: 0.5, marginBottom: 12 }} />
							<Text style={[styles.centerText, { color: theme.textMuted }]}>{t.noFolders}</Text>
						</View>
					) : (
						<>
							{/* @ts-ignore */}
							<FlashList<any>
							{...({
								data: videoFolders,
								keyExtractor: (i: any) => i.id,
								renderItem: renderFolder,
								estimatedItemSize: 250,
								numColumns: 1,
								contentContainerStyle: styles.listContent,
							} as any)}
						/>
						</>
					)
				) : (
					folderVideos.length === 0 ? (
						<View style={styles.center}>
							<PlayCircle size={48} color={theme.textMuted} style={{ opacity: 0.5, marginBottom: 12 }} />
							<Text style={[styles.centerText, { color: theme.textMuted }]}>{t.noVideos}</Text>
						</View>
					) : (
						<>
							{/* @ts-ignore */}
							<FlashList<any>
							{...({
								data: folderVideos,
								keyExtractor: (i: any) => i.id,
								renderItem: renderVideo,
								estimatedItemSize: 200,
								numColumns: 2,
								contentContainerStyle: styles.listContent,
							} as any)}
						/>
						</>
					)
				)}
			</View>

			{selectedVideo && selectedFolder && (
				<VideoPlayerModal 
					video={selectedVideo}
					folderVideos={folderVideos}
					onClose={() => setSelectedVideo(null)}
					onSelectVideo={setSelectedVideo}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12, elevation: 4 },
	backBtn: { padding: 8, marginRight: 4 },
	headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
	content: { flex: 1 },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
	centerText: { fontSize: 16, textAlign: "center" },
	listContent: { padding: 12 },
	folderCard: { borderRadius: 16, overflow: "hidden", marginBottom: 16, borderWidth: 1, elevation: 1 },
	folderThumbWrapper: { width: "100%", height: 160, backgroundColor: "#000" },
	folderThumb: { width: "100%", height: "100%", opacity: 0.8 },
	folderThumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
	folderCountBadge: { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4 },
	folderCountText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
	folderInfo: { padding: 12 },
	folderTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
	folderTitle: { fontSize: 16, fontWeight: "bold", flex: 1, marginRight: 8 },
	newBadge: { backgroundColor: "#ef4444", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, marginTop: 2 },
	newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
	shareBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: "transparent", paddingVertical: 4 },
	shareText: { fontSize: 13, fontWeight: "600" },
	videoCard: { flex: 1, margin: 4, marginBottom: 16 },
	videoThumbWrapper: { width: "100%", aspectRatio: 16/9, borderRadius: 12, overflow: "hidden", marginBottom: 8, backgroundColor: "#000" },
	videoThumb: { width: "100%", height: "100%", opacity: 0.8 },
	videoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)" },
	videoOrderBadge: { position: "absolute", top: 4, left: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
	videoOrderText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
	videoInfo: { paddingHorizontal: 4 },
	videoTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18, marginBottom: 4 },
	videoMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	videoMetaLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
	metaStat: { flexDirection: "row", alignItems: "center", gap: 4 },
	metaText: { fontSize: 11 },
});

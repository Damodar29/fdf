import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, Platform, Linking, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { ArrowLeft, Play, Heart, Eye, Share2, Calendar, PlayCircle, SkipBack, SkipForward } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import YoutubeIframe from "react-native-youtube-iframe";

import { useSettingsStore } from "../../store/settingsStore";
import { useAppTheme } from "../../theme/useAppTheme";
import { useMetrics } from "../../hooks/useMetrics";
// removed formatDate
import { toCdnUrl } from "../../lib/cdnUrl";
import { THUMB, thumbUrl } from "../../lib/imageThumb";
import { triggerHaptic } from "../../lib/haptics";
import { showToast } from "../../store/toastStore";
import { CustomVideoPlayer } from "./CustomVideoPlayer";

const getYouTubeVideoId = (url: string) => {
	const regExp = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/;
	const match = url.match(regExp);
	return match ? match[1] : null;
};

// local date formatter equivalent to OG
const formatDisplayDateLocal = (dateStr: string, isHindi: boolean) => {
	try {
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return dateStr;
		return d.toLocaleDateString(isHindi ? "hi-IN" : "en-US", {
			day: "numeric", month: "short", year: "numeric"
		});
	} catch {
		return dateStr;
	}
};

interface Props {
	video: any;
	folderVideos: any[];
	onClose: () => void;
	onSelectVideo: (v: any) => void;
}

export function VideoPlayerModal({ video, folderVideos, onClose, onSelectVideo }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage } = useSettingsStore();
	const isHindi = settingsLanguage === "hi";

	const { getMetrics, incrementLike, incrementView, hasLiked } = useMetrics("videos");
	
	const [isDescExpanded, setIsDescExpanded] = useState(false);
	const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
	const [ytError, setYtError] = useState(false);

	const isYouTube = !!getYouTubeVideoId(video.url);
	const ytId = getYouTubeVideoId(video.url);

	useEffect(() => {
		setYtError(false);
		setIsDescExpanded(false);
		incrementView(video.id);
	}, [video.id, incrementView]);

	const getThumbnailUrl = (v: any) => {
		if (!v.useDefaultThumbnail && v.thumbnailUrl) return v.thumbnailUrl;
		const id = getYouTubeVideoId(v.url);
		if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
		return null;
	};

	const handleShareVideo = async () => {
		const url = `https://chaitanyaprembhakti.org/v/video/${video.id}`;
		const msg = isHindi
			? `🙏 'Prem Bhakti' app पर यह वीडियो देखें:\n\n${video.title}\n\n${url}`
			: `🙏 Watch this video on 'Prem Bhakti' app:\n\n${video.title}\n\n${url}`;
		try {
			const { Share } = require("react-native");
			await Share.share({ message: msg, title: video.title });
		} catch (err) {}
	};

	const currentIndex = folderVideos.findIndex((v) => v.id === video.id);
	const hasNext = currentIndex !== -1 && currentIndex < folderVideos.length - 1;
	const hasPrev = currentIndex > 0;

	const handleNext = () => {
		if (hasNext) onSelectVideo(folderVideos[currentIndex + 1]);
	};
	const handlePrev = () => {
		if (hasPrev) onSelectVideo(folderVideos[currentIndex - 1]);
	};

	const metrics = getMetrics(video.id);
	const liked = hasLiked(video.id);

	return (
		<Modal visible={true} transparent={false} animationType="slide" onRequestClose={onClose}>
			<View style={[styles.root, { backgroundColor: "#000" }]}>
				{/* Header */}
				{!isPlayerFullscreen && (
					<View style={[styles.header, { paddingTop: insets.top, backgroundColor: "#171717", borderBottomColor: "#262626" }]}>
						<Pressable onPress={onClose} style={styles.backBtn}>
							<ArrowLeft color="#fff" size={24} />
						</Pressable>
						<Text style={styles.headerTitle} numberOfLines={1}>{video.title}</Text>
					</View>
				)}

				<ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} bounces={false}>
					{/* Player Area */}
					<View style={[styles.playerContainer, { backgroundColor: "#000", height: isPlayerFullscreen ? "100%" : undefined, aspectRatio: isPlayerFullscreen ? undefined : 16/9 }]}>
						{isYouTube ? (
							ytError ? (
								<View style={styles.ytErrorContainer}>
									<View style={styles.ytErrorThumbWrapper}>
										<Image source={{ uri: thumbUrl(getThumbnailUrl(video) || "", THUMB.medium) }} style={styles.ytErrorThumb} />
										<View style={styles.ytErrorOverlay}>
											<View style={styles.ytIconWrapper}>
												<PlayCircle size={32} color="#ef4444" />
											</View>
										</View>
									</View>
									<View style={styles.ytErrorBody}>
										<Text style={styles.ytErrorText}>
											{isHindi ? "यह वीडियो केवल YouTube पर ही देखा जा सकता है।" : "This video can only be watched directly on YouTube."}
										</Text>
										<Pressable 
											style={styles.ytOpenBtn}
											onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${ytId}`)}
										>
											<Play size={20} color="#fff" fill="#fff" />
											<Text style={styles.ytOpenBtnText}>{isHindi ? "YouTube पर देखें" : "Watch on YouTube"}</Text>
										</Pressable>
									</View>
								</View>
							) : (
								<View style={styles.ytContainer}>
									<YoutubeIframe
										height={"100%"}
										width={"100%"}
										videoId={ytId!}
										play={true}
										onError={(e: unknown) => {
											if (e === "not_embeddable") setYtError(true);
										}}
										initialPlayerParams={{
											rel: false,
											preventFullScreen: true, // We rely on our own fullscreen logic or just standard native
										}}
									/>
								</View>
							)
						) : (
							<CustomVideoPlayer 
								video={video} 
								onNext={handleNext} 
								onPrev={handlePrev} 
								hasNext={hasNext} 
								hasPrev={hasPrev} 
								onFullscreenChange={setIsPlayerFullscreen}
							/>
						)}
					</View>

					{/* YouTube Fallback UI */}
					{isYouTube && !ytError && (
						<View style={styles.ytFallbackBar}>
							<Text style={styles.ytFallbackText}>Video unavailable?</Text>
							<Pressable style={styles.ytFallbackBtn} onPress={() => setYtError(true)}>
								<PlayCircle size={14} color="#f87171" />
								<Text style={styles.ytFallbackBtnText}>Open Youtube</Text>
							</Pressable>
						</View>
					)}

					{/* Title & Metadata */}
					<View style={[styles.infoSection, { backgroundColor: "#171717" }]}>
						<Text style={styles.videoTitle}>{video.title}</Text>
						<View style={styles.metaRow}>
							{video.date ? (
								<View style={styles.dateBadge}>
									<Calendar size={13} color="#a3a3a3" />
									<Text style={styles.dateText}>{formatDisplayDateLocal(video.date, isHindi)}</Text>
								</View>
							) : <View />}
							
							<View style={styles.actionsRow}>
								<Pressable 
									style={styles.actionBtn}
									onPress={() => {
										triggerHaptic("light");
										incrementLike(video.id);
									}}
								>
									<Heart size={18} color={liked ? "#ef4444" : "#d4d4d4"} fill={liked ? "#ef4444" : "transparent"} />
									<Text style={styles.actionText}>{metrics.likes || 0}</Text>
								</Pressable>
								<View style={styles.actionBtn}>
									<Eye size={18} color="#d4d4d4" />
									<Text style={styles.actionText}>{metrics.views || 0}</Text>
								</View>
								<Pressable style={styles.shareBtn} onPress={handleShareVideo}>
									<Share2 size={16} color="#fff" />
									<Text style={styles.shareBtnText}>{isHindi ? "शेयर" : "Share"}</Text>
								</Pressable>
							</View>
						</View>

						{isYouTube && (
							<View style={styles.ytControlsRow}>
								<Pressable style={[styles.ytControlBtn, !hasPrev && styles.ytControlBtnDisabled]} onPress={handlePrev} disabled={!hasPrev}>
									<SkipBack size={14} color={hasPrev ? "#fff" : "#525252"} />
									<Text style={[styles.ytControlText, !hasPrev && { color: "#525252" }]}>Prev</Text>
								</Pressable>
								<Pressable style={[styles.ytControlBtn, !hasNext && styles.ytControlBtnDisabled]} onPress={handleNext} disabled={!hasNext}>
									<Text style={[styles.ytControlText, !hasNext && { color: "#525252" }]}>Next</Text>
									<SkipForward size={14} color={hasNext ? "#fff" : "#525252"} />
								</Pressable>
							</View>
						)}
					</View>

					{/* Description */}
					<View style={styles.descSection}>
						{video.description && (
							<View style={styles.descWrapper}>
								<Text 
									style={styles.descText} 
									numberOfLines={isDescExpanded ? undefined : 3}
								>
									{video.description}
								</Text>
								{video.description.length > 100 && (
									<Pressable onPress={() => setIsDescExpanded(!isDescExpanded)} style={{ marginTop: 8 }}>
										<Text style={styles.descMoreBtn}>
											{isDescExpanded ? (isHindi ? "कम दिखाएं" : "Show Less") : (isHindi ? "और पढ़ें" : "Show More")}
										</Text>
									</Pressable>
								)}
							</View>
						)}

						{/* Up Next List */}
						{folderVideos.length > 1 && (
							<View style={styles.upNextSection}>
								<Text style={styles.upNextTitle}>UP NEXT</Text>
								{folderVideos.filter(v => v.id !== video.id).map((v) => (
									<Pressable key={v.id} style={styles.upNextCard} onPress={() => onSelectVideo(v)}>
										<View style={styles.upNextThumbWrapper}>
											<Image 
												source={{ uri: thumbUrl(getThumbnailUrl(v) || "", THUMB.tile) }} 
												style={styles.upNextThumb} 
												contentPosition={{ left: `${v.thumbnailXOffset ?? 50}%`, top: `${v.thumbnailYOffset ?? 50}%` }}
											/>
											<View style={styles.upNextThumbOverlay}>
												<Play size={16} color="#fff" fill="#fff" />
											</View>
											<View style={styles.upNextIndex}>
												<Text style={styles.upNextIndexText}>{folderVideos.findIndex(vid => vid.id === v.id) + 1}/{folderVideos.length}</Text>
											</View>
										</View>
										<View style={styles.upNextInfo}>
											<Text style={styles.upNextTitleText} numberOfLines={2}>{v.title}</Text>
											{v.date && <Text style={styles.upNextDate}>{formatDisplayDateLocal(v.date, isHindi)}</Text>}
										</View>
									</Pressable>
								))}
							</View>
						)}
					</View>
				</ScrollView>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: 1 },
	backBtn: { padding: 8, marginRight: 4 },
	headerTitle: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1, paddingRight: 16 },
	scroll: { flex: 1 },
	playerContainer: { width: "100%", zIndex: 10 },
	ytContainer: { width: "100%", height: "100%" },
	ytErrorContainer: { flex: 1, backgroundColor: "#171717", borderBottomWidth: 1, borderBottomColor: "#262626" },
	ytErrorThumbWrapper: { width: "100%", aspectRatio: 16/9, backgroundColor: "#000", overflow: "hidden" },
	ytErrorThumb: { width: "100%", height: "100%", opacity: 0.5 },
	ytErrorOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
	ytIconWrapper: { width: 64, height: 64, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
	ytErrorBody: { padding: 20, alignItems: "center" },
	ytErrorText: { color: "#d4d4d4", fontSize: 14, textAlign: "center", marginBottom: 16 },
	ytOpenBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#dc2626", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 8 },
	ytOpenBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
	ytFallbackBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#171717", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#262626" },
	ytFallbackText: { color: "#737373", fontSize: 12, fontWeight: "500" },
	ytFallbackBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(248,113,113,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
	ytFallbackBtnText: { color: "#f87171", fontSize: 12, fontWeight: "bold", textTransform: "uppercase" },
	infoSection: { backgroundColor: "#171717", padding: 16, paddingBottom: 12 },
	videoTitle: { color: "#fff", fontSize: 16, fontWeight: "600", lineHeight: 22 },
	metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
	dateBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
	dateText: { color: "#a3a3a3", fontSize: 12 },
	actionsRow: { flexDirection: "row", alignItems: "center", gap: 16 },
	actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
	actionText: { color: "#d4d4d4", fontSize: 14, fontWeight: "500" },
	shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginLeft: 8 },
	shareBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
	ytControlsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#262626" },
	ytControlBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#262626", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
	ytControlBtnDisabled: { backgroundColor: "rgba(38,38,38,0.5)" },
	ytControlText: { color: "#fff", fontSize: 14, fontWeight: "600" },
	descSection: { flex: 1, backgroundColor: "#171717", paddingTop: 16 },
	descWrapper: { paddingHorizontal: 16, paddingBottom: 16 },
	descText: { color: "#d4d4d4", fontSize: 14, lineHeight: 20 },
	descMoreBtn: { color: "#a3a3a3", fontSize: 14, fontWeight: "600" },
	upNextSection: { padding: 16, borderTopWidth: 1, borderTopColor: "#262626" },
	upNextTitle: { color: "#a3a3a3", fontSize: 12, fontWeight: "600", marginBottom: 12, letterSpacing: 1 },
	upNextCard: { flexDirection: "row", gap: 12, marginBottom: 12 },
	upNextThumbWrapper: { width: 120, height: 68, backgroundColor: "#000", borderRadius: 8, overflow: "hidden" },
	upNextThumb: { width: "100%", height: "100%", opacity: 0.8 },
	upNextThumbOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.1)" },
	upNextIndex: { position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
	upNextIndexText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
	upNextInfo: { flex: 1, paddingVertical: 2 },
	upNextTitleText: { color: "#fff", fontSize: 14, fontWeight: "500", lineHeight: 18 },
	upNextDate: { color: "#737373", fontSize: 12, marginTop: 4 },
});

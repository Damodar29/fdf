import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import ReactNativeBlobUtil from "react-native-blob-util";
import { ArrowLeft, ChevronRight, Download, ExternalLink, Eye, Heart, Info, Phone, Share2, MapPin, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { doc, getFirestore, onSnapshot, setDoc, increment } from "@react-native-firebase/firestore";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/types";
import { useHomeDataStore } from "../store/homeDataStore";
import { useSettingsStore } from "../store/settingsStore";
import { webGet, webSet, useWebStoreVersion } from "../lib/webStore";
import { useAppTheme } from "../theme/useAppTheme";
import { CommentsSection } from "../components/information/CommentsSection";
import { toCdnUrl } from "../lib/cdnUrl";
import { THUMB, thumbUrl } from "../lib/imageThumb";

type Props = NativeStackScreenProps<RootStackParamList, "Information">;

export function InformationScreen({ route, navigation }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage } = useSettingsStore();
	const isHindi = settingsLanguage === "hi";
	const data = useHomeDataStore((s) => s.information) || { enabled: false, title: "" };
	
	// Read keys from webStore
	useWebStoreVersion();
	
	const getReadIds = () => {
		try {
			return JSON.parse(webGet("cpbs_read_info_ids") || "[]") as string[];
		} catch {
			return [];
		}
	};
	const readIds = getReadIds();

	const [selectedItem, setSelectedItem] = useState<any>(null);
	const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
	const [isSharing, setIsSharing] = useState(false);
	
	const items = useMemo(() => {
		if (!data.enabled) return [];
		if (data.items && data.items.length > 0) {
			const now = Date.now();
			return data.items.filter((i) => i.isEnabled !== false && (!i.expiryDate || i.expiryDate > now));
		}
		if (data.title || data.text) {
			return [{
				id: "legacy_id",
				title: data.title || "",
				text: data.text || "",
				images: [data.imageUrl, data.imageUrl2, data.imageUrl3].filter(Boolean) as string[],
				actionType: "none",
				createdAt: Date.now(),
			}];
		}
		return [];
	}, [data]);

	const initialItemId = route.params?.initialItemId;
	
	useEffect(() => {
		if (initialItemId && items.length > 0 && !selectedItem) {
			const item = items.find((i) => i.id === initialItemId);
			if (item) {
				openItem(item);
			}
		}
	}, [initialItemId, items]);

	const openItem = (item: any) => {
		setSelectedItem(item);
		if (!readIds.includes(item.id)) {
			const newReadIds = [...readIds, item.id];
			webSet("cpbs_read_info_ids", JSON.stringify(newReadIds));
			webSet("cpbs_last_read_info_title", item.title);
		}
	};

	const handleBack = () => {
		if (selectedImageIndex !== null) {
			setSelectedImageIndex(null);
		} else if (selectedItem) {
			setSelectedItem(null);
		} else {
			navigation.goBack();
		}
	};

	const getImages = (item: any) => {
		if (item.images && item.images.length > 0) return item.images;
		return [item.imageUrl, item.imageUrl2, item.imageUrl3].filter(Boolean) as string[];
	};

	// --- Details States ---
	const [viewCount, setViewCount] = useState(0);
	const [likeCount, setLikeCount] = useState(0);
	const [hasLiked, setHasLiked] = useState(false);

	useEffect(() => {
		if (!selectedItem) return;
		const itemId = selectedItem.id;
		
		let likedItems: string[] = [];
		try { likedItems = JSON.parse(webGet("cpbs_liked_info") || "[]"); } catch {}
		setHasLiked(likedItems.includes(itemId));

		let viewedItems: string[] = [];
		try { viewedItems = JSON.parse(webGet("cpbs_viewed_info") || "[]"); } catch {}
		
		if (!viewedItems.includes(itemId)) {
			viewedItems.push(itemId);
			webSet("cpbs_viewed_info", JSON.stringify(viewedItems));
			if (Platform.OS !== "web") {
				const db = getFirestore();
				setDoc(doc(db, "information_interactions", itemId), {
					viewCount: increment(1)
				}, { merge: true }).catch(() => {});
			}
		}

		if (Platform.OS !== "web") {
			const db = getFirestore();
			const unsub = onSnapshot(doc(db, "information_interactions", itemId), (snap: any) => {
				if (snap.exists()) {
					const d = snap.data();
					setViewCount(d?.viewCount || 0);
					setLikeCount(d?.likeCount || 0);
				}
			});
			return () => unsub();
		}
	}, [selectedItem]);

	const handleLike = async () => {
		if (!selectedItem || hasLiked) return;
		const itemId = selectedItem.id;
		
		let likedItems: string[] = [];
		try { likedItems = JSON.parse(webGet("cpbs_liked_info") || "[]"); } catch {}
		if (!likedItems.includes(itemId)) {
			likedItems.push(itemId);
			webSet("cpbs_liked_info", JSON.stringify(likedItems));
			setHasLiked(true);
			if (Platform.OS !== "web") {
				const db = getFirestore();
				setDoc(doc(db, "information_interactions", itemId), {
					likeCount: increment(1)
				}, { merge: true }).catch(() => {});
			}
		}
	};

	const handleShare = async () => {
		if (isSharing || !selectedItem) return;
		setIsSharing(true);
		try {
			let shareText = selectedItem.text
				? `${selectedItem.title}\n\n${selectedItem.text}`
				: selectedItem.title;

			if (selectedItem.actionType && selectedItem.actionType !== "none" && selectedItem.actionTarget) {
				const actionLabel = selectedItem.actionLabel || (isHindi ? "यहाँ क्लिक करें" : "Click Here");
				let actionUrl = selectedItem.actionTarget;
				if (selectedItem.actionType === "phone") actionUrl = `tel:${selectedItem.actionTarget}`;
				shareText += `\n\n${actionLabel}: ${actionUrl}`;
			}

			const images = getImages(selectedItem);
			if (images.length > 0 && Platform.OS !== "web") {
				const imageUrl = toCdnUrl(images[0]);
				const localFile = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/share_info.jpg`;
				await ReactNativeBlobUtil.config({ fileCache: true, path: localFile }).fetch("GET", imageUrl);
				await Sharing.shareAsync(`file://${localFile}`, { dialogTitle: selectedItem.title });
			} else {
				// No image, share text (wait, sharing text natively without image? We can use Linking or Share API, but the OG uses navigator.share)
				// For native text sharing, React Native Share API or expo-sharing can be used, but since we are replacing navigator.share:
				if (Platform.OS !== "web") {
					// Share just text using react-native Share
					const { Share } = require("react-native");
					await Share.share({ message: shareText, title: selectedItem.title });
				}
			}
		} catch (e) {
			console.error("Share failed", e);
		} finally {
			setIsSharing(false);
		}
	};

	const handleDownload = async (url: string) => {
		if (Platform.OS === "web") return;
		try {
			const cdn = toCdnUrl(url);
			const localFile = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/info_download.jpg`;
			await ReactNativeBlobUtil.config({ fileCache: true, path: localFile }).fetch("GET", cdn);
			await Sharing.shareAsync(`file://${localFile}`, { UTI: "public.jpeg", mimeType: "image/jpeg" });
		} catch (err) {}
	};

	const openLink = (url: string) => {
		Linking.openURL(url).catch(() => {});
	};

	// --- Render Helpers ---
	const renderTextWithLinks = (text: string) => {
		if (!text) return null;
		let cleaned = text.replace(/Location\s*[\n\r]*\s*\(?(?=https?:\/\/)/gi, "");
		cleaned = cleaned.replace(/\((https?:\/\/[^\s)]+)\)/g, "$1");
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const phoneRegex = /(\b\d{10}\b)/g;
		const parts = cleaned.split(urlRegex);

		return parts.map((part, index) => {
			if (part.match(urlRegex)) {
				const url = part.replace(/[).,;:!?]+$/, "");
				const isMapLink = url.includes("maps.google") || url.includes("goo.gl/maps") || url.includes("maps.app.goo.gl");
				return (
					<Pressable key={index} style={styles.linkBtn} onPress={() => openLink(url)}>
						{isMapLink ? (
							<Text style={styles.linkBtnText}>{isHindi ? "📍 दिशा-निर्देश प्राप्त करें" : "📍 Get Directions"}</Text>
						) : (
							<>
								<ExternalLink size={16} color="#2563eb" />
								<Text style={styles.linkBtnText}>{isHindi ? "लिंक खोलें" : "Open Link"}</Text>
							</>
						)}
					</Pressable>
				);
			} else {
				const subParts = part.split(phoneRegex);
				return subParts.map((subPart, subIndex) => {
					if (subPart.match(phoneRegex)) {
						return (
							<Pressable key={`${index}-${subIndex}`} style={styles.phoneBtn} onPress={() => openLink(`tel:${subPart}`)}>
								<Phone size={16} color="#16a34a" />
								<Text style={styles.phoneBtnText}>{subPart}</Text>
							</Pressable>
						);
					}
					const trimmed = subPart.trim();
					if (trimmed === "," || trimmed === "." || trimmed === "،") return null;
					return <Text key={`${index}-${subIndex}`} style={[styles.bodyText, { color: theme.text }]}>{subPart}</Text>;
				});
			}
		});
	};

	// --- Zoom Handlers ---
	const scale = useSharedValue(1);
	const tx = useSharedValue(0);
	const ty = useSharedValue(0);
	const savedScale = useSharedValue(1);

	const pinch = Gesture.Pinch()
		.onUpdate((e) => {
			scale.value = savedScale.value * e.scale;
		})
		.onEnd(() => {
			savedScale.value = scale.value;
			if (scale.value < 1) {
				scale.value = withTiming(1);
				savedScale.value = 1;
				tx.value = withTiming(0);
				ty.value = withTiming(0);
			}
		});

	const pan = Gesture.Pan()
		.onUpdate((e) => {
			if (scale.value > 1) {
				tx.value = e.translationX;
				ty.value = e.translationY;
			}
		})
		.onEnd(() => {
			if (scale.value <= 1) {
				tx.value = withTiming(0);
				ty.value = withTiming(0);
			}
		});

	const composed = Gesture.Simultaneous(pinch, pan);
	const rStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
	}));

	if (!data.enabled || items.length === 0) {
		return (
			<View style={[styles.root, { backgroundColor: theme.page }]}>
				<LinearGradient colors={["#f97316", "#f59e0b"]} style={[styles.headerGradient, { paddingTop: insets.top }]}>
					<Pressable onPress={handleBack} style={styles.backBtn}>
						<ArrowLeft color="#fff" size={24} />
					</Pressable>
					<Info color="#fff" size={24} />
					<Text style={styles.headerTitle}>{isHindi ? "सूचना" : "Information"}</Text>
				</LinearGradient>
				<View style={styles.emptyContainer}>
					<Info size={48} color={theme.accent} style={{ marginBottom: 16 }} />
					<Text style={[styles.emptyTitle, { color: theme.text }]}>{isHindi ? "कोई नई सूचना नहीं" : "No New Information"}</Text>
					<Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
						{isHindi ? "वर्तमान में कोई नई सूचना उपलब्ध नहीं है। कृपया बाद में देखें।" : "There is currently no new information available. Please check back later."}
					</Text>
				</View>
			</View>
		);
	}

	if (!selectedItem) {
		return (
			<View style={[styles.root, { backgroundColor: theme.page }]}>
				<LinearGradient colors={["#f97316", "#f59e0b"]} style={[styles.headerGradient, { paddingTop: insets.top }]}>
					<Pressable onPress={handleBack} style={styles.backBtn}>
						<ArrowLeft color="#fff" size={24} />
					</Pressable>
					<Info color="#fff" size={24} />
					<Text style={styles.headerTitle}>{isHindi ? "सूचना" : "Information"}</Text>
				</LinearGradient>
				<ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}>
					{items.map((item) => {
						const isUnread = !readIds.includes(item.id);
						const firstImage = getImages(item)[0];
						return (
							<Pressable key={item.id} style={[styles.listItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => openItem(item)}>
								{firstImage && (
									<View style={styles.listImgWrapper}>
										<Image source={{ uri: thumbUrl(firstImage, THUMB.tile) }} style={styles.listImg} />
									</View>
								)}
								<View style={styles.listBody}>
									<View style={styles.listHeaderRow}>
										<Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
										{isUnread && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
									</View>
									<Text style={[styles.listPreview, { color: theme.textMuted }]} numberOfLines={2}>{item.text || "..."}</Text>
									<View style={styles.readMoreRow}>
										<Text style={styles.readMoreText}>{isHindi ? "और पढ़ें" : "Read More"}</Text>
										<ChevronRight size={16} color="#2563eb" />
									</View>
								</View>
							</Pressable>
						);
					})}
				</ScrollView>
			</View>
		);
	}

	const images = getImages(selectedItem);

	return (
		<View style={[styles.root, { backgroundColor: theme.page }]}>
			<LinearGradient colors={["#f97316", "#f59e0b"]} style={[styles.headerGradient, { paddingTop: insets.top }]}>
				<Pressable onPress={handleBack} style={styles.backBtn}>
					<ArrowLeft color="#fff" size={24} />
				</Pressable>
				<View style={styles.headerActions}>
					<View style={styles.statsBadge}>
						<Eye size={16} color="#334155" />
						<Text style={styles.statsText}>{viewCount}</Text>
					</View>
					<Pressable onPress={handleShare} style={styles.actionBtn}>
						{isSharing ? <ActivityIndicator size="small" color="#334155" /> : <Share2 size={16} color="#334155" />}
					</Pressable>
				</View>
			</LinearGradient>
			
			<ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: insets.bottom + 32 }]}>
				<Text style={[styles.detailTitle, { color: theme.text }]}>{selectedItem.title}</Text>
				<View style={styles.divider} />
				
				{images.length > 0 && (
					<View style={styles.gallery}>
						{images.map((src: string, index: number) => (
							<Pressable key={index} style={[styles.galleryItem, { borderColor: theme.border, width: images.length > 1 ? "48%" : "100%" }]} onPress={() => { scale.value = 1; savedScale.value = 1; tx.value = 0; ty.value = 0; setSelectedImageIndex(index); }}>
								<Image source={{ uri: thumbUrl(src, THUMB.card) }} style={styles.galleryImg} contentFit="contain" />
								{images.length > 1 && (
									<View style={styles.galleryIndex}>
										<Text style={styles.galleryIndexText}>{index + 1} / {images.length}</Text>
									</View>
								)}
								<Pressable style={styles.downloadBtn} onPress={() => handleDownload(src)}>
									<Download size={16} color="#fff" />
								</Pressable>
							</Pressable>
						))}
					</View>
				)}

				<Text style={[styles.bodyText, { color: theme.text }]}>{renderTextWithLinks(selectedItem.text)}</Text>

				{selectedItem.actionType && selectedItem.actionType !== "none" && (
					<Pressable 
						style={[styles.smartAction, { backgroundColor: selectedItem.actionType === "phone" ? "#16a34a" : selectedItem.actionType === "location" ? "#4f46e5" : "#2563eb" }]}
						onPress={() => {
							const t = selectedItem.actionTarget;
							if (selectedItem.actionType === "phone") openLink(`tel:${t}`);
							else if (t) openLink(t);
						}}
					>
						{selectedItem.actionType === "phone" ? <Phone size={20} color="#fff" /> : selectedItem.actionType === "location" ? <MapPin size={20} color="#fff" /> : <ExternalLink size={20} color="#fff" />}
						<Text style={styles.smartActionText}>
							{selectedItem.actionLabel || (isHindi ? "यहां क्लिक करें" : "Click Here")}
						</Text>
					</Pressable>
				)}

				<View style={[styles.footerActions, { borderTopColor: theme.border }]}>
					<Pressable onPress={handleLike} style={[styles.likeBtn, { backgroundColor: hasLiked ? "#fef2f2" : theme.surface, borderColor: hasLiked ? "#fecaca" : theme.border }]}>
						<Heart size={20} color={hasLiked ? "#ef4444" : theme.textMuted} fill={hasLiked ? "#ef4444" : "transparent"} />
						<Text style={[styles.likeText, { color: hasLiked ? "#ef4444" : theme.text }]}>
							{likeCount} {isHindi ? "पसंद" : "Likes"}
						</Text>
					</Pressable>
				</View>

				<CommentsSection itemId={selectedItem.id} category="information" />
			</ScrollView>

			{/* Fullscreen Viewer */}
			{selectedImageIndex !== null && (
				<View style={styles.lightbox}>
					<View style={[styles.lightboxHeader, { paddingTop: insets.top + 8 }]}>
						<Pressable style={styles.lightboxBtn} onPress={() => setSelectedImageIndex(null)}>
							<X size={24} color="#fff" />
						</Pressable>
						<View style={styles.lightboxRight}>
							<View style={styles.lightboxCounter}>
								<Text style={styles.lightboxCounterText}>{selectedImageIndex + 1} / {images.length}</Text>
							</View>
							<Pressable style={styles.lightboxBtn} onPress={() => handleDownload(images[selectedImageIndex])}>
								<Download size={20} color="#fff" />
							</Pressable>
						</View>
					</View>
					<GestureDetector gesture={composed}>
						<Animated.View style={[styles.lightboxImgWrapper, rStyle]}>
							<Image source={{ uri: toCdnUrl(images[selectedImageIndex]) }} style={styles.lightboxImg} contentFit="contain" />
						</Animated.View>
					</GestureDetector>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	headerGradient: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12, elevation: 4 },
	backBtn: { padding: 8, marginRight: 4 },
	headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold", marginLeft: 8 },
	emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
	emptyTitle: { fontSize: 24, fontWeight: "900", marginBottom: 12 },
	emptySubtitle: { fontSize: 16, textAlign: "center", lineHeight: 24 },
	listContent: { padding: 16, gap: 16 },
	listItem: { flexDirection: "row", borderRadius: 24, padding: 12, borderWidth: 1, gap: 12 },
	listImgWrapper: { width: 96, height: 96, borderRadius: 16, overflow: "hidden", backgroundColor: "#f1f5f9" },
	listImg: { width: "100%", height: "100%" },
	listBody: { flex: 1, justifyContent: "center", paddingVertical: 4 },
	listHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
	listTitle: { fontSize: 18, fontWeight: "bold", flex: 1, marginRight: 8, lineHeight: 22 },
	newBadge: { backgroundColor: "#ef4444", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, marginTop: 2 },
	newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
	listPreview: { fontSize: 14, lineHeight: 20 },
	readMoreRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 4 },
	readMoreText: { color: "#2563eb", fontSize: 14, fontWeight: "bold" },
	headerActions: { flexDirection: "row", marginLeft: "auto", alignItems: "center", gap: 8, paddingRight: 8 },
	statsBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
	statsText: { fontSize: 14, fontWeight: "500", color: "#334155" },
	actionBtn: { backgroundColor: "#f1f5f9", padding: 8, borderRadius: 20 },
	detailContent: { padding: 20 },
	detailTitle: { fontSize: 28, fontWeight: "900", lineHeight: 34, marginBottom: 16 },
	divider: { width: 64, height: 6, backgroundColor: "#3b82f6", borderRadius: 3, marginBottom: 24 },
	gallery: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
	galleryItem: { height: 200, borderRadius: 16, borderWidth: 1, overflow: "hidden", backgroundColor: "#f8fafc" },
	galleryImg: { width: "100%", height: "100%" },
	galleryIndex: { position: "absolute", top: 12, left: 12, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
	galleryIndexText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
	downloadBtn: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 16 },
	bodyText: { fontSize: 18, lineHeight: 28 },
	linkBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#eff6ff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: "flex-start", marginVertical: 12, gap: 8, borderWidth: 1, borderColor: "#bfdbfe" },
	linkBtnText: { color: "#2563eb", fontWeight: "600" },
	phoneBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: "flex-start", marginVertical: 12, gap: 8, borderWidth: 1, borderColor: "#bbf7d0" },
	phoneBtnText: { color: "#16a34a", fontWeight: "600" },
	smartAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 16, marginTop: 32, gap: 12 },
	smartActionText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
	footerActions: { flexDirection: "row", justifyContent: "center", marginTop: 32, paddingTop: 24, borderTopWidth: 1 },
	likeBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, borderWidth: 1, gap: 8 },
	likeText: { fontSize: 16, fontWeight: "bold" },
	lightbox: { ...StyleSheet.absoluteFill, backgroundColor: "#000", zIndex: 100 },
	lightboxHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", padding: 16, zIndex: 110, backgroundColor: "rgba(0,0,0,0.3)" },
	lightboxBtn: { padding: 12, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 24 },
	lightboxRight: { flexDirection: "row", alignItems: "center", gap: 12 },
	lightboxCounter: { backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
	lightboxCounterText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
	lightboxImgWrapper: { flex: 1, alignItems: "center", justifyContent: "center" },
	lightboxImg: { width: "100%", height: "100%" },
});

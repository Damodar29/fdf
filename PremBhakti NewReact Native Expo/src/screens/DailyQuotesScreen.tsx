import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Download, Maximize2, RefreshCw, Share2, WifiOff, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { storage } from "../lib/storage";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import { ink } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";
import { triggerHaptic } from "../lib/haptics";

const EXTENSIONS = ["PNG", "JPG", "jpg", "png", "jpeg"];

const HINDI_MONTHS = [
	"जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
	"जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const getStaticDayOfYear = (date: Date) => {
	const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	let doy = 0;
	for (let i = 0; i < date.getMonth(); i++) doy += days[i];
	return doy + date.getDate();
};

const getQuoteImageUrl = (date: Date, extIdx: number) => {
	const dayOfYear = getStaticDayOfYear(date);
	const dayOfYearStr = String(dayOfYear).padStart(3, "0");
	const dayOfMonth = date.getDate();
	const monthStr = MONTHS_SHORT[date.getMonth()];
	const ext = EXTENSIONS[extIdx];
	return `https://images.chaitanyaprembhakti.org/dailyquotes_1/${dayOfYearStr}.${dayOfMonth}.${monthStr}.${ext}`;
};

export function DailyQuotesScreen({ navigation }: any) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const { settingsLanguage } = useSettingsStore();
	const isHindi = settingsLanguage === "hi";

	const [currentDate, setCurrentDate] = useState(new Date());
	const [imageError, setImageError] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [extensionIndex, setExtensionIndex] = useState(0);
	const [retryCount, setRetryCount] = useState(0);
	const [isDownloading, setIsDownloading] = useState(false);
	const [isSharing, setIsSharing] = useState(false);
	const [isLightboxOpen, setIsLightboxOpen] = useState(false);

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const currentCheck = new Date(currentDate);
	currentCheck.setHours(0, 0, 0, 0);

	const isToday = currentCheck.getTime() === today.getTime();
	const jan1 = new Date(today.getFullYear(), 0, 1);
	const isJan1 = currentCheck.getTime() === jan1.getTime();

	useEffect(() => {
		if (isToday) {
			const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
			storage.set("cpbs_quote_last_seen_date", todayStr);
			if (new Date().getHours() >= 16) {
				storage.set("cpbs_quote_last_seen_afternoon", todayStr);
			}
		}
	}, [isToday]);

	useEffect(() => {
		setIsLoading(true);
		setImageError(false);
		setExtensionIndex(0);
	}, [currentDate, retryCount]);

	const quoteImage = getQuoteImageUrl(currentDate, extensionIndex);

	const changeDate = (days: number) => {
		const newDate = new Date(currentDate);
		newDate.setDate(newDate.getDate() + days);

		const checkNew = new Date(newDate);
		checkNew.setHours(0, 0, 0, 0);

		if (checkNew > today) return;
		if (checkNew < jan1) return;

		triggerHaptic("light");
		setCurrentDate(newDate);
	};

	const handleToday = () => {
		triggerHaptic("light");
		setCurrentDate(new Date());
	};

	const handleDownload = async () => {
		if (isDownloading || imageError) return;
		setIsDownloading(true);
		try {
			const ext = EXTENSIONS[extensionIndex];
			const fileName = `Quote_${currentDate.getTime()}.${ext}`;
			const tmp = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
			const res = await ReactNativeBlobUtil.config({ path: tmp }).fetch('GET', quoteImage);
			if (res.info().status >= 400) throw new Error("HTTP " + res.info().status);
			
			const mimeType = ext.toUpperCase() === "PNG" ? "image/png" : "image/jpeg";
			await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
				{ name: fileName, parentFolder: "Prem Bhakti/Quotes", mimeType },
				"Image",
				tmp
			);
			await ReactNativeBlobUtil.fs.unlink(tmp).catch(() => {});
			
			showToast(isHindi ? "सुविचार डाउनलोड हो गया है" : "Quote downloaded successfully", "success");
		} catch (e) {
			showToast("Download failed. Check internet connection.", "error");
		} finally {
			setIsDownloading(false);
		}
	};

	const handleShare = async () => {
		if (isSharing || imageError) return;
		setIsSharing(true);
		try {
			const ext = EXTENSIONS[extensionIndex];
			const fileName = `Quote_${currentDate.getTime()}.${ext}`;
			const tmp = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
			const res = await ReactNativeBlobUtil.config({ path: tmp }).fetch('GET', quoteImage);
			if (res.info().status >= 400) throw new Error("HTTP " + res.info().status);
			
			const mimeType = ext.toUpperCase() === "PNG" ? "image/png" : "image/jpeg";
			await Sharing.shareAsync(`file://${tmp}`, { dialogTitle: "Share Quote", mimeType });
		} catch (e) {
			console.error("Share failed", e);
		} finally {
			setIsSharing(false);
		}
	};

	// Lightbox Zoom Logic
	const scale = useSharedValue(1);
	const savedScale = useSharedValue(1);
	const tx = useSharedValue(0);
	const ty = useSharedValue(0);
	const savedTx = useSharedValue(0);
	const savedTy = useSharedValue(0);
	const [zoomPercent, setZoomPercent] = useState(100);

	const pinch = Gesture.Pinch()
		.onStart(() => { savedScale.value = scale.value; })
		.onUpdate((e) => { scale.value = Math.max(1, Math.min(5, savedScale.value * e.scale)); })
		.onEnd(() => { runOnJS(setZoomPercent)(Math.round(scale.value * 100)); });
		
	const pan = Gesture.Pan()
		.onStart(() => { savedTx.value = tx.value; savedTy.value = ty.value; })
		.onUpdate((e) => {
			if (scale.value > 1) {
				tx.value = savedTx.value + e.translationX;
				ty.value = savedTy.value + e.translationY;
			}
		});

	const doubleTap = Gesture.Tap()
		.numberOfTaps(2)
		.onEnd(() => {
			if (scale.value > 1) {
				scale.value = withTiming(1);
				tx.value = withTiming(0);
				ty.value = withTiming(0);
				runOnJS(setZoomPercent)(100);
			} else {
				scale.value = withTiming(3);
				runOnJS(setZoomPercent)(300);
			}
		});

	const gestures = Gesture.Simultaneous(pinch, pan, doubleTap);
	
	const imageStyle = useAnimatedStyle(() => ({
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

	const openLightbox = () => {
		if (!imageError && !isLoading) {
			triggerHaptic("light");
			scale.value = 1;
			tx.value = 0;
			ty.value = 0;
			setZoomPercent(100);
			setIsLightboxOpen(true);
		}
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.isDark ? ink[950] : "#f8fafc" }]}>
			{/* Header */}
			<LinearGradient
				colors={[theme.p[500], "#f97316"]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.header, { paddingTop: insets.top + 16 }]}
			>
				<View style={styles.headerLeft}>
					<Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.headerButton}>
						<ArrowLeft size={24} color="#fff" />
					</Pressable>
					<Text style={styles.headerTitle}>नित्य वाणी</Text>
				</View>
				<View style={styles.headerRight}>
					{!isToday && (
						<Pressable onPress={handleToday} style={styles.todayButton}>
							<Calendar size={12} color="#fff" />
							<Text style={styles.todayText}>आज (Today)</Text>
						</Pressable>
					)}
				</View>
			</LinearGradient>

			<View style={styles.content}>
				{/* Date Selector */}
				<View style={[styles.dateBar, { backgroundColor: theme.card, borderColor: theme.isDark ? ink[700] : ink[200] }]}>
					<Pressable
						onPress={() => changeDate(-1)}
						disabled={isJan1}
						style={[styles.dateButton, isJan1 && styles.disabledBtn]}
					>
						<ChevronLeft size={24} color={isJan1 ? ink[300] : theme.isDark ? ink[400] : ink[400]} />
					</Pressable>
					<View style={styles.dateCenter}>
						<Text style={[styles.dateTitle, { color: theme.p[500] }]}>{currentDate.getDate()} {HINDI_MONTHS[currentDate.getMonth()]}</Text>
						<Text style={styles.dateSubtitle}>{currentDate.getFullYear()} {WEEKDAYS[currentDate.getDay()]}</Text>
					</View>
					<Pressable
						onPress={() => changeDate(1)}
						disabled={isToday}
						style={[styles.dateButton, isToday && styles.disabledBtn]}
					>
						<ChevronRight size={24} color={isToday ? ink[300] : theme.isDark ? ink[400] : ink[400]} />
					</Pressable>
				</View>

				{/* Card */}
				<View style={[styles.card, { backgroundColor: theme.isDark ? ink[900] : "#fff", borderColor: theme.isDark ? ink[800] : ink[200] }]}>
					<Pressable style={[styles.imageBox, { backgroundColor: theme.isDark ? ink[900] : ink[50] }]} onPress={openLightbox}>
						{!imageError ? (
							<>
								<Image
									source={{ uri: quoteImage }}
									contentFit="contain"
									transition={300}
									style={StyleSheet.absoluteFill}
									onLoad={() => setIsLoading(false)}
									onError={() => {
										if (extensionIndex < EXTENSIONS.length - 1) {
											setExtensionIndex((prev) => prev + 1);
										} else {
											setImageError(true);
											setIsLoading(false);
										}
									}}
								/>
								{isLoading && (
									<View style={styles.loaderBox}>
										<ActivityIndicator size="large" color={theme.p[500]} />
									</View>
								)}
								{!isLoading && (
									<>
										<Pressable style={[styles.overlayBtn, { top: 12, right: 12 }]} onPress={handleShare} disabled={isSharing}>
											{isSharing ? <ActivityIndicator size={20} color="#fff" /> : <Share2 size={20} color="#fff" />}
										</Pressable>
										<Pressable style={[styles.overlayBtn, { bottom: 12, left: 12 }]} onPress={handleDownload} disabled={isDownloading}>
											{isDownloading ? <ActivityIndicator size={20} color="#fff" /> : <Download size={20} color="#fff" />}
										</Pressable>
										<Pressable style={[styles.overlayBtn, { bottom: 12, right: 12 }]} onPress={openLightbox}>
											<Maximize2 size={20} color="#fff" />
										</Pressable>
									</>
								)}
							</>
						) : (
							<View style={styles.errorBox}>
								<WifiOff size={40} color={ink[400]} style={{ opacity: 0.5, marginBottom: 16 }} />
								<Text style={styles.errorText}>Image not available</Text>
								<Pressable onPress={() => setRetryCount((c) => c + 1)} style={[styles.retryBtn, { backgroundColor: theme.isDark ? ink[800] : ink[100] }]}>
									<RefreshCw size={14} color={theme.p[500]} />
									<Text style={[styles.retryText, { color: theme.p[500] }]}>Retry</Text>
								</Pressable>
							</View>
						)}
					</Pressable>
				</View>
			</View>

			{/* Lightbox Modal */}
			<Modal visible={isLightboxOpen} transparent animationType="fade" onRequestClose={() => setIsLightboxOpen(false)} statusBarTranslucent>
				<View style={styles.lightboxBg}>
					<View style={[styles.lightboxHeader, { paddingTop: insets.top + 16 }]}>
						<Text style={styles.lightboxDate}>{currentDate.getDate()} {HINDI_MONTHS[currentDate.getMonth()]}</Text>
						<View style={styles.lightboxActions}>
							<Pressable onPress={handleShare} disabled={isSharing} style={styles.lbBtn}>
								{isSharing ? <ActivityIndicator size={24} color="#fff" /> : <Share2 size={24} color="#fff" />}
							</Pressable>
							<Pressable onPress={handleDownload} disabled={isDownloading} style={styles.lbBtn}>
								{isDownloading ? <ActivityIndicator size={24} color="#fff" /> : <Download size={24} color="#fff" />}
							</Pressable>
							<Pressable onPress={() => setIsLightboxOpen(false)} style={styles.lbBtn}>
								<X size={24} color="#fff" />
							</Pressable>
						</View>
					</View>

					<GestureDetector gesture={gestures}>
						<View style={styles.flex}>
							<Animated.View style={[styles.flex, imageStyle]}>
								<Image source={{ uri: quoteImage }} contentFit="contain" style={styles.flex} />
							</Animated.View>
						</View>
					</GestureDetector>

					<View style={[styles.zoomBar, { bottom: 32 + insets.bottom }]}>
						<Pressable onPress={() => setZoom(Math.max(1, scale.value - 0.5))} style={styles.zoomButton}>
							<ZoomOut size={20} color="#fff" />
						</Pressable>
						<Text style={styles.zoomText}>{zoomPercent}%</Text>
						<Pressable onPress={() => setZoom(Math.min(5, scale.value + 0.5))} style={styles.zoomButton}>
							<ZoomIn size={20} color="#fff" />
						</Pressable>
						<View style={styles.zoomDivider} />
						<Pressable onPress={() => setZoom(1)} style={styles.zoomButton}>
							<RotateCcw size={18} color="#fff" />
						</Pressable>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	flex: { flex: 1 },
	header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: "rgba(255,213,79,0.4)", zIndex: 10 },
	headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
	headerButton: { padding: 4, borderRadius: 999 },
	headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
	headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
	todayButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
	todayText: { fontSize: 12, fontWeight: "700", color: "#fff" },
	content: { flex: 1, alignItems: "center", padding: 16, paddingTop: 16 },
	dateBar: { maxWidth: 448, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, marginBottom: 24, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
	dateButton: { padding: 8, borderRadius: 999 },
	disabledBtn: { opacity: 0.2 },
	dateCenter: { alignItems: "center" },
	dateTitle: { fontSize: 20, fontWeight: "700" },
	dateSubtitle: { fontSize: 12, fontWeight: "400", color: ink[500], letterSpacing: 0.5 },
	card: { maxWidth: 448, width: "100%", padding: 24, borderRadius: 24, borderWidth: 1, elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20 },
	imageBox: { minHeight: 300, aspectRatio: 0.8, borderRadius: 12, overflow: "hidden", position: "relative" },
	loaderBox: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
	overlayBtn: { position: "absolute", backgroundColor: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 999 },
	errorBox: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed", borderColor: ink[200], borderRadius: 12, margin: 2 },
	errorText: { fontSize: 14, fontWeight: "500", color: ink[500] },
	retryBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, marginTop: 16 },
	retryText: { fontSize: 12, fontWeight: "700" },
	
	lightboxBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
	lightboxHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 16, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10 },
	lightboxDate: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500" },
	lightboxActions: { flexDirection: "row", alignItems: "center", gap: 12 },
	lbBtn: { padding: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999 },
	zoomBar: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: "rgba(7,21,41,0.97)", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, gap: 16, elevation: 8 },
	zoomButton: { padding: 4 },
	zoomText: { color: "#fff", fontSize: 14, fontWeight: "700", minWidth: 48, textAlign: "center" },
	zoomDivider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.2)" }
});

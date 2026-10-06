import { LinearGradient } from "expo-linear-gradient";
import {
	AlertCircle,
	ArrowLeft,
	Bookmark,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import Pdf, { type PdfRef } from "react-native-pdf";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RangeSlider } from "../components/RangeSlider";
import { useBookmarkStore } from "../store/bookmarkStore";
import { useBookStore } from "../store/bookStore";
import { addToHistory } from "../store/historyStore";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import { ink, janmashtami } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";
import type { Book } from "../types";

// Native rebuild of components/BookReader.tsx: the saffron header (back,
// title + "Offline Reader (HD)", bookmark), one page at a time, and the
// bottom bar with the page slider, prev/next and zoom. Like the Capacitor
// reader it only opens the downloaded copy on the phone — react-native-pdf
// renders that file natively — and reopens a book at its bookmark.

const ORANGE_500 = "#f97316";
const ZOOM_STEP = 1.5;
const MAX_ZOOM = 8;

type ErrorType = "DOWNLOAD" | "UNKNOWN";

interface Props {
	book: Book;
	onBack: () => void;
}

export function BookViewerScreen({ book, onBack }: Props) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const dark = theme.isDark;
	const isHindi = useSettingsStore((s) => s.settingsLanguage) === "hi";
	const downloaded = useBookStore((s) => s.downloaded[book.id]);
	const bookmarkPage = useBookmarkStore((s) => s.bookmarks[book.id]);
	const { setBookmark, removeBookmark } = useBookmarkStore.getState();
	const pdfRef = useRef<PdfRef>(null);

	const t = {
		unableToOpen: isHindi ? "किताब नहीं खुल पाई" : "Unable to Open Book",
		goBackDownload: isHindi ? "वापस जाएं और डाउनलोड करें" : "Go Back & Download Again",
		viewOnline: isHindi ? "ऑनलाइन देखें" : "View Online",
		cancelGoBack: isHindi ? "रद्द करें" : "Cancel & Go Back",
		openingBook: isHindi ? "किताब खुल रही है..." : "Opening Book...",
		offlineReader: isHindi ? "ऑफलाइन रीडर (HD)" : "Offline Reader (HD)",
		resumedFrom: (page: number) => (isHindi ? `पेज ${page} से शुरू` : `Resumed from page ${page}`),
		stillLoading: isHindi ? "किताब अभी लोड हो रही है, थोड़ा रुकें" : "Book is still loading, please wait",
	};

	// The bookmark is read once, when the book opens (BookReader's load).
	const [startPage] = useState(() => (bookmarkPage && bookmarkPage > 0 ? bookmarkPage : 1));
	const [source, setSource] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<{ message: string; type: ErrorType } | null>(null);
	const [pageNum, setPageNum] = useState(startPage);
	const [numPages, setNumPages] = useState(0);
	const [scale, setScale] = useState(1);
	const [resumeLabel, setResumeLabel] = useState<string | null>(null);
	/** The page under the slider thumb while it is being dragged. */
	const [slidingPage, setSlidingPage] = useState<number | null>(null);

	useEffect(() => addToHistory(book.id, "book"), [book.id]);

	// Find the downloaded file; without one the book can't be read here.
	// biome-ignore lint/correctness/useExhaustiveDependencies: resolve once per book
	useEffect(() => {
		let active = true;
		(async () => {
			const path = downloaded?.path;
			if (path && (await ReactNativeBlobUtil.fs.exists(path))) {
				if (active) setSource(`file://${path}`);
				return;
			}
			if (downloaded) useBookStore.getState().deleteBook(book.id);
			if (!active) return;
			setError({ message: "Book file not found. Please go back and download it again.", type: "DOWNLOAD" });
			setLoading(false);
		})();
		return () => {
			active = false;
		};
	}, [book.id]);

	useEffect(() => {
		if (!resumeLabel) return;
		const timer = setTimeout(() => setResumeLabel(null), 3000);
		return () => clearTimeout(timer);
	}, [resumeLabel]);

	const changePage = (page: number) => {
		const p = Math.max(1, Math.min(numPages, page));
		if (p !== pageNum) pdfRef.current?.setPage(p);
	};

	const isBookmarked = bookmarkPage === pageNum;
	const toggleBookmark = () => {
		if (loading || error) {
			showToast(t.stillLoading, "info");
			return;
		}
		if (isBookmarked) removeBookmark(book.id);
		else setBookmark(book.id, pageNum);
	};

	const controlBg = dark ? ink[800] : ink[100];
	const controlBorder = dark ? ink[700] : ink[200];
	const controlIcon = dark ? ink[300] : ink[700];

	return (
		<View style={[styles.flex, { backgroundColor: dark ? ink[900] : ink[50] }]}>
			<LinearGradient
				colors={[theme.p[500], ORANGE_500]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.header, { paddingTop: insets.top + 8 }]}
			>
				<Pressable accessibilityLabel="Back" onPress={onBack} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
					<ArrowLeft size={24} color={dark ? ink[200] : ink[700]} />
				</Pressable>
				<View style={styles.titleBox}>
					<Text style={[styles.title, { color: dark ? "#fff" : ink[800] }]} numberOfLines={1}>
						{book.title}
					</Text>
					<Text
						style={[
							styles.caption,
							{ color: resumeLabel ? (dark ? theme.p[400] : theme.p[500]) : dark ? "#4ade80" : "#16a34a" },
						]}
						numberOfLines={1}
					>
						{resumeLabel ?? t.offlineReader}
					</Text>
				</View>
				<Pressable
					accessibilityLabel="Bookmark"
					onPress={toggleBookmark}
					style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
				>
					<Bookmark
						size={22}
						color={isBookmarked ? theme.p[500] : dark ? ink[500] : ink[400]}
						fill={isBookmarked ? theme.p[500] : "none"}
					/>
				</Pressable>
			</LinearGradient>

			<View style={[styles.flex, { backgroundColor: dark ? "#000" : ink[100] }]}>
				{source && !error ? (
					<Pdf
						ref={pdfRef}
						source={{ uri: source }}
						page={startPage}
						scale={scale}
						minScale={1}
						maxScale={MAX_ZOOM}
						horizontal
						enablePaging
						enableDoubleTapZoom
						spacing={0}
						style={[styles.flex, styles.pdf]}
						renderActivityIndicator={() => <View />}
						onLoadComplete={(pages) => {
							setNumPages(pages);
							setLoading(false);
							if (startPage > 1 && startPage <= pages) {
								const label = t.resumedFrom(startPage);
								showToast(label, "info");
								setResumeLabel(label);
							}
						}}
						onPageChanged={(page, total) => {
							setPageNum(page);
							setNumPages(total);
						}}
						onScaleChanged={setScale}
						onError={() => {
							// A file that won't open is a broken download: remove it
							// so it can be downloaded again, as BookReader does.
							useBookStore.getState().deleteBook(book.id);
							setError({
								message: "Download corrupted. File has been deleted. Please download again.",
								type: "DOWNLOAD",
							});
							setLoading(false);
						}}
					/>
				) : null}

				{loading && !error ? (
					<View style={[styles.overlay, { backgroundColor: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)" }]}>
						<ActivityIndicator size={40} color={theme.p[500]} style={styles.mb16} />
						<Text style={[styles.loadingText, { color: dark ? ink[300] : ink[700] }]}>{t.openingBook}</Text>
					</View>
				) : null}

				{error ? (
					<View style={[styles.overlay, styles.errorBox, { backgroundColor: dark ? ink[900] : ink[50] }]}>
						<View style={[styles.errorIcon, { backgroundColor: dark ? "rgba(127, 29, 29, 0.2)" : "#fee2e2" }]}>
							<AlertCircle size={32} color="#ef4444" />
						</View>
						<Text style={[styles.errorTitle, { color: dark ? "#fff" : ink[800] }]}>{t.unableToOpen}</Text>
						<Text style={[styles.errorText, { color: dark ? ink[400] : ink[500] }]}>{error.message}</Text>
						<View style={styles.errorActions}>
							{error.type === "DOWNLOAD" ? (
								<Pressable onPress={onBack} style={({ pressed }) => [styles.blueButton, pressed && styles.pressed]}>
									<Text style={styles.blueButtonText}>{t.goBackDownload}</Text>
								</Pressable>
							) : null}
							{book.url ? (
								<Pressable
									onPress={() => Linking.openURL(book.url ?? "").catch(() => {})}
									style={({ pressed }) => [
										styles.onlineButton,
										{ backgroundColor: dark ? ink[800] : "#fff", borderColor: dark ? ink[700] : ink[200] },
										pressed && styles.pressed,
									]}
								>
									<ExternalLink size={16} color={dark ? "#60a5fa" : "#2563eb"} />
									<Text style={[styles.onlineText, { color: dark ? "#60a5fa" : "#2563eb" }]}>{t.viewOnline}</Text>
								</Pressable>
							) : null}
							{error.type !== "DOWNLOAD" ? (
								<Pressable onPress={onBack} style={styles.cancelButton}>
									<Text style={[styles.cancelText, { color: dark ? ink[400] : ink[500] }]}>{t.cancelGoBack}</Text>
								</Pressable>
							) : null}
						</View>
					</View>
				) : null}
			</View>

			<LinearGradient
				colors={[theme.p[500], ORANGE_500]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				pointerEvents={loading || error ? "none" : "auto"}
				style={[styles.bottomBar, { paddingBottom: insets.bottom + 4, opacity: loading || error ? 0 : 1 }]}
			>
				<PageSlider numPages={numPages} currentPage={pageNum} onChangePage={changePage} onSliding={setSlidingPage} />
				<View style={styles.controls}>
					<View style={[styles.controlGroup, styles.pagerGroup, { backgroundColor: controlBg, borderColor: controlBorder }]}>
						<Pressable
							disabled={pageNum <= 1}
							onPress={() => changePage(pageNum - 1)}
							style={[styles.controlButton, pageNum <= 1 && styles.dim]}
						>
							<ChevronLeft size={18} color={controlIcon} />
						</Pressable>
						<View style={[styles.controlDivider, { backgroundColor: controlBorder }]} />
						<Pressable
							disabled={pageNum >= numPages}
							onPress={() => changePage(pageNum + 1)}
							style={[styles.controlButton, pageNum >= numPages && styles.dim]}
						>
							<ChevronRight size={18} color={controlIcon} />
						</Pressable>
					</View>
					<View style={[styles.controlGroup, { backgroundColor: controlBg, borderColor: controlBorder }]}>
						<Pressable
							disabled={scale <= 1.01}
							onPress={() => setScale((s) => Math.max(1, s / ZOOM_STEP))}
							style={[styles.zoomButton, scale <= 1.01 && styles.dim]}
						>
							<ZoomOut size={16} color={controlIcon} />
						</Pressable>
						<Text style={[styles.zoomText, { color: dark ? ink[400] : ink[500] }]}>{Math.round(scale * 100)}%</Text>
						<Pressable onPress={() => setScale((s) => Math.min(MAX_ZOOM, s * ZOOM_STEP))} style={styles.zoomButton}>
							<ZoomIn size={16} color={controlIcon} />
						</Pressable>
					</View>
				</View>
			</LinearGradient>

			{slidingPage !== null ? (
				<View pointerEvents="none" style={styles.slideOverlay}>
					<Text style={styles.slideBadge}>Page {slidingPage}</Text>
				</View>
			) : null}
		</View>
	);
}

/** BookReader's PageSlider: page numbers either side, a big "Page N" while dragging. */
function PageSlider({
	numPages,
	currentPage,
	onChangePage,
	onSliding,
}: {
	numPages: number;
	currentPage: number;
	onChangePage: (page: number) => void;
	/** The dragged-to page while sliding, null when released. */
	onSliding: (page: number | null) => void;
}) {
	const theme = useAppTheme();
	const [value, setValue] = useState(currentPage);
	const sliding = useRef(false);
	const valueRef = useRef(currentPage);

	useEffect(() => {
		setValue(currentPage);
		valueRef.current = currentPage;
	}, [currentPage]);

	return (
		<View style={styles.sliderRow}>
			<Text style={[styles.pageNumber, styles.right]}>{currentPage}</Text>
			<View style={styles.sliderTrack}>
				<RangeSlider
					value={value}
					min={1}
					max={Math.max(1, numPages)}
					onChange={(v) => {
						setValue(v);
						valueRef.current = v;
						if (sliding.current) onSliding(v);
					}}
					onSlidingChange={(on) => {
						sliding.current = on;
						onSliding(on ? valueRef.current : null);
						if (!on) onChangePage(valueRef.current);
					}}
					accent={theme.p[500]}
					track={theme.isDark ? ink[700] : ink[200]}
				/>
			</View>
			<Text style={styles.pageNumber}>{numPages}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	pressed: { transform: [{ scale: 0.95 }] },
	dim: { opacity: 0.3 },
	mb16: { marginBottom: 16 },
	right: { textAlign: "right" },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		padding: 8,
		borderBottomWidth: 2,
		borderBottomColor: "rgba(212, 160, 23, 0.4)",
		elevation: 6,
		zIndex: 10,
	},
	iconButton: { padding: 12, borderRadius: 999 },
	titleBox: { flex: 1, minWidth: 0, alignItems: "center" },
	title: { fontSize: 16, fontWeight: "700" },
	caption: { fontSize: 10, fontWeight: "700", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 },
	pdf: { width: "100%", backgroundColor: "transparent" },
	overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 10 },
	loadingText: { fontSize: 14, fontWeight: "500" },
	errorBox: { paddingHorizontal: 32 },
	errorIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
	errorTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, textAlign: "center" },
	errorText: { fontSize: 14, fontWeight: "500", lineHeight: 22, textAlign: "center", maxWidth: 320, marginBottom: 32 },
	errorActions: { width: "100%", maxWidth: 320, gap: 12 },
	blueButton: { backgroundColor: "#2563eb", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, alignItems: "center", elevation: 4 },
	blueButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
	onlineButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingHorizontal: 24,
		paddingVertical: 14,
		borderRadius: 12,
		borderWidth: 1,
		elevation: 1,
	},
	onlineText: { fontSize: 14, fontWeight: "700" },
	cancelButton: { paddingHorizontal: 24, paddingVertical: 12, alignItems: "center" },
	cancelText: { fontSize: 14, fontWeight: "700" },
	bottomBar: {
		padding: 8,
		gap: 8,
		borderBottomWidth: 2,
		borderBottomColor: "rgba(212, 160, 23, 0.4)",
		elevation: 6,
		zIndex: 10,
	},
	sliderRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 8, marginBottom: 4 },
	sliderTrack: { flex: 1, maxWidth: 384, marginHorizontal: 8 },
	pageNumber: { width: 32, fontSize: 12, fontWeight: "700", color: ink[400] },
	slideOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 20 },
	slideBadge: {
		backgroundColor: "rgba(0,0,0,0.7)",
		color: "#fff",
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 16,
		fontSize: 24,
		fontWeight: "700",
		overflow: "hidden",
	},
	controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, gap: 16 },
	controlGroup: { flexDirection: "row", alignItems: "center", height: 40, borderRadius: 8, borderWidth: 1, padding: 2 },
	pagerGroup: { width: 96 },
	controlButton: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center", borderRadius: 6 },
	controlDivider: { width: 1, height: 16, marginHorizontal: 4 },
	zoomButton: { height: "100%", paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 6 },
	zoomText: { minWidth: 48, paddingHorizontal: 8, textAlign: "center", fontSize: 10, fontWeight: "700", fontFamily: "monospace" },
});

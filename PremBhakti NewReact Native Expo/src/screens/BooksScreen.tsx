import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { BookOpen, Check, Download, ExternalLink, Search, SearchX, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTabBarSpace } from "../components/BottomNav";
import { HighlightText } from "../components/HighlightText";
import { VoiceSearchButton } from "../components/VoiceSearchButton";
import { SideScrollView } from "../components/SideScrollView";
import { triggerHaptic } from "../lib/haptics";
import type { RootNavigation } from "../navigation/types";
import { formatBookBytes, openInPdfApp, useBookStore } from "../store/bookStore";
import { useBooks } from "../store/contentStore";
import { addToHistory } from "../store/historyStore";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import { ink, janmashtami } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import type { Book } from "../types";
import { addRecentSearch } from "../utils/recentSearches";
import { calculateBookScore } from "../utils/textProcessor";

// The "Books" tab: native rebuild of components/BookList.tsx. A header card,
// then one row per book with its file name and size; tapping a row opens the
// action sheet (download / read / re-download / open in browser). Downloaded
// books open in the phone's PDF app, or the in-app reader when there is none.

const GOLD = janmashtami.deepGold;
const goldA = (a: number) => `rgba(212, 160, 23, ${a})`;

const T = {
	en: {
		noBooks: "No books found",
		trySearch: "Try a different search term",
		headerTitle: "Books & Literature",
		headerDesc: "Download books to your phone and read anytime, even without internet.",
		offline: "Offline",
		openBook: "Open Book",
		downloadRequired: "Download Required",
		downloadingTitle: "Downloading",
		downloadedMsg: "is downloaded and ready to read offline.",
		mustDownload: "You must download this to read it.",
		size: "Size:",
		cancel: "Cancel",
		readNow: "Read Now",
		readTitle: "Read Book",
		downloadTitle: "Download to Read",
		downloadApp: "Download in App",
		cancelDownload: "Cancel Download",
		openBrowser: "Open in Browser",
		openBrowserNote: "(won't save to app)",
		fileMissing: "Book file not found. Please download it again.",
		noViewer: "No PDF app found, opening in the built-in reader...",
		redownload: "Re-download in App",
		redownloadConfirm: "The saved copy will be replaced once the new download finishes. Re-download?",
		redownloadYes: "Yes, Re-download",
		syncing: "☁️ Books are syncing in background",
		loading: "Loading books...",
		noneTitle: "No Books Available",
		noneBody: "Connect to internet to load books.",
		fetch: "Fetch Latest Books",
		search: "Search (Hinglish)...",
		browserToast: "Opening in browser. Large books may take a moment to load...",
	},
	hi: {
		noBooks: "कोई किताब नहीं मिली",
		trySearch: "कोई अन्य शब्द खोजें",
		headerTitle: "ग्रंथ और साहित्य",
		headerDesc: "किताब डाउनलोड करें और बिना इंटरनेट के कभी भी पढ़ें।",
		offline: "ऑफलाइन",
		openBook: "किताब खोलें",
		downloadRequired: "डाउनलोड आवश्यक",
		downloadingTitle: "डाउनलोड हो रही है",
		downloadedMsg: "डाउनलोड हो चुकी है, ऑफलाइन पढ़ें।",
		mustDownload: "इसे पढ़ने के लिए डाउनलोड करना आवश्यक है।",
		size: "साइज़:",
		cancel: "रद्द करें",
		readNow: "अभी पढ़ें",
		readTitle: "किताब पढ़ें",
		downloadTitle: "डाउनलोड करें",
		downloadApp: "ऐप में डाउनलोड करें",
		cancelDownload: "डाउनलोड रोकें",
		openBrowser: "ब्राउज़र में खोलें",
		openBrowserNote: "(ऐप में सेव नहीं होगी)",
		fileMissing: "किताब की फ़ाइल नहीं मिली, कृपया फिर से डाउनलोड करें।",
		noViewer: "फ़ोन में PDF ऐप नहीं मिला, ऐप के रीडर में खोल रहे हैं...",
		redownload: "फिर से डाउनलोड करें",
		redownloadConfirm: "नई कॉपी पूरी डाउनलोड होने के बाद पुरानी कॉपी बदल दी जाएगी। फिर से डाउनलोड करें?",
		redownloadYes: "हाँ, डाउनलोड करें",
		syncing: "☁️ पुस्तकें बैकग्राउंड में अपडेट हो रही हैं",
		loading: "पुस्तकें लोड हो रही हैं...",
		noneTitle: "पुस्तकें उपलब्ध नहीं",
		noneBody: "पुस्तकें लोड करने के लिए इंटरनेट से जोड़ें।",
		fetch: "नवीनतम पुस्तकें Fetch करें",
		search: "खोजें (Hinglish)..",
		browserToast: "ब्राउज़र में किताब खुल रही है, बड़े साइज़ के कारण थोड़ा समय लग सकता है...",
	},
};
type Strings = (typeof T)["en"];

export function BooksScreen() {
	const theme = useAppTheme();
	const tabBarSpace = useTabBarSpace();
	const navigation = useNavigation<RootNavigation>();
	const language = useSettingsStore((s) => s.settingsLanguage);
	const t = T[language];
	const { items, isSyncing, refresh } = useBooks();
	const downloaded = useBookStore((s) => s.downloaded);
	const active = useBookStore((s) => s.active);
	const { requestDownload, cancelDownload } = useBookStore.getState();
	const [query, setQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [pending, setPending] = useState<Book | null>(null);
	const [opening, setOpening] = useState<string | null>(null);

	const books = useMemo(() => {
		const visible = items.filter((b) => !b.isHidden);
		if (!query.trim()) return visible;
		return visible
			.map((book) => ({ book, score: calculateBookScore(book, query) }))
			.filter((r) => r.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((r) => r.book);
	}, [items, query]);

	const openBook = async (book: Book) => {
		if (opening) return;
		setOpening(book.id);
		triggerHaptic("medium");
		if (query.trim()) addRecentSearch(query);
		try {
			const result = await openInPdfApp(book.id);
			if (result === "opened") {
				// Opened in the phone's PDF app; just record it, as App.tsx did.
				setPending(null);
				addToHistory(book.id, "book");
			} else if (result === "not_found") {
				showToast(t.fileMissing, "error");
				setPending(book);
			} else {
				showToast(t.noViewer, "info");
				setPending(null);
				navigation.navigate("BookViewer", { book });
			}
		} finally {
			setOpening(null);
		}
	};

	if (items.length === 0) {
		return (
			<View style={styles.center}>
				{isSyncing ? (
					<>
						<View style={styles.loaderRing}>
							<BookOpen size={36} color={goldA(0.6)} />
							<ActivityIndicator style={StyleSheet.absoluteFill} size={80} color={GOLD} />
						</View>
						<Text style={[styles.loadingText, { color: GOLD }]}>{t.loading}</Text>
					</>
				) : (
					<>
						<View style={[styles.emptyIcon, { backgroundColor: theme.well }]}>
							<BookOpen size={40} color={theme.isDark ? ink[600] : ink[300]} />
						</View>
						<Text style={[styles.emptyTitle, { color: theme.isDark ? ink[200] : ink[700] }]}>{t.noneTitle}</Text>
						<Text style={styles.emptyBody}>{t.noneBody}</Text>
						<Pressable onPress={refresh} style={styles.fetchButton}>
							<Text style={styles.fetchText}>{t.fetch}</Text>
						</Pressable>
					</>
				)}
			</View>
		);
	}

	return (
		<View style={styles.flex}>
			{searchOpen || query.trim() ? (
				<View style={[styles.searchBar, { backgroundColor: theme.isDark ? "rgba(7,21,41,0.95)" : "rgba(255,248,231,0.95)" }]}>
					<Search size={20} color={GOLD} />
					<TextInput
						autoFocus
						value={query}
						onChangeText={setQuery}
						placeholder={t.search}
						placeholderTextColor={ink[400]}
						style={[styles.searchInput, { color: theme.isDark ? "#fff" : ink[900] }]}
					/>
					<VoiceSearchButton onResult={setQuery} />
					<Pressable
						accessibilityLabel="Close search"
						onPress={() => {
							setQuery("");
							setSearchOpen(false);
						}}
						style={{ padding: 8 }}
					>
						<X size={20} color={ink[400]} />
					</Pressable>
				</View>
			) : null}

			<FlashList<Book>
				renderScrollComponent={SideScrollView}
				data={books}
				keyExtractor={(b) => b.id}
				extraData={[downloaded, active, opening]}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: tabBarSpace + 8 }}
				ListHeaderComponent={
					<>
						{isSyncing ? (
							<View style={styles.syncBanner}>
								<ActivityIndicator size="small" color={GOLD} />
								<Text style={styles.syncText}>{t.syncing}</Text>
							</View>
						) : null}
						<View
							style={[
								styles.headerCard,
								theme.isDark
									? { backgroundColor: ink[800], borderColor: ink[700] }
									: { backgroundColor: `${theme.p[50]}80`, borderColor: theme.p[200] },
							]}
						>
							<View style={styles.rowCenter}>
								<BookOpen size={20} color={theme.p[600]} />
								<Text style={[styles.headerTitle, { color: theme.p[600] }]}>{t.headerTitle}</Text>
							</View>
							<Text style={[styles.headerDesc, { color: theme.isDark ? ink[400] : ink[500] }]}>{t.headerDesc}</Text>
						</View>
					</>
				}
				ListEmptyComponent={
					<View style={[styles.center, { paddingVertical: 80 }]}>
						<SearchX size={64} color={GOLD} style={{ opacity: 0.3, marginBottom: 16 }} />
						<Text style={{ fontSize: 18, fontWeight: "500", color: ink[400] }}>{t.noBooks}</Text>
						<Text style={{ fontSize: 14, color: ink[400], opacity: 0.7, marginTop: 8 }}>{t.trySearch}</Text>
					</View>
				}
				renderItem={({ item: book }) => (
					<BookRow
						book={book}
						theme={theme}
						t={t}
						query={query}
						download={active[book.id]}
						isDownloaded={!active[book.id] && !!downloaded[book.id]}
						isOpening={opening === book.id}
						onPress={() => setPending(book)}
						onCancel={() => cancelDownload(book.id)}
						onRead={() => openBook(book)}
						onDownload={() => requestDownload(book)}
					/>
				)}
			/>

			{/* Floating search, as in the web list. */}
			{!searchOpen && !query.trim() ? (
				<View style={styles.floatSearch}>
					<Pressable
						accessibilityLabel="Search"
						onPress={() => setSearchOpen(true)}
						style={[styles.floatButton, { backgroundColor: theme.isDark ? "rgba(7,21,41,0.9)" : "rgba(255,248,231,0.9)" }]}
					>
						<Search size={20} color={goldA(0.8)} />
					</Pressable>
				</View>
			) : null}

			<BookActionSheet
				book={pending}
				theme={theme}
				t={t}
				isDownloaded={!!pending && !!downloaded[pending.id]}
				download={pending ? active[pending.id] : undefined}
				isOpening={!!pending && opening === pending.id}
				onClose={() => setPending(null)}
				onRead={() => pending && openBook(pending)}
				onDownload={() => {
					if (!pending) return;
					const book = pending;
					setPending(null);
					requestDownload(book);
				}}
				onCancelDownload={() => pending && cancelDownload(pending.id)}
				onBrowser={() => {
					if (!pending?.url) return;
					setPending(null);
					showToast(t.browserToast, "info");
					const url = pending.url.includes("?") ? `${pending.url}&download=1` : `${pending.url}?download=1`;
					Linking.openURL(url).catch(() =>
						showToast(language === "hi" ? "ब्राउज़र नहीं खुल पाया।" : "Could not open the browser.", "error"),
					);
				}}
			/>
		</View>
	);
}

function BookRow({
	book,
	theme,
	t,
	query,
	download,
	isDownloaded,
	isOpening,
	onPress,
	onCancel,
	onRead,
	onDownload,
}: {
	book: Book;
	theme: AppTheme;
	t: Strings;
	query: string;
	download?: { progress: number; loaded: number; total: number };
	isDownloaded: boolean;
	isOpening: boolean;
	onPress: () => void;
	onCancel: () => void;
	onRead: () => void;
	onDownload: () => void;
}) {
	const isDownloading = !!download;
	const progress = Math.min(100, Math.max(0, download?.progress ?? 0));
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [styles.bookRow, pressed ? { backgroundColor: theme.isDark ? ink[800] : ink[100] } : null]}
		>
			<View
				style={[
					styles.bookIcon,
					isDownloaded
						? { backgroundColor: theme.isDark ? ink[700] : theme.p[100], borderColor: theme.isDark ? ink[600] : theme.p[200] }
						: { backgroundColor: theme.isDark ? ink[800] : ink[100], borderColor: "transparent" },
				]}
			>
				{isDownloading ? (
					<ActivityIndicator size="small" color={theme.p[500]} />
				) : isDownloaded ? (
					<Check size={18} color={theme.p[600]} />
				) : (
					<BookOpen size={18} color={theme.isDark ? theme.p[400] : theme.p[500]} />
				)}
			</View>

			<View style={styles.flex}>
				<HighlightText text={book.title} highlight={query} style={[styles.bookTitle, { color: theme.isDark ? ink[200] : ink[700] }]} />
				{isDownloading ? (
					<View style={{ marginTop: 4 }}>
						<View style={[styles.progressTrack, { backgroundColor: theme.isDark ? ink[700] : ink[200] }]}>
							<View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.p[500] }]} />
						</View>
						<View style={styles.progressMeta}>
							<Text style={[styles.progressText, { color: theme.p[600] }]}>{Math.round(progress)}%</Text>
							{download.total > 0 ? (
								<Text style={[styles.progressText, { color: theme.p[600] }]}>
									{formatBookBytes(download.loaded)} / {formatBookBytes(download.total)}
								</Text>
							) : null}
						</View>
					</View>
				) : (
					<View style={styles.metaRow}>
						<HighlightText
							text={book.fileName}
							highlight={query}
							numberOfLines={1}
							style={[styles.fileName, { color: theme.isDark ? ink[500] : ink[400] }]}
						/>
						{book.displaySize ? (
							<Text style={[styles.size, { color: theme.isDark ? ink[500] : ink[400], borderLeftColor: theme.isDark ? ink[600] : ink[300] }]}>
								{book.displaySize}
							</Text>
						) : null}
						{isDownloaded ? (
							<Text
								style={[
									styles.offline,
									{ backgroundColor: theme.isDark ? "rgba(22,48,92,0.4)" : theme.p[100], color: theme.isDark ? theme.p[300] : theme.p[600] },
								]}
							>
								✓ {t.offline.toUpperCase()}
							</Text>
						) : null}
					</View>
				)}
			</View>

			<View style={styles.actions}>
				{isDownloading ? (
					<Pressable accessibilityLabel={t.cancelDownload} onPress={onCancel} style={[styles.roundAction, { backgroundColor: theme.isDark ? ink[700] : ink[100] }]}>
						<X size={20} color={theme.isDark ? ink[300] : ink[500]} />
					</Pressable>
				) : isDownloaded ? (
					<Pressable
						accessibilityLabel={t.readTitle}
						disabled={isOpening}
						onPress={onRead}
						style={[styles.roundAction, { backgroundColor: theme.p[500], opacity: isOpening ? 0.7 : 1 }]}
					>
						{isOpening ? <ActivityIndicator size="small" color="#fff" /> : <BookOpen size={20} color="#fff" />}
					</Pressable>
				) : (
					<Pressable accessibilityLabel={t.downloadTitle} onPress={onDownload} style={[styles.roundAction, { backgroundColor: theme.isDark ? ink[700] : ink[100] }]}>
						<Download size={20} color={theme.p[500]} />
					</Pressable>
				)}
			</View>
		</Pressable>
	);
}

function BookActionSheet({
	book,
	theme,
	t,
	isDownloaded,
	download,
	isOpening,
	onClose,
	onRead,
	onDownload,
	onCancelDownload,
	onBrowser,
}: {
	book: Book | null;
	theme: AppTheme;
	t: Strings;
	isDownloaded: boolean;
	download?: { progress: number; loaded: number; total: number };
	isOpening: boolean;
	onClose: () => void;
	onRead: () => void;
	onDownload: () => void;
	onCancelDownload: () => void;
	onBrowser: () => void;
}) {
	const [confirmRedownload, setConfirmRedownload] = useState(false);
	if (!book) return null;
	const progress = Math.min(100, Math.max(0, download?.progress ?? 0));
	const close = () => {
		setConfirmRedownload(false);
		onClose();
	};
	const outline = { backgroundColor: theme.isDark ? ink[700] : "#fff", borderColor: theme.isDark ? ink[600] : ink[200] };

	return (
		<Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
			<Pressable style={styles.scrim} onPress={close}>
				<Pressable style={[styles.sheet, { backgroundColor: theme.isDark ? ink[800] : janmashtami.cream }]} onPress={() => {}}>
					<View style={styles.sheetIcon}>
						{download ? <ActivityIndicator color={GOLD} /> : isDownloaded ? <BookOpen size={28} color={GOLD} /> : <Download size={28} color={GOLD} />}
					</View>
					<Text style={[styles.sheetTitle, { color: theme.isDark ? "#fff" : GOLD }]}>
						{download ? t.downloadingTitle : isDownloaded ? t.openBook : t.downloadRequired}
					</Text>

					<View style={styles.sheetBody}>
						{download ? (
							<>
								<Text style={[styles.bold, { color: theme.isDark ? ink[300] : ink[600], marginBottom: 12 }]}>{book.title}</Text>
								<View style={[styles.progressTrack, { height: 6, backgroundColor: theme.isDark ? ink[700] : ink[200] }]}>
									<View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: GOLD }]} />
								</View>
								<Text style={[styles.sheetProgress, { color: GOLD }]}>
									{Math.round(progress)}%
									{download.total > 0 ? ` • ${formatBookBytes(download.loaded)} / ${formatBookBytes(download.total)}` : ""}
								</Text>
							</>
						) : isDownloaded ? (
							<Text style={[styles.sheetText, { color: theme.isDark ? ink[300] : ink[600] }]}>
								<Text style={styles.bold}>{book.title}</Text> {t.downloadedMsg}
							</Text>
						) : (
							<Text style={[styles.sheetText, { color: theme.isDark ? ink[300] : ink[600] }]}>
								{t.mustDownload}
								{"\n"}
								<Text style={styles.bold}>{book.title}</Text>
								{book.displaySize ? <Text style={[styles.bold, { fontSize: 12, color: GOLD }]}>{`\n${t.size} ${book.displaySize}`}</Text> : null}
							</Text>
						)}
					</View>

					<View style={styles.sheetActions}>
						{download ? (
							<Pressable onPress={onCancelDownload} style={[styles.sheetButton, outline, { borderColor: theme.isDark ? "#991b1b" : "#fecaca" }]}>
								<X size={18} color="#dc2626" />
								<Text style={[styles.bold, { color: "#dc2626" }]}>{t.cancelDownload}</Text>
							</Pressable>
						) : (
							<>
								<Pressable
									disabled={isOpening}
									onPress={isDownloaded ? onRead : onDownload}
									style={[styles.sheetButton, { backgroundColor: GOLD, opacity: isOpening ? 0.7 : 1 }]}
								>
									{isOpening ? (
										<ActivityIndicator color="#fff" />
									) : isDownloaded ? (
										<BookOpen size={20} color="#fff" />
									) : (
										<Download size={20} color="#fff" />
									)}
									<Text style={[styles.bold, { color: "#fff" }]}>{isDownloaded ? t.readNow : t.downloadApp}</Text>
								</Pressable>

								{isDownloaded ? (
									confirmRedownload ? (
										<View style={[styles.redownloadBox, theme.isDark ? { backgroundColor: "rgba(124,45,18,0.2)", borderColor: "#c2410c" } : null]}>
											<Text style={[styles.redownloadText, { color: theme.isDark ? "#fdba74" : "#c2410c" }]}>{t.redownloadConfirm}</Text>
											<View style={styles.rowCenter}>
												<Pressable onPress={() => setConfirmRedownload(false)} style={[styles.smallButton, { borderWidth: 1, borderColor: theme.isDark ? ink[600] : ink[200] }]}>
													<Text style={[styles.bold, { fontSize: 14, color: theme.isDark ? ink[300] : ink[600] }]}>{t.cancel}</Text>
												</Pressable>
												<Pressable
													onPress={() => {
														setConfirmRedownload(false);
														onDownload();
													}}
													style={[styles.smallButton, { backgroundColor: "#f97316" }]}
												>
													<Text style={[styles.bold, { fontSize: 14, color: "#fff" }]}>{t.redownloadYes}</Text>
												</Pressable>
											</View>
										</View>
									) : (
										<Pressable onPress={() => setConfirmRedownload(true)} style={[styles.sheetButton, outline]}>
											<Download size={20} color={theme.isDark ? ink[300] : ink[700]} />
											<Text style={[styles.bold, { color: theme.isDark ? ink[200] : ink[700] }]}>{t.redownload}</Text>
										</Pressable>
									)
								) : null}

								{book.url ? (
									<Pressable onPress={onBrowser} style={[styles.sheetButton, outline]}>
										<ExternalLink size={18} color="#60a5fa" />
										<Text style={[styles.bold, { fontSize: 14, color: theme.isDark ? ink[400] : ink[500] }]}>
											{t.openBrowser}
											<Text style={{ fontSize: 10, fontWeight: "400", opacity: 0.7 }}> {t.openBrowserNote}</Text>
										</Text>
									</Pressable>
								) : null}
							</>
						)}
						<Pressable onPress={close} style={styles.cancelButton}>
							<Text style={[styles.bold, { color: theme.isDark ? ink[400] : ink[500] }]}>{t.cancel}</Text>
						</Pressable>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
	bold: { fontWeight: "700" },
	center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
	loaderRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: goldA(0.1), alignItems: "center", justifyContent: "center" },
	loadingText: { fontSize: 18, fontWeight: "700" },
	emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
	emptyTitle: { fontSize: 18, fontWeight: "700" },
	emptyBody: { fontSize: 14, color: ink[400], textAlign: "center" },
	fetchButton: { borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 20, paddingVertical: 10 },
	fetchText: { color: "#fff", fontSize: 14, fontWeight: "700" },
	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: goldA(0.2),
	},
	searchInput: { flex: 1, paddingVertical: 8, fontSize: 16, fontWeight: "500" },
	floatSearch: { position: "absolute", top: 8, right: 16 },
	floatButton: { padding: 8, borderRadius: 999, borderWidth: 1, borderColor: goldA(0.2), elevation: 1 },
	syncBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginTop: 4,
		marginBottom: 8,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 12,
		backgroundColor: goldA(0.1),
		borderWidth: 1,
		borderColor: goldA(0.3),
	},
	syncText: { fontSize: 12, fontWeight: "700", color: GOLD, flex: 1 },
	headerCard: { marginBottom: 16, borderRadius: 16, padding: 20, paddingRight: 56, borderWidth: 1, elevation: 1 },
	headerTitle: { fontSize: 18, fontWeight: "700" },
	headerDesc: { fontSize: 12, fontWeight: "500", marginTop: 4, lineHeight: 17 },
	bookRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12, borderRadius: 16, marginBottom: 8 },
	bookIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
	bookTitle: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
	metaRow: { flexDirection: "row", alignItems: "center", marginTop: 2, gap: 4 },
	fileName: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
	size: { fontSize: 10, opacity: 0.7, borderLeftWidth: 1, paddingLeft: 4, marginLeft: 4 },
	offline: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: "700", borderRadius: 999, overflow: "hidden" },
	progressTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 4 },
	progressFill: { height: "100%" },
	progressMeta: { flexDirection: "row", justifyContent: "space-between" },
	progressText: { fontSize: 10, fontWeight: "700", fontFamily: "monospace" },
	actions: { paddingLeft: 8 },
	roundAction: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
	scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
	sheet: { width: "100%", maxWidth: 320, maxHeight: "90%", borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: goldA(0.2), elevation: 24 },
	sheetIcon: {
		width: 56,
		height: 56,
		borderRadius: 28,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
		backgroundColor: goldA(0.1),
		borderWidth: 1,
		borderColor: goldA(0.3),
	},
	sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
	sheetBody: { alignSelf: "stretch", marginBottom: 24 },
	sheetText: { fontSize: 14, textAlign: "center", lineHeight: 21 },
	sheetProgress: { marginTop: 8, fontSize: 12, fontWeight: "700", fontFamily: "monospace", textAlign: "center" },
	sheetActions: { alignSelf: "stretch", gap: 12 },
	sheetButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
	redownloadBox: { borderRadius: 12, borderWidth: 1, borderColor: "#fed7aa", backgroundColor: "#fff7ed", padding: 12, gap: 12 },
	redownloadText: { fontSize: 12, fontWeight: "500", textAlign: "center" },
	smallButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
	cancelButton: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
});

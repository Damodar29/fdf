import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, BookOpen, Download, Mic, Music, PlayCircle, Search, SearchX, X } from "lucide-react-native";
import { type ReactNode, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ConfirmDeleteButton } from "../components/AudioListParts";
import { HighlightText } from "../components/HighlightText";
import { useTabBarSpace } from "../components/BottomNav";
import { SideScrollView } from "../components/SideScrollView";
import { VoiceSearchButton } from "../components/VoiceSearchButton";
import { triggerHaptic } from "../lib/haptics";
import type { RootNavigation } from "../navigation/types";
import { openInPdfApp, useBookStore } from "../store/bookStore";
import { useBhajansContent, useBooks, useLectures } from "../store/contentStore";
import { useDownloadStore } from "../store/downloadStore";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import { ink } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import type { Book } from "../types";
import { calculateBookScore, calculateLectureScore, calculateSearchScore } from "../utils/textProcessor";

// Native rebuild of components/DownloadedList.tsx ("Downloads / Offline" in
// the menu): downloaded bhajan recordings, katha and books, each with its
// two-tap delete. Audio and books live in the app's private storage, so
// there is no "Open in File Manager" (the Capacitor app also hid it for
// books). The Images tab returns with the Darshan/Activities screens that
// download photos.

type SubTab = "bhajans" | "lectures" | "books";
const GREEN = { light: "#16a34a", dark: "#4ade80" };

export function DownloadsScreen() {
	const navigation = useNavigation<RootNavigation>();
	const theme = useAppTheme();
	const dark = theme.isDark;
	const tabBarSpace = useTabBarSpace();
	const script = useSettingsStore((s) => s.script);
	const [tab, setTab] = useState<SubTab>("bhajans");
	const [query, setQuery] = useState("");
	const tracks = useDownloadStore((s) => s.downloaded);
	const deleteTrack = useDownloadStore((s) => s.deleteDownload);
	const books = useBookStore((s) => s.downloaded);
	const deleteBook = useBookStore((s) => s.deleteBook);
	const { items: allBhajans } = useBhajansContent();
	const { items: allLectures } = useLectures();
	const { items: allBooks } = useBooks();
	const q = query.trim();
	const searching = q.length > 0;

	const rank = <T,>(list: T[], score: (item: T) => number) =>
		searching
			? list
					.map((item) => ({ item, score: score(item) }))
					.filter((r) => r.score > 0)
					.sort((a, b) => b.score - a.score)
					.map((r) => r.item)
			: list;

	const bhajans = useMemo(
		() =>
			rank(
				allBhajans.filter((b) => b.audio?.some((t) => tracks[t.id])),
				(b) => calculateSearchScore(b, q, script),
			),
		// biome-ignore lint/correctness/useExhaustiveDependencies: rank is a pure helper
		[allBhajans, tracks, q, script],
	);
	const lectures = useMemo(
		() =>
			rank(
				allLectures.filter((l) => l.audio?.some((t) => tracks[t.id])),
				(l) => calculateLectureScore(l, q),
			),
		// biome-ignore lint/correctness/useExhaustiveDependencies: rank is a pure helper
		[allLectures, tracks, q],
	);
	const bookList = useMemo(
		() =>
			rank(
				allBooks.filter((b) => books[b.id]),
				(b) => calculateBookScore(b, q),
			),
		// biome-ignore lint/correctness/useExhaustiveDependencies: rank is a pure helper
		[allBooks, books, q],
	);

	const openBook = async (book: Book) => {
		const result = await openInPdfApp(book.id);
		if (result === "not_found") showToast("File not found! It may have been deleted from your device.", "error");
		else if (result !== "opened") navigation.navigate("BookViewer", { book });
	};

	const green = dark ? GREEN.dark : GREEN.light;
	const cardStyle = [styles.card, { backgroundColor: dark ? ink[800] : "#fff", borderColor: dark ? ink[700] : ink[100] }];
	const tracksBox = [styles.tracks, { backgroundColor: dark ? "rgba(7, 21, 41, 0.5)" : ink[50], borderTopColor: dark ? ink[700] : ink[100] }];
	const trackRow = (id: string, label: string, last: boolean) => (
		<View key={id} style={[styles.trackRow, !last && { borderBottomWidth: 1, borderBottomColor: dark ? ink[800] : ink[100] }]}>
			<Text style={[styles.trackLabel, { color: dark ? ink[400] : ink[500] }]} numberOfLines={1}>
				{label}
			</Text>
			<ConfirmDeleteButton onConfirm={() => deleteTrack(id)} iconColor={ink[400]} />
		</View>
	);

	let body: ReactNode;
	if (tab === "bhajans") {
		body =
			bhajans.length === 0 ? (
				<Empty
					theme={theme}
					searching={searching}
					message={searching ? "No matching bhajans" : "No downloaded bhajans"}
					sub={searching ? "Try a different search term" : "Download songs from the player to listen offline."}
				/>
			) : (
				bhajans.map((b) => {
					const own = (b.audio ?? []).filter((t) => tracks[t.id]);
					return (
						<View key={b.id} style={cardStyle}>
							<Pressable
								onPress={() => {
									triggerHaptic("medium");
									navigation.navigate("Reader", { bhajan: b });
								}}
								style={({ pressed }) => [styles.cardMain, pressed && { backgroundColor: dark ? "rgba(22, 48, 92, 0.5)" : theme.p[50] }]}
							>
								<HighlightText
									text={(script === "iast" ? b.titleIAST : b.title) || b.title}
									highlight={query}
									style={[styles.title, { color: dark ? ink[200] : ink[800] }]}
								/>
								<View style={styles.offline}>
									<PlayCircle size={14} color={green} />
									<Text style={[styles.offlineText, { color: green }]}>Available Offline</Text>
								</View>
							</Pressable>
							<View style={tracksBox}>{own.map((t, i) => trackRow(t.id, t.singer || "", i === own.length - 1))}</View>
						</View>
					);
				})
			);
	} else if (tab === "lectures") {
		body =
			lectures.length === 0 ? (
				<Empty
					theme={theme}
					searching={searching}
					message={searching ? "No matching katha" : "No downloaded katha"}
					sub={searching ? "Try a different search term" : "Download audio tracks from the Audio section."}
				/>
			) : (
				lectures.map((l) => {
					const own = (l.audio ?? []).filter((t) => tracks[t.id]);
					return (
						<View key={l.id} style={cardStyle}>
							<Pressable
								onPress={() => {
									triggerHaptic("medium");
									navigation.navigate("Lecture", { lecture: l });
								}}
								style={({ pressed }) => [styles.cardMain, pressed && { backgroundColor: dark ? "rgba(22, 48, 92, 0.5)" : theme.p[50] }]}
							>
								<HighlightText text={l.title} highlight={query} style={[styles.title, { color: dark ? ink[200] : ink[800] }]} />
								<View style={styles.offline}>
									<Mic size={14} color={green} />
									<Text style={[styles.offlineText, { color: green }]}>Available Offline</Text>
								</View>
							</Pressable>
							<View style={tracksBox}>
								{own.map((t, i) => trackRow(t.id, t.singer || "Audio Track", i === own.length - 1))}
							</View>
						</View>
					);
				})
			);
	} else {
		body =
			bookList.length === 0 ? (
				<Empty
					theme={theme}
					searching={searching}
					message={searching ? "No matching books" : "No downloaded books"}
					sub={searching ? "Try a different search term" : "Download PDFs from the Books section."}
				/>
			) : (
				bookList.map((book) => (
					<View key={book.id} style={[cardStyle, styles.bookCard]}>
						<Pressable onPress={() => openBook(book)} style={styles.bookMain}>
							<View style={[styles.bookIcon, { backgroundColor: dark ? ink[700] : ink[100] }]}>
								<BookOpen size={20} color={theme.primary} />
							</View>
							<View style={styles.shrink}>
								<HighlightText
									text={book.title}
									highlight={query}
									numberOfLines={1}
									style={[styles.bookTitle, { color: dark ? ink[200] : ink[800] }]}
								/>
								<HighlightText text={book.fileName} highlight={query} numberOfLines={1} style={[styles.bookFile, { color: ink[400] }]} />
							</View>
						</Pressable>
						<ConfirmDeleteButton onConfirm={() => deleteBook(book.id)} iconColor={ink[400]} />
					</View>
				))
			);
	}

	return (
		<View style={[styles.flex, { backgroundColor: dark ? ink[900] : ink[50] }]}>
			<LinearGradient
				colors={[theme.p[500], "#f97316"]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={styles.header}
			>
				<Pressable accessibilityLabel="Back" onPress={() => navigation.navigate("Tabs", { screen: "Home" })} style={styles.back}>
					<ArrowLeft size={24} color={dark ? ink[200] : ink[700]} />
				</Pressable>
				<View style={styles.headerTitle}>
					<Download size={24} color="#16a34a" />
					<Text style={[styles.heading, { color: dark ? "#fff" : ink[800] }]}>Downloads</Text>
				</View>
			</LinearGradient>

			<View style={styles.top}>
				<View style={[styles.search, { backgroundColor: dark ? ink[800] : ink[100] }]}>
					<Search size={18} color={ink[400]} />
					<TextInput
						value={query}
						onChangeText={setQuery}
						placeholder="Search downloads..."
						placeholderTextColor={ink[400]}
						style={[styles.searchInput, { color: dark ? "#fff" : ink[900] }]}
					/>
					<VoiceSearchButton onResult={setQuery} />
					{query ? (
						<Pressable onPress={() => setQuery("")} style={styles.clear}>
							<X size={16} color={ink[400]} />
						</Pressable>
					) : null}
				</View>
				<View style={[styles.tabs, { backgroundColor: dark ? ink[800] : ink[200] }]}>
					{(
						[
							["bhajans", "Bhajans", Music],
							["lectures", "Katha", Mic],
							["books", "Books", BookOpen],
						] as const
					).map(([id, label, Icon]) => {
						const active = tab === id;
						const color = active ? (dark ? theme.p[400] : theme.p[600]) : dark ? ink[400] : ink[500];
						return (
							<Pressable
								key={id}
								onPress={() => setTab(id)}
								style={[styles.tab, active && [styles.tabActive, { backgroundColor: dark ? ink[700] : "#fff" }]]}
							>
								<Icon size={14} color={color} />
								<Text style={[styles.tabText, { color }]}>{label}</Text>
							</Pressable>
						);
					})}
				</View>
			</View>

			<SideScrollView contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace + 16 }]} keyboardShouldPersistTaps="handled">
				{body}
			</SideScrollView>
		</View>
	);
}

function Empty({ theme, searching, message, sub }: { theme: AppTheme; searching: boolean; message: string; sub: string }) {
	const color = theme.isDark ? ink[400] : ink[400];
	return (
		<View style={styles.empty}>
			{searching ? (
				<SearchX size={64} color={color} style={styles.emptyIcon} />
			) : (
				<Download size={64} color={color} style={styles.emptyIcon} />
			)}
			<Text style={[styles.emptyText, { color }]}>{message}</Text>
			<Text style={[styles.emptySub, { color }]}>{sub}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	shrink: { flexShrink: 1 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		padding: 16,
		borderBottomWidth: 2,
		borderBottomColor: "rgba(212, 160, 23, 0.4)",
		elevation: 4,
		zIndex: 10,
	},
	back: { padding: 8, borderRadius: 999 },
	headerTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
	heading: { fontSize: 20, fontWeight: "700" },
	top: { padding: 16, paddingBottom: 0, gap: 16 },
	search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingLeft: 12, paddingRight: 6, minHeight: 44 },
	searchInput: { flex: 1, paddingVertical: 10, fontSize: 16 },
	clear: { padding: 4 },
	tabs: { flexDirection: "row", padding: 4, borderRadius: 12 },
	tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 8 },
	tabActive: { elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
	tabText: { fontSize: 14, fontWeight: "700" },
	list: { padding: 16, gap: 12 },
	card: { borderRadius: 12, borderWidth: 1, overflow: "hidden", elevation: 1 },
	cardMain: { padding: 16 },
	title: { fontSize: 18, fontWeight: "700", lineHeight: 22, marginBottom: 4 },
	offline: { flexDirection: "row", alignItems: "center", gap: 8 },
	offlineText: { fontSize: 12, fontWeight: "500" },
	tracks: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
	trackRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
	trackLabel: { flex: 1, fontSize: 12, fontWeight: "500", paddingRight: 16 },
	bookCard: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
	bookMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
	bookIcon: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
	bookTitle: { fontSize: 14, fontWeight: "700" },
	bookFile: { fontSize: 12 },
	empty: { height: 420, alignItems: "center", justifyContent: "center", padding: 32 },
	emptyIcon: { opacity: 0.2, marginBottom: 16 },
	emptyText: { fontSize: 18, fontWeight: "500", textAlign: "center" },
	emptySub: { fontSize: 14, opacity: 0.7, marginTop: 8, textAlign: "center" },
});

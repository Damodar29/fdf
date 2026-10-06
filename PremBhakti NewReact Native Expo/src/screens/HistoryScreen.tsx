import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import {
	BookOpen,
	ChevronRight,
	History as HistoryIcon,
	type LucideIcon,
	Mic,
	Music,
	Trash2,
	Users,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BackupRestoreSection } from "../components/BackupRestoreSection";
import { useTabBarSpace } from "../components/BottomNav";
import { ListState } from "../components/ScreenChrome";
import { KNOWN_AUTHORS } from "../data/authors";
import { SideScrollView } from "../components/SideScrollView";
import { triggerHaptic } from "../lib/haptics";
import { openBook } from "../lib/openBook";
import type { RootNavigation } from "../navigation/types";
import { useBhajansContent, useBooks, useLectures } from "../store/contentStore";
import { useHistoryStore } from "../store/historyStore";
import { useSettingsStore } from "../store/settingsStore";
import { ink } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import type { Bhajan, Book, LectureData } from "../types";

// The "History" tab: native rebuild of components/HistoryAuthorsScreen.tsx.
//  - Top tabs (History / Authors) with the saffron underline, as TabButton.
//  - History: recently opened bhajans, katha and books (HistoryList.tsx).
//  - Authors: every bhajan grouped by author, one group open at a time
//    (CategoryList.tsx); opening a bhajan queues the whole list.
// The Capacitor screen's backup/restore section is not ported here: backup
// is Google Drive only and lives in Settings. The web tab has no search box
// of its own (it only reused the other tabs' global query), so neither does
// this one.
type Section = "history" | "authors";

const T = {
	en: {
		history: "History",
		authors: "Authors",
		recent: "Recent Activity",
		clear: "Clear History",
		noHistory: "No recent history",
		tracks: "Tracks",
	},
	hi: {
		history: "इतिहास",
		authors: "रचयिता",
		recent: "हाल की गतिविधि",
		clear: "इतिहास मिटाएं",
		noHistory: "कोई हालिया इतिहास नहीं",
		tracks: "ट्रैक",
	},
};
type Strings = (typeof T)["en"];

// Tailwind 3's default border colour (gray-200), used by HistoryList's
// unthemed `border-b`.
const DEFAULT_BORDER = "#e5e7eb";
const RED_500 = "#ef4444";

export function HistoryScreen() {
	const theme = useAppTheme();
	const [section, setSection] = useState<Section>("history");
	const t = T[useSettingsStore((s) => s.settingsLanguage)];
	const tabs: { id: Section; icon: LucideIcon; label: string }[] = [
		{ id: "history", icon: HistoryIcon, label: t.history },
		{ id: "authors", icon: Users, label: t.authors },
	];

	return (
		<View style={styles.flex}>
			<View style={[styles.tabs, { borderBottomColor: theme.isDark ? ink[700] : theme.p[200] }]}>
				{tabs.map(({ id, icon: Icon, label }) => {
					const active = id === section;
					const color = active ? theme.p[600] : ink[400];
					return (
						<Pressable
							key={id}
							accessibilityRole="tab"
							accessibilityState={{ selected: active }}
							onPress={() => {
								if (active) return;
								triggerHaptic("light");
								setSection(id);
							}}
							style={[
								styles.tab,
								active
									? { borderBottomColor: theme.p[500], backgroundColor: theme.isDark ? ink[800] : theme.p[50] }
									: null,
							]}
						>
							<Icon size={18} color={color} />
							<Text style={[styles.tabLabel, { color }]}>{label}</Text>
						</Pressable>
					);
				})}
			</View>
			{section === "history" ? <HistoryList t={t} /> : <AuthorList />}
		</View>
	);
}

type HistoryRow =
	| { kind: "song"; key: string; bhajan: Bhajan }
	| { kind: "lecture"; key: string; lecture: LectureData }
	| { kind: "book"; key: string; book: Book };

type HistoryItem = HistoryRow | { kind: "backup"; key: string } | { kind: "header"; key: string };

const ICONS: Record<HistoryRow["kind"], LucideIcon> = { song: Music, lecture: Mic, book: BookOpen };

function HistoryList({ t }: { t: Strings }) {
	const theme = useAppTheme();
	const tabBarSpace = useTabBarSpace();
	const navigation = useNavigation<RootNavigation>();
	const script = useSettingsStore((s) => s.script);
	const items = useHistoryStore((s) => s.items);
	const clearHistory = useHistoryStore((s) => s.clearHistory);
	const { height } = useWindowDimensions();
	const { items: bhajans } = useBhajansContent();
	const { items: books } = useBooks();
	const { items: lectures } = useLectures();

	// Resolve ids against the current content; entries whose item was removed
	// upstream simply drop out, as in HistoryList.tsx.
	const rows = useMemo(() => {
		const out: HistoryRow[] = [];
		for (const entry of items) {
			const key = `${entry.type}_${entry.id}`;
			if (entry.type === "book") {
				const book = books.find((b) => b.id === entry.id);
				if (book) out.push({ kind: "book", key, book });
			} else if (entry.type === "lecture") {
				const lecture = lectures.find((l) => l.id === entry.id);
				if (lecture) out.push({ kind: "lecture", key, lecture });
			} else {
				const bhajan = bhajans.find((b) => b.id === entry.id);
				if (bhajan) out.push({ kind: "song", key, bhajan });
			}
		}
		return out;
	}, [items, bhajans, books, lectures]);

	// HistoryAuthorsScreen puts the Drive backup card above the history (and its empty state).
	if (items.length === 0) {
		return (
			<SideScrollView style={styles.flex} contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarSpace }}>
				<BackupRestoreSection titled />
				<View style={[styles.empty, { minHeight: height * 0.6 }]}>
					<HistoryIcon size={48} color={ink[400]} style={styles.emptyIcon} />
					<Text style={[styles.emptyText, { color: ink[400] }]}>{t.noHistory}</Text>
				</View>
			</SideScrollView>
		);
	}

	const open = (row: HistoryRow) => {
		if (row.kind === "book") {
			openBook(row.book, navigation);
			return;
		}
		triggerHaptic("medium");
		if (row.kind === "lecture") navigation.navigate("Lecture", { lecture: row.lecture });
		else navigation.navigate("Reader", { bhajan: row.bhajan });
	};

	const describe = (row: HistoryRow): [string, string | undefined] => {
		if (row.kind === "book") return [row.book.title, row.book.fileName];
		if (row.kind === "lecture") {
			return [row.lecture.title, row.lecture.date || `${row.lecture.audio?.length || 0} ${t.tracks}`];
		}
		const iast = script === "iast";
		return [iast ? row.bhajan.titleIAST : row.bhajan.title, iast ? row.bhajan.firstLineIAST : row.bhajan.firstLine];
	};

	const header = (
		// Sticky as in HistoryList (there over a blur; here over the page colour).
		<View style={[styles.listHeader, { borderBottomColor: theme.isDark ? ink[800] : DEFAULT_BORDER, backgroundColor: theme.page }]}>
			<Text style={[styles.listHeaderText, { color: theme.isDark ? ink[300] : ink[500] }]}>{t.recent}</Text>
			<Pressable
				hitSlop={10}
				onPress={() => {
					triggerHaptic("light");
					clearHistory();
				}}
				style={({ pressed }) => [styles.clear, pressed && { transform: [{ scale: 0.95 }] }]}
			>
				<Trash2 size={12} color={RED_500} />
				<Text style={styles.clearText}>{t.clear}</Text>
			</Pressable>
		</View>
	);
	const listData: HistoryItem[] = [{ kind: "backup", key: "backup" }, { kind: "header", key: "header" }, ...rows];

	return (
		<View style={styles.flex}>
			<FlashList<HistoryItem>
				renderScrollComponent={SideScrollView}
				data={listData}
				stickyHeaderIndices={[1]}
				keyExtractor={(row) => row.key}
				getItemType={(row) => row.kind}
				contentContainerStyle={{ paddingBottom: tabBarSpace + 32 }}
				renderItem={({ item, index }) => {
					if (item.kind === "backup") return <BackupRestoreSection titled />;
					if (item.kind === "header") return header;
					const [title, subtitle] = describe(item);
					const Icon = ICONS[item.kind];
					return (
						<Pressable
							onPress={() => open(item)}
							style={[
								styles.historyRow,
								index > 2 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline } : null,
							]}
						>
							<View style={[styles.historyIcon, { backgroundColor: theme.well }]}>
								<Icon size={20} color={theme.primary} />
							</View>
							<View style={styles.rowText}>
								<Text style={[styles.historyTitle, { color: theme.isDark ? ink[200] : ink[800] }]} numberOfLines={1}>
									{title}
								</Text>
								{subtitle ? (
									<Text style={[styles.historyMeta, { color: ink[500] }]} numberOfLines={1}>
										{subtitle}
									</Text>
								) : null}
							</View>
						</Pressable>
					);
				}}
			/>
		</View>
	);
}

// One flat list for FlashList: an author header, followed by that author's
// bhajans when the group is open. `last` marks the row that closes a group's
// card (its bottom border and the gap before the next group).
type AuthorRow =
	| { kind: "author"; key: string; group: string; name: string; count: number; open: boolean }
	| { kind: "bhajan"; key: string; bhajan: Bhajan; first: boolean; last: boolean };

const MISC_KEY = "Uncategorized";

function AuthorList() {
	const theme = useAppTheme();
	const tabBarSpace = useTabBarSpace();
	const navigation = useNavigation<RootNavigation>();
	const script = useSettingsStore((s) => s.script);
	const { items: bhajans, isSyncing, error, refresh } = useBhajansContent();
	const [expanded, setExpanded] = useState<string | null>(null);
	const iast = script === "iast";

	const groups = useMemo(() => {
		const byAuthor = new Map<string, Bhajan[]>();
		for (const b of bhajans) {
			if (b.isHidden) continue;
			const key = b.author || MISC_KEY;
			const list = byAuthor.get(key);
			if (list) list.push(b);
			else byAuthor.set(key, [b]);
		}
		// Known authors by their Devanagari display name, unknown ones by key,
		// "Uncategorized" last — CategoryList's order.
		const keys = [...byAuthor.keys()].sort((a, b) => {
			if (a === MISC_KEY) return 1;
			if (b === MISC_KEY) return -1;
			return (KNOWN_AUTHORS[a]?.deva || a).localeCompare(KNOWN_AUTHORS[b]?.deva || b, "hi");
		});
		return keys.map((key) => ({ key, bhajans: byAuthor.get(key) ?? [] }));
	}, [bhajans]);

	const rows = useMemo(() => {
		const out: AuthorRow[] = [];
		for (const g of groups) {
			const open = expanded === g.key;
			// CategoryList labels follow the script setting, not the UI language.
			const name =
				g.key === MISC_KEY
					? iast
						? "Uncategorized"
						: "विविध / अन्य"
					: KNOWN_AUTHORS[g.key]?.[iast ? "iast" : "deva"] || g.key;
			out.push({ kind: "author", key: `a_${g.key}`, group: g.key, name, count: g.bhajans.length, open });
			if (open) {
				g.bhajans.forEach((b, i) =>
					out.push({ kind: "bhajan", key: `b_${b.id}`, bhajan: b, first: i === 0, last: i === g.bhajans.length - 1 }),
				);
			}
		}
		return out;
	}, [groups, expanded, iast]);

	if (bhajans.length === 0) {
		return <ListState loading={isSyncing} error={error} onRetry={refresh} />;
	}

	const groupBorder = theme.isDark ? ink[700] : theme.p[200];

	return (
		<FlashList<AuthorRow>
			renderScrollComponent={SideScrollView}
			data={rows}
			keyExtractor={(row) => row.key}
			getItemType={(row) => row.kind}
			extraData={theme}
			contentContainerStyle={{ paddingTop: 8, paddingBottom: tabBarSpace + 8 }}
			renderItem={({ item }) =>
				item.kind === "author" ? (
					<AuthorHeader item={item} theme={theme} border={groupBorder} iast={iast} onToggle={setExpanded} />
				) : (
					<Pressable
						onPress={() => {
							triggerHaptic("medium");
							navigation.navigate("Reader", { bhajan: item.bhajan, listQueueName: "Authors List" });
						}}
						style={({ pressed }) => [
							styles.authorBhajan,
							item.first
								? { borderTopWidth: 1, borderTopColor: groupBorder }
								: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.isDark ? ink[800] : theme.p[100] },
							item.last ? { borderBottomWidth: 1, borderBottomColor: groupBorder, marginBottom: 8 } : null,
							pressed ? { backgroundColor: theme.isDark ? ink[800] : theme.p[100] } : null,
						]}
					>
						<Text style={[styles.authorBhajanTitle, { color: theme.isDark ? ink[200] : ink[800] }]}>
							{iast ? item.bhajan.titleIAST : item.bhajan.title}
						</Text>
						<Text style={[styles.historyMeta, styles.authorBhajanLine, { color: theme.isDark ? ink[400] : ink[500] }]} numberOfLines={1}>
							{iast ? item.bhajan.firstLineIAST : item.bhajan.firstLine}
						</Text>
					</Pressable>
				)
			}
		/>
	);
}

function AuthorHeader({
	item,
	theme,
	border,
	iast,
	onToggle,
}: {
	item: Extract<AuthorRow, { kind: "author" }>;
	theme: AppTheme;
	border: string;
	iast: boolean;
	onToggle: (update: (prev: string | null) => string | null) => void;
}) {
	return (
		<Pressable
			onPress={() => {
				triggerHaptic("light");
				onToggle((prev) => (prev === item.group ? null : item.group));
			}}
			style={({ pressed }) => [
				styles.authorHeader,
				{ borderTopColor: border },
				// A closed group is a card of its own; an open one is closed off
				// by its last bhajan row.
				item.open ? null : { borderBottomWidth: 1, borderBottomColor: border, marginBottom: 8 },
				pressed ? { backgroundColor: theme.isDark ? ink[800] : theme.p[100] } : null,
			]}
		>
			<View style={styles.authorLeft}>
				<View style={[styles.authorIcon, { backgroundColor: theme.isDark ? ink[800] : theme.p[100] }]}>
					<Users size={16} color={theme.primary} />
				</View>
				<View style={styles.rowText}>
					<Text style={[styles.authorName, { color: theme.isDark ? ink[200] : ink[800] }]}>{item.name}</Text>
					<Text style={[styles.historyMeta, { color: theme.isDark ? ink[400] : ink[600] }]}>
						{item.count} {iast ? "Songs" : "भजन"}
					</Text>
				</View>
			</View>
			<ChevronRight
				size={20}
				color={theme.isDark ? ink[500] : ink[400]}
				style={{ transform: [{ rotate: item.open ? "90deg" : "0deg" }] }}
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	tabs: { flexDirection: "row", borderBottomWidth: 1, zIndex: 20 },
	tab: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		paddingVertical: 8,
		borderBottomWidth: 3,
		borderBottomColor: "transparent",
	},
	tabLabel: { fontSize: 12, fontWeight: "700" },
	empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
	emptyIcon: { marginBottom: 16, opacity: 0.5 },
	emptyText: { fontSize: 18, fontWeight: "500", textAlign: "center" },
	listHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
	},
	listHeaderText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
	clear: { flexDirection: "row", alignItems: "center", gap: 4 },
	clearText: { fontSize: 12, fontWeight: "700", color: RED_500 },
	historyRow: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
	historyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
	rowText: { flex: 1, minWidth: 0 },
	historyTitle: { fontSize: 16, fontWeight: "700" },
	historyMeta: { fontSize: 12 },
	authorHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 16,
		borderTopWidth: 1,
	},
	authorLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
	authorIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
	authorName: { fontSize: 16, fontWeight: "700" },
	authorBhajan: { paddingVertical: 12, paddingHorizontal: 16, paddingLeft: 56 },
	authorBhajanTitle: { fontSize: 16, fontWeight: "500" },
	authorBhajanLine: { marginTop: 2 },
});

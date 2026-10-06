import { useNavigation } from "@react-navigation/native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import {
	Bell,
	Book,
	Check,
	ChevronRight,
	CloudRain,
	Filter,
	Flame,
	Flower2,
	Gift,
	Heart,
	History,
	Languages,
	ListMusic,
	type LucideIcon,
	Moon,
	Music,
	Music2,
	Plus,
	Search,
	Sparkles,
	Star,
	Sun,
	Tag,
	X,
} from "lucide-react-native";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "../components/BottomNav";
import { HighlightText } from "../components/HighlightText";
import { VoiceSearchButton } from "../components/VoiceSearchButton";
import type { AuthorDef } from "../data/authors";
import { useBhajans } from "../hooks/useBhajans";
import { SideScrollView } from "../components/SideScrollView";
import { triggerHaptic } from "../lib/haptics";
import type { RootNavigation } from "../navigation/types";
import {
	authorDisplayName,
	DEFAULT_CATEGORIES,
	useAppConfigStore,
} from "../store/appConfigStore";
import { useAudioStore } from "../store/audioStore";
import { usePlaylistStore } from "../store/playlistStore";
import { useSettingsStore } from "../store/settingsStore";
import { ink, janmashtami } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import type { Bhajan, ScriptType } from "../types";
import { getBhajanCategory } from "../utils/bhajanClassifier";
import {
	addRecentSearch,
	clearRecentSearches,
	getRecentSearches,
} from "../utils/recentSearches";
import {
	calculateSearchScore,
	getDevanagariBaseChar,
	getListFirstLine,
	getMatchingSnippet,
} from "../utils/textProcessor";

// The "Bhajans" tab: native rebuild of components/BhajanList.tsx (+ the
// search scoring App.tsx did in `filteredBhajans`). Alphabet sections with
// sticky letter headers and the A–Z / अ–ज्ञ index rail, a filter sheet
// (Nitya Kriya, My Collections, categories), and search with recent terms
// showing results as cards with highlighted matches.

const GOLD = janmashtami.deepGold;
const goldA = (a: number) => `rgba(212, 160, 23, ${a})`;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
	badhai: Gift,
	holi: Flame,
	jhula: CloudRain,
	aarti: Bell,
	ashtak: Book,
	bhajan: Music,
	kirtan: Music2,
	stuti: Star,
	prarthana: Heart,
	pad: Sparkles,
	vasant: Flower2,
};

const T = {
	en: {
		filterTitle: "Filter & Collections",
		nityaKriya: "Nitya Kriya",
		morning: "Morning",
		evening: "Evening",
		collections: "My Collections",
		customList: "Custom List",
		listName: "List Name",
		add: "Add",
		categories: "Categories",
		allBhajans: "All Bhajans",
		morningNitya: "Morning Nitya Kriya",
		eveningNitya: "Evening Nitya Kriya",
		searchPlaceholder: "Search (Hinglish)...",
		syncing: "☁️ Bhajans are syncing in background",
		loading: "Loading Bhajan list...",
		noneTitle: "No Bhajans Available",
		noneBody: "Connect to the internet to load & save bhajans for offline use.",
		connect: "Connect to Internet",
		fetchLatest: "Fetch Latest Bhajans",
		notFound: "No Bhajans Found",
		notFoundBody: "Please check the spelling and try typing correctly.",
		emptyFilter: "No bhajans in this category",
		emptyPlaylist: "Add songs from the reader view",
	},
	hi: {
		filterTitle: "फ़िल्टर और संग्रह",
		nityaKriya: "नित्य क्रिया",
		morning: "प्रातः (Morning)",
		evening: "सायं (Evening)",
		collections: "मेरे संग्रह",
		customList: "कस्टम सूची",
		listName: "सूची का नाम",
		add: "जोड़ें",
		categories: "श्रेणियाँ",
		allBhajans: "सभी भजन",
		morningNitya: "प्रातः नित्य क्रिया",
		eveningNitya: "सायं नित्य क्रिया",
		searchPlaceholder: "खोजें (Hinglish)..",
		syncing: "☁️ भजन बैकग्राउंड में अपडेट हो रहे हैं",
		loading: "भजन सूची लोड हो रही है...",
		noneTitle: "भजन उपलब्ध नहीं",
		noneBody: "भजन लोड करने के लिए इंटरनेट से जोड़ें।",
		connect: "इंटरनेट से जोड़ें",
		fetchLatest: "नवीनतम भजन Fetch करें",
		notFound: "भजन नहीं मिला",
		notFoundBody: "कृपया भजन का नाम या स्पेलिंग सही से टाइप करें।",
		emptyFilter: "No bhajans in this category",
		emptyPlaylist: "Add songs from the reader view",
	},
};
type Strings = (typeof T)["en"];

// Hinglish index: titles starting with these letters are listed under every
// Latin letter a reader might try (BhajanList.tsx groupedBhajans).
const HINGLISH_MAP: Record<string, string[]> = {
	ऐ: ["A", "E"],
	ए: ["E"],
	औ: ["A", "O"],
	ओ: ["O"],
	ज्ञ: ["G", "J"],
	क्ष: ["K"],
	ऋ: ["R"],
};
const VOWEL_MAP: Record<string, string> = {
	आ: "अ",
	ई: "इ",
	ऊ: "उ",
	ऐ: "ए",
	औ: "ओ",
};

type Row =
	| { kind: "header"; key: string }
	| { kind: "bhajan"; key: string; bhajan: Bhajan };

export function SongsScreen() {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const tabBarSpace = useTabBarSpace();
	const navigation = useNavigation<RootNavigation>();
	const script = useSettingsStore((s) => s.script);
	const language = useSettingsStore((s) => s.settingsLanguage);
	const setLanguage = useSettingsStore((s) => s.setSettingsLanguage);
	const indexMode = useSettingsStore((s) => s.indexMode);
	const setIndexMode = useSettingsStore((s) => s.setIndexMode);
	const azSide = useSettingsStore((s) => s.azSliderSide);
	const t = T[language];
	const { bhajans, isSyncing, error, refresh } = useBhajans();
	const {
		filterCategories,
		knownAuthors,
		sync: syncConfig,
	} = useAppConfigStore();
	const playlists = usePlaylistStore((s) => s.playlists);
	const createPlaylist = usePlaylistStore((s) => s.createPlaylist);

	const hasTrack = useAudioStore((s) => s.currentTrack !== null);
	const [query, setQuery] = useState("");
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [activeFilter, setActiveFilter] = useState("all");
	const [showFilter, setShowFilter] = useState(false);
	const listRef = useRef<FlashListRef<Row>>(null);

	useEffect(() => {
		syncConfig();
	}, [syncConfig]);

	const categories =
		filterCategories.length > 0 ? filterCategories : DEFAULT_CATEGORIES;
	const visible = useMemo(() => bhajans.filter((b) => !b.isHidden), [bhajans]);
	const searching = query.trim().length > 0;

	const results = useMemo(() => {
		if (!searching) return [];
		return visible
			.map((b) => ({ b, score: calculateSearchScore(b, query, script) }))
			.filter((r) => r.score > 0)
			.sort((x, y) => y.score - x.score)
			.map((r) => r.b);
	}, [visible, query, script, searching]);

	const filterLabel = (filter: string) => {
		if (filter.startsWith("playlist-")) {
			return (
				playlists.find((p) => p.id === filter.slice(9))?.name ?? t.customList
			);
		}
		if (filter === "morning") return t.morningNitya;
		if (filter === "evening") return t.eveningNitya;
		const cat = categories.find((c) => c.id === filter);
		if (cat) return language === "hi" ? cat.labelHi : cat.labelEn;
		return t.allBhajans;
	};

	// Filter → sort → group into letter sections, exactly as BhajanList.tsx.
	const { rows, headerIndices, sectionStarts } = useMemo(() => {
		let list = visible;
		if (activeFilter === "morning" || activeFilter === "evening") {
			list = visible.filter(
				(b) => typeof b.categories?.[activeFilter] === "number",
			);
		} else if (activeFilter.startsWith("playlist-")) {
			const playlist = playlists.find((p) => p.id === activeFilter.slice(9));
			list = playlist
				? visible.filter((b) => playlist.items.includes(b.id))
				: [];
		} else if (activeFilter !== "all") {
			list = visible.filter((b) => getBhajanCategory(b).includes(activeFilter));
		}

		const sorted = [...list].sort((a, b) => {
			if (activeFilter === "morning" || activeFilter === "evening") {
				return (
					(a.categories?.[activeFilter] ?? 9999) -
					(b.categories?.[activeFilter] ?? 9999)
				);
			}
			if (activeFilter !== "all") {
				const numA = Number.parseInt(a.songNumber || "0", 10);
				const numB = Number.parseInt(b.songNumber || "0", 10);
				if (numA > 0 && numB > 0) return numA - numB;
			}
			return indexMode === "devanagari"
				? a.title.localeCompare(b.title, "hi")
				: a.titleIAST.localeCompare(b.titleIAST);
		});

		const groups = new Map<string, Bhajan[]>();
		const push = (key: string, b: Bhajan) => {
			const g = groups.get(key);
			if (!g) groups.set(key, [b]);
			else if (!g.includes(b)) g.push(b);
		};
		for (const b of sorted) {
			if (activeFilter !== "all") {
				push("_filter", b);
			} else if (indexMode === "latin") {
				const deva = getDevanagariBaseChar(b.title);
				if (HINGLISH_MAP[deva]) {
					for (const k of HINGLISH_MAP[deva]) push(k, b);
				} else {
					const c = b.titleIAST
						.charAt(0)
						.toUpperCase()
						.normalize("NFD")
						.replace(/[̀-ͯ]/g, "");
					push(/^[A-Z]/.test(c) ? c : "#", b);
				}
			} else {
				const base = getDevanagariBaseChar(b.title);
				push(VOWEL_MAP[base] || base, b);
			}
		}

		const keys = [...groups.keys()];
		if (activeFilter === "all") {
			keys.sort((a, b) =>
				a === "#"
					? 1
					: b === "#"
						? -1
						: a.localeCompare(b, indexMode === "devanagari" ? "hi" : "en"),
			);
		}

		const out: Row[] = [];
		const headers: number[] = [];
		const starts: Record<string, number> = {};
		for (const key of keys) {
			if (activeFilter === "all") {
				starts[key] = out.length;
				headers.push(out.length);
				out.push({ kind: "header", key });
			}
			for (const b of groups.get(key) ?? [])
				out.push({ kind: "bhajan", key: `${key}_${b.id}`, bhajan: b });
		}
		return { rows: out, headerIndices: headers, sectionStarts: starts };
	}, [visible, activeFilter, playlists, indexMode]);

	const sectionKeys = Object.keys(sectionStarts);
	const showAz = !searching && activeFilter === "all" && sectionKeys.length > 0;
	const sidePad =
		azSide === "left"
			? { paddingLeft: 48, paddingRight: 16 }
			: { paddingRight: 48, paddingLeft: 16 };

	const openBhajan = (bhajan: Bhajan) => {
		triggerHaptic("medium");
		if (searching) addRecentSearch(query);
		navigation.navigate("Reader", { bhajan, listQueueName: "Song List" });
	};

	const openSearch = () => {
		triggerHaptic("light");
		setIsSearchOpen(true);
	};

	// ── Empty / loading states (no data yet) ───────────────────────────────
	if (visible.length === 0) {
		return (
			<View style={[styles.flex, {}]}>
				{isSyncing ? (
					<View style={styles.centerState}>
						<View style={styles.loaderRing}>
							<Music size={36} color={goldA(0.6)} />
							<ActivityIndicator
								style={StyleSheet.absoluteFill}
								size={80}
								color={GOLD}
							/>
						</View>
						<Text style={[styles.loadingTitle, { color: GOLD }]}>
							{t.loading}
						</Text>
					</View>
				) : (
					<View style={[styles.centerState, { paddingHorizontal: 32 }]}>
						<View
							style={[
								styles.emptyIcon,
								{ backgroundColor: error ? "#fee2e2" : theme.well },
							]}
						>
							<Music
								size={40}
								color={error ? "#fca5a5" : theme.isDark ? ink[600] : ink[300]}
							/>
						</View>
						<Text
							style={[
								styles.emptyTitle,
								{ color: theme.isDark ? ink[200] : ink[700] },
							]}
						>
							{t.noneTitle}
						</Text>
						<Text style={[styles.emptyBody, { color: ink[400] }]}>
							{t.noneBody}
						</Text>
						<View style={styles.connectPill}>
							<View
								style={[
									styles.dot,
									{ backgroundColor: theme.isDark ? ink[600] : ink[300] },
								]}
							/>
							<Text style={styles.connectText}>{t.connect}</Text>
						</View>
						<Pressable
							onPress={refresh}
							style={[
								styles.fetchButton,
								error ? { backgroundColor: "#dc2626" } : null,
							]}
						>
							<Text style={styles.fetchText}>{t.fetchLatest}</Text>
						</Pressable>
					</View>
				)}
			</View>
		);
	}

	return (
		<View style={[styles.flex, {}]}>
			{isSyncing ? (
				<View style={styles.syncBanner}>
					<ActivityIndicator size="small" color={GOLD} />
					<Text style={styles.syncText}>{t.syncing}</Text>
				</View>
			) : null}

			{isSearchOpen || searching ? (
				<SearchBar
					theme={theme}
					query={query}
					onChange={setQuery}
					onClose={() => {
						setQuery("");
						setIsSearchOpen(false);
					}}
					placeholder={t.searchPlaceholder}
					sidePad={sidePad}
				/>
			) : activeFilter !== "all" ? (
				<View
					style={[
						styles.filterHeader,
						sidePad,
						{
							backgroundColor: theme.isDark
								? "rgba(7,21,41,0.95)"
								: "rgba(255,248,231,0.95)",
						},
					]}
				>
					<View style={styles.rowCenter}>
						<Pressable
							onPress={() => setActiveFilter("all")}
							style={[
								styles.clearFilter,
								{ backgroundColor: theme.isDark ? ink[800] : goldA(0.1) },
							]}
						>
							<X size={14} color={GOLD} />
						</Pressable>
						<Text style={styles.filterLabel}>{filterLabel(activeFilter)}</Text>
					</View>
					<View style={styles.rowCenter}>
						<Pressable
							onPress={openSearch}
							style={[
								styles.smallRound,
								{ backgroundColor: theme.isDark ? ink[800] : goldA(0.1) },
							]}
						>
							<Search size={16} color={GOLD} />
						</Pressable>
						<Pressable
							onPress={() => setShowFilter(true)}
							style={[
								styles.smallRound,
								{ backgroundColor: theme.isDark ? ink[800] : goldA(0.1) },
							]}
						>
							<Filter size={16} color={GOLD} />
						</Pressable>
					</View>
				</View>
			) : null}

			<View style={styles.flex}>
				{searching ? (
					<FlashList<Bhajan>
						renderScrollComponent={SideScrollView}
						data={results}
						keyExtractor={(b) => b.id}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={{
							paddingTop: 8,
							paddingHorizontal: 12,
							paddingBottom: tabBarSpace + 80,
						}}
						ListEmptyComponent={
							<View style={[styles.centerState, { height: 420 }]}>
								<View
									style={[styles.emptyIcon, { backgroundColor: theme.well }]}
								>
									<Search
										size={40}
										color={theme.isDark ? ink[600] : ink[300]}
									/>
								</View>
								<Text
									style={[
										styles.emptyTitle,
										{ color: theme.isDark ? ink[200] : ink[700] },
									]}
								>
									{t.notFound}
								</Text>
								<Text style={[styles.emptyBody, { color: ink[400] }]}>
									{t.notFoundBody}
								</Text>
							</View>
						}
						renderItem={({ item }) => (
							<ResultCard
								bhajan={item}
								script={script}
								query={query}
								theme={theme}
								authors={knownAuthors}
								onPress={openBhajan}
							/>
						)}
					/>
				) : rows.length === 0 ? (
					<View style={[styles.centerState, { height: 256 }]}>
						<Filter size={48} color={ink[400]} style={{ opacity: 0.2 }} />
						<Text style={{ color: ink[400], marginTop: 8 }}>
							{t.emptyFilter}
						</Text>
						{activeFilter.startsWith("playlist-") ? (
							<Text style={{ color: ink[400], fontSize: 12, marginTop: 8 }}>
								{t.emptyPlaylist}
							</Text>
						) : null}
					</View>
				) : (
					<FlashList<Row>
						renderScrollComponent={SideScrollView}
						ref={listRef}
						data={rows}
						keyExtractor={(r) => r.key}
						getItemType={(r) => r.kind}
						stickyHeaderIndices={headerIndices}
						contentContainerStyle={{ paddingBottom: tabBarSpace + 8 }}
						renderItem={({ item }) =>
							item.kind === "header" ? (
								<SectionHeader
									letter={item.key}
									theme={theme}
									sidePad={sidePad}
								/>
							) : (
								<BhajanRow
									bhajan={item.bhajan}
									script={script}
									theme={theme}
									authors={knownAuthors}
									sidePad={sidePad}
									onPress={openBhajan}
								/>
							)
						}
					/>
				)}

				{/* Floating search + filter, over the first section header. */}
				{!searching &&
				!isSearchOpen &&
				activeFilter === "all" &&
				rows.length > 0 ? (
					<View
						style={[
							styles.floatingActions,
							azSide === "left" ? { right: 16 } : { right: 48 },
						]}
					>
						<Pressable
							accessibilityLabel="Search"
							onPress={openSearch}
							style={[styles.floatButton, floatBg(theme)]}
						>
							<Search size={20} color={goldA(0.8)} />
						</Pressable>
						<Pressable
							accessibilityLabel="Filter"
							onPress={() => {
								triggerHaptic("light");
								setShowFilter(true);
							}}
							style={[styles.floatButton, floatBg(theme)]}
						>
							<Filter size={20} color={goldA(0.8)} />
						</Pressable>
					</View>
				) : null}
			</View>

			{/* Floating voice search (BhajanList's FAB), lifted above the mini player. */}
			<View
				style={[
					styles.voiceFab,
					{
						bottom: (hasTrack ? 184 : 112) + insets.bottom,
						backgroundColor: theme.p[600],
						shadowColor: theme.p[600],
					},
				]}
			>
				<VoiceSearchButton
					size={24}
					color="#fff"
					onResult={(text) => {
						setQuery(text);
						setIsSearchOpen(true);
					}}
				/>
			</View>

			{showAz ? (
				<AzSlider
					keys={sectionKeys}
					indexMode={indexMode}
					side={azSide}
					bottom={88 + insets.bottom}
					theme={theme}
					onToggle={() => {
						triggerHaptic("light");
						setIndexMode(indexMode === "latin" ? "devanagari" : "latin");
					}}
					onSelect={(key) => {
						triggerHaptic("light");
						listRef.current?.scrollToIndex({
							index: sectionStarts[key],
							animated: true,
						});
					}}
				/>
			) : null}

			<FilterSheet
				visible={showFilter}
				onClose={() => setShowFilter(false)}
				theme={theme}
				t={t}
				language={language}
				onToggleLanguage={() => {
					triggerHaptic("light");
					setLanguage(language === "en" ? "hi" : "en");
				}}
				activeFilter={activeFilter}
				onSelect={(f) => {
					triggerHaptic("light");
					setActiveFilter(f);
					setShowFilter(false);
				}}
				categories={categories}
				playlists={playlists}
				onCreatePlaylist={createPlaylist}
			/>
		</View>
	);
}

const floatBg = (theme: AppTheme) => ({
	backgroundColor: theme.isDark ? "rgba(7,21,41,0.9)" : "rgba(255,248,231,0.9)",
});

function SectionHeader({
	letter,
	theme,
	sidePad,
}: {
	letter: string;
	theme: AppTheme;
	sidePad: object;
}) {
	return (
		<View
			style={[
				styles.sectionHeader,
				sidePad,
				{
					backgroundColor: theme.isDark
						? "rgba(3,11,26,0.95)"
						: "rgba(255,248,231,0.95)",
				},
			]}
		>
			<View
				style={[
					styles.sectionKey,
					theme.isDark
						? { backgroundColor: ink[800], borderColor: ink[700] }
						: null,
				]}
			>
				<Text style={styles.sectionKeyText}>{letter}</Text>
			</View>
		</View>
	);
}

const BhajanRow = memo(function BhajanRow({
	bhajan,
	script,
	theme,
	authors,
	sidePad,
	onPress,
}: {
	bhajan: Bhajan;
	script: ScriptType;
	theme: AppTheme;
	authors: Record<string, AuthorDef>;
	sidePad: object;
	onPress: (b: Bhajan) => void;
}) {
	const iast = script === "iast";
	const title = iast ? bhajan.titleIAST : bhajan.title;
	const subtitle = iast
		? getListFirstLine(bhajan.firstLineIAST, bhajan.contentIAST)
		: getListFirstLine(bhajan.firstLine, bhajan.content);
	const author = authorDisplayName(
		authors,
		bhajan.author,
		bhajan.authorIAST,
		iast,
	);

	return (
		<Pressable
			onPress={() => onPress(bhajan)}
			android_ripple={{ color: goldA(0.08) }}
			style={[
				styles.row,
				sidePad,
				{ borderBottomColor: theme.isDark ? "rgba(15,34,66,0.5)" : ink[100] },
			]}
		>
			<View style={styles.titleLine}>
				<Text
					style={[
						styles.rowTitle,
						{ color: theme.isDark ? ink[200] : ink[800] },
					]}
					numberOfLines={1}
				>
					{title}
				</Text>
				{bhajan.audio?.length ? <AudioChip /> : null}
			</View>
			<View style={styles.subLine}>
				{author ? (
					<Text style={styles.rowAuthor}>{`${author.toUpperCase()} •`}</Text>
				) : null}
				<Text
					style={[styles.rowSub, { color: theme.isDark ? ink[500] : ink[400] }]}
					numberOfLines={1}
				>
					{subtitle}
				</Text>
			</View>
		</Pressable>
	);
});

const ResultCard = memo(function ResultCard({
	bhajan,
	script,
	query,
	theme,
	authors,
	onPress,
}: {
	bhajan: Bhajan;
	script: ScriptType;
	query: string;
	theme: AppTheme;
	authors: Record<string, AuthorDef>;
	onPress: (b: Bhajan) => void;
}) {
	const iast = script === "iast";
	const snippet = getMatchingSnippet(bhajan, query, script);
	const subtitle =
		snippet ||
		(iast
			? getListFirstLine(bhajan.firstLineIAST, bhajan.contentIAST)
			: getListFirstLine(bhajan.firstLine, bhajan.content));
	const author = authorDisplayName(
		authors,
		bhajan.author,
		bhajan.authorIAST,
		iast,
	);

	return (
		<Pressable
			onPress={() => onPress(bhajan)}
			style={({ pressed }) => [
				styles.card,
				{
					backgroundColor: theme.isDark ? ink[800] : janmashtami.cream,
					transform: [{ scale: pressed ? 0.98 : 1 }],
				},
			]}
		>
			<View style={styles.flex}>
				<View style={[styles.titleLine, { marginBottom: 6 }]}>
					<HighlightText
						text={iast ? bhajan.titleIAST : bhajan.title}
						highlight={query}
						numberOfLines={1}
						style={[
							styles.rowTitle,
							{ color: theme.isDark ? ink[100] : ink[800] },
						]}
					/>
					{bhajan.audio?.length ? <AudioChip /> : null}
				</View>
				<HighlightText
					text={subtitle}
					highlight={query}
					numberOfLines={2}
					style={[
						styles.cardSub,
						{ color: snippet ? GOLD : theme.isDark ? ink[400] : ink[500] },
					]}
				/>
				{author ? (
					<Text style={[styles.rowAuthor, { marginTop: 8 }]}>
						{author.toUpperCase()}
					</Text>
				) : null}
			</View>
			<ChevronRight size={24} color={theme.isDark ? ink[600] : ink[300]} />
		</Pressable>
	);
});

function AudioChip() {
	return (
		<View style={styles.audioChip}>
			<Music size={12} color={GOLD} />
		</View>
	);
}

function SearchBar({
	theme,
	query,
	onChange,
	onClose,
	placeholder,
	sidePad,
}: {
	theme: AppTheme;
	query: string;
	onChange: (q: string) => void;
	onClose: () => void;
	placeholder: string;
	sidePad: object;
}) {
	const [recent, setRecent] = useState<string[]>(getRecentSearches);
	const [showRecent, setShowRecent] = useState(false);
	const [showAll, setShowAll] = useState(false);

	return (
		<View
			style={[
				styles.searchBar,
				sidePad,
				{
					backgroundColor: theme.isDark
						? "rgba(7,21,41,0.95)"
						: "rgba(255,248,231,0.95)",
				},
			]}
		>
			<Search size={20} color={GOLD} />
			<TextInput
				autoFocus
				value={query}
				placeholder={placeholder}
				placeholderTextColor={ink[400]}
				onFocus={() => !query.trim() && setShowRecent(true)}
				onChangeText={(text) => {
					onChange(text);
					setShowRecent(!text.trim());
				}}
				onSubmitEditing={() => {
					if (!query.trim()) return;
					addRecentSearch(query.trim());
					setRecent(getRecentSearches());
				}}
				returnKeyType="search"
				style={[
					styles.searchInput,
					{ color: theme.isDark ? "#fff" : ink[900] },
				]}
			/>
			<VoiceSearchButton
				onResult={(text) => {
					onChange(text);
					setShowRecent(false);
				}}
			/>
			<Pressable
				accessibilityLabel="Close search"
				onPress={onClose}
				style={styles.iconButton}
			>
				<X size={20} color={ink[400]} />
			</Pressable>
			{recent.length > 0 ? (
				<View>
					<Pressable
						accessibilityLabel="Recent searches"
						onPress={() => {
							setShowRecent(!showRecent);
							if (showRecent) setShowAll(false);
						}}
						style={styles.iconButton}
					>
						<History size={20} color={showRecent ? GOLD : ink[400]} />
					</Pressable>
					{showRecent && !query.trim() ? (
						<View
							style={[
								styles.recentMenu,
								{
									backgroundColor: theme.card,
									borderColor: theme.isDark ? ink[700] : ink[200],
								},
							]}
						>
							<View
								style={[
									styles.recentHead,
									{
										backgroundColor: theme.isDark
											? "rgba(15,34,66,0.5)"
											: ink[50],
										borderBottomColor: theme.isDark ? ink[700] : ink[100],
									},
								]}
							>
								<Text style={styles.recentTitle}>RECENT SEARCHES</Text>
								<Pressable
									onPress={() => {
										clearRecentSearches();
										setRecent([]);
										setShowRecent(false);
										setShowAll(false);
									}}
								>
									<Text style={styles.recentClear}>Clear</Text>
								</Pressable>
							</View>
							{(showAll ? recent : recent.slice(0, 3)).map((term) => (
								<Pressable
									key={term}
									onPress={() => {
										onChange(term);
										setShowRecent(false);
									}}
									style={styles.recentItem}
								>
									<History size={14} color={ink[400]} />
									<Text
										style={[
											styles.recentText,
											{ color: theme.isDark ? ink[300] : ink[700] },
										]}
										numberOfLines={1}
									>
										{term}
									</Text>
								</Pressable>
							))}
							{!showAll && recent.length > 3 ? (
								<Pressable
									onPress={() => setShowAll(true)}
									style={[
										styles.seeMore,
										{ borderTopColor: theme.isDark ? ink[700] : ink[100] },
									]}
								>
									<Text style={styles.seeMoreText}>See More</Text>
								</Pressable>
							) : null}
						</View>
					) : null}
				</View>
			) : null}
		</View>
	);
}

function AzSlider({
	keys,
	indexMode,
	side,
	bottom,
	theme,
	onToggle,
	onSelect,
}: {
	keys: string[];
	indexMode: "latin" | "devanagari";
	side: "left" | "right";
	bottom: number;
	theme: AppTheme;
	onToggle: () => void;
	onSelect: (key: string) => void;
}) {
	const letterColor = theme.isDark ? ink[400] : ink[600];
	return (
		<View
			style={[
				styles.az,
				side === "left" ? { left: 8 } : { right: 8 },
				{
					bottom,
					backgroundColor: theme.isDark ? "rgba(15,34,66,0.95)" : theme.p[50],
					borderColor: theme.isDark ? ink[700] : theme.p[200],
				},
			]}
		>
			<Pressable
				accessibilityLabel={
					indexMode === "latin"
						? "Switch to Hindi letters"
						: "Switch to English letters"
				}
				onPress={onToggle}
				style={[
					styles.azToggle,
					{ backgroundColor: theme.p[500], borderBottomColor: theme.p[600] },
				]}
			>
				<Text style={styles.azToggleText}>
					{indexMode === "latin" ? "अ" : "A"}
				</Text>
			</Pressable>
			{indexMode === "latin" ? (
				<View style={styles.azLatin}>
					{keys.map((k) => (
						<Pressable
							key={k}
							onPress={() => onSelect(k)}
							style={styles.azLatinKey}
						>
							<Text style={[styles.azLatinText, { color: letterColor }]}>
								{k}
							</Text>
						</Pressable>
					))}
				</View>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingVertical: 4, paddingBottom: 36 }}
				>
					{keys.map((k) => (
						<Pressable
							key={k}
							onPress={() => onSelect(k)}
							style={styles.azDevaKey}
						>
							<Text style={[styles.azDevaText, { color: letterColor }]}>
								{k}
							</Text>
						</Pressable>
					))}
				</ScrollView>
			)}
		</View>
	);
}

function FilterSheet({
	visible,
	onClose,
	theme,
	t,
	language,
	onToggleLanguage,
	activeFilter,
	onSelect,
	categories,
	playlists,
	onCreatePlaylist,
}: {
	visible: boolean;
	onClose: () => void;
	theme: AppTheme;
	t: Strings;
	language: "en" | "hi";
	onToggleLanguage: () => void;
	activeFilter: string;
	onSelect: (filter: string) => void;
	categories: { id: string; labelHi: string; labelEn: string }[];
	playlists: { id: string; name: string }[];
	onCreatePlaylist: (name: string) => void;
}) {
	const insets = useSafeAreaInsets();
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const sheetBg = theme.isDark ? ink[900] : janmashtami.cream;
	const tileBg = theme.isDark ? ink[800] : "#fff";
	const sectionTitle = [styles.sheetSection, { color: ink[400] }];

	const nitya = (
		id: "morning" | "evening",
		Icon: LucideIcon,
		label: string,
	) => {
		const active = activeFilter === id;
		return (
			<Pressable
				onPress={() => onSelect(id)}
				style={[
					styles.nityaTile,
					active
						? { backgroundColor: goldA(0.1), borderColor: goldA(0.4) }
						: { backgroundColor: tileBg, borderColor: goldA(0.2) },
				]}
			>
				<Icon size={28} color={active ? GOLD : goldA(0.7)} />
				<Text
					style={[
						styles.nityaText,
						{ color: active ? GOLD : theme.isDark ? ink[300] : ink[500] },
					]}
				>
					{label}
				</Text>
			</Pressable>
		);
	};

	const option = (id: string, label: string, Icon: LucideIcon) => {
		const active = activeFilter === id;
		return (
			<Pressable
				key={id}
				onPress={() => onSelect(id)}
				style={[
					styles.option,
					active
						? {
								backgroundColor: theme.isDark ? ink[800] : goldA(0.1),
								borderColor: goldA(0.4),
							}
						: { borderColor: "transparent" },
				]}
			>
				<View style={styles.rowCenter}>
					<View
						style={[
							styles.optionIcon,
							{
								backgroundColor: active
									? theme.isDark
										? ink[700]
										: goldA(0.2)
									: theme.well,
							},
						]}
					>
						<Icon size={20} color={active ? GOLD : ink[400]} />
					</View>
					<Text
						style={[
							styles.optionText,
							{ color: active ? GOLD : theme.isDark ? ink[300] : ink[600] },
						]}
					>
						{label}
					</Text>
				</View>
				{active ? <Check size={18} color={GOLD} /> : null}
			</Pressable>
		);
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
			statusBarTranslucent
		>
			<Pressable style={styles.scrim} onPress={onClose}>
				<Pressable
					style={[
						styles.sheet,
						{ backgroundColor: sheetBg, paddingBottom: insets.bottom },
					]}
					onPress={() => {}}
				>
					<View style={[styles.sheetHead, { borderBottomColor: goldA(0.2) }]}>
						<View style={styles.rowCenter}>
							<Text
								style={[
									styles.sheetTitle,
									{ color: theme.isDark ? "#fff" : GOLD },
								]}
							>
								{t.filterTitle}
							</Text>
							<Pressable
								onPress={onToggleLanguage}
								style={[
									styles.langChip,
									{ backgroundColor: theme.isDark ? ink[800] : goldA(0.1) },
								]}
							>
								<Languages size={14} color={GOLD} />
								<Text style={styles.langText}>
									{language === "en" ? "HI" : "EN"}
								</Text>
							</Pressable>
						</View>
						<Pressable
							accessibilityLabel="Close"
							onPress={onClose}
							style={[
								styles.closeRound,
								{ backgroundColor: theme.isDark ? ink[800] : goldA(0.1) },
							]}
						>
							<X size={20} color={GOLD} />
						</Pressable>
					</View>

					<ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
						<View>
							<Text style={sectionTitle}>{t.nityaKriya.toUpperCase()}</Text>
							<View style={styles.nityaGrid}>
								{nitya("morning", Sun, t.morning)}
								{nitya("evening", Moon, t.evening)}
							</View>
						</View>

						<View>
							<Text style={sectionTitle}>{t.collections.toUpperCase()}</Text>
							<View style={styles.chips}>
								{playlists.map((p) => {
									const active = activeFilter === `playlist-${p.id}`;
									return (
										<Pressable
											key={p.id}
											onPress={() => onSelect(`playlist-${p.id}`)}
											style={[
												styles.chip,
												active
													? {
															backgroundColor: goldA(0.1),
															borderColor: goldA(0.4),
														}
													: {
															backgroundColor: tileBg,
															borderColor: goldA(0.2),
														},
											]}
										>
											<Text
												style={[
													styles.chipText,
													{
														color: active
															? GOLD
															: theme.isDark
																? ink[300]
																: ink[500],
													},
												]}
											>
												{p.name}
											</Text>
										</Pressable>
									);
								})}
								{creating ? (
									<View style={styles.createRow}>
										<TextInput
											autoFocus
											value={name}
											onChangeText={setName}
											placeholder={t.listName}
											placeholderTextColor={goldA(0.5)}
											style={[styles.createInput, { backgroundColor: tileBg }]}
										/>
										<Pressable
											onPress={() => {
												if (!name.trim()) return;
												onCreatePlaylist(name.trim());
												setName("");
												setCreating(false);
											}}
											style={styles.addButton}
										>
											<Text style={styles.addText}>{t.add}</Text>
										</Pressable>
										<Pressable
											onPress={() => setCreating(false)}
											style={{ paddingHorizontal: 8 }}
										>
											<X size={16} color={ink[400]} />
										</Pressable>
									</View>
								) : (
									<Pressable
										onPress={() => setCreating(true)}
										style={[styles.chip, styles.newChip]}
									>
										<Plus size={14} color={GOLD} />
										<Text style={[styles.chipText, { color: GOLD }]}>
											{t.customList}
										</Text>
									</Pressable>
								)}
							</View>
						</View>

						<View>
							<Text style={sectionTitle}>{t.categories.toUpperCase()}</Text>
							<View style={{ gap: 8 }}>
								{option("all", t.allBhajans, ListMusic)}
								{categories.map((c) =>
									option(
										c.id,
										language === "hi" ? c.labelHi : c.labelEn,
										CATEGORY_ICONS[c.id] ?? Tag,
									),
								)}
							</View>
						</View>
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
	centerState: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 20,
	},
	loaderRing: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: goldA(0.1),
		alignItems: "center",
		justifyContent: "center",
	},
	loadingTitle: { fontSize: 18, fontWeight: "700" },
	emptyIcon: {
		width: 80,
		height: 80,
		borderRadius: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
	emptyBody: {
		fontSize: 14,
		lineHeight: 22,
		textAlign: "center",
		marginTop: -12,
	},
	connectPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 999,
		backgroundColor: goldA(0.1),
		borderWidth: 1,
		borderColor: goldA(0.3),
	},
	dot: { width: 8, height: 8, borderRadius: 4 },
	connectText: { fontSize: 12, fontWeight: "700", color: GOLD },
	fetchButton: {
		borderRadius: 999,
		backgroundColor: GOLD,
		paddingHorizontal: 20,
		paddingVertical: 10,
	},
	fetchText: { color: "#fff", fontSize: 14, fontWeight: "700" },
	syncBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginHorizontal: 12,
		marginTop: 12,
		marginBottom: 4,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 12,
		backgroundColor: goldA(0.1),
		borderWidth: 1,
		borderColor: goldA(0.3),
	},
	syncText: { fontSize: 12, fontWeight: "700", color: GOLD, flex: 1 },
	sectionHeader: {
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderStyle: "dashed",
		borderBottomColor: goldA(0.3),
		flexDirection: "row",
	},
	sectionKey: {
		width: 32,
		height: 32,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: goldA(0.1),
		borderWidth: 1,
		borderColor: goldA(0.2),
	},
	sectionKeyText: { color: GOLD, fontSize: 14, fontWeight: "900" },
	row: { paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
	titleLine: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 6,
	},
	rowTitle: { fontSize: 20, fontWeight: "700", lineHeight: 28, flexShrink: 1 },
	audioChip: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 999,
		backgroundColor: goldA(0.1),
		borderWidth: 1,
		borderColor: goldA(0.2),
	},
	subLine: { flexDirection: "row", alignItems: "center", gap: 8 },
	rowAuthor: {
		fontSize: 12,
		fontWeight: "700",
		color: GOLD,
		letterSpacing: 0.6,
		flexShrink: 0,
	},
	rowSub: { fontSize: 14, flex: 1 },
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		padding: 20,
		marginBottom: 12,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: goldA(0.2),
		elevation: 1,
		shadowColor: "#000",
		shadowOpacity: 0.05,
		shadowRadius: 2,
		shadowOffset: { width: 0, height: 1 },
	},
	cardSub: { fontSize: 16, lineHeight: 22 },
	filterHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingTop: 28,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: goldA(0.2),
		elevation: 1,
		zIndex: 20,
	},
	clearFilter: { padding: 6, borderRadius: 999 },
	filterLabel: {
		fontSize: 14,
		fontWeight: "700",
		color: GOLD,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	smallRound: { padding: 8, borderRadius: 999 },
	floatingActions: {
		position: "absolute",
		top: 6,
		flexDirection: "row",
		gap: 8,
		zIndex: 20,
	},
	voiceFab: {
		position: "absolute",
		right: 16,
		width: 56,
		height: 56,
		borderRadius: 28,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 30,
		elevation: 8,
		shadowOpacity: 0.6,
		shadowRadius: 15,
		shadowOffset: { width: 0, height: 4 },
	},
	floatButton: {
		padding: 8,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: goldA(0.2),
		elevation: 1,
		shadowColor: "#000",
		shadowOpacity: 0.05,
		shadowRadius: 2,
	},
	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: goldA(0.2),
		zIndex: 30,
	},
	searchInput: { flex: 1, paddingVertical: 8, fontSize: 16, fontWeight: "500" },
	iconButton: { padding: 8 },
	recentMenu: {
		position: "absolute",
		right: 0,
		top: "100%",
		marginTop: 8,
		width: 256,
		borderRadius: 12,
		borderWidth: 1,
		overflow: "hidden",
		elevation: 12,
		shadowColor: "#000",
		shadowOpacity: 0.15,
		shadowRadius: 12,
		zIndex: 50,
	},
	recentHead: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderBottomWidth: 1,
	},
	recentTitle: {
		fontSize: 12,
		fontWeight: "600",
		color: ink[500],
		letterSpacing: 1,
	},
	recentClear: { fontSize: 12, fontWeight: "500", color: "#ef4444" },
	recentItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	recentText: { fontSize: 14, flex: 1 },
	seeMore: { alignItems: "center", paddingVertical: 8, borderTopWidth: 1 },
	seeMoreText: { fontSize: 12, fontWeight: "700", color: GOLD },
	az: {
		position: "absolute",
		top: 36,
		width: 32,
		borderRadius: 16,
		borderWidth: 1,
		overflow: "hidden",
		zIndex: 20,
		elevation: 4,
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	azToggle: {
		height: 32,
		alignItems: "center",
		justifyContent: "center",
		borderBottomWidth: 1,
	},
	azToggleText: { color: "#fff", fontSize: 16, fontWeight: "700" },
	azLatin: { flex: 1, paddingVertical: 4 },
	azLatinKey: {
		flex: 1,
		maxHeight: 32,
		alignItems: "center",
		justifyContent: "center",
	},
	azLatinText: { fontSize: 10, fontWeight: "700" },
	azDevaKey: { height: 32, alignItems: "center", justifyContent: "center" },
	azDevaText: { fontSize: 14, fontWeight: "700" },
	scrim: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.6)",
		justifyContent: "flex-end",
	},
	sheet: {
		maxHeight: "85%",
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		borderWidth: 1,
		borderColor: goldA(0.2),
		overflow: "hidden",
	},
	sheetHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 20,
		borderBottomWidth: 1,
	},
	sheetTitle: { fontSize: 18, fontWeight: "700" },
	langChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
	},
	langText: { fontSize: 12, fontWeight: "700", color: GOLD },
	closeRound: { padding: 8, borderRadius: 999 },
	sheetSection: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 1,
		marginBottom: 12,
		paddingHorizontal: 4,
	},
	nityaGrid: { flexDirection: "row", gap: 12 },
	nityaTile: {
		flex: 1,
		padding: 16,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		elevation: 1,
		shadowColor: "#000",
		shadowOpacity: 0.05,
		shadowRadius: 2,
	},
	nityaText: { fontSize: 12, fontWeight: "700" },
	chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 1,
	},
	newChip: { backgroundColor: goldA(0.1), borderColor: goldA(0.3) },
	chipText: { fontSize: 12, fontWeight: "700" },
	createRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		width: "100%",
		marginTop: 4,
	},
	createInput: {
		flex: 1,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 999,
		fontSize: 12,
		borderWidth: 1,
		borderColor: goldA(0.4),
		color: GOLD,
	},
	addButton: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 999,
		backgroundColor: GOLD,
	},
	addText: { color: "#fff", fontSize: 12, fontWeight: "700" },
	option: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 12,
		borderRadius: 12,
		borderWidth: 1,
	},
	optionIcon: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	optionText: { fontSize: 14, fontWeight: "700" },
});

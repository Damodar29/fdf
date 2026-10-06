import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import {
	AlertTriangle,
	Calendar,
	ChevronRight,
	Disc,
	Download,
	History,
	ListMusic,
	type LucideIcon,
	Mic,
	Music,
	Pencil,
	Play,
	Plus,
	Search,
	SearchX,
	Trash2,
	User,
	X,
} from "lucide-react-native";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	AudioGroup,
	ConfirmDeleteButton,
	CrossPattern,
	TrackDownloadButton,
	TrackRow,
} from "../components/AudioListParts";
import { AudioPlayerPanel } from "../components/AudioPlayerPanel";
import { useTabBarSpace } from "../components/BottomNav";
import { HighlightText } from "../components/HighlightText";
import { VoiceSearchButton } from "../components/VoiceSearchButton";
import { BackupRestoreSection } from "../components/BackupRestoreSection";
import { SideScrollView } from "../components/SideScrollView";
import { triggerHaptic } from "../lib/haptics";
import type { RootNavigation } from "../navigation/types";
import { type QueueTrack, useAudioStore } from "../store/audioStore";
import { useBhajansContent, useLectures } from "../store/contentStore";
import { useDownloadStore } from "../store/downloadStore";
import { usePlayerUiStore } from "../store/playerUiStore";
import { usePlaylistStore } from "../store/playlistStore";
import { useSettingsStore } from "../store/settingsStore";
import { ink } from "../theme/colors";
import { type AppTheme, useAppTheme } from "../theme/useAppTheme";
import type { Bhajan, BhajanAudio, LectureData, Playlist } from "../types";
import { getSingersList, normalizeSingerName } from "../utils/bhajanClassifier";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "../utils/recentSearches";
import {
	calculateLectureScore,
	calculateSearchScore,
	smartNormalize,
	transliterateForSearch,
} from "../utils/textProcessor";

// The "Audio" tab: native rebuild of components/AudioScreen.tsx (+ the
// Katha list from components/LectureList.tsx). Four sub-tabs — Kirtans
// (every bhajan with recordings, grouped), Katha, Singers, Playlists — over
// a faint cross pattern, a search bar, and the docked player with its queue
// and singer pickers.
type SubTab = "bhajans" | "kathas" | "singers" | "playlists";
const SUB_TABS: { id: SubTab; icon: LucideIcon }[] = [
	{ id: "bhajans", icon: Disc },
	{ id: "kathas", icon: Mic },
	{ id: "singers", icon: User },
	{ id: "playlists", icon: ListMusic },
];

const T = {
	en: {
		bhajans: "Kirtans",
		kathas: "Katha",
		singers: "Singers",
		playlists: "Playlists",
		songs: "Songs",
		tracks: "Tracks",
		audioTrack: "Audio Track",
		emptyPlaylist: "Empty Playlist",
		createPlaylist: "Create New Playlist",
		noPlaylists: "No playlists yet.",
		cancel: "Cancel",
		create: "Create",
		rename: "Rename",
		delete: "Delete",
		confirm: "Confirm?",
		newPlaylistTitle: "New Playlist",
		playlistName: "Playlist Name",
		renameTitle: "Rename Playlist",
		deleteTitle: "Delete Playlist?",
		deleteDesc: "Are you sure you want to delete this playlist? This action cannot be undone.",
		search: "Search (Hinglish)...",
		syncing: "☁️ Audio is syncing in background",
		noAudio: "No Audio Found",
		checkSpelling: "Please check the spelling and try typing correctly.",
		loadingKirtans: "Loading Kirtans...",
		noKirtans: "No Kirtans found",
		fetchKirtans: "Fetch Kirtans",
		loadingSingers: "Loading Singers...",
		noSingers: "No Singers found",
		loadingKatha: "Loading Katha...",
		noKatha: "No katha found",
		fetchKatha: "Fetch Katha",
		trySearch: "Try a different search term",
	},
	hi: {
		bhajans: "कीर्तन",
		kathas: "कथा",
		singers: "गायक",
		playlists: "प्लेलिस्ट",
		songs: "भजन",
		tracks: "ट्रैक",
		audioTrack: "ऑडियो ट्रैक",
		emptyPlaylist: "खाली प्लेलिस्ट",
		createPlaylist: "नई प्लेलिस्ट बनाएं",
		noPlaylists: "अभी कोई प्लेलिस्ट नहीं है",
		cancel: "रद्द करें",
		create: "बनाएं",
		rename: "नाम बदलें",
		delete: "हटाएं",
		confirm: "पुष्टि करें?",
		newPlaylistTitle: "नई प्लेलिस्ट",
		playlistName: "प्लेलिस्ट का नाम",
		renameTitle: "प्लेलिस्ट का नाम बदलें",
		deleteTitle: "प्लेलिस्ट हटाएं?",
		deleteDesc: "क्या आप वाकई इस प्लेलिस्ट को हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।",
		search: "खोजें (Hinglish)..",
		syncing: "☁️ ऑडियो बैकग्राउंड में अपडेट हो रहा है",
		noAudio: "कोई ऑडियो नहीं मिला",
		checkSpelling: "कृपया स्पेलिंग सही से टाइप करें।",
		loadingKirtans: "कीर्तन लोड हो रहे हैं...",
		noKirtans: "कोई कीर्तन नहीं मिला",
		fetchKirtans: "कीर्तन Fetch करें",
		loadingSingers: "गायक लोड हो रहे हैं...",
		noSingers: "कोई गायक नहीं मिला",
		loadingKatha: "कथा लोड हो रही है...",
		noKatha: "कोई कथा नहीं मिली",
		fetchKatha: "कथा Fetch करें",
		trySearch: "कोई अन्य शब्द खोजें",
	},
};
type Strings = (typeof T)["en"];

const extractNum = (s?: string) => Number.parseInt(s?.match(/\d+/)?.[0] ?? "0", 10);

function play(track: BhajanAudio, queue: BhajanAudio[], queueName: string) {
	triggerHaptic("medium");
	useAudioStore.getState().playTrack(track, track.bhajanTitle || "", track.parentBhajan, queue, queueName);
}

export function LecturesScreen() {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const tabBarSpace = useTabBarSpace();
	const navigation = useNavigation<RootNavigation>();
	const language = useSettingsStore((s) => s.settingsLanguage);
	const script = useSettingsStore((s) => s.script);
	const t = T[language];
	const bhajansState = useBhajansContent();
	const lecturesState = useLectures();
	const hasTrack = useAudioStore((s) => !!s.currentTrack);
	const minimized = usePlayerUiStore((s) => s.minimized);
	const setMinimized = usePlayerUiStore((s) => s.setMinimized);
	const [subTab, setSubTab] = useState<SubTab>("bhajans");
	const [query, setQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const iast = script === "iast";

	const bhajans = useMemo(() => bhajansState.items.filter((b) => !b.isHidden), [bhajansState.items]);
	const lectures = useMemo(() => lecturesState.items.filter((l) => !l.isHidden), [lecturesState.items]);
	const searching = query.trim().length > 0;

	// Kirtans: bhajans with recordings, in song-number order.
	const kirtans = useMemo(
		() =>
			bhajans
				.filter((b) => b.audio?.length)
				.sort((a, b) => extractNum(a.songNumber || a.id) - extractNum(b.songNumber || b.id)),
		[bhajans],
	);
	const kathas = useMemo(
		() => lectures.filter((k) => k.audio?.length).sort((a, b) => extractNum(a.id) - extractNum(b.id)),
		[lectures],
	);
	const titleOf = useCallback((b: Bhajan) => (iast ? b.titleIAST : b.title), [iast]);

	// The whole Kirtan list as one queue, so next/previous run through it.
	const kirtanQueue = useMemo(
		() => kirtans.flatMap((b) => (b.audio ?? []).map((tr) => ({ ...tr, bhajanTitle: iast ? b.titleIAST : b.title, parentBhajan: b }))),
		[kirtans, iast],
	);

	// Search covers the active sub-tab's tracks, best matches first (App.tsx
	// scored the lists; AudioScreen expanded them to tracks).
	const results = useMemo(() => {
		if (!searching) return [];
		if (subTab === "bhajans") {
			return bhajans
				.map((b) => ({ b, score: calculateSearchScore(b, query, script) }))
				.filter((r) => r.score > 0 && r.b.audio?.length)
				.sort((x, y) => y.score - x.score)
				.flatMap(({ b }) => (b.audio ?? []).map<QueueTrack>((tr) => ({ ...tr, bhajanTitle: titleOf(b), parentBhajan: b })));
		}
		if (subTab === "kathas") {
			return lectures
				.map((l) => ({ l, score: calculateLectureScore(l, query) }))
				.filter((r) => r.score > 0)
				.sort((x, y) => y.score - x.score)
				.flatMap(({ l }) => (l.audio ?? []).map<QueueTrack>((tr) => ({ ...tr, bhajanTitle: l.title })));
		}
		return [];
	}, [searching, subTab, bhajans, lectures, query, script, titleOf]);

	const isSyncing = bhajansState.isSyncing || lecturesState.isSyncing;
	const showPanel = hasTrack && !minimized;
	const listBottom = tabBarSpace + (showPanel ? 200 : 64);

	const openLecture = (lecture: LectureData) => {
		triggerHaptic("medium");
		if (searching) addRecentSearch(query);
		navigation.navigate("Lecture", { lecture });
	};

	let body: ReactNode;
	if (searching && (subTab === "bhajans" || subTab === "kathas")) {
		body = <SearchResults results={results} query={query} theme={theme} t={t} bottom={listBottom} />;
	} else if (subTab === "bhajans") {
		body = (
			<KirtansTab
				kirtans={kirtans}
				queue={kirtanQueue}
				titleOf={titleOf}
				t={t}
				state={bhajansState}
				bottom={listBottom}
			/>
		);
	} else if (subTab === "kathas") {
		body = <KathaTab items={kathas} query={query} t={t} state={lecturesState} bottom={listBottom} onOpen={openLecture} />;
	} else if (subTab === "singers") {
		body = <SingersTab bhajans={bhajans} query={query} titleOf={titleOf} t={t} state={bhajansState} bottom={listBottom} />;
	} else {
		body = <PlaylistsTab bhajans={bhajans} titleOf={titleOf} t={t} bottom={listBottom} />;
	}

	return (
		<View style={styles.flex}>
			<CrossPattern />

			{/* Sub-tabs */}
			<View
				style={[
					styles.tabs,
					{
						backgroundColor: theme.isDark ? "rgba(15,34,66,0.9)" : "rgba(255,248,231,0.9)",
						borderBottomColor: "rgba(212,160,23,0.4)",
					},
				]}
			>
				{SUB_TABS.map(({ id, icon: Icon }) => {
					const active = id === subTab;
					const color = active ? (theme.isDark ? theme.p[400] : theme.p[600]) : ink[400];
					return (
						<Pressable
							key={id}
							accessibilityRole="tab"
							accessibilityState={{ selected: active }}
							onPress={() => {
								if (active) return;
								triggerHaptic("light");
								setSubTab(id);
							}}
							style={[
								styles.tab,
								active
									? { borderBottomColor: theme.p[500], backgroundColor: theme.isDark ? ink[800] : theme.p[50] }
									: null,
							]}
						>
							<Icon size={18} color={color} />
							<Text style={[styles.tabLabel, { color }]}>{t[id]}</Text>
						</Pressable>
					);
				})}
			</View>

			{isSyncing ? (
				<View
					style={[
						styles.syncBanner,
						{ backgroundColor: theme.isDark ? ink[800] : theme.p[50], borderColor: theme.isDark ? ink[700] : theme.p[100] },
					]}
				>
					<ActivityIndicator size="small" color={theme.p[500]} />
					<Text style={[styles.syncText, { color: theme.isDark ? theme.p[400] : theme.p[700] }]}>{t.syncing}</Text>
				</View>
			) : null}

			{subTab !== "playlists" && (searchOpen || searching) ? (
				<AudioSearchBar
					theme={theme}
					query={query}
					onChange={setQuery}
					placeholder={t.search}
					onClose={() => {
						setQuery("");
						setSearchOpen(false);
					}}
				/>
			) : null}

			<View style={styles.flex}>
				{body}
				{subTab !== "playlists" && !searching && !searchOpen ? (
					<View style={styles.floatSearch}>
						<Pressable
							accessibilityLabel="Search"
							onPress={() => {
								triggerHaptic("light");
								setSearchOpen(true);
							}}
							style={[
								styles.floatButton,
								{ backgroundColor: theme.isDark ? "rgba(7,21,41,0.9)" : "rgba(255,253,247,0.9)" },
							]}
						>
							<Search size={20} color="rgba(138,102,15,0.8)" />
						</Pressable>
					</View>
				) : null}
			</View>

			{showPanel ? (
				<AudioPlayerPanel bottom={96 + insets.bottom} isHindi={language === "hi"} onMinimize={() => setMinimized(true)} />
			) : null}
		</View>
	);
}

type ContentState = { isSyncing: boolean; refresh: () => void };

function EmptyState({
	icon: Icon,
	title,
	body,
	syncing,
	action,
	onAction,
}: {
	icon: LucideIcon;
	title: string;
	body?: string;
	syncing?: boolean;
	action?: string;
	onAction?: () => void;
}) {
	const theme = useAppTheme();
	return (
		<View style={styles.empty}>
			<View style={[styles.emptyIcon, { backgroundColor: theme.isDark ? ink[800] : ink[100] }]}>
				<Icon size={40} color={theme.isDark ? ink[600] : ink[300]} />
				{syncing ? <ActivityIndicator style={StyleSheet.absoluteFill} size={80} color="#B08313" /> : null}
			</View>
			<Text style={[styles.emptyTitle, { color: theme.isDark ? ink[200] : ink[700] }]}>{title}</Text>
			{body ? <Text style={styles.emptyBody}>{body}</Text> : null}
			{action && onAction ? (
				<Pressable onPress={onAction} style={styles.fetchButton}>
					<Download size={18} color="#fff" />
					<Text style={styles.fetchText}>{action}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function KirtansTab({
	kirtans,
	queue,
	titleOf,
	t,
	state,
	bottom,
}: {
	kirtans: Bhajan[];
	queue: BhajanAudio[];
	titleOf: (b: Bhajan) => string;
	t: Strings;
	state: ContentState;
	bottom: number;
}) {
	const [expanded, setExpanded] = useState<string | null>(null);
	if (kirtans.length === 0) {
		return (
			<EmptyState
				icon={Music}
				title={state.isSyncing ? t.loadingKirtans : t.noKirtans}
				syncing={state.isSyncing}
				action={state.isSyncing ? undefined : t.fetchKirtans}
				onAction={state.refresh}
			/>
		);
	}
	return (
		<FlashList<Bhajan>
			renderScrollComponent={SideScrollView}
			data={kirtans}
			keyExtractor={(b) => b.id}
			extraData={expanded}
			contentContainerStyle={{ padding: 8, paddingBottom: bottom }}
			renderItem={({ item: b }) => (
				<AudioGroup
					icon={Music}
					title={titleOf(b)}
					subtitle={`${b.audio?.length ?? 0} ${t.songs}`}
					expanded={expanded === b.id}
					onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
				>
					{(b.audio ?? []).map((track) => {
						const queued = queue.find((q) => q.id === track.id) ?? { ...track, bhajanTitle: titleOf(b), parentBhajan: b };
						return (
							<TrackRow
								key={track.id}
								label={track.singer?.replace(/\s+\)/g, ")") ?? ""}
								onPress={() => play(queued, queue, t.bhajans)}
								right={<TrackDownloadButton track={track} title={titleOf(b)} parent={b} />}
							/>
						);
					})}
				</AudioGroup>
			)}
		/>
	);
}

function KathaTab({
	items,
	query,
	t,
	state,
	bottom,
	onOpen,
}: {
	items: LectureData[];
	query: string;
	t: Strings;
	state: ContentState;
	bottom: number;
	onOpen: (lecture: LectureData) => void;
}) {
	const theme = useAppTheme();
	const [expanded, setExpanded] = useState<string | null>(null);
	const downloaded = useDownloadStore((s) => s.downloaded);
	const active = useDownloadStore((s) => s.active);
	const { requestTrackDownload, deleteDownload } = useDownloadStore.getState();

	if (items.length === 0) {
		return (
			<EmptyState
				icon={SearchX}
				title={state.isSyncing ? t.loadingKatha : t.noKatha}
				syncing={state.isSyncing}
				action={state.isSyncing ? undefined : t.fetchKatha}
				onAction={state.refresh}
			/>
		);
	}

	return (
		<FlashList<LectureData>
			renderScrollComponent={SideScrollView}
			data={items}
			keyExtractor={(k) => k.id}
			extraData={[expanded, downloaded, active]}
			contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: bottom }}
			renderItem={({ item }) => {
				const isExpanded = expanded === item.id;
				const queue = (item.audio ?? []).map((tr) => ({ ...tr, bhajanTitle: item.title, parentBhajan: undefined }));
				return (
					<View
						style={[
							styles.kathaCard,
							isExpanded
								? { backgroundColor: theme.isDark ? ink[800] : "rgba(255,255,255,0.5)", borderColor: theme.p[100], elevation: 3 }
								: null,
						]}
					>
						<Pressable onPress={() => onOpen(item)} style={styles.kathaHead}>
							<View
								style={[
									styles.medallion,
									isExpanded
										? { backgroundColor: theme.isDark ? ink[700] : theme.p[100], borderColor: theme.p[200] }
										: { backgroundColor: theme.isDark ? ink[800] : ink[100], borderColor: "transparent" },
								]}
							>
								<Mic size={18} color={isExpanded ? theme.p[600] : theme.isDark ? theme.p[400] : theme.p[500]} />
							</View>
							<View style={styles.flex}>
								<HighlightText
									text={item.title}
									highlight={query}
									style={[styles.kathaTitle, { color: isExpanded ? theme.p[600] : theme.isDark ? ink[200] : ink[700] }]}
								/>
								<View style={styles.kathaMeta}>
									{item.date && item.date !== "Kirtan" ? (
										<View style={styles.row}>
											<Calendar size={12} color={theme.p[500]} />
											<Text style={styles.kathaMetaText}>{item.date}</Text>
										</View>
									) : null}
									<Text
										style={[
											styles.trackBadge,
											{ backgroundColor: theme.isDark ? ink[800] : ink[100], borderColor: theme.isDark ? ink[700] : ink[200], color: theme.isDark ? ink[400] : ink[500] },
										]}
									>
										{item.audio?.length ?? 0} {t.tracks}
									</Text>
								</View>
							</View>
							<Pressable
								hitSlop={6}
								onPress={() => {
									triggerHaptic("light");
									setExpanded(isExpanded ? null : item.id);
								}}
								style={[
									styles.expandButton,
									isExpanded ? { backgroundColor: theme.isDark ? ink[700] : theme.p[100] } : null,
								]}
							>
								{isExpanded ? <ChevronRight size={20} color={theme.p[600]} style={{ transform: [{ rotate: "-90deg" }] }} /> : <ChevronRight size={20} color={ink[400]} style={{ transform: [{ rotate: "90deg" }] }} />}
							</Pressable>
						</Pressable>

						{isExpanded ? (
							<View style={styles.kathaBody}>
								<View style={[styles.kathaTracks, { backgroundColor: theme.isDark ? "rgba(7,21,41,0.5)" : ink[50] }]}>
									{queue.map((track) => {
										const progress = active[track.id]?.progress;
										return (
											<Pressable key={track.id} onPress={() => play(track, queue, t.kathas)} style={styles.kathaTrack}>
												<View style={[styles.trackIcon, { backgroundColor: theme.isDark ? ink[700] : ink[100] }]}>
													<Music size={14} color={ink[400]} />
												</View>
												<Text style={[styles.kathaTrackText, { color: theme.isDark ? ink[300] : ink[700] }]} numberOfLines={1}>
													{track.singer || t.audioTrack}
												</Text>
												<Pressable onPress={() => play(track, queue, t.kathas)} style={styles.smallIcon}>
													<Play size={16} color={ink[400]} fill={ink[400]} />
												</Pressable>
												{progress !== undefined ? (
													<View style={[styles.progressBadge, { backgroundColor: theme.isDark ? ink[800] : ink[100] }]}>
														<Text style={styles.progressBadgeText}>{Math.round(progress)}%</Text>
													</View>
												) : downloaded[track.id] ? (
													<ConfirmDeleteButton onConfirm={() => deleteDownload(track.id)} iconColor={ink[400]} />
												) : (
													<Pressable
														accessibilityLabel="Download"
														onPress={() => requestTrackDownload(track, item.title, undefined, "lecture")}
														style={styles.smallIcon}
													>
														<Download size={18} color={ink[400]} />
													</Pressable>
												)}
											</Pressable>
										);
									})}
								</View>
							</View>
						) : null}
					</View>
				);
			}}
			ListEmptyComponent={<EmptyState icon={SearchX} title={t.noKatha} body={t.trySearch} />}
		/>
	);
}

function SingersTab({
	bhajans,
	query,
	titleOf,
	t,
	state,
	bottom,
}: {
	bhajans: Bhajan[];
	query: string;
	titleOf: (b: Bhajan) => string;
	t: Strings;
	state: ContentState;
	bottom: number;
}) {
	const [expanded, setExpanded] = useState<string | null>(null);
	const singers = useMemo(() => getSingersList(bhajans), [bhajans]);
	const filtered = useMemo(() => {
		if (!query.trim()) return singers;
		const q = smartNormalize(transliterateForSearch(query.toLowerCase()));
		return singers.filter((s) => smartNormalize(transliterateForSearch(s.name.toLowerCase())).includes(q));
	}, [singers, query]);
	const byId = useMemo(() => new Map(bhajans.map((b) => [b.id, b])), [bhajans]);

	if (filtered.length === 0) {
		return (
			<EmptyState
				icon={User}
				title={state.isSyncing ? t.loadingSingers : t.noSingers}
				body={query ? t.checkSpelling : undefined}
				syncing={state.isSyncing}
				action={state.isSyncing || query ? undefined : t.fetchKirtans}
				onAction={state.refresh}
			/>
		);
	}

	return (
		<FlashList
			renderScrollComponent={SideScrollView}
			data={filtered}
			keyExtractor={(s) => s.name}
			extraData={expanded}
			contentContainerStyle={{ padding: 8, paddingBottom: bottom }}
			renderItem={({ item: singer }) => {
				// The singer's own recording of each of their bhajans, as one queue.
				const singerQueue = singer.bhajanIds.flatMap((id) => {
					const b = byId.get(id);
					const tr = b?.audio?.find((x) => normalizeSingerName(x.singer) === singer.name);
					return b && tr ? [{ ...tr, bhajanTitle: titleOf(b), parentBhajan: b }] : [];
				});
				return (
					<AudioGroup
						icon={User}
						title={singer.name}
						highlight={query}
						subtitle={`${singer.bhajanIds.length} ${t.bhajans}`}
						expanded={expanded === singer.name}
						onToggle={() => setExpanded(expanded === singer.name ? null : singer.name)}
					>
						{singerQueue.map((track) => (
							<TrackRow
								key={track.id}
								label={track.bhajanTitle}
								onPress={() => play(track, singerQueue, `Singer: ${singer.name}`)}
								right={<TrackDownloadButton track={track} title={track.bhajanTitle} parent={track.parentBhajan} />}
							/>
						))}
					</AudioGroup>
				);
			}}
		/>
	);
}

function PlaylistsTab({
	bhajans,
	titleOf,
	t,
	bottom,
}: {
	bhajans: Bhajan[];
	titleOf: (b: Bhajan) => string;
	t: Strings;
	bottom: number;
}) {
	const theme = useAppTheme();
	const { playlists, createPlaylist, renamePlaylist, deletePlaylist, removeFromPlaylist } = usePlaylistStore();
	const [expanded, setExpanded] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [renaming, setRenaming] = useState<Playlist | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);
	const byId = useMemo(() => new Map(bhajans.map((b) => [b.id, b])), [bhajans]);

	// A playlist plays the first recording of each of its bhajans.
	const tracksOf = (p: Playlist) =>
		p.items.flatMap((id) => {
			const b = byId.get(id);
			return b?.audio?.length ? [{ ...b.audio[0], bhajanTitle: titleOf(b), parentBhajan: b }] : [];
		});

	return (
		<>
			<FlashList<Playlist>
				renderScrollComponent={SideScrollView}
				data={playlists}
				keyExtractor={(p) => p.id}
				extraData={expanded}
				contentContainerStyle={{ padding: 8, paddingBottom: bottom }}
				ListHeaderComponent={
					<>
						{/* AudioScreen renderListTab: the Drive backup card comes first. */}
						<BackupRestoreSection titled />
						<Pressable
							onPress={() => setCreating(true)}
							style={[styles.createButton, { borderColor: theme.isDark ? ink[600] : theme.p[300] }]}
						>
							<Plus size={20} color={theme.isDark ? ink[300] : ink[500]} />
							<Text style={[styles.createText, { color: theme.isDark ? ink[300] : ink[500] }]}>{t.createPlaylist}</Text>
						</Pressable>
					</>
				}
				ListEmptyComponent={
					<View style={styles.noPlaylists}>
						<ListMusic size={48} color={theme.p[500]} style={{ opacity: 0.3 }} />
						<Text style={{ color: ink[400], marginTop: 8 }}>{t.noPlaylists}</Text>
					</View>
				}
				renderItem={({ item: p }) => {
					const isExpanded = expanded === p.id;
					const tracks = tracksOf(p);
					return (
						<View
							style={[
								styles.playlistCard,
								isExpanded
									? {
											backgroundColor: theme.isDark ? "rgba(15,34,66,0.9)" : "rgba(255,255,255,0.9)",
											borderColor: theme.isDark ? ink[600] : theme.p[200],
											elevation: 3,
										}
									: null,
							]}
						>
							<View style={styles.playlistHead}>
								<Pressable style={styles.playlistMain} onPress={() => setExpanded(isExpanded ? null : p.id)}>
									<View
										style={[
											styles.medallion,
											isExpanded
												? { backgroundColor: theme.isDark ? ink[700] : theme.p[100], borderColor: theme.p[200] }
												: { backgroundColor: theme.isDark ? ink[800] : ink[100], borderColor: "transparent" },
										]}
									>
										<ListMusic size={18} color={isExpanded ? theme.p[600] : theme.isDark ? theme.p[400] : theme.p[500]} />
									</View>
									<View style={styles.flex}>
										<Text style={[styles.playlistName, { color: isExpanded ? theme.p[600] : theme.isDark ? ink[200] : ink[700] }]} numberOfLines={1}>
											{p.name}
										</Text>
										<Text style={{ fontSize: 12, color: theme.isDark ? ink[300] : ink[500] }}>
											{p.items.length} {t.songs}
										</Text>
									</View>
								</Pressable>
								<Pressable accessibilityLabel={t.rename} onPress={() => setRenaming(p)} style={styles.smallIcon}>
									<Pencil size={16} color={ink[400]} />
								</Pressable>
								<Pressable accessibilityLabel={t.delete} onPress={() => setDeleting(p.id)} style={styles.smallIcon}>
									<Trash2 size={16} color={ink[400]} />
								</Pressable>
								<Pressable onPress={() => setExpanded(isExpanded ? null : p.id)} style={styles.smallIcon}>
									<ChevronRight
										size={18}
										color={isExpanded ? theme.p[600] : ink[400]}
										style={{ transform: [{ rotate: isExpanded ? "-90deg" : "90deg" }] }}
									/>
								</Pressable>
							</View>
							{isExpanded ? (
								<View style={styles.groupBody}>
									{p.items.length === 0 ? (
										<View
											style={[
												styles.emptyPlaylist,
												{ backgroundColor: theme.isDark ? "rgba(7,21,41,0.5)" : ink[50], borderColor: theme.isDark ? ink[700] : ink[100] },
											]}
										>
											<Music size={32} color={theme.p[500]} style={{ opacity: 0.2 }} />
											<Text style={{ color: ink[400], fontSize: 14, marginTop: 8 }}>{t.emptyPlaylist}</Text>
										</View>
									) : (
										<View
											style={[
												styles.trackList,
												{ backgroundColor: theme.isDark ? "rgba(7,21,41,0.5)" : ink[50], borderColor: theme.isDark ? ink[700] : ink[100] },
											]}
										>
											{p.items.map((id) => {
												const b = byId.get(id);
												if (!b) return null;
												const track = tracks.find((tr) => tr.parentBhajan?.id === id);
												return (
													<TrackRow
														key={id}
														label={titleOf(b)}
														onPress={() => track && play(track, tracks, p.name)}
														right={
															<View style={styles.row}>
																{track ? <TrackDownloadButton track={track} title={track.bhajanTitle} parent={b} /> : null}
																<ConfirmDeleteButton label={t.confirm} onConfirm={() => removeFromPlaylist(p.id, id)} />
															</View>
														}
													/>
												);
											})}
										</View>
									)}
								</View>
							) : null}
						</View>
					);
				}}
			/>

			<NameModal
				visible={creating}
				title={t.newPlaylistTitle}
				placeholder={t.playlistName}
				confirmLabel={t.create}
				cancelLabel={t.cancel}
				onCancel={() => setCreating(false)}
				onConfirm={(name) => {
					createPlaylist(name);
					setCreating(false);
				}}
			/>
			<NameModal
				visible={!!renaming}
				initial={renaming?.name}
				title={t.renameTitle}
				placeholder={t.playlistName}
				confirmLabel={t.rename}
				cancelLabel={t.cancel}
				onCancel={() => setRenaming(null)}
				onConfirm={(name) => {
					if (renaming) renamePlaylist(renaming.id, name);
					setRenaming(null);
				}}
			/>
			<Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => setDeleting(null)} statusBarTranslucent>
				<View style={styles.scrim}>
					<View style={[styles.deleteCard, { backgroundColor: theme.isDark ? ink[800] : "#FFFDF7", borderColor: theme.isDark ? "#7f1d1d" : "#fecaca" }]}>
						<View style={styles.deleteIcon}>
							<AlertTriangle size={28} color="#ef4444" />
						</View>
						<Text style={[styles.deleteTitle, { color: theme.isDark ? "#fff" : ink[800] }]}>{t.deleteTitle}</Text>
						<Text style={[styles.deleteDesc, { color: theme.isDark ? ink[400] : ink[500] }]}>{t.deleteDesc}</Text>
						<View style={styles.modalActions}>
							<Pressable
								onPress={() => setDeleting(null)}
								style={[styles.modalButton, styles.outline, { backgroundColor: theme.isDark ? ink[700] : "#fff", borderColor: theme.isDark ? ink[600] : ink[200] }]}
							>
								<Text style={[styles.modalButtonText, { color: theme.isDark ? ink[300] : ink[600] }]}>{t.cancel}</Text>
							</Pressable>
							<Pressable
								onPress={() => {
									if (deleting) deletePlaylist(deleting);
									setDeleting(null);
								}}
								style={[styles.modalButton, { backgroundColor: "#ef4444" }]}
							>
								<Text style={[styles.modalButtonText, { color: "#fff" }]}>{t.delete}</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</>
	);
}

function NameModal({
	visible,
	initial = "",
	title,
	placeholder,
	confirmLabel,
	cancelLabel,
	onCancel,
	onConfirm,
}: {
	visible: boolean;
	initial?: string;
	title: string;
	placeholder: string;
	confirmLabel: string;
	cancelLabel: string;
	onCancel: () => void;
	onConfirm: (name: string) => void;
}) {
	const theme = useAppTheme();
	const [name, setName] = useState(initial);
	useEffect(() => {
		if (visible) setName(initial);
	}, [visible, initial]);
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
			<View style={styles.scrim}>
				<View style={[styles.nameCard, { backgroundColor: theme.card, borderColor: theme.isDark ? ink[700] : theme.p[200] }]}>
					<Text style={[styles.nameTitle, { color: theme.isDark ? theme.p[400] : theme.p[600] }]}>{title}</Text>
					<TextInput
						autoFocus
						value={name}
						onChangeText={setName}
						placeholder={placeholder}
						placeholderTextColor={ink[400]}
						style={[
							styles.nameInput,
							{ backgroundColor: theme.isDark ? ink[900] : ink[50], borderColor: theme.isDark ? ink[600] : theme.p[200], color: theme.isDark ? "#fff" : ink[800] },
						]}
					/>
					<View style={styles.modalActions}>
						<Pressable
							onPress={onCancel}
							style={[styles.modalButton, styles.outline, { backgroundColor: theme.isDark ? ink[700] : "#fff", borderColor: theme.isDark ? ink[600] : ink[200] }]}
						>
							<Text style={[styles.modalButtonText, { color: theme.isDark ? ink[300] : ink[500] }]}>{cancelLabel}</Text>
						</Pressable>
						<Pressable
							disabled={!name.trim()}
							onPress={() => onConfirm(name.trim())}
							style={[styles.modalButton, { backgroundColor: theme.p[500], opacity: name.trim() ? 1 : 0.5 }]}
						>
							<Text style={[styles.modalButtonText, { color: "#fff" }]}>{confirmLabel}</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function SearchResults({
	results,
	query,
	theme,
	t,
	bottom,
}: {
	results: QueueTrack[];
	query: string;
	theme: AppTheme;
	t: Strings;
	bottom: number;
}) {
	return (
		<FlashList<QueueTrack>
			data={results}
			keyExtractor={(tr, i) => `${tr.id}-${i}`}
			keyboardShouldPersistTaps="handled"
			contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 12, paddingBottom: bottom }}
			ListEmptyComponent={<EmptyState icon={Search} title={t.noAudio} body={t.checkSpelling} />}
			renderItem={({ item }) => (
				<Pressable
					onPress={() => {
						addRecentSearch(query);
						play(item, results, "Search Results");
					}}
					style={({ pressed }) => [
						styles.resultCard,
						{
							backgroundColor: theme.isDark ? ink[800] : `${theme.p[50]}80`,
							borderColor: theme.p[100],
							transform: [{ scale: pressed ? 0.98 : 1 }],
						},
					]}
				>
					<View style={[styles.medallion, { backgroundColor: theme.isDark ? ink[700] : theme.p[100], borderColor: theme.p[200] }]}>
						{item.parentBhajan ? <Music size={18} color={theme.p[600]} /> : <Mic size={18} color={theme.p[600]} />}
					</View>
					<View style={styles.flex}>
						<HighlightText
							text={item.bhajanTitle}
							highlight={query}
							numberOfLines={1}
							style={[styles.resultTitle, { color: theme.isDark ? ink[200] : ink[700] }]}
						/>
						<HighlightText
							text={item.singer || ""}
							highlight={query}
							numberOfLines={1}
							style={[styles.resultSinger, { color: theme.isDark ? ink[400] : ink[500] }]}
						/>
					</View>
					<TrackDownloadButton track={item} title={item.bhajanTitle} parent={item.parentBhajan} category={item.parentBhajan ? "audio" : "lecture"} />
					<ChevronRight size={20} color={ink[300]} />
				</Pressable>
			)}
		/>
	);
}

function AudioSearchBar({
	theme,
	query,
	onChange,
	placeholder,
	onClose,
}: {
	theme: AppTheme;
	query: string;
	onChange: (q: string) => void;
	placeholder: string;
	onClose: () => void;
}) {
	const [recent, setRecent] = useState<string[]>(getRecentSearches);
	const [showRecent, setShowRecent] = useState(false);
	return (
		<View style={[styles.searchBar, { backgroundColor: theme.isDark ? "rgba(7,21,41,0.95)" : "rgba(255,253,247,0.95)" }]}>
			<Search size={20} color="#8A660F" />
			<TextInput
				autoFocus
				value={query}
				onChangeText={onChange}
				placeholder={placeholder}
				placeholderTextColor={ink[400]}
				returnKeyType="search"
				onSubmitEditing={() => {
					if (!query.trim()) return;
					addRecentSearch(query.trim());
					setRecent(getRecentSearches());
				}}
				style={[styles.searchInput, { color: theme.isDark ? "#fff" : ink[900] }]}
			/>
			<VoiceSearchButton
				onResult={(text) => {
					onChange(text);
					setShowRecent(false);
				}}
			/>
			<Pressable accessibilityLabel="Close search" onPress={onClose} style={styles.smallIcon}>
				<X size={20} color={ink[400]} />
			</Pressable>
			{recent.length > 0 ? (
				<View>
					<Pressable accessibilityLabel="Recent searches" onPress={() => setShowRecent(!showRecent)} style={styles.smallIcon}>
						<History size={20} color={showRecent ? "#8A660F" : ink[400]} />
					</Pressable>
					{showRecent ? (
						<View style={[styles.recentMenu, { backgroundColor: theme.card, borderColor: theme.isDark ? ink[700] : ink[200] }]}>
							<View style={[styles.recentHead, { backgroundColor: theme.isDark ? "rgba(15,34,66,0.5)" : ink[50], borderBottomColor: theme.isDark ? ink[700] : ink[100] }]}>
								<Text style={styles.recentTitle}>RECENT SEARCHES</Text>
								<Pressable
									onPress={() => {
										clearRecentSearches();
										setRecent([]);
										setShowRecent(false);
									}}
								>
									<Text style={styles.recentClear}>Clear</Text>
								</Pressable>
							</View>
							{recent.map((term) => (
								<Pressable
									key={term}
									onPress={() => {
										onChange(term);
										setShowRecent(false);
									}}
									style={styles.recentItem}
								>
									<History size={14} color={ink[400]} />
									<Text style={{ flex: 1, fontSize: 14, color: theme.isDark ? ink[300] : ink[700] }} numberOfLines={1}>
										{term}
									</Text>
								</Pressable>
							))}
						</View>
					) : null}
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	row: { flexDirection: "row", alignItems: "center", gap: 4 },
	tabs: { flexDirection: "row", borderBottomWidth: 1, zIndex: 20 },
	tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderBottomWidth: 3, borderBottomColor: "transparent" },
	tabLabel: { fontSize: 12, fontWeight: "700" },
	syncBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginHorizontal: 16,
		marginTop: 12,
		paddingHorizontal: 12,
		paddingVertical: 12,
		borderRadius: 12,
		borderWidth: 1,
	},
	syncText: { flex: 1, fontSize: 14, fontWeight: "500" },
	floatSearch: { position: "absolute", top: 8, right: 16, zIndex: 20 },
	floatButton: { padding: 8, borderRadius: 999, borderWidth: 1, borderColor: "rgba(176,131,19,0.2)", elevation: 1 },
	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(176,131,19,0.2)",
		zIndex: 30,
	},
	searchInput: { flex: 1, paddingVertical: 8, fontSize: 16, fontWeight: "500" },
	smallIcon: { padding: 8 },
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
		zIndex: 50,
	},
	recentHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
	recentTitle: { fontSize: 12, fontWeight: "600", color: ink[500], letterSpacing: 1 },
	recentClear: { fontSize: 12, fontWeight: "500", color: "#ef4444" },
	recentItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
	empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
	emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 20 },
	emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", paddingHorizontal: 24 },
	emptyBody: { fontSize: 14, color: ink[400], marginTop: 8, textAlign: "center", paddingHorizontal: 24 },
	fetchButton: { marginTop: 24, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: "#B08313", paddingHorizontal: 24, paddingVertical: 10 },
	fetchText: { color: "#fff", fontSize: 14, fontWeight: "700" },
	medallion: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
	kathaCard: { borderRadius: 16, borderWidth: 1, borderColor: "transparent", marginBottom: 8 },
	kathaHead: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
	kathaTitle: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
	kathaMeta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
	kathaMetaText: { fontSize: 12, fontWeight: "500", color: ink[500] },
	trackBadge: { fontSize: 12, fontWeight: "500", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, overflow: "hidden" },
	expandButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
	kathaBody: { paddingHorizontal: 16, paddingBottom: 16 },
	kathaTracks: { borderRadius: 12, padding: 8, gap: 4 },
	kathaTrack: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 8 },
	trackIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
	kathaTrackText: { flex: 1, fontSize: 14, fontWeight: "700" },
	progressBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
	progressBadgeText: { fontSize: 9, fontWeight: "700", color: ink[500] },
	groupBody: { paddingHorizontal: 12, paddingBottom: 12 },
	trackList: { borderRadius: 12, padding: 6, borderWidth: 1, gap: 4 },
	createButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 16,
		borderRadius: 12,
		borderWidth: 2,
		borderStyle: "dashed",
		marginBottom: 16,
	},
	createText: { fontWeight: "700" },
	noPlaylists: { alignItems: "center", paddingVertical: 40 },
	playlistCard: { borderRadius: 16, borderWidth: 1, borderColor: "transparent", marginBottom: 8 },
	playlistHead: { flexDirection: "row", alignItems: "center", padding: 12 },
	playlistMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
	playlistName: { fontSize: 14, fontWeight: "700" },
	emptyPlaylist: { alignItems: "center", paddingVertical: 24, borderRadius: 12, borderWidth: 1 },
	scrim: { flex: 1, backgroundColor: "rgba(7,21,41,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
	nameCard: { width: "100%", maxWidth: 320, borderRadius: 24, padding: 24, borderWidth: 1, elevation: 24 },
	nameTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
	nameInput: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16, fontSize: 15 },
	modalActions: { flexDirection: "row", gap: 12 },
	modalButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
	outline: { borderWidth: 1 },
	modalButtonText: { fontWeight: "700" },
	deleteCard: { width: "100%", maxWidth: 320, borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1, elevation: 24 },
	deleteIcon: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: "#fee2e2",
		borderWidth: 1,
		borderColor: "#fecaca",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
	},
	deleteTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
	deleteDesc: { fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 24 },
	resultCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		padding: 16,
		borderRadius: 16,
		borderWidth: 1,
		marginBottom: 12,
		elevation: 1,
	},
	resultTitle: { fontSize: 13, fontWeight: "700", lineHeight: 18, marginBottom: 2 },
	resultSinger: { fontSize: 12, fontWeight: "500" },
});

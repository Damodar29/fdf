import { useIsFocused, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MessageCircle } from "lucide-react-native";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTabBarSpace } from "../components/BottomNav";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { AavirbhavSection } from "../components/home/AavirbhavSection";
import { BannerCarousel } from "../components/home/BannerCarousel";
import { DikshaAnniversaryCard } from "../components/home/DikshaAnniversaryCard";
import { BrandIcon, HelpModal, OpenLinkModal, type PendingLink } from "../components/home/HomeDialogs";
import {
	CustomAboutIcon,
	CustomAudiosIcon,
	CustomBhajanIcon,
	CustomBooksIcon,
	CustomCalendarIcon,
	CustomCentersIcon,
	CustomDonateIcon,
	CustomDownloadIcon,
	CustomFacebookIcon,
	CustomFeedbackIcon,
	CustomHelpIcon,
	CustomHistoryIcon,
	CustomInfoIcon,
	CustomInstagramIcon,
	CustomProfileIcon,
	CustomSettingsIcon,
	CustomShareIcon,
	CustomTimingIcon,
	CustomVideoIcon,
	CustomYouTubeIcon,
} from "../components/home/HomeIcons";
import { HeroCarousel } from "../components/home/HeroCarousel";
import { enterUp, GlassCard, ImageCard, SlideshowCard } from "../components/home/HomeTiles";
import { ProfileNoticeBanner } from "../components/home/ProfileNoticeBanner";
import { LotusCorner, PeacockFeatherDivider } from "../components/Ornaments";
import { MANDAL_LIST } from "../data/mandals";
import { openContentById, openLink, openProfile, openScreen } from "../lib/appNav";
import { triggerHaptic } from "../lib/haptics";
import { hasUnseen, useClearOnVisit, useSeenVersion } from "../lib/newBadge";
import { webGet } from "../lib/webStore";
import type { RootNavigation, TabParamList } from "../navigation/types";
import type { WebTarget } from "../screens/WebScreen";
import { type BannerConfig, startHomeData, useHomeDataStore } from "../store/homeDataStore";
import { startProfileSync } from "../store/profileStore";
import { useSettingsStore } from "../store/settingsStore";
import { cream, gold, ink, krishna, serif } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

// The Home tab — components/HomeScreen.tsx of the Capacitor app, natively:
// profile notices, the Aavirbhav glorification card, the Guru Maharaj
// carousel, today's diksha anniversaries, the admins' banners, the 24-tile
// grid with live photo slideshows and NEW / LIVE flags, App Sevak and the
// About footer. Tiles for screens that are not native yet open the web
// screen (WebScreen).

/** Item ids each tile tracks for its NEW badge (wider than the 5 photos shown). */
const NEWNESS_WINDOW = 20;

const IMG = {
	activities: require("../../assets/home/activities.webp"),
	activitiesDark: require("../../assets/home/activities-dark.webp"),
	darshan: require("../../assets/home/deity-darshan.webp"),
	information: require("../../assets/home/information.webp"),
	informationDark: require("../../assets/home/information-dark.webp"),
	gallery: require("../../assets/home/gallery.webp"),
};

const APP_SEVAKS = [
	{ en: "Narayan Prabhuji (Naman Prabhuji)", hi: "नारायण प्रभुजी (नमन प्रभुजी)" },
	{ en: "Raj Roop Prabhuji (Kota)", hi: "राज रूप प्रभुजी (कोटा)" },
	{ en: "Shreenath Prabhuji (Damoh)", hi: "श्रीनाथ प्रभुजी (दमोह)" },
	{ en: "Lalit Krishna Prabhuji (Lucky Prabhuji)", hi: "ललित कृष्ण प्रभुजी (लकी प्रभुजी)" },
	{ en: "Gourang Prabhuji (Bassi Prabhuji Khurai)", hi: "गौरांग प्रभुजी (बस्सी प्रभुजी खुरई)" },
	{ en: "Ram Prabhuji (Bhopal)", hi: "राम प्रभुजी (भोपाल)" },
	{ en: "Vishambhar Prabhuji (Bhopal)", hi: "विशम्भर प्रभुजी (भोपाल)" },
	{ en: "Adwait Prabhuji (Bhopal)", hi: "अद्वैत प्रभुजी (भोपाल)" },
	{ en: "Harsh Prabhuji (Jabalpur)", hi: "हर्ष प्रभुजी (जबलपुर)" },
	{ en: "Niketan Prabhuji (Indore)", hi: "निकेतन प्रभुजी (इन्दौर)" },
	{ en: "Manjari Mataji (Bhopal)", hi: "मंजरी माताजी (भोपाल)" },
	{ en: "Giriraj Prabhuji (Sagar)", hi: "गिरिराज प्रभुजी (सागर)" },
	{ en: "Divyansh Prabhuji (Khurai)", hi: "दिव्यांश प्रभुजी (खुरई)" },
	{ en: "Sanatan Prabhuji (Datia)", hi: "सनातन प्रभुजी (दतिया)" },
	{ en: "Raghunath Prabhuji (Kota)", hi: "रघुनाथ प्रभुजी (कोटा)" },
	{ en: "Pradumya Prabhuji (Gesabaad)", hi: "प्रदुम्य प्रभुजी (गेसाबाद)" },
	{ en: "Raghav Prabhuji (Harrai)", hi: "राघव प्रभुजी (हर्रई)" },
	{ en: "Shyam Sundar Prabhuji (Damoh)", hi: "श्याम सुंदर प्रभुजी (दमोह)" },
	{ en: "Bhaskar Prabhuji (Gesabaad)", hi: "भास्कर प्रभुजी (गेसाबाद)" },
	{ en: "Ayush Prabhuji (Damoh)", hi: "आयुष प्रभुजी (दमोह)" },
];

/* ─────────────────────────── merging (as in the OG Home) ─────────────────────────── */

// biome-ignore lint/suspicious/noExplicitAny: loosely shaped Firestore / GitHub records
type Any = any;
type Item = { id: string; url: string; date: string; order: number };

/** dateFormatter.formatForDateInput: DD-MM-YYYY → YYYY-MM-DD. */
const dateInput = (s?: string | null) => {
	if (!s) return "";
	const p = s.trim().split("-");
	return p.length === 3 && p[0].length === 2 ? `${p[2]}-${p[1]}-${p[0]}` : s;
};
const localDateKey = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const time = (s?: string | null) => new Date(dateInput(s) || 0).getTime() || 0;
const byNewest = (a: Item, b: Item) => time(b.date) - time(a.date) || a.order - b.order;

/** A release asset's date and order from its "[date][order][…].ext" name. */
function assetMeta(asset: Any) {
	const m = /^\[(.*?)\]\[(.*?)\]\[(.*?)\]\.(.*)$/.exec(asset.name);
	if (m) return { date: m[1], order: Number.parseInt(m[2], 10) || 0 };
	const d = new Date(asset.created_at);
	return { date: Number.isNaN(d.getTime()) ? asset.created_at : localDateKey(d), order: 0 };
}

/** Firestore gallery items of `type` + the GitHub release assets, newest first. */
function mergeGallery(mandals: Any[], releases: Any[], type: "darshan" | "activity"): Item[] {
	const seen = new Set<string>();
	const all: Item[] = [];
	for (const m of mandals) {
		for (const g of m.gallery || []) {
			if (g.type !== type || seen.has(g.url)) continue;
			seen.add(g.url);
			all.push({ id: String(g.id ?? g.url), url: g.url, date: g.date, order: g.order || 0 });
		}
	}
	for (const r of releases) {
		for (const a of r.assets || []) {
			const url = a.browser_download_url;
			if (seen.has(url)) continue;
			seen.add(url);
			all.push({ id: String(a.id ?? url), url, ...assetMeta(a) });
		}
	}
	return all.sort(byNewest);
}

const youTubeId = (url: string) =>
	/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/.exec(url)?.[1] ?? null;

/** Video thumbnails from the first two folders, newest first. */
function mergeVideos(videos: Any[], folders: Any[]): Item[] {
	let allowed = videos;
	if (folders.length > 0) {
		const first2 = [...folders].sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 2).map((f) => f.id);
		allowed = videos.filter((v) => first2.includes(v.folderId));
	}
	const seen = new Set<string>();
	const all: Item[] = [];
	for (const v of allowed) {
		const yt = youTubeId(v.url || "");
		const thumb = !v.useDefaultThumbnail && v.thumbnailUrl ? v.thumbnailUrl : yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : null;
		if (!thumb || seen.has(thumb)) continue;
		seen.add(thumb);
		all.push({ id: String(v.id ?? thumb), url: thumb, date: v.date || "", order: v.order || 0 });
	}
	return all.sort(byNewest);
}

/** Newest photo ids of every "… Gallery" folder (Past Event Media badge). */
function galleryFolderIds(mandals: Any[], activityReleases: Any[]): string[] {
	const folders = new Map<string, { name: string; gallery: Any[] }>();
	const fromGithub: Record<string, Any[]> = {};
	const githubNames: Record<string, string> = {};
	for (const r of activityReleases) {
		const lower = r.name.toLowerCase();
		const name = r.name
			.replace(/Activity Release for /i, "")
			.replace(/Release for /i, "")
			.replace(/\s*\(.*?\)\s*$/, "")
			.trim();
		const mandal = MANDAL_LIST.find((m) => lower.includes(m.name.toLowerCase().replace(" mandal", "").trim()) || lower.includes(m.id));
		const key = mandal?.id || `github-${r.id}`;
		fromGithub[key] ??= [];
		for (const a of r.assets || []) fromGithub[key].push({ id: String(a.id), ...assetMeta(a) });
		githubNames[key] = name;
	}
	const sortGallery = (list: Any[]) =>
		list.sort(
			(a, b) =>
				time(b.date) - time(a.date) || (a.order || 0) - (b.order || 0) || String(a.id || "").localeCompare(String(b.id || "")),
		);
	for (const m of MANDAL_LIST) {
		const db = mandals.find((x) => x.id === m.id) || { gallery: [] };
		const fsItems = (db.gallery || []).filter((g: Any) => g.type === "activity");
		const combined = [...fsItems, ...(fsItems.length > 0 ? [] : fromGithub[m.id] || [])];
		if (combined.length) folders.set(m.id, { name: m.name, gallery: sortGallery(combined) });
	}
	for (const key of Object.keys(fromGithub)) {
		if (key.startsWith("github-")) folders.set(key, { name: githubNames[key] || "Activity Folder", gallery: sortGallery(fromGithub[key]) });
	}
	const ids: string[] = [];
	for (const f of folders.values()) {
		if (!f.name?.toLowerCase().endsWith("gallery")) continue;
		for (const g of f.gallery.slice(0, 12)) if (g?.id !== undefined && g?.id !== null) ids.push(String(g.id));
	}
	return ids;
}

/* ─────────────────────────── ambience ─────────────────────────── */

function Sparkle({ left }: { left: number }) {
	const t = useSharedValue(0);
	const [duration] = useState(() => 10000 + Math.random() * 15000);
	const [delay] = useState(() => Math.random() * 10000);
	useEffect(() => {
		t.value = withDelay(
			delay,
			withRepeat(withSequence(withTiming(1, { duration: duration / 2 }), withTiming(0, { duration: duration / 2 })), -1),
		);
	}, [t, delay, duration]);
	const style = useAnimatedStyle(() => ({
		opacity: 0.2 + 0.6 * t.value,
		transform: [{ translateY: -2 * t.value }, { scale: 0.8 + 0.4 * t.value }],
	}));
	return <Animated.View style={[styles.sparkle, { left: `${left}%` }, style]} />;
}

/** Dawn wash + festival sparkles behind the top of the page. */
function Ambience() {
	const [lefts] = useState(() => Array.from({ length: 15 }, () => Math.random() * 100));
	return (
		<View style={styles.ambience} pointerEvents="none">
			<Svg width="100%" height={288}>
				<Defs>
					<RadialGradient id="dawn" cx="50%" cy="0%" rx="62.5%" ry="100%">
						<Stop offset="0" stopColor="#FFD54F" stopOpacity={0.2} />
						<Stop offset="0.45" stopColor="#FFD54F" stopOpacity={0.07} />
						<Stop offset="0.78" stopColor="#FFD54F" stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect width="100%" height="100%" fill="url(#dawn)" />
			</Svg>
			{lefts.map((l, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative list
				<Sparkle key={i} left={l} />
			))}
		</View>
	);
}

/* ─────────────────────────── sections ─────────────────────────── */

function FeaturedCard({ isDark, children, delay }: { isDark: boolean; children: ReactNode; delay: number }) {
	return (
		<Animated.View
			entering={enterUp(delay)}
			style={[styles.featured, { borderColor: isDark ? "rgba(255,213,79,0.3)" : gold[400] }]}
		>
			<LinearGradient colors={isDark ? [ink[800], ink[900]] : [cream[25], cream[100]]} style={StyleSheet.absoluteFill} />
			{children}
		</Animated.View>
	);
}

function SectionHeader({ title, isDark }: { title: string; isDark: boolean }) {
	return (
		<View style={styles.sectionHeader}>
			<Text style={[styles.sectionTitle, { color: isDark ? cream[50] : ink[900] }]}>{title}</Text>
			<PeacockFeatherDivider size={128} color={isDark ? "rgba(255,213,79,0.5)" : "rgba(212,160,23,0.7)"} />
		</View>
	);
}

/* ─────────────────────────── screen ─────────────────────────── */

export function HomeScreen() {
	const theme = useAppTheme();
	const isDark = theme.isDark;
	const navigation = useNavigation<RootNavigation>();
	const isFocused = useIsFocused();
	const tabBarSpace = useTabBarSpace();
	const { width } = useWindowDimensions();
	const language = useSettingsStore((s) => s.settingsLanguage);
	const isHindi = language === "hi";
	const data = useHomeDataStore();
	const [helpOpen, setHelpOpen] = useState(false);
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
	const [glorificationLang, setGlorificationLang] = useState(language);
	useEffect(() => setGlorificationLang(language), [language]);

	useEffect(() => {
		startHomeData();
		startProfileSync();
	}, []);

	// Photos and ids behind the tiles.
	const darshan = useMemo(() => mergeGallery(data.mandals, data.darshanReleases, "darshan"), [data.mandals, data.darshanReleases]);
	const activity = useMemo(
		() => mergeGallery(data.mandals, data.activityReleases, "activity"),
		[data.mandals, data.activityReleases],
	);
	const videos = useMemo(() => mergeVideos(data.videos, data.videoFolders), [data.videos, data.videoFolders]);
	const pastEventIds = useMemo(() => galleryFolderIds(data.mandals, data.activityReleases), [data.mandals, data.activityReleases]);
	const darshanImages = useMemo(() => darshan.slice(0, 5).map((i) => i.url), [darshan]);
	const videoImages = useMemo(() => videos.slice(0, 5).map((i) => i.url), [videos]);
	const darshanIds = useMemo(() => darshan.slice(0, NEWNESS_WINDOW).map((i) => i.id), [darshan]);
	const activityIds = useMemo(() => activity.slice(0, NEWNESS_WINDOW).map((i) => i.id), [activity]);
	const videoIds = useMemo(() => videos.slice(0, NEWNESS_WINDOW).map((i) => i.id), [videos]);

	// NEW badges — cleared when the web screen behind the tile is visited.
	useSeenVersion();
	const hasNewDarshan = hasUnseen("cpbs_home_darshan_latest", darshanIds);
	const hasNewActivity = hasUnseen("cpbs_home_activity_latest", activityIds);
	const hasNewVideo = hasUnseen("cpbs_home_video_latest", videoIds);
	const hasNewPastEvent = hasUnseen("cpbs_activity_photos_main_latest", pastEventIds);
	useClearOnVisit("darshan", "cpbs_home_darshan_latest", darshanIds);
	useClearOnVisit("activities", "cpbs_home_activity_latest", activityIds);
	useClearOnVisit("videos", "cpbs_home_video_latest", videoIds);
	useClearOnVisit("photos", "cpbs_activity_photos_main_latest", pastEventIds);

	// SettingsContext hasNewInformation: an enabled, unexpired item not read yet.
	const info = data.information;
	let hasNewInformation = false;
	if (info?.enabled) {
		if (info.items?.length) {
			let read: string[] = [];
			try {
				read = JSON.parse(webGet("cpbs_read_info_ids") || "[]");
			} catch {}
			const now = Date.now();
			hasNewInformation = info.items
				.filter((i) => i.isEnabled !== false && (!i.expiryDate || i.expiryDate > now))
				.some((i) => !read.includes(i.id));
		} else if (info.title) {
			hasNewInformation = webGet("cpbs_last_read_info_title") !== info.title;
		}
	}
	const hasUnreadGlorifications =
		data.glorificationPublished &&
		data.glorificationIds.length > 0 &&
		data.glorificationIds.join(",") !== webGet("allGlorificationsReadHash");

	/* navigation */
	const press = (fn: () => void) => () => {
		triggerHaptic("light");
		fn();
	};
	const web = (target: WebTarget) => navigation.navigate("Web", { target });
	const screen = (name: string) => openScreen(name);
	const tab = (name: keyof TabParamList) => navigation.navigate("Tabs", { screen: name });
	const onBanner = (config: BannerConfig) => {
		const target = config.actionTarget || "";
		if (config.actionType === "bhajan" || config.actionType === "lecture") return openContentById(target, config.actionType);
		if (config.actionType === "screen" && target) return openScreen(target);
		if (config.actionType === "link" && target) openLink(target);
	};

	const social = (live: boolean, link: string | undefined, title: string, icon: ReactNode, tint: PendingLink["tint"], fallback: () => void) => () => {
		triggerHaptic("light");
		if (live && link) setPendingLink({ url: link, title, icon, tint });
		else fallback();
	};

	const shareApp = () => {
		triggerHaptic("light");
		Share.share({
			title: "Shree Chaitanya Prem Bhakti Sangh",
			message: "Download the Prem Bhakti app & visit our website:\nhttps://chaitanyaprembhakti.org",
		}).catch(() => {});
	};

	const t = {
		dailyDarshan: isHindi ? "ठाकुर जी के दर्शन" : "Deity Darshan",
		dailyQuotes: isHindi ? "नित्य वाणी" : "Daily Quotes",
		vaishnavCalendar: isHindi ? "वैष्णव कैलेंडर" : "Vaishnav Calendar",
		ourCenters: isHindi ? "हमारे केंद्र" : "Our Centers",
		donate: isHindi ? "सहयोग करें" : "Donate",
		youtube: isHindi ? "यूट्यूब" : "YouTube",
		instagram: isHindi ? "इंस्टाग्राम" : "Instagram",
		facebook: isHindi ? "फेसबुक" : "Facebook",
		bhajans: isHindi ? "भजन सूची" : "Bhajan List",
		howToUse: isHindi ? "ऐप कैसे उपयोग करें" : "How to Use App",
		aboutUs: isHindi ? "परिचय (About)" : "About Us",
		information: isHindi ? "जानकारी" : "Information",
		templeTiming: isHindi ? "मंदिर का समय" : "Temple Timing",
		shareApp: isHindi ? "ऐप शेयर करें" : "Share App",
		downloads: isHindi ? "डाउनलोड्स" : "Downloads",
		feedback: isHindi ? "प्रतिक्रिया" : "Feedback",
		pastEventMedia: isHindi ? "पिछले कार्यक्रम मीडिया" : "Past Event Media",
		settings: isHindi ? "सेटिंग्स" : "Settings",
		ourActivities: isHindi ? "हमारी गतिविधियाँ" : "Our Activities",
		videos: isHindi ? "वीडियो" : "Videos",
		audios: isHindi ? "ऑडियो" : "Audios",
		books: isHindi ? "पुस्तकें" : "Books",
		historyAuthors: isHindi ? "लेखक और इतिहास" : "Authors and History",
		profile: isHindi ? "भक्त प्रोफाइल" : "Devotee Profile",
	};

	// Two columns (grid-cols-2 gap-4 inside px-3), as on a phone.
	const tileWidth = (width - 24 - 16) / 2;
	const iconColor = isDark ? gold[300] : krishna[600];
	const icon = (Icon: (p: { size?: number; color?: string }) => ReactNode) => <Icon size={96} color={iconColor} />;
	const s = data.social;
	let order = 0;
	const tile = () => ({ isDark, width: tileWidth, delay: 300 + 100 * ++order });

	return (
		<View style={styles.flex}>
			<ScrollView
				contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 16 }]}
				showsVerticalScrollIndicator={false}
			>
				<Ambience />

				<ProfileNoticeBanner isHindi={isHindi} isDark={isDark} onOpenProfile={openProfile} />

				<Animated.View entering={enterUp(80)}>
					<AavirbhavSection
						isHindi={glorificationLang === "hi"}
						isDark={isDark}
						onToggleLanguage={() => setGlorificationLang((l) => (l === "hi" ? "en" : "hi"))}
						onWrite={press(() => web({ buttonText: ["Write now", "अभी लिखें"] }))}
						showReadAll={data.glorificationPublished}
						hasUnread={hasUnreadGlorifications}
						onReadAll={press(() => screen("glorification-reader"))}
					/>
				</Animated.View>

				<Animated.View entering={enterUp(100)}>
					<HeroCarousel
						isHindi={isHindi}
						isDark={isDark}
						onOpenGuru={() => screen("guru-maharaj")}
						onOpenVirahi={() => screen("virahi-maharaj")}
					/>
				</Animated.View>

				<DikshaAnniversaryCard isHindi={isHindi} isDark={isDark} entering={enterUp(150)} />

				<BannerCarousel active={isFocused} onAction={onBanner} entering={enterUp(200)} style={styles.bannerBleed} />

				<View style={styles.grid}>
					<SlideshowCard
						{...tile()}
						title={t.ourActivities}
						imageUrls={[]}
						fallbackImage={isDark ? IMG.activitiesDark : IMG.activities}
						hasNew={hasNewActivity}
						onPress={press(() => screen("activities"))}
					/>
					<SlideshowCard
						{...tile()}
						title={t.dailyDarshan}
						imageUrls={darshanImages}
						fallbackImage={IMG.darshan}
						hasNew={hasNewDarshan}
						onPress={press(() => screen("darshan"))}
					/>
					<GlassCard {...tile()} title={t.vaishnavCalendar} icon={icon(CustomCalendarIcon)} onPress={press(() => screen("events"))} />
					<GlassCard {...tile()} title={t.donate} icon={icon(CustomDonateIcon)} onPress={press(() => screen("donate"))} />
					<SlideshowCard
						{...tile()}
						title={t.dailyQuotes}
						imageUrls={data.quotesImages}
						fallbackImage={isDark ? IMG.informationDark : IMG.information}
						onPress={press(() => screen("quotes"))}
					/>
					<SlideshowCard
						{...tile()}
						title={t.videos}
						imageUrls={videoImages}
						fallbackIcon={icon(CustomVideoIcon)}
						hasNew={hasNewVideo}
						onPress={press(() => screen("videos"))}
					/>
					<ImageCard
						{...tile()}
						title={t.pastEventMedia}
						image={IMG.gallery}
						hasNew={hasNewPastEvent}
						onPress={press(() => screen("photos"))}
					/>
					<GlassCard {...tile()} title={t.ourCenters} icon={icon(CustomCentersIcon)} onPress={press(() => screen("seva"))} />
					<GlassCard {...tile()} title={t.bhajans} icon={icon(CustomBhajanIcon)} onPress={press(() => tab("Songs"))} />
					<GlassCard {...tile()} title={t.audios} icon={icon(CustomAudiosIcon)} onPress={press(() => tab("Lectures"))} />
					<GlassCard {...tile()} title={t.books} icon={icon(CustomBooksIcon)} onPress={press(() => tab("Books"))} />
					<GlassCard {...tile()} title={t.historyAuthors} icon={icon(CustomHistoryIcon)} onPress={press(() => tab("Library"))} />
					<GlassCard {...tile()} title={t.profile} icon={icon(CustomProfileIcon)} onPress={press(openProfile)} />
					<GlassCard
						{...tile()}
						title={t.information}
						icon={icon(CustomInfoIcon)}
						hasNew={hasNewInformation}
						onPress={press(() => screen("information"))}
					/>
					<GlassCard
						{...tile()}
						title={t.youtube}
						icon={icon(CustomYouTubeIcon)}
						isLive={s.isYoutubeLive}
						onPress={social(
							s.isYoutubeLive,
							s.youtubeLiveLink,
							t.youtube,
							<BrandIcon name="youtube" color={isDark ? "#F87171" : "#DC2626"} />,
							{ bg: isDark ? "rgba(127,29,29,0.3)" : "#FEE2E2", fg: "#DC2626" },
							() => screen("youtube"),
						)}
					/>
					<GlassCard
						{...tile()}
						title={t.instagram}
						icon={icon(CustomInstagramIcon)}
						isLive={s.isInstagramLive}
						onPress={social(
							s.isInstagramLive,
							s.instagramLiveLink,
							t.instagram,
							<BrandIcon name="instagram" color={isDark ? "#F472B6" : "#DB2777"} />,
							{ bg: isDark ? "rgba(131,24,67,0.3)" : "#FCE7F3", fg: "#DB2777" },
							() => web({ buttonText: ["Instagram", "इंस्टाग्राम"] }),
						)}
					/>
					<GlassCard
						{...tile()}
						title={t.facebook}
						icon={icon(CustomFacebookIcon)}
						isLive={s.isFacebookLive}
						onPress={social(
							s.isFacebookLive,
							s.facebookLiveLink,
							t.facebook,
							<BrandIcon name="facebook" color={isDark ? "#60A5FA" : "#2563EB"} />,
							{ bg: isDark ? "rgba(30,58,138,0.3)" : "#DBEAFE", fg: "#2563EB" },
							() => web({ buttonText: ["Facebook", "फेसबुक"] }),
						)}
					/>
					<GlassCard {...tile()} title={t.templeTiming} icon={icon(CustomTimingIcon)} onPress={press(() => screen("temple-timings"))} />
					<GlassCard {...tile()} title={t.shareApp} icon={icon(CustomShareIcon)} onPress={shareApp} />
					<GlassCard {...tile()} title={t.downloads} icon={icon(CustomDownloadIcon)} onPress={press(() => navigation.navigate("Tabs", { screen: "Downloads" }))} />
					<GlassCard {...tile()} title={t.settings} icon={icon(CustomSettingsIcon)} onPress={press(() => navigation.navigate("Settings"))} />
					<GlassCard {...tile()} title={t.feedback} icon={icon(CustomFeedbackIcon)} onPress={press(() => setFeedbackOpen(true))} />
					<GlassCard {...tile()} title={t.howToUse} icon={icon(CustomHelpIcon)} onPress={press(() => setHelpOpen(true))} />
					<GlassCard {...tile()} title={t.aboutUs} icon={icon(CustomAboutIcon)} onPress={press(() => screen("about"))} />
				</View>

				{/* App Sevak */}
				<FeaturedCard isDark={isDark} delay={800}>
					<View style={styles.featuredBody}>
						<SectionHeader title={isHindi ? "ऐप सेवक (App Sevak)" : "App Sevak"} isDark={isDark} />
						<Text style={[styles.sevakLead, { color: isDark ? "rgba(253,241,214,0.8)" : ink[600] }]}>
							{isHindi ? "परमपूज्य वर्तमान आचार्य जी महाराज जी की आज्ञा से" : "By the order of Acharya Ji Maharaj Ji"}
						</Text>
						<View style={styles.chips}>
							{APP_SEVAKS.map((sevak) => (
								<View
									key={sevak.en}
									style={[
										styles.chip,
										{
											backgroundColor: isDark ? "rgba(255,213,79,0.1)" : gold[100],
											borderColor: isDark ? "rgba(255,213,79,0.25)" : "rgba(255,213,79,0.6)",
										},
									]}
								>
									<Text style={[styles.chipText, { color: isDark ? gold[300] : gold[800] }]}>{isHindi ? sevak.hi : sevak.en}</Text>
								</View>
							))}
						</View>
						<Text style={[styles.caption, { color: isDark ? ink[300] : ink[500] }]}>
							{isHindi
								? "बाकी जानकारी बाद में अपडेट की जाएगी कि किसका क्या योगदान है।"
								: "Details regarding individual contributions will be updated later."}
						</Text>
					</View>
				</FeaturedCard>

				{/* About footer */}
				<FeaturedCard isDark={isDark} delay={800}>
					<View style={styles.lotus} pointerEvents="none">
						<LotusCorner size={56} color={isDark ? "rgba(255,213,79,0.15)" : "rgba(240,190,51,0.3)"} />
					</View>
					<View style={styles.featuredBody}>
						<Text style={[styles.footerTitle, { color: isDark ? gold[300] : gold[700] }]}>Prem Bhakti</Text>
						<Text style={[styles.footerText, { color: isDark ? "rgba(253,241,214,0.8)" : ink[700] }]}>
							{isHindi ? (
								<>
									आधिकारिक <Text style={styles.bold}>प्रेम भक्ति</Text> एप्लिकेशन में आपका स्वागत है। इस ऐप का उद्देश्य हमारे
									आध्यात्मिक समुदाय को दैनिक दर्शन, भक्ति भजन, आध्यात्मिक साहित्य, कीर्तन और लाइव कार्यक्रमों की समय-सारणी तक आसान
									पहुँच प्रदान करना है। हमारा लक्ष्य आध्यात्मिक जुड़ाव को गहरा करना और भक्ति के लिए आवश्यक सभी संसाधन एक ही स्थान पर
									प्रदान करना है।
								</>
							) : (
								<>
									Welcome to the official <Text style={styles.bold}>Prem Bhakti</Text> application. The purpose of this app is to
									provide our spiritual community with easy access to daily darshan, devotional bhajans, spiritual literature,
									kirtans, and live event schedules. Our mission is to facilitate a deeper spiritual connection and provide all
									necessary resources for devotion in one place.
								</>
							)}
						</Text>
						<Pressable
							onPress={press(() => setFeedbackOpen(true))}
							style={({ pressed }) => [styles.contactWrap, pressed && styles.pressed]}
						>
							<LinearGradient colors={[krishna[500], krishna[600]]} style={styles.contact}>
								<MessageCircle size={20} color={cream[50]} />
								<Text style={styles.contactText}>{isHindi ? "संपर्क करें (Contact Us)" : "Contact Us"}</Text>
							</LinearGradient>
						</Pressable>
					</View>
				</FeaturedCard>
			</ScrollView>

			<HelpModal
				visible={helpOpen}
				isHindi={isHindi}
				isDark={isDark}
				onClose={() => setHelpOpen(false)}
				onIntro={() => {
					setHelpOpen(false);
					web({ onboarding: true });
				}}
				onVideo={() => Linking.openURL(data.howToUseUrl).catch(() => {})}
			/>
			<OpenLinkModal
				link={pendingLink}
				isHindi={isHindi}
				isDark={isDark}
				onCancel={() => setPendingLink(null)}
				onOpen={() => {
					if (pendingLink) Linking.openURL(pendingLink.url).catch(() => {});
					setPendingLink(null);
				}}
			/>
			<FeedbackDialog visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { paddingHorizontal: 12, paddingTop: 8, gap: 20 },
	ambience: { position: "absolute", top: 0, left: -12, right: -12, height: 288 },
	sparkle: {
		position: "absolute",
		top: 0,
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: "rgba(255,213,79,0.6)",
		shadowColor: "#FFD54F",
		shadowOpacity: 0.7,
		shadowRadius: 8,
	},
	bannerBleed: { marginHorizontal: -12 },
	grid: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 16, marginTop: 4, marginBottom: 12 },
	featured: {
		borderRadius: 40,
		borderWidth: 1,
		overflow: "hidden",
		marginTop: 12,
		shadowColor: krishna[600],
		shadowOpacity: 0.16,
		shadowRadius: 28,
		shadowOffset: { width: 0, height: 12 },
		elevation: 6,
	},
	featuredBody: { padding: 24, alignItems: "center" },
	sectionHeader: { alignItems: "center", gap: 4, marginBottom: 16 },
	sectionTitle: { fontFamily: serif, fontSize: 22, lineHeight: 28, textAlign: "center" },
	sevakLead: { marginTop: -8, marginBottom: 16, fontSize: 15, lineHeight: 24, fontStyle: "italic", textAlign: "center" },
	chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 16 },
	chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
	chipText: { fontSize: 13, fontWeight: "600" },
	caption: { marginTop: 20, fontSize: 13, lineHeight: 19, textAlign: "center" },
	lotus: { position: "absolute", right: 0, bottom: 0 },
	footerTitle: { fontFamily: serif, fontSize: 26, fontWeight: "600", marginBottom: 12 },
	footerText: { fontSize: 15, lineHeight: 26, textAlign: "center" },
	bold: { fontWeight: "700" },
	contactWrap: { marginTop: 24, borderRadius: 999, overflow: "hidden" },
	pressed: { transform: [{ scale: 0.95 }] },
	contact: {
		minHeight: 44,
		paddingHorizontal: 20,
		borderRadius: 999,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderWidth: 1,
		borderColor: krishna[700],
	},
	contactText: { color: cream[50], fontSize: 14, fontWeight: "600" },
});

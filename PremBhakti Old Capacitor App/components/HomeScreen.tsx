import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import {
	ChevronLeft,
	ChevronRight,
	Compass,
	ExternalLink,
	Facebook,
	Instagram,
	MessageCircle,
	Play,
	Settings,
	Smartphone,
	X,
	Youtube,
} from "lucide-react";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useSharedFirebase } from "../context/SharedFirebaseContext";
import { useToast } from "../context/ToastContext";
import {
	hasUnseen,
	useClearOnVisit,
	useSeenVersion,
} from "../hooks/useNewBadge";
import { db } from "../services/firebase";
import { LotusCorner } from "../src/assets/janmashtami";
import { SectionHeader } from "../src/components/SectionHeader";
import { useDevicePerformance } from "../src/hooks/useDevicePerformance";
import { button, card, chip, ornamentClass, ornamentSize } from "../src/theme";
import { requestTourReplay } from "../src/tour/tourBus";
import { MANDAL_LIST } from "../src/types/mandal";
import type { BannerConfig } from "../types";
import { toCdnUrl } from "../utils/cdnUrl";
import { formatForDateInput, toLocalDateKey } from "../utils/dateFormatter";
import { iosGetDoc, shouldUseRestFallback } from "../utils/firebaseRest";
import { triggerHaptic } from "../utils/haptic";
import { THUMB, thumbUrl } from "../utils/imageThumb";
import { shareAppContent } from "../utils/shareService";
import { AavirbhavMahotsavSection } from "./AavirbhavMahotsavSection";
import { BannerContainer } from "./BannerContainer";
import { DikshaAnniversaryCard } from "./DikshaAnniversaryCard";
import {
	CustomAudiosIcon,
	CustomBhajanIcon,
	CustomBooksIcon,
	CustomCentersIcon,
	CustomFacebookIcon,
	CustomHistoryIcon,
	CustomInfoIcon,
	CustomInstagramIcon,
	CustomProfileIcon,
	CustomTimingIcon,
	CustomYouTubeIcon,
} from "./CustomIcons";
import {
	CustomAboutIcon,
	CustomCalendarIcon,
	CustomDonateIcon,
	CustomDownloadIcon,
	CustomFeedbackIcon,
	CustomHelpIcon,
	CustomSettingsIcon,
	CustomShareIcon,
	CustomVideoIcon,
} from "./CustomIcons2";
import { FeedbackModal } from "./FeedbackModal";
import { GlorificationModal } from "./GlorificationModal";
import { ProfileButtonIcon } from "./ProfileButtonIcon";
import { HeaderLogo } from "./JanmashtamiHeader";
import { GlorificationReaderScreen } from "./GlorificationReaderScreen";
import { ProfileNoticeBanner } from "./ProfileNoticeBanner";
import { ThankYouPopup } from "./ThankYouPopup";
import {
	applyShareTargetToUrl,
	parseSharePath,
	shareTargetScreen,
} from "../utils/shareLinks";

/**
 * How many of the newest items each home tile tracks for its NEW badge.
 *
 * Wider than the five images the slideshow shows, so that a burst of uploads is
 * fully marked seen in one visit. It has to match between the `hasUnseen` check
 * and the `useClearOnVisit` write — they read the same state arrays, so it does
 * by construction; if they ever diverged, the badge would never clear.
 */
const NEWNESS_WINDOW = 20;

interface HomeScreenProps {
	onOpenDailyQuotes: () => void;
	onOpenDailyInfo: () => void;
	onOpenInformation: () => void;
	onOpenEvents: () => void;
	onOpenDailyDarshan: () => void;
	onOpenSevaCenter: () => void;
	onOpenActivities: () => void;
	onOpenYouTube: () => void;
	onOpenFacebook: () => void;
	onOpenInstagram: () => void;
	onOpenDonate: () => void;
	onOpenBhajanList: () => void;
	onOpenAbout: () => void;
	onOpenOnboarding: () => void;
	onOpenGuruMaharaj: () => void;
	onOpenVirahiMaharaj: () => void;
	onOpenTempleTimings: () => void;
	onOpenProfile: () => void;
	onOpenSettings: () => void;
	onOpenPrivacy: () => void;
	onOpenVideos: () => void;
	onOpenPhotos: () => void;
	settingsLanguage: "en" | "hi";
	onNavigate: (screen: string) => void;
	onOpenDeepLink: (id: string, type?: "bhajan" | "lecture") => void;
	isActive?: boolean;
}

// Icon URLs
const GALLERY_ICON = "/icon-deity-darshan.webp?v=3";
const OUR_ACTIVITIES_ICON = "/Activities.webp?v=3";
const OUR_ACTIVITIES_ICON_DARK = "/Activities_Dark.webp?v=3";

const _VAISHNAV_CALENDAR_ICON = "/Calender.webp?v=2";
const _VAISHNAV_CALENDAR_ICON_DARK = "/Calendar_Dark.webp?v=2";

const _DONATE_ICON = "/donate.webp?v=2";
const _DONATE_ICON_DARK = "/donate_dark.webp?v=2";

const _OUR_CENTERS_ICON = "/Our_Centers.webp?v=2";
const _OUR_CENTERS_ICON_DARK = "/Our_Centers_Dark.webp?v=2";

// Quotes: uses existing public images for dark/light fallback
const DAILY_INFO_ICON = "/information.webp?v=3";
const DAILY_INFO_ICON_DARK = "/info_dark.webp?v=2";

const _YOUTUBE_ICON = "/youtube.webp?v=2";
const _YOUTUBE_ICON_DARK = "/youtube_dark.webp?v=2";

const _INSTAGRAM_ICON = "/Instagram.webp?v=2";
const _INSTAGRAM_ICON_DARK = "/Instagram_dark.webp?v=2";

const _FACEBOOK_ICON = "/facebook.webp?v=2";
const _FACEBOOK_ICON_DARK = "/facebook_Dark.webp?v=2";

const _BHAJAN_ICON = "/bhajan_new.webp?v=2";
const _BHAJAN_ICON_DARK = "/bhajan_new-dark.webp?v=2";

// Videos: deleted images — using Lucide icon fallback via fallbackIcon prop

const _AUDIO_ICON = "/icon-audios.webp?v=2";
const _AUDIO_ICON_DARK = "/icon-audios-dark.webp?v=2";

const _BOOKS_ICON = "/Books.webp?v=2";
const _BOOKS_ICON_DARK = "/Books_Dark.webp?v=2";

const _HISTORY_AUTHORS_ICON = "/History_authors.webp?v=2";
const _HISTORY_AUTHORS_ICON_DARK = "/History_authors_dark.webp?v=2";

const _PROFILE_ICON = "/Devotee.webp?v=2";
const _PROFILE_ICON_DARK = "/Devotee_Dark.webp?v=2";

const _INFO_ICON = "/information.webp?v=3";
const _INFO_ICON_DARK = "/info_dark.webp?v=2";

const _TEMPLE_ICON = "/Temple_Timing.webp?v=2";
const _TEMPLE_ICON_DARK = "/Temple_Timing_Dark.webp?v=2";

const _SHARE_ICON = "/share.webp?v=2";
const _SHARE_ICON_DARK = "/share_dark.webp?v=2";

const _DOWNLOADS_ICON = "/Download.webp?v=2";
const _DOWNLOADS_ICON_DARK = "/Download_Dark.webp?v=2";

const _FEEDBACK_ICON = "/information.webp?v=3";
const _FEEDBACK_ICON_DARK = "/info_dark.webp?v=2";

const _HOW_TO_USE_ICON = "/howtouse.webp?v=2";
const _HOW_TO_USE_ICON_DARK = "/howtouse.webp?v=2";

const _ABOUT_US_ICON = "/About_Us.webp?v=2";
const _ABOUT_US_ICON_DARK = "/About_us_dark.webp?v=2";
const PHOTOS_ICON = "/2_Gallery Icon.webp?v=2";
const _SETTINGS_ICON = "/Setting.webp?v=2";
const _SETTINGS_ICON_DARK = "/Setting_Dark.webp?v=2";

/**
 * Profile button in the desktop / landscape Home header (royal blue bar).
 * With a profile photo the button IS the photo — a gold-ringed 44 px circle;
 * without one it is the same cream User icon as the phone header. Own
 * component so profile changes re-render only this button, not all of Home.
 */
const DesktopProfileButton: React.FC<{
	isHindi: boolean;
	onOpenProfile: () => void;
}> = ({ isHindi, onOpenProfile }) => {
	const { profile } = useAuth();
	const hasPhoto = !!profile?.photoURL;
	const focusRing =
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300";

	return (
		<button
			type="button"
			onClick={() => {
				triggerHaptic("light");
				onOpenProfile();
			}}
			className={
				hasPhoto
					? `relative shrink-0 w-11 h-11 rounded-full bg-krishna-700 border-2 border-gold-300 hover:border-gold-200 transition-all active:scale-95 ${focusRing}`
					: `relative inline-flex items-center justify-center min-h-touch min-w-touch text-cream-50 hover:text-gold-300 hover:bg-cream-50/10 rounded-full transition-colors active:scale-95 ${focusRing}`
			}
			title={isHindi ? "भक्त प्रोफाइल" : "Devotee Profile"}
			aria-label={isHindi ? "भक्त प्रोफाइल" : "Devotee Profile"}
			data-tour="header-profile"
		>
			{/* Same photo and status badges as the phone header. max-w-none:
			    Tailwind's img { max-width: 100% } would otherwise squeeze it. */}
			<ProfileButtonIcon
				photoSizeClassName="block w-full h-full max-w-none"
				badgeRingClassName="border-krishna-700"
				// On the round photo button the badges sit on the circle's edge
				// (like an "online" dot), not inside the photo over its gold ring.
				statusDotClassName={
					hasPhoto ? "-top-px -right-px w-3 h-3" : undefined
				}
				requestBadgePositionClassName={
					hasPhoto ? "top-0 left-0" : undefined
				}
			/>
		</button>
	);
};

export const HomeScreen: React.FC<HomeScreenProps> = memo(
	({
		onOpenDailyQuotes,
		onOpenDailyInfo,
		onOpenInformation,
		onOpenEvents,
		onOpenDailyDarshan,
		onOpenSevaCenter,
		onOpenActivities,
		onOpenYouTube,
		onOpenFacebook,
		onOpenInstagram,
		onOpenDonate,
		onOpenBhajanList,
		onOpenAbout,
		onOpenOnboarding,
		onOpenGuruMaharaj,
		onOpenVirahiMaharaj,
		onOpenTempleTimings,
		onOpenProfile,
		onOpenSettings,
		onOpenPrivacy,
		onOpenVideos,
		onOpenPhotos,
		settingsLanguage,
		onNavigate,
		onOpenDeepLink,
		isActive = true,
	}) => {
		const { showToast } = useToast();
		const { socialMediaStatus, darkMode, hasNewInformation } = useSettings();
		const isHindi = settingsLanguage === "hi";
		const [showHelpModal, setShowHelpModal] = useState(false);
		const [showFeedbackModal, setShowFeedbackModal] = useState(false);

		const [sharedGlorificationLang, setSharedGlorificationLang] = useState<
			"en" | "hi"
		>(settingsLanguage);
		useEffect(() => {
			setSharedGlorificationLang(settingsLanguage);
		}, [settingsLanguage]);

		const [showGlorificationModal, setShowGlorificationModal] = useState(false);
		const [showGlorificationReader, setShowGlorificationReader] =
			useState(false);
		const [glorificationReaderPublished, setGlorificationReaderPublished] =
			useState(false);
		const [publishedGlorificationIds, setPublishedGlorificationIds] = useState<
			string[]
		>([]);
		const [showGlorificationThankYou, setShowGlorificationThankYou] =
			useState(false);
		// Back-button: showHelpModal
		useEffect(() => {
			if (showHelpModal)
				window.history.pushState({ isPopup: true, view: "help-modal" }, "");
		}, [showHelpModal]);
		useEffect(() => {
			const h = (e: PopStateEvent) => {
				if (showHelpModal && e.state?.view !== "help-modal")
					setShowHelpModal(false);
			};
			window.addEventListener("popstate", h);
			return () => window.removeEventListener("popstate", h);
		}, [showHelpModal]);
		const handleClose_HelpModal = () => {
			if (window.history.state?.view === "help-modal") window.history.back();
			else setShowHelpModal(false);
		};
		const [youtubeLink, setYoutubeLink] = useState(
			"https://www.youtube.com/watch?v=kYIIfyRk49k",
		);
		const [pendingLink, setPendingLink] = useState<{
			url: string;
			title: string;
			icon: React.ReactNode;
			colorClass: string;
		} | null>(null);
		const [darshanImages, setDarshanImages] = useState<string[]>([]);
		const [_activitiesImages, setActivitiesImages] = useState<string[]>([]);
		const [videoThumbnailImages, setVideoThumbnailImages] = useState<string[]>(
			[],
		);
		// Item ids behind each tile, newest-first. Kept separately from the image
		// URL arrays above because those drive the slideshow (and the Activities
		// tile deliberately shows none), while newness needs stable identifiers —
		// a URL changes on any re-upload, CDN move or cache-buster, which used to
		// light up NEW for every user at once.
		const [darshanIds, setDarshanIds] = useState<string[]>([]);
		const [activityIds, setActivityIds] = useState<string[]>([]);
		const [videoIds, setVideoIds] = useState<string[]>([]);
		const [pastEventIds, setPastEventIds] = useState<string[]>([]);

		const [darshanReleases, setDarshanReleases] = useState<any[]>([]);
		const [activityReleases, setActivityReleases] = useState<any[]>([]);
		const {
			dbMandals,
			dbVideos,
			dbVideoFolders,
			activityFoldersConfig,
			darshanFoldersConfig,
		} = useSharedFirebase();
		const [githubToken, setGithubToken] = useState<string | null>(null);
		const [quotesImages, setQuotesImages] = useState<string[]>([]);

		useEffect(() => {
			// Fetch dynamic youtube link
			const fetchYoutubeLink = async () => {
				try {
					const snap = await getDoc(doc(db, "app_config", "settings"));
					if (snap.exists() && snap.data().youtubeHowToUseUrl) {
						setYoutubeLink(snap.data().youtubeHowToUseUrl);
					}
				} catch (e) {
					console.warn("Could not fetch youtube link", e);
				}
			};
			fetchYoutubeLink();
		}, []);

		// Subscribe to glorification reader publish state (real-time)
		useEffect(() => {
			const unsub = onSnapshot(
				doc(db, "app-settings", "glorification-reader"),
				(snap) => {
					if (snap.exists()) {
						setGlorificationReaderPublished(snap.data()?.isPublished === true);
						setPublishedGlorificationIds(snap.data()?.publishedIds || []);
					} else {
						setGlorificationReaderPublished(false);
						setPublishedGlorificationIds([]);
					}
				},
				() => {
					setGlorificationReaderPublished(false);
					setPublishedGlorificationIds([]);
				},
			);
			return unsub;
		}, []);

		const hasUnreadGlorifications = useMemo(() => {
			if (
				!glorificationReaderPublished ||
				publishedGlorificationIds.length === 0
			)
				return false;
			try {
				const currentHash = publishedGlorificationIds.join(",");
				const storedHash = localStorage.getItem("allGlorificationsReadHash");
				return currentHash !== storedHash;
			} catch (_e) {
				return true;
			}
		}, [glorificationReaderPublished, publishedGlorificationIds]);

		// Moved quotes logic inside the main token fetch to prevent 404 console errors
		// by exactly matching the available file extensions using the GitHub API.

		// Recompute the `hasUnseen` calls below whenever any screen writes
		// seen-state. HomeScreen used to keep a private `forceRender` counter that
		// it bumped on its own writes but never dispatched the event for, so
		// clearing a badge here left a mounted ActivitiesScreen showing stale state.
		useSeenVersion();

		// Newness is derived, not stored in state. The old code mirrored it into
		// four `useState` flags via effects, which meant an extra render pass and
		// four places where the flag could fall out of sync with storage.
		const hasNewDarshan = hasUnseen("cpbs_home_darshan_latest", darshanIds);
		const hasNewActivity = hasUnseen("cpbs_home_activity_latest", activityIds);
		const hasNewVideo = hasUnseen("cpbs_home_video_latest", videoIds);
		const hasNewPastEvent = hasUnseen(
			"cpbs_activity_photos_main_latest",
			pastEventIds,
		);

		// …and cleared by actually opening the destination, not by tapping the
		// tile. Previously these three keys were written only in the tile's own
		// onClick, so arriving via the bottom nav, side menu, a push notification
		// or a deep link left the badge lit forever no matter how much the user
		// read — the badge had stopped tracking content and started tracking
		// "did you tap this particular square".
		useClearOnVisit("darshan", "cpbs_home_darshan_latest", darshanIds);
		useClearOnVisit("activities", "cpbs_home_activity_latest", activityIds);
		useClearOnVisit("videos", "cpbs_home_video_latest", videoIds);
		useClearOnVisit("photos", "cpbs_activity_photos_main_latest", pastEventIds);

		useEffect(() => {
			// Gallery mandals se latest photo ID nikalo - merging dbMandals & activityReleases (like ActivitiesScreen)
			const mergedMandalsMap = new Map<string, any>();
			const githubActivityGallery: Record<string, any[]> = {};

			activityReleases.forEach((release: any) => {
				const lowerReleaseName = release.name.toLowerCase();
				const mandalName = release.name
					.replace(/Activity Release for /i, "")
					.replace(/Release for /i, "")
					.replace(/\s*\(.*?\)\s*$/, "")
					.trim();

				const foundMandal = MANDAL_LIST.find((m) => {
					const coreName = m.name.toLowerCase().replace(" mandal", "").trim();
					const id = m.id.toLowerCase();
					return (
						lowerReleaseName.includes(coreName) || lowerReleaseName.includes(id)
					);
				});
				const mandalId = foundMandal?.id || `github-${release.id}`;
				if (!githubActivityGallery[mandalId])
					githubActivityGallery[mandalId] = [];

				release.assets.forEach((asset: any) => {
					let dateOnly = asset.created_at;
					const match = asset.name.match(/^\[(.*?)\]\[(.*?)\]\[(.*?)\]\.(.*)$/);
					if (match) {
						dateOnly = match[1];
					} else {
						const dateObj = new Date(asset.created_at);
						if (!Number.isNaN(dateObj.getTime()))
							dateOnly = toLocalDateKey(dateObj);
					}
					githubActivityGallery[mandalId].push({
						date: dateOnly,
						releaseId: release.id,
						id: asset.id.toString(),
					});
				});
				(githubActivityGallery as any)[`${mandalId}_name`] = mandalName;
			});

			MANDAL_LIST.forEach((staticMandal) => {
				const dbData = dbMandals.find((m: any) => m.id === staticMandal.id) || {
					gallery: [],
				};
				const ghGallery = githubActivityGallery[staticMandal.id] || [];
				const firestoreItems = (dbData.gallery || []).filter(
					(g: any) => g.type === "activity",
				);
				const githubSupplement = firestoreItems.length > 0 ? [] : ghGallery;

				const combined = [...firestoreItems, ...githubSupplement];
				if (combined.length > 0) {
					combined.sort((a, b) => {
						const dateDiff =
							new Date(formatForDateInput(b.date) || 0).getTime() -
							new Date(formatForDateInput(a.date) || 0).getTime();
						if (dateDiff !== 0) return dateDiff;
						if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
						return String(a.id || "").localeCompare(String(b.id || ""));
					});
					mergedMandalsMap.set(staticMandal.id, {
						name: staticMandal.name,
						gallery: combined,
					});
				}
			});

			Object.keys(githubActivityGallery).forEach((key) => {
				if (key.startsWith("github-") && !key.endsWith("_name")) {
					const name =
						(githubActivityGallery as any)[`${key}_name`] || "Activity Folder";
					const combined = githubActivityGallery[key];
					combined.sort((a: any, b: any) => {
						const dateDiff =
							new Date(formatForDateInput(b.date) || 0).getTime() -
							new Date(formatForDateInput(a.date) || 0).getTime();
						if (dateDiff !== 0) return dateDiff;
						if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
						return String(a.id || "").localeCompare(String(b.id || ""));
					});
					mergedMandalsMap.set(key, {
						name: name,
						gallery: combined,
					});
				}
			});

			// Collect ids from every "gallery" folder instead of picking one
			// `releaseId`. A GitHub releaseId is shared by every asset in that
			// release, so adding three photos to an existing release moved nothing
			// and produced no badge; and because Firestore items have no releaseId,
			// the token flipped kind the moment Firestore filled, badging everyone.
			//
			// Each folder's `gallery` is already sorted newest-first above, so take
			// the newest few from each rather than re-sorting — the badge is a
			// boolean, it only has to notice that *something* recent is unseen, and
			// capping per folder keeps one busy folder from crowding the others out
			// of the comparison window.
			const PER_FOLDER = 12;
			const photoIds: string[] = [];
			mergedMandalsMap.forEach((m) => {
				if (
					m.name?.toLowerCase().endsWith("gallery") &&
					m.gallery &&
					m.gallery.length > 0
				) {
					for (const g of m.gallery.slice(0, PER_FOLDER)) {
						if (g?.id !== undefined && g?.id !== null)
							photoIds.push(String(g.id));
					}
				}
			});
			setPastEventIds(photoIds);
		}, [dbMandals, activityReleases]);

		const handleBannerAction = (config: BannerConfig) => {
			if (config.actionType === "bhajan") {
				onOpenDeepLink(config.actionTarget || "", "bhajan");
				return;
			}

			if (config.actionType === "lecture") {
				onOpenDeepLink(config.actionTarget || "", "lecture");
				return;
			}

			if (config.actionType === "link" && config.actionTarget) {
				try {
					const url = new URL(config.actionTarget);
					if (
						url.hostname === "chaitanyaprembhakti.org" ||
						url.hostname === "www.chaitanyaprembhakti.org"
					) {
						const bhajanId = url.searchParams.get("bhajanId");
						const lectureId = url.searchParams.get("lectureId");
						if (bhajanId) {
							onOpenDeepLink(bhajanId, "bhajan");
							return;
						} else if (lectureId) {
							onOpenDeepLink(lectureId, "lecture");
							return;
						}

						const videoId = url.searchParams.get("videoId");
						const videoFolder = url.searchParams.get("videoFolder");

						// A /v/... share link: same parser as links opened in the app.
						const share = parseSharePath(url.pathname);
						if (share) {
							applyShareTargetToUrl(share);
							if (shareTargetScreen(share) === "videos") onOpenVideos();
							else onOpenActivities();
							return;
						}

						if (videoId || videoFolder) {
							const newUrl = new URL(window.location.href);
							if (videoId) newUrl.searchParams.set("videoId", videoId);
							if (videoFolder)
								newUrl.searchParams.set("videoFolder", videoFolder);
							window.history.replaceState(
								window.history.state,
								"",
								newUrl.toString(),
							);
							onOpenVideos();
							return;
						}

						// ?screen=profile etc. — open that screen in the app, not a new tab.
						const screen = url.searchParams.get("screen");
						if (screen) {
							handleBannerAction({
								...config,
								actionType: "screen",
								actionTarget: screen,
							});
							return;
						}
					}
				} catch (_e) {}
				window.open(config.actionTarget, "_blank", "noopener,noreferrer");
			} else if (config.actionType === "screen" && config.actionTarget) {
				switch (config.actionTarget) {
					case "darshan":
						onOpenDailyDarshan();
						break;
					case "activities":
						onOpenActivities();
						break;
					case "information":
						onOpenInformation();
						break;
					case "quotes":
						onOpenDailyQuotes();
						break;
					case "events":
						onOpenEvents();
						break;
					case "books":
						onNavigate("books");
						break;
					case "songs":
						onNavigate("songs");
						break;
					case "lectures":
						onNavigate("lectures");
						break;
					case "authors":
						onNavigate("authors");
						break;
					case "library":
						onNavigate("library");
						break;
					case "seva":
						onOpenSevaCenter();
						break;
					case "temple-timings":
						onOpenTempleTimings();
						break;
					case "youtube":
						onOpenYouTube();
						break;
					case "guru-maharaj":
						onOpenGuruMaharaj();
						break;
					case "virahi-maharaj":
						onOpenVirahiMaharaj();
						break;
					case "donate":
						onOpenDonate();
						break;
					case "about":
						onOpenAbout();
						break;
					case "settings":
						onOpenSettings();
						break;
					case "privacy":
						onOpenPrivacy();
						break;
					case "profile":
						onOpenProfile();
						break;
					case "videos":
						onOpenVideos();
						break;
					case "photos":
						onOpenPhotos();
						break;
					default:
						console.warn("Unknown screen target:", config.actionTarget);
						onNavigate(config.actionTarget);
				}
			}
		};

		useEffect(() => {
			let isMounted = true;

			const initTokenAndQuotes = async () => {
				try {
					const tokenDoc = shouldUseRestFallback()
						? await iosGetDoc("damtoken/github_public")
						: await getDoc(doc(db, "damtoken", "github_public"));
					const token = tokenDoc.exists()
						? tokenDoc.data()?.token?.trim()
						: null;

					if (!token || !isMounted) {
						if (!token) console.error("GitHub token not found");
						return;
					}

					if (isMounted) setGithubToken(token);

					const response = await fetch(
						`https://api.github.com/repos/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/releases/tags/1`,
						{
							headers: {
								Authorization: `token ${token}`,
								Accept: "application/vnd.github.v3+json",
							},
						},
					);

					if (!response.ok) throw new Error(`GitHub API ${response.status}`);
					const data = await response.json();
					const assets = data.assets || [];

					const today = new Date();
					const candidates: string[] = [];

					const getStaticDayOfYear = (date: Date) => {
						const month = date.getMonth();
						const day = date.getDate();
						const daysInMonth = [
							31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
						];
						let doy = 0;
						for (let i = 0; i < month; i++) doy += daysInMonth[i];
						return doy + day;
					};

					for (let i = 0; i < 5; i++) {
						const d = new Date(today);
						d.setDate(d.getDate() - i);

						const dayOfYear = getStaticDayOfYear(d);
						const dayOfYearStr = String(dayOfYear).padStart(3, "0");
						const dayOfMonth = d.getDate();
						const months = [
							"JAN",
							"FEB",
							"MAR",
							"APR",
							"MAY",
							"JUN",
							"JUL",
							"AUG",
							"SEP",
							"OCT",
							"NOV",
							"DEC",
						];
						const monthStr = months[d.getMonth()];

						const baseName = `${dayOfYearStr}.${dayOfMonth}.${monthStr}`;
						const match = assets.find((a: any) => a.name.startsWith(baseName));

						if (match) {
							candidates.push(toCdnUrl(match.browser_download_url));
						}
					}

					if (isMounted) {
						setQuotesImages(candidates);
					}
				} catch (error) {
					console.error("Error fetching token/quotes:", error);
				}
			};

			initTokenAndQuotes();

			return () => {
				isMounted = false;
			};
		}, []);

		// Darshan and Activities read the same release list (~160 KB). Share one
		// request when both ask within a few seconds instead of downloading it twice.
		const releasesRequestRef = useRef<{
			at: number;
			promise: Promise<any[]>;
		} | null>(null);

		const fetchReleaseList = (token: string): Promise<any[]> => {
			const cached = releasesRequestRef.current;
			if (cached && Date.now() - cached.at < 10000) return cached.promise;
			const promise = fetch(
				`https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?t=${Date.now()}&per_page=100`,
				{
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			).then((response) => {
				if (!response.ok) throw new Error(`GitHub API ${response.status}`);
				return response.json();
			});
			releasesRequestRef.current = { at: Date.now(), promise };
			// A failed request must not be reused by the next caller.
			promise.catch(() => {
				if (releasesRequestRef.current?.promise === promise)
					releasesRequestRef.current = null;
			});
			return promise;
		};

		const fetchFromGitHub = async (
			visibleIds: number[],
			type: "darshan" | "activity",
			token: string,
		) => {
			try {
				const releases: any[] = await fetchReleaseList(token);

				const filteredReleases = releases.filter((r) =>
					visibleIds.includes(r.id),
				);

				if (type === "darshan") {
					setDarshanReleases(filteredReleases);
				} else {
					setActivityReleases(filteredReleases);
				}
			} catch (err) {
				console.error(`Error fetching ${type} from GitHub:`, err);
			}
		};

		// biome-ignore lint/correctness/useExhaustiveDependencies: fetchFromGitHub is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
		useEffect(() => {
			if (!githubToken || !darshanFoldersConfig) return;
			const visibleIds: number[] = darshanFoldersConfig.visibleIds || [];
			fetchFromGitHub(visibleIds, "darshan", githubToken);
		}, [githubToken, darshanFoldersConfig]);

		// biome-ignore lint/correctness/useExhaustiveDependencies: fetchFromGitHub is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
		useEffect(() => {
			if (!githubToken || !activityFoldersConfig) return;
			const visibleIds: number[] = activityFoldersConfig.visibleIds || [];
			fetchFromGitHub(visibleIds, "activity", githubToken);
		}, [githubToken, activityFoldersConfig]);

		// Merge darshan sources
		useEffect(() => {
			const uniqueUrls = new Set<string>();
			const allItems: {
				id: string;
				url: string;
				date: string;
				order: number;
			}[] = [];

			// Add from Firestore first
			dbMandals.forEach((m) => {
				(m.gallery || []).forEach((g: any) => {
					if (g.type === "darshan") {
						if (!uniqueUrls.has(g.url)) {
							uniqueUrls.add(g.url);
							allItems.push({
								id: String(g.id ?? g.url),
								url: g.url,
								date: g.date,
								order: g.order || 0,
							});
						}
					}
				});
			});

			// Add from GitHub
			darshanReleases.forEach((release) => {
				release.assets.forEach((asset: any) => {
					const url = asset.browser_download_url;
					if (!uniqueUrls.has(url)) {
						uniqueUrls.add(url);
						let dateOnly = asset.created_at;
						let order = 0;
						const match = asset.name.match(
							/^\[(.*?)\]\[(.*?)\]\[(.*?)\]\.(.*)$/,
						);
						if (match) {
							dateOnly = match[1];
							order = parseInt(match[2], 10) || 0;
						} else {
							const dateObj = new Date(asset.created_at);
							if (!Number.isNaN(dateObj.getTime()))
								dateOnly = toLocalDateKey(dateObj);
						}
						// Per-asset id, not release.id — a release id is shared by all
						// its assets, which is what made new photos invisible before.
						allItems.push({
							id: String(asset.id ?? url),
							url,
							date: dateOnly,
							order,
						});
					}
				});
			});

			allItems.sort((a, b) => {
				const dateDiff =
					new Date(formatForDateInput(b.date)).getTime() -
					new Date(formatForDateInput(a.date)).getTime();
				if (dateDiff !== 0) return dateDiff;
				return a.order - b.order;
			});

			setDarshanImages(allItems.map((i) => i.url).slice(0, 5));
			setDarshanIds(allItems.map((i) => i.id).slice(0, NEWNESS_WINDOW));
		}, [darshanReleases, dbMandals]);

		// Merge activity sources
		useEffect(() => {
			const uniqueUrls = new Set<string>();
			const allItems: {
				id: string;
				url: string;
				date: string;
				order: number;
			}[] = [];

			// Add from Firestore first
			dbMandals.forEach((m) => {
				(m.gallery || []).forEach((g: any) => {
					if (g.type === "activity") {
						if (!uniqueUrls.has(g.url)) {
							uniqueUrls.add(g.url);
							allItems.push({
								id: String(g.id ?? g.url),
								url: g.url,
								date: g.date,
								order: g.order || 0,
							});
						}
					}
				});
			});

			// Add from GitHub
			activityReleases.forEach((release) => {
				release.assets.forEach((asset: any) => {
					const url = asset.browser_download_url;
					if (!uniqueUrls.has(url)) {
						uniqueUrls.add(url);
						let dateOnly = asset.created_at;
						let order = 0;
						const match = asset.name.match(
							/^\[(.*?)\]\[(.*?)\]\[(.*?)\]\.(.*)$/,
						);
						if (match) {
							dateOnly = match[1];
							order = parseInt(match[2], 10) || 0;
						} else {
							const dateObj = new Date(asset.created_at);
							if (!Number.isNaN(dateObj.getTime()))
								dateOnly = toLocalDateKey(dateObj);
						}
						allItems.push({
							id: String(asset.id ?? url),
							url,
							date: dateOnly,
							order,
						});
					}
				});
			});

			allItems.sort((a, b) => {
				const dateDiff =
					new Date(formatForDateInput(b.date)).getTime() -
					new Date(formatForDateInput(a.date)).getTime();
				if (dateDiff !== 0) return dateDiff;
				return a.order - b.order;
			});

			// `.reverse()` here is deliberate and display-only: it feeds the
			// slideshow, which wants oldest→newest. It used to feed the NEW badge
			// too, which read index 0 as "the latest thing" — so index 0 was the
			// *oldest* of the newest five, and because prepending can never change
			// the last element of a ≤5 item list, the Activities badge simply never
			// fired. Newness now reads the unreversed ids below.
			setActivitiesImages(
				allItems
					.map((i) => i.url)
					.slice(0, 5)
					.reverse(),
			);
			setActivityIds(allItems.map((i) => i.id).slice(0, NEWNESS_WINDOW));
		}, [activityReleases, dbMandals]);

		// Merge video thumbnails
		useEffect(() => {
			const uniqueUrls = new Set<string>();
			const allItems: {
				id: string;
				url: string;
				date: string;
				order: number;
			}[] = [];

			const getYouTubeVideoId = (url: string) => {
				const regExp =
					/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/;
				const match = url.match(regExp);
				return match ? match[1] : null;
			};

			const getThumbnailUrl = (video: any) => {
				if (!video.useDefaultThumbnail && video.thumbnailUrl)
					return video.thumbnailUrl;
				const ytId = getYouTubeVideoId(video.url || "");
				if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
				return null;
			};

			let allowedVideos = dbVideos;
			if (dbVideoFolders.length > 0) {
				const sortedFolders = [...dbVideoFolders].sort(
					(a, b) => (a.order || 0) - (b.order || 0),
				);
				const firstTwoFolderIds = sortedFolders.slice(0, 2).map((f) => f.id);
				allowedVideos = dbVideos.filter((v) =>
					firstTwoFolderIds.includes(v.folderId),
				);
			}

			allowedVideos.forEach((v) => {
				const thumb = getThumbnailUrl(v);
				if (thumb && !uniqueUrls.has(thumb)) {
					uniqueUrls.add(thumb);
					allItems.push({
						id: String(v.id ?? thumb),
						url: thumb,
						date: v.date || "",
						order: v.order || 0,
					});
				}
			});

			allItems.sort((a, b) => {
				const dateDiff =
					new Date(formatForDateInput(b.date)).getTime() -
					new Date(formatForDateInput(a.date)).getTime();
				if (dateDiff !== 0) return dateDiff;
				return a.order - b.order;
			});

			setVideoThumbnailImages(allItems.map((i) => i.url).slice(0, 5));
			setVideoIds(allItems.map((i) => i.id).slice(0, NEWNESS_WINDOW));
		}, [dbVideos, dbVideoFolders]);

		const t = {
			dailyDarshan: isHindi ? "ठाकुर जी के दर्शन" : "Deity Darshan",
			dailyQuotes: isHindi ? "नित्य वाणी" : "Daily Quotes",
			vaishnavCalendar: isHindi ? "वैष्णव कैलेंडर" : "Vaishnav Calendar",
			ourCenters: isHindi ? "हमारे केंद्र" : "Our Centers",
			donate: isHindi ? "सहयोग करें" : "Donate",
			dailyInfo: isHindi ? "दैनिक जानकारी" : "Daily Information",
			youtube: isHindi ? "यूट्यूब" : "YouTube",
			instagram: isHindi ? "इंस्टाग्राम" : "Instagram",
			facebook: isHindi ? "फेसबुक" : "Facebook",
			bhajans: isHindi ? "भजन सूची" : "Bhajan List",
			howToUse: isHindi ? "ऐप कैसे उपयोग करें" : "How to Use App",
			aboutUs: isHindi ? "परिचय (About)" : "About Us",
			appTour: isHindi ? "ऐप टूर" : "App Tour",
			tourDesc: isHindi ? "चरण-दर-चरण मार्गदर्शन" : "Step-by-step guide",
			introSlides: isHindi ? "परिचय स्लाइड्स" : "Intro Slides",
			introSlidesDesc: isHindi
				? "शुरुआती परिचय फिर से देखें"
				: "See the welcome slides again",
			watchVideo: isHindi ? "वीडियो डेमो देखें" : "Watch Video Demo",
			videoDesc: isHindi ? "यूट्यूब पर वीडियो देखें" : "Watch on YouTube",
			helpTitle: isHindi ? "सहायता / हेल्प" : "Help & Guide",
			openLink: isHindi ? "लिंक खोलें?" : "Open Link?",
			linkDesc: isHindi
				? "आप ऐप से बाहर जा रहे हैं:"
				: "You are leaving the app to visit:",
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
			comingSoon: isHindi ? "जल्द आ रहा है" : "Coming Soon",
			cancel: isHindi ? "रद्द करें" : "Cancel",
			open: isHindi ? "खोलें" : "Open",
		};

		const handleShareApp = async () => {
			triggerHaptic("light");
			await shareAppContent(
				{
					title: "Shree Chaitanya Prem Bhakti Sangh",
					text: "Download the Prem Bhakti app & visit our website:\nhttps://chaitanyaprembhakti.org",
					url: "",
					dialogTitle: "Share with friends",
				},
				() => {
					showToast(
						settingsLanguage === "en"
							? "Link copied to clipboard!"
							: "लिंक कॉपी हो गया!",
					);
				},
			);
		};

		const handlePress = (action: () => void) => {
			triggerHaptic("light");
			action();
		};

		const _handleComingSoon = () => {
			triggerHaptic("light");
			showToast(t.comingSoon, "info");
		};

		const handleSocialClick = (
			url: string,
			title: string,
			icon: React.ReactNode,
			colorClass: string,
		) => {
			triggerHaptic("light");
			setPendingLink({ url, title, icon, colorClass });
		};

		const confirmNavigation = () => {
			if (pendingLink) {
				window.open(pendingLink.url, "_blank", "noopener,noreferrer");
				setPendingLink(null);
			}
		};

		// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_HelpModal is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
		useEffect(() => {
			if (showHelpModal) {
				const stateId = `help-modal-${Date.now()}`;
				window.history.pushState({ isPopup: true, modalId: stateId }, "");
				const handlePopState = () => handleClose_HelpModal();
				window.addEventListener("popstate", handlePopState);
				return () => {
					window.removeEventListener("popstate", handlePopState);
					if (window.history.state?.modalId === stateId) window.history.back();
				};
			}
		}, [showHelpModal]);

		useEffect(() => {
			if (pendingLink) {
				const stateId = `link-modal-${Date.now()}`;
				window.history.pushState({ isPopup: true, modalId: stateId }, "");
				const handlePopState = () => setPendingLink(null);
				window.addEventListener("popstate", handlePopState);
				return () => {
					window.removeEventListener("popstate", handlePopState);
					if (window.history.state?.modalId === stateId) window.history.back();
				};
			}
		}, [pendingLink]);

		return (
			<div className="relative min-h-full overflow-hidden">
				{/*
				 * Dawn wash — warm light entering from the top of the page.
				 *
				 * The screen used to begin cold: paper, then straight into a
				 * carousel. Janmashtami's morning is the counterpart to the
				 * splash's midnight, so the page opens with lamplight spilling
				 * down from the header instead.
				 *
				 * A gradient rather than another ornament: the home screen is
				 * already the busiest surface in the app, and what it was short of
				 * was atmosphere, not furniture. This adds one composited layer,
				 * no DOM below it, and reads in both themes — warm daylight on
				 * cream, temple lamplight on ink.
				 */}
				<div
					className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72"
					aria-hidden="true"
					style={{
						background:
							"radial-gradient(125% 100% at 50% 0%, rgba(255, 213, 79, 0.20) 0%, rgba(255, 213, 79, 0.07) 45%, transparent 78%)",
					}}
				/>

				{/* Ambient festival sparkles — soft gold motes, opacity-only twinkle.
				    `jm-ambient` wires this into the global prefers-reduced-motion
				    kill-switch in tokens.css, which removes it outright. */}
				<div
					className="jm-ambient absolute inset-0 pointer-events-none z-0 overflow-hidden"
					aria-hidden="true"
				>
					{[...Array(15)].map((_, i) => (
						<div
							key={i}
							className="absolute w-1.5 h-1.5 md:w-2 md:h-2 bg-gold-300/60 rounded-full shadow-[0_0_8px_rgba(255,213,79,0.7)] animate-twinkling-stars blur-[1px]"
							style={{
								left: `${Math.random() * 100}%`,
								animationDelay: `${Math.random() * 10}s`,
								animationDuration: `${10 + Math.random() * 15}s`,
							}}
						/>
					))}
				</div>

				{/* Desktop / landscape header: the phone app bar (royal blue, gold
				    lockup) as a bar above the cards, with Profile & Settings on the
				    right. No menu button — the side menu is always open here. It
				    sits in the flow, so it never covers the first card. */}
				<div className="hidden landscape:block relative z-20 px-3 pt-4">
					<div className="relative max-w-5xl mx-auto h-16 rounded-jm-panel bg-jm-royal shadow-jm-header grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
						{/* Gold hairline rule along the base, as on the phone header. */}
						<div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-jm-rule opacity-70" />
						{/* Empty first column balances the buttons so the logo stays
						    centred, and the grid keeps them from overlapping. */}
						<div />
						<HeaderLogo />
						<div className="flex items-center justify-end gap-1">
							<DesktopProfileButton
								isHindi={isHindi}
								onOpenProfile={onOpenProfile}
							/>
							<button
								type="button"
								onClick={() => {
									triggerHaptic("light");
									onOpenSettings();
								}}
								className="inline-flex items-center justify-center min-h-touch min-w-touch text-cream-50 hover:text-gold-300 hover:bg-cream-50/10 rounded-full transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
								title={isHindi ? "सेटिंग्स" : "Settings"}
								aria-label={isHindi ? "सेटिंग्स" : "Settings"}
								data-tour="header-settings"
							>
								<Settings
									size={24}
									strokeWidth={2}
									className="group-hover:rotate-45 transition-transform duration-500"
								/>
							</button>
						</div>
					</div>
				</div>

				<div className="relative z-10 pb-4 pt-2 px-3 space-y-5">
					{/* Profile sent back for changes / family link requests — first
					    thing on Home, only while there is something to do. */}
					<ProfileNoticeBanner
						isHindi={isHindi}
						onOpenProfile={onOpenProfile}
					/>

					{/* Aavirbhav Mahotsav Glorification Section */}
					<div
						className="w-full max-w-5xl mx-auto stagger-item"
						style={{ animationDelay: "80ms" }}
						data-tour="home-aavirbhav"
					>
						<AavirbhavMahotsavSection
							settingsLanguage={sharedGlorificationLang}
							onToggleLanguage={() =>
								setSharedGlorificationLang((prev) =>
									prev === "hi" ? "en" : "hi",
								)
							}
							onWriteClick={() => {
								triggerHaptic("light");
								setShowGlorificationModal(true);
							}}
							showReadAll={glorificationReaderPublished}
							hasUnreadGlorifications={hasUnreadGlorifications}
							onReadAllClick={() => {
								triggerHaptic("light");
								setShowGlorificationReader(true);
							}}
						/>
					</div>

					{/* Hero Carousel Section */}
					<div
						className="w-full relative max-w-5xl mx-auto stagger-item"
						style={{ animationDelay: "100ms" }}
						data-tour="home-hero"
					>
						<HeroCarousel
							onOpenGuruMaharaj={onOpenGuruMaharaj}
							onOpenVirahiMaharaj={onOpenVirahiMaharaj}
							onOpenInformation={onOpenInformation}
							settingsLanguage={settingsLanguage}
						/>
					</div>

					{/* Diksha anniversaries today — empty (and hidden) on other days */}
					<div
						className="w-full max-w-5xl mx-auto stagger-item empty:hidden"
						style={{ animationDelay: "150ms" }}
					>
						<DikshaAnniversaryCard isHindi={settingsLanguage === "hi"} />
					</div>

					<div
						className="stagger-item"
						style={{ animationDelay: "200ms" }}
						data-tour="home-banner"
					>
						<BannerContainer
							onAction={handleBannerAction}
							isActive={isActive}
						/>
					</div>

					{/* ... (rest of HomeScreen JSX) */}

					{/* Main Grid Navigation */}
					<div
						className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-7xl mx-auto stagger-container mt-6 mb-8"
						style={{ "--base-delay": "300ms" } as React.CSSProperties}
						data-tour="home-grid"
					>
						{/* 1. Our Activities */}
						<SlideshowCard
							title={t.ourActivities}
							tourId="home-activities"
							imageUrls={[]}
							fallbackImageUrl={
								darkMode ? OUR_ACTIVITIES_ICON_DARK : OUR_ACTIVITIES_ICON
							}
							hasNewUpdate={hasNewActivity}
							onClick={() => handlePress(onOpenActivities)}
						/>

						{/* 2. Darshan & Gallery */}
						<SlideshowCard
							title={t.dailyDarshan}
							tourId="home-darshan"
							imageUrls={darshanImages}
							fallbackImageUrl={GALLERY_ICON}
							hasNewUpdate={hasNewDarshan}
							onClick={() => handlePress(onOpenDailyDarshan)}
						/>

						{/* 3. Vaishnav Calendar */}
						<GlassCard
							title={t.vaishnavCalendar}
							tourId="home-calendar"
							icon={<CustomCalendarIcon size={96} />}
							onClick={() => handlePress(onOpenEvents)}
						/>

						{/* 4. Donate */}
						<GlassCard
							title={t.donate}
							icon={<CustomDonateIcon size={96} />}
							onClick={() => handlePress(onOpenDonate)}
						/>

						{/* 5. Daily Quotes */}
						<SlideshowCard
							title={t.dailyQuotes}
							tourId="home-quotes"
							imageUrls={quotesImages}
							fallbackImageUrl={
								darkMode ? DAILY_INFO_ICON_DARK : DAILY_INFO_ICON
							}
							onClick={() => handlePress(onOpenDailyQuotes)}
						/>

						{/* 6. Videos */}
						<SlideshowCard
							title={t.videos}
							tourId="home-videos"
							imageUrls={videoThumbnailImages}
							fallbackIcon={<CustomVideoIcon size={96} />}
							hasNewUpdate={hasNewVideo}
							onClick={() => handlePress(onOpenVideos)}
						/>

						{/* 7. Past Event Media */}
						<ImageCard
							title={t.pastEventMedia}
							tourId="home-photos"
							imageUrl={PHOTOS_ICON}
							hasNewUpdate={hasNewPastEvent}
							onClick={() => handlePress(onOpenPhotos)}
						/>

						{/* 8. Our Centers */}
						<GlassCard
							title={t.ourCenters}
							tourId="home-centres"
							icon={<CustomCentersIcon size={96} />}
							onClick={() => handlePress(onOpenSevaCenter)}
						/>

						{/* 9. Bhajans */}
						<GlassCard
							title={t.bhajans}
							icon={<CustomBhajanIcon size={96} />}
							onClick={() => handlePress(onOpenBhajanList)}
						/>

						{/* 10. Audios */}
						<GlassCard
							title={t.audios}
							icon={<CustomAudiosIcon size={96} />}
							onClick={() => handlePress(() => onNavigate("lectures"))}
						/>

						{/* 11. Books */}
						<GlassCard
							title={t.books}
							icon={<CustomBooksIcon size={96} />}
							onClick={() => handlePress(() => onNavigate("books"))}
						/>

						{/* 12. Authors and History */}
						<GlassCard
							title={t.historyAuthors}
							icon={<CustomHistoryIcon size={96} />}
							onClick={() => handlePress(() => onNavigate("library"))}
						/>

						{/* 13. Devotee Profile */}
						<GlassCard
							title={t.profile}
							icon={<CustomProfileIcon size={96} />}
							onClick={() => handlePress(onOpenProfile)}
						/>

						{/* 14. Information */}
						<GlassCard
							title={t.information}
							tourId="home-information"
							icon={<CustomInfoIcon size={96} />}
							onClick={() => handlePress(onOpenInformation)}
							hasNewUpdate={hasNewInformation}
						/>

						{/* 15. Youtube */}
						<GlassCard
							title={t.youtube}
							tourId="home-social"
							icon={<CustomYouTubeIcon size={96} />}
							isLive={socialMediaStatus.isYoutubeLive}
							onClick={() => {
								if (
									socialMediaStatus.isYoutubeLive &&
									socialMediaStatus.youtubeLiveLink
								) {
									handleSocialClick(
										socialMediaStatus.youtubeLiveLink,
										t.youtube,
										<Youtube size={24} />,
										"bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
									);
								} else {
									handlePress(onOpenYouTube);
								}
							}}
						/>

						{/* 16. Instagram */}
						<GlassCard
							title={t.instagram}
							icon={<CustomInstagramIcon size={96} />}
							isLive={socialMediaStatus.isInstagramLive}
							onClick={() => {
								if (
									socialMediaStatus.isInstagramLive &&
									socialMediaStatus.instagramLiveLink
								) {
									handleSocialClick(
										socialMediaStatus.instagramLiveLink,
										t.instagram,
										<Instagram size={24} />,
										"bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
									);
								} else {
									handlePress(onOpenInstagram);
								}
							}}
						/>

						{/* 17. Facebook */}
						<GlassCard
							title={t.facebook}
							icon={<CustomFacebookIcon size={96} />}
							isLive={socialMediaStatus.isFacebookLive}
							onClick={() => {
								if (
									socialMediaStatus.isFacebookLive &&
									socialMediaStatus.facebookLiveLink
								) {
									handleSocialClick(
										socialMediaStatus.facebookLiveLink,
										t.facebook,
										<Facebook size={24} />,
										"bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
									);
								} else {
									handlePress(onOpenFacebook);
								}
							}}
						/>

						{/* 18. Temple Timing */}
						<GlassCard
							title={t.templeTiming}
							icon={<CustomTimingIcon size={96} />}
							onClick={() => handlePress(onOpenTempleTimings)}
						/>

						{/* 19. Share App */}
						<GlassCard
							title={t.shareApp}
							icon={<CustomShareIcon size={96} />}
							onClick={handleShareApp}
						/>

						{/* 20. Downloads */}
						<GlassCard
							title={t.downloads}
							tourId="home-downloads"
							icon={<CustomDownloadIcon size={96} />}
							onClick={() => handlePress(() => onNavigate("downloads"))}
						/>

						{/* 21. Settings */}
						<GlassCard
							title={t.settings}
							icon={<CustomSettingsIcon size={96} />}
							onClick={() => handlePress(onOpenSettings)}
						/>

						{/* 22. Feedback */}
						<GlassCard
							title={t.feedback}
							icon={<CustomFeedbackIcon size={96} />}
							onClick={() => handlePress(() => setShowFeedbackModal(true))}
						/>

						{/* 23. How to Use */}
						<GlassCard
							title={t.howToUse}
							icon={<CustomHelpIcon size={96} />}
							onClick={() => handlePress(() => setShowHelpModal(true))}
							tourId="home-help"
						/>

						{/* 24. About Us */}
						<GlassCard
							title={t.aboutUs}
							icon={<CustomAboutIcon size={96} />}
							onClick={() => handlePress(onOpenAbout)}
						/>
					</div>

					{/* App Sevak Section */}
					<div
						className={`${card.featured} mt-8 mb-4 max-w-7xl mx-auto p-6 text-center stagger-item`}
						style={{ animationDelay: "800ms" }}
					>
						<SectionHeader
							title={isHindi ? "ऐप सेवक (App Sevak)" : "App Sevak"}
							hindi={isHindi}
						/>
						<p className="-mt-2 mb-4 font-decorative text-jm-body text-ink-600 dark:text-cream-100/80">
							{settingsLanguage === "hi"
								? "परमपूज्य वर्तमान आचार्य जी महाराज जी की आज्ञा से"
								: "By the order of Acharya Ji Maharaj Ji"}
						</p>
						<div className="flex flex-wrap justify-center gap-2.5 mt-4">
							{[
								{
									en: "Narayan Prabhuji (Naman Prabhuji)",
									hi: "नारायण प्रभुजी (नमन प्रभुजी)",
								},
								{ en: "Raj Roop Prabhuji (Kota)", hi: "राज रूप प्रभुजी (कोटा)" },
								{
									en: "Shreenath Prabhuji (Damoh)",
									hi: "श्रीनाथ प्रभुजी (दमोह)",
								},
								{
									en: "Lalit Krishna Prabhuji (Lucky Prabhuji)",
									hi: "ललित कृष्ण प्रभुजी (लकी प्रभुजी)",
								},
								{
									en: "Gourang Prabhuji (Bassi Prabhuji Khurai)",
									hi: "गौरांग प्रभुजी (बस्सी प्रभुजी खुरई)",
								},
								{ en: "Ram Prabhuji (Bhopal)", hi: "राम प्रभुजी (भोपाल)" },
								{
									en: "Vishambhar Prabhuji (Bhopal)",
									hi: "विशम्भर प्रभुजी (भोपाल)",
								},
								{ en: "Adwait Prabhuji (Bhopal)", hi: "अद्वैत प्रभुजी (भोपाल)" },
								{ en: "Harsh Prabhuji (Jabalpur)", hi: "हर्ष प्रभुजी (जबलपुर)" },
								{ en: "Niketan Prabhuji (Indore)", hi: "निकेतन प्रभुजी (इन्दौर)" },
								{ en: "Manjari Mataji (Bhopal)", hi: "मंजरी माताजी (भोपाल)" },
								{ en: "Giriraj Prabhuji (Sagar)", hi: "गिरिराज प्रभुजी (सागर)" },
								{ en: "Divyansh Prabhuji (Khurai)", hi: "दिव्यांश प्रभुजी (खुरई)" },
								{ en: "Sanatan Prabhuji (Datia)", hi: "सनातन प्रभुजी (दतिया)" },
								{ en: "Raghunath Prabhuji (Kota)", hi: "रघुनाथ प्रभुजी (कोटा)" },
								{
									en: "Pradumya Prabhuji (Gesabaad)",
									hi: "प्रदुम्य प्रभुजी (गेसाबाद)",
								},
								{ en: "Raghav Prabhuji (Harrai)", hi: "राघव प्रभुजी (हर्रई)" },
								{
									en: "Shyam Sundar Prabhuji (Damoh)",
									hi: "श्याम सुंदर प्रभुजी (दमोह)",
								},
								{
									en: "Bhaskar Prabhuji (Gesabaad)",
									hi: "भास्कर प्रभुजी (गेसाबाद)",
								},
								{ en: "Ayush Prabhuji (Damoh)", hi: "आयुष प्रभुजी (दमोह)" },
							].map((sevak, i) => (
								<span
									key={i}
									className={`${chip.gold} rounded-full px-3 py-1.5 transition-colors hover:bg-gold-200 dark:hover:bg-gold-300/20`}
								>
									{settingsLanguage === "hi" ? sevak.hi : sevak.en}
								</span>
							))}
						</div>
						<p className="mt-5 font-body text-jm-caption text-ink-500 dark:text-ink-300">
							{settingsLanguage === "hi"
								? "बाकी जानकारी बाद में अपडेट की जाएगी कि किसका क्या योगदान है।"
								: "Details regarding individual contributions will be updated later."}
						</p>
					</div>

					{/* OAuth Verification Footer */}
					<div
						className={`${card.featured} mt-8 mb-4 max-w-7xl mx-auto p-6 text-center stagger-item`}
						style={{ animationDelay: "800ms" }}
					>
						<LotusCorner
							className={ornamentClass.cornerBR}
							size={ornamentSize.corner}
						/>
						<h2 className="font-display text-jm-h1 font-semibold text-gold-700 dark:text-gold-300 mb-3">
							Prem Bhakti
						</h2>
						<p className="text-ink-700 dark:text-cream-100/80 font-body text-jm-body md:text-jm-body-lg max-w-3xl mx-auto leading-relaxed">
							{settingsLanguage === "hi" ? (
								<>
									आधिकारिक <strong>प्रेम भक्ति</strong> एप्लिकेशन में आपका स्वागत है। इस
									ऐप का उद्देश्य हमारे आध्यात्मिक समुदाय को दैनिक दर्शन, भक्ति भजन,
									आध्यात्मिक साहित्य, कीर्तन और लाइव कार्यक्रमों की समय-सारणी तक आसान
									पहुँच प्रदान करना है। हमारा लक्ष्य आध्यात्मिक जुड़ाव को गहरा करना और
									भक्ति के लिए आवश्यक सभी संसाधन एक ही स्थान पर प्रदान करना है।
								</>
							) : (
								<>
									Welcome to the official <strong>Prem Bhakti</strong>{" "}
									application. The purpose of this app is to provide our
									spiritual community with easy access to daily darshan,
									devotional bhajans, spiritual literature, kirtans, and live
									event schedules. Our mission is to facilitate a deeper
									spiritual connection and provide all necessary resources for
									devotion in one place.
								</>
							)}
						</p>

						<div className="mt-6 flex justify-center">
							<button
								onClick={() => {
									triggerHaptic("light");
									setShowFeedbackModal(true);
								}}
								className={`${button.royal} ${button.base}`}
							>
								<MessageCircle size={20} />
								{settingsLanguage === "hi"
									? "संपर्क करें (Contact Us)"
									: "Contact Us"}
							</button>
						</div>
					</div>
				</div>

				{/* Modals omitted for brevity, keeping original modal code intact */}
				{showHelpModal &&
					createPortal(
						<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-krishna-950/70 backdrop-blur-sm animate-in fade-in duration-200">
							<div
								className={`${card.modal} w-full max-w-xs p-6 animate-jm-scale-in`}
							>
								<button
									onClick={() => handleClose_HelpModal()}
									aria-label={isHindi ? "बंद करें" : "Close"}
									className="absolute top-3 right-3 min-h-touch min-w-touch inline-flex items-center justify-center rounded-full text-ink-400 hover:text-gold-600 hover:bg-gold-100/60 dark:hover:bg-ink-700 transition-colors"
								>
									<X size={20} />
								</button>
								<h3 className="font-heading text-jm-h3 text-gold-700 dark:text-gold-300 mb-6 text-center">
									{t.howToUse}
								</h3>

								<div className="space-y-4">
									{/* Guided tour: resets every chapter and starts again on Home. */}
									<button
										onClick={() => {
											handleClose_HelpModal();
											requestTourReplay();
										}}
										className="w-full min-h-touch flex items-center gap-4 p-4 bg-cream-25 dark:bg-ink-900 rounded-jm-md border border-gold-200/70 hover:border-gold-400 transition-all group active:scale-[0.98] shadow-jm-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
									>
										<div className="w-12 h-12 rounded-full bg-gold-100 dark:bg-gold-300/10 flex items-center justify-center text-gold-700 dark:text-gold-300 group-hover:scale-110 transition-transform">
											<Compass size={24} />
										</div>
										<div className="text-left">
											<h4 className="font-heading text-jm-h4 text-ink-900 dark:text-cream-50 group-hover:text-gold-700 dark:group-hover:text-gold-300 transition-colors">
												{t.appTour}
											</h4>
											<p className="font-body text-jm-caption text-ink-500 dark:text-ink-300">
												{t.tourDesc}
											</p>
										</div>
									</button>

									<button
										onClick={() => {
											handleClose_HelpModal();
											onOpenOnboarding();
										}}
										className="w-full min-h-touch flex items-center gap-4 p-4 bg-cream-25 dark:bg-ink-900 rounded-jm-md border border-gold-200/70 hover:border-gold-400 transition-all group active:scale-[0.98] shadow-jm-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
									>
										<div className="w-12 h-12 rounded-full bg-gold-100 dark:bg-gold-300/10 flex items-center justify-center text-gold-700 dark:text-gold-300 group-hover:scale-110 transition-transform">
											<Smartphone size={24} />
										</div>
										<div className="text-left">
											<h4 className="font-heading text-jm-h4 text-ink-900 dark:text-cream-50 group-hover:text-gold-700 dark:group-hover:text-gold-300 transition-colors">
												{t.introSlides}
											</h4>
											<p className="font-body text-jm-caption text-ink-500 dark:text-ink-300">
												{t.introSlidesDesc}
											</p>
										</div>
									</button>

									<button
										onClick={() => {
											window.open(youtubeLink, "_blank", "noopener,noreferrer");
										}}
										className="w-full min-h-touch flex items-center gap-4 p-4 bg-cream-25 dark:bg-ink-900 rounded-jm-md border border-gold-200/70 hover:border-error transition-all group active:scale-[0.98] shadow-jm-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
									>
										<div className="w-12 h-12 rounded-full bg-error-soft dark:bg-error/20 flex items-center justify-center text-error group-hover:scale-110 transition-transform">
											<Play size={24} className="ml-1" />
										</div>
										<div className="text-left">
											<h4 className="font-heading text-jm-h4 text-ink-900 dark:text-cream-50 group-hover:text-error transition-colors">
												{t.watchVideo}
											</h4>
											<p className="font-body text-jm-caption text-ink-500 dark:text-ink-300">
												{t.videoDesc}
											</p>
										</div>
									</button>
								</div>
							</div>
						</div>,
						document.body,
					)}

				<FeedbackModal
					isOpen={showFeedbackModal}
					onClose={() => setShowFeedbackModal(false)}
					settingsLanguage={settingsLanguage}
				/>

				<GlorificationModal
					isOpen={showGlorificationModal}
					onClose={() => setShowGlorificationModal(false)}
					settingsLanguage={sharedGlorificationLang}
					onSuccess={() => {
						setShowGlorificationModal(false);
						setShowGlorificationThankYou(true);
					}}
					onOpenProfile={onOpenProfile}
				/>

				<ThankYouPopup
					isOpen={showGlorificationThankYou}
					onClose={() => setShowGlorificationThankYou(false)}
					settingsLanguage={settingsLanguage}
				/>

				<GlorificationReaderScreen
					isOpen={showGlorificationReader}
					onClose={() => setShowGlorificationReader(false)}
					settingsLanguage={settingsLanguage}
				/>

				{pendingLink &&
					createPortal(
						<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-krishna-950/70 backdrop-blur-sm animate-in fade-in duration-200">
							<div
								className={`${card.modal} w-full max-w-xs p-6 animate-jm-scale-in`}
							>
								<div className="flex flex-col items-center text-center">
									<div
										className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 ${pendingLink.colorClass} shadow-inner`}
									>
										{pendingLink.icon}
									</div>
									<h3 className="font-heading text-jm-h3 text-ink-900 dark:text-cream-50 mb-2">
										{t.openLink}
									</h3>
									<p className="font-body text-jm-body-sm text-ink-600 dark:text-ink-300 mb-8">
										{t.linkDesc} <br />
										<strong className="font-heading text-jm-h4 text-ink-900 dark:text-cream-50 mt-1 block">
											{pendingLink.title}
										</strong>
									</p>
									<div className="flex gap-3 w-full">
										<button
											onClick={() => setPendingLink(null)}
											className="flex-1 min-h-touch rounded-full font-body font-semibold text-ink-600 dark:text-ink-200 bg-ink-100 dark:bg-ink-700 hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
										>
											{t.cancel}
										</button>
										<button
											onClick={confirmNavigation}
											className="flex-1 min-h-touch rounded-full font-body font-semibold text-cream-50 bg-gradient-to-b from-krishna-500 to-krishna-600 border border-krishna-700 hover:shadow-jm-md transition-all active:scale-95 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 dark:focus-visible:ring-offset-ink-800"
										>
											{t.open} <ExternalLink size={16} />
										</button>
									</div>
								</div>
							</div>
						</div>,
						document.body,
					)}
			</div>
		);
	},
);

// --- Components ---

interface SlideData {
	url: string;
	type: "guru" | "virahi";
}

const HeroCarousel = ({
	onOpenGuruMaharaj,
	onOpenVirahiMaharaj,
	onOpenInformation,
	settingsLanguage,
}: {
	onOpenGuruMaharaj: () => void;
	onOpenVirahiMaharaj: () => void;
	onOpenInformation: () => void;
	settingsLanguage: "en" | "hi";
}) => {
	const isHindi = settingsLanguage === "hi";
	const [currentIndex, setCurrentIndex] = useState(0);
	const [slides, _setSlides] = useState<SlideData[]>([
		{ url: "/222.webp?v=2", type: "guru" },
		{ url: "/444.webp?v=2", type: "virahi" },
	]);

	const getLabel = (type: "guru" | "virahi") => {
		if (type === "guru") return isHindi ? "गुरु महाराज जी" : "Guru MaharajG";
		return isHindi ? "विरही जी महाराज" : "Virahi Ji Maharaj";
	};

	const touchStart = React.useRef({ x: 0, y: 0 });
	const touchEnd = React.useRef({ x: 0, y: 0 });

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const timer = setTimeout(() => {
			setCurrentIndex((prev) => (prev + 1) % slides.length);
		}, 4000);
		return () => clearTimeout(timer);
	}, [slides, currentIndex]);

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStart.current = {
			x: e.targetTouches[0].clientX,
			y: e.targetTouches[0].clientY,
		};
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		touchEnd.current = {
			x: e.targetTouches[0].clientX,
			y: e.targetTouches[0].clientY,
		};
	};

	const handleTouchEnd = () => {
		if (!touchStart.current.x || !touchEnd.current.x) return;
		const distance = touchStart.current.x - touchEnd.current.x;
		if (distance > 50) setCurrentIndex((prev) => (prev + 1) % slides.length);
		else if (distance < -50)
			setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
		touchStart.current = { x: 0, y: 0 };
		touchEnd.current = { x: 0, y: 0 };
	};

	const handleSlideClick = () => {
		const currentSlide = slides[currentIndex];
		if (currentSlide.type === "guru") {
			onOpenGuruMaharaj();
		} else if (currentSlide.type === "virahi") {
			onOpenVirahiMaharaj();
		}
	};

	const handlePrevSlide = (e: React.MouseEvent) => {
		e.stopPropagation();
		setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
	};

	const handleNextSlide = (e: React.MouseEvent) => {
		e.stopPropagation();
		setCurrentIndex((prev) => (prev + 1) % slides.length);
	};

	return (
		<div
			className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-jm-panel overflow-hidden shadow-jm-lg border border-edge-gold dark:border-gold-300/30 bg-cream-50 dark:bg-ink-800 group touch-pan-y cursor-pointer"
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onClick={handleSlideClick}
		>
			{slides.map((slide, idx) => (
				<div
					key={`${idx}-${slide.type}`}
					className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
						idx === currentIndex ? "opacity-100" : "opacity-0"
					}`}
				>
					<img
						src={slide.url}
						alt={getLabel(slide.type)}
						className="w-full h-full object-cover object-center"
					/>
					{/* Krishna-blue scrim so the gold title stays legible over any image */}
					<div className="absolute inset-0 bg-gradient-to-t from-krishna-950/80 via-krishna-950/20 to-transparent"></div>
				</div>
			))}

			{/* Left Arrow */}
			<button
				onClick={handlePrevSlide}
				className="absolute left-3 top-1/2 -translate-y-1/2 z-20 min-h-touch min-w-touch inline-flex items-center justify-center bg-krishna-900/60 hover:bg-krishna-900/80 backdrop-blur-sm border border-gold-300/30 text-cream-50 rounded-jm-md shadow-jm-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
				aria-label="Previous slide"
			>
				<ChevronLeft size={24} />
			</button>

			{/* Right Arrow */}
			<button
				onClick={handleNextSlide}
				className="absolute right-3 top-1/2 -translate-y-1/2 z-20 min-h-touch min-w-touch inline-flex items-center justify-center bg-krishna-900/60 hover:bg-krishna-900/80 backdrop-blur-sm border border-gold-300/30 text-cream-50 rounded-jm-md shadow-jm-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
				aria-label="Next slide"
			>
				<ChevronRight size={24} />
			</button>

			<div className="absolute bottom-3 left-4 right-4 flex justify-between items-center gap-3">
				<h3
					className={`${isHindi ? "font-hindi-display" : "font-display"} text-gold-300 font-semibold text-xl md:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-wide`}
				>
					{getLabel(slides[currentIndex].type)}
				</h3>

				<div className="flex gap-1.5">
					{slides.map((_, idx) => (
						<div
							key={idx}
							className={`w-1.5 h-1.5 rounded-full transition-colors ${
								idx === currentIndex ? "bg-gold-300" : "bg-cream-50/50"
							}`}
						/>
					))}
				</div>
			</div>
		</div>
	);
};

// ── Shared home-tile chrome (Janmashtami) ───────────────────────────────────
// The audit found four near-identical tile surfaces, each carrying its own
// hardcoded hexes (#FFFDF0, #0B1D3A, amber-400, rgba(251,191,36,…)). These
// constants are the single definition of the temple-invitation tile the whole
// grid is built from: a warm cream card, a gold edge, a soft inner keyline and
// generous radius — so every card in the grid reads as part of one set.
const TILE_VISUAL =
	"rounded-jm-card overflow-hidden bg-gradient-to-br from-cream-25 to-cream-100 dark:from-ink-800 dark:to-ink-900 border border-edge-gold/70 dark:border-gold-300/20 shadow-jm-sm dark:shadow-jm-inner-dark transition-[box-shadow,border-color] duration-200 group-hover:shadow-jm-glow group-hover:border-gold-400 dark:group-hover:border-gold-300/40";
const TILE_SURFACE = `relative w-full aspect-[4/3] ${TILE_VISUAL}`;
const TILE_LAYER = `absolute inset-0 ${TILE_VISUAL}`;
const TILE_KEYLINE =
	"pointer-events-none absolute inset-1 rounded-[1rem] border border-gold-300/25 dark:border-gold-300/10 z-10";
const TILE_TITLE =
	"text-ink-900 dark:text-cream-50 text-sm md:text-base tracking-wide leading-tight text-center px-1 mt-1";
const TILE_ICON =
	"relative z-10 text-krishna-600 dark:text-gold-300 transition-transform duration-500 group-hover:scale-110";

/**
 * The alcove inside an icon tile.
 *
 * An icon floating in the middle of an empty cream rectangle is the generic
 * answer, and it was what every tile in this grid used to be. A temple puts its
 * deity in a niche, so the tile does the same: a pointed arch seated on the
 * bottom edge, with the icon standing inside it on a small gold threshold.
 *
 * This is the third and last sanctioned appearance of the TEMPLE ARCH — the
 * theme's signature shape — alongside the active nav tab and the featured
 * section crown (see `src/theme/decorations.ts`). Using it here is what ties
 * the grid to the rest of the app instead of leaving it as generic chrome.
 *
 * ── Why an inline SVG and not the `.jm-arch` clip-path ─────────────────────
 * `.jm-arch` in `tokens.css` is a `clip-path: path(...)`, and `path()` takes
 * absolute user units — it does not scale with the element, so it is only
 * correct at exactly 100x100px. A tile is whatever width the grid gives it, so
 * the arch has to come from a viewBox, which does scale.
 *
 * `xMidYMax meet` seats the arch on the tile's bottom edge and keeps its shape,
 * which leaves it inset from the left and right on a 4:3 tile — so the alcove
 * reads as set into the card rather than as a second border around it.
 *
 * No gradients and no ids: colour comes from `currentColor` so one asset works
 * in both themes, and there is nothing to collide when fifteen tiles mount.
 */
const TileNiche = memo(function TileNiche() {
	return (
		<svg
			viewBox="0 0 100 92"
			preserveAspectRatio="xMidYMax meet"
			className="pointer-events-none absolute inset-0 h-full w-full text-krishna-600/70 dark:text-gold-300/45"
			fill="none"
			aria-hidden="true"
			focusable="false"
		>
			{/* The alcove itself — a faint wash so it reads as a recess, not a line. */}
			<path
				d="M14 92 V40 C14 22 36 22 50 6 C64 22 86 22 86 40 V92 Z"
				fill="currentColor"
				fillOpacity="0.055"
				stroke="currentColor"
				strokeOpacity="0.4"
				strokeWidth="1.2"
				strokeLinejoin="round"
			/>
			{/* Inner echo — the double line of a real temple arch. */}
			<path
				d="M22 92 V41 C22 28 40 28 50 14 C60 28 78 28 78 41 V92"
				stroke="currentColor"
				strokeOpacity="0.22"
				strokeWidth="0.8"
				strokeLinejoin="round"
			/>
		</svg>
	);
});

/**
 * The lit interior of an icon tile: the alcove, a warm bloom behind the icon,
 * the icon itself, and a gold threshold under it like the step of a shrine.
 *
 * Shared by `GlassCard` and by `SlideshowCard`'s icon fallback so a tile looks
 * the same whether its artwork loaded or not.
 */
const TileIconInterior = memo(function TileIconInterior({
	icon,
	isLowEnd,
}: {
	icon: React.ReactNode;
	isLowEnd: boolean;
}) {
	return (
		<>
			<TileNiche />

			{/*
			 * Warm light inside the alcove. A CSS gradient rather than an ornament,
			 * so it costs no DOM and no paint beyond the one layer — and it is what
			 * makes the niche look lit rather than merely drawn. Skipped on low-end
			 * devices along with the other non-essential layers.
			 */}
			{!isLowEnd && (
				<div
					className="pointer-events-none absolute inset-0 z-[1]"
					style={{
						background:
							"radial-gradient(40% 32% at 50% 47%, rgba(255, 213, 79, 0.28) 0%, rgba(255, 213, 79, 0.08) 55%, transparent 74%)",
					}}
				/>
			)}

			<div className="relative z-10 flex flex-col items-center">
				<div
					className={
						isLowEnd
							? "relative z-10 text-krishna-600 dark:text-gold-300"
							: TILE_ICON
					}
				>
					{icon}
				</div>
				{/* Threshold. The step the icon stands on. */}
				<div className="jm-rule mt-2 w-8 opacity-80" />
			</div>
		</>
	);
});

/** Devanagari titles keep a Devanagari face — Marcellus has no Devanagari glyphs. */
const titleFontClass = (title: string) =>
	/[ऀ-ॿ]/.test(title) ? "font-hindi" : "font-heading";

/**
 * Tile status flag.
 *
 * Both states are red, but they must stay tellable apart:
 *   LIVE — flat `bg-error` + a pulsing dot. Genuine urgency, system error red.
 *   NEW  — red gradient + the peacock-feather eye. Festive news.
 *
 * The NEW pill deliberately reuses `from-red-600 to-rose-500`, the exact red the
 * NEW badge already uses on ActivitiesScreen, DailyDarshanScreen and
 * VideosScreen, so the same signal reads the same everywhere. It keeps the gold
 * hairline + gold feather so it still belongs to the Janmashtami system rather
 * than reading as a generic red pill.
 *
 * Both pair colour with a text label, so colour is never the sole cue.
 */
const TileFlag = memo(function TileFlag({
	isLive,
	hasNewUpdate,
}: {
	isLive?: boolean;
	hasNewUpdate?: boolean;
}) {
	if (isLive) {
		return (
			<span className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 rounded-full bg-error px-2 py-0.5 text-jm-micro font-bold uppercase text-white shadow-jm-sm">
				<span className="h-1.5 w-1.5 rounded-full bg-white animate-jm-glow-pulse" />
				LIVE
			</span>
		);
	}
	if (hasNewUpdate) {
		return (
			<span className="absolute top-2 right-2 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/40 animate-pulse border border-red-400/50 z-20 flex items-center justify-center">
				NEW
			</span>
		);
	}
	return null;
});

const GlassCard = memo(function GlassCard({
	title,
	onClick,
	icon,
	isLive,
	hasNewUpdate,
	tourId,
}: {
	title: string;
	onClick: () => void;
	icon: React.ReactNode;
	isLive?: boolean;
	hasNewUpdate?: boolean;
	/** `data-tour` hook for the guided tour; no visual effect. */
	tourId?: string;
}) {
	const { isLowEnd } = useDevicePerformance();
	return (
		<motion.button
			onClick={onClick}
			data-tour={tourId}
			whileHover={{ scale: 1.03, y: -3 }}
			whileTap={{ scale: 0.97 }}
			className="flex flex-col items-center gap-2 w-full group"
		>
			<div
				className={`${TILE_SURFACE} flex items-center justify-center ${isLowEnd ? "" : "backdrop-blur-sm"}`}
			>
				<TileIconInterior icon={icon} isLowEnd={isLowEnd} />
				<div className={TILE_KEYLINE} />
				<TileFlag isLive={isLive} hasNewUpdate={hasNewUpdate} />
			</div>
			<span className={`${titleFontClass(title)} ${TILE_TITLE}`}>{title}</span>
		</motion.button>
	);
});

const ImageCard = memo(function ImageCard({
	title,
	onClick,
	imageUrl,
	isLive,
	hasNewUpdate,
	tourId,
}: {
	title: string;
	onClick: () => void;
	imageUrl: string;
	isLive?: boolean;
	hasNewUpdate?: boolean;
	tourId?: string;
}) {
	const { isLowEnd } = useDevicePerformance();
	return (
		<motion.button
			onClick={onClick}
			data-tour={tourId}
			whileHover={{ scale: 1.03, y: -3 }}
			whileTap={{ scale: 0.97 }}
			className="flex flex-col items-center gap-2 w-full group"
		>
			<div className={TILE_SURFACE}>
				<img
					src={imageUrl}
					alt={title}
					className={`absolute inset-0 h-full w-full object-cover object-center ${isLowEnd ? "" : "transition-transform duration-500 group-hover:scale-105"}`}
				/>
				<div className={TILE_KEYLINE} />
				<TileFlag isLive={isLive} hasNewUpdate={hasNewUpdate} />
			</div>
			<span className={`${titleFontClass(title)} ${TILE_TITLE}`}>{title}</span>
		</motion.button>
	);
});

// Slideshow Card for Darshan/Activities/Quotes
const SlideshowCard = memo(function SlideshowCard({
	title,
	onClick,
	imageUrls,
	fallbackImageUrl,
	fallbackIcon,
	isLive,
	hasNewUpdate,
	tourId,
}: {
	title: string;
	onClick: () => void;
	imageUrls: string[];
	fallbackImageUrl?: string;
	fallbackIcon?: React.ReactNode;
	isLive?: boolean;
	hasNewUpdate?: boolean;
	tourId?: string;
}) {
	const { isLowEnd } = useDevicePerformance();
	const [validUrls, setValidUrls] = useState<string[]>([]);
	const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
	// Photos whose resized copy failed to load; these show the original instead.
	const [thumbFailedUrls, setThumbFailedUrls] = useState<Set<string>>(
		new Set(),
	);
	const [currentIndex, setCurrentIndex] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Reset when imageUrls change
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setValidUrls([]);
		setFailedUrls(new Set());
		setThumbFailedUrls(new Set());
		setCurrentIndex(0);
	}, [imageUrls.join(",")]);

	// Stable interval - does not restart on every index change
	useEffect(() => {
		if (timerRef.current) clearInterval(timerRef.current);
		if (validUrls.length <= 1) return;
		timerRef.current = setInterval(() => {
			setCurrentIndex((prev) => (prev + 1) % validUrls.length);
		}, 4000);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [validUrls.length]);

	const handleImageLoad = (url: string) => {
		setValidUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
	};

	const handleImageError = (url: string) => {
		// The resized copy failed first: retry with the original before giving up.
		if (!thumbFailedUrls.has(url) && thumbUrl(url, THUMB.homeTile) !== url) {
			setThumbFailedUrls((prev) => new Set(prev).add(url));
			return;
		}
		setFailedUrls((prev) => new Set(prev).add(url));
	};

	const showSlideshow = validUrls.length > 0;
	const safeIndex = validUrls.length > 0 ? currentIndex % validUrls.length : 0;
	const currentVisibleUrl = validUrls[safeIndex];
	let canLoadNext = true;

	return (
		<motion.button
			onClick={onClick}
			data-tour={tourId}
			whileHover={{ scale: 1.03, y: -3 }}
			whileTap={{ scale: 0.97 }}
			className="flex flex-col items-center gap-2 w-full group"
		>
			<div className="relative w-full aspect-[4/3]">
				{/* Fallback layer — shown until at least one real image loads. */}
				<div
					className={`${TILE_LAYER} z-[1] flex items-center justify-center transition-opacity duration-700 ${
						showSlideshow ? "opacity-0 pointer-events-none" : "opacity-100"
					}`}
					style={{ willChange: "opacity" }}
				>
					{fallbackImageUrl ? (
						<img
							src={fallbackImageUrl}
							alt={title}
							className={`absolute inset-0 h-full w-full object-cover object-center ${isLowEnd ? "" : "transition-transform duration-500 group-hover:scale-105"}`}
						/>
					) : fallbackIcon ? (
						<TileIconInterior icon={fallbackIcon} isLowEnd={isLowEnd} />
					) : null}
				</div>

				{/* Slideshow layer — simple opacity crossfade, no 3D transforms. */}
				<div
					className={`${TILE_LAYER} z-[2] transition-opacity duration-700 ${
						showSlideshow ? "opacity-100" : "opacity-0"
					}`}
					style={{ willChange: "opacity" }}
				>
					{imageUrls.map((url) => {
						if (failedUrls.has(url)) return null;
						// Load the photos one after another, not all at once: every tile
						// on Home has its own slideshow, and starting them all together
						// slowed the first screen. A photo starts once the one before it
						// has loaded (or failed), which is long before its turn to show.
						if (!canLoadNext) return null;
						if (!validUrls.includes(url)) canLoadNext = false;
						const isVisible = url === currentVisibleUrl;

						return (
							<img
								key={url}
								// A resized copy: these tiles are ~180 px wide, and the originals
								// are 3000+ px photos loaded on every app start.
								src={
									thumbFailedUrls.has(url) ? url : thumbUrl(url, THUMB.homeTile)
								}
								alt={title}
								onLoad={() => handleImageLoad(url)}
								onError={() => handleImageError(url)}
								className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-[800ms] ease-in-out ${
									isVisible ? "opacity-100 z-10" : "opacity-0 z-0"
								}`}
								style={{ willChange: "opacity" }}
							/>
						);
					})}

					{/* Dot indicators */}
					{validUrls.length > 1 && (
						<div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-20">
							{validUrls.map((_, idx) => (
								<div
									key={idx}
									className={`rounded-full transition-all duration-300 ${
										idx === safeIndex
											? "bg-gold-300 w-4 h-1.5"
											: "bg-cream-50/70 w-1.5 h-1.5"
									}`}
								/>
							))}
						</div>
					)}
				</div>

				{/* Shared keyline + status flag sit above both crossfading layers. */}
				<div className={TILE_KEYLINE} />
				<TileFlag isLive={isLive} hasNewUpdate={hasNewUpdate} />
			</div>

			<span className={`${titleFontClass(title)} ${TILE_TITLE}`}>{title}</span>
		</motion.button>
	);
});

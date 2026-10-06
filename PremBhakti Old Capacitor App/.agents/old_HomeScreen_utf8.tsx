import { Capacitor, CapacitorHttp } from "@capacitor/core";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
} from "firebase/firestore";
import { motion } from "framer-motion";
import {
	Activity,
	Bell,
	BookOpen,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Clock,
	Download,
	ExternalLink,
	Facebook,
	Headphones,
	Heart,
	HelpCircle,
	History,
	Image as ImageIcon,
	Info,
	Instagram,
	Lightbulb,
	MapPin,
	MessageCircle,
	Music,
	Play,
	ScrollText,
	Settings,
	Share2,
	Smartphone,
	User,
	Users,
	X,
	Youtube,
} from "lucide-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "../context/SettingsContext";
import { useSharedFirebase } from "../context/SharedFirebaseContext";
import { useToast } from "../context/ToastContext";
import { db } from "../services/firebase";
import { useDevicePerformance } from "../src/hooks/useDevicePerformance";
import { MANDAL_LIST, MandalData } from "../src/types/mandal";
import type { BannerConfig } from "../types";
import { toCdnUrl } from "../utils/cdnUrl";
import { formatDisplayDate, formatForDateInput } from "../utils/dateFormatter";
import {
	iosGetDoc,
	iosOnSnapshotCollection,
	iosOnSnapshotDoc,
	shouldUseRestFallback,
} from "../utils/firebaseRest";
import { triggerHaptic } from "../utils/haptic";
import { safeLocalSet } from "../utils/safeLocalSet";
import { shareAppContent } from "../utils/shareService";
import { AavirbhavMahotsavSection } from "./AavirbhavMahotsavSection";
import { BannerContainer } from "./BannerContainer";
import { FeedbackModal } from "./FeedbackModal";
import { GlorificationModal } from "./GlorificationModal";
import { ThankYouPopup } from "./ThankYouPopup";

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
const GALLERY_ICON = "/icon-deity-darshan.webp?v=2";
const OUR_ACTIVITIES_ICON = "/rathyatratheme/Activities.webp?v=2";
const OUR_ACTIVITIES_ICON_DARK = "/rathyatratheme/Activities_Dark.webp?v=2";

const VAISHNAV_CALENDAR_ICON = "/rathyatratheme/Calender.webp?v=2";
const VAISHNAV_CALENDAR_ICON_DARK = "/rathyatratheme/Calendar_Dark.webp?v=2";

const DONATE_ICON = "/rathyatratheme/donate.webp?v=2";
const DONATE_ICON_DARK = "/rathyatratheme/donate_dark.webp?v=2";

const OUR_CENTERS_ICON = "/rathyatratheme/Our_Centers.webp?v=2";
const OUR_CENTERS_ICON_DARK = "/rathyatratheme/Our_Centers_Dark.webp?v=2";

// Quotes: uses existing public images for dark/light fallback
const DAILY_INFO_ICON = "/information.webp?v=2";
const DAILY_INFO_ICON_DARK = "/info_dark.webp?v=2";

const YOUTUBE_ICON = "/rathyatratheme/youtube.webp?v=2";
const YOUTUBE_ICON_DARK = "/rathyatratheme/youtube_dark.webp?v=2";

const INSTAGRAM_ICON = "/rathyatratheme/Instagram.webp?v=2";
const INSTAGRAM_ICON_DARK = "/rathyatratheme/Instagram_dark.webp?v=2";

const FACEBOOK_ICON = "/rathyatratheme/facebook.webp?v=2";
const FACEBOOK_ICON_DARK = "/rathyatratheme/facebook_Dark.webp?v=2";

const BHAJAN_ICON = "/bhajan_new.webp?v=2";
const BHAJAN_ICON_DARK = "/bhajan_new-dark.webp?v=2";

// Videos: deleted images ÔÇö using Lucide icon fallback via fallbackIcon prop

const AUDIO_ICON = "/icon-audios.webp?v=2";
const AUDIO_ICON_DARK = "/icon-audios-dark.webp?v=2";

const BOOKS_ICON = "/rathyatratheme/Books.webp?v=2";
const BOOKS_ICON_DARK = "/rathyatratheme/Books_Dark.webp?v=2";

const HISTORY_AUTHORS_ICON = "/rathyatratheme/History_authors.webp?v=2";
const HISTORY_AUTHORS_ICON_DARK =
	"/rathyatratheme/History_authors_dark.webp?v=2";

const PROFILE_ICON = "/rathyatratheme/Devotee.webp?v=2";
const PROFILE_ICON_DARK = "/rathyatratheme/Devotee_Dark.webp?v=2";

const INFO_ICON = "/rathyatratheme/information.webp?v=2";
const INFO_ICON_DARK = "/rathyatratheme/info_dark.webp?v=2";

const TEMPLE_ICON = "/rathyatratheme/Temple_Timing.webp?v=2";
const TEMPLE_ICON_DARK = "/rathyatratheme/Temple_Timing_Dark.webp?v=2";

const SHARE_ICON = "/rathyatratheme/share.webp?v=2";
const SHARE_ICON_DARK = "/rathyatratheme/share_dark.webp?v=2";

const DOWNLOADS_ICON = "/rathyatratheme/Download.webp?v=2";
const DOWNLOADS_ICON_DARK = "/rathyatratheme/Download_Dark.webp?v=2";

const FEEDBACK_ICON = "/rathyatratheme/information.webp?v=2";
const FEEDBACK_ICON_DARK = "/rathyatratheme/info_dark.webp?v=2";

const HOW_TO_USE_ICON = "/rathyatratheme/howtouse.webp?v=2";
const HOW_TO_USE_ICON_DARK = "/rathyatratheme/howtouse.webp?v=2";

const ABOUT_US_ICON = "/rathyatratheme/About_Us.webp?v=2";
const ABOUT_US_ICON_DARK = "/rathyatratheme/About_us_dark.webp?v=2";
const PHOTOS_ICON = "/2_Gallery Icon.webp?v=2";
const SETTINGS_ICON = "/rathyatratheme/Setting.webp?v=2";
const SETTINGS_ICON_DARK = "/rathyatratheme/Setting_Dark.webp?v=2";

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
		const [showGlorificationModal, setShowGlorificationModal] = useState(false);
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
		const [activitiesImages, setActivitiesImages] = useState<string[]>([]);
		const [videoThumbnailImages, setVideoThumbnailImages] = useState<string[]>(
			[],
		);

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
		const [forceRender, setForceRender] = useState(0);
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

		// Moved quotes logic inside the main token fetch to prevent 404 console errors
		// by exactly matching the available file extensions using the GitHub API.

		useEffect(() => {
			const handleStorageUpdate = () => setForceRender((prev) => prev + 1);
			window.addEventListener("cpbs_storage_update", handleStorageUpdate);
			return () =>
				window.removeEventListener("cpbs_storage_update", handleStorageUpdate);
		}, []);

		const [hasNewDarshan, setHasNewDarshan] = useState(false);
		const [hasNewActivity, setHasNewActivity] = useState(false);
		const [hasNewVideo, setHasNewVideo] = useState(false);
		const [hasNewPastEvent, setHasNewPastEvent] = useState(false);
		const latestPastEventIdRef = React.useRef<string | null>(null);

		useEffect(() => {
			if (darshanImages.length > 0) {
				const lastSeen = localStorage.getItem("cpbs_home_darshan_latest");
				setHasNewDarshan(lastSeen !== darshanImages[0]);
			} else {
				setHasNewDarshan(false);
			}
		}, [darshanImages, forceRender]);

		useEffect(() => {
			if (activitiesImages.length > 0) {
				const lastSeen = localStorage.getItem("cpbs_home_activity_latest");
				setHasNewActivity(lastSeen !== activitiesImages[0]);
			} else {
				setHasNewActivity(false);
			}
		}, [activitiesImages, forceRender]);

		useEffect(() => {
			if (videoThumbnailImages.length > 0) {
				const lastSeen = localStorage.getItem("cpbs_home_video_latest");
				setHasNewVideo(lastSeen !== videoThumbnailImages[0]);
			} else {
				setHasNewVideo(false);
			}
		}, [videoThumbnailImages, forceRender]);

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
						if (!isNaN(dateObj.getTime()))
							dateOnly = dateObj.toISOString().split("T")[0];
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

			let maxPhotosTime = -1;
			let lPhotosId: string | null = null;

			mergedMandalsMap.forEach((m) => {
				if (
					m.name &&
					m.name.toLowerCase().endsWith("gallery") &&
					m.gallery &&
					m.gallery.length > 0
				) {
					const g = m.gallery[0];
					let gt = new Date(formatForDateInput(g.date) || 0).getTime();
					if (isNaN(gt)) gt = 0;
					if (gt > maxPhotosTime) {
						maxPhotosTime = gt;
						lPhotosId = String(g.releaseId || g.id);
					} else if (!lPhotosId) {
						lPhotosId = String(g.releaseId || g.id);
					}
				}
			});

			if (lPhotosId !== null) {
				latestPastEventIdRef.current = lPhotosId;
				const lastSeen = localStorage.getItem(
					"cpbs_activity_photos_main_latest",
				);
				setHasNewPastEvent(lastSeen !== lPhotosId);
			} else {
				latestPastEventIdRef.current = null;
				setHasNewPastEvent(false);
			}
		}, [dbMandals, activityReleases, forceRender]);

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

						let videoId = url.searchParams.get("videoId");
						const videoFolder = url.searchParams.get("videoFolder");

						if (url.pathname.startsWith("/v/")) {
							const parts = url.pathname.split("/");
							if (parts.length > 2) {
								videoId = parts[2];
							}
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
					}
				} catch (e) {}
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

		const fetchFromGitHub = async (
			visibleIds: number[],
			type: "darshan" | "activity",
			token: string,
		) => {
			try {
				const response = await fetch(
					`https://api.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases?t=${Date.now()}&per_page=100`,
					{
						headers: {
							Authorization: `token ${token}`,
							Accept: "application/vnd.github.v3+json",
						},
					},
				);

				if (!response.ok) throw new Error(`GitHub API ${response.status}`);
				const releases: any[] = await response.json();

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

		useEffect(() => {
			if (!githubToken || !darshanFoldersConfig) return;
			const visibleIds: number[] = darshanFoldersConfig.visibleIds || [];
			fetchFromGitHub(visibleIds, "darshan", githubToken);
		}, [githubToken, darshanFoldersConfig]);

		useEffect(() => {
			if (!githubToken || !activityFoldersConfig) return;
			const visibleIds: number[] = activityFoldersConfig.visibleIds || [];
			fetchFromGitHub(visibleIds, "activity", githubToken);
		}, [githubToken, activityFoldersConfig]);

		// Merge darshan sources
		useEffect(() => {
			const uniqueUrls = new Set<string>();
			const allItems: { url: string; date: string; order: number }[] = [];

			// Add from Firestore first
			dbMandals.forEach((m) => {
				(m.gallery || []).forEach((g: any) => {
					if (g.type === "darshan") {
						if (!uniqueUrls.has(g.url)) {
							uniqueUrls.add(g.url);
							allItems.push({ url: g.url, date: g.date, order: g.order || 0 });
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
							if (!isNaN(dateObj.getTime()))
								dateOnly = dateObj.toISOString().split("T")[0];
						}
						allItems.push({ url, date: dateOnly, order });
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
		}, [darshanReleases, dbMandals]);

		// Merge activity sources
		useEffect(() => {
			const uniqueUrls = new Set<string>();
			const allItems: { url: string; date: string; order: number }[] = [];

			// Add from Firestore first
			dbMandals.forEach((m) => {
				(m.gallery || []).forEach((g: any) => {
					if (g.type === "activity") {
						if (!uniqueUrls.has(g.url)) {
							uniqueUrls.add(g.url);
							allItems.push({ url: g.url, date: g.date, order: g.order || 0 });
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
							if (!isNaN(dateObj.getTime()))
								dateOnly = dateObj.toISOString().split("T")[0];
						}
						allItems.push({ url, date: dateOnly, order });
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

			setActivitiesImages(
				allItems
					.map((i) => i.url)
					.slice(0, 5)
					.reverse(),
			);
		}, [activityReleases, dbMandals]);

		// Merge video thumbnails
		useEffect(() => {
			const uniqueUrls = new Set<string>();
			const allItems: { url: string; date: string; order: number }[] = [];

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
		}, [dbVideos, dbVideoFolders]);

		const t = {
			dailyDarshan: isHindi ? "ÓñáÓñ¥ÓñòÓÑüÓñ░ Óñ£ÓÑÇ ÓñòÓÑç ÓñªÓñ░ÓÑìÓñÂÓñ¿" : "Deity Darshan",
			dailyQuotes: isHindi ? "Óñ¿Óñ┐ÓññÓÑìÓñ» ÓñÁÓñ¥ÓñúÓÑÇ" : "Daily Quotes",
			vaishnavCalendar: isHindi ? "ÓñÁÓÑêÓñÀÓÑìÓñúÓñÁ ÓñòÓÑêÓñ▓ÓÑçÓñéÓñíÓñ░" : "Vaishnav Calendar",
			ourCenters: isHindi ? "Óñ╣Óñ«Óñ¥Óñ░ÓÑç ÓñòÓÑçÓñéÓñªÓÑìÓñ░" : "Our Centers",
			donate: isHindi ? "Óñ©Óñ╣Óñ»ÓÑïÓñù ÓñòÓñ░ÓÑçÓñé" : "Donate",
			dailyInfo: isHindi ? "ÓñªÓÑêÓñ¿Óñ┐Óñò Óñ£Óñ¥Óñ¿ÓñòÓñ¥Óñ░ÓÑÇ" : "Daily Information",
			youtube: isHindi ? "Óñ»ÓÑéÓñƒÓÑìÓñ»ÓÑéÓñ¼" : "YouTube",
			instagram: isHindi ? "ÓñçÓñéÓñ©ÓÑìÓñƒÓñ¥ÓñùÓÑìÓñ░Óñ¥Óñ«" : "Instagram",
			facebook: isHindi ? "Óñ½ÓÑçÓñ©Óñ¼ÓÑüÓñò" : "Facebook",
			bhajans: isHindi ? "Óñ¡Óñ£Óñ¿ Óñ©ÓÑéÓñÜÓÑÇ" : "Bhajan List",
			howToUse: isHindi ? "ÓñÉÓñ¬ ÓñòÓÑêÓñ©ÓÑç ÓñëÓñ¬Óñ»ÓÑïÓñù ÓñòÓñ░ÓÑçÓñé" : "How to Use App",
			aboutUs: isHindi ? "Óñ¬Óñ░Óñ┐ÓñÜÓñ» (About)" : "About Us",
			appTour: isHindi ? "ÓñÉÓñ¬ Óñ¬Óñ░Óñ┐ÓñÜÓñ» (ÓñƒÓÑéÓñ░)" : "App Tour",
			tourDesc: isHindi ? "Óñ½ÓÑÇÓñÜÓñ░ÓÑìÓñ© ÓñöÓñ░ Óñ©ÓÑüÓñÁÓñ┐ÓñºÓñ¥ÓñÅÓñé Óñ£Óñ¥Óñ¿ÓÑçÓñé" : "Know the features",
			watchVideo: isHindi ? "ÓñÁÓÑÇÓñíÓñ┐Óñ»ÓÑï ÓñíÓÑçÓñ«ÓÑï ÓñªÓÑçÓñûÓÑçÓñé" : "Watch Video Demo",
			videoDesc: isHindi ? "Óñ»ÓÑéÓñƒÓÑìÓñ»ÓÑéÓñ¼ Óñ¬Óñ░ ÓñÁÓÑÇÓñíÓñ┐Óñ»ÓÑï ÓñªÓÑçÓñûÓÑçÓñé" : "Watch on YouTube",
			helpTitle: isHindi ? "Óñ©Óñ╣Óñ¥Óñ»ÓññÓñ¥ / Óñ╣ÓÑçÓñ▓ÓÑìÓñ¬" : "Help & Guide",
			openLink: isHindi ? "Óñ▓Óñ┐ÓñéÓñò ÓñûÓÑïÓñ▓ÓÑçÓñé?" : "Open Link?",
			linkDesc: isHindi
				? "ÓñåÓñ¬ ÓñÉÓñ¬ Óñ©ÓÑç Óñ¼Óñ¥Óñ╣Óñ░ Óñ£Óñ¥ Óñ░Óñ╣ÓÑç Óñ╣ÓÑêÓñé:"
				: "You are leaving the app to visit:",
			information: isHindi ? "Óñ£Óñ¥Óñ¿ÓñòÓñ¥Óñ░ÓÑÇ" : "Information",
			templeTiming: isHindi ? "Óñ«ÓñéÓñªÓñ┐Óñ░ ÓñòÓñ¥ Óñ©Óñ«Óñ»" : "Temple Timing",
			shareApp: isHindi ? "ÓñÉÓñ¬ ÓñÂÓÑçÓñ»Óñ░ ÓñòÓñ░ÓÑçÓñé" : "Share App",
			downloads: isHindi ? "ÓñíÓñ¥ÓñëÓñ¿Óñ▓ÓÑïÓñíÓÑìÓñ©" : "Downloads",
			feedback: isHindi ? "Óñ¬ÓÑìÓñ░ÓññÓñ┐ÓñòÓÑìÓñ░Óñ┐Óñ»Óñ¥" : "Feedback",
			pastEventMedia: isHindi ? "Óñ¬Óñ┐ÓñøÓñ▓ÓÑç ÓñòÓñ¥Óñ░ÓÑìÓñ»ÓñòÓÑìÓñ░Óñ« Óñ«ÓÑÇÓñíÓñ┐Óñ»Óñ¥" : "Past Event Media",
			settings: isHindi ? "Óñ©ÓÑçÓñƒÓñ┐ÓñéÓñùÓÑìÓñ©" : "Settings",
			ourActivities: isHindi ? "Óñ╣Óñ«Óñ¥Óñ░ÓÑÇ ÓñùÓññÓñ┐ÓñÁÓñ┐ÓñºÓñ┐Óñ»Óñ¥Óñü" : "Our Activities",
			videos: isHindi ? "ÓñÁÓÑÇÓñíÓñ┐Óñ»ÓÑï" : "Videos",
			audios: isHindi ? "ÓñæÓñíÓñ┐Óñ»ÓÑï" : "Audios",
			books: isHindi ? "Óñ¬ÓÑüÓñ©ÓÑìÓññÓñòÓÑçÓñé" : "Books",
			historyAuthors: isHindi ? "Óñ▓ÓÑçÓñûÓñò ÓñöÓñ░ ÓñçÓññÓñ┐Óñ╣Óñ¥Óñ©" : "Authors and History",
			profile: isHindi ? "Óñ¡ÓñòÓÑìÓññ Óñ¬ÓÑìÓñ░ÓÑïÓñ½Óñ¥ÓñçÓñ▓" : "Devotee Profile",
			comingSoon: isHindi ? "Óñ£Óñ▓ÓÑìÓñª Óñå Óñ░Óñ╣Óñ¥ Óñ╣ÓÑê" : "Coming Soon",
			cancel: isHindi ? "Óñ░ÓñªÓÑìÓñª ÓñòÓñ░ÓÑçÓñé" : "Cancel",
			open: isHindi ? "ÓñûÓÑïÓñ▓ÓÑçÓñé" : "Open",
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
							: "Óñ▓Óñ┐ÓñéÓñò ÓñòÓÑëÓñ¬ÓÑÇ Óñ╣ÓÑï ÓñùÓñ»Óñ¥!",
					);
				},
			);
		};

		const handlePress = (action: () => void) => {
			triggerHaptic("light");
			action();
		};

		const handleComingSoon = () => {
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
				{/* Falling Petals Background */}
				<div
					className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
					aria-hidden="true"
				>
					{[...Array(15)].map((_, i) => (
						<div
							key={i}
							className="absolute w-2 h-2 md:w-3 md:h-3 bg-white/60 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-twinkling-stars blur-[1px]"
							style={{
								left: `${Math.random() * 100}%`,
								animationDelay: `${Math.random() * 10}s`,
								animationDuration: `${10 + Math.random() * 15}s`,
							}}
						/>
					))}
				</div>

				{/* Floating Desktop Profile & Settings Buttons */}
				<div className="hidden landscape:flex absolute top-4 right-4 z-50 gap-2">
					<button
						onClick={() => {
							triggerHaptic("light");
							onOpenProfile();
						}}
						className="p-3 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-md border border-ry-gold/30 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 group"
						title={isHindi ? "Óñ¡ÓñòÓÑìÓññ Óñ¬ÓÑìÓñ░ÓÑïÓñ½Óñ¥ÓñçÓñ▓" : "Devotee Profile"}
					>
						<User
							size={24}
							className="text-ry-gold drop-shadow-sm group-hover:scale-110 transition-transform"
						/>
					</button>
					<button
						onClick={() => {
							triggerHaptic("light");
							onOpenSettings();
						}}
						className="p-3 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-md border border-ry-gold/30 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 group"
						title={isHindi ? "Óñ©ÓÑçÓñƒÓñ┐ÓñéÓñùÓÑìÓñ©" : "Settings"}
					>
						<Settings
							size={24}
							className="text-ry-gold drop-shadow-sm group-hover:rotate-45 transition-transform duration-500"
						/>
					</button>
				</div>

				<div className="relative z-10 pb-4 pt-2 px-3 space-y-5">
					{/* Aavirbhav Mahotsav Glorification Section */}
					<div
						className="w-full max-w-5xl mx-auto stagger-item"
						style={{ animationDelay: "80ms" }}
					>
						<AavirbhavMahotsavSection
							settingsLanguage={settingsLanguage}
							onWriteClick={() => {
								triggerHaptic("light");
								setShowGlorificationModal(true);
							}}
						/>
					</div>

					{/* Hero Carousel Section */}
					<div
						className="w-full relative max-w-5xl mx-auto stagger-item"
						style={{ animationDelay: "100ms" }}
					>
						<HeroCarousel
							onOpenGuruMaharaj={onOpenGuruMaharaj}
							onOpenVirahiMaharaj={onOpenVirahiMaharaj}
							settingsLanguage={settingsLanguage}
						/>
					</div>

					<div className="stagger-item" style={{ animationDelay: "200ms" }}>
						<BannerContainer
							onAction={handleBannerAction}
							isActive={isActive}
						/>
					</div>

					{/* ... (rest of HomeScreen JSX) */}

					{/* Main Grid */}
					<div
						className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-7xl mx-auto stagger-container"
						style={{ "--base-delay": "300ms" } as React.CSSProperties}
					>
						{/* 1. Our Activities */}
						<SlideshowCard
							title={t.ourActivities}
							imageUrls={[]}
							fallbackImageUrl={
								darkMode ? OUR_ACTIVITIES_ICON_DARK : OUR_ACTIVITIES_ICON
							}
							hasNewUpdate={hasNewActivity}
							onClick={() => {
								if (activitiesImages.length > 0) {
									safeLocalSet(
										"cpbs_home_activity_latest",
										activitiesImages[0],
									);
									setForceRender((prev) => prev + 1);
								}
								handlePress(onOpenActivities);
							}}
						/>

						{/* 2. Darshan & Gallery */}
						<SlideshowCard
							title={t.dailyDarshan}
							imageUrls={darshanImages}
							fallbackImageUrl={GALLERY_ICON}
							hasNewUpdate={hasNewDarshan}
							onClick={() => {
								if (darshanImages.length > 0) {
									safeLocalSet("cpbs_home_darshan_latest", darshanImages[0]);
									setForceRender((prev) => prev + 1);
								}
								handlePress(onOpenDailyDarshan);
							}}
						/>

						{/* 3. Vaishnav Calendar */}
						<GlassCard
							title={t.vaishnavCalendar}
							icon={<Calendar size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenEvents)}
						/>

						{/* 4. Donate */}
						<GlassCard
							title={t.donate}
							icon={<Heart size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenDonate)}
						/>

						{/* 5. Daily Quotes */}
						<SlideshowCard
							title={t.dailyQuotes}
							imageUrls={quotesImages}
							fallbackImageUrl={
								darkMode ? DAILY_INFO_ICON_DARK : DAILY_INFO_ICON
							}
							onClick={() => handlePress(onOpenDailyQuotes)}
						/>

						{/* 6. Videos */}
						<SlideshowCard
							title={t.videos}
							imageUrls={videoThumbnailImages}
							fallbackIcon={<Play size={48} strokeWidth={1.5} />}
							hasNewUpdate={hasNewVideo}
							onClick={() => {
								if (videoThumbnailImages.length > 0) {
									safeLocalSet(
										"cpbs_home_video_latest",
										videoThumbnailImages[0],
									);
									setForceRender((prev) => prev + 1);
								}
								handlePress(onOpenVideos);
							}}
						/>

						{/* Past Event Media */}
						<ImageCard
							title={t.pastEventMedia}
							imageUrl={PHOTOS_ICON}
							hasNewUpdate={hasNewPastEvent}
							onClick={() => {
								if (latestPastEventIdRef.current) {
									safeLocalSet(
										"cpbs_activity_photos_main_latest",
										latestPastEventIdRef.current,
									);
									setHasNewPastEvent(false);
								}
								handlePress(onOpenPhotos);
							}}
						/>

						{/* 7. Our Centers */}
						<GlassCard
							title={t.ourCenters}
							icon={<MapPin size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenSevaCenter)}
						/>

						<GlassCard
							title={t.bhajans}
							icon={<Music size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenBhajanList)}
						/>

						{/* 12. Audios */}
						<GlassCard
							title={t.audios}
							icon={<Headphones size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(() => onNavigate("lectures"))}
						/>

						{/* 13. Books */}
						<GlassCard
							title={t.books}
							icon={<BookOpen size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(() => onNavigate("books"))}
						/>

						{/* 14. Authors and History */}
						<GlassCard
							title={t.historyAuthors}
							icon={<ScrollText size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(() => onNavigate("library"))}
						/>

						{/* 15. Devotee Profile */}
						<GlassCard
							title={t.profile}
							icon={<User size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenProfile)}
						/>

						{/* 16. Information */}
						<GlassCard
							title={t.information}
							icon={<Bell size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenInformation)}
							hasNewUpdate={hasNewInformation}
						/>

						<GlassCard
							title={t.youtube}
							icon={<Youtube size={48} strokeWidth={1.5} />}
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

						<GlassCard
							title={t.instagram}
							icon={<Instagram size={48} strokeWidth={1.5} />}
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

						<GlassCard
							title={t.facebook}
							icon={<Facebook size={48} strokeWidth={1.5} />}
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

						{/* 17. Temple Timing */}
						<GlassCard
							title={t.templeTiming}
							icon={<Clock size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenTempleTimings)}
						/>

						{/* 18. Share App */}
						<GlassCard
							title={t.shareApp}
							icon={<Share2 size={48} strokeWidth={1.5} />}
							onClick={handleShareApp}
						/>

						{/* 19. Downloads */}
						<GlassCard
							title={t.downloads}
							icon={<Download size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(() => onNavigate("downloads"))}
						/>

						{/* Settings */}
						<GlassCard
							title={t.settings}
							icon={<Settings size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenSettings)}
						/>

						{/* 20. Feedback */}
						<GlassCard
							title={t.feedback}
							icon={<MessageCircle size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(() => setShowFeedbackModal(true))}
						/>

						<GlassCard
							title={t.howToUse}
							icon={<HelpCircle size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(() => setShowHelpModal(true))}
						/>

						<GlassCard
							title={t.aboutUs}
							icon={<Users size={48} strokeWidth={1.5} />}
							onClick={() => handlePress(onOpenAbout)}
						/>
					</div>

					{/* App Sevak Section */}
					<div
						className="mt-8 mb-4 max-w-7xl mx-auto bg-white/60 dark:bg-slate-800/60 rounded-2xl p-6 border border-ry-gold/30 text-center shadow-sm backdrop-blur-sm stagger-item"
						style={{ animationDelay: "800ms" }}
					>
						<h3
							className="text-2xl font-bold text-ry-gold mb-1"
							style={{ fontFamily: '"Comic Sans MS", cursive' }}
						>
							{settingsLanguage === "hi" ? "ÓñÉÓñ¬ Óñ©ÓÑçÓñÁÓñò (App Sevak)" : "App Sevak"}
						</h3>
						<p className="text-sm text-ry-maroon/80 dark:text-ry-gold/80 mb-3 font-medium italic">
							{settingsLanguage === "hi"
								? "Óñ¬Óñ░Óñ«Óñ¬ÓÑéÓñ£ÓÑìÓñ» ÓñÁÓñ░ÓÑìÓññÓñ«Óñ¥Óñ¿ ÓñåÓñÜÓñ¥Óñ░ÓÑìÓñ» Óñ£ÓÑÇ Óñ«Óñ╣Óñ¥Óñ░Óñ¥Óñ£ Óñ£ÓÑÇ ÓñòÓÑÇ ÓñåÓñ£ÓÑìÓñ×Óñ¥ Óñ©ÓÑç"
								: "By the order of Acharya Ji Maharaj Ji"}
						</p>
						<div className="flex flex-wrap justify-center gap-3 mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
							{[
								{
									en: "Narayan Prabhuji (Naman Prabhuji)",
									hi: "Óñ¿Óñ¥Óñ░Óñ¥Óñ»Óñú Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ¿Óñ«Óñ¿ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ)",
								},
								{ en: "Raj Roop Prabhuji (Kota)", hi: "Óñ░Óñ¥Óñ£ Óñ░ÓÑéÓñ¬ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñòÓÑïÓñƒÓñ¥)" },
								{
									en: "Shree Nath Prabhuji (Damoh)",
									hi: "ÓñÂÓÑìÓñ░ÓÑÇ Óñ¿Óñ¥ÓñÑ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñªÓñ«ÓÑïÓñ╣)",
								},
								{
									en: "Lalit Krishna Prabhuji (Lucky Prabhuji)",
									hi: "Óñ▓Óñ▓Óñ┐Óññ ÓñòÓÑâÓñÀÓÑìÓñú Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ▓ÓñòÓÑÇ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ)",
								},
								{
									en: "Gourang Prabhuji (Bassi Prabhuji Khurai)",
									hi: "ÓñùÓÑîÓñ░Óñ¥ÓñéÓñù Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ¼Óñ©ÓÑìÓñ©ÓÑÇ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ ÓñûÓÑüÓñ░Óñê)",
								},
								{ en: "Ram Prabhuji (Bhopal)", hi: "Óñ░Óñ¥Óñ« Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ¡ÓÑïÓñ¬Óñ¥Óñ▓)" },
								{
									en: "Vishambhar Prabhuji (Bhopal)",
									hi: "ÓñÁÓñ┐ÓñÂÓñ«ÓÑìÓñ¡Óñ░ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ¡ÓÑïÓñ¬Óñ¥Óñ▓)",
								},
								{ en: "Adwait Prabhuji (Bhopal)", hi: "ÓñàÓñªÓÑìÓñÁÓÑêÓññ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ¡ÓÑïÓñ¬Óñ¥Óñ▓)" },
								{ en: "Harsh Prabhuji (Jabalpur)", hi: "Óñ╣Óñ░ÓÑìÓñÀ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ£Óñ¼Óñ▓Óñ¬ÓÑüÓñ░)" },
								{ en: "Niketan Prabhuji (Indore)", hi: "Óñ¿Óñ┐ÓñòÓÑçÓññÓñ¿ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñçÓñ¿ÓÑìÓñªÓÑîÓñ░)" },
								{ en: "Manjari Mataji (Bhopal)", hi: "Óñ«ÓñéÓñ£Óñ░ÓÑÇ Óñ«Óñ¥ÓññÓñ¥Óñ£ÓÑÇ (Óñ¡ÓÑïÓñ¬Óñ¥Óñ▓)" },
								{ en: "Giriraj Prabhuji (Sagar)", hi: "ÓñùÓñ┐Óñ░Óñ┐Óñ░Óñ¥Óñ£ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ©Óñ¥ÓñùÓñ░)" },
								{ en: "Divyansh Prabhuji (Khurai)", hi: "ÓñªÓñ┐ÓñÁÓÑìÓñ»Óñ¥ÓñéÓñÂ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñûÓÑüÓñ░Óñê)" },
								{ en: "Sanatan Prabhuji (Datia)", hi: "Óñ©Óñ¿Óñ¥ÓññÓñ¿ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñªÓññÓñ┐Óñ»Óñ¥)" },
								{ en: "Raghunath Prabhuji (Kota)", hi: "Óñ░ÓñÿÓÑüÓñ¿Óñ¥ÓñÑ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñòÓÑïÓñƒÓñ¥)" },
								{
									en: "Pradumya Prabhuji (Gesabaad)",
									hi: "Óñ¬ÓÑìÓñ░ÓñªÓÑüÓñ«ÓÑìÓñ» Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñùÓÑçÓñ©Óñ¥Óñ¼Óñ¥Óñª)",
								},
								{ en: "Raghav Prabhuji (Harrai)", hi: "Óñ░Óñ¥ÓñÿÓñÁ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (Óñ╣Óñ░ÓÑìÓñ░Óñê)" },
								{
									en: "Shyam Sundar Prabhuji (Damoh)",
									hi: "ÓñÂÓÑìÓñ»Óñ¥Óñ« Óñ©ÓÑüÓñéÓñªÓñ░ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñªÓñ«ÓÑïÓñ╣)",
								},
								{
									en: "Bhaskar Prabhuji (Gesabaad)",
									hi: "Óñ¡Óñ¥Óñ©ÓÑìÓñòÓñ░ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñùÓÑçÓñ©Óñ¥Óñ¼Óñ¥Óñª)",
								},
								{ en: "Ayush Prabhuji (Damoh)", hi: "ÓñåÓñ»ÓÑüÓñÀ Óñ¬ÓÑìÓñ░Óñ¡ÓÑüÓñ£ÓÑÇ (ÓñªÓñ«ÓÑïÓñ╣)" },
							].map((sevak, i) => (
								<span
									key={i}
									className="px-3 py-1.5 bg-ry-gold/10 hover:bg-ry-gold/20 transition-colors border border-ry-gold/20 rounded-full"
								>
									{settingsLanguage === "hi" ? sevak.hi : sevak.en}
								</span>
							))}
						</div>
						<p className="mt-5 text-xs text-slate-500 dark:text-slate-400 italic">
							{settingsLanguage === "hi"
								? "Óñ¼Óñ¥ÓñòÓÑÇ Óñ£Óñ¥Óñ¿ÓñòÓñ¥Óñ░ÓÑÇ Óñ¼Óñ¥Óñª Óñ«ÓÑçÓñé ÓñàÓñ¬ÓñíÓÑçÓñƒ ÓñòÓÑÇ Óñ£Óñ¥ÓñÅÓñùÓÑÇ ÓñòÓñ┐ ÓñòÓñ┐Óñ©ÓñòÓñ¥ ÓñòÓÑìÓñ»Óñ¥ Óñ»ÓÑïÓñùÓñªÓñ¥Óñ¿ Óñ╣ÓÑêÓÑñ"
								: "Details regarding individual contributions will be updated later."}
						</p>
					</div>

					{/* OAuth Verification Footer */}
					<div
						className="mt-8 mb-4 max-w-7xl mx-auto bg-white/60 dark:bg-slate-800/60 rounded-2xl p-6 border border-ry-gold/30 text-center shadow-sm backdrop-blur-sm stagger-item"
						style={{ animationDelay: "800ms" }}
					>
						<h2
							className="text-2xl font-bold text-ry-gold mb-3"
							style={{ fontFamily: '"Comic Sans MS", cursive' }}
						>
							Prem Bhakti
						</h2>
						<p className="text-slate-700 dark:text-slate-300 text-sm md:text-base max-w-3xl mx-auto leading-relaxed">
							{settingsLanguage === "hi" ? (
								<>
									ÓñåÓñºÓñ┐ÓñòÓñ¥Óñ░Óñ┐Óñò <strong>Óñ¬ÓÑìÓñ░ÓÑçÓñ« Óñ¡ÓñòÓÑìÓññÓñ┐</strong> ÓñÅÓñ¬ÓÑìÓñ▓Óñ┐ÓñòÓÑçÓñÂÓñ¿ Óñ«ÓÑçÓñé ÓñåÓñ¬ÓñòÓñ¥ Óñ©ÓÑìÓñÁÓñ¥ÓñùÓññ Óñ╣ÓÑêÓÑñ ÓñçÓñ©
									ÓñÉÓñ¬ ÓñòÓñ¥ ÓñëÓñªÓÑìÓñªÓÑçÓñÂÓÑìÓñ» Óñ╣Óñ«Óñ¥Óñ░ÓÑç ÓñåÓñºÓÑìÓñ»Óñ¥ÓññÓÑìÓñ«Óñ┐Óñò Óñ©Óñ«ÓÑüÓñªÓñ¥Óñ» ÓñòÓÑï ÓñªÓÑêÓñ¿Óñ┐Óñò ÓñªÓñ░ÓÑìÓñÂÓñ¿, Óñ¡ÓñòÓÑìÓññÓñ┐ Óñ¡Óñ£Óñ¿,
									ÓñåÓñºÓÑìÓñ»Óñ¥ÓññÓÑìÓñ«Óñ┐Óñò Óñ©Óñ¥Óñ╣Óñ┐ÓññÓÑìÓñ», ÓñòÓÑÇÓñ░ÓÑìÓññÓñ¿ ÓñöÓñ░ Óñ▓Óñ¥ÓñçÓñÁ ÓñòÓñ¥Óñ░ÓÑìÓñ»ÓñòÓÑìÓñ░Óñ«ÓÑïÓñé ÓñòÓÑÇ Óñ©Óñ«Óñ»-Óñ©Óñ¥Óñ░ÓñúÓÑÇ ÓññÓñò ÓñåÓñ©Óñ¥Óñ¿
									Óñ¬Óñ╣ÓÑüÓñüÓñÜ Óñ¬ÓÑìÓñ░ÓñªÓñ¥Óñ¿ ÓñòÓñ░Óñ¿Óñ¥ Óñ╣ÓÑêÓÑñ Óñ╣Óñ«Óñ¥Óñ░Óñ¥ Óñ▓ÓñòÓÑìÓñÀÓÑìÓñ» ÓñåÓñºÓÑìÓñ»Óñ¥ÓññÓÑìÓñ«Óñ┐Óñò Óñ£ÓÑüÓñíÓñ╝Óñ¥ÓñÁ ÓñòÓÑï ÓñùÓñ╣Óñ░Óñ¥ ÓñòÓñ░Óñ¿Óñ¥ ÓñöÓñ░
									Óñ¡ÓñòÓÑìÓññÓñ┐ ÓñòÓÑç Óñ▓Óñ┐ÓñÅ ÓñåÓñÁÓñÂÓÑìÓñ»Óñò Óñ©Óñ¡ÓÑÇ Óñ©ÓñéÓñ©Óñ¥ÓñºÓñ¿ ÓñÅÓñò Óñ╣ÓÑÇ Óñ©ÓÑìÓñÑÓñ¥Óñ¿ Óñ¬Óñ░ Óñ¬ÓÑìÓñ░ÓñªÓñ¥Óñ¿ ÓñòÓñ░Óñ¿Óñ¥ Óñ╣ÓÑêÓÑñ
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
								className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-ry-gold/50 hover:border-ry-gold hover:bg-ry-gold/10 rounded-full text-ry-gold font-bold transition-all shadow-sm active:scale-95"
							>
								<MessageCircle size={20} />
								{settingsLanguage === "hi"
									? "Óñ©ÓñéÓñ¬Óñ░ÓÑìÓñò ÓñòÓñ░ÓÑçÓñé (Contact Us)"
									: "Contact Us"}
							</button>
						</div>
					</div>
				</div>

				{/* Modals omitted for brevity, keeping original modal code intact */}
				{showHelpModal &&
					createPortal(
						<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
							<div className="bg-ry-cream dark:bg-slate-800 w-full max-w-xs rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 relative border border-ry-gold/20">
								<button
									onClick={() => handleClose_HelpModal()}
									className="absolute top-4 right-4 p-1 text-slate-400 hover:text-ry-gold transition-colors"
								>
									<X size={20} />
								</button>
								<h3 className="text-xl font-bold text-ry-gold mb-6 text-center">
									{t.howToUse}
								</h3>

								<div className="space-y-4">
									<button
										onClick={() => {
											handleClose_HelpModal();
											onOpenOnboarding();
										}}
										className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-700/50 rounded-xl border border-ry-gold/20 hover:border-jm-accent/60 transition-all group active:scale-95 shadow-sm"
									>
										<div className="w-12 h-12 rounded-full bg-ry-gold/10 flex items-center justify-center text-ry-gold group-hover:scale-110 transition-transform">
											<Smartphone size={24} />
										</div>
										<div className="text-left">
											<h4 className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-ry-gold transition-colors">
												{t.appTour}
											</h4>
											<p className="text-xs text-slate-500 dark:text-slate-400">
												{t.tourDesc}
											</p>
										</div>
									</button>

									<button
										onClick={() => {
											window.open(youtubeLink, "_blank", "noopener,noreferrer");
										}}
										className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-700/50 rounded-xl border border-ry-gold/20 hover:border-red-400 transition-all group active:scale-95 shadow-sm"
									>
										<div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
											<Play size={24} className="ml-1" />
										</div>
										<div className="text-left">
											<h4 className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-red-500 transition-colors">
												{t.watchVideo}
											</h4>
											<p className="text-xs text-slate-500 dark:text-slate-400">
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
					settingsLanguage={settingsLanguage}
					onSuccess={() => {
						setShowGlorificationModal(false);
						setShowGlorificationThankYou(true);
					}}
				/>

				<ThankYouPopup
					isOpen={showGlorificationThankYou}
					onClose={() => setShowGlorificationThankYou(false)}
					settingsLanguage={settingsLanguage}
				/>

				{pendingLink &&
					createPortal(
						/* ... your existing pendingLink code ... */
						<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
							<div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl p-6 border border-white/10">
								<div className="flex flex-col items-center text-center">
									<div
										className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 ${pendingLink.colorClass} shadow-inner`}
									>
										{pendingLink.icon}
									</div>
									<h3 className="text-xl font-bold text-slate-800 mb-2">
										{t.openLink}
									</h3>
									<p className="text-sm text-slate-600 mb-8">
										{t.linkDesc} <br />
										<strong className="text-base text-slate-800 mt-1 block">
											{pendingLink.title}
										</strong>
									</p>
									<div className="flex gap-3 w-full">
										<button
											onClick={() => setPendingLink(null)}
											className="flex-1 py-3.5 text-slate-600 font-bold bg-slate-100 rounded-xl"
										>
											{t.cancel}
										</button>
										<button
											onClick={confirmNavigation}
											className="flex-1 py-3.5 text-white font-bold bg-ry-gold hover:bg-[#a67a26] rounded-xl flex items-center justify-center gap-2"
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
	settingsLanguage,
}: {
	onOpenGuruMaharaj: () => void;
	onOpenVirahiMaharaj: () => void;
	settingsLanguage: "en" | "hi";
}) => {
	const isHindi = settingsLanguage === "hi";
	const [currentIndex, setCurrentIndex] = useState(0);
	const [slides, setSlides] = useState<SlideData[]>([
		{ url: "/222.webp?v=2", type: "guru" },
		{ url: "/444.webp?v=2", type: "virahi" },
	]);

	const getLabel = (type: "guru" | "virahi") => {
		if (type === "guru") return isHindi ? "ÓñùÓÑüÓñ░ÓÑü Óñ«Óñ╣Óñ¥Óñ░Óñ¥Óñ£ Óñ£ÓÑÇ" : "Guru MaharajG";
		return isHindi ? "ÓñÁÓñ┐Óñ░Óñ╣ÓÑÇ Óñ£ÓÑÇ Óñ«Óñ╣Óñ¥Óñ░Óñ¥Óñ£" : "Virahi Ji Maharaj";
	};

	const touchStart = React.useRef({ x: 0, y: 0 });
	const touchEnd = React.useRef({ x: 0, y: 0 });

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
			className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden shadow-lg border-[1.5px] border-ry-gold/80 bg-ry-cream dark:bg-[#3A1010] group touch-pan-y cursor-pointer"
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
					{/* Changed from Blue to a neutral black gradient to let the images pop */}
					<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
				</div>
			))}

			{/* Left Arrow */}
			<button
				onClick={handlePrevSlide}
				className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all"
				aria-label="Previous slide"
			>
				<ChevronLeft size={24} />
			</button>

			{/* Right Arrow */}
			<button
				onClick={handleNextSlide}
				className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all"
				aria-label="Next slide"
			>
				<ChevronRight size={24} />
			</button>

			<div className="absolute bottom-3 left-4 right-4 flex justify-between items-center gap-3">
				<h3
					className="text-ry-gold font-serif font-bold text-xl md:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-wide"
					style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
				>
					{getLabel(slides[currentIndex].type)}
				</h3>

				<div className="flex gap-1.5">
					{slides.map((_, idx) => (
						<div
							key={idx}
							className={`w-1.5 h-1.5 rounded-full transition-colors ${
								idx === currentIndex ? "bg-ry-gold" : "bg-white/50"
							}`}
						/>
					))}
				</div>
			</div>
		</div>
	);
};

const GlassCard = memo(function GlassCard({
	title,
	onClick,
	icon,
	isLive,
	hasNewUpdate,
}: {
	title: string;
	onClick: () => void;
	icon: React.ReactNode;
	isLive?: boolean;
	hasNewUpdate?: boolean;
}) {
	const { isLowEnd } = useDevicePerformance();
	return (
		<motion.button
			onClick={onClick}
			whileHover={{ scale: 1.05, y: -4 }}
			whileTap={{ scale: 0.95 }}
			className="flex flex-col items-center gap-2 w-full group transition-transform"
		>
			<div
				className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border-[1.5px] border-amber-400/50 hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] bg-gradient-to-br from-[#FFFDF0]/90 to-[#FFF8E7]/90 dark:from-[#0B1D3A]/90 dark:to-[#0A2647]/90 hover:border-amber-400 transition-all flex items-center justify-center ${isLowEnd ? "" : "backdrop-blur-md"}`}
			>
				{/* Subtle peacock feather background overlay */}
				<div
					className="absolute inset-0 opacity-10 dark:opacity-10 pointer-events-none mix-blend-multiply dark:mix-blend-screen"
					style={{
						backgroundImage:
							"url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%23FFD700' d='M50,0 C77.61,0 100,22.39 100,50 C100,77.61 77.61,100 50,100 C22.39,100 0,77.61 0,50 C0,22.39 22.39,0 50,0 Z' opacity='0.5'/%3E%3C/svg%3E\")",
						backgroundSize: "20px 20px",
					}}
				></div>

				<div
					className={`relative z-10 text-teal-700 dark:text-amber-400 opacity-90 group-hover:opacity-100 ${isLowEnd ? "" : "transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]"}`}
				>
					{icon}
				</div>

				<div className="absolute inset-1 border border-amber-400/30 rounded-xl pointer-events-none z-10"></div>

				{/* LIVE Badge */}
				{isLive && (
					<div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm z-20 flex items-center gap-1">
						<span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
						LIVE
					</div>
				)}

				{/* New Update Badge */}
				{hasNewUpdate && !isLive && (
					<div className="absolute top-2 right-2 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/40 animate-pulse border border-red-400/50 z-20 flex items-center justify-center">
						NEW
					</div>
				)}
			</div>

			<span
				className="text-teal-900 dark:text-amber-400 font-bold text-lg md:text-xl tracking-wide leading-tight text-center px-1 mt-1"
				style={{ fontFamily: '"Comic Sans MS", cursive' }}
			>
				{title}
			</span>
		</motion.button>
	);
});

const ImageCard = memo(function ImageCard({
	title,
	onClick,
	imageUrl,
	isLive,
	hasNewUpdate,
}: {
	title: string;
	onClick: () => void;
	imageUrl: string;
	isLive?: boolean;
	hasNewUpdate?: boolean;
}) {
	const { isLowEnd } = useDevicePerformance();
	return (
		<motion.button
			onClick={onClick}
			whileHover={{ scale: 1.05, y: -4 }}
			whileTap={{ scale: 0.95 }}
			className="flex flex-col items-center gap-2 w-full group transition-transform"
		>
			<div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border-[1.5px] border-amber-400/50 hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] bg-gradient-to-br from-[#FFFDF0]/90 to-[#FFF8E7]/90 dark:from-[#0B1D3A]/90 dark:to-[#0A2647]/90 hover:border-amber-400 transition-all">
				<div
					className="absolute inset-0 opacity-[0.15] dark:opacity-[0.05] pointer-events-none mix-blend-multiply dark:mix-blend-screen"
					style={{
						backgroundImage: "/audio.webp?v=2",
					}}
				></div>

				<div className="absolute inset-0 p-0">
					<img
						src={imageUrl}
						alt={title}
						className={`w-full h-full object-cover object-center ${isLowEnd ? "" : "transition-transform duration-500 group-hover:scale-105"} opacity-90 group-hover:opacity-100 mix-blend-multiply dark:mix-blend-normal`}
					/>
				</div>

				{/* Updated Inner Border Effect to Amber */}
				<div className="absolute inset-1 border border-amber-400/30 rounded-xl pointer-events-none z-10"></div>

				{/* LIVE Badge */}
				{isLive && (
					<div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm z-20 flex items-center gap-1">
						<span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
						LIVE
					</div>
				)}

				{/* New Update Badge */}
				{hasNewUpdate && !isLive && (
					<div className="absolute top-2 right-2 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/40 animate-pulse border border-red-400/50 z-20 flex items-center justify-center">
						NEW
					</div>
				)}
			</div>

			<span
				className="text-teal-900 dark:text-amber-400 font-bold text-lg md:text-xl tracking-wide leading-tight text-center px-1 mt-1"
				style={{ fontFamily: '"Comic Sans MS", cursive' }}
			>
				{title}
			</span>
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
}: {
	title: string;
	onClick: () => void;
	imageUrls: string[];
	fallbackImageUrl?: string;
	fallbackIcon?: React.ReactNode;
	isLive?: boolean;
	hasNewUpdate?: boolean;
}) {
	const { isLowEnd } = useDevicePerformance();
	const [validUrls, setValidUrls] = useState<string[]>([]);
	const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
	const [currentIndex, setCurrentIndex] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Reset when imageUrls change
	useEffect(() => {
		setValidUrls([]);
		setFailedUrls(new Set());
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
		setFailedUrls((prev) => new Set(prev).add(url));
	};

	const showSlideshow = validUrls.length > 0;
	const safeIndex = validUrls.length > 0 ? currentIndex % validUrls.length : 0;
	const currentVisibleUrl = validUrls[safeIndex];

	return (
		<motion.button
			onClick={onClick}
			whileHover={{ scale: 1.05, y: -4 }}
			whileTap={{ scale: 0.95 }}
			className="flex flex-col items-center gap-2 w-full group transition-transform"
		>
			<div className="relative w-full aspect-[4/3]">
				{/* Fallback icon - hidden via opacity when slideshow is ready */}
				<div
					className={`absolute inset-0 rounded-2xl border-[1.5px] border-amber-400/50 shadow-lg overflow-hidden bg-gradient-to-br from-[#FFFDF0]/90 to-[#FFF8E7]/90 dark:from-[#0B1D3A]/90 dark:to-[#0A2647]/90 hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-opacity duration-700 ${
						showSlideshow
							? "opacity-0 pointer-events-none z-0"
							: "opacity-100 z-10"
					}`}
					style={{ willChange: "opacity" }}
				>
					<div
						className="absolute inset-0 opacity-[0.15] dark:opacity-[0.05] pointer-events-none mix-blend-multiply dark:mix-blend-screen"
						style={{
							backgroundImage:
								"url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
						}}
					></div>

					{fallbackImageUrl ? (
						<img
							src={fallbackImageUrl}
							alt={title}
							className={`w-full h-full object-cover object-center ${isLowEnd ? "" : "transition-transform duration-500 group-hover:scale-105"} opacity-90 group-hover:opacity-100 mix-blend-multiply dark:mix-blend-normal`}
						/>
					) : fallbackIcon ? (
						<div
							className={`absolute inset-0 flex items-center justify-center text-teal-700 dark:text-amber-400 opacity-80 group-hover:opacity-100 ${isLowEnd ? "" : "transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]"}`}
						>
							{fallbackIcon}
						</div>
					) : null}

					<div className="absolute inset-1 border border-amber-400/30 rounded-xl pointer-events-none"></div>

					{isLive && (
						<div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm z-20 flex items-center gap-1">
							<span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
							LIVE
						</div>
					)}

					{hasNewUpdate && !isLive && (
						<div className="absolute top-2 right-2 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/40 animate-pulse border border-red-400/50 z-20 flex items-center justify-center">
							NEW
						</div>
					)}
				</div>

				{/* Slideshow - simple opacity crossfade, no 3D transforms */}
				<div
					className={`absolute inset-0 rounded-2xl border-[1.5px] border-amber-400/50 shadow-lg hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:border-amber-400 overflow-hidden transition-opacity duration-700 ${
						showSlideshow ? "opacity-100 z-10" : "opacity-0 z-0"
					}`}
					style={{ willChange: "opacity" }}
				>
					{imageUrls.map((url) => {
						if (failedUrls.has(url)) return null;
						const isVisible = url === currentVisibleUrl;

						return (
							<img
								key={url}
								src={url}
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

					<div className="absolute inset-1 border border-ry-gold/30 rounded-xl pointer-events-none z-20"></div>

					{/* Dot indicators */}
					{validUrls.length > 1 && (
						<div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-20">
							{validUrls.map((_, idx) => (
								<div
									key={idx}
									className={`rounded-full transition-all duration-300 ${
										idx === safeIndex
											? "bg-ry-gold w-4 h-1.5"
											: "bg-white/60 w-1.5 h-1.5"
									}`}
								/>
							))}
						</div>
					)}

					{isLive && (
						<div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm z-20 flex items-center gap-1">
							<span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
							LIVE
						</div>
					)}

					{hasNewUpdate && !isLive && (
						<div className="absolute top-2 right-2 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/40 animate-pulse border border-red-400/50 z-20 flex items-center justify-center">
							NEW
						</div>
					)}
				</div>
			</div>

			<span
				className="text-teal-900 dark:text-amber-400 font-bold text-lg md:text-xl tracking-wide leading-tight text-center px-1 mt-1"
				style={{ fontFamily: '"Comic Sans MS", cursive' }}
			>
				{title}
			</span>
		</motion.button>
	);
});

// Card for Social Media & Features - Text Below Icon
const SocialCard = memo(function SocialCard({
	title,
	onClick,
	icon,
	colorClass,
}: {
	title: string;
	onClick: () => void;
	icon: React.ReactNode;
	colorClass: string;
}) {
	const { isLowEnd } = useDevicePerformance();
	return (
		<motion.button
			onClick={onClick}
			whileHover={{ scale: 1.05, y: -4 }}
			whileTap={{ scale: 0.95 }}
			className="flex flex-col items-center gap-2 w-full group transition-transform"
		>
			<div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border-[1.5px] border-amber-400/50 hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] bg-gradient-to-br from-[#FFFDF0]/90 to-[#FFF8E7]/90 dark:from-[#0B1D3A]/90 dark:to-[#0A2647]/90 hover:border-amber-400 transition-all flex items-center justify-center">
				<div
					className="absolute inset-0 opacity-[0.15] dark:opacity-[0.05] pointer-events-none mix-blend-multiply dark:mix-blend-screen"
					style={{
						backgroundImage:
							"url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
					}}
				></div>

				{/* Changed icon color to Amber/Teal */}
				<div
					className={`relative z-10 text-teal-700 dark:text-amber-400 opacity-90 group-hover:opacity-100 ${isLowEnd ? "" : "transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]"}`}
				>
					{React.cloneElement(icon as any, {
						size: 36,
						strokeWidth: 1.5,
						className:
							"drop-shadow-[0_2px_4px_rgba(188,141,49,0.3)] transition-all",
					})}
				</div>

				{/* Updated Inner Border Effect to Amber */}
				<div className="absolute inset-1 border border-amber-400/30 rounded-xl pointer-events-none"></div>
			</div>

			<span
				className="text-teal-900 dark:text-amber-400 font-bold text-lg md:text-xl tracking-wide leading-tight text-center px-1 mt-1 flex items-center justify-center gap-1"
				style={{ fontFamily: '"Comic Sans MS", cursive' }}
			>
				{title}
			</span>
		</motion.button>
	);
});

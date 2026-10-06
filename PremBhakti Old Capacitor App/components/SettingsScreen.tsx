import { Capacitor } from "@capacitor/core";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import {
	Check,
	ChevronRight,
	Clock,
	Compass,
	ExternalLink,
	HardDrive,
	Info,
	Languages,
	Layout,
	Loader2,
	MessageCircle,
	Monitor,
	Moon,
	Palette,
	Shield,
	ShieldCheck,
	Smartphone,
	Sun,
	Trash2,
	X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { auth, db } from "../services/firebase";
import { requestTourReplay } from "../src/tour/tourBus";
import type {
	Bhajan,
	Book,
	EventData,
	LectureData,
	ScriptType,
	ThemeColor,
	ThemeMode,
} from "../types";
import {
	iosOnSnapshotCollection,
	shouldUseRestFallback,
} from "../utils/firebaseRest";
import { THEME_PALETTES } from "../utils/theme";
import { BackupRestoreSection } from "./BackupRestoreSection";
import { DeveloperOptions } from "./DeveloperOptions";
import { FeedbackModal } from "./FeedbackModal";

// The admin CMS is ~26k lines that only admins ever open. Loading it lazily
// keeps it out of the chunk every devotee downloads and parses with Settings.
const AdminPanel = React.lazy(() =>
	import("./AdminPanel").then((m) => ({ default: m.AdminPanel })),
);

const AdminPanelLoading = () => (
	<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-100 dark:bg-slate-900">
		<div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
	</div>
);

interface SettingsScreenProps {
	isOpen: boolean;
	onClose: () => void;
	uiScale: number;
	onUiScaleChange: (scale: number) => void;
	script: ScriptType;
	onScriptChange: (script: ScriptType) => void;
	darkMode: boolean; // Keep for compatibility if needed, but UI uses themeMode
	onThemeChange: (isDark: boolean) => void; // Keep for compatibility

	themeMode?: ThemeMode; // Optional to prevent breaking if not passed immediately during refactor
	onThemeModeChange?: (mode: ThemeMode) => void;

	keepAwake: boolean;
	onKeepAwakeChange: (val: boolean) => void;
	settingsLanguage: "en" | "hi";
	onSettingsLanguageChange: (lang: "en" | "hi") => void;

	// New Settings Props
	scrollBarSide: "left" | "right";
	onScrollBarSideChange: (side: "left" | "right") => void;
	azSliderSide: "left" | "right";
	onAzSliderSideChange: (side: "left" | "right") => void;
	indexMode?: "latin" | "devanagari";

	themeColor: ThemeColor;
	onThemeColorChange: (color: ThemeColor) => void;

	devMode: boolean;
	onDevModeChange: (val: boolean) => void;
	hapticsEnabled: boolean;
	onHapticsEnabledChange: (val: boolean) => void;

	// Legacy unused props to prevent App.tsx from breaking during build
	onResetData?: () => void;
	onRestoreDeleted?: () => void;
	onAddBhajan?: () => void;
	onImportData?: (json: string) => boolean;

	allBhajans: Bhajan[];

	// Admin Data Props
	allBooks?: Book[];
	books?: Book[];
	allLectures?: LectureData[];
	lectures?: LectureData[];
	events?: EventData[];
	onUpdateBhajans?: (data: Bhajan[]) => void;
	onUpdateBooks?: (data: Book[]) => void;
	onUpdateLectures?: (data: LectureData[]) => void;
	onUpdateEvents?: (data: EventData[]) => void;
	adminPanelRef?: React.RefObject<{ popScreen: () => boolean }>;
}

import {
	SUPER_ADMIN_EMAILS,
	SUPER_ADMIN_PHONES,
} from "../src/constants/admins";

const ADMIN_EMAILS = ["damodar@cpbs.com"];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
	isOpen,
	onClose,
	uiScale,
	onUiScaleChange,
	script,
	onScriptChange,
	darkMode,
	onThemeChange,
	themeMode,
	onThemeModeChange,
	keepAwake,
	onKeepAwakeChange,
	settingsLanguage,
	onSettingsLanguageChange,
	scrollBarSide,
	onScrollBarSideChange,
	azSliderSide,
	onAzSliderSideChange,
	indexMode,
	themeColor,
	onThemeColorChange,
	devMode,
	onDevModeChange,
	hapticsEnabled,
	onHapticsEnabledChange,

	// Accept the legacy props but don't strictly require/use them here
	onResetData,
	onRestoreDeleted,
	onAddBhajan,
	onImportData,

	allBhajans,
	allBooks,
	books,
	allLectures,
	lectures,
	events,
	onUpdateBhajans,
	onUpdateBooks,
	onUpdateLectures,
	onUpdateEvents,
	adminPanelRef,
}) => {
	const { showToast } = useToast();
	const { profile, user } = useAuth();

	const isSuperAdminUser =
		profile?.role === "super_admin" ||
		(user?.email && SUPER_ADMIN_EMAILS.includes(user.email)) ||
		(user?.phoneNumber && SUPER_ADMIN_PHONES.includes(user.phoneNumber));

	const isMandalAdmin =
		profile?.role === "mandal_admin" && !!profile?.mandalAdminFor;
	const [_showMandalAdmin, _setShowMandalAdmin] = useState(false);
	const clickCountRef = useRef(0);
	const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [showPasswordModal, setShowPasswordModal] = useState(false);
	// Back-button: showPasswordModal
	useEffect(() => {
		if (showPasswordModal)
			window.history.pushState({ isPopup: true, view: "password-modal" }, "");
	}, [showPasswordModal]);
	useEffect(() => {
		const h = (e: PopStateEvent) => {
			if (showPasswordModal && e.state?.view !== "password-modal")
				setShowPasswordModal(false);
		};
		window.addEventListener("popstate", h);
		return () => window.removeEventListener("popstate", h);
	}, [showPasswordModal]);
	const handleClose_PasswordModal = () => {
		if (window.history.state?.view === "password-modal")
			window.history.replaceState({ isPopup: true, view: "settings" }, "");
		setShowPasswordModal(false);
	};
	const [passwordInput, setPasswordInput] = useState("");
	const [dynamicAdminEmails, setDynamicAdminEmails] =
		useState<string[]>(ADMIN_EMAILS);
	const [selectedEmail, setSelectedEmail] = useState(ADMIN_EMAILS[0]);
	const [authAction, setAuthAction] = useState<"ENABLE" | "DISABLE">("ENABLE");
	const [authLoading, setAuthLoading] = useState(false);
	const [showDisabledMsg, setShowDisabledMsg] = useState(false);
	const [pendingLink, setPendingLink] = useState<{
		url: string;
		title: string;
		icon?: React.ReactNode;
	} | null>(null);
	const [showThemeModal, setShowThemeModal] = useState(false);
	// Back-button: showThemeModal
	useEffect(() => {
		if (showThemeModal)
			window.history.pushState({ isPopup: true, view: "theme-modal" }, "");
	}, [showThemeModal]);
	useEffect(() => {
		const h = (e: PopStateEvent) => {
			if (showThemeModal && e.state?.view !== "theme-modal")
				setShowThemeModal(false);
		};
		window.addEventListener("popstate", h);
		return () => window.removeEventListener("popstate", h);
	}, [showThemeModal]);
	const handleClose_ThemeModal = () => {
		if (window.history.state?.view === "theme-modal")
			window.history.replaceState({ isPopup: true, view: "settings" }, "");
		setShowThemeModal(false);
	};
	const [showFeedbackModal, setShowFeedbackModal] = useState(false);
	const [infoPopup, setInfoPopup] = useState<{
		title: string;
		description: string;
	} | null>(null);
	const [autoOpenAdmin, setAutoOpenAdmin] = useState(false);
	const [adminPanelOpen, setAdminPanelOpen] = useState(false);
	// Mirrors DeveloperOptions' own (separate) admin-panel-open state, via
	// onAdminPanelToggle below, so this screen's own header stays hidden for
	// that entry point too — otherwise it flashes underneath the admin panel's
	// slide-in animation since it isn't gated by `adminPanelOpen` above.
	const [devAdminPanelOpen, setDevAdminPanelOpen] = useState(false);
	const [initialAdminScreen, setInitialAdminScreen] = useState<
		"home" | "mandal_manager"
	>("home");
	const [_emailsLoaded, setEmailsLoaded] = useState(false);

	// ── Clear Cache Modal State ──
	const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

	// ────────────────────────────────────────────────────────────────────────────
	// IMPORTANT: Key classification guide
	//
	// SAFE to clear (user-facing cache, re-fetched automatically):
	//   cpbs_all_bhajans, cpbs_all_books, cpbs_all_lectures, cpbs_events
	//   cpbs_bhajans_bundle_time, cpbs_books_bundle_time, cpbs_lectures_bundle_time
	//   cpbs_quote_last_seen_date, cpbs_quote_last_seen_afternoon
	//   cpbs_notif_history, cpbs_last_read_info_title, cpbs_read_info_ids
	//   cpbs_size_cache (network file sizes), cpbs_recent_searches
	//   dl_* / download tracking keys
	//
	// DO NOT CLEAR (developer/admin critical — loss causes data corruption or analytics gaps):
	//   cpbs_device_id           — anonymous device identity for dedup analytics
	//   cpbs_likes_*             — prevents double-counting user likes in Firestore
	//   cpbs_views_*             — prevents double-counting user views in Firestore
	//   cpbs_playlists           — user-created playlists
	//   cpbs_bookmarks           — user-created bookmarks
	//   cpbs_history             — user listening history
	//   cpbs_forced_cyan_update_v1 — one-time migration flag, clearing causes re-run
	//   cpbs_dev_mode            — developer mode flag
	// ────────────────────────────────────────────────────────────────────────────

	const CACHE_OPTIONS = [
		{
			id: "appPrefs",
			label: "App Preferences Cache",
			desc: "Resets theme, language, font size and other display settings",
			icon: "⚙️",
			always: true,
		},
		{
			id: "contentCache",
			label: "Content Sync Cache",
			desc: "Clears local bhajans/books/lectures data — re-synced from server on next open",
			icon: "🔄",
			always: true,
		},
		{
			id: "miscCache",
			label: "Misc App Cache",
			desc: "Quote popup date, recent searches, file size cache",
			icon: "📦",
			always: true,
		},
		{
			id: "swCache",
			label: "Service Worker Cache",
			desc: "Offline PWA files & assets (web only)",
			icon: "🌐",
			web: true,
		},
	].filter((o) => o.always || (o.web && platform === "web"));

	const [showCacheModal, setShowCacheModal] = useState(false);
	// Default: all safe options selected. swCache excluded on non-web.
	const SAFE_DEFAULT_IDS = new Set(
		CACHE_OPTIONS.filter((o) => o.id !== "swCache").map((o) => o.id),
	);
	const [selectedCacheIds, setSelectedCacheIds] =
		useState<Set<string>>(SAFE_DEFAULT_IDS);
	const [clearingCache, setClearingCache] = useState(false);
	const [cacheToast, setCacheToast] = useState<{
		msg: string;
		type: "success" | "error";
	} | null>(null);

	// Push history state when cache modal opens so back button closes modal, not Settings
	useEffect(() => {
		if (showCacheModal) {
			window.history.pushState({ isPopup: true, view: "cache-modal" }, "");
		}
	}, [showCacheModal]);

	useEffect(() => {
		const handlePopState = (e: PopStateEvent) => {
			if (showCacheModal && e.state?.view !== "cache-modal") {
				setShowCacheModal(false);
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [showCacheModal]);

	const showCacheToast = (
		msg: string,
		type: "success" | "error" = "success",
	) => {
		setCacheToast({ msg, type });
		setTimeout(() => setCacheToast(null), 3500);
	};

	const executeClearCache = async () => {
		if (selectedCacheIds.size === 0) return;
		setClearingCache(true);
		const errors: string[] = [];

		try {
			// ── Option: App Preferences Cache ──
			// Surgically removes only display/UX preference keys.
			// PRESERVES: device_id, metrics dedup keys, playlists, bookmarks, history,
			//            migration flags — all of which are developer-critical.
			if (selectedCacheIds.has("appPrefs")) {
				const PREFS_KEYS = [
					"cpbs_theme_mode",
					"cpbs_theme_color",
					"cpbs_dark_mode",
					"cpbs_fontsize",
					"cpbs_ui_scale",
					"cpbs_script",
					"cpbs_awake",
					"cpbs_haptics",
					"cpbs_settings_lang",
					"cpbs_scrollbar_side",
					"cpbs_slider_side",
					"cpbs_index_mode",
					"cpbs_language",
				];
				PREFS_KEYS.forEach((k) => localStorage.removeItem(k));
			}

			// ── Option: Content Sync Cache ──
			// Clears the locally cached bhajans/books/lectures/events data and
			// their bundle timestamps so the app re-fetches fresh data from Firestore.
			// Also clears download tracking keys.
			// PRESERVES: playlists, bookmarks, history (user-created data).
			if (selectedCacheIds.has("contentCache")) {
				const CONTENT_KEYS = [
					"cpbs_all_bhajans",
					"cpbs_all_books",
					"cpbs_all_lectures",
					"cpbs_events",
					"cpbs_bhajans_bundle_time",
					"cpbs_books_bundle_time",
					"cpbs_lectures_bundle_time",
					"cpbs_lectures_github_bundle_time",
				];
				CONTENT_KEYS.forEach((k) => localStorage.removeItem(k));
				// Clear download tracking keys (dl_* prefix) — NOT actual device files
				Object.keys(localStorage)
					.filter((k) => k.startsWith("dl_") || k.includes("_download_path"))
					.forEach((k) => localStorage.removeItem(k));
			}

			// ── Option: Misc App Cache ──
			// Clears smaller cached states that are safe to reset.
			// NOTE: cpbs_notif_history is intentionally NOT cleared here — it is
			// admin-only Firestore cache (NotificationSender) and irrelevant to users.
			if (selectedCacheIds.has("miscCache")) {
				const MISC_KEYS = [
					"cpbs_quote_last_seen_date",
					"cpbs_quote_last_seen_afternoon",
					"cpbs_last_read_info_title",
					"cpbs_read_info_ids",
				];
				MISC_KEYS.forEach((k) => localStorage.removeItem(k));
				// Recent searches & file size cache
				Object.keys(localStorage)
					.filter(
						(k) => k === "cpbs_recent_searches" || k === "cpbs_size_cache",
					)
					.forEach((k) => localStorage.removeItem(k));
			}

			// ── Option: Service Worker Cache (web only) ──
			if (selectedCacheIds.has("swCache") && "caches" in window) {
				try {
					const keys = await caches.keys();
					await Promise.all(keys.map((k) => caches.delete(k)));
				} catch (_e) {
					errors.push("Service worker cache");
				}
			}

			setShowCacheModal(false);
			if (errors.length > 0) {
				showCacheToast(`Cleared with issues: ${errors.join(", ")}`, "error");
				setTimeout(() => window.location.reload(), 1500);
			} else {
				showCacheToast("✅ Cache cleared! Restarting app…");
				setTimeout(() => window.location.reload(), 1800);
			}
		} catch (e: any) {
			showCacheToast(`Failed: ${e.message}`, "error");
		} finally {
			setClearingCache(false);
		}
	};

	// useEffect(() => {
	// 	if (showPasswordModal) {
	// 		setDynamicAdminEmails(ADMIN_EMAILS);
	// 		setSelectedEmail(ADMIN_EMAILS[0]);
	// 		setEmailsLoaded(true);
	// 	}
	// }, [showPasswordModal]);

	useEffect(() => {
		const fetchAdminRoles = async () => {
			try {
				let emails: string[] = [];
				if (shouldUseRestFallback()) {
					// iOS: use REST polling — getDocs/Firebase SDK fails on WKWebView
					await new Promise<void>((resolve) => {
						const unsub = iosOnSnapshotCollection(
							"admin_roles",
							(snapshot: any) => {
								emails = snapshot.docs.map((d: any) => d.id);
								unsub();
								resolve();
							},
							() => resolve(),
						);
					});
				} else {
					const rolesSnapshot = await getDocs(collection(db, "admin_roles"));
					emails = rolesSnapshot.docs.map((doc) => doc.id);
				}
				const allEmails = Array.from(
					new Set([...ADMIN_EMAILS, ...emails]),
				).filter((email) => email && email.trim() !== "");
				setDynamicAdminEmails(allEmails);
				if (!allEmails.includes(selectedEmail) && allEmails.length > 0) {
					setSelectedEmail(allEmails[0]);
				}
			} catch (error) {
				console.error("Error fetching admin roles:", error);
			} finally {
				setEmailsLoaded(true);
			}
		};
		if (showPasswordModal) {
			setEmailsLoaded(false);
			fetchAdminRoles();
		}
	}, [showPasswordModal, selectedEmail]);

	// Translations
	const t = {
		en: {
			title: "Settings",
			sectionDisplay: "Display & Text",
			descDisplay: "Adjust text size and app theme (Light/Dark mode).",
			sectionContent: "Content & Language",
			descContent: "Choose App language and Bhajan script (Hindi/English).",
			sectionInterface: "Interface Layout",
			descInterface: "Customize layout for left/right handed use.",
			sectionSystem: "System & Support",
			descSystem: "Screen wake lock and support options.",
			sectionStorage: "Storage & Maintenance",
			descStorage: "Manage app data and cache.",

			uiScale: "App UI Size",
			theme: "App Theme",
			themeAuto: "Auto",
			themeLight: "Light",
			themeDark: "Dark",
			moreThemes: "Color Themes",

			scrollBarPos: "Scrollbar",
			azSliderPos: "Slider",
			left: "Left",
			right: "Right",

			bhajanLang: "Bhajan Script",
			appLang: "App Language",

			keepAwake: "Keep Screen Awake",
			keepAwakeDesc: "Prevents screen from turning off while reading",

			feedback: "Send Feedback",
			feedbackDesc: "Contact us on WhatsApp",
			replayTour: "Replay guided tour",
			replayTourDesc: "See the tips for every screen again",

			clearCache: "Clear App Cache",
			clearCacheDesc: "Fix issues by resetting local data",

			devOptions: "Developer Mode",
			devEnabled: "Active (Tap 3x to Disable)",
			devDisabled: "Inactive",

			systemHaptics: "Vibrations",
			systemHapticsDesc: "Vibration on interactions",

			enterPass: "Developer Login",
			passDisable: "Password to Disable",
			cancel: "Cancel",
			submit: "Login",
			close: "Close",

			infoDisplay:
				"Adjust text size, spacing, and app appearance.\nChoose Light, Dark, or Auto mode for reading.",
			infoContent:
				"Select App Language and Bhajan Script.\nChoose between Hindi or English script.",
			infoInterface:
				"Customize controls for left/right-hand usage.\nMove scrollbars and sliders to preferred side.",
			infoSystem:
				"Keep screen awake while reading.\nEnable haptic feedback for vibration on interactions.\nContact us directly on WhatsApp for help.",
			infoStorage:
				"Manage app storage and cache.\nClear local data to fix loading issues.",
			infoHaptics:
				"When Haptics are enabled, your phone will lightly vibrate when you press buttons or change pages. This improves the app experience.",
		},
		hi: {
			title: "सेटिंग्स",
			sectionDisplay: "दिखावट और अक्षर",
			descDisplay: "अक्षर का आकार और ऐप का थीम (लाइट/डार्क) बदलें।",
			sectionContent: "भाषा और सामग्री",
			descContent: "ऐप की भाषा और भजन की लिपि (हिंदी/अंग्रेजी) चुनें।",
			sectionInterface: "इंटरफ़ेस लेआउट",
			descInterface: "बाएं/दाएं हाथ के उपयोग के लिए लेआउट बदलें।",
			sectionSystem: "सिस्टम और सहायता",
			descSystem: "स्क्रीन ऑन रखने और सहायता के विकल्प।",
			sectionStorage: "स्टोरेज और रखरखाव",
			descStorage: "ऐप डेटा और कैश प्रबंधित करें।",

			uiScale: "ऐप का आकार",
			theme: "ऐप का थीम",
			themeAuto: "ऑटो",
			themeLight: "लाइट",
			themeDark: "डार्क",
			moreThemes: "रंग थीम",

			scrollBarPos: "स्क्रोलबार",
			azSliderPos: "स्लाइडर",
			left: "बायाँ",
			right: "दायाँ",

			bhajanLang: "भजन की लिपि",
			appLang: "ऐप की भाषा",

			keepAwake: "स्क्रीन को जगाए रखें",
			keepAwakeDesc: "पढ़ते समय स्क्रीन बंद नहीं होगी",

			feedback: "सुझाव भेजें",
			feedbackDesc: "व्हाट्सएप पर संपर्क करें",
			replayTour: "गाइडेड टूर फिर से देखें",
			replayTourDesc: "हर स्क्रीन के सुझाव फिर से देखें",

			clearCache: "ऐप कैश मिटाएं",
			clearCacheDesc: "डेटा रीसेट करके समस्याएं ठीक करें",

			devOptions: "डेवलपर मोड",
			devEnabled: "सक्रिय (बंद करने के लिए 3 बार टैप करें)",
			devDisabled: "निष्क्रिय",

			systemHaptics: "कंपन",
			systemHapticsDesc: "स्पर्श करने पर कंपन",

			enterPass: "डेवलपर लॉगिन",
			passDisable: "अक्षम करने के लिए पासवर्ड",
			cancel: "रद्द करें",
			submit: "लॉगिन",
			close: "बंद करें",

			infoDisplay:
				"अक्षर का आकार, अंतराल और ऐप का रंग-रूप बदलें।\nपढ़ने के लिए आरामदायक लाइट, डार्क या ऑटो मोड चुनें।",
			infoContent:
				"ऐप की भाषा और भजन की लिपि (हिंदी/अंग्रेजी) चुनें।\nभजन पढ़ने के लिए अपनी पसंदीदा लिपि सेट करें।",
			infoInterface:
				"बाएं/दाएं हाथ के उपयोग के लिए लेआउट बदलें।\nकंट्रोल और स्क्रोलबार की दिशा अपनी सुविधानुसार सेट करें।",
			infoSystem:
				"पढ़ते समय स्क्रीन को बंद होने से रोकें।\nबटन दबाने पर कंपन के लिए हैप्टिक्स चालू करें।\nकिसी भी समस्या या सहायता के लिए सीधे व्हाट्सएप पर संपर्क करें।",
			infoStorage:
				"ऐप डेटा और कैश प्रबंधित करें।\nलोडिंग समस्याओं को ठीक करने के लिए डेटा साफ़ करें।",
			infoHaptics:
				"हैप्टिक्स चालू रहने से जब भी आप कोई बटन दबाएंगे या पेज बदलेंगे, तो आपका फोन हल्का सा कंपन करेगा। इससे ऐप इस्तेमाल करने का अनुभव बेहतर होता है।",
		},
	}[settingsLanguage];

	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_ThemeModal, handleClose_PasswordModal are recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (!isOpen) {
			clickCountRef.current = 0;
			handleClose_PasswordModal();
			setShowDisabledMsg(false);
			setPendingLink(null);
			setPasswordInput("");
			handleClose_ThemeModal();
			setInfoPopup(null);
			setAutoOpenAdmin(false);
			setDevAdminPanelOpen(false);
			if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
		}
	}, [isOpen]);

	const openInfoPopup = (title: string, description: string) => {
		setInfoPopup({ title, description });
	};

	const closeInfoPopup = () => {
		setInfoPopup(null);
	};

	const handleSecretClick = () => {
		if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
		clickCountRef.current += 1;

		clickTimeoutRef.current = setTimeout(() => {
			clickCountRef.current = 0;
		}, 1000);

		if (clickCountRef.current >= 3) {
			clickCountRef.current = 0;
			if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

			if (devMode) {
				onDevModeChange(false);
				showToast(
					settingsLanguage === "en"
						? "Developer Mode Disabled"
						: "डेवलपर मोड अक्षम किया गया",
				);
			} else {
				if (isSuperAdminUser) {
					onDevModeChange(true);
					showToast(
						settingsLanguage === "en"
							? "Developer Mode Enabled"
							: "डेवलपर मोड सक्षम किया गया",
					);
				} else {
					setAuthAction("ENABLE");
					setShowPasswordModal(true);
				}
			}
		}
	};

	const handlePasswordSubmit = async (e?: React.FormEvent) => {
		e?.preventDefault();

		// Blur active element to trigger autofill save prompt on mobile
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}

		if (passwordInput === "") {
			showToast("Please enter password", "error");
			return;
		}

		setAuthLoading(true);

		try {
			await signInWithEmailAndPassword(auth, selectedEmail, passwordInput);

			// Success
			handleClose_PasswordModal();
			setPasswordInput("");
			import("../utils/haptic").then(({ triggerHaptic }) =>
				triggerHaptic("success", true),
			);
			if (authAction === "ENABLE") {
				onDevModeChange(true);
				setAutoOpenAdmin(true);
			}
		} catch (error: any) {
			console.error("Auth failed", error);
			showToast(
				settingsLanguage === "en"
					? "Authentication Failed: Incorrect Password"
					: "प्रमाणीकरण विफल: गलत पासवर्ड",
				"error",
			);
			setPasswordInput("");
		} finally {
			setAuthLoading(false);
		}
	};

	const handleFeedback = () => {
		setShowFeedbackModal(true);
	};

	const confirmNavigation = () => {
		if (pendingLink) {
			window.open(pendingLink.url, "_blank", "noopener,noreferrer");
			setPendingLink(null);
		}
	};

	const handleClearCache = () => setShowCacheModal(true);

	const handleCloseCacheModal = () => {
		// Restore parent settings state to avoid dead placeholder entries in history
		if (window.history.state?.view === "cache-modal") {
			window.history.replaceState({ isPopup: true, view: "settings" }, "");
		}
		setShowCacheModal(false);
	};

	const themeColors: { key: ThemeColor; label: string; color: string }[] = [
		{
			key: "deepBlue",
			label: "Deep Blue",
			color: THEME_PALETTES.deepBlue["500"],
		},
		{ key: "lime", label: "Lime", color: THEME_PALETTES.lime["500"] },
		{ key: "emerald", label: "Emerald", color: THEME_PALETTES.emerald["500"] },
		{ key: "teal", label: "Teal", color: THEME_PALETTES.teal["500"] },
		{ key: "cyan", label: "Cyan", color: THEME_PALETTES.cyan["500"] },
		{ key: "sky", label: "Sky", color: THEME_PALETTES.sky["500"] },
		{ key: "blue", label: "Ocean", color: THEME_PALETTES.blue["500"] },
		{ key: "indigo", label: "Indigo", color: THEME_PALETTES.indigo["500"] },
		{ key: "violet", label: "Violet", color: THEME_PALETTES.violet["500"] },
		{ key: "purple", label: "Royal", color: THEME_PALETTES.purple["500"] },
		{ key: "fuchsia", label: "Fuchsia", color: THEME_PALETTES.fuchsia["500"] },
		{ key: "pink", label: "Pink", color: THEME_PALETTES.pink["500"] },
		{ key: "rose", label: "Rose", color: THEME_PALETTES.rose["500"] },
	];

	if (!isOpen) return null;

	let buttonContent = devMode ? t.devEnabled : t.devDisabled;
	let buttonClass = devMode
		? "bg-green-600 hover:bg-green-700 active:bg-green-800 cursor-pointer select-none"
		: "bg-ry-gold hover:bg-gold-700";

	if (showDisabledMsg) {
		buttonContent = t.devDisabled;
		buttonClass = "bg-slate-500 cursor-default";
	}

	const sliderLabel = indexMode === "latin" ? "A-Z Slider" : "अ-ज्ञ Slider";
	const currentThemeMode = themeMode || (darkMode ? "dark" : "light");

	const handleModeChange = (mode: ThemeMode) => {
		if (onThemeModeChange) {
			onThemeModeChange(mode);
		} else {
			onThemeChange(mode === "dark");
		}
	};

	return (
		<>
			{/* Admin Panel (Standalone) — Used by Mandal Admin shortcut */}
			{adminPanelOpen && (
				<React.Suspense fallback={<AdminPanelLoading />}>
					<AdminPanel
						isOpen={adminPanelOpen}
						onClose={() => setAdminPanelOpen(false)}
						bhajans={allBhajans || []}
						allBooks={allBooks || books || []}
						allLectures={allLectures || lectures || []}
						events={events || []}
						settingsLanguage={settingsLanguage}
						onUpdateBhajans={onUpdateBhajans || (() => {})}
						onUpdateBooks={onUpdateBooks || (() => {})}
						onUpdateLectures={onUpdateLectures || (() => {})}
						onUpdateEvents={onUpdateEvents || (() => {})}
						initialScreen={initialAdminScreen}
						ref={adminPanelRef}
					/>
				</React.Suspense>
			)}

			<div className="fixed inset-0 z-50 bg-cream-50 dark:bg-ink-900 flex flex-col animate-in slide-in-from-left duration-300 font-body">
				{/* Background Pattern */}
				<div
					className="absolute inset-0 opacity-10 pointer-events-none"
					style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
					}}
				></div>

				{/* Header */}
				{!adminPanelOpen && !devAdminPanelOpen && (
					<div
						dir="ltr"
						className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between shadow-lg z-10 rounded-b-3xl border-b-2 border-ry-gold/40"
					>
						<div className="flex items-center gap-4">
							<button
								onClick={onClose}
								className="relative z-10 p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
								type="button"
							>
								<X className="w-6 h-6" />
							</button>
							<h2 className="font-display relative z-10 text-xl font-semibold tracking-wide leading-none drop-shadow-md">
								{t.title}
							</h2>
						</div>
					</div>
				)}

				{/* Content */}
				<div
					className={`flex-1 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} relative z-0`}
				>
					<div
						dir={scrollBarSide === "left" ? "ltr" : undefined}
						className="p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-6 max-w-2xl mx-auto mt-2"
					>
						{/* ── Mandal Admin Card (only for mandal_admin role) ── */}
						{isMandalAdmin && (
							<div className="bg-gradient-to-br from-ry-maroon to-rose-900 dark:from-black dark:to-rose-950 rounded-3xl p-5 border border-ry-gold/30 shadow-lg">
								<div className="flex items-center gap-3 mb-3">
									<Shield className="w-6 h-6 text-ry-gold" />
									<div>
										<h3 className="text-ry-gold font-bold text-base">
											{settingsLanguage === "hi"
												? "मंडल प्रशासक"
												: "Mandal Administrator"}
										</h3>
										<p className="text-ry-gold/60 text-xs">
											{settingsLanguage === "hi"
												? "अपने मंडल के भक्तों का प्रबंधन करें"
												: "Manage devotees in your mandal"}
										</p>
									</div>
								</div>
								<button
									onClick={() => {
										setInitialAdminScreen("mandal_manager");
										setAdminPanelOpen(true);
									}}
									className="w-full bg-ry-gold text-ry-maroon font-bold py-2.5 rounded-2xl active:scale-95 transition-transform text-sm"
								>
									{settingsLanguage === "hi"
										? "📋 मंडल पैनल खोलें"
										: "📋 Open Mandal Panel"}
								</button>
							</div>
						)}

						{/* Card 1: Display & Appearance */}
						<SectionCard
							title={t.sectionDisplay}
							icon={
								<Monitor size={22} className="text-ry-gold dark:text-ry-gold" />
							}
							description={t.descDisplay}
							onInfoClick={() => openInfoPopup(t.sectionDisplay, t.infoDisplay)}
						>
							{/* App UI Size Slider */}
							<div className="mb-6" data-tour="settings-uiscale">
								<div className="flex justify-between items-center mb-2 px-1">
									<span className="text-sm font-medium text-slate-600 dark:text-slate-300">
										{t.uiScale}
									</span>
									<span className="text-xs font-bold bg-ry-gold/10 dark:bg-slate-700 text-ry-gold px-2 py-0.5 rounded border border-ry-gold/20">
										{Math.round(uiScale * 100)}%
									</span>
								</div>
								<div className="flex items-center gap-3">
									<span className="text-xs font-bold text-slate-400 dark:text-ink-400">
										A
									</span>
									<input
										type="range"
										min="0.85"
										max="1.15"
										step="0.05"
										value={uiScale}
										onChange={(e) =>
											onUiScaleChange(parseFloat(e.target.value))
										}
										className="flex-1 h-2 bg-ry-gold/20 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-ry-gold"
									/>
									<span className="text-lg font-bold text-slate-600 dark:text-slate-300">
										A
									</span>
								</div>
							</div>

							{/* Theme Toggle (Segmented Control) */}
							<div data-tour="settings-theme">
								<span className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-2 px-1">
									{t.theme}
								</span>
								<div className="flex bg-ry-gold/5 dark:bg-slate-900/50 p-1 rounded-xl gap-1 border border-ry-gold/20">
									<SegmentedButton
										active={currentThemeMode === "auto"}
										onClick={() => handleModeChange("auto")}
										icon={<Clock size={16} />}
										label={t.themeAuto}
									/>
									<SegmentedButton
										active={currentThemeMode === "light"}
										onClick={() => handleModeChange("light")}
										icon={<Sun size={16} />}
										label={t.themeLight}
									/>
									<SegmentedButton
										active={currentThemeMode === "dark"}
										onClick={() => handleModeChange("dark")}
										icon={<Moon size={16} />}
										label={t.themeDark}
									/>
								</div>
							</div>

							{/* More Theme Colors */}
							<div className="pt-2">
								<button
									onClick={() => setShowThemeModal(true)}
								data-tour="settings-colors"
									className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-ry-gold/30 hover:bg-ry-gold/5 dark:hover:bg-slate-700 transition-colors shadow-sm mt-2"
								>
									<div className="flex items-center gap-3">
										<div
											className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm"
											style={{
												backgroundColor:
													THEME_PALETTES[themeColor]?.["500"] ||
													THEME_PALETTES.saffron["500"],
											}}
										>
											<Palette size={16} />
										</div>
										<span className="text-sm font-bold text-slate-700 dark:text-slate-200">
											{t.moreThemes}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="flex gap-1">
											{themeColors.slice(0, 3).map((tc) => (
												<div
													key={tc.key}
													className="w-3 h-3 rounded-full"
													style={{ backgroundColor: tc.color }}
												></div>
											))}
										</div>
										<ChevronRight
											size={16}
											className="text-slate-400 dark:text-ink-400"
										/>
									</div>
								</button>
							</div>
						</SectionCard>

						{/* Card 2: Content & Language */}
						<SectionCard
							title={t.sectionContent}
							icon={<Languages size={22} className="text-ry-gold" />}
							description={t.descContent}
							onInfoClick={() => openInfoPopup(t.sectionContent, t.infoContent)}
						>
							{/* App Language */}
							<div className="mb-5" data-tour="settings-language">
								<span className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-2 px-1">
									{t.appLang}
								</span>
								<div className="flex bg-ry-gold/5 dark:bg-slate-900/50 p-1 rounded-xl border border-ry-gold/20">
									<SegmentedButton
										active={settingsLanguage === "hi"}
										onClick={() => onSettingsLanguageChange("hi")}
										label="हिन्दी"
									/>
									<SegmentedButton
										active={settingsLanguage === "en"}
										onClick={() => onSettingsLanguageChange("en")}
										label="English"
									/>
								</div>
							</div>

							{/* Bhajan Script */}
							<div data-tour="settings-script">
								<span className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-2 px-1">
									{t.bhajanLang}
								</span>
								<div className="flex bg-ry-gold/5 dark:bg-slate-900/50 p-1 rounded-xl border border-ry-gold/20">
									<SegmentedButton
										active={script === "devanagari"}
										onClick={() => onScriptChange("devanagari")}
										label="हिन्दी"
									/>
									<SegmentedButton
										active={script === "iast"}
										onClick={() => onScriptChange("iast")}
										label="English"
									/>
								</div>
							</div>
						</SectionCard>

						{/* Card 3: Interface Layout */}
						<SectionCard
							title={t.sectionInterface}
							icon={<Layout size={22} className="text-ry-gold" />}
							description={t.descInterface}
							onInfoClick={() =>
								openInfoPopup(t.sectionInterface, t.infoInterface)
							}
						>
							{/* AZ Slider Position */}
							<div className="mb-5" data-tour="settings-azside">
								<span className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-2 px-1">
									{sliderLabel}
								</span>
								<div className="flex bg-ry-gold/5 dark:bg-slate-900/50 p-1 rounded-xl border border-ry-gold/20">
									<SegmentedButton
										active={azSliderSide === "left"}
										onClick={() => onAzSliderSideChange("left")}
										label={t.left}
									/>
									<SegmentedButton
										active={azSliderSide === "right"}
										onClick={() => onAzSliderSideChange("right")}
										label={t.right}
									/>
								</div>
							</div>

							{/* Scrollbar Position */}
							<div data-tour="settings-scrollside">
								<span className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-2 px-1">
									{t.scrollBarPos}
								</span>
								<div className="flex bg-ry-gold/5 dark:bg-slate-900/50 p-1 rounded-xl border border-ry-gold/20">
									<SegmentedButton
										active={scrollBarSide === "left"}
										onClick={() => onScrollBarSideChange("left")}
										label={t.left}
									/>
									<SegmentedButton
										active={scrollBarSide === "right"}
										onClick={() => onScrollBarSideChange("right")}
										label={t.right}
									/>
								</div>
							</div>
						</SectionCard>

						{/* Card 4: System & Support */}
						<SectionCard
							title={t.sectionSystem}
							icon={<Smartphone size={22} className="text-ry-gold" />}
							description={t.descSystem}
							onInfoClick={() => openInfoPopup(t.sectionSystem, t.infoSystem)}
						>
							{/* Keep Awake */}
							<ActionRow
								icon={<Smartphone size={20} className="text-ry-gold" />}
								label={t.keepAwake}
								desc={t.keepAwakeDesc}
								tourId="settings-keepawake"
								action={
									<div
										onClick={() => onKeepAwakeChange(!keepAwake)}
										className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer ${keepAwake ? "bg-ry-gold" : "bg-slate-200 dark:bg-slate-600"}`}
									>
										<div
											className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${keepAwake ? "left-6" : "left-1"}`}
										/>
									</div>
								}
							/>

							<div className="h-px bg-ry-gold/10 dark:bg-slate-700 my-1" />

							{/* Haptics */}
							<ActionRow
								icon={<Smartphone size={20} className="text-ry-gold" />}
								label={t.systemHaptics}
								desc={t.systemHapticsDesc}
								tourId="settings-haptics"
								onInfoClick={() =>
									openInfoPopup(t.systemHaptics, t.infoHaptics)
								}
								action={
									<div
										onClick={() => onHapticsEnabledChange(!hapticsEnabled)}
										className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer ${hapticsEnabled ? "bg-ry-gold" : "bg-slate-200 dark:bg-slate-600"}`}
									>
										<div
											className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${hapticsEnabled ? "left-6" : "left-1"}`}
										/>
									</div>
								}
							/>

							<div className="h-px bg-ry-gold/10 dark:bg-slate-700 my-1" />

							{/* Feedback */}
							<ActionRow
								icon={<MessageCircle size={20} className="text-ry-gold" />}
								label={t.feedback}
								desc={t.feedbackDesc}
								tourId="settings-feedback"
								onClick={handleFeedback}
								showChevron
							/>

							<div className="h-px bg-ry-gold/10 dark:bg-slate-700 my-1" />

							{/* Guided tour: close Settings, reset every chapter, start on Home */}
							<ActionRow
								icon={<Compass size={20} className="text-ry-gold" />}
								label={t.replayTour}
								desc={t.replayTourDesc}
								onClick={() => {
									onClose();
									requestTourReplay();
								}}
								showChevron
								tourId="settings-replay"
							/>
						</SectionCard>

						{/* Card 5: Storage & Maintenance */}
						<SectionCard
							title={t.sectionStorage}
							icon={<HardDrive size={22} className="text-ry-gold" />}
							description={t.descStorage}
							onInfoClick={() => openInfoPopup(t.sectionStorage, t.infoStorage)}
						>
							<div className="pb-2" data-tour="settings-backup">
								<BackupRestoreSection
									settingsLanguage={settingsLanguage}
									hideTitle={true}
								/>
							</div>
							<div className="pt-4 border-t border-ry-gold/10 dark:border-slate-700">
								<ActionRow
									icon={<Trash2 size={20} className="text-red-500" />}
									label={t.clearCache}
									desc={t.clearCacheDesc}
									tourId="settings-cache"
									onClick={handleClearCache}
									className="text-red-600 dark:text-red-400"
								/>
							</div>
						</SectionCard>

						{/* Card 6: Developer Options (Entry Only) */}
						<div className="pt-4">
							<button
								type="button"
								onClick={handleSecretClick}
								className={`w-full py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white transition-all ${buttonClass}`}
							>
								{t.devOptions}: {buttonContent}
							</button>

							{(devMode || isSuperAdminUser) && (
								<DeveloperOptions
									allBhajans={allBhajans}
									allBooks={allBooks || books}
									allLectures={allLectures || lectures}
									events={events}
									onUpdateBhajans={onUpdateBhajans}
									onUpdateBooks={onUpdateBooks}
									onUpdateLectures={onUpdateLectures}
									onUpdateEvents={onUpdateEvents}
									settingsLanguage={settingsLanguage}
									autoOpen={autoOpenAdmin}
									adminPanelRef={adminPanelRef}
									onAdminPanelToggle={setDevAdminPanelOpen}
									onAddBhajan={onAddBhajan}
									onResetData={onResetData}
									onImportData={onImportData}
								/>
							)}
						</div>
					</div>
				</div>

				{/* Theme Color Modal */}
				{showThemeModal && (
					<div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
						<div className="bg-ry-cream dark:bg-slate-900 w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300 max-h-[85vh] landscape:max-h-[95vh] overflow-hidden flex flex-col border border-ry-gold/30">
							<div className="flex justify-between items-center mb-6 shrink-0">
								<h3 className="text-lg font-bold text-ry-gold dark:text-white">
									{t.moreThemes}
								</h3>
								<button
									onClick={() => handleClose_ThemeModal()}
									className="p-2 bg-ry-gold/10 dark:bg-slate-800 rounded-full text-ry-gold hover:bg-ry-gold/20 transition-colors"
								>
									<X size={20} />
								</button>
							</div>

							<div className="flex-1 overflow-y-auto no-scrollbar">
								<div className="grid grid-cols-4 gap-2 mb-2">
									{themeColors.map((tc) => (
										<button
											key={tc.key}
											onClick={() => {
												onThemeColorChange(tc.key);
												handleClose_ThemeModal();
											}}
											className={`flex flex-col items-center gap-2 p-2 rounded-xl border-[1.5px] transition-all ${themeColor === tc.key ? "bg-ry-gold/10 dark:bg-slate-800 border-ry-gold" : "border-transparent hover:bg-ry-gold/5 dark:hover:bg-slate-800"}`}
										>
											<div
												className="w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-transform active:scale-95"
												style={{ backgroundColor: tc.color }}
											>
												{themeColor === tc.key && (
													<div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
												)}
											</div>
											<span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
												{tc.label}
											</span>
										</button>
									))}
								</div>
							</div>

							<div className="pt-4 mt-2 border-t border-ry-gold/20 shrink-0">
								<button
									onClick={() => handleClose_ThemeModal()}
									className="w-full py-3 bg-ry-gold hover:brightness-110 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
								>
									{t.cancel}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Info Popup Modal */}
				{infoPopup && (
					<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
						<div className="bg-ry-cream dark:bg-slate-800 w-full max-w-xs rounded-3xl shadow-2xl p-6 transform scale-100 transition-all animate-in zoom-in-95 duration-200 relative border border-ry-gold/30">
							<button
								onClick={closeInfoPopup}
								className="absolute top-4 right-4 p-2 text-slate-400 dark:text-ink-400 hover:text-ry-gold rounded-full bg-white dark:bg-slate-700 transition-colors shadow-sm"
							>
								<X size={18} />
							</button>

							<div className="flex flex-col items-center text-center mt-2">
								<div className="w-14 h-14 bg-ry-gold/10 dark:bg-slate-700 rounded-full flex items-center justify-center text-ry-gold mb-4 border border-ry-gold/20">
									<Info size={28} />
								</div>

								<h3 className="text-xl font-bold text-ry-gold dark:text-white mb-4">
									{infoPopup.title}
								</h3>

								<div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-ry-gold/20 shadow-inner w-full text-left">
									{infoPopup.description}
								</div>

								<button
									onClick={closeInfoPopup}
									className="mt-6 w-full py-3 bg-ry-gold hover:brightness-110 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
								>
									{t.close}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Password Modal */}
				{showPasswordModal && (
					<div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
						<form
							onSubmit={handlePasswordSubmit}
							method="POST"
							action="#"
							className="bg-ry-cream dark:bg-slate-800 w-full max-w-2xl p-6 rounded-3xl shadow-2xl transform scale-100 transition-all border border-ry-gold/30 flex flex-col max-h-[90vh]"
						>
							<h3 className="text-lg font-bold text-ry-gold dark:text-white mb-5 text-center shrink-0">
								{authAction === "DISABLE" ? t.passDisable : t.enterPass}
							</h3>

							<div className="mb-4 flex-1 overflow-y-auto min-h-0">
								<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 ml-1">
									Select Account
								</label>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
									{dynamicAdminEmails.map((email) => (
										<button
											type="button"
											key={email}
											onClick={() => setSelectedEmail(email)}
											className={`p-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all border ${
												selectedEmail === email
													? "bg-ry-gold text-white border-ry-gold"
													: "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-ry-gold/50"
											}`}
										>
											<span className="truncate">{email}</span>
											{selectedEmail === email && <Check size={14} />}
										</button>
									))}
								</div>
								{dynamicAdminEmails.length <= 1 && (
									<p className="mt-3 text-xs font-bold text-red-500 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-900/50">
										{settingsLanguage === "hi"
											? "अन्य ईमेल अकाउंट देखने के लिए कृपया इंटरनेट कनेक्ट करें।"
											: "Please connect to internet to view other email accounts."}
									</p>
								)}
							</div>

							{/* Hidden email input for Password Managers/Autofill */}
							<input
								type="email"
								id="email"
								name="email"
								autoComplete="username"
								value={selectedEmail}
								readOnly
								className="sr-only"
							/>
							<div className="mb-6 shrink-0">
								<label
									htmlFor="password"
									className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1"
								>
									Password
								</label>
								<input
									type="password"
									id="password"
									name="password"
									autoComplete="current-password"
									value={passwordInput}
									onChange={(e) => setPasswordInput(e.target.value)}
									className="w-full p-3 bg-white dark:bg-slate-700 rounded-xl text-center font-mono text-lg tracking-widest focus:ring-2 focus:ring-ry-gold/50 border border-ry-gold/30 outline-none shadow-inner dark:text-white"
									placeholder="••••••"
								/>
							</div>

							<div className="flex gap-3 shrink-0">
								<button
									type="button"
									onClick={() => {
										handleClose_PasswordModal();
										setPasswordInput("");
									}}
									disabled={authLoading}
									className="flex-1 py-2.5 text-slate-500 dark:text-ink-300 font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-ink-600 transition-colors disabled:opacity-50"
								>
									{t.cancel}
								</button>
								<button
									type="submit"
									disabled={authLoading}
									className="flex-1 py-2.5 bg-ry-gold hover:brightness-110 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70"
								>
									{authLoading ? (
										<Loader2 className="animate-spin" size={18} />
									) : (
										t.submit
									)}
								</button>
							</div>
						</form>
					</div>
				)}

				{/* Feedback Modal */}
				<FeedbackModal
					isOpen={showFeedbackModal}
					onClose={() => setShowFeedbackModal(false)}
					settingsLanguage={settingsLanguage}
				/>

				{/* Confirmation Modal (Pending Link) */}
				{pendingLink && (
					<div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
						<div className="bg-ry-cream dark:bg-slate-800 w-full max-w-xs rounded-3xl shadow-2xl p-6 transform scale-100 transition-all animate-in zoom-in-95 duration-200 border border-ry-gold/30">
							<div className="flex flex-col items-center text-center mt-2">
								<div className="w-14 h-14 bg-ry-gold/10 dark:bg-slate-700 rounded-full flex items-center justify-center text-ry-gold mb-4 border border-ry-gold/20">
									{pendingLink.icon || <ExternalLink size={24} />}
								</div>

								<h3 className="text-xl font-bold text-ry-gold dark:text-white mb-2">
									{settingsLanguage === "en"
										? "Open WhatsApp?"
										: "व्हाट्सएप खोलें?"}
								</h3>

								<p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
									{settingsLanguage === "en"
										? "You are leaving the app to open"
										: "आप ऐप छोड़कर जा रहे हैं"}
									: <br />
									<strong className="text-lg mt-1 block">WhatsApp</strong>
								</p>

								<div className="flex gap-3 w-full">
									<button
										onClick={() => setPendingLink(null)}
										className="flex-1 py-3 text-slate-500 dark:text-ink-300 font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-ink-600 transition-colors"
									>
										{t.cancel}
									</button>
									<button
										onClick={confirmNavigation}
										className="flex-1 py-3 text-white font-bold bg-ry-gold hover:brightness-110 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
									>
										Open
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* ── CLEAR CACHE MODAL ── */}
				{showCacheModal && (
					<div className="absolute inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
						<div className="w-full sm:max-w-md bg-ry-cream dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 border border-ry-gold/20 flex flex-col max-h-[90vh]">
							{/* Header */}
							<div className="flex items-center justify-between p-5 border-b border-ry-gold/10 dark:border-slate-800 shrink-0">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
										<Trash2 size={20} className="text-red-500" />
									</div>
									<div>
										<h3 className="font-bold text-slate-800 dark:text-white text-base">
											{settingsLanguage === "hi" ? "कैश साफ करें" : "Clear Cache"}
										</h3>
										<p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
											{settingsLanguage === "hi"
												? "क्या साफ करना है चुनें"
												: "Choose what to clear"}
										</p>
									</div>
								</div>
								<button
									onClick={handleCloseCacheModal}
									className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-ink-300 transition-colors"
								>
									<X size={18} />
								</button>
							</div>

							{/* Platform Badge */}
							<div className="px-5 pt-4 shrink-0">
								<div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl px-3 py-2">
									<Smartphone size={14} className="text-blue-500 shrink-0" />
									<p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
										Platform: <strong className="capitalize">{platform}</strong>
										{platform !== "web" &&
											" — Service Worker Cache not applicable"}
									</p>
								</div>
							</div>

							{/* Select / Reset buttons */}
							<div className="px-5 pt-4 pb-2 shrink-0 flex items-center gap-2">
								<button
									onClick={() => setSelectedCacheIds(SAFE_DEFAULT_IDS)}
									className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-3 py-2 rounded-xl transition-colors"
								>
									<ShieldCheck size={14} /> Safe Defaults
								</button>
								<button
									onClick={() => {
										if (selectedCacheIds.size === CACHE_OPTIONS.length) {
											setSelectedCacheIds(new Set());
										} else {
											setSelectedCacheIds(
												new Set(CACHE_OPTIONS.map((o) => o.id)),
											);
										}
									}}
									className="flex items-center gap-1.5 text-xs font-bold text-ry-gold hover:bg-ry-gold/5 px-3 py-2 rounded-xl transition-colors"
								>
									{selectedCacheIds.size === CACHE_OPTIONS.length
										? "Deselect All"
										: "Select All"}
								</button>
							</div>

							{/* Option Checkboxes */}
							<div className="overflow-y-auto px-5 pb-4 flex-1 space-y-2">
								{CACHE_OPTIONS.map((opt) => {
									const checked = selectedCacheIds.has(opt.id);
									return (
										<div
											key={opt.id}
											onClick={() => {
												const s = new Set(selectedCacheIds);
												if (checked) s.delete(opt.id);
												else s.add(opt.id);
												setSelectedCacheIds(s);
											}}
											className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
												checked
													? "bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-800/40"
													: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-700/40"
											}`}
										>
											<div
												className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
													checked
														? "bg-red-500 border-red-500"
														: "border-slate-300 dark:border-slate-600"
												}`}
											>
												{checked && (
													<Check
														size={12}
														className="text-white"
														strokeWidth={3}
													/>
												)}
											</div>
											<span className="text-xl shrink-0">{opt.icon}</span>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-bold text-slate-700 dark:text-slate-200">
													{opt.label}
												</p>
												<p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
													{opt.desc}
												</p>
											</div>
										</div>
									);
								})}
							</div>

							{/* Action Buttons */}
							<div className="p-5 border-t border-ry-gold/10 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-3xl shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
								<button
									onClick={executeClearCache}
									disabled={clearingCache || selectedCacheIds.size === 0}
									className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-red-500/20"
								>
									{clearingCache ? (
										<>
											<Loader2 size={18} className="animate-spin" /> Clearing...
										</>
									) : (
										<>
											<Trash2 size={18} /> Clear {selectedCacheIds.size} Item
											{selectedCacheIds.size !== 1 ? "s" : ""}
										</>
									)}
								</button>
								<button
									onClick={handleCloseCacheModal}
									disabled={clearingCache}
									className="w-full py-3 mt-2 text-slate-500 dark:text-ink-300 font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}

				{/* ── CUSTOM TOAST ── */}
				{cacheToast && (
					<div
						className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold animate-in slide-in-from-bottom-4 duration-300 min-w-[240px] max-w-[90vw] ${
							cacheToast.type === "success"
								? "bg-emerald-600 shadow-emerald-600/30"
								: "bg-red-600 shadow-red-600/30"
						}`}
					>
						{cacheToast.type === "success" ? (
							<Check size={18} className="shrink-0" />
						) : (
							<X size={18} className="shrink-0" />
						)}
						<span>{cacheToast.msg}</span>
					</div>
				)}
			</div>
		</>
	);
};

// Helper Components
const SectionCard: React.FC<{
	title: string;
	icon: React.ReactNode;
	description: string;
	children: React.ReactNode;
	onInfoClick?: () => void;
}> = ({ title, icon, description, children, onInfoClick }) => (
	<div className="bg-ry-cream dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-ry-gold/30 dark:border-slate-700 animate-fade-in-up relative overflow-hidden">
		{/* Background Texture Overlay */}
		<div
			className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-multiply dark:opacity-10 dark:mix-blend-screen"
			style={{
				backgroundImage:
					"url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
			}}
		></div>

		<div className="relative z-10 flex items-center justify-between mb-3 border-b border-ry-gold/10 pb-3">
			<div className="flex items-center gap-3">
				<div className="w-10 h-10 rounded-full bg-krishna-50 dark:bg-slate-800 flex items-center justify-center text-krishna-600 dark:text-gold-300 border border-krishna-200 dark:border-slate-700 shadow-sm">
					{React.cloneElement(icon as any, { size: 20 })}
				</div>
				<h3 className="font-heading text-lg text-krishna-700 dark:text-cream-50 tracking-wide">
					{title}
				</h3>
			</div>
			{onInfoClick && (
				<button
					onClick={onInfoClick}
					className="p-2 text-slate-400 dark:text-ink-400 hover:text-ry-gold hover:bg-ry-gold/10 dark:hover:bg-slate-700 rounded-full transition-colors"
				>
					<Info size={18} />
				</button>
			)}
		</div>
		<div className="relative z-10 pl-1">
			<p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed font-medium">
				{description}
			</p>
			<div className="pl-1">{children}</div>
		</div>
	</div>
);

const SegmentedButton: React.FC<{
	active: boolean;
	onClick: () => void;
	label: string;
	icon?: React.ReactNode;
}> = ({ active, onClick, label, icon }) => (
	<button
		onClick={onClick}
		className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${active ? "bg-krishna-50 dark:bg-slate-700 text-krishna-700 dark:text-gold-300 shadow-sm border border-krishna-200 dark:border-slate-600" : "text-ink-500 dark:text-ink-400 hover:text-krishna-600 dark:hover:text-gold-300 border border-transparent"}`}
	>
		{icon &&
			React.cloneElement(icon as any, {
				className: active
					? "drop-shadow-sm text-krishna-700 dark:text-gold-300"
					: "",
			})}
		{label}
	</button>
);

const ActionRow: React.FC<{
	icon: React.ReactNode;
	label: string;
	desc?: string;
	action?: React.ReactNode;
	onClick?: () => void;
	className?: string;
	showChevron?: boolean;
	onInfoClick?: () => void;
	/** `data-tour` hook for the guided tour; no visual effect. */
	tourId?: string;
}> = ({
	icon,
	label,
	desc,
	action,
	onClick,
	className,
	showChevron,
	onInfoClick,
	tourId,
}) => (
	<div
		onClick={onClick}
		data-tour={tourId}
		className={`flex items-center justify-between py-3 px-2 rounded-xl transition-colors ${onClick ? "cursor-pointer hover:bg-krishna-50 dark:hover:bg-slate-800 active:bg-krishna-100 dark:active:bg-slate-700" : ""} ${className || ""}`}
	>
		<div className="flex items-center gap-4">
			<div className="w-8 h-8 rounded-full bg-krishna-50 dark:bg-slate-800 flex items-center justify-center border border-krishna-100 dark:border-slate-700 shrink-0 text-krishna-600 dark:text-gold-300">
				{icon}
			</div>
			<div>
				<div className="flex items-center gap-2">
					<div
						className={`text-sm font-bold text-ink-900 dark:text-cream-50 ${className || ""}`}
					>
						{label}
					</div>
					{onInfoClick && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onInfoClick();
							}}
							className="text-slate-400 dark:text-ink-400 hover:text-ry-gold transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
						>
							<Info size={14} />
						</button>
					)}
				</div>
				{desc && (
					<div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
						{desc}
					</div>
				)}
			</div>
		</div>
		{action}
		{showChevron && (
			<ChevronRight
				size={18}
				className="text-slate-300 group-hover:text-ry-gold"
			/>
		)}
	</div>
);

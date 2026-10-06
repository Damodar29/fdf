import type React from "react";
import {
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useState,
} from "react";
import type {
	BannerConfig,
	FontSize,
	ScriptType,
	ThemeColor,
	ThemeMode,
} from "../types";
import { applyThemeColor, DEFAULT_THEME_COLOR } from "../utils/theme";

/** Prevents QuotaExceededError from crashing the app when storage is full. */
function safeLocalSet(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch (e: any) {
		console.warn(`[localStorage] Write failed for "${key}":`, e?.name ?? e);
	}
}

import { doc, onSnapshot } from "firebase/firestore";
import { db, type InformationData } from "../services/firebase";
import { iosOnSnapshotDoc, shouldUseRestFallback } from "../utils/firebaseRest";
import { useToast } from "./ToastContext";

interface SettingsContextType {
	fontSize: FontSize;
	setFontSize: (size: FontSize) => void;
	uiScale: number;
	setUiScale: (scale: number) => void;
	script: ScriptType;
	setScript: (script: ScriptType) => void;
	darkMode: boolean;
	setDarkMode: (isDark: boolean) => void;
	keepAwake: boolean;
	setKeepAwake: (keep: boolean) => void;
	settingsLanguage: "en" | "hi";
	setSettingsLanguage: (lang: "en" | "hi") => void;
	scrollBarSide: "left" | "right";
	setScrollBarSide: (side: "left" | "right") => void;
	azSliderSide: "left" | "right";
	setAzSliderSide: (side: "left" | "right") => void;
	devMode: boolean;
	setDevMode: (val: boolean) => void;
	indexMode: "latin" | "devanagari";
	setIndexMode: (mode: "latin" | "devanagari") => void;
	themeColor: ThemeColor;
	setThemeColor: (color: ThemeColor) => void;
	hapticsEnabled: boolean;
	setHapticsEnabled: (val: boolean) => void;
	themeMode: ThemeMode;
	setThemeMode: (mode: ThemeMode) => void;
	handleThemeChange: (isDark: boolean) => void;
	informationData: InformationData | null;
	hasNewInformation: boolean;
	markInformationAsRead: (id?: string) => void;
	socialMediaStatus: {
		isYoutubeLive: boolean;
		youtubeLiveLink?: string;
		isFacebookLive: boolean;
		facebookLiveLink?: string;
		isInstagramLive: boolean;
		instagramLiveLink?: string;
	};
	banners: BannerConfig[];
	hasNewOtaUpdate: boolean;
	setHasNewOtaUpdate: (val: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
	undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const { showToast } = useToast();
	// Theme Logic
	const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
		const saved = localStorage.getItem("cpbs_theme_mode");
		if (saved === "light" || saved === "dark" || saved === "auto")
			return saved as ThemeMode;
		return "auto";
	});

	const [darkMode, setDarkMode] = useState(() => {
		// Initial State Check
		if (typeof localStorage !== "undefined") {
			const savedMode = localStorage.getItem("cpbs_theme_mode") as ThemeMode;
			if (savedMode === "dark") return true;
			if (savedMode === "light") return false;
		}
		const hour = new Date().getHours();
		return hour >= 18 || hour < 6;
	});

	useEffect(() => {
		const applyMode = () => {
			let isDark = false;
			if (themeMode === "auto") {
				const hour = new Date().getHours();
				isDark = hour >= 18 || hour < 6;
			} else {
				isDark = themeMode === "dark";
			}
			setDarkMode(isDark);
			safeLocalSet("cpbs_theme_mode", themeMode);
			document.documentElement.classList.toggle("dark", isDark);
		};

		applyMode();

		let interval: any;
		if (themeMode === "auto") {
			// Check every minute if in auto mode
			interval = setInterval(applyMode, 60000);
		}
		return () => clearInterval(interval);
	}, [themeMode]);

	const handleThemeChange = (isDark: boolean) => {
		// Manual toggle switches off auto mode
		setThemeMode(isDark ? "dark" : "light");
	};

	const [fontSize, setFontSize] = useState<FontSize>(() => {
		const saved = localStorage.getItem("cpbs_fontsize");
		return saved ? parseInt(saved, 10) || 20 : 20;
	});
	useEffect(
		() => safeLocalSet("cpbs_fontsize", fontSize.toString()),
		[fontSize],
	);

	const [uiScale, setUiScale] = useState<number>(() => {
		const saved = localStorage.getItem("cpbs_ui_scale");
		return saved ? parseFloat(saved) : 1.0;
	});

	useLayoutEffect(() => {
		safeLocalSet("cpbs_ui_scale", uiScale.toString());
		// Apply scale to root element to affect all rem units based on browser default (usually 16px)
		document.documentElement.style.fontSize = `${uiScale * 100}%`;
	}, [uiScale]);

	const [script, setScript] = useState<ScriptType>(
		() => (localStorage.getItem("cpbs_script") as ScriptType) || "devanagari",
	);
	useEffect(() => safeLocalSet("cpbs_script", script), [script]);

	const [keepAwake, setKeepAwake] = useState<boolean>(
		() => localStorage.getItem("cpbs_awake") !== "false",
	);
	useEffect(() => safeLocalSet("cpbs_awake", String(keepAwake)), [keepAwake]);

	const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(
		() => localStorage.getItem("cpbs_haptics") !== "false",
	);
	useEffect(
		() => safeLocalSet("cpbs_haptics", String(hapticsEnabled)),
		[hapticsEnabled],
	);

	const [settingsLanguage, setSettingsLanguage] = useState<"en" | "hi">(
		() => (localStorage.getItem("cpbs_settings_lang") as "en" | "hi") || "en",
	);
	useEffect(
		() => safeLocalSet("cpbs_settings_lang", settingsLanguage),
		[settingsLanguage],
	);

	const [scrollBarSide, setScrollBarSide] = useState<"left" | "right">(
		() =>
			(localStorage.getItem("cpbs_scrollbar_side") as "left" | "right") ||
			"left",
	);
	useEffect(
		() => safeLocalSet("cpbs_scrollbar_side", scrollBarSide),
		[scrollBarSide],
	);

	const [azSliderSide, setAzSliderSide] = useState<"left" | "right">(
		() =>
			(localStorage.getItem("cpbs_slider_side") as "left" | "right") || "left",
	);
	useEffect(
		() => safeLocalSet("cpbs_slider_side", azSliderSide),
		[azSliderSide],
	);

	const [devMode, setDevMode] = useState<boolean>(false);

	const [indexMode, setIndexMode] = useState<"latin" | "devanagari">(
		() =>
			(localStorage.getItem("cpbs_index_mode") as "latin" | "devanagari") ||
			"devanagari",
	);
	useEffect(() => safeLocalSet("cpbs_index_mode", indexMode), [indexMode]);

	const [themeColor, setThemeColor] = useState<ThemeColor>(() => {
		// One-shot migration to the Cyan palette.
		//
		// Existing installs already have a palette persisted in
		// `cpbs_theme_color`, so without this they would never see the new default.
		// The flag makes it a one-time push: after this runs once, whatever the
		// user picks afterwards is respected forever.
		const hasCyanTheme = localStorage.getItem("cpbs_cyan_theme_v2");
		if (!hasCyanTheme) {
			safeLocalSet("cpbs_cyan_theme_v2", "true");
			return DEFAULT_THEME_COLOR;
		}
		return (
			(localStorage.getItem("cpbs_theme_color") as ThemeColor) ||
			DEFAULT_THEME_COLOR
		);
	});

	const [informationData, setInformationData] =
		useState<InformationData | null>(null);
	const [hasNewInformation, setHasNewInformation] = useState(false);
	const [socialMediaStatus, setSocialMediaStatus] = useState<{
		isYoutubeLive: boolean;
		youtubeLiveLink?: string;
		isFacebookLive: boolean;
		facebookLiveLink?: string;
		isInstagramLive: boolean;
		instagramLiveLink?: string;
	}>({
		isYoutubeLive: false,
		isFacebookLive: false,
		isInstagramLive: false,
	});

	const [banners, setBanners] = useState<BannerConfig[]>([]);
	const [hasNewOtaUpdate, setHasNewOtaUpdate] = useState(false);

	useEffect(() => {
		let unsub: (() => void) | undefined;
		const handleSnapshot = (docSnap: any) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				if (data) {
					const normalizedData: InformationData = {
						enabled: data.enabled === true || data.enabled === "true",
						items: data.items,
						title: data.title || "",
						text: data.text || "",
						imageUrl: data.imageUrl || data.imageurl || data.imageURL,
						imageUrl2: data.imageUrl2 || data.imageurl2 || data.imageURL2,
						imageUrl3: data.imageUrl3 || data.imageurl3 || data.imageURL3,
					};
					setInformationData(normalizedData);
					if (normalizedData.enabled) {
						const readIdsStr =
							localStorage.getItem("cpbs_read_info_ids") || "[]";
						let readIds: string[] = [];
						try {
							readIds = JSON.parse(readIdsStr);
						} catch (_e) {}

						let hasUnread = false;
						if (normalizedData.items && normalizedData.items.length > 0) {
							const now = Date.now();
							const visibleItems = normalizedData.items.filter(
								(i) =>
									i.isEnabled !== false &&
									(!i.expiryDate || i.expiryDate > now),
							);
							hasUnread = visibleItems.some(
								(item) => !readIds.includes(item.id),
							);
						} else if (normalizedData.title) {
							// legacy fallback
							const lastReadTitle = localStorage.getItem(
								"cpbs_last_read_info_title",
							);
							hasUnread = lastReadTitle !== normalizedData.title;
						}
						setHasNewInformation(hasUnread);
					} else {
						setHasNewInformation(false);
					}
				}
			}
		};
		const handleError = (error: any) => {
			console.error("Error fetching information_screen:", error);
			showToast(
				"Please connect to internet to get latest updated data",
				"error",
			);
		};
		if (shouldUseRestFallback()) {
			unsub = iosOnSnapshotDoc(
				"app_config/information_screen",
				handleSnapshot,
				handleError,
			);
		} else {
			unsub = onSnapshot(
				doc(db, "app_config", "information_screen"),
				handleSnapshot,
				handleError,
			);
		}
		return () => {
			if (unsub) unsub();
		};
	}, [showToast]);

	// Social Media Status Listener
	useEffect(() => {
		let unsub: (() => void) | undefined;
		const handleSnapshot = (docSnap: any) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				if (data) {
					setSocialMediaStatus({
						isYoutubeLive:
							data.isYoutubeLive === true || data.isYoutubeLive === "true",
						youtubeLiveLink: data.youtubeLiveLink,
						isFacebookLive:
							data.isFacebookLive === true || data.isFacebookLive === "true",
						facebookLiveLink: data.facebookLiveLink,
						isInstagramLive:
							data.isInstagramLive === true || data.isInstagramLive === "true",
						instagramLiveLink: data.instagramLiveLink,
					});
				}
			}
		};
		const handleError = (error: any) => {
			console.error("Error fetching social_media:", error);
		};
		if (shouldUseRestFallback()) {
			unsub = iosOnSnapshotDoc(
				"app_config/social_media",
				handleSnapshot,
				handleError,
			);
		} else {
			unsub = onSnapshot(
				doc(db, "app_config", "social_media"),
				handleSnapshot,
				handleError,
			);
		}
		return () => {
			if (unsub) unsub();
		};
	}, []);

	// Banners Listener
	useEffect(() => {
		let unsub: (() => void) | undefined;
		const handleSnapshot = (docSnap: any) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				if (data.banners && Array.isArray(data.banners)) {
					setBanners(data.banners.filter((b: any) => b.enabled));
				} else {
					setBanners([]);
				}
			} else {
				setBanners([]);
			}
		};
		const handleError = (error: any) => {
			console.error("âŒ Error fetching banners:", error);
		};
		if (shouldUseRestFallback()) {
			unsub = iosOnSnapshotDoc(
				"app_config/app_settings",
				handleSnapshot,
				handleError,
			);
		} else {
			unsub = onSnapshot(
				doc(db, "app_config", "app_settings"),
				handleSnapshot,
				handleError,
			);
		}
		return () => {
			if (unsub) unsub();
		};
	}, []);

	const markInformationAsRead = (id?: string) => {
		if (informationData) {
			if (informationData.items && informationData.items.length > 0) {
				const readIdsStr = localStorage.getItem("cpbs_read_info_ids") || "[]";
				let readIds: string[] = [];
				try {
					readIds = JSON.parse(readIdsStr);
				} catch (_e) {}

				if (id) {
					if (!readIds.includes(id)) {
						readIds.push(id);
						safeLocalSet("cpbs_read_info_ids", JSON.stringify(readIds));
					}
					const now = Date.now();
					const visibleItems = informationData.items.filter(
						(i) =>
							i.isEnabled !== false && (!i.expiryDate || i.expiryDate > now),
					);
					setHasNewInformation(
						visibleItems.some((item) => !readIds.includes(item.id)),
					);
				} else {
					// mark all as read
					const allIds = informationData.items.map((i) => i.id);
					safeLocalSet("cpbs_read_info_ids", JSON.stringify(allIds));
					setHasNewInformation(false);
				}
			} else {
				// legacy fallback
				safeLocalSet("cpbs_last_read_info_title", informationData.title || "");
				setHasNewInformation(false);
			}
		}
	};

	useLayoutEffect(() => {
		applyThemeColor(themeColor);
		safeLocalSet("cpbs_theme_color", themeColor);
	}, [themeColor]);

	return (
		<SettingsContext.Provider
			value={{
				fontSize,
				setFontSize,
				uiScale,
				setUiScale,
				script,
				setScript,
				darkMode,
				setDarkMode,
				keepAwake,
				setKeepAwake,
				settingsLanguage,
				setSettingsLanguage,
				scrollBarSide,
				setScrollBarSide,
				azSliderSide,
				setAzSliderSide,
				devMode,
				setDevMode,
				indexMode,
				setIndexMode,
				themeColor,
				setThemeColor,
				hapticsEnabled,
				setHapticsEnabled,
				themeMode,
				setThemeMode,
				handleThemeChange,
				informationData,
				hasNewInformation,
				markInformationAsRead,
				socialMediaStatus,
				banners,
				hasNewOtaUpdate,
				setHasNewOtaUpdate,
			}}
		>
			{children}
		</SettingsContext.Provider>
	);
};

export const useSettings = () => {
	const context = useContext(SettingsContext);
	if (!context)
		throw new Error("useSettings must be used within SettingsProvider");
	return context;
};

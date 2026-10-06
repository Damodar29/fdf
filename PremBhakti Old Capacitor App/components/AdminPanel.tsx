import { doc, getDoc } from "firebase/firestore";
import {
	ArrowLeft,
	BarChart3,
	Bell,
	BookOpen,
	CalendarCheck,
	Check,
	CheckCircle,
	ChevronRight,
	Database,
	Edit2,
	FileText,
	Heart,
	GitMerge,
	Image as ImageIcon,
	Languages,
	Link2,
	Wand2,
	MapPin,
	MessageCircle,
	Mic,
	Network,
	Music,
	RotateCcw,
	Shield,
	SlidersHorizontal,
	Smartphone,
	User,
	UserCheck,
	Users,
	Video,
	X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useData } from "../context/DataContext";
import { auth, db } from "../services/firebase";
import { AccessControlManager } from "../src/components/admin-panel/AccessControlManager";
import { AdminLoginCard } from "../src/components/admin-panel/AdminLoginCard";
import { ApprovalManager } from "../src/components/admin-panel/ApprovalManager";
import { BackblazeManager } from "../src/components/admin-panel/BackblazeManager";
import { DevoteeProfileManager } from "../src/components/admin-panel/DevoteeProfileManager";
import {
	DevoteeEditContext,
	type DevoteeEditTarget,
	type OpenDevoteeEdit,
} from "../src/components/admin-panel/devoteeEditLink";
import { GenderSetupManager } from "../src/components/admin-panel/GenderSetupManager";
import { UsageManager } from "../src/components/admin-panel/UsageManager";
import { LinkRequestsManager } from "../src/components/admin-panel/LinkRequestsManager";
import { CleanupManager } from "../src/components/admin-panel/cleanup/CleanupManager";
import { RelationFixManager } from "../src/components/admin-panel/relations/RelationFixManager";
import { FamilyExplorer } from "../src/components/admin-panel/family/FamilyExplorer";
import { GalleryUI } from "../src/components/admin-panel/GalleryUI";
import { MandalManager } from "../src/components/admin-panel/MandalManager";
import { MoreSettingsManager } from "../src/components/admin-panel/MoreSettingsManager";
import { OtaDiagnosticsManager } from "../src/components/admin-panel/OtaDiagnosticsManager";
import { ProcessingBlockerModal } from "../src/components/admin-panel/ProcessingBlockerModal";
import {
	SUPER_ADMIN_EMAILS,
	SUPER_ADMIN_PHONES,
} from "../src/constants/admins";
import { runAdminBack } from "../src/hooks/useAdminBack";
import {
	isOpenPopupView,
	usePopupBackHandler,
} from "../src/hooks/usePopupBackHandler";
import type { Bhajan, Book, EventData, LectureData } from "../types";
import { afterHistorySettles } from "../utils/historyPop";
import { safeLocalGet, safeLocalSet } from "../utils/safeLocalSet";
import { AuthorManager } from "./admin-panel/AuthorManager";
import { BhajanManager } from "./admin-panel/BhajanManager";
import { BookManager } from "./admin-panel/BookManager";
import { CommentModerationManager } from "./admin-panel/CommentModerationManager";
import { EventManager } from "./admin-panel/EventManager";
import { FilterCategoryManager } from "./admin-panel/FilterCategoryManager";
import { GlorificationManager } from "./admin-panel/GlorificationManager";
import { InfoScreenManager } from "./admin-panel/InfoScreenManager";
import { LectureManager } from "./admin-panel/LectureManager";
import { SocialMediaManager } from "./admin-panel/SocialMediaManager";
import { VideoManager } from "./admin-panel/VideoManager";
import { BannerAdmin } from "./BannerAdmin";
import { GalleryEditor } from "./GalleryEditor";
import { NotificationSender } from "./NotificationSender";

interface AdminPanelProps {
	isOpen: boolean;
	onClose: () => void;
	bhajans: Bhajan[];
	onUpdateBhajans: (data: Bhajan[]) => void;
	allBooks: Book[];
	onUpdateBooks: (data: Book[]) => void;
	allLectures: LectureData[];
	onUpdateLectures: (data: LectureData[]) => void;
	events: EventData[];
	onUpdateEvents: (data: EventData[]) => void;
	settingsLanguage?: "en" | "hi";
	initialScreen?: AdminScreen;
}

type AdminScreen =
	| "home"
	| "local_data"
	| "online_text"
	| "bhajans"
	| "books"
	| "lectures"
	| "events"
	| "info_screen"
	| "social_media"
	| "banners"
	| "gallery_editor"
	| "gallery_activity_ui"
	| "notification_sender"
	| "access_control"
	| "approvals"
	| "mandal_manager"
	| "more_settings"
	| "dedication_videos"
	| "devotee_profiles"
	| "community_manager"
	| "gender_setup"
	| "family_explorer"
	| "comment_moderation"
	| "usage"
	| "link_requests"
	| "cleanup"
	| "relation_fixes"
	| "filter_categories"
	| "author_manager"
	| "backblaze_manager"
	| "ota_diagnostics"
	| "glorification_manager";

const ADMIN_LANG_KEY = "cpbs_admin_lang";

const AdminMenuButton: React.FC<{
	icon: React.ReactNode;
	label: string;
	description?: string;
	onClick: () => void;
	colorClass?: string;
}> = ({
	icon,
	label,
	description,
	onClick,
	colorClass = "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
}) => (
	<button
		onClick={onClick}
		className="w-full text-left p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all flex items-center gap-4 group"
	>
		<div
			className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass} group-hover:scale-110 transition-transform`}
		>
			{icon}
		</div>
		<div className="flex-1">
			<h3 className="font-bold text-lg text-slate-800 dark:text-white">
				{label}
			</h3>
			{description && (
				<p className="text-sm text-slate-500 dark:text-slate-400">
					{description}
				</p>
			)}
		</div>
		<ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400" />
	</button>
);

export interface AdminPanelHandle {
	popScreen: () => boolean;
}

export const AdminPanel = React.forwardRef<AdminPanelHandle, AdminPanelProps>(
	(
		{
			isOpen,
			onClose,
			bhajans,
			onUpdateBhajans,
			allBooks,
			onUpdateBooks,
			allLectures,
			onUpdateLectures,
			events,
			onUpdateEvents,
			settingsLanguage: appLanguage = "hi",
			initialScreen,
		},
		ref,
	) => {
		// The panel's own language (toggle in the header), kept on this device;
		// the app's language setting is left as it is.
		const [adminLang, setAdminLang] = useState<"hi" | "en" | null>(() => {
			const saved = safeLocalGet(ADMIN_LANG_KEY);
			return saved === "hi" || saved === "en" ? saved : null;
		});
		const settingsLanguage = adminLang ?? appLanguage;
		const toggleAdminLang = () => {
			const next = settingsLanguage === "hi" ? "en" : "hi";
			setAdminLang(next);
			safeLocalSet(ADMIN_LANG_KEY, next);
		};
		const [navStack, setNavStack] = useState<AdminScreen[]>([
			initialScreen || "home",
		]);
		const navStackRef = React.useRef(navStack);
		useEffect(() => {
			navStackRef.current = navStack;
		}, [navStack]);
		const currentScreen = navStack[navStack.length - 1];
		const adminName = auth.currentUser?.email?.split("@")[0];

		const [searchQuery, setSearchQuery] = useState("");
		const [selectedBhajan, setSelectedBhajan] = useState<Bhajan | null>(null);
		const { forceSyncCloudData, forceSyncStatus } = useData();

		const [userRole, setUserRole] = useState<any>(null);
		const [loadingRole, setLoadingRole] = useState(true);
		// Bumped after signing in from the Content Manager, to load the role again.
		const [signInCount, setSignInCount] = useState(0);

		const [toastMessage, setToastMessage] = useState<{
			text: string;
			type: "success" | "error";
		} | null>(null);
		const [confirmDialog, setConfirmDialog] = useState<{
			message: string;
			onConfirm: () => void;
		} | null>(null);

		const showToast = (text: string, type: "success" | "error" = "success") => {
			setToastMessage({ text, type });
			setTimeout(() => setToastMessage(null), 3000);
		};

		// A devotee's edit screen opened from another admin screen (a name
		// tapped in Family Explorer, Comments, Gender…), shown on top of it.
		const [devoteeFocus, setDevoteeFocus] = useState<{
			target: DevoteeEditTarget;
			onClosed?: (changed: boolean) => void;
		} | null>(null);
		const openDevoteeEdit = React.useCallback<OpenDevoteeEdit>(
			(target, onClosed) =>
				// A popup closed just before (e.g. the family tree) may still be
				// popping its history entry; the edit screen pushes one of its own.
				afterHistorySettles(() => setDevoteeFocus({ target, onClosed })),
			[],
		);

		const closeConfirmDialog = usePopupBackHandler(
			!!confirmDialog,
			"admin-confirm",
			() => setConfirmDialog(null),
		);
		const closeSelectedBhajan = usePopupBackHandler(
			!!selectedBhajan,
			"admin-bhajan-editor",
			() => setSelectedBhajan(null),
		);

		useEffect(() => {
			const fetchRole = async () => {
				const user = auth.currentUser;
				if (!user) {
					setLoadingRole(false);
					return;
				}

				const email = user.email;
				const phone = user.phoneNumber;

				try {
					if (email) {
						const roleDoc = await getDoc(doc(db, "admin_roles", email));
						if (roleDoc.exists()) {
							setUserRole(roleDoc.data());
							setLoadingRole(false);
							return;
						}
					}

					// Fallback for super admins via email or phone
					if (
						(email && SUPER_ADMIN_EMAILS.includes(email)) ||
						(phone && SUPER_ADMIN_PHONES.includes(phone))
					) {
						setUserRole({ role: "super" });
					} else {
						setUserRole({ role: "none" });
					}
				} catch (error) {
					console.error("Error fetching role:", error);
					setUserRole({ role: "none" });
				}
				setLoadingRole(false);
			};
			if (isOpen) {
				fetchRole();
			} else {
				setNavStack(["home"]);
				setDevoteeFocus(null);
			}
		}, [isOpen, signInCount]);

		const hasPushedRef = React.useRef(false);
		// True only while OUR OWN "admin" marker is genuinely the thing that was
		// most recently pushed/re-armed by us. A child popup (confirm dialog,
		// bhajan editor, a nested screen's own delete-confirm, etc.) pushes its
		// own entry ON TOP of ours via usePopupBackHandler; when THAT gets
		// popped it lands back on "admin" (caught below) and this ref is left
		// untouched, so we never mistake a child's own pop for ours.
		const adminMarkerOwnedRef = React.useRef(false);
		// "Press back again to exit" — only relevant right at the panel's home
		// screen (navStack length 1); reset whenever the admin marker is
		// re-armed for a deeper screen, and by its own short timeout.
		const exitConfirmRef = React.useRef(false);
		const exitConfirmTimeoutRef = React.useRef<ReturnType<
			typeof setTimeout
		> | null>(null);

		useEffect(() => {
			if (!isOpen) {
				hasPushedRef.current = false;
				adminMarkerOwnedRef.current = false;
				exitConfirmRef.current = false;
				if (exitConfirmTimeoutRef.current) {
					clearTimeout(exitConfirmTimeoutRef.current);
					exitConfirmTimeoutRef.current = null;
				}
				return;
			}

			// Push one history entry when panel opens so Android back is intercepted
			// Only do this once per open, to avoid duplicate history states if props change
			if (!hasPushedRef.current) {
				window.history.pushState({ view: "admin", adminScreen: "home" }, "");
				hasPushedRef.current = true;
				adminMarkerOwnedRef.current = true;
			}

			const handlePopState = (e: PopStateEvent) => {
				const state = e.state || {};
				// We push exactly one 'admin' marker for the whole panel session (see
				// below) — sub-screen navigation no longer pushes its own entries.
				// So if we land BACK on that marker, it means a child popup (confirm
				// dialog, bhajan editor) on top of it just consumed its own entry;
				// that popup's own listener handles closing it — nothing to do here.
				if (state.view === "admin") return;
				// Landed on a popup that is still open (e.g. the bhajan editor after
				// its "saving…" blocker removed its own entry): something above that
				// popup was popped, not our marker.
				if (isOpenPopupView(state.view)) return;
				// The thing that was just popped wasn't our marker (some nested
				// popup's own entry was consumed instead, landing on some other
				// state) — that popup's own usePopupBackHandler instance handles
				// its own cleanup; nothing to do here. Note we deliberately do NOT
				// key this off `state.isPopup`, because whatever is BELOW our
				// marker (e.g. the Settings screen) is itself often a popup-style
				// state, which previously caused us to misclassify "our marker was
				// popped, landing on Settings" as "unrelated popup, ignore" —
				// leaving the panel open (and its onClose() never called) while
				// its own history marker had already vanished underneath it.
				if (!adminMarkerOwnedRef.current) return;
				adminMarkerOwnedRef.current = false;

				// An open sub-view / form / folder / dropdown inside the current
				// screen, or work that must not be dropped (an upload), takes this
				// back press first (see useAdminBack); the marker is re-armed.
				if (runAdminBack()) {
					window.history.pushState({ view: "admin", adminScreen: "home" }, "");
					adminMarkerOwnedRef.current = true;
					exitConfirmRef.current = false;
					return;
				}

				// Our own marker was the one popped. Step back one screen if we're
				// nested, re-arming a fresh marker so the next hardware-back press
				// is still intercepted; otherwise this is a genuine exit.
				if (navStackRef.current.length > 1) {
					setNavStack((prev) => prev.slice(0, -1));
					window.history.pushState({ view: "admin", adminScreen: "home" }, "");
					adminMarkerOwnedRef.current = true;
					exitConfirmRef.current = false;
					return;
				}

				// At the panel's home screen — require a second back press before
				// actually exiting, same "press again" pattern used elsewhere in
				// the app, so a single accidental back press doesn't drop the
				// admin straight out to Settings mid-task.
				if (!exitConfirmRef.current) {
					exitConfirmRef.current = true;
					window.history.pushState({ view: "admin", adminScreen: "home" }, "");
					adminMarkerOwnedRef.current = true;
					showToast(
						settingsLanguage === "hi"
							? "एडमिन पैनल से बाहर निकलने के लिए फिर से दबाएं"
							: "Press back again to exit Admin Panel",
					);
					if (exitConfirmTimeoutRef.current)
						clearTimeout(exitConfirmTimeoutRef.current);
					exitConfirmTimeoutRef.current = setTimeout(() => {
						exitConfirmRef.current = false;
					}, 2500);
					return;
				}

				exitConfirmRef.current = false;
				onClose();
			};

			window.addEventListener("popstate", handlePopState);
			return () => {
				window.removeEventListener("popstate", handlePopState);
			};
		}, [isOpen, onClose, settingsLanguage]);

		// Must stay above the `!isOpen` early return — a hook after a conditional
		// return breaks React's hook order when isOpen flips.
		React.useImperativeHandle(ref, () => ({
			popScreen: () => {
				if (navStackRef.current.length > 1) {
					setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
					return true;
				}
				return false;
			},
		}));

		if (!isOpen) return null;

		const pushScreen = (screen: AdminScreen) => {
			// Pure state — no history push per sub-screen. The single 'admin'
			// marker pushed on open (and re-armed by handlePopState) is enough
			// to intercept hardware back for the whole panel session, and it
			// keeps the number of real history entries bounded to at most one,
			// so closing the panel never has to unwind a deep, error-prone stack.
			exitConfirmRef.current = false;
			setNavStack((prev) => [...prev, screen]);
		};

		const popScreen = () => {
			setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
		};

		const handleCloseClick = () => {
			// A child popup (confirm dialog, bhajan editor) pushes its own entry
			// on top of ours via usePopupBackHandler. Close it directly here
			// (skip its own popHistory-based close) and fold its one entry into
			// the single go() below instead of doing two separate async pops.
			const popupOpen = !!confirmDialog || !!selectedBhajan;
			setConfirmDialog(null);
			setSelectedBhajan(null);

			const steps = (popupOpen ? 1 : 0) + (hasPushedRef.current ? 1 : 0);
			if (steps > 0) {
				window.history.go(-steps);
				hasPushedRef.current = false;
				// Closing explicitly via the X button, not a back gesture — make
				// sure the popstate this go() triggers (which may land after
				// `onClose()` below has already started tearing this panel down,
				// or may briefly race ahead of it) can't be mistaken for "our
				// marker was popped, step back a screen" and re-push a stray entry.
				adminMarkerOwnedRef.current = false;
				exitConfirmRef.current = false;
			}
			onClose();
		};

		const isHindi = settingsLanguage === "hi";
		const isSuperAdmin = userRole?.role === "super";

		const t = {
			contentManager: isHindi ? "कंटेंट मैनेजर" : "Content Manager",
			localData: isHindi ? "लोकल डेटा" : "Local Data",
			onlineText: isHindi ? "ऑनलाइन टेक्स्ट" : "Online Text",
			bhajans: isHindi ? "भजन" : "Bhajans",
			books: isHindi ? "किताबें" : "Books",
			lectures: isHindi ? "प्रवचन" : "Lectures",
			bhajanManager: isHindi ? "भजन मैनेजर" : "Bhajan Manager",
			bookManager: isHindi ? "बुक मैनेजर" : "Book Manager",
			lectureManager: isHindi ? "प्रवचन मैनेजर" : "Lecture Manager",
			calendarEditor: isHindi ? "कैलेंडर सम्पादक" : "Calendar Editor",
			infoScreen: isHindi ? "सूचना स्क्रीन" : "Information Screen",
			socialMedia: isHindi ? "सोशल मीडिया लाइव" : "Social Media Live",
			bannerManager: isHindi ? "बैनर मैनेजर" : "Banner Manager",
			galleryEditor: isHindi ? "गैलरी सम्पादक" : "Gallery Editor",
			galleryActivityUI: isHindi
				? "गैलरी व गतिविधि UI"
				: "Gallery and Activity UI",
			notifSender: isHindi ? "नोटिफिकेशन भेजें" : "Notification Sender",
			accessControl: isHindi ? "एक्सेस कंट्रोल" : "Access Control",
			approvals: isHindi ? "मंजूरी" : "Approvals",
			mandalManager: isHindi ? "मंडल" : "Mandal",
			moreSettings: isHindi ? "ऐप अपडेट (Android)" : "App Updates (Android)",
			dedicationVideos: isHindi ? "वीडियो" : "Videos",
			devoteeProfiles: isHindi ? "भक्त प्रोफाइल मैनेजमेंट" : "Devotee Management",
			communityManager: isHindi ? "कम्युनिटी मैनेजर" : "Community Manager",
			genderSetup: isHindi ? "भक्तों का लिंग सेट करें" : "Set devotees' gender",
			familyExplorer: isHindi ? "परिवार वृक्ष व नेटवर्क" : "Family Trees & Network",
			filterCategories: isHindi ? "फ़िल्टर श्रेणियाँ" : "Filter Categories",
			authorManager: isHindi ? "लेखक (रचयिता)" : "Authors",
			glorificationManager: isHindi
				? "आविर्भाव महोत्सव महिमा"
				: "Aavirbhav Glorifications",
			back: isHindi ? "पीछे" : "Back",
			loading: isHindi ? "एक्सेस लोड हो रहा है..." : "Loading access...",
		};

		const getTitle = () => {
			switch (currentScreen) {
				case "home":
					return t.contentManager;
				case "local_data":
					return t.localData;
				case "online_text":
					return t.onlineText;
				case "bhajans":
					return t.bhajanManager;
				case "books":
					return t.bookManager;
				case "lectures":
					return t.lectureManager;
				case "events":
					return t.calendarEditor;
				case "info_screen":
					return t.infoScreen;
				case "social_media":
					return t.socialMedia;
				case "banners":
					return t.bannerManager;
				case "gallery_editor":
					return t.galleryEditor;
				case "gallery_activity_ui":
					return t.galleryActivityUI;
				case "notification_sender":
					return t.notifSender;
				case "access_control":
					return t.accessControl;
				case "approvals":
					return t.approvals;
				case "mandal_manager":
					return t.mandalManager;
				case "more_settings":
					return t.moreSettings;
				case "dedication_videos":
					return t.dedicationVideos;
				case "devotee_profiles":
					return t.devoteeProfiles;
				case "community_manager":
					return t.communityManager;
				case "gender_setup":
					return t.genderSetup;
				case "family_explorer":
					return t.familyExplorer;
				case "comment_moderation":
					return isHindi ? "टिप्पणियाँ प्रबंधित करें" : "Manage Comments";
				case "usage":
					return isHindi ? "ऐप का उपयोग" : "Usage";
				case "link_requests":
					return isHindi ? "परिवार लिंक अनुरोध" : "Family Link Requests";
				case "cleanup":
					return isHindi ? "डुप्लिकेट व गड़बड़ियाँ" : "Duplicates & problems";
				case "relation_fixes":
					return isHindi ? "रिश्ते अपने-आप भरें" : "Fix relations";
				case "filter_categories":
					return t.filterCategories;
				case "author_manager":
					return t.authorManager;
				case "ota_diagnostics":
					return isHindi ? "OTA डायग्नोस्टिक्स" : "OTA Diagnostics";
				case "glorification_manager":
					return t.glorificationManager;
				default:
					return "Admin";
			}
		};

		const handleUpdateBhajanList = (newList: Bhajan[]) =>
			onUpdateBhajans(newList);
		const handleUpdateBookList = (newList: Book[]) => onUpdateBooks(newList);
		const handleUpdateLectureList = (newList: LectureData[]) =>
			onUpdateLectures(newList);
		const handleUpdateEventList = (newList: EventData[]) =>
			onUpdateEvents(newList);

		return (
			<DevoteeEditContext.Provider value={openDevoteeEdit}>
			<div className="fixed inset-0 z-[60] bg-slate-100 dark:bg-slate-900 flex flex-col animate-in slide-in-from-bottom duration-300">
				{/* Header */}
				<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between shadow-sm z-10">
					<div className="flex items-center gap-3">
						{navStack.length > 1 ? (
							<button
								onClick={popScreen}
								className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors active:scale-95"
							>
								<ArrowLeft size={18} /> {t.back}
							</button>
						) : (
							<div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
								<Edit2 size={16} />
							</div>
						)}
						<div>
							<h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
								{getTitle()}
							</h2>
						</div>
					</div>
					<div className="flex items-center gap-3">
						{navStack.length === 1 && adminName && (
							<span className="text-sm font-medium text-slate-600 dark:text-slate-300 capitalize">
								{adminName}
							</span>
						)}
						{navStack.length === 1 && (
							<button
								type="button"
								onClick={toggleAdminLang}
								aria-label={
									isHindi ? "Switch to English" : "हिंदी में बदलें"
								}
								title={isHindi ? "Switch to English" : "हिंदी में बदलें"}
								className="min-h-touch px-3 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 active:scale-95 transition"
							>
								<Languages size={16} />
								{isHindi ? "EN" : "हिं"}
							</button>
						)}
						<button
							onClick={handleCloseClick}
							className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
							title="Close Admin Panel"
						>
							<X size={20} className="text-slate-500 dark:text-slate-400" />
						</button>
					</div>
				</div>

				{/* Content Area */}
				<div className="flex-1 overflow-hidden relative flex flex-col bg-slate-50 dark:bg-slate-900 pb-[env(safe-area-inset-bottom)]">
					{loadingRole ? (
						<div className="flex items-center justify-center p-10 text-slate-500 dark:text-ink-300">
							{t.loading}
						</div>
					) : !auth.currentUser ? (
						<AdminLoginCard
							isHindi={isHindi}
							onSignedIn={() => {
								setLoadingRole(true);
								setSignInCount((n) => n + 1);
							}}
						/>
					) : (
						currentScreen === "home" && (
							<div className="p-4 space-y-4 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
								{userRole?.role === "mandal" ? (
									<AdminMenuButton
										icon={<MapPin size={24} />}
										label={isHindi ? "मेरा मंडल" : "My Mandal"}
										description={
											isHindi
												? "साप्ताहिक कार्यक्रम, एक्टिविटी व गैलरी प्रबंधित करें"
												: "Manage Weekly Program, Activity & Gallery"
										}
										onClick={() => pushScreen("mandal_manager")}
										colorClass="text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400"
									/>
								) : (
									<>
										{(adminName === "damodar" ||
											adminName === "damodar2" ||
											userRole?.role === "super" ||
											auth.currentUser?.email?.includes("damodar@")) && (
											<>
												<AdminMenuButton
													icon={<Users size={24} />}
													label={t.communityManager}
													description={
														isHindi
															? "भक्त प्रोफाइल और टिप्पणियाँ प्रबंधित करें"
															: "Manage Devotee Profiles & Comments"
													}
													onClick={() => pushScreen("community_manager")}
													colorClass="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
												/>
												<AdminMenuButton
													icon={<Shield size={24} />}
													label={t.accessControl}
													description={
														isHindi
															? "व्यवस्थापक भूमिकाएं प्रबंधित करें"
															: "Manage Admin Roles"
													}
													onClick={() => pushScreen("access_control")}
													colorClass="text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400"
												/>
												<AdminMenuButton
													icon={<CheckCircle size={24} />}
													label={t.approvals}
													description={
														isHindi
															? "मण्डल अपडेट्स को मंज़ूरी दें"
															: "Approve Mandal Updates"
													}
													onClick={() => pushScreen("approvals")}
													colorClass="text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400"
												/>
												<AdminMenuButton
													icon={<MapPin size={24} />}
													label={t.mandalManager}
													description={
														isHindi ? "सभी मंडल प्रबंधित करें" : "Manage All Mandals"
													}
													onClick={() => pushScreen("mandal_manager")}
													colorClass="text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400"
												/>
											</>
										)}
										{(userRole?.role === "super" ||
											(userRole?.role === "custom" &&
												userRole?.permissions?.includes("local_data"))) && (
											<>
												<AdminMenuButton
													icon={<Database size={24} />}
													label={t.localData}
													description={
														isHindi
															? "भजन, किताबें और प्रवचन प्रबंधित करें"
															: "Manage Bhajans, Books, and Lectures"
													}
													onClick={() => pushScreen("local_data")}
												/>
												<AdminMenuButton
													icon={<Database size={24} />}
													label="Backblaze Files"
													description={
														isHindi
															? "बैकब्लेज़ फाइल्स प्रबंधित करें"
															: "Manage Backblaze Files"
													}
													onClick={() => pushScreen("backblaze_manager")}
													colorClass="text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400"
												/>
											</>
										)}
										{(userRole?.role === "super" ||
											(userRole?.role === "custom" &&
												userRole?.permissions?.includes("info_screen"))) && (
											<AdminMenuButton
												icon={<FileText size={24} />}
												label={t.infoScreen}
												description={
													isHindi ? "सूचना पॉपअप प्रबंधित करें" : "Manage Info Popup"
												}
												onClick={() => pushScreen("info_screen")}
												colorClass="text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400"
											/>
										)}
										{(userRole?.role === "super" ||
											(userRole?.role === "custom" &&
												userRole?.permissions?.includes("social_media"))) && (
											<AdminMenuButton
												icon={<User size={24} />}
												label={t.socialMedia}
												description={
													isHindi ? "लाइव लिंक प्रबंधित करें" : "Manage Live Links"
												}
												onClick={() => pushScreen("social_media")}
												colorClass="text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400"
											/>
										)}
										{(userRole?.role === "super" ||
											(userRole?.role === "custom" &&
												userRole?.permissions?.includes("banners"))) && (
											<AdminMenuButton
												icon={<Bell size={24} />}
												label={t.bannerManager}
												description={
													isHindi
														? "होम स्क्रीन बैनर प्रबंधित करें"
														: "Manage Home Banners"
												}
												onClick={() => pushScreen("banners")}
												colorClass="text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400"
											/>
										)}
										{(userRole?.role === "super" ||
											(userRole?.role === "custom" &&
												userRole?.permissions?.includes("events"))) && (
											<AdminMenuButton
												icon={<CalendarCheck size={24} />}
												label={t.calendarEditor}
												description={
													isHindi
														? "वैष्णव कैलेंडर कार्यक्रम प्रबंधित करें"
														: "Manage Vaishnav Calendar Events"
												}
												onClick={() => pushScreen("events")}
												colorClass="text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400"
											/>
										)}
										{(adminName === "damodar" ||
											(userRole?.role === "custom" &&
												userRole?.permissions?.includes("gallery_editor"))) && (
											<AdminMenuButton
												icon={<ImageIcon size={24} />}
												label={t.galleryEditor}
												description={
													isHindi
														? "गैलरी चित्र प्रबंधित करें"
														: "Manage Gallery Images"
												}
												onClick={() => pushScreen("gallery_editor")}
												colorClass="text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
											/>
										)}
										{(adminName === "damodar" ||
											(userRole?.role === "custom" &&
												userRole?.permissions?.includes(
													"gallery_activity_ui",
												))) && (
											<AdminMenuButton
												icon={<ImageIcon size={24} />}
												label={t.galleryActivityUI}
												description={
													isHindi
														? "गैलरी तथा गतिविधि चित्र प्रबंधित करें"
														: "Manage Gallery and Activity Images"
												}
												onClick={() => pushScreen("gallery_activity_ui")}
												colorClass="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
											/>
										)}
										{(userRole?.role === "super" ||
											(userRole?.role === "custom" &&
												userRole?.permissions?.includes(
													"notification_sender",
												))) && (
											<AdminMenuButton
												icon={<Bell size={24} />}
												label={t.notifSender}
												description={
													isHindi
														? "पुश नोटिफिकेशन भेजें"
														: "Send Push Notifications"
												}
												onClick={() => pushScreen("notification_sender")}
												colorClass="text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400"
											/>
										)}

										{adminName === "damodar" && (
											<AdminMenuButton
												icon={<Video size={24} />}
												label={t.dedicationVideos}
												description={
													isHindi ? "वीडियो प्रबंधित करें" : "Manage Videos"
												}
												onClick={() => pushScreen("dedication_videos")}
												colorClass="text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400"
											/>
										)}
										{adminName === "damodar" && (
											<AdminMenuButton
												icon={<Smartphone size={24} />}
												label={t.moreSettings}
												description={
													isHindi
														? "पुराने वर्ज़न को ब्लॉक करें (Force Update)"
														: "Block old app versions (Force Update)"
												}
												onClick={() => pushScreen("more_settings")}
												colorClass="text-slate-600 bg-slate-200 dark:bg-slate-700/50 dark:text-slate-400"
											/>
										)}
									</>
								)}
							</div>
						)
					)}

					{currentScreen === "local_data" && (
						<div className="p-4 space-y-4 overflow-y-auto pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-right">
							<AdminMenuButton
								icon={<Music size={24} />}
								label={t.bhajans}
								onClick={() => pushScreen("bhajans")}
							/>
							<AdminMenuButton
								icon={<BookOpen size={24} />}
								label={t.books}
								onClick={() => pushScreen("books")}
								colorClass="text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400"
							/>
							<AdminMenuButton
								icon={<Mic size={24} />}
								label={t.lectures}
								onClick={() => pushScreen("lectures")}
								colorClass="text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400"
							/>
							<AdminMenuButton
								icon={<SlidersHorizontal size={24} />}
								label={t.filterCategories}
								description={
									isHindi
										? "भजन फ़िल्टर श्रेणियाँ प्रबंधित करें"
										: "Manage Bhajan Filter Categories"
								}
								onClick={() => pushScreen("filter_categories")}
								colorClass="text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400"
							/>
							<AdminMenuButton
								icon={<Users size={24} />}
								label={t.authorManager}
								description={
									isHindi
										? "लेखकों के प्रदर्शन नाम प्रबंधित करें"
										: "Manage Author Display Names"
								}
								onClick={() => pushScreen("author_manager")}
								colorClass="text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400"
							/>

							<div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
								{/* Force Sync Progress Card */}
								{forceSyncStatus && (
									<div
										className={`rounded-2xl border p-4 space-y-3 animate-fade-in transition-all ${
											forceSyncStatus.step === "Done"
												? "border-green-300 bg-green-50 dark:bg-green-900/20"
												: forceSyncStatus.step === "Error"
													? "border-red-300 bg-red-50 dark:bg-red-900/20"
													: "border-gold-600/40 bg-gold-600/5"
										}`}
									>
										{/* Header */}
										<div className="flex items-center gap-2">
											{forceSyncStatus.step === "Done" ? (
												<div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shrink-0">
													<Check size={14} className="text-white" />
												</div>
											) : forceSyncStatus.step === "Error" ? (
												<div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center shrink-0">
													<X size={14} className="text-white" />
												</div>
											) : (
												<div className="w-7 h-7 rounded-full border-2 border-gold-600 border-t-transparent animate-spin shrink-0" />
											)}
											<div className="flex-1 min-w-0">
												<p
													className={`text-sm font-bold ${
														forceSyncStatus.step === "Done"
															? "text-green-700 dark:text-green-300"
															: forceSyncStatus.step === "Error"
																? "text-red-700 dark:text-red-300"
																: "text-gold-700"
													}`}
												>
													{forceSyncStatus.step === "Done"
														? "✅ Sync Complete!"
														: forceSyncStatus.step === "Error"
															? "❌ Sync Failed"
															: `☁️ Syncing ${forceSyncStatus.step}... (${forceSyncStatus.stepIndex}/${forceSyncStatus.totalSteps})`}
												</p>
												<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
													{forceSyncStatus.detail}
												</p>
											</div>
										</div>

										{/* Step Progress Bar */}
										{forceSyncStatus.step !== "Error" && (
											<div className="space-y-1">
												<div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
													<div
														className={`h-full rounded-full transition-all duration-700 ${
															forceSyncStatus.step === "Done"
																? "bg-green-500"
																: "bg-gold-600"
														}`}
														style={{
															width: `${Math.round((forceSyncStatus.stepIndex / forceSyncStatus.totalSteps) * 100)}%`,
														}}
													/>
												</div>
												<div className="flex justify-between">
													{[
														"भजन",
														"पुस्तकें",
														"कथा",
														settingsLanguage === "hi" ? "प्रकाशन" : "Publish",
													].map((label, i) => (
														<span
															key={label}
															className={`text-[10px] font-bold uppercase tracking-wider ${
																i < forceSyncStatus.stepIndex
																	? "text-gold-700"
																	: i === forceSyncStatus.stepIndex - 1 &&
																			forceSyncStatus.isRunning
																		? "text-gold-700 animate-pulse"
																		: "text-slate-400 dark:text-ink-400"
															}`}
														>
															{label}
														</span>
													))}
												</div>
											</div>
										)}
									</div>
								)}

								{/* Force Sync Button */}
								<AdminMenuButton
									icon={
										forceSyncStatus?.isRunning ? (
											<RotateCcw size={24} className="animate-spin" />
										) : (
											<RotateCcw size={24} />
										)
									}
									label={settingsLanguage === "hi" ? "फ़ोर्स सिंक" : "Force Sync"}
									description={
										settingsLanguage === "hi"
											? "नवीनतम डेटा लाएँ और सभी उपयोगकर्ताओं के लिए अपडेट प्रकाशित करें"
											: "Fetch latest cloud data and publish update for all users"
									}
									onClick={() => {
										if (forceSyncStatus?.isRunning) return;
										setConfirmDialog({
											message:
												"Force Sync will fetch the latest Bhajans, Books & Lectures and notify all users to update in background. Continue?",
											onConfirm: async () => {
												closeConfirmDialog();
												await forceSyncCloudData();
											},
										});
									}}
									colorClass="text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400"
								/>
							</div>
						</div>
					)}

					{currentScreen === "online_text" && (
						<div className="p-4 space-y-4 overflow-y-auto animate-in slide-in-from-right">
							<AdminMenuButton
								icon={<FileText size={24} />}
								label={t.infoScreen}
								onClick={() => pushScreen("info_screen")}
							/>
							<AdminMenuButton
								icon={<User size={24} />}
								label={t.socialMedia}
								onClick={() => pushScreen("social_media")}
								colorClass="text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400"
							/>
							<AdminMenuButton
								icon={<Bell size={24} />}
								label={t.bannerManager}
								onClick={() => pushScreen("banners")}
								colorClass="text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400"
							/>
						</div>
					)}

					{currentScreen === "community_manager" && (
						<div className="p-4 space-y-4 overflow-y-auto animate-in slide-in-from-right">
							<AdminMenuButton
								icon={<Users size={24} />}
								label={t.devoteeProfiles}
								description={
									isHindi
										? "प्रोफाइल मंज़ूरी और प्रबंधन"
										: "Profile Approvals & Management"
								}
								onClick={() => pushScreen("devotee_profiles")}
								colorClass="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
							/>
							<AdminMenuButton
								icon={<Network size={24} />}
								label={t.familyExplorer}
								description={
									isHindi
										? "किसी का भी परिवार वृक्ष देखें, कौन किससे जुड़ा है — पूरा नक्शा"
										: "See anyone's family tree and who is connected to whom"
								}
								onClick={() => pushScreen("family_explorer")}
								colorClass="text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400"
							/>
							<AdminMenuButton
								icon={<MessageCircle size={24} />}
								label={isHindi ? "टिप्पणियाँ प्रबंधित करें" : "Manage Comments"}
								description={
									isHindi
										? "सभी उपयोगकर्ता टिप्पणियों की निगरानी करें"
										: "Monitor all user comments"
								}
								onClick={() => pushScreen("comment_moderation")}
								colorClass="text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
							/>
							<AdminMenuButton
								icon={<Heart size={24} />}
								label={t.glorificationManager}
								description={
									isHindi
										? "आविर्भाव महोत्सव की सभी महिमा देखें"
										: "View all Aavirbhav Mahotsav glorifications"
								}
								onClick={() => pushScreen("glorification_manager")}
								colorClass="text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400"
							/>
							<AdminMenuButton
								icon={<UserCheck size={24} />}
								label={t.genderSetup}
								description={
									isHindi
										? "जिनका लिंग सेट नहीं है, उनका एक-एक करके सेट करें"
										: "Set it one by one for everyone who hasn't"
								}
								onClick={() => pushScreen("gender_setup")}
								colorClass="text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400"
							/>
							<AdminMenuButton
								icon={<Wand2 size={24} />}
								label={isHindi ? "रिश्ते अपने-आप भरें" : "Fix relations"}
								description={
									isHindi
										? "एक तरफ़ का रिश्ता और लिंग पता है तो दूसरी तरफ़ भरें (बेटी ⇒ माता), गलत रिश्ते पकड़ें"
										: "Fill the other side from what's known (daughter ⇒ mother), catch wrong ones"
								}
								onClick={() => pushScreen("relation_fixes")}
								colorClass="text-fuchsia-600 bg-fuchsia-100 dark:bg-fuchsia-900/30 dark:text-fuchsia-400"
							/>
							<AdminMenuButton
								icon={<GitMerge size={24} />}
								label={isHindi ? "डुप्लिकेट व गड़बड़ियाँ" : "Duplicates & problems"}
								description={
									isHindi
										? "एक भक्त की दो प्रोफ़ाइल, दो बार जोड़े परिवारजन, टूटे लिंक — देखें और ठीक करें"
										: "Two profiles of one devotee, family added twice, broken links — find and fix"
								}
								onClick={() => pushScreen("cleanup")}
								colorClass="text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400"
							/>
							{/* Super admins only. */}
							{isSuperAdmin && (
								<>
									<AdminMenuButton
										icon={<Link2 size={24} />}
										label={isHindi ? "परिवार लिंक अनुरोध" : "Family Link Requests"}
										description={
											isHindi
												? "किसने किसे लिंक अनुरोध भेजा है, जो अभी स्वीकार नहीं हुआ"
												: "Who has sent a link request to whom that is still waiting"
										}
										onClick={() => pushScreen("link_requests")}
										colorClass="text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400"
									/>
									<AdminMenuButton
										icon={<BarChart3 size={24} />}
										label={isHindi ? "ऐप का उपयोग (Usage)" : "Usage"}
										description={
											isHindi
												? "कौन भक्त ऐप कितनी देर, कब चलाते हैं — दिन, हफ़्ता, महीना"
												: "Who uses the app, how long and when — day, week, month"
										}
										onClick={() => pushScreen("usage")}
										colorClass="text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400"
									/>
								</>
							)}
						</div>
					)}

					{currentScreen === "usage" && isSuperAdmin && (
						<UsageManager isHindi={settingsLanguage === "hi"} />
					)}
					{currentScreen === "link_requests" && isSuperAdmin && (
						<LinkRequestsManager isHindi={settingsLanguage === "hi"} />
					)}
					{currentScreen === "cleanup" && (
						<CleanupManager
							isHindi={settingsLanguage === "hi"}
							isSuperAdmin={isSuperAdmin}
						/>
					)}
					{currentScreen === "relation_fixes" && (
						<RelationFixManager isHindi={settingsLanguage === "hi"} />
					)}
					{currentScreen === "gender_setup" && (
						<GenderSetupManager isHindi={settingsLanguage === "hi"} />
					)}
					{currentScreen === "family_explorer" && (
						<FamilyExplorer isHindi={settingsLanguage === "hi"} />
					)}

					{currentScreen === "comment_moderation" && (
						<CommentModerationManager
							onClose={() => popScreen()}
							isHindi={settingsLanguage === "hi"}
						/>
					)}
					{currentScreen === "glorification_manager" && (
						<GlorificationManager
							onClose={() => popScreen()}
							isHindi={settingsLanguage === "hi"}
						/>
					)}

					{currentScreen === "bhajans" && (
						<BhajanManager
							bhajans={bhajans}
							searchQuery={searchQuery}
							setSearchQuery={setSearchQuery}
							selectedBhajan={selectedBhajan}
							onSelectBhajan={(b) =>
								b ? setSelectedBhajan(b) : closeSelectedBhajan()
							}
							onUpdateList={handleUpdateBhajanList}
							showToast={showToast}
							settingsLanguage={settingsLanguage}
						/>
					)}
					{currentScreen === "books" && (
						<BookManager
							allBooks={allBooks}
							onUpdateList={handleUpdateBookList}
							showToast={showToast}
							settingsLanguage={settingsLanguage}
						/>
					)}
					{currentScreen === "lectures" && (
						<LectureManager
							allLectures={allLectures}
							onUpdateList={handleUpdateLectureList}
							showToast={showToast}
							settingsLanguage={settingsLanguage}
						/>
					)}
					{currentScreen === "events" && (
						<EventManager
							events={events}
							onUpdateList={handleUpdateEventList}
							showToast={showToast}
							settingsLanguage={settingsLanguage}
						/>
					)}

					{currentScreen === "info_screen" && (
						<InfoScreenManager settingsLanguage={settingsLanguage} />
					)}
					{currentScreen === "social_media" && (
						<SocialMediaManager
							showToast={showToast}
							settingsLanguage={settingsLanguage}
						/>
					)}
					{currentScreen === "banners" && (
						<BannerAdmin settingsLanguage={settingsLanguage} />
					)}
					{currentScreen === "gallery_editor" && (
						<GalleryEditor
							onBack={popScreen}
							settingsLanguage={settingsLanguage}
						/>
					)}
					{currentScreen === "gallery_activity_ui" && (
						<GalleryUI onBack={popScreen} settingsLanguage={settingsLanguage} />
					)}
					{currentScreen === "notification_sender" && (
						<NotificationSender
							onBack={popScreen}
							settingsLanguage={settingsLanguage}
						/>
					)}

					{currentScreen === "access_control" && <AccessControlManager />}
					{currentScreen === "approvals" && <ApprovalManager />}
					{currentScreen === "mandal_manager" && (
						<MandalManager
							mandalId={userRole?.mandalId || ""}
							isSuperAdmin={userRole?.role === "super"}
							permissions={userRole?.permissions}
						/>
					)}
					{currentScreen === "more_settings" && (
						<div className="h-full flex flex-col">
							{/* OTA Diagnostics entry button at top of more_settings */}
							<div className="p-4 pb-0">
								<AdminMenuButton
									icon={<Shield size={24} />}
									label={isHindi ? "OTA डायग्नोस्टिक्स" : "OTA Diagnostics"}
									description={
										isHindi
											? "इस डिवाइस का अपडेट स्टेटस देखें"
											: "View live OTA bundle & version state for this device"
									}
									onClick={() => pushScreen("ota_diagnostics")}
									colorClass="text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400"
								/>
							</div>
							<div className="flex-1 overflow-hidden">
								<MoreSettingsManager />
							</div>
						</div>
					)}
					{currentScreen === "ota_diagnostics" && <OtaDiagnosticsManager />}
					{currentScreen === "dedication_videos" && (
						<VideoManager
							showToast={showToast}
							settingsLanguage={settingsLanguage}
						/>
					)}
					{currentScreen === "devotee_profiles" && (
						<DevoteeProfileManager
							settingsLanguage={settingsLanguage}
							isSuperAdmin={userRole?.role === "super"}
						/>
					)}
					{currentScreen === "filter_categories" && (
						<FilterCategoryManager
							bhajans={bhajans}
							onUpdateBhajans={handleUpdateBhajanList}
							showToast={showToast}
							settingsLanguage={settingsLanguage}
						/>
					)}
					{currentScreen === "author_manager" && (
						<AuthorManager
							bhajans={bhajans}
							onUpdateBhajans={handleUpdateBhajanList}
							showToast={showToast}
							settingsLanguage={settingsLanguage}
						/>
					)}
					{currentScreen === "backblaze_manager" && (
						<BackblazeManager showToast={showToast} />
					)}
				</div>

				{/* ── CONFIRM DIALOG ── */}
				{confirmDialog && (
					<div
						className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
						onClick={() => closeConfirmDialog()}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
								<RotateCcw size={24} className="text-red-500" />
							</div>
							<h3 className="text-lg font-bold text-slate-800 dark:text-white text-center mb-2">
								Confirm Action
							</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
								{confirmDialog.message}
							</p>
							<div className="flex gap-3">
								<button
									onClick={() => closeConfirmDialog()}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 active:scale-95 transition-transform"
								>
									Cancel
								</button>
								<button
									onClick={() => {
										confirmDialog.onConfirm();
										closeConfirmDialog();
									}}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white active:scale-95 transition-all shadow-sm"
								>
									Continue
								</button>
							</div>
						</div>
					</div>
				)}

				{/* ── TOAST NOTIFICATION ── */}
				{toastMessage && (
					<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] animate-in slide-in-from-bottom-4 duration-200 pointer-events-none">
						<div
							className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[200px] ${toastMessage.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
						>
							{toastMessage.type === "success" ? (
								<CheckCircle size={18} />
							) : (
								<X size={18} />
							)}
							<span className="font-bold text-sm">{toastMessage.text}</span>
						</div>
					</div>
				)}
			</div>
			<ProcessingBlockerModal
				isVisible={!!forceSyncStatus?.isRunning}
				viewId="admin-force-sync-blocker"
				title={
					settingsLanguage === "hi" ? "फ़ोर्स सिंक हो रहा है…" : "Force syncing…"
				}
				message={forceSyncStatus?.detail}
				stepIndex={forceSyncStatus?.stepIndex}
				totalSteps={forceSyncStatus?.totalSteps}
				isHindi={settingsLanguage === "hi"}
			/>
			{devoteeFocus && (
				<DevoteeProfileManager
					key={`${devoteeFocus.target.uid}_${devoteeFocus.target.memberId || ""}`}
					settingsLanguage={settingsLanguage}
					isSuperAdmin={userRole?.role === "super"}
					overrideMandalId={
						userRole?.role === "mandal" ? userRole?.mandalId : undefined
					}
					focus={devoteeFocus.target}
					onFocusClose={(changed) => {
						const done = devoteeFocus.onClosed;
						setDevoteeFocus(null);
						done?.(changed);
					}}
				/>
			)}
			</DevoteeEditContext.Provider>
		);
	},
);

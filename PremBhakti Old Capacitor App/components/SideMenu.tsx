import { doc, getDoc } from "firebase/firestore";
import {
	Bell,
	CircleHelp,
	Clock,
	Compass,
	Download,
	Heart,
	Info,
	MessageCircle,
	Play,
	RefreshCcw,
	Settings,
	Share2,
	ShieldCheck,
	Smartphone,
	Sparkles,
	User,
	X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { db } from "../services/firebase";
import { useDevicePerformance } from "../src/hooks/useDevicePerformance";
import { requestTourReplay } from "../src/tour/tourBus";
import { shareAppContent } from "../utils/shareService";
import { APP_VERSION } from "../version";
import { FeedbackModal } from "./FeedbackModal";

interface SideMenuProps {
	isOpen: boolean;
	onClose: () => void;
	onOpenAbout?: () => void;
	onOpenDonate?: () => void;
	onHome?: () => void;
	onOpenDownloaded?: () => void;
	onOpenDailyQuotes?: () => void;
	onOpenDailyInfo?: () => void;
	onOpenEvents?: () => void;
	onOpenDailyDarshan?: () => void;
	onOpenSevaCenter?: () => void;
	onOpenTempleTimings?: () => void;
	onOpenPrivacy?: () => void;
	onOpenTerms?: () => void;
	onOpenInformation?: () => void;
	onOpenOnboarding?: () => void;
	onOpenSettings?: () => void;
	onOpenProfile?: () => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage: "en" | "hi";
	hasNewOtaUpdate?: boolean;
	onOpenUpdater?: () => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({
	isOpen,
	onClose,
	onOpenAbout,
	onOpenDonate,
	onHome,
	onOpenDownloaded,
	onOpenPrivacy,
	onOpenTerms,
	onOpenInformation,
	onOpenOnboarding,
	onOpenSettings,
	onOpenProfile,
	onOpenSevaCenter,
	onOpenTempleTimings,
	scrollBarSide = "left",
	settingsLanguage,
	hasNewOtaUpdate,
	onOpenUpdater,
}) => {
	const { informationData, hasNewInformation } = useSettings();
	const { showToast } = useToast();
	const { isLowEnd } = useDevicePerformance();
	const [_isOnline, setIsOnline] = useState(navigator.onLine);
	const [showHelpModal, setShowHelpModal] = useState(false);
	// Back-button: showHelpModal
	useEffect(() => {
		if (showHelpModal)
			window.history.pushState({ isPopup: true, view: "help-sidemenu" }, "");
	}, [showHelpModal]);
	const handleClose_help_sidemenu = () => {
		if (window.history.state?.view === "help-sidemenu") window.history.back();
		else setShowHelpModal(false);
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_help_sidemenu is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const _h_help_sidemenu = (e: PopStateEvent) => {
			if (showHelpModal && e.state?.view !== "help-sidemenu")
				handleClose_help_sidemenu();
		};
		window.addEventListener("popstate", _h_help_sidemenu);
		return () => window.removeEventListener("popstate", _h_help_sidemenu);
	}, [showHelpModal]);
	const [showFeedbackModal, setShowFeedbackModal] = useState(false);
	const [appVersion, _setAppVersion] = useState(APP_VERSION);
	const [youtubeLink, setYoutubeLink] = useState(
		"https://www.youtube.com/watch?v=kYIIfyRk49k",
	);
	const scrollContainerRef = React.useRef<HTMLDivElement>(null);

	// Translations
	const t = {
		en: {
			title: "Shree Chaitanya Prem Bhakti Sangh",
			subtitle: "Official App",
			home: "Home",
			information: "Information",
			noNewInformation: "No new information",
			donate: "Donate",
			downloads: "Downloads / Offline",
			about: "About Us",
			privacy: "Privacy Policy",
			terms: "Terms of Service",
			feedback: "Feedback / Queries",
			feedbackSub: "(replied within a day)",
			online: "Online",
			offline: "Offline Mode",
			howToUse: "How to use App",
			appTour: "App Tour",
			tourDesc: "Step-by-step guide",
			introSlides: "Intro Slides",
			introSlidesDesc: "See the welcome slides again",
			watchVideo: "Watch Video Demo",
			videoDesc: "Watch on YouTube",
			cancel: "Cancel",
			open: "Open",
			templeTimings: "Temple Timings",
		},
		hi: {
			title: "श्री चैतन्य प्रेम भक्ति संघ",
			subtitle: "आधिकारिक ऐप",
			home: "होम",
			information: "सूचना",
			noNewInformation: "कोई नई सूचना नहीं",
			donate: "सहयोग करें",
			downloads: "डाउनलोड्स / ऑफलाइन",
			about: "हमारे बारे में",
			privacy: "गोपनीयता नीति",
			terms: "सेवा की शर्तें",
			feedback: "सुझाव / संपर्क",
			feedbackSub: "(एक दिन में उत्तर)",
			online: "ऑनलाइन",
			offline: "ऑफलाइन",
			howToUse: "उपयोग कैसे करें",
			appTour: "ऐप टूर",
			tourDesc: "चरण-दर-चरण मार्गदर्शन",
			introSlides: "परिचय स्लाइड्स",
			introSlidesDesc: "शुरुआती परिचय फिर से देखें",
			watchVideo: "वीडियो डेमो देखें",
			videoDesc: "यूट्यूब पर वीडियो देखें",
			cancel: "रद्द करें",
			open: "खोलें",
			templeTimings: "मंदिर दर्शन समय",
		},
	}[settingsLanguage];

	useEffect(() => {
		const handleStatusChange = () => {
			setIsOnline(navigator.onLine);
		};

		window.addEventListener("online", handleStatusChange);
		window.addEventListener("offline", handleStatusChange);

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

		return () => {
			window.removeEventListener("online", handleStatusChange);
			window.removeEventListener("offline", handleStatusChange);
		};
	}, []);

	// Close help modal and reset scroll when side menu closes
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_help_sidemenu is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (!isOpen) {
			handleClose_help_sidemenu();
			// Reset scroll position when menu is closed
			if (scrollContainerRef.current) {
				scrollContainerRef.current.scrollTop = 0;
			}
		}
	}, [isOpen]);

	// History listener for Help Modal
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_help_sidemenu is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (showHelpModal) {
			const id = `help-modal-${Date.now()}`;
			window.history.pushState({ isPopup: true, modalId: id }, "");
			const handler = () => handleClose_help_sidemenu();
			window.addEventListener("popstate", handler);
			return () => {
				window.removeEventListener("popstate", handler);
				if (window.history.state?.modalId === id) window.history.back();
			};
		}
	}, [showHelpModal]);

	const handleFeedback = () => {
		setShowFeedbackModal(true);
	};

	const handleInformationClick = () => {
		if (onOpenInformation) onOpenInformation();
	};

	const handleShare = async () => {
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

	const handleCheckUpdate = () => {
		if (onOpenUpdater) {
			onOpenUpdater();
			onClose();
		}
	};

	return (
		<>
			{/* Backdrop */}
			<div
				className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 landscape:hidden ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
				onClick={onClose}
			/>

			{/* Drawer */}
			<div
				className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] landscape:w-64 bg-cream-50 dark:bg-ink-900 font-body z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col landscape:translate-x-0 landscape:shadow-none landscape:border-r landscape:border-ink-200 dark:landscape:border-ink-800 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
			>
				{/* Header - Changed to Cream/Gold theme */}
				<div
					onClick={onOpenAbout}
					className="relative overflow-hidden h-56 landscape:h-auto landscape:min-h-[72px] bg-cream-50 dark:bg-ink-900 flex flex-col justify-end landscape:justify-center p-6 pt-[calc(3.5rem+env(safe-area-inset-top))] landscape:p-4 landscape:pt-[calc(0.5rem+env(safe-area-inset-top))] cursor-pointer hover:brightness-105 active:brightness-95 transition-all group shrink-0 border-b-[1.5px] border-ry-gold/40 landscape:border-b landscape:border-ink-200 dark:landscape:border-ink-800"
				>
					{/* Dawn Wash - matching HomeScreen */}
					<div
						className="pointer-events-none absolute inset-x-0 top-0 z-0 h-full"
						aria-hidden="true"
						style={{
							background:
								"radial-gradient(125% 100% at 50% 0%, rgba(255, 213, 79, 0.20) 0%, rgba(255, 213, 79, 0.07) 45%, transparent 78%)",
						}}
					/>
					{/* Background Texture Overlay */}
					<div
						className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-multiply dark:opacity-10 dark:mix-blend-screen landscape:hidden"
						style={{
							backgroundImage:
								"url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
						}}
					></div>

					<div className="relative z-10 flex flex-col landscape:hidden">
						{/* Updated Golden Logo */}
						<div
							className={`mb-3 origin-left shrink-0 drop-shadow-sm ${isLowEnd ? "" : "transform group-hover:scale-105 transition-transform duration-300"}`}
						>
							<svg viewBox="0 0 100 220" className="h-16 w-auto">
								<path
									d="M30 10v85q0 40 20 40t20-40V10"
									fill="transparent"
									stroke="#bc8d31"
									strokeWidth="10"
									strokeLinecap="round"
								/>
								<path
									d="M50 135 C28 135, 20 165, 50 200 C80 165, 72 135, 50 135 Z"
									fill="#bc8d31"
									stroke="#bc8d31"
									strokeWidth="4"
									strokeLinecap="round"
								/>
							</svg>
						</div>

						<div className="flex-1 min-w-0 flex flex-col">
							<h2
								className={`text-ry-gold text-2xl leading-none group-hover:translate-x-1 transition-transform ${settingsLanguage === "hi" ? "font-hindi-display font-semibold mt-2" : "font-display font-semibold tracking-wide"}`}
							>
								{settingsLanguage === "hi" ? "श्री चैतन्य" : "Shree Chaitanya"}
							</h2>
							{/* Golden Separator Line */}
							<div className="w-full max-w-[180px] h-[1.5px] bg-ry-gold/80 my-2 group-hover:translate-x-1 transition-transform"></div>
							<p
								className={`text-ry-gold font-semibold uppercase group-hover:translate-x-1 transition-transform delay-75 ${settingsLanguage === "hi" ? "font-hindi text-[0.9rem]" : "font-body text-[0.65rem] tracking-[0.25em]"}`}
							>
								{settingsLanguage === "hi"
									? "प्रेम भक्ति संघ"
									: "Prem Bhakti Sangh"}
							</p>
						</div>
					</div>

					<div className="relative z-10 hidden landscape:flex items-center gap-3">
						<img
							src="/icons/icon-96.webp"
							alt="App Icon"
							className="w-10 h-10 rounded-xl shadow-sm object-cover"
						/>
						<div className="flex flex-col">
							<h2
								className={`text-slate-800 dark:text-white text-[15px] leading-tight ${settingsLanguage === "hi" ? "font-hindi font-bold" : "font-bold"}`}
							>
								{settingsLanguage === "hi" ? "प्रेम भक्ति" : "Prem Bhakti"}
							</h2>
							<p
								className={`text-blue-500/80 dark:text-blue-400 text-[10px] font-medium ${settingsLanguage === "hi" ? "font-hindi" : ""}`}
							>
								{settingsLanguage === "hi" ? "आधिकारिक ऐप" : "Official App"}
							</p>
						</div>
					</div>
				</div>

				{/* Close Button - Updated to Gold hover */}
				<button
					onClick={onClose}
					className="absolute top-[calc(2.5rem+env(safe-area-inset-top))] right-4 landscape:top-2 landscape:right-2 p-2 text-ry-gold/70 landscape:hidden hover:text-ry-gold hover:bg-ry-gold/10 rounded-full transition-colors z-20"
				>
					<X className="w-6 h-6" />
				</button>

				{/* Menu Items */}
				<div
					ref={scrollContainerRef}
					className={`flex-1 overflow-y-auto bg-cream-50 dark:bg-ink-900 ${scrollBarSide === "left" ? "left-scrollbar" : ""}`}
				>
					<div
						dir={scrollBarSide === "left" ? "ltr" : undefined}
						className="p-4 landscape:p-0 landscape:py-2 space-y-1 landscape:space-y-0"
					>
						<div className="hidden landscape:block px-4 py-2 text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase tracking-wider">
							MENU
						</div>

						{/* Profile (Landscape Only) moved to top */}
						<div className="hidden landscape:block mb-1">
							<MenuItem
								icon={<User />}
								label={
									settingsLanguage === "en" ? "Devotee Profile" : "भक्त प्रोफाइल"
								}
								onClick={onOpenProfile}
								tourId="menu-profile"
							/>
						</div>

						{/* Utility Navigation */}

						<MenuItem
							icon={<Bell className="text-blue-500" />}
							label={t.information}
							onClick={handleInformationClick}
							badge={hasNewInformation}
							tourId="menu-information"
						/>

						<MenuItem
							icon={<Heart />}
							label={t.donate}
							onClick={onOpenDonate}
							tourId="menu-donate"
						/>

						<MenuItem
							icon={<Clock className="text-purple-500" />}
							label={t.templeTimings}
							onClick={onOpenTempleTimings}
							tourId="menu-timings"
						/>

						<MenuItem
							icon={<Download />}
							label={t.downloads}
							onClick={() => {
								window.history.pushState({ view: "downloaded" }, "");
								if (onOpenDownloaded) onOpenDownloaded();
							}}
							tourId="menu-downloads"
						/>

						{/* Golden Divider */}
						<div className="h-px bg-ry-gold/20 landscape:bg-slate-100 dark:landscape:bg-slate-800 my-2 mx-2 landscape:mx-0" />

						{/* Check for Updates */}
						<MenuItem
							icon={
								<RefreshCcw className="text-green-600 dark:text-green-500" />
							}
							label={
								settingsLanguage === "en" ? "Check for Updates" : "अपडेट चेक करें"
							}
							onClick={handleCheckUpdate}
							badge={hasNewOtaUpdate}
							tourId="menu-update"
						/>

						{/* Share App */}
						<MenuItem
							icon={<Share2 />}
							label={settingsLanguage === "en" ? "Share App" : "ऐप शेयर करें"}
							onClick={handleShare}
							tourId="menu-share"
						/>

						{/* Information */}
						<MenuItem
							icon={<Info />}
							label={t.about}
							onClick={onOpenAbout}
							tourId="menu-about"
						/>

						<MenuItem
							icon={<ShieldCheck />}
							label={t.privacy}
							onClick={onOpenPrivacy}
							tourId="menu-privacy"
						/>

						<MenuItem
							icon={<CircleHelp />}
							label={t.howToUse}
							onClick={() => setShowHelpModal(true)}
							tourId="menu-help"
						/>

						{/* Golden Divider */}
						<div className="h-px bg-ry-gold/20 landscape:bg-slate-100 dark:landscape:bg-slate-800 my-2 mx-2 landscape:mx-0" />

						{/* Contact */}
						<MenuItem
							icon={<MessageCircle />}
							label={t.feedback}
							subtext={t.feedbackSub}
							onClick={handleFeedback}
							tourId="menu-feedback"
						/>

						{/* Settings (Landscape Only) */}
						<div className="hidden landscape:block">
							<MenuItem
								icon={<Settings />}
								label={settingsLanguage === "en" ? "Settings" : "सेटिंग्स"}
								onClick={onOpenSettings}
								tourId="menu-settings"
							/>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="p-4 text-center text-xs text-ry-gold/50 landscape:text-ink-400 font-medium pb-[calc(1rem+env(safe-area-inset-bottom))] landscape:py-2 border-t border-ry-gold/20 landscape:border-ink-200 dark:landscape:border-ink-800 bg-cream-50 dark:bg-ink-900 shrink-0">
					{appVersion}
				</div>
			</div>

			{/* Help / How to Use Modal */}
			{showHelpModal && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-ry-cream dark:bg-slate-800 w-full max-w-xs rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 relative border border-ry-gold/20">
						<button
							onClick={() => handleClose_help_sidemenu()}
							className="absolute top-4 right-4 p-1 text-slate-400 dark:text-ink-400 hover:text-ry-gold transition-colors"
						>
							<X size={20} />
						</button>
						<h3 className="text-xl font-bold text-ry-gold mb-6 text-center">
							{t.howToUse}
						</h3>

						<div className="space-y-4">
							{/* Guided tour: resets every chapter and starts again on Home.
							    The tour closes this popup and the menu itself. */}
							<button
								onClick={() => {
									handleClose_help_sidemenu();
									requestTourReplay();
								}}
								className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-700/50 rounded-xl border border-ry-gold/20 hover:border-ry-gold/60 transition-all group active:scale-95 shadow-sm"
							>
								<div className="w-12 h-12 rounded-full bg-ry-gold/10 flex items-center justify-center text-ry-gold group-hover:scale-110 transition-transform">
									<Compass size={24} />
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
									handleClose_help_sidemenu();
									if (onOpenOnboarding) {
										onOpenOnboarding();
										onClose();
									}
								}}
								className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-700/50 rounded-xl border border-ry-gold/20 hover:border-ry-gold/60 transition-all group active:scale-95 shadow-sm"
							>
								<div className="w-12 h-12 rounded-full bg-ry-gold/10 flex items-center justify-center text-ry-gold group-hover:scale-110 transition-transform">
									<Smartphone size={24} />
								</div>
								<div className="text-left">
									<h4 className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-ry-gold transition-colors">
										{t.introSlides}
									</h4>
									<p className="text-xs text-slate-500 dark:text-slate-400">
										{t.introSlidesDesc}
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
				</div>
			)}

			{/* Feedback Modal */}
			<FeedbackModal
				isOpen={showFeedbackModal}
				onClose={() => setShowFeedbackModal(false)}
				settingsLanguage={settingsLanguage}
			/>
		</>
	);
};

// Updated Menu Item with Golden Hover States and Landscape Styles
const MenuItem: React.FC<{
	icon: React.ReactNode;
	label: string;
	subtext?: string;
	onClick?: () => void;
	badge?: boolean;
	/** `data-tour` hook for the guided tour; no visual effect. */
	tourId?: string;
}> = ({ icon, label, subtext, onClick, badge, tourId }) => (
	<button
		onClick={onClick}
		data-tour={tourId}
		className="w-full flex items-center gap-4 landscape:gap-3 p-3 landscape:p-2.5 landscape:px-4 rounded-xl landscape:rounded-none hover:bg-krishna-50 landscape:hover:bg-krishna-50 dark:hover:bg-slate-800 text-ink-900 dark:text-cream-50 transition-all text-left group border border-transparent hover:border-krishna-200 landscape:hover:border-transparent hover:shadow-[0_2px_8px_rgba(11,46,107,0.05)] landscape:hover:shadow-none"
	>
		<div className="w-10 h-10 landscape:w-auto landscape:h-auto rounded-full bg-krishna-50 landscape:bg-transparent dark:bg-slate-800 dark:landscape:bg-transparent flex items-center justify-center text-krishna-600 landscape:text-krishna-600 dark:text-gold-300 group-hover:text-krishna-700 landscape:group-hover:text-krishna-700 dark:group-hover:text-gold-400 group-hover:bg-krishna-100 landscape:group-hover:bg-transparent dark:group-hover:bg-slate-700 transition-all group-hover:scale-110 landscape:group-hover:scale-100 shrink-0 relative">
			{React.cloneElement(icon as any, {
				className: `${(icon as any).props.className || ""} w-5 h-5 landscape:w-4 landscape:h-4`,
			})}
			{badge && (
				<div className="absolute -top-1 -right-1 flex items-center justify-center">
					{/* Radar Ring 1 */}
					<span className="absolute w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75"></span>
					{/* Radar Ring 2 (Slower) */}
					<span
						className="absolute w-6 h-6 bg-ry-gold rounded-full animate-ping opacity-50"
						style={{ animationDuration: "2s" }}
					></span>
					{/* Sparkle Icon */}
					<Sparkles
						size={16}
						className="relative z-10 text-red-500 fill-ry-gold animate-pulse drop-shadow-md"
					/>
				</div>
			)}
		</div>
		<div className="min-w-0">
			<div className="font-bold landscape:font-medium text-ink-900 landscape:text-ink-900 landscape:text-[13px] dark:text-cream-50 group-hover:text-krishna-700 landscape:group-hover:text-krishna-700 dark:group-hover:text-gold-400 transition-colors truncate">
				{label}
			</div>
			{subtext && (
				<div className="text-xs text-ink-500 dark:text-ink-400 font-medium truncate group-hover:text-krishna-600 dark:group-hover:text-gold-300/70">
					{subtext}
				</div>
			)}
		</div>
	</button>
);

import {
	Bell,
	BookOpen,
	Calendar,
	Camera,
	Check,
	ChevronRight,
	Clock,
	HeartHandshake,
	Home,
	Info,
	Languages,
	Library,
	ListMusic,
	Mic2,
	Monitor,
	Moon,
	Music,
	Palette,
	Smartphone,
	Sparkles,
	Star,
	Sun,
	Type,
	UserCircle,
	Users,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import type { ThemeColor } from "../types";
import { THEME_PALETTES } from "../utils/theme";

interface OnboardingScreenProps {
	onComplete: () => void;
}

const TOTAL_STEPS = 8;

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
	onComplete,
}) => {
	const [step, setStep] = useState(1);
	const {
		themeColor,
		setThemeColor,
		uiScale,
		setUiScale,
		darkMode,
		handleThemeChange,
		themeMode,
		setThemeMode,
		settingsLanguage,
		setSettingsLanguage,
	} = useSettings();
	const { user } = useAuth();

	// Translations for the Onboarding
	const t = {
		skip: settingsLanguage === "hi" ? "छोड़ें" : "Skip",
		next: settingsLanguage === "hi" ? "अगला" : "Next",
		back: settingsLanguage === "hi" ? "पीछे" : "Back",
		finish: settingsLanguage === "hi" ? "शुरू करें" : "Get Started",

		// STEP 1: LANGUAGE
		step1Title: settingsLanguage === "hi" ? "भाषा चुनें" : "Select Language",
		step1Desc:
			settingsLanguage === "hi"
				? "आप ऐप को किस भाषा में देखना पसंद करेंगे?"
				: "Which language do you prefer for the interface?",

		// STEP 2: APPEARANCE
		step2Title: settingsLanguage === "hi" ? "दिखावट चुनें" : "Appearance",
		step2Desc:
			settingsLanguage === "hi"
				? "अपने पढ़ने के अनुभव को अनुकूलित करें।"
				: "Customize your reading experience.",
		uiSize: settingsLanguage === "hi" ? "अक्षर का आकार" : "UI & Text Size",
		themeColor: settingsLanguage === "hi" ? "रंग थीम" : "Theme Color",

		// STEP 3: HOME SCREEN
		step3Title: settingsLanguage === "hi" ? "होम स्क्रीन" : "Home Screen",
		step3Desc:
			settingsLanguage === "hi"
				? "दैनिक दर्शन, पंचांग, सूचनाएं और अन्य गतिविधियां।"
				: "Daily Darshan, Calendar, Info and Activities.",

		// STEP 4: SONGS SCREEN
		step4Title: settingsLanguage === "hi" ? "भजन स्क्रीन" : "Songs Screen",
		step4Desc:
			settingsLanguage === "hi"
				? "भजन पढ़ने के लिए विशेष सुविधाएँ।"
				: "Powerful features for reading Bhajans.",

		// STEP 5: AUDIO & KIRTAN
		step5Title: settingsLanguage === "hi" ? "ऑडियो और कीर्तन" : "Audio & Kirtan",
		step5Desc:
			settingsLanguage === "hi"
				? "आनंदमयी कीर्तन और कथा सुनें।"
				: "Listen to blissful Kirtans and Katha.",

		// STEP 6: HISTORY SCREEN
		step6Title: settingsLanguage === "hi" ? "इतिहास स्क्रीन" : "History Screen",
		step6Desc:
			settingsLanguage === "hi"
				? "अपनी पसंदीदा सूचियाँ बनाएं।"
				: "Create playlists and organize favorites.",

		// STEP 7: STAY CONNECTED
		step7Title: settingsLanguage === "hi" ? "जुड़े रहें" : "Stay Connected",
		step7Desc:
			settingsLanguage === "hi"
				? "सेवा केंद्र, दान और हमारे बारे में जानें।"
				: "Seva Centers, Donate and About Us.",

		// STEP 8: PROFILE
		step8Title: settingsLanguage === "hi" ? "भक्त प्रोफाइल" : "Devotee Profile",
		step8Desc:
			settingsLanguage === "hi"
				? "लाइक कर के समुदाय से जुड़ें।"
				: "Engage with community through likes.",
	};

	const handleNext = () => {
		if (step < TOTAL_STEPS) setStep((s) => s + 1);
		else onComplete();
	};

	const handleBack = () => {
		if (step > 1) setStep((s) => s - 1);
	};

	const themeColors = (Object.keys(THEME_PALETTES) as ThemeColor[]).filter(
		(c) => !["saffron", "red", "amber"].includes(c),
	);

	return (
		<div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-500 isolate overflow-hidden">
			{/* Decorative Background Orbs */}
			<div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-saffron-300/20 dark:bg-saffron-600/10 rounded-full blur-[100px] pointer-events-none" />
			<div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-300/20 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

			{/* Top Bar */}
			<div className="flex-none flex justify-center items-center p-3 landscape:p-4 landscape:py-2 pt-[calc(1rem+env(safe-area-inset-top))] landscape:pt-[calc(0.5rem+env(safe-area-inset-top))] bg-transparent z-10 relative">
				<div className="flex gap-2">
					{Array.from({ length: TOTAL_STEPS }).map((_, i) => (
						<div
							key={i}
							className={`h-2 rounded-full transition-all duration-500 ${i + 1 === step ? "w-10 bg-saffron-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]" : "w-2 bg-slate-200 dark:bg-slate-800"}`}
						/>
					))}
				</div>
			</div>

			{/* Content Area */}
			<div className="flex-1 overflow-y-auto px-6 landscape:px-8 pb-8 scroll-container relative z-0 flex flex-col">
				<div className="w-full max-w-md landscape:max-w-5xl mx-auto my-auto pt-1 md:pt-6 landscape:pt-0">
					{/* STEP 1: LANGUAGE */}
					{step === 1 && (
						<div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-8 landscape:gap-16 items-center animate-in slide-in-from-right duration-300">
							<div className="text-center landscape:text-left space-y-2">
								<div className="relative w-20 h-20 mx-auto landscape:mx-0 mb-3 group">
									<div className="absolute inset-0 bg-blue-400/20 dark:bg-blue-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
									<div className="relative w-full h-full bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-blue-900/30 rounded-3xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xl border border-white/60 dark:border-slate-700/50 rotate-[-5deg] group-hover:rotate-0 transition-all duration-500">
										<Languages size={36} className="drop-shadow-sm" />
									</div>
								</div>
								<h2 className="text-2xl font-bold text-slate-800 dark:text-white font-hindi leading-tight">
									{t.step1Title}
								</h2>
								<p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
									{t.step1Desc}
								</p>
							</div>

							<div className="grid grid-cols-1 gap-4 w-full">
								<button
									onClick={() => setSettingsLanguage("hi")}
									className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all group ${
										settingsLanguage === "hi"
											? "border-saffron-500 bg-saffron-50 dark:bg-slate-800 dark:border-saffron-500 shadow-md ring-1 ring-saffron-500 dark:ring-saffron-400"
											: "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-saffron-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
									}`}
								>
									<div className="text-left">
										<span className="text-lg font-bold block text-slate-800 dark:text-white group-hover:text-saffron-600 dark:group-hover:text-saffron-400 transition-colors">
											हिन्दी
										</span>
										<span className="text-sm text-slate-500 dark:text-slate-400">
											Hindi
										</span>
									</div>
									{settingsLanguage === "hi" && (
										<div className="bg-saffron-500 text-white p-1 rounded-full animate-pop">
											<Check size={20} />
										</div>
									)}
								</button>

								<button
									onClick={() => setSettingsLanguage("en")}
									className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all group ${
										settingsLanguage === "en"
											? "border-saffron-500 bg-saffron-50 dark:bg-slate-800 dark:border-saffron-500 shadow-md ring-1 ring-saffron-500 dark:ring-saffron-400"
											: "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-saffron-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
									}`}
								>
									<div className="text-left">
										<span className="text-lg font-bold block text-slate-800 dark:text-white group-hover:text-saffron-600 dark:group-hover:text-saffron-400 transition-colors">
											English
										</span>
										<span className="text-sm text-slate-500 dark:text-slate-400">
											English
										</span>
									</div>
									{settingsLanguage === "en" && (
										<div className="bg-saffron-500 text-white p-1 rounded-full animate-pop">
											<Check size={20} />
										</div>
									)}
								</button>
							</div>
						</div>
					)}

					{/* STEP 2: APPEARANCE */}
					{step === 2 && (
						<div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-8 landscape:gap-16 items-center animate-in slide-in-from-right duration-300">
							<div className="text-center landscape:text-left space-y-2">
								<div className="relative w-20 h-20 mx-auto landscape:mx-0 mb-3 group">
									<div className="absolute inset-0 bg-saffron-400/20 dark:bg-saffron-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
									<div className="relative w-full h-full bg-gradient-to-br from-white to-saffron-50 dark:from-slate-800 dark:to-saffron-900/30 rounded-3xl flex items-center justify-center text-saffron-600 dark:text-saffron-400 shadow-xl border border-white/60 dark:border-slate-700/50 rotate-[5deg] group-hover:rotate-0 transition-all duration-500">
										<Palette size={36} className="drop-shadow-sm" />
									</div>
								</div>
								<h2 className="text-2xl font-bold text-slate-800 dark:text-white font-hindi leading-tight">
									{t.step2Title}
								</h2>
								<p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
									{t.step2Desc}
								</p>
							</div>

							<div className="space-y-4 w-full">
								{/* UI Scale */}
								<div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
									<div className="flex justify-between mb-2">
										<span className="text-xs font-bold uppercase text-slate-400 dark:text-ink-400">
											{t.uiSize}
										</span>
										<span className="text-xs font-bold text-saffron-600 dark:text-saffron-400">
											{Math.round(uiScale * 100)}%
										</span>
									</div>
									<div className="flex items-center gap-3">
										<Type
											size={16}
											className="text-slate-400 dark:text-ink-400"
										/>
										<input
											type="range"
											min="0.85"
											max="1.15"
											step="0.05"
											value={uiScale}
											onChange={(e) => setUiScale(parseFloat(e.target.value))}
											className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-saffron-500"
										/>
										<Type
											size={24}
											className="text-slate-800 dark:text-white"
										/>
									</div>
								</div>

								{/* Mode */}
								<div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
									{["auto", "light", "dark"].map((m) => (
										<button
											key={m}
											onClick={() => {
												if (m === "auto") setThemeMode("auto");
												else handleThemeChange(m === "dark");
											}}
											className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
												(m === "auto" && themeMode === "auto") ||
												(m === "light" && themeMode === "light") ||
												(m === "dark" && themeMode === "dark")
													? "bg-white dark:bg-slate-800 text-saffron-600 shadow-sm"
													: "text-slate-500 dark:text-ink-300 hover:text-slate-700 dark:hover:text-slate-300"
											}`}
										>
											{m === "auto" ? (
												<Monitor size={14} />
											) : m === "light" ? (
												<Sun size={14} />
											) : (
												<Moon size={14} />
											)}
											{m.toUpperCase()}
										</button>
									))}
								</div>

								{/* Color Grid */}
								<div>
									<span className="text-xs font-bold uppercase text-slate-400 dark:text-ink-400 mb-2 block">
										{t.themeColor}
									</span>
									<div className="flex flex-wrap gap-3 justify-center sm:justify-start">
										{themeColors.map((c) => (
											<button
												key={c}
												onClick={() => setThemeColor(c)}
												className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${themeColor === c ? "scale-110 ring-2 ring-offset-2 ring-slate-300 dark:ring-slate-600" : "hover:scale-105"}`}
												style={{ backgroundColor: THEME_PALETTES[c]["500"] }}
											>
												{themeColor === c && (
													<Check
														size={16}
														className="text-white drop-shadow-md"
													/>
												)}
											</button>
										))}
									</div>
								</div>
							</div>
						</div>
					)}

					{/* STEP 3: HOME SCREEN */}
					{step === 3 && (
						<div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-8 landscape:gap-16 items-center animate-in slide-in-from-right duration-300">
							<div className="text-center landscape:text-left space-y-2">
								<div className="relative w-20 h-20 mx-auto landscape:mx-0 mb-3 group">
									<div className="absolute inset-0 bg-yellow-400/20 dark:bg-yellow-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
									<div className="relative w-full h-full bg-gradient-to-br from-white to-yellow-50 dark:from-slate-800 dark:to-yellow-900/30 rounded-3xl flex items-center justify-center text-yellow-600 dark:text-yellow-400 shadow-xl border border-white/60 dark:border-slate-700/50 rotate-[-5deg] group-hover:rotate-0 transition-all duration-500">
										<Home size={36} className="drop-shadow-sm" />
									</div>
								</div>
								<h2 className="text-2xl font-bold text-slate-800 dark:text-white font-hindi leading-tight">
									{t.step3Title}
								</h2>
								<p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
									{t.step3Desc}
								</p>
							</div>

							<div className="space-y-3 w-full">
								<FeatureItem
									icon={<Camera size={18} />}
									title="Daily Darshan"
									desc="Latest photos from temples & centers."
								/>
								<FeatureItem
									icon={<Calendar size={18} />}
									title="Vaishnav Calendar"
									desc="Ekadashi & Festival reminders."
								/>
								<FeatureItem
									icon={<Bell size={18} />}
									title="Daily Information"
									desc="Updates, news & announcements."
								/>
								<FeatureItem
									icon={<Sparkles size={18} />}
									title="Daily Quotes"
									desc="Divine quotes every morning."
								/>
							</div>
						</div>
					)}

					{/* STEP 4: SONGS SCREEN */}
					{step === 4 && (
						<div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-8 landscape:gap-16 items-center animate-in slide-in-from-right duration-300">
							<div className="text-center landscape:text-left space-y-2">
								<div className="relative w-20 h-20 mx-auto landscape:mx-0 mb-3 group">
									<div className="absolute inset-0 bg-green-400/20 dark:bg-green-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
									<div className="relative w-full h-full bg-gradient-to-br from-white to-green-50 dark:from-slate-800 dark:to-green-900/30 rounded-3xl flex items-center justify-center text-green-600 dark:text-green-400 shadow-xl border border-white/60 dark:border-slate-700/50 rotate-[5deg] group-hover:rotate-0 transition-all duration-500">
										<BookOpen size={36} className="drop-shadow-sm" />
									</div>
								</div>
								<h2 className="text-2xl font-bold text-slate-800 dark:text-white font-hindi leading-tight">
									{t.step4Title}
								</h2>
								<p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
									{t.step4Desc}
								</p>
							</div>

							<div className="space-y-3 w-full">
								<FeatureItem
									icon={<Smartphone size={18} />}
									title="Book Mode"
									desc="Pinch to zoom & pan like a real book."
								/>
								<FeatureItem
									icon={<Type size={18} />}
									title="Text Formatting"
									desc="Adjust size, spacing & alignment."
								/>
								<FeatureItem
									icon={<Star size={18} />}
									title="Favorites"
									desc="Save bhajans to playlists instantly."
								/>
								<FeatureItem
									icon={<Type size={18} />}
									title="Dual Script"
									desc="Switch between Hindi & English text."
								/>
							</div>
						</div>
					)}

					{/* STEP 5: AUDIO FEATURES */}
					{step === 5 && (
						<div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-8 landscape:gap-16 items-center animate-in slide-in-from-right duration-300">
							<div className="text-center landscape:text-left space-y-2">
								<div className="relative w-20 h-20 mx-auto landscape:mx-0 mb-3 group">
									<div className="absolute inset-0 bg-purple-400/20 dark:bg-purple-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
									<div className="relative w-full h-full bg-gradient-to-br from-white to-purple-50 dark:from-slate-800 dark:to-purple-900/30 rounded-3xl flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-xl border border-white/60 dark:border-slate-700/50 rotate-[-5deg] group-hover:rotate-0 transition-all duration-500">
										<Music size={36} className="drop-shadow-sm" />
									</div>
								</div>
								<h2 className="text-2xl font-bold text-slate-800 dark:text-white font-hindi leading-tight">
									{t.step5Title}
								</h2>
								<p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
									{t.step5Desc}
								</p>
							</div>

							<div className="space-y-3 w-full">
								<FeatureItem
									icon={<Music size={18} />}
									title="Background Play"
									desc="Audio continues when screen is off."
								/>
								<FeatureItem
									icon={<Mic2 size={18} />}
									title="Multiple Singers"
									desc="Choose different versions of songs."
								/>
								<FeatureItem
									icon={<ListMusic size={18} />}
									title="Katha & Kirtan"
									desc="Exclusive recordings of Gurudev."
								/>
							</div>
						</div>
					)}

					{/* STEP 6: LIBRARY SCREEN */}
					{step === 6 && (
						<div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-8 landscape:gap-16 items-center animate-in slide-in-from-right duration-300">
							<div className="text-center landscape:text-left space-y-2">
								<div className="relative w-20 h-20 mx-auto landscape:mx-0 mb-3 group">
									<div className="absolute inset-0 bg-pink-400/20 dark:bg-pink-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
									<div className="relative w-full h-full bg-gradient-to-br from-white to-pink-50 dark:from-slate-800 dark:to-pink-900/30 rounded-3xl flex items-center justify-center text-pink-600 dark:text-pink-400 shadow-xl border border-white/60 dark:border-slate-700/50 rotate-[5deg] group-hover:rotate-0 transition-all duration-500">
										<Library size={36} className="drop-shadow-sm" />
									</div>
								</div>
								<h2 className="text-2xl font-bold text-slate-800 dark:text-white font-hindi leading-tight">
									{t.step6Title}
								</h2>
								<p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
									{t.step6Desc}
								</p>
							</div>

							<div className="space-y-3 w-full">
								<FeatureItem
									icon={<ListMusic size={18} />}
									title="Playlists"
									desc="Create custom lists of Bhajans."
								/>
								<FeatureItem
									icon={<Mic2 size={18} />}
									title="Singers Tab"
									desc="Browse songs by specific singers."
								/>
								<FeatureItem
									icon={<Clock size={18} />}
									title="History"
									desc="Quickly access recently viewed items."
								/>
							</div>
						</div>
					)}

					{/* STEP 7: STAY CONNECTED */}
					{step === 7 && (
						<div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-8 landscape:gap-16 items-center animate-in slide-in-from-right duration-300">
							<div className="text-center landscape:text-left space-y-2">
								<div className="relative w-20 h-20 mx-auto landscape:mx-0 mb-3 group">
									<div className="absolute inset-0 bg-blue-400/20 dark:bg-blue-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
									<div className="relative w-full h-full bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-blue-900/30 rounded-3xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xl border border-white/60 dark:border-slate-700/50 rotate-[-5deg] group-hover:rotate-0 transition-all duration-500">
										<Users size={36} className="drop-shadow-sm" />
									</div>
								</div>
								<h2 className="text-2xl font-bold text-slate-800 dark:text-white font-hindi leading-tight">
									{t.step7Title}
								</h2>
								<p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
									{t.step7Desc}
								</p>
							</div>

							<div className="space-y-3 w-full">
								<FeatureItem
									icon={<Users size={18} />}
									title="Seva Centers"
									desc="Find and connect with local centers."
								/>
								<FeatureItem
									icon={<HeartHandshake size={18} />}
									title="Donate"
									desc="Support our activities and mission."
								/>
								<FeatureItem
									icon={<Info size={18} />}
									title="About Us"
									desc="Learn more about our organization."
								/>
							</div>
						</div>
					)}

					{/* STEP 8: PROFILE */}
					{step === 8 && (
						<div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-8 landscape:gap-16 items-center animate-in slide-in-from-right duration-300">
							<div className="text-center landscape:text-left space-y-2">
								<div className="relative w-20 h-20 mx-auto landscape:mx-0 mb-3 group">
									<div className="absolute inset-0 bg-emerald-400/20 dark:bg-emerald-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
									<div className="relative w-full h-full bg-gradient-to-br from-white to-emerald-50 dark:from-slate-800 dark:to-emerald-900/30 rounded-3xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xl border border-white/60 dark:border-slate-700/50 rotate-[5deg] group-hover:rotate-0 transition-all duration-500">
										<UserCircle size={36} className="drop-shadow-sm" />
									</div>
								</div>
								<h2 className="text-2xl font-bold text-slate-800 dark:text-white font-hindi leading-tight">
									{t.step8Title}
								</h2>
								<p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
									{t.step8Desc}
								</p>
							</div>

							<div className="space-y-3 w-full">
								<FeatureItem
									icon={<HeartHandshake size={18} />}
									title="Like Posts"
									desc="Interact with community posts."
								/>
								<FeatureItem
									icon={<UserCircle size={18} />}
									title="Create Profile"
									desc="Personalize your devotee profile."
								/>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Footer Navigation */}
			<div className="flex-none p-4 landscape:p-4 landscape:py-2 pb-[calc(1rem+env(safe-area-inset-bottom))] landscape:pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col gap-4 z-10 relative">
				<div className="flex gap-4 w-full">
					{step > 1 && (
						<button
							onClick={handleBack}
							className="px-6 py-4 landscape:py-3 rounded-2xl font-bold text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
						>
							{t.back}
						</button>
					)}
					<button
						onClick={handleNext}
						className="flex-1 py-4 landscape:py-3 bg-gradient-to-r from-saffron-500 to-saffron-600 hover:from-saffron-600 hover:to-saffron-700 text-white rounded-2xl font-bold shadow-[0_8px_16px_-6px_rgba(249,115,22,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
					>
						{step === TOTAL_STEPS ? t.finish : t.next}
						{step !== TOTAL_STEPS && <ChevronRight size={20} />}
					</button>
				</div>

				{step !== TOTAL_STEPS && (
					<button
						onClick={onComplete}
						className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 py-1 transition-colors mx-auto"
					>
						{t.skip}
					</button>
				)}
			</div>
		</div>
	);
};

const FeatureItem = ({
	icon,
	title,
	desc,
}: {
	icon: React.ReactNode;
	title: string;
	desc: string;
}) => (
	<div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 group">
		<div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-950 flex flex-shrink-0 items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-saffron-500 dark:group-hover:text-saffron-400 group-hover:scale-110 shadow-inner border border-slate-100/50 dark:border-slate-800/50 transition-all duration-500 group-hover:rotate-[-5deg]">
			{icon}
		</div>
		<div>
			<h4 className="font-bold text-slate-800 dark:text-white text-sm leading-tight transition-colors">
				{title}
			</h4>
			<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
				{desc}
			</p>
		</div>
	</div>
);

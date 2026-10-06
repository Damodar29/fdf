import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
	ArrowDown,
	ArrowUp,
	ChevronDown,
	ExternalLink,
	Eye,
	EyeOff,
	Megaphone,
	Mic,
	Music,
	Palette,
	Plus,
	Save,
	Smartphone,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { useAdminBack } from "../src/hooks/useAdminBack";
import { db } from "../services/firebase";
import type { BannerConfig } from "../types";
import { THEME_PALETTES } from "../utils/theme";
import { validateAndFormatUrl } from "../utils/url";

export const BannerAdmin: React.FC<{ settingsLanguage?: "en" | "hi" }> = ({
	settingsLanguage = "hi",
}) => {
	const { showToast } = useToast();
	const isHindi = settingsLanguage === "hi";
	const t = {
		loading: isHindi ? "बैनर लोड हो रहे हैं..." : "Loading banner config...",
		bannersTitle: isHindi ? "बैनर" : "Banners",
		activeTitle: isHindi ? "सक्रिय" : "active",
		addBanner: isHindi ? "बैनर जोड़ें" : "Add Banner",
		noBanners: isHindi
			? "अभी तक कोई बैनर नहीं है। आरंभ करने के लिए एक बनाएं!"
			: "No banners yet. Create one to get started!",
		done: isHindi ? "हो गया" : "Done",
		edit: isHindi ? "संपादित करें" : "Edit",
		bodyText: isHindi ? "मुख्य पाठ" : "Body Text",
		actionType: isHindi ? "कार्रवाई का प्रकार" : "Action Type",
		link: isHindi ? "लिंक" : "Link",
		screen: isHindi ? "स्क्रीन" : "Screen",
		buttonLabel: isHindi ? "बटन लेबल" : "Button Label",
		websiteUrl: isHindi ? "वेबसाइट यूआरएल" : "Website URL",
		targetScreen: isHindi ? "लक्षित स्क्रीन" : "Target Screen",
		selectScreen: isHindi ? "स्क्रीन चुनें..." : "Select Screen...",
		unknownScreen: isHindi ? "अज्ञात स्क्रीन" : "Unknown Screen",
		saving: isHindi ? "सहेजा जा रहा है..." : "Saving...",
		saveAll: isHindi ? "सभी बैनर सहेजें" : "Save All Banners",
		bhajanId: isHindi ? "भजन आईडी" : "Bhajan ID",
		lectureId: isHindi ? "कथा आईडी" : "Lecture ID",
		bhajan: isHindi ? "भजन" : "Bhajan",
		lecture: isHindi ? "कथा" : "Lecture",
	};
	const [banners, setBanners] = useState<BannerConfig[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editingIdx, setEditingIdx] = useState<number | null>(null);
	const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
	// Back closes an open dropdown, then the open banner editor (like "Done"),
	// instead of leaving the Banners screen.
	useAdminBack(editingIdx !== null, () => setEditingIdx(null));
	useAdminBack(openDropdownIdx !== null, () => setOpenDropdownIdx(null));

	// Banner colors ke liye available colors list
	const BANNER_COLORS = [
		{ key: "saffron", label: "Saffron", bg: THEME_PALETTES.saffron[600] },
		{ key: "red", label: "Red", bg: THEME_PALETTES.red[600] },
		{ key: "rose", label: "Rose", bg: THEME_PALETTES.rose[600] },
		{ key: "pink", label: "Pink", bg: THEME_PALETTES.pink[600] },
		{ key: "fuchsia", label: "Fuchsia", bg: THEME_PALETTES.fuchsia[600] },
		{ key: "purple", label: "Purple", bg: THEME_PALETTES.purple[600] },
		{ key: "violet", label: "Violet", bg: THEME_PALETTES.violet[600] },
		{ key: "indigo", label: "Indigo", bg: THEME_PALETTES.indigo[600] },
		{ key: "deepBlue", label: "Deep Blue", bg: THEME_PALETTES.deepBlue[600] },
		{ key: "blue", label: "Blue", bg: THEME_PALETTES.blue[600] },
		{ key: "sky", label: "Sky", bg: THEME_PALETTES.sky[600] },
		{ key: "cyan", label: "Cyan", bg: THEME_PALETTES.cyan[600] },
		{ key: "teal", label: "Teal", bg: THEME_PALETTES.teal[600] },
		{ key: "emerald", label: "Emerald", bg: THEME_PALETTES.emerald[600] },
		{ key: "lime", label: "Lime", bg: THEME_PALETTES.lime[600] },
		{ key: "amber", label: "Amber", bg: THEME_PALETTES.amber[600] },
	];

	// Automatically agle banner ke liye alag color suggest karo
	const getNextColor = (): string => {
		if (banners.length === 0) return BANNER_COLORS[0].key;
		const usedColors = banners.map((b) => b.color || "blue");
		// Pehle ek aisa color dhundho jo bilkul use nahi hua
		const unused = BANNER_COLORS.find((c) => !usedColors.includes(c.key));
		if (unused) return unused.key;
		// Agar sab use ho gaye, to cycle karo (last used color ke baad wala)
		const lastColor = usedColors[usedColors.length - 1];
		const lastIdx = BANNER_COLORS.findIndex((c) => c.key === lastColor);
		return BANNER_COLORS[(lastIdx + 1) % BANNER_COLORS.length].key;
	};

	const SCREEN_OPTIONS = [
		{ value: "darshan", label: isHindi ? "दैनिक दर्शन" : "Daily Darshan" },
		{
			value: "activities",
			label: isHindi ? "आध्यात्मिक गतिविधियाँ" : "Spiritual Activities",
		},
		{
			value: "information",
			label: isHindi ? "दैनिक जानकारी" : "Daily Information",
		},
		{ value: "quotes", label: isHindi ? "दैनिक विचार" : "Daily Quotes" },
		{
			value: "events",
			label: isHindi ? "कैलेंडर / कार्यक्रम" : "Events / Calendar",
		},
		{ value: "books", label: isHindi ? "पुस्तकों की सूची" : "Book List" },
		{ value: "songs", label: isHindi ? "भजन सूची" : "Bhajan List" },
		{ value: "lectures", label: isHindi ? "ऑडियो स्क्रीन" : "Audio Screen" },
		{
			value: "library",
			label: isHindi ? "इतिहास और लेखक" : "Authors and History",
		},
		{ value: "seva", label: isHindi ? "सेवा केंद्र" : "Seva Center" },
		{
			value: "temple-timings",
			label: isHindi ? "मंदिर का समय" : "Temple Timings",
		},
		{ value: "youtube", label: isHindi ? "यूट्यूब" : "YouTube" },
		{ value: "guru-maharaj", label: isHindi ? "गुरु महाराज" : "Guru Maharaj" },
		{
			value: "virahi-maharaj",
			label: isHindi ? "विरही महाराज" : "Virahi Maharaj",
		},
		{ value: "donate", label: isHindi ? "दान करें" : "Donate" },
		{ value: "about", label: isHindi ? "हमारे बारे में" : "About Us" },
		{ value: "settings", label: isHindi ? "सेटिंग्स" : "Settings" },

		{ value: "videos", label: isHindi ? "वीडियो" : "Videos" },
		{ value: "profile", label: isHindi ? "प्रोफाइल" : "Profile Screen" },
		{ value: "photos", label: isHindi ? "तस्वीरें (गैलरी)" : "Photos / Gallery" },
	];

	useEffect(() => {
		const unsub = onSnapshot(
			doc(db, "app_config", "app_settings"),
			(docSnap) => {
				if (docSnap.exists()) {
					const data = docSnap.data();
					console.log("📚 BannerAdmin loaded all banners:", data.banners);
					if (data.banners && Array.isArray(data.banners)) {
						setBanners(data.banners);
					} else {
						setBanners([]);
					}
				} else {
					setBanners([]);
				}
				setLoading(false);
			},
			(error) => {
				console.error("Error fetching banners:", error);
				setLoading(false);
			},
		);
		return () => unsub();
	}, []);

	const saveBanners = async () => {
		setSaving(true);
		try {
			// Validate enabled banners have titles
			const enabledBanners = banners.filter((b) => b.enabled);
			for (const banner of enabledBanners) {
				if (!banner.title) {
					showToast("Please enter a title for all enabled banners.", "error");
					setSaving(false);
					return;
				}
				if (banner.actionType === "link" && banner.actionTarget) {
					const validUrl = validateAndFormatUrl(banner.actionTarget);
					if (validUrl === null) {
						showToast(
							`Invalid URL in banner "${banner.title}". Please check the URL.`,
							"error",
						);
						setSaving(false);
						return;
					}
					banner.actionTarget = validUrl;
				}
			}

			console.log("💾 Saving banners to Firestore:", banners);
			await setDoc(
				doc(db, "app_config", "app_settings"),
				{
					banners: banners.map((b) => ({
						id: b.id,
						enabled: b.enabled,
						title: b.title,
						body: b.body,
						actionType: b.actionType,
						actionTarget: b.actionTarget,
						actionLabel: b.actionLabel,
						color: b.color || "blue", // Banner ka custom color save karo
					})),
				},
				{ merge: true },
			);
			console.log("✅ Banners saved successfully!");
			showToast("Banners saved successfully!", "success");
			setEditingIdx(null);
		} catch (e: any) {
			console.error("❌ Error saving banners:", e);
			showToast(
				`Failed to save banners: ${e.message || "Unknown error"}`,
				"error",
			);
		}
		setSaving(false);
	};

	const addBanner = () => {
		const newBanner: BannerConfig = {
			id: `banner-${Date.now()}`,
			enabled: false,
			title: "",
			body: "",
			actionType: "link",
			actionTarget: "",
			actionLabel: "View Now",
			color: getNextColor(), // Automatically alag color assign karo
		};
		setBanners([...banners, newBanner]);
		setEditingIdx(banners.length);
	};

	const removeBanner = (idx: number) => {
		setBanners(banners.filter((_, i) => i !== idx));
		if (editingIdx === idx) setEditingIdx(null);
	};

	const moveBannerUp = (index: number) => {
		if (index === 0) return;
		const newBanners = [...banners];
		[newBanners[index - 1], newBanners[index]] = [
			newBanners[index],
			newBanners[index - 1],
		];
		setBanners(newBanners);
		if (editingIdx === index) setEditingIdx(index - 1);
		else if (editingIdx === index - 1) setEditingIdx(index);
	};

	const moveBannerDown = (index: number) => {
		if (index === banners.length - 1) return;
		const newBanners = [...banners];
		[newBanners[index + 1], newBanners[index]] = [
			newBanners[index],
			newBanners[index + 1],
		];
		setBanners(newBanners);
		if (editingIdx === index) setEditingIdx(index + 1);
		else if (editingIdx === index + 1) setEditingIdx(index);
	};

	const updateBanner = (idx: number, updates: Partial<BannerConfig>) => {
		const updated = [...banners];
		updated[idx] = { ...updated[idx], ...updates };
		setBanners(updated);
	};

	const toggleBannerEnabled = (idx: number) => {
		updateBanner(idx, { enabled: !banners[idx].enabled });
	};

	if (loading)
		return (
			<div className="p-8 text-center text-slate-500 dark:text-ink-300">
				{t.loading}
			</div>
		);

	return (
		<div className="h-full overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right pb-72 md:pb-48">
			<div className="flex items-center gap-2 justify-between">
				<div className="flex items-center gap-2">
					<Megaphone className="text-orange-500" size={20} />
					<h3 className="font-bold text-lg text-slate-800 dark:text-white">
						{t.bannersTitle} ({banners.filter((b) => b.enabled).length}{" "}
						{t.activeTitle})
					</h3>
				</div>
				<button
					onClick={addBanner}
					className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg font-bold text-sm flex items-center gap-1 transition-colors"
				>
					<Plus size={16} /> {t.addBanner}
				</button>
			</div>

			<div className="space-y-3">
				{banners.length === 0 ? (
					<div className="text-center p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-ink-300">
						{t.noBanners}
					</div>
				) : (
					banners.map((banner, idx) => (
						<div
							key={banner.id}
							className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
						>
							<div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
								<div className="flex items-center gap-2 w-full sm:w-auto">
									{/* Color dot indicator */}
									<div
										className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm border border-white/30"
										style={{
											backgroundColor:
												THEME_PALETTES[banner.color || "blue"]?.[600] ||
												"#2563eb",
										}}
										title={
											BANNER_COLORS.find(
												(c) => c.key === (banner.color || "blue"),
											)?.label || "Blue"
										}
									/>
									<button
										onClick={() => toggleBannerEnabled(idx)}
										className="transition-colors hover:text-orange-500 shrink-0"
									>
										{banner.enabled ? (
											<Eye size={18} className="text-orange-500" />
										) : (
											<EyeOff
												size={18}
												className="text-slate-400 dark:text-ink-400"
											/>
										)}
									</button>

									<input
										className="font-bold text-slate-800 dark:text-white bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-orange-500 outline-none px-2 w-full sm:w-64"
										value={banner.title}
										onChange={(e) =>
											updateBanner(idx, { title: e.target.value })
										}
										placeholder="Banner Title"
									/>
								</div>
								<div className="flex gap-1 sm:gap-2 self-end sm:self-auto">
									<div className="flex bg-slate-100 dark:bg-slate-700/50 rounded-lg p-0.5">
										<button
											onClick={() => moveBannerUp(idx)}
											disabled={idx === 0}
											className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
										>
											<ArrowUp size={16} />
										</button>
										<button
											onClick={() => moveBannerDown(idx)}
											disabled={idx === banners.length - 1}
											className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
										>
											<ArrowDown size={16} />
										</button>
									</div>
									<button
										onClick={() =>
											setEditingIdx(editingIdx === idx ? null : idx)
										}
										className="text-blue-600 hover:text-blue-700 font-bold text-sm px-2 py-1 rounded transition-colors hover:bg-blue-50 dark:hover:bg-slate-700"
									>
										{editingIdx === idx ? t.done : t.edit}
									</button>
									<button
										onClick={() => removeBanner(idx)}
										className="text-red-600 hover:text-red-700 transition-colors hover:bg-red-50 dark:hover:bg-slate-700 p-1 rounded"
									>
										<Trash2 size={18} />
									</button>
								</div>
							</div>

							{editingIdx === idx && (
								<div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
									<div>
										<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
											{t.bodyText}
										</label>
										<textarea
											className="w-full p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 h-20 text-sm"
											value={banner.body}
											onChange={(e) =>
												updateBanner(idx, { body: e.target.value })
											}
											placeholder="Banner message body"
										/>
									</div>

									{/* Color Picker */}
									<div>
										<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-2 flex items-center gap-1">
											<Palette size={12} />{" "}
											{isHindi ? "बैनर रंग" : "Banner Color"}
										</label>
										<div className="flex flex-wrap gap-2">
											{BANNER_COLORS.map((colorOpt) => {
												const isSelected =
													(banner.color || "blue") === colorOpt.key;
												return (
													<button
														key={colorOpt.key}
														title={colorOpt.label}
														onClick={() =>
															updateBanner(idx, { color: colorOpt.key })
														}
														className={`relative w-7 h-7 rounded-full transition-all duration-150 ${
															isSelected
																? "ring-2 ring-offset-2 ring-slate-500 scale-110"
																: "hover:scale-110 opacity-80 hover:opacity-100"
														}`}
														style={{ backgroundColor: colorOpt.bg }}
													>
														{isSelected && (
															<span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
																✓
															</span>
														)}
													</button>
												);
											})}
										</div>
										{/* Preview strip */}
										<div
											className="mt-2 h-6 rounded-lg w-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
											style={{
												backgroundColor:
													THEME_PALETTES[banner.color || "blue"]?.[600] ||
													"#2563eb",
											}}
										>
											{BANNER_COLORS.find(
												(c) => c.key === (banner.color || "blue"),
											)?.label || "Blue"}{" "}
											Preview
										</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div>
											<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
												{t.actionType}
											</label>
											<div className="flex bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
												<button
													onClick={() => {
														if (banner.actionType !== "link") {
															updateBanner(idx, {
																actionType: "link",
																actionTarget: "",
															});
														}
													}}
													className={`flex-1 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
														banner.actionType === "link"
															? "bg-blue-100 dark:bg-blue-900 text-blue-600"
															: "text-slate-500 dark:text-ink-300"
													}`}
												>
													<ExternalLink size={12} /> {t.link}
												</button>
												<button
													onClick={() => {
														if (banner.actionType !== "screen") {
															updateBanner(idx, {
																actionType: "screen",
																actionTarget: "",
															});
														}
													}}
													className={`flex-1 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
														banner.actionType === "screen"
															? "bg-blue-100 dark:bg-blue-900 text-blue-600"
															: "text-slate-500 dark:text-ink-300"
													}`}
												>
													<Smartphone size={12} /> {t.screen}
												</button>
												<button
													onClick={() => {
														if (banner.actionType !== "bhajan") {
															updateBanner(idx, {
																actionType: "bhajan",
																actionTarget: "",
															});
														}
													}}
													className={`flex-1 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
														banner.actionType === "bhajan"
															? "bg-blue-100 dark:bg-blue-900 text-blue-600"
															: "text-slate-500 dark:text-ink-300"
													}`}
												>
													<Music size={12} /> {t.bhajan}
												</button>
												<button
													onClick={() => {
														if (banner.actionType !== "lecture") {
															updateBanner(idx, {
																actionType: "lecture",
																actionTarget: "",
															});
														}
													}}
													className={`flex-1 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
														banner.actionType === "lecture"
															? "bg-blue-100 dark:bg-blue-900 text-blue-600"
															: "text-slate-500 dark:text-ink-300"
													}`}
												>
													<Mic size={12} /> {t.lecture}
												</button>
											</div>
										</div>
										<div>
											<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
												{t.buttonLabel}
											</label>
											<input
												className="w-full p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-sm"
												value={banner.actionLabel || ""}
												onChange={(e) =>
													updateBanner(idx, { actionLabel: e.target.value })
												}
												placeholder="e.g. View Now"
											/>
										</div>
									</div>

									<div>
										<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
											{banner.actionType === "link"
												? t.websiteUrl
												: banner.actionType === "bhajan"
													? t.bhajanId
													: banner.actionType === "lecture"
														? t.lectureId
														: t.targetScreen}
										</label>
										{banner.actionType === "link" ||
										banner.actionType === "bhajan" ||
										banner.actionType === "lecture" ? (
											<input
												className="w-full p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono text-sm"
												value={banner.actionTarget || ""}
												onChange={(e) =>
													updateBanner(idx, { actionTarget: e.target.value })
												}
												placeholder={
													banner.actionType === "link"
														? "https://..."
														: banner.actionType === "bhajan"
															? "e.g. 001"
															: "e.g. 001"
												}
											/>
										) : (
											<div className="relative">
												<button
													onClick={() =>
														setOpenDropdownIdx(
															openDropdownIdx === idx ? null : idx,
														)
													}
													className="w-full p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-sm flex justify-between items-center"
												>
													<span
														className={`${banner.actionTarget ? "text-slate-800 dark:text-white" : "text-slate-400"}`}
													>
														{banner.actionTarget
															? SCREEN_OPTIONS.find(
																	(opt) => opt.value === banner.actionTarget,
																)?.label || t.unknownScreen
															: t.selectScreen}
													</span>
													<ChevronDown
														size={16}
														className="text-slate-400 dark:text-ink-400"
													/>
												</button>

												{openDropdownIdx === idx && (
													<div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
														<button
															onClick={() => {
																updateBanner(idx, { actionTarget: "" });
																setOpenDropdownIdx(null);
															}}
															className="w-full text-left px-3 py-2 text-sm text-slate-500 dark:text-ink-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700/50"
														>
															{t.selectScreen}
														</button>
														{SCREEN_OPTIONS.map((opt) => (
															<button
																key={opt.value}
																onClick={() => {
																	updateBanner(idx, {
																		actionTarget: opt.value,
																	});
																	setOpenDropdownIdx(null);
																}}
																className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${banner.actionTarget === opt.value ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20 font-bold" : "text-slate-700 dark:text-slate-300"}`}
															>
																{opt.label}
															</button>
														))}
													</div>
												)}
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					))
				)}
			</div>

			<button
				onClick={saveBanners}
				disabled={saving}
				className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-4"
			>
				<Save size={18} /> {saving ? t.saving : t.saveAll}
			</button>
		</div>
	);
};

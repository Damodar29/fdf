import {
	Check,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Edit2,
	Filter,
	Loader2,
	Music,
	Plus,
	Save,
	Search,
	Tag,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useAdminBack } from "../../src/hooks/useAdminBack";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import {
	type FilterCategoryDef,
	fetchCategoriesFromFirebase,
	saveCategoriesConfig,
} from "../../src/utils/githubAppConfigStorage";
import {
	BhajanSaveError,
	saveBhajanPatchesToFirebase,
} from "../../src/utils/githubBhajanStorage";
import type { Bhajan } from "../../types";
import {
	calculateSearchScore,
	getListFirstLine,
} from "../../utils/textProcessor";

// Default categories — seeded if no GitHub data exists
const DEFAULT_CATEGORIES: FilterCategoryDef[] = [
	{
		id: "badhai",
		labelHi: "बधाई / जन्मोत्सव",
		labelEn: "Badhai / Janmotsav",
		keywords: ["बधाई", "जन्म", "प्रकटोत्सव"],
		order: 1,
	},
	{
		id: "holi",
		labelHi: "होली / फाग",
		labelEn: "Holi / Phag",
		keywords: ["होली", "फाग", "अबीर", "गुलाल"],
		order: 2,
	},
	{
		id: "jhula",
		labelHi: "झूलन / सावन",
		labelEn: "Jhulan / Sawan",
		keywords: ["झूलन", "सावन", "हिंडोला"],
		order: 3,
	},
	{
		id: "aarti",
		labelHi: "आरतियाँ",
		labelEn: "Aartis",
		keywords: ["आरती", "आरत"],
		order: 4,
	},
	{
		id: "ashtak",
		labelHi: "अष्टक और स्तोत्र",
		labelEn: "Ashtakas & Stotras",
		keywords: ["अष्टक", "स्तोत्र", "पद"],
		order: 5,
	},
];

/** Returns true if text contains at least one Devanagari character */
const hasDevanagari = (text: string): boolean => /[\u0900-\u097F]/.test(text);

/** Returns true if fetched category labels appear garbled (no Devanagari in labelHi) */
const isCategoryDataGarbled = (cats: FilterCategoryDef[]): boolean => {
	const sample = cats.slice(0, 5);
	return sample.length > 0 && sample.every((c) => !hasDevanagari(c.labelHi));
};

type SubView = null | { type: "manage_bhajans"; categoryId: string };

interface FilterCategoryManagerProps {
	bhajans: Bhajan[];
	onUpdateBhajans: (data: Bhajan[]) => void;
	showToast: (text: string, type?: "success" | "error") => void;
	settingsLanguage?: "en" | "hi";
}

export const FilterCategoryManager: React.FC<FilterCategoryManagerProps> = ({
	bhajans,
	onUpdateBhajans,
	showToast,
	settingsLanguage = "hi",
}) => {
	const isHindi = settingsLanguage === "hi";
	const [categories, setCategories] = useState<FilterCategoryDef[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [progressMsg, setProgressMsg] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isAddingNew, setIsAddingNew] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [subView, setSubView] = useState<SubView>(null);
	const [bhajanSearchQuery, setBhajanSearchQuery] = useState("");
	const [wasRepaired, setWasRepaired] = useState(false);

	// ── BACK BUTTON SUPPORT FOR POPUPS ──
	const closeSubView = usePopupBackHandler(
		!!subView,
		"filter-cat-subview",
		() => {
			setSubView(null);
			setBhajanSearchQuery("");
		},
	);
	const closeIsAddingNew = usePopupBackHandler(
		isAddingNew,
		"filter-cat-new",
		() => setIsAddingNew(false),
	);

	// Track bhajan-category changes locally before save
	const [pendingBhajanChanges, setPendingBhajanChanges] = useState<
		Record<string, Record<string, number | undefined>>
	>({});
	// pendingBhajanChanges[bhajanId][categoryId] = sequence | undefined (undefined = remove)

	// Draft state for editing
	const [draftLabelHi, setDraftLabelHi] = useState("");
	const [draftLabelEn, setDraftLabelEn] = useState("");
	const [draftKeywords, setDraftKeywords] = useState("");

	// New category draft
	const [newId, setNewId] = useState("");
	const [newLabelHi, setNewLabelHi] = useState("");
	const [newLabelEn, setNewLabelEn] = useState("");
	const [newKeywords, setNewKeywords] = useState("");

	const loadCategories = async () => {
		setIsLoading(true);
		try {
			const data = await fetchCategoriesFromFirebase();
			if (
				data &&
				Array.isArray(data.categories) &&
				data.categories.length > 0
			) {
				if (isCategoryDataGarbled(data.categories)) {
					// Cloud data is corrupted — auto-repair from local defaults
					console.warn(
						"[FilterCategoryManager] Garbled cloud data detected, restoring defaults",
					);
					setCategories(DEFAULT_CATEGORIES);
					setHasChanges(true);
					setWasRepaired(true);
				} else {
					setCategories(data.categories.sort((a, b) => a.order - b.order));
				}
			} else {
				setCategories(DEFAULT_CATEGORIES);
			}
		} catch {
			setCategories(DEFAULT_CATEGORIES);
		}
		setIsLoading(false);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: loadCategories is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		loadCategories();
	}, []);

	// Get bhajans for a category (considering pending changes)
	const getBhajansInCategory = (categoryId: string): Bhajan[] => {
		return bhajans.filter((b) => {
			const pending = pendingBhajanChanges[b.id];
			if (pending && categoryId in pending) {
				return pending[categoryId] !== undefined; // undefined = removed
			}
			return typeof b.categories?.[categoryId] === "number";
		});
	};

	const isBhajanInCategory = (
		bhajanId: string,
		categoryId: string,
	): boolean => {
		const pending = pendingBhajanChanges[bhajanId];
		if (pending && categoryId in pending) {
			return pending[categoryId] !== undefined;
		}
		const bhajan = bhajans.find((b) => b.id === bhajanId);
		return typeof bhajan?.categories?.[categoryId] === "number";
	};

	const toggleBhajanInCategory = (bhajanId: string, categoryId: string) => {
		const isIn = isBhajanInCategory(bhajanId, categoryId);

		let nextSequence: number | undefined;
		if (!isIn) {
			const existingBhajans = getBhajansInCategory(categoryId);
			const maxSeq = existingBhajans.reduce((max, b) => {
				const seq =
					pendingBhajanChanges[b.id]?.[categoryId] ??
					b.categories?.[categoryId] ??
					0;
				return Math.max(max, seq);
			}, 0);
			nextSequence = maxSeq + 1;
		}

		setPendingBhajanChanges((prev) => ({
			...prev,
			[bhajanId]: {
				...(prev[bhajanId] || {}),
				[categoryId]: nextSequence,
			},
		}));
		setHasChanges(true);
	};

	const startEdit = (cat: FilterCategoryDef) => {
		setEditingId(cat.id);
		setDraftLabelHi(cat.labelHi);
		setDraftLabelEn(cat.labelEn);
		setDraftKeywords(cat.keywords.join(", "));
	};

	const cancelEdit = () => {
		setEditingId(null);
		setDraftLabelHi("");
		setDraftLabelEn("");
		setDraftKeywords("");
	};
	// Back cancels an open inline edit before leaving the screen.
	useAdminBack(editingId !== null, cancelEdit);

	const saveEdit = () => {
		if (!editingId) return;
		setCategories((prev) =>
			prev.map((c) =>
				c.id === editingId
					? {
							...c,
							labelHi: draftLabelHi.trim() || c.labelHi,
							labelEn: draftLabelEn.trim() || c.labelEn,
							keywords: draftKeywords
								.split(",")
								.map((k) => k.trim())
								.filter(Boolean),
						}
					: c,
			),
		);
		setHasChanges(true);
		cancelEdit();
	};

	const addCategory = () => {
		if (!newId.trim() || !newLabelHi.trim()) {
			showToast(
				isHindi ? "ID और हिंदी लेबल ज़रूरी है" : "ID and Hindi label required",
				"error",
			);
			return;
		}
		const id = newId.trim().toLowerCase().replace(/\s+/g, "_");
		if (categories.find((c) => c.id === id)) {
			showToast(
				isHindi ? "यह ID पहले से मौजूद है" : "This ID already exists",
				"error",
			);
			return;
		}
		const newCat: FilterCategoryDef = {
			id,
			labelHi: newLabelHi.trim(),
			labelEn: newLabelEn.trim() || newLabelHi.trim(),
			keywords: newKeywords
				.split(",")
				.map((k) => k.trim())
				.filter(Boolean),
			order: categories.length + 1,
		};
		setCategories((prev) => [...prev, newCat]);
		setNewId("");
		setNewLabelHi("");
		setNewLabelEn("");
		setNewKeywords("");
		setIsAddingNew(false);
		setHasChanges(true);
	};

	const removeCategory = (id: string) => {
		// Also remove this category from all bhajans' pending changes
		const removals: Record<string, Record<string, number | undefined>> = {};
		bhajans.forEach((b) => {
			if (
				b.categories?.[id] !== undefined ||
				pendingBhajanChanges[b.id]?.[id] !== undefined
			) {
				removals[b.id] = {
					...(pendingBhajanChanges[b.id] || {}),
					[id]: undefined,
				} as Record<string, number | undefined>;
			}
		});
		setPendingBhajanChanges((prev) => ({ ...prev, ...removals }));
		setCategories((prev) =>
			prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i + 1 })),
		);
		setHasChanges(true);
	};

	const moveCategory = (idx: number, dir: "up" | "down") => {
		const newList = [...categories];
		if (dir === "up" && idx > 0)
			[newList[idx - 1], newList[idx]] = [newList[idx], newList[idx - 1]];
		else if (dir === "down" && idx < newList.length - 1)
			[newList[idx + 1], newList[idx]] = [newList[idx], newList[idx + 1]];
		setCategories(newList.map((c, i) => ({ ...c, order: i + 1 })));
		setHasChanges(true);
	};

	const handleSaveToCloud = async () => {
		setIsSaving(true);
		try {
			// 1. Save category config
			setProgressMsg(
				isHindi ? "श्रेणी config सहेज रहे हैं..." : "Saving category config...",
			);
			await saveCategoriesConfig(categories, setProgressMsg);

			// 2. If there are pending bhajan changes, save those too
			if (Object.keys(pendingBhajanChanges).length > 0) {
				setProgressMsg(
					isHindi
						? "भजन डेटा अपडेट हो रहा है..."
						: "Updating bhajan assignments...",
				);
				// Save all changed bhajans in a single batch. Applied to each bhajan's
				// current cloud copy, so another admin's edits to it are kept.
				const result = await saveBhajanPatchesToFirebase(
					Object.entries(pendingBhajanChanges).map(([id, changes]) => ({
						id,
						apply: (stored) => {
							const newCategories = { ...(stored.categories || {}) };
							for (const [catId, seq] of Object.entries(changes)) {
								if (seq === undefined) {
									delete newCategories[catId];
								} else {
									newCategories[catId] = seq;
								}
							}
							return {
								...stored,
								categories:
									Object.keys(newCategories).length > 0
										? newCategories
										: undefined,
							};
						},
					})),
					setProgressMsg,
				);

				onUpdateBhajans(result.bhajans);
				setPendingBhajanChanges({});
			}

			setHasChanges(false);
			showToast(
				isHindi
					? "सब सहेजा गया! Force Sync से सभी को मिलेगा।"
					: "All saved! Use Force Sync to publish.",
				"success",
			);
		} catch (e: any) {
			// Show the latest cloud data even when the save was refused.
			if (e instanceof BhajanSaveError && e.latest) onUpdateBhajans(e.latest);
			showToast(`${isHindi ? "त्रुटि" : "Error"}: ${e.message}`, "error");
		} finally {
			setIsSaving(false);
			setProgressMsg("");
		}
	};

	// Filtered + sorted bhajans for search in sub-view (assigned ones at top)
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	const searchedBhajans = useMemo(() => {
		const filtered = !bhajanSearchQuery.trim()
			? bhajans
			: bhajans
					.map((b) => ({
						bhajan: b,
						score: calculateSearchScore(b, bhajanSearchQuery, "devanagari"),
					}))
					.filter((item) => item.score > 0)
					.sort((a, b) => b.score - a.score)
					.map((item) => item.bhajan);

		// Sort: assigned bhajans in this category come first
		if (subView?.type === "manage_bhajans") {
			const catId = subView.categoryId;
			return [...filtered].sort((a, b) => {
				const aIn = isBhajanInCategory(a.id, catId) ? 0 : 1;
				const bIn = isBhajanInCategory(b.id, catId) ? 0 : 1;
				return aIn - bIn;
			});
		}
		return filtered;
	}, [bhajans, bhajanSearchQuery, subView, pendingBhajanChanges]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-10 gap-3 text-slate-500 dark:text-ink-300">
				<Loader2 className="animate-spin" size={20} />
				<span>{isHindi ? "लोड हो रहा है..." : "Loading..."}</span>
			</div>
		);
	}

	// ── Sub-View: Manage Bhajans in a Category ──
	if (subView?.type === "manage_bhajans") {
		const cat = categories.find((c) => c.id === subView.categoryId);
		if (!cat) {
			setSubView(null);
			return null;
		}
		const assignedBhajans = getBhajansInCategory(cat.id);

		return (
			<div className="flex flex-col h-full animate-in slide-in-from-right">
				<div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-2 sticky top-0 z-10">
					<div className="flex items-center gap-2">
						<button
							onClick={closeSubView}
							className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-700"
						>
							<X size={16} className="text-slate-500 dark:text-ink-300" />
						</button>
						<div className="flex-1">
							<h3 className="font-bold text-sm text-slate-800 dark:text-white">
								{cat.labelHi}
							</h3>
							<p className="text-[10px] text-slate-400 dark:text-ink-400">
								{assignedBhajans.length}{" "}
								{isHindi ? "भजन इस श्रेणी में" : "bhajans in this category"}
							</p>
						</div>
					</div>
					<div className="relative">
						<Search
							className="absolute left-3 top-2.5 text-slate-400 dark:text-ink-400"
							size={16}
						/>
						<input
							className="w-full bg-slate-100 dark:bg-slate-900 rounded-lg py-2 pl-9 pr-4 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
							placeholder={isHindi ? "भजन खोजें..." : "Search bhajans..."}
							value={bhajanSearchQuery}
							onChange={(e) => setBhajanSearchQuery(e.target.value)}
						/>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-3 space-y-1 pb-[calc(2rem+env(safe-area-inset-bottom))]">
					{searchedBhajans.map((b) => {
						const isIn = isBhajanInCategory(b.id, cat.id);
						return (
							<button
								key={b.id}
								onClick={() => toggleBhajanInCategory(b.id, cat.id)}
								className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${isIn ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-800" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"}`}
							>
								<div
									className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isIn ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}
								>
									{isIn ? (
										<Check size={14} />
									) : (
										<Plus
											size={14}
											className="text-slate-400 dark:text-ink-400"
										/>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-bold text-sm text-slate-800 dark:text-white truncate">
										{b.songNumber && (
											<span className="text-blue-500 mr-1">
												#{b.songNumber}
											</span>
										)}
										{b.title}
									</div>
									<div className="text-[10px] text-slate-400 dark:text-ink-400 truncate">
										{getListFirstLine(b.firstLine, b.content)}
									</div>
								</div>
							</button>
						);
					})}
				</div>
			</div>
		);
	}

	// ── Main View: Category List ──
	return (
		<div className="flex flex-col h-full animate-in slide-in-from-right">
			<div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 z-10">
				<div className="flex items-center gap-2">
					<Filter size={18} className="text-blue-600" />
					<span className="text-sm font-bold text-slate-700 dark:text-slate-200">
						{categories.length} {isHindi ? "श्रेणियाँ" : "Categories"}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setIsAddingNew(true)}
						className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1"
					>
						<Plus size={16} /> {isHindi ? "नई" : "Add"}
					</button>
					<button
						onClick={handleSaveToCloud}
						disabled={isSaving || !hasChanges}
						className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-colors"
					>
						{isSaving ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<Save size={16} />
						)}
						{isSaving ? progressMsg || "Saving..." : isHindi ? "सहेजें" : "Save"}
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-3 space-y-2 pb-[calc(2rem+env(safe-area-inset-bottom))]">
				{wasRepaired && (
					<div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 animate-in fade-in">
						<span className="text-lg shrink-0">🔧</span>
						<div className="flex-1">
							<p className="text-xs font-bold text-amber-800 dark:text-amber-300">
								{isHindi
									? "Cloud डेटा खराब था — ठीक किया गया"
									: "Cloud data was corrupted — restored from defaults"}
							</p>
							<p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
								{isHindi
									? '"सहेजें" दबाएं ताकि सही डेटा Cloud पर जाए।'
									: 'Press "Save" to push clean data to cloud.'}
							</p>
						</div>
						<button
							onClick={() => setWasRepaired(false)}
							className="text-amber-400 hover:text-amber-600 shrink-0"
						>
							✕
						</button>
					</div>
				)}
				{isAddingNew && (
					<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-800 rounded-2xl p-4 space-y-3 animate-in fade-in">
						<h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
							<Plus size={16} /> {isHindi ? "नई श्रेणी जोड़ें" : "Add New Category"}
						</h4>
						<input
							value={newId}
							onChange={(e) => setNewId(e.target.value)}
							className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
							placeholder="ID (e.g. vasant)"
						/>
						<input
							value={newLabelHi}
							onChange={(e) => setNewLabelHi(e.target.value)}
							className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
							placeholder={isHindi ? "हिंदी लेबल" : "Hindi Label"}
						/>
						<input
							value={newLabelEn}
							onChange={(e) => setNewLabelEn(e.target.value)}
							className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
							placeholder="English Label"
						/>
						<input
							value={newKeywords}
							onChange={(e) => setNewKeywords(e.target.value)}
							className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
							placeholder={
								isHindi
									? "कीवर्ड (comma separated)"
									: "Keywords (comma separated)"
							}
						/>
						<div className="flex gap-2 justify-end">
							<button
								onClick={closeIsAddingNew}
								className="px-3 py-2 text-sm text-slate-500 dark:text-ink-300 font-bold"
							>
								{isHindi ? "रद्द" : "Cancel"}
							</button>
							<button
								onClick={addCategory}
								className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold"
							>
								{isHindi ? "जोड़ें" : "Add"}
							</button>
						</div>
					</div>
				)}

				{categories.map((cat, idx) => {
					const count = getBhajansInCategory(cat.id).length;
					return (
						<div
							key={cat.id}
							className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
						>
							{editingId === cat.id ? (
								<div className="p-4 space-y-3 border-l-4 border-blue-500">
									<div>
										<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block">
											{isHindi ? "हिंदी लेबल" : "Hindi Label"}
										</label>
										<input
											value={draftLabelHi}
											onChange={(e) => setDraftLabelHi(e.target.value)}
											className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
										/>
									</div>
									<div>
										<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block">
											English Label
										</label>
										<input
											value={draftLabelEn}
											onChange={(e) => setDraftLabelEn(e.target.value)}
											className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
										/>
									</div>
									<div>
										<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block">
											{isHindi ? "कीवर्ड" : "Keywords"}
										</label>
										<input
											value={draftKeywords}
											onChange={(e) => setDraftKeywords(e.target.value)}
											className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
										/>
									</div>
									<div className="flex gap-2 justify-end pt-1">
										<button
											onClick={cancelEdit}
											className="p-2 text-slate-500 dark:text-ink-300 hover:text-red-500"
										>
											<X size={18} />
										</button>
										<button
											onClick={saveEdit}
											className="p-2 bg-blue-600 text-white rounded-lg"
										>
											<Save size={18} />
										</button>
									</div>
								</div>
							) : (
								<div className="p-3 flex items-center gap-3">
									<div className="flex flex-col gap-1 shrink-0">
										<button
											onClick={() => moveCategory(idx, "up")}
											disabled={idx === 0}
											className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-700 disabled:opacity-20 bg-slate-50 dark:bg-slate-700/50 rounded"
										>
											<ChevronUp size={14} />
										</button>
										<button
											onClick={() => moveCategory(idx, "down")}
											disabled={idx === categories.length - 1}
											className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-700 disabled:opacity-20 bg-slate-50 dark:bg-slate-700/50 rounded"
										>
											<ChevronDown size={14} />
										</button>
									</div>

									{/* Click to manage bhajans */}
									<button
										onClick={() =>
											setSubView({ type: "manage_bhajans", categoryId: cat.id })
										}
										className="flex-1 min-w-0 text-left"
									>
										<div className="flex items-center gap-2">
											<Tag size={14} className="text-blue-500 shrink-0" />
											<span className="font-bold text-sm text-slate-800 dark:text-white">
												{cat.labelHi}
											</span>
											<span className="text-xs text-slate-400 dark:text-ink-400">
												({cat.labelEn})
											</span>
										</div>
										<div className="flex items-center gap-2 mt-1">
											<span className="text-[10px] text-slate-400 dark:text-ink-400">
												ID:{" "}
												<span className="font-mono text-blue-500">
													{cat.id}
												</span>
											</span>
											<span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
												<Music size={10} className="inline mr-0.5" />
												{count} {isHindi ? "भजन" : "bhajans"}
											</span>
											<ChevronRight
												size={12}
												className="text-slate-300 ml-auto"
											/>
										</div>
									</button>

									<div className="flex gap-1 shrink-0">
										<button
											onClick={() => startEdit(cat)}
											className="p-2 text-blue-500 bg-slate-50 dark:bg-slate-700/50 rounded-full hover:bg-blue-50"
										>
											<Edit2 size={14} />
										</button>
										<button
											onClick={() => removeCategory(cat.id)}
											className="p-2 text-red-500 bg-slate-50 dark:bg-slate-700/50 rounded-full hover:bg-red-50"
										>
											<Trash2 size={14} />
										</button>
									</div>
								</div>
							)}
						</div>
					);
				})}

				{categories.length === 0 && (
					<div className="text-center py-12 text-slate-400 dark:text-ink-400">
						<Filter size={32} className="mx-auto mb-3 opacity-30" />
						<p className="text-sm">
							{isHindi ? "कोई श्रेणी नहीं।" : "No categories."}
						</p>
					</div>
				)}

				{hasChanges && (
					<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-xl p-3 text-center mt-4">
						<p className="text-xs font-bold text-amber-700 dark:text-amber-300">
							{isHindi
								? '⚠️ बदलाव सहेजे नहीं गए हैं। ऊपर "सहेजें" बटन दबाएं।'
								: '⚠️ Unsaved changes. Tap "Save" above.'}
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

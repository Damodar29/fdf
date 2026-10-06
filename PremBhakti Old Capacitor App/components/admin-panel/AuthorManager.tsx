import {
	Check,
	ChevronRight,
	Edit2,
	Loader2,
	Music,
	Plus,
	Save,
	Search,
	Trash2,
	User,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { type AuthorDef, KNOWN_AUTHORS } from "../../data/authors";
import { useAdminBack } from "../../src/hooks/useAdminBack";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import {
	fetchAuthorsFromFirebase,
	saveAuthorsConfig,
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

type SubView = null | { type: "manage_bhajans"; authorKey: string };

/** Returns true if the text contains at least one Devanagari character (U+0900–U+097F) */
const hasDevanagari = (text: string): boolean => /[\u0900-\u097F]/.test(text);

/** Returns true if the fetched authors data looks garbled (no Devanagari found in deva fields) */
const isDataGarbled = (authors: Record<string, AuthorDef>): boolean => {
	const sample = Object.values(authors).slice(0, 10);
	return sample.length > 0 && sample.every((a) => !hasDevanagari(a.deva));
};

interface AuthorManagerProps {
	bhajans: Bhajan[];
	onUpdateBhajans: (data: Bhajan[]) => void;
	showToast: (text: string, type?: "success" | "error") => void;
	settingsLanguage?: "en" | "hi";
}

export const AuthorManager: React.FC<AuthorManagerProps> = ({
	bhajans,
	onUpdateBhajans,
	showToast,
	settingsLanguage = "hi",
}) => {
	const isHindi = settingsLanguage === "hi";
	const [authors, setAuthors] = useState<Record<string, AuthorDef>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [progressMsg, setProgressMsg] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [isAddingNew, setIsAddingNew] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [subView, setSubView] = useState<SubView>(null);
	const [bhajanSearchQuery, setBhajanSearchQuery] = useState("");
	const [wasRepaired, setWasRepaired] = useState(false);

	// ── BACK BUTTON SUPPORT FOR POPUPS ──
	const closeSubView = usePopupBackHandler(
		!!subView,
		"author-mgr-subview",
		() => {
			setSubView(null);
			setBhajanSearchQuery("");
		},
	);
	const closeIsAddingNew = usePopupBackHandler(
		isAddingNew,
		"author-mgr-new",
		() => setIsAddingNew(false),
	);

	// Track bhajan-author reassignments
	const [pendingAuthorChanges, setPendingAuthorChanges] = useState<
		Record<string, string | undefined>
	>({});
	// pendingAuthorChanges[bhajanId] = newAuthorKey | undefined (undefined = remove author)

	// Draft state for editing
	const [draftDeva, setDraftDeva] = useState("");
	const [draftIast, setDraftIast] = useState("");

	// New author draft
	const [newKey, setNewKey] = useState("");
	const [newDeva, setNewDeva] = useState("");
	const [newIast, setNewIast] = useState("");

	// Helper to robustly match corrupted or full author names
	const normalizeAuthorMatch = (val: string): string => {
		if (!val) return "";
		let ungarbled = val;
		try {
			if (val.includes("Ó") || val.includes("ñ")) {
				const arr = new Uint8Array([...val].map((c) => c.charCodeAt(0)));
				ungarbled = new TextDecoder("utf-8").decode(arr);
			}
		} catch (_e) {}
		return ungarbled;
	};

	// Count bhajans per author (considering pending changes and garbled data)
	// biome-ignore lint/correctness/useExhaustiveDependencies: per-render functions/callbacks left out on purpose (as deps they re-ran this hook every render)
	const authorCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		bhajans.forEach((b) => {
			const effective =
				pendingAuthorChanges[b.id] !== undefined
					? pendingAuthorChanges[b.id]
					: b.author;
			if (effective) {
				const normEffective = normalizeAuthorMatch(effective);
				let matchedKey = normEffective;

				// If not an exact key, check if it matches the full deva or iast name
				if (!authors[normEffective]) {
					const found = Object.entries(authors).find(
						([_k, v]) => v.deva === normEffective || v.iast === normEffective,
					);
					if (found) matchedKey = found[0];
				}

				counts[matchedKey] = (counts[matchedKey] || 0) + 1;
			}
		});
		return counts;
	}, [bhajans, pendingAuthorChanges, authors]);

	const loadAuthors = async () => {
		setIsLoading(true);
		try {
			const data = await fetchAuthorsFromFirebase();
			if (data?.authors && Object.keys(data.authors).length > 0) {
				if (isDataGarbled(data.authors)) {
					// Cloud data is corrupted (double-encoded) — auto-repair from local defaults
					console.warn(
						"[AuthorManager] Garbled cloud data detected, restoring from KNOWN_AUTHORS",
					);
					setAuthors({ ...KNOWN_AUTHORS });
					setHasChanges(true); // Mark dirty so admin can save clean data
					setWasRepaired(true);
				} else {
					setAuthors(data.authors);
				}
			} else {
				setAuthors({ ...KNOWN_AUTHORS });
			}
		} catch {
			setAuthors({ ...KNOWN_AUTHORS });
		}
		setIsLoading(false);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: loadAuthors is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		loadAuthors();
	}, []);

	const sortedKeys = useMemo(() => {
		return Object.keys(authors)
			.sort((a, b) => {
				// Authors with bhajans come first (sorted by count desc), then alphabetically
				const countA = authorCounts[a] || 0;
				const countB = authorCounts[b] || 0;
				if (countB !== countA) return countB - countA;
				const nameA = authors[a].deva || a;
				const nameB = authors[b].deva || b;
				return nameA.localeCompare(nameB, "hi");
			})
			.filter((key) => {
				if (!searchQuery.trim()) return true;
				const q = searchQuery.toLowerCase();
				return (
					key.toLowerCase().includes(q) ||
					authors[key].deva.toLowerCase().includes(q) ||
					authors[key].iast.toLowerCase().includes(q)
				);
			});
	}, [authors, searchQuery, authorCounts]);

	// Get bhajans for an author (considering pending changes)
	const getBhajansForAuthor = (authorKey: string): Bhajan[] => {
		return bhajans.filter((b) => isBhajanByAuthor(b.id, authorKey));
	};

	const toggleBhajanAuthor = (bhajanId: string, authorKey: string) => {
		const bhajan = bhajans.find((b) => b.id === bhajanId);
		if (!bhajan) return;

		const isCurrentlyAssigned = isBhajanByAuthor(bhajanId, authorKey);

		if (isCurrentlyAssigned) {
			// Remove from this author
			setPendingAuthorChanges((prev) => ({ ...prev, [bhajanId]: "" }));
		} else {
			// Assign to this author
			setPendingAuthorChanges((prev) => ({ ...prev, [bhajanId]: authorKey }));
		}
		setHasChanges(true);
	};

	const isBhajanByAuthor = (bhajanId: string, authorKey: string): boolean => {
		const bhajan = bhajans.find((b) => b.id === bhajanId);
		if (!bhajan) return false;
		const effective =
			pendingAuthorChanges[bhajanId] !== undefined
				? pendingAuthorChanges[bhajanId]
				: bhajan.author;
		if (!effective) return false;

		const normEffective = normalizeAuthorMatch(effective);
		if (normEffective === authorKey) return true;

		const authorObj = authors[authorKey];
		if (
			authorObj &&
			(normEffective === authorObj.deva || normEffective === authorObj.iast)
		)
			return true;

		return false;
	};

	const startEdit = (key: string) => {
		setEditingKey(key);
		setDraftDeva(authors[key].deva);
		setDraftIast(authors[key].iast);
	};

	const cancelEdit = () => {
		setEditingKey(null);
		setDraftDeva("");
		setDraftIast("");
	};
	// Back cancels an open inline edit before leaving the screen.
	useAdminBack(editingKey !== null, cancelEdit);

	const saveEdit = () => {
		if (!editingKey) return;
		setAuthors((prev) => ({
			...prev,
			[editingKey]: {
				deva: draftDeva.trim() || prev[editingKey].deva,
				iast: draftIast.trim() || prev[editingKey].iast,
			},
		}));
		setHasChanges(true);
		cancelEdit();
	};

	const addAuthor = () => {
		if (!newKey.trim() || !newDeva.trim()) {
			showToast(
				isHindi
					? "Key और देवनागरी नाम ज़रूरी है"
					: "Key and Devanagari name required",
				"error",
			);
			return;
		}
		const key = newKey.trim();
		if (authors[key]) {
			showToast(
				isHindi ? "यह key पहले से मौजूद है" : "This key already exists",
				"error",
			);
			return;
		}
		setAuthors((prev) => ({
			...prev,
			[key]: { deva: newDeva.trim(), iast: newIast.trim() || newDeva.trim() },
		}));
		setNewKey("");
		setNewDeva("");
		setNewIast("");
		setIsAddingNew(false);
		setHasChanges(true);
	};

	const removeAuthor = (key: string) => {
		const count = authorCounts[key] || 0;
		if (count > 0) {
			const msg = isHindi
				? `इस लेखक से ${count} भजन जुड़े हैं। हटाएं?`
				: `${count} bhajans linked. Remove?`;
			if (!window.confirm(msg)) return;
			// Remove author from those bhajans
			bhajans.forEach((b) => {
				if (isBhajanByAuthor(b.id, key)) {
					setPendingAuthorChanges((prev) => ({ ...prev, [b.id]: "" }));
				}
			});
		}
		setAuthors((prev) => {
			const newAuthors = { ...prev };
			delete newAuthors[key];
			return newAuthors;
		});
		setHasChanges(true);
	};

	const handleSaveToCloud = async () => {
		setIsSaving(true);
		try {
			// 1. Save author config
			setProgressMsg(
				isHindi ? "लेखक config सहेज रहे हैं..." : "Saving author config...",
			);
			await saveAuthorsConfig(authors, setProgressMsg);

			// 2. If there are pending bhajan changes, save those too
			const changedBhajanIds = Object.keys(pendingAuthorChanges);
			if (changedBhajanIds.length > 0) {
				setProgressMsg(
					isHindi ? "भजन डेटा अपडेट हो रहा है..." : "Updating bhajan authors...",
				);
				// Applied to each bhajan's current cloud copy, so another admin's
				// edits to the rest of it are kept.
				const result = await saveBhajanPatchesToFirebase(
					changedBhajanIds.map((id) => ({
						id,
						apply: (stored) => ({
							...stored,
							author: pendingAuthorChanges[id] || undefined,
						}),
					})),
					setProgressMsg,
				);

				onUpdateBhajans(result.bhajans);
				setPendingAuthorChanges({});
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

		// Sort: bhajans assigned to current author come first, then by song number
		if (subView?.type === "manage_bhajans") {
			const authorKey = subView.authorKey;
			return [...filtered].sort((a, b) => {
				const aAssigned = isBhajanByAuthor(a.id, authorKey) ? 0 : 1;
				const bAssigned = isBhajanByAuthor(b.id, authorKey) ? 0 : 1;

				if (aAssigned !== bAssigned) {
					return aAssigned - bAssigned;
				}

				// If both are assigned or both unassigned, sort by songNumber
				const extractNum = (str?: string) => {
					if (!str) return 0;
					const match = str.match(/\d+/);
					return match ? parseInt(match[0], 10) : 0;
				};
				return (
					extractNum(a.songNumber || a.id) - extractNum(b.songNumber || b.id)
				);
			});
		}
		return filtered;
	}, [bhajans, bhajanSearchQuery, subView, pendingAuthorChanges]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-10 gap-3 text-slate-500 dark:text-ink-300">
				<Loader2 className="animate-spin" size={20} />
				<span>{isHindi ? "लोड हो रहा है..." : "Loading..."}</span>
			</div>
		);
	}

	// ── Sub-View: Manage Bhajans for an Author ──
	if (subView?.type === "manage_bhajans") {
		const authorKey = subView.authorKey;
		const author = authors[authorKey];
		if (!author) {
			setSubView(null);
			return null;
		}
		const assignedBhajans = getBhajansForAuthor(authorKey);

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
								{author.deva}
							</h3>
							<p className="text-[10px] text-slate-400 dark:text-ink-400">
								{assignedBhajans.length}{" "}
								{isHindi ? "भजन इस लेखक के" : "bhajans by this author"}
							</p>
						</div>
					</div>
					<div className="relative">
						<Search
							className="absolute left-3 top-2.5 text-slate-400 dark:text-ink-400"
							size={16}
						/>
						<input
							className="w-full bg-slate-100 dark:bg-slate-900 rounded-lg py-2 pl-9 pr-4 outline-none focus:ring-2 focus:ring-purple-500 text-sm"
							placeholder={isHindi ? "भजन खोजें..." : "Search bhajans..."}
							value={bhajanSearchQuery}
							onChange={(e) => setBhajanSearchQuery(e.target.value)}
						/>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-3 space-y-1 pb-[calc(2rem+env(safe-area-inset-bottom))]">
					{searchedBhajans.map((b) => {
						const isAssigned = isBhajanByAuthor(b.id, authorKey);
						return (
							<button
								key={b.id}
								onClick={() => toggleBhajanAuthor(b.id, authorKey)}
								className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${isAssigned ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-800" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"}`}
							>
								<div
									className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isAssigned ? "bg-purple-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}
								>
									{isAssigned ? (
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
											<span className="text-purple-500 mr-1">
												#{b.songNumber}
											</span>
										)}
										{b.title}
									</div>
									<div className="text-[10px] text-slate-400 dark:text-ink-400 truncate">
										{b.author && b.author !== authorKey && (
											<span className="text-amber-500">
												({isHindi ? "अभी" : "current"}: {b.author})
											</span>
										)}
										{!b.author && (
											<span className="text-slate-300">
												{isHindi ? "कोई लेखक नहीं" : "No author"}
											</span>
										)}
										{b.author === authorKey && (
											<span>{getListFirstLine(b.firstLine, b.content)}</span>
										)}
									</div>
								</div>
							</button>
						);
					})}
				</div>
			</div>
		);
	}

	// ── Main View: Author List ──
	return (
		<div className="flex flex-col h-full animate-in slide-in-from-right">
			<div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-2 sticky top-0 z-10">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Users size={18} className="text-purple-600" />
						<span className="text-sm font-bold text-slate-700 dark:text-slate-200">
							{sortedKeys.length} {isHindi ? "लेखक" : "Authors"}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => setIsAddingNew(true)}
							className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1"
						>
							<Plus size={16} /> {isHindi ? "नया" : "Add"}
						</button>
						<button
							onClick={handleSaveToCloud}
							disabled={isSaving || !hasChanges}
							className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-colors"
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
				<div className="relative">
					<Search
						className="absolute left-3 top-2.5 text-slate-400 dark:text-ink-400"
						size={16}
					/>
					<input
						className="w-full bg-slate-100 dark:bg-slate-900 rounded-lg py-2 pl-9 pr-4 outline-none focus:ring-2 focus:ring-purple-500 text-sm"
						placeholder={isHindi ? "लेखक खोजें..." : "Search authors..."}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
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
					<div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-800 rounded-2xl p-4 space-y-3 animate-in fade-in">
						<h4 className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
							<Plus size={16} /> {isHindi ? "नया लेखक जोड़ें" : "Add New Author"}
						</h4>
						<input
							value={newKey}
							onChange={(e) => setNewKey(e.target.value)}
							className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
							placeholder={
								isHindi ? "Key (देवनागरी, जैसे: कबीर)" : "Key (e.g. कबीर)"
							}
						/>
						<input
							value={newDeva}
							onChange={(e) => setNewDeva(e.target.value)}
							className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
							placeholder={isHindi ? "पूरा नाम देवनागरी" : "Full Name Hindi"}
						/>
						<input
							value={newIast}
							onChange={(e) => setNewIast(e.target.value)}
							className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
							placeholder="IAST Name (e.g. Kabīrdās Jī)"
						/>
						<div className="flex gap-2 justify-end">
							<button
								onClick={closeIsAddingNew}
								className="px-3 py-2 text-sm text-slate-500 dark:text-ink-300 font-bold"
							>
								{isHindi ? "रद्द" : "Cancel"}
							</button>
							<button
								onClick={addAuthor}
								className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold"
							>
								{isHindi ? "जोड़ें" : "Add"}
							</button>
						</div>
					</div>
				)}

				{sortedKeys.map((key) => {
					const author = authors[key];
					const count = authorCounts[key] || 0;

					return (
						<div
							key={key}
							className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
						>
							{editingKey === key ? (
								<div className="p-4 space-y-3 border-l-4 border-purple-500">
									<div className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1">
										Key:{" "}
										<span className="font-mono text-purple-500">{key}</span>
										<span className="text-slate-300 ml-2">
											(key बदला नहीं जा सकता)
										</span>
									</div>
									<div>
										<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block">
											{isHindi ? "देवनागरी नाम" : "Devanagari Name"}
										</label>
										<input
											value={draftDeva}
											onChange={(e) => setDraftDeva(e.target.value)}
											className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
										/>
									</div>
									<div>
										<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block">
											IAST Name
										</label>
										<input
											value={draftIast}
											onChange={(e) => setDraftIast(e.target.value)}
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
											className="p-2 bg-purple-600 text-white rounded-lg"
										>
											<Save size={18} />
										</button>
									</div>
								</div>
							) : (
								<div className="p-3 flex items-center gap-3">
									<div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center shrink-0">
										<User size={16} />
									</div>

									{/* Click to manage bhajans */}
									<button
										onClick={() =>
											setSubView({ type: "manage_bhajans", authorKey: key })
										}
										className="flex-1 min-w-0 text-left"
									>
										<div className="font-bold text-sm text-slate-800 dark:text-white truncate">
											{author.deva}
										</div>
										<div className="text-xs text-slate-400 dark:text-ink-400 truncate">
											{author.iast}
										</div>
										<div className="flex items-center gap-2 mt-0.5">
											<span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">
												{key}
											</span>
											<span
												className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${count > 0 ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30" : "text-slate-400 bg-slate-100 dark:bg-slate-800"}`}
											>
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
											onClick={() => startEdit(key)}
											className="p-2 text-purple-500 bg-slate-50 dark:bg-slate-700/50 rounded-full hover:bg-purple-50"
										>
											<Edit2 size={14} />
										</button>
										<button
											onClick={() => removeAuthor(key)}
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

				{sortedKeys.length === 0 && (
					<div className="text-center py-12 text-slate-400 dark:text-ink-400">
						<Users size={32} className="mx-auto mb-3 opacity-30" />
						<p className="text-sm">
							{searchQuery
								? isHindi
									? "नहीं मिला"
									: "Not found"
								: isHindi
									? "कोई लेखक नहीं"
									: "No authors"}
						</p>
					</div>
				)}

				{hasChanges && (
					<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-xl p-3 text-center mt-4">
						<p className="text-xs font-bold text-amber-700 dark:text-amber-300">
							{isHindi
								? '⚠️ बदलाव सहेजे नहीं गए हैं। ऊपर "सहेजें" दबाएं।'
								: '⚠️ Unsaved changes. Tap "Save" above.'}
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

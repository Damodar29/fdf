import { Check, ChevronDown, Pencil, Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	getRelationLabel,
	isKnownRelation,
	RELATION_GROUPS,
	RELATION_MAX_LENGTH,
} from "../../src/constants/relations";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import { searchRelations } from "../../utils/relationSearch";

interface RelationPickerProps {
	/** Stored relation: a known id, custom text, or "" for none. */
	value: string;
	onChange: (value: string) => void;
	isHindi: boolean;
	/** Visible label above the field. Omit to render the field alone. */
	label?: string;
	accent?: "pink" | "blue";
	size?: "md" | "sm";
	/** Relation ids to offer as one-tap chips (e.g. the inverse of theirs). */
	suggestions?: string[];
}

type GenderTab = "all" | "male" | "female";

// Short names for the category tabs, by group (RELATION_GROUPS order).
const GROUP_TABS: Record<string, { hi: string; en: string }> = {
	"Immediate family": { hi: "परिवार", en: "Family" },
	"Grandparents & grandchildren": { hi: "दादा-नानी", en: "Grandparents" },
	"Great-grandparents & great-grandchildren": {
		hi: "परदादा",
		en: "Great-grand",
	},
	"Uncles & aunts": { hi: "चाचा-मामा-बुआ", en: "Uncles & aunts" },
	"Nephews, nieces & cousins": {
		hi: "भतीजे-भाई बहन",
		en: "Nephews & cousins",
	},
	"In-laws": { hi: "ससुराल", en: "In-laws" },
};

let pickerCount = 0;

/**
 * Family relation picker: a field that opens a sheet with search, a
 * male / female switch and category tabs, so the long list is easy to go
 * through; "Other" lets the devotee type their own. Used on the Profile screen
 * and in the admin panel. Android back closes the sheet only.
 */
export const RelationPicker: React.FC<RelationPickerProps> = ({
	value,
	onChange,
	isHindi,
	label,
	accent = "pink",
	size = "md",
	suggestions = [],
}) => {
	const id = useId();
	// One history entry id per picker on screen (two can be open in turn).
	const [viewId] = useState(() => `relation-picker-${++pickerCount}`);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [gender, setGender] = useState<GenderTab>("all");
	const [tab, setTab] = useState<string>("all");
	// "Other" has to survive an empty text box, so it can't be derived from
	// `value` alone.
	const [customMode, setCustomMode] = useState(
		() => !!value && !isKnownRelation(value),
	);
	// Focus the text box only when the user has just picked "Other".
	const focusCustomRef = useRef(false);

	useEffect(() => {
		if (isKnownRelation(value)) setCustomMode(false);
		else if (value) setCustomMode(true);
	}, [value]);

	const closeSheet = usePopupBackHandler(open, viewId, () => setOpen(false));

	const openSheet = () => {
		setQuery("");
		setGender("all");
		setTab("all");
		setOpen(true);
	};

	const pick = (next: string) => {
		setCustomMode(false);
		onChange(next);
		closeSheet();
	};

	const q = query.trim();
	const groups = useMemo(() => {
		// Searching: one list, best match first, across every category and
		// in any script (utils/relationSearch.ts).
		if (q) {
			const found = searchRelations(q, gender);
			return found.length
				? [{ en: "Best matches", hi: "सबसे मिलते रिश्ते", options: found }]
				: [];
		}
		return RELATION_GROUPS.filter((g) => tab === "all" || g.en === tab)
			.map((g) => ({
				...g,
				options: g.options.filter(
					(o) => gender === "all" || !o.g || o.g === gender,
				),
			}))
			.filter((g) => g.options.length > 0);
	}, [q, tab, gender]);

	const accentText =
		accent === "blue"
			? "text-blue-600 dark:text-blue-300"
			: "text-pink-600 dark:text-pink-300";
	const accentSolid =
		accent === "blue"
			? "bg-blue-500 border-blue-500 text-white"
			: "bg-pink-500 border-pink-500 text-white";
	const focusRing =
		accent === "blue"
			? "focus:border-blue-500 focus:ring-blue-500/20"
			: "focus:border-pink-500 focus:ring-pink-500/20";
	const sizing =
		size === "sm"
			? "rounded-xl px-3 py-2 text-xs"
			: "rounded-2xl px-4 py-3 text-sm";
	const fieldClass = `w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${sizing} ${focusRing} focus:ring-2 transition-all outline-none`;

	const known = isKnownRelation(value);
	const selectedText = customMode
		? isHindi
			? "अन्य — स्वयं लिखा"
			: "Other — typed"
		: known
			? getRelationLabel(value, isHindi)
			: "";

	const chip = (active: boolean) =>
		`shrink-0 min-h-[36px] px-3 rounded-full border text-xs font-bold transition active:scale-95 ${
			active
				? accentSolid
				: "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800"
		}`;

	return (
		<div>
			{label && (
				<label
					htmlFor={id}
					className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1"
				>
					{label}
				</label>
			)}
			<button
				type="button"
				id={id}
				onClick={openSheet}
				aria-haspopup="dialog"
				className={`${fieldClass} flex items-center gap-2 text-left ${selectedText ? "text-slate-800 dark:text-white font-semibold" : "text-slate-400 dark:text-ink-400"}`}
			>
				<span className="flex-1 min-w-0 truncate">
					{selectedText ||
						(isHindi ? "रिश्ता चुनें (वैकल्पिक)" : "Select relation (optional)")}
				</span>
				<ChevronDown
					size={size === "sm" ? 14 : 16}
					className="shrink-0 text-slate-400 dark:text-ink-400"
				/>
			</button>

			{suggestions.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5 mt-2">
					<span className="text-[11px] text-slate-400 dark:text-ink-400">
						{isHindi ? "सुझाव:" : "Suggested:"}
					</span>
					{suggestions.map((sid) => (
						<button
							type="button"
							key={sid}
							onClick={() => {
								setCustomMode(false);
								onChange(sid);
							}}
							className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition active:scale-95 ${
								value === sid
									? accentSolid
									: accent === "blue"
										? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-300"
										: "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-300"
							}`}
						>
							{getRelationLabel(sid, isHindi)}
						</button>
					))}
				</div>
			)}

			{customMode && (
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					maxLength={RELATION_MAX_LENGTH}
					ref={(el) => {
						if (el && focusCustomRef.current) {
							focusCustomRef.current = false;
							el.focus();
						}
					}}
					aria-label={isHindi ? "रिश्ता लिखें" : "Type the relation"}
					placeholder={
						isHindi ? "जैसे: गुरु भाई, पड़ोसी..." : "e.g. Godbrother, Neighbour..."
					}
					className={`${fieldClass} text-slate-800 dark:text-white mt-2`}
				/>
			)}

			{open &&
				createPortal(
					<div
						className="fixed inset-0 z-[400] bg-black/60 flex items-end sm:items-center justify-center animate-in fade-in duration-200"
						onClick={(e) => {
							// React events bubble out of a portal to the popup behind;
							// a tap here must not also close that one.
							e.stopPropagation();
							closeSheet();
						}}
					>
						<div
							role="dialog"
							aria-modal="true"
							aria-label={isHindi ? "रिश्ता चुनें" : "Choose a relation"}
							className="w-full sm:max-w-md bg-ry-sand dark:bg-ink-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] animate-in slide-in-from-bottom-8 duration-300"
							onClick={(e) => e.stopPropagation()}
						>
							{/* Header + search */}
							<div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-slate-200 dark:border-slate-800">
								<div className="flex items-center justify-between gap-3">
									<h3 className="font-bold text-slate-800 dark:text-white">
										{isHindi ? "रिश्ता चुनें" : "Choose a relation"}
									</h3>
									<button
										type="button"
										onClick={closeSheet}
										aria-label={isHindi ? "बंद करें" : "Close"}
										className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-ink-300 active:scale-95"
									>
										<X size={18} />
									</button>
								</div>
								<div className="relative">
									<Search
										size={16}
										className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ink-400"
									/>
									<input
										type="search"
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										aria-label={isHindi ? "रिश्ता खोजें" : "Search relations"}
										placeholder={
											isHindi
												? "खोजें: मौसी, जीजा, माँ की बहन…"
												: "Search: mausi, jija, mother's sister…"
										}
										className={`${fieldClass} pl-9 text-slate-800 dark:text-white`}
									/>
								</div>
								{/* Male / female */}
								<div className="flex gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800">
									{(
										[
											["all", "सभी", "All"],
											["male", "पुरुष", "Male"],
											["female", "महिला", "Female"],
										] as const
									).map(([g, hi, en]) => (
										<button
											type="button"
											key={g}
											aria-pressed={gender === g}
											onClick={() => setGender(g)}
											className={`flex-1 min-h-[36px] rounded-lg text-xs font-bold transition ${
												gender === g
													? `bg-white dark:bg-slate-700 shadow-sm ${accentText}`
													: "text-slate-500 dark:text-slate-400"
											}`}
										>
											{isHindi ? hi : en}
										</button>
									))}
								</div>
								{/* Categories (hidden while searching — search covers all) */}
								{!q && (
									<div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
										<button
											type="button"
											aria-pressed={tab === "all"}
											onClick={() => setTab("all")}
											className={chip(tab === "all")}
										>
											{isHindi ? "सभी रिश्ते" : "All"}
										</button>
										{RELATION_GROUPS.map((g) => (
											<button
												type="button"
												key={g.en}
												aria-pressed={tab === g.en}
												onClick={() => setTab(g.en)}
												className={chip(tab === g.en)}
											>
												{isHindi
													? GROUP_TABS[g.en]?.hi || g.hi
													: GROUP_TABS[g.en]?.en || g.en}
											</button>
										))}
									</div>
								)}
							</div>

							{/* Options */}
							<div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
								{groups.length === 0 ? (
									<p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
										{isHindi
											? "कोई रिश्ता नहीं मिला — नीचे “अन्य” से ख़ुद लिखें।"
											: "No relation found — type your own with “Other” below."}
									</p>
								) : (
									groups.map((g) => (
										<section key={g.en} className="mb-4 last:mb-0">
											<p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-400 mb-2 ml-1">
												{isHindi ? g.hi : g.en}
											</p>
											<div className="grid grid-cols-2 gap-2">
												{g.options.map((o) => {
													const selected = !customMode && value === o.id;
													const hint = isHindi ? o.hintHi : o.hintEn;
													return (
														<button
															type="button"
															key={o.id}
															onClick={() => pick(o.id)}
															aria-pressed={selected}
															className={`relative min-h-touch text-left rounded-2xl border px-3 py-2 transition active:scale-[0.98] ${
																selected
																	? `${accent === "blue" ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-pink-500 bg-pink-50 dark:bg-pink-500/10"}`
																	: "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
															}`}
														>
															<span className="block pr-5 text-sm font-bold text-slate-800 dark:text-white leading-snug">
																{isHindi ? o.hi : o.en}
															</span>
															{(hint || isHindi) && (
																<span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
																	{hint || o.en}
																</span>
															)}
															{selected && (
																<Check
																	size={14}
																	className={`absolute top-2 right-2 ${accentText}`}
																/>
															)}
														</button>
													);
												})}
											</div>
										</section>
									))
								)}
							</div>

							{/* Other / clear */}
							<div className="shrink-0 flex gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-slate-800">
								<button
									type="button"
									onClick={() => {
										setCustomMode(true);
										focusCustomRef.current = true;
										// Keep text they already typed; drop a preset so the box starts empty.
										onChange(known ? "" : value);
										closeSheet();
									}}
									className="flex-1 min-h-touch flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 active:scale-95"
								>
									<Pencil size={14} />
									{isHindi ? "अन्य — स्वयं लिखें" : "Other — type it"}
								</button>
								{value && (
									<button
										type="button"
										onClick={() => pick("")}
										className="min-h-touch px-4 rounded-xl text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 active:scale-95"
									>
										{isHindi ? "हटाएँ" : "Clear"}
									</button>
								)}
							</div>
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
};

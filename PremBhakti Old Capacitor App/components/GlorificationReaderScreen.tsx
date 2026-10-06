import {
	collection,
	doc,
	documentId,
	getDoc,
	getDocs,
	query,
	where,
} from "firebase/firestore";
import {
	BookOpen,
	ChevronDown,
	ChevronLeft,
	ChevronUp,
	Heart,
	Loader2,
	MapPin,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { profileDb as db } from "../services/firebase";
import { triggerHaptic } from "../utils/haptic";

interface GlorificationEntry {
	id: string;
	name: string;
	location: string;
	glorification: string;
	createdAt: number;
	uid?: string;
	type?: "text" | "audio";
	audioUrl?: string;
	duration?: number;
}

/** Group entries: same uid (if present) → together; uid-less entries stay individual */
interface GroupedEntry {
	/** Use uid if available, else doc id as key */
	key: string;
	name: string;
	location: string;
	entries: GlorificationEntry[];
}

interface GlorificationReaderScreenProps {
	isOpen: boolean;
	onClose: () => void;
	settingsLanguage: "en" | "hi";
}

const ordinalLabel = (n: number, isHindi: boolean): string => {
	if (isHindi) {
		const map: Record<number, string> = {
			1: "पहली",
			2: "दूसरी",
			3: "तीसरी",
			4: "चौथी",
		};
		return `${map[n] ?? `${n}वीं`} महिमा`;
	}
	const map: Record<number, string> = {
		1: "1st",
		2: "2nd",
		3: "3rd",
		4: "4th",
	};
	return `${map[n] ?? `${n}th`} Glorification`;
};

const groupEntries = (entries: GlorificationEntry[]): GroupedEntry[] => {
	const uidMap = new Map<string, GroupedEntry>();
	const result: GroupedEntry[] = [];

	for (const entry of entries) {
		if (entry.uid) {
			if (uidMap.has(entry.uid)) {
				uidMap.get(entry.uid)?.entries.push(entry);
			} else {
				const g: GroupedEntry = {
					key: entry.uid,
					name: entry.name,
					location: entry.location,
					entries: [entry],
				};
				uidMap.set(entry.uid, g);
				result.push(g);
			}
		} else {
			// No uid — standalone group
			result.push({
				key: entry.id,
				name: entry.name,
				location: entry.location,
				entries: [entry],
			});
		}
	}
	return result;
};

export const GlorificationReaderScreen: React.FC<
	GlorificationReaderScreenProps
> = ({ isOpen, onClose, settingsLanguage }) => {
	const isHindi = settingsLanguage === "hi";
	const [entries, setEntries] = useState<GlorificationEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
	const [publishedIdsState, setPublishedIdsState] = useState<string[]>([]);
	const [visitedKeys, setVisitedKeys] = useState<Set<string>>(() => {
		try {
			const stored = localStorage.getItem("visitedGlorifications");
			return stored ? new Set(JSON.parse(stored)) : new Set();
		} catch (_e) {
			return new Set();
		}
	});
	const [initialVisitedKeys, setInitialVisitedKeys] = useState<Set<string>>(
		new Set(),
	);

	const loadPublishedGlorifications = async () => {
		try {
			const settingsSnap = await getDoc(
				doc(db, "app-settings", "glorification-reader"),
			);
			if (!settingsSnap.exists()) return;

			const data = settingsSnap.data();
			const publishedIds: string[] = data?.publishedIds || [];
			setPublishedIdsState(publishedIds);
			if (publishedIds.length === 0) return;

			const results: GlorificationEntry[] = [];
			const CHUNK = 30;
			for (let i = 0; i < publishedIds.length; i += CHUNK) {
				const chunk = publishedIds.slice(i, i + CHUNK);
				const q = query(
					collection(db, "hhbsm-2026-glorification"),
					where(documentId(), "in", chunk),
				);
				const snap = await getDocs(q);
				for (const d of snap.docs) {
					const dd = d.data();
					if (dd.type === "audio") continue;
					results.push({
						id: d.id,
						name: dd.name || "",
						location: dd.location || "",
						glorification: dd.glorification || "",
						createdAt: dd.createdAt || 0,
						uid: dd.uid || undefined,
						type: dd.type || "text",
					});
				}
			}

			// Re-sort by admin-defined order
			const idOrder = new Map(publishedIds.map((id, idx) => [id, idx]));
			results.sort(
				(a, b) => (idOrder.get(a.id) ?? 9999) - (idOrder.get(b.id) ?? 9999),
			);

			setEntries(results);
		} catch (err) {
			console.error("Failed to load published glorifications", err);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: loadPublishedGlorifications is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (!isOpen) return;
		setLoading(true);
		setEntries([]);
		setExpandedKeys(new Set());
		setPublishedIdsState([]);

		// Capture current visited keys for stable sorting while the modal is open
		setInitialVisitedKeys(new Set(visitedKeys));

		loadPublishedGlorifications().finally(() => setLoading(false));
	}, [isOpen]);

	// Back-button support
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (!isOpen) return;
		const id = `glorification-reader-${Date.now()}`;
		window.history.pushState({ isPopup: true, modalId: id }, "");
		const handler = () => onClose();
		window.addEventListener("popstate", handler);
		return () => {
			window.removeEventListener("popstate", handler);
			if (window.history.state?.modalId === id) window.history.back();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const toggleExpand = (key: string) => {
		triggerHaptic("light");
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
		setVisitedKeys((prev) => {
			const next = new Set(prev);
			if (!next.has(key)) {
				next.add(key);
				try {
					localStorage.setItem(
						"visitedGlorifications",
						JSON.stringify(Array.from(next)),
					);
				} catch (_e) {}
			}
			return next;
		});
	};

	const groups = useMemo(() => {
		const g = groupEntries(entries);
		return g.sort((a, b) => {
			const aVisited = initialVisitedKeys.has(a.key);
			const bVisited = initialVisitedKeys.has(b.key);
			if (aVisited && !bVisited) return 1;
			if (!aVisited && bVisited) return -1;
			return 0;
		});
	}, [entries, initialVisitedKeys]);

	useEffect(() => {
		if (groups.length > 0 && visitedKeys.size >= groups.length) {
			try {
				localStorage.setItem(
					"allGlorificationsReadHash",
					publishedIdsState.join(","),
				);
			} catch (_e) {}
		}
	}, [visitedKeys.size, groups.length, publishedIdsState]);

	if (!isOpen) return null;

	return createPortal(
		<div className="fixed inset-0 z-[80] flex flex-col bg-ry-cream dark:bg-slate-900 animate-in slide-in-from-bottom duration-300">
			{/* Header */}
			<div className="flex-none flex items-center gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 bg-gradient-to-b from-ry-maroon to-ry-maroon/90 shadow-lg">
				<button
					type="button"
					onClick={() => {
						triggerHaptic("light");
						onClose();
					}}
					className="p-2 rounded-full hover:bg-white/15 transition-colors active:scale-95"
				>
					<ChevronLeft size={22} className="text-ry-cream" />
				</button>
				<div className="flex-1 min-w-0">
					<h2 className="font-serif text-lg font-bold text-ry-cream leading-tight">
						{isHindi ? "गुरु महाराज जी की महिमा" : "Glorifications"}
					</h2>
					<p className="text-[10px] text-ry-cream/70 mt-0.5">
						{isHindi
							? `${groups.length} भक्तों की श्रद्धांजलि`
							: `${groups.length} devotee${groups.length !== 1 ? "s" : ""}`}
					</p>
				</div>
				<BookOpen size={20} className="text-ry-cream/60" />
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
				{loading ? (
					<div className="flex items-center justify-center flex-1 h-48 gap-3">
						<Loader2
							size={24}
							className="animate-spin text-ry-maroon dark:text-ry-gold"
						/>
						<span className="text-sm text-ry-brown dark:text-slate-300">
							{isHindi ? "लोड हो रहा है..." : "Loading..."}
						</span>
					</div>
				) : groups.length === 0 ? (
					<div className="flex flex-col items-center justify-center flex-1 py-20 px-8 text-center gap-4">
						<Heart
							size={48}
							className="text-ry-maroon/20 dark:text-ry-gold/20"
						/>
						<p className="text-ry-brown dark:text-slate-300 text-sm">
							{isHindi
								? "अभी कोई महिमा प्रकाशित नहीं की गई है।"
								: "No glorifications have been published yet."}
						</p>
					</div>
				) : (
					<div className="p-4 space-y-3 max-w-2xl mx-auto">
						{groups.map((group, gIdx) => {
							const isExpanded = expandedKeys.has(group.key);
							const multiEntry = group.entries.length > 1;

							return (
								<article
									key={group.key}
									className="relative bg-white dark:bg-slate-800 rounded-3xl border border-ry-gold/20 shadow-sm overflow-hidden"
								>
									{/* Gold accent top bar */}
									<div className="h-1 w-full bg-gradient-to-r from-ry-gold/40 via-ry-maroon/60 to-ry-gold/40" />

									{/* ── Collapsed header (always visible) ── */}
									<button
										type="button"
										className="w-full text-left px-5 py-4 flex items-center gap-3 group focus:outline-none"
										onClick={() => toggleExpand(group.key)}
										aria-expanded={isExpanded}
									>
										{/* Index badge */}
										<div className="w-7 h-7 shrink-0 rounded-full bg-ry-maroon/10 dark:bg-ry-gold/10 flex items-center justify-center">
											<span className="text-[10px] font-bold text-ry-maroon dark:text-ry-gold">
												{gIdx + 1}
											</span>
										</div>

										{/* Name + meta */}
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<p className="font-bold text-sm text-ry-maroon dark:text-ry-gold truncate">
													{group.name}
												</p>
												{!visitedKeys.has(group.key) && (
													<span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-black tracking-widest text-white uppercase shadow-[0_0_8px_2px_rgba(220,38,38,0.5)] animate-pulse">
														{isHindi ? "नई" : "NEW"}
													</span>
												)}
											</div>
											<div className="flex items-center gap-1 mt-0.5">
												{group.location && (
													<>
														<MapPin
															size={10}
															className="text-ry-brown/50 dark:text-slate-400 shrink-0"
														/>
														<p className="text-[11px] text-ry-brown/70 dark:text-slate-400 truncate">
															{group.location}
														</p>
													</>
												)}
												{multiEntry && (
													<span className="ml-1 shrink-0 text-[10px] font-bold bg-ry-maroon/10 dark:bg-ry-gold/10 text-ry-maroon dark:text-ry-gold px-2 py-0.5 rounded-full">
														{isHindi
															? `${group.entries.length} महिमाएं`
															: `${group.entries.length} entries`}
													</span>
												)}
											</div>
										</div>

										{/* Expand / Collapse icon */}
										<div className="shrink-0 flex flex-col items-center gap-0.5">
											<div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-ry-maroon text-ry-cream text-[11px] font-bold shadow-sm group-active:scale-95 transition-transform">
												{isExpanded ? (
													<>
														<ChevronUp size={12} />
														{isHindi ? "बंद करें" : "Collapse"}
													</>
												) : (
													<>
														<ChevronDown size={12} />
														{isHindi ? "पूरा पढ़ें" : "Read Full"}
													</>
												)}
											</div>
										</div>
									</button>

									{/* ── Expanded content ── */}
									{isExpanded && (
										<div className="border-t border-ry-gold/15 px-5 pb-5 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
											{group.entries.map((entry, eIdx) => (
												<div key={entry.id} className="pt-4">
													{/* Entry label (only show if multiple or always for clarity) */}
													<p className="text-[10px] font-bold tracking-wider text-ry-maroon/60 dark:text-ry-gold/60 uppercase mb-2">
														{ordinalLabel(eIdx + 1, isHindi)}
													</p>
													<p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-medium">
														{entry.glorification}
													</p>
													{eIdx < group.entries.length - 1 && (
														<div className="mt-4 h-px bg-ry-gold/15" />
													)}
												</div>
											))}

											{/* Collapse button at bottom */}
											<button
												type="button"
												onClick={() => toggleExpand(group.key)}
												className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-2xl border border-ry-gold/20 text-xs font-bold text-ry-maroon dark:text-ry-gold hover:bg-ry-gold/5 transition-colors active:scale-[0.98]"
											>
												<ChevronUp size={13} />
												{isHindi ? "बंद करें" : "Collapse"}
											</button>
										</div>
									)}
								</article>
							);
						})}

						{/* Footer ornament */}
						<div className="flex items-center gap-3 py-4 px-2">
							<div className="h-px flex-1 bg-ry-gold/20" />
							<Heart
								size={12}
								className="text-ry-maroon/40 dark:text-ry-gold/40"
							/>
							<div className="h-px flex-1 bg-ry-gold/20" />
						</div>
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
};

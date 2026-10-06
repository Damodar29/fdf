import {
	BarChart2,
	Check,
	ChevronDown,
	ChevronUp,
	ListMusic,
	Plus,
	Search,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAudio } from "../context/AudioContext";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import type { Bhajan, BhajanAudio } from "../types";
import { calculateSearchScore } from "../utils/textProcessor";
import { VoiceSearchButton } from "./VoiceSearchButton";

export const QueueManager: React.FC = () => {
	const {
		queue,
		queueTitle,
		currentTrack,
		isPlaying,
		removeFromQueue,
		clearQueue,
		playQueueTrack,
		addToQueue,
		isQueueOpen,
		setQueueOpen,
	} = useAudio();
	const { bhajans } = useData();
	const { showToast } = useToast();

	const [isAdding, setIsAdding] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedSearchId, setExpandedSearchId] = useState<string | null>(null);

	// History listener for Queue Modal
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (isQueueOpen) {
			const id = `queue-modal-${Date.now()}`;
			window.history.pushState({ isPopup: true, modalId: id }, "");
			const handler = () => setQueueOpen(false);
			window.addEventListener("popstate", handler);
			return () => {
				window.removeEventListener("popstate", handler);
				if (window.history.state?.modalId === id) window.history.back();
			};
		}
	}, [isQueueOpen]);

	// Filtering for "Add Song" feature
	const filteredBhajans = useMemo(() => {
		if (!searchQuery.trim()) return [];
		// Only show bhajans that HAVE audio
		const audioBhajans = bhajans.filter((b) => b.audio && b.audio.length > 0);

		return audioBhajans
			.map((b) => ({
				bhajan: b,
				score: calculateSearchScore(b, searchQuery, "devanagari"),
			}))
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, 20) // Limit results for performance in modal
			.map((item) => item.bhajan);
	}, [bhajans, searchQuery]);

	// Handler for adding a specific track
	const handleAddTrack = (bhajan: Bhajan, track: BhajanAudio) => {
		// Check if already exists to prevent duplicate spamming (optional, but good UX)
		if (queue.some((t) => t.id === track.id)) {
			showToast("Song is already in the queue", "info");
			return;
		}

		const trackToAdd = {
			...track,
			bhajanTitle: bhajan.title, // Ensure title is carried over
			parentBhajan: bhajan,
		};
		addToQueue(trackToAdd);
		showToast(`Added to queue: ${bhajan.title}`, "success");
	};

	const handleClose = () => {
		setQueueOpen(false); // This will trigger cleanup and history.back()
		setIsAdding(false);
		setSearchQuery("");
		setExpandedSearchId(null);
	};

	const toggleExpand = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		setExpandedSearchId((prev) => (prev === id ? null : id));
	};

	// Auto-hide if empty AND not adding AND queue is closed
	if (queue.length === 0 && !isQueueOpen) return null;

	return (
		<>
			{/* Floating Trigger Button (Positioned above tabs/miniplayer) */}
			{!isQueueOpen && (
				<div className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-4 landscape:left-20 z-[70] animate-in fade-in slide-in-from-bottom-4">
					<button
						onClick={() => setQueueOpen(true)}
						className="bg-white dark:bg-slate-800 text-saffron-600 dark:text-saffron-400 p-3 rounded-full shadow-lg border border-saffron-100 dark:border-slate-700 flex items-center justify-center relative hover:scale-105 transition-transform group"
					>
						{isPlaying ? (
							<BarChart2 size={24} className="animate-pulse" />
						) : (
							<ListMusic size={24} />
						)}
						<span className="absolute -top-1 -right-1 bg-saffron-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border border-white dark:border-slate-800">
							{queue.length}
						</span>
					</button>
				</div>
			)}

			{/* Queue Modal */}
			{isQueueOpen &&
				createPortal(
					<div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in fade-in">
						<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[75vh] landscape:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300 border border-slate-100 dark:border-slate-800">
							{/* Header */}
							<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
								<div>
									<h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
										{isAdding ? (
											<>
												<Plus size={20} className="text-saffron-500" />
												Add to Queue
											</>
										) : (
											<>
												<ListMusic size={20} className="text-saffron-500" />
												Current Queue
											</>
										)}
									</h3>
									{!isAdding && (
										<p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
											{queueTitle} • {queue.length} tracks
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									{!isAdding && queue.length > 0 && (
										<ClearAllButton
											onClear={() => {
												clearQueue();
												setQueueOpen(false);
											}}
										/>
									)}
									<button
										onClick={handleClose}
										className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
									>
										<X size={20} />
									</button>
								</div>
							</div>

							{/* CONTENT AREA */}

							{isAdding ? (
								// --- ADD SONG MODE ---
								<div className="flex-1 flex flex-col overflow-hidden">
									<div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
										<div className="relative">
											<Search
												className="absolute left-3 top-3 text-slate-400 dark:text-ink-400"
												size={18}
											/>
											<input
												className="w-full bg-slate-100 dark:bg-slate-700 rounded-xl py-2.5 pl-10 pr-10 outline-none text-slate-800 dark:text-white focus:ring-2 focus:ring-saffron-500 transition-all"
												placeholder="Search song to add..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
											/>
											<div className="absolute right-2 top-2 flex items-center gap-1">
												<VoiceSearchButton
													onResult={(text) => setSearchQuery(text)}
												/>
												{searchQuery && (
													<button
														onClick={() => setSearchQuery("")}
														className="p-1 text-slate-400 dark:text-ink-400"
													>
														<X size={16} />
													</button>
												)}
											</div>
										</div>
									</div>

									<div className="flex-1 overflow-y-auto p-0 scroll-container bg-slate-50 dark:bg-slate-900/50">
										{searchQuery ? (
											filteredBhajans.length > 0 ? (
												<ul className="divide-y divide-slate-100 dark:divide-slate-800">
													{filteredBhajans.map((bhajan) => {
														const hasMultiple =
															bhajan.audio && bhajan.audio.length > 1;
														const isExpanded = expandedSearchId === bhajan.id;

														const firstTrackInQueue = bhajan.audio?.[0]
															? queue.some((t) => t.id === bhajan.audio?.[0].id)
															: false;

														return (
															<li
																key={bhajan.id}
																className="bg-white dark:bg-slate-800"
															>
																<div
																	className={`w-full flex items-center justify-between p-3 hover:bg-saffron-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${isExpanded ? "bg-saffron-50 dark:bg-slate-700/50" : ""}`}
																	onClick={
																		hasMultiple
																			? (e) => toggleExpand(e, bhajan.id)
																			: () =>
																					handleAddTrack(
																						bhajan,
																						bhajan.audio?.[0],
																					)
																	}
																>
																	<div className="flex-1 min-w-0">
																		<div className="font-bold text-slate-800 dark:text-white text-sm">
																			{bhajan.title}
																		</div>
																		<div className="text-xs text-slate-500 dark:text-ink-300 flex items-center gap-1">
																			{hasMultiple ? (
																				<span>
																					{bhajan.audio?.length} Versions
																				</span>
																			) : (
																				<span>{bhajan.audio?.[0]?.singer}</span>
																			)}
																		</div>
																	</div>

																	<div className="flex items-center gap-2">
																		{hasMultiple ? (
																			<div className="p-2 text-slate-400 dark:text-ink-400">
																				{isExpanded ? (
																					<ChevronUp size={20} />
																				) : (
																					<ChevronDown size={20} />
																				)}
																			</div>
																		) : (
																			<button
																				className={`p-2 rounded-full transition-colors ${firstTrackInQueue ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-saffron-100 dark:bg-slate-700 text-saffron-600 dark:text-saffron-400 hover:bg-saffron-200"}`}
																			>
																				{firstTrackInQueue ? (
																					<Check size={18} />
																				) : (
																					<Plus size={18} />
																				)}
																			</button>
																		)}
																	</div>
																</div>

																{/* Expanded Tracks List */}
																{hasMultiple && isExpanded && (
																	<ul className="bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pl-4 py-1">
																		{bhajan.audio?.map((track, tIdx) => {
																			const isTrackInQueue = queue.some(
																				(t) => t.id === track.id,
																			);

																			return (
																				<li
																					key={`${bhajan.id}-t-${tIdx}`}
																					className="border-b border-slate-100 dark:border-slate-800 last:border-0 pr-3"
																				>
																					<button
																						onClick={() =>
																							handleAddTrack(bhajan, track)
																						}
																						className="w-full text-left py-2 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group rounded-lg px-2 my-1"
																					>
																						<div className="flex items-center gap-3 overflow-hidden">
																							<div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-ink-300 shrink-0">
																								<span className="text-[10px] font-bold">
																									{tIdx + 1}
																								</span>
																							</div>
																							<span className="text-sm text-slate-600 dark:text-slate-300 truncate font-medium">
																								{track.singer}
																							</span>
																						</div>
																						<div
																							className={`p-1.5 rounded-full transition-colors ${isTrackInQueue ? "text-green-500 bg-green-50 dark:bg-green-900/20" : "text-slate-400 dark:text-ink-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-saffron-300 group-hover:text-saffron-500"}`}
																						>
																							{isTrackInQueue ? (
																								<Check size={14} />
																							) : (
																								<Plus size={14} />
																							)}
																						</div>
																					</button>
																				</li>
																			);
																		})}
																	</ul>
																)}
															</li>
														);
													})}
												</ul>
											) : (
												<div className="p-8 text-center text-slate-400 dark:text-ink-400">
													No songs found
												</div>
											)
										) : (
											<div className="p-8 text-center text-slate-400 dark:text-ink-400 flex flex-col items-center">
												<Search size={32} className="mb-2 opacity-20" />
												<p className="text-sm">
													Type to search for songs to add
												</p>
												<button
													onClick={() => setIsAdding(false)}
													className="mt-4 text-xs font-bold text-saffron-600"
												>
													Back to Queue
												</button>
											</div>
										)}
									</div>
								</div>
							) : (
								// --- LIST MODE ---
								<div className="flex-1 flex flex-col overflow-hidden">
									<div className="flex-1 overflow-y-auto p-0 scroll-container">
										<ul className="divide-y divide-slate-100 dark:divide-slate-800">
											{queue.map((track, idx) => {
												const isActive = currentTrack?.id === track.id;
												return (
													<li
														key={`${track.id}-${idx}`}
														className={`flex items-center justify-between p-3 pl-4 transition-colors ${isActive ? "bg-saffron-50 dark:bg-slate-800/80" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"}`}
													>
														<button
															onClick={() => playQueueTrack(idx)}
															className="flex-1 flex items-center gap-3 text-left min-w-0"
														>
															<div
																className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isActive ? "bg-saffron-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-ink-400"}`}
															>
																{isActive && isPlaying ? (
																	<BarChart2
																		size={14}
																		className="animate-pulse"
																	/>
																) : (
																	<span className="text-xs font-bold font-mono">
																		{idx + 1}
																	</span>
																)}
															</div>
															<div className="min-w-0">
																<h4
																	className={`text-sm font-bold truncate leading-tight ${isActive ? "text-saffron-700 dark:text-saffron-400" : "text-slate-800 dark:text-slate-200"}`}
																>
																	{track.bhajanTitle ||
																		track.parentBhajan?.title ||
																		"Unknown Title"}
																</h4>
																<p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
																	{track.singer || "Unknown Singer"}
																</p>
															</div>
														</button>

														<button
															onClick={(e) => {
																e.stopPropagation();
																removeFromQueue(track.id);
															}}
															className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors ml-2"
														>
															<X size={16} />
														</button>
													</li>
												);
											})}
										</ul>
									</div>

									{/* Persistent Add Button at bottom of list */}
									<div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
										<button
											onClick={() => setIsAdding(true)}
											className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors hover:border-saffron-300 hover:text-saffron-600"
										>
											<Plus size={18} /> Add More Songs
										</button>
									</div>
								</div>
							)}
						</div>
					</div>,
					document.body,
				)}
		</>
	);
};

const ClearAllButton: React.FC<{ onClear: () => void }> = ({ onClear }) => {
	const [confirming, setConfirming] = useState(false);

	useEffect(() => {
		if (confirming) {
			const timer = setTimeout(() => setConfirming(false), 3000);
			return () => clearTimeout(timer);
		}
	}, [confirming]);

	const handleClick = () => {
		if (confirming) {
			onClear();
			setConfirming(false);
		} else {
			setConfirming(true);
		}
	};

	return (
		<button
			onClick={handleClick}
			className={`p-2 rounded-full transition-all active:scale-95 flex items-center gap-2 ${confirming ? "bg-red-500 text-white px-3" : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"}`}
			title={confirming ? "Confirm Clear" : "Clear Queue"}
		>
			{confirming ? (
				<span className="text-xs font-bold whitespace-nowrap">Clear All?</span>
			) : (
				<Trash2 size={18} />
			)}
		</button>
	);
};

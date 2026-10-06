import { Capacitor } from "@capacitor/core";
import {
	Calendar,
	ChevronDown,
	ChevronUp,
	Download,
	Mic,
	Music,
	Play,
	SearchX,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BhajanAudio, DownloadItem, LectureData } from "../types";
import { type AudioCategory, deleteTrack } from "../utils/audioStorage";
import { HighlightText } from "./HighlightText";

interface LectureListProps {
	items: LectureData[];
	type: "katha" | "kirtan";
	onSelect: (
		lecture: LectureData,
		track?: BhajanAudio,
		contextQueue?: BhajanAudio[],
	) => void;
	searchQuery?: string;
	activeDownloads?: Record<string, DownloadItem>;
	onDownloadTrack?: (
		track: BhajanAudio,
		title: string,
		category?: AudioCategory,
	) => void;
	settingsLanguage: "en" | "hi";
	category?: AudioCategory;
	onRetrySync?: () => void;
	isSyncing?: boolean;
}

export const LectureList: React.FC<LectureListProps> = ({
	items,
	type,
	onSelect,
	searchQuery = "",
	activeDownloads = {},
	onDownloadTrack,
	settingsLanguage,
	category = "audio",
	onRetrySync,
	isSyncing,
}) => {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [downloadedTracks, setDownloadedTracks] = useState<string[]>([]);
	const isIOSWeb =
		typeof window !== "undefined" &&
		Capacitor.getPlatform() === "web" &&
		(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
			(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

	// Translations
	const t = {
		en: {
			noKatha: "No katha found",
			noKirtan: "No kirtans found",
			trySearch: "Try a different search term",
			tracks: "Tracks",
			audioTrack: "Audio Track",
			download: "Download Audio",
		},
		hi: {
			noKatha: "कोई कथा नहीं मिली",
			noKirtan: "कोई कीर्तन नहीं मिला",
			trySearch: "कोई अन्य शब्द खोजें",
			tracks: "ट्रैक",
			audioTrack: "ऑडियो ट्रैक",
			download: "ऑडियो डाउनलोड करें",
		},
	}[settingsLanguage];

	const emptyText = type === "katha" ? t.noKatha : t.noKirtan;

	// Refresh downloads helper
	const refreshDownloads = () => {
		try {
			const ids = JSON.parse(
				localStorage.getItem("cpbs_downloaded_tracks") || "[]",
			);
			setDownloadedTracks(ids);
		} catch {}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshDownloads is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		refreshDownloads();
		window.addEventListener("storage", refreshDownloads);
		return () => window.removeEventListener("storage", refreshDownloads);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const scrollContainer = document.querySelector(".scroll-container");
		if (scrollContainer) {
			scrollContainer.scrollTo({ top: 0, behavior: "auto" });
		}
	}, [searchQuery]);

	const handleDownloadClick = useCallback(
		(e: React.MouseEvent, track: BhajanAudio, title: string) => {
			e.stopPropagation();
			if (onDownloadTrack) {
				onDownloadTrack(track, title, category);
			}
		},
		[onDownloadTrack, category],
	);

	const handleDeleteTrack = useCallback(
		async (track: BhajanAudio) => {
			// Optimistic Update
			setDownloadedTracks((prev) => prev.filter((id) => id !== track.id));
			await deleteTrack(track.id, track.url, category);
			setTimeout(refreshDownloads, 100);
		},
		[category, refreshDownloads],
	);

	const toggleExpand = useCallback((e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		setExpandedId((prev) => (prev === id ? null : id));
	}, []);

	const filteredItems = useMemo(() => {
		if (!searchQuery.trim()) return items;
		const q = searchQuery.toLowerCase();
		return items.filter(
			(item) =>
				item.title.toLowerCase().includes(q) ||
				item.date?.toLowerCase().includes(q),
		);
	}, [items, searchQuery]);

	return (
		<div className="pb-2 pt-2">
			{items.length === 0 ? (
				<div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 dark:text-ink-400 p-8 text-center animate-fade-in-up">
					<div className="relative mb-4">
						<SearchX className="w-16 h-16 opacity-30 text-ry-gold" />
						{isSyncing && (
							<div className="absolute inset-[-8px] rounded-full border-2 border-ry-gold border-t-transparent animate-spin" />
						)}
					</div>
					<p className="text-lg font-medium">
						{isSyncing
							? settingsLanguage === "hi"
								? type === "katha"
									? "कथा लोड हो रही है..."
									: "कीर्तन लोड हो रहे हैं..."
								: type === "katha"
									? "Loading Katha..."
									: "Loading Kirtans..."
							: emptyText}
					</p>
					{searchQuery ? (
						<p className="text-sm opacity-70 mt-2">{t.trySearch}</p>
					) : !isSyncing && onRetrySync ? (
						<button
							onClick={() => void onRetrySync()}
							className="mt-6 rounded-full bg-ry-gold px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-gold-700 transition-colors flex items-center gap-2"
						>
							<Download size={18} />
							{settingsLanguage === "hi"
								? type === "katha"
									? "कथा Fetch करें"
									: "कीर्तन Fetch करें"
								: type === "katha"
									? "Fetch Katha"
									: "Fetch Kirtans"}
						</button>
					) : null}
				</div>
			) : (
				<div className="px-2 space-y-2">
					{filteredItems.map((item, index) => {
						const delayStyle = {
							animationDelay: `${Math.min(index * 40, 600)}ms`,
						};
						const isExpanded = expandedId === item.id;
						const hasAudio = item.audio && item.audio.length > 0;

						return (
							<div
								key={item.id}
								className="animate-fade-in-up opacity-0 fill-mode-forwards"
								style={delayStyle}
							>
								{/* Expanded Card background */}
								<div
									className={`rounded-2xl transition-all duration-300 border ${isExpanded ? "bg-saffron-50/50 dark:bg-slate-800 border-saffron-100 shadow-md" : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
								>
									<button
										onClick={(_e) => {
											const contextQueue =
												item.audio?.map((t) => ({
													...t,
													bhajanTitle: item.title,
													parentBhajan: undefined,
												})) || [];
											onSelect(item, undefined, contextQueue);
										}}
										className="w-full text-left p-4 flex items-center gap-4 group"
									>
										{/* Icon Container */}
										<div
											className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors shrink-0 ${isExpanded ? "bg-saffron-100 dark:bg-slate-700 text-saffron-600 border-saffron-200" : "bg-slate-100 dark:bg-slate-800 text-saffron-500 dark:text-saffron-400 border-transparent group-hover:bg-saffron-50 group-hover:text-saffron-600 dark:group-hover:text-saffron-300"}`}
										>
											{type === "katha" ? (
												<Mic size={18} />
											) : (
												<Music size={18} />
											)}
										</div>

										<div className="flex-1 min-w-0">
											{/* Title */}
											<h3
												className={`font-bold text-[13px] leading-snug transition-colors ${isExpanded ? "text-saffron-600" : "text-slate-700 dark:text-slate-200 group-hover:text-saffron-600"}`}
											>
												<HighlightText
													text={item.title}
													highlight={searchQuery}
												/>
											</h3>
											<div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
												{item.date && item.date !== "Kirtan" && (
													<span className="flex items-center gap-1">
														<Calendar size={12} className="text-saffron-500" />{" "}
														<HighlightText
															text={item.date}
															highlight={searchQuery}
														/>
													</span>
												)}
												{/* Tracks count badge */}
												<span className="truncate bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
													{item.audio?.length || 0} {t.tracks}
												</span>
											</div>
										</div>

										<div className="flex items-center gap-1">
											{hasAudio && (
												<div
													onClick={(e) => {
														e.stopPropagation();
														toggleExpand(e, item.id);
													}}
													className={`h-10 w-10 flex items-center justify-center rounded-full transition-all active:scale-95 z-10 shrink-0 ${isExpanded ? "bg-saffron-100 text-saffron-600 dark:bg-slate-700" : "text-slate-400 dark:text-ink-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
												>
													{isExpanded ? (
														<ChevronUp size={20} />
													) : (
														<ChevronDown size={20} />
													)}
												</div>
											)}
										</div>
									</button>

									{/* Expanded Track List */}
									{isExpanded && hasAudio && (
										<div className="px-4 pb-4 pt-0 animate-fade-in">
											{/* Sub-list background */}
											<div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 space-y-1">
												{item.audio?.map((track) => {
													const isDownloaded = downloadedTracks.includes(
														track.id,
													);
													const downloadItem = activeDownloads[track.id];
													const isDownloading = downloadItem !== undefined;
													const progress = downloadItem?.progress || 0;

													return (
														<div
															key={track.id}
															onClick={(e) => {
																e.stopPropagation();
																const contextQueue =
																	item.audio?.map((t) => ({
																		...t,
																		bhajanTitle: item.title,
																		parentBhajan: undefined,
																	})) || [];

																const trackWithMeta = {
																	...track,
																	bhajanTitle: item.title,
																	parentBhajan: undefined,
																};

																onSelect(item, trackWithMeta, contextQueue);
															}}
															className="flex items-center justify-between p-3 rounded-lg hover:bg-white dark:hover:bg-slate-800 active:bg-white dark:active:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm cursor-pointer group/track"
														>
															<div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
																{/* Track Icon */}
																<div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-ink-400 shrink-0 group-hover/track:bg-saffron-50 dark:group-hover/track:bg-slate-600 group-hover/track:text-saffron-600 transition-colors">
																	<Music size={14} />
																</div>
																<div className="flex-1 min-w-0">
																	<p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate group-hover/track:text-saffron-600 transition-colors">
																		{track.singer || t.audioTrack}
																	</p>
																</div>
															</div>

															<div className="flex items-center gap-2 shrink-0">
																{/* Play Button */}
																<button
																	onClick={(e) => {
																		e.stopPropagation();
																		const contextQueue =
																			item.audio?.map((t) => ({
																				...t,
																				bhajanTitle: item.title,
																				parentBhajan: undefined,
																			})) || [];

																		const trackWithMeta = {
																			...track,
																			bhajanTitle: item.title,
																			parentBhajan: undefined,
																		};

																		onSelect(item, trackWithMeta, contextQueue);
																	}}
																	className="p-2 text-slate-400 dark:text-ink-400 hover:text-saffron-600 hover:bg-saffron-50 active:bg-saffron-100 rounded-full dark:hover:bg-slate-700 transition-colors"
																>
																	<Play size={16} fill="currentColor" />
																</button>

																{isDownloading ? (
																	<div className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-ink-700">
																		<span className="text-[9px] font-bold text-slate-500 dark:text-ink-300">
																			{Math.round(progress)}%
																		</span>
																	</div>
																) : isDownloaded ? (
																	<DeleteButton
																		onConfirm={() => handleDeleteTrack(track)}
																	/>
																) : isIOSWeb ? (
																	<a
																		href={track.url}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="p-2 text-slate-400 dark:text-ink-400 hover:text-saffron-600 flex flex-col items-center justify-center"
																		title="Direct Browser Download (For iOS)"
																	>
																		<Download size={18} />
																		<span className="text-[8px] font-bold uppercase leading-none mt-0.5">
																			iOS DL
																		</span>
																	</a>
																) : (
																	<button
																		onClick={(e) =>
																			handleDownloadClick(e, track, item.title)
																		}
																		className="p-2 text-slate-400 dark:text-ink-400 hover:text-saffron-600 active:text-saffron-700 transition-colors"
																		title={t.download}
																	>
																		<Download size={18} />
																	</button>
																)}
															</div>
														</div>
													);
												})}
											</div>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

const DeleteButton: React.FC<{ onConfirm: () => void }> = ({ onConfirm }) => {
	const [confirming, setConfirming] = useState(false);

	useEffect(() => {
		if (confirming) {
			const timer = setTimeout(() => setConfirming(false), 3000);
			return () => clearTimeout(timer);
		}
	}, [confirming]);

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		if (confirming) {
			onConfirm();
			setConfirming(false);
		} else {
			setConfirming(true);
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			className={`p-2 rounded-full transition-all active:scale-95 flex items-center gap-2 ${confirming ? "bg-red-500 text-white px-3" : "text-slate-400 dark:text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800"}`}
			title={confirming ? "Click to Confirm Delete" : "Delete"}
		>
			{confirming ? (
				<span className="text-xs font-bold whitespace-nowrap">Confirm?</span>
			) : (
				<Trash2 size={16} />
			)}
		</button>
	);
};

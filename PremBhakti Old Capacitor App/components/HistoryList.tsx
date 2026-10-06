import { BookOpen, History, Mic, Music, SearchX, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useMemo } from "react";
import type {
	Bhajan,
	Book,
	HistoryEntry,
	LectureData,
	ScriptType,
} from "../types";
import {
	calculateBookScore,
	calculateLectureScore,
	calculateSearchScore,
} from "../utils/textProcessor";
import { HighlightText } from "./HighlightText";

interface HistoryListProps {
	historyItems: HistoryEntry[];
	books: Book[];
	lectures: LectureData[];
	bhajans: Bhajan[];
	onClearHistory: () => void;
	onOpenBook: (book: Book) => void;
	onOpenLecture: (lecture: LectureData) => void;
	onOpenBhajan: (bhajan: Bhajan) => void;
	script: ScriptType;
	searchQuery: string;
	settingsLanguage?: "en" | "hi";
}

export const HistoryList: React.FC<HistoryListProps> = ({
	historyItems,
	books,
	lectures,
	bhajans,
	onClearHistory,
	onOpenBook,
	onOpenLecture,
	onOpenBhajan,
	script,
	searchQuery,
	settingsLanguage = "en",
}) => {
	const t = {
		recent: settingsLanguage === "hi" ? "हाल की गतिविधि" : "Recent Activity",
		searchResults: settingsLanguage === "hi" ? "खोज परिणाम" : "Search Results",
		clear: settingsLanguage === "hi" ? "इतिहास मिटाएं" : "Clear History",
		noHistory:
			settingsLanguage === "hi" ? "कोई हालिया इतिहास नहीं" : "No recent history",
		noMatch:
			settingsLanguage === "hi"
				? "कोई मिलान नहीं मिला"
				: "No matching history found",
		tracks: settingsLanguage === "hi" ? "ट्रैक" : "Tracks",
	};

	const filteredHistory = useMemo(() => {
		if (!searchQuery.trim()) return historyItems;

		return historyItems.filter((item) => {
			if (item.type === "book") {
				const book = books.find((b) => b.id === item.id);
				return book && calculateBookScore(book, searchQuery) > 0;
			} else if (item.type === "lecture") {
				const lecture = lectures.find((l) => l.id === item.id);
				return lecture && calculateLectureScore(lecture, searchQuery) > 0;
			} else {
				// song
				const bhajan = bhajans.find((b) => b.id === item.id);
				return bhajan && calculateSearchScore(bhajan, searchQuery, script) > 0;
			}
		});
	}, [historyItems, books, lectures, bhajans, searchQuery, script]);

	const handleOpenBook = useCallback(
		(book: Parameters<typeof onOpenBook>[0]) => onOpenBook(book),
		[onOpenBook],
	);
	const _handleOpenLecture = useCallback(
		(lecture: Parameters<typeof onOpenLecture>[0]) => onOpenLecture(lecture),
		[onOpenLecture],
	);
	const _handleOpenBhajan = useCallback(
		(bhajan: Parameters<typeof onOpenBhajan>[0]) => onOpenBhajan(bhajan),
		[onOpenBhajan],
	);

	if (historyItems.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 dark:text-ink-400 p-8 text-center animate-fade-in-up">
				<History size={48} className="mb-4 opacity-50" />
				<p className="text-lg font-medium">{t.noHistory}</p>
			</div>
		);
	}

	if (filteredHistory.length === 0 && searchQuery.trim()) {
		return (
			<div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 dark:text-ink-400 p-8 text-center animate-fade-in-up">
				<SearchX className="w-16 h-16 opacity-30 mb-4" />
				<p className="text-lg font-medium">{t.noMatch}</p>
			</div>
		);
	}

	return (
		<div className="min-h-full pb-4 bg-transparent">
			<div className="flex items-center justify-between px-4 py-3 bg-transparent backdrop-blur-md sticky top-0 border-b dark:border-slate-800 z-10">
				<span className="text-xs font-bold uppercase text-slate-500 dark:text-ink-300">
					{searchQuery ? t.searchResults : t.recent}
				</span>
				{!searchQuery && (
					<button
						onClick={onClearHistory}
						data-tour="library-clear"
						className="text-xs text-red-500 flex items-center gap-1 font-bold active:scale-95 transition-transform"
					>
						<Trash2 size={12} /> {t.clear}
					</button>
				)}
			</div>
			<ul
				className="divide-y divide-slate-100 dark:divide-slate-800"
				data-tour="library-history"
			>
				{filteredHistory.map((item, idx) => {
					// Determine component for animation delay
					const delayStyle = { animationDelay: `${idx * 40}ms` };

					if (item.type === "book") {
						const book = books.find((b) => b.id === item.id);
						if (!book) return null;
						return (
							<li
								key={`${item.id}-${idx}`}
								className="animate-fade-in-up opacity-0 fill-mode-forwards"
								style={delayStyle}
							>
								<button
									onClick={() => handleOpenBook(book)}
									className="w-full text-left p-4 flex items-center gap-4 active:bg-transparent dark:active:bg-transparent hover:bg-slate-50/10 dark:hover:bg-slate-800/50 transition-colors group"
								>
									<div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-saffron-600 dark:text-saffron-400 shrink-0">
										<BookOpen size={20} />
									</div>
									<div className="min-w-0 flex-1">
										<div className="font-bold truncate text-slate-800 dark:text-slate-200 text-base group-hover:text-saffron-700 dark:group-hover:text-saffron-400 transition-colors">
											<HighlightText
												text={book.title}
												highlight={searchQuery}
											/>
										</div>
										<div className="text-xs text-slate-500 dark:text-slate-500 truncate">
											<HighlightText
												text={book.fileName}
												highlight={searchQuery}
											/>
										</div>
									</div>
								</button>
							</li>
						);
					} else if (item.type === "lecture") {
						const lecture = lectures.find((l) => l.id === item.id);
						if (!lecture) return null;
						return (
							<li
								key={`${item.id}-${idx}`}
								className="animate-fade-in-up opacity-0 fill-mode-forwards"
								style={delayStyle}
							>
								<button
									onClick={() => onOpenLecture(lecture)}
									className="w-full text-left p-4 flex items-center gap-4 active:bg-transparent dark:active:bg-transparent hover:bg-slate-50/10 dark:hover:bg-slate-800/50 transition-colors group"
								>
									<div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-saffron-600 dark:text-saffron-400 shrink-0">
										<Mic size={20} />
									</div>
									<div className="min-w-0 flex-1">
										<div className="font-bold truncate text-slate-800 dark:text-slate-200 text-base group-hover:text-saffron-700 dark:group-hover:text-saffron-400 transition-colors">
											<HighlightText
												text={lecture.title}
												highlight={searchQuery}
											/>
										</div>
										<div className="text-xs text-slate-500 dark:text-slate-500 truncate">
											<HighlightText
												text={
													lecture.date ||
													`${lecture.audio?.length || 0} ${t.tracks}`
												}
												highlight={searchQuery}
											/>
										</div>
									</div>
								</button>
							</li>
						);
					} else {
						const b = bhajans.find((bh) => bh.id === item.id);
						if (!b) return null;
						return (
							<li
								key={`${item.id}-${idx}`}
								className="animate-fade-in-up opacity-0 fill-mode-forwards"
								style={delayStyle}
							>
								<button
									onClick={() => onOpenBhajan(b)}
									className="w-full text-left p-4 flex items-center gap-4 active:bg-transparent dark:active:bg-transparent hover:bg-slate-50/10 dark:hover:bg-slate-800/50 transition-colors group"
								>
									<div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-saffron-600 dark:text-saffron-400 shrink-0">
										<Music size={20} />
									</div>
									<div className="min-w-0 flex-1">
										<div className="font-bold truncate text-slate-800 dark:text-slate-200 text-base group-hover:text-saffron-700 dark:group-hover:text-saffron-400 transition-colors">
											<HighlightText
												text={script === "iast" ? b.titleIAST : b.title}
												highlight={searchQuery}
											/>
										</div>
										<div className="text-xs text-slate-500 dark:text-slate-500 truncate">
											<HighlightText
												text={script === "iast" ? b.firstLineIAST : b.firstLine}
												highlight={searchQuery}
											/>
										</div>
									</div>
								</button>
							</li>
						);
					}
				})}
			</ul>
		</div>
	);
};

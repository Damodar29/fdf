import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
	BookOpen,
	Check,
	Download,
	ExternalLink,
	Loader2,
	Search,
	SearchX,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "../context/ToastContext";
import { usePopupBackHandler } from "../src/hooks/usePopupBackHandler";
import type { Book, DownloadItem } from "../types";
import {
	getDownloadedBookIds,
	openDownloadedBook,
	reconcileDownloadedBooks,
} from "../utils/bookStorage";
import { NativeDownload } from "../utils/nativeDownload";
import { HighlightText } from "./HighlightText";
import { VoiceSearchButton } from "./VoiceSearchButton";

interface BookListProps {
	books: Book[];
	onSelect: (book: Book, openedNatively?: boolean) => void;
	searchQuery?: string;
	rawSearchQuery?: string;
	onSearchChange?: (query: string) => void;
	activeDownloads?: Record<string, DownloadItem>;
	onDownload?: (book: Book) => void;
	onCancelDownload?: (bookId: string) => void;
	settingsLanguage?: "en" | "hi";
	isSyncing?: boolean;
	syncProgress?: {
		progress: number;
		detail: string;
		step?: string;
		isSyncing?: boolean;
	};
	onRetrySync?: () => Promise<boolean>;
}

const MODAL_VIEW = "book-action-modal";
const isAndroid = Capacitor.getPlatform() === "android";

// Utility to format bytes
const formatBytes = (bytes: number) => {
	if (!bytes || bytes < 0 || !Number.isFinite(bytes)) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.min(
		Math.floor(Math.log(bytes) / Math.log(k)),
		sizes.length - 1,
	);
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

export const BookList: React.FC<BookListProps> = ({
	books,
	onSelect,
	searchQuery = "",
	rawSearchQuery = "",
	onSearchChange,
	activeDownloads = {},
	onDownload,
	onCancelDownload,
	settingsLanguage = "en",
	isSyncing = false,
	syncProgress,
	onRetrySync,
}) => {
	const { showToast } = useToast();
	const [pendingBook, setPendingBook] = useState<Book | null>(null);
	const [downloadedIds, setDownloadedIds] = useState<string[]>(() =>
		getDownloadedBookIds(),
	);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	// Which book is mid-open, so its button shows a spinner and ignores double taps.
	const [openingBookId, setOpeningBookId] = useState<string | null>(null);
	// Re-download needs a confirmation step
	const [redownloadConfirmId, setRedownloadConfirmId] = useState<string | null>(
		null,
	);
	const hasSyncError = syncProgress?.step === "error";
	const hi = settingsLanguage === "hi";

	// Translations
	const t = {
		noBooks: hi ? "कोई किताब नहीं मिली" : "No books found",
		trySearch: hi ? "कोई अन्य शब्द खोजें" : "Try a different search term",
		headerTitle: hi ? "ग्रंथ और साहित्य" : "Books & Literature",
		headerDesc: hi
			? "किताब डाउनलोड करें और बिना इंटरनेट के कभी भी पढ़ें।"
			: "Download books to your phone and read anytime, even without internet.",
		offline: hi ? "ऑफलाइन" : "Offline",
		openBook: hi ? "किताब खोलें" : "Open Book",
		downloadRequired: hi ? "डाउनलोड आवश्यक" : "Download Required",
		downloadingTitle: hi ? "डाउनलोड हो रही है" : "Downloading",
		downloadedMsg: hi
			? "डाउनलोड हो चुकी है, ऑफलाइन पढ़ें।"
			: "is downloaded and ready to read offline.",
		mustDownload: hi
			? "इसे पढ़ने के लिए डाउनलोड करना आवश्यक है।"
			: "You must download this to read it.",
		size: hi ? "साइज़:" : "Size:",
		cancel: hi ? "रद्द करें" : "Cancel",
		readNow: hi ? "अभी पढ़ें" : "Read Now",
		readTitle: hi ? "किताब पढ़ें" : "Read Book",
		downloadTitle: hi ? "डाउनलोड करें" : "Download to Read",
		downloadApp: hi ? "ऐप में डाउनलोड करें" : "Download in App",
		cancelDownload: hi ? "डाउनलोड रोकें" : "Cancel Download",
		openBrowser: hi ? "ब्राउज़र में खोलें" : "Open in Browser",
		openBrowserNote: hi ? "(ऐप में सेव नहीं होगी)" : "(won't save to app)",
		fileMissing: hi
			? "किताब की फ़ाइल नहीं मिली, कृपया फिर से डाउनलोड करें।"
			: "Book file not found. Please download it again.",
		noViewer: hi
			? "फ़ोन में PDF ऐप नहीं मिला, ऐप के रीडर में खोल रहे हैं..."
			: "No PDF app found, opening in the built-in reader...",
	};

	useEffect(() => {
		const refresh = () => setDownloadedIds(getDownloadedBookIds());
		refresh();
		window.addEventListener("storage", refresh);
		// Pick up downloads that finished while the app was in the background, clean
		// partial files, and run the one-time migration of the old public books
		// folder (may ask for storage permission on Android ≤ 9 — in context here).
		void reconcileDownloadedBooks({ allowPermissionPrompt: true });
		return () => window.removeEventListener("storage", refresh);
	}, []);

	useEffect(() => {
		const scrollContainer = document.querySelector(".scroll-container");
		if (scrollContainer) {
			scrollContainer.scrollTo({ top: 0, behavior: "auto" });
		}
	}, []);

	// Hardware back closes the modal; UI close pops its history entry (no stale
	// entries that need an extra back press later).
	const closeModal = usePopupBackHandler(!!pendingBook, MODAL_VIEW, () => {
		setPendingBook(null);
		setRedownloadConfirmId(null);
	});

	/**
	 * Closes the modal and runs `fn` once its history entry is really gone.
	 * `history.back()` is async: pushing the reader / confirm-dialog entry before
	 * it lands would let the late pop close that new screen instead.
	 */
	const afterModalClosed = (fn: () => void) => {
		if (window.history.state?.view !== MODAL_VIEW) {
			closeModal();
			fn();
			return;
		}
		let ran = false;
		const run = () => {
			if (ran) return;
			ran = true;
			window.removeEventListener("popstate", run);
			clearTimeout(timer);
			fn();
		};
		const timer = setTimeout(run, 600);
		window.addEventListener("popstate", run);
		closeModal();
	};

	const startDownload = (book: Book) => {
		afterModalClosed(() => onDownload?.(book));
	};

	const openExternalLink = (url: string) => {
		closeModal();
		showToast(
			hi
				? "ब्राउज़र में किताब खुल रही है, बड़े साइज़ के कारण थोड़ा समय लग सकता है..."
				: "Opening in browser. Large books may take a moment to load...",
			"info",
		);
		const downloadUrl = url.includes("?")
			? `${url}&download=1`
			: `${url}?download=1`;
		const open = isAndroid
			? NativeDownload.openExternalUrl({ url: downloadUrl })
			: Capacitor.isNativePlatform()
				? Browser.open({ url: downloadUrl, presentationStyle: "popover" })
				: Promise.resolve(
						void window.open(downloadUrl, "_blank", "noopener,noreferrer"),
					);
		open.catch((e) => {
			console.error("Failed to open external link:", e);
			showToast(
				hi ? "ब्राउज़र नहीं खुल पाया।" : "Could not open the browser.",
				"error",
			);
		});
	};

	/** Opens a downloaded book: system PDF app on Android, in-app reader elsewhere. */
	const openBook = async (book: Book) => {
		if (!isAndroid) {
			afterModalClosed(() => onSelect(book));
			return;
		}
		if (openingBookId) return;
		setOpeningBookId(book.id);
		try {
			const result = await openDownloadedBook(book);
			if (result === "opened") {
				closeModal();
				onSelect(book, true);
			} else if (result === "not_found") {
				// Registry entry was dropped; the modal now offers a fresh download.
				showToast(t.fileMissing, "error");
				setPendingBook(book);
			} else {
				// No PDF app / open failed — the file is fine, never delete it.
				if (result === "no_viewer") showToast(t.noViewer, "info");
				afterModalClosed(() => onSelect(book));
			}
		} finally {
			setOpeningBookId(null);
		}
	};

	const pendingIsDownloaded =
		!!pendingBook && downloadedIds.includes(pendingBook.id);
	const pendingDownload = pendingBook
		? activeDownloads[pendingBook.id]
		: undefined;
	const pendingUrl = pendingBook?.url;

	return (
		<>
			{/* Search Bar Header (Sticky) */}
			{(isSearchOpen || rawSearchQuery.trim().length > 0) && (
				<div className="sticky z-30 bg-ry-cream/95 dark:bg-slate-900/95 backdrop-blur-md py-2 px-4 border-b border-ry-gold/20 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 top-0 landscape:!top-0">
					<Search className="shrink-0 text-ry-gold" size={20} />
					<input
						className="flex-1 min-w-0 bg-transparent outline-none py-2 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
						placeholder={hi ? "खोजें (Hinglish).." : "Search (Hinglish)..."}
						value={rawSearchQuery}
						onChange={(e) => onSearchChange?.(e.target.value)}
					/>
					<VoiceSearchButton onResult={(text) => onSearchChange?.(text)} />
					<button
						aria-label="Close search"
						type="button"
						onClick={() => {
							onSearchChange?.("");
							setIsSearchOpen(false);
						}}
						className="shrink-0 p-2 text-slate-400 dark:text-ink-400 hover:text-red-500 transition-colors"
					>
						<X size={20} />
					</button>
				</div>
			)}

			{/* Floating Search Button */}
			{!rawSearchQuery.trim() && !isSearchOpen && (
				<div className="sticky z-20 flex justify-end h-0 overflow-visible pointer-events-none px-4 top-0 landscape:!top-0 landscape:items-start landscape:px-6">
					<div className="py-2 pointer-events-auto flex items-center gap-2 mt-2 landscape:mt-6">
						<button
							aria-label="Search"
							type="button"
							data-tour="books-search"
							onClick={() => setIsSearchOpen(true)}
							className="p-2 rounded-full text-ry-gold/80 hover:text-ry-gold hover:bg-ry-gold/10 transition-colors bg-ry-cream/90 dark:bg-slate-900/90 shadow-sm border border-ry-gold/20 backdrop-blur-sm"
						>
							<Search size={20} />
						</button>
					</div>
				</div>
			)}

			{/* Syncing banner — has data but updating */}
			{isSyncing && books.length > 0 && (
				<div className="px-4 py-2.5 mx-2 mt-3 mb-1 bg-ry-gold/10 border border-ry-gold/30 rounded-xl">
					<div className="flex items-center gap-3">
						<div className="w-4 h-4 rounded-full border-2 border-ry-gold border-t-transparent animate-spin shrink-0" />
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between gap-3">
								<span className="text-xs font-bold text-ry-gold">
									{hi
										? "☁️ पुस्तकें बैकग्राउंड में अपडेट हो रही हैं"
										: "☁️ Books are syncing in background"}
								</span>
								<span className="text-xs font-black text-ry-gold">
									{Math.round(syncProgress?.progress || 0)}%
								</span>
							</div>
							<div className="mt-1 h-1.5 w-full bg-white/60 dark:bg-slate-800 rounded-full overflow-hidden">
								<div
									className="h-full bg-ry-gold transition-all duration-300"
									style={{
										width: `${Math.max(8, syncProgress?.progress || 0)}%`,
									}}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{hasSyncError && books.length > 0 && (
				<div className="mx-2 mt-3 mb-1 rounded-xl border border-red-200 bg-red-50/90 dark:bg-red-900/20 dark:border-red-800 px-4 py-3">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-bold text-red-700 dark:text-red-300">
								{hi
									? "पुस्तक सूची लोड करने में दिक्कत आई"
									: "Book list had trouble loading"}
							</p>
							<p className="mt-1 text-xs text-red-600 dark:text-red-400">
								{syncProgress?.detail ||
									(hi
										? "कृपया Fetch बटन दबाकर फिर प्रयास करें।"
										: "Please tap Fetch and try again.")}
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								void onRetrySync?.();
							}}
							className="shrink-0 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
						>
							{hi ? "Fetch करें" : "Fetch"}
						</button>
					</div>
				</div>
			)}

			{/* First-time loading */}
			{isSyncing && books.length === 0 && (
				<div className="flex flex-col items-center justify-center h-[65vh] gap-6 animate-fade-in">
					<div className="relative">
						<div className="w-20 h-20 rounded-full bg-ry-gold/10 border-2 border-ry-gold/30 flex items-center justify-center">
							<BookOpen className="w-9 h-9 text-ry-gold/60" />
						</div>
						<div className="absolute inset-0 rounded-full border-2 border-ry-gold border-t-transparent animate-spin" />
					</div>
					<div className="text-center">
						<p className="font-hindi font-bold text-ry-gold text-lg">
							{hi ? "पुस्तकें लोड हो रही हैं..." : "Loading books..."}
						</p>
						<p className="text-slate-400 dark:text-ink-400 text-sm mt-1">
							{`${Math.round(syncProgress?.progress || 0)}% ${hi ? "पूरा" : "complete"}${syncProgress?.detail ? ` • ${syncProgress.detail}` : ""}`}
						</p>
					</div>
					<div className="flex gap-1.5">
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className="w-2 h-2 rounded-full bg-ry-gold/50 animate-bounce"
								style={{ animationDelay: `${i * 150}ms` }}
							/>
						))}
					</div>
				</div>
			)}

			{/* No internet + no data */}
			{!isSyncing &&
				books.length === 0 &&
				!hasSyncError &&
				!rawSearchQuery.trim() && (
					<div className="flex flex-col items-center justify-center h-[65vh] gap-5 px-8 animate-fade-in">
						<div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
							<BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600" />
						</div>
						<div className="text-center">
							<p className="font-hindi font-bold text-slate-700 dark:text-slate-200 text-lg">
								{hi ? "पुस्तकें उपलब्ध नहीं" : "No Books Available"}
							</p>
							<p className="text-slate-400 dark:text-ink-400 text-sm mt-2 leading-relaxed font-hindi">
								{hi
									? "पुस्तकें लोड करने के लिए इंटरनेट से जोड़ें।"
									: "Connect to internet to load books."}
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								void onRetrySync?.();
							}}
							className="rounded-full bg-ry-gold px-5 py-2.5 text-sm font-bold text-white shadow-sm"
						>
							{hi ? "नवीनतम पुस्तकें Fetch करें" : "Fetch Latest Books"}
						</button>
					</div>
				)}

			{!isSyncing &&
				books.length === 0 &&
				hasSyncError &&
				!rawSearchQuery.trim() && (
					<div className="flex flex-col items-center justify-center h-[65vh] gap-5 px-8 animate-fade-in text-center">
						<div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
							<BookOpen className="w-10 h-10 text-red-300" />
						</div>
						<div>
							<p className="font-hindi font-bold text-slate-700 dark:text-slate-200 text-lg">
								{hi
									? "पुस्तक सूची अभी लोड नहीं हो पाई"
									: "Book list could not load yet"}
							</p>
							<p className="text-slate-400 dark:text-ink-400 text-sm mt-2 leading-relaxed font-hindi">
								{syncProgress?.detail ||
									(hi
										? "कृपया Fetch बटन दबाकर फिर प्रयास करें।"
										: "Please tap Fetch and try again.")}
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								void onRetrySync?.();
							}}
							className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm"
						>
							{hi ? "पुस्तकें Fetch करें" : "Fetch Books"}
						</button>
					</div>
				)}

			{/* No search results */}
			{!isSyncing && books.length === 0 && rawSearchQuery.trim() && (
				<div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 dark:text-ink-400 p-8 text-center animate-fade-in-up">
					<SearchX className="w-16 h-16 opacity-30 mb-4 text-ry-gold" />
					<p className="text-lg font-medium">{t.noBooks}</p>
					<p className="text-sm opacity-70 mt-2">{t.trySearch}</p>
				</div>
			)}

			{books.length > 0 && (
				<div className="pb-2 pt-2 px-2">
					{/* Header Card */}
					<div className="mb-4 bg-saffron-50/50 dark:bg-slate-800 rounded-2xl p-5 pr-14 shadow-sm border border-saffron-200 dark:border-slate-700 relative overflow-hidden">
						{/* Background Texture Overlay */}
						<div
							className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-multiply dark:opacity-10 dark:mix-blend-screen"
							style={{
								backgroundImage:
									"url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
							}}
						/>
						<div className="relative z-10 min-w-0">
							<h2 className="text-lg font-bold text-saffron-600 font-hindi flex items-center gap-2">
								<BookOpen className="w-5 h-5" />
								{t.headerTitle}
							</h2>
							<p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
								{t.headerDesc}
							</p>
						</div>
					</div>

					<div className="space-y-2 landscape:lg:space-y-0 landscape:lg:grid landscape:lg:grid-cols-2 landscape:lg:gap-2">
						{books.map((book, index) => {
							const downloadItem = activeDownloads[book.id];
							const isDownloading = downloadItem !== undefined;
							// A re-download keeps the old copy until the new one is verified,
							// so "downloading" wins over "downloaded" for the row state.
							const isDownloaded =
								!isDownloading && downloadedIds.includes(book.id);
							const progress = Math.min(
								100,
								Math.max(0, downloadItem?.progress || 0),
							);
							const isOpening = openingBookId === book.id;

							return (
								<div
									key={book.id}
									className="animate-fade-in-up opacity-0 fill-mode-forwards"
									style={{ animationDelay: `${Math.min(index, 15) * 40}ms` }}
								>
									{/* List Item Row — the whole row opens the action sheet */}
									{/* biome-ignore lint/a11y/useSemanticElements: a <button> cannot contain the row's own action buttons */}
									<div
										role="button"
										tabIndex={0}
										data-tour="books-item"
										onClick={() => setPendingBook(book)}
										onKeyDown={(e) => {
											if (e.key === "Enter") setPendingBook(book);
										}}
										className="w-full flex items-center p-4 rounded-2xl border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 transition-colors gap-3 group relative cursor-pointer"
									>
										{/* Icon Box */}
										<div
											className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors shrink-0 ${isDownloaded ? "bg-saffron-100 dark:bg-slate-700 text-saffron-600 border-saffron-200 dark:border-slate-600" : "bg-slate-100 dark:bg-slate-800 text-saffron-500 dark:text-saffron-400 border-transparent group-hover:bg-saffron-50 group-hover:text-saffron-600 dark:group-hover:text-saffron-300"}`}
										>
											{isDownloading ? (
												<Loader2
													size={18}
													className="animate-spin text-saffron-500"
												/>
											) : isDownloaded ? (
												<Check size={18} />
											) : (
												<BookOpen size={18} />
											)}
										</div>

										{/* Main Info */}
										<div className="flex-1 min-w-0">
											<h3 className="font-bold text-[13px] leading-snug text-slate-700 dark:text-slate-200 group-hover:text-saffron-600 transition-colors">
												<HighlightText
													text={book.title}
													highlight={searchQuery}
												/>
											</h3>

											{isDownloading ? (
												<div className="mt-1">
													<div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
														<div
															className="h-full bg-saffron-500 transition-all duration-300"
															style={{ width: `${progress}%` }}
														/>
													</div>
													<p className="text-[10px] text-saffron-600 font-mono font-bold flex justify-between">
														<span>{Math.round(progress)}%</span>
														{downloadItem.total > 0 && (
															<span>
																{formatBytes(downloadItem.loaded)} /{" "}
																{formatBytes(downloadItem.total)}
															</span>
														)}
													</p>
												</div>
											) : (
												<p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1 font-medium min-w-0">
													<span className="truncate">
														<HighlightText
															text={book.fileName}
															highlight={searchQuery}
														/>
													</span>
													{book.displaySize && (
														<span className="text-[10px] opacity-70 border-l border-slate-300 dark:border-slate-600 pl-1 ml-1 shrink-0">
															{book.displaySize}
														</span>
													)}
													{isDownloaded && (
														<span
															className="ml-1.5 px-1.5 py-0.5 bg-saffron-100 dark:bg-saffron-900/40 text-saffron-600 dark:text-saffron-300 text-[10px] font-bold rounded-full uppercase tracking-wide shrink-0"
															data-tour="books-downloaded"
														>
															✓ {t.offline}
														</span>
													)}
												</p>
											)}
										</div>

										{/* Actions Area */}
										<div className="shrink-0 flex items-center gap-2 z-10 pl-2">
											{isDownloading ? (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														onCancelDownload?.(book.id);
													}}
													className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-red-500 rounded-full transition-colors active:scale-95"
													title={t.cancelDownload}
													aria-label={t.cancelDownload}
													data-tour="books-cancel"
												>
													<X size={20} />
												</button>
											) : isDownloaded ? (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														void openBook(book);
													}}
													disabled={isOpening}
													className="w-10 h-10 flex items-center justify-center bg-saffron-500 text-white hover:brightness-110 rounded-full transition-all active:scale-95 shadow-sm disabled:opacity-70"
													title={t.readTitle}
													aria-label={t.readTitle}
													data-tour="books-read"
												>
													{isOpening ? (
														<Loader2 size={20} className="animate-spin" />
													) : (
														<BookOpen size={20} />
													)}
												</button>
											) : (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														startDownload(book);
													}}
													className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-saffron-500 hover:text-saffron-600 hover:bg-saffron-50 dark:hover:bg-slate-600 rounded-full transition-colors active:scale-95"
													title={t.downloadTitle}
													aria-label={t.downloadTitle}
													data-tour="books-download"
												>
													<Download size={20} />
												</button>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Action Modal */}
			{pendingBook &&
				createPortal(
					// biome-ignore lint/a11y/noStaticElementInteractions: backdrop tap closes; keyboard/back use the Cancel button and history
					// biome-ignore lint/a11y/useKeyWithClickEvents: same as above
					<div
						className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
						onClick={closeModal}
					>
						{/* biome-ignore lint/a11y/noStaticElementInteractions: only stops backdrop-close propagation */}
						{/* biome-ignore lint/a11y/useKeyWithClickEvents: same as above */}
						<div
							className="bg-ry-cream dark:bg-slate-800 w-full max-w-xs max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-ry-gold/20"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex flex-col items-center text-center">
								<div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 animate-pop bg-ry-gold/10 text-ry-gold border border-ry-gold/30">
									{pendingDownload ? (
										<Loader2 size={28} className="animate-spin" />
									) : pendingIsDownloaded ? (
										<BookOpen size={28} />
									) : (
										<Download size={28} />
									)}
								</div>

								<h3 className="text-lg font-bold text-ry-gold dark:text-white mb-2">
									{pendingDownload
										? t.downloadingTitle
										: pendingIsDownloaded
											? t.openBook
											: t.downloadRequired}
								</h3>

								<div className="text-sm text-slate-600 dark:text-slate-300 mb-6 w-full">
									{pendingDownload ? (
										<>
											<p className="font-bold mb-3">{pendingBook.title}</p>
											<div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
												<div
													className="h-full bg-ry-gold transition-all duration-300"
													style={{
														width: `${Math.min(100, Math.max(0, pendingDownload.progress || 0))}%`,
													}}
												/>
											</div>
											<p className="mt-2 text-xs font-mono font-bold text-ry-gold">
												{Math.round(pendingDownload.progress || 0)}%
												{pendingDownload.total > 0 &&
													` • ${formatBytes(pendingDownload.loaded)} / ${formatBytes(pendingDownload.total)}`}
											</p>
										</>
									) : pendingIsDownloaded ? (
										<p>
											<strong>{pendingBook.title}</strong> {t.downloadedMsg}
										</p>
									) : (
										<p>
											{t.mustDownload} <br />
											<strong>{pendingBook.title}</strong>
											{pendingBook.displaySize && (
												<span className="block mt-2 font-bold text-xs text-ry-gold">
													{t.size} {pendingBook.displaySize}
												</span>
											)}
										</p>
									)}
								</div>

								<div className="flex flex-col gap-3 w-full">
									{pendingDownload ? (
										<button
											type="button"
											onClick={() => onCancelDownload?.(pendingBook.id)}
											className="w-full py-3.5 bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
										>
											<X size={18} />
											{t.cancelDownload}
										</button>
									) : (
										<>
											{/* Main Action: Read or Download */}
											<button
												type="button"
												onClick={() =>
													pendingIsDownloaded
														? void openBook(pendingBook)
														: startDownload(pendingBook)
												}
												disabled={openingBookId === pendingBook.id}
												className="w-full py-3.5 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-3 active:scale-95 bg-ry-gold hover:brightness-110 disabled:opacity-70"
											>
												{openingBookId === pendingBook.id ? (
													<Loader2 size={20} className="animate-spin" />
												) : pendingIsDownloaded ? (
													<BookOpen size={20} />
												) : (
													<Download size={20} />
												)}
												{pendingIsDownloaded ? t.readNow : t.downloadApp}
											</button>

											{/* Re-download: the saved copy is replaced only once the new one
											    is fully downloaded and verified, so cancelling never loses it. */}
											{pendingIsDownloaded &&
												(redownloadConfirmId === pendingBook.id ? (
													<div className="w-full rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700 p-3 text-center">
														<p className="text-xs text-orange-700 dark:text-orange-300 font-medium mb-3">
															{hi
																? "नई कॉपी पूरी डाउनलोड होने के बाद पुरानी कॉपी बदल दी जाएगी। फिर से डाउनलोड करें?"
																: "The saved copy will be replaced once the new download finishes. Re-download?"}
														</p>
														<div className="flex gap-2">
															<button
																type="button"
																onClick={() => setRedownloadConfirmId(null)}
																className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold"
															>
																{hi ? "रद्द" : "Cancel"}
															</button>
															<button
																type="button"
																onClick={() => startDownload(pendingBook)}
																className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold"
															>
																{hi ? "हाँ, डाउनलोड करें" : "Yes, Re-download"}
															</button>
														</div>
													</div>
												) : (
													<button
														type="button"
														onClick={() =>
															setRedownloadConfirmId(pendingBook.id)
														}
														className="w-full py-3.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-600"
													>
														<Download
															size={20}
															className="text-slate-700 dark:text-slate-300"
														/>
														{hi ? "फिर से डाउनलोड करें" : "Re-download in App"}
													</button>
												))}

											{/* Opening in browser does NOT save the file to the app */}
											{pendingUrl && (
												<button
													type="button"
													onClick={() => openExternalLink(pendingUrl)}
													className="w-full py-3.5 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-600"
												>
													<ExternalLink
														size={18}
														className="text-blue-400 shrink-0"
													/>
													<span className="text-sm">
														{t.openBrowser}
														<span className="ml-1 text-[10px] font-normal opacity-70">
															{t.openBrowserNote}
														</span>
													</span>
												</button>
											)}
										</>
									)}

									<button
										type="button"
										onClick={closeModal}
										className="w-full py-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors mt-2"
									>
										{t.cancel}
									</button>
								</div>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
};

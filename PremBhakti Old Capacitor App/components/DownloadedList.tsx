import { Capacitor } from "@capacitor/core";
import {
	ArrowLeft,
	BookOpen,
	Download,
	Folder,
	FolderOpen,
	Image as ImageIcon,
	Mic,
	Music,
	PlayCircle,
	Search,
	SearchX,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import { BOOKS_DATA } from "../data/books";
import { LECTURES_DATA } from "../data/lectures";
import type { Bhajan, Book, ScriptType } from "../types";
import { deleteTrack, getDownloadedTrackIds } from "../utils/audioStorage";
import {
	deleteBook,
	getDownloadedBookIds,
	openDownloadedBook,
} from "../utils/bookStorage";
import {
	deleteImageEntry,
	type FileEntry,
	listImageDirectory,
} from "../utils/imageScanner";
import { NativeDownload } from "../utils/nativeDownload";
import {
	calculateBookScore,
	calculateLectureScore,
	calculateSearchScore,
} from "../utils/textProcessor";
import { HighlightText } from "./HighlightText";
import { VoiceSearchButton } from "./VoiceSearchButton";

interface DownloadedListProps {
	allBhajans: Bhajan[];
	onSelect: (item: any) => void; // Generic select
	onBack: () => void;
	script: ScriptType;
	scrollBarSide?: "left" | "right";
}

type SubTab = "bhajans" | "books" | "lectures" | "images";

export const DownloadedList: React.FC<DownloadedListProps> = ({
	allBhajans,
	onSelect,
	onBack,
	script,
	scrollBarSide = "left",
}) => {
	const [activeSubTab, setActiveSubTab] = useState<SubTab>("bhajans");
	const [downloadedTrackIds, setDownloadedTrackIds] = useState<string[]>([]);
	const [downloadedBookIds, setDownloadedBookIds] = useState<string[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const { showToast } = useToast();

	const [currentImagePath, setCurrentImagePath] = useState<string[]>([]);
	const [imageEntries, setImageEntries] = useState<FileEntry[]>([]);
	const [isLoadingImages, setIsLoadingImages] = useState(false);
	const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);

	const refreshData = () => {
		setDownloadedTrackIds(getDownloadedTrackIds());
		setDownloadedBookIds(getDownloadedBookIds());
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshData is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		refreshData();
		// Listen for storage events (triggered by delete operations)
		window.addEventListener("storage", refreshData);
		return () => window.removeEventListener("storage", refreshData);
	}, []);

	useEffect(() => {
		if (activeSubTab === "images") {
			setIsLoadingImages(true);
			listImageDirectory(currentImagePath).then((entries) => {
				setImageEntries(entries);
				setIsLoadingImages(false);
			});
		}
	}, [activeSubTab, currentImagePath]);

	// Filter Bhajans (Songs)
	const downloadedBhajans = useMemo(() => {
		const list = allBhajans.filter((b) =>
			b.audio?.some((track) => downloadedTrackIds.includes(track.id)),
		);

		if (searchQuery.trim()) {
			return list
				.map((b) => ({
					item: b,
					score: calculateSearchScore(b, searchQuery, script),
				}))
				.filter((res) => res.score > 0)
				.sort((a, b) => b.score - a.score)
				.map((res) => res.item);
		}
		return list;
	}, [allBhajans, downloadedTrackIds, searchQuery, script]);

	// Filter Books
	const downloadedBooks = useMemo(() => {
		let sourceBooks = BOOKS_DATA;
		try {
			const storedBooks = localStorage.getItem("cpbs_all_books");
			if (storedBooks) sourceBooks = JSON.parse(storedBooks);
		} catch {}

		const list = sourceBooks.filter((b) => downloadedBookIds.includes(b.id));

		if (searchQuery.trim()) {
			return list
				.map((b) => ({ item: b, score: calculateBookScore(b, searchQuery) }))
				.filter((res) => res.score > 0)
				.sort((a, b) => b.score - a.score)
				.map((res) => res.item);
		}
		return list;
	}, [downloadedBookIds, searchQuery]);

	// Filter Lectures
	const downloadedLectures = useMemo(() => {
		let sourceLectures = LECTURES_DATA;
		try {
			const storedLectures = localStorage.getItem("cpbs_all_lectures");
			if (storedLectures) sourceLectures = JSON.parse(storedLectures);
		} catch {}

		const list = sourceLectures.filter((l) =>
			l.audio?.some((track) => downloadedTrackIds.includes(track.id)),
		);

		if (searchQuery.trim()) {
			return list
				.map((l) => ({ item: l, score: calculateLectureScore(l, searchQuery) }))
				.filter((res) => res.score > 0)
				.sort((a, b) => b.score - a.score)
				.map((res) => res.item);
		}
		return list;
	}, [downloadedTrackIds, searchQuery]);

	// --- Handlers ---

	const handleDeleteTrack = async (trackId: string, trackUrl: string) => {
		// Optimistic update: remove immediately from UI
		setDownloadedTrackIds((prev) => prev.filter((id) => id !== trackId));
		await deleteTrack(trackId, trackUrl);
		// refreshData will ensure sync if anything else changed
		setTimeout(refreshData, 100);
	};

	const handleDeleteBook = async (bookId: string, title?: string) => {
		// Optimistic update
		setDownloadedBookIds((prev) => prev.filter((id) => id !== bookId));
		await deleteBook(bookId, title);
		setTimeout(refreshData, 100);
	};

	const handleBookSelect = async (book: Book) => {
		if (Capacitor.getPlatform() === "android") {
			const result = await openDownloadedBook(book);
			if (result === "not_found") {
				// Registry entry already dropped by openDownloadedBook
				showToast(
					"File not found! It may have been deleted from your device.",
					"error",
				);
				setDownloadedBookIds(getDownloadedBookIds());
			} else if (result !== "opened") {
				// No PDF app / open failed: the file is fine, use the in-app reader
				onSelect(book);
			}
		} else {
			onSelect(book);
		}
	};

	const handleOpenFolder = () => {
		if (Capacitor.getPlatform() !== "android") return;
		let subpath = "Prem Bhakti/Audios";
		let directory: "DOWNLOADS" | "PICTURES" | "MUSIC" | "DOCUMENTS" = "MUSIC";

		if (activeSubTab === "lectures") {
			subpath = "Prem Bhakti/Lectures";
			directory = "MUSIC";
		}
		if (activeSubTab === "images") {
			subpath = `Prem Bhakti/${currentImagePath.join("/")}`;
			// Avoid trailing slash if currentImagePath is empty
			if (currentImagePath.length === 0) subpath = "Prem Bhakti";
			directory = "PICTURES";
		}

		NativeDownload.openFolder({ subpath, directory }).catch((err) => {
			console.error("Failed to open folder", err);
			showToast("Could not open file manager.", "error");
		});
	};

	const handleBack = () => {
		if (activeSubTab === "images" && currentImagePath.length > 0) {
			setCurrentImagePath((prev) => prev.slice(0, -1));
		} else {
			onBack();
		}
	};

	const isSearching = searchQuery.trim().length > 0;

	return (
		<div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
			{/* Header */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 z-10 sticky top-0">
				<button
					onClick={handleBack}
					className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
				>
					<ArrowLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
				</button>
				<h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
					<Download className="w-6 h-6 text-green-600" /> Downloads
				</h2>
			</div>

			<div className="flex-none p-4 pb-0 space-y-4">
				{/* Search Bar */}
				<div className="relative">
					<input
						type="text"
						placeholder="Search downloads..."
						className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl py-2.5 pl-10 pr-10 border-none outline-none focus:ring-2 focus:ring-saffron-500/50 transition-all placeholder:text-slate-400 shadow-inner"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					<Search
						className="absolute left-3 top-2.5 text-slate-400 dark:text-ink-400"
						size={18}
					/>
					<div className="absolute right-2 top-1.5 flex items-center gap-1">
						<VoiceSearchButton onResult={(text) => setSearchQuery(text)} />
						{searchQuery && (
							<button
								onClick={() => setSearchQuery("")}
								className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200"
							>
								<X size={16} />
							</button>
						)}
					</div>
				</div>

				{/* Tabs */}
				<div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
					<TabButton
						active={activeSubTab === "bhajans"}
						onClick={() => setActiveSubTab("bhajans")}
						label="Bhajans"
						icon={<Music size={14} />}
					/>
					<TabButton
						active={activeSubTab === "lectures"}
						onClick={() => setActiveSubTab("lectures")}
						label="Katha"
						icon={<Mic size={14} />}
					/>
					<TabButton
						active={activeSubTab === "books"}
						onClick={() => setActiveSubTab("books")}
						label="Books"
						icon={<BookOpen size={14} />}
					/>
					{Capacitor.isNativePlatform() && (
						<TabButton
							active={activeSubTab === "images"}
							onClick={() => setActiveSubTab("images")}
							label="Images"
							icon={<ImageIcon size={14} />}
						/>
					)}
				</div>

				{/* Books live in the app's private folder now (no public folder to show) */}
				{Capacitor.getPlatform() === "android" && activeSubTab !== "books" && (
					<div className="flex justify-end pt-1 pr-1">
						<button
							onClick={handleOpenFolder}
							className="text-sm flex items-center gap-1.5 text-saffron-600 dark:text-saffron-400 font-medium hover:underline active:scale-95 transition-all"
						>
							<FolderOpen size={16} /> Open in File Manager
						</button>
					</div>
				)}
			</div>

			{/* Content List */}
			<div
				className={`flex-1 overflow-y-auto ${scrollBarSide === "left" ? "left-scrollbar" : ""}`}
			>
				<div
					dir={scrollBarSide === "left" ? "ltr" : undefined}
					className="p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]"
				>
					{/* BHAJANS LIST */}
					{activeSubTab === "bhajans" &&
						(downloadedBhajans.length === 0 ? (
							<EmptyState
								message={
									isSearching ? "No matching bhajans" : "No downloaded bhajans"
								}
								sub={
									isSearching
										? "Try a different search term"
										: "Download songs from the player to listen offline."
								}
								icon={
									isSearching ? (
										<SearchX className="w-16 h-16 opacity-20 mb-4" />
									) : undefined
								}
							/>
						) : (
							<ul className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-4 landscape:space-y-0">
								{downloadedBhajans.map((bhajan) => (
									<li
										key={bhajan.id}
										className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up"
									>
										<button
											onClick={() => onSelect(bhajan)}
											className="w-full text-left p-4 hover:bg-saffron-50 dark:hover:bg-slate-700/50 transition-colors"
										>
											<h3 className="font-hindi font-bold text-slate-800 dark:text-slate-200 text-lg leading-tight mb-1">
												<HighlightText
													text={
														script === "iast" ? bhajan.titleIAST : bhajan.title
													}
													highlight={searchQuery}
												/>
											</h3>
											<div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
												<PlayCircle size={14} /> Available Offline
											</div>
										</button>

										<div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 px-4 py-2">
											{bhajan.audio
												?.filter((t) => downloadedTrackIds.includes(t.id))
												.map((track) => (
													<div
														key={track.id}
														className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
													>
														<span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate pr-4">
															{track.singer}
														</span>
														<DeleteButton
															onConfirm={() =>
																handleDeleteTrack(track.id, track.url)
															}
														/>
													</div>
												))}
										</div>
									</li>
								))}
							</ul>
						))}

					{/* LECTURES LIST */}
					{activeSubTab === "lectures" &&
						(downloadedLectures.length === 0 ? (
							<EmptyState
								message={
									isSearching ? "No matching katha" : "No downloaded katha"
								}
								sub={
									isSearching
										? "Try a different search term"
										: "Download audio tracks from the Audio section."
								}
								icon={
									isSearching ? (
										<SearchX className="w-16 h-16 opacity-20 mb-4" />
									) : undefined
								}
							/>
						) : (
							<ul className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-4 landscape:space-y-0">
								{downloadedLectures.map((lecture) => (
									<li
										key={lecture.id}
										className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up"
									>
										<button
											onClick={() => onSelect(lecture)}
											className="w-full text-left p-4 hover:bg-saffron-50 dark:hover:bg-slate-700/50 transition-colors"
										>
											<h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg leading-tight mb-1">
												<HighlightText
													text={lecture.title}
													highlight={searchQuery}
												/>
											</h3>
											<div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
												<Mic size={14} /> Available Offline
											</div>
										</button>

										<div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 px-4 py-2">
											{lecture.audio
												?.filter((t) => downloadedTrackIds.includes(t.id))
												.map((track) => (
													<div
														key={track.id}
														className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
													>
														<span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate pr-4">
															{track.singer || "Audio Track"}
														</span>
														<DeleteButton
															onConfirm={() =>
																handleDeleteTrack(track.id, track.url)
															}
														/>
													</div>
												))}
										</div>
									</li>
								))}
							</ul>
						))}

					{/* BOOKS LIST */}
					{activeSubTab === "books" &&
						(downloadedBooks.length === 0 ? (
							<EmptyState
								message={
									isSearching ? "No matching books" : "No downloaded books"
								}
								sub={
									isSearching
										? "Try a different search term"
										: "Download PDFs from the Books section."
								}
								icon={
									isSearching ? (
										<SearchX className="w-16 h-16 opacity-20 mb-4" />
									) : undefined
								}
							/>
						) : (
							<ul className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-4 landscape:space-y-0">
								{downloadedBooks.map((book) => (
									<li
										key={book.id}
										className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center p-3 gap-3 animate-fade-in-up"
									>
										<button
											onClick={() => handleBookSelect(book)}
											className="flex-1 flex items-center gap-3 text-left min-w-0"
										>
											<div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-saffron-600 dark:text-saffron-400 shrink-0">
												<BookOpen size={20} />
											</div>
											<div className="min-w-0">
												<h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">
													<HighlightText
														text={book.title}
														highlight={searchQuery}
													/>
												</h3>
												<p className="text-xs text-slate-400 dark:text-ink-400 truncate">
													<HighlightText
														text={book.fileName}
														highlight={searchQuery}
													/>
												</p>
											</div>
										</button>
										<DeleteButton
											onConfirm={() => handleDeleteBook(book.id, book.title)}
										/>
									</li>
								))}
							</ul>
						))}

					{/* IMAGES LIST */}
					{activeSubTab === "images" &&
						(isLoadingImages ? (
							<div className="flex justify-center p-8">
								<div className="w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full animate-spin" />
							</div>
						) : imageEntries.length === 0 ? (
							<EmptyState
								message={
									currentImagePath.length === 0
										? "No downloaded images"
										: "Folder is empty"
								}
								sub={
									currentImagePath.length === 0
										? "Download Darshan and Activity photos to view them here."
										: ""
								}
								icon={<ImageIcon className="w-16 h-16 opacity-20 mb-4" />}
							/>
						) : (
							<div>
								{currentImagePath.length > 0 && (
									<div className="mb-4 text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
										<FolderOpen size={16} />
										{currentImagePath.join(" / ")}
									</div>
								)}
								<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
									{imageEntries.map((entry) => {
										if (entry.isDirectory) {
											return (
												<button
													key={entry.name}
													onClick={() =>
														setCurrentImagePath((prev) => [...prev, entry.name])
													}
													className="bg-white dark:bg-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all active:scale-95"
												>
													<Folder className="w-12 h-12 text-saffron-400" />
													<span className="text-sm font-bold text-slate-800 dark:text-slate-200 text-center line-clamp-2">
														{entry.name}
													</span>
												</button>
											);
										} else {
											return (
												<div
													key={entry.name}
													className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
												>
													{entry.uri ? (
														<img
															src={entry.uri}
															alt={entry.name}
															className="w-full h-full object-cover cursor-pointer active:scale-95 transition-transform"
															onClick={() =>
																setViewingImageUri(entry.uri || null)
															}
														/>
													) : (
														<div className="w-full h-full flex items-center justify-center text-slate-300">
															<ImageIcon size={32} />
														</div>
													)}
													<div className="absolute top-2 right-2 bg-white/80 dark:bg-black/60 backdrop-blur rounded-full">
														<DeleteButton
															onConfirm={async () => {
																const success = await deleteImageEntry(
																	currentImagePath,
																	entry.name,
																);
																if (success) {
																	setImageEntries((prev) =>
																		prev.filter((e) => e.name !== entry.name),
																	);
																}
															}}
														/>
													</div>
												</div>
											);
										}
									})}
								</div>
							</div>
						))}
				</div>
			</div>

			{/* Fullscreen Image Viewer Modal */}
			{viewingImageUri && (
				<div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
					<button
						onClick={() => setViewingImageUri(null)}
						className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[101]"
					>
						<X size={24} />
					</button>
					<img
						src={viewingImageUri}
						className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-scale-in"
						alt="Full View"
					/>
				</div>
			)}
		</div>
	);
};

// Inline confirmation button to avoid window.confirm issues
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
			className={`p-2 rounded-full transition-all active:scale-95 flex items-center gap-2 ${confirming ? "bg-red-500 text-white px-3" : "text-slate-400 dark:text-ink-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
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

const TabButton: React.FC<{
	active: boolean;
	onClick: () => void;
	label: string;
	icon: React.ReactNode;
}> = ({ active, onClick, label, icon }) => (
	<button
		onClick={onClick}
		className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${active ? "bg-white dark:bg-slate-700 text-saffron-600 dark:text-saffron-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
	>
		{icon} {label}
	</button>
);

const EmptyState: React.FC<{
	message: string;
	sub: string;
	icon?: React.ReactNode;
}> = ({ message, sub, icon }) => (
	<div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 dark:text-ink-400 p-8 text-center animate-fade-in-up landscape:col-span-2">
		{icon || <Download className="w-16 h-16 opacity-20 mb-4" />}
		<p className="text-lg font-medium">{message}</p>
		<p className="text-sm opacity-70 mt-2">{sub}</p>
	</div>
);

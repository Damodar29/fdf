import {
	ArrowLeft,
	Edit2,
	Eye,
	EyeOff,
	Plus,
	Save,
	Search,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { InterruptedWriteBanner } from "../../src/components/admin-panel/InterruptedWriteBanner";
import { ProcessingBlockerModal } from "../../src/components/admin-panel/ProcessingBlockerModal";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import { saveBookToFirebase } from "../../src/utils/githubBookStorage";
import type { Book } from "../../types";
import { validateAndFormatUrl } from "../../utils/url";
import { B2UploadButton } from "./B2UploadButton";

export const BookManager: React.FC<{
	allBooks: Book[];
	onUpdateList: (list: Book[]) => void;
	showToast: (text: string, type?: "success" | "error") => void;
	settingsLanguage?: "en" | "hi";
}> = ({ allBooks, onUpdateList, showToast, settingsLanguage = "hi" }) => {
	const [draft, setDraft] = useState<Book | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [progressMsg, setProgressMsg] = useState("");
	const [searchQuery, setSearchQuery] = useState("");

	const closeDraft = usePopupBackHandler(!!draft, "book-mgr-editor", () =>
		setDraft(null),
	);

	const isHindi = settingsLanguage === "hi";
	const t = {
		addBook: isHindi ? "किताब जोड़ें" : "Add Book",
		editBook: isHindi ? "किताब संपादित करें" : "Edit Book",
		title: isHindi ? "शीर्षक" : "Title",
		fileName: isHindi ? "फ़ाइल का नाम" : "File Name",
		primaryUrl: isHindi ? "प्राथमिक यूआरएल" : "Primary URL",
		saveCloud: isHindi ? "Cloud पर सहेजें" : "Save to Cloud",
		booksCount: isHindi ? "किताबें" : "Books",
		addNew: isHindi ? "नया जोड़ें" : "Add New",
		back: isHindi ? "पीछे" : "Back",
		hide: isHindi ? "Cloud से छुपाएं" : "Hide from Cloud",
		restore: isHindi ? "पुनः दिखाएं" : "Restore",
		hidden: isHindi ? "छुपी हुई" : "Hidden",
		displaySize: isHindi
			? "डिस्प्ले आकार (उदा: 2.5 MB)"
			: "Display Size (ex: 2.5 MB)",
		searchPlaceholder: isHindi ? "किताब खोजें..." : "Search books...",
	};

	const filteredBooks = useMemo(() => {
		if (!searchQuery.trim()) return allBooks;
		const q = searchQuery.toLowerCase();
		return allBooks.filter(
			(b) =>
				b.title.toLowerCase().includes(q) ||
				b.fileName?.toLowerCase().includes(q) ||
				b.id.toLowerCase().includes(q),
		);
	}, [allBooks, searchQuery]);

	const startEdit = (book?: Book) => {
		if (book) {
			setDraft({ ...book });
		} else {
			const existingIds = new Set(
				allBooks
					.map((b) => parseInt(b.id, 10))
					.filter((num) => !Number.isNaN(num) && num > 0),
			);
			let nextIdNum = 1;
			while (existingIds.has(nextIdNum)) {
				nextIdNum++;
			}
			const newId = String(nextIdNum).padStart(3, "0");
			setDraft({
				id: newId,
				title: "",
				fileName: "PDF",
				url: "",
				displaySize: "",
			});
		}
	};

	const saveToCloud = async (bookToSave: Book) => {
		if (!bookToSave.title) {
			showToast("Title is required", "error");
			return;
		}

		// Safeguard against ID collision
		const isNew = !allBooks.find((b) => b.id === draft?.id);
		if (isNew && allBooks.some((b) => b.id === bookToSave.id)) {
			showToast(`Error: Book ID #${bookToSave.id} already exists!`, "error");
			return;
		}

		const validUrl = validateAndFormatUrl(bookToSave.url);
		if (validUrl === null) {
			showToast("Please enter a valid URL for the book.", "error");
			return;
		}

		const finalBook = { ...bookToSave, url: validUrl };
		delete (finalBook as any).secondaryUrl;
		setIsSaving(true);
		try {
			// Build newList first (local source of truth) to avoid stale cloud read
			const exists = allBooks.find((b) => b.id === finalBook.id);
			const newList = exists
				? allBooks.map((b) => (b.id === finalBook.id ? finalBook : b))
				: [...allBooks, finalBook];

			// Pass newList so cloud bundle uses local state (avoids race condition)
			await saveBookToFirebase(finalBook, setProgressMsg, newList);
			onUpdateList(newList);
			localStorage.setItem("cpbs_all_books", JSON.stringify(newList));
			showToast("Book saved to Cloud!", "success");
			setDraft(null);
		} catch (e: any) {
			showToast(`Failed to save: ${e.message}`, "error");
		} finally {
			setIsSaving(false);
			setProgressMsg("");
		}
	};

	const toggleVisibility = async (book: Book) => {
		const updated = { ...book, isHidden: !book.isHidden };
		setIsSaving(true);
		try {
			// Build newList before cloud save so we pass authoritative bundle base
			const newList = allBooks.map((b) => (b.id === updated.id ? updated : b));
			// Pass newList so cloud bundle uses local state (avoids race condition)
			await saveBookToFirebase(updated, setProgressMsg, newList);
			onUpdateList(newList);
			localStorage.setItem("cpbs_all_books", JSON.stringify(newList));
			showToast(
				updated.isHidden ? "Book hidden from users." : "Book restored!",
				"success",
			);
			if (draft?.id === updated.id) setDraft(updated);
		} catch (e: any) {
			showToast(`Failed to update visibility: ${e.message}`, "error");
		} finally {
			setIsSaving(false);
			setProgressMsg("");
		}
	};

	// --- EDITOR ---
	if (draft) {
		return (
			<>
				<div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right">
					{/* Toolbar */}
					<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
						<button
							onClick={closeDraft}
							disabled={isSaving}
							className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors active:scale-95 disabled:opacity-50"
						>
							<ArrowLeft size={18} /> {t.back}
						</button>
						<div className="flex gap-2 items-center">
							{/* Hide/Restore toggle — only for existing books */}
							{allBooks.find((b) => b.id === draft.id) && (
								<button
									onClick={() => toggleVisibility(draft)}
									disabled={isSaving}
									className={`p-2 rounded-full transition-colors disabled:opacity-50 ${draft.isHidden ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20" : "text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:bg-slate-700"}`}
									title={draft.isHidden ? t.restore : t.hide}
								>
									{draft.isHidden ? <Eye size={20} /> : <EyeOff size={20} />}
								</button>
							)}
							<button
								onClick={() => saveToCloud(draft)}
								disabled={isSaving}
								className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-sm flex items-center gap-2"
							>
								{isSaving ? (
									<>
										<span className="animate-spin text-lg">↻</span>{" "}
										{progressMsg || "Saving..."}
									</>
								) : (
									<>
										<Save size={16} /> {t.saveCloud}
									</>
								)}
							</button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
						<div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									{t.title}
								</label>
								<input
									className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
									value={draft.title}
									onChange={(e) =>
										setDraft({ ...draft, title: e.target.value })
									}
									placeholder="Book Title"
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									{t.fileName}
								</label>
								<input
									className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
									value={draft.fileName}
									onChange={(e) =>
										setDraft({ ...draft, fileName: e.target.value })
									}
									placeholder="PDF"
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									{t.primaryUrl}
								</label>
								<div className="flex gap-2">
									<input
										className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-sm"
										value={draft.url || ""}
										onChange={(e) =>
											setDraft({ ...draft, url: e.target.value })
										}
										placeholder="https://..."
									/>
									<B2UploadButton
										folderPath={`Local Data Uploaded from App/books/${draft.title ? `${draft.title}/` : ""}`}
										accept="application/pdf,application/epub+zip"
										disabled={!draft.title.trim()}
										disabledMessage="Please enter a Book Title first!"
										onUploadComplete={(newUrl, file) => {
											const mbSize = (file.size / (1024 * 1024)).toFixed(1);
											setDraft({
												...draft,
												url: newUrl,
												fileName: file.name,
												displaySize: `${mbSize} MB`,
											});
										}}
										showToast={showToast}
									/>
								</div>
							</div>

							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									{t.displaySize}
								</label>
								<input
									className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-sm"
									value={draft.displaySize || ""}
									onChange={(e) =>
										setDraft({ ...draft, displaySize: e.target.value })
									}
									placeholder="2.5 MB"
								/>
							</div>
						</div>
					</div>
				</div>
				<ProcessingBlockerModal
					isVisible={isSaving}
					viewId="book-save-blocker"
					title={isHindi ? "पुस्तक सेव हो रही है…" : "Saving book…"}
					message={progressMsg}
					isHindi={isHindi}
				/>
			</>
		);
	}

	// --- LIST ---
	return (
		<>
			<div className="h-full flex flex-col">
				<InterruptedWriteBanner
					tag="bookdata"
					busy={isSaving}
					isHindi={isHindi}
					fixHintEn="save any book again"
					fixHintHi="कोई भी किताब फिर से सेव करें"
				/>
				<div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 flex gap-2">
					<div className="relative flex-1">
						<Search
							className="absolute left-3 top-2.5 text-slate-400 dark:text-ink-400"
							size={18}
						/>
						<input
							className="w-full bg-slate-100 dark:bg-slate-900 rounded-lg py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={t.searchPlaceholder}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
					<button
						onClick={() => startEdit()}
						className="bg-blue-600 text-white px-3 rounded-lg text-sm font-bold flex items-center gap-1 shadow-sm"
					>
						<Plus size={18} /> {t.addNew}
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-3 space-y-3">
					{filteredBooks.length === 0 && (
						<div className="text-center py-8 text-slate-500">
							No books found.
						</div>
					)}
					{filteredBooks.map((book) => (
						<div
							key={book.id}
							className={`p-4 rounded-xl border flex justify-between items-center shadow-sm transition-colors ${
								book.isHidden
									? "bg-slate-100 dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600"
									: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
							}`}
						>
							<div className="flex-1 min-w-0 pr-4">
								<h4 className="font-bold text-slate-800 dark:text-white truncate flex items-center gap-2">
									<span className="text-xs text-slate-400 dark:text-ink-400 font-mono shrink-0">
										#{book.id}
									</span>
									{book.title}
									{book.isHidden && (
										<span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500 dark:text-ink-300 shrink-0">
											{t.hidden}
										</span>
									)}
								</h4>
								<p className="text-xs text-slate-400 dark:text-ink-400 truncate mt-0.5">
									{book.displaySize || book.fileName}
								</p>
							</div>
							<div className="flex gap-2 shrink-0 items-center">
								<button
									onClick={() => toggleVisibility(book)}
									disabled={isSaving}
									className={`p-2.5 rounded-lg transition-colors disabled:opacity-40 ${book.isHidden ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-ink-300"}`}
									title={book.isHidden ? t.restore : t.hide}
								>
									{book.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
								</button>
								<button
									onClick={() => startEdit(book)}
									className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-blue-600 dark:text-blue-400"
								>
									<Edit2 size={18} />
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
			<ProcessingBlockerModal
				isVisible={isSaving}
				viewId="book-save-blocker"
				title={isHindi ? "पुस्तक सेव हो रही है…" : "Saving book…"}
				message={progressMsg}
				isHindi={isHindi}
			/>
		</>
	);
};

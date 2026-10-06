import ReactNativeBlobUtil, { type StatefulPromise } from "react-native-blob-util";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { storage } from "../lib/storage";
import type { Book } from "../types";
import { getRemoteFileSize, useDownloadStore } from "./downloadStore";
import { showToast } from "./toastStore";

// Downloaded books — DataContext's downloadBook / startBookDownload /
// cancelDownload plus utils/bookStorage.ts. Same flow: size check, the
// download-confirm dialog, a download with live progress, then the book opens
// in the phone's PDF app (or the in-app reader when there is none).
//
// A re-download writes to a temp file and only replaces the saved copy once
// it completes, so cancelling never loses the book.

export interface DownloadedBook {
	path: string;
	sizeBytes: number;
	downloadedAt: number;
}

export interface BookDownloadProgress {
	progress: number;
	loaded: number;
	total: number;
}

interface BookState {
	downloaded: Record<string, DownloadedBook>;
	active: Record<string, BookDownloadProgress>;
	requestDownload: (book: Book) => Promise<void>;
	cancelDownload: (bookId: string) => void;
	deleteBook: (bookId: string) => void;
}

const BOOK_DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/books`;
const tasks: Partial<Record<string, StatefulPromise<unknown>>> = {};
const pending = new Set<string>();

const mmkvStorage: StateStorage = {
	getItem: (name) => storage.getString(name) ?? null,
	setItem: (name, value) => storage.set(name, value),
	removeItem: (name) => {
		storage.remove(name);
	},
};

/** utils/bookStorage.ts getDirectPdfUrl: Drive view links become downloads. */
export function getDirectPdfUrl(url: string): string {
	if (!url) return "";
	const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
	return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

const bookPath = (bookId: string) => `${BOOK_DIR}/book-${bookId.replace(/[^\w-]/g, "_")}.pdf`;

export const useBookStore = create<BookState>()(
	persist(
		(set, get) => ({
			downloaded: {},
			active: {},

			requestDownload: async (book) => {
				// Guard double taps while the size check / dialog is pending.
				if (get().active[book.id] || pending.has(book.id)) return;
				pending.add(book.id);
				const url = getDirectPdfUrl(book.url || "");
				let size = book.sizeBytes || 0;
				if (!size) {
					showToast("Checking file size...", "info");
					size = await getRemoteFileSize(url);
				}
				useDownloadStore.getState().confirm({
					title: book.title,
					sizeBytes: size,
					type: "book",
					onConfirm: () => {
						useDownloadStore.getState().dismissConfirmation();
						pending.delete(book.id);
						startBookDownload(book, url, size);
					},
				});
				// Released when the dialog is dismissed without confirming, too.
				const unsub = useDownloadStore.subscribe((s) => {
					if (!s.confirmation) {
						pending.delete(book.id);
						unsub();
					}
				});
			},

			cancelDownload: (bookId) => {
				const task = tasks[bookId];
				if (!task) return;
				task.cancel();
				delete tasks[bookId];
				set(({ active }) => {
					const { [bookId]: _, ...rest } = active;
					return { active: rest };
				});
				showToast("Download cancelled", "info");
			},

			deleteBook: (bookId) => {
				const item = get().downloaded[bookId];
				if (item) ReactNativeBlobUtil.fs.unlink(item.path).catch(() => {});
				set(({ downloaded }) => {
					const { [bookId]: _, ...rest } = downloaded;
					return { downloaded: rest };
				});
			},
		}),
		{
			name: "cpbs_downloaded_books",
			storage: createJSONStorage(() => mmkvStorage),
			partialize: ({ downloaded }) => ({ downloaded }),
		},
	),
);

async function startBookDownload(book: Book, url: string, knownSize: number) {
	const { setState } = useBookStore;
	const setProgress = (p: BookDownloadProgress) => setState(({ active }) => ({ active: { ...active, [book.id]: p } }));
	setProgress({ progress: 0, loaded: 0, total: knownSize });

	const path = bookPath(book.id);
	const temp = `${path}.part`;
	try {
		if (!(await ReactNativeBlobUtil.fs.isDir(BOOK_DIR))) await ReactNativeBlobUtil.fs.mkdir(BOOK_DIR);
		const task = ReactNativeBlobUtil.config({ path: temp, overwrite: true }).fetch("GET", url);
		tasks[book.id] = task;
		task.progress({ interval: 250 }, (received, total) => {
			const t = Number(total) > 0 ? Number(total) : knownSize;
			setProgress({ progress: t > 0 ? Math.min(100, (Number(received) / t) * 100) : 0, loaded: Number(received), total: t });
		});
		const res = await task;
		const status = res.info().status;
		if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
		if (await ReactNativeBlobUtil.fs.exists(path)) await ReactNativeBlobUtil.fs.unlink(path);
		await ReactNativeBlobUtil.fs.mv(temp, path);
		const stat = await ReactNativeBlobUtil.fs.stat(path);
		setState(({ downloaded }) => ({
			downloaded: { ...downloaded, [book.id]: { path, sizeBytes: Number(stat.size) || knownSize, downloadedAt: Date.now() } },
		}));
		showToast(`Downloaded: ${book.title}`, "success");
	} catch {
		ReactNativeBlobUtil.fs.unlink(temp).catch(() => {});
		if (tasks[book.id]) showToast(`Failed: ${book.title}`, "error");
	} finally {
		delete tasks[book.id];
		setTimeout(() => {
			setState(({ active }) => {
				const { [book.id]: _, ...rest } = active;
				return { active: rest };
			});
		}, 1000);
	}
}

export type OpenBookResult = "opened" | "not_found" | "no_viewer";

/** Opens a downloaded book in the phone's PDF app (BookList openBook). */
export async function openInPdfApp(bookId: string): Promise<OpenBookResult> {
	const item = useBookStore.getState().downloaded[bookId];
	if (!item || !(await ReactNativeBlobUtil.fs.exists(item.path))) {
		if (item) useBookStore.getState().deleteBook(bookId);
		return "not_found";
	}
	try {
		await ReactNativeBlobUtil.android.actionViewIntent(item.path, "application/pdf");
		return "opened";
	} catch {
		return "no_viewer";
	}
}

export function formatBookBytes(bytes: number) {
	if (!bytes || bytes < 0 || !Number.isFinite(bytes)) return "0 B";
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
	return `${Number.parseFloat((bytes / 1024 ** i).toFixed(1))} ${sizes[i]}`;
}

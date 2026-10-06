import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { BOOKS_DATA } from "../data/books";
import type { Book } from "../types";
import { Crashlytics } from "./Crashlytics";
import { NativeDownload } from "./nativeDownload";
import { safeLocalSet } from "./safeLocalSet";

/** Returns true when running in a mobile Safari / iOS Chrome web browser (NOT native app) */
export const isIOSWeb = (): boolean => {
	if (Capacitor.isNativePlatform()) return false;
	return (
		/ipad|iphone|ipod/i.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
	);
};

const CACHE_NAME = "cpbs-book-cache-v3";
const STORAGE_KEY = "cpbs_downloaded_books";
// bookId -> exact filename. Android: inside the app-specific Books dir; iOS: Documents/Prem Bhakti/Books.
const BOOK_PATHS_KEY = "cpbs_book_paths_v2";
// Set once the old public Download/Prem Bhakti/Books folder has been migrated and wiped.
const STORAGE_V3_KEY = "cpbs_book_storage_v3";

// Android v3: app-specific external dir (Android/data/<pkg>/files/Books), i.e.
// Directory.External + "Books". See NativeDownloadPlugin "Book storage v3" for why.
const BOOK_DIR_ANDROID = "Books";
const BOOK_DIR_IOS = "Prem Bhakti/Books"; // iOS: Documents folder (visible in Files app)

// Above this size, PDF.js gets a file URL instead of the whole file as base64
// (a 136 MB book as base64 + Uint8Array runs low-RAM WebViews out of memory).
const MAX_INLINE_READ_BYTES = 40 * 1024 * 1024;

const isAndroid = () => Capacitor.getPlatform() === "android";

// --- Registry ---

const readPaths = (): Record<string, string> => {
	try {
		return JSON.parse(localStorage.getItem(BOOK_PATHS_KEY) || "{}");
	} catch {
		return {};
	}
};

export const getDownloadedBookIds = (): string[] => {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
	} catch {
		return [];
	}
};

export const isBookDownloaded = (bookId: string): boolean =>
	getDownloadedBookIds().includes(bookId);

const writeRegistry = (ids: string[], paths: Record<string, string>) => {
	const prevIds = localStorage.getItem(STORAGE_KEY) || "[]";
	const prevPaths = localStorage.getItem(BOOK_PATHS_KEY) || "{}";
	const nextIds = JSON.stringify(ids);
	const nextPaths = JSON.stringify(paths);
	if (nextIds === prevIds && nextPaths === prevPaths) return;
	safeLocalSet(STORAGE_KEY, nextIds);
	safeLocalSet(BOOK_PATHS_KEY, nextPaths);
	window.dispatchEvent(new Event("storage"));
};

const registerBook = (bookId: string, fileName?: string) => {
	const ids = getDownloadedBookIds();
	const paths = readPaths();
	if (fileName) paths[bookId] = fileName;
	writeRegistry(ids.includes(bookId) ? ids : [...ids, bookId], paths);
};

/** Removes a book from the registry only (the file is handled by the caller). */
const forgetBook = (bookId: string) => {
	const paths = readPaths();
	delete paths[bookId];
	writeRegistry(
		getDownloadedBookIds().filter((id) => id !== bookId),
		paths,
	);
};

// --- File names ---

// Generates a safe filename while keeping Hindi (Devanagari) characters intact
const getSafeBookTitle = (title: string, id: string): string => {
	const safeTitle = (title || id).replace(/[\\/:*?"<>|]/g, "").trim();
	return safeTitle || id;
};

// Old (v1) ASCII-only filename, used only to recognise legacy downloads
const getOldSafeBookTitle = (title: string, id: string): string => {
	const safeTitle = (title || id).replace(/[^a-zA-Z0-9 _-]/g, "").trim();
	return safeTitle || id;
};

/**
 * Android v3 filename: "<title> [<bookId>].pdf". The id suffix is what native code
 * uses to find a book's files, so title edits never orphan a download. The title is
 * capped at 150 UTF-8 bytes (Devanagari is 3 bytes/char; the filesystem limit is 255).
 */
export const getBookFileName = (book: Book): string => {
	const encoder = new TextEncoder();
	let title = getSafeBookTitle(book.title || "", book.id)
		// biome-ignore lint/suspicious/noControlCharactersInRegex: strip control chars from titles
		.replace(/[[\]\u0000-\u001f]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	// Drop whole words (cutting code points splits Devanagari conjuncts).
	while (encoder.encode(title).length > 150) {
		const cut = title.lastIndexOf(" ");
		title =
			cut > 0
				? title.slice(0, cut).trim()
				: Array.from(title).slice(0, -1).join("");
	}
	return title ? `${title} [${book.id}].pdf` : `[${book.id}].pdf`;
};

/**
 * Legacy (public folder) name match: the exact registered name, the title name, or
 * an OS-renamed copy like "Title (1).pdf" / "Title-1.pdf". Prevents "Book" matching
 * "Book Part 2".
 */
const isBookFileNameMatch = (fileName: string, baseTitle: string): boolean => {
	const lowerFile = fileName.toLowerCase();
	const lowerBase = baseTitle.toLowerCase();
	if (lowerFile === `${lowerBase}.pdf`) return true;
	if (lowerFile.startsWith(lowerBase)) {
		const suffix = lowerFile.substring(lowerBase.length);
		return /^(\s*\(\d+\)|-\d+)\.pdf$/.test(suffix);
	}
	return false;
};

export const getDirectPdfUrl = (url: string): string => {
	if (!url) return "";
	// Convert Drive View links to Download links
	const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
	if (idMatch?.[1])
		return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
	const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
	if (idParamMatch?.[1])
		return `https://drive.google.com/uc?export=download&id=${idParamMatch[1]}`;
	return url;
};

// Robust File Size Fetcher
const getFileSize = async (url: string): Promise<number> => {
	try {
		if (Capacitor.isNativePlatform()) {
			// Native: Use CapacitorHttp to avoid CORS and get accurate headers
			const response = await CapacitorHttp.request({ method: "HEAD", url });
			const len =
				response.headers["Content-Length"] ||
				response.headers["content-length"];
			return len ? parseInt(len, 10) : 0;
		}
		const response = await fetch(url, { method: "HEAD" });
		const len = response.headers.get("Content-Length");
		return len ? parseInt(len, 10) : 0;
	} catch (e) {
		console.warn("Failed to get file size", e);
		return 0;
	}
};

// --- Download ---

/**
 * Android: DownloadManager into the app-specific Books dir via NativeDownload.downloadBook.
 * Aborting (cancel / reader unmount) really stops the native download now, so a
 * retry can never race a still-running copy. No JS timeout: DownloadManager keeps
 * retrying across network drops, and the user can cancel from the list.
 */
const downloadBookAndroid = async (
	book: Book,
	url: string,
	onProgress?: (percent: number, loaded: number, total: number) => void,
	signal?: AbortSignal,
): Promise<boolean> => {
	if (signal?.aborted) return false;
	const listener = await NativeDownload.addListener(
		"onBookDownloadProgress",
		(info) => {
			if (info.bookId !== book.id || !onProgress || info.bytesTotal <= 0)
				return;
			onProgress(
				(info.bytesDownloaded / info.bytesTotal) * 100,
				info.bytesDownloaded,
				info.bytesTotal,
			);
		},
	);
	const onAbort = () => {
		NativeDownload.cancelBookDownload({ bookId: book.id }).catch(() => {});
	};
	signal?.addEventListener("abort", onAbort, { once: true });
	try {
		const res = await NativeDownload.downloadBook({
			url,
			bookId: book.id,
			fileName: getBookFileName(book),
			title: book.title,
		});
		registerBook(book.id, res.fileName);
		onProgress?.(100, res.size, res.size);
		return true;
	} catch (e: any) {
		if (e?.code !== "CANCELLED" && e?.code !== "INTERRUPTED") {
			console.warn("Book download failed", e);
			Crashlytics.recordException(
				`[Book] download failed (${e?.code ?? "?"}) ${book.id}: ${e?.message ?? e}`,
			);
		}
		return false;
	} finally {
		signal?.removeEventListener("abort", onAbort);
		listener.remove();
	}
};

export const saveBook = async (
	book: Book,
	onProgress?: (percent: number, loaded: number, total: number) => void,
	signal?: AbortSignal,
): Promise<boolean> => {
	try {
		// Initial update with pre-filled size to show instant feedback
		if (onProgress) onProgress(0, 0, book.sizeBytes || 0);
		if (!book.url) return false;
		const directUrl = getDirectPdfUrl(book.url);

		if (isAndroid()) {
			// Registers the book itself (with its exact filename) on success.
			return await downloadBookAndroid(book, directUrl, onProgress, signal);
		}

		if (Capacitor.isNativePlatform()) {
			// --- iOS NATIVE DOWNLOAD STRATEGY ---
			// iOS uses Directory.Documents (visible in Files app under "On My iPhone > Prem Bhakti")
			const uniqueFileName = `${getSafeBookTitle(book.title || "", book.id)}.pdf`;
			const iosFilePath = `${BOOK_DIR_IOS}/${uniqueFileName}`;
			let totalBytes = book.sizeBytes || 0;
			if (totalBytes === 0) totalBytes = await getFileSize(directUrl);
			try {
				await Filesystem.mkdir({
					path: BOOK_DIR_IOS,
					directory: Directory.Documents,
					recursive: true,
				});
			} catch (_) {}
			try {
				await Filesystem.deleteFile({
					path: iosFilePath,
					directory: Directory.Documents,
				});
			} catch (_) {}
			const uriResult = await Filesystem.getUri({
				path: iosFilePath,
				directory: Directory.Documents,
			});
			const result = await FileTransfer.downloadFile({
				path: uriResult.uri,
				url: directUrl,
			});
			if (!result.path) return false;
			if (onProgress) onProgress(100, totalBytes, totalBytes);
			registerBook(book.id, uniqueFileName);
			return true;
		}

		// --- WEB DOWNLOAD STRATEGY ---
		// iOS Safari: fetch-blob fails due to CORS + memory limits on large PDFs.
		// Instead, open the PDF directly — Safari has a built-in PDF viewer and
		// the user can use the Share sheet to save it to Files / iCloud Drive.
		if (isIOSWeb()) {
			window.open(directUrl, "_blank", "noopener,noreferrer");
			if (onProgress) onProgress(100, 100, 100);
			registerBook(book.id);
			return true;
		}

		// Desktop / Android Chrome: streaming fetch → Cache API
		const cdnUrl = "https://mute-hat-56f3.chaitanyaprembhakti.workers.dev";
		const strategies: string[] = [directUrl];
		if (
			directUrl.includes("github.com") ||
			directUrl.includes("githubusercontent.com")
		) {
			strategies.push(`https://mirror.ghproxy.com/${directUrl}`);
		}
		strategies.push(`${cdnUrl}/?url=${encodeURIComponent(directUrl)}`);
		strategies.push(`https://api.codetabs.com/v1/proxy?quest=${directUrl}`);

		let finalBlob: Blob | null = null;
		for (const url of strategies) {
			if (signal?.aborted) return false;
			try {
				const response = await fetch(url, { signal });
				if (!response.ok) continue;

				// Prefer pre-filled size if header is missing or 0
				let total = book.sizeBytes || 0;
				if (total === 0) {
					const contentLength = response.headers.get("content-length");
					total = contentLength ? parseInt(contentLength, 10) : 0;
				}

				if (!response.body) {
					finalBlob = await response.blob();
					if (onProgress && total) onProgress(100, total, total);
				} else {
					const reader = response.body.getReader();
					const chunks: Uint8Array[] = [];
					let received = 0;
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						chunks.push(value);
						received += value.length;
						if (onProgress) {
							const percent = total ? (received / total) * 100 : 0;
							onProgress(percent, received, total || received);
						}
					}
					finalBlob = new Blob(chunks as BlobPart[]);
				}

				// A proxy/HTML error page is not a book: require the PDF magic bytes.
				const magic = await finalBlob.slice(0, 4).text();
				if (magic !== "%PDF") {
					finalBlob = null;
					continue;
				}
				break;
			} catch (e: any) {
				if (e.name === "AbortError") return false;
			}
		}

		if (!finalBlob) return false;

		if (typeof caches !== "undefined") {
			const cache = await caches.open(CACHE_NAME);
			await cache.put(
				`book-${book.id}`,
				new Response(finalBlob, {
					headers: { "Content-Type": "application/pdf" },
				}),
			);
		}

		// Trigger browser download for desktop/web PWA
		const objectUrl = window.URL.createObjectURL(finalBlob);
		const a = document.createElement("a");
		a.href = objectUrl;
		a.download = `${getSafeBookTitle(book.title || "", book.id)}.pdf`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);

		registerBook(book.id);
		return true;
	} catch (error) {
		console.error("Save Book Error:", error);
		return false;
	}
};

// --- Read ---

/**
 * Returns either raw Uint8Array data (small files on native) or a URL (large native
 * files, and Web object URLs) to feed PDF.js without WebView CORS / Range issues.
 */
export const getCachedBookSource = async (
	bookId: string,
	title?: string,
): Promise<{ data?: Uint8Array; url?: string } | null> => {
	try {
		if (Capacitor.isNativePlatform()) {
			const directory = isAndroid() ? Directory.External : Directory.Documents;
			const bookDir = isAndroid() ? BOOK_DIR_ANDROID : BOOK_DIR_IOS;

			const tryRead = async (path: string) => {
				let size = 0;
				try {
					size = (await Filesystem.stat({ path, directory })).size;
				} catch {
					return null; // not on disk
				}
				if (size <= MAX_INLINE_READ_BYTES) {
					try {
						// Direct bytes avoid _capacitor_file_ Range (206 vs 200) issues in PDF.js.
						const res = await Filesystem.readFile({ path, directory });
						const cleanBase64 =
							typeof res.data === "string" ? res.data.replace(/\s/g, "") : "";
						if (cleanBase64) {
							const binaryStr = atob(cleanBase64);
							const bytes = new Uint8Array(binaryStr.length);
							for (let i = 0; i < binaryStr.length; i++) {
								bytes[i] = binaryStr.charCodeAt(i);
							}
							return { data: bytes };
						}
					} catch (e) {
						console.warn("getCachedBookSource readFile failed, using URL:", e);
					}
				}
				try {
					const uriResult = await Filesystem.getUri({ path, directory });
					return { url: Capacitor.convertFileSrc(uriResult.uri) };
				} catch {
					return null;
				}
			};

			const exactFileName = readPaths()[bookId];
			if (exactFileName) {
				const res = await tryRead(`${bookDir}/${exactFileName}`);
				if (res) return res;
			}
			if (!isAndroid()) {
				// iOS: older downloads were saved by title without a registry entry
				const res = await tryRead(
					`${bookDir}/${getSafeBookTitle(title || "", bookId)}.pdf`,
				);
				if (res) return res;
			}
			return null;
		}

		if (typeof caches !== "undefined") {
			const cache = await caches.open(CACHE_NAME);
			const response = await cache.match(`book-${bookId}`);
			if (response) {
				// Raw bytes, not a blob: URL — PDF.js fetches URLs inside its worker,
				// where a blob URL made on this page fails ("Unexpected server response (0)").
				return { data: new Uint8Array(await response.arrayBuffer()) };
			}
		}
		return null;
	} catch (error) {
		console.error("getCachedBookSource error:", error);
		return null;
	}
};

// --- Delete ---

export const deleteBook = async (
	bookId: string,
	title?: string,
): Promise<void> => {
	try {
		if (isAndroid()) {
			await NativeDownload.deleteBookFiles({ bookId });
		} else if (Capacitor.isNativePlatform()) {
			const names = new Set([
				readPaths()[bookId],
				`${getSafeBookTitle(title || "", bookId)}.pdf`,
				`${getOldSafeBookTitle(title || "", bookId)}.pdf`,
			]);
			for (const name of names) {
				if (!name) continue;
				try {
					await Filesystem.deleteFile({
						path: `${BOOK_DIR_IOS}/${name}`,
						directory: Directory.Documents,
					});
				} catch (_) {}
			}
		} else if (typeof caches !== "undefined") {
			try {
				const cache = await caches.open(CACHE_NAME);
				await cache.delete(`book-${bookId}`);
			} catch (_e) {}
		}
	} catch (error) {
		console.error("Delete book failed:", error);
	}
	forgetBook(bookId);
};

// --- Open (Android) ---

export type OpenBookResult = "opened" | "not_found" | "no_viewer" | "error";

/**
 * Opens a downloaded book in the system PDF app chooser (Android).
 *  - "not_found": the file is gone — the registry entry is dropped so the UI
 *    offers a fresh download.
 *  - "no_viewer" / "error": the file is fine; callers fall back to the in-app
 *    reader. The book must NEVER be deleted here — doing that on phones without
 *    a PDF app made every "Read" tap delete the book and force a re-download.
 * Non-Android platforms always get "no_viewer" (they use the in-app reader).
 */
export const openDownloadedBook = async (
	book: Book,
): Promise<OpenBookResult> => {
	if (!isAndroid()) return "no_viewer";
	if (localStorage.getItem(STORAGE_V3_KEY) !== "done") {
		// Registry still points at the old public folder: migrate first (the user
		// just tapped a book, so a permission prompt on Android ≤ 9 is in context).
		await reconcileDownloadedBooks({ allowPermissionPrompt: true });
	}
	const fileName = readPaths()[book.id];
	if (!fileName) {
		forgetBook(book.id);
		return "not_found";
	}
	try {
		await NativeDownload.openBookFile({ fileName });
		return "opened";
	} catch (e: any) {
		if (e?.code === "NOT_FOUND") {
			forgetBook(book.id);
			return "not_found";
		}
		if (e?.code === "NO_VIEWER") return "no_viewer";
		console.error("openDownloadedBook failed:", e);
		return "error";
	}
};

// --- Startup reconcile + one-time migration ---

const loadCatalog = (): Book[] => {
	try {
		const stored = JSON.parse(localStorage.getItem("cpbs_all_books") || "[]");
		if (Array.isArray(stored) && stored.length > 0) return stored;
	} catch {}
	return BOOKS_DATA;
};

let migrationPromise: Promise<void> | null = null;

/**
 * One-time (Android): move each registered book's best copy out of the old public
 * Download/Prem Bhakti/Books folder into the app Books dir, then wipe that folder —
 * clearing the duplicate "(1)", "-1", partial and orphaned files older builds left.
 * Duplicates are deleted BEFORE copying so the copy has room.
 *
 * On Android 11+ files left by a previous install are not owned by the app and
 * cannot be seen or deleted without the user; everything else is cleaned.
 * On Android ≤ 9 the old folder needs the storage permission: without it we only
 * prompt when `allowPrompt` (Books screen), never at startup.
 */
const migrateLegacyBookStorage = (allowPrompt: boolean): Promise<void> => {
	if (!isAndroid() || localStorage.getItem(STORAGE_V3_KEY) === "done") {
		return Promise.resolve();
	}
	if (!migrationPromise) {
		migrationPromise = runLegacyMigration(allowPrompt).finally(() => {
			migrationPromise = null;
		});
	}
	return migrationPromise;
};

const runLegacyMigration = async (allowPrompt: boolean) => {
	const oldIds = getDownloadedBookIds();
	const oldPaths = readPaths();

	let legacy = await NativeDownload.listLegacyBookFiles();
	if (legacy.needsPermission) {
		if (oldIds.length === 0 && legacy.files.length === 0) {
			// Nothing was ever downloaded here — nothing to migrate.
			safeLocalSet(STORAGE_V3_KEY, "done");
			writeRegistry([], {});
			return;
		}
		if (!allowPrompt) return; // retry from the Books screen
		try {
			await Filesystem.requestPermissions();
		} catch {}
		legacy = await NativeDownload.listLegacyBookFiles();
	}

	const catalog = new Map(loadCatalog().map((b) => [b.id, b]));
	const chosen: { id: string; ref: string; book: Book }[] = [];
	// Registered books first, then every other catalog book: old builds often
	// finished a download AFTER the JS 5-min timeout had already reported
	// failure, so the complete file sits in the folder but was never registered.
	// Rescue those too instead of wiping them.
	const candidateIds = [
		...oldIds,
		...[...catalog.keys()].filter((id) => !oldIds.includes(id)),
	];
	for (const id of candidateIds) {
		const book: Book = catalog.get(id) ?? { id, title: "", fileName: "PDF" };
		const safeTitle = getSafeBookTitle(book.title || "", id);
		const oldSafeTitle = getOldSafeBookTitle(book.title || "", id);
		const best = legacy.files
			.filter(
				(f) =>
					f.valid &&
					(f.name === oldPaths[id] ||
						f.name === `${id}.pdf` ||
						isBookFileNameMatch(f.name, safeTitle) ||
						isBookFileNameMatch(f.name, oldSafeTitle)),
			)
			.sort((a, b) => b.mtime - a.mtime)[0];
		if (best && !chosen.some((c) => c.ref === best.ref)) {
			chosen.push({ id, ref: best.ref, book });
		}
	}

	// 1. Free space: delete everything except the one good copy per book.
	await NativeDownload.wipeLegacyBookFolder({
		keep: chosen.map((c) => c.ref),
	}).catch(() => {});

	// 2. Copy the good copies into the new dir.
	const newPaths: Record<string, string> = {};
	for (const c of chosen) {
		try {
			const res = await NativeDownload.importLegacyBook({
				ref: c.ref,
				bookId: c.id,
				fileName: getBookFileName(c.book),
			});
			newPaths[c.id] = res.fileName;
		} catch (e) {
			console.warn(`[BookMigrate] could not import book ${c.id}`, e);
		}
	}

	// 3. Remove the originals too; the old folder is now empty.
	const wiped = await NativeDownload.wipeLegacyBookFolder().catch(() => null);
	console.log(
		`[BookMigrate] imported ${Object.keys(newPaths).length}/${oldIds.length} books, legacy files left undeletable: ${wiped?.failed ?? "?"}`,
	);

	writeRegistry(Object.keys(newPaths), newPaths);
	safeLocalSet(STORAGE_V3_KEY, "done");
};

/**
 * Makes the registry match what is really on disk. Android: runs the one-time
 * migration, then asks native to finalize downloads that finished while the app
 * was closed and to delete partial/invalid/duplicate files; whatever is left is
 * exactly the downloaded set. Runs in the background — errors are swallowed.
 */
export const reconcileDownloadedBooks = async (
	options: { allowPermissionPrompt?: boolean } = {},
): Promise<void> => {
	if (!Capacitor.isNativePlatform()) return;
	try {
		if (isAndroid()) {
			await migrateLegacyBookStorage(!!options.allowPermissionPrompt).catch(
				(e) => console.warn("[BookMigrate] failed", e),
			);
			// Migration still waiting for the storage permission (Android ≤ 9): keep
			// the old registry intact so the books can still be imported later.
			if (localStorage.getItem(STORAGE_V3_KEY) !== "done") return;
			const { files } = await NativeDownload.listBookFiles();
			const paths: Record<string, string> = {};
			for (const f of files) paths[f.bookId] = f.fileName;
			const onDisk = new Set(Object.keys(paths));
			// Keep existing order, then append books that finished while the app was closed.
			const ids = getDownloadedBookIds().filter((id) => onDisk.has(id));
			for (const id of onDisk) if (!ids.includes(id)) ids.push(id);
			writeRegistry(ids, paths);
			return;
		}

		// iOS: drop registry entries whose file is gone or is not a real PDF.
		const paths = readPaths();
		const validIds: string[] = [];
		for (const bookId of getDownloadedBookIds()) {
			const filename = paths[bookId];
			if (!filename) continue;
			try {
				const stat = await Filesystem.stat({
					path: `${BOOK_DIR_IOS}/${filename}`,
					directory: Directory.Documents,
				});
				if (stat.size >= 10 * 1024) validIds.push(bookId);
				else delete paths[bookId];
			} catch {
				delete paths[bookId];
			}
		}
		writeRegistry(validIds, paths);
	} catch (e) {
		console.warn("[BookValidate] Registry validation failed:", e);
	}
};

/**
 * M5 companion: For web PWA — verifies each ID in the downloaded-books registry
 * actually has a matching Cache API entry. Cleans up stale IDs left behind after
 * a web refresh that deleted the cache.
 */
export const syncWebBookRegistry = async (): Promise<void> => {
	if (Capacitor.isNativePlatform() || typeof caches === "undefined") return;
	try {
		const cache = await caches.open(CACHE_NAME);
		const bookIds = getDownloadedBookIds();
		const validIds: string[] = [];
		for (const id of bookIds) {
			if (await cache.match(`book-${id}`)) validIds.push(id);
		}
		if (validIds.length !== bookIds.length) {
			writeRegistry(validIds, readPaths());
			console.log(
				`[WebBookSync] Removed ${bookIds.length - validIds.length} stale web book registry entries`,
			);
		}
	} catch (e) {
		console.warn("[WebBookSync] Failed:", e);
	}
};

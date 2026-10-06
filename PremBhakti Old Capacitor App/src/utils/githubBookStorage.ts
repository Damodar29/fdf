import { safeLocalSet } from "../../utils/safeLocalSet";
/**
 * src/utils/githubBookStorage.ts
 *
 * Saves and reads Book data via Firebase Storage SDK.
 * Replaces the previous Firebase Function (saveBookData) approach.
 *
 * WRITE: Direct Firebase Storage SDK upload (instant, no cold start)
 * READ:  CDN Worker â†’ Firebase Storage (via fetchFirebaseStorageJson in network.ts)
 */

import type { Book } from "../../types";
import {
	markWriteFinished,
	markWriteStarted,
	saveJsonToStorage,
	updateBundleFile,
	updateIndexFile,
} from "../../utils/firebaseDataStorage";
import { fetchFirebaseStorageJson } from "../../utils/network";

const TAG = "bookdata";

const hashString = (str: string): string => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return (hash >>> 0).toString(16) + str.length;
};

// â”€â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const saveBookToFirebase = async (
	book: Book,
	onProgress?: (msg: string) => void,
	currentBooks?: Book[], // Pass local list to avoid reading stale cloud bundle
): Promise<boolean> => {
	try {
		markWriteStarted(TAG, `Save book ${book.id}`);
		onProgress?.("Saving book file...");

		// 1. Save individual book file
		await saveJsonToStorage(TAG, `${book.id}.json`, book);

		onProgress?.("Updating bundle...");

		// 2. Update bundle.json (BEFORE index.json — see markWriteStarted docs)
		// If currentBooks provided, use local state directly (avoids stale cloud read race condition).
		// Otherwise fall back to read-modify-write from cloud.
		if (currentBooks) {
			await saveJsonToStorage(TAG, "bundle.json", currentBooks);
		} else {
			await updateBundleFile(TAG, (items) => {
				const idx = items.findIndex((b: any) => b.id === book.id);
				if (idx !== -1) {
					const updated = [...items];
					updated[idx] = book;
					return updated;
				}
				return [...items, book];
			});
		}

		onProgress?.("Updating index...");

		// 3. Update index.json last
		const contentHash = hashString(book.title + (book.url || ""));
		const meta = {
			id: book.id,
			title: book.title,
			fileName: book.fileName,
			url: book.url,
			sizeBytes: book.sizeBytes,
			displaySize: book.displaySize,
			isHidden: book.isHidden === true,
			contentHash,
		};

		const bundleTimestamp = await updateIndexFile(TAG, "books", (items) => {
			const idx = items.findIndex((b: any) => b.id === book.id);
			if (idx !== -1) {
				const updated = [...items];
				updated[idx] = meta;
				return updated;
			}
			return [...items, meta];
		});

		safeLocalSet("cpbs_books_bundle_time", String(bundleTimestamp));
		markWriteFinished(TAG);

		onProgress?.("Done!");
		return true;
	} catch (error: any) {
		console.error("saveBookToGithub Error:", error);
		throw new Error(
			error?.message || "Failed to save book to Firebase Storage",
		);
	}
};

// â”€â”€â”€ Read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const fetchBooksIndex = async (): Promise<any[]> => {
	try {
		const data = await fetchFirebaseStorageJson(TAG, "index.json");
		return data.books || [];
	} catch {
		return [];
	}
};

export const fetchBookFile = async (bookId: string): Promise<Book | null> => {
	try {
		return await fetchFirebaseStorageJson(TAG, `${bookId}.json`);
	} catch {
		return null;
	}
};

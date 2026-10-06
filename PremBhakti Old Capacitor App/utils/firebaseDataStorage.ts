/**
 * utils/firebaseDataStorage.ts
 *
 * Firebase Storage-based JSON data storage utilities.
 * Replaces the previous Firebase Functions → GitHub Releases approach.
 *
 * Architecture:
 *   WRITE: Admin Panel → Firebase Storage SDK (direct, instant, no cold start)
 *   READ:  CDN Worker (Cloudflare) → Firebase Storage public URL (cached at edge)
 *
 * File Structure in Firebase Storage:
 *   app-data/
 *   ├── bhajandata/
 *   │   ├── index.json     ← lightweight index of all bhajans
 *   │   ├── bundle.json    ← full data bundle (for sync)
 *   │   └── {id}.json      ← individual bhajan
 *   ├── bookdata/
 *   │   ├── index.json, bundle.json, {id}.json
 *   ├── lecturedata/
 *   │   ├── index.json, bundle.json, {id}.json
 *   └── appconfig/
 *       ├── categories.json
 *       └── authors.json
 */

import { deleteObject, getBytes, ref, uploadString } from "firebase/storage";
import { storage } from "../services/firebase";

const STORAGE_BASE = "app-data";

/** Build a consistent Firebase Storage path for a given tag + filename */
const storagePath = (tag: string, fileName: string): string =>
	`${STORAGE_BASE}/${tag}/${fileName}`;

// ─── Core CRUD ────────────────────────────────────────────────────────────────

/**
 * Save/overwrite a JSON file in Firebase Storage.
 * Requires Firebase Auth (admin must be signed in).
 */
export const saveJsonToStorage = async (
	tag: string,
	fileName: string,
	data: any,
): Promise<void> => {
	const storageRef = ref(storage, storagePath(tag, fileName));
	await uploadString(storageRef, JSON.stringify(data, null, 2), "raw", {
		contentType: "application/json; charset=utf-8",
	});
};

/**
 * Read a JSON file from Firebase Storage.
 * Used internally for admin-side read-modify-write operations.
 * NOTE: End-user reads go through the CDN Worker, not this function.
 */
export const readJsonFromStorage = async (
	tag: string,
	fileName: string,
): Promise<any> => {
	const storageRef = ref(storage, storagePath(tag, fileName));
	const bytes = await getBytes(storageRef);
	const text = new TextDecoder("utf-8").decode(bytes);
	return JSON.parse(text);
};

/**
 * Delete a JSON file from Firebase Storage.
 * Used when a bhajan/book/lecture ID changes (delete old file).
 * Silently ignores "not found" errors.
 */
export const deleteJsonFromStorage = async (
	tag: string,
	fileName: string,
): Promise<void> => {
	try {
		const storageRef = ref(storage, storagePath(tag, fileName));
		await deleteObject(storageRef);
	} catch (e: any) {
		// Ignore "file not found" — it's fine if we're deleting a non-existent file
		if (e?.code !== "storage/object-not-found") throw e;
	}
};

// ─── Index / Bundle Atomic Helpers ───────────────────────────────────────────

/**
 * Reads the current index.json for a tag, applies updateFn to the items array,
 * then writes the updated index back. Returns the bundleTimestamp.
 *
 * @param tag       - e.g. 'bhajandata'
 * @param listKey   - the key in index.json that holds the array, e.g. 'bhajans'
 * @param updateFn  - function that receives current items and returns new items
 */
export const updateIndexFile = async (
	tag: string,
	listKey: string,
	updateFn: (items: any[]) => any[],
): Promise<number> => {
	let indexData: any = { lastUpdated: Date.now(), total: 0, [listKey]: [] };

	try {
		indexData = await readJsonFromStorage(tag, "index.json");
		if (!Array.isArray(indexData[listKey])) indexData[listKey] = [];
	} catch {
		// First time — index doesn't exist yet, use default
	}

	const bundleTimestamp = Date.now();
	indexData[listKey] = updateFn(indexData[listKey]);
	indexData.total = indexData[listKey].length;
	indexData.lastUpdated = bundleTimestamp;
	indexData.bundleUpdated = bundleTimestamp;

	await saveJsonToStorage(tag, "index.json", indexData);
	return bundleTimestamp;
};

/**
 * Reads the current bundle.json for a tag, applies updateFn to the items array,
 * then writes the updated bundle back.
 *
 * @param tag      - e.g. 'bhajandata'
 * @param updateFn - function that receives current items[] and returns new items[]
 */
export const updateBundleFile = async (
	tag: string,
	updateFn: (items: any[]) => any[],
): Promise<void> => {
	let bundleData: any[] = [];

	try {
		const fetched = await readJsonFromStorage(tag, "bundle.json");
		bundleData = Array.isArray(fetched) ? fetched : [];
	} catch {
		// First time — bundle doesn't exist yet
	}

	bundleData = updateFn(bundleData);
	await saveJsonToStorage(tag, "bundle.json", bundleData);
};

// ─── Crash safety for multi-step writes ───────────────────────────────────────
//
// A save/rebuild writes several files one after another. Apps on phones get
// killed mid-way (swipe from recents, OS memory pressure), so:
//  1. Always write bundle.json BEFORE index.json. index.json's bundleUpdated
//     timestamp is what tells every phone "new data, re-download the bundle".
//     Written first, a kill before the bundle write made phones download the OLD
//     bundle, store the NEW timestamp, and never fetch the real update.
//  2. Record the operation as pending until it finishes, so the admin panel can
//     say "the last save/rebuild did not finish — run it again".

const PENDING_KEY = "cpbs_admin_pending_writes";

export interface PendingWrite {
	tag: string;
	label: string;
	startedAt: number;
}

const readPending = (): Record<string, PendingWrite> => {
	try {
		return JSON.parse(localStorage.getItem(PENDING_KEY) || "{}");
	} catch {
		return {};
	}
};

const writePending = (all: Record<string, PendingWrite>) => {
	try {
		localStorage.setItem(PENDING_KEY, JSON.stringify(all));
	} catch {}
};

export const markWriteStarted = (tag: string, label: string) => {
	writePending({
		...readPending(),
		[tag]: { tag, label, startedAt: Date.now() },
	});
};

export const markWriteFinished = (tag: string) => {
	const all = readPending();
	delete all[tag];
	writePending(all);
};

/** The unfinished write for a tag (app killed / error mid-way), if any. */
export const getPendingWrite = (tag: string): PendingWrite | null =>
	readPending()[tag] ?? null;

/**
 * Fetches every id, retrying failures (up to `passes` rounds). A rebuild must
 * never write a bundle with holes: one network blip used to silently drop
 * those items from bundle.json for every user.
 *
 * `fetchOne` throws on a network/read failure (retried, reported in `failed`)
 * and returns null for a file that loaded fine but is not an item (reported in
 * `skipped`, so one stray JSON file can't block every rebuild).
 */
export const fetchAllWithRetry = async <T>(
	ids: string[],
	fetchOne: (id: string) => Promise<T | null>,
	onProgress?: (done: number, total: number, pass: number) => void,
	passes = 3,
): Promise<{ items: T[]; failed: string[]; skipped: string[] }> => {
	const items: T[] = [];
	const skipped: string[] = [];
	let pending = ids;
	for (let pass = 1; pass <= passes && pending.length > 0; pass++) {
		if (pass > 1) await new Promise((r) => setTimeout(r, 1500 * pass));
		const failedThisPass: string[] = [];
		let done = 0;
		const batchSize = 20;
		for (let i = 0; i < pending.length; i += batchSize) {
			await Promise.all(
				pending.slice(i, i + batchSize).map(async (id) => {
					try {
						const item = await fetchOne(id);
						if (item) items.push(item);
						else skipped.push(id);
					} catch {
						failedThisPass.push(id);
					} finally {
						done++;
						if (done % 10 === 0 || done === pending.length) {
							onProgress?.(done, pending.length, pass);
						}
					}
				}),
			);
		}
		pending = failedThisPass;
	}
	return { items, failed: pending, skipped };
};

// ─── One-Time Migration Helper ────────────────────────────────────────────────

/**
 * Migrates a single JSON file from the GitHub CDN to Firebase Storage.
 * Call this once per file during the admin migration process.
 *
 * Usage (in browser console or migration UI):
 *   import { migrateJsonFile } from './utils/firebaseDataStorage';
 *   await migrateJsonFile('bhajandata', 'index.json', cdnBase);
 */
export const migrateJsonFile = async (
	tag: string,
	fileName: string,
	cdnBase: string,
): Promise<boolean> => {
	try {
		const _url = `${cdnBase}/${encodeURIComponent(
			`chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/${tag}/${fileName}`,
		)}`;
		// Use direct GitHub URL for migration
		const githubUrl = `https://github.com/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/releases/download/${tag}/${fileName}?_c=${Date.now()}`;
		const cdnUrl = cdnBase
			? `${cdnBase}/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/${tag}/${fileName}?_c=${Date.now()}`
			: githubUrl;

		const res = await fetch(cdnUrl, { cache: "no-store" });
		if (!res.ok) {
			console.warn(
				`[Migration] ${tag}/${fileName} not found on GitHub (status ${res.status}), skipping.`,
			);
			return false;
		}
		const data = await res.json();
		await saveJsonToStorage(tag, fileName, data);
		console.log(
			`[Migration] ✅ ${tag}/${fileName} migrated to Firebase Storage`,
		);
		return true;
	} catch (e) {
		console.error(`[Migration] ❌ Failed to migrate ${tag}/${fileName}:`, e);
		return false;
	}
};

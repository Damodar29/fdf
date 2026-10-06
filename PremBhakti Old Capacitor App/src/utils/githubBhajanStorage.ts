import { safeLocalSet } from "../../utils/safeLocalSet";
/**
 * src/utils/githubBhajanStorage.ts
 *
 * Saves and reads Bhajan data via Firebase Storage SDK.
 * Replaces the previous Firebase Function (saveBhajanData) approach.
 *
 * WRITE: Direct Firebase Storage SDK upload (instant, no cold start)
 * READ:  CDN Worker â†’ Firebase Storage (via fetchFirebaseStorageJson in network.ts)
 */

import { doc, runTransaction } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import type { Bhajan } from "../../types";
import {
	deleteJsonFromStorage,
	fetchAllWithRetry,
	markWriteFinished,
	markWriteStarted,
	readJsonFromStorage,
	saveJsonToStorage,
	updateIndexFile,
} from "../../utils/firebaseDataStorage";
import { fetchFirebaseStorageJson } from "../../utils/network";
import { parseRawBhajanText } from "../../utils/textProcessor";

const TAG = "bhajandata";

// â”€â”€â”€ Normalise helpers (same logic as Firebase Function had) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const hashString = (str: string): string => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return (hash >>> 0).toString(16) + str.length;
};

const normalizeBhajan = (bhajan: any) => {
	// Strip "bhajan-" prefix from id and songNumber if present
	const rawSongNum = String(
		bhajan?.songNumber || bhajan?.bhajan_id || bhajan?.id || "",
	)
		.replace(/^bhajan-/i, "")
		.trim();
	const rawId = String(bhajan?.id || "")
		.replace(/^bhajan-/i, "")
		.trim();

	const numericSongNumber = rawSongNum.replace(/\D/g, "");
	const normalizedId = numericSongNumber || rawId;

	return {
		...bhajan,
		id: normalizedId,
		songNumber: numericSongNumber || normalizedId,
	};
};

const simplifyBhajan = (bhajan: any) => ({
	id: bhajan.id,
	bhajan_id: bhajan.songNumber || bhajan.id,
	title: bhajan.title,
	content: bhajan.content,
	...(bhajan.author ? { author: bhajan.author } : {}),
	...(bhajan.categories ? { categories: bhajan.categories } : {}),
	...(Array.isArray(bhajan.audio) ? { audio: bhajan.audio } : {}),
	...(bhajan.isHidden === true ? { isHidden: true } : {}),
});

// ─── Safe saving (several admins, possibly stale local data) ─────────────────
//
// Admins edit from phones whose local copy can be old, and two of them can save
// at the same moment. So a save never rebuilds the bundle from the local list:
//  1. it takes a short write lock (Firestore transaction), so two saves can't
//     interleave their bundle/index writes;
//  2. it reads the current bundle straight from Storage (not the CDN);
//  3. it refuses a song number another bhajan already has and — unless the
//     admin chose to overwrite — a bhajan that was changed or removed in the
//     cloud after the editor opened;
//  4. it applies only this change on top of the cloud bundle.
// Nothing is written until every check has passed.

export type BhajanSaveErrorKind =
	| "idTaken"
	| "changed"
	| "deleted"
	| "missing"
	| "locked";

export class BhajanSaveError extends Error {
	kind: BhajanSaveErrorKind;
	/** The cloud version, for "changed". */
	cloud?: Bhajan;
	/** The full, current cloud list — callers refresh their local copy with it. */
	latest?: Bhajan[];

	constructor(
		kind: BhajanSaveErrorKind,
		message: string,
		extra: { cloud?: Bhajan; latest?: Bhajan[] } = {},
	) {
		super(message);
		this.name = "BhajanSaveError";
		this.kind = kind;
		this.cloud = extra.cloud;
		this.latest = extra.latest;
	}
}

export interface SaveBhajanResult {
	/** The cloud list after the save (parsed like the app parses it). */
	bhajans: Bhajan[];
	bundleTimestamp: number;
}

/** "72", "072" and "bhajan-72" are the same song number. */
const songNumberKey = (value?: string | number | null): string => {
	const raw = String(value ?? "")
		.replace(/^bhajan-/i, "")
		.trim();
	const digits = raw.replace(/\D/g, "");
	return digits ? String(Number.parseInt(digits, 10)) : raw;
};

export const isSameSongNumber = (
	a?: string | number | null,
	b?: string | number | null,
): boolean => {
	const key = songNumberKey(a);
	return key !== "" && key === songNumberKey(b);
};

/**
 * Song numbers keep the existing format: 001–099 are three digits, 100+ as is.
 * Returns "" when there is no valid number (empty, or 0).
 */
export const formatSongNumber = (value: string): string => {
	const digits = value.replace(/\D/g, "");
	if (!digits) return "";
	const num = Number.parseInt(digits, 10);
	if (!num) return "";
	return num < 100 ? String(num).padStart(3, "0") : String(num);
};

// Compared through the app's own parser, so clean-up done on load (e.g. ।। → ॥,
// known author names) never counts as "someone else changed it".
const toParsed = (bhajan: any): Bhajan | undefined =>
	parseRawBhajanText([simplifyBhajan(normalizeBhajan(bhajan))])[0];

const bhajanFingerprint = (bhajan: Bhajan): string =>
	JSON.stringify([
		bhajan.title,
		bhajan.content,
		bhajan.author ?? "",
		bhajan.isHidden === true,
		(bhajan.audio ?? []).map((a) => [a.id ?? "", a.singer ?? "", a.url ?? ""]),
		bhajan.categories
			? Object.keys(bhajan.categories)
					.sort()
					.map((key) => [key, bhajan.categories?.[key]])
			: null,
	]);

const toIndexMeta = (stored: any) => ({
	id: stored.id,
	title: stored.title,
	songNumber: stored.bhajan_id,
	author: stored.author,
	audioCount: stored.audio?.length || 0,
	isHidden: stored.isHidden === true,
	contentHash: hashString(
		stored.title + stored.content + JSON.stringify(stored.audio || []),
	),
});

/** Replaces the items with these ids by `replacements`, keeping their place. */
const replaceInList = (
	items: any[],
	ids: Set<string>,
	replacements: any[],
): any[] => {
	const out: any[] = [];
	let inserted = false;
	for (const item of items) {
		if (ids.has(item?.id)) {
			if (!inserted) out.push(...replacements);
			inserted = true;
			continue;
		}
		out.push(item);
	}
	if (!inserted) out.push(...replacements);
	return out;
};

/** The current bundle, read straight from Storage (never a CDN copy). */
const readCloudBundle = async (): Promise<any[]> => {
	const data = await readJsonFromStorage(TAG, "bundle.json");
	if (Array.isArray(data)) return data;
	if (Array.isArray(data?.bhajans)) return data.bhajans;
	throw new Error("bundle.json has an unexpected format");
};

/** Makes this device's copy match what was just written to the cloud. */
const keepLocalCopy = (bundle: any[], bundleTimestamp: number): Bhajan[] => {
	const bhajans = parseRawBhajanText(bundle);
	safeLocalSet("cpbs_all_bhajans", JSON.stringify(bhajans));
	safeLocalSet("cpbs_bhajans_bundle_time", String(bundleTimestamp));
	return bhajans;
};

const LOCK_TTL_MS = 2 * 60 * 1000;

/**
 * Runs `work` while holding the bhajan write lock. A lock whose holder
 * vanished (app closed mid-save) expires after two minutes; a long save keeps
 * its own lock alive.
 */
const withBhajanWriteLock = async <T>(
	label: string,
	work: () => Promise<T>,
): Promise<T> => {
	const lockRef = doc(db, "app_config", "bhajandata_write_lock");
	const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const by = auth.currentUser?.email || auth.currentUser?.phoneNumber || "";

	await runTransaction(db, async (tx) => {
		const current = (await tx.get(lockRef)).data();
		const left = Number(current?.expiresAt || 0) - Date.now();
		// The upper bound ignores a lock stamped by a device whose clock is far ahead.
		if (current?.token && left > 0 && left < LOCK_TTL_MS + 60_000) {
			throw new BhajanSaveError(
				"locked",
				`${current.by || "Another admin"} is saving bhajans right now. Please try again in a few seconds.`,
			);
		}
		tx.set(lockRef, { token, by, label, expiresAt: Date.now() + LOCK_TTL_MS });
	});

	const keepAlive = setInterval(() => {
		runTransaction(db, async (tx) => {
			const current = (await tx.get(lockRef)).data();
			if (current?.token === token)
				tx.update(lockRef, { expiresAt: Date.now() + LOCK_TTL_MS });
		}).catch(() => {});
	}, 30_000);

	try {
		return await work();
	} finally {
		clearInterval(keepAlive);
		await runTransaction(db, async (tx) => {
			const current = (await tx.get(lockRef)).data();
			if (current?.token === token) tx.delete(lockRef);
		}).catch(() => {});
	}
};

/**
 * Loads the cloud bhajans when they are newer than this device's copy.
 * Returns null when the local copy is already the latest.
 */
export const loadLatestBhajansIfChanged = async (
	onDownloading?: () => void,
): Promise<Bhajan[] | null> => {
	const index = await readJsonFromStorage(TAG, "index.json");
	const remoteTime = Number(index?.bundleUpdated || index?.lastUpdated || 0);
	const localTime = Number(
		localStorage.getItem("cpbs_bhajans_bundle_time") || 0,
	);
	if (remoteTime && remoteTime === localTime) return null;
	onDownloading?.();
	return keepLocalCopy(await readCloudBundle(), remoteTime);
};

/** Song numbers in use in the cloud right now. */
export const fetchCloudBhajanIds = async (): Promise<string[]> => {
	const index = await readJsonFromStorage(TAG, "index.json");
	return Array.isArray(index?.bhajans)
		? index.bhajans.map((b: any) => String(b.id))
		: [];
};

/**
 * Saves one bhajan (new, edited or renumbered).
 *
 * `base` is the bhajan as it was when the editor opened — null for a new one.
 * `overwrite` saves even if the cloud copy changed or was removed meanwhile.
 * Throws BhajanSaveError when a check fails; nothing is written then.
 */
export const saveBhajanToFirebase = (
	bhajan: Bhajan,
	onProgress: ((msg: string) => void) | undefined,
	options: { base: Bhajan | null; overwrite?: boolean },
): Promise<SaveBhajanResult> =>
	withBhajanWriteLock("Save bhajan", async () => {
		const { base, overwrite = false } = options;
		const stored = simplifyBhajan(normalizeBhajan(bhajan as any));

		onProgress?.("Checking latest data...");
		const cloud = await readCloudBundle();
		const latest = () => parseRawBhajanText(cloud);

		const taken = cloud.find(
			(b: any) =>
				isSameSongNumber(b.id, stored.id) && (!base || b.id !== base.id),
		);
		if (taken) {
			throw new BhajanSaveError(
				"idTaken",
				`Song #${stored.id} is already used by "${taken.title}".`,
				{ latest: latest() },
			);
		}

		if (base && !overwrite) {
			const cloudOwn = cloud.find((b: any) => b.id === base.id);
			if (!cloudOwn) {
				throw new BhajanSaveError(
					"deleted",
					`Bhajan #${base.id} is no longer in the cloud.`,
					{ latest: latest() },
				);
			}
			const cloudParsed = toParsed(cloudOwn);
			const baseParsed = toParsed(base);
			if (
				cloudParsed &&
				baseParsed &&
				bhajanFingerprint(cloudParsed) !== bhajanFingerprint(baseParsed)
			) {
				throw new BhajanSaveError(
					"changed",
					`Bhajan #${base.id} was changed by another admin.`,
					{ cloud: cloudParsed, latest: latest() },
				);
			}
		}

		const prevId = base && base.id !== stored.id ? base.id : "";
		const replaceIds = new Set([stored.id, prevId].filter(Boolean));
		markWriteStarted(TAG, `Save bhajan ${stored.id}`);

		onProgress?.("Saving bhajan file...");
		if (prevId) await deleteJsonFromStorage(TAG, `${prevId}.json`);
		await saveJsonToStorage(TAG, `${stored.id}.json`, stored);

		// bundle.json BEFORE index.json — see markWriteStarted docs
		onProgress?.("Updating bundle...");
		const bundle = replaceInList(cloud, replaceIds, [stored]);
		await saveJsonToStorage(TAG, "bundle.json", bundle);

		// index.json LAST: its new timestamp is what tells phones to download
		// the bundle, so it must only change once the bundle is written.
		onProgress?.("Updating index...");
		const bundleTimestamp = await updateIndexFile(TAG, "bhajans", (items) =>
			replaceInList(items, replaceIds, [toIndexMeta(stored)]),
		);
		markWriteFinished(TAG);

		onProgress?.("Done!");
		return { bhajans: keepLocalCopy(bundle, bundleTimestamp), bundleTimestamp };
	});

// â”€â”€â”€ Read (admin side â€” fetches fresh from CDN) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const fetchBhajansIndex = async (): Promise<any[]> => {
	try {
		const data = await fetchFirebaseStorageJson(TAG, "index.json");
		return Array.isArray(data.bhajans) ? data.bhajans : [];
	} catch {
		return [];
	}
};

export const fetchBhajanFile = async (
	bhajanId: string,
): Promise<Bhajan | null> => {
	try {
		return await fetchFirebaseStorageJson(TAG, `${bhajanId}.json`);
	} catch {
		return null;
	}
};

/**
 * Changes a few fields (author, categories…) of many bhajans in one go.
 * Each patch is applied to the bhajan's CURRENT cloud copy, so edits other
 * admins made to the rest of it are kept. Index and bundle are written once.
 */
export const saveBhajanPatchesToFirebase = (
	patches: { id: string; apply: (stored: any) => any }[],
	onProgress?: (msg: string) => void,
): Promise<SaveBhajanResult> =>
	withBhajanWriteLock(`Save ${patches.length} bhajans`, async () => {
		onProgress?.("Checking latest data...");
		const cloud = await readCloudBundle();
		const byId = new Map<string, any>(cloud.map((b: any) => [b.id, b]));

		const missing = patches.filter((p) => !byId.has(p.id)).map((p) => p.id);
		if (missing.length > 0) {
			throw new BhajanSaveError(
				"missing",
				`These bhajans are no longer in the cloud: ${missing.join(", ")}. Nothing was saved — reopen this screen to get the latest data.`,
				{ latest: parseRawBhajanText(cloud) },
			);
		}

		const updated = new Map<string, any>(
			patches.map((p) => [
				p.id,
				{
					...simplifyBhajan(normalizeBhajan(p.apply({ ...byId.get(p.id) }))),
					id: p.id,
				},
			]),
		);

		markWriteStarted(TAG, `Save ${patches.length} bhajans`);
		let done = 0;
		for (const stored of updated.values()) {
			done++;
			onProgress?.(`Saving bhajan ${done}/${updated.size}...`);
			await saveJsonToStorage(TAG, `${stored.id}.json`, stored);
		}

		// bundle.json BEFORE index.json — see markWriteStarted docs
		onProgress?.("Updating bundle...");
		const bundle = cloud.map((b: any) => updated.get(b.id) ?? b);
		await saveJsonToStorage(TAG, "bundle.json", bundle);

		onProgress?.("Updating index...");
		const bundleTimestamp = await updateIndexFile(TAG, "bhajans", (items) => {
			const seen = new Set<string>();
			const next = items.map((item: any) => {
				const stored = updated.get(item?.id);
				if (!stored) return item;
				seen.add(stored.id);
				return toIndexMeta(stored);
			});
			for (const stored of updated.values())
				if (!seen.has(stored.id)) next.push(toIndexMeta(stored));
			return next;
		});
		markWriteFinished(TAG);

		onProgress?.("Done!");
		return { bhajans: keepLocalCopy(bundle, bundleTimestamp), bundleTimestamp };
	});

/**
 * Rebuilds the entire bundle.json and index.json directly from the individual
 * JSON files currently present in the Firebase Storage bucket.
 *
 * Use this when bundle.json is out-of-sync with individual files.
 */
export const rebuildBhajanBundle = async (
	onProgress?: (msg: string) => void,
): Promise<{ rebuilt: number; failed: string[]; bhajans: Bhajan[] }> => {
	onProgress?.("Fetching file list from Storage...");

	const bucket =
		import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
		"cpbs-admin.firebasestorage.app";
	const prefix = "app-data/bhajandata/";
	let allIds: string[] = [];

	try {
		// Use Firebase Storage REST API to list all files with pagination support
		let pageToken = "";
		do {
			const listUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}${pageToken ? `&pageToken=${pageToken}` : ""}`;
			const res = await fetch(listUrl);
			if (!res.ok) throw new Error("Failed to list files");
			const data = await res.json();

			if (data.items && Array.isArray(data.items)) {
				const ids = data.items
					.map((item: any) => {
						// extract filename without .json
						const name = item.name.replace(prefix, "");
						if (
							name.endsWith(".json") &&
							name !== "index.json" &&
							name !== "bundle.json"
						) {
							return name.replace(".json", "");
						}
						return null;
					})
					.filter(Boolean);
				allIds.push(...ids);
			}
			pageToken = data.nextPageToken || "";
		} while (pageToken);

		// Remove any duplicates just in case
		allIds = Array.from(new Set(allIds));
	} catch (error) {
		console.error("Failed to list files from storage:", error);
		throw new Error("Failed to list individual files from Firebase Storage.");
	}

	if (allIds.length === 0) {
		throw new Error("No bhajan files found in Storage!");
	}

	onProgress?.(`Found ${allIds.length} files. Fetching data...`);

	// Reading is harmless: nothing is written until every file is in hand, so
	// closing the app during this (longest) phase changes nothing.
	const {
		items: rebuilt,
		failed,
		skipped,
	} = await fetchAllWithRetry<Bhajan>(
		allIds,
		async (id) => {
			const bhajan = await fetchFirebaseStorageJson(TAG, `${id}.json`);
			return bhajan?.id ? bhajan : null;
		},
		(done, total, pass) =>
			onProgress?.(
				pass === 1
					? `Fetched ${done}/${total} files...`
					: `Retrying ${done}/${total} failed files (attempt ${pass})...`,
			),
	);

	if (failed.length > 0) {
		// Never write a bundle with holes — those bhajans would vanish for every user.
		throw new Error(
			`Could not fetch ${failed.length} of ${allIds.length} bhajan files (${failed.slice(0, 10).join(", ")}${failed.length > 10 ? ", …" : ""}). Nothing was changed — check the internet and run Rebuild again.`,
		);
	}

	if (rebuilt.length === 0) {
		throw new Error("No valid bhajan data could be fetched");
	}

	// Only the write phase holds the lock; the long read phase above does not.
	return withBhajanWriteLock("Rebuild bhajan bundle", async () => {
		markWriteStarted(TAG, "Rebuild bhajan bundle");
		onProgress?.("Writing complete bundle...");

		// Write bundle.json FIRST, index.json last (see markWriteStarted docs)
		const bundleTimestamp = Date.now();
		const storedRebuilt = rebuilt.map((b: any) =>
			simplifyBhajan(normalizeBhajan(b)),
		);
		await saveJsonToStorage(TAG, "bundle.json", storedRebuilt);

		onProgress?.(`Rebuilding index for ${rebuilt.length} bhajans...`);
		const newIndex = {
			total: rebuilt.length,
			lastUpdated: bundleTimestamp,
			bundleUpdated: bundleTimestamp,
			bhajans: rebuilt.map((b: any) => {
				const normalized = normalizeBhajan(b);
				const stored = simplifyBhajan(normalized);
				const contentHash = hashString(
					stored.title + stored.content + JSON.stringify(stored.audio || []),
				);
				return {
					id: stored.id,
					title: stored.title,
					songNumber: stored.bhajan_id,
					author: stored.author,
					audioCount: (stored.audio as any)?.length || 0,
					isHidden: stored.isHidden === true,
					contentHash,
				};
			}),
		};

		await saveJsonToStorage(TAG, "index.json", newIndex);

		markWriteFinished(TAG);

		onProgress?.(`Done! Rebuilt bundle with ${rebuilt.length} bhajans.`);
		// This device now has exactly what was written.
		const bhajans = keepLocalCopy(storedRebuilt, bundleTimestamp);
		// `failed` (kept for callers) now lists files that loaded but were not a valid item
		return { rebuilt: rebuilt.length, failed: skipped, bhajans };
	});
};

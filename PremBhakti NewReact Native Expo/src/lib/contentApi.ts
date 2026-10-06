import type { Book, LectureData } from "../types";
import { getObject, setObject } from "./storage";

// Shared fetch + sync for the content bundles, ported from
// fetchGithubReleaseJson / fetchBooksFromCloud / fetchLecturesFromCloud in
// context/DataContext.tsx. Content lives in Firebase Storage under
// app-data/<tag>/{index.json,bundle.json}; index.json carries a
// bundleUpdated/lastUpdated stamp plus per-item isHidden flags, so a cheap
// index fetch decides whether the (large) bundle needs downloading at all.
const FIREBASE_STORAGE_BUCKET = "cpbs-admin.firebasestorage.app";
const MAX_ATTEMPTS = 2;

function storageJsonUrl(tag: string, fileName: string): string {
	const path = encodeURIComponent(`app-data/${tag}/${fileName}`);
	return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${path}?alt=media&_c=${Date.now()}`;
}

export async function fetchStorageJson(tag: string, fileName: string): Promise<any> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const res = await fetch(storageJsonUrl(tag, fileName));
			if (!res.ok) throw new Error(`Firebase Storage fetch failed: ${res.status}`);
			return await res.json();
		} catch (e) {
			lastError = e;
			if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 800 * attempt));
		}
	}
	throw lastError;
}

interface Identified {
	id: string;
	isHidden?: boolean;
}

interface ListSource<T extends Identified> {
	tag: string;
	/** Key of the item array inside index.json / a non-array bundle.json. */
	listKey: string;
	cacheKey: string;
	bundleTimeKey: string;
	/** Hardcoded base items; cloud entries win for the same id. */
	base: T[];
}

export function getCachedList<T>(cacheKey: string): T[] {
	return getObject<T[]>(cacheKey) ?? [];
}

async function syncList<T extends Identified>(src: ListSource<T>, force: boolean): Promise<T[]> {
	const index = await fetchStorageJson(src.tag, "index.json");
	const remoteTime: number = index?.bundleUpdated || index?.lastUpdated || 0;
	const localTime = Number(getObject<string>(src.bundleTimeKey) ?? 0);
	const indexItems: Identified[] = Array.isArray(index?.[src.listKey]) ? index[src.listKey] : [];
	const hiddenById = new Map(indexItems.map((i) => [i.id, i.isHidden]));
	const cached = getCachedList<T>(src.cacheKey);

	// Same bundle: only reconcile visibility flags and base-item gaps, which
	// admins can change without a new bundle.
	if (!force && cached.length > 0 && localTime === remoteTime) {
		let changed = false;
		const map = new Map(cached.map((item) => [item.id, item]));
		for (const [id, hidden] of hiddenById) {
			const local = map.get(id);
			if (local && local.isHidden !== hidden) {
				map.set(id, { ...local, isHidden: hidden });
				changed = true;
			}
		}
		for (const base of src.base) {
			if (!map.has(base.id)) {
				map.set(base.id, base);
				changed = true;
			}
		}
		if (!changed) return cached;
		const next = Array.from(map.values());
		setObject(src.cacheKey, next);
		return next;
	}

	const bundle = await fetchStorageJson(src.tag, "bundle.json");
	const rawItems: T[] = Array.isArray(bundle)
		? bundle
		: Array.isArray(bundle?.[src.listKey])
			? bundle[src.listKey]
			: (() => {
					throw new Error("Invalid bundle.json array format");
				})();

	const cloud = rawItems.map((item) =>
		hiddenById.has(item.id) ? { ...item, isHidden: hiddenById.get(item.id) } : item,
	);
	const cloudIds = new Set(cloud.map((i) => i.id));
	const merged = [...src.base.filter((b) => !cloudIds.has(b.id)), ...cloud];

	setObject(src.cacheKey, merged);
	setObject(src.bundleTimeKey, String(remoteTime));
	return merged;
}

export const BOOKS_SOURCE = {
	tag: "bookdata",
	listKey: "books",
	cacheKey: "cpbs_all_books",
	bundleTimeKey: "cpbs_books_bundle_time",
};

export const LECTURES_SOURCE = {
	tag: "lecturedata",
	listKey: "lectures",
	cacheKey: "cpbs_all_lectures",
	bundleTimeKey: "cpbs_lectures_bundle_time",
};

export function syncBooks(base: Book[], force = false) {
	return syncList<Book>({ ...BOOKS_SOURCE, base }, force);
}

export function syncLectures(base: LectureData[], force = false) {
	return syncList<LectureData>({ ...LECTURES_SOURCE, base }, force);
}

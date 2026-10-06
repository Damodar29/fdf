/**
 * cacheCleanup.ts
 *
 * `cpbs_image_cache` folder ko din mein ek baar chhota karta hai — poora
 * nahi mitata, sirf purani aur faltu files hatata hai:
 *   1. Khaali (0 byte) files — adhoori download ka bacha hua kachra.
 *   2. MAX_AGE_DAYS se purani files — taaki kisi image ki purani copy
 *      hamesha na chalti rahe.
 *   3. Agar fir bhi folder MAX_TOTAL_BYTES se bada hai, to sabse purani files
 *      tab tak hatata hai jab tak TARGET_TOTAL_BYTES tak na aa jaye.
 *
 * Pehle yeh har 3 din mein saari files ek saath delete karta tha. Uske baad
 * jo bhi screen khulti, uski saari images ek saath dobara download hoti thin —
 * app bhaari ho jata tha aur nayi photo skeleton par atki rehti thi.
 *
 * Ye sirf native (Android/iOS) platforms pe kaam karta hai.
 *
 * ⚠️  "NEW" badge ke liye localStorage keys (jaise cpbs_last_read_info_title) ko
 *     BILKUL touch nahi karta — woh keys safe hain.
 *
 * Kya clean karta hai:
 *   - Directory.Cache / cpbs_image_cache  (Activities + Darshan gallery thumbnails)
 *
 * Kya NAHI clean karta:
 *   - Directory.Data / quote_images       (notification ke liye, woh khud manage karti hai)
 *   - Koi bhi localStorage / Preferences key
 */

import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import { clearImageMemCache } from "../components/CachedImage";

const LAST_CLEANUP_KEY = "cpbs_cache_last_cleanup";
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 din
const IMAGE_CACHE_DIR = "cpbs_image_cache";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 7;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024; // 150 MB
const TARGET_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB

interface CachedFile {
	name: string;
	size: number;
	mtime: number;
}

async function listFiles(
	dirPath: string,
	directory: Directory,
): Promise<CachedFile[]> {
	try {
		const result = await Filesystem.readdir({ path: dirPath, directory });
		const files: CachedFile[] = [];
		for (const file of result.files) {
			// Capacitor v5+ mein file ek object hota hai, v4 mein string
			if (typeof file === "string") {
				files.push({ name: file, size: -1, mtime: 0 });
				continue;
			}
			if (!file?.name || file.type === "directory") continue;
			files.push({
				name: file.name,
				size: typeof file.size === "number" ? file.size : -1,
				mtime: typeof file.mtime === "number" ? file.mtime : 0,
			});
		}
		return files;
	} catch (_e) {
		// Directory exist nahi karti — ye normal hai pehli baar
		console.log(
			`[CacheCleanup] Directory '${dirPath}' not found or unreadable, skipping.`,
		);
		return [];
	}
}

/**
 * Kaun si files hatani hain, yeh tay karta hai. Pure function — koi I/O nahi.
 * Size ya time pata na ho (-1 / 0) to file ko chhod deta hai, andaze se kuch
 * delete nahi karta.
 */
export function pickFilesToPrune(
	files: CachedFile[],
	now: number,
): { remove: string[]; keptBytes: number } {
	const remove = new Set<string>();
	const cutoff = now - MAX_AGE_DAYS * DAY_MS;

	for (const f of files) {
		if (f.size === 0) remove.add(f.name);
		else if (f.mtime > 0 && f.mtime < cutoff) remove.add(f.name);
	}

	const kept = files
		.filter((f) => !remove.has(f.name))
		.sort((a, b) => a.mtime - b.mtime); // sabse purani pehle
	let total = kept.reduce((sum, f) => sum + Math.max(f.size, 0), 0);

	if (total > MAX_TOTAL_BYTES) {
		for (const f of kept) {
			if (total <= TARGET_TOTAL_BYTES) break;
			if (f.size <= 0) continue;
			remove.add(f.name);
			total -= f.size;
		}
	}

	return { remove: Array.from(remove), keptBytes: total };
}

/**
 * App khulne pe call karo.
 * Din mein ek baar se zyada nahi chalta (silent background task).
 */
export async function runPeriodicCacheCleanup(): Promise<void> {
	if (!Capacitor.isNativePlatform()) return; // Web pe kuch nahi karna

	try {
		// Pichla cleanup kab hua?
		const { value } = await Preferences.get({ key: LAST_CLEANUP_KEY });
		const lastCleanup = value ? parseInt(value, 10) : 0;
		const now = Date.now();

		if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
			console.log("[CacheCleanup] Not due yet, skipping.");
			return;
		}

		console.log("[CacheCleanup] Starting image cache prune...");

		const files = await listFiles(IMAGE_CACHE_DIR, Directory.Cache);
		const { remove, keptBytes } = pickFilesToPrune(files, now);

		let deleted = 0;
		let failed = 0;
		for (const name of remove) {
			try {
				await Filesystem.deleteFile({
					path: `${IMAGE_CACHE_DIR}/${name}`,
					directory: Directory.Cache,
				});
				deleted++;
			} catch (e) {
				console.warn(
					`[CacheCleanup] Failed to delete ${IMAGE_CACHE_DIR}/${name}:`,
					e,
				);
				failed++;
			}
		}
		console.log(
			`[CacheCleanup] Image cache: ${deleted} deleted, ${failed} failed, ` +
				`${files.length - deleted} kept (~${Math.round(keptBytes / 1048576)} MB)`,
		);

		// ── In-memory cache reset (module-level Map in CachedImage.tsx) ────────
		// Delete hui files ka URI memory mein nahi rehna chahiye.
		if (deleted > 0) clearImageMemCache();

		// Cleanup time save karo
		await Preferences.set({ key: LAST_CLEANUP_KEY, value: String(now) });

		console.log("[CacheCleanup] Done ✅");
	} catch (e) {
		// Cleanup fail ho toh bhi app crash nahi hogi
		console.warn("[CacheCleanup] Cleanup encountered an error:", e);
	}
}

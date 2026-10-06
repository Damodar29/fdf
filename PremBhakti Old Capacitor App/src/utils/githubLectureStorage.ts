import { safeLocalSet } from "../../utils/safeLocalSet";
/**
 * src/utils/githubLectureStorage.ts
 *
 * Saves and reads Lecture data via Firebase Storage SDK.
 * Replaces the previous Firebase Function (saveLectureData) approach.
 *
 * WRITE: Direct Firebase Storage SDK upload (instant, no cold start)
 * READ:  CDN Worker â†’ Firebase Storage (via fetchFirebaseStorageJson in network.ts)
 */

import type { LectureData } from "../../types";
import {
	fetchAllWithRetry,
	markWriteFinished,
	markWriteStarted,
	saveJsonToStorage,
	updateBundleFile,
	updateIndexFile,
} from "../../utils/firebaseDataStorage";
import { fetchFirebaseStorageJson } from "../../utils/network";

const TAG = "lecturedata";

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

export const saveLectureToFirebase = async (
	lecture: LectureData,
	onProgress?: (msg: string) => void,
	currentLectures?: LectureData[], // Pass local list to avoid reading stale cloud bundle
): Promise<boolean> => {
	try {
		markWriteStarted(TAG, `Save lecture ${lecture.id}`);
		onProgress?.("Saving lecture file...");

		// 1. Save individual lecture file
		await saveJsonToStorage(TAG, `${lecture.id}.json`, lecture);

		onProgress?.("Updating bundle...");

		// 2. Update bundle.json (BEFORE index.json — see markWriteStarted docs)
		// If currentLectures provided, use local state directly (avoids stale cloud read race condition).
		// Otherwise fall back to read-modify-write from cloud.
		if (currentLectures) {
			await saveJsonToStorage(TAG, "bundle.json", currentLectures);
		} else {
			await updateBundleFile(TAG, (items) => {
				const idx = items.findIndex((l: any) => l.id === lecture.id);
				if (idx !== -1) {
					const updated = [...items];
					updated[idx] = lecture;
					return updated;
				}
				return [...items, lecture];
			});
		}

		onProgress?.("Updating index...");

		// 3. Update index.json last
		const contentHash = hashString(
			lecture.title +
				lecture.description +
				JSON.stringify((lecture as any).audio || []),
		);
		const meta = {
			id: lecture.id,
			title: lecture.title,
			description: lecture.description,
			date: lecture.date,
			audioCount: (lecture as any).audio?.length || 0,
			isHidden: lecture.isHidden === true,
			contentHash,
		};

		const bundleTimestamp = await updateIndexFile(TAG, "lectures", (items) => {
			const idx = items.findIndex((l: any) => l.id === lecture.id);
			if (idx !== -1) {
				const updated = [...items];
				updated[idx] = meta;
				return updated;
			}
			return [...items, meta];
		});

		safeLocalSet("cpbs_lectures_bundle_time", String(bundleTimestamp));
		markWriteFinished(TAG);

		onProgress?.("Done!");
		return true;
	} catch (error: any) {
		console.error("saveLectureToGithub Error:", error);
		throw new Error(
			error?.message || "Failed to save lecture to Firebase Storage",
		);
	}
};

// â”€â”€â”€ Read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const fetchLecturesIndex = async (): Promise<any[]> => {
	try {
		const data = await fetchFirebaseStorageJson(TAG, "index.json");
		return data.lectures || [];
	} catch {
		return [];
	}
};

export const fetchLectureFile = async (
	lectureId: string,
): Promise<LectureData | null> => {
	try {
		return await fetchFirebaseStorageJson(TAG, `${lectureId}.json`);
	} catch {
		return null;
	}
};

// â”€â”€â”€ Rebuild Bundle (Admin Repair Tool) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Reads all individual lecture files listed in the index, merges them into a
 * complete bundle.json, and rewrites index.json + bundle.json.
 *
 * Use this when bundle.json is incomplete (e.g. some lectures were saved before
 * the bundle system existed, or bundle was corrupted).
 *
 * After this runs, trigger Force Sync so all users receive the full bundle.
 */
export const rebuildLectureBundle = async (
	onProgress?: (msg: string) => void,
): Promise<{ rebuilt: number; failed: string[] }> => {
	onProgress?.("Reading lecture index...");

	const bucket =
		import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
		"cpbs-admin.firebasestorage.app";
	// Must match TAG: this used to list "lecturesdata/" while lectures are saved
	// under "lecturedata/", so rebuild never saw the real lecture files.
	const prefix = `app-data/${TAG}/`;
	let allIds: string[] = [];

	try {
		let pageToken = "";
		do {
			const listUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}${pageToken ? `&pageToken=${pageToken}` : ""}`;
			const res = await fetch(listUrl);
			if (!res.ok) throw new Error("Failed to list files");
			const data = await res.json();

			if (data.items && Array.isArray(data.items)) {
				const ids = data.items
					.map((item: any) => {
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

		allIds = Array.from(new Set(allIds));
	} catch (error) {
		console.error("Failed to list lecture files from storage:", error);
		throw new Error(
			"Failed to list individual lecture files from Firebase Storage.",
		);
	}

	if (allIds.length === 0) {
		throw new Error("No lecture files found in Storage!");
	}

	onProgress?.(`Fetching ${allIds.length} lecture files...`);

	// 2. Fetch each individual lecture file (read-only: closing the app here changes nothing)
	const {
		items: rebuilt,
		failed,
		skipped,
	} = await fetchAllWithRetry<LectureData>(
		allIds,
		async (id) => {
			const lecture = await fetchFirebaseStorageJson(TAG, `${id}.json`);
			return lecture?.id ? (lecture as LectureData) : null;
		},
		(done, total, pass) =>
			onProgress?.(
				pass === 1
					? `Fetched ${done}/${total} lectures...`
					: `Retrying ${done}/${total} failed lectures (attempt ${pass})...`,
			),
	);

	if (failed.length > 0) {
		// Never write a bundle with holes — those lectures would vanish for every user.
		throw new Error(
			`Could not fetch ${failed.length} of ${allIds.length} lecture files (${failed.slice(0, 10).join(", ")}${failed.length > 10 ? ", …" : ""}). Nothing was changed — check the internet and run Rebuild again.`,
		);
	}

	if (rebuilt.length === 0) {
		throw new Error("No valid lecture data could be fetched");
	}

	markWriteStarted(TAG, "Rebuild lecture bundle");
	onProgress?.("Writing complete bundle...");

	// 3. Write bundle.json FIRST, index.json last (see markWriteStarted docs)
	await saveJsonToStorage(TAG, "bundle.json", rebuilt);

	onProgress?.(`Rebuilding index for ${rebuilt.length} lectures...`);
	const bundleTimestamp = Date.now();
	const newIndex = {
		total: rebuilt.length,
		lastUpdated: bundleTimestamp,
		bundleUpdated: bundleTimestamp,
		lectures: rebuilt.map((l) => {
			const contentHash = hashString(
				l.title +
					(l.description || "") +
					JSON.stringify((l as any).audio || []),
			);
			return {
				id: l.id,
				title: l.title,
				description: l.description,
				date: l.date,
				audioCount: (l as any).audio?.length || 0,
				isHidden: (l as any).isHidden === true,
				contentHash,
			};
		}),
	};
	await saveJsonToStorage(TAG, "index.json", newIndex);

	// Update local timestamp
	safeLocalSet("cpbs_lectures_bundle_time", String(bundleTimestamp));
	markWriteFinished(TAG);

	onProgress?.(`Done! Rebuilt bundle with ${rebuilt.length} lectures.`);
	// `failed` (kept for callers) now lists files that loaded but were not a valid item
	return { rebuilt: rebuilt.length, failed: skipped };
};

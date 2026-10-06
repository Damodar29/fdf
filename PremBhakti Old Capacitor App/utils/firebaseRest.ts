import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || "cpbs-admin";
const REST_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export const parseFirestoreRestValue = (val: any): any => {
	if (!val) return null;
	if (val.stringValue !== undefined) return val.stringValue;
	if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
	if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
	if (val.booleanValue !== undefined) return val.booleanValue;
	if (val.nullValue !== undefined) return null;
	if (val.mapValue !== undefined) {
		const result: any = {};
		const fields = val.mapValue.fields || {};
		for (const key in fields) {
			result[key] = parseFirestoreRestValue(fields[key]);
		}
		return result;
	}
	if (val.arrayValue !== undefined) {
		const values = val.arrayValue.values || [];
		return values.map(parseFirestoreRestValue);
	}
	if (val.timestampValue !== undefined) return val.timestampValue;
	if (val.geoPointValue !== undefined) return val.geoPointValue;
	if (val.referenceValue !== undefined) return val.referenceValue;
	return val; // Fallback
};

export const parseFirestoreRestDocument = (doc: any): any => {
	if (!doc?.fields) return {};
	const result: any = {};
	for (const key in doc.fields) {
		result[key] = parseFirestoreRestValue(doc.fields[key]);
	}
	return result;
};

// iOS "live" listeners are REST polls. Each poll of a collection costs one
// read per document, so: poll once a minute rather than every 15 seconds, never
// while the app is in the background (catch up as soon as it is visible again),
// and only hand data to the screen when it actually changed.
const POLL_INTERVAL_MS = 60_000;
// Coming back to the foreground refetches only if the last poll is older.
const RESUME_REFRESH_MS = 15_000;

const isHidden = () =>
	typeof document !== "undefined" && document.visibilityState === "hidden";

/**
 * Runs `poll` now, then every `intervalMs` while the page is visible, and once
 * more on becoming visible again if the last run is stale. Returns a stop fn.
 */
const startVisiblePolling = (
	poll: () => Promise<void>,
	intervalMs: number,
): (() => void) => {
	let stopped = false;
	let running = false;
	let lastRun = 0;
	const run = async () => {
		if (stopped || running || isHidden()) return;
		running = true;
		lastRun = Date.now();
		try {
			await poll();
		} finally {
			running = false;
		}
	};
	const onVisibility = () => {
		if (!isHidden() && Date.now() - lastRun >= RESUME_REFRESH_MS) run();
	};
	run();
	const intervalId = setInterval(run, intervalMs);
	document.addEventListener("visibilitychange", onVisibility);
	return () => {
		stopped = true;
		clearInterval(intervalId as any);
		document.removeEventListener("visibilitychange", onVisibility);
	};
};

export const iosOnSnapshotCollection = (
	collectionPath: string,
	onNext: (snapshot: any) => void,
	onError?: (err: Error) => void,
	intervalMs = POLL_INTERVAL_MS,
) => {
	let isSubscribed = true;
	let lastEmitted = "";
	const cacheKey = `firestore_cache_${collectionPath}`;

	const processJson = (json: any) => {
		const documents = json.documents || [];
		const docs = documents.map((d: any) => {
			const pathParts = d.name.split("/");
			const id = pathParts[pathParts.length - 1];
			const dataObj = parseFirestoreRestDocument(d);
			return {
				id,
				data: () => dataObj,
				exists: () => true,
			};
		});

		const snapshot = {
			docs,
			forEach: (cb: (doc: any) => void) => docs.forEach(cb),
			empty: docs.length === 0,
			size: docs.length,
		};

		if (isSubscribed) onNext(snapshot);
	};

	/** Emits only when the content differs from what the screen already has. */
	const emitIfChanged = (text: string) => {
		if (!isSubscribed || text === lastEmitted) return;
		lastEmitted = text;
		processJson(JSON.parse(text));
	};

	// Cached copy first, once — instant data on launch, even offline.
	Preferences.get({ key: cacheKey })
		.then((cached) => {
			if (cached.value && !lastEmitted) emitIfChanged(cached.value);
		})
		.catch(() => {});

	const fetchCollection = async () => {
		try {
			// Follow pagination: a single page stops at 1000 documents.
			const documents: any[] = [];
			let pageToken = "";
			do {
				const url = `${REST_BASE_URL}/${collectionPath}?pageSize=1000${
					pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
				}`;
				const res = await fetch(url);
				if (!res.ok) {
					throw new Error(`REST API Error: ${res.status}`);
				}
				const page = await res.json();
				if (Array.isArray(page.documents)) documents.push(...page.documents);
				pageToken = page.nextPageToken || "";
			} while (pageToken && isSubscribed);
			if (!isSubscribed) return;

			const text = JSON.stringify({ documents });
			if (text !== lastEmitted) {
				await Preferences.set({ key: cacheKey, value: text });
				emitIfChanged(text);
			}
		} catch (err: any) {
			if (isSubscribed && onError) onError(err);
		}
	};

	const stop = startVisiblePolling(fetchCollection, intervalMs);
	return () => {
		isSubscribed = false;
		stop();
	};
};

export const iosOnSnapshotDoc = (
	documentPath: string,
	onNext: (snapshot: any) => void,
	onError?: (err: Error) => void,
	intervalMs = POLL_INTERVAL_MS,
) => {
	let isSubscribed = true;
	let lastEmitted = "";
	const cacheKey = `firestore_cache_${documentPath}`;
	const pathParts = documentPath.split("/");
	const id = pathParts[pathParts.length - 1];

	const processJson = (json: any, is404: boolean) => {
		if (is404) {
			if (isSubscribed)
				onNext({
					id,
					data: () => undefined,
					exists: () => false,
				});
			return;
		}
		const dataObj = parseFirestoreRestDocument(json);
		if (isSubscribed)
			onNext({
				id,
				data: () => dataObj,
				exists: () => true,
			});
	};

	/** `text` is the cached form: {"is404":bool,"json":...}. */
	const emitIfChanged = (text: string) => {
		if (!isSubscribed || text === lastEmitted) return;
		lastEmitted = text;
		const parsed = JSON.parse(text);
		processJson(parsed.json, parsed.is404);
	};

	Preferences.get({ key: cacheKey })
		.then((cached) => {
			if (cached.value && !lastEmitted) emitIfChanged(cached.value);
		})
		.catch(() => {});

	const fetchDoc = async () => {
		try {
			const res = await fetch(`${REST_BASE_URL}/${documentPath}`);
			let text: string;
			if (res.status === 404) {
				text = JSON.stringify({ is404: true });
			} else {
				if (!res.ok) throw new Error(`REST API Error: ${res.status}`);
				text = JSON.stringify({ is404: false, json: await res.json() });
			}
			if (!isSubscribed || text === lastEmitted) return;
			await Preferences.set({ key: cacheKey, value: text });
			emitIfChanged(text);
		} catch (err: any) {
			if (isSubscribed && onError) onError(err);
		}
	};

	const stop = startVisiblePolling(fetchDoc, intervalMs);
	return () => {
		isSubscribed = false;
		stop();
	};
};

export const shouldUseRestFallback = () => {
	return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
};

/**
 * One-shot REST fetch equivalent to Firestore SDK's getDoc().
 * Use this on iOS instead of getDoc() for any document fetch that needs to work on WKWebView.
 */
export const iosGetDoc = async (
	documentPath: string,
): Promise<{
	id: string;
	data: () => any;
	exists: () => boolean;
}> => {
	const pathParts = documentPath.split("/");
	const id = pathParts[pathParts.length - 1];

	try {
		const res = await fetch(`${REST_BASE_URL}/${documentPath}`);

		if (res.status === 404) {
			await Preferences.set({
				key: `firestore_cache_${documentPath}`,
				value: JSON.stringify({ is404: true }),
			});
			return { id, data: () => undefined, exists: () => false };
		}

		if (!res.ok)
			throw new Error(
				`iosGetDoc REST Error: ${res.status} for ${documentPath}`,
			);
		const json = await res.json();

		await Preferences.set({
			key: `firestore_cache_${documentPath}`,
			value: JSON.stringify({ is404: false, json }),
		});

		const dataObj = parseFirestoreRestDocument(json);
		return { id, data: () => dataObj, exists: () => true };
	} catch (networkErr) {
		try {
			const cached = await Preferences.get({
				key: `firestore_cache_${documentPath}`,
			});
			if (cached.value) {
				const parsed = JSON.parse(cached.value);
				if (parsed.is404) {
					return { id, data: () => undefined, exists: () => false };
				}
				const dataObj = parseFirestoreRestDocument(parsed.json);
				return { id, data: () => dataObj, exists: () => true };
			}
		} catch (_e) {}

		throw networkErr; // Re-throw if no cache
	}
};

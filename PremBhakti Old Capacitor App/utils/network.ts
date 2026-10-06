import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { httpsCallable } from "firebase/functions";
import { GITHUB_CDN_BASE_URL } from "../constants";
import { functions } from "../services/firebase";
import { toCdnUrl } from "./cdnUrl";
import { safeLocalSet } from "./safeLocalSet";

// Tags whose JSON data now lives in Firebase Storage (not GitHub Releases).
// fetchGithubReleaseJson auto-routes these to fetchFirebaseStorageJson.
const FIREBASE_STORAGE_TAGS = new Set([
	"bhajandata",
	"bookdata",
	"lecturedata",
	"appconfig",
]);
const FIREBASE_STORAGE_BUCKET =
	import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
	"cpbs-admin.firebasestorage.app";

const SIZE_CACHE_KEY = "cpbs_file_sizes";
const DEFAULT_JSON_FETCH_RETRIES = 2;
const DEFAULT_JSON_RETRY_DELAY_MS = 900;

interface FetchGithubReleaseJsonOptions {
	retries?: number;
	retryDelayMs?: number;
	/** When true, adds aggressive cache-busting to bypass GitHub/CDN edge caches.
	 *  Used during Force Sync to ensure devices get the latest data. */
	freshFetch?: boolean;
	onRetry?: (nextAttempt: number, maxAttempts: number, error: Error) => void;
}

// In-memory cache to reduce localStorage hits during session
const memoryCache: Record<string, number> = {};

// Helper to get size from cache
const getSizeFromCache = (url: string): number | null => {
	// Check memory first
	if (memoryCache[url]) return memoryCache[url];

	// Check persistent storage
	try {
		const cache = JSON.parse(localStorage.getItem(SIZE_CACHE_KEY) || "{}");
		if (cache[url]) {
			memoryCache[url] = cache[url]; // hydrate memory
			return cache[url];
		}
	} catch {}
	return null;
};

// Helper to save size to cache
const saveSizeToCache = (url: string, size: number) => {
	if (size <= 0) return;
	memoryCache[url] = size;
	try {
		const cache = JSON.parse(localStorage.getItem(SIZE_CACHE_KEY) || "{}");
		cache[url] = size;
		safeLocalSet(SIZE_CACHE_KEY, JSON.stringify(cache));
	} catch {}
};

/**
 * Strategy to fetch size via GitHub API for releases.
 * This is "Smart" because fetching metadata for one file in a release
 * gives us the sizes for ALL files in that release, which we cache.
 */
const fetchGitHubAPI = async (url: string): Promise<number | null> => {
	try {
		// Regex to parse: github.com/{owner}/{repo}/releases/download/{tag}/{filename}
		const regex =
			/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+)$/;
		const match = url.match(regex);

		if (!match) return null;

		const [_, owner, repo, tag, filename] = match;
		const decodedName = decodeURIComponent(filename);

		// Construct API URL for the Tag
		const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;

		// Fetch metadata (CORS is allowed for public GitHub API)
		const response = await fetch(apiUrl);
		if (!response.ok) return null;

		const data = await response.json();

		// Smart Caching: Save sizes for ALL assets in this release
		if (data.assets && Array.isArray(data.assets)) {
			data.assets.forEach((asset: any) => {
				if (asset.browser_download_url && asset.size) {
					saveSizeToCache(asset.browser_download_url, asset.size);
				}
			});

			// Return specific target size
			const target = data.assets.find((a: any) => a.name === decodedName);
			return target ? target.size : null;
		}
		return null;
	} catch (e) {
		console.warn("GitHub API check failed", e);
		return null;
	}
};

/**
 * Robustly fetches the file size of a URL.
 * Strategies:
 * 1. Cache Check
 * 2. GitHub API (if applicable) -> Caches entire release
 * 3. Native GET with Range 0-0
 * 4. Web HEAD / Proxy
 */
export const getRemoteFileSize = async (url: string): Promise<number> => {
	try {
		if (!url) return 0;

		let githubUrl = url;
		if (GITHUB_CDN_BASE_URL && url.startsWith(GITHUB_CDN_BASE_URL)) {
			const withoutBase = url.substring(GITHUB_CDN_BASE_URL.length + 1);
			const parts = withoutBase.split("/");
			if (parts.length >= 4) {
				const owner = parts[0];
				const repo = parts[1];
				const tag = parts[2];
				const file = parts.slice(3).join("/");
				githubUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${file}`;
			}
		}

		// 1. Check Cache
		const cached = getSizeFromCache(url) || getSizeFromCache(githubUrl);
		if (cached) return cached;

		// 2. Try GitHub API Strategy
		if (
			githubUrl.includes("github.com") &&
			githubUrl.includes("/releases/download/")
		) {
			const ghSize = await fetchGitHubAPI(githubUrl);
			if (ghSize) {
				saveSizeToCache(url, ghSize);
				return ghSize;
			}
		}

		// 3. Helper for parsing headers
		const parseTotal = (headers: any): number => {
			if (!headers) return 0;
			const range =
				headers["Content-Range"] ||
				headers["content-range"] ||
				headers["Content-range"];
			if (range) {
				const parts = range.split("/");
				if (parts.length > 1) {
					const parsed = parseInt(parts[1], 10);
					return Number.isNaN(parsed) ? 0 : parsed;
				}
			}
			const len =
				headers["Content-Length"] ||
				headers["content-length"] ||
				headers["Content-length"];
			const parsedLen = parseInt(len, 10);
			return Number.isNaN(parsedLen) ? 0 : parsedLen;
		};

		let size = 0;

		if (Capacitor.isNativePlatform()) {
			// Native Strategy
			try {
				const response = await CapacitorHttp.request({
					method: "GET",
					url: url,
					headers: { Range: "bytes=0-0" },
				});
				size = parseTotal(response.headers);
			} catch (e) {
				console.warn("Native size fetch failed", e);
			}
		} else {
			// Web Strategy
			try {
				const response = await fetch(url, { method: "HEAD" });
				if (response.ok) {
					const len = response.headers.get("Content-Length");
					if (len) {
						const parsed = parseInt(len, 10);
						size = Number.isNaN(parsed) ? 0 : parsed;
					}
				}
			} catch (_e) {
				// Fallback to Proxy if CORS fails
				try {
					const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
					const res = await fetch(proxyUrl, { method: "HEAD" });
					if (res.ok) {
						const parsed = parseInt(
							res.headers.get("Content-Length") || "0",
							10,
						);
						size = Number.isNaN(parsed) ? 0 : parsed;
					}
				} catch {}
			}
		}

		if (size > 0) saveSizeToCache(url, size);
		return size;
	} catch (e) {
		console.warn("Failed to fetch file size:", e);
		return 0;
	}
};

export const formatBytes = (bytes: number) => {
	if (!bytes || Number.isNaN(bytes) || bytes === 0) return "Size Unknown";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// â”€â”€â”€ Firebase Storage fetch (via CDN Worker) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Fetches a JSON file from Firebase Storage via the CDN Worker's /firebase/ route.
 * Primary strategy: CDN Worker (cached at Cloudflare edge)
 * Fallback: Direct Firebase Storage public URL
 *
 * Used for: bhajandata, bookdata, lecturedata, appconfig
 */
export const fetchFirebaseStorageJson = async (
	tag: string,
	fileName: string,
	options: FetchGithubReleaseJsonOptions = {},
): Promise<any> => {
	const retries = options.retries ?? DEFAULT_JSON_FETCH_RETRIES;
	const retryDelayMs = options.retryDelayMs ?? DEFAULT_JSON_RETRY_DELAY_MS;
	const maxAttempts = retries + 1;
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const cacheBuster = `_c=${Date.now()}_${attempt}`;
			const storagePath = `app-data/${tag}/${fileName}`;

			// Build direct Firebase Storage URL
			const encodedPath = encodeURIComponent(storagePath);
			const directUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media&${cacheBuster}`;

			if (Capacitor.isNativePlatform()) {
				const res = await CapacitorHttp.request({
					method: "GET",
					url: directUrl,
					headers: {},
					connectTimeout: 10000,
					readTimeout: 15000,
				});
				if (res.status >= 200 && res.status < 300) {
					return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
				}
				throw new Error(`Firebase Storage fetch failed: ${res.status}`);
			}

			// Web strategy: use direct Firebase Storage URL
			const res = await fetch(directUrl, {
				...(options.freshFetch ? { cache: "no-store" } : {}),
			});
			if (res.ok) return await res.json();
			throw new Error(`Firebase Storage direct fetch failed: ${res.status}`);
		} catch (error: any) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt >= maxAttempts) break;
			const nextAttempt = attempt + 1;
			options.onRetry?.(nextAttempt, maxAttempts, lastError);
			await wait(retryDelayMs * attempt);
		}
	}
	throw (
		lastError || new Error(`Failed to fetch ${fileName} from Firebase Storage`)
	);
};

// â”€â”€â”€ GitHub Release fetch (for audio, images, and non-data files) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const fetchGithubReleaseJson = async (
	tag: string,
	fileName: string,
	options: FetchGithubReleaseJsonOptions = {},
): Promise<any> => {
	// Auto-route Firebase Storage data tags to fetchFirebaseStorageJson
	if (FIREBASE_STORAGE_TAGS.has(tag)) {
		return fetchFirebaseStorageJson(tag, fileName, options);
	}

	const retries = options.retries ?? DEFAULT_JSON_FETCH_RETRIES;
	const retryDelayMs = options.retryDelayMs ?? DEFAULT_JSON_RETRY_DELAY_MS;
	const maxAttempts = retries + 1;
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			// Always use _c=timestamp cache-buster. This serves two purposes:
			//   1. On Web: avoids stale browser/OS-level caches per-attempt.
			//   2. On Android Native (CapacitorHttp / OkHttp): OkHttp has its own
			//      disk cache that ignores Cache-Control: no-cache request headers.
			//      A unique URL per-attempt is the ONLY reliable way to bypass it.
			//
			// The CDN worker (github-cdn.js) strips the _c param before building its
			// cache key, so CDN cache remains stable and shared across all devices.
			// The CDN worker also checks Cache-Control: no-cache header (freshFetch mode)
			// to bypass its own edge cache and fetch fresh from GitHub.
			const cacheBuster = `_c=${Date.now()}_${attempt}`;
			const nameWithCache = fileName.includes("?")
				? `${fileName}&${cacheBuster}`
				: `${fileName}?${cacheBuster}`;

			if (Capacitor.isNativePlatform()) {
				const url = toCdnUrl(
					`https://github.com/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/releases/download/${tag}/${nameWithCache}`,
				);
				const headers: Record<string, string> = {};
				if (options.freshFetch) {
					headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
					headers.Pragma = "no-cache";
				}
				const res = await CapacitorHttp.request({
					method: "GET",
					url,
					headers,
					connectTimeout: 10000,
					readTimeout: 15000,
				});
				if (res.status >= 200 && res.status < 300) {
					return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
				}
				throw new Error(`Native fetch failed: ${res.status}`);
			}

			// Web Strategy
			// Use local proxy in DEV, but direct URL in PROD (Firebase Hosting)
			if (import.meta.env?.DEV) {
				const url = `/github-releases/${tag}/${nameWithCache}`;
				const fetchOptions: RequestInit = {};
				if (options.freshFetch) {
					fetchOptions.cache = "no-store";
					fetchOptions.headers = {
						"Cache-Control": "no-cache, no-store",
						Pragma: "no-cache",
					};
				}
				const res = await fetch(url, fetchOptions);
				if (!res.ok) throw new Error(`Dev proxy fetch failed: ${res.status}`);
				return await res.json();
			}

			// Production Web/iOS Web Strategy:
			// Prefer CDN proxy to bypass CORS restrictions.
			// If the CDN is not configured or fails, fallback to Firebase Function.
			const rawUrl = `https://github.com/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/releases/download/${tag}/${nameWithCache}`;
			const cdnUrl = toCdnUrl(rawUrl);

			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 15000);

				const fetchOptions: RequestInit = { signal: controller.signal };
				if (options.freshFetch) {
					fetchOptions.cache = "no-store";
					fetchOptions.headers = {
						"Cache-Control": "no-cache, no-store, must-revalidate",
						Pragma: "no-cache",
					};
				}

				const res = await fetch(cdnUrl, fetchOptions);
				clearTimeout(timeoutId);

				if (res.ok) {
					return await res.json();
				}
				console.warn(
					`CDN fetch failed with status ${res.status}, falling back to Firebase proxy...`,
				);
			} catch (cdnErr) {
				console.warn(
					"CDN fetch threw an error (or timed out), falling back to Firebase proxy...",
					cdnErr,
				);
			}

			// Fallback: We securely call a Firebase Function that fetches the JSON from GitHub server-side and sends it back clean.
			const fetchReleaseFn = httpsCallable<
				{ tag: string; fileName: string },
				any
			>(functions, "fetchGithubRelease", { timeout: 15000 });
			const result = await fetchReleaseFn({ tag, fileName: nameWithCache });

			if (!result?.data) {
				throw new Error("Received empty payload from cloud proxy");
			}

			// Firebase onCall functions automatically parse the returned JSON!
			return typeof result.data === "string"
				? JSON.parse(result.data)
				: result.data;
		} catch (error: any) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt >= maxAttempts) break;

			const nextAttempt = attempt + 1;
			options.onRetry?.(nextAttempt, maxAttempts, lastError);
			await wait(retryDelayMs * attempt);
		}
	}

	throw lastError || new Error(`Failed to fetch ${fileName}`);
};

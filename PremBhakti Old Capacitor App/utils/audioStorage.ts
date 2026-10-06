import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { BhajanAudio } from "../types";
import { Crashlytics } from "./Crashlytics";
import { toCdnUrl } from "./cdnUrl";
import { NativeDownload } from "./nativeDownload";
import { getRemoteFileSize } from "./network";
import { safeLocalSet } from "./safeLocalSet";

/** Returns true when running in Apple environments (iOS Native, iOS Web, macOS Safari) */
const isApplePlatform = (): boolean => {
	if (typeof window === "undefined") return false;
	if (Capacitor.getPlatform() === "ios") return true;

	const ua = navigator.userAgent;
	const isMac = /Macintosh|MacIntel/.test(navigator.platform);
	const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
	const isIOS =
		/iPad|iPhone|iPod/.test(ua) || (isMac && navigator.maxTouchPoints > 1);

	return isIOS || (isMac && isSafari);
};

const CACHE_NAME = "cpbs-audio-cache-v4";
const STORAGE_KEY = "cpbs_downloaded_tracks";
const AUDIO_DIR = "Music/Prem Bhakti/Audios";
const LECTURE_DIR = "Music/Prem Bhakti/Lectures";

const LEGACY_AUDIO_DIR = "Download/Prem Bhakti/Audios";
const LEGACY_LECTURE_DIR = "Download/Prem Bhakti/Lectures";

export type AudioCategory = "audio" | "lecture";

const getNativeDir = (category: AudioCategory) =>
	category === "lecture" ? LECTURE_DIR : AUDIO_DIR;

const getSafeFileName = (id: string) => `track-${id}.m4a`;

/** Produce a clean, human-readable filename from title + singer */
const getNamedFileName = (title: string, singer: string): string => {
	const safe = (s: string) =>
		s
			.replace(/[\\/:*?"<>|]/g, "")
			.trim()
			.slice(0, 60);
	const t = safe(title) || "audio";
	const s = safe(singer);
	return s ? `${t} - ${s}.m4a` : `${t}.m4a`;
};

export const getPlayableUrl = (url: string): string => {
	if (!url) return "";

	// Handle Google Drive links
	if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
		let fileId = "";
		const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
		if (fileIdMatch?.[1]) fileId = fileIdMatch[1];
		else {
			const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
			if (idParamMatch?.[1]) fileId = idParamMatch[1];
		}
		if (fileId)
			return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
	}

	// Use the Cloudflare CDN to proxy GitHub URLs natively, which automatically
	// fixes iOS Safari CORS and Range-header streaming issues.
	if (!url.includes("drive.google.com")) {
		return toCdnUrl(url);
	}

	return url;
};

export const getDownloadedTrackIds = (): string[] => {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
	} catch {
		return [];
	}
};

export const isTrackDownloaded = (audioId: string): boolean => {
	const downloaded = getDownloadedTrackIds();
	return downloaded.includes(audioId);
};

/**
 * Android 8–9 (API ≤ 28) only: DownloadManager's setDestinationInExternalPublicDir()
 * creates /storage/emulated/0/Music from the app process, which needs the runtime
 * WRITE_EXTERNAL_STORAGE grant. It was never requested, so downloads failed with
 * "Unable to create directory: /storage/emulated/0/Music" (Crashlytics, Android 8.1).
 * Newer Android needs no grant for this, so we skip the prompt there.
 */
const ensureLegacyStoragePermission = async () => {
	try {
		const { androidSDKVersion } = await Device.getInfo();
		if (!androidSDKVersion || androidSDKVersion > 28) return;
		await Filesystem.requestPermissions();
	} catch (e) {
		console.warn("Storage permission request failed", e);
	}
};

const _ensureNativeDir = async (category: AudioCategory) => {
	if (!Capacitor.isNativePlatform()) return;
	try {
		await Filesystem.mkdir({
			path: getNativeDir(category),
			directory: Directory.ExternalStorage,
			recursive: true,
		});
	} catch (_e) {
		// Ignore if already exists
	}
};

export const saveTrack = async (
	audio: BhajanAudio,
	title: string,
	onProgress?: (percent: number, loaded: number, total: number) => void,
	signal?: AbortSignal,
	knownTotalBytes?: number,
	category: AudioCategory = "audio",
): Promise<boolean> => {
	try {
		const directUrl = getPlayableUrl(audio.url);

		// Initialize progress immediately with known size
		if (onProgress && knownTotalBytes) onProgress(0, 0, knownTotalBytes);

		// NATIVE DOWNLOAD STRATEGY
		if (Capacitor.getPlatform() === "android") {
			await ensureLegacyStoragePermission();
			const subpath =
				category === "lecture" ? "Prem Bhakti/Lectures" : "Prem Bhakti/Audios";
			// Use human-readable name if title is provided, fallback to ID-based
			const fileName = title
				? getNamedFileName(title, audio.singer || "")
				: getSafeFileName(audio.id);

			let totalBytes = knownTotalBytes || 0;
			if (totalBytes === 0) {
				totalBytes = await getRemoteFileSize(directUrl);
			}
			if (totalBytes === 0) totalBytes = 5000000; // 5MB Fallback

			if (onProgress) onProgress(1, 0, totalBytes);

			let listener: any = null;
			let activeDownloadId: number | null = null;
			// Handler to cancel the DownloadManager download when AbortSignal fires
			const onAbort = () => {
				if (activeDownloadId !== null) {
					NativeDownload.cancelDownload({ downloadId: activeDownloadId }).catch(
						() => {},
					);
				}
			};
			if (signal) signal.addEventListener("abort", onAbort);

			try {
				listener = await NativeDownload.addListener(
					"onDownloadProgress",
					(info) => {
						if (signal?.aborted) return;
						if (info.bytesTotal > 0 && onProgress) {
							const pct = (info.bytesDownloaded / info.bytesTotal) * 100;
							onProgress(pct, info.bytesDownloaded, info.bytesTotal);
						}
					},
				);

				// Check before starting â€” user may have cancelled during size fetch
				if (signal?.aborted) return false;

				const result = await NativeDownload.downloadToPublicFolder({
					url: directUrl,
					filename: fileName,
					subpath: subpath,
					directory: "MUSIC",
				});

				activeDownloadId = result.downloadId ?? null;

				// If aborted while the download was queued
				if (signal?.aborted) {
					if (activeDownloadId !== null) {
						NativeDownload.cancelDownload({
							downloadId: activeDownloadId,
						}).catch(() => {});
					}
					return false;
				}

				if (onProgress) onProgress(100, totalBytes, totalBytes);
			} catch (e: any) {
				if (signal?.aborted) return false;
				console.error("Native audio download failed", e);
				Crashlytics.recordException(e);
				return false;
			} finally {
				if (listener) listener.remove();
				if (signal) signal.removeEventListener("abort", onAbort);
			}
		} else if (Capacitor.isNativePlatform()) {
			// --- iOS NATIVE DOWNLOAD STRATEGY ---
			// iOS uses Directory.Documents (visible in Files app under "On My iPhone > Prem Bhakti")
			// ExternalStorage does NOT exist on iOS â€” Documents is the correct directory.
			const iosDir =
				category === "lecture" ? "Prem Bhakti/Lectures" : "Prem Bhakti/Audios";
			const namedFile = title
				? getNamedFileName(title, audio.singer || "")
				: getSafeFileName(audio.id);
			const filePath = `${iosDir}/${namedFile}`;

			let totalBytes = knownTotalBytes || 0;
			if (totalBytes === 0) {
				totalBytes = await getRemoteFileSize(directUrl);
			}
			if (totalBytes === 0) totalBytes = 5000000; // 5MB fallback

			if (onProgress) onProgress(1, 0, totalBytes);

			// Simulate progress (iOS Filesystem.downloadFile has no progress callback).
			// BUG FIX: Check abort signal inside the callback so the timer stops
			// reporting progress immediately after the caller cancels the download,
			// instead of continuing until the next tick or until clearInterval is called.
			let simulatedLoaded = 0;
			const timer = setInterval(() => {
				if (signal?.aborted) {
					clearInterval(timer); // belt-and-suspenders early exit on abort
					return;
				}
				if (simulatedLoaded < totalBytes * 0.95) {
					simulatedLoaded += totalBytes * 0.05;
					if (onProgress)
						onProgress(
							(simulatedLoaded / totalBytes) * 100,
							Math.floor(simulatedLoaded),
							totalBytes,
						);
				}
			}, 500);

			try {
				// Ensure directory exists
				try {
					await Filesystem.mkdir({
						path: iosDir,
						directory: Directory.Documents,
						recursive: true,
					});
				} catch (_) {
					/* already exists */
				}

				// Check abort before starting the actual download
				if (signal?.aborted) return false;

				const uriResult = await Filesystem.getUri({
					path: filePath,
					directory: Directory.Documents,
				});
				const result = await FileTransfer.downloadFile({
					path: uriResult.uri,
					url: directUrl,
				});

				if (!result.path) throw new Error("Path empty");
				if (onProgress) onProgress(100, totalBytes, totalBytes);
			} catch (e) {
				if (signal?.aborted) return false;
				console.error("iOS native audio download failed", e);
				Crashlytics.recordException(e);
				return false;
			} finally {
				// BUG FIX: clearInterval was duplicated in try AND catch — moved here
				// to guarantee it always runs regardless of success, failure, or abort.
				clearInterval(timer);
			}
		} else {
			// WEB DOWNLOAD STRATEGY (Streaming)
			let finalBlob: Blob | null = null;
			const strategies = [
				directUrl,
				`https://corsproxy.io/?${encodeURIComponent(directUrl)}`,
				`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(directUrl)}`,
			];

			for (const url of strategies) {
				if (signal?.aborted) throw new Error("Aborted");
				try {
					const res = await fetch(url, { signal });
					if (res.ok) {
						const contentLength = res.headers.get("content-length");
						const total = contentLength
							? parseInt(contentLength, 10)
							: knownTotalBytes || 0;

						if (!res.body) {
							finalBlob = await res.blob();
						} else {
							const reader = res.body.getReader();
							const chunks = [];
							let received = 0;
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								chunks.push(value);
								received += value.length;
								if (onProgress) {
									const percent = total ? (received / total) * 100 : 0;
									onProgress(percent, received, total);
								}
							}
							finalBlob = new Blob(chunks);
						}
						break;
					}
				} catch (e: any) {
					if (e.name === "AbortError") throw e;
				}
			}

			if (!finalBlob) {
				// All fetch strategies failed (likely CORS).
				// On Apple platform we can still let the user stream/save via native audio player.
				if (isApplePlatform()) {
					window.open(directUrl, "_blank", "noopener,noreferrer");
					return true; // treated as success â€” user can play/save from Safari
				}
				return false;
			}
			if (onProgress) onProgress(100, finalBlob.size, finalBlob.size);

			// Save to Cache Storage
			const cache = await caches.open(CACHE_NAME);
			await cache.put(audio.url, new Response(finalBlob));

			// Trigger browser download for desktop/web PWA
			const objectUrl = window.URL.createObjectURL(finalBlob);
			const a = document.createElement("a");
			a.href = objectUrl;
			a.download = `${title ? getNamedFileName(title, audio.singer || "") : getSafeFileName(audio.id)}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
		}

		const current = getDownloadedTrackIds();
		if (!current.includes(audio.id)) {
			const updated = [...current, audio.id];
			safeLocalSet(STORAGE_KEY, JSON.stringify(updated));
			window.dispatchEvent(new Event("storage"));
		}

		return true;
	} catch (error: any) {
		if (error.name !== "AbortError") {
			console.error("Download failed:", error);
			Crashlytics.recordException(error);
		}
		return false;
	}
};

export const getCachedAudioUrl = async (
	urlOrId: string,
): Promise<string | null> => {
	try {
		if (!Capacitor.isNativePlatform()) {
			const cache = await caches.open(CACHE_NAME);
			const response = await cache.match(urlOrId);
			if (response) {
				const blob = await response.blob();
				return URL.createObjectURL(blob);
			}
		}
		return null;
	} catch {
		return null;
	}
};

export const getNativeAudioSrc = async (
	trackId: string,
	title?: string,
	singer?: string,
	category: AudioCategory = "audio",
): Promise<string | null> => {
	if (!Capacitor.isNativePlatform()) return null;

	const safeIdName = getSafeFileName(trackId);
	const namedName = title ? getNamedFileName(title, singer || "") : null;

	const tryGetUri = async (path: string) => {
		try {
			// First check if file actually exists. Filesystem.getUri doesn't throw if file is missing.
			await Filesystem.stat({ path, directory: Directory.ExternalStorage });
			const uriResult = await Filesystem.getUri({
				path,
				directory: Directory.ExternalStorage,
			});
			return Capacitor.convertFileSrc(uriResult.uri);
		} catch {
			return null;
		}
	};

	try {
		const dir = getNativeDir(category);

		// 1. Try named file
		if (namedName) {
			const src = await tryGetUri(`${dir}/${namedName}`);
			if (src) return src;
		}

		// 2. Try safe ID file in primary directory
		const src2 = await tryGetUri(`${dir}/${safeIdName}`);
		if (src2) return src2;
	} catch (_e) {
		// Fallbacks
		const fallbackDir = category === "lecture" ? AUDIO_DIR : LECTURE_DIR;
		const legacyPrimaryDir =
			category === "lecture" ? LEGACY_LECTURE_DIR : LEGACY_AUDIO_DIR;
		const legacyFallbackDir =
			category === "lecture" ? LEGACY_AUDIO_DIR : LEGACY_LECTURE_DIR;

		const pathsToTry = [
			namedName ? `${fallbackDir}/${namedName}` : null,
			`${fallbackDir}/${safeIdName}`,
			namedName ? `${legacyPrimaryDir}/${namedName}` : null,
			`${legacyPrimaryDir}/${safeIdName}`,
			namedName ? `${legacyFallbackDir}/${namedName}` : null,
			`${legacyFallbackDir}/${safeIdName}`,
		].filter(Boolean) as string[];

		for (const p of pathsToTry) {
			const src = await tryGetUri(p);
			if (src) return src;
		}

		return null;
	}
};

export const deleteTrack = async (
	audioId: string,
	url: string,
	title?: string,
	singer?: string,
	category: AudioCategory = "audio",
): Promise<void> => {
	try {
		if (Capacitor.isNativePlatform()) {
			const dir = getNativeDir(category);
			const safeIdName = getSafeFileName(audioId);
			const namedName = title ? getNamedFileName(title, singer || "") : null;

			const legacyDir =
				category === "lecture" ? LEGACY_LECTURE_DIR : LEGACY_AUDIO_DIR;
			const fallbackDir = category === "lecture" ? AUDIO_DIR : LECTURE_DIR;
			const legacyFallbackDir =
				category === "lecture" ? LEGACY_AUDIO_DIR : LEGACY_LECTURE_DIR;

			// Try deleting named file
			if (namedName) {
				try {
					await Filesystem.deleteFile({
						path: `${dir}/${namedName}`,
						directory: Directory.ExternalStorage,
					});
				} catch (_e) {}
				try {
					await Filesystem.deleteFile({
						path: `${fallbackDir}/${namedName}`,
						directory: Directory.ExternalStorage,
					});
				} catch (_e) {}
				try {
					await Filesystem.deleteFile({
						path: `${legacyDir}/${namedName}`,
						directory: Directory.ExternalStorage,
					});
				} catch (_e) {}
				try {
					await Filesystem.deleteFile({
						path: `${legacyFallbackDir}/${namedName}`,
						directory: Directory.ExternalStorage,
					});
				} catch (_e) {}
			}

			// Try deleting ID file
			try {
				await Filesystem.deleteFile({
					path: `${dir}/${safeIdName}`,
					directory: Directory.ExternalStorage,
				});
			} catch (_e) {}
			try {
				await Filesystem.deleteFile({
					path: `${fallbackDir}/${safeIdName}`,
					directory: Directory.ExternalStorage,
				});
			} catch (_e) {}
			try {
				await Filesystem.deleteFile({
					path: `${legacyDir}/${safeIdName}`,
					directory: Directory.ExternalStorage,
				});
			} catch (_e) {}
			try {
				await Filesystem.deleteFile({
					path: `${legacyFallbackDir}/${safeIdName}`,
					directory: Directory.ExternalStorage,
				});
			} catch (_e) {}
		} else {
			try {
				const cache = await caches.open(CACHE_NAME);
				await cache.delete(url);
			} catch (_e) {}
		}

		const current = getDownloadedTrackIds();
		const updated = current.filter((id) => id !== audioId);
		safeLocalSet(STORAGE_KEY, JSON.stringify(updated));

		window.dispatchEvent(new Event("storage"));
	} catch (error) {
		console.error("Delete process failed:", error);
		Crashlytics.recordException(error);
	}
};

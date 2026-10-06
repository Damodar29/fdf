// b2Uploader.ts
// Smart B2 upload: simple PUT for small files, S3 multipart for large files
// Uses Cloudflare Worker as secure backend — B2 keys never exposed to frontend

const WORKER_BASE = "https://videos.chaitanyaprembhakti.org/api";

import pLimit from "p-limit";
import { auth, profileAuth } from "../../services/firebase";

const getAuthHeaders = async (): Promise<Record<string, string>> => {
	// Admin panel features sign in via `auth`; devotee-facing features (e.g.
	// Glorification audio upload) sign in via the separate `profileAuth`
	// instance. Both point at the same Firebase project, so either token is
	// valid for the worker — try whichever instance actually has a user.
	const token =
		(await auth.currentUser?.getIdToken()) ||
		(await profileAuth.currentUser?.getIdToken());
	if (!token) throw new Error("You must be logged in to perform this action.");
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};
};

const AUDIOS_CDN = "https://audios.chaitanyaprembhakti.org";
const VIDEOS_CDN = "https://videos.chaitanyaprembhakti.org";
const AUDIOS_B2_PREFIX = "Github Backup Files/CPBS-APP-ORIGNAL-PHASE-1/";

/**
 * Converts any raw B2 URL format into the correct Cloudflare CDN URL.
 *
 * Handles:
 *  - Friendly:  https://f005.backblazeb2.com/file/cpbs-videos/{path}
 *  - S3:        https://cpbs-videos.s3.us-east-005.backblazeb2.com/{path}
 *  - Native:    https://f005.backblazeb2.com/b2api/v1/b2_download_file_by_id?fileId=...
 *               (cannot be normalised — returned as-is)
 *
 * Audio files (Github Backup Files/CPBS-APP-ORIGNAL-PHASE-1/...) → audios CDN
 * Other files (Uploaded from app/...)                            → videos CDN
 */
export const normalizeB2Url = (url: string): string => {
	if (!url) return url;

	// Already on CDN — leave as-is
	if (url.startsWith(`${AUDIOS_CDN}/`) || url.startsWith(`${VIDEOS_CDN}/`))
		return url;

	let path: string | null = null;

	// 1. Friendly URL: https://f005.backblazeb2.com/file/cpbs-videos/{path}
	const friendlyMatch = url.match(
		/^https?:\/\/f\d+\.backblazeb2\.com\/file\/cpbs-videos\/(.+)$/,
	);
	if (friendlyMatch) path = friendlyMatch[1];

	// 2. S3 URL: https://cpbs-videos.s3.{region}.backblazeb2.com/{path}
	if (!path) {
		const s3Match = url.match(
			/^https?:\/\/cpbs-videos\.s3\.[^.]+\.backblazeb2\.com\/(.+)$/,
		);
		if (s3Match) path = s3Match[1];
	}

	// 3. Native API URL (fileId) — cannot resolve to a path, return as-is
	if (!path) return url;

	// Normalise + → space, then decode percent-encoding
	path = path.replace(/\+/g, " ");
	try {
		path = decodeURIComponent(path);
	} catch (_) {
		/* ignore */
	}

	// Route to correct CDN based on path prefix or file extension
	const lowerPath = path.toLowerCase();
	const isAudio =
		lowerPath.endsWith(".m4a") ||
		lowerPath.endsWith(".mp3") ||
		lowerPath.endsWith(".wav") ||
		lowerPath.endsWith(".aac") ||
		lowerPath.endsWith(".flac");

	if (
		isAudio ||
		path.startsWith(AUDIOS_B2_PREFIX) ||
		path.startsWith("Local Data Uploaded from App/audios/")
	) {
		let relative = path;
		if (path.startsWith(AUDIOS_B2_PREFIX)) {
			relative = path.substring(AUDIOS_B2_PREFIX.length);
		}
		return `${AUDIOS_CDN}/${relative.split("/").map(encodeURIComponent).join("/")}`;
	}

	// Default: videos CDN (for "Uploaded from app/" etc.)
	return `${VIDEOS_CDN}/${path.split("/").map(encodeURIComponent).join("/")}`;
};

// Files >= this threshold use multipart upload (S3 minimum part size is 5MB)
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50 MB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per chunk

/**
 * Smart upload: automatically picks simple or multipart based on file size.
 * @param file      The File to upload
 * @param onProgress  Callback (0–100)
 * @returns CDN download URL
 */
export const uploadFileToB2 = async (
	file: File,
	onProgress: (progress: number) => void,
	folderPath: string = "",
	signal?: AbortSignal,
): Promise<string> => {
	if (file.size < MULTIPART_THRESHOLD) {
		return simpleUpload(file, onProgress, folderPath, signal);
	} else {
		return multipartUpload(file, onProgress, folderPath, signal);
	}
};

// ─── Trigger Optimization Webhook ──────────────────────────────────────────────

async function triggerOptimization(objectKey: string) {
	if (!objectKey.toLowerCase().endsWith(".mp4")) return;
	try {
		await fetch(`${WORKER_BASE}/trigger-optimization`, {
			method: "POST",
			headers: await getAuthHeaders(),
			body: JSON.stringify({ objectKey }),
		});
		console.log(`Optimization triggered for ${objectKey}`);
	} catch (err) {
		console.error("Failed to trigger optimization webhook:", err);
	}
}

// ─── Simple PUT upload (< 50 MB) ──────────────────────────────────────────────

async function simpleUpload(
	file: File,
	onProgress: (p: number) => void,
	folderPath: string = "",
	signal?: AbortSignal,
): Promise<string> {
	const finalFileName = folderPath + file.name;
	// Step 1: get presigned PUT URL from worker
	const res = await fetch(`${WORKER_BASE}/generate-upload-url`, {
		method: "POST",
		headers: await getAuthHeaders(),
		body: JSON.stringify({
			fileName: finalFileName,
			contentType: file.type || "application/octet-stream",
		}),
		signal,
	});
	if (!res.ok) throw new Error(`Failed to get upload URL: ${await res.text()}`);
	const { uploadUrl, downloadUrl } = await res.json();

	// Step 2: PUT directly to B2 with progress
	await xhrPut(
		uploadUrl,
		file,
		file.type || "application/octet-stream",
		onProgress,
		signal,
	);

	// Trigger video optimization
	triggerOptimization(finalFileName);

	// Append cache-buster to bypass Cloudflare edge cache on overwrites
	const cacheBuster = `?v=${Date.now()}`;
	return downloadUrl + cacheBuster;
}

// ─── Multipart upload (>= 50 MB) ──────────────────────────────────────────────

async function multipartUpload(
	file: File,
	onProgress: (p: number) => void,
	folderPath: string = "",
	signal?: AbortSignal,
): Promise<string> {
	const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
	let objectKey = "";
	let uploadId = "";
	const finalFileName = folderPath + file.name;

	// Step 1: initiate multipart upload
	const initRes = await fetch(`${WORKER_BASE}/create-multipart`, {
		method: "POST",
		headers: await getAuthHeaders(),
		body: JSON.stringify({
			fileName: finalFileName,
			contentType: file.type || "application/octet-stream",
		}),
		signal,
	});
	if (!initRes.ok)
		throw new Error(
			`Failed to initiate multipart upload: ${await initRes.text()}`,
		);
	const init = await initRes.json();
	objectKey = init.objectKey;
	uploadId = init.uploadId;
	const downloadUrl: string = init.downloadUrl;

	const _parts: { PartNumber: number; ETag: string }[] = [];
	let uploadedBytes = 0;

	try {
		// Step 2: upload chunks concurrently
		const limit = pLimit(3); // 3 concurrent chunks

		const uploadPromises = Array.from({ length: totalChunks }).map((_, i) =>
			limit(async () => {
				const partNumber = i + 1;
				const start = i * CHUNK_SIZE;
				const end = Math.min(start + CHUNK_SIZE, file.size);
				const chunk = file.slice(start, end);

				// Get presigned URL for this part
				const partRes = await fetch(`${WORKER_BASE}/presign-part`, {
					method: "POST",
					headers: await getAuthHeaders(),
					body: JSON.stringify({ objectKey, uploadId, partNumber }),
					signal,
				});
				if (!partRes.ok)
					throw new Error(`Failed to get part URL for part ${partNumber}`);
				const { signedUrl } = await partRes.json();

				// Upload the chunk (signal wired for abort)
				const etag = await uploadChunk(
					signedUrl,
					chunk,
					(_chunkProgress) => {
						// Ignore individual chunk progress, we track overall part completion below
					},
					signal,
				);

				uploadedBytes += end - start;
				onProgress(Math.round((uploadedBytes / file.size) * 100));

				return { PartNumber: partNumber, ETag: etag };
			}),
		);

		const parts = await Promise.all(uploadPromises);

		// Sort parts by PartNumber as required by S3/B2 CompleteMultipartUpload
		parts.sort((a, b) => a.PartNumber - b.PartNumber);

		// Step 3: complete the multipart upload
		const completeRes = await fetch(`${WORKER_BASE}/complete-multipart`, {
			method: "POST",
			headers: await getAuthHeaders(),
			body: JSON.stringify({ objectKey, uploadId, parts }),
		});
		if (!completeRes.ok)
			throw new Error(
				`Failed to complete multipart upload: ${await completeRes.text()}`,
			);

		onProgress(100);

		// Trigger video optimization
		triggerOptimization(objectKey);

		// Append cache-buster to bypass Cloudflare edge cache on overwrites
		const cacheBuster = `?v=${Date.now()}`;
		return downloadUrl + cacheBuster;
	} catch (err) {
		// Cleanup: abort the multipart upload to avoid orphaned parts (costs money!)
		try {
			await fetch(`${WORKER_BASE}/abort-multipart`, {
				method: "POST",
				headers: await getAuthHeaders(),
				body: JSON.stringify({ objectKey, uploadId }),
			});
		} catch (_) {
			/* ignore abort errors */
		}
		throw err;
	}
}

// ─── XHR helpers ──────────────────────────────────────────────────────────────

function xhrPut(
	url: string,
	body: Blob,
	contentType: string,
	onProgress: (p: number) => void,
	signal?: AbortSignal,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.upload.addEventListener("progress", (e) => {
			if (e.lengthComputable)
				onProgress(Math.round((e.loaded / e.total) * 100));
		});
		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else
				reject(
					new Error(`Upload failed: HTTP ${xhr.status} — ${xhr.responseText}`),
				);
		});
		xhr.addEventListener("error", () =>
			reject(new Error("Network error during upload")),
		);
		xhr.addEventListener("abort", () =>
			reject(new DOMException("Upload aborted by user", "AbortError")),
		);
		// Wire AbortSignal → XHR abort
		if (signal) {
			if (signal.aborted) {
				xhr.abort();
				reject(new DOMException("Upload aborted by user", "AbortError"));
				return;
			}
			signal.addEventListener("abort", () => xhr.abort(), { once: true });
		}
		xhr.open("PUT", url, true);
		xhr.setRequestHeader("Content-Type", contentType);
		xhr.send(body);
	});
}

/** Upload a chunk and return the ETag (needed to complete multipart) */
function uploadChunk(
	url: string,
	chunk: Blob,
	onProgress: (p: number) => void,
	signal?: AbortSignal,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.upload.addEventListener("progress", (e) => {
			if (e.lengthComputable)
				onProgress(Math.round((e.loaded / e.total) * 100));
		});
		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				// B2/S3 returns ETag like: "abc123def456" (with quotes)
				// CompleteMultipartUpload REQUIRES the ETag exactly as returned (with quotes)
				const etag =
					xhr.getResponseHeader("ETag") || xhr.getResponseHeader("etag") || "";
				if (!etag) {
					reject(
						new Error(
							`Part upload succeeded but no ETag in response. CORS may not expose ETag header.`,
						),
					);
					return;
				}
				resolve(etag); // keep quotes — S3/B2 expects them
			} else {
				reject(new Error(`Part upload failed: HTTP ${xhr.status}`));
			}
		});
		xhr.addEventListener("error", () =>
			reject(new Error("Network error during chunk upload")),
		);
		xhr.addEventListener("abort", () =>
			reject(new DOMException("Upload aborted by user", "AbortError")),
		);
		// Wire AbortSignal → XHR abort
		if (signal) {
			if (signal.aborted) {
				xhr.abort();
				reject(new DOMException("Upload aborted by user", "AbortError"));
				return;
			}
			signal.addEventListener("abort", () => xhr.abort(), { once: true });
		}
		xhr.open("PUT", url, true);
		// Do NOT set Content-Type for parts — presigned URL already embeds it
		xhr.send(chunk);
	});
}

// ─── Backblaze Management APIs ────────────────────────────────────────────────

export interface B2File {
	key: string;
	lastModified: string;
	size: number;
}

export const fetchB2Files = async (): Promise<B2File[]> => {
	const res = await fetch(`${WORKER_BASE}/list-files`, {
		headers: await getAuthHeaders(),
	});
	if (!res.ok) throw new Error(`Failed to list files: ${await res.text()}`);
	const data = await res.json();
	return data.files || [];
};

export const deleteB2File = async (objectKey: string): Promise<void> => {
	const res = await fetch(`${WORKER_BASE}/delete-file`, {
		method: "POST",
		headers: await getAuthHeaders(),
		body: JSON.stringify({ objectKey }),
	});
	if (!res.ok) throw new Error(`Failed to delete file: ${await res.text()}`);
};

export const renameB2File = async (
	oldKey: string,
	newKey: string,
): Promise<void> => {
	const res = await fetch(`${WORKER_BASE}/rename-file`, {
		method: "POST",
		headers: await getAuthHeaders(),
		body: JSON.stringify({ oldKey, newKey }),
	});
	if (!res.ok) throw new Error(`Failed to rename file: ${await res.text()}`);
};

/**
 * Soft deletes a file by moving it into a "Deleted/" folder in B2, preserving the rest of its path.
 * @param url The full CDN URL of the file to delete
 */
export const softDeleteFromB2 = async (url: string): Promise<void> => {
	try {
		const urlObj = new URL(url);
		let objectKey = decodeURIComponent(urlObj.pathname);
		if (objectKey.startsWith("/")) objectKey = objectKey.substring(1);

		// Don't soft delete if it's already in the Deleted folder
		if (objectKey.startsWith("Deleted/")) return;

		const newKey = `Deleted/${objectKey}`;
		await renameB2File(objectKey, newKey);
		console.log(`Soft deleted B2 file: ${objectKey} -> ${newKey}`);
	} catch (e) {
		console.error("Failed to soft delete from B2:", e);
		throw e;
	}
};

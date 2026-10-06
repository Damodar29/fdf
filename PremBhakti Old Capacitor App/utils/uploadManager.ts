/**
 * utils/uploadManager.ts
 *
 * Provides utilities for image compression and uploading files
 * directly to GitHub Releases via Cloudflare Workers.
 */

// ─── Image Compression ──────────────────────────────────────────────────────

export const compressImage = (
	file: File | Blob,
	maxWidth = 1200,
	maxHeight = 1200,
	quality = 0.85,
): Promise<Blob> => {
	return new Promise((resolve, reject) => {
		if (!file.type.startsWith("image/")) {
			// Non-image: return as-is
			resolve(file);
			return;
		}

		const img = new Image();
		const objUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objUrl);
			const canvas = document.createElement("canvas");
			let width = img.width;
			let height = img.height;

			if (width > height) {
				if (width > maxWidth) {
					height *= maxWidth / width;
					width = maxWidth;
				}
			} else {
				if (height > maxHeight) {
					width *= maxHeight / height;
					height = maxHeight;
				}
			}

			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Failed to get canvas context"));
				return;
			}

			ctx.drawImage(img, 0, 0, width, height);
			canvas.toBlob(
				(blob) => {
					if (blob) resolve(blob);
					else reject(new Error("Compression failed"));
				},
				"image/jpeg",
				quality,
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objUrl);
			reject(new Error("Failed to load image for compression"));
		};

		img.src = objUrl;
	});
};

// ─── Capacitor NativeUpload Plugin interface ──────────────────────────────────

interface NativeUploadPlugin {
	uploadFile(options: {
		base64Data: string;
		mimeType: string;
		workerUrl: string;
		releaseId: string;
		token: string;
		fileName: string;
		totalFiles: number;
		currentIndex: number;
	}): Promise<{ url: string }>;
	addListener(
		event: "uploadProgress" | "uploadDone" | "uploadError",
		handler: (data: any) => void,
	): Promise<{ remove: () => void }>;
	startProgressNotification(options: {
		title: string;
		fileName: string;
	}): Promise<void>;
	updateProgressNotification(options: {
		title: string;
		fileName: string;
		progress: number;
	}): Promise<void>;
	stopProgressNotification(): Promise<void>;
}

let _nativeUploadPlugin: NativeUploadPlugin | null | undefined;

const getNativeUploadPlugin = (): NativeUploadPlugin | null => {
	if (_nativeUploadPlugin !== undefined) return _nativeUploadPlugin;
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const capacitorCore =
			require("@capacitor/core") as typeof import("@capacitor/core");

		if (capacitorCore.Capacitor.getPlatform() !== "android") {
			_nativeUploadPlugin = null;
			return null;
		}

		_nativeUploadPlugin = capacitorCore.registerPlugin(
			"NativeUpload",
		) as unknown as NativeUploadPlugin;
		return _nativeUploadPlugin;
	} catch {
		_nativeUploadPlugin = null;
		return null;
	}
};

// ─── Converts File → base64 string (no data-URL prefix) ──────────────────────

const fileToBase64 = (file: File | Blob): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			// Strip "data:<mime>;base64," prefix
			resolve(result.includes(",") ? result.split(",")[1] : result);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});

// ─── Cloudflare Worker Direct Upload (web / iOS fallback) ────────────────────

const uploadFileViaWorkerDirect = async (
	file: File | Blob,
	releaseId: string | number,
	githubToken: string,
	fileName: string,
): Promise<string> => {
	const workerUrl =
		import.meta.env.VITE_GITHUB_CDN_URL ||
		"https://mute-hat-56f3.chaitanyaprembhakti.workers.dev";
	const headerFileName = encodeURIComponent(fileName);

	const res = await fetch(`${workerUrl}/upload`, {
		method: "POST",
		headers: {
			"x-github-release-id": String(releaseId),
			"x-github-filename": headerFileName,
			"x-github-token": githubToken,
			"Content-Type": file.type || "application/octet-stream",
		},
		body: file,
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Upload proxy failed: ${errText}`);
	}

	const data = await res.json();
	return data.url;
};

// ─── Main Upload Entry Point (platform-aware) ─────────────────────────────────

export const uploadFileViaWorker = async (
	file: File,
	releaseId: string | number,
	githubToken: string,
	customFileName?: string,
	uploadOptions?: { totalFiles?: number; currentIndex?: number },
): Promise<string> => {
	const workerUrl =
		import.meta.env.VITE_GITHUB_CDN_URL ||
		"https://mute-hat-56f3.chaitanyaprembhakti.workers.dev";

	const rawFileName =
		customFileName ||
		`${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;

	const plugin = getNativeUploadPlugin();

	if (plugin) {
		const base64Data = await fileToBase64(file);

		const result = await plugin.uploadFile({
			base64Data,
			mimeType: file.type || "application/octet-stream",
			workerUrl,
			releaseId: String(releaseId),
			token: githubToken,
			fileName: encodeURIComponent(rawFileName),
			totalFiles: uploadOptions?.totalFiles ?? 1,
			currentIndex: uploadOptions?.currentIndex ?? 1,
		});

		return result.url;
	}

	return uploadFileViaWorkerDirect(file, releaseId, githubToken, rawFileName);
};

// ─── Upload progress listener (optional, for in-app UI updates on Android) ───

export type NativeUploadEvent =
	| { type: "progress"; callbackId: string; fileName: string; progress: number }
	| { type: "done"; callbackId: string; fileName: string; url: string }
	| { type: "error"; callbackId: string; fileName: string; error: string };

export const subscribeToNativeUploadEvents = (
	handler: (event: NativeUploadEvent) => void,
): (() => void) => {
	const plugin = getNativeUploadPlugin();
	if (!plugin) return () => {};

	const handles: Promise<{ remove: () => void }>[] = [
		plugin.addListener("uploadProgress", (data) =>
			handler({
				type: "progress",
				callbackId: data.callbackId,
				fileName: data.fileName,
				progress: data.progress,
			}),
		),
		plugin.addListener("uploadDone", (data) =>
			handler({
				type: "done",
				callbackId: data.callbackId,
				fileName: data.fileName,
				url: data.url,
			}),
		),
		plugin.addListener("uploadError", (data) =>
			handler({
				type: "error",
				callbackId: data.callbackId,
				fileName: data.fileName,
				error: data.error,
			}),
		),
	];

	return () => {
		handles.forEach((h) => h.then((l) => l.remove()));
	};
};

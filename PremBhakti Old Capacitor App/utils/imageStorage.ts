/**
 * imageStorage.ts
 * Shared utility for downloading images to "Prem Bhakti/<category>/<date>/"
 * and sharing images (actual file, not URL) on native platforms.
 */

import { Capacitor } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { showGlobalToast } from "../context/ToastContext";
import { NativeDownload } from "./nativeDownload";

/** Returns true when running in a mobile Safari / iOS Chrome web browser (NOT native app) */
const isIOSWeb = (): boolean => {
	if (Capacitor.isNativePlatform()) return false;
	return (
		/ipad|iphone|ipod/i.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
	); // iPad OS 13+ spoof
};

export type ImageCategory = "Darshan" | "Activities" | "Quotes";

/** Returns YYYY-MM-DD string for today or a given date */
const getDateStr = (date?: Date): string => {
	const d = date || new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${dd}-${m}-${y}`;
};

/** Ensure directory exists */
const ensureDir = async (path: string) => {
	try {
		await Filesystem.mkdir({
			path,
			directory: Directory.ExternalStorage,
			recursive: true,
		});
	} catch (_) {
		/* already exists */
	}
};

/**
 * Download an image to device storage.
 * Native: saves to Prem Bhakti/<category>/<mandalSubfolder?>/<dateStr_fileName>
 * Web   : triggers browser download
 */
export const downloadImage = async (
	imageUrl: string,
	category: ImageCategory,
	date?: Date,
	customFileName?: string,
	mandalSubfolder?: string,
): Promise<string | undefined> => {
	const dateStr = getDateStr(date);
	const ext = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
	const fileName = customFileName
		? `${dateStr}_${customFileName}`
		: `${dateStr}-${Date.now()}.${ext}`;
	const subfolder = mandalSubfolder ? `/${mandalSubfolder}` : "";

	const isAndroid = Capacitor.getPlatform() === "android";
	const isIosNative = Capacitor.getPlatform() === "ios";

	if (isAndroid) {
		try {
			const subpath = `Prem Bhakti/${category}${subfolder}`;
			const result = await NativeDownload.downloadToPublicFolder({
				url: imageUrl,
				filename: fileName,
				subpath: subpath,
				directory: "PICTURES",
			});
			return result.path;
		} catch (e) {
			console.warn("NativeDownload failed, trying Filesystem...", e);
			// Android fallback: Filesystem with ExternalStorage
			const folderPath = `Pictures/Prem Bhakti/${category}${subfolder}`;
			const filePath = `${folderPath}/${fileName}`;
			await ensureDir(folderPath);
			const uriResult = await Filesystem.getUri({
				path: filePath,
				directory: Directory.ExternalStorage,
			});
			const result = await FileTransfer.downloadFile({
				path: uriResult.uri,
				url: imageUrl,
			});
			if (!result.path) throw new Error("Download returned empty path");
			return filePath;
		}
	} else if (isIosNative) {
		// --- iOS NATIVE: save to Documents (visible in Files app) ---
		// ExternalStorage does NOT exist on iOS.
		const iosFolder = `Prem Bhakti/${category}${subfolder}`;
		const iosFilePath = `${iosFolder}/${fileName}`;
		try {
			await Filesystem.mkdir({
				path: iosFolder,
				directory: Directory.Documents,
				recursive: true,
			});
		} catch (_) {
			/* already exists */
		}
		const uriResult = await Filesystem.getUri({
			path: iosFilePath,
			directory: Directory.Documents,
		});
		const result = await FileTransfer.downloadFile({
			path: uriResult.uri,
			url: imageUrl,
		});
		if (!result.path) throw new Error("Download returned empty path");
		return iosFilePath;
	} else if (isIOSWeb()) {
		// iOS Safari web browser: `a.download` is ignored.
		// Open in new tab — user can long-press → "Save to Photos" or share.
		window.open(imageUrl, "_blank", "noopener,noreferrer");
	} else {
		// GitHub releases always have Content-Disposition: attachment.
		// We can bypass CORS and popup blockers entirely by using a hidden iframe.
		const isGithub =
			imageUrl.includes("github.com") ||
			imageUrl.includes("githubusercontent.com");

		if (isGithub) {
			const iframe = document.createElement("iframe");
			iframe.style.display = "none";
			iframe.src = imageUrl;
			document.body.appendChild(iframe);
			setTimeout(() => document.body.removeChild(iframe), 10000);
			return;
		}

		// Desktop / Android Chrome web fallback: fetch → blob → trigger download
		const strategies = [
			imageUrl,
			`https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`,
			`https://mirror.ghproxy.com/${imageUrl}`,
			`https://mute-hat-56f3.chaitanyaprembhakti.workers.dev/?url=${encodeURIComponent(imageUrl)}`,
			`https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
			`https://api.codetabs.com/v1/proxy?quest=${imageUrl}`,
			`https://corsproxy.io/?${imageUrl}`,
		];

		let success = false;
		for (const urlToFetch of strategies) {
			try {
				const response = await fetch(urlToFetch);
				if (response.ok) {
					const blob = await response.blob();
					const objectUrl = window.URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = objectUrl;
					a.download = fileName;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
					success = true;
					break;
				}
			} catch (_e) {
				// Ignore and try next strategy
			}
		}

		if (!success) {
			console.warn(
				"Fetch fallback failed due to CORS or Network Error. Forcing iframe download...",
			);
			const iframe = document.createElement("iframe");
			iframe.style.display = "none";
			iframe.src = imageUrl;
			document.body.appendChild(iframe);
			setTimeout(() => document.body.removeChild(iframe), 10000);
		}
	}
};

/**
 * Share an image as an actual file (not a URL).
 * Downloads temporarily then shares via native share sheet.
 * Falls back to sharing URL on web.
 */
export const shareImage = async (
	imageUrl: string,
	title: string,
	text?: string,
	_category: ImageCategory = "Quotes",
	_date?: Date,
): Promise<void> => {
	if (Capacitor.isNativePlatform()) {
		const ext = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
		const tempPath = `share-${Date.now()}.${ext}`;

		const uriResult = await Filesystem.getUri({
			path: tempPath,
			directory: Directory.Cache,
		});
		const result = await FileTransfer.downloadFile({
			path: uriResult.uri,
			url: imageUrl,
		});

		if (!result.path) throw new Error("Temp download failed");

		// Get the content URI for sharing
		const contentUriResult = await Filesystem.getUri({
			path: tempPath,
			directory: Directory.Cache,
		});

		await Share.share({
			title,
			text: text || title,
			url: contentUriResult.uri, // Native file URI
			dialogTitle: title,
		});
	} else {
		// Web fallback: attempt to share as actual file first
		let sharedWithFile = false;
		if (navigator.share && navigator.canShare) {
			const strategies = [
				imageUrl,
				`https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`,
				`https://mirror.ghproxy.com/${imageUrl}`,
				`https://mute-hat-56f3.chaitanyaprembhakti.workers.dev/?url=${encodeURIComponent(imageUrl)}`,
				`https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
				`https://api.codetabs.com/v1/proxy?quest=${imageUrl}`,
				`https://corsproxy.io/?${imageUrl}`,
			];
			for (const urlToFetch of strategies) {
				try {
					const response = await fetch(urlToFetch);
					if (response.ok) {
						const blob = await response.blob();
						const ext = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
						const file = new File([blob], `share.${ext}`, { type: blob.type });

						if (navigator.canShare({ files: [file] })) {
							await navigator.share({
								title,
								text: text || title,
								files: [file],
							});
							sharedWithFile = true;
							break;
						}
					}
				} catch (e) {
					console.warn(
						"Failed to fetch/share image file on web, falling back to URL",
						e,
					);
				}
			}
		}

		// If file sharing wasn't supported or failed, fallback to URL or clipboard
		if (!sharedWithFile) {
			if (navigator.share) {
				await navigator.share({ title, text: text || title });
			} else {
				let copied = false;
				const textToCopy = text || title;
				if (navigator?.clipboard?.writeText) {
					await navigator.clipboard.writeText(textToCopy);
					copied = true;
				} else {
					const textArea = document.createElement("textarea");
					textArea.value = textToCopy;
					textArea.style.position = "fixed";
					textArea.style.left = "-9999px";
					document.body.appendChild(textArea);
					textArea.focus();
					textArea.select();
					try {
						copied = document.execCommand("copy");
					} catch (_err) {}
					document.body.removeChild(textArea);
				}
				if (copied) {
					showGlobalToast("Content copied to clipboard", "success");
				} else {
					console.warn("Clipboard and Share API not available.");
				}
			}
		}
	}
};

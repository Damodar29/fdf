import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { PDF_LIB_URL, PDF_WORKER_URL } from "../constants";
import { checkFileExists, getFile, saveFile } from "./db";

const LIB_KEY = "pdfjs_lib_main";
const WORKER_KEY = "pdfjs_lib_worker";
const VERSION_KEY = "pdfjs_lib_version";
// M12: Must match the version in PDF_LIB_URL / PDF_WORKER_URL in constants.ts.
// Bump this whenever PDF.js is updated to force a re-download of the engine blobs.
const EXPECTED_PDFJS_VERSION = "3.11.174";

export const isPdfEngineDownloaded = async (): Promise<boolean> => {
	if (!Capacitor.isNativePlatform()) return true; // Web uses CDN
	const main = await checkFileExists(LIB_KEY);
	const worker = await checkFileExists(WORKER_KEY);
	if (!main || !worker) return false;
	// M12: Also verify the stored blobs match the current expected PDF.js version.
	// If the version mismatches, force a re-download so stale engine blobs are
	// never served (an API mismatch causes a black screen on all book opens).
	const storedVersion = await getFile(VERSION_KEY).catch(() => null);
	const storedVersionStr = storedVersion
		? await (storedVersion as Blob).text().catch(() => "")
		: "";
	return storedVersionStr === EXPECTED_PDFJS_VERSION;
};

// Helper to robustly fetch text/blob content
const fetchContent = async (url: string): Promise<Blob> => {
	if (Capacitor.isNativePlatform()) {
		// First try standard fetch (works in Android WebView for CORS-enabled CDNs like cdnjs)
		try {
			const res = await fetch(url);
			if (res.ok) {
				return await res.blob();
			}
		} catch (e) {
			console.warn("Standard fetch failed on native, trying CapacitorHttp:", e);
		}

		// Native fallback: Use CapacitorHttp to bypass CORS
		const response = await CapacitorHttp.get({
			url: url,
			responseType: "blob",
		});

		if (response.status !== 200)
			throw new Error(`Native fetch failed: ${response.status}`);

		const data = response.data;
		const contentType =
			response.headers["Content-Type"] ||
			response.headers["content-type"] ||
			"text/javascript";

		try {
			const cleanBase64 =
				typeof data === "string" ? data.replace(/\s/g, "") : "";
			const byteCharacters = atob(cleanBase64);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			return new Blob([byteArray], { type: contentType });
		} catch (_e) {
			// If atob failed, Capacitor returned raw string instead of base64
			return new Blob([data], { type: contentType });
		}
	} else {
		// Web: Standard fetch
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Web fetch failed: ${res.status}`);
		return await res.blob();
	}
};

export const downloadPdfEngine = async (
	onProgress?: (msg: string) => void,
): Promise<void> => {
	try {
		if (!Capacitor.isNativePlatform()) return; // Not needed on web
		if (onProgress) onProgress("Downloading PDF Engine Core...");
		const libBlob = await fetchContent(PDF_LIB_URL);
		await saveFile(LIB_KEY, libBlob);

		if (onProgress) onProgress("Downloading PDF Worker...");
		const workerBlob = await fetchContent(PDF_WORKER_URL);
		await saveFile(WORKER_KEY, workerBlob);

		// M12: Save the version stamp so future isPdfEngineDownloaded() checks can
		// detect if the blobs are from an old PDF.js version and force a re-download.
		await saveFile(
			VERSION_KEY,
			new Blob([EXPECTED_PDFJS_VERSION], { type: "text/plain" }),
		);

		if (onProgress) onProgress("Engine downloaded successfully.");
	} catch (error) {
		console.error("Error downloading PDF engine:", error);
		throw error;
	}
};

export const injectPdfEngine = async (): Promise<void> => {
	if ((window as any).pdfjsLib) return; // Already loaded

	if (!Capacitor.isNativePlatform()) {
		// Web: Load directly from CDN (Service Worker caches this)
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = PDF_LIB_URL;
			script.onload = () => {
				(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
				resolve();
			};
			script.onerror = (_e) =>
				reject(new Error("Failed to load PDF engine from CDN"));
			document.body.appendChild(script);
		});
	}

	// Native: Ensure engine is downloaded
	let libBlob = await getFile(LIB_KEY);
	let workerBlob = await getFile(WORKER_KEY);
	const isReady = await isPdfEngineDownloaded();

	if (!libBlob || !workerBlob || !isReady) {
		console.log(
			"PDF engine missing or outdated in storage, auto-downloading...",
		);
		try {
			await downloadPdfEngine();
			libBlob = await getFile(LIB_KEY);
			workerBlob = await getFile(WORKER_KEY);
		} catch (e) {
			console.error("Auto-download of PDF engine failed:", e);
		}
	}

	if (!libBlob || !workerBlob) {
		throw new Error("PDF Engine not found in offline storage.");
	}

	// Create Blob URLs
	const libUrl = URL.createObjectURL(libBlob);
	const workerUrl = URL.createObjectURL(workerBlob);

	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = libUrl;
		script.onload = () => {
			// Configure worker
			(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
			resolve();
		};
		script.onerror = (e) => reject(e);
		document.body.appendChild(script);
	});
};

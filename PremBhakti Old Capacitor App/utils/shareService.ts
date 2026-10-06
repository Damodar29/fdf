import { Clipboard } from "@capacitor/clipboard";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { showGlobalToast } from "../context/ToastContext";
import { triggerHaptic } from "./haptic";

export interface ShareData {
	title: string;
	text: string;
	url: string;
	dialogTitle: string;
}

/**
 * A robust cross-platform share service that handles Native (Android/iOS),
 * Web (Web Share API for Safari/Chrome), and gracefully falls back to clipboard copying.
 */
export const shareAppContent = async (
	data: ShareData,
	onCopiedFallback?: () => void,
): Promise<void> => {
	try {
		if (Capacitor.isNativePlatform()) {
			// Native platforms (Android, iOS) via Capacitor
			await Share.share({
				title: data.title,
				text: data.text,
				url: data.url,
				dialogTitle: data.dialogTitle,
			});
		} else if (navigator.share) {
			// Web Share API (Safari, mobile browsers, modern desktop browsers)
			await navigator.share({
				title: data.title,
				text: data.text,
				url: data.url,
			});
		} else {
			// Throw to explicitly trigger the fallback mechanism
			throw new Error("Web Share API unsupported");
		}
	} catch (error: any) {
		// Ignore innocent user cancellations
		const isCancelled =
			error?.name === "AbortError" ||
			error?.message?.toLowerCase().includes("cancel") ||
			error?.message?.toLowerCase().includes("share canceled");

		if (isCancelled) {
			return;
		}

		// Fallback: Copy to clipboard if sharing genuinely fails or is completely unsupported
		try {
			// Construct a single string containing both text and the URL
			const clipboardText = `${data.text}\n${data.url}`;

			let copied = false;
			try {
				await Clipboard.write({ string: clipboardText });
				copied = true;
			} catch (err) {
				console.warn("Clipboard API failed", err);
			}

			if (copied) {
				triggerHaptic("light");
				if (onCopiedFallback) {
					onCopiedFallback();
				}
			} else {
				console.warn("Clipboard API is not available and fallback failed.");
				showGlobalToast(`Share content:\n\n${clipboardText}`, "success");
			}
		} catch (fallbackError) {
			console.error(
				"Sharing and clipboard fallback both failed:",
				error,
				fallbackError,
			);
		}
	}
};

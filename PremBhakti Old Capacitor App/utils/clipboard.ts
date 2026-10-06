import { Clipboard } from "@capacitor/clipboard";
import { Capacitor } from "@capacitor/core";

/**
 * A robust cross-platform copy-to-clipboard function that works on:
 * - Native Android/iOS (using Capacitor Clipboard)
 * - Web with secure context (HTTPS) using navigator.clipboard
 * - Web with non-secure context (HTTP/Localhost) using fallback textarea
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
	if (!text) return false;

	// 1. Try Native Capacitor Plugin first
	if (Capacitor.isNativePlatform()) {
		try {
			await Clipboard.write({ string: text });
			return true;
		} catch (error) {
			console.warn("Capacitor Clipboard failed:", error);
			// fallback to web implementations if native fails
		}
	}

	// 2. Try Modern Web Clipboard API (Requires HTTPS or Localhost)
	if (
		typeof navigator !== "undefined" &&
		navigator.clipboard &&
		window.isSecureContext
	) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch (error) {
			console.warn("navigator.clipboard failed:", error);
			// fallback to legacy method
		}
	}

	// 3. Fallback for non-secure contexts (HTTP) or older browsers
	try {
		const textArea = document.createElement("textarea");
		textArea.value = text;
		// Move outside of screen to make it invisible
		textArea.style.position = "absolute";
		textArea.style.left = "-999999px";
		document.body.prepend(textArea);
		textArea.select();

		const copied = document.execCommand("copy");
		textArea.remove();
		return copied;
	} catch (error) {
		console.error("Fallback execCommand(copy) failed:", error);
		return false;
	}
};

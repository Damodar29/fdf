import { Capacitor } from "@capacitor/core";
import { showGlobalToast } from "../context/ToastContext";
import BigPictureNotification from "../services/BigPictureNotification";

// --- Helper to generate Quote URL (Synced with DailyQuotes.tsx logic) ---
const getStaticDayOfYear = (date: Date) => {
	const month = date.getMonth();
	const day = date.getDate();
	// Static days in month for a leap year (2024 reference)
	const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	let doy = 0;
	for (let i = 0; i < month; i++) {
		doy += daysInMonth[i];
	}
	return doy + day;
};

const _EXTENSIONS = ["JPG", "jpg", "PNG", "png", "jpeg"];

export const getQuoteImageUrl = (date: Date, ext: string = "JPG") => {
	const dayOfYear = getStaticDayOfYear(date);
	const dayOfYearStr = String(dayOfYear).padStart(3, "0");
	const dayOfMonth = date.getDate();
	const months = [
		"JAN",
		"FEB",
		"MAR",
		"APR",
		"MAY",
		"JUN",
		"JUL",
		"AUG",
		"SEP",
		"OCT",
		"NOV",
		"DEC",
	];
	const monthStr = months[date.getMonth()];
	return `https://images.chaitanyaprembhakti.org/dailyquotes_1/${dayOfYearStr}.${dayOfMonth}.${monthStr}.${ext}`;
};

export const NotificationService = {
	async requestPermissions() {
		// Note: LocalNotifications plugin removed. Permissions for Push
		// are now handled directly by PushNotifications plugin in App.tsx
		return true;
	},

	async createChannel() {
		// Left empty as Firebase Push Notifications auto-creates
		// the default channel based on AndroidManifest configs.
		if (!Capacitor.isNativePlatform()) return;
	},

	async sendTestNotification(
		language: "en" | "hi" = "en",
		testImageUrl?: string,
	) {
		try {
			const granted = await this.requestPermissions();
			if (!granted) {
				showGlobalToast("Notification permissions not granted", "error");
				return;
			}

			const now = new Date();
			let quoteUrl = testImageUrl;

			if (Capacitor.isNativePlatform()) {
				if (!quoteUrl) {
					quoteUrl = getQuoteImageUrl(now);
				}

				const title =
					language === "hi" ? "नित्य वाणी (टेस्ट)" : "Daily Quote (Test)";
				const body =
					language === "hi"
						? `आज ${now.toLocaleDateString()} है। विचार देखने के लिए टैप करें!`
						: `Today is ${now.toLocaleDateString()}. Tap to view the quote!`;

				await BigPictureNotification.show({
					title,
					body,
					imageUrl: quoteUrl,
					cachedPath: "",

					action_type: "screen",
					target_screen: "quotes",
					type: "quote",
				} as any);
			} else {
				showGlobalToast(
					"BigPicture notification is only for Android native",
					"error",
				);
				return;
			}
		} catch (error: any) {
			console.error("Test notification failed", error);
			const errorMessage =
				error instanceof Error ? error.message : JSON.stringify(error);
			showGlobalToast(
				`Failed to send test notification:\n${errorMessage}`,
				"error",
			);
		}
	},
};

// Shared helper for consistent date key format
export function getDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface CrashlyticsPlugin {
	log(options: { message: string }): Promise<void>;
	setUserId(options: { userId: string }): Promise<void>;
	recordException(options: { message: string; stack?: string }): Promise<void>;
}

const NativeCrashlytics = registerPlugin<CrashlyticsPlugin>("Crashlytics");

/**
 * Global utility for reporting errors to Firebase Crashlytics.
 * Handles both native and web platforms gracefully.
 */
export const Crashlytics = {
	log: async (message: string) => {
		console.log(`[Crashlytics LOG] ${message}`);
		if (Capacitor.isNativePlatform()) {
			try {
				await NativeCrashlytics.log({ message });
			} catch (e) {
				console.warn("Failed to log to native Crashlytics", e);
			}
		}
	},

	setUserId: async (userId: string) => {
		if (Capacitor.isNativePlatform()) {
			try {
				await NativeCrashlytics.setUserId({ userId });
			} catch (e) {
				console.warn("Failed to set user ID in Crashlytics", e);
			}
		}
	},

	recordException: async (error: unknown) => {
		const rawMessage =
			error instanceof Error
				? error.message
				: typeof error === "string"
					? error
					: String(error);
		const rawStack = error instanceof Error ? error.stack : undefined;

		// Truncate before sending to native bridge to prevent oversized payloads
		// crashing CrashlyticsPlugin.java (Binder transaction limit ~1 MB on Android).
		const MAX_MSG = 1024;
		const MAX_STACK = 4096;
		const message =
			rawMessage.length > MAX_MSG
				? `${rawMessage.slice(0, MAX_MSG)}…`
				: rawMessage;
		const stack = rawStack
			? rawStack.length > MAX_STACK
				? `${rawStack.slice(0, MAX_STACK)}…`
				: rawStack
			: undefined;

		console.error(`[Crashlytics ERROR] ${message}`, error);

		if (Capacitor.isNativePlatform()) {
			try {
				await NativeCrashlytics.recordException({ message, stack });
			} catch (e) {
				console.warn("Failed to record exception in native Crashlytics", e);
			}
		}
	},
};

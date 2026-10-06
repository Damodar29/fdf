/**
 * haptic.ts
 *
 * Native haptic feedback utility using @capacitor/haptics.
 *
 * On Android: Uses HapticFeedbackConstants via native API.
 * On iOS: Uses UIImpactFeedbackGenerator (taptic engine) — much richer than vibration.
 * On Web: Falls back to navigator.vibrate (basic buzzer).
 *
 * Usage:
 *   triggerHaptic('light')   → tab switch, button tap
 *   triggerHaptic('medium')  → like, success action
 *   triggerHaptic('heavy')   → error, destructive action
 */

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export const triggerHaptic = async (
	type:
		| "light"
		| "medium"
		| "heavy"
		| "success"
		| "warning"
		| "error" = "light",
	force: boolean = false,
): Promise<void> => {
	try {
		if (!force) {
			if (typeof localStorage !== "undefined") {
				const isEnabled = localStorage.getItem("cpbs_haptics") !== "false";
				if (!isEnabled) return;
			}
		}
		if (Capacitor.isNativePlatform()) {
			switch (type) {
				case "heavy":
					await Haptics.impact({ style: ImpactStyle.Heavy });
					break;
				case "medium":
					await Haptics.impact({ style: ImpactStyle.Medium });
					break;
				case "success":
					await Haptics.notification({ type: NotificationType.Success });
					break;
				case "warning":
					await Haptics.notification({ type: NotificationType.Warning });
					break;
				case "error":
					await Haptics.notification({ type: NotificationType.Error });
					break;
				default:
					await Haptics.impact({ style: ImpactStyle.Light });
					break;
			}
		} else {
			// Web fallback: basic vibration
			if (typeof navigator !== "undefined" && navigator.vibrate) {
				switch (type) {
					case "heavy":
						navigator.vibrate(20);
						break;
					case "medium":
						navigator.vibrate(10);
						break;
					default:
						navigator.vibrate(5);
						break;
				}
			}
		}
	} catch (_) {
		// Non-fatal: haptic feedback is a UX enhancement, not critical
	}
};

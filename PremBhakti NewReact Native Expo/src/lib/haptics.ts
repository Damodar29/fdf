import * as Haptics from "expo-haptics";
import { useSettingsStore } from "../store/settingsStore";

// Port of utils/haptic.ts: same call sites/semantics ('light' → tab/button,
// 'medium' → success-ish action, 'heavy' → destructive), gated on the user's
// Vibrations setting unless `force` is passed (used by the settings toggle
// itself so turning haptics on gives immediate feedback).
export type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export function triggerHaptic(type: HapticType = "light", force = false) {
	if (!force && !useSettingsStore.getState().hapticsEnabled) return;

	switch (type) {
		case "heavy":
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
			break;
		case "medium":
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
			break;
		case "success":
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			break;
		case "warning":
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			break;
		case "error":
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
			break;
		default:
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
	}
}

import { getUiScale, setUiScale } from "../../modules/ui-scale";
import { storage } from "./storage";

/** Reopens Settings after the reload a UI size change needs (RootNavigator). */
export const REOPEN_SETTINGS_KEY = "cpbs_reopen_settings";

/**
 * Lays the app out at a new "App UI Size" (modules/ui-scale). That takes a JS
 * reload; `reopenSettings` brings the devotee back to Settings afterwards, as
 * the Capacitor app stayed on it.
 */
export function applyUiScale(scale: number, reopenSettings = true) {
	if (Math.abs(scale - getUiScale()) < 0.001) return;
	if (reopenSettings) storage.set(REOPEN_SETTINGS_KEY, true);
	if (!setUiScale(scale)) storage.remove(REOPEN_SETTINGS_KEY);
}

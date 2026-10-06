import { requireOptionalNativeModule } from "expo";

// Settings → "App UI Size" (see android/.../UiScale.kt). Optional so a build
// made before this module existed simply ignores the setting.
const UiScaleNative = requireOptionalNativeModule<{
	getScale(): number;
	setScale(scale: number): void;
}>("UiScale");

/** The scale the app is laid out with right now (1 without the native module). */
export function getUiScale(): number {
	return UiScaleNative?.getScale() ?? 1;
}

/** Saves the UI size; the app reloads to lay itself out again with it. */
export function setUiScale(scale: number): boolean {
	if (!UiScaleNative) return false;
	UiScaleNative.setScale(scale);
	return true;
}

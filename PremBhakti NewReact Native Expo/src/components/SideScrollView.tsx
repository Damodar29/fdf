import { forwardRef } from "react";
import { ScrollView, type ScrollViewProps, StyleSheet } from "react-native";
import { useSettingsStore } from "../store/settingsStore";

/**
 * A ScrollView whose scrollbar follows Settings → Scrollbar (left/right), the
 * native take on the Capacitor app's `.left-scrollbar` class: the scroller is
 * laid out right-to-left, which puts Android's scrollbar on the left, and its
 * content goes back to left-to-right. Use it directly, or as a FlashList's
 * `renderScrollComponent`.
 */
/** The same styles, for scrollers that can't be a SideScrollView (gesture-handler's). */
export function useScrollbarSideStyles() {
	const left = useSettingsStore((s) => s.scrollBarSide) === "left";
	return left ? { style: styles.rtl, contentContainerStyle: styles.ltr } : { style: undefined, contentContainerStyle: undefined };
}

export const SideScrollView = forwardRef<ScrollView, ScrollViewProps>(function SideScrollView(
	{ style, contentContainerStyle, ...props },
	ref,
) {
	const left = useSettingsStore((s) => s.scrollBarSide) === "left";
	return (
		<ScrollView
			ref={ref}
			{...props}
			style={left ? [style, styles.rtl] : style}
			contentContainerStyle={left ? [contentContainerStyle, styles.ltr] : contentContainerStyle}
		/>
	);
});

const styles = StyleSheet.create({
	rtl: { direction: "rtl" },
	ltr: { direction: "ltr" },
});

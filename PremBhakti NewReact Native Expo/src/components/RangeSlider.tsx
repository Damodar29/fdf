import { useRef, useState } from "react";
import { type GestureResponderEvent, StyleSheet, View } from "react-native";

/**
 * A plain `<input type="range">` stand-in: thin track, accent fill and a
 * round thumb. Drag or tap anywhere; values snap to `step` and update live.
 */
export function RangeSlider({
	value,
	min,
	max,
	step = 1,
	onChange,
	accent,
	track,
	onSlidingChange,
}: {
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	accent: string;
	track: string;
	/** Called with true when a drag starts and false when it ends. */
	onSlidingChange?: (sliding: boolean) => void;
}) {
	const width = useRef(1);
	const [dragging, setDragging] = useState(false);
	const ratio = (Math.min(max, Math.max(min, value)) - min) / (max - min);

	const update = (e: GestureResponderEvent) => {
		const r = Math.min(1, Math.max(0, e.nativeEvent.locationX / width.current));
		const next = Math.round((min + r * (max - min)) / step) * step;
		if (next !== value) onChange(next);
	};

	return (
		<View
			onLayout={(e) => {
				width.current = e.nativeEvent.layout.width || 1;
			}}
			hitSlop={{ top: 14, bottom: 14 }}
			onStartShouldSetResponder={() => true}
			onMoveShouldSetResponder={() => true}
			onResponderTerminationRequest={() => false}
			onResponderGrant={(e) => {
				setDragging(true);
				onSlidingChange?.(true);
				update(e);
			}}
			onResponderMove={update}
			onResponderRelease={() => {
				setDragging(false);
				onSlidingChange?.(false);
			}}
			onResponderTerminate={() => {
				setDragging(false);
				onSlidingChange?.(false);
			}}
			style={styles.hit}
		>
			<View pointerEvents="none" style={[styles.track, { backgroundColor: track }]}>
				<View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: accent }]} />
			</View>
			<View
				pointerEvents="none"
				style={[
					styles.thumb,
					{ left: `${ratio * 100}%`, backgroundColor: accent, transform: [{ scale: dragging ? 1.15 : 1 }] },
				]}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	hit: { height: 24, justifyContent: "center" },
	track: { height: 6, borderRadius: 3, overflow: "hidden" },
	fill: { height: "100%" },
	thumb: { position: "absolute", width: 18, height: 18, borderRadius: 9, marginLeft: -9, top: 3 },
});

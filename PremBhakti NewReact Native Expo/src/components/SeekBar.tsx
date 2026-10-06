import { useRef, useState } from "react";
import { type GestureResponderEvent, StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/useAppTheme";

interface Props {
	position: number;
	duration: number;
	onSeek?: (seconds: number) => void;
	height?: number;
}

// Tap or drag anywhere on the bar to seek. Uses the responder system rather
// than a slider dependency; while dragging, the bar follows the finger and
// only one seek is issued on release so the native player isn't flooded.
export function SeekBar({ position, duration, onSeek, height = 4 }: Props) {
	const theme = useAppTheme();
	const width = useRef(1);
	const [dragRatio, setDragRatio] = useState<number | null>(null);

	const ratioFromEvent = (e: GestureResponderEvent) =>
		Math.min(1, Math.max(0, e.nativeEvent.locationX / width.current));

	const ratio = dragRatio ?? (duration > 0 ? Math.min(1, position / duration) : 0);
	const interactive = !!onSeek && duration > 0;

	return (
		<View
			onLayout={(e) => {
				width.current = e.nativeEvent.layout.width || 1;
			}}
			hitSlop={{ top: 12, bottom: 12 }}
			onStartShouldSetResponder={() => interactive}
			onMoveShouldSetResponder={() => interactive}
			onResponderGrant={(e) => setDragRatio(ratioFromEvent(e))}
			onResponderMove={(e) => setDragRatio(ratioFromEvent(e))}
			onResponderRelease={(e) => {
				onSeek?.(ratioFromEvent(e) * duration);
				setDragRatio(null);
			}}
			onResponderTerminate={() => setDragRatio(null)}
			style={[styles.track, { height, backgroundColor: theme.border, borderRadius: height / 2 }]}
		>
			<View
				pointerEvents="none"
				style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: theme.primary, borderRadius: height / 2 }]}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	track: { width: "100%", overflow: "hidden", justifyContent: "center" },
	fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
});

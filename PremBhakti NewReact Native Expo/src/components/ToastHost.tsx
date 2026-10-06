import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastStore } from "../store/toastStore";

const COLORS = { success: "#15803d", error: "#b91c1c", info: "#1f2937" };

export function ToastHost() {
	const { message, type, id, hide } = useToastStore();
	const insets = useSafeAreaInsets();
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(opacity, {
			toValue: message ? 1 : 0,
			duration: 180,
			useNativeDriver: true,
		}).start();
	}, [message, id, opacity]);

	if (!message) return null;

	return (
		<Animated.View
			pointerEvents="box-none"
			style={[styles.wrap, { top: insets.top + 8, opacity }]}
		>
			<Pressable
				onPress={hide}
				accessibilityRole="alert"
				style={[styles.toast, { backgroundColor: COLORS[type] }]}
			>
				<Text style={styles.text}>{message}</Text>
			</Pressable>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
	toast: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 12,
		elevation: 6,
		maxWidth: "100%",
	},
	text: { color: "#fff", fontSize: 14, fontWeight: "500", textAlign: "center" },
});

import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { useIsDarkMode } from "../theme/useAppTheme";

/**
 * `.bg-paper` from index.css — the page behind the app and the reader.
 * Light: warm cream paper lifting toward gold at the top edge. Dark: the
 * Vrindavan night sky with a royal-blue glow overhead. The web version's
 * radial glows are approximated with a fading top gradient.
 */
export function PaperBackground() {
	const isDark = useIsDarkMode();
	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none">
			<LinearGradient
				colors={isDark ? ["#071529", "#05142e", "#030b1a"] : ["#fffdf7", "#fff8e7", "#fdf1d6"]}
				locations={[0, 0.55, 1]}
				style={StyleSheet.absoluteFill}
			/>
			<LinearGradient
				colors={isDark ? ["rgba(16, 58, 140, 0.5)", "rgba(16, 58, 140, 0)"] : ["rgba(255, 213, 79, 0.18)", "rgba(255, 213, 79, 0)"]}
				style={styles.glow}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	glow: { position: "absolute", top: 0, left: 0, right: 0, height: "40%" },
});

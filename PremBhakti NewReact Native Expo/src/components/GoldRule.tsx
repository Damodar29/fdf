import { LinearGradient } from "expo-linear-gradient";
import type { StyleProp, ViewStyle } from "react-native";
import { ruleGradient } from "../theme/colors";

/** `bg-jm-rule` / `.jm-rule`: the gold hairline that fades out at both ends. */
export function GoldRule({ style, opacity = 1 }: { style?: StyleProp<ViewStyle>; opacity?: number }) {
	return (
		<LinearGradient
			colors={ruleGradient}
			locations={[0, 0.25, 0.5, 0.75, 1]}
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 0 }}
			pointerEvents="none"
			style={[{ height: 1, opacity }, style]}
		/>
	);
}

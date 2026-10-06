import { useNavigation } from "@react-navigation/native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { triggerHaptic } from "../lib/haptics";
import type { RootNavigation } from "../navigation/types";
import { useAppTheme } from "../theme/useAppTheme";

// Shared tab-screen chrome: title row with the settings shortcut (as in
// the Capacitor app's JanmashtamiHeader), a search box, and the
// loading / error / empty states every content list needs.

export function TabHeader({ title, right }: { title: string; right?: ReactNode }) {
	const theme = useAppTheme();
	const navigation = useNavigation<RootNavigation>();
	return (
		<View style={styles.header}>
			<Text style={[styles.title, { color: theme.primary }]} numberOfLines={1}>
				{title}
			</Text>
			<View style={styles.headerRight}>
				{right}
				<Pressable
					accessibilityLabel="Settings"
					hitSlop={12}
					onPress={() => {
						triggerHaptic("light");
						navigation.navigate("Settings");
					}}
					style={styles.iconButton}
				>
					<Text style={[styles.glyph, { color: theme.text }]}>{"⚙"}</Text>
				</Pressable>
			</View>
		</View>
	);
}

export function SearchBox({
	value,
	onChangeText,
	placeholder,
}: {
	value: string;
	onChangeText: (text: string) => void;
	placeholder: string;
}) {
	const theme = useAppTheme();
	return (
		<View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={theme.textMuted}
				returnKeyType="search"
				style={[styles.searchInput, { color: theme.text }]}
			/>
			{value ? (
				<Pressable accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChangeText("")}>
					<Text style={{ color: theme.textMuted, fontSize: 16 }}>{"✕"}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

/** Full-area state shown instead of a list: first load, load failure, or no results. */
export function ListState({
	loading,
	error,
	emptyText,
	onRetry,
}: {
	loading?: boolean;
	error?: string | null;
	emptyText?: string;
	onRetry?: () => void;
}) {
	const theme = useAppTheme();
	return (
		<View style={styles.centered}>
			{loading ? (
				<ActivityIndicator color={theme.primary} />
			) : error ? (
				<>
					<Text style={[styles.stateText, { color: theme.text }]}>
						Please connect to internet to get latest updated data
					</Text>
					{onRetry ? (
						<Pressable onPress={onRetry} style={[styles.retry, { backgroundColor: theme.primary }]}>
							<Text style={styles.retryText}>Retry</Text>
						</Pressable>
					) : null}
				</>
			) : (
				<Text style={[styles.stateText, { color: theme.textMuted }]}>{emptyText}</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	title: { fontSize: 20, fontWeight: "700", flexShrink: 1 },
	headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
	iconButton: { padding: 6 },
	glyph: { fontSize: 22 },
	search: {
		flexDirection: "row",
		alignItems: "center",
		margin: 12,
		paddingHorizontal: 14,
		borderRadius: 10,
		borderWidth: 1,
		gap: 8,
	},
	searchInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
	centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
	stateText: { fontSize: 14, textAlign: "center" },
	retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
	retryText: { color: "#fff", fontWeight: "600" },
});

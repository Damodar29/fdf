import { BookOpen, Download, FileQuestion, Music } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { formatBytes, useDownloadStore } from "../store/downloadStore";
import { ink } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

/** components/DownloadConfirmModal.tsx: title, file size, Cancel / Download. */
export function DownloadConfirmHost() {
	const theme = useAppTheme();
	const confirmation = useDownloadStore((s) => s.confirmation);
	const dismiss = useDownloadStore((s) => s.dismissConfirmation);
	if (!confirmation) return null;

	const unknown = confirmation.sizeBytes === 0;
	const Icon = unknown ? FileQuestion : confirmation.type === "audio" ? Music : BookOpen;

	return (
		<Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
			<View style={styles.scrim}>
				<View style={[styles.card, { backgroundColor: theme.isDark ? ink[900] : "#fff" }]}>
					<View style={[styles.icon, { backgroundColor: unknown ? "#ffedd5" : theme.p[100] }]}>
						<Icon size={unknown ? 28 : 24} color={unknown ? "#f97316" : theme.p[600]} />
					</View>
					<Text style={[styles.title, { color: theme.isDark ? "#fff" : ink[800] }]} numberOfLines={2}>
						{confirmation.title}
					</Text>
					<Text style={[styles.size, { color: theme.isDark ? ink[400] : ink[500] }]}>
						{unknown ? "Size unknown. Proceed with caution." : `File Size: ${formatBytes(confirmation.sizeBytes)}`}
					</Text>
					<View style={styles.actions}>
						<Pressable onPress={dismiss} style={[styles.button, { backgroundColor: theme.isDark ? ink[800] : ink[100] }]}>
							<Text style={[styles.cancelText, { color: theme.isDark ? ink[300] : ink[600] }]}>Cancel</Text>
						</Pressable>
						<Pressable onPress={confirmation.onConfirm} style={[styles.button, styles.row, { backgroundColor: theme.p[500] }]}>
							<Download size={18} color="#fff" />
							<Text style={styles.downloadText}>Download</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
	card: { width: "100%", maxWidth: 384, borderRadius: 16, padding: 24, alignItems: "center", elevation: 24 },
	icon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
	title: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 4 },
	size: { fontSize: 12, fontWeight: "500", marginBottom: 24 },
	actions: { flexDirection: "row", gap: 12, alignSelf: "stretch" },
	button: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
	row: { flexDirection: "row", gap: 8 },
	cancelText: { fontWeight: "700" },
	downloadText: { color: "#fff", fontWeight: "700" },
});

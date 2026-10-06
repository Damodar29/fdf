import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { MessageCircle, X } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";
import { CONTACTS } from "./DonateTypes";

interface DonateContactModalProps {
	visible: boolean;
	onClose: () => void;
	isHindi: boolean;
	onSelectContact: (number: string) => void;
}

export const DonateContactModal: React.FC<DonateContactModalProps> = ({
	visible,
	onClose,
	isHindi,
	onSelectContact,
}) => {
	const theme = useAppTheme();

	if (!visible) return null;

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<View style={styles.overlay}>
				<View style={[styles.content, { backgroundColor: theme.surface }]}>
					<View style={styles.header}>
						<Text style={[styles.title, { color: theme.text }]}>
							{isHindi ? "किसको भेजें?" : "Select Contact"}
						</Text>
						<TouchableOpacity onPress={onClose} style={styles.closeBtn}>
							<X size={20} color={theme.isDark ? "#94a3b8" : "#94a3b8"} />
						</TouchableOpacity>
					</View>

					<View style={styles.list}>
						<TouchableOpacity
							activeOpacity={0.7}
							onPress={() => onSelectContact(CONTACTS.NAMAN)}
							style={[styles.item, { borderColor: theme.isDark ? "#334155" : "#e2e8f0" }]}
						>
							<View style={styles.iconBox}>
								<MessageCircle size={20} color="#16a34a" />
							</View>
							<View style={styles.itemTextContent}>
								<Text style={[styles.itemName, { color: theme.text }]}>
									{isHindi ? "नारायण दास (नमन प्रभुजी)" : "Narayan Das (Naman Prabhuji)"}
								</Text>
								<Text style={[styles.itemNumber, { color: theme.isDark ? "#94a3b8" : "#64748b" }]}>
									{CONTACTS.NAMAN.replace(/^91/, "+91 ")}
								</Text>
							</View>
						</TouchableOpacity>

						<TouchableOpacity
							activeOpacity={0.7}
							onPress={() => onSelectContact(CONTACTS.LUCKY)}
							style={[styles.item, { borderColor: theme.isDark ? "#334155" : "#e2e8f0" }]}
						>
							<View style={styles.iconBox}>
								<MessageCircle size={20} color="#16a34a" />
							</View>
							<View style={styles.itemTextContent}>
								<Text style={[styles.itemName, { color: theme.text }]}>
									{isHindi ? "ललित कृष्णा दास (लकी प्रभुजी)" : "Lalit Krishna Das (Lucky Prabhuji)"}
								</Text>
								<Text style={[styles.itemNumber, { color: theme.isDark ? "#94a3b8" : "#64748b" }]}>
									{CONTACTS.LUCKY.replace(/^91/, "+91 ")}
								</Text>
							</View>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.6)",
		justifyContent: "center",
		alignItems: "center",
		padding: 16,
	},
	content: {
		width: "100%",
		maxWidth: 320,
		borderRadius: 24,
		padding: 24,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
	},
	title: {
		fontSize: 18,
		fontWeight: "700",
	},
	closeBtn: {
		padding: 4,
	},
	list: {
		gap: 12,
	},
	item: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		padding: 12,
		borderRadius: 16,
		borderWidth: 1,
	},
	iconBox: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#dcfce7",
		alignItems: "center",
		justifyContent: "center",
	},
	itemTextContent: {
		flex: 1,
	},
	itemName: {
		fontSize: 14,
		fontWeight: "700",
	},
	itemNumber: {
		fontSize: 12,
		fontFamily: "monospace",
	},
});

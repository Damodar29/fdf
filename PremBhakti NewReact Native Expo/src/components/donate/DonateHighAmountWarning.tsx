import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Info, Copy } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";

interface DonateHighAmountWarningProps {
	visible: boolean;
	onClose: () => void;
	isHindi: boolean;
	onCopyUPI: () => void;
	onDownloadAnyway: () => void;
}

export const DonateHighAmountWarning: React.FC<DonateHighAmountWarningProps> = ({
	visible,
	onClose,
	isHindi,
	onCopyUPI,
	onDownloadAnyway,
}) => {
	const theme = useAppTheme();

	if (!visible) return null;

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<View style={styles.overlay}>
				<View style={[styles.content, { backgroundColor: theme.surface }]}>
					<View style={styles.iconWrap}>
						<Info size={48} color="#f59e0b" />
					</View>
					
					<Text style={[styles.title, { color: theme.text }]}>
						{isHindi ? "महत्वपूर्ण सूचना" : "Important Notice"}
					</Text>
					<Text style={[styles.desc, { color: theme.isDark ? "#cbd5e1" : "#475569" }]}>
						{isHindi
							? "₹2000 से अधिक राशि के लिए, गैलरी से QR कोड स्कैन करना विफल हो सकता है (UPI सीमा के कारण)।"
							: "For amounts above ₹2000, scanning QR from gallery might fail due to UPI limits."}
					</Text>

					<View style={styles.actions}>
						<TouchableOpacity activeOpacity={0.8} onPress={onCopyUPI} style={[styles.btn, styles.copyBtn]}>
							<Copy size={18} color="#1d4ed8" />
							<Text style={[styles.btnText, { color: "#1d4ed8" }]}>
								{isHindi ? "UPI ID कॉपी करें" : "Copy UPI ID Instead"}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity activeOpacity={0.8} onPress={onDownloadAnyway} style={[styles.btn, { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" }]}>
							<Text style={[styles.btnText, { color: theme.isDark ? "#cbd5e1" : "#334155" }]}>
								{isHindi ? "फिर भी डाउनलोड करें" : "Download Anyway"}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.cancelBtn}>
							<Text style={[styles.cancelText, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>
								{isHindi ? "रद्द करें" : "Cancel"}
							</Text>
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
	iconWrap: {
		alignItems: "center",
		marginBottom: 16,
	},
	title: {
		fontSize: 18,
		fontWeight: "700",
		textAlign: "center",
		marginBottom: 8,
	},
	desc: {
		fontSize: 14,
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 24,
	},
	actions: {
		gap: 12,
	},
	btn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 12,
		borderRadius: 12,
		gap: 8,
	},
	copyBtn: {
		backgroundColor: "#dbeafe",
	},
	btnText: {
		fontSize: 14,
		fontWeight: "700",
	},
	cancelBtn: {
		paddingVertical: 8,
		alignItems: "center",
	},
	cancelText: {
		fontSize: 12,
		fontWeight: "500",
	},
});

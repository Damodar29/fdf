import React from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { ShieldCheck, User, Info, MessageCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../../theme/useAppTheme";
import jmColors from "../../theme/jmColors";
import { CustomDateInput } from "./CustomDateInput";

interface DonateConfirmStepProps {
	isHindi: boolean;
	canSendConfirmation: boolean;
	user: any; // Using any for simplicity here; will use proper store state in screen
	donorName: string;
	setDonorName: (name: string) => void;
	txnDate: string;
	setTxnDate: (date: string) => void;
	onSignIn: () => void;
	onSendWhatsApp: () => void;
}

export const DonateConfirmStep: React.FC<DonateConfirmStepProps> = ({
	isHindi,
	canSendConfirmation,
	user,
	donorName,
	setDonorName,
	txnDate,
	setTxnDate,
	onSignIn,
	onSendWhatsApp,
}) => {
	const theme = useAppTheme();

	return (
		<View style={styles.container}>
			{!canSendConfirmation ? (
				<View style={styles.waitContent}>
					<View style={[styles.infoBanner, { backgroundColor: theme.isDark ? "rgba(120,53,15,0.4)" : "#fffbeb", borderColor: theme.isDark ? "#78350f" : "#fde68a" }]}>
						<View style={[styles.infoIconBox, { backgroundColor: theme.isDark ? "#92400e" : "#fef3c7" }]}>
							<ShieldCheck size={24} color={theme.isDark ? "#fcd34d" : "#b45309"} />
						</View>
						<View style={styles.infoTextWrapper}>
							<Text style={[styles.infoTitle, { color: theme.isDark ? "#fef3c7" : "#78350f" }]}>
								{isHindi ? "सेवा अर्पण के लिए धन्यवाद! 🙏" : "Thank you for your Seva! 🙏"}
							</Text>
							<Text style={[styles.infoDesc, { color: theme.isDark ? "#fde68a" : "#92400e" }]}>
								{isHindi
									? "अगर आपको भुगतान की पुष्टि (रसीद) चाहिए, तो ऐप में लॉगिन करें और अपनी प्रोफाइल मंज़ूर करवाएं। प्रोफाइल मंज़ूर होने के बाद आप यहीं से पुष्टि भेज सकेंगे।"
									: "If you need a confirmation (receipt) of your payment, please sign in to the app and get your profile approved. Once your profile is approved, you can send the confirmation from here."}
							</Text>
						</View>
					</View>

					{!user && (
						<TouchableOpacity activeOpacity={0.8} onPress={onSignIn} style={styles.btn}>
							<LinearGradient
								colors={[jmColors.saffron[500], jmColors.orange[600]]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 0 }}
								style={styles.btnBg}
							/>
							<User size={20} color="#fff" />
							<Text style={styles.btnText}>{isHindi ? "लॉगिन करें" : "Sign In"}</Text>
						</TouchableOpacity>
					)}
				</View>
			) : (
				<View style={styles.formContent}>
					<View style={[styles.infoBanner, { backgroundColor: theme.isDark ? "rgba(30,58,138,0.2)" : "#eff6ff", borderColor: theme.isDark ? "#1e3a8a" : "#dbeafe" }]}>
						<View style={[styles.infoIconBox, { backgroundColor: theme.isDark ? "#1e3a8a" : "#dbeafe" }]}>
							<Info size={24} color={theme.isDark ? "#93c5fd" : "#2563eb"} />
						</View>
						<Text style={[styles.infoDesc, { flex: 1, color: theme.isDark ? "#bfdbfe" : "#1e40af" }]}>
							{isHindi
								? "कृपया नीचे अपना विवरण भरें। यह जानकारी व्हाट्सएप के माध्यम से ट्रस्ट को भेजी जाएगी ताकि आपकी रसीद बनाई जा सके।"
								: "Please fill in your details below. This information will be sent to the Trust via WhatsApp to generate your receipt."}
						</Text>
					</View>

					<View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						<View style={styles.inputGroup}>
							<View style={styles.inputLabelRow}>
								<User size={12} color={theme.isDark ? "#94a3b8" : "#64748b"} />
								<Text style={[styles.inputLabel, { color: theme.isDark ? "#94a3b8" : "#64748b" }]}>
									{isHindi ? "आपका नाम" : "Your Name"}
								</Text>
							</View>
							<TextInput
								style={[styles.textInput, { backgroundColor: theme.isDark ? "#0f172a" : "#f8fafc", borderColor: theme.isDark ? "#334155" : "#e2e8f0", color: theme.text }]}
								placeholder={isHindi ? "अपना नाम लिखें" : "Enter your full name"}
								placeholderTextColor={theme.isDark ? "#475569" : "#94a3b8"}
								value={donorName}
								onChangeText={setDonorName}
							/>
						</View>

						<View style={styles.inputGroup}>
							<Text style={[styles.inputLabel, { color: theme.isDark ? "#94a3b8" : "#64748b", marginLeft: 4 }]}>
								{isHindi ? "भुगतान दिनांक" : "Payment Date"}
							</Text>
							<CustomDateInput
								value={txnDate}
								onChange={setTxnDate}
								isHindi={isHindi}
							/>
						</View>
					</View>

					<TouchableOpacity
						activeOpacity={0.8}
						disabled={!donorName.trim()}
						onPress={onSendWhatsApp}
						style={[styles.btn, !donorName.trim() && { opacity: 0.5 }]}
					>
						<LinearGradient
							colors={["#25D366", "#20bd5a"]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 0 }}
							style={styles.btnBg}
						/>
						<MessageCircle size={22} color="#fff" fill="#fff" />
						<Text style={styles.btnText}>{isHindi ? "व्हाट्सएप पर भेजें" : "Send via WhatsApp"}</Text>
					</TouchableOpacity>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		padding: 16,
		paddingBottom: 40,
		maxWidth: 500,
		alignSelf: "center",
		width: "100%",
	},
	waitContent: {
		gap: 24,
	},
	formContent: {
		gap: 24,
	},
	infoBanner: {
		flexDirection: "row",
		padding: 20,
		borderRadius: 24,
		borderWidth: 1,
		gap: 16,
	},
	infoIconBox: {
		padding: 8,
		borderRadius: 24, // Circle
		alignSelf: "flex-start",
	},
	infoTextWrapper: {
		flex: 1,
		gap: 8,
	},
	infoTitle: {
		fontSize: 14,
		fontWeight: "700",
	},
	infoDesc: {
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 22,
	},
	formCard: {
		padding: 24,
		borderRadius: 24,
		borderWidth: 1,
		gap: 20,
	},
	inputGroup: {
		gap: 8,
	},
	inputLabelRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginLeft: 4,
	},
	inputLabel: {
		fontSize: 12,
		fontWeight: "700",
		textTransform: "uppercase",
	},
	textInput: {
		borderWidth: 1,
		borderRadius: 16,
		padding: 16,
		fontSize: 16,
		fontWeight: "700",
	},
	btn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		paddingVertical: 16,
		borderRadius: 16,
		gap: 8,
		overflow: "hidden",
	},
	btnBg: {
		...StyleSheet.absoluteFill,
	},
	btnText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "700",
	}
});

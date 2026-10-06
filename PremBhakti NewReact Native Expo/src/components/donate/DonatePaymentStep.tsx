import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Linking, Platform } from "react-native";
import { QrCode, Building2, ShieldCheck, Download, Copy, Check, ChevronRight, Info } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useAppTheme } from "../../theme/useAppTheme";
import jmColors from "../../theme/jmColors";
import { SEVA_OPTIONS, BANK_DETAILS, type CartItem, type PaymentMethod, UPI_ID } from "./DonateTypes";

interface DonatePaymentStepProps {
	isHindi: boolean;
	cart: CartItem[];
	cartTotal: number;
	paymentMethod: PaymentMethod;
	setPaymentMethod: (method: PaymentMethod) => void;
	copiedText: string | null;
	onCopy: (text: string) => void;
	onDownloadQR: () => void;
	onProceed: () => void;
}

export const DonatePaymentStep: React.FC<DonatePaymentStepProps> = ({
	isHindi,
	cart,
	cartTotal,
	paymentMethod,
	setPaymentMethod,
	copiedText,
	onCopy,
	onDownloadQR,
	onProceed,
}) => {
	const theme = useAppTheme();

	// Determine active bank context
	const uniqueContexts = Array.from(new Set(cart.map((item) => {
		const seva = SEVA_OPTIONS.find((s) => s.id === item.sevaId);
		return seva?.bankContext || "general";
	})));
	const activeBankContext = uniqueContexts.length === 1 && uniqueContexts[0] === "gauseva" ? "gauseva" : "general";
	const activeBank = BANK_DETAILS[activeBankContext];

	// Generate QR Code URL
	const amountParam = cartTotal > 0 ? `&am=${cartTotal.toFixed(2)}` : "";
	const upiDeepLink = `upi://pay?pa=${UPI_ID}${amountParam}`;
	const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiDeepLink)}&bgcolor=ffffff`;

	return (
		<View style={styles.container}>
			{/* Summary Card */}
			<View style={[styles.summaryCard, { borderColor: theme.isDark ? "#334155" : jmColors.orange[100], backgroundColor: theme.surface }]}>
				<LinearGradient colors={[jmColors.saffron[400], jmColors.orange[600]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroTopBorder} />
				<Text style={[styles.totalLabel, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>
					{isHindi ? "कुल सहयोग राशि" : "Total Donation Amount"}
				</Text>
				<Text style={[styles.totalAmount, { color: theme.text }]}>₹{cartTotal}</Text>

				{/* Items List */}
				<View style={styles.itemsList}>
					{cart.map((item) => {
						const SevaIcon = SEVA_OPTIONS.find((s) => s.id === item.sevaId)?.Icon;
						return (
							<View key={item.id} style={[styles.itemPill, { backgroundColor: theme.isDark ? "#334155" : "#ffffff", borderColor: theme.isDark ? "#475569" : jmColors.saffron[100] }]}>
								<View style={styles.itemPillLeft}>
									{SevaIcon && <SevaIcon size={14} color={theme.isDark ? jmColors.saffron[300] : jmColors.saffron[700]} />}
									<Text style={[styles.itemPillTitle, { color: theme.isDark ? jmColors.saffron[300] : jmColors.saffron[700] }]} numberOfLines={1}>
										{item.customName ? `${isHindi ? item.titleHi : item.titleEn} - ${item.customName}` : isHindi ? item.titleHi : item.titleEn}
									</Text>
								</View>
								<Text style={[styles.itemPillAmount, { color: theme.isDark ? jmColors.saffron[300] : jmColors.saffron[700] }]}>₹{item.amount}</Text>
							</View>
						);
					})}
				</View>
			</View>

			{/* Method Tabs */}
			<View style={[styles.tabsWrapper, { backgroundColor: theme.isDark ? "#1e293b" : "#e2e8f0" }]}>
				<TouchableOpacity
					activeOpacity={0.8}
					onPress={() => setPaymentMethod("upi")}
					style={[
						styles.tabButton,
						paymentMethod === "upi" ? [styles.tabButtonActive, { backgroundColor: theme.surface }] : undefined
					]}
				>
					<QrCode size={18} color={paymentMethod === "upi" ? (theme.isDark ? "#60a5fa" : "#2563eb") : (theme.isDark ? "#94a3b8" : "#64748b")} />
					<Text style={[styles.tabButtonText, { color: paymentMethod === "upi" ? (theme.isDark ? "#60a5fa" : "#2563eb") : (theme.isDark ? "#94a3b8" : "#64748b") }]}>
						UPI / QR
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					activeOpacity={0.8}
					onPress={() => setPaymentMethod("bank")}
					style={[
						styles.tabButton,
						paymentMethod === "bank" ? [styles.tabButtonActive, { backgroundColor: theme.surface }] : undefined
					]}
				>
					<Building2 size={18} color={paymentMethod === "bank" ? (theme.isDark ? "#60a5fa" : "#2563eb") : (theme.isDark ? "#94a3b8" : "#64748b")} />
					<Text style={[styles.tabButtonText, { color: paymentMethod === "bank" ? (theme.isDark ? "#60a5fa" : "#2563eb") : (theme.isDark ? "#94a3b8" : "#64748b") }]}>
						{isHindi ? "बैंक खाता" : "Bank Transfer"}
					</Text>
				</TouchableOpacity>
			</View>

			{/* Content Box */}
			<View style={[styles.contentBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
				<View style={styles.secureBadge}>
					<ShieldCheck size={16} color="#22c55e" />
					<Text style={styles.secureText}>SECURE</Text>
				</View>

				{paymentMethod === "upi" ? (
					<View style={styles.upiContent}>
						<View style={styles.qrWrapper}>
							<Image source={{ uri: qrCodeUrl }} style={styles.qrImage} />
						</View>
						<Text style={[styles.scanPrompt, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>
							{isHindi ? "किसी भी UPI ऐप से स्कैन करें" : "Scan with any UPI App"}
						</Text>

						<TouchableOpacity activeOpacity={0.8} onPress={onDownloadQR} style={styles.downloadBtn}>
							<Download size={20} color="#ffffff" />
							<Text style={styles.downloadBtnText}>
								{isHindi ? "QR कोड डाउनलोड करें" : "Download QR Code"}
							</Text>
						</TouchableOpacity>
						
						<View style={styles.warningWrapper}>
							<Text style={styles.warningText}>
								⚠️ {isHindi ? "यह QR केवल PhonePe ऐप में काम करेगा" : "This QR will only work in PhonePe app"}
							</Text>
						</View>

						<TouchableOpacity
							activeOpacity={0.7}
							onPress={() => onCopy(UPI_ID)}
							style={[styles.copyArea, { backgroundColor: theme.isDark ? "rgba(51,65,85,0.5)" : "#f8fafc", borderColor: theme.isDark ? "#475569" : "#cbd5e1" }]}
						>
							<Text style={[styles.copyPrompt, { color: theme.isDark ? "#94a3b8" : "#64748b" }]}>
								{isHindi ? "UPI आईडी कॉपी करें" : "Copy UPI ID"}
							</Text>
							<View style={styles.copyRow}>
								<Text style={[styles.copyValue, { color: theme.text }]}>{UPI_ID}</Text>
								{copiedText === UPI_ID ? (
									<Check size={20} color="#22c55e" strokeWidth={3} />
								) : (
									<Copy size={20} color="#3b82f6" />
								)}
							</View>
						</TouchableOpacity>
					</View>
				) : (
					<View style={styles.bankContent}>
						<View style={styles.bankField}>
							<Text style={[styles.fieldLabel, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>Beneficiary Name</Text>
							<View style={[styles.fieldRow, { backgroundColor: theme.isDark ? "rgba(51,65,85,0.5)" : "#f8fafc", borderColor: theme.isDark ? "#334155" : "#f1f5f9" }]}>
								<Text style={[styles.fieldValue, { color: theme.text, flex: 1 }]} numberOfLines={2}>{activeBank.name}</Text>
								<TouchableOpacity onPress={() => onCopy(activeBank.name)} style={styles.copyIconBtn}>
									<Copy size={16} color={theme.isDark ? "#94a3b8" : "#94a3b8"} />
								</TouchableOpacity>
							</View>
						</View>

						<View style={styles.bankGrid}>
							<View style={[styles.bankGridItem, { backgroundColor: theme.isDark ? "rgba(51,65,85,0.5)" : "#f8fafc", borderColor: theme.isDark ? "#334155" : "#f1f5f9" }]}>
								<Text style={[styles.fieldLabel, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>Bank</Text>
								<Text style={[styles.fieldValue, { color: theme.text }]}>{activeBank.bank}</Text>
							</View>
							<View style={[styles.bankGridItem, { backgroundColor: theme.isDark ? "rgba(51,65,85,0.5)" : "#f8fafc", borderColor: theme.isDark ? "#334155" : "#f1f5f9" }]}>
								<Text style={[styles.fieldLabel, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>Branch</Text>
								<Text style={[styles.fieldValue, { color: theme.text }]}>{activeBank.branch}</Text>
							</View>
						</View>

						<View style={[styles.fieldRow, { backgroundColor: theme.isDark ? "rgba(30,58,138,0.2)" : "#eff6ff", borderColor: theme.isDark ? "#1e3a8a" : "#dbeafe", marginTop: 8 }]}>
							<View style={{ flex: 1 }}>
								<Text style={[styles.fieldLabel, { color: "#60a5fa" }]}>Account No.</Text>
								<Text style={[styles.accValue, { color: theme.isDark ? "#dbeafe" : "#1e3a8a" }]}>{activeBank.acc}</Text>
							</View>
							<TouchableOpacity onPress={() => onCopy(activeBank.acc)} style={[styles.copyIconBtn, { backgroundColor: theme.isDark ? "#1e3a8a" : "#fff", padding: 8, borderRadius: 8 }]}>
								<Copy size={16} color="#3b82f6" />
							</TouchableOpacity>
						</View>

						<View style={[styles.fieldRow, { backgroundColor: theme.isDark ? "rgba(51,65,85,0.5)" : "#f8fafc", borderColor: theme.isDark ? "#334155" : "#f1f5f9", marginTop: 12 }]}>
							<View style={{ flex: 1 }}>
								<Text style={[styles.fieldLabel, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>IFSC Code</Text>
								<Text style={[styles.fieldValue, { color: theme.text }]}>{activeBank.ifsc}</Text>
							</View>
							<TouchableOpacity onPress={() => onCopy(activeBank.ifsc)} style={styles.copyIconBtn}>
								<Copy size={16} color={theme.isDark ? "#94a3b8" : "#94a3b8"} />
							</TouchableOpacity>
						</View>
					</View>
				)}
			</View>

			<TouchableOpacity activeOpacity={0.8} onPress={onProceed} style={styles.proceedBtn}>
				<LinearGradient
					colors={["#22c55e", "#16a34a"]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0 }}
					style={styles.proceedBtnBg}
				/>
				<Text style={styles.proceedBtnText}>{isHindi ? "भुगतान कर दिया? आगे बढ़ें" : "I have Paid, Proceed"}</Text>
				<ChevronRight size={20} color="#fff" />
			</TouchableOpacity>
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
	summaryCard: {
		borderWidth: 1,
		borderRadius: 24,
		padding: 24,
		alignItems: "center",
		marginBottom: 24,
		overflow: "hidden",
	},
	heroTopBorder: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 4,
	},
	totalLabel: {
		fontSize: 12,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: 4,
	},
	totalAmount: {
		fontSize: 40,
		fontWeight: "700",
		fontFamily: "monospace",
		letterSpacing: -1,
	},
	itemsList: {
		marginTop: 16,
		width: "100%",
		flexDirection: "column",
		gap: 8,
	},
	itemPill: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 24,
		borderWidth: 1,
	},
	itemPillLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		flex: 1,
		marginRight: 8,
	},
	itemPillTitle: {
		fontSize: 12,
		fontWeight: "700",
		flex: 1,
	},
	itemPillAmount: {
		fontSize: 12,
		fontWeight: "700",
	},
	tabsWrapper: {
		flexDirection: "row",
		padding: 4,
		borderRadius: 16,
		marginBottom: 24,
	},
	tabButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 12,
		borderRadius: 12,
		gap: 8,
	},
	tabButtonActive: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	tabButtonText: {
		fontSize: 14,
		fontWeight: "700",
	},
	contentBox: {
		borderWidth: 1,
		borderRadius: 24,
		padding: 24,
		minHeight: 300,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 24,
	},
	secureBadge: {
		position: "absolute",
		top: 12,
		right: 16,
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	secureText: {
		fontSize: 10,
		fontWeight: "700",
		color: "#16a34a",
		letterSpacing: 1,
	},
	upiContent: {
		width: "100%",
		alignItems: "center",
	},
	qrWrapper: {
		backgroundColor: "#fff",
		padding: 8,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: "#f1f5f9",
		marginBottom: 16,
		marginTop: 16,
	},
	qrImage: {
		width: 192,
		height: 192,
	},
	scanPrompt: {
		fontSize: 12,
		fontWeight: "500",
		marginBottom: 16,
	},
	downloadBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#5f259f",
		width: "100%",
		paddingVertical: 14,
		borderRadius: 16,
		gap: 8,
		marginBottom: 8,
	},
	downloadBtnText: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "700",
	},
	warningWrapper: {
		backgroundColor: "rgba(95,37,159,0.1)",
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 24,
		marginBottom: 20,
	},
	warningText: {
		color: "#a874e6",
		fontSize: 11,
		fontWeight: "700",
	},
	copyArea: {
		width: "100%",
		padding: 16,
		borderRadius: 16,
		borderWidth: 2,
		borderStyle: "dashed",
		alignItems: "center",
	},
	copyPrompt: {
		fontSize: 10,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: 4,
	},
	copyRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	copyValue: {
		fontSize: 18,
		fontWeight: "700",
		fontFamily: "monospace",
		letterSpacing: 1,
	},
	bankContent: {
		width: "100%",
		marginTop: 16,
	},
	bankField: {
		marginBottom: 12,
	},
	fieldLabel: {
		fontSize: 10,
		fontWeight: "700",
		textTransform: "uppercase",
		marginBottom: 6,
	},
	fieldRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
	},
	fieldValue: {
		fontSize: 14,
		fontWeight: "700",
		lineHeight: 20,
	},
	accValue: {
		fontSize: 18,
		fontWeight: "700",
		fontFamily: "monospace",
		letterSpacing: 1,
	},
	copyIconBtn: {
		padding: 4,
	},
	bankGrid: {
		flexDirection: "row",
		gap: 12,
	},
	bankGridItem: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
	},
	proceedBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		paddingVertical: 16,
		borderRadius: 16,
		gap: 8,
		overflow: "hidden",
	},
	proceedBtnBg: {
		...StyleSheet.absoluteFill,
	},
	proceedBtnText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "700",
	}
});

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking, Platform, BackHandler } from "react-native";
import { ArrowLeft, ChevronRight, Languages } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import ReactNativeBlobUtil from "react-native-blob-util";
import { useFocusEffect } from "@react-navigation/native";
import { type NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAppTheme } from "../theme/useAppTheme";
import jmColors from "../theme/jmColors";
import { useSettingsStore } from "../store/settingsStore";
import { useAuthStore } from "../store/authStore";
import { useProfileStore } from "../store/profileStore";
import { showToast } from "../store/toastStore";
import type { RootStackParamList } from "../navigation/types";

// Components
import { DonateSelectionStep } from "../components/donate/DonateSelectionStep";
import { DonatePaymentStep } from "../components/donate/DonatePaymentStep";
import { DonateConfirmStep } from "../components/donate/DonateConfirmStep";
import { DonateContactModal } from "../components/donate/DonateContactModal";
import { DonateHighAmountWarning } from "../components/donate/DonateHighAmountWarning";
import { type Step, type PaymentMethod, type CartItem, SEVA_OPTIONS, toLocalDateKey, UPI_ID } from "../components/donate/DonateTypes";

type Props = NativeStackScreenProps<RootStackParamList, "Donate"> & { onBack?: () => void };

export const DonateScreen: React.FC<Props> = ({ navigation, onBack }) => {
	const theme = useAppTheme();
	
	// App Stores
	const { settingsLanguage, setSettingsLanguage } = useSettingsStore();
	const { user } = useAuthStore();
	const { profile } = useProfileStore();
	const isHindi = settingsLanguage === "hi";

	// Logic State
	const [step, setStep] = useState<Step>("selection");
	const [selectedSevaId, setSelectedSevaId] = useState<string | null>(null);
	const [amount, setAmount] = useState<number | "">("");
	const [customAmountStr, setCustomAmountStr] = useState("");
	const [customSevaName, setCustomSevaName] = useState<string | null>(null);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");

	// UI Feedback State
	const [copiedText, setCopiedText] = useState<string | null>(null);
	const [donorName, setDonorName] = useState(profile?.realName || user?.displayName || "");
	const [txnDate, setTxnDate] = useState(() => toLocalDateKey());
	const [showContactModal, setShowContactModal] = useState(false);
	const [showHighAmountWarning, setShowHighAmountWarning] = useState(false);

	const canSendConfirmation = !!user && profile?.isApproved === true;

	const cartTotal = cart.reduce((sum, item) => sum + item.amount, 0);
	const currentTotal = amount ? Number(amount) : 0;
	const grandTotal = cartTotal + currentTotal;

	// Back Button Handling
	const handleBack = useCallback(() => {
		if (showContactModal) {
			setShowContactModal(false);
			return true;
		}
		if (showHighAmountWarning) {
			setShowHighAmountWarning(false);
			return true;
		}
		if (step === "confirm") {
			setStep("payment");
			return true;
		}
		if (step === "payment") {
			setStep("selection");
			return true;
		}
		if (onBack) {
			onBack();
		} else {
			navigation.goBack();
		}
		return true;
	}, [step, showContactModal, showHighAmountWarning, navigation, onBack]);

	useFocusEffect(
		useCallback(() => {
			const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
			return () => sub.remove();
		}, [handleBack])
	);

	const handleAddToCart = () => {
		if (amount && amount > 0 && selectedSevaId) {
			const seva = SEVA_OPTIONS.find((s) => s.id === selectedSevaId);
			if (seva) {
				const newItem: CartItem = {
					id: Date.now().toString(),
					sevaId: seva.id,
					titleEn: seva.titleEn,
					titleHi: seva.titleHi,
					amount: Number(amount),
					customName: customSevaName,
				};
				setCart((prev) => [...prev, newItem]);
				// Reset selection
				setAmount("");
				setCustomAmountStr("");
				setCustomSevaName(null);
			}
		}
	};

	const handleProceedSelection = () => {
		if (currentTotal > 0 && selectedSevaId) {
			handleAddToCart();
			setStep("payment");
		} else if (cart.length > 0) {
			setStep("payment");
		}
	};

	const handleProceedPayment = () => {
		setStep("confirm");
	};

	const handleCopy = async (text: string) => {
		await Clipboard.setStringAsync(text);
		setCopiedText(text);
		setTimeout(() => setCopiedText(null), 2000);
	};

	const amountParam = cartTotal > 0 ? `&am=${cartTotal.toFixed(2)}` : "";
	const upiDeepLink = `upi://pay?pa=${UPI_ID}${amountParam}`;
	const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiDeepLink)}&bgcolor=ffffff`;

	const proceedWithDownload = async () => {
		setShowHighAmountWarning(false);
		try {
			if (Platform.OS === "web") {
				Linking.openURL(qrCodeUrl);
				return;
			}
			const dirs = ReactNativeBlobUtil.fs.dirs;
			const path = `${dirs.DownloadDir}/prem-bhakti-seva-qr-${cartTotal}-${Date.now()}.png`;

			showToast(isHindi ? "QR कोड डाउनलोड हो रहा है..." : "Downloading QR Code...", "info");
			const res = await ReactNativeBlobUtil.config({
				fileCache: true,
				addAndroidDownloads: {
					useDownloadManager: true,
					notification: true,
					mediaScannable: true,
					title: `prem-bhakti-seva-qr-${cartTotal}.png`,
					path: path,
				},
			}).fetch("GET", qrCodeUrl);
			
			if (res.path()) {
				showToast(isHindi ? "QR कोड दस्तावेज़ फ़ोल्डर में सहेजा गया" : "QR Code saved to Downloads folder", "success");
			}
		} catch (e) {
			console.error("QR Download failed", e);
			Linking.openURL(qrCodeUrl).catch(() => {});
		}
	};

	const handleDownloadQR = () => {
		if (cartTotal > 1999) {
			setShowHighAmountWarning(true);
			return;
		}
		proceedWithDownload();
	};

	const generateMessage = () => {
		const itemsList = cart.map((item) => {
			const baseTitle = isHindi ? item.titleHi : item.titleEn;
			const finalTitle = item.customName ? `${baseTitle} (${item.customName})` : baseTitle;
			return `• ${finalTitle}: ₹${item.amount}`;
		}).join("\n");

		const method = paymentMethod === "upi" ? "UPI/QR" : "Bank Transfer";

		return isHindi
			? `हरे कृष्णा! मैंने सेवा अर्पण की है।\n\n• नाम: ${donorName}\n\nसेवा विवरण:\n${itemsList}\n\n• कुल राशि: ₹${cartTotal}\n• माध्यम: ${method}\n• दिनांक: ${txnDate}\n\nकृपया रसीद प्रदान करें। (स्क्रीनशॉट संलग्न है)`
			: `Hare Krishna! I have offered Seva.\n\n• Name: ${donorName}\n\nSeva Details:\n${itemsList}\n\n• Total Amount: ₹${cartTotal}\n• Method: ${method}\n• Date: ${txnDate}\n\nPlease verify. (Screenshot attached)`;
	};

	const openWhatsApp = (number: string) => {
		const url = `whatsapp://send?phone=${number}&text=${encodeURIComponent(generateMessage())}`;
		Linking.openURL(url).catch(() => {
			showToast(isHindi ? "WhatsApp नहीं मिला" : "WhatsApp not installed", "error");
		});
		setShowContactModal(false);
	};

	const renderProgress = () => {
		const steps = [
			{ id: "selection", labelHi: "चुनें", labelEn: "Select" },
			{ id: "payment", labelHi: "भुगतान", labelEn: "Pay" },
			{ id: "confirm", labelHi: "पुष्टि", labelEn: "Confirm" },
		];

		return (
			<View style={styles.progressContainer}>
				<View style={[styles.progressBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
					{steps.map((s, idx) => {
						const isActive = step === s.id;
						return (
							<React.Fragment key={s.id}>
								<Text style={[styles.progressText, isActive && { color: jmColors.saffron[500] }]}>
									{isHindi ? s.labelHi : s.labelEn}
								</Text>
								{idx < steps.length - 1 && (
									<ChevronRight size={12} color={theme.isDark ? "#94a3b8" : "#94a3b8"} style={{ marginHorizontal: 8 }} />
								)}
							</React.Fragment>
						);
					})}
				</View>
			</View>
		);
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.page }]}>
			{/* Header */}
			<View style={[styles.header, { backgroundColor: theme.isDark ? "#0f172a" : jmColors.orange[500] }]}>
				{!theme.isDark && (
					<LinearGradient
						colors={[jmColors.saffron[500], jmColors.saffron[500]]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						style={StyleSheet.absoluteFill}
					/>
				)}
				<View style={styles.headerTop}>
					<View style={styles.headerLeft}>
						<TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
							<ArrowLeft size={24} color="#fff" />
						</TouchableOpacity>
						<Text style={styles.headerTitle}>{isHindi ? "सेवा समर्पण" : "Offer Seva"}</Text>
					</View>
					
					<TouchableOpacity
						activeOpacity={0.7}
						onPress={() => setSettingsLanguage(isHindi ? "en" : "hi")}
						style={styles.langBtn}
					>
						<Languages size={14} color="#fff" />
						<Text style={styles.langText}>{isHindi ? "English" : "हिंदी"}</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* Progress */}
			{renderProgress()}

			{/* Main Scrollable Area */}
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
				{step === "selection" && (
					<DonateSelectionStep
						isHindi={isHindi}
						selectedSevaId={selectedSevaId}
						onSelectSeva={(id) => {
							if (selectedSevaId === id) {
								setSelectedSevaId(null);
								setAmount("");
								setCustomSevaName(null);
							} else {
								setSelectedSevaId(id);
								setAmount("");
								setCustomAmountStr("");
								setCustomSevaName(null);
							}
						}}
						amount={amount}
						onSelectAmount={(amt) => {
							setAmount(amt);
							setCustomAmountStr("");
							setCustomSevaName(null);
						}}
						onSelectFixedItem={(item) => {
							setAmount(item.amount);
							setCustomSevaName(isHindi ? item.labelHi : item.labelEn);
							setCustomAmountStr("");
						}}
						customAmountStr={customAmountStr}
						onCustomAmountChange={(val) => {
							setCustomAmountStr(val);
							const num = parseInt(val, 10);
							setAmount(Number.isNaN(num) ? "" : num);
							setCustomSevaName(null);
						}}
						cart={cart}
						onAddToCart={handleAddToCart}
						onRemoveFromCart={(id) => setCart((prev) => prev.filter((item) => item.id !== id))}
						onProceed={handleProceedSelection}
					/>
				)}

				{step === "payment" && (
					<DonatePaymentStep
						isHindi={isHindi}
						cart={cart}
						cartTotal={cartTotal}
						paymentMethod={paymentMethod}
						setPaymentMethod={setPaymentMethod}
						copiedText={copiedText}
						onCopy={handleCopy}
						onDownloadQR={handleDownloadQR}
						onProceed={handleProceedPayment}
					/>
				)}

				{step === "confirm" && (
					<DonateConfirmStep
						isHindi={isHindi}
						canSendConfirmation={canSendConfirmation}
						user={user}
						donorName={donorName}
						setDonorName={setDonorName}
						txnDate={txnDate}
						setTxnDate={setTxnDate}
						onSignIn={() => {
							// For login, we can navigate to Login screen
							navigation.navigate("Login");
						}}
						onSendWhatsApp={() => setShowContactModal(true)}
					/>
				)}
			</ScrollView>

			{/* Modals */}
			<DonateContactModal
				visible={showContactModal}
				onClose={() => setShowContactModal(false)}
				isHindi={isHindi}
				onSelectContact={openWhatsApp}
			/>
			
			<DonateHighAmountWarning
				visible={showHighAmountWarning}
				onClose={() => setShowHighAmountWarning(false)}
				isHindi={isHindi}
				onCopyUPI={() => {
					handleCopy(UPI_ID);
					setShowHighAmountWarning(false);
				}}
				onDownloadAnyway={proceedWithDownload}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		paddingTop: Platform.OS === "ios" ? 50 : 40,
		paddingBottom: 24, // Extra padding for progress bar overlap
		paddingHorizontal: 16,
		borderBottomWidth: 2,
		borderBottomColor: "rgba(251, 191, 36, 0.4)",
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		zIndex: 10,
	},
	headerTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	backBtn: {
		padding: 8,
		backgroundColor: "rgba(255,255,255,0.2)",
		borderRadius: 20,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: "#fff",
	},
	langBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: "rgba(255,255,255,0.2)",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.3)",
	},
	langText: {
		fontSize: 12,
		fontWeight: "700",
		color: "#fff",
	},
	progressContainer: {
		alignItems: "center",
		marginTop: -16,
		zIndex: 20,
	},
	progressBox: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 1,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	progressText: {
		fontSize: 10,
		fontWeight: "700",
		color: "#94a3b8",
	},
	scrollView: {
		flex: 1,
		zIndex: 0,
	},
	scrollContent: {
		paddingTop: 8,
	}
});

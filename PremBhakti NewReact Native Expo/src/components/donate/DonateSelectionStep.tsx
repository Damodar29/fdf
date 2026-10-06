import React from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { HandHeart, Check, Star, ChevronRight, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../../theme/useAppTheme";
import jmColors from "../../theme/jmColors";
import { SEVA_OPTIONS, type SevaItem, type CartItem } from "./DonateTypes";

interface DonateSelectionStepProps {
	isHindi: boolean;
	selectedSevaId: string | null;
	onSelectSeva: (id: string) => void;
	amount: number | "";
	onSelectAmount: (amt: number) => void;
	onSelectFixedItem: (item: SevaItem) => void;
	customAmountStr: string;
	onCustomAmountChange: (val: string) => void;
	cart: CartItem[];
	onAddToCart: () => void;
	onRemoveFromCart: (id: string) => void;
	onProceed: () => void;
}

export const DonateSelectionStep: React.FC<DonateSelectionStepProps> = ({
	isHindi,
	selectedSevaId,
	onSelectSeva,
	amount,
	onSelectAmount,
	onSelectFixedItem,
	customAmountStr,
	onCustomAmountChange,
	cart,
	onAddToCart,
	onRemoveFromCart,
	onProceed,
}) => {
	const theme = useAppTheme();
	const cartTotal = cart.reduce((sum, item) => sum + item.amount, 0);
	const currentTotal = amount ? Number(amount) : 0;
	const grandTotal = cartTotal + currentTotal;

	const getColorStyles = (colorTheme: string, isSelected: boolean) => {
		if (isSelected) {
			return {
				bg: jmColors.saffron[500],
				icon: "#ffffff",
				border: jmColors.saffron[500],
			};
		}
		switch (colorTheme) {
			case "pink":
				return { bg: theme.isDark ? "#331625" : jmColors.pink[100], icon: jmColors.pink[600], border: theme.isDark ? "#4d1e37" : jmColors.pink[200] };
			case "green":
				return { bg: theme.isDark ? "#142c1e" : jmColors.green[100], icon: jmColors.green[600], border: theme.isDark ? "#1f442e" : jmColors.green[200] };
			case "orange":
				return { bg: theme.isDark ? "#331d12" : jmColors.orange[100], icon: jmColors.orange[600], border: theme.isDark ? "#4d2b1a" : jmColors.orange[200] };
			case "blue":
				return { bg: theme.isDark ? "#17263b" : jmColors.blue[100], icon: jmColors.blue[600], border: theme.isDark ? "#223859" : jmColors.blue[200] };
			default:
				return { bg: theme.surface, icon: theme.text, border: theme.border };
		}
	};

	return (
		<View style={styles.container}>
			<View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.isDark ? "#334155" : jmColors.saffron[100] }]}>
				<LinearGradient colors={["transparent", jmColors.saffron[500], "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroTopBorder} />
				<View style={[styles.heroIconWrapper, { backgroundColor: theme.isDark ? "#334155" : jmColors.saffron[100] }]}>
					<HandHeart size={32} color={theme.isDark ? jmColors.saffron[400] : jmColors.saffron[600]} />
				</View>
				<Text style={[styles.heroTitle, { color: theme.text }]}>
					यत्करोषि यदश्नासि यज्जुहोषि ददासि यत्।{"\n"}यत्तपस्यसि कौन्तेय तत्कुरुष्व मदर्पणम्॥
				</Text>
				<Text style={[styles.heroDesc, { color: theme.isDark ? "#94a3b8" : "#64748b" }]}>
					हे कुन्तीपुत्र! तुम जो कुछ करते हो, जो कुछ खाते हो, जो कुछ अर्पित करते हो या दान देते हो और जो भी तपस्या करते हो, उसे मुझे अर्पित करते हुए करो।
				</Text>
			</View>

			<View style={styles.chooseSection}>
				<View style={styles.sectionHeader}>
					<Star size={12} color={jmColors.saffron[500]} fill={jmColors.saffron[500]} />
					<Text style={[styles.sectionTitle, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>
						{isHindi ? "सेवा का चयन करें" : "Choose a Cause"}
					</Text>
				</View>

				<View style={styles.grid}>
					{SEVA_OPTIONS.map((seva) => {
						const isSelected = selectedSevaId === seva.id;
						const colors = getColorStyles(seva.colorTheme, isSelected);

						return (
							<TouchableOpacity
								activeOpacity={0.8}
								key={seva.id}
								onPress={() => onSelectSeva(seva.id)}
								style={[
									styles.sevaCard,
									{ backgroundColor: theme.surface, borderColor: isSelected ? jmColors.saffron[500] : colors.border },
									isSelected && styles.sevaCardSelected,
								]}
							>
								{/* Tag */}
								{(isHindi ? seva.tagHi : seva.tagEn) && (
									<LinearGradient
										colors={[jmColors.saffron[500], jmColors.orange[500]]}
										start={{ x: 1, y: 0 }}
										end={{ x: 0, y: 1 }}
										style={styles.tagWrapper}
									>
										<Text style={styles.tagText}>{isHindi ? seva.tagHi : seva.tagEn}</Text>
									</LinearGradient>
								)}

								<View style={styles.sevaHeader}>
									<View style={[styles.sevaIconBox, { backgroundColor: colors.bg }]}>
										<seva.Icon size={28} color={colors.icon} />
									</View>
									<View style={styles.sevaTextContent}>
										<Text style={[styles.sevaTitle, { color: isSelected ? (theme.isDark ? jmColors.saffron[400] : jmColors.saffron[700]) : theme.text }]}>
											{isHindi ? seva.titleHi : seva.titleEn}
										</Text>
										<Text style={[styles.sevaDesc, { color: theme.isDark ? "#94a3b8" : "#64748b" }]}>
											{isHindi ? seva.descHi : seva.descEn}
										</Text>
									</View>
									{isSelected && (
										<View style={styles.checkIcon}>
											<Check size={24} color={jmColors.saffron[500]} strokeWidth={3} />
										</View>
									)}
								</View>

								{isSelected && (
									<View style={[styles.expandedArea, { borderTopColor: theme.isDark ? "#334155" : jmColors.saffron[200], backgroundColor: theme.isDark ? "rgba(15,23,42,0.3)" : "rgba(255,247,237,0.5)" }]}>
										<Text style={[styles.amountPrompt, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>
											{seva.id === "general"
												? isHindi
													? "सेवा राशि भरें"
													: "Enter Seva Amount"
												: isHindi
													? "सेवा राशि चुनें"
													: "Select Seva Amount"}
										</Text>

										{seva.fixedItems ? (
											<View style={styles.fixedItemsList}>
												{seva.fixedItems.map((item, idx) => {
													const isItemSel = amount === item.amount; // simplification: customSevaName logic handled in parent
													return (
														<TouchableOpacity
															key={idx}
															activeOpacity={0.7}
															onPress={() => onSelectFixedItem(item)}
															style={[
																styles.fixedItemBtn,
																{ backgroundColor: isItemSel ? jmColors.saffron[500] : theme.surface, borderColor: isItemSel ? jmColors.saffron[500] : theme.border },
															]}
														>
															<Text style={[styles.fixedItemLabel, { color: isItemSel ? "#fff" : theme.text }]}>
																{isHindi ? item.labelHi : item.labelEn}
															</Text>
															<Text style={[styles.fixedItemAmt, { color: isItemSel ? "#fff" : theme.text }]}>
																₹{item.amount}
															</Text>
														</TouchableOpacity>
													);
												})}
											</View>
										) : (
											<View style={styles.amountsList}>
												{seva.amounts?.map((amt) => {
													const isAmtSel = amount === amt;
													return (
														<TouchableOpacity
															key={amt}
															activeOpacity={0.7}
															onPress={() => onSelectAmount(amt)}
															style={[
																styles.amountBtn,
																{ backgroundColor: isAmtSel ? jmColors.saffron[500] : theme.surface, borderColor: isAmtSel ? jmColors.saffron[500] : theme.border },
															]}
														>
															<Text style={[styles.amountBtnText, { color: isAmtSel ? "#fff" : theme.text }]}>
																₹{amt}
															</Text>
														</TouchableOpacity>
													);
												})}
											</View>
										)}

										<View style={styles.customAmountContainer}>
											<View style={[styles.customDivider, { borderColor: theme.border }]} />
											{seva.id !== "general" && (
												<View style={styles.customLabelWrapper}>
													<Text style={[styles.customLabel, { color: theme.isDark ? "#94a3b8" : "#94a3b8", backgroundColor: theme.isDark ? "#0f172a" : "#fff7ed" }]}>
														{isHindi ? "या अन्य राशि" : "Or Custom Amount"}
													</Text>
												</View>
											)}
											<View style={styles.inputWrapper}>
												<Text style={[styles.currencySymbol, { color: theme.isDark ? "#94a3b8" : "#94a3b8" }]}>₹</Text>
												<TextInput
													style={[styles.customInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
													placeholder={isHindi ? "अन्य राशि लिखें..." : "Enter custom amount..."}
													placeholderTextColor={theme.isDark ? "#64748b" : "#94a3b8"}
													keyboardType="numeric"
													value={customAmountStr}
													onChangeText={onCustomAmountChange}
												/>
											</View>
										</View>
									</View>
								)}
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

			{/* Floating Bottom Bar */}
			{grandTotal > 0 && (
				<View style={styles.bottomBarContainer}>
					{cart.length > 0 && (
						<View style={[styles.cartSummary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
							<View style={[styles.cartHeader, { backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc", borderBottomColor: theme.border }]}>
								<Text style={[styles.cartTitle, { color: theme.isDark ? "#94a3b8" : "#64748b" }]}>
									{isHindi ? "सेवा कार्ट" : "Seva Cart"} ({cart.length})
								</Text>
								<Text style={[styles.cartTotal, { color: theme.text }]}>₹{cartTotal}</Text>
							</View>
							<View style={styles.cartItemsList}>
								{cart.map((item) => (
									<View key={item.id} style={[styles.cartItemRow, { backgroundColor: theme.isDark ? "rgba(51,65,85,0.3)" : "#f8fafc" }]}>
										<View style={styles.cartItemTextContent}>
											<Text style={[styles.cartItemTitle, { color: theme.text }]} numberOfLines={1}>
												{isHindi ? item.titleHi : item.titleEn}
											</Text>
											{item.customName && (
												<Text style={[styles.cartItemSub, { color: theme.isDark ? "#cbd5e1" : "#94a3b8" }]} numberOfLines={1}>
													{item.customName}
												</Text>
											)}
										</View>
										<View style={styles.cartItemRight}>
											<Text style={[styles.cartItemAmount, { color: theme.isDark ? "#94a3b8" : "#475569" }]}>₹{item.amount}</Text>
											<TouchableOpacity onPress={() => onRemoveFromCart(item.id)} style={styles.removeBtn}>
												<X size={14} color="#ef4444" />
											</TouchableOpacity>
										</View>
									</View>
								))}
							</View>
						</View>
					)}

					<View style={styles.actionRow}>
						{amount !== "" && (
							<TouchableOpacity onPress={onAddToCart} style={[styles.addBtn, { borderColor: jmColors.saffron[500], backgroundColor: theme.surface }]}>
								<Text style={[styles.addBtnIcon, { color: jmColors.saffron[500] }]}>+</Text>
								<Text style={[styles.addBtnText, { color: jmColors.saffron[500] }]}>{isHindi ? "जोड़ें" : "Add"}</Text>
							</TouchableOpacity>
						)}

						{(cart.length > 0 || amount !== "") && (
							<TouchableOpacity activeOpacity={0.8} onPress={onProceed} style={styles.proceedBtn}>
								<LinearGradient
									colors={[jmColors.saffron[500], jmColors.orange[600]]}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 0 }}
									style={styles.proceedBtnBg}
								/>
								<Text style={styles.proceedBtnText}>{isHindi ? "आगे बढ़ें" : "Proceed"}</Text>
								<ChevronRight size={18} color="#fff" />
							</TouchableOpacity>
						)}
					</View>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		padding: 16,
		paddingBottom: 250, // Space for FAB and Cart Summary
	},
	heroCard: {
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
	heroIconWrapper: {
		width: 64,
		height: 64,
		borderRadius: 32,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
	},
	heroTitle: {
		fontSize: 20,
		fontWeight: "700",
		textAlign: "center",
		marginBottom: 8,
		lineHeight: 28,
	},
	heroDesc: {
		fontSize: 14,
		textAlign: "center",
		lineHeight: 22,
	},
	chooseSection: {
		marginTop: 8,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 16,
		paddingHorizontal: 8,
	},
	sectionTitle: {
		fontSize: 12,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	grid: {
		gap: 16,
	},
	sevaCard: {
		borderWidth: 2,
		borderRadius: 16,
		overflow: "hidden",
	},
	sevaCardSelected: {
		transform: [{ scale: 1.01 }],
	},
	tagWrapper: {
		position: "absolute",
		top: 0,
		right: 0,
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderBottomLeftRadius: 12,
		zIndex: 10,
	},
	tagText: {
		color: "#fff",
		fontSize: 9,
		fontWeight: "700",
	},
	sevaHeader: {
		flexDirection: "row",
		padding: 20,
		alignItems: "flex-start",
	},
	sevaIconBox: {
		width: 56,
		height: 56,
		borderRadius: 28,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	sevaTextContent: {
		flex: 1,
		paddingTop: 4,
	},
	sevaTitle: {
		fontSize: 18,
		fontWeight: "700",
		marginBottom: 4,
	},
	sevaDesc: {
		fontSize: 12,
		lineHeight: 18,
	},
	checkIcon: {
		position: "absolute",
		bottom: 16,
		right: 16,
	},
	expandedArea: {
		paddingHorizontal: 20,
		paddingBottom: 20,
		paddingTop: 8,
		borderTopWidth: 1,
		borderStyle: "dashed",
	},
	amountPrompt: {
		fontSize: 10,
		fontWeight: "700",
		textTransform: "uppercase",
		marginBottom: 12,
		marginTop: 8,
	},
	fixedItemsList: {
		gap: 8,
		marginBottom: 8,
	},
	fixedItemBtn: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 12,
		borderWidth: 1,
		borderRadius: 8,
	},
	fixedItemLabel: {
		fontSize: 14,
		fontWeight: "700",
	},
	fixedItemAmt: {
		fontSize: 14,
		fontFamily: "monospace",
	},
	amountsList: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginBottom: 16,
	},
	amountBtn: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderWidth: 1,
		borderRadius: 8,
	},
	amountBtnText: {
		fontSize: 14,
		fontWeight: "700",
	},
	customAmountContainer: {
		marginTop: 8,
	},
	customDivider: {
		borderTopWidth: 1,
		marginBottom: 24,
	},
	customLabelWrapper: {
		position: "absolute",
		top: -8,
		left: 0,
		right: 0,
		alignItems: "center",
	},
	customLabel: {
		fontSize: 10,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1,
		paddingHorizontal: 8,
	},
	inputWrapper: {
		flexDirection: "row",
		alignItems: "center",
	},
	currencySymbol: {
		position: "absolute",
		left: 16,
		fontSize: 16,
		fontWeight: "700",
		zIndex: 1,
	},
	customInput: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 12,
		paddingLeft: 36,
		paddingRight: 16,
		paddingVertical: 12,
		fontSize: 16,
		fontWeight: "700",
	},
	bottomBarContainer: {
		position: "absolute",
		bottom: 24,
		left: 16,
		right: 16,
		alignItems: "center",
		gap: 12,
		zIndex: 20,
	},
	cartSummary: {
		width: "100%",
		maxWidth: 400,
		borderRadius: 16,
		borderWidth: 1,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 5,
	},
	cartHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 12,
		borderBottomWidth: 1,
	},
	cartTitle: {
		fontSize: 12,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	cartTotal: {
		fontSize: 14,
		fontWeight: "700",
	},
	cartItemsList: {
		padding: 8,
		maxHeight: 120,
	},
	cartItemRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 8,
		borderRadius: 8,
		marginBottom: 8,
	},
	cartItemTextContent: {
		flex: 1,
		marginRight: 8,
	},
	cartItemTitle: {
		fontSize: 14,
		fontWeight: "500",
	},
	cartItemSub: {
		fontSize: 12,
		marginTop: 2,
	},
	cartItemRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	cartItemAmount: {
		fontSize: 14,
		fontWeight: "700",
		fontFamily: "monospace",
	},
	removeBtn: {
		padding: 4,
	},
	actionRow: {
		flexDirection: "row",
		gap: 12,
		width: "100%",
		maxWidth: 400,
	},
	addBtn: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 14,
		borderRadius: 16,
		borderWidth: 2,
		gap: 8,
	},
	addBtnIcon: {
		fontSize: 20,
		fontWeight: "700",
	},
	addBtnText: {
		fontSize: 16,
		fontWeight: "700",
	},
	proceedBtn: {
		flex: 2,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 24,
		paddingVertical: 14,
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

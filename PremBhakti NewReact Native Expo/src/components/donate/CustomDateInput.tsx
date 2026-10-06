import React, { useState, useRef, useMemo, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";

interface Option {
	value: string;
	label: string;
}

interface CustomSelectProps {
	value: string;
	onChange: (val: string) => void;
	options: Option[];
	placeholder: string;
	disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder, disabled }) => {
	const theme = useAppTheme();
	const [isOpen, setIsOpen] = useState(false);

	const selectedOption = options.find((o) => o.value === value);

	return (
		<View style={{ flex: 1 }}>
			<TouchableOpacity
				activeOpacity={0.7}
				disabled={disabled}
				onPress={() => setIsOpen(true)}
				style={[
					styles.selectButton,
					{ backgroundColor: theme.surface, borderColor: theme.border },
					disabled && { opacity: 0.6 },
				]}
			>
				<Text style={[styles.selectText, { color: selectedOption ? theme.text : theme.isDark ? "#94a3b8" : "#94a3b8" }]} numberOfLines={1}>
					{selectedOption ? selectedOption.label : placeholder}
				</Text>
				<ChevronDown size={14} color={theme.isDark ? "#94a3b8" : "#94a3b8"} />
			</TouchableOpacity>

			<Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
				<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsOpen(false)}>
					<View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						<ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
							{options.map((opt) => (
								<TouchableOpacity
									key={opt.value}
									style={[
										styles.optionRow,
										value === opt.value && { backgroundColor: theme.isDark ? "rgba(236, 72, 153, 0.1)" : "#fdf2f8" },
									]}
									onPress={() => {
										onChange(opt.value);
										setIsOpen(false);
									}}
								>
									<Text
										style={[
											styles.optionText,
											{ color: value === opt.value ? (theme.isDark ? "#f472b6" : "#db2777") : theme.text },
											value === opt.value && { fontWeight: "500" }
										]}
									>
										{opt.label}
									</Text>
									{value === opt.value && <Check size={16} color={theme.isDark ? "#f472b6" : "#db2777"} />}
								</TouchableOpacity>
							))}
						</ScrollView>
					</View>
				</TouchableOpacity>
			</Modal>
		</View>
	);
};

interface CustomDateInputProps {
	value: string; // Expected format: YYYY-MM-DD
	onChange: (val: string) => void;
	disabled?: boolean;
	isHindi?: boolean;
}

export const CustomDateInput: React.FC<CustomDateInputProps> = ({ value, onChange, disabled, isHindi }) => {
	const parts = value ? value.split("-") : [];
	const year = parts[0] || "";
	const month = parts[1] || "";
	const day = parts[2] || "";

	const updateDate = React.useCallback(
		(d: string, m: string, y: string) => {
			if (!d && !m && !y) {
				onChange("");
				return;
			}
			const safeD = d || "01";
			const safeM = m || "01";
			const safeY = y || new Date().getFullYear().toString();
			onChange(`${safeY}-${safeM}-${safeD}`);
		},
		[onChange],
	);

	const numDays = useMemo(() => {
		if (month && year) {
			return new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
		}
		if (month) {
			return new Date(2024, parseInt(month, 10), 0).getDate();
		}
		return 31;
	}, [month, year]);

	useEffect(() => {
		if (day && parseInt(day, 10) > numDays) {
			updateDate(String(numDays).padStart(2, "0"), month, year);
		}
	}, [numDays, day, month, year, updateDate]);

	const dayOptions: Option[] = Array.from({ length: numDays }, (_, i) => {
		const val = String(i + 1).padStart(2, "0");
		return { value: val, label: val };
	});

	const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const monthNamesHi = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

	const monthOptions: Option[] = Array.from({ length: 12 }, (_, i) => {
		const val = String(i + 1).padStart(2, "0");
		const label = isHindi ? monthNamesHi[i] : monthNamesEn[i];
		return { value: val, label: label };
	});

	const currentYear = new Date().getFullYear();
	const yearOptions: Option[] = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => {
		const val = String(currentYear - i);
		return { value: val, label: val };
	});

	return (
		<View style={styles.container}>
			<CustomSelect value={day} onChange={(val) => updateDate(val, month, year)} options={dayOptions} placeholder={isHindi ? "दिन" : "Day"} disabled={disabled} />
			<CustomSelect value={month} onChange={(val) => updateDate(day, val, year)} options={monthOptions} placeholder={isHindi ? "महीना" : "Month"} disabled={disabled} />
			<CustomSelect value={year} onChange={(val) => updateDate(day, month, val)} options={yearOptions} placeholder={isHindi ? "साल" : "Year"} disabled={disabled} />
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		gap: 8,
		width: "100%",
	},
	selectButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderWidth: 1,
		borderRadius: 16,
		paddingHorizontal: 12,
		paddingVertical: 14,
	},
	selectText: {
		fontSize: 13,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.3)",
		justifyContent: "center",
		alignItems: "center",
	},
	modalContent: {
		width: 250,
		borderWidth: 1,
		borderRadius: 16,
		overflow: "hidden",
	},
	optionRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	optionText: {
		fontSize: 14,
	}
});

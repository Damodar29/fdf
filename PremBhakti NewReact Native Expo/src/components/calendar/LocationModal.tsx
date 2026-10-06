import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";
import { useSettingsStore } from "../../store/settingsStore";
import { LOCATIONS } from "../../lib/gaurabda";

interface LocationModalProps {
	visible: boolean;
	currentLocation: typeof LOCATIONS[0];
	onSelect: (loc: typeof LOCATIONS[0]) => void;
	onClose: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
	visible,
	currentLocation,
	onSelect,
	onClose,
}) => {
	const theme = useAppTheme();
	const isHindi = useSettingsStore((s) => s.settingsLanguage) === "hi";

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: theme.scrim, justifyContent: "flex-end" }}>
				<Pressable style={{ flex: 1 }} onPress={onClose} />
				<View
					style={{
						backgroundColor: theme.raised,
						borderTopLeftRadius: 24,
						borderTopRightRadius: 24,
						maxHeight: "80%",
						padding: 24,
					}}
				>
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
						<Text style={{ color: theme.text, fontSize: 20, fontWeight: "bold" }}>
							{isHindi ? "स्थान चुनें" : "Select Location"}
						</Text>
						<Pressable
							onPress={onClose}
							style={{
								padding: 8,
								backgroundColor: theme.sunken,
								borderRadius: 20,
							}}
						>
							<X size={20} color={theme.text} />
						</Pressable>
					</View>
					
					<ScrollView showsVerticalScrollIndicator={false}>
						{LOCATIONS.map((loc, idx) => {
							const isSelected = loc.name === currentLocation.name;
							return (
								<Pressable
									key={idx}
									onPress={() => {
										onSelect(loc);
										onClose();
									}}
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										paddingVertical: 16,
										borderBottomWidth: idx < LOCATIONS.length - 1 ? 1 : 0,
										borderBottomColor: theme.divider,
									}}
								>
									<Text
										style={{
											color: isSelected ? theme.primary : theme.text,
											fontSize: 16,
											fontWeight: isSelected ? "bold" : "normal",
										}}
									>
										{loc.name}
									</Text>
									{isSelected && <Check size={20} color={theme.primary} />}
								</Pressable>
							);
						})}
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
};

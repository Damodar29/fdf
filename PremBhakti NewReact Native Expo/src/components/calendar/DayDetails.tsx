import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import { calculateGaurabdaDetails } from "../../lib/gaurabda";
import { useAppTheme } from "../../theme/useAppTheme";

interface DayDetailsProps {
	date: Date;
	location: { lat: number; lng: number; name: string };
	isHindi: boolean;
	onOpenLocationModal: () => void;
	t: Record<string, string>;
	translatePanchang: (text: string, type?: "masa" | "naksatra") => string;
}

export const DayDetails: React.FC<DayDetailsProps> = ({
	date,
	location,
	isHindi,
	onOpenLocationModal,
	t,
	translatePanchang,
}) => {
	const theme = useAppTheme();
	const details = useMemo(() => calculateGaurabdaDetails(date, location.lat, location.lng), [date, location]);

	const translateTime = (timeStr: string) => {
		if (!isHindi || !timeStr) return timeStr;
		return timeStr.replace("AM", "पूर्वाह्न").replace("PM", "अपराह्न");
	};

	const Row = ({ label, value, subValue }: { label: string; value: string; subValue?: string }) => (
		<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
			<Text style={{ color: theme.textMuted, fontWeight: "bold", fontSize: 13, flex: 1 }}>{label}:</Text>
			<View style={{ flex: 1.5, flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
				<Text style={{ color: theme.text, fontWeight: "500", fontSize: 13, textAlign: "right" }}>{value}</Text>
				{subValue ? (
					<Text style={{ color: theme.textMuted, fontSize: 11, marginLeft: 4 }}>({subValue})</Text>
				) : null}
			</View>
		</View>
	);

	return (
		<View
			style={{
				marginTop: 16,
				padding: 16,
				backgroundColor: theme.sunken,
				borderRadius: 12,
				borderWidth: 1,
				borderColor: theme.border,
			}}
		>
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.divider }}>
				<Text style={{ fontWeight: "bold", color: theme.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
					{isHindi ? "स्थान" : "Location"}
				</Text>
				<Pressable
					onPress={onOpenLocationModal}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 6,
						backgroundColor: theme.raised,
						paddingHorizontal: 12,
						paddingVertical: 6,
						borderRadius: 16,
						borderWidth: 1,
						borderColor: theme.border,
					}}
				>
					<MapPin size={12} color={theme.accent} />
					<Text style={{ fontSize: 12, fontWeight: "bold", color: theme.text }}>
						{location.name.split(",")[0]}
					</Text>
				</Pressable>
			</View>

			<View style={{ flexDirection: "row", flexWrap: "wrap" }}>
				<View style={{ width: "100%", paddingRight: 8 }}>
					<Row label={t.tithi} value={translatePanchang(details.tithi.name)} subValue={translateTime(details.tithi.endTime)} />
					<Row label={t.masa} value={translatePanchang(details.masa, "masa")} />
					<Row label={t.gaurabdaYear} value={String(details.gaurabdaYear)} />
					<Row label={t.masaGaudiya} value={translatePanchang(details.masaGaudiya)} />
					<Row label={t.paksa} value={translatePanchang(details.paksa)} />
					<Row label={t.naksatra} value={translatePanchang(details.naksatra.name, "naksatra")} subValue={translateTime(details.naksatra.endTime)} />
					<Row label={t.yoga} value={translatePanchang(details.yoga.name)} subValue={translateTime(details.yoga.endTime)} />
					
					{details.brahmaMuhurta ? (
						<Row label={t.brahmaMuhurta} value={translateTime(details.brahmaMuhurta)} />
					) : null}
					
					<Row label={t.sunrise} value={translateTime(details.sunrise)} />
					<Row label={t.noon} value={translateTime(details.noon)} />
					<Row label={t.sunset} value={translateTime(details.sunset)} />
				</View>
			</View>
		</View>
	);
};

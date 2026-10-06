import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Linking, ActivityIndicator } from "react-native";
import { ChevronDown, ChevronLeft, Clock, MessageCircle, Navigation, Phone } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, getDocs, getFirestore } from "@react-native-firebase/firestore";
import { useHomeDataStore } from "../store/homeDataStore";
import { useSettingsStore } from "../store/settingsStore";
import { webGet, webSet } from "../lib/webStore";
import { useAppTheme } from "../theme/useAppTheme";
import { ink, janmashtami, krishna } from "../theme/colors";

export interface TempleTiming {
	id: string;
	order: number;
	eventName: string;
	time: string;
}

interface TempleTimingsScreenProps {
	onBack: () => void;
	initialMandalId?: string;
}

const TEMPLE_DETAILS: Record<
	string,
	{
		shortNameHi: string;
		shortNameEn: string;
		nameHi: string;
		nameEn: string;
		addressHi: string;
		addressEn: string;
		phone: string;
		locationUrl?: string;
		isWhatsappLocation?: boolean;
		locationPhone?: string;
	}
> = {
	kota: {
		shortNameHi: "कोटा",
		shortNameEn: "Kota",
		nameHi: "चैतन्य प्रेम भक्ति धाम, कोटा",
		nameEn: "Chaitanya Prem Bhakti Dham, Kota",
		addressHi: "प्रेम भक्ति धाम, कोटा",
		addressEn: "Prem Bhakti Dham, Kota",
		phone: "9636943046, 9828235583",
		locationUrl: "https://maps.app.goo.gl/qFPr5dTKrK8MrGg6A",
	},
	harrai: {
		shortNameHi: "हर्रई",
		shortNameEn: "Harrai",
		nameHi: "गौर राधा गोपीनाथ जी, हर्रई",
		nameEn: "Gour Radha Gopinath Ji, Harrai",
		addressHi: "गौर राधा गोपीनाथ जी, हर्रई",
		addressEn: "Gour Radha Gopinath Ji, Harrai",
		phone: "9424324565, 6260583949",
		locationUrl: "https://maps.app.goo.gl/NpX8xg8m5M7UbwMfA",
	},
	sagar: {
		shortNameHi: "सागर",
		shortNameEn: "Sagar",
		nameHi: "गुरुधाम, सागर",
		nameEn: "Gurudham, Sagar",
		addressHi: "गुरुधाम, सागर",
		addressEn: "Gurudham, Sagar",
		phone: "8839123276",
		locationUrl: "https://maps.app.goo.gl/gaPkLkDFvxoLvGRA6",
	},
	damoh: {
		shortNameHi: "दमोह",
		shortNameEn: "Damoh",
		nameHi: "गौर राधा रमन जी, दमोह",
		nameEn: "Gaur Radha Raman Ji, Damoh",
		addressHi: "गौर राधा रमन जी, दमोह",
		addressEn: "Gaur Radha Raman Ji, Damoh",
		phone: "9407542046, 8770665363",
		locationUrl: "https://maps.app.goo.gl/bBHqbcv8zYz1TBpy8",
	},
	khurai: {
		shortNameHi: "खुरई",
		shortNameEn: "Khurai",
		nameHi: "गौर राधा ब्रजमोहन जी, खुरई",
		nameEn: "Gaur Radha Brajmohan Ji, Khurai",
		addressHi: "गौर राधा ब्रजमोहन जी, खुरई",
		addressEn: "Gaur Radha Brajmohan Ji, Khurai",
		phone: "9926927164",
		locationUrl: "https://maps.app.goo.gl/CtPXT5BrRcjGMawE6",
	},
	bhopal: {
		shortNameHi: "भोपाल",
		shortNameEn: "Bhopal",
		nameHi: "भोपाल",
		nameEn: "Bhopal",
		addressHi: "कम्फर्ट पार्क, भोपाल",
		addressEn: "Comfort Park, Bhopal",
		phone: "9406523141",
		locationUrl: "https://maps.app.goo.gl/P2UjL51YCuVBHUE28",
	},
	semra: {
		shortNameHi: "सेमरा",
		shortNameEn: "Semra",
		nameHi: "सेमरा",
		nameEn: "Semra",
		addressHi: "सेमरा",
		addressEn: "Semra",
		phone: "",
		locationUrl: "",
	},
	gaisabaad: {
		shortNameHi: "गैसाबाद",
		shortNameEn: "Gaisabaad",
		nameHi: "गैसाबाद",
		nameEn: "Gaisabaad",
		addressHi: "गैसाबाद",
		addressEn: "Gaisabaad",
		phone: "",
		locationUrl: "",
	},
	bharatpur: {
		shortNameHi: "भरतपुर",
		shortNameEn: "Bharatpur",
		nameHi: "भरतपुर",
		nameEn: "Bharatpur",
		addressHi: "भरतपुर",
		addressEn: "Bharatpur",
		phone: "",
		locationUrl: "",
	},
	indore: {
		shortNameHi: "इंदौर",
		shortNameEn: "Indore",
		nameHi: "इंदौर",
		nameEn: "Indore",
		addressHi: "इंदौर",
		addressEn: "Indore",
		phone: "",
		locationUrl: "",
	},
};

export const TempleTimingsScreen: React.FC<TempleTimingsScreenProps> = ({
	onBack,
	initialMandalId,
}) => {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const settingsLanguage = useSettingsStore((s) => s.settingsLanguage);
	const sharedMandals = useHomeDataStore((s) => s.mandals);

	const [selectedMandalId, setSelectedMandalId] = useState<string>(() => {
		if (initialMandalId) return initialMandalId;
		const saved = webGet("preferred_temple");
		return saved || "kota";
	});
	const [timings, setTimings] = useState<TempleTiming[]>([]);
	const [loading, setLoading] = useState(true);
	const [allowedMandals, setAllowedMandals] = useState<string[]>([]);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const details = TEMPLE_DETAILS[selectedMandalId];

	useEffect(() => {
		const fetchAllowedMandals = async () => {
			try {
				const snapshot = await getDocs(collection(getFirestore(), "admin_roles"));
				const allowed = new Set<string>();
				snapshot.docs.forEach((doc) => {
					const data = doc.data();
					if (
						data.role === "mandal" &&
						data.mandalId &&
						data.permissions?.includes("timings")
					) {
						allowed.add(data.mandalId);
					}
				});
				if (allowed.size > 0) {
					const arr = Array.from(allowed);
					setAllowedMandals(arr);
					if (!allowed.has(selectedMandalId)) {
						setSelectedMandalId(arr[0]);
					}
				}
			} catch (error) {
				console.error("Error fetching allowed mandals:", error);
			}
		};
		fetchAllowedMandals();
	}, [selectedMandalId]);

	useEffect(() => {
		webSet("preferred_temple", selectedMandalId);

		if (!sharedMandals || sharedMandals.length === 0) {
			setLoading(true);
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mandalData = sharedMandals.find((m: any) => m.id === selectedMandalId);
		if (mandalData?.templeTimings) {
			const sorted = [...mandalData.templeTimings].sort(
				(a: TempleTiming, b: TempleTiming) => a.order - b.order,
			);
			setTimings(sorted);
		} else {
			setTimings([]);
		}
		setLoading(false);
	}, [selectedMandalId, sharedMandals]);

	const [nextEvent, setNextEvent] = useState<{
		name: string;
		minutesDiff: number;
	} | null>(null);

	useEffect(() => {
		const calculateNextEvent = () => {
			if (timings.length === 0) {
				setNextEvent(null);
				return;
			}

			const now = new Date();
			const currentHours = now.getHours();
			const currentMinutes = now.getMinutes();
			const currentTimeInMins = currentHours * 60 + currentMinutes;

			let upcomingEvent = null;
			let minDiff = Infinity;

			for (const timing of timings) {
				const [timePart, modifier] = timing.time.split(" ");
				if (!timePart || !modifier) continue;
				const [hoursStr, minutesStr] = timePart.split(":");
				let hours = parseInt(hoursStr, 10);
				const minutes = parseInt(minutesStr, 10);

				if (modifier.toLowerCase() === "pm" && hours < 12) hours += 12;
				if (modifier.toLowerCase() === "am" && hours === 12) hours = 0;

				const eventTimeInMins = hours * 60 + minutes;
				const diff = eventTimeInMins - currentTimeInMins;

				if (diff > 0 && diff <= 30 && diff < minDiff) {
					minDiff = diff;
					upcomingEvent = { name: timing.eventName, minutesDiff: diff };
				}
			}

			setNextEvent(upcomingEvent);
		};

		calculateNextEvent();
		const interval = setInterval(calculateNextEvent, 60000);
		return () => clearInterval(interval);
	}, [timings]);

	return (
		<View style={{ flex: 1, backgroundColor: theme.page }}>
			<View
				style={{
					paddingTop: insets.top,
					backgroundColor: theme.isDark ? ink[950] : janmashtami.krishnaBlue,
					borderBottomWidth: 2,
					borderBottomColor: janmashtami.borderGold,
					elevation: 2,
					zIndex: 10,
				}}
			>
				<View style={{ flexDirection: "row", alignItems: "center", height: 64, paddingHorizontal: 16 }}>
					<TouchableOpacity
						onPress={onBack}
						style={{
							padding: 8,
							marginLeft: -8,
							borderRadius: 24,
						}}
					>
						<ChevronLeft size={24} color={janmashtami.gold} />
					</TouchableOpacity>
					<Text style={{ fontSize: 18, fontWeight: "600", color: janmashtami.gold, marginLeft: 8 }}>
						Temple Timings
					</Text>
				</View>
			</View>

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
			>
				<View style={{ marginBottom: 24, zIndex: 50 }}>
					<Text style={{ fontSize: 14, fontWeight: "500", color: theme.isDark ? ink[300] : ink[700], marginBottom: 8 }}>
						Select Temple
					</Text>
					
					<TouchableOpacity
						onPress={() => setIsDropdownOpen(!isDropdownOpen)}
						activeOpacity={0.8}
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "center",
							backgroundColor: theme.card,
							borderWidth: 1,
							borderColor: theme.isDark ? ink[700] : ink[200],
							borderRadius: 12,
							padding: 12,
						}}
					>
						<Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
							{allowedMandals.includes(selectedMandalId) && TEMPLE_DETAILS[selectedMandalId]
								? settingsLanguage === "hi"
									? TEMPLE_DETAILS[selectedMandalId].shortNameHi
									: TEMPLE_DETAILS[selectedMandalId].shortNameEn
								: "Select Temple"}
						</Text>
						<View style={{ transform: [{ rotate: isDropdownOpen ? "180deg" : "0deg" }] }}>
							<ChevronDown size={18} color={theme.isDark ? ink[300] : ink[500]} />
						</View>
					</TouchableOpacity>

					{isDropdownOpen && (
						<View
							style={{
								position: "absolute",
								top: 76,
								left: 0,
								right: 0,
								backgroundColor: theme.card,
								borderWidth: 1,
								borderColor: theme.isDark ? ink[700] : ink[200],
								borderRadius: 12,
								maxHeight: 240,
								zIndex: 100,
								elevation: 5,
								shadowColor: "#000",
								shadowOffset: { width: 0, height: 4 },
								shadowOpacity: 0.1,
								shadowRadius: 12,
							}}
						>
							<ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
								{allowedMandals.map((id, index) => {
									const detail = TEMPLE_DETAILS[id];
									if (!detail) return null;
									const isSelected = selectedMandalId === id;
									return (
										<TouchableOpacity
											key={id}
											onPress={() => {
												setSelectedMandalId(id);
												setIsDropdownOpen(false);
											}}
											style={{
												paddingHorizontal: 16,
												paddingVertical: 12,
												borderBottomWidth: index === allowedMandals.length - 1 ? 0 : 1,
												borderBottomColor: theme.isDark ? "rgba(51, 65, 85, 0.5)" : ink[100],
												backgroundColor: isSelected
													? (theme.isDark ? "rgba(49, 46, 129, 0.4)" : krishna[50])
													: "transparent",
											}}
										>
											<Text
												style={{
													fontSize: 14,
													fontWeight: "700",
													color: isSelected
														? (theme.isDark ? krishna[400] : krishna[600])
														: theme.text,
												}}
											>
												{settingsLanguage === "hi" ? detail.shortNameHi : detail.shortNameEn}
											</Text>
										</TouchableOpacity>
									);
								})}
							</ScrollView>
						</View>
					)}
				</View>

				{details && (
					<View
						style={{
							backgroundColor: theme.card,
							borderRadius: 16,
							padding: 24,
							borderWidth: 1,
							borderColor: theme.isDark ? ink[700] : ink[200],
							marginBottom: 24,
							zIndex: 1,
						}}
					>
						<Text style={{ fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 8 }}>
							{settingsLanguage === "hi" ? details.nameHi : details.nameEn}
						</Text>
						<Text style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 16 }}>
							{settingsLanguage === "hi" ? details.addressHi : details.addressEn}
						</Text>

						<View style={{ gap: 12 }}>
							{!!details.phone && (
								<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
									<Phone size={18} color={krishna[500]} />
									<Text style={{ color: theme.isDark ? ink[300] : ink[600] }}>{details.phone}</Text>
								</View>
							)}

							{!!details.locationUrl && (
								<TouchableOpacity
									onPress={() => {
										if (details.isWhatsappLocation && details.locationPhone) {
											const message = encodeURIComponent("Hare Krishna! Please share the temple location.");
											Linking.openURL(`https://wa.me/91${details.locationPhone}?text=${message}`).catch(() => {});
										} else {
											Linking.openURL(details.locationUrl!).catch(() => {});
										}
									}}
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "center",
										gap: 8,
										marginTop: 16,
										paddingHorizontal: 16,
										paddingVertical: 12,
										borderRadius: 12,
										backgroundColor: theme.isDark ? ink[700] : janmashtami.cream,
										borderWidth: 1,
										borderColor: theme.isDark ? ink[600] : janmashtami.borderGold,
									}}
								>
									{details.isWhatsappLocation ? (
										<MessageCircle size={18} color={theme.isDark ? janmashtami.gold : janmashtami.krishnaBlue} />
									) : (
										<Navigation size={18} color={theme.isDark ? janmashtami.gold : janmashtami.krishnaBlue} />
									)}
									<Text style={{ fontSize: 14, fontWeight: "700", color: theme.isDark ? janmashtami.gold : janmashtami.krishnaBlue }}>
										{details.isWhatsappLocation
											? settingsLanguage === "hi"
												? "लोकेशन पूछें"
												: "Ask Location"
											: settingsLanguage === "hi"
												? "दिशा-निर्देश प्राप्त करें"
												: "Get Directions"}
									</Text>
								</TouchableOpacity>
							)}
						</View>
					</View>
				)}

				<View
					style={{
						backgroundColor: theme.card,
						borderRadius: 16,
						padding: 24,
						borderWidth: 1,
						borderColor: theme.isDark ? ink[700] : ink[200],
						zIndex: 1,
					}}
				>
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Clock size={20} color={krishna[500]} />
							<Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>
								Daily Schedule
							</Text>
						</View>
						
						{nextEvent && (
							<View
								style={{
									backgroundColor: theme.isDark ? "rgba(49, 46, 129, 0.4)" : krishna[100],
									paddingHorizontal: 12,
									paddingVertical: 4,
									borderRadius: 9999,
								}}
							>
								<Text style={{ fontSize: 12, fontWeight: "700", color: theme.isDark ? krishna[300] : krishna[700] }}>
									{nextEvent.name} in {nextEvent.minutesDiff} min
								</Text>
							</View>
						)}
					</View>

					{loading ? (
						<View style={{ paddingVertical: 32, alignItems: "center" }}>
							<ActivityIndicator size="large" color={krishna[600]} />
						</View>
					) : timings.length > 0 ? (
						<View style={{ gap: 16 }}>
							{timings.map((timing, index) => (
								<View
									key={timing.id}
									style={{
										flexDirection: "row",
										justifyContent: "space-between",
										alignItems: "center",
										paddingBottom: 12,
										borderBottomWidth: index === timings.length - 1 ? 0 : 1,
										borderBottomColor: theme.isDark ? ink[700] : ink[100],
									}}
								>
									<Text style={{ fontWeight: "500", color: theme.isDark ? ink[200] : ink[700] }}>
										{timing.eventName}
									</Text>
									<View
										style={{
											backgroundColor: theme.isDark ? "rgba(49, 46, 129, 0.3)" : krishna[50],
											paddingHorizontal: 12,
											paddingVertical: 4,
											borderRadius: 8,
										}}
									>
										<Text style={{ fontWeight: "600", color: theme.isDark ? krishna[400] : krishna[600] }}>
											{timing.time}
										</Text>
									</View>
								</View>
							))}
						</View>
					) : (
						<View style={{ paddingVertical: 32, alignItems: "center" }}>
							<Text style={{ color: theme.textSecondary }}>
								No timings available for this temple yet.
							</Text>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
};

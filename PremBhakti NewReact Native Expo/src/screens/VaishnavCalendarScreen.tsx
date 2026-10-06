import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeft, ArrowRight, LayoutGrid, List } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { hi, enUS } from "date-fns/locale";

import { useAppTheme } from "../theme/useAppTheme";
import { useSettingsStore } from "../store/settingsStore";
import { useHomeDataStore } from "../store/homeDataStore";
import { BACKUP_SETTINGS_KEYS, webGet, webSet, useWebStoreVersion } from "../lib/webStore";
import { LOCATIONS } from "../lib/gaurabda";
import { EventCard } from "../components/calendar/EventCard";
import { DayDetails } from "../components/calendar/DayDetails";
import { LocationModal } from "../components/calendar/LocationModal";
import type { EventData } from "../types";
import { status } from "../theme/colors";

interface VaishnavCalendarScreenProps {
	onBack?: () => void;
	navigation: { goBack: () => void };
}

export const VaishnavCalendarScreen: React.FC<VaishnavCalendarScreenProps> = ({ navigation, onBack }) => {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const isHindi = useSettingsStore((s) => s.settingsLanguage) === "hi";
	const currentLocale = isHindi ? hi : enUS;

	const events = useHomeDataStore((s) => s.events);

	const [currentMonth, setCurrentMonth] = useState(new Date());
	const [selectedDate, setSelectedDate] = useState(new Date());

	// webStore version triggers re-render when MMKV changes
	useWebStoreVersion();
	const viewModeStr = webGet(BACKUP_SETTINGS_KEYS.eventsViewMode) || "grid";
	const viewMode = viewModeStr === "list" ? "list" : "grid";

	const setViewMode = (mode: "grid" | "list") => {
		webSet(BACKUP_SETTINGS_KEYS.eventsViewMode, mode);
	};

	const [expandedDate, setExpandedDate] = useState<string | null>(null);
	const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

	const panchangLocStr = webGet(BACKUP_SETTINGS_KEYS.panchangLocation);
	const location = useMemo(() => {
		if (panchangLocStr) {
			try {
				return JSON.parse(panchangLocStr);
			} catch (e) {
				console.error("Failed to parse saved location", e);
			}
		}
		return LOCATIONS[11]; // Mayapur
	}, [panchangLocStr]);

	const handleSelectLocation = (loc: typeof LOCATIONS[0]) => {
		webSet(BACKUP_SETTINGS_KEYS.panchangLocation, JSON.stringify(loc));
	};

	const monthStart = startOfMonth(currentMonth);
	const monthEnd = endOfMonth(currentMonth);
	const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
	const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
	const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

	const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
	const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
	const jumpToToday = () => {
		const now = new Date();
		setCurrentMonth(now);
		setSelectedDate(now);
		setExpandedDate(startOfDay(now).toISOString());
	};

	const parseLocalDate = (dateStr: string) => {
		if (!dateStr) return new Date();
		const [year, month, day] = dateStr.split("-");
		return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
	};

	const getEventsForDay = (date: Date) => {
		const dayEvents = events.filter((e) => isSameDay(parseLocalDate(e.date), date));
		return dayEvents.sort((a, b) => {
			if (a.type === "festival" && b.type !== "festival") return -1;
			if (a.type !== "festival" && b.type === "festival") return 1;
			if (a.isEkadashi) return -1;
			if (b.isEkadashi) return 1;
			return 0;
		});
	};

	const getUpcomingDays = () => {
		const days = [];
		let count = 0;
		let iterDate = addDays(selectedDate, 1);
		let safety = 0;
		while (count < 5 && safety < 60) {
			const dayEvents = getEventsForDay(iterDate);
			if (dayEvents.length > 0) {
				days.push({ date: iterDate, events: dayEvents });
				count++;
			}
			iterDate = addDays(iterDate, 1);
			safety++;
		}
		return days;
	};

	const selectedDayEvents = getEventsForDay(selectedDate);
	const upcomingDays = getUpcomingDays();

	const t = {
		title: isHindi ? "वैष्णव कैलेंडर" : "Vaishnav Calendar",
		today: isHindi ? "आज" : "Today",
		ekadashiFast: isHindi ? "एकादशी व्रत" : "Ekadashi Fast",
		fastDesc: isHindi ? "अनाज से उपवास।" : "Fast from grains.",
		eventsOnDay: isHindi ? "इस दिन के इवेंट" : "Events on this day",
		noEvents: isHindi ? "कोई इवेंट नहीं" : "No events listed",
		upcoming: isHindi ? "आगामी इवेंट" : "Upcoming Next",
		viewGrid: isHindi ? "कैलेंडर" : "Grid",
		viewList: isHindi ? "लिस्ट" : "List",
		panchangDetails: isHindi ? "पंचांग विवरण" : "Panchang Details",
		tithi: isHindi ? "तिथि" : "Tithi",
		masa: isHindi ? "मास" : "Masa",
		gaurabdaYear: isHindi ? "गौराब्द वर्ष" : "Gaurabda Year",
		masaGaudiya: isHindi ? "मास (गौड़ीय)" : "Masa (Gaudiya)",
		paksa: isHindi ? "पक्ष" : "Paksa",
		naksatra: isHindi ? "नक्षत्र" : "Naksatra",
		yoga: isHindi ? "योग" : "Yoga",
		brahmaMuhurta: isHindi ? "ब्रह्म मुहूर्त" : "Brahma Muhurta",
		sunrise: isHindi ? "सूर्योदय" : "Sunrise",
		noon: isHindi ? "दोपहर" : "Noon",
		sunset: isHindi ? "सूर्यास्त" : "Sunset",
		legendEvent: isHindi ? "इवेंट" : "Event",
		legendFestival: isHindi ? "त्यौहार" : "Festival",
		legendEkadashi: isHindi ? "एकादशी" : "Ekadashi",
		legendMultiple: isHindi ? "अनेक" : "Multiple",
		legendSelected: isHindi ? "चयनित" : "Selected",
		eventTime: isHindi ? "इवेंट का समय" : "Event Time",
		breakTime: isHindi ? "पारण का समय" : "Break Time",
	};

	const getEventTitle = (event: EventData) => {
		if (isHindi && event.titleHi) return event.titleHi;
		return event.title;
	};

	const getEventType = (type?: string) => {
		if (!isHindi || !type) return type || "";
		const lower = type.toLowerCase();
		switch (lower) {
			case "ekadashi": return "एकादशी";
			case "festival": return "त्यौहार";
			case "appearance": return "आविर्भाव";
			case "disappearance": return "तिरोभाव";
			case "other": return "अन्य";
			default: return type;
		}
	};

	const panchangTranslations: Record<string, string> = {
		Pratipat: "प्रतिपत्", Dvitiya: "द्वितीया", Tritiya: "तृतीया", Chaturthi: "चतुर्थी", Panchami: "पंचमी", Shasti: "षष्टी", Saptami: "सप्तमी", Ashtami: "अष्टमी", Navami: "नवमी", Dashami: "दशमी", Ekadashi: "एकादशी", Dvadashi: "द्वादशी", Trayodashi: "त्रयोदशी", Chaturdashi: "चतुर्दशी", Purnima: "पूर्णिमा", Amavasya: "अमावस्या",
		Ashvini: "अश्विनी", Bharani: "भरणी", Krittika: "कृत्तिका", Rohini: "रोहिणी", Mrigashirsha: "मृगशिरा", Ardra: "आर्द्रा", Punarvasu: "पुनर्वसु", Pushya: "पुष्य", Ashlesha: "आश्लेषा", Magha: "मघा", "Purva Phalguni": "पूर्वा फाल्गुनी", "Uttara Phalguni": "उत्तरा फाल्गुनी", Hasta: "हस्त", Chitra: "चित्रा", Swati: "स्वाती", Vishakha: "विशाखा", Anuradha: "अनुराधा", Jyeshtha: "ज्येष्ठा", Mula: "मूल", "Purva Ashadha": "पूर्वाषाढ़ा", "Uttara Ashadha": "उत्तराषाढ़ा", Shravana: "श्रवण", Dhanishta: "धनिष्ठा", Shatabhisha: "शतभिषा", "Purva Bhadrapada": "पूर्वा भाद्रपद", "Uttara Bhadrapada": "उत्तरा भाद्रपद", Revati: "रेवती",
		Vishkumbha: "विष्कुम्भ", Priti: "प्रीति", Ayushman: "आयुष्मान", Saubhagya: "सौभाग्य", Shobhana: "शोभन", Atiganda: "अतिगण्ड", Sukarma: "सुकर्मा", Dhriti: "धृति", Shula: "शूल", Ganda: "गण्ड", Vriddhi: "वृद्धि", Dhruva: "ध्रुव", Vyaghata: "व्याघात", Harshana: "हर्षण", Vajra: "वज्र", Siddhi: "सिद्धि", Vyatipata: "व्यतीपात", Variyan: "वरीयान्", Parigha: "परिघ", Shiva: "शिव", Siddha: "सिद्ध", Sadhya: "साध्य", Shubha: "शुभ", Shukla: "शुक्ल", Brahma: "ब्रह्म", Indra: "इन्द्र", Vaidhriti: "वैधृति",
		Caitra: "चैत्र", Vaisakha: "वैशाख", Ashadha: "आषाढ़", Bhadrapada: "भाद्रपद", Ashvina: "अश्विन", Kartika: "कार्तिक", Margashirsha: "मार्गशीर्ष", Pausha: "पौष", Phalguna: "फाल्गुन",
		Visnu: "विष्णु", Madhusudana: "मधुसूदन", Trivikrama: "त्रिविक्रम", Vamana: "वामन", Sridhara: "श्रीधर", Hrishikesha: "हृषीकेश", Padmanabha: "पद्मनाभ", Damodara: "दामोदर", Kesava: "केशव", Narayana: "नारायण", Madhava: "माधव", Govinda: "गोविन्द", Purusottama: "पुरुषोत्तम",
		"Gaura (Shukla)": "गौर (शुक्ल)", Krishna: "कृष्ण",
	};

	const translatePanchang = (text: string, type?: "masa" | "naksatra") => {
		if (!isHindi) return text;
		let base = text;
		let isAdhika = false;
		if (text.startsWith("Adhika ")) {
			base = text.replace("Adhika ", "");
			isAdhika = true;
		}
		let translated = panchangTranslations[base] || base;
		if (translated.includes("/")) {
			const parts = translated.split("/");
			if (type === "masa") translated = parts[1];
			else if (type === "naksatra") translated = parts[0];
			else translated = parts[0];
		}
		return isAdhika ? `अधिक ${translated}` : translated;
	};

	const handleBack = () => {
		if (onBack) onBack();
		else navigation.goBack();
	};

	const weekDays = useMemo(() => {
		const days = [];
		const start = startOfWeek(new Date(), { weekStartsOn: 1 });
		for (let i = 0; i < 7; i++) {
			days.push(format(addDays(start, i), "EEE", { locale: currentLocale }));
		}
		return days;
	}, [currentLocale]);

	return (
		<View style={{ flex: 1, backgroundColor: theme.page, paddingTop: insets.top }}>
			<View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
				<Pressable onPress={handleBack} style={{ padding: 8, marginRight: 8, borderRadius: 20, backgroundColor: theme.sunken }}>
					<ArrowLeft size={24} color={theme.text} />
				</Pressable>
				<Text style={{ fontSize: 20, fontWeight: "bold", color: theme.text, flex: 1 }}>{t.title}</Text>
				<View style={{ flexDirection: "row", backgroundColor: theme.sunken, borderRadius: 8, padding: 4 }}>
					<Pressable
						onPress={() => setViewMode("grid")}
						style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: viewMode === "grid" ? theme.raised : "transparent" }}
					>
						<LayoutGrid size={18} color={viewMode === "grid" ? theme.primary : theme.textMuted} />
					</Pressable>
					<Pressable
						onPress={() => setViewMode("list")}
						style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: viewMode === "list" ? theme.raised : "transparent" }}
					>
						<List size={18} color={viewMode === "list" ? theme.primary : theme.textMuted} />
					</Pressable>
				</View>
			</View>

			<ScrollView style={{ flex: 1 }}>
				{viewMode === "grid" ? (
					<View style={{ padding: 16 }}>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
							<View>
								<Text style={{ fontSize: 24, fontWeight: "bold", color: theme.text, textTransform: "capitalize" }}>
									{format(currentMonth, "MMMM yyyy", { locale: currentLocale })}
								</Text>
							</View>
							<View style={{ flexDirection: "row", gap: 8 }}>
								<Pressable onPress={jumpToToday} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.sunken }}>
									<Text style={{ fontSize: 13, fontWeight: "bold", color: theme.text }}>{t.today}</Text>
								</Pressable>
								<View style={{ flexDirection: "row", backgroundColor: theme.sunken, borderRadius: 8 }}>
									<Pressable onPress={prevMonth} style={{ padding: 8 }}><ArrowLeft size={20} color={theme.text} /></Pressable>
									<Pressable onPress={nextMonth} style={{ padding: 8 }}><ArrowRight size={20} color={theme.text} /></Pressable>
								</View>
							</View>
						</View>

						<View style={{ flexDirection: "row", marginBottom: 8 }}>
							{weekDays.map((day) => (
								<Text key={day} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "bold", color: theme.textMuted, textTransform: "uppercase" }}>
									{day}
								</Text>
							))}
						</View>

						<View style={{ flexDirection: "row", flexWrap: "wrap" }}>
							{calendarDays.map((day) => {
								const dayEvents = getEventsForDay(day);
								const isSelected = isSameDay(day, selectedDate);
								const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
								const isToday = isSameDay(day, new Date());
								const hasEkadashi = dayEvents.some(e => e.isEkadashi);
								const hasFestival = dayEvents.some(e => e.type === "festival");
								const hasOther = dayEvents.some(e => !e.isEkadashi && e.type !== "festival");

								return (
									<Pressable
										key={day.toISOString()}
										onPress={() => setSelectedDate(day)}
										style={{
											width: "14.28%",
											aspectRatio: 1,
											padding: 2,
										}}
									>
										<View style={{
											flex: 1,
											alignItems: "center",
											justifyContent: "center",
											borderRadius: 8,
											backgroundColor: isSelected ? theme.primary : isToday ? theme.sunken : "transparent",
											opacity: isCurrentMonth ? 1 : 0.3,
										}}>
											<Text style={{
												fontSize: 16,
												fontWeight: isSelected || isToday ? "bold" : "normal",
												color: isSelected ? (theme.isDark ? "#F7F7F7" : "#FFF8E7") : theme.text,
											}}>
												{format(day, "d")}
											</Text>
											
											{dayEvents.length > 0 && (
												<View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
													{hasEkadashi && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? "#FFF" : status.error }} />}
													{hasFestival && !hasEkadashi && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? "#FFF" : status.success }} />}
													{hasOther && !hasFestival && !hasEkadashi && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? "#FFF" : status.info }} />}
												</View>
											)}
										</View>
									</Pressable>
								);
							})}
						</View>

						{/* Selected Day Events */}
						<View style={{ marginTop: 24 }}>
							<Text style={{ fontSize: 18, fontWeight: "bold", color: theme.text, marginBottom: 12 }}>
								{format(selectedDate, "d MMMM yyyy", { locale: currentLocale })}
							</Text>

							{selectedDayEvents.length > 0 ? (
								<View style={{ gap: 12 }}>
									{selectedDayEvents.map(event => (
										<EventCard
											key={event.id}
											event={event}
											title={getEventTitle(event)}
											typeLabel={getEventType(event.type)}
											isHindi={isHindi}
											eventTimeLabel={t.eventTime}
											breakTimeLabel={t.breakTime}
										/>
									))}
								</View>
							) : (
								<View style={{ padding: 24, alignItems: "center", backgroundColor: theme.sunken, borderRadius: 12 }}>
									<Text style={{ color: theme.textMuted }}>{t.noEvents}</Text>
								</View>
							)}

							<DayDetails
								date={selectedDate}
								location={location}
								isHindi={isHindi}
								onOpenLocationModal={() => setIsLocationModalOpen(true)}
								t={t}
								translatePanchang={translatePanchang}
							/>
						</View>

						{upcomingDays.length > 0 && (
							<View style={{ marginTop: 24 }}>
								<Text style={{ fontSize: 18, fontWeight: "bold", color: theme.text, marginBottom: 12 }}>{t.upcoming}</Text>
								<View style={{ gap: 16 }}>
									{upcomingDays.map(({ date, events: upcomingEvents }) => (
										<View key={date.toISOString()}>
											<Text style={{ fontSize: 14, fontWeight: "bold", color: theme.textMuted, marginBottom: 8 }}>
												{format(date, "d MMMM yyyy", { locale: currentLocale })}
											</Text>
											<View style={{ gap: 8 }}>
												{upcomingEvents.map(ev => (
													<EventCard
														key={ev.id}
														compact
														event={ev}
														title={getEventTitle(ev)}
														typeLabel={getEventType(ev.type)}
														isHindi={isHindi}
														eventTimeLabel={t.eventTime}
														breakTimeLabel={t.breakTime}
													/>
												))}
											</View>
										</View>
									))}
								</View>
							</View>
						)}
					</View>
				) : (
					<View style={{ padding: 16 }}>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
							<View style={{ flexDirection: "row", gap: 8 }}>
								<Pressable onPress={jumpToToday} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.sunken }}>
									<Text style={{ fontSize: 13, fontWeight: "bold", color: theme.text }}>{t.today}</Text>
								</Pressable>
							</View>
						</View>

						<View style={{ gap: 8 }}>
							{calendarDays.map((day) => {
								const dayStr = day.toISOString();
								const dayEvents = getEventsForDay(day);
								const isExpanded = expandedDate === dayStr;
								const hasEkadashi = dayEvents.some(e => e.isEkadashi);
								const isToday = isSameDay(day, new Date());

								return (
									<View key={dayStr} style={{ borderRadius: 12, backgroundColor: isExpanded ? theme.sunken : theme.raised, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
										<Pressable
											onPress={() => setExpandedDate(isExpanded ? null : dayStr)}
											style={{ padding: 16, flexDirection: "row", alignItems: "center" }}
										>
											<View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
												<View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: hasEkadashi ? status.errorSoft : isToday ? theme.primary : theme.sunken, alignItems: "center", justifyContent: "center" }}>
													<Text style={{ fontSize: 20, fontWeight: "bold", color: hasEkadashi ? status.error : isToday ? (theme.isDark ? "#F7F7F7" : "#FFF8E7") : theme.text }}>
														{format(day, "d")}
													</Text>
													<Text style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: hasEkadashi ? status.error : isToday ? (theme.isDark ? "#F7F7F7" : "#FFF8E7") : theme.textMuted }}>
														{format(day, "EEE", { locale: currentLocale })}
													</Text>
												</View>
												<View style={{ flex: 1 }}>
													<Text style={{ fontSize: 16, fontWeight: "bold", color: theme.text }} numberOfLines={1}>
														{dayEvents.length > 0 ? getEventTitle(dayEvents[0]) : t.noEvents}
													</Text>
													{dayEvents.length > 1 && (
														<Text style={{ fontSize: 13, color: theme.textMuted }}>
															+ {dayEvents.length - 1} {isHindi ? "अन्य" : "more"}
														</Text>
													)}
												</View>
											</View>
										</Pressable>

										{isExpanded && (
											<View style={{ padding: 16, paddingTop: 0, gap: 12 }}>
												{dayEvents.length > 0 ? (
													dayEvents.map(event => (
														<EventCard
															key={event.id}
															compact
															event={event}
															title={getEventTitle(event)}
															typeLabel={getEventType(event.type)}
															isHindi={isHindi}
															eventTimeLabel={t.eventTime}
															breakTimeLabel={t.breakTime}
														/>
													))
												) : null}
												
												<DayDetails
													date={day}
													location={location}
													isHindi={isHindi}
													onOpenLocationModal={() => setIsLocationModalOpen(true)}
													t={t}
													translatePanchang={translatePanchang}
												/>
											</View>
										)}
									</View>
								);
							})}
						</View>
					</View>
				)}
			</ScrollView>

			<LocationModal
				visible={isLocationModalOpen}
				currentLocation={location}
				onSelect={handleSelectLocation}
				onClose={() => setIsLocationModalOpen(false)}
			/>
		</View>
	);
};

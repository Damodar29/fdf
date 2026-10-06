import {
	addDays,
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	isToday,
	startOfDay,
	startOfMonth,
	startOfWeek,
	subMonths,
} from "date-fns";
import { enUS, hi } from "date-fns/locale";
import {
	ArrowLeft,
	CalendarCheck,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Grid,
	Heart,
	Languages,
	List,
	MapPin,
	RotateCcw,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { calculateGaurabdaDetails } from "../services/GaurabdaService";
import type { EventData } from "../types";
import { OfflineBanner } from "./OfflineBanner";

const LOCATIONS = [
	// Madhya Pradesh
	{ name: "Bhopal, Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
	{ name: "Indore, Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
	{ name: "Jabalpur, Madhya Pradesh", lat: 23.1815, lng: 79.9864 },
	{ name: "Gwalior, Madhya Pradesh", lat: 26.2124, lng: 78.1772 },
	{ name: "Sagar, Madhya Pradesh", lat: 23.8388, lng: 78.7378 },
	{ name: "Damoh, Madhya Pradesh", lat: 23.8322, lng: 79.4441 },
	{ name: "Vidisha, Madhya Pradesh", lat: 23.5251, lng: 77.8081 },
	{ name: "Chhatarpur, Madhya Pradesh", lat: 24.916, lng: 79.5812 },

	// Rajasthan
	{ name: "Jaipur, Rajasthan", lat: 26.9124, lng: 75.7873 },
	{ name: "Kota, Rajasthan", lat: 25.2138, lng: 75.8648 },

	// Uttar Pradesh
	{ name: "Vrindavan, Uttar Pradesh", lat: 27.565, lng: 77.6593 },

	// West Bengal
	{ name: "Mayapur, West Bengal", lat: 23.425, lng: 88.393 },
	{ name: "Kolkata, West Bengal", lat: 22.5726, lng: 88.3639 },

	// Chhattisgarh
	{ name: "Raipur, Chhattisgarh", lat: 21.2514, lng: 81.6296 },
	{ name: "Bhilai, Chhattisgarh", lat: 21.1938, lng: 81.3509 },
	{ name: "Bilaspur, Chhattisgarh", lat: 22.0797, lng: 82.1409 },

	// Odisha
	{ name: "Puri, Odisha", lat: 19.8135, lng: 85.8312 },
];

/**
 * One event in the "Events on this day" and "Upcoming" lists.
 *
 * Lives at module level on purpose: defined inside EventsScreen it was a new
 * component type on every render, so any re-render of the screen (opening
 * Panchang details, an events refresh) remounted every card and collapsed a
 * description the user had just expanded.
 */
const EventCard = ({
	event,
	compact = false,
	title,
	typeLabel,
	isHindi,
	eventTimeLabel,
	breakTimeLabel,
}: {
	event: EventData;
	compact?: boolean;
	title: string;
	typeLabel: string;
	isHindi: boolean;
	eventTimeLabel: string;
	breakTimeLabel: string;
}) => {
	const [isExpanded, setIsExpanded] = useState(false);
	// "Read more" only when the text really runs past the 2-line clamp. It used
	// to show for every description, even a one-liner that was already fully
	// visible, and tapping it revealed nothing.
	const [isClamped, setIsClamped] = useState(false);
	const textRef = useRef<HTMLDivElement>(null);
	const description = event.description?.trim() || "";

	// biome-ignore lint/correctness/useExhaustiveDependencies: `description` is a trigger — new text needs a fresh measurement
	useLayoutEffect(() => {
		const el = textRef.current;
		// Measured only while clamped; expanded text has no clamp to overflow.
		if (!el || isExpanded) return;
		const measure = () => setIsClamped(el.scrollHeight > el.clientHeight + 1);
		measure();
		// Width changes (rotation, split screen) and late-loading Hindi fonts
		// change how many lines the text takes.
		const ro =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(measure)
				: null;
		ro?.observe(el);
		document.fonts?.ready.then(measure).catch(() => {});
		return () => ro?.disconnect();
	}, [description, isExpanded]);

	let colorClass = "bg-blue-500 text-white border-blue-600";
	let typeClass = "text-blue-100";

	if (event.isEkadashi) {
		colorClass = "bg-red-500 text-white border-red-600";
		typeClass = "text-red-100";
	} else if (event.type === "festival") {
		colorClass = "bg-green-600 text-white border-green-700";
		typeClass = "text-green-100";
	}

	return (
		<div
			className={`${colorClass} border ${compact ? "p-3 rounded-lg" : "p-4 rounded-xl"} flex flex-col ${compact ? "gap-1" : "gap-2"} shadow-sm hover:shadow-md transition-shadow`}
		>
			<div className="flex items-center justify-between">
				<div>
					<span
						className={`font-bold block ${compact ? "text-sm" : "text-sm"}`}
					>
						{title}
					</span>
					{!compact && (
						<span
							className={`${typeClass} text-xs font-bold mt-0.5 block uppercase tracking-wide`}
						>
							{typeLabel}
						</span>
					)}
				</div>
			</div>
			{(event.eventTime || event.breakTime) && (
				<div
					className={`flex flex-col gap-1 text-xs ${typeClass} opacity-90 mt-1`}
				>
					{event.eventTime && (
						<div>
							<span className="font-semibold">{eventTimeLabel}:</span>{" "}
							{event.eventTime}
						</div>
					)}
					{event.breakTime && (
						<div>
							<span className="font-semibold">{breakTimeLabel}:</span>{" "}
							{event.breakTime.replace(/^पारण\s*[-:]?\s*/, "")}
						</div>
					)}
				</div>
			)}
			{description && (
				<div
					className={`mt-2 text-sm text-white/95 border-t border-white/20 ${compact ? "pt-1.5" : "pt-2"}`}
				>
					<div
						ref={textRef}
						className={`transition-all duration-300 overflow-hidden ${isExpanded ? "" : "line-clamp-2"} whitespace-pre-wrap leading-snug`}
					>
						{description}
					</div>
					{(isClamped || isExpanded) && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setIsExpanded(!isExpanded);
							}}
							className="text-xs font-bold mt-2 hover:underline text-white flex items-center gap-1 opacity-80"
						>
							{isExpanded
								? isHindi
									? "कम दिखाएं"
									: "Show less"
								: isHindi
									? "और पढ़ें"
									: "Read more"}
							{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
						</button>
					)}
				</div>
			)}
		</div>
	);
};

interface EventsScreenProps {
	onBack: () => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage?: "en" | "hi";
	events?: EventData[];
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
	onBack,
	scrollBarSide = "left",
	settingsLanguage = "hi",
	events = [],
}) => {
	const [currentMonth, setCurrentMonth] = useState(new Date());
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [lang, setLang] = useState<"en" | "hi">(settingsLanguage || "hi");
	const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
		return (
			(localStorage.getItem("cpbs_events_view_mode") as "grid" | "list") ||
			"grid"
		);
	});

	useEffect(() => {
		localStorage.setItem("cpbs_events_view_mode", viewMode);
	}, [viewMode]);
	const [expandedDate, setExpandedDate] = useState<string | null>(null);
	const [isPanchangExpanded, setIsPanchangExpanded] = useState(false);
	const [_isOffline, setIsOffline] = useState(!navigator.onLine);
	const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
	// Back-button: isLocationModalOpen
	useEffect(() => {
		if (isLocationModalOpen)
			window.history.pushState({ isPopup: true, view: "location-modal" }, "");
	}, [isLocationModalOpen]);
	useEffect(() => {
		const h = (e: PopStateEvent) => {
			if (isLocationModalOpen && e.state?.view !== "location-modal")
				setIsLocationModalOpen(false);
		};
		window.addEventListener("popstate", h);
		return () => window.removeEventListener("popstate", h);
	}, [isLocationModalOpen]);
	const handleClose_LocationModal = () => {
		if (window.history.state?.view === "location-modal") window.history.back();
		else setIsLocationModalOpen(false);
	};

	// Offline Events Cache state
	const [activeEvents, setActiveEvents] = useState<EventData[]>(events || []);

	useEffect(() => {
		if (events && events.length > 0) {
			setActiveEvents(events);
			localStorage.setItem("events_calendar_cache", JSON.stringify(events));
		} else if (events && events.length === 0 && !navigator.onLine) {
			// if offline and parent passed empty events, try cache
			const cached = localStorage.getItem("events_calendar_cache");
			if (cached) {
				try {
					setActiveEvents(JSON.parse(cached));
				} catch (_e) {}
			}
		} else if (events && events.length === 0 && navigator.onLine) {
			// online but 0 events (empty firestore), clear cache
			setActiveEvents([]);
			localStorage.setItem("events_calendar_cache", "[]");
		}
	}, [events]);

	// Default Location (Mayapur) or load from localStorage
	const [location, setLocation] = useState(() => {
		const saved = localStorage.getItem("panchang_location");
		if (saved) {
			try {
				return JSON.parse(saved);
			} catch (e) {
				console.error("Failed to parse saved location", e);
			}
		}
		return { lat: 23.425, lng: 88.393, name: "Mayapur, West Bengal" };
	});

	// Save location whenever it changes
	useEffect(() => {
		localStorage.setItem("panchang_location", JSON.stringify(location));
	}, [location]);

	// Offline listener
	useEffect(() => {
		const handleOnline = () => setIsOffline(false);
		const handleOffline = () => setIsOffline(true);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	const currentLocale = lang === "hi" ? hi : enUS;

	// Calendar Grid Logic
	const monthStart = startOfMonth(currentMonth);
	const monthEnd = endOfMonth(currentMonth);
	const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
	const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

	const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
	const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

	const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
	const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
	const jumpToToday = () => {
		const now = new Date();
		setCurrentMonth(now);
		setSelectedDate(now);
		// List rows are keyed by local midnight (day.toISOString()), so the raw
		// "now" timestamp never matched and Today didn't expand today's row.
		setExpandedDate(startOfDay(now).toISOString());
	};

	const parseLocalDate = (dateStr: string) => {
		if (!dateStr) return new Date();
		const [year, month, day] = dateStr.split("-");
		return new Date(
			parseInt(year, 10),
			parseInt(month, 10) - 1,
			parseInt(day, 10),
		);
	};

	const getEventsForDay = (date: Date) => {
		const dayEvents = activeEvents.filter((e) =>
			isSameDay(parseLocalDate(e.date), date),
		);
		return dayEvents.sort((a, b) => {
			if (a.type === "festival" && b.type !== "festival") return -1;
			if (a.type !== "festival" && b.type === "festival") return 1;
			if (a.isEkadashi) return -1;
			if (b.isEkadashi) return 1;
			return 0;
		});
	};

	// Upcoming events logic (starting from selected date)
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

	const isHindi = lang === "hi";

	const t = {
		title: isHindi ? "वैष्णव कैलेंडर" : "Vaishnav Calendar",
		today: isHindi ? "आज" : "Today",
		ekadashiFast: isHindi ? "एकादशी व्रत" : "Ekadashi Fast",
		fastDesc: isHindi ? "अन्न का त्याग करें।" : "Fast from grains.",
		eventsOnDay: isHindi ? "इस दिन के कार्यक्रम" : "Events on this day",
		noEvents: isHindi ? "कोई कार्यक्रम नहीं" : "No events listed",
		upcoming: isHindi ? "आगामी कार्यक्रम" : "Upcoming Next",
		viewGrid: isHindi ? "ग्रिड" : "Grid",
		viewList: isHindi ? "सूची" : "List",
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
		legendEvent: isHindi ? "कार्यक्रम" : "Event",
		legendFestival: isHindi ? "उत्सव" : "Festival",
		legendEkadashi: isHindi ? "एकादशी" : "Ekadashi",
		legendMultiple: isHindi ? "एकाधिक" : "Multiple",
		legendSelected: isHindi ? "चयनित" : "Selected",
		eventTime: isHindi ? "कार्यक्रम का समय" : "Event Time",
		breakTime: isHindi ? "पारण का समय" : "Break Time",
		selectLocation: isHindi ? "स्थान चुनें" : "Select Location",
	};

	// Generate localized week days
	const weekDays = useMemo(() => {
		const days = [];
		const start = startOfWeek(new Date(), { weekStartsOn: 1 });
		for (let i = 0; i < 7; i++) {
			days.push(format(addDays(start, i), "EEE", { locale: currentLocale }));
		}
		return days;
	}, [currentLocale]);

	// Helper to get correct title based on language
	const getEventTitle = (event: EventData) => {
		if (isHindi && event.titleHi) return event.titleHi;
		return event.title;
	};

	const getEventType = (type?: string) => {
		if (!isHindi || !type) return type || "";
		const lower = type.toLowerCase();
		switch (lower) {
			case "ekadashi":
				return "एकादशी";
			case "festival":
				return "उत्सव";
			case "appearance":
				return "आविर्भाव";
			case "disappearance":
				return "तिरोभाव";
			case "other":
				return "अन्य";
			default:
				return type;
		}
	};

	const panchangTranslations: Record<string, string> = {
		// Tithis
		Pratipat: "प्रतिपदा",
		Dvitiya: "द्वितीया",
		Tritiya: "तृतीया",
		Chaturthi: "चतुर्थी",
		Panchami: "पंचमी",
		Shasti: "षष्ठी",
		Saptami: "सप्तमी",
		Ashtami: "अष्टमी",
		Navami: "नवमी",
		Dashami: "दशमी",
		Ekadashi: "एकादशी",
		Dvadashi: "द्वादशी",
		Trayodashi: "त्रयोदशी",
		Chaturdashi: "चतुर्दशी",
		Purnima: "पूर्णिमा",
		Amavasya: "अमावस्या",
		// Nakshatras
		Ashvini: "अश्विनी",
		Bharani: "भरणी",
		Krittika: "कृत्तिका",
		Rohini: "रोहिणी",
		Mrigashirsha: "मृगशीर्ष",
		Ardra: "आर्द्रा",
		Punarvasu: "पुनर्वसु",
		Pushya: "पुष्य",
		Ashlesha: "आश्लेषा",
		Magha: "मघा/माघ",
		"Purva Phalguni": "पूर्वा फाल्गुनी",
		"Uttara Phalguni": "उत्तरा फाल्गुनी",
		Hasta: "हस्त",
		Chitra: "चित्रा",
		Swati: "स्वाति",
		Vishakha: "विशाखा",
		Anuradha: "अनुराधा",
		Jyeshtha: "ज्येष्ठा/ज्येष्ठ",
		Mula: "मूल",
		"Purva Ashadha": "पूर्वाषाढ़ा",
		"Uttara Ashadha": "उत्तराषाढ़ा",
		Shravana: "श्रवण/श्रावण",
		Dhanishta: "धनिष्ठा",
		Shatabhisha: "शतभिषा",
		"Purva Bhadrapada": "पूर्वा भाद्रपद",
		"Uttara Bhadrapada": "उत्तरा भाद्रपद",
		Revati: "रेवती",
		// Yogas
		Vishkumbha: "विष्कुम्भ",
		Priti: "प्रीति",
		Ayushman: "आयुष्मान",
		Saubhagya: "सौभाग्य",
		Shobhana: "शोभन",
		Atiganda: "अतिगण्ड",
		Sukarma: "सुकर्मा",
		Dhriti: "धृति",
		Shula: "शूल",
		Ganda: "गण्ड",
		Vriddhi: "वृद्धि",
		Dhruva: "ध्रुव",
		Vyaghata: "व्याघात",
		Harshana: "हर्षण",
		Vajra: "वज्र",
		Siddhi: "सिद्धि",
		Vyatipata: "व्यतीपात",
		Variyan: "वरीयान",
		Parigha: "परिघ",
		Shiva: "शिव",
		Siddha: "सिद्ध",
		Sadhya: "साध्य",
		Shubha: "शुभ",
		Shukla: "शुक्ल",
		Brahma: "ब्रह्म",
		Indra: "इन्द्र",
		Vaidhriti: "वैधृति",
		// Masas (Removed duplicates: Jyeshtha, Shravana, Magha)
		Caitra: "चैत्र",
		Vaisakha: "वैशाख",
		Ashadha: "आषाढ़",
		Bhadrapada: "भाद्रपद",
		Ashvina: "अश्विन",
		Kartika: "कार्तिक",
		Margashirsha: "मार्गशीर्ष",
		Pausha: "पौष",
		Phalguna: "फाल्गुन",
		// Gaudiya Masas
		Visnu: "विष्णु",
		Madhusudana: "मधुसूदन",
		Trivikrama: "त्रिविक्रम",
		Vamana: "वामन",
		Sridhara: "श्रीधर",
		Hrishikesha: "हृषीकेश",
		Padmanabha: "पद्मनाभ",
		Damodara: "दामोदर",
		Kesava: "केशव",
		Narayana: "नारायण",
		Madhava: "माधव",
		Govinda: "गोविन्द",
		Purusottama: "पुरुषोत्तम",
		// Paksas
		"Gaura (Shukla)": "गौर (शुक्ल)",
		Krishna: "कृष्ण",
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

		// Handle dual-meaning words based on context
		if (translated.includes("/")) {
			const parts = translated.split("/");
			if (type === "masa") translated = parts[1];
			else if (type === "naksatra") translated = parts[0];
			else translated = parts[0]; // fallback
		}

		if (isAdhika) {
			return `अधिक ${translated}`;
		}
		return translated;
	};

	// Gaurabda Details Component
	const DayDetails = ({ date }: { date: Date }) => {
		const details = useMemo(
			() => calculateGaurabdaDetails(date, location.lat, location.lng),
			[date],
		);

		const translateTime = (timeStr: string) => {
			if (!isHindi || !timeStr) return timeStr;
			return timeStr.replace("AM", "पूर्वाह्न").replace("PM", "अपराह्न");
		};

		return (
			<div className="mt-4 p-4 bg-slate-900/5 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
				<div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
					<span className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
						{isHindi ? "स्थान" : "Location"}
					</span>
					<button
						onClick={(e) => {
							e.stopPropagation();
							setIsLocationModalOpen(true);
						}}
						className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm"
					>
						<MapPin size={12} className="text-saffron-500" />
						<span>{location.name.split(",")[0]}</span>
					</button>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
					<div className="space-y-2">
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.tithi}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translatePanchang(details.tithi.name)}{" "}
								<span className="text-xs text-slate-400 dark:text-ink-400">
									({translateTime(details.tithi.endTime)})
								</span>
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.masa}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translatePanchang(details.masa, "masa")}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.gaurabdaYear}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{details.gaurabdaYear}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.masaGaudiya}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translatePanchang(details.masaGaudiya)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.paksa}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translatePanchang(details.paksa)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.naksatra}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translatePanchang(details.naksatra.name, "naksatra")}{" "}
								<span className="text-xs text-slate-400 dark:text-ink-400">
									({translateTime(details.naksatra.endTime)})
								</span>
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.yoga}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translatePanchang(details.yoga.name)}{" "}
								<span className="text-xs text-slate-400 dark:text-ink-400">
									({translateTime(details.yoga.endTime)})
								</span>
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.brahmaMuhurta}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translateTime(details.brahmaMuhurta)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.sunrise}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translateTime(details.sunrise)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.noon}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translateTime(details.noon)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-bold text-slate-500 dark:text-slate-400">
								{t.sunset}:
							</span>{" "}
							<span className="font-medium text-slate-800 dark:text-slate-200">
								{translateTime(details.sunset)}
							</span>
						</div>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300 font-hindi">
			{/* Location Selection Modal */}
			{isLocationModalOpen && (
				<div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
						<div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
							<h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
								<MapPin className="text-saffron-500" size={20} />
								{t.selectLocation}
							</h3>
							<button
								onClick={() => handleClose_LocationModal()}
								className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-ink-300"
							>
								<X size={20} />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-container">
							{Object.entries(
								LOCATIONS.reduce(
									(acc, loc) => {
										const state = loc.name.split(", ")[1];
										if (!acc[state]) acc[state] = [];
										acc[state].push(loc);
										return acc;
									},
									{} as Record<string, typeof LOCATIONS>,
								),
							).map(([state, cities]) => (
								<div key={state}>
									<h4 className="font-bold text-xs uppercase tracking-widest text-slate-400 dark:text-ink-400 mb-3 ml-1">
										{state}
									</h4>
									<div className="grid grid-cols-2 gap-2">
										{cities.map((city) => (
											<button
												key={city.name}
												onClick={() => {
													setLocation(city);
													handleClose_LocationModal();
												}}
												className={`text-left px-4 py-3 rounded-2xl border transition-all ${location.name === city.name ? "bg-saffron-50 dark:bg-slate-800 border-saffron-500 text-saffron-700 dark:text-saffron-300 font-bold shadow-sm ring-1 ring-saffron-500" : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-saffron-300 dark:hover:border-saffron-700 text-slate-700 dark:text-slate-300"}`}
											>
												<div className="text-sm truncate">
													{city.name.split(",")[0]}
												</div>
											</button>
										))}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Background Pattern */}
			<div
				className="absolute inset-0 opacity-10 pointer-events-none"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
				}}
			></div>

			{/* Header */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between shadow-lg z-10 rounded-b-3xl border-b-2 border-ry-gold/40">
				<div className="flex items-center gap-3">
					<button
						onClick={onBack}
						className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>
					<h2 className="font-display text-xl font-semibold flex items-center gap-2 tracking-wide leading-none drop-shadow-md">
						<CalendarCheck className="w-6 h-6" />
						{t.title}
					</h2>
				</div>

				<div className="flex items-center gap-2">
					<button
						onClick={() =>
							setViewMode((prev) => (prev === "grid" ? "list" : "grid"))
						}
						data-tour="events-view"
						className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors border border-white/30"
						title={viewMode === "grid" ? t.viewList : t.viewGrid}
					>
						{viewMode === "grid" ? <List size={20} /> : <Grid size={20} />}
					</button>
					<button
						onClick={() => setLang((prev) => (prev === "hi" ? "en" : "hi"))}
						data-tour="events-lang"
						className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors text-xs font-bold border border-white/30"
					>
						<Languages size={14} />
						{isHindi ? "English" : "हिंदी"}
					</button>
				</div>
			</div>

			{/* Offline Banner */}
			<OfflineBanner className="mx-4 mt-4" />

			<div
				className={`flex-1 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-0`}
			>
				<div
					dir={scrollBarSide === "left" ? "ltr" : undefined}
					className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8 max-w-6xl mx-auto"
				>
					{/* --- LEFT COLUMN: CALENDAR GRID / LIST --- */}
					<div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col min-h-[520px]">
						{/* Top Navigation Bar */}
						<div
							className="p-4 md:p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30"
							data-tour="events-month"
						>
							<button
								onClick={prevMonth}
								className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-300 transition-all shadow-sm hover:shadow active:scale-95"
							>
								<ChevronLeft size={20} />
							</button>

							<div className="flex items-center gap-3">
								<div className="flex flex-col items-center">
									<span className="text-xl font-bold text-slate-800 dark:text-white capitalize">
										{format(currentMonth, "MMMM", { locale: currentLocale })}
									</span>
									<span className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase tracking-widest">
										{format(currentMonth, "yyyy")}
									</span>
								</div>
							</div>

							<div className="flex gap-2">
								<button
									onClick={jumpToToday}
									className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-saffron-600 dark:text-saffron-400 transition-all shadow-sm hover:shadow active:scale-95 bg-saffron-50 dark:bg-slate-800"
									title="Today"
								>
									<RotateCcw size={20} />
								</button>
								<button
									onClick={nextMonth}
									className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-300 transition-all shadow-sm hover:shadow active:scale-95"
								>
									<ChevronRight size={20} />
								</button>
							</div>
						</div>

						{viewMode === "grid" ? (
							<>
								{/* Week Headers */}
								<div className="grid grid-cols-7 gap-1 px-3 sm:px-4 md:px-6 lg:px-8 py-3 md:py-4 bg-white dark:bg-slate-900">
									{weekDays.map((day) => (
										<div
											key={day}
											className="text-center text-xs font-bold text-slate-400 dark:text-ink-400 uppercase tracking-wider"
										>
											{day}
										</div>
									))}
								</div>

								{/* Calendar Grid */}
								<div
									className="px-3 sm:px-4 md:px-6 lg:px-8 pb-5 md:pb-6"
									data-tour="events-grid"
								>
									<div className="grid grid-cols-7 gap-x-1 gap-y-1 sm:gap-y-2 h-auto">
										{calendarDays.map((day) => {
											const dayEvents = getEventsForDay(day);
											const isSelected = isSameDay(day, selectedDate);
											const isCurrentMonth = isSameMonth(day, currentMonth);
											const isTodayDate = isToday(day);
											const hasEkadashi = dayEvents.some((e) => e.isEkadashi);
											const hasFestival = dayEvents.some(
												(e) => e.type === "festival",
											);
											const isMultiple = dayEvents.length > 1;
											const hasEvent = dayEvents.length > 0;

											let baseClass =
												"text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800";

											if (hasEvent) {
												if (hasEkadashi)
													baseClass =
														"bg-red-500 text-white font-bold shadow-sm";
												else if (hasFestival)
													baseClass =
														"bg-green-600 text-white font-bold animate-glow ring-1 ring-green-400";
												else if (isMultiple)
													baseClass =
														"bg-purple-500 text-white font-bold shadow-sm";
												else
													baseClass =
														"bg-blue-500 text-white font-bold shadow-sm";

												if (isSelected) {
													baseClass +=
														" scale-110 z-10 ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-900";
												}
											} else if (isSelected) {
												baseClass =
													"bg-slate-700 text-white shadow-md scale-110 font-bold z-10";
											} else if (isTodayDate) {
												baseClass =
													"bg-slate-500 text-white font-bold shadow-sm";
											}

											return (
												<div
													key={day.toISOString()}
													onClick={() => setSelectedDate(day)}
													className="aspect-square flex items-center justify-center cursor-pointer min-w-0"
												>
													<div
														className={`
                                                    w-full aspect-square max-w-[34px] sm:max-w-[38px] md:max-w-[40px] lg:max-w-[44px]
                                                    rounded-full flex items-center justify-center transition-all duration-200
                                                    ${baseClass}
                                                    ${!isSelected && isTodayDate && hasEvent ? "ring-2 ring-slate-500" : ""}
                                                    ${!isCurrentMonth ? "opacity-30 grayscale" : ""}
                                                `}
													>
														<span className="text-[13px] sm:text-sm md:text-[15px] lg:text-base">
															{format(day, "d")}
														</span>
													</div>
												</div>
											);
										})}
									</div>
								</div>

								{/* Legend */}
								<div className="px-3 sm:px-4 md:px-6 lg:px-8 pb-5 md:pb-6 border-t border-slate-50 dark:border-slate-800 pt-4">
									<div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
										<div className="flex items-center gap-1.5">
											<div className="w-3 h-3 rounded-full bg-blue-500"></div>
											<span>{t.legendEvent}</span>
										</div>
										<div className="flex items-center gap-1.5">
											<div className="w-3 h-3 rounded-full bg-green-600 animate-glow"></div>
											<span>{t.legendFestival}</span>
										</div>
										<div className="flex items-center gap-1.5">
											<div className="w-3 h-3 rounded-full bg-purple-500"></div>
											<span>{t.legendMultiple}</span>
										</div>
										<div className="flex items-center gap-1.5">
											<div className="w-3 h-3 rounded-full bg-red-500"></div>
											<span>{t.legendEkadashi}</span>
										</div>
										<div className="flex items-center gap-1.5">
											<div className="w-3 h-3 rounded-full bg-slate-500"></div>
											<span>{t.today}</span>
										</div>
									</div>
								</div>
							</>
						) : (
							/* LIST VIEW */
							<div className="flex-1 overflow-y-auto p-4 space-y-3">
								{monthDays.map((day) => {
									const dayEvents = getEventsForDay(day);
									const isExpanded = expandedDate === day.toISOString();
									const isTodayDate = isToday(day);

									return (
										<div
											key={day.toISOString()}
											className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? "bg-slate-50 dark:bg-slate-800 border-saffron-200 dark:border-slate-700 shadow-md" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
										>
											<div
												onClick={() =>
													setExpandedDate(isExpanded ? null : day.toISOString())
												}
												className="p-4 flex items-center justify-between cursor-pointer"
											>
												<div className="flex items-center gap-4">
													<div
														className={`w-12 h-12 rounded-full flex flex-col items-center justify-center border ${isTodayDate ? "bg-saffron-500 text-white border-saffron-600" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
													>
														<span className="text-lg font-bold leading-none">
															{format(day, "d")}
														</span>
														<span className="text-[10px] uppercase font-bold opacity-70 leading-none">
															{format(day, "EEE")}
														</span>
													</div>
													<div>
														<h4
															className={`font-bold text-sm ${isTodayDate ? "text-saffron-600 dark:text-saffron-400" : "text-slate-800 dark:text-white"}`}
														>
															{format(day, "MMMM yyyy")}
														</h4>
														{dayEvents.length > 0 ? (
															<div className="flex flex-wrap gap-1 mt-1">
																{dayEvents.map((e, i) => (
																	<span
																		key={i}
																		className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${e.isEkadashi ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}`}
																	>
																		{getEventTitle(e)}
																	</span>
																))}
															</div>
														) : (
															<p className="text-xs text-slate-400 dark:text-ink-400">
																{t.noEvents}
															</p>
														)}
													</div>
												</div>
												<button
													className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? "rotate-180 bg-slate-200 dark:bg-slate-700" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
												>
													<ChevronDown
														size={20}
														className="text-slate-500 dark:text-ink-300"
													/>
												</button>
											</div>

											{isExpanded && (
												<div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700">
													<DayDetails date={day} />
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* --- RIGHT COLUMN: DETAILS PANEL (Only in Grid Mode or Large Screens) --- */}
					<div
						className={`lg:w-96 flex-shrink-0 space-y-6 ${viewMode === "list" ? "hidden lg:block" : ""}`}
					>
						{/* Selected Day Info */}
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-4 duration-500">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="font-serif font-bold text-slate-800 dark:text-white text-2xl capitalize">
										{format(selectedDate, "d", { locale: currentLocale })}{" "}
										<span className="text-slate-400 dark:text-ink-400 text-lg font-sans font-normal">
											{format(selectedDate, "MMMM", { locale: currentLocale })}
										</span>
									</h3>
									<p className="text-slate-400 dark:text-ink-400 font-medium text-sm capitalize">
										{format(selectedDate, "EEEE, yyyy", {
											locale: currentLocale,
										})}
									</p>
								</div>
								{isToday(selectedDate) && (
									<span className="text-xs font-bold text-saffron-600 dark:text-saffron-400 bg-saffron-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-saffron-100 dark:border-slate-700">
										{t.today}
									</span>
								)}
							</div>

							{/* Fasting Info */}
							{selectedDayEvents.some((e) => e.isEkadashi) && (
								<div className="mb-6">
									<div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl p-4 flex items-center gap-3">
										<div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-800 flex items-center justify-center text-orange-600 dark:text-orange-300">
											<Heart size={16} fill="currentColor" />
										</div>
										<div>
											<p className="text-orange-800 dark:text-orange-200 font-bold text-xs uppercase tracking-wider">
												{t.ekadashiFast}
											</p>
											<p className="text-orange-600 dark:text-orange-300 text-xs">
												{t.fastDesc}
											</p>
										</div>
									</div>
								</div>
							)}

							<h4 className="font-bold text-slate-400 dark:text-ink-400 text-xs uppercase tracking-widest mb-3">
								{t.eventsOnDay}
							</h4>
							<div className="space-y-3">
								{selectedDayEvents.length > 0 ? (
									selectedDayEvents.map((event, idx) => (
										<EventCard
											key={`${event.id}-${idx}`}
											event={event}
											title={getEventTitle(event)}
											typeLabel={getEventType(event.type)}
											isHindi={isHindi}
											eventTimeLabel={t.eventTime}
											breakTimeLabel={t.breakTime}
										/>
									))
								) : (
									<div className="text-center py-8 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
										<p className="text-slate-400 dark:text-ink-400 text-sm">
											{t.noEvents}
										</p>
									</div>
								)}
							</div>

							{/* Gaurabda Details (Grid View Only) */}
							<div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
								<button
									onClick={() => setIsPanchangExpanded(!isPanchangExpanded)}
									className="w-full flex items-center justify-between font-bold text-slate-400 dark:text-ink-400 text-xs uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
								>
									<span>{t.panchangDetails}</span>
									<ChevronDown
										className={`transition-transform duration-300 ${isPanchangExpanded ? "rotate-180" : ""}`}
										size={16}
									/>
								</button>
								{isPanchangExpanded && <DayDetails date={selectedDate} />}
							</div>
						</div>

						{/* Upcoming List (Always visible in this layout) */}
						<div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-[2rem] p-6 border border-slate-200/50 dark:border-slate-700/50">
							<h4 className="font-bold text-slate-400 dark:text-ink-400 text-xs uppercase tracking-widest mb-4">
								{t.upcoming}
							</h4>
							<div className="space-y-4">
								{upcomingDays.map((item) => (
									<div key={item.date.toISOString()} className="group">
										<div className="flex items-center gap-2 mb-2">
											<span className="w-1.5 h-1.5 rounded-full bg-saffron-300 dark:bg-saffron-600 group-hover:bg-saffron-500 transition-colors"></span>
											<div className="font-bold text-slate-700 dark:text-slate-300 text-sm capitalize">
												{format(item.date, "d MMM", { locale: currentLocale })}{" "}
												<span className="text-slate-400 dark:text-ink-400 font-normal">
													|{" "}
													{format(item.date, "eee", { locale: currentLocale })}
												</span>
											</div>
										</div>
										<div className="space-y-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700 group-hover:border-saffron-200 dark:group-hover:border-saffron-800 transition-colors">
											{item.events.map((event, idx) => (
												<EventCard
													key={`${event.id}-${idx}`}
													event={event}
													compact={true}
													title={getEventTitle(event)}
													typeLabel={getEventType(event.type)}
													isHindi={isHindi}
													eventTimeLabel={t.eventTime}
													breakTimeLabel={t.breakTime}
												/>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

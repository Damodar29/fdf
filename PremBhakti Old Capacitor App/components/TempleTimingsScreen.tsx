import { collection, getDocs } from "firebase/firestore";
import {
	ChevronDown,
	ChevronLeft,
	Clock,
	Loader2,
	MessageCircle,
	Navigation,
	Phone,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useSharedFirebase } from "../context/SharedFirebaseContext";
import { db } from "../services/firebase";
import type { TempleTiming } from "../src/types/mandal";

interface TempleTimingsScreenProps {
	onBack: () => void;
	initialMandalId?: string;
	scrollBarSide?: "left" | "right";
	settingsLanguage?: "hi" | "en";
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
	settingsLanguage = "hi",
}) => {
	const [selectedMandalId, setSelectedMandalId] = useState<string>(() => {
		if (initialMandalId) return initialMandalId;
		const saved = localStorage.getItem("preferred_temple");
		return saved || "kota";
	});
	const [timings, setTimings] = useState<TempleTiming[]>([]);
	const { dbMandals: sharedMandals, loadingMandals } = useSharedFirebase();

	const [loading, setLoading] = useState(true);
	const [allowedMandals, setAllowedMandals] = useState<string[]>([]);
	const details = TEMPLE_DETAILS[selectedMandalId];

	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	// Back-button: isDropdownOpen
	useEffect(() => {
		if (isDropdownOpen)
			window.history.pushState({ isPopup: true, view: "temple-dropdown" }, "");
	}, [isDropdownOpen]);
	const handleClose_temple_dropdown = () => {
		if (window.history.state?.view === "temple-dropdown") window.history.back();
		else setIsDropdownOpen(false);
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_temple_dropdown is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const _h_temple_dropdown = (e: PopStateEvent) => {
			if (isDropdownOpen && e.state?.view !== "temple-dropdown")
				handleClose_temple_dropdown();
		};
		window.addEventListener("popstate", _h_temple_dropdown);
		return () => window.removeEventListener("popstate", _h_temple_dropdown);
	}, [isDropdownOpen]);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_temple_dropdown is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				handleClose_temple_dropdown();
			}
		};
		if (isDropdownOpen)
			document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isDropdownOpen]);

	useEffect(() => {
		const fetchAllowedMandals = async () => {
			try {
				const snapshot = await getDocs(collection(db, "admin_roles"));
				const allowed = new Set<string>();
				snapshot.forEach((doc) => {
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
					setAllowedMandals(Array.from(allowed));
					const _savedPref = localStorage.getItem("preferred_temple");
					if (!allowed.has(selectedMandalId)) {
						setSelectedMandalId(Array.from(allowed)[0]);
					}
				}
			} catch (error) {
				console.error("Error fetching allowed mandals:", error);
			}
		};
		fetchAllowedMandals();
	}, [selectedMandalId]);

	useEffect(() => {
		localStorage.setItem("preferred_temple", selectedMandalId);

		if (loadingMandals) {
			setLoading(true);
			return;
		}

		const mandalData = sharedMandals.find((m) => m.id === selectedMandalId);
		if (mandalData?.templeTimings) {
			setTimings(
				mandalData.templeTimings.sort(
					(a: TempleTiming, b: TempleTiming) => a.order - b.order,
				),
			);
		} else {
			setTimings([]);
		}
		setLoading(false);
	}, [selectedMandalId, sharedMandals, loadingMandals]);

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
				// Parse "HH:MM AM/PM"
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
		const interval = setInterval(calculateNextEvent, 60000); // Check every minute
		return () => clearInterval(interval);
	}, [timings]);

	return (
		<div className="fixed inset-0 bg-ry-sand dark:bg-ink-900 z-50 flex flex-col animate-in slide-in-from-right">
			<div className="bg-ry-maroon dark:bg-black border-b-2 border-ry-gold/40 shadow-sm z-10 pt-[env(safe-area-inset-top)]">
				<div className="flex items-center h-16 px-4">
					<button
						onClick={onBack}
						className="p-2 -ml-2 text-ry-gold hover:bg-black/20 rounded-full transition-colors"
					>
						<ChevronLeft size={24} />
					</button>
					<h1 className="font-display text-lg font-semibold text-ry-gold ml-2">
						Temple Timings
					</h1>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 landscape:[&>*]:max-w-3xl landscape:[&>*]:mx-auto">
				<div className="mb-6" ref={dropdownRef}>
					<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
						Select Temple
					</label>
					<div className="relative">
						<button
							onClick={() => setIsDropdownOpen(!isDropdownOpen)}
							data-tour="temple-select"
							className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none flex justify-between items-center"
						>
							<span>
								{allowedMandals.includes(selectedMandalId) &&
								TEMPLE_DETAILS[selectedMandalId]
									? settingsLanguage === "hi"
										? TEMPLE_DETAILS[selectedMandalId].shortNameHi
										: TEMPLE_DETAILS[selectedMandalId].shortNameEn
									: "Select Temple"}
							</span>
							<ChevronDown
								size={18}
								className={`text-slate-500 dark:text-ink-300 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
							/>
						</button>

						{isDropdownOpen && (
							<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50 overflow-hidden">
								{allowedMandals.map((id) => {
									const detail = TEMPLE_DETAILS[id];
									if (!detail) return null;
									return (
										<button
											key={id}
											onClick={() => {
												setSelectedMandalId(id);
												handleClose_temple_dropdown();
											}}
											className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${selectedMandalId === id ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700"}`}
										>
											{settingsLanguage === "hi"
												? detail.shortNameHi
												: detail.shortNameEn}
										</button>
									);
								})}
							</div>
						)}
					</div>
				</div>

				{details && (
					<div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
						<h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
							{details.nameHi}
						</h2>
						<h3 className="text-md text-slate-600 dark:text-slate-400 mb-4">
							{details.nameEn}
						</h3>

						<div className="space-y-3">
							{details.phone && (
								<div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
									<Phone className="shrink-0 text-indigo-500" size={18} />
									<p>{details.phone}</p>
								</div>
							)}

							{details.locationUrl && (
								<button
									onClick={() => {
										if (details.isWhatsappLocation && details.locationPhone) {
											const message = encodeURIComponent(
												"Hare Krishna! Please share the temple location.",
											);
											window.open(
												`https://wa.me/91${details.locationPhone}?text=${message}`,
												"_blank",
												"noopener,noreferrer",
											);
										} else {
											window.open(
												details.locationUrl,
												"_blank",
												"noopener,noreferrer",
											);
										}
									}}
									className="w-full mt-4 flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-xl transition-colors bg-ry-cream dark:bg-slate-700 text-ry-maroon dark:text-ry-gold hover:bg-ry-gold/40 dark:hover:bg-slate-600 border border-ry-gold/40 dark:border-slate-600 shadow-sm"
									data-tour="temple-directions"
								>
									{details.isWhatsappLocation ? (
										<MessageCircle size={18} />
									) : (
										<Navigation size={18} />
									)}
									{details.isWhatsappLocation
										? settingsLanguage === "hi"
											? "लोकेशन पूछें"
											: "Ask Location"
										: settingsLanguage === "hi"
											? "दिशा-निर्देश प्राप्त करें"
											: "Get Directions"}
								</button>
							)}
						</div>
					</div>
				)}

				<div
					className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
					data-tour="temple-schedule"
				>
					<div className="flex justify-between items-center mb-4">
						<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
							<Clock className="text-indigo-500" size={20} />
							Daily Schedule
						</h3>
						{nextEvent && (
							<div className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
								{nextEvent.name} in {nextEvent.minutesDiff} min
							</div>
						)}
					</div>

					{loading ? (
						<div className="flex justify-center py-8">
							<Loader2 className="animate-spin text-indigo-600" size={24} />
						</div>
					) : timings.length > 0 ? (
						<div className="space-y-4">
							{timings.map((timing) => (
								<div
									key={timing.id}
									className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3 last:border-0 last:pb-0"
								>
									<span className="font-medium text-slate-700 dark:text-slate-200">
										{timing.eventName}
									</span>
									<span className="text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg">
										{timing.time}
									</span>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-8 text-slate-500 dark:text-slate-400">
							No timings available for this temple yet.
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default TempleTimingsScreen;

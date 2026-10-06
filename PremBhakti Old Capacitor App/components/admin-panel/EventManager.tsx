import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	isToday,
	startOfMonth,
	startOfWeek,
	subMonths,
} from "date-fns";
import {
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
	Edit2,
	Heart,
	Plus,
	RotateCcw,
	Save,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import type { EventData } from "../../types";
import { formatForDateInput } from "../../utils/dateFormatter";
import { DeleteWithConfirm } from "./DeleteWithConfirm";

export const EventManager: React.FC<{
	events: EventData[];
	onUpdateList: (list: EventData[]) => void;
	showToast: (text: string, type?: "success" | "error") => void;
	settingsLanguage?: "en" | "hi";
}> = ({ events, onUpdateList, showToast, settingsLanguage = "hi" }) => {
	const [draft, setDraft] = useState<EventData | null>(null);

	const closeDraft = usePopupBackHandler(!!draft, "event-mgr-editor", () =>
		setDraft(null),
	);

	const isHindi = settingsLanguage === "hi";
	const t = {
		addEvent: isHindi ? "कार्यक्रम जोड़ें" : "Add Event",
		editEvent: isHindi ? "कार्यक्रम संपादित करें" : "Edit Event",
		title: isHindi ? "शीर्षक" : "Title",
		date: isHindi ? "दिनांक" : "Date",
		breakTime: isHindi ? "पारण का समय (वैकल्पिक)" : "Break Time (Optional)",
		eventTime: isHindi ? "कार्यक्रम का समय (वैकल्पिक)" : "Event Time (Optional)",
		location: isHindi ? "स्थान (वैकल्पिक)" : "Location (Optional)",
		eventType: isHindi ? "कार्यक्रम का प्रकार" : "Event Type",
		isEkadashi: isHindi ? "क्या एकादशी व्रत है?" : "Is Ekadashi Fast?",
		description: isHindi ? "विवरण" : "Description",
		saveEvent: isHindi ? "कार्यक्रम सहेजें" : "Save Event",
		restore: isHindi ? "अंतिम हटाए गए को पुनर्स्थापित करें" : "Restore Last Deleted",
		noEvents: isHindi ? "कोई कार्यक्रम सूचीबद्ध नहीं" : "No events listed",
		event: isHindi ? "कार्यक्रम" : "Event",
		festival: isHindi ? "उत्सव" : "Festival",
		multiple: isHindi ? "एकाधिक" : "Multiple",
		ekadashi: isHindi ? "एकादशी" : "Ekadashi",
		today: isHindi ? "आज" : "Today",
		fast: isHindi ? "एकादशी व्रत" : "Ekadashi Fast",
		eventsText: isHindi ? "कार्यक्रम" : "Events",
		back: isHindi ? "पीछे" : "Back",
	};
	const [deletedStack, setDeletedStack] = useState<EventData[]>([]);

	// Calendar State
	const [currentMonth, setCurrentMonth] = useState(new Date());
	const [selectedDate, setSelectedDate] = useState(new Date());

	// Calendar Logic
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
		const dayEvents = events.filter((e) =>
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
	const selectedDayEvents = getEventsForDay(selectedDate);

	const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

	const startEdit = (event?: EventData) => {
		if (event) {
			setDraft({ ...event });
		} else {
			const maxId = events.reduce((max, e) => {
				const num = parseInt(e.id, 10);
				return !Number.isNaN(num) && num > max ? num : max;
			}, 0);
			// Use selected date for new event if available
			const dateStr = format(selectedDate, "yyyy-MM-dd");
			setDraft({
				id: (maxId + 1).toString(),
				title: "",
				description: "",
				date: dateStr,
				day: format(selectedDate, "dd"),
				month: format(selectedDate, "MM"),
				year: format(selectedDate, "yyyy"),
				time: "",
				location: "",
			});
		}
	};

	const saveEvent = () => {
		if (!draft) return;
		if (!draft.title || draft.title.trim() === "") {
			showToast("Please enter event title", "error");
			return;
		}

		const finalDraft = { ...draft };
		// Fallback: just use the original title initially if no titleHi exists
		if (!finalDraft.titleHi) {
			finalDraft.titleHi = draft.title;
		}

		const exists = events.find((e) => e.id === finalDraft.id);
		const newList = exists
			? events.map((e) => (e.id === finalDraft.id ? finalDraft : e))
			: [finalDraft, ...events];

		// Save immediately
		onUpdateList(newList);
		setDraft(null);
	};

	const deleteEvent = (id: string) => {
		const eventToDelete = events.find((e) => e.id === id);
		if (eventToDelete) {
			setDeletedStack((prev) => [...prev, eventToDelete]);
		}
		const newList = events.filter((e) => e.id !== id);
		onUpdateList(newList);
		if (draft?.id === id) setDraft(null);
	};

	const restoreLastDeleted = () => {
		if (deletedStack.length === 0) return;
		const last = deletedStack[deletedStack.length - 1];
		setDeletedStack((prev) => prev.slice(0, -1));
		onUpdateList([...events, last]);
	};

	// --- EDITOR ---
	if (draft) {
		return (
			<div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 p-4 animate-in slide-in-from-right overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
				<div className="flex items-center justify-between mb-6">
					<button
						onClick={closeDraft}
						className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors active:scale-95"
					>
						<ArrowLeft size={18} /> {t.back}
					</button>
					<h3 className="text-lg font-bold">
						{!events.find((e) => e.id === draft.id) ? t.addEvent : t.editEvent}
					</h3>
				</div>

				<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 mb-5 rounded-xl text-sm text-amber-900 dark:text-amber-100 shadow-sm leading-relaxed">
					<h4 className="font-bold text-base mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
						⚠️ ध्यान दें (सबसे ज़रूरी नियम)
					</h4>
					<ul className="list-disc list-outside ml-5 space-y-3">
						<li>
							<b>पारण का समय (Break Time):</b> इस बॉक्स में{" "}
							<u className="font-bold text-red-600 dark:text-red-400">
								केवल साफ समय
							</u>{" "}
							लिखें (जैसे:{" "}
							<code className="bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded font-bold">
								सुबह 9:30 के पूर्व।
							</code>
							)।
							<br />
							<span className="text-red-600 dark:text-red-400 font-bold">
								❌ बिल्कुल ना लिखें:
							</span>{" "}
							<code>पारण</code>, <code>पारण -</code>, <code>अगले दिन</code>,{" "}
							<code>(दूसरे दिन)</code>, <code>कल</code>।
							<br />
							<i className="text-xs opacity-80">
								(क्योंकि हमारा ऐप और नोटिफिकेशन अपने आप "पारण कल:" और "पारण का समय:"
								जोड़ देता है। अगर आप खुद से ये शब्द लिखेंगे, तो वह डबल (Double) होकर बहुत
								अजीब दिखेगा।)
							</i>
						</li>
						<li>
							<b>शीर्षक (Title):</b> केवल उत्सव/व्रत का साफ नाम लिखें। (उदाहरण:{" "}
							<code className="bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded font-bold">
								विजया एकादशी व्रत
							</code>
							)
						</li>
						<li>
							<b>क्या एकादशी व्रत है (Tick Box):</b> अगर यह एकादशी है, तो सबसे नीचे
							बॉक्स पर{" "}
							<b className="text-blue-600 dark:text-blue-400 font-bold">
								ज़रूर टिक (✔) करें
							</b>
							।
							<br />
							<i className="text-xs opacity-80">
								(इसी टिक के आधार पर ऐप समझता है कि यह एकादशी है और एक दिन पहले (शाम
								4 बजे) तथा व्रत वाले दिन (सुबह 4 बजे) ऑटोमेटिक 🔴 लाल अलर्ट नोटिफिकेशन
								भेजता है। टिक नहीं करेंगे तो वह नॉर्मल उत्सव माना जाएगा और सुबह 6 बजे
								जाएगा।)
							</i>
						</li>
					</ul>
				</div>

				<div className="space-y-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
							{t.title}
						</label>
						<input
							className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
							value={draft.title}
							onChange={(e) => setDraft({ ...draft, title: e.target.value })}
							placeholder={t.title}
						/>
					</div>

					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
							{t.date}
						</label>
						<input
							type="date"
							className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
							value={formatForDateInput(draft.date) || ""}
							onChange={(e) => setDraft({ ...draft, date: e.target.value })}
						/>
					</div>

					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
							{t.breakTime}
						</label>
						<input
							className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
							value={draft.breakTime || draft.time || ""}
							onChange={(e) =>
								setDraft({
									...draft,
									breakTime: e.target.value,
									time: e.target.value,
								})
							}
							placeholder="e.g. 4:30 PM"
						/>
					</div>

					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
							{t.eventTime}
						</label>
						<input
							className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
							value={draft.eventTime || ""}
							onChange={(e) =>
								setDraft({ ...draft, eventTime: e.target.value })
							}
							placeholder="e.g. 10:00 AM"
						/>
					</div>

					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
							{t.location}
						</label>
						<input
							className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
							value={draft.location || ""}
							onChange={(e) => setDraft({ ...draft, location: e.target.value })}
							placeholder="City / Venue"
						/>
					</div>

					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
							{t.eventType}
						</label>
						<select
							className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
							value={draft.type || "other"}
							onChange={(e) =>
								setDraft({ ...draft, type: e.target.value as any })
							}
						>
							<option value="other">{isHindi ? "अन्य" : "Other"}</option>
							<option value="festival">{isHindi ? "उत्सव" : "Festival"}</option>
							<option value="ekadashi">
								{isHindi ? "एकादशी" : "Ekadashi"}
							</option>
							<option value="appearance">
								{isHindi ? "आविर्भाव" : "Appearance"}
							</option>
							<option value="disappearance">
								{isHindi ? "तिरोभाव" : "Disappearance"}
							</option>
						</select>
					</div>

					<div className="flex items-center gap-3">
						<input
							type="checkbox"
							id="isEkadashi"
							className="w-5 h-5 rounded border-slate-300 dark:border-ink-700 text-blue-600 focus:ring-blue-500"
							checked={draft.isEkadashi || false}
							onChange={(e) =>
								setDraft({ ...draft, isEkadashi: e.target.checked })
							}
						/>
						<label
							htmlFor="isEkadashi"
							className="text-sm font-bold text-slate-700 dark:text-slate-300"
						>
							{t.isEkadashi}
						</label>
					</div>

					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
							{t.description}
						</label>
						<textarea
							className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 h-24"
							value={draft.description}
							onChange={(e) =>
								setDraft({ ...draft, description: e.target.value })
							}
							placeholder={t.description}
						/>
					</div>
				</div>

				<div className="flex gap-3 pt-2">
					<button
						onClick={saveEvent}
						className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
					>
						<Save size={18} /> {t.saveEvent}
					</button>
				</div>
			</div>
		);
	}

	// --- CALENDAR VIEW ---
	return (
		<div className="h-full flex flex-col lg:flex-row gap-6 p-4 overflow-y-auto">
			{/* LEFT: Calendar Grid */}
			<div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col min-h-[550px]">
				{/* Header */}
				<div className="p-4 md:p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
					<button
						onClick={prevMonth}
						className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-300 transition-all"
					>
						<ChevronLeft size={20} />
					</button>

					<div className="flex flex-col items-center">
						<span className="text-lg font-bold text-slate-800 dark:text-white capitalize">
							{format(currentMonth, "MMMM")}
						</span>
						<span className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase tracking-widest">
							{format(currentMonth, "yyyy")}
						</span>
					</div>

					<div className="flex gap-2">
						<button
							onClick={jumpToToday}
							className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-saffron-600 dark:text-saffron-400 transition-all bg-saffron-50 dark:bg-slate-800"
							title="Today"
						>
							<RotateCcw size={18} />
						</button>
						<button
							onClick={nextMonth}
							className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-300 transition-all"
						>
							<ChevronRight size={20} />
						</button>
					</div>
				</div>

				{/* Week Headers */}
				<div className="grid grid-cols-7 gap-1 px-4 md:px-8 py-4 bg-white dark:bg-slate-900">
					{weekDays.map((day) => (
						<div
							key={day}
							className="text-center text-xs font-bold text-slate-400 dark:text-ink-400 uppercase tracking-wider"
						>
							{day}
						</div>
					))}
				</div>

				{/* Grid */}
				<div className="flex-1 px-4 md:px-8 pb-8 overflow-y-auto">
					<div className="grid grid-cols-7 gap-1 h-full auto-rows-fr">
						{calendarDays.map((day) => {
							const dayEvents = getEventsForDay(day);
							const isSelected = isSameDay(day, selectedDate);
							const isCurrentMonth = isSameMonth(day, currentMonth);
							const isTodayDate = isToday(day);
							const hasEkadashi = dayEvents.some((e) => e.isEkadashi);
							const hasFestival = dayEvents.some((e) => e.type === "festival");
							const isMultiple = dayEvents.length > 1;
							const hasEvent = dayEvents.length > 0;

							let baseClass =
								"text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800";

							if (hasEvent) {
								if (hasEkadashi)
									baseClass = "bg-red-500 text-white font-bold shadow-sm";
								else if (hasFestival)
									baseClass =
										"bg-green-600 text-white font-bold animate-glow ring-1 ring-green-400";
								else if (isMultiple)
									baseClass = "bg-purple-500 text-white font-bold shadow-sm";
								else baseClass = "bg-blue-500 text-white font-bold shadow-sm";

								if (isSelected) {
									baseClass +=
										" scale-110 z-10 ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-900";
								}
							} else if (isSelected) {
								baseClass =
									"bg-slate-700 text-white shadow-md scale-110 font-bold z-10";
							} else if (isTodayDate) {
								baseClass = "bg-slate-500 text-white font-bold shadow-sm";
							}

							return (
								<div
									key={day.toISOString()}
									onClick={() => setSelectedDate(day)}
									className="aspect-square flex items-center justify-center cursor-pointer"
								>
									<div
										className={`
                                        w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-12 lg:h-12
                                        rounded-full flex items-center justify-center transition-all duration-200
                                        ${baseClass}
                                        ${!isSelected && isTodayDate && hasEvent ? "ring-2 ring-slate-500" : ""}
                                        ${!isCurrentMonth ? "opacity-30 grayscale" : ""}
                                    `}
									>
										<span className="text-sm md:text-base">
											{format(day, "d")}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Legend */}
				<div className="px-4 md:px-8 pb-6 border-t border-slate-50 dark:border-slate-800 pt-4">
					<div className="flex flex-wrap items-center justify-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
						<div className="flex items-center gap-1">
							<div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
							<span>{t.event}</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-2.5 h-2.5 rounded-full bg-green-600 animate-glow"></div>
							<span>{t.festival}</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
							<span>{t.multiple}</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
							<span>{t.ekadashi}</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
							<span>{t.today}</span>
						</div>
					</div>
				</div>
			</div>

			{/* RIGHT: Details Panel */}
			<div className="lg:w-80 flex-shrink-0 flex flex-col gap-4 overflow-hidden">
				{/* Selected Day Info */}
				<div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex-1 overflow-y-auto">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h3 className="font-serif font-bold text-slate-800 dark:text-white text-xl capitalize">
								{format(selectedDate, "d MMMM")}
							</h3>
							<p className="text-slate-400 dark:text-ink-400 font-medium text-xs capitalize">
								{format(selectedDate, "EEEE, yyyy")}
							</p>
						</div>
						<button
							onClick={() => startEdit()}
							className="bg-blue-600 text-white p-2 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
							title="Add Event on this day"
						>
							<Plus size={18} />
						</button>
					</div>

					{/* Fasting Info */}
					{selectedDayEvents.some((e) => e.isEkadashi) && (
						<div className="mb-4">
							<div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl p-3 flex items-center gap-3">
								<div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-800 flex items-center justify-center text-orange-600 dark:text-orange-300 shrink-0">
									<Heart size={16} fill="currentColor" />
								</div>
								<div>
									<p className="text-orange-800 dark:text-orange-200 font-bold text-xs uppercase tracking-wider">
										{t.fast}
									</p>
								</div>
							</div>
						</div>
					)}

					<h4 className="font-bold text-slate-400 dark:text-ink-400 text-xs uppercase tracking-widest mb-3">
						{t.eventsText}
					</h4>
					<div className="space-y-3">
						{selectedDayEvents.length > 0 ? (
							selectedDayEvents.map((event, idx) => (
								<div
									key={`${event.id}-${idx}`}
									className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3 rounded-xl shadow-sm group"
								>
									<div className="flex justify-between items-start mb-2">
										<div>
											<span className="text-slate-800 dark:text-white font-bold text-sm block">
												{event.title}
											</span>
											<span className="text-[10px] text-saffron-500 font-bold uppercase tracking-wide">
												{event.type}
											</span>
										</div>
										<div className="flex gap-1">
											<button
												onClick={() => startEdit(event)}
												className="p-1.5 bg-white dark:bg-slate-800 rounded-md text-blue-600 border border-slate-200 dark:border-slate-700 hover:bg-blue-50"
											>
												<Edit2 size={14} />
											</button>
											<DeleteWithConfirm
												onDelete={() => deleteEvent(event.id)}
											/>
										</div>
									</div>
									{event.description && (
										<p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
											{event.description}
										</p>
									)}
								</div>
							))
						) : (
							<div className="text-center py-8 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
								<p className="text-slate-400 dark:text-ink-400 text-sm">
									{t.noEvents}
								</p>
								<button
									onClick={() => startEdit()}
									className="text-blue-600 text-xs font-bold mt-2 hover:underline"
								>
									{t.addEvent}
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Restore Deleted */}
				{deletedStack.length > 0 && (
					<button
						onClick={restoreLastDeleted}
						className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm border border-slate-200 dark:border-slate-600 w-full"
					>
						<RotateCcw size={16} /> {t.restore}
					</button>
				)}
			</div>
		</div>
	);
};

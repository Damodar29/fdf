import { Check, ChevronDown } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

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

const CustomSelect: React.FC<CustomSelectProps> = ({
	value,
	onChange,
	options,
	placeholder,
	disabled,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			// For mobile
			document.addEventListener("touchstart", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("touchstart", handleClickOutside);
		};
	}, [isOpen]);

	const selectedOption = options.find((o) => o.value === value);

	return (
		<div className="relative flex-1" ref={containerRef}>
			<button
				type="button"
				disabled={disabled}
				onClick={() => setIsOpen(!isOpen)}
				className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-3.5 flex items-center justify-between outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all text-slate-800 dark:text-white text-[13px] disabled:opacity-60 disabled:cursor-not-allowed text-left"
			>
				<span
					className={selectedOption ? "" : "text-slate-400 dark:text-ink-400"}
				>
					{selectedOption ? selectedOption.label : placeholder}
				</span>
				<ChevronDown
					size={14}
					className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen && !disabled && (
				<div className="absolute z-[100] top-full mt-1.5 w-[140px] left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-2xl overflow-hidden">
					<div className="max-h-60 overflow-y-auto p-1.5 scrollbar-hide">
						{options.map((opt) => (
							<button
								key={opt.value}
								type="button"
								onClick={() => {
									onChange(opt.value);
									setIsOpen(false);
								}}
								className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] flex items-center justify-between transition-colors
                  ${
										value === opt.value
											? "bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 font-medium"
											: "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
									}
                `}
							>
								{opt.label}
								{value === opt.value && (
									<Check size={14} className="text-pink-500" />
								)}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

interface CustomDateInputProps {
	value: string; // Expected format: YYYY-MM-DD
	onChange: (val: string) => void;
	disabled?: boolean;
	isHindi?: boolean;
}

export const CustomDateInput: React.FC<CustomDateInputProps> = ({
	value,
	onChange,
	disabled,
	isHindi,
}) => {
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

	// Generate dropdown options
	const numDays = React.useMemo(() => {
		if (month && year) {
			// Month is 1-indexed string ("01" to "12"), Date constructor expects 0-indexed month,
			// BUT day 0 gives the last day of the PREVIOUS month.
			// So passing `parseInt(month)` as the month argument effectively gives the 0th day of the NEXT month,
			// which is exactly the last day of the CURRENT month.
			return new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
		}
		if (month) {
			// Default to a leap year (2024) if only month is selected, so Feb allows 29
			return new Date(2024, parseInt(month, 10), 0).getDate();
		}
		return 31;
	}, [month, year]);

	// Auto-correct day if the selected month/year has fewer days than the current day (e.g. 31 -> 30 for April)
	React.useEffect(() => {
		if (day && parseInt(day, 10) > numDays) {
			updateDate(String(numDays).padStart(2, "0"), month, year);
		}
	}, [numDays, day, month, year, updateDate]);

	const dayOptions: Option[] = Array.from({ length: numDays }, (_, i) => {
		const val = String(i + 1).padStart(2, "0");
		return { value: val, label: val };
	});

	const monthNamesEn = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const monthNamesHi = [
		"जनवरी",
		"फ़रवरी",
		"मार्च",
		"अप्रैल",
		"मई",
		"जून",
		"जुलाई",
		"अगस्त",
		"सितंबर",
		"अक्टूबर",
		"नवंबर",
		"दिसंबर",
	];

	const monthOptions: Option[] = Array.from({ length: 12 }, (_, i) => {
		const val = String(i + 1).padStart(2, "0");
		const label = isHindi ? monthNamesHi[i] : monthNamesEn[i];
		return { value: val, label: label };
	});

	const currentYear = new Date().getFullYear();
	const yearOptions: Option[] = Array.from(
		{ length: currentYear - 1920 + 1 },
		(_, i) => {
			const val = String(currentYear - i);
			return { value: val, label: val };
		},
	);

	return (
		<div className="flex gap-2 w-full">
			<CustomSelect
				value={day}
				onChange={(val) => updateDate(val, month, year)}
				options={dayOptions}
				placeholder={isHindi ? "दिन" : "Day"}
				disabled={disabled}
			/>

			<CustomSelect
				value={month}
				onChange={(val) => updateDate(day, val, year)}
				options={monthOptions}
				placeholder={isHindi ? "महीना" : "Month"}
				disabled={disabled}
			/>

			<CustomSelect
				value={year}
				onChange={(val) => updateDate(day, month, val)}
				options={yearOptions}
				placeholder={isHindi ? "साल" : "Year"}
				disabled={disabled}
			/>
		</div>
	);
};

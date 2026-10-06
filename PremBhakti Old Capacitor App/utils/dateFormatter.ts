export const formatDisplayDate = (dateStr?: string | null): string => {
	if (!dateStr) return "";
	const parts = dateStr.trim().split("-");
	if (parts.length === 3 && parts[0].length === 4) {
		// Assume YYYY-MM-DD format, convert to DD-MM-YYYY
		return `${parts[2]}-${parts[1]}-${parts[0]}`;
	}
	return dateStr;
};

/**
 * YYYY-MM-DD for the device's local calendar day.
 *
 * `date.toISOString().split("T")[0]` gives the UTC day instead, which in India
 * (UTC+5:30) is still *yesterday* until 5:30 AM — so early-morning uploads and
 * "today" defaults landed on the previous date.
 */
export const toLocalDateKey = (date: Date = new Date()): string => {
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${m}-${d}`;
};

export const formatForDateInput = (dateStr?: string | null): string => {
	if (!dateStr) return "";
	const parts = dateStr.trim().split("-");
	if (parts.length === 3 && parts[0].length === 2) {
		// Assume DD-MM-YYYY format, convert to YYYY-MM-DD
		return `${parts[2]}-${parts[1]}-${parts[0]}`;
	}
	return dateStr;
};

/**
 * Label for the date chips in the Activities / Daily Darshan date strips.
 *
 * Shows "5 Jan" for dates inside the current year and "5 Jan 2025" for any
 * other year. Without the year, the moment the app has content from more than
 * one year the strip renders two chips that look identical ("5 Jan" from 2026
 * and "5 Jan" from 2027) with nothing to tell them apart. Grouping and sorting
 * were always year-aware, so this is purely about what the user can read.
 *
 * Current-year chips are intentionally left looking exactly as they always did.
 *
 * The year is taken from the YYYY-MM-DD key itself and the Date is built from
 * local components on purpose: `new Date("2026-01-05")` is parsed as UTC
 * midnight, which formats as the *previous day* for anyone west of UTC.
 */
export const formatDateChipLabel = (
	dateKey?: string | null,
	isHindi?: boolean,
): string => {
	const key = (dateKey || "").trim();
	if (!key) return "";
	const locale = isHindi ? "hi-IN" : "en-US";

	const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key);
	if (match) {
		const year = Number(match[1]);
		const d = new Date(year, Number(match[2]) - 1, Number(match[3]));
		if (!Number.isNaN(d.getTime())) {
			const opts: Intl.DateTimeFormatOptions = {
				day: "numeric",
				month: "short",
			};
			if (year !== new Date().getFullYear()) opts.year = "numeric";
			try {
				return d.toLocaleDateString(locale, opts);
			} catch (_e) {}
		}
	}

	// Unrecognised key shape: fall back to exactly what these screens did before.
	try {
		const d = new Date(key);
		if (!Number.isNaN(d.getTime())) {
			return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
		}
	} catch (_e) {}
	return key;
};

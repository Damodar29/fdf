/**
 * Diksha dates for the anniversary card. Same rules as
 * functions/src/dikshaAnniversary.ts — `npm run test:relations` checks both.
 */

export interface DayOfYear {
	y: number;
	m: number;
	d: number;
}

/**
 * A stored diksha date as day/month/year. Profiles save "DD/MM/YYYY"; older or
 * admin-edited ones may hold "YYYY-MM-DD" or "DD-MM-YYYY". null if unreadable.
 */
export function parseDikshaDate(value: unknown): DayOfYear | null {
	if (typeof value !== "string") return null;
	const parts = value.trim().split(/[/-]/);
	if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
	const [a, b, c] = parts.map(Number);
	const [y, m, d] = parts[0].length === 4 ? [a, b, c] : [c, b, a];
	if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
	return { y, m, d };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Whole years since the diksha if today is its anniversary (1 or more), else
 * 0. A 29 February diksha is remembered on 28 February in other years.
 */
export function anniversaryYears(
	diksha: DayOfYear | null,
	today: DayOfYear,
): number {
	if (!diksha || diksha.y >= today.y) return 0;
	const sameDay = diksha.m === today.m && diksha.d === today.d;
	const leapDayMoved =
		diksha.m === 2 &&
		diksha.d === 29 &&
		today.m === 2 &&
		today.d === 28 &&
		!isLeap(today.y);
	return sameDay || leapDayMoved ? today.y - diksha.y : 0;
}

/** Today's date in India — the day the anniversary list was made for. */
export function istToday(now = Date.now()): DayOfYear & { id: string } {
	const ist = new Date(now + 5.5 * 60 * 60 * 1000);
	const y = ist.getUTCFullYear();
	const m = ist.getUTCMonth() + 1;
	const d = ist.getUTCDate();
	const pad = (n: number) => String(n).padStart(2, "0");
	return { y, m, d, id: `${y}-${pad(m)}-${pad(d)}` };
}

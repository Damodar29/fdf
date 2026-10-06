/**
 * "Is this the same person?" for family and admin tools: names typed in Hindi,
 * English or Hinglish, with titles or small typos, diksha dates in any of the
 * stored spellings, and phone numbers / emails in any format.
 *
 * nameMatchScore is the same rule as functions/src/familySearch.ts (the
 * server's "find on the app") — `npm run test:names` checks that both agree.
 */
import { soundKey, toLatin } from "./devoteeSearch";
import { parseDikshaDate } from "./dikshaDate";

const rawWords = (text: string) =>
	toLatin(text.toLowerCase())
		.replace(/[^a-z\s]/g, " ")
		.split(/\s+/)
		.filter(Boolean);

/** Titles and suffixes that say nothing about who it is. */
const IGNORED = new Set(
	[
		"shri",
		"shree",
		"sri",
		"shrimati",
		"smt",
		"sushri",
		"kumari",
		"mr",
		"mrs",
		"ms",
		"dr",
		"ji",
		"prabhuji",
		"mataji",
	].map(soundKey),
);

/** A name as sound-key words, titles left out. */
export function nameKeys(name: unknown): string[] {
	if (typeof name !== "string") return [];
	return rawWords(name)
		.map(soundKey)
		.filter((w) => w.length > 0 && !IGNORED.has(w));
}

function editDistance(a: string, b: string): number {
	const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		let diag = prev[0];
		prev[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const tmp = prev[j];
			prev[j] =
				a[i - 1] === b[j - 1] ? diag : 1 + Math.min(diag, prev[j], prev[j - 1]);
			diag = tmp;
		}
	}
	return prev[b.length];
}

/** Same word allowing a small typo; the first letter must agree. */
function sameWord(a: string, b: string): boolean {
	if (a === b) return true;
	const shorter = Math.min(a.length, b.length);
	if (shorter < 4 || a[0] !== b[0]) return false;
	const allowed = shorter >= 8 ? 2 : 1;
	if (Math.abs(a.length - b.length) > allowed) return false;
	return editDistance(a, b) <= allowed;
}

/**
 * How well two typed names fit (0 = not the same person): 100 whole name,
 * 90 same words, 80 every word of the shorter name is in the longer
 * ("Rahul Sharma" / "Rahul Kumar Sharma"), 50 same first name only.
 */
export function nameMatchScore(a: unknown, b: unknown): number {
	const wa = nameKeys(a);
	const wb = nameKeys(b);
	if (wa.length === 0 || wb.length === 0) return 0;
	if (sameWord(wa.join(""), wb.join(""))) return 100;
	const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
	if (short.every((w) => long.some((x) => sameWord(w, x))))
		return short.length === long.length ? 90 : 80;
	if (sameWord(wa[0], wb[0])) return 50;
	return 0;
}

/** First sound-key word of a name ("" if none) — for grouping before comparing. */
export const firstNameKey = (name: unknown): string => nameKeys(name)[0] || "";

/** A diksha date as "YYYY-MM-DD", whatever spelling it was saved in; "" if unreadable. */
export function dateKey(value: unknown): string {
	const d = parseDikshaDate(value);
	if (!d) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
}

/**
 * Two diksha dates: "same", "different" (both readable and not equal) or
 * "unknown" (one or both missing / unreadable).
 */
export function compareDates(
	a: unknown,
	b: unknown,
): "same" | "different" | "unknown" {
	const x = dateKey(a);
	const y = dateKey(b);
	if (!x || !y) return "unknown";
	return x === y ? "same" : "different";
}

/** Last 10 digits of an Indian phone number, or "" if it isn't one. */
export function phoneKey(value: unknown): string {
	if (typeof value !== "string") return "";
	const digits = value.replace(/\D/g, "");
	if (digits.length < 10) return "";
	const last10 = digits.slice(-10);
	return /^0+$/.test(last10) ? "" : last10;
}

/** An email for comparing ("" if it isn't one). */
export function emailKey(value: unknown): string {
	if (typeof value !== "string") return "";
	const e = value.trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}

/**
 * Same person, by name (real or diksha) and diksha date: a strong name match,
 * or the same diksha name on the same date; never when the dates differ.
 */
export function samePerson(
	a: { realName?: string; dikshaName?: string; dikshaDate?: string },
	b: { realName?: string; dikshaName?: string; dikshaDate?: string },
	minScore = 90,
): boolean {
	const dates = compareDates(a.dikshaDate, b.dikshaDate);
	if (dates === "different") return false;
	if (nameMatchScore(a.realName, b.realName) >= minScore) return true;
	return (
		dates === "same" &&
		!!a.dikshaName &&
		!!b.dikshaName &&
		nameMatchScore(a.dikshaName, b.dikshaName) >= 90
	);
}

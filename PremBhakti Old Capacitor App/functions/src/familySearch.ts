/**
 * Matching for "find on the app" (searchDevoteesForFamilyLink): the same
 * devotee is often typed differently on the two sides — Hindi vs English
 * ("विशाखा" / "Vishakha"), Hinglish spellings ("Shrivastava" / "Srivastav"),
 * small typos ("Vishaka") or with titles ("Shri", "ji"). Names are reduced to
 * a plain sound key before comparing.
 *
 * The Devanagari → Latin step follows transliterateForSearch + smartNormalize
 * in utils/textProcessor.ts (the app's bhajan search). Kept separate: the
 * functions package cannot import app code, and this key is never stored, so
 * it may change freely. `npm run test:names` checks it.
 */

const DEVANAGARI: Record<string, string> = {
	अ: "a",
	आ: "a",
	इ: "i",
	ई: "i",
	उ: "u",
	ऊ: "u",
	ऋ: "ri",
	ए: "e",
	ऐ: "ai",
	ओ: "o",
	औ: "au",
	क: "k",
	ख: "kh",
	ग: "g",
	घ: "gh",
	ङ: "n",
	च: "ch",
	छ: "chh",
	ज: "j",
	झ: "jh",
	ञ: "n",
	ट: "t",
	ठ: "th",
	ड: "d",
	ढ: "dh",
	ण: "n",
	त: "t",
	थ: "th",
	द: "d",
	ध: "dh",
	न: "n",
	प: "p",
	फ: "ph",
	ब: "b",
	भ: "bh",
	म: "m",
	य: "y",
	र: "r",
	ल: "l",
	व: "v",
	श: "sh",
	ष: "sh",
	स: "s",
	ह: "h",
	"ा": "a",
	"ि": "i",
	"ी": "i",
	"ु": "u",
	"ू": "u",
	"ृ": "ri",
	"े": "e",
	"ै": "ai",
	"ो": "o",
	"ौ": "au",
	"ं": "n",
	"ः": "h",
	"ँ": "n",
	"्": "",
	"़": "",
};

const isConsonant = (c: string) => {
	const code = c.charCodeAt(0);
	return (code >= 0x0915 && code <= 0x0939) || (code >= 0x0958 && code <= 0x095f);
};
const isSignOrVirama = (c: string) => {
	const code = c.charCodeAt(0);
	return (code >= 0x093e && code <= 0x094d) || code === 0x0962 || code === 0x0963;
};

/** Devanagari letters to plain Latin; other characters unchanged. */
function toLatin(text: string): string {
	// Nukta letters (क़, ज़, फ़ …) as base letter + nukta, so the map finds them.
	const chars = Array.from(text.normalize("NFD"));
	let out = "";
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i];
		const mapped = DEVANAGARI[c];
		if (mapped === undefined) {
			out += c;
			continue;
		}
		out += mapped;
		if (isConsonant(c)) {
			let next = chars[i + 1];
			if (next === "़") next = chars[i + 2]; // skip the nukta
			// Inherent "a" (राम → rama); a trailing one is dropped below.
			if (next === undefined || !isSignOrVirama(next)) out += "a";
		}
	}
	return out;
}

/** One word as a sound key: "Shrivastava", "Srivastav", "श्रीवास्तव" → same. */
function wordKey(word: string): string {
	return (
		word
			.replace(/aa/g, "a")
			.replace(/ae/g, "e")
			.replace(/ai/g, "e")
			.replace(/ee/g, "i")
			.replace(/oo/g, "u")
			.replace(/au/g, "o")
			.replace(/ou/g, "o")
			.replace(/[vw]/g, "b")
			.replace(/sh/g, "s")
			.replace(/z/g, "j")
			.replace(/ph/g, "f")
			.replace(/q/g, "k")
			.replace(/x/g, "ks")
			.replace(/y/g, "i")
			.replace(/ri/g, "r")
			.replace(/ru/g, "r")
			// Aspirates are written with and without "h" (Shobha / Sobha / Soba).
			.replace(/([kgcjtdpb])h/g, "$1")
			.replace(/([a-z])\1+/g, "$1")
			.replace(/a$/, "")
	);
}

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
	].map(wordKey),
);

/** A name as sound-key words, titles left out. */
export function nameKeys(name: unknown): string[] {
	if (typeof name !== "string") return [];
	return rawWords(name)
		.map(wordKey)
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

/**
 * Same word allowing a small typo: 1 letter off from 4 letters, 2 from 8.
 * The first letter must agree — "Mohan" and "Sohan" are different people.
 */
function sameWord(a: string, b: string): boolean {
	if (a === b) return true;
	const shorter = Math.min(a.length, b.length);
	if (shorter < 4 || a[0] !== b[0]) return false;
	const allowed = shorter >= 8 ? 2 : 1;
	if (Math.abs(a.length - b.length) > allowed) return false;
	return editDistance(a, b) <= allowed;
}

/**
 * How well two typed names fit (0 = not the same person):
 * 100 whole name, 80 every word of the shorter name is in the longer
 * ("Rahul Sharma" / "Rahul Kumar Sharma"), 50 same first name.
 */
export function nameMatchScore(a: unknown, b: unknown): number {
	const wa = nameKeys(a);
	const wb = nameKeys(b);
	if (wa.length === 0 || wb.length === 0) return 0;
	// Written joined or apart: "Adwaitdas" / "Advait Das".
	if (sameWord(wa.join(""), wb.join(""))) return 100;
	const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
	if (short.every((w) => long.some((x) => sameWord(w, x))))
		return short.length === long.length ? 90 : 80;
	if (sameWord(wa[0], wb[0])) return 50;
	return 0;
}

/**
 * Every usual way one diksha date is stored ("05/03/2010", "5/3/2010",
 * "2010-03-05", "05-03-2010" …) for a Firestore `in` query. Profiles save
 * "DD/MM/YYYY"; older or admin-edited ones differ. Same day/month/year rules
 * as parseDikshaDate. An unreadable date is searched as typed.
 */
export function dikshaDateVariants(value: unknown): string[] {
	if (typeof value !== "string" || !value.trim()) return [];
	const typed = value.trim();
	const parts = typed.split(/[/.-]/);
	if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return [typed];
	const [a, b, c] = parts.map(Number);
	const [y, m, d] = parts[0].length === 4 ? [a, b, c] : [c, b, a];
	if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return [typed];
	const pad = (n: number) => String(n).padStart(2, "0");
	const out = new Set<string>([typed]);
	for (const dd of [pad(d), String(d)])
		for (const mm of [pad(m), String(m)])
			for (const sep of ["/", "-"]) {
				out.add(`${dd}${sep}${mm}${sep}${y}`);
				out.add(`${y}${sep}${mm}${sep}${dd}`);
			}
	return Array.from(out).slice(0, 30); // Firestore `in` limit
}

/** An email as it should be looked up, or "" if it is not one. */
export function cleanEmail(value: unknown): string {
	if (typeof value !== "string") return "";
	const email = value.trim().toLowerCase();
	return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
		? email
		: "";
}

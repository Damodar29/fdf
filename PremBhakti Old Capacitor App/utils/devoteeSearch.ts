/**
 * Devotee search for the admin lists (Devotee Management, Family Explorer,
 * force-link): Hindi, English and Hinglish all find each other — "vishakha",
 * "Vishaka", "विशाखा" and "vish" find विशाखा, "shrivastav" finds
 * "Srivastava". Phone numbers match on digits, emails as typed.
 *
 * Names become plain sound keys, the same way as "find on the app"
 * (functions/src/familySearch.ts, nameKeys). This copy adds prefix matching
 * so results show while typing. The keys are never stored, so they may change
 * freely. `npm run test:devotees` checks it.
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
	return (
		(code >= 0x0915 && code <= 0x0939) || (code >= 0x0958 && code <= 0x095f)
	);
};
const isSignOrVirama = (c: string) => {
	const code = c.charCodeAt(0);
	return (
		(code >= 0x093e && code <= 0x094d) || code === 0x0962 || code === 0x0963
	);
};

/** Devanagari letters to plain Latin; other characters unchanged. */
export function toLatin(text: string): string {
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
			if (next === "़") next = chars[i + 2];
			if (next === undefined || !isSignOrVirama(next)) out += "a";
		}
	}
	return out;
}

/** One word as a sound key: "Shrivastava", "Srivastav", "श्रीवास्तव" → same. */
export function soundKey(word: string): string {
	return word
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
		.replace(/([kgcjtdpb])h/g, "$1")
		.replace(/([a-z])\1+/g, "$1")
		.replace(/a$/, "");
}

/** Lower-case Latin words of any text (Hindi is transliterated first). */
const latinWords = (text: string) =>
	toLatin(text.toLowerCase())
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter(Boolean);

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

/** Small typo allowed from 4 letters on; the first letter must agree. */
function nearlySame(word: string, q: string): boolean {
	if (q.length < 4 || word[0] !== q[0]) return false;
	const allowed = q.length >= 7 ? 2 : 1;
	// Typing is often unfinished: compare against the word's start too.
	const head = word.slice(0, q.length);
	if (editDistance(head, q) <= allowed) return true;
	if (Math.abs(word.length - q.length) > allowed) return false;
	return editDistance(word, q) <= allowed;
}

/** What one devotee (or row) can be found by. Build once per profile. */
export interface DevoteeSearchEntry {
	/** Sound keys of every word of every name field. */
	keys: string[];
	/** Lower-case text of every field (plus its Latin form), for plain substring hits. */
	raw: string;
	/** Digits of the phone numbers. */
	digits: string[];
}

/**
 * Index one devotee. `names` are matched by sound (names, diksha names,
 * mandal, relation…); `plain` only as typed (email, ids); `phones` by digits.
 */
export function buildSearchEntry(
	names: (string | undefined | null)[],
	plain: (string | undefined | null)[] = [],
	phones: (string | undefined | null)[] = [],
): DevoteeSearchEntry {
	const keys = new Set<string>();
	const rawParts: string[] = [];
	for (const n of names) {
		if (!n) continue;
		rawParts.push(n.toLowerCase(), toLatin(n.toLowerCase()));
		const words = latinWords(n);
		for (const w of words) {
			const k = soundKey(w);
			if (k) keys.add(k);
		}
		// Joined too: "Advait Das" is found by "advaitdas".
		if (words.length > 1) keys.add(soundKey(words.join("")));
	}
	for (const p of plain) if (p) rawParts.push(p.toLowerCase());
	return {
		keys: [...keys],
		raw: rawParts.join(" | "),
		digits: phones
			.map((p) => (p || "").replace(/\D/g, ""))
			.filter((d) => d.length > 0),
	};
}

export interface PreparedDevoteeQuery {
	/** Trimmed, lower-case query ("" = match everything). */
	text: string;
	/** Digits of the query when it looks like a phone number. */
	digits: string;
	/** Sound key of each query word. */
	words: string[];
	/** The words joined ("radhe shyam" → one key, finds "राधेश्याम"). */
	joined: string;
}

export function prepareDevoteeQuery(query: string): PreparedDevoteeQuery {
	const text = query.trim().toLowerCase();
	const digits = text.replace(/\D/g, "");
	const looksLikePhone = digits.length >= 3 && /^[\d\s+()-]+$/.test(text);
	const latin = looksLikePhone ? [] : latinWords(text);
	return {
		text,
		digits: looksLikePhone ? digits : "",
		words: latin.map(soundKey).filter((w) => w.length > 0),
		joined: latin.length > 1 ? soundKey(latin.join("")) : "",
	};
}

/** Best fit of one query key among a devotee's keys: 3 word, 2 start, 1 typo. */
const bestFit = (keys: string[], w: string) => {
	let best = 0;
	for (const k of keys) {
		if (k === w) return 3;
		if (k.startsWith(w)) best = Math.max(best, 2);
		else if (best < 1 && nearlySame(k, w)) best = 1;
	}
	return best;
};

/**
 * How well a devotee fits the query: 0 = no match, higher = better. Every
 * query word must fit some word of the devotee (whole word > start of a word >
 * small typo), so "ram sharma" does not find every Ram.
 */
export function scoreDevotee(
	entry: DevoteeSearchEntry,
	q: PreparedDevoteeQuery,
): number {
	if (!q.text) return 1;
	if (q.digits) {
		// Phone: last digits typed with or without the country code.
		const d = q.digits.replace(/^0+/, "");
		return entry.digits.some((p) => p.includes(d)) ? 500 : 0;
	}
	const substring = entry.raw.includes(q.text) ? 200 : 0;
	if (q.words.length === 0) return substring;
	let sum = 0;
	for (const w of q.words) {
		const best = bestFit(entry.keys, w);
		if (!best) {
			sum = -1;
			break;
		}
		sum += best;
	}
	if (sum < 0) {
		// Written apart in the query, joined in the name.
		// Exact or start only: a typo across a whole name is too loose.
		const joined = q.joined ? bestFit(entry.keys, q.joined) : 0;
		return joined >= 2 ? Math.max(substring, 100 + joined * 10) : substring;
	}
	return Math.max(substring, 100 + sum * 10);
}

/** One-off convenience: does this text list match the query? */
export function devoteeMatches(
	query: string,
	names: (string | undefined | null)[],
	plain: (string | undefined | null)[] = [],
	phones: (string | undefined | null)[] = [],
): boolean {
	const q = prepareDevoteeQuery(query);
	if (!q.text) return true;
	return scoreDevotee(buildSearchEntry(names, plain, phones), q) > 0;
}

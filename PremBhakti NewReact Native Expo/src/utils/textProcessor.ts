import { KNOWN_AUTHORS } from "../data/authors";
import type { RawBhajanEntry } from "../data/bhajansData";
import type { Bhajan, Book, LectureData, ScriptType } from "../types";

// ----------------------------------------------------------------------
// 1. Search Normalization Maps (Devanagari -> Plain English)
// ----------------------------------------------------------------------

// Map for Devanagari to Plain Latin (for fuzzy search index)
const devanagariSearchMap: Record<string, string> = {
	// Vowels
	अ: "a",
	आ: "a",
	इ: "i",
	ई: "i",
	उ: "u",
	ऊ: "u",
	ऋ: "ri",
	ए: "ae",
	ऐ: "ae",
	ओ: "o",
	औ: "au",
	अं: "n",
	अः: "h",
	// Consonants
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
	क्ष: "ksh",
	त्र: "tr",
	ज्ञ: "gy",
	श्र: "shr",
	// Matras
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
	// Modifiers
	"्": "",
	"़": "",
	"ँ": "n",
};

// Map for IAST to Plain Latin (Normalization for search input)
const iastNormalizationMap: Record<string, string> = {
	ā: "a",
	Ā: "a",
	ī: "i",
	Ī: "i",
	ū: "u",
	Ū: "u",
	ṛ: "ri",
	Ṛ: "ri",
	ṝ: "ri",
	Ṝ: "ri",
	ḹ: "l",
	Ḹ: "l",
	ḷ: "l",
	Ḷ: "l",
	e: "e",
	E: "e",
	ai: "ai",
	Ai: "ai",
	o: "o",
	O: "o",
	au: "au",
	Au: "au",
	ś: "sh",
	Ś: "sh",
	ṣ: "sh",
	Ṣ: "sh",
	ñ: "n",
	Ñ: "n",
	ṅ: "n",
	Ṅ: "n",
	ṇ: "n",
	Ṇ: "n",
	ṭ: "t",
	Ṭ: "t",
	ṭh: "th",
	Ṭh: "th",
	ḍ: "d",
	Ḍ: "d",
	ḍh: "dh",
	Ḍh: "dh",
	ṃ: "m",
	Ṃ: "m",
	ḥ: "h",
	Ḥ: "h",
	c: "ch",
	C: "ch",
};

// ----------------------------------------------------------------------
// 2. Display Transliteration Maps (Devanagari -> Full IAST)
// ----------------------------------------------------------------------

const devanagariDisplayMap: Record<string, string> = {
	// Vowels
	अ: "a",
	आ: "ā",
	इ: "i",
	ई: "ī",
	उ: "u",
	ऊ: "ū",
	ऋ: "ṛ",
	ए: "e",
	ऐ: "ai",
	ओ: "o",
	औ: "au",
	अं: "ṃ",
	अः: "ḥ",
	// Consonants
	क: "k",
	ख: "kh",
	ग: "g",
	घ: "gh",
	ङ: "ṅ",
	च: "c",
	छ: "ch",
	ज: "j",
	झ: "jh",
	ञ: "ñ",
	ट: "t",
	ठ: "ṭh",
	ड: "ḍ",
	ढ: "ḍh",
	ण: "ṇ",
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
	श: "ś",
	ष: "ṣ",
	स: "s",
	ह: "h",
	क्ष: "kṣ",
	त्र: "tr",
	ज्ञ: "jñ",
	श्र: "śr",
	// Matras
	"ा": "ā",
	"ि": "i",
	"ी": "ī",
	"ु": "u",
	"ू": "ū",
	"ृ": "ṛ",
	"े": "e",
	"ै": "ai",
	"ो": "o",
	"ौ": "au",
	"ं": "ṃ",
	"ः": "ḥ",
	// Modifiers
	"्": "",
	"़": "",
	"ँ": "m̐",
	ऽ: "'",
};

// ----------------------------------------------------------------------
// 3. Helper Functions
// ----------------------------------------------------------------------

const isConsonant = (char: string) => {
	const code = char.charCodeAt(0);
	return (
		(code >= 0x0915 && code <= 0x0939) || (code >= 0x0958 && code <= 0x095f)
	);
};

const isVowelSignOrVirama = (char: string) => {
	const code = char.charCodeAt(0);
	return (
		(code >= 0x093e && code <= 0x094d) || code === 0x0962 || code === 0x0963
	);
};

export const smartNormalize = (text: string) => {
	return (
		text
			.toLowerCase()
			// Vowels - Hinglish Standardization
			.replace(/aa/g, "a")
			.replace(/ae/g, "e") // Aese -> Ese
			.replace(/ai/g, "e") // Aisi -> Esi
			.replace(/ee/g, "i")
			.replace(/oo/g, "u")
			.replace(/au/g, "o") // Aur -> Or
			.replace(/ou/g, "o") // Koun -> Kon
			// Consonants - Common Substitutions
			.replace(/[vw]/g, "b")
			.replace(/sh/g, "s")
			.replace(/z/g, "j")
			.replace(/ph/g, "f")
			.replace(/ri/g, "r")
			.replace(/ru/g, "r")
			.replace(/([a-z])\1/g, "$1") // Remove double letters (tt -> t)
			.replace(/a$/, "") // Remove trailing 'a' (Ram -> Rama handling)
			.replace(/\s+/g, " ")
			.trim()
	);
};

const normalizeNumericKey = (value?: string): string => {
	const digits = String(value || "").replace(/\D/g, "");
	if (!digits) return "";
	return String(parseInt(digits, 10));
};

const getEditDistance = (a: string, b: string): number => {
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	// Optimization: If length difference is too big, don't bother
	if (Math.abs(a.length - b.length) > 2) return 100;

	const matrix = [];
	for (let i = 0; i <= b.length; i++) matrix[i] = [i];
	for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
				);
			}
		}
	}
	return matrix[b.length][a.length];
};

export const isFuzzyMatch = (normToken: string, normQuery: string): boolean => {
	if (normToken.includes(normQuery)) return true;
	if (normQuery.length >= 3) {
		const allowedErrors = normQuery.length > 5 ? 2 : 1;
		if (Math.abs(normToken.length - normQuery.length) <= allowedErrors) {
			const dist = getEditDistance(normToken, normQuery);
			if (dist <= allowedErrors) return true;
		}
		// Check start matching for prefix search
		if (normToken.length > normQuery.length) {
			const p1 = normToken.substring(0, normQuery.length);
			if (getEditDistance(p1, normQuery) <= allowedErrors) return true;
		}
	}
	return false;
};

// ----------------------------------------------------------------------
// 4. Exported Functions
// ----------------------------------------------------------------------

export const transliterateForSearch = (text: string): string => {
	let result = "";
	const chars = text.split("");

	for (let i = 0; i < chars.length; i++) {
		const char = chars[i];
		const devaMapped = devanagariSearchMap[char];
		if (devaMapped !== undefined) {
			result += devaMapped;
			if (isConsonant(char)) {
				if (i + 1 < chars.length) {
					const nextChar = chars[i + 1];
					if (!isVowelSignOrVirama(nextChar)) {
						result += "a";
					}
				} else {
					result += "a";
				}
			}
		} else if (iastNormalizationMap[char] !== undefined) {
			result += iastNormalizationMap[char];
		} else {
			result += char;
		}
	}
	return result;
};

export const convertToIAST = (text: string): string => {
	let result = "";
	const chars = text.split("");

	for (let i = 0; i < chars.length; i++) {
		const char = chars[i];
		const mapped = devanagariDisplayMap[char];
		if (mapped !== undefined) {
			result += mapped;
			if (isConsonant(char)) {
				if (i + 1 < chars.length) {
					const nextChar = chars[i + 1];
					if (!isVowelSignOrVirama(nextChar)) {
						result += "a";
					}
				} else {
					result += "a";
				}
			}
		} else {
			result += char;
		}
	}
	return result;
};

// The line shown under a bhajan's title in lists. A "#…#" subheading (e.g.
// #टेर#) is not part of the lyrics, so when the stored first line is one, the
// first real line of the content is shown instead.
export const getListFirstLine = (firstLine = "", content = ""): string => {
	const stored = firstLine.trim();
	if (!stored.startsWith("#")) return firstLine;
	const realLine = content
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line && !line.startsWith("#"));
	return realLine ?? stored.replace(/#/g, "").trim();
};

// Helper: Get Base Devanagari Character for Indexing
export const getDevanagariBaseChar = (text: string): string => {
	if (!text) return "#";
	for (let i = 0; i < text.length; i++) {
		const char = text.charAt(i);
		const code = char.charCodeAt(0);
		if (code >= 0x0900 && code <= 0x097f) {
			if (code >= 0x0966 && code <= 0x096f) continue;
			if (isVowelSignOrVirama(char)) continue;
			return char;
		}
		if (/[a-zA-Z]/.test(char)) {
			return char.toUpperCase();
		}
	}
	return "#";
};

// Keys sorted by length descending to ensure longer specific names match before shorter ones
const knownAuthorKeys = Object.keys(KNOWN_AUTHORS).sort(
	(a, b) => b.length - a.length,
);

// Heuristic to extract author
const _extractAuthor = (
	content: string,
): { deva: string; iast: string } | undefined => {
	const lines = content
		.trim()
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	// Checking last 6 lines to ensure we catch authors in longer concluding stanzas
	// (Previously was 2, which missed cases like Bhajan 216 where author is in line n-2)
	const lastLines = lines.slice(-6).join(" ");

	// Improved Regex to capture single quotes around words in last lines
	// Matches 'Word' or ‘Word’ or "Word"
	const quoteMatch = lastLines.match(/['"‘’]([^'"‘’]+)['"‘’]/);

	if (quoteMatch) {
		let rawName = quoteMatch[1].trim();
		rawName = rawName.replace(/[\u200B-\u200D\uFEFF]/g, "");

		for (const key of knownAuthorKeys) {
			if (rawName.includes(key)) {
				return KNOWN_AUTHORS[key];
			}
		}
		// Return extracted name even if not in known list
		return { deva: rawName, iast: convertToIAST(rawName) };
	}

	for (const key of knownAuthorKeys) {
		if (lastLines.includes(key)) {
			return KNOWN_AUTHORS[key];
		}
	}

	return undefined;
};

// ----------------------------------------------------------------------
// Advanced Search Logic: Scoring and Snippets
// ----------------------------------------------------------------------

/** Plain text → the phonetic form the search compares (Devanagari, IAST and
 * Hinglish all end up alike: "मौसी", "mausi", "mousi" → "mosi"). */
export const normalizeForSearch = (text: string): string =>
	smartNormalize(transliterateForSearch(text.toLowerCase()));

export interface PreparedSearchQuery {
	trimmed: string;
	/** Lower-cased as typed. */
	raw: string;
	/** Whole-query phonetic forms; the first is the plain one. */
	phrases: string[];
	/** Per query word, the phonetic forms that count as a match. */
	termForms: string[][];
	number: string;
}

/**
 * The spellings a typed query is also tried as — only ever adding matches:
 * - Hinglish writes "eh" where Devanagari has "ah" ("behen" / बहन → "bahan");
 * - Devanagari words keep their final "a" inside the index ("राम नाम" →
 *   "rama nama"), so "ram nam" is also tried as "rama nam".
 */
const queryPhrases = (normalized: string): string[] => {
	const out = [normalized];
	const add = (v: string) => {
		if (v && !out.includes(v)) out.push(v);
	};
	const withFinalA = (s: string) => {
		const words = s.split(" ");
		return words
			.map((w, i) =>
				i < words.length - 1 && /[^aeiou\d]$/.test(w) ? `${w}a` : w,
			)
			.join(" ");
	};
	const ah = normalized.replace(/eh/g, "ah");
	add(ah);
	add(withFinalA(normalized));
	add(withFinalA(ah));
	return out;
};

// The last few queries, prepared once instead of once per bhajan.
const preparedCache = new Map<string, PreparedSearchQuery>();

export const prepareSearchQuery = (query: string): PreparedSearchQuery => {
	const cached = preparedCache.get(query);
	if (cached) return cached;
	const trimmed = query.trim();
	const raw = trimmed.toLowerCase();
	const normalized = smartNormalize(transliterateForSearch(raw));
	const terms = normalized.split(/\s+/).filter((t) => t.length > 0);
	const prepared: PreparedSearchQuery = {
		trimmed,
		raw,
		phrases: queryPhrases(normalized),
		termForms: terms.map((t) => {
			const ah = t.replace(/eh/g, "ah");
			return ah === t ? [t] : [t, ah];
		}),
		number: normalizeNumericKey(trimmed),
	};
	if (preparedCache.size > 20) preparedCache.clear();
	preparedCache.set(query, prepared);
	return prepared;
};

// Per-bhajan values that don't change while typing, worked out once.
interface BhajanSearchCache {
	title?: string;
	titleNorm?: string;
	titleTokens?: string[];
	contentSource?: string;
	contentLower?: string;
}
const bhajanCache = new WeakMap<Bhajan, Record<string, BhajanSearchCache>>();

const bhajanCacheFor = (bhajan: Bhajan, script: ScriptType) => {
	let byScript = bhajanCache.get(bhajan);
	if (!byScript) {
		byScript = {};
		bhajanCache.set(bhajan, byScript);
	}
	let entry = byScript[script];
	if (!entry) {
		entry = {};
		byScript[script] = entry;
	}
	return entry;
};

export const calculateSearchScore = (
	bhajan: Bhajan,
	query: string,
	script: ScriptType,
): number => {
	if (!query || query.trim().length === 0) return 0;

	const q = prepareSearchQuery(query);
	const trimmedQuery = q.trimmed;
	const normalizedQueryNumber = q.number;
	const normalizedSongNumber = normalizeNumericKey(bhajan.songNumber);

	// 0. Exact Song Number Match (Highest Priority)
	if (bhajan.songNumber && trimmedQuery === bhajan.songNumber) {
		return 2000;
	}
	if (
		normalizedQueryNumber &&
		normalizedSongNumber &&
		normalizedQueryNumber === normalizedSongNumber
	) {
		return 2200;
	}

	const rawQuery = q.raw;
	const phrases = q.phrases;

	let score = 0;

	if (normalizedQueryNumber && normalizedSongNumber) {
		if (bhajan.songNumber?.includes(trimmedQuery)) {
			score += 900;
		}
		if (normalizedSongNumber.startsWith(normalizedQueryNumber)) {
			score += 700;
		}
	}

	// 1. Title Analysis (normalized once per bhajan, not per keystroke)
	const cache = bhajanCacheFor(bhajan, script);
	const title = script === "iast" ? bhajan.titleIAST : bhajan.title;
	if (cache.title !== title || cache.titleNorm === undefined) {
		cache.title = title;
		cache.titleNorm = smartNormalize(
			transliterateForSearch(title.toLowerCase()),
		);
		cache.titleTokens = cache.titleNorm.split(/\s+/);
	}
	const titleRaw = title.toLowerCase();
	const titleNorm = cache.titleNorm;
	const titleTokens = cache.titleTokens || [];

	// Exact Title Match
	if (titleRaw === rawQuery || phrases.some((p) => titleNorm === p)) {
		return 1000;
	}
	// Starts With Title
	if (
		titleRaw.startsWith(rawQuery) ||
		phrases.some((p) => titleNorm.startsWith(p))
	) {
		score += 500;
	}
	// Contains Title
	if (
		titleRaw.includes(rawQuery) ||
		phrases.some((p) => titleNorm.includes(p))
	) {
		score += 200;
	}
	// Fuzzy Title Words
	let titleMatches = 0;
	for (const forms of q.termForms) {
		if (titleTokens.some((tt) => forms.some((f) => isFuzzyMatch(tt, f)))) {
			titleMatches++;
		}
	}
	score += titleMatches * 50;

	// 2. Content Analysis
	const content = script === "iast" ? bhajan.contentIAST : bhajan.content;
	if (cache.contentSource !== content || cache.contentLower === undefined) {
		cache.contentSource = content;
		cache.contentLower = content.toLowerCase();
	}

	// Quick Check: Does the content or index contain the query?
	// Note: searchIndex now includes songNumber so partial number matches work too
	if (
		phrases.some((p) => bhajan.searchIndex.includes(p)) ||
		cache.contentLower.includes(rawQuery)
	) {
		score += 100; // Boost for existence in content
	}

	// Add token matches score (searchTokens are pre-computed in bhajan object)
	let tokenMatches = 0;
	for (const forms of q.termForms) {
		if (
			bhajan.searchTokens.some((st) => forms.some((f) => isFuzzyMatch(st, f)))
		) {
			tokenMatches++;
		}
	}
	score += tokenMatches * 10;

	return score;
};

// --- Book Search Logic ---
export const calculateBookScore = (book: Book, query: string): number => {
	if (!query || query.trim().length === 0) return 0;

	const rawQuery = query.toLowerCase().trim();
	const phoneticQuery = transliterateForSearch(rawQuery);
	const normalizedQuery = smartNormalize(phoneticQuery);
	const queryTerms = normalizedQuery.split(/\s+/).filter((t) => t.length > 0);

	let score = 0;

	const titleRaw = book.title.toLowerCase();
	const titlePhonetic = transliterateForSearch(titleRaw);
	const titleNorm = smartNormalize(titlePhonetic);

	// Exact match
	if (titleRaw === rawQuery || titleNorm === normalizedQuery) return 1000;

	// Starts with
	if (titleRaw.startsWith(rawQuery) || titleNorm.startsWith(normalizedQuery))
		score += 500;

	// Contains
	if (titleRaw.includes(rawQuery) || titleNorm.includes(normalizedQuery))
		score += 200;

	// Fuzzy words in title
	let titleMatches = 0;
	const titleTokens = titleNorm.split(/\s+/);
	queryTerms.forEach((qt) => {
		if (titleTokens.some((tt) => isFuzzyMatch(tt, qt))) {
			titleMatches++;
		}
	});
	score += titleMatches * 50;

	// File name matching
	if (book.fileName.toLowerCase().includes(rawQuery)) {
		score += 100;
	}

	return score;
};

// --- Lecture Search Logic ---
export const calculateLectureScore = (
	lecture: LectureData,
	query: string,
): number => {
	if (!query || query.trim().length === 0) return 0;

	const rawQuery = query.toLowerCase().trim();
	const phoneticQuery = transliterateForSearch(rawQuery);
	const normalizedQuery = smartNormalize(phoneticQuery);
	const queryTerms = normalizedQuery.split(/\s+/).filter((t) => t.length > 0);

	let score = 0;

	const titleRaw = lecture.title.toLowerCase();
	const titlePhonetic = transliterateForSearch(titleRaw);
	const titleNorm = smartNormalize(titlePhonetic);

	// Exact Title
	if (titleRaw === rawQuery || titleNorm === normalizedQuery) return 1000;

	// Starts with
	if (titleRaw.startsWith(rawQuery) || titleNorm.startsWith(normalizedQuery))
		score += 500;

	// Contains Title
	if (titleRaw.includes(rawQuery) || titleNorm.includes(normalizedQuery))
		score += 200;

	// Fuzzy words in title
	let titleMatches = 0;
	const titleTokens = titleNorm.split(/\s+/);
	queryTerms.forEach((qt) => {
		if (titleTokens.some((tt) => isFuzzyMatch(tt, qt))) {
			titleMatches++;
		}
	});
	score += titleMatches * 50;

	// Description Search
	const descRaw = lecture.description.toLowerCase();
	const descPhonetic = transliterateForSearch(descRaw);
	const descNorm = smartNormalize(descPhonetic);

	if (descNorm.includes(normalizedQuery)) score += 100;

	// Singer Search
	const singersText = lecture.audio?.map((a) => a.singer).join(" ") || "";
	const singersNorm = smartNormalize(
		transliterateForSearch(singersText.toLowerCase()),
	);
	if (singersNorm.includes(normalizedQuery)) score += 150;

	// Date Search
	if (lecture.date?.includes(rawQuery)) score += 300;

	return score;
};

export const getMatchingSnippet = (
	bhajan: Bhajan,
	query: string,
	script: ScriptType,
): string | null => {
	if (!query || query.trim().length < 2) return null;

	const content = script === "iast" ? bhajan.contentIAST : bhajan.content;
	const lines = content.split("\n");

	const rawQuery = query.toLowerCase();
	// Same spellings as the bhajan search tries ("behen" also as "bahan").
	const { phrases, termForms } = prepareSearchQuery(query);

	// Helper to score a line match
	const scoreLine = (line: string): number => {
		const trimmedLine = line.trim();
		if (!trimmedLine) return 0;

		// 1. Exact substring match (Highest Priority)
		if (trimmedLine.toLowerCase().includes(rawQuery)) return 100;

		// 2. Phonetic/Fuzzy substring match (Medium Priority)
		const lineStr = transliterateForSearch(trimmedLine);
		const normalizedLine = smartNormalize(lineStr);

		if (phrases.some((p) => normalizedLine.includes(p))) return 80;

		// 3. Token-based match (Lower Priority)
		const lineTokens = normalizedLine
			.split(/[\s,।॥!?-]+/)
			.filter((t) => t.length > 0);
		let matchCount = 0;
		for (const forms of termForms) {
			if (
				lineTokens.some((lToken) => forms.some((f) => isFuzzyMatch(lToken, f)))
			) {
				matchCount++;
			}
		}

		if (matchCount > 0) {
			return 50 + Math.min((matchCount / termForms.length) * 20, 20);
		}
		return 0;
	};

	let bestLine: string | null = null;
	let bestScore = 0;

	for (const line of lines) {
		const score = scoreLine(line);
		if (score > bestScore) {
			bestScore = score;
			bestLine = line.trim();
		}
	}

	return bestScore > 0 ? bestLine : null;
};

// ----------------------------------------------------------------------
// 5. AUDIO MAP HANDLING (Moved to data/audioLinks.ts)
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// 5. MAIN PARSER - Accepts structured RawBhajanEntry[] array
// ----------------------------------------------------------------------

export const parseRawBhajanText = (entries: RawBhajanEntry[]): Bhajan[] => {
	const bhajansMap = new Map<string, Bhajan>();

	for (const entry of entries) {
		// Clean content
		const cleanContent = entry.content
			.replace(/।।/g, "॥")
			.replace(/\|\|/g, "॥")
			.replace(/बिरही/g, "विरही")
			.trim();
		const cleanTitle = entry.title.trim();
		if (!cleanTitle) continue;

		// Auto-compute IAST
		const titleIAST = convertToIAST(cleanTitle);
		const contentIAST = convertToIAST(cleanContent);
		const contentLines = cleanContent.split("\n");
		const firstLine =
			contentLines.find((l) => l.trim().length > 0)?.trim() || cleanTitle;
		const firstLineIAST = convertToIAST(firstLine);

		// Auto-compute search index + tokens
		const singersText = entry.audio?.map((a) => a.singer).join(" ") || "";
		const combinedText = `${cleanTitle} ${cleanContent} ${singersText}`;
		const transliterated = transliterateForSearch(combinedText);
		const normalizedIndex = smartNormalize(transliterated);
		const searchIndex = `${entry.bhajan_id || ""} ${combinedText.toLowerCase()} ${normalizedIndex}`;
		const rawTokens = transliterated.toLowerCase().split(/[\s,।॥!?-]+/);
		const searchTokens = Array.from(
			new Set(
				rawTokens.filter((t) => t.length > 2).map((t) => smartNormalize(t)),
			),
		);

		// Resolve author IAST
		let authorData: { deva: string; iast: string } | undefined;
		if (entry.author) {
			const knownAuthorKeys = Object.keys(KNOWN_AUTHORS).sort(
				(a, b) => b.length - a.length,
			);
			for (const key of knownAuthorKeys) {
				if (entry.author.includes(key)) {
					authorData = KNOWN_AUTHORS[key];
					break;
				}
			}
			if (!authorData)
				authorData = { deva: entry.author, iast: convertToIAST(entry.author) };
		}

		const parsedBhajan: Bhajan = {
			id: entry.id,
			title: cleanTitle,
			titleIAST,
			firstLine,
			firstLineIAST,
			content: cleanContent,
			contentIAST,
			searchIndex,
			searchTokens,
			author: authorData?.deva,
			authorIAST: authorData?.iast,
			audio: entry.audio,
			songNumber: entry.bhajan_id,
			categories: entry.categories,
			isHidden: entry.isHidden === true,
		};

		const dedupeKey = parsedBhajan.id || parsedBhajan.songNumber || cleanTitle;
		bhajansMap.set(dedupeKey, parsedBhajan);
	}

	return Array.from(bhajansMap.values());
};

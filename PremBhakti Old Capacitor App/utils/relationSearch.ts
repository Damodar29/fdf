import {
	type Gender,
	RELATION_GROUPS,
	RELATION_SEARCH_WORDS,
	type RelationOption,
} from "../src/constants/relations";
import {
	isFuzzyMatch,
	normalizeForSearch,
	prepareSearchQuery,
} from "./textProcessor";

/**
 * Relation search for the relation picker, on the same phonetic search as the
 * bhajans (utils/textProcessor.ts): Hindi, English and Hinglish all meet in
 * one form, so any script finds any other — "मौसी", "mausi", "masi",
 * "aunt", "maa ki behen" and "mother's sister" all find मौसी.
 */

interface SearchKey {
	/** Lower-case text, punctuation turned into spaces. */
	raw: string;
	/** Phonetic form (normalizeForSearch). */
	norm: string;
	tokens: string[];
	/** Labels count more than hints. */
	weight: number;
}

const clean = (s: string) =>
	s
		.toLowerCase()
		.replace(/[’'".,()/\\-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const key = (text: string | undefined, weight: number): SearchKey | null => {
	if (!text) return null;
	const raw = clean(text);
	if (!raw) return null;
	const norm = normalizeForSearch(raw);
	return { raw, norm, tokens: norm.split(" ").filter(Boolean), weight };
};

// Built once, on the first search.
let index: { option: RelationOption; order: number; keys: SearchKey[] }[] = [];
const buildIndex = () => {
	if (index.length) return index;
	let order = 0;
	index = RELATION_GROUPS.flatMap((g) => g.options).map((option) => ({
		option,
		order: order++,
		keys: [
			key(option.en, 1),
			key(option.hi, 1),
			key(option.id.replace(/_/g, " "), 0.9),
			...(RELATION_SEARCH_WORDS[option.id] || []).map((w) => key(w, 0.95)),
			key(option.hintEn, 0.8),
			key(option.hintHi, 0.8),
		].filter((k): k is SearchKey => k !== null),
	}));
	return index;
};

const scoreKey = (
	k: SearchKey,
	raw: string,
	phrases: string[],
	termForms: string[][],
): number => {
	if (k.raw === raw || phrases.includes(k.norm)) return 1000;
	if (k.raw.startsWith(raw) || phrases.some((p) => k.norm.startsWith(p)))
		return 700;
	if (k.raw.includes(raw) || phrases.some((p) => k.norm.includes(p)))
		return 400;
	// Every word of the query must match a word of this same text
	// ("maa ki behen" → माँ की बहन), so words don't mix across relations.
	let sum = 0;
	for (const forms of termForms) {
		let best = 0;
		for (const t of k.tokens) {
			for (const f of forms) {
				if (t === f) best = Math.max(best, 3);
				else if (t.startsWith(f)) best = Math.max(best, 2);
				else if (isFuzzyMatch(t, f)) best = Math.max(best, 1);
			}
		}
		if (!best) return 0;
		sum += best;
	}
	return termForms.length ? 100 + sum * 10 : 0;
};

/**
 * Relations matching `query`, best first (ties keep the list order). An empty
 * query gives none. `gender` keeps only relations that fit (or have no
 * gender, like "cousin").
 */
export function searchRelations(
	query: string,
	gender: Gender | "all" = "all",
): RelationOption[] {
	const raw = clean(query);
	if (!raw) return [];
	const { phrases, termForms } = prepareSearchQuery(raw);
	const scored: { option: RelationOption; order: number; score: number }[] = [];
	for (const entry of buildIndex()) {
		const { option } = entry;
		if (gender !== "all" && option.g && option.g !== gender) continue;
		let score = 0;
		for (const k of entry.keys) {
			const s = scoreKey(k, raw, phrases, termForms) * k.weight;
			if (s > score) score = s;
		}
		if (score > 0) scored.push({ option, order: entry.order, score });
	}
	return scored
		.sort((a, b) => b.score - a.score || a.order - b.order)
		.map((s) => s.option);
}

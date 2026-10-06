import { create } from "zustand";
import { type AuthorDef, KNOWN_AUTHORS } from "../data/authors";
import { fetchStorageJson } from "../lib/contentApi";
import { getObject, setObject } from "../lib/storage";

// Admin-editable bhajan filter categories and author display names — the
// filterCategories / knownAuthors part of context/DataContext.tsx. Fetched
// once per session from app-data/appconfig/{categories,authors}.json and
// cached under the same keys the Capacitor app used.

export interface FilterCategoryDef {
	id: string;
	labelHi: string;
	labelEn: string;
	keywords: string[];
	order: number;
}

const CATEGORIES_KEY = "cpbs_filter_categories";
const AUTHORS_KEY = "cpbs_known_authors";

/** Used until the cloud list arrives (BhajanList.tsx defaultCategories). */
export const DEFAULT_CATEGORIES: FilterCategoryDef[] = [
	{ id: "badhai", labelHi: "बधाई / जन्मोत्सव", labelEn: "Badhai / Janmotsav", keywords: [], order: 1 },
	{ id: "holi", labelHi: "होली / फाग", labelEn: "Holi / Phag", keywords: [], order: 2 },
	{ id: "jhula", labelHi: "झूलन / सावन", labelEn: "Jhulan / Sawan", keywords: [], order: 3 },
	{ id: "aarti", labelHi: "आरतियाँ", labelEn: "Aartis", keywords: [], order: 4 },
	{ id: "ashtak", labelHi: "अष्टक और स्तोत्र", labelEn: "Ashtakas & Stotras", keywords: [], order: 5 },
];

// Cloud data has been double-encoded before; only accept it when the Hindi
// labels really are Devanagari (same guard as DataContext).
const hasDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);

function cachedCategories(): FilterCategoryDef[] {
	const saved = getObject<FilterCategoryDef[]>(CATEGORIES_KEY);
	return Array.isArray(saved) && saved.some((c) => hasDevanagari(c.labelHi || "")) ? saved : [];
}

function cachedAuthors(): Record<string, AuthorDef> {
	const saved = getObject<Record<string, AuthorDef>>(AUTHORS_KEY);
	const sample = saved ? Object.values(saved).slice(0, 5) : [];
	return sample.some((a) => hasDevanagari(a.deva || "")) ? (saved as Record<string, AuthorDef>) : KNOWN_AUTHORS;
}

interface AppConfigState {
	filterCategories: FilterCategoryDef[];
	knownAuthors: Record<string, AuthorDef>;
	synced: boolean;
	sync: () => Promise<void>;
}

export const useAppConfigStore = create<AppConfigState>((set, get) => ({
	filterCategories: cachedCategories(),
	knownAuthors: cachedAuthors(),
	synced: false,
	sync: async () => {
		if (get().synced) return;
		set({ synced: true });
		const [catData, authData] = await Promise.all([
			fetchStorageJson("appconfig", "categories.json").catch(() => null),
			fetchStorageJson("appconfig", "authors.json").catch(() => null),
		]);
		const categories = catData?.categories;
		if (Array.isArray(categories) && categories.slice(0, 3).some((c) => hasDevanagari(c.labelHi || ""))) {
			set({ filterCategories: categories });
			setObject(CATEGORIES_KEY, categories);
		}
		const authors = authData?.authors as Record<string, AuthorDef> | undefined;
		if (authors && Object.values(authors).slice(0, 5).some((a) => hasDevanagari(a.deva || ""))) {
			set({ knownAuthors: authors });
			setObject(AUTHORS_KEY, authors);
		}
	},
}));

/** Display name for a bhajan's author in the current script. */
export function authorDisplayName(
	authors: Record<string, AuthorDef>,
	author: string | undefined,
	authorIAST: string | undefined,
	iast: boolean,
) {
	if (!author) return null;
	if (iast) return authors[author]?.iast || authorIAST || author;
	return authors[author]?.deva || author;
}

/**
 * Family relation options shared by the devotee Profile screen and the admin
 * DevoteeProfileManager.
 *
 * A stored relation is either one of these ids, or free text the devotee typed
 * under "Other". Relations are always from the point of view of the person who
 * set them ("this member is my Father"). The syncFamilyLinkGroups Cloud
 * Function fills the other side of a link with the matching relation when it
 * can be worked out for sure (see RELATION_INVERSE below).
 *
 * Ids are stored in Firestore: never rename or remove one. Older app versions
 * show an id they don't know as plain text, which is why new ids are readable
 * words ("jija", "bhabhi").
 */
export type Gender = "male" | "female";

export interface RelationOption {
	id: string;
	en: string;
	hi: string;
	/** Who this is ("mother's sister") — shown in the picker only. */
	hintEn?: string;
	hintHi?: string;
	/** Gender of the person this relation describes, when it has one. */
	g?: Gender;
	/** Generations above (+) or below (−) me, for the family tree; none
	 *  when it can be any generation ("relative"). */
	gen?: number;
}

export interface RelationGroup {
	en: string;
	hi: string;
	options: RelationOption[];
}

export const RELATION_GROUPS: RelationGroup[] = [
	{
		en: "Immediate family",
		hi: "परिवार",
		options: [
			{ id: "father", en: "Father", hi: "पिता", g: "male", gen: 1 },
			{ id: "mother", en: "Mother", hi: "माता", g: "female", gen: 1 },
			{ id: "husband", en: "Husband", hi: "पति", g: "male", gen: 0 },
			{ id: "wife", en: "Wife", hi: "पत्नी", g: "female", gen: 0 },
			{ id: "son", en: "Son", hi: "पुत्र (बेटा)", g: "male", gen: -1 },
			{
				id: "daughter",
				en: "Daughter",
				hi: "पुत्री (बेटी)",
				g: "female",
				gen: -1,
			},
			{ id: "brother", en: "Brother", hi: "भाई", g: "male", gen: 0 },
			{ id: "sister", en: "Sister", hi: "बहन", g: "female", gen: 0 },
		],
	},
	{
		en: "Grandparents & grandchildren",
		hi: "दादा-दादी / नाना-नानी",
		options: [
			{
				id: "grandfather_paternal",
				en: "Grandfather",
				hintEn: "father's father",
				hi: "दादा",
				g: "male",
				gen: 2,
			},
			{
				id: "grandmother_paternal",
				en: "Grandmother",
				hintEn: "father's mother",
				hi: "दादी",
				g: "female",
				gen: 2,
			},
			{
				id: "grandfather_maternal",
				en: "Grandfather",
				hintEn: "mother's father",
				hi: "नाना",
				g: "male",
				gen: 2,
			},
			{
				id: "grandmother_maternal",
				en: "Grandmother",
				hintEn: "mother's mother",
				hi: "नानी",
				g: "female",
				gen: 2,
			},
			{
				id: "pota",
				en: "Grandson",
				hintEn: "son's son",
				hintHi: "बेटे का बेटा",
				hi: "पोता",
				g: "male",
				gen: -2,
			},
			{
				id: "poti",
				en: "Granddaughter",
				hintEn: "son's daughter",
				hintHi: "बेटे की बेटी",
				hi: "पोती",
				g: "female",
				gen: -2,
			},
			{
				id: "nati",
				en: "Grandson",
				hintEn: "daughter's son",
				hintHi: "बेटी का बेटा",
				hi: "नाती",
				g: "male",
				gen: -2,
			},
			{
				id: "natin",
				en: "Granddaughter",
				hintEn: "daughter's daughter",
				hintHi: "बेटी की बेटी",
				hi: "नातिन",
				g: "female",
				gen: -2,
			},
			{
				id: "grandson",
				en: "Grandson",
				hintEn: "son's or daughter's son",
				hi: "पोता / नाती",
				g: "male",
				gen: -2,
			},
			{
				id: "granddaughter",
				en: "Granddaughter",
				hintEn: "son's or daughter's daughter",
				hi: "पोती / नातिन",
				g: "female",
				gen: -2,
			},
		],
	},
	{
		en: "Great-grandparents & great-grandchildren",
		hi: "परदादा / परनाना",
		options: [
			{
				id: "pardada",
				en: "Great-grandfather",
				hintEn: "father's grandfather",
				hi: "परदादा",
				g: "male",
				gen: 3,
			},
			{
				id: "pardadi",
				en: "Great-grandmother",
				hintEn: "father's grandmother",
				hi: "परदादी",
				g: "female",
				gen: 3,
			},
			{
				id: "parnana",
				en: "Great-grandfather",
				hintEn: "mother's grandfather",
				hi: "परनाना",
				g: "male",
				gen: 3,
			},
			{
				id: "parnani",
				en: "Great-grandmother",
				hintEn: "mother's grandmother",
				hi: "परनानी",
				g: "female",
				gen: 3,
			},
			{
				id: "great_grandson",
				en: "Great-grandson",
				hi: "परपोता / परनाती",
				g: "male",
				gen: -3,
			},
			{
				id: "great_granddaughter",
				en: "Great-granddaughter",
				hi: "परपोती / परनातिन",
				g: "female",
				gen: -3,
			},
		],
	},
	{
		en: "Uncles & aunts",
		hi: "चाचा-ताऊ / मामा / बुआ / मौसी",
		options: [
			{
				id: "chacha",
				en: "Uncle",
				hintEn: "father's younger brother",
				hintHi: "पिता के छोटे भाई",
				hi: "चाचा",
				g: "male",
				gen: 1,
			},
			{
				id: "chachi",
				en: "Aunt",
				hintEn: "chacha's wife",
				hintHi: "चाचा की पत्नी",
				hi: "चाची",
				g: "female",
				gen: 1,
			},
			{
				id: "tau",
				en: "Uncle",
				hintEn: "father's elder brother",
				hintHi: "पिता के बड़े भाई",
				hi: "ताऊ",
				g: "male",
				gen: 1,
			},
			{
				id: "tai",
				en: "Aunt",
				hintEn: "tau's wife",
				hintHi: "ताऊ की पत्नी",
				hi: "ताई",
				g: "female",
				gen: 1,
			},
			{
				id: "uncle_paternal",
				en: "Uncle",
				hintEn: "father's brother, younger or elder",
				hi: "चाचा / ताऊ",
				g: "male",
				gen: 1,
			},
			{
				id: "aunt_paternal",
				en: "Aunt",
				hintEn: "wife of father's brother",
				hi: "चाची / ताई",
				g: "female",
				gen: 1,
			},
			{
				id: "bua",
				en: "Aunt",
				hintEn: "father's sister",
				hintHi: "पिता की बहन",
				hi: "बुआ",
				g: "female",
				gen: 1,
			},
			{
				id: "phupha",
				en: "Uncle",
				hintEn: "bua's husband",
				hintHi: "बुआ के पति",
				hi: "फूफा",
				g: "male",
				gen: 1,
			},
			{
				id: "uncle_maternal",
				en: "Uncle",
				hintEn: "mother's brother",
				hintHi: "माँ के भाई",
				hi: "मामा",
				g: "male",
				gen: 1,
			},
			{
				id: "aunt_maternal",
				en: "Aunt",
				hintEn: "mama's wife",
				hintHi: "मामा की पत्नी",
				hi: "मामी",
				g: "female",
				gen: 1,
			},
			{
				id: "mausi",
				en: "Aunt",
				hintEn: "mother's sister",
				hintHi: "माँ की बहन",
				hi: "मौसी",
				g: "female",
				gen: 1,
			},
			{
				id: "mausa",
				en: "Uncle",
				hintEn: "mausi's husband",
				hintHi: "मौसी के पति",
				hi: "मौसा",
				g: "male",
				gen: 1,
			},
		],
	},
	{
		en: "Nephews, nieces & cousins",
		hi: "भतीजा-भांजा / चचेरे-ममेरे भाई-बहन",
		options: [
			{
				id: "bhatija",
				en: "Nephew",
				hintEn: "brother's son",
				hintHi: "भाई का बेटा",
				hi: "भतीजा",
				g: "male",
				gen: -1,
			},
			{
				id: "bhatiji",
				en: "Niece",
				hintEn: "brother's daughter",
				hintHi: "भाई की बेटी",
				hi: "भतीजी",
				g: "female",
				gen: -1,
			},
			{
				id: "bhanja",
				en: "Nephew",
				hintEn: "sister's son",
				hintHi: "बहन का बेटा",
				hi: "भांजा",
				g: "male",
				gen: -1,
			},
			{
				id: "bhanji",
				en: "Niece",
				hintEn: "sister's daughter",
				hintHi: "बहन की बेटी",
				hi: "भांजी",
				g: "female",
				gen: -1,
			},
			{
				id: "nephew",
				en: "Nephew",
				hintEn: "brother's or sister's son",
				hi: "भतीजा / भांजा",
				g: "male",
				gen: -1,
			},
			{
				id: "niece",
				en: "Niece",
				hintEn: "brother's or sister's daughter",
				hi: "भतीजी / भांजी",
				g: "female",
				gen: -1,
			},
			{
				id: "chachera_bhai",
				en: "Cousin brother",
				hintEn: "chacha/tau's son",
				hintHi: "चाचा/ताऊ का बेटा",
				hi: "चचेरा भाई",
				g: "male",
				gen: 0,
			},
			{
				id: "chacheri_behen",
				en: "Cousin sister",
				hintEn: "chacha/tau's daughter",
				hintHi: "चाचा/ताऊ की बेटी",
				hi: "चचेरी बहन",
				g: "female",
				gen: 0,
			},
			{
				id: "fufera_bhai",
				en: "Cousin brother",
				hintEn: "bua's son",
				hintHi: "बुआ का बेटा",
				hi: "फुफेरा भाई",
				g: "male",
				gen: 0,
			},
			{
				id: "fuferi_behen",
				en: "Cousin sister",
				hintEn: "bua's daughter",
				hintHi: "बुआ की बेटी",
				hi: "फुफेरी बहन",
				g: "female",
				gen: 0,
			},
			{
				id: "mamera_bhai",
				en: "Cousin brother",
				hintEn: "mama's son",
				hintHi: "मामा का बेटा",
				hi: "ममेरा भाई",
				g: "male",
				gen: 0,
			},
			{
				id: "mameri_behen",
				en: "Cousin sister",
				hintEn: "mama's daughter",
				hintHi: "मामा की बेटी",
				hi: "ममेरी बहन",
				g: "female",
				gen: 0,
			},
			{
				id: "mausera_bhai",
				en: "Cousin brother",
				hintEn: "mausi's son",
				hintHi: "मौसी का बेटा",
				hi: "मौसेरा भाई",
				g: "male",
				gen: 0,
			},
			{
				id: "mauseri_behen",
				en: "Cousin sister",
				hintEn: "mausi's daughter",
				hintHi: "मौसी की बेटी",
				hi: "मौसेरी बहन",
				g: "female",
				gen: 0,
			},
			{
				id: "cousin",
				en: "Cousin",
				hintEn: "any cousin",
				hi: "चचेरे / ममेरे भाई-बहन",
				gen: 0,
			},
		],
	},
	{
		en: "In-laws",
		hi: "ससुराल",
		options: [
			{
				id: "father_in_law",
				en: "Father-in-law",
				hi: "ससुर",
				g: "male",
				gen: 1,
			},
			{
				id: "mother_in_law",
				en: "Mother-in-law",
				hi: "सास",
				g: "female",
				gen: 1,
			},
			{
				id: "son_in_law",
				en: "Son-in-law",
				hi: "दामाद",
				g: "male",
				gen: -1,
			},
			{
				id: "daughter_in_law",
				en: "Daughter-in-law",
				hi: "बहू",
				g: "female",
				gen: -1,
			},
			{
				id: "jija",
				en: "Brother-in-law",
				hintEn: "sister's husband",
				hintHi: "बहन के पति",
				hi: "जीजा",
				g: "male",
				gen: 0,
			},
			{
				id: "sala",
				en: "Brother-in-law",
				hintEn: "wife's brother",
				hintHi: "पत्नी के भाई",
				hi: "साला",
				g: "male",
				gen: 0,
			},
			{
				id: "devar",
				en: "Brother-in-law",
				hintEn: "husband's younger brother",
				hintHi: "पति के छोटे भाई",
				hi: "देवर",
				g: "male",
				gen: 0,
			},
			{
				id: "jeth",
				en: "Brother-in-law",
				hintEn: "husband's elder brother",
				hintHi: "पति के बड़े भाई",
				hi: "जेठ",
				g: "male",
				gen: 0,
			},
			{
				id: "nandoi",
				en: "Brother-in-law",
				hintEn: "husband's sister's husband",
				hintHi: "ननद के पति",
				hi: "ननदोई",
				g: "male",
				gen: 0,
			},
			{
				id: "sadhu",
				en: "Brother-in-law",
				hintEn: "wife's sister's husband",
				hintHi: "पत्नी की बहन के पति",
				hi: "साढ़ू",
				g: "male",
				gen: 0,
			},
			{
				id: "bhabhi",
				en: "Sister-in-law",
				hintEn: "brother's wife",
				hintHi: "भाई की पत्नी",
				hi: "भाभी",
				g: "female",
				gen: 0,
			},
			{
				id: "nanad",
				en: "Sister-in-law",
				hintEn: "husband's sister",
				hintHi: "पति की बहन",
				hi: "ननद",
				g: "female",
				gen: 0,
			},
			{
				id: "sali",
				en: "Sister-in-law",
				hintEn: "wife's sister",
				hintHi: "पत्नी की बहन",
				hi: "साली",
				g: "female",
				gen: 0,
			},
			{
				id: "devrani",
				en: "Sister-in-law",
				hintEn: "devar's wife",
				hintHi: "देवर की पत्नी",
				hi: "देवरानी",
				g: "female",
				gen: 0,
			},
			{
				id: "jethani",
				en: "Sister-in-law",
				hintEn: "jeth's wife",
				hintHi: "जेठ की पत्नी",
				hi: "जेठानी",
				g: "female",
				gen: 0,
			},
			{
				id: "salhaj",
				en: "Sister-in-law",
				hintEn: "wife's brother's wife",
				hintHi: "पत्नी के भाई की पत्नी",
				hi: "सलहज",
				g: "female",
				gen: 0,
			},
			{
				id: "brother_in_law",
				en: "Brother-in-law",
				hintEn: "any",
				hi: "देवर / जेठ / साला / जीजा",
				g: "male",
				gen: 0,
			},
			{
				id: "sister_in_law",
				en: "Sister-in-law",
				hintEn: "any",
				hi: "भाभी / ननद / साली",
				g: "female",
				gen: 0,
			},
			{
				id: "samdhi",
				en: "Samdhi",
				hintEn: "child's father-in-law",
				hintHi: "बेटे/बेटी के ससुर",
				hi: "समधी",
				g: "male",
				gen: 0,
			},
			{
				id: "samdhan",
				en: "Samdhan",
				hintEn: "child's mother-in-law",
				hintHi: "बेटे/बेटी की सास",
				hi: "समधन",
				g: "female",
				gen: 0,
			},
		],
	},
	{
		en: "Grandchildren's & nephews' spouses, spouse's elders",
		hi: "पोत-बहू / नात-बहू / दादा ससुर",
		options: [
			{
				id: "pot_bahu",
				en: "Grandson's wife",
				hintEn: "son's son's wife",
				hintHi: "पोते की पत्नी",
				hi: "पोत-बहू",
				g: "female",
				gen: -2,
			},
			{
				id: "nat_bahu",
				en: "Grandson's wife",
				hintEn: "daughter's son's wife",
				hintHi: "नाती की पत्नी",
				hi: "नात-बहू",
				g: "female",
				gen: -2,
			},
			{
				id: "pot_damad",
				en: "Granddaughter's husband",
				hintEn: "son's daughter's husband",
				hintHi: "पोती के पति",
				hi: "पोत-दामाद",
				g: "male",
				gen: -2,
			},
			{
				id: "nat_damad",
				en: "Granddaughter's husband",
				hintEn: "daughter's daughter's husband",
				hintHi: "नातिन के पति",
				hi: "नात-दामाद",
				g: "male",
				gen: -2,
			},
			{
				id: "dada_sasur",
				en: "Grandfather-in-law",
				hintEn: "husband's / wife's father's father",
				hintHi: "पति/पत्नी के दादा",
				hi: "दादा ससुर",
				g: "male",
				gen: 2,
			},
			{
				id: "dadi_saas",
				en: "Grandmother-in-law",
				hintEn: "husband's / wife's father's mother",
				hintHi: "पति/पत्नी की दादी",
				hi: "दादी सास",
				g: "female",
				gen: 2,
			},
			{
				id: "nana_sasur",
				en: "Grandfather-in-law",
				hintEn: "husband's / wife's mother's father",
				hintHi: "पति/पत्नी के नाना",
				hi: "नाना ससुर",
				g: "male",
				gen: 2,
			},
			{
				id: "nani_saas",
				en: "Grandmother-in-law",
				hintEn: "husband's / wife's mother's mother",
				hintHi: "पति/पत्नी की नानी",
				hi: "नानी सास",
				g: "female",
				gen: 2,
			},
			{
				id: "bhatij_bahu",
				en: "Nephew's wife",
				hintEn: "brother's son's wife",
				hintHi: "भतीजे की पत्नी",
				hi: "भतीज-बहू",
				g: "female",
				gen: -1,
			},
			{
				id: "bhanj_bahu",
				en: "Nephew's wife",
				hintEn: "sister's son's wife",
				hintHi: "भांजे की पत्नी",
				hi: "भांज-बहू",
				g: "female",
				gen: -1,
			},
			{
				id: "bhatiji_damad",
				en: "Niece's husband",
				hintEn: "brother's daughter's husband",
				hintHi: "भतीजी के पति",
				hi: "भतीजी-दामाद",
				g: "male",
				gen: -1,
			},
			{
				id: "bhanji_damad",
				en: "Niece's husband",
				hintEn: "sister's daughter's husband",
				hintHi: "भांजी के पति",
				hi: "भांजी-दामाद",
				g: "male",
				gen: -1,
			},
			{
				id: "uncle_in_law",
				en: "Uncle-in-law",
				hintEn: "husband's / wife's chacha, tau, mama, phupha or mausa",
				hintHi: "पति/पत्नी के चाचा, ताऊ, मामा, फूफा या मौसा",
				hi: "चचिया / ममिया ससुर",
				g: "male",
				gen: 1,
			},
			{
				id: "aunt_in_law",
				en: "Aunt-in-law",
				hintEn: "husband's / wife's chachi, tai, mami, bua or mausi",
				hintHi: "पति/पत्नी की चाची, ताई, मामी, बुआ या मौसी",
				hi: "चचिया / ममिया सास",
				g: "female",
				gen: 1,
			},
		],
	},
	{
		en: "Other",
		hi: "अन्य",
		options: [
			{
				id: "relative",
				en: "Relative",
				hintEn: "family with no other name in this list",
				hintHi: "जिनके लिए इस सूची में कोई और नाम नहीं",
				hi: "रिश्तेदार",
			},
		],
	},
];

/** Longest custom relation we store — keeps list rows and exports tidy. */
export const RELATION_MAX_LENGTH = 30;

const RELATION_BY_ID = new Map(
	RELATION_GROUPS.flatMap((g) => g.options).map((o) => [o.id, o]),
);

export const isKnownRelation = (value: string | undefined | null): boolean =>
	!!value && RELATION_BY_ID.has(value);

/**
 * Display text for a stored relation: the localized label for a known id, the
 * typed text for a custom one, or "" when none is set.
 */
export const getRelationLabel = (
	value: string | undefined | null,
	isHindi: boolean,
): string => {
	if (!value) return "";
	const known = RELATION_BY_ID.get(value);
	if (known) return isHindi ? known.hi : known.en;
	return value;
};

/** Trim and cap a relation before it is saved. */
export const normalizeRelation = (value: string | undefined | null): string =>
	(value || "").trim().slice(0, RELATION_MAX_LENGTH);

/** Gender of the person a relation describes ("sister" → female), if any. */
export const relationGender = (
	relation: string | undefined | null,
): Gender | undefined =>
	relation ? RELATION_BY_ID.get(relation)?.g : undefined;

/**
 * relation → what the person I describe calls ME, [if I am male, if I am
 * female]. Read as: I call someone "father" ⇒ they call me "son" or
 * "daughter". Several ids = it depends on something we don't know (which side
 * of the family, who is older); an empty list = that relation can't come from
 * someone of that gender.
 *
 * Copied in functions/src/familyRelations.ts for the Cloud Function — keep
 * both identical (`npm run test:relations` checks it).
 */
export const RELATION_INVERSE: Record<string, [string[], string[]]> = {
	father: [["son"], ["daughter"]],
	mother: [["son"], ["daughter"]],
	son: [["father"], ["mother"]],
	daughter: [["father"], ["mother"]],
	husband: [[], ["wife"]],
	wife: [["husband"], []],
	brother: [["brother"], ["sister"]],
	sister: [["brother"], ["sister"]],

	grandfather_paternal: [["pota"], ["poti"]],
	grandmother_paternal: [["pota"], ["poti"]],
	grandfather_maternal: [["nati"], ["natin"]],
	grandmother_maternal: [["nati"], ["natin"]],
	pota: [["grandfather_paternal"], ["grandmother_paternal"]],
	poti: [["grandfather_paternal"], ["grandmother_paternal"]],
	nati: [["grandfather_maternal"], ["grandmother_maternal"]],
	natin: [["grandfather_maternal"], ["grandmother_maternal"]],
	// A grandchild's side (dada or nana) can't be known, so offer both.
	grandson: [
		["grandfather_paternal", "grandfather_maternal"],
		["grandmother_paternal", "grandmother_maternal"],
	],
	granddaughter: [
		["grandfather_paternal", "grandfather_maternal"],
		["grandmother_paternal", "grandmother_maternal"],
	],

	pardada: [["great_grandson"], ["great_granddaughter"]],
	pardadi: [["great_grandson"], ["great_granddaughter"]],
	parnana: [["great_grandson"], ["great_granddaughter"]],
	parnani: [["great_grandson"], ["great_granddaughter"]],
	great_grandson: [
		["pardada", "parnana"],
		["pardadi", "parnani"],
	],
	great_granddaughter: [
		["pardada", "parnana"],
		["pardadi", "parnani"],
	],

	// Chacha, tau, their wives and bua call their brother's child bhatija.
	chacha: [["bhatija"], ["bhatiji"]],
	chachi: [["bhatija"], ["bhatiji"]],
	tau: [["bhatija"], ["bhatiji"]],
	tai: [["bhatija"], ["bhatiji"]],
	uncle_paternal: [["bhatija"], ["bhatiji"]],
	aunt_paternal: [["bhatija"], ["bhatiji"]],
	bua: [["bhatija"], ["bhatiji"]],
	// Mama, mami and mausi call their sister's child bhanja.
	uncle_maternal: [["bhanja"], ["bhanji"]],
	aunt_maternal: [["bhanja"], ["bhanji"]],
	mausi: [["bhanja"], ["bhanji"]],
	// Usage differs by region for these two, so the general word.
	phupha: [["nephew"], ["niece"]],
	mausa: [["nephew"], ["niece"]],
	// Which uncle/aunt depends on the side of the family and age — offer them.
	bhatija: [
		["chacha", "tau"],
		["bua", "chachi", "tai"],
	],
	bhatiji: [
		["chacha", "tau"],
		["bua", "chachi", "tai"],
	],
	bhanja: [
		["uncle_maternal", "mausa"],
		["mausi", "aunt_maternal"],
	],
	bhanji: [
		["uncle_maternal", "mausa"],
		["mausi", "aunt_maternal"],
	],
	nephew: [
		["chacha", "tau", "uncle_maternal", "phupha", "mausa"],
		["bua", "chachi", "tai", "aunt_maternal", "mausi"],
	],
	niece: [
		["chacha", "tau", "uncle_maternal", "phupha", "mausa"],
		["bua", "chachi", "tai", "aunt_maternal", "mausi"],
	],
	chachera_bhai: [["chachera_bhai"], ["chacheri_behen"]],
	chacheri_behen: [["chachera_bhai"], ["chacheri_behen"]],
	// My mama's child is my ममेरा; to them I am their bua's child — फुफेरा.
	mamera_bhai: [["fufera_bhai"], ["fuferi_behen"]],
	mameri_behen: [["fufera_bhai"], ["fuferi_behen"]],
	fufera_bhai: [["mamera_bhai"], ["mameri_behen"]],
	fuferi_behen: [["mamera_bhai"], ["mameri_behen"]],
	mausera_bhai: [["mausera_bhai"], ["mauseri_behen"]],
	mauseri_behen: [["mausera_bhai"], ["mauseri_behen"]],
	cousin: [["cousin"], ["cousin"]],

	father_in_law: [["son_in_law"], ["daughter_in_law"]],
	mother_in_law: [["son_in_law"], ["daughter_in_law"]],
	son_in_law: [["father_in_law"], ["mother_in_law"]],
	daughter_in_law: [["father_in_law"], ["mother_in_law"]],
	// My sister's husband: I am his wife's brother (sala) or sister (sali).
	jija: [["sala"], ["sali"]],
	sala: [["jija"], []],
	sali: [["jija"], []],
	devar: [[], ["bhabhi"]],
	// A jeth's word for his younger brother's wife differs by region.
	jeth: [[], []],
	// My brother's wife: I am her devar or jeth (younger/elder) or nanad.
	bhabhi: [["devar", "jeth"], ["nanad"]],
	nanad: [[], ["bhabhi"]],
	devrani: [[], ["jethani"]],
	jethani: [[], ["devrani"]],
	nandoi: [[], ["salhaj"]],
	salhaj: [["nandoi"], []],
	sadhu: [["sadhu"], []],
	brother_in_law: [["brother_in_law"], ["sister_in_law"]],
	sister_in_law: [["brother_in_law"], ["sister_in_law"]],
	samdhi: [["samdhi"], ["samdhan"]],
	samdhan: [["samdhi"], ["samdhan"]],

	// My pota's wife: I am her husband's dada / dadi — दादा ससुर / दादी सास.
	pot_bahu: [["dada_sasur"], ["dadi_saas"]],
	pot_damad: [["dada_sasur"], ["dadi_saas"]],
	nat_bahu: [["nana_sasur"], ["nani_saas"]],
	nat_damad: [["nana_sasur"], ["nani_saas"]],
	dada_sasur: [["pot_damad"], ["pot_bahu"]],
	dadi_saas: [["pot_damad"], ["pot_bahu"]],
	nana_sasur: [["nat_damad"], ["nat_bahu"]],
	nani_saas: [["nat_damad"], ["nat_bahu"]],
	bhatij_bahu: [["uncle_in_law"], ["aunt_in_law"]],
	bhanj_bahu: [["uncle_in_law"], ["aunt_in_law"]],
	bhatiji_damad: [["uncle_in_law"], ["aunt_in_law"]],
	bhanji_damad: [["uncle_in_law"], ["aunt_in_law"]],
	// My spouse's uncle: I am his bhatija's / bhanja's wife or husband — which
	// one depends on the side of the family.
	uncle_in_law: [
		["bhatiji_damad", "bhanji_damad"],
		["bhatij_bahu", "bhanj_bahu"],
	],
	aunt_in_law: [
		["bhatiji_damad", "bhanji_damad"],
		["bhatij_bahu", "bhanj_bahu"],
	],
	relative: [["relative"], ["relative"]],
};

/**
 * Suggested relations for someone, from how THEY described me.
 * `theirRelationForMe` = the relation they chose for me ("father" = I am their
 * father); `theirGender` narrows the choice. Custom text gives no suggestion.
 */
export const suggestInverseRelations = (
	theirRelationForMe: string | undefined | null,
	theirGender?: Gender | "" | null,
): string[] => {
	const entry = theirRelationForMe
		? RELATION_INVERSE[theirRelationForMe]
		: undefined;
	if (!entry) return [];
	const [ifMale, ifFemale] = entry;
	if (theirGender === "male") return ifMale;
	if (theirGender === "female") return ifFemale;
	return Array.from(new Set([...ifMale, ...ifFemale]));
};

/**
 * The relation the other side of a link gets automatically, or null when it
 * can't be known for sure. `relation` = what the describer calls the other
 * person. Refuses when the other person's gender contradicts the relation
 * (called "sister" but set as male). Same rule as autoInverseRelation in
 * functions/src/familyRelations.ts.
 */
export const autoInverseRelation = (
	relation: string | undefined | null,
	describerGender?: Gender | "" | null,
	describedGender?: Gender | "" | null,
): string | null => {
	if (!relation) return null;
	const implied = relationGender(relation);
	if (
		implied &&
		(describedGender === "male" || describedGender === "female") &&
		describedGender !== implied
	)
		return null;
	const options = suggestInverseRelations(relation, describerGender);
	return options.length === 1 ? options[0] : null;
};

/** My husband's / wife's grandparents, uncles and aunts. */
const SPOUSE_ELDERS: Record<string, string[]> = {
	grandfather_paternal: ["dada_sasur"],
	grandmother_paternal: ["dadi_saas"],
	grandfather_maternal: ["nana_sasur"],
	grandmother_maternal: ["nani_saas"],
	chacha: ["uncle_in_law"],
	tau: ["uncle_in_law"],
	uncle_paternal: ["uncle_in_law"],
	uncle_maternal: ["uncle_in_law"],
	phupha: ["uncle_in_law"],
	mausa: ["uncle_in_law"],
	chachi: ["aunt_in_law"],
	tai: ["aunt_in_law"],
	aunt_paternal: ["aunt_in_law"],
	aunt_maternal: ["aunt_in_law"],
	bua: ["aunt_in_law"],
	mausi: ["aunt_in_law"],
};

/**
 * Relation through someone in between: [what I call X][what X calls Y] →
 * what I (probably) call Y. "mausi" + "son" → मौसेरा भाई. Only suggestions —
 * families differ (step-relations, which side), so these are never saved
 * without the devotee picking one.
 */
export const RELATION_CHAIN: Record<string, Record<string, string[]>> = {
	father: {
		father: ["grandfather_paternal"],
		mother: ["grandmother_paternal"],
		wife: ["mother"],
		son: ["brother"],
		daughter: ["sister"],
		brother: ["chacha", "tau"],
		sister: ["bua"],
	},
	mother: {
		father: ["grandfather_maternal"],
		mother: ["grandmother_maternal"],
		husband: ["father"],
		son: ["brother"],
		daughter: ["sister"],
		brother: ["uncle_maternal"],
		sister: ["mausi"],
	},
	brother: {
		father: ["father"],
		mother: ["mother"],
		brother: ["brother"],
		sister: ["sister"],
		wife: ["bhabhi"],
		son: ["bhatija"],
		daughter: ["bhatiji"],
	},
	sister: {
		father: ["father"],
		mother: ["mother"],
		brother: ["brother"],
		sister: ["sister"],
		husband: ["jija"],
		son: ["bhanja"],
		daughter: ["bhanji"],
	},
	son: {
		brother: ["son"],
		sister: ["daughter"],
		wife: ["daughter_in_law"],
		son: ["pota"],
		daughter: ["poti"],
	},
	daughter: {
		brother: ["son"],
		sister: ["daughter"],
		husband: ["son_in_law"],
		son: ["nati"],
		daughter: ["natin"],
	},
	husband: {
		father: ["father_in_law"],
		mother: ["mother_in_law"],
		brother: ["devar", "jeth"],
		sister: ["nanad"],
		son: ["son"],
		daughter: ["daughter"],
		...SPOUSE_ELDERS,
	},
	wife: {
		father: ["father_in_law"],
		mother: ["mother_in_law"],
		brother: ["sala"],
		sister: ["sali"],
		son: ["son"],
		daughter: ["daughter"],
		...SPOUSE_ELDERS,
	},
	grandfather_paternal: {
		wife: ["grandmother_paternal"],
		son: ["father", "chacha", "tau"],
		daughter: ["bua"],
	},
	grandmother_paternal: {
		husband: ["grandfather_paternal"],
		son: ["father", "chacha", "tau"],
		daughter: ["bua"],
	},
	grandfather_maternal: {
		wife: ["grandmother_maternal"],
		son: ["uncle_maternal"],
		daughter: ["mother", "mausi"],
	},
	grandmother_maternal: {
		husband: ["grandfather_maternal"],
		son: ["uncle_maternal"],
		daughter: ["mother", "mausi"],
	},
	chacha: {
		father: ["grandfather_paternal"],
		mother: ["grandmother_paternal"],
		wife: ["chachi"],
		son: ["chachera_bhai"],
		daughter: ["chacheri_behen"],
	},
	tau: {
		father: ["grandfather_paternal"],
		mother: ["grandmother_paternal"],
		wife: ["tai"],
		son: ["chachera_bhai"],
		daughter: ["chacheri_behen"],
	},
	uncle_paternal: {
		wife: ["aunt_paternal"],
		son: ["chachera_bhai"],
		daughter: ["chacheri_behen"],
	},
	chachi: {
		husband: ["chacha"],
		son: ["chachera_bhai"],
		daughter: ["chacheri_behen"],
	},
	tai: {
		husband: ["tau"],
		son: ["chachera_bhai"],
		daughter: ["chacheri_behen"],
	},
	aunt_paternal: {
		husband: ["uncle_paternal"],
		son: ["chachera_bhai"],
		daughter: ["chacheri_behen"],
	},
	bua: {
		father: ["grandfather_paternal"],
		mother: ["grandmother_paternal"],
		husband: ["phupha"],
		son: ["fufera_bhai"],
		daughter: ["fuferi_behen"],
	},
	phupha: {
		wife: ["bua"],
		son: ["fufera_bhai"],
		daughter: ["fuferi_behen"],
	},
	uncle_maternal: {
		father: ["grandfather_maternal"],
		mother: ["grandmother_maternal"],
		wife: ["aunt_maternal"],
		son: ["mamera_bhai"],
		daughter: ["mameri_behen"],
	},
	aunt_maternal: {
		husband: ["uncle_maternal"],
		son: ["mamera_bhai"],
		daughter: ["mameri_behen"],
	},
	mausi: {
		father: ["grandfather_maternal"],
		mother: ["grandmother_maternal"],
		husband: ["mausa"],
		son: ["mausera_bhai"],
		daughter: ["mauseri_behen"],
	},
	mausa: {
		wife: ["mausi"],
		son: ["mausera_bhai"],
		daughter: ["mauseri_behen"],
	},
	// A cousin's parents and siblings.
	chachera_bhai: {
		father: ["chacha", "tau"],
		mother: ["chachi", "tai"],
		brother: ["chachera_bhai"],
		sister: ["chacheri_behen"],
	},
	chacheri_behen: {
		father: ["chacha", "tau"],
		mother: ["chachi", "tai"],
		brother: ["chachera_bhai"],
		sister: ["chacheri_behen"],
	},
	fufera_bhai: {
		father: ["phupha"],
		mother: ["bua"],
		brother: ["fufera_bhai"],
		sister: ["fuferi_behen"],
	},
	fuferi_behen: {
		father: ["phupha"],
		mother: ["bua"],
		brother: ["fufera_bhai"],
		sister: ["fuferi_behen"],
	},
	mamera_bhai: {
		father: ["uncle_maternal"],
		mother: ["aunt_maternal"],
		brother: ["mamera_bhai"],
		sister: ["mameri_behen"],
	},
	mameri_behen: {
		father: ["uncle_maternal"],
		mother: ["aunt_maternal"],
		brother: ["mamera_bhai"],
		sister: ["mameri_behen"],
	},
	mausera_bhai: {
		father: ["mausa"],
		mother: ["mausi"],
		brother: ["mausera_bhai"],
		sister: ["mauseri_behen"],
	},
	mauseri_behen: {
		father: ["mausa"],
		mother: ["mausi"],
		brother: ["mausera_bhai"],
		sister: ["mauseri_behen"],
	},
	cousin: {
		father: ["chacha", "tau", "phupha", "uncle_maternal", "mausa"],
		mother: ["chachi", "tai", "bua", "aunt_maternal", "mausi"],
	},
	// The in-laws' son / daughter can be one's own spouse, too.
	father_in_law: {
		wife: ["mother_in_law"],
		son: ["husband", "brother_in_law"],
		daughter: ["wife", "sister_in_law"],
		father: ["dada_sasur"],
		mother: ["dadi_saas"],
		brother: ["uncle_in_law"],
		sister: ["aunt_in_law"],
	},
	mother_in_law: {
		husband: ["father_in_law"],
		son: ["husband", "brother_in_law"],
		daughter: ["wife", "sister_in_law"],
		father: ["nana_sasur"],
		mother: ["nani_saas"],
		brother: ["uncle_in_law"],
		sister: ["aunt_in_law"],
	},
	son_in_law: { wife: ["daughter"], son: ["nati"], daughter: ["natin"] },
	daughter_in_law: { husband: ["son"], son: ["pota"], daughter: ["poti"] },
	pota: { wife: ["pot_bahu"] },
	poti: { husband: ["pot_damad"] },
	nati: { wife: ["nat_bahu"] },
	natin: { husband: ["nat_damad"] },
	grandson: { wife: ["pot_bahu", "nat_bahu"] },
	granddaughter: { husband: ["pot_damad", "nat_damad"] },
	pot_bahu: { husband: ["pota"] },
	pot_damad: { wife: ["poti"] },
	nat_bahu: { husband: ["nati"] },
	nat_damad: { wife: ["natin"] },
	dada_sasur: { wife: ["dadi_saas"] },
	dadi_saas: { husband: ["dada_sasur"] },
	nana_sasur: { wife: ["nani_saas"] },
	nani_saas: { husband: ["nana_sasur"] },
	bhatija: { wife: ["bhatij_bahu"] },
	bhanja: { wife: ["bhanj_bahu"] },
	bhatiji: { husband: ["bhatiji_damad"] },
	bhanji: { husband: ["bhanji_damad"] },
	nephew: { wife: ["bhatij_bahu", "bhanj_bahu"] },
	niece: { husband: ["bhatiji_damad", "bhanji_damad"] },
	bhatij_bahu: { husband: ["bhatija"] },
	bhanj_bahu: { husband: ["bhanja"] },
	bhatiji_damad: { wife: ["bhatiji"] },
	bhanji_damad: { wife: ["bhanji"] },
	uncle_in_law: { wife: ["aunt_in_law"] },
	aunt_in_law: { husband: ["uncle_in_law"] },
	jija: { wife: ["sister"], son: ["bhanja"], daughter: ["bhanji"] },
	bhabhi: { husband: ["brother"], son: ["bhatija"], daughter: ["bhatiji"] },
	sala: { wife: ["salhaj"] },
	sali: { husband: ["sadhu"] },
	devar: { wife: ["devrani"] },
	jeth: { wife: ["jethani"] },
	nanad: { husband: ["nandoi"] },
};

/**
 * Suggested relations for a family member reached through others: for each
 * `{ mine, theirs }`, `mine` = what I call the person in between, `theirs` =
 * what that person calls the member. The member's gender (if known) drops
 * suggestions that can't fit. Most likely first, no duplicates.
 */
export const suggestChainRelations = (
	chains: { mine?: string | null; theirs?: string | null }[],
	memberGender?: Gender | "" | null,
): string[] => {
	const out: string[] = [];
	for (const { mine, theirs } of chains) {
		if (!mine || !theirs) continue;
		for (const id of RELATION_CHAIN[mine]?.[theirs] || []) {
			const g = relationGender(id);
			if (g && memberGender && g !== memberGender) continue;
			if (!out.includes(id)) out.push(id);
		}
	}
	return out;
};

/**
 * Other words people type for a relation — Hinglish spellings, everyday
 * Hindi, and what families call each other ("papa", "didi", "jija ji").
 * Only for search (utils/relationSearch.ts); labels, hints and the Hindi name
 * are searched as well, in any script.
 */
export const RELATION_SEARCH_WORDS: Record<string, string[]> = {
	father: [
		"papa",
		"pita ji",
		"pitaji",
		"baba",
		"bapu",
		"babuji",
		"daddy",
		"dad",
		"पापा",
		"बाबूजी",
		"पिताजी",
	],
	mother: [
		"maa",
		"mummy",
		"mata ji",
		"mataji",
		"amma",
		"mai",
		"mom",
		"माँ",
		"मां",
		"मम्मी",
		"अम्मा",
		"माताजी",
	],
	husband: ["pati", "pati ji", "patidev", "पतिदेव"],
	wife: ["patni", "dharmpatni", "biwi", "gharwali", "धर्मपत्नी", "बीवी"],
	son: ["beta", "putra", "ladka", "बेटा", "लड़का"],
	daughter: ["beti", "putri", "ladki", "bitiya", "बेटी", "लड़की", "बिटिया"],
	brother: ["bhai", "bhaiya", "bhaiyya", "bhai sahab", "भैया", "भाई साहब"],
	sister: [
		"behen",
		"bahan",
		"behan",
		"didi",
		"behna",
		"jiji",
		"दीदी",
		"जीजी",
		"बहना",
	],
	grandfather_paternal: ["dada", "dada ji", "dadaji", "दादाजी"],
	grandmother_paternal: ["dadi", "dadi ji", "dadiji", "दादीजी"],
	grandfather_maternal: ["nana", "nana ji", "nanaji", "नानाजी"],
	grandmother_maternal: ["nani", "nani ji", "naniji", "नानीजी"],
	pota: ["pota", "pote"],
	poti: ["poti"],
	nati: ["nati", "naati"],
	natin: ["natin", "natni", "naatin"],
	grandson: ["pota", "nati", "grandchild"],
	granddaughter: ["poti", "natin", "grandchild"],
	pardada: ["pardada", "par dada"],
	pardadi: ["pardadi", "par dadi"],
	parnana: ["parnana", "par nana"],
	parnani: ["parnani", "par nani"],
	great_grandson: ["parpota", "parnati", "great grandchild"],
	great_granddaughter: ["parpoti", "parnatin", "great grandchild"],
	chacha: [
		"chacha",
		"chacha ji",
		"chachaji",
		"kaka",
		"chachu",
		"काका",
		"चाचाजी",
	],
	chachi: ["chachi", "chachi ji", "kaki", "काकी", "चाचीजी"],
	tau: ["tau", "taau", "tau ji", "tauji", "bade papa", "ताऊजी", "बड़े पापा"],
	tai: [
		"tai",
		"taai",
		"tai ji",
		"taiji",
		"badi mummy",
		"badi maa",
		"ताईजी",
		"बड़ी मम्मी",
	],
	uncle_paternal: ["chacha", "tau", "kaka"],
	aunt_paternal: ["chachi", "tai", "kaki"],
	bua: ["bua", "bua ji", "buaji", "phuphi", "fufi", "bhua", "बुआजी", "फूफी"],
	phupha: ["phupha", "fufa", "phupha ji", "fufaji", "फूफाजी"],
	uncle_maternal: ["mama", "mama ji", "mamaji", "मामाजी"],
	aunt_maternal: ["mami", "mami ji", "mamiji", "मामीजी"],
	mausi: ["mausi", "masi", "maasi", "mousi", "mausi ji", "मौसीजी", "मासी"],
	mausa: ["mausa", "mausa ji", "mausaji", "masad", "mousa", "मौसाजी"],
	bhatija: ["bhatija", "bhateeja"],
	bhatiji: ["bhatiji", "bhateeji"],
	bhanja: ["bhanja", "bhaanja", "bhanje"],
	bhanji: ["bhanji", "bhaanji"],
	nephew: ["bhatija", "bhanja"],
	niece: ["bhatiji", "bhanji"],
	chachera_bhai: ["chachera", "chachera bhai", "tayera bhai"],
	chacheri_behen: ["chacheri", "chacheri behen"],
	fufera_bhai: ["fufera", "phuphera", "fufera bhai"],
	fuferi_behen: ["fuferi", "phupheri", "fuferi behen"],
	mamera_bhai: ["mamera", "mamera bhai"],
	mameri_behen: ["mameri", "mameri behen"],
	mausera_bhai: ["mausera", "mausera bhai"],
	mauseri_behen: ["mauseri", "mauseri behen"],
	cousin: ["cousin", "kazin", "cousin bhai", "cousin behen"],
	relative: [
		"rishtedar",
		"rishtedaar",
		"rishtadar",
		"door ke rishtedar",
		"relation",
		"नातेदार",
	],
	father_in_law: ["sasur", "sasur ji", "sasurji", "ससुरजी"],
	mother_in_law: ["saas", "sas", "saasu ma", "sasuma", "सासूमाँ", "सासू माँ"],
	son_in_law: ["damad", "damaad", "jamai", "jamaai", "जमाई", "जंवाई"],
	daughter_in_law: ["bahu", "bahurani", "bahu rani", "बहूरानी"],
	jija: [
		"jija",
		"jija ji",
		"jijaji",
		"jeeja",
		"behnoi",
		"bahnoi",
		"जीजाजी",
		"बहनोई",
	],
	sala: ["sala", "saala", "साला जी"],
	devar: ["devar", "dewar", "devar ji", "देवरजी"],
	jeth: ["jeth", "jeth ji", "jethji", "जेठजी"],
	nandoi: ["nandoi", "nandoi ji"],
	sadhu: ["sadhu", "saadhu", "sadu", "साढू"],
	bhabhi: ["bhabhi", "bhabi", "bhabhi ji", "bhauji", "भाभीजी", "भौजी"],
	nanad: ["nanad", "nanand", "nand", "ननदजी"],
	sali: ["sali", "saali", "साली जी"],
	devrani: ["devrani", "dewrani"],
	jethani: ["jethani", "jithani"],
	salhaj: ["salhaj", "sarhaj"],
	brother_in_law: ["jija", "sala", "devar", "jeth", "brother in law"],
	sister_in_law: ["bhabhi", "nanad", "sali", "sister in law"],
	samdhi: ["samdhi", "samdhi ji"],
	samdhan: ["samdhan", "samdhin"],
	pot_bahu: [
		"pot bahu",
		"potbahu",
		"pote ki bahu",
		"pote ki patni",
		"पोते की बहू",
	],
	nat_bahu: [
		"nat bahu",
		"natbahu",
		"nati ki bahu",
		"naati ki bahu",
		"nati ki patni",
		"नाती की बहू",
	],
	pot_damad: ["pot damad", "poti ka pati", "poti ke pati", "पोती का पति"],
	nat_damad: ["nat damad", "natin ka pati", "natin ke pati", "नातिन का पति"],
	dada_sasur: ["dada sasur", "dadiya sasur", "ददिया ससुर"],
	dadi_saas: ["dadi saas", "dadi sas", "dadiya saas", "ददिया सास"],
	nana_sasur: ["nana sasur", "naniya sasur", "ननिया ससुर"],
	nani_saas: ["nani saas", "nani sas", "naniya saas", "ननिया सास"],
	bhatij_bahu: ["bhatij bahu", "bhatije ki bahu", "bhatije ki patni"],
	bhanj_bahu: ["bhanj bahu", "bhanje ki bahu", "bhanje ki patni"],
	bhatiji_damad: ["bhatiji damad", "bhatiji ka pati", "bhatiji ke pati"],
	bhanji_damad: ["bhanji damad", "bhanji ka pati", "bhanji ke pati"],
	uncle_in_law: [
		"chachiya sasur",
		"chacha sasur",
		"mamiya sasur",
		"mama sasur",
		"phuphiya sasur",
		"mausiya sasur",
		"tau sasur",
		"चाचा ससुर",
		"मामा ससुर",
	],
	aunt_in_law: [
		"chachiya saas",
		"chachi saas",
		"mamiya saas",
		"mami saas",
		"phuphiya saas",
		"bua saas",
		"mausiya saas",
		"मौसी सास",
		"बुआ सास",
	],
};

/**
 * How many generations above (+) or below (−) me a relation is, for the family
 * tree. null = unknown (custom text or not set).
 */
export const relationGeneration = (
	relation: string | undefined | null,
): number | null => {
	if (!relation) return null;
	return RELATION_BY_ID.get(relation)?.gen ?? null;
};

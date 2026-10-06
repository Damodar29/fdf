/**
 * Guru / spiritual-lineage options shared across the app.
 * Both ProfileScreen and DevoteeProfileManager import from here.
 */
export const GURU_OPTIONS = [
	{
		id: "virahi" as const,
		name: 'श्री श्री 1008 श्री वासुदेव शरण जी महाराज "विरही"',
		short: "विरही जी महाराज",
		labelHi: 'श्री श्री 1008 श्री वासुदेव शरण जी महाराज "विरही"',
		labelEn: 'Sri Sri 1008 Sri Vasudev Sharan Ji Maharaj "Virahi"',
	},
	{
		id: "chakradhar" as const,
		name: 'श्री श्रील गुरुदेव "भक्तिशास्त्री" जी महाराज',
		short: "भक्तिशास्त्री जी महाराज",
		labelHi: 'श्री श्रील गुरुदेव "भक्तिशास्त्री" जी महाराज',
		labelEn: 'Sri Srila Gurudev "Bhaktishastri" Ji Maharaj',
	},
	{
		id: "harekrishna" as const,
		name: "श्री श्री हरे कृष्ण दास जी महाराज",
		short: "हरे कृष्ण दास जी महाराज",
		labelHi: "श्री श्री हरे कृष्ण दास जी महाराज",
		labelEn: "Sri Sri Hare Krishna Das Ji Maharaj",
	},
	{
		id: "other" as const,
		name: "अन्य (Other)",
		short: "अन्य",
		labelHi: "अन्य (Other)",
		labelEn: "Other",
	},
	{
		id: "aspiring" as const,
		name: "आकांक्षी (Aspiring)",
		short: "आकांक्षी",
		labelHi: "आकांक्षी (Aspiring)",
		labelEn: "Aspiring",
	},
] as const;

export type GuruOptionId = (typeof GURU_OPTIONS)[number]["id"];

/**
 * Converts a (selection, customName) pair into the stored guruName string.
 */
export const resolveGuruName = (
	selection: string,
	customName: string,
): string => {
	if (!selection) return "";
	if (selection === "aspiring") return "आकांक्षी";
	if (selection === "other") return customName.trim();
	return GURU_OPTIONS.find((o) => o.id === selection)?.name || "";
};

/**
 * Derives the form (selection, custom) pair from a stored guruName string.
 */
export const deriveGuruSelection = (
	stored: string,
): { selection: GuruOptionId | ""; custom: string } => {
	if (!stored) return { selection: "", custom: "" };
	if (stored === "आकांक्षी") return { selection: "aspiring", custom: "" };
	const preset = GURU_OPTIONS.find(
		(o) => o.id !== "other" && o.id !== "aspiring" && o.name === stored,
	);
	if (preset) return { selection: preset.id, custom: "" };
	return { selection: "other", custom: stored };
};

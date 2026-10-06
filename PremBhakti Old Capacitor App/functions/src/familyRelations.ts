/**
 * Family relation data for the Cloud Functions: a copy of RELATION_INVERSE and
 * the relation genders in src/constants/relations.ts (the app's copy, which
 * has the labels). Keep both identical — `npm run test:relations` checks it.
 *
 * A relation is what the describer calls the other person ("sister").
 */

export type Gender = "male" | "female";

/**
 * relation → what the described person calls the describer, [if the describer
 * is male, if female]. Several ids = can't be known for sure; empty = that
 * relation can't come from someone of that gender.
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
	chacha: [["bhatija"], ["bhatiji"]],
	chachi: [["bhatija"], ["bhatiji"]],
	tau: [["bhatija"], ["bhatiji"]],
	tai: [["bhatija"], ["bhatiji"]],
	uncle_paternal: [["bhatija"], ["bhatiji"]],
	aunt_paternal: [["bhatija"], ["bhatiji"]],
	bua: [["bhatija"], ["bhatiji"]],
	uncle_maternal: [["bhanja"], ["bhanji"]],
	aunt_maternal: [["bhanja"], ["bhanji"]],
	mausi: [["bhanja"], ["bhanji"]],
	phupha: [["nephew"], ["niece"]],
	mausa: [["nephew"], ["niece"]],
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
	jija: [["sala"], ["sali"]],
	sala: [["jija"], []],
	sali: [["jija"], []],
	devar: [[], ["bhabhi"]],
	jeth: [[], []],
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

/** Gender of the person a relation describes ("sister" → female). */
export const RELATION_GENDER: Record<string, Gender> = {
	father: "male",
	mother: "female",
	husband: "male",
	wife: "female",
	son: "male",
	daughter: "female",
	brother: "male",
	sister: "female",
	grandfather_paternal: "male",
	grandmother_paternal: "female",
	grandfather_maternal: "male",
	grandmother_maternal: "female",
	pota: "male",
	poti: "female",
	nati: "male",
	natin: "female",
	grandson: "male",
	granddaughter: "female",
	pardada: "male",
	pardadi: "female",
	parnana: "male",
	parnani: "female",
	great_grandson: "male",
	great_granddaughter: "female",
	chacha: "male",
	chachi: "female",
	tau: "male",
	tai: "female",
	uncle_paternal: "male",
	aunt_paternal: "female",
	bua: "female",
	phupha: "male",
	uncle_maternal: "male",
	aunt_maternal: "female",
	mausi: "female",
	mausa: "male",
	bhatija: "male",
	bhatiji: "female",
	bhanja: "male",
	bhanji: "female",
	nephew: "male",
	niece: "female",
	chachera_bhai: "male",
	chacheri_behen: "female",
	fufera_bhai: "male",
	fuferi_behen: "female",
	mamera_bhai: "male",
	mameri_behen: "female",
	mausera_bhai: "male",
	mauseri_behen: "female",
	father_in_law: "male",
	mother_in_law: "female",
	son_in_law: "male",
	daughter_in_law: "female",
	jija: "male",
	sala: "male",
	devar: "male",
	jeth: "male",
	nandoi: "male",
	sadhu: "male",
	bhabhi: "female",
	nanad: "female",
	sali: "female",
	devrani: "female",
	jethani: "female",
	salhaj: "female",
	brother_in_law: "male",
	sister_in_law: "female",
	samdhi: "male",
	samdhan: "female",
	pot_bahu: "female",
	nat_bahu: "female",
	pot_damad: "male",
	nat_damad: "male",
	dada_sasur: "male",
	dadi_saas: "female",
	nana_sasur: "male",
	nani_saas: "female",
	bhatij_bahu: "female",
	bhanj_bahu: "female",
	bhatiji_damad: "male",
	bhanji_damad: "male",
	uncle_in_law: "male",
	aunt_in_law: "female",
};

const asGender = (value: unknown): Gender | "" =>
	value === "male" || value === "female" ? value : "";

/**
 * The relation the other side of a link gets automatically, or null when it
 * can't be known for sure: several possible answers, an unknown or custom
 * relation, or the described person's gender contradicting the relation.
 */
export const autoInverseRelation = (
	relation: unknown,
	describerGender: unknown,
	describedGender: unknown,
): string | null => {
	if (typeof relation !== "string" || !relation) return null;
	const entry = RELATION_INVERSE[relation];
	if (!entry) return null;
	const described = asGender(describedGender);
	const implied = RELATION_GENDER[relation];
	if (implied && described && described !== implied) return null;
	const describer = asGender(describerGender);
	const [ifMale, ifFemale] = entry;
	const options =
		describer === "male"
			? ifMale
			: describer === "female"
				? ifFemale
				: [...new Set([...ifMale, ...ifFemale])];
	return options.length === 1 ? options[0] : null;
};

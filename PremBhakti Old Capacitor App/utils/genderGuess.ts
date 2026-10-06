import { type Gender, relationGender } from "../src/constants/relations";

export interface GenderGuess {
	gender: Gender;
	/** Why — shown to the admin, who still decides. */
	hi: string;
	en: string;
}

const words = (s: unknown) =>
	typeof s === "string"
		? s
				.toLowerCase()
				.replace(/[.,()'"-]/g, " ")
				.split(/\s+/)
				.filter(Boolean)
		: [];

// Last word of a diksha name: "राधा दासी" / "Radha Dasi" → female.
const DIKSHA_FEMALE = [
	"दासी",
	"dasi",
	"dasee",
	"देवी",
	"devi",
	"मंजरी",
	"manjari",
	"सखी",
	"sakhi",
];
const DIKSHA_MALE = ["दास", "das", "dass", "प्रभु", "prabhu"];
// Any word of a real name.
const NAME_FEMALE = [
	"देवी",
	"devi",
	"कुमारी",
	"kumari",
	"बाई",
	"bai",
	"माताजी",
	"mataji",
	"बेन",
	"ben",
];
const NAME_MALE = [
	"कुमार",
	"kumar",
	"लाल",
	"lal",
	"प्रसाद",
	"prasad",
	"प्रभुजी",
	"prabhuji",
];

/**
 * A likely gender for a devotee, for the admin's gender screen — never saved
 * on its own. Strongest first: what linked family call them (all agreeing),
 * then the ending of the diksha name, then common words in the real name.
 */
export function guessGender(
	profile: { realName?: string; dikshaName?: string },
	relationsAboutThem: string[] = [],
): GenderGuess | null {
	const fromFamily = relationsAboutThem
		.map((r) => relationGender(r))
		.filter((g): g is Gender => !!g);
	if (fromFamily.length > 0 && fromFamily.every((g) => g === fromFamily[0])) {
		const n = fromFamily.length;
		return {
			gender: fromFamily[0],
			hi: `${n} लिंक्ड परिजन ने इन्हें ${fromFamily[0] === "female" ? "महिला" : "पुरुष"} रिश्ता दिया है`,
			en: `${n} linked relative${n > 1 ? "s" : ""} gave them a ${fromFamily[0]} relation`,
		};
	}

	const dikshaWords = words(profile.dikshaName);
	const last = dikshaWords[dikshaWords.length - 1];
	if (last && DIKSHA_FEMALE.includes(last))
		return {
			gender: "female",
			hi: `दीक्षित नाम "${last}" पर ख़त्म होता है`,
			en: `Diksha name ends in "${last}"`,
		};
	if (last && DIKSHA_MALE.includes(last))
		return {
			gender: "male",
			hi: `दीक्षित नाम "${last}" पर ख़त्म होता है`,
			en: `Diksha name ends in "${last}"`,
		};

	const name = words(profile.realName);
	const female = name.find((w) => NAME_FEMALE.includes(w));
	const male = name.find((w) => NAME_MALE.includes(w));
	if (female && !male)
		return {
			gender: "female",
			hi: `नाम में "${female}" है`,
			en: `Name has "${female}"`,
		};
	if (male && !female)
		return {
			gender: "male",
			hi: `नाम में "${male}" है`,
			en: `Name has "${male}"`,
		};
	return null;
}

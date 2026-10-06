import type React from "react";
import { Sparkles, Wheat, Gift, Building2 } from "lucide-react-native";

export type Step = "selection" | "payment" | "confirm";
export type PaymentMethod = "upi" | "bank";

export const CONTACTS = {
	NAMAN: "919887880429",
	LUCKY: "919039484855",
};

export const UPI_ID = "9660793593@sbi";

export interface SevaItem {
	labelEn: string;
	labelHi: string;
	amount: number;
}

export interface CartItem {
	id: string;
	sevaId: string;
	titleEn: string;
	titleHi: string;
	amount: number;
	customName?: string | null;
}

export interface SevaOption {
	id: string;
	Icon: typeof Sparkles;
	colorTheme: "pink" | "green" | "orange" | "blue";
	titleEn: string;
	titleHi: string;
	descEn: string;
	descHi: string;
	bankContext: "general" | "gauseva";
	amounts?: number[];
	fixedItems?: SevaItem[];
	tagEn?: string;
	tagHi?: string;
}

export const SEVA_OPTIONS: SevaOption[] = [
	{
		id: "anupam_seva",
		Icon: Sparkles,
		colorTheme: "pink",
		titleEn: "Temple Seva List",
		titleHi: "मंदिर अनुपम सेवा अवसर",
		descEn: "Fixed donation for Bhog, Aarti, Poshak etc.",
		descHi: "आरती, भोग, पोशाक एवं माला सेवा राशि।",
		bankContext: "general",
		tagEn: "Rate List",
		tagHi: "सूची",
		fixedItems: [
			{
				labelHi: "आरती सेवा (धूप, दीप, घी)",
				labelEn: "Aarti Seva (Dhup, Deep)",
				amount: 251,
			},
			{ labelHi: "बाल भोग सेवा", labelEn: "Bal Bhog Seva", amount: 501 },
			{ labelHi: "शयन भोग सेवा", labelEn: "Shayan Bhog Seva", amount: 501 },
			{
				labelHi: "नित्य पुष्प-माला सेवा",
				labelEn: "Nitya Pushp-Mala Seva",
				amount: 751,
			},
			{ labelHi: "संध्या भोग सेवा", labelEn: "Sandhya Bhog Seva", amount: 1100 },
			{
				labelHi: "एकादशी पुष्प-माला सेवा",
				labelEn: "Ekadashi Pushp-Mala Seva",
				amount: 1100,
			},
			{ labelHi: "राजभोग सेवा", labelEn: "Rajbhog Seva", amount: 2100 },
			{
				labelHi: "पोशाक सेवा (गुरु महाराज)",
				labelEn: "Poshak (Guru Maharaj)",
				amount: 2100,
			},
			{
				labelHi: "पोशाक सेवा (जगन्नाथ जी)",
				labelEn: "Poshak (Jagannath Ji)",
				amount: 5100,
			},
			{
				labelHi: "पोशाक सेवा (गोविंद देव जी)",
				labelEn: "Poshak (Govind Dev Ji)",
				amount: 15000,
			},
		],
	},
	{
		id: "gauseva",
		Icon: Wheat,
		colorTheme: "green",
		titleEn: "Gau Seva (Cow Protection)",
		titleHi: "गौ सेवा (गौशाला)",
		descEn: "Feed and protect sacred cows.",
		descHi: "पवित्र गौमाता की सेवा और रक्षा।",
		bankContext: "gauseva",
		tagEn: "Highly Auspicious",
		tagHi: "अति शुभ",
		fixedItems: [
			{
				labelHi: "गौ ग्रास (हरा चारा)",
				labelEn: "Gau Grass (Green Fodder)",
				amount: 251,
			},
			{
				labelHi: "एक दिन की सेवा (चारा-दाना)",
				labelEn: "Full Day Cow Care",
				amount: 1100,
			},
			{
				labelHi: "औषधि सेवा (बीमार गौवंश)",
				labelEn: "Medicine Seva (Sick Cows)",
				amount: 2100,
			},
			{
				labelHi: "विशेष भोग (लापसी/गुड़)",
				labelEn: "Special Feast (Sweet)",
				amount: 3100,
			},
			{ labelHi: "मासिक गौ पालन", labelEn: "Monthly Adoption", amount: 5100 },
			{
				labelHi: "विशाल गौशाला भंडारा",
				labelEn: "Grand Gaushala Feast",
				amount: 11000,
			},
		],
	},
	{
		id: "annadan",
		Icon: Gift,
		colorTheme: "orange",
		titleEn: "Annadan (Prasadam)",
		titleHi: "अन्नदान (प्रसाद सेवा)",
		descEn: "Feed devotees and the needy.",
		descHi: "भक्तों और जरूरतमंदों को भोजन।",
		bankContext: "general",
		tagEn: "Most Popular",
		tagHi: "सबसे लोकप्रिय",
		fixedItems: [
			{ labelHi: "एक साधु भोजन", labelEn: "Single Sadhu Bhojan", amount: 251 },
			{
				labelHi: "बाल भोग (नाश्ता)",
				labelEn: "Bal Bhog (Breakfast)",
				amount: 1100,
			},
			{
				labelHi: "वैष्णव सेवा (लघु समूह)",
				labelEn: "Vaishnav Seva (Small Group)",
				amount: 2100,
			},
			{
				labelHi: "राजभोग सेवा (11 भक्त)",
				labelEn: "Rajbhog Seva (11 Devotees)",
				amount: 5100,
			},
			{
				labelHi: "पूर्ण भंडारा (51 भक्त)",
				labelEn: "Full Bhandara (51 Devotees)",
				amount: 11000,
			},
			{
				labelHi: "विशाल महोत्सव भंडारा",
				labelEn: "Grand Festival Feast",
				amount: 21000,
			},
		],
	},
	{
		id: "general",
		Icon: Building2,
		colorTheme: "blue",
		titleEn: "Mandir Construction",
		titleHi: "मंदिर निर्माण सेवा",
		descEn: "Build a home for the Lord.",
		descHi: "प्रभु के धाम निर्माण में सहयोग।",
		bankContext: "general",
	},
];

export const BANK_DETAILS = {
	general: {
		name: "Shri Krishna Chaitanya Prem Bhakti Sangh",
		bank: "HDFC Bank",
		acc: "99950056565656",
		ifsc: "HDFC0001055",
		branch: "Kota",
	},
	gauseva: {
		name: "Shree Krishna Chetnya Prem Bhakti Sankirtan Samiti",
		bank: "State Bank of India",
		acc: "37692935997",
		ifsc: "SBIN0011311",
		branch: "Kota",
	},
} as const;

export const toLocalDateKey = (date: Date = new Date()): string => {
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${m}-${d}`;
};

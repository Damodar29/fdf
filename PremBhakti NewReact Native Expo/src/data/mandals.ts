// src/types/mandal.ts MANDAL_LIST of the Capacitor app (ids, names, short names).
export interface MandalDef {
	id: string;
	name: string;
	shortNameEn: string;
	shortNameHi: string;
}

export const MANDAL_LIST: MandalDef[] = [
	{ id: "semra", name: "Semra Mandal", shortNameEn: "Semra", shortNameHi: "सेमरा" },
	{ id: "gaisabaad", name: "Gaisabaad Mandal", shortNameEn: "Gaisabaad", shortNameHi: "गैसाबाद" },
	{ id: "bharatpur", name: "Bharatpur Mandal", shortNameEn: "Bharatpur", shortNameHi: "भरतपुर" },
	{ id: "indore", name: "Indore Mandal", shortNameEn: "Indore", shortNameHi: "इंदौर" },
	{ id: "khurai", name: "Khurai Mandal", shortNameEn: "Khurai", shortNameHi: "खुरई" },
	{ id: "jhansi", name: "Jhansi Mandal", shortNameEn: "Jhansi", shortNameHi: "झांसी" },
	{ id: "nariaoli", name: "Nariaoli Mandal", shortNameEn: "Nariaoli", shortNameHi: "नारयावली" },
	{ id: "bhopal", name: "Bhopal Mandal", shortNameEn: "Bhopal", shortNameHi: "भोपाल" },
	{ id: "harrai", name: "Harrai Mandal", shortNameEn: "Harrai", shortNameHi: "हर्रई" },
	{ id: "sagar", name: "Sagar Mandal", shortNameEn: "Sagar", shortNameHi: "सागर" },
	{ id: "damoh", name: "Damoh Mandal", shortNameEn: "Damoh", shortNameHi: "दमोह" },
	{ id: "kota", name: "Kota Mandal", shortNameEn: "Kota", shortNameHi: "कोटा" },
];

import type { Book } from "../types";

const RAW_BOOKS_DATA: Book[] = [
	{
		id: "001",
		title:
			'नित्य लीला प्रविष्ट श्रील गुरुदेव "भक्तिशास्त्री" जी महाराज वन्दना एवं प्रणाम मंत्र',
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Guru.Maharaj.Vanadana.pdf",
		sizeBytes: 426241, // 416 KB
		displaySize: "416 KB",
	},
	{
		id: "002",
		title: "प्रेम भक्ति चंद्रिका",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Shri.Prem.Bhakti.Chandrika.pdf",
		sizeBytes: 28835840, // 27.5 MB
		displaySize: "27.5 MB",
	},
	{
		id: "003",
		title: "गौरपार्षद एवं गौडीय वैष्णव-आचार्यों का संक्षिप्त जीवन चरित्र",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Shri.Gaur-Parshad.and.Gaudiya.Vaishnava.Acharyas.pdf",
		sizeBytes: 67108864, // 64 MB
		displaySize: "64 MB",
	},
	{
		id: "004",
		title: "गौरपार्षद एवं गौडीय वैष्णव-आचार्यों का संक्षिप्त जीवन चरित्र भाग 2",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Shri.Gaur.Parshad.-.Part.2.pdf",
		sizeBytes: 42467328, // 40.5 MB
		displaySize: "40.5 MB",
	},
	{
		id: "005",
		title: "उपदेशामृत",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Upadeshamrit.pdf",
		sizeBytes: 40370176, // 38.5 MB
		displaySize: "38.5 MB",
	},
	{
		id: "006",
		title: "गीत रसामृत",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Geet.Rasamrit.pdf",
		sizeBytes: 30408704, // 29 MB
		displaySize: "29 MB",
	},
	{
		id: "007",
		title: "गुरुदेव श्री विरही जी महाराज जीवन चरित्र",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Gurudev.Shri.Virahi.Ji.Maharaj.-.Life.Biography.pdf",
		sizeBytes: 80740352, // 77 MB
		displaySize: "77 MB",
	},
	{
		id: "008",
		title: "गौरांग भजन माला",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Gauranga.Bhajan.Mala.pdf",
		sizeBytes: 71303168, // 68 MB
		displaySize: "68 MB",
	},
	{
		id: "009",
		title: "गौरांग भजन माला भाग 3",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Gauranga.Bhajan.Mala.-.Part.3.pdf",
		sizeBytes: 17301504, // 16.5 MB
		displaySize: "16.5 MB",
	},
	{
		id: "010",
		title: "गौड़ीय गीति गुच्छ",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Gaudiya.Geeti.Guccha.pdf",
		sizeBytes: 628796, // 614 KB
		displaySize: "614 KB",
	},
	{
		id: "011",
		title: "दिगदर्शिका",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Digdarshika.pdf",
		sizeBytes: 33554432, // 32 MB
		displaySize: "32 MB",
	},
	{
		id: "012",
		title: "नाम रसामृत",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Naam.Rasamrit.pdf",
		sizeBytes: 44040192, // 42 MB
		displaySize: "42 MB",
	},
	{
		id: "013",
		title: "प्रेम रसामृत",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Prem.Rasamrit.pdf",
		sizeBytes: 34603008, // 33 MB
		displaySize: "33 MB",
	},
	{
		id: "014",
		title: "भजन गीति",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Bhajan.Geeti.pdf",
		sizeBytes: 512000, // 500 KB
		displaySize: "500 KB",
	},
	{
		id: "015",
		title: "भजन संकलन भूषण",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Bhajan.Sankalan.Bhushan.pdf",
		sizeBytes: 95420416, // 91 MB
		displaySize: "91 MB",
	},
	{
		id: "016",
		title: "राजा प्रभुजी डायरी",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Raja.prabhu.ji.Diary.2.pdf",
		sizeBytes: 136904415, // 130.6 MB
		displaySize: "130.6 MB",
	},
	{
		id: "017",
		title: "शिक्षाष्टकम्",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Shikshashtakam.pdf",
		sizeBytes: 36700160, // 35 MB
		displaySize: "35 MB",
	},
	{
		id: "018",
		title: "अष्टकावली",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Ashtakavalli.pdf",
		sizeBytes: 14155776, // 13.5 MB
		displaySize: "13.5 MB",
	},
	{
		id: "019",
		title: "श्रीमद्भगवद्गीता यथारूप",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Shrimad.Bhagavad.Gita.-.As.It.Is.pdf",
		sizeBytes: 14938622, // 14.2 MB
		displaySize: "14.2 MB",
	},
	{
		id: "020",
		title: "सपार्षद गौर महिमा",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/Books%20PDFs_5/Saparshad.Gaur.Mahima.pdf",
		sizeBytes: 122336, // 119 KB
		displaySize: "119 KB",
	},
	{
		id: "021",
		title: "श्रीमद्भगवद्गीता (विश्वनाथ चक्रवर्ती ठाकुर कृत टीका)",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/more%20books%20pdf_18/Bhagavad-gita-hindi.by.Vishwanath.Chakravarti.teeka.pdf",
		sizeBytes: 4718592, // 4.5 MB
		displaySize: "4.5 MB",
	},
	{
		id: "022",
		title: "गौड़ीय कण्ठहार (हिन्दी, द्वितीय संस्करण)",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/more%20books%20pdf_18/Gaudiya-kanthahara-hindi_2nd_ed.pdf",
		sizeBytes: 1153434, // 1.1 MB
		displaySize: "1.1 MB",
	},
	{
		id: "023",
		title: "श्रील गौर किशोर दास बाबाजी महाराज का जीवन चरित्र",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/more%20books%20pdf_18/Gaur.Kishore.das.babaji.maharaj.biography.pdf",
		sizeBytes: 284672, // 278 KB
		displaySize: "278 KB",
	},
	{
		id: "024",
		title: "जैव धर्म",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/more%20books%20pdf_18/Jaiva-dharma.pdf",
		sizeBytes: 1677722, // 1.6 MB
		displaySize: "1.6 MB",
	},
	{
		id: "025",
		title: "श्रीरामचरितमानस जी",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/more%20books%20pdf_18/ramcharit.manas.ji.pdf",
		sizeBytes: 3270000, // 3.3 MB
		displaySize: "3.3 MB",
	},
	{
		id: "026",
		title: "वैष्णव सदाचार",
		fileName: "PDF",
		url: "https://audios.chaitanyaprembhakti.org/more%20books%20pdf_18/Vaihnav.sadachar.pdf",
		sizeBytes: 48234496, // 46 MB
		displaySize: "46 MB",
	},
];

export const BOOKS_DATA: Book[] = RAW_BOOKS_DATA;

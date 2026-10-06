export interface WeeklyProgram {
	title: string;
	description: string;
	locationUrl: string;
	date: string;
	enabled: boolean;
}

export interface GalleryItem {
	id: string;
	url: string;
	displayName: string;
	date: string;
	order: number;
	type: "darshan" | "activity";
}

export interface TempleTiming {
	id: string;
	eventName: string;
	time: string;
	order: number;
}

export interface MandalVideo {
	id: string;
	title: string;
	url: string;
	date: string; // "YYYY-MM-DD" for grouping with photos
	thumbnailUrl?: string;
	thumbnailXOffset?: number;
	thumbnailYOffset?: number;
	useDefaultThumbnail?: boolean;
	hdUrl?: string;
	description?: string;
	order: number;
}

export interface MandalData {
	id: string;
	name: string;
	weeklyProgram: WeeklyProgram;
	dailyPrograms?: Record<string, WeeklyProgram>;
	gallery: GalleryItem[];
	videos?: MandalVideo[];
	templeTimings?: TempleTiming[];
	/** ISO date (YYYY-MM-DD in IST) of last notification sent, per type */
	lastNotificationSent?: {
		darshan?: string;
		activity?: string;
	};
}

export interface ApprovalRequest {
	id: string;
	mandalId: string;
	mandalName: string;
	type:
		| "weekly_program"
		| "daily_program"
		| "gallery_item"
		| "delete_gallery_item"
		| "edit_gallery_item"
		| "temple_timings";
	data: any;
	status: "pending" | "approved" | "rejected";
	requestedBy: string;
	timestamp: number;
}

export interface AdminRole {
	email: string;
	role: "super" | "mandal" | "custom";
	mandalId?: string;
	permissions?: string[];
}

export const MANDAL_LIST = [
	{
		id: "semra",
		name: "Semra Mandal",
		email: "semra@cpbs.com",
		shortNameEn: "Semra",
		shortNameHi: "सेमरा",
	},
	{
		id: "gaisabaad",
		name: "Gaisabaad Mandal",
		email: "gaisabaad@cpbs.com",
		shortNameEn: "Gaisabaad",
		shortNameHi: "गैसाबाद",
	},
	{
		id: "bharatpur",
		name: "Bharatpur Mandal",
		email: "bharatpur@cpbs.com",
		shortNameEn: "Bharatpur",
		shortNameHi: "भरतपुर",
	},
	{
		id: "indore",
		name: "Indore Mandal",
		email: "indore@cpbs.com",
		shortNameEn: "Indore",
		shortNameHi: "इंदौर",
	},
	{
		id: "khurai",
		name: "Khurai Mandal",
		email: "khurai@cpbs.com",
		shortNameEn: "Khurai",
		shortNameHi: "खुरई",
	},
	{
		id: "jhansi",
		name: "Jhansi Mandal",
		email: "jhansi@cpbs.com",
		shortNameEn: "Jhansi",
		shortNameHi: "झांसी",
	},
	{
		id: "nariaoli",
		name: "Nariaoli Mandal",
		email: "nariaoli@cpbs.com",
		shortNameEn: "Nariaoli",
		shortNameHi: "नारयावली",
	},
	{
		id: "bhopal",
		name: "Bhopal Mandal",
		email: "bhopal@cpbs.com",
		shortNameEn: "Bhopal",
		shortNameHi: "भोपाल",
	},
	{
		id: "harrai",
		name: "Harrai Mandal",
		email: "harrai@cpbs.com",
		shortNameEn: "Harrai",
		shortNameHi: "हर्रई",
	},
	{
		id: "sagar",
		name: "Sagar Mandal",
		email: "sagar@cpbs.com",
		shortNameEn: "Sagar",
		shortNameHi: "सागर",
	},
	{
		id: "damoh",
		name: "Damoh Mandal",
		email: "damoh@cpbs.com",
		shortNameEn: "Damoh",
		shortNameHi: "दमोह",
	},
	{
		id: "kota",
		name: "Kota Mandal",
		email: "kota@cpbs.com",
		shortNameEn: "Kota",
		shortNameHi: "कोटा",
	},
];

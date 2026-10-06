export interface BhajanAudio {
	id: string;
	singer: string;
	url: string; // Direct URL (e.g., Github link ending in .mp3)
	duration?: number; // Duration in seconds
	// Context properties for Playlists
	bhajanTitle?: string;
	parentBhajan?: Bhajan;
}

export interface Bhajan {
	id: string;
	title: string;
	titleIAST: string; // IAST Transliteration
	firstLine: string; // First line of content (Devanagari)
	firstLineIAST: string; // First line of content (IAST)
	content: string;
	contentIAST: string; // IAST Transliteration
	searchIndex: string; // Transliterated content for search (normalized)
	searchTokens: string[]; // Array of normalized words for fuzzy matching
	author?: string; // Hindi/Devanagari Name
	authorIAST?: string; // English/IAST Name
	audio?: BhajanAudio[]; // Array of audio tracks
	songNumber?: string; // Extracted number from the raw text title
	categories?: Record<string, number>; // { categoryId: sequenceInCategory }
	isHidden?: boolean; // Toggles visibility from normal users
}

export interface Book {
	id: string;
	title: string;
	fileName: string;
	url?: string; // Primary URL for online viewing
	sizeBytes?: number; // Pre-calculated size in bytes
	displaySize?: string; // Display string (e.g. "27.5 MB")
	isHidden?: boolean; // Soft-delete: hides from users, admin can restore
}

export interface LectureData {
	id: string;
	title: string;
	description: string; // Used as content
	date?: string;
	audio?: BhajanAudio[];
	isHidden?: boolean; // Soft-delete: hides from users, admin can restore
}

export interface EventData {
	id: string;
	// Legacy fields (kept for compatibility)
	day?: string;
	month?: string;
	year?: string;
	// New Calendar Fields
	date: string; // ISO Date String "YYYY-MM-DD"
	title: string;
	titleHi?: string; // Hindi Title
	description?: string;
	time?: string; // Legacy
	breakTime?: string;
	eventTime?: string;
	location?: string;
	isEkadashi?: boolean;
	type?: "festival" | "ekadashi" | "appearance" | "other";
}

export interface DarshanImage {
	id: string;
	date: string;
	title: string;
	imageUrl: string;
	description?: string;
}

export interface HistoryEntry {
	id: string;
	type: "song" | "book" | "lecture";
	timestamp?: number;
}

export interface DailyQuote {
	dateKey: string; // Format: "1 जनवरी"
	text: string;
	source: string;
}

export interface Playlist {
	id: string;
	name: string;
	items: string[]; // Array of Bhajan IDs
	createdAt: number;
	isDefault?: boolean; // New field for default playlist
}

// Data Structure for Category Rules
export interface CategoryRule {
	id: string;
	label: string;
	specificIds?: string[]; // Matches exact songNumber (e.g. "305")
	keywords?: string[]; // Matches text content (OR logic)
}

export type FontSize = number;
export type ScriptType = "devanagari" | "iast";
export type AppTab =
	| "home"
	| "songs"
	| "books"
	| "library"
	| "downloaded"
	| "lectures";
export type ThemeColor =
	/**
	 * Janmashtami — the default. Krishna blue with a gold accent.
	 * Added with the Janmashtami theme migration; see `src/theme/`.
	 */
	| "janmashtami"
	| "saffron"
	| "pink"
	| "rose"
	| "blue"
	| "purple"
	| "violet"
	| "emerald"
	| "red"
	| "amber"
	| "lime"
	| "teal"
	| "cyan"
	| "sky"
	| "indigo"
	| "fuchsia"
	| "deepBlue";
export type BhajanCategory = string; // Changed to string to support dynamic categories from data file
export type ThemeMode = "light" | "dark" | "auto";

export interface AppSettings {
	darkMode: boolean;
	fontSize: FontSize;
	script: ScriptType;
	keepAwake: boolean;
	themeColor: ThemeColor;
}

export type RepeatMode = "off" | "one" | "all";

export interface DownloadItem {
	progress: number;
	loaded: number; // Bytes loaded
	total: number; // Total bytes
	title: string;
	type: "book" | "audio" | "image";
}

export interface DownloadConfirmation {
	isOpen: boolean;
	itemTitle: string;
	url: string;
	sizeBytes: number;
	type: "book" | "audio";
	onConfirm: () => void;
	onCancel: () => void;
}

export type BannerActionType = "link" | "screen" | "bhajan" | "lecture";
export type BannerScreenTarget =
	| "darshan"
	| "information"
	| "books"
	| "songs"
	| "lectures"
	| "authors"
	| "library"
	| "donate"
	| "about"
	| "events";

export interface BannerConfig {
	id: string;
	enabled: boolean;
	title: string;
	body: string;
	actionType?: BannerActionType;
	actionTarget?: string; // URL or Screen Name
	actionLabel?: string; // Custom label for the button\
	color?: string; // Custom banner color (theme color key like 'saffron', 'blue', etc.)
}

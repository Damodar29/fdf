import type { BhajanAudio, CategoryRule } from "../types";

export type RawBhajanEntry = {
	id: string; // System ID - DO NOT CHANGE (protects saved playlists)
	bhajan_id?: string; // Visible bhajan number shown in the app
	title: string;
	content: string;
	author?: string;
	categories?: Record<string, number>; // { categoryId: sequenceInCategory }
	audio?: BhajanAudio[];
	isHidden?: boolean;
};

// Bhajans are now fetched dynamically from Cloud via DataContext
export const CATEGORY_RULES: CategoryRule[] = [];
export const BHAJANS_DATA: RawBhajanEntry[] = [];

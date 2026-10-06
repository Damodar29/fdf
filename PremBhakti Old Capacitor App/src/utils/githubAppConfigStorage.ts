/**
 * src/utils/githubAppConfigStorage.ts
 *
 * Saves and reads app config (categories, authors) via Firebase Storage SDK.
 * Replaces the previous Firebase Function (saveAppConfig) approach.
 *
 * WRITE: Direct Firebase Storage SDK upload (instant, no cold start)
 * READ:  CDN Worker → Firebase Storage (via fetchFirebaseStorageJson in network.ts)
 */

import type { AuthorDef } from "../../data/authors";
import { saveJsonToStorage } from "../../utils/firebaseDataStorage";
import { fetchFirebaseStorageJson } from "../../utils/network";

const TAG = "appconfig";

// ── Types ──

export interface FilterCategoryDef {
	id: string;
	labelHi: string;
	labelEn: string;
	keywords: string[];
	order: number;
}

export interface CategoriesData {
	categories: FilterCategoryDef[];
	updatedAt?: number;
}

export interface AuthorsData {
	authors: Record<string, AuthorDef>;
	updatedAt?: number;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export const fetchCategoriesFromFirebase =
	async (): Promise<CategoriesData | null> => {
		try {
			const data = await fetchFirebaseStorageJson(TAG, "categories.json", {
				freshFetch: true,
			});
			return data as CategoriesData;
		} catch {
			return null;
		}
	};

export const fetchAuthorsFromFirebase =
	async (): Promise<AuthorsData | null> => {
		try {
			const data = await fetchFirebaseStorageJson(TAG, "authors.json", {
				freshFetch: true,
			});
			return data as AuthorsData;
		} catch {
			return null;
		}
	};

// ── Save ─────────────────────────────────────────────────────────────────────

export const saveCategoriesConfig = async (
	categories: FilterCategoryDef[],
	onProgress?: (msg: string) => void,
): Promise<boolean> => {
	try {
		onProgress?.("Saving categories...");
		const contentToSave: CategoriesData = { categories, updatedAt: Date.now() };
		await saveJsonToStorage(TAG, "categories.json", contentToSave);
		onProgress?.("Done!");
		return true;
	} catch (error: any) {
		console.error("saveCategoriesConfig Error:", error);
		throw new Error(
			error?.message || "Failed to save categories to Firebase Storage",
		);
	}
};

export const saveAuthorsConfig = async (
	authors: Record<string, AuthorDef>,
	onProgress?: (msg: string) => void,
): Promise<boolean> => {
	try {
		onProgress?.("Saving authors...");
		const contentToSave: AuthorsData = { authors, updatedAt: Date.now() };
		await saveJsonToStorage(TAG, "authors.json", contentToSave);
		onProgress?.("Done!");
		return true;
	} catch (error: any) {
		console.error("saveAuthorsConfig Error:", error);
		throw new Error(
			error?.message || "Failed to save authors to Firebase Storage",
		);
	}
};

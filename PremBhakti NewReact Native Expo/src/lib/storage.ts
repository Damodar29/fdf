import { createMMKV } from "react-native-mmkv";

// Replaces the web app's localStorage/safeLocalSet usage
// (context/DataContext.tsx, SettingsContext.tsx). Synchronous native storage —
// far faster than AsyncStorage for the large cached JSON content bundles.
// MMKV v4 exposes a createMMKV() factory; `MMKV` is a type only.
export const storage = createMMKV({ id: "prem-bhakti-storage" });

export function getObject<T>(key: string): T | undefined {
	const raw = storage.getString(key);
	if (raw === undefined) return undefined;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return undefined;
	}
}

export function setObject<T>(key: string, value: T): void {
	storage.set(key, JSON.stringify(value));
}

export function remove(key: string): void {
	storage.remove(key);
}

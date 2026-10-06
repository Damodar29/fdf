/**
 * safeLocalSet.ts
 *
 * A drop-in replacement for localStorage.setItem that never throws.
 *
 * Android WebView localStorage quota is ~5 MB. When full, the browser throws
 * `QuotaExceededError` (a DOMException) which — if uncaught — propagates up
 * through React and crashes the app with a white screen.
 *
 * Usage: import { safeLocalSet } from '../utils/safeLocalSet';
 *        safeLocalSet('my_key', JSON.stringify(data));
 *
 * On quota error: logs a console.warn, skips the write.
 * In-memory state is unaffected — the app continues working normally.
 *
 * Returns true when the value was actually stored, so callers that treat a write
 * as "this data is now safe" (draft auto-save, for one) can tell a real save
 * apart from a swallowed failure instead of reporting a save that never happened.
 */
export function safeLocalSet(key: string, value: string): boolean {
	try {
		localStorage.setItem(key, value);
		return true;
	} catch (e: any) {
		// DOMException: QuotaExceededError / NS_ERROR_DOM_QUOTA_REACHED
		console.warn(
			`[safeLocalSet] Write failed for "${key}" (${e?.name ?? "unknown"}). Storage may be full.`,
		);
		return false;
	}
}

/**
 * The read half of the same problem: an Android WebView with site data blocked
 * throws `SecurityError` on plain `localStorage` access. Reads happen inside
 * render paths and effects, where an uncaught throw is a white screen.
 *
 * Returns null when the value is missing *or* unreadable — callers only ever
 * need "is the flag there?", and treating unreadable as absent is the safe
 * default.
 */
export function safeLocalGet(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch (e: any) {
		console.warn(
			`[safeLocalGet] Read failed for "${key}" (${e?.name ?? "unknown"}).`,
		);
		return null;
	}
}

/**
 * Deleting can throw for the same reason reading can (site data blocked), and
 * deletes happen on paths where a throw would be worse than the leftover value —
 * dropping a draft that has become stale, cleaning up after account deletion.
 */
export function safeLocalRemove(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch (e: any) {
		console.warn(
			`[safeLocalRemove] Delete failed for "${key}" (${e?.name ?? "unknown"}).`,
		);
	}
}

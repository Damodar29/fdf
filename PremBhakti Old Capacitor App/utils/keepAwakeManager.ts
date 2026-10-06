/**
 * keepAwakeManager.ts
 *
 * Reference-counted wrapper around @capacitor-community/keep-awake.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The plugin is not a wake-lock API. It toggles a single, global Android window
 * flag:
 *
 *   keepAwake()  → window.addFlags(FLAG_KEEP_SCREEN_ON)
 *   allowSleep() → window.clearFlags(FLAG_KEEP_SCREEN_ON)
 *
 * There is exactly one flag for the whole Activity, so every caller shares it.
 * Previously AudioContext and BhajanReader each called the plugin directly and
 * fought over it:
 *
 *  - AudioContext ran `allowSleep()` on mount whenever nothing was playing —
 *    i.e. on EVERY app launch — clearing a flag BhajanReader may have set.
 *  - BhajanReader's unmount cleanup ran `allowSleep()` unconditionally, killing
 *    the flag even while audio was still playing with the setting enabled.
 *
 * Dropping the flag makes Android immediately re-evaluate the screen-off
 * timeout against the last user-activity timestamp, so a stray release can turn
 * the display off (and lock the device) seconds after launch.
 *
 * This module fixes that by tracking WHO wants the screen awake. The native
 * flag is only set when the first holder acquires it, and only cleared when the
 * last holder releases it.
 *
 * Owners are identified by a stable string key, which makes both calls
 * idempotent: acquiring twice for the same owner is a no-op, and a single
 * release always fully retires that owner. That matters because React effects
 * can re-run without an intervening cleanup.
 */

import { Capacitor } from "@capacitor/core";
import { KeepAwake } from "@capacitor-community/keep-awake";

/** Stable owner keys. Add a new one rather than reusing an existing key. */
export const KeepAwakeOwner = {
	AUDIO_PLAYBACK: "audio-playback",
	BHAJAN_READER: "bhajan-reader",
} as const;

export type KeepAwakeOwnerKey =
	(typeof KeepAwakeOwner)[keyof typeof KeepAwakeOwner];

const holders = new Set<string>();

// The plugin calls are async and hop to the Android main thread. Without
// serialising them, a fast acquire→release→acquire (e.g. a play/pause tap
// burst) can land out of order and leave the flag in the wrong state.
let queue: Promise<void> = Promise.resolve();

/** Desired state at the time of the last enqueue, so we skip redundant calls. */
let lastAppliedState: boolean | null = null;

const applyNativeState = (shouldKeepAwake: boolean): void => {
	if (!Capacitor.isNativePlatform()) return;
	if (lastAppliedState === shouldKeepAwake) return;

	lastAppliedState = shouldKeepAwake;

	queue = queue
		.then(() =>
			shouldKeepAwake ? KeepAwake.keepAwake() : KeepAwake.allowSleep(),
		)
		.then(() => undefined)
		.catch((e) => {
			console.warn("[keepAwakeManager] Native call failed:", e);
			// Re-sync so the next request retries instead of assuming success.
			lastAppliedState = null;
		});
};

/**
 * Register `owner` as wanting the screen kept awake.
 * The native flag is set on the first holder.
 */
export const requestKeepAwake = (owner: KeepAwakeOwnerKey): void => {
	if (holders.has(owner)) return;
	holders.add(owner);
	applyNativeState(true);
};

/**
 * Retire `owner`'s claim on the screen.
 * The native flag is cleared only once no holders remain.
 */
export const releaseKeepAwake = (owner: KeepAwakeOwnerKey): void => {
	if (!holders.delete(owner)) return;
	if (holders.size === 0) applyNativeState(false);
};

/**
 * Convenience for effects that mirror a boolean: acquires or releases `owner`
 * to match `shouldKeepAwake`.
 */
export const setKeepAwakeFor = (
	owner: KeepAwakeOwnerKey,
	shouldKeepAwake: boolean,
): void => {
	if (shouldKeepAwake) requestKeepAwake(owner);
	else releaseKeepAwake(owner);
};

/** Test/debug helper — the set of owners currently holding the flag. */
export const getKeepAwakeHolders = (): string[] => Array.from(holders);

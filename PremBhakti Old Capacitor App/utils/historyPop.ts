/**
 * historyPop.ts
 *
 * One shared latch for "a history traversal we asked for is still in flight".
 *
 * `history.pushState`/`replaceState` are synchronous, but `history.back()` is
 * NOT: the entry only changes when the browser dispatches `popstate`, which on a
 * mid-range Android phone can be tens of milliseconds later. Until then
 * `window.history.state` still describes the entry we are trying to leave.
 *
 * Almost every "close the topmost thing" decision in this app is made by reading
 * `window.history.state?.view`, so a second back press inside that window reads
 * the same stale state, concludes the same overlay is still on top, and queues a
 * *second* traversal — popping one entry too many. Real symptom this was written
 * for: tapping X on a Profile bottom sheet and then pressing hardware back
 * closed the entire Profile screen (and threw away unsaved form edits), because
 * the second traversal popped the `profile` entry itself.
 *
 * The contract is two-sided and both sides are required:
 *   - anything that walks history back in response to a back gesture calls
 *     `popHistory()` instead of `window.history.back()`;
 *   - anything that decides what a back gesture means calls
 *     `historyPopInFlight()` first and drops the gesture if it returns true.
 *
 * A press that is dropped is still "handled" — swallowing it is the whole point,
 * since the traversal already on its way will do the closing.
 */

let inFlight = 0;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

const clearSafetyTimer = () => {
	if (safetyTimer) {
		clearTimeout(safetyTimer);
		safetyTimer = null;
	}
};

const release = () => {
	if (inFlight > 0) inFlight--;
	if (inFlight === 0) clearSafetyTimer();
};

/* Subscribed at import time, not on first use. `popstate` fires on `window`
   itself, so every listener runs in the AT_TARGET phase in *registration* order
   and the capture flag buys no priority — the only way to be sure the count is
   already correct when the app's own popstate handlers run is to register before
   any of them, and module evaluation happens before React mounts anything. */
if (typeof window !== "undefined") {
	window.addEventListener("popstate", release);
}

/** True while at least one traversal we requested has not landed yet. */
export function historyPopInFlight(): boolean {
	return inFlight > 0;
}

/**
 * `window.history.back()` plus the bookkeeping that keeps `historyPopInFlight()`
 * true until the resulting `popstate` arrives.
 */
export function popHistory(): void {
	inFlight++;
	// A traversal that never lands (no entry to go back to, WebView quirk, page
	// swap) must not wedge the back button forever, so give up after a second and
	// let gestures through again. Long enough that no real popstate loses the
	// race; short enough that a stuck latch is never user-visible.
	clearSafetyTimer();
	safetyTimer = setTimeout(() => {
		safetyTimer = null;
		inFlight = 0;
	}, 1000);
	window.history.back();
}

/**
 * Runs `cb` once no traversal we asked for is still in flight — for opening a
 * popup (which pushes an entry) right after closing another (which pops one).
 * Pushing while the pop is still travelling lets the pop eat the new entry.
 */
export function afterHistorySettles(cb: () => void): void {
	if (!historyPopInFlight()) {
		cb();
		return;
	}
	let done = false;
	const run = () => {
		if (done) return;
		done = true;
		window.removeEventListener("popstate", onPop);
		// After every popstate listener has seen the landed entry.
		setTimeout(cb, 0);
	};
	const onPop = () => run();
	window.addEventListener("popstate", onPop);
	// Same give-up window as popHistory's safety latch.
	setTimeout(run, 1000);
}

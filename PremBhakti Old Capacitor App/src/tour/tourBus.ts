/**
 * tourBus.ts — the tiny, always-loaded side of the guided product tour.
 *
 * The tour itself (`ProductTour.tsx`) is lazy-loaded after startup. Screens
 * still need to talk to it before or without loading it, so everything they
 * import lives here and stays cheap: no React tree, no Firebase, no config.
 *
 *  - `requestTourReplay()`  — the "App Tour" / "Replay guided tour" buttons.
 *    If the tour chunk has not loaded yet the request waits for it.
 *  - `markDeepLinkNavigation()` — called where a notification or deep link
 *    navigates by itself, so the screen it opens does not start its chapter
 *    on top of content the person came to see (it runs on a later visit).
 *  - `emitTourUi()` / `useTourUiAction()` — lets a tour step ask a screen to
 *    get ready (open its search bar, switch a sub-tab) without the screen
 *    knowing anything else about the tour.
 */
import { useEffect, useRef } from "react";

// ── Replay ──────────────────────────────────────────────────────────────────

let replayPending = false;
const replayListeners = new Set<() => void>();

export function requestTourReplay(): void {
	replayPending = true;
	for (const listener of replayListeners) {
		try {
			listener();
		} catch {
			/* the tour must never break the button that asked for it */
		}
	}
}

/** Returns true (once) if a replay was requested and not handled yet. */
export function consumeTourReplay(): boolean {
	const pending = replayPending;
	replayPending = false;
	return pending;
}

export function onTourReplay(listener: () => void): () => void {
	replayListeners.add(listener);
	return () => {
		replayListeners.delete(listener);
	};
}

// ── Deep links / notifications ──────────────────────────────────────────────

let lastDeepLinkAt = 0;

export function markDeepLinkNavigation(): void {
	lastDeepLinkAt = Date.now();
}

export function getLastDeepLinkAt(): number {
	return lastDeepLinkAt;
}

// ── Screen preparation for individual steps ─────────────────────────────────

export type TourUiAction =
	| { type: "bhajans-search"; open: boolean }
	/** Show the filter sheet as a preview — no history entry of its own. */
	| { type: "bhajans-filter"; open: boolean }
	| {
			type: "audio-subtab";
			tab: "bhajans" | "kathas" | "singers" | "playlists";
	  }
	| { type: "library-tab"; tab: "history" | "authors" };

const TOUR_UI_EVENT = "cpbs:tour-ui";

export function emitTourUi(action: TourUiAction): void {
	try {
		window.dispatchEvent(
			new CustomEvent<TourUiAction>(TOUR_UI_EVENT, { detail: action }),
		);
	} catch {
		/* no-op */
	}
}

/** Lets a screen react to `emitTourUi()`. The handler may change every render. */
export function useTourUiAction(handler: (action: TourUiAction) => void): void {
	const handlerRef = useRef(handler);
	handlerRef.current = handler;
	useEffect(() => {
		const listener = (event: Event) => {
			const action = (event as CustomEvent<TourUiAction>).detail;
			if (action) handlerRef.current(action);
		};
		window.addEventListener(TOUR_UI_EVENT, listener);
		return () => window.removeEventListener(TOUR_UI_EVENT, listener);
	}, []);
}

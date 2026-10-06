import { useCallback, useEffect, useRef } from "react";
import { popHistory } from "../../utils/historyPop";
import { nextBackSeq, runAdminBack } from "./useAdminBack";

// History entries of popups that are open right now (view id → count).
const openPopupViews = new Map<string, number>();
const markOpen = (viewId: string) =>
	openPopupViews.set(viewId, (openPopupViews.get(viewId) || 0) + 1);
const markClosed = (viewId: string) => {
	const n = (openPopupViews.get(viewId) || 0) - 1;
	if (n > 0) openPopupViews.set(viewId, n);
	else openPopupViews.delete(viewId);
};

/**
 * True when `view` is the history entry of a popup that is still open. A
 * popstate that lands on such an entry means something ABOVE that popup was
 * popped (e.g. a "saving…" blocker removing its own entry), not a back press
 * meant for whatever sits below the popup.
 */
export const isOpenPopupView = (view: unknown): boolean =>
	typeof view === "string" && openPopupViews.has(view);

// Entries of popups that closed while something else was on top of their entry
// (typically a "saving…" blocker), so their entry could not be popped then.
const staleViews = new Set<string>();

/* When history lands on such a dead entry, skip it: stop this popstate before
   the app's handlers treat it as a back press, and step back once more to the
   entry below. Registered at import time, so it runs before any component's
   listener (historyPop's latch, imported above, still runs first). */
if (typeof window !== "undefined") {
	window.addEventListener("popstate", (e) => {
		const view = e.state?.view;
		if (
			typeof view !== "string" ||
			!staleViews.has(view) ||
			openPopupViews.has(view)
		)
			return;
		staleViews.delete(view);
		e.stopImmediatePropagation();
		popHistory();
	});
}

/**
 * A custom hook to handle the hardware back button for modals/popups.
 *
 * Strategy:
 * - When popup opens → save the current (parent) state, then pushState with { isPopup: true, view: viewId }
 * - Hardware back → popstate fires, we detect our state was popped, call onClose
 * - UI Cancel/X button → we call onClose immediately and replaceState BACK to the saved parent state.
 *   NO history.back() is called, so NO popstate event fires and no parent handlers cascade.
 *   Restoring the parent state (instead of a neutral '__cleaned' marker) means no dead placeholder
 *   entries accumulate in history.
 */
export function usePopupBackHandler(
	isOpen: boolean,
	viewId: string,
	onClose: () => void,
) {
	const onCloseRef = useRef(onClose);
	const pushedRef = useRef(false);
	// Save the parent history state before we push, so we can restore it on UI-close
	const parentStateRef = useRef<any>(null);
	// When this popup opened, relative to useAdminBack layers.
	const openSeqRef = useRef(0);

	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	// Push history entry when popup opens
	useEffect(() => {
		if (isOpen) {
			if (!pushedRef.current && window.history.state?.view !== viewId) {
				// Capture the parent state BEFORE we push
				parentStateRef.current = window.history.state;
				window.history.pushState({ isPopup: true, view: viewId }, "");
				pushedRef.current = true;
				openSeqRef.current = nextBackSeq();
				markOpen(viewId);
				staleViews.delete(viewId);
			}
		} else {
			// Normally a caller closes via the `closePopup` this hook returns,
			// which pops our entry and sets pushedRef.current = false BEFORE
			// isOpen ever flips. If pushedRef.current is still true here, the
			// caller flipped `isOpen` some other way (e.g. state driven by an
			// unrelated async result) — our entry was never popped, so pop it
			// now. Otherwise it lingers in history and a later hardware back
			// press consumes it instead of the entry the user actually means.
			if (pushedRef.current) {
				if (window.history.state?.view === viewId) popHistory();
				// Something is above our entry: it gets skipped once history lands on it.
				else staleViews.add(viewId);
			}
			if (openSeqRef.current) markClosed(viewId);
			openSeqRef.current = 0;
			pushedRef.current = false;
			parentStateRef.current = null;
		}
	}, [isOpen, viewId]);

	// Unmounted while open (e.g. its screen closed): no longer an open popup.
	useEffect(
		() => () => {
			if (openSeqRef.current) markClosed(viewId);
			openSeqRef.current = 0;
		},
		[viewId],
	);

	// Hardware back button: popstate listener
	useEffect(() => {
		if (!isOpen) return;

		const handler = (e: PopStateEvent) => {
			// If our popup was the top state and the user pressed back,
			// the browser popped our entry. The new state won't match our viewId.
			// But we also need to make sure we only react if WE actually pushed a state.
			if (pushedRef.current && e.state?.view !== viewId) {
				// Something opened inside this popup without its own history entry
				// (an inline edit, a sub-view — see useAdminBack) closes first; the
				// popup stays and its entry is put back.
				if (runAdminBack(openSeqRef.current)) {
					window.history.pushState({ isPopup: true, view: viewId }, "");
					return;
				}
				pushedRef.current = false;
				onCloseRef.current();
			}
		};
		window.addEventListener("popstate", handler);
		return () => window.removeEventListener("popstate", handler);
	}, [isOpen, viewId]);

	// UI-triggered close (Cancel / X button)
	const closePopup = useCallback(() => {
		// If we pushed state, and we are still the top state, we must pop it!
		// This naturally restores parent state AND cleans history!
		if (pushedRef.current && window.history.state?.view === viewId) {
			pushedRef.current = false; // Prevent popstate handler from reacting again
			popHistory();
		}

		// Close the UI immediately
		onCloseRef.current();
	}, [viewId]);

	return closePopup;
}

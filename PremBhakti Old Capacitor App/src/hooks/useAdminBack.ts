import { useEffect, useRef } from "react";

/**
 * Hardware back for screen states that don't push a history entry of their
 * own: a sub-view, an inline edit form, an open folder, a dropdown, a
 * confirmation box.
 *
 * The Admin Panel keeps a single history marker for its whole session, and a
 * popup using `usePopupBackHandler` keeps one entry. When back pops either of
 * them, the most recently opened active layer *above* it is asked first: it
 * closes itself and the entry is re-armed. Without this, back from e.g. an open
 * Gallery folder closed the entire screen, and back from an inline edit inside
 * the bhajan editor closed the editor and dropped the draft.
 */

type Layer = {
	seq: number;
	onBack: { current: () => void };
	blocking: boolean;
};

const layers: Layer[] = [];
let seqCounter = 0;

/** Ordering stamp shared by layers and popups (usePopupBackHandler). */
export const nextBackSeq = () => ++seqCounter;

/**
 * While `active`, hardware back calls `onBack` instead of leaving the screen
 * or closing the popup this state lives in. The layer opened last is asked
 * first, so a dropdown inside a form closes before the form does.
 *
 * `blocking` layers (e.g. "upload in progress") win over everything else —
 * `onBack` should explain why back is held, not close anything.
 */
export function useAdminBack(
	active: boolean,
	onBack: () => void,
	options?: { blocking?: boolean },
) {
	const onBackRef = useRef(onBack);
	useEffect(() => {
		onBackRef.current = onBack;
	}, [onBack]);

	const blocking = !!options?.blocking;
	useEffect(() => {
		if (!active) return;
		const layer: Layer = { seq: nextBackSeq(), onBack: onBackRef, blocking };
		layers.push(layer);
		return () => {
			const i = layers.indexOf(layer);
			if (i >= 0) layers.splice(i, 1);
		};
	}, [active, blocking]);
}

/**
 * Lets the newest layer opened after `sinceSeq` handle a back press.
 * True when one did. `sinceSeq` 0 = any layer (the Admin Panel's marker).
 */
export function runAdminBack(sinceSeq = 0): boolean {
	const above = layers.filter((l) => l.seq > sinceSeq);
	const layer =
		[...above].reverse().find((l) => l.blocking) || above[above.length - 1];
	if (!layer) return false;
	layer.onBack.current();
	return true;
}

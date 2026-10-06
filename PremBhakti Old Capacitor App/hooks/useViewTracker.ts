import { useCallback, useEffect, useRef } from "react";

/**
 * Counts an item as "viewed" once it has actually been on screen for a moment,
 * so that scrolling through a date's photos counts views without the user having
 * to open every photo full-screen.
 *
 * Deliberately NOT "count everything in the open date": that would credit a view
 * to photos further down that the user never reached. Only what genuinely came
 * into view is counted, so the numbers keep meaning "this many people saw it".
 *
 * Ids are queued and handed to `onViewed` in batches, because the caller writes
 * them to a single Firestore document — see `incrementViews` in useMetrics for
 * why one batched write matters instead of one write per item.
 *
 * Usage:
 *   const track = useViewTracker(incrementViews);
 *   …
 *   <div ref={track(item.id)}>            // attach to the item's outer wrapper
 */

/** Visible fraction of the element that counts as "on screen". */
const DEFAULT_RATIO = 0.5;
/** How long it must stay that visible before it counts — filters out fast scrolls. */
const DEFAULT_DWELL_MS = 1000;
/** How long to gather newly-qualified ids before flushing them as one batch. */
const DEFAULT_FLUSH_MS = 700;
/**
 * A photo taller than the viewport can never reach DEFAULT_RATIO of ITSELF, so
 * ratio alone would never count tall portrait shots. Treat "fills this much of
 * the viewport" as visible too.
 */
const VIEWPORT_FILL = 0.6;

export interface ViewTrackerOptions {
	ratio?: number;
	dwellMs?: number;
	flushMs?: number;
	/** Set false to suspend tracking (e.g. while a full-screen viewer is open). */
	enabled?: boolean;
}

export function useViewTracker(
	onViewed: (ids: string[]) => void,
	options: ViewTrackerOptions = {},
) {
	const {
		ratio = DEFAULT_RATIO,
		dwellMs = DEFAULT_DWELL_MS,
		flushMs = DEFAULT_FLUSH_MS,
		enabled = true,
	} = options;

	// Kept in a ref so the observer closure always calls the current callback
	// without having to tear the observer down when the caller re-renders.
	const onViewedRef = useRef(onViewed);
	onViewedRef.current = onViewed;
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;

	const observerRef = useRef<IntersectionObserver | null>(null);
	const idByEl = useRef(new Map<Element, string>());
	const elById = useRef(new Map<string, Element>());
	const dwellTimers = useRef(new Map<Element, number>());
	/** Ids already queued/sent this session — cheap guard on top of the caller's own dedup. */
	const counted = useRef(new Set<string>());
	const pending = useRef(new Set<string>());
	const flushTimer = useRef<number | null>(null);
	/**
	 * Ref callbacks memoised per id. Without this each render would hand React a
	 * brand-new callback, React would detach and re-attach every element, and the
	 * dwell timers would reset — so on a screen that re-renders often (these
	 * screens re-render on every metrics snapshot) nothing would ever reach the
	 * dwell threshold and no view would ever be counted.
	 */
	const refCache = useRef(new Map<string, (el: HTMLElement | null) => void>());

	const flush = useCallback(() => {
		if (flushTimer.current !== null) {
			clearTimeout(flushTimer.current);
			flushTimer.current = null;
		}
		if (pending.current.size === 0) return;
		const batch = Array.from(pending.current);
		pending.current.clear();
		try {
			onViewedRef.current(batch);
		} catch (err) {
			console.error("useViewTracker: onViewed failed", err);
		}
	}, []);

	const scheduleFlush = useCallback(() => {
		if (flushTimer.current !== null) return;
		flushTimer.current = window.setTimeout(() => {
			flushTimer.current = null;
			flush();
		}, flushMs);
	}, [flush, flushMs]);

	const clearDwell = useCallback((el: Element) => {
		const t = dwellTimers.current.get(el);
		if (t !== undefined) {
			clearTimeout(t);
			dwellTimers.current.delete(el);
		}
	}, []);

	const getObserver = useCallback((): IntersectionObserver | null => {
		if (observerRef.current) return observerRef.current;
		// Very old WebViews have no IntersectionObserver. Degrade to "no extra
		// view counting" rather than throwing — full-screen counting still works.
		if (
			typeof window === "undefined" ||
			typeof IntersectionObserver === "undefined"
		) {
			return null;
		}

		observerRef.current = new IntersectionObserver(
			(entries) => {
				if (!enabledRef.current) return;
				for (const entry of entries) {
					const el = entry.target;
					const id = idByEl.current.get(el);
					if (!id) continue;

					const fillsViewport =
						!!entry.rootBounds &&
						entry.rootBounds.height > 0 &&
						entry.intersectionRect.height >=
							entry.rootBounds.height * VIEWPORT_FILL;
					const isVisible =
						entry.isIntersecting &&
						(entry.intersectionRatio >= ratio || fillsViewport);

					if (!isVisible) {
						clearDwell(el);
						continue;
					}
					if (counted.current.has(id) || dwellTimers.current.has(el)) continue;

					const timer = window.setTimeout(() => {
						dwellTimers.current.delete(el);
						if (counted.current.has(id)) return;
						counted.current.add(id);
						pending.current.add(id);
						// Nothing more to learn about this element.
						observerRef.current?.unobserve(el);
						scheduleFlush();
					}, dwellMs);
					dwellTimers.current.set(el, timer);
				}
			},
			// Several thresholds so tall images still produce callbacks even when
			// their ratio can never cross `ratio`.
			{ threshold: [0, 0.25, 0.5, 0.75, 1] },
		);
		return observerRef.current;
	}, [ratio, dwellMs, clearDwell, scheduleFlush]);

	const track = useCallback(
		(id: string) => {
			let cb = refCache.current.get(id);
			if (!cb) {
				// Keep the cache from growing without bound on very large galleries.
				if (refCache.current.size > 2000) refCache.current.clear();
				cb = (el: HTMLElement | null) => {
					const previous = elById.current.get(id);
					if (previous && previous !== el) {
						observerRef.current?.unobserve(previous);
						clearDwell(previous);
						idByEl.current.delete(previous);
						elById.current.delete(id);
					}
					if (!el) return;
					// Already counted — no need to watch it again.
					if (counted.current.has(id)) return;
					elById.current.set(id, el);
					idByEl.current.set(el, id);
					getObserver()?.observe(el);
				};
				refCache.current.set(id, cb);
			}
			return cb;
		},
		[clearDwell, getObserver],
	);

	// Flush when the app goes to the background or the page is being torn down,
	// otherwise a user who scrolls and immediately switches away loses the batch.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") flush();
		};
		const onPageHide = () => flush();
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", onPageHide);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", onPageHide);
		};
	}, [flush]);

	// Unmount: send whatever is queued, then drop every timer and observer.
	useEffect(() => {
		return () => {
			for (const t of dwellTimers.current.values()) clearTimeout(t);
			dwellTimers.current.clear();
			flush();
			observerRef.current?.disconnect();
			observerRef.current = null;
			idByEl.current.clear();
			elById.current.clear();
			refCache.current.clear();
		};
	}, [flush]);

	return track;
}

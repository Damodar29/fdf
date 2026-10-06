/**
 * ProductTour.tsx — the guided product tour: engine, spotlight and tooltip.
 *
 * Loaded lazily by `TourHost` a moment after startup, so it costs nothing on
 * the critical path. Chapters and their text live in `tourSteps.ts`; saved
 * progress in `useTourProgress.ts`.
 *
 * How a chapter starts
 *  - Its `trigger` is true (its screen is on top), it has unseen steps, and
 *    nothing blocks the tour (splash, intro slides, update screens, the daily
 *    quote, the admin panel, a focused text field / open keyboard).
 *  - The screen has been open ~1 s, the person has not touched or scrolled
 *    for ~1 s, and the chapter's first target has been visible for ~0.8 s.
 *  - Screens opened by a notification or deep link wait for a later visit.
 *  - One chapter at a time; `core` wins a tie because it is listed first.
 *
 * While a chapter runs
 *  - A full-screen layer (z 990: above every screen and popup, below Toast
 *    and the forced-update screens) catches every touch, so nothing reaches
 *    the app: no taps, tab swipes or scrolling. Tapping the highlight = Next.
 *  - A step whose element never shows up (~2.5 s, or at once for optional
 *    steps) is skipped quietly; the tour never waits forever.
 *  - Leaving the screen ends the chapter quietly and counts it as seen. A
 *    blocker (keyboard, quote popup, update screen) only pauses it.
 *  - Back button: the first press shows a hint, a second press within 3 s
 *    closes this chapter (it is pushed as history view "tour").
 *
 * Any failure stops the tour silently; `TourHost` wraps it in its own error
 * boundary so nothing reaches `GlobalErrorBoundary`.
 */

import { Capacitor } from "@capacitor/core";
import type React from "react";
import {
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useAppStore } from "../../store/appStore";
import { useNavigationStore } from "../../store/navigationStore";
import { useReaderStore } from "../../store/readerStore";
import { useUIStore } from "../../store/uiStore";
import { triggerHaptic } from "../../utils/haptic";
import {
	afterHistorySettles,
	historyPopInFlight,
	popHistory,
} from "../../utils/historyPop";
import { useDevicePerformance } from "../hooks/useDevicePerformance";
import { button, chip } from "../theme";
import { consumeTourReplay, getLastDeepLinkAt, onTourReplay } from "./tourBus";
import {
	type ChapterId,
	stepsToShow,
	TOUR_CHAPTERS,
	TOUR_UI_TEXT,
	type TourChapter,
	type TourOverlay,
	type TourState,
	type TourStep,
} from "./tourSteps";
import { useTourProgress } from "./useTourProgress";

// ── Tuning ──────────────────────────────────────────────────────────────────

/** Above every screen/popup (≤500), below Toast (999) and update screens. */
const TOUR_Z = 990;
const SETTLE_IDLE_MS = 1000;
const SETTLE_OPEN_MS = 1000;
const PROBE_VISIBLE_MS = 800;
const ACQUIRE_TIMEOUT_MS = 2500;
const OPTIONAL_GRACE_MS = 150;
const OPTIONAL_AFTER_ENTER_MS = 700;
const ACQUIRE_TICK_MS = 100;
const MEASURE_INTERVAL_MS = 400;
const BACK_WINDOW_MS = 3000;
const DEEP_LINK_WINDOW_MS = 5000;
/** The daily quote pops up ~2 s after start (plus a network fetch). */
const QUOTE_WAIT_MS = 9000;
const HOLE_PADDING = 6;
const CARD_MARGIN = 12;
const CARD_GAP = 14;

// ── Types ───────────────────────────────────────────────────────────────────

type Rect = { x: number; y: number; w: number; h: number };
type Insets = { top: number; right: number; bottom: number; left: number };
type Placement = "above" | "below" | "left" | "right" | "center" | "pinned";

interface Run {
	chapter: TourChapter;
	steps: TourStep[];
	isWhatsNew: boolean;
	index: number;
	dir: 1 | -1;
	/** Index whose `onEnter` ran and whose `onExit` is still owed. */
	entered: number | null;
	/** Where to come back to if going Back runs past the first step. */
	returnIndex: number;
}

interface ViewState {
	chapterId: ChapterId;
	steps: TourStep[];
	isWhatsNew: boolean;
	index: number;
	status: "acquiring" | "shown";
	rect: Rect | null;
}

const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

// ── App state, read on demand (no React subscriptions needed) ───────────────

function readOverlay(): TourOverlay | null {
	const ui = useUIStore.getState();
	const reader = useReaderStore.getState();
	const nav = useNavigationStore.getState();
	const view = window.history.state?.view;
	if (reader.selectedBook) return "book";
	if (reader.selectedBhajan) return reader.isNewBhajan ? "other" : "reader";
	if (ui.isProfileOpen) return "profile";
	if (ui.isSettingsOpen) return view === "admin" ? "other" : "settings";
	if (ui.isDonateOpen) return "donate";
	if (ui.isInformationOpen) return "information";
	if (ui.isEventsOpen) return "events";
	if (ui.isDailyDarshanOpen) return "darshan";
	if (ui.isTempleTimingsOpen) return "temple-timings";
	if (ui.isSevaCenterOpen) return "seva";
	if (ui.isVideosOpen) return "videos";
	if (
		ui.isAboutOpen ||
		ui.isDailyQuotesOpen ||
		ui.isDailyInfoOpen ||
		ui.isActivitiesOpen ||
		ui.isActivitiesPhotosOpen ||
		ui.isYouTubeOpen ||
		ui.isFacebookOpen ||
		ui.isInstagramOpen ||
		ui.isPrivacyOpen ||
		ui.isTermsOpen ||
		ui.isGuruMaharajOpen ||
		ui.isVirahiMaharajOpen ||
		nav.activeTab === "downloaded"
	)
		return "other";
	if (ui.isSideMenuOpen) return "menu";
	return null;
}

function readTourState(isLoggedIn: boolean): TourState {
	return {
		activeTab: useNavigationStore.getState().activeTab,
		overlay: readOverlay(),
		isLoggedIn,
	};
}

const NON_TEXT_INPUTS = new Set([
	"button",
	"checkbox",
	"color",
	"file",
	"image",
	"radio",
	"range",
	"reset",
	"submit",
]);

let viewportBase = 0;
let viewportOrientation = "";

/** A text field has focus, or the on-screen keyboard has shrunk the view. */
function isTypingActive(): boolean {
	const active = document.activeElement as HTMLElement | null;
	if (active && !active.closest("[data-tour-layer]")) {
		if (active.isContentEditable) return true;
		const tag = active.tagName;
		if (tag === "TEXTAREA" || tag === "SELECT") return true;
		if (
			tag === "INPUT" &&
			!NON_TEXT_INPUTS.has((active as HTMLInputElement).type)
		)
			return true;
	}
	const vv = window.visualViewport;
	const coarse = window.matchMedia?.("(pointer: coarse)").matches;
	if (!vv || !coarse) return false;
	const orientation = window.screen.width > window.screen.height ? "l" : "p";
	if (orientation !== viewportOrientation) {
		viewportOrientation = orientation;
		viewportBase = vv.height;
	}
	viewportBase = Math.max(viewportBase, vv.height);
	return vv.height < viewportBase * 0.72;
}

/** Same rule `useQuotePopup` uses to decide whether today's quote will show. */
function quotePopupLikely(): boolean {
	try {
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		const lastSeen = localStorage.getItem("cpbs_quote_last_seen_date");
		const lastAfternoon = localStorage.getItem(
			"cpbs_quote_last_seen_afternoon",
		);
		return (
			lastSeen !== today || (now.getHours() >= 16 && lastAfternoon !== today)
		);
	} catch {
		return false;
	}
}

// ── Finding and measuring targets ───────────────────────────────────────────

type Visibility = "visible" | "offscreen" | "covered" | "hidden";

function isEffectivelyHidden(el: HTMLElement): boolean {
	for (
		let node: HTMLElement | null = el;
		node && node !== document.body;
		node = node.parentElement
	) {
		const cs = window.getComputedStyle(node);
		if (
			cs.display === "none" ||
			cs.visibility === "hidden" ||
			Number.parseFloat(cs.opacity) < 0.05
		)
			return true;
	}
	return false;
}

/**
 * Visible = has a size, sits (mostly) inside the viewport, and nothing but the
 * tour itself is on top of it (no modal, loader, backdrop, toast or popup).
 */
function checkVisibility(el: HTMLElement): Visibility {
	if (!el.isConnected) return "hidden";
	const r = el.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return "hidden";
	if (isEffectivelyHidden(el)) return "hidden";
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const left = Math.max(r.left, 0);
	const right = Math.min(r.right, vw);
	const top = Math.max(r.top, 0);
	const bottom = Math.min(r.bottom, vh);
	if (right - left < 2 || bottom - top < 2) return "offscreen";
	const shownShare = ((right - left) * (bottom - top)) / (r.width * r.height);
	// Small targets must be mostly on screen; tall ones (the home grid) need a
	// good part of the screen, not a thin strip at the bottom.
	if (shownShare < 0.6 && (r.height < vh * 0.8 || bottom - top < vh * 0.5))
		return "offscreen";
	const stack = document.elementsFromPoint(
		(left + right) / 2,
		(top + bottom) / 2,
	);
	for (const hit of stack) {
		if (hit.closest("[data-tour-layer]")) continue;
		return hit === el || el.contains(hit) ? "visible" : "covered";
	}
	return "covered";
}

type FindResult =
	| { kind: "visible"; el: HTMLElement }
	| { kind: "scroll"; el: HTMLElement }
	| { kind: "missing" };

/** First visible match in DOM order; else the first one worth scrolling to. */
function findTarget(selector: string): FindResult {
	let scrollable: HTMLElement | null = null;
	for (const node of Array.from(
		document.querySelectorAll<HTMLElement>(selector),
	)) {
		const v = checkVisibility(node);
		if (v === "visible") return { kind: "visible", el: node };
		if (!scrollable && (v === "offscreen" || v === "covered"))
			scrollable = node;
	}
	return scrollable ? { kind: "scroll", el: scrollable } : { kind: "missing" };
}

function scrollParentOf(el: HTMLElement): HTMLElement | null {
	for (let node = el.parentElement; node; node = node.parentElement) {
		const oy = window.getComputedStyle(node).overflowY;
		if (
			(oy === "auto" || oy === "scroll") &&
			node.scrollHeight > node.clientHeight
		)
			return node;
	}
	return null;
}

/**
 * Scrolls a target into view. Normal targets are centred. Tall ones (taller
 * than most of the screen) start just below the fixed header instead, so
 * their top is what the person sees first.
 */
function bringIntoView(el: HTMLElement) {
	const r = el.getBoundingClientRect();
	if (r.height <= window.innerHeight * 0.7) {
		el.scrollIntoView({ block: "center", inline: "nearest" });
		return;
	}
	const scroller = scrollParentOf(el);
	if (!scroller) {
		el.scrollIntoView({ block: "start", inline: "nearest" });
		return;
	}
	scroller.scrollTop += r.top - fixedHeaderBottom() - 16;
}

/** Bottom edge of the fixed app header (0 in landscape, where it is hidden). */
function fixedHeaderBottom(): number {
	let bottom = 0;
	for (const header of Array.from(document.querySelectorAll("header"))) {
		const hr = header.getBoundingClientRect();
		if (hr.height > 0 && hr.top <= 0) bottom = Math.max(bottom, hr.bottom);
	}
	return bottom;
}

/**
 * When the card has no room above or below a normal-sized target, scroll its
 * list a little so it does (the card then sits beside the highlight instead
 * of covering part of it). Does nothing when the list cannot scroll that far.
 */
function makeRoomForCard(
	el: HTMLElement,
	hole: Rect,
	cardH: number,
	safe: Insets,
) {
	const scroller = scrollParentOf(el);
	if (!scroller) return;
	const vh = window.innerHeight;
	const topClear = Math.max(fixedHeaderBottom(), safe.top) + 8;
	const bottomLimit = vh - safe.bottom - CARD_MARGIN;
	// Card below the target: move the content up.
	const up = hole.y + hole.h + CARD_GAP + cardH - bottomLimit;
	if (up > 0 && hole.y - up >= topClear) {
		scroller.scrollTop += up;
		return;
	}
	// Card above the target: move the content down.
	const down = safe.top + CARD_MARGIN + cardH + CARD_GAP - hole.y;
	if (down > 0 && hole.y + hole.h + down <= bottomLimit) {
		scroller.scrollTop -= down;
	}
}

function holeFor(el: HTMLElement): Rect | null {
	if (!el.isConnected) return null;
	const r = el.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return null;
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const x = Math.max(r.left - HOLE_PADDING, 2);
	const y = Math.max(r.top - HOLE_PADDING, 2);
	const right = Math.min(r.right + HOLE_PADDING, vw - 2);
	const bottom = Math.min(r.bottom + HOLE_PADDING, vh - 2);
	if (right - x < 4 || bottom - y < 4) return null;
	return {
		x: Math.round(x),
		y: Math.round(y),
		w: Math.round(right - x),
		h: Math.round(bottom - y),
	};
}

const sameRect = (a: Rect | null, b: Rect | null) =>
	a === b ||
	(!!a &&
		!!b &&
		Math.abs(a.x - b.x) < 1 &&
		Math.abs(a.y - b.y) < 1 &&
		Math.abs(a.w - b.w) < 1 &&
		Math.abs(a.h - b.h) < 1);

function readSafeInsets(): Insets {
	try {
		const probe = document.createElement("div");
		probe.style.cssText =
			"position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;" +
			"padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);";
		document.body.appendChild(probe);
		const cs = window.getComputedStyle(probe);
		const insets = {
			top: Number.parseFloat(cs.paddingTop) || 0,
			right: Number.parseFloat(cs.paddingRight) || 0,
			bottom: Number.parseFloat(cs.paddingBottom) || 0,
			left: Number.parseFloat(cs.paddingLeft) || 0,
		};
		probe.remove();
		return insets;
	} catch {
		return ZERO_INSETS;
	}
}

// ── Tooltip placement ───────────────────────────────────────────────────────

interface CardPosition {
	left: number;
	top: number;
	placement: Placement;
	/** Caret offset along the card edge that faces the highlight. */
	caret: number | null;
	/**
	 * Set when a tall, narrow target (A–Z bar, a side rail) leaves no room above
	 * or below: the card should shrink to this width and sit beside it.
	 */
	narrowTo?: number;
}

/** Narrowest the card may get to fit beside a tall target. */
const MIN_SIDE_CARD_WIDTH = 200;

const clamp = (v: number, lo: number, hi: number) =>
	Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Picks the side of the highlight with room for the card (below/above first
 * for targets in the top/bottom half, then the sides — e.g. the landscape nav
 * rail on the right), keeps it inside the safe area, and falls back to the
 * roomier screen edge for huge targets.
 */
function placeCard(
	hole: Rect | null,
	card: { w: number; h: number },
	vp: { w: number; h: number },
	safe: Insets,
): CardPosition {
	const minL = safe.left + CARD_MARGIN;
	const maxR = vp.w - safe.right - CARD_MARGIN;
	const minT = safe.top + CARD_MARGIN;
	const maxB = vp.h - safe.bottom - CARD_MARGIN;
	if (!hole) {
		return {
			left: clamp((vp.w - card.w) / 2, minL, maxR - card.w),
			top: clamp((vp.h - card.h) / 2, minT, maxB - card.h),
			placement: "center",
			caret: null,
		};
	}
	const cx = hole.x + hole.w / 2;
	const cy = hole.y + hole.h / 2;
	const room = {
		below: maxB - (hole.y + hole.h) - CARD_GAP,
		above: hole.y - CARD_GAP - minT,
		right: maxR - (hole.x + hole.w) - CARD_GAP,
		left: hole.x - CARD_GAP - minL,
	};
	const order: Placement[] =
		cy > vp.h / 2
			? ["above", "below", "left", "right"]
			: ["below", "above", "right", "left"];
	for (const side of order) {
		if (side === "below" && room.below >= card.h) {
			const left = clamp(cx - card.w / 2, minL, maxR - card.w);
			return {
				left,
				top: hole.y + hole.h + CARD_GAP,
				placement: side,
				caret: clamp(cx - left, 18, card.w - 18),
			};
		}
		if (side === "above" && room.above >= card.h) {
			const left = clamp(cx - card.w / 2, minL, maxR - card.w);
			return {
				left,
				top: hole.y - CARD_GAP - card.h,
				placement: side,
				caret: clamp(cx - left, 18, card.w - 18),
			};
		}
		if (side === "right" && room.right >= card.w) {
			const top = clamp(cy - card.h / 2, minT, maxB - card.h);
			return {
				left: hole.x + hole.w + CARD_GAP,
				top,
				placement: side,
				caret: clamp(cy - top, 18, card.h - 18),
			};
		}
		if (side === "left" && room.left >= card.w) {
			const top = clamp(cy - card.h / 2, minT, maxB - card.h);
			return {
				left: hole.x - CARD_GAP - card.w,
				top,
				placement: side,
				caret: clamp(cy - top, 18, card.h - 18),
			};
		}
	}
	// Nothing fits beside a huge target: pin to the roomier edge — or, for a
	// tall narrow one, ask for a narrower card that fits beside it.
	const sideRoom = Math.max(room.left, room.right);
	return {
		left: clamp(cx - card.w / 2, minL, maxR - card.w),
		top: room.below >= room.above ? maxB - card.h : minT,
		placement: "pinned",
		caret: null,
		// We only get here when neither above nor below fits, so a narrower
		// card beside the target is the better choice whenever there is room.
		narrowTo:
			sideRoom >= MIN_SIDE_CARD_WIDTH && sideRoom < card.w
				? Math.floor(sideRoom)
				: undefined,
	};
}

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(() => {
		try {
			return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		} catch {
			return false;
		}
	});
	useEffect(() => {
		try {
			const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
			const onChange = () => setReduced(mq.matches);
			mq.addEventListener?.("change", onChange);
			return () => mq.removeEventListener?.("change", onChange);
		} catch {
			return undefined;
		}
	}, []);
	return reduced;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ProductTour() {
	const { settingsLanguage } = useSettings();
	const lang: "hi" | "en" = settingsLanguage === "hi" ? "hi" : "en";
	const { user } = useAuth();
	const isLoggedIn = !!user;
	const { progress, progressRef, markChapterDone, resetAll } =
		useTourProgress();
	const { isLowEnd } = useDevicePerformance();
	const reducedMotion = usePrefersReducedMotion();
	const animate = !isLowEnd && !reducedMotion;

	const [view, setView] = useState<ViewState | null>(null);
	const [paused, setPaused] = useState(false);
	const [backArmed, setBackArmed] = useState(false);
	const [viewport, setViewport] = useState(() => ({
		w: window.innerWidth,
		h: window.innerHeight,
	}));
	const [insets, setInsets] = useState<Insets>(ZERO_INSETS);
	const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(
		null,
	);
	/** Card width in px when narrowed to sit beside a tall target; else CSS. */
	const [narrowWidth, setNarrowWidth] = useState<number | null>(null);

	const titleId = useId();
	const descId = useId();
	const cardRef = useRef<HTMLDivElement>(null);
	const nextBtnRef = useRef<HTMLButtonElement>(null);

	// Everything the engine reads lives in refs, so its listeners never go stale.
	const runRef = useRef<Run | null>(null);
	const pausedRef = useRef(false);
	const backArmedRef = useRef(false);
	const backTimerRef = useRef<number | undefined>(undefined);
	const hasEntryRef = useRef(false);
	const expectPopUntilRef = useRef(0);
	const targetRef = useRef<HTMLElement | null>(null);
	const acquireTimerRef = useRef<number | undefined>(undefined);
	const measureTimerRef = useRef<number | undefined>(undefined);
	const settleTimerRef = useRef<number | undefined>(undefined);
	const monitorTimerRef = useRef<number | undefined>(undefined);
	const lastInteractionRef = useRef(Date.now());
	const readySinceRef = useRef<number | null>(Date.now());
	const candidateRef = useRef<{
		id: ChapterId;
		since: number;
		probeSince: number | null;
	} | null>(null);
	const prevTriggerRef = useRef<Partial<Record<ChapterId, boolean>>>({});
	const deferredRef = useRef(new Set<ChapterId>());
	const restoreFocusRef = useRef<HTMLElement | null>(null);
	const disabledRef = useRef(false);
	const isLoggedInRef = useRef(isLoggedIn);
	isLoggedInRef.current = isLoggedIn;
	const markRef = useRef(markChapterDone);
	markRef.current = markChapterDone;
	const resetRef = useRef(resetAll);
	resetRef.current = resetAll;

	const engine = useMemo(() => {
		const clearTimer = (ref: { current: number | undefined }) => {
			if (ref.current !== undefined) {
				window.clearTimeout(ref.current);
				window.clearInterval(ref.current);
				ref.current = undefined;
			}
		};

		const callSafely = (fn?: () => void) => {
			if (!fn) return;
			try {
				fn();
			} catch (e) {
				console.warn("[tour] step hook failed:", e);
			}
		};

		const expectOwnPop = () => {
			expectPopUntilRef.current = Date.now() + 1200;
		};

		const pushEntry = () => {
			if (hasEntryRef.current) return;
			const push = () => {
				if (!runRef.current || pausedRef.current || hasEntryRef.current) return;
				window.history.pushState({ isPopup: true, view: "tour" }, "");
				hasEntryRef.current = true;
			};
			if (historyPopInFlight()) afterHistorySettles(push);
			else push();
		};

		const dropEntry = () => {
			if (!hasEntryRef.current) return;
			hasEntryRef.current = false;
			// Only ours to pop if nothing was pushed on top of it; otherwise the
			// leftover entry is skipped when Back lands on it (see onPopState).
			if (window.history.state?.view === "tour") {
				expectOwnPop();
				popHistory();
			}
		};

		const stopStepTimers = () => {
			clearTimer(acquireTimerRef);
			clearTimer(measureTimerRef);
			targetRef.current = null;
		};

		const disarmBack = () => {
			clearTimer(backTimerRef);
			if (backArmedRef.current) {
				backArmedRef.current = false;
				setBackArmed(false);
			}
		};

		const fail = (e: unknown) => {
			console.warn("[tour] stopped:", e);
			disabledRef.current = true;
			try {
				teardown(false);
			} catch {
				/* already failing — stay quiet */
			}
		};

		/** Wraps entry points: a throw anywhere ends the tour quietly. */
		const guard =
			<A extends unknown[]>(fn: (...args: A) => void) =>
			(...args: A) => {
				if (disabledRef.current) return;
				try {
					fn(...args);
				} catch (e) {
					fail(e);
				}
			};

		/** Ends the running chapter. `markSeen` false only for Replay/failure. */
		function teardown(markSeen: boolean) {
			const run = runRef.current;
			if (!run) return;
			if (run.entered !== null) callSafely(run.steps[run.entered]?.onExit);
			runRef.current = null;
			stopStepTimers();
			clearTimer(monitorTimerRef);
			disarmBack();
			if (pausedRef.current) {
				pausedRef.current = false;
				setPaused(false);
			}
			setView(null);
			setCardSize(null);
			dropEntry();
			if (markSeen) markRef.current(run.chapter.id, run.chapter.version);
			const restore = restoreFocusRef.current;
			restoreFocusRef.current = null;
			if (restore?.isConnected) {
				try {
					restore.focus({ preventScroll: true });
				} catch {
					/* element no longer focusable */
				}
			}
			// The next chapter has to settle again from here.
			lastInteractionRef.current = Date.now();
			candidateRef.current = null;
			scheduleEvaluate(300);
		}

		function measure() {
			const el = targetRef.current;
			const run = runRef.current;
			if (!run || !el) return;
			const rect = holeFor(el);
			if (!rect) {
				// The element went away (re-render, list refresh): find it again.
				stopStepTimers();
				acquire(run.index, run.dir, Date.now(), true);
				return;
			}
			setView((v) =>
				v && v.index === run.index && !sameRect(v.rect, rect)
					? { ...v, rect }
					: v,
			);
		}

		function showAcquired(index: number, el: HTMLElement) {
			const run = runRef.current;
			if (!run) return;
			targetRef.current = el;
			const rect = holeFor(el);
			setView({
				chapterId: run.chapter.id,
				steps: run.steps,
				isWhatsNew: run.isWhatsNew,
				index,
				status: "shown",
				rect,
			});
			clearTimer(measureTimerRef);
			measureTimerRef.current = window.setInterval(
				guard(measure),
				MEASURE_INTERVAL_MS,
			);
		}

		/**
		 * Looks for the step's element: at once, then every 100 ms, scrolling it
		 * into view once if it is off screen or under the header. Gives up after
		 * 2.5 s (optional steps: almost at once) and moves on.
		 */
		function acquire(
			index: number,
			dir: 1 | -1,
			startedAt: number,
			reacquire = false,
		) {
			const run = runRef.current;
			if (!run || pausedRef.current) return;
			const step = run.steps[index];
			if (!step) return;
			if (!step.target) {
				targetRef.current = null;
				setView({
					chapterId: run.chapter.id,
					steps: run.steps,
					isWhatsNew: run.isWhatsNew,
					index,
					status: "shown",
					rect: null,
				});
				return;
			}
			let scrolled = false;
			const limit = step.optional
				? step.onEnter
					? OPTIONAL_AFTER_ENTER_MS
					: OPTIONAL_GRACE_MS
				: ACQUIRE_TIMEOUT_MS;
			const tick = () => {
				const current = runRef.current;
				if (!current || current.index !== index || pausedRef.current) return;
				const found = findTarget(step.target as string);
				if (found.kind === "visible") {
					showAcquired(index, found.el);
					return;
				}
				if (found.kind === "scroll" && !scrolled) {
					scrolled = true;
					bringIntoView(found.el);
				}
				if (Date.now() - startedAt >= limit) {
					// Not on screen: skip this step quietly in the same direction.
					goTo(index + dir, dir);
					return;
				}
				if (!reacquire) {
					setView((v) =>
						v && v.index === index && v.status === "acquiring"
							? v
							: {
									chapterId: current.chapter.id,
									steps: current.steps,
									isWhatsNew: current.isWhatsNew,
									index,
									status: "acquiring",
									rect: null,
								},
					);
				}
				acquireTimerRef.current = window.setTimeout(
					guard(tick),
					ACQUIRE_TICK_MS,
				);
			};
			tick();
		}

		function goTo(index: number, dir: 1 | -1) {
			const run = runRef.current;
			if (!run) return;
			stopStepTimers();
			if (index >= run.steps.length) {
				finish();
				return;
			}
			if (index < 0) {
				// Ran past the start while going Back: return to where we were.
				goTo(run.returnIndex, 1);
				return;
			}
			if (run.entered !== null && run.entered !== index) {
				callSafely(run.steps[run.entered]?.onExit);
				run.entered = null;
			}
			run.index = index;
			run.dir = dir;
			const step = run.steps[index];
			let allowed = true;
			if (step.when) {
				try {
					allowed = step.when();
				} catch {
					allowed = false;
				}
			}
			if (!allowed) {
				goTo(index + dir, dir);
				return;
			}
			if (run.entered !== index) {
				callSafely(step.onEnter);
				run.entered = index;
			}
			acquire(index, dir, Date.now());
		}

		function finish() {
			teardown(true);
		}

		function next() {
			const run = runRef.current;
			if (!run || pausedRef.current) return;
			disarmBack();
			// Light tap on Next/Done, like the bottom nav. Native only: on the
			// web it is skipped quietly.
			if (Capacitor.isNativePlatform()) void triggerHaptic("light");
			if (run.index >= run.steps.length - 1) {
				finish();
				return;
			}
			goTo(run.index + 1, 1);
		}

		function prev() {
			const run = runRef.current;
			if (!run || pausedRef.current || run.index <= 0) return;
			disarmBack();
			run.returnIndex = run.index;
			goTo(run.index - 1, -1);
		}

		function skip() {
			teardown(true);
		}

		/** Back button / Esc: first press warns, a second within 3 s closes. */
		function backIntent(source: "history" | "key") {
			if (!runRef.current) return;
			if (backArmedRef.current) {
				disarmBack();
				teardown(true);
				return;
			}
			backArmedRef.current = true;
			setBackArmed(true);
			clearTimer(backTimerRef);
			backTimerRef.current = window.setTimeout(() => {
				backArmedRef.current = false;
				setBackArmed(false);
			}, BACK_WINDOW_MS);
			// Keep the next Back for the tour, not for the screen underneath.
			// Deferred so every other popstate listener sees the landed state.
			if (source === "history") window.setTimeout(guard(pushEntry), 0);
		}

		function pause() {
			if (pausedRef.current) return;
			pausedRef.current = true;
			setPaused(true);
			stopStepTimers();
			disarmBack();
			// While hidden, Back must reach whatever caused the pause.
			dropEntry();
		}

		function resume() {
			const run = runRef.current;
			if (!run || !pausedRef.current) return;
			pausedRef.current = false;
			setPaused(false);
			pushEntry();
			acquire(run.index, run.dir, Date.now());
		}

		/** While running: stop quietly if the screen changed, pause on blockers. */
		function monitor() {
			const run = runRef.current;
			if (!run) return;
			const state = readTourState(isLoggedInRef.current);
			let stillOn = false;
			try {
				stillOn = run.chapter.trigger(state);
			} catch {
				stillOn = false;
			}
			if (!stillOn) {
				teardown(true);
				return;
			}
			const blocked = isBlocked(Date.now());
			if (blocked) pause();
			else if (pausedRef.current) resume();
		}

		function isBlocked(now: number): boolean {
			const app = useAppStore.getState();
			const ui = useUIStore.getState();
			if (
				!app.mainAppMounted ||
				!app.isSplashRemoved ||
				app.showOnboarding ||
				app.forceUpdateConfig ||
				app.forceOtaUpdate ||
				app.isUpdaterOpen ||
				ui.isForcedUpdateInProgress ||
				ui.notificationPermissionDenied ||
				ui.showQuotePopup ||
				window.history.state?.view === "admin" ||
				isTypingActive()
			) {
				if (app.showOnboarding || !app.isSplashRemoved)
					readySinceRef.current = null;
				return true;
			}
			if (readySinceRef.current === null) readySinceRef.current = now;
			if (
				!runRef.current &&
				now - readySinceRef.current < QUOTE_WAIT_MS &&
				quotePopupLikely()
			)
				return true;
			return false;
		}

		function startChapter(
			chapter: TourChapter,
			steps: TourStep[],
			isWhatsNew: boolean,
		) {
			candidateRef.current = null;
			clearTimer(settleTimerRef);
			const active = document.activeElement;
			restoreFocusRef.current =
				active instanceof HTMLElement && active !== document.body
					? active
					: null;
			runRef.current = {
				chapter,
				steps,
				isWhatsNew,
				index: 0,
				dir: 1,
				entered: null,
				returnIndex: 0,
			};
			setInsets(readSafeInsets());
			setViewport({ w: window.innerWidth, h: window.innerHeight });
			pushEntry();
			clearTimer(monitorTimerRef);
			monitorTimerRef.current = window.setInterval(
				guard(monitor),
				MEASURE_INTERVAL_MS,
			);
			goTo(0, 1);
		}

		function scheduleEvaluate(delay: number) {
			clearTimer(settleTimerRef);
			settleTimerRef.current = window.setTimeout(guard(evaluate), delay);
		}

		/** Decides whether a chapter should start now (only while idle). */
		function evaluate() {
			clearTimer(settleTimerRef);
			if (disabledRef.current || runRef.current) return;
			const now = Date.now();
			const state = readTourState(isLoggedInRef.current);
			const saved = progressRef.current;

			let triggered: {
				chapter: TourChapter;
				steps: TourStep[];
				isWhatsNew: boolean;
			} | null = null;
			for (const chapter of TOUR_CHAPTERS) {
				let on = false;
				try {
					on = chapter.trigger(state);
				} catch {
					on = false;
				}
				const was = prevTriggerRef.current[chapter.id] ?? false;
				prevTriggerRef.current[chapter.id] = on;
				// A screen a notification / deep link just opened waits for a
				// later visit, so the tour never covers what the person came for.
				// Only for that visit: once the screen closes, the next visit the
				// person makes themselves gets the chapter.
				if (
					on &&
					!was &&
					chapter.id !== "core" &&
					now - getLastDeepLinkAt() < DEEP_LINK_WINDOW_MS
				)
					deferredRef.current.add(chapter.id);
				else if (!on) deferredRef.current.delete(chapter.id);
				if (!on || triggered || deferredRef.current.has(chapter.id)) continue;
				const seen = saved[chapter.id] ?? 0;
				if (seen >= chapter.version) continue;
				const { steps, isWhatsNew } = stepsToShow(chapter, seen);
				if (steps.length === 0) {
					markRef.current(chapter.id, chapter.version);
					continue;
				}
				triggered = { chapter, steps, isWhatsNew };
			}

			if (!triggered) {
				candidateRef.current = null;
				return;
			}
			if (isBlocked(now)) {
				candidateRef.current = null;
				scheduleEvaluate(500);
				return;
			}
			const { chapter, steps, isWhatsNew } = triggered;
			if (candidateRef.current?.id !== chapter.id) {
				candidateRef.current = { id: chapter.id, since: now, probeSince: null };
			}
			const cand = candidateRef.current;
			// "Screen is ready" marker: the chapter's first dependable target —
			// taken from all its steps, so a "What's new" run made only of
			// optional steps still waits for the screen to finish rendering.
			const probe =
				chapter.probe ??
				chapter.steps.find(
					(s) => s.target && !s.optional && !s.when && !s.onEnter,
				)?.target;
			if (probe) {
				const visible = findTarget(probe).kind === "visible";
				if (!visible) cand.probeSince = null;
				else if (cand.probeSince === null) cand.probeSince = now;
			}
			const idleOk = now - lastInteractionRef.current >= SETTLE_IDLE_MS;
			const openOk = now - cand.since >= SETTLE_OPEN_MS;
			const probeOk =
				!probe ||
				(cand.probeSince !== null && now - cand.probeSince >= PROBE_VISIBLE_MS);
			if (idleOk && openOk && probeOk) {
				startChapter(chapter, steps, isWhatsNew);
				return;
			}
			scheduleEvaluate(200);
		}

		async function replay() {
			if (runRef.current) teardown(false);
			resetRef.current();
			deferredRef.current.clear();
			candidateRef.current = null;
			lastInteractionRef.current = Date.now();
			// Close what asked for the replay (help popup, side menu, settings)
			// and walk back through tab entries to Home — all through history,
			// so the app's own back handling closes each one and no stale entry
			// is left under the tour's own entry later.
			await new Promise((r) => window.setTimeout(r, 350));
			for (let i = 0; i < 12; i++) {
				const state = window.history.state;
				const v: unknown = state?.view;
				const closablePopup =
					state?.isPopup &&
					(v === "menu" ||
						v === "settings" ||
						v === "help-modal" ||
						v === "help-sidemenu" ||
						(!v && state?.modalId));
				const otherTab =
					!state?.isPopup &&
					typeof v === "string" &&
					v.startsWith("tab-") &&
					v !== "tab-home";
				if (!closablePopup && !otherTab) break;
				await new Promise<void>((resolve) => {
					const done = () => {
						window.removeEventListener("popstate", done);
						window.setTimeout(resolve, 40);
					};
					window.addEventListener("popstate", done);
					popHistory();
					window.setTimeout(done, 1000);
				});
			}
			const ui = useUIStore.getState();
			if (ui.isSideMenuOpen) ui.setIsSideMenuOpen(false);
			if (ui.isSettingsOpen) ui.setIsSettingsOpen(false);
			const nav = useNavigationStore.getState();
			if (nav.activeTab !== "home") {
				nav.setTabHistory(["home"]);
				nav.setAnimDirection("left");
				nav.setActiveTab("home");
			}
			// Start from the top of Home, as on a fresh open.
			document.querySelector("main")?.scrollTo({ top: 0 });
			prevTriggerRef.current = {};
			lastInteractionRef.current = Date.now();
			scheduleEvaluate(300);
		}

		function onPopState(e: PopStateEvent) {
			const landed = e.state?.view;
			if (expectPopUntilRef.current > Date.now()) {
				expectPopUntilRef.current = 0;
				scheduleEvaluate(300);
				return;
			}
			if (runRef.current && hasEntryRef.current && landed !== "tour") {
				hasEntryRef.current = false;
				backIntent("history");
				return;
			}
			if (!runRef.current && landed === "tour") {
				// Left behind by a chapter that ended while something sat on top
				// of its entry: step over it so Back never feels stuck.
				expectOwnPop();
				popHistory();
				return;
			}
			scheduleEvaluate(300);
		}

		function onKeyDown(e: KeyboardEvent) {
			if (!runRef.current || pausedRef.current) return;
			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				backIntent("key");
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				e.stopPropagation();
				next();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				e.stopPropagation();
				prev();
			} else if (e.key === "Tab") {
				// Keep keyboard focus inside the card.
				const card = cardRef.current;
				if (!card) return;
				const items = Array.from(
					card.querySelectorAll<HTMLElement>("button:not([disabled])"),
				);
				if (items.length === 0) return;
				const first = items[0];
				const last = items[items.length - 1];
				const active = document.activeElement as HTMLElement | null;
				const inside = !!active && card.contains(active);
				if (!inside || (e.shiftKey && active === first)) {
					e.preventDefault();
					(e.shiftKey ? last : first).focus();
				} else if (!e.shiftKey && active === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}

		function onInteraction() {
			lastInteractionRef.current = Date.now();
		}

		function onLayoutChange() {
			if (!runRef.current) return;
			setViewport({ w: window.innerWidth, h: window.innerHeight });
			setInsets(readSafeInsets());
			measure();
		}

		function destroy() {
			clearTimer(settleTimerRef);
			clearTimer(backTimerRef);
			if (runRef.current) teardown(false);
		}

		return {
			evaluate: guard(evaluate),
			scheduleEvaluate: guard(scheduleEvaluate),
			next: guard(next),
			prev: guard(prev),
			skip: guard(skip),
			replay: () => {
				if (disabledRef.current) return;
				replay().catch(fail);
			},
			onPopState: guard(onPopState),
			onKeyDown: guard(onKeyDown),
			onInteraction,
			onLayoutChange: guard(onLayoutChange),
			measure: guard(measure),
			makeRoom: guard((hole: Rect, cardH: number, safe: Insets) => {
				const el = targetRef.current;
				if (el) makeRoomForCard(el, hole, cardH, safe);
			}),
			destroy,
		};
	}, [progressRef]);

	// Listeners that live as long as the tour is mounted.
	useEffect(() => {
		const opts = { capture: true, passive: true } as const;
		window.addEventListener("popstate", engine.onPopState);
		window.addEventListener("keydown", engine.onKeyDown, true);
		window.addEventListener("pointerdown", engine.onInteraction, opts);
		window.addEventListener("touchstart", engine.onInteraction, opts);
		window.addEventListener("wheel", engine.onInteraction, opts);
		window.addEventListener("keydown", engine.onInteraction, opts);
		document.addEventListener("scroll", engine.onInteraction, opts);
		const onFocusOut = () => engine.scheduleEvaluate(300);
		document.addEventListener("focusout", onFocusOut, true);
		return () => {
			window.removeEventListener("popstate", engine.onPopState);
			window.removeEventListener("keydown", engine.onKeyDown, true);
			window.removeEventListener("pointerdown", engine.onInteraction, opts);
			window.removeEventListener("touchstart", engine.onInteraction, opts);
			window.removeEventListener("wheel", engine.onInteraction, opts);
			window.removeEventListener("keydown", engine.onInteraction, opts);
			document.removeEventListener("scroll", engine.onInteraction, opts);
			document.removeEventListener("focusout", onFocusOut, true);
			engine.destroy();
		};
	}, [engine]);

	// Re-check whenever the app's navigation state changes.
	useEffect(() => {
		const check = () => engine.scheduleEvaluate(50);
		const unsubs = [
			useAppStore.subscribe(check),
			useUIStore.subscribe(check),
			useNavigationStore.subscribe(check),
			useReaderStore.subscribe(check),
		];
		check();
		return () => {
			for (const unsub of unsubs) unsub();
		};
	}, [engine]);

	// Sign-in state and saved progress can change what should run.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-check on these changes only
	useEffect(() => {
		engine.scheduleEvaluate(100);
	}, [engine, isLoggedIn, progress]);

	// Replay requests (also ones made before this chunk had loaded).
	useEffect(() => {
		const handle = () => {
			if (consumeTourReplay()) engine.replay();
		};
		handle();
		return onTourReplay(handle);
	}, [engine]);

	// Follow the target while a step is on screen (resize, rotation, scroll).
	const running = view !== null && !paused;
	useEffect(() => {
		if (!running) return;
		let frame = 0;
		const onChange = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => engine.onLayoutChange());
		};
		window.addEventListener("resize", onChange);
		window.addEventListener("orientationchange", onChange);
		document.addEventListener("scroll", onChange, true);
		window.visualViewport?.addEventListener("resize", onChange);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", onChange);
			window.removeEventListener("orientationchange", onChange);
			document.removeEventListener("scroll", onChange, true);
			window.visualViewport?.removeEventListener("resize", onChange);
		};
	}, [running, engine]);

	// Measure the card before placing it (text length, language, UI scale).
	const stepKey = view ? `${view.chapterId}:${view.index}:${view.status}` : "";
	// A new step or screen size starts from the normal card width again.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on these changes only
	useLayoutEffect(() => {
		setNarrowWidth(null);
	}, [stepKey, viewport]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the card's content or the screen changes
	useLayoutEffect(() => {
		const card = cardRef.current;
		if (!card) return;
		const size = { w: card.offsetWidth, h: card.offsetHeight };
		setCardSize((prev) =>
			prev && prev.w === size.w && prev.h === size.h ? prev : size,
		);
	}, [stepKey, lang, backArmed, viewport, paused, narrowWidth]);

	// Card pinned over a normal-sized target (and a narrower side card will
	// not help): scroll once so it fits above or below it.
	const pinned =
		view && !paused && view.status === "shown" && view.rect && cardSize
			? placeCard(view.rect, cardSize, viewport, insets)
			: null;
	const pinnedOver = pinned?.placement === "pinned" && !pinned.narrowTo;
	const roomTriedRef = useRef("");
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per step, when the card would cover the target
	useLayoutEffect(() => {
		if (!pinnedOver || !view?.rect || !cardSize) return;
		if (roomTriedRef.current === stepKey) return;
		roomTriedRef.current = stepKey;
		engine.makeRoom(view.rect, cardSize.h, insets);
	}, [pinnedOver, stepKey]);

	// Keyboard / screen-reader focus goes to Next on every step, once the card
	// is actually visible (a hidden button cannot take focus).
	const cardVisible = !!view && view.status === "shown" && !!cardSize;
	// biome-ignore lint/correctness/useExhaustiveDependencies: move focus once per step
	useEffect(() => {
		if (!cardVisible || paused) return;
		nextBtnRef.current?.focus({ preventScroll: true });
	}, [stepKey, paused, cardVisible]);

	if (!view || paused) return null;

	const step = view.steps[view.index];
	if (!step) return null;
	const total = view.steps.length;
	// "Done" also when only optional steps with nothing on screen are left
	// (e.g. the mini-player when no audio is playing).
	const isLast = !view.steps
		.slice(view.index + 1)
		.some(
			(s) => !s.optional || !s.target || !!document.querySelector(s.target),
		);
	const shown = view.status === "shown";
	const hole = shown ? view.rect : null;
	const isHindi = lang === "hi";
	const position =
		shown && cardSize ? placeCard(hole, cardSize, viewport, insets) : null;
	// Tall narrow target with no room above/below: re-render with a narrower
	// card (measured again before paint) so it sits beside the target.
	if (position?.narrowTo && position.narrowTo !== narrowWidth) {
		setNarrowWidth(position.narrowTo);
	}
	const radius = hole ? Math.min(16, Math.min(hole.w, hole.h) / 2) : 0;

	const onBackdropClick = (e: React.MouseEvent) => {
		// Only the highlighted element advances; the dark area does nothing.
		if (
			hole &&
			e.clientX >= hole.x &&
			e.clientX <= hole.x + hole.w &&
			e.clientY >= hole.y &&
			e.clientY <= hole.y + hole.h
		) {
			engine.next();
		}
	};

	const caretStyle = (): React.CSSProperties | null => {
		if (!position || position.caret === null) return null;
		const c = position.caret - 6;
		switch (position.placement) {
			case "below":
				return { top: -6, left: c };
			case "above":
				return { bottom: -6, left: c };
			case "right":
				return { left: -6, top: c };
			case "left":
				return { right: -6, top: c };
			default:
				return null;
		}
	};
	const caret = caretStyle();
	const caretBorders =
		position?.placement === "below"
			? "border-l border-t"
			: position?.placement === "above"
				? "border-r border-b"
				: position?.placement === "right"
					? "border-l border-b"
					: "border-r border-t";

	return createPortal(
		<div
			data-tour-layer=""
			className="fixed inset-0 select-none"
			style={{ zIndex: TOUR_Z }}
		>
			{/* Catches every touch so nothing reaches the app underneath. */}
			<div
				aria-hidden="true"
				className={`absolute inset-0 ${hole ? "" : "bg-surface-scrim"}`}
				style={{ touchAction: "none", overscrollBehavior: "contain" }}
				onClick={onBackdropClick}
				onContextMenu={(e) => e.preventDefault()}
			/>

			{hole && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute"
					style={{
						left: hole.x,
						top: hole.y,
						width: hole.w,
						height: hole.h,
						borderRadius: radius,
						boxShadow: "0 0 0 200vmax var(--jm-surface-scrim)",
					}}
				>
					<div
						key={`ring-${view.chapterId}-${view.index}`}
						className={`absolute inset-0 ring-2 ring-gold-300 ${animate ? "animate-jm-fade" : ""}`}
						style={{ borderRadius: radius }}
					/>
					<div
						className={`absolute -inset-1 shadow-jm-glow-lg ${animate ? "animate-jm-glow-pulse" : ""}`}
						style={{ borderRadius: radius + 4 }}
					/>
				</div>
			)}

			{/* Stays mounted across steps so TalkBack reads every new title +
			    description, and the Back hint. */}
			<div className="sr-only" aria-live="polite" aria-atomic="true">
				{shown ? `${step.title[lang]}. ${step.desc[lang]}` : ""}
				{shown && backArmed ? ` ${TOUR_UI_TEXT.backAgain[lang]}` : ""}
			</div>

			{/* Mounted even while the next target is being found (hidden then),
			    so it can be measured and placed before it appears. */}
			<div
				ref={cardRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descId}
				className="absolute"
				style={{
					left: position?.left ?? 0,
					top: position?.top ?? 0,
					width: narrowWidth
						? `${narrowWidth}px`
						: `min(22rem, calc(100vw - ${insets.left + insets.right + CARD_MARGIN * 2}px))`,
					visibility: shown && position ? "visible" : "hidden",
				}}
			>
				<div
					key={`card-${view.chapterId}-${view.index}`}
					className={`relative rounded-jm-md bg-cream-25 dark:bg-ink-800 border border-gold-400/70 dark:border-gold-300/35 shadow-jm-xl p-4 ${animate ? "animate-jm-enter" : ""}`}
				>
					{caret && (
						<span
							aria-hidden="true"
							className={`absolute h-3 w-3 rotate-45 bg-cream-25 dark:bg-ink-800 border-gold-400/70 dark:border-gold-300/35 ${caretBorders}`}
							style={caret}
						/>
					)}
					<div>
						<div className="flex items-center justify-between gap-2 mb-1.5 min-h-[1.5rem]">
							{view.isWhatsNew ? (
								<span className={`${chip.base} ${chip.gold}`}>
									{TOUR_UI_TEXT.whatsNew[lang]}
								</span>
							) : (
								<span />
							)}
							<span className="font-body text-jm-caption font-semibold text-ink-500 dark:text-ink-300 tabular-nums">
								<span aria-hidden="true">
									{view.index + 1}/{total}
								</span>
								<span className="sr-only">
									{TOUR_UI_TEXT.stepOf[lang](view.index + 1, total)}
								</span>
							</span>
						</div>
						<h2
							id={titleId}
							className={`${isHindi ? "font-hindi-display" : "font-heading"} text-jm-h3 font-semibold text-gold-700 dark:text-gold-300 leading-snug break-words`}
						>
							{step.title[lang]}
						</h2>
						<p
							id={descId}
							className={`${isHindi ? "font-hindi" : "font-body"} mt-1.5 text-jm-body text-content-primary break-words`}
						>
							{step.desc[lang]}
						</p>
						{backArmed && (
							<p
								className={`${isHindi ? "font-hindi" : "font-body"} mt-3 rounded-jm-sm border border-gold-300/70 bg-gold-100/70 dark:bg-gold-300/10 px-3 py-2 text-jm-caption text-ink-800 dark:text-cream-50`}
							>
								{TOUR_UI_TEXT.backAgain[lang]}
							</p>
						)}
					</div>
					<div className="mt-4 flex flex-wrap items-center justify-end gap-2">
						{!isLast && (
							<button
								type="button"
								onClick={engine.skip}
								className={`${button.base} ${button.ghost} !px-3 mr-auto`}
							>
								{TOUR_UI_TEXT.skip[lang]}
							</button>
						)}
						{view.index > 0 && (
							<button
								type="button"
								onClick={engine.prev}
								className={`${button.base} ${button.secondary} !px-4`}
							>
								{TOUR_UI_TEXT.back[lang]}
							</button>
						)}
						<button
							ref={nextBtnRef}
							type="button"
							onClick={engine.next}
							className={`${button.base} ${button.primary} !px-5`}
						>
							{isLast ? TOUR_UI_TEXT.done[lang] : TOUR_UI_TEXT.next[lang]}
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}

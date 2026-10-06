/**
 * Janmashtami Design System — Spacing
 * ==================================
 *
 * The audit found no spacing discipline: padding ranged across p-2 … p-6 for
 * the same semantic level, and touch targets were frequently under the 44px
 * accessibility floor.
 *
 * Base unit is 4px, matching Tailwind's default scale, so existing utilities
 * keep working. What this file adds is a set of *semantic* spacing tokens and
 * the touch-target minimums.
 */

/** Extra spacing steps Tailwind does not ship, plus semantic aliases. */
export const spacing = {
	/** 44px — WCAG 2.5.5 / Apple HIG minimum touch target. */
	touch: "2.75rem",
	/** 48px — Material's comfortable touch target; used for primary actions. */
	"touch-lg": "3rem",
	/** Gutter between the screen edge and content, portrait. */
	gutter: "0.75rem",
	/** Gutter on tablet and up. */
	"gutter-lg": "1.25rem",
	/** Vertical rhythm between major sections. */
	section: "2rem",
	/** Vertical rhythm between cards in a stack. */
	stack: "0.75rem",
	/** Internal card padding. */
	card: "1.25rem",
	/** Internal padding for compact rows. */
	"card-sm": "0.875rem",
} as const;

/**
 * Semantic layout classes.
 *
 * These encode the decisions rather than repeating them at 500 call sites.
 */
export const layout = {
	/** Standard screen scroll container padding. */
	screen: "px-3 md:px-5 pb-6",
	/** Vertical rhythm between home-screen sections. */
	sectionStack: "space-y-8",
	/** Vertical rhythm between cards in a list. */
	cardStack: "space-y-3",
	/** Card interior. */
	cardPadding: "p-5",
	/** Compact card interior (list rows). */
	cardPaddingSm: "p-3.5",
	/** Centre a screen's content and cap its width on desktop/TV. */
	container: "w-full max-w-5xl mx-auto",
	/** Wider container for tile grids. */
	containerWide: "w-full max-w-7xl mx-auto",
	/**
	 * Minimum interactive size. Applied as a floor, so a visually smaller
	 * icon can still sit inside a 44px hit area.
	 */
	touchTarget: "min-w-touch min-h-touch",
	/** Safe-area padding for fixed top chrome. */
	safeTop: "pt-[env(safe-area-inset-top)]",
	/** Safe-area padding for fixed bottom chrome. */
	safeBottom: "pb-[env(safe-area-inset-bottom)]",
} as const;

/** Z-index ladder. Documented so new overlays stop guessing. */
export const zIndex = {
	base: 0,
	raised: 10,
	sticky: 20,
	/** Header and BottomNav. */
	chrome: 30,
	/** Landscape search, floating controls. */
	floating: 40,
	/** MiniPlayer, sheets. */
	player: 50,
	/** Side menu, settings overlay. */
	overlay: 60,
	/** Readers and full-screen players. */
	immersive: 80,
	/** Modals and confirms. */
	modal: 100,
	/** Toasts. */
	toast: 200,
	/** Force-update / error boundary — must sit above everything. */
	blocking: 999,
} as const;

export default { spacing, layout, zIndex };

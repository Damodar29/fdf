/**
 * Janmashtami ornaments — shared contract
 * ======================================
 *
 * Every ornament in this folder is an inline SVG React component, not a file
 * loaded by URL. That choice is deliberate:
 *
 *   · `currentColor` — one asset serves light and dark mode. An ornament
 *     inherits its colour from the `text-*` class on it or its parent, so
 *     `text-gold-400/30 dark:text-gold-300/15` is the whole theming story.
 *   · no extra requests — these are 200 bytes to 2 KB of markup each; a
 *     round-trip per corner flourish would cost more than the markup.
 *   · no PNG anywhere, per the brief. These are resolution-independent, which
 *     matters on the 3x and 4x Android panels this app ships to.
 *
 * ── Accessibility ─────────────────────────────────────────────────────────
 * Ornaments are always decorative. Every component hard-codes
 * `aria-hidden="true"` and `focusable="false"` — the latter because IE/older
 * WebViews put SVG elements in the tab order otherwise, which would inject
 * dozens of empty tab stops into the bottom nav and card grid. There is no prop
 * to override this: if a graphic needs to carry meaning, it is not an ornament.
 *
 * ── Why `useId` ───────────────────────────────────────────────────────────
 * Several ornaments use gradients, which require an `id` to reference. Any
 * ornament can appear many times on one screen (a lotus corner sits on every
 * card). Hard-coded ids would collide, and browsers resolve `url(#foo)` against
 * the FIRST matching id in the document — so every card after the first would
 * silently inherit the first card's gradient, including its opacity. `useId()`
 * gives each instance its own namespace.
 */

import type { CSSProperties } from "react";

export interface OrnamentProps {
	/**
	 * Colour, opacity and positioning. Prefer the recipes in
	 * `ornamentClass` from `@/src/theme` over ad-hoc classes.
	 */
	className?: string;
	/**
	 * Width in px. Height is derived from the viewBox so nothing distorts.
	 * Defaults come from `ornamentSize` in `@/src/theme`.
	 */
	size?: number;
	style?: CSSProperties;
}

/**
 * Attributes shared by every ornament root.
 *
 * `overflow: visible` is set because several ornaments (the sparkle field, the
 * feather barbs) animate with `translate3d` and would otherwise be clipped at
 * the viewBox edge mid-animation.
 */
export const ornamentSvgProps = {
	xmlns: "http://www.w3.org/2000/svg",
	"aria-hidden": true as const,
	focusable: "false" as const,
	role: "presentation" as const,
};

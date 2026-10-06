/**
 * Janmashtami Design System — Public API
 * =====================================
 *
 * Import from here, not from the individual files:
 *
 *   import { textRole, card, button, elevation } from "@/src/theme";
 *
 * (`@` is aliased to the repo root in `vite.config.ts` and `tsconfig.json`, so
 * the path includes `src`.)
 *
 * `tailwind.config.js` imports `colors`, `typography`, `radius`, `shadows`
 * and `animations` directly (it needs the raw values at build time). Runtime
 * code should use this barrel.
 *
 * ── Architecture ───────────────────────────────────────────────────────────
 *
 *   colors.ts       raw palette          ─┐
 *   typography.ts   families + scale      │
 *   spacing.ts      spacing + z-index     ├─→ tailwind.config.js  (build time)
 *   radius.ts       radius ladder         │        ↓
 *   shadows.ts      elevation + borders   │   utility classes
 *   animations.ts   motion               ─┘        ↓
 *   decorations.ts  ornament rules        →   consumed in TSX
 *   tokens.css      CSS variables         →   reachable from inline styles
 *   theme.ts        this barrel + recipes →   imported by components
 *
 * The runtime palette engine in `utils/theme.ts` writes
 * `--color-primary-50…900` onto the document root, and Tailwind's `saffron-*`
 * family reads those variables. That engine is UNCHANGED — `janmashtami` was
 * added to it as a new palette and made the default, so the user's 16-palette
 * picker keeps working while the app ships Krishna blue out of the box.
 */

export * from "./animations";
export * from "./colors";
export * from "./decorations";
export * from "./radius";
export * from "./shadows";
export * from "./spacing";
export * from "./typography";

import { interaction } from "./animations";
import { border, elevation } from "./shadows";

/**
 * Card recipes.
 *
 * This is what replaces the 502 hand-rolled card constructions the audit
 * found across 72 files. A card is: a cream surface, a gold edge, a soft inner
 * highlight, and generous radius. The variants differ only in emphasis.
 *
 * `cn()` from `utils/shadcn.ts` is the intended way to extend these.
 */
export const card = {
	/** The default card. Content cards, list rows, settings groups. */
	base: [
		"relative overflow-hidden",
		"rounded-jm-card",
		"bg-cream-25 dark:bg-ink-800",
		border.card,
		elevation.card,
		"shadow-jm-inner-light dark:shadow-jm-inner-dark",
	].join(" "),

	/** Interactive card — adds press and hover states. */
	interactive: [
		"relative overflow-hidden",
		"rounded-jm-card",
		"bg-cream-25 dark:bg-ink-800",
		border.card,
		border.cardHover,
		elevation.card,
		"hover:shadow-jm-md",
		interaction.lift,
		interaction.focus,
	].join(" "),

	/** Featured card — stronger edge, more elevation. Hero panels. */
	featured: [
		"relative overflow-hidden",
		"rounded-jm-panel",
		"bg-gradient-to-b from-cream-25 to-cream-100 dark:from-ink-800 dark:to-ink-900",
		border.strong,
		elevation.panel,
		"shadow-jm-inner-light dark:shadow-jm-inner-dark",
	].join(" "),

	/** Krishna-blue card — inverted, for CTAs and festival panels. */
	royal: [
		"relative overflow-hidden",
		"rounded-jm-card",
		"bg-gradient-to-br from-krishna-500 to-krishna-700",
		"border border-gold-300/30",
		elevation.panel,
	].join(" "),

	/** Flat card — no shadow, border only. Dense lists, nested content. */
	flat: [
		"relative overflow-hidden",
		"rounded-jm-card",
		"bg-cream-25/60 dark:bg-ink-800/50",
		border.card,
	].join(" "),

	/** Modal / sheet surface. */
	modal: [
		"relative overflow-hidden",
		"rounded-jm-panel",
		"bg-cream-25 dark:bg-ink-800",
		border.strong,
		elevation.modal,
	].join(" "),

	/** Inset well — sub-lists, code, quiet regions inside a card. */
	well: [
		"relative rounded-jm-md",
		"bg-cream-200/60 dark:bg-ink-900/60",
		"border border-gold-200/40 dark:border-gold-300/10",
	].join(" "),
} as const;

/**
 * Button recipes.
 *
 * The audit found 883 raw `<button>` elements and a dead shadcn `Button`
 * component whose variants referenced tokens (`bg-primary`, `ring-ring`) that
 * were never defined — so it would have rendered unstyled. These recipes use
 * real Janmashtami tokens.
 *
 * Every variant satisfies the 44px minimum touch target via `min-h-touch`.
 */
export const button = {
	/** Shared by every variant. */
	base: [
		"inline-flex items-center justify-center gap-2",
		"min-h-touch px-5",
		"rounded-full",
		"font-body text-jm-body-sm font-semibold",
		"whitespace-nowrap select-none",
		interaction.pressButton,
		interaction.focus,
		"disabled:opacity-50 disabled:pointer-events-none",
	].join(" "),

	/** Primary action — deep gold on cream, gold glow on press. */
	primary: [
		"bg-gradient-to-b from-gold-400 to-gold-500",
		"text-krishna-800",
		"border border-gold-600/40",
		"shadow-jm-sm hover:shadow-jm-glow",
		"hover:from-gold-300 hover:to-gold-400",
	].join(" "),

	/** Royal action — Krishna blue. For confirmations and navigation. */
	royal: [
		"bg-gradient-to-b from-krishna-500 to-krishna-600",
		"text-cream-50",
		"border border-krishna-700",
		"shadow-jm-sm hover:shadow-jm-md",
	].join(" "),

	/** Secondary — gold outline on transparent. */
	secondary: [
		"bg-cream-25 dark:bg-ink-800",
		"text-gold-700 dark:text-gold-300",
		"border border-gold-400 hover:border-gold-500",
		"hover:bg-gold-50 dark:hover:bg-ink-700",
		"shadow-jm-xs",
	].join(" "),

	/** Quiet — no border, no fill. Tertiary actions, dialog cancels. */
	ghost: [
		"bg-transparent",
		"text-ink-700 dark:text-ink-200",
		"hover:bg-gold-100/60 dark:hover:bg-ink-700/60",
	].join(" "),

	/** Destructive. */
	danger: [
		"bg-error text-white",
		"border border-error-strong",
		"shadow-jm-sm hover:brightness-110",
	].join(" "),

	/** Icon-only. Square, 44px, centred. */
	icon: [
		"inline-flex items-center justify-center",
		"min-w-touch min-h-touch",
		"rounded-full",
		"text-ink-600 dark:text-ink-300",
		"hover:bg-gold-100/60 dark:hover:bg-ink-700/60",
		interaction.pressButton,
		interaction.focus,
	].join(" "),
} as const;

/** Chip / badge recipes. */
export const chip = {
	base: "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-body text-jm-caption font-semibold",
	gold: "bg-gold-100 text-gold-800 border border-gold-300/60 dark:bg-gold-300/10 dark:text-gold-300 dark:border-gold-300/25",
	peacock:
		"bg-peacock-50 text-peacock-700 border border-peacock-200 dark:bg-peacock-500/12 dark:text-peacock-200 dark:border-peacock-500/25",
	royal:
		"bg-krishna-50 text-krishna-700 border border-krishna-200 dark:bg-krishna-400/12 dark:text-krishna-100 dark:border-krishna-400/25",
	neutral:
		"bg-ink-100 text-ink-600 border border-ink-200 dark:bg-ink-700 dark:text-ink-300 dark:border-ink-600",
} as const;

/** Screen-level surface recipes. */
export const screen = {
	/** Page background. Pairs with the `bg-paper` gradient in `tokens.css`. */
	page: "bg-paper min-h-full",
	/** Scroll container for a screen's content. */
	scroll: "scroll-container overflow-y-auto",
	/** Standard content padding + max width. */
	content: "px-3 md:px-5 pb-6 w-full max-w-5xl mx-auto",
} as const;

/** Form control recipes. */
export const control = {
	input: [
		"w-full min-h-touch px-4",
		"rounded-jm-md",
		"bg-cream-25 dark:bg-ink-900",
		"border border-ink-200 dark:border-ink-700",
		"font-body text-jm-body text-ink-900 dark:text-cream-50",
		"placeholder:text-ink-400",
		"focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-400/40",
		"transition-colors duration-200",
	].join(" "),
	label:
		"block font-body text-jm-caption font-semibold text-ink-600 dark:text-ink-300 mb-1.5",
} as const;

export const theme = {
	card,
	button,
	chip,
	screen,
	control,
} as const;

export default theme;

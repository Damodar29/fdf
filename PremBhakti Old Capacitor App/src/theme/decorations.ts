/**
 * Janmashtami Design System — Decoration
 * ====================================
 *
 * Ornament is the loudest part of a festival theme and the easiest to get
 * wrong. The brief wants divine, elegant, temple-inspired — explicitly NOT
 * cartoonish, childish, overloaded or cheap. This file encodes the discipline
 * that keeps it on the right side of that line.
 *
 * ── The rules ──────────────────────────────────────────────────────────────
 *
 * 1. ONE ornament per visual region. A card gets a corner motif OR a border
 *    flourish, never both. A section gets a divider above it OR a mandala
 *    behind it, never both.
 *
 * 2. Ornaments are DECORATIVE, not informational. Every one renders with
 *    `aria-hidden="true"` and is never the sole carrier of meaning.
 *
 * 3. Ornaments sit BEHIND content. Max opacity 0.10 for background patterns,
 *    0.35 for edge flourishes. If an ornament competes with text, it is wrong.
 *
 * 4. Ornaments are SVG only — no PNG. They scale to any density and inherit
 *    `currentColor`, so a single asset serves light and dark mode.
 *
 * 5. Ambient motion is gated on both `prefers-reduced-motion` and the
 *    existing `useDevicePerformance()` low-end flag.
 *
 * ── The signature ──────────────────────────────────────────────────────────
 * The recurring structural device of this theme is the TEMPLE ARCH — a
 * pointed trefoil derived from a Vrindavan doorway. It appears in exactly
 * three places, and its scarcity is what makes it read as a signature:
 *   · around the active bottom-nav tab
 *   · as the crown of a featured section header
 *   · as the frame of the deity darshan tile
 *
 * The secondary motif is the PEACOCK FEATHER EYE, used as the "new content"
 * indicator in place of a generic red dot. It carries the same information
 * with none of the alarm.
 */

/** Every ornament available in `src/assets/janmashtami/`. */
export type OrnamentName =
	| "peacockFeatherDivider"
	| "fluteDivider"
	| "templeBorder"
	| "goldenMandala"
	| "krishnaSilhouette"
	| "makhanHandi"
	| "lotusCorner"
	| "festivalSparkles"
	| "peacockFeatherEye";

/**
 * Where each ornament is permitted, and at what opacity.
 *
 * Consult this before placing an ornament. If the surface you want is not
 * listed, the answer is that the ornament does not belong there.
 */
export const ornamentUsage: Record<
	OrnamentName,
	{
		role: string;
		surfaces: string[];
		maxOpacity: number;
		animated: boolean;
		/**
		 * A single surface where this ornament is allowed to break its own
		 * opacity cap, and why. Present only where the exception is deliberate
		 * and documented — see `goldenMandala`.
		 */
		ceremonialException?: {
			surface: string;
			role: string;
			maxOpacity: number;
		};
	}
> = {
	peacockFeatherDivider: {
		role: "Separates major sections on a scrolling screen.",
		surfaces: ["home sections", "settings groups", "about screen"],
		maxOpacity: 0.9,
		animated: false,
	},
	fluteDivider: {
		role: "Separates items within a section; narrower than the feather. NOT for the bottom nav — a flute is a single centred graphic and the Home tab is permanently centred too, so the two collide; the nav's centre belongs to the temple alcove.",
		surfaces: ["list group headers", "modal headers", "settings groups"],
		maxOpacity: 0.7,
		animated: false,
	},
	templeBorder: {
		role: "Crowns a featured panel. The signature arch.",
		surfaces: [
			"featured section header",
			"darshan tile",
			"glorification modal",
		],
		maxOpacity: 1,
		animated: false,
	},
	goldenMandala: {
		role: "Ambient background texture. Never in the foreground — EXCEPT on the splash, where it is promoted to a halo behind the lockup (see below).",
		surfaces: ["screen background", "hero panel", "splash"],
		maxOpacity: 0.08,
		animated: false,
		/**
		 * The 0.08 cap exists for one reason: pattern behind body text is the
		 * fastest way to make a themed app look cheap. The splash has no body
		 * text — it has a single lockup, dead centre — and there the mandala is
		 * not texture under content but the halo framing it, which is the whole
		 * point of the screen. So `components/SplashScreen.tsx` renders it at
		 * ~0.30 deliberately. This is the only sanctioned exception; anywhere
		 * that carries a paragraph stays at 0.08.
		 */
		ceremonialException: { surface: "splash", role: "halo", maxOpacity: 0.32 },
	},
	krishnaSilhouette: {
		role: "Watermark on ceremonial surfaces only.",
		surfaces: ["splash", "onboarding", "donate screen", "empty states"],
		maxOpacity: 0.1,
		animated: false,
	},
	makhanHandi: {
		role: "Janmashtami-specific festival marker. Use once per screen at most.",
		surfaces: ["festival banner", "events screen", "donate CTA"],
		maxOpacity: 0.9,
		animated: false,
	},
	lotusCorner: {
		role: "Corner motif on cards. One corner only — bottom-right by default.",
		surfaces: ["card corner", "modal corner", "panel corner"],
		maxOpacity: 0.35,
		animated: false,
	},
	festivalSparkles: {
		role: "Ambient festival atmosphere. Gated on reduced-motion and low-end devices.",
		surfaces: ["home background", "festival banner", "success states"],
		maxOpacity: 0.5,
		animated: true,
	},
	peacockFeatherEye: {
		role: "The 'new content' badge, in place of a generic red dot. The only ornament that IS informational, so rule 2 does not apply to it — but it must always sit alongside a text or icon affordance, never be the sole cue.",
		surfaces: ["list row badge", "nav tab badge", "menu item badge"],
		maxOpacity: 1,
		animated: false,
	},
};

/**
 * Composed class recipes for ornament placement.
 *
 * These handle the absolute-positioning and pointer-events boilerplate that
 * every ornament needs, so it is written once rather than at each call site.
 */
export const ornamentClass = {
	/** Full-bleed background layer. Parent needs `relative overflow-hidden`. */
	background: "pointer-events-none absolute inset-0 select-none",
	/** Bottom-right card corner motif. */
	cornerBR:
		"pointer-events-none absolute bottom-0 right-0 select-none text-gold-400/30 dark:text-gold-300/15",
	/** Top-left card corner motif. */
	cornerTL:
		"pointer-events-none absolute top-0 left-0 select-none text-gold-400/30 dark:text-gold-300/15",
	/** Horizontal divider, centred. */
	divider:
		"pointer-events-none mx-auto select-none text-gold-500/70 dark:text-gold-300/50",
	/** Crown ornament above a panel. */
	crown:
		"pointer-events-none absolute -top-px left-1/2 -translate-x-1/2 select-none text-gold-400 dark:text-gold-300",
	/** Watermark, centred and faint. */
	watermark:
		"pointer-events-none absolute inset-0 flex items-center justify-center select-none opacity-[0.08] dark:opacity-[0.10]",
	/**
	 * "New content" badge — the peacock feather eye. Pinned to the top-right of
	 * a `relative` row or tab. `text-peacock-500`/`gold-300` keep it clear of the
	 * error red; see `PeacockFeatherEye`. Pair it with an sr-only "new" label so
	 * the colour is never the sole cue.
	 */
	badge:
		"pointer-events-none absolute -top-0.5 -right-0.5 select-none text-peacock-500 dark:text-gold-300",
} as const;

/**
 * Section-header recipe.
 *
 * The audit found the home screen had no section headers at all, and that the
 * two ad-hoc ones used `<h3>` and `<h2>` interchangeably for identical
 * visuals. This is the settled pattern: a tracked gold eyebrow, a Marcellus
 * title, and an optional feather divider beneath.
 */
export const sectionHeader = {
	wrapper: "flex flex-col items-center text-center gap-1 mb-4",
	eyebrow:
		"font-body text-jm-overline font-semibold uppercase text-gold-700 dark:text-gold-300",
	title: "font-heading text-jm-h2 text-ink-900 dark:text-cream-50",
	titleHindi: "font-hindi-display text-jm-h2 text-ink-900 dark:text-cream-50",
	divider: "mt-1 w-32 text-gold-500/70 dark:text-gold-300/50",
} as const;

/** Standard ornament sizes, so a divider is never arbitrarily scaled. */
export const ornamentSize = {
	dividerSm: 96,
	dividerMd: 160,
	dividerLg: 240,
	corner: 56,
	crown: 72,
	watermark: 280,
	badge: 12,
} as const;

export default {
	ornamentUsage,
	ornamentClass,
	sectionHeader,
	ornamentSize,
};

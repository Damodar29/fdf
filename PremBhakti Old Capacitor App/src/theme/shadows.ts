/**
 * Janmashtami Design System — Shadows & Elevation
 * ==============================================
 *
 * The brief asks for "premium elevation" and "elegant glow" but explicitly
 * forbids "excessive shadows". The audit found 805 shadow usages across 8
 * variants plus 52 coloured shadows, only 8 of which used a brand token.
 *
 * The approach here: shadows are **warm and blue-tinted**, never neutral grey.
 * A grey shadow on cream reads as dirt; a shadow tinted with the page's own
 * hue family reads as depth. Light mode tints toward Krishna blue, dark mode
 * deepens toward the night sky.
 *
 * Gold glow is reserved for *state*, never decoration — active tab, focus
 * ring, live indicator. If everything glows, nothing does.
 */

/** Box-shadow tokens added to Tailwind. */
export const boxShadow = {
	/** Hairline lift — list rows, chips. */
	"jm-xs": "0 1px 2px 0 rgba(11, 46, 107, 0.06)",
	/** Resting card. */
	"jm-sm":
		"0 2px 8px -1px rgba(11, 46, 107, 0.08), 0 1px 3px -1px rgba(11, 46, 107, 0.06)",
	/** Card hover / press-lift. */
	"jm-md":
		"0 6px 16px -4px rgba(11, 46, 107, 0.12), 0 2px 6px -2px rgba(11, 46, 107, 0.08)",
	/** Raised panel, hero card. */
	"jm-lg":
		"0 12px 28px -8px rgba(11, 46, 107, 0.16), 0 4px 10px -4px rgba(11, 46, 107, 0.08)",
	/** Modal, sheet. */
	"jm-xl":
		"0 24px 48px -12px rgba(11, 46, 107, 0.24), 0 8px 16px -8px rgba(11, 46, 107, 0.12)",

	/** App bar — shadow falls downward only. */
	"jm-header": "0 4px 20px -6px rgba(7, 21, 41, 0.28)",
	/** Bottom nav — shadow falls upward only. */
	"jm-nav": "0 -6px 24px -8px rgba(7, 21, 41, 0.26)",

	/**
	 * Inner highlight — a 1px bright line along the top inner edge. This is
	 * what makes a cream card read as *lit* rather than flat, and is the
	 * "soft inner highlight" the brief asks for on cards.
	 */
	"jm-inner-light": "inset 0 1px 0 0 rgba(255, 255, 255, 0.9)",
	/** Inner highlight for dark surfaces. */
	"jm-inner-dark": "inset 0 1px 0 0 rgba(255, 213, 79, 0.10)",

	/** Gold glow — subtle. Active nav tab, focus ring. */
	"jm-glow": "0 0 12px -2px rgba(255, 213, 79, 0.45)",
	/** Gold glow — pronounced. Live indicator, primary CTA press. */
	"jm-glow-lg": "0 0 22px -4px rgba(255, 213, 79, 0.6)",
	/** Peacock glow — used only for the "new content" pip. */
	"jm-glow-peacock": "0 0 12px -2px rgba(21, 122, 110, 0.5)",
} as const;

/**
 * Semantic elevation classes, light + dark paired.
 *
 * In dark mode a drop shadow is nearly invisible against #071529, so depth is
 * carried by the border and inner highlight instead. Each token below already
 * handles that switch.
 */
export const elevation = {
	/** Flat surface, depth from border alone. */
	flat: "shadow-none",
	/** List row. */
	row: "shadow-jm-xs dark:shadow-none",
	/** Resting card — the default. */
	card: "shadow-jm-sm dark:shadow-none dark:shadow-jm-inner-dark",
	/** Card in hover / focus. */
	cardRaised: "shadow-jm-md dark:shadow-jm-inner-dark",
	/** Hero panel. */
	panel: "shadow-jm-lg dark:shadow-jm-inner-dark",
	/** Modal / sheet. */
	modal: "shadow-jm-xl",
	/** App bar. */
	header: "shadow-jm-header",
	/** Bottom nav. */
	nav: "shadow-jm-nav",
} as const;

/**
 * Border tokens.
 *
 * Cards are defined by their gold edge more than by their shadow — that is
 * what produces the "temple invitation card" read. In dark mode the gold
 * drops to a low-alpha version so it glints rather than glares.
 */
export const border = {
	/** Default card edge. */
	card: "border border-gold-200/70 dark:border-gold-300/15",
	/** Card edge on hover. */
	cardHover: "hover:border-gold-300 dark:hover:border-gold-300/35",
	/** Emphasised edge — featured card, selected state. */
	strong: "border border-gold-400 dark:border-gold-300/40",
	/** Hairline divider between rows. */
	divider: "border-gold-200/45 dark:border-gold-300/12",
	/** Neutral edge for form controls. */
	control: "border border-ink-200 dark:border-ink-700",
} as const;

export default { boxShadow, elevation, border };

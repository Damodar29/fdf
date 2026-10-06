/**
 * Janmashtami Design System — Radius
 * =================================
 *
 * The audit found seven competing radius scales used interchangeably at the
 * same semantic level: `rounded`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `full`,
 * plus arbitrary values like `rounded-[2rem]`.
 *
 * This file defines a four-step semantic ladder. The stock Tailwind steps are
 * left intact so nothing breaks, but new work should use the semantic names.
 *
 * The design intent: cards should read as *temple invitation cards* — generous
 * but not pill-shaped. 20px on a card, 12px on controls inside it.
 */

/** Extra radius steps added to Tailwind. */
export const borderRadius = {
	/** 16px (increased from 8px) */
	"jm-sm": "1rem",
	/** 20px (increased from 12px) */
	"jm-md": "1.25rem",
	/** 32px (increased from 20px) — the canonical card. */
	"jm-card": "2rem",
	/** 40px (increased from 28px) — sheets, modals, hero panels. */
	"jm-panel": "2.5rem",
	/**
	 * Temple arch — a tall pointed top with a squared base. This is the
	 * signature shape of the theme, used on the active bottom-nav tab and on
	 * section-header ornaments.
	 */
	"jm-arch": "9999px 9999px 1.25rem 1.25rem",
} as const;

/** Semantic aliases, so intent is readable at the call site. */
export const radius = {
	chip: "rounded-jm-sm",
	control: "rounded-jm-md",
	card: "rounded-jm-card",
	panel: "rounded-jm-panel",
	arch: "rounded-jm-arch",
	pill: "rounded-full",
	circle: "rounded-full",
} as const;

export default { borderRadius, radius };

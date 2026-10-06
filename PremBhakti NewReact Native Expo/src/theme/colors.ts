import { cream, gold, ink, janmashtami, krishna, peacock, status, surface, text } from "./jmColors";

// The Janmashtami design system from the Capacitor app (src/theme/colors.ts,
// copied verbatim as ./jmColors) resolved into the two concrete themes the
// native screens read. These mirror the web app's semantic CSS variables in
// src/theme/tokens.css (`--jm-surface-*`, `--jm-text-*`, `--jm-border-*`),
// which flip under `.dark`.
//
// The user's accent palette (the web app's `saffron-*` classes, driven by the
// Settings colour picker) is added on top by useAppTheme as `primary` / `p`.

export { cream, gold, ink, janmashtami, krishna, peacock, status };

type ThemeKey =
	| "page" | "raised" | "sunken" | "scrim" | "divider"
	| "text" | "textSecondary" | "textMuted" | "textAccent"
	| "borderCard" | "borderStrong" | "card" | "well" | "hairline"
	| "background" | "surface" | "border" | "accent";
type BaseThemeShape = Record<ThemeKey, string>;

export const lightTheme: BaseThemeShape = {
	page: surface.light.page,
	raised: surface.light.raised,
	sunken: surface.light.sunken,
	scrim: surface.light.scrim,
	divider: surface.light.divider,
	text: text.light.primary,
	textSecondary: text.light.secondary,
	textMuted: text.light.muted,
	textAccent: text.light.accent,
	borderCard: "rgba(232, 200, 120, 0.7)",
	borderStrong: "#F0BE33",
	/** `bg-white dark:bg-slate-800` — the old app's most common card pairing. */
	card: "#FFFFFF",
	/** `bg-slate-100 dark:bg-slate-800` — icon wells, chips. */
	well: ink[100],
	/** `border-slate-100 dark:border-slate-800` — row separators. */
	hairline: ink[100],

	// Legacy keys used by screens not yet restyled.
	background: surface.light.page,
	surface: surface.light.raised,
	border: "rgba(232, 200, 120, 0.7)",
	accent: janmashtami.deepGold,
};

export type BaseTheme = BaseThemeShape;

export const darkTheme: BaseTheme = {
	page: surface.dark.page,
	raised: surface.dark.raised,
	sunken: surface.dark.sunken,
	scrim: surface.dark.scrim,
	divider: surface.dark.divider,
	text: text.dark.primary,
	textSecondary: text.dark.secondary,
	textMuted: text.dark.muted,
	textAccent: text.dark.accent,
	borderCard: "rgba(255, 213, 79, 0.15)",
	borderStrong: "rgba(255, 213, 79, 0.4)",
	card: ink[800],
	well: ink[800],
	hairline: ink[800],

	background: surface.dark.page,
	surface: surface.dark.raised,
	border: "rgba(255, 213, 79, 0.15)",
	accent: gold[300],
};

/** `bg-jm-royal` — the header and bottom-nav gradient (160deg). */
export const royalGradient = ["#103A8C", "#0B2E6B", "#071C40"] as const;
/** `bg-jm-rule` — the gold hairline that fades out at both ends. */
export const ruleGradient = ["transparent", janmashtami.borderGold, janmashtami.gold, janmashtami.borderGold, "transparent"] as const;

/** Serif face for headings (`font-display` / `font-hindi-display`). */
export const serif = "serif";

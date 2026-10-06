/**
 * Janmashtami Design System — Colour
 * ==================================
 *
 * Single source of truth for every colour in the app. `tailwind.config.js`
 * imports this file, so a change here propagates to every utility class.
 *
 * Three rules govern this file:
 *
 * 1. NOTHING is hardcoded downstream. If you need a colour, add it here.
 * 2. `ink` is the replacement for Tailwind's stock `slate`. It keeps the same
 *    relative luminance at every step (so the ~5,900 existing `slate-*`
 *    usages and their light/dark pairings keep working) but shifts the hue
 *    toward Krishna blue. `ink-800`/`ink-900` land exactly on the brief's
 *    dark-mode card and background values.
 * 3. Third-party brand colours (Google, PhonePe, YouTube …) live in
 *    `brandMarks` and must NEVER be re-themed — recolouring them
 *    misrepresents the provider and breaks their brand guidelines.
 */

/** Core Janmashtami identity, exactly as specified in the brand brief. */
export const janmashtami = {
	/** Primary Krishna Blue — the app's anchor colour. */
	krishnaBlue: "#0B2E6B",
	/** Royal Temple Blue — lighter partner for gradients and pressed states. */
	royalBlue: "#103A8C",
	/** Golden Accent — highlights, active states, ornament highlights. */
	gold: "#FFD54F",
	/** Deep Gold — text-safe gold, borders, iconography. */
	deepGold: "#D4A017",
	/** Peacock Green — the third voice; used sparingly for balance. */
	peacock: "#157A6E",
	/** Cream Background — the page. */
	cream: "#FFF8E7",
	/** Card Background — one step brighter than the page. */
	cardCream: "#FFFDF7",
	/** Border Gold — the temple-invitation edge. */
	borderGold: "#E8C878",
	/** Text Primary. */
	textPrimary: "#1D2433",
	/** Text Secondary. */
	textSecondary: "#5A6170",
	/** Success. */
	success: "#2E8B57",
	/** Error. */
	error: "#C0392B",
} as const;

/** Dark-mode surfaces, exactly as specified in the brand brief. */
export const janmashtamiDark = {
	/** Page background — Vrindavan night sky. */
	background: "#071529",
	/** Card surface — one step above the night. */
	card: "#0F2242",
	/** Accent stays gold in the dark; it is the lamp. */
	accent: "#FFD54F",
	/** Primary text. */
	text: "#F7F7F7",
} as const;

/**
 * Krishna Blue ramp. `500` is Royal Temple Blue and `600` is Primary
 * Krishna Blue, so `bg-krishna-600` is the canonical brand surface.
 */
export const krishna = {
	50: "#EEF3FB",
	100: "#D8E3F5",
	200: "#B0C5E8",
	300: "#7E9BD3",
	400: "#4A6FB8",
	500: "#103A8C",
	600: "#0B2E6B",
	700: "#092555",
	800: "#071C40",
	900: "#05142E",
	950: "#030C1C",
} as const;

/**
 * Gold ramp. `300` is the bright Golden Accent and `500` is Deep Gold.
 * Use `500`+ for gold *text* on cream (the lighter steps fail contrast),
 * and `300` for gold text on dark blue.
 */
export const gold = {
	50: "#FFFBEB",
	100: "#FFF3C9",
	200: "#FFE79B",
	300: "#FFD54F",
	400: "#F0BE33",
	500: "#D4A017",
	600: "#B08313",
	700: "#8A660F",
	800: "#63490B",
	900: "#3F2E07",
} as const;

/**
 * Cream ramp — the warm paper the light theme is printed on.
 *
 * `50` is the specified Cream Background and `25` is the Card Background
 * (brighter than the page, so cards lift off it without a shadow). The deeper
 * steps are for inset wells and for cream *text* on Krishna-blue surfaces.
 */
export const cream = {
	25: "#FFFDF7",
	50: "#FFF8E7",
	100: "#FDF1D6",
	200: "#F6EED9",
	300: "#EFE1BC",
	400: "#E3CF9C",
	500: "#D2B878",
} as const;

/** Peacock Green ramp. `500` is the specified Peacock Green. */
export const peacock = {
	50: "#E7F5F3",
	100: "#C4E8E3",
	200: "#8FD2C9",
	300: "#4FB3A6",
	400: "#229184",
	500: "#157A6E",
	600: "#10635A",
	700: "#0C4C45",
	800: "#083630",
	900: "#05221E",
} as const;

/**
 * Temple Ink — the blue-tinted neutral ramp that replaces stock `slate`.
 *
 * Luminance is matched step-for-step against Tailwind's slate so that every
 * existing `light / dark:` pairing in the codebase continues to read
 * correctly. Only the hue moves, toward Krishna blue.
 *
 * Two steps are pinned to the brief:
 *   800 → #0F2242  (dark-mode card — `dark:bg-slate-800`, 563 usages)
 *   900 → #071529  (dark-mode page — `dark:bg-slate-900`, 345 usages)
 */
export const ink = {
	50: "#F7F9FD",
	100: "#EEF2FA",
	200: "#DCE4F1",
	300: "#C0CDE4",
	400: "#8B9CBF",
	500: "#5C6E93",
	600: "#40527A",
	700: "#16305C",
	800: "#0F2242",
	900: "#071529",
	950: "#030B1A",
} as const;

/** Semantic status colours. */
export const status = {
	success: "#2E8B57",
	successSoft: "#E6F4EC",
	successStrong: "#1F6B41",
	error: "#C0392B",
	errorSoft: "#FBEAE8",
	errorStrong: "#8E2A20",
	warning: "#D4A017",
	warningSoft: "#FFF6DC",
	info: "#103A8C",
	infoSoft: "#E7EEF9",
} as const;

/**
 * Surfaces — the four planes the UI is built from, light and dark.
 * Consumed by `tokens.css` as CSS variables so inline styles can reach them.
 */
export const surface = {
	light: {
		/** The page. */
		page: "#FFF8E7",
		/** Cards, sheets, list rows. */
		raised: "#FFFDF7",
		/** Pressed / inset wells, code blocks, sub-lists. */
		sunken: "#F6EED9",
		/** Modal scrims. */
		scrim: "rgba(11, 46, 107, 0.55)",
		/** Hairline between rows. */
		divider: "rgba(232, 200, 120, 0.45)",
	},
	dark: {
		page: "#071529",
		raised: "#0F2242",
		sunken: "#050F1F",
		scrim: "rgba(3, 11, 26, 0.7)",
		divider: "rgba(255, 213, 79, 0.18)",
	},
} as const;

/** Text colours, light and dark. */
export const text = {
	light: {
		primary: "#1D2433",
		secondary: "#5A6170",
		/** Captions, timestamps, counts. Meets AA on cream. */
		muted: "#6E7585",
		/** On Krishna-blue surfaces. */
		onDark: "#FFF8E7",
		/** Gold text — only the deep gold is AA-safe on cream. */
		accent: "#8A660F",
	},
	dark: {
		primary: "#F7F7F7",
		secondary: "#C0CDE4",
		muted: "#8B9CBF",
		onDark: "#F7F7F7",
		accent: "#FFD54F",
	},
} as const;

/**
 * Third-party brand marks. DO NOT RE-THEME.
 *
 * These identify external services. Recolouring them to fit the Janmashtami
 * palette would misrepresent the provider. Every one of these was found
 * hardcoded in the codebase during the audit; they are collected here so a
 * future colour sweep can recognise and skip them.
 */
export const brandMarks = {
	googleBlue: "#4285F4",
	googleRed: "#EA4335",
	googleYellow: "#FBBC05",
	googleGreen: "#34A853",
	phonePePurple: "#5F259F",
	youtubeRed: "#FF0000",
	instagramPink: "#E42A53",
	instagramOrange: "#EF3E5C",
	facebookBlue: "#1877F2",
	whatsappGreen: "#25D366",
} as const;

/**
 * Gold gradient stops used by ornament SVGs and the header lockup.
 * Kept here so every gold gradient in the app is identical.
 */
export const goldGradient = {
	from: "#FFE9A8",
	via: "#FFD54F",
	to: "#B08313",
} as const;

/** Krishna-blue gradient for the app bar and nav. */
export const blueGradient = {
	from: "#103A8C",
	via: "#0B2E6B",
	to: "#071C40",
} as const;

export const colors = {
	janmashtami,
	janmashtamiDark,
	krishna,
	gold,
	cream,
	peacock,
	ink,
	status,
	surface,
	text,
	brandMarks,
	goldGradient,
	blueGradient,
} as const;

export default colors;

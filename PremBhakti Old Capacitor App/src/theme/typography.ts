/**
 * Design System — Typography
 * =====================================
 *
 * This application uses a unified typography system heavily prioritizing
 * This application uses a unified typography system prioritizing
 * Roboto for body text, Playfair Display for headings, and Noto Sans Devanagari for Hindi.
 *
 * Four Latin roles, plus a dedicated Devanagari pair.
 *
 *   display     Playfair Display        — screen titles, the app lockup.
 *   heading     Playfair Display        — section headers, card titles.
 *   body        Roboto                  — everything readable: lists, paragraphs, UI.
 *   decorative  Playfair Display        — verse, quotes, invocations.
 *   hindi       Noto Sans Devanagari    — all Devanagari body text.
 *   hindiDisplay Noto Serif Devanagari   — Devanagari headings.
 *
 * ── Why the fallback chains are long ────────────────────────────────────────
 * This app is offline-first Capacitor Android. Web fonts cannot be fetched at
 * runtime without a network, so every family degrades explicitly to a face that is actually
 * present on the device. If `public/fonts/` has no binary for a family, text
 * still renders in a deliberate, related face rather than defaulting to a
 * random sans.
 *
 * ── Devanagari ─────────────────────────────────────────────────────────────
 * Comic Sans MS has NO Devanagari coverage. Hindi content must therefore use
 * `font-hindi` / `font-hindi-display`, never `font-display`. Two safety nets
 * back that up: the `@font-face` rules in `public/fonts/fonts.css` carry
 * `unicode-range: U+0000-024F` on the Latin faces, so the browser never tries
 * to render Devanagari from a Latin font even if a class is applied
 * incorrectly; and every Latin stack below lists a Noto Devanagari face so the
 * character still lands on a font we ship.
 */

/**
 * The one Latin stack.
 *
 * `"Noto Sans Devanagari"` sits after Comfortaa but BEFORE the system fonts.
 * That is not a mistake. This app mixes scripts constantly — an English-classed
 * heading regularly contains a Sanskrit term, and screen titles are often
 * bilingual. Because a browser resolves fallback per character, and because
 * `fonts.css` clamps that face to `unicode-range: U+0900-097F, …`, the effect
 * is: Latin characters render in Comfortaa, and any Devanagari character that
 * appears inside them renders in the Devanagari face we ship — not in whatever
 * the device happens to have. It also catches `₹`, which Google's `latin`
 * subset omits.
 */
const latinStack = [
	'"Roboto"',
	'"Noto Sans Devanagari"',
	"system-ui",
	"-apple-system",
	'"Segoe UI"',
	'"Helvetica Neue"',
	"Arial",
	"sans-serif",
] as const;

const headingStack = [
	'"Playfair Display"',
	"Georgia",
	"serif",
	'"Noto Serif Devanagari"',
] as const;

/**
 * Font stacks. Consumed by `tailwind.config.js` → `theme.fontFamily`.
 */
export const fontFamily = {
	/** Screen titles, the app lockup. */
	display: headingStack,
	/** Section headers, card titles. */
	heading: headingStack,
	/** UI and reading. The default body face. */
	body: latinStack,
	/** Verse, quotes, invocations. */
	decorative: headingStack,
	/** Devanagari body. Nirmala UI ships on Windows, Mangal is the legacy fallback. */
	hindi: [
		'"Roboto"',
		'"Noto Sans Devanagari"',
		'"Nirmala UI"',
		'"Kohinoor Devanagari"',
		"Mangal",
		"system-ui",
		"sans-serif",
	],
	/** Devanagari headings — serif for ceremonial weight. */
	hindiDisplay: [
		'"Playfair Display"',
		'"Noto Serif Devanagari"',
		'"Noto Sans Devanagari"',
		'"Nirmala UI"',
		'"Kohinoor Devanagari"',
		"Mangal",
		"serif",
	],
} as const;

/**
 * Responsive type scale.
 *
 * `clamp(min, preferred, max)` means the scale is fluid between phone and
 * desktop without media queries. Note `index.css` already scales the root
 * font-size at 1024px (115%) and 1440px (130%) for TV/desktop, so the `rem`
 * values here compound with that — which is why the clamp ceilings are
 * conservative.
 *
 * ── A note on the letter-spacing values ────────────────────────────────────
 * These were originally tuned for Cinzel, an inscriptional capital face that
 * needs generous tracking to breathe. Comfortaa is a rounded geometric sans
 * with wide sidebearings built in, so the same numbers read as too loose on it.
 * `jm-display` and `jm-overline` have been pulled in accordingly. If the four
 * Latin roles are ever re-split back onto serif faces, widen them again.
 *
 * Each entry is a Tailwind `fontSize` tuple: [size, { lineHeight, letterSpacing }]
 */
export const fontSize = {
	/** Splash / hero lockup only. */
	"jm-display": [
		"clamp(2rem, 1.6rem + 2vw, 2.75rem)",
		{ lineHeight: "1.1", letterSpacing: "0.01em" },
	],
	/** Screen title (h1). */
	"jm-h1": [
		"clamp(1.5rem, 1.3rem + 1vw, 1.875rem)",
		{ lineHeight: "1.2", letterSpacing: "0.01em" },
	],
	/** Section header (h2). */
	"jm-h2": [
		"clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)",
		{ lineHeight: "1.25", letterSpacing: "0.01em" },
	],
	/** Card title (h3). */
	"jm-h3": [
		"clamp(1.0625rem, 1rem + 0.3vw, 1.1875rem)",
		{ lineHeight: "1.35", letterSpacing: "0" },
	],
	/** Sub-heading (h4), list row titles. */
	"jm-h4": ["1rem", { lineHeight: "1.4", letterSpacing: "0" }],
	/** Long-form reading — bhajan and book body text. */
	"jm-body-lg": ["1.0625rem", { lineHeight: "1.7", letterSpacing: "0" }],
	/** Default body. */
	"jm-body": ["0.9375rem", { lineHeight: "1.6", letterSpacing: "0" }],
	/** Secondary body, list subtitles. */
	"jm-body-sm": ["0.875rem", { lineHeight: "1.55", letterSpacing: "0" }],
	/** Captions, timestamps, counts. */
	"jm-caption": ["0.8125rem", { lineHeight: "1.45", letterSpacing: "0.01em" }],
	/** Eyebrow / overline above section headers — always uppercase + tracked. */
	"jm-overline": ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.16em" }],
	/** Bottom-nav labels, badges. */
	"jm-micro": ["0.625rem", { lineHeight: "1.2", letterSpacing: "0.03em" }],
} as const;

/**
 * Weights.
 *
 * Comfortaa ships a 300–700 variable range, so all four of these are real
 * weights rather than synthesised ones. This is a change from the previous
 * system, where Marcellus was Regular-only and `font-bold` on `font-heading`
 * was forbidden; that restriction no longer applies.
 */
export const fontWeight = {
	regular: "400",
	medium: "500",
	semibold: "600",
	bold: "700",
} as const;

/**
 * Semantic text roles.
 *
 * Composed Tailwind class strings. Import these instead of re-deriving a
 * heading style — this is what replaces the 1,212 ad-hoc `font-bold` usages
 * and the arbitrary `text-[13px]` card titles found in the audit.
 *
 * ── Where hierarchy now comes from ─────────────────────────────────────────
 * When headings were Marcellus (serif) and body was Inter (sans), a heading
 * read as a heading even at the same size and weight — the letterforms did the
 * work. With Comfortaa on every Latin role that contrast is gone, so SIZE,
 * WEIGHT and COLOUR are the only signals left. Hence the explicit weights on
 * `sectionTitle` and `cardTitle` below, which the previous system could not
 * have (Marcellus shipped Regular only). Do not strip them: at a flat 400,
 * a Comfortaa section title is nearly indistinguishable from the paragraph
 * under it.
 *
 * Usage:
 *   import { textRole } from "@/src/theme";
 *   <h2 className={textRole.sectionTitle}>…</h2>
 */
export const textRole = {
	/** Splash / onboarding hero. */
	display:
		"font-display text-jm-display font-semibold text-ink-900 dark:text-cream-50",
	/** Screen title in an app bar or at the top of a scroll view. */
	screenTitle:
		"font-display text-jm-h1 font-semibold text-ink-900 dark:text-cream-50",
	/** Eyebrow above a section header. Pair with `sectionTitle`. */
	overline:
		"font-body text-jm-overline font-semibold uppercase text-gold-700 dark:text-gold-300",
	/** Section header inside a scroll view. */
	sectionTitle:
		"font-heading text-jm-h2 font-semibold text-ink-900 dark:text-cream-50",
	/** Card / list-row title. */
	cardTitle:
		"font-heading text-jm-h3 font-medium text-ink-900 dark:text-cream-50",
	/** Card / list-row supporting line. */
	cardSubtitle: "font-body text-jm-body-sm text-ink-500 dark:text-ink-300",
	/** Default paragraph. */
	body: "font-body text-jm-body text-ink-800 dark:text-ink-200",
	/** Long-form reading (bhajan lyrics, book pages). */
	reading: "font-body text-jm-body-lg text-ink-800 dark:text-ink-100",
	/** Verse, quotes, invocations. No `italic` — Comfortaa has no true italic. */
	verse: "font-decorative text-jm-body-lg text-ink-800 dark:text-cream-100",
	/** Caption, timestamp, count. */
	caption: "font-body text-jm-caption text-ink-500 dark:text-ink-400",
	/** Bottom-nav label, badge. */
	micro: "font-body text-jm-micro font-semibold",
	/** Devanagari body. */
	hindiBody: "font-hindi text-jm-body text-ink-800 dark:text-ink-200",
	/** Devanagari reading (bhajan lyrics). */
	hindiReading: "font-hindi text-jm-body-lg text-ink-800 dark:text-ink-100",
	/** Devanagari heading. */
	hindiTitle: "font-hindi-display text-jm-h2 text-ink-900 dark:text-cream-50",
} as const;

/**
 * Picks the correct text role for the active language.
 *
 * Latin roles must never be applied to Devanagari — Comfortaa has no
 * Devanagari glyphs. Call this at any bilingual call site.
 *
 * @example
 *   <h2 className={localizedRole("sectionTitle", settingsLanguage)}>
 */
export const localizedRole = (
	role: "sectionTitle" | "cardTitle" | "body" | "reading",
	language: "en" | "hi",
): string => {
	if (language !== "hi") return textRole[role];
	switch (role) {
		case "sectionTitle":
		case "cardTitle":
			return textRole.hindiTitle;
		case "reading":
			return textRole.hindiReading;
		default:
			return textRole.hindiBody;
	}
};

export const typography = {
	fontFamily,
	fontSize,
	fontWeight,
	textRole,
	localizedRole,
} as const;

export default typography;

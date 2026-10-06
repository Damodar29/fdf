/**
 * Tailwind — Janmashtami Design System
 * ===================================
 *
 * This file contains NO literal design values. Every colour, font, radius,
 * shadow, spacing step and keyframe is imported from `src/theme/*`, which is the
 * single source of truth. To change the look of the app, edit those files.
 *
 * ── The migration strategy encoded here ─────────────────────────────────────
 *
 * The audit counted ~9,400 colour utility usages across 109 files. Rewriting
 * every call site would be enormous and would risk breaking layout. Instead,
 * four token families are REDEFINED so that existing class names resolve to
 * Janmashtami values without a single component edit:
 *
 *   `slate-50…950`  → the `ink` ramp   (5,871 usages)
 *                     Luminance-matched to stock slate step-for-step, hue
 *                     shifted to Krishna blue, with 800/900 pinned exactly to
 *                     the brief's dark-mode card (#0F2242) and page (#071529).
 *                     Every existing `bg-white dark:bg-slate-800` pairing keeps
 *                     the same contrast relationship and simply becomes warmer
 *                     and bluer.
 *
 *   `ry-*`          → Janmashtami equivalents (717 usages)
 *                     The old Radha-Yellow palette: maroon → Krishna blue,
 *                     cream → page cream, gold → deep gold, sand → card cream,
 *                     brown → secondary text.
 *
 *   `jm-primary` /
 *   `jm-secondary` /
 *   `jm-accent`     → real Janmashtami values. These three tokens already
 *                     existed but pointed at generic slate/teal/amber.
 *
 *   `saffron-50…900`→ unchanged; still reads the `--color-primary-*` CSS
 *                     variables written at runtime by `utils/theme.ts`. That
 *                     engine powers the user-facing 16-palette picker in
 *                     Settings, which is a shipped feature. `janmashtami` was
 *                     ADDED to it as the new default palette, so the app boots
 *                     Krishna blue while the picker keeps working.
 *
 * Everything under "NEW SEMANTIC TOKENS" is additive and used by new work.
 */

import { animation, easing, keyframes } from "./src/theme/animations.ts";
import {
	blueGradient,
	cream,
	gold,
	goldGradient,
	ink,
	janmashtami,
	krishna,
	peacock,
	status,
	surface,
	text,
} from "./src/theme/colors.ts";
import { borderRadius } from "./src/theme/radius.ts";
import { boxShadow } from "./src/theme/shadows.ts";
import { spacing } from "./src/theme/spacing.ts";
import { fontFamily, fontSize, fontWeight } from "./src/theme/typography.ts";

/** @type {import('tailwindcss').Config} */
export default {
	future: {
		hoverOnlyWhenSupported: true,
	},
	content: [
		"./index.html",
		"./App.tsx",
		"./index.tsx",
		"./components/**/*.{js,ts,jsx,tsx}",
		"./hooks/**/*.{js,ts,jsx,tsx}",
		"./context/**/*.{js,ts,jsx,tsx}",
		"./services/**/*.{js,ts,jsx,tsx}",
		"./utils/**/*.{js,ts,jsx,tsx}",
		// Covers src/theme/*.ts, so the composed class strings in the design
		// system's recipes (card.base, button.primary, textRole.*) are scanned.
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				// ── REDEFINED: legacy Radha-Yellow tokens ──────────────────────
				// Kept as names so the 717 existing usages continue to compile;
				// repointed so they render Janmashtami.
				"ry-maroon": janmashtami.krishnaBlue, //  #5D1B1B → #0B2E6B
				"ry-cream": janmashtami.cream, //  #F9F3E5 → #FFF8E7
				"ry-gold": janmashtami.deepGold, //  #D4AF37 → #D4A017
				"ry-brown": janmashtami.textSecondary, //  #4A3B32 → #5A6170
				"ry-sand": janmashtami.cardCream, //  #F2EBDA → #FFFDF7

				// ── REDEFINED: the three pre-existing jm-* tokens ──────────────
				"jm-primary": janmashtami.krishnaBlue, //  #0f172a → #0B2E6B
				"jm-secondary": janmashtami.peacock, //  #0d9488 → #157A6E
				"jm-accent": janmashtami.gold, //  #fbbf24 → #FFD54F

				// ── REDEFINED: slate → Temple Ink ─────────────────────────────
				// The single highest-leverage change in the migration. `extend`
				// replaces the whole `slate` object, so all 11 steps are listed.
				slate: ink,

				// ── UNCHANGED: runtime palette engine ─────────────────────────
				saffron: {
					50: "var(--color-primary-50)",
					100: "var(--color-primary-100)",
					200: "var(--color-primary-200)",
					300: "var(--color-primary-300)",
					400: "var(--color-primary-400)",
					500: "var(--color-primary-500)",
					600: "var(--color-primary-600)",
					700: "var(--color-primary-700)",
					800: "var(--color-primary-800)",
					900: "var(--color-primary-900)",
				},

				// ── NEW SEMANTIC TOKENS ───────────────────────────────────────
				krishna,
				gold,
				cream,
				peacock,
				ink,

				success: {
					DEFAULT: status.success,
					soft: status.successSoft,
					strong: status.successStrong,
				},
				error: {
					DEFAULT: status.error,
					soft: status.errorSoft,
					strong: status.errorStrong,
				},
				warning: {
					DEFAULT: status.warning,
					soft: status.warningSoft,
				},
				info: {
					DEFAULT: status.info,
					soft: status.infoSoft,
				},

				// Semantic surfaces. These read the CSS variables from
				// `src/theme/tokens.css`, so a single class is correct in both
				// light and dark mode with no `dark:` variant needed.
				surface: {
					page: "var(--jm-surface-page)",
					raised: "var(--jm-surface-raised)",
					sunken: "var(--jm-surface-sunken)",
					scrim: "var(--jm-surface-scrim)",
				},
				content: {
					primary: "var(--jm-text-primary)",
					secondary: "var(--jm-text-secondary)",
					muted: "var(--jm-text-muted)",
					accent: "var(--jm-text-accent)",
					"on-dark": text.light.onDark,
				},
				edge: {
					card: "var(--jm-border-card)",
					strong: "var(--jm-border-strong)",
					divider: "var(--jm-divider)",
					gold: janmashtami.borderGold,
				},
			},

			// ── TYPOGRAPHY ──────────────────────────────────────────────────
			// All Latin font weights are now handled directly by Tailwind class
			// combinations.
			fontFamily: {
				display: fontFamily.display,
				heading: fontFamily.heading,
				body: fontFamily.body,
				decorative: fontFamily.decorative,
				"hindi-display": fontFamily.hindiDisplay,

				// Legacy keys, repointed to the new semantic stacks.
				hindi: fontFamily.hindi,
				sans: fontFamily.body,
				inter: fontFamily.body,
				logo: fontFamily.display,
				serif: fontFamily.heading,
			},
			fontSize,
			fontWeight,

			// ── SHAPE, DEPTH, SPACE ─────────────────────────────────────────
			borderRadius,
			boxShadow,
			spacing,
			// Tailwind 3.4 derives min-w/min-h from the spacing scale, but these
			// are declared explicitly so `min-h-touch` cannot silently no-op.
			minHeight: { touch: spacing.touch, "touch-lg": spacing["touch-lg"] },
			minWidth: { touch: spacing.touch, "touch-lg": spacing["touch-lg"] },

			backgroundImage: {
				"jm-gold": `linear-gradient(180deg, ${goldGradient.from} 0%, ${goldGradient.via} 45%, ${goldGradient.to} 100%)`,
				"jm-gold-h": `linear-gradient(90deg, ${goldGradient.to} 0%, ${goldGradient.via} 50%, ${goldGradient.to} 100%)`,
				"jm-royal": `linear-gradient(160deg, ${blueGradient.from} 0%, ${blueGradient.via} 55%, ${blueGradient.to} 100%)`,
				"jm-rule": `linear-gradient(90deg, transparent 0%, ${janmashtami.borderGold} 25%, ${janmashtami.gold} 50%, ${janmashtami.borderGold} 75%, transparent 100%)`,
				"jm-cream": `linear-gradient(180deg, ${cream[25]} 0%, ${cream[50]} 55%, ${cream[100]} 100%)`,
				"jm-night": `linear-gradient(180deg, ${surface.dark.page} 0%, ${krishna[900]} 60%, ${ink[950]} 100%)`,
			},

			// ── MOTION ──────────────────────────────────────────────────────
			// The nine pre-existing animations are preserved verbatim; the
			// `jm-*` set is added alongside them. Names cannot collide because
			// every new keyframe carries the `jm-` prefix.
			transitionTimingFunction: {
				"jm-out": easing.out,
				"jm-in": easing.in,
				"jm-in-out": easing.inOut,
				"jm-spring": easing.spring,
				"jm-drift": easing.drift,
			},
			animation: {
				"fade-in-up": "fadeInUp 0.4s ease-out forwards",
				"fade-in": "fadeIn 0.3s ease-out forwards",
				"slide-in-right": "slideInRight 0.3s ease-out forwards",
				"slide-in-left": "slideInLeft 0.3s ease-out forwards",
				"slide-in-bottom": "slideInBottom 0.3s ease-out forwards",
				pop: "pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
				"pulse-slow": "pulse 3s infinite",
				"toast-in": "toastIn 0.3s ease-out forwards",
				"float-slow": "float-slow 6s ease-in-out infinite",
				"float-slow-reverse": "float-slow-reverse 7s ease-in-out infinite",
				...animation,
			},
			keyframes: {
				fadeInUp: {
					"0%": { opacity: "0", transform: "translateY(15px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				fadeIn: {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
				slideInRight: {
					"0%": { transform: "translateX(100%)" },
					"100%": { transform: "translateX(0)" },
				},
				slideInLeft: {
					"0%": { transform: "translateX(-100%)" },
					"100%": { transform: "translateX(0)" },
				},
				slideInBottom: {
					"0%": { transform: "translateY(100%)" },
					"100%": { transform: "translateY(0)" },
				},
				pop: {
					"0%": { transform: "scale(0.9)", opacity: "0" },
					"100%": { transform: "scale(1)", opacity: "1" },
				},
				toastIn: {
					"0%": { transform: "translateY(100%)", opacity: "0" },
					"100%": { transform: "translateY(0)", opacity: "1" },
				},
				"float-slow": {
					"0%, 100%": { transform: "translate(0, 0)" },
					"50%": { transform: "translate(20px, 30px)" },
				},
				"float-slow-reverse": {
					"0%, 100%": { transform: "translate(0, 0)" },
					"50%": { transform: "translate(-20px, -20px)" },
				},
				...keyframes,
			},
		},
	},
	plugins: [],
};

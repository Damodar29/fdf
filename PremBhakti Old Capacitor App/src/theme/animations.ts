/**
 * Janmashtami Design System — Motion
 * =================================
 *
 * Allowed by the brief: fade, scale, glow, ripple, floating feather, smooth
 * transitions. Forbidden: flashing, excessive movement, anything distracting.
 * Target is 60 FPS.
 *
 * ── The 60 FPS rule ────────────────────────────────────────────────────────
 * Every animation in this file touches ONLY `transform` and `opacity`, the two
 * properties the compositor can animate without layout or paint. Animating
 * `height`, `top`, `width`, `background-position` or `box-shadow` forces work
 * onto the main thread and is what drops frames on the low-end Android devices
 * this app targets. `filter: drop-shadow` is likewise avoided in loops.
 *
 * ── Reduced motion ─────────────────────────────────────────────────────────
 * `tokens.css` carries a `@media (prefers-reduced-motion: reduce)` block that
 * neutralises every animation defined here. Ambient loops (floating feather,
 * sparkles) are additionally gated in React via `useReducedMotion()` so they
 * never even mount — a paused animation still costs a composited layer.
 *
 * ── Device tier ────────────────────────────────────────────────────────────
 * The app already has `src/hooks/useDevicePerformance.ts` and passes an
 * `isLowEnd` flag into the home tiles to drop `backdrop-blur`. Ambient
 * decorative motion should respect the same flag.
 */

/** Duration scale, in ms. Keep transitions under 300ms so the UI feels direct. */
export const duration = {
	/** Press feedback — must be near-instant. */
	instant: 100,
	/** Hover, colour, small state changes. */
	fast: 160,
	/** The default. Card lift, tab switch. */
	base: 240,
	/** Screen transitions, sheet open. */
	slow: 320,
	/** Ornament reveal. */
	deliberate: 520,
} as const;

/** Easing curves. */
export const easing = {
	/** Default — decelerate. Things arriving on screen. */
	out: "cubic-bezier(0.16, 1, 0.3, 1)",
	/** Accelerate. Things leaving. */
	in: "cubic-bezier(0.7, 0, 0.84, 0)",
	/** Symmetric. Things moving within the screen. */
	inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
	/** Gentle overshoot for a press release. Used sparingly. */
	spring: "cubic-bezier(0.34, 1.4, 0.64, 1)",
	/** Ambient drift — no perceptible start or stop. */
	drift: "cubic-bezier(0.45, 0, 0.55, 1)",
} as const;

/**
 * Keyframes added to Tailwind.
 *
 * Names are prefixed `jm-` so they cannot collide with the existing keyframes
 * in `index.css` (`fadeInUp`, `pop`, `float-slow`, `twinkling-stars`, …),
 * which remain in place and functional.
 */
export const keyframes = {
	/** Fade + small rise. The default entrance. */
	"jm-enter": {
		from: { opacity: "0", transform: "translate3d(0, 8px, 0)" },
		to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
	},
	/** Fade only — for elements where movement would be noise. */
	"jm-fade": {
		from: { opacity: "0" },
		to: { opacity: "1" },
	},
	/** Scale up from 96%. Modals, popovers. */
	"jm-scale-in": {
		from: { opacity: "0", transform: "scale3d(0.96, 0.96, 1)" },
		to: { opacity: "1", transform: "scale3d(1, 1, 1)" },
	},
	/**
	 * Gold glow breathing. Opacity-only on a pseudo-layer, so no box-shadow
	 * recalculation per frame.
	 */
	"jm-glow-pulse": {
		"0%, 100%": { opacity: "0.45" },
		"50%": { opacity: "1" },
	},
	/**
	 * Floating peacock feather — a slow, asymmetric drift with a lazy rotation.
	 * Asymmetric on purpose: a symmetric sine looks mechanical.
	 */
	"jm-feather-float": {
		"0%": { transform: "translate3d(0, 0, 0) rotate(0deg)" },
		"33%": { transform: "translate3d(6px, -10px, 0) rotate(3deg)" },
		"66%": { transform: "translate3d(-4px, -4px, 0) rotate(-2deg)" },
		"100%": { transform: "translate3d(0, 0, 0) rotate(0deg)" },
	},
	/** Festival sparkle — twinkle in place. */
	"jm-sparkle": {
		"0%, 100%": { opacity: "0.2", transform: "scale3d(0.7, 0.7, 1)" },
		"50%": { opacity: "0.9", transform: "scale3d(1, 1, 1)" },
	},
	/** Touch ripple. */
	"jm-ripple": {
		"0%": { opacity: "0.35", transform: "scale3d(0.4, 0.4, 1)" },
		"100%": { opacity: "0", transform: "scale3d(2.2, 2.2, 1)" },
	},
	/** Ornament reveal — a divider drawing itself outward from the centre. */
	"jm-draw": {
		from: { opacity: "0", transform: "scale3d(0.4, 1, 1)" },
		to: { opacity: "1", transform: "scale3d(1, 1, 1)" },
	},
	/** Active-tab arch rising into place. */
	"jm-arch-rise": {
		from: {
			opacity: "0",
			transform: "translate3d(0, 6px, 0) scale3d(0.9, 0.8, 1)",
		},
		to: { opacity: "1", transform: "translate3d(0, 0, 0) scale3d(1, 1, 1)" },
	},
	/** Slow opacity pulse — used for attention-drawing glow buttons. */
	"pulse-slow": {
		"0%, 100%": { opacity: "1" },
		"50%": { opacity: "0.65" },
	},
} as const;

/** Animation utilities added to Tailwind. */
export const animation = {
	"jm-enter": `jm-enter ${duration.base}ms ${easing.out} both`,
	"jm-fade": `jm-fade ${duration.base}ms ${easing.out} both`,
	"jm-scale-in": `jm-scale-in ${duration.slow}ms ${easing.spring} both`,
	"jm-glow-pulse": `jm-glow-pulse 2.8s ${easing.drift} infinite`,
	"jm-feather-float": `jm-feather-float 11s ${easing.drift} infinite`,
	"jm-sparkle": `jm-sparkle 4.2s ${easing.drift} infinite`,
	"jm-ripple": `jm-ripple 600ms ${easing.out} forwards`,
	"jm-draw": `jm-draw ${duration.deliberate}ms ${easing.out} both`,
	"jm-arch-rise": `jm-arch-rise ${duration.base}ms ${easing.spring} both`,
	"pulse-slow": "pulse-slow 2.5s ease-in-out infinite",
} as const;

/**
 * Interaction class recipes.
 *
 * The audit found `active:scale-95` and `active:scale-[0.98]` used
 * interchangeably. These tokens settle it: 0.97 for cards (a large surface
 * needs less scale to read as pressed) and 0.95 for buttons.
 */
export const interaction = {
	/** Card press. */
	pressCard: "transition-transform duration-150 active:scale-[0.97]",
	/** Button press. */
	pressButton: "transition-transform duration-100 active:scale-95",
	/** Colour/border transition for hover states. */
	hover: "transition-colors duration-200",
	/** Combined lift used by the Card primitive. */
	lift: "transition-[transform,box-shadow,border-color] duration-200 ease-out active:scale-[0.97]",
	/** Focus ring — visible on touch as well as pointer. */
	focus:
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 dark:focus-visible:ring-offset-ink-900",
} as const;

export default { duration, easing, keyframes, animation, interaction };

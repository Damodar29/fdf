import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Peacock Feather Eye — the "new content" indicator.
 *
 * Replaces the red dot the app used to hang off list rows and nav tabs.
 *
 * ── Why replace a red dot at all ──────────────────────────────────────────
 * A red dot is a warning colour doing a neutral job. In this app the badge
 * means "there is a new bhajan" or "a new darshan photo was posted" — good news,
 * and news the user opted into. Red frames that as something wrong that needs
 * clearing, which is the wrong emotional register for a devotional app and
 * clashes with a gold-and-Krishna-blue palette besides. The feather eye carries
 * exactly the same information — small, high-contrast, positioned identically —
 * with none of the alarm, and it ties the badge into the theme's own iconography.
 *
 * Note that #C0392B remains the error colour in `src/theme/colors.ts`. Red is
 * still available; it is just reserved for things that are actually wrong.
 *
 * ── Sizing ───────────────────────────────────────────────────────────────
 * Default 12px, near the floor of what stays legible. The three concentric
 * rings are proportioned so the dark centre remains visible at that size: the
 * inner disc is 40% of the outer radius, which survives rounding to whole
 * pixels on a 1x display.
 *
 * Colour it with `text-peacock-500` on light surfaces and `text-gold-300` on
 * dark ones; both keep well clear of the error red.
 *
 * Square. Default 12px.
 */
export function PeacockFeatherEye({
	className,
	size = 12,
	style,
}: OrnamentProps) {
	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 16 16"
			width={size}
			height={size}
			className={className}
			style={style}
		>
			{/* Barb halo — a soft ring standing in for the fine barbs around a real
			    feather eye, which at 12px would be sub-pixel. */}
			<circle cx="8" cy="8" r="7.4" fill="currentColor" opacity="0.16" />
			{/* Outer eye. */}
			<ellipse
				cx="8"
				cy="8"
				rx="6"
				ry="5.2"
				fill="currentColor"
				opacity="0.42"
			/>
			{/* Mid ring. */}
			<ellipse
				cx="8"
				cy="8"
				rx="4"
				ry="3.4"
				fill="currentColor"
				opacity="0.7"
			/>
			{/* Pupil, at full strength so the badge reads as a deliberate mark
			    rather than a smudge. */}
			<ellipse cx="8" cy="8" rx="2" ry="1.9" fill="currentColor" />
		</svg>
	);
}

export default PeacockFeatherEye;

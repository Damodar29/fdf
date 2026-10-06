import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Festival Sparkles — ambient atmosphere.
 *
 * A field of four-point sparkles that twinkle slowly behind content. The only
 * animated ornament in the set.
 *
 * ── The motion budget ────────────────────────────────────────────────────
 * The brief permits fade, scale and glow, and rules out flashing and
 * distracting movement, at 60 FPS. So each sparkle animates `opacity` and
 * `transform: scale3d` only — both compositor-only properties, so the whole
 * field costs no layout and no paint, just a GPU composite. Nothing here
 * animates position, width, or a filter.
 *
 * The cycle is 4.2s with delays spread across it, which means at any instant
 * most sparkles are near their dim extreme and only two or three are bright.
 * A short cycle, or synchronised delays, would read as flashing — the specific
 * thing the brief forbids.
 *
 * ── Two independent off-switches ─────────────────────────────────────────
 * The root carries `jm-ambient`, which `src/theme/tokens.css` sets to
 * `display: none` under `prefers-reduced-motion: reduce` — the element is
 * removed from the render tree entirely, not merely paused. Separately, callers
 * should gate this on the `isLowEnd` flag from `useDevicePerformance()`, because
 * on a budget device the cheapest animation is still one the CPU would rather
 * spend on scrolling.
 *
 * ── Why the centre is empty ──────────────────────────────────────────────
 * Sparkles are clustered toward the edges and corners. Content occupies the
 * middle of every surface this is used on, and a twinkle directly behind a line
 * of text is a legibility problem no matter how low the opacity.
 *
 * Square. Default 280px.
 */

/**
 * cx, cy, radius, animation delay (ms).
 *
 * Hand-placed rather than randomised: a fixed field can be checked for balance
 * and for the empty centre, and it renders identically every mount, so a
 * sparkle never appears to jump when React re-renders the parent.
 */
const SPARKLES: Array<[number, number, number, number]> = [
	[18, 26, 4.5, 0],
	[46, 12, 2.8, 1400],
	[78, 30, 3.4, 700],
	[120, 16, 2.4, 2600],
	[156, 34, 4.2, 1900],
	[184, 20, 2.6, 3300],
	[12, 78, 3.2, 2100],
	[190, 92, 3.6, 900],
	[30, 128, 2.6, 3700],
	[172, 140, 3, 1200],
	[14, 172, 4, 400],
	[58, 186, 2.8, 2900],
	[104, 176, 3.4, 1650],
	[148, 190, 2.5, 3100],
	[186, 166, 3.2, 2300],
];

/** A four-point sparkle centred on the origin. */
function spark(r: number): string {
	const w = r * 0.2;
	return [
		`M0 ${-r}`,
		`L${w} ${-w}L${r} 0L${w} ${w}`,
		`L0 ${r}`,
		`L${-w} ${w}L${-r} 0L${-w} ${-w}`,
		"Z",
	].join("");
}

export function FestivalSparkles({
	className,
	size = 280,
	style,
}: OrnamentProps) {
	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 200 200"
			width={size}
			height={size}
			// `jm-ambient` is the reduced-motion kill switch; see tokens.css.
			className={["jm-ambient", className].filter(Boolean).join(" ")}
			style={style}
		>
			{SPARKLES.map(([cx, cy, r, delay]) => (
				// The translate MUST live on a wrapper <g>, not on the animated
				// <path>. A CSS `transform` (which is what the keyframes set)
				// overrides the SVG `transform` presentation attribute rather than
				// composing with it — put both on one element and every sparkle
				// loses its position and stacks up in the top-left corner the
				// moment the animation's first frame applies.
				<g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
					<path
						d={spark(r)}
						fill="currentColor"
						className="animate-jm-sparkle"
						style={{
							animationDelay: `${delay}ms`,
							// fill-box so scale3d pivots on the sparkle's own centre
							// instead of the SVG user-space origin, which would send it
							// sliding toward the top-left as it grew.
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
				</g>
			))}
		</svg>
	);
}

export default FestivalSparkles;

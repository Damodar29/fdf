import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Golden Mandala — ambient background texture.
 *
 * Concentric rings of lotus petals in radial symmetry. This is the only
 * ornament intended to sit behind content across a whole surface, and
 * `ornamentUsage` caps it at 0.08 opacity for that reason: at anything higher
 * the petal edges start competing with body text for the eye, and text over
 * pattern is the single fastest way to make a themed app feel cheap.
 *
 * ── Why it is generated rather than hand-drawn ────────────────────────────
 * Radial symmetry is the whole point of a mandala, and symmetry is the thing
 * hand-authored path data gets subtly wrong. Every ring here is one petal
 * rotated by `360/n` degrees, so the symmetry is exact by construction. It also
 * keeps the source readable: three `petal()` calls instead of forty path
 * strings nobody can safely edit.
 *
 * ── Petal counts ─────────────────────────────────────────────────────────
 * 16 / 8 / 8. All powers of two sharing common divisors, so the rings align on
 * the same axes and the figure reads as one object instead of three stacked
 * discs. A prime count in any ring destroys that alignment.
 *
 * Square. Default 280px (`ornamentSize.watermark`).
 */

const C = 100; // centre of the 200x200 viewBox

/**
 * One lotus petal pointing straight up, spanning `rInner` to `rOuter` from
 * centre, `width` units wide at its fullest.
 */
function petal(rInner: number, rOuter: number, width: number): string {
	const span = rOuter - rInner;
	const yIn = C - rInner;
	const yOut = C - rOuter;
	const cy1 = yIn - span * 0.35;
	const cy2 = yOut + span * 0.25;
	return [
		`M${C} ${yIn}`,
		`C${C - width} ${cy1} ${C - width} ${cy2} ${C} ${yOut}`,
		`C${C + width} ${cy2} ${C + width} ${cy1} ${C} ${yIn}`,
		"Z",
	].join("");
}

/** `n` copies of `d`, evenly rotated about the centre. */
function ring(n: number, d: string, extra?: { opacity?: number; sw?: number }) {
	return Array.from({ length: n }, (_, i) => (
		<path
			key={i}
			d={d}
			transform={`rotate(${(360 / n) * i} ${C} ${C})`}
			opacity={extra?.opacity}
			strokeWidth={extra?.sw}
		/>
	));
}

export function GoldenMandala({ className, size = 280, style }: OrnamentProps) {
	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 200 200"
			width={size}
			height={size}
			className={className}
			style={style}
		>
			<g
				fill="none"
				stroke="currentColor"
				strokeWidth="1"
				strokeLinejoin="round"
			>
				{/* Outer ring — 16 narrow petals. */}
				{ring(16, petal(70, 94, 7), { opacity: 0.8 })}

				{/* Hairline circles bounding the rings. Concentric circles are what
				    make a mandala read as ordered rather than as a starburst. */}
				<circle cx={C} cy={C} r="68" opacity="0.5" />
				<circle cx={C} cy={C} r="64" opacity="0.3" strokeWidth="0.6" />

				{/* Middle ring — 8 broad petals, offset half a step from the outer
				    ring so petal tips fall between outer petals, not on them. */}
				<g transform={`rotate(22.5 ${C} ${C})`}>
					{ring(8, petal(34, 62, 15), { opacity: 0.85 })}
				</g>

				<circle cx={C} cy={C} r="31" opacity="0.5" />

				{/* Inner ring — 8 small petals back on the primary axes. */}
				{ring(8, petal(12, 28, 7), { opacity: 0.9 })}

				<circle cx={C} cy={C} r="10" opacity="0.7" />
			</g>

			{/* Seed at the centre is removed because when placed behind the Tilak, 
			    it looks like a red/gold dot inside the U-shape, which resembles 
			    other sampradayas (e.g. Swaminarayan/Ramanandi) instead of Gaudiya Vaishnava. */}
			{/* <circle cx={C} cy={C} r="4.5" fill="currentColor" opacity="0.85" /> */}
		</svg>
	);
}

export default GoldenMandala;

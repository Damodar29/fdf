import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Temple Border — the signature arcade.
 *
 * A row of pointed arches with a taller central arch and a lotus-bud finial,
 * derived from a Vrindavan temple doorway. This is the ornament that carries
 * the theme's identity, which is exactly why `ornamentUsage` permits it in only
 * three places: the crown of a featured section header, the darshan tile, and
 * the glorification modal. Used a fourth time it stops being a signature and
 * becomes wallpaper.
 *
 * ── Why the arches are drawn, not tiled ───────────────────────────────────
 * The obvious implementation is one arch in a `<pattern>` repeated across the
 * width. It was rejected because a temple arcade is not uniform: the central
 * bay is taller and wider than the flanking bays, and that asymmetry between
 * centre and edge is what makes the silhouette read as architecture rather than
 * as a scalloped border. So the arcade is laid out explicitly and mirrored
 * about the centre line.
 *
 * ── Why cubics rather than arcs ───────────────────────────────────────────
 * `arch()` builds each arch from two cubic Béziers. The first control point of
 * each half sits directly above the springing point, giving the vertical
 * tangent a real arch has where it leaves the pier. The second sits almost
 * directly below the apex, which forces the two halves to meet at an angle
 * instead of blending into a semicircle — a pointed apex, not a Roman one. An
 * SVG `A` arc command cannot express that in one segment.
 *
 * Aspect ratio 240:28. Default width 240px.
 */

/**
 * One pointed arch.
 *
 * @param x0 left springing point
 * @param x1 right springing point
 * @param ys y of the springing line (where the arch leaves its piers)
 * @param ya y of the apex
 */
function arch(x0: number, x1: number, ys: number, ya: number): string {
	const xm = (x0 + x1) / 2;
	const hw = (x1 - x0) / 2;
	const h = ys - ya;
	// c1 above the springing point → vertical tangent at the pier.
	// c2 just below the apex → steep tangent at the apex, so it comes to a point.
	const c2x = 0.12 * hw;
	const c2y = ya + 0.5 * h;
	return [
		`M${x0} ${ys}`,
		`C${x0} ${ys - 0.5 * h} ${xm - c2x} ${c2y} ${xm} ${ya}`,
		`C${xm + c2x} ${c2y} ${x1} ${ys - 0.5 * h} ${x1} ${ys}`,
	].join("");
}

/** Flanking bays, left half only; the right half is mirrored at render time. */
const SIDE_BAYS: Array<[number, number]> = [
	[5, 27],
	[29, 51],
	[53, 75],
	[77, 99],
];

const SIDE_SPRING = 20;
const SIDE_APEX = 9;
const BASELINE = 26;

export function TempleBorder({ className, size = 240, style }: OrnamentProps) {
	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 240 28"
			width={size}
			height={(size * 28) / 240}
			className={className}
			style={style}
		>
			<g
				fill="none"
				stroke="currentColor"
				strokeWidth="1.1"
				strokeLinecap="round"
			>
				{/* Flanking bays, mirrored about x=120. */}
				{SIDE_BAYS.map(([a, b]) => {
					const d = arch(a, b, SIDE_SPRING, SIDE_APEX);
					return (
						<g key={a}>
							<path d={d} opacity="0.75" />
							<path
								d={arch(240 - b, 240 - a, SIDE_SPRING, SIDE_APEX)}
								opacity="0.75"
							/>
							{/* Piers down to the baseline. */}
							<path d={`M${a} ${SIDE_SPRING}V${BASELINE}`} opacity="0.4" />
							<path d={`M${b} ${SIDE_SPRING}V${BASELINE}`} opacity="0.4" />
							<path
								d={`M${240 - a} ${SIDE_SPRING}V${BASELINE}`}
								opacity="0.4"
							/>
							<path
								d={`M${240 - b} ${SIDE_SPRING}V${BASELINE}`}
								opacity="0.4"
							/>
						</g>
					);
				})}

				{/* Central bay — taller, wider, and drawn at full opacity so the eye
				    lands on the centre of the panel it crowns. */}
				<path d={arch(103, 137, 21, 4)} strokeWidth="1.4" />
				<path d="M103 21V26" opacity="0.55" />
				<path d="M137 21V26" opacity="0.55" />
				{/* Inner echo of the central arch — depth without a second colour. */}
				<path d={arch(109, 131, 21, 9)} strokeWidth="0.8" opacity="0.45" />

				{/* Baseline: a hairline the whole arcade stands on. */}
				<path d={`M2 ${BASELINE}H238`} strokeWidth="0.8" opacity="0.35" />
			</g>

			{/* Lotus-bud finial above the central apex. */}
			<path
				d="M120 0.5c1.9 1.4 2.6 2.9 2.6 4.1 0 1.3-1.2 2.2-2.6 2.2s-2.6-.9-2.6-2.2c0-1.2.7-2.7 2.6-4.1z"
				fill="currentColor"
			/>
		</svg>
	);
}

export default TempleBorder;

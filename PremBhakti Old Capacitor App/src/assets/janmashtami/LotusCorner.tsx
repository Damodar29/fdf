import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Lotus Corner — the card corner motif.
 *
 * A quarter-lotus fanning out of one corner. This is the ornament that does the
 * most work in the app, because `card.base` puts it on essentially every card,
 * and it is the detail that turns a rounded rectangle into something closer to a
 * temple invitation.
 *
 * ── One corner, not four ─────────────────────────────────────────────────
 * `ornamentUsage` restricts this to a single corner — bottom-right by default.
 * Four corners produces a frame, a frame competes with the card's own gold
 * border, and the result is the "overloaded" look the brief explicitly rules
 * out. One corner reads as a maker's mark.
 *
 * Bottom-right specifically: in a left-to-right reading order the bottom-right
 * is where the eye leaves the card, so an ornament there is seen last and never
 * obstructs the title or the first line of content. Top-left — the other
 * candidate — would sit exactly where the title starts.
 *
 * ── Construction ─────────────────────────────────────────────────────────
 * Five petals fanned across the 90° the corner offers, at 22.5° intervals, all
 * rotated about the corner point itself so they radiate from the true corner
 * rather than from a point near it. Two arcs tie them together at the base.
 *
 * Square. Default 56px (`ornamentSize.corner`). Use `corner` to place it in a
 * different corner; the component only draws bottom-right and the flip is a
 * transform, so nothing has to be redrawn.
 */

/** A petal pointing straight up from the origin. */
function petal(rInner: number, rOuter: number, width: number): string {
	const span = rOuter - rInner;
	const c1 = -(rInner + span * 0.35);
	const c2 = -(rOuter - span * 0.25);
	return [
		`M0 ${-rInner}`,
		`C${-width} ${c1} ${-width} ${c2} 0 ${-rOuter}`,
		`C${width} ${c2} ${width} ${c1} 0 ${-rInner}`,
		"Z",
	].join("");
}

/** Which corner the fan grows from. */
export type LotusCornerPosition = "br" | "bl" | "tr" | "tl";

/** Flip transforms about the 56x56 viewBox. `br` is drawn natively. */
const FLIP: Record<LotusCornerPosition, string | undefined> = {
	br: undefined,
	bl: "translate(56,0) scale(-1,1)",
	tr: "translate(0,56) scale(1,-1)",
	tl: "translate(56,56) scale(-1,-1)",
};

export interface LotusCornerProps extends OrnamentProps {
	corner?: LotusCornerPosition;
}

export function LotusCorner({
	className,
	size = 56,
	style,
	corner = "br",
}: LotusCornerProps) {
	const d = petal(8, 40, 8);

	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 56 56"
			width={size}
			height={size}
			className={className}
			style={style}
		>
			<g transform={FLIP[corner]}>
				{/* Origin moved to the corner, so every rotation below pivots on the
				    corner itself. */}
				<g
					transform="translate(56,56)"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.2"
					strokeLinejoin="round"
				>
					{[-90, -67.5, -45, -22.5, 0].map((deg, i) => (
						<path
							key={deg}
							d={d}
							transform={`rotate(${deg})`}
							// The outermost petals are faintest, so the fan dissolves
							// into the card instead of ending on a hard edge.
							opacity={i === 0 || i === 4 ? 0.45 : 0.85}
						/>
					))}

					{/* Base arcs tying the fan together. */}
					<path d="M-8 0A8 8 0 0 0 0 -8" opacity="0.7" />
					<path d="M-14 0A14 14 0 0 0 0 -14" opacity="0.4" strokeWidth="0.9" />

					{/* Seed at the corner. */}
					<circle cx="0" cy="0" r="2.6" fill="currentColor" stroke="none" />
				</g>
			</g>
		</svg>
	);
}

export default LotusCorner;

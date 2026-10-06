import { useId } from "react";
import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Peacock Feather Divider — the primary section separator.
 *
 * A tapered gold rule interrupted at centre by a peacock feather eye. The
 * peacock feather is Krishna's own emblem, worn in his crown, which makes it
 * the least arbitrary possible choice for the recurring separator of a
 * Janmashtami theme.
 *
 * The rule fades to nothing at both ends rather than stopping with a hard cap.
 * A full-width hairline reads as a table border and chops a scrolling screen
 * into boxes; a fading rule reads as a breath between sections. That is the
 * whole reason this exists instead of `<hr>`.
 *
 * Concentric ellipses carry the eye instead of the real bird's iridescent
 * blue-on-green, because the ornament inherits a single `currentColor` — the
 * depth comes from opacity, so it works in gold on cream and gold on midnight
 * without two variants.
 *
 * Default width 160px (`ornamentSize.dividerMd`). Aspect ratio 10:1.
 */
export function PeacockFeatherDivider({
	className,
	size = 160,
	style,
}: OrnamentProps) {
	const uid = useId();
	const fade = `${uid}-fade`;

	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 240 24"
			width={size}
			height={size / 10}
			className={className}
			style={style}
		>
			<defs>
				{/* userSpaceOnUse so both rule segments share one continuous fade
				    across the full 240 units, rather than each fading within its
				    own bounding box. */}
				<linearGradient
					id={fade}
					gradientUnits="userSpaceOnUse"
					x1="0"
					y1="0"
					x2="240"
					y2="0"
				>
					<stop offset="0" stopColor="currentColor" stopOpacity="0" />
					<stop offset="0.35" stopColor="currentColor" stopOpacity="0.85" />
					<stop offset="0.5" stopColor="currentColor" stopOpacity="1" />
					<stop offset="0.65" stopColor="currentColor" stopOpacity="0.85" />
					<stop offset="1" stopColor="currentColor" stopOpacity="0" />
				</linearGradient>
			</defs>

			{/* Rules, stopping short of the eye on each side. */}
			<path
				d="M4 12H97"
				stroke={`url(#${fade})`}
				strokeWidth="1.25"
				strokeLinecap="round"
				fill="none"
			/>
			<path
				d="M143 12H236"
				stroke={`url(#${fade})`}
				strokeWidth="1.25"
				strokeLinecap="round"
				fill="none"
			/>

			{/* Diamond finials where the rules stop — a full stop before the eye. */}
			<path
				d="M100 12l2.5-2.5L105 12l-2.5 2.5z"
				fill="currentColor"
				opacity="0.75"
			/>
			<path
				d="M135 12l2.5-2.5L140 12l-2.5 2.5z"
				fill="currentColor"
				opacity="0.75"
			/>

			{/* Barb sweep — two crescents suggesting the feather's vanes without
			    drawing every barb, which at this size becomes visual noise. */}
			<path
				d="M106 7Q120 -0.5 134 7"
				stroke="currentColor"
				strokeWidth="0.9"
				strokeLinecap="round"
				fill="none"
				opacity="0.45"
			/>
			<path
				d="M106 17Q120 24.5 134 17"
				stroke="currentColor"
				strokeWidth="0.9"
				strokeLinecap="round"
				fill="none"
				opacity="0.45"
			/>

			{/* The eye: three concentric ellipses, depth by opacity alone. */}
			<ellipse
				cx="120"
				cy="12"
				rx="11"
				ry="7.6"
				fill="currentColor"
				opacity="0.16"
			/>
			<ellipse
				cx="120"
				cy="12"
				rx="11"
				ry="7.6"
				fill="none"
				stroke="currentColor"
				strokeWidth="0.9"
				opacity="0.6"
			/>
			<ellipse
				cx="120"
				cy="12"
				rx="6.4"
				ry="4.4"
				fill="currentColor"
				opacity="0.38"
			/>
			<ellipse cx="120" cy="12" rx="2.7" ry="2.4" fill="currentColor" />
		</svg>
	);
}

export default PeacockFeatherDivider;

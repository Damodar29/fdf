import { useId } from "react";
import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Flute Divider — the secondary, quieter separator.
 *
 * A bansuri laid horizontally between two fading rules. Used where the peacock
 * feather would be too emphatic: between items inside a section, above list
 * group headers, and as the separator in the bottom navigation.
 *
 * The hierarchy between the two dividers is deliberate and is the reason there
 * are two. The feather has vertical mass and a focal point, so it reads as a
 * section break. The flute is almost entirely horizontal and has no focal
 * point, so it reads as a hairline with character — it separates without
 * announcing.
 *
 * Six finger holes and an offset blow-hole, which is what a real bansuri has;
 * an evenly-spaced row of seven dots would read as decoration rather than as an
 * instrument.
 *
 * Default width 96px (`ornamentSize.dividerSm`). Aspect ratio 160:12.
 */
export function FluteDivider({ className, size = 96, style }: OrnamentProps) {
	const uid = useId();
	const fade = `${uid}-fade`;

	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 160 12"
			width={size}
			height={size * 0.075}
			className={className}
			style={style}
		>
			<defs>
				<linearGradient
					id={fade}
					gradientUnits="userSpaceOnUse"
					x1="0"
					y1="0"
					x2="160"
					y2="0"
				>
					<stop offset="0" stopColor="currentColor" stopOpacity="0" />
					<stop offset="1" stopColor="currentColor" stopOpacity="0.9" />
				</linearGradient>
			</defs>

			{/* Left rule fades outward; the right one reuses the same gradient
			    mirrored about the centre, so the pair is exactly symmetric. */}
			<path
				d="M3 6H38"
				stroke={`url(#${fade})`}
				strokeWidth="1"
				strokeLinecap="round"
				fill="none"
			/>
			<g transform="translate(160,0) scale(-1,1)">
				<path
					d="M3 6H38"
					stroke={`url(#${fade})`}
					strokeWidth="1"
					strokeLinecap="round"
					fill="none"
				/>
			</g>

			{/* The tube. */}
			<rect
				x="40"
				y="4.3"
				width="80"
				height="3.4"
				rx="1.7"
				fill="currentColor"
				opacity="0.9"
			/>
			{/* Binding rings at both ends — the cord wrap on a real bansuri. */}
			<rect
				x="43"
				y="3.5"
				width="1.6"
				height="5"
				rx="0.8"
				fill="currentColor"
			/>
			<rect
				x="115.5"
				y="3.5"
				width="1.6"
				height="5"
				rx="0.8"
				fill="currentColor"
			/>

			{/* Blow-hole, offset from the finger holes. */}
			<circle cx="50" cy="6" r="1.15" fill="currentColor" opacity="0.28" />
			{/* Six finger holes. Rendered as low-opacity punches so they read as
			    holes in the tube rather than dots drawn on top of it. */}
			{[64, 72, 80, 92, 100, 108].map((cx) => (
				<circle
					key={cx}
					cx={cx}
					cy="6"
					r="1"
					fill="currentColor"
					opacity="0.28"
				/>
			))}
		</svg>
	);
}

export default FluteDivider;

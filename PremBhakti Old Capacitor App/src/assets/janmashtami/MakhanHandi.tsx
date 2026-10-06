import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Makhan Handi — the butter pot, hung out of reach.
 *
 * The most Janmashtami-specific ornament in the set: the pot of butter Krishna
 * stole as a child, and the pot that gets strung up for the dahi handi on the
 * festival day. Where the peacock feather and flute say "Krishna", this says
 * "Janmashtami" — so `ornamentUsage` allows it at most once per screen, on the
 * festival banner, the events screen, and the donate CTA.
 *
 * ── Why an outline, not a solid ───────────────────────────────────────────
 * Every other ornament here is a line drawing, and a solid pot would sit in the
 * layout like a sticker. Drawn as a fine gold outline it belongs to the same
 * family as the arcade and the dividers — the visual language of an engraved
 * temple invitation, which is the reference the brief asks for. The butter is
 * the one filled shape, so the eye goes to the thing the ornament is about.
 *
 * ── The rope ─────────────────────────────────────────────────────────────
 * Drawn as two strands that diverge from a single point above the pot and meet
 * the rim, plus a cross-hatch net over the belly. That is how a handi is
 * actually slung, and it also gives the ornament a top anchor so it can hang
 * from the edge of a banner instead of floating.
 *
 * Aspect ratio 64:80. Default 56px tall.
 */
export function MakhanHandi({ className, size = 56, style }: OrnamentProps) {
	const width = (size * 64) / 80;

	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 64 80"
			width={width}
			height={size}
			className={className}
			style={style}
		>
			<g
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				{/* Suspension point and the two rope strands. */}
				<path d="M32 2v9" strokeWidth="1.8" />
				<path d="M32 11C23 15 18 22 18 28" opacity="0.75" />
				<path d="M32 11C41 15 46 22 46 28" opacity="0.75" />

				{/* Butter mound cresting above the rim — the only filled shape. */}
				<path
					d="M23 27C25 21 29 18.5 32 18.5S39 21 41 27Z"
					fill="currentColor"
					opacity="0.55"
					strokeWidth="1.2"
				/>

				{/* Rim: a flared lip, wider than the neck. */}
				<path d="M16 28h32" strokeWidth="1.9" />
				<ellipse cx="32" cy="31.5" rx="14.5" ry="3.6" opacity="0.6" />

				{/* Belly. Widest below the midpoint, which is what makes a clay pot
				    read as a pot rather than as a bowl. */}
				<path d="M18 31C11.5 39 11.5 53 20 60.5 26 65.5 38 65.5 44 60.5 52.5 53 52.5 39 46 31" />

				{/* Net over the belly. Four strands, not a full mesh — a dense grid
				    at 56px collapses into a grey block. */}
				<g opacity="0.45" strokeWidth="1.1">
					<path d="M21 33C17 42 18 54 24 62" />
					<path d="M43 33C47 42 46 54 40 62" />
					<path d="M13.5 44Q32 50 50.5 44" />
					<path d="M15.5 53Q32 59 48.5 53" />
				</g>

				{/* Base — a small foot so the pot has somewhere to stand when the
				    ornament is used unhung. */}
				<path d="M26 64.5h12" opacity="0.6" strokeWidth="1.3" />
			</g>
		</svg>
	);
}

export default MakhanHandi;

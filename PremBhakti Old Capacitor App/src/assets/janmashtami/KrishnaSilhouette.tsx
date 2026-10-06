import { type OrnamentProps, ornamentSvgProps } from "./types";

/**
 * Krishna Silhouette — ceremonial watermark.
 *
 * A standing figure crowned with a mukut and peacock feather, playing the
 * bansuri. Permitted only on ceremonial surfaces — splash, onboarding, the
 * donate screen, empty states — and capped at 0.10 opacity.
 *
 * ── Why a silhouette, and why so simplified ───────────────────────────────
 * A detailed figure of a deity rendered small, in a single flat colour, at 10%
 * opacity, cannot succeed: detail turns to mud and the result reads as a smudge
 * or, worse, as a cartoon. What survives at that size is *gesture* — a crowned
 * figure with a raised flute. So the figure is built from large, confident
 * shapes and nothing else. There is no face. Adding eyes and a mouth is the
 * exact change that would tip this from reverent to childish, which the brief
 * rules out.
 *
 * ── The one hard constraint of a flat silhouette ──────────────────────────
 * Everything is one colour, so *internal* detail is invisible: an arm or a sash
 * stroked over the torso in the same fill simply disappears, and the figure
 * collapses to its outer contour. The only lines that read are the ones on the
 * OUTLINE. So the recognisable act — playing the flute — has to be carried by
 * the silhouette's edge: the bansuri projects well past the body on the left,
 * and the near arm bulges an elbow out beyond the torso to meet it. Without
 * that projection the figure reads as a chess pawn wearing a crown.
 *
 * ── Why it ends at the hem ────────────────────────────────────────────────
 * The silhouette stops at a curved dhoti hem rather than continuing to feet.
 * Feet at this scale are four or five pixels of ambiguous shape and read as an
 * error; a hem reads as an intentional vignette. The figure fades out rather
 * than being cut off.
 *
 * Aspect ratio 160:220. Default 280px tall.
 */
export function KrishnaSilhouette({
	className,
	size = 280,
	style,
}: OrnamentProps) {
	const width = (size * 160) / 220;

	return (
		<svg
			{...ornamentSvgProps}
			viewBox="0 0 160 220"
			width={width}
			height={size}
			className={className}
			style={style}
		>
			<g fill="currentColor">
				{/* ── Peacock feather ──────────────────────────────────────────
				    A curved stem out of the crown ending in an eye. The eye is
				    what makes it a peacock feather and not an aerial, so it is
				    drawn at real size even though the stem is thin. */}
				<path
					d="M84 26C95 19 104 14 111 9"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.4"
					strokeLinecap="round"
				/>
				<g transform="rotate(28 112 8)">
					<ellipse cx="112" cy="8" rx="7" ry="5" opacity="0.5" />
					<ellipse cx="112" cy="8" rx="3.1" ry="2.3" />
				</g>

				{/* ── Mukut ───────────────────────────────────────────────────
				    Three peaks, centre tallest. An even number of peaks would put
				    a notch on the axis of symmetry and read as a gap. */}
				<path d="M60 48L64 30L72 41L80 23L88 41L96 30L100 48Z" />
				<circle cx="80" cy="44" r="3" opacity="0.55" />

				{/* ── Head and hair ──────────────────────────────────────────
				    The side locks sit low and tucked, at jaw height rather than
				    beside the crown — a touch higher or wider and they read as
				    ears, which tips the whole figure toward cartoon. */}
				<circle cx="80" cy="61" r="15" />
				<circle cx="67" cy="74" r="5.4" opacity="0.85" />
				<circle cx="93" cy="74" r="5.4" opacity="0.85" />

				{/* ── Torso ──────────────────────────────────────────────────
				    Shoulders down to a pinched waist. Leans a touch right; the
				    hips counter it — that opposition is the tribhanga, and it is
				    the difference between a standing figure and a mannequin. */}
				<path d="M59 92Q80 86 101 92L98 140Q80 147 62 140Z" />

				{/* ── Bansuri ────────────────────────────────────────────────
				    Held to the figure's left and angled down, the way a flute
				    actually sits when played. It extends well past the body — the
				    single most important line for legibility, because it is the
				    only part of "playing a flute" that survives on the outline. */}
				<path
					d="M26 72L98 90"
					fill="none"
					stroke="currentColor"
					strokeWidth="5.4"
					strokeLinecap="round"
				/>

				{/* ── Arms ───────────────────────────────────────────────────
				    Both raised to the flute. The near (left) arm swings its elbow
				    out past the torso so the gap between arm and body opens on the
				    silhouette; the far arm reaches in. Stroked, round-capped, for
				    an even limb thickness at a fraction of an outlined arm's path
				    data. */}
				<g
					fill="none"
					stroke="currentColor"
					strokeWidth="9"
					strokeLinecap="round"
				>
					<path d="M63 98C49 94 40 82 44 74" />
					<path d="M97 98C86 95 78 90 74 84" />
				</g>
				{/* Hands closing over the flute. */}
				<circle cx="44" cy="74" r="5.2" />
				<circle cx="74" cy="84" r="5.2" />

				{/* ── Dhoti ──────────────────────────────────────────────────
				    Flares from the hips and ends in a curved hem, vignetting the
				    figure out rather than truncating it. */}
				<path d="M62 140Q80 148 98 140L116 192Q80 205 44 192Z" />
				{/* A sash end falling from the waist — a little asymmetry so the
				    silhouette isn't perfectly mirrored, which always looks inert.
				    It projects past the hip so it reads on the outline. */}
				<path
					d="M99 138C108 150 110 166 105 182"
					fill="none"
					stroke="currentColor"
					strokeWidth="3.6"
					strokeLinecap="round"
					opacity="0.75"
				/>
			</g>
		</svg>
	);
}

export default KrishnaSilhouette;

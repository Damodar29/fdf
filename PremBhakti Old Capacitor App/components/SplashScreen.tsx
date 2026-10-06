import type React from "react";
import { useSettings } from "../context/SettingsContext";
import {
	FestivalSparkles,
	GoldenMandala,
	MakhanHandi,
	PeacockFeatherDivider,
} from "../src/assets/janmashtami";
import { useDevicePerformance } from "../src/hooks/useDevicePerformance";

/**
 * SplashScreen — "the midnight hour".
 *
 * Janmashtami marks Krishna's birth at midnight, and that is the single most
 * characteristic thing in this app's world. So the splash is not a logo on a
 * background: it is that moment. A dark Mathura-night sky, a light kindling at
 * the centre, a gold mandala blooming open around it like a halo, and the
 * lockup settling inside. The pot of butter sways overhead.
 *
 * ── What changed, and why ──────────────────────────────────────────────────
 * · The photographic background (`/background3.webp`) is GONE, and with it the
 *   two thin gold rectangles insetting the screen and the three bouncing dots.
 *   Those three things together are what made the old screen read as a
 *   template: a stock photo behind a logo, boxed in a border, over a generic
 *   spinner. A photo also fought the gold — it forced a dark scrim on top,
 *   which is why the old screen needed `bg-black/60` to stay legible.
 *   The sky is now painted from the theme's own tokens, so it costs no image
 *   decode on first paint and the gold has somewhere quiet to sit.
 *
 * · THE SIGNATURE is the mandala halo. `GoldenMandala` already exists in the
 *   ornament set as ambient texture capped at 0.08 opacity; here it is promoted
 *   to the subject of the screen and blooms open behind the tilak. That cap
 *   exists to stop pattern competing with body text, and this surface has no
 *   body text — it has one lockup, dead centre, which the halo is framing on
 *   purpose. See `ornamentUsage.goldenMandala`, where the ceremonial exception
 *   is recorded.
 *
 * · The three bouncing dots are replaced by an INVOCATION — "Jai Shri Krishna"
 *   / "जय श्री कृष्ण", breathing gently. The wait is unavoidable, so it may as
 *   well mean something; a bespoke screen should not end in the same spinner
 *   every app ends in.
 *
 * · The lockup is now BILINGUAL, matching the header and nav. The old splash
 *   was English-only even for a Hindi user, and set both lines in Cinzel — an
 *   inscriptional capital face with no Devanagari coverage at all.
 *
 * · TYPEFACE: the Latin lockup is Comfortaa (see `src/theme/typography.ts`).
 *   The two inline `letterSpacing` values below were pulled in from 0.34em and
 *   0.20em when the face changed — Comfortaa carries wide sidebearings already,
 *   where Cinzel's capitals needed the extra air. No `italic` anywhere on this
 *   screen: Comfortaa has no true italic and the synthesised oblique looks
 *   broken on a rounded face.
 *
 * ── Motion ────────────────────────────────────────────────────────────────
 * One orchestrated entrance rather than scattered effects: halo, tilak, title,
 * divider, subtitle, invocation, each on its own beat (see `BEAT`). Everything
 * animates `transform` and `opacity` only, so the whole sequence is a GPU
 * composite. Ambient loops (sparkle field, halo drift, swaying handi) are gated
 * on `isLowEnd`, and the global `prefers-reduced-motion` block in
 * `src/theme/tokens.css` neutralises the rest — every keyframe here resolves to
 * its finished state when motion is reduced, so nothing is left half-drawn.
 */

export interface SplashScreenProps {
	isAnimatingOut?: boolean;
}

/**
 * Entrance beats, in ms.
 *
 * Named rather than inlined because the whole point is that they are a
 * sequence: the halo has to be open before the tilak lights inside it, and the
 * divider has to draw before the subtitle lands under it. `App.tsx` holds the
 * splash until the app is mounted and then fades it over 400ms, so the full
 * sequence is deliberately done by ~1.4s.
 */
const BEAT = {
	halo: 120,
	tilak: 320,
	title: 660,
	divider: 840,
	subtitle: 980,
	invocation: 1140,
} as const;

export const SplashScreen: React.FC<SplashScreenProps> = ({
	isAnimatingOut = false,
}) => {
	const { settingsLanguage } = useSettings();
	const { isLowEnd } = useDevicePerformance();
	const isHindi = settingsLanguage === "hi";

	// Determine if it is Day or Night (6 AM to 6 PM is Day)
	const hour = new Date().getHours();
	const isDay = hour >= 6 && hour < 18;

	return (
		<div
			className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden ${isDay ? "bg-cream-50" : "bg-jm-night"}`}
		>
			{/*
			 * Splash-scoped keyframes.
			 *
			 * Three motions the shared design system has no token for, because
			 * each is specific to this screen: the tilak drawing itself as if a
			 * lamp were being lit, and the halo's near-imperceptible drift.
			 * Everything else on this screen uses the `jm-*` animations from
			 * `src/theme/animations.ts`.
			 */}
			<style>{`
				@keyframes splash-draw { to { stroke-dashoffset: 0; } }
				@keyframes splash-ink  { to { fill-opacity: 1; } }
				@keyframes splash-drift { to { transform: rotate(360deg); } }

				.splash-stroke {
					stroke-dasharray: 620;
					stroke-dashoffset: 620;
					animation: splash-draw 1400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
				}
				.splash-fill {
					fill-opacity: 0;
					animation: splash-ink 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
				}
				.splash-drift {
					animation: splash-drift 120s linear infinite;
					transform-origin: center;
				}
			`}</style>

			{/*
			 * The kindled light. A warm radial bloom sitting a little above
			 * centre, where the halo is — this is what makes the sky read as
			 * "lit from within" instead of as a flat dark panel, and it is doing
			 * the job the old screen's dark scrim was doing, in reverse.
			 */}
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background: isDay
						? "radial-gradient(58% 42% at 50% 38%, rgba(255, 213, 79, 0.25) 0%, rgba(255, 213, 79, 0.08) 40%, transparent 72%)"
						: "radial-gradient(58% 42% at 50% 38%, rgba(255, 213, 79, 0.17) 0%, rgba(255, 213, 79, 0.06) 40%, transparent 72%)",
				}}
			/>

			{/*
			 * Ambient sparkle field. Sized to a square that overflows the
			 * viewport on its short axis so it covers the screen without the
			 * sparkles being stretched into ellipses — the ornament's viewBox is
			 * square and it has no `preserveAspectRatio` escape hatch.
			 *
			 * The field is built with an EMPTY CENTRE by design, which is
			 * precisely where the halo and lockup sit; so this and the mandala
			 * occupy different zones and do not double up on one region.
			 */}
			{!isLowEnd && !isDay && (
				<div className="jm-ambient pointer-events-none absolute left-1/2 top-1/2 h-[max(100vw,100vh)] w-[max(100vw,100vh)] -translate-x-1/2 -translate-y-1/2 text-gold-200/45">
					<FestivalSparkles className="h-full w-full" />
				</div>
			)}

			{/*
			 * The dahi handi, hung from the top edge and swaying. The one
			 * ornament in the set that says *Janmashtami* specifically rather
			 * than *Krishna* generally, so it appears exactly once.
			 * Transform-origin is the suspension point, so it swings from the
			 * rope rather than pivoting about its own middle.
			 */}
			<div
				className={`pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 ${isDay ? "text-ink-800/80 drop-shadow-sm" : "text-white/90 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]"}`}
				style={{ transformOrigin: "top center" }}
			>
				<div
					className={isLowEnd ? "" : "animate-jm-feather-float"}
					style={{ transformOrigin: "top center", animationDuration: "13s" }}
				>
					<MakhanHandi size={62} />
				</div>
			</div>

			{/* ── The lockup ─────────────────────────────────────────────────── */}
			<div
				className="relative z-10 flex w-full flex-col items-center px-8"
				style={{
					transition: "transform 380ms cubic-bezier(0.16, 1, 0.3, 1)",
					transform: isAnimatingOut ? "scale(1.06)" : "scale(1)",
				}}
			>
				{/* Halo + tilak. The halo is the frame; the tilak is what it frames. */}
				<div className="relative flex h-[min(76vw,320px)] w-[min(76vw,320px)] items-center justify-center">
					<div
						className={`pointer-events-none absolute inset-0 flex animate-jm-scale-in items-center justify-center ${isDay ? "text-gold-600/30" : "text-gold-300/30"}`}
						style={{ animationDelay: `${BEAT.halo}ms` }}
					>
						<GoldenMandala
							size={320}
							className={`h-full w-full ${isLowEnd ? "" : "splash-drift"}`}
						/>
					</div>

					{/*
					 * The tilak, drawing itself in gold. Filled from a gradient
					 * rather than a flat hex so it has the same top-lit falloff as
					 * `.jm-gold-text` on the wordmark below — a flat `#d4af37`,
					 * which is what this used to be, reads as a sticker next to
					 * gradient type.
					 */}
					<svg
						viewBox="0 0 100 220"
						className="relative z-10 h-[min(30vw,128px)] w-auto"
						aria-hidden="true"
						focusable="false"
					>
						<defs>
							<linearGradient id="splashGold" x1="0" y1="0" x2="0" y2="1">
								{isDay ? (
									<>
										<stop offset="0%" stopColor="#C49B2A" />
										<stop offset="45%" stopColor="#A47A11" />
										<stop offset="100%" stopColor="#7B5604" />
									</>
								) : (
									<>
										<stop offset="0%" stopColor="#FFE9A8" />
										<stop offset="45%" stopColor="#FFD54F" />
										<stop offset="100%" stopColor="#B08313" />
									</>
								)}
							</linearGradient>
						</defs>
						<path
							d="M30 10v85q0 40 20 40t20-40V10"
							fill="transparent"
							stroke="url(#splashGold)"
							strokeWidth="6"
							strokeLinecap="round"
							className="splash-stroke"
							style={{ animationDelay: `${BEAT.tilak}ms` }}
						/>
						<path
							d="M50 135 C28 135, 20 165, 50 200 C80 165, 72 135, 50 135 Z"
							fill="url(#splashGold)"
							stroke="url(#splashGold)"
							strokeWidth="4"
							strokeLinecap="round"
							className="splash-stroke splash-fill"
							style={{
								animationDelay: `${BEAT.tilak + 200}ms, ${BEAT.tilak + 900}ms`,
							}}
						/>
					</svg>
				</div>

				{/* Wordmark. Gold gradient type, straight on the sky — no box. */}
				<h1
					className={`animate-jm-enter text-center leading-none ${
						isHindi
							? "font-hindi-display text-jm-display"
							: `font-display text-jm-display font-semibold ${isDay ? "text-gold-700" : "jm-gold-text"}`
					}`}
					style={{
						animationDelay: `${BEAT.title}ms`,
						...(isHindi ? { color: isDay ? "#A47A11" : "#FFD54F" } : null),
					}}
				>
					{isHindi ? "श्री चैतन्य" : "Shree Chaitanya"}
				</h1>

				{/*
				 * Peacock feather divider. The feather is Krishna's own emblem and
				 * the theme's primary separator, so it is what belongs between the
				 * two halves of the name. It draws outward from the centre.
				 */}
				<div
					className={`mt-3 animate-jm-draw ${isDay ? "text-gold-600/80" : "text-gold-300/70"}`}
					style={{ animationDelay: `${BEAT.divider}ms` }}
				>
					<PeacockFeatherDivider size={210} />
				</div>

				<h2
					className={`mt-2 animate-jm-enter text-center ${isDay ? "text-ink-700" : "text-cream-50/80"} ${
						isHindi
							? "font-hindi text-jm-body"
							: "font-body text-jm-overline font-semibold uppercase"
					}`}
					style={{
						animationDelay: `${BEAT.subtitle}ms`,
						...(isHindi ? null : { letterSpacing: "0.24em" }),
					}}
				>
					{isHindi ? "प्रेम भक्ति संघ" : "Prem Bhakti Sangh"}
				</h2>

				{/*
				 * The invocation, standing in for a loading spinner. It breathes
				 * on the shared gold-glow loop, so the screen has a pulse while
				 * the app finishes mounting.
				 */}
				<div
					className="mt-12 animate-jm-fade"
					style={{ animationDelay: `${BEAT.invocation}ms` }}
				>
					<span
						className={`animate-jm-glow-pulse ${isDay ? "text-gold-700" : "text-gold-200/85"} ${
							isHindi
								? "font-hindi text-jm-body-sm"
								: "font-decorative text-jm-body"
						}`}
						style={isHindi ? undefined : { letterSpacing: "0.14em" }}
					>
						{isHindi ? "राधे श्याम" : "Radhe Shyam"}
					</span>
				</div>
			</div>
		</div>
	);
};

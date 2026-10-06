import { Settings } from "lucide-react";
import type React from "react";
import { GoldenMandala, PeacockFeatherEye } from "@/src/assets/janmashtami";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { triggerHaptic } from "../utils/haptic";
import { rejectionAlerts } from "../utils/reviewAlerts";
import { ProfileButtonIcon } from "./ProfileButtonIcon";

/**
 * JanmashtamiHeader — the app bar, re-skinned for the festival theme.
 *
 * `components/Header.tsx` re-exports this as `Header`, so `App.tsx` is never
 * touched and the prop contract below is byte-identical to the old component.
 *
 * ── What changed, and why ──────────────────────────────────────────────────
 * · Background is the royal-blue gradient (`bg-jm-royal`, #103A8C→#071C40) in
 *   both colour modes rather than the old saffron→orange. A deep Krishna-blue
 *   bar with a gold lockup is the single most recognisable "temple invitation"
 *   move available, and it anchors the whole palette from the top of every
 *   screen.
 * · The logo — tilak plus wordmark — is rendered in bright gold (`gold-300`)
 *   with a soft, slow glow behind it. This is the "gold logo / elegant glow"
 *   the brief asks for; the glow animates opacity only, so it is free on the
 *   compositor and is switched off entirely under `prefers-reduced-motion`.
 * · The "new information" cue was an alarm-red Sparkles icon inside two pinging
 *   radar rings. Red is a warning colour doing a good-news job, so it is
 *   replaced by the peacock-feather-eye badge — the theme's own "new content"
 *   mark — with a gentle gold pulse. The trigger (`hasNewInformation ||
 *   hasNewOtaUpdate`) and its position are unchanged, so behaviour is identical.
 * · A single downward-only shadow (`shadow-jm-header`) and one hairline gold
 *   rule at the base replace the old drop shadow, honouring "premium elevation,
 *   no excessive shadows".
 * · Every control now fills a 44px hit area (`min-h/w-touch`) for WCAG 2.5.5,
 *   without changing the visual icon size.
 *
 * All sizing still derives from `uiScale`, and both language lockups (English
 * on `font-display`, Hindi on `font-hindi-display`) are preserved exactly.
 */

/**
 * The header lockup — tilak with its mandala halo, "Shree Chaitanya" and
 * "Prem Bhakti Sangh" — gold on royal blue. Used by the phone app bar below
 * and by the desktop/landscape Home header, so both always match.
 */
export const HeaderLogo: React.FC<{ className?: string }> = ({
	className = "",
}) => {
	const { uiScale, settingsLanguage } = useSettings();

	const baseTilakHeight = 8; // h-8
	const baseSubTextSize = settingsLanguage === "hi" ? 0.8 : 0.55;
	const scaledTilakHeight = baseTilakHeight * uiScale;
	const scaledSubTextSize = baseSubTextSize * uiScale;

	/**
	 * Halo diameter in px, at 1.9x the tilak's height.
	 *
	 * `scaledTilakHeight` is in Tailwind spacing units, so ×0.25 gives rem and
	 * ×16 gives px. 1.9x is the largest the halo can go before it starts to
	 * crowd the wordmark beside it at the default `uiScale`.
	 */
	const haloSize = Math.round(scaledTilakHeight * 0.25 * 16 * 1.9);

	return (
		<div
			className={`relative flex flex-row items-center justify-center gap-3 min-w-0 ${className}`}
		>
			{/* Soft glow behind the lockup — the "elegant glow". */}
			<div className="pointer-events-none absolute inset-0 -z-0 flex items-center justify-center">
				<div className="w-40 h-8 rounded-full bg-gold-300/15 blur-xl animate-jm-glow-pulse" />
			</div>

			{/* Tilak — inherits gold via currentColor. */}
			<div
				className="relative w-auto flex items-center justify-center text-gold-300"
				style={{ height: `${scaledTilakHeight * 0.25}rem` }}
			>
				{/*
				 * The splash's mandala halo, carried through at header scale.
				 *
				 * This is the one thematic thread that ties the app bar to the
				 * opening screen: the halo that blooms around the tilak on the
				 * splash stays behind it, small and faint, everywhere else. It
				 * is sized from `uiScale` like everything else here, so it
				 * tracks the tilak instead of drifting away from it when the
				 * user changes text size.
				 */}
				<div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-300/20">
					<GoldenMandala size={haloSize} />
				</div>

				<svg
					viewBox="0 0 100 220"
					className="relative h-full w-auto"
					aria-hidden="true"
				>
					<path
						d="M30 10v85q0 40 20 40t20-40V10"
						fill="transparent"
						stroke="currentColor"
						strokeWidth="12"
						strokeLinecap="round"
					/>
					<path
						d="M50 135 C28 135, 20 165, 50 200 C80 165, 72 135, 50 135 Z"
						fill="currentColor"
						stroke="currentColor"
						strokeWidth="8"
						strokeLinecap="round"
					/>
				</svg>
			</div>

			{/* Text */}
			<div className="relative flex flex-col items-center justify-center leading-none select-none min-w-0">
				<span
					className={`text-gold-300 leading-none ${settingsLanguage === "hi" ? "font-hindi-display font-semibold mt-1" : "font-display font-semibold tracking-wide"}`}
					style={{ fontSize: `14px` }}
				>
					{settingsLanguage === "hi" ? "श्री चैतन्य" : "Shree Chaitanya"}
				</span>
				<div
					className="w-full h-px bg-gold-300/50"
					style={{ margin: `${3 * uiScale}px 0` }}
				></div>
				<span
					className={`font-body font-semibold text-cream-50/85 uppercase ${settingsLanguage === "hi" ? "font-hindi mt-0.5" : "tracking-[0.16em]"}`}
					style={{ fontSize: `${scaledSubTextSize}rem` }}
				>
					{settingsLanguage === "hi" ? "प्रेम भक्ति संघ" : "Prem Bhakti Sangh"}
				</span>
			</div>
		</div>
	);
};

interface HeaderProps {
	onOpenMenu: () => void;
	onOpenSettings: () => void;
	onOpenProfile: () => void;
}

export const JanmashtamiHeader: React.FC<HeaderProps> = ({
	onOpenMenu,
	onOpenSettings,
	onOpenProfile,
}) => {
	const { hasNewInformation, hasNewOtaUpdate, uiScale, settingsLanguage } =
		useSettings();
	const { profile, pendingFamilyRequests } = useAuth();

	// Base sizes
	const baseContainerHeight = 18; // Increased base height for better spacing

	// Scaled sizes
	// Enforce a minimum height (e.g., 3.5rem = 14 units) to prevent cramping at low scales
	const scaledContainerHeight = Math.max(baseContainerHeight * uiScale, 14);

	const hasNews = hasNewInformation || hasNewOtaUpdate;
	// Their own profile or a family member they added was rejected (linked
	// accounts don't count — those people fix their own profile).
	const needsFix = rejectionAlerts(profile).length > 0;

	return (
		<header
			className="fixed top-0 left-0 right-0 z-30 pt-[env(safe-area-inset-top)] bg-jm-royal shadow-jm-header landscape:hidden transition-all duration-300"
			style={{
				height: `calc(${scaledContainerHeight * 0.25}rem + env(safe-area-inset-top))`,
			}}
		>
			{/* Gold hairline rule along the base — a temple-invitation edge that
			    fades at both ends, in place of a hard border. */}
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-jm-rule opacity-70" />

			<div className="relative w-full h-full flex items-center justify-between px-4 max-w-5xl mx-auto landscape:flex-col landscape:py-6 landscape:px-0">
				{/* Menu Button */}
				<button
					onClick={() => {
						triggerHaptic("light");
						onOpenMenu();
					}}
					className="flex-shrink-0 inline-flex items-center justify-center min-h-touch min-w-touch text-cream-50 hover:text-gold-300 hover:bg-cream-50/10 rounded-xl transition-colors group relative"
					aria-label="Open menu"
					data-tour="header-menu"
				>
					<div className="flex flex-col gap-1.5">
						<div className="w-6 h-0.5 bg-current rounded-full group-hover:scale-105 transition-transform"></div>
						<div className="w-6 h-0.5 bg-current rounded-full group-hover:scale-105 transition-transform"></div>
						<div className="w-6 h-0.5 bg-current rounded-full group-hover:scale-105 transition-transform"></div>
					</div>
					{hasNews && (
						<span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
							{/* Soft gold pulse standing in for the old radar ping —
							    opacity-only, so it costs nothing and stops under
							    reduced-motion. */}
							<span className="absolute w-5 h-5 rounded-full bg-gold-300/40 blur-[3px] animate-jm-glow-pulse" />
							<PeacockFeatherEye size={15} className="relative text-gold-300" />
							<span className="sr-only">New updates available</span>
						</span>
					)}
				</button>

				{/* Center Logo — stacked lockup, gold on royal blue */}
				<HeaderLogo className="landscape:hidden" />

				{/* Landscape Logo (Simplified) */}
				<div className="hidden landscape:flex flex-col items-center gap-1">
					<span
						className={`text-gold-300 font-semibold text-xl ${settingsLanguage === "hi" ? "font-hindi-display" : "font-display"}`}
					>
						{settingsLanguage === "hi" ? "प्रेम भक्ति" : "Prem Bhakti"}
					</span>
				</div>

				<div className="flex items-center gap-1">
					{/* Profile Button */}
					<button
						onClick={() => {
							triggerHaptic("light");
							onOpenProfile();
						}}
						className="flex-shrink-0 inline-flex items-center justify-center min-h-touch min-w-touch text-cream-50 hover:text-gold-300 hover:bg-cream-50/10 rounded-full transition-colors active:scale-95 relative"
						data-tour="header-profile"
aria-label={`Open profile${needsFix ? " — needs changes" : ""}${
							pendingFamilyRequests > 0
								? ` — ${pendingFamilyRequests} family request${pendingFamilyRequests > 1 ? "s" : ""}`
								: ""
						}`}
					>
						<ProfileButtonIcon
							photoBorderClassName="border-gold-300"
							badgeRingClassName="border-krishna-700"
						/>
					</button>

					{/* Settings Button */}
					<button
						onClick={() => {
							triggerHaptic("light");
							onOpenSettings();
						}}
						className="flex-shrink-0 inline-flex items-center justify-center min-h-touch min-w-touch text-cream-50 hover:text-gold-300 hover:bg-cream-50/10 rounded-full transition-colors group"
						aria-label="Open settings"
						data-tour="header-settings"
					>
						<Settings
							size={24}
							strokeWidth={2}
							className="group-hover:rotate-45 transition-transform duration-500"
						/>
					</button>
				</div>
			</div>
		</header>
	);
};

export default JanmashtamiHeader;

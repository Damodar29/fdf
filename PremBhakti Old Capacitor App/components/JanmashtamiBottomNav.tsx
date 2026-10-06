import { BookOpen, Headphones, Home, Music, ScrollText } from "lucide-react";
import React from "react";
import type { AppTab } from "../types";
import { triggerHaptic } from "../utils/haptic";

/**
 * JanmashtamiBottomNav — the bottom navigation, re-skinned for the theme.
 *
 * `components/BottomNav.tsx` re-exports this as `BottomNav`, so `App.tsx` is
 * untouched and the prop contract is byte-identical to the old component.
 * Tab order, labels, haptics, the swipe-passthrough touch handlers, and the
 * landscape rail are all preserved.
 *
 * ── What changed, and why ──────────────────────────────────────────────────
 * · The bar is Krishna-blue (`bg-jm-royal`) with a gold edge and an upward-only
 *   shadow (`shadow-jm-nav`), replacing the old sand/maroon bar and its
 *   fractal-noise overlay (which turned muddy on blue).
 * · The active tab sits in a pointed TEMPLE ALCOVE — one of exactly three
 *   places the arch is allowed to appear (see `src/theme/decorations.ts`),
 *   which is what makes it read as the theme's signature rather than as
 *   wallpaper. It is the same alcove that sits behind the icon inside every
 *   home tile, so the two surfaces share one vocabulary. It rises into place
 *   with an opacity/transform-only animation.
 * · The HOME tab is special by standing instruction: it carries a persistent
 *   gold medallion so it reads as the anchor of the bar even when another tab
 *   is active, and gets the alcove and glow when selected.
 * · Active state is gold (`gold-300`); rest state is a calm cream. The gold
 *   glow is reserved for the active tab alone, per the shadow rules.
 *
 * ── Two things deliberately NOT here ───────────────────────────────────────
 * · There is no flute across the top edge. A flute is a single centred
 *   graphic, and the Home tab is permanently centred too, so the flute ran
 *   straight through the alcove above Home — two ornaments in one region,
 *   which rule 1 of the decoration discipline forbids. The centre belongs to
 *   the alcove; the gold hairline alone carries the top edge.
 * · The active tab is not lifted upward. `nav` needs `overflow-hidden` for its
 *   rounded corners, and lifting the active tab put the alcove's apex past the
 *   top edge where it was clipped flat. The alcove is sized never to exceed
 *   the icon medallion for the same reason.
 */

interface BottomNavProps {
	activeTab: AppTab;
	onTabChange: (tab: AppTab) => void;
	devMode: boolean;
	settingsLanguage: "en" | "hi";
	onTouchStart?: (e: React.TouchEvent) => void;
	onTouchMove?: (e: React.TouchEvent) => void;
	onTouchEnd?: (e: React.TouchEvent) => void;
}

export const JanmashtamiBottomNav: React.FC<BottomNavProps> = ({
	activeTab,
	onTabChange,
	// devMode is part of the historical contract; retained though unused.
	devMode: _devMode,
	settingsLanguage,
	onTouchStart,
	onTouchMove,
	onTouchEnd,
}) => {
	const t = {
		en: {
			home: "Home",
			bhajans: "Bhajans",
			books: "Books",
			lectures: "Audio",
			library: "History",
		},
		hi: {
			home: "होम",
			bhajans: "भजन",
			books: "ग्रंथ",
			lectures: "ऑडियो",
			library: "इतिहास",
		},
	}[settingsLanguage];

	const handleTabClick = (tab: AppTab) => {
		if (activeTab !== tab) {
			// Fire-and-forget: awaiting the native Haptics bridge round-trip
			// delayed every tab switch on slower phones.
			void triggerHaptic("light");
			onTabChange(tab);
		}
	};

	return (
		<div
			onTouchStart={onTouchStart}
			onTouchMove={onTouchMove}
			onTouchEnd={onTouchEnd}
			className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] landscape:top-0 landscape:bottom-0 landscape:right-0 landscape:left-auto landscape:w-20 landscape:h-full landscape:pb-0 landscape:pt-0 landscape:pr-[env(safe-area-inset-right)]"
		>
			<nav className="relative bg-jm-royal shadow-jm-nav border border-gold-300/25 pointer-events-auto max-w-lg mx-auto rounded-3xl landscape:h-full landscape:w-full landscape:flex-col landscape:justify-center landscape:rounded-none landscape:border-l landscape:border-y-0 landscape:border-r-0 landscape:max-w-none overflow-hidden">
				{/* Gold hairline along the top inner edge. */}
				<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-jm-rule opacity-50 landscape:hidden" />

				<div className="relative flex items-center justify-around h-16 landscape:h-full landscape:flex-col landscape:gap-4 landscape:py-4">
					<NavButton
						icon={<BookOpen />}
						label={t.books}
						tourId="nav-books"
						active={activeTab === "books"}
						onClick={() => handleTabClick("books")}
					/>
					<NavButton
						icon={<Headphones />}
						label={t.lectures}
						tourId="nav-audio"
						active={activeTab === "lectures"}
						onClick={() => handleTabClick("lectures")}
					/>
					<NavButton
						icon={<Home />}
						label={t.home}
						tourId="nav-home"
						active={activeTab === "home"}
						isHome
						onClick={() => handleTabClick("home")}
					/>
					<NavButton
						icon={<Music />}
						label={t.bhajans}
						tourId="nav-bhajans"
						active={activeTab === "songs"}
						onClick={() => handleTabClick("songs")}
					/>
					<NavButton
						icon={<ScrollText />}
						label={t.library}
						tourId="nav-library"
						active={activeTab === "library"}
						onClick={() => handleTabClick("library")}
					/>
				</div>
			</nav>
		</div>
	);
};

/**
 * The alcove behind the active tab's icon.
 *
 * This is the same geometry as `TileNiche` in `components/HomeScreen.tsx`, so
 * an active tab and a home tile read as the same idea — an icon standing in a
 * lit temple recess — rather than as two unrelated gold decorations.
 *
 * Two hard constraints shape the sizing, both learned from getting it wrong:
 *
 * 1. It must never be taller than the 36px icon medallion it sits behind. The
 *    bar is only 64px and `nav` carries `overflow-hidden` for its rounded
 *    corners, so anything that reaches past the medallion's top edge gets
 *    sliced flat.
 * 2. Its opening must be wider than the 24px icon. `preserveAspectRatio` is
 *    left at the default so the path scales to the box exactly; the opening
 *    spans 72% of the width, so 42px gives ~30px of clear space and the icon
 *    sits inside the recess instead of being straddled by its legs.
 */
function TempleNiche({ home }: { home?: boolean }) {
	return (
		<svg
			viewBox="0 0 100 92"
			width={home ? 48 : 42}
			height={home ? 36 : 34}
			className="animate-jm-arch-rise"
			fill="none"
			aria-hidden="true"
			focusable="false"
		>
			{/* Outer recess — filled, so it reads as depth rather than as a cage. */}
			<path
				d="M14 92 V40 C14 22 36 22 50 6 C64 22 86 22 86 40 V92 Z"
				fill="currentColor"
				fillOpacity="0.14"
				stroke="currentColor"
				strokeOpacity="0.55"
				strokeWidth="1.6"
				strokeLinejoin="round"
			/>
			{/* Inner echo, fainter — the double line of a real temple arch. */}
			<path
				d="M22 92 V41 C22 28 40 28 50 14 C60 28 78 28 78 41 V92"
				stroke="currentColor"
				strokeOpacity="0.28"
				strokeWidth="1"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

const NavButton: React.FC<{
	icon?: React.ReactElement;
	iconUrl?: string;
	label: string;
	active: boolean;
	isHome?: boolean;
	onClick: () => void;
	/** `data-tour` hook for the guided tour; no visual effect. */
	tourId?: string;
}> = ({ icon, iconUrl, label, active, isHome, onClick, tourId }) => (
	<button
		type="button"
		onClick={onClick}
		data-tour={tourId}
		aria-label={label}
		aria-current={active ? "page" : undefined}
		className={`flex-1 flex flex-col items-center justify-center w-full h-full min-h-touch transition-colors duration-300 group ${active ? "text-gold-300" : "text-cream-50/55 hover:text-cream-50/80"}`}
	>
		<div
			className={`relative flex items-center justify-center transition-transform duration-300 ${active ? "" : "group-hover:-translate-y-0.5"}`}
		>
			{/* Temple alcove behind the active tab's icon. Centred on the icon
			    medallion, never larger than it — see `TempleNiche`. */}
			{active && (
				<span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-300/80">
					<TempleNiche home={isHome} />
				</span>
			)}

			{/* Icon medallion. Home keeps a faint gold ring when it is not the
			    active tab, so it still reads as the anchor of the bar. When it IS
			    active the alcove behind supplies the shape, so the fill and ring
			    come off — two stacked shapes in one 36px box just looked busy —
			    and only the soft glow remains. */}
			<div
				className={`relative p-1.5 rounded-2xl transition-all duration-300 ${
					active
						? "shadow-jm-glow"
						: isHome
							? "bg-gold-300/10 ring-1 ring-gold-300/25"
							: ""
				}`}
			>
				{iconUrl ? (
					<img
						src={iconUrl}
						alt={label}
						className={`w-6 h-6 transition-all duration-300 ${active ? "scale-110" : "opacity-70"}`}
					/>
				) : (
					React.cloneElement(icon!, {
						size: 24,
						strokeWidth: active ? 2.4 : 1.8,
					} as any)
				)}
			</div>
		</div>
		<span
			className={`text-[10px] mt-0.5 tracking-tight transition-all duration-300 ${active ? "opacity-100 font-body font-semibold text-gold-300" : "opacity-0 scale-0 h-0 overflow-hidden"}`}
		>
			{label}
		</span>
		{/*
		 * Threshold under the active label.
		 *
		 * The same gold step that sits under the icon inside every home tile,
		 * repeated here. Repeating one small device in two places is what makes
		 * it read as the app's vocabulary rather than as a one-off flourish —
		 * and it gives the active tab a base, so the arch above it has something
		 * to stand on. Draws outward from the centre.
		 */}
		{active && <div className="jm-rule mt-1 w-5 animate-jm-draw opacity-75" />}
	</button>
);

export default JanmashtamiBottomNav;

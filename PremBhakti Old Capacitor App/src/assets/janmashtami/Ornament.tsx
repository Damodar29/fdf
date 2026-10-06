import { type ComponentType, lazy, Suspense } from "react";
import { FluteDivider } from "./FluteDivider";
import { LotusCorner } from "./LotusCorner";
import { MakhanHandi } from "./MakhanHandi";
import { PeacockFeatherDivider } from "./PeacockFeatherDivider";
import { PeacockFeatherEye } from "./PeacockFeatherEye";
import { TempleBorder } from "./TempleBorder";
import type { OrnamentProps } from "./types";

/**
 * Ornament — the dispatcher, and the lazy-loading boundary.
 *
 * Most call sites should import the ornament they want directly; it is clearer
 * at the point of use and lets the bundler see exactly what is reachable. This
 * component exists for the cases where the ornament is chosen at runtime — a
 * section header whose motif comes from config, a card that varies its corner
 * by category.
 *
 * ── Why three of the eight are lazy ───────────────────────────────────────
 * Phase 11 asks for decorative assets to be lazy-loaded. Weighing each ornament
 * by the DOM it produces rather than by source size:
 *
 *   eager   feather divider, flute divider, temple border, lotus corner,
 *           makhan handi, feather eye        — 4 to 30 elements each
 *   lazy    golden mandala (~40 paths, generated at render),
 *           krishna silhouette (largest path data in the set),
 *           festival sparkles (15 animated nodes)
 *
 * The eager six are on the critical path: a divider or a card corner is needed
 * during the first paint of the home screen, so deferring them would cost a
 * visible pop-in for no benefit. The lazy three appear only on ceremonial
 * surfaces — splash, hero panels, festival banners — which are either
 * below the fold or shown after an interaction. Splitting them keeps them out
 * of the initial chunk entirely.
 *
 * `fallback={null}` is correct here in a way it usually isn't: these are
 * decorations with `aria-hidden`, so an empty frame or two costs nothing and
 * there is no meaning to lose. A spinner in place of a background watermark
 * would be worse than the watermark arriving late.
 */

const GoldenMandala = lazy(() =>
	import("./GoldenMandala").then((m) => ({ default: m.GoldenMandala })),
);
const KrishnaSilhouette = lazy(() =>
	import("./KrishnaSilhouette").then((m) => ({ default: m.KrishnaSilhouette })),
);
const FestivalSparkles = lazy(() =>
	import("./FestivalSparkles").then((m) => ({ default: m.FestivalSparkles })),
);

/**
 * Keyed by `OrnamentName` from `src/theme/decorations.ts`. Kept in this file
 * rather than in the theme so the theme layer stays free of React imports —
 * `tailwind.config.js` imports from `src/theme` at build time and must not pull
 * in a component tree.
 */
const EAGER: Record<string, ComponentType<OrnamentProps>> = {
	peacockFeatherDivider: PeacockFeatherDivider,
	fluteDivider: FluteDivider,
	templeBorder: TempleBorder,
	lotusCorner: LotusCorner,
	makhanHandi: MakhanHandi,
	peacockFeatherEye: PeacockFeatherEye,
};

const LAZY: Record<string, ComponentType<OrnamentProps>> = {
	goldenMandala: GoldenMandala,
	krishnaSilhouette: KrishnaSilhouette,
	festivalSparkles: FestivalSparkles,
};

export interface OrnamentDispatchProps extends OrnamentProps {
	name: string;
}

export function Ornament({ name, ...props }: OrnamentDispatchProps) {
	const Eager = EAGER[name];
	if (Eager) return <Eager {...props} />;

	const Lazy = LAZY[name];
	if (!Lazy) {
		// Unknown ornament: render nothing rather than throwing. A typo in a
		// decorative name should never be able to take a screen down.
		if (import.meta.env?.DEV) {
			console.warn(`[Ornament] unknown ornament "${name}"`);
		}
		return null;
	}

	return (
		<Suspense fallback={null}>
			<Lazy {...props} />
		</Suspense>
	);
}

export default Ornament;

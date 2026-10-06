/**
 * Janmashtami ornaments
 * =====================
 *
 *   import { PeacockFeatherDivider, LotusCorner } from "@/src/assets/janmashtami";
 *
 * Eight ornaments plus the feather-eye badge, all inline SVG React components.
 * See `types.ts` for why they are components rather than files, and
 * `src/theme/decorations.ts` for where each one is allowed to appear and at what
 * opacity — that file is the rulebook, this one is just the parts bin.
 *
 * Placement classes (`ornamentClass.cornerBR`, `.background`, `.divider`,
 * `.crown`, `.watermark`) and default sizes (`ornamentSize`) both live in the
 * theme, so a call site is usually:
 *
 *   <LotusCorner className={ornamentClass.cornerBR} size={ornamentSize.corner} />
 *
 * `GoldenMandala`, `KrishnaSilhouette` and `FestivalSparkles` are exported
 * directly here for static imports, and are additionally code-split behind
 * `<Ornament name="…" />` for runtime-chosen ornaments.
 */

export { FestivalSparkles } from "./FestivalSparkles";
export { FluteDivider } from "./FluteDivider";
export { GoldenMandala } from "./GoldenMandala";
export { KrishnaSilhouette } from "./KrishnaSilhouette";
export {
	LotusCorner,
	type LotusCornerPosition,
	type LotusCornerProps,
} from "./LotusCorner";
export { MakhanHandi } from "./MakhanHandi";
export { Ornament, type OrnamentDispatchProps } from "./Ornament";
export { PeacockFeatherDivider } from "./PeacockFeatherDivider";
export { PeacockFeatherEye } from "./PeacockFeatherEye";
export { TempleBorder } from "./TempleBorder";
export { type OrnamentProps, ornamentSvgProps } from "./types";

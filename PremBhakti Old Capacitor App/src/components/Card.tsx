import {
	forwardRef,
	type HTMLAttributes,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
} from "react";
import { LotusCorner } from "@/src/assets/janmashtami";
import { card as cardRecipe, ornamentClass, ornamentSize } from "@/src/theme";
import { cn } from "@/utils/shadcn";

/**
 * Card — the temple-invitation surface.
 *
 * The audit found 502 hand-rolled card constructions across 72 files, no two
 * quite alike. This component (over the `card` recipes in `src/theme/theme.ts`)
 * is the single definition of what a card is: a cream surface, a gold edge, a
 * soft inner highlight, generous radius. Screens compose it instead of
 * re-deriving it.
 *
 * ── Variants ────────────────────────────────────────────────────────────────
 *   base         content cards, list rows, settings groups (default)
 *   interactive  adds hover-lift, press-scale and a focus ring
 *   featured     stronger gold edge, more elevation — hero panels
 *   royal        inverted Krishna-blue surface — CTAs, festival panels
 *   flat         border only, no shadow — dense/nested content
 *   modal        sheet / dialog surface
 *   well         inset well — quiet regions inside a card
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 * A card is a `<div>`, but the app's tile grids attach `onClick` directly to
 * the surface. When an `onClick` is present this component silently promotes
 * the card to an operable control: `role="button"`, `tabIndex={0}`, and
 * Enter/Space activation. That closes the keyboard gap the audit flagged
 * without asking every call site to remember it. Pass the `interactive`
 * variant alongside `onClick` to get the matching focus ring and press states.
 *
 * ── Corner motif ─────────────────────────────────────────────────────────────
 * `corner` opts a card into the lotus-corner flourish (bottom-right only, per
 * the ornament rulebook). It is deliberately opt-in: a lotus on every list row
 * is exactly the "overloaded" look the brief rules out, so it belongs on
 * content cards and panels, not dense lists.
 */

type CardVariant = keyof typeof cardRecipe;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
	/** Visual emphasis. Defaults to `base`. */
	variant?: CardVariant;
	/** Render the bottom-right lotus corner flourish. */
	corner?: boolean;
	children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
	{
		variant = "base",
		corner = false,
		className,
		children,
		onClick,
		onKeyDown,
		...rest
	},
	ref,
) {
	const clickable = typeof onClick === "function";

	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(e);
		if (
			clickable &&
			!e.defaultPrevented &&
			(e.key === "Enter" || e.key === " ")
		) {
			e.preventDefault();
			onClick?.(e as unknown as MouseEvent<HTMLDivElement>);
		}
	};

	return (
		<div
			ref={ref}
			className={cn(cardRecipe[variant], className)}
			onClick={onClick}
			onKeyDown={clickable ? handleKeyDown : onKeyDown}
			role={clickable ? "button" : undefined}
			tabIndex={clickable ? 0 : undefined}
			{...rest}
		>
			{children}
			{corner && (
				<LotusCorner
					className={ornamentClass.cornerBR}
					size={ornamentSize.corner}
				/>
			)}
		</div>
	);
});

export default Card;

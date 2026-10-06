import type { ReactNode } from "react";
import { PeacockFeatherDivider, TempleBorder } from "@/src/assets/janmashtami";
import { ornamentSize, sectionHeader } from "@/src/theme";
import { cn } from "@/utils/shadcn";

/**
 * SectionHeader — the settled heading pattern for a scrolling screen.
 *
 * The audit found the home screen had no section headers at all, and that the
 * two ad-hoc ones elsewhere used `<h3>` and `<h2>` interchangeably for
 * identical visuals. This is the one pattern: an optional tracked gold eyebrow,
 * a Marcellus (or Devanagari) title, and a peacock-feather divider beneath.
 *
 * `crown` promotes a section to "featured" by setting a temple-border frieze
 * above the title — one of the three sanctioned homes for the signature arch
 * (see `src/theme/decorations.ts`). Use it sparingly; if every section is
 * crowned, none reads as featured.
 *
 * Pass `hindi` to render the title in the Devanagari display face; callers that
 * already know the UI language should pass `hindi={settingsLanguage === "hi"}`.
 */
export interface SectionHeaderProps {
	title: ReactNode;
	/** Small tracked overline above the title. */
	eyebrow?: ReactNode;
	/** Render the title in the Devanagari display face. */
	hindi?: boolean;
	/** Show the peacock-feather divider beneath the title. Default true. */
	divider?: boolean;
	/** Crown the header with a temple-border frieze (featured sections only). */
	crown?: boolean;
	/** Heading level for the document outline. Default 2. */
	as?: "h1" | "h2" | "h3";
	className?: string;
	id?: string;
}

export function SectionHeader({
	title,
	eyebrow,
	hindi = false,
	divider = true,
	crown = false,
	as: Heading = "h2",
	className,
	id,
}: SectionHeaderProps) {
	return (
		<div className={cn(sectionHeader.wrapper, className)}>
			{crown && (
				<TempleBorder
					className="text-gold-400 dark:text-gold-300/70 mb-1"
					size={ornamentSize.crown * 2}
				/>
			)}
			{eyebrow && <span className={sectionHeader.eyebrow}>{eyebrow}</span>}
			<Heading
				id={id}
				className={hindi ? sectionHeader.titleHindi : sectionHeader.title}
			>
				{title}
			</Heading>
			{divider && (
				<PeacockFeatherDivider
					className={sectionHeader.divider}
					size={ornamentSize.dividerMd}
				/>
			)}
		</div>
	);
}

export default SectionHeader;

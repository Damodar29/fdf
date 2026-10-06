import type React from "react";
import {
	isFuzzyMatch,
	smartNormalize,
	transliterateForSearch,
} from "../utils/textProcessor";

interface HighlightTextProps {
	text: string;
	highlight: string;
	className?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
	text,
	highlight,
	className = "",
}) => {
	if (!highlight?.trim()) {
		return <span className={className}>{text}</span>;
	}

	// Split query into terms
	const queryTerms = highlight
		.trim()
		.split(/\s+/)
		.filter((t) => t.length > 0);

	const processedTerms = queryTerms.map((term) => {
		const transliterated = transliterateForSearch(term);
		const normalized = smartNormalize(transliterated);
		return { term, normalized };
	});

	const parts = text.split(/(\s+|[.,!?;:()।"'\-\u0964\u0965])/g);

	return (
		<span className={className}>
			{parts.map((part, i) => {
				if (!part) return null;

				// Skip separators
				if (/^\s*$/.test(part) || /^[.,!?;:()।"'\-\u0964\u0965]+$/.test(part)) {
					return <span key={i}>{part}</span>;
				}

				const isMatch = processedTerms.some(({ term, normalized }) => {
					// 1. Direct match
					if (part.toLowerCase().includes(term.toLowerCase())) return true;

					// 2. Fuzzy match
					const normalizedPart = smartNormalize(transliterateForSearch(part));
					if (normalizedPart === normalized) return true;
					if (normalizedPart.length > 2 && normalized.length > 2) {
						return isFuzzyMatch(normalizedPart, normalized);
					}
					return false;
				});

				if (isMatch) {
					return (
						<mark
							key={i}
							className="bg-yellow-300 dark:bg-yellow-600 text-black dark:text-white rounded-sm px-0.5 shadow-sm font-inherit"
						>
							{part}
						</mark>
					);
				}

				return <span key={i}>{part}</span>;
			})}
		</span>
	);
};

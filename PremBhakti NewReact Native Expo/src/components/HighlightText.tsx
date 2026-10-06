import { useMemo } from "react";
import { type StyleProp, Text, type TextStyle } from "react-native";
import { useAppTheme } from "../theme/useAppTheme";
import { isFuzzyMatch, smartNormalize, transliterateForSearch } from "../utils/textProcessor";

const SEPARATOR = /(\s+|[.,!?;:()।"'\-।॥])/g;
const IS_SEPARATOR = /^(\s*|[.,!?;:()।"'\-।॥]+)$/;

/**
 * components/HighlightText.tsx: marks every word of `text` that matches a
 * search term — directly, or phonetically (Hinglish/IAST/Devanagari) — with
 * the yellow `<mark>` look. Renders as nested Text so it can sit inside a
 * truncating parent.
 */
export function HighlightText({
	text,
	highlight,
	style,
	numberOfLines,
}: {
	text: string;
	highlight: string;
	style?: StyleProp<TextStyle>;
	numberOfLines?: number;
}) {
	const theme = useAppTheme();
	const parts = useMemo(() => {
		const terms = highlight
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((term) => ({ term: term.toLowerCase(), normalized: smartNormalize(transliterateForSearch(term)) }));
		if (!terms.length) return null;
		return text.split(SEPARATOR).map((part) => {
			if (!part || IS_SEPARATOR.test(part)) return { part, match: false };
			const lower = part.toLowerCase();
			const normalizedPart = smartNormalize(transliterateForSearch(part));
			const match = terms.some(
				({ term, normalized }) =>
					lower.includes(term) ||
					normalizedPart === normalized ||
					(normalizedPart.length > 2 && normalized.length > 2 && isFuzzyMatch(normalizedPart, normalized)),
			);
			return { part, match };
		});
	}, [text, highlight]);

	if (!parts) {
		return (
			<Text style={style} numberOfLines={numberOfLines}>
				{text}
			</Text>
		);
	}

	const markStyle = {
		backgroundColor: theme.isDark ? "#ca8a04" : "#fde047",
		color: theme.isDark ? "#fff" : "#000",
	};

	return (
		<Text style={style} numberOfLines={numberOfLines}>
			{parts.map(({ part, match }, i) =>
				match ? (
					<Text key={i} style={markStyle}>
						{part}
					</Text>
				) : (
					part
				),
			)}
		</Text>
	);
}

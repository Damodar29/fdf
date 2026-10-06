import { Platform, Text, View, StyleSheet } from "react-native";
import React from "react";
import { text, krishna, gold } from "../theme/jmColors";

// Simple HTML-to-Text renderer for basic tags.
// Used for Firestore-rendered content like Guru Maharaj and Virahi Maharaj biographies.
// Supports: p, br, b, strong, i, em, h1-h4, ul, li, a

type HtmlElement = {
	tag: string;
	children: (string | HtmlElement)[];
	attrs?: Record<string, string>;
};

/** Parse a simple HTML string into a tree of HtmlElements. */
function parseHtml(html: string): HtmlElement[] {
	const elements: HtmlElement[] = [];
	const tagPattern = /<(\/?)(\w+)([^>]*)>/g;
	let lastIndex = 0;
	let match;

	while ((match = tagPattern.exec(html)) !== null) {
		// Text before this tag
		if (match.index > lastIndex) {
			const textNode = html.slice(lastIndex, match.index);
			if (textNode.trim()) {
				elements.push({ tag: "#text", children: [textNode] });
			}
		}

		const isClosing = match[1] === "/";
		const tagName = match[2].toLowerCase();
		const attrsStr = match[3];

		if (!isClosing) {
			// Find the matching closing tag
			const closePattern = new RegExp(`</${tagName}>`, "i");
			const closeMatch = html.slice(match.index + match[0].length).search(closePattern);

			if (closeMatch !== -1) {
				const innerHtml = html.slice(match.index + match[0].length, match.index + match[0].length + closeMatch);
				const innerElements = parseHtml(innerHtml);

				// Parse attributes
				const attrs: Record<string, string> = {};
				const attrPattern = /(\w+)="([^"]*)"/g;
				let attrMatch;
				while ((attrMatch = attrPattern.exec(attrsStr)) !== null) {
					attrs[attrMatch[1]] = attrMatch[2];
				}

				elements.push({ tag: tagName, children: innerElements, attrs });
				const closingTagLen = match[0].length + closeMatch + (`</${tagName}>`).length;
				lastIndex = match.index + closingTagLen;
				tagPattern.lastIndex = lastIndex;
			} else {
				// Self-closing or unclosed tag - skip
				lastIndex = match.index + match[0].length;
				tagPattern.lastIndex = lastIndex;
			}
		} else {
			// Closing tag - skip
			lastIndex = match.index + match[0].length;
		}
	}

	// Remaining text
	if (lastIndex < html.length) {
		const textNode = html.slice(lastIndex);
		if (textNode.trim()) {
			elements.push({ tag: "#text", children: [textNode] });
		}
	}

	return elements;
}

interface SimpleHtmlProps {
	/** HTML string (sanitized before passing if it comes from user input) */
	html: string;
	/** Optional dark mode flag to apply correct text colors */
	isDark?: boolean;
}

/**
 * Renders simple HTML as React Native Text elements.
 *
 * For the browser preview (Platform.web), this falls back to dangerouslySetInnerHTML
 * because the app's web-shims replace react-native elements with web equivalents.
 */
export function SimpleHtml({ html, isDark = false }: SimpleHtmlProps) {
	if (Platform.OS === "web") {
		return (
			<div
				className="prose dark:prose-invert prose-slate max-w-none space-y-4"
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		);
	}

	const elements = parseHtml(html);
	return <HtmlRenderer elements={elements} isDark={isDark} />;
}

interface HtmlRendererProps {
	elements: HtmlElement[];
	isDark: boolean;
}

function HtmlRenderer({ elements, isDark }: HtmlRendererProps) {
	const defaultColor = isDark ? text.dark.secondary : text.light.secondary;
	const headingColor = isDark ? gold[300] : gold[500];

	const renderElement = (el: HtmlElement): React.ReactNode => {
		if (el.tag === "#text") {
			const textContent = el.children.join("");
			if (!textContent.trim()) return null;
			return <Text style={{ color: defaultColor, fontSize: 16, lineHeight: 24 }}>{textContent}</Text>;
		}

		const children = el.children.map((child, i) => {
			if (typeof child === "string") {
				return <Text key={i} style={{ color: defaultColor, fontSize: 16, lineHeight: 24 }}>{child}</Text>;
			}
			return <React.Fragment key={i}>{renderElement(child)}</React.Fragment>;
		});

		switch (el.tag) {
			case "p":
				return <Text style={{ marginBottom: 16, color: defaultColor, fontSize: 16, lineHeight: 24 }}>{children}</Text>;

			case "br":
				return <Text>{"\n"}</Text>;

			case "b":
			case "strong":
				return <Text style={{ fontWeight: "600", color: isDark ? text.dark.primary : text.light.primary }}>{children}</Text>;

			case "i":
			case "em":
				return <Text style={{ fontStyle: "italic" }}>{children}</Text>;

			case "h1":
				return <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 12, color: headingColor, marginTop: 24 }}>{children}</Text>;

			case "h2":
				return <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 10, color: headingColor, marginTop: 24 }}>{children}</Text>;

			case "h3":
				return <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8, color: headingColor, marginTop: 24 }}>{children}</Text>;

			case "h4":
				return <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 6, color: headingColor, marginTop: 24 }}>{children}</Text>;

			case "ul":
				return <View style={{ paddingLeft: 16, marginBottom: 16, gap: 4 }}>{children}</View>;

			case "li":
				return (
					<View style={{ flexDirection: "row", alignItems: "flex-start" }}>
						<Text style={{ marginRight: 8, color: defaultColor, fontSize: 16, lineHeight: 24 }}>•</Text>
						<Text style={{ flex: 1, color: defaultColor, fontSize: 16, lineHeight: 24 }}>{children}</Text>
					</View>
				);

			case "a":
				// Render as plain text for now, could be enhanced with Linking later
				return <Text style={{ color: isDark ? "#38bdf8" : "#0284c7", textDecorationLine: "underline" }}>{children}</Text>;

			default:
				return <Text>{children}</Text>;
		}
	};

	return (
		<View>
			{elements.map((el, i) => (
				<React.Fragment key={i}>{renderElement(el)}</React.Fragment>
			))}
		</View>
	);
}

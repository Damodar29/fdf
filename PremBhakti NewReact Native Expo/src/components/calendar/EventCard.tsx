import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { EventData } from "../../types";
import { status } from "../../theme/colors";
import { useAppTheme } from "../../theme/useAppTheme";

interface EventCardProps {
	event: EventData;
	compact?: boolean;
	title: string;
	typeLabel: string;
	isHindi: boolean;
	eventTimeLabel: string;
	breakTimeLabel: string;
}

export const EventCard: React.FC<EventCardProps> = ({
	event,
	compact = false,
	title,
	typeLabel,
	isHindi,
	eventTimeLabel,
	breakTimeLabel,
}) => {
	const theme = useAppTheme();
	const [isExpanded, setIsExpanded] = useState(false);
	const description = event.description?.trim() || "";

	let colorStyle: { bg: string; border: string; text: string; typeText: string } = {
		bg: status.info,
		border: status.info,
		text: "#FFFFFF",
		typeText: status.infoSoft,
	};

	if (event.isEkadashi) {
		colorStyle = {
			bg: status.error,
			border: status.errorStrong,
			text: "#FFFFFF",
			typeText: status.errorSoft,
		};
	} else if (event.type === "festival") {
		colorStyle = {
			bg: status.success,
			border: status.successStrong,
			text: "#FFFFFF",
			typeText: status.successSoft,
		};
	}

	return (
		<View
			style={{
				backgroundColor: colorStyle.bg,
				borderColor: colorStyle.border,
				borderWidth: 1,
				borderRadius: compact ? 8 : 12,
				padding: compact ? 12 : 16,
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 1 },
				shadowOpacity: 0.1,
				shadowRadius: 2,
				elevation: 2,
			}}
		>
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
				<View style={{ flex: 1 }}>
					<Text style={{ color: colorStyle.text, fontWeight: "bold", fontSize: compact ? 14 : 14 }}>
						{title}
					</Text>
					{!compact && (
						<Text style={{ color: colorStyle.typeText, fontSize: 12, fontWeight: "bold", marginTop: 2, textTransform: "uppercase" }}>
							{typeLabel}
						</Text>
					)}
				</View>
			</View>

			{(event.eventTime || event.breakTime) ? (
				<View style={{ marginTop: 4 }}>
					{event.eventTime ? (
						<Text style={{ color: colorStyle.typeText, fontSize: 12 }}>
							<Text style={{ fontWeight: "bold" }}>{eventTimeLabel}:</Text> {event.eventTime}
						</Text>
					) : null}
					{event.breakTime ? (
						<Text style={{ color: colorStyle.typeText, fontSize: 12 }}>
							<Text style={{ fontWeight: "bold" }}>{breakTimeLabel}:</Text> {event.breakTime.replace(/^पारण\s*[-:]?\s*/, "")}
						</Text>
					) : null}
				</View>
			) : null}

			{description ? (
				<View style={{ marginTop: compact ? 6 : 8, paddingTop: compact ? 6 : 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" }}>
					<Text
						style={{ color: "rgba(255,255,255,0.95)", fontSize: 14, lineHeight: 20 }}
						numberOfLines={isExpanded ? undefined : 2}
					>
						{description}
					</Text>
					{/* Always show read more for now, or just limit lines. React Native Text has no easy isClamped, 
					    but we can show the button if description length is > 80 chars as a heuristic. */}
					{description.length > 80 && (
						<Pressable
							onPress={() => setIsExpanded(!isExpanded)}
							style={{ flexDirection: "row", alignItems: "center", marginTop: 8, opacity: 0.8 }}
						>
							<Text style={{ color: "#FFF", fontSize: 12, fontWeight: "bold", marginRight: 4 }}>
								{isExpanded
									? isHindi
										? "कम दिखाएँ"
										: "Show less"
									: isHindi
										? "और पढ़ें"
										: "Read more"}
							</Text>
							{isExpanded ? <ChevronUp size={12} color="#FFF" /> : <ChevronDown size={12} color="#FFF" />}
						</Pressable>
					)}
				</View>
			) : null}
		</View>
	);
};

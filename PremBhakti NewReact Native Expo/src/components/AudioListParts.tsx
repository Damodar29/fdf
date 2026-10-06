import { Check, ChevronDown, ChevronUp, Download, type LucideIcon, PlayCircle, Trash2 } from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { triggerHaptic } from "../lib/haptics";
import { type AudioCategory, useDownloadStore } from "../store/downloadStore";
import { ink } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";
import type { Bhajan, BhajanAudio } from "../types";
import { HighlightText } from "./HighlightText";

// Building blocks shared by the Audio tab's lists (AudioScreen.tsx /
// LectureList.tsx in the Capacitor app): the expandable group card, the
// track row inside it, the per-track download button, and the faint cross
// pattern behind the whole screen.

/** An expandable group: icon medallion, title, count, chevron; tracks below. */
export function AudioGroup({
	icon: Icon,
	title,
	subtitle,
	highlight = "",
	expanded,
	onToggle,
	children,
	small,
}: {
	icon: LucideIcon;
	title: string;
	subtitle: ReactNode;
	highlight?: string;
	expanded: boolean;
	onToggle: () => void;
	children?: ReactNode;
	/** LectureList's slightly roomier header (p-4, 13px title). */
	small?: boolean;
}) {
	const theme = useAppTheme();
	return (
		<View
			style={[
				styles.group,
				expanded
					? {
							backgroundColor: theme.isDark ? "rgba(15,34,66,0.9)" : "rgba(255,255,255,0.9)",
							borderColor: theme.isDark ? ink[600] : theme.p[200],
							elevation: 3,
						}
					: null,
			]}
		>
			<Pressable onPress={onToggle} style={[styles.groupHead, small ? { padding: 16, gap: 16 } : null]}>
				<View
					style={[
						styles.medallion,
						expanded
							? { backgroundColor: theme.isDark ? ink[700] : theme.p[100], borderColor: theme.p[200] }
							: { backgroundColor: theme.isDark ? ink[800] : ink[100], borderColor: "transparent" },
					]}
				>
					<Icon size={18} color={expanded ? theme.p[600] : theme.isDark ? theme.p[400] : theme.p[500]} />
				</View>
				<View style={styles.flex}>
					<HighlightText
						text={title}
						highlight={highlight}
						style={[
							small ? styles.titleSmall : styles.title,
							{ color: expanded ? theme.p[600] : theme.isDark ? ink[200] : ink[700] },
						]}
					/>
					{typeof subtitle === "string" ? (
						<Text style={[styles.subtitle, { color: theme.isDark ? ink[300] : ink[500] }]}>{subtitle}</Text>
					) : (
						subtitle
					)}
				</View>
				{expanded ? <ChevronUp size={18} color={theme.p[600]} /> : <ChevronDown size={18} color={ink[400]} />}
			</Pressable>
			{expanded && children ? (
				<View style={styles.groupBody}>
					<View
						style={[
							styles.trackList,
							{
								backgroundColor: theme.isDark ? "rgba(7,21,41,0.5)" : ink[50],
								borderColor: theme.isDark ? ink[700] : ink[100],
							},
						]}
					>
						{children}
					</View>
				</View>
			) : null}
		</View>
	);
}

/** One playable line inside a group: play icon, label, then trailing actions. */
export function TrackRow({
	label,
	onPress,
	right,
}: {
	label: string;
	onPress: () => void;
	right?: ReactNode;
}) {
	const theme = useAppTheme();
	return (
		<View style={styles.trackRow}>
			<Pressable
				onPress={() => {
					triggerHaptic("medium");
					onPress();
				}}
				style={({ pressed }) => [
					styles.trackMain,
					pressed ? { backgroundColor: theme.isDark ? ink[800] : "#fff", borderColor: theme.p[200] } : null,
				]}
			>
				<PlayCircle size={16} color={ink[400]} />
				<Text
					style={[styles.trackLabel, { color: theme.isDark ? ink[300] : ink[700] }]}
					numberOfLines={1}
				>
					{label}
				</Text>
			</Pressable>
			{right}
		</View>
	);
}

/** Download / progress / done button for one track. */
export function TrackDownloadButton({
	track,
	title,
	parent,
	category = "audio",
	size = 18,
}: {
	track: BhajanAudio;
	title: string;
	parent?: Bhajan;
	category?: AudioCategory;
	size?: number;
}) {
	const theme = useAppTheme();
	const done = useDownloadStore((s) => !!s.downloaded[track.id]);
	const progress = useDownloadStore((s) => s.active[track.id]?.progress);
	const request = useDownloadStore((s) => s.requestTrackDownload);
	return (
		<Pressable
			accessibilityLabel="Download"
			disabled={done || progress !== undefined}
			onPress={() => request(track, title, parent, category)}
			style={styles.downloadButton}
		>
			{progress !== undefined ? (
				<Text style={[styles.progressText, { color: theme.isDark ? theme.p[400] : theme.p[600] }]}>{Math.round(progress)}</Text>
			) : done ? (
				<Check size={size} color={theme.isDark ? "#4ade80" : "#22c55e"} />
			) : (
				<Download size={size} color={theme.isDark ? ink[500] : ink[400]} />
			)}
		</Pressable>
	);
}

/** Two-tap delete: trash icon, then a red "Confirm?" pill for 3 seconds. */
export function ConfirmDeleteButton({ onConfirm, label = "Confirm?", iconColor }: { onConfirm: () => void; label?: string; iconColor?: string }) {
	const [confirming, setConfirming] = useState(false);
	useEffect(() => {
		if (!confirming) return;
		const timer = setTimeout(() => setConfirming(false), 3000);
		return () => clearTimeout(timer);
	}, [confirming]);
	return (
		<Pressable
			onPress={() => {
				if (confirming) {
					onConfirm();
					setConfirming(false);
				} else {
					setConfirming(true);
				}
			}}
			style={[styles.deleteButton, confirming ? styles.deleteConfirm : null]}
		>
			{confirming ? <Text style={styles.deleteText}>{label}</Text> : <Trash2 size={18} color={iconColor ?? ink[300]} />}
		</Pressable>
	);
}

/** The amber cross pattern (10% opacity) behind the Audio tab. */
export function CrossPattern() {
	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none">
			<Svg width="100%" height="100%" opacity={0.1}>
				<Defs>
					<Pattern id="cross" width={60} height={60} patternUnits="userSpaceOnUse">
						<Path
							fill="#d97706"
							d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"
						/>
					</Pattern>
				</Defs>
				<Rect width="100%" height="100%" fill="url(#cross)" />
			</Svg>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	group: { borderRadius: 16, borderWidth: 1, borderColor: "transparent", marginBottom: 8 },
	groupHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
	medallion: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
	title: { fontSize: 14, fontWeight: "700" },
	titleSmall: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
	subtitle: { fontSize: 12 },
	groupBody: { paddingHorizontal: 12, paddingBottom: 12 },
	trackList: { borderRadius: 12, padding: 6, borderWidth: 1, gap: 4 },
	trackRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 },
	trackMain: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "transparent",
	},
	trackLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
	downloadButton: { padding: 8, minWidth: 34, alignItems: "center" },
	progressText: { fontSize: 10, fontWeight: "900" },
	deleteButton: { padding: 8, borderRadius: 999, flexDirection: "row", alignItems: "center" },
	deleteConfirm: { backgroundColor: "#ef4444", paddingHorizontal: 12 },
	deleteText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});

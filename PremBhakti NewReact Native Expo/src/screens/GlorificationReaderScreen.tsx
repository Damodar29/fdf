import {
	collection,
	documentId,
	getDoc,
	getDocs,
	getFirestore,
	query,
	where,
	doc,
} from "@react-native-firebase/firestore";
import { BookOpen, ChevronDown, ChevronLeft, ChevronUp, Heart, Loader2, MapPin } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, {
	FadeIn,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/useAppTheme";
import { useSettingsStore } from "../store/settingsStore";
import { triggerHaptic } from "../lib/haptics";
import { webGet, webSet } from "../lib/webStore";
import { janmashtami } from "../theme/jmColors";
import { ink } from "../theme/colors";

// ── Types (copied from OG GlorificationReaderScreen.tsx) ─────────────────────

interface GlorificationEntry {
	id: string;
	name: string;
	location: string;
	glorification: string;
	createdAt: number;
	uid?: string;
	type?: "text" | "audio";
	audioUrl?: string;
	duration?: number;
}

/** Group entries: same uid (if present) together; uid-less entries stay individual */
interface GroupedEntry {
	/** Use uid if available, else doc id as key */
	key: string;
	name: string;
	location: string;
	entries: GlorificationEntry[];
}

// ── Pure helpers (copied verbatim from OG, types added) ──────────────────────

const ordinalLabel = (n: number, isHindi: boolean): string => {
	if (isHindi) {
		const map: Record<number, string> = { 1: "पहली", 2: "दूसरी", 3: "तीसरी", 4: "चौथी" };
		return `${map[n] ?? `${n}वीं`} महिमा`;
	}
	const map: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };
	return `${map[n] ?? `${n}th`} Glorification`;
};

const groupEntries = (entries: GlorificationEntry[]): GroupedEntry[] => {
	const uidMap = new Map<string, GroupedEntry>();
	const result: GroupedEntry[] = [];
	for (const entry of entries) {
		if (entry.uid) {
			if (uidMap.has(entry.uid)) {
				uidMap.get(entry.uid)?.entries.push(entry);
			} else {
				const g: GroupedEntry = {
					key: entry.uid,
					name: entry.name,
					location: entry.location,
					entries: [entry],
				};
				uidMap.set(entry.uid, g);
				result.push(g);
			}
		} else {
			// No uid — standalone group
			result.push({
				key: entry.id,
				name: entry.name,
				location: entry.location,
				entries: [entry],
			});
		}
	}
	return result;
};

// ── Colour aliases (match OG ry-maroon / ry-gold / ry-cream / ry-brown) ──────
// OG's ry-maroon maps to janmashtami.krishnaBlue (same as AavirbhavSection.tsx)
const RY = {
	maroon: janmashtami.krishnaBlue,
	gold: janmashtami.deepGold,
	cream: janmashtami.cream,
	brown: janmashtami.textSecondary,
} as const;

// ── NewBadge sub-component ────────────────────────────────────────────────────

/** Pulsing "NEW" / "नई" badge — same animation as OG animate-pulse */
function NewBadge({ isHindi }: { isHindi: boolean }) {
	const o = useSharedValue(1);
	useEffect(() => {
		o.value = withRepeat(
			withSequence(withTiming(0.5, { duration: 1000 }), withTiming(1, { duration: 1000 })),
			-1,
		);
	}, [o]);
	const style = useAnimatedStyle(() => ({ opacity: o.value }));
	return (
		<Animated.View style={[styles.newBadge, style]}>
			<Text style={styles.newBadgeText}>{isHindi ? "नई" : "NEW"}</Text>
		</Animated.View>
	);
}

// ── Main screen ───────────────────────────────────────────────────────────────

interface Props {
	onBack: () => void;
}

export function GlorificationReaderScreen({ onBack }: Props) {
	const { isDark } = useAppTheme();
	const insets = useSafeAreaInsets();
	const language = useSettingsStore((s) => s.settingsLanguage);
	const isHindi = language === "hi";

	const [entries, setEntries] = useState<GlorificationEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
	const [publishedIdsState, setPublishedIdsState] = useState<string[]>([]);

	// visitedKeys: read from webStore (mirrors OG localStorage "visitedGlorifications")
	const [visitedKeys, setVisitedKeys] = useState<Set<string>>(() => {
		try {
			const stored = webGet("visitedGlorifications");
			return stored ? new Set(JSON.parse(stored)) : new Set();
		} catch {
			return new Set();
		}
	});

	// Snapshot taken at screen open — stable sorting while the screen is open (same as OG)
	const [initialVisitedKeys] = useState<Set<string>>(() => {
		try {
			const stored = webGet("visitedGlorifications");
			return stored ? new Set(JSON.parse(stored)) : new Set();
		} catch {
			return new Set();
		}
	});

	// ── Data loading ──────────────────────────────────────────────────────────

	const loadPublishedGlorifications = useCallback(async () => {
		try {
			const db = getFirestore();
			const settingsSnap = await getDoc(doc(db, "app-settings", "glorification-reader"));
			if (!settingsSnap.exists()) return;

			const data = settingsSnap.data();
			const publishedIds: string[] = data?.publishedIds || [];
			setPublishedIdsState(publishedIds);
			if (publishedIds.length === 0) return;

			const results: GlorificationEntry[] = [];
			const CHUNK = 30;
			for (let i = 0; i < publishedIds.length; i += CHUNK) {
				const chunk = publishedIds.slice(i, i + CHUNK);
				const q = query(
					collection(db, "hhbsm-2026-glorification"),
					where(documentId(), "in", chunk),
				);
				const snap = await getDocs(q);
				for (const d of snap.docs) {
					const dd = d.data();
					if (dd.type === "audio") continue;
					results.push({
						id: d.id,
						name: dd.name || "",
						location: dd.location || "",
						glorification: dd.glorification || "",
						createdAt: dd.createdAt || 0,
						uid: dd.uid || undefined,
						type: dd.type || "text",
					});
				}
			}

			// Re-sort by admin-defined order (same as OG)
			const idOrder = new Map(publishedIds.map((id, idx) => [id, idx]));
			results.sort((a, b) => (idOrder.get(a.id) ?? 9999) - (idOrder.get(b.id) ?? 9999));
			setEntries(results);
		} catch (err) {
			console.error("Failed to load published glorifications", err);
		}
	}, []);

	useEffect(() => {
		setLoading(true);
		setEntries([]);
		setExpandedKeys(new Set());
		setPublishedIdsState([]);
		loadPublishedGlorifications().finally(() => setLoading(false));
	}, [loadPublishedGlorifications]);

	// ── Groups (same logic as OG) ─────────────────────────────────────────────

	const groups = useMemo(() => {
		const g = groupEntries(entries);
		return g.sort((a, b) => {
			const aVisited = initialVisitedKeys.has(a.key);
			const bVisited = initialVisitedKeys.has(b.key);
			if (aVisited && !bVisited) return 1;
			if (!aVisited && bVisited) return -1;
			return 0;
		});
	}, [entries, initialVisitedKeys]);

	// Update allGlorificationsReadHash when all groups are visited (same as OG)
	useEffect(() => {
		if (groups.length > 0 && visitedKeys.size >= groups.length) {
			webSet("allGlorificationsReadHash", publishedIdsState.join(","));
		}
	}, [visitedKeys.size, groups.length, publishedIdsState]);

	// ── Expand / collapse + mark visited ─────────────────────────────────────

	const toggleExpand = useCallback((key: string) => {
		triggerHaptic("light");
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
		setVisitedKeys((prev) => {
			const next = new Set(prev);
			if (!next.has(key)) {
				next.add(key);
				// Persist to webStore with same key as OG localStorage
				try {
					webSet("visitedGlorifications", JSON.stringify(Array.from(next)));
				} catch {}
			}
			return next;
		});
	}, []);

	// ── Theme values ──────────────────────────────────────────────────────────
	const pageBg = isDark ? ink[900] : RY.cream;
	const cardBg = isDark ? ink[800] : "#FFFFFF";
	const textColor = isDark ? "#E2E8F0" : "#334155";
	const emptyTextColor = isDark ? "#CBD5E1" : RY.brown;

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<View style={[styles.root, { backgroundColor: pageBg }]}>
			{/* Header — ry-maroon bg, cream text, ChevronLeft back, BookOpen icon */}
			<View style={[styles.header, { paddingTop: insets.top + 16 }]}>
				<Pressable
					onPress={() => { triggerHaptic("light"); onBack(); }}
					style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
					accessibilityLabel={isHindi ? "वापस जाएं" : "Go back"}
				>
					<ChevronLeft size={22} color={RY.cream} />
				</Pressable>

				<View style={styles.headerCenter}>
					<Text style={styles.headerTitle}>
						{isHindi ? "गुरु महाराज जी की महिमा" : "Glorifications"}
					</Text>
					<Text style={styles.headerSubtitle}>
						{loading
							? " "
							: isHindi
								? `${groups.length} भक्तों की श्रद्धांजलि`
								: `${groups.length} devotee${groups.length !== 1 ? "s" : ""}`}
					</Text>
				</View>

				<BookOpen size={20} color={`${RY.cream}99`} />
			</View>

			{/* Content */}
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
				showsVerticalScrollIndicator={false}
			>
				{loading ? (
					<View style={styles.center}>
						<Loader2 size={24} color={isDark ? RY.gold : RY.maroon} />
						<Text style={[styles.loadingText, { color: isDark ? "#CBD5E1" : RY.brown }]}>
							{isHindi ? "लोड हो रहा है..." : "Loading..."}
						</Text>
					</View>
				) : groups.length === 0 ? (
					<View style={styles.center}>
						<Heart size={48} color={isDark ? `${RY.gold}33` : `${RY.maroon}33`} />
						<Text style={[styles.emptyText, { color: emptyTextColor }]}>
							{isHindi
								? "अभी कोई महिमा प्रकाशित नहीं की गई है।"
								: "No glorifications have been published yet."}
						</Text>
					</View>
				) : (
					<>
						{groups.map((group, gIdx) => {
							const isExpanded = expandedKeys.has(group.key);
							const isVisited = visitedKeys.has(group.key);
							const multiEntry = group.entries.length > 1;

							return (
								<Animated.View
									key={group.key}
									entering={Platform.OS !== "web" ? FadeIn.duration(200).delay(gIdx * 30) : undefined}
									style={[styles.card, { backgroundColor: cardBg, borderColor: `${RY.gold}33` }]}
								>
									{/* Gold accent bar at top */}
									<View style={styles.cardTopBar} />

									{/* Collapsed header (always visible) */}
									<Pressable
										onPress={() => toggleExpand(group.key)}
										style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
										accessibilityRole="button"
									>
										{/* Index badge */}
										<View
											style={[
												styles.indexBadge,
												{ backgroundColor: isDark ? `${RY.gold}1A` : `${RY.maroon}1A` },
											]}
										>
											<Text style={[styles.indexText, { color: isDark ? RY.gold : RY.maroon }]}>
												{gIdx + 1}
											</Text>
										</View>

										{/* Name + meta */}
										<View style={styles.cardMeta}>
											<View style={styles.nameRow}>
												<Text
													style={[styles.cardName, { color: isDark ? RY.gold : RY.maroon }]}
													numberOfLines={1}
												>
													{group.name}
												</Text>
												{!isVisited && <NewBadge isHindi={isHindi} />}
											</View>

											<View style={styles.metaRow}>
												{!!group.location && (
													<>
														<MapPin size={10} color={isDark ? ink[400] : `${RY.brown}80`} />
														<Text
															style={[styles.locationText, { color: isDark ? ink[400] : `${RY.brown}B3` }]}
															numberOfLines={1}
														>
															{group.location}
														</Text>
													</>
												)}
												{multiEntry && (
													<View
														style={[
															styles.entriesCountPill,
															{ backgroundColor: isDark ? `${RY.gold}1A` : `${RY.maroon}1A` },
														]}
													>
														<Text style={[styles.entriesCountText, { color: isDark ? RY.gold : RY.maroon }]}>
															{isHindi ? `${group.entries.length} महिमाएं` : `${group.entries.length} entries`}
														</Text>
													</View>
												)}
											</View>
										</View>

										{/* Expand/Collapse pill button */}
										<View style={styles.expandButton}>
											{isExpanded
												? <ChevronUp size={12} color={RY.cream} />
												: <ChevronDown size={12} color={RY.cream} />}
											<Text style={styles.expandButtonText}>
												{isExpanded
													? isHindi ? "बंद करें" : "Collapse"
													: isHindi ? "पूरा पढ़ें" : "Read Full"}
											</Text>
										</View>
									</Pressable>

									{/* Expanded content */}
									{isExpanded && (
										<Animated.View
											entering={Platform.OS !== "web" ? FadeIn.duration(200) : undefined}
											style={[styles.expandedContent, { borderTopColor: `${RY.gold}26` }]}
										>
											{group.entries.map((entry, eIdx) => (
												<View key={entry.id} style={styles.entryBlock}>
													<Text style={[styles.ordinalLabel, { color: isDark ? `${RY.gold}99` : `${RY.maroon}99` }]}>
														{ordinalLabel(eIdx + 1, isHindi)}
													</Text>
													<Text style={[styles.glorificationText, { color: textColor }]}>
														{entry.glorification}
													</Text>
													{eIdx < group.entries.length - 1 && (
														<View style={[styles.entrySeparator, { backgroundColor: `${RY.gold}26` }]} />
													)}
												</View>
											))}

											{/* Collapse button at bottom */}
											<Pressable
												onPress={() => toggleExpand(group.key)}
												style={({ pressed }) => [
													styles.collapseBottomButton,
													{ borderColor: `${RY.gold}33` },
													pressed && styles.pressed,
												]}
											>
												<ChevronUp size={13} color={isDark ? RY.gold : RY.maroon} />
												<Text style={[styles.collapseBottomText, { color: isDark ? RY.gold : RY.maroon }]}>
													{isHindi ? "बंद करें" : "Collapse"}
												</Text>
											</Pressable>
										</Animated.View>
									)}
								</Animated.View>
							);
						})}

						{/* Footer ornament */}
						<View style={styles.footerOrnament}>
							<View style={[styles.footerLine, { backgroundColor: `${RY.gold}33` }]} />
							<Heart size={12} color={isDark ? `${RY.gold}66` : `${RY.maroon}66`} />
							<View style={[styles.footerLine, { backgroundColor: `${RY.gold}33` }]} />
						</View>
					</>
				)}
			</ScrollView>
		</View>
	);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	root: { flex: 1 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		paddingBottom: 16,
		backgroundColor: janmashtami.krishnaBlue,
		shadowColor: "#000",
		shadowOpacity: 0.15,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
		elevation: 6,
	},
	backButton: { padding: 8, borderRadius: 999 },
	headerCenter: { flex: 1, minWidth: 0 },
	headerTitle: {
		fontFamily: "serif",
		fontSize: 18,
		fontWeight: "700",
		color: janmashtami.cream,
		lineHeight: 24,
	},
	headerSubtitle: {
		fontSize: 10,
		color: `${janmashtami.cream}B3`,
		marginTop: 2,
	},
	scroll: { flex: 1 },
	scrollContent: {
		padding: 16,
		maxWidth: 672,
		alignSelf: "center",
		width: "100%",
	},
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 80,
		gap: 12,
	},
	loadingText: { fontSize: 14 },
	emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
	card: {
		borderRadius: 24,
		borderWidth: 1,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOpacity: 0.06,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
		marginBottom: 12,
	},
	cardTopBar: {
		height: 3,
		backgroundColor: janmashtami.deepGold,
		opacity: 0.6,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 20,
		paddingVertical: 16,
	},
	indexBadge: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	indexText: { fontSize: 10, fontWeight: "700" },
	cardMeta: { flex: 1, minWidth: 0 },
	nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	cardName: { fontWeight: "700", fontSize: 14, flexShrink: 1 },
	newBadge: {
		borderRadius: 999,
		backgroundColor: "#DC2626",
		paddingHorizontal: 6,
		paddingVertical: 2,
		shadowColor: "#DC2626",
		shadowOpacity: 0.5,
		shadowRadius: 8,
		elevation: 4,
		flexShrink: 0,
	},
	newBadgeText: {
		fontSize: 8,
		fontWeight: "900",
		letterSpacing: 1.5,
		color: "#FFFFFF",
		textTransform: "uppercase",
	},
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginTop: 2,
		flexWrap: "wrap",
	},
	locationText: { fontSize: 11, flexShrink: 1 },
	entriesCountPill: {
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 2,
		marginLeft: 4,
	},
	entriesCountText: { fontSize: 10, fontWeight: "700" },
	expandButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: janmashtami.krishnaBlue,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		flexShrink: 0,
	},
	expandButtonText: { color: janmashtami.cream, fontSize: 11, fontWeight: "700" },
	expandedContent: {
		borderTopWidth: 1,
		paddingHorizontal: 20,
		paddingBottom: 20,
	},
	entryBlock: { paddingTop: 16 },
	ordinalLabel: {
		fontSize: 10,
		fontWeight: "700",
		letterSpacing: 1.5,
		textTransform: "uppercase",
		marginBottom: 8,
	},
	glorificationText: { fontSize: 14, lineHeight: 22, fontWeight: "500" },
	entrySeparator: { marginTop: 16, height: 1 },
	collapseBottomButton: {
		marginTop: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 8,
		borderRadius: 16,
		borderWidth: 1,
	},
	collapseBottomText: { fontSize: 12, fontWeight: "700" },
	footerOrnament: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 16,
		paddingHorizontal: 8,
	},
	footerLine: { flex: 1, height: 1 },
	pressed: { opacity: 0.75 },
});

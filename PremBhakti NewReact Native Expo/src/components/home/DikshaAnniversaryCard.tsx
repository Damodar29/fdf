import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Flower2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { type AnimatedProps } from "react-native-reanimated";
import { MANDAL_LIST } from "../../data/mandals";
import { THUMB, thumbUrl } from "../../lib/imageThumb";
import { getObject, setObject } from "../../lib/storage";
import { useProfileStore } from "../../store/profileStore";
import { cream, gold, ink, krishna, serif } from "../../theme/colors";

// DikshaAnniversaryCard of the Capacitor Home: devotees whose diksha
// anniversary is today (diksha_anniversaries/{day}, made each night by a
// Cloud Function), and a greeting of its own on the devotee's own day.
// Nothing on other days.

interface AnniversaryEntry {
	name: string;
	photoURL?: string;
	mandalId?: string;
	customMandalName?: string;
	years: number;
}
interface Cached {
	id: string;
	fetchedAt: number;
	devotees: AnniversaryEntry[];
}

const CACHE_KEY = "diksha_anniversaries_v1";
const EMPTY_RETRY_MS = 60 * 60 * 1000;

interface Day {
	y: number;
	m: number;
	d: number;
}

/** utils/dikshaDate.ts: "DD/MM/YYYY" (or Y-M-D / D-M-Y) → day, null if unreadable. */
function parseDikshaDate(value: unknown): Day | null {
	if (typeof value !== "string") return null;
	const parts = value.trim().split(/[/-]/);
	if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
	const [a, b, c] = parts.map(Number);
	const [y, m, d] = parts[0].length === 4 ? [a, b, c] : [c, b, a];
	if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
	return { y, m, d };
}
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
function anniversaryYears(diksha: Day | null, today: Day): number {
	if (!diksha || diksha.y >= today.y) return 0;
	const sameDay = diksha.m === today.m && diksha.d === today.d;
	const leapDayMoved = diksha.m === 2 && diksha.d === 29 && today.m === 2 && today.d === 28 && !isLeap(today.y);
	return sameDay || leapDayMoved ? today.y - diksha.y : 0;
}
/** Today in India — the day the list was made for. */
function istToday(): Day & { id: string } {
	const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
	const y = ist.getUTCFullYear();
	const m = ist.getUTCMonth() + 1;
	const d = ist.getUTCDate();
	const pad = (n: number) => String(n).padStart(2, "0");
	return { y, m, d, id: `${y}-${pad(m)}-${pad(d)}` };
}

/** Today's list: one read a day per device (cached), none when offline. */
function useTodaysAnniversaries(dayId: string) {
	const [devotees, setDevotees] = useState<AnniversaryEntry[]>(() => {
		const cached = getObject<Cached>(CACHE_KEY);
		return cached?.id === dayId ? cached.devotees : [];
	});
	useEffect(() => {
		const cached = getObject<Cached>(CACHE_KEY);
		if (cached?.id === dayId && (cached.devotees.length > 0 || Date.now() - cached.fetchedAt < EMPTY_RETRY_MS)) {
			setDevotees(cached.devotees);
			return;
		}
		let cancelled = false;
		getDoc(doc(getFirestore(), "diksha_anniversaries", dayId))
			.then((snap) => {
				const list = snap.exists() ? (snap.data()?.devotees as AnniversaryEntry[] | undefined) : undefined;
				const clean = Array.isArray(list) ? list.filter((d) => d && typeof d.name === "string") : [];
				setObject(CACHE_KEY, { id: dayId, fetchedAt: Date.now(), devotees: clean });
				if (!cancelled) setDevotees(clean);
			})
			.catch((e: { code?: string }) => {
				if (!String(e?.code ?? "").includes("permission-denied")) return;
				setObject(CACHE_KEY, { id: dayId, fetchedAt: Date.now(), devotees: [] });
			});
		return () => {
			cancelled = true;
		};
	}, [dayId]);
	return devotees;
}

function Avatar({ name, photoURL, isDark }: { name: string; photoURL?: string; isDark: boolean }) {
	const [src, setSrc] = useState(photoURL ? thumbUrl(photoURL, THUMB.small) : undefined);
	return (
		<View
			style={[
				styles.avatar,
				{ borderColor: isDark ? "rgba(255,213,79,0.6)" : gold[300], backgroundColor: isDark ? ink[700] : cream[100] },
			]}
			pointerEvents="none"
		>
			{src ? (
				<Image
					source={{ uri: src }}
					style={StyleSheet.absoluteFill}
					contentFit="cover"
					onError={() => setSrc(src !== photoURL ? photoURL : undefined)}
				/>
			) : null}
			{!photoURL ? (
				<Text style={[styles.initial, { color: isDark ? gold[300] : krishna[600] }]}>{name.trim().charAt(0).toUpperCase()}</Text>
			) : null}
		</View>
	);
}

const mandalLabel = (d: AnniversaryEntry, isHindi: boolean) => {
	if (d.mandalId === "custom") return d.customMandalName || "";
	const m = MANDAL_LIST.find((x) => x.id === d.mandalId);
	return m ? (isHindi ? m.shortNameHi : m.shortNameEn) : "";
};

export function DikshaAnniversaryCard({
	isHindi,
	isDark,
	entering,
}: {
	isHindi: boolean;
	isDark: boolean;
	entering?: AnimatedProps<object>["entering"];
}) {
	const today = istToday();
	const devotees = useTodaysAnniversaries(today.id);
	const profile = useProfileStore((s) => s.profile);
	const myYears = profile?.isApproved && !profile.isAspiring ? anniversaryYears(parseDikshaDate(profile.dikshaDate), today) : 0;
	if (devotees.length === 0 && myYears < 1) return null;

	const muted = isDark ? ink[300] : ink[600];
	return (
		<Animated.View
			entering={entering}
			style={[styles.card, { borderColor: isDark ? "rgba(255,213,79,0.25)" : "rgba(255,213,79,0.6)" }]}
		>
			<LinearGradient colors={isDark ? [ink[800], "rgba(15,34,66,0.8)"] : [cream[50], cream[100]]} style={StyleSheet.absoluteFill} />
			<View style={styles.head}>
				<View style={[styles.flower, { backgroundColor: isDark ? "rgba(255,213,79,0.1)" : gold[100] }]}>
					<Flower2 size={22} color={isDark ? gold[300] : gold[700]} />
				</View>
				<Text style={[styles.title, { color: isDark ? gold[300] : krishna[700] }]}>
					{isHindi ? "आज दीक्षा वर्षगांठ" : "Diksha anniversary today"}
				</Text>
				{myYears >= 1 ? (
					<View
						style={[
							styles.mine,
							{
								borderColor: isDark ? "rgba(255,213,79,0.4)" : gold[300],
								backgroundColor: isDark ? "rgba(255,213,79,0.1)" : gold[50],
							},
						]}
					>
						<Text style={[styles.mineTitle, { color: isDark ? gold[200] : gold[800] }]}>
							{isHindi
								? `🌸 आज आपकी दीक्षा को ${myYears} वर्ष पूर्ण हुए!`
								: `🌸 Today marks ${myYears} ${myYears === 1 ? "year" : "years"} since your diksha!`}
						</Text>
						<Text style={[styles.small, { color: muted, marginTop: 4 }]}>
							{isHindi
								? "गुरु महाराज जी की कृपा और प्रेम सदा आप पर बरसता रहे। राधेश्याम 🙏"
								: "May Guru Maharaj Ji's grace and love always be with you. Radheshyam 🙏"}
						</Text>
					</View>
				) : null}
				{devotees.length > 0 ? (
					<Text style={[styles.small, { color: muted, marginTop: 8, textAlign: "center" }]}>
						{isHindi
							? "आज इन भक्तों की दीक्षा वर्षगांठ है — सभी को हार्दिक बधाई! राधेश्याम 🙏"
							: "Today is the diksha anniversary of these devotees — heartfelt wishes to all! Radheshyam 🙏"}
					</Text>
				) : null}
			</View>
			{devotees.length > 0 ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
					{devotees.map((d, i) => (
						<View key={`${d.name}-${i}`} style={styles.person}>
							<Avatar name={d.name} photoURL={d.photoURL} isDark={isDark} />
							<Text style={[styles.name, { color: isDark ? cream[50] : ink[900] }]} numberOfLines={2}>
								{d.name}
							</Text>
							{mandalLabel(d, isHindi) ? (
								<Text style={[styles.mandal, { color: isDark ? ink[400] : ink[500] }]} numberOfLines={1}>
									{mandalLabel(d, isHindi)}
								</Text>
							) : null}
							<View
								style={[
									styles.years,
									{
										backgroundColor: isDark ? "rgba(255,213,79,0.1)" : gold[100],
										borderColor: isDark ? "rgba(255,213,79,0.25)" : "rgba(255,213,79,0.6)",
									},
								]}
							>
								<Text style={[styles.yearsText, { color: isDark ? gold[300] : gold[800] }]}>
									{isHindi ? `${d.years} वर्ष` : `${d.years} ${d.years === 1 ? "year" : "years"}`}
								</Text>
							</View>
						</View>
					))}
				</ScrollView>
			) : null}
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	card: { borderRadius: 24, borderWidth: 1, overflow: "hidden", elevation: 4 },
	head: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, alignItems: "center" },
	flower: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 8 },
	title: { fontFamily: serif, fontSize: 18, fontWeight: "600" },
	mine: { marginTop: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, alignSelf: "stretch" },
	mineTitle: { fontSize: 14, fontWeight: "700", lineHeight: 21, textAlign: "center" },
	small: { fontSize: 12, lineHeight: 18, textAlign: "center" },
	strip: { gap: 12, paddingHorizontal: 20, paddingBottom: 20 },
	person: { width: 96, alignItems: "center" },
	avatar: {
		width: 64,
		height: 64,
		borderRadius: 32,
		borderWidth: 3,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "center",
		elevation: 3,
	},
	initial: { fontSize: 20, fontWeight: "700" },
	name: { marginTop: 6, fontSize: 12, fontWeight: "700", lineHeight: 15, textAlign: "center" },
	mandal: { fontSize: 10, lineHeight: 13, textAlign: "center" },
	years: { marginTop: 4, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
	yearsText: { fontSize: 10, fontWeight: "700" },
});

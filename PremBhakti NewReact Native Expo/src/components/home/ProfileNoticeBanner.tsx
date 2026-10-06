import { AlertTriangle, ChevronRight, UserPlus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { triggerHaptic } from "../../lib/haptics";
import { useAuthStore } from "../../store/authStore";
import { rejectionAlerts, useProfileStore } from "../../store/profileStore";

// ProfileNoticeBanner of the Capacitor Home: the devotee's profile (or a
// family member they added) was sent back by the admins, with the reason, and
// family link requests waiting for an answer. Warm yellow: it asks for a fix,
// it is not an error. Nothing when all is well.

const SHOWN = 3;

const AMBER = {
	light: { border: "#FCD34D", bg: "#FFFBEB", iconBg: "#FEF3C7", icon: "#D97706", title: "#78350F", text: "rgba(120,53,15,0.9)", more: "rgba(146,64,14,0.8)", link: "#B45309" },
	dark: { border: "rgba(245,158,11,0.4)", bg: "rgba(245,158,11,0.1)", iconBg: "rgba(245,158,11,0.2)", icon: "#FCD34D", title: "#FDE68A", text: "rgba(254,243,199,0.9)", more: "rgba(253,230,138,0.7)", link: "#FCD34D" },
};
const BLUE = {
	light: { border: "#BFDBFE", bg: "#EFF6FF", iconBg: "#DBEAFE", icon: "#2563EB", title: "#1E3A8A", text: "rgba(30,64,175,0.8)", chevron: "#3B82F6" },
	dark: { border: "rgba(59,130,246,0.3)", bg: "rgba(59,130,246,0.1)", iconBg: "rgba(59,130,246,0.2)", icon: "#93C5FD", title: "#DBEAFE", text: "rgba(191,219,254,0.7)", chevron: "#93C5FD" },
};

export function ProfileNoticeBanner({ isHindi, isDark, onOpenProfile }: { isHindi: boolean; isDark: boolean; onOpenProfile: () => void }) {
	const user = useAuthStore((s) => s.user);
	const profile = useProfileStore((s) => s.profile);
	const requests = useProfileStore((s) => s.pendingFamilyRequests);
	if (!user) return null;
	const alerts = rejectionAlerts(profile);
	if (alerts.length === 0 && requests === 0) return null;

	const open = () => {
		triggerHaptic("light");
		onOpenProfile();
	};
	const a = isDark ? AMBER.dark : AMBER.light;
	const b = isDark ? BLUE.dark : BLUE.light;

	return (
		<View style={styles.wrap}>
			{alerts.length > 0 ? (
				<Pressable onPress={open} style={({ pressed }) => [styles.box, { borderColor: a.border, backgroundColor: a.bg }, pressed && styles.pressed]}>
					<View style={styles.headRow}>
						<View style={[styles.icon, { backgroundColor: a.iconBg }]}>
							<AlertTriangle size={17} color={a.icon} />
						</View>
						<Text style={[styles.headText, { color: a.title }]}>
							{alerts.length === 1 && alerts[0].kind === "self"
								? isHindi
									? "आपकी प्रोफ़ाइल में सुधार ज़रूरी है"
									: "Your profile needs changes"
								: isHindi
									? "प्रोफ़ाइल में सुधार ज़रूरी है"
									: "Profile changes needed"}
						</Text>
					</View>
					{alerts.slice(0, SHOWN).map((al) => (
						<Text key={al.memberId || "self"} style={[styles.item, { color: a.text }]}>
							<Text style={styles.bold}>
								{al.kind === "self"
									? isHindi
										? "आपकी प्रोफ़ाइल"
										: "Your profile"
									: isHindi
										? `${al.name || "परिवार सदस्य"} (परिवार सदस्य)`
										: `${al.name || "Family member"} (family member)`}
							</Text>
							{al.note ? (
								<>
									{isHindi ? " — कारण: " : " — reason: "}
									<Text style={styles.italic}>“{al.note}”</Text>
								</>
							) : isHindi ? (
								" — स्वीकार नहीं हुई"
							) : (
								" — not approved"
							)}
						</Text>
					))}
					{alerts.length > SHOWN ? (
						<Text style={[styles.more, { color: a.more }]}>
							{isHindi ? `+${alerts.length - SHOWN} और` : `+${alerts.length - SHOWN} more`}
						</Text>
					) : null}
					<View style={styles.linkRow}>
						<Text style={[styles.link, { color: a.link }]}>{isHindi ? "प्रोफ़ाइल खोलकर ठीक करें" : "Open profile to fix"}</Text>
						<ChevronRight size={14} color={a.link} />
					</View>
				</Pressable>
			) : null}

			{requests > 0 ? (
				<Pressable
					onPress={open}
					style={({ pressed }) => [styles.box, styles.requestRow, { borderColor: b.border, backgroundColor: b.bg }, pressed && styles.pressed]}
				>
					<View style={[styles.icon, { backgroundColor: b.iconBg }]}>
						<UserPlus size={16} color={b.icon} />
					</View>
					<View style={styles.flex}>
						<Text style={[styles.headText, { color: b.title }]}>
							{isHindi
								? `${requests} परिवार लिंक अनुरोध आया है`
								: `${requests} family link request${requests > 1 ? "s" : ""} waiting`}
						</Text>
						<Text style={[styles.sub, { color: b.text }]}>
							{isHindi
								? "कोई आपको अपने परिवार में जोड़ना चाहते हैं — देखें और जवाब दें"
								: "Someone wants to add you to their family — see and answer"}
						</Text>
					</View>
					<ChevronRight size={18} color={b.chevron} />
				</Pressable>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: 8 },
	box: { borderRadius: 16, borderWidth: 1, padding: 14, elevation: 1 },
	pressed: { transform: [{ scale: 0.99 }] },
	headRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
	icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
	headText: { flexShrink: 1, fontWeight: "700", fontSize: 14, lineHeight: 19 },
	item: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
	bold: { fontWeight: "700" },
	italic: { fontStyle: "italic" },
	more: { fontSize: 12 },
	linkRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
	link: { fontSize: 12, fontWeight: "700" },
	requestRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
	flex: { flex: 1, minWidth: 0 },
	sub: { fontSize: 12, lineHeight: 16 },
});

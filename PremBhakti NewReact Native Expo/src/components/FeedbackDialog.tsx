import { MessageCircle, User, Users, X } from "lucide-react-native";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSettingsStore } from "../store/settingsStore";
import { cream, gold, ink } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

/** `gold-600` with alpha. */
const gold600A = (a: number) => `rgba(176, 131, 19, ${a})`;

const T = {
	en: {
		title: "Send Feedback",
		subtitle: "Select a contact to message on WhatsApp",
		headDev: "Head Developer",
		director: "Director",
		narayan: "Narayan Das",
		cancel: "Cancel",
	},
	hi: {
		title: "सुझाव भेजें",
		subtitle: "व्हाट्सएप पर संदेश भेजने के लिए संपर्क चुनें",
		headDev: "मुख्य डेवलपर",
		director: "निदेशक",
		narayan: "नारायण दास",
		cancel: "रद्द करें",
	},
};
type Strings = (typeof T)["en"];

const CONTACTS = [
	{ number: "9826154640", display: "+91 98261 54640", icon: User, name: () => "ShreeNath Das", role: (t: Strings) => t.headDev },
	{ number: "8871077732", display: "+91 88710 77732", icon: Users, name: (t: Strings) => t.narayan, role: (t: Strings) => t.director },
];

/** components/FeedbackModal.tsx: pick a contact, open their WhatsApp chat. */
export function FeedbackDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
	const theme = useAppTheme();
	const dark = theme.isDark;
	const t = T[useSettingsStore((s) => s.settingsLanguage)];
	return (
		<Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
			<View style={styles.center}>
				<Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
				<View style={[styles.card, { backgroundColor: dark ? ink[800] : cream[25], borderColor: gold600A(0.2) }]}>
					<Pressable hitSlop={8} onPress={onClose} style={styles.close}>
						<X size={20} color={ink[400]} />
					</Pressable>
					<View style={styles.head}>
						<View style={[styles.headIcon, { backgroundColor: gold600A(0.1) }]}>
							<MessageCircle size={24} color={gold[700]} />
						</View>
						<Text style={[styles.title, { color: dark ? "#fff" : gold[700] }]}>{t.title}</Text>
						<Text style={[styles.subtitle, { color: dark ? ink[400] : ink[500] }]}>{t.subtitle}</Text>
					</View>
					<View style={styles.list}>
						{CONTACTS.map((c) => (
							<Pressable
								key={c.number}
								onPress={() => {
									Linking.openURL(`https://wa.me/91${c.number}`).catch(() => {});
									onClose();
								}}
								style={({ pressed }) => [
									styles.contact,
									{
										backgroundColor: dark ? "rgba(22, 48, 92, 0.5)" : "#fff",
										borderColor: pressed ? gold600A(0.6) : gold600A(0.2),
									},
									pressed && styles.pressed,
								]}
							>
								<View style={[styles.contactIcon, { backgroundColor: gold600A(0.1) }]}>
									<c.icon size={20} color={gold[700]} />
								</View>
								<View style={styles.flex}>
									<Text style={[styles.name, { color: dark ? ink[200] : ink[700] }]} numberOfLines={1}>
										{c.name(t)}
									</Text>
									<Text style={[styles.role, { color: dark ? ink[400] : ink[500] }]}>{c.role(t)}</Text>
									<Text style={[styles.phone, { color: dark ? ink[500] : ink[400] }]}>{c.display}</Text>
								</View>
							</Pressable>
						))}
					</View>
					<Pressable
						onPress={onClose}
						style={({ pressed }) => [styles.cancel, pressed && { backgroundColor: dark ? ink[700] : ink[100] }]}
					>
						<Text style={[styles.cancelText, { color: dark ? ink[300] : ink[500] }]}>{t.cancel}</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	pressed: { transform: [{ scale: 0.95 }] },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
	backdrop: { backgroundColor: "rgba(0, 0, 0, 0.6)" },
	card: { width: "100%", maxWidth: 320, borderRadius: 16, borderWidth: 1, padding: 24, elevation: 16 },
	close: { position: "absolute", top: 16, right: 16, padding: 4, zIndex: 1 },
	head: { alignItems: "center", marginBottom: 24 },
	headIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 12 },
	title: { fontSize: 20, fontWeight: "700" },
	subtitle: { fontSize: 12, marginTop: 4, textAlign: "center" },
	list: { gap: 12 },
	contact: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: 12, borderWidth: 1, elevation: 1 },
	contactIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
	name: { fontSize: 16, fontWeight: "700" },
	role: { fontSize: 12, fontWeight: "500" },
	phone: { fontSize: 10, fontFamily: "monospace", marginTop: 2 },
	cancel: { marginTop: 24, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
	cancelText: { fontSize: 14, fontWeight: "700" },
});

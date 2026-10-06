import { useNavigation } from "@react-navigation/native";
import { CheckCircle2, CloudDownload, HardDrive, LogIn, RefreshCw, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
	backupNow,
	DRIVE_FILE_NAME,
	DRIVE_FOLDER_NAME,
	getDriveAccessToken,
	getDriveBackupInfo,
	getLastDriveBackupAt,
	onDriveBackupSaved,
	restoreFromDrive,
} from "../lib/backup";
import type { RootNavigation } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import { gold, ink } from "../theme/colors";
import { useAppTheme } from "../theme/useAppTheme";

// components/BackupRestoreSection.tsx: the Google Drive backup status with its
// one action, "Bring back data", and the turn-on / restore sheet. Signed out,
// it asks to log in first. Settings shows it bare (hideTitle); History and the
// Audio tab's playlists show it `titled`, with its heading and a rule below.

const gold600A = (a: number) => `rgba(176, 131, 19, ${a})`;
const EMERALD = { 600: "#059669", 700: "#047857", 300: "#6ee7b7" };

const formatWhen = (ts: number, isHindi: boolean) => {
	const mins = Math.round((Date.now() - ts) / 60000);
	if (mins < 1) return isHindi ? "अभी" : "just now";
	if (mins < 60) return isHindi ? `${mins} मिनट पहले` : `${mins} min ago`;
	return new Date(ts).toLocaleString(isHindi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

type DriveInfo = { state: "checking" } | { state: "unknown" } | { state: "none" } | { state: "found"; savedAt: number | null };

export function BackupRestoreSection({ titled = false }: { titled?: boolean }) {
	const isHindi = useSettingsStore((s) => s.settingsLanguage) === "hi";
	if (!titled) return <BackupRestoreBody />;
	return (
		<View style={[styles.titled, { borderBottomColor: gold600A(0.2) }]}>
			<Text style={styles.heading}>{isHindi ? "बैकअप और रिस्टोर" : "BACKUP & RESTORE"}</Text>
			<BackupRestoreBody />
		</View>
	);
}

function BackupRestoreBody() {
	const theme = useAppTheme();
	const dark = theme.isDark;
	const navigation = useNavigation<RootNavigation>();
	const user = useAuthStore((s) => s.user);
	const ready = useAuthStore((s) => s.ready);
	const isHindi = useSettingsStore((s) => s.settingsLanguage) === "hi";
	const [sheet, setSheet] = useState<"backup" | "restore" | null>(null);
	const [busy, setBusy] = useState<null | "save" | "restore">(null);
	const [lastSavedAt, setLastSavedAt] = useState(getLastDriveBackupAt);
	const [driveInfo, setDriveInfo] = useState<DriveInfo>({ state: "unknown" });
	const isOn = lastSavedAt !== null;

	const t = {
		onTitle: isHindi ? "Google Drive बैकअप चालू है" : "Google Drive backup is on",
		offTitle: isHindi ? "Google Drive बैकअप बंद है" : "Google Drive backup is off",
		offSub: isHindi ? "एक बार चालू करें, फिर ऐप अपने-आप बैकअप लेता रहेगा" : "Turn it on once — the app then keeps it saved by itself",
		lastSaved: isHindi ? "आख़िरी बैकअप" : "Last backup",
		backupNow: isHindi ? "अभी बैकअप लें" : "Back up now",
		turnOn: isHindi ? "चालू करें" : "Turn on",
		restoreData: isHindi ? "Google Drive से डेटा वापस लाएँ" : "Bring back data from Google Drive",
		restoreSub: isHindi ? "नया फ़ोन या ऐप दोबारा इंस्टॉल करने पर" : "After a new phone or reinstall",
		cancel: isHindi ? "रद्द करें" : "Cancel",
		driveInfoTitle: isHindi ? "Google Drive बैकअप चालू करें" : "Turn on Google Drive backup",
		driveInfo: isHindi
			? `आपकी प्लेलिस्ट, बुकमार्क, इतिहास और सेटिंग्स आपके अपने Google Drive में "${DRIVE_FOLDER_NAME}" फ़ोल्डर में सहेजी जाएंगी।\n\nअगली स्क्रीन पर Google अनुमति मांगेगा — "Allow / अनुमति दें" दबाएँ। उसके बाद ऐप अपने-आप बैकअप लेता रहेगा, और नए फ़ोन पर लॉगिन करते ही आपका डेटा वापस आ जाएगा।`
			: `Your playlists, bookmarks, history and settings are saved in your own Google Drive, in the "${DRIVE_FOLDER_NAME}" folder.\n\nGoogle asks for permission on the next screen — tap "Allow". After that the app keeps the backup up to date by itself, and on a new phone your data comes back as soon as you log in.`,
		restoreTitle: isHindi ? "डेटा वापस लाएँ" : "Bring back your data",
		restoreInfo: isHindi
			? "Google Drive वाले बैकअप से प्लेलिस्ट, बुकमार्क, इतिहास और सेटिंग्स वापस आ जाएंगी। इस फ़ोन का अभी का डेटा बैकअप वाले से बदल जाएगा।"
			: "Brings back playlists, bookmarks, history and settings from your Google Drive backup. This device's current data is replaced by the backup.",
		checking: isHindi ? "Drive में बैकअप देखा जा रहा है…" : "Looking for your backup…",
		foundOn: isHindi ? "Drive में बैकअप" : "Drive backup from",
		noneFound: isHindi ? "Drive में अभी कोई बैकअप नहीं मिला" : "No backup on Drive yet",
		restoreNow: isHindi ? "वापस लाएँ" : "Bring back",
		loginRequired: isHindi ? "लॉगिन आवश्यक है" : "Login Required",
		loginRequiredDesc: isHindi
			? "बैकअप और रिस्टोर के लिए कृपया पहले प्रोफ़ाइल में लॉगिन करें।"
			: "Please log in to your Profile to use Backup & Restore.",
		goToLogin: isHindi ? "प्रोफ़ाइल पर जाएं → लॉगिन करें" : "Go to Profile & Login",
	};

	useEffect(() => {
		const refresh = () => setLastSavedAt(getLastDriveBackupAt());
		refresh();
		const tick = setInterval(refresh, 30000);
		const off = onDriveBackupSaved(refresh);
		return () => {
			clearInterval(tick);
			off();
		};
	}, []);

	// The restore sheet says when the Drive backup was made — only when Google
	// gives a token without any UI.
	useEffect(() => {
		if (sheet !== "restore") return;
		let cancelled = false;
		setDriveInfo({ state: "checking" });
		(async (): Promise<DriveInfo> => {
			const token = await getDriveAccessToken(false).catch(() => null);
			if (!token) return { state: "unknown" };
			const info = await getDriveBackupInfo(token);
			if (!info) return { state: "none" };
			const savedAt = info.modifiedTime ? Date.parse(info.modifiedTime) : Number.NaN;
			return { state: "found", savedAt: Number.isFinite(savedAt) ? savedAt : null };
		})()
			.catch((): DriveInfo => ({ state: "unknown" }))
			.then((next) => !cancelled && setDriveInfo(next));
		return () => {
			cancelled = true;
		};
	}, [sheet]);

	if (!ready) return <View style={{ minHeight: 80 }} />;

	if (!user) {
		return (
			<View style={[styles.loginCard, { borderColor: gold600A(0.25), backgroundColor: dark ? "rgba(15, 34, 66, 0.6)" : gold600A(0.05) }]}>
				<View style={[styles.loginIcon, { backgroundColor: gold600A(0.15) }]}>
					<LogIn size={22} color={gold[700]} />
				</View>
				<View>
					<Text style={[styles.loginTitle, { color: dark ? ink[200] : ink[700] }]}>{t.loginRequired}</Text>
					<Text style={[styles.loginDesc, { color: dark ? ink[400] : ink[500] }]}>{t.loginRequiredDesc}</Text>
				</View>
				<Pressable
					onPress={() => navigation.navigate("Login")}
					style={({ pressed }) => [styles.loginButton, { backgroundColor: pressed ? gold[700] : gold[600] }, pressed && styles.pressed]}
				>
					<LogIn size={15} color="#fff" />
					<Text style={styles.loginButtonText}>{t.goToLogin}</Text>
				</Pressable>
			</View>
		);
	}

	const save = async (fromSheet: boolean) => {
		setBusy("save");
		const ok = await backupNow();
		setBusy(null);
		if (ok && fromSheet) setSheet(null);
	};
	const restore = async () => {
		setBusy("restore");
		const ok = await restoreFromDrive();
		setBusy(null);
		if (ok) setSheet(null);
	};

	return (
		<View>
			<View
				style={[
					styles.status,
					isOn
						? { borderColor: "rgba(16, 185, 129, 0.25)", backgroundColor: dark ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.05)" }
						: { borderColor: gold600A(0.25), backgroundColor: dark ? "rgba(15, 34, 66, 0.6)" : gold600A(0.05) },
				]}
			>
				{isOn ? <CheckCircle2 size={20} color={EMERALD[600]} /> : <HardDrive size={20} color={gold[700]} />}
				<View style={styles.flex}>
					<Text style={[styles.statusTitle, { color: dark ? ink[200] : ink[700] }]}>{isOn ? t.onTitle : t.offTitle}</Text>
					<Text style={[styles.statusSub, { color: dark ? ink[400] : ink[500] }]}>
						{lastSavedAt ? `${t.lastSaved}: ${formatWhen(lastSavedAt, isHindi)}` : t.offSub}
					</Text>
				</View>
				{isOn ? (
					<Pressable
						onPress={() => save(false)}
						disabled={busy !== null}
						style={({ pressed }) => [
							styles.nowButton,
							{ backgroundColor: dark ? ink[800] : "#fff" },
							pressed && styles.pressed,
							busy !== null && styles.dim,
						]}
					>
						{busy === "save" ? <ActivityIndicator size={12} color={EMERALD[700]} /> : <RefreshCw size={12} color={dark ? EMERALD[300] : EMERALD[700]} />}
						<Text style={[styles.nowText, { color: dark ? EMERALD[300] : EMERALD[700] }]}>{t.backupNow}</Text>
					</Pressable>
				) : (
					<Pressable
						onPress={() => setSheet("backup")}
						disabled={busy !== null}
						style={({ pressed }) => [styles.onButton, { backgroundColor: pressed ? gold[700] : gold[600] }, pressed && styles.pressed]}
					>
						<Text style={styles.onText}>{t.turnOn}</Text>
					</Pressable>
				)}
			</View>

			<Pressable
				onPress={() => setSheet("restore")}
				disabled={busy !== null}
				style={({ pressed }) => [
					styles.restoreRow,
					{ backgroundColor: dark ? ink[800] : pressed ? gold600A(0.05) : "transparent", borderColor: gold600A(0.2) },
					busy !== null && styles.dim,
				]}
			>
				<View style={[styles.restoreIcon, { backgroundColor: dark ? ink[700] : gold600A(0.1) }]}>
					<CloudDownload size={20} color={gold[700]} />
				</View>
				<View style={styles.flex}>
					<Text style={[styles.restoreTitle, { color: dark ? ink[300] : ink[700] }]}>{t.restoreData}</Text>
					<Text style={[styles.restoreSub, { color: ink[400] }]}>{t.restoreSub}</Text>
				</View>
			</Pressable>

			<Modal visible={sheet !== null} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setSheet(null)}>
				<View style={styles.center}>
					<Pressable accessibilityLabel={t.cancel} style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={() => setSheet(null)} />
					<View style={[styles.sheet, { backgroundColor: dark ? ink[900] : "#fff", borderColor: gold600A(0.2) }]}>
						<Pressable accessibilityLabel={t.cancel} hitSlop={8} onPress={() => setSheet(null)} style={styles.sheetClose}>
							<X size={20} color={ink[400]} />
						</Pressable>
						<Text style={[styles.sheetTitle, { color: dark ? ink[100] : ink[800] }]}>
							{sheet === "backup" ? t.driveInfoTitle : t.restoreTitle}
						</Text>
						<Text style={[styles.sheetText, { color: dark ? ink[400] : ink[600] }]}>{sheet === "backup" ? t.driveInfo : t.restoreInfo}</Text>
						{sheet === "restore" && driveInfo.state !== "unknown" ? (
							<View style={[styles.infoRow, { backgroundColor: dark ? ink[800] : ink[50] }]}>
								{driveInfo.state === "checking" ? <ActivityIndicator size={14} color={ink[500]} /> : <HardDrive size={14} color={gold[700]} />}
								<Text style={[styles.infoText, { color: dark ? ink[300] : ink[600] }]}>
									{driveInfo.state === "checking"
										? t.checking
										: driveInfo.state === "none"
											? t.noneFound
											: driveInfo.savedAt
												? `${t.foundOn}: ${formatWhen(driveInfo.savedAt, isHindi)}`
												: `${DRIVE_FOLDER_NAME} / ${DRIVE_FILE_NAME}`}
								</Text>
							</View>
						) : null}
						<View style={styles.sheetActions}>
							<Pressable onPress={() => setSheet(null)} style={[styles.sheetCancel, { backgroundColor: dark ? ink[800] : ink[100] }]}>
								<Text style={[styles.sheetCancelText, { color: dark ? ink[200] : ink[800] }]}>{t.cancel}</Text>
							</Pressable>
							<Pressable
								onPress={() => (sheet === "backup" ? save(true) : restore())}
								disabled={busy !== null || (sheet === "restore" && driveInfo.state === "none")}
								style={({ pressed }) => [
									styles.sheetGo,
									{ backgroundColor: pressed ? gold[700] : gold[600] },
									(busy !== null || (sheet === "restore" && driveInfo.state === "none")) && styles.dim,
								]}
							>
								{busy !== null ? <ActivityIndicator size={16} color="#fff" /> : null}
								<Text style={styles.sheetGoText}>{sheet === "backup" ? t.turnOn : t.restoreNow}</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	// mb-8 pb-6 border-b border-gold-600/20 px-4 mt-6, and the h3 above the card.
	titled: { marginTop: 24, marginBottom: 32, paddingBottom: 24, paddingHorizontal: 16, borderBottomWidth: 1 },
	heading: { fontSize: 14, fontWeight: "700", color: gold[700], letterSpacing: 0.7, marginBottom: 12 },
	flex: { flex: 1, minWidth: 0 },
	pressed: { transform: [{ scale: 0.95 }] },
	dim: { opacity: 0.6 },
	loginCard: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center", gap: 12 },
	loginIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
	loginTitle: { fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 4 },
	loginDesc: { fontSize: 12, lineHeight: 19, textAlign: "center" },
	loginButton: {
		alignSelf: "stretch",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 10,
		borderRadius: 12,
		elevation: 2,
	},
	loginButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
	status: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 12 },
	statusTitle: { fontSize: 12, fontWeight: "700" },
	statusSub: { fontSize: 11, lineHeight: 15 },
	nowButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: "rgba(16, 185, 129, 0.3)",
	},
	nowText: { fontSize: 11, fontWeight: "700" },
	onButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, elevation: 2 },
	onText: { color: "#fff", fontSize: 12, fontWeight: "700" },
	restoreRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, elevation: 1 },
	restoreIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
	restoreTitle: { fontSize: 12, fontWeight: "700" },
	restoreSub: { fontSize: 11, lineHeight: 15 },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
	backdrop: { backgroundColor: "rgba(0, 0, 0, 0.6)" },
	sheet: { width: "100%", maxWidth: 384, borderRadius: 24, borderWidth: 1, padding: 24, elevation: 16 },
	sheetClose: { position: "absolute", top: 16, right: 16, zIndex: 1 },
	sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12, paddingRight: 24 },
	sheetText: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
	infoRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, marginBottom: 16 },
	infoText: { flex: 1, fontSize: 12 },
	sheetActions: { flexDirection: "row", gap: 12 },
	sheetCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
	sheetCancelText: { fontSize: 16, fontWeight: "500" },
	sheetGo: { flex: 1, flexDirection: "row", gap: 8, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", elevation: 3 },
	sheetGoText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

import {
	CheckCircle2,
	CloudDownload,
	HardDrive,
	Loader2,
	LogIn,
	RefreshCw,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import {
	getLastDriveBackupAt,
	onDriveBackupSaved,
} from "../utils/backup/driveAutoBackup";
import {
	DRIVE_FILE_NAME,
	DRIVE_FOLDER_NAME,
	getDriveAccessToken,
	getDriveBackupInfo,
} from "../utils/backup/driveBackup";

interface BackupRestoreSectionProps {
	settingsLanguage: "en" | "hi";
	hideTitle?: boolean;
}

const formatWhen = (ts: number, isHindi: boolean) => {
	const mins = Math.round((Date.now() - ts) / 60000);
	if (mins < 1) return isHindi ? "अभी" : "just now";
	if (mins < 60) return isHindi ? `${mins} मिनट पहले` : `${mins} min ago`;
	return new Date(ts).toLocaleString(isHindi ? "hi-IN" : "en-IN", {
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});
};

/** What the restore sheet knows about the backup on Drive. */
type DriveInfo =
	| { state: "checking" }
	| { state: "unknown" }
	| { state: "none" }
	| { state: "found"; savedAt: number | null };

export const BackupRestoreSection: React.FC<BackupRestoreSectionProps> = ({
	settingsLanguage,
	hideTitle,
}) => {
	const { backupUserData, restoreFromCloud } = useData();
	const { user, loading: authLoading } = useAuth();
	const [activeInfoType, setActiveInfoType] = useState<
		"backup" | "restore" | null
	>(null);
	const [busy, setBusy] = useState<null | "save" | "restore">(null);
	const [lastSavedAt, setLastSavedAt] = useState<number | null>(() =>
		getLastDriveBackupAt(),
	);
	const [driveInfo, setDriveInfo] = useState<DriveInfo>({ state: "unknown" });

	const isHindi = settingsLanguage === "hi";
	const isLoggedIn = !!user;
	const isOn = lastSavedAt !== null;

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

	// The restore sheet shows when the Drive backup was made — only when Google
	// gives a token without any UI; otherwise it simply doesn't say.
	useEffect(() => {
		if (activeInfoType !== "restore") return;
		let cancelled = false;
		setDriveInfo({ state: "checking" });
		(async () => {
			const token = await getDriveAccessToken(false).catch(() => null);
			if (!token) return { state: "unknown" } as DriveInfo;
			const info = await getDriveBackupInfo(token);
			if (!info) return { state: "none" } as DriveInfo;
			const savedAt = info.modifiedTime ? Date.parse(info.modifiedTime) : NaN;
			return {
				state: "found",
				savedAt: Number.isFinite(savedAt) ? savedAt : null,
			} as DriveInfo;
		})()
			.catch(() => ({ state: "unknown" }) as DriveInfo)
			.then((next) => !cancelled && setDriveInfo(next));
		return () => {
			cancelled = true;
		};
	}, [activeInfoType]);

	useEffect(() => {
		if (activeInfoType) {
			const id = `info-backup-${Date.now()}`;
			window.history.pushState({ isPopup: true, modalId: id }, "");
			const handler = () => setActiveInfoType(null);
			window.addEventListener("popstate", handler);
			return () => {
				window.removeEventListener("popstate", handler);
				if (window.history.state?.modalId === id) window.history.back();
			};
		}
	}, [activeInfoType]);

	const closeSheet = () => window.history.back();

	const t = {
		backupRestore: isHindi ? "बैकअप और रिस्टोर" : "Backup & Restore",
		onTitle: isHindi ? "Google Drive बैकअप चालू है" : "Google Drive backup is on",
		offTitle: isHindi ? "Google Drive बैकअप बंद है" : "Google Drive backup is off",
		offSub: isHindi
			? "एक बार चालू करें, फिर ऐप अपने-आप बैकअप लेता रहेगा"
			: "Turn it on once — the app then keeps it saved by itself",
		lastSaved: isHindi ? "आख़िरी बैकअप" : "Last backup",
		backupNow: isHindi ? "अभी बैकअप लें" : "Back up now",
		turnOn: isHindi ? "चालू करें" : "Turn on",
		restoreData: isHindi
			? "Google Drive से डेटा वापस लाएँ"
			: "Bring back data from Google Drive",
		restoreSub: isHindi
			? "नया फ़ोन या ऐप दोबारा इंस्टॉल करने पर"
			: "After a new phone or reinstall",
		cancel: isHindi ? "रद्द करें" : "Cancel",
		driveInfoTitle: isHindi
			? "Google Drive बैकअप चालू करें"
			: "Turn on Google Drive backup",
		driveInfo: isHindi
			? `आपकी प्लेलिस्ट, बुकमार्क, इतिहास और सेटिंग्स आपके अपने Google Drive में "${DRIVE_FOLDER_NAME}" फ़ोल्डर में सहेजी जाएंगी।\n\nअगली स्क्रीन पर Google अनुमति मांगेगा — "Allow / अनुमति दें" दबाएँ। उसके बाद ऐप अपने-आप बैकअप लेता रहेगा, और नए फ़ोन पर लॉगिन करते ही आपका डेटा वापस आ जाएगा।`
			: `Your playlists, bookmarks, history and settings are saved in your own Google Drive, in the "${DRIVE_FOLDER_NAME}" folder.\n\nGoogle asks for permission on the next screen — tap "Allow". After that the app keeps the backup up to date by itself, and on a new phone your data comes back as soon as you log in.`,
		saveToDrive: isHindi ? "चालू करें" : "Turn on",
		restoreTitle: isHindi ? "डेटा वापस लाएँ" : "Bring back your data",
		restoreInfo: isHindi
			? "Google Drive वाले बैकअप से प्लेलिस्ट, बुकमार्क, इतिहास और सेटिंग्स वापस आ जाएंगी। इस फ़ोन का अभी का डेटा बैकअप वाले से बदल जाएगा।"
			: "Brings back playlists, bookmarks, history and settings from your Google Drive backup. This device's current data is replaced by the backup.",
		checking: isHindi
			? "Drive में बैकअप देखा जा रहा है…"
			: "Looking for your backup…",
		foundOn: isHindi ? "Drive में बैकअप" : "Drive backup from",
		noneFound: isHindi
			? "Drive में अभी कोई बैकअप नहीं मिला"
			: "No backup on Drive yet",
		restoreNow: isHindi ? "वापस लाएँ" : "Bring back",
		loginRequired: isHindi ? "लॉगिन आवश्यक है" : "Login Required",
		loginRequiredDesc: isHindi
			? "बैकअप और रिस्टोर के लिए कृपया पहले प्रोफ़ाइल में लॉगिन करें।"
			: "Please log in to your Profile to use Backup & Restore.",
		goToLogin: isHindi ? "प्रोफ़ाइल पर जाएं → लॉगिन करें" : "Go to Profile & Login",
	};

	const wrapperClass = `mb-8 pb-6 border-b border-gold-600/20 px-4 mt-6 ${hideTitle ? "border-none !p-0 !m-0 mt-3" : ""}`;

	// Open profile screen via global event (App.tsx listens for this)
	const handleOpenProfile = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		window.dispatchEvent(new Event("cpbs:openProfile"));
	};

	const handleSave = async (fromSheet: boolean) => {
		setBusy("save");
		const ok = await backupUserData();
		setBusy(null);
		if (ok && fromSheet) closeSheet();
	};

	const handleRestore = async () => {
		setBusy("restore");
		// Reloads the app when it succeeds.
		const ok = await restoreFromCloud();
		if (!ok) setBusy(null);
	};

	// Still resolving auth state — render empty placeholder to avoid layout shift
	if (authLoading) {
		return <div className={wrapperClass} style={{ minHeight: 80 }} />;
	}

	// ── NOT LOGGED IN ─────────────────────────────────────────────────────────
	if (!isLoggedIn) {
		return (
			<div className={`${wrapperClass} relative z-10`}>
				{!hideTitle && (
					<h3 className="text-sm font-bold text-gold-700 uppercase tracking-wider mb-3">
						{t.backupRestore}
					</h3>
				)}
				<div className="rounded-2xl border border-gold-600/25 bg-gold-600/5 dark:bg-slate-800/60 p-5 flex flex-col items-center gap-3 text-center relative z-10">
					<div className="w-12 h-12 rounded-full bg-gold-600/15 flex items-center justify-center">
						<LogIn size={22} className="text-gold-700" />
					</div>
					<div>
						<p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
							{t.loginRequired}
						</p>
						<p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
							{t.loginRequiredDesc}
						</p>
					</div>
					<button
						type="button"
						onClick={handleOpenProfile}
						className="w-full py-2.5 bg-gold-600 hover:bg-gold-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2 relative z-20 cursor-pointer"
					>
						<LogIn size={15} />
						{t.goToLogin}
					</button>
				</div>
			</div>
		);
	}

	// ── LOGGED IN ─────────────────────────────────────────────────────────────
	return (
		<div className={wrapperClass}>
			{!hideTitle && (
				<h3 className="text-sm font-bold text-gold-700 uppercase tracking-wider mb-3">
					{t.backupRestore}
				</h3>
			)}

			{/* Drive backup status + its one action */}
			<div
				className={`flex items-center gap-3 rounded-2xl border p-3 mb-3 ${isOn ? "border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10" : "border-gold-600/25 bg-gold-600/5 dark:bg-slate-800/60"}`}
			>
				{isOn ? (
					<CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
				) : (
					<HardDrive size={20} className="text-gold-700 shrink-0" />
				)}
				<div className="flex-1 min-w-0">
					<p className="text-xs font-bold text-slate-700 dark:text-slate-200">
						{isOn ? t.onTitle : t.offTitle}
					</p>
					<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
						{lastSavedAt
							? `${t.lastSaved}: ${formatWhen(lastSavedAt, isHindi)}`
							: t.offSub}
					</p>
				</div>
				{isOn ? (
					<button
						type="button"
						onClick={() => handleSave(false)}
						disabled={busy !== null}
						className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-500/30 active:scale-95 transition disabled:opacity-60"
					>
						{busy === "save" ? (
							<Loader2 size={12} className="animate-spin" />
						) : (
							<RefreshCw size={12} />
						)}
						{t.backupNow}
					</button>
				) : (
					<button
						type="button"
						onClick={() => setActiveInfoType("backup")}
						disabled={busy !== null}
						className="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white bg-gold-600 hover:bg-gold-700 shadow active:scale-95 transition disabled:opacity-60"
					>
						{t.turnOn}
					</button>
				)}
			</div>

			<button
				type="button"
				onClick={() => setActiveInfoType("restore")}
				disabled={busy !== null}
				className="group w-full flex items-center gap-3 p-3 bg-transparent dark:bg-slate-800 border border-gold-600/20 rounded-2xl hover:bg-gold-600/5 transition-colors shadow-sm text-left disabled:opacity-60"
			>
				<div className="w-10 h-10 shrink-0 bg-gold-600/10 dark:bg-slate-700 text-gold-700 rounded-full flex items-center justify-center">
					<CloudDownload size={20} />
				</div>
				<span className="flex-1 min-w-0">
					<span className="block text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-gold-700 transition-colors">
						{t.restoreData}
					</span>
					<span className="block text-[11px] text-slate-400 dark:text-ink-400 leading-snug">
						{t.restoreSub}
					</span>
				</span>
			</button>

			{/* Turn-on / restore sheet */}
			{activeInfoType &&
				createPortal(
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
						<div
							className="absolute inset-0 bg-black/60 backdrop-blur-sm"
							onClick={closeSheet}
						/>
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl z-10 w-full max-w-sm border border-gold-600/20 animate-in fade-in zoom-in duration-200 relative">
							<button
								type="button"
								className="absolute top-4 right-4 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200"
								onClick={closeSheet}
								aria-label={t.cancel}
							>
								<X size={20} />
							</button>

							<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 pr-6">
								{activeInfoType === "backup"
									? t.driveInfoTitle
									: t.restoreTitle}
							</h3>
							<p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed mb-4">
								{activeInfoType === "backup" ? t.driveInfo : t.restoreInfo}
							</p>

							{activeInfoType === "restore" &&
								driveInfo.state !== "unknown" && (
									<div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
										{driveInfo.state === "checking" ? (
											<Loader2 size={14} className="animate-spin shrink-0" />
										) : (
											<HardDrive size={14} className="text-gold-700 shrink-0" />
										)}
										<span className="min-w-0">
											{driveInfo.state === "checking"
												? t.checking
												: driveInfo.state === "none"
													? t.noneFound
													: driveInfo.savedAt
														? `${t.foundOn}: ${formatWhen(driveInfo.savedAt, isHindi)}`
														: `${DRIVE_FOLDER_NAME} / ${DRIVE_FILE_NAME}`}
										</span>
									</div>
								)}

							<div className="flex gap-3">
								<button
									type="button"
									onClick={closeSheet}
									className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-medium transition-colors"
								>
									{t.cancel}
								</button>
								<button
									type="button"
									onClick={() =>
										activeInfoType === "backup"
											? handleSave(true)
											: handleRestore()
									}
									disabled={
										busy !== null ||
										(activeInfoType === "restore" && driveInfo.state === "none")
									}
									className="flex-1 py-3 bg-gold-600 hover:bg-gold-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
								>
									{busy !== null && (
										<Loader2 size={16} className="animate-spin" />
									)}
									{activeInfoType === "backup" ? t.saveToDrive : t.restoreNow}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
};

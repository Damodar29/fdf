import { Capacitor } from "@capacitor/core";
import { AppUpdate } from "@capawesome/capacitor-app-update";
import { doc, getDoc } from "firebase/firestore";
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle2,
	Download,
	RefreshCcw,
	Rocket,
	Sparkles,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { db } from "../services/firebase";
import { afterHistorySettles, popHistory } from "../utils/historyPop";
import { isVersionOlder } from "../utils/versioning";
import { APP_VERSION } from "../version";

const PLAY_STORE_TIMEOUT_MS = 8000;

interface Props {
	isOpen: boolean;
	onClose: () => void;
	settingsLanguage: "en" | "hi";
	onTriggerManualOtaUpdate: (url: string, version: string) => void;
}

export const AppUpdaterScreen: React.FC<Props> = ({
	isOpen,
	onClose,
	settingsLanguage,
	onTriggerManualOtaUpdate,
}) => {
	const [status, setStatus] = useState<
		"checking" | "available" | "up-to-date" | "error"
	>("checking");
	const [updateInfo, setUpdateInfo] = useState<{
		type: "ota" | "playstore";
		version: string;
		url?: string;
	} | null>(null);

	// Bumped on every open/close, so a check still running from an earlier open
	// can't overwrite the screen of the current one.
	const checkRunRef = useRef(0);

	const checkUpdates = async () => {
		const run = checkRunRef.current;
		const isStale = () => run !== checkRunRef.current;
		try {
			// 1. Check Play Store first
			if (Capacitor.isNativePlatform()) {
				try {
					// Play Core can take very long (or never answer) on some devices;
					// don't leave the screen stuck on "Checking".
					const playStoreInfo = await Promise.race([
						AppUpdate.getAppUpdateInfo(),
						new Promise<never>((_, reject) =>
							setTimeout(
								() => reject(new Error("Play Store check timed out")),
								PLAY_STORE_TIMEOUT_MS,
							),
						),
					]);
					if (isStale()) return;
					if (playStoreInfo.updateAvailability === 2) {
						// 2 = UPDATE_AVAILABLE
						setUpdateInfo({
							type: "playstore",
							version:
								playStoreInfo.availableVersionName ||
								playStoreInfo.availableVersionCode ||
								"latest",
						});
						setStatus("available");
						return;
					}
				} catch (e) {
					console.warn("Play Store check failed", e);
				}
			}

			// 2. Check OTA Update
			const otaDoc = await getDoc(doc(db, "ota_config", "latest"));
			if (isStale()) return;
			if (otaDoc.exists()) {
				const otaData = otaDoc.data();
				const latestOtaVersion = String(otaData.version || "").trim();
				if (
					otaData.url &&
					latestOtaVersion &&
					isVersionOlder(APP_VERSION, latestOtaVersion)
				) {
					setUpdateInfo({
						type: "ota",
						version: latestOtaVersion,
						url: otaData.url,
					});
					setStatus("available");
					return;
				}
			}

			// 3. No updates found
			setStatus("up-to-date");
		} catch (e) {
			console.error(e);
			if (!isStale()) setStatus("error");
		}
	};

	const handleUpdate = async () => {
		if (!updateInfo) return;

		if (updateInfo.type === "playstore") {
			try {
				await AppUpdate.performImmediateUpdate();
			} catch (e) {
				console.warn("In-App Update failed, opening store", e);
				try {
					await AppUpdate.openAppStore();
				} catch (_err) {}
			}
		} else if (updateInfo.url) {
			onTriggerManualOtaUpdate(updateInfo.url, updateInfo.version);
		}
		onClose();
	};

	// Check for updates when modal opens
	// biome-ignore lint/correctness/useExhaustiveDependencies: checkUpdates is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (isOpen) {
			setStatus("checking");
			setUpdateInfo(null);
			// Give a slight delay for smoother UI transition
			const timer = setTimeout(() => {
				checkUpdates();
			}, 800);
			return () => {
				clearTimeout(timer);
				checkRunRef.current++;
			};
		}
	}, [isOpen]);

	// Parent passes a new inline onClose on every render; keep it in a ref so the
	// history effect below runs once per open, not on every App re-render (each
	// re-run popped our entry and pushed a new one, and that pop closed us).
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	// Back button handling
	useEffect(() => {
		if (!isOpen) return;
		const id = `updater-screen-${Date.now()}`;
		let cancelled = false;
		let pushed = false;
		const handler = (e: PopStateEvent) => {
			if (e.state?.modalId === id) return;
			pushed = false;
			onCloseRef.current();
		};
		// The side menu closes itself with a history back in the same tap that
		// opens this screen. Push only after that pop lands: pushed earlier, the
		// pop eats our entry and its popstate closes this screen straight away.
		afterHistorySettles(() => {
			if (cancelled) return;
			window.history.pushState({ isPopup: true, modalId: id }, "");
			pushed = true;
			window.addEventListener("popstate", handler);
		});
		return () => {
			cancelled = true;
			window.removeEventListener("popstate", handler);
			if (pushed && window.history.state?.modalId === id) popHistory();
		};
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-[100] bg-ry-cream/90 dark:bg-black/90 backdrop-blur-md flex flex-col items-center justify-center sm:p-6 animate-in fade-in duration-300">
			{/* Desktop/Tablet Card Container, Mobile Full Screen */}
			<div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl bg-ry-cream sm:bg-white dark:bg-ink-900 sm:dark:bg-slate-900 flex flex-col shadow-2xl overflow-hidden sm:border border-slate-200/50 dark:border-slate-800/50 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-500 relative">
				{/* Subtle Background Glow for premium feel */}
				<div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-500/10 dark:from-blue-500/5 to-transparent pointer-events-none" />

				{/* Header - Safe Area compliant */}
				<div className="flex items-center px-4 pt-[max(env(safe-area-inset-top),16px)] sm:pt-4 pb-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shrink-0 z-10 sticky top-0 transition-colors">
					<button
						onClick={onClose}
						className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:scale-90"
					>
						<ArrowLeft size={24} />
					</button>
					<h2 className="ml-2 text-lg font-bold text-slate-800 dark:text-white">
						{settingsLanguage === "en" ? "App Updates" : "ऐप अपडेट"}
					</h2>
				</div>

				{/* Main Content Area */}
				<div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center overflow-y-auto z-10 pb-[calc(max(env(safe-area-inset-bottom),24px))]">
					{status === "checking" && (
						<div className="flex flex-col items-center animate-in zoom-in-95 duration-700 w-full">
							<div className="relative mb-8">
								<div className="absolute inset-0 bg-blue-400 dark:bg-blue-500 rounded-full animate-ping opacity-20 duration-1000"></div>
								<div className="w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-tr from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 shadow-inner relative z-10">
									<RefreshCcw
										size={40}
										className="animate-[spin_2s_linear_infinite]"
									/>
								</div>
							</div>
							<h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
								{settingsLanguage === "en"
									? "Checking for updates..."
									: "अपडेट चेक कर रहे हैं..."}
							</h3>
							<p className="text-slate-500 dark:text-slate-400 font-medium">
								{settingsLanguage === "en"
									? "Connecting to secure servers."
									: "सर्वर से कनेक्ट कर रहे हैं।"}
							</p>
						</div>
					)}

					{status === "available" && updateInfo && (
						<div className="flex flex-col items-center animate-in zoom-in-95 duration-500 w-full">
							<div className="relative mb-6">
								<div className="absolute inset-0 bg-emerald-400 dark:bg-emerald-500 rounded-full animate-pulse opacity-20"></div>
								<div className="w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-tr from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-800/20 text-emerald-600 dark:text-emerald-400 shadow-inner relative z-10">
									<Rocket
										size={44}
										className="animate-in slide-in-from-bottom-2 fade-in duration-700"
									/>
								</div>
								<div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce z-20">
									<Sparkles size={16} />
								</div>
							</div>

							<h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
								{settingsLanguage === "en"
									? updateInfo.type === "playstore"
										? "New Version Available!"
										: "Update Available!"
									: updateInfo.type === "playstore"
										? "नया वर्ज़न उपलब्ध है!"
										: "अपडेट उपलब्ध है!"}
							</h3>

							<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 mb-6 border border-slate-200 dark:border-slate-700">
								<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
								v{updateInfo.version}
							</div>

							<div className="bg-white dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full mb-8 shadow-sm">
								<p className="text-slate-600 dark:text-slate-300 font-medium">
									{settingsLanguage === "en"
										? updateInfo.type === "playstore"
											? `A brand new app version is available on the Play Store. Please update for the best and smoothest experience.`
											: `A new update is ready to be installed quickly.`
										: updateInfo.type === "playstore"
											? `प्ले स्टोर पर ऐप का एकदम नया वर्ज़न उपलब्ध है। कृपया बेहतर अनुभव के लिए अपडेट करें।`
											: `एक नया अपडेट तुरंत इंस्टॉल करने के लिए तैयार है।`}
								</p>
							</div>

							<div className="flex flex-col sm:flex-row gap-3 w-full mt-auto">
								<button
									onClick={onClose}
									className="flex-1 py-4 text-slate-600 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all active:scale-95"
								>
									{settingsLanguage === "en" ? "Maybe Later" : "बाद में"}
								</button>
								<button
									onClick={handleUpdate}
									className="flex-[1.5] py-4 text-white font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
								>
									<Download size={20} />
									{settingsLanguage === "en" ? "Update Now" : "अभी अपडेट करें"}
								</button>
							</div>
						</div>
					)}

					{status === "up-to-date" && (
						<div className="flex flex-col items-center animate-in zoom-in-95 duration-500 w-full">
							<div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-gradient-to-tr from-emerald-100 to-teal-50 dark:from-emerald-900/30 dark:to-teal-800/10 text-emerald-500 dark:text-emerald-400 relative">
								<CheckCircle2
									size={48}
									className="animate-in zoom-in duration-500 delay-150"
								/>
								<div className="absolute inset-0 border-2 border-emerald-500/20 dark:border-emerald-400/20 rounded-full animate-[ping_2s_ease-out_infinite]"></div>
							</div>
							<h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
								{settingsLanguage === "en"
									? "You're all caught up!"
									: "आप पूरी तरह अपडेटेड हैं!"}
							</h3>
							<p className="text-slate-500 dark:text-slate-400 font-medium mb-10 max-w-sm">
								{settingsLanguage === "en"
									? "You are already running the latest version of the app. Enjoy!"
									: "आप पहले से ही ऐप के लेटेस्ट वर्ज़न पर हैं। आनंद लें!"}
							</p>
							<button
								onClick={onClose}
								className="w-full sm:w-auto sm:px-12 py-4 text-slate-700 dark:text-slate-200 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-all active:scale-95 shadow-sm mt-auto"
							>
								{settingsLanguage === "en" ? "Go Back" : "वापस जाएँ"}
							</button>
						</div>
					)}

					{status === "error" && (
						<div className="flex flex-col items-center animate-in zoom-in-95 duration-500 w-full">
							<div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-gradient-to-tr from-red-100 to-rose-50 dark:from-red-900/30 dark:to-rose-800/10 text-red-500 dark:text-red-400">
								<AlertCircle size={48} />
							</div>
							<h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
								{settingsLanguage === "en" ? "Check Failed" : "चेक विफल"}
							</h3>
							<p className="text-slate-500 dark:text-slate-400 font-medium mb-10 max-w-sm">
								{settingsLanguage === "en"
									? "Failed to communicate with servers. Please check your internet connection and try again later."
									: "सर्वर से संपर्क करने में विफल। कृपया इंटरनेट कनेक्शन जांचें और बाद में प्रयास करें।"}
							</p>
							<button
								onClick={onClose}
								className="w-full sm:w-auto sm:px-12 py-4 text-slate-700 dark:text-slate-200 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-all active:scale-95 shadow-sm mt-auto"
							>
								{settingsLanguage === "en" ? "Go Back" : "वापस जाएँ"}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

import { Capacitor } from "@capacitor/core";
import { AlertCircle, Bell, Globe, Settings } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { setupPushNotifications } from "../services/firebase";

interface NotificationsPermissionScreenProps {
	isVisible: boolean;
}

const openNotificationSettings = async () => {
	if (!Capacitor.isNativePlatform()) return;
	try {
		const { NativeSettings, AndroidSettings, IOSSettings } = await import(
			"capacitor-native-settings"
		);
		if (Capacitor.getPlatform() === "ios") {
			await NativeSettings.openIOS({ option: IOSSettings.App });
		} else {
			await NativeSettings.openAndroid({
				option: AndroidSettings.AppNotification,
			});
		}
	} catch (e) {
		console.error("Failed to open notification settings:", e);
	}
};

export const NotificationsPermissionScreen: React.FC<
	NotificationsPermissionScreenProps
> = ({ isVisible }) => {
	const { showToast } = useToast();
	const [show, setShow] = useState(isVisible);
	const [requesting, setRequesting] = useState(false);
	// Track if user has explicitly blocked in the browser dialog
	const [isBlocked, setIsBlocked] = useState(
		typeof Notification !== "undefined" && Notification.permission === "denied",
	);
	const isWeb = !Capacitor.isNativePlatform();

	useEffect(() => {
		setShow(isVisible);
		if (isVisible && typeof Notification !== "undefined") {
			setIsBlocked(Notification.permission === "denied");
		}
	}, [isVisible]);

	if (!show) return null;

	// ── Web: request permission directly ──────────────────────────────────────
	const handleWebEnable = async () => {
		if (requesting) return;
		setRequesting(true);
		try {
			let permission = Notification.permission;

			if (permission === "default") {
				permission = await Notification.requestPermission();
			}

			if (permission === "granted") {
				const success = await setupPushNotifications(() => {});
				if (success) {
					setShow(false);
					window.location.reload(); // Reload to clear states and ensure app initializes fully
				}
			} else if (permission === "denied") {
				showToast(
					"Notifications are BLOCKED. Check browser settings.",
					"error",
				);
				setIsBlocked(true);
			}
		} catch (e) {
			console.error("Web push enable error:", e);
			setIsBlocked(true);
		}
		setRequesting(false);
	};

	return (
		<div
			className="fixed inset-0 z-[9998] flex flex-col items-center justify-center overflow-hidden"
			style={{
				background:
					"linear-gradient(135deg, #103A8C 0%, #0B2E6B 50%, #071C40 100%)",
			}}
			// Intercept ALL clicks — nothing behind this screen is accessible
			onClick={(e) => e.stopPropagation()}
		>
			<style>{`
        @keyframes pulse-icon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
        .animate-pulse-icon { animation: pulse-icon 2s ease-in-out infinite; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        @keyframes btn-glow {
          0%, 100% { box-shadow: 0 0 16px rgba(255,255,255,0.25); }
          50% { box-shadow: 0 0 28px rgba(255,255,255,0.5); }
        }
        .btn-glow { animation: btn-glow 2.5s ease-in-out infinite; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.5s ease; }
      `}</style>

			<div className="relative z-10 flex flex-col items-center gap-6 w-full px-8 max-w-md">
				{/* Icon */}
				<div className={isBlocked ? "animate-shake" : "animate-pulse-icon"}>
					{isBlocked ? (
						<AlertCircle
							size={80}
							className="text-yellow-300 drop-shadow-lg"
							style={{ filter: "drop-shadow(0 0 20px rgba(250, 200, 0, 0.4))" }}
						/>
					) : (
						<Bell
							size={80}
							className="text-white drop-shadow-lg"
							style={{
								filter: "drop-shadow(0 0 20px rgba(255, 255, 255, 0.4))",
							}}
						/>
					)}
				</div>

				{/* Text */}
				<div className="text-center animate-fade-in space-y-6">
					{/* ── STATE 1: Browser blocked ── */}
					{isWeb && isBlocked ? (
						<div className="space-y-3">
							<h1
								className="text-2xl font-bold text-yellow-300 leading-tight"
								style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
							>
								Notifications Blocked
							</h1>
							<p className="text-white/90 text-base leading-relaxed">
								You blocked notifications. To use this app, please enable them
								from your browser settings:
							</p>

							{/* Step-by-step instructions */}
							<div className="bg-white/10 rounded-2xl p-4 text-left space-y-2 text-sm text-white/90 backdrop-blur-sm">
								<p className="font-bold text-white">Chrome / Edge:</p>
								<p>
									🔒 Click the <b>lock icon</b> in the address bar →<br />
									<b>Site settings</b> → Notifications → <b>Allow</b>
								</p>
								<div className="border-t border-white/20 my-2" />
								<p className="font-bold text-white">Safari (iPhone PWA):</p>
								<p>
									⚙️ iPhone <b>Settings</b> → Safari → <b>Notifications</b> →
									Allow for this site
								</p>
							</div>

							{/* Divider */}
							<div className="w-16 h-1 bg-white/30 rounded-full mx-auto" />

							<p className="text-white font-bold text-xl">सूचनाएं ब्लॉक हैं</p>
							<p className="text-white/80 text-sm">
								ब्राउज़र सेटिंग्स में जाकर इस साइट की सूचनाएं<b> Allow </b>करें, फिर पेज
								रिफ्रेश करें।
							</p>
						</div>
					) : (
						/* ── STATE 2: Not yet asked / Default ── */
						<div className="space-y-6">
							<div className="space-y-2">
								<h1
									className="text-3xl font-bold text-white leading-tight"
									style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
								>
									Enable Notifications
								</h1>
								<p
									className="text-lg text-cream-100 opacity-90"
									style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
								>
									Notifications are required to use this app
								</p>
							</div>

							<div className="w-16 h-1 bg-white/30 rounded-full mx-auto" />

							<div className="space-y-2">
								<h2
									className="text-2xl font-bold text-white leading-tight"
									style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
								>
									सूचनाएं सक्षम करें
								</h2>
								<p
									className="text-base text-cream-100 opacity-90"
									style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
								>
									इस ऐप को उपयोग करने के लिए सूचनाओं की अनुमति आवश्यक है
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Buttons */}
				<div className="flex flex-col gap-3 w-full animate-fade-in">
					{isWeb ? (
						<button
							onClick={handleWebEnable}
							disabled={requesting}
							className="btn-glow flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold text-krishna-700 text-lg disabled:opacity-70"
							style={{
								background: "rgba(255,255,255,0.95)",
								backdropFilter: "blur(8px)",
							}}
						>
							<Globe size={22} />
							{requesting ? "Please wait..." : "Enable Notifications"}
						</button>
					) : (
						/* Native Android / iOS — open system Settings */
						<button
							onClick={openNotificationSettings}
							className="btn-glow flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold text-krishna-700 text-lg"
							style={{
								background: "rgba(255,255,255,0.95)",
								backdropFilter: "blur(8px)",
							}}
						>
							<Settings size={22} />
							Enable Notifications
						</button>
					)}

					{/* NO skip/dismiss button — app is fully blocked until permission granted */}
				</div>
			</div>
		</div>
	);
};

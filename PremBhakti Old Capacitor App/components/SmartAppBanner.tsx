import { Capacitor } from "@capacitor/core";
import { X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";

interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{
		outcome: "accepted" | "dismissed";
		platform: string;
	}>;
	prompt(): Promise<void>;
}

export const SmartAppBanner: React.FC = () => {
	const [isVisible, setIsVisible] = useState(false);
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const { settingsLanguage, devMode } = useSettings();
	const canShowBanner =
		!Capacitor.isNativePlatform() && !import.meta.env.DEV && !devMode;

	useEffect(() => {
		if (!canShowBanner) return;

		// Check if the user is on Android
		const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
		const isAndroid = /android/i.test(ua);
		if (!isAndroid) return;

		// Check if running as an installed PWA
		const isStandalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			(window.navigator as any).standalone === true;
		if (isStandalone) return;

		// We can show the banner if it's Android Web and not in dev/admin mode.
		setIsVisible(true);

		// Listen for the native install prompt event
		const handleBeforeInstallPrompt = (e: Event) => {
			// Prevent the mini-infobar from appearing automatically on older Chrome versions
			e.preventDefault();
			// Stash the event so it can be triggered later.
			setDeferredPrompt(e as BeforeInstallPromptEvent);
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
		};
	}, [canShowBanner]);

	const handleInstallClick = async () => {
		if (deferredPrompt) {
			// Show the native install prompt
			await deferredPrompt.prompt();
			// Wait for the user to respond to the prompt
			const { outcome } = await deferredPrompt.userChoice;
			console.log(`User ${outcome} the install prompt`);
			// We've used the prompt, and can't use it again, throw it away
			setDeferredPrompt(null);
			// Hide our custom banner after interaction
			setIsVisible(false);
		} else {
			// Fallback: Open Play Store directly if native prompt is not available
			window.open(
				"https://play.google.com/store/apps/details?id=com.cpbs.bhajans",
				"_blank",
			);
			setIsVisible(false);
		}
	};

	const handleDismiss = () => {
		setIsVisible(false);
	};

	if (!canShowBanner || !isVisible) return null;

	return (
		<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
			<div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col items-center p-8 text-center border border-white/10 relative">
				<button
					onClick={handleDismiss}
					className="absolute top-4 right-4 p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
					aria-label="Close"
				>
					<X size={20} strokeWidth={2.5} />
				</button>

				{/* App Icon */}
				<div className="w-24 h-24 mb-5 rounded-2xl shadow-lg overflow-hidden p-1 bg-white dark:bg-ink-800 border border-slate-100 shrink-0">
					<img
						src="/icon.png"
						alt="App Icon"
						className="w-full h-full object-cover rounded-xl"
					/>
				</div>

				{/* Text content */}
				<h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
					{settingsLanguage === "hi" ? "Prem Bhakti ऐप" : "Prem Bhakti App"}
				</h2>
				<p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
					{settingsLanguage === "hi"
						? "बेहतर अनुभव, ऑफलाइन भजन और नोटिफिकेशन्स के लिए हमारा ऑफिशियल ऐप इंस्टॉल करें।"
						: "Install our official app for a faster experience, offline bhajans, and notifications."}
				</p>

				{/* Buttons */}
				<div className="w-full flex flex-col gap-3 mt-auto">
					<button
						onClick={handleInstallClick}
						className="w-full bg-gradient-to-r from-ry-maroon to-ry-gold text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-ry-gold/30 active:scale-[0.98] transition-all"
					>
						{settingsLanguage === "hi" ? "इंस्टॉल करें (Install)" : "Install Now"}
					</button>

					<button
						onClick={handleDismiss}
						className="w-full py-3.5 rounded-2xl font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.98] transition-all"
					>
						{settingsLanguage === "hi" ? "बाद में (Not Now)" : "Not Now"}
					</button>
				</div>
			</div>
		</div>
	);
};

import { WifiOff } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";

interface OfflineBannerProps {
	text?: string;
	className?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
	text,
	className = "",
}) => {
	const { settingsLanguage } = useSettings();
	const [isOffline, setIsOffline] = useState(!navigator.onLine);

	useEffect(() => {
		const handleOnline = () => setIsOffline(false);
		const handleOffline = () => setIsOffline(true);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	if (!isOffline) return null;

	return (
		<div
			className={`m-3 p-3 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-md rounded-xl border border-red-200 dark:border-red-800/50 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${className}`}
		>
			<div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-600 dark:text-red-400 shrink-0">
				<WifiOff size={18} />
			</div>
			<div className="flex-1">
				<h4 className="text-sm font-semibold text-red-800 dark:text-red-300">
					{settingsLanguage === "hi" ? "आप ऑफ़लाइन हैं" : "You are offline"}
				</h4>
				<p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5 leading-relaxed">
					{text ||
						(settingsLanguage === "hi"
							? "नवीनतम अपडेट प्राप्त करने के लिए कृपया अपना इंटरनेट कनेक्शन जांचें। आप अभी भी पहले से लोड की गई जानकारी देख सकते हैं।"
							: "Please check your internet connection for the latest updates. You can still view previously loaded content.")}
				</p>
			</div>
		</div>
	);
};

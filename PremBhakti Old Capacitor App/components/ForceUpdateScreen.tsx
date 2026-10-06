import { App } from "@capacitor/app";
import { Download } from "lucide-react";
import type React from "react";

interface ForceUpdateScreenProps {
	config: {
		minNativeVersion: string;
		updateTitle: string;
		updateMessage: string;
		playStoreUrl: string;
	};
}

export const ForceUpdateScreen: React.FC<ForceUpdateScreenProps> = ({
	config,
}) => {
	const handleUpdateClick = () => {
		window.open(
			config.playStoreUrl ||
				"https://play.google.com/store/apps/details?id=com.cpbs.bhajans",
			"_system",
		);
	};

	const handleExit = () => {
		App.exitApp();
	};

	return (
		<div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-6 animate-in fade-in duration-300">
			{/* Background Decor */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 blur-3xl mix-blend-screen animate-pulse-slow"></div>
				<div
					className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-3xl mix-blend-screen animate-pulse-slow"
					style={{ animationDelay: "1s" }}
				></div>
			</div>

			<div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-500 delay-100">
				{/* Icon */}
				<div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6 shadow-inner">
					<Download size={36} className="animate-bounce" />
				</div>

				{/* Text Content */}
				<h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
					{config.updateTitle || "Update Required"}
				</h2>

				<p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-8">
					{config.updateMessage ||
						"A new version of the app is available. Please update to continue using the app."}
				</p>

				{/* Buttons */}
				<div className="w-full space-y-3">
					<button
						onClick={handleUpdateClick}
						className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
					>
						Update Now
					</button>

					<button
						onClick={handleExit}
						className="w-full py-3 text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 font-bold rounded-2xl transition-all"
					>
						Close App
					</button>
				</div>
			</div>
		</div>
	);
};

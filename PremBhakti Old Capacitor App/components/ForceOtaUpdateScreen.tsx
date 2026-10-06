import { RefreshCw, Smartphone } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface Props {
	progress: number;
}

export const ForceOtaUpdateScreen: React.FC<Props> = ({ progress }) => {
	const [simulatedProgress, setSimulatedProgress] = useState(0);

	useEffect(() => {
		// UI-only perception speed — the update zip is only ~2-4MB, so on
		// typical mobile internet the real download finishes in a few seconds.
		// Bumped from ~3%/sec (~800ms tick, +1-4%) to ~17%/sec (~400ms tick,
		// +4-10%) so the bar visibly races to ~99% in ~5-6s instead of ~30s.
		const timer = setInterval(() => {
			setSimulatedProgress((prev) => {
				const next = prev + (Math.random() * 6 + 4);
				return next >= 99 ? 99 : next;
			});
		}, 400);

		return () => clearInterval(timer);
	}, []);

	// Show whichever is higher, but cap at 99% unless real progress is actually 100%
	const displayProgress =
		progress >= 100
			? 100
			: Math.min(99, Math.max(Math.round(simulatedProgress), progress));

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-slate-900 animate-in fade-in duration-300">
			<div className="w-full max-w-sm p-8 text-center space-y-6">
				<div className="relative mx-auto w-24 h-24 mb-6">
					<div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900/30 rounded-full animate-pulse" />
					<div className="absolute inset-0 flex items-center justify-center">
						<RefreshCw
							size={40}
							className="text-emerald-500 animate-spin"
							style={{ animationDuration: "3s" }}
						/>
					</div>
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 rounded-full p-2">
						<Smartphone
							size={24}
							className="text-emerald-600 dark:text-emerald-400"
						/>
					</div>
				</div>

				<div>
					<h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
						Downloading Update...
					</h2>
					<p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
						Please wait while we download app update. The app will restart
						automatically when finished.
					</p>
				</div>

				<div className="space-y-2 pt-4">
					<div className="flex justify-between items-center text-sm font-medium px-1">
						<span className="text-emerald-600 dark:text-emerald-400">
							Downloading
						</span>
						<span className="text-slate-600 dark:text-slate-300">
							{displayProgress}%
						</span>
					</div>
					<div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
						<div
							className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
							style={{ width: `${displayProgress}%` }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

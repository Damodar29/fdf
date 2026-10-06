import { Image as ImageIcon, RefreshCw, Sparkles, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface QuotePopupProps {
	onClose: () => void;
	onOpenFull: () => void;
	preloadedUrl?: string; // already loaded by useQuotePopup — skip spinner
}

const EXTENSIONS = ["JPG", "jpg", "PNG", "png", "jpeg"];

export const QuotePopup: React.FC<QuotePopupProps> = ({
	onClose,
	onOpenFull,
	preloadedUrl,
}) => {
	// If preloadedUrl is provided, image is already loaded — skip spinner
	const [isLoading, setIsLoading] = useState(!preloadedUrl);
	const [error, setError] = useState(false);
	const [extensionIndex, setExtensionIndex] = useState(0);

	// --- IMAGE LOGIC (Matches DailyQuotes.tsx) ---
	const getStaticDayOfYear = (date: Date) => {
		const month = date.getMonth();
		const day = date.getDate();
		const leapYearDate = new Date(2024, month, day);
		const start = new Date(2024, 0, 0);
		const diff = leapYearDate.getTime() - start.getTime();
		const oneDay = 1000 * 60 * 60 * 24;
		return Math.floor(diff / oneDay);
	};

	const getQuoteImageUrl = (date: Date) => {
		const dayOfYear = getStaticDayOfYear(date);
		const dayOfYearStr = String(dayOfYear).padStart(3, "0");

		const dayOfMonth = date.getDate();
		const months = [
			"JAN",
			"FEB",
			"MAR",
			"APR",
			"MAY",
			"JUN",
			"JUL",
			"AUG",
			"SEP",
			"OCT",
			"NOV",
			"DEC",
		];
		const monthStr = months[date.getMonth()];

		const ext = EXTENSIONS[extensionIndex];
		const fileName = `${dayOfYearStr}.${dayOfMonth}.${monthStr}.${ext}`;

		return `https://images.chaitanyaprembhakti.org/dailyquotes_1/${fileName}`;
	};

	const today = new Date();
	const imageUrl = getQuoteImageUrl(today);

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-ink-950/60 backdrop-blur-md animate-in fade-in duration-500">
			<div className="bg-cream-25 dark:bg-ink-800 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-jm-modal transform transition-all animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 flex flex-col max-h-[80vh] border border-gold-300/30 dark:border-gold-300/10 relative">
				{/* Top Header - Distinguished from Splash */}
				<div className="bg-cream-100/50 dark:bg-ink-900/50 p-5 flex justify-between items-center relative overflow-hidden border-b border-gold-200/40 dark:border-gold-800/20">
					<div className="relative z-10 flex items-center gap-3">
						<div className="w-10 h-10 bg-gold-100 dark:bg-ink-800 rounded-xl flex items-center justify-center text-gold-700 dark:text-gold-400 shadow-jm-inner-light dark:shadow-jm-inner-dark">
							<Sparkles size={20} className="animate-pulse-slow" />
						</div>
						<div>
							<h3 className="text-ink-900 dark:text-cream-50 font-bold text-lg font-hindi leading-tight">
								नित्य वाणी
							</h3>
							<p className="text-ink-500 dark:text-ink-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
								Daily Wisdom •{" "}
								{today.toLocaleDateString("en-IN", {
									day: "numeric",
									month: "short",
								})}
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="relative z-10 text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-cream-50 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-full p-2 transition-all active:scale-90"
					>
						<X size={20} />
					</button>
				</div>

				{/* Image Container - Focused Content */}
				<div
					className="relative bg-cream-50 dark:bg-ink-950 flex-1 min-h-[320px] flex items-center justify-center overflow-hidden cursor-pointer group"
					onClick={onOpenFull}
				>
					{isLoading && (
						<div className="absolute inset-0 flex items-center justify-center z-0">
							<div className="flex flex-col items-center gap-3">
								<div className="w-12 h-12 opacity-80 animate-[spin_20s_linear_infinite]">
									<svg
										viewBox="0 0 100 100"
										className="w-full h-full drop-shadow-sm"
										style={{ stroke: "#D4AF37", fill: "none" }}
									>
										<circle cx="50" cy="50" r="42" strokeWidth="6" />
										<circle
											cx="50"
											cy="50"
											r="34"
											strokeWidth="2"
											strokeDasharray="4 4"
										/>
										<circle cx="50" cy="50" r="10" strokeWidth="4" />
										<circle cx="50" cy="50" r="4" fill="#D4AF37" />
										<path
											d="M50 8 L50 92 M8 50 L92 50 M20 20 L80 80 M20 80 L80 20 M34 11 L66 89 M66 11 L34 89 M11 34 L89 66 M11 66 L89 34"
											strokeWidth="2.5"
										/>
									</svg>
								</div>
								<span className="text-xs text-ink-500 dark:text-ink-400 font-bold uppercase tracking-tighter">
									Seeking Vani...
								</span>
							</div>
						</div>
					)}

					{!error ? (
						<>
							<img
								src={preloadedUrl || imageUrl}
								alt="Daily Quote"
								className={`w-full h-full object-contain transition-all duration-700 ease-out ${isLoading ? "opacity-0 scale-105" : "opacity-100 scale-100"}`}
								onLoad={() => setIsLoading(false)}
								onError={() => {
									if (preloadedUrl) {
										setError(true);
										setIsLoading(false);
										return;
									}
									if (extensionIndex < EXTENSIONS.length - 1) {
										setExtensionIndex((prev) => prev + 1);
									} else {
										setError(true);
										setIsLoading(false);
									}
								}}
							/>

							{/* Visual Hint */}
							{!isLoading && (
								<div className="absolute top-4 right-4 z-20">
									<div className="bg-black/20 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-white/80 group-hover:scale-110 transition-transform">
										<ImageIcon size={14} />
									</div>
								</div>
							)}

							{!isLoading && (
								<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-6 flex items-end justify-center pointer-events-none animate-in fade-in duration-700">
									<span className="text-white text-xs font-bold bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
										Tap to view in Full
									</span>
								</div>
							)}
						</>
					) : (
						<div className="flex flex-col items-center justify-center text-ink-500 dark:text-ink-400 p-8 text-center">
							<div className="w-16 h-16 bg-ink-100 dark:bg-ink-800 rounded-full flex items-center justify-center mb-4 text-ink-600 dark:text-ink-300">
								<RefreshCw size={24} />
							</div>
							<p className="text-sm mb-4 font-bold text-ink-600 dark:text-ink-300 uppercase tracking-wide">
								Connection Lost
							</p>
							<button
								onClick={(e) => {
									e.stopPropagation();
									setIsLoading(true);
									setError(false);
									setExtensionIndex(0);
								}}
								className="text-xs bg-gradient-to-b from-gold-400 to-gold-500 text-krishna-900 border border-gold-600/40 px-6 py-2.5 rounded-xl flex items-center gap-2 hover:from-gold-300 hover:to-gold-400 transition-all shadow-jm-sm hover:shadow-jm-glow font-bold"
							>
								<RefreshCw size={14} /> Retry Now
							</button>
						</div>
					)}
				</div>

				{/* Decorative background circle */}
				<div className="absolute -bottom-20 -right-20 w-40 h-40 bg-gold-400/5 rounded-full blur-3xl pointer-events-none"></div>
			</div>
		</div>
	);
};

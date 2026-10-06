import { ArrowLeft, ExternalLink, Facebook } from "lucide-react";
import type React from "react";

interface FacebookScreenProps {
	onBack: () => void;
	settingsLanguage?: "en" | "hi";
}

export const FacebookScreen: React.FC<FacebookScreenProps> = ({
	onBack,
	settingsLanguage = "hi",
}) => {
	const isHindi = settingsLanguage === "hi";

	const t = {
		title: isHindi ? "फेसबुक पेज" : "Facebook Page",
		heading: isHindi ? "फेसबुक पर हमसे जुड़ें" : "Join us on Facebook",
		description: isHindi
			? "हमारे नवीनतम अपडेट्स, लाइव वीडियो और तस्वीरों के लिए हमें फेसबुक पर फॉलो करें।"
			: "Follow us on Facebook for our latest updates, live videos, and photos.",
		openButton: isHindi ? "फेसबुक खोलें" : "Open Facebook",
		loading: isHindi ? "फेसबुक पेज लोड हो रहा है..." : "Loading Facebook Page...",
	};

	const handleOpenFacebook = () => {
		window.open(
			"https://www.facebook.com/chaitanyaprembhakti",
			"_blank",
			"noopener,noreferrer",
		);
	};

	return (
		<div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
			{/* Header */}
			<div className="flex-none bg-blue-600 text-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 shadow-lg z-10 sticky top-0 rounded-b-3xl">
				<button
					onClick={onBack}
					className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>
				<h2 className="text-xl font-bold flex items-center gap-2 tracking-wide leading-none drop-shadow-md">
					<Facebook className="w-6 h-6" />
					{t.title}
				</h2>
			</div>

			{/* Content */}
			<div className="flex-1 bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col items-center justify-between pt-4 sm:pt-6">
				<div className="w-full max-w-[340px] rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex flex-col relative mb-4">
					{/* Cover Photo Area - Facebook Blue Gradient */}
					<div className="h-32 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 relative">
						<div className="absolute inset-0 bg-black/10"></div>
					</div>

					{/* Profile Content */}
					<div className="px-6 pb-6 pt-0 relative flex flex-col items-center text-center">
						{/* Profile Image overlapping cover */}
						<div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 p-1 -mt-12 relative z-10 shadow-md">
							<div className="w-full h-full rounded-full border border-slate-100 dark:border-slate-700 bg-white dark:bg-ink-800 p-[2px]">
								<div className="w-full h-full bg-white dark:bg-ink-900 rounded-full flex items-center justify-center overflow-hidden p-3">
									<img
										src="/fb_profile.webp"
										alt="Profile"
										className="w-full h-full object-contain"
										onError={(e) => {
											e.currentTarget.style.display = "none";
											e.currentTarget.parentElement
												?.querySelector("svg")
												?.classList.remove("hidden");
										}}
									/>
									<Facebook className="w-10 h-10 text-blue-600 hidden" />
								</div>
							</div>
						</div>

						<h3 className="text-xl font-bold text-slate-800 dark:text-white mt-3 leading-tight">
							Shri Chaitanya Prem
							<br />
							Bhakti Sangh
						</h3>

						<div className="flex items-center justify-center gap-2 w-full mt-1 mb-4">
							<span className="font-semibold text-slate-800 dark:text-white text-sm">
								3.9K
							</span>
							<span className="text-sm text-slate-500 dark:text-slate-400">
								followers
							</span>
							<span className="text-sm text-slate-500 dark:text-slate-400 mx-1">
								•
							</span>
							<span className="font-semibold text-slate-800 dark:text-white text-sm">
								3
							</span>
							<span className="text-sm text-slate-500 dark:text-slate-400">
								following
							</span>
						</div>

						<div className="text-left w-full mt-2">
							<p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
								Shri Chaitanya Prem Bhakti Sangh is a Gaudiya Vaishnav Community
								which was formed with the purpose of preaching the Holy names of
								the Lord in north-western & central parts of the country.
							</p>
							<div className="flex items-center gap-2 mt-3">
								<svg
									className="w-4 h-4 text-slate-500 dark:text-ink-300"
									fill="currentColor"
									viewBox="0 0 24 24"
								>
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
								</svg>
								<span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
									Religious organization
								</span>
							</div>
						</div>
					</div>
				</div>

				<div className="w-full px-4 sm:px-0 mt-auto pb-[calc(1rem+env(safe-area-inset-bottom))] flex justify-center flex-none">
					<button
						onClick={handleOpenFacebook}
						className="flex items-center justify-center gap-2 bg-blue-600 text-white w-full max-w-[340px] py-4 rounded-xl font-bold text-lg shadow-md hover:shadow-lg hover:bg-blue-700 transition-all active:scale-95"
					>
						<Facebook className="w-6 h-6" />
						{t.openButton}
						<ExternalLink className="w-5 h-5 ml-1 opacity-80" />
					</button>
				</div>
			</div>
		</div>
	);
};

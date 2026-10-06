import { ArrowLeft, ExternalLink, Instagram } from "lucide-react";
import type React from "react";

interface InstagramScreenProps {
	onBack: () => void;
	settingsLanguage?: "en" | "hi";
}

export const InstagramScreen: React.FC<InstagramScreenProps> = ({
	onBack,
	settingsLanguage = "hi",
}) => {
	const isHindi = settingsLanguage === "hi";

	const t = {
		title: isHindi ? "इंस्टाग्राम" : "Instagram",
		heading: isHindi ? "इंस्टाग्राम पर हमसे जुड़ें" : "Join us on Instagram",
		description: isHindi
			? "हमारे नवीनतम अपडेट्स, रील्स और तस्वीरों के लिए हमें इंस्टाग्राम पर फॉलो करें।"
			: "Follow us on Instagram for our latest updates, reels, and photos.",
		openButton: isHindi ? "इंस्टाग्राम खोलें" : "Open Instagram",
	};

	const handleOpenInstagram = () => {
		window.open(
			"https://www.instagram.com/chaitanya_prem_bhakti/",
			"_blank",
			"noopener,noreferrer",
		);
	};

	return (
		<div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
			{/* Header */}
			<div className="flex-none bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 shadow-lg z-10 sticky top-0 rounded-b-3xl">
				<button
					onClick={onBack}
					className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>
				<h2 className="text-xl font-bold flex items-center gap-2 tracking-wide leading-none drop-shadow-md">
					<Instagram className="w-6 h-6" />
					{t.title}
				</h2>
			</div>

			{/* Content */}
			<div className="flex-1 bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col items-center pt-4 sm:pt-6">
				<div className="w-full max-w-[340px] rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex flex-col relative mb-4">
					{/* Cover Photo Area */}
					<div className="h-32 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 relative">
						<div className="absolute inset-0 bg-black/10"></div>
					</div>

					{/* Profile Content */}
					<div className="px-6 pb-6 pt-0 relative flex flex-col items-center text-center">
						{/* Profile Image overlapping cover */}
						<div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 p-1 -mt-12 relative z-10 shadow-md">
							<div className="w-full h-full rounded-full border border-slate-100 dark:border-slate-700 bg-white dark:bg-ink-800 p-[2px]">
								<div className="w-full h-full bg-white dark:bg-slate-900 rounded-full flex items-center justify-center overflow-hidden">
									<img
										src="/ig_profile.webp"
										alt="Profile"
										className="w-full h-full object-cover rounded-full"
										onError={(e) => {
											e.currentTarget.style.display = "none";
											e.currentTarget.parentElement
												?.querySelector("svg")
												?.classList.remove("hidden");
										}}
									/>
									<Instagram className="w-10 h-10 text-pink-500 hidden" />
								</div>
							</div>
						</div>

						<h3 className="text-xl font-bold text-slate-800 dark:text-white mt-3 leading-tight">
							Shri ChaitanyaPremBhakti Sangh
						</h3>
						<p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
							@chaitanya_prem_bhakti
						</p>

						<div className="flex items-center justify-center gap-6 w-full mb-4">
							<div className="flex flex-col items-center">
								<span className="font-bold text-slate-800 dark:text-white text-lg">
									1,978
								</span>
								<span className="text-xs text-slate-500 dark:text-slate-400">
									posts
								</span>
							</div>
							<div className="flex flex-col items-center">
								<span className="font-bold text-slate-800 dark:text-white text-lg">
									736
								</span>
								<span className="text-xs text-slate-500 dark:text-slate-400">
									followers
								</span>
							</div>
							<div className="flex flex-col items-center">
								<span className="font-bold text-slate-800 dark:text-white text-lg">
									5
								</span>
								<span className="text-xs text-slate-500 dark:text-slate-400">
									following
								</span>
							</div>
						</div>

						<div className="text-left w-full mt-2">
							<p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
								Community
							</p>
							<p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-2">
								A Gaudiya Vaishnava Community preaching the Holy names of Lord
								in North-Western and Central parts of country.
							</p>
							<div className="flex items-center gap-1.5 text-sm">
								<ExternalLink className="w-4 h-4 text-slate-500 dark:text-slate-400" />
								<span className="font-medium text-slate-800 dark:text-slate-200">
									www.chaitanyaprembhakti.org
								</span>
								<span className="text-slate-500 dark:text-slate-400">
									and 2 more
								</span>
							</div>
						</div>
					</div>
				</div>

				<div className="w-full px-4 sm:px-0 pb-[calc(1rem+env(safe-area-inset-bottom))] flex justify-center flex-none">
					<button
						onClick={handleOpenInstagram}
						className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white w-full max-w-[340px] py-4 rounded-xl font-bold text-lg shadow-md hover:shadow-lg hover:brightness-110 transition-all active:scale-95"
					>
						<Instagram className="w-6 h-6" />
						{t.openButton}
						<ExternalLink className="w-5 h-5 ml-1 opacity-80" />
					</button>
				</div>
			</div>
		</div>
	);
};

import {
	Loader2,
	Music,
	Pause,
	Play,
	Repeat,
	Repeat1,
	SkipBack,
	SkipForward,
	X,
} from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { useAudio } from "../context/AudioContext";
import type { Bhajan } from "../types";

interface MiniPlayerProps {
	onExpand: (bhajan: Bhajan) => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onExpand }) => {
	const {
		currentTrack,
		currentBhajan,
		isPlaying,
		isLoading,
		togglePlay,
		closePlayer,
		trackTitle,
		progress,
		duration,
		repeatMode,
		toggleRepeat,
		playNext,
		playPrevious,
		queue,
	} = useAudio();
	const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
	const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	if (!currentTrack) return null;

	const progressPercent = duration ? (progress / duration) * 100 : 0;

	const handleRepeatToggle = () => {
		toggleRepeat();

		let msg = "";
		if (repeatMode === "off") msg = "Looping Current Song";
		else if (repeatMode === "one") msg = "Looping Queue";
		else msg = "Repeat Off";

		if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
		setFeedbackMsg(msg);
		feedbackTimerRef.current = setTimeout(() => setFeedbackMsg(null), 1500);
	};

	const handleExpand = () => {
		const targetBhajan = currentTrack.parentBhajan || currentBhajan;
		if (targetBhajan) {
			onExpand(targetBhajan);
		}
	};

	return (
		<div
			className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-2 right-2 z-40 animate-slide-in-bottom landscape:bottom-4 landscape:left-[17rem] landscape:right-24"
			data-tour="mini-player"
			onTouchStart={(e) => e.stopPropagation()}
			onTouchMove={(e) => e.stopPropagation()}
			onTouchEnd={(e) => e.stopPropagation()}
		>
			<div className="bg-ry-maroon/95 dark:bg-black/95 backdrop-blur-md rounded-xl shadow-2xl border border-ry-gold/40 flex flex-col overflow-visible">
				{/* Progress Bar Line */}
				<div className="h-1 w-full bg-black/40 rounded-t-xl overflow-hidden">
					<div
						className="h-full bg-ry-gold transition-[width] duration-300 ease-linear"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>

				<div className="flex items-center justify-between p-2 pl-3 relative">
					{/* Feedback Message Tooltip */}
					{feedbackMsg && (
						<div className="absolute bottom-full right-4 mb-2 px-3 py-1.5 bg-ry-gold text-white text-[10px] font-bold rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2 z-50 pointer-events-none">
							{feedbackMsg}
							<div className="absolute -bottom-1 right-8 w-2 h-2 bg-ry-gold transform rotate-45"></div>
						</div>
					)}

					{/* Info Section */}
					<div
						className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
						onClick={handleExpand}
					>
						<div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center text-ry-gold shrink-0">
							{isPlaying ? (
								<div className="flex items-end justify-center gap-0.5 h-4">
									<div className="w-1 bg-ry-gold rounded-full animate-audio-bar audio-bar-1"></div>
									<div className="w-1 bg-ry-gold rounded-full animate-audio-bar audio-bar-2"></div>
									<div className="w-1 bg-ry-gold rounded-full animate-audio-bar audio-bar-3"></div>
								</div>
							) : (
								<Music size={20} />
							)}
						</div>
						<div className="min-w-0">
							<h4 className="text-sm font-bold text-white truncate leading-tight">
								{trackTitle || "Bhajan"}
							</h4>
							<p className="text-xs text-slate-400 dark:text-ink-400 truncate">
								{currentTrack.singer}
							</p>
						</div>
					</div>

					{/* Controls */}
					<div className="flex items-center gap-1">
						<button
							onClick={(e) => {
								e.stopPropagation();
								playPrevious();
							}}
							disabled={queue.length <= 1}
							className={`p-2 rounded-full transition-colors ${queue.length <= 1 ? "text-slate-600 dark:text-ink-300 cursor-not-allowed" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
						>
							<SkipBack size={18} className="fill-current" />
						</button>

						<button
							onClick={(e) => {
								e.stopPropagation();
								togglePlay();
							}}
							className="p-2.5 text-white hover:bg-white/10 rounded-full transition-colors"
						>
							{isLoading ? (
								<Loader2 size={20} className="animate-spin" />
							) : isPlaying ? (
								<Pause size={20} className="fill-current" />
							) : (
								<Play size={20} className="fill-current" />
							)}
						</button>

						<button
							onClick={(e) => {
								e.stopPropagation();
								playNext();
							}}
							disabled={queue.length <= 1}
							className={`p-2 rounded-full transition-colors ${queue.length <= 1 ? "text-slate-600 dark:text-ink-300 cursor-not-allowed" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
						>
							<SkipForward size={18} className="fill-current" />
						</button>

						<button
							onClick={(e) => {
								e.stopPropagation();
								handleRepeatToggle();
							}}
							className={`p-2 rounded-full transition-colors ${repeatMode !== "off" ? "text-ry-gold" : "text-slate-500 dark:text-ink-300"}`}
						>
							{repeatMode === "one" ? (
								<Repeat1 size={16} />
							) : (
								<Repeat size={16} />
							)}
						</button>

						<button
							onClick={(e) => {
								e.stopPropagation();
								closePlayer();
							}}
							className="p-2 text-slate-400 dark:text-ink-400 hover:text-red-400 hover:bg-white/5 rounded-full transition-colors"
						>
							<X size={18} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

import { Loader2, MessageSquare, Send, User, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { hasStartedProfile, useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useComments } from "../hooks/useComments";
import { ThumbImg } from "./ui/ThumbImg";

interface CommentsModalProps {
	itemId: string;
	category: "darshan" | "activities" | "videos" | "information";
	onClose: () => void;
	incrementGlobalCommentCount: (id: string) => void;
	onOpenProfile?: () => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
	itemId,
	category,
	onClose,
	incrementGlobalCommentCount,
	onOpenProfile,
}) => {
	const { settingsLanguage } = useSettings();
	const isHindi = settingsLanguage === "hi";
	const { comments, loading, addComment } = useComments(itemId, category);

	const [text, setText] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { user, profile, signInWithGoogle } = useAuth();
	// Not `!profile`: dismissing the profile welcome wizard writes a minimal
	// users/{uid} document, and such a devotee still needs the "create profile"
	// prompt rather than being told to wait for an approval that isn't coming.
	const profileStarted = hasStartedProfile(profile);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!text.trim() || !user) return;

		const authorName =
			profile?.realName || profile?.dikshaName || user.displayName || "Devotee";
		const authorPhotoURL = profile?.photoURL;

		setIsSubmitting(true);
		const success = await addComment(
			text,
			authorName,
			authorPhotoURL,
			user.uid,
		);
		if (success) {
			setText("");
			incrementGlobalCommentCount(itemId);
		}
		setIsSubmitting(false);
	};

	const formatTime = (ts: number) => {
		const date = new Date(ts);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return isHindi ? "अभी-अभी" : "Just now";
		if (diffMins < 60)
			return isHindi ? `${diffMins} मिनट पहले` : `${diffMins}m ago`;
		if (diffHours < 24)
			return isHindi ? `${diffHours} घंटे पहले` : `${diffHours}h ago`;
		if (diffDays < 7)
			return isHindi ? `${diffDays} दिन पहले` : `${diffDays}d ago`;

		return date.toLocaleDateString(isHindi ? "hi-IN" : "en-US", {
			day: "numeric",
			month: "short",
		});
	};

	return createPortal(
		<div className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
			<div className="absolute inset-0" onClick={onClose} />

			<div className="bg-white dark:bg-slate-900 w-full h-[75vh] max-h-[800px] rounded-t-3xl shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-full duration-300">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
					<h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
						<MessageSquare className="text-pink-500" />
						{isHindi ? "टिप्पणियाँ" : "Comments"}
						{!loading && (
							<span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full ml-1">
								{comments.length}
							</span>
						)}
					</h3>
					<button
						onClick={onClose}
						className="p-2 -mr-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-ink-300 hover:text-slate-800 dark:hover:text-white rounded-full transition active:scale-95"
					>
						<X size={20} />
					</button>
				</div>

				{/* Comments List */}
				<div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
					{loading ? (
						<div className="flex flex-col items-center justify-center h-full text-pink-500">
							<Loader2 className="animate-spin mb-2" size={32} />
							<p className="text-sm text-slate-500 dark:text-ink-300 font-medium">
								{isHindi ? "लोड हो रहा है..." : "Loading comments..."}
							</p>
						</div>
					) : comments.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-ink-400">
							<MessageSquare size={48} className="mb-4 opacity-50" />
							<p className="text-lg font-medium text-slate-500 dark:text-ink-300">
								{isHindi ? "कोई टिप्पणी नहीं" : "No comments yet"}
							</p>
							<p className="text-sm mt-1">
								{isHindi ? "पहली टिप्पणी लिखें!" : "Be the first to comment!"}
							</p>
						</div>
					) : (
						comments.map((comment) => (
							<div
								key={comment.id}
								className="flex gap-3 animate-in fade-in slide-in-from-bottom-2"
							>
								<div className="w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-sm">
									{comment.authorPhotoURL ? (
										<ThumbImg
											src={comment.authorPhotoURL}
											alt=""
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold">
											{comment.authorName.charAt(0).toUpperCase()}
										</div>
									)}
								</div>
								<div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl rounded-tl-none p-3 shadow-sm border border-slate-100 dark:border-slate-800">
									<div className="flex items-center justify-between mb-1">
										<span className="font-bold text-sm text-slate-800 dark:text-slate-200">
											{comment.authorName}
										</span>
										<span className="text-[10px] font-medium text-slate-400 dark:text-ink-400">
											{formatTime(comment.timestamp)}
										</span>
									</div>
									<p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
										{comment.text}
									</p>
								</div>
							</div>
						))
					)}
				</div>

				{/* Input Area */}
				<div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
					{!user || !profile?.isApproved ? (
						<div className="flex flex-col items-center justify-center p-2">
							<p className="text-sm text-slate-500 dark:text-slate-400 mb-3 text-center">
								{!user
									? isHindi
										? "टिप्पणी करने के लिए कृपया लॉगिन करें"
										: "Please sign in to add a comment"
									: !profileStarted
										? isHindi
											? "टिप्पणी करने के लिए कृपया अपनी प्रोफाइल बनाएं"
											: "Please create your profile to comment"
										: isHindi
											? "टिप्पणी करने के लिए प्रोफाइल मंज़ूरी आवश्यक है"
											: "Profile approval is required to comment"}
							</p>
							{!user ? (
								<button
									onClick={async () => {
										const success = await signInWithGoogle();
										if (success) {
											// Login success — modal band karo aur profile screen kholo
											onClose();
											if (onOpenProfile) onOpenProfile();
										}
									}}
									className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors"
								>
									<User size={18} className="text-pink-500" />
									{isHindi ? "लॉगिन करें" : "Sign In"}
								</button>
							) : !profileStarted ? (
								<button
									onClick={() => {
										onClose();
										if (onOpenProfile) onOpenProfile();
									}}
									className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-md"
								>
									<User size={18} className="text-white" />
									{isHindi ? "प्रोफाइल बनाएं" : "Create Profile"}
								</button>
							) : null}
						</div>
					) : (
						<form
							onSubmit={handleSubmit}
							className="flex items-end gap-2 relative"
						>
							<div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-3xl p-1 relative border border-transparent focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/20 transition-all">
								<textarea
									value={text}
									onChange={(e) => setText(e.target.value)}
									placeholder={isHindi ? "टिप्पणी लिखें..." : "Write a comment..."}
									className="w-full bg-transparent px-4 py-2.5 max-h-32 min-h-[44px] resize-none outline-none text-sm text-slate-800 dark:text-slate-200 scrollbar-hide"
									rows={1}
									onInput={(e) => {
										const target = e.target as HTMLTextAreaElement;
										target.style.height = "auto";
										target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
									}}
								/>
							</div>
							<button
								type="submit"
								disabled={!text.trim() || isSubmitting}
								className="h-12 w-12 flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-700 dark:disabled:to-slate-700 disabled:text-slate-400 text-white rounded-full transition-all active:scale-95 shrink-0 shadow-md disabled:shadow-none"
							>
								{isSubmitting ? (
									<Loader2 size={20} className="animate-spin" />
								) : (
									<Send
										size={20}
										className="translate-x-0.5 translate-y-[1px]"
									/>
								)}
							</button>
						</form>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
};

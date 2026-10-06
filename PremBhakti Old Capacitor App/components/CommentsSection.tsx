import { Loader2, MessageSquare, Send, User } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { hasStartedProfile, useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useComments } from "../hooks/useComments";
import { ThumbImg } from "./ui/ThumbImg";

interface CommentsSectionProps {
	itemId: string;
	category: "darshan" | "activities" | "videos" | "information";
	incrementGlobalCommentCount?: (id: string) => void;
	onOpenProfile?: () => void;
	accentColor?: string; // e.g. 'saffron' or 'emerald'
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
	itemId,
	category,
	incrementGlobalCommentCount,
	onOpenProfile,
	accentColor = "pink",
}) => {
	const { settingsLanguage } = useSettings();
	const isHindi = settingsLanguage === "hi";
	const { comments, loading, addComment } = useComments(itemId, category);

	const [text, setText] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { user, profile, signInWithGoogle } = useAuth();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Reset input jab itemId change ho
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setText("");
	}, [itemId]);

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
			if (textareaRef.current) {
				textareaRef.current.style.height = "auto";
			}
			if (incrementGlobalCommentCount) incrementGlobalCommentCount(itemId);
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

	const canComment = user && profile?.isApproved;
	// Not `!profile`: dismissing the profile welcome wizard writes a minimal
	// users/{uid} document, and such a devotee still needs the "create profile"
	// prompt rather than being told to wait for an approval that isn't coming.
	const profileStarted = hasStartedProfile(profile);

	return (
		<div className="mt-4 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
			{/* Header */}
			<div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
				<MessageSquare size={16} className="text-pink-500 shrink-0" />
				<span className="font-bold text-sm text-slate-700 dark:text-slate-200">
					{category === "information"
						? isHindi
							? "प्रश्न"
							: "Questions"
						: isHindi
							? "टिप्पणियाँ"
							: "Comments"}
				</span>
				{!loading && (
					<span className="ml-auto bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-medium">
						{comments.length}
					</span>
				)}
			</div>

			{/* Write a Comment — sabse upar */}
			<div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
				{!canComment ? (
					<div className="flex flex-col items-center py-2 gap-3">
						<p className="text-xs text-slate-500 dark:text-slate-400 text-center">
							{!user
								? category === "information"
									? isHindi
										? "प्रश्न पूछने के लिए कृपया लॉगिन करें"
										: "Please sign in to ask a question"
									: isHindi
										? "टिप्पणी करने के लिए कृपया लॉगिन करें"
										: "Please sign in to comment"
								: !profileStarted
									? category === "information"
										? isHindi
											? "प्रश्न पूछने के लिए प्रोफाइल बनाएं"
											: "Create your profile to ask a question"
										: isHindi
											? "टिप्पणी करने के लिए प्रोफाइल बनाएं"
											: "Create your profile to comment"
									: category === "information"
										? isHindi
											? "प्रोफाइल मंज़ूरी के बाद प्रश्न पूछ सकते हैं"
											: "Profile approval required to ask a question"
										: isHindi
											? "प्रोफाइल मंज़ूरी के बाद टिप्पणी कर सकते हैं"
											: "Profile approval required to comment"}
						</p>
						{!user ? (
							<button
								onClick={async () => {
									const success = await signInWithGoogle();
									if (success && onOpenProfile) {
										// Profile nahi bani hai — auto-open profile screen
										onOpenProfile();
									}
								}}
								className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold rounded-xl transition-colors active:scale-95 shadow-sm"
							>
								<User size={15} />
								{isHindi ? "लॉगिन करें" : "Sign In"}
							</button>
						) : !profileStarted ? (
							<button
								onClick={() => {
									if (onOpenProfile) onOpenProfile();
								}}
								className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold rounded-xl transition-colors active:scale-95 shadow-sm"
							>
								<User size={15} />
								{isHindi ? "प्रोफाइल बनाएं" : "Create Profile"}
							</button>
						) : null}
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex items-end gap-2">
						{/* User avatar */}
						<div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-sm border border-slate-200 dark:border-slate-600">
							{profile?.photoURL ? (
								<ThumbImg
									src={profile.photoURL}
									alt=""
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="w-full h-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
									{(profile?.realName || user?.displayName || "D")
										.charAt(0)
										.toUpperCase()}
								</div>
							)}
						</div>
						<div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-2xl p-1 border border-transparent focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/20 transition-all">
							<textarea
								ref={textareaRef}
								value={text}
								onChange={(e) => setText(e.target.value)}
								placeholder={
									category === "information"
										? isHindi
											? "प्रश्न पूछें..."
											: "Ask a question..."
										: isHindi
											? "एक टिप्पणी लिखें..."
											: "Write a comment..."
								}
								className="w-full bg-transparent px-3 py-2 max-h-28 min-h-[36px] resize-none outline-none text-sm text-slate-800 dark:text-slate-200 scrollbar-hide leading-relaxed"
								rows={1}
								onInput={(e) => {
									const target = e.target as HTMLTextAreaElement;
									target.style.height = "auto";
									target.style.height = `${Math.min(target.scrollHeight, 112)}px`;
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleSubmit(e as any);
									}
								}}
							/>
						</div>
						<button
							type="submit"
							disabled={!text.trim() || isSubmitting}
							className="h-10 w-10 flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-700 dark:disabled:to-slate-700 disabled:text-slate-400 text-white rounded-full transition-all active:scale-95 shrink-0 shadow-md disabled:shadow-none"
						>
							{isSubmitting ? (
								<Loader2 size={17} className="animate-spin" />
							) : (
								<Send size={17} className="translate-x-0.5" />
							)}
						</button>
					</form>
				)}
			</div>

			{/* Comments List */}
			<div className="divide-y divide-slate-100 dark:divide-slate-700/50">
				{loading ? (
					<div className="flex items-center justify-center py-6 gap-2 text-slate-400 dark:text-ink-400">
						<Loader2 size={20} className="animate-spin text-pink-500" />
						<span className="text-sm">
							{isHindi ? "लोड हो रहा है..." : "Loading..."}
						</span>
					</div>
				) : comments.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-ink-400">
						<MessageSquare size={32} className="mb-2 opacity-40" />
						<p className="text-sm font-medium text-slate-500 dark:text-ink-300">
							{category === "information"
								? isHindi
									? "कोई प्रश्न नहीं"
									: "No questions yet"
								: isHindi
									? "कोई टिप्पणी नहीं"
									: "No comments yet"}
						</p>
						<p className="text-xs mt-0.5 text-slate-400 dark:text-ink-400">
							{category === "information"
								? isHindi
									? "पहला प्रश्न पूछें!"
									: "Be the first to ask!"
								: isHindi
									? "पहली टिप्पणी लिखें!"
									: "Be the first to comment!"}
						</p>
					</div>
				) : (
					comments.map((comment, _idx) => (
						<div
							key={comment.id}
							className="flex gap-3 px-4 py-3 animate-in fade-in slide-in-from-bottom-1"
						>
							<div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-sm mt-0.5">
								{comment.authorPhotoURL ? (
									<ThumbImg
										src={comment.authorPhotoURL}
										alt=""
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-xs">
										{comment.authorName.charAt(0).toUpperCase()}
									</div>
								)}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-baseline gap-2 mb-0.5">
									<span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">
										{comment.authorName}
									</span>
									<span className="text-[10px] text-slate-400 dark:text-ink-400 shrink-0">
										{formatTime(comment.timestamp)}
									</span>
								</div>
								<p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed break-words">
									{comment.text}
								</p>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};

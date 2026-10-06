import { formatDistanceToNow } from "date-fns";
import { hi as hiLocale } from "date-fns/locale";
import { collection, doc, getDocs, runTransaction } from "firebase/firestore";
import {
	Loader2,
	MessageCircle,
	RefreshCw,
	Search,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Comment } from "../../hooks/useComments";
import { db } from "../../services/firebase";
import { EditProfileButton } from "../../src/components/admin-panel/devoteeEditLink";
import {
	buildSearchEntry,
	prepareDevoteeQuery,
	scoreDevotee,
} from "../../utils/devoteeSearch";
import { Toast, type ToastType } from "../Toast";
import { ThumbImg } from "../ui/ThumbImg";

interface CommentModerationManagerProps {
	/** Kept for the Admin Panel; its own header has the back button. */
	onClose: () => void;
	isHindi: boolean;
}

const CATEGORIES = ["information", "activities", "videos", "darshan"] as const;
type Category = (typeof CATEGORIES)[number];

interface ExtendedComment extends Comment {
	category: Category;
	docId: string;
}

const CATEGORY_LABEL: Record<Category, { hi: string; en: string }> = {
	information: { hi: "जानकारी", en: "Information" },
	activities: { hi: "गतिविधियाँ", en: "Activities" },
	videos: { hi: "वीडियो", en: "Videos" },
	darshan: { hi: "दर्शन", en: "Darshan" },
};

const PAGE = 40;

export const CommentModerationManager: React.FC<
	CommentModerationManagerProps
> = ({ isHindi }) => {
	const [comments, setComments] = useState<ExtendedComment[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [category, setCategory] = useState<Category | "all">("all");
	const [shown, setShown] = useState(PAGE);
	const [deleting, setDeleting] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<{
		text: string;
		type: ToastType;
	} | null>(null);

	const fetchComments = async () => {
		setRefreshing(true);
		try {
			// All four collections at once (they used to load one after another).
			const snaps = await Promise.all(
				CATEGORIES.map((c) => getDocs(collection(db, `comments_${c}`))),
			);
			const all: ExtendedComment[] = [];
			snaps.forEach((snap, i) => {
				snap.forEach((docSnap) => {
					const list = docSnap.data().comments;
					if (!Array.isArray(list)) return;
					for (const c of list as Comment[])
						all.push({ ...c, category: CATEGORIES[i], docId: docSnap.id });
				});
			});
			all.sort((a, b) => b.timestamp - a.timestamp);
			setComments(all);
		} catch (error) {
			console.error("Error fetching comments:", error);
			setToastMessage({
				text: isHindi ? "टिप्पणियाँ लोड करने में विफल" : "Failed to load comments",
				type: "error",
			});
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: load once on open
	useEffect(() => {
		fetchComments();
	}, []);

	const handleDelete = async (comment: ExtendedComment) => {
		if (
			!window.confirm(
				isHindi
					? `${comment.authorName} की यह टिप्पणी हटाएँ?\n\n“${comment.text.slice(0, 120)}”`
					: `Delete this comment by ${comment.authorName}?\n\n“${comment.text.slice(0, 120)}”`,
			)
		)
			return;

		setDeleting(comment.id);
		try {
			// Removed by id from what is stored now. arrayRemove needs an exact
			// copy of the stored object, so a comment with any other field was
			// silently left in place while the list said "deleted".
			const ref = doc(db, `comments_${comment.category}`, comment.docId);
			const removed = await runTransaction(db, async (tx) => {
				const snap = await tx.get(ref);
				const list = (snap.data()?.comments || []) as Comment[];
				const next = list.filter((c) => c.id !== comment.id);
				if (next.length === list.length) return false;
				tx.update(ref, { comments: next });
				return true;
			});
			setComments((prev) =>
				prev.filter((c) => !(c.id === comment.id && c.docId === comment.docId)),
			);
			setToastMessage({
				text: removed
					? isHindi
						? "टिप्पणी हटा दी गई"
						: "Comment deleted"
					: isHindi
						? "यह टिप्पणी पहले ही हट चुकी थी"
						: "This comment was already gone",
				type: "success",
			});
		} catch (error) {
			console.error("Error deleting comment:", error);
			setToastMessage({
				text: isHindi ? "टिप्पणी हटाने में विफल" : "Failed to delete comment",
				type: "error",
			});
		} finally {
			setDeleting(null);
		}
	};

	const counts = useMemo(() => {
		const n: Record<Category | "all", number> = {
			all: comments.length,
			information: 0,
			activities: 0,
			videos: 0,
			darshan: 0,
		};
		for (const c of comments) n[c.category]++;
		return n;
	}, [comments]);

	// Author names match in Hindi / English / Hinglish; the text as typed.
	const deferredQuery = useDeferredValue(searchQuery);
	const filtered = useMemo(() => {
		const q = prepareDevoteeQuery(deferredQuery);
		const text = deferredQuery.trim().toLowerCase();
		return comments.filter((c) => {
			if (category !== "all" && c.category !== category) return false;
			if (!q.text) return true;
			if (c.text.toLowerCase().includes(text)) return true;
			return scoreDevotee(buildSearchEntry([c.authorName], [], []), q) > 0;
		});
	}, [comments, category, deferredQuery]);

	// Back to the first page when what is listed changes.
	const listKey = `${category}|${deferredQuery}`;
	const [pagedFor, setPagedFor] = useState(listKey);
	if (pagedFor !== listKey) {
		setPagedFor(listKey);
		setShown(PAGE);
	}

	const when = (ts: number) =>
		formatDistanceToNow(ts, {
			addSuffix: true,
			locale: isHindi ? hiLocale : undefined,
		});

	return (
		<div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 animate-in fade-in">
			<div className="flex-none px-3 pt-3 pb-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-2">
				<div className="flex gap-2">
					<div className="relative flex-1 min-w-0">
						<Search
							className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ink-400"
							size={18}
						/>
						<input
							type="search"
							placeholder={
								isHindi
									? "नाम (हिंदी/English) या टिप्पणी के शब्द…"
									: "Name (Hindi/English) or words in the comment…"
							}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full min-h-touch pl-10 pr-10 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent rounded-xl text-sm focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-slate-800 dark:text-white"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={() => setSearchQuery("")}
								aria-label={isHindi ? "खोज साफ़ करें" : "Clear search"}
								className="absolute right-0 top-1/2 -translate-y-1/2 min-w-touch min-h-touch flex items-center justify-center text-slate-400"
							>
								<X size={16} />
							</button>
						)}
					</div>
					<button
						type="button"
						onClick={fetchComments}
						disabled={refreshing}
						aria-label={isHindi ? "ताज़ा करें" : "Refresh"}
						title={isHindi ? "ताज़ा करें" : "Refresh"}
						className="flex-none min-w-touch min-h-touch rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 flex items-center justify-center disabled:opacity-60"
					>
						<RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
					</button>
				</div>
				<div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-3 px-3">
					{(["all", ...CATEGORIES] as const).map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setCategory(c)}
							aria-pressed={category === c}
							className={`shrink-0 min-h-[36px] px-3 rounded-full text-xs font-bold border transition ${
								category === c
									? "bg-emerald-500 border-emerald-500 text-white"
									: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
							}`}
						>
							{c === "all"
								? isHindi
									? "सभी"
									: "All"
								: isHindi
									? CATEGORY_LABEL[c].hi
									: CATEGORY_LABEL[c].en}{" "}
							· {counts[c]}
						</button>
					))}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
				{loading ? (
					<div className="flex items-center justify-center h-40">
						<Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-ink-400 text-center px-6">
						<MessageCircle size={48} className="mb-4 opacity-50" />
						<p>
							{searchQuery.trim()
								? isHindi
									? `“${searchQuery.trim()}” से कोई टिप्पणी नहीं मिली`
									: `No comments match “${searchQuery.trim()}”`
								: isHindi
									? "कोई टिप्पणी नहीं मिली"
									: "No comments found"}
						</p>
					</div>
				) : (
					<>
						{filtered.slice(0, shown).map((comment) => (
							<div
								key={`${comment.category}-${comment.docId}-${comment.id}`}
								className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-2.5 [content-visibility:auto] [contain-intrinsic-size:auto_120px]"
							>
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
										{comment.authorPhotoURL ? (
											<ThumbImg
												src={comment.authorPhotoURL}
												alt=""
												className="w-full h-full object-cover"
											/>
										) : (
											<span className="text-slate-500 dark:text-ink-300 font-bold">
												{comment.authorName.charAt(0)}
											</span>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<p className="font-bold text-slate-800 dark:text-white truncate">
											{comment.authorName}
										</p>
										<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-ink-300">
											<span
												title={new Date(comment.timestamp).toLocaleString(
													isHindi ? "hi-IN" : "en-IN",
												)}
											>
												{when(comment.timestamp)}
											</span>
											<span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-md">
												{isHindi
													? CATEGORY_LABEL[comment.category].hi
													: CATEGORY_LABEL[comment.category].en}
											</span>
										</div>
									</div>
									{comment.userId && (
										<EditProfileButton
											target={{ uid: comment.userId }}
											isHindi={isHindi}
											name={comment.authorName}
											iconOnly
										/>
									)}
									<button
										type="button"
										onClick={() => handleDelete(comment)}
										disabled={deleting === comment.id}
										aria-label={isHindi ? "टिप्पणी हटाएँ" : "Delete comment"}
										title={isHindi ? "टिप्पणी हटाएँ" : "Delete comment"}
										className="min-w-touch min-h-touch flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors active:scale-95 shrink-0 disabled:opacity-50"
									>
										{deleting === comment.id ? (
											<Loader2 size={18} className="animate-spin" />
										) : (
											<Trash2 size={18} />
										)}
									</button>
								</div>
								<p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap break-words">
									{comment.text}
								</p>
							</div>
						))}
						{filtered.length > shown && (
							<button
								type="button"
								onClick={() => setShown((n) => n + PAGE)}
								className="w-full min-h-touch rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-emerald-600 dark:text-emerald-400"
							>
								{isHindi
									? `और दिखाएँ (${filtered.length - shown} बाकी)`
									: `Show more (${filtered.length - shown} more)`}
							</button>
						)}
					</>
				)}
			</div>

			{toastMessage && (
				<Toast
					message={toastMessage.text}
					type={toastMessage.type}
					onClose={() => setToastMessage(null)}
				/>
			)}
		</div>
	);
};

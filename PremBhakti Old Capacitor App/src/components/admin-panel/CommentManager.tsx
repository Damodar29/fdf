import {
	arrayRemove,
	collection,
	doc,
	getDocs,
	onSnapshot,
	query,
	updateDoc,
} from "firebase/firestore";
import {
	Calendar,
	Folder,
	Info,
	Loader2,
	MapPin,
	MessageSquare,
	Search,
	Trash2,
	User,
	Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "../../../context/ToastContext";
import type { Comment } from "../../../hooks/useComments";
import { db } from "../../../services/firebase";
import { MANDAL_LIST } from "../../../src/types/mandal";

interface GlobalComment extends Comment {
	categoryId: "darshan" | "activities" | "videos" | "information";
	itemId: string;
}

export const CommentManager = ({
	settingsLanguage = "en",
}: {
	settingsLanguage?: "en" | "hi";
}) => {
	const isHindi = settingsLanguage === "hi";
	const { showToast } = useToast();
	const [comments, setComments] = useState<GlobalComment[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState<
		"all" | "darshan" | "activities" | "videos" | "information"
	>("all");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Context mapping dictionaries
	const [videoTitles, setVideoTitles] = useState<Record<string, string>>({});
	const [videoFolderNames, setVideoFolderNames] = useState<
		Record<string, string>
	>({});

	useEffect(() => {
		const fetchVideoData = async () => {
			try {
				const [videosSnap, foldersSnap] = await Promise.all([
					getDocs(collection(db, "videos")),
					getDocs(collection(db, "video_folders")),
				]);

				const fMap: Record<string, string> = {};
				foldersSnap.forEach((doc) => {
					fMap[doc.id] = doc.data().name;
				});

				const vMap: Record<string, string> = {};
				const vfMap: Record<string, string> = {};
				videosSnap.forEach((doc) => {
					const data = doc.data();
					vMap[doc.id] = data.title || "Unknown Video";
					if (data.folderId) {
						vfMap[doc.id] = fMap[data.folderId] || "Unknown Folder";
					}
				});

				setVideoTitles(vMap);
				setVideoFolderNames(vfMap);
			} catch (error) {
				console.error("Error fetching video contexts:", error);
			}
		};
		fetchVideoData();
	}, []);

	useEffect(() => {
		let mounted = true;
		const categories: Array<
			"darshan" | "activities" | "videos" | "information"
		> = ["darshan", "activities", "videos", "information"];
		const unsubscribers: Array<() => void> = [];
		const collectionsData = new Map<string, GlobalComment[]>();

		const processMap = () => {
			if (!mounted) return;
			let allComments: GlobalComment[] = [];
			collectionsData.forEach((catComments) => {
				allComments = allComments.concat(catComments);
			});
			// Sort by newest first
			allComments.sort((a, b) => b.timestamp - a.timestamp);
			setComments(allComments);
			setLoading(false);
		};

		categories.forEach((category) => {
			const q = query(collection(db, `comments_${category}`));
			const unsub = onSnapshot(
				q,
				(snapshot) => {
					const categoryComments: GlobalComment[] = [];
					snapshot.forEach((docSnap) => {
						const data = docSnap.data();
						if (data.comments && Array.isArray(data.comments)) {
							data.comments.forEach((c: any) => {
								categoryComments.push({
									...c,
									categoryId: category,
									itemId: docSnap.id,
								});
							});
						}
					});
					collectionsData.set(category, categoryComments);
					processMap();
				},
				(err) => {
					console.error(`Error fetching comments for ${category}:`, err);
				},
			);
			unsubscribers.push(unsub);
		});

		return () => {
			mounted = false;
			unsubscribers.forEach((unsub) => unsub());
		};
	}, []);

	const handleDelete = async (comment: GlobalComment) => {
		if (
			!window.confirm(
				isHindi
					? "क्या आप इस टिप्पणी को डिलीट करना चाहते हैं?"
					: "Are you sure you want to delete this comment?",
			)
		)
			return;

		setDeletingId(comment.id);
		try {
			const docRef = doc(db, `comments_${comment.categoryId}`, comment.itemId);

			// To use arrayRemove, we need the exact object. We recreate the object matching the DB structure.
			// IMPORTANT: all fields that exist in the stored comment must be included here — including
			// optional ones like authorPhotoURL and userId — otherwise arrayRemove will silently fail.
			const commentObjToRemove: any = {
				id: comment.id,
				text: comment.text,
				authorName: comment.authorName,
				timestamp: comment.timestamp,
			};
			if (comment.authorPhotoURL)
				commentObjToRemove.authorPhotoURL = comment.authorPhotoURL;
			if (comment.userId) commentObjToRemove.userId = comment.userId;

			await updateDoc(docRef, {
				comments: arrayRemove(commentObjToRemove),
			});

			showToast(isHindi ? "टिप्पणी डिलीट की गई" : "Comment deleted", "success");
		} catch (error) {
			console.error("Delete error:", error);
			showToast(isHindi ? "डिलीट विफल" : "Delete failed", "error");
		} finally {
			setDeletingId(null);
		}
	};

	const formatTime = (ts: number) => {
		return new Date(ts).toLocaleString(isHindi ? "hi-IN" : "en-US", {
			dateStyle: "medium",
			timeStyle: "short",
		});
	};

	const filteredComments = comments.filter((c) => {
		const matchesSearch =
			c.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
			c.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			c.categoryId.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesTab = activeTab === "all" || c.categoryId === activeTab;
		return matchesSearch && matchesTab;
	});

	const getContextInfo = (comment: GlobalComment) => {
		if (comment.categoryId === "videos") {
			const vTitle = videoTitles[comment.itemId] || "Unknown Video";
			const vFolder = videoFolderNames[comment.itemId] || "Unknown Folder";
			return {
				title: vTitle,
				subtitle: vFolder,
				icon1: <Video size={14} className="text-blue-500" />,
				icon2: (
					<Folder size={14} className="text-slate-400 dark:text-ink-400" />
				),
			};
		} else if (comment.categoryId === "information") {
			return {
				title: "Information Screen",
				subtitle: "Admin Notice",
				icon1: <Info size={14} className="text-blue-500" />,
				icon2: (
					<MessageSquare
						size={14}
						className="text-slate-400 dark:text-ink-400"
					/>
				),
			};
		} else {
			// darshan or activities. itemId format: mandalId_date or mandalId_timestamp
			const parts = comment.itemId.split("_");
			if (parts.length >= 2) {
				const mandalId = parts[0];
				const dateStr = parts.slice(1).join("_"); // normally YYYY-MM-DD
				const mandalName =
					MANDAL_LIST.find((m) => m.id === mandalId)?.shortNameHi || mandalId;
				return {
					title: mandalName,
					subtitle: dateStr,
					icon1: <MapPin size={14} className="text-red-500" />,
					icon2: <Calendar size={14} className="text-orange-500" />,
				};
			}
			return {
				title: "Unknown Location",
				subtitle: "Unknown Date",
				icon1: <MapPin size={14} className="text-red-500" />,
				icon2: <Calendar size={14} className="text-orange-500" />,
			};
		}
	};

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden animate-in fade-in">
			{/* Toolbar */}
			<div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-4 shrink-0">
				<div className="flex items-center gap-3 mb-2">
					<MessageSquare className="text-emerald-500" size={24} />
					<h2 className="text-xl font-bold text-slate-800 dark:text-white">
						{isHindi ? "टिप्पणी प्रबंधक" : "Comment Manager"}
					</h2>
					<span className="ml-auto bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-ink-300 px-3 py-1 rounded-full text-xs font-bold">
						{comments.length} {isHindi ? "कुल" : "Total"}
					</span>
				</div>
				<div className="relative">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ink-400"
						size={18}
					/>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={
							isHindi ? "टिप्पणी या नाम खोजें..." : "Search comment or author..."
						}
						className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-transparent rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
					/>
				</div>

				{/* Tabs */}
				<div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
					{[
						{ id: "all", label: isHindi ? "सभी" : "All" },
						{ id: "darshan", label: isHindi ? "दर्शन" : "Darshan" },
						{ id: "activities", label: isHindi ? "गतिविधियाँ" : "Activities" },
						{ id: "videos", label: isHindi ? "वीडियो" : "Videos" },
						{ id: "information", label: isHindi ? "सूचना" : "Information" },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id as any)}
							className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-bold transition-all ${
								activeTab === tab.id
									? "bg-emerald-500 text-white shadow-md"
									: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* List */}
			<div className="flex-1 overflow-y-auto p-4 space-y-3">
				{filteredComments.length === 0 ? (
					<div className="text-center py-12 text-slate-400 dark:text-ink-400">
						<MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
						<p>{isHindi ? "कोई टिप्पणी नहीं मिली" : "No comments found"}</p>
					</div>
				) : (
					filteredComments.map((comment) => (
						<div
							key={comment.id}
							className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 items-start transition-all hover:shadow-md"
						>
							<div className="w-10 h-10 rounded-full overflow-hidden shrink-0 mt-1">
								{comment.authorPhotoURL ? (
									<img
										src={comment.authorPhotoURL}
										alt=""
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-ink-400">
										<User size={20} />
									</div>
								)}
							</div>

							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1">
									<h4 className="font-bold text-slate-800 dark:text-white text-sm">
										{comment.authorName}
									</h4>
									<span className="text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-ink-300 px-2 py-0.5 rounded-full uppercase tracking-wide">
										{comment.categoryId}
									</span>
									<span className="text-[10px] text-slate-400 dark:text-ink-400 ml-auto shrink-0">
										{formatTime(comment.timestamp)}
									</span>
								</div>
								<p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-2">
									{comment.text}
								</p>

								{/* Context Info */}
								<div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
									<div className="flex items-center gap-1.5">
										{getContextInfo(comment).icon1}
										<span className="text-xs font-medium text-slate-600 dark:text-slate-300">
											{getContextInfo(comment).title}
										</span>
									</div>
									<div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-600 hidden md:block"></div>
									<div className="flex items-center gap-1.5">
										{getContextInfo(comment).icon2}
										<span className="text-xs text-slate-500 dark:text-slate-400">
											{getContextInfo(comment).subtitle}
										</span>
									</div>
								</div>
							</div>

							<button
								onClick={() => handleDelete(comment)}
								disabled={deletingId === comment.id}
								className="shrink-0 p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
								title={isHindi ? "डिलीट करें" : "Delete comment"}
							>
								{deletingId === comment.id ? (
									<Loader2 size={18} className="animate-spin" />
								) : (
									<Trash2 size={18} />
								)}
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
};

import {
	collection,
	type DocumentSnapshot,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	limit,
	orderBy,
	query,
	setDoc,
	startAfter,
	updateDoc,
} from "firebase/firestore";
import {
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	Calendar,
	Check,
	Copy,
	Download,
	Edit2,
	Heart,
	Info,
	Loader2,
	Mail,
	MapPin,
	MessageCircle,
	Phone,
	Radio,
	Search,
	ToggleLeft,
	ToggleRight,
	Trash2,
	User,
	Volume2,
	X,
	ZoomIn,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import { useAdminBack } from "../../src/hooks/useAdminBack";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import { normalizeB2Url, softDeleteFromB2 } from "../../src/utils/b2Uploader";
import { Toast, type ToastType } from "../Toast";
import { ThumbImg } from "../ui/ThumbImg";
import { THUMB } from "../../utils/imageThumb";
import { EditProfileButton } from "../../src/components/admin-panel/devoteeEditLink";

interface UserProfile {
	uid: string;
	email: string | null;
	realName: string;
	dikshaName: string;
	guruName: string;
	dikshaDate: string;
	mandalId: string;
	photoURL?: string;
	phoneNumber?: string;
	isAspiring?: boolean;
}

const OrderInput = ({
	currentIndex,
	totalItems,
	onMove,
}: {
	currentIndex: number;
	totalItems: number;
	onMove: (newIndex: number) => void;
}) => {
	const [val, setVal] = useState((currentIndex + 1).toString());

	useEffect(() => {
		setVal((currentIndex + 1).toString());
	}, [currentIndex]);

	const handleCommit = () => {
		let num = parseInt(val, 10);
		if (Number.isNaN(num)) {
			setVal((currentIndex + 1).toString());
			return;
		}
		num = num - 1;
		if (num < 0) num = 0;
		if (num >= totalItems) num = totalItems - 1;
		onMove(num);
	};

	return (
		<input
			type="number"
			value={val}
			onChange={(e) => setVal(e.target.value)}
			onBlur={handleCommit}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.currentTarget.blur();
				}
			}}
			className="w-12 h-8 rounded-lg bg-violet-600/30 text-violet-300 text-xs font-bold text-center border-none focus:ring-1 focus:ring-violet-400 outline-none placeholder:text-violet-400/50"
			min={1}
			max={totalItems}
		/>
	);
};

interface GlorificationManagerProps {
	onClose: () => void;
	isHindi: boolean;
}

interface GlorificationEntry {
	id: string;
	name: string;
	location: string;
	glorification: string;
	createdAt: number;
	uid?: string;
	phone?: string;
	email?: string;
	type?: "text" | "audio";
	audioUrl?: string;
	duration?: number;
	status?: "pending" | "approved" | "rejected";
}

interface PublishSettings {
	isPublished: boolean;
	publishedIds: string[];
}

export const GlorificationManager: React.FC<GlorificationManagerProps> = ({
	onClose,
	isHindi,
}) => {
	const [entries, setEntries] = useState<GlorificationEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [toastMessage, setToastMessage] = useState<{
		text: string;
		type: ToastType;
	} | null>(null);
	const [confirmEntry, setConfirmEntry] = useState<GlorificationEntry | null>(
		null,
	);
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
	const [hasMore, setHasMore] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [isDeepSearching, setIsDeepSearching] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const [editingEntry, setEditingEntry] = useState<GlorificationEntry | null>(
		null,
	);
	const [readingEntry, setReadingEntry] = useState<GlorificationEntry | null>(
		null,
	);
	const [editForm, setEditForm] = useState({
		name: "",
		location: "",
		glorification: "",
		phone: "",
		email: "",
	});

	const [profileViewEntry, setProfileViewEntry] =
		useState<GlorificationEntry | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [loadingProfile, setLoadingProfile] = useState(false);
	const [expandedUids, setExpandedUids] = useState<Set<string>>(new Set());

	const toggleUidExpand = (key: string) => {
		setExpandedUids((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};
	const [zoomImage, setZoomImage] = useState<string | null>(null);

	usePopupBackHandler(!!profileViewEntry, "glori-profile", () => {
		setProfileViewEntry(null);
		setUserProfile(null);
	});
	// The zoomed photo closes first and the profile stays. (This used to be
	// handled inside the profile's handler, which had already lost its history
	// entry — the next back then jumped past the still-open profile.)
	useAdminBack(!!zoomImage, () => setZoomImage(null));
	useAdminBack(!!confirmEntry, () => setConfirmEntry(null));

	usePopupBackHandler(!!readingEntry, "glori-reading", () => {
		setReadingEntry(null);
	});

	usePopupBackHandler(!!editingEntry, "glori-editing", () => {
		setEditingEntry(null);
	});

	// ── Publish Settings state ──────────────────────────────────────────────
	const [showPublishPanel, setShowPublishPanel] = useState(false);
	const [publishSettings, setPublishSettings] = useState<PublishSettings>({
		isPublished: false,
		publishedIds: [],
	});
	const [publishedOrder, setPublishedOrder] = useState<GlorificationEntry[]>(
		[],
	);
	const [savingPublish, setSavingPublish] = useState(false);
	const [_loadingPublish, setLoadingPublish] = useState(false);

	usePopupBackHandler(showPublishPanel, "glori-publish", () => {
		setShowPublishPanel(false);
	});

	const fetchPublishSettings = async () => {
		setLoadingPublish(true);
		try {
			const snap = await getDoc(
				doc(db, "app-settings", "glorification-reader"),
			);
			if (snap.exists()) {
				const data = snap.data();
				const settings: PublishSettings = {
					isPublished: data.isPublished ?? false,
					publishedIds: data.publishedIds ?? [],
				};
				setPublishSettings(settings);
			}
		} catch (err) {
			console.error("Failed to fetch publish settings", err);
		} finally {
			setLoadingPublish(false);
		}
	};

	const fetchEntries = async () => {
		setLoading(true);
		try {
			const q = query(
				collection(db, "hhbsm-2026-glorification"),
				orderBy("createdAt", "desc"),
				limit(50),
			);
			const querySnapshot = await getDocs(q);

			if (querySnapshot.empty) {
				setEntries([]);
				setHasMore(false);
				return;
			}

			setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
			setHasMore(querySnapshot.docs.length === 50);

			const all: GlorificationEntry[] = querySnapshot.docs.map((docSnap) => {
				const data = docSnap.data();
				return {
					id: docSnap.id,
					name: data.name || "",
					location: data.location || "",
					glorification: data.glorification || "",
					createdAt: data.createdAt || 0,
					uid: data.uid || undefined,
					phone: data.phone || undefined,
					email: data.email || undefined,
					type: data.type || "text",
					audioUrl: data.audioUrl || undefined,
					duration: data.duration || undefined,
					status: data.status || "pending",
				};
			});
			setEntries(all);
		} catch (error) {
			console.error("Error fetching glorifications:", error);
			setToastMessage({
				text: isHindi
					? "महिमा लोड करने में विफल"
					: "Failed to load glorifications",
				type: "error",
			});
		} finally {
			setLoading(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchPublishSettings, fetchEntries are recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		fetchEntries();
		fetchPublishSettings();
	}, []);

	const loadMore = async () => {
		if (!lastVisible || loadingMore) return;
		setLoadingMore(true);
		try {
			const q = query(
				collection(db, "hhbsm-2026-glorification"),
				orderBy("createdAt", "desc"),
				startAfter(lastVisible),
				limit(50),
			);
			const querySnapshot = await getDocs(q);

			if (querySnapshot.empty) {
				setHasMore(false);
				return;
			}

			setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
			setHasMore(querySnapshot.docs.length === 50);

			const more: GlorificationEntry[] = querySnapshot.docs.map((docSnap) => {
				const data = docSnap.data();
				return {
					id: docSnap.id,
					name: data.name || "",
					location: data.location || "",
					glorification: data.glorification || "",
					createdAt: data.createdAt || 0,
					uid: data.uid || undefined,
					phone: data.phone || undefined,
					email: data.email || undefined,
					type: data.type || "text",
					audioUrl: data.audioUrl || undefined,
					duration: data.duration || undefined,
					status: data.status || "pending",
				};
			});
			setEntries((prev) => [...prev, ...more]);
		} catch (error) {
			console.error("Error fetching more:", error);
			setToastMessage({
				text: isHindi ? "और लोड करने में विफल" : "Failed to load more",
				type: "error",
			});
		} finally {
			setLoadingMore(false);
		}
	};

	const handleDeepSearch = async () => {
		setIsDeepSearching(true);
		try {
			const q = query(
				collection(db, "hhbsm-2026-glorification"),
				orderBy("createdAt", "desc"),
			);
			const querySnapshot = await getDocs(q);

			const all: GlorificationEntry[] = querySnapshot.docs.map((docSnap) => {
				const data = docSnap.data();
				return {
					id: docSnap.id,
					name: data.name || "",
					location: data.location || "",
					glorification: data.glorification || "",
					createdAt: data.createdAt || 0,
					uid: data.uid || undefined,
					phone: data.phone || undefined,
					email: data.email || undefined,
					type: data.type || "text",
					audioUrl: data.audioUrl || undefined,
					duration: data.duration || undefined,
					status: data.status || "pending",
				};
			});
			setEntries(all);
			setHasMore(false);
			setToastMessage({
				text: isHindi
					? "सभी प्रविष्टियाँ खोज के लिए लोड हो गईं"
					: "All entries loaded for deep search",
				type: "success",
			});
		} catch (error) {
			console.error("Deep search error", error);
			setToastMessage({
				text: isHindi ? "खोज विफल" : "Deep search failed",
				type: "error",
			});
		} finally {
			setIsDeepSearching(false);
		}
	};

	const handleOpenProfile = async (entry: GlorificationEntry) => {
		if (!entry.uid) return;
		setProfileViewEntry(entry);
		setLoadingProfile(true);
		setUserProfile(null);
		try {
			const snap = await getDoc(doc(db, "users", entry.uid));
			if (snap.exists()) {
				setUserProfile(snap.data() as UserProfile);
			} else {
				setToastMessage({
					text: isHindi ? "प्रोफाइल नहीं मिली" : "Profile not found",
					type: "error",
				});
			}
		} catch (err) {
			console.error("Error fetching profile:", err);
			setToastMessage({ text: "Error loading profile", type: "error" });
		} finally {
			setLoadingProfile(false);
		}
	};

	const handleDelete = async (entry: GlorificationEntry) => {
		try {
			setIsDeleting(true);
			await deleteDoc(doc(db, "hhbsm-2026-glorification", entry.id));
			if (entry.type === "audio" && entry.audioUrl) {
				await softDeleteFromB2(entry.audioUrl);
			}
			setEntries((prev) => prev.filter((e) => e.id !== entry.id));
			setToastMessage({
				text: isHindi ? "हटा दिया गया" : "Entry deleted successfully",
				type: "success",
			});
			setConfirmEntry(null);
		} catch (error) {
			console.error("Error deleting glorification:", error);
			setToastMessage({
				text: isHindi ? "हटाने में विफल" : "Failed to delete entry",
				type: "error",
			});
		} finally {
			setIsDeleting(false);
		}
	};

	const handleEditSave = async () => {
		if (!editingEntry) return;
		try {
			await updateDoc(doc(db, "hhbsm-2026-glorification", editingEntry.id), {
				name: editForm.name.trim(),
				location: editForm.location.trim(),
				glorification: editForm.glorification.trim(),
				phone: editForm.phone?.trim() || "",
				email: editForm.email?.trim() || "",
			});
			setEntries((prev) =>
				prev.map((e) => (e.id === editingEntry.id ? { ...e, ...editForm } : e)),
			);
			setEditingEntry(null);
			setToastMessage({
				text: isHindi ? "अद्यतन किया गया" : "Entry updated successfully",
				type: "success",
			});
		} catch (error) {
			console.error("Error updating:", error);
			setToastMessage({
				text: isHindi ? "अद्यतन विफल" : "Failed to update entry",
				type: "error",
			});
		}
	};

	const handleCopy = async (key: string, text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedKey(key);
			setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
		} catch (error) {
			console.error("Error copying text:", error);
			setToastMessage({
				text: isHindi ? "कॉपी करने में विफल" : "Failed to copy",
				type: "error",
			});
		}
	};

	const handleExportCSV = async () => {
		try {
			setToastMessage({
				text: isHindi ? "निर्यात किया जा रहा है..." : "Exporting...",
				type: "success",
			});
			const q = query(
				collection(db, "hhbsm-2026-glorification"),
				orderBy("createdAt", "desc"),
			);
			const querySnapshot = await getDocs(q);

			if (querySnapshot.empty) {
				setToastMessage({
					text: isHindi
						? "निर्यात करने के लिए कोई डेटा नहीं है"
						: "No data to export",
					type: "warning",
				});
				return;
			}

			const headers = [
				"Name",
				"Location",
				"Phone",
				"Email",
				"Glorification",
				"Date",
			];
			const rows = querySnapshot.docs.map((docSnap) => {
				const e = docSnap.data();
				const dateStr = e.createdAt
					? new Date(e.createdAt).toLocaleString()
					: "";
				return [
					e.name || "",
					e.location || "",
					e.phone || "",
					e.email || "",
					e.type === "audio"
						? `AUDIO: ${e.audioUrl || ""}`
						: (e.glorification || "").replace(/\n/g, " ").replace(/"/g, '""'),
					dateStr,
				]
					.map((v) => `"${v}"`)
					.join(",");
			});

			const csvContent = `\uFEFF${[headers.join(","), ...rows].join("\n")}`;
			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.setAttribute("href", url);
			link.setAttribute(
				"download",
				`glorifications_export_${new Date().toISOString().split("T")[0]}.csv`,
			);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch (error) {
			console.error("Export error", error);
			setToastMessage({
				text: isHindi ? "निर्यात विफल" : "Export failed",
				type: "error",
			});
		}
	};

	const filteredEntries = entries.filter((e) => {
		const q = searchQuery.toLowerCase();
		if (!q) return true;
		return (
			e.name.toLowerCase().includes(q) ||
			e.location.toLowerCase().includes(q) ||
			e.glorification.toLowerCase().includes(q) ||
			(e.phone ?? "").toLowerCase().includes(q) ||
			(e.email ?? "").toLowerCase().includes(q)
		);
	});

	// ── Grouped entries by uid ───────────────────────────────────────────────
	type AdminGroup = {
		key: string;
		name: string;
		location: string;
		entries: GlorificationEntry[];
	};

	const groupedFiltered = (() => {
		const uidMap = new Map<string, AdminGroup>();
		const result: AdminGroup[] = [];
		for (const entry of filteredEntries) {
			if (entry.uid) {
				if (uidMap.has(entry.uid)) {
					uidMap.get(entry.uid)?.entries.push(entry);
				} else {
					const g: AdminGroup = {
						key: entry.uid,
						name: entry.name,
						location: entry.location,
						entries: [entry],
					};
					uidMap.set(entry.uid, g);
					result.push(g);
				}
			} else {
				result.push({
					key: entry.id,
					name: entry.name,
					location: entry.location,
					entries: [entry],
				});
			}
		}
		return result;
	})();

	const openPublishPanel = () => {
		// Pre-fill publishedOrder from current ids mapped to entries
		const idMap = new Map(entries.map((e) => [e.id, e]));
		const ordered = publishSettings.publishedIds
			.map((id) => idMap.get(id))
			.filter(Boolean) as GlorificationEntry[];
		setPublishedOrder(ordered);
		setShowPublishPanel(true);
	};

	const moveItem = (index: number, dir: 1 | -1) => {
		const newOrder = [...publishedOrder];
		const target = index + dir;
		if (target < 0 || target >= newOrder.length) return;
		[newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
		setPublishedOrder(newOrder);
	};

	const moveItemToPosition = (index: number, newIndex: number) => {
		const newOrder = [...publishedOrder];
		if (newIndex < 0) newIndex = 0;
		if (newIndex >= newOrder.length) newIndex = newOrder.length - 1;
		if (index === newIndex) return;

		const [item] = newOrder.splice(index, 1);
		newOrder.splice(newIndex, 0, item);
		setPublishedOrder(newOrder);
	};

	const togglePublishedItem = (entry: GlorificationEntry) => {
		setPublishedOrder((prev) => {
			const exists = prev.some((e) => e.id === entry.id);
			if (exists) return prev.filter((e) => e.id !== entry.id);
			return [...prev, entry];
		});
	};

	const savePublishSettings = async () => {
		if (savingPublish) return;
		setSavingPublish(true);
		try {
			const newSettings: PublishSettings = {
				isPublished: publishSettings.isPublished,
				publishedIds: publishedOrder.map((e) => e.id),
			};
			await setDoc(
				doc(db, "app-settings", "glorification-reader"),
				newSettings,
			);
			setPublishSettings(newSettings);
			setShowPublishPanel(false);
			setToastMessage({
				text: isHindi ? "प्रकाशन सेटिंग सहेजी गई" : "Publish settings saved",
				type: "success",
			});
		} catch (err) {
			console.error("Failed to save publish settings", err);
			setToastMessage({
				text: isHindi ? "सहेजने में विफल" : "Failed to save",
				type: "error",
			});
		} finally {
			setSavingPublish(false);
		}
	};

	const togglePublishedState = async () => {
		const newVal = !publishSettings.isPublished;
		try {
			await setDoc(
				doc(db, "app-settings", "glorification-reader"),
				{ isPublished: newVal },
				{ merge: true },
			);
			setPublishSettings((prev) => ({ ...prev, isPublished: newVal }));
			setToastMessage({
				text: newVal
					? isHindi
						? "महिमा पाठक प्रकाशित किया"
						: "Reader published"
					: isHindi
						? "महिमा पाठक छिपाया"
						: "Reader hidden",
				type: "success",
			});
		} catch (err) {
			console.error("Toggle publish error", err);
			setToastMessage({ text: "Failed", type: "error" });
		}
	};

	return (
		<div className="absolute inset-0 bg-slate-50 dark:bg-slate-900 flex flex-col z-[60] animate-in slide-in-from-right">
			<div className="flex-none shrink-0 bg-gradient-to-r from-rose-500 to-orange-500 text-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between shadow-lg">
				<div className="flex items-center gap-3">
					<button
						onClick={onClose}
						className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>
					<div>
						<h2 className="text-xl font-bold leading-tight drop-shadow-md">
							{isHindi ? "आविर्भाव महोत्सव महिमा" : "Aavirbhav Glorifications"}
						</h2>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
								{searchQuery
									? `${filteredEntries.length} / ${entries.length}`
									: entries.length}
								{isHindi ? " प्रविष्टियाँ" : " entries"}
							</span>
							{hasMore && <span className="text-[10px] opacity-70">+more</span>}
						</div>
					</div>
				</div>
				{/* Publish toggle */}
				<button
					onClick={togglePublishedState}
					title={isHindi ? "प्रकाशित/अप्रकाशित" : "Toggle Publish"}
					className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors active:scale-95"
				>
					{publishSettings.isPublished ? (
						<ToggleRight size={20} className="text-green-200" />
					) : (
						<ToggleLeft size={20} className="text-white/60" />
					)}
					<span className="text-xs font-bold hidden sm:inline">
						{publishSettings.isPublished
							? isHindi
								? "प्रकाशित"
								: "Published"
							: isHindi
								? "छिपा हुआ"
								: "Hidden"}
					</span>
				</button>
				<button
					onClick={openPublishPanel}
					title={isHindi ? "क्रम प्रबंधन" : "Manage Order"}
					className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors active:scale-95"
				>
					<Radio size={18} />
				</button>
			</div>

			{/* ── Publish Panel Overlay ──────────────────────────────────── */}
			{showPublishPanel && (
				<div className="absolute inset-0 z-10 bg-slate-900/95 flex flex-col animate-in slide-in-from-right">
					<div className="flex-none flex items-center gap-3 p-4 pt-[calc(1rem+env(safe-area-inset-top))] bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg">
						<button
							onClick={() => setShowPublishPanel(false)}
							className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
						>
							<ArrowLeft size={20} />
						</button>
						<div className="flex-1">
							<h3 className="font-bold text-lg">
								{isHindi ? "प्रकाशन क्रम" : "Publish Order"}
							</h3>
							<p className="text-xs opacity-80">
								{isHindi
									? `${publishedOrder.length} चुने गए`
									: `${publishedOrder.length} selected`}
							</p>
						</div>
						<button
							onClick={savePublishSettings}
							disabled={savingPublish}
							className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 font-bold text-sm transition-colors active:scale-95 disabled:opacity-50"
						>
							{savingPublish ? (
								<Loader2 size={16} className="animate-spin" />
							) : (
								<Check size={16} />
							)}
							{isHindi ? "सहेजें" : "Save"}
						</button>
					</div>

					{/* Selected / ordered items */}
					<div className="flex-1 overflow-y-auto p-4 space-y-2 pb-[env(safe-area-inset-bottom)]">
						<p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
							{isHindi
								? "प्रकाशन क्रम (ऊपर/नीचे खींचें)"
								: "Display Order (use arrows)"}
						</p>
						{publishedOrder.map((entry, idx) => (
							<div
								key={entry.id}
								className="bg-slate-800 rounded-2xl p-3 flex items-center gap-3 border border-violet-500/30"
							>
								<OrderInput
									currentIndex={idx}
									totalItems={publishedOrder.length}
									onMove={(newIndex) => moveItemToPosition(idx, newIndex)}
								/>
								<div className="flex-1 min-w-0">
									<p className="text-xs font-bold text-white truncate">
										{entry.name}
									</p>
									<p className="text-[10px] text-slate-400 line-clamp-1">
										{entry.type === "audio"
											? "🔊 Audio Message"
											: entry.glorification}
									</p>
								</div>
								<div className="flex flex-col gap-0.5 shrink-0">
									<button
										onClick={() => moveItem(idx, -1)}
										disabled={idx === 0}
										className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600 disabled:opacity-20 transition-colors"
									>
										<ArrowUp size={14} />
									</button>
									<button
										onClick={() => moveItem(idx, 1)}
										disabled={idx === publishedOrder.length - 1}
										className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600 disabled:opacity-20 transition-colors"
									>
										<ArrowDown size={14} />
									</button>
								</div>
								<button
									onClick={() => togglePublishedItem(entry)}
									className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors shrink-0"
								>
									<X size={14} />
								</button>
							</div>
						))}

						<p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-5 mb-3">
							{isHindi ? "सभी उपलब्ध महिमाएँ" : "All available glorifications"}
						</p>
						{entries
							.filter(
								(e) =>
									!publishedOrder.some((p) => p.id === e.id) &&
									e.type !== "audio",
							)
							.map((entry) => (
								<div
									key={entry.id}
									className="bg-slate-800/50 rounded-2xl p-3 flex items-center gap-3 border border-slate-700 cursor-pointer hover:border-violet-500/50 transition-colors"
									onClick={() => togglePublishedItem(entry)}
								>
									<div className="flex-1 min-w-0">
										<p className="text-xs font-bold text-slate-300 truncate">
											{entry.name}
										</p>
										<p className="text-[10px] text-slate-500 line-clamp-1">
											{entry.type === "audio"
												? "🔊 Audio Message"
												: entry.glorification}
										</p>
									</div>
									<div className="w-5 h-5 rounded border border-slate-600 flex items-center justify-center shrink-0">
										<Check size={12} className="text-slate-600" />
									</div>
								</div>
							))}
					</div>
				</div>
			)}

			<div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex gap-3">
				<div className="relative flex-1">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ink-400"
						size={20}
					/>
					<input
						type="text"
						placeholder={isHindi ? "खोजें..." : "Search by name, location..."}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-700/50 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-white"
					/>
					{searchQuery && hasMore && (
						<button
							onClick={handleDeepSearch}
							disabled={isDeepSearching}
							className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-colors disabled:opacity-50"
							title={isHindi ? "पूरे डेटाबेस में खोजें" : "Search entire database"}
						>
							{isDeepSearching ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Search size={14} />
							)}
							<span className="hidden sm:inline">
								{isHindi ? "डीप सर्च" : "Deep Search"}
							</span>
						</button>
					)}
				</div>
				<button
					onClick={handleExportCSV}
					className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl font-medium text-slate-700 dark:text-slate-200 transition-colors shrink-0 active:scale-95 shadow-sm"
					title={isHindi ? "CSV में निर्यात करें" : "Export to CSV"}
				>
					<Download size={18} />
					<span className="hidden sm:inline font-bold text-sm">CSV</span>
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-3 pb-[env(safe-area-inset-bottom)]">
				{loading ? (
					<div className="flex items-center justify-center h-40">
						<Loader2 className="w-8 h-8 animate-spin text-rose-500" />
					</div>
				) : groupedFiltered.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-ink-400">
						<Heart size={48} className="mb-4 opacity-50" />
						<p>{isHindi ? "कोई प्रविष्टि नहीं मिली" : "No entries found"}</p>
					</div>
				) : (
					<>
						{groupedFiltered.map((group) => {
							const isMulti = group.entries.length > 1;
							const isExpanded = isMulti ? expandedUids.has(group.key) : true;

							return (
								<div
									key={group.key}
									className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"
								>
									{/* ── Group Header (collapsed summary) ── */}
									<div
										className={`w-full text-left flex items-center gap-3 px-4 pt-4 pb-3 ${!isMulti ? "" : "hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"}`}
										onClick={() => {
											if (isMulti) toggleUidExpand(group.key);
										}}
									>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5 flex-wrap">
												<button
													type="button"
													onClick={(e) => {
														if (group.entries[0].uid) {
															e.stopPropagation();
															handleOpenProfile(group.entries[0]);
														}
													}}
													className={`font-bold text-base truncate flex items-center gap-1.5 focus:outline-none text-left transition-colors ${group.entries[0].uid ? "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" : "text-slate-800 dark:text-white cursor-text"}`}
												>
													{group.name}
													{group.entries[0].uid && (
														<Info size={14} className="shrink-0" />
													)}
												</button>
												{isMulti && (
													<span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
														{isHindi
															? `${group.entries.length} प्रविष्टियाँ`
															: `${group.entries.length} entries`}
													</span>
												)}
											</div>
											<div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
												<MapPin size={11} className="shrink-0" />
												<span className="truncate">{group.location}</span>
												{!isMulti && (
													<>
														<span className="text-slate-300 dark:text-slate-600">
															·
														</span>
														<span className="shrink-0 text-slate-400 dark:text-slate-500">
															{group.entries[0].createdAt
																? new Date(
																		group.entries[0].createdAt,
																	).toLocaleDateString(undefined, {
																		day: "numeric",
																		month: "short",
																		year: "2-digit",
																	})
																: ""}
														</span>
													</>
												)}
											</div>
										</div>
										{/* Expand/Collapse chevron */}
										<div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 pr-1">
											{isMulti &&
												(isExpanded ? (
													<ArrowUp size={15} />
												) : (
													<ArrowDown size={15} />
												))}
										</div>
									</div>

									{/* ── Expanded: render all entries in this group ── */}
									{isExpanded && (
										<div className="border-t border-slate-100 dark:border-slate-700">
											{group.entries.map((entry, eIdx) => (
												<div
													key={entry.id}
													className={
														eIdx > 0
															? "border-t border-dashed border-slate-200 dark:border-slate-600"
															: ""
													}
												>
													{/* Sub-entry label for multi entries */}
													{isMulti && (
														<div className="px-4 pt-3 pb-1 flex items-center justify-between">
															<span className="text-[10px] font-black uppercase tracking-wider text-rose-500 dark:text-rose-400">
																{isHindi
																	? `प्रविष्टि ${eIdx + 1}`
																	: `Entry ${eIdx + 1}`}
															</span>
															<span className="text-[10px] text-slate-400">
																{entry.createdAt
																	? new Date(
																			entry.createdAt,
																		).toLocaleDateString(undefined, {
																			day: "numeric",
																			month: "short",
																			year: "2-digit",
																		})
																	: ""}
															</span>
														</div>
													)}

													{/* Contact Info Row: Phone + Email */}
													{(entry.phone || entry.email) && (
														<div className="mx-4 mb-3 flex flex-wrap gap-2">
															{entry.phone && (
																<a
																	href={`tel:${entry.phone}`}
																	className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors active:scale-95"
																>
																	<Phone size={11} />
																	{entry.phone}
																	<button
																		onClick={(e) => {
																			e.preventDefault();
																			handleCopy(
																				`${entry.id}-phone`,
																				entry.phone!,
																			);
																		}}
																		className="ml-0.5 p-0.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
																	>
																		{copiedKey === `${entry.id}-phone` ? (
																			<Check
																				size={10}
																				className="text-emerald-600"
																			/>
																		) : (
																			<Copy size={10} />
																		)}
																	</button>
																</a>
															)}
															{entry.email && (
																<a
																	href={`mailto:${entry.email}`}
																	className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/25 border border-blue-200 dark:border-blue-700 text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors active:scale-95 max-w-full"
																>
																	<Mail size={11} className="shrink-0" />
																	<span className="truncate">
																		{entry.email}
																	</span>
																	<button
																		onClick={(e) => {
																			e.preventDefault();
																			handleCopy(
																				`${entry.id}-email`,
																				entry.email!,
																			);
																		}}
																		className="ml-0.5 p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors shrink-0"
																	>
																		{copiedKey === `${entry.id}-email` ? (
																			<Check
																				size={10}
																				className="text-blue-600"
																			/>
																		) : (
																			<Copy size={10} />
																		)}
																	</button>
																</a>
															)}
														</div>
													)}

													{/* Glorification Text or Audio */}
													<div className="mx-4 mb-3">
														<div className="relative bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
															{entry.type === "audio" ? (
																<div className="flex flex-col gap-2">
																	<div className="flex items-center gap-2">
																		<div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
																			<Volume2 size={16} />
																		</div>
																		<p className="text-sm font-bold text-slate-700 dark:text-slate-300">
																			{isHindi ? "ऑडियो संदेश" : "Audio Message"}
																		</p>
																		{entry.duration ? (
																			<span className="text-xs font-medium text-slate-500">
																				({Math.floor(entry.duration / 60)}:
																				{(entry.duration % 60)
																					.toString()
																					.padStart(2, "0")}
																				)
																			</span>
																		) : null}
																	</div>
																	{entry.audioUrl && (
																		<audio
																			controls
																			src={normalizeB2Url(entry.audioUrl)}
																			className="w-full h-10 mt-1"
																			onPlay={(e) => {
																				const audios =
																					document.getElementsByTagName(
																						"audio",
																					);
																				for (
																					let i = 0;
																					i < audios.length;
																					i++
																				) {
																					if (audios[i] !== e.currentTarget)
																						audios[i].pause();
																				}
																			}}
																		/>
																	)}
																</div>
															) : (
																<>
																	<div
																		className="cursor-pointer group"
																		onClick={() => setReadingEntry(entry)}
																	>
																		<p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap line-clamp-4 leading-relaxed pr-7 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
																			{entry.glorification}
																		</p>
																		<span className="text-[10px] text-blue-500 font-medium mt-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity">
																			{isHindi
																				? "पूरा पढ़ने के लिए टैप करें"
																				: "Tap to read full text"}
																		</span>
																	</div>
																	<button
																		onClick={() =>
																			handleCopy(
																				`${entry.id}-text`,
																				entry.glorification,
																			)
																		}
																		className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors active:scale-95"
																		title="Copy text"
																	>
																		{copiedKey === `${entry.id}-text` ? (
																			<Check
																				size={13}
																				className="text-emerald-500"
																			/>
																		) : (
																			<Copy size={13} />
																		)}
																	</button>
																</>
															)}
														</div>
													</div>

													{/* Per-entry action buttons (edit/delete) */}
													<div className="px-4 pb-3 flex items-center justify-between gap-2">
														<div className="flex items-center gap-1">
															{entry.uid && (
																<button
																	onClick={() => handleOpenProfile(entry)}
																	className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors active:scale-95 text-xs font-bold flex items-center gap-1"
																	title={isHindi ? "प्रोफाइल" : "Profile"}
																>
																	<Info size={14} />
																</button>
															)}
														</div>
														<div className="flex items-center gap-1">
															<button
																onClick={() => {
																	setEditingEntry(entry);
																	setEditForm({
																		name: entry.name,
																		location: entry.location,
																		glorification: entry.glorification,
																		phone: entry.phone ?? "",
																		email: entry.email ?? "",
																	});
																}}
																className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors active:scale-95"
																title="Edit"
															>
																<Edit2 size={17} />
															</button>
															<button
																onClick={() => setConfirmEntry(entry)}
																className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors active:scale-95"
																title="Delete"
															>
																<Trash2 size={17} />
															</button>
														</div>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							);
						})}

						{hasMore && !searchQuery && (
							<div className="flex justify-center pt-2 pb-6">
								<button
									onClick={loadMore}
									disabled={loadingMore}
									className="px-6 py-2.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors active:scale-95 flex items-center gap-2"
								>
									{loadingMore && (
										<Loader2 size={16} className="animate-spin" />
									)}
									{isHindi ? "और लोड करें" : "Load More"}
								</button>
							</div>
						)}
					</>
				)}
			</div>

			{/* Read-Only Full Screen Modal */}
			{readingEntry && (
				<div className="fixed inset-0 bg-white dark:bg-slate-900 z-[100] flex flex-col animate-in slide-in-from-bottom-2">
					<div className="flex-none flex items-center gap-3 p-4 pt-[calc(1rem+env(safe-area-inset-top))] bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0">
						<button
							onClick={() => setReadingEntry(null)}
							className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors active:scale-95 text-slate-600 dark:text-slate-300"
						>
							<ArrowLeft size={24} />
						</button>
						<div className="flex-1 min-w-0">
							<h3 className="font-bold text-lg text-slate-800 dark:text-white truncate">
								{readingEntry.name}
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400 truncate">
								{readingEntry.location}
							</p>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-6 pb-[env(safe-area-inset-bottom)]">
						{readingEntry.type === "audio" ? (
							<div className="flex flex-col items-center justify-center h-full gap-6 max-w-sm mx-auto">
								<div className="w-24 h-24 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center mb-2">
									<Volume2 size={48} />
								</div>
								<h2 className="text-xl font-bold text-slate-800 dark:text-white">
									{isHindi ? "ऑडियो संदेश" : "Audio Message"}
								</h2>
								{readingEntry.audioUrl && (
									<audio
										controls
										src={normalizeB2Url(readingEntry.audioUrl)}
										className="w-full h-12"
										autoPlay
									/>
								)}
							</div>
						) : (
							<div className="max-w-2xl mx-auto w-full">
								<p className="text-slate-800 dark:text-slate-200 text-base sm:text-lg whitespace-pre-wrap leading-relaxed font-medium">
									{readingEntry.glorification}
								</p>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Edit Full Screen Modal */}
			{editingEntry && (
				<div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[100] flex flex-col animate-in slide-in-from-bottom-2">
					<div className="flex-none flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))] bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-10">
						<div className="flex items-center gap-3">
							<button
								onClick={() => setEditingEntry(null)}
								className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors active:scale-95 text-slate-600 dark:text-slate-300"
							>
								<ArrowLeft size={24} />
							</button>
							<h3 className="font-bold text-lg text-slate-800 dark:text-white">
								{isHindi ? "संपादित करें" : "Edit Entry"}
							</h3>
						</div>
						<button
							onClick={handleEditSave}
							className="px-5 py-2 rounded-xl font-bold text-sm bg-blue-500 hover:bg-blue-600 text-white active:scale-95 transition-all shadow-sm flex items-center gap-2"
						>
							<Check size={16} />
							{isHindi ? "सहेजें" : "Save"}
						</button>
					</div>

					<div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[env(safe-area-inset-bottom)]">
						<div className="max-w-3xl mx-auto flex flex-col gap-5 h-full">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5 block">
										Name
									</label>
									<input
										value={editForm.name}
										onChange={(e) =>
											setEditForm({ ...editForm, name: e.target.value })
										}
										className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
									/>
								</div>
								<div>
									<label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5 block">
										Location
									</label>
									<input
										value={editForm.location}
										onChange={(e) =>
											setEditForm({ ...editForm, location: e.target.value })
										}
										className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
									/>
								</div>
								<div>
									<label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5 block">
										Phone
									</label>
									<input
										value={editForm.phone}
										onChange={(e) =>
											setEditForm({ ...editForm, phone: e.target.value })
										}
										className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
									/>
								</div>
								<div>
									<label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5 block">
										Email
									</label>
									<input
										value={editForm.email}
										onChange={(e) =>
											setEditForm({ ...editForm, email: e.target.value })
										}
										className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
									/>
								</div>
							</div>

							{editingEntry.type !== "audio" ? (
								<div className="flex-1 flex flex-col mt-2 min-h-[300px]">
									<label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5 block">
										Glorification Text
									</label>
									<textarea
										value={editForm.glorification}
										onChange={(e) =>
											setEditForm({
												...editForm,
												glorification: e.target.value,
											})
										}
										className="w-full flex-1 resize-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-base sm:text-lg text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm leading-relaxed"
									/>
								</div>
							) : (
								<div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mt-2 p-6 shadow-sm">
									<Volume2 size={48} className="text-rose-400 mb-4" />
									<p className="text-slate-500 mb-4">
										Cannot edit text for audio glorifications.
									</p>
									{editingEntry.audioUrl && (
										<audio
											controls
											preload="metadata"
											src={normalizeB2Url(editingEntry.audioUrl)}
											className="w-full max-w-sm"
										/>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirm Modal */}
			{confirmEntry && (
				<div
					className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
					onClick={() => setConfirmEntry(null)}
				>
					<div
						className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
							<Trash2 size={24} className="text-red-500" />
						</div>
						<h3 className="text-lg font-bold text-slate-800 dark:text-white text-center mb-2">
							{isHindi ? "पुष्टि करें" : "Confirm Delete"}
						</h3>
						<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
							{isHindi
								? "क्या आप वाकई इस महिमा को हटाना चाहते हैं?"
								: "Are you sure you want to delete this entry?"}
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setConfirmEntry(null)}
								disabled={isDeleting}
								className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 active:scale-95 transition-transform disabled:opacity-50"
							>
								{isHindi ? "रद्द करें" : "Cancel"}
							</button>
							<button
								onClick={() => handleDelete(confirmEntry)}
								disabled={isDeleting}
								className="flex-1 px-4 py-3 flex items-center justify-center gap-2 rounded-2xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white active:scale-95 transition-all shadow-sm disabled:opacity-50"
							>
								{isDeleting ? (
									<Loader2 size={16} className="animate-spin" />
								) : isHindi ? (
									"हटाएं"
								) : (
									"Delete"
								)}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* User Profile Full Screen Modal */}
			{profileViewEntry && (
				<div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[100] flex flex-col animate-in slide-in-from-bottom-2">
					<div className="flex-none flex items-center gap-3 p-4 pt-[calc(1rem+env(safe-area-inset-top))] bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0">
						<button
							onClick={() => {
								setProfileViewEntry(null);
								setUserProfile(null);
							}}
							className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors active:scale-95 text-slate-600 dark:text-slate-300"
						>
							<ArrowLeft size={24} />
						</button>
						<h3 className="flex-1 min-w-0 font-bold text-lg text-slate-800 dark:text-white truncate">
							{isHindi ? "भक्त प्रोफाइल" : "Devotee Profile"}
						</h3>
						{profileViewEntry.uid && userProfile && (
							<EditProfileButton
								target={{ uid: profileViewEntry.uid }}
								isHindi={isHindi}
								name={userProfile.realName || profileViewEntry.name}
								onClosed={(changed) => {
									if (changed) handleOpenProfile(profileViewEntry);
								}}
							/>
						)}
					</div>

					<div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[env(safe-area-inset-bottom)]">
						<div className="max-w-2xl mx-auto">
							{loadingProfile ? (
								<div className="flex flex-col items-center justify-center py-20">
									<Loader2
										size={32}
										className="animate-spin text-blue-500 mb-4"
									/>
									<p className="text-slate-500">
										{isHindi ? "प्रोफाइल लोड हो रही है..." : "Loading profile..."}
									</p>
								</div>
							) : userProfile ? (
								<div className="relative bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-6 items-start">
									{/* Avatar */}
									<div
										className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden shrink-0 cursor-pointer border-2 border-transparent hover:border-emerald-500 transition-colors relative group bg-slate-100 dark:bg-slate-900"
										onClick={() =>
											userProfile.photoURL && setZoomImage(userProfile.photoURL)
										}
									>
										{userProfile.photoURL ? (
											<>
												<ThumbImg
													src={userProfile.photoURL}
													thumbWidth={THUMB.tile}
													alt="Profile"
													className="w-full h-full object-cover"
												/>
												<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
													<ZoomIn size={20} className="text-white" />
												</div>
											</>
										) : (
											<div className="w-full h-full flex items-center justify-center text-emerald-600">
												<User size={40} />
											</div>
										)}
									</div>

									<div className="flex-1 min-w-0 flex flex-col gap-1.5 w-full">
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1">
												<h4 className="font-bold text-xl text-slate-800 dark:text-white leading-tight break-words">
													{userProfile.realName || profileViewEntry.name}
												</h4>
												<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
													{userProfile.email}
												</p>
											</div>
										</div>

										<div className="flex flex-col gap-2 mt-3 text-sm text-slate-600 dark:text-slate-400">
											<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
												{userProfile.dikshaName && (
													<span className="flex items-center gap-1.5 font-medium">
														<User
															size={16}
															className="text-slate-400 dark:text-ink-400"
														/>
														{userProfile.dikshaName}
													</span>
												)}
												{userProfile.mandalId && (
													<span className="flex items-center gap-1.5">
														<MapPin
															size={16}
															className="text-slate-400 dark:text-ink-400"
														/>
														{userProfile.mandalId}
													</span>
												)}
												{userProfile.dikshaDate && (
													<span className="flex items-center gap-1.5">
														<Calendar
															size={16}
															className="text-slate-400 dark:text-ink-400"
														/>
														{userProfile.dikshaDate}
													</span>
												)}
												{userProfile.phoneNumber && (
													<a
														href={`https://wa.me/${userProfile.phoneNumber.replace(/[^0-9]/g, "")}`}
														target="_blank"
														rel="noopener noreferrer"
														className="flex items-center gap-1.5 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors group bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg"
													>
														<Phone
															size={14}
															className="text-slate-400 dark:text-ink-400 group-hover:text-emerald-500"
														/>
														{userProfile.phoneNumber}
														<MessageCircle
															size={14}
															className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
														/>
													</a>
												)}
											</div>

											{userProfile.guruName && (
												<span className="flex items-start gap-1.5 mt-1 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">
													<User
														size={16}
														className="text-slate-400 dark:text-ink-400 shrink-0 mt-0.5"
													/>
													<span className="font-medium text-slate-700 dark:text-slate-300">
														{isHindi ? "गुरु: " : "Guru: "}
														{userProfile.guruName}
													</span>
												</span>
											)}
										</div>
									</div>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center py-20 text-slate-400">
									<User size={48} className="mb-4 opacity-50" />
									<p>
										{isHindi ? "कोई विवरण उपलब्ध नहीं" : "No details available"}
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Zoom Image Overlay */}
			{zoomImage && (
				<div
					className="fixed inset-0 bg-black/90 z-[120] flex flex-col animate-in fade-in"
					onClick={() => setZoomImage(null)}
				>
					<div className="flex-none flex justify-end p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
						<button
							onClick={() => setZoomImage(null)}
							className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-95"
						>
							<X size={24} />
						</button>
					</div>
					<div className="flex-1 flex items-center justify-center p-4">
						<img
							src={zoomImage}
							alt="Zoomed Profile"
							className="max-w-full max-h-full object-contain rounded-lg animate-in zoom-in-95 duration-200"
							onClick={(e) => e.stopPropagation()}
						/>
					</div>
				</div>
			)}

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

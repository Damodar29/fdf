import {
	collection,
	doc,
	onSnapshot,
	query,
	setDoc,
	updateDoc,
	where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
	AlertTriangle,
	ArrowLeft,
	Bell,
	BellOff,
	Calendar,
	Camera,
	Check,
	CheckCircle,
	ChevronDown,
	Edit2,
	Loader2,
	Plus,
	Search,
	User,
	Users,
	XCircle,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { db, profileStorage as storage } from "../../../services/firebase";
import { MANDAL_LIST } from "../../../src/types/mandal";
import { useAdminBack } from "../../hooks/useAdminBack";
import { sendPushNotification } from "../../utils/sendPushNotification";
import { ThumbImg } from "../../../components/ui/ThumbImg";
import { THUMB } from "../../../utils/imageThumb";

/* ── Image compression ── */
const compressImage = (
	file: File,
	maxSize = 300,
	quality = 0.75,
): Promise<Blob> =>
	new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);
		img.onload = () => {
			URL.revokeObjectURL(url);
			const canvas = document.createElement("canvas");
			const size = Math.min(img.width, img.height);
			canvas.width = maxSize;
			canvas.height = maxSize;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(
				img,
				(img.width - size) / 2,
				(img.height - size) / 2,
				size,
				size,
				0,
				0,
				maxSize,
				maxSize,
			);
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("fail"))),
				"image/jpeg",
				quality,
			);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("load fail"));
		};
		img.src = url;
	});

/* ── Same GURU_OPTIONS as ProfileScreen & DevoteeProfileManager ── */
const GURU_OPTIONS = [
	{ id: "virahi", name: 'श्री श्री 1008 श्री वासुदेव शरण जी महाराज "विरही"' },
	{ id: "chakradhar", name: 'श्री श्रील गुरुदेव "भक्तिशास्त्री" जी महाराज' },
	{ id: "harekrishna", name: "श्री श्री हरे कृष्ण दास जी महाराज" },
	{ id: "other", name: "अन्य (Other)" },
	{ id: "aspiring", name: "आकांक्षी (Aspiring)" },
] as const;
type GuruId = (typeof GURU_OPTIONS)[number]["id"];

const resolveGuruName = (sel: string, custom: string): string => {
	if (!sel) return "";
	if (sel === "aspiring") return "आकांक्षी";
	if (sel === "other") return custom.trim();
	return GURU_OPTIONS.find((o) => o.id === sel)?.name || "";
};
const deriveGuruSelection = (
	stored: string,
): { selection: GuruId | ""; custom: string } => {
	if (!stored) return { selection: "", custom: "" };
	if (stored === "आकांक्षी") return { selection: "aspiring", custom: "" };
	const preset = GURU_OPTIONS.find(
		(o) => o.id !== "other" && o.id !== "aspiring" && o.name === stored,
	);
	if (preset) return { selection: preset.id as GuruId, custom: "" };
	return { selection: "other", custom: stored };
};

interface MandalAdminPanelProps {
	currentUser: UserProfile;
	onClose: () => void;
	settingsLanguage: string;
	overrideMandalId?: string;
}

type TabType = "pending" | "rejected" | "all";
type ViewMode = "list" | "add-edit";

const EMPTY_FORM = {
	realName: "",
	dikshaName: "",
	phoneNumber: "",
	guruName: "",
	dikshaDate: "",
	isAspiring: false,
	personalExperience: "",
	photoURL: "",
};

export const MandalAdminPanel: React.FC<MandalAdminPanelProps> = ({
	currentUser,
	onClose,
	settingsLanguage,
	overrideMandalId,
}) => {
	const isHindi = settingsLanguage === "hi";
	const { showToast } = useToast();
	const mandalId = overrideMandalId || currentUser.mandalAdminFor || "";
	const mandalName =
		MANDAL_LIST.find((m) => m.id === mandalId)?.name || mandalId;

	/* â”€â”€ List state â”€â”€ */
	const [devotees, setDevotees] = useState<UserProfile[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState<TabType>("pending");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [bulkLoading, setBulkLoading] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);

	/* â”€â”€ Add/Edit state â”€â”€ */
	const [selectedDevotee, setSelectedDevotee] = useState<UserProfile | null>(
		null,
	);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [editForm, setEditForm] = useState(EMPTY_FORM);
	const [guruSelection, setGuruSelection] = useState<GuruId | "">("");
	const [customGuruName, setCustomGuruName] = useState("");
	const [showGuruDropdown, setShowGuruDropdown] = useState(false);

	/* â”€â”€ Photo state â”€â”€ */
	const [uploadingPhoto, setUploadingPhoto] = useState(false);
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	/* â”€â”€ Reject state â”€â”€ */
	const [rejectNote, setRejectNote] = useState("");
	const [rejectSilent, setRejectSilent] = useState(false);

	/* ── Hardware back ──
	   The edit form is a level of its own: back returns to the list (like the
	   header arrow) instead of dropping the form; an open guru list closes first. */
	useAdminBack(viewMode === "add-edit", () => setViewMode("list"));
	useAdminBack(showGuruDropdown, () => setShowGuruDropdown(false));

	/* ── Live data ── */
	useEffect(() => {
		if (!mandalId) return;
		const q = query(collection(db, "users"), where("mandalId", "==", mandalId));
		return onSnapshot(
			q,
			(snap) => {
				setDevotees(
					snap.docs
						.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)
						.filter((d) => !d.isDeleted),
				);
				setLoading(false);
			},
			() => setLoading(false),
		);
	}, [mandalId]);

	/* â”€â”€ Derived lists â”€â”€ */
	const pending = devotees.filter(
		(d) => d.submittedForReview && !d.isApproved && !d.rejectionNote,
	);
	const rejected = devotees.filter((d) => !!d.rejectionNote && !d.isApproved);
	const tabList =
		activeTab === "pending"
			? pending
			: activeTab === "rejected"
				? rejected
				: devotees;
	const filtered = tabList.filter((d) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return (
			(d.realName || "").toLowerCase().includes(q) ||
			(d.dikshaName || "").toLowerCase().includes(q)
		);
	});

	/* â”€â”€ Approve â”€â”€ */
	const handleApprove = async (devotee: UserProfile) => {
		setIsProcessing(true);
		try {
			await updateDoc(doc(db, "users", devotee.uid), {
				isApproved: true,
				approvalDate: Date.now(),
				rejectionNote: "",
				hasPendingEdits: false,
				approvedBy: currentUser.uid,
			});
			if (devotee.fcmTokens?.length) {
				sendPushNotification({
					tokens: devotee.fcmTokens,
					title: isHindi ? "प्रोफाइल स्वीकृत" : "Profile Approved",
					body: isHindi
						? "आपकी प्रोफाइल स्वीकृत हो गई! 🎉"
						: "Your profile has been approved! 🎉",
					silent: false,
					actionType: "screen",
					targetScreen: "profile",
				}).catch(() => {});
			}
			showToast(isHindi ? "स्वीकृत ✅" : "Approved ✅", "success");
		} catch {
			showToast("Failed", "error");
		}
		setIsProcessing(false);
	};

	/* ── Bulk Approve ── */
	const handleBulkApprove = async () => {
		if (!selectedIds.size) return;
		setBulkLoading(true);
		const approvalDate = Date.now();
		const toApprove = filtered.filter((d) => selectedIds.has(d.uid));
		// allSettled: one failed write used to reject the whole Promise.all,
		// leaving the button spinning forever with no message.
		const results = await Promise.allSettled(
			toApprove.map(async (devotee) => {
				await updateDoc(doc(db, "users", devotee.uid), {
					isApproved: true,
					approvalDate,
					rejectionNote: "",
					hasPendingEdits: false,
					approvedBy: currentUser.uid,
				});
				if (devotee.fcmTokens?.length) {
					sendPushNotification({
						tokens: devotee.fcmTokens,
						title: isHindi ? "प्रोफाइल स्वीकृत" : "Profile Approved",
						body: isHindi
							? "आपकी प्रोफाइल स्वीकृत हो गई! 🎉"
							: "Your profile has been approved! 🎉",
						silent: false,
						actionType: "screen",
						targetScreen: "profile",
					}).catch(() => {});
				}
			}),
		);
		const failed = results.filter((r) => r.status === "rejected").length;
		const approved = toApprove.length - failed;
		setSelectedIds(
			new Set(
				toApprove
					.filter((_, i) => results[i].status === "rejected")
					.map((d) => d.uid),
			),
		);
		setBulkLoading(false);
		if (approved > 0) {
			showToast(
				isHindi ? `${approved} भक्त स्वीकृत ✅` : `${approved} approved ✅`,
				"success",
			);
		}
		if (failed > 0) {
			showToast(
				isHindi
					? `${failed} स्वीकृत नहीं हो सके`
					: `${failed} could not be approved`,
				"error",
			);
		}
	};

	/* ── Reject (NOW WITH PUSH NOTIFICATION) ── */
	const handleReject = async (devotee: UserProfile) => {
		if (!rejectNote.trim()) {
			showToast(isHindi ? "कारण लिखें" : "Reason required", "warning");
			return;
		}
		setIsProcessing(true);
		try {
			await updateDoc(doc(db, "users", devotee.uid), {
				isApproved: false,
				rejectionNote: rejectNote,
				rejectedBy: currentUser.uid,
			});
			if (devotee.fcmTokens?.length) {
				sendPushNotification({
					tokens: devotee.fcmTokens,
					title: isHindi ? "प्रोफाइल अस्वीकृत" : "Profile Rejected",
					body: rejectNote,
					silent: rejectSilent,
					actionType: "screen",
					targetScreen: "profile",
				}).catch(() => {});
			}
			showToast(isHindi ? "अस्वीकृत" : "Rejected", "success");
			setRejectNote("");
			setRejectSilent(false);
			setViewMode("list");
			setSelectedDevotee(null);
		} catch {
			showToast("Failed", "error");
		}
		setIsProcessing(false);
	};

	/* ── Photo upload ── */
	const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploadingPhoto(true);
		try {
			const blob = await compressImage(file);
			const uid = selectedDevotee?.uid || `mc_temp_${Date.now()}`;
			const photoRef = ref(storage, `profile_photos/${uid}/profile.jpg`);
			await uploadBytes(photoRef, blob, { contentType: "image/jpeg" });
			const url = await getDownloadURL(photoRef);
			setPhotoPreview(url);
			setEditForm((p) => ({ ...p, photoURL: url }));
			showToast(isHindi ? "फोटो अपलोड ✅" : "Photo uploaded ✅", "success");
		} catch {
			showToast(isHindi ? "फोटो अपलोड विफल" : "Upload failed", "error");
		}
		setUploadingPhoto(false);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	/* ── Open edit ── */
	const openEdit = (devotee: UserProfile) => {
		setSelectedDevotee(devotee);
		const { selection, custom } = deriveGuruSelection(devotee.guruName || "");
		setGuruSelection(selection);
		setCustomGuruName(custom);
		setEditForm({
			realName: devotee.realName || "",
			dikshaName: devotee.dikshaName || "",
			phoneNumber: devotee.phoneNumber || "",
			guruName: devotee.guruName || "",
			dikshaDate: devotee.dikshaDate || "",
			isAspiring: devotee.isAspiring || false,
			personalExperience: devotee.personalExperience || "",
			photoURL: devotee.photoURL || "",
		});
		setPhotoPreview(devotee.photoURL || null);
		setRejectNote("");
		setRejectSilent(false);
		setViewMode("add-edit");
	};

	/* ── Open add ── */
	const openAdd = () => {
		setSelectedDevotee(null);
		setGuruSelection("");
		setCustomGuruName("");
		setEditForm(EMPTY_FORM);
		setPhotoPreview(null);
		setRejectNote("");
		setRejectSilent(false);
		setViewMode("add-edit");
	};

	/* ── Save ── */
	const handleSave = async () => {
		if (!editForm.realName.trim()) {
			showToast(isHindi ? "नाम आवश्यक है" : "Name required", "warning");
			return;
		}
		const guruName = resolveGuruName(guruSelection, customGuruName);
		const payload = {
			...editForm,
			guruName,
			isAspiring: guruSelection === "aspiring",
			mandalId,
			editedByMandalAdmin: currentUser.uid,
			editedAt: Date.now(),
		};
		setIsProcessing(true);
		try {
			if (selectedDevotee) {
				await updateDoc(doc(db, "users", selectedDevotee.uid), payload);
				showToast(isHindi ? "अपडेट हो गई ✅" : "Updated ✅", "success");
			} else {
				const newUid = `mc_${Date.now()}`;
				await setDoc(doc(db, "users", newUid), {
					uid: newUid,
					...payload,
					email: null,
					isApproved: true,
					submittedForReview: true,
					createdAt: Date.now(),
					createdByMandalAdmin: currentUser.uid,
					role: "user",
				});
				showToast(isHindi ? "भक्त जोड़ा गया ✅" : "Devotee added ✅", "success");
			}
			setViewMode("list");
			setSelectedDevotee(null);
		} catch {
			showToast("Save failed", "error");
		}
		setIsProcessing(false);
	};

	const toggleSelect = (uid: string) =>
		setSelectedIds((prev) => {
			const n = new Set(prev);
			n.has(uid) ? n.delete(uid) : n.add(uid);
			return n;
		});

	/* ──────────────── RENDER ──────────────── */
	return (
		<div className="fixed inset-0 z-[300] bg-ry-sand dark:bg-ink-900 flex flex-col font-sans">
			{/* Header */}
			<div className="flex-none bg-ry-maroon dark:bg-black text-ry-gold p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-3 border-b-2 border-ry-gold/40">
				<button
					onClick={viewMode === "list" ? onClose : () => setViewMode("list")}
					className="p-2 -ml-2 rounded-full active:scale-95 transition"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>
				<div className="flex-1">
					<h2 className="text-lg font-bold">
						{isHindi ? "मंडल एडमिन" : "Mandal Admin"}
					</h2>
					<p className="text-xs text-ry-gold/70">{mandalName}</p>
				</div>
				{viewMode === "list" && (
					<button
						onClick={openAdd}
						className="flex items-center gap-1 bg-ry-gold/20 border border-ry-gold/40 rounded-full px-3 py-1.5 text-xs font-bold"
					>
						<Plus className="w-3.5 h-3.5" />
						{isHindi ? "जोड़ें" : "Add"}
					</button>
				)}
			</div>

			{/* ── LIST VIEW ── */}
			{viewMode === "list" && (
				<div className="flex-1 overflow-y-auto flex flex-col">
					{/* Tabs — now 3 tabs including Rejected */}
					<div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-black/30 sticky top-0 z-10">
						{(
							[
								["pending", isHindi ? "बाकी" : "Pending", pending.length],
								["rejected", isHindi ? "अस्वीकृत" : "Rejected", rejected.length],
								["all", isHindi ? "सभी" : "All", devotees.length],
							] as [TabType, string, number][]
						).map(([tab, label, count]) => (
							<button
								key={tab}
								onClick={() => {
									setActiveTab(tab);
									setSelectedIds(new Set());
								}}
								className={`flex-1 py-3 text-xs font-bold transition-colors ${
									activeTab === tab
										? "text-ry-maroon dark:text-ry-gold border-b-2 border-ry-maroon dark:border-ry-gold"
										: "text-slate-500"
								}`}
							>
								{label} ({count})
							</button>
						))}
					</div>

					{/* Search + Bulk Approve */}
					<div className="p-3 flex gap-2">
						<div className="flex items-center gap-2 flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
							<Search className="w-4 h-4 text-slate-400 dark:text-ink-400 shrink-0" />
							<input
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder={isHindi ? "नाम खोजें..." : "Search name..."}
								className="flex-1 bg-transparent text-sm outline-none"
							/>
						</div>
						{selectedIds.size > 0 && (
							<button
								onClick={handleBulkApprove}
								disabled={bulkLoading}
								className="flex items-center gap-1 bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs disabled:opacity-60 active:scale-95 transition"
							>
								{bulkLoading ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<Check className="w-4 h-4" />
								)}
								{isHindi
									? `${selectedIds.size} स्वीकृत`
									: `Approve ${selectedIds.size}`}
							</button>
						)}
					</div>

					{/* Devotee List */}
					{loading ? (
						<div className="flex justify-center py-12">
							<Loader2 className="animate-spin w-8 h-8 text-pink-500" />
						</div>
					) : filtered.length === 0 ? (
						<div className="text-center py-12 text-slate-400 dark:text-ink-400 text-sm">
							{isHindi ? "कोई नहीं मिला" : "None found"}
						</div>
					) : (
						<div className="p-3 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
							{filtered.map((d) => (
								<div
									key={d.uid}
									className={`bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border transition-all ${selectedIds.has(d.uid) ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-slate-100 dark:border-slate-700"}`}
								>
									<div className="flex items-center gap-3">
										{/* Bulk select checkbox (only for approvable) */}
										{!d.isApproved && !d.rejectionNote && (
											<input
												type="checkbox"
												checked={selectedIds.has(d.uid)}
												onChange={() => toggleSelect(d.uid)}
												className="w-4 h-4 rounded accent-emerald-500 shrink-0"
											/>
										)}
										{/* Avatar */}
										<div className="w-10 h-10 rounded-full overflow-hidden bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0 border-2 border-white dark:border-slate-700">
											{d.photoURL ? (
												<ThumbImg
													src={d.photoURL}
													className="w-full h-full object-cover"
													alt=""
												/>
											) : (
												<User className="w-5 h-5 text-rose-400" />
											)}
										</div>
										{/* Info */}
										<div className="flex-1 min-w-0">
											<p className="font-bold text-sm text-slate-800 dark:text-white truncate">
												{d.realName}
											</p>
											<p className="text-xs text-slate-500 dark:text-ink-300 truncate">
												{d.dikshaName || "—"}
											</p>
											<div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${d.isApproved ? "bg-emerald-100 text-emerald-700" : d.rejectionNote ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
												>
													{d.isApproved
														? isHindi
															? "✓ स्वीकृत"
															: "✓ Approved"
														: d.rejectionNote
															? isHindi
																? "✕ अस्वीकृत"
																: "✕ Rejected"
															: isHindi
																? "⏳ बाकी"
																: "⏳ Pending"}
												</span>
												{/* Family count badge */}
												{(d.familyMembers?.length ?? 0) > 0 && (
													<span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
														<Users className="w-2.5 h-2.5" />
														{d.familyMembers?.length}
													</span>
												)}
											</div>
											{/* Rejection note preview */}
											{d.rejectionNote && !d.isApproved && (
												<p className="text-[10px] text-red-500 mt-1 flex items-start gap-1">
													<AlertTriangle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
													<span className="line-clamp-1">
														{d.rejectionNote}
													</span>
												</p>
											)}
										</div>
										{/* Actions */}
										<div className="flex gap-1 shrink-0">
											{!d.isApproved && !d.rejectionNote && (
												<button
													onClick={() => handleApprove(d)}
													disabled={isProcessing}
													className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl active:scale-95 transition disabled:opacity-50"
												>
													<CheckCircle className="w-4 h-4" />
												</button>
											)}
											<button
												onClick={() => openEdit(d)}
												className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl active:scale-95 transition"
											>
												<Edit2 className="w-4 h-4" />
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* ── ADD / EDIT VIEW ── */}
			{viewMode === "add-edit" && (
				<div className="flex-1 overflow-y-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-4">
					<h3 className="text-lg font-bold text-slate-800 dark:text-white">
						{selectedDevotee
							? isHindi
								? "प्रोफाइल संपादित करें"
								: "Edit Profile"
							: isHindi
								? "नया भक्त जोड़ें"
								: "Add Devotee"}
					</h3>

					{/* Photo */}
					<div className="flex flex-col items-center py-2">
						<div
							className="relative group cursor-pointer"
							onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
						>
							<div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white dark:border-slate-700 shadow-lg bg-rose-100 dark:bg-rose-900/30">
								{photoPreview ? (
									<ThumbImg
										src={photoPreview}
										thumbWidth={THUMB.tile}
										className="w-full h-full object-cover"
										alt=""
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center">
										{editForm.realName ? (
											<span className="text-2xl font-bold text-rose-500">
												{editForm.realName.charAt(0).toUpperCase()}
											</span>
										) : (
											<User className="w-8 h-8 text-rose-400" />
										)}
									</div>
								)}
								<div
									className={`absolute inset-0 rounded-full bg-black/40 flex items-center justify-center transition-opacity ${uploadingPhoto ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
								>
									{uploadingPhoto ? (
										<Loader2 className="w-6 h-6 text-white animate-spin" />
									) : (
										<Camera className="w-6 h-6 text-white" />
									)}
								</div>
							</div>
							<div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-700 shadow-md">
								<Camera className="w-3.5 h-3.5 text-white" />
							</div>
						</div>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={handlePhotoUpload}
							className="hidden"
						/>
						<p className="text-[10px] text-slate-400 dark:text-ink-400 mt-2">
							{isHindi
								? "फोटो जोड़ने के लिए टैप करें (वैकल्पिक)"
								: "Tap to add photo (optional)"}
						</p>
						{photoPreview && (
							<button
								type="button"
								onClick={() => {
									setPhotoPreview(null);
									setEditForm((p) => ({ ...p, photoURL: "" }));
								}}
								className="text-[10px] text-red-400 hover:text-red-500 transition font-medium mt-1"
							>
								{isHindi ? "फोटो हटाएं" : "Remove photo"}
							</button>
						)}
					</div>

					{/* Real Name */}
					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 block mb-1">
							{isHindi ? "वास्तविक नाम *" : "Real Name *"}
						</label>
						<input
							type="text"
							value={editForm.realName}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, realName: e.target.value }))
							}
							className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-400 transition"
						/>
					</div>

					{/* Diksha Name */}
					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 block mb-1">
							{isHindi ? "दीक्षित नाम" : "Diksha Name"}
						</label>
						<input
							type="text"
							value={editForm.dikshaName}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, dikshaName: e.target.value }))
							}
							className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-400 transition"
						/>
					</div>

					{/* Phone */}
					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 block mb-1">
							{isHindi ? "फोन नंबर" : "Phone Number"}
						</label>
						<div className="flex gap-2">
							<span className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
								+91
							</span>
							<input
								type="tel"
								maxLength={10}
								value={editForm.phoneNumber.replace(/^\+91/, "")}
								onChange={(e) =>
									setEditForm((p) => ({
										...p,
										phoneNumber: `+91${e.target.value.replace(/\D/g, "").slice(0, 10)}`,
									}))
								}
								placeholder={isHindi ? "10 अंक" : "10 digits"}
								className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-400 transition"
							/>
						</div>
					</div>

					{/* Guru Dropdown */}
					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 block mb-1">
							{isHindi ? "दीक्षा गुरु / स्थिति" : "Guru / Status"}
						</label>
						<div className="relative">
							{showGuruDropdown && (
								<div
									className="fixed inset-0 z-40"
									onClick={() => setShowGuruDropdown(false)}
								/>
							)}
							<button
								type="button"
								onClick={() => setShowGuruDropdown((v) => !v)}
								className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between gap-2 outline-none focus:border-pink-400 transition relative z-30"
							>
								<span
									className={`truncate leading-tight ${!guruSelection ? "text-slate-400" : "text-slate-800 dark:text-white"}`}
								>
									{guruSelection
										? GURU_OPTIONS.find((o) => o.id === guruSelection)?.name
										: isHindi
											? "गुरु महाराज चुनें..."
											: "Select Guru..."}
								</span>
								<ChevronDown
									className={`w-4 h-4 text-slate-400 dark:text-ink-400 shrink-0 transition-transform ${showGuruDropdown ? "rotate-180" : ""}`}
								/>
							</button>
							{showGuruDropdown && (
								<div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
									{GURU_OPTIONS.map((opt) => (
										<button
											key={opt.id}
											type="button"
											onClick={() => {
												setGuruSelection(opt.id);
												setShowGuruDropdown(false);
												if (opt.id !== "other") {
													setEditForm((p) => ({
														...p,
														guruName: opt.name,
														isAspiring: opt.id === "aspiring",
													}));
												}
											}}
											className={`w-full text-left px-4 py-3 text-sm hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors ${guruSelection === opt.id ? "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 font-bold" : "text-slate-700 dark:text-slate-300"}`}
										>
											{opt.name}
										</button>
									))}
								</div>
							)}
						</div>
						{guruSelection === "other" && (
							<input
								type="text"
								value={customGuruName}
								onChange={(e) => {
									setCustomGuruName(e.target.value);
									setEditForm((p) => ({
										...p,
										guruName: e.target.value,
										isAspiring: false,
									}));
								}}
								placeholder={
									isHindi ? "गुरु महाराज का नाम..." : "Guru Maharaj's name..."
								}
								className="mt-2 w-full bg-white dark:bg-slate-800 border border-pink-300 dark:border-pink-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition"
							/>
						)}
						{guruSelection === "aspiring" && (
							<p className="text-xs text-blue-500 mt-1.5 ml-1">
								🌱{" "}
								{isHindi
									? "दीक्षा की तिथि आवश्यक नहीं"
									: "Diksha date not required"}
							</p>
						)}
					</div>

					{/* Diksha Date */}
					{guruSelection && guruSelection !== "aspiring" && (
						<div>
							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 block mb-1">
								{isHindi ? "दीक्षा तिथि" : "Diksha Date"}
							</label>
							<div className="relative">
								<Calendar className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 dark:text-ink-400 pointer-events-none" />
								<input
									type="date"
									value={editForm.dikshaDate}
									onChange={(e) =>
										setEditForm((p) => ({ ...p, dikshaDate: e.target.value }))
									}
									className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-pink-400 transition"
								/>
							</div>
						</div>
					)}

					{/* Personal Experience */}
					<div>
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 block mb-1">
							{isHindi ? "व्यक्तिगत अनुभव" : "Personal Experience"}
						</label>
						<textarea
							value={editForm.personalExperience}
							onChange={(e) =>
								setEditForm((p) => ({
									...p,
									personalExperience: e.target.value,
								}))
							}
							rows={3}
							placeholder={
								isHindi ? "भक्ति जीवन का अनुभव..." : "Devotional experience..."
							}
							className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-400 transition resize-none"
						/>
					</div>

					{/* Save */}
					<button
						onClick={handleSave}
						disabled={isProcessing || uploadingPhoto}
						className="w-full bg-ry-maroon text-white font-bold py-3 rounded-2xl disabled:opacity-60 active:scale-95 flex items-center justify-center gap-2 transition"
					>
						{isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
						{isHindi ? "सहेजें" : "Save"}
					</button>

					{/* Reject section (existing unapproved only) */}
					{selectedDevotee && !selectedDevotee.isApproved && (
						<div className="border-t border-red-200 dark:border-red-800 pt-4 space-y-3 mt-2">
							<p className="text-xs font-bold text-red-600">
								{isHindi ? "❌ अस्वीकृत करें" : "❌ Reject"}
							</p>
							<textarea
								value={rejectNote}
								onChange={(e) => setRejectNote(e.target.value)}
								rows={3}
								placeholder={
									isHindi ? "अस्वीकृति का कारण..." : "Reason for rejection..."
								}
								className="w-full bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm outline-none resize-none"
							/>

							{/* Silent toggle */}
							<label className="flex items-center gap-3 cursor-pointer select-none">
								<div
									onClick={() => setRejectSilent((v) => !v)}
									className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${rejectSilent ? "bg-slate-400" : "bg-blue-500"}`}
								>
									<div
										className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${rejectSilent ? "translate-x-5" : "translate-x-0"}`}
									/>
								</div>
								<span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
									{rejectSilent ? (
										<BellOff className="w-4 h-4 text-slate-400 dark:text-ink-400" />
									) : (
										<Bell className="w-4 h-4 text-blue-500" />
									)}
									{rejectSilent
										? isHindi
											? "साइलेंट notification"
											: "Silent"
										: isHindi
											? "अलर्ट के साथ notification"
											: "With alert"}
								</span>
							</label>

							<button
								onClick={() => handleReject(selectedDevotee)}
								disabled={isProcessing || !rejectNote.trim()}
								className="w-full bg-red-500 text-white font-bold py-2.5 rounded-2xl disabled:opacity-60 active:scale-95 flex items-center justify-center gap-2 transition"
							>
								{isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
								<XCircle className="w-4 h-4" />
								{isHindi ? "अस्वीकृत करें" : "Reject"}
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

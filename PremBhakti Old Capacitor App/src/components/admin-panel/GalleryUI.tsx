import { Capacitor } from "@capacitor/core";
import { doc, getDoc, getDocFromServer, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
	AlertCircle,
	ArrowLeft,
	Calendar,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Edit2,
	Eye,
	EyeOff,
	Folder,
	Grid,
	Image as ImageIcon,
	Link,
	ListOrdered,
	Loader2,
	MapPin,
	PlayCircle,
	Plus,
	RefreshCw,
	Save,
	Trash2,
	Upload,
	Video,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CachedImage } from "../../../components/CachedImage";
import { db, functions } from "../../../services/firebase";
import { formatForDateInput } from "../../../utils/dateFormatter";
import { useAdminBack } from "../../hooks/useAdminBack";
import { usePopupBackHandler } from "../../hooks/usePopupBackHandler";
import {
	MANDAL_LIST,
	type MandalVideo,
	type WeeklyProgram,
} from "../../types/mandal";
import {
	normalizeB2Url,
	softDeleteFromB2,
	uploadFileToB2,
} from "../../utils/b2Uploader";
import { UploadBlockerModal } from "./UploadBlockerModal";

interface GitHubRelease {
	id: number;
	name: string;
	tag_name: string;
	assets: GitHubAsset[];
	created_at: string;
}

interface GitHubAsset {
	id: number;
	name: string;
	browser_download_url: string;
	content_type: string;
	size: number;
}

export interface BulkUploadTask {
	id: string;
	name: string;
	progress: number;
	status: "pending" | "uploading" | "completed" | "error";
	error?: string;
}

const REPO_OWNER = "chaitanyaprembhakti";
const REPO_NAME = "CPBS-DAILY";

// ── Mandal matching: given a release name, find the matching mandal ID ──
function getMandalIdFromReleaseName(releaseName: string): string | null {
	const lower = releaseName.toLowerCase();
	for (const m of MANDAL_LIST) {
		const coreName = m.name.toLowerCase().replace(" mandal", "").trim();
		if (lower.includes(coreName) || lower.includes(m.id.toLowerCase())) {
			return m.id;
		}
	}
	return null;
}

export const GalleryUI: React.FC<{
	onBack: () => void;
	settingsLanguage?: "en" | "hi";
}> = ({ onBack, settingsLanguage }) => {
	const [token, setToken] = useState<string | null>(null);
	const [releases, setReleases] = useState<GitHubRelease[]>([]);
	const [selectedRelease, setSelectedRelease] = useState<GitHubRelease | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [newFolderName, setNewFolderName] = useState("");
	const [showNewFolderInput, setShowNewFolderInput] = useState(false);
	const [isGalleryFolder, setIsGalleryFolder] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [globalDate, setGlobalDate] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	});

	const parseAssetName = (rawName: string) => {
		const match = rawName.match(/^\[(.*?)\]\[(.*?)\]\[(.*?)\](\..*)?$/);
		if (match) {
			return {
				date: match[1],
				order: parseInt(match[2], 10) || 0,
				displayName: match[3],
				extension: match[4] || "",
			};
		}
		const lastDotIndex = rawName.lastIndexOf(".");
		const ext = lastDotIndex !== -1 ? rawName.substring(lastDotIndex) : "";
		const name =
			lastDotIndex !== -1 ? rawName.substring(0, lastDotIndex) : rawName;
		return {
			date: "",
			order: 0,
			displayName: name,
			extension: ext,
		};
	};

	const [diagnostics, setDiagnostics] = useState<string[]>([]);
	const [showDiagnostics, setShowDiagnostics] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);

	const [viewType, setViewType] = useState<"gallery" | "activity">("gallery");

	const [visibleFolders, setVisibleFolders] = useState<number[]>([]);
	const [folderOrder, setFolderOrder] = useState<number[]>([]);
	const [savingVisibility, setSavingVisibility] = useState<number | null>(null);

	// Rename states
	const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
	const [editFolderName, setEditFolderName] = useState("");
	const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);

	const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
	const [editAssetName, setEditAssetName] = useState("");
	const [editAssetDate, setEditAssetDate] = useState("");
	const [editAssetOrder, setEditAssetOrder] = useState(0);
	const [editAssetExt, setEditAssetExt] = useState("");
	const [renamingAssetId, setRenamingAssetId] = useState<number | null>(null);

	// ── VIDEO MANAGEMENT ──
	const [mandalVideos, setMandalVideos] = useState<MandalVideo[]>([]);
	const [loadingVideos, setLoadingVideos] = useState(false);
	const [videoForm, setVideoForm] = useState<{
		title: string;
		url: string;
		date: string;
		thumbnailUrl: string;
		thumbnailXOffset?: number;
		thumbnailYOffset?: number;
		useDefaultThumbnail?: boolean;
	}>({
		title: "",
		url: "",
		date: new Date().toISOString().split("T")[0],
		thumbnailUrl: "",
		thumbnailXOffset: 50,
		thumbnailYOffset: 50,
		useDefaultThumbnail: false,
	});
	const [videoFormOpen, setVideoFormOpen] = useState(false);
	const [savingVideo, setSavingVideo] = useState(false);
	const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
	const [editingVideo, setEditingVideo] = useState<MandalVideo | null>(null);
	const [showArchiveImport, setShowArchiveImport] = useState(false);
	const [archiveUrl, setArchiveUrl] = useState("");
	const [importingArchive, setImportingArchive] = useState(false);
	const [uploadingVideo, setUploadingVideo] = useState(false);
	const [uploadVideoProgress, setUploadVideoProgress] = useState(0);
	const [uploadingFileName, setUploadingFileName] = useState("");
	const [bulkUploadTasks, setBulkUploadTasks] = useState<BulkUploadTask[]>([]);
	const videoInputRef = useRef<HTMLInputElement>(null);
	const bulkVideoInputRef = useRef<HTMLInputElement>(null);
	// AbortController for cancelling in-flight B2 video uploads
	const uploadAbortControllerRef = useRef<AbortController | null>(null);
	// Tracks which video ID (within the mandal doc) is being uploaded, for cleanup on cancel
	const uploadingVideoIdRef = useRef<string | null>(null);

	const [fixingThumbnails, setFixingThumbnails] = useState(false);
	const [fixingOrder, setFixingOrder] = useState(false);
	const [_cyclingThumbsAll, _setCyclingThumbsAll] = useState(false);
	const [_cyclingThumbId, _setCyclingThumbId] = useState<string | null>(null);
	const [_batchThumbMode, _setBatchThumbMode] = useState(false);
	const [_batchThumbPreview, _setBatchThumbPreview] = useState<Record<
		string,
		string
	> | null>(null);
	const [showAllThumbsFor, setShowAllThumbsFor] = useState<string | null>(null);
	const [_availableThumbs, _setAvailableThumbs] = useState<any[]>([]);
	const [fetchingThumbsFor, setFetchingThumbsFor] = useState<string | null>(
		null,
	);
	const [archiveDataCache, setArchiveDataCache] = useState<Record<string, any>>(
		{},
	);

	// ── WEEKLY PROGRAM ──
	const [weeklyProgram, setWeeklyProgram] = useState<WeeklyProgram>({
		title: "",
		description: "",
		locationUrl: "",
		date: "",
		enabled: false,
	});
	const [savingWeekly, setSavingWeekly] = useState(false);
	const [loadingWeekly, setLoadingWeekly] = useState(false);
	const [_weeklyExpanded, _setWeeklyExpanded] = useState(false);
	const [activeTab, setActiveTab] = useState<"photos" | "videos" | "weekly">(
		"photos",
	);
	const [manualMandalId, setManualMandalId] = useState<string | null>(null);
	const [isMandalDropdownOpen, setIsMandalDropdownOpen] = useState(false);

	// ── FEEDBACK ──
	const [toastMessage, setToastMessage] = useState<{
		text: string;
		type: "success" | "error";
	} | null>(null);
	const [confirmDialog, setConfirmDialog] = useState<{
		message: string;
		title?: string;
		confirmText?: string;
		isDestructive?: boolean;
		onConfirm: () => void;
	} | null>(null);
	const [showBulkRename, setShowBulkRename] = useState(false);
	const [bulkRenameBaseName, setBulkRenameBaseName] = useState("");

	const showToast = (text: string, type: "success" | "error" = "success") => {
		setToastMessage({ text, type });
		setTimeout(() => setToastMessage(null), 3000);
	};

	// ── BACK BUTTON SUPPORT FOR POPUPS ──
	const closeVideoForm = usePopupBackHandler(
		videoFormOpen,
		"gallery-video-form",
		() => setVideoFormOpen(false),
	);
	const closeArchiveImport = usePopupBackHandler(
		showArchiveImport,
		"gallery-archive",
		() => setShowArchiveImport(false),
	);
	const closeAllThumbs = usePopupBackHandler(
		!!showAllThumbsFor,
		"gallery-thumbs",
		() => setShowAllThumbsFor(null),
	);
	const closeDiagnostics = usePopupBackHandler(
		showDiagnostics,
		"gallery-diagnostics",
		() => setShowDiagnostics(false),
	);
	const closeConfirmDialog = usePopupBackHandler(
		!!confirmDialog,
		"gallery-confirm",
		() => setConfirmDialog(null),
	);
	const closeBulkRename = usePopupBackHandler(
		showBulkRename,
		"gallery-bulk-rename",
		() => setShowBulkRename(false),
	);
	const closeSelectedFolder = usePopupBackHandler(
		!!selectedRelease,
		"gallery-folder",
		() => setSelectedRelease(null),
	);

	// Auto-match mandal from folder name
	const autoMatchedMandalId = selectedRelease
		? getMandalIdFromReleaseName(selectedRelease.name)
		: null;
	// Effective mandal: auto-match first, fallback to manual selection, fallback to independent virtual mandal
	const effectiveMandalId =
		autoMatchedMandalId ||
		manualMandalId ||
		(selectedRelease ? `github-${selectedRelease.id}` : null);

	const formatFolderName = (name: string) => {
		return name
			.replace(/Activity Release for /i, "")
			.replace(/Release for /i, "")
			.replace(/\s*\(.*?\)\s*$/, "")
			.trim();
	};

	const addLog = (msg: string) => {
		const timestamp = new Date().toLocaleTimeString();
		setDiagnostics((prev) => [`[${timestamp}] ${msg}`, ...prev]);
	};

	const runDiagnostics = async () => {
		setDiagnostics([]);
		setShowDiagnostics(true);
		setIsMinimized(false);
		addLog("Starting diagnostics...");
		addLog(`Platform: ${Capacitor.getPlatform()}`);

		try {
			addLog("Checking GitHub token in Firestore...");
			const docRef = doc(db, "damtoken", "github");
			const docSnap = await getDocFromServer(docRef);

			if (!docSnap.exists()) {
				throw new Error("GitHub token document not found in Firestore.");
			}

			const foundToken = docSnap.data()?.token?.trim();
			if (!foundToken) throw new Error("Token field is empty.");

			addLog("Token found in Firestore.");
			setToken(foundToken);

			addLog("Verifying token with GitHub API...");
			const userResp = await fetch("https://api.github.com/user", {
				headers: { Authorization: `token ${foundToken}` },
			});

			if (!userResp.ok)
				throw new Error(`GitHub Auth Failed: ${userResp.status}`);
			const userData = await userResp.json();
			addLog(`Authenticated as: ${userData.login}`);
			addLog("✅ Success! All checks passed.");
		} catch (e: any) {
			addLog(`❌ Error: ${e.message}`);
		}
	};

	const fetchMandalVideos = async (mandalId: string) => {
		setLoadingVideos(true);
		try {
			const snap = await getDoc(doc(db, "mandals", mandalId));
			if (snap.exists()) {
				setMandalVideos(snap.data().videos || []);
			} else {
				setMandalVideos([]);
			}
		} catch (e) {
			console.error("Failed to fetch mandal videos:", e);
		}
		setLoadingVideos(false);
	};

	const fetchWeeklyProgram = async (mandalId: string) => {
		setLoadingWeekly(true);
		try {
			const snap = await getDoc(doc(db, "mandals", mandalId));
			if (snap.exists() && snap.data().weeklyProgram) {
				setWeeklyProgram(snap.data().weeklyProgram);
			} else {
				setWeeklyProgram({
					title: "",
					description: "",
					locationUrl: "",
					date: "",
					enabled: false,
				});
			}
		} catch (e) {
			console.error("Failed to fetch weekly program:", e);
		}
		setLoadingWeekly(false);
	};

	const fetchVisibleFolders = async () => {
		try {
			const configDocName =
				viewType === "activity" ? "activity_folders" : "darshan_folders";
			const docRef = doc(db, "app_config", configDocName);
			const docSnap = await getDocFromServer(docRef);
			if (docSnap.exists()) {
				setVisibleFolders(docSnap.data().visibleIds || []);
				setFolderOrder(docSnap.data().folderOrder || []);
			} else {
				setVisibleFolders([]);
				setFolderOrder([]);
			}
		} catch (err) {
			console.error("Failed to fetch visible folders", err);
		}
	};

	const triggerLiveUpdate = async () => {
		try {
			const configDocName =
				viewType === "activity" ? "activity_folders" : "darshan_folders";
			await setDoc(
				doc(db, "app_config", configDocName),
				{ lastUpdated: Date.now() },
				{ merge: true },
			);
		} catch (err) {
			console.error("Failed to trigger live update", err);
		}
	};

	const toggleFolderVisibility = async (
		e: React.MouseEvent,
		releaseId: number,
	) => {
		e.stopPropagation();
		setSavingVisibility(releaseId);
		try {
			const isVisible = visibleFolders.includes(releaseId);
			const newVisible = isVisible
				? visibleFolders.filter((id) => id !== releaseId)
				: [...visibleFolders, releaseId];

			const configDocName =
				viewType === "activity" ? "activity_folders" : "darshan_folders";
			const { setDoc: sd } = await import("firebase/firestore");
			await sd(
				doc(db, "app_config", configDocName),
				{ visibleIds: newVisible },
				{ merge: true },
			);
			setVisibleFolders(newVisible);
		} catch (err) {
			console.error("Failed to update visibility", err);
			setError("Failed to update visibility");
		} finally {
			setSavingVisibility(null);
		}
	};

	const sortedReleases = [...releases].sort((a, b) => {
		const indexA = folderOrder.indexOf(a.id);
		const indexB = folderOrder.indexOf(b.id);
		if (indexA !== -1 && indexB !== -1) return indexA - indexB;
		if (indexA !== -1) return -1;
		if (indexB !== -1) return 1;
		// fallback to original order
		return releases.indexOf(a) - releases.indexOf(b);
	});

	const moveFolder = async (
		e: React.MouseEvent,
		releaseId: number,
		direction: "up" | "down",
	) => {
		e.stopPropagation();

		const currentOrder = [...folderOrder];
		sortedReleases.forEach((r) => {
			if (!currentOrder.includes(r.id)) currentOrder.push(r.id);
		});

		const index = currentOrder.indexOf(releaseId);
		if (index === -1) return;
		if (direction === "up" && index === 0) return;
		if (direction === "down" && index === currentOrder.length - 1) return;

		const newOrder = [...currentOrder];
		const swapIndex = direction === "up" ? index - 1 : index + 1;
		[newOrder[index], newOrder[swapIndex]] = [
			newOrder[swapIndex],
			newOrder[index],
		];

		setFolderOrder(newOrder);

		try {
			const configDocName =
				viewType === "activity" ? "activity_folders" : "darshan_folders";
			const { setDoc: sd } = await import("firebase/firestore");
			await sd(
				doc(db, "app_config", configDocName),
				{ folderOrder: newOrder },
				{ merge: true },
			);
			await triggerLiveUpdate();
		} catch (err) {
			console.error("Failed to update folder order", err);
		}
	};

	const fetchToken = async () => {
		setLoading(true);
		try {
			const docRef = doc(db, "damtoken", "github");
			const docSnap = await getDocFromServer(docRef);
			if (docSnap.exists()) {
				const data = docSnap.data();
				if (data?.token) {
					setToken(data.token.trim());
				} else {
					setError('Field "token" is missing in document "damtoken/github".');
				}
			} else {
				setError(`Document "damtoken/github" does not exist in Firebase.`);
			}
		} catch (err: any) {
			setError(`Failed to fetch auth token: ${err.message}`);
		} finally {
			setLoading(false);
		}
	};

	const fetchReleases = async () => {
		if (!token) return;
		setLoading(true);
		setError(null);
		try {
			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?t=${Date.now()}`,
				{
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!response.ok) throw new Error(`GitHub API ${response.status}`);
			const data = await response.json();

			const filteredReleases = data.filter((r: any) => {
				if (viewType === "activity") {
					return (
						r.body?.includes("Auto-generated activity release for") ||
						r.name?.startsWith("Activity Release for ")
					);
				} else {
					return (
						(r.body?.includes("Auto-generated release for") ||
							r.name?.startsWith("Release for ")) &&
						!(
							r.body?.includes("Auto-generated activity release for") ||
							r.name?.startsWith("Activity Release for ")
						)
					);
				}
			});

			setReleases(filteredReleases);
		} catch (err: any) {
			setError(`Failed to load folders: ${err.message}`);
		} finally {
			setLoading(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchToken is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		fetchToken();
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchReleases, fetchVisibleFolders are recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		fetchVisibleFolders();
		if (token) {
			fetchReleases();
		}
	}, [token, viewType]);

	// Reset tab + manual mandal when folder changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setActiveTab("photos");
		closeVideoForm();
		setEditingVideo(null);
		setManualMandalId(null);
	}, [selectedRelease?.id]);

	// Load videos + weekly program when mandal is known (auto or manual)
	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchWeeklyProgram, fetchMandalVideos are recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (effectiveMandalId) {
			fetchMandalVideos(effectiveMandalId);
			fetchWeeklyProgram(effectiveMandalId);
		} else {
			setMandalVideos([]);
			setWeeklyProgram({
				title: "",
				description: "",
				locationUrl: "",
				date: "",
				enabled: false,
			});
		}
	}, [effectiveMandalId]);

	const createRelease = async () => {
		if (!token || !newFolderName.trim()) return;
		setLoading(true);
		try {
			let finalFolderName = newFolderName.trim();
			// If user selected it's a gallery, ensure it ends with " Gallery"
			if (
				isGalleryFolder &&
				!finalFolderName.toLowerCase().endsWith("gallery")
			) {
				finalFolderName += " Gallery";
			}

			const tagName =
				viewType === "activity"
					? `activity-${finalFolderName.toLowerCase().replace(/\s+/g, "-")}`
					: finalFolderName.toLowerCase().replace(/\s+/g, "-");
			const name =
				viewType === "activity"
					? `Activity Release for ${finalFolderName}`
					: `Release for ${finalFolderName}`;
			const body =
				viewType === "activity"
					? "Auto-generated activity release for Gallery UI"
					: "Auto-generated release for Gallery UI";

			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
				{
					method: "POST",
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						tag_name: tagName,
						name: name,
						body: body,
					}),
				},
			);

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.message || "Failed to create folder");
			}

			const newRelease = await response.json();
			setReleases((prev) => [newRelease, ...prev]);

			const newVisible = [...visibleFolders, newRelease.id];
			const configDocName =
				viewType === "activity" ? "activity_folders" : "darshan_folders";
			const { setDoc: sd } = await import("firebase/firestore");
			await sd(
				doc(db, "app_config", configDocName),
				{ visibleIds: newVisible },
				{ merge: true },
			);
			setVisibleFolders(newVisible);

			showToast("Folder created successfully!");
			setNewFolderName("");
			setIsGalleryFolder(false);
			setShowNewFolderInput(false);
			fetchReleases();
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const renameRelease = async (releaseId: number, newName: string) => {
		if (!token || !newName.trim()) return;
		setRenamingFolderId(releaseId);
		try {
			const formattedName =
				viewType === "activity"
					? `Activity Release for ${newName.trim()}`
					: `Release for ${newName.trim()}`;
			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}`,
				{
					method: "PATCH",
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: formattedName,
					}),
				},
			);

			if (!response.ok) throw new Error(`Rename failed: ${response.status}`);

			const updatedRelease = await response.json();
			setReleases((prev) =>
				prev.map((r) => (r.id === releaseId ? updatedRelease : r)),
			);
			if (selectedRelease?.id === releaseId) setSelectedRelease(updatedRelease);

			setEditingFolderId(null);
			await triggerLiveUpdate();
		} catch (err: any) {
			setError(err.message);
		} finally {
			setRenamingFolderId(null);
		}
	};

	const renameAsset = async (assetId: number) => {
		if (!token || !selectedRelease || !editAssetName.trim()) return;
		setRenamingAssetId(assetId);
		try {
			const safeName = editAssetName.replace(/[[\]]/g, "").trim() || "Image";
			const formattedName = `[${editAssetDate}][${editAssetOrder}][${safeName}]${editAssetExt}`;

			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${assetId}`,
				{
					method: "PATCH",
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: formattedName,
					}),
				},
			);

			if (!response.ok)
				throw new Error(`Rename asset failed: ${response.status}`);

			const updatedAsset = await response.json();

			const updatedAssets = selectedRelease.assets.map((a) =>
				a.id === assetId ? updatedAsset : a,
			);
			const updatedRelease = { ...selectedRelease, assets: updatedAssets };

			setSelectedRelease(updatedRelease);
			setReleases((prev) =>
				prev.map((r) => (r.id === updatedRelease.id ? updatedRelease : r)),
			);

			setEditingAssetId(null);
			await triggerLiveUpdate();
		} catch (err: any) {
			setError(err.message);
		} finally {
			setRenamingAssetId(null);
		}
	};

	const [selectedFiles, setSelectedFiles] = useState<
		{
			file: File;
			name: string;
			extension: string;
			date: string;
			order: number;
			previewUrl: string;
		}[]
	>([]);
	const [showUploadModal, setShowUploadModal] = useState(false);
	const handleClose_gallery_upload_ui = usePopupBackHandler(
		showUploadModal,
		"gallery-upload-ui",
		() => setShowUploadModal(false),
	);

	useEffect(() => {
		return () => {
			selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
		};
	}, [selectedFiles]);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const files = Array.from(e.target.files).map((file, index) => {
				const lastDotIndex = file.name.lastIndexOf(".");
				const name =
					lastDotIndex !== -1
						? file.name.substring(0, lastDotIndex)
						: file.name;
				const extension =
					lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : "";
				return {
					file,
					name,
					extension,
					date: globalDate,
					order: selectedFiles.length + index + 1,
					previewUrl: URL.createObjectURL(file),
				};
			});
			setSelectedFiles((prev) => [...prev, ...files]);
			setShowUploadModal(true);
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const uploadFileWithFunction = async (
		file: File,
		fullName: string,
		releaseId: number,
		currentIndex: number,
		totalFiles: number,
	) => {
		addLog(`Uploading to GitHub: ${fullName}`);

		try {
			const { uploadFileViaWorker } = await import(
				"../../../utils/uploadManager"
			);
			const url = await uploadFileViaWorker(file, releaseId, token!, fullName, {
				totalFiles,
				currentIndex,
			});

			addLog(`✅ Upload success!`);
			return { asset: { browser_download_url: url } };
		} catch (e: any) {
			addLog(`❌ Upload failed: ${e.message}`);
			throw e;
		}
	};

	const handleUploadConfirm = async () => {
		if (!token || !selectedRelease || selectedFiles.length === 0) return;
		setUploading(true);
		handleClose_gallery_upload_ui();
		setShowDiagnostics(true);
		setDiagnostics([]);
		addLog(`Starting batch upload...`);

		let successCount = 0;
		const errors: string[] = [];

		try {
			// Upload sequentially on native to prevent flooding the Foreground Service
			// with too many concurrent base64 conversions. On web, use parallel (faster).
			let fileIndex = 0;
			let completed = 0;
			const existingNames = new Set(selectedRelease.assets.map((a) => a.name));

			const uploadPromises = selectedFiles.map(async (item) => {
				const myIndex = ++fileIndex;
				try {
					const safeName = item.name.replace(/[[\]]/g, "").trim() || "Image";
					let formattedName = `[${item.date}][${item.order}][${safeName}]${item.extension}`;

					let counter = 1;
					while (existingNames.has(formattedName)) {
						formattedName = `[${item.date}][${item.order}][${safeName}-${counter}]${item.extension}`;
						counter++;
					}
					existingNames.add(formattedName);

					await uploadFileWithFunction(
						item.file,
						formattedName,
						selectedRelease.id,
						myIndex,
						selectedFiles.length,
					);
					successCount++;
				} catch (err: any) {
					errors.push(`${item.name}: ${err.message}`);
				} finally {
					completed++;
					setUploadProgress(
						Math.round((completed / selectedFiles.length) * 100),
					);
				}
			});

			await Promise.all(uploadPromises);

			addLog(
				`Batch complete. Success: ${successCount}, Failures: ${errors.length}`,
			);
			await fetchReleases();
			if (successCount > 0) {
				await triggerLiveUpdate();
			}

			const releaseResponse = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${
					selectedRelease.id
				}?t=${Date.now()}`,
				{
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);
			const updatedRelease = await releaseResponse.json();
			setSelectedRelease(updatedRelease);

			if (errors.length > 0) {
				setError(`Uploaded ${successCount} files. Errors occurred.`);
			}
		} catch (err: any) {
			setError(err.message);
		} finally {
			setUploading(false);
			setUploadProgress(0);
			selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
			setSelectedFiles([]);
		}
	};

	const [deleteConfirmation, setDeleteConfirmation] = useState<{
		type: "folder" | "asset";
		id: number;
		name: string;
	} | null>(null);

	// Hardware back closes the innermost open thing — delete confirmation,
	// mandal dropdown, inline rename, new-folder box — instead of leaving the
	// screen; it's held while photos upload. (Folder, forms and dialogs that
	// push their own history entry are handled by usePopupBackHandler above.)
	useAdminBack(showNewFolderInput, () => setShowNewFolderInput(false));
	useAdminBack(editingFolderId !== null, () => setEditingFolderId(null));
	useAdminBack(editingAssetId !== null, () => setEditingAssetId(null));
	useAdminBack(isMandalDropdownOpen, () => setIsMandalDropdownOpen(false));
	useAdminBack(!!deleteConfirmation, () => setDeleteConfirmation(null));
	useAdminBack(
		uploading,
		() => showToast("Photos are still uploading — please wait.", "error"),
		{ blocking: true },
	);

	const handleDeleteClick = (
		type: "folder" | "asset",
		id: number,
		name: string,
	) => {
		setDeleteConfirmation({ type, id, name });
	};

	const confirmDelete = async () => {
		if (!deleteConfirmation) return;
		const { type, id } = deleteConfirmation;
		setDeleteConfirmation(null);
		if (type === "folder") {
			await deleteRelease(id);
		} else {
			await deleteAsset(id);
		}
	};

	const [deletingId, setDeletingId] = useState<number | null>(null);

	const deleteRelease = async (releaseId: number) => {
		if (!token) return;
		setDeletingId(releaseId);
		try {
			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!response.ok) throw new Error(`Delete failed: ${response.status}`);

			setReleases((prev) => prev.filter((r) => r.id !== releaseId));
			if (selectedRelease?.id === releaseId) closeSelectedFolder();

			const configDocName =
				viewType === "activity" ? "activity_folders" : "darshan_folders";
			const currentConfigDoc = await getDocFromServer(
				doc(db, "app_config", configDocName),
			);
			const currentVisibleIds = currentConfigDoc.exists()
				? currentConfigDoc.data().visibleIds || []
				: [];
			const newVisibleFolders = currentVisibleIds.filter(
				(id: number) => id !== releaseId,
			);

			await setDoc(
				doc(db, "app_config", configDocName),
				{ visibleIds: newVisibleFolders },
				{ merge: true },
			);
			setVisibleFolders(newVisibleFolders);

			await fetchReleases();
			await triggerLiveUpdate();
		} catch (err: any) {
			setError(err.message);
		} finally {
			setDeletingId(null);
		}
	};

	const deleteAsset = async (assetId: number) => {
		if (!token || !selectedRelease) return;
		setDeletingId(assetId);
		try {
			const response = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${assetId}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!response.ok)
				throw new Error(`Delete asset failed: ${response.status}`);

			const releaseResponse = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${
					selectedRelease.id
				}?t=${Date.now()}`,
				{
					headers: {
						Authorization: `token ${token}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);
			const updatedRelease = await releaseResponse.json();
			setSelectedRelease(updatedRelease);
			setReleases((prev) =>
				prev.map((r) => (r.id === updatedRelease.id ? updatedRelease : r)),
			);
			await triggerLiveUpdate();
		} catch (err: any) {
			setError(err.message);
		} finally {
			setDeletingId(null);
		}
	};

	// ── VIDEO HANDLERS ──
	const handleSaveVideo = async () => {
		if (!effectiveMandalId) {
			showToast("Mandal not selected.", "error");
			return;
		}
		if (!videoForm.title.trim()) {
			showToast("Please enter a video title.", "error");
			return;
		}
		if (!videoForm.url.trim()) {
			showToast("Please enter a video URL.", "error");
			return;
		}
		if (!videoForm.date) {
			showToast("Please select a date.", "error");
			return;
		}
		setSavingVideo(true);
		try {
			const mandalRef = doc(db, "mandals", effectiveMandalId);
			const snap = await getDocFromServer(mandalRef);
			const currentVideos: MandalVideo[] = snap.exists()
				? snap.data().videos || []
				: [];

			let updatedVideos: MandalVideo[];
			if (editingVideo) {
				updatedVideos = currentVideos.map((v) =>
					v.id === editingVideo.id
						? { ...v, ...videoForm, id: editingVideo.id }
						: v,
				);
			} else {
				const newVideo: MandalVideo = {
					id: `mv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
					title: videoForm.title.trim(),
					url: videoForm.url.trim(),
					date: videoForm.date,
					thumbnailUrl: videoForm.thumbnailUrl.trim() || "",
					thumbnailXOffset: videoForm.thumbnailXOffset || 50,
					thumbnailYOffset: videoForm.thumbnailYOffset || 50,
					useDefaultThumbnail: videoForm.useDefaultThumbnail || false,
					order: currentVideos.length + 1,
				};
				updatedVideos = [...currentVideos, newVideo];
			}
			await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
			setMandalVideos(updatedVideos);
			showToast(editingVideo ? "Video updated!" : "Video added!");
			setVideoForm({
				title: "",
				url: "",
				date: new Date().toISOString().split("T")[0],
				thumbnailUrl: "",
				thumbnailXOffset: 50,
				thumbnailYOffset: 50,
				useDefaultThumbnail: false,
			});
			setEditingVideo(null);
			closeVideoForm();
		} catch (e: any) {
			showToast(`Failed to save video: ${e.message}`, "error");
		}
		setSavingVideo(false);
	};

	const handleArchiveImport = async () => {
		if (!effectiveMandalId) {
			showToast("Mandal not selected.", "error");
			return;
		}
		if (!archiveUrl.trim()) {
			showToast("Please enter an Archive.org URL.", "error");
			return;
		}

		setImportingArchive(true);
		try {
			const urlStr = archiveUrl.trim();
			const identifierMatch = urlStr.match(/archive\.org\/details\/([^/]+)/);
			const identifier = identifierMatch ? identifierMatch[1] : urlStr;

			if (!identifier) {
				throw new Error("Could not extract identifier from URL.");
			}

			const fetchArchiveFn = httpsCallable(functions, "fetchArchiveMetadata");
			const response = await fetchArchiveFn({ identifier });
			const data = response.data as any;

			if (!data?.files || !Array.isArray(data.files)) {
				throw new Error("No files found in this archive item.");
			}

			const videoFiles = data.files.filter(
				(f: any) =>
					f.source === "original" &&
					f.format &&
					(f.format.includes("MPEG4") ||
						f.format.includes("Matroska") ||
						f.format.includes("Ogg Video") ||
						f.format.includes("WebM")),
			);

			if (videoFiles.length === 0) {
				throw new Error("No video files found in this archive item.");
			}

			const baseUrl =
				data.server && data.dir
					? `https://${data.server}${data.dir}`
					: `https://archive.org/download/${identifier}`;

			const mandalRef = doc(db, "mandals", effectiveMandalId);
			const snap = await getDocFromServer(mandalRef);
			const currentVideos: MandalVideo[] = snap.exists()
				? snap.data().videos || []
				: [];

			const newVideos: MandalVideo[] = videoFiles.map((f: any, i: number) => {
				const thumbFile = data.files.find(
					(df: any) =>
						df.source === "derivative" &&
						df.name?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) &&
						df.original === f.name,
				);
				const encodePath = (path: string) =>
					path.split("/").map(encodeURIComponent).join("/");

				let videoDate = "";
				if (data.metadata?.date) {
					const dateStr = data.metadata.date;
					const parsed = new Date(dateStr);
					if (!Number.isNaN(parsed.getTime())) {
						videoDate = parsed.toISOString().split("T")[0];
					}
				}

				return {
					id: `mv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}-${i}`,
					title: f.title || f.name.replace(/\.[^/.]+$/, ""),
					url: `${baseUrl}/${encodePath(f.name)}`,
					date: videoDate,
					thumbnailUrl: thumbFile
						? `${baseUrl}/${encodePath(thumbFile.name)}`
						: "",
					thumbnailXOffset: 50,
					thumbnailYOffset: 50,
					useDefaultThumbnail: false,
					order: currentVideos.length + i + 1,
				};
			});

			const updatedVideos = [...currentVideos, ...newVideos];

			await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
			setMandalVideos(updatedVideos);
			showToast(`Successfully imported ${newVideos.length} videos!`, "success");

			closeArchiveImport();
			setArchiveUrl("");
		} catch (e: any) {
			showToast(`Archive Import Failed: ${e.message}`, "error");
		} finally {
			setImportingArchive(false);
		}
	};

	const handleDeleteVideo = (video: MandalVideo) => {
		setConfirmDialog({
			message: `Delete video "${video.title}"? This cannot be undone.`,
			onConfirm: async () => {
				if (!effectiveMandalId) return;
				setDeletingVideoId(video.id);
				try {
					const mandalRef = doc(db, "mandals", effectiveMandalId);
					const snap = await getDocFromServer(mandalRef);
					const currentVideos: MandalVideo[] = snap.exists()
						? snap.data().videos || []
						: [];
					const updatedVideos = currentVideos.filter((v) => v.id !== video.id);
					await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });

					// Soft delete from B2
					if (video.url?.includes("videos.chaitanyaprembhakti.org")) {
						try {
							await softDeleteFromB2(video.url);
						} catch (e) {
							console.error("Failed to soft delete from B2:", e);
						}
					}
					setMandalVideos(updatedVideos);
					showToast("Video deleted.");
				} catch (_e) {
					showToast("Failed to delete video.", "error");
				}
				setDeletingVideoId(null);
			},
		});
	};

	const handleBulkDelete = () => {
		if (mandalVideos.length === 0) return;
		setConfirmDialog({
			message: `Are you sure you want to delete ALL ${mandalVideos.length} videos from this mandal? This CANNOT be undone.`,
			onConfirm: async () => {
				if (!effectiveMandalId) return;
				setImportingArchive(true); // Re-use spinner state
				try {
					await setDoc(
						doc(db, "mandals", effectiveMandalId),
						{ videos: [] },
						{ merge: true },
					);

					// Soft delete all from B2
					for (const v of mandalVideos) {
						if (v.url?.includes("videos.chaitanyaprembhakti.org")) {
							try {
								await softDeleteFromB2(v.url);
							} catch (e) {
								console.error("Failed to soft delete from B2:", e);
							}
						}
					}
					setMandalVideos([]);
					showToast("All videos deleted successfully.");
				} catch (_e) {
					showToast("Failed to delete all videos.", "error");
				}
				setImportingArchive(false);
			},
		});
	};

	const handleBulkRename = () => {
		if (mandalVideos.length === 0) return;
		setBulkRenameBaseName("");
		setShowBulkRename(true);
	};

	const confirmBulkRename = () => {
		setShowBulkRename(false);
		const prefix = bulkRenameBaseName.trim()
			? `${bulkRenameBaseName.trim()} `
			: "";

		setConfirmDialog({
			title: "Bulk Rename Videos",
			confirmText: "Yes, Rename All",
			isDestructive: false,
			message: `Rename all ${mandalVideos.length} videos to "${prefix}1", "${prefix}2", etc.?`,
			onConfirm: async () => {
				if (!effectiveMandalId) return;
				setImportingArchive(true);
				try {
					const mandalRef = doc(db, "mandals", effectiveMandalId);
					const snap = await getDocFromServer(mandalRef);
					const currentVideos: MandalVideo[] = snap.exists()
						? snap.data().videos || []
						: [];
					const updatedVideos = currentVideos.map((v, i) => ({
						...v,
						title: `${prefix}${i + 1}`,
					}));
					await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
					setMandalVideos(updatedVideos);
					showToast("All videos renamed successfully.");
				} catch (_e) {
					showToast("Failed to rename videos.", "error");
				}
				setImportingArchive(false);
			},
		});
	};

	const handleFixVideoOrdering = () => {
		setConfirmDialog({
			title: "Fix Order Sequence",
			confirmText: "Yes, Fix It",
			isDestructive: false,
			message: `Reset order sequence for all ${mandalVideos.length} videos to start from 1?`,
			onConfirm: async () => {
				if (!effectiveMandalId) return;
				setFixingOrder(true);
				try {
					const mandalRef = doc(db, "mandals", effectiveMandalId);
					const snap = await getDocFromServer(mandalRef);
					const currentVideos: MandalVideo[] = snap.exists()
						? snap.data().videos || []
						: [];
					const sorted = [...currentVideos].sort((a, b) => a.order - b.order);
					const updatedVideos = sorted.map((v, i) => ({ ...v, order: i + 1 }));
					await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
					setMandalVideos(updatedVideos);
					showToast("Order sequence fixed successfully.");
				} catch (_e) {
					showToast("Failed to fix video ordering.", "error");
				}
				setFixingOrder(false);
			},
		});
	};

	// Effect to handle fetching thumbnails when modal opens
	useEffect(() => {
		if (!showAllThumbsFor || !videoForm.url) return;

		let cacheKey = videoForm.url;
		const match = videoForm.url.match(
			/(?:archive\.org.*?\/(?:download|details|items)|(?:download|details|items))\/([^/?]+)/,
		);
		if (match) {
			cacheKey = match[1];
		}

		if (archiveDataCache[cacheKey]) {
			return;
		}

		setFetchingThumbsFor(cacheKey);
		const fetchArchiveFn = httpsCallable(functions, "fetchArchiveMetadata");
		fetchArchiveFn({ identifier: cacheKey })
			.then((response) => {
				const data = response.data as any;
				if (data?.files) {
					// Construct the base URL for the item to ensure thumbnails work regardless of cluster
					const serverUrl =
						data.server && data.dir
							? `https://${data.server}${data.dir}`
							: `https://archive.org/download/${cacheKey}`;
					const thumbs = data.files
						.filter((f: any) =>
							f.name?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/),
						)
						.map(
							(f: any) =>
								`${serverUrl}/${f.name.split("/").map(encodeURIComponent).join("/")}`,
						);
					setArchiveDataCache((prev) => ({ ...prev, [cacheKey]: thumbs }));
				} else {
					setArchiveDataCache((prev) => ({ ...prev, [cacheKey]: [] }));
				}
			})
			.catch((err) => {
				console.error("Failed to fetch thumbs:", err);
				setArchiveDataCache((prev) => ({ ...prev, [cacheKey]: [] }));
			})
			.finally(() => setFetchingThumbsFor(null));
	}, [showAllThumbsFor, videoForm.url, archiveDataCache]);

	const getAvailableThumbs = (_videoId: string, currentUrl: string) => {
		if (!currentUrl) return [];

		let cacheKey = currentUrl;
		const match = currentUrl.match(
			/(?:archive\.org.*?\/(?:download|details|items)|(?:download|details|items))\/([^/?]+)/,
		);
		if (match) {
			cacheKey = match[1];
		}

		return archiveDataCache[cacheKey] || [];
	};

	const handleFixThumbnails = () => {
		if (!effectiveMandalId || mandalVideos.length === 0) return;

		setConfirmDialog({
			title: "Fetch Thumbnails",
			confirmText: "Start Fetching",
			isDestructive: false,
			message: `Attempt to fix missing thumbnails for all ${mandalVideos.length} videos by fetching from Archive.org?`,
			onConfirm: async () => {
				setFixingThumbnails(true);
				let fixedCount = 0;
				let skippedLog = "";

				try {
					const mandalRef = doc(db, "mandals", effectiveMandalId);
					const snap = await getDocFromServer(mandalRef);
					const currentVideos: MandalVideo[] = snap.exists()
						? snap.data().videos || []
						: [];

					const archiveVideos: Record<string, MandalVideo[]> = {};
					currentVideos.forEach((v) => {
						let identifier = "";
						if (v.url.includes("archive.org/")) {
							const match = v.url.match(/(?:download|items|details)\/([^/]+)/);
							if (match?.[1]) identifier = match[1];
						}
						if (identifier) {
							if (!archiveVideos[identifier]) archiveVideos[identifier] = [];
							archiveVideos[identifier].push(v);
						}
					});

					const identifiers = Object.keys(archiveVideos);
					if (identifiers.length === 0) {
						showToast(
							"No Archive.org videos found in this folder to fix.",
							"error",
						);
						setFixingThumbnails(false);
						return;
					}

					let updatedVideos = [...currentVideos];

					for (const identifier in archiveVideos) {
						try {
							const fetchArchiveFn = httpsCallable(
								functions,
								"fetchArchiveMetadata",
							);
							const response = await fetchArchiveFn({ identifier });
							const data = response.data as any;

							if (!data?.files) {
								skippedLog += `No files for ${identifier}. `;
								continue;
							}

							const baseUrl =
								data.server && data.dir
									? `https://${data.server}${data.dir}`
									: `https://archive.org/download/${identifier}`;

							const encodePath = (path: string) =>
								path.split("/").map(encodeURIComponent).join("/");

							for (const v of archiveVideos[identifier]) {
								const cleanUrl = v.url.trim().split("?")[0].split("#")[0];
								let urlStr = cleanUrl.replace(/\+/g, " ");
								try {
									urlStr = decodeURIComponent(urlStr);
								} catch (_e) {
									console.warn("Failed to decode URI component:", urlStr);
								}

								const lastSlashIndex = urlStr.lastIndexOf("/");
								const fileName = urlStr.substring(lastSlashIndex + 1);
								const videoBaseName = fileName.replace(/\.[^/.]+$/, "").trim();

								if (!videoBaseName) {
									skippedLog += `Invalid URL format for ${v.url}. `;
									continue;
								}

								const allThumbs = data.files.filter((df: any) => {
									const isImage = df.name
										?.toLowerCase()
										.match(/\.(jpg|jpeg|png|gif|webp)$/);
									if (!isImage) return false;

									const origClean = (df.original || "")
										.replace(/\.[^/.]+$/, "")
										.trim();
									const thumbName = df.name || "";

									return (
										origClean === videoBaseName ||
										thumbName.includes(`${videoBaseName}_`) ||
										thumbName.includes(`${videoBaseName} _`)
									);
								});

								const resolvedThumb =
									allThumbs.length > 0
										? allThumbs.reduce(
												(best: any, cur: any) =>
													parseInt(cur.size || "0", 10) >
													parseInt(best.size || "0", 10)
														? cur
														: best,
												allThumbs[0],
											)
										: null;

								if (resolvedThumb) {
									const newThumbUrl = `${baseUrl}/${encodePath(resolvedThumb.name)}`;
									if (
										!v.thumbnailUrl ||
										v.useDefaultThumbnail ||
										v.thumbnailUrl.includes("default")
									) {
										updatedVideos = updatedVideos.map((vid) =>
											vid.id === v.id
												? {
														...vid,
														thumbnailUrl: newThumbUrl,
														useDefaultThumbnail: false,
													}
												: vid,
										);
										fixedCount++;
									}
								} else {
									skippedLog += `No thumb for ${videoBaseName}. `;
								}
							}
						} catch (err) {
							console.error(`Failed to fetch metadata for ${identifier}:`, err);
							skippedLog += `Error fetching ${identifier}. `;
						}
					}

					if (fixedCount > 0) {
						await setDoc(
							doc(db, "mandals", effectiveMandalId),
							{ videos: updatedVideos },
							{ merge: true },
						);
						setMandalVideos(updatedVideos);
						showToast(`Successfully fixed ${fixedCount} thumbnails!`);
					} else {
						showToast(
							`0 fixed. Details: ${skippedLog || "All already have thumbnails"}`,
							"error",
						);
					}
				} catch (_e) {
					showToast("Failed to fix thumbnails.", "error");
				}
				setFixingThumbnails(false);
			},
		});
	};

	const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !effectiveMandalId) return;

		let currentVideoId = editingVideo?.id;
		if (!currentVideoId) {
			currentVideoId = `mv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
			const mandalRef = doc(db, "mandals", effectiveMandalId);
			const existingVideos = mandalVideos;
			const newVideo: MandalVideo = {
				id: currentVideoId,
				title: videoForm.title.trim() || file.name,
				url: "Processing...",
				date: videoForm.date || new Date().toISOString().split("T")[0],
				thumbnailUrl: videoForm.thumbnailUrl || "",
				useDefaultThumbnail: true,
				order: existingVideos.length,
			};
			await setDoc(
				mandalRef,
				{ videos: [...existingVideos, newVideo] },
				{ merge: true },
			);
			setEditingVideo(newVideo);
			setVideoForm((prev) => ({ ...prev, url: "Processing..." }));
			fetchMandalVideos(effectiveMandalId);
		} else {
			setVideoForm((prev) => ({ ...prev, url: "Processing..." }));
		}

		// Create abort controller for this upload so cancel button can stop it
		const controller = new AbortController();
		uploadAbortControllerRef.current = controller;
		uploadingVideoIdRef.current = currentVideoId;

		setUploadingVideo(true);
		setUploadVideoProgress(0);
		setUploadingFileName(file.name);

		try {
			const folderName = selectedRelease
				? selectedRelease.name.replace(/\//g, "-")
				: effectiveMandalId || "unknown";
			const uploadDate =
				videoForm.date || new Date().toISOString().split("T")[0];
			const folderPath = `Uploaded from app/GalleryUI Uploads/${folderName}/${uploadDate}/`;

			const dlUrl = await uploadFileToB2(
				file,
				(progress) => {
					setUploadVideoProgress(progress);
				},
				folderPath,
				controller.signal,
			);
			const mandalRef = doc(db, "mandals", effectiveMandalId!);
			const snap = await getDocFromServer(mandalRef);
			if (snap.exists()) {
				const data = snap.data();
				const updatedVideos = (data.videos || []).map((v: any) =>
					v.id === currentVideoId ? { ...v, url: dlUrl } : v,
				);
				await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
			}
			setVideoForm((prev) => ({ ...prev, url: dlUrl }));
			setEditingVideo((prev) => (prev ? { ...prev, url: dlUrl } : null));
			fetchMandalVideos(effectiveMandalId);
			showToast("Video uploaded successfully to B2!", "success");
			setUploadingVideo(false);
			setUploadingFileName("");
		} catch (error: any) {
			if (error?.name !== "AbortError") {
				showToast(`Video upload failed: ${error.message}`, "error");
			}
			setUploadingVideo(false);
			setUploadingFileName("");
			setEditingVideo((prev) => (prev ? { ...prev, url: "" } : null));
		}
		uploadAbortControllerRef.current = null;
		uploadingVideoIdRef.current = null;
		if (videoInputRef.current) videoInputRef.current.value = "";
	};

	const handleBulkVideoUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(e.target.files || []);
		if (files.length === 0 || !effectiveMandalId) return;

		const queue: {
			task: BulkUploadTask;
			file: File;
			targetFileName: string;
		}[] = [];
		const newTasks: BulkUploadTask[] = [];
		const mandalRef = doc(db, "mandals", effectiveMandalId);
		const existingVideos = mandalVideos;
		const newVideosToSave: MandalVideo[] = [];

		for (const file of files) {
			const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
			const targetFileName = `${Date.now()}_${safeFileName}`;
			const videoId = `mv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

			newVideosToSave.push({
				id: videoId,
				title: file.name.replace(/\.[^/.]+$/, ""),
				url: "Processing...",
				date: new Date().toISOString().split("T")[0],
				thumbnailUrl: "",
				useDefaultThumbnail: true,
				order: existingVideos.length + newVideosToSave.length,
			});

			const task: BulkUploadTask = {
				id: videoId,
				name: file.name,
				progress: 0,
				status: "pending",
			};
			newTasks.push(task);
			queue.push({ task, file, targetFileName });
		}

		if (newVideosToSave.length > 0) {
			await setDoc(
				mandalRef,
				{ videos: [...existingVideos, ...newVideosToSave] },
				{ merge: true },
			);
			fetchMandalVideos(effectiveMandalId);
		}

		setBulkUploadTasks((prev) => [...prev, ...newTasks]);

		// Create a shared abort controller for the bulk session
		const controller = new AbortController();
		uploadAbortControllerRef.current = controller;
		setUploadingVideo(true);
		setUploadVideoProgress(0);

		for (const item of queue) {
			if (controller.signal.aborted) break;

			setUploadingFileName(item.file.name);
			uploadingVideoIdRef.current = item.task.id;
			setBulkUploadTasks((prev) =>
				prev.map((t) =>
					t.id === item.task.id ? { ...t, status: "uploading" } : t,
				),
			);
			try {
				const folderName = selectedRelease
					? selectedRelease.name.replace(/\//g, "-")
					: effectiveMandalId || "unknown";
				const uploadDate = new Date().toISOString().split("T")[0];
				const folderPath = `Uploaded from app/gallery ui upload/${folderName}/${uploadDate}/`;

				const dlUrl = await uploadFileToB2(
					item.file,
					(progress) => {
						setBulkUploadTasks((prev) =>
							prev.map((t) => (t.id === item.task.id ? { ...t, progress } : t)),
						);
					},
					folderPath,
					controller.signal,
				);
				const mandalRef = doc(db, "mandals", effectiveMandalId!);
				const snap = await getDocFromServer(mandalRef);
				if (snap.exists()) {
					const data = snap.data();
					const updatedVideos = (data.videos || []).map((v: any) =>
						v.id === item.task.id ? { ...v, url: dlUrl } : v,
					);
					await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
				}
				setBulkUploadTasks((prev) =>
					prev.map((t) =>
						t.id === item.task.id
							? { ...t, status: "completed", progress: 100 }
							: t,
					),
				);
				fetchMandalVideos(effectiveMandalId);
			} catch (error: any) {
				if (error?.name === "AbortError") break;
				setBulkUploadTasks((prev) =>
					prev.map((t) =>
						t.id === item.task.id
							? { ...t, status: "error", error: error.message }
							: t,
					),
				);
			}
		}
		setUploadingVideo(false);
		setUploadingFileName("");
		uploadAbortControllerRef.current = null;
		if (bulkVideoInputRef.current) bulkVideoInputRef.current.value = "";
	};

	/**
	 * Called when admin confirms Cancel in the upload blocker.
	 * Aborts in-flight XHR and resets the Firestore video URL to "" (Option B).
	 */
	const handleCancelUpload = async () => {
		uploadAbortControllerRef.current?.abort();
		setUploadingVideo(false);
		setUploadVideoProgress(0);
		setUploadingFileName("");

		// Reset the current file's URL plus any other bulk-queued files that
		// never got a chance to start — otherwise those stay as "Processing..."
		// forever.
		const videoId = uploadingVideoIdRef.current;
		const cleanupIds = new Set<string>();
		if (videoId) cleanupIds.add(videoId);
		for (const t of bulkUploadTasks) {
			if (t.status === "pending" || t.status === "uploading") {
				cleanupIds.add(t.id);
			}
		}
		if (cleanupIds.size > 0 && effectiveMandalId) {
			try {
				const mandalRef = doc(db, "mandals", effectiveMandalId);
				const snap = await getDocFromServer(mandalRef);
				if (snap.exists()) {
					const updatedVideos = (snap.data().videos || []).map((v: any) =>
						cleanupIds.has(v.id) ? { ...v, url: "" } : v,
					);
					await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
				}
			} catch (_e) {
				// Best-effort
			}
		}
		uploadingVideoIdRef.current = null;
	};

	// ── WEEKLY PROGRAM HANDLER ──
	const handleSaveWeekly = async () => {
		if (!effectiveMandalId) {
			showToast("Mandal not selected.", "error");
			return;
		}
		setSavingWeekly(true);
		try {
			await setDoc(
				doc(db, "mandals", effectiveMandalId),
				{ weeklyProgram: weeklyProgram },
				{ merge: true },
			);
			showToast("Weekly program saved!");
		} catch (e: any) {
			showToast(`Failed to save: ${e.message}`, "error");
		}
		setSavingWeekly(false);
	};

	const sortedAssets =
		selectedRelease?.assets.sort((a, b) => {
			const pA = parseAssetName(a.name);
			const pB = parseAssetName(b.name);
			if (pA.date && pB.date && pA.date !== pB.date) {
				return (
					new Date(formatForDateInput(pB.date)).getTime() -
					new Date(formatForDateInput(pA.date)).getTime()
				);
			}
			if (pA.order !== pB.order) {
				return pA.order - pB.order;
			}
			return pA.displayName.localeCompare(pB.displayName, undefined, {
				numeric: true,
				sensitivity: "base",
			});
		}) || [];

	return (
		<>
			<div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right">
				{/* Header Actions */}
				<div className="flex-none bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-end shadow-sm z-10 gap-3">
					<div className="flex items-center gap-4 self-end sm:self-auto">
						{/* View Type Toggle */}
						<div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
							<button
								onClick={() => {
									setViewType("gallery");
									closeSelectedFolder();
								}}
								className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
									viewType === "gallery"
										? "bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm"
										: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
								}`}
							>
								Gallery
							</button>
							<button
								onClick={() => {
									setViewType("activity");
									closeSelectedFolder();
								}}
								className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
									viewType === "activity"
										? "bg-white dark:bg-slate-600 text-pink-600 dark:text-pink-400 shadow-sm"
										: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
								}`}
							>
								Activity
							</button>
						</div>

						<div className="flex gap-2">
							<button
								onClick={runDiagnostics}
								className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-xs font-bold flex items-center gap-1"
								title="Run Diagnostics"
							>
								<AlertCircle size={16} className="text-orange-500" />
							</button>
							<button
								onClick={fetchReleases}
								disabled={loading}
								className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
							>
								<RefreshCw
									size={20}
									className={`text-slate-600 dark:text-slate-300 ${
										loading ? "animate-spin" : ""
									}`}
								/>
							</button>
						</div>
					</div>
				</div>

				{/* Diagnostics Panel */}
				{showDiagnostics && (
					<div
						className={`bg-slate-900 text-white border-b border-slate-700 flex flex-col transition-all duration-300 ${
							isMinimized ? "h-auto" : "max-h-60"
						}`}
					>
						<div className="flex justify-between items-center p-2 bg-slate-800 border-b border-slate-700">
							<span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-ink-400">
								System Logs
							</span>
							<div className="flex items-center gap-1">
								<button
									onClick={() => setIsMinimized(!isMinimized)}
									className="text-slate-400 dark:text-ink-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
								>
									{isMinimized ? (
										<ChevronDown size={16} />
									) : (
										<ChevronUp size={16} />
									)}
								</button>
								<button
									onClick={() => closeDiagnostics()}
									className="text-slate-400 dark:text-ink-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
								>
									<Check size={16} />
								</button>
							</div>
						</div>
						{!isMinimized && (
							<div className="overflow-y-auto p-3 text-xs font-mono space-y-1">
								{diagnostics.map((log, i) => (
									<div
										key={i}
										className="break-all border-b border-slate-800/50 pb-1 mb-1 last:border-0"
									>
										{log}
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* Upload Modal */}
				{showUploadModal && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
						<div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
							<div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
								<h3 className="font-bold text-lg text-slate-800 dark:text-white">
									Upload {selectedFiles.length} item(s)
								</h3>
								<button
									onClick={() => handleClose_gallery_upload_ui()}
									className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-ink-300"
								>
									<X size={16} />
								</button>
							</div>

							<div className="flex-1 overflow-y-auto p-4 space-y-3">
								{selectedFiles.map((item, index) => (
									<div
										key={index}
										className="flex gap-3 items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700"
									>
										<img
											src={item.previewUrl}
											alt="preview"
											className="w-10 h-10 object-cover rounded shrink-0 bg-slate-200 dark:bg-slate-800"
										/>
										<div className="flex-1 min-w-0 flex flex-col gap-1">
											<input
												value={item.name}
												onChange={(e) => {
													const newFiles = [...selectedFiles];
													newFiles[index].name = e.target.value;
													setSelectedFiles(newFiles);
												}}
												placeholder="Display Name"
												className="w-full bg-white dark:bg-slate-800 outline-none text-xs font-medium text-slate-800 dark:text-white rounded border border-slate-200 dark:border-slate-700 p-1.5"
											/>
											<div className="flex gap-2">
												<input
													type="date"
													value={formatForDateInput(item.date) || ""}
													onChange={(e) => {
														const newFiles = [...selectedFiles];
														newFiles[index].date = e.target.value;
														setSelectedFiles(newFiles);
													}}
													className="w-full bg-white dark:bg-slate-800 outline-none text-xs font-medium text-slate-800 dark:text-white rounded border border-slate-200 dark:border-slate-700 p-1.5"
												/>
												<input
													type="number"
													placeholder="Order"
													value={item.order}
													onChange={(e) => {
														const newFiles = [...selectedFiles];
														newFiles[index].order =
															parseInt(e.target.value, 10) || 0;
														setSelectedFiles(newFiles);
													}}
													className="w-16 bg-white dark:bg-slate-800 outline-none text-xs font-medium text-slate-800 dark:text-white rounded border border-slate-200 dark:border-slate-700 p-1.5"
												/>
											</div>
										</div>
										<button
											onClick={() => {
												URL.revokeObjectURL(item.previewUrl);
												setSelectedFiles((prev) =>
													prev.filter((_, i) => i !== index),
												);
											}}
											className="text-slate-400 dark:text-ink-400 hover:text-red-500 p-1 shrink-0"
										>
											<Trash2 size={16} />
										</button>
									</div>
								))}
							</div>

							{uploading && (
								<div className="px-4 pb-2">
									<div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
										<div
											className="bg-blue-600 h-2 rounded-full transition-all duration-300"
											style={{ width: `${uploadProgress}%` }}
										/>
									</div>
								</div>
							)}

							<div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
								<button
									onClick={() => handleClose_gallery_upload_ui()}
									className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium"
								>
									Cancel
								</button>
								<button
									onClick={handleUploadConfirm}
									disabled={uploading}
									className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
								>
									{uploading ? (
										<Loader2 className="animate-spin" size={18} />
									) : (
										<Upload size={18} />
									)}
									{uploading ? `Uploading... ${uploadProgress}%` : "Upload All"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Content */}
				<div className="flex-1 overflow-hidden flex flex-col md:flex-row">
					{/* Sidebar - Folders */}
					<div
						className={`md:w-1/3 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-col ${
							selectedRelease ? "hidden md:flex" : "flex"
						} h-full`}
					>
						<div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
							<h3 className="font-bold text-slate-500 dark:text-ink-300 text-xs uppercase">
								Folders
							</h3>
							<button
								onClick={() => setShowNewFolderInput(true)}
								className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
							>
								<Plus size={16} />
							</button>
						</div>

						{showNewFolderInput && (
							<div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 animate-in slide-in-from-top">
								<input
									className="w-full p-2 text-sm rounded-lg border border-blue-200 dark:border-blue-700 mb-2"
									placeholder="Folder Name"
									value={newFolderName}
									onChange={(e) => setNewFolderName(e.target.value)}
								/>
								<label className="flex items-center gap-2 mb-3 cursor-pointer">
									<input
										type="checkbox"
										checked={isGalleryFolder}
										onChange={(e) => setIsGalleryFolder(e.target.checked)}
										className="rounded text-blue-500 focus:ring-blue-500 border-slate-300 dark:border-ink-700"
									/>
									<span className="text-xs font-bold text-slate-600 dark:text-slate-300">
										Is this a Past Event Media (Gallery)?
									</span>
								</label>
								<div className="flex gap-2">
									<button
										onClick={createRelease}
										disabled={loading || !newFolderName.trim()}
										className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
									>
										Create
									</button>
									<button
										onClick={() => setShowNewFolderInput(false)}
										className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold"
									>
										Cancel
									</button>
								</div>
							</div>
						)}

						<div className="flex-1 overflow-y-auto">
							{sortedReleases.map((release, index) => {
								const isVisible = visibleFolders.includes(release.id);
								const isEditing = editingFolderId === release.id;

								return (
									<div
										key={release.id}
										onClick={() => {
											if (!isEditing) setSelectedRelease(release);
										}}
										className={`p-3 border-b border-slate-100 dark:border-slate-800 transition-colors flex justify-between items-center group ${
											selectedRelease?.id === release.id && !isEditing
												? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600 cursor-default"
												: "hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-l-transparent cursor-pointer"
										}`}
									>
										<div className="min-w-0 flex-1">
											{isEditing ? (
												<div
													className="flex items-center gap-2"
													onClick={(e) => e.stopPropagation()}
												>
													<input
														value={editFolderName}
														onChange={(e) => setEditFolderName(e.target.value)}
														className="w-full p-1 text-sm rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
														onKeyDown={(e) => {
															if (e.key === "Enter")
																renameRelease(release.id, editFolderName);
															if (e.key === "Escape") setEditingFolderId(null);
														}}
													/>
													<button
														onClick={() =>
															renameRelease(release.id, editFolderName)
														}
														disabled={renamingFolderId === release.id}
														className="p-1 text-green-600 hover:bg-green-100 rounded"
													>
														{renamingFolderId === release.id ? (
															<Loader2 size={14} className="animate-spin" />
														) : (
															<Save size={14} />
														)}
													</button>
													<button
														onClick={() => setEditingFolderId(null)}
														className="p-1 text-slate-400 dark:text-ink-400 hover:bg-slate-200 dark:hover:bg-ink-700 rounded"
													>
														<X size={14} />
													</button>
												</div>
											) : (
												<>
													<h4
														className={`font-bold text-sm truncate ${
															selectedRelease?.id === release.id
																? "text-blue-700 dark:text-blue-300"
																: "text-slate-700 dark:text-slate-300"
														}`}
													>
														{formatFolderName(release.name)}
													</h4>
													<p className="text-xs text-slate-400 dark:text-ink-400 mt-0.5">
														{release.assets.length} items
													</p>
												</>
											)}
										</div>

										{!isEditing && (
											<div className="flex items-center gap-1">
												<button
													onClick={(e) => moveFolder(e, release.id, "up")}
													disabled={index === 0}
													className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:hover:text-slate-400"
													title="Move Up"
												>
													<ChevronUp size={16} />
												</button>
												<button
													onClick={(e) => moveFolder(e, release.id, "down")}
													disabled={index === sortedReleases.length - 1}
													className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:hover:text-slate-400"
													title="Move Down"
												>
													<ChevronDown size={16} />
												</button>

												<button
													onClick={(e) => {
														e.stopPropagation();
														setEditFolderName(formatFolderName(release.name));
														setEditingFolderId(release.id);
													}}
													className="p-2 text-slate-400 dark:text-ink-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all md:opacity-0 opacity-100"
												>
													<Edit2 size={16} />
												</button>
												<button
													onClick={(e) => toggleFolderVisibility(e, release.id)}
													disabled={savingVisibility === release.id}
													className={`p-2 rounded-lg transition-colors ${
														isVisible
															? "text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40"
															: "text-slate-400 dark:text-ink-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-ink-600"
													}`}
													title={isVisible ? "Visible in App" : "Hidden in App"}
												>
													{savingVisibility === release.id ? (
														<Loader2 size={16} className="animate-spin" />
													) : isVisible ? (
														<Eye size={16} />
													) : (
														<EyeOff size={16} />
													)}
												</button>

												<button
													onClick={(e) => {
														e.stopPropagation();
														handleDeleteClick(
															"folder",
															release.id,
															release.name,
														);
													}}
													disabled={deletingId === release.id}
													className="p-2 text-slate-400 dark:text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-100 md:opacity-0 opacity-100"
												>
													{deletingId === release.id ? (
														<Loader2
															size={16}
															className="animate-spin text-red-500"
														/>
													) : (
														<Trash2 size={16} />
													)}
												</button>
											</div>
										)}
									</div>
								);
							})}
							{releases.length === 0 && !loading && (
								<div className="p-8 text-center text-slate-400 dark:text-ink-400 text-sm">
									No folders found.
								</div>
							)}
						</div>
					</div>

					{/* Main Area - Images + Videos + Weekly Program */}
					<div
						className={`flex-1 bg-slate-50 dark:bg-slate-900 flex-col h-full overflow-hidden ${
							!selectedRelease ? "hidden md:flex" : "flex"
						}`}
					>
						{selectedRelease ? (
							<>
								<div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-wrap justify-between items-center gap-2 shadow-sm">
									<div className="flex items-center gap-2 flex-1 min-w-[50%]">
										<button
											onClick={() => closeSelectedFolder()}
											className="md:hidden p-1.5 -ml-1.5 text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-ink-700 rounded-lg"
										>
											<ArrowLeft size={18} />
										</button>
										<Folder
											size={16}
											className="text-slate-400 dark:text-ink-400 hidden md:block"
										/>
										<span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px] sm:max-w-xs">
											{formatFolderName(selectedRelease.name)}
										</span>
										{effectiveMandalId && (
											<span className="hidden sm:inline text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold capitalize">
												{effectiveMandalId}
											</span>
										)}
									</div>
									<div className="flex flex-wrap gap-2 items-center justify-end flex-1">
										<div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0">
											<Calendar
												size={14}
												className="text-slate-500 dark:text-ink-300"
											/>
											<input
												type="date"
												className="bg-transparent text-xs font-bold outline-none text-slate-700 dark:text-slate-300"
												value={formatForDateInput(globalDate) || ""}
												onChange={(e) => setGlobalDate(e.target.value)}
											/>
										</div>
										<input
											type="file"
											ref={fileInputRef}
											className="hidden"
											accept="image/*"
											multiple
											onChange={handleFileSelect}
										/>
										<button
											onClick={() => fileInputRef.current?.click()}
											disabled={uploading}
											className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
										>
											{uploading ? (
												<Loader2 size={16} className="animate-spin" />
											) : (
												<Upload size={16} />
											)}
											<span className="hidden sm:inline">Upload Photos</span>
											<span className="sm:hidden">Upload</span>
										</button>
									</div>
								</div>

								{/* ── TAB BAR ── */}
								<div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
									<button
										onClick={() => setActiveTab("photos")}
										className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors border-b-2 ${
											activeTab === "photos"
												? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10"
												: "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
										}`}
									>
										<ImageIcon size={14} />
										Photos
										{sortedAssets.length > 0 && (
											<span
												className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
													activeTab === "photos"
														? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
														: "bg-slate-100 dark:bg-slate-700 text-slate-500"
												}`}
											>
												{sortedAssets.length}
											</span>
										)}
									</button>
									<button
										onClick={() => setActiveTab("videos")}
										className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors border-b-2 ${
											activeTab === "videos"
												? "border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-900/10"
												: "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
										}`}
									>
										<Video size={14} />
										Videos
										{mandalVideos.length > 0 && (
											<span
												className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
													activeTab === "videos"
														? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
														: "bg-slate-100 dark:bg-slate-700 text-slate-500"
												}`}
											>
												{mandalVideos.length}
											</span>
										)}
									</button>
									<button
										onClick={() => setActiveTab("weekly")}
										className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors border-b-2 ${
											activeTab === "weekly"
												? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10"
												: "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
										}`}
									>
										<Calendar size={14} />
										Weekly
										{weeklyProgram.enabled && (
											<span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
												ON
											</span>
										)}
									</button>
								</div>

								{/* ── MANDAL SELECTOR (when Videos or Weekly tab active) ── */}
								{(activeTab === "videos" || activeTab === "weekly") && (
									<div
										className={`px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 ${
											effectiveMandalId
												? "bg-emerald-50 dark:bg-emerald-900/10"
												: "bg-amber-50 dark:bg-amber-900/10"
										}`}
									>
										<div className="flex items-center gap-1.5 shrink-0">
											<span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
												{autoMatchedMandalId
													? "Linked"
													: manualMandalId
														? "Linked"
														: "Independent"}
											</span>
										</div>
										<div className="relative flex-1">
											<button
												onClick={() =>
													!autoMatchedMandalId &&
													setIsMandalDropdownOpen(!isMandalDropdownOpen)
												}
												disabled={!!autoMatchedMandalId}
												className={`w-full flex items-center justify-between text-xs py-1.5 px-3 rounded-lg border outline-none font-bold capitalize transition-all ${
													manualMandalId || autoMatchedMandalId
														? "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300"
														: "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300"
												} disabled:opacity-70 disabled:cursor-not-allowed`}
											>
												<span className="truncate">
													{autoMatchedMandalId
														? MANDAL_LIST.find(
																(m) => m.id === autoMatchedMandalId,
															)?.name
														: manualMandalId
															? MANDAL_LIST.find((m) => m.id === manualMandalId)
																	?.name
															: "Independent (This folder only)"}
												</span>
												<ChevronDown
													size={14}
													className={`transition-transform duration-200 ${isMandalDropdownOpen ? "rotate-180" : ""}`}
												/>
											</button>

											{isMandalDropdownOpen && (
												<>
													<div
														className="fixed inset-0 z-40"
														onClick={() => setIsMandalDropdownOpen(false)}
													/>
													<div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2">
														<button
															onClick={() => {
																setManualMandalId(null);
																setIsMandalDropdownOpen(false);
															}}
															className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${!manualMandalId ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
														>
															Independent (This folder only)
														</button>
														{MANDAL_LIST.map((m) => (
															<button
																key={m.id}
																onClick={() => {
																	setManualMandalId(m.id);
																	setIsMandalDropdownOpen(false);
																}}
																className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${manualMandalId === m.id ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
															>
																{m.name}
															</button>
														))}
													</div>
												</>
											)}
										</div>
										{autoMatchedMandalId && (
											<span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
												Auto
											</span>
										)}
									</div>
								)}

								<div className="flex-1 overflow-y-auto p-4 space-y-4">
									{error && (
										<div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800">
											{error}
										</div>
									)}

									{/* ══════════ PHOTOS TAB ══════════ */}
									{activeTab === "photos" && (
										<>
											<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
												{sortedAssets.map((asset) => {
													const isEditing = editingAssetId === asset.id;
													const parsed = parseAssetName(asset.name);
													return (
														<div
															key={asset.id}
															className="group relative aspect-square bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
														>
															<CachedImage
																src={asset.browser_download_url}
																alt={parsed.displayName}
																className="w-full h-full object-cover"
																loading="lazy"
															/>
															<div
																className={`absolute inset-0 bg-black/60 transition-opacity flex flex-col justify-between p-2 ${
																	isEditing
																		? "opacity-100"
																		: "opacity-100 md:opacity-0 md:group-hover:opacity-100"
																}`}
															>
																{isEditing ? (
																	<div className="flex flex-col gap-2 w-full h-full justify-center">
																		<input
																			value={editAssetName}
																			onChange={(e) =>
																				setEditAssetName(e.target.value)
																			}
																			placeholder="Name"
																			className="w-full p-1.5 text-xs rounded border border-blue-400 bg-white dark:bg-ink-800 text-slate-800 dark:text-cream-100"
																			onKeyDown={(e) => {
																				if (e.key === "Enter")
																					renameAsset(asset.id);
																				if (e.key === "Escape")
																					setEditingAssetId(null);
																			}}
																		/>
																		<input
																			type="date"
																			value={
																				formatForDateInput(editAssetDate) || ""
																			}
																			onChange={(e) =>
																				setEditAssetDate(e.target.value)
																			}
																			className="w-full p-1.5 text-xs rounded border border-blue-400 bg-white dark:bg-ink-800 text-slate-800 dark:text-cream-100"
																		/>
																		<input
																			type="number"
																			value={editAssetOrder}
																			onChange={(e) =>
																				setEditAssetOrder(
																					parseInt(e.target.value, 10) || 0,
																				)
																			}
																			placeholder="Order"
																			className="w-full p-1.5 text-xs rounded border border-blue-400 bg-white dark:bg-ink-800 text-slate-800 dark:text-cream-100"
																		/>
																		<div className="flex gap-2 justify-end mt-1">
																			<button
																				onClick={() => renameAsset(asset.id)}
																				disabled={renamingAssetId === asset.id}
																				className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex-1 flex justify-center"
																			>
																				{renamingAssetId === asset.id ? (
																					<Loader2
																						size={14}
																						className="animate-spin"
																					/>
																				) : (
																					<Save size={14} />
																				)}
																			</button>
																			<button
																				onClick={() => setEditingAssetId(null)}
																				className="p-1.5 bg-slate-600 text-white rounded hover:bg-slate-700 flex-1 flex justify-center"
																			>
																				<X size={14} />
																			</button>
																		</div>
																	</div>
																) : (
																	<>
																		<div className="text-white text-[10px] sm:text-xs truncate w-full font-medium bg-black/50 p-1.5 rounded space-y-0.5 backdrop-blur-sm">
																			<div className="font-bold text-blue-300 truncate">
																				{parsed.displayName}
																			</div>
																			<div className="text-[9px] sm:text-[10px] text-slate-300 flex justify-between">
																				<span>{parsed.date || "No date"}</span>
																				<span>#{parsed.order}</span>
																			</div>
																		</div>
																		<div className="flex justify-end gap-2 mt-auto">
																			<button
																				onClick={() => {
																					setEditAssetName(parsed.displayName);
																					setEditAssetDate(
																						parsed.date || globalDate,
																					);
																					setEditAssetOrder(parsed.order);
																					setEditAssetExt(parsed.extension);
																					setEditingAssetId(asset.id);
																				}}
																				className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
																			>
																				<Edit2 size={16} />
																			</button>
																			<button
																				onClick={() =>
																					handleDeleteClick(
																						"asset",
																						asset.id,
																						asset.name,
																					)
																				}
																				disabled={deletingId === asset.id}
																				className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70"
																			>
																				{deletingId === asset.id ? (
																					<Loader2
																						size={16}
																						className="animate-spin"
																					/>
																				) : (
																					<Trash2 size={16} />
																				)}
																			</button>
																		</div>
																	</>
																)}
															</div>
														</div>
													);
												})}
											</div>
											{sortedAssets.length === 0 && (
												<div className="h-52 flex flex-col items-center justify-center text-slate-400 dark:text-ink-400">
													<ImageIcon size={40} className="mb-2 opacity-40" />
													<p className="text-sm font-medium">No photos yet</p>
													<p className="text-xs mt-1 opacity-70">
														Use "Upload Photos" to add images
													</p>
												</div>
											)}
										</>
									)}

									{/* ══════════ VIDEOS TAB ══════════ */}
									{activeTab === "videos" && (
										<div className="space-y-3">
											{/* Add Video button */}
											{effectiveMandalId &&
												!videoFormOpen &&
												!editingVideo &&
												!showArchiveImport && (
													<div className="flex gap-2">
														<button
															onClick={() => {
																setEditingVideo(null);
																setVideoForm({
																	title: "",
																	url: "",
																	date: globalDate,
																	thumbnailUrl: "",
																});
																setVideoFormOpen(true);
															}}
															className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed font-bold text-sm transition-colors border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
														>
															<Plus size={18} /> Add Video
														</button>
														<button
															onClick={() => {
																setShowArchiveImport(true);
															}}
															className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed font-bold text-sm transition-colors border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
														>
															<Link size={18} /> Import from Archive.org
														</button>
														<input
															type="file"
															ref={bulkVideoInputRef}
															onChange={handleBulkVideoUpload}
															accept="video/mp4,video/mkv,video/avi"
															multiple
															className="hidden"
														/>
														<button
															onClick={() => bulkVideoInputRef.current?.click()}
															className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed font-bold text-sm transition-colors border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
														>
															<PlayCircle size={18} /> Bulk Upload
														</button>
													</div>
												)}

											{/* Bulk Upload Progress UI */}
											{bulkUploadTasks.length > 0 && (
												<div className="bg-white dark:bg-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm p-4 mt-2 mb-2 animate-in fade-in slide-in-from-top-4 space-y-3">
													<div className="flex items-center justify-between">
														<h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
															<PlayCircle size={16} /> Bulk Uploads (
															{
																bulkUploadTasks.filter(
																	(t) => t.status === "completed",
																).length
															}
															/{bulkUploadTasks.length})
														</h4>
														<button
															onClick={() =>
																setBulkUploadTasks((prev) =>
																	prev.filter(
																		(t) =>
																			t.status !== "completed" &&
																			t.status !== "error",
																	),
																)
															}
															className="text-xs text-slate-500 dark:text-ink-300 hover:text-slate-700 dark:hover:text-slate-300"
														>
															Clear Finished
														</button>
													</div>
													<div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
														{bulkUploadTasks.map((task) => (
															<div
																key={task.id}
																className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 flex items-center gap-3 border border-slate-100 dark:border-slate-800"
															>
																<div className="flex-1 min-w-0">
																	<p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
																		{task.name}
																	</p>
																	{task.status === "error" ? (
																		<p className="text-[10px] text-red-500 mt-0.5 truncate">
																			{task.error}
																		</p>
																	) : (
																		<div className="flex items-center gap-2 mt-1">
																			<div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
																				<div
																					className={`h-full rounded-full transition-all duration-300 ${task.status === "completed" ? "bg-emerald-500" : "bg-emerald-400"}`}
																					style={{ width: `${task.progress}%` }}
																				/>
																			</div>
																			<span className="text-[10px] font-bold text-slate-500 dark:text-ink-300 w-6 text-right">
																				{task.progress}%
																			</span>
																		</div>
																	)}
																</div>
															</div>
														))}
													</div>
												</div>
											)}

											{/* Archive.org Import Form */}
											{showArchiveImport && effectiveMandalId && (
												<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4">
													<div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 flex justify-between items-center">
														<h5 className="font-bold text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
															<Link size={16} /> Bulk Import from Archive.org
														</h5>
													</div>
													<div className="p-4 space-y-3">
														<div>
															<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
																Archive.org Item URL
															</label>
															<input
																type="url"
																className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400 font-mono"
																placeholder="https://archive.org/details/..."
																value={archiveUrl}
																onChange={(e) => setArchiveUrl(e.target.value)}
															/>
															<p className="text-[10px] text-slate-400 dark:text-ink-400 mt-1.5">
																Paste the link to your Archive.org item. All
																MP4/MKV files will be extracted.
															</p>
														</div>
														<div className="flex gap-3 pt-1">
															<button
																onClick={() => closeArchiveImport()}
																className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
															>
																Cancel
															</button>
															<button
																onClick={handleArchiveImport}
																disabled={importingArchive}
																className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
															>
																{importingArchive ? (
																	<Loader2 size={16} className="animate-spin" />
																) : (
																	<Save size={16} />
																)}
																{importingArchive
																	? "Importing..."
																	: "Fetch & Import"}
															</button>
														</div>
													</div>
												</div>
											)}

											{/* Video Form */}
											{(videoFormOpen || editingVideo) && effectiveMandalId && (
												<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
													<div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-rose-50 dark:bg-rose-900/20">
														<h5 className="font-bold text-sm text-rose-700 dark:text-rose-400">
															{editingVideo ? "✏️ Edit Video" : "➕ New Video"}
														</h5>
													</div>
													<div className="p-4 space-y-3">
														<div>
															<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
																Video Title
															</label>
															<input
																type="text"
																className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400"
																placeholder="e.g., Bhajan Sandhya 2024"
																value={videoForm.title}
																onChange={(e) =>
																	setVideoForm({
																		...videoForm,
																		title: e.target.value,
																	})
																}
															/>
														</div>
														<div>
															<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider flex items-center gap-1 mb-1.5">
																<Link size={10} /> Video URL
															</label>
															<div className="flex gap-2">
																<input
																	type="url"
																	className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400 font-mono"
																	placeholder="YouTube, MP4, Drive link..."
																	value={videoForm.url}
																	onChange={(e) =>
																		setVideoForm({
																			...videoForm,
																			url: normalizeB2Url(e.target.value),
																		})
																	}
																/>
																<input
																	type="file"
																	ref={videoInputRef}
																	onChange={handleVideoUpload}
																	accept="video/mp4,video/mkv,video/avi"
																	className="hidden"
																/>
																<button
																	onClick={() => videoInputRef.current?.click()}
																	disabled={uploadingVideo}
																	className="bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all text-sm"
																>
																	{uploadingVideo ? (
																		<Loader2
																			size={16}
																			className="animate-spin"
																		/>
																	) : (
																		<Upload size={16} />
																	)}
																	{uploadingVideo
																		? `${uploadVideoProgress}%`
																		: "Upload File"}
																</button>
															</div>
															{uploadingVideo && (
																<div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
																	<div
																		className="bg-rose-500 h-full rounded-full transition-all duration-300"
																		style={{ width: `${uploadVideoProgress}%` }}
																	/>
																</div>
															)}
														</div>
														<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
															<div>
																<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
																	Date
																</label>
																<input
																	type="date"
																	className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400"
																	value={
																		formatForDateInput(videoForm.date) || ""
																	}
																	onChange={(e) =>
																		setVideoForm({
																			...videoForm,
																			date: e.target.value,
																		})
																	}
																/>
															</div>
															<div>
																<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
																	<span>Thumbnail URL</span>
																	{videoForm.url?.includes("archive.org") && (
																		<button
																			onClick={() =>
																				setShowAllThumbsFor(
																					editingVideo
																						? editingVideo.id
																						: "new",
																				)
																			}
																			className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer"
																		>
																			<Grid size={10} /> See All Thumbs
																		</button>
																	)}
																</label>
																<div className="flex flex-col gap-2">
																	<input
																		type="url"
																		className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400 font-mono"
																		placeholder="https://..."
																		value={videoForm.thumbnailUrl}
																		onChange={(e) =>
																			setVideoForm({
																				...videoForm,
																				thumbnailUrl: e.target.value,
																			})
																		}
																	/>
																	<div className="flex items-center justify-between mt-1 mb-1">
																		<label className="flex items-center gap-2 cursor-pointer">
																			<input
																				type="checkbox"
																				checked={videoForm.useDefaultThumbnail}
																				onChange={(e) =>
																					setVideoForm({
																						...videoForm,
																						useDefaultThumbnail:
																							e.target.checked,
																					})
																				}
																				className="rounded text-rose-500 focus:ring-rose-500 border-slate-300 dark:border-slate-600"
																			/>
																			<span className="text-[10px] font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider">
																				Use original without crop
																			</span>
																		</label>
																	</div>
																	{!videoForm.useDefaultThumbnail && (
																		<div className="flex flex-row gap-2 sm:gap-4 items-center justify-between sm:justify-around bg-slate-50 dark:bg-slate-900 p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-700">
																			<div className="flex flex-col items-center gap-1 shrink-0">
																				<button
																					onClick={() =>
																						setVideoForm((p) => ({
																							...p,
																							thumbnailYOffset: Math.max(
																								0,
																								(p.thumbnailYOffset ?? 50) - 5,
																							),
																						}))
																					}
																					className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
																				>
																					<ChevronUp size={18} />
																				</button>
																				<div className="flex gap-1 items-center">
																					<button
																						onClick={() =>
																							setVideoForm((p) => ({
																								...p,
																								thumbnailXOffset: Math.max(
																									0,
																									(p.thumbnailXOffset ?? 50) -
																										5,
																								),
																							}))
																						}
																						className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
																					>
																						<ChevronLeft size={18} />
																					</button>
																					<div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center shadow-inner">
																						<div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm"></div>
																					</div>
																					<button
																						onClick={() =>
																							setVideoForm((p) => ({
																								...p,
																								thumbnailXOffset: Math.min(
																									100,
																									(p.thumbnailXOffset ?? 50) +
																										5,
																								),
																							}))
																						}
																						className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
																					>
																						<ChevronRight size={18} />
																					</button>
																				</div>
																				<button
																					onClick={() =>
																						setVideoForm((p) => ({
																							...p,
																							thumbnailYOffset: Math.min(
																								100,
																								(p.thumbnailYOffset ?? 50) + 5,
																							),
																						}))
																					}
																					className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
																				>
																					<ChevronDown size={18} />
																				</button>
																			</div>
																			<div className="flex-1 flex justify-center items-center">
																				<div className="w-full max-w-[140px] aspect-[4/3] rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600 shadow-sm relative">
																					{videoForm.thumbnailUrl ? (
																						<CachedImage
																							src={videoForm.thumbnailUrl}
																							alt="Preview"
																							className="absolute inset-0 w-full h-full object-cover"
																							style={{
																								objectPosition: `${videoForm.thumbnailXOffset ?? 50}% ${videoForm.thumbnailYOffset ?? 50}%`,
																							}}
																						/>
																					) : (
																						<span className="text-[10px] text-slate-400 dark:text-ink-400 text-center px-2">
																							No Image
																						</span>
																					)}
																				</div>
																			</div>
																		</div>
																	)}
																</div>
															</div>
														</div>
														<div className="flex gap-3 pt-1">
															<button
																onClick={() => {
																	setEditingVideo(null);
																	closeVideoForm();
																}}
																className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
															>
																Cancel
															</button>
															<button
																onClick={handleSaveVideo}
																disabled={savingVideo}
																className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
															>
																{savingVideo ? (
																	<Loader2 size={16} className="animate-spin" />
																) : (
																	<Save size={16} />
																)}
																{editingVideo ? "Update Video" : "Save Video"}
															</button>
														</div>
													</div>
												</div>
											)}

											{/* Videos List */}
											{(effectiveMandalId || `github-${selectedRelease.id}`) &&
												!loadingVideos &&
												mandalVideos.length === 0 &&
												!videoFormOpen &&
												!editingVideo && (
													<div className="h-40 flex flex-col items-center justify-center text-slate-400 dark:text-ink-400">
														<Video size={36} className="mb-2 opacity-40" />
														<p className="text-sm font-medium">
															No videos added yet
														</p>
													</div>
												)}
											{loadingVideos && (
												<div className="flex justify-center py-8">
													<Loader2
														size={24}
														className="animate-spin text-rose-400"
													/>
												</div>
											)}
											{(effectiveMandalId || `github-${selectedRelease.id}`) &&
												!loadingVideos &&
												mandalVideos.length > 0 && (
													<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
														<div className="p-3 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
															<p className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider">
																{mandalVideos.length} Video
																{mandalVideos.length !== 1 ? "s" : ""}
															</p>
															<div className="flex flex-wrap items-center gap-2">
																<button
																	onClick={handleFixVideoOrdering}
																	disabled={fixingOrder}
																	className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg transition-colors active:scale-95 disabled:opacity-50"
																>
																	{fixingOrder ? (
																		<Loader2
																			size={12}
																			className="animate-spin"
																		/>
																	) : (
																		<ListOrdered size={12} />
																	)}{" "}
																	Fix Order
																</button>
																<button
																	onClick={handleFixThumbnails}
																	disabled={fixingThumbnails}
																	className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg transition-colors active:scale-95 disabled:opacity-50"
																>
																	{fixingThumbnails ? (
																		<Loader2
																			size={12}
																			className="animate-spin"
																		/>
																	) : (
																		<RefreshCw size={12} />
																	)}{" "}
																	Fix Thumbs
																</button>
																<button
																	onClick={handleBulkRename}
																	className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg transition-colors active:scale-95 flex"
																>
																	<Edit2 size={12} /> Rename All
																</button>
																<button
																	onClick={handleBulkDelete}
																	className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-colors active:scale-95 flex"
																>
																	<Trash2 size={12} /> Delete All
																</button>
															</div>
														</div>
														<div className="divide-y divide-slate-100 dark:divide-slate-700">
															{[...mandalVideos]
																.sort((a, b) => a.order - b.order)
																.map((video) => (
																	<div
																		key={video.id}
																		className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
																	>
																		<div className="w-16 h-12 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
																			{video.thumbnailUrl ? (
																				<CachedImage
																					src={video.thumbnailUrl}
																					alt="thumb"
																					className="w-full h-full object-cover"
																					style={
																						!video.useDefaultThumbnail
																							? {
																									objectPosition: `${video.thumbnailXOffset ?? 50}% ${video.thumbnailYOffset ?? 50}%`,
																								}
																							: {}
																					}
																				/>
																			) : (
																				<Video
																					size={18}
																					className="text-slate-400 dark:text-ink-400"
																				/>
																			)}
																		</div>
																		<div className="flex-1 min-w-0">
																			<p className="text-sm font-bold text-slate-800 dark:text-white truncate">
																				<span className="text-slate-400 dark:text-ink-400 mr-1.5">
																					#{video.order}
																				</span>
																				{video.title}
																			</p>
																			<p className="text-xs text-slate-400 dark:text-ink-400">
																				{video.date || "No Date"}
																			</p>
																		</div>
																		<button
																			onClick={() => {
																				setEditingVideo(video);
																				setVideoForm({
																					title: video.title,
																					url: video.url,
																					date: video.date,
																					thumbnailUrl:
																						video.thumbnailUrl || "",
																					thumbnailXOffset:
																						video.thumbnailXOffset ?? 50,
																					thumbnailYOffset:
																						video.thumbnailYOffset ?? 50,
																					useDefaultThumbnail:
																						video.useDefaultThumbnail ?? false,
																				});
																				setVideoFormOpen(true);
																			}}
																			className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 rounded-xl active:scale-90 shrink-0"
																		>
																			<Edit2 size={15} />
																		</button>
																		<button
																			onClick={() => handleDeleteVideo(video)}
																			disabled={deletingVideoId === video.id}
																			className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl active:scale-90 shrink-0 disabled:opacity-50"
																		>
																			{deletingVideoId === video.id ? (
																				<Loader2
																					size={15}
																					className="animate-spin"
																				/>
																			) : (
																				<Trash2 size={15} />
																			)}
																		</button>
																	</div>
																))}
														</div>
													</div>
												)}
										</div>
									)}

									{/* ══════════ WEEKLY PROGRAM TAB ══════════ */}
									{activeTab === "weekly" && (
										<div className="space-y-4">
											{loadingWeekly ? (
												<div className="flex justify-center py-8">
													<Loader2
														size={24}
														className="animate-spin text-indigo-500"
													/>
												</div>
											) : (
												<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
													<div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
														<div>
															<h4 className="font-bold text-sm text-indigo-700 dark:text-indigo-300">
																📅 Weekly Program
															</h4>
															<p className="text-xs text-slate-400 dark:text-ink-400 capitalize mt-0.5">
																{effectiveMandalId} Mandal
															</p>
														</div>
														<label className="flex items-center gap-2 cursor-pointer">
															<span className="text-xs font-bold text-slate-500 dark:text-ink-300">
																{weeklyProgram.enabled ? "Active" : "Hidden"}
															</span>
															<div
																className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${weeklyProgram.enabled ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`}
															>
																<div
																	className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${weeklyProgram.enabled ? "translate-x-5" : "translate-x-0.5"}`}
																/>
															</div>
															<input
																type="checkbox"
																className="sr-only"
																checked={weeklyProgram.enabled}
																onChange={(e) =>
																	setWeeklyProgram({
																		...weeklyProgram,
																		enabled: e.target.checked,
																	})
																}
															/>
														</label>
													</div>
													<div className="p-4 space-y-3">
														<div>
															<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
																Program Title
															</label>
															<input
																className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
																placeholder="e.g., Sunday Special Kirtan"
																value={weeklyProgram.title}
																onChange={(e) =>
																	setWeeklyProgram({
																		...weeklyProgram,
																		title: e.target.value,
																	})
																}
															/>
														</div>
														<div>
															<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
																Display Date & Time
															</label>
															<input
																className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
																placeholder="e.g., Sunday, 5:00 PM"
																value={weeklyProgram.date}
																onChange={(e) =>
																	setWeeklyProgram({
																		...weeklyProgram,
																		date: e.target.value,
																	})
																}
															/>
														</div>
														<div>
															<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-1.5">
																Description
															</label>
															<textarea
																className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white h-24 resize-none outline-none focus:ring-2 focus:ring-blue-500"
																placeholder="Details about the program..."
																value={weeklyProgram.description}
																onChange={(e) =>
																	setWeeklyProgram({
																		...weeklyProgram,
																		description: e.target.value,
																	})
																}
															/>
														</div>
														<div>
															<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider flex items-center gap-1 mb-1.5">
																<MapPin size={11} /> Google Maps Link
															</label>
															<input
																className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
																placeholder="https://maps.google.com/..."
																value={weeklyProgram.locationUrl}
																onChange={(e) =>
																	setWeeklyProgram({
																		...weeklyProgram,
																		locationUrl: e.target.value,
																	})
																}
															/>
														</div>
														<button
															onClick={handleSaveWeekly}
															disabled={savingWeekly}
															className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
														>
															{savingWeekly ? (
																<Loader2 className="animate-spin" size={18} />
															) : (
																<Save size={18} />
															)}
															Save Weekly Program
														</button>
													</div>
												</div>
											)}
										</div>
									)}
								</div>
							</>
						) : (
							<div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-ink-400 p-8 text-center">
								<Folder
									size={64}
									className="mb-4 text-slate-300 dark:text-slate-700"
								/>
								<h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">
									Select a Folder
								</h3>
								<p className="text-sm max-w-xs mt-2">
									Choose a folder from the sidebar to manage its photos
									{viewType === "activity"
										? ", videos & weekly program"
										: " & videos"}
									.
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Delete Confirmation Modal */}
				{deleteConfirmation && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
						<div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95">
							<h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">
								Confirm Deletion
							</h3>
							<p className="text-slate-600 dark:text-slate-300 mb-6">
								Are you sure you want to delete{" "}
								<span className="font-semibold text-slate-900 dark:text-white">
									"{formatFolderName(deleteConfirmation.name)}"
								</span>
								?
								{deleteConfirmation.type === "folder" &&
									" This will delete all photos inside it."}
								<br />
								This action cannot be undone.
							</p>
							<div className="flex gap-3">
								<button
									onClick={() => setDeleteConfirmation(null)}
									className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium"
								>
									Cancel
								</button>
								<button
									onClick={confirmDelete}
									className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				)}

				{/* See All Thumbs Modal */}
				{showAllThumbsFor && (
					<div
						className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
						onClick={() => closeAllThumbs()}
					>
						<div
							className="bg-slate-900 rounded-3xl p-6 w-full max-w-4xl shadow-2xl flex flex-col h-[80vh]"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700">
								<div className="flex items-center gap-3">
									<button
										onClick={() => closeAllThumbs()}
										className="p-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl active:scale-95 transition-all"
									>
										<ArrowLeft size={20} />
									</button>
									<h3 className="text-xl font-bold text-white flex items-center gap-2">
										<Grid className="text-blue-400" /> Available Thumbnails
									</h3>
								</div>
								<button
									onClick={() => closeAllThumbs()}
									className="p-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl active:scale-95 transition-all"
								>
									<X size={20} />
								</button>
							</div>

							<div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
								{fetchingThumbsFor ? (
									<div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-ink-400 space-y-4">
										<Loader2 size={40} className="animate-spin text-blue-500" />
										<p>Fetching thumbnails from Archive.org...</p>
									</div>
								) : (
									<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
										{getAvailableThumbs(showAllThumbsFor, videoForm.url).map(
											(thumbUrl, idx) => (
												<div
													key={idx}
													onClick={() => {
														setVideoForm((p) => ({
															...p,
															thumbnailUrl: thumbUrl,
															thumbnailXOffset: 50,
															thumbnailYOffset: 50,
															useDefaultThumbnail: false,
														}));
														closeAllThumbs();
													}}
													className={`relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-[1.02] ${videoForm.thumbnailUrl === thumbUrl ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "border-slate-700 hover:border-slate-500"}`}
												>
													<CachedImage
														src={thumbUrl}
														alt="thumb"
														className="w-full h-full object-cover"
													/>
													{videoForm.thumbnailUrl === thumbUrl && (
														<div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
															<Check size={14} className="text-white" />
														</div>
													)}
												</div>
											),
										)}
										{getAvailableThumbs(showAllThumbsFor, videoForm.url)
											.length === 0 && (
											<div className="col-span-full h-40 flex flex-col items-center justify-center text-slate-500 dark:text-ink-300">
												<AlertCircle size={30} className="mb-2 opacity-50" />
												<p>No extra thumbnails found in this archive.</p>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Bulk Rename Modal */}
				{showBulkRename && (
					<div
						className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
						onClick={() => closeBulkRename()}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30">
								<Edit2 size={24} className="text-blue-500" />
							</div>
							<h3 className="text-lg font-bold text-slate-800 dark:text-white text-center mb-2">
								Bulk Rename Videos
							</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-4">
								Enter a base name for the {mandalVideos.length} videos. Leave
								blank to just number them 1, 2, 3...
							</p>

							<input
								type="text"
								className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400 mb-6 text-center placeholder-slate-400"
								placeholder='e.g., "Gaur Purnima"'
								value={bulkRenameBaseName}
								onChange={(e) => setBulkRenameBaseName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") confirmBulkRename();
									if (e.key === "Escape") closeBulkRename();
								}}
							/>

							<div className="flex gap-3">
								<button
									onClick={() => closeBulkRename()}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
								>
									Cancel
								</button>
								<button
									onClick={confirmBulkRename}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-white active:scale-95 transition-all shadow-sm bg-blue-500 hover:bg-blue-600"
								>
									Continue
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Confirm Dialog (for videos) */}
				{confirmDialog && (
					<div
						className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
						onClick={() => closeConfirmDialog()}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
							onClick={(e) => e.stopPropagation()}
						>
							<div
								className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${confirmDialog.isDestructive !== false ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}
							>
								{confirmDialog.isDestructive !== false ? (
									<Trash2 size={24} className="text-red-500" />
								) : (
									<AlertCircle size={24} className="text-blue-500" />
								)}
							</div>
							<h3 className="text-lg font-bold text-slate-800 dark:text-white text-center mb-2">
								{confirmDialog.title || "Confirm Delete"}
							</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
								{confirmDialog.message}
							</p>
							<div className="flex gap-3">
								<button
									onClick={() => closeConfirmDialog()}
									className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 active:scale-95 transition-transform"
								>
									Cancel
								</button>
								<button
									onClick={() => {
										confirmDialog.onConfirm();
										closeConfirmDialog();
									}}
									className={`flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-white active:scale-95 transition-all shadow-sm ${confirmDialog.isDestructive !== false ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}`}
								>
									{confirmDialog.confirmText || "Delete"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Toast Notification */}
				{toastMessage && (
					<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] animate-in slide-in-from-bottom-4 duration-200 pointer-events-none">
						<div
							className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[200px] ${toastMessage.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
						>
							{toastMessage.type === "success" ? (
								<Check size={18} />
							) : (
								<X size={18} />
							)}
							<span className="font-bold text-sm">{toastMessage.text}</span>
						</div>
					</div>
				)}
			</div>

			{/* ── Upload Blocker: locks screen during B2 video uploads ── */}
			<UploadBlockerModal
				isVisible={uploadingVideo}
				progress={uploadVideoProgress}
				fileName={uploadingFileName}
				onCancel={handleCancelUpload}
				isHindi={settingsLanguage === "hi"}
			/>
		</>
	);
};

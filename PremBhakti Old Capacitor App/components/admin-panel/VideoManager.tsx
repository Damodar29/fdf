import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
	AlertTriangle,
	Calendar,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Copy,
	Edit2,
	FileText,
	Folder,
	Grid,
	Image as ImageIcon,
	Link,
	ListOrdered,
	Loader2,
	PlayCircle,
	Plus,
	Save,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { APP_BASE_URL } from "../../constants";
import { db, functions } from "../../services/firebase";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import {
	normalizeB2Url,
	softDeleteFromB2,
	uploadFileToB2,
} from "../../src/utils/b2Uploader";
import { UploadBlockerModal } from "../../src/components/admin-panel/UploadBlockerModal";
import {
	formatDisplayDate,
	formatForDateInput,
} from "../../utils/dateFormatter";
import { uploadFileViaWorker } from "../../utils/uploadManager";
import type { VideoData } from "../VideosScreen";

const REPO_OWNER = "chaitanyaprembhakti";
const REPO_NAME = "CPBS-DAILY";

export interface VideoFolderData {
	id: string;
	name: string;
	thumbnailUrl?: string;
	thumbnailXOffset?: number;
	thumbnailYOffset?: number;
	useDefaultThumbnail?: boolean;
	order: number;
	createdAt?: any;
	updatedAt?: any;
}

export interface BulkUploadTask {
	id: string;
	name: string;
	progress: number;
	status: "pending" | "uploading" | "completed" | "error";
	error?: string;
}

export const VideoManager: React.FC<{
	showToast: (msg: string, type: "success" | "error") => void;
	settingsLanguage?: "en" | "hi";
}> = ({ showToast, settingsLanguage = "hi" }) => {
	const isHindi = settingsLanguage === "hi";
	const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

	const [videos, setVideos] = useState<VideoData[]>([]);
	const [folders, setFolders] = useState<VideoFolderData[]>([]);
	const [loading, setLoading] = useState(true);

	// GitHub Token for uploads
	const [githubToken, setGithubToken] = useState<string | null>(null);
	const [uploadingImage, setUploadingImage] = useState(false);

	// Editing States
	const [isEditingVideo, setIsEditingVideo] = useState(false);
	const [editingVideo, setEditingVideo] = useState<Partial<VideoData>>({});

	const [isEditingFolder, setIsEditingFolder] = useState(false);
	const [editingFolder, setEditingFolder] = useState<Partial<VideoFolderData>>(
		{},
	);

	const [saving, setSaving] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<{
		type: "video" | "folder";
		id: string;
		label: string;
	} | null>(null);
	const [deleting, setDeleting] = useState(false);

	// Archive.org import states
	const [showArchiveImport, setShowArchiveImport] = useState(false);
	const [archiveUrl, setArchiveUrl] = useState("");
	const [importingArchive, setImportingArchive] = useState(false);

	// Delete All state
	const [showDeleteAll, setShowDeleteAll] = useState(false);
	const [deletingAll, setDeletingAll] = useState(false);

	// Rename All state
	const [showRenameAll, setShowRenameAll] = useState(false);
	const [renamePrefix, setRenamePrefix] = useState("");
	const [renamingAll, setRenamingAll] = useState(false);

	const [fixingThumbnails, setFixingThumbnails] = useState(false);
	const [fixingOrder, setFixingOrder] = useState(false);
	const [cyclingThumbsAll, setCyclingThumbsAll] = useState(false);
	const [_cyclingThumbId, _setCyclingThumbId] = useState<string | null>(null);

	const [archiveDataCache, setArchiveDataCache] = useState<Record<string, any>>(
		{},
	);
	const [showBatchConfirm, setShowBatchConfirm] = useState(false);
	const [batchThumbMode, setBatchThumbMode] = useState(false);
	const [batchThumbPreview, setBatchThumbPreview] = useState<Record<
		string,
		string
	> | null>(null);

	const [fetchingThumbsFor, setFetchingThumbsFor] = useState<
		"editingFolder" | "editingVideo" | "batch" | null
	>(null);
	const [uploadingVideo, setUploadingVideo] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [uploadingFileName, setUploadingFileName] = useState("");
	const [bulkUploadTasks, setBulkUploadTasks] = useState<BulkUploadTask[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const videoInputRef = useRef<HTMLInputElement>(null);
	const bulkVideoInputRef = useRef<HTMLInputElement>(null);
	// AbortController for cancelling in-flight B2 video uploads
	const uploadAbortControllerRef = useRef<AbortController | null>(null);
	// Tracks the Firestore video ID currently being uploaded (for cleanup on cancel)
	const uploadingVideoIdRef = useRef<string | null>(null);
	const [showAllThumbsFor, setShowAllThumbsFor] = useState<
		"editingVideo" | "editingFolder" | null
	>(null);
	const [allAvailableThumbs, setAllAvailableThumbs] = useState<string[]>([]);
	const [loadingAllThumbs, setLoadingAllThumbs] = useState(false);

	// ── BACK BUTTON SUPPORT FOR POPUPS ──
	const closeEditingVideo = usePopupBackHandler(
		isEditingVideo,
		"video-mgr-edit-video",
		() => setIsEditingVideo(false),
	);
	const closeEditingFolder = usePopupBackHandler(
		isEditingFolder,
		"video-mgr-edit-folder",
		() => setIsEditingFolder(false),
	);
	const closePendingDelete = usePopupBackHandler(
		!!pendingDelete,
		"video-mgr-delete",
		() => setPendingDelete(null),
	);
	const closeArchiveImport = usePopupBackHandler(
		showArchiveImport,
		"video-mgr-archive",
		() => setShowArchiveImport(false),
	);
	const closeDeleteAll = usePopupBackHandler(
		showDeleteAll,
		"video-mgr-delete-all",
		() => setShowDeleteAll(false),
	);
	const closeRenameAll = usePopupBackHandler(
		showRenameAll,
		"video-mgr-rename-all",
		() => setShowRenameAll(false),
	);
	const closeAllThumbsFor = usePopupBackHandler(
		!!showAllThumbsFor,
		"video-mgr-thumbs",
		() => setShowAllThumbsFor(null),
	);
	const closeBatchConfirm = usePopupBackHandler(
		showBatchConfirm,
		"video-mgr-batch-confirm",
		() => setShowBatchConfirm(false),
	);
	const closeBatchThumbMode = usePopupBackHandler(
		batchThumbMode,
		"video-mgr-batch-thumb-mode",
		() => setBatchThumbMode(false),
	);
	const closeSelectedFolder = usePopupBackHandler(
		!!selectedFolderId,
		"video-mgr-selected-folder",
		() => setSelectedFolderId(null),
	);

	useEffect(() => {
		// Fetch GitHub token
		const fetchToken = async () => {
			const tokenDoc = await getDoc(doc(db, "damtoken", "github"));
			if (tokenDoc.exists()) {
				setGithubToken(tokenDoc.data()?.token?.trim() || "");
			}
		};
		fetchToken();

		// Fetch Videos
		const qVideos = query(collection(db, "videos"), orderBy("order", "asc"));
		const unsubVideos = onSnapshot(qVideos, (snapshot) => {
			const fetched: VideoData[] = [];
			snapshot.forEach((doc) =>
				fetched.push({ id: doc.id, ...doc.data() } as VideoData),
			);
			setVideos(fetched);
			setLoading(false);
		});

		// Fetch Folders
		const qFolders = query(
			collection(db, "video_folders"),
			orderBy("order", "asc"),
		);
		const unsubFolders = onSnapshot(qFolders, (snapshot) => {
			const fetched: VideoFolderData[] = [];
			snapshot.forEach((doc) =>
				fetched.push({ id: doc.id, ...doc.data() } as VideoFolderData),
			);
			setFolders(fetched);
		});

		return () => {
			unsubVideos();
			unsubFolders();
		};
	}, []);

	const uploadFileToGitHub = async (file: File): Promise<string | null> => {
		if (!githubToken) {
			showToast("GitHub token not configured. Cannot upload.", "error");
			return null;
		}
		try {
			setUploadingImage(true);
			const releaseResponse = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/notification-photostorage`,
				{
					headers: {
						Authorization: `token ${githubToken}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);
			if (!releaseResponse.ok) throw new Error("Release not found");
			const releaseData = await releaseResponse.json();
			const releaseId = releaseData.id;

			const ext = file.name.split(".").pop() || "jpg";
			const baseFileName = `${Date.now()}_${file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9.]/g, "_")}`;
			let fileName = `${baseFileName}.${ext}`;

			// Direct upload via Cloudflare Worker proxy with retry
			let url = "";
			let success = false;
			let retryCounter = 1;

			while (!success) {
				try {
					url = await uploadFileViaWorker(
						file,
						releaseId,
						githubToken,
						fileName,
						{
							totalFiles: 1,
							currentIndex: 1,
						},
					);
					success = true;
				} catch (err: any) {
					if (err.message?.includes("already_exists")) {
						fileName = `${baseFileName}-${retryCounter}.${ext}`;
						retryCounter++;
					} else {
						throw err;
					}
				}
			}

			showToast("Image uploaded successfully!", "success");
			return url;
		} catch (err: any) {
			showToast(`Upload failed: ${err.message}`, "error");
			return null;
		} finally {
			setUploadingImage(false);
		}
	};

	const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Generate a document ID if editingVideo doesn't have one yet
		let currentVideoId = editingVideo.id;
		if (!currentVideoId) {
			try {
				const docRef = await addDoc(collection(db, "videos"), {
					title: editingVideo.title?.trim() || file.name,
					folderId: editingVideo.folderId,
					url: "Processing...",
					useDefaultThumbnail: editingVideo.useDefaultThumbnail ?? false,
					order: Number(editingVideo.order) || 0,
					createdAt: serverTimestamp(),
				});
				currentVideoId = docRef.id;
				setEditingVideo((prev) => ({
					...prev,
					id: currentVideoId,
					url: "Processing...",
				}));
			} catch (err: any) {
				showToast(`Failed to initialize video record: ${err.message}`, "error");
				return;
			}
		} else {
			setEditingVideo((prev) => ({ ...prev, url: "Processing..." }));
		}

		// Create abort controller for this upload so cancel button can stop it
		const controller = new AbortController();
		uploadAbortControllerRef.current = controller;
		uploadingVideoIdRef.current = currentVideoId ?? null;

		setUploadingVideo(true);
		setUploadProgress(0);
		setUploadingFileName(file.name);

		const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
		const _targetFileName = `${Date.now()}_${safeFileName}`;

		try {
			const folderName =
				folders.find(
					(f) => f.id === (editingVideo.folderId || selectedFolderId),
				)?.name || "Uncategorized";
			const folderPath = `Uploaded from app/VideoManager Uploads/${folderName}/`;

			const dlUrl = await uploadFileToB2(
				file,
				(progress) => {
					setUploadProgress(progress);
				},
				folderPath,
				controller.signal,
			);
			await updateDoc(doc(db, "videos", currentVideoId!), { url: dlUrl });
			showToast("Video uploaded successfully to B2!", "success");
			setUploadingVideo(false);
			setUploadingFileName("");
			setEditingVideo((prev) => ({ ...prev, url: dlUrl }));
		} catch (error: any) {
			// Distinguish user-initiated cancel from actual error
			if (error?.name !== "AbortError") {
				showToast(`Video upload failed: ${error.message}`, "error");
			}
			setUploadingVideo(false);
			setUploadingFileName("");
			setEditingVideo((prev) => ({ ...prev, url: "" }));
		}

		uploadAbortControllerRef.current = null;
		uploadingVideoIdRef.current = null;
		if (videoInputRef.current) videoInputRef.current.value = "";
	};

	const handleBulkVideoUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(e.target.files || []);
		if (files.length === 0) return;

		if (!selectedFolderId) {
			showToast("Please select a folder first", "error");
			return;
		}

		const queue: {
			task: BulkUploadTask;
			file: File;
			targetFileName: string;
		}[] = [];
		const newTasks: BulkUploadTask[] = [];

		for (const file of files) {
			const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
			const targetFileName = `${Date.now()}_${safeFileName}`;

			try {
				const docRef = await addDoc(collection(db, "videos"), {
					title: file.name.replace(/\.[^/.]+$/, ""), // title without extension
					folderId: selectedFolderId,
					url: "Processing...",
					useDefaultThumbnail: true,
					order:
						videos.filter((v) => v.folderId === selectedFolderId).length +
						newTasks.length +
						1,
					createdAt: serverTimestamp(),
				});

				const task: BulkUploadTask = {
					id: docRef.id,
					name: file.name,
					progress: 0,
					status: "pending",
				};
				newTasks.push(task);
				queue.push({ task, file, targetFileName });
			} catch (err: any) {
				showToast(`Failed to initialize ${file.name}: ${err.message}`, "error");
			}
		}

		if (newTasks.length === 0) return;

		// Create a shared abort controller for the whole bulk session
		const controller = new AbortController();
		uploadAbortControllerRef.current = controller;

		setBulkUploadTasks((prev) => [...prev, ...newTasks]);
		setUploadingVideo(true);
		setUploadProgress(0);

		for (const item of queue) {
			// Stop processing remaining files if user cancelled
			if (controller.signal.aborted) break;

			setUploadingFileName(item.file.name);
			uploadingVideoIdRef.current = item.task.id;
			setBulkUploadTasks((prev) =>
				prev.map((t) =>
					t.id === item.task.id ? { ...t, status: "uploading" } : t,
				),
			);

			try {
				const folderName =
					folders.find((f) => f.id === selectedFolderId)?.name ||
					"Uncategorized";
				const folderPath = `Uploaded from app/VideoManager Uploads/${folderName}/`;

				const dlUrl = await uploadFileToB2(
					item.file,
					(progress) => {
						setUploadProgress(progress);
						setBulkUploadTasks((prev) =>
							prev.map((t) => (t.id === item.task.id ? { ...t, progress } : t)),
						);
					},
					folderPath,
					controller.signal,
				);
				await updateDoc(doc(db, "videos", item.task.id), { url: dlUrl });
				setBulkUploadTasks((prev) =>
					prev.map((t) =>
						t.id === item.task.id
							? { ...t, status: "completed", progress: 100 }
							: t,
					),
				);
			} catch (error: any) {
				if (error?.name === "AbortError") break; // user cancelled — stop loop
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
	 * Aborts the in-flight XHR and resets the Firestore placeholder URL to ""
	 * (Option B: keep the record so admin can retry without re-entering metadata).
	 */
	const handleCancelUpload = async () => {
		// Abort in-flight XHR
		uploadAbortControllerRef.current?.abort();
		setUploadingVideo(false);
		setUploadProgress(0);
		setUploadingFileName("");

		// Reset the Firestore placeholder URL for the file currently uploading,
		// plus any other bulk-queued files that never got a chance to start —
		// otherwise those stay as "Processing..." forever.
		const videoId = uploadingVideoIdRef.current;
		const cleanupIds = new Set<string>();
		if (videoId) cleanupIds.add(videoId);
		for (const t of bulkUploadTasks) {
			if (t.status === "pending" || t.status === "uploading") {
				cleanupIds.add(t.id);
			}
		}
		await Promise.allSettled(
			Array.from(cleanupIds).map((id) =>
				updateDoc(doc(db, "videos", id), { url: "" }),
			),
		);
		uploadingVideoIdRef.current = null;
	};

	const handleImageUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
		isFolder: boolean,
	) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			showToast("Please select an image file", "error");
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			showToast("File size must be less than 5MB", "error");
			return;
		}
		const url = await uploadFileToGitHub(file);
		if (url) {
			if (isFolder) {
				setEditingFolder((prev) => ({
					...prev,
					thumbnailUrl: url,
					useDefaultThumbnail: false,
				}));
			} else {
				setEditingVideo((prev) => ({
					...prev,
					thumbnailUrl: url,
					useDefaultThumbnail: false,
				}));
			}
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleSaveFolder = async () => {
		if (!editingFolder.name?.trim()) {
			showToast("Folder name is required.", "error");
			return;
		}
		setSaving(true);
		try {
			const dataToSave = {
				name: editingFolder.name.trim(),
				thumbnailUrl: editingFolder.useDefaultThumbnail
					? ""
					: editingFolder.thumbnailUrl?.trim() || "",
				useDefaultThumbnail: editingFolder.useDefaultThumbnail || false,
				thumbnailXOffset: editingFolder.thumbnailXOffset ?? 50,
				thumbnailYOffset: editingFolder.thumbnailYOffset ?? 50,
				order: Number(editingFolder.order) || 0,
			};
			if (editingFolder.id) {
				await updateDoc(doc(db, "video_folders", editingFolder.id), {
					...dataToSave,
					updatedAt: serverTimestamp(),
				});
				showToast("Folder updated successfully!", "success");
			} else {
				await addDoc(collection(db, "video_folders"), {
					...dataToSave,
					createdAt: serverTimestamp(),
				});
				showToast("Folder added successfully!", "success");
			}
			closeEditingFolder();
			setEditingFolder({});
		} catch (error: any) {
			console.error("Save folder error:", error);
			showToast(`Failed to save folder: ${error?.message || error}`, "error");
		}
		setSaving(false);
	};

	const handleSaveVideo = async () => {
		if (
			!editingVideo.title?.trim() ||
			!editingVideo.url?.trim() ||
			!editingVideo.folderId
		) {
			showToast("Title, URL, and Folder are required.", "error");
			return;
		}
		setSaving(true);
		try {
			const dataToSave: any = {
				title: editingVideo.title.trim(),
				folderId: editingVideo.folderId,
				thumbnailUrl: editingVideo.useDefaultThumbnail
					? ""
					: editingVideo.thumbnailUrl?.trim() || "",
				useDefaultThumbnail: editingVideo.useDefaultThumbnail || false,
				thumbnailXOffset: (editingVideo as any).thumbnailXOffset ?? 50,
				thumbnailYOffset: (editingVideo as any).thumbnailYOffset ?? 50,
				date: editingVideo.date?.trim() || "",
				description: editingVideo.description?.trim() || "",
				order: Number(editingVideo.order) || 0,
				hdUrl: (editingVideo as any).hdUrl?.trim() || "",
			};

			if (editingVideo.url !== "Processing...") {
				dataToSave.url = editingVideo.url.trim();
			}

			if (editingVideo.id) {
				await setDoc(
					doc(db, "videos", editingVideo.id),
					{ ...dataToSave, updatedAt: serverTimestamp() },
					{ merge: true },
				);
				showToast("Video updated successfully!", "success");
			} else {
				await addDoc(collection(db, "videos"), {
					...dataToSave,
					url: editingVideo.url.trim(),
					createdAt: serverTimestamp(),
				});
				showToast("Video added successfully!", "success");
			}
			closeEditingVideo();
			setEditingVideo({});
		} catch (_error) {
			showToast("Failed to save video.", "error");
		}
		setSaving(false);
	};

	const handleDeleteFolder = (id: string) => {
		const videosInFolder = videos.filter((v) => v.folderId === id);
		if (videosInFolder.length > 0) {
			showToast(
				`Cannot delete: ${videosInFolder.length} video(s) are in this folder.`,
				"error",
			);
			return;
		}
		const folder = folders.find((f) => f.id === id);
		setPendingDelete({
			type: "folder",
			id,
			label: folder?.name || "this folder",
		});
	};

	const handleDeleteVideo = (id: string) => {
		const video = videos.find((v) => v.id === id);
		setPendingDelete({
			type: "video",
			id,
			label: video?.title || "this video",
		});
	};

	const handleArchiveImport = async () => {
		if (!selectedFolderId) {
			showToast("No folder selected.", "error");
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

			if (!identifier)
				throw new Error("Could not extract identifier from URL.");

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

			if (videoFiles.length === 0)
				throw new Error("No video files found in this archive item.");

			const baseUrl =
				data.server && data.dir
					? `https://${data.server}${data.dir}`
					: `https://archive.org/download/${identifier}`;

			const folderVideos = videos.filter(
				(v) => v.folderId === selectedFolderId,
			);
			const startOrder = folderVideos.length + 1;

			const encodePath = (path: string) =>
				path.split("/").map(encodeURIComponent).join("/");

			const importPromises = videoFiles.map(async (f: any, i: number) => {
				// Archive.org stores thumbs in a ".thumbs" folder, named like: "01_000076.jpg"
				// where "01" is the base name of the source video "01.m4v"
				const videoBaseName = f.name.replace(/\.[^/.]+$/, ""); // e.g. "01"
				const allThumbs = data.files.filter(
					(df: any) =>
						df.source === "derivative" &&
						df.format === "Thumbnail" &&
						(df.original === f.name || df.name?.includes(`${videoBaseName}_`)),
				);
				// Pick the largest thumbnail (best quality, most content visible)
				const resolvedThumb =
					allThumbs.length > 0
						? allThumbs.reduce(
								(best: any, cur: any) =>
									parseInt(cur.size || "0", 10) > parseInt(best.size || "0", 10)
										? cur
										: best,
								allThumbs[0],
							)
						: null;
				const dataToSave = {
					title: f.title || f.name.replace(/\.[^/.]+$/, ""),
					url: `${baseUrl}/${encodePath(f.name)}`,
					folderId: selectedFolderId,
					thumbnailUrl: resolvedThumb
						? `${baseUrl}/${encodePath(resolvedThumb.name)}`
						: "",
					useDefaultThumbnail: !resolvedThumb,
					date: "",
					description: "",
					order: startOrder + i,
					hdUrl: "",
					createdAt: serverTimestamp(),
				};
				await addDoc(collection(db, "videos"), dataToSave);
			});

			await Promise.all(importPromises);
			showToast(
				`Successfully imported ${videoFiles.length} videos!`,
				"success",
			);
			closeArchiveImport();
			setArchiveUrl("");
		} catch (e: any) {
			showToast(`Archive Import Failed: ${e.message}`, "error");
		} finally {
			setImportingArchive(false);
		}
	};

	const handleFixThumbnails = async () => {
		if (!selectedFolderId) return;
		const folderVideos = videos.filter((v) => v.folderId === selectedFolderId);
		if (folderVideos.length === 0) return;

		setFixingThumbnails(true);
		let updatedCount = 0;
		let skippedLog = "";
		try {
			const archiveVideos: Record<string, VideoData[]> = {};
			folderVideos.forEach((v) => {
				let identifier = "";
				if (v.url.includes("archive.org/")) {
					// Match either archive.org/download/IDENTIFIER, items/IDENTIFIER, or details/IDENTIFIER
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
					`No Archive.org videos found in this folder to fix.`,
					"error",
				);
				setFixingThumbnails(false);
				return;
			}

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
						// Extract base name ignoring any URL encoding or trailing slashes
						// First remove any query parameters or hash from the URL
						const cleanUrl = v.url.trim().split("?")[0].split("#")[0];
						// Also replace '+' with ' ' as some archive links use '+' for spaces
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
							if (df.format !== "Thumbnail") return false;

							// Handle cases where Archive.org might have extra spaces in the filename
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
							// Only update if there is no custom thumbnail set
							if (!v.thumbnailUrl || v.useDefaultThumbnail) {
								await updateDoc(doc(db, "videos", v.id), {
									thumbnailUrl: newThumbUrl,
									useDefaultThumbnail: false,
								});
								updatedCount++;
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
			if (updatedCount > 0) {
				showToast(`Fixed thumbnails for ${updatedCount} videos!`, "success");
			} else {
				showToast(
					`0 fixed. Details: ${skippedLog || "All already have thumbnails"}`,
					"error",
				);
			}
		} catch (e: any) {
			showToast(`Failed to fix thumbnails: ${e.message}`, "error");
		} finally {
			setFixingThumbnails(false);
		}
	};

	const handleFixFolderOrdering = async () => {
		setFixingOrder(true);
		try {
			const sortedFolders = [...folders].sort((a, b) => a.order - b.order);
			let updatedCount = 0;
			const promises = sortedFolders.map(async (f, idx) => {
				const newOrder = idx + 1;
				if (f.order !== newOrder) {
					await updateDoc(doc(db, "video_folders", f.id), { order: newOrder });
					updatedCount++;
				}
			});
			await Promise.all(promises);
			showToast(`Fixed ordering for ${updatedCount} folders!`, "success");
		} catch (e: any) {
			showToast(`Error fixing ordering: ${e.message}`, "error");
		}
		setFixingOrder(false);
	};

	const handleFixVideoOrdering = async () => {
		if (!selectedFolderId) return;
		setFixingOrder(true);
		try {
			const folderVideos = videos.filter(
				(v) => v.folderId === selectedFolderId,
			);
			const sortedVideos = [...folderVideos].sort((a, b) => a.order - b.order);
			let updatedCount = 0;
			const promises = sortedVideos.map(async (v, idx) => {
				const newOrder = idx + 1;
				if (v.order !== newOrder) {
					await updateDoc(doc(db, "videos", v.id), { order: newOrder });
					updatedCount++;
				}
			});
			await Promise.all(promises);
			showToast(`Fixed ordering for ${updatedCount} videos!`, "success");
		} catch (e: any) {
			showToast(`Error fixing ordering: ${e.message}`, "error");
		}
		setFixingOrder(false);
	};

	const fetchArchiveData = async (identifier: string) => {
		if (archiveDataCache[identifier]) return archiveDataCache[identifier];
		try {
			const fetchArchiveFn = httpsCallable(functions, "fetchArchiveMetadata");
			const response = await fetchArchiveFn({ identifier });
			const data = response.data as any;
			setArchiveDataCache((prev) => ({ ...prev, [identifier]: data }));
			return data;
		} catch (_e) {
			return null;
		}
	};

	const getAvailableThumbs = async (video: VideoData | Partial<VideoData>) => {
		if (!video.url?.includes("archive.org/")) return [];
		const match = video.url.match(/(?:download|items)\/([^/]+)/);
		if (!match?.[1]) return [];
		const identifier = match[1];

		const data = await fetchArchiveData(identifier);
		if (!data?.files) return [];

		const baseUrl =
			data.server && data.dir
				? `https://${data.server}${data.dir}`
				: `https://archive.org/download/${identifier}`;
		const encodePath = (path: string) =>
			path.split("/").map(encodeURIComponent).join("/");

		let urlStr = video.url.trim();
		try {
			urlStr = decodeURIComponent(urlStr);
		} catch (_e) {
			// ignore malformed URI
		}
		const lastSlashIndex = urlStr.lastIndexOf("/");
		const fileName = urlStr.substring(lastSlashIndex + 1);
		const videoBaseName = fileName.replace(/\.[^/.]+$/, "");

		const thumbs = data.files.filter(
			(df: any) =>
				df.format === "Thumbnail" &&
				(df.original === fileName || df.name?.includes(`${videoBaseName}_`)),
		);

		return thumbs.map((t: any) => `${baseUrl}/${encodePath(t.name)}`);
	};

	const cycleEditVideoThumb = async (direction: 1 | -1) => {
		setFetchingThumbsFor("editingVideo");
		try {
			const availableThumbs = await getAvailableThumbs(editingVideo);
			if (availableThumbs.length === 0) {
				showToast("No alternative thumbs found.", "error");
				return;
			}
			let currentIndex = -1;
			if (editingVideo.thumbnailUrl) {
				currentIndex = availableThumbs.indexOf(editingVideo.thumbnailUrl);
			}
			let nextIndex = currentIndex + direction;
			if (nextIndex >= availableThumbs.length) nextIndex = 0;
			if (nextIndex < 0) nextIndex = availableThumbs.length - 1;

			setEditingVideo((prev) => ({
				...prev,
				thumbnailUrl: availableThumbs[nextIndex],
				useDefaultThumbnail: false,
			}));
		} finally {
			setFetchingThumbsFor(null);
		}
	};

	const cycleEditFolderThumb = async (direction: 1 | -1) => {
		setFetchingThumbsFor("editingFolder");
		try {
			const folderVideos = videos.filter(
				(v) => v.folderId === editingFolder.id,
			);
			if (folderVideos.length === 0) {
				showToast("Add videos to folder first.", "error");
				return;
			}

			let allAvailable = folderVideos
				.map((v) => v.thumbnailUrl)
				.filter((t) => !!t) as string[];
			if (allAvailable.length === 0) {
				showToast("No thumbnails found in videos.", "error");
				return;
			}
			allAvailable = Array.from(new Set(allAvailable));

			let currentIndex = -1;
			if (editingFolder.thumbnailUrl) {
				currentIndex = allAvailable.indexOf(editingFolder.thumbnailUrl);
			}
			let nextIndex = currentIndex + direction;
			if (nextIndex >= allAvailable.length) nextIndex = 0;
			if (nextIndex < 0) nextIndex = allAvailable.length - 1;

			setEditingFolder((prev) => ({
				...prev,
				thumbnailUrl: allAvailable[nextIndex],
				useDefaultThumbnail: false,
			}));
		} finally {
			setFetchingThumbsFor(null);
		}
	};

	const adjustImagePosition = (
		target: "editingVideo" | "editingFolder",
		axis: "x" | "y",
		amount: number,
	) => {
		if (target === "editingVideo") {
			setEditingVideo((prev) => {
				const currentOffset =
					prev[axis === "x" ? "thumbnailXOffset" : "thumbnailYOffset"] ?? 50;
				return {
					...prev,
					[axis === "x" ? "thumbnailXOffset" : "thumbnailYOffset"]: Math.max(
						0,
						Math.min(100, currentOffset + amount),
					),
				};
			});
		} else {
			setEditingFolder((prev) => {
				const currentOffset =
					prev[axis === "x" ? "thumbnailXOffset" : "thumbnailYOffset"] ?? 50;
				return {
					...prev,
					[axis === "x" ? "thumbnailXOffset" : "thumbnailYOffset"]: Math.max(
						0,
						Math.min(100, currentOffset + amount),
					),
				};
			});
		}
	};

	const enterBatchThumbMode = () => {
		setBatchThumbMode(true);
		const initialPreviews: Record<string, string> = {};
		videos
			.filter((v) => v.folderId === selectedFolderId)
			.forEach((v) => {
				if (v.thumbnailUrl) initialPreviews[v.id] = v.thumbnailUrl;
			});
		setBatchThumbPreview(initialPreviews);
	};

	const cycleBatchThumbs = async (direction: 1 | -1) => {
		setFetchingThumbsFor("batch");
		try {
			const folderVideos = videos.filter(
				(v) => v.folderId === selectedFolderId,
			);
			const newPreviews = { ...batchThumbPreview };

			await Promise.all(
				folderVideos.map(async (v) => {
					const available = await getAvailableThumbs(v);
					if (available.length > 0) {
						const currentThumb = newPreviews[v.id] || v.thumbnailUrl;
						const currentIndex = available.indexOf(currentThumb);
						let nextIndex = currentIndex + direction;
						if (nextIndex >= available.length) nextIndex = 0;
						if (nextIndex < 0) nextIndex = available.length - 1;
						newPreviews[v.id] = available[nextIndex];
					}
				}),
			);

			setBatchThumbPreview(newPreviews);
		} finally {
			setFetchingThumbsFor(null);
		}
	};

	const openAllThumbsModal = async (
		target: "editingVideo" | "editingFolder",
	) => {
		setLoadingAllThumbs(true);
		setShowAllThumbsFor(target);

		try {
			let allThumbs: string[] = [];
			if (target === "editingVideo" && editingVideo) {
				allThumbs = await getAvailableThumbs(editingVideo);
			} else if (target === "editingFolder" && editingFolder) {
				const folderVideos = videos.filter(
					(v) => v.folderId === editingFolder.id,
				);
				const allPromises = folderVideos.map((v) => getAvailableThumbs(v));
				const results = await Promise.all(allPromises);
				allThumbs = results.flat();
				allThumbs = Array.from(new Set(allThumbs));
			}
			setAllAvailableThumbs(allThumbs);
		} catch (e: any) {
			showToast(`Error loading thumbs: ${e?.message || "Unknown"}`, "error");
		} finally {
			setLoadingAllThumbs(false);
		}
	};

	const applySelectedThumbFromAll = (url: string) => {
		if (showAllThumbsFor === "editingVideo") {
			setEditingVideo((prev) => ({
				...prev,
				thumbnailUrl: url,
				useDefaultThumbnail: false,
			}));
		} else if (showAllThumbsFor === "editingFolder") {
			setEditingFolder((prev) => ({
				...prev,
				thumbnailUrl: url,
				useDefaultThumbnail: false,
			}));
		}
		closeAllThumbsFor();
	};

	const applyBatchThumbs = async () => {
		if (!batchThumbPreview) return;
		setCyclingThumbsAll(true);
		let count = 0;
		try {
			const folderVideos = videos.filter(
				(v) => v.folderId === selectedFolderId,
			);
			await Promise.all(
				folderVideos.map(async (v) => {
					const newThumb = batchThumbPreview[v.id];
					if (newThumb && newThumb !== v.thumbnailUrl) {
						await updateDoc(doc(db, "videos", v.id), {
							thumbnailUrl: newThumb,
							useDefaultThumbnail: false,
							thumbnailXOffset: 50,
							thumbnailYOffset: 50,
						});
						count++;
					}
				}),
			);
			showToast(`Applied ${count} new thumbnails!`, "success");
			closeBatchThumbMode();
			setBatchThumbPreview(null);
		} catch (e: any) {
			showToast(`Failed: ${e.message}`, "error");
		} finally {
			setCyclingThumbsAll(false);
		}
	};

	const confirmDelete = async () => {
		if (!pendingDelete) return;
		setDeleting(true);
		try {
			if (pendingDelete.type === "folder") {
				await deleteDoc(doc(db, "video_folders", pendingDelete.id));
				showToast("Folder deleted successfully!", "success");
			} else {
				const videoToDelete = videos.find((v) => v.id === pendingDelete.id);
				await deleteDoc(doc(db, "videos", pendingDelete.id));

				// Soft delete from B2
				if (videoToDelete?.url?.includes("videos.chaitanyaprembhakti.org")) {
					try {
						await softDeleteFromB2(videoToDelete.url);
					} catch (e) {
						console.error("Failed to soft delete from B2:", e);
					}
				}

				showToast("Video deleted successfully!", "success");
			}
			closePendingDelete();
		} catch (_error) {
			showToast(`Failed to delete ${pendingDelete.type}.`, "error");
		} finally {
			setDeleting(false);
		}
	};

	const copyShareLink = async (folderId: string) => {
		const url = `${APP_BASE_URL}?videoFolder=${folderId}`;
		const { copyToClipboard } = await import("../../utils/clipboard");
		const success = await copyToClipboard(url);
		if (success) {
			showToast("Share link copied to clipboard!", "success");
		} else {
			showToast("Failed to copy link", "error");
		}
	};

	const copyVideoShareLink = async (videoId: string) => {
		const url = `${APP_BASE_URL}/v/${videoId}`;
		const { copyToClipboard } = await import("../../utils/clipboard");
		const success = await copyToClipboard(url);
		if (success) {
			showToast("Video direct link copied to clipboard!", "success");
		} else {
			showToast("Failed to copy link", "error");
		}
	};

	const handleDeleteAll = async () => {
		if (!selectedFolderId) return;
		const folderVideos = videos.filter((v) => v.folderId === selectedFolderId);
		if (folderVideos.length === 0) return;
		setDeletingAll(true);
		try {
			await Promise.all(
				folderVideos.map((v) => deleteDoc(doc(db, "videos", v.id))),
			);
			showToast("All videos in the folder have been deleted.", "success");
			closeDeleteAll();
		} catch (e: any) {
			showToast(`Failed to delete all: ${e.message}`, "error");
		} finally {
			setDeletingAll(false);
		}
	};

	const handleRenameAll = async () => {
		if (!selectedFolderId || !renamePrefix.trim()) {
			showToast("Please enter a title prefix.", "error");
			return;
		}
		const folderVideos = videos
			.filter((v) => v.folderId === selectedFolderId)
			.sort((a, b) => a.order - b.order);
		if (folderVideos.length === 0) return;
		setRenamingAll(true);
		try {
			await Promise.all(
				folderVideos.map((v, i) =>
					updateDoc(doc(db, "videos", v.id), {
						title: `${renamePrefix.trim()} ${i + 1}`,
					}),
				),
			);
			showToast("Renamed all videos in the folder.", "success");
			closeRenameAll();
			setRenamePrefix("");
		} catch (e: any) {
			showToast(`Failed to rename: ${e.message}`, "error");
		} finally {
			setRenamingAll(false);
		}
	};

	return (
		<>
			<div className="flex-1 overflow-y-auto h-full w-full p-3 sm:p-4 max-w-5xl mx-auto space-y-6 pb-[calc(4rem+env(safe-area-inset-bottom))]">
				{/* Header */}
				<div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
					<div className="flex items-center gap-4">
						<div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/20">
							{selectedFolderId ? (
								<PlayCircle size={28} />
							) : (
								<Folder size={28} />
							)}
						</div>
						<div className="flex-1 min-w-0">
							{selectedFolderId ? (
								<>
									<button
										onClick={() => closeSelectedFolder()}
										className="flex items-center gap-1 text-pink-600 hover:text-pink-700 font-bold text-sm mb-1 active:scale-95 transition-transform w-fit"
									>
										<span className="text-lg leading-none">←</span> Back to
										Folders
									</button>
									<h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight truncate">
										{folders.find((f) => f.id === selectedFolderId)?.name ||
											"Videos"}
									</h2>
								</>
							) : (
								<>
									<h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight truncate">
										{isHindi ? "वीडियो मैनेजर" : "Videos Manager"}
									</h2>
									<p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
										Organize folders & media
									</p>
								</>
							)}
						</div>
					</div>
				</div>

				{/* FOLDERS VIEW (ROOT LEVEL) */}
				{!selectedFolderId && (
					<div className="space-y-6">
						{!isEditingFolder && (
							<div className="flex gap-2">
								<button
									onClick={() => {
										setEditingFolder({
											order: folders.length + 1,
											useDefaultThumbnail: true,
										});
										setIsEditingFolder(true);
									}}
									className="flex-1 bg-gradient-to-r from-pink-600 to-rose-500 active:scale-[0.98] transition-transform text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
								>
									<Plus size={20} /> Add New Folder
								</button>
								<button
									onClick={handleFixFolderOrdering}
									disabled={fixingOrder}
									className="bg-slate-700 hover:bg-slate-600 active:scale-[0.98] transition-transform text-white px-6 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
								>
									{fixingOrder ? (
										<Loader2 size={20} className="animate-spin" />
									) : (
										<ListOrdered size={20} />
									)}
								</button>
							</div>
						)}

						{isEditingFolder && (
							<div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4">
								<div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
									<h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
										<Folder size={20} className="text-pink-500" />{" "}
										{editingFolder.id ? "Edit Folder" : "New Folder"}
									</h3>
									<button
										onClick={() => closeEditingFolder()}
										className="p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-full active:scale-90"
									>
										<X size={20} />
									</button>
								</div>
								<div className="space-y-5">
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2">
											Folder Name *
										</label>
										<input
											type="text"
											value={editingFolder.name || ""}
											onChange={(e) =>
												setEditingFolder((prev) => ({
													...prev,
													name: e.target.value,
												}))
											}
											className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
											placeholder="E.g., Mayapur Yatra 2022"
										/>
									</div>

									<div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-3 flex items-center gap-1">
											<ImageIcon size={14} /> Folder Thumbnail
										</label>
										<div className="flex items-start gap-3 mb-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
											<input
												type="checkbox"
												id="defaultThumbFolder"
												checked={editingFolder.useDefaultThumbnail || false}
												onChange={(e) =>
													setEditingFolder((prev) => ({
														...prev,
														useDefaultThumbnail: e.target.checked,
													}))
												}
												className="w-5 h-5 text-pink-600 rounded border-slate-300 dark:border-ink-700 mt-0.5"
											/>
											<label
												htmlFor="defaultThumbFolder"
												className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug"
											>
												Use default thumbnail
												<br />
												<span className="text-xs text-slate-500 dark:text-ink-300 font-normal">
													Auto-selected from first video in folder
												</span>
											</label>
										</div>
										{!editingFolder.useDefaultThumbnail && (
											<div className="space-y-3">
												<div className="flex gap-2">
													<input
														type="url"
														value={editingFolder.thumbnailUrl || ""}
														onChange={(e) =>
															setEditingFolder((prev) => ({
																...prev,
																thumbnailUrl: e.target.value,
															}))
														}
														className="flex-1 p-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-pink-500"
														placeholder="https://..."
													/>
												</div>
												<div className="flex items-center gap-3">
													<span className="text-xs font-bold text-slate-400 dark:text-ink-400">
														OR
													</span>
													<input
														type="file"
														ref={fileInputRef}
														onChange={(e) => handleImageUpload(e, true)}
														accept="image/*"
														className="hidden"
													/>
													<button
														onClick={() => fileInputRef.current?.click()}
														disabled={uploadingImage}
														className="text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all"
													>
														{uploadingImage ? (
															<Loader2 size={16} className="animate-spin" />
														) : (
															<ImageIcon size={16} />
														)}
														{uploadingImage ? "Uploading..." : "Upload Image"}
													</button>
												</div>
												{editingFolder.thumbnailUrl && (
													<div className="flex gap-4 items-center mt-2">
														<div className="relative inline-block">
															<img
																src={editingFolder.thumbnailUrl}
																style={{
																	objectPosition: `${editingFolder.thumbnailXOffset ?? 50}% ${editingFolder.thumbnailYOffset ?? 50}%`,
																}}
																alt="Preview"
																className="h-24 aspect-video rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm"
															/>
															<div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none">
																<button
																	type="button"
																	onClick={() => cycleEditFolderThumb(-1)}
																	className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 active:scale-90 transition-all pointer-events-auto"
																>
																	<ChevronLeft size={16} />
																</button>
																<button
																	type="button"
																	onClick={() => cycleEditFolderThumb(1)}
																	className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 active:scale-90 transition-all pointer-events-auto"
																>
																	<ChevronRight size={16} />
																</button>
															</div>
															{fetchingThumbsFor === "editingFolder" && (
																<div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
																	<Loader2
																		className="animate-spin text-white"
																		size={20}
																	/>
																</div>
															)}
														</div>
														<div className="flex flex-col items-center gap-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700/50">
															<span className="text-[9px] font-bold text-slate-400 dark:text-ink-400 uppercase tracking-widest mb-0.5">
																Position
															</span>
															<button
																type="button"
																onClick={() =>
																	adjustImagePosition("editingFolder", "y", -5)
																}
																className="p-1.5 bg-white shadow-sm dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
															>
																<ChevronUp size={14} />
															</button>
															<div className="flex gap-4">
																<button
																	type="button"
																	onClick={() =>
																		adjustImagePosition(
																			"editingFolder",
																			"x",
																			-5,
																		)
																	}
																	className="p-1.5 bg-white shadow-sm dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
																>
																	<ChevronLeft size={14} />
																</button>
																<button
																	type="button"
																	onClick={() =>
																		adjustImagePosition("editingFolder", "x", 5)
																	}
																	className="p-1.5 bg-white shadow-sm dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
																>
																	<ChevronRight size={14} />
																</button>
															</div>
															<button
																type="button"
																onClick={() =>
																	adjustImagePosition("editingFolder", "y", 5)
																}
																className="p-1.5 bg-white shadow-sm dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
															>
																<ChevronDown size={14} />
															</button>
														</div>
													</div>
												)}
												{editingFolder.thumbnailUrl && (
													<div className="mt-3">
														<button
															type="button"
															onClick={() =>
																openAllThumbsModal("editingFolder")
															}
															className="text-xs text-pink-600 dark:text-pink-400 font-semibold hover:underline flex items-center gap-1.5"
														>
															<Grid size={14} /> See all available thumbnails
														</button>
													</div>
												)}
											</div>
										)}
									</div>

									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2">
											Display Order
										</label>
										<input
											type="number"
											value={editingFolder.order || 0}
											onChange={(e) =>
												setEditingFolder((prev) => ({
													...prev,
													order: Number(e.target.value),
												}))
											}
											className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
										/>
									</div>

									<div className="flex gap-3 pt-6">
										<button
											onClick={() => closeEditingFolder()}
											className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl active:scale-95 transition-transform"
										>
											Cancel
										</button>
										<button
											onClick={handleSaveFolder}
											disabled={saving}
											className="flex-[2] bg-gradient-to-r from-pink-600 to-rose-500 text-white p-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform shadow-md shadow-pink-500/20"
										>
											{saving ? (
												<Loader2 size={18} className="animate-spin" />
											) : (
												<Save size={18} />
											)}{" "}
											{editingFolder.id ? "Save Changes" : "Create Folder"}
										</button>
									</div>
								</div>
							</div>
						)}

						{!isEditingFolder && (
							<div>
								{loading ? (
									<div className="p-12 flex justify-center">
										<Loader2 className="animate-spin text-pink-500" size={32} />
									</div>
								) : folders.length === 0 ? (
									<div className="bg-white dark:bg-slate-800 rounded-3xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center">
										<div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-4">
											<Folder
												size={32}
												className="text-slate-400 dark:text-ink-400"
											/>
										</div>
										<h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
											No Folders Yet
										</h3>
										<p className="text-sm text-slate-500 dark:text-ink-300 max-w-[250px]">
											Create a folder to start organizing your video collection.
										</p>
									</div>
								) : (
									<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
										{folders.map((folder) => {
											const folderVideos = videos
												.filter((v) => v.folderId === folder.id)
												.sort((a, b) => a.order - b.order);
											const autoThumbVid = folder.useDefaultThumbnail
												? folderVideos.find(
														(v) => v.thumbnailUrl && !v.useDefaultThumbnail,
													)
												: null;
											const displayThumb = folder.useDefaultThumbnail
												? autoThumbVid?.thumbnailUrl
												: folder.thumbnailUrl;
											const displayThumbX = folder.useDefaultThumbnail
												? (autoThumbVid as any)?.thumbnailXOffset
												: folder.thumbnailXOffset;
											const displayThumbY = folder.useDefaultThumbnail
												? (autoThumbVid as any)?.thumbnailYOffset
												: folder.thumbnailYOffset;

											return (
												<div
													key={folder.id}
													onClick={() => setSelectedFolderId(folder.id)}
													className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col relative active:scale-[0.98]"
												>
													<div className="aspect-video bg-slate-50 dark:bg-slate-900/50 relative flex items-center justify-center overflow-hidden">
														{displayThumb ? (
															<img
																src={displayThumb}
																style={{
																	objectPosition: `${displayThumbX ?? 50}% ${displayThumbY ?? 50}%`,
																}}
																className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
																alt=""
															/>
														) : (
															<Folder
																size={48}
																className="text-slate-300 dark:text-slate-700 group-hover:scale-110 transition-transform duration-500"
															/>
														)}

														<div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-white text-[10px] font-bold shadow-sm">
															#{folder.order}
														</div>
													</div>
													<div className="p-3.5 flex-1 flex flex-col">
														<h4 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2 leading-tight mb-1 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
															{folder.name}
														</h4>
														<p className="text-xs font-medium text-slate-500 dark:text-ink-300 mb-3 bg-slate-50 dark:bg-slate-900/50 inline-block px-2 py-0.5 rounded-md self-start">
															{folderVideos.length} Video
															{folderVideos.length !== 1 ? "s" : ""}
														</p>

														<div className="mt-auto grid grid-cols-3 gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-700/50">
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	copyShareLink(folder.id);
																}}
																className="flex items-center justify-center py-2 bg-slate-50 hover:bg-blue-50 text-slate-500 dark:text-ink-300 hover:text-blue-600 dark:bg-slate-900/50 dark:hover:bg-blue-900/30 rounded-xl active:scale-95 transition-all"
															>
																<Copy size={16} />
															</button>
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	setEditingFolder(folder);
																	setIsEditingFolder(true);
																}}
																className="flex items-center justify-center py-2 bg-slate-50 hover:bg-pink-50 text-slate-500 dark:text-ink-300 hover:text-pink-600 dark:bg-slate-900/50 dark:hover:bg-pink-900/30 rounded-xl active:scale-95 transition-all"
															>
																<Edit2 size={16} />
															</button>
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	handleDeleteFolder(folder.id);
																}}
																className="flex items-center justify-center py-2 bg-slate-50 hover:bg-red-50 text-slate-500 dark:text-ink-300 hover:text-red-600 dark:bg-slate-900/50 dark:hover:bg-red-900/30 rounded-xl active:scale-95 transition-all"
															>
																<Trash2 size={16} />
															</button>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{/* VIDEOS VIEW (INSIDE A FOLDER) */}
				{selectedFolderId && (
					<div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
						{!isEditingVideo && !showArchiveImport && (
							<div className="space-y-2">
								<div className="flex gap-2 flex-wrap sm:flex-nowrap">
									<button
										onClick={() => {
											setEditingVideo({
												order:
													videos.filter((v) => v.folderId === selectedFolderId)
														.length + 1,
												useDefaultThumbnail: true,
												folderId: selectedFolderId,
											});
											setIsEditingVideo(true);
										}}
										className="flex-1 bg-gradient-to-r from-pink-600 to-rose-500 active:scale-[0.98] transition-transform text-white p-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
									>
										<Plus size={18} /> Add New Video
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
										className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 active:scale-[0.98] transition-transform text-white p-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
									>
										<PlayCircle size={18} /> Bulk Upload
									</button>
									<button
										onClick={() => setShowArchiveImport(true)}
										className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-[0.98] transition-transform text-white p-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
									>
										<Link size={18} /> Archive.org Import
									</button>
									<button
										onClick={handleFixVideoOrdering}
										disabled={fixingOrder}
										className="bg-slate-700 hover:bg-slate-600 active:scale-[0.98] transition-transform text-white px-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
									>
										{fixingOrder ? (
											<Loader2 size={18} className="animate-spin" />
										) : (
											<ListOrdered size={18} />
										)}
									</button>
								</div>
								{videos.filter((v) => v.folderId === selectedFolderId).length >
									0 && (
									<div className="flex gap-2 flex-wrap sm:flex-nowrap">
										<button
											onClick={() => setShowRenameAll(true)}
											className="flex-1 min-w-[120px] bg-slate-700 hover:bg-slate-600 active:scale-[0.98] transition-transform text-white p-3 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm"
										>
											<Edit2 size={16} /> Rename
										</button>
										<button
											onClick={enterBatchThumbMode}
											disabled={cyclingThumbsAll}
											className="flex-1 min-w-[120px] bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition-transform text-white p-3 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm disabled:opacity-50"
										>
											{cyclingThumbsAll ? (
												<Loader2 size={16} className="animate-spin" />
											) : (
												<ImageIcon size={16} />
											)}
											{cyclingThumbsAll ? "Changing..." : "Change Thumbs"}
										</button>
										<button
											onClick={handleFixThumbnails}
											disabled={fixingThumbnails}
											className="flex-1 min-w-[120px] bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-transform text-white p-3 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm disabled:opacity-50"
										>
											{fixingThumbnails ? (
												<Loader2 size={16} className="animate-spin" />
											) : (
												<ImageIcon size={16} />
											)}
											{fixingThumbnails ? "Fixing..." : "Fix Thumbs"}
										</button>
										<button
											onClick={() => setShowDeleteAll(true)}
											className="flex-1 min-w-[120px] bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-transform text-white p-3 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm"
										>
											<Trash2 size={16} /> Delete All
										</button>
									</div>
								)}
							</div>
						)}
						{/* Archive.org Import Form */}
						{showArchiveImport && (
							<div className="bg-white dark:bg-slate-800 rounded-3xl border border-blue-200 dark:border-blue-800 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
								<div className="px-5 py-4 border-b border-blue-100 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex justify-between items-center">
									<h5 className="font-bold text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
										<Link size={16} /> Bulk Import from Archive.org
									</h5>
									<button
										onClick={() => closeArchiveImport()}
										className="p-1.5 text-blue-400 hover:text-blue-600 rounded-full active:scale-90"
									>
										<X size={18} />
									</button>
								</div>
								<div className="p-5 space-y-4">
									<div>
										<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider block mb-2">
											Archive.org Item URL
										</label>
										<input
											type="url"
											className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400 font-mono"
											placeholder="https://archive.org/details/..."
											value={archiveUrl}
											onChange={(e) => setArchiveUrl(e.target.value)}
										/>
										<p className="text-[11px] text-slate-400 dark:text-ink-400 mt-2">
											Paste the Archive.org item link. All original MP4/MKV
											files will be imported into{" "}
											<span className="font-bold text-blue-500">
												{folders.find((f) => f.id === selectedFolderId)?.name}
											</span>
											.
										</p>
									</div>
									<div className="flex gap-3">
										<button
											onClick={() => closeArchiveImport()}
											className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm active:scale-95 transition-transform"
										>
											Cancel
										</button>
										<button
											onClick={handleArchiveImport}
											disabled={importingArchive}
											className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
										>
											{importingArchive ? (
												<Loader2 size={16} className="animate-spin" />
											) : (
												<Link size={16} />
											)}
											{importingArchive ? "Importing..." : "Fetch & Import"}
										</button>
									</div>
								</div>
							</div>
						)}

						{isEditingVideo && (
							<div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4">
								<div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
									<h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
										<PlayCircle size={20} className="text-pink-500" />{" "}
										{editingVideo.id ? "Edit Video" : "New Video"}
									</h3>
									<button
										onClick={() => closeEditingVideo()}
										className="p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-full active:scale-90"
									>
										<X size={20} />
									</button>
								</div>

								<div className="space-y-5">
									{/* Hidden Folder ID Field since we are managing contextually */}
									<input type="hidden" value={editingVideo.folderId || ""} />

									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2">
											Video Title *
										</label>
										<input
											type="text"
											value={editingVideo.title || ""}
											onChange={(e) =>
												setEditingVideo((prev) => ({
													...prev,
													title: e.target.value,
												}))
											}
											className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
											placeholder="E.g., Day 1 Kirtan"
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2 flex items-center gap-1">
											<Link size={12} /> Video URL *
										</label>
										<div className="flex gap-2">
											<input
												type="url"
												value={editingVideo.url || ""}
												onChange={(e) =>
													setEditingVideo((prev) => ({
														...prev,
														url: normalizeB2Url(e.target.value),
													}))
												}
												className="flex-1 p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
												placeholder="YouTube link or direct .mp4 link"
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
												className="bg-pink-100 text-pink-600 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:hover:bg-pink-900/50 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
											>
												{uploadingVideo ? (
													<Loader2 size={16} className="animate-spin" />
												) : (
													<PlayCircle size={16} />
												)}
												{uploadingVideo ? `${uploadProgress}%` : "Upload"}
											</button>
										</div>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2 flex items-center gap-1">
											<Link size={12} />{" "}
											<span className="text-blue-500">HD</span> Video URL{" "}
											<span className="text-slate-400 dark:text-ink-400 font-normal normal-case">
												(optional)
											</span>
										</label>
										<input
											type="url"
											value={(editingVideo as any).hdUrl || ""}
											onChange={(e) =>
												setEditingVideo(
													(prev) =>
														({
															...prev,
															hdUrl: normalizeB2Url(e.target.value),
														}) as any,
												)
											}
											className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-mono text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
											placeholder="HD .mp4 link (leave blank if not available)"
										/>
									</div>

									<div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-3 flex items-center gap-1">
											<ImageIcon size={14} /> Video Thumbnail
										</label>
										<div className="flex items-start gap-3 mb-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
											<input
												type="checkbox"
												id="defaultThumbVideo"
												checked={editingVideo.useDefaultThumbnail || false}
												onChange={(e) =>
													setEditingVideo((prev) => ({
														...prev,
														useDefaultThumbnail: e.target.checked,
													}))
												}
												className="w-5 h-5 text-pink-600 rounded border-slate-300 dark:border-ink-700 mt-0.5"
											/>
											<label
												htmlFor="defaultThumbVideo"
												className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug"
											>
												Use default thumbnail
												<br />
												<span className="text-xs text-slate-500 dark:text-ink-300 font-normal">
													YouTube auto-thumb or generic icon
												</span>
											</label>
										</div>
										{!editingVideo.useDefaultThumbnail && (
											<div className="space-y-3">
												<div className="flex gap-2">
													<input
														type="url"
														value={editingVideo.thumbnailUrl || ""}
														onChange={(e) =>
															setEditingVideo((prev) => ({
																...prev,
																thumbnailUrl: e.target.value,
															}))
														}
														className="flex-1 p-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-pink-500"
														placeholder="https://..."
													/>
												</div>
												<div className="flex items-center gap-3">
													<span className="text-xs font-bold text-slate-400 dark:text-ink-400">
														OR
													</span>
													<input
														type="file"
														ref={fileInputRef}
														onChange={(e) => handleImageUpload(e, false)}
														accept="image/*"
														className="hidden"
													/>
													<button
														onClick={() => fileInputRef.current?.click()}
														disabled={uploadingImage}
														className="text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all"
													>
														{uploadingImage ? (
															<Loader2 size={16} className="animate-spin" />
														) : (
															<ImageIcon size={16} />
														)}
														{uploadingImage ? "Uploading..." : "Upload Image"}
													</button>
												</div>
												{editingVideo.thumbnailUrl && (
													<div className="flex gap-4 items-center mt-2">
														<div className="relative inline-block">
															<img
																src={editingVideo.thumbnailUrl}
																style={{
																	objectPosition: `${(editingVideo as any).thumbnailXOffset ?? 50}% ${(editingVideo as any).thumbnailYOffset ?? 50}%`,
																}}
																alt="Preview"
																className="h-24 aspect-video rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm"
															/>
															<div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none">
																<button
																	type="button"
																	onClick={() => cycleEditVideoThumb(-1)}
																	className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 active:scale-90 transition-all pointer-events-auto"
																>
																	<ChevronLeft size={16} />
																</button>
																<button
																	type="button"
																	onClick={() => cycleEditVideoThumb(1)}
																	className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 active:scale-90 transition-all pointer-events-auto"
																>
																	<ChevronRight size={16} />
																</button>
															</div>
															{fetchingThumbsFor === "editingVideo" && (
																<div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
																	<Loader2
																		className="animate-spin text-white"
																		size={20}
																	/>
																</div>
															)}
														</div>
														<div className="flex flex-col items-center gap-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700/50">
															<span className="text-[9px] font-bold text-slate-400 dark:text-ink-400 uppercase tracking-widest mb-0.5">
																Position
															</span>
															<button
																type="button"
																onClick={() =>
																	adjustImagePosition("editingVideo", "y", -5)
																}
																className="p-1.5 bg-white shadow-sm dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
															>
																<ChevronUp size={14} />
															</button>
															<div className="flex gap-4">
																<button
																	type="button"
																	onClick={() =>
																		adjustImagePosition("editingVideo", "x", -5)
																	}
																	className="p-1.5 bg-white shadow-sm dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
																>
																	<ChevronLeft size={14} />
																</button>
																<button
																	type="button"
																	onClick={() =>
																		adjustImagePosition("editingVideo", "x", 5)
																	}
																	className="p-1.5 bg-white shadow-sm dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
																>
																	<ChevronRight size={14} />
																</button>
															</div>
															<button
																type="button"
																onClick={() =>
																	adjustImagePosition("editingVideo", "y", 5)
																}
																className="p-1.5 bg-white shadow-sm dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
															>
																<ChevronDown size={14} />
															</button>
														</div>
													</div>
												)}
												{editingVideo.thumbnailUrl && (
													<div className="mt-3">
														<button
															type="button"
															onClick={() => openAllThumbsModal("editingVideo")}
															className="text-xs text-pink-600 dark:text-pink-400 font-semibold hover:underline flex items-center gap-1.5"
														>
															<Grid size={14} /> See all available thumbnails
														</button>
													</div>
												)}
											</div>
										)}
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2 flex items-center gap-1">
												<Calendar size={12} /> Date
											</label>
											<input
												type="date"
												value={formatForDateInput(editingVideo.date) || ""}
												onChange={(e) =>
													setEditingVideo((prev) => ({
														...prev,
														date: e.target.value,
													}))
												}
												className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
											/>
										</div>
										<div>
											<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2">
												Order
											</label>
											<input
												type="number"
												value={editingVideo.order || 0}
												onChange={(e) =>
													setEditingVideo((prev) => ({
														...prev,
														order: Number(e.target.value),
													}))
												}
												className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
											/>
										</div>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2 flex items-center gap-1">
											<FileText size={12} /> Description
										</label>
										<textarea
											value={editingVideo.description || ""}
											onChange={(e) =>
												setEditingVideo((prev) => ({
													...prev,
													description: e.target.value,
												}))
											}
											className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[100px] text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
											placeholder="Optional details..."
										/>
									</div>

									<div className="flex gap-3 pt-6">
										<button
											onClick={() => closeEditingVideo()}
											className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl active:scale-95 transition-transform"
										>
											Cancel
										</button>
										<button
											onClick={handleSaveVideo}
											disabled={saving}
											className="flex-[2] bg-gradient-to-r from-pink-600 to-rose-500 text-white p-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform shadow-md shadow-pink-500/20"
										>
											{saving ? (
												<Loader2 size={18} className="animate-spin" />
											) : (
												<Save size={18} />
											)}{" "}
											{editingVideo.id ? "Save Changes" : "Add Video"}
										</button>
									</div>
								</div>
							</div>
						)}

						{!isEditingVideo && (
							<div>
								{batchThumbMode && (
									<div className="sticky top-0 z-10 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 p-3 rounded-2xl mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-3">
										<div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-sm">
											<ImageIcon size={18} /> Previewing Batch Thumbs
											{fetchingThumbsFor === "batch" && (
												<Loader2 size={14} className="animate-spin ml-2" />
											)}
										</div>
										<div className="flex gap-2 w-full sm:w-auto">
											<button
												onClick={() => cycleBatchThumbs(-1)}
												className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-ink-600 active:scale-90"
											>
												<ChevronLeft
													size={18}
													className="text-purple-600 dark:text-purple-400"
												/>
											</button>
											<button
												onClick={() => cycleBatchThumbs(1)}
												className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-ink-600 active:scale-90"
											>
												<ChevronRight
													size={18}
													className="text-purple-600 dark:text-purple-400"
												/>
											</button>
											<button
												onClick={applyBatchThumbs}
												disabled={cyclingThumbsAll}
												className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm active:scale-95 ml-auto sm:ml-2 disabled:opacity-50 flex items-center gap-2 text-sm"
											>
												{cyclingThumbsAll ? (
													<Loader2 size={16} className="animate-spin" />
												) : (
													<Save size={16} />
												)}
												Apply
											</button>
											<button
												onClick={() => {
													closeBatchThumbMode();
													setBatchThumbPreview(null);
												}}
												disabled={cyclingThumbsAll}
												className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold active:scale-95 text-sm disabled:opacity-50"
											>
												Cancel
											</button>
										</div>
									</div>
								)}
								{loading ? (
									<div className="p-12 flex justify-center">
										<Loader2 className="animate-spin text-pink-500" size={32} />
									</div>
								) : videos.filter((v) => v.folderId === selectedFolderId)
										.length === 0 ? (
									<div className="bg-white dark:bg-slate-800 rounded-3xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center">
										<div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-4">
											<PlayCircle
												size={32}
												className="text-slate-400 dark:text-ink-400"
											/>
										</div>
										<h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
											No Videos Here
										</h3>
										<p className="text-sm text-slate-500 dark:text-ink-300 max-w-[250px]">
											Upload a video to add it to this folder.
										</p>
									</div>
								) : (
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
										{videos
											.filter((v) => v.folderId === selectedFolderId)
											.map((video) => (
												<div
													key={video.id}
													className="bg-white dark:bg-slate-800 rounded-2xl p-3 flex gap-3.5 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow group"
												>
													<div className="w-28 sm:w-36 aspect-video bg-slate-50 dark:bg-slate-900/50 rounded-xl overflow-hidden shrink-0 relative flex items-center justify-center border border-slate-100 dark:border-slate-700/50">
														{!video.useDefaultThumbnail &&
														(batchThumbMode && batchThumbPreview?.[video.id]
															? batchThumbPreview[video.id]
															: video.thumbnailUrl) ? (
															<img
																src={
																	batchThumbMode &&
																	batchThumbPreview?.[video.id]
																		? batchThumbPreview[video.id]
																		: video.thumbnailUrl
																}
																style={{
																	objectPosition: `${batchThumbMode && batchThumbPreview?.[video.id] ? 50 : ((video as any).thumbnailXOffset ?? 50)}% ${batchThumbMode && batchThumbPreview?.[video.id] ? 50 : ((video as any).thumbnailYOffset ?? 50)}%`,
																}}
																className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
																alt=""
															/>
														) : video.url.includes("youtu") ? (
															<img
																src={`https://img.youtube.com/vi/${video.url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/)?.[1] || video.url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/)?.[2]}/hqdefault.jpg`}
																className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
																alt=""
															/>
														) : (
															<PlayCircle
																size={28}
																className="text-slate-300 dark:text-slate-700"
															/>
														)}
														<div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
															#{video.order}
														</div>
													</div>
													<div className="flex-1 min-w-0 flex flex-col py-0.5">
														<h4 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2 leading-tight mb-1.5">
															{video.title}
														</h4>

														<div className="flex flex-col gap-1.5 items-start mt-1">
															{video.date && (
																<span className="inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
																	<Calendar size={10} className="mr-1.5" />{" "}
																	{formatDisplayDate(video.date)}
																</span>
															)}
														</div>

														<div className="mt-auto flex gap-1.5 justify-end pt-2">
															<button
																title="Copy Direct Link"
																onClick={() => copyVideoShareLink(video.id)}
																className="p-2 bg-slate-50 hover:bg-blue-50 text-slate-400 dark:text-ink-400 hover:text-blue-600 dark:bg-slate-900/50 dark:hover:bg-blue-900/30 active:scale-95 transition-all rounded-xl"
															>
																<Copy size={16} />
															</button>
															<button
																title="Edit Video"
																onClick={() => {
																	setEditingVideo(video);
																	setIsEditingVideo(true);
																}}
																className="p-2 bg-slate-50 hover:bg-pink-50 text-slate-400 dark:text-ink-400 hover:text-pink-600 dark:bg-slate-900/50 dark:hover:bg-pink-900/30 active:scale-95 transition-all rounded-xl"
															>
																<Edit2 size={16} />
															</button>
															<button
																title="Delete Video"
																onClick={() => handleDeleteVideo(video.id)}
																className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 dark:text-ink-400 hover:text-red-600 dark:bg-slate-900/50 dark:hover:bg-red-900/30 active:scale-95 transition-all rounded-xl"
															>
																<Trash2 size={16} />
															</button>
														</div>
													</div>
												</div>
											))}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			{/* ── Delete Confirmation Modal ── */}
			{pendingDelete && (
				<div
					className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
					onClick={() => closePendingDelete()}
				>
					<div
						className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300 border border-red-200 dark:border-red-900/40"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex flex-col items-center text-center gap-4">
							<div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center border border-red-100 dark:border-red-800/40">
								<AlertTriangle size={26} className="text-red-500" />
							</div>
							<div>
								<h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">
									Delete {pendingDelete.type === "folder" ? "Folder" : "Video"}?
								</h3>
								<p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
									<span className="font-bold text-slate-700 dark:text-slate-200 line-clamp-2">
										"{pendingDelete.label}"
									</span>
									<br />
									This action cannot be undone.
								</p>
							</div>
							<div className="flex gap-3 w-full pt-2">
								<button
									onClick={() => closePendingDelete()}
									disabled={deleting}
									className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									onClick={confirmDelete}
									disabled={deleting}
									className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-red-500/20 disabled:opacity-60"
								>
									{deleting ? (
										<Loader2 size={18} className="animate-spin" />
									) : (
										<Trash2 size={18} />
									)}
									{deleting ? "Deleting..." : "Delete"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ── Delete All Modal ── */}
			{showDeleteAll && (
				<div
					className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
					onClick={() => closeDeleteAll()}
				>
					<div
						className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 duration-300 border border-red-200 dark:border-red-900/40"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex flex-col items-center text-center gap-4">
							<div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center border border-red-100 dark:border-red-800/40">
								<AlertTriangle size={26} className="text-red-500" />
							</div>
							<div>
								<h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">
									Delete ALL Videos?
								</h3>
								<p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
									This will permanently delete{" "}
									<span className="font-bold text-red-500">
										{
											videos.filter((v) => v.folderId === selectedFolderId)
												.length
										}{" "}
										videos
									</span>{" "}
									from this folder.
									<br />
									This cannot be undone.
								</p>
							</div>
							<div className="flex gap-3 w-full pt-2">
								<button
									onClick={() => closeDeleteAll()}
									disabled={deletingAll}
									className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									onClick={handleDeleteAll}
									disabled={deletingAll}
									className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
								>
									{deletingAll ? (
										<Loader2 size={18} className="animate-spin" />
									) : (
										<Trash2 size={18} />
									)}
									{deletingAll ? "Deleting..." : "Delete All"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ── Rename All Modal ── */}
			{showRenameAll && (
				<div
					className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
					onClick={() => closeRenameAll()}
				>
					<div
						className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 duration-300 border border-slate-200 dark:border-slate-700"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex flex-col gap-4">
							<div className="flex items-center gap-3">
								<div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
									<Edit2
										size={22}
										className="text-slate-600 dark:text-slate-300"
									/>
								</div>
								<div>
									<h3 className="text-lg font-black text-slate-800 dark:text-white">
										Rename All Videos
									</h3>
									<p className="text-xs text-slate-500 dark:text-ink-300">
										{
											videos.filter((v) => v.folderId === selectedFolderId)
												.length
										}{" "}
										videos will be renamed
									</p>
								</div>
							</div>
							<div>
								<label className="block text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-2">
									Title Prefix
								</label>
								<input
									type="text"
									value={renamePrefix}
									onChange={(e) => setRenamePrefix(e.target.value)}
									className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
									placeholder="e.g. Day, Part, Video"
								/>
								<p className="text-xs text-slate-400 dark:text-ink-400 mt-2">
									Videos will be named:{" "}
									<span className="font-bold text-pink-500">
										{renamePrefix || "Prefix"} 1
									</span>
									,{" "}
									<span className="font-bold text-pink-500">
										{renamePrefix || "Prefix"} 2
									</span>
									, ...
								</p>
							</div>
							<div className="flex gap-3">
								<button
									onClick={() => closeRenameAll()}
									disabled={renamingAll}
									className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									onClick={handleRenameAll}
									disabled={renamingAll}
									className="flex-[2] py-3 bg-gradient-to-r from-pink-600 to-rose-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
								>
									{renamingAll ? (
										<Loader2 size={18} className="animate-spin" />
									) : (
										<Edit2 size={18} />
									)}
									{renamingAll ? "Renaming..." : "Rename All"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{showBatchConfirm && (
				<div
					className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
					onClick={() => closeBatchConfirm()}
				>
					<div
						className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-xl font-bold mb-4 text-center">
							Batch Assign Thumbnails?
						</h3>
						<p className="text-sm text-slate-500 dark:text-ink-300 mb-6 text-center">
							This will assign thumbnails to all videos in this folder if a
							matching numbered image is found. Continue?
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => closeBatchConfirm()}
								className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-bold active:scale-95 transition-transform"
							>
								Cancel
							</button>
							<button
								onClick={applyBatchThumbs}
								className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold active:scale-95 transition-transform shadow-md"
							>
								Apply All
							</button>
						</div>
					</div>
				</div>
			)}

			{/* All Thumbs Modal */}
			{showAllThumbsFor && (
				<div
					className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
					onClick={() => closeAllThumbsFor()}
				>
					<div
						className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<div className="flex items-center gap-3">
								<button
									onClick={() => closeAllThumbsFor()}
									className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 transition"
								>
									<ChevronLeft
										size={20}
										className="text-slate-700 dark:text-slate-300"
									/>
								</button>
								<h3 className="text-lg font-bold text-slate-800 dark:text-white">
									All Available Thumbnails
								</h3>
							</div>
							<button
								onClick={() => closeAllThumbsFor()}
								className="text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 p-2"
							>
								<X size={24} />
							</button>
						</div>
						<div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900">
							{loadingAllThumbs ? (
								<div className="flex flex-col items-center justify-center py-20">
									<Loader2
										className="animate-spin text-pink-500 mb-4"
										size={32}
									/>
									<p className="text-slate-500 dark:text-ink-300 font-medium">
										Loading thumbnails...
									</p>
								</div>
							) : allAvailableThumbs.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-ink-400">
									<ImageIcon size={48} className="mb-4 opacity-50" />
									<p>No thumbnails found.</p>
								</div>
							) : (
								<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
									{allAvailableThumbs.map((url, i) => (
										<div
											key={i}
											onClick={() => applySelectedThumbFromAll(url)}
											className="aspect-video bg-black rounded-xl overflow-hidden cursor-pointer group relative border-2 border-transparent hover:border-pink-500 transition-colors shadow-sm"
										>
											<img
												src={url}
												alt={`Thumb ${i + 1}`}
												className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
											/>
											<div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
												<span className="opacity-0 group-hover:opacity-100 bg-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-all">
													Select
												</span>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* ── Upload Blocker: locks screen during B2 video uploads ── */}
			<UploadBlockerModal
				isVisible={uploadingVideo}
				progress={uploadProgress}
				fileName={uploadingFileName}
				onCancel={handleCancelUpload}
				isHindi={isHindi}
			/>
		</>
	);
};

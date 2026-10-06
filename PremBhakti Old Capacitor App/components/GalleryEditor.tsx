import { Clipboard } from "@capacitor/clipboard";
import { Capacitor } from "@capacitor/core";
import { doc, getDocFromServer } from "firebase/firestore";
import {
	AlertCircle,
	ArrowLeft,
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	Folder,
	Image as ImageIcon,
	Loader2,
	Plus,
	RefreshCw,
	Trash2,
	Upload,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { db } from "../services/firebase";
import { useAdminBack } from "../src/hooks/useAdminBack";
import { usePopupBackHandler } from "../src/hooks/usePopupBackHandler";
import { uploadFileViaWorker } from "../utils/uploadManager";

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

const REPO_OWNER = "chaitanyaprembhakti";
const REPO_NAME = "CPBS-DAILY";

export const GalleryEditor: React.FC<{
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
	const [error, setError] = useState<string | null>(null);
	const [newFolderName, setNewFolderName] = useState("");
	const [showNewFolderInput, setShowNewFolderInput] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [diagnostics, setDiagnostics] = useState<string[]>([]);
	const [showDiagnostics, setShowDiagnostics] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);
	const [copiedAssetId, setCopiedAssetId] = useState<number | null>(null);

	const copyAssetUrl = async (asset: GitHubAsset) => {
		try {
			if (Capacitor.isNativePlatform()) {
				// Use Capacitor Clipboard on Android/iOS
				await Clipboard.write({ string: asset.browser_download_url });
			} else if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(asset.browser_download_url);
			} else {
				// Final fallback for older browsers
				const el = document.createElement("textarea");
				el.value = asset.browser_download_url;
				el.style.position = "fixed";
				el.style.opacity = "0";
				document.body.appendChild(el);
				el.focus();
				el.select();
				document.execCommand("copy");
				document.body.removeChild(el);
			}
			setCopiedAssetId(asset.id);
			setTimeout(() => setCopiedAssetId(null), 2000);
		} catch (e) {
			console.error("Copy failed", e);
		}
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
			// 1. Firebase Check
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

			// 2. GitHub Auth Check
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
			setReleases(data);
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchReleases is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (token) {
			fetchReleases();
		}
	}, [token]);

	const createRelease = async () => {
		if (!token || !newFolderName.trim()) return;
		setLoading(true);
		try {
			const tagName = newFolderName.trim().toLowerCase().replace(/\s+/g, "-");
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
						name: newFolderName.trim(),
						body: "Gallery Folder",
					}),
				},
			);

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.message || "Failed to create folder");
			}

			const newRelease = await response.json();
			setReleases((prev) => [newRelease, ...prev]);

			await fetchReleases();
			setNewFolderName("");
			setShowNewFolderInput(false);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const [selectedFiles, setSelectedFiles] = useState<
		{ file: File; name: string; extension: string }[]
	>([]);
	const [showUploadModal, setShowUploadModal] = useState(false);
	const handleClose_gallery_upload = usePopupBackHandler(
		showUploadModal,
		"gallery-upload",
		() => setShowUploadModal(false),
	);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const files = Array.from(e.target.files).map((file) => {
				const lastDotIndex = file.name.lastIndexOf(".");
				const name =
					lastDotIndex !== -1
						? file.name.substring(0, lastDotIndex)
						: file.name;
				const extension =
					lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : "";
				return { file, name, extension };
			});
			setSelectedFiles(files);
			setShowUploadModal(true);
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const uploadFileWithFunction = async (
		file: File,
		fullName: string,
		releaseId: number,
		totalFiles: number,
		currentIndex: number,
	) => {
		addLog(`Calling Worker proxy for: ${fullName}`);

		try {
			if (!token) throw new Error("GitHub token not available");
			const url = await uploadFileViaWorker(file, releaseId, token, fullName, {
				totalFiles,
				currentIndex,
			});

			addLog(`✅ Worker proxy upload success!`);
			return { asset: { browser_download_url: url } }; // Mimic original return structure
		} catch (e: any) {
			addLog(`❌ Worker proxy upload failed: ${e.message}`);
			throw e;
		}
	};

	const handleUploadConfirm = async () => {
		if (!token || !selectedRelease || selectedFiles.length === 0) return;
		setUploading(true);
		handleClose_gallery_upload();
		setShowDiagnostics(true);
		setDiagnostics([]);
		addLog(`Starting batch upload...`);

		try {
			const totalFiles = selectedFiles.length;
			const existingNames = new Set(selectedRelease.assets.map((a) => a.name));

			const uploadPromises = selectedFiles.map(async (item, index) => {
				let fullName = `${item.name}${item.extension}`;

				let counter = 1;
				while (existingNames.has(fullName)) {
					fullName = `${item.name}-${counter}${item.extension}`;
					counter++;
				}
				existingNames.add(fullName);

				try {
					await uploadFileWithFunction(
						item.file,
						fullName,
						selectedRelease.id,
						totalFiles,
						index + 1,
					);
					return { success: true, name: fullName };
				} catch (err: any) {
					return { success: false, name: fullName, error: err.message };
				}
			});

			const results = await Promise.all(uploadPromises);
			const successCount = results.filter((r) => r.success).length;
			const errors = results
				.filter((r) => !r.success)
				.map((r) => `${r.name}: ${r.error}`);

			addLog(
				`Batch complete. Success: ${successCount}, Failures: ${errors.length}`,
			);
			await fetchReleases();

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
			setSelectedFiles([]);
		}
	};

	const [deleteConfirmation, setDeleteConfirmation] = useState<{
		type: "folder" | "asset";
		id: number;
		name: string;
	} | null>(null);

	// Hardware back steps out one level — delete confirmation, new-folder box,
	// diagnostics log, then the open folder — instead of leaving Gallery Editor.
	useAdminBack(!!selectedRelease, () => setSelectedRelease(null));
	useAdminBack(showNewFolderInput, () => setShowNewFolderInput(false));
	useAdminBack(showDiagnostics && !uploading, () => setShowDiagnostics(false));
	useAdminBack(!!deleteConfirmation, () => setDeleteConfirmation(null));

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
			if (selectedRelease?.id === releaseId) setSelectedRelease(null);
			await fetchReleases();
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
		} catch (err: any) {
			setError(err.message);
		} finally {
			setDeletingId(null);
		}
	};

	const sortedAssets =
		selectedRelease?.assets.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, {
				numeric: true,
				sensitivity: "base",
			}),
		) || [];

	return (
		<div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right">
			{/* Header */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 flex items-center justify-between shadow-sm z-10">
				<div className="flex items-center gap-3">
					<button
						onClick={onBack}
						className="p-2 -ml-2 text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
					>
						<ArrowLeft size={20} />
					</button>
					<h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
						<ImageIcon className="text-blue-600" size={20} />
						Gallery Editor
					</h2>
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
								onClick={() => setShowDiagnostics(false)}
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
								onClick={() => handleClose_gallery_upload()}
								className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-ink-300"
							>
								<Trash2 size={16} />
							</button>
						</div>

						<div className="flex-1 overflow-y-auto p-4 space-y-3">
							{selectedFiles.map((item, index) => (
								<div
									key={index}
									className="flex gap-3 items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700"
								>
									<div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center shrink-0">
										<ImageIcon
											size={20}
											className="text-slate-400 dark:text-ink-400"
										/>
									</div>
									<div className="flex-1 min-w-0 flex flex-col">
										<input
											value={item.name}
											onChange={(e) => {
												const newFiles = [...selectedFiles];
												newFiles[index].name = e.target.value;
												setSelectedFiles(newFiles);
											}}
											className="w-full bg-transparent outline-none text-sm font-medium text-slate-800 dark:text-white"
										/>
										<div className="text-[10px] text-slate-400 dark:text-ink-400">
											{item.extension} ({(item.file.size / 1024).toFixed(1)} KB)
										</div>
									</div>
									<button
										onClick={() =>
											setSelectedFiles((prev) =>
												prev.filter((_, i) => i !== index),
											)
										}
										className="text-slate-400 dark:text-ink-400 hover:text-red-500 p-1"
									>
										<Trash2 size={16} />
									</button>
								</div>
							))}
						</div>

						<div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
							<button
								onClick={() => handleClose_gallery_upload()}
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
								Upload All
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
						{releases.map((release, _index) => {
							return (
								<div
									key={release.id}
									onClick={() => setSelectedRelease(release)}
									className={`p-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors flex justify-between items-center group ${
										selectedRelease?.id === release.id
											? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600"
											: "hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-l-transparent"
									}`}
								>
									<div className="min-w-0 flex-1">
										<h4
											className={`font-bold text-sm truncate ${
												selectedRelease?.id === release.id
													? "text-blue-700 dark:text-blue-300"
													: "text-slate-700 dark:text-slate-300"
											}`}
										>
											{release.name
												.replace(/Release for /i, "")
												.replace(/\s*\(.*?\)\s*$/, "")
												.trim()}
										</h4>
										<p className="text-xs text-slate-400 dark:text-ink-400 mt-0.5">
											{release.assets.length} items
										</p>
									</div>

									<div className="flex items-center gap-1">
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleDeleteClick("folder", release.id, release.name);
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

				{/* Main Area - Images */}
				<div
					className={`flex-1 bg-slate-50 dark:bg-slate-900 flex-col h-full overflow-hidden ${
						!selectedRelease ? "hidden md:flex" : "flex"
					}`}
				>
					{selectedRelease ? (
						<>
							<div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center shadow-sm">
								<div className="flex items-center gap-2">
									<button
										onClick={() => setSelectedRelease(null)}
										className="md:hidden p-1.5 -ml-1.5 text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-ink-700 rounded-lg"
									>
										<ArrowLeft size={18} />
									</button>
									<Folder
										size={16}
										className="text-slate-400 dark:text-ink-400 hidden md:block"
									/>
									<span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px] sm:max-w-xs">
										{selectedRelease.name
											.replace(/Release for /i, "")
											.replace(/\s*\(.*?\)\s*$/, "")
											.trim()}
									</span>
								</div>
								<div className="flex gap-2">
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

							<div className="flex-1 overflow-y-auto p-4">
								{error && (
									<div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800">
										{error}
									</div>
								)}

								<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
									{sortedAssets.map((asset) => (
										<div
											key={asset.id}
											className="relative aspect-square bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col"
										>
											{/* Image */}
											<div className="flex-1 overflow-hidden">
												<img
													src={asset.browser_download_url}
													alt={asset.name}
													className="w-full h-full object-cover"
													loading="lazy"
												/>
											</div>

											{/* Always-visible bottom action bar */}
											<div className="flex items-center justify-between gap-1 px-1.5 py-1 bg-black/70 backdrop-blur-sm">
												<span className="text-white text-[9px] truncate flex-1 font-mono opacity-70">
													{asset.name.length > 20
														? `${asset.name.slice(0, 18)}…`
														: asset.name}
												</span>
												<div className="flex gap-1 shrink-0">
													{/* Copy Link */}
													<button
														onClick={() => copyAssetUrl(asset)}
														className={`p-1.5 rounded-lg transition-colors ${
															copiedAssetId === asset.id
																? "bg-emerald-500 text-white"
																: "bg-white/20 text-white hover:bg-white/40"
														}`}
														title="Copy image link"
													>
														{copiedAssetId === asset.id ? (
															<Check size={12} />
														) : (
															<Copy size={12} />
														)}
													</button>
													{/* Delete */}
													<button
														onClick={() =>
															handleDeleteClick("asset", asset.id, asset.name)
														}
														disabled={deletingId === asset.id}
														className="p-1.5 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-70"
														title="Delete image"
													>
														{deletingId === asset.id ? (
															<Loader2 size={12} className="animate-spin" />
														) : (
															<Trash2 size={12} />
														)}
													</button>
												</div>
											</div>
										</div>
									))}
								</div>

								{sortedAssets.length === 0 && (
									<div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-ink-400">
										<ImageIcon size={48} className="mb-2 opacity-50" />
										<p>No photos in this folder</p>
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
								Choose a folder from the sidebar to manage its photos.
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Delete Confirmation Modal */}
			{deleteConfirmation && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-sm overflow-hidden p-6 animate-in zoom-in-95">
						<h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">
							Confirm Deletion
						</h3>
						<p className="text-slate-600 dark:text-slate-300 mb-6">
							Are you sure you want to delete{" "}
							<span className="font-semibold text-slate-900 dark:text-white">
								"
								{deleteConfirmation.name
									.replace(/Release for /i, "")
									.replace(/\s*\(.*?\)\s*$/, "")
									.trim()}
								"
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
		</div>
	);
};

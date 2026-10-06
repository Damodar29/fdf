import {
	AlertTriangle,
	ArrowLeft,
	Copy,
	Edit2,
	Folder,
	Loader2,
	RefreshCw,
	Search,
	Trash2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAdminBack } from "../../hooks/useAdminBack";
import { usePopupBackHandler } from "../../hooks/usePopupBackHandler";
import {
	type B2File,
	deleteB2File,
	fetchB2Files,
	renameB2File,
} from "../../utils/b2Uploader";

export const BackblazeManager: React.FC<{
	showToast: (msg: string, type?: "success" | "error") => void;
}> = ({ showToast }) => {
	const [files, setFiles] = useState<B2File[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPrefix, setCurrentPrefix] = useState("");

	// Popup states
	const [deleteItem, setDeleteItem] = useState<B2File | null>(null);
	const [deleting, setDeleting] = useState(false);

	const [renameItem, setRenameItem] = useState<B2File | null>(null);
	const [newName, setNewName] = useState("");
	const [renaming, setRenaming] = useState(false);

	const closeDeleteDialog = usePopupBackHandler(
		!!deleteItem,
		"b2-delete-file",
		() => setDeleteItem(null),
	);
	const closeRenameDialog = usePopupBackHandler(
		!!renameItem,
		"b2-rename-file",
		() => setRenameItem(null),
	);
	// Hardware back goes up one folder (like the ".." row) instead of leaving
	// the file manager from deep inside a folder.
	useAdminBack(currentPrefix !== "", () => {
		const parts = currentPrefix.split("/");
		parts.pop();
		parts.pop();
		setCurrentPrefix(parts.length > 0 ? `${parts.join("/")}/` : "");
	});

	const loadFiles = async () => {
		setLoading(true);
		try {
			const data = await fetchB2Files();
			// Sort by newest first
			data.sort(
				(a, b) =>
					new Date(b.lastModified).getTime() -
					new Date(a.lastModified).getTime(),
			);
			setFiles(data);
		} catch (error: any) {
			showToast(error.message, "error");
		}
		setLoading(false);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: loadFiles is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		loadFiles();
	}, []);

	const handleCopyLink = async (key: string) => {
		const url = `https://videos.chaitanyaprembhakti.org/${key.split("/").map(encodeURIComponent).join("/")}`;
		const { copyToClipboard } = await import("../../../utils/clipboard");
		const success = await copyToClipboard(url);
		if (success) {
			showToast("Link copied to clipboard!", "success");
		} else {
			showToast("Failed to copy link", "error");
		}
	};

	const confirmDelete = async () => {
		if (!deleteItem) return;
		setDeleting(true);
		try {
			await deleteB2File(deleteItem.key);
			showToast("File deleted successfully!", "success");
			setFiles((prev) => prev.filter((f) => f.key !== deleteItem.key));
			closeDeleteDialog();
		} catch (error: any) {
			showToast(error.message, "error");
		}
		setDeleting(false);
	};

	const confirmRename = async () => {
		if (!renameItem || !newName.trim()) return;
		const currentName = renameItem.key.split("/").pop() || "";
		if (newName.trim() === currentName) {
			closeRenameDialog();
			return;
		}

		setRenaming(true);
		try {
			const pathParts = renameItem.key.split("/");
			pathParts.pop(); // remove old name
			const newKey = [...pathParts, newName.trim()].join("/");

			await renameB2File(renameItem.key, newKey);
			showToast("File renamed successfully!", "success");

			setFiles((prev) =>
				prev.map((f) => {
					if (f.key === renameItem.key) {
						return { ...f, key: newKey };
					}
					return f;
				}),
			);
			closeRenameDialog();
		} catch (error: any) {
			showToast(error.message, "error");
		}
		setRenaming(false);
	};

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB", "TB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	};

	const filteredFiles = files.filter((f) =>
		f.key.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const folders = new Set<string>();
	const currentFiles: B2File[] = [];

	if (searchQuery.trim() !== "") {
		currentFiles.push(...filteredFiles);
	} else {
		files.forEach((f) => {
			if (!f.key.startsWith(currentPrefix)) return;
			if (f.key === currentPrefix) return; // ignore the folder itself if it's a 0-byte file

			const remaining = f.key.substring(currentPrefix.length);
			const slashIndex = remaining.indexOf("/");

			if (slashIndex !== -1) {
				const folderName = remaining.substring(0, slashIndex + 1);
				folders.add(folderName);
			} else {
				currentFiles.push(f);
			}
		});
	}

	return (
		<div className="bg-white dark:bg-ink-800 p-6 rounded-lg shadow-sm">
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-xl font-semibold">Backblaze File Manager</h2>
				<button
					onClick={loadFiles}
					className="p-2 text-gray-500 dark:text-ink-300 hover:bg-gray-100 dark:hover:bg-ink-700 rounded-full"
					title="Refresh Files"
				>
					<RefreshCw size={20} className={loading ? "animate-spin" : ""} />
				</button>
			</div>

			<div className="flex flex-col md:flex-row gap-4 mb-4">
				{/* Search */}
				<div className="relative flex-1">
					<Search
						size={20}
						className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-ink-400"
					/>
					<input
						type="text"
						placeholder="Search files..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
					/>
				</div>
			</div>

			{/* Breadcrumb Navigation */}
			{searchQuery.trim() === "" && (
				<div className="flex items-center text-sm text-gray-700 dark:text-ink-200 mb-4 bg-gray-50 dark:bg-ink-900 p-3 rounded-lg border overflow-x-auto whitespace-nowrap">
					<button
						onClick={() => setCurrentPrefix("")}
						className={`hover:text-blue-600 flex items-center font-medium ${currentPrefix === "" ? "text-blue-600" : ""}`}
					>
						<Folder size={16} className="mr-1" /> Root
					</button>
					{currentPrefix
						.split("/")
						.filter(Boolean)
						.map((part, index, arr) => {
							const path = `${arr.slice(0, index + 1).join("/")}/`;
							const isLast = index === arr.length - 1;
							return (
								<React.Fragment key={path}>
									<span className="mx-2 text-gray-400 dark:text-ink-400">
										/
									</span>
									<button
										onClick={() => setCurrentPrefix(path)}
										className={`hover:text-blue-600 truncate max-w-[200px] ${isLast ? "text-blue-600 font-medium" : ""}`}
									>
										{part}
									</button>
								</React.Fragment>
							);
						})}
				</div>
			)}

			<div className="overflow-x-auto overflow-y-auto border rounded-lg max-h-[60vh] shadow-inner">
				<table className="w-full text-left border-collapse relative">
					<thead className="bg-gray-100 dark:bg-ink-900 sticky top-0 z-10 shadow-sm">
						<tr>
							<th className="p-3 border-b font-medium text-gray-600 dark:text-ink-300">
								File Path
							</th>
							<th className="p-3 border-b font-medium text-gray-600 dark:text-ink-300 w-32 hidden md:table-cell">
								Size
							</th>
							<th className="p-3 border-b font-medium text-gray-600 dark:text-ink-300 w-48 hidden md:table-cell">
								Date
							</th>
							<th className="p-3 border-b font-medium text-gray-600 dark:text-ink-300 w-24 md:w-32 text-center">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{loading && files.length === 0 ? (
							<tr>
								<td
									colSpan={4}
									className="p-8 text-center text-gray-500 dark:text-ink-300"
								>
									<Loader2 size={24} className="animate-spin mx-auto mb-2" />
									Loading files...
								</td>
							</tr>
						) : currentFiles.length === 0 && folders.size === 0 ? (
							<tr>
								<td
									colSpan={4}
									className="p-8 text-center text-gray-500 dark:text-ink-300"
								>
									No files or folders found.
								</td>
							</tr>
						) : (
							<>
								{currentPrefix !== "" && searchQuery.trim() === "" && (
									<tr
										className="hover:bg-gray-50 dark:hover:bg-ink-700 cursor-pointer"
										onClick={() => {
											const parts = currentPrefix.split("/");
											parts.pop(); // remove empty string after last slash
											parts.pop(); // remove current folder name
											setCurrentPrefix(
												parts.length > 0 ? `${parts.join("/")}/` : "",
											);
										}}
									>
										<td
											colSpan={4}
											className="p-3 border-b border-gray-100 text-blue-600 font-medium flex items-center gap-2"
										>
											<ArrowLeft size={18} />
											Go Back
										</td>
									</tr>
								)}

								{searchQuery.trim() === "" &&
									Array.from(folders)
										.sort()
										.map((folderName) => (
											<tr
												key={folderName}
												className="hover:bg-gray-50 dark:hover:bg-ink-700 cursor-pointer group transition-colors"
												onClick={() =>
													setCurrentPrefix(currentPrefix + folderName)
												}
											>
												<td className="p-3 border-b border-gray-100 text-gray-800 dark:text-cream-100 font-medium flex items-center gap-2">
													<Folder
														size={20}
														className="text-yellow-500 fill-yellow-500/20"
													/>
													{folderName.replace("/", "")}
												</td>
												<td className="p-3 border-b border-gray-100 text-gray-400 dark:text-ink-400 hidden md:table-cell">
													-
												</td>
												<td className="p-3 border-b border-gray-100 text-gray-400 dark:text-ink-400 hidden md:table-cell">
													-
												</td>
												<td className="p-3 border-b border-gray-100 text-gray-400 dark:text-ink-400 text-center">
													-
												</td>
											</tr>
										))}

								{currentFiles.map((file) => {
									// Show full path, but make the folder parts a bit lighter
									const parts = file.key.split("/");
									const name = parts.pop() || file.key;
									const folderPath =
										searchQuery.trim() !== "" && parts.length > 0
											? `${parts.join("/")}/`
											: "";

									return (
										<tr
											key={file.key}
											className="hover:bg-gray-50 dark:hover:bg-ink-700 group"
										>
											<td className="p-3 border-b text-gray-800 dark:text-cream-100 break-all">
												{folderPath && (
													<span className="text-gray-400 dark:text-ink-400">
														{folderPath}
													</span>
												)}
												<span className="font-medium">{name}</span>
												<div className="flex md:hidden text-xs text-gray-500 dark:text-ink-300 mt-1 items-center gap-2">
													<span>{formatBytes(file.size)}</span>
													<span>•</span>
													<span>
														{new Date(file.lastModified).toLocaleDateString()}
													</span>
												</div>
											</td>
											<td className="p-3 border-b text-gray-600 dark:text-ink-300 whitespace-nowrap hidden md:table-cell">
												{formatBytes(file.size)}
											</td>
											<td className="p-3 border-b text-gray-500 dark:text-ink-300 text-sm whitespace-nowrap hidden md:table-cell">
												{new Date(file.lastModified).toLocaleString()}
											</td>
											<td className="p-3 border-b">
												<div className="flex justify-center space-x-2">
													<button
														onClick={(e) => {
															e.stopPropagation();
															handleCopyLink(file.key);
														}}
														className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
														title="Copy Link"
													>
														<Copy size={18} />
													</button>
													<button
														onClick={(e) => {
															e.stopPropagation();
															setRenameItem(file);
															setNewName(name); // Just the file name for renaming
														}}
														className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded"
														title="Rename File"
													>
														<Edit2 size={18} />
													</button>
													<button
														onClick={(e) => {
															e.stopPropagation();
															setDeleteItem(file);
														}}
														className="p-1.5 text-red-600 hover:bg-red-50 rounded"
														title="Delete File"
													>
														<Trash2 size={18} />
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</>
						)}
					</tbody>
				</table>
			</div>

			{/* Delete Confirmation Popup */}
			{deleteItem && (
				<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50">
					<div className="bg-white dark:bg-ink-800 rounded-lg p-6 w-full max-w-sm">
						<h3 className="text-lg font-bold mb-4 flex items-center gap-2">
							<AlertTriangle className="text-red-500" />
							Confirm Delete
						</h3>
						<p className="text-sm text-gray-600 dark:text-ink-300 mb-6">
							Are you sure you want to delete{" "}
							<strong>{deleteItem.key.split("/").pop()}</strong>? This action
							cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button
								onClick={closeDeleteDialog}
								className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-ink-700"
								disabled={deleting}
							>
								Cancel
							</button>
							<button
								onClick={confirmDelete}
								className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
								disabled={deleting}
							>
								{deleting ? (
									<Loader2 size={18} className="animate-spin" />
								) : null}
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Rename Popup */}
			{renameItem && (
				<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50">
					<div className="bg-white dark:bg-ink-800 rounded-lg p-6 w-full max-w-sm">
						<h3 className="text-lg font-bold mb-4 flex items-center gap-2">
							<Edit2 className="text-yellow-600" />
							Rename File
						</h3>
						<div className="mb-6">
							<label className="block text-sm font-medium text-gray-700 dark:text-ink-200 mb-1">
								New File Name
							</label>
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
								placeholder="Enter new name including extension"
							/>
						</div>
						<div className="flex justify-end gap-3">
							<button
								onClick={closeRenameDialog}
								className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-ink-700"
								disabled={renaming}
							>
								Cancel
							</button>
							<button
								onClick={confirmRename}
								className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
								disabled={renaming}
							>
								{renaming ? (
									<Loader2 size={18} className="animate-spin" />
								) : null}
								Rename
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

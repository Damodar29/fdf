import {
	BookOpen,
	Check,
	Download,
	Image as ImageIcon,
	Music,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../context/DataContext";

const formatBytes = (bytes: number) => {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

export const DownloadManager: React.FC = () => {
	const { activeDownloads, cancelDownload } = useData();
	const [isOpen, setIsOpen] = useState(false);
	const [confirmId, setConfirmId] = useState<string | null>(null);

	// History listener for Download Manager Modal
	useEffect(() => {
		if (isOpen) {
			const id = `dl-manager-${Date.now()}`;
			window.history.pushState({ isPopup: true, modalId: id }, "");
			const handler = () => setIsOpen(false);
			window.addEventListener("popstate", handler);
			return () => {
				window.removeEventListener("popstate", handler);
				if (window.history.state?.modalId === id) window.history.back();
			};
		}
	}, [isOpen]);

	const downloadKeys = Object.keys(activeDownloads);
	const hasDownloads = downloadKeys.length > 0;

	if (!hasDownloads && !isOpen) return null;

	const handleCancel = (id: string) => {
		setConfirmId(id);
	};

	const confirmCancel = (id: string) => {
		cancelDownload(id);
		setConfirmId(null);
		if (downloadKeys.length <= 1) setIsOpen(false);
	};

	const getIcon = (type: string) => {
		switch (type) {
			case "book":
				return <BookOpen size={16} />;
			case "audio":
				return <Music size={16} />;
			case "image":
				return <ImageIcon size={16} />;
			default:
				return <Download size={16} />;
		}
	};

	return (
		<>
			{/* Floating Trigger Button */}
			{!isOpen && hasDownloads && (
				<div className="fixed bottom-[calc(13rem+env(safe-area-inset-bottom))] left-4 landscape:left-[17rem] z-[70] animate-in fade-in slide-in-from-bottom-4">
					<button
						onClick={() => setIsOpen(true)}
						className="bg-white dark:bg-slate-800 text-saffron-600 dark:text-saffron-400 p-3 rounded-full shadow-lg border border-saffron-100 dark:border-slate-700 flex items-center justify-center relative hover:scale-105 transition-transform"
					>
						<Download size={24} className="animate-bounce" />
						<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800">
							{downloadKeys.length}
						</span>
					</button>
				</div>
			)}

			{/* Manager Panel */}
			{isOpen &&
				createPortal(
					<div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in fade-in">
						<div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col max-h-[60vh] landscape:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
							<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
								<h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
									<Download size={20} className="text-saffron-500" />
									Downloads ({downloadKeys.length})
								</h3>
								<button
									onClick={() => setIsOpen(false)}
									className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
								>
									<X size={20} className="text-slate-500 dark:text-ink-300" />
								</button>
							</div>

							<div className="flex-1 overflow-y-auto p-2 space-y-2">
								{downloadKeys.length === 0 ? (
									<div className="text-center py-8 text-slate-400 dark:text-ink-400">
										<Check size={32} className="mx-auto mb-2 text-green-500" />
										<p>All downloads complete.</p>
									</div>
								) : (
									downloadKeys.map((key) => {
										const item = activeDownloads[key];
										const isConfirming = confirmId === key;

										return (
											<div
												key={key}
												className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 shadow-sm transition-all"
											>
												<div className="flex justify-between items-start mb-2">
													<div className="flex items-center gap-2 min-w-0">
														<div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
															{getIcon(item.type)}
														</div>
														<span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate block max-w-[180px]">
															{item.title}
														</span>
													</div>

													{isConfirming ? (
														<div className="flex gap-3 animate-in fade-in items-center ml-2">
															<button
																onClick={() => setConfirmId(null)}
																className="px-4 py-2 text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg font-bold transition-colors text-slate-700 dark:text-slate-300"
															>
																No
															</button>
															<button
																onClick={() => confirmCancel(key)}
																className="px-4 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold shadow-md transition-transform active:scale-95"
															>
																Yes
															</button>
														</div>
													) : (
														<button
															onClick={() => handleCancel(key)}
															className="p-2 text-slate-400 dark:text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
														>
															<X size={18} />
														</button>
													)}
												</div>

												<div className="relative h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
													<div
														className="absolute top-0 left-0 h-full bg-saffron-500 transition-all duration-300"
														style={{ width: `${item.progress}%` }}
													/>
												</div>
												<div className="flex justify-between mt-1 text-[10px] font-mono text-slate-400 dark:text-ink-400">
													<span>
														{item.total > 0
															? `${formatBytes(item.loaded)} / ${formatBytes(item.total)}`
															: formatBytes(item.loaded)}
													</span>
													<span>{Math.round(item.progress)}%</span>
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
};

import { BookOpen, Download, FileQuestion, Music } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { DownloadConfirmation } from "../types";
import { formatBytes } from "../utils/network";

interface Props {
	confirmation: DownloadConfirmation | null;
}

export const DownloadConfirmModal: React.FC<Props> = ({ confirmation }) => {
	// History handling
	useEffect(() => {
		if (confirmation?.isOpen) {
			const id = `dl-confirm-${Date.now()}`;
			window.history.pushState({ isPopup: true, modalId: id }, "");
			const handler = () => {
				if (confirmation.onCancel) confirmation.onCancel();
			};
			window.addEventListener("popstate", handler);
			return () => {
				window.removeEventListener("popstate", handler);
				if (window.history.state?.modalId === id) window.history.back();
			};
		}
	}, [confirmation]);

	if (!confirmation?.isOpen) return null;

	const isUnknownSize = confirmation.sizeBytes === 0;

	const getIcon = () => {
		if (confirmation.type === "audio") return <Music size={24} />;
		return <BookOpen size={24} />;
	};

	return createPortal(
		<div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
			<div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 transform scale-100 transition-all animate-in zoom-in-95 duration-200">
				<div className="flex flex-col items-center text-center">
					<div
						className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${isUnknownSize ? "bg-orange-100 text-orange-500" : "bg-saffron-100 text-saffron-600"}`}
					>
						{isUnknownSize ? <FileQuestion size={28} /> : getIcon()}
					</div>

					<h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 line-clamp-2">
						{confirmation.itemTitle}
					</h3>

					<p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
						{isUnknownSize
							? "Size unknown. Proceed with caution."
							: `File Size: ${formatBytes(confirmation.sizeBytes)}`}
					</p>

					<div className="flex gap-3 w-full">
						<button
							onClick={confirmation.onCancel}
							className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors active:scale-95"
						>
							Cancel
						</button>
						<button
							onClick={confirmation.onConfirm}
							className="flex-1 py-3 text-white font-bold bg-saffron-500 hover:bg-saffron-600 rounded-xl shadow-lg shadow-saffron-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
						>
							<Download size={18} />
							Download
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
};

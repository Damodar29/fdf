import { Loader2, UploadCloud } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { normalizeB2Url, uploadFileToB2 } from "../../src/utils/b2Uploader";

interface B2UploadButtonProps {
	folderPath: string;
	accept?: string;
	onUploadComplete: (url: string, file: File) => void;
	showToast: (msg: string, type?: "success" | "error") => void;
	className?: string;
	buttonText?: string;
	disabled?: boolean;
	disabledMessage?: string;
}

export const B2UploadButton: React.FC<B2UploadButtonProps> = ({
	folderPath,
	accept,
	onUploadComplete,
	showToast,
	className = "",
	buttonText = "",
	disabled = false,
	disabledMessage,
}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [progress, setProgress] = useState(0);

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploading(true);
		setProgress(0);

		try {
			const rawUrl = await uploadFileToB2(
				file,
				(p) => setProgress(p),
				folderPath,
			);
			const finalUrl = normalizeB2Url(rawUrl);
			showToast("Upload successful!", "success");
			onUploadComplete(finalUrl, file);
		} catch (error: any) {
			showToast(`Upload failed: ${error.message}`, "error");
		} finally {
			setIsUploading(false);
			setProgress(0);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	return (
		<div className={`inline-flex items-center gap-2 ${className}`}>
			<input
				type="file"
				ref={fileInputRef}
				onChange={handleFileChange}
				accept={accept}
				className="hidden"
			/>
			<button
				type="button"
				onClick={() => {
					if (isUploading) return;
					if (disabled) {
						if (disabledMessage) showToast(disabledMessage, "error");
						return;
					}
					fileInputRef.current?.click();
				}}
				disabled={isUploading}
				className={`p-2 bg-slate-100 dark:bg-slate-700 text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center justify-center flex-shrink-0 ${disabled || isUploading ? "opacity-50" : ""}`}
				title="Upload to Cloud"
			>
				{isUploading ? (
					<div className="flex flex-col items-center">
						<Loader2 size={18} className="animate-spin text-blue-500" />
					</div>
				) : (
					<UploadCloud size={18} />
				)}
			</button>
			{isUploading && (
				<div className="flex flex-col flex-1 min-w-[80px]">
					<div className="h-1.5 w-full bg-slate-200 dark:bg-ink-700 rounded-full overflow-hidden">
						<div
							className="h-full bg-blue-500 transition-all duration-300"
							style={{ width: `${progress}%` }}
						/>
					</div>
					<span className="text-[10px] text-slate-500 dark:text-ink-300 font-medium mt-0.5">
						{progress}%
					</span>
				</div>
			)}
			{buttonText && !isUploading && (
				<span className="text-sm font-medium text-slate-600 dark:text-slate-300">
					{buttonText}
				</span>
			)}
		</div>
	);
};

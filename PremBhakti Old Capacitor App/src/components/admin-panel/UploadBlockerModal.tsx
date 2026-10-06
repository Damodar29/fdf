/**
 * UploadBlockerModal.tsx
 *
 * Full-screen overlay that blocks all UI interaction while a video is uploading
 * to B2. Prevents admins from saving the form mid-upload, which would commit a
 * "Processing..." stub URL to Firestore instead of the real CDN link.
 *
 * Features:
 * - Dark semi-transparent backdrop with pointer-events: none on everything except itself
 * - Animated progress bar (0–100%)
 * - Hardware back-button interception via usePopupBackHandler
 * - Double-confirm cancel (click once → warning; click again → actually cancel)
 * - Bilingual Hindi / English text
 *
 * Usage:
 *   <UploadBlockerModal
 *     isVisible={uploadingVideo}
 *     progress={uploadProgress}
 *     fileName={uploadingFileName}
 *     onCancel={handleCancelUpload}
 *     isHindi={isHindi}
 *   />
 */

import { AlertTriangle, Loader2, Upload, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useAdminBack } from "../../hooks/useAdminBack";
import { usePopupBackHandler } from "../../hooks/usePopupBackHandler";

export interface UploadBlockerModalProps {
	isVisible: boolean;
	/** Upload progress 0–100 */
	progress: number;
	/** Optional file name to display */
	fileName?: string;
	/** Called when the admin confirms cancellation (second click) */
	onCancel: () => void | Promise<void>;
	isHindi?: boolean;
}

/* Module-level so the keyframes aren't re-created (and re-injected into the
   DOM) on every progress tick re-render. */
const KEYFRAME_STYLES = (
	<style>{`
		@keyframes upload-pulse {
			0%, 100% { transform: scale(1); opacity: 1; }
			50% { transform: scale(1.08); opacity: 0.85; }
		}
		@keyframes spin {
			from { transform: rotate(0deg); }
			to { transform: rotate(360deg); }
		}
	`}</style>
);

export const UploadBlockerModal: React.FC<UploadBlockerModalProps> = ({
	isVisible,
	progress,
	fileName,
	onCancel,
	isHindi = false,
}) => {
	// Two-stage cancel: first click shows warning, second click calls onCancel
	const [cancelStage, setCancelStage] = useState<0 | 1>(0);

	// Reset confirm stage whenever blocker opens/closes
	useEffect(() => {
		if (!isVisible) setCancelStage(0);
	}, [isVisible]);

	// Intercept hardware back button — same double-confirm flow
	const handleBackIntercepted = useCallback(() => {
		if (cancelStage === 0) {
			setCancelStage(1);
		} else {
			onCancel();
		}
	}, [cancelStage, onCancel]);

	// usePopupBackHandler pushes a history entry when blocker opens so the
	// hardware back button fires handleBackIntercepted instead of navigating away.
	// `isVisible` here is flipped by the parent (upload finished/errored/cancelled)
	// rather than via this hook's own closePopup(), so the hook itself is
	// responsible for popping its pushed history entry when that happens — see
	// the isOpen-goes-false branch in usePopupBackHandler.ts.
	usePopupBackHandler(isVisible, "upload-blocker", () => {});
	// The popup entry alone only held the first back press (it's gone once
	// popped); the second one left the screen mid-upload. A blocking layer runs
	// the cancel flow on every press and the entry is put back each time.
	useAdminBack(isVisible, handleBackIntercepted, { blocking: true });

	if (!isVisible) return null;

	const T = {
		uploading: isHindi ? "वीडियो अपलोड हो रहा है…" : "Uploading video…",
		doNotClose: isHindi
			? "कृपया प्रतीक्षा करें। अपलोड पूरा होने तक बंद न करें।"
			: "Please wait. Do not close or navigate away.",
		cancelBtn: isHindi ? "अपलोड रद्द करें" : "Cancel Upload",
		cancelWarn: isHindi
			? "क्या आप वाकई रद्द करना चाहते हैं? अधूरी एंट्री हटा दी जाएगी।"
			: "Are you sure? The incomplete entry will be removed.",
		confirmCancelBtn: isHindi ? "हाँ, रद्द करें" : "Yes, Cancel",
		keepUploading: isHindi ? "जारी रखें" : "Keep Uploading",
	};

	const handleCancelClick = () => {
		if (cancelStage === 0) {
			setCancelStage(1);
		} else {
			onCancel();
		}
	};

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 9999,
				background: "rgba(0, 0, 0, 0.82)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "24px",
				backdropFilter: "blur(4px)",
				WebkitBackdropFilter: "blur(4px)",
				// Prevent touch/click from reaching background elements
				touchAction: "none",
				userSelect: "none",
			}}
			// Stop pointer events from bubbling through the overlay
			onClick={(e) => e.stopPropagation()}
		>
			{/* Card */}
			<div
				style={{
					background: "#1a1a2e",
					border: "1px solid rgba(255,255,255,0.12)",
					borderRadius: "16px",
					padding: "32px 28px",
					maxWidth: "360px",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: "20px",
					boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
				}}
			>
				{/* Animated upload icon */}
				<div
					style={{
						width: "64px",
						height: "64px",
						borderRadius: "50%",
						background: "linear-gradient(135deg, #6c63ff, #4facfe)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						animation: "upload-pulse 1.8s ease-in-out infinite",
					}}
				>
					<Upload size={28} color="#fff" />
				</div>

				{/* Title */}
				<div style={{ textAlign: "center" }}>
					<div
						style={{
							color: "#fff",
							fontSize: "17px",
							fontWeight: 600,
							marginBottom: "6px",
						}}
					>
						{T.uploading}
					</div>
					{fileName && (
						<div
							style={{
								color: "rgba(255,255,255,0.55)",
								fontSize: "13px",
								wordBreak: "break-all",
								maxHeight: "40px",
								overflow: "hidden",
							}}
						>
							{fileName}
						</div>
					)}
				</div>

				{/* Progress bar */}
				<div style={{ width: "100%" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							marginBottom: "8px",
						}}
					>
						<Loader2
							size={14}
							color="#6c63ff"
							style={{ animation: "spin 1s linear infinite" }}
						/>
						<span
							style={{
								color: "rgba(255,255,255,0.7)",
								fontSize: "13px",
								fontWeight: 600,
							}}
						>
							{Math.round(progress)}%
						</span>
					</div>
					<div
						style={{
							height: "8px",
							borderRadius: "4px",
							background: "rgba(255,255,255,0.1)",
							overflow: "hidden",
						}}
					>
						<div
							style={{
								height: "100%",
								borderRadius: "4px",
								width: `${Math.min(100, Math.max(0, progress))}%`,
								background: "linear-gradient(90deg, #6c63ff, #4facfe)",
								transition: "width 0.4s ease",
							}}
						/>
					</div>
				</div>

				{/* Do-not-close hint */}
				<p
					style={{
						color: "rgba(255,255,255,0.45)",
						fontSize: "12px",
						textAlign: "center",
						margin: 0,
					}}
				>
					{T.doNotClose}
				</p>

				{/* Cancel section */}
				{cancelStage === 1 && (
					<div
						style={{
							background: "rgba(239,68,68,0.12)",
							border: "1px solid rgba(239,68,68,0.35)",
							borderRadius: "10px",
							padding: "12px 14px",
							display: "flex",
							alignItems: "flex-start",
							gap: "8px",
							width: "100%",
						}}
					>
						<AlertTriangle
							size={16}
							color="#ef4444"
							style={{ flexShrink: 0, marginTop: "2px" }}
						/>
						<span
							style={{
								color: "#fca5a5",
								fontSize: "13px",
								lineHeight: "1.4",
							}}
						>
							{T.cancelWarn}
						</span>
					</div>
				)}

				{/* Action buttons */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "10px",
						width: "100%",
					}}
				>
					{cancelStage === 1 && (
						<button
							type="button"
							onClick={handleCancelClick}
							style={{
								width: "100%",
								padding: "12px",
								borderRadius: "10px",
								border: "none",
								background: "#ef4444",
								color: "#fff",
								fontWeight: 600,
								fontSize: "14px",
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "6px",
							}}
						>
							<X size={15} />
							{T.confirmCancelBtn}
						</button>
					)}

					<button
						type="button"
						onClick={cancelStage === 0 ? handleCancelClick : () => setCancelStage(0)}
						style={{
							width: "100%",
							padding: "12px",
							borderRadius: "10px",
							border: `1px solid ${cancelStage === 1 ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.5)"}`,
							background: cancelStage === 1 ? "transparent" : "rgba(239,68,68,0.08)",
							color: cancelStage === 1 ? "rgba(255,255,255,0.45)" : "#fca5a5",
							fontWeight: cancelStage === 0 ? 500 : 400,
							fontSize: "14px",
							cursor: "pointer",
						}}
					>
						{cancelStage === 0 ? T.cancelBtn : T.keepUploading}
					</button>
				</div>
			</div>

			{KEYFRAME_STYLES}
		</div>
	);
};

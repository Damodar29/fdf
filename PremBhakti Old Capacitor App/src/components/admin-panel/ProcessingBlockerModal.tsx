/**
 * ProcessingBlockerModal.tsx
 *
 * Full-screen overlay that blocks all UI interaction while an admin data
 * operation (saving a bhajan/lecture/book, rebuilding a bundle, force-syncing)
 * is in flight. These operations write a shared index.json/bundle.json across
 * several sequential steps — unlike a video upload there is nothing safe to
 * cancel mid-flight, so this modal has no Cancel button and simply swallows
 * the hardware back button until the operation finishes.
 *
 * Usage:
 *   <ProcessingBlockerModal
 *     isVisible={isSaving}
 *     viewId="bhajan-save-blocker"
 *     title={isHindi ? "भजन सेव हो रहा है…" : "Saving bhajan…"}
 *     message={progressMsg}
 *     isHindi={isHindi}
 *   />
 */

import { Loader2 } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { useAdminBack } from "../../hooks/useAdminBack";
import { usePopupBackHandler } from "../../hooks/usePopupBackHandler";

export interface ProcessingBlockerModalProps {
	isVisible: boolean;
	/** Unique per call site — used as the history-back viewId, must not collide
	 *  with another popup open at the same time. */
	viewId: string;
	title: string;
	/** Optional progress detail line, e.g. "Updating bundle..." */
	message?: string;
	/** Optional step counter (e.g. force sync's 4 steps) rendered as a progress bar. */
	stepIndex?: number;
	totalSteps?: number;
	isHindi?: boolean;
}

/* Module-level so the keyframes aren't re-created (and re-injected into the
   DOM) on every progress-message re-render. */
const KEYFRAME_STYLES = (
	<style>{`
		@keyframes processing-blocker-pulse {
			0%, 100% { transform: scale(1); opacity: 1; }
			50% { transform: scale(1.08); opacity: 0.85; }
		}
		@keyframes processing-blocker-spin {
			from { transform: rotate(0deg); }
			to { transform: rotate(360deg); }
		}
	`}</style>
);

export const ProcessingBlockerModal: React.FC<ProcessingBlockerModalProps> = ({
	isVisible,
	viewId,
	title,
	message,
	stepIndex,
	totalSteps,
	isHindi = false,
}) => {
	// Intercept the hardware back button and do nothing — there is no cancel
	// path for these operations, so a back press must not close anything or
	// navigate away while a shared bundle/index file is mid-write.
	usePopupBackHandler(isVisible, viewId, () => {});
	// Holds every back press, not just the first (see UploadBlockerModal).
	useAdminBack(isVisible, () => {}, { blocking: true });

	// Web/desktop: ask before a refresh / tab close interrupts the write. (A phone
	// app can still be killed; storage writes are ordered + marked pending for
	// that — see markWriteStarted in utils/firebaseDataStorage.ts.)
	useEffect(() => {
		if (!isVisible) return;
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = "";
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [isVisible]);

	if (!isVisible) return null;

	const doNotClose = isHindi
		? "कृपया प्रतीक्षा करें। बंद न करें या पीछे न जाएं।"
		: "Please wait. Do not close the app or navigate back.";

	const showBar =
		typeof stepIndex === "number" &&
		typeof totalSteps === "number" &&
		totalSteps > 0;

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
				touchAction: "none",
				userSelect: "none",
			}}
			onClick={(e) => e.stopPropagation()}
		>
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
					gap: "18px",
					boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
				}}
			>
				<div
					style={{
						width: "64px",
						height: "64px",
						borderRadius: "50%",
						background: "linear-gradient(135deg, #6c63ff, #4facfe)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						animation: "processing-blocker-pulse 1.8s ease-in-out infinite",
					}}
				>
					<Loader2
						size={28}
						color="#fff"
						style={{ animation: "processing-blocker-spin 1s linear infinite" }}
					/>
				</div>

				<div style={{ textAlign: "center" }}>
					<div
						style={{
							color: "#fff",
							fontSize: "17px",
							fontWeight: 600,
							marginBottom: message ? "6px" : 0,
						}}
					>
						{title}
					</div>
					{message && (
						<div
							style={{
								color: "rgba(255,255,255,0.55)",
								fontSize: "13px",
								wordBreak: "break-word",
							}}
						>
							{message}
						</div>
					)}
				</div>

				{showBar && (
					<div style={{ width: "100%" }}>
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
									width: `${Math.min(100, Math.max(0, ((stepIndex as number) / (totalSteps as number)) * 100))}%`,
									background: "linear-gradient(90deg, #6c63ff, #4facfe)",
									transition: "width 0.4s ease",
								}}
							/>
						</div>
						<div
							style={{
								marginTop: "6px",
								textAlign: "right",
								color: "rgba(255,255,255,0.5)",
								fontSize: "11px",
								fontWeight: 600,
							}}
						>
							{stepIndex}/{totalSteps}
						</div>
					</div>
				)}

				<p
					style={{
						color: "rgba(255,255,255,0.45)",
						fontSize: "12px",
						textAlign: "center",
						margin: 0,
					}}
				>
					{doNotClose}
				</p>
			</div>

			{KEYFRAME_STYLES}
		</div>
	);
};

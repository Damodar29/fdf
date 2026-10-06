import { CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import type React from "react";

interface AdminStatusTimelineProps {
	isHindi: boolean;
	isApproved: boolean;
	submittedForReview?: boolean;
	rejectionNote?: string;
	submissionDate?: number;
	approvalDate?: number;
	resubmitted?: boolean;
	hasPendingEdits?: boolean;
	onResubmit?: () => void;
}

interface TimelineStep {
	key: string;
	labelHi: string;
	labelEn: string;
	icon: React.ReactNode;
	status: "completed" | "active" | "pending" | "rejected";
	date?: number;
	note?: string;
}

const formatDate = (ts?: number) => {
	if (!ts) return "";
	return new Date(ts).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
};

export const AdminStatusTimeline: React.FC<AdminStatusTimelineProps> = ({
	isHindi,
	isApproved,
	submittedForReview,
	rejectionNote,
	submissionDate,
	approvalDate,
	resubmitted,
	hasPendingEdits,
	onResubmit,
}) => {
	const steps: TimelineStep[] = [];

	// Step 1: Draft / Profile Created
	steps.push({
		key: "draft",
		labelHi: "प्रोफाइल बनाई",
		labelEn: "Profile Created",
		icon: <CheckCircle2 size={16} />,
		status: "completed",
	});

	// Step 2: Submitted
	if (submittedForReview || isApproved || rejectionNote) {
		steps.push({
			key: "submitted",
			labelHi: resubmitted ? "पुनः सबमिट" : "समीक्षा के लिए भेजी",
			labelEn: resubmitted ? "Re-submitted" : "Submitted for Review",
			icon: <CheckCircle2 size={16} />,
			status: "completed",
			date: submissionDate,
		});
	} else {
		steps.push({
			key: "submitted",
			labelHi: "समीक्षा के लिए भेजें",
			labelEn: "Submit for Review",
			icon: <Clock size={16} />,
			status: "pending",
		});
	}

	// Step 3: Review / Approved / Rejected
	if (isApproved) {
		steps.push({
			key: "review",
			labelHi: "समीक्षा पूर्ण",
			labelEn: "Review Complete",
			icon: <CheckCircle2 size={16} />,
			status: "completed",
		});
		steps.push({
			key: "approved",
			labelHi: "स्वीकृत ✅",
			labelEn: "Approved ✅",
			icon: <CheckCircle2 size={16} />,
			status: "completed",
			date: approvalDate,
		});
	} else if (rejectionNote) {
		steps.push({
			key: "rejected",
			labelHi: "अस्वीकृत",
			labelEn: "Rejected",
			icon: <XCircle size={16} />,
			status: "rejected",
			note: rejectionNote,
		});
	} else if (submittedForReview) {
		steps.push({
			key: "review",
			labelHi: "समीक्षाधीन",
			labelEn: "Under Review",
			icon: <Clock size={16} />,
			status: "active",
		});
	} else {
		steps.push({
			key: "review",
			labelHi: "समीक्षा",
			labelEn: "Review",
			icon: <Clock size={16} />,
			status: "pending",
		});
	}

	const statusColors = {
		completed: {
			bg: "bg-emerald-500",
			text: "text-white",
			line: "bg-emerald-500",
		},
		active: {
			bg: "bg-amber-500 animate-pulse",
			text: "text-white",
			line: "bg-slate-200 dark:bg-slate-700",
		},
		pending: {
			bg: "bg-slate-200 dark:bg-slate-700",
			text: "text-slate-400",
			line: "bg-slate-200 dark:bg-slate-700",
		},
		rejected: { bg: "bg-red-500", text: "text-white", line: "bg-red-300" },
	};

	// Approved: the steps are all done, so one slim row says it all.
	if (isApproved) {
		return (
			<div className="flex-1 min-w-[140px] flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-emerald-200 dark:border-emerald-700/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2">
				<CheckCircle2
					size={15}
					className="shrink-0 text-emerald-600 dark:text-emerald-400"
				/>
				<span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 leading-snug">
					{isHindi ? "सत्यापित सदस्य" : "Verified Member"}
				</span>
				{approvalDate ? (
					<span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
						{formatDate(approvalDate)}
					</span>
				) : null}
				{hasPendingEdits && (
					<span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
						{isHindi ? "बदलाव समीक्षाधीन" : "Edits under review"}
					</span>
				)}
			</div>
		);
	}

	return (
		<div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
			{/* Timeline */}
			<div className="flex flex-col gap-0">
				{steps.map((step, idx) => {
					const colors = statusColors[step.status];
					const isLast = idx === steps.length - 1;
					return (
						<div key={step.key} className="flex gap-3">
							{/* Dot + Line */}
							<div className="flex flex-col items-center">
								<div
									className={`w-7 h-7 rounded-full ${colors.bg} flex items-center justify-center ${colors.text} shrink-0 transition-all`}
								>
									{step.icon}
								</div>
								{!isLast && (
									<div
										className={`w-0.5 flex-1 min-h-[24px] ${idx < steps.length - 1 ? statusColors[steps[idx + 1].status === "completed" ? "completed" : "pending"].line : "bg-slate-200 dark:bg-slate-700"} transition-all`}
									/>
								)}
							</div>
							{/* Content */}
							<div className={`pb-4 ${isLast ? "pb-1" : ""}`}>
								<p
									className={`text-sm font-semibold ${step.status === "rejected" ? "text-red-600 dark:text-red-400" : step.status === "completed" ? "text-slate-800 dark:text-slate-200" : step.status === "active" ? "text-amber-700 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}
								>
									{isHindi ? step.labelHi : step.labelEn}
								</p>
								{step.date && (
									<p className="text-[10px] text-slate-400 dark:text-ink-400 mt-0.5">
										{formatDate(step.date)}
									</p>
								)}
								{step.note && (
									<div className="mt-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2">
										<p className="text-xs text-red-600 dark:text-red-400 font-medium">
											{isHindi ? "कारण" : "Reason"}: {step.note}
										</p>
										{onResubmit && (
											<button
												onClick={onResubmit}
												className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
											>
												<RefreshCw size={12} />
												{isHindi ? "ठीक करें और पुनः सबमिट करें" : "Fix & Resubmit"}
											</button>
										)}
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

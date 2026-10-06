import {
	arrayUnion,
	collection,
	doc,
	getDoc,
	getDocFromServer,
	getDocs,
	runTransaction,
	setDoc,
	updateDoc,
} from "firebase/firestore";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { db } from "../../../services/firebase";
import { usePopupBackHandler } from "../../hooks/usePopupBackHandler";
import {
	type ApprovalRequest,
	type GalleryItem,
	MANDAL_LIST,
} from "../../types/mandal";
import { deleteGithubAssetForItem } from "../../utils/githubReleaseAssets";
import { scheduleMandalNotification } from "../../utils/mandalNotificationHelper";

export const ApprovalManager: React.FC = () => {
	const [requests, setRequests] = useState<ApprovalRequest[]>([]);
	const [loading, setLoading] = useState(true);
	const [autoApprove, setAutoApprove] = useState(false);
	const [savingSettings, setSavingSettings] = useState(false);
	const [toastMessage, setToastMessage] = useState<{
		text: string;
		type: "success" | "error";
	} | null>(null);
	const [confirmDialog, setConfirmDialog] = useState<{
		message: string;
		onConfirm: () => void;
	} | null>(null);

	const closeConfirmDialog = usePopupBackHandler(
		!!confirmDialog,
		"approval-confirm",
		() => setConfirmDialog(null),
	);

	const showToast = (text: string, type: "success" | "error" = "success") => {
		setToastMessage({ text, type });
		setTimeout(() => setToastMessage(null), 3000);
	};

	const fetchSettings = async () => {
		try {
			const docRef = await getDoc(doc(db, "app_config", "mandal_settings"));
			if (docRef.exists()) {
				setAutoApprove(docRef.data().autoApprove || false);
			}
		} catch (e) {
			console.error("Error fetching settings", e);
		}
	};

	const fetchRequests = async () => {
		setLoading(true);
		try {
			const snapshot = await getDocs(collection(db, "approvals"));
			const fetched: ApprovalRequest[] = [];
			snapshot.forEach((doc) => {
				const data = doc.data() as ApprovalRequest;
				if (data.status === "pending") {
					fetched.push({ ...data, id: doc.id });
				}
			});
			// Sort by newest first
			fetched.sort((a, b) => b.timestamp - a.timestamp);
			setRequests(fetched);
		} catch (error) {
			console.error("Error fetching approvals:", error);
		}
		setLoading(false);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchSettings, fetchRequests are recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		fetchSettings();
		fetchRequests();
	}, []);

	const toggleAutoApprove = async () => {
		setSavingSettings(true);
		const newValue = !autoApprove;
		try {
			await setDoc(
				doc(db, "app_config", "mandal_settings"),
				{ autoApprove: newValue },
				{ merge: true },
			);
			setAutoApprove(newValue);
			showToast("Settings saved successfully.");
		} catch (e) {
			console.error("Error saving auto approve", e);
			showToast("Failed to save settings.", "error");
		}
		setSavingSettings(false);
	};

	const handleApprove = async (req: ApprovalRequest) => {
		try {
			const mandalRef = doc(db, "mandals", req.mandalId);
			const mandalDoc = await getDoc(mandalRef);
			const _mandalData = mandalDoc.exists() ? mandalDoc.data() : null;

			if (req.type === "weekly_program") {
				await setDoc(mandalRef, { weeklyProgram: req.data }, { merge: true });
			} else if (req.type === "daily_program") {
				await setDoc(
					mandalRef,
					{ [`dailyPrograms.${req.data.dateKey}`]: req.data.program },
					{ merge: true },
				);
			} else if (req.type === "gallery_item") {
				await setDoc(
					mandalRef,
					{ gallery: arrayUnion(req.data) },
					{ merge: true },
				);

				// Add release to global visibility
				const configDocName =
					req.data.type === "activity" ? "activity_folders" : "darshan_folders";
				const releaseKey =
					req.data.type === "activity" ? "activityRelease" : "githubRelease";
				const mandalDocSnap = await getDocFromServer(mandalRef);
				const releaseInfo = mandalDocSnap.exists()
					? mandalDocSnap.data()[releaseKey]
					: null;

				if (releaseInfo?.id) {
					const currentConfigDoc = await getDocFromServer(
						doc(db, "app_config", configDocName),
					);
					const currentVisibleIds = currentConfigDoc.exists()
						? currentConfigDoc.data().visibleIds || []
						: [];
					if (!currentVisibleIds.includes(releaseInfo.id)) {
						const newVisibleIds = [...currentVisibleIds, releaseInfo.id];
						await setDoc(
							doc(db, "app_config", configDocName),
							{ visibleIds: newVisibleIds },
							{ merge: true },
						);
					}
				}

				// Schedule push notification — super admin is approving, so treat as direct upload
				try {
					const mandalName =
						MANDAL_LIST.find((m) => m.id === req.mandalId)?.name ||
						req.mandalId;
					const galleryItem = req.data as GalleryItem;
					await scheduleMandalNotification({
						mandalId: req.mandalId,
						mandalName,
						type: galleryItem.type as "darshan" | "activity",
						uploadDate:
							galleryItem.date || new Date().toISOString().split("T")[0],
						imageUrl: galleryItem.url,
					});
				} catch (notifErr) {
					console.warn(
						"Failed to schedule notification after approval:",
						notifErr,
					);
				}
			} else if (req.type === "delete_gallery_item") {
				// The file goes from GitHub first; this path never deleted it, so an
				// approved delete left the photo in the release (see githubReleaseAssets).
				await deleteGithubAssetForItem(req.data);
				// Transaction — a plain read-then-write could put back a photo that
				// another delete removed in between.
				const updatedGallery = await runTransaction(db, async (tx) => {
					const snap = await tx.get(mandalRef);
					const gallery: any[] = snap.exists() ? snap.data().gallery || [] : [];
					const next = gallery.filter(
						(g: any) =>
							!(String(g.id) === String(req.data.id) && g.url === req.data.url),
					);
					if (next.length !== gallery.length) {
						tx.set(mandalRef, { gallery: next }, { merge: true });
					}
					return next;
				});

				// If no more items of this type, remove the release from global visibility
				const remainingItems = updatedGallery.filter(
					(g: any) => g.type === req.data.type,
				);
				if (remainingItems.length === 0) {
					const configDocName =
						req.data.type === "activity"
							? "activity_folders"
							: "darshan_folders";
					const releaseKey =
						req.data.type === "activity" ? "activityRelease" : "githubRelease";
					const mandalDocSnap = await getDocFromServer(mandalRef);
					const releaseInfo = mandalDocSnap.exists()
						? mandalDocSnap.data()[releaseKey]
						: null;

					if (releaseInfo?.id) {
						const currentConfigDoc = await getDocFromServer(
							doc(db, "app_config", configDocName),
						);
						const currentVisibleIds = currentConfigDoc.exists()
							? currentConfigDoc.data().visibleIds || []
							: [];
						const newVisibleIds = currentVisibleIds.filter(
							(id: number) => id !== releaseInfo.id,
						);
						await setDoc(
							doc(db, "app_config", configDocName),
							{ visibleIds: newVisibleIds },
							{ merge: true },
						);
					}
				}
			} else if (req.type === "edit_gallery_item") {
				await runTransaction(db, async (tx) => {
					const snap = await tx.get(mandalRef);
					const gallery: any[] = snap.exists() ? snap.data().gallery || [] : [];
					tx.set(
						mandalRef,
						{
							gallery: gallery.map((g: any) =>
								String(g.id) === String(req.data.id) ? req.data : g,
							),
						},
						{ merge: true },
					);
				});
			} else if (req.type === "temple_timings") {
				await setDoc(mandalRef, { templeTimings: req.data }, { merge: true });
			}

			// Mark as approved
			await updateDoc(doc(db, "approvals", req.id), { status: "approved" });

			// Remove from local state
			setRequests((prev) => prev.filter((r) => r.id !== req.id));
			showToast("Request approved.");
		} catch (e) {
			console.error("Error approving request", e);
			showToast("Failed to approve request.", "error");
		}
	};

	const handleReject = async (req: ApprovalRequest) => {
		setConfirmDialog({
			message: "Are you sure you want to reject this request?",
			onConfirm: async () => {
				try {
					// A photo upload request already put its file in the GitHub release;
					// rejecting it left that file behind. Remove it unless the database
					// uses the same URL. Best effort — the rejection still goes through.
					if (req.type === "gallery_item" && req.data?.url) {
						try {
							const snap = await getDocFromServer(
								doc(db, "mandals", req.mandalId),
							);
							const gallery: any[] = snap.exists()
								? snap.data().gallery || []
								: [];
							if (!gallery.some((g: any) => g.url === req.data.url)) {
								await deleteGithubAssetForItem(req.data);
							}
						} catch (err) {
							console.warn("Could not remove rejected photo from GitHub", err);
						}
					}
					await updateDoc(doc(db, "approvals", req.id), { status: "rejected" });
					setRequests((prev) => prev.filter((r) => r.id !== req.id));
					showToast("Request rejected.");
				} catch (e) {
					console.error("Error rejecting request", e);
					showToast("Failed to reject request.", "error");
				}
			},
		});
	};

	const groupedRequests = requests.reduce(
		(acc, req) => {
			if (!acc[req.mandalId]) {
				acc[req.mandalId] = [];
			}
			acc[req.mandalId].push(req);
			return acc;
		},
		{} as Record<string, ApprovalRequest[]>,
	);

	return (
		<div className="h-full overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right pb-[env(safe-area-inset-bottom)]">
			<div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
				{/* Header & Settings */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
					<div className="flex items-center gap-2">
						<CheckCircle className="text-green-600" size={24} />
						<h3 className="font-bold text-lg text-slate-800 dark:text-white">
							Approvals Manager
						</h3>
					</div>

					<label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
						<input
							type="checkbox"
							className="w-5 h-5 rounded border-slate-300 dark:border-ink-700 text-green-600 focus:ring-green-500"
							checked={autoApprove}
							onChange={toggleAutoApprove}
							disabled={savingSettings}
						/>
						<span className="font-bold text-sm text-slate-700 dark:text-slate-300">
							Auto-Approve All Requests
						</span>
					</label>
				</div>

				{/* Requests List */}
				<div>
					<h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
						<Clock size={16} /> Pending Requests ({requests.length})
					</h4>

					{loading ? (
						<p className="text-slate-500 dark:text-ink-300 text-sm">
							Loading requests...
						</p>
					) : requests.length === 0 ? (
						<div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
							<CheckCircle
								className="mx-auto text-slate-300 dark:text-slate-600 mb-2"
								size={32}
							/>
							<p className="text-slate-500 dark:text-ink-300 text-sm font-medium">
								All caught up! No pending requests.
							</p>
						</div>
					) : (
						<div className="space-y-6">
							{Object.entries(groupedRequests).map(
								([mandalId, mandalRequests]) => (
									<div key={mandalId} className="space-y-3">
										<h5 className="font-bold text-slate-800 dark:text-white text-md border-b border-slate-100 dark:border-slate-700 pb-2">
											{mandalRequests[0].mandalName} ({mandalRequests.length})
										</h5>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
											{mandalRequests.slice(0, 10).map((req) => (
												<div
													key={req.id}
													className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
												>
													<div className="flex justify-between items-start mb-3">
														<div>
															<h5 className="font-bold text-slate-800 dark:text-white text-sm">
																{req.type === "weekly_program"
																	? "Update Weekly Program"
																	: req.type === "daily_program"
																		? `Update Program for ${req.data.dateKey}`
																		: req.type === "gallery_item"
																			? "Add Gallery Image"
																			: req.type === "edit_gallery_item"
																				? "Edit Gallery Image"
																				: req.type === "temple_timings"
																					? "Update Temple Timings"
																					: "Delete Gallery Image"}
															</h5>
															<p className="text-xs text-slate-500 dark:text-ink-300 mt-0.5">
																By: {req.requestedBy}
															</p>
														</div>
														<div className="flex gap-2">
															<button
																onClick={() => handleApprove(req)}
																className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors"
																title="Approve"
															>
																<CheckCircle size={18} />
															</button>
															<button
																onClick={() => handleReject(req)}
																className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
																title="Reject"
															>
																<XCircle size={18} />
															</button>
														</div>
													</div>

													{/* Preview Data */}
													<div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto">
														{(req.type === "weekly_program" ||
															req.type === "daily_program") && (
															<div className="space-y-1">
																<p>
																	<strong>Title:</strong>{" "}
																	{req.type === "daily_program"
																		? req.data.program.title
																		: req.data.title}
																</p>
																<p>
																	<strong>Date:</strong>{" "}
																	{req.type === "daily_program"
																		? req.data.program.date
																		: req.data.date}
																</p>
																<p>
																	<strong>Location:</strong>{" "}
																	{req.type === "daily_program"
																		? req.data.program.locationUrl
																		: req.data.locationUrl}
																</p>
																<p className="line-clamp-2">
																	<strong>Desc:</strong>{" "}
																	{req.type === "daily_program"
																		? req.data.program.description
																		: req.data.description}
																</p>
															</div>
														)}
														{(req.type === "gallery_item" ||
															req.type === "delete_gallery_item" ||
															req.type === "edit_gallery_item") && (
															<div className="flex items-center gap-3">
																<img
																	src={req.data.url}
																	alt="Preview"
																	className="w-12 h-12 object-cover rounded bg-slate-200 dark:bg-ink-700"
																/>
																<div>
																	<p>
																		<strong>Name:</strong>{" "}
																		{req.data.displayName}
																	</p>
																	<p>
																		<strong>Date:</strong> {req.data.date}
																	</p>
																	<p>
																		<strong>Order:</strong> {req.data.order}
																	</p>
																</div>
															</div>
														)}
														{req.type === "temple_timings" && (
															<div className="space-y-1">
																{req.data.map((timing: any) => (
																	<div
																		key={timing.id}
																		className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0"
																	>
																		<span>{timing.eventName}</span>
																		<span className="font-mono">
																			{timing.time}
																		</span>
																	</div>
																))}
															</div>
														)}
													</div>
												</div>
											))}
										</div>
										{mandalRequests.length > 10 && (
											<div className="text-center text-xs text-slate-500 dark:text-ink-300 mt-2">
												+ {mandalRequests.length - 10} more requests for this
												mandal
											</div>
										)}
									</div>
								),
							)}
						</div>
					)}
				</div>
			</div>

			{/* Confirm Dialog */}
			{confirmDialog && (
				<div
					className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
					onClick={() => closeConfirmDialog()}
				>
					<div
						className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
							{confirmDialog.message}
						</h3>
						<div className="flex gap-3 justify-end">
							<button
								onClick={() => closeConfirmDialog()}
								className="px-4 py-2 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
							>
								Cancel
							</button>
							<button
								onClick={() => {
									confirmDialog.onConfirm();
									closeConfirmDialog();
								}}
								className="px-4 py-2 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600"
							>
								Confirm
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Toast Message */}
			{toastMessage && (
				<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] animate-in slide-in-from-bottom-5">
					<div
						className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
							toastMessage.type === "success"
								? "bg-emerald-500 text-white"
								: "bg-red-500 text-white"
						}`}
					>
						{toastMessage.type === "success" ? (
							<CheckCircle size={18} />
						) : (
							<XCircle size={18} />
						)}
						<span className="font-medium text-sm">{toastMessage.text}</span>
					</div>
				</div>
			)}
		</div>
	);
};

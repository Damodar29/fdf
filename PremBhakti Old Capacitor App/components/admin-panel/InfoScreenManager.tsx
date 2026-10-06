import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	Calendar,
	Check,
	Eye,
	EyeOff,
	FileText,
	Image as ImageIcon,
	Link,
	Loader2,
	Plus,
	Save,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
	db,
	functions,
	type InformationData,
	type InformationItem,
} from "../../services/firebase";
import { useAdminBack } from "../../src/hooks/useAdminBack";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import { uploadFileViaWorker } from "../../utils/uploadManager";
import { DeleteWithConfirm } from "./DeleteWithConfirm";

const REPO_OWNER = "chaitanyaprembhakti";
const REPO_NAME = "CPBS-DAILY";

export const InfoScreenManager: React.FC<{
	settingsLanguage?: "en" | "hi";
}> = ({ settingsLanguage = "hi" }) => {
	const { showToast } = useToast();
	const [enabled, setEnabled] = useState(false);
	const [items, setItems] = useState<InformationItem[]>([]);
	const [savingInfo, setSavingInfo] = useState(false);
	const [githubToken, setGithubToken] = useState<string | null>(null);
	const [uploadingField, setUploadingField] = useState<{
		itemId: string;
		fieldName: string;
	} | null>(null);
	const [status, setStatus] = useState<{
		type: "success" | "error";
		msg: string;
	} | null>(null);
	const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
	// Back collapses the item being edited before leaving the screen.
	useAdminBack(expandedItemId !== null, () => setExpandedItemId(null));
	const [showInfoTip, setShowInfoTip] = useState(false);
	const [initialItems, setInitialItems] = useState<InformationItem[]>([]);
	const [sendNotification, setSendNotification] = useState(true);

	const closeInfoTip = usePopupBackHandler(showInfoTip, "info-tip", () =>
		setShowInfoTip(false),
	);

	const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

	const isHindi = settingsLanguage === "hi";
	const t = {
		title: isHindi ? "सूचना स्क्रीन" : "Information Screen",
		enableTitle: isHindi
			? "उपयोगकर्ताओं के लिए सूचना स्क्रीन सक्षम करें"
			: "Enable Information Screen for Users",
		heading: isHindi ? "शीर्षक" : "Title",
		content: isHindi ? "पाठ सामग्री" : "Text Content",
		placeholderTitle: isHindi ? "उदा., महत्वपूर्ण अपडेट" : "e.g., Important Update",
		placeholderText: isHindi ? "संदेश का मुख्य भाग..." : "Message body...",
		imagesTitle: isHindi ? "स्क्रीन चित्र" : "Screen Images",
		img1: isHindi ? "चित्र 1 (प्राथमिक)" : "Image 1 (Primary)",
		img2: isHindi ? "चित्र 2 (वैकल्पिक)" : "Image 2 (Optional)",
		img3: isHindi ? "चित्र 3 (वैकल्पिक)" : "Image 3 (Optional)",
		saveBtn: isHindi ? "सूचना कॉन्फ़िगरेशन सहेजें" : "Save Information Config",
		savingBtn: isHindi ? "सहेजा जा रहा है..." : "Saving...",
		uploading: isHindi
			? "GitHub पर अपलोड हो रहा है..."
			: "Uploading to GitHub...",
		uploadPrompt: isHindi
			? "चित्र अपलोड करने के लिए क्लिक करें"
			: "Click to upload image",
		addItem: isHindi ? "नई सूचना जोड़ें" : "Add New Information",
		smartAction: isHindi ? "स्मार्ट एक्शन (बटन)" : "Smart Action (Button)",
		actionType: isHindi ? "एक्शन का प्रकार" : "Action Type",
		actionTarget: isHindi ? "लिंक / नंबर" : "Link / Number",
		actionLabel: isHindi ? "बटन का नाम" : "Button Label",
		none: isHindi ? "कोई नहीं" : "None",
		phone: isHindi ? "फ़ोन नंबर" : "Phone Number",
		location: isHindi ? "लोकेशन (मैप)" : "Location (Map)",
		link: isHindi ? "वेबसाइट लिंक" : "Website Link",
	};

	useEffect(() => {
		getDoc(doc(db, "app_config", "information_screen")).then((d) => {
			if (d.exists()) {
				const data = d.data() as InformationData;
				setEnabled(data.enabled || false);

				if (data.items && data.items.length > 0) {
					const loadedItems = data.items.map((item) => ({
						...item,
						images:
							item.images ||
							([item.imageUrl, item.imageUrl2, item.imageUrl3].filter(
								Boolean,
							) as string[]),
					}));
					setItems(loadedItems);
					setInitialItems(loadedItems);
				} else if (data.title || data.text || data.imageUrl) {
					// Migrate legacy single item
					setItems([
						{
							id: Date.now().toString(),
							title: data.title || "",
							text: data.text || "",
							images: [data.imageUrl, data.imageUrl2, data.imageUrl3].filter(
								Boolean,
							) as string[],
							actionType: "none",
							createdAt: Date.now(),
						},
					]);
				}
			}
		});

		const loadConfig = async () => {
			const tokenDoc = await getDoc(doc(db, "damtoken", "github"));
			if (tokenDoc.exists())
				setGithubToken(tokenDoc.data()?.token?.trim() || "");
		};
		loadConfig();
	}, []);

	const saveInfo = async () => {
		setSavingInfo(true);
		try {
			const dataToSave: InformationData = {
				enabled,
				items,
			};

			await setDoc(doc(db, "app_config", "information_screen"), dataToSave);
			showToast(
				isHindi
					? "सूचना कॉन्फ़िगरेशन सफलतापूर्वक सहेजा गया!"
					: "Information Screen config saved successfully!",
				"success",
			);

			// Send silent push notification
			if (enabled && sendNotification) {
				// Find an item that is enabled NOW, but was NOT enabled or NOT present in initialItems
				const newlyEnabledItem = items.find(
					(item) =>
						item.isEnabled !== false &&
						!initialItems.some(
							(init) => init.id === item.id && init.isEnabled !== false,
						),
				);

				if (newlyEnabledItem) {
					try {
						const notifTitle = newlyEnabledItem.title || "नई सूचना उपलब्ध है";
						const notifBody = newlyEnabledItem.text
							? newlyEnabledItem.text.substring(0, 80)
							: "नई जानकारी देखने के लिए ऐप खोलें";
						const sendInfoNotif = httpsCallable(
							functions,
							"sendInfoScreenNotification",
						);
						await sendInfoNotif({
							title: notifTitle,
							body: notifBody,
							target_info_id: newlyEnabledItem.id,
						});
						showToast(
							isHindi
								? "✅ Notification भी भेजी गई!"
								: "✅ Notification also sent!",
							"success",
						);

						// Update initialItems so subsequent saves don't re-trigger
						setInitialItems(items);
					} catch (notifErr) {
						console.warn("Notification send failed (non-critical):", notifErr);
					}
				}
			}
		} catch (e) {
			console.error(e);
			showToast(
				isHindi
					? "सूचना कॉन्फ़िगरेशन सहेजने में विफल।"
					: "Failed to save Information Screen config.",
				"error",
			);
		}
		setSavingInfo(false);
	};

	const uploadFileToGitHub = async (file: File): Promise<string | null> => {
		if (!githubToken) {
			setStatus({
				type: "error",
				msg: isHindi
					? "GitHub टोकन कॉन्फ़िगर नहीं है"
					: "GitHub token not configured",
			});
			return null;
		}

		try {
			const releaseResponse = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/notification-photostorage`,
				{
					headers: {
						Authorization: `token ${githubToken}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!releaseResponse.ok)
				throw new Error('Release "notification-photostorage" not found');

			const releaseData = await releaseResponse.json();

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
						releaseData.id,
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
			return url;
		} catch (err: any) {
			setStatus({
				type: "error",
				msg: isHindi
					? `चित्र अपलोड विफल: ${err.message}`
					: `Failed to upload image: ${err.message}`,
			});
			return null;
		}
	};

	const handleFileUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
		itemId: string,
	) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			setStatus({
				type: "error",
				msg: isHindi ? "कृपया एक चित्र फ़ाइल चुनें" : "Please select an image file",
			});
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			setStatus({
				type: "error",
				msg: isHindi
					? "फ़ाइल का आकार 5MB से कम होना चाहिए"
					: "File size must be less than 5MB",
			});
			return;
		}

		setUploadingField({ itemId, fieldName: "images" });
		setStatus({
			type: "success",
			msg: isHindi
				? "GitHub पर चित्र अपलोड किया जा रहा है..."
				: "Uploading image to GitHub...",
		});

		const downloadUrl = await uploadFileToGitHub(file);
		if (downloadUrl) {
			setItems((prevItems) =>
				prevItems.map((item) => {
					if (item.id === itemId) {
						const currentImages = item.images || [];
						return { ...item, images: [...currentImages, downloadUrl] };
					}
					return item;
				}),
			);
			setStatus({
				type: "success",
				msg: isHindi
					? "चित्र सफलतापूर्वक अपलोड किया गया!"
					: "Image uploaded successfully!",
			});
			setTimeout(() => setStatus(null), 3000);
		} else {
			setTimeout(() => setStatus(null), 4000);
		}

		setUploadingField(null);
		if (e.target) e.target.value = "";
	};

	const addNewItem = () => {
		const newItem: InformationItem = {
			id: Date.now().toString(),
			isEnabled: true,
			title: "",
			text: "",
			images: [],
			actionType: "none",
			createdAt: Date.now(),
		};
		setItems([newItem, ...items]);
		setExpandedItemId(newItem.id);
	};

	const moveItemUp = (index: number) => {
		if (index === 0) return;
		const newItems = [...items];
		[newItems[index - 1], newItems[index]] = [
			newItems[index],
			newItems[index - 1],
		];
		setItems(newItems);
	};

	const moveItemDown = (index: number) => {
		if (index === items.length - 1) return;
		const newItems = [...items];
		[newItems[index + 1], newItems[index]] = [
			newItems[index],
			newItems[index + 1],
		];
		setItems(newItems);
	};

	const updateItem = (id: string, updates: Partial<InformationItem>) => {
		setItems(
			items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
		);
	};

	const removeItem = (id: string) => {
		setItems(items.filter((item) => item.id !== id));
	};

	const renderImageGallery = (item: InformationItem) => {
		const isUploading = uploadingField?.itemId === item.id;
		const refKey = `${item.id}-new-image`;
		const images = item.images || [];

		const removeImage = (indexToRemove: number) => {
			updateItem(item.id, {
				images: images.filter((_, idx) => idx !== indexToRemove),
			});
		};

		return (
			<div className="space-y-3">
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
					{images.map((url, idx) => (
						<div
							key={idx}
							className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 aspect-video"
						>
							<img
								src={url}
								className="w-full h-full object-cover"
								onError={(e) => (e.currentTarget.style.display = "none")}
							/>
							<div className="absolute top-1 right-1">
								<DeleteWithConfirm
									onDelete={() => removeImage(idx)}
									className="p-1.5 bg-red-600/80 hover:bg-red-700/90 text-white rounded-lg transition-colors flex items-center justify-center text-[10px]"
									iconSize={14}
								/>
							</div>
						</div>
					))}

					{/* Add Image by Upload Button */}
					<div
						className="relative rounded-xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 aspect-video flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
						onClick={() => fileInputRefs.current[refKey]?.click()}
					>
						{isUploading ? (
							<div className="flex flex-col items-center gap-2 text-slate-500 dark:text-ink-300">
								<Loader2 size={24} className="animate-spin" />
								<span className="text-xs font-bold">Uploading...</span>
							</div>
						) : (
							<div className="flex flex-col items-center gap-2 text-slate-400 dark:text-ink-400">
								<Plus size={24} />
								<span className="text-xs font-bold">Upload</span>
							</div>
						)}
						<input
							ref={(el) => {
								fileInputRefs.current[refKey] = el;
							}}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => handleFileUpload(e, item.id)}
						/>
					</div>
				</div>

				{/* Paste URL Option */}
				<div className="flex gap-2 items-center">
					<input
						type="url"
						placeholder="Or paste image URL here..."
						className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-500"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								const val = (e.target as HTMLInputElement).value.trim();
								if (val) {
									updateItem(item.id, { images: [...images, val] });
									(e.target as HTMLInputElement).value = "";
								}
							}
						}}
					/>
					<button
						className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shrink-0"
						onClick={(e) => {
							const input = e.currentTarget.previousSibling as HTMLInputElement;
							const val = input?.value?.trim();
							if (val) {
								updateItem(item.id, { images: [...images, val] });
								input.value = "";
							}
						}}
					>
						Add URL
					</button>
				</div>
			</div>
		);
	};

	return (
		<div className="h-full overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right pb-72 md:pb-48">
			{/* Smart Links Info Modal */}
			{showInfoTip && (
				<div
					className="fixed inset-0 z-[200] flex items-center justify-center p-4"
					onClick={() => closeInfoTip()}
				>
					<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
					<div
						className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-3">
							<h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-base">
								✨ Smart Auto-Links Feature
							</h3>
							<button
								onClick={() => closeInfoTip()}
								className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-ink-400"
							>
								<X size={18} />
							</button>
						</div>
						<p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
							Text Content में कोई भी{" "}
							<strong className="text-blue-600">link</strong> या{" "}
							<strong className="text-green-600">phone number</strong> लिखने पर
							वह automatically clickable button बन जाएगा — admin को कुछ अलग करने
							की ज़रूरत नहीं।
						</p>
						<div className="space-y-2 text-sm">
							<div className="flex items-center gap-3 p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
								<span className="text-xl">📞</span>
								<div>
									<p className="font-bold text-green-700 dark:text-green-400 text-xs">
										Phone Number (10 digits)
									</p>
									<p className="text-slate-500 dark:text-ink-300 text-xs">
										9876543210 → <strong>Call button</strong> बनेगा
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
								<span className="text-xl">🔗</span>
								<div>
									<p className="font-bold text-blue-700 dark:text-blue-400 text-xs">
										Website Link
									</p>
									<p className="text-slate-500 dark:text-ink-300 text-xs">
										https://example.com → <strong>Open Link button</strong> बनेगा
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
								<span className="text-xl">📍</span>
								<div>
									<p className="font-bold text-indigo-700 dark:text-indigo-400 text-xs">
										Google Maps Link
									</p>
									<p className="text-slate-500 dark:text-ink-300 text-xs">
										maps.google.com/... → <strong>Directions button</strong>{" "}
										बनेगा
									</p>
								</div>
							</div>
						</div>
						<button
							onClick={() => closeInfoTip()}
							className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm"
						>
							समझ गया!
						</button>
					</div>
				</div>
			)}

			<div className="flex items-center gap-2 justify-between">
				<div className="flex items-center gap-2">
					<FileText className="text-blue-500" size={20} />
					<h3 className="font-bold text-lg text-slate-800 dark:text-white">
						{t.title} ({items.filter((i) => i.isEnabled !== false).length}{" "}
						Active)
					</h3>
				</div>
				<button
					onClick={addNewItem}
					className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg font-bold text-sm flex items-center gap-1 transition-colors"
				>
					<Plus size={16} /> {t.addItem}
				</button>
			</div>

			{status && (
				<div
					className={`p-3 rounded-xl text-sm flex items-center gap-2 ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
				>
					{status.type === "success" ? (
						<Check size={16} />
					) : (
						<AlertCircle size={16} />
					)}
					{status.msg}
				</div>
			)}

			<div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
				<span className="font-bold text-slate-700 dark:text-slate-300">
					{t.enableTitle}
				</span>
				<label className="relative inline-flex items-center cursor-pointer">
					<input
						type="checkbox"
						className="sr-only peer"
						checked={enabled}
						onChange={(e) => setEnabled(e.target.checked)}
					/>
					<div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
				</label>
			</div>

			<div className="space-y-3">
				{items.length === 0 ? (
					<div className="text-center p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-ink-300">
						No information items yet. Click "Add New Information" to get
						started!
					</div>
				) : (
					items.map((item, index) => {
						const isExpanded = expandedItemId === item.id;
						return (
							<div
								key={item.id}
								className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
							>
								<div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
									<div className="flex items-center gap-2 w-full sm:w-auto">
										<button
											onClick={() =>
												updateItem(item.id, {
													isEnabled: item.isEnabled === false,
												})
											}
											className="transition-colors hover:text-blue-500 shrink-0"
											title={
												item.isEnabled !== false ? "Hide item" : "Publish item"
											}
										>
											{item.isEnabled !== false ? (
												<Eye size={18} className="text-blue-500" />
											) : (
												<EyeOff
													size={18}
													className="text-slate-400 dark:text-ink-400"
												/>
											)}
										</button>

										<input
											className="font-bold text-slate-800 dark:text-white bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-blue-500 outline-none px-2 w-full sm:w-64"
											value={item.title || ""}
											onChange={(e) =>
												updateItem(item.id, { title: e.target.value })
											}
											placeholder="Information Title"
										/>
									</div>
									<div className="flex gap-1 sm:gap-2 self-end sm:self-auto">
										<div className="flex bg-slate-100 dark:bg-slate-700/50 rounded-lg p-0.5">
											<button
												onClick={() => moveItemUp(index)}
												disabled={index === 0}
												className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
											>
												<ArrowUp size={16} />
											</button>
											<button
												onClick={() => moveItemDown(index)}
												disabled={index === items.length - 1}
												className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
											>
												<ArrowDown size={16} />
											</button>
										</div>
										<button
											onClick={() =>
												setExpandedItemId(isExpanded ? null : item.id)
											}
											className="text-blue-600 hover:text-blue-700 font-bold text-sm px-2 py-1 rounded transition-colors hover:bg-blue-50 dark:hover:bg-slate-700"
										>
											{isExpanded ? "Done" : "Edit"}
										</button>
										<DeleteWithConfirm onDelete={() => removeItem(item.id)} />
									</div>
								</div>

								{isExpanded && (
									<div className="space-y-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
										{/* Expiry Date */}
										<div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-orange-50/50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-800/30">
											<div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 shrink-0">
												<Calendar size={16} />
												<span className="font-bold text-xs">
													{isHindi
														? "स्वत: हटाएँ (Auto-Expiry)"
														: "Auto-Expiry Date"}
												</span>
											</div>
											<div className="flex-1 flex items-center gap-2">
												<input
													type="datetime-local"
													className="w-full sm:w-auto flex-1 p-2 bg-white dark:bg-slate-800 rounded border border-orange-200 dark:border-orange-800 text-sm outline-none"
													value={
														item.expiryDate
															? new Date(
																	item.expiryDate -
																		new Date().getTimezoneOffset() * 60000,
																)
																	.toISOString()
																	.slice(0, 16)
															: ""
													}
													onChange={(e) => {
														if (e.target.value) {
															updateItem(item.id, {
																expiryDate: new Date(e.target.value).getTime(),
															});
														} else {
															updateItem(item.id, { expiryDate: undefined });
														}
													}}
												/>
												{item.expiryDate && (
													<button
														onClick={() =>
															updateItem(item.id, { expiryDate: undefined })
														}
														className="p-2 text-slate-400 dark:text-ink-400 hover:text-red-500 transition-colors"
													>
														<X size={16} />
													</button>
												)}
											</div>
										</div>

										<div>
											<div className="flex items-center gap-2 mb-1">
												<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase">
													{t.content}
												</label>
												<button
													type="button"
													onClick={() => setShowInfoTip(true)}
													className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-black flex items-center justify-center hover:bg-blue-600 active:scale-90 transition-all shrink-0 shadow-sm"
													title="Smart Links Info"
												>
													i
												</button>
											</div>
											<textarea
												className="w-full p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 h-24 outline-none focus:border-blue-500 text-sm"
												placeholder={t.placeholderText}
												value={item.text}
												onChange={(e) =>
													updateItem(item.id, { text: e.target.value })
												}
											/>
										</div>

										{/* Smart Action Builder */}
										<div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/30 space-y-3">
											<h4 className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 text-sm">
												<Link size={16} /> {t.smartAction}
											</h4>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
												<div>
													<label className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 uppercase block mb-1">
														{t.actionType}
													</label>
													<select
														className="w-full p-2 bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-800 text-sm outline-none"
														value={item.actionType || "none"}
														onChange={(e) =>
															updateItem(item.id, {
																actionType: e.target.value as any,
															})
														}
													>
														<option value="none">{t.none}</option>
														<option value="phone">{t.phone}</option>
														<option value="location">{t.location}</option>
														<option value="link">{t.link}</option>
													</select>
												</div>
												{item.actionType !== "none" && (
													<>
														<div>
															<label className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 uppercase block mb-1">
																{t.actionTarget}
															</label>
															<input
																className="w-full p-2 bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-800 text-sm outline-none"
																placeholder={
																	item.actionType === "phone"
																		? "+91 9876543210"
																		: "https://..."
																}
																value={item.actionTarget || ""}
																onChange={(e) =>
																	updateItem(item.id, {
																		actionTarget: e.target.value,
																	})
																}
															/>
														</div>
														<div className="sm:col-span-2">
															<label className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 uppercase block mb-1">
																{t.actionLabel}
															</label>
															<input
																className="w-full p-2 bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-800 text-sm outline-none"
																placeholder="e.g. Call Us"
																value={item.actionLabel || ""}
																onChange={(e) =>
																	updateItem(item.id, {
																		actionLabel: e.target.value,
																	})
																}
															/>
														</div>
													</>
												)}
											</div>
										</div>

										<div className="space-y-3">
											<h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
												<ImageIcon size={16} className="text-blue-500" />
												{t.imagesTitle} ({item.images?.length || 0})
											</h4>
											{renderImageGallery(item)}
										</div>
									</div>
								)}
							</div>
						);
					})
				)}
			</div>

			<div className="mt-4 space-y-3">
				<div className="flex items-center gap-2 px-1">
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							className="sr-only peer"
							checked={sendNotification}
							onChange={(e) => setSendNotification(e.target.checked)}
						/>
						<div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
					</label>
					<span
						className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
						onClick={() => setSendNotification(!sendNotification)}
					>
						{isHindi ? "ऑटोमैटिक नोटिफिकेशन भेजें" : "Send automatic notification"}
					</span>
				</div>

				<button
					onClick={saveInfo}
					disabled={savingInfo}
					className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md"
				>
					<Save size={18} /> {savingInfo ? t.savingBtn : t.saveBtn}
				</button>
			</div>
		</div>
	);
};

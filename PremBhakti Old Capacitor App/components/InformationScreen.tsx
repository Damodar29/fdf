import { doc, increment, onSnapshot, setDoc } from "firebase/firestore";
import {
	ArrowLeft,
	ChevronRight,
	Download,
	ExternalLink,
	Eye,
	Heart,
	Info,
	Loader2,
	MapPin,
	Phone,
	Share2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import {
	db,
	type InformationData,
	type InformationItem,
} from "../services/firebase";
import { shareImage } from "../utils/imageStorage";
import { THUMB } from "../utils/imageThumb";
import { CachedImage } from "./CachedImage";
import { CommentsSection } from "./CommentsSection";

interface InformationScreenProps {
	data: InformationData;
	onBack: () => void;
	settingsLanguage: "en" | "hi";
	initialItemId?: string | null;
	onInitialItemConsumed?: () => void;
	onOpenProfile?: () => void;
}

export const InformationScreen: React.FC<InformationScreenProps> = ({
	data,
	onBack,
	settingsLanguage,
	initialItemId,
	onInitialItemConsumed,
	onOpenProfile,
}) => {
	const { markInformationAsRead } = useSettings();
	const [selectedItem, setSelectedItem] = useState<InformationItem | null>(
		null,
	);
	const [isSharing, setIsSharing] = useState(false);
	const [readIds, setReadIds] = useState<string[]>([]);

	// Load read state
	useEffect(() => {
		const stored = localStorage.getItem("cpbs_read_info_ids");
		if (stored) {
			try {
				setReadIds(JSON.parse(stored));
			} catch (_e) {}
		}
	}, []);

	// Back button handling for details view vs exiting screen
	useEffect(() => {
		const handlePopState = (event: PopStateEvent) => {
			const state = event.state;
			if (state?.view === "info-detail") {
				// We are in detail view (e.g. went back from image zoom)
				setSelectedImageIndex(null);
			} else if (
				!state ||
				(state.view !== "info-detail" && state.view !== "info-image-zoom")
			) {
				// We went back from info-detail to the list, or somewhere else
				setSelectedImageIndex(null);
				setSelectedItem(null);
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const handleBack = () => {
		if (selectedImageIndex !== null) {
			window.history.back();
		} else if (selectedItem) {
			window.history.back();
		} else {
			onBack();
		}
	};

	const openItem = (item: InformationItem) => {
		setSelectedItem(item);
		window.history.pushState({ isPopup: true, view: "info-detail" }, "");
		if (!readIds.includes(item.id)) {
			const newReadIds = [...readIds, item.id];
			setReadIds(newReadIds);
			markInformationAsRead(item.id);
		}
	};

	// Auto-open from notification
	// biome-ignore lint/correctness/useExhaustiveDependencies: openItem is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (initialItemId && data.items && data.items.length > 0) {
			const item = data.items.find((i) => i.id === initialItemId);
			if (item) {
				openItem(item);
				if (onInitialItemConsumed) onInitialItemConsumed();
			}
			// No timeout here: if internet is very slow, we just wait until Firestore updates data.items.
		}
	}, [initialItemId, data.items]);

	// Clean up the deep-link if the user manually leaves the screen before data loads
	useEffect(() => {
		return () => {
			if (initialItemId && onInitialItemConsumed) {
				onInitialItemConsumed();
			}
		};
	}, [initialItemId, onInitialItemConsumed]);

	// Normalize items array
	const items = useMemo(() => {
		if (!data.enabled) return [];
		if (data.items && data.items.length > 0) {
			const now = Date.now();
			return data.items.filter(
				(i) => i.isEnabled !== false && (!i.expiryDate || i.expiryDate > now),
			);
		}
		if (data.title || data.text) {
			return [
				{
					id: "legacy_id",
					title: data.title || "",
					text: data.text || "",
					images: [data.imageUrl, data.imageUrl2, data.imageUrl3].filter(
						Boolean,
					) as string[],
					actionType: "none",
					createdAt: Date.now(),
				} as InformationItem,
			];
		}
		return [];
	}, [data]);

	// Zoom State for detail view
	const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
		null,
	);
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [_isZooming, setIsZooming] = useState(false);
	const lastDist = useRef<number | null>(null);
	const dragStart = useRef({ x: 0, y: 0 });

	const handleShare = async () => {
		if (isSharing || !selectedItem) return;
		setIsSharing(true);
		try {
			let shareText = selectedItem.text
				? `${selectedItem.title}\n\n${selectedItem.text}`
				: selectedItem.title;

			if (
				selectedItem.actionType &&
				selectedItem.actionType !== "none" &&
				selectedItem.actionTarget
			) {
				const actionLabel =
					selectedItem.actionLabel ||
					(settingsLanguage === "hi" ? "यहाँ क्लिक करें" : "Click Here");
				let actionUrl = selectedItem.actionTarget;
				if (selectedItem.actionType === "phone")
					actionUrl = `tel:${selectedItem.actionTarget}`;
				shareText += `\n\n${actionLabel}: ${actionUrl}`;
			}

			const images = getImages(selectedItem);

			if (images.length > 0) {
				await shareImage(
					images[0],
					selectedItem.title,
					shareText,
					"Darshan",
					new Date(),
				);
			} else {
				if (navigator.share) {
					await navigator.share({ title: selectedItem.title, text: shareText });
				}
			}
		} catch (e) {
			console.error("Share failed", e);
		} finally {
			setIsSharing(false);
		}
	};

	const getImages = (item: InformationItem) => {
		if (item.images && item.images.length > 0) return item.images;
		return [item.imageUrl, item.imageUrl2, item.imageUrl3].filter(
			Boolean,
		) as string[];
	};

	const handleDownload = async (
		url: string,
		index: number,
		e?: React.MouseEvent,
	) => {
		if (e) e.stopPropagation();
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = `PremBhakti_Info_${index + 1}.jpg`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch (_err) {
			window.open(url, "_blank");
		}
	};

	// --- Interaction State (Detail View) ---
	const [interactionStats, setInteractionStats] = useState({
		viewCount: 0,
		likeCount: 0,
	});
	const [hasLiked, setHasLiked] = useState(false);

	useEffect(() => {
		if (!selectedItem) return;

		const itemId = selectedItem.id;

		// Check local storage for like
		const likedItems = JSON.parse(
			localStorage.getItem("cpbs_liked_info") || "[]",
		);
		setHasLiked(likedItems.includes(itemId));

		// View count logic
		const viewedItems = JSON.parse(
			localStorage.getItem("cpbs_viewed_info") || "[]",
		);
		if (!viewedItems.includes(itemId)) {
			const docRef = doc(db, "information_interactions", itemId);
			setDoc(docRef, { viewCount: increment(1) }, { merge: true }).catch(
				console.error,
			);

			viewedItems.push(itemId);
			localStorage.setItem("cpbs_viewed_info", JSON.stringify(viewedItems));
		}

		// Listen to stats
		const unsubStats = onSnapshot(
			doc(db, "information_interactions", itemId),
			(snap) => {
				if (snap.exists()) {
					const data = snap.data();
					setInteractionStats({
						viewCount: data.viewCount || 0,
						likeCount: data.likeCount || 0,
					});
				}
			},
		);

		return () => {
			unsubStats();
		};
	}, [selectedItem]);

	const handleLike = async () => {
		if (!selectedItem || hasLiked) return;

		const itemId = selectedItem.id;
		const likedItems = JSON.parse(
			localStorage.getItem("cpbs_liked_info") || "[]",
		);

		if (!likedItems.includes(itemId)) {
			likedItems.push(itemId);
			localStorage.setItem("cpbs_liked_info", JSON.stringify(likedItems));
			setHasLiked(true);

			const docRef = doc(db, "information_interactions", itemId);
			await setDoc(docRef, { likeCount: increment(1) }, { merge: true });
		}
	};

	// --- Zoom Handlers ---
	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length === 2) {
			const dist = Math.hypot(
				e.touches[0].clientX - e.touches[1].clientX,
				e.touches[0].clientY - e.touches[1].clientY,
			);
			lastDist.current = dist;
			setIsZooming(true);
		} else if (e.touches.length === 1 && scale > 1) {
			setIsDragging(true);
			dragStart.current = {
				x: e.touches[0].clientX - position.x,
				y: e.touches[0].clientY - position.y,
			};
		}
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (e.touches.length === 2 && lastDist.current) {
			e.preventDefault();
			const dist = Math.hypot(
				e.touches[0].clientX - e.touches[1].clientX,
				e.touches[0].clientY - e.touches[1].clientY,
			);
			const factor = dist / lastDist.current;
			const newScale = Math.min(Math.max(1, scale * factor), 5);
			setScale(newScale);
			lastDist.current = dist;
		} else if (e.touches.length === 1 && isDragging && scale > 1) {
			e.preventDefault();
			const x = e.touches[0].clientX - dragStart.current.x;
			const y = e.touches[0].clientY - dragStart.current.y;
			setPosition({ x, y });
		}
	};

	const handleTouchEnd = () => {
		lastDist.current = null;
		setIsDragging(false);
		setIsZooming(false);
		if (scale <= 1) {
			setScale(1);
			setPosition({ x: 0, y: 0 });
		}
	};

	const handleDoubleTap = () => {
		if (scale > 1) {
			setScale(1);
			setPosition({ x: 0, y: 0 });
		} else {
			setScale(2.5);
		}
	};

	const renderTextWithLinks = (text: string) => {
		// Pre-clean: strip "Location" / "location" labels that appear right before a URL
		// e.g. "Location\n(https://maps.app...)" or "Location (https://...)"
		// We remove the label so only the clean button remains.
		let cleaned = text.replace(/Location\s*[\n\r]*\s*\(?(?=https?:\/\/)/gi, "");

		// Also remove orphan parentheses wrapping URLs: "(https://...)" → "https://..."
		cleaned = cleaned.replace(/\((https?:\/\/[^\s)]+)\)/g, "$1");

		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const phoneRegex = /(\b\d{10}\b)/g;
		const parts = cleaned.split(urlRegex);

		return parts.map((part, index) => {
			if (part.match(urlRegex)) {
				// Strip trailing punctuation that got captured as part of the URL
				const url = part.replace(/[).,;:!?]+$/, "");
				const isMapLink =
					url.includes("maps.google") ||
					url.includes("goo.gl/maps") ||
					url.includes("maps.app.goo.gl");
				return (
					<span key={index} className="block my-3">
						<a
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors font-medium shadow-sm active:scale-95"
							onClick={(e) => e.stopPropagation()}
						>
							{isMapLink ? (
								settingsLanguage === "hi" ? (
									"📍 दिशा-निर्देश प्राप्त करें"
								) : (
									"📍 Get Directions"
								)
							) : (
								<>
									<ExternalLink size={18} />{" "}
									{settingsLanguage === "hi" ? "लिंक खोलें" : "Open Link"}
								</>
							)}
						</a>
					</span>
				);
			} else {
				const subParts = part.split(phoneRegex);
				return subParts.map((subPart, subIndex) => {
					if (subPart.match(phoneRegex)) {
						return (
							<span key={`${index}-${subIndex}`} className="block my-3">
								<a
									href={`tel:${subPart}`}
									className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors font-medium shadow-sm active:scale-95"
									onClick={(e) => e.stopPropagation()}
								>
									<Phone size={18} /> {subPart}
								</a>
							</span>
						);
					}
					// Clean up lonely separators: lines that are just commas, dots, etc.
					const trimmed = subPart.trim();
					if (trimmed === "," || trimmed === "." || trimmed === "،") {
						return null;
					}
					return <span key={`${index}-${subIndex}`}>{subPart}</span>;
				});
			}
		});
	};

	const renderSmartAction = (item: InformationItem) => {
		if (!item.actionType || item.actionType === "none") return null;

		let href = item.actionTarget || "#";
		let icon = <ExternalLink size={20} />;
		let colorClass =
			"bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30";

		if (item.actionType === "phone") {
			href = `tel:${item.actionTarget}`;
			icon = <Phone size={20} />;
			colorClass =
				"bg-green-600 hover:bg-green-700 text-white shadow-green-500/30";
		} else if (item.actionType === "location") {
			icon = <MapPin size={20} />;
			colorClass =
				"bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30";
		}

		return (
			<div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center">
				<a
					href={href}
					target={
						item.actionType === "link" || item.actionType === "location"
							? "_blank"
							: "_self"
					}
					rel="noopener noreferrer"
					className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-95 w-full justify-center text-lg ${colorClass}`}
				>
					{icon}
					<span>
						{item.actionLabel ||
							(settingsLanguage === "hi" ? "यहां क्लिक करें" : "Click Here")}
						{item.actionTarget &&
							item.actionType !== "link" &&
							` (${item.actionTarget})`}
					</span>
				</a>
			</div>
		);
	};

	// EMPTY STATE
	if (!data.enabled || items.length === 0) {
		return (
			<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300">
				<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-3 z-10">
					<button
						onClick={onBack}
						className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>
					<h2 className="font-display text-xl font-semibold leading-none drop-shadow-md flex items-center gap-2">
						<Info className="w-6 h-6" />
						{settingsLanguage === "hi" ? "सूचना" : "Information"}
					</h2>
				</div>
				<div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 relative overflow-hidden">
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-ry-gold/10 dark:bg-ry-gold/5 rounded-full blur-3xl"></div>

					<div className="relative">
						<div
							className="absolute inset-0 bg-ry-gold/20 dark:bg-ry-gold/10 rounded-full animate-ping"
							style={{ animationDuration: "3s" }}
						></div>
						<div className="relative w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-ry-cream to-white dark:from-ink-800 dark:to-ink-900 rounded-full flex items-center justify-center shadow-lg border border-ry-gold/30">
							<Info className="w-10 h-10 sm:w-12 sm:h-12 text-ry-gold drop-shadow-sm" />
						</div>
					</div>
					<div className="relative space-y-3 z-10">
						<h3 className="text-2xl font-black text-ry-maroon dark:text-ry-cream">
							{settingsLanguage === "hi"
								? "कोई नई सूचना नहीं"
								: "No New Information"}
						</h3>
						<p className="text-ry-brown/80 dark:text-ry-cream/60 max-w-[280px] mx-auto leading-relaxed text-[15px] font-medium">
							{settingsLanguage === "hi"
								? "वर्तमान में कोई नई सूचना उपलब्ध नहीं है। कृपया बाद में देखें।"
								: "There is currently no new information available. Please check back later."}
						</p>
					</div>
				</div>
			</div>
		);
	}

	// MENU / LIST MODE
	if (!selectedItem) {
		return (
			<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300">
				<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-3 z-10 sticky top-0">
					<button
						onClick={handleBack}
						className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
						data-tour="info-back"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>
					<h2 className="font-display text-xl font-semibold leading-none drop-shadow-md flex items-center gap-2">
						<Info className="w-6 h-6" />
						{settingsLanguage === "hi" ? "सूचना" : "Information"}
					</h2>
				</div>

				<div className="flex-1 overflow-y-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
					<div className="max-w-2xl mx-auto space-y-4">
						{items.map((item, _idx) => {
							const isUnread = !readIds.includes(item.id);
							const firstImage = getImages(item)[0];
							return (
								<div
									key={item.id}
									onClick={() => openItem(item)}
									className="bg-ry-cream dark:bg-ink-800 rounded-3xl p-4 shadow-sm border border-ry-gold/40 flex items-stretch gap-4 cursor-pointer active:scale-[0.98] transition-transform group"
									data-tour="info-item"
								>
									{firstImage && (
										<div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center">
											<CachedImage
												thumbWidth={THUMB.tile}
												src={firstImage}
												className="w-full h-full object-cover"
											/>
										</div>
									)}
									<div className="flex-1 min-w-0 flex flex-col justify-center py-1">
										<div className="flex items-start justify-between gap-2 mb-1.5">
											<h3 className="font-bold text-lg text-slate-800 dark:text-white leading-tight line-clamp-2">
												{item.title}
											</h3>
											{isUnread && (
												<div className="bg-gradient-to-r from-red-600 to-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md shadow-red-500/30 animate-pulse border border-red-400/30 shrink-0 mt-0.5">
													NEW
												</div>
											)}
										</div>
										<p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
											{item.text || "..."}
										</p>

										<div className="mt-3 flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
											{settingsLanguage === "hi" ? "और पढ़ें" : "Read More"}{" "}
											<ChevronRight size={16} />
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		);
	}

	// DETAIL MODE
	const images = getImages(selectedItem);

	return (
		<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300">
			{/* Detail Header */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-10 sticky top-0">
				<div className="flex items-center gap-3">
					<button
						onClick={handleBack}
						className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>
				</div>
				<div className="flex items-center gap-2">
					<button className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1.5">
						<Eye size={18} />
						<span className="text-sm font-medium">
							{interactionStats.viewCount}
						</span>
					</button>
					<button
						onClick={handleShare}
						disabled={isSharing}
						className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all disabled:opacity-50"
					>
						{isSharing ? (
							<Loader2 size={18} className="animate-spin" />
						) : (
							<Share2 size={18} />
						)}
					</button>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
				<div className="max-w-2xl mx-auto space-y-8">
					<div className="space-y-4">
						<h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
							{selectedItem.title}
						</h1>
						<div className="h-1.5 w-16 bg-blue-500 rounded-full"></div>
					</div>

					{/* Image Gallery — Natural Aspect Ratio */}
					{images.length > 0 && (
						<div
							className={`grid gap-3 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
						>
							{images.map((src, index) => (
								<div
									key={index}
									className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/50 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 cursor-zoom-in active:scale-[0.97] transition-transform relative group flex items-center justify-center min-h-[200px]"
									onClick={() => {
										setSelectedImageIndex(index);
										window.history.pushState(
											{ isPopup: true, view: "info-image-zoom" },
											"",
										);
									}}
								>
									<CachedImage
										thumbWidth={THUMB.card}
										src={src}
										alt={`${selectedItem.title} ${index + 1}`}
										className="w-full h-auto max-h-[400px] object-contain block"
									/>
									{images.length > 1 && (
										<div className="absolute top-3 left-3 px-2.5 py-1 bg-black/40 text-white text-xs font-bold rounded-full backdrop-blur-md shadow-sm pointer-events-none z-20">
											{index + 1} / {images.length}
										</div>
									)}
									<button
										onClick={(e) => handleDownload(src, index, e)}
										className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md shadow-sm transition-colors z-20"
										title="Download Image"
									>
										<Download size={18} />
									</button>
								</div>
							))}
						</div>
					)}

					<div className="text-lg text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
						{renderTextWithLinks(selectedItem.text)}
					</div>

					{/* Smart Action Button */}
					{renderSmartAction(selectedItem)}

					{/* Action Buttons */}
					<div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-center gap-4">
						<button
							onClick={handleLike}
							disabled={hasLiked}
							className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-semibold shadow-sm active:scale-95
                    ${
											hasLiked
												? "bg-red-50 dark:bg-red-900/30 text-red-500 border border-red-200 dark:border-red-800"
												: "bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-500"
										}`}
						>
							<Heart size={20} className={hasLiked ? "fill-current" : ""} />
							<span>
								{interactionStats.likeCount}{" "}
								{settingsLanguage === "hi" ? "पसंद" : "Likes"}
							</span>
						</button>
					</div>

					{/* Comments Section */}
					<div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
						<CommentsSection
							itemId={selectedItem.id}
							category="information"
							onOpenProfile={onOpenProfile}
						/>
					</div>
				</div>
			</div>

			{/* Full Screen Image Viewer */}
			{selectedImageIndex !== null && (
				<div className="fixed inset-0 z-[100] bg-black animate-in fade-in flex flex-col">
					<div className="absolute top-0 inset-x-0 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center z-50 bg-gradient-to-b from-black/60 to-transparent">
						<button
							onClick={() => {
								setSelectedImageIndex(null);
								if (window.history.state?.view === "info-image-zoom")
									window.history.back();
							}}
							className="p-2 bg-black/40 text-white rounded-full backdrop-blur-sm hover:bg-black/60 transition-colors"
						>
							<X size={24} />
						</button>
						<div className="flex items-center gap-3 text-white/80">
							<span className="text-sm font-medium bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
								{selectedImageIndex + 1} / {images.length}
							</span>
							<button
								onClick={(e) =>
									handleDownload(
										images[selectedImageIndex],
										selectedImageIndex,
										e,
									)
								}
								className="p-2 bg-black/40 text-white rounded-full backdrop-blur-sm hover:bg-black/60 transition-colors"
								title="Download Image"
							>
								<Download size={20} />
							</button>
						</div>
					</div>

					<div
						className="flex-1 flex items-center justify-center overflow-hidden touch-none"
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
						onDoubleClick={handleDoubleTap}
					>
						<img
							src={images[selectedImageIndex]}
							className="max-w-full max-h-full object-contain transition-transform duration-100 ease-out"
							style={{
								transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
								transformOrigin: "center",
							}}
						/>
					</div>
				</div>
			)}
		</div>
	);
};

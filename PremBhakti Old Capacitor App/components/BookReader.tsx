import { Capacitor } from "@capacitor/core";
import {
	AlertCircle,
	ArrowLeft,
	Bookmark,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Loader2,
	RefreshCw,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { downloadPdfEngine, injectPdfEngine } from "../services/pdfLoader";
import type { Book } from "../types";
import {
	deleteBook,
	getCachedBookSource,
	isBookDownloaded,
} from "../utils/bookStorage";

interface BookReaderProps {
	book: Book;
	onBack: () => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage?: "en" | "hi";
}

// --- Extracted Slider Component to prevent full re-renders ---
const PageSlider = ({
	numPages,
	currentPage,
	onChangePage,
}: {
	numPages: number;
	currentPage: number;
	onChangePage: (page: number) => void;
}) => {
	const [sliderValue, setSliderValue] = useState(currentPage);
	const [isSliding, setIsSliding] = useState(false);

	useEffect(() => {
		setSliderValue(currentPage);
		setIsSliding(false);
	}, [currentPage]);

	const handleRelease = (e: React.SyntheticEvent<HTMLInputElement>) => {
		const newValue = parseInt(e.currentTarget.value, 10);
		onChangePage(newValue);
		if (newValue === currentPage) {
			setIsSliding(false);
		}
	};

	return (
		<>
			{/* Overlay shown only while sliding - Portaled to body to avoid z-index/layout issues */}
			{isSliding &&
				createPortal(
					<div className="fixed inset-0 flex items-center justify-center z-[10000] pointer-events-none">
						<div className="bg-black/70 backdrop-blur-md text-white px-6 py-3 rounded-2xl text-2xl font-bold shadow-xl animate-in zoom-in duration-200">
							Page {sliderValue}
						</div>
					</div>,
					document.body,
				)}

			{/* Slider Control */}
			<div className="px-2 pt-2 flex items-center gap-2 mb-1 w-full justify-center transform-gpu">
				<span className="text-[12px] font-bold text-slate-400 dark:text-ink-400 w-8 text-right">
					{currentPage}
				</span>

				<div className="flex-1 relative h-6 flex items-center max-w-sm w-full mx-2">
					<input
						type="range"
						min="1"
						max={numPages}
						value={sliderValue}
						onChange={(e) => {
							setSliderValue(parseInt(e.target.value, 10));
							setIsSliding(true);
						}}
						onTouchEnd={handleRelease}
						onMouseUp={handleRelease}
						onPointerUp={handleRelease}
						onPointerCancel={() => setIsSliding(false)}
						className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer accent-saffron-500"
					/>
				</div>

				<span className="text-[12px] font-bold text-slate-400 dark:text-ink-400 w-8">
					{numPages}
				</span>
			</div>
		</>
	);
};

export const BookReader: React.FC<BookReaderProps> = ({
	book,
	onBack,
	settingsLanguage = "en",
}) => {
	const { bookmarks, setBookmark, removeBookmark } = useData();
	const { showToast } = useToast();

	// UX-6: Translation map for all previously English-only UI strings
	const t = {
		unableToOpen:
			settingsLanguage === "hi" ? "किताब नहीं खुल पाई" : "Unable to Open Book",
		goBackDownload:
			settingsLanguage === "hi"
				? "वापस जाएं और डाउनलोड करें"
				: "Go Back & Download Again",
		viewOnline: settingsLanguage === "hi" ? "ऑनलाइन देखें" : "View Online",
		cancelGoBack: settingsLanguage === "hi" ? "रद्द करें" : "Cancel & Go Back",
		dlLibRetry:
			settingsLanguage === "hi"
				? "लाइब्रेरी डाउनलोड करें"
				: "Download Library & Retry",
		downloading:
			settingsLanguage === "hi" ? "डाउनलोड हो रहा है..." : "Downloading...",
		openingBook:
			settingsLanguage === "hi" ? "किताब खुल रही है..." : "Opening Book...",
		restoringAccess:
			settingsLanguage === "hi"
				? "बुक एक्सेस रिस्टोर हो रही है..."
				: "Restoring Book Access...",
		redownloading:
			settingsLanguage === "hi"
				? "फ़ाइल फिर से डाउनलोड हो रही है"
				: "Re-downloading book file",
		offlineReader:
			settingsLanguage === "hi" ? "ऑफलाइन रीडर (HD)" : "Offline Reader (HD)",
		resumedFrom: (page: number) =>
			settingsLanguage === "hi"
				? `पेज ${page} से शुरू`
				: `Resumed from page ${page}`,
	};

	// UX-12: Shows resume notification in header subtitle for 3 seconds
	const [resumeLabel, setResumeLabel] = useState<string | null>(null);

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [errorType, setErrorType] = useState<string | null>(null); // To track specific error kind

	// Retry mechanism state
	const [retryTrigger, setRetryTrigger] = useState(0);

	// The load effect must only re-run for a new book or an explicit retry. `t`
	// is rebuilt every render and `bookmarks` changes on every bookmark toggle;
	// as effect deps they destroyed and reloaded the whole PDF on every page turn
	// or zoom (jumping back to the bookmark/page 1). Read them through refs.
	const loadCtxRef = useRef({ t, bookmarks, showToast });
	loadCtxRef.current = { t, bookmarks, showToast };
	const [isFixingEngine, setIsFixingEngine] = useState(false);

	// Auto-migration (Fixing book access) state
	const [isAutoFixing, setIsAutoFixing] = useState(false);
	const [autoFixProgress, setAutoFixProgress] = useState(0);

	const [pdfDoc, setPdfDoc] = useState<any>(null);
	const [pageNum, setPageNum] = useState(1);
	const [numPages, setNumPages] = useState(0);

	const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const renderTaskRef = useRef<any>(null);
	const minScale = useRef(1);

	const isDragging = useRef(false);
	const dragStart = useRef({ x: 0, y: 0 });
	const startTransform = useRef({ x: 0, y: 0 });
	const dragConstraints = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

	const isPinching = useRef(false);
	const pinchStartDist = useRef(0);
	const pinchStartTransform = useRef({ x: 0, y: 0, scale: 1 });
	const pinchCenter = useRef({ x: 0, y: 0 });
	const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
	// Live pinch transform (applied directly to DOM, no re-render during pinch)
	const liveTransformRef = useRef<{
		x: number;
		y: number;
		scale: number;
	} | null>(null);
	const canvasWrapperRef = useRef<HTMLDivElement>(null);

	// D3: On low-memory devices (Realme C, Redmi 9, etc.) the WebView GPU
	// compositor can drop the canvas context under memory pressure — the PDF page
	// goes blank. Listen for this event and trigger a page re-render to recover.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const handleContextLost = (e: Event) => {
			e.preventDefault(); // Allow context restoration
			console.warn(
				"[BookReader] Canvas context lost — will re-render on restore",
			);
		};
		const handleContextRestored = () => {
			console.log("[BookReader] Canvas context restored — re-rendering page");
			setRetryTrigger((prev) => prev + 1);
		};
		canvas.addEventListener("webglcontextlost", handleContextLost);
		canvas.addEventListener("webglcontextrestored", handleContextRestored);
		// 2D context loss fires 'contextlost' (browsers implementing the spec)
		canvas.addEventListener("contextlost", handleContextLost);
		canvas.addEventListener("contextrestored", handleContextRestored);
		return () => {
			canvas.removeEventListener("webglcontextlost", handleContextLost);
			canvas.removeEventListener("webglcontextrestored", handleContextRestored);
			canvas.removeEventListener("contextlost", handleContextLost);
			canvas.removeEventListener("contextrestored", handleContextRestored);
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const isBookmarked = bookmarks[book.id] === pageNum;

	// biome-ignore lint/correctness/useExhaustiveDependencies: only a new book or an explicit retry may reload the PDF (see loadCtxRef)
	useEffect(() => {
		let active = true;
		let loadingTask: any = null;
		let blobUrl: string | null = null; // R2: track blob URL for revocation on cleanup
		let autoFixAbort: AbortController | null = null; // R3: cancel auto-fix if user navigates away

		const loadPdf = async () => {
			setIsLoading(true);
			setError(null);
			setErrorType(null);

			try {
				// Enforce Offline Reading Only
				if (!isBookDownloaded(book.id)) {
					throw new Error("NOT_DOWNLOADED");
				}

				// 1. Inject Engine from DB if needed
				try {
					await injectPdfEngine();
				} catch (_e) {
					throw new Error("ENGINE_LOAD_FAILED");
				}

				// Access the global PDF.js library (now injected)
				const pdfjsLib = (window as any).pdfjsLib;

				if (!pdfjsLib) {
					throw new Error("ENGINE_NOT_READY");
				}

				// 2. Load Book from Cache / Local Storage
				const source = await getCachedBookSource(book.id, book.title);
				let docOptions: any = null;

				if (source) {
					if (source.url?.startsWith("blob:")) blobUrl = source.url;
					if (source.data) {
						docOptions = { data: source.data };
					} else if (source.url) {
						docOptions = {
							url: source.url,
							disableRange: true,
							disableStream: true,
						};
					}
				} else if (
					Capacitor.getPlatform() === "web" &&
					typeof caches === "undefined"
				) {
					// Fallback for local development over HTTP where caches is not available
					let cachedUrl = book.url;
					if (cachedUrl) {
						const { getDirectPdfUrl } = await import("../utils/bookStorage");
						cachedUrl = getDirectPdfUrl(cachedUrl);
						docOptions = { url: cachedUrl };
					}
				}

				if (!docOptions) {
					throw new Error("CACHE_MISS");
				}

				loadingTask = pdfjsLib.getDocument(docOptions);
				const pdf = await loadingTask.promise;

				if (active) {
					setPdfDoc(pdf);
					setNumPages(pdf.numPages);

					// Check bookmark
					const { t, bookmarks, showToast } = loadCtxRef.current;
					const savedPage = bookmarks[book.id];
					if (savedPage && savedPage > 0 && savedPage <= pdf.numPages) {
						setPageNum(savedPage);
						// UX-12: Show resume notification in header (not just fleeting toast)
						const label = t.resumedFrom(savedPage);
						showToast(label, "info");
						setResumeLabel(label);
						setTimeout(() => setResumeLabel(null), 3000);
					} else {
						setPageNum(1);
					}

					setIsLoading(false);
				}
			} catch (err: any) {
				if (active) {
					console.error("PDF Load Error:", err);

					// Check for corruption errors
					const isCorrupt =
						err.name === "MissingPDFException" ||
						err.name === "InvalidPDFException" ||
						err.message?.includes("Invalid PDF structure") ||
						err.message?.includes("Invalid PDF");

					if (
						err.message === "NOT_DOWNLOADED" ||
						err.message === "CACHE_MISS"
					) {
						if (err.message === "CACHE_MISS" && isBookDownloaded(book.id)) {
							// MIGRATION: The book is marked as downloaded but the file is missing
							// or inaccessible (due to Android 11+ scoped storage or deletion).
							// Instead of showing an error, auto-redownload it quietly
							setIsAutoFixing(true);
							setIsLoading(true);
							setError(null);

							try {
								// R3: AbortController lets us cancel the download if
								// the user navigates away (unmounts) mid-fix.
								autoFixAbort = new AbortController();
								// Dynamically import saveBook to avoid circular dependencies if any
								const { saveBook } = await import("../utils/bookStorage");
								const success = await saveBook(
									book,
									(pct) => {
										if (active)
											setAutoFixProgress(Math.min(99, Math.round(pct)));
									},
									autoFixAbort.signal,
								);

								if (!active) return; // R3: unmounted during auto-fix
								if (success) {
									// Redownload finished, retry loading the PDF
									setIsAutoFixing(false);
									setRetryTrigger((prev) => prev + 1);
									return; // exit current load attempt
								} else {
									throw new Error("AUTO_FIX_FAILED");
								}
							} catch (e: any) {
								if (!active) return; // R3: unmounted during auto-fix
								if (e?.name === "AbortError") return; // R3: user navigated away cleanly
								setIsAutoFixing(false);
								await deleteBook(book.id, book.title);
								setError(
									"Book file could not be accessed or re-downloaded. Please go back and try later.",
								);
								setErrorType("DOWNLOAD");
							}
						} else {
							setError(
								"Book file not found. Please go back and download it again.",
							);
							setErrorType("DOWNLOAD");
						}
					} else if (
						err.message === "ENGINE_LOAD_FAILED" ||
						err.message === "ENGINE_NOT_READY"
					) {
						setError("PDF Viewer Library is missing or corrupted.");
						setErrorType("ENGINE");
					} else if (isCorrupt) {
						// Crucial: Delete the bad file so the user can try again
						await deleteBook(book.id, book.title);
						setError(
							"Download corrupted. File has been deleted. Please download again.",
						);
						setErrorType("DOWNLOAD");
					} else {
						setError(`Unexpected Error: ${err.message || "Unknown"}`);
						setErrorType("UNKNOWN");
					}
					setIsLoading(false);
				}
			}
		};

		loadPdf();

		return () => {
			active = false;
			// R3: Cancel any in-progress auto-fix download so saveBook doesn't
			// update state on an unmounted component (triggered by back navigation).
			if (autoFixAbort) {
				autoFixAbort.abort();
				autoFixAbort = null;
			}
			if (loadingTask) {
				try {
					loadingTask.destroy();
				} catch (_e) {}
			}
			// R2: Revoke the blob URL to free WebView memory.
			// Each uncleaned blob URL holds 15–80 MB in the WebView heap.
			if (blobUrl) {
				URL.revokeObjectURL(blobUrl);
				blobUrl = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- see loadCtxRef
	}, [book.id, book.url, book.title, retryTrigger]);

	const handleFixAndRetry = async () => {
		if (errorType === "ENGINE") {
			setIsFixingEngine(true);
			try {
				await downloadPdfEngine();
				setRetryTrigger((prev) => prev + 1); // Trigger re-render
			} catch (e) {
				console.error(e);
				showToast(
					"Failed to download library. Please check your internet connection.",
					"error",
				);
			} finally {
				setIsFixingEngine(false);
			}
		} else {
			// Generic retry
			setRetryTrigger((prev) => prev + 1);
		}
	};

	const handleToggleBookmark = () => {
		if (isBookmarked) {
			removeBookmark(book.id);
		} else {
			setBookmark(book.id, pageNum);
		}
	};

	const renderPage = useCallback(async () => {
		if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

		if (renderTaskRef.current) {
			try {
				renderTaskRef.current.cancel();
			} catch (_e) {}
		}

		try {
			const page = await pdfDoc.getPage(pageNum);
			const containerWidth = containerRef.current.clientWidth;

			// 1. Get Device Pixel Ratio (DPR) for sharp text
			const dpr = window.devicePixelRatio || 1;

			// 2. Calculate Scale
			// Reduced quality factor to 1.5 to prevent memory spikes causing UI to disappear/flicker
			const qualityFactor = 1.5;

			// Get unscaled dimensions
			const unscaledViewport = page.getViewport({ scale: 1 });

			// Calculate the scale needed to fill the screen *at high DPI*
			const fitScale = (containerWidth - 10) / unscaledViewport.width;

			// Target render scale combining fit, dpr, and extra quality
			let renderScale = fitScale * dpr * qualityFactor;

			// 3. Safety Cap for Texture Size
			// Lowering max dimension to 3000 to prevent mobile GPU compositor dropping layers
			const maxDimension = 3000;
			const proposedViewport = page.getViewport({ scale: renderScale });

			if (
				proposedViewport.width > maxDimension ||
				proposedViewport.height > maxDimension
			) {
				const ratio = Math.min(
					maxDimension / proposedViewport.width,
					maxDimension / proposedViewport.height,
				);
				renderScale = renderScale * ratio;
			}

			const viewport = page.getViewport({ scale: renderScale });
			const canvas = canvasRef.current;
			const context = canvas.getContext("2d");

			if (canvas && context) {
				canvas.height = viewport.height;
				canvas.width = viewport.width;

				// 4. Calculate Visual CSS Scale (Transform)
				// Fit the WHOLE page (width and height): fitting width only pushed the
				// top/bottom of tall pages out of view. Zoom in to read closer.
				const containerHeight = containerRef.current.clientHeight;
				const startVisualScale = Math.min(
					(containerWidth - 10) / viewport.width,
					(containerHeight - 10) / viewport.height,
				);

				minScale.current = startVisualScale;

				// Center visually on both axes
				const x = (containerWidth - viewport.width * startVisualScale) / 2;
				const y = (containerHeight - viewport.height * startVisualScale) / 2;

				setTransform({ x, y, scale: startVisualScale });

				const renderContext = { canvasContext: context, viewport: viewport };
				const renderTask = page.render(renderContext);
				renderTaskRef.current = renderTask;
				await renderTask.promise;
			}
		} catch (err: any) {
			if (err.name !== "RenderingCancelledException") {
				console.error("Render Error:", err);
			}
		}
	}, [pdfDoc, pageNum]);

	useEffect(() => {
		renderPage();
	}, [renderPage]);

	const changePage = (newPage: number) => {
		const p = Math.max(1, Math.min(numPages, newPage));
		if (p !== pageNum) setPageNum(p);
	};

	// --- Interaction Handlers ---
	const handlePointerDown = (e: React.PointerEvent) => {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		if (isPinching.current || !containerRef.current) return;
		isDragging.current = true;
		dragStart.current = { x: e.clientX, y: e.clientY };
		startTransform.current = { x: transform.x, y: transform.y };

		const cw = containerRef.current.clientWidth;
		const ch = containerRef.current.clientHeight;
		const sw = canvasRef.current?.width * transform.scale;
		const sh = canvasRef.current?.height * transform.scale;

		if (sw > cw) {
			dragConstraints.current.minX = cw - sw;
			dragConstraints.current.maxX = 0;
		} else {
			const cx = (cw - sw) / 2;
			dragConstraints.current.minX = cx;
			dragConstraints.current.maxX = cx;
		}

		if (sh > ch) {
			dragConstraints.current.minY = ch - sh;
			dragConstraints.current.maxY = 0;
		} else {
			const cy = (ch - sh) / 2;
			dragConstraints.current.minY = cy;
			dragConstraints.current.maxY = cy;
		}

		(e.target as Element).setPointerCapture(e.pointerId);
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!isDragging.current || isPinching.current) return;
		const dx = e.clientX - dragStart.current.x;
		const dy = e.clientY - dragStart.current.y;
		setTransform((prev) => ({
			...prev,
			x: Math.min(
				Math.max(startTransform.current.x + dx, dragConstraints.current.minX),
				dragConstraints.current.maxX,
			),
			y: Math.min(
				Math.max(startTransform.current.y + dy, dragConstraints.current.minY),
				dragConstraints.current.maxY,
			),
		}));
	};

	const handlePointerUp = (e: React.PointerEvent) => {
		isDragging.current = false;
		try {
			(e.target as Element).releasePointerCapture(e.pointerId);
		} catch (_e) {}
	};

	const getTouchDistance = (touches: React.TouchList) =>
		Math.hypot(
			touches[0].clientX - touches[1].clientX,
			touches[0].clientY - touches[1].clientY,
		);

	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length === 1) {
			touchStartRef.current = {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY,
				time: Date.now(),
			};
		}
		if (e.touches.length === 2 && containerRef.current) {
			isPinching.current = true;
			isDragging.current = false;
			pinchStartDist.current = getTouchDistance(e.touches);
			pinchStartTransform.current = { ...transform };

			const rect = containerRef.current.getBoundingClientRect();
			const touch1 = e.touches[0];
			const touch2 = e.touches[1];
			const cx = (touch1.clientX + touch2.clientX) / 2;
			const cy = (touch1.clientY + touch2.clientY) / 2;

			pinchCenter.current = {
				x: cx - rect.left,
				y: cy - rect.top,
			};
		}
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (e.touches.length === 2 && isPinching.current) {
			e.preventDefault();

			// Add small threshold to prevent micro-jitter during pinch
			const dist = getTouchDistance(e.touches);
			if (Math.abs(dist - pinchStartDist.current) < 2) return;

			const factor = dist / pinchStartDist.current;
			const start = pinchStartTransform.current;
			const center = pinchCenter.current;

			const newScale = Math.max(
				minScale.current,
				Math.min(start.scale * factor, minScale.current * 8.0),
			);
			const scaleRatio = newScale / start.scale;
			const newX = center.x - (center.x - start.x) * scaleRatio;
			const newY = center.y - (center.y - start.y) * scaleRatio;

			const t = {
				x: Math.round(newX * 10) / 10,
				y: Math.round(newY * 10) / 10,
				scale: Math.round(newScale * 100) / 100,
			};

			// Apply directly to DOM (no React re-render = no flicker)
			liveTransformRef.current = t;
			if (canvasWrapperRef.current) {
				canvasWrapperRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
			}
		}
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		if (e.touches.length < 2 && isPinching.current) {
			isPinching.current = false;
			// Commit live pinch transform to React state (single re-render on finger lift)
			if (liveTransformRef.current) {
				const t = liveTransformRef.current;
				liveTransformRef.current = null;
				// Apply bounds
				if (containerRef.current && canvasRef.current) {
					const cw = containerRef.current.clientWidth;
					const ch = containerRef.current.clientHeight;
					const sw = canvasRef.current.width * t.scale;
					const sh = canvasRef.current.height * t.scale;
					let { x, y } = t;
					if (sw <= cw) x = (cw - sw) / 2;
					else {
						if (x > 0) x = 0;
						if (x < cw - sw) x = cw - sw;
					}
					if (sh <= ch) y = (ch - sh) / 2;
					else {
						if (y > 0) y = 0;
						if (y < ch - sh) y = ch - sh;
					}
					setTransform({ ...t, x, y });
				} else {
					setTransform(t);
				}
			}
		}

		// UX-4: Swipe-left → next page, swipe-right → previous page.
		// Only fires when: single finger, not a pinch, fast enough (<300ms),
		// moved far enough horizontally (>60px), and didn't move much vertically
		// (so it doesn't fight with scrolling / pan gestures).
		if (e.changedTouches.length === 1 && !isPinching.current) {
			const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
			const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
			const dt = Date.now() - touchStartRef.current.time;
			if (Math.abs(dx) > 60 && Math.abs(dy) < 40 && dt < 300) {
				changePage(pageNum + (dx < 0 ? 1 : -1));
			}
		}

		if (e.touches.length < 2) isPinching.current = false;
	};

	// Bounds Checking & Centering Effect — only runs on page change, not during pinch
	useEffect(() => {
		if (!containerRef.current || !canvasRef.current) return;
		if (isPinching.current) return; // skip during live pinch
		setTransform((prev) => {
			const cw = containerRef.current?.clientWidth;
			const ch = containerRef.current?.clientHeight;
			const sw = canvasRef.current?.width * prev.scale;
			const sh = canvasRef.current?.height * prev.scale;
			let { x, y } = prev;

			// Center horizontally if smaller than container, else clamp
			if (sw <= cw) x = (cw - sw) / 2;
			else {
				if (x > 0) x = 0;
				if (x < cw - sw) x = cw - sw;
			}

			// Center vertically if smaller than container, else clamp
			if (sh <= ch) y = (ch - sh) / 2;
			else {
				if (y > 0) y = 0;
				if (y < ch - sh) y = ch - sh;
			}

			return { ...prev, x, y };
		});
	}, []);

	const zoomIn = () => {
		setTransform((prev) => {
			if (!containerRef.current) return prev;
			const cw = containerRef.current.clientWidth;
			const ch = containerRef.current.clientHeight;
			// Zoom towards center of container
			const cx = cw / 2;
			const cy = ch / 2;

			const newScale = Math.min(prev.scale * 1.5, minScale.current * 8);
			if (newScale === prev.scale) return prev;

			const factor = newScale / prev.scale;
			const newX = cx - (cx - prev.x) * factor;
			const newY = cy - (cy - prev.y) * factor;

			return { x: newX, y: newY, scale: newScale };
		});
	};

	const zoomOut = () => {
		setTransform((prev) => {
			if (!containerRef.current) return prev;
			const cw = containerRef.current.clientWidth;
			const ch = containerRef.current.clientHeight;
			const cx = cw / 2;
			const cy = ch / 2;

			const newScale = Math.max(prev.scale / 1.5, minScale.current);
			if (newScale === prev.scale) return prev;

			const factor = newScale / prev.scale;
			const newX = cx - (cx - prev.x) * factor;
			const newY = cy - (cy - prev.y) * factor;

			return { x: newX, y: newY, scale: newScale };
		});
	};

	return (
		<div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col landscape:flex-col animate-in slide-in-from-right duration-300">
			{/* Header (Top in Portrait, Left in Landscape) */}
			<div
				className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-2 pt-[calc(0.5rem+env(safe-area-inset-top))] flex items-center gap-2 relative shadow-sm transform-gpu"
				style={{ zIndex: 1000 }}
			>
				<button
					onClick={onBack}
					className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
				>
					<ArrowLeft size={24} className="text-slate-700 dark:text-slate-200" />
				</button>

				<div className="flex-1 min-w-0 text-center">
					<h2 className="font-bold text-slate-800 dark:text-white truncate text-base">
						{book.title}
					</h2>
					{/* UX-12: Show resume label for 3s on load, then fall back to static caption */}
					<p
						className={`text-[10px] truncate font-mono uppercase tracking-wider font-bold transition-colors duration-300 ${
							resumeLabel
								? "text-saffron-500 dark:text-saffron-400"
								: "text-green-600 dark:text-green-400"
						}`}
					>
						{resumeLabel ?? t.offlineReader}
					</p>
				</div>

				{/* Bookmark Button — UX-10: wrapped in a div so disabled taps
                     still produce a toast on mobile (disabled buttons swallow events) */}
				<div
					onClick={() => {
						if (isLoading || error) {
							showToast(
								settingsLanguage === "hi"
									? "किताब अभी लोड हो रही है, थोड़ा रुकें"
									: "Book is still loading, please wait",
								"info",
							);
						}
					}}
					className="relative"
				>
					<button
						onClick={handleToggleBookmark}
						className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
						disabled={isLoading || !!error}
						title="Bookmark"
						data-tour="book-bookmark"
					>
						<Bookmark
							size={22}
							className={
								isBookmarked
									? "fill-current text-saffron-500"
									: "text-slate-400 dark:text-slate-500"
							}
						/>
					</button>
				</div>
			</div>

			{/* Main Canvas Area */}
			<div
				ref={containerRef}
				className="flex-1 relative bg-slate-100 dark:bg-black w-full h-full overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing z-10"
				style={{ clipPath: "inset(0)" }}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerUp}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onTouchCancel={handleTouchEnd}
			>
				{isLoading && !error && (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-ink-400 z-10 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
						<Loader2 className="w-10 h-10 text-saffron-500 animate-spin mb-4" />
						<p className="text-sm font-medium text-slate-700 dark:text-slate-300">
							{isAutoFixing ? t.restoringAccess : t.openingBook}
						</p>
						{isAutoFixing && (
							<>
								{/* UX-5: Show % + explanation so user knows what's downloading */}
								<p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
									{t.redownloading} • {autoFixProgress}%
								</p>
								<div className="w-48 h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
									<div
										className="h-full bg-saffron-500 transition-all duration-300"
										style={{ width: `${autoFixProgress}%` }}
									/>
								</div>
							</>
						)}
					</div>
				)}

				{error && (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-ink-400 z-10 px-8 text-center bg-slate-50 dark:bg-slate-900">
						<div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4">
							<AlertCircle size={32} />
						</div>

						<p className="text-slate-800 dark:text-white font-bold mb-2 text-lg">
							{t.unableToOpen}
						</p>
						<p className="text-sm mb-8 max-w-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
							{error}
						</p>

						<div className="flex flex-col gap-3 w-full max-w-xs">
							{errorType === "ENGINE" && (
								<button
									onClick={handleFixAndRetry}
									disabled={isFixingEngine}
									className="bg-saffron-500 hover:bg-saffron-600 text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
								>
									{isFixingEngine ? (
										<>
											<Loader2 size={18} className="animate-spin" />
											{t.downloading}
										</>
									) : (
										<>
											<RefreshCw size={18} />
											{t.dlLibRetry}
										</>
									)}
								</button>
							)}

							{errorType === "DOWNLOAD" && (
								<button
									onClick={onBack}
									className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
								>
									{t.goBackDownload}
								</button>
							)}

							{book.url && errorType !== "ENGINE" && (
								<button
									onClick={() =>
										window.open(book.url, "_blank", "noopener,noreferrer")
									}
									className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 px-6 py-3.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700"
								>
									<ExternalLink size={16} /> {t.viewOnline}
								</button>
							)}

							{errorType !== "DOWNLOAD" && (
								<button
									onClick={onBack}
									className="text-slate-500 dark:text-slate-400 px-6 py-3 text-sm font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
								>
									{t.cancelGoBack}
								</button>
							)}
						</div>
					</div>
				)}

				<div
					ref={canvasWrapperRef}
					style={{
						transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
						transformOrigin: "0 0",
						willChange: "transform",
						position: "absolute",
						top: 0,
						left: 0,
					}}
				>
					<canvas ref={canvasRef} className="shadow-2xl bg-white" />
				</div>
			</div>

			{/* Bottom Control Bar */}
			<div
				className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 pb-[calc(0.2rem+env(safe-area-inset-bottom))] relative flex flex-col p-2 gap-2 transform-gpu transition-opacity duration-300"
				style={{
					zIndex: 1000,
					...(isLoading || error
						? { opacity: 0, pointerEvents: "none" }
						: { opacity: 1, pointerEvents: "auto" }),
				}}
			>
				<div className="flex-1 w-full flex justify-center" data-tour="book-slider">
					<PageSlider
						numPages={numPages}
						currentPage={pageNum}
						onChangePage={changePage}
					/>
				</div>

				<div className="flex items-center justify-between px-2 gap-4">
					{/* Prev/Next */}
					<div
						className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 h-10 w-24 transform-gpu"
						data-tour="book-pages"
					>
						<button
							onClick={() => changePage(pageNum - 1)}
							disabled={pageNum <= 1}
							className="flex-1 h-full px-4 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 rounded-md disabled:opacity-30 transition-all active:scale-95"
						>
							<ChevronLeft
								size={18}
								className="text-slate-700 dark:text-slate-300"
							/>
						</button>
						<div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
						<button
							onClick={() => changePage(pageNum + 1)}
							disabled={pageNum >= numPages}
							className="flex-1 h-full px-4 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 rounded-md disabled:opacity-30 transition-all active:scale-95"
						>
							<ChevronRight
								size={18}
								className="text-slate-700 dark:text-slate-300"
							/>
						</button>
					</div>

					{/* Zoom Controls */}
					<div
						className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 h-10 transform-gpu"
						data-tour="book-zoom"
					>
						<button
							onClick={zoomOut}
							disabled={transform.scale <= minScale.current * 1.01}
							className="flex-1 h-full px-3 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 rounded-md disabled:opacity-30 transition-all active:scale-95"
						>
							<ZoomOut
								size={16}
								className="text-slate-700 dark:text-slate-300"
							/>
						</button>
						<div className="px-2 min-w-[3rem] text-center">
							<span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
								{Math.round((transform.scale / minScale.current) * 100)}%
							</span>
						</div>
						<button
							onClick={zoomIn}
							className="flex-1 h-full px-3 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all active:scale-95"
						>
							<ZoomIn
								size={16}
								className="text-slate-700 dark:text-slate-300"
							/>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

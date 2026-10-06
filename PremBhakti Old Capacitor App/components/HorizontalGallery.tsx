import { Download, Eye, Heart, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { THUMB } from "../utils/imageThumb";
import { CachedImage } from "./CachedImage";

interface HorizontalGalleryProps {
	items: any[];
	getMetrics: (id: string) => any;
	hasLiked: (id: string) => boolean;
	openStory: (index: number) => void;
	handlePhotoDownload: (e: React.MouseEvent, item: any, index?: number) => void;
	downloadingId: string | null;
	/**
	 * Optional view-tracking ref factory (see hooks/useViewTracker). Optional so
	 * this component keeps working unchanged anywhere it is used without one.
	 */
	trackView?: (id: string) => (el: HTMLElement | null) => void;
}

export const HorizontalGallery: React.FC<HorizontalGalleryProps> = ({
	items,
	getMetrics,
	hasLiked,
	openStory,
	handlePhotoDownload,
	downloadingId,
	trackView,
}) => {
	const [activeIndex, setActiveIndex] = useState(0);
	const [heights, setHeights] = useState<Record<number, number>>({});
	const containerRef = useRef<HTMLDivElement>(null);

	// Reset when items change
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setActiveIndex(0);
		setHeights({});
		if (containerRef.current) {
			containerRef.current.scrollLeft = 0;
		}
	}, [items]);

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const scrollLeft = e.currentTarget.scrollLeft;
		const width = e.currentTarget.clientWidth;
		if (width === 0) return;
		const index = Math.round(scrollLeft / width);
		if (index !== activeIndex) {
			setActiveIndex(index);
		}
	};

	const activeHeight = heights[activeIndex] || "auto";

	return (
		<div className="w-full relative mb-4">
			<div
				className="transition-all duration-300 ease-out overflow-hidden"
				style={{ height: activeHeight !== "auto" ? activeHeight + 20 : "auto" }} // padding
			>
				<div
					ref={containerRef}
					className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide items-start"
					onScroll={handleScroll}
				>
					{items.map((item, index) => {
						const metrics = getMetrics(item.id);
						return (
							<div
								key={item.id}
								ref={trackView ? trackView(item.id) : undefined}
								className="min-w-full w-full shrink-0 snap-center px-1 pb-4"
							>
								<div
									ref={(el) => {
										if (el && heights[index] === undefined) {
											const h = el.getBoundingClientRect().height;
											setHeights((prev) => ({ ...prev, [index]: h }));
										}
									}}
									className="rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex flex-col cursor-pointer active:scale-95 transition-transform relative"
									onClick={() => openStory(index)}
								>
									<div className="relative">
										<CachedImage
											thumbWidth={THUMB.card}
											src={item.url}
											alt={item.displayName}
											loading="lazy"
											className="w-full h-auto md:max-h-[70vh] object-contain bg-slate-100 dark:bg-slate-900"
											onLoad={(e) => {
												const el = e.currentTarget.closest(".rounded-xl");
												if (el) {
													const h = el.getBoundingClientRect().height;
													setHeights((prev) =>
														prev[index] !== h ? { ...prev, [index]: h } : prev,
													);
												}
											}}
										/>
										<div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
										<div className="absolute bottom-2 left-2 flex gap-3 text-white text-xs font-medium drop-shadow-md z-10 pointer-events-none">
											<span className="flex items-center gap-1">
												<Eye size={12} className="opacity-90" />{" "}
												{metrics.views || 0}
											</span>
											<span className="flex items-center gap-1">
												<Heart
													size={12}
													className={
														hasLiked(item.id)
															? "fill-red-500 text-red-500"
															: "opacity-90"
													}
												/>{" "}
												{metrics.likes || 0}
											</span>
										</div>
									</div>
									<button
										onClick={(e) => handlePhotoDownload(e, item, index)}
										disabled={downloadingId === item.id}
										className="absolute top-2 right-2 bg-black/40 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm transition-all z-10 disabled:opacity-50"
										title="Download photo"
									>
										{downloadingId === item.id ? (
											<Loader2 size={14} className="animate-spin" />
										) : (
											<Download size={14} />
										)}
									</button>
									<div className="absolute top-2 left-2 bg-black/40 text-white px-2 py-1 rounded-md backdrop-blur-sm text-[10px] font-bold z-10 pointer-events-none">
										{index + 1} / {items.length}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{items.length > 1 && (
				<div className="flex justify-center gap-1.5 mt-2 flex-wrap px-4">
					{items.map((_, idx) => (
						<div
							key={idx}
							className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeIndex ? "w-4 bg-rose-500 dark:bg-rose-400" : "w-1.5 bg-slate-300 dark:bg-slate-600"}`}
						/>
					))}
				</div>
			)}
		</div>
	);
};

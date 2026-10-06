import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import type { BannerConfig } from "../types";
import { Banner } from "./Banner";

interface BannerContainerProps {
	onAction: (config: BannerConfig) => void;
	isActive?: boolean;
}

export const BannerContainer: React.FC<BannerContainerProps> = ({
	onAction,
	isActive = true,
}) => {
	const { banners } = useSettings();
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
		try {
			const stored = sessionStorage.getItem("dismissedBanners");
			if (stored) {
				return new Set(JSON.parse(stored));
			}
		} catch (e) {
			console.error("Error loading dismissed banners from session storage", e);
		}
		return new Set();
	});
	const [currentIndex, setCurrentIndex] = useState(0);
	const [delay, setDelay] = useState(3000);
	const [isVisible, setIsVisible] = useState(true);
	const containerRef = useRef<HTMLDivElement>(null);

	// Use banners directly - already filtered by SettingsContext
	const visibleBanners = React.useMemo(() => {
		return banners.filter((b) => !dismissedIds.has(b.id));
	}, [banners, dismissedIds]);

	const handleClose = (id: string) => {
		setDismissedIds((prev) => {
			const newSet = new Set(prev).add(id);
			try {
				sessionStorage.setItem(
					"dismissedBanners",
					JSON.stringify(Array.from(newSet)),
				);
			} catch (e) {
				console.error("Error saving dismissed banners to session storage", e);
			}
			return newSet;
		});
	};

	// Intersection Observer to detect if the banner is visible
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		const currentContainer = containerRef.current;
		if (!currentContainer) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsVisible(entry.isIntersecting);
			},
			{ threshold: 0.1 },
		);

		observer.observe(currentContainer);

		return () => {
			observer.unobserve(currentContainer);
			observer.disconnect();
		};
	}, [visibleBanners.length]);

	// Auto-rotate carousel
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (visibleBanners.length <= 1 || !isVisible || !isActive) return;

		const timer = setTimeout(() => {
			setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
			setDelay(3000); // Reset back to default after an auto-slide
		}, delay);

		return () => clearTimeout(timer);
	}, [visibleBanners.length, isVisible, isActive, currentIndex, delay]);

	const handlePrev = () => {
		setDelay(5000);
		setCurrentIndex(
			(prev) => (prev - 1 + visibleBanners.length) % visibleBanners.length,
		);
	};

	const handleNext = () => {
		setDelay(5000);
		setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
	};

	if (visibleBanners.length === 0) return null; // Single banner - simple display
	if (visibleBanners.length === 1) {
		return (
			<div
				ref={containerRef}
				className="w-full px-3 flex flex-col items-center gap-2 py-2 animate-in fade-in slide-in-from-top-4 duration-300"
			>
				<div className="w-full relative group">
					<div className="relative w-full rounded-2xl overflow-hidden shadow-lg border-[1.5px] border-ry-gold/60 bg-ry-cream dark:bg-ink-800">
						<Banner
							config={visibleBanners[0]}
							onClose={() => handleClose(visibleBanners[0].id)}
							onAction={onAction}
						/>
					</div>
				</div>
			</div>
		);
	}

	// Multiple banners - carousel mode
	const _currentBanner = visibleBanners[currentIndex];

	return (
		<div
			ref={containerRef}
			className="w-full px-2 flex flex-col items-center gap-2 py-2 animate-in fade-in slide-in-from-top-4 duration-300"
		>
			{/* Container with Flex layout for Banner and Arrows */}
			<div className="w-full flex items-center justify-between gap-1.5">
				{/* Left Arrow */}
				<button
					onClick={handlePrev}
					className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
					aria-label="Previous banner"
				>
					<ChevronLeft size={22} />
				</button>

				{/* Banner Area */}
				<div className="flex-1 relative group w-full min-w-0 [perspective:1000px]">
					<div className="relative w-full rounded-2xl overflow-hidden shadow-lg border-[1.5px] border-ry-gold/60 bg-transparent transition-all duration-300 ease-in-out [transform-style:preserve-3d]">
						{visibleBanners.map((banner, idx) => {
							const isActive = idx === currentIndex;
							return (
								<div
									key={banner.id}
									className={`w-full h-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] [backface-visibility:hidden] ${
										isActive
											? "relative z-10 opacity-100 [transform:rotateY(0deg)]"
											: "absolute inset-0 z-0 pointer-events-none opacity-0 [transform:rotateY(180deg)]"
									}`}
								>
									<Banner
										config={banner}
										onClose={() => handleClose(banner.id)}
										onAction={onAction}
									/>
								</div>
							);
						})}
					</div>
				</div>

				{/* Right Arrow */}
				<button
					onClick={handleNext}
					className="p-1 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
					aria-label="Next banner"
				>
					<ChevronRight size={22} />
				</button>
			</div>

			{/* Dot Indicators */}
			<div className="flex justify-center gap-2 mt-1.5 relative z-20">
				{visibleBanners.map((_, idx) => (
					<button
						key={idx}
						onClick={() => {
							setDelay(5000);
							setCurrentIndex(idx);
						}}
						className={`w-2 h-2 rounded-full transition-all ${
							idx === currentIndex
								? "bg-ry-gold w-8"
								: "bg-ry-gold/30 hover:bg-ry-gold/60"
						}`}
						aria-label={`Go to banner ${idx + 1}`}
					/>
				))}
			</div>
		</div>
	);
};

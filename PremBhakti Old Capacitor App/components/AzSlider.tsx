import type React from "react";
import { createPortal } from "react-dom";

interface AzSliderProps {
	sortedKeys: string[];
	onSelect: (key: string) => void;
	indexMode: "latin" | "devanagari";
	onToggleMode: () => void;
	side?: "left" | "right";
}

export const AzSlider: React.FC<AzSliderProps> = ({
	sortedKeys,
	onSelect,
	indexMode,
	onToggleMode,
	side = "left",
}) => {
	if (sortedKeys.length === 0) return null;

	// Rendered into <body>, not inside the list: the tab wrapper in App.tsx
	// slides in with a CSS transform, and a transformed parent makes a
	// `fixed` child position itself against that parent instead of the
	// screen. The bar used to appear in the wrong place for the 0.35 s slide
	// and then jump into position.
	return createPortal(
		<div
			className={`fixed top-[calc(6.75rem+env(safe-area-inset-top))] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] landscape:top-[env(safe-area-inset-top)] landscape:bottom-[env(safe-area-inset-bottom)] z-20 flex flex-col items-start pointer-events-none ${side === "left" ? "left-2 landscape:left-[16rem]" : "right-2 landscape:right-20 items-end"}`}
		>
			<div
				className={`h-full w-8 bg-saffron-50/95 dark:bg-slate-800/95 backdrop-blur-md shadow-md border border-saffron-200 dark:border-slate-700 flex flex-col pointer-events-auto overflow-hidden rounded-2xl ${side === "left" ? "" : ""}`}
				data-tour="bhajans-az"
			>
				{/* Switches the letters between English (A–Z) and Hindi (अ–ज्ञ).
				    Shows the script it switches TO, as the original bar did. */}
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onToggleMode();
					}}
					data-tour="bhajans-az-toggle"
					aria-label={
						indexMode === "latin"
							? "Switch to Hindi letters"
							: "Switch to English letters"
					}
					title={
						indexMode === "latin"
							? "Switch to Hindi letters"
							: "Switch to English letters"
					}
					className="flex-none h-8 w-full flex items-center justify-center bg-saffron-500 hover:bg-saffron-600 active:bg-saffron-600 text-white font-bold text-base shadow-sm z-10 transition-colors border-b border-saffron-600 select-none"
				>
					<span className={indexMode === "latin" ? "mt-0.5" : ""}>
						{indexMode === "latin" ? "अ" : "A"}
					</span>
				</button>
				{indexMode === "latin" ? (
					<div className="flex-1 flex flex-col py-1 overflow-hidden">
						{sortedKeys.map((key) => (
							<button
								key={key}
								onClick={(e) => {
									e.stopPropagation();
									onSelect(key);
								}}
								className="flex-1 max-h-8 w-full flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400 active:text-saffron-600 dark:active:text-saffron-400 transition-none select-none hover:bg-black/5 dark:hover:bg-white/5"
							>
								{key}
							</button>
						))}
					</div>
				) : (
					<div className="flex-1 overflow-y-auto no-scrollbar py-1 flex flex-col">
						{sortedKeys.map((key) => (
							<button
								key={key}
								onClick={(e) => {
									e.stopPropagation();
									onSelect(key);
								}}
								className="shrink-0 h-8 w-full flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-saffron-600 dark:hover:text-saffron-400 active:bg-saffron-100 dark:active:bg-slate-700 transition-colors select-none"
							>
								{key}
							</button>
						))}
						<div className="h-8 shrink-0" />
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
};

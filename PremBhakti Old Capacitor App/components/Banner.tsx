import { X } from "lucide-react";
import type React from "react";
import { useSettings } from "../context/SettingsContext";
import type { BannerConfig } from "../types";
import { THEME_PALETTES } from "../utils/theme";

interface BannerProps {
	config: BannerConfig;
	onClose: () => void;
	onAction: (config: BannerConfig) => void;
}

export const Banner: React.FC<BannerProps> = ({
	config,
	onClose,
	onAction,
}) => {
	const { themeColor } = useSettings();

	if (!config.enabled) return null;

	const hasAction = config.actionType && config.actionTarget;

	// Agar banner ka khud ka color set hai to use karo, warna app theme use karo
	const effectiveColor = config.color || themeColor;
	const palette = THEME_PALETTES[effectiveColor] || THEME_PALETTES.blue;

	// Use 600 for background and 700 for button text
	const bgColor = palette[600];
	const btnTextColor = palette[700];

	return (
		<div
			className="w-full min-h-full px-4 py-3 z-[100] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in border border-white/20 relative"
			style={{
				backgroundColor: `${bgColor}F2`, // ~95% opacity
				color: "#ffffff",
			}}
		>
			<div className="flex-1 flex flex-col justify-center w-full pr-6">
				<h4 className="font-bold text-sm tracking-wide text-white">
					{config.title}
				</h4>
				<p className="text-sm opacity-95 mt-1 leading-snug font-medium text-white/90 break-words">
					{config.body}
				</p>
				{hasAction && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onAction(config);
						}}
						className="mt-2 self-start inline-block px-4 py-1.5 bg-white rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors shadow-md uppercase tracking-wider"
						style={{ color: btnTextColor }}
					>
						{config.actionLabel || "View Action"}
					</button>
				)}
			</div>
			<button
				onClick={(e) => {
					e.preventDefault();
					onClose();
				}}
				className="absolute top-2 right-2 p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
				aria-label="Close banner"
			>
				<X size={18} color="white" />
			</button>
		</div>
	);
};

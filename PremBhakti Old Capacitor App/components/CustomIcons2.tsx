import { useId } from "react";

// Helper to generate unique IDs for gradients in each instance to avoid SVG cross-contamination
const useIconId = (name: string) => {
	const id = useId();
	return `${name}-${id.replace(/:/g, "")}`;
};

export const CustomCalendarIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: Calendar Body shifted slightly left */}
				<g transform="translate(2, 4)">
					<rect
						x="10"
						y="14"
						width="28"
						height="26"
						rx="4"
						fill="currentColor"
					/>
					{/* Gold Header */}
					<path
						d="M10,18 C10,15.8 11.8,14 14,14 L34,14 C36.2,14 38,15.8 38,18 L38,22 L10,22 L10,18 Z"
						fill={`url(#${gid})`}
					/>
					{/* Binders */}
					<rect
						x="14"
						y="10"
						width="4"
						height="8"
						rx="2"
						fill={`url(#${gid})`}
					/>
					<rect
						x="30"
						y="10"
						width="4"
						height="8"
						rx="2"
						fill={`url(#${gid})`}
					/>
					{/* Grid */}
					<circle cx="16" cy="28" r="1.5" fill={`url(#${gid})`} />
					<circle cx="24" cy="28" r="1.5" fill={`url(#${gid})`} />
					<circle cx="32" cy="28" r="1.5" fill={`url(#${gid})`} />
					<circle cx="16" cy="34" r="1.5" fill={`url(#${gid})`} />
					<circle cx="24" cy="34" r="1.5" fill="#F87171" />
					<circle cx="32" cy="34" r="1.5" fill={`url(#${gid})`} />
				</g>

				{/* 3. FOREGROUND: Flute resting horizontally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

export const CustomDonateIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: Hands and Heart */}
				<g transform="translate(2, -4) scale(1.1)">
					<path
						d="M12,28 C12,28 16,32 24,32 C32,32 36,28 36,28"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<path
						d="M8,22 C8,22 14,28 24,28 C34,28 40,22 40,22"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<path
						d="M24,24 L21,21 C12,13 8,9 8,5 C8,1 12,-2 16,-2 C19,-2 22,0 24,2 C26,0 29,-2 32,-2 C36,-2 40,1 40,5 C40,9 36,13 27,21 L24,24 Z"
						fill={`url(#${gid})`}
					/>
					<path
						d="M24,18 L21,15.5 C14,9 11,6 11,3 C11,0 14,-2 16,-2 C18,-2 21,-1 22.5,1 L24,3 L25.5,1 C27,-1 30,-2 32,-2 C35,-2 37,0 37,3 C37,6 34,9 27,15.5 L24,18 Z"
						fill="#FDE047"
						opacity="0.8"
					/>
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

export const CustomVideoIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: Play Button */}
				<g transform="translate(4, -4) scale(1.1)">
					<circle cx="24" cy="24" r="16" fill="currentColor" />
					<circle
						cx="24"
						cy="24"
						r="14"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="1"
						strokeDasharray="3 3"
					/>
					<path d="M20,16 L32,24 L20,32 Z" fill={`url(#${gid})`} />
					<circle
						cx="24"
						cy="24"
						r="18"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

export const CustomShareIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: Share Nodes */}
				<g transform="translate(4, -4) scale(1.1)">
					<path
						d="M14,24 L32,14 M14,24 L32,34"
						stroke={`url(#${gid})`}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<circle
						cx="12"
						cy="24"
						r="6"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<circle
						cx="34"
						cy="12"
						r="6"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<circle
						cx="34"
						cy="36"
						r="6"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<circle cx="12" cy="24" r="2" fill={`url(#${gid})`} />
					<circle cx="34" cy="12" r="2" fill={`url(#${gid})`} />
					<circle cx="34" cy="36" r="2" fill={`url(#${gid})`} />
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

export const CustomDownloadIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: Download Arrow */}
				<g transform="translate(4, -4) scale(1.1)">
					<circle cx="24" cy="24" r="18" fill="currentColor" opacity="0.1" />
					<path
						d="M24,10 L24,32 M14,24 L24,34 L34,24"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d="M12,40 L36,40"
						stroke="currentColor"
						strokeWidth="4"
						strokeLinecap="round"
					/>
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

export const CustomSettingsIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: Settings Gear */}
				<g transform="translate(4, -4) scale(1.1)">
					{[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
						<g key={i} transform={`rotate(${angle} 24 24)`}>
							<path d="M22,6 L26,6 L27,12 L21,12 Z" fill={`url(#${gid})`} />
						</g>
					))}
					<circle
						cx="24"
						cy="24"
						r="14"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<circle
						cx="24"
						cy="24"
						r="6"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="3"
					/>
					<circle cx="24" cy="24" r="2" fill={`url(#${gid})`} />
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

export const CustomFeedbackIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: Feedback Bubble */}
				<g transform="translate(4, -4) scale(1.1)">
					<path
						d="M24,6 C13,6 6,13 6,22 C6,27 8.5,31 12.5,34 C12.5,37 10,40 10,40 C10,40 16,39.5 20,36.5 C21.5,37 23,37.5 24,37.5 C35,37.5 42,30.5 42,22 C42,13 35,6 24,6 Z"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<circle cx="16" cy="22" r="2" fill={`url(#${gid})`} />
					<circle cx="24" cy="22" r="2" fill={`url(#${gid})`} />
					<circle cx="32" cy="22" r="2" fill={`url(#${gid})`} />
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

export const CustomHelpIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: Question Mark */}
				<g transform="translate(4, -4) scale(1.1)">
					<circle
						cx="24"
						cy="24"
						r="18"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<path
						d="M24,12 C20,12 17,15 17,18"
						stroke={`url(#${gid})`}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<path
						d="M17,18 C17,15 20,12 24,12 C28,12 31,15 31,19 C31,23 24,25 24,29"
						stroke={`url(#${gid})`}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<circle cx="24" cy="35" r="2.5" fill={`url(#${gid})`} />
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

export const CustomAboutIcon = ({
	size = 48,
	className = "",
}: {
	size?: number;
	className?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<svg
			width={size}
			height={size}
			viewBox="-4 -4 56 56"
			overflow="visible"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#FDE047" />
					<stop offset="50%" stopColor="#EAB308" />
					<stop offset="100%" stopColor="#854D0E" />
				</linearGradient>
				<filter id={sid}>
					<feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</filter>
			</defs>
			<g filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<g transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</g>

				{/* 2. MIDDLEGROUND: About Users */}
				<g transform="translate(4, -4) scale(1.1)">
					<circle
						cx="14"
						cy="18"
						r="4"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1"
					/>
					<path
						d="M6,32 C6,27 10,25 14,25 C15.5,25 17,25.5 18.5,26.5"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<circle
						cx="34"
						cy="18"
						r="4"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1"
					/>
					<path
						d="M42,32 C42,27 38,25 34,25 C32.5,25 31,25.5 29.5,26.5"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<circle cx="24" cy="22" r="5.5" fill={`url(#${gid})`} />
					<path
						d="M12,40 C12,34 16,30 24,30 C32,30 36,34 36,40 L12,40 Z"
						fill={`url(#${gid})`}
					/>
					<path d="M23.5,18 L24.5,18 L24.5,22 L23.5,22 Z" fill="#FDE047" />
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(0, 10)">
					<path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</g>
			</g>
		</svg>
	);
};

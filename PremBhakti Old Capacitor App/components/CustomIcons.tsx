import { useId } from "react";

// Helper to generate unique IDs for gradients in each instance to avoid SVG cross-contamination
const useIconId = (name: string) => {
	const id = useId();
	return `${name}-${id.replace(/:/g, "")}`;
};

export const CustomBhajanIcon = ({
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
				<g transform="translate(20, -14) scale(1.4) rotate(40 24 24)">
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

				{/* 2. MIDDLEGROUND: Music Notes floating powerfully in the center */}
				<g transform="translate(4, 2) scale(1.1)">
					<path
						d="M12,18 L20,15 L20,24 C18.5,22.5 15,23.5 13.5,26 C12,28.5 14.5,31.5 17,30 C19,28.5 21,26.5 21,24 L21,11 L12,14.5 Z"
						fill="currentColor"
					/>
					<path
						d="M25,12 L30,10 L30,16 C29,15 26,16 25,17.5 C24,19 25.5,21 27,20 C28.5,19 31,17.5 31,16 L31,8 L25,10 Z"
						fill="currentColor"
					/>
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the entire icon */}
				<g transform="translate(-2, 12)">
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

export const CustomAudiosIcon = ({
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

				{/* 2. MIDDLEGROUND: Headphones */}
				<g transform="translate(4, -4) scale(1.1)">
					<path
						d="M14,28 L14,20 C14,10 34,10 34,20 L34,28"
						stroke="currentColor"
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<rect
						x="10"
						y="22"
						width="6"
						height="12"
						rx="3"
						fill="currentColor"
					/>
					<rect
						x="32"
						y="22"
						width="6"
						height="12"
						rx="3"
						fill="currentColor"
					/>
					<rect x="12" y="25" width="2" height="6" fill={`url(#${gid})`} />
					<rect x="34" y="25" width="2" height="6" fill={`url(#${gid})`} />
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

export const CustomBooksIcon = ({
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

				{/* 2. MIDDLEGROUND: Open Book */}
				<g transform="translate(4, -4) scale(1.1)">
					<path
						d="M24,34 C20,34 12,32 8,28 L8,12 C12,16 20,18 24,18 C28,18 36,16 40,12 L40,28 C36,32 28,34 24,34 Z"
						fill="currentColor"
					/>
					<path
						d="M24,18 L24,38 M8,12 L8,28 M40,12 L40,28"
						stroke={`url(#${gid})`}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<path
						d="M8,28 C12,32 20,34 24,34 C28,34 36,32 40,28 M8,32 C12,36 20,38 24,38 C28,38 36,36 40,32 M8,28 L8,32 M40,28 L40,32 M24,34 L24,38"
						stroke={`url(#${gid})`}
						strokeWidth="2"
						strokeLinejoin="round"
						fill="none"
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

export const CustomHistoryIcon = ({
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

				{/* 2. MIDDLEGROUND: Open Book and Quill */}
				<g transform="translate(4, 0) scale(1.1)">
					<path
						d="M24,34 C24,34 16,36 8,32 C8,32 8,12 8,12 C16,16 24,14 24,14 C24,14 32,16 40,12 C40,12 40,32 40,32 C32,36 24,34 24,34 Z"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<path d="M24,14 L24,34" stroke={`url(#${gid})`} strokeWidth="1.5" />
					{/* Quill Nib */}
					<path d="M24,24 L34,8 C34,8 30,12 28,18 Z" fill={`url(#${gid})`} />
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

export const CustomCentersIcon = ({
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
				<g transform="translate(16, -10) scale(1.3) rotate(25 24 24)">
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

				{/* 2. MIDDLEGROUND: Center Map Pin */}
				<g transform="translate(4, -4) scale(1.1)">
					<ellipse
						cx="24"
						cy="38"
						rx="10"
						ry="3"
						stroke={`url(#${gid})`}
						strokeWidth="2"
						fill="none"
					/>
					<path
						d="M24,36 C24,36 14,24 14,16 C14,8 20,4 24,4 C28,4 34,8 34,16 C34,24 24,36 24,36 Z"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<circle cx="24" cy="16" r="4" fill={`url(#${gid})`} />
				</g>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<g transform="translate(2, 10)">
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

export const CustomYouTubeIcon = ({
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

				{/* 2. MIDDLEGROUND: Temple Arch and YouTube Box */}
				<g transform="translate(4, 0) scale(1.1)">
					<path
						d="M10,40 L10,24 C10,12 24,6 24,6 C24,6 38,12 38,24 L38,40 L34,40 L34,24 C34,16 24,11 24,11 C24,11 14,16 14,24 L14,40 Z"
						fill={`url(#${gid})`}
					/>
					<rect
						x="6"
						y="40"
						width="36"
						height="4"
						rx="1"
						fill={`url(#${gid})`}
					/>
					<rect
						x="14"
						y="20"
						width="20"
						height="14"
						rx="4"
						fill="currentColor"
					/>
					<path d="M20,23 L28,27 L20,31 Z" fill={`url(#${gid})`} />
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

export const CustomInstagramIcon = ({
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

				{/* 2. MIDDLEGROUND: Instagram Body */}
				<g transform="translate(4, -4) scale(1.1)">
					<rect
						x="16"
						y="14"
						width="16"
						height="16"
						rx="4"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<circle
						cx="24"
						cy="22"
						r="4"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<circle cx="28.5" cy="17.5" r="1" fill={`url(#${gid})`} />
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

export const CustomFacebookIcon = ({
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

				{/* 2. MIDDLEGROUND: Facebook 'f' Circle */}
				<g transform="translate(4, 0) scale(1.1)">
					<circle cx="24" cy="24" r="10" fill="currentColor" />
					<path
						d="M26,18 C26,17 27,16 28,16 L28,18 L27,18 C26.5,18 26.5,18.5 26.5,19 L26.5,21 L28,21 L27.5,23 L26.5,23 L26.5,29 L24,29 L24,23 L23,23 L23,21 L24,21 L24,19 C24,17 25,16 26,16 Z"
						fill={`url(#${gid})`}
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

export const CustomTimingIcon = ({
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

				{/* 2. MIDDLEGROUND: Clock */}
				<g transform="translate(4, -4) scale(1.1)">
					<circle
						cx="24"
						cy="24"
						r="10"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<path
						d="M24,24 L24,18 M24,24 L20,26"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
					<circle cx="24" cy="24" r="1.5" fill={`url(#${gid})`} />
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

export const CustomInfoIcon = ({
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

				{/* 2. MIDDLEGROUND: Bell */}
				<g transform="translate(4, -4) scale(1.1)">
					<path
						d="M8,10 Q24,18 40,10"
						stroke="#F59E0B"
						strokeWidth="2"
						strokeDasharray="2 2"
						fill="none"
					/>
					<line
						x1="24"
						y1="4"
						x2="24"
						y2="16"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<path
						d="M24,16 C20,16 18,22 18,26 C18,30 14,32 14,34 L34,34 C34,32 30,30 30,26 C30,22 28,16 24,16 Z"
						fill={`url(#${gid})`}
					/>
					<rect
						x="13"
						y="34"
						width="22"
						height="2"
						rx="1"
						fill={`url(#${gid})`}
					/>
					<circle cx="24" cy="38" r="2" fill={`url(#${gid})`} />
					<path
						d="M17,26 L31,26 M16,30 L32,30"
						stroke="currentColor"
						strokeWidth="1"
						opacity="0.3"
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

export const CustomProfileIcon = ({
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

				{/* 2. MIDDLEGROUND: Profile */}
				<g transform="translate(4, -4) scale(1.1)">
					<circle
						cx="24"
						cy="24"
						r="14"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
						strokeDasharray="2 2"
					/>
					<circle
						cx="24"
						cy="18"
						r="5"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<path
						d="M14,32 C14,28 18,25 24,25 C30,25 34,28 34,32 L34,34 L14,34 Z"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<path d="M23.5,15 L24.5,15 L24.5,19 L23.5,19 Z" fill="#FDE047" />
					<path
						d="M22.5,15 L23,15 L23,19 C23,20 24,20.5 24,20.5 C24,20.5 25,20 25,19 L25,15 L25.5,15 L25.5,19 C25.5,21 24,21.5 24,21.5 C24,21.5 22.5,21 22.5,19 Z"
						fill="#FDE047"
						opacity="0.6"
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

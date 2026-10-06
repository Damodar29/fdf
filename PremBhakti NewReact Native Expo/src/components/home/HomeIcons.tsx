import { useId } from "react";
import Svg, { Circle, Defs, Ellipse, FeDropShadow, Filter, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// The Home tile icons (components/CustomIcons.tsx + CustomIcons2.tsx in the
// Capacitor app), converted to react-native-svg — shapes and colours copied
// as they are. `color` is what the web version took from the CSS text
// colour (fill="currentColor").

// The web icons draw past their 56-unit box (overflow: visible); react-native-svg
// clips at its bounds, so the canvas is 10 units bigger on each side and
// pulled back with a negative margin — the icon keeps its size and place.
const OUTER = 76 / 56;
const BLEED = 10 / 56;

// Unique gradient/filter ids per instance, so icons don't share defs.
const useIconId = (name: string) => {
	const id = useId();
	return `${name}-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
};

export const CustomBhajanIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(20, -14) scale(1.4) rotate(40 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Music Notes floating powerfully in the center */}
				<G transform="translate(4, 2) scale(1.1)">
					<Path
						d="M12,18 L20,15 L20,24 C18.5,22.5 15,23.5 13.5,26 C12,28.5 14.5,31.5 17,30 C19,28.5 21,26.5 21,24 L21,11 L12,14.5 Z"
						fill="currentColor"
					/>
					<Path
						d="M25,12 L30,10 L30,16 C29,15 26,16 25,17.5 C24,19 25.5,21 27,20 C28.5,19 31,17.5 31,16 L31,8 L25,10 Z"
						fill="currentColor"
					/>
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the entire icon */}
				<G transform="translate(-2, 12)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomAudiosIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Headphones */}
				<G transform="translate(4, -4) scale(1.1)">
					<Path
						d="M14,28 L14,20 C14,10 34,10 34,20 L34,28"
						stroke="currentColor"
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Rect
						x="10"
						y="22"
						width="6"
						height="12"
						rx="3"
						fill="currentColor"
					/>
					<Rect
						x="32"
						y="22"
						width="6"
						height="12"
						rx="3"
						fill="currentColor"
					/>
					<Rect x="12" y="25" width="2" height="6" fill={`url(#${gid})`} />
					<Rect x="34" y="25" width="2" height="6" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomBooksIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Open Book */}
				<G transform="translate(4, -4) scale(1.1)">
					<Path
						d="M24,34 C20,34 12,32 8,28 L8,12 C12,16 20,18 24,18 C28,18 36,16 40,12 L40,28 C36,32 28,34 24,34 Z"
						fill="currentColor"
					/>
					<Path
						d="M24,18 L24,38 M8,12 L8,28 M40,12 L40,28"
						stroke={`url(#${gid})`}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<Path
						d="M8,28 C12,32 20,34 24,34 C28,34 36,32 40,28 M8,32 C12,36 20,38 24,38 C28,38 36,36 40,32 M8,28 L8,32 M40,28 L40,32 M24,34 L24,38"
						stroke={`url(#${gid})`}
						strokeWidth="2"
						strokeLinejoin="round"
						fill="none"
					/>
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomHistoryIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Open Book and Quill */}
				<G transform="translate(4, 0) scale(1.1)">
					<Path
						d="M24,34 C24,34 16,36 8,32 C8,32 8,12 8,12 C16,16 24,14 24,14 C24,14 32,16 40,12 C40,12 40,32 40,32 C32,36 24,34 24,34 Z"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<Path d="M24,14 L24,34" stroke={`url(#${gid})`} strokeWidth="1.5" />
					{/* Quill Nib */}
					<Path d="M24,24 L34,8 C34,8 30,12 28,18 Z" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomCentersIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(16, -10) scale(1.3) rotate(25 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Center Map Pin */}
				<G transform="translate(4, -4) scale(1.1)">
					<Ellipse
						cx="24"
						cy="38"
						rx="10"
						ry="3"
						stroke={`url(#${gid})`}
						strokeWidth="2"
						fill="none"
					/>
					<Path
						d="M24,36 C24,36 14,24 14,16 C14,8 20,4 24,4 C28,4 34,8 34,16 C34,24 24,36 24,36 Z"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Circle cx="24" cy="16" r="4" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(2, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomYouTubeIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Temple Arch and YouTube Box */}
				<G transform="translate(4, 0) scale(1.1)">
					<Path
						d="M10,40 L10,24 C10,12 24,6 24,6 C24,6 38,12 38,24 L38,40 L34,40 L34,24 C34,16 24,11 24,11 C24,11 14,16 14,24 L14,40 Z"
						fill={`url(#${gid})`}
					/>
					<Rect
						x="6"
						y="40"
						width="36"
						height="4"
						rx="1"
						fill={`url(#${gid})`}
					/>
					<Rect
						x="14"
						y="20"
						width="20"
						height="14"
						rx="4"
						fill="currentColor"
					/>
					<Path d="M20,23 L28,27 L20,31 Z" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomInstagramIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Instagram Body */}
				<G transform="translate(4, -4) scale(1.1)">
					<Rect
						x="16"
						y="14"
						width="16"
						height="16"
						rx="4"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<Circle
						cx="24"
						cy="22"
						r="4"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<Circle cx="28.5" cy="17.5" r="1" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomFacebookIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Facebook 'f' Circle */}
				<G transform="translate(4, 0) scale(1.1)">
					<Circle cx="24" cy="24" r="10" fill="currentColor" />
					<Path
						d="M26,18 C26,17 27,16 28,16 L28,18 L27,18 C26.5,18 26.5,18.5 26.5,19 L26.5,21 L28,21 L27.5,23 L26.5,23 L26.5,29 L24,29 L24,23 L23,23 L23,21 L24,21 L24,19 C24,17 25,16 26,16 Z"
						fill={`url(#${gid})`}
					/>
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomTimingIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Clock */}
				<G transform="translate(4, -4) scale(1.1)">
					<Circle
						cx="24"
						cy="24"
						r="10"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Path
						d="M24,24 L24,18 M24,24 L20,26"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
					<Circle cx="24" cy="24" r="1.5" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomInfoIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Bell */}
				<G transform="translate(4, -4) scale(1.1)">
					<Path
						d="M8,10 Q24,18 40,10"
						stroke="#F59E0B"
						strokeWidth="2"
						strokeDasharray="2 2"
						fill="none"
					/>
					<Line
						x1="24"
						y1="4"
						x2="24"
						y2="16"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Path
						d="M24,16 C20,16 18,22 18,26 C18,30 14,32 14,34 L34,34 C34,32 30,30 30,26 C30,22 28,16 24,16 Z"
						fill={`url(#${gid})`}
					/>
					<Rect
						x="13"
						y="34"
						width="22"
						height="2"
						rx="1"
						fill={`url(#${gid})`}
					/>
					<Circle cx="24" cy="38" r="2" fill={`url(#${gid})`} />
					<Path
						d="M17,26 L31,26 M16,30 L32,30"
						stroke="currentColor"
						strokeWidth="1"
						opacity="0.3"
					/>
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomProfileIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Profile */}
				<G transform="translate(4, -4) scale(1.1)">
					<Circle
						cx="24"
						cy="24"
						r="14"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
						strokeDasharray="2 2"
					/>
					<Circle
						cx="24"
						cy="18"
						r="5"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<Path
						d="M14,32 C14,28 18,25 24,25 C30,25 34,28 34,32 L34,34 L14,34 Z"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1.5"
					/>
					<Path d="M23.5,15 L24.5,15 L24.5,19 L23.5,19 Z" fill="#FDE047" />
					<Path
						d="M22.5,15 L23,15 L23,19 C23,20 24,20.5 24,20.5 C24,20.5 25,20 25,19 L25,15 L25.5,15 L25.5,19 C25.5,21 24,21.5 24,21.5 C24,21.5 22.5,21 22.5,19 Z"
						fill="#FDE047"
						opacity="0.6"
					/>
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomCalendarIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Calendar Body shifted slightly left */}
				<G transform="translate(2, 4)">
					<Rect
						x="10"
						y="14"
						width="28"
						height="26"
						rx="4"
						fill="currentColor"
					/>
					{/* Gold Header */}
					<Path
						d="M10,18 C10,15.8 11.8,14 14,14 L34,14 C36.2,14 38,15.8 38,18 L38,22 L10,22 L10,18 Z"
						fill={`url(#${gid})`}
					/>
					{/* Binders */}
					<Rect
						x="14"
						y="10"
						width="4"
						height="8"
						rx="2"
						fill={`url(#${gid})`}
					/>
					<Rect
						x="30"
						y="10"
						width="4"
						height="8"
						rx="2"
						fill={`url(#${gid})`}
					/>
					{/* Grid */}
					<Circle cx="16" cy="28" r="1.5" fill={`url(#${gid})`} />
					<Circle cx="24" cy="28" r="1.5" fill={`url(#${gid})`} />
					<Circle cx="32" cy="28" r="1.5" fill={`url(#${gid})`} />
					<Circle cx="16" cy="34" r="1.5" fill={`url(#${gid})`} />
					<Circle cx="24" cy="34" r="1.5" fill="#F87171" />
					<Circle cx="32" cy="34" r="1.5" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Flute resting horizontally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomDonateIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Hands and Heart */}
				<G transform="translate(2, -4) scale(1.1)">
					<Path
						d="M12,28 C12,28 16,32 24,32 C32,32 36,28 36,28"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<Path
						d="M8,22 C8,22 14,28 24,28 C34,28 40,22 40,22"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<Path
						d="M24,24 L21,21 C12,13 8,9 8,5 C8,1 12,-2 16,-2 C19,-2 22,0 24,2 C26,0 29,-2 32,-2 C36,-2 40,1 40,5 C40,9 36,13 27,21 L24,24 Z"
						fill={`url(#${gid})`}
					/>
					<Path
						d="M24,18 L21,15.5 C14,9 11,6 11,3 C11,0 14,-2 16,-2 C18,-2 21,-1 22.5,1 L24,3 L25.5,1 C27,-1 30,-2 32,-2 C35,-2 37,0 37,3 C37,6 34,9 27,15.5 L24,18 Z"
						fill="#FDE047"
						opacity="0.8"
					/>
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomVideoIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Play Button */}
				<G transform="translate(4, -4) scale(1.1)">
					<Circle cx="24" cy="24" r="16" fill="currentColor" />
					<Circle
						cx="24"
						cy="24"
						r="14"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="1"
						strokeDasharray="3 3"
					/>
					<Path d="M20,16 L32,24 L20,32 Z" fill={`url(#${gid})`} />
					<Circle
						cx="24"
						cy="24"
						r="18"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomShareIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Share Nodes */}
				<G transform="translate(4, -4) scale(1.1)">
					<Path
						d="M14,24 L32,14 M14,24 L32,34"
						stroke={`url(#${gid})`}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<Circle
						cx="12"
						cy="24"
						r="6"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Circle
						cx="34"
						cy="12"
						r="6"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Circle
						cx="34"
						cy="36"
						r="6"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Circle cx="12" cy="24" r="2" fill={`url(#${gid})`} />
					<Circle cx="34" cy="12" r="2" fill={`url(#${gid})`} />
					<Circle cx="34" cy="36" r="2" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomDownloadIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Download Arrow */}
				<G transform="translate(4, -4) scale(1.1)">
					<Circle cx="24" cy="24" r="18" fill="currentColor" opacity="0.1" />
					<Path
						d="M24,10 L24,32 M14,24 L24,34 L34,24"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<Path
						d="M12,40 L36,40"
						stroke="currentColor"
						strokeWidth="4"
						strokeLinecap="round"
					/>
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomSettingsIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Settings Gear */}
				<G transform="translate(4, -4) scale(1.1)">
					{[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
						<G key={i} transform={`rotate(${angle} 24 24)`}>
							<Path d="M22,6 L26,6 L27,12 L21,12 Z" fill={`url(#${gid})`} />
						</G>
					))}
					<Circle
						cx="24"
						cy="24"
						r="14"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Circle
						cx="24"
						cy="24"
						r="6"
						fill="none"
						stroke={`url(#${gid})`}
						strokeWidth="3"
					/>
					<Circle cx="24" cy="24" r="2" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomFeedbackIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Feedback Bubble */}
				<G transform="translate(4, -4) scale(1.1)">
					<Path
						d="M24,6 C13,6 6,13 6,22 C6,27 8.5,31 12.5,34 C12.5,37 10,40 10,40 C10,40 16,39.5 20,36.5 C21.5,37 23,37.5 24,37.5 C35,37.5 42,30.5 42,22 C42,13 35,6 24,6 Z"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Circle cx="16" cy="22" r="2" fill={`url(#${gid})`} />
					<Circle cx="24" cy="22" r="2" fill={`url(#${gid})`} />
					<Circle cx="32" cy="22" r="2" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomHelpIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: Question Mark */}
				<G transform="translate(4, -4) scale(1.1)">
					<Circle
						cx="24"
						cy="24"
						r="18"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="2"
					/>
					<Path
						d="M24,12 C20,12 17,15 17,18"
						stroke={`url(#${gid})`}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<Path
						d="M17,18 C17,15 20,12 24,12 C28,12 31,15 31,19 C31,23 24,25 24,29"
						stroke={`url(#${gid})`}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<Circle cx="24" cy="35" r="2.5" fill={`url(#${gid})`} />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

export const CustomAboutIcon = ({
	size = 48,
	color,
}: {
	size?: number;
	color?: string;
}) => {
	const gid = useIconId("g");
	const sid = useIconId("s");
	return (
		<Svg
			width={size * OUTER}
			height={size * OUTER}
			viewBox="-14 -14 76 76"
			style={{ margin: -size * BLEED }}
			color={color}
			fill="none"
		>
			<Defs>
				<LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
					<Stop offset="0%" stopColor="#FDE047" />
					<Stop offset="50%" stopColor="#EAB308" />
					<Stop offset="100%" stopColor="#854D0E" />
				</LinearGradient>
				<Filter id={sid}>
					<FeDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.4" />
				</Filter>
			</Defs>
			<G filter={`url(#${sid})`}>
				{/* 1. BACKGROUND: Giant Peacock Feather swooping up from behind */}
				<G transform="translate(18, -12) scale(1.3) rotate(35 24 24)">
					<Path
						d="M38,32 C48,20 45,8 38,5 C31,8 28,20 38,32 Z"
						fill="#0D9488"
					/>
					<Path
						d="M38,27 C43,18 41,10 38,8 C35,10 33,18 38,27 Z"
						fill="#0284C7"
					/>
					<Ellipse cx="38" cy="15" rx="3" ry="4.5" fill="#FDE047" />
					<Ellipse cx="38" cy="16" rx="1.5" ry="2.5" fill="#1E3A8A" />
					<Path
						d="M38,29 Q45,20 46,15 M38,27 Q44,18 45,12 M38,25 Q43,14 42,9 M38,29 Q31,20 30,15 M38,27 Q32,18 31,12 M38,25 Q33,14 34,9"
						stroke="#047857"
						strokeWidth="0.5"
						fill="none"
					/>
				</G>

				{/* 2. MIDDLEGROUND: About Users */}
				<G transform="translate(4, -4) scale(1.1)">
					<Circle
						cx="14"
						cy="18"
						r="4"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1"
					/>
					<Path
						d="M6,32 C6,27 10,25 14,25 C15.5,25 17,25.5 18.5,26.5"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<Circle
						cx="34"
						cy="18"
						r="4"
						fill="currentColor"
						stroke={`url(#${gid})`}
						strokeWidth="1"
					/>
					<Path
						d="M42,32 C42,27 38,25 34,25 C32.5,25 31,25.5 29.5,26.5"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<Circle cx="24" cy="22" r="5.5" fill={`url(#${gid})`} />
					<Path
						d="M12,40 C12,34 16,30 24,30 C32,30 36,34 36,40 L12,40 Z"
						fill={`url(#${gid})`}
					/>
					<Path d="M23.5,18 L24.5,18 L24.5,22 L23.5,22 Z" fill="#FDE047" />
				</G>

				{/* 3. FOREGROUND: Massive Flute resting diagonally across the very bottom, wrapping the whole icon */}
				<G transform="translate(0, 10)">
					<Path
						d="M-2,38 L50,30"
						stroke={`url(#${gid})`}
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<Circle cx="10" cy="36.8" r="1.5" fill="#422006" />
					<Circle cx="18" cy="35.6" r="1.5" fill="#422006" />
					<Circle cx="26" cy="34.4" r="1.5" fill="#422006" />
					<Circle cx="34" cy="33.2" r="1.5" fill="#422006" />
					<Path
						d="M4,37.5 L5,41 M7,37 L8,40.5"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M42,31 L43,35 M45,30.5 L46,34"
						stroke="#B45309"
						strokeWidth="1"
					/>
					<Path
						d="M44,32 Q41,38 44,43 M44,32 Q48,38 46,44 M44,32 L45,42"
						stroke="#FDE047"
						strokeWidth="1"
						fill="none"
					/>
				</G>
			</G>
		</Svg>
	);
};

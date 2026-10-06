import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from "react-native-svg";

// Janmashtami ornaments from src/assets/janmashtami in the Capacitor app,
// redrawn with react-native-svg. Geometry is copied exactly.

const C = 100; // centre of the mandala's 200x200 viewBox

/** One lotus petal pointing straight up, spanning rInner..rOuter from centre. */
function petal(rInner: number, rOuter: number, width: number): string {
	const span = rOuter - rInner;
	const yIn = C - rInner;
	const yOut = C - rOuter;
	const cy1 = yIn - span * 0.35;
	const cy2 = yOut + span * 0.25;
	return `M${C} ${yIn}C${C - width} ${cy1} ${C - width} ${cy2} ${C} ${yOut}C${C + width} ${cy2} ${C + width} ${cy1} ${C} ${yIn}Z`;
}

function ring(n: number, d: string, opacity: number) {
	return Array.from({ length: n }, (_, i) => (
		<Path key={i} d={d} rotation={(360 / n) * i} origin={`${C}, ${C}`} opacity={opacity} />
	));
}

/** GoldenMandala — the halo behind the header tilak. */
export function GoldenMandala({ size, color }: { size: number; color: string }) {
	return (
		<Svg viewBox="0 0 200 200" width={size} height={size}>
			<G fill="none" stroke={color} strokeWidth={1} strokeLinejoin="round">
				{ring(16, petal(70, 94, 7), 0.8)}
				<Circle cx={C} cy={C} r={68} opacity={0.5} />
				<Circle cx={C} cy={C} r={64} opacity={0.3} strokeWidth={0.6} />
				<G rotation={22.5} origin={`${C}, ${C}`}>
					{ring(8, petal(34, 62, 15), 0.85)}
				</G>
				<Circle cx={C} cy={C} r={31} opacity={0.5} />
				{ring(8, petal(12, 28, 7), 0.9)}
				<Circle cx={C} cy={C} r={10} opacity={0.7} />
			</G>
		</Svg>
	);
}

/** The Gaudiya tilak in the header lockup. */
export function Tilak({ height, color }: { height: number; color: string }) {
	return (
		<Svg viewBox="0 0 100 220" height={height} width={(height * 100) / 220}>
			<Path
				d="M30 10v85q0 40 20 40t20-40V10"
				fill="transparent"
				stroke={color}
				strokeWidth={12}
				strokeLinecap="round"
			/>
			<Path
				d="M50 135 C28 135, 20 165, 50 200 C80 165, 72 135, 50 135 Z"
				fill={color}
				stroke={color}
				strokeWidth={8}
				strokeLinecap="round"
			/>
		</Svg>
	);
}

/** The temple alcove behind the active bottom-nav tab. */
export function TempleNiche({ home, color }: { home?: boolean; color: string }) {
	return (
		<Svg viewBox="0 0 100 92" width={home ? 48 : 42} height={home ? 36 : 34} fill="none">
			<Path
				d="M14 92 V40 C14 22 36 22 50 6 C64 22 86 22 86 40 V92 Z"
				fill={color}
				fillOpacity={0.14}
				stroke={color}
				strokeOpacity={0.55}
				strokeWidth={1.6}
				strokeLinejoin="round"
			/>
			<Path
				d="M22 92 V41 C22 28 40 28 50 14 C60 28 78 28 78 41 V92"
				stroke={color}
				strokeOpacity={0.28}
				strokeWidth={1}
				strokeLinejoin="round"
			/>
		</Svg>
	);
}

/** One lotus petal for LotusCorner, pointing up from the corner (origin). */
function cornerPetal(rInner: number, rOuter: number, width: number): string {
	const span = rOuter - rInner;
	const c1 = -(rInner + span * 0.35);
	const c2 = -(rOuter - span * 0.25);
	return `M0 ${-rInner}C${-width} ${c1} ${-width} ${c2} 0 ${-rOuter}C${width} ${c2} ${width} ${c1} 0 ${-rInner}Z`;
}

/** LotusCorner — the fan of petals in a card's bottom-right corner. */
export function LotusCorner({ size = 56, color }: { size?: number; color: string }) {
	const d = cornerPetal(8, 40, 8);
	return (
		<Svg viewBox="0 0 56 56" width={size} height={size}>
			<G transform="translate(56,56)" fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round">
				{[-90, -67.5, -45, -22.5, 0].map((deg, i) => (
					<Path key={deg} d={d} transform={`rotate(${deg})`} opacity={i === 0 || i === 4 ? 0.45 : 0.85} />
				))}
				<Path d="M-8 0A8 8 0 0 0 0 -8" opacity={0.7} />
				<Path d="M-14 0A14 14 0 0 0 0 -14" opacity={0.4} strokeWidth={0.9} />
				<Circle cx={0} cy={0} r={2.6} fill={color} stroke="none" />
			</G>
		</Svg>
	);
}

/** PeacockFeatherDivider — the rule with a feather eye under section titles. */
export function PeacockFeatherDivider({ size = 160, color }: { size?: number; color: string }) {
	return (
		<Svg viewBox="0 0 240 24" width={size} height={size / 10}>
			<Defs>
				<LinearGradient id="pfd-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="0">
					<Stop offset="0" stopColor={color} stopOpacity={0} />
					<Stop offset="0.35" stopColor={color} stopOpacity={0.85} />
					<Stop offset="0.5" stopColor={color} stopOpacity={1} />
					<Stop offset="0.65" stopColor={color} stopOpacity={0.85} />
					<Stop offset="1" stopColor={color} stopOpacity={0} />
				</LinearGradient>
			</Defs>
			<Path d="M4 12H97" stroke="url(#pfd-fade)" strokeWidth={1.25} strokeLinecap="round" fill="none" />
			<Path d="M143 12H236" stroke="url(#pfd-fade)" strokeWidth={1.25} strokeLinecap="round" fill="none" />
			<Path d="M100 12l2.5-2.5L105 12l-2.5 2.5z" fill={color} opacity={0.75} />
			<Path d="M135 12l2.5-2.5L140 12l-2.5 2.5z" fill={color} opacity={0.75} />
			<Path d="M106 7Q120 -0.5 134 7" stroke={color} strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.45} />
			<Path d="M106 17Q120 24.5 134 17" stroke={color} strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.45} />
			<Ellipse cx={120} cy={12} rx={11} ry={7.6} fill={color} opacity={0.16} />
			<Ellipse cx={120} cy={12} rx={11} ry={7.6} fill="none" stroke={color} strokeWidth={0.9} opacity={0.6} />
			<Ellipse cx={120} cy={12} rx={6.4} ry={4.4} fill={color} opacity={0.38} />
			<Ellipse cx={120} cy={12} rx={2.7} ry={2.4} fill={color} />
		</Svg>
	);
}

/** The temple alcove inside a Home icon tile, seated on the tile's bottom edge. */
export function TileNiche({ color }: { color: string }) {
	return (
		<Svg
			viewBox="0 0 100 92"
			preserveAspectRatio="xMidYMax meet"
			width="100%"
			height="100%"
			fill="none"
			style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
			pointerEvents="none"
		>
			<Path
				d="M14 92 V40 C14 22 36 22 50 6 C64 22 86 22 86 40 V92 Z"
				fill={color}
				fillOpacity={0.055}
				stroke={color}
				strokeOpacity={0.4}
				strokeWidth={1.2}
				strokeLinejoin="round"
			/>
			<Path
				d="M22 92 V41 C22 28 40 28 50 14 C60 28 78 28 78 41 V92"
				stroke={color}
				strokeOpacity={0.22}
				strokeWidth={0.8}
				strokeLinejoin="round"
			/>
		</Svg>
	);
}

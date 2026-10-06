import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useThumbSrc } from "../../../../components/ui/ThumbImg";
import {
	type FamilyGroup,
	packRows,
	ringLayout,
} from "../../../../utils/familyNetwork";
import { THUMB } from "../../../../utils/imageThumb";

/** A member's photo in the graph, as a small resized copy. */
const NodePhoto: React.FC<{ src: string; r: number; clipId: string }> = ({
	src,
	r,
	clipId,
}) => {
	const thumb = useThumbSrc(src, THUMB.small);
	return (
		<image
			href={thumb.src}
			onError={thumb.onError}
			x={-r}
			y={-r}
			width={r * 2}
			height={r * 2}
			preserveAspectRatio="xMidYMid slice"
			clipPath={`url(#${clipId})`}
		/>
	);
};

/** Bubble size for a family of `n` accounts. */
const bubbleRadius = (n: number) => 16 + 7 * Math.sqrt(n);

/**
 * The global chart: every family as one bubble, its members as dots on a
 * ring and their links as lines (dashed = linked automatically through
 * someone). Amber = not everyone in it is linked to each other yet. Biggest
 * families on top. Tap a bubble to open that family.
 */
export const FamilyNetworkMap: React.FC<{
	groups: FamilyGroup[];
	nameOf: (uid: string) => string;
	isHindi: boolean;
	onOpen: (group: FamilyGroup) => void;
}> = ({ groups, nameOf, isHindi, onOpen }) => {
	const boxRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(340);
	const [hover, setHover] = useState<string | null>(null);

	useEffect(() => {
		const el = boxRef.current;
		if (!el) return;
		const measure = () => setWidth(Math.max(260, el.clientWidth));
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const layout = useMemo(() => {
		const radii = groups.map((g) => bubbleRadius(g.members.length));
		const { centres, height } = packRows(radii, width, 8);
		return groups.map((g, i) => {
			const r = radii[i];
			const dots = ringLayout(g.members.length, Math.max(0, r - 9));
			const at = new Map(g.members.map((uid, j) => [uid, dots[j]]));
			return { group: g, r, c: centres[i], at, height };
		});
	}, [groups, width]);
	const height = layout[0]?.height ?? 0;
	const hovered = layout.find((l) => l.group.id === hover);

	return (
		<div ref={boxRef} className="relative w-full">
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				role="img"
				aria-label={
					isHindi
						? `${groups.length} परिवारों का नक्शा`
						: `Map of ${groups.length} families`
				}
				className="block"
			>
				{layout.map(({ group, r, c, at }) => {
					const partly = group.missingPairs > 0;
					const isHover = hover === group.id;
					const dotR = group.members.length > 14 ? 3 : 4;
					return (
						// biome-ignore lint/a11y/useSemanticElements: an SVG group can't be a <button>
						<g
							key={group.id}
							transform={`translate(${c.x} ${c.y})`}
							role="button"
							tabIndex={0}
							aria-label={group.members.slice(0, 3).map(nameOf).join(", ")}
							className="cursor-pointer outline-none"
							onClick={() => onOpen(group)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") onOpen(group);
							}}
							onMouseEnter={() => setHover(group.id)}
							onMouseLeave={() => setHover((h) => (h === group.id ? null : h))}
						>
							<circle
								r={r}
								className={`${
									partly
										? "fill-amber-50 stroke-amber-300 dark:fill-amber-900/20 dark:stroke-amber-700"
										: "fill-pink-50 stroke-pink-200 dark:fill-pink-500/10 dark:stroke-pink-900"
								} ${isHover ? "stroke-2" : ""}`}
								strokeWidth={isHover ? 2 : 1}
							/>
							{group.edges.map((e) => {
								const a = at.get(e.a);
								const b = at.get(e.b);
								if (!a || !b) return null;
								return (
									<line
										key={`${e.a}-${e.b}`}
										x1={a.x}
										y1={a.y}
										x2={b.x}
										y2={b.y}
										strokeWidth={1}
										strokeDasharray={e.auto ? "2 2" : undefined}
										className="stroke-slate-400/70 dark:stroke-slate-500/70"
									/>
								);
							})}
							{group.members.map((uid) => {
								const p = at.get(uid);
								if (!p) return null;
								return (
									<circle
										key={uid}
										cx={p.x}
										cy={p.y}
										r={dotR}
										className={`${
											partly
												? "fill-amber-500 dark:fill-amber-400"
												: "fill-pink-500 dark:fill-pink-400"
										} stroke-white dark:stroke-slate-800`}
										strokeWidth={1.5}
									/>
								);
							})}
							{r >= 30 && (
								<text
									y={4}
									textAnchor="middle"
									className="fill-slate-700 dark:fill-slate-200 text-[11px] font-bold pointer-events-none"
								>
									{group.members.length}
								</text>
							)}
						</g>
					);
				})}
			</svg>
			{hovered && (
				<div
					className="pointer-events-none absolute z-10 max-w-[220px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg px-3 py-2"
					style={{
						left: Math.min(Math.max(8, hovered.c.x - 110), width - 228),
						top: hovered.c.y + hovered.r + 6,
					}}
				>
					<p className="text-xs font-bold text-slate-800 dark:text-white leading-snug">
						{hovered.group.members.slice(0, 4).map(nameOf).join(", ")}
						{hovered.group.members.length > 4
							? ` +${hovered.group.members.length - 4}`
							: ""}
					</p>
					<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
						{isHindi
							? `${hovered.group.members.length} ऐप पर · ${hovered.group.edges.length} लिंक`
							: `${hovered.group.members.length} on the app · ${hovered.group.edges.length} links`}
						{hovered.group.missingPairs > 0 &&
							(isHindi
								? ` · ${hovered.group.missingPairs} लिंक बाकी`
								: ` · ${hovered.group.missingPairs} links missing`)}
					</p>
				</div>
			)}
		</div>
	);
};

/**
 * One family's links, larger: members on a ring with their names, the
 * selected person highlighted and their links drawn stronger.
 */
export const FamilyGroupGraph: React.FC<{
	group: FamilyGroup;
	nameOf: (uid: string) => string;
	photoOf: (uid: string) => string | undefined;
	selected: string;
	onSelect: (uid: string) => void;
}> = ({ group, nameOf, photoOf, selected, onSelect }) => {
	const n = group.members.length;
	const nodeR = n > 16 ? 13 : 18;
	const ring = Math.max(70, (n * (nodeR * 2 + 26)) / (2 * Math.PI));
	const size = ring * 2 + nodeR * 2 + 44;
	const mid = size / 2;
	const dots = ringLayout(n, ring);
	const at = new Map(group.members.map((uid, i) => [uid, dots[i]]));
	const showNames = n <= 18;
	const clip = (uid: string) =>
		`fg-clip-${group.id}-${uid}`.replace(/\W/g, "_");

	return (
		<svg
			viewBox={`${-mid} ${-mid} ${size} ${size}`}
			className="w-full max-w-[420px] mx-auto block"
		>
			<title>{group.members.map(nameOf).join(", ")}</title>
			<defs>
				{group.members.map((uid) => (
					<clipPath key={uid} id={clip(uid)}>
						<circle r={nodeR - 1.5} />
					</clipPath>
				))}
			</defs>
			{group.edges.map((e) => {
				const a = at.get(e.a);
				const b = at.get(e.b);
				if (!a || !b) return null;
				const strong = e.a === selected || e.b === selected;
				return (
					<line
						key={`${e.a}-${e.b}`}
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						strokeWidth={strong ? 2 : 1}
						strokeDasharray={e.auto ? "4 3" : undefined}
						className={
							strong
								? "stroke-pink-400 dark:stroke-pink-500"
								: "stroke-slate-300 dark:stroke-slate-600"
						}
					/>
				);
			})}
			{group.members.map((uid) => {
				const p = at.get(uid);
				if (!p) return null;
				const isSel = uid === selected;
				const photo = photoOf(uid);
				const name = nameOf(uid);
				const short = name.length > 11 ? `${name.slice(0, 10)}…` : name;
				return (
					// biome-ignore lint/a11y/useSemanticElements: an SVG group can't be a <button>
					<g
						key={uid}
						transform={`translate(${p.x} ${p.y})`}
						role="button"
						tabIndex={0}
						aria-label={name}
						aria-pressed={isSel}
						className="cursor-pointer outline-none"
						onClick={() => onSelect(uid)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") onSelect(uid);
						}}
					>
						{/* Bigger than the dot, so it is easy to tap. */}
						<circle r={nodeR + 8} className="fill-transparent" />
						<circle
							r={nodeR}
							strokeWidth={isSel ? 3 : 2}
							className={`${
								isSel ? "stroke-pink-500" : "stroke-white dark:stroke-slate-700"
							} fill-slate-100 dark:fill-slate-800`}
						/>
						{photo ? (
							<NodePhoto src={photo} r={nodeR} clipId={clip(uid)} />
						) : (
							<text
								y={4}
								textAnchor="middle"
								className="fill-slate-500 dark:fill-slate-300 text-[12px] font-bold"
							>
								{(name.trim()[0] || "?").toUpperCase()}
							</text>
						)}
						{(showNames || isSel) && (
							<text
								y={nodeR + 13}
								textAnchor="middle"
								className={`text-[10px] ${
									isSel
										? "fill-pink-600 dark:fill-pink-400 font-bold"
										: "fill-slate-600 dark:fill-slate-300"
								}`}
							>
								{short}
							</text>
						)}
					</g>
				);
			})}
		</svg>
	);
};

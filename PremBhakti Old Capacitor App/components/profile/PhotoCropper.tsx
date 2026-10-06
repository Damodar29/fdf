import { Check, Loader2, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";

interface PhotoCropperProps {
	/** Object URL of a picked file, or the URL of an existing photo to re-adjust. */
	src: string;
	isHindi: boolean;
	onCancel: () => void;
	/**
	 * Receives the cropped square JPEG (e.g. uploads it). Resolve true to close
	 * the cropper; false keeps it open so the devotee can retry or cancel.
	 */
	onConfirm: (blob: Blob) => boolean | Promise<boolean>;
	/**
	 * Output edge in px. When omitted the cropper uses the image's native
	 * resolution so the saved photo is as sharp as the original allows.
	 */
	outputSize?: number;
	/** How far in one can zoom (admins cut one face out of a group photo). */
	maxZoom?: number;
	/** Heading instead of "Adjust photo". */
	title?: string;
}

/**
 * Below this many photo pixels across the square the saved photo starts to
 * look soft (it is shown up to ~112px, on 2–3x screens).
 */
const SOFT_BELOW = 220;

/**
 * Upper limit for the saved square when it follows the photo's own size.
 * iOS WebViews can't draw a canvas bigger than 4096 × 4096 (toBlob returns
 * nothing and the save fails), and a 50–108 MP camera photo would also be a
 * very slow upload. Normal 12 MP phone photos (≈3000 px square) stay native.
 */
const MAX_NATIVE_OUTPUT = 4096;

/**
 * Full-screen square cropper for profile photos: drag to move, pinch / slider /
 * mouse wheel to zoom, and rotate in 90° steps. The circle shows how the photo
 * will look in round avatars; the saved image is the whole square.
 *
 * Written in-house (no cropping library): pointer events cover touch, pen and
 * mouse alike, and the maths is small.
 */
export const PhotoCropper: React.FC<PhotoCropperProps> = ({
	src,
	isHindi,
	onCancel,
	onConfirm,
	outputSize,
	maxZoom: MAX_ZOOM = 5,
	title,
}) => {
	const viewportRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement | null>(null);
	const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
	const [loadError, setLoadError] = useState(false);
	const [viewport, setViewport] = useState(300);
	const [rotation, setRotation] = useState(0); // quarter turns 0..3
	const [zoom, setZoom] = useState(1); // 1 = photo just covers the square
	const [offset, setOffset] = useState({ x: 0, y: 0 }); // image centre vs square centre, px
	const [saving, setSaving] = useState(false);
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

	const close = usePopupBackHandler(true, "photo-cropper", onCancel);

	// Load once to learn the size. crossOrigin so an existing Storage photo can
	// be drawn to the canvas (the bucket's CORS allows GET from any origin).
	useEffect(() => {
		const img = new Image();
		if (!src.startsWith("blob:") && !src.startsWith("data:"))
			img.crossOrigin = "anonymous";
		img.onload = () => {
			imgRef.current = img;
			setNatural({ w: img.naturalWidth, h: img.naturalHeight });
		};
		img.onerror = () => setLoadError(true);
		img.src = src;
	}, [src]);

	useEffect(() => {
		const measure = () => {
			const w = viewportRef.current?.clientWidth;
			if (w) setViewport(w);
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, []);

	const turned = rotation % 2 === 1;
	const boxW = natural ? (turned ? natural.h : natural.w) : 1;
	const boxH = natural ? (turned ? natural.w : natural.h) : 1;
	// Scale at which the (rotated) photo exactly covers the square.
	const coverScale = Math.max(viewport / boxW, viewport / boxH);
	const scale = coverScale * zoom;

	const clamp = useCallback(
		(o: { x: number; y: number }, z = zoom) => {
			const s = coverScale * z;
			const maxX = Math.max(0, (boxW * s - viewport) / 2);
			const maxY = Math.max(0, (boxH * s - viewport) / 2);
			return {
				x: Math.min(maxX, Math.max(-maxX, o.x)),
				y: Math.min(maxY, Math.max(-maxY, o.y)),
			};
		},
		[boxW, boxH, coverScale, viewport, zoom],
	);

	const applyZoom = useCallback(
		(next: number) => {
			const z = Math.min(MAX_ZOOM, Math.max(1, next));
			setZoom(z);
			setOffset((o) => clamp(o, z));
		},
		[clamp, MAX_ZOOM],
	);

	// Keep the photo covering the square after a rotation or a resize.
	useEffect(() => {
		setOffset((o) => clamp(o));
	}, [clamp]);

	const onPointerDown = (e: React.PointerEvent) => {
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
		pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.current.size === 2) {
			const [a, b] = [...pointers.current.values()];
			pinchStart.current = {
				dist: Math.hypot(a.x - b.x, a.y - b.y),
				zoom,
			};
		}
	};

	const onPointerMove = (e: React.PointerEvent) => {
		const prev = pointers.current.get(e.pointerId);
		if (!prev) return;
		const now = { x: e.clientX, y: e.clientY };
		pointers.current.set(e.pointerId, now);
		if (pointers.current.size >= 2 && pinchStart.current) {
			const [a, b] = [...pointers.current.values()];
			const dist = Math.hypot(a.x - b.x, a.y - b.y);
			if (pinchStart.current.dist > 0)
				applyZoom(pinchStart.current.zoom * (dist / pinchStart.current.dist));
			return;
		}
		setOffset((o) =>
			clamp({ x: o.x + now.x - prev.x, y: o.y + now.y - prev.y }),
		);
	};

	const onPointerUp = (e: React.PointerEvent) => {
		pointers.current.delete(e.pointerId);
		if (pointers.current.size < 2) pinchStart.current = null;
	};

	const onWheel = (e: React.WheelEvent) => {
		applyZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
	};

	const handleSave = async () => {
		const img = imgRef.current;
		if (!img || !natural) return;
		setSaving(true);
		try {
			// When no explicit outputSize was provided, derive the output
			// from the original image's native resolution: the visible crop
			// square in original-image pixels. This keeps full quality.
			const effectiveSize =
				outputSize ??
				Math.max(
					1,
					Math.min(MAX_NATIVE_OUTPUT, Math.round(Math.min(boxW, boxH) / zoom)),
				);
			const canvas = document.createElement("canvas");
			canvas.width = effectiveSize;
			canvas.height = effectiveSize;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Canvas unavailable");
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, effectiveSize, effectiveSize);
			ctx.imageSmoothingQuality = "high";
			// Same transform as the on-screen preview, rescaled to the output.
			const k = effectiveSize / viewport;
			ctx.translate(effectiveSize / 2, effectiveSize / 2);
			ctx.scale(k, k);
			ctx.translate(offset.x, offset.y);
			ctx.rotate((rotation * Math.PI) / 2);
			ctx.scale(scale, scale);
			ctx.drawImage(img, -natural.w / 2, -natural.h / 2);
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, "image/jpeg", 0.88),
			);
			if (!blob) throw new Error("Could not create the image");
			if (await onConfirm(blob)) {
				// close() pops this popup's history entry before the parent unmounts us.
				close();
				return;
			}
			setSaving(false);
		} catch (err) {
			console.error("[PhotoCropper] Save failed", err);
			setLoadError(true);
			setSaving(false);
		}
	};

	return createPortal(
		<div className="fixed inset-0 z-[500] bg-black/90 flex flex-col items-center justify-center p-4 select-none">
			<div className="w-full max-w-sm">
				<div className="flex items-center justify-between mb-3 text-white">
					<h3 className="font-bold text-base">
						{title || (isHindi ? "फोटो सेट करें" : "Adjust photo")}
					</h3>
					<button
						type="button"
						onClick={close}
						aria-label={isHindi ? "बंद करें" : "Close"}
						className="p-2 rounded-full bg-white/10 active:scale-95"
					>
						<X size={18} />
					</button>
				</div>

				<div
					ref={viewportRef}
					className="relative w-full aspect-square overflow-hidden rounded-2xl bg-slate-800 touch-none cursor-grab active:cursor-grabbing"
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
					onWheel={onWheel}
				>
					{natural && !loadError && (
						<img
							src={src}
							alt=""
							draggable={false}
							crossOrigin={
								src.startsWith("blob:") || src.startsWith("data:")
									? undefined
									: "anonymous"
							}
							className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
							style={{
								width: natural.w,
								height: natural.h,
								transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation * 90}deg) scale(${scale})`,
								transformOrigin: "center",
							}}
						/>
					)}
					{!natural && !loadError && (
						<div className="absolute inset-0 flex items-center justify-center">
							<Loader2 className="text-white/70 animate-spin" size={28} />
						</div>
					)}
					{loadError && (
						<div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
							{isHindi
								? "यह फोटो खुल नहीं सकी। कृपया दूसरी फोटो चुनें।"
								: "This photo could not be opened. Please pick another one."}
						</div>
					)}
					{/* Round-avatar guide: dim everything outside the circle */}
					<div
						className="pointer-events-none absolute inset-0 rounded-full"
						style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
					/>
					<div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/70" />
				</div>

				{natural && !loadError && viewport / scale < SOFT_BELOW && (
					<p className="text-center text-[11px] font-bold text-amber-300 mt-2">
						{isHindi
							? "बहुत ज़ूम — फोटो थोड़ी धुंधली दिख सकती है"
							: "Zoomed in a lot — the photo may look a little soft"}
					</p>
				)}
				<p className="text-center text-[11px] text-white/60 mt-2">
					{isHindi
						? "खींचकर जगह बदलें • दो उंगलियों या स्लाइडर से ज़ूम करें"
						: "Drag to move • Pinch or use the slider to zoom"}
				</p>

				<div className="flex items-center gap-3 mt-4 text-white">
					<ZoomOut size={16} className="shrink-0 text-white/70" />
					<input
						type="range"
						min={1}
						max={MAX_ZOOM}
						step={0.01}
						value={zoom}
						onChange={(e) => applyZoom(Number(e.target.value))}
						aria-label={isHindi ? "ज़ूम" : "Zoom"}
						className="flex-1 accent-pink-500"
					/>
					<ZoomIn size={16} className="shrink-0 text-white/70" />
				</div>

				<div className="flex gap-3 mt-5">
					<button
						type="button"
						onClick={() => setRotation((r) => (r + 1) % 4)}
						disabled={!natural || saving}
						aria-label={isHindi ? "घुमाएं" : "Rotate"}
						className="px-4 py-3 rounded-xl bg-white/10 text-white font-medium flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
					>
						<RotateCw size={18} />
					</button>
					<button
						type="button"
						onClick={close}
						disabled={saving}
						className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium active:scale-95"
					>
						{isHindi ? "रद्द करें" : "Cancel"}
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={!natural || loadError || saving}
						className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
					>
						{saving ? (
							<Loader2 size={18} className="animate-spin" />
						) : (
							<Check size={18} />
						)}
						{isHindi ? "सेव करें" : "Save"}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
};

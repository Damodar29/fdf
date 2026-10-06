import type React from "react";
import { useEffect, useRef, useState } from "react";

type Point = {
	x: number;
	y: number;
};

export type ZoomSize = {
	width: number;
	height: number;
};

interface UseStoryImageZoomOptions {
	containerSize: ZoomSize;
	mediaSize: ZoomSize;
	targetRef: React.RefObject<HTMLElement | null>;
	minScale?: number;
	maxScale?: number;
	resetThreshold?: number;
}

const ZOOM_EPSILON = 0.01;
const SMOOTH_TRANSFORM = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function getFittedMediaSize(
	containerSize: ZoomSize,
	mediaSize: ZoomSize,
): ZoomSize {
	if (
		!containerSize.width ||
		!containerSize.height ||
		!mediaSize.width ||
		!mediaSize.height
	) {
		return containerSize;
	}

	const containRatio = Math.min(
		containerSize.width / mediaSize.width,
		containerSize.height / mediaSize.height,
	);

	return {
		width: mediaSize.width * containRatio,
		height: mediaSize.height * containRatio,
	};
}

export function useViewportSize(): ZoomSize {
	const readViewport = () => ({
		width: window.visualViewport?.width ?? window.innerWidth,
		height: window.visualViewport?.height ?? window.innerHeight,
	});

	const [viewportSize, setViewportSize] = useState<ZoomSize>(() =>
		readViewport(),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: readViewport is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const updateViewport = () => {
			setViewportSize(readViewport());
		};

		updateViewport();
		window.addEventListener("resize", updateViewport);
		window.visualViewport?.addEventListener("resize", updateViewport);

		return () => {
			window.removeEventListener("resize", updateViewport);
			window.visualViewport?.removeEventListener("resize", updateViewport);
		};
	}, []);

	return viewportSize;
}

export function useStoryImageZoom({
	containerSize,
	mediaSize,
	targetRef,
	minScale = 1,
	maxScale = 4,
	resetThreshold = 1.02,
}: UseStoryImageZoomOptions) {
	const [isZoomed, setIsZoomed] = useState(false);
	const [isInteracting, setIsInteracting] = useState(false);

	const scaleRef = useRef(minScale);
	const offsetRef = useRef<Point>({ x: 0, y: 0 });
	const isInteractingRef = useRef(false);
	const lastTouchRef = useRef<{ dist: number; mid: Point } | null>(null);
	const lastPanRef = useRef<Point | null>(null);
	const frameRef = useRef<number | null>(null);
	const pendingTransformRef = useRef<{
		scale: number;
		offset: Point;
		animate: boolean;
	} | null>(null);

	const setInteractionState = (nextValue: boolean) => {
		isInteractingRef.current = nextValue;
		setIsInteracting((currentValue) =>
			currentValue === nextValue ? currentValue : nextValue,
		);
	};

	const syncZoomedState = (nextScale: number) => {
		const nextZoomed = nextScale > minScale + ZOOM_EPSILON;
		setIsZoomed((currentValue) =>
			currentValue === nextZoomed ? currentValue : nextZoomed,
		);
	};

	const writeTransform = (
		nextScale: number,
		nextOffset: Point,
		animate: boolean,
	) => {
		const target = targetRef.current;
		if (!target) return;

		target.style.transform = `translate3d(${nextOffset.x}px, ${nextOffset.y}px, 0) scale(${nextScale})`;
		target.style.transformOrigin = "center center";
		target.style.transition = animate ? SMOOTH_TRANSFORM : "none";
		target.style.willChange = "transform";
		target.style.backfaceVisibility = "hidden";
	};

	const flushPendingTransform = () => {
		frameRef.current = null;

		const pendingTransform = pendingTransformRef.current;
		pendingTransformRef.current = null;
		if (!pendingTransform) return;

		writeTransform(
			pendingTransform.scale,
			pendingTransform.offset,
			pendingTransform.animate,
		);
	};

	const renderTransform = (
		nextScale: number,
		nextOffset: Point,
		options: { animate?: boolean; immediate?: boolean } = {},
	) => {
		const { animate = false, immediate = false } = options;

		if (frameRef.current !== null && (animate || immediate)) {
			window.cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
			pendingTransformRef.current = null;
		}

		if (animate || immediate) {
			writeTransform(nextScale, nextOffset, animate);
			return;
		}

		pendingTransformRef.current = {
			scale: nextScale,
			offset: nextOffset,
			animate: false,
		};

		if (frameRef.current === null) {
			frameRef.current = window.requestAnimationFrame(flushPendingTransform);
		}
	};

	const clampOffset = (
		nextOffset: Point,
		nextScale = scaleRef.current,
	): Point => {
		const fittedMediaSize = getFittedMediaSize(containerSize, mediaSize);
		const maxOffsetX = Math.max(
			0,
			(fittedMediaSize.width * nextScale - containerSize.width) / 2,
		);
		const maxOffsetY = Math.max(
			0,
			(fittedMediaSize.height * nextScale - containerSize.height) / 2,
		);

		return {
			x: clamp(nextOffset.x, -maxOffsetX, maxOffsetX),
			y: clamp(nextOffset.y, -maxOffsetY, maxOffsetY),
		};
	};

	const applyTransform = (
		nextScale: number,
		nextOffset: Point,
		options: { animate?: boolean; immediate?: boolean } = {},
	) => {
		const clampedOffset = clampOffset(nextOffset, nextScale);
		scaleRef.current = nextScale;
		offsetRef.current = clampedOffset;
		syncZoomedState(nextScale);
		renderTransform(nextScale, clampedOffset, options);
	};

	const reset = (immediate = true) => {
		lastTouchRef.current = null;
		lastPanRef.current = null;
		setInteractionState(false);
		applyTransform(
			minScale,
			{ x: 0, y: 0 },
			{ animate: !immediate, immediate },
		);
	};

	const handleTouchStart = (event: React.TouchEvent<Element>) => {
		if (event.touches.length === 2) {
			event.preventDefault();

			const touchA = event.touches[0];
			const touchB = event.touches[1];
			const distance = Math.hypot(
				touchB.clientX - touchA.clientX,
				touchB.clientY - touchA.clientY,
			);

			lastTouchRef.current = {
				dist: distance,
				mid: {
					x: (touchA.clientX + touchB.clientX) / 2,
					y: (touchA.clientY + touchB.clientY) / 2,
				},
			};
			lastPanRef.current = null;
			setInteractionState(true);
			return;
		}

		if (
			event.touches.length === 1 &&
			scaleRef.current > minScale + ZOOM_EPSILON
		) {
			event.preventDefault();
			lastPanRef.current = {
				x: event.touches[0].clientX,
				y: event.touches[0].clientY,
			};
			setInteractionState(true);
		}
	};

	const handleTouchMove = (event: React.TouchEvent<Element>) => {
		if (event.touches.length === 2 && lastTouchRef.current) {
			event.preventDefault();

			const previousTouch = lastTouchRef.current;
			const touchA = event.touches[0];
			const touchB = event.touches[1];
			const nextMid = {
				x: (touchA.clientX + touchB.clientX) / 2,
				y: (touchA.clientY + touchB.clientY) / 2,
			};
			const distance = Math.hypot(
				touchB.clientX - touchA.clientX,
				touchB.clientY - touchA.clientY,
			);
			const previousScale = scaleRef.current;
			const scaleRatio =
				previousTouch.dist > 0 ? distance / previousTouch.dist : 1;
			const nextScale = clamp(previousScale * scaleRatio, minScale, maxScale);
			const appliedScaleRatio =
				previousScale > 0 ? nextScale / previousScale : 1;
			const viewportCenter = {
				x: containerSize.width / 2,
				y: containerSize.height / 2,
			};
			const previousMidRelative = {
				x: previousTouch.mid.x - viewportCenter.x,
				y: previousTouch.mid.y - viewportCenter.y,
			};
			const nextMidRelative = {
				x: nextMid.x - viewportCenter.x,
				y: nextMid.y - viewportCenter.y,
			};

			applyTransform(nextScale, {
				x:
					nextMidRelative.x -
					(previousMidRelative.x - offsetRef.current.x) * appliedScaleRatio,
				y:
					nextMidRelative.y -
					(previousMidRelative.y - offsetRef.current.y) * appliedScaleRatio,
			});

			lastTouchRef.current = {
				dist: distance,
				mid: nextMid,
			};
			setInteractionState(true);
			return;
		}

		if (
			event.touches.length === 1 &&
			scaleRef.current > minScale + ZOOM_EPSILON
		) {
			event.preventDefault();

			const nextPoint = {
				x: event.touches[0].clientX,
				y: event.touches[0].clientY,
			};

			if (!lastPanRef.current) {
				lastPanRef.current = nextPoint;
				setInteractionState(true);
				return;
			}

			applyTransform(scaleRef.current, {
				x: offsetRef.current.x + (nextPoint.x - lastPanRef.current.x),
				y: offsetRef.current.y + (nextPoint.y - lastPanRef.current.y),
			});

			lastPanRef.current = nextPoint;
			setInteractionState(true);
		}
	};

	const handleTouchEnd = (event: React.TouchEvent<Element>) => {
		if (event.touches.length < 2) {
			lastTouchRef.current = null;
		}

		if (scaleRef.current < resetThreshold) {
			reset(false);
			return;
		}

		if (
			event.touches.length === 1 &&
			scaleRef.current > minScale + ZOOM_EPSILON
		) {
			lastPanRef.current = {
				x: event.touches[0].clientX,
				y: event.touches[0].clientY,
			};
			applyTransform(scaleRef.current, offsetRef.current, { immediate: true });
			setInteractionState(true);
			return;
		}

		lastPanRef.current = null;
		setInteractionState(false);
		applyTransform(scaleRef.current, offsetRef.current, {
			animate: true,
			immediate: true,
		});
	};

	const hasActiveGesture = () =>
		isInteractingRef.current ||
		lastTouchRef.current !== null ||
		lastPanRef.current !== null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: applyTransform is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		applyTransform(scaleRef.current, offsetRef.current, { immediate: true });
	}, [
		containerSize.width,
		containerSize.height,
		mediaSize.width,
		mediaSize.height,
	]);

	useEffect(() => {
		return () => {
			if (frameRef.current !== null) {
				window.cancelAnimationFrame(frameRef.current);
			}
		};
	}, []);

	return {
		reset,
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd,
		hasActiveGesture,
		isInteracting,
		isZoomed,
	};
}

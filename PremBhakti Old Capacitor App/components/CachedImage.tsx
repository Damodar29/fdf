/**
 * CachedImage.tsx
 *
 * A drop-in replacement for the <img> tag that caches images to the local
 * device filesystem using @capacitor/filesystem.
 *
 * Key optimisations vs the old version:
 *  1. MODULE-LEVEL in-memory cache  – Filesystem.stat() is called only ONCE
 *     per URL per app session.  On subsequent renders / navigation the resolved
 *     local URI is returned instantly from the Map without any async I/O.
 *  2. DOWNLOAD QUEUE with concurrency limit  – At most MAX_CONCURRENT downloads
 *     run simultaneously so bandwidth is used efficiently and the device isn't
 *     flooded with 30+ parallel requests when a gallery opens. The newest
 *     request is served first (it is what is on screen now), requests from
 *     images that have since unmounted are dropped, a stuck download gives up
 *     its slot, and while a video plays only one image downloads at a time.
 *  3. INTERSECTION OBSERVER lazy loading  – Images outside the viewport don't
 *     start loading at all until they are about to scroll into view.
 *
 * Falls back to the remote src on web / when caching fails (graceful).
 */

import { Capacitor } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { isThumbUrl, thumbUrl } from "../utils/imageThumb";

// ─────────────────────────────────────────────────────────────────────────────
// 1. In-memory cache  (url → resolved local capacitor:// URI or null)
//    LRU-capped at MAX_CACHE_ENTRIES to prevent unbounded heap growth on
//    devices where the user views 1000+ gallery images in a session.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_CACHE_ENTRIES = 500;
const EVICT_COUNT = 100; // how many oldest entries to remove when cap is hit
const memCache = new Map<string, string | null>();
// Promise cache so concurrent requests for the same URL share one download
const inflightMap = new Map<string, Promise<string | null>>();

/** Add an entry to memCache with LRU eviction when cap is exceeded. */
function memCacheSet(url: string, value: string | null): void {
	// If key already present, delete first so re-inserting moves it to 'newest'
	memCache.delete(url);
	if (memCache.size >= MAX_CACHE_ENTRIES) {
		// Evict oldest EVICT_COUNT entries (Map iteration is insertion-order)
		let evicted = 0;
		for (const k of memCache.keys()) {
			memCache.delete(k);
			if (++evicted >= EVICT_COUNT) break;
		}
	}
	memCache.set(url, value);
}

/**
 * Disk cleanup ke baad in-memory cache bhi clear karo.
 * Agli load pe images fresh download/re-stat hongi.
 */
export function clearImageMemCache(): void {
	memCache.clear();
	// inflightMap khud bhi apne aap clear hota hai (finally block)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Download queue – max 4 concurrent Capacitor downloads
//
// Served newest-first. The old queue was first-in-first-out: opening a gallery
// queued every thumbnail on screen, and the photo the user then tapped waited
// behind all of them (and behind anything from screens already closed), so it
// sat on a skeleton. A stack serves the latest request, which is what is on
// screen right now, first.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_CONCURRENT = 4;
/** While a video plays, images get one slot so the video keeps the bandwidth. */
const MAX_CONCURRENT_DURING_VIDEO = 1;
/** A download that has not finished by now gives its slot back. */
const SLOT_TIMEOUT_MS = 45_000;
let activeDownloads = 0;
const waitStack: Array<() => void> = [];
let videoPlaying = false;

const concurrencyLimit = () =>
	videoPlaying ? MAX_CONCURRENT_DURING_VIDEO : MAX_CONCURRENT;

function acquireSlot(): Promise<void> {
	if (activeDownloads < concurrencyLimit()) {
		activeDownloads++;
		return Promise.resolve();
	}
	return new Promise<void>((resolve) => waitStack.push(resolve));
}

function releaseSlot() {
	activeDownloads--;
	pumpQueue();
}

function pumpQueue() {
	while (activeDownloads < concurrencyLimit() && waitStack.length > 0) {
		const next = waitStack.pop();
		activeDownloads++;
		next?.();
	}
}

/**
 * Called by the video player: while a video is playing, image downloads drop
 * to one at a time so they do not take the bandwidth the video needs.
 */
export function setVideoPlaybackActive(active: boolean): void {
	videoPlaying = active;
	if (!active) pumpQueue();
}

// How many mounted <CachedImage>s currently want each URL. A queued download
// whose images have all unmounted (screen closed, scrolled far away) is dropped
// when its turn comes instead of spending bandwidth on nothing.
const wantCount = new Map<string, number>();

function retain(url: string) {
	wantCount.set(url, (wantCount.get(url) ?? 0) + 1);
}

function release(url: string) {
	const n = (wantCount.get(url) ?? 0) - 1;
	if (n > 0) wantCount.set(url, n);
	else wantCount.delete(url);
}

/** Marker for "nobody wants this any more": not cached, looked up again next time. */
const CANCELLED = Symbol("cancelled");

// ─────────────────────────────────────────────────────────────────────────────
// Filesystem helpers
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_DIR = "cpbs_image_cache";

function urlToFilename(url: string): string {
	try {
		const u = new URL(url);
		const parts = u.pathname.split("/").filter(Boolean);
		const name = parts.slice(-2).join("_") || "image";
		let hash = 0;
		for (let i = 0; i < url.length; i++) {
			hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
		}
		const ext = parts[parts.length - 1]?.split(".").pop() || "jpg";
		return `${name}_${hash}.${ext}`;
	} catch {
		return `img_${Date.now()}.jpg`;
	}
}

async function ensureCacheDir() {
	try {
		await Filesystem.mkdir({
			path: CACHE_DIR,
			directory: Directory.Cache,
			recursive: true,
		});
	} catch (_) {
		/* already exists */
	}
}

async function deleteCachedFile(filename: string): Promise<void> {
	try {
		await Filesystem.deleteFile({
			path: `${CACHE_DIR}/${filename}`,
			directory: Directory.Cache,
		});
	} catch {
		/* not there */
	}
}

async function getCachedUri(filename: string): Promise<string | null> {
	const path = `${CACHE_DIR}/${filename}`;
	try {
		const stat = await Filesystem.stat({ path, directory: Directory.Cache });
		// An empty file is what an interrupted download leaves behind. Treated as
		// a hit, it showed a broken image every time until the next cleanup.
		if (!stat.uri || !(stat.size > 0)) {
			await deleteCachedFile(filename);
			return null;
		}
		return Capacitor.convertFileSrc(stat.uri);
	} catch {
		return null;
	}
}

async function downloadToCache(
	remoteUrl: string,
	filename: string,
): Promise<string | null | typeof CANCELLED> {
	const path = `${CACHE_DIR}/${filename}`;
	try {
		await ensureCacheDir();
		await acquireSlot();
		let released = false;
		const giveBack = () => {
			if (released) return;
			released = true;
			releaseSlot();
		};
		// A hung transfer used to hold its slot forever; with all four slots
		// hung, every image in the app stayed a skeleton.
		const slotTimer = setTimeout(giveBack, SLOT_TIMEOUT_MS);
		try {
			if (!wantCount.has(remoteUrl)) return CANCELLED;
			const uriResult = await Filesystem.getUri({
				path,
				directory: Directory.Cache,
			});
			const result = await FileTransfer.downloadFile({
				url: remoteUrl,
				path: uriResult.uri,
			});
			if (result.path) return Capacitor.convertFileSrc(result.path);
			return await getCachedUri(filename);
		} finally {
			clearTimeout(slotTimer);
			giveBack();
		}
	} catch (_) {
		// Do not leave a half-written file to be picked up as a cache hit.
		await deleteCachedFile(filename);
		return null;
	}
}

/**
 * Forget a local copy that failed to render (corrupt, or removed by Android's
 * cache trimming), so the next view downloads it again instead of failing on
 * the same file.
 */
function evictBrokenLocal(src: string): void {
	memCache.delete(src);
	void deleteCachedFile(urlToFilename(src));
}

/**
 * Resolve a remote URL to a local Capacitor URI.
 * Uses in-memory cache + inflight deduplication so the same URL is never
 * downloaded/stat'd more than once per app session.
 */
async function resolveImage(src: string): Promise<string | null> {
	// 1. In-memory hit
	if (memCache.has(src)) return memCache.get(src)!;

	// 2. Already resolving → share the same promise
	if (inflightMap.has(src)) return inflightMap.get(src)!;

	const promise = (async () => {
		const filename = urlToFilename(src);

		// 3. Filesystem cache hit
		const cached = await getCachedUri(filename);
		if (cached) {
			memCacheSet(src, cached);
			return cached;
		}

		// 4. Download
		const downloaded = await downloadToCache(src, filename);
		// Dropped because nobody is showing it any more: remember nothing, so the
		// next time it is shown it is looked up again.
		if (downloaded === CANCELLED) return null;
		const resolved = downloaded ?? null; // null → caller falls back to remote
		memCacheSet(src, resolved);
		return resolved;
	})();

	inflightMap.set(src, promise);
	promise.finally(() => inflightMap.delete(src));
	return promise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/** How long an image waits for its local copy before loading from the network. */
const REMOTE_FALLBACK_MS = 6000;

/** Load and decode an image off-screen. Resolves true once it can be painted. */
function preloadImage(url: string): Promise<boolean> {
	return new Promise((resolve) => {
		const img = new Image();
		img.decoding = "async";
		img.onload = () => resolve(true);
		img.onerror = () => resolve(false);
		img.src = url;
	});
}

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	src: string;
	/** Show a shimmer placeholder while loading (default: true) */
	showPlaceholder?: boolean;
	/**
	 * Pixels before the image enters the viewport at which loading starts.
	 * Increase for taller galleries so images pre-load just before scroll.
	 * Default 300px.
	 */
	rootMargin?: string;
	/**
	 * Show a resized copy this many pixels wide instead of the original — for
	 * places that draw the photo small (chips, tiles, cards). Use a `THUMB`
	 * size from utils/imageThumb. Falls back to the original if the resized
	 * copy cannot be loaded.
	 */
	thumbWidth?: number;
	/**
	 * Paint a resized copy of this width first, then swap in the original once
	 * it has fully loaded — for full-screen views (story viewer, zoom), which
	 * must end up at original quality but should not sit on a skeleton.
	 */
	progressiveWidth?: number;
}

export const CachedImage: React.FC<CachedImageProps> = ({
	src,
	alt = "",
	className = "",
	showPlaceholder = true,
	rootMargin = "300px",
	thumbWidth,
	progressiveWidth,
	...rest
}) => {
	const isNative = Capacitor.isNativePlatform();

	// The resized copy for `src` failed (proxy down, odd file): use the original.
	// Stored per src so a new photo gets a fresh attempt.
	const [thumbFailedFor, setThumbFailedFor] = useState<string | null>(null);
	const resizeWidth = thumbWidth ?? progressiveWidth;
	const firstSrc =
		resizeWidth && thumbFailedFor !== src ? thumbUrl(src, resizeWidth) : src;
	// Original to swap in after the first paint (progressive mode only).
	const upgradeSrc =
		progressiveWidth && !thumbWidth && firstSrc !== src ? src : null;

	const [displaySrc, setDisplaySrc] = useState<string>(
		isNative ? "" : firstSrc,
	);
	const [isLoading, setIsLoading] = useState<boolean>(isNative);
	const [inView, setInView] = useState<boolean>(!isNative); // web: always start loading
	const [imageLoaded, setImageLoaded] = useState<boolean>(false);
	const [hasError, setHasError] = useState<boolean>(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const isMountedRef = useRef(true);
	// The network URL that `displaySrc` stands for (displaySrc itself may be a
	// local file URI). Error handling needs it to know what to fall back to.
	const shownRemoteRef = useRef(firstSrc);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setImageLoaded(false);
		setHasError(false);
	}, [displaySrc]);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// ── IntersectionObserver – only on native (web uses browser lazy loading) ──
	useEffect(() => {
		if (!isNative) return;

		// If already in mem-cache, skip the observer and load immediately
		if (memCache.has(firstSrc)) {
			setInView(true);
			return;
		}

		const el = containerRef.current;
		if (!el || typeof IntersectionObserver === "undefined") {
			setInView(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setInView(true);
					observer.disconnect();
				}
			},
			{ rootMargin, threshold: 0 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [firstSrc, isNative, rootMargin]);

	// ── Image resolution ──────────────────────────────────────────────────────
	useEffect(() => {
		if (!firstSrc || !inView) return;

		let cancelled = false; // first paint settled or effect torn down
		let alive = true; // effect still current (guards the upgrade)
		const retained: string[] = [];

		// Progressive mode: once the resized copy is on screen, fetch the
		// original in the background and swap it in only when it is decoded, so
		// the picture sharpens in place with no blank frame in between.
		const upgrade = () => {
			if (!upgradeSrc) return;
			void (async () => {
				let target = upgradeSrc;
				if (isNative) {
					retain(upgradeSrc);
					retained.push(upgradeSrc);
					target = (await resolveImage(upgradeSrc)) ?? upgradeSrc;
				}
				if (!alive) return;
				const ok = await preloadImage(target);
				if (!alive || !ok || !isMountedRef.current) return;
				shownRemoteRef.current = upgradeSrc;
				setDisplaySrc(target);
			})();
		};

		if (!isNative) {
			shownRemoteRef.current = firstSrc;
			setDisplaySrc(firstSrc);
			setIsLoading(false);
			upgrade();
			return () => {
				alive = false;
			};
		}

		retain(firstSrc);
		retained.push(firstSrc);
		setIsLoading(true);
		setDisplaySrc("");

		const show = (resolved: string | null) => {
			if (cancelled || !isMountedRef.current) return;
			cancelled = true;
			clearTimeout(fallbackTimer);
			shownRemoteRef.current = firstSrc;
			setDisplaySrc(resolved ?? firstSrc); // fallback to remote URL if cache failed
			setIsLoading(false);
			upgrade();
		};
		// Still waiting after a few seconds (busy queue, slow storage): show the
		// image straight from the network instead of a skeleton. The local copy
		// is still saved for next time.
		const fallbackTimer = setTimeout(() => show(null), REMOTE_FALLBACK_MS);

		resolveImage(firstSrc).then(show);

		return () => {
			cancelled = true;
			alive = false;
			clearTimeout(fallbackTimer);
			for (const url of retained) release(url);
		};
	}, [firstSrc, upgradeSrc, isNative, inView]);

	// ── Render ────────────────────────────────────────────────────────────────
	const needsMinHeight = className.includes("h-auto");
	const imgRef = useRef<HTMLImageElement>(null);

	useEffect(() => {
		if (imgRef.current?.complete && displaySrc) {
			if (!imageLoaded) {
				setImageLoaded(true);
				if (rest.onLoad) {
					const fakeEvent = {
						currentTarget: imgRef.current,
						target: imgRef.current,
					} as unknown as React.SyntheticEvent<HTMLImageElement, Event>;
					rest.onLoad(fakeEvent);
				}
			}
		}
	}, [displaySrc, imageLoaded, rest.onLoad]);

	if (isNative && (isLoading || !inView) && showPlaceholder) {
		return (
			<div
				ref={containerRef}
				className={`bg-slate-200 dark:bg-slate-700 skeleton-shimmer ${needsMinHeight ? "min-h-[250px]" : ""} ${className}`}
				style={rest.style}
				aria-label={alt}
			/>
		);
	}

	if (!displaySrc && !isLoading) {
		return (
			<div
				ref={containerRef}
				className={`bg-slate-200 dark:bg-slate-700 flex items-center justify-center ${className}`}
				style={rest.style}
			>
				<svg
					className="w-8 h-8 text-slate-400 dark:text-ink-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
		);
	}

	const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
		setImageLoaded(true);
		if (rest.onLoad) rest.onLoad(e);
	};

	const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
		if (rest.onError) rest.onError(e);
		if (!isMountedRef.current) return;
		const remote = shownRemoteRef.current;
		// 1. The locally cached file is corrupt: use the network copy.
		if (displaySrc !== remote) {
			evictBrokenLocal(remote);
			setDisplaySrc(remote);
			return;
		}
		// 2. The resized copy failed (image proxy down): use the original.
		if (isThumbUrl(remote)) {
			setThumbFailedFor(src);
			return;
		}
		setHasError(true);
	};

	const isSkeleton = showPlaceholder && !imageLoaded && !hasError;
	const skeletonClasses = isSkeleton
		? `bg-slate-200 dark:bg-slate-700 skeleton-shimmer !text-transparent ${needsMinHeight ? "min-h-[250px]" : ""}`
		: "transition-opacity duration-300";
	const combinedClassName = `${className} ${skeletonClasses}`.trim();

	return (
		<img
			{...rest}
			ref={imgRef}
			src={displaySrc}
			alt={alt}
			className={combinedClassName}
			onLoad={handleLoad}
			onError={handleError}
			loading={isNative ? "eager" : (rest.loading ?? "lazy")}
			decoding="async"
		/>
	);
};

export default CachedImage;

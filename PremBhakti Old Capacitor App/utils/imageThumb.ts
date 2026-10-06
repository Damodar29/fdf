/**
 * imageThumb.ts
 *
 * Resized copies of gallery photos for places that show them small.
 *
 * Darshan / Activity photos are stored as the camera original (3000–4000 px,
 * 2–4 MB each), and every date chip, mandal tile and gallery card used to load
 * that full file. `thumbUrl` returns the same photo resized and re-encoded as
 * WebP by wsrv.nl — a free, Cloudflare-cached image proxy — so a 56 px chip
 * pulls a few KB instead of megabytes.
 *
 * Originals are still used wherever quality matters: download, share, the
 * full-screen story viewer and zoom. Callers pass `thumbWidth` /
 * `progressiveWidth` to CachedImage; everything else keeps the raw URL.
 *
 * If wsrv.nl fails for any reason, CachedImage falls back to the original URL,
 * so the worst case is the old behaviour, never a missing image.
 */

/** Widths in real pixels, sized for a 3× phone screen. Few sizes = more cache hits. */
export const THUMB = {
	/** Date chips, story avatar, tiny video icons (≤ 64 CSS px). */
	small: 200,
	/** Mandal tiles, video list thumbnails (≤ 130 CSS px). */
	tile: 400,
	/** Home screen photo slideshow tiles (~180 CSS px, half the screen). */
	homeTile: 540,
	/** Video cards (aspect-video, up to half/full width). */
	medium: 720,
	/** Photo cards in the gallery and the story viewer's first paint. */
	card: 1080,
} as const;

const THUMB_HOST = "wsrv.nl";

/** Hosts whose images are already small or are not ours to proxy. */
const SKIP_HOSTS = ["img.youtube.com", "i.ytimg.com", "localhost", THUMB_HOST];

/**
 * The resized-image URL for `url` at `width` px, or `url` unchanged when it is
 * not something worth resizing (app assets, data/blob/file URIs, YouTube
 * thumbnails, GIF/SVG, or already a thumbnail).
 */
export function thumbUrl(url: string, width: number): string {
	if (!url || !/^https?:\/\//i.test(url)) return url;
	let host: string;
	let path: string;
	try {
		const u = new URL(url);
		host = u.hostname;
		path = u.pathname;
	} catch {
		return url;
	}
	if (SKIP_HOSTS.includes(host)) return url;
	if (/\.(gif|svg)$/i.test(path)) return url;
	// `we` = never enlarge a photo that is already smaller than `width`.
	return `https://${THUMB_HOST}/?url=${encodeURIComponent(url)}&w=${width}&we&output=webp&q=80`;
}

export function isThumbUrl(url: string): boolean {
	return url.startsWith(`https://${THUMB_HOST}/`);
}

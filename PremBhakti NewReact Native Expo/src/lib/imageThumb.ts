// utils/imageThumb.ts of the Capacitor app: resized copies (wsrv.nl, WebP) of
// gallery photos for places that show them small. Callers fall back to the
// original URL when the resized copy fails.

/** Widths in real pixels, sized for a 3× phone screen. */
export const THUMB = { small: 200, tile: 400, homeTile: 540, medium: 720, card: 1080 } as const;

const THUMB_HOST = "wsrv.nl";
const SKIP_HOSTS = ["img.youtube.com", "i.ytimg.com", "localhost", THUMB_HOST];

export function thumbUrl(url: string, width: number): string {
	const m = /^https?:\/\/([^/?#:]+)[^/?#]*([^?#]*)/i.exec(url || "");
	if (!m) return url;
	const [, host, path] = m;
	if (SKIP_HOSTS.includes(host.toLowerCase())) return url;
	if (/\.(gif|svg)$/i.test(path)) return url;
	return `https://${THUMB_HOST}/?url=${encodeURIComponent(url)}&w=${width}&we&output=webp&q=80`;
}

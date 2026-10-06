/**
 * utils/cdnUrl.ts
 *
 * Central helper to resolve audio/media URLs through the correct CDN.
 *
 * Handles:
 *  1. GitHub release URLs  → audios.chaitanyaprembhakti.org (via Cloudflare Worker)
 *  2. B2 friendly URLs     → audios.chaitanyaprembhakti.org (strips bucket prefix)
 *  3. B2 S3 URLs           → audios.chaitanyaprembhakti.org (strips bucket prefix)
 *  4. B2 native API URLs   → left as-is (can't decode fileId to path)
 *  5. videos.chaitanya...  → left as-is (already on CDN)
 *  6. audios.chaitanya...  → left as-is (already on CDN)
 */

// Same worker the Capacitor build used (VITE_GITHUB_CDN_URL).
const GITHUB_CDN_BASE_URL = "https://mute-hat-56f3.chaitanyaprembhakti.workers.dev";

// ── Regexes ────────────────────────────────────────────────────────────────

// github.com/{owner}/{repo}/releases/download/{tag}/{filename}
const GITHUB_RELEASE_REGEX =
	/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+)$/;

// B2 friendly URL: https://f005.backblazeb2.com/file/{bucket}/{path}
const B2_FRIENDLY_REGEX =
	/^https?:\/\/f\d+\.backblazeb2\.com\/file\/([^/]+)\/(.+)$/;

// B2 S3 URL: https://{bucket}.s3.{region}.backblazeb2.com/{path}
const B2_S3_REGEX = /^https?:\/\/([^.]+)\.s3\.[^.]+\.backblazeb2\.com\/(.+)$/;

// The B2 prefix for audio files — strip this to get the CDN path
const AUDIOS_B2_BUCKET = "cpbs-videos";
const AUDIOS_B2_PREFIX = "Github Backup Files/CPBS-APP-ORIGNAL-PHASE-1/";
const AUDIOS_CDN_BASE = "https://audios.chaitanyaprembhakti.org";

/**
 * Given a B2 path (already URL-decoded), returns the audios CDN URL
 * if it belongs to the audio prefix, otherwise null.
 */
function b2PathToAudiosCdn(rawPath: string): string | null {
	// Normalise + → space and decode percent-encoding
	let decoded = rawPath.replace(/\+/g, " ");
	try {
		decoded = decodeURIComponent(decoded);
	} catch (_) {
		/* ignore */
	}

	if (decoded.startsWith(AUDIOS_B2_PREFIX)) {
		const relative = decoded.substring(AUDIOS_B2_PREFIX.length);
		return (
			AUDIOS_CDN_BASE +
			"/" +
			relative.split("/").map(encodeURIComponent).join("/")
		);
	}
	return null;
}

/**
 * Rewrites any known media URL to the appropriate CDN URL.
 * If the URL is already on a CDN or unrecognised, returns it unchanged.
 */
export function toCdnUrl(url: string): string {
	if (!url) return url;

	// Already on our CDNs — leave as-is
	if (
		url.startsWith("https://audios.chaitanyaprembhakti.org/") ||
		url.startsWith("https://videos.chaitanyaprembhakti.org/")
	)
		return url;

	// 1. GitHub release URL
	const ghMatch = url.match(GITHUB_RELEASE_REGEX);
	if (ghMatch) {
		// If we have a legacy CDN base configured, use it; otherwise go straight to audios CDN.
		// Legacy path: CDN_BASE/{owner}/{repo}/{tag}/{file}  (for videos worker)
		// New path: audios CDN for audio releases from CPBS-APP-ORIGNAL-PHASE-1
		if (GITHUB_CDN_BASE_URL) {
			const [, owner, repo, tag, file] = ghMatch;
			return `${GITHUB_CDN_BASE_URL}/${owner}/${repo}/${tag}/${file}`;
		}
		return url;
	}

	// 2. B2 friendly URL: https://f005.backblazeb2.com/file/cpbs-videos/{path}
	const b2FriendlyMatch = url.match(B2_FRIENDLY_REGEX);
	if (b2FriendlyMatch) {
		const [, bucket, path] = b2FriendlyMatch;
		if (bucket === AUDIOS_B2_BUCKET) {
			const cdn = b2PathToAudiosCdn(path);
			if (cdn) return cdn;
		}
		return url;
	}

	// 3. B2 S3 URL: https://cpbs-videos.s3.us-east-005.backblazeb2.com/{path}
	const b2S3Match = url.match(B2_S3_REGEX);
	if (b2S3Match) {
		const [, bucket, path] = b2S3Match;
		if (bucket === AUDIOS_B2_BUCKET) {
			const cdn = b2PathToAudiosCdn(path);
			if (cdn) return cdn;
		}
		return url;
	}

	// 4. Everything else (native B2 API URLs, Drive links, etc.) — leave as-is
	return url;
}

/**
 * Builds a GitHub release download URL for a given tag and filename.
 * Automatically routes through CDN if configured.
 */
export function buildReleaseUrl(
	owner: string,
	repo: string,
	tag: string,
	fileName: string,
): string {
	const rawUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${fileName}`;
	return toCdnUrl(rawUrl);
}

/**
 * utils/audioStorage.ts getPlayableUrl: Google Drive share links become direct
 * downloads, everything else goes through toCdnUrl.
 */
export function getPlayableUrl(url: string): string {
	if (!url) return "";
	if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
		const fileId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
		if (fileId) return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
		return url;
	}
	return toCdnUrl(url);
}

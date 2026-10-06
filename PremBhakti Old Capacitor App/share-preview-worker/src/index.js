/**
 * share-preview — answers share links (https://chaitanyaprembhakti.org/v/...)
 * at Cloudflare's edge, in front of Firebase Hosting.
 *
 * Before this, every tap on a shared link ran the serveVideoPreview Cloud
 * Function (Hosting rewrites /v/** to it, uncached). Now:
 *
 *   • People (browsers)      → 302 straight to the app page. No database read,
 *                              no function call, no HTML page in between.
 *   • Preview fetchers       → video and folder previews are built here from
 *     (WhatsApp, Facebook…)    Firestore's public REST API; mandal previews
 *                              are proxied to the function. Either way the
 *                              page is cached here for 10 minutes, so a link
 *                              shared in a big group is built once.
 *   • Anything unexpected    → handed to the origin (the function) unchanged,
 *                              so a bug here can never break a shared link.
 *
 * Link formats and target URLs must match utils/shareLinks.ts and the
 * serveVideoPreview function in functions/src/index.ts.
 */

const SITE = "https://chaitanyaprembhakti.org";
const FIRESTORE =
	"https://firestore.googleapis.com/v1/projects/cpbs-admin/databases/(default)/documents";
const PREVIEW_CACHE_SECONDS = 600;

// Link-preview fetchers. Everyone else is a person and gets a plain redirect.
const PREVIEW_BOT_UA =
	/bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|twitter|slack|discord|linkedin|pinterest|skype|viber|line\/|kakaotalk|snapchat|embedly|preview|vkshare|redditbot|applebot|googleother|google-inspectiontool/i;

const escapeHtml = (value) =>
	String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const decode = (part) => {
	try {
		return decodeURIComponent(part);
	} catch {
		return part;
	}
};

/** Same parsing as utils/shareLinks.ts → { kind, ids, appUrl } or null. */
function parseShare(pathname) {
	const parts = pathname.split("/").filter(Boolean).map(decode);
	if (parts[0] !== "v") return null;
	const enc = encodeURIComponent;
	if (parts[1] === "video" && parts.length === 3)
		return {
			kind: "video",
			id: parts[2],
			appUrl: `${SITE}/?videoId=${enc(parts[2])}`,
		};
	if (parts[1] === "folder" && parts.length === 3)
		return {
			kind: "folder",
			id: parts[2],
			appUrl: `${SITE}/?videoFolder=${enc(parts[2])}`,
		};
	if (parts[1] === "mandal" && parts.length === 4)
		return {
			kind: "mandal",
			appUrl: `${SITE}/?mandalVideoId=${enc(parts[3])}`,
		};
	if (parts[1] === "mandal-photos" && parts.length === 4)
		return {
			kind: "mandal-photos",
			appUrl: `${SITE}/?mandalPhotos=true&mandalId=${enc(parts[2])}&mandalDate=${enc(parts[3])}`,
		};
	if (parts.length === 2)
		return {
			kind: "video",
			id: parts[1],
			appUrl: `${SITE}/?videoId=${enc(parts[1])}`,
		};
	return null;
}

const youtubeThumbnail = (url) => {
	if (typeof url !== "string" || !url.includes("youtu")) return "";
	const m = url.match(
		/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/,
	);
	return m?.[1] ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : "";
};

/** Reads a few top-level fields of one public document; null if missing. */
async function readDoc(collection, id, fields) {
	const mask = fields.map((f) => `mask.fieldPaths=${f}`).join("&");
	const res = await fetch(
		`${FIRESTORE}/${collection}/${encodeURIComponent(id)}?${mask}`,
	);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Firestore ${res.status}`);
	const json = await res.json();
	const out = {};
	for (const [key, value] of Object.entries(json.fields || {})) {
		out[key] = value.stringValue ?? value.booleanValue ?? null;
	}
	return out;
}

async function buildPreview(share, pathname) {
	let title = "Watch Video";
	let description = "Watch this video on Prem Bhakti app";
	let image = `${SITE}/icon.webp`;

	if (share.kind === "video") {
		const v = await readDoc("videos", share.id, [
			"title",
			"thumbnailUrl",
			"useDefaultThumbnail",
			"url",
		]);
		if (v) {
			title = v.title || title;
			image =
				(!v.useDefaultThumbnail && v.thumbnailUrl) ||
				youtubeThumbnail(v.url) ||
				image;
		}
	} else {
		const f = await readDoc("video_folders", share.id, [
			"name",
			"thumbnailUrl",
			"useDefaultThumbnail",
		]);
		if (f) {
			title = f.name || "Video Collection";
			if (!f.useDefaultThumbnail && f.thumbnailUrl) image = f.thumbnailUrl;
			description = `Watch the '${title}' collection on Prem Bhakti app`;
		}
	}

	const t = escapeHtml(title);
	const d = escapeHtml(description);
	const img = escapeHtml(image);
	const target = escapeHtml(share.appUrl);
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <meta property="og:site_name" content="Prem Bhakti">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:alt" content="${t}">
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${escapeHtml(SITE + pathname)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">
  <meta http-equiv="refresh" content="0;url=${target}">
</head>
<body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
  <p><a href="${target}">Open in Prem Bhakti</a></p>
</body>
</html>`;
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const share = request.method === "GET" ? parseShare(url.pathname) : null;
		// Not a share link we understand — let Firebase handle it as before.
		if (!share) return fetch(request);

		if (!PREVIEW_BOT_UA.test(request.headers.get("user-agent") || "")) {
			return new Response(null, {
				status: 302,
				headers: { Location: share.appUrl, "Cache-Control": "no-store" },
			});
		}

		try {
			// One cached preview per link (query strings like ?fbclid ignored).
			const cache = caches.default;
			const cacheKey = new Request(`${url.origin}${url.pathname}`, {
				method: "GET",
			});
			const cached = await cache.match(cacheKey);
			if (cached) return cached;

			let response;
			if (share.kind === "video" || share.kind === "folder") {
				response = new Response(await buildPreview(share, url.pathname), {
					headers: {
						"Content-Type": "text/html; charset=utf-8",
						"Cache-Control": `public, max-age=${PREVIEW_CACHE_SECONDS}`,
					},
				});
			} else {
				// Mandal documents are large (every photo and video of the mandal);
				// parsing them here could pass the free plan's 10 ms CPU limit, so
				// the function keeps building these — cached here afterwards.
				const origin = await fetch(request);
				if (!origin.ok) return origin;
				response = new Response(origin.body, origin);
				response.headers.set(
					"Cache-Control",
					`public, max-age=${PREVIEW_CACHE_SECONDS}`,
				);
			}
			ctx.waitUntil(cache.put(cacheKey, response.clone()));
			return response;
		} catch (err) {
			console.error("share-preview failed, falling back to origin", err);
			return fetch(request);
		}
	},
};

/**
 * Cloudflare Worker: GitHub Release CDN Proxy + Firebase Storage CDN Proxy
 *
 * Purpose:
 *   - Caches GitHub release assets at Cloudflare edge nodes globally
 *   - Caches Firebase Storage JSON data files at Cloudflare edge nodes globally
 *   - Avoids GitHub anonymous rate limiting
 *   - Resolves the CORS redirect chain (github.com → objects.githubusercontent.com)
 *   - Supports HTTP Range requests for audio/video streaming
 *
 * URL Contracts:
 *   GitHub:  GET /{owner}/{repo}/{tag}/{filename}
 *            → Proxied to github.com/{owner}/{repo}/releases/download/{tag}/{filename}
 *
 *   Firebase Storage:  GET /firebase/{storagePath}
 *            → Proxied to firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media
 */

const FIREBASE_BUCKET = "cpbs-admin.firebasestorage.app";

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Handle CORS preflight requests
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
					"Access-Control-Allow-Headers":
						"Content-Type, Cache-Control, Pragma, Authorization, Range, x-github-release-id, x-github-filename, x-github-token",
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		// Check if the client wants to use this as a generic CORS proxy (e.g. ?url=https://drive.google.com/...)
		const proxyUrl = url.searchParams.get("url");
		if (proxyUrl) {
			try {
				const proxyRes = await fetch(proxyUrl, {
					method: request.method,
					headers: {
						...(request.headers.has("Range")
							? { Range: request.headers.get("Range") }
							: {}),
						"User-Agent": "Mozilla/5.0 (CPBS-CDN-Worker/1.0)",
					},
					redirect: "follow",
				});

				const proxyHeaders = new Headers(proxyRes.headers);
				proxyHeaders.set("Access-Control-Allow-Origin", "*");
				proxyHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
				proxyHeaders.set(
					"Access-Control-Allow-Headers",
					"Range, Content-Type, Cache-Control, Pragma",
				);
				proxyHeaders.set(
					"Access-Control-Expose-Headers",
					"Content-Length, Content-Range, Accept-Ranges, Content-Disposition",
				);
				// Ensure the browser can download it natively if it's an attachment

				return new Response(proxyRes.body, {
					status: proxyRes.status,
					statusText: proxyRes.statusText,
					headers: proxyHeaders,
				});
			} catch (err) {
				return new Response(`Proxy Error: ${err.message}`, { status: 500 });
			}
		}

		// ── Direct GitHub Upload Proxy ─────────────────────────────────────────
		// Route: POST /upload
		// Headers required: x-github-release-id, x-github-filename, x-github-token
		if (request.method === "POST" && url.pathname === "/upload") {
			const releaseId = request.headers.get("x-github-release-id");
			const fileName = request.headers.get("x-github-filename");
			const token = request.headers.get("x-github-token");

			if (!releaseId || !fileName || !token) {
				return new Response(
					JSON.stringify({ error: "Missing required headers" }),
					{
						status: 400,
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					},
				);
			}

			try {
				const githubUrl = `https://uploads.github.com/repos/chaitanyaprembhakti/CPBS-DAILY/releases/${releaseId}/assets?name=${encodeURIComponent(decodeURIComponent(fileName))}`;
				const githubResponse = await fetch(githubUrl, {
					method: "POST",
					headers: {
						Authorization: `token ${token}`,
						"Content-Type":
							request.headers.get("Content-Type") || "application/octet-stream",
						"User-Agent": "CPBS-CDN-Worker",
					},
					// We pass the raw body straight to GitHub
					body: request.body,
					// duplex: 'half' is required in Workers when passing a request.body stream to fetch
					duplex: "half",
				});

				if (!githubResponse.ok) {
					const errText = await githubResponse.text();
					return new Response(
						JSON.stringify({
							error: `GitHub API error: ${githubResponse.status}`,
							details: errText,
						}),
						{
							status: githubResponse.status,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						},
					);
				}

				const data = await githubResponse.json();
				return new Response(
					JSON.stringify({ url: data.browser_download_url }),
					{
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					},
				);
			} catch (error) {
				return new Response(
					JSON.stringify({
						error: "Upload proxy failed",
						details: error.message,
					}),
					{
						status: 500,
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					},
				);
			}
		}

		// ── Firebase Storage CDN Proxy ─────────────────────────────────────────
		// Route: /firebase/{storagePath}
		// Example: /firebase/app-data/bhajandata/index.json
		//    → https://firebasestorage.googleapis.com/v0/b/.../o/app-data%2Fbhajandata%2Findex.json?alt=media
		if (url.pathname.startsWith("/firebase/")) {
			const storagePath = url.pathname.slice("/firebase/".length); // e.g. "app-data/bhajandata/index.json"
			const encodedPath = encodeURIComponent(storagePath);
			const fsUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o/${encodedPath}?alt=media`;

			const reqCacheControl = request.headers.get("Cache-Control") || "";
			const isForceFresh =
				reqCacheControl.includes("no-cache") ||
				reqCacheControl.includes("no-store");

			const cacheKey = new Request(fsUrl, { method: "GET" });
			const cache = caches.default;

			if (!isForceFresh) {
				const cached = await cache.match(cacheKey);
				if (cached) {
					const response = new Response(cached.body, cached);
					response.headers.set("X-CDN-Cache", "HIT");
					return response;
				}
			}

			const fsResponse = await fetch(fsUrl, {
				headers: { ...(isForceFresh ? { "Cache-Control": "no-cache" } : {}) },
				redirect: "follow",
			});

			if (!fsResponse.ok) {
				return new Response(`Firebase Storage returned ${fsResponse.status}`, {
					status: fsResponse.status,
				});
			}

			const isJson = storagePath.endsWith(".json");
			const ttl = isJson ? 3600 : 86400;

			const responseHeaders = new Headers(fsResponse.headers);
			responseHeaders.set("Access-Control-Allow-Origin", "*");
			responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
			responseHeaders.set(
				"Access-Control-Allow-Headers",
				"Range, Content-Type, Cache-Control, Pragma",
			);
			responseHeaders.set(
				"Access-Control-Expose-Headers",
				"Content-Length, X-CDN-Cache",
			);
			responseHeaders.set("Cache-Control", `public, max-age=${ttl}`);
			responseHeaders.set("X-CDN-Cache", isForceFresh ? "BYPASS" : "MISS");

			const response = new Response(fsResponse.body, {
				status: fsResponse.status,
				statusText: fsResponse.statusText,
				headers: responseHeaders,
			});

			ctx.waitUntil(cache.put(cacheKey, response.clone()));
			return response;
		}

		// ── GitHub Release CDN Proxy ───────────────────────────────────────────
		// Path format: /{owner}/{repo}/{tag}/{filename}
		const parts = url.pathname.slice(1).split("/");
		if (parts.length < 4) {
			return new Response(
				"Bad Request: expected /{owner}/{repo}/{tag}/{filename} OR ?url=TARGET_URL",
				{ status: 400 },
			);
		}

		const [owner, repo, tag, ...fileParts] = parts;
		const filename = fileParts.join("/");

		// Check if the client is requesting a fresh/bypass fetch (Force Sync scenario)
		const reqCacheControl = request.headers.get("Cache-Control") || "";
		const isForceFresh =
			reqCacheControl.includes("no-cache") ||
			reqCacheControl.includes("no-store");

		// Build a STABLE cache key by stripping internal cache-buster params (_c, _attempt).
		// These params change per-device/per-timestamp, so we strip them for the cache key,
		// ensuring all devices share the same CDN cached entry for the same file.
		const stableParams = new URLSearchParams();
		for (const [k, v] of url.searchParams.entries()) {
			if (k !== "_c" && k !== "_attempt") stableParams.set(k, v); // strip internal cache-busters
		}
		// INTERCEPT LEGACY DATA REQUESTS:
		// Old versions of the app fetch data files from GitHub Releases via this CDN.
		// Since we moved data to Firebase Storage, we must transparently serve these
		// requests from Firebase Storage so old apps continue to get fresh data.
		const DATA_TAGS = ["bhajandata", "bookdata", "lecturedata", "appconfig"];
		if (DATA_TAGS.includes(tag)) {
			// Rewrite the URL internally to use the Firebase Storage proxy logic above
			const firebaseInternalUrl = new URL(
				`/firebase/app-data/${tag}/${filename}${url.search}`,
				url.origin,
			);
			return this.fetch(new Request(firebaseInternalUrl, request), env, ctx);
		}

		const stableSearch = stableParams.toString()
			? `?${stableParams.toString()}`
			: "";
		const githubUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${filename}${stableSearch}`;

		// Use Cloudflare Cache API with the stable URL as the key
		const cacheKey = new Request(githubUrl, { method: "GET" });
		const cache = caches.default;

		// Try cache first — but skip if this is a force-fresh request
		if (!isForceFresh) {
			const cached = await cache.match(cacheKey);
			if (cached) {
				const response = new Response(cached.body, cached);
				response.headers.set("X-CDN-Cache", "HIT");
				return response;
			}
		}

		// Fetch from GitHub, following redirects
		const githubResponse = await fetch(githubUrl, {
			method: request.method,
			headers: {
				// Forward Range header for streaming support
				...(request.headers.has("Range")
					? { Range: request.headers.get("Range") }
					: {}),
				"User-Agent": "Mozilla/5.0 (CPBS-CDN-Worker/1.0)",
				// When force-fresh, tell GitHub's CDN not to serve stale too
				...(isForceFresh ? { "Cache-Control": "no-cache" } : {}),
			},
			redirect: "follow",
		});

		if (!githubResponse.ok && githubResponse.status !== 206) {
			return new Response(`GitHub returned ${githubResponse.status}`, {
				status: githubResponse.status,
			});
		}

		// Determine cache TTL by file type
		const isJson = filename.endsWith(".json");
		const ttl = isJson ? 3600 : 86400;

		// Build response with CORS and cache headers
		const responseHeaders = new Headers(githubResponse.headers);
		responseHeaders.set("Access-Control-Allow-Origin", "*");
		responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
		responseHeaders.set(
			"Access-Control-Allow-Headers",
			"Range, Content-Type, Cache-Control, Pragma",
		);
		responseHeaders.set(
			"Access-Control-Expose-Headers",
			"Content-Length, Content-Range, Accept-Ranges, X-CDN-Cache",
		);
		responseHeaders.set("Cache-Control", `public, max-age=${ttl}`);
		responseHeaders.set("X-CDN-Cache", isForceFresh ? "BYPASS" : "MISS");
		// Override Content-Disposition: attachment (set by GitHub) to inline so browsers
		// can render images/audio directly in <img> and <audio> tags without triggering onError.
		responseHeaders.set("Content-Disposition", "inline");

		const response = new Response(githubResponse.body, {
			status: githubResponse.status,
			statusText: githubResponse.statusText,
			headers: responseHeaders,
		});

		// Always update the cache with the fresh response (even on force-fresh, so next device gets it from CDN)
		ctx.waitUntil(cache.put(cacheKey, response.clone()));

		return response;
	},
};

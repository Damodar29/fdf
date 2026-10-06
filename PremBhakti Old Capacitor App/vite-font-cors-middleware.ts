// vite-font-cors-middleware.js
export function fontCorsMiddleware() {
	return {
		name: "font-cors-middleware",
		apply: "serve" as const,
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				// Check if requesting a font file
				if (req.url.match(/\.woff2?(\?|$)/)) {
					res.setHeader("Access-Control-Allow-Origin", "*");
					res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
					res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
					res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
					res.setHeader("Cache-Control", "public, max-age=31536000");

					// Handle OPTIONS preflights
					if (req.method === "OPTIONS") {
						res.writeHead(204);
						res.end();
						return;
					}
				}
				next();
			});
		},
	};
}

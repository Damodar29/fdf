import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { fontCorsMiddleware } from "./vite-font-cors-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode, command }) => {
	const env = loadEnv(mode, ".", "");
	const isDev = mode === "development" || command === "serve";
	return {
		server: {
			// PORT lets a second dev server run beside the first (Claude preview).
			port: Number(process.env.PORT) || 3000,
			host: "0.0.0.0",
			...(isDev ? { allowedHosts: true } : {}),
			watch: {
				ignored: [
					"**/node_modules/**",
					"**/.git/**",
					"**/dist/**",
					"**/test_dist/**",
					"**/functions/**",
					"**/android/**",
					"**/mobile-app/**",
					"**/.wrangler/**",
					"**/.firebase/**",
					"**/b2-worker/**",
					"**/temp_videos/**",
					"**/temp_video/**",
					"**/backup/**",
					"**/reports/**",
					"**/scripts/**",
					"**/graphify-out/**",
					"**/.cursor/**",
					"**/.gemini/**",
					"**/.claude/**",
					"**/.artifacts/**",
					"**/.idea/**",
					"**/scratch/**",
					"**/ruflo/**",
					"**/.swarm/**",
					"**/.claude-flow/**",
					"**/.agents/**",
					"**/*.json", // Ignore json files in root/watcher
				],
			},
			headers: {
				"Cross-Origin-Opener-Policy": "same-origin-allow-popups",
			},
			proxy: {
				"/api/github-upload": {
					target: "https://uploads.github.com",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/api\/github-upload/, ""),
					configure: (proxy, _options) => {
						proxy.on("proxyReq", (proxyReq, _req, _res) => {
							proxyReq.setHeader("User-Agent", "CPBS-Admin-App");
						});
					},
				},
				"/api/github": {
					target: "https://api.github.com",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/api\/github/, ""),
					configure: (proxy, _options) => {
						proxy.on("proxyReq", (proxyReq, _req, _res) => {
							proxyReq.setHeader("User-Agent", "CPBS-Admin-App");
						});
					},
				},
				"/github-releases": {
					target:
						"https://github.com/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/releases/download",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/github-releases/, ""),
					// Tell http-proxy to follow redirects so we get the file, not a 302
					followRedirects: true,
				},
			},
		},
		optimizeDeps: {
			include: ["firebase/messaging"],
			entries: ["index.html"],
		},
		plugins: [
			react(),
			fontCorsMiddleware(),
			// ─── Inject Firebase env vars into Service Worker at build time ───────
			// The service worker can't use import.meta.env (it runs outside the module
			// graph). Instead, we substitute __VITE_FIREBASE_*__ placeholders in
			// public/firebase-messaging-sw.js during the build using real env values.
			{
				name: "inject-sw-env-vars",
				configureServer(server) {
					server.middlewares.use((req, res, next) => {
						if (req.url === "/firebase-messaging-sw.js") {
							const swPath = path.resolve(
								__dirname,
								"public",
								"firebase-messaging-sw.js",
							);
							if (fs.existsSync(swPath)) {
								let code = fs.readFileSync(swPath, "utf-8");
								code = code
									.replace(
										/__VITE_FIREBASE_API_KEY__/g,
										env.VITE_FIREBASE_API_KEY || "",
									)
									.replace(
										/__VITE_FIREBASE_AUTH_DOMAIN__/g,
										env.VITE_FIREBASE_AUTH_DOMAIN || "",
									)
									.replace(
										/__VITE_FIREBASE_PROJECT_ID__/g,
										env.VITE_FIREBASE_PROJECT_ID || "",
									)
									.replace(
										/__VITE_FIREBASE_STORAGE_BUCKET__/g,
										env.VITE_FIREBASE_STORAGE_BUCKET || "",
									)
									.replace(
										/__VITE_FIREBASE_MESSAGING_SENDER_ID__/g,
										env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
									)
									.replace(
										/__VITE_FIREBASE_APP_ID__/g,
										env.VITE_FIREBASE_APP_ID || "",
									);
								res.setHeader("Content-Type", "application/javascript");
								res.end(code);
								return;
							}
						}
						next();
					});
				},
				generateBundle(_options, bundle) {
					const swFile = bundle["firebase-messaging-sw.js"];
					if (
						swFile &&
						swFile.type === "asset" &&
						typeof swFile.source === "string"
					) {
						swFile.source = swFile.source
							.replace(
								/__VITE_FIREBASE_API_KEY__/g,
								env.VITE_FIREBASE_API_KEY || "",
							)
							.replace(
								/__VITE_FIREBASE_AUTH_DOMAIN__/g,
								env.VITE_FIREBASE_AUTH_DOMAIN || "",
							)
							.replace(
								/__VITE_FIREBASE_PROJECT_ID__/g,
								env.VITE_FIREBASE_PROJECT_ID || "",
							)
							.replace(
								/__VITE_FIREBASE_STORAGE_BUCKET__/g,
								env.VITE_FIREBASE_STORAGE_BUCKET || "",
							)
							.replace(
								/__VITE_FIREBASE_MESSAGING_SENDER_ID__/g,
								env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
							)
							.replace(
								/__VITE_FIREBASE_APP_ID__/g,
								env.VITE_FIREBASE_APP_ID || "",
							);
					}
				},
			},
			VitePWA({
				// generateSW: VitePWA creates a precaching SW that wraps our firebase-messaging-sw.js.
				// registerType 'autoUpdate' → new SW activates immediately on deploy → page auto-reloads.
				registerType: "autoUpdate",
				injectRegister: false, // We handle SW registration in index.html
				strategies: "generateSW",
				workbox: {
					// Precache all JS/CSS/HTML so the app loads offline and updates atomically
					globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
					globIgnores: ["**/sounds/**", "**/444.png"],
					cleanupOutdatedCaches: true,
					skipWaiting: true, // Equivalent to responding to SKIP_WAITING
					clientsClaim: true,
					maximumFileSizeToCacheInBytes: 5000000, // 5 MB
					// Import the firebase-messaging-sw script so push notifications still work
					importScripts: ["/firebase-messaging-sw.js"],
				},
				manifest: {
					name: "Shri Chaitanya Prem Bhakti Sangh",
					short_name: "Prem Bhakti",
					description:
						"Official app of Shri Chaitanya Prem Bhakti Sangh — daily quotes, bhajans, events and more.",
					theme_color: "#0B2E6B",
					background_color: "#071529",
					display: "standalone",
					orientation: "portrait",
					start_url: "/",
					icons: [
						{
							src: "/icons/icon-48.webp",
							sizes: "48x48",
							type: "image/webp",
							purpose: "any",
						},
						{
							src: "/icons/icon-72.webp",
							sizes: "72x72",
							type: "image/webp",
							purpose: "any",
						},
						{
							src: "/icons/icon-96.webp",
							sizes: "96x96",
							type: "image/webp",
							purpose: "any",
						},
						{
							src: "/icons/icon-128.webp",
							sizes: "128x128",
							type: "image/webp",
							purpose: "any",
						},
						{
							src: "/icons/icon-192.webp",
							sizes: "192x192",
							type: "image/webp",
							purpose: "any maskable",
						},
						{
							src: "/icons/icon-256.webp",
							sizes: "256x256",
							type: "image/webp",
							purpose: "any",
						},
						{
							src: "/icons/icon-512.webp",
							sizes: "512x512",
							type: "image/webp",
							purpose: "any maskable",
						},
					],
				},
				devOptions: {
					enabled: false, // No PWA in dev to avoid HMR conflicts
				},
			}),
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "."),
			},
		},
		build: {
			minify: "terser",
			terserOptions: {
				compress: {
					// Strip all console.* and debugger statements from production bundles.
					// This prevents internal data, FCM tokens, and admin actions from being
					// visible in DevTools on the live site.
					drop_console: true,
					drop_debugger: true,
				},
			},
			rollupOptions: {
				output: {
					manualChunks: {
						"vendor-react": ["react", "react-dom"],
						"vendor-lucide": ["lucide-react"],
						// Firebase split into its own chunk — heavy library (~350KB gzipped).
						// Low-end devices parse JS ~3x slower than flagship; keeping Firebase
						// separate means the main UI renders before Firebase is even parsed.
						"vendor-firebase": [
							"firebase/app",
							"firebase/auth",
							"firebase/firestore",
							"firebase/storage",
							"firebase/functions",
							"firebase/messaging",
						],
						// Capacitor core APIs used on every screen
						"vendor-capacitor": [
							"@capacitor/core",
							"@capacitor/filesystem",
							"@capacitor/preferences",
						],
						// GenAI is only used in specific AI features — lazy load it
						// "vendor-ai": ["@google/genai"], // Not directly imported; no-op chunk removed
					},
				},
			},
			chunkSizeWarningLimit: 1000,
		},
	};
});

import { CapacitorUpdater } from "@capgo/capacitor-updater";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { Crashlytics } from "./utils/Crashlytics";
import "./index.css";

// M3/D2: Defer notifyAppReady() to after the first render tick.
// Calling it synchronously at module load risks firing it before React has
// painted anything — on Xiaomi MIUI/HyperOS with a 3-second cold-launch
// timeout, the activity can be killed between bundle parse and DOM paint,
// causing Capgo to silently roll back to the previous bundle.
// setTimeout(0) ensures the JS event loop has completed one full render cycle.
setTimeout(() => {
	CapacitorUpdater.notifyAppReady();
}, 0);

// After a Capgo OTA bundle swap, a React.lazy() chunk from the old bundle
// (e.g. QuotePopup-<oldhash>.js) no longer exists, so the dynamic import fails
// with "Failed to fetch dynamically imported module" and the error boundary
// shows. Reload once to pick up the new bundle's chunk names. The 10s guard
// prevents a reload loop if the chunk is genuinely missing.
window.addEventListener("vite:preloadError", (event) => {
	const KEY = "chunkReloadAt";
	try {
		const last = Number(sessionStorage.getItem(KEY) || 0);
		if (Date.now() - last < 10_000) return; // let the error surface normally
		sessionStorage.setItem(KEY, String(Date.now()));
	} catch {
		return;
	}
	event.preventDefault();
	window.location.reload();
});

// Global error handlers for non-React/async errors
window.onerror =(message, _source, _lineno, _colno, error) => {
	// Filter known benign browser media errors — these are not real crashes and
	// only create noise in the Crashlytics dashboard. The AudioContext.tsx
	// onAudioError handler already handles these gracefully at the component level.
	const msg = String(message);
	if (
		msg.includes("no supported sources") ||
		msg.includes("media was removed from the document") ||
		msg.includes("play() request was interrupted") ||
		msg.includes("The operation was aborted") ||
		msg.includes("AbortError")
	) {
		return false; // Suppress — benign media noise
	}
	Crashlytics.recordException(error || message);
	return false;
};

window.onunhandledrejection = (event) => {
	// Also filter unhandled promise rejections from media play() interruptions.
	// These happen when audio.play() is called and then immediately aborted
	// (e.g. user switches tracks quickly), and the rejection bubbles unhandled.
	const reason = event.reason;
	const reasonMsg =
		reason instanceof Error ? reason.message : String(reason ?? "");
	// NotSupportedError ("The element has no supported sources.") is what
	// audio.play() rejects with when src is empty/unplayable — it was already
	// filtered in window.onerror above, but as a promise rejection it slipped
	// through here and was the #1 non-fatal in Crashlytics (v46).
	if (
		reason?.name === "AbortError" ||
		reason?.name === "NotSupportedError" ||
		reasonMsg.includes("no supported sources") ||
		reasonMsg.includes("interrupted") ||
		reasonMsg.includes("media was removed from the document") ||
		reasonMsg.includes("play() request was interrupted")
	) {
		return; // Suppress — benign media noise
	}
	Crashlytics.recordException(reason || "Unhandled Promise Rejection");
};

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Could not find root element to mount to");
}

import { Toaster } from "./components/ui/sonner";

const root = ReactDOM.createRoot(rootElement);
root.render(
	<React.StrictMode>
		<GlobalErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<App />
				<Toaster />
			</QueryClientProvider>
		</GlobalErrorBoundary>
	</React.StrictMode>,
);

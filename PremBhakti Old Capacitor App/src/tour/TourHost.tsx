/**
 * TourHost.tsx — mounts the guided tour without slowing startup.
 *
 * `ProductTour` is loaded with React.lazy about a second after the splash has
 * gone (or at once when someone asks for a replay), so nothing of the tour is
 * parsed or run on the startup path. It sits in its own error boundary: if
 * anything in the tour throws, the tour simply disappears for this session —
 * the app and `GlobalErrorBoundary` never see it.
 */
import React, { Component, Suspense, useEffect, useState } from "react";
import { useAppStore } from "../../store/appStore";
import { onTourReplay } from "./tourBus";

const ProductTour = React.lazy(() => import("./ProductTour"));

/** How long after the splash is gone before the tour chunk is fetched. */
const MOUNT_DELAY_MS = 1200;

class TourErrorBoundary extends Component<
	{ children: React.ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		console.warn("[tour] turned off for this session:", error);
	}

	render() {
		return this.state.failed ? null : this.props.children;
	}
}

export function TourHost() {
	const isSplashRemoved = useAppStore((s) => s.isSplashRemoved);
	const [ready, setReady] = useState(false);

	useEffect(() => onTourReplay(() => setReady(true)), []);

	useEffect(() => {
		if (!isSplashRemoved || ready) return;
		const timer = window.setTimeout(() => setReady(true), MOUNT_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [isSplashRemoved, ready]);

	if (!ready) return null;
	return (
		<TourErrorBoundary>
			<Suspense fallback={null}>
				<ProductTour />
			</Suspense>
		</TourErrorBoundary>
	);
}

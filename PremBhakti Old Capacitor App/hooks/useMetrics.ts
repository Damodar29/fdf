import { doc, increment, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebase";
import { iosOnSnapshotDoc, shouldUseRestFallback } from "../utils/firebaseRest";
import { safeLocalSet } from "../utils/safeLocalSet";

// Generate / retrieve a stable anonymous device ID for dedup
function getDeviceId(): string {
	let id = localStorage.getItem("cpbs_device_id");
	if (!id) {
		id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
		safeLocalSet("cpbs_device_id", id);
	}
	return id;
}

export interface ItemMetrics {
	likes: number;
	views: number;
	commentsCount?: number;
}

export type MetricsMap = Record<string, ItemMetrics>;

export const useMetrics = (category: "darshan" | "activities" | "videos") => {
	const [metrics, setMetrics] = useState<MetricsMap>({});
	const [localLikes, setLocalLikes] = useState<Set<string>>(new Set());
	const [localViews, setLocalViews] = useState<Set<string>>(new Set());

	const { user } = useAuth();
	// Unique key per user (logged in) or per device (anonymous)
	const interactionKey = user ? `user_${user.uid}` : getDeviceId();

	// Load local interactions from storage to prevent multiple increments from same device/user
	useEffect(() => {
		try {
			const storedLikes = localStorage.getItem(
				`cpbs_likes_${category}_${interactionKey}`,
			);
			if (storedLikes) {
				setLocalLikes(new Set(JSON.parse(storedLikes)));
			}
			const storedViews = localStorage.getItem(
				`cpbs_views_${category}_${interactionKey}`,
			);
			if (storedViews) {
				setLocalViews(new Set(JSON.parse(storedViews)));
			}
		} catch (e) {
			console.error("Failed to load local metrics", e);
		}
	}, [category, interactionKey]);

	// Save local likes to storage
	const persistLocalLike = useCallback(
		(itemId: string) => {
			const key = `cpbs_likes_${category}_${interactionKey}`;
			setLocalLikes((prev) => {
				const newSet = new Set(prev);
				newSet.add(itemId);
				safeLocalSet(key, JSON.stringify(Array.from(newSet)));
				return newSet;
			});
		},
		[category, interactionKey],
	);

	// Save local views to storage
	const _persistLocalView = useCallback(
		(itemId: string) => {
			const key = `cpbs_views_${category}_${interactionKey}`;
			setLocalViews((prev) => {
				const newSet = new Set(prev);
				newSet.add(itemId);
				safeLocalSet(key, JSON.stringify(Array.from(newSet)));
				return newSet;
			});
		},
		[category, interactionKey],
	);

	// Fetch real-time metrics
	useEffect(() => {
		let isMounted = true;
		let unsubscribe: (() => void) | undefined;

		const handleSnapshot = (snap: any) => {
			if (!isMounted) return;
			if (snap.exists()) {
				const data = snap.data();
				// Map the nested flat data into ItemMetrics, handling field names like "item123.likes" or structured maps
				// Since we will use dot-notation for updates, Firestore creates nested maps.
				setMetrics(data as MetricsMap);
			}
		};

		if (shouldUseRestFallback()) {
			unsubscribe = iosOnSnapshotDoc(
				`metrics/${category}`,
				handleSnapshot,
				(err) => {
					console.error("Failed to fetch metrics (iOS REST):", err);
				},
			);
		} else {
			const metricsRef = doc(db, "metrics", category);
			unsubscribe = onSnapshot(metricsRef, handleSnapshot, (err) => {
				console.error("Failed to fetch metrics:", err);
			});
		}

		return () => {
			isMounted = false;
			if (unsubscribe) unsubscribe();
		};
	}, [category]);

	const incrementView = useCallback(
		async (itemId: string) => {
			const key = `cpbs_views_${category}_${interactionKey}`;
			const storedViews = localStorage.getItem(key);
			const currentViews = new Set<string>(
				storedViews ? JSON.parse(storedViews) : [],
			);

			if (currentViews.has(itemId) || localViews.has(itemId)) return; // Already viewed by this device/user

			// Persist view to local storage immediately to prevent double-counting in StrictMode
			currentViews.add(itemId);
			safeLocalSet(key, JSON.stringify(Array.from(currentViews)));
			setLocalViews(currentViews);

			const metricsRef = doc(db, "metrics", category);
			try {
				// Using setDoc with merge: true allows creating the doc if it doesn't exist
				await setDoc(
					metricsRef,
					{
						[itemId]: {
							views: increment(1),
						},
					},
					{ merge: true },
				);
			} catch (err) {
				console.error("Failed to increment view", err);
			}
		},
		[category, localViews, interactionKey],
	);

	/**
	 * Batched sibling of `incrementView`, for counting a whole set of items that
	 * just became visible at once.
	 *
	 * Why this exists: `incrementView` issues ONE `setDoc` per item, and every
	 * item in a category shares the single `metrics/<category>` document. Calling
	 * it in a loop for a screenful of thumbnails would fire N writes at the same
	 * document within a few hundred ms, which runs straight into Firestore's
	 * ~1-write-per-second-per-document contention limit — writes start failing and
	 * retrying. Collapsing them into one `setDoc` with N fields is a single write
	 * no matter how many items are in the batch.
	 *
	 * Dedup is identical to the single version (permanent, per device/user via
	 * localStorage), and localStorage is read fresh rather than trusted from state
	 * so a StrictMode double-invoke can't double-count.
	 */
	const incrementViews = useCallback(
		async (itemIds: readonly string[]) => {
			if (!itemIds || itemIds.length === 0) return;

			const key = `cpbs_views_${category}_${interactionKey}`;
			let stored: Set<string>;
			try {
				const raw = localStorage.getItem(key);
				stored = new Set<string>(raw ? JSON.parse(raw) : []);
			} catch {
				stored = new Set<string>();
			}

			const fresh: string[] = [];
			for (const id of itemIds) {
				if (!id) continue;
				if (stored.has(id) || localViews.has(id)) continue;
				stored.add(id);
				fresh.push(id);
			}
			if (fresh.length === 0) return;

			// Persist before the network call, so a failed write still can't be
			// retried into a double count — same trade-off the single version makes.
			safeLocalSet(key, JSON.stringify(Array.from(stored)));
			setLocalViews(new Set(stored));

			const payload: Record<string, { views: unknown }> = {};
			for (const id of fresh) payload[id] = { views: increment(1) };

			try {
				await setDoc(doc(db, "metrics", category), payload, { merge: true });
			} catch (err) {
				console.error("Failed to increment views (batch)", err);
			}
		},
		[category, localViews, interactionKey],
	);

	const incrementLike = useCallback(
		async (itemId: string) => {
			if (localLikes.has(itemId)) return true; // Already liked by this device/user

			// Optimistically update local UI
			persistLocalLike(itemId);

			const metricsRef = doc(db, "metrics", category);
			try {
				await setDoc(
					metricsRef,
					{
						[itemId]: {
							likes: increment(1),
						},
					},
					{ merge: true },
				);
			} catch (err) {
				console.error("Failed to increment like", err);
				return false;
			}
			return true;
		},
		[category, localLikes, persistLocalLike],
	);

	const hasLiked = useCallback(
		(itemId: string): boolean => {
			return localLikes.has(itemId);
		},
		[localLikes],
	);

	const getMetrics = useCallback(
		(itemId: string): ItemMetrics => {
			return metrics[itemId] || { likes: 0, views: 0, commentsCount: 0 };
		},
		[metrics],
	);

	const incrementCommentCount = useCallback(
		async (itemId: string) => {
			const metricsRef = doc(db, "metrics", category);
			try {
				await setDoc(
					metricsRef,
					{
						[itemId]: {
							commentsCount: increment(1),
						},
					},
					{ merge: true },
				);
			} catch (err) {
				console.error("Failed to increment comment count", err);
				return false;
			}
			return true;
		},
		[category],
	);

	return {
		getMetrics,
		incrementLike,
		incrementView,
		incrementViews,
		incrementCommentCount,
		hasLiked,
	};
};

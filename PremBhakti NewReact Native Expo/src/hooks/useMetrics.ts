import { useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { doc, getFirestore, onSnapshot, setDoc, increment } from "@react-native-firebase/firestore";
import { useAuthStore } from "../store/authStore";
import { storage } from "../lib/storage";

function getDeviceId(): string {
	let id = storage.getString("cpbs_device_id");
	if (!id) {
		id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
		storage.set("cpbs_device_id", id);
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

	const { user } = useAuthStore();
	const interactionKey = user ? `user_${user.uid}` : getDeviceId();

	// Load local interactions
	useEffect(() => {
		try {
			const storedLikes = storage.getString(`cpbs_likes_${category}_${interactionKey}`);
			if (storedLikes) {
				setLocalLikes(new Set(JSON.parse(storedLikes)));
			}
			const storedViews = storage.getString(`cpbs_views_${category}_${interactionKey}`);
			if (storedViews) {
				setLocalViews(new Set(JSON.parse(storedViews)));
			}
		} catch (e) {
			console.error("Failed to load local metrics", e);
		}
	}, [category, interactionKey]);

	// Save local likes to storage
	const persistLocalLike = useCallback((itemId: string) => {
		const key = `cpbs_likes_${category}_${interactionKey}`;
		setLocalLikes((prev) => {
			const newSet = new Set(prev);
			newSet.add(itemId);
			storage.set(key, JSON.stringify(Array.from(newSet)));
			return newSet;
		});
	}, [category, interactionKey]);

	// Fetch real-time metrics
	useEffect(() => {
		if (Platform.OS === "web") return; // Web uses Capacitor app logic typically, or we skip realtime listen here if needed, but let's allow read for browser preview.
		let isMounted = true;

		const db = getFirestore();
		const metricsRef = doc(db, "metrics", category);
		const unsubscribe = onSnapshot(metricsRef, (snap: any) => {
			if (!isMounted) return;
			if (snap.exists()) {
				const data = snap.data();
				setMetrics(data as MetricsMap);
			}
		}, (err: any) => {
			console.error("Failed to fetch metrics:", err);
		});

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [category]);

	const incrementView = useCallback(async (itemId: string) => {
		const key = `cpbs_views_${category}_${interactionKey}`;
		const storedViewsStr = storage.getString(key);
		const currentViews = new Set<string>(storedViewsStr ? JSON.parse(storedViewsStr) : []);

		if (currentViews.has(itemId) || localViews.has(itemId)) return;

		currentViews.add(itemId);
		storage.set(key, JSON.stringify(Array.from(currentViews)));
		setLocalViews(currentViews);

		if (Platform.OS === "web") return;

		try {
			const db = getFirestore();
			const metricsRef = doc(db, "metrics", category);
			await setDoc(metricsRef, { [itemId]: { views: increment(1) } }, { merge: true });
		} catch (err) {
			console.error("Failed to increment view", err);
		}
	}, [category, localViews, interactionKey]);

	const incrementViews = useCallback(async (itemIds: readonly string[]) => {
		if (!itemIds || itemIds.length === 0) return;

		const key = `cpbs_views_${category}_${interactionKey}`;
		let stored: Set<string>;
		try {
			const raw = storage.getString(key);
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

		storage.set(key, JSON.stringify(Array.from(stored)));
		setLocalViews(new Set(stored));

		if (Platform.OS === "web") return;

		const payload: Record<string, { views: unknown }> = {};
		for (const id of fresh) payload[id] = { views: increment(1) };

		try {
			const db = getFirestore();
			await setDoc(doc(db, "metrics", category), payload, { merge: true });
		} catch (err) {
			console.error("Failed to increment views (batch)", err);
		}
	}, [category, localViews, interactionKey]);

	const incrementLike = useCallback(async (itemId: string) => {
		if (localLikes.has(itemId)) return true;

		persistLocalLike(itemId);

		if (Platform.OS === "web") return true;

		try {
			const db = getFirestore();
			const metricsRef = doc(db, "metrics", category);
			await setDoc(metricsRef, { [itemId]: { likes: increment(1) } }, { merge: true });
		} catch (err) {
			console.error("Failed to increment like", err);
			return false;
		}
		return true;
	}, [category, localLikes, persistLocalLike]);

	const hasLiked = useCallback((itemId: string): boolean => {
		return localLikes.has(itemId);
	}, [localLikes]);

	const getMetrics = useCallback((itemId: string): ItemMetrics => {
		return metrics[itemId] || { likes: 0, views: 0, commentsCount: 0 };
	}, [metrics]);

	return {
		getMetrics,
		incrementLike,
		incrementView,
		incrementViews,
		hasLiked,
	};
};

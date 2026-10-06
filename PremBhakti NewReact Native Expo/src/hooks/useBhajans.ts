import { useBhajansContent } from "../store/contentStore";

// Kept as a thin alias so existing screens don't change; bhajans now come
// from the shared content store (one fetch, shared across screens).
export function useBhajans() {
	const { items, isSyncing, error, refresh } = useBhajansContent();
	return { bhajans: items, isSyncing, error, refresh };
}

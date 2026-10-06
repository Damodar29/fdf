import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { storage } from "../lib/storage";
import type { Playlist } from "../types";
import { showToast } from "./toastStore";

// User playlists ("My Collections") — the playlists part of
// context/DataContext.tsx, with the same actions and toasts.

interface PlaylistState {
	playlists: Playlist[];
	createPlaylist: (name: string) => void;
	renamePlaylist: (id: string, name: string) => void;
	deletePlaylist: (id: string) => void;
	addToPlaylist: (playlistId: string, bhajanId: string) => void;
	removeFromPlaylist: (playlistId: string, bhajanId: string) => void;
}

const mmkvStorage: StateStorage = {
	getItem: (name) => storage.getString(name) ?? null,
	setItem: (name, value) => storage.set(name, value),
	removeItem: (name) => {
		storage.remove(name);
	},
};

export const usePlaylistStore = create<PlaylistState>()(
	persist(
		(set) => ({
			playlists: [],
			createPlaylist: (name) => {
				set(({ playlists }) => ({
					playlists: [...playlists, { id: `pl-${Date.now()}`, name, items: [], createdAt: Date.now() }],
				}));
				showToast(`Created playlist: ${name}`, "success");
			},
			renamePlaylist: (id, name) => {
				set(({ playlists }) => ({ playlists: playlists.map((p) => (p.id === id ? { ...p, name } : p)) }));
				showToast("Playlist renamed", "success");
			},
			deletePlaylist: (id) => {
				set(({ playlists }) => ({ playlists: playlists.filter((p) => p.id !== id) }));
				showToast("Playlist deleted", "info");
			},
			addToPlaylist: (playlistId, bhajanId) =>
				set(({ playlists }) => ({
					playlists: playlists.map((p) =>
						p.id === playlistId && !p.items.includes(bhajanId) ? { ...p, items: [...p.items, bhajanId] } : p,
					),
				})),
			removeFromPlaylist: (playlistId, bhajanId) =>
				set(({ playlists }) => ({
					playlists: playlists.map((p) =>
						p.id === playlistId ? { ...p, items: p.items.filter((id) => id !== bhajanId) } : p,
					),
				})),
		}),
		{
			name: "cpbs_playlists",
			storage: createJSONStorage(() => mmkvStorage),
			partialize: ({ playlists }) => ({ playlists }),
		},
	),
);

// DataContext keeps a "Favorites" playlist at the top of the list at all
// times (re-made if it is deleted or missing after a restore).
const withFavorites = (list: Playlist[]): Playlist[] =>
	list.some((p) => p.isDefault || p.name === "Favorites")
		? list
		: [{ id: "pl-default-fav", name: "Favorites", items: [], createdAt: Date.now(), isDefault: true }, ...list];

const keepFavorites = () => {
	const { playlists } = usePlaylistStore.getState();
	const next = withFavorites(playlists);
	if (next !== playlists) usePlaylistStore.setState({ playlists: next });
};
usePlaylistStore.subscribe(keepFavorites);
if (usePlaylistStore.persist.hasHydrated()) keepFavorites();
else usePlaylistStore.persist.onFinishHydration(keepFavorites);

import ReactNativeBlobUtil, { type StatefulPromise } from "react-native-blob-util";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { getPlayableUrl } from "../lib/cdnUrl";
import { storage } from "../lib/storage";
import type { Bhajan, BhajanAudio } from "../types";
import { showToast } from "./toastStore";

// Offline audio — the downloadTrack / activeDownloads / cancelDownload part
// of context/DataContext.tsx plus utils/audioStorage.ts. Same flow: check the
// file size, ask with the download-confirm dialog, download with live
// progress, then the player uses the local file instead of streaming.
//
// Files go to the app's private storage (<files>/audio), so they need no
// storage permission and are removed with the app.

export type AudioCategory = "audio" | "lecture";

export interface DownloadedTrack {
	id: string;
	path: string;
	title: string;
	singer: string;
	duration?: number;
	url: string;
	category: AudioCategory;
	/** The bhajan (or lecture) the track belongs to, for the Downloads list. */
	parentId?: string;
	sizeBytes: number;
	downloadedAt: number;
}

export interface ActiveDownload {
	progress: number;
	title: string;
}

export interface DownloadConfirmation {
	title: string;
	sizeBytes: number;
	type: "audio" | "book";
	onConfirm: () => void;
}

interface DownloadState {
	downloaded: Record<string, DownloadedTrack>;
	active: Record<string, ActiveDownload>;
	confirmation: DownloadConfirmation | null;
	requestTrackDownload: (track: BhajanAudio, title: string, parent?: Bhajan, category?: AudioCategory) => Promise<void>;
	cancelDownload: (id: string) => void;
	deleteDownload: (id: string) => void;
	dismissConfirmation: () => void;
	confirm: (confirmation: DownloadConfirmation) => void;
}

const AUDIO_DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/audio`;
const tasks: Partial<Record<string, StatefulPromise<unknown>>> = {};

const mmkvStorage: StateStorage = {
	getItem: (name) => storage.getString(name) ?? null,
	setItem: (name, value) => storage.set(name, value),
	removeItem: (name) => {
		storage.remove(name);
	},
};

/** Content-Length via a HEAD request; 0 when the server won't say. */
export async function getRemoteFileSize(url: string): Promise<number> {
	try {
		const res = await fetch(url, { method: "HEAD" });
		return Number(res.headers.get("content-length")) || 0;
	} catch {
		return 0;
	}
}

export const formatBytes = (bytes: number) => {
	if (!bytes) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	return `${Number.parseFloat((bytes / 1024 ** i).toFixed(1))} ${units[i]}`;
};

export const useDownloadStore = create<DownloadState>()(
	persist(
		(set, get) => ({
			downloaded: {},
			active: {},
			confirmation: null,

			confirm: (confirmation) => set({ confirmation }),
			dismissConfirmation: () => set({ confirmation: null }),

			requestTrackDownload: async (track, title, parent, category = "audio") => {
				if (get().active[track.id] || get().downloaded[track.id]) return;
				showToast("Checking file size...", "info");
				const url = getPlayableUrl(track.url);
				const sizeBytes = await getRemoteFileSize(url);
				set({
					confirmation: {
						title: `${title} (${track.singer})`,
						sizeBytes,
						type: "audio",
						onConfirm: () => {
							set({ confirmation: null });
							startDownload(track, title, url, sizeBytes, category, parent?.id);
						},
					},
				});
			},

			cancelDownload: (id) => {
				const task = tasks[id];
				if (!task) return;
				task.cancel();
				delete tasks[id];
				set(({ active }) => {
					const { [id]: _, ...rest } = active;
					return { active: rest };
				});
				showToast("Download cancelled", "info");
			},

			deleteDownload: (id) => {
				const item = get().downloaded[id];
				if (item) ReactNativeBlobUtil.fs.unlink(item.path).catch(() => {});
				set(({ downloaded }) => {
					const { [id]: _, ...rest } = downloaded;
					return { downloaded: rest };
				});
			},
		}),
		{
			name: "cpbs_downloaded_tracks",
			storage: createJSONStorage(() => mmkvStorage),
			partialize: ({ downloaded }) => ({ downloaded }),
		},
	),
);

async function startDownload(
	track: BhajanAudio,
	title: string,
	url: string,
	knownSize: number,
	category: AudioCategory,
	parentId?: string,
) {
	const { setState } = useDownloadStore;
	const setProgress = (progress: number) =>
		setState(({ active }) => ({ active: { ...active, [track.id]: { progress, title } } }));
	setProgress(0);

	const path = `${AUDIO_DIR}/track-${track.id.replace(/[^\w-]/g, "_")}.m4a`;
	try {
		if (!(await ReactNativeBlobUtil.fs.isDir(AUDIO_DIR))) await ReactNativeBlobUtil.fs.mkdir(AUDIO_DIR);
		const task = ReactNativeBlobUtil.config({ path, overwrite: true }).fetch("GET", url);
		tasks[track.id] = task;
		task.progress({ interval: 250 }, (received, total) => {
			const t = Number(total) || knownSize;
			if (t > 0) setProgress(Math.min(100, (Number(received) / t) * 100));
		});
		const res = await task;
		const status = res.info().status;
		if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
		const stat = await ReactNativeBlobUtil.fs.stat(path);
		setState(({ downloaded }) => ({
			downloaded: {
				...downloaded,
				[track.id]: {
					id: track.id,
					path,
					title,
					singer: track.singer,
					duration: track.duration,
					url: track.url,
					category,
					parentId,
					sizeBytes: Number(stat.size) || knownSize,
					downloadedAt: Date.now(),
				},
			},
		}));
		showToast(`✅ Saved: ${title}${track.singer ? ` - ${track.singer}` : ""}`, "success");
	} catch {
		ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
		if (tasks[track.id]) showToast("Download Failed", "error");
	} finally {
		delete tasks[track.id];
		setTimeout(() => {
			setState(({ active }) => {
				const { [track.id]: _, ...rest } = active;
				return { active: rest };
			});
		}, 1000);
	}
}

/** Local file URI for a downloaded track, if any. */
export function getDownloadedUri(trackId: string): string | null {
	const item = useDownloadStore.getState().downloaded[trackId];
	return item ? `file://${item.path}` : null;
}

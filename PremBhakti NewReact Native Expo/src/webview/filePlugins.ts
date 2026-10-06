import * as Sharing from "expo-sharing";
import { Linking } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";

// File, download and upload plugins for the OG web screens (see
// capacitorBridge.ts): @capacitor/filesystem, @capacitor/file-transfer and the
// OG app's own NativeDownload / NativeUpload plugins (android/app/src/main/
// java/... in the Capacitor app), plus MediaSession and BigPictureNotification
// as quiet no-ops — the app plays audio and shows notifications natively.
//
// What uses them in the web screens: CachedImage (gallery photos cached under
// Directory.Cache, shown through https://localhost/_capacitor_file_/… which the
// WebView patch serves), imageStorage (save a photo to Pictures/Prem Bhakti,
// share a photo as a file), DonateScreen (QR code to Documents) and
// uploadManager (profile / glorification uploads through the Cloudflare
// worker).

// biome-ignore lint/suspicious/noExplicitAny: plugin options as the page sends them
type Options = Record<string, any>;
type Emit = (plugin: string, event: string, data: unknown) => void;
type Handler = (options: Options, ctx: { emit: Emit }) => unknown | Promise<unknown>;

class PluginError extends Error {
	constructor(
		message: string,
		public code?: string,
	) {
		super(message);
	}
}

const fs = ReactNativeBlobUtil.fs;
const dirs = fs.dirs as typeof fs.dirs & {
	SDCardApplicationDir?: string;
	LegacySDCardDir?: string;
	LegacyPictureDir?: string;
	LegacyMusicDir?: string;
	LegacyDownloadDir?: string;
};
const SDCARD = dirs.LegacySDCardDir || "/storage/emulated/0";

/** Capacitor's Directory values → Android folders (as @capacitor/filesystem resolves them). */
function baseDir(directory?: string): string | null {
	switch (directory) {
		case "DATA":
		case "LIBRARY":
		case "LIBRARY_NO_CLOUD":
			return dirs.DocumentDir;
		case "CACHE":
			return dirs.CacheDir;
		case "EXTERNAL":
			return dirs.SDCardDir;
		case "EXTERNAL_CACHE":
			return dirs.SDCardApplicationDir ? `${dirs.SDCardApplicationDir}/cache` : dirs.CacheDir;
		case "EXTERNAL_STORAGE":
			return SDCARD;
		case "DOCUMENTS":
			return `${SDCARD}/Documents`;
		default:
			return null;
	}
}

/** Absolute path for {path, directory} — or a file:// path given on its own. */
function resolvePath(path: unknown, directory?: string): string {
	const p = String(path ?? "");
	const base = baseDir(directory);
	if (base) return `${base}/${p.replace(/^\/+/, "")}`;
	return decodeURI(p.replace(/^file:\/\//, ""));
}

const fileUri = (abs: string) => `file://${abs}`;

async function statOf(abs: string) {
	const s = await fs.stat(abs);
	const mtime = Number(s.lastModified) || 0;
	return { type: s.type === "directory" ? "directory" : "file", size: Number(s.size) || 0, ctime: mtime, mtime, uri: fileUri(abs) };
}

async function mkdirs(abs: string) {
	const parts = abs.split("/");
	let cur = "";
	for (const part of parts) {
		if (!part) continue;
		cur += `/${part}`;
		if (!(await fs.exists(cur))) await fs.mkdir(cur).catch(() => {});
	}
}

const parentOf = (abs: string) => abs.slice(0, abs.lastIndexOf("/"));

const MIME: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	aac: "audio/aac",
	wav: "audio/wav",
	mp4: "video/mp4",
	pdf: "application/pdf",
};
const mimeOf = (name: string) => MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

/** Downloads `url` to `abs`; fails on an HTTP error (and leaves no file). */
async function download(url: string, abs: string, headers: Record<string, string> = {}, onProgress?: (r: number, t: number) => void) {
	await mkdirs(parentOf(abs));
	const task = ReactNativeBlobUtil.config({ path: abs, overwrite: true }).fetch("GET", url, headers);
	if (onProgress) task.progress({ interval: 250 }, (r, t) => onProgress(Number(r), Number(t)));
	const res = await task;
	const status = res.info().status;
	if (status >= 400) {
		await fs.unlink(abs).catch(() => {});
		throw new PluginError(`HTTP ${status}`, "OS-PLUG-FLTR-0010");
	}
	return res;
}

let nextId = 1;

export const FILE_HANDLERS: Record<string, Record<string, Handler>> = {
	Filesystem: {
		checkPermissions: () => ({ publicStorage: "granted" }),
		requestPermissions: () => ({ publicStorage: "granted" }),
		getUri: (o) => ({ uri: fileUri(resolvePath(o.path, o.directory)) }),
		stat: async (o) => {
			const abs = resolvePath(o.path, o.directory);
			if (!(await fs.exists(abs))) throw new PluginError("File does not exist", "OS-PLUG-FILE-0008");
			return statOf(abs);
		},
		mkdir: async (o) => {
			const abs = resolvePath(o.path, o.directory);
			if (await fs.exists(abs)) throw new PluginError("Directory exists", "OS-PLUG-FILE-0010");
			if (o.recursive) await mkdirs(abs);
			else await fs.mkdir(abs);
		},
		rmdir: async (o) => {
			const abs = resolvePath(o.path, o.directory);
			if (!(await fs.exists(abs))) throw new PluginError("Directory does not exist", "OS-PLUG-FILE-0008");
			if (!o.recursive && (await fs.ls(abs)).length) throw new PluginError("Directory is not empty", "OS-PLUG-FILE-0011");
			await fs.unlink(abs);
		},
		readdir: async (o) => {
			const abs = resolvePath(o.path, o.directory);
			if (!(await fs.exists(abs))) throw new PluginError("Directory does not exist", "OS-PLUG-FILE-0008");
			const names = await fs.ls(abs);
			const files = [];
			for (const name of names) {
				const info = await statOf(`${abs}/${name}`).catch(() => null);
				if (info) files.push({ name, ...info });
			}
			return { files };
		},
		deleteFile: async (o) => {
			const abs = resolvePath(o.path, o.directory);
			if (!(await fs.exists(abs))) throw new PluginError("File does not exist", "OS-PLUG-FILE-0008");
			await fs.unlink(abs);
		},
		readFile: async (o) => {
			const abs = resolvePath(o.path, o.directory);
			const utf8 = typeof o.encoding === "string" && o.encoding.toLowerCase().startsWith("utf");
			return { data: await fs.readFile(abs, utf8 ? "utf8" : "base64") };
		},
		writeFile: async (o) => {
			const abs = resolvePath(o.path, o.directory);
			if (o.recursive) await mkdirs(parentOf(abs));
			const utf8 = typeof o.encoding === "string" && o.encoding.toLowerCase().startsWith("utf");
			const data = String(o.data ?? "").replace(/^data:[^,]*,/, "");
			await fs.writeFile(abs, data, utf8 ? "utf8" : "base64");
			return { uri: fileUri(abs) };
		},
		appendFile: async (o) => {
			const abs = resolvePath(o.path, o.directory);
			const utf8 = typeof o.encoding === "string" && o.encoding.toLowerCase().startsWith("utf");
			await fs.appendFile(abs, String(o.data ?? ""), utf8 ? "utf8" : "base64");
		},
		rename: async (o) => {
			const from = resolvePath(o.from, o.directory);
			const to = resolvePath(o.to, o.toDirectory ?? o.directory);
			await mkdirs(parentOf(to));
			await fs.mv(from, to);
		},
		copy: async (o) => {
			const from = resolvePath(o.from, o.directory);
			const to = resolvePath(o.to, o.toDirectory ?? o.directory);
			await mkdirs(parentOf(to));
			await fs.cp(from, to);
			return { uri: fileUri(to) };
		},
	},

	FileTransfer: {
		downloadFile: async (o, ctx) => {
			const abs = resolvePath(o.path);
			await download(String(o.url), abs, o.headers ?? {}, o.progress
				? (r, t) => ctx.emit("FileTransfer", "progress", { type: "download", url: o.url, bytes: r, contentLength: t, lengthComputable: t > 0 })
				: undefined);
			return { path: abs };
		},
	},

	NativeDownload: {
		// Saves into the shared Pictures / Music / Download folders through
		// MediaStore (no storage permission needed), as the OG plugin did with
		// DownloadManager.
		downloadToPublicFolder: async (o, ctx) => {
			const downloadId = nextId++;
			const filename = String(o.filename);
			const subpath = String(o.subpath ?? "").replace(/^\/+|\/+$/g, "");
			const directory = String(o.directory ?? "DOWNLOADS");
			const tmp = `${dirs.CacheDir}/public-dl-${downloadId}-${filename.replace(/[^\w.-]/g, "_")}`;
			await download(String(o.url), tmp, {}, (r, t) =>
				ctx.emit("NativeDownload", "onDownloadProgress", { downloadId, bytesDownloaded: r, bytesTotal: t }),
			);
			const type = directory === "PICTURES" ? "Image" : directory === "MUSIC" ? "Audio" : "Download";
			try {
				await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
					{ name: filename, parentFolder: subpath, mimeType: mimeOf(filename) },
					type,
					tmp,
				);
			} finally {
				await fs.unlink(tmp).catch(() => {});
			}
			const root =
				type === "Image"
					? dirs.LegacyPictureDir || `${SDCARD}/Pictures`
					: type === "Audio"
						? dirs.LegacyMusicDir || `${SDCARD}/Music`
						: dirs.LegacyDownloadDir || `${SDCARD}/Download`;
			return { downloadId, path: `${root}/${subpath}/${filename}` };
		},
		cancelDownload: () => ({}),
		openExternalUrl: async (o) => {
			await Linking.openURL(String(o.url));
		},
		// No file-manager intent for a folder on stock Android; the saved
		// photos show up in the gallery.
		openFolder: () => ({}),
	},

	NativeUpload: {
		// utils/uploadManager.ts: the file goes to the Cloudflare worker, which
		// puts it on the GitHub release and answers with its URL.
		uploadFile: async (o, ctx) => {
			const id = `upload-${nextId++}`;
			const fileName = String(o.fileName);
			const tmp = `${dirs.CacheDir}/${id}`;
			await fs.writeFile(tmp, String(o.base64Data ?? ""), "base64");
			try {
				const res = await ReactNativeBlobUtil.fetch(
					"POST",
					`${String(o.workerUrl).replace(/\/+$/, "")}/upload`,
					{
						"x-github-release-id": String(o.releaseId),
						"x-github-filename": fileName,
						"x-github-token": String(o.token),
						"Content-Type": String(o.mimeType || "application/octet-stream"),
					},
					ReactNativeBlobUtil.wrap(tmp),
				).uploadProgress({ interval: 250 }, (sent, total) =>
					ctx.emit("NativeUpload", "uploadProgress", {
						callbackId: id,
						fileName,
						progress: Number(total) > 0 ? Math.round((Number(sent) / Number(total)) * 100) : 0,
					}),
				);
				if (res.info().status >= 400) throw new PluginError(`Upload proxy failed: ${res.text()}`);
				const url = (res.json() as { url?: string }).url;
				if (!url) throw new PluginError("Upload proxy gave no URL");
				ctx.emit("NativeUpload", "uploadDone", { callbackId: id, fileName, url });
				return { url };
			} catch (e) {
				ctx.emit("NativeUpload", "uploadError", { callbackId: id, fileName, error: (e as Error).message });
				throw e;
			} finally {
				await fs.unlink(tmp).catch(() => {});
			}
		},
		startProgressNotification: () => ({}),
		updateProgressNotification: () => ({}),
		stopProgressNotification: () => ({}),
	},

	// Lock-screen controls belong to the app's own player.
	MediaSession: {
		setMetadata: () => ({}),
		setPlaybackState: () => ({}),
		setPositionState: () => ({}),
		setActionHandler: () => ({}),
	},

	// The app shows push notifications itself; a web screen must not add a second one.
	BigPictureNotification: {
		show: () => ({}),
		consumeLaunchAction: () => ({}),
	},
};

/** Share plugin: a file:// URL (or `files`) is shared as the file itself. */
export async function shareFile(o: Options): Promise<boolean> {
	const file: string | undefined = Array.isArray(o.files) && o.files.length ? o.files[0] : typeof o.url === "string" && o.url.startsWith("file://") ? o.url : undefined;
	if (!file) return false;
	const path = file.startsWith("file://") ? file : fileUri(file);
	await Sharing.shareAsync(path, { dialogTitle: o.dialogTitle || o.title, mimeType: mimeOf(path) });
	return true;
}

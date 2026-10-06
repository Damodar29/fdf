import { type PluginListenerHandle, registerPlugin } from "@capacitor/core";

export interface NativeDownloadPlugin {
	downloadToPublicFolder: (options: {
		url: string;
		filename: string;
		subpath: string;
		directory?: "DOWNLOADS" | "PICTURES" | "MUSIC" | "DOCUMENTS";
	}) => Promise<{ downloadId: number; path: string }>;
	cancelDownload: (options: { downloadId: number }) => Promise<void>;
	addListener(
		eventName: "onDownloadProgress",
		listenerFunc: (info: {
			downloadId: number;
			bytesDownloaded: number;
			bytesTotal: number;
		}) => void,
	): Promise<PluginListenerHandle> & PluginListenerHandle;
	/** Opens a downloaded PDF from public Downloads folder in the system PDF app chooser */
	openPdf: (options: { subpath: string; filename: string }) => Promise<void>;
	/** Opens a specific folder in the system file manager */
	openFolder: (options: {
		subpath: string;
		directory?: "DOWNLOADS" | "PICTURES" | "MUSIC" | "DOCUMENTS";
	}) => Promise<void>;
	/** Opens an external URL in the system browser */
	openExternalUrl: (options: { url: string }) => Promise<void>;
	/** Deletes a file and its MediaStore entry to prevent DownloadManager rename conflicts */
	deleteFile: (options: {
		subpath: string;
		filename: string;
		directory?: "DOWNLOADS" | "PICTURES" | "MUSIC" | "DOCUMENTS";
	}) => Promise<void>;

	// ── Book storage v3 (app-specific Android/data/<pkg>/files/Books) ──
	// Errors carry `code`: CANCELLED | DOWNLOAD_FAILED | CORRUPT | NOT_FOUND | NO_VIEWER | ...

	/** Downloads to "<fileName>.part", verifies a complete PDF, then replaces older copies. Attaches to an in-flight download of the same book instead of starting a second one. */
	downloadBook: (options: {
		url: string;
		bookId: string;
		/** Must end with "[<bookId>].pdf" */
		fileName: string;
		title?: string;
	}) => Promise<{ fileName: string; size: number }>;
	cancelBookDownload: (options: { bookId: string }) => Promise<void>;
	deleteBookFiles: (options: {
		bookId: string;
	}) => Promise<{ deleted: number }>;
	/** Finalizes/cleans the Books dir and returns the valid books on disk. */
	listBookFiles: () => Promise<{
		files: { bookId: string; fileName: string; size: number }[];
		active: string[];
	}>;
	openBookFile: (options: { fileName: string }) => Promise<void>;
	listLegacyBookFiles: () => Promise<{
		files: {
			name: string;
			size: number;
			mtime: number;
			ref: string;
			valid: boolean;
		}[];
		needsPermission: boolean;
	}>;
	importLegacyBook: (options: {
		ref: string;
		bookId: string;
		fileName: string;
	}) => Promise<{ fileName: string; size: number }>;
	/** Deletes every reachable file in the old public books folder except refs in `keep`. */
	wipeLegacyBookFolder: (options?: {
		keep?: string[];
	}) => Promise<{ deleted: number; failed: number }>;
	addListener(
		eventName: "onBookDownloadProgress",
		listenerFunc: (info: {
			bookId: string;
			downloadId: number;
			bytesDownloaded: number;
			bytesTotal: number;
		}) => void,
	): Promise<PluginListenerHandle>;
}

export const NativeDownload =
	registerPlugin<NativeDownloadPlugin>("NativeDownload");

import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

export interface FileEntry {
	name: string;
	isDirectory: boolean;
	uri?: string; // App-accessible local URI (capacitor://)
	size?: number;
	mtime?: number;
}

/**
 * Scans the local filesystem for downloaded images in the "Prem Bhakti" directory.
 * @param subPath An array representing the current folder depth, e.g. ['Darshan', 'Kota']
 */
export const listImageDirectory = async (
	subPath: string[] = [],
): Promise<FileEntry[]> => {
	if (!Capacitor.isNativePlatform()) return [];

	const isAndroid = Capacitor.getPlatform() === "android";
	const baseDir = isAndroid ? "Pictures/Prem Bhakti" : "Prem Bhakti";
	const dirType = isAndroid ? Directory.ExternalStorage : Directory.Documents;

	const fullPath = [baseDir, ...subPath].filter(Boolean).join("/");

	try {
		// Ensure the base directory exists before trying to read it (especially root)
		if (subPath.length === 0) {
			try {
				await Filesystem.mkdir({
					path: fullPath,
					directory: dirType,
					recursive: true,
				});
			} catch (_) {
				/* Ignore if exists */
			}
		}

		const result = await Filesystem.readdir({
			path: fullPath,
			directory: dirType,
		});

		const entries: FileEntry[] = [];

		for (const file of result.files) {
			// result.files is an array of FileInfo objects in newer Capacitor versions
			// FileInfo: { name: string, type: 'file' | 'directory', size: number, ctime: number, mtime: number, uri: string }
			const isDir = file.type === "directory";

			// Skip hidden files/folders (like .nomedia or .Trash)
			if (file.name.startsWith(".")) continue;

			// Only include specific image types if it's a file
			if (!isDir && !/\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)) {
				continue;
			}

			let fileUri = file.uri;
			if (!isDir && !fileUri) {
				// Fallback to getUri if uri isn't provided by readdir directly (older capacitor)
				try {
					const u = await Filesystem.getUri({
						path: `${fullPath}/${file.name}`,
						directory: dirType,
					});
					fileUri = u.uri;
				} catch {}
			}

			entries.push({
				name: file.name,
				isDirectory: isDir,
				uri: !isDir && fileUri ? Capacitor.convertFileSrc(fileUri) : undefined,
				size: file.size,
				mtime: file.mtime,
			});
		}

		// Sort: Folders first, then newer files first (or alphabetical)
		entries.sort((a, b) => {
			if (a.isDirectory && !b.isDirectory) return -1;
			if (!a.isDirectory && b.isDirectory) return 1;
			if (!a.isDirectory && !b.isDirectory) {
				return (b.mtime || 0) - (a.mtime || 0); // newest first
			}
			return a.name.localeCompare(b.name);
		});

		return entries;
	} catch (e) {
		console.error(`Failed to read directory: ${fullPath}`, e);
		return [];
	}
};

/**
 * Deletes a file or directory recursively.
 */
export const deleteImageEntry = async (
	subPath: string[],
	fileName: string,
): Promise<boolean> => {
	if (!Capacitor.isNativePlatform()) return false;

	const isAndroid = Capacitor.getPlatform() === "android";
	const baseDir = isAndroid ? "Pictures/Prem Bhakti" : "Prem Bhakti";
	const dirType = isAndroid ? Directory.ExternalStorage : Directory.Documents;

	const fullPath = [baseDir, ...subPath, fileName].filter(Boolean).join("/");

	try {
		await Filesystem.deleteFile({ path: fullPath, directory: dirType });
		return true;
	} catch {
		try {
			await Filesystem.rmdir({
				path: fullPath,
				directory: dirType,
				recursive: true,
			});
			return true;
		} catch (e) {
			console.error(`Failed to delete ${fullPath}`, e);
			return false;
		}
	}
};

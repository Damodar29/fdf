// Browser stand-in for react-native-blob-util: no device file system, so
// nothing is ever "downloaded" and file writes fail politely.
const fail = async (): Promise<never> => {
	throw new Error("Files are not available in the browser");
};
const dirs = {
	DocumentDir: "/web/documents",
	CacheDir: "/web/cache",
	SDCardDir: "/web/sdcard",
	SDCardApplicationDir: "/web/sdcard/app",
	LegacySDCardDir: "/web/sdcard",
	DownloadDir: "/web/downloads",
};
const fs = {
	dirs,
	exists: async () => false,
	isDir: async () => false,
	mkdir: async () => {},
	unlink: async () => {},
	mv: fail,
	cp: fail,
	stat: fail,
	ls: async () => [] as string[],
	lstat: async () => [],
	readFile: fail,
	writeFile: fail,
	appendFile: fail,
};
const config = () => ({ fetch: () => Object.assign(fail(), { progress: () => {}, uploadProgress: () => {}, cancel: () => {} }) });
export type StatefulPromise<T> = Promise<T> & { cancel(): void };
export default {
	fs,
	config,
	fetch: fail,
	wrap: (p: string) => p,
	MediaCollection: { copyToMediaStore: fail },
	android: { actionViewIntent: fail },
};

const DB_NAME = "BhaktiAppDB";
const DB_VERSION = 1;
const STORE_FILES = "files";

export const initDB = (): Promise<IDBDatabase> => {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_FILES)) {
				db.createObjectStore(STORE_FILES);
			}
		};
	});
};

export const saveFile = async (key: string, blob: Blob): Promise<void> => {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_FILES, "readwrite");
		const store = transaction.objectStore(STORE_FILES);
		const request = store.put(blob, key);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
};

export const getFile = async (key: string): Promise<Blob | null> => {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_FILES, "readonly");
		const store = transaction.objectStore(STORE_FILES);
		const request = store.get(key);

		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
	});
};

export const deleteFile = async (key: string): Promise<void> => {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_FILES, "readwrite");
		const store = transaction.objectStore(STORE_FILES);
		const request = store.delete(key);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
};

export const checkFileExists = async (key: string): Promise<boolean> => {
	const file = await getFile(key);
	return !!file;
};

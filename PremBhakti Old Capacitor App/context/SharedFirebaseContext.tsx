import {
	collection,
	doc,
	onSnapshot,
	orderBy,
	query,
} from "firebase/firestore";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../services/firebase";
import {
	iosOnSnapshotCollection,
	iosOnSnapshotDoc,
	shouldUseRestFallback,
} from "../utils/firebaseRest";

interface SharedFirebaseContextType {
	dbMandals: any[];
	dbVideos: any[];
	dbVideoFolders: any[];
	activityFoldersConfig: any;
	darshanFoldersConfig: any;
	loadingMandals: boolean;
	loadingVideos: boolean;
	loadingVideoFolders: boolean;
	loadingActivityFolders: boolean;
	loadingDarshanFolders: boolean;
}

const SharedFirebaseContext = createContext<SharedFirebaseContextType>({
	dbMandals: [],
	dbVideos: [],
	dbVideoFolders: [],
	activityFoldersConfig: null,
	darshanFoldersConfig: null,
	loadingMandals: true,
	loadingVideos: true,
	loadingVideoFolders: true,
	loadingActivityFolders: true,
	loadingDarshanFolders: true,
});

export const useSharedFirebase = () => useContext(SharedFirebaseContext);

export const SharedFirebaseProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const [dbMandals, setDbMandals] = useState<any[]>([]);
	const [dbVideos, setDbVideos] = useState<any[]>([]);
	const [dbVideoFolders, setDbVideoFolders] = useState<any[]>([]);
	const [activityFoldersConfig, setActivityFoldersConfig] = useState<any>(null);
	const [darshanFoldersConfig, setDarshanFoldersConfig] = useState<any>(null);

	const [loadingMandals, setLoadingMandals] = useState(true);
	const [loadingVideos, setLoadingVideos] = useState(true);
	const [loadingVideoFolders, setLoadingVideoFolders] = useState(true);
	const [loadingActivityFolders, setLoadingActivityFolders] = useState(true);
	const [loadingDarshanFolders, setLoadingDarshanFolders] = useState(true);

	useEffect(() => {
		let unsubMandals: (() => void) | undefined;
		let unsubVideos: (() => void) | undefined;
		let unsubVideoFolders: (() => void) | undefined;
		let unsubActivity: (() => void) | undefined;
		let unsubDarshan: (() => void) | undefined;

		const isRest = shouldUseRestFallback();

		// 1. Mandals
		const handleMandals = (snap: any) => {
			const mList: any[] = [];
			if (snap?.docs) {
				snap.forEach((d: any) => mList.push({ id: d.id, ...d.data() }));
			} else if (snap && Array.isArray(snap)) {
				// iOS REST mode
				mList.push(...snap);
			}
			setDbMandals(mList);
			setLoadingMandals(false);
		};
		if (isRest) {
			unsubMandals = iosOnSnapshotCollection("mandals", handleMandals, (e) =>
				console.error(e),
			);
		} else {
			unsubMandals = onSnapshot(
				collection(db, "mandals"),
				handleMandals,
				(e) => {
					console.warn(
						"Mandal snapshot permission error (safe to ignore if unauthenticated):",
						e,
					);
					setLoadingMandals(false);
				},
			);
		}

		// 2. Videos
		const handleVideos = (snap: any) => {
			const vList: any[] = [];
			if (snap?.docs) {
				snap.forEach((d: any) => vList.push({ id: d.id, ...d.data() }));
			} else if (snap && Array.isArray(snap)) {
				vList.push(...snap);
			}
			setDbVideos(vList);
			setLoadingVideos(false);
		};
		if (isRest) {
			unsubVideos = iosOnSnapshotCollection("videos", handleVideos, (e) =>
				console.error(e),
			);
		} else {
			const qVideos = query(collection(db, "videos"), orderBy("order", "asc"));
			unsubVideos = onSnapshot(qVideos, handleVideos, (e) => {
				console.error("Videos snapshot error:", e);
				setLoadingVideos(false);
			});
		}

		// 3. Video Folders
		const handleVideoFolders = (snap: any) => {
			const fList: any[] = [];
			if (snap?.docs) {
				snap.forEach((d: any) => fList.push({ id: d.id, ...d.data() }));
			} else if (snap && Array.isArray(snap)) {
				fList.push(...snap);
			}
			setDbVideoFolders(fList);
			setLoadingVideoFolders(false);
		};
		if (isRest) {
			unsubVideoFolders = iosOnSnapshotCollection(
				"video_folders",
				handleVideoFolders,
				(e) => console.error(e),
			);
		} else {
			const qFolders = query(
				collection(db, "video_folders"),
				orderBy("order", "asc"),
			);
			unsubVideoFolders = onSnapshot(qFolders, handleVideoFolders, (e) => {
				console.error("Video folders snapshot error:", e);
				setLoadingVideoFolders(false);
			});
		}

		// 4. Activity Folders
		const handleActivityFolders = (configDoc: any) => {
			if (
				configDoc &&
				typeof configDoc.exists === "function" &&
				configDoc.exists()
			) {
				setActivityFoldersConfig({ id: configDoc.id, ...configDoc.data() });
			} else if (
				configDoc &&
				typeof configDoc.exists === "function" &&
				!configDoc.exists()
			) {
				setActivityFoldersConfig(null);
			} else if (
				configDoc &&
				typeof configDoc.exists === "boolean" &&
				configDoc.exists === false
			) {
				setActivityFoldersConfig(null);
			} else if (
				configDoc &&
				(configDoc.fields || typeof configDoc.exists === "undefined")
			) {
				// REST fallback doc format
				setActivityFoldersConfig(configDoc);
			} else {
				setActivityFoldersConfig(configDoc);
			}
			setLoadingActivityFolders(false);
		};
		if (isRest) {
			unsubActivity = iosOnSnapshotDoc(
				"app_config/activity_folders",
				handleActivityFolders,
				(e) => console.error(e),
			);
		} else {
			unsubActivity = onSnapshot(
				doc(db, "app_config", "activity_folders"),
				handleActivityFolders,
				(e) => {
					console.error(e);
					setLoadingActivityFolders(false);
				},
			);
		}

		// 5. Darshan Folders
		const handleDarshanFolders = (configDoc: any) => {
			if (
				configDoc &&
				typeof configDoc.exists === "function" &&
				configDoc.exists()
			) {
				setDarshanFoldersConfig({ id: configDoc.id, ...configDoc.data() });
			} else if (
				configDoc &&
				typeof configDoc.exists === "function" &&
				!configDoc.exists()
			) {
				setDarshanFoldersConfig(null);
			} else if (
				configDoc &&
				typeof configDoc.exists === "boolean" &&
				configDoc.exists === false
			) {
				setDarshanFoldersConfig(null);
			} else if (
				configDoc &&
				(configDoc.fields || typeof configDoc.exists === "undefined")
			) {
				// REST fallback doc format
				setDarshanFoldersConfig(configDoc);
			} else {
				setDarshanFoldersConfig(configDoc);
			}
			setLoadingDarshanFolders(false);
		};
		if (isRest) {
			unsubDarshan = iosOnSnapshotDoc(
				"app_config/darshan_folders",
				handleDarshanFolders,
				(e) => console.error(e),
			);
		} else {
			unsubDarshan = onSnapshot(
				doc(db, "app_config", "darshan_folders"),
				handleDarshanFolders,
				(e) => {
					console.error(e);
					setLoadingDarshanFolders(false);
				},
			);
		}

		return () => {
			if (unsubMandals) unsubMandals();
			if (unsubVideos) unsubVideos();
			if (unsubVideoFolders) unsubVideoFolders();
			if (unsubActivity) unsubActivity();
			if (unsubDarshan) unsubDarshan();
		};
	}, []);

	return (
		<SharedFirebaseContext.Provider
			value={{
				dbMandals,
				dbVideos,
				dbVideoFolders,
				activityFoldersConfig,
				darshanFoldersConfig,
				loadingMandals,
				loadingVideos,
				loadingVideoFolders,
				loadingActivityFolders,
				loadingDarshanFolders,
			}}
		>
			{children}
		</SharedFirebaseContext.Provider>
	);
};

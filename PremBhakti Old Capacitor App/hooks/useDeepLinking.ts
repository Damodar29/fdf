/**
 * useDeepLinking.ts
 *
 * Handles all deep link scenarios:
 *  - Cold start from a URL (web / PWA / native launch URL)
 *  - Background → foreground URL opens (Capacitor appUrlOpen)
 *  - Pending actions that arrived while data was still loading
 */

import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useRef } from "react";
import { markDeepLinkNavigation } from "../src/tour/tourBus";
import type { AppTab, Bhajan, BhajanAudio, LectureData } from "../types";
import {
	applyShareTargetToUrl,
	parseSharePath,
	shareTargetScreen,
} from "../utils/shareLinks";

interface UseDeepLinkingOptions {
	bhajans: Bhajan[];
	lectures: LectureData[];
	isLoading: boolean;
	addToHistory: (id: string, type: "song" | "book" | "lecture") => void;
	setSelectedBhajan: (b: Bhajan | null) => void;
	setSelectedContextQueue: (q: BhajanAudio[] | undefined) => void;
	setSelectedQueueName: (n: string | undefined) => void;
	setActiveTab: (tab: AppTab) => void;
	setIsVideosOpen: (open: boolean) => void;
	setIsActivitiesOpen?: (open: boolean) => void;
	setIsPrivacyOpen?: (open: boolean) => void;
	setIsTermsOpen?: (open: boolean) => void;
	setIsAboutOpen?: (open: boolean) => void;
	handleScreenAction?: (screen: string) => void;
	handleNotificationData?: (data: any) => void;
	onPlayLecture?: (lecture: LectureData) => void;
}

export function useDeepLinking({
	bhajans,
	lectures,
	isLoading,
	addToHistory,
	setSelectedBhajan,
	setSelectedContextQueue,
	setSelectedQueueName,
	setActiveTab,
	setIsVideosOpen,
	setIsActivitiesOpen,
	setIsPrivacyOpen,
	setIsTermsOpen,
	setIsAboutOpen,
	handleScreenAction,
	handleNotificationData,
	onPlayLecture,
}: UseDeepLinkingOptions) {
	const deepLinkHandledRef = useRef(false);
	const pendingActionRef = useRef<{
		type:
			| "bhajan"
			| "lecture"
			| "videoFolder"
			| "videoId"
			| "mandalVideoId"
			| "activities";
		data: string;
	} | null>(null);

	// ── Resolve a bhajan/lecture by ID and open the reader ──────────────
	const navigateToBhajanById = useCallback(
		(bhajanId: string, type?: "bhajan" | "lecture"): boolean => {
			if (!bhajanId) return false;

			// Strip common prefixes — support both hyphen and underscore variants
			// e.g. "bhajan-5" → "5", "lecture-003" → "003", "lecture_003" → "003"
			const targetNumberStr = bhajanId
				.replace(/^bhajan[_-]/i, "")
				.replace(/^lecture[_-]/i, "");
			const targetNumInt = parseInt(targetNumberStr, 10);

			// Auto-detect lecture type from prefix (handles ?bhajanId=lecture_003 links)
			if (type === undefined || type === "bhajan") {
				if (/^lecture[_-]/i.test(bhajanId)) {
					type = "lecture";
				}
			}

			const findBhajan = () =>
				bhajans.find((b) => {
					if (b.id === bhajanId) return true;
					if (b.songNumber === targetNumberStr) return true;
					if (
						!Number.isNaN(targetNumInt) &&
						b.songNumber &&
						parseInt(b.songNumber, 10) === targetNumInt
					)
						return true;
					return false;
				});

			const findLecture = () =>
				lectures.find((l) => l.id === bhajanId || l.id === targetNumberStr);

			let found: any = null;
			let foundLecture: any = null;

			if (type === "lecture") {
				foundLecture = findLecture();
			} else if (type === "bhajan") {
				found = findBhajan();
			} else {
				found = findBhajan();
				if (!found) foundLecture = findLecture();
			}

			if (found || foundLecture) markDeepLinkNavigation();

			if (found) {
				setSelectedBhajan(found);
				setActiveTab("songs");
				window.history.pushState({ isPopup: true, view: "reader" }, "");
				return true;
			}

			if (foundLecture) {
				window.history.pushState({ view: "lecture" }, "");
				addToHistory(foundLecture.id, "lecture");

				if (onPlayLecture) {
					onPlayLecture(foundLecture);
				} else {
					const queue: BhajanAudio[] | undefined = foundLecture.audio?.length
						? foundLecture.audio.map((t) => ({
								...t,
								bhajanTitle: foundLecture.title,
								parentBhajan: undefined,
							}))
						: undefined;
					setSelectedBhajan({
						id: foundLecture.id,
						title: foundLecture.title,
						titleIAST: foundLecture.title,
						firstLine: foundLecture.description?.substring(0, 30) || "",
						firstLineIAST: foundLecture.description?.substring(0, 30) || "",
						content: foundLecture.description || "",
						contentIAST: foundLecture.description || "",
						searchIndex: "",
						searchTokens: [],
						audio: foundLecture.audio,
						author: foundLecture.date
							? `Date: ${foundLecture.date}`
							: undefined,
					});
					setSelectedContextQueue(queue);
					setSelectedQueueName(foundLecture.title);
					setActiveTab("lectures");
				}
				return true;
			}

			return false;
		},
		[
			bhajans,
			lectures,
			addToHistory,
			setSelectedBhajan,
			setSelectedContextQueue,
			setSelectedQueueName,
			setActiveTab,
			onPlayLecture,
		],
	);

	// ── 1. Handle initial (cold-start) URL ──────────────────────────────
	useEffect(() => {
		if (isLoading || (bhajans.length === 0 && lectures.length === 0)) return;
		if (deepLinkHandledRef.current) return;

		const handleInitialUrl = async () => {
			const handleDeepLinkUrl = (urlStr: string) => {
				// Opened straight onto content: that screen's tour chapter waits.
				if (
					/[?&](bhajanId|lectureId|videoFolder|videoId|mandalVideoId|mandalPhotos|screen|action_type)=|\/v\//.test(
						urlStr,
					)
				)
					markDeepLinkNavigation();
				try {
					const url = new URL(urlStr);
					const bhId = url.searchParams.get("bhajanId");
					const lId = url.searchParams.get("lectureId");
					const vFolder = url.searchParams.get("videoFolder");
					const vId = url.searchParams.get("videoId");
					const mVId = url.searchParams.get("mandalVideoId");
					const screenParam = url.searchParams.get("screen");
					const actionType = url.searchParams.get("action_type");
					// A /v/... share link opened straight in the app (Android App
					// Links); on the website these arrive already as query params.
					const share = parseSharePath(url.pathname);

					if (share) {
						applyShareTargetToUrl(share);
						if (shareTargetScreen(share) === "videos") setIsVideosOpen(true);
						else setIsActivitiesOpen?.(true);
						deepLinkHandledRef.current = true;
					} else if (actionType && handleNotificationData) {
						const data: any = {};
						url.searchParams.forEach((val, key) => {
							data[key] = val;
						});
						handleNotificationData(data);
						deepLinkHandledRef.current = true;
					} else if (bhId) {
						const navigated = navigateToBhajanById(bhId, "bhajan");
						if (navigated) deepLinkHandledRef.current = true;
					} else if (lId) {
						const navigated = navigateToBhajanById(lId, "lecture");
						if (navigated) deepLinkHandledRef.current = true;
					} else if (vFolder || vId) {
						const newUrl = new URL(window.location.href);
						if (vFolder) newUrl.searchParams.set("videoFolder", vFolder);
						if (vId) newUrl.searchParams.set("videoId", vId);
						window.history.replaceState(
							window.history.state,
							"",
							newUrl.toString(),
						);
						setIsVideosOpen(true);
						deepLinkHandledRef.current = true;
					} else if (mVId) {
						const newUrl = new URL(window.location.href);
						newUrl.searchParams.set("mandalVideoId", mVId);
						window.history.replaceState(
							window.history.state,
							"",
							newUrl.toString(),
						);
						if (setIsActivitiesOpen) setIsActivitiesOpen(true);
						deepLinkHandledRef.current = true;
					} else if (url.searchParams.get("mandalPhotos") === "true") {
						// Shared mandal photos: the Activities screen reads the params.
						if (setIsActivitiesOpen) setIsActivitiesOpen(true);
						deepLinkHandledRef.current = true;
					} else if (screenParam && handleScreenAction) {
						handleScreenAction(screenParam);
						deepLinkHandledRef.current = true;
					}
				} catch (_e) {
					const search = urlStr.split("?")[1];
					if (search) {
						const params = new URLSearchParams(search);
						const bhId = params.get("bhajanId");
						const lId = params.get("lectureId");
						const vFolder = params.get("videoFolder");
						const vId = params.get("videoId");
						const mVId = params.get("mandalVideoId");
						const screenParam = params.get("screen");
						const actionType = params.get("action_type");

						if (actionType && handleNotificationData) {
							const data: any = {};
							params.forEach((val, key) => {
								data[key] = val;
							});
							handleNotificationData(data);
							deepLinkHandledRef.current = true;
						} else if (bhId) {
							const navigated = navigateToBhajanById(bhId, "bhajan");
							if (navigated) deepLinkHandledRef.current = true;
						} else if (lId) {
							const navigated = navigateToBhajanById(lId, "lecture");
							if (navigated) deepLinkHandledRef.current = true;
						} else if (vFolder || vId) {
							const newUrl = new URL(window.location.href);
							if (vFolder) newUrl.searchParams.set("videoFolder", vFolder);
							if (vId) newUrl.searchParams.set("videoId", vId);
							window.history.replaceState(
								window.history.state,
								"",
								newUrl.toString(),
							);
							setIsVideosOpen(true);
							deepLinkHandledRef.current = true;
						} else if (mVId) {
							const newUrl = new URL(window.location.href);
							newUrl.searchParams.set("mandalVideoId", mVId);
							window.history.replaceState(
								window.history.state,
								"",
								newUrl.toString(),
							);
							if (setIsActivitiesOpen) setIsActivitiesOpen(true);
							deepLinkHandledRef.current = true;
						} else if (screenParam && handleScreenAction) {
							handleScreenAction(screenParam);
							deepLinkHandledRef.current = true;
						}
					}
				}
			};

			if (Capacitor.isNativePlatform()) {
				const launch = await CapApp.getLaunchUrl();
				if (launch?.url) {
					handleDeepLinkUrl(launch.url);
				}
			}

			if (!deepLinkHandledRef.current) {
				handleDeepLinkUrl(window.location.href);
				const path = window.location.pathname.toLowerCase();
				if (path === "/privacy" && setIsPrivacyOpen) setIsPrivacyOpen(true);
				else if (path === "/terms" && setIsTermsOpen) setIsTermsOpen(true);
				else if (path === "/about" && setIsAboutOpen) setIsAboutOpen(true);
				deepLinkHandledRef.current = true;
			}
		};

		handleInitialUrl();
	}, [
		isLoading,
		bhajans,
		lectures,
		navigateToBhajanById,
		setIsVideosOpen,
		setIsActivitiesOpen,
		setIsPrivacyOpen,
		setIsTermsOpen,
		setIsAboutOpen,
		handleScreenAction,
		handleNotificationData,
	]);

	// ── 2. Handle pending actions that arrived while data was loading ────
	useEffect(() => {
		if (isLoading || (bhajans.length === 0 && lectures.length === 0)) return;
		const pending = pendingActionRef.current;
		if (pending) {
			markDeepLinkNavigation();
			if (pending.type === "bhajan" || pending.type === "lecture")
				navigateToBhajanById(pending.data, pending.type);
			if (pending.type === "videoFolder" || pending.type === "videoId") {
				const newUrl = new URL(window.location.href);
				if (pending.type === "videoFolder") {
					newUrl.searchParams.set("videoFolder", pending.data);
				} else if (pending.type === "videoId") {
					newUrl.searchParams.set("videoId", pending.data);
				}
				window.history.replaceState(
					window.history.state,
					"",
					newUrl.toString(),
				);
				setIsVideosOpen(true);
			}
			if (pending.type === "mandalVideoId") {
				const newUrl = new URL(window.location.href);
				newUrl.searchParams.set("mandalVideoId", pending.data);
				window.history.replaceState(
					window.history.state,
					"",
					newUrl.toString(),
				);
				if (setIsActivitiesOpen) setIsActivitiesOpen(true);
			}
			if (pending.type === "activities" && setIsActivitiesOpen) {
				setIsActivitiesOpen(true);
			}
			pendingActionRef.current = null;
		}
	}, [
		isLoading,
		bhajans,
		lectures,
		navigateToBhajanById,
		setIsVideosOpen,
		setIsActivitiesOpen,
	]);

	// ── 3. Background → foreground deep link (Capacitor appUrlOpen) ─────
	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;

		const listener = CapApp.addListener("appUrlOpen", (event) => {
			markDeepLinkNavigation();
			try {
				const urlStr = event.url;
				let bhId: string | null = null;
				let lId: string | null = null;
				let vFolder: string | null = null;
				let vId: string | null = null;
				let mVId: string | null = null;
				let screenParam: string | null = null;
				let actionType: string | null = null;
				let isMandalPhotos = false;
				let share: ReturnType<typeof parseSharePath> = null;
				const paramsForAction: any = {};

				try {
					const url = new URL(urlStr);
					bhId = url.searchParams.get("bhajanId");
					lId = url.searchParams.get("lectureId");
					vFolder = url.searchParams.get("videoFolder");
					vId = url.searchParams.get("videoId");
					mVId = url.searchParams.get("mandalVideoId");
					screenParam = url.searchParams.get("screen");
					actionType = url.searchParams.get("action_type");
					if (actionType) {
						url.searchParams.forEach((val, key) => {
							paramsForAction[key] = val;
						});
					}
					isMandalPhotos = url.searchParams.get("mandalPhotos") === "true";
					share = parseSharePath(url.pathname);
				} catch (_e) {
					const search = urlStr.split("?")[1];
					if (search) {
						const params = new URLSearchParams(search);
						bhId = params.get("bhajanId");
						lId = params.get("lectureId");
						vFolder = params.get("videoFolder");
						vId = params.get("videoId");
						mVId = params.get("mandalVideoId");
						screenParam = params.get("screen");
						actionType = params.get("action_type");
						if (actionType) {
							params.forEach((val, key) => {
								paramsForAction[key] = val;
							});
						}
					}
				}

				if (share) {
					applyShareTargetToUrl(share);
					if (shareTargetScreen(share) === "videos") {
						if (isLoading) {
							pendingActionRef.current =
								share.kind === "video"
									? { type: "videoId", data: share.videoId }
									: {
											type: "videoFolder",
											data: share.kind === "folder" ? share.folderId : "",
										};
						} else {
							setIsVideosOpen(true);
						}
					} else if (isLoading) {
						pendingActionRef.current = { type: "activities", data: "" };
					} else if (setIsActivitiesOpen) {
						setIsActivitiesOpen(true);
					}
				} else if (actionType && handleNotificationData) {
					handleNotificationData(paramsForAction);
				} else if (bhId) {
					if (isLoading || (bhajans.length === 0 && lectures.length === 0)) {
						pendingActionRef.current = { type: "bhajan", data: bhId };
					} else {
						navigateToBhajanById(bhId, "bhajan");
					}
				} else if (lId) {
					if (isLoading || (bhajans.length === 0 && lectures.length === 0)) {
						pendingActionRef.current = { type: "lecture", data: lId };
					} else {
						navigateToBhajanById(lId, "lecture");
					}
				} else if (vFolder || vId) {
					const newUrl = new URL(window.location.href);
					if (vFolder) newUrl.searchParams.set("videoFolder", vFolder);
					if (vId) newUrl.searchParams.set("videoId", vId);
					window.history.replaceState(
						window.history.state,
						"",
						newUrl.toString(),
					);

					if (isLoading) {
						pendingActionRef.current = {
							type: vId ? "videoId" : "videoFolder",
							data: vId || vFolder!,
						};
					} else {
						setIsVideosOpen(true);
					}
				} else if (mVId) {
					const newUrl = new URL(window.location.href);
					newUrl.searchParams.set("mandalVideoId", mVId);
					window.history.replaceState(
						window.history.state,
						"",
						newUrl.toString(),
					);

					if (isLoading) {
						pendingActionRef.current = {
							type: "mandalVideoId",
							data: mVId,
						};
					} else {
						if (setIsActivitiesOpen) setIsActivitiesOpen(true);
					}
				} else if (isMandalPhotos) {
					// The params are already in the URL the app was opened with.
					const params = new URL(event.url).searchParams;
					const newUrl = new URL(window.location.href);
					for (const key of ["mandalPhotos", "mandalId", "mandalDate"]) {
						const value = params.get(key);
						if (value) newUrl.searchParams.set(key, value);
					}
					window.history.replaceState(
						window.history.state,
						"",
						newUrl.toString(),
					);
					if (isLoading) {
						pendingActionRef.current = { type: "activities", data: "" };
					} else if (setIsActivitiesOpen) {
						setIsActivitiesOpen(true);
					}
				} else if (screenParam && handleScreenAction) {
					handleScreenAction(screenParam);
				}
			} catch (e) {
				console.error("[DeepLink] URL parse failed", e);
			}
		});

		return () => {
			listener.then((h) => h.remove()).catch(() => {});
		};
	}, [
		isLoading,
		bhajans,
		lectures,
		navigateToBhajanById,
		setIsVideosOpen,
		setIsActivitiesOpen,
		handleScreenAction,
		handleNotificationData,
	]);

	return { navigateToBhajanById, pendingActionRef };
}

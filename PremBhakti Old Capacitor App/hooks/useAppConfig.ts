/**
 * useAppConfig.ts
 *
 * Handles app-level configuration concerns:
 *  - Firestore force-update listener
 *  - TextZoom lock (prevents system font scaling)
 *  - Periodic cache cleanup
 *  - In-app update check (Capacitor AppUpdate)
 *  - Language-change quote reschedule
 */

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { TextZoom } from "@capacitor/text-zoom";
import { AppUpdate } from "@capawesome/capacitor-app-update";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import {
	doc,
	getDoc,
	increment,
	onSnapshot,
	serverTimestamp,
	setDoc,
} from "firebase/firestore";
import { useEffect, useRef } from "react";
import { db } from "../services/firebase";
import { runPeriodicCacheCleanup } from "../utils/cacheCleanup";
import { isVersionOlder } from "../utils/versioning";
import { APP_VERSION } from "../version";

interface ForceUpdateConfig {
	minNativeVersion: string;
	updateTitle: string;
	updateMessage: string;
	playStoreUrl: string;
}

interface UseAppConfigOptions {
	settingsLanguage: "en" | "hi";
	setForceUpdateConfig: (config: ForceUpdateConfig | null) => void;
	setIsForcedUpdateInProgress: (v: boolean) => void;
	setForceOtaUpdate: (v: boolean) => void;
	setForceOtaProgress: (v: number) => void;
	setHasNewOtaUpdate: (v: boolean) => void;
}

const WEB_REFRESH_ATTEMPT_PREFIX = "cpbs_web_refresh_attempt_";

function isLocalDevHost(): boolean {
	return import.meta.env.DEV;
}

async function refreshWebBundleOnce(requiredVersion: string): Promise<void> {
	const storageKey = `${WEB_REFRESH_ATTEMPT_PREFIX}${requiredVersion}`;
	if (sessionStorage.getItem(storageKey) === "1") return;
	sessionStorage.setItem(storageKey, "1");

	try {
		if ("serviceWorker" in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(
				registrations.map(async (registration) => {
					try {
						await registration.update();
					} catch {}
				}),
			);
		}

		if ("caches" in window) {
			const cacheNames = await caches.keys();
			// M5: Preserve user-downloaded data — books and audio tracks.
			// Only delete service-worker / asset caches. Without this, a forced
			// web update deletes all PDFs the user downloaded (15–50MB each).
			const USER_DATA_CACHES = new Set([
				"cpbs-book-cache-v3",
				"cpbs-audio-cache-v4",
			]);
			await Promise.all(
				cacheNames
					.filter((name) => !USER_DATA_CACHES.has(name))
					.map((name) => caches.delete(name)),
			);
		}
	} catch (e) {
		console.warn("[Web Refresh] Cache cleanup failed before reload:", e);
	} finally {
		window.location.reload();
	}
}

export function useAppConfig({
	settingsLanguage,
	setForceUpdateConfig,
	setIsForcedUpdateInProgress,
	setForceOtaUpdate,
	setForceOtaProgress,
	setHasNewOtaUpdate,
}: UseAppConfigOptions) {
	const otaUpdateTriggered = useRef(false);
	const lastForcedMinWebVersionRef = useRef("");
	const downloadListenerRef = useRef<any>(null);
	const optionalDownloadDone = useRef(false);
	const versionControlSnapshotRef = useRef(0);
	const appUpdateCheckedRef = useRef(false);
	const playStoreUpdateListenerRef = useRef<any>(null);

	// ── Core config (runs once) ──────────────────────────────────────────
	useEffect(() => {
		// 0. Upgrade check: Wipe old caches if the native app or JS bundle was updated
		const checkAppUpgrade = async () => {
			try {
				let currentNativeVersion = "unknown";
				if (Capacitor.isNativePlatform()) {
					const info = await App.getInfo();
					currentNativeVersion = info.version || "unknown";
				}
				const currentVersionId = `${currentNativeVersion}_${APP_VERSION}`;

				const { value: lastRunVersionId } = await Preferences.get({
					key: "last_run_version_id",
				});

				if (lastRunVersionId && lastRunVersionId !== currentVersionId) {
					console.log(
						`[AppUpgrade] Version changed from ${lastRunVersionId} to ${currentVersionId}. Wiping ALL legacy caches.`,
					);

					// 1. Clear Capacitor Preferences caches (SharedPreferences/UserDefaults)
					const keysResult = await Preferences.keys();
					for (const key of keysResult.keys) {
						// Target old system caches aggressively
						if (
							key === "gh_darshan_cache" ||
							key === "gh_activities_cache" ||
							key.startsWith("firestore_cache_") ||
							key.startsWith("cpbs_") // Remove any old custom preference caches if they exist
						) {
							// Be careful not to delete critical settings like 'last_run_version_id', 'last_tracked_version', etc.
							if (
								!key.includes("last_run") &&
								!key.includes("tracked") &&
								!key.includes("last_cleanup")
							) {
								await Preferences.remove({ key });
							}
						}
					}

					// 2. Clear known localStorage cache keys (collect first, then remove to avoid index shift bug)
					const localStorageKeysToDelete: string[] = [];
					for (let i = 0; i < localStorage.length; i++) {
						const key = localStorage.key(i);
						if (
							key &&
							(key === "gh_darshan_cache" ||
								key === "gh_activities_cache" ||
								key.startsWith("firestore_cache_"))
						) {
							localStorageKeysToDelete.push(key);
						}
					}
					localStorageKeysToDelete.forEach((key) =>
						localStorage.removeItem(key),
					);

					// 3. (Optional but good) The filesystem cache cleanup handles itself via runPeriodicCacheCleanup,
					// but we reset its timer to force a cleanup on this run.
					await Preferences.remove({ key: "cpbs_cache_last_cleanup" });
				}

				// Save current version for next time
				if (lastRunVersionId !== currentVersionId) {
					await Preferences.set({
						key: "last_run_version_id",
						value: currentVersionId,
					});
				}
			} catch (e) {
				console.warn(
					"[AppUpgrade] Failed to check for upgrade / wipe cache",
					e,
				);
			}
		};
		checkAppUpgrade();

		// 1. Lock text zoom
		TextZoom.set({ value: 1 }).catch(() => {});

		// notifyAppReady() is called in index.tsx at the earliest point before React
		// mounts — that is the only correct location. autoUpdate is disabled in
		// capacitor.config.json (the updateUrl endpoints don't exist), so the
		// updateAvailable native event never fires. All OTA is managed below.

		// 2. Background cache cleanup
		runPeriodicCacheCleanup().catch((e) =>
			console.warn("[CacheCleanup] Background cleanup failed:", e),
		);

		// 2b. Optional background OTA ─────────────────────────────────────────────
		//
		// Silently downloads the latest bundle from ota_config/latest if it is
		// newer than APP_VERSION, then queues it to apply ONLY when the user
		// fully kills and reopens the app. No blocking screen is shown.
		//
		// Runs at most ONCE per JS session (guarded by optionalDownloadDone).
		// The forced-OTA path (minWebVersion) below takes priority; this function
		// is only called when no forced update is needed.
		const checkOptionalUpdate = async () => {
			if (!Capacitor.isNativePlatform()) return;
			if (optionalDownloadDone.current) return;
			optionalDownloadDone.current = true;
			try {
				const otaDoc = await getDoc(doc(db, "ota_config", "latest"));
				if (!otaDoc.exists()) return;
				const otaData = otaDoc.data();
				const latestOtaVersion = String(otaData.version || "").trim();
				if (!otaData.url || !latestOtaVersion) return;
				// Nothing to do if we're already on the latest version
				if (!isVersionOlder(APP_VERSION, latestOtaVersion)) {
					setHasNewOtaUpdate(false);
					return;
				}

				setHasNewOtaUpdate(true);
				// Reuse a bundle already on device if available
				const list = await CapacitorUpdater.list();
				const existing = list.bundles.find(
					(b: any) =>
						b.version === latestOtaVersion &&
						(b.status === "success" || b.status === "pending"),
				);
				let bundleId = existing?.id;
				if (!bundleId) {
					const dl = await CapacitorUpdater.download({
						url: otaData.url,
						version: latestOtaVersion,
					});
					bundleId = dl.id;
				}
				// Queue to apply ONLY on next full kill+reopen — never mid-session
				await CapacitorUpdater.next({ id: bundleId });
				await CapacitorUpdater.setMultiDelay({
					delayConditions: [{ kind: "kill" }],
				});
				console.log(
					`[OTA Optional] v${latestOtaVersion} queued — applies on next kill+reopen.`,
				);
			} catch (e) {
				console.warn(
					"[OTA Optional] Background download failed (non-fatal):",
					e,
				);
				optionalDownloadDone.current = false; // allow retry on next Firestore snapshot
			}
		};

		// 3. Firestore force-update listener
		const unsubVersionControl = onSnapshot(
			doc(db, "app_config", "version_control"),
			async (snap) => {
				const snapshotId = versionControlSnapshotRef.current + 1;
				versionControlSnapshotRef.current = snapshotId;

				if (snap.exists()) {
					const data = snap.data();

					if (data.minNativeVersion && Capacitor.isNativePlatform()) {
						let nativeAppVersion = APP_VERSION;
						try {
							const info = await App.getInfo();
							nativeAppVersion = info.version || nativeAppVersion;
						} catch (e) {
							console.warn(
								"[VersionControl] Could not read native app version; falling back to bundle version.",
								e,
							);
						}

						if (snapshotId !== versionControlSnapshotRef.current) return;

						if (isVersionOlder(nativeAppVersion, data.minNativeVersion)) {
							setForceUpdateConfig({
								minNativeVersion: data.minNativeVersion,
								updateTitle: data.updateTitle || "Update Required",
								updateMessage:
									data.updateMessage ||
									"A new version of the app is available. Please update to continue.",
								playStoreUrl:
									data.playStoreUrl ||
									"https://play.google.com/store/apps/details?id=com.cpbs.bhajans",
							});

							// Trigger Google Play native update check only if the current version is older than minNativeVersion
							if (!appUpdateCheckedRef.current) {
								appUpdateCheckedRef.current = true;
								AppUpdate.addListener(
									"onFlexibleUpdateStateChange",
									async (state) => {
										if (state.installStatus === 11) {
											// 11 is DOWNLOADED
											await AppUpdate.completeFlexibleUpdate();
										}
									},
								)
									.then((listener) => {
										playStoreUpdateListenerRef.current = listener;
									})
									.catch((e) => console.error("[AppUpdate] Listener error", e));

								AppUpdate.getAppUpdateInfo()
									.then(async (result) => {
										if (result.updateAvailability === 2) {
											if (result.flexibleUpdateAllowed) {
												await AppUpdate.startFlexibleUpdate();
											} else if (result.immediateUpdateAllowed) {
												setIsForcedUpdateInProgress(true);
												await AppUpdate.performImmediateUpdate();
											}
										}
									})
									.catch((e) => console.error("[AppUpdate] Check failed", e));
							}
						} else {
							setForceUpdateConfig(null);
						}
					} else {
						setForceUpdateConfig(null);
					}

					const minWebVersion = (data.minWebVersion || "").trim();

					// 3b. OTA force update logic. Native-only by design:
					// browser/PWA/run-dev sessions should never show the OTA blocker.
					if (!minWebVersion) {
						otaUpdateTriggered.current = false;
						lastForcedMinWebVersionRef.current = "";
						setForceOtaProgress(0);
						setForceOtaUpdate(false);
						checkOptionalUpdate(); // No forced-update configured — silently grab latest if any
					} else if (!Capacitor.isNativePlatform()) {
						otaUpdateTriggered.current = false;
						lastForcedMinWebVersionRef.current = "";
						setForceOtaProgress(0);
						setForceOtaUpdate(false);

						if (
							!isLocalDevHost() &&
							isVersionOlder(APP_VERSION, minWebVersion)
						) {
							refreshWebBundleOnce(minWebVersion).catch((e) =>
								console.warn(
									"[Web Refresh] Failed to refresh stale bundle:",
									e,
								),
							);
						}
					} else if (isVersionOlder(APP_VERSION, minWebVersion)) {
						if (lastForcedMinWebVersionRef.current !== minWebVersion) {
							otaUpdateTriggered.current = false;
							lastForcedMinWebVersionRef.current = minWebVersion;
						}

						if (!otaUpdateTriggered.current) {
							otaUpdateTriggered.current = true;
							setForceOtaUpdate(false);

							if (Capacitor.isNativePlatform()) {
								// Native OTA logic
								(async () => {
									try {
										const otaDoc = await getDoc(
											doc(db, "ota_config", "latest"),
										);
										if (otaDoc.exists()) {
											const otaData = otaDoc.data();
											const latestOtaVersion = String(
												otaData.version || "",
											).trim();
											if (otaData.url && latestOtaVersion) {
												if (isVersionOlder(latestOtaVersion, minWebVersion)) {
													console.warn(
														`[OTA Force Update] Required ${minWebVersion}, but latest uploaded OTA is ${latestOtaVersion}.`,
													);
													otaUpdateTriggered.current = false;
													setForceOtaProgress(0);
													setForceOtaUpdate(false);
													return;
												}
												setForceOtaUpdate(true);
												// Register download progress listener only ONCE
												if (!downloadListenerRef.current) {
													let maxProgress = 0;
													downloadListenerRef.current =
														await CapacitorUpdater.addListener(
															"download",
															(info: any) => {
																const newProgress = Math.round(info.percent);
																if (newProgress > maxProgress) {
																	maxProgress = newProgress;
																	setForceOtaProgress(maxProgress);
																}
															},
														);
												}

												let dlId = "";
												try {
													const dl = await CapacitorUpdater.download({
														url: otaData.url,
														version: latestOtaVersion,
													});
													dlId = dl.id;
												} catch (downloadErr: any) {
													console.warn(
														"[OTA Force Update] Download threw an error (might be already downloading/downloaded):",
														downloadErr,
													);
													// Fallback: check if it's already in the bundle list
													try {
														const list = await CapacitorUpdater.list();
														const existing = list.bundles.find(
															(b: any) => b.version === latestOtaVersion,
														);
														if (
															existing &&
															(existing.status === "success" ||
																existing.status === "pending")
														) {
															console.log(
																"[OTA Force Update] Bundle already exists, using id:",
																existing.id,
															);
															dlId = existing.id;
														} else {
															throw downloadErr; // rethrow if we can't find a valid existing bundle
														}
													} catch (_listErr) {
														throw downloadErr;
													}
												}

												if (dlId) {
													// set() causes app to reload — no code after this runs
													await CapacitorUpdater.set({ id: dlId });
												}
											} else {
												console.warn(
													"[OTA Force Update] Latest OTA config is missing url or version.",
												);
												otaUpdateTriggered.current = false;
												setForceOtaProgress(0);
												setForceOtaUpdate(false);
											}
										} else {
											console.warn(
												"[OTA Force Update] ota_config/latest does not exist.",
											);
											otaUpdateTriggered.current = false;
											setForceOtaProgress(0);
											setForceOtaUpdate(false);
										}
									} catch (e) {
										console.error("[OTA Force Update] Failed", e);
										// Do NOT dismiss the block screen here for Forced updates.
										// If the OTA is broken/missing (e.g. they haven't uploaded it yet),
										// the app should remain blocked at 0% to prevent bypassing.
									}
								})();
							}
						} else {
							setForceOtaUpdate(true);
						}
					} else {
						otaUpdateTriggered.current = false;
						lastForcedMinWebVersionRef.current = "";
						setForceOtaProgress(0);
						setForceOtaUpdate(false);
						checkOptionalUpdate(); // Forced-update threshold satisfied — silently grab latest if any
					}
				} else {
					setForceUpdateConfig(null);
					otaUpdateTriggered.current = false;
					lastForcedMinWebVersionRef.current = "";
					setForceOtaProgress(0);
					setForceOtaUpdate(false);
					checkOptionalUpdate(); // No version control doc — silently grab latest if any
				}
			},
		);

		// 4. Native in-app update check is now handled inside the onSnapshot listener

		// 5. Version analytics tracking (All Platforms)
		const trackUsage = async () => {
			try {
				// Skip all development tracking (web and native livereload)
				if (isLocalDevHost()) {
					return;
				}

				let os = "desktop";
				let appType = "web";
				const versionSuffix = APP_VERSION.replace("v", "");
				let nativeVersionSuffix = "unknown";

				if (Capacitor.isNativePlatform()) {
					os = Capacitor.getPlatform() === "ios" ? "ios" : "android";
					appType = "native";
					try {
						const info = await App.getInfo();
						if (info.version) {
							nativeVersionSuffix = info.version.replace("v", "");
						}
					} catch (e) {
						console.warn(
							"[VersionTrack] Could not read native app version:",
							e,
						);
					}
				} else {
					const ua =
						navigator.userAgent || navigator.vendor || (window as any).opera;
					if (/android/i.test(ua)) {
						os = "android";
					} else if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
						os = "ios";
					}
					const isPWA =
						window.matchMedia("(display-mode: standalone)").matches ||
						(window.navigator as any).standalone === true;
					appType = isPWA ? "pwa" : "web";
				}

				// We use explicit naming to avoid confusion between native and OTA versions.
				const currentNativeVersionString = Capacitor.isNativePlatform()
					? `${os}_native_${nativeVersionSuffix}`
					: `${os}_${appType}_${versionSuffix}`;

				const currentBundleVersionString = Capacitor.isNativePlatform()
					? `${os}_ota_${versionSuffix}`
					: "";

				let osVersionStr = "";
				if (os === "android" && appType === "native") {
					const match = navigator.userAgent.match(/Android\s([0-9.]+)/i);
					if (match) {
						osVersionStr = `os_android_${match[1]}`;
					}
				}

				// Helper function to handle stat increments safely without redundant session writes
				const trackStat = async (currentStr: string, prefKey: string) => {
					if (!currentStr) return;
					const { value: lastTracked } = await Preferences.get({
						key: prefKey,
					});

					if (lastTracked !== currentStr) {
						const currentDocId = currentStr.replace(/\./g, "_");

						// If updating from a previous version, decrement the old count.
						// No lastSeen here: leaving a version is not "seen on it".
						if (lastTracked) {
							const oldDocId = lastTracked.replace(/\./g, "_");
							await setDoc(
								doc(db, "app_version_stats", oldDocId),
								{
									version: lastTracked,
									count: increment(-1),
								},
								{ merge: true },
							).catch(() => {});
						}

						// Increment new count
						await setDoc(
							doc(db, "app_version_stats", currentDocId),
							{
								version: currentStr,
								count: increment(1),
								lastSeen: serverTimestamp(),
							},
							{ merge: true },
						).catch(() => {});

						await Preferences.set({ key: prefKey, value: currentStr });
					}
				};

				await trackStat(osVersionStr, "last_tracked_os_version");
				await trackStat(currentNativeVersionString, "last_tracked_version");
				await trackStat(
					currentBundleVersionString,
					"last_tracked_ota_bundle_version",
				);
			} catch (e) {
				console.warn("[VersionTrack] Could not track version:", e);
			}
		};
		trackUsage();

		return () => {
			unsubVersionControl();
			if (playStoreUpdateListenerRef.current) {
				playStoreUpdateListenerRef.current.remove();
				playStoreUpdateListenerRef.current = null;
			}
			if (downloadListenerRef.current) {
				downloadListenerRef.current.remove();
				downloadListenerRef.current = null;
			}
		};
	}, [
		setForceUpdateConfig,
		setIsForcedUpdateInProgress,
		setForceOtaUpdate,
		setForceOtaProgress,
		setHasNewOtaUpdate,
	]);
}

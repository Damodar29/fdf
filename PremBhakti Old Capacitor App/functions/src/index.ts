import axios from "axios";
import * as admin from "firebase-admin";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import * as functionsV1 from "firebase-functions/v1";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { buildAnniversaryList, istToday } from "./dikshaAnniversary";
import { autoInverseRelation } from "./familyRelations";
import {
	cleanEmail,
	dikshaDateVariants,
	nameMatchScore,
} from "./familySearch";

// Initialize fluent-ffmpeg with the static binaries
// (ffmpeg removed as it is no longer used for audio processing here)

admin.initializeApp();

async function getNotificationSoundSettings() {
	try {
		const db = admin.firestore();
		const doc = await db
			.collection("app_config")
			.doc("notification_settings")
			.get();
		if (doc.exists) {
			const data = doc.data();
			if (data?.selectedSound) {
				return {
					channelId: "push_notifications_v6",
					sound: "notisound3",
					apnsSound: "notisound3.m4a",
				};
			}
		}
	} catch (e) {
		console.error("Error fetching notification_settings", e);
	}
	return {
		channelId: "push_notifications_v6",
		sound: "notisound3",
		apnsSound: "notisound3.m4a",
	};
}

// REPO constants — still used by uploadToGithub and migrateUploadToGithub
const REPO_OWNER = "chaitanyaprembhakti";

// Note: saveBhajanData, saveBookData, saveLectureData, saveAppConfig, fetchGithubRelease
// have been migrated to Firebase Storage SDK (client-side) + Cloudflare CDN Worker.
// See utils/firebaseDataStorage.ts and src/utils/github*Storage.ts

// ─── [MIGRATED] saveBhajanData, saveBookData, saveLectureData ────────────────
// These are now handled client-side via Firebase Storage SDK.
// See: src/utils/githubBhajanStorage.ts
//      src/utils/githubBookStorage.ts
//      src/utils/githubLectureStorage.ts
//      utils/firebaseDataStorage.ts

// ─── [MIGRATED] fetchGithubRelease (CORS proxy) ──────────────────────────────
// Now served by Cloudflare CDN Worker /firebase/ route.
// See: workers/github-cdn.js → /firebase/* handler

// ─── Cloud Function 5: Fetch Archive.org Metadata (Bypass CORS) ────────────────

export const fetchArchiveMetadata = onCall(
	{ cors: true, timeoutSeconds: 60, memory: "256MiB" },
	async (request: any) => {
		const { identifier } = request.data;
		if (!identifier) {
			throw new HttpsError("invalid-argument", "Missing archive identifier.");
		}

		try {
			const res = await axios.get(
				`https://archive.org/metadata/${identifier}`,
				{
					headers: { "User-Agent": "CPBS-Admin-Function/1.0" },
					responseType: "json",
				},
			);
			return res.data;
		} catch (error: any) {
			console.error("fetchArchiveMetadata error:", error.message);
			throw new HttpsError(
				"internal",
				error.message || "Failed to fetch metadata from Archive.org.",
			);
		}
	},
);

// ─── Cloud Function: Serve Rich Previews for Video Links ───────────────────
// Generates OG tags for WhatsApp/Facebook sharing and redirects to the app.
//
// The share-preview Cloudflare Worker (share-preview-worker/) answers most of
// these requests before they reach here; this function is its fallback and
// still builds the mandal previews. Keep both in sync with utils/shareLinks.ts.

// Link-preview fetchers. Everyone else is a person and gets a plain redirect.
const PREVIEW_BOT_UA =
	/bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|twitter|slack|discord|linkedin|pinterest|skype|viber|line\/|kakaotalk|snapchat|embedly|preview|vkshare|redditbot|applebot|googleother|google-inspectiontool/i;

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

/** "DD-MM-YYYY" or "YYYY-MM-DD" → "YYYY-MM-DD" (same as formatForDateInput). */
const toIsoDate = (value: unknown): string => {
	if (typeof value !== "string") return "";
	const parts = value.trim().split("-");
	return parts.length === 3 && parts[0].length === 2
		? `${parts[2]}-${parts[1]}-${parts[0]}`
		: value.trim();
};

const youtubeThumbnail = (url: unknown): string => {
	if (typeof url !== "string" || !url.includes("youtu")) return "";
	const matchId = url.match(
		/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/,
	);
	return matchId?.[1]
		? `https://img.youtube.com/vi/${matchId[1]}/hqdefault.jpg`
		: "";
};

export const serveVideoPreview = onRequest(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (req, res) => {
		const SITE = "https://chaitanyaprembhakti.org";
		const pathParts = req.path
			.split("/")
			.filter(Boolean) // removes empty strings
			.map((p) => {
				try {
					return decodeURIComponent(p);
				} catch {
					return p;
				}
			});

		if (pathParts[0] !== "v" || pathParts.length < 2) {
			res.redirect(SITE);
			return;
		}

		// Where the link leads — known from the path alone, no database needed.
		const enc = encodeURIComponent;
		let kind: "video" | "folder" | "mandal" | "mandal-photos" = "video";
		let videoId = "";
		let appUrl = SITE;
		if (pathParts[1] === "mandal" && pathParts.length === 4) {
			kind = "mandal";
			appUrl = `${SITE}/?mandalVideoId=${enc(pathParts[3])}`;
		} else if (pathParts[1] === "folder" && pathParts.length === 3) {
			kind = "folder";
			appUrl = `${SITE}/?videoFolder=${enc(pathParts[2])}`;
		} else if (pathParts[1] === "mandal-photos" && pathParts.length === 4) {
			kind = "mandal-photos";
			appUrl = `${SITE}/?mandalPhotos=true&mandalId=${enc(pathParts[2])}&mandalDate=${enc(pathParts[3])}`;
		} else {
			// Standard video (handles both `/v/{videoId}` and `/v/video/{videoId}`)
			videoId =
				pathParts.length === 3 && pathParts[1] === "video"
					? pathParts[2]
					: pathParts[1];
			appUrl = `${SITE}/?videoId=${enc(videoId)}`;
		}

		// People go straight to the app page; only preview fetchers need the tags.
		if (!PREVIEW_BOT_UA.test(req.get("user-agent") || "")) {
			res.set("Cache-Control", "no-store");
			res.redirect(302, appUrl);
			return;
		}

		try {
			const db = admin.firestore();

			let title = "Watch Video";
			let imageUrl = `${SITE}/icon.webp`; // Fallback image
			let description = "Watch this video on Prem Bhakti app";
			let ogType = "video.other";

			if (kind === "mandal") {
				const mandalData = (
					await db.collection("mandals").doc(pathParts[2]).get()
				).data();
				const video = mandalData?.videos?.find(
					(v: any) => v.id === pathParts[3],
				);
				if (video) {
					title = video.title || title;
					imageUrl =
						video.thumbnailUrl || youtubeThumbnail(video.url) || imageUrl;
					description = `Watch this video of ${mandalData?.name || "Activities"} on Prem Bhakti app`;
				}
			} else if (kind === "folder") {
				// The app keeps folders in "video_folders" (this used to read
				// "videoFolders", so every folder link had the generic preview).
				const folderData = (
					await db.collection("video_folders").doc(pathParts[2]).get()
				).data();
				if (folderData) {
					title = folderData.name || "Video Collection";
					if (!folderData.useDefaultThumbnail && folderData.thumbnailUrl) {
						imageUrl = folderData.thumbnailUrl;
					}
					description = `Watch the '${title}' collection on Prem Bhakti app`;
				}
			} else if (kind === "mandal-photos") {
				ogType = "website";
				const mandalData = (
					await db.collection("mandals").doc(pathParts[2]).get()
				).data();
				if (mandalData) {
					const name = mandalData.name || "Activity";
					const date = pathParts[3];
					const gallery: any[] = Array.isArray(mandalData.gallery)
						? mandalData.gallery
						: [];
					// A photo from the shared day, not just the mandal's first one.
					const photo =
						(date !== "all" &&
							gallery.find((g) => g?.url && toIsoDate(g.date) === date)) ||
						gallery.find((g) => g?.url);
					if (photo?.url) imageUrl = photo.url;
					title = `Darshan - ${name}`;
					description =
						date !== "all"
							? `View darshan and photos of ${name} (${date}) on Prem Bhakti app`
							: `View darshan and photos of ${name} on Prem Bhakti app`;
				}
			} else {
				const videoData = (
					await db.collection("videos").doc(videoId).get()
				).data();
				if (videoData) {
					title = videoData.title || title;
					if (!videoData.useDefaultThumbnail && videoData.thumbnailUrl) {
						imageUrl = videoData.thumbnailUrl;
					} else {
						imageUrl = youtubeThumbnail(videoData.url) || imageUrl;
					}
				}
			}

			const t = escapeHtml(title);
			const d = escapeHtml(description);
			const img = escapeHtml(imageUrl);
			const target = escapeHtml(appUrl);
			const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <meta property="og:site_name" content="Prem Bhakti">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:alt" content="${t}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${escapeHtml(SITE + req.path)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">
  <meta http-equiv="refresh" content="0;url=${target}">
</head>
<body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
  <p><a href="${target}">Open in Prem Bhakti</a></p>
</body>
</html>`;

			// Lets Firebase Hosting's CDN answer repeat fetches of the same link.
			res.set("Cache-Control", "public, max-age=300, s-maxage=600");
			res.status(200).send(html);
		} catch (err) {
			console.error("serveVideoPreview error:", err);
			res.redirect(appUrl);
		}
	},
);

// ─── Cloud Function: Daily Quote Push Notification ─────────────────────────

export const dailyQuotePush = onSchedule(
	{
		schedule: "0 8 * * *",
		timeZone: "Asia/Kolkata",
		timeoutSeconds: 60,
		memory: "256MiB",
	},
	async (_event) => {
		try {
			const nowUtc = Date.now();
			const istOffsetMs = 5.5 * 60 * 60 * 1000;
			const istDate = new Date(nowUtc + istOffsetMs);

			const month = istDate.getUTCMonth();
			const day = istDate.getUTCDate();

			// Use a static leap year (2024) to calculate Day of Year correctly
			const leapYearDate = new Date(Date.UTC(2024, month, day));
			const start = new Date(Date.UTC(2024, 0, 0));
			const diff = leapYearDate.getTime() - start.getTime();
			const oneDay = 1000 * 60 * 60 * 24;
			const dayOfYear = Math.floor(diff / oneDay);
			const dayOfYearStr = String(dayOfYear).padStart(3, "0");

			const months = [
				"JAN",
				"FEB",
				"MAR",
				"APR",
				"MAY",
				"JUN",
				"JUL",
				"AUG",
				"SEP",
				"OCT",
				"NOV",
				"DEC",
			];
			const monthStr = months[month];

			// ── Image URL resolution ──────────────────────────────────────────────
			// IMPORTANT: We use the Cloudflare CDN URL (same as notificationService.ts)
			// instead of direct GitHub release URLs. GitHub release URLs do 301/302
			// redirects to objects.githubusercontent.com — FCM's background notification
			// renderer does NOT follow redirects, causing images to randomly fail.
			// The Cloudflare CDN serves images directly with no redirect, fixing this.
			const extensions = ["JPG", "jpg", "PNG", "png", "jpeg"];
			let validQuoteUrl = "";

			for (const ext of extensions) {
				// Use images CDN — dedicated subdomain for image assets, served from B2 via Cloudflare
				const tryUrl = `https://images.chaitanyaprembhakti.org/dailyquotes_1/${dayOfYearStr}.${day}.${monthStr}.${ext}`;
				try {
					// Use GET (not HEAD) since some CDN configs reject HEAD requests
					// but respond correctly to GET. We abort after headers to avoid
					// downloading the full image (just need HTTP 200 confirmation).
					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), 8000);
					const res = await axios.get(tryUrl, {
						maxRedirects: 3,
						validateStatus: (s: number) => s < 400,
						responseType: "stream",
						signal: controller.signal as any,
					});
					clearTimeout(timeoutId);
					// Immediately destroy the response stream — we only needed the status
					if (res.data && typeof res.data.destroy === "function") {
						res.data.destroy();
					}
					if (res.status >= 200 && res.status < 400) {
						validQuoteUrl = tryUrl;
						break;
					}
				} catch (_e) {
					// try next extension
				}
			}

			if (!validQuoteUrl) {
				console.warn(
					"Could not find a valid quote image. Sending text-only notification.",
				);
			}

			const soundSettings = await getNotificationSoundSettings();
			const TTL_2_DAYS_S = 172800; // 2 days in seconds
			const payload: admin.messaging.Message = {
				android: {
					priority: "high",
					ttl: TTL_2_DAYS_S * 1000, // Android TTL in milliseconds
					notification: {
						title: "नित्य वाणी",
						body: "आज का दिव्य विचार देखने के लिए टैप करें",
						imageUrl: validQuoteUrl || undefined,
						channelId: soundSettings.channelId,
						priority: "high",
						visibility: "public",
						sound: soundSettings.sound,
					},
				},
				apns: {
					headers: {
						"apns-expiration": String(
							Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
						),
					},
					payload: {
						aps: {
							sound: soundSettings.apnsSound,
							alert: {
								title: "नित्य वाणी",
								body: "आज का दिव्य विचार देखने के लिए टैप करें",
							},
							"mutable-content": 1,
						},
					},
					...(validQuoteUrl ? { fcm_options: { image: validQuoteUrl } } : {}),
				},
				data: {
					title: "नित्य वाणी",
					body: "आज का दिव्य विचार देखने के लिए टैप करें",
					action_type: "screen",
					target_screen: "quotes",
					// Both keys for compatibility: CustomFirebaseMessagingService checks
					// data.image first, then data.imageUrl (line 76-77 in Java)
					...(validQuoteUrl
						? { image: validQuoteUrl, imageUrl: validQuoteUrl }
						: {}),
				},
				topic: "all",
			};

			await admin.messaging().send(payload);
			console.log("Successfully sent daily quote push notification", payload);
		} catch (error) {
			console.error("Error sending daily quote push notification:", error);
		}
	},
);

// ─── Cloud Function: Daily Event Push Notification ─────────────────────────

export const dailyEventPush = onSchedule(
	{
		schedule: "0 4,6,16 * * *", // 4 AM, 6 AM, 4 PM IST
		timeZone: "Asia/Kolkata",
		timeoutSeconds: 60,
		memory: "256MiB",
	},
	async (_event) => {
		try {
			const db = admin.firestore();
			const nowUtc = Date.now();
			const istOffsetMs = 5.5 * 60 * 60 * 1000;
			const istDate = new Date(nowUtc + istOffsetMs);

			// Today
			const tYear = istDate.getUTCFullYear();
			const tMonth = istDate.getUTCMonth(); // 0-11
			const tDate = istDate.getUTCDate(); // 1-31
			const todayStr = `${tYear}-${String(tMonth + 1).padStart(2, "0")}-${String(tDate).padStart(2, "0")}`;

			// Tomorrow
			const tomorrow = new Date(istDate.getTime() + 24 * 60 * 60 * 1000);
			const tmYear = tomorrow.getUTCFullYear();
			const tmMonth = tomorrow.getUTCMonth();
			const tmDate = tomorrow.getUTCDate();
			const tomorrowStr = `${tmYear}-${String(tmMonth + 1).padStart(2, "0")}-${String(tmDate).padStart(2, "0")}`;

			const istHour = istDate.getUTCHours();

			const monthNames = [
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec",
			];
			const todayMonthDoc = monthNames[tMonth];
			const tomorrowMonthDoc = monthNames[tmMonth];

			// Fetch Today's Document
			const todayDoc = await db.collection("Calendar").doc(todayMonthDoc).get();
			const todayEvents = todayDoc.exists
				? todayDoc.data()?.[todayStr] || []
				: [];

			// Fetch Tomorrow's Document
			const tomorrowDoc = await db
				.collection("Calendar")
				.doc(tomorrowMonthDoc)
				.get();
			const tomorrowEvents = tomorrowDoc.exists
				? tomorrowDoc.data()?.[tomorrowStr] || []
				: [];

			// Process Tomorrow's Ekadashi (Send at 4 PM)
			if (istHour === 16) {
				const tomorrowEkadashis = tomorrowEvents.filter(
					(e: any) => e.isEkadashi,
				);
				for (const ev of tomorrowEkadashis) {
					let bodyText = ev.eventName || ev.title || "एकादशी व्रत";
					if (ev.breakTime) {
						const cleanBreakTime = ev.breakTime.replace(/^पारण\s*[-:]?\s*/, "");
						bodyText += `। पारण: ${cleanBreakTime}`;
					}
					const soundSettings = await getNotificationSoundSettings();
					const TTL_2_DAYS_S = 172800;
					const payload: admin.messaging.Message = {
						android: {
							ttl: TTL_2_DAYS_S * 1000,
							notification: {
								title: `🔴 कल एकादशी है`,
								body: bodyText,
								color: "#EF4444",
								sound: soundSettings.sound,
								channelId: soundSettings.channelId,
							},
						},
						apns: {
							headers: {
								"apns-expiration": String(
									Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
								),
							},
							payload: {
								aps: {
									sound: soundSettings.apnsSound,
									alert: {
										title: `🔴 कल एकादशी है`,
										body: bodyText,
									},
								},
							},
						},
						data: {
							title: `🔴 कल एकादशी है`,
							body: bodyText,
							action_type: "screen",
							target_screen: "events",
						},
						topic: "all",
					};
					await admin.messaging().send(payload);
					console.log(
						"Sent tomorrow Ekadashi notification:",
						payload.notification,
					);
				}

				// Process Tomorrow's Non-Ekadashi Events
				const tomorrowOtherEvents = tomorrowEvents.filter(
					(e: any) => !e.isEkadashi,
				);
				if (tomorrowOtherEvents.length === 1) {
					const ev = tomorrowOtherEvents[0];
					let color = "#3B82F6"; // Blue
					let iconStr = "🔵";
					if (ev.type === "festival") {
						color = "#16A34A";
						iconStr = "🟢";
					}

					const titleStr = ev.eventName || ev.title || "कल का उत्सव";
					const bodyStr = ev.description
						? ev.description.substring(0, 100)
						: "कल का उत्सव";
					const eventImage = ev.imageUrl || "";

					const soundSettings = await getNotificationSoundSettings();
					const TTL_2_DAYS_S = 172800;
					const payload: admin.messaging.Message = {
						android: {
							priority: "high",
							ttl: TTL_2_DAYS_S * 1000,
							notification: {
								title: `${iconStr} कल: ${titleStr}`,
								body: bodyStr,
								color: color,
								imageUrl: eventImage || undefined,
								channelId: soundSettings.channelId,
								sound: soundSettings.sound,
							},
						},
						apns: {
							headers: {
								"apns-expiration": String(
									Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
								),
							},
							payload: {
								aps: {
									sound: soundSettings.apnsSound,
									alert: {
										title: `${iconStr} कल: ${titleStr}`,
										body: bodyStr,
									},
									"mutable-content": 1,
								},
							},
							...(eventImage ? { fcm_options: { image: eventImage } } : {}),
						},
						data: {
							title: `${iconStr} कल: ${titleStr}`,
							body: bodyStr,
							action_type: "screen",
							target_screen: "events",
							image: eventImage,
						},
						topic: "all",
					};
					await admin.messaging().send(payload);
					console.log(
						"Sent tomorrow's single event notification:",
						payload.notification,
					);
				} else if (tomorrowOtherEvents.length > 1) {
					let combinedImage = "";

					tomorrowOtherEvents.sort((a: any, b: any) => {
						if (a.type === "festival" && b.type !== "festival") return -1;
						if (a.type !== "festival" && b.type === "festival") return 1;
						return 0;
					});

					const eventLines = tomorrowOtherEvents.map((e: any) => {
						if (e.imageUrl && !combinedImage) combinedImage = e.imageUrl;
						let iconStr = "🔵";
						if (e.type === "festival") {
							iconStr = "🟢";
						}
						return `${iconStr} ${e.eventName || e.title}`;
					});

					const mainColor = "#A855F7"; // Purple for multiple

					const soundSettings = await getNotificationSoundSettings();
					const TTL_2_DAYS_S = 172800;
					const payload: admin.messaging.Message = {
						android: {
							priority: "high",
							ttl: TTL_2_DAYS_S * 1000,
							notification: {
								title: `🟣 कल ${tomorrowOtherEvents.length} उत्सव हैं`,
								body: eventLines.join("\n"),
								color: mainColor,
								imageUrl: combinedImage || undefined,
								channelId: soundSettings.channelId,
								sound: soundSettings.sound,
							},
						},
						apns: {
							headers: {
								"apns-expiration": String(
									Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
								),
							},
							payload: {
								aps: {
									sound: soundSettings.apnsSound,
									alert: {
										title: `🟣 कल ${tomorrowOtherEvents.length} उत्सव हैं`,
										body: eventLines.join("\n"),
									},
									"mutable-content": 1,
								},
							},
							...(combinedImage
								? { fcm_options: { image: combinedImage } }
								: {}),
						},
						data: {
							title: `🟣 कल ${tomorrowOtherEvents.length} उत्सव हैं`,
							body: eventLines.join("\n"),
							action_type: "screen",
							target_screen: "events",
							image: combinedImage,
						},
						topic: "all",
					};
					await admin.messaging().send(payload);
					console.log(
						"Sent tomorrow's multiple events notification:",
						payload.notification,
					);
				}
			}

			const hasEkadashiToday = todayEvents.some((e: any) => e.isEkadashi);
			const shouldSendToday =
				(hasEkadashiToday && istHour === 4) ||
				(!hasEkadashiToday && istHour === 6);

			// Process Today's Events (Ekadashi at 4 AM, others at 6 AM)
			if (shouldSendToday && todayEvents.length === 1) {
				const ev = todayEvents[0];
				let color = "#3B82F6"; // Blue
				let iconStr = "🔵";
				if (ev.isEkadashi) {
					color = "#EF4444";
					iconStr = "🔴";
				} else if (ev.type === "festival") {
					color = "#16A34A";
					iconStr = "🟢";
				}

				const titleStr = ev.eventName || ev.title || "आज का उत्सव";
				let bodyStr = ev.description
					? ev.description.substring(0, 100)
					: ev.isEkadashi
						? "आज एकादशी व्रत है"
						: "आज का उत्सव";
				if (ev.isEkadashi && ev.breakTime) {
					let cleanBreakTime = ev.breakTime.replace(/^पारण\s*[-:]?\s*/, "");
					cleanBreakTime = cleanBreakTime.replace(
						/^(?:अगले दिन|कल)\s*[,:-]?\s*/i,
						"",
					);
					bodyStr = `आज एकादशी व्रत है। पारण कल: ${cleanBreakTime}`;
				}

				const eventImage = ev.imageUrl || ""; // Use event's image if available

				const soundSettings = await getNotificationSoundSettings();
				const TTL_2_DAYS_S = 172800;
				const payload: admin.messaging.Message = {
					android: {
						priority: "high",
						ttl: TTL_2_DAYS_S * 1000,
						notification: {
							title: `${iconStr} आज: ${titleStr}`,
							body: bodyStr,
							color: color,
							imageUrl: eventImage || undefined,
							channelId: soundSettings.channelId,
							sound: soundSettings.sound,
						},
					},
					apns: {
						headers: {
							"apns-expiration": String(
								Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
							),
						},
						payload: {
							aps: {
								sound: soundSettings.apnsSound,
								alert: {
									title: `${iconStr} आज: ${titleStr}`,
									body: bodyStr,
								},
								"mutable-content": 1,
							},
						},
						...(eventImage ? { fcm_options: { image: eventImage } } : {}),
					},
					data: {
						title: `${iconStr} आज: ${titleStr}`,
						body: bodyStr,
						action_type: "screen",
						target_screen: "events",
						image: eventImage,
					},
					topic: "all",
				};
				await admin.messaging().send(payload);
				console.log(
					"Sent today's single event notification:",
					payload.notification,
				);
			} else if (shouldSendToday && todayEvents.length > 1) {
				let hasEkadashi = false;
				let combinedImage = "";

				// Sort events so Festivals are ALWAYS first, then Ekadashi, then Others
				todayEvents.sort((a: any, b: any) => {
					if (a.type === "festival" && b.type !== "festival") return -1;
					if (a.type !== "festival" && b.type === "festival") return 1;
					if (a.isEkadashi) return -1;
					if (b.isEkadashi) return 1;
					return 0;
				});

				const eventLines = todayEvents.map((e: any) => {
					if (e.imageUrl && !combinedImage) combinedImage = e.imageUrl;
					let iconStr = "🔵";
					let extra = "";
					if (e.isEkadashi) {
						iconStr = "🔴";
						hasEkadashi = true;
						if (e.breakTime) {
							let cleanBreakTime = e.breakTime.replace(/^पारण\s*[-:]?\s*/, "");
							cleanBreakTime = cleanBreakTime.replace(
								/^(?:अगले दिन|कल)\s*[,:-]?\s*/i,
								"",
							);
							extra = ` (पारण कल: ${cleanBreakTime})`;
						}
					} else if (e.type === "festival") {
						iconStr = "🟢";
					}
					return `${iconStr} ${e.eventName || e.title}${extra}`;
				});

				let mainColor = "#A855F7"; // Purple for multiple
				if (hasEkadashi) mainColor = "#EF4444"; // Prioritize red if any ekadashi

				const soundSettings = await getNotificationSoundSettings();
				const TTL_2_DAYS_S = 172800;
				const payload: admin.messaging.Message = {
					android: {
						priority: "high",
						ttl: TTL_2_DAYS_S * 1000,
						notification: {
							title: `🟣 आज ${todayEvents.length} उत्सव हैं`,
							body: eventLines.join("\n"),
							color: mainColor,
							imageUrl: combinedImage || undefined,
							channelId: soundSettings.channelId,
							sound: soundSettings.sound,
						},
					},
					apns: {
						headers: {
							"apns-expiration": String(
								Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
							),
						},
						payload: {
							aps: {
								sound: soundSettings.apnsSound,
								alert: {
									title: `🟣 आज ${todayEvents.length} उत्सव हैं`,
									body: eventLines.join("\n"),
								},
								"mutable-content": 1,
							},
						},
						...(combinedImage ? { fcm_options: { image: combinedImage } } : {}),
					},
					data: {
						title: `🟣 आज ${todayEvents.length} उत्सव हैं`,
						body: eventLines.join("\n"),
						action_type: "screen",
						target_screen: "events",
						image: combinedImage,
					},
					topic: "all",
				};
				await admin.messaging().send(payload);
				console.log(
					"Sent today's multiple events notification:",
					payload.notification,
				);
			}
		} catch (error) {
			console.error("Error sending daily event push notification:", error);
		}
	},
);

// ─── Cloud Function: Process Scheduled Notifications ──────────────────────────────────
// Runs every minute. Max possible delay = 59 seconds.
// 43,200 invocations/month — well within Firebase's 2M free limit.
// Simple, reliable, no extra Google Cloud setup needed.

export const processScheduledNotifications = onSchedule(
	{
		schedule: "*/10 * * * *", // Every 10 minutes
		timeZone: "Asia/Kolkata",
		timeoutSeconds: 60,
		memory: "256MiB",
	},
	async (_event) => {
		const db = admin.firestore();
		const now = Date.now();

		try {
			const snapshot = await db
				.collection("scheduled_notifications")
				.where("sent", "==", false)
				.where("scheduledAt", "<=", now)
				.get();

			if (snapshot.empty) return; // Nothing due — exits in milliseconds

			for (const docSnap of snapshot.docs) {
				const data = docSnap.data();
				const finalImageUrl = data.imageUrl || "";

				// ── Detect mandal notification ───────────────────────────────────────────────
				const isMandal =
					data.actionType === "mandal_darshan" ||
					data.actionType === "mandal_activity";

				// ── Read mandalUploadsSilent fresh at send time (Q4 requirement) ────────
				let isSilent = true; // default: silent
				if (isMandal) {
					try {
						const settingsDoc = await db
							.collection("app_config")
							.doc("notification_settings")
							.get();
						if (settingsDoc.exists) {
							const s = settingsDoc.data();
							if (s && typeof s.mandalUploadsSilent === "boolean") {
								isSilent = s.mandalUploadsSilent;
							}
						}
					} catch (e) {
						console.error(
							"[processScheduledNotifications] Error reading mandalUploadsSilent:",
							e,
						);
					}
				}

				const soundSettings = await getNotificationSoundSettings();
				const TTL_2_DAYS_S = 172800;

				const payload: admin.messaging.Message = {
					topic: "all",
					data: {
						title: data.title,
						body: data.body || "",
						action_type: data.actionType || "none",
						// Mandal deep-link fields
						...(isMandal
							? {
									target_mandal: data.mandalId || "",
									target_date: data.uploadDate || "",
									silent: isSilent ? "true" : "false",
								}
							: {}),
						// Generic scheduled notification fields
						...(data.actionType === "screen"
							? { target_screen: data.targetScreen }
							: {}),
						...(data.actionType === "link"
							? { target_link: data.targetLink }
							: {}),
						...(finalImageUrl
							? { image: finalImageUrl, imageUrl: finalImageUrl }
							: {}),
					},
					android: {
						priority: isSilent && isMandal ? "normal" : "high",
						ttl: TTL_2_DAYS_S * 1000,
						notification: {
							title: data.title,
							body: data.body || "",
							channelId:
								isSilent && isMandal
									? "silent_alerts_v4"
									: soundSettings.channelId,
							...(isSilent && isMandal
								? {
										defaultSound: false,
										defaultVibrateTimings: false,
										vibrateTimingsMillis: [0],
									}
								: { sound: soundSettings.sound }),
							...(finalImageUrl ? { imageUrl: finalImageUrl } : {}),
							visibility: "public",
						},
					},
					apns: {
						headers: {
							"apns-priority": isSilent && isMandal ? "5" : "10",
							"apns-expiration": String(
								Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
							),
						},
						payload: {
							aps: {
								alert: { title: data.title, body: data.body || "" },
								"mutable-content": 1,
								...(isSilent && isMandal
									? { "content-available": 1 }
									: { sound: soundSettings.apnsSound }),
							},
						},
						...(finalImageUrl ? { fcm_options: { image: finalImageUrl } } : {}),
					},
				};

				try {
					await admin.messaging().send(payload);
					console.log(`✅ Sent: "${data.title}" (doc: ${docSnap.id})`);

					// Update immediately to prevent duplicate sends on timeout
					await docSnap.ref.update({ sent: true, sentAt: Date.now() });

					// ── After mandal send: update lastNotificationSent in the mandal doc ─────
					if (isMandal && data.mandalId) {
						try {
							const sentIstDate = new Date(Date.now() + 5.5 * 3600_000)
								.toISOString()
								.split("T")[0];
							const notifType =
								data.actionType === "mandal_darshan" ? "darshan" : "activity";
							await db
								.collection("mandals")
								.doc(data.mandalId)
								.set(
									{ lastNotificationSent: { [notifType]: sentIstDate } },
									{ merge: true },
								);
							console.log(
								`✅ Updated lastNotificationSent.${notifType} = ${sentIstDate} for mandal ${data.mandalId}`,
							);
						} catch (guardErr) {
							console.error(
								`⚠️ Failed to update lastNotificationSent for mandal ${data.mandalId}:`,
								guardErr,
							);
						}
					}
				} catch (err: any) {
					console.error(
						`❌ Failed to send scheduled notification (${docSnap.id}):`,
						err,
					);
					await docSnap.ref.update({
						error: err.message || "Unknown error",
						failedAt: Date.now(),
					});
				}
			}
		} catch (error) {
			console.error("Error processing scheduled notifications:", error);
		}
	},
);

// ─── Cloud Function: Subscribe Web Push Token to Topic ───────────────────────
// Web clients cannot subscribe to FCM topics client-side — must go through
// Admin SDK. This callable bridges that gap for Web Push users.

export const subscribeToTopic = onCall(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (request: any) => {
		// subscribeToTopic is intentionally allowed for unauthenticated users:
		// web push token subscription must happen before any login (anonymous users need push too).
		// The token itself is validated by FCM; no admin-level data is exposed.
		const { token, topic } = request.data;
		if (!token || !topic) {
			throw new HttpsError("invalid-argument", "Missing token or topic.");
		}
		try {
			await admin.messaging().subscribeToTopic(token, topic);
			console.log(`Subscribed token ...${token.slice(-10)} to topic: ${topic}`);
			return { success: true };
		} catch (error: any) {
			console.error("subscribeToTopic error:", error.message);
			throw new HttpsError("internal", error.message);
		}
	},
);

// ─── Cloud Function: Send Info Screen Silent Notification ────────────────────
// Called by InfoScreenManager when admin saves info. Sends a silent notification.
// Frontend skips calling this on localhost/127.0.0.1.

export const sendInfoScreenNotification = onCall(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (request: any) => {
		if (!request.auth) {
			throw new HttpsError("unauthenticated", "Must be signed in.");
		}

		const { title, body, target_info_id } = request.data;
		if (!title) {
			throw new HttpsError("invalid-argument", "Missing title.");
		}

		try {
			const soundSettings = await getNotificationSoundSettings();
			const TTL_2_DAYS_S = 172800;
			const payload: admin.messaging.Message = {
				topic: "all",
				data: {
					title: title || "नई सूचना",
					body: body || "",
					action_type: "screen",
					target_screen: "information",
					...(target_info_id ? { target_info_id } : {}),
				},
				android: {
					priority: "high",
					ttl: TTL_2_DAYS_S * 1000,
					notification: {
						title: title || "नई सूचना",
						body: body || "",
						channelId: soundSettings.channelId,
						sound: soundSettings.sound,
						visibility: "public",
					},
				},
				apns: {
					headers: {
						"apns-priority": "10",
						"apns-expiration": String(
							Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
						),
					},
					payload: {
						aps: {
							alert: { title: title || "नई सूचना", body: body || "" },
							sound: soundSettings.apnsSound,
						},
					},
				},
			};

			await admin.messaging().send(payload);
			console.log(`✅ Info screen notification sent: "${title}"`);
			return { success: true };
		} catch (error: any) {
			console.error("sendInfoScreenNotification error:", error.message);
			throw new HttpsError("internal", error.message);
		}
	},
);

// ─── Existing Functions ───────────────────────────────────────────────────────

export const uploadToGithub = onCall(
	{ timeoutSeconds: 540, memory: "1GiB" },
	async (request: any) => {
		// ── Auth guard: reject all unauthenticated callers immediately ──
		if (!request.auth) {
			throw new HttpsError(
				"unauthenticated",
				"You must be signed in to upload files.",
			);
		}
		// We now accept 'token' directly from the app
		const { file, fileName, releaseId, token } = request.data;

		if (!file || !fileName || !releaseId || !token) {
			throw new HttpsError(
				"invalid-argument",
				"Missing required fields: file, fileName, releaseId, or token",
			);
		}

		try {
			// Decode base64 file
			const fileBuffer = Buffer.from(file, "base64");

			// Determine Target Repo based on file type
			const isAudio =
				fileName.toLowerCase().endsWith(".m4a") ||
				fileName.toLowerCase().endsWith(".mp3") ||
				fileName.toLowerCase().endsWith(".mp4");
			const targetRepo = isAudio ? "CPBS-APP-ORIGNAL-PHASE-1" : "CPBS-DAILY";

			// Upload to GitHub releases
			const uploadUrl = `https://uploads.github.com/repos/${REPO_OWNER}/${targetRepo}/releases/${releaseId}/assets?name=${encodeURIComponent(
				fileName,
			)}`;

			const response = await axios.post(uploadUrl, fileBuffer, {
				headers: {
					Authorization: `token ${token}`,
					Accept: "application/vnd.github.v3+json",
					"Content-Type": isAudio ? "audio/mp4" : "application/octet-stream",
				},
				maxContentLength: Infinity,
				maxBodyLength: Infinity,
			});

			return {
				success: true,
				asset: response.data,
				message: `Successfully uploaded ${fileName}`,
			};
		} catch (error: any) {
			console.error("Upload error:", error.response?.data || error.message);
			throw new HttpsError(
				"internal",
				error.response?.data?.message || error.message,
			);
		}
	},
);

// ─── [MIGRATED] saveAppConfig ─────────────────────────────────────────────────
// Now handled client-side via Firebase Storage SDK.
// OTA UPDATE SYSTEM (Self-Hosted, Capgo-compatible)
// Endpoints:
//   GET  /otaCheckUpdate   — App calls this on startup to check for new bundle
//   POST /otaStats         — App reports install stats (no-op, keeps plugin happy)
//   POST /otaChannel       — App reports channel info (no-op, keeps plugin happy)
// Firestore doc: ota_config/latest
//   { version: "1.0.0", url: "https://storage.googleapis.com/...", message: "..." }
// ─────────────────────────────────────────────────────────────────────────────

export const otaCheckUpdate = onRequest(
	{ cors: true, region: "asia-south1" },
	async (_req, res) => {
		try {
			const db = admin.firestore();
			const doc = await db.collection("ota_config").doc("latest").get();

			if (!doc.exists) {
				// No update available
				res.json({ version: "0.0.0", url: "", message: "No update" });
				return;
			}

			const data = doc.data()!;
			res.json({
				version: data.version || "0.0.0",
				url: data.url || "",
				message: data.message || "",
				checksum: data.checksum || "",
			});
		} catch (err: any) {
			console.error("[OTA] Check update failed:", err);
			res.status(500).json({ error: "Internal error" });
		}
	},
);

// Stats endpoint — @capgo/capacitor-updater calls this, we just acknowledge it
export const otaStats = onRequest(
	{ cors: true, region: "asia-south1" },
	async (_req, res) => {
		res.status(200).json({ status: "ok" });
	},
);

// Channel endpoint — @capgo/capacitor-updater calls this, we just acknowledge it
export const otaChannel = onRequest(
	{ cors: true, region: "asia-south1" },
	async (_req, res) => {
		res.status(200).json({ status: "ok" });
	},
);

// ─── Cloud Function: Facebook Live Webhook ──────────────────────────────────
export const facebookWebhook = onRequest(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (req, res) => {
		const VERIFY_TOKEN = "cbps_live_webhook_secret";

		// 1. GET Request: Used by Meta to verify the webhook
		if (req.method === "GET") {
			const mode = req.query["hub.mode"];
			const token = req.query["hub.verify_token"];
			const challenge = req.query["hub.challenge"];

			if (mode && token) {
				if (mode === "subscribe" && token === VERIFY_TOKEN) {
					console.log("FACEBOOK WEBHOOK VERIFIED");
					res.status(200).send(challenge);
				} else {
					res.sendStatus(403);
				}
			} else {
				res.sendStatus(400);
			}
			return;
		}

		// 2. POST Request: Used by Meta to send live video events
		if (req.method === "POST") {
			const body = req.body;
			console.log(
				"Received Facebook Webhook POST payload:",
				JSON.stringify(body, null, 2),
			);

			if (body.object === "page") {
				for (const entry of body.entry) {
					const changes = entry.changes;
					if (!changes) continue;

					for (const change of changes) {
						if (change.field === "live_videos") {
							const liveVideoData = change.value;
							const videoId = liveVideoData.id;
							const status = liveVideoData.status;

							// ── LIVE STARTED ────────────────────────────────────────────
							if (status === "live") {
								// Fix: /video/ID opens the video correctly; plain /ID does not
								const liveLink = `https://www.facebook.com/video/${videoId}`;

								let mainBody =
									"लाइव देखने के लिए अभी क्लिक करें | Tap to watch the live stream";
								const mainTitle = "🟦 LIVE on Facebook! हम फेसबुक पर लाइव हैं!";

								// Attempt to fetch video title/description from Graph API
								// Set FB_PAGE_ACCESS_TOKEN secret for best results:
								//   firebase functions:secrets:set FB_PAGE_ACCESS_TOKEN
								try {
									const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
									const APP_ID = "925033180606940";
									const APP_SECRET = "a8fbdb69437a1a67af4fd7c8ff46ce8f";
									const APP_TOKEN = `${APP_ID}|${APP_SECRET}`;
									const TOKEN_TO_USE = PAGE_TOKEN || APP_TOKEN;

									const fbRes = await axios.get(
										`https://graph.facebook.com/v21.0/${videoId}?fields=title,description,permalink_url&access_token=${TOKEN_TO_USE}`,
									);
									const vTitle = fbRes.data.title || "";
									const vDesc = fbRes.data.description || "";

									if (vTitle || vDesc) {
										mainBody = vTitle;
										if (vDesc) mainBody += (vTitle ? " - " : "") + vDesc;
										if (mainBody.length > 150)
											mainBody = `${mainBody.substring(0, 147)}...`;
									}
								} catch (err: any) {
									console.error(
										"Failed to fetch FB video details:",
										err?.response?.data || err.message,
									);
								}

								// Auto-update Firestore so Home screen Live badge appears automatically
								try {
									await admin
										.firestore()
										.collection("settings")
										.doc("socialMedia")
										.set(
											{
												isFacebookLive: true,
												facebookLiveLink: liveLink,
											},
											{ merge: true },
										);
									console.log(
										`Firestore updated: isFacebookLive=true, link=${liveLink}`,
									);
								} catch (err) {
									console.error(
										"Failed to update Firestore FB live status:",
										err,
									);
								}

								const payload: admin.messaging.Message = {
									topic: "all",
									data: {
										title: mainTitle,
										body: mainBody,
										action_type: "link",
										target_link: liveLink,
									},
									android: {
										priority: "high",
										notification: {
											title: mainTitle,
											body: mainBody,
											color: "#1877F2", // Facebook Blue
											channelId: "push_notifications_v6",
											sound: "notisound3",
										},
									},
									apns: {
										payload: {
											aps: {
												alert: {
													title: mainTitle,
													body: mainBody,
												},
												sound: "notisound3.m4a",
											},
										},
									},
								};

								try {
									await admin.messaging().send(payload);
									console.log(
										`Live notification sent for FB Video ID: ${videoId}`,
									);
								} catch (error) {
									console.error("Error sending FB Live push:", error);
								}
							}

							// ── LIVE ENDED — clear Firestore live badge automatically ──
							if (status === "live_stopped" || status === "VOD") {
								try {
									await admin
										.firestore()
										.collection("settings")
										.doc("socialMedia")
										.set(
											{
												isFacebookLive: false,
												facebookLiveLink: "",
											},
											{ merge: true },
										);
									console.log(
										`Firestore updated: isFacebookLive=false (status=${status})`,
									);
								} catch (err) {
									console.error(
										"Failed to clear Firestore FB live status:",
										err,
									);
								}
							}
						}
					}
				}
				res.status(200).send("EVENT_RECEIVED");
			} else {
				res.sendStatus(404);
			}
			return;
		}

		res.sendStatus(405); // Method Not Allowed
	},
);

// ─── Cloud Function: YouTube PubSubHubbub Webhook ───────────────────────────
export const youtubeWebhook = onRequest(
	{ cors: true, timeoutSeconds: 60, memory: "256MiB" },
	async (req, res) => {
		// 1. Verification request from Google PubSubHubbub
		if (req.method === "GET") {
			const challenge = req.query["hub.challenge"];
			if (challenge) {
				console.log("YOUTUBE WEBHOOK VERIFIED");
				res.status(200).send(challenge);
				return;
			}
			res.sendStatus(400);
			return;
		}

		// 2. Notification from YouTube (Atom XML feed)
		if (req.method === "POST") {
			try {
				const xml = req.body.toString("utf8");

				// Basic regex to extract video ID and title
				const videoIdMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
				const titleMatch = xml.match(/<entry>[\s\S]*?<title>(.*?)<\/title>/);

				if (!videoIdMatch) {
					// Not a video entry (e.g. deleted video or ping)
					res.status(200).send("No videoId found");
					return;
				}

				const videoId = videoIdMatch[1];
				const fallbackTitle = titleMatch
					? titleMatch[1]
					: "नया वीडियो अपलोड हुआ है!";

				// Deduplication check via Firestore
				const db = admin.firestore();
				const docRef = db.collection("youtube_notifications").doc(videoId);

				await db.runTransaction(async (t) => {
					const docSnap = await t.get(docRef);
					const settingsSnap = await t.get(
						db.collection("app_config").doc("notification_settings"),
					);

					if (docSnap.exists) {
						const data = docSnap.data();
						// If already notified as live or none, ignore.
						if (data?.status === "live" || data?.status === "none") {
							throw new Error("ALREADY_NOTIFIED");
						}
					}

					// Fetch details from YouTube Data API
					const YT_API_KEY = process.env.YOUTUBE_API_KEY;
					let broadcastContent = "none";
					let mainBody = fallbackTitle;

					if (YT_API_KEY) {
						try {
							const ytRes = await axios.get(
								`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`,
							);
							const items = ytRes.data.items;
							if (items && items.length > 0) {
								const snippet = items[0].snippet;
								broadcastContent = snippet.liveBroadcastContent || "none";
								mainBody = snippet.title || fallbackTitle;
							}
						} catch (apiErr: any) {
							console.error(
								"YouTube API error:",
								apiErr.response?.data || apiErr.message,
							);
						}
					}

					// If it's just an upcoming schedule, save state and don't notify yet
					if (broadcastContent === "upcoming") {
						t.set(
							docRef,
							{
								status: "upcoming",
								updatedAt: admin.firestore.FieldValue.serverTimestamp(),
							},
							{ merge: true },
						);
						throw new Error("UPCOMING_IGNORED");
					}

					let mainTitle = "🎥 New Video on YouTube! नया वीडियो अपलोड हुआ है!";
					if (broadcastContent === "live") {
						mainTitle = "🔴 LIVE on YouTube! हम यूट्यूब पर लाइव हैं!";
					}

					const targetLink = `https://www.youtube.com/watch?v=${videoId}`;

					// Prepare notification
					const payload: admin.messaging.Message = {
						topic: "all",
						data: {
							title: mainTitle,
							body: mainBody,
							action_type: "link",
							target_link: targetLink,
						},
						android: {
							priority: "high",
							notification: {
								title: mainTitle,
								body: mainBody,
								color: "#FF0000", // YouTube Red
								channelId: "push_notifications_v6",
								sound: "notisound3",
							},
						},
						apns: {
							payload: {
								aps: {
									alert: {
										title: mainTitle,
										body: mainBody,
									},
									sound: "notisound3.m4a",
								},
							},
						},
					};

					// Send FCM (Check if enabled first)
					const settingsData = settingsSnap.data();

					if (settingsData?.youtubeUploadsEnabled !== false) {
						await admin.messaging().send(payload);
						console.log(
							`YouTube notification sent for Video ID: ${videoId} (${broadcastContent})`,
						);
					} else {
						console.log(
							`YouTube notification skipped (disabled in settings) for Video ID: ${videoId}`,
						);
					}

					// Mark as notified
					t.set(
						docRef,
						{
							status: broadcastContent,
							notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
						},
						{ merge: true },
					);
				});

				res.status(200).send("PROCESSED");
			} catch (err: any) {
				if (
					err.message === "ALREADY_NOTIFIED" ||
					err.message === "UPCOMING_IGNORED"
				) {
					res.status(200).send(err.message);
				} else {
					console.error("YouTube Webhook Processing Error:", err);
					res.status(500).send("INTERNAL_ERROR");
				}
			}
			return;
		}

		res.sendStatus(405); // Method Not Allowed
	},
);

// ─── Cloud Function: Auto-Renew YouTube Webhook ─────────────────────────────
// Runs every 4 days to renew the PubSubHubbub subscription.
export const renewYouTubeWebhook = functionsV1.pubsub
	.schedule("0 0 */4 * *")
	.onRun(async (_context) => {
		const hubUrl = "https://pubsubhubbub.appspot.com/subscribe";
		const topic =
			"https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC3i5l3jbvNcnvd72DP1oPsA";
		const callbackUrl =
			"https://us-central1-cpbs-admin.cloudfunctions.net/youtubeWebhook";

		const data = `hub.mode=subscribe&hub.topic=${encodeURIComponent(topic)}&hub.callback=${encodeURIComponent(callbackUrl)}&hub.verify=async`;

		try {
			await axios.post(hubUrl, data, {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			});
			console.log("Successfully renewed YouTube webhook subscription");
		} catch (error: any) {
			console.error(
				"Error renewing YouTube webhook:",
				error.response?.data || error.message,
			);
		}
	});

// ─── Cloud Functions: Family Link Management ───────────────────────────────

export const searchDevoteesForFamilyLink = onCall(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (request: any) => {
		const { realName, dikshaName, dikshaDate, guruName } = request.data || {};
		const callerUid = request.auth?.uid;
		if (!callerUid)
			throw new HttpsError("unauthenticated", "User must be logged in.");

		if (!realName || !dikshaDate || !guruName) {
			throw new HttpsError("invalid-argument", "Missing search parameters.");
		}

		const db = admin.firestore();

		// Diksha date and guru must match, which keeps the list short. The date
		// is matched in every usual spelling ("05/03/2010", "2010-03-05" …) —
		// one `in` query on the default single-field index.
		const dates = dikshaDateVariants(dikshaDate);
		if (dates.length === 0) return { results: [] };
		const usersSnapshot = await db
			.collection("users")
			.where("dikshaDate", "in", dates)
			.get();

		const callerSnap = await db.collection("users").doc(callerUid).get();
		const callerLinks = new Set(
			asStringList(callerSnap.data()?.linkedFamilyMembers),
		);

		// Names are typed by hand on both sides: Hindi or English, Hinglish
		// spellings, typos, titles (functions/src/familySearch.ts).
		const guru = String(guruName).trim();
		const scored: { score: number; result: any }[] = [];
		usersSnapshot.forEach((doc) => {
			if (doc.id === callerUid) return; // exclude self
			const data = doc.data();
			if (!isActiveFamilyProfile(data)) return;
			if (String(data.guruName || "").trim() !== guru) return;
			const score = Math.max(
				...[realName, dikshaName].flatMap((mine) => [
					nameMatchScore(mine, data.realName),
					nameMatchScore(mine, data.dikshaName),
				]),
			);
			if (score === 0) return;
			// Only what the result card needs — never the phone number or email:
			// the other devotee has not agreed to link yet.
			scored.push({
				score,
				result: {
					id: doc.id,
					realName: data.realName,
					dikshaName: data.dikshaName || "",
					guruName: data.guruName,
					dikshaDate: data.dikshaDate,
					photoURL: data.photoURL || "",
					alreadyLinked: callerLinks.has(doc.id),
				},
			});
		});

		scored.sort((a, b) => b.score - a.score);
		return { results: scored.slice(0, 10).map((r) => r.result) };
	},
);

// Longest relation label we store ("father", or custom text the devotee typed).
const FAMILY_RELATION_MAX_LENGTH = 30;
// Safety cap for automatic family-group merging. Real families are far smaller;
// this only stops a runaway merge from touching hundreds of documents.
const FAMILY_GROUP_MAX_SIZE = 60;

const asStringList = (value: unknown): string[] =>
	Array.isArray(value)
		? value.filter((v): v is string => typeof v === "string" && v.length > 0)
		: [];

const cleanRelation = (value: unknown): string =>
	typeof value === "string"
		? value
				.replace(/[\u0000-\u001f\u007f]/g, "")
				.trim()
				.slice(0, FAMILY_RELATION_MAX_LENGTH)
		: "";

/** A profile that can take part in family links: exists, not deleted/merged. */
const isActiveFamilyProfile = (
	data: admin.firestore.DocumentData | undefined,
): data is admin.firestore.DocumentData =>
	!!data && data.isDeleted !== true && !data.mergedIntoUid;

/**
 * Field/value pairs that link `otherUid` onto a profile, for
 * `update(ref, field, value, ...more)`. FieldPaths rather than dotted strings
 * so a uid can never be misread as a nested path.
 */
const familyLinkFields = (otherUid: string, relation: string): unknown[] => {
	return [
		new FieldPath("linkedFamilyMembers"),
		FieldValue.arrayUnion(otherUid),
		// A direct link replaces any "linked through someone" marker.
		new FieldPath("linkedFamilyVia", otherUid),
		FieldValue.delete(),
		// A relation given here is the devotee's own choice, not a filled-in one.
		new FieldPath("linkedFamilyRelationsAuto", otherUid),
		FieldValue.delete(),
		...(relation
			? [new FieldPath("linkedFamilyRelations", otherUid), relation]
			: []),
	];
};

const familyUnlinkFields = (otherUid: string): unknown[] => {
	return [
		new FieldPath("linkedFamilyMembers"),
		FieldValue.arrayRemove(otherUid),
		new FieldPath("linkedFamilyRelations", otherUid),
		FieldValue.delete(),
		new FieldPath("linkedFamilyRelationsAuto", otherUid),
		FieldValue.delete(),
		new FieldPath("linkedFamilyVia", otherUid),
		FieldValue.delete(),
	];
};

/** Applies `update(ref, field, value, ...)` pairs built by the helpers above. */
const applyFieldUpdates = (
	writer: admin.firestore.Transaction | admin.firestore.WriteBatch,
	ref: admin.firestore.DocumentReference,
	fields: unknown[],
) => {
	const [field, value, ...rest] = fields;
	writer.update(ref, field as FieldPath, value, ...rest);
};

/**
 * Best-effort push to one devotee's devices. Never throws — a missing or stale
 * token must not fail the link operation that triggered it.
 */
async function pushToProfile(
	profile: admin.firestore.DocumentData | undefined,
	title: string,
	body: string,
) {
	const tokens = asStringList(profile?.fcmTokens);
	if (tokens.length === 0) return;
	try {
		const soundSettings = await getNotificationSoundSettings();
		const result = await admin.messaging().sendEachForMulticast({
			tokens,
			data: {
				title,
				body,
				action_type: "screen",
				target_screen: "profile",
			},
			android: {
				priority: "high",
				notification: {
					title,
					body,
					channelId: soundSettings.channelId,
					sound: soundSettings.sound,
				},
			},
			apns: {
				headers: { "apns-priority": "10" },
				payload: {
					aps: { alert: { title, body }, sound: soundSettings.apnsSound },
				},
			},
		});
		console.log(
			`Family link push: sent=${result.successCount}, failed=${result.failureCount}`,
		);
	} catch (e: any) {
		console.warn("Family link push failed:", e?.message || e);
	}
}

/**
 * Profiles that sign in with this email. The login record is asked first
 * (a Google account's email, also when the profile field is empty or was
 * saved in other letter case); the profile's own `email` field covers the
 * rest. A merged account leads to the profile it was merged into.
 */
async function findProfilesByEmail(
	db: admin.firestore.Firestore,
	email: string,
): Promise<admin.firestore.DocumentSnapshot[]> {
	const uids = new Set<string>();
	try {
		uids.add((await admin.auth().getUserByEmail(email)).uid);
	} catch (e: any) {
		// Not a login email — or the login lookup failed; the profile field
		// below still gets a say.
		if (e?.code !== "auth/user-not-found")
			console.warn("[family] email login lookup failed:", e?.code || e);
	}
	const byField = await db
		.collection("users")
		.where("email", "==", email)
		.limit(5)
		.get();
	for (const d of byField.docs) uids.add(d.id);
	return activeProfilesFor(db, uids);
}

/**
 * Profiles reachable on this phone number: the account that LOGS IN with it
 * (Firebase Auth — also when the profile's phone field is empty or holds
 * another number) first, then every profile whose phone field holds it
 * (a Google login that typed its number into the profile). A merged account
 * leads to the profile it was merged into.
 */
async function findProfilesByPhone(
	db: admin.firestore.Firestore,
	last10: string,
): Promise<admin.firestore.DocumentSnapshot[]> {
	const uids = new Set<string>();
	try {
		uids.add((await admin.auth().getUserByPhoneNumber(`+91${last10}`)).uid);
	} catch (e: any) {
		if (e?.code !== "auth/user-not-found")
			console.warn("[family] phone login lookup failed:", e?.code || e);
	}
	// Profiles store "+91XXXXXXXXXX", but ones edited in the admin panel may
	// hold the bare 10 digits or a spaced / dashed spelling.
	const a = last10.slice(0, 5);
	const b = last10.slice(5);
	const spellings = [
		`+91${last10}`,
		last10,
		`91${last10}`,
		`0${last10}`,
		`+91 ${last10}`,
		`+91-${last10}`,
		`+91 ${a} ${b}`,
		`${a} ${b}`,
		`+91${a} ${b}`,
	];
	const byField = await db
		.collection("users")
		.where("phoneNumber", "in", spellings)
		.limit(10)
		.get();
	for (const d of byField.docs) uids.add(d.id);
	return activeProfilesFor(db, uids);
}

/** Live profiles for these account ids, in order; merged ones followed. */
async function activeProfilesFor(
	db: admin.firestore.Firestore,
	uids: Iterable<string>,
): Promise<admin.firestore.DocumentSnapshot[]> {
	const found = new Map<string, admin.firestore.DocumentSnapshot>();
	for (const uid of uids) {
		let snap = await db.collection("users").doc(uid).get();
		const mergedInto = snap.data()?.mergedIntoUid;
		if (
			typeof mergedInto === "string" &&
			mergedInto &&
			!mergedInto.includes("/")
		)
			snap = await db.collection("users").doc(mergedInto).get();
		if (isActiveFamilyProfile(snap.data())) found.set(snap.id, snap);
	}
	return Array.from(found.values());
}

export const sendFamilyLinkRequest = onCall(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (request: any) => {
		// The other devotee is named by phone number, by email (their Google
		// account), or — from "find on the app" (searchDevoteesForFamilyLink) —
		// by account id.
		const { phoneNumber, targetUserId: requestedUid } = request.data || {};
		const email = cleanEmail(request.data?.email);
		const relation = cleanRelation(request.data?.relation);
		const callerUid = request.auth?.uid;
		if (!callerUid)
			throw new HttpsError("unauthenticated", "User must be logged in.");
		const byUid = typeof requestedUid === "string" && requestedUid.length > 0;
		const byEmail = !byUid && typeof request.data?.email === "string";
		if (byEmail && !email)
			throw new HttpsError("invalid-argument", "Invalid email.");
		if (
			!byUid &&
			!byEmail &&
			(!phoneNumber || typeof phoneNumber !== "string")
		)
			throw new HttpsError("invalid-argument", "Missing phoneNumber.");

		const db = admin.firestore();

		// Get caller data to attach to request
		const callerDoc = await db.collection("users").doc(callerUid).get();
		if (!callerDoc.exists)
			throw new HttpsError("not-found", "Caller profile not found.");
		const callerData = callerDoc.data()!;

		let activeDocs: admin.firestore.DocumentSnapshot[];
		if (byUid) {
			if (requestedUid.includes("/"))
				throw new HttpsError("invalid-argument", "Invalid targetUserId.");
			const snap = await db.collection("users").doc(requestedUid).get();
			activeDocs = isActiveFamilyProfile(snap.data()) ? [snap] : [];
			if (activeDocs.length === 0)
				throw new HttpsError("not-found", "No such devotee.");
		} else if (byEmail) {
			activeDocs = await findProfilesByEmail(db, email);
			if (activeDocs.length === 0)
				throw new HttpsError("not-found", "No user found with this email.");
		} else {
			const last10 = phoneNumber.replace(/\D/g, "").slice(-10);
			if (last10.length !== 10)
				throw new HttpsError("invalid-argument", "Invalid phone number.");
			activeDocs = await findProfilesByPhone(db, last10);
			if (activeDocs.length === 0) {
				throw new HttpsError(
					"not-found",
					"No user found with this phone number.",
				);
			}
		}

		const targetDoc = activeDocs.find((d) => d.id !== callerUid);
		if (!targetDoc) {
			throw new HttpsError("invalid-argument", "You cannot link to yourself.");
		}
		const targetUserId = targetDoc.id;
		const targetData = targetDoc.data()!;

		// Check if they are already linked (either side is enough)
		if (
			asStringList(callerData.linkedFamilyMembers).includes(targetUserId) ||
			asStringList(targetData.linkedFamilyMembers).includes(callerUid)
		) {
			throw new HttpsError("already-exists", "Already linked with this user.");
		}

		// Check for duplicate pending request
		const existingReq = await db
			.collection("familyLinkRequests")
			.where("fromUserId", "==", callerUid)
			.where("toUserId", "==", targetUserId)
			.where("status", "==", "pending")
			.get();

		if (!existingReq.empty) {
			throw new HttpsError(
				"already-exists",
				"You already sent a request to this user.",
			);
		}

		// They already asked us — accepting that request is the way forward.
		const reverseReq = await db
			.collection("familyLinkRequests")
			.where("fromUserId", "==", targetUserId)
			.where("toUserId", "==", callerUid)
			.where("status", "==", "pending")
			.get();

		if (!reverseReq.empty) {
			throw new HttpsError(
				"failed-precondition",
				"They already sent you a request.",
			);
		}

		const fromUserName = callerData.realName || callerData.dikshaName || "";

		// Create request document
		await db.collection("familyLinkRequests").add({
			fromUserId: callerUid,
			fromUserName,
			fromUserPhoto: callerData.photoURL || "",
			toUserId: targetUserId,
			toUserName: targetData.realName || targetData.dikshaName || "",
			// How the SENDER is related to the receiver ("father" = "they are my
			// father"). Applied to the sender's side only once accepted.
			fromRelation: relation,
			// Lets the receiver's app suggest their side ("Father" → Son/Daughter).
			fromUserGender:
				callerData.gender === "male" || callerData.gender === "female"
					? callerData.gender
					: "",
			status: "pending",
			createdAt: Date.now(),
		});

		await pushToProfile(
			targetData,
			"परिवार लिंक अनुरोध",
			`${fromUserName || "एक भक्त"} आपको अपने परिवार में जोड़ना चाहते हैं। स्वीकार करने के लिए प्रोफ़ाइल खोलें।`,
		);

		return { success: true };
	},
);

export const respondToFamilyLinkRequest = onCall(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (request: any) => {
		const { requestId, accept } = request.data || {};
		// Optional: how the ACCEPTING devotee is related to the sender.
		const relation = cleanRelation(request.data?.relation);
		const callerUid = request.auth?.uid;
		if (!callerUid)
			throw new HttpsError("unauthenticated", "User must be logged in.");
		if (!requestId)
			throw new HttpsError("invalid-argument", "Missing requestId.");

		const db = admin.firestore();
		const requestRef = db.collection("familyLinkRequests").doc(requestId);

		const outcome = await db.runTransaction(async (transaction) => {
			const doc = await transaction.get(requestRef);
			if (!doc.exists) throw new HttpsError("not-found", "Request not found.");

			const data = doc.data()!;
			if (data.toUserId !== callerUid) {
				throw new HttpsError(
					"permission-denied",
					"You can only respond to requests sent to you.",
				);
			}
			if (data.status !== "pending") {
				throw new HttpsError(
					"failed-precondition",
					"Request is no longer pending.",
				);
			}

			if (!accept) {
				transaction.update(requestRef, {
					status: "rejected",
					updatedAt: FieldValue.serverTimestamp(),
				});
				return { linked: false as const };
			}

			const fromUserRef = db.collection("users").doc(data.fromUserId);
			const toUserRef = db.collection("users").doc(data.toUserId);
			// All reads before any write (Firestore transaction rule).
			const [fromSnap, toSnap] = await transaction.getAll(
				fromUserRef,
				toUserRef,
			);
			const reverseSnap = await transaction.get(
				db
					.collection("familyLinkRequests")
					.where("fromUserId", "==", data.toUserId)
					.where("toUserId", "==", data.fromUserId)
					.where("status", "==", "pending"),
			);

			if (!isActiveFamilyProfile(fromSnap.data())) {
				// The sender's account is gone — close the request instead of linking
				// to a deleted profile.
				transaction.update(requestRef, {
					status: "rejected",
					updatedAt: FieldValue.serverTimestamp(),
				});
				return { linked: false as const, reason: "sender-gone" };
			}
			if (!toSnap.exists)
				throw new HttpsError("not-found", "Your profile was not found.");

			transaction.update(requestRef, {
				status: "accepted",
				updatedAt: FieldValue.serverTimestamp(),
			});
			// If both had asked each other, the other request is answered too.
			for (const reverse of reverseSnap.docs) {
				transaction.update(reverse.ref, {
					status: "accepted",
					updatedAt: FieldValue.serverTimestamp(),
				});
			}

			// Link both users. Each side keeps its own relation label; the
			// syncFamilyLinkGroups trigger then merges their family groups.
			applyFieldUpdates(
				transaction,
				fromUserRef,
				familyLinkFields(data.toUserId, cleanRelation(data.fromRelation)),
			);
			applyFieldUpdates(
				transaction,
				toUserRef,
				familyLinkFields(data.fromUserId, relation),
			);

			return {
				linked: true as const,
				fromData: fromSnap.data(),
				toName: toSnap.data()?.realName || toSnap.data()?.dikshaName || "",
			};
		});

		if (outcome.linked) {
			await pushToProfile(
				outcome.fromData,
				"परिवार लिंक स्वीकृत",
				`${outcome.toName || "आपके परिवार के सदस्य"} ने आपका परिवार लिंक अनुरोध स्वीकार कर लिया है।`,
			);
			return { success: true };
		}
		if ("reason" in outcome) return { success: false, reason: outcome.reason };
		return { success: true };
	},
);

export const unlinkFamilyMember = onCall(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (request: any) => {
		const { targetUserId } = request.data || {};
		const callerUid = request.auth?.uid;
		if (!callerUid)
			throw new HttpsError("unauthenticated", "User must be logged in.");
		if (!targetUserId || typeof targetUserId !== "string")
			throw new HttpsError("invalid-argument", "Missing targetUserId.");

		const db = admin.firestore();

		await db.runTransaction(async (transaction) => {
			const callerRef = db.collection("users").doc(callerUid);
			const targetRef = db.collection("users").doc(targetUserId);

			const [callerDoc, targetDoc] = await transaction.getAll(
				callerRef,
				targetRef,
			);
			if (!callerDoc.exists)
				throw new HttpsError("not-found", "Caller profile not found.");

			// Remove the link, and both sides' relation / "linked through" labels.
			applyFieldUpdates(
				transaction,
				callerRef,
				familyUnlinkFields(targetUserId),
			);
			if (targetDoc.exists) {
				applyFieldUpdates(
					transaction,
					targetRef,
					familyUnlinkFields(callerUid),
				);
			}
		});

		return { success: true };
	},
);

// Same lists as src/constants/admins.ts and isAdmin() in firestore.rules.
const SUPER_ADMIN_EMAILS = [
	"damodar@cpbs.com",
	"namanbgis@gmail.com",
	"shriasati99@gmail.com",
	"harekrishnadas.1001@gmail.com",
	"damodardasshri@gmail.com",
	"haricharcha.talksvlogs@gmail.com",
];
const SUPER_ADMIN_PHONES = [
	"+919887880429",
	"+919977240390",
	"+919826154640",
	"+919829845754",
	"+917049304733",
	"+919610502321",
];

/** A super admin, the same way the Admin Panel decides it (fetchRole). */
async function isSuperAdminCaller(token: any): Promise<boolean> {
	if (!token) return false;
	const email =
		typeof token.email === "string" ? token.email.toLowerCase() : "";
	if (email) {
		const role = await admin
			.firestore()
			.collection("admin_roles")
			.doc(email)
			.get();
		if (role.exists) return role.data()?.role === "super";
		if (SUPER_ADMIN_EMAILS.includes(email)) return true;
	}
	return (
		typeof token.phone_number === "string" &&
		SUPER_ADMIN_PHONES.includes(token.phone_number)
	);
}

/**
 * Admin → Devotee Management: how every account logs in (Google, phone, or
 * both on the same account), with the login phone / email and the last
 * sign-in. Firebase Auth only — no Firestore reads. Super admins only; the
 * app keeps the answer for a few hours, so this runs rarely.
 */
export const adminListLoginMethods = onCall(
	{ cors: true, timeoutSeconds: 120, memory: "512MiB" },
	async (request: any) => {
		if (!request.auth)
			throw new HttpsError("unauthenticated", "Must be signed in.");
		if (!(await isSuperAdminCaller(request.auth.token)))
			throw new HttpsError("permission-denied", "Super admins only.");

		const users: {
			u: string;
			/** g = Google, p = phone, e = email + password, a = Apple. */
			p: string;
			ph?: string;
			em?: string;
			ls?: number;
			cr?: number;
		}[] = [];
		let pageToken: string | undefined;
		do {
			const page = await admin.auth().listUsers(1000, pageToken);
			for (const u of page.users) {
				let p = "";
				for (const info of u.providerData) {
					const id = info.providerId;
					const flag =
						id === "google.com"
							? "g"
							: id === "phone"
								? "p"
								: id === "password"
									? "e"
									: id === "apple.com"
										? "a"
										: "";
					if (flag && !p.includes(flag)) p += flag;
				}
				const ls = Date.parse(u.metadata.lastSignInTime || "");
				const cr = Date.parse(u.metadata.creationTime || "");
				users.push({
					u: u.uid,
					p,
					...(u.phoneNumber ? { ph: u.phoneNumber } : {}),
					...(u.email ? { em: u.email } : {}),
					...(Number.isFinite(ls) ? { ls } : {}),
					...(Number.isFinite(cr) ? { cr } : {}),
				});
			}
			pageToken = page.pageToken;
		} while (pageToken);

		return { users, at: Date.now() };
	},
);

/** "ra•••@gmail.com" — enough for the devotee to recognise, not to copy. */
const maskEmail = (email: string) => {
	const [user, domain] = email.split("@");
	return domain ? `${user.slice(0, 2)}•••@${domain}` : "";
};
/** "•••••43210". */
const maskPhone = (phone: string) => `•••••${phone.replace(/\D/g, "").slice(-5)}`;

const isBlank = (v: unknown) =>
	v === undefined ||
	v === null ||
	(typeof v === "string" && (!v.trim() || v.trim() === "+91"));

/** Same person for two hand-added members (merging member lists). */
const sameMember = (a: any, b: any) => {
	if (!a || !b) return false;
	const da = typeof a.dikshaDate === "string" ? a.dikshaDate.trim() : "";
	const db = typeof b.dikshaDate === "string" ? b.dikshaDate.trim() : "";
	if (da && db && !dikshaDateVariants(da).includes(db)) return false;
	return nameMatchScore(a.realName, b.realName) >= 90;
};

/** Fields a merge copies from the removed profile when the kept one has none. */
const MERGE_FILL_FIELDS = [
	"realName",
	"dikshaName",
	"guruName",
	"dikshaDate",
	"phoneNumber",
	"email",
	"photoURL",
	"gender",
	"personalExperience",
];

/**
 * Moves the second account's logins (Google / phone) onto the kept account,
 * so the devotee can sign in either way and always lands on one profile.
 * All or nothing: when the kept account already has the same kind of login
 * (two Google emails, two phone numbers), nothing moves and the old login
 * stays — the app then tells them which login to use.
 */
async function moveLoginsToKept(
	keepUid: string,
	dropUid: string,
	move: boolean,
): Promise<{
	moved: string[];
	left: string[];
	hint?: { google?: string; phone?: string };
	error?: string;
}> {
	const auth = admin.auth();
	let dropUser: admin.auth.UserRecord;
	try {
		dropUser = await auth.getUser(dropUid);
	} catch (e: any) {
		if (e?.code === "auth/user-not-found") return { moved: [], left: [] };
		throw e;
	}
	let keepUser: admin.auth.UserRecord | undefined;
	try {
		keepUser = await auth.getUser(keepUid);
	} catch {
		keepUser = undefined;
	}
	const hintFor = (u?: admin.auth.UserRecord) => {
		if (!u) return undefined;
		const google = u.providerData.find((p) => p.providerId === "google.com");
		const hint: { google?: string; phone?: string } = {};
		if (google?.email) hint.google = maskEmail(google.email);
		if (u.phoneNumber) hint.phone = maskPhone(u.phoneNumber);
		return hint.google || hint.phone ? hint : undefined;
	};

	const dropGoogle = dropUser.providerData.find(
		(p) => p.providerId === "google.com",
	);
	const dropPhone = dropUser.phoneNumber || "";
	const otherProviders = dropUser.providerData
		.map((p) => p.providerId)
		.filter((id) => id !== "google.com" && id !== "phone");
	const keepHasGoogle = !!keepUser?.providerData.some(
		(p) => p.providerId === "google.com",
	);
	const canGoogle = !!dropGoogle && !!keepUser && !keepHasGoogle;
	const canPhone = !!dropPhone && !!keepUser && !keepUser.phoneNumber;
	const left = [
		...(dropGoogle ? ["google"] : []),
		...(dropPhone ? ["phone"] : []),
		...otherProviders,
	];
	const blocked =
		(!!dropGoogle && !canGoogle) ||
		(!!dropPhone && !canPhone) ||
		otherProviders.length > 0;
	if (!move || blocked || (!canGoogle && !canPhone))
		return { moved: [], left, hint: hintFor(keepUser) };

	// A login can belong to one account only: free it first.
	await auth.deleteUser(dropUid);
	const moved: string[] = [];
	try {
		if (canPhone) {
			await auth.updateUser(keepUid, { phoneNumber: dropPhone });
			moved.push("phone");
		}
		if (canGoogle && dropGoogle) {
			await auth.updateUser(keepUid, {
				providerToLink: {
					providerId: "google.com",
					uid: dropGoogle.uid,
					...(dropGoogle.email ? { email: dropGoogle.email } : {}),
					...(dropGoogle.displayName
						? { displayName: dropGoogle.displayName }
						: {}),
					...(dropGoogle.photoURL ? { photoURL: dropGoogle.photoURL } : {}),
				},
			});
			moved.push("google");
			if (!keepUser?.email && dropGoogle.email) {
				await auth
					.updateUser(keepUid, { email: dropGoogle.email })
					.catch((e) => console.warn("[merge] email not set:", e?.code));
			}
		}
	} catch (e: any) {
		console.error("[merge] moving logins failed", e?.code || e);
		return {
			moved,
			left: left.filter((x) => !moved.includes(x)),
			error: e?.code || "auth-failed",
		};
	}
	return { moved, left: [] };
}

/**
 * Admin → Duplicates: one devotee made two profiles (two emails, two
 * numbers, or one of each). Keeps `keepUid`, and:
 *  - fills the kept profile's empty fields from the other one (never
 *    overwrites), adds hand-added members it doesn't have, keeps approval;
 *  - moves every family link (and the relations / "linked through" marks on
 *    both sides) from the removed account to the kept one;
 *  - points pending link requests at the kept account;
 *  - marks the other profile merged (`mergedIntoUid`, soft-deleted — its data
 *    stays, so nothing is lost) and moves its logins (moveLoginsToKept);
 *  - writes what it changed to admin_merge_log.
 * Super admins only.
 */
export const adminMergeProfiles = onCall(
	{ cors: true, timeoutSeconds: 120, memory: "512MiB" },
	async (request: any) => {
		if (!request.auth)
			throw new HttpsError("unauthenticated", "Must be signed in.");
		if (!(await isSuperAdminCaller(request.auth.token)))
			throw new HttpsError("permission-denied", "Super admins only.");
		const keepUid = request.data?.keepUid;
		const dropUid = request.data?.dropUid;
		const move = request.data?.moveLogins !== false;
		for (const id of [keepUid, dropUid])
			if (typeof id !== "string" || !id || id.includes("/"))
				throw new HttpsError("invalid-argument", "Invalid account id.");
		if (keepUid === dropUid)
			throw new HttpsError("invalid-argument", "Same account.");

		const db = admin.firestore();
		const users = db.collection("users");
		// Everyone who lists the removed account — also one-sided links.
		const [listing, reqFrom, reqTo] = await Promise.all([
			users.where("linkedFamilyMembers", "array-contains", dropUid).get(),
			db
				.collection("familyLinkRequests")
				.where("fromUserId", "==", dropUid)
				.where("status", "==", "pending")
				.get(),
			db
				.collection("familyLinkRequests")
				.where("toUserId", "==", dropUid)
				.where("status", "==", "pending")
				.get(),
		]);
		const by =
			request.auth.token?.email || request.auth.token?.phone_number || "";
		const logRef = db.collection("admin_merge_log").doc();

		const summary = await db.runTransaction(async (tx) => {
			const [keepSnap, dropSnap] = await tx.getAll(
				users.doc(keepUid),
				users.doc(dropUid),
			);
			const keep = keepSnap.data();
			const drop = dropSnap.data();
			if (!isActiveFamilyProfile(keep))
				throw new HttpsError("not-found", "The profile to keep is missing or removed.");
			if (!drop || drop.mergedIntoUid)
				throw new HttpsError("failed-precondition", "Already merged or missing.");

			const dropLinks = asStringList(drop.linkedFamilyMembers);
			const otherIds = [
				...new Set([...dropLinks, ...listing.docs.map((d) => d.id)]),
			]
				.filter((u) => u !== keepUid && u !== dropUid)
				.slice(0, FAMILY_GROUP_MAX_SIZE);
			const otherSnaps = otherIds.length
				? await tx.getAll(...otherIds.map((u) => users.doc(u)))
				: [];
			const reqRefs = [...reqFrom.docs, ...reqTo.docs].map((d) => d.ref);
			const reqSnaps = reqRefs.length ? await tx.getAll(...reqRefs) : [];

			// ── The kept profile ──
			const filled: string[] = [];
			const keepFields = new Map<string, [FieldPath, unknown]>();
			const set = (path: string[], value: unknown) =>
				keepFields.set(path.join("\u0000"), [new FieldPath(...path), value]);
			for (const f of MERGE_FILL_FIELDS) {
				if (isBlank(keep[f]) && !isBlank(drop[f])) {
					set([f], drop[f]);
					filled.push(f);
				}
			}
			if (isBlank(keep.mandalId) && !isBlank(drop.mandalId)) {
				set(["mandalId"], drop.mandalId);
				set(["customMandalName"], drop.customMandalName || "");
				filled.push("mandalId");
			}
			if (keep.isApproved !== true && drop.isApproved === true) {
				set(["isApproved"], true);
				set(["approvalDate"], drop.approvalDate || Date.now());
				set(["rejectionNote"], "");
				filled.push("isApproved");
			}
			const keepMembers = Array.isArray(keep.familyMembers)
				? keep.familyMembers
				: [];
			const addedMembers = (
				Array.isArray(drop.familyMembers) ? drop.familyMembers : []
			).filter(
				(m: any) =>
					m?.id &&
					!keepMembers.some((k: any) => sameMember(k, m)) &&
					!sameMember(m, keep),
			);
			if (addedMembers.length)
				set(["familyMembers"], [...keepMembers, ...addedMembers]);
			const tokens = [
				...new Set([
					...asStringList(keep.fcmTokens),
					...asStringList(drop.fcmTokens),
				]),
			].slice(-5);
			if (tokens.length) set(["fcmTokens"], tokens);

			const keepRel = relationMap(keep.linkedFamilyRelations);
			const dropRel = relationMap(drop.linkedFamilyRelations);
			const dropAuto = relationMap(drop.linkedFamilyRelationsAuto);
			const dropVia: Record<string, unknown> = drop.linkedFamilyVia || {};
			const keepVia: Record<string, unknown> = keep.linkedFamilyVia || {};
			const keepLinks = asStringList(keep.linkedFamilyMembers);
			const linksAdded = dropLinks.filter(
				(x) => x !== keepUid && x !== dropUid && !keepLinks.includes(x),
			);
			const newKeepLinks = [
				...new Set([
					...keepLinks.filter((x) => x !== dropUid),
					...linksAdded,
				]),
			];
			if (
				linksAdded.length ||
				newKeepLinks.length !== keepLinks.length
			)
				set(["linkedFamilyMembers"], newKeepLinks);
			for (const x of linksAdded) {
				if (dropRel[x] && !keepRel[x]) {
					set(["linkedFamilyRelations", x], dropRel[x]);
					if (dropAuto[x] === dropRel[x])
						set(["linkedFamilyRelationsAuto", x], dropAuto[x]);
				}
				const via = dropVia[x];
				if (typeof via === "string" && via && via !== keepUid && via !== dropUid)
					set(["linkedFamilyVia", x], via);
			}
			if (keepLinks.includes(dropUid)) {
				set(["linkedFamilyRelations", dropUid], FieldValue.delete());
				set(["linkedFamilyRelationsAuto", dropUid], FieldValue.delete());
				set(["linkedFamilyVia", dropUid], FieldValue.delete());
			}
			// "Linked through" the removed account ⇒ a direct link now.
			for (const [y, v] of Object.entries(keepVia))
				if (v === dropUid) set(["linkedFamilyVia", y], FieldValue.delete());
			set(["mergedFrom"], FieldValue.arrayUnion(dropUid));
			applyFieldUpdates(
				tx,
				keepSnap.ref,
				[...keepFields.values()].flat(),
			);

			// ── Everyone linked to the removed account ──
			let relinked = 0;
			for (const snap of otherSnaps) {
				const d = snap.data();
				if (!d) continue;
				const theirLinks = asStringList(d.linkedFamilyMembers);
				if (!theirLinks.includes(dropUid)) continue;
				const f = new Map<string, [FieldPath, unknown]>();
				const put = (path: string[], value: unknown) =>
					f.set(path.join("\u0000"), [new FieldPath(...path), value]);
				put(
					["linkedFamilyMembers"],
					[
						...new Set([
							...theirLinks.filter((x) => x !== dropUid),
							keepUid,
						]),
					],
				);
				const rel = relationMap(d.linkedFamilyRelations);
				const auto = relationMap(d.linkedFamilyRelationsAuto);
				const via: Record<string, unknown> = d.linkedFamilyVia || {};
				const hadKeep = theirLinks.includes(keepUid);
				if (rel[dropUid] && !rel[keepUid]) {
					put(["linkedFamilyRelations", keepUid], rel[dropUid]);
					if (auto[dropUid] === rel[dropUid])
						put(["linkedFamilyRelationsAuto", keepUid], rel[dropUid]);
				}
				for (const [y, v] of Object.entries(via))
					if (v === dropUid)
						put(
							["linkedFamilyVia", y],
							// Through the kept account itself = a direct link.
							y === keepUid ? FieldValue.delete() : keepUid,
						);
				if (
					!hadKeep &&
					typeof via[dropUid] === "string" &&
					via[dropUid] !== keepUid
				)
					put(["linkedFamilyVia", keepUid], via[dropUid]);
				put(["linkedFamilyRelations", dropUid], FieldValue.delete());
				put(["linkedFamilyRelationsAuto", dropUid], FieldValue.delete());
				put(["linkedFamilyVia", dropUid], FieldValue.delete());
				applyFieldUpdates(tx, snap.ref, [...f.values()].flat());
				relinked++;
			}

			// ── Pending link requests ──
			for (const snap of reqSnaps) {
				const r = snap.data();
				if (!r || r.status !== "pending") continue;
				const from = r.fromUserId === dropUid ? keepUid : r.fromUserId;
				const to = r.toUserId === dropUid ? keepUid : r.toUserId;
				const other = from === keepUid ? to : from;
				if (from === to || newKeepLinks.includes(other)) tx.delete(snap.ref);
				else tx.update(snap.ref, { fromUserId: from, toUserId: to });
			}

			// ── The removed profile: kept as it was, marked merged ──
			tx.update(dropSnap.ref, {
				isDeleted: true,
				deletedAt: Date.now(),
				mergedIntoUid: keepUid,
				mergedAt: FieldValue.serverTimestamp(),
				linkedFamilyMembers: [],
				fcmTokens: [],
			});

			const pick = (d: admin.firestore.DocumentData, keys: string[]) =>
				Object.fromEntries(
					keys.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]),
				);
			const linkKeys = [
				"linkedFamilyMembers",
				"linkedFamilyRelations",
				"linkedFamilyRelationsAuto",
				"linkedFamilyVia",
			];
			tx.set(logRef, {
				keepUid,
				dropUid,
				by,
				at: FieldValue.serverTimestamp(),
				filled,
				keepBefore: pick(keep, [
					...filled,
					...linkKeys,
					"familyMembers",
					"customMandalName",
					"approvalDate",
					"rejectionNote",
					"fcmTokens",
				]),
				dropBefore: pick(drop, [...linkKeys, "fcmTokens"]),
				relinked: otherIds.length,
			});

			return {
				filled,
				linksMoved: linksAdded.length,
				relinked,
				membersAdded: addedMembers.length,
			};
		});

		const logins = await moveLoginsToKept(keepUid, dropUid, move);
		if (logins.left.length && logins.hint)
			await users
				.doc(dropUid)
				.update({ mergedLoginHint: logins.hint })
				.catch((e) => console.warn("[merge] hint not saved", e));
		await logRef.update({ logins }).catch(() => {});
		return { ...summary, logins };
	},
);

const str = (v: unknown, max = 200) =>
	typeof v === "string" ? v.slice(0, max) : "";

/** A profile's hand-added family members as linked relatives may see them. */
function handAddedForFamily(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value
		.filter(
			(m) =>
				m &&
				typeof m === "object" &&
				typeof m.id === "string" &&
				(str(m.realName) || str(m.dikshaName)) &&
				m.approvalStatus !== "rejected",
		)
		.slice(0, 40)
		.map((m) => ({
			id: str(m.id, 80),
			realName: str(m.realName),
			dikshaName: str(m.dikshaName),
			guruName: str(m.guruName),
			dikshaDate: str(m.dikshaDate, 40),
			isAspiring: m.isAspiring === true,
			photoURL: str(m.photoURL, 1000),
			relation: str(m.relation, 40),
		}));
}

/**
 * The caller's linked family members, as the profile screen shows them.
 *
 * Linked devotees used to read each other's whole profile document, phone number
 * included (and with automatic group merging that reaches the whole extended
 * family). Rules cannot hide one field of a document, so the app reads family
 * members through here instead, and only the fields below ever leave the server.
 */
export const getLinkedFamilyProfiles = onCall(
	{ cors: true, timeoutSeconds: 30, memory: "256MiB" },
	async (request: any) => {
		const callerUid = request.auth?.uid;
		if (!callerUid)
			throw new HttpsError("unauthenticated", "User must be logged in.");

		const db = admin.firestore();
		const callerDoc = await db.collection("users").doc(callerUid).get();
		const linked = asStringList(callerDoc.data()?.linkedFamilyMembers)
			.filter((uid) => uid !== callerUid)
			.slice(0, FAMILY_GROUP_MAX_SIZE);
		if (linked.length === 0) return { members: [] };
		const linkedSet = new Set(linked);

		const docs = await db.getAll(
			...linked.map((uid) => db.collection("users").doc(uid)),
		);
		const members = docs.flatMap((docSnap) => {
			const d = docSnap.data();
			// A deleted or merged account is no longer a real family member, and
			// the link must hold from their side too (same test the rules used).
			if (!isActiveFamilyProfile(d)) return [];
			if (!asStringList(d.linkedFamilyMembers).includes(callerUid)) return [];
			const theirRelation = d.linkedFamilyRelations?.[callerUid];
			// Their relations for the caller's other linked family members only —
			// lets the app suggest a relation through a chain (mausi's son ⇒
			// मौसेरा भाई). Nothing about people outside the caller's family.
			const familyRelations: Record<string, string> = {};
			for (const [uid, rel] of Object.entries(
				relationMap(d.linkedFamilyRelations),
			)) {
				if (uid !== callerUid && linkedSet.has(uid)) familyRelations[uid] = rel;
			}
			return [
				{
					id: docSnap.id,
					realName: d.realName || "",
					dikshaName: d.dikshaName || "",
					guruName: d.guruName || "",
					dikshaDate: d.dikshaDate || "",
					photoURL: d.photoURL || "",
					isAspiring: d.isAspiring === true,
					personalExperience: d.personalExperience || "",
					gender: d.gender === "male" || d.gender === "female" ? d.gender : "",
					// How THEY described the caller — drives the suggested relation.
					theirRelationForMe:
						typeof theirRelation === "string" ? theirRelation : "",
					familyRelations,
					// Their admin review, so the family sees why a profile was not
					// approved (only the status and the admin's reason).
					reviewStatus: d.isApproved
						? "approved"
						: d.rejectionNote
							? "rejected"
							: "pending",
					rejectionNote:
						!d.isApproved && typeof d.rejectionNote === "string"
							? d.rejectionNote
							: "",
					// The people they added by hand (who can't make their own
					// profile), so the whole linked family sees them — the app
					// works out the relation through this member. Never a phone
					// number; members an admin rejected are left out.
					handAdded: handAddedForFamily(d.familyMembers),
				},
			];
		});
		return { members };
	},
);

/**
 * Merges the family groups of two devotees who have just been linked: every
 * account linked to one of them is linked to every account linked to the other
 * (A↔B and B↔C ⇒ A↔C). Relations are NOT copied — "B is my father" says nothing
 * about how C is related to A — so auto-links carry only a `linkedFamilyVia`
 * marker naming the person they came through.
 */
async function mergeFamilyGroups(
	db: admin.firestore.Firestore,
	aUid: string,
	xUid: string,
) {
	const users = db.collection("users");
	const [aSnap, xSnap] = await db.getAll(users.doc(aUid), users.doc(xUid));
	const aData = aSnap.data();
	const xData = xSnap.data();
	if (!isActiveFamilyProfile(aData) || !isActiveFamilyProfile(xData)) return;

	const aLinks = asStringList(aData.linkedFamilyMembers);
	const xLinks = asStringList(xData.linkedFamilyMembers);
	// Only a link both documents agree on merges groups. Every link flow writes
	// both sides; a one-sided entry is either still in flight (the other
	// document's own trigger will run the merge) or was not made by those flows.
	if (!aLinks.includes(xUid) || !xLinks.includes(aUid)) return;

	// One hop from each end — not a walk of the whole graph, so a pair someone
	// deliberately unlinked inside one family is not linked straight back.
	const sideA = [...new Set([aUid, ...aLinks])].filter((u) => u !== xUid);
	const sideX = [...new Set([xUid, ...xLinks])].filter((u) => u !== aUid);
	const everyone = [...new Set([...sideA, ...sideX])];
	if (everyone.length > FAMILY_GROUP_MAX_SIZE) {
		console.warn(
			`Family merge ${aUid}↔${xUid} skipped: ${everyone.length} accounts exceeds the cap.`,
		);
		return;
	}

	const snaps = await db.getAll(...everyone.map((u) => users.doc(u)));
	const active = new Map<string, admin.firestore.DocumentData>();
	for (const snap of snaps) {
		const data = snap.data();
		if (isActiveFamilyProfile(data)) active.set(snap.id, data);
	}

	// member uid → (uid to add → uid it was linked through)
	const additions = new Map<string, Map<string, string>>();
	const addLinks = (member: string, candidates: string[], via: string) => {
		const data = active.get(member);
		if (!data) return;
		const current = new Set(asStringList(data.linkedFamilyMembers));
		for (const candidate of candidates) {
			if (candidate === member || current.has(candidate)) continue;
			if (!active.has(candidate)) continue;
			const pending = additions.get(member) ?? new Map<string, string>();
			if (!pending.has(candidate)) pending.set(candidate, via);
			additions.set(member, pending);
		}
	};
	for (const member of sideA)
		addLinks(member, sideX, member === aUid ? xUid : aUid);
	for (const member of sideX)
		addLinks(member, sideA, member === xUid ? aUid : xUid);

	if (additions.size === 0) return;

	const batch = db.batch();
	for (const [member, adds] of additions) {
		const fields: unknown[] = [
			new FieldPath("linkedFamilyMembers"),
			FieldValue.arrayUnion(...adds.keys()),
		];
		for (const [added, via] of adds) {
			fields.push(new FieldPath("linkedFamilyVia", added), via);
		}
		applyFieldUpdates(batch, users.doc(member), fields);
	}
	await batch.commit();
	console.log(
		`Family merge ${aUid}↔${xUid}: updated ${additions.size} profile(s).`,
	);
}

/** `linkedFamilyRelations` as uid → relation, ignoring anything malformed. */
const relationMap = (value: unknown): Record<string, string> => {
	const out: Record<string, string> = {};
	if (value && typeof value === "object") {
		for (const [key, rel] of Object.entries(value)) {
			if (typeof rel === "string" && rel) out[key] = rel;
		}
	}
	return out;
};

const genderOf = (data: admin.firestore.DocumentData | undefined) =>
	data?.gender === "male" || data?.gender === "female" ? data.gender : "";

/**
 * Fills in the other side of a link's relation: "B is my sister" and I am
 * male ⇒ B's relation for me becomes "brother". Only when the answer is
 * certain (autoInverseRelation), and never over a relation the devotee (or an
 * admin) chose: a filled-in value is also recorded in
 * `linkedFamilyRelationsAuto`, and only a relation still equal to that record
 * is ever changed or taken back — so fixing a mistake fixes both sides.
 *
 * `uid` is the profile that changed. Its own relations are filled the same
 * way when its gender changes, since the relations others chose for it may
 * only now be resolvable.
 */
async function syncInverseRelations(
	db: admin.firestore.Firestore,
	uid: string,
	before: admin.firestore.DocumentData | undefined,
	after: admin.firestore.DocumentData,
) {
	const beforeRel = relationMap(before?.linkedFamilyRelations);
	const afterRel = relationMap(after.linkedFamilyRelations);
	const genderChanged = genderOf(before) !== genderOf(after);

	// Linked accounts whose relation (as this profile describes them) changed;
	// after a gender change, all of them.
	const others = asStringList(after.linkedFamilyMembers)
		.filter(
			(other) =>
				other !== uid &&
				(genderChanged || (afterRel[other] ?? "") !== (beforeRel[other] ?? "")),
		)
		.slice(0, FAMILY_GROUP_MAX_SIZE);
	if (others.length === 0) return;

	const users = db.collection("users");
	await db.runTransaction(async (transaction) => {
		const meRef = users.doc(uid);
		const [meSnap, ...otherSnaps] = await transaction.getAll(
			meRef,
			...others.map((other) => users.doc(other)),
		);
		const me = meSnap.data();
		if (!isActiveFamilyProfile(me)) return;
		const myGender = genderOf(me);
		const myRel = relationMap(me.linkedFamilyRelations);
		const myAuto = relationMap(me.linkedFamilyRelationsAuto);
		const myLinks = new Set(asStringList(me.linkedFamilyMembers));
		const myFields: unknown[] = [];

		for (const snap of otherSnaps) {
			const other = snap.data();
			// Only links both sides agree on (as the group merge does).
			if (!isActiveFamilyProfile(other) || !myLinks.has(snap.id)) continue;
			if (!asStringList(other.linkedFamilyMembers).includes(uid)) continue;
			const theirGender = genderOf(other);
			let theirs = relationMap(other.linkedFamilyRelations)[uid] ?? "";
			const theirsIsAuto =
				!!theirs &&
				theirs === relationMap(other.linkedFamilyRelationsAuto)[uid];

			// Their relation for me, from mine for them.
			const target = autoInverseRelation(myRel[snap.id], myGender, theirGender);
			if (target && target !== theirs && (!theirs || theirsIsAuto)) {
				applyFieldUpdates(transaction, snap.ref, [
					new FieldPath("linkedFamilyRelations", uid),
					target,
					new FieldPath("linkedFamilyRelationsAuto", uid),
					target,
				]);
				theirs = target;
			} else if (!target && theirsIsAuto) {
				// What we filled in no longer follows from my relation (I changed or
				// removed it) — take it back rather than leave it wrong.
				applyFieldUpdates(transaction, snap.ref, [
					new FieldPath("linkedFamilyRelations", uid),
					FieldValue.delete(),
					new FieldPath("linkedFamilyRelationsAuto", uid),
					FieldValue.delete(),
				]);
				theirs = "";
			}

			// My relation for them, from theirs for me — my gender decides
			// whether their word for me fits ("sister" for a male is refused).
			if (genderChanged) {
				const mine = myRel[snap.id] ?? "";
				const mineIsAuto = !!mine && mine === myAuto[snap.id];
				const myTarget = autoInverseRelation(theirs, theirGender, myGender);
				if (myTarget && myTarget !== mine && (!mine || mineIsAuto)) {
					myFields.push(
						new FieldPath("linkedFamilyRelations", snap.id),
						myTarget,
						new FieldPath("linkedFamilyRelationsAuto", snap.id),
						myTarget,
					);
				}
			}
		}
		if (myFields.length > 0) applyFieldUpdates(transaction, meRef, myFields);
	});
}

/**
 * Runs the family-group merge whenever a profile gains a linked account —
 * whichever flow made the link (a devotee accepting a request, or an admin) —
 * and fills in the other side of relations as they are set.
 */
export const syncFamilyLinkGroups = functionsV1.firestore
	.document("users/{uid}")
	.onWrite(async (change, context) => {
		const after = change.after.exists ? change.after.data() : undefined;
		if (!isActiveFamilyProfile(after)) return;
		const before = change.before.exists ? change.before.data() : undefined;
		const uid = context.params.uid as string;

		try {
			await syncInverseRelations(admin.firestore(), uid, before, after);
		} catch (e) {
			console.error(`Inverse relations for ${uid} failed:`, e);
		}

		const beforeLinks = new Set(asStringList(before?.linkedFamilyMembers));
		const beforeVia: Record<string, unknown> = before?.linkedFamilyVia || {};
		const afterVia: Record<string, unknown> = after.linkedFamilyVia || {};

		// Only DIRECT new links start a merge. An entry that arrived together with
		// a fresh `linkedFamilyVia` marker was written by a merge itself; merging
		// again from there would chain through the whole extended family.
		const directAdds = asStringList(after.linkedFamilyMembers).filter(
			(other) =>
				other !== uid &&
				!beforeLinks.has(other) &&
				!(afterVia[other] && !beforeVia[other]),
		);
		if (directAdds.length === 0) return;

		const db = admin.firestore();
		for (const other of directAdds) {
			try {
				await mergeFamilyGroups(db, uid, other);
			} catch (e) {
				console.error(`Family merge ${uid}↔${other} failed:`, e);
			}
		}
	});

export const notifyAdminOnGlorification = functionsV1.firestore
	.document("hhbsm-2026-glorification/{docId}")
	.onWrite(async (change, _context) => {
		// Get the document data after the write
		const data = change.after.data();

		// If data is null, the document was deleted. No need to notify.
		if (!data) return;

		// Determine if this is an update or a new submission
		const isUpdate = change.before.exists;
		const actionWord = isUpdate ? "Updated" : "New";

		const { name, location } = data;
		const db = admin.firestore();

		try {
			// Find Admin users by email
			const usersRef = db.collection("users");
			const adminEmails = ["namanbgis@gmail.com", "damodardasshri@gmail.com"];
			const snapshot = await usersRef.where("email", "in", adminEmails).get();

			if (snapshot.empty) {
				console.log("Admin users not found.");
				return;
			}

			const soundSettings = await getNotificationSoundSettings();
			const sendPromises: any[] = [];

			snapshot.docs.forEach((doc) => {
				const adminData = doc.data();
				const email = adminData.email;
				const fcmTokens = adminData.fcmTokens || [];

				if (fcmTokens.length === 0) {
					console.log(`Admin user ${email} has no FCM tokens registered.`);
					return;
				}

				const isSilent = email === "damodardasshri@gmail.com";

				const payload: any = {
					notification: {
						title: `Glorification ${actionWord}`,
						body: `${name || "A Devotee"} from ${location || "Unknown"}`,
					},
				};

				if (!isSilent) {
					payload.android = {
						notification: {
							sound: soundSettings.sound,
							channelId: soundSettings.channelId,
						},
					};
					payload.apns = {
						payload: {
							aps: {
								sound: soundSettings.apnsSound,
							},
						},
					};
				}

				fcmTokens.forEach((token: string) => {
					sendPromises.push(
						admin.messaging().send({
							...payload,
							token: token,
						}),
					);
				});
			});

			const results = await Promise.allSettled(sendPromises);
			const successCount = results.filter(
				(r) => r.status === "fulfilled",
			).length;
			const failureCount = results.filter(
				(r) => r.status === "rejected",
			).length;

			console.log(
				`Successfully sent glorification update to admin. Success count: ${successCount}, Failure count: ${failureCount}`,
			);
		} catch (error) {
			console.error("Error sending glorification update to admin:", error);
		}
	});

/**
 * Just after midnight in India: the approved devotees whose diksha anniversary
 * is today, into diksha_anniversaries/{YYYY-MM-DD} for the Home screen card.
 * One run a day; reads only the approved profiles and only the fields shown.
 */
export const publishDikshaAnniversaries = onSchedule(
	{
		schedule: "5 0 * * *",
		timeZone: "Asia/Kolkata",
		timeoutSeconds: 120,
		memory: "256MiB",
	},
	async () => {
		const db = admin.firestore();
		const today = istToday();
		const snap = await db
			.collection("users")
			.where("isApproved", "==", true)
			.select(
				"isApproved",
				"isDeleted",
				"mergedIntoUid",
				"isAspiring",
				"realName",
				"dikshaName",
				"dikshaDate",
				"photoURL",
				"mandalId",
				"customMandalName",
			)
			.get();
		const devotees = buildAnniversaryList(
			snap.docs.map((d) => d.data()),
			today,
		);
		await db.collection("diksha_anniversaries").doc(today.id).set({
			date: today.id,
			devotees,
			updatedAt: FieldValue.serverTimestamp(),
		});
		console.log(
			`Diksha anniversaries ${today.id}: ${devotees.length} of ${snap.size} approved profiles.`,
		);
	},
);

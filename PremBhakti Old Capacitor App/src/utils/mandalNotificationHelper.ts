/**
 * mandalNotificationHelper.ts
 *
 * Helpers for sending and scheduling push notifications when a Mandal admin
 * uploads new Darshan or Activity photos.
 *
 * Two paths:
 *  1. scheduleMandalNotification() — writes to Firestore `scheduled_notifications`
 *     with a computed `scheduledAt` that respects:
 *       • a 60-second CDN propagation delay
 *       • delivery time windows (Darshan 6 AM–10 PM IST / Activity 12 PM–10 PM IST)
 *     The `processScheduledNotifications` Cloud Function (runs every 10 min) picks
 *     it up and sends the FCM message. It also updates `lastNotificationSent` after
 *     actual delivery.
 *  2. sendMandalUploadNotification() — fires FCM immediately (kept for direct use).
 *
 * Duplicate-send guards:
 *  - Indore: only once per 7 days (checked against `lastNotificationSent` at schedule time)
 *  - All others: if a pending (unsent) doc already exists for this mandal+type,
 *    we UPDATE it (new image / new scheduledAt) rather than creating a duplicate.
 */

import {
	addDoc,
	collection,
	doc,
	getDocs,
	query,
	updateDoc,
	where,
} from "firebase/firestore";
import { importPKCS8, SignJWT } from "jose";
import { db } from "../../services/firebase";

export type NotifType = "darshan" | "activity";

interface SendMandalNotifOptions {
	mandalId: string;
	mandalName: string;
	type: NotifType;
	uploadDate: string; // YYYY-MM-DD — the date of the photos
	imageUrl?: string; // First photo URL for notification thumbnail
}

// ─── Timing Window Helper ────────────────────────────────────────────────────

/**
 * Returns the UTC-ms timestamp at which the notification should be delivered.
 *
 * Logic:
 *  1. Add 60-second CDN propagation delay.
 *  2. Check if the resulting IST time falls inside the active window:
 *     - Darshan:  6:00 AM – 10:00 PM IST
 *     - Activity: 12:00 PM – 10:00 PM IST
 *  3. If inside → use as-is.
 *  4. If before window opens today → schedule for window-open time TODAY.
 *  5. If after window closes → schedule for window-open time TOMORROW.
 */
function getScheduledAtMs(
	type: "darshan" | "activity",
	cdnDelayMs = 60_000,
): number {
	const now = Date.now() + cdnDelayMs;

	// Compute IST representation of `now`
	const IST_OFFSET_MS = 5.5 * 3600_000;
	const istNow = new Date(now + IST_OFFSET_MS);

	const h = istNow.getUTCHours();
	const m = istNow.getUTCMinutes();
	const s = istNow.getUTCSeconds();
	const ms = istNow.getUTCMilliseconds();
	const totalMinutes = h * 60 + m;

	// Active window boundaries in minutes-since-IST-midnight
	const DARSHAN_START = 6 * 60; // 360  → 6:00 AM
	const DARSHAN_END = 22 * 60; // 1320 → 10:00 PM
	const ACTIVITY_START = 12 * 60; // 720  → 12:00 PM
	const ACTIVITY_END = 22 * 60; // 1320 → 10:00 PM

	const windowStart = type === "darshan" ? DARSHAN_START : ACTIVITY_START;
	const windowEnd = type === "darshan" ? DARSHAN_END : ACTIVITY_END;

	// Within active window → deliver after CDN delay only
	if (totalMinutes >= windowStart && totalMinutes < windowEnd) {
		return now;
	}

	// Milliseconds elapsed since IST midnight
	const msSinceMidnightIst = (h * 3600 + m * 60 + s) * 1000 + ms;

	// UTC epoch of IST midnight for the current IST day:
	//   now = (IST time) - IST_OFFSET  →  IST midnight UTC = now - msSinceMidnightIst
	const istMidnightUtcMs = now - msSinceMidnightIst;

	if (totalMinutes < windowStart) {
		// Before window opens → send at windowStart TODAY (IST)
		return istMidnightUtcMs + windowStart * 60_000;
	} else {
		// After window closes → send at windowStart TOMORROW (IST)
		return istMidnightUtcMs + (24 * 60 + windowStart) * 60_000;
	}
}

// ─── Deferred Scheduling (preferred path) ────────────────────────────────────

/**
 * Schedules a mandal upload notification via the `scheduled_notifications`
 * Firestore collection. The Cloud Function `processScheduledNotifications`
 * delivers it at the computed time.
 *
 * Guard rules (checked here at schedule time):
 *  - Indore mandal: skipped if last actual send was < 7 days ago.
 *  - All mandals: if a pending (unsent) notification for the same mandal+type
 *    already exists, its imageUrl / scheduledAt are updated instead of
 *    creating a duplicate document.
 *
 * After actual FCM delivery, the Cloud Function updates `lastNotificationSent`
 * on the mandal document.
 */
export async function scheduleMandalNotification(
	opts: SendMandalNotifOptions,
): Promise<void> {
	const { mandalId, mandalName, type, uploadDate, imageUrl } = opts;

	try {
		const { getDocFromServer } = await import("firebase/firestore");

		// ── Check Enabled Setting from Firestore ──
		const settingsDoc = await getDocFromServer(
			doc(db, "app_config", "notification_settings"),
		);
		if (
			settingsDoc.exists() &&
			settingsDoc.data().mandalUploadsEnabled === false
		) {
			console.log(
				"[MandalNotif] Skipping notification because mandalUploadsEnabled is false.",
			);
			return;
		}

		// ── Indore weekly-limit guard ──────────────────────────────────────────
		if (mandalId === "indore") {
			const snap = await getDocFromServer(doc(db, "mandals", mandalId));
			const lastSent: Record<string, string> = snap.exists()
				? snap.data()?.lastNotificationSent || {}
				: {};

			if (lastSent[type]) {
				const lastDate = new Date(lastSent[type]);
				const diffDays = Math.floor(
					(Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
				);
				if (diffDays < 7) {
					console.log(
						`[MandalNotif] Skipping — Indore is limited to 1 notification/week ` +
							`(last sent: ${lastSent[type]}, ${diffDays}d ago).`,
					);
					return;
				}
			}
		}

		// ── Build payload fields ───────────────────────────────────────────────
		const actionType =
			type === "darshan" ? "mandal_darshan" : "mandal_activity";
		const shortName = mandalName.replace(/\s*mandal\s*/i, "").trim();

		const title =
			type === "darshan"
				? `🙏 नया दर्शन — ${shortName} मंडल`
				: `📅 नई एक्टिविटी — ${shortName} मंडल`;
		const body =
			type === "darshan"
				? `${shortName} मंडल की नई दर्शन फ़ोटो तैयार हैं, अभी देखें! 🙏`
				: `${shortName} मंडल की नई गतिविधि फ़ोटो अपलोड हो गई हैं, अभी देखें! 📸`;

		const scheduledAt = getScheduledAtMs(type);

		// ── Duplicate-pending-doc guard ────────────────────────────────────────
		// If there's already an unsent notification for this mandal+type,
		// update it (new image, new scheduledAt) rather than creating a duplicate.
		const pendingQ = query(
			collection(db, "scheduled_notifications"),
			where("mandalId", "==", mandalId),
			where("actionType", "==", actionType),
			where("sent", "==", false),
		);
		const pendingSnap = await getDocs(pendingQ);

		if (!pendingSnap.empty) {
			await updateDoc(pendingSnap.docs[0].ref, {
				imageUrl: imageUrl || "",
				uploadDate,
				scheduledAt,
				createdAt: Date.now(),
			});
			console.log(
				`[MandalNotif] Updated existing pending notification for ${mandalId}/${type} ` +
					`→ deliverAt ${new Date(scheduledAt).toISOString()}`,
			);
			return;
		}

		// ── Write new scheduled_notifications document ─────────────────────────
		await addDoc(collection(db, "scheduled_notifications"), {
			title,
			body,
			imageUrl: imageUrl || "",
			actionType,
			targetScreen: "",
			targetLink: "",
			mandalId,
			uploadDate,
			scheduledAt,
			sent: false,
			createdAt: Date.now(),
		});

		console.log(
			`[MandalNotif] Scheduled ${type} notification for ${mandalId} ` +
				`→ deliverAt ${new Date(scheduledAt).toISOString()}`,
		);
	} catch (e: any) {
		console.error("[MandalNotif] Error scheduling notification:", e?.message);
	}
}

// ─── Direct Send (legacy / kept for direct use) ─────────────────────────────

/**
 * Fetches a Google OAuth2 access token using the service account stored
 * in Firestore (app_config/notificationkey). Used only by the direct FCM send path.
 */
async function getGoogleAccessToken(): Promise<{
	token: string;
	projectId: string;
}> {
	const { getDoc } = await import("firebase/firestore");
	const notifDoc = await getDoc(doc(db, "app_config", "notificationkey"));
	if (!notifDoc.exists())
		throw new Error("Notification service account not configured.");
	const saJson = notifDoc.data()?.servicekey;
	if (!saJson) throw new Error("Service account key is empty.");

	let sa: any;
	try {
		sa = JSON.parse(saJson);
		if (typeof sa === "string") sa = JSON.parse(sa);
	} catch {
		throw new Error("Service account JSON is malformed.");
	}

	if (!sa.project_id || !sa.private_key || !sa.client_email) {
		throw new Error("Service account JSON is missing required fields.");
	}

	const now = Math.floor(Date.now() / 1000);
	const privateKeyString = sa.private_key.replace(/\\n/g, "\n");
	const privateKey = await importPKCS8(privateKeyString, "RS256");

	const jwt = await new SignJWT({
		iss: sa.client_email,
		sub: sa.client_email,
		aud: "https://oauth2.googleapis.com/token",
		scope: "https://www.googleapis.com/auth/firebase.messaging",
		iat: now,
		exp: now + 3600,
	})
		.setProtectedHeader({ alg: "RS256", typ: "JWT" })
		.setIssuedAt(now)
		.setExpirationTime(now + 3600)
		.sign(privateKey);

	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
	});

	const tokenData = await tokenRes.json();
	if (!tokenRes.ok) {
		throw new Error(
			tokenData.error_description || "Failed to get Google access token.",
		);
	}

	return { token: tokenData.access_token, projectId: sa.project_id };
}

/**
 * Sends a silent FCM push to the "all" topic with a deep-link to the
 * specific mandal + date in either the Darshan or Activity screen.
 *
 * Returns true on success, false on failure.
 */
export async function sendMandalUploadNotification(
	opts: SendMandalNotifOptions,
): Promise<boolean> {
	const { mandalId, mandalName, type, uploadDate, imageUrl } = opts;

	try {
		// ── Check Silent Setting from Firestore ──
		let isSilentMode = true; // default to silent
		let selectedSound = "notisound3";
		try {
			const { getDoc } = await import("firebase/firestore");
			const settingsDoc = await getDoc(
				doc(db, "app_config", "notification_settings"),
			);
			if (settingsDoc.exists()) {
				const data = settingsDoc.data();
				if (data.mandalUploadsEnabled === false) {
					console.log(
						"[MandalNotif] Skipping notification because mandalUploadsEnabled is false.",
					);
					return false;
				}
				if (typeof data.mandalUploadsSilent === "boolean") {
					isSilentMode = data.mandalUploadsSilent;
				}
				if (data.selectedSound) {
					selectedSound = data.selectedSound;
				}
			}
		} catch (e) {
			console.error(
				"[MandalNotif] Failed to read silent setting, defaulting to silent:",
				e,
			);
		}

		const { token: accessToken, projectId } = await getGoogleAccessToken();

		const isDarshan = type === "darshan";

		// Clean mandal name (remove " Mandal" suffix for brevity)
		const shortName = mandalName.replace(/\s*mandal\s*/i, "").trim();

		const title = isDarshan
			? `🙏 नया दर्शन — ${shortName} मंडल`
			: `📅 नई एक्टिविटी — ${shortName} मंडल`;

		const body = isDarshan
			? `${shortName} मंडल की नई दर्शन फ़ोटो तैयार हैं, अभी देखें! 🙏`
			: `${shortName} मंडल की नई गतिविधि फ़ोटो अपलोड हो गई हैं, अभी देखें! 📸`;

		// action_type = "mandal_darshan" or "mandal_activity"
		// target_mandal = mandalId
		// target_date = YYYY-MM-DD of the uploaded photos
		const actionType = isDarshan ? "mandal_darshan" : "mandal_activity";

		const dataPayload: Record<string, string> = {
			action_type: actionType,
			target_mandal: mandalId,
			target_date: uploadDate,
			title,
			body,
			silent: isSilentMode ? "true" : "false",
		};
		if (imageUrl) {
			dataPayload.image = imageUrl;
			dataPayload.imageUrl = imageUrl;
		}

		const TTL_2_DAYS_S = 172800; // 2 days in seconds
		const fcmPayload: any = {
			message: {
				topic: "all",
				data: dataPayload,
				// Android
				android: {
					priority: isSilentMode ? "normal" : "high",
					ttl: `${TTL_2_DAYS_S}s`, // FCM HTTP v1 uses string format with 's' suffix
					notification: {
						channel_id: isSilentMode
							? "silent_alerts_v4"
							: "push_notifications_v6",
						default_sound: !isSilentMode,
						default_vibrate_timings: !isSilentMode,
						...(isSilentMode ? {} : { sound: selectedSound }),
						...(imageUrl ? { image: imageUrl } : {}),
						title,
						body,
					},
				},
				// iOS
				apns: {
					headers: {
						"apns-priority": isSilentMode ? "5" : "10",
						"apns-expiration": String(
							Math.floor(Date.now() / 1000) + TTL_2_DAYS_S,
						),
					},
					payload: {
						aps: {
							sound: isSilentMode ? "" : `${selectedSound}.m4a`, // Empty string = silent
							"mutable-content": 1,
							alert: {
								title,
								body,
							},
						},
					},
					...(imageUrl ? { fcm_options: { image: imageUrl } } : {}),
				},
			},
		};

		const res = await fetch(
			`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(fcmPayload),
			},
		);

		if (!res.ok) {
			const errData = await res.json().catch(() => ({}));
			console.error("[MandalNotif] FCM send failed:", errData);
			return false;
		}

		const responseData = await res.json();
		console.log(
			"[MandalNotif] Notification sent successfully:",
			responseData?.name,
		);
		return true;
	} catch (e: any) {
		console.error("[MandalNotif] Error sending notification:", e?.message);
		return false;
	}
}

import { doc, getDoc } from "firebase/firestore";
import { importPKCS8, SignJWT } from "jose";
import { db } from "../../services/firebase";

export interface PushNotificationPayload {
	tokens: string[];
	title: string;
	body: string;
	imageUrl?: string;
	actionType?: "screen" | "link" | "none";
	targetScreen?: string;
	targetLink?: string;
	silent?: boolean;
	sound?: string;
}

export interface PushNotificationResult {
	sent: number;
	invalidTokens: string[];
}

export const sendPushNotification = async (
	payload: PushNotificationPayload,
): Promise<PushNotificationResult> => {
	// Short-circuit: nothing to send
	if (!payload.tokens || payload.tokens.length === 0)
		return { sent: 0, invalidTokens: [] };

	// Skip if Web Crypto API is not available (e.g. non-HTTPS IP on local network)
	if (typeof crypto === "undefined" || !crypto.subtle) {
		console.warn(
			"Push notifications require Web Crypto API (HTTPS or localhost). Skipping push notification.",
		);
		return { sent: 0, invalidTokens: [] };
	}

	const saDoc = await getDoc(doc(db, "app_config", "notificationkey"));
	const saJson = saDoc.data()?.servicekey;
	if (!saJson) throw new Error("Service account key not found.");

	let sa;
	try {
		let parsed = JSON.parse(saJson);
		if (typeof parsed === "string") parsed = JSON.parse(parsed);
		sa = parsed;
	} catch (_e) {
		throw new Error("Invalid Service Account JSON");
	}

	const now = Math.floor(Date.now() / 1000);
	const jwtPayload = {
		iss: sa.client_email,
		sub: sa.client_email,
		aud: "https://oauth2.googleapis.com/token",
		iat: now,
		exp: now + 3600,
		scope: "https://www.googleapis.com/auth/firebase.messaging",
	};

	const privateKeyString = sa.private_key.replace(/\\n/g, "\n");
	const privateKey = await importPKCS8(privateKeyString, "RS256");
	const jwt = await new SignJWT(jwtPayload)
		.setProtectedHeader({ alg: "RS256", typ: "JWT" })
		.sign(privateKey);

	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
	});
	const tokenData = await tokenRes.json();
	if (!tokenRes.ok)
		throw new Error(
			tokenData.error_description || "Failed to get access token",
		);
	const accessToken = tokenData.access_token;
	const projectId = sa.project_id;

	const results = await Promise.allSettled(
		payload.tokens.map(async (token) => {
			const msgData: any = {
				title: payload.title,
				body: payload.body,
			};

			if (payload.imageUrl) {
				msgData.imageUrl = payload.imageUrl;
				msgData.image = payload.imageUrl;
			}

			if (payload.actionType === "screen" && payload.targetScreen) {
				msgData.action_type = "screen";
				msgData.target_screen = payload.targetScreen;
			} else if (payload.actionType === "link" && payload.targetLink) {
				msgData.action_type = "link";
				msgData.target_link = payload.targetLink;
			}

			if (payload.silent) {
				msgData.silent = "true";
			}

			const selectedSound = payload.sound || "notisound3";

			const msgBody: any = {
				message: {
					token,
					data: msgData,
					android: {
						priority: "high",
						notification: {
							channel_id: payload.silent
								? "silent_alerts_v4"
								: "push_notifications_v6",
							...(payload.silent ? {} : { sound: selectedSound }),
							...(payload.imageUrl ? { image: payload.imageUrl } : {}),
						},
					},
					apns: {
						headers: { "apns-priority": "10" },
						payload: {
							aps: {
								"mutable-content": 1,
								...(payload.silent ? {} : { sound: `${selectedSound}.m4a` }),
								alert: {
									title: payload.title,
									body: payload.body,
								},
							},
						},
						...(payload.imageUrl
							? { fcm_options: { image: payload.imageUrl } }
							: {}),
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
					body: JSON.stringify(msgBody),
				},
			);

			return {
				token,
				ok: res.ok,
				status: res.status,
				body: res.ok ? null : await res.json().catch(() => ({})),
			};
		}),
	);

	let sent = 0;
	const invalidTokens: string[] = [];

	for (const result of results) {
		if (result.status === "fulfilled") {
			const { token, ok, status, body } = result.value;
			if (ok) {
				sent++;
			} else if (status === 404 || status === 400) {
				const errCode =
					body?.error?.details?.[0]?.errorCode || body?.error?.status || "";
				if (
					["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"].some((c) =>
						errCode.includes(c),
					) ||
					status === 404
				) {
					invalidTokens.push(token);
				}
			}
		}
	}

	return { sent, invalidTokens };
};

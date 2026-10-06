import {
	PutObjectCommand,
	S3Client,
	UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AwsClient } from "aws4fetch";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

const JWKS_URI =
	"https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const jwks = createRemoteJWKSet(new URL(JWKS_URI));

async function verifyFirebaseAuth(request, projectId) {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		throw new Error("Missing or invalid Authorization header");
	}
	const token = authHeader.split("Bearer ")[1];

	const { payload } = await jwtVerify(token, jwks, {
		issuer: `https://securetoken.google.com/${projectId}`,
		audience: projectId,
	});

	return payload;
}

let cachedGoogleToken = null;
let cachedGoogleTokenExpires = 0;

async function getGoogleAccessToken(env) {
	if (!env.FIREBASE_SERVICE_ACCOUNT) {
		throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
	}

	if (cachedGoogleToken && Date.now() < cachedGoogleTokenExpires) {
		return cachedGoogleToken;
	}

	const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
	const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");

	const jwt = await new SignJWT({
		iss: serviceAccount.client_email,
		scope: "https://www.googleapis.com/auth/datastore",
		aud: "https://oauth2.googleapis.com/token",
	})
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(privateKey);

	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: jwt,
		}),
	});
	const tokenData = await tokenRes.json();
	const accessToken = tokenData.access_token;
	if (!accessToken) throw new Error("Failed to get Google Access Token");

	cachedGoogleToken = accessToken;
	cachedGoogleTokenExpires = Date.now() + 55 * 60 * 1000; // 55 minutes

	return accessToken;
}

const adminCache = new Map();

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

async function isUserAdmin(payload, env) {
	if (!payload) return false;

	const email = payload.email?.toLowerCase();
	const phone = payload.phone_number;

	if (email && SUPER_ADMIN_EMAILS.includes(email)) return true;
	if (phone && SUPER_ADMIN_PHONES.includes(phone)) return true;

	const userId = payload.user_id;
	if (adminCache.has(userId) && adminCache.get(userId).expires > Date.now()) {
		return adminCache.get(userId).isAdmin;
	}

	try {
		const accessToken = await getGoogleAccessToken(env);
		const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
		const projectId = serviceAccount.project_id;

		let isAdmin = false;

		// 1. Check users collection
		if (userId) {
			const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
			const userRes = await fetch(userDocUrl, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});
			if (userRes.ok) {
				const userData = await userRes.json();
				const role = userData.fields?.role?.stringValue;
				if (role === "admin" || role === "super_admin") {
					isAdmin = true;
				}
			}
		}

		// 2. Check admin_roles collection
		if (!isAdmin && email) {
			const adminDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admin_roles/${email}`;
			const adminRes = await fetch(adminDocUrl, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});
			if (adminRes.ok) {
				isAdmin = true;
			}
		}

		adminCache.set(userId, { isAdmin, expires: Date.now() + 5 * 60 * 1000 });
		return isAdmin;
	} catch (e) {
		console.error("isUserAdmin error", e);
		return false;
	}
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Range, Content-Type, Accept, Authorization",
};

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json", ...corsHeaders },
	});
}

// Encode each path segment separately (preserve "/" as path separator)
function encodeKey(objectKey) {
	return objectKey.split("/").map(encodeURIComponent).join("/");
}

// Safe object key that preserves folder structure and Unicode characters
function makeKey(fileName) {
	// We receive the full path from the frontend (e.g. "Local Data Uploaded from App/audios/...")
	// B2 supports Unicode, so we can just use the provided fileName as-is to keep Hindi text intact.
	return fileName;
}

// Build a signed S3 request using aws4fetch (works in CF Workers — no DOMParser needed)
function makeAws(env) {
	return new AwsClient({
		accessKeyId: env.B2_KEY_ID,
		secretAccessKey: env.B2_APP_KEY,
		region: env.B2_REGION,
		service: "s3",
	});
}

// Build a presign-only S3 client (only used for PutObject & UploadPart presigning, no XML parsing)
function makeS3(env) {
	return new S3Client({
		region: env.B2_REGION,
		endpoint: env.B2_ENDPOINT,
		credentials: {
			accessKeyId: env.B2_KEY_ID,
			secretAccessKey: env.B2_APP_KEY,
		},
	});
}

// Properly encoded CDN URL
function cdnUrl(objectKey) {
	const lowerKey = objectKey.toLowerCase();
	const isAudio =
		lowerKey.endsWith(".m4a") ||
		lowerKey.endsWith(".mp3") ||
		lowerKey.endsWith(".wav") ||
		lowerKey.endsWith(".aac") ||
		lowerKey.endsWith(".flac");

	if (isAudio || objectKey.startsWith("Local Data Uploaded from App/audios/")) {
		return `https://audios.chaitanyaprembhakti.org/${encodeKey(objectKey)}`;
	}
	return `https://videos.chaitanyaprembhakti.org/${encodeKey(objectKey)}`;
}

// B2 S3 virtual-hosted URL with correctly encoded key
function b2S3Url(env, objectKey, query = "") {
	return `https://${env.B2_BUCKET}.s3.${env.B2_REGION}.backblazeb2.com/${encodeKey(objectKey)}${query}`;
}

export default {
	async fetch(request, env, ctx) {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" },
			});
		}

		const url = new URL(request.url);
		const { pathname } = url;

		// OTA subdomain — all requests are public, no Firebase auth needed
		// capacitor-updater downloads ZIPs directly without auth headers
		const isOtaHost = url.hostname === "ota.chaitanyaprembhakti.org";
		if (isOtaHost) {
			return handleOtaRequest(request, env);
		}

		const isAudioHost = url.hostname === "audios.chaitanyaprembhakti.org";
		if (isAudioHost) {
			return handleAudiosRequest(request, env);
		}

		// Images subdomain — public, no auth, serves image assets directly from B2
		const isImageHost = url.hostname === "images.chaitanyaprembhakti.org";
		if (isImageHost) {
			return handleImagesRequest(request, env);
		}

		const authRequired = [
			"/api/generate-upload-url",
			"/api/create-multipart",
			"/api/presign-part",
			"/api/complete-multipart",
			"/api/abort-multipart",
			"/api/list-files",
			"/api/delete-file",
			"/api/rename-file",
			"/api/trigger-optimization",
		];

		let authPayload = null;
		let isAdmin = false;

		if (authRequired.includes(pathname) && request.method !== "OPTIONS") {
			try {
				authPayload = await verifyFirebaseAuth(request, "cpbs-admin");
				isAdmin = await isUserAdmin(authPayload, env);
			} catch (err) {
				return jsonResponse({ error: `Unauthorized: ${err.message}` }, 401);
			}
		}

		// Helper to enforce security logic for uploads
		const ensureUploadAllowed = (fileName) => {
			if (
				!isAdmin &&
				!fileName.startsWith("hhbsm-2026-glorification-audios/")
			) {
				throw new Error(
					"Forbidden: Devotees can only upload to the glorification audio folder.",
				);
			}
		};

		// Helper to enforce admin only endpoints
		const ensureAdminOnly = () => {
			if (!isAdmin) {
				throw new Error("Forbidden: This action requires admin privileges.");
			}
		};

		// ── 1. Simple upload presigned URL (files < 50MB) ─────────────────────────
		if (request.method === "POST" && pathname === "/api/generate-upload-url") {
			try {
				const { fileName, contentType } = await request.json();
				if (!fileName) return jsonResponse({ error: "fileName required" }, 400);

				try {
					ensureUploadAllowed(fileName);
				} catch (err) {
					return jsonResponse({ error: err.message }, 403);
				}

				const objectKey = makeKey(fileName);
				const s3 = makeS3(env);
				const uploadUrl = await getSignedUrl(
					s3,
					new PutObjectCommand({
						Bucket: env.B2_BUCKET,
						Key: objectKey,
						ContentType: contentType || "application/octet-stream",
					}),
					{ expiresIn: 3600 },
				);

				return jsonResponse({
					uploadUrl,
					objectKey,
					downloadUrl: cdnUrl(objectKey),
				});
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── X. Trigger GitHub Action Optimization (Manual App Trigger) ──────────────
		if (request.method === "POST" && pathname === "/api/trigger-optimization") {
			try {
				ensureAdminOnly();
				const { objectKey } = await request.json();
				if (!objectKey)
					return jsonResponse({ error: "objectKey required" }, 400);

				// Ensure GITHUB_PAT is set in Cloudflare Secrets
				if (!env.GITHUB_PAT) {
					return jsonResponse(
						{ error: "GITHUB_PAT secret is not configured" },
						500,
					);
				}

				const ghRes = await fetch(
					"https://api.github.com/repos/chaitanyaprembhakti/cbps-admin/dispatches",
					{
						method: "POST",
						headers: {
							Accept: "application/vnd.github.v3+json",
							Authorization: `token ${env.GITHUB_PAT}`,
							"User-Agent": "Cloudflare-Worker",
						},
						body: JSON.stringify({
							event_type: "optimize-video",
							client_payload: {
								object_key: objectKey,
							},
						}),
					},
				);

				if (!ghRes.ok) {
					const errText = await ghRes.text();
					throw new Error(`GitHub API error: ${ghRes.status} - ${errText}`);
				}
				return jsonResponse({
					success: true,
					message: "Optimization triggered",
				});
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── B2 Webhook Endpoint (Automated Upload Trigger) ────────────────────────
		if (request.method === "POST" && pathname === "/api/b2-webhook") {
			try {
				// Authenticate the webhook request (B2 allows setting custom headers, we expect Authorization: Bearer <WEBHOOK_SECRET>)
				const authHeader = request.headers.get("Authorization");
				if (!authHeader || authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
					return new Response("Unauthorized Webhook Request", { status: 401 });
				}

				const body = await request.json();
				if (body?.events) {
					for (const event of body.events) {
						const eventName = event.eventName || event.eventType; // Handle both B2 and S3 formats
						if (eventName?.includes("ObjectCreated")) {
							const objectKey = event.s3?.object?.key || event.objectName;
							if (objectKey) {
								const lowerKey = objectKey.toLowerCase();
								let eventType = null;

								// Determine GitHub Action based on file extension
								if (lowerKey.endsWith(".mp4")) {
									eventType = "optimize-video";
								} else if (
									lowerKey.endsWith(".mov") ||
									lowerKey.endsWith(".m4v") ||
									lowerKey.endsWith(".mkv") ||
									lowerKey.endsWith(".avi")
								) {
									eventType = "convert-video";
								} else if (lowerKey.endsWith(".m4a")) {
									eventType = "optimize-audio";
								} else if (
									lowerKey.endsWith(".mp3") ||
									lowerKey.endsWith(".wav") ||
									lowerKey.endsWith(".flac") ||
									lowerKey.endsWith(".ogg") ||
									lowerKey.endsWith(".aac")
								) {
									eventType = "convert-audio";
								}

								if (eventType && env.GITHUB_PAT) {
									// ctx.waitUntil() ensures Cloudflare keeps the worker alive until the fetch completes,
									// even after we've already returned 200 to B2 (preventing the 3-second timeout error).
									ctx.waitUntil(
										fetch(
											"https://api.github.com/repos/chaitanyaprembhakti/cbps-admin/dispatches",
											{
												method: "POST",
												headers: {
													Accept: "application/vnd.github.v3+json",
													Authorization: `token ${env.GITHUB_PAT}`,
													"User-Agent": "Cloudflare-Worker",
												},
												body: JSON.stringify({
													event_type: eventType,
													client_payload: { object_key: objectKey },
												}),
											},
										).catch((e) => console.error("Webhook Dispatch Error:", e)),
									);
								}
							}
						}
					}
				}
				return jsonResponse({ success: true });
			} catch (err) {
				// Must return 200 immediately to B2 even on JSON parse errors to prevent retries
				return jsonResponse({ error: err.message }, 200);
			}
		}

		// ── Update Firestore Video URL (Triggered from GitHub Actions) ──────────────
		if (request.method === "POST" && pathname === "/api/update-video-url") {
			try {
				const authHeader = request.headers.get("Authorization");
				if (!authHeader || authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
					return new Response("Unauthorized", { status: 401 });
				}

				const { oldUrl, newUrl } = await request.json();
				if (!oldUrl || !newUrl)
					return jsonResponse({ error: "oldUrl and newUrl required" }, 400);

				if (!env.FIREBASE_SERVICE_ACCOUNT) {
					return jsonResponse(
						{ error: "FIREBASE_SERVICE_ACCOUNT not set" },
						500,
					);
				}

				const accessToken = await getGoogleAccessToken(env);
				const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

				// Search Firestore for the video with oldUrl using RunQuery
				const projectId = serviceAccount.project_id;
				const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
				const queryRes = await fetch(queryUrl, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						structuredQuery: {
							from: [{ collectionId: "videos" }],
							where: {
								fieldFilter: {
									field: { fieldPath: "url" },
									op: "EQUAL",
									value: { stringValue: oldUrl },
								},
							},
							limit: 1,
						},
					}),
				});

				const queryData = await queryRes.json();

				// runQuery returns an array. If no documents found, it returns [{}] or an array with skipped results.
				const doc =
					queryData.length > 0 && queryData[0].document
						? queryData[0].document
						: null;
				if (!doc) {
					return jsonResponse({
						success: false,
						message: "Video not found in Firestore for this URL",
					});
				}

				const documentName = doc.name; // e.g. projects/cpbs-admin/databases/(default)/documents/videos/DOC_ID

				// Patch the document
				const patchUrl = `https://firestore.googleapis.com/v1/${documentName}?updateMask.fieldPaths=url`;
				const patchRes = await fetch(patchUrl, {
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						fields: { url: { stringValue: newUrl } },
					}),
				});

				if (!patchRes.ok) {
					const errText = await patchRes.text();
					throw new Error(
						`Firestore Patch failed: ${patchRes.status} ${errText}`,
					);
				}

				return jsonResponse({
					success: true,
					updatedDocument: documentName,
					newUrl,
				});
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── 2. Create multipart upload — uses aws4fetch (no DOMParser needed) ──────
		if (request.method === "POST" && pathname === "/api/create-multipart") {
			try {
				const { fileName, contentType } = await request.json();
				if (!fileName) return jsonResponse({ error: "fileName required" }, 400);

				try {
					ensureUploadAllowed(fileName);
				} catch (err) {
					return jsonResponse({ error: err.message }, 403);
				}

				const objectKey = makeKey(fileName);
				const aws = makeAws(env);

				// POST ?uploads — each path segment encoded separately (NOT the slash)
				const url = b2S3Url(env, objectKey, "?uploads");
				const signed = await aws.sign(
					new Request(url, {
						method: "POST",
						headers: {
							"Content-Type": contentType || "application/octet-stream",
						},
					}),
				);

				const res = await fetch(signed);
				const xml = await res.text();
				if (!res.ok) return jsonResponse({ error: xml }, 500);

				// Parse UploadId from XML: <UploadId>xxx</UploadId>
				const match = xml.match(/<UploadId>(.*?)<\/UploadId>/);
				if (!match)
					return jsonResponse({ error: "UploadId not found", xml }, 500);

				return jsonResponse({
					uploadId: match[1],
					objectKey,
					downloadUrl: cdnUrl(objectKey),
				});
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── 3. Presign URL for each part ───────────────────────────────────────────
		if (request.method === "POST" && pathname === "/api/presign-part") {
			try {
				const { objectKey, uploadId, partNumber } = await request.json();
				if (!objectKey || !uploadId || !partNumber) {
					return jsonResponse(
						{ error: "objectKey, uploadId, partNumber required" },
						400,
					);
				}

				try {
					ensureUploadAllowed(objectKey);
				} catch (err) {
					return jsonResponse({ error: err.message }, 403);
				}

				const s3 = makeS3(env);
				const signedUrl = await getSignedUrl(
					s3,
					new UploadPartCommand({
						Bucket: env.B2_BUCKET,
						Key: objectKey,
						UploadId: uploadId,
						PartNumber: partNumber,
					}),
					{ expiresIn: 3600 },
				);

				return jsonResponse({ signedUrl });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── 4. Complete multipart upload — uses aws4fetch ──────────────────────────
		if (request.method === "POST" && pathname === "/api/complete-multipart") {
			try {
				const { objectKey, uploadId, parts } = await request.json();
				if (!objectKey || !uploadId || !parts) {
					return jsonResponse(
						{ error: "objectKey, uploadId, parts required" },
						400,
					);
				}

				try {
					ensureUploadAllowed(objectKey);
				} catch (err) {
					return jsonResponse({ error: err.message }, 403);
				}

				const aws = makeAws(env);

				// Build XML body — ETag includes quotes as returned by B2
				const partsXml = parts
					.map(
						(p) =>
							`<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`,
					)
					.join("");
				const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

				const url = b2S3Url(
					env,
					objectKey,
					`?uploadId=${encodeURIComponent(uploadId)}`,
				);
				const signed = await aws.sign(
					new Request(url, {
						method: "POST",
						headers: { "Content-Type": "application/xml" },
						body,
					}),
				);

				const res = await fetch(signed);
				const xml = await res.text();
				if (!res.ok) return jsonResponse({ error: xml }, 500);

				return jsonResponse({ downloadUrl: cdnUrl(objectKey) });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── 5. Abort multipart (cleanup on error) ─────────────────────────────────
		if (request.method === "POST" && pathname === "/api/abort-multipart") {
			try {
				const { objectKey, uploadId } = await request.json();
				if (!objectKey || !uploadId)
					return jsonResponse({ error: "objectKey, uploadId required" }, 400);

				try {
					ensureUploadAllowed(objectKey);
				} catch (err) {
					return jsonResponse({ error: err.message }, 403);
				}

				const aws = makeAws(env);
				const url = b2S3Url(
					env,
					objectKey,
					`?uploadId=${encodeURIComponent(uploadId)}`,
				);
				const signed = await aws.sign(new Request(url, { method: "DELETE" }));
				const res = await fetch(signed);
				if (!res.ok) {
					const xml = await res.text();
					return jsonResponse({ error: xml }, 500);
				}
				return jsonResponse({ success: true });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── 6. List Files ────────────────────────────────────────────────────────
		if (request.method === "GET" && pathname === "/api/list-files") {
			try {
				ensureAdminOnly();
				const aws = makeAws(env);
				const files = [];
				let isTruncated = true;
				let continuationToken = null;

				while (isTruncated) {
					let url = b2S3Url(env, "", "?list-type=2");
					if (continuationToken) {
						url += `&continuation-token=${encodeURIComponent(continuationToken)}`;
					}

					const signed = await aws.sign(new Request(url, { method: "GET" }));
					const res = await fetch(signed);
					const xml = await res.text();

					if (!res.ok) return jsonResponse({ error: xml }, 500);

					const regex =
						/<Contents>.*?<Key>(.*?)<\/Key>.*?<LastModified>(.*?)<\/LastModified>.*?<Size>(.*?)<\/Size>.*?<\/Contents>/gs;
					let match;
					while ((match = regex.exec(xml)) !== null) {
						files.push({
							key: match[1],
							lastModified: match[2],
							size: parseInt(match[3], 10),
						});
					}

					const truncatedMatch = /<IsTruncated>(.*?)<\/IsTruncated>/.exec(xml);
					isTruncated = truncatedMatch && truncatedMatch[1] === "true";

					if (isTruncated) {
						const tokenMatch =
							/<NextContinuationToken>(.*?)<\/NextContinuationToken>/.exec(xml);
						continuationToken = tokenMatch ? tokenMatch[1] : null;
						if (!continuationToken) isTruncated = false; // Safety break
					}
				}

				return jsonResponse({ files });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── 7. Delete File ───────────────────────────────────────────────────────
		if (request.method === "POST" && pathname === "/api/delete-file") {
			try {
				ensureAdminOnly();
				const { objectKey } = await request.json();
				if (!objectKey)
					return jsonResponse({ error: "objectKey required" }, 400);

				const aws = makeAws(env);
				const url = b2S3Url(env, objectKey);
				const signed = await aws.sign(new Request(url, { method: "DELETE" }));
				const res = await fetch(signed);
				if (!res.ok) {
					const xml = await res.text();
					return jsonResponse({ error: xml }, 500);
				}
				return jsonResponse({ success: true });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── 8. Rename File ───────────────────────────────────────────────────────
		if (request.method === "POST" && pathname === "/api/rename-file") {
			try {
				ensureAdminOnly();
				const { oldKey, newKey } = await request.json();
				if (!oldKey || !newKey)
					return jsonResponse({ error: "oldKey and newKey required" }, 400);

				const aws = makeAws(env);
				const copyUrl = b2S3Url(env, newKey);
				const copyReq = new Request(copyUrl, {
					method: "PUT",
					headers: {
						"x-amz-copy-source": `/${env.B2_BUCKET}/${encodeKey(oldKey)}`,
					},
				});
				const signedCopy = await aws.sign(copyReq);
				const copyRes = await fetch(signedCopy);
				if (!copyRes.ok) {
					const xml = await copyRes.text();
					return jsonResponse({ error: xml }, 500);
				}

				const delUrl = b2S3Url(env, oldKey);
				const signedDel = await aws.sign(
					new Request(delUrl, { method: "DELETE" }),
				);
				const delRes = await fetch(signedDel);
				if (!delRes.ok) {
					const xml = await delRes.text();
					return jsonResponse({
						success: true,
						warning: `Copied successfully but failed to delete original: ${xml}`,
					});
				}

				return jsonResponse({ success: true });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ── CDN Proxy: Serve B2 files ──────────────────────────────────────────────
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		const aws = makeAws(env);
		const reqUrl = url; // already declared above

		let objectKey = decodeURIComponent(reqUrl.pathname);
		if (objectKey.startsWith(`/file/${env.B2_BUCKET}/`)) {
			objectKey = objectKey.replace(`/file/${env.B2_BUCKET}/`, "");
		} else if (objectKey.startsWith("/")) {
			objectKey = objectKey.substring(1);
		}

		if (!objectKey) return new Response("Forbidden", { status: 403 });

		const s3Url = new URL(
			`https://${env.B2_BUCKET}.s3.${env.B2_REGION}.backblazeb2.com/${encodeKey(objectKey)}`,
		);
		s3Url.search = reqUrl.search;

		// Sign the request without the Range header to keep the signature consistent
		const signedRequest = await aws.sign(
			new Request(s3Url, { method: request.method }),
		);

		// Add the Range header to the final fetch request so B2 can process partial content
		const fetchHeaders = new Headers(signedRequest.headers);
		if (request.headers.has("range"))
			fetchHeaders.set("range", request.headers.get("range"));

		// Fetch directly without 'cf: { cacheEverything: true }' to ensure Range requests stream instantly
		const response = await fetch(signedRequest.url, {
			method: signedRequest.method,
			headers: fetchHeaders,
		});

		if (!response.ok) {
			const text = await response.text();
			// Remove content-length from headers so it doesn't truncate our debug string
			const errHeaders = new Headers(response.headers);
			errHeaders.delete("content-length");
			return new Response(
				`Error ${response.status}: ${text}\nS3 URL: ${signedRequest.url}\nObject Key: ${objectKey}`,
				{
					status: response.status,
					headers: errHeaders,
				},
			);
		}

		const newResponse = new Response(response.body, response);
		newResponse.headers.set(
			"Cache-Control",
			"public, max-age=31536000, immutable",
		);
		newResponse.headers.set("Access-Control-Allow-Origin", "*");
		newResponse.headers.set(
			"Access-Control-Allow-Methods",
			"GET, HEAD, OPTIONS",
		);
		newResponse.headers.set("Access-Control-Allow-Headers", "Range");
		newResponse.headers.set(
			"Access-Control-Expose-Headers",
			"Accept-Ranges, Content-Encoding, Content-Length, Content-Range",
		);
		newResponse.headers.set("Accept-Ranges", "bytes");

		return newResponse;
	},
};

// ── OTA Handler: public, no auth, serves ota-bundles/* from B2 ───────────────
async function handleOtaRequest(request, env) {
	if (request.method === "OPTIONS") {
		return new Response(null, {
			headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" },
		});
	}

	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const url = new URL(request.url);
	let objectKey = decodeURIComponent(url.pathname);
	if (objectKey.startsWith("/")) objectKey = objectKey.substring(1);

	if (!objectKey) return new Response("Not Found", { status: 404 });

	// Only serve ota-bundles/ prefix from this hostname
	if (!objectKey.startsWith("ota-bundles/")) {
		return new Response("Forbidden", { status: 403 });
	}

	const aws = makeAws(env);
	const s3Url = new URL(
		`https://${env.B2_BUCKET}.s3.${env.B2_REGION}.backblazeb2.com/${encodeKey(objectKey)}`,
	);

	// Sign the request without the Range header
	const signedRequest = await aws.sign(
		new Request(s3Url, { method: request.method }),
	);

	// Add the Range header to the final fetch request
	const fetchHeaders = new Headers(signedRequest.headers);
	if (request.headers.has("range"))
		fetchHeaders.set("range", request.headers.get("range"));

	// Fetch directly without cf overrides
	const response = await fetch(signedRequest.url, {
		method: signedRequest.method,
		headers: fetchHeaders,
	});

	if (!response.ok) {
		const text = await response.text();
		return new Response(`Error ${response.status}: ${text}`, {
			status: response.status,
			headers: { "Content-Type": "text/plain" },
		});
	}

	const newResponse = new Response(response.body, response);
	// ZIP bundles: cache for 1 year (immutable per version)
	newResponse.headers.set(
		"Cache-Control",
		"public, max-age=31536000, immutable",
	);
	newResponse.headers.set("Access-Control-Allow-Origin", "*");
	newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
	newResponse.headers.set("Access-Control-Allow-Headers", "Range");
	newResponse.headers.set(
		"Access-Control-Expose-Headers",
		"Accept-Ranges, Content-Encoding, Content-Length, Content-Range",
	);
	newResponse.headers.set("Accept-Ranges", "bytes");

	return newResponse;
}

// ── Audios Handler: public, no auth, serves audio/pdf from B2 ────────────────
const AUDIOS_B2_PREFIX = "Github Backup Files/CPBS-APP-ORIGNAL-PHASE-1";

async function handleAudiosRequest(request, env) {
	if (request.method === "OPTIONS") {
		return new Response(null, {
			headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" },
		});
	}

	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const url = new URL(request.url);
	let pathSegment = decodeURIComponent(url.pathname);
	if (pathSegment.startsWith("/")) pathSegment = pathSegment.substring(1);

	if (!pathSegment) return new Response("Not Found", { status: 404 });

	// Determine the correct objectKey
	let objectKey;
	if (
		pathSegment.startsWith("Local Data Uploaded from App/audios/") ||
		pathSegment.startsWith(AUDIOS_B2_PREFIX)
	) {
		objectKey = pathSegment;
	} else {
		// Prepend the B2 prefix path for legacy Github Backup Files
		objectKey = `${AUDIOS_B2_PREFIX}/${pathSegment}`;
	}

	const aws = makeAws(env);
	const s3Url = new URL(
		`https://${env.B2_BUCKET}.s3.${env.B2_REGION}.backblazeb2.com/${encodeKey(objectKey)}`,
	);

	// Sign the request without the Range header
	const signedRequest = await aws.sign(
		new Request(s3Url, { method: request.method }),
	);

	// Add the Range header to the final fetch request
	const fetchHeaders = new Headers(signedRequest.headers);
	if (request.headers.has("range"))
		fetchHeaders.set("range", request.headers.get("range"));

	// Fetch directly without cf overrides for flawless audio streaming
	const response = await fetch(signedRequest.url, {
		method: signedRequest.method,
		headers: fetchHeaders,
	});

	if (!response.ok) {
		const text = await response.text();
		return new Response(`Error ${response.status}: ${text}`, {
			status: response.status,
			headers: { "Content-Type": "text/plain" },
		});
	}

	const newResponse = new Response(response.body, response);
	newResponse.headers.set(
		"Cache-Control",
		"public, max-age=31536000, immutable",
	);
	newResponse.headers.set("Access-Control-Allow-Origin", "*");
	newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
	newResponse.headers.set("Access-Control-Allow-Headers", "Range");
	newResponse.headers.set(
		"Access-Control-Expose-Headers",
		"Accept-Ranges, Content-Encoding, Content-Length, Content-Range",
	);
	newResponse.headers.set("Accept-Ranges", "bytes");

	if (url.searchParams.get("download") === "1") {
		const filename = pathSegment.split("/").pop() || "file.pdf";
		newResponse.headers.set(
			"Content-Disposition",
			`attachment; filename="${filename}"`,
		);
	}

	return newResponse;
}

// ── Images Handler: public, no auth, serves image assets directly from B2 ────
// Path format: /dailyquotes_1/243.31.AUG.JPG  → B2 key: dailyquotes_1/243.31.AUG.JPG
// No prefix prepended — images are stored at B2 root level.
// Cache: 24h (images may change daily, unlike audio which is immutable)
async function handleImagesRequest(request, env) {
	if (request.method === "OPTIONS") {
		return new Response(null, {
			headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" },
		});
	}

	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const url = new URL(request.url);
	let pathSegment = decodeURIComponent(url.pathname);
	if (pathSegment.startsWith("/")) pathSegment = pathSegment.substring(1);

	if (!pathSegment) return new Response("Not Found", { status: 404 });

	// Images are stored under the same B2 prefix as audios
	// e.g. dailyquotes_1/243.31.AUG.JPG → Github Backup Files/CPBS-APP-ORIGNAL-PHASE-1/dailyquotes_1/243.31.AUG.JPG
	let objectKey;
	if (
		pathSegment.startsWith("Local Data Uploaded from App/audios/") ||
		pathSegment.startsWith(AUDIOS_B2_PREFIX)
	) {
		objectKey = pathSegment; // already has full path
	} else {
		objectKey = `${AUDIOS_B2_PREFIX}/${pathSegment}`;
	}

	const aws = makeAws(env);
	const s3Url = new URL(
		`https://${env.B2_BUCKET}.s3.${env.B2_REGION}.backblazeb2.com/${encodeKey(objectKey)}`,
	);

	const signedRequest = await aws.sign(
		new Request(s3Url, { method: request.method }),
	);

	const fetchHeaders = new Headers(signedRequest.headers);
	if (request.headers.has("range"))
		fetchHeaders.set("range", request.headers.get("range"));

	const response = await fetch(signedRequest.url, {
		method: signedRequest.method,
		headers: fetchHeaders,
	});

	if (!response.ok) {
		const text = await response.text();
		return new Response(`Error ${response.status}: ${text}`, {
			status: response.status,
			headers: { "Content-Type": "text/plain" },
		});
	}

	const newResponse = new Response(response.body, response);
	// 24h cache — quote images are date-based, not permanently immutable
	newResponse.headers.set("Cache-Control", "public, max-age=86400");
	newResponse.headers.set("Access-Control-Allow-Origin", "*");
	newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
	newResponse.headers.set("Access-Control-Allow-Headers", "Range");
	newResponse.headers.set(
		"Access-Control-Expose-Headers",
		"Accept-Ranges, Content-Encoding, Content-Length, Content-Range",
	);
	newResponse.headers.set("Accept-Ranges", "bytes");
	// Serve images inline (not as download attachment)
	newResponse.headers.set("Content-Disposition", "inline");

	return newResponse;
}

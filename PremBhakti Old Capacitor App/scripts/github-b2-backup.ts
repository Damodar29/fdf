import {
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import dotenv from "dotenv";
import pLimit from "p-limit";

dotenv.config();

// Configuration
const REPOSITORIES = [
	"chaitanyaprembhakti/CPBS-DAILY",
	"chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1",
];

const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_ENDPOINT =
	process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com";
const B2_BUCKET = process.env.B2_BUCKET;
const GITHUB_TOKEN = process.env.GITHUB_PAT_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET) {
	console.error("Missing required B2 environment variables.");
	process.exit(1);
}

const s3Client = new S3Client({
	region: process.env.B2_REGION || "us-east-005",
	endpoint: B2_ENDPOINT,
	credentials: {
		accessKeyId: B2_KEY_ID,
		secretAccessKey: B2_APP_KEY,
	},
	forcePathStyle: true,
	maxAttempts: 5, // Built-in AWS SDK retries
});

// Helper to fetch all releases
async function fetchAllReleases(repo: string) {
	const allReleases: any[] = [];
	let page = 1;
	while (true) {
		console.log(`Fetching releases for ${repo} (Page ${page})...`);
		const headers: any = { Accept: "application/vnd.github.v3+json" };
		if (GITHUB_TOKEN) {
			headers.Authorization = `token ${GITHUB_TOKEN}`;
		}

		// Wrap in retry logic for fetch
		let data = [];
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const res = await fetch(
					`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`,
					{ headers },
				);
				if (!res.ok)
					throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
				data = await res.json();
				break;
			} catch (err: any) {
				if (attempt === 3) throw err;
				console.log(
					`[RETRY] Fetching releases failed, retrying attempt ${attempt + 1}...`,
				);
				await new Promise((r) => setTimeout(r, 2000 * attempt));
			}
		}

		if (data.length === 0) break;
		allReleases.push(...data);
		page++;
	}
	return allReleases;
}

function sanitize(name: string) {
	return name.replace(/[^a-zA-Z0-9.\-_ ]/g, "_").trim();
}

async function sendNotification(message: string) {
	if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
		try {
			await fetch(
				`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
				},
			);
		} catch (e) {
			console.error("Telegram notification failed:", e);
		}
	}
}

async function run() {
	console.log("--- Started Advanced GitHub to Backblaze B2 Backup ---");

	let totalUploaded = 0;
	let totalSkipped = 0;
	let totalFailed = 0;

	// Use p-limit to upload exactly 5 files simultaneously
	const limit = pLimit(5);
	const tasks: Promise<void>[] = [];

	for (const repo of REPOSITORIES) {
		const repoName = repo.split("/")[1];
		console.log(`\nProcessing Repository: ${repoName}`);

		const releases = await fetchAllReleases(repo);
		console.log(`Found ${releases.length} releases in ${repoName}.`);

		for (const release of releases) {
			const releaseNameStr = release.name || release.tag_name || "untagged";
			const releaseFolder = sanitize(`${releaseNameStr}_${release.tag_name}`);
			const folderPrefix = `Github Backup Files/${repoName}/${releaseFolder}`;

			// Backup Release Notes (Metadata)
			tasks.push(
				limit(async () => {
					const metadataKey = `${folderPrefix}/metadata.json`;
					const metadata = {
						repo: repoName,
						name: release.name,
						tag_name: release.tag_name,
						published_at: release.published_at,
						author: release.author?.login,
						description: release.body,
					};

					try {
						await s3Client.send(
							new HeadObjectCommand({ Bucket: B2_BUCKET, Key: metadataKey }),
						);
						// Exists, skip
					} catch (err: any) {
						if (
							err.name === "NotFound" ||
							err.$metadata?.httpStatusCode === 404
						) {
							try {
								await s3Client.send(
									new PutObjectCommand({
										Bucket: B2_BUCKET,
										Key: metadataKey,
										Body: JSON.stringify(metadata, null, 2),
										ContentType: "application/json",
									}),
								);
								console.log(`[METADATA] Uploaded: ${metadataKey}`);
							} catch (e) {
								console.error(
									`[ERROR] Failed to upload metadata for ${releaseNameStr}`,
									e,
								);
							}
						}
					}
				}),
			);

			// Backup Assets
			for (const asset of release.assets) {
				const destinationKey = `${folderPrefix}/${asset.name}`;

				tasks.push(
					limit(async () => {
						// Check if file exists and matches size
						try {
							const head = await s3Client.send(
								new HeadObjectCommand({
									Bucket: B2_BUCKET,
									Key: destinationKey,
								}),
							);

							if (head.ContentLength === asset.size) {
								console.log(
									`[SKIPPED] Already in B2 (Size Match): ${destinationKey}`,
								);
								totalSkipped++;
								return;
							} else {
								console.log(
									`[SIZE MISMATCH] B2: ${head.ContentLength} | GitHub: ${asset.size}. Re-uploading ${destinationKey}...`,
								);
							}
						} catch (err: any) {
							if (
								err.name !== "NotFound" &&
								err.$metadata?.httpStatusCode !== 404
							) {
								console.error(
									`Error checking HeadObject for ${destinationKey}:`,
									err,
								);
								totalFailed++;
								return;
							}
						}

						// Download & Upload with 3 Retries
						for (let attempt = 1; attempt <= 3; attempt++) {
							try {
								console.log(
									`[UPLOADING] ${destinationKey} (${(asset.size / (1024 * 1024)).toFixed(2)} MB) - Attempt ${attempt}`,
								);
								const downloadRes = await fetch(asset.browser_download_url);
								if (!downloadRes.ok || !downloadRes.body) {
									throw new Error(
										`Failed to download ${asset.browser_download_url}: ${downloadRes.status}`,
									);
								}

								const upload = new Upload({
									client: s3Client,
									params: {
										Bucket: B2_BUCKET,
										Key: destinationKey,
										Body: downloadRes.body,
										ContentType: asset.content_type,
									},
								});

								await upload.done();
								console.log(`[SUCCESS] Uploaded: ${destinationKey}`);
								totalUploaded++;
								break; // Success, exit retry loop
							} catch (e: any) {
								if (attempt === 3) {
									console.error(
										`[ERROR] Failed to upload ${destinationKey} after 3 attempts:`,
										e.message,
									);
									totalFailed++;
								} else {
									console.log(
										`[RETRY] Upload failed for ${destinationKey}, retrying in ${attempt * 3} seconds...`,
									);
									await new Promise((r) => setTimeout(r, 3000 * attempt));
								}
							}
						}
					}),
				);
			}
		}
	}

	// Wait for all queued tasks to finish
	await Promise.all(tasks);

	console.log("\n--- Backup Completed ---");
	console.log(`Total Uploaded: ${totalUploaded}`);
	console.log(`Total Skipped: ${totalSkipped}`);
	console.log(`Total Failed: ${totalFailed}`);

	const notifyMsg =
		`🚀 **Advanced GitHub Backup Complete**\n` +
		`✅ Uploaded: ${totalUploaded} files\n` +
		`⏭️ Skipped: ${totalSkipped} files\n` +
		`❌ Failed: ${totalFailed} files`;

	await sendNotification(notifyMsg);
}

run().catch(console.error);

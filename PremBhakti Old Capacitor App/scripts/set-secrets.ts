import dotenv from "dotenv";
import sodium from "libsodium-wrappers";

dotenv.config();

const REPO_OWNER = "chaitanyaprembhakti";
const REPO_NAME = "cbps-admin";

const secretsToSet = {
	B2_KEY_ID: process.env.B2_KEY_ID,
	B2_APP_KEY: process.env.B2_APP_KEY,
	B2_BUCKET: process.env.B2_BUCKET,
	B2_ENDPOINT:
		process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
	PAT_TOKEN: process.env.GITHUB_PAT_TOKEN,
	TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
	TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
};

async function getPublicKey(token: string) {
	const res = await fetch(
		`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/secrets/public-key`,
		{
			headers: {
				Authorization: `token ${token}`,
				Accept: "application/vnd.github.v3+json",
			},
		},
	);
	if (!res.ok) throw new Error(`Failed to get public key: ${res.statusText}`);
	return await res.json();
}

async function setSecret(
	keyName: string,
	keyValue: string,
	publicKeyParams: any,
	token: string,
) {
	await sodium.ready;
	const binkey = sodium.from_base64(
		publicKeyParams.key,
		sodium.base64_variants.ORIGINAL,
	);
	const binsec = sodium.from_string(keyValue);
	const encBytes = sodium.crypto_box_seal(binsec, binkey);
	const encryptedValue = sodium.to_base64(
		encBytes,
		sodium.base64_variants.ORIGINAL,
	);

	const res = await fetch(
		`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/secrets/${keyName}`,
		{
			method: "PUT",
			headers: {
				Authorization: `token ${token}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				encrypted_value: encryptedValue,
				key_id: publicKeyParams.key_id,
			}),
		},
	);
	if (!res.ok)
		throw new Error(`Failed to set secret ${keyName}: ${res.statusText}`);
	console.log(`✅ Successfully set secret: ${keyName}`);
}

async function run() {
	try {
		const token = process.env.GITHUB_PAT_TOKEN;
		if (!token) throw new Error("No GITHUB_PAT_TOKEN in .env");
		console.log(`Fetching public key for ${REPO_OWNER}/${REPO_NAME}...`);
		const publicKeyParams = await getPublicKey(token);

		for (const [key, value] of Object.entries(secretsToSet)) {
			if (value) {
				console.log(`Setting secret: ${key}...`);
				await setSecret(key, value, publicKeyParams, token);
			}
		}
		console.log("All secrets have been successfully added to GitHub Actions!");
	} catch (e) {
		console.error(e);
	}
}
run();

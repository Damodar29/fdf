import {
	doc,
	getDoc,
	getDocFromServer,
	increment,
	setDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { uploadFileViaWorker } from "../../utils/uploadManager";

type ReleaseInfo = { tag: string; id: number; count: number };

/* A batch of photos uploads in parallel. Without this, every photo of the first
   batch (or the batch that fills a release) saw "no release" and created its
   own, scattering one upload across several releases. Concurrent callers for
   the same mandal + type now share one lookup/creation. */
const releaseLocks = new Map<string, Promise<ReleaseInfo>>();
const ensureRelease = (
	key: string,
	resolve: () => Promise<ReleaseInfo>,
): Promise<ReleaseInfo> => {
	const pending = releaseLocks.get(key);
	if (pending) return pending;
	const p = resolve().finally(() => {
		if (releaseLocks.get(key) === p) releaseLocks.delete(key);
	});
	releaseLocks.set(key, p);
	return p;
};

export const uploadToGithubRelease = async (
	file: File,
	mandalId: string,
	customFileName?: string,
	type: "darshan" | "activity" = "darshan",
	uploadOptions?: { totalFiles?: number; currentIndex?: number },
): Promise<{ url: string; releaseId: number }> => {
	// 1. Get GitHub config (token, owner, repo)
	const configDoc = await getDoc(doc(db, "damtoken", "github"));

	let token = "";
	let owner = "chaitanyaprembhakti";
	let repo = "CPBS-DAILY";

	if (configDoc.exists()) {
		const configData = configDoc.data();
		token = configData.token || "";
		owner = configData.owner || owner;
		repo = configData.repo || repo;
	}

	if (!token) {
		throw new Error(
			"GitHub token not found in Firebase (damtoken/github). Please configure it first.",
		);
	}

	const mandalDocRef = doc(db, "mandals", mandalId);
	const releaseKey = type === "activity" ? "activityRelease" : "githubRelease";
	const releaseInfo = await ensureRelease(
		`${mandalId}:${releaseKey}`,
		async () => {
			// 2. Get Mandal's current release info from the 'mandals' collection
			const mandalDoc = await getDocFromServer(mandalDocRef);
			const current = mandalDoc.exists() ? mandalDoc.data()[releaseKey] : null;
			if (current?.id) {
				// The stored count drifted far from reality (lost updates, deletes,
				// Gallery UI edits), so the real number of files is read from GitHub.
				const relRes = await fetch(
					`https://api.github.com/repos/${owner}/${repo}/releases/${current.id}`,
					{
						headers: {
							Authorization: `token ${token}`,
							Accept: "application/vnd.github.v3+json",
						},
						cache: "no-store",
					},
				);
				if (relRes.ok) {
					const rel = await relRes.json();
					const count = Array.isArray(rel.assets) ? rel.assets.length : 0;
					// GitHub allows up to 1000 files per release (docs: "About
					// releases"); roll over with headroom for a batch in flight.
					if (count < 900) {
						const info = { ...current, count };
						if (count !== current.count) {
							await setDoc(
								mandalDocRef,
								{ [releaseKey]: { count } },
								{ merge: true },
							);
						}
						return info;
					}
				} else if (relRes.status !== 404) {
					// Can't tell — keep using the saved release rather than failing.
					if (current.count < 900) return current;
				}
				// 404 (release deleted) or full: fall through and create a new one.
			}
			// 3. No release yet, or it's full: create one and save it right away,
			// so the other photos of this batch upload into the same release.
			const created = await createRelease();
			await setDoc(mandalDocRef, { [releaseKey]: created }, { merge: true });
			return created;
		},
	);

	async function createRelease() {
		// Generate readable date and time for the tag
		const now = new Date();
		const formattedDate =
			now.getFullYear() +
			"-" +
			String(now.getMonth() + 1).padStart(2, "0") +
			"-" +
			String(now.getDate()).padStart(2, "0") +
			"-" +
			String(now.getHours()).padStart(2, "0") +
			"-" +
			String(now.getMinutes()).padStart(2, "0") +
			"-" +
			String(now.getSeconds()).padStart(2, "0");

		const newTag =
			type === "activity"
				? `activity-${mandalId}-${formattedDate}`
				: `${mandalId}-${formattedDate}`;
		const name =
			type === "activity"
				? `Activity Release for ${mandalId} (${formattedDate})`
				: `Release for ${mandalId} (${formattedDate})`;
		const body =
			type === "activity"
				? `Auto-generated activity release for ${mandalId} images.`
				: `Auto-generated release for ${mandalId} gallery images.`;

		const createRes = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/releases`,
			{
				method: "POST",
				headers: {
					Authorization: `token ${token}`,
					Accept: "application/vnd.github.v3+json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					tag_name: newTag,
					name: name,
					body: body,
				}),
			},
		);

		if (!createRes.ok) {
			const err = await createRes.text();
			throw new Error(`Failed to create GitHub release: ${err}`);
		}

		const releaseData = await createRes.json();
		return { tag: newTag, id: releaseData.id as number, count: 0 };
	}

	const ext = file.name.split(".").pop() || "jpg";
	const baseFileName = customFileName || `${mandalId}_${Date.now()}`;
	let fileName = `${baseFileName}.${ext}`;

	// 4. Direct upload to GitHub via Cloudflare Worker proxy with retry logic for existing names
	let downloadUrl = "";
	let success = false;
	let retryCounter = 1;

	while (!success) {
		try {
			downloadUrl = await uploadFileViaWorker(
				file,
				releaseInfo.id,
				token,
				fileName,
				uploadOptions,
			);
			success = true;
		} catch (err: any) {
			if (err.message?.includes("already_exists")) {
				// If file name already exists on GitHub, append counter and retry
				fileName = `${baseFileName}-${retryCounter}.${ext}`;
				retryCounter++;
			} else {
				throw err;
			}
		}
	}

	// 5. Update count in Firebase (in the mandal's document). increment(), since
	// a batch uploads in parallel and "read count, write count + 1" lost updates.
	await setDoc(
		mandalDocRef,
		{ [releaseKey]: { count: increment(1) } },
		{ merge: true },
	);

	return {
		url: downloadUrl,
		releaseId: releaseInfo.id,
	};
};

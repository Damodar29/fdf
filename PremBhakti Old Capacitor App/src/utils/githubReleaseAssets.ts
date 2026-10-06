import { doc, getDocFromServer } from "firebase/firestore";
import { db } from "../../services/firebase";

/**
 * Deleting a mandal photo's file from GitHub Releases.
 *
 * The upload worker only returns the asset's `browser_download_url`, so almost
 * every gallery entry in `mandals/{id}.gallery` has a made-up `gal-…` id rather
 * than the real GitHub asset id. Deleting by that id always 404'd: the file
 * stayed in the release, the admin panel's GitHub sync then brought the "deleted"
 * photo straight back, and the app fell back to it whenever a mandal's database
 * list was empty. So the asset is resolved from the URL (tag + file name) here.
 */

export type GithubAssetDeleteResult = "deleted" | "missing" | "skipped";

const DOWNLOAD_URL =
	/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/([^/?#]+)/;

const getGithubToken = async (): Promise<string> => {
	const snap = await getDocFromServer(doc(db, "damtoken", "github"));
	const token = snap.exists() ? String(snap.data().token || "").trim() : "";
	if (!token) throw new Error("GitHub token not found (damtoken/github)");
	return token;
};

const ghHeaders = (token: string) => ({
	Authorization: `token ${token}`,
	Accept: "application/vnd.github.v3+json",
});

/**
 * Deletes the release asset behind a gallery item.
 *
 * - "deleted": the file was removed.
 * - "missing": it was already gone (safe to drop the database entry).
 * - "skipped": the URL isn't a GitHub release file (e.g. a B2 URL).
 *
 * Throws when GitHub refuses or can't be reached, so the caller can keep the
 * database entry instead of leaving a file that would resurface later.
 */
export const deleteGithubAssetForItem = async (item: {
	id?: string | number;
	url?: string;
}): Promise<GithubAssetDeleteResult> => {
	const match = item.url?.match(DOWNLOAD_URL);
	if (!match) return "skipped";
	const [, owner, repo, rawTag, rawFile] = match;
	const tag = decodeURIComponent(rawTag);
	const fileName = decodeURIComponent(rawFile);
	const token = await getGithubToken();

	// Always resolved from the URL: the stored id is usually `gal-…`, and even a
	// numeric one is only trusted if it belongs to this very file.
	const relRes = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
		{ headers: ghHeaders(token), cache: "no-store" },
	);
	if (relRes.status === 404) return "missing";
	if (!relRes.ok)
		throw new Error(`GitHub release lookup failed (${relRes.status})`);
	const release = await relRes.json();
	const asset = (release.assets || []).find(
		(a: any) => a.browser_download_url === item.url || a.name === fileName,
	);
	if (!asset) return "missing";

	const delRes = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.id}`,
		{ method: "DELETE", headers: ghHeaders(token) },
	);
	if (delRes.status === 404) return "missing";
	if (!delRes.ok) throw new Error(`GitHub delete failed (${delRes.status})`);
	return "deleted";
};

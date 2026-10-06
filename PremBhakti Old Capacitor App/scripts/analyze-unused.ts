import fs from "node:fs";

// Firebase Config mapping (to convert URL paths)
const REPOSITORIES = [
	"chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1",
	"chaitanyaprembhakti/CPBS-DAILY",
];

async function fetchAllReleases(repo: string) {
	let page = 1;
	const allReleases: any[] = [];
	while (true) {
		const res = await fetch(
			`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`,
		);
		const data = await res.json();
		if (data.length === 0) break;
		allReleases.push(...data);
		page++;
	}
	return allReleases;
}

const fetchAppBundle = async (bundlePath: string) => {
	const raw = fs.readFileSync("storage_files.json", "utf-8");
	const storageFiles = JSON.parse(raw);
	if (!storageFiles.includes(bundlePath)) {
		return null;
	}
	const token =
		process.env.VITE_FIREBASE_STORAGE_BUCKET || "cbps-1f3a2.appspot.com";
	const url = `https://firebasestorage.googleapis.com/v0/b/${token}/o/${encodeURIComponent(bundlePath)}?alt=media`;
	const res = await fetch(url);
	if (!res.ok) return null;
	return await res.json();
};

const run = async () => {
	try {
		const _storageFiles = JSON.parse(
			fs.readFileSync("storage_files.json", "utf-8"),
		);

		// 1. Fetch GitHub Assets
		const allGithubAssets = [];
		for (const repo of REPOSITORIES) {
			console.log(`Fetching releases for ${repo}...`);
			const releases = await fetchAllReleases(repo);
			for (const release of releases) {
				for (const asset of release.assets) {
					allGithubAssets.push({
						repo,
						releaseId: release.id,
						releaseName: release.name || release.tag_name,
						tagName: release.tag_name,
						assetName: asset.name,
						assetUrl: asset.browser_download_url,
						size: asset.size,
					});
				}
			}
		}
		console.log(`Found ${allGithubAssets.length} total assets on GitHub.`);

		// 2. Fetch App Data
		const bhajansBundle = await fetchAppBundle(
			"app-data/bhajandata/bundle.json",
		);
		const lecturesBundle = await fetchAppBundle(
			"app-data/lecturedata/bundle.json",
		);
		const booksBundle = await fetchAppBundle("app-data/bookdata/bundle.json");

		const allUsedUrls: string[] = [];

		const extractUrls = (obj: any) => {
			if (!obj) return;
			if (typeof obj === "string" && obj.includes("github.com")) {
				allUsedUrls.push(obj);
			} else if (typeof obj === "object") {
				for (const key in obj) {
					extractUrls(obj[key]);
				}
			}
		};

		extractUrls(bhajansBundle);
		extractUrls(lecturesBundle);
		extractUrls(booksBundle);

		console.log(`Found ${allUsedUrls.length} github URLs used in bundles.`);

		const unusedAssets = [];
		for (const asset of allGithubAssets) {
			const isUsed = allUsedUrls.some(
				(url) => url.includes(asset.assetName) && url.includes(asset.tagName),
			);
			if (!isUsed) {
				unusedAssets.push(asset);
			}
		}

		console.log(`Found ${unusedAssets.length} unused assets.`);
		fs.writeFileSync(
			"unused_assets_raw.json",
			JSON.stringify(unusedAssets, null, 2),
		);
	} catch (e) {
		console.error(e);
	}
};

run();

const fetchAllAssetsSize = async (repo: string) => {
	let page = 1;
	let totalSize = 0;
	while (true) {
		const res = await fetch(
			`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`,
		);
		const data = await res.json();
		if (data.length === 0) break;

		for (const release of data) {
			for (const asset of release.assets) {
				totalSize += asset.size;
			}
		}
		page++;
	}
	return totalSize;
};

const run = async () => {
	try {
		console.log("Fetching CPBS-DAILY...");
		const size1 = await fetchAllAssetsSize("chaitanyaprembhakti/CPBS-DAILY");

		console.log("Fetching CPBS-APP-ORIGNAL-PHASE-1...");
		const size2 = await fetchAllAssetsSize(
			"chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1",
		);

		const totalBytes = size1 + size2;
		const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

		console.log(`CPBS-DAILY: ${(size1 / (1024 * 1024 * 1024)).toFixed(2)} GB`);
		console.log(
			`CPBS-APP-ORIGNAL-PHASE-1: ${(size2 / (1024 * 1024 * 1024)).toFixed(2)} GB`,
		);
		console.log(`Total Data Size: ${totalGB} GB`);
	} catch (e) {
		console.error(e);
	}
};

run();

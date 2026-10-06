export function normalizeVersion(version: string | null | undefined): string {
	return (version || "").trim().replace(/^v/i, "");
}

export function compareVersions(
	left: string | null | undefined,
	right: string | null | undefined,
): number {
	const leftParts = normalizeVersion(left)
		.split(".")
		.map((part) => Number(part));
	const rightParts = normalizeVersion(right)
		.split(".")
		.map((part) => Number(part));

	for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i += 1) {
		const leftValue = Number.isFinite(leftParts[i]) ? leftParts[i] : 0;
		const rightValue = Number.isFinite(rightParts[i]) ? rightParts[i] : 0;

		if (leftValue < rightValue) return -1;
		if (leftValue > rightValue) return 1;
	}

	return 0;
}

export function isVersionOlder(
	current: string | null | undefined,
	required: string | null | undefined,
): boolean {
	if (!normalizeVersion(current) || !normalizeVersion(required)) return false;
	return compareVersions(current, required) < 0;
}

export const validateAndFormatUrl = (
	url: string | undefined | null,
): string | null => {
	if (!url || url.trim() === "") return ""; // Allow empty strings if the field is optional
	let formattedUrl = url.trim();

	// If it doesn't start with http:// or https://, prepend https://
	if (!/^https?:\/\//i.test(formattedUrl)) {
		formattedUrl = `https://${formattedUrl}`;
	}

	try {
		new URL(formattedUrl);
		return formattedUrl;
	} catch (_e) {
		return null; // Invalid URL
	}
};

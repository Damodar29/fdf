/**
 * Compresses an image file into a square JPEG thumbnail.
 * @param file - The source File to compress
 * @param maxSize - Max width/height of the output in pixels (default 300)
 * @param quality - JPEG quality 0–1 (default 0.7)
 */
export const compressImage = (
	file: File,
	maxSize = 300,
	quality = 0.7,
): Promise<Blob> => {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);
		img.onload = () => {
			URL.revokeObjectURL(objectUrl);
			const canvas = document.createElement("canvas");
			const { width, height } = img;
			const size = Math.min(width, height);
			const sx = (width - size) / 2;
			const sy = (height - size) / 2;
			canvas.width = maxSize;
			canvas.height = maxSize;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);
			canvas.toBlob(
				(blob) => {
					if (blob) resolve(blob);
					else reject(new Error("Compression failed"));
				},
				"image/jpeg",
				quality,
			);
		};
		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error("Image load failed"));
		};
		img.src = objectUrl;
	});
};

import type React from "react";
import { useState } from "react";
import { THUMB, thumbUrl } from "../../utils/imageThumb";

/**
 * The resized copy of `src` at `width` px, and an error handler that switches
 * to the original when the resized copy can't be loaded (proxy down, odd file).
 * For places that can't use <ThumbImg> (CSS backgrounds, SVG <image>).
 */
export function useThumbSrc(src: string | undefined, width: number) {
	const [failedFor, setFailedFor] = useState<string | null>(null);
	if (!src) return { src: "", onError: undefined };
	const shown = failedFor === src ? src : thumbUrl(src, width);
	return {
		src: shown,
		onError: shown !== src ? () => setFailedFor(src) : undefined,
	};
}

/**
 * <img> for a photo drawn small — avatars, chips, list rows. Profile photos
 * are now saved at the size the devotee's camera took them (often several MB),
 * so a 40 px avatar loads a resized copy instead (see utils/imageThumb).
 * Falls back to the original if the resized copy fails, so the worst case is
 * the old behaviour, never a missing photo.
 *
 * `thumbWidth`: `THUMB.small` (default) up to ~64 CSS px, `THUMB.tile` up to
 * ~130 CSS px. Full-screen / zoom views keep using the original URL.
 */
export const ThumbImg: React.FC<
	React.ImgHTMLAttributes<HTMLImageElement> & {
		src: string;
		thumbWidth?: number;
	}
> = ({
	src,
	thumbWidth = THUMB.small,
	alt = "",
	loading = "lazy",
	decoding = "async",
	onError,
	...rest
}) => {
	const thumb = useThumbSrc(src, thumbWidth);
	return (
		<img
			{...rest}
			alt={alt}
			src={thumb.src}
			loading={loading}
			decoding={decoding}
			onError={(e) => {
				if (thumb.onError) thumb.onError();
				else onError?.(e);
			}}
		/>
	);
};

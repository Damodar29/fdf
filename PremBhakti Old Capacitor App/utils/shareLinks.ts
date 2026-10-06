/**
 * Share links (`https://chaitanyaprembhakti.org/v/...`) — one parser for every
 * place that opens them: a link tapped with the app installed (Android App
 * Links hand the app the raw /v/ URL), home banners and notification links.
 *
 * Formats, as created by the share buttons:
 *   /v/video/{videoId}                  VideosScreen
 *   /v/{videoId}                        older video links
 *   /v/folder/{folderId}                VideosScreen folders
 *   /v/mandal/{mandalId}/{videoId}      ActivitiesScreen videos
 *   /v/mandal-photos/{mandalId}/{date}  ActivitiesScreen photos ("all" = no date)
 *
 * The same mapping lives in the share-preview Worker and the serveVideoPreview
 * function (which redirect website visitors to the query form) — keep in sync.
 */

export type ShareTarget =
	| { kind: "video"; videoId: string }
	| { kind: "folder"; folderId: string }
	| { kind: "mandalVideo"; mandalId: string; videoId: string }
	| { kind: "mandalPhotos"; mandalId: string; date: string };

const decode = (part: string) => {
	try {
		return decodeURIComponent(part);
	} catch {
		return part;
	}
};

export function parseSharePath(pathname: string): ShareTarget | null {
	const parts = pathname.split("/").filter(Boolean).map(decode);
	if (parts[0] !== "v") return null;
	if (parts[1] === "video" && parts.length === 3)
		return { kind: "video", videoId: parts[2] };
	if (parts[1] === "folder" && parts.length === 3)
		return { kind: "folder", folderId: parts[2] };
	if (parts[1] === "mandal" && parts.length === 4)
		return { kind: "mandalVideo", mandalId: parts[2], videoId: parts[3] };
	if (parts[1] === "mandal-photos" && parts.length === 4)
		return { kind: "mandalPhotos", mandalId: parts[2], date: parts[3] };
	if (parts.length === 2) return { kind: "video", videoId: parts[1] };
	return null;
}

/** The query parameters the Videos / Activities screens read on open. */
export function shareTargetParams(target: ShareTarget): Record<string, string> {
	switch (target.kind) {
		case "video":
			return { videoId: target.videoId };
		case "folder":
			return { videoFolder: target.folderId };
		case "mandalVideo":
			return { mandalVideoId: target.videoId };
		case "mandalPhotos":
			return {
				mandalPhotos: "true",
				mandalId: target.mandalId,
				mandalDate: target.date,
			};
	}
}

/** Writes the target's parameters into the current URL (no navigation). */
export function applyShareTargetToUrl(target: ShareTarget) {
	const url = new URL(window.location.href);
	for (const [key, value] of Object.entries(shareTargetParams(target)))
		url.searchParams.set(key, value);
	window.history.replaceState(window.history.state, "", url.toString());
}

/** Videos screen for plain videos and folders, Activities for mandal links. */
export const shareTargetScreen = (
	target: ShareTarget,
): "videos" | "activities" =>
	target.kind === "video" || target.kind === "folder" ? "videos" : "activities";

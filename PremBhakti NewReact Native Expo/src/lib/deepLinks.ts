import { Linking } from "react-native";
import { openSiteLink } from "./appNav";

// chaitanyaprembhakti.org links open the app (app.json intentFilters); open
// what they point at, as useDeepLinking did — from a cold start and while running.
let started = false;

export function startDeepLinks() {
	if (started) return;
	started = true;
	Linking.getInitialURL()
		.then((url) => {
			if (url) openSiteLink(url);
		})
		.catch(() => {});
	Linking.addEventListener("url", ({ url }) => {
		openSiteLink(url);
	});
}

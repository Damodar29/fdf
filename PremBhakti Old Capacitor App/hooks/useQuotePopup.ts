import { doc, getDoc } from "firebase/firestore";
import { useEffect } from "react";
import { db } from "../services/firebase";
import { toCdnUrl } from "../utils/cdnUrl";
import { iosGetDoc, shouldUseRestFallback } from "../utils/firebaseRest";
import { safeLocalSet } from "../utils/safeLocalSet";

interface UseQuotePopupOptions {
	showOnboarding: boolean;
	setShowQuotePopup: (url: string | false) => void;
}

export function useQuotePopup({
	showOnboarding,
	setShowQuotePopup,
}: UseQuotePopupOptions) {
	useEffect(() => {
		if (showOnboarding) return;
		const timer = setTimeout(async () => {
			const now = new Date();
			// ✅ FIX: Local date use karo (toISOString() UTC deta hai jo timezone mein galat hoga)
			const localYear = now.getFullYear();
			const localMonth = String(now.getMonth() + 1).padStart(2, "0");
			const localDay = String(now.getDate()).padStart(2, "0");
			const todayStr = `${localYear}-${localMonth}-${localDay}`;
			const currentHour = now.getHours();
			const lastSeenDate = localStorage.getItem("cpbs_quote_last_seen_date");
			const lastSeenAfternoon = localStorage.getItem(
				"cpbs_quote_last_seen_afternoon",
			);
			const shouldShow =
				lastSeenDate !== todayStr ||
				(currentHour >= 16 && lastSeenAfternoon !== todayStr);

			if (shouldShow) {
				try {
					const tokenDoc = shouldUseRestFallback()
						? await iosGetDoc("damtoken/github_public")
						: await getDoc(doc(db, "damtoken", "github_public"));
					const token = tokenDoc.exists()
						? tokenDoc.data()?.token?.trim()
						: null;

					if (!token) return;

					const response = await fetch(
						`https://api.github.com/repos/chaitanyaprembhakti/CPBS-APP-ORIGNAL-PHASE-1/releases/tags/1`,
						{
							headers: {
								Authorization: `token ${token}`,
								Accept: "application/vnd.github.v3+json",
							},
						},
					);

					if (!response.ok) return;
					const data = await response.json();
					const assets = data.assets || [];

					const month = now.getMonth();
					const day = now.getDate();
					const leapYearDate = new Date(2024, month, day);
					const start = new Date(2024, 0, 0);
					const diff = leapYearDate.getTime() - start.getTime();
					const oneDay = 1000 * 60 * 60 * 24;
					const dayOfYear = Math.floor(diff / oneDay);
					const dayOfYearStr = String(dayOfYear).padStart(3, "0");
					const months = [
						"JAN",
						"FEB",
						"MAR",
						"APR",
						"MAY",
						"JUN",
						"JUL",
						"AUG",
						"SEP",
						"OCT",
						"NOV",
						"DEC",
					];
					const monthStr = months[month];

					const baseName = `${dayOfYearStr}.${day}.${monthStr}`;
					const match = assets.find((a: any) => a.name.startsWith(baseName));

					if (match) {
						const url = toCdnUrl(match.browser_download_url);
						const img = new Image();
						img.src = url;
						img.onload = () => {
							setShowQuotePopup(url); // pass resolved URL so popup skips spinner
							safeLocalSet("cpbs_quote_last_seen_date", todayStr);
							if (currentHour >= 16)
								safeLocalSet("cpbs_quote_last_seen_afternoon", todayStr);
						};
						img.onerror = () => {
							console.warn(
								"[QuotePopup] Image failed to load (CDN/network issue):",
								url,
							);
							// Mark as seen today so we don't retry on every app open when CDN is down
							safeLocalSet("cpbs_quote_last_seen_date", todayStr);
						};
					}
				} catch (err) {
					console.error("Failed to preload quote image", err);
				}
			}
		}, 2000);
		return () => clearTimeout(timer);
	}, [showOnboarding, setShowQuotePopup]);
}

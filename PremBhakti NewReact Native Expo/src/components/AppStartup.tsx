import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { openScreen, openWeb } from "../lib/appNav";
import { startAppTracking } from "../lib/appTracking";
import { startDeepLinks } from "../lib/deepLinks";
import { MIGRATED_KEY } from "../lib/migrateOldApp";
import { startNotifications, useNotificationGate } from "../lib/notifications";
import { storage } from "../lib/storage";
import { INTRO_DONE_KEY } from "../screens/WebScreen";
import { startHomeData, useHomeDataStore } from "../store/homeDataStore";
import { ForceUpdateGate } from "./ForceUpdateGate";
import { NotificationsGate } from "./NotificationsGate";
import { QuotePopup } from "./QuotePopup";

// What the Capacitor app's App.tsx starts with, besides the screens: pushes,
// links, the first-run intro, the daily quote popup, the update and
// notification blockers, and the admin panel's usage records.

const QUOTE_DATE_KEY = "cpbs_quote_last_seen_date";
const QUOTE_AFTERNOON_KEY = "cpbs_quote_last_seen_afternoon";

const todayKey = () => {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Resolves once the old app's data has been taken over (OldAppMigration), so its intro flag counts. */
function migrated(): Promise<void> {
	if (storage.getBoolean(MIGRATED_KEY)) return Promise.resolve();
	return new Promise((resolve) => {
		const sub = storage.addOnValueChangedListener((key) => {
			if (key !== MIGRATED_KEY || !storage.getBoolean(MIGRATED_KEY)) return;
			sub.remove();
			resolve();
		});
	});
}

/** WebScreen notes the intro as done when its page finishes it. */
const introDone = () => !!storage.getString(INTRO_DONE_KEY);

export function AppStartup() {
	const [quote, setQuote] = useState<string | null>(null);
	const blocked = useNotificationGate((s) => s.blocked);

	useEffect(() => {
		startNotifications();
		startDeepLinks();
		startAppTracking();
		startHomeData();

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let unsubQuote: (() => void) | undefined;

		// useQuotePopup: once a day, and once more after 4 pm.
		const scheduleQuote = () => {
			timer = setTimeout(() => {
				const today = todayKey();
				const afternoon = new Date().getHours() >= 16;
				const due = storage.getString(QUOTE_DATE_KEY) !== today || (afternoon && storage.getString(QUOTE_AFTERNOON_KEY) !== today);
				if (!due || cancelled) return;
				let tried = false;
				const show = (url: string | null) => {
					if (!url || cancelled || tried) return;
					tried = true;
					unsubQuote?.();
					// Shown once the picture is in; when it cannot load, not again today.
					Image.prefetch(url)
						.then((ok) => {
							storage.set(QUOTE_DATE_KEY, today);
							if (!ok || cancelled) return;
							if (afternoon) storage.set(QUOTE_AFTERNOON_KEY, today);
							setQuote(url);
						})
						.catch(() => storage.set(QUOTE_DATE_KEY, today));
				};
				const now = useHomeDataStore.getState().quoteToday;
				if (now) show(now);
				else unsubQuote = useHomeDataStore.subscribe((s) => show(s.quoteToday));
			}, 2000);
		};

		// OnboardingScreen on a first start, then the quote.
		migrated().then(() => {
			if (cancelled) return;
			if (introDone()) return scheduleQuote();
			openWeb({ onboarding: true });
			const poll = setInterval(() => {
				if (!introDone()) return;
				clearInterval(poll);
				if (!cancelled) scheduleQuote();
			}, 1000);
		});

		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
			unsubQuote?.();
		};
	}, []);

	return (
		<>
			{quote && !blocked ? (
				<QuotePopup
					url={quote}
					onClose={() => setQuote(null)}
					onOpenFull={() => {
						setQuote(null);
						openScreen("quotes");
					}}
				/>
			) : null}
			<ForceUpdateGate />
			<NotificationsGate />
		</>
	);
}

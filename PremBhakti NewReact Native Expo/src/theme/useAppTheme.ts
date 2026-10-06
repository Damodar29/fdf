import { useEffect, useState } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { type BaseTheme, darkTheme, lightTheme } from "./colors";
import { THEME_PALETTES } from "./palettes";

// "auto" is time-of-day based, not OS based — same rule as the Capacitor app's
// SettingsContext (dark from 18:00 to 06:00, rechecked every minute), so
// evening readers get the dark theme regardless of their phone's setting.
function isNightNow() {
	const hour = new Date().getHours();
	return hour >= 18 || hour < 6;
}

export function useIsDarkMode() {
	const themeMode = useSettingsStore((s) => s.themeMode);
	const [night, setNight] = useState(isNightNow);

	useEffect(() => {
		if (themeMode !== "auto") return;
		setNight(isNightNow());
		const interval = setInterval(() => setNight(isNightNow()), 60_000);
		return () => clearInterval(interval);
	}, [themeMode]);

	return themeMode === "auto" ? night : themeMode === "dark";
}

export type AppTheme = BaseTheme & {
	isDark: boolean;
	/** The accent: `text-saffron-600 dark:text-saffron-400` in the web app. */
	primary: string;
	/** The full accent ramp — the web app's `saffron-50…900` classes. */
	p: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
};

export function useAppTheme(): AppTheme {
	const isDark = useIsDarkMode();
	const themeColor = useSettingsStore((s) => s.themeColor);
	const palette = (THEME_PALETTES[themeColor] ?? THEME_PALETTES.cyan) as AppTheme["p"];
	const base = isDark ? darkTheme : lightTheme;

	return {
		...base,
		primary: isDark ? palette[400] : palette[600],
		p: palette,
		isDark,
	};
}

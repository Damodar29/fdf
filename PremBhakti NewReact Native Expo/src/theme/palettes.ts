import type { ThemeColor } from "../types";

// Accent palettes ported from utils/theme.ts (THEME_PALETTES) in the
// Capacitor app, which drove the user-facing color picker in Settings via
// `--color-primary-*` CSS variables. Here they feed useAppTheme() directly.
// Only the 400/600 stops are used natively (dark/light primary), but the full
// ramps are kept so later screens (chips, gradients) can match the web app.
export const THEME_PALETTES: Record<ThemeColor, Record<number, string>> = {
	janmashtami: {
		50: "#EEF3FB", 100: "#D8E3F5", 200: "#B0C5E8", 300: "#7E9BD3", 400: "#4A6FB8",
		500: "#103A8C", 600: "#0B2E6B", 700: "#092555", 800: "#071C40", 900: "#05142E",
	},
	saffron: {
		50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c",
		500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12",
	},
	deepBlue: {
		50: "#eef4ff", 100: "#e0ebff", 200: "#c7d8fe", 300: "#a3c0fc", 400: "#7a9ef8",
		500: "#4f7df3", 600: "#2d58e3", 700: "#2344c3", 800: "#1e389e", 900: "#1e327f",
	},
	red: {
		50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171",
		500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b", 900: "#7f1d1d",
	},
	amber: {
		50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24",
		500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f",
	},
	lime: {
		50: "#f7fee7", 100: "#ecfccb", 200: "#d9f99d", 300: "#bef264", 400: "#a3e635",
		500: "#84cc16", 600: "#65a30d", 700: "#4d7c0f", 800: "#3f6212", 900: "#365314",
	},
	emerald: {
		50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399",
		500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b",
	},
	teal: {
		50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf",
		500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a",
	},
	cyan: {
		50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee",
		500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75", 900: "#164e63",
	},
	sky: {
		50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8",
		500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e",
	},
	blue: {
		50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa",
		500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a",
	},
	indigo: {
		50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8",
		500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81",
	},
	violet: {
		50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa",
		500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95",
	},
	purple: {
		50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe", 400: "#c084fc",
		500: "#a855f7", 600: "#9333ea", 700: "#7e22ce", 800: "#6b21a8", 900: "#581c87",
	},
	fuchsia: {
		50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 300: "#f0abfc", 400: "#e879f9",
		500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f", 900: "#701a75",
	},
	pink: {
		50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6",
		500: "#ec4899", 600: "#db2777", 700: "#be185d", 800: "#9d174d", 900: "#831843",
	},
	rose: {
		50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185",
		500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337",
	},
};

// Same default as the Capacitor app (utils/theme.ts DEFAULT_THEME_COLOR).
export const DEFAULT_THEME_COLOR: ThemeColor = "cyan";

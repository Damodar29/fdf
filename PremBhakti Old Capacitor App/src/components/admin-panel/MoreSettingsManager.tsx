import { formatDistanceToNow } from "date-fns";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	setDoc,
} from "firebase/firestore";
import {
	AlertTriangle,
	BarChart2,
	Check,
	ChevronDown,
	Clock,
	Globe,
	Loader2,
	Monitor,
	RefreshCw,
	Save,
	Smartphone,
	Users,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { db } from "../../../services/firebase";
import { compareVersions, isVersionOlder } from "../../../utils/versioning";
import { APP_VERSION } from "../../../version";

// ── Version stats ─────────────────────────────────────────────────────────
// hooks/useAppConfig.ts keeps one counter per version: a device adds 1 to its
// version and takes 1 off the version it came from, so a count is "devices on
// this version right now". Every Android device has TWO counters — its Play
// Store build (android_native_47) and its OTA bundle (android_ota_47.0.1) — so
// those are shown as separate lists and never added together.

type Kind = "native" | "ota" | "web" | "os";

interface Row {
	version: string;
	count: number;
	lastSeenMs: number | null;
}

interface WebRow extends Row {
	label: string;
}

interface Group {
	major: string;
	count: number;
	lastSeenMs: number | null;
	rows: Row[];
}

const DEFAULT_TITLE = "Update Required";
const DEFAULT_MESSAGE =
	"A new version of the app is available. Please update to continue using the app.";
const DEFAULT_PLAY_URL =
	"https://play.google.com/store/apps/details?id=com.cpbs.bhajans";
const VERSION_PATTERN = /^v?\d+(\.\d+)*$/i;
// Release scheme: the Play Store build is a whole number (47) and every OTA on
// top of it is that number plus a sub-version (47.0.1, 47.0.2, …).
const NATIVE_PATTERN = /^\d+$/;
const OTA_PATTERN = /^\d+\.\d+\.\d+$/;
const majorOf = (v: string) => Number.parseInt(v, 10);

const toMs = (ts: any): number | null =>
	typeof ts?.toMillis === "function" ? ts.toMillis() : null;

const laterOf = (a: number | null, b: number | null) =>
	a === null ? b : b === null ? a : Math.max(a, b);

const ago = (ms: number | null) =>
	ms ? formatDistanceToNow(ms, { addSuffix: true }) : null;

// Doc ids: "android_native_47", "android_ota_47_0_1", "android_pwa_47_0_1",
// "os_android_14", and plain "10.2.1"-style ids from very old app versions
// (below 20 = Play Store build, 20+ = OTA bundle).
const classify = (id: string): Kind | null => {
	if (id.startsWith("os_")) return id.startsWith("os_android_") ? "os" : null;
	if (!id.includes("_")) return Number.parseInt(id, 10) < 20 ? "native" : "ota";
	if (id.includes("_native_")) return "native";
	if (id.includes("_ota_")) return "ota";
	return "web";
};

const versionOf = (id: string) =>
	(id.includes("_") ? id.split("_").slice(2).join("_") : id).replace(/^v/, "");

const isNumeric = (v: string) => VERSION_PATTERN.test(v);

/** "47.0.1" → "v47.0.1"; a version the device could not read → "Unknown". */
const showVersion = (v: string) => (isNumeric(v) ? `v${v}` : "Unknown");

// Unreadable versions ("unknown") go last.
const byVersionDesc = (a: Row, b: Row) =>
	Number(isNumeric(b.version)) - Number(isNumeric(a.version)) ||
	compareVersions(b.version, a.version);

/** Same version reported under two ids (old + new naming) → one row. */
const mergeRows = (rows: Row[]): Row[] => {
	const map = new Map<string, Row>();
	for (const r of rows) {
		const prev = map.get(r.version);
		map.set(
			r.version,
			prev
				? {
						version: r.version,
						count: prev.count + r.count,
						lastSeenMs: laterOf(prev.lastSeenMs, r.lastSeenMs),
					}
				: r,
		);
	}
	return Array.from(map.values()).sort(byVersionDesc);
};

const groupByMajor = (rows: Row[]): Group[] => {
	const groups = new Map<string, Group>();
	for (const r of rows) {
		const major = isNumeric(r.version) ? r.version.split(".")[0] : "?";
		const g = groups.get(major) ?? {
			major,
			count: 0,
			lastSeenMs: null,
			rows: [],
		};
		g.count += r.count;
		g.lastSeenMs = laterOf(g.lastSeenMs, r.lastSeenMs);
		g.rows.push(r);
		groups.set(major, g);
	}
	return Array.from(groups.values()).sort(
		(a, b) =>
			Number(b.major !== "?") - Number(a.major !== "?") ||
			compareVersions(b.major, a.major),
	);
};

const sum = (rows: Row[]) => rows.reduce((n, r) => n + r.count, 0);

const pct = (part: number, whole: number) =>
	whole > 0 ? Math.round((part / whole) * 100) : 0;

const WEB_LABELS: Record<string, string> = {
	android: "Android",
	ios: "iPhone",
	desktop: "Desktop",
};

// ── Version list (Play Store builds, OTA bundles) ───────────────────────────

const Badge: React.FC<{ tone: string; children: React.ReactNode }> = ({
	tone,
	children,
}) => (
	<span
		className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${tone}`}
	>
		{children}
	</span>
);

const TONE = {
	latest:
		"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
	below: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
};

const VersionSection: React.FC<{
	title: string;
	subtitle: string;
	icon: React.ReactNode;
	rows: Row[];
	/** Versions below this get the `belowLabel` badge. */
	minVersion: string;
	belowLabel: string;
	emptyText: string;
	expanded: Record<string, boolean>;
	onToggle: (key: string) => void;
	sectionKey: string;
}> = ({
	title,
	subtitle,
	icon,
	rows,
	minVersion,
	belowLabel,
	emptyText,
	expanded,
	onToggle,
	sectionKey,
}) => {
	const total = sum(rows);
	const groups = groupByMajor(rows);
	const latest = rows.find((r) => isNumeric(r.version))?.version;
	const maxGroup = Math.max(1, ...groups.map((g) => g.count));
	const isBelow = (v: string) =>
		!!minVersion && isNumeric(v) && isVersionOlder(v, minVersion);

	return (
		<div className="space-y-3">
			<div>
				<h4 className="font-bold text-slate-800 dark:text-slate-200 text-base flex items-center gap-2">
					{icon}
					{title}
					<span className="ml-auto text-xs font-bold text-slate-500 dark:text-slate-400">
						{total.toLocaleString()} devices
					</span>
				</h4>
				<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
					{subtitle}
				</p>
			</div>

			{rows.length === 0 ? (
				<div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 text-center text-sm text-slate-500 dark:text-ink-300 border border-dashed border-slate-200 dark:border-slate-700">
					{emptyText}
				</div>
			) : (
				<div className="grid gap-3">
					{groups.map((group) => {
						const key = `${sectionKey}_${group.major}`;
						const isExpanded = !!expanded[key];
						const hasLatest = group.rows.some((r) => r.version === latest);
						const allBelow = group.rows.every((r) => isBelow(r.version));
						const barWidth = (group.count / maxGroup) * 100;
						const barTone = allBelow
							? "bg-red-500"
							: hasLatest
								? "bg-emerald-500"
								: "bg-indigo-500";

						return (
							<div
								key={key}
								className={`bg-white dark:bg-slate-800/80 rounded-2xl border ${isExpanded ? "border-indigo-200 dark:border-indigo-800/50 shadow-md" : "border-slate-200 dark:border-slate-700 shadow-sm"} transition-all overflow-hidden`}
							>
								<button
									type="button"
									aria-expanded={isExpanded}
									onClick={() => onToggle(key)}
									className="w-full text-left p-3 sm:p-4 flex items-center justify-between gap-2"
								>
									<div className="flex items-center gap-3 flex-1 min-w-0">
										<div
											className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center ${allBelow ? "bg-red-50 dark:bg-red-900/20 text-red-600" : hasLatest ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600"}`}
										>
											<span className="font-black text-sm">
												{group.major === "?" ? "?" : `v${group.major}`}
											</span>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex flex-wrap items-center gap-1.5 mb-0.5">
												<span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
													{group.major === "?"
														? "Unknown version"
														: `Version ${group.major}${group.rows.length > 1 || group.rows[0].version !== group.major ? ".x" : ""}`}
												</span>
												{hasLatest && <Badge tone={TONE.latest}>Latest</Badge>}
												{allBelow && (
													<Badge tone={TONE.below}>{belowLabel}</Badge>
												)}
											</div>
											<p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
												<Users size={12} className="shrink-0" />
												{group.count.toLocaleString()} devices ·{" "}
												{pct(group.count, total)}%
												{group.lastSeenMs && (
													<span className="font-medium text-slate-400 dark:text-slate-500">
														· {ago(group.lastSeenMs)}
													</span>
												)}
											</p>
										</div>
									</div>
									<ChevronDown
										size={20}
										className={`shrink-0 text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
									/>
								</button>
								<div className="h-1.5 bg-slate-100 dark:bg-slate-700 w-full">
									<div
										className={`h-full transition-all duration-700 ${barTone}`}
										style={{ width: `${barWidth}%` }}
									/>
								</div>

								{isExpanded && (
									<div className="px-3 sm:px-4 pb-4 pt-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/20">
										{group.rows.map((r) => {
											const below = isBelow(r.version);
											const isLatest = r.version === latest;
											return (
												<div
													key={r.version}
													className="bg-white dark:bg-slate-800 rounded-xl p-2.5 sm:p-3 border border-slate-200/60 dark:border-slate-700/60"
												>
													<div className="flex items-center justify-between gap-2 mb-2">
														<div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
															<span
																className={`font-mono text-xs sm:text-sm font-bold ${below ? "text-red-500 dark:text-red-400" : isLatest ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}
															>
																{showVersion(r.version)}
															</span>
															{isLatest && (
																<Badge tone={TONE.latest}>Latest</Badge>
															)}
															{below && (
																<Badge tone={TONE.below}>{belowLabel}</Badge>
															)}
														</div>
														<div className="text-right shrink-0">
															<span className="block text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200">
																{r.count.toLocaleString()}
															</span>
															<span className="block text-[10px] font-bold text-slate-400 dark:text-ink-400">
																{pct(r.count, total)}%
															</span>
														</div>
													</div>
													<div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
														<div
															className={`h-full rounded-full ${below ? "bg-red-400" : isLatest ? "bg-emerald-400" : "bg-indigo-400"}`}
															style={{
																width: `${group.count > 0 ? (r.count / group.count) * 100 : 0}%`,
															}}
														/>
													</div>
													{r.lastSeenMs && (
														<p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
															<Clock size={10} /> Last opened{" "}
															{ago(r.lastSeenMs)}
														</p>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

// ── Screen ────────────────────────────────────────────────────────────────

interface VersionConfig {
	minNativeVersion: string;
	minWebVersion: string;
	updateTitle: string;
	updateMessage: string;
	playStoreUrl: string;
}

const DEFAULT_CONFIG: VersionConfig = {
	minNativeVersion: "",
	minWebVersion: "",
	updateTitle: DEFAULT_TITLE,
	updateMessage: DEFAULT_MESSAGE,
	playStoreUrl: DEFAULT_PLAY_URL,
};

export const MoreSettingsManager: React.FC = () => {
	const [config, setConfig] = useState<VersionConfig>(DEFAULT_CONFIG);
	// What is saved right now — to warn only about real changes.
	const [savedConfig, setSavedConfig] = useState<VersionConfig>(DEFAULT_CONFIG);

	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(false);
	const [saving, setSaving] = useState(false);
	const [done, setDone] = useState(false);
	const [saveError, setSaveError] = useState("");

	const [stats, setStats] = useState<Record<Kind, Row[]>>({
		native: [],
		ota: [],
		web: [],
		os: [],
	});
	const [webRows, setWebRows] = useState<WebRow[]>([]);
	const [statsLoading, setStatsLoading] = useState(true);
	const [statsError, setStatsError] = useState("");

	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const toggle = (key: string) =>
		setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

	const setField = (field: keyof VersionConfig, value: string) => {
		setConfig((prev) => ({ ...prev, [field]: value }));
		setSaveError("");
	};

	const fetchVersionStats = async () => {
		setStatsLoading(true);
		setStatsError("");
		try {
			const snap = await getDocs(collection(db, "app_version_stats"));
			const byKind: Record<Kind, Row[]> = {
				native: [],
				ota: [],
				web: [],
				os: [],
			};
			const web: WebRow[] = [];
			snap.forEach((docSnap) => {
				const data = docSnap.data();
				const id: string = data.version || docSnap.id.replace(/_/g, ".");
				const kind = classify(id);
				const count = Math.max(0, Number(data.count) || 0);
				// Versions everyone has moved off — nothing to show.
				if (!kind || count === 0) return;
				const row: Row = {
					version: versionOf(id),
					count,
					lastSeenMs: toMs(data.lastSeen),
				};
				if (kind === "web") {
					const [os, type] = id.split("_");
					web.push({
						...row,
						label: `${WEB_LABELS[os] || "Desktop"} ${type === "pwa" ? "PWA" : "Web"}`,
					});
				} else {
					byKind[kind].push(row);
				}
			});
			setStats({
				native: mergeRows(byKind.native),
				ota: mergeRows(byKind.ota),
				web: [],
				// Most-used Android version first.
				os: mergeRows(byKind.os).sort((a, b) => b.count - a.count),
			});
			setWebRows(web);
		} catch (e: any) {
			console.error(e);
			setStatsError(
				e?.code === "permission-denied"
					? "Stats sirf admin login se dikhte hain."
					: "Stats load nahi ho saki. Internet check karke Refresh dabayein.",
			);
		} finally {
			setStatsLoading(false);
		}
	};

	const fetchSettings = async () => {
		setLoading(true);
		setLoadError(false);
		try {
			const snap = await getDoc(doc(db, "app_config", "version_control"));
			const data = snap.exists() ? snap.data() : {};
			const next: VersionConfig = {
				minNativeVersion: data.minNativeVersion || "",
				minWebVersion: data.minWebVersion || "",
				updateTitle: data.updateTitle || DEFAULT_TITLE,
				updateMessage: data.updateMessage || DEFAULT_MESSAGE,
				playStoreUrl: data.playStoreUrl || DEFAULT_PLAY_URL,
			};
			setConfig(next);
			setSavedConfig(next);
		} catch (e) {
			console.error(e);
			// Without the saved values, a save would wipe the live settings with
			// defaults — so saving stays off until they load.
			setLoadError(true);
		} finally {
			setLoading(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: load once on open
	useEffect(() => {
		fetchSettings();
		fetchVersionStats();
	}, []);

	const nativeTotal = sum(stats.native);
	const otaTotal = sum(stats.ota);
	const latestNative = stats.native.find((r) => isNumeric(r.version));
	const latestOta = stats.ota.find((r) => isNumeric(r.version));

	// Newest Play Store build: what devices report, or what this admin panel
	// itself is built on — whichever is higher.
	const appVersion = APP_VERSION.replace(/^v/i, "");
	const nativeBase = Math.max(
		latestNative ? majorOf(latestNative.version) : 0,
		majorOf(appVersion) || 0,
	);
	const currentOta =
		latestOta && isVersionOlder(appVersion, latestOta.version)
			? latestOta.version
			: appVersion;
	// The OTA that would come next on this Play Store build.
	const nextOta = (() => {
		const [major, minor = "0", patch = "0"] = currentOta.split(".");
		return majorOf(major) === nativeBase
			? `${major}.${minor}.${Number(patch) + 1}`
			: `${nativeBase}.0.1`;
	})();

	const countBelow = (rows: Row[], min: string) =>
		min
			? sum(
					rows.filter(
						(r) => isNumeric(r.version) && isVersionOlder(r.version, min),
					),
				)
			: 0;

	const handleSave = async () => {
		const trimmed: VersionConfig = {
			minNativeVersion: config.minNativeVersion.trim().replace(/^v/i, ""),
			minWebVersion: config.minWebVersion.trim().replace(/^v/i, ""),
			updateTitle: config.updateTitle.trim(),
			updateMessage: config.updateMessage.trim(),
			playStoreUrl: config.playStoreUrl.trim(),
		};

		if (
			trimmed.minNativeVersion &&
			!NATIVE_PATTERN.test(trimmed.minNativeVersion)
		) {
			setSaveError(
				`Minimum Native App Version sirf Play Store ka poora number hota hai, jaise ${nativeBase || 47}.`,
			);
			return;
		}
		if (trimmed.minWebVersion) {
			if (!OTA_PATTERN.test(trimmed.minWebVersion)) {
				setSaveError(
					`Minimum OTA Web Version teen hisson mein likhein, jaise ${nextOta}.`,
				);
				return;
			}
			if (nativeBase && majorOf(trimmed.minWebVersion) > nativeBase) {
				setSaveError(
					`Play Store abhi v${nativeBase} par hai, isliye OTA ${nativeBase}.0.x hi hoga (jaise ${nextOta}). ${majorOf(trimmed.minWebVersion)}.x tabhi jab Play Store par v${majorOf(trimmed.minWebVersion)} aa jaye.`,
				);
				return;
			}
		}
		if (trimmed.playStoreUrl && !/^https?:\/\//i.test(trimmed.playStoreUrl)) {
			setSaveError("Play Store URL https:// se shuru hona chahiye.");
			return;
		}

		// Blocking devices is serious — say exactly what this save will do.
		const warnings: string[] = [];
		if (
			trimmed.minNativeVersion &&
			trimmed.minNativeVersion !== savedConfig.minNativeVersion
		) {
			const blocked = countBelow(stats.native, trimmed.minNativeVersion);
			warnings.push(
				`Play Store v${trimmed.minNativeVersion} se purane ${blocked} Android devices BLOCK ho jayenge jab tak woh Play Store se update na karein.`,
			);
			if (
				latestNative &&
				isVersionOlder(latestNative.version, trimmed.minNativeVersion)
			) {
				warnings.push(
					`Dhyan dein: abhi sabse naya Play Store version jo kisi user ke paas hai woh v${latestNative.version} hai — agar Play Store par v${trimmed.minNativeVersion} live nahi hai to SAB users atak jayenge.`,
				);
			}
		}
		if (
			trimmed.minWebVersion &&
			trimmed.minWebVersion !== savedConfig.minWebVersion
		) {
			const forced = countBelow(stats.ota, trimmed.minWebVersion);
			warnings.push(
				`OTA v${trimmed.minWebVersion} se purane ${forced} devices ko app kholte hi update download karke restart karna padega.`,
			);
			if (isVersionOlder(APP_VERSION, trimmed.minWebVersion)) {
				warnings.push(
					`Dhyan dein: yeh admin panel khud ${APP_VERSION} par hai. Pakka karein ki OTA v${trimmed.minWebVersion} publish ho chuka hai.`,
				);
			}
		}
		if (
			warnings.length > 0 &&
			!window.confirm(`${warnings.join("\n\n")}\n\nSave karein?`)
		) {
			return;
		}

		setSaving(true);
		setSaveError("");
		try {
			await setDoc(
				doc(db, "app_config", "version_control"),
				{ ...trimmed, updatedAt: serverTimestamp() },
				{ merge: true },
			);
			setConfig(trimmed);
			setSavedConfig(trimmed);
			setDone(true);
			setTimeout(() => setDone(false), 3000);
		} catch (e: any) {
			console.error(e);
			setSaveError(
				`Save nahi hua: ${e?.code === "permission-denied" ? "aapke paas permission nahi hai" : "internet check karke dobara try karein"}.`,
			);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="animate-spin text-rose-500" size={32} />
			</div>
		);
	}

	const inputClass =
		"w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none";
	const labelClass =
		"block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1";
	const hintClass = "text-[11px] text-slate-400 dark:text-slate-500 mt-1";

	const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
	const latestOtaDevices = latestOta?.count ?? 0;

	// Web / PWA: one card per platform + type.
	const webGroups = new Map<
		string,
		{ count: number; lastSeenMs: number | null; rows: Row[] }
	>();
	for (const r of webRows) {
		const g = webGroups.get(r.label) ?? {
			count: 0,
			lastSeenMs: null,
			rows: [],
		};
		g.count += r.count;
		g.lastSeenMs = laterOf(g.lastSeenMs, r.lastSeenMs);
		g.rows.push(r);
		webGroups.set(r.label, g);
	}
	const sortedWeb = Array.from(webGroups.entries()).sort(
		(a, b) => b[1].count - a[1].count,
	);
	const maxOs = Math.max(1, ...stats.os.map((s) => s.count));
	const osTotal = sum(stats.os);

	return (
		<div className="h-full overflow-y-auto p-4 space-y-6 pb-[calc(5rem+env(safe-area-inset-bottom))] animate-in fade-in">
			{loadError && (
				<div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
					<AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
					<div className="flex-1">
						<p className="text-sm font-bold text-amber-800 dark:text-amber-300">
							Settings load nahi hui
						</p>
						<p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
							Galat values save na ho jayein, isliye Save band hai. Internet
							check karke dobara try karein.
						</p>
					</div>
					<button
						type="button"
						onClick={fetchSettings}
						className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold"
					>
						Retry
					</button>
				</div>
			)}

			{/* ── FORCE UPDATE SETTINGS ── */}
			<div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-200 dark:border-rose-800">
				<h3 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2 mb-2">
					<Smartphone size={20} /> Force Update (Play Store)
				</h3>
				<p className="text-xs text-rose-600 dark:text-rose-300">
					Purane Play Store versions band karne ke liye yahan{" "}
					<strong>Minimum Native App Version</strong> likhein (e.g.{" "}
					<code className="bg-white/50 px-1 rounded">{nativeBase || 47}</code>
					). Isse chhote version wale user ki app block ho jayegi jab tak woh
					Play Store se update na karein. Hatane ke liye field khali chhod dein.
				</p>
			</div>

			<div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800">
				<h3 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 mb-2">
					<RefreshCw size={20} /> Force Update (OTA)
				</h3>
				<p className="text-xs text-emerald-600 dark:text-emerald-300">
					Sabko turant naya OTA update dilane ke liye yahan{" "}
					<strong>Minimum OTA Web Version</strong> likhein (e.g.{" "}
					<code className="bg-white/50 px-1 rounded">{nextOta}</code>
					). OTA version hamesha Play Store version par chalta hai — Play Store{" "}
					{nativeBase} hai to OTA {nativeBase}.0.1, {nativeBase}.0.2 … Isse
					chhote version wali app khulte hi naya update download karke restart
					hogi. Hatane ke liye field khali chhod dein.
				</p>
			</div>

			<div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-4">
				<div>
					<label htmlFor="min-native" className={labelClass}>
						Minimum Native App Version
					</label>
					<input
						id="min-native"
						type="text"
						inputMode="decimal"
						value={config.minNativeVersion}
						onChange={(e) => setField("minNativeVersion", e.target.value)}
						placeholder={`e.g. ${nativeBase || 47} (khali = band)`}
						className={`${inputClass} font-mono`}
					/>
					{latestNative && (
						<p className={hintClass}>
							Sabse naya Play Store version users ke paas: v
							{latestNative.version} ({latestNative.count} devices)
						</p>
					)}
				</div>

				<div>
					<label htmlFor="min-web" className={labelClass}>
						Minimum OTA Web Version
					</label>
					<input
						id="min-web"
						type="text"
						inputMode="decimal"
						value={config.minWebVersion}
						onChange={(e) => setField("minWebVersion", e.target.value)}
						placeholder={`e.g. ${nextOta} (khali = band)`}
						className={`${inputClass} font-mono focus:ring-emerald-500`}
					/>
					<p className={hintClass}>
						Abhi ka OTA: v{currentOta} · agla OTA: v{nextOta}
					</p>
				</div>

				<div>
					<label htmlFor="update-title" className={labelClass}>
						Update Screen Title
					</label>
					<input
						id="update-title"
						type="text"
						value={config.updateTitle}
						onChange={(e) => setField("updateTitle", e.target.value)}
						placeholder={DEFAULT_TITLE}
						className={inputClass}
					/>
				</div>

				<div>
					<label htmlFor="update-message" className={labelClass}>
						Update Message
					</label>
					<textarea
						id="update-message"
						value={config.updateMessage}
						onChange={(e) => setField("updateMessage", e.target.value)}
						rows={3}
						placeholder="Message explaining why update is needed..."
						className={`${inputClass} resize-none`}
					/>
				</div>

				<div>
					<label htmlFor="play-url" className={labelClass}>
						Play Store URL
					</label>
					<input
						id="play-url"
						type="url"
						value={config.playStoreUrl}
						onChange={(e) => setField("playStoreUrl", e.target.value)}
						placeholder="https://play.google.com/..."
						className={inputClass}
					/>
				</div>
			</div>

			{saveError && (
				<p className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2 -mt-2">
					<AlertTriangle size={16} className="shrink-0 mt-0.5" />
					{saveError}
				</p>
			)}

			<button
				type="button"
				onClick={handleSave}
				disabled={saving || loadError || !dirty}
				className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-colors shadow-sm"
			>
				{saving ? (
					<Loader2 size={18} className="animate-spin" />
				) : done ? (
					<Check size={18} />
				) : (
					<Save size={18} />
				)}
				{saving
					? "Saving..."
					: done
						? "Settings Saved!"
						: dirty
							? "Save Version Control Settings"
							: "Koi badlav nahi"}
			</button>

			{/* ── VERSION ANALYTICS ── */}
			<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
				<div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
							<BarChart2
								size={20}
								className="text-indigo-600 dark:text-indigo-400"
							/>
						</div>
						<div>
							<h3 className="font-bold text-slate-800 dark:text-white text-sm">
								Version Analytics
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400">
								Kitne devices abhi konse version par hain
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={fetchVersionStats}
						disabled={statsLoading}
						className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
						title="Refresh Stats"
						aria-label="Refresh Stats"
					>
						<RefreshCw
							size={16}
							className={`text-slate-500 dark:text-ink-300 ${statsLoading ? "animate-spin" : ""}`}
						/>
					</button>
				</div>

				<div className="p-4">
					{statsLoading ? (
						<div className="flex justify-center py-8">
							<Loader2 className="animate-spin text-indigo-500" size={28} />
						</div>
					) : statsError ? (
						<div className="text-center py-6 text-red-500 dark:text-red-400 text-sm">
							<p>⚠️ {statsError}</p>
						</div>
					) : nativeTotal + otaTotal + webRows.length === 0 ? (
						<div className="text-center py-8 text-slate-400 dark:text-slate-500">
							<Smartphone size={36} className="mx-auto mb-3 opacity-40" />
							<p className="text-sm font-medium">Abhi tak koi data nahi</p>
							<p className="text-xs mt-1">
								Jab users app kholeinge, yahan data aane lagega
							</p>
						</div>
					) : (
						<div className="space-y-8">
							{/* Summary */}
							<div className="grid grid-cols-2 gap-3">
								<div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
									<p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
										Android App
									</p>
									<p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 leading-none mt-1">
										{nativeTotal.toLocaleString()}
									</p>
									<p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">
										devices
									</p>
								</div>
								<div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
									<p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
										Latest OTA {latestOta ? `v${latestOta.version}` : ""}
									</p>
									<p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 leading-none mt-1">
										{latestOtaDevices.toLocaleString()}
									</p>
									<p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
										{pct(latestOtaDevices, otaTotal)}% of{" "}
										{otaTotal.toLocaleString()} updated
									</p>
								</div>
							</div>

							<VersionSection
								sectionKey="native"
								title="Play Store Versions"
								subtitle="Phone mein install app ka version (Play Store se)"
								icon={<Smartphone size={18} className="text-indigo-500" />}
								rows={stats.native}
								minVersion={savedConfig.minNativeVersion}
								belowLabel="Blocked"
								emptyText="Abhi Play Store app ka data nahi."
								expanded={expanded}
								onToggle={toggle}
							/>

							<VersionSection
								sectionKey="ota"
								title="OTA Versions"
								subtitle="App ke andar ka update (OTA) — naya OTA kitno tak pahuncha"
								icon={<RefreshCw size={18} className="text-teal-500" />}
								rows={stats.ota}
								minVersion={savedConfig.minWebVersion}
								belowLabel="Force update"
								emptyText="Abhi OTA ka data nahi."
								expanded={expanded}
								onToggle={toggle}
							/>

							{/* Web & PWA */}
							<div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
								<h4 className="font-bold text-slate-800 dark:text-slate-200 text-base flex items-center gap-2">
									<Globe size={18} className="text-blue-500" />
									Web & PWA
								</h4>
								{sortedWeb.length === 0 ? (
									<div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 text-center text-sm text-slate-500 dark:text-ink-300 border border-dashed border-slate-200 dark:border-slate-700">
										Abhi web ka data nahi.
									</div>
								) : (
									<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
										{sortedWeb.map(([label, data]) => {
											const isPWA = label.includes("PWA");
											const key = `web_${label}`;
											const isExpanded = !!expanded[key];
											const rows = mergeRows(data.rows);
											return (
												<div
													key={label}
													className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col"
												>
													<div
														className={`absolute top-0 left-0 w-full h-1.5 ${isPWA ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-blue-400 to-indigo-500"}`}
													/>
													<button
														type="button"
														aria-expanded={isExpanded}
														onClick={() => toggle(key)}
														className="p-3 sm:p-4 pt-4 flex flex-col items-center"
													>
														<div
															className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${isPWA ? "bg-orange-50 dark:bg-orange-900/20 text-orange-500" : "bg-blue-50 dark:bg-blue-900/20 text-blue-500"}`}
														>
															{label.startsWith("Desktop") ? (
																<Monitor size={20} strokeWidth={2.5} />
															) : (
																<Smartphone size={20} strokeWidth={2.5} />
															)}
														</div>
														<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
															{label}
														</span>
														<span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mt-0.5">
															{data.count.toLocaleString()}
														</span>
														{data.lastSeenMs && (
															<span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
																<Clock size={10} /> {ago(data.lastSeenMs)}
															</span>
														)}
														<ChevronDown
															size={16}
															className={`mt-1 text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
														/>
													</button>
													{isExpanded && (
														<div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5 max-h-[150px] overflow-y-auto">
															{rows.map((r) => (
																<div
																	key={r.version}
																	className="flex justify-between items-center py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-900/40"
																>
																	<span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate mr-2">
																		{showVersion(r.version)}
																	</span>
																	<span className="text-xs font-black text-slate-700 dark:text-slate-200">
																		{r.count}
																	</span>
																</div>
															))}
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>

							{/* Android OS */}
							<div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
								<h4 className="font-bold text-slate-800 dark:text-slate-200 text-base flex items-center gap-2">
									<Smartphone size={18} className="text-orange-500" />
									Android OS Versions
								</h4>
								{stats.os.length === 0 ? (
									<div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 text-center text-sm text-slate-500 dark:text-ink-300 border border-dashed border-slate-200 dark:border-slate-700">
										Abhi Android OS ka data nahi.
									</div>
								) : (
									<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
										{stats.os.map((stat, idx) => (
											<div
												key={stat.version}
												className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 flex flex-col"
											>
												<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-amber-500" />
												<div className="flex items-start justify-between mb-2">
													<div className="flex flex-col">
														<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
															Android
														</span>
														<span className="text-xl font-black text-slate-800 dark:text-white leading-none mt-0.5">
															{stat.version}
														</span>
													</div>
													{idx === 0 && (
														<span className="text-[9px] font-bold px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full uppercase tracking-wider">
															Most used
														</span>
													)}
												</div>
												<div className="mt-auto pt-2">
													<div className="flex items-center justify-between mb-1.5">
														<span className="text-sm font-bold text-slate-700 dark:text-slate-300">
															{stat.count.toLocaleString()}
														</span>
														<span className="text-[10px] font-bold text-slate-500 dark:text-ink-300">
															{pct(stat.count, osTotal)}%
														</span>
													</div>
													<div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
														<div
															className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500"
															style={{
																width: `${(stat.count / maxOs) * 100}%`,
															}}
														/>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							<p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 text-center leading-relaxed">
								Har device ek hi baar gina jata hai — update karne par woh
								purane version se hat kar naye mein judta hai. Web par browser
								data clear karne se wahi user dobara gina ja sakta hai.
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

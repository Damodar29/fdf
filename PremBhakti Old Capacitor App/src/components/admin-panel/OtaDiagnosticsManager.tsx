import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { doc, getDoc } from "firebase/firestore";
import {
	AlertTriangle,
	CheckCircle,
	Cloud,
	Info,
	Loader2,
	Package,
	RefreshCw,
	ShieldCheck,
	Smartphone,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { db } from "../../../services/firebase";

interface BundleInfo {
	id: string;
	version: string;
	status: string;
}

interface DiagData {
	nativeVersion: string;
	nativeBuild: string;
	platform: string;
	isNative: boolean;
	currentBundle: { id: string; version: string } | null;
	bundleList: BundleInfo[];
	otaLatestVersion: string;
	otaLatestUrl: string;
	otaUpdatedAt: string;
	minNativeVersion: string;
	minWebVersion: string;
}

const Row: React.FC<{
	label: string;
	value: React.ReactNode;
	mono?: boolean;
	accent?: "green" | "red" | "orange" | "blue";
}> = ({ label, value, mono, accent }) => {
	const accentColor =
		{
			green: "text-emerald-600 dark:text-emerald-400",
			red: "text-red-500 dark:text-red-400",
			orange: "text-orange-500 dark:text-orange-400",
			blue: "text-blue-600 dark:text-blue-400",
		}[accent || ""] || "text-slate-800 dark:text-white";

	return (
		<div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
			<span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 mt-0.5">
				{label}
			</span>
			<span
				className={`text-xs font-bold text-right break-all ${mono ? "font-mono" : ""} ${accentColor}`}
			>
				{value}
			</span>
		</div>
	);
};

const SectionCard: React.FC<{
	icon: React.ReactNode;
	title: string;
	colorClass: string;
	children: React.ReactNode;
}> = ({ icon, title, colorClass, children }) => (
	<div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
		<div
			className={`flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700 ${colorClass}`}
		>
			{icon}
			<h3 className="font-bold text-sm">{title}</h3>
		</div>
		<div className="px-4 py-2">{children}</div>
	</div>
);

export const OtaDiagnosticsManager: React.FC = () => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [data, setData] = useState<DiagData | null>(null);

	const fetchAll = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const platform = Capacitor.getPlatform();
			const isNative = Capacitor.isNativePlatform();

			// Device version
			let nativeVersion = "N/A (Web)";
			let nativeBuild = "N/A";
			if (isNative) {
				try {
					const info = await App.getInfo();
					nativeVersion = info.version;
					nativeBuild = info.build;
				} catch {
					nativeVersion = "Error reading";
				}
			}

			// Capgo active bundle + list
			let currentBundle: { id: string; version: string } | null = null;
			let bundleList: BundleInfo[] = [];
			if (isNative) {
				try {
					const cur = await CapacitorUpdater.current();
					if (cur?.bundle) {
						currentBundle = { id: cur.bundle.id, version: cur.bundle.version };
					}
				} catch {
					/* non-native */
				}

				try {
					const list = await CapacitorUpdater.list();
					bundleList = (list?.bundles || []).map((b: any) => ({
						id: b.id,
						version: b.version,
						status: b.status || "unknown",
					}));
				} catch {
					/* ignore */
				}
			}

			// Firestore: ota_config/latest
			let otaLatestVersion = "N/A";
			let otaLatestUrl = "N/A";
			let otaUpdatedAt = "N/A";
			try {
				const otaSnap = await getDoc(doc(db, "ota_config", "latest"));
				if (otaSnap.exists()) {
					const d = otaSnap.data();
					otaLatestVersion = d.version || "N/A";
					otaLatestUrl = d.url || "N/A";
					const ts = d.updatedAt || d.createdAt;
					otaUpdatedAt = ts?.toDate
						? ts.toDate().toLocaleString("en-IN")
						: "N/A";
				}
			} catch {
				/* Firestore offline */
			}

			// Firestore: version_control
			let minNativeVersion = "Not set (disabled)";
			let minWebVersion = "Not set (disabled)";
			try {
				const vcSnap = await getDoc(doc(db, "app_config", "version_control"));
				if (vcSnap.exists()) {
					const d = vcSnap.data();
					minNativeVersion = d.minNativeVersion || "Not set (disabled)";
					minWebVersion = d.minWebVersion || "Not set (disabled)";
				}
			} catch {
				/* ignore */
			}

			setData({
				nativeVersion,
				nativeBuild,
				platform,
				isNative,
				currentBundle,
				bundleList,
				otaLatestVersion,
				otaLatestUrl,
				otaUpdatedAt,
				minNativeVersion,
				minWebVersion,
			});
		} catch (e: any) {
			setError(e.message || "Failed to load diagnostics");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAll();
	}, [fetchAll]);

	return (
		<div className="h-full overflow-y-auto p-4 space-y-4 pb-[calc(5rem+env(safe-area-inset-bottom))] animate-in fade-in">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-slate-800 dark:text-white text-base">
						OTA Diagnostics
					</h2>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
						Live device update state — admin only
					</p>
				</div>
				<button
					onClick={fetchAll}
					disabled={loading}
					className="p-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
				>
					<RefreshCw
						size={16}
						className={`text-slate-500 dark:text-ink-300 ${loading ? "animate-spin" : ""}`}
					/>
				</button>
			</div>

			{loading && (
				<div className="flex justify-center py-12">
					<Loader2 className="animate-spin text-indigo-500" size={32} />
				</div>
			)}

			{error && (
				<div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
					<AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
					<p className="text-sm text-red-700 dark:text-red-300 font-medium">
						{error}
					</p>
				</div>
			)}

			{!loading && data && (
				<>
					{/* 1. Device / APK */}
					<SectionCard
						icon={
							<Smartphone
								size={16}
								className="text-blue-600 dark:text-blue-400"
							/>
						}
						title="Device / APK"
						colorClass="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20"
					>
						<Row label="Platform" value={data.platform.toUpperCase()} />
						<Row
							label="APK Version (Play Store)"
							value={data.nativeVersion}
							mono
							accent="blue"
						/>
						<Row label="Build Number" value={data.nativeBuild} mono />
						{!data.isNative && (
							<div className="flex items-center gap-2 py-2 text-orange-600 dark:text-orange-400">
								<Info size={14} />
								<span className="text-xs font-medium">
									Running on web — native OTA info not available
								</span>
							</div>
						)}
					</SectionCard>

					{/* 2. Active OTA Bundle */}
					<SectionCard
						icon={
							<Package
								size={16}
								className="text-emerald-600 dark:text-emerald-400"
							/>
						}
						title="Active OTA Bundle (this device)"
						colorClass="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
					>
						{data.currentBundle ? (
							<>
								<Row
									label="Bundle Version"
									value={data.currentBundle.version}
									mono
									accent="green"
								/>
								<Row label="Bundle ID" value={data.currentBundle.id} mono />
							</>
						) : (
							<div className="py-3 flex items-center gap-2 text-slate-500 dark:text-slate-400">
								<Info size={14} className="shrink-0" />
								<span className="text-xs">
									{data.isNative
										? "Running bundled APK assets (no OTA bundle active yet)"
										: "N/A — Web platform"}
								</span>
							</div>
						)}
					</SectionCard>

					{/* 3. Downloaded Bundles */}
					{data.isNative && (
						<SectionCard
							icon={
								<Package
									size={16}
									className="text-indigo-600 dark:text-indigo-400"
								/>
							}
							title={`Downloaded Bundles on Device (${data.bundleList.length})`}
							colorClass="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20"
						>
							{data.bundleList.length === 0 ? (
								<div className="py-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
									<CheckCircle size={14} className="shrink-0" />
									<span className="text-xs font-bold">
										No extra bundles stored — device storage is clean ✅
									</span>
								</div>
							) : (
								data.bundleList.map((b, i) => (
									<div
										key={b.id}
										className={`py-2.5 ${i < data.bundleList.length - 1 ? "border-b border-slate-100 dark:border-slate-700" : ""}`}
									>
										<div className="flex items-center justify-between gap-2 flex-wrap">
											<span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
												{b.version}
											</span>
											<span
												className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
													b.status === "success"
														? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
														: b.status === "pending"
															? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
															: b.status === "error"
																? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
																: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
												}`}
											>
												{b.status}
											</span>
										</div>
										<p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
											{b.id}
										</p>
									</div>
								))
							)}
						</SectionCard>
					)}

					{/* 4. Firestore ota_config/latest */}
					<SectionCard
						icon={
							<Cloud size={16} className="text-sky-600 dark:text-sky-400" />
						}
						title="Firestore — ota_config/latest"
						colorClass="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20"
					>
						<Row
							label="Latest OTA Version"
							value={data.otaLatestVersion}
							mono
							accent="blue"
						/>
						<Row label="Published At" value={data.otaUpdatedAt} />
						<Row
							label="Bundle File"
							value={
								data.otaLatestUrl !== "N/A"
									? data.otaLatestUrl.split("/").pop() || data.otaLatestUrl
									: "N/A"
							}
							mono
						/>
					</SectionCard>

					{/* 5. Version Control Policy */}
					<SectionCard
						icon={
							<ShieldCheck
								size={16}
								className="text-rose-600 dark:text-rose-400"
							/>
						}
						title="Version Control Policy"
						colorClass="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20"
					>
						<Row
							label="Min Native (APK)"
							value={data.minNativeVersion}
							mono
							accent={
								data.minNativeVersion !== "Not set (disabled)"
									? "orange"
									: undefined
							}
						/>
						<Row
							label="Min Web (OTA)"
							value={data.minWebVersion}
							mono
							accent={
								data.minWebVersion !== "Not set (disabled)"
									? "orange"
									: undefined
							}
						/>
					</SectionCard>

					{/* 6. Quick Status Summary */}
					{data.isNative && (
						<div
							className={`rounded-2xl border p-4 flex items-start gap-3 ${
								data.currentBundle &&
								data.currentBundle.version === data.otaLatestVersion
									? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
									: data.currentBundle
										? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
										: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
							}`}
						>
							{data.currentBundle &&
							data.currentBundle.version === data.otaLatestVersion ? (
								<CheckCircle
									size={18}
									className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
								/>
							) : data.currentBundle ? (
								<AlertTriangle
									size={18}
									className="text-orange-500 dark:text-orange-400 shrink-0 mt-0.5"
								/>
							) : (
								<Info
									size={18}
									className="text-slate-500 dark:text-slate-400 shrink-0 mt-0.5"
								/>
							)}
							<div>
								<p
									className={`text-sm font-bold ${
										data.currentBundle &&
										data.currentBundle.version === data.otaLatestVersion
											? "text-emerald-700 dark:text-emerald-300"
											: data.currentBundle
												? "text-orange-700 dark:text-orange-300"
												: "text-slate-600 dark:text-slate-400"
									}`}
								>
									{!data.currentBundle
										? "Running bundled APK assets — no OTA applied yet"
										: data.currentBundle.version === data.otaLatestVersion
											? "✅ Device is on the latest OTA bundle"
											: "⚠️ Device OTA bundle is behind latest"}
								</p>
								{data.currentBundle &&
									data.currentBundle.version !== data.otaLatestVersion && (
										<p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
											Device:{" "}
											<span className="font-mono font-bold">
												{data.currentBundle.version}
											</span>
											{" → "}
											Latest:{" "}
											<span className="font-mono font-bold">
												{data.otaLatestVersion}
											</span>
										</p>
									)}
							</div>
						</div>
					)}

					<p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pb-2">
						* Reads live device state. Tap ↻ to refresh after an update.
					</p>
				</>
			)}
		</div>
	);
};

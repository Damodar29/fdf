import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Crashlytics } from "../utils/Crashlytics";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
	errorInfo?: ErrorInfo;
	showDetails: boolean;
	tapCount: number;
	deviceInfo?: string;
}

/**
 * Catches any React rendering errors at the root level.
 * Prevents "White Screen of Death" and reports to Crashlytics.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		showDetails: false,
		tapCount: 0,
	};

	public static getDerivedStateFromError(error: Error): Partial<State> {
		return { hasError: true, error };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({ errorInfo });
		Crashlytics.recordException(error);
		Crashlytics.log(`Component Stack: ${errorInfo.componentStack}`);
		this.collectDeviceInfo();
	}

	private collectDeviceInfo = async () => {
		try {
			let infoStr = `Platform: ${Capacitor.getPlatform()}\n`;
			infoStr += `URL: ${window.location.href}\n`;
			infoStr += `History State: ${JSON.stringify(window.history.state)}\n`;

			if (Capacitor.isNativePlatform()) {
				try {
					const appInfo = await CapApp.getInfo();
					infoStr += `App Version: ${appInfo.version} (${appInfo.build})\n`;
				} catch (_e) {}
				try {
					const devInfo = await Device.getInfo();
					infoStr += `Device: ${devInfo.manufacturer} ${devInfo.model}\n`;
					infoStr += `OS: ${devInfo.operatingSystem} ${devInfo.osVersion}\n`;
					infoStr += `Is Virtual: ${devInfo.isVirtual}\n`;
				} catch (_e) {}
			}

			// Collect lightweight storage keys snapshot
			try {
				const keys = [];
				for (let i = 0; i < localStorage.length; i++) {
					keys.push(localStorage.key(i));
				}
				infoStr += `Storage Keys: ${keys.length} items (${keys.slice(0, 5).join(", ")}...)\n`;
			} catch (_e) {}

			this.setState({ deviceInfo: infoStr });
		} catch (e) {
			console.warn("Failed to collect device info", e);
		}
	};

	private handleReset = () => {
		window.location.reload();
	};

	private copyToClipboard = () => {
		const { error, errorInfo, deviceInfo } = this.state;
		const text = `Error: ${error?.toString()}\n\nStack:\n${error?.stack}\n\nComponent Stack:\n${errorInfo?.componentStack}\n\nDevice & State:\n${deviceInfo || "Loading..."}`;
		navigator.clipboard
			.writeText(text)
			.then(() => {
				alert("Debug info copied to clipboard!");
			})
			.catch((e) => {
				console.error("Failed to copy", e);
			});
	};

	private handleSecretTap = () => {
		// Only allow debugger in development or explicit debug builds
		if (import.meta.env.DEV || import.meta.env.MODE === "debug") {
			this.setState((s) => {
				const newTapCount = s.tapCount + 1;
				if (newTapCount >= 5) {
					return { tapCount: newTapCount, showDetails: true };
				}
				return { tapCount: newTapCount, showDetails: s.showDetails };
			});
		}
	};

	public render() {
		if (this.state.hasError) {
			return (
				<div className="fixed inset-0 bg-paper dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-[999] overflow-y-auto">
					<div
						onClick={this.handleSecretTap}
						className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 shrink-0 mt-8 cursor-pointer"
					>
						<RefreshCw className="text-red-600 dark:text-red-400 w-8 h-8 pointer-events-none" />
					</div>

					<h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 shrink-0">
						Something went wrong
					</h1>
					<p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xs shrink-0">
						We've encountered an unexpected error. Don't worry, our team has
						been notified.
					</p>

					<div className="flex gap-4 shrink-0 mb-6">
						<button
							onClick={this.handleReset}
							className="flex items-center gap-2 bg-saffron-500 hover:bg-saffron-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-saffron-500/20 active:scale-95 transition-all"
						>
							<RefreshCw size={20} />
							Reload App
						</button>
					</div>

					{this.state.showDetails && (
						<div className="w-full max-w-lg mt-2 p-4 bg-slate-100 dark:bg-slate-900 rounded-xl text-left flex flex-col overflow-hidden shrink-0">
							<div className="flex justify-between items-center mb-2">
								<span className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase">
									Error Details
								</span>
								<button
									onClick={this.copyToClipboard}
									className="text-xs bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-lg text-slate-700 dark:text-slate-300 active:scale-95"
								>
									Copy
								</button>
							</div>
							<div className="overflow-auto max-h-[40vh] scrollbar-thin">
								<code className="text-[10px] text-red-500 font-mono whitespace-pre-wrap break-words block mb-4">
									{this.state.error?.toString()}
									{"\n\n=== STACK ===\n"}
									{this.state.error?.stack}
									{"\n\n=== COMPONENT STACK ===\n"}
									{this.state.errorInfo?.componentStack}
									{"\n\n=== DEVICE & STATE INFO ===\n"}
									{this.state.deviceInfo || "Loading..."}
								</code>
							</div>
						</div>
					)}
				</div>
			);
		}

		return this.props.children;
	}
}

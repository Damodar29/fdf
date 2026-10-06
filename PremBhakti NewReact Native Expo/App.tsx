import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStartup } from "./src/components/AppStartup";
import { AutoBackupManager } from "./src/components/AutoBackupManager";
import { DownloadConfirmHost } from "./src/components/DownloadConfirmHost";
import { OldAppMigration } from "./src/components/OldAppMigration";
import { ToastHost } from "./src/components/ToastHost";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useIsDarkMode } from "./src/theme/useAppTheme";

// Status bar icons follow the app's own theme (which can be time-based
// "auto" or forced light/dark in Settings), not the OS color scheme.
function ThemedStatusBar() {
	const isDark = useIsDarkMode();
	return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function App() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<RootNavigator />
				<DownloadConfirmHost />
				<ToastHost />
				<AutoBackupManager />
				<OldAppMigration />
				<AppStartup />
				<ThemedStatusBar />
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

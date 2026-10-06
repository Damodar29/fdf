import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useRef } from "react";
import { BackHandler } from "react-native";
import { useAudioStore } from "../store/audioStore";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import type { RootNavigation, TabParamList } from "./types";

const EXIT_WINDOW_MS = 3000;

/**
 * Android back on the tab screens, ported from App.tsx's backButton listener:
 * from any other tab, back returns to Home (and counts as the first press);
 * on Home, the 2nd press within 3s shows "Press back again to exit" and the
 * 3rd closes the player and exits. The 3-press flow is intentional.
 *
 * Only active while the tabs are focused, so Reader/Settings/etc. keep the
 * normal stack back behaviour. Returns a tracker for the active tab name.
 */
export function useTabsBackHandler() {
	const navigation = useNavigation<RootNavigation>();
	const activeTab = useRef<keyof TabParamList>("Home");
	const attempts = useRef(0);
	const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useFocusEffect(
		useCallback(() => {
			const armReset = () => {
				if (resetTimer.current) clearTimeout(resetTimer.current);
				resetTimer.current = setTimeout(() => {
					attempts.current = 0;
				}, EXIT_WINDOW_MS);
			};

			const sub = BackHandler.addEventListener("hardwareBackPress", () => {
				if (activeTab.current !== "Home") {
					navigation.navigate("Tabs", { screen: "Home" });
					attempts.current = 1;
					armReset();
					return true;
				}
				attempts.current += 1;
				armReset();
				if (attempts.current === 2) {
					const hindi = useSettingsStore.getState().settingsLanguage === "hi";
					showToast(hindi ? "बाहर निकलने के लिए फिर से दबाएं" : "Press back again to exit");
				} else if (attempts.current >= 3) {
					attempts.current = 0;
					useAudioStore.getState().closePlayer();
					BackHandler.exitApp();
				}
				return true;
			});
			return () => {
				sub.remove();
				if (resetTimer.current) clearTimeout(resetTimer.current);
			};
		}, [navigation]),
	);

	return useCallback((name: keyof TabParamList) => {
		activeTab.current = name;
	}, []);
}

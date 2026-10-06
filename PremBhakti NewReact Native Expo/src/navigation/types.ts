import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { WebTarget } from "../screens/WebScreen";
import type { Bhajan, Book, LectureData } from "../types";

export type TabParamList = {
	Books: undefined;
	Lectures: undefined;
	Home: undefined;
	Songs: undefined;
	Library: undefined;
	/** Not in the bottom nav: App.tsx shows "downloaded" in the tab area, with Bhajans lit. */
	Downloads: undefined;
};

// Reader/Lecture/Book/Settings live on the root stack, above the tabs, so
// every tab (and Now Playing) can open them â€” the same "overlay over the
// current tab" model the Capacitor app's App.tsx view state used.
export type RootStackParamList = {
	Tabs: NavigatorScreenParams<TabParamList>;
	/** listQueueName: queue every bhajan under this name when playing (App.tsx "Song List"). */
	Reader: { bhajan: Bhajan; listQueueName?: string };
	Lecture: { lecture: LectureData };
	BookViewer: { book: Book };
	Settings: undefined;
	About: undefined;
	Privacy: undefined;
	Terms: undefined;
	OurCenters: undefined;
	GuruMaharaj: undefined;
	VirahiMaharaj: undefined;
	TempleTimings: { initialMandalId?: string } | undefined;
	DailyQuotes: undefined;
	Information: { initialItemId?: string; target_info_id?: string } | undefined;
	GlorificationReader: undefined;
	VaishnavCalendar: undefined;
	Videos: { initialFolderId?: string; initialVideoId?: string } | undefined;
	Donate: undefined;
	DeityDarshan: { target_mandal?: string; target_date?: string } | undefined;
	Activities: { initialShowPhotos?: boolean; target_mandal?: string; target_date?: string; initialVideoId?: string } | undefined;
	Login: undefined;
	/** A Capacitor web screen in a WebView (rollout "3B"). */
	Web: { target: WebTarget };
};

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

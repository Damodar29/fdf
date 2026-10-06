import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNavigationContainerRef, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo } from "react";
import { Platform, View } from "react-native";
import { AppHeader } from "../components/AppHeader";
import { BottomNav } from "../components/BottomNav";
import { SideMenu } from "../components/SideMenu";
import { PaperBackground } from "../components/PaperBackground";
import { AboutScreen } from "../screens/AboutScreen";
import { PrivacyPolicyScreen } from "../screens/PrivacyPolicyScreen";
import { TermsOfServiceScreen } from "../screens/TermsOfServiceScreen";
import { GuruMaharajScreen } from "../screens/GuruMaharajScreen";
import { VirahiMaharajScreen } from "../screens/VirahiMaharajScreen";
import { TempleTimingsScreen } from "../screens/TempleTimingsScreen";
import { DailyQuotesScreen } from "../screens/DailyQuotesScreen";
import { InformationScreen } from "../screens/InformationScreen";
import { GlorificationReaderScreen } from "../screens/GlorificationReaderScreen";
import { OurCentersScreen } from "../screens/OurCentersScreen";
import { VaishnavCalendarScreen } from "../screens/VaishnavCalendarScreen";
import { VideosScreen } from "../screens/VideosScreen";
import { DonateScreen } from "../screens/DonateScreen";
import { DeityDarshanScreen } from "../screens/DeityDarshanScreen";
import { ActivitiesScreen } from "../screens/ActivitiesScreen";
import { BhajanReaderScreen } from "../screens/BhajanReaderScreen";
import { BooksScreen } from "../screens/BooksScreen";
import { BookViewerScreen } from "../screens/BookViewerScreen";
import { DownloadsScreen } from "../screens/DownloadsScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { LecturesScreen } from "../screens/LecturesScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { REOPEN_SETTINGS_KEY } from "../lib/uiScale";
import { storage } from "../lib/storage";
import { SongsScreen } from "../screens/SongsScreen";
import { WebScreen } from "../screens/WebScreen";
import { addToHistory } from "../store/historyStore";
import { useAppTheme } from "../theme/useAppTheme";
import type { Bhajan } from "../types";
import type { RootStackParamList, TabParamList } from "./types";
import { useTabsBackHandler } from "./useTabsBackHandler";

export type { RootStackParamList, TabParamList } from "./types";

// Tab set + order ported from components/JanmashtamiBottomNav.tsx in the
// Capacitor app: Books, Audio (lectures), Home (centre), Bhajans (songs),
// History (library). Icons and labels live in components/BottomNav.
// Downloads is a tab without a button, as App.tsx's "downloaded" view.
const TABS: { name: keyof TabParamList; component: () => React.ReactNode }[] = [
	{ name: "Books", component: BooksScreen },
	{ name: "Lectures", component: LecturesScreen },
	{ name: "Home", component: HomeScreen },
	{ name: "Songs", component: SongsScreen },
	{ name: "Library", component: HistoryScreen },
	{ name: "Downloads", component: DownloadsScreen },
];

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
// Browser preview (`npm run web`): lets checks drive the app from the console.
if (__DEV__ && Platform.OS === "web") (globalThis as { __nav?: unknown }).__nav = navigationRef;

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type RootProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

function ReaderRoute({ route, navigation }: RootProps<"Reader">) {
	return (
		<BhajanReaderScreen
			bhajan={route.params.bhajan}
			listQueueName={route.params.listQueueName}
			onBack={() => navigation.goBack()}
		/>
	);
}

// A katha opens in the bhajan reader, as App.tsx's handleOpenLecture did:
// its description is the page, its recordings the audio, its date the byline.
function LectureRoute({ route, navigation }: RootProps<"Lecture">) {
	const { lecture } = route.params;
	useEffect(() => addToHistory(lecture.id, "lecture"), [lecture.id]);
	const bhajan = useMemo<Bhajan>(
		() => ({
			id: `lecture_${lecture.id}`,
			title: lecture.title,
			titleIAST: lecture.title,
			firstLine: lecture.description.substring(0, 30),
			firstLineIAST: lecture.description.substring(0, 30),
			content: lecture.description,
			contentIAST: lecture.description,
			searchIndex: "",
			searchTokens: [],
			audio: lecture.audio,
			author: lecture.date ? `Date: ${lecture.date}` : undefined,
		}),
		[lecture],
	);
	return <BhajanReaderScreen bhajan={bhajan} onBack={() => navigation.goBack()} />;
}

function BookViewerRoute({ route, navigation }: RootProps<"BookViewer">) {
	return <BookViewerScreen book={route.params.book} onBack={() => navigation.goBack()} />;
}

function WebRoute({ route, navigation }: RootProps<"Web">) {
	return <WebScreen target={route.params.target} onClose={() => navigation.goBack()} />;
}

function SettingsRoute({ navigation }: RootProps<"Settings">) {
	return <SettingsScreen onBack={() => navigation.goBack()} />;
}

function AboutRoute({ navigation }: RootProps<"About">) {
	return <AboutScreen onBack={() => navigation.goBack()} />;
}

function PrivacyRoute({ navigation }: RootProps<"Privacy">) {
	return <PrivacyPolicyScreen onBack={() => navigation.goBack()} />;
}

function TermsRoute({ navigation }: RootProps<"Terms">) {
	return <TermsOfServiceScreen navigation={navigation} />;
}

function GuruMaharajRoute({ navigation }: RootProps<"GuruMaharaj">) {
	return <GuruMaharajScreen onBack={() => navigation.goBack()} />;
}

function VirahiMaharajRoute({ navigation }: RootProps<"VirahiMaharaj">) {
	return <VirahiMaharajScreen onBack={() => navigation.goBack()} />;
}

function TempleTimingsRoute({ route, navigation }: RootProps<"TempleTimings">) {
	return <TempleTimingsScreen initialMandalId={route.params?.initialMandalId} onBack={() => navigation.goBack()} />;
}

function DailyQuotesRoute({ navigation }: RootProps<"DailyQuotes">) {
	return <DailyQuotesScreen navigation={navigation} />;
}

function InformationRoute({ route, navigation }: RootProps<"Information">) {
	return <InformationScreen route={route} navigation={navigation} />;
}

function OurCentersRoute({ navigation }: RootProps<"OurCenters">) {
	return <OurCentersScreen onBack={() => navigation.goBack()} />;
}

function GlorificationReaderRoute({ navigation }: RootProps<"GlorificationReader">) {
	return <GlorificationReaderScreen onBack={() => navigation.goBack()} />;
}

function VaishnavCalendarRoute({ navigation }: RootProps<"VaishnavCalendar">) {
	return <VaishnavCalendarScreen navigation={navigation} onBack={() => navigation.goBack()} />;
}

function VideosRoute({ route, navigation }: RootProps<"Videos">) {
	return <VideosScreen route={route} navigation={navigation} />;
}

function DonateRoute({ route, navigation }: RootProps<"Donate">) {
	return <DonateScreen route={route} navigation={navigation} onBack={() => navigation.goBack()} />;
}

function DeityDarshanRoute({ route, navigation }: RootProps<"DeityDarshan">) {
	return <DeityDarshanScreen route={route} navigation={navigation} />;
}

function ActivitiesRoute({ route, navigation }: RootProps<"Activities">) {
	return <ActivitiesScreen route={route} navigation={navigation} />;
}

// The app bar sits above every tab, as App.tsx's fixed <Header>; the bottom
// nav (with the mini player above it) floats over the tab content. Reader,
// Lecture, Book and Settings open over all of it on the root stack.
function TabsNavigator() {
	const theme = useAppTheme();
	const setActiveTab = useTabsBackHandler();
	return (
		<View style={{ flex: 1, backgroundColor: theme.page }}>
			<PaperBackground />
			<AppHeader />
			<Tab.Navigator
				initialRouteName="Home"
				screenListeners={({ route }) => ({ focus: () => setActiveTab(route.name) })}
				tabBar={(props) => <BottomNav {...props} />}
				screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
			>
				{TABS.map(({ name, component }) => (
					<Tab.Screen key={name} name={name} component={component} />
				))}
			</Tab.Navigator>
			<SideMenu />
		</View>
	);
}

// A UI size change reloads the app (modules/ui-scale); land back on Settings,
// where the change was made.
function reopenSettingsAfterUiScale() {
	if (!storage.getBoolean(REOPEN_SETTINGS_KEY)) return;
	storage.remove(REOPEN_SETTINGS_KEY);
	navigationRef.navigate("Settings");
}

export function RootNavigator() {
	const theme = useAppTheme();

	return (
		<NavigationContainer
			ref={navigationRef}
			onReady={reopenSettingsAfterUiScale}
			theme={{
				dark: theme.isDark,
				colors: {
					primary: theme.primary,
					background: theme.background,
					card: theme.surface,
					text: theme.text,
					border: theme.border,
					notification: theme.accent,
				},
				fonts: {
					regular: { fontFamily: "System", fontWeight: "400" },
					medium: { fontFamily: "System", fontWeight: "500" },
					bold: { fontFamily: "System", fontWeight: "700" },
					heavy: { fontFamily: "System", fontWeight: "900" },
				},
			}}
		>
			<RootStack.Navigator screenOptions={{ headerShown: false }}>
				<RootStack.Screen name="Tabs" component={TabsNavigator} />
				<RootStack.Screen name="Reader" component={ReaderRoute} options={{ animation: "slide_from_bottom" }} />
				<RootStack.Screen name="Lecture" component={LectureRoute} options={{ animation: "slide_from_bottom" }} />
				<RootStack.Screen name="BookViewer" component={BookViewerRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="Settings" component={SettingsRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="About" component={AboutRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="Privacy" component={PrivacyRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="Terms" component={TermsRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="GuruMaharaj" component={GuruMaharajRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="VirahiMaharaj" component={VirahiMaharajRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="TempleTimings" component={TempleTimingsRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="DailyQuotes" component={DailyQuotesRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="Information" component={InformationRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="OurCenters" component={OurCentersRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="GlorificationReader" component={GlorificationReaderRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="VaishnavCalendar" component={VaishnavCalendarRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="Videos" component={VideosRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="Donate" component={DonateRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="DeityDarshan" component={DeityDarshanRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="Activities" component={ActivitiesRoute} options={{ animation: "slide_from_right" }} />
				<RootStack.Screen name="Web" component={WebRoute} options={{ animation: "fade" }} />
				<RootStack.Screen name="Login" component={LoginScreen} options={{ animation: "slide_from_bottom" }} />
			</RootStack.Navigator>
		</NavigationContainer>
	);
}

import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import { enableScreens } from 'react-native-screens';

import App from './App';

// Browser preview (`npm run web`): hide inactive tabs as the phone does
// (react-native-screens is off on the web by default, so every tab stays drawn).
// Also draw Hindi with the Noto Devanagari faces an Android phone uses (via
// families in react-native-web's stacks), so text wraps as on the phone; the
// font files come from the preview server.
if (Platform.OS === 'web') {
	enableScreens(true);
	const style = document.createElement('style');
	style.textContent = `
@font-face { font-family: "BlinkMacSystemFont"; src: url("http://localhost:8090/fonts/NotoSansDevanagari-Variable.woff2") format("woff2"); font-weight: 100 900; unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839; }
@font-face { font-family: "serif"; src: url("http://localhost:8090/fonts/NotoSerifDevanagari-Variable.woff2") format("woff2"); font-weight: 100 900; unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839; }
`;
	document.head.appendChild(style);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

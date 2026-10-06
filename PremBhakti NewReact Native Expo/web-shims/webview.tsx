// Browser stand-in for react-native-webview: an <iframe>.
//
// The bundled web build is served by scripts/web-preview-server.js on
// http://localhost:8090 (instead of the app's https://localhost). That server
// puts a first <script> into the page which runs the "before content loaded"
// script handed over in window.name, gives the page window.ReactNativeWebView
// (posting to this frame's parent) and runs injectJavaScript calls sent here.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";

export const PREVIEW_ORIGIN = "http://localhost:8090";

export type WebViewMessageEvent = { nativeEvent: { data: string } };
type Props = {
	source?: { uri?: string; html?: string; baseUrl?: string };
	injectedJavaScriptBeforeContentLoaded?: string;
	onMessage?: (e: WebViewMessageEvent) => void;
	onLoadEnd?: () => void;
	style?: object;
	// biome-ignore lint/suspicious/noExplicitAny: the WebView props this stand-in ignores
	[key: string]: any;
};
export type WebView = { injectJavaScript(code: string): void; reload(): void; goBack(): void };

const POST_SHIM = "<script>window.ReactNativeWebView={postMessage:function(d){parent.postMessage({__rnwv:String(d)},'*')}};</script>";

const WebViewImpl = forwardRef<WebView, Props>(function WebView(props, ref) {
	const frame = useRef<HTMLIFrameElement>(null);
	const onMessage = useRef(props.onMessage);
	onMessage.current = props.onMessage;

	useImperativeHandle(ref, () => ({
		injectJavaScript: (code) => frame.current?.contentWindow?.postMessage({ __rnwvInject: code }, "*"),
		reload: () => frame.current?.contentWindow?.location.reload(),
		goBack: () => frame.current?.contentWindow?.history.back(),
	}));

	useEffect(() => {
		const listener = (e: MessageEvent) => {
			if (e.source !== frame.current?.contentWindow) return;
			const data = e.data as { __rnwv?: string; __rnwvLog?: string } | null;
			if (data && typeof data.__rnwvLog === "string") console.log("[webview]", data.__rnwvLog);
			if (data && typeof data.__rnwv === "string") onMessage.current?.({ nativeEvent: { data: data.__rnwv } });
		};
		window.addEventListener("message", listener);
		return () => window.removeEventListener("message", listener);
	}, []);

	const { source } = props;
	const style = { border: 0, width: "100%", height: "100%", background: "transparent" };
	return (
		<View style={props.style}>
			{source?.html != null ? (
				<iframe ref={frame} title="webview" srcDoc={POST_SHIM + source.html} style={style} onLoad={props.onLoadEnd} />
			) : (
				<iframe
					ref={frame}
					title="webview"
					name={props.injectedJavaScriptBeforeContentLoaded ?? ""}
					src={source?.uri?.replace(/^https:\/\/localhost/, PREVIEW_ORIGIN)}
					allow="autoplay; clipboard-write; microphone"
					style={style}
					onLoad={props.onLoadEnd}
				/>
			)}
		</View>
	);
});
export default WebViewImpl;

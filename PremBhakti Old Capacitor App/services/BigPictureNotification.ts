import { type PluginListenerHandle, registerPlugin } from "@capacitor/core";

export interface BigPictureOptions {
	title: string;
	body: string;
	imageUrl: string;
	type?: string;
	target_screen?: string;
	target_link?: string;
	action_type?: string;
	cachedPath?: string; // absolute local file path for offline-safe image loading
}

export interface BigPictureNotificationPlugin {
	show(options: BigPictureOptions): Promise<void>;

	consumeLaunchAction(): Promise<{
		action?: string;
		screen?: string;
		link?: string;
	}>;
	addListener(
		eventName: "notificationActionPerformed",
		listenerFunc: (data: {
			action: string;
			screen?: string;
			link?: string;
		}) => void,
	): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const BigPictureNotification = registerPlugin<BigPictureNotificationPlugin>(
	"BigPictureNotification",
);

export default BigPictureNotification;

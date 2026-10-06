import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { SkipBack, SkipForward } from "lucide-react-native";

interface Props {
	video: any;
	onNext: () => void;
	onPrev: () => void;
	hasNext: boolean;
	hasPrev: boolean;
	onFullscreenChange: (isFullscreen: boolean) => void;
}

export function CustomVideoPlayer({ video, onNext, onPrev, hasNext, hasPrev, onFullscreenChange }: Props) {
	const videoSource = video.hdUrl || video.url;
	const [isFullscreen, setIsFullscreen] = React.useState(false);

	const player = useVideoPlayer(videoSource, player => {
		player.loop = false;
		player.play();
	});

	useEffect(() => {
		onFullscreenChange(isFullscreen);
	}, [isFullscreen, onFullscreenChange]);

	// In expo-video, the VideoView provides full native controls (including double-tap to seek, PiP, fullscreen).
	// We just provide the next/prev buttons below it like YouTube does.

	return (
		<View style={styles.container}>
			<VideoView
				player={player}
				style={styles.videoView}
				allowsPictureInPicture
				nativeControls={true}
				onFullscreenEnter={() => setIsFullscreen(true)}
				onFullscreenExit={() => setIsFullscreen(false)}
			/>
			{/* We don't render manual Prev/Next overlay on top of the native player to avoid clashing with native controls,
			    but we could render them in a bar below the player if not fullscreen. In the modal, they are already rendered
			    in the metadata section for YouTube. Let's add them here for consistency if needed, but we already have them
				in the infoSection? No, infoSection only has ytControlsRow for YouTube! 
				Let's add them to the modal for MP4 as well, or just render a bar here. */}
			{!isFullscreen && (
				<View style={styles.controlsRow}>
					<Pressable style={[styles.controlBtn, !hasPrev && styles.controlBtnDisabled]} onPress={onPrev} disabled={!hasPrev}>
						<SkipBack size={14} color={hasPrev ? "#fff" : "#525252"} />
						<Text style={[styles.controlText, !hasPrev && { color: "#525252" }]}>Prev</Text>
					</Pressable>
					<Pressable style={[styles.controlBtn, !hasNext && styles.controlBtnDisabled]} onPress={onNext} disabled={!hasNext}>
						<Text style={[styles.controlText, !hasNext && { color: "#525252" }]}>Next</Text>
						<SkipForward size={14} color={hasNext ? "#fff" : "#525252"} />
					</Pressable>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
	},
	videoView: {
		flex: 1,
		width: "100%",
		height: "100%",
	},
	controlsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		padding: 8,
		backgroundColor: "#171717",
		borderTopWidth: 1,
		borderTopColor: "#262626",
	},
	controlBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: "#262626",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20,
	},
	controlBtnDisabled: {
		backgroundColor: "rgba(38,38,38,0.5)",
	},
	controlText: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "600",
	},
});

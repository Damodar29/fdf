import { Capacitor } from "@capacitor/core";
import {
	AlertCircle,
	ArrowLeft,
	ListVideo,
	Loader2,
	Play,
	X,
	Youtube,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface YouTubeScreenProps {
	onBack: () => void;
	settingsLanguage?: "en" | "hi";
}

interface Playlist {
	id: string;
	title: string;
}

interface Video {
	id: string;
	title: string;
	thumbnail: string;
}

const CHANNEL_ID = "UC3i5l3jbvNcnvd72DP1oPsA";
const UPLOADS_PLAYLIST_ID = "UU3i5l3jbvNcnvd72DP1oPsA"; // Usually 'UU' + channel ID minus 'UC'
// Use Android-restricted key on native Android app, website-restricted key on browser/web
const API_KEY = Capacitor.isNativePlatform()
	? import.meta.env.VITE_YOUTUBE_ANDROID_API_KEY || ""
	: import.meta.env.VITE_YOUTUBE_API_KEY || "";

const VideoPlayerItem = ({ video }: { video: Video }) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting && isPlaying) {
						setIsPlaying(false);
					}
				});
			},
			{ threshold: 0.2 },
		);

		if (containerRef.current) {
			observer.observe(containerRef.current);
		}

		return () => observer.disconnect();
	}, [isPlaying]);

	return (
		<div
			ref={containerRef}
			id={`video-${video.id}`}
			className="w-full h-full snap-start snap-always relative flex items-center justify-center bg-black group overflow-hidden"
		>
			{!isPlaying ? (
				<button
					className="w-full h-full max-w-3xl mx-auto relative focus:outline-none block"
					onClick={() => setIsPlaying(true)}
				>
					<img
						src={video.thumbnail}
						alt={video.title}
						className="w-full h-full object-cover sm:object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-300"
						loading="lazy"
					/>
					<div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-transparent transition-colors duration-300">
						<div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
							<Play
								className="w-8 h-8 text-white ml-1 filter drop-shadow-md"
								fill="currentColor"
							/>
						</div>
					</div>
					<div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
						<h3 className="text-white text-lg font-bold text-left line-clamp-3 text-shadow-sm leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
							{video.title}
						</h3>
					</div>
				</button>
			) : (
				<iframe
					loading="lazy"
					className="w-full h-full max-w-3xl mx-auto animate-in fade-in duration-500"
					src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
					title={video.title}
					frameBorder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					allowFullScreen
				></iframe>
			)}
		</div>
	);
};

export const YouTubeScreen: React.FC<YouTubeScreenProps> = ({
	onBack,
	settingsLanguage = "hi",
}) => {
	const isHindi = settingsLanguage === "hi";
	const [playlists, setPlaylists] = useState<Playlist[]>([]);
	const [activePlaylistId, setActivePlaylistId] =
		useState<string>(UPLOADS_PLAYLIST_ID);
	const [videos, setVideos] = useState<Video[]>([]);
	const [loadingPlaylists, setLoadingPlaylists] = useState(true);
	const [loadingVideos, setLoadingVideos] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showList, setShowList] = useState(false);
	// Back-button: showList
	useEffect(() => {
		if (showList)
			window.history.pushState({ isPopup: true, view: "youtube-list" }, "");
	}, [showList]);
	const handleClose_youtube_list = () => {
		if (window.history.state?.view === "youtube-list") window.history.back();
		else setShowList(false);
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_youtube_list is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const _h_youtube_list = (e: PopStateEvent) => {
			if (showList && e.state?.view !== "youtube-list")
				handleClose_youtube_list();
		};
		window.addEventListener("popstate", _h_youtube_list);
		return () => window.removeEventListener("popstate", _h_youtube_list);
	}, [showList]);

	const t = {
		title: isHindi ? "यूट्यूब चैनल" : "YouTube Channel",
		loading: isHindi ? "लोड हो रहा है..." : "Loading...",
		allVideos: isHindi ? "सभी वीडियो" : "All Videos",
		error: isHindi
			? "कुछ गलत हो गया। कृपया बाद में प्रयास करें।"
			: "Something went wrong. Please try again later.",
	};

	// Fetch Playlists
	useEffect(() => {
		const fetchPlaylists = async () => {
			try {
				setLoadingPlaylists(true);
				const response = await fetch(
					`https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId=${CHANNEL_ID}&maxResults=50&key=${API_KEY}`,
				);
				const data = await response.json();

				if (data.error) {
					throw new Error(data.error.message);
				}

				const fetchedPlaylists = data.items.map((item: any) => ({
					id: item.id,
					title: item.snippet.title,
				}));

				// Add "All Videos" (Uploads) as the first category
				setPlaylists([
					{
						id: UPLOADS_PLAYLIST_ID,
						title: isHindi ? "सभी वीडियो" : "All Videos",
					},
					...fetchedPlaylists,
				]);
			} catch (err) {
				console.error("Error fetching playlists:", err);
				setError(
					isHindi
						? "कुछ गलत हो गया। कृपया बाद में प्रयास करें।"
						: "Something went wrong. Please try again later.",
				);
			} finally {
				setLoadingPlaylists(false);
			}
		};

		fetchPlaylists();
	}, [isHindi]);

	// Fetch Videos when active playlist changes
	useEffect(() => {
		const fetchVideos = async () => {
			try {
				setLoadingVideos(true);
				setVideos([]);
				const response = await fetch(
					`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${activePlaylistId}&maxResults=50&key=${API_KEY}`,
				);
				const data = await response.json();

				if (data.error) {
					throw new Error(data.error.message);
				}

				const fetchedVideos = data.items
					.filter((item: any) => item.snippet.resourceId.videoId) // Ensure it's a video
					.map((item: any) => ({
						id: item.snippet.resourceId.videoId,
						title: item.snippet.title,
						thumbnail:
							item.snippet.thumbnails?.high?.url ||
							item.snippet.thumbnails?.default?.url,
					}));

				setVideos(fetchedVideos);
			} catch (err) {
				console.error("Error fetching videos:", err);
				setError(
					isHindi
						? "कुछ गलत हो गया। कृपया बाद में प्रयास करें।"
						: "Something went wrong. Please try again later.",
				);
			} finally {
				setLoadingVideos(false);
			}
		};

		if (activePlaylistId) {
			fetchVideos();
		}
	}, [activePlaylistId, isHindi]);

	return (
		<div className="fixed inset-0 z-50 bg-black flex flex-col animate-in slide-in-from-right duration-300 font-sans">
			{/* Header */}
			<div className="flex-none bg-red-600 text-white p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between shadow-lg z-20 sticky top-0">
				<div className="flex items-center gap-3">
					<button
						onClick={onBack}
						className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
					<h2 className="text-lg font-bold flex items-center gap-2 tracking-wide leading-none drop-shadow-md">
						<Youtube className="w-5 h-5" />
						{t.title}
					</h2>
				</div>
				<button
					onClick={() => setShowList(true)}
					className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95 flex items-center gap-1"
					title="Playlists"
				>
					<ListVideo className="w-5 h-5" />
				</button>
			</div>

			{/* Categories (Playlists) */}
			{!loadingPlaylists && playlists.length > 0 && (
				<div className="flex-none bg-zinc-900 border-b border-zinc-800 z-10">
					<div className="flex overflow-x-auto hide-scrollbar p-3 gap-2">
						{playlists.map((playlist) => (
							<button
								key={playlist.id}
								onClick={() => setActivePlaylistId(playlist.id)}
								className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
									activePlaylistId === playlist.id
										? "bg-red-600 text-white shadow-md"
										: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
								}`}
							>
								{playlist.title}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Content Area */}
			<div className="flex-1 relative bg-black overflow-hidden">
				{error ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 p-6 text-center">
						<AlertCircle className="w-12 h-12 mb-4 text-red-500" />
						<p>{error}</p>
					</div>
				) : loadingVideos ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center z-0">
						<Loader2 className="animate-spin text-red-600 mb-4" size={32} />
						<p className="text-zinc-400 font-medium">{t.loading}</p>
					</div>
				) : (
					/* Swipeable Feed using CSS Scroll Snapping */
					<div className="w-full h-full overflow-y-auto snap-y snap-mandatory hide-scrollbar">
						{videos.map((video) => (
							<VideoPlayerItem key={video.id} video={video} />
						))}

						{videos.length === 0 && (
							<div className="w-full h-full flex items-center justify-center text-zinc-500">
								No videos found in this category.
							</div>
						)}
					</div>
				)}
			</div>

			{/* Video List Overlay */}
			{showList && (
				<div className="absolute inset-0 z-40 bg-zinc-950 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
					<div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 pt-[calc(1rem+env(safe-area-inset-top))]">
						<h3 className="text-white font-bold text-lg">
							{playlists.find((p) => p.id === activePlaylistId)?.title ||
								t.allVideos}
						</h3>
						<button
							onClick={() => handleClose_youtube_list()}
							className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
						>
							<X className="w-6 h-6" />
						</button>
					</div>
					<div className="flex-1 overflow-y-auto p-2">
						{videos.map((video) => (
							<button
								key={video.id}
								onClick={() => {
									handleClose_youtube_list();
									const el = document.getElementById(`video-${video.id}`);
									if (el) el.scrollIntoView({ behavior: "smooth" });
								}}
								className="w-full flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg text-left transition-colors mb-2"
							>
								<div className="relative w-32 aspect-video bg-zinc-800 rounded overflow-hidden flex-shrink-0">
									<img
										src={video.thumbnail}
										alt={video.title}
										className="w-full h-full object-cover"
									/>
								</div>
								<div className="flex-1">
									<p className="text-white text-sm line-clamp-2">
										{video.title}
									</p>
								</div>
							</button>
						))}
					</div>
				</div>
			)}

			<style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
		</div>
	);
};

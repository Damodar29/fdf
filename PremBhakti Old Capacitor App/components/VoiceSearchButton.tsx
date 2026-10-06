import { Capacitor } from "@capacitor/core";
import { AlertCircle, Mic, MicOff, Settings, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "../context/ToastContext";
import { usePopupBackHandler } from "../src/hooks/usePopupBackHandler";
import { triggerHaptic } from "../utils/haptic";

interface IWindow extends Window {
	SpeechRecognition?: any;
	webkitSpeechRecognition?: any;
}

interface VoiceSearchButtonProps {
	onResult: (transcript: string) => void;
	lang?: string;
	className?: string;
	size?: number;
	title?: string;
}

/**
 * Reusable Google Voice Search button (🎤) that works across Chrome/Edge/Android WebView & Capacitor.
 * Uses Google's Speech Recognition engine natively and includes a helpful App Settings
 * permission recovery dialog if the user accidentally denied microphone access.
 */
export const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
	onResult,
	lang = "hi-IN", // hi-IN recognises Hindi speech as well as English/Hinglish terms accurately
	className = "",
	size = 18,
	title = "Google Voice Search (बोलकर खोजें)",
}) => {
	const [isListening, setIsListening] = useState(false);
	const [_isSupported, setIsSupported] = useState(true);
	const [showPermissionModal, setShowPermissionModal] = useState(false);
	const recognitionRef = useRef<any>(null);
	const { showToast } = useToast();

	const closePermissionModal = usePopupBackHandler(
		showPermissionModal,
		"mic-permission",
		() => setShowPermissionModal(false),
	);

	useEffect(() => {
		if (!showPermissionModal) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closePermissionModal();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showPermissionModal, closePermissionModal]);

	useEffect(() => {
		const SpeechRecognition =
			(window as IWindow).SpeechRecognition ||
			(window as IWindow).webkitSpeechRecognition;

		if (!SpeechRecognition) {
			setIsSupported(false);
		}
	}, []);

	useEffect(() => {
		return () => {
			if (recognitionRef.current) {
				try {
					recognitionRef.current.abort();
				} catch (_e) {
					// ignore cleanup errors
				}
			}
		};
	}, []);

	/**
	 * Opens Android / iOS application settings so user can re-allow microphone access.
	 */
	const handleOpenSettings = async () => {
		try {
			if (Capacitor.isNativePlatform()) {
				const { NativeSettings, AndroidSettings, IOSSettings } = await import(
					"capacitor-native-settings"
				);
				if (Capacitor.getPlatform() === "ios") {
					await NativeSettings.openIOS({ option: IOSSettings.App });
				} else {
					await NativeSettings.openAndroid({
						option: AndroidSettings.ApplicationDetails,
					});
				}
			} else {
				showToast(
					"अपने ब्राउज़र के एड्रेस बार में 🔒 (Lock icon) पर क्लिक करके Microphone Allow करें।",
					"info",
				);
			}
		} catch (e) {
			console.error("Failed to open app settings:", e);
			showToast(
				"सेटिंग्स नहीं खुल सकी। कृपया अपने फोन की Settings -> Apps में जाएँ।",
				"error",
			);
		}
		closePermissionModal();
	};

	const handleToggleListen = async (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();

		if (isListening) {
			triggerHaptic("light");
			try {
				recognitionRef.current?.stop();
			} catch (_err) {
				// ignore
			}
			setIsListening(false);
			return;
		}

		// Removed proactive navigator.permissions.query check because it can be flaky/cached in Android WebViews.
		// We will rely on recognition.onerror capturing 'not-allowed' instead.

		const SpeechRecognition =
			(window as IWindow).SpeechRecognition ||
			(window as IWindow).webkitSpeechRecognition;

		if (!SpeechRecognition) {
			showToast(
				"Voice Search is not supported on this browser/device.",
				"error",
			);
			return;
		}

		// Try explicitly asking for mic permission on Web to force the browser prompt
		if (
			!Capacitor.isNativePlatform() &&
			navigator.mediaDevices &&
			navigator.mediaDevices.getUserMedia
		) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				stream.getTracks().forEach((track) => track.stop());
			} catch (err) {
				console.warn("Microphone access denied via getUserMedia:", err);
				setShowPermissionModal(true);
				return;
			}
		}

		triggerHaptic("medium");

		try {
			const recognition = new SpeechRecognition();
			recognition.continuous = false;
			recognition.interimResults = true;
			recognition.lang = lang;
			recognition.maxAlternatives = 1;

			recognition.onstart = () => {
				setIsListening(true);
				showToast("सुन रहे हैं... (Speak now)", "info");
			};

			recognition.onresult = (event: any) => {
				let interimTranscript = "";
				let finalTranscript = "";

				for (let i = event.resultIndex; i < event.results.length; ++i) {
					const result = event.results[i];
					if (result.isFinal) {
						finalTranscript += result[0].transcript;
					} else {
						interimTranscript += result[0].transcript;
					}
				}

				const currentText = (finalTranscript || interimTranscript).trim();
				if (currentText) {
					onResult(currentText);
				}
			};

			recognition.onerror = (event: any) => {
				console.warn("Speech recognition error:", event.error);
				setIsListening(false);
				if (
					event.error === "not-allowed" ||
					event.error === "permission-denied"
				) {
					setShowPermissionModal(true);
				} else if (event.error === "no-speech") {
					showToast(
						"कोई आवाज़ नहीं सुनी गई। फिर से प्रयास करें। (No speech detected)",
						"info",
					);
				} else if (event.error === "aborted") {
					// User stopped listening, or another recognition took over — not an error.
				} else if (event.error === "network") {
					// Either the device is offline, or the browser exposes the Speech API
					// without a working recognition service (e.g. Brave), which always
					// fails with "network".
					showToast(
						navigator.onLine
							? "इस ब्राउज़र में Voice Search उपलब्ध नहीं है। कृपया Chrome या ऐप का उपयोग करें। (Voice Search isn't available in this browser)"
							: "इंटरनेट कनेक्शन नहीं है। (Voice Search needs internet)",
						"error",
					);
				} else if (event.error === "audio-capture") {
					showToast("माइक्रोफ़ोन नहीं मिला। (No microphone found)", "error");
				} else {
					showToast(`Voice Search Error: ${event.error}`, "error");
				}
			};

			recognition.onend = () => {
				setIsListening(false);
			};

			recognitionRef.current = recognition;
			recognition.start();
		} catch (err: any) {
			console.error("Failed to start speech recognition:", err);
			setIsListening(false);
			showToast("Voice Search प्रारंभ करने में विफल। कृपया फिर से प्रयास करें।", "error");
		}
	};

	// Button will always render. If not supported, clicking it will show an error toast.

	return (
		<>
			<button
				type="button"
				onClick={handleToggleListen}
				title={title}
				aria-label={title}
				className={`relative shrink-0 p-1.5 rounded-full transition-all duration-200 flex items-center justify-center ${
					isListening
						? "text-red-500 bg-red-500/10 dark:bg-red-500/20 shadow-sm animate-pulse scale-110"
						: "text-slate-400 dark:text-ink-400 hover:text-ry-gold hover:scale-105"
				} ${className}`}
			>
				{isListening ? (
					<>
						<span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
						<Mic size={size} className="relative z-10 text-red-500" />
					</>
				) : (
					<Mic size={size} />
				)}
			</button>

			{/* Permission Recovery Modal */}
			{showPermissionModal &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
						onClick={(e) => {
							e.stopPropagation();
							closePermissionModal();
						}}
					>
						<div
							className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in-95 duration-200 relative"
							onClick={(e) => e.stopPropagation()}
						>
							<button
								onClick={() => closePermissionModal()}
								className="absolute right-4 top-4 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full transition-colors"
								aria-label="Close modal"
							>
								<X size={20} />
							</button>

							<div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mx-auto mb-4 w-16 h-16 flex items-center justify-center">
								<MicOff size={32} />
							</div>

							<h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2 flex items-center justify-center gap-1.5">
								<AlertCircle size={20} className="text-red-500 inline" />
								माइक्रोफ़ोन अनुमति आवश्यक
							</h3>

							<p className="text-sm text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
								आपने माइक्रोफ़ोन की अनुमति अस्वीकार (Deny) कर दी है। बोलकर भजन या पुस्तकें
								खोजने के लिए कृपया ऐप सेटिंग्स में जाकर <strong>Microphone</strong> की
								अनुमति (Allow) दें।
							</p>
							<p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
								You have denied microphone access. Please enable microphone
								permission in App Settings to use Voice Search.
							</p>

							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={() => closePermissionModal()}
									className="py-3 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-all"
								>
									रद्द करें (Cancel)
								</button>
								<button
									type="button"
									onClick={handleOpenSettings}
									className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
								>
									<Settings size={18} />
									सेटिंग्स खोलें (Open Settings)
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
};

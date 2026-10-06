import {
	ChevronLeft,
	Loader2,
	MapPin,
	Mic,
	Pause,
	Play,
	Send,
	Sparkles,
	Square,
	Trash2,
	UploadCloud,
	User as UserIcon,
	Volume2,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { MANDAL_LIST } from "../src/types/mandal";
import { normalizeB2Url, uploadFileToB2 } from "../src/utils/b2Uploader";
import {
	getUserGlorifications,
	type HHBSMGlorificationEntry,
	saveHHBSMGlorification,
	updateHHBSMGlorification,
} from "../src/utils/hhbsmGlorificationStorage";
import { triggerHaptic } from "../utils/haptic";
import { ThumbImg } from "./ui/ThumbImg";

interface GlorificationModalProps {
	isOpen: boolean;
	onClose: () => void;
	settingsLanguage: "en" | "hi";
	onSuccess: () => void;
	onOpenProfile: () => void;
}

const MAX_WORDS = 1200;
const MAX_WORD_LENGTH = 50; // single word max chars
const MAX_FIELD_LENGTH = 100;

/** Count words in a string */
const countWords = (text: string): number =>
	text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

/** Check if any single word exceeds MAX_WORD_LENGTH */
const hasLongWord = (text: string): boolean =>
	text.split(/\s+/).some((w) => w.length > MAX_WORD_LENGTH);

export const GlorificationModal: React.FC<GlorificationModalProps> = ({
	isOpen,
	onClose,
	settingsLanguage,
	onSuccess,
	onOpenProfile,
}) => {
	const isHindi = settingsLanguage === "hi";
	const { user, profile } = useAuth();
	const { showToast } = useToast();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const [step, setStep] = useState<"write" | "preview" | "list">("write");
	const [activeTab, setActiveTab] = useState<"text" | "audio">("text");

	// Text state
	const [glorification, setGlorification] = useState("");

	// Audio state
	const [recordingState, setRecordingState] = useState<
		"idle" | "recording" | "paused" | "recorded" | "uploading"
	>("idle");
	const [recordingTime, setRecordingTime] = useState(0);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const _timerRef = useRef<NodeJS.Timeout | null>(null);
	const isSubmittingRef = useRef(false);

	// General state
	const [name, setName] = useState("");
	const [location, setLocation] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoadingExisting, setIsLoadingExisting] = useState(false);
	const [existingEntries, setExistingEntries] = useState<
		HHBSMGlorificationEntry[]
	>([]);

	useEffect(() => {
		isSubmittingRef.current = isSubmitting;
	}, [isSubmitting]);

	const deriveNameFromProfile = (): string =>
		(
			profile?.realName ||
			profile?.dikshaName ||
			user?.displayName ||
			""
		).trim();

	const deriveLocationFromProfile = (): string => {
		if (!profile?.mandalId) return "";
		if (profile.mandalId === "custom")
			return (profile.customMandalName || "").trim();
		const found = MANDAL_LIST.find((m) => m.id === profile.mandalId);
		if (!found) return "";
		return isHindi ? found.shortNameHi : found.shortNameEn;
	};

	// Audio Timer logic
	useEffect(() => {
		let timerId: ReturnType<typeof setInterval>;
		if (recordingState === "recording") {
			timerId = setInterval(() => {
				setRecordingTime((prev) => {
					if (prev >= 600) return 600;
					return prev + 1;
				});
			}, 1000);
		}
		return () => {
			if (timerId) clearInterval(timerId);
		};
	}, [recordingState]);

	const stopRecording = () => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== "inactive"
		) {
			mediaRecorderRef.current.stop();
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: stopRecording is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (recordingTime === 540) {
			showToast(isHindi ? "१ मिनट शेष" : "1 minute remaining", "info");
		}
		if (recordingTime >= 600 && recordingState === "recording") {
			stopRecording();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [recordingTime]);

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	// Audio functions
	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
				? { mimeType: "audio/webm;codecs=opus" }
				: MediaRecorder.isTypeSupported("audio/mp4")
					? { mimeType: "audio/mp4" }
					: {};

			const recorder = new MediaRecorder(stream, options);
			mediaRecorderRef.current = recorder;
			audioChunksRef.current = [];

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunksRef.current.push(e.data);
			};

			recorder.onstop = () => {
				const blob = new Blob(audioChunksRef.current, {
					type: recorder.mimeType,
				});
				setAudioBlob(blob);
				const url = URL.createObjectURL(blob);
				setAudioObjectUrl(url);
				setRecordingState("recorded");
				stream.getTracks().forEach((track) => track.stop());
			};

			recorder.start(200);
			setRecordingState("recording");
			setRecordingTime(0);
		} catch (err) {
			console.error("Mic error:", err);
			showToast(
				isHindi ? "माइक एक्सेस नहीं मिला।" : "Microphone access denied.",
				"error",
			);
		}
	};

	const pauseRecording = () => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.pause();
			setRecordingState("paused");
		}
	};

	const resumeRecording = () => {
		if (mediaRecorderRef.current?.state === "paused") {
			mediaRecorderRef.current.resume();
			setRecordingState("recording");
		}
	};

	const deleteRecording = () => {
		setAudioBlob(null);
		if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
		setAudioObjectUrl(null);
		setRecordingTime(0);
		setRecordingState("idle");
	};

	// Load existing submissions and reset form every time the screen opens
	// biome-ignore lint/correctness/useExhaustiveDependencies: deleteRecording, stopRecording, deriveLocationFromProfile, deriveNameFromProfile are recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (!isOpen) {
			stopRecording();
			deleteRecording();
			return;
		}
		setExistingEntries([]);
		setGlorification("");
		setActiveTab("text");
		deleteRecording();

		const derivedName = user ? deriveNameFromProfile() : "";
		const derivedLocation = user ? deriveLocationFromProfile() : "";
		setName(derivedName);
		setLocation(derivedLocation);

		if (user) {
			setIsLoadingExisting(true);
			getUserGlorifications(user.uid)
				.then((entries) => {
					setExistingEntries(entries);
					if (entries.length > 0) {
						setStep("list");
						setName(entries[0].name || derivedName);
						setLocation(entries[0].location || derivedLocation);
					} else {
						setStep("write");
					}
				})
				.catch((err) => {
					console.error("Failed to load existing glorifications", err);
				})
				.finally(() => setIsLoadingExisting(false));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, user?.uid]);

	// Back-button support
	// biome-ignore lint/correctness/useExhaustiveDependencies: per-render functions/callbacks left out on purpose (as deps they re-ran this hook every render)
	useEffect(() => {
		if (!isOpen) return;
		const id = `glorification-screen-${Date.now()}`;
		window.history.pushState({ isPopup: true, modalId: id }, "");
		const handler = () => {
			if (isSubmittingRef.current) {
				// Prevent closing during upload, push state back
				window.history.pushState({ isPopup: true, modalId: id }, "");
				showToast(
					isHindi
						? "अपलोड हो रहा है, कृपया प्रतीक्षा करें"
						: "Uploading, please wait",
					"warning",
				);
			} else {
				onClose();
			}
		};
		window.addEventListener("popstate", handler);
		return () => {
			window.removeEventListener("popstate", handler);
			if (window.history.state?.modalId === id && !isSubmittingRef.current)
				window.history.back();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	if (!isOpen) return null;

	const hasProfileName = !!deriveNameFromProfile();
	const hasProfileLocation = !!deriveLocationFromProfile();
	const hasCompleteProfile = !!user && hasProfileName && hasProfileLocation;

	// Effective name/location: profile if complete, else manual entry
	const effectiveName = hasProfileName ? deriveNameFromProfile() : name;
	const effectiveLocation = hasProfileLocation
		? deriveLocationFromProfile()
		: location;

	const t = {
		title: isHindi ? "गुरु महाराज जी की महिमा" : "Glorify Guru Maharaj Ji",
		loginRequired: isHindi
			? "आगे बढ़ने के लिए कृपया पहले लॉगिन करें।"
			: "Please login first to write your glorification.",
		loginBtn: isHindi ? "लॉगिन करें" : "Login",
		placeholder: isHindi
			? "यहाँ अपनी भावनाएँ लिखें..."
			: "Write your glorification here...",
		namePlaceholder: isHindi ? "अपना नाम दर्ज करें" : "Enter your name",
		locationPlaceholder: isHindi
			? "अपना शहर या मंडल दर्ज करें"
			: "Enter your city or Mandal",
		next: isHindi ? "आगे देखें" : "Preview",
		back: isHindi ? "वापस" : "Back",
		save: isHindi ? "पुष्टि करें" : "Confirm & Save",
		update: isHindi ? "अपडेट करें" : "Update",
		emptyError: isHindi
			? "कृपया अपनी भावनाएं लिखें"
			: "Please write your glorification",
		genericError: isHindi
			? "सहेजने में समस्या हुई। कृपया पुनः प्रयास करें।"
			: "Something went wrong. Please try again.",
		editBanner: isHindi
			? "✏️ आप अपनी पूर्व महिमा संपादित कर रहे हैं"
			: "✏️ Editing your previous glorification",
		previewTitle: isHindi ? "पूर्वावलोकन" : "Preview",
		previewSubtitle: isHindi
			? "जांचें और सहेजें।"
			: "Review your glorification before saving.",
		submittedBy: isHindi ? "द्वारा" : "by",
		incompleteProfile: isHindi
			? "प्रोफाइल अधूरा है। नाम/मंडल दर्ज करें:"
			: "Profile incomplete. Enter name/location:",
		tabWrite: isHindi ? "✍ लिखें" : "✍ Write",
		tabRecord: isHindi ? "🎙 रिकॉर्ड करें (ऑडियो)" : "🎙 Record (Audio)",
		recordInfo: isHindi
			? "आप अपनी महिमा 10 मिनट तक रिकॉर्ड कर सकते हैं। (यह वॉयस टाइपिंग नहीं है, बल्कि आपकी आवाज़ सीधे भेजी जाएगी)"
			: "You can record your audio message for up to 10 minutes. (This is not voice typing, your voice will be sent directly)",
	};

	const getPhoneAndEmail = () => {
		const phone = profile?.phoneNumber || user?.phoneNumber || "";
		const email = profile?.email || user?.email || "";
		return { phone, email };
	};

	const performSave = async () => {
		if (isSubmitting) return;
		const trimmedGlory = glorification.trim();
		if (!trimmedGlory) {
			showToast(t.emptyError, "warning");
			return;
		}
		if (countWords(trimmedGlory) > MAX_WORDS) {
			showToast(
				isHindi
					? `कृपया ${MAX_WORDS} शब्दों से कम लिखें।`
					: `Please keep it under ${MAX_WORDS} words.`,
				"warning",
			);
			return;
		}
		if (hasLongWord(trimmedGlory)) {
			showToast(
				isHindi
					? "एक शब्द बहुत लंबा है (अधिकतम 50 अक्षर प्रति शब्द)"
					: "A word is too long (max 50 characters per word)",
				"warning",
			);
			return;
		}
		const finalName = effectiveName.trim() || name.trim();
		const finalLocation = effectiveLocation.trim() || location.trim();
		if (!finalName || !finalLocation) {
			showToast(
				isHindi
					? "कृपया नाम और स्थान दर्ज करें।"
					: "Please enter name and location.",
				"warning",
			);
			return;
		}

		setIsSubmitting(true);
		try {
			if (user) {
				const { phone, email } = getPhoneAndEmail();
				await saveHHBSMGlorification({
					name: finalName,
					location: finalLocation,
					glorification: trimmedGlory,
					uid: user.uid,
					phone: phone || undefined,
					email: email || undefined,
					type: "text",
				});
			}
			triggerHaptic("success");
			onSuccess();
		} catch (err) {
			console.error("Failed to save glorification", err);
			triggerHaptic("error");
			showToast(t.genericError, "error");
		} finally {
			setIsSubmitting(false);
		}
	};

	const performAudioSave = async () => {
		if (isSubmitting) return;

		if (!user) {
			showToast("कृपया पहले लॉगिन करें।", "error");
			return;
		}

		const finalName = effectiveName.trim() || name.trim();
		const finalLocation = effectiveLocation.trim() || location.trim();
		if (!finalName || !finalLocation) {
			showToast(
				isHindi
					? "कृपया नाम और स्थान दर्ज करें।"
					: "Please enter name and location.",
				"warning",
			);
			return;
		}

		if (!audioBlob) {
			showToast(t.emptyError, "warning");
			return;
		}

		setIsSubmitting(true);
		setRecordingState("uploading");
		try {
			// 1. Create Placeholder Draft in Firestore
			let docId = "";
			if (user) {
				const { phone, email } = getPhoneAndEmail();
				docId = await saveHHBSMGlorification({
					name: finalName,
					location: finalLocation,
					glorification: "",
					uid: user.uid,
					phone: phone || undefined,
					email: email || undefined,
					type: "audio",
					audioUrl: "", // Will be updated after upload
					duration: recordingTime,
					status: "uploading",
				});
			}

			// 2. Upload to Cloud Storage
			const ext = audioBlob.type.includes("webm")
				? "webm"
				: audioBlob.type.includes("mp4")
					? "m4a"
					: "aac";
			const fileName = `audio_${Date.now()}.${ext}`;
			const file = new File([audioBlob], fileName, { type: audioBlob.type });

			const uploadedUrl = await uploadFileToB2(
				file,
				(_p) => {}, // ignoring progress for now, using a general "uploading" state
				"hhbsm-2026-glorification-audios/",
			);

			// 3. Update Placeholder with actual URL and mark pending
			if (user && docId) {
				const { phone, email } = getPhoneAndEmail();
				await updateHHBSMGlorification(docId, {
					name: finalName,
					location: finalLocation,
					glorification: "",
					uid: user.uid,
					phone: phone || undefined,
					email: email || undefined,
					type: "audio",
					audioUrl: uploadedUrl,
					duration: recordingTime,
					status: "pending",
				});
			}

			triggerHaptic("success");
			onSuccess();
		} catch (err) {
			console.error("Audio save error:", err);
			triggerHaptic("error");
			showToast(t.genericError, "error");
			setRecordingState("recorded"); // fallback so they can retry
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleNextClick = () => {
		if (!glorification.trim()) {
			showToast(t.emptyError, "warning");
			return;
		}
		if (countWords(glorification) > MAX_WORDS) {
			showToast(
				isHindi
					? `कृपया ${MAX_WORDS} शब्दों की सीमा में लिखें।`
					: `Please keep it under ${MAX_WORDS} words.`,
				"warning",
			);
			return;
		}
		if (hasLongWord(glorification)) {
			showToast(
				isHindi
					? `एक शब्द बहुत लंबा है। कृपया शब्दों के बीच स्पेस (space) दें।`
					: `A single word is too long. Please add spaces between words.`,
				"warning",
			);
			return;
		}
		triggerHaptic("light");
		setStep("preview");
	};

	// ─── NOT LOGGED IN — Login Gate ────────────────────────────────────────
	const renderLoginGate = () => (
		<div className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-5">
			<div className="w-20 h-20 rounded-full bg-ry-maroon/10 flex items-center justify-center">
				<UserIcon size={36} className="text-ry-maroon dark:text-ry-gold" />
			</div>
			<div>
				<h3 className="font-serif text-xl font-bold text-ry-maroon dark:text-ry-gold mb-2">
					{isHindi ? "लॉगिन आवश्यक" : "Login Required"}
				</h3>
				<p className="text-sm leading-relaxed text-ry-brown dark:text-slate-300">
					{t.loginRequired}
				</p>
			</div>
			<button
				type="button"
				onClick={() => {
					onClose();
					setTimeout(() => onOpenProfile(), 300);
				}}
				className="flex items-center gap-2 rounded-full bg-ry-maroon px-8 py-3.5 text-sm font-bold text-ry-cream shadow-lg shadow-ry-maroon/30 transition-all active:scale-95"
			>
				{t.loginBtn}
			</button>
		</div>
	);

	// ─── WRITE STEP ────────────────────────────────────────────────────────
	const renderWriteStep = () => (
		<>
			{/* Profile pill */}
			{user && (
				<div className="mx-4 mb-3 rounded-2xl bg-ry-cream/60 dark:bg-slate-700/60 border border-ry-gold/20 px-4 py-2.5 flex items-center gap-3">
					<div className="w-8 h-8 rounded-full bg-ry-maroon flex items-center justify-center shrink-0">
						{profile?.photoURL ? (
							<ThumbImg
								src={profile.photoURL}
								alt=""
								className="w-8 h-8 rounded-full object-cover"
							/>
						) : (
							<UserIcon size={14} className="text-ry-cream" />
						)}
					</div>
					<div className="flex-1 min-w-0">
						{hasCompleteProfile ? (
							<>
								<p className="text-xs font-bold text-ry-maroon dark:text-ry-gold truncate">
									{deriveNameFromProfile()}
								</p>
								<p className="text-[10px] text-ry-brown/70 dark:text-slate-400 flex items-center gap-1 truncate">
									<MapPin size={9} />
									{deriveLocationFromProfile()}
								</p>
							</>
						) : (
							<p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
								{t.incompleteProfile}
							</p>
						)}
					</div>
					{!hasCompleteProfile && (
						<button
							type="button"
							onClick={() => {
								onClose();
								setTimeout(() => onOpenProfile(), 300);
							}}
							className="text-[10px] font-bold text-ry-maroon dark:text-ry-gold bg-ry-gold/10 px-2 py-1 rounded-lg shrink-0"
						>
							{isHindi ? "पूरा करें" : "Complete"}
						</button>
					)}
				</div>
			)}

			{/* Incomplete profile: show name/location inputs inline */}
			{user && !hasCompleteProfile && (
				<div className="mx-4 mb-3 space-y-2">
					<div className="relative">
						<UserIcon
							size={14}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-ry-brown/40"
						/>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={MAX_FIELD_LENGTH}
							placeholder={t.namePlaceholder}
							className="w-full rounded-xl border border-ry-gold/30 bg-white dark:bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-ry-gold focus:ring-2 focus:ring-ry-gold/20"
						/>
					</div>
					<div className="relative">
						<MapPin
							size={14}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-ry-brown/40"
						/>
						<input
							type="text"
							value={location}
							onChange={(e) => setLocation(e.target.value)}
							maxLength={MAX_FIELD_LENGTH}
							placeholder={t.locationPlaceholder}
							className="w-full rounded-xl border border-ry-gold/30 bg-white dark:bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-ry-gold focus:ring-2 focus:ring-ry-gold/20"
						/>
					</div>
				</div>
			)}

			{/* Tab Switcher */}
			<div className="mx-4 mb-3 flex bg-ry-gold/10 dark:bg-slate-800 p-1 rounded-xl border border-ry-gold/20">
				<button
					type="button"
					onClick={() => setActiveTab("text")}
					className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
						activeTab === "text"
							? "bg-ry-maroon text-white shadow-md"
							: "text-ry-brown dark:text-slate-400 hover:bg-ry-maroon/10"
					}`}
				>
					{t.tabWrite}
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("audio")}
					className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
						activeTab === "audio"
							? "bg-ry-maroon text-white shadow-md"
							: "text-ry-brown dark:text-slate-400 hover:bg-ry-maroon/10"
					}`}
				>
					{t.tabRecord}
				</button>
			</div>

			{activeTab === "text" ? (
				<>
					{/* Word counter */}
					<div className="mx-4 mb-1 flex items-center justify-between gap-2">
						{/* Audio tip — visible only on text tab */}
						<p className="text-[10px] text-ry-brown/60 dark:text-slate-400 leading-tight">
							{isHindi
								? "💡 ऑडियो संदेश भी भेज सकते हैं — ऊपर '🎙 रिकॉर्ड करें' टैब चुनें"
								: "💡 You can also send an audio message — select '🎙 Record' tab above"}
						</p>
						<span
							className={`shrink-0 text-[10px] font-medium transition-colors ${
								countWords(glorification) > 1150
									? "text-red-500 font-bold"
									: "text-ry-brown/50 dark:text-slate-500"
							}`}
						>
							{isHindi ? "शब्द" : "words"}: {countWords(glorification)}/
							{MAX_WORDS}
						</span>
					</div>

					{/* Long word warning */}
					{hasLongWord(glorification) && (
						<p className="mx-4 mb-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
							{isHindi
								? "⚠️ कोई एक शब्द बहुत लंबा है (अधिकतम 50 अक्षर)"
								: "⚠️ A word is too long (max 50 characters each)"}
						</p>
					)}

					{/* Textarea */}
					<div className="mx-4 flex-1">
						<textarea
							ref={textareaRef}
							value={glorification}
							onChange={(e) => setGlorification(e.target.value)}
							placeholder={t.placeholder}
							className="w-full h-full min-h-[200px] resize-none rounded-2xl border border-ry-gold/30 bg-white dark:bg-slate-900 px-4 py-3.5 text-sm text-slate-800 dark:text-white outline-none transition-all focus:border-ry-gold focus:ring-2 focus:ring-ry-gold/20"
						/>
					</div>
				</>
			) : (
				/* AUDIO TAB CONTENT */
				<div className="mx-4 flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-ry-gold/30 rounded-2xl bg-white dark:bg-slate-900">
					{recordingState === "idle" && (
						<div className="text-center space-y-4">
							<div className="w-16 h-16 rounded-full bg-ry-maroon/10 text-ry-maroon dark:text-ry-gold flex items-center justify-center mx-auto">
								<Mic size={32} />
							</div>
							<p className="text-sm font-medium text-ry-brown dark:text-slate-300">
								{t.recordInfo}
							</p>
							<button
								type="button"
								onClick={startRecording}
								className="mt-2 inline-flex items-center gap-2 rounded-full bg-ry-maroon px-6 py-2.5 text-sm font-bold text-ry-cream active:scale-95 transition-transform shadow-md"
							>
								<Mic size={16} />
								{isHindi ? "रिकॉर्डिंग शुरू करें" : "Start Recording"}
							</button>
						</div>
					)}
					{(recordingState === "recording" || recordingState === "paused") && (
						<div className="text-center space-y-6 w-full">
							<div className="text-4xl font-mono font-bold text-ry-maroon dark:text-ry-gold">
								{formatTime(recordingTime)} / 10:00
							</div>
							<div className="flex items-center justify-center gap-4">
								{recordingState === "recording" ? (
									<button
										type="button"
										onClick={pauseRecording}
										className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center active:scale-95 transition-transform shadow-md"
									>
										<Pause size={24} />
									</button>
								) : (
									<button
										type="button"
										onClick={resumeRecording}
										className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center active:scale-95 transition-transform shadow-md"
									>
										<Play size={24} />
									</button>
								)}
								<button
									type="button"
									onClick={stopRecording}
									className="w-14 h-14 rounded-full bg-ry-maroon text-white flex items-center justify-center active:scale-95 transition-transform shadow-md"
								>
									<Square size={24} />
								</button>
							</div>
							{recordingState === "recording" && (
								<p className="text-xs text-red-500 animate-pulse font-medium flex items-center justify-center gap-1">
									<span className="w-2 h-2 rounded-full bg-red-500" />
									{isHindi ? "रिकॉर्डिंग जारी है..." : "Recording..."}
								</p>
							)}
							{recordingState === "paused" && (
								<p className="text-xs text-amber-600 font-medium">
									{isHindi ? "रिकॉर्डिंग रुकी हुई है" : "Recording paused"}
								</p>
							)}
						</div>
					)}
					{recordingState === "recorded" && (
						<div className="text-center space-y-6 w-full">
							<div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
								<Volume2 size={32} />
							</div>
							<div className="w-full">
								{audioObjectUrl && (
									<audio
										controls
										preload="metadata"
										src={audioObjectUrl}
										className="w-full"
									/>
								)}
							</div>
							<button
								type="button"
								onClick={deleteRecording}
								className="text-sm font-bold text-red-500 flex items-center justify-center gap-1 mx-auto hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors"
							>
								<Trash2 size={16} />
								{isHindi ? "पुनः रिकॉर्ड करें" : "Re-record"}
							</button>
						</div>
					)}
					{recordingState === "uploading" && (
						<div className="text-center space-y-4">
							<div className="w-16 h-16 rounded-full bg-ry-maroon/10 text-ry-maroon dark:text-ry-gold flex items-center justify-center mx-auto">
								<Loader2 size={32} className="animate-spin" />
							</div>
							<p className="text-sm font-medium text-ry-brown dark:text-slate-300">
								{isHindi ? "ऑडियो अपलोड हो रहा है..." : "Uploading audio..."}
							</p>
						</div>
					)}
				</div>
			)}
		</>
	);

	// ─── UPLOADING OVERLAY ──────────────────────────────────────────────
	const renderUploadingOverlay = () => (
		<div className="absolute inset-0 z-50 bg-ry-cream/90 dark:bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
			<Loader2
				size={48}
				className="animate-spin text-ry-maroon dark:text-ry-gold mb-4"
			/>
			<h3 className="font-serif text-xl font-bold text-ry-maroon dark:text-ry-gold mb-2">
				{isHindi ? "भेजा जा रहा है..." : "Sending..."}
			</h3>
			<p className="text-sm text-ry-brown dark:text-slate-300 font-medium text-center px-8">
				{isHindi
					? "कृपया बैक न करें। आपकी भावनाएं गुरु महाराज जी तक पहुंच रही हैं।"
					: "Please don't go back. Your glorification is being sent to Guru Maharaj Ji."}
			</p>
		</div>
	);

	// ─── LIST STEP ────────────────────────────────────────────────────────
	const renderListStep = () => (
		<div className="flex-1 overflow-y-auto p-4 space-y-4">
			<div className="text-center mb-6 mt-4">
				<h3 className="font-serif text-xl font-bold text-ry-maroon dark:text-ry-gold mb-2">
					{isHindi ? "आपकी महिमा" : "Your Submissions"}
				</h3>
				<p className="text-sm text-ry-brown dark:text-slate-400">
					{isHindi
						? "आपने गुरु महाराज जी को अपनी भावनाएं भेज दी हैं।"
						: "You have sent your feelings to Guru Maharaj Ji."}
				</p>
			</div>

			{existingEntries.map((entry, idx) => (
				<div
					key={entry.id}
					className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-ry-gold/20"
				>
					<div className="flex justify-between items-center mb-4">
						<span className="text-xs font-bold bg-ry-maroon/10 text-ry-maroon dark:text-ry-gold px-2.5 py-1 rounded-md">
							{isHindi
								? `सबमिशन ${existingEntries.length - idx}`
								: `Submission ${existingEntries.length - idx}`}
						</span>
						<span className="text-xs font-medium text-ry-brown/60 dark:text-slate-500">
							{new Date(entry.createdAt).toLocaleDateString()}
						</span>
					</div>
					{entry.type === "audio" ? (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
									<Volume2 size={16} />
								</div>
								<p className="text-sm font-bold text-slate-700 dark:text-slate-300">
									{isHindi ? "ऑडियो संदेश" : "Audio Message"}
								</p>
							</div>
							{entry.audioUrl && (
								<audio
									controls
									preload="metadata"
									src={normalizeB2Url(entry.audioUrl)}
									className="w-full h-10"
								/>
							)}
						</div>
					) : (
						<p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
							{entry.glorification}
						</p>
					)}
				</div>
			))}

			{existingEntries.length < 4 && (
				<div className="mt-8 pt-4 pb-8 flex justify-center">
					<button
						type="button"
						onClick={() => setStep("write")}
						className="inline-flex items-center gap-2 rounded-full bg-ry-maroon px-6 py-3.5 text-sm font-bold text-ry-cream shadow-lg transition-transform active:scale-95"
					>
						<Sparkles size={16} />
						{isHindi
							? `एक और महिमा भेजें (${existingEntries.length}/4)`
							: `Send Another (${existingEntries.length}/4)`}
					</button>
				</div>
			)}
		</div>
	);

	// ─── PREVIEW STEP ──────────────────────────────────────────────────────
	const renderPreviewStep = () => (
		<>
			<div className="mx-4 mb-4 text-center">
				<p className="text-sm leading-relaxed text-ry-brown dark:text-slate-300">
					{t.previewSubtitle}
				</p>
			</div>

			<div className="mx-4 flex-1 rounded-2xl border border-ry-gold/30 bg-white dark:bg-slate-900 p-4 flex flex-col overflow-hidden">
				<div className="flex-1 overflow-y-auto">
					<textarea
						value={glorification}
						onChange={(e) => setGlorification(e.target.value)}
						className="w-full min-h-[180px] h-full resize-none bg-transparent text-sm text-slate-800 dark:text-white outline-none leading-relaxed"
					/>
				</div>
				<div className="flex items-center justify-between mt-2 pt-2 border-t border-ry-gold/10">
					<p className="text-xs text-ry-brown/60 dark:text-slate-400">
						— {effectiveName || name}, {effectiveLocation || location}
					</p>
					<span
						className={`text-[10px] font-medium ${
							countWords(glorification) > 1150
								? "text-red-500"
								: "text-ry-brown/40 dark:text-slate-500"
						}`}
					>
						{isHindi ? "शब्द" : "words"}: {countWords(glorification)}/{MAX_WORDS}
					</span>
				</div>
			</div>
		</>
	);

	return createPortal(
		<div className="fixed inset-0 z-[80] flex flex-col bg-ry-cream dark:bg-slate-900 animate-in slide-in-from-bottom duration-300">
			{/* ── Header ───────────────────────────────────────────────── */}
			<div className="flex-none flex items-center gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 bg-gradient-to-b from-ry-maroon to-ry-maroon/90 shadow-lg">
				<button
					type="button"
					onClick={onClose}
					disabled={isSubmitting}
					className="p-2 rounded-full hover:bg-white/15 transition-colors active:scale-95 disabled:opacity-40"
				>
					<ChevronLeft size={22} className="text-ry-cream" />
				</button>
				<div className="flex-1 min-w-0">
					<h2 className="font-serif text-lg font-bold text-ry-cream leading-tight truncate">
						{t.title}
					</h2>
					{user && step === "write" && (
						<p className="text-[10px] text-ry-cream/70 mt-0.5 truncate">
							{isHindi ? "आविर्भाव महोत्सव २०२६" : "Aavirbhav Mahotsav 2026"}
						</p>
					)}
					{step === "preview" && (
						<p className="text-[10px] text-ry-cream/70 mt-0.5 truncate">
							{t.previewTitle}
						</p>
					)}
				</div>

				{/* Step dots */}
				{user && step !== "list" && (
					<div className="flex items-center gap-1.5 shrink-0 ml-1">
						<div
							className={`w-2 h-2 rounded-full transition-all ${step === "write" ? "bg-ry-gold scale-125" : "bg-ry-cream/40"}`}
						/>
						<div
							className={`w-2 h-2 rounded-full transition-all ${step === "preview" ? "bg-ry-gold scale-125" : "bg-ry-cream/40"}`}
						/>
					</div>
				)}
			</div>

			{/* ── Loading existing submission ───────────────────────── */}
			{isLoadingExisting && (
				<div className="flex items-center justify-center gap-2 py-3 bg-ry-gold/10">
					<Loader2
						size={14}
						className="animate-spin text-ry-maroon dark:text-ry-gold"
					/>
					<span className="text-xs text-ry-brown dark:text-slate-300">
						{isHindi
							? "पूर्व महिमा लोड हो रही है..."
							: "Loading your glorification..."}
					</span>
				</div>
			)}

			{/* ── Uploading Overlay ────────────────────────────────────── */}
			{(isSubmitting || recordingState === "uploading") &&
				renderUploadingOverlay()}

			{/* ── Content ──────────────────────────────────────────────── */}
			<div className="flex-1 overflow-y-auto flex flex-col py-4 gap-0">
				{!user
					? renderLoginGate()
					: step === "list"
						? renderListStep()
						: step === "write"
							? renderWriteStep()
							: renderPreviewStep()}
			</div>

			{/* ── Bottom Action Bar ─────────────────────────────────────── */}
			{user && step !== "list" && (
				<div className="flex-none px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-ry-cream dark:bg-slate-900 border-t border-ry-gold/20 flex gap-3">
					{activeTab === "text" && step === "preview" && (
						<button
							type="button"
							onClick={() => setStep("write")}
							disabled={isSubmitting}
							className="flex-1 rounded-full border border-ry-gold/40 py-3.5 text-sm font-bold text-ry-brown dark:text-slate-300 transition-all active:scale-95 disabled:opacity-50"
						>
							{t.back}
						</button>
					)}
					<button
						type="button"
						onClick={
							activeTab === "audio"
								? performAudioSave
								: step === "write"
									? handleNextClick
									: performSave
						}
						disabled={
							isSubmitting ||
							(activeTab === "text" && !glorification.trim()) ||
							(activeTab === "audio" && recordingState !== "recorded")
						}
						className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ry-maroon py-3.5 text-sm font-bold text-ry-cream shadow-lg shadow-ry-maroon/30 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
					>
						{isSubmitting || recordingState === "uploading" ? (
							<Loader2 size={18} className="animate-spin" />
						) : activeTab === "audio" ? (
							<>
								{t.save}
								<UploadCloud size={15} />
							</>
						) : step === "write" ? (
							<>
								{t.next}
								<Sparkles size={15} />
							</>
						) : (
							<>
								{t.save}
								<Send size={15} />
							</>
						)}
					</button>
				</div>
			)}
		</div>,
		document.body,
	);
};

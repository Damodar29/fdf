import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { FCM } from "@capacitor-community/fcm";
import {
	collection,
	deleteField,
	doc,
	getDoc,
	getDocs,
	setDoc,
	updateDoc,
} from "firebase/firestore";
import { importPKCS8, SignJWT } from "jose";
import {
	AlertCircle,
	Bell,
	Check,
	CheckSquare,
	ChevronDown,
	ChevronUp,
	History,
	Image as ImageIcon,
	Link as LinkIcon,
	Loader2,
	Search,
	Send,
	Smartphone,
	Square,
	Upload,
	User,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "../context/ToastContext";
import { db } from "../services/firebase";
import { useAdminBack } from "../src/hooks/useAdminBack";
import { usePopupBackHandler } from "../src/hooks/usePopupBackHandler";
import { MANDAL_LIST } from "../src/types/mandal";
import { sendPushNotification } from "../src/utils/sendPushNotification";
import { uploadFileViaWorker } from "../utils/uploadManager";

const REPO_OWNER = "chaitanyaprembhakti";
const REPO_NAME = "CPBS-DAILY";
const _NOTIFICATION_RELEASE_NAME = "notification-images";

const CustomDropdown = ({
	value,
	onChange,
	options,
	placeholder,
	className,
}: {
	value: string;
	onChange: (val: string) => void;
	options: { id: string; label: string }[];
	placeholder: string;
	className?: string;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	// Back closes the open list, not the screen.
	useAdminBack(isOpen, () => setIsOpen(false));
	const selectedLabel =
		options.find((o) => o.id === value)?.label || placeholder;

	return (
		<div className={`relative ${className || ""}`}>
			{isOpen && (
				<div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
			)}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full min-h-[40px] flex items-center justify-between px-3 py-2 text-sm text-left bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 relative z-40 transition-colors"
			>
				<span
					className={`truncate ${!value || value === "all" ? "text-slate-500 dark:text-slate-400 font-medium" : "text-slate-800 dark:text-white"}`}
				>
					{selectedLabel}
				</span>
				<ChevronDown
					size={16}
					className={`text-slate-400 dark:text-ink-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>
			{isOpen && (
				<div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1">
					<button
						type="button"
						className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${!value || value === "all" ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/20 font-medium" : "text-slate-700 dark:text-slate-300"}`}
						onClick={() => {
							onChange("all");
							setIsOpen(false);
						}}
					>
						{placeholder}
					</button>
					{options.map((opt) => (
						<button
							key={opt.id}
							type="button"
							className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${value === opt.id ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/20 font-medium" : "text-slate-700 dark:text-slate-300"}`}
							onClick={() => {
								onChange(opt.id);
								setIsOpen(false);
							}}
						>
							{opt.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
};

export const NotificationSender: React.FC<{
	onBack: () => void;
	settingsLanguage?: "en" | "hi";
}> = ({ onBack, settingsLanguage = "hi" }) => {
	const { showToast } = useToast();
	const [serviceAccountJson, setServiceAccountJson] = useState("");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [imageUrl, setImageUrl] = useState("");
	const [uploadedFile, setUploadedFile] = useState<File | null>(null);
	const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
	const [githubToken, setGithubToken] = useState<string | null>(null);
	const [actionType, setActionType] = useState<"screen" | "link" | "none">(
		"none",
	);
	const [targetScreen, setTargetScreen] = useState("home");
	const [targetLink, setTargetLink] = useState("");
	const [sending, setSending] = useState(false);
	const [_testing, _setTesting] = useState(false);
	const [uploadingFile, setUploadingFile] = useState(false);
	const [status, setStatus] = useState<{
		type: "success" | "error";
		msg: string;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [diagnostics, setDiagnostics] = useState<string[]>([]);
	const [showDiagnostics, setShowDiagnostics] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);
	const [openScreenDropdown, setOpenScreenDropdown] = useState(false);
	// Back closes the open screen list / diagnostics log before leaving.
	useAdminBack(openScreenDropdown, () => setOpenScreenDropdown(false));
	useAdminBack(showDiagnostics, () => setShowDiagnostics(false));
	const [fcmToken, setFcmToken] = useState<string | null>(null);

	// ── Scheduling State ──
	const [scheduleMode, setScheduleMode] = useState(false);
	const [scheduledDate, setScheduledDate] = useState("");
	const [scheduledTime, setScheduledTime] = useState("");

	// ── Silent State ──
	const [isSilent, setIsSilent] = useState(false);
	const [mandalUploadsSilent, setMandalUploadsSilent] = useState(true);
	const [mandalUploadsEnabled, setMandalUploadsEnabled] = useState(true);
	const [youtubeUploadsEnabled, setYoutubeUploadsEnabled] = useState(true);
	const [selectedSound, setSelectedSound] = useState<
		"notisound3" | "notisound"
	>("notisound3");

	// ── History State ──
	const [history, setHistory] = useState<any[]>([]);
	const [showHistory, setShowHistory] = useState(false);
	const [_confirmDialog, setConfirmDialog] = useState<{
		message: string;
		onConfirm: () => void;
	} | null>(null);

	const handleClose_notif_history = usePopupBackHandler(
		showHistory,
		"notif-history",
		() => setShowHistory(false),
	);

	// ── Send to My Device ──
	const [sendingToDevice, setSendingToDevice] = useState(false);
	const [_showBatteryTip, setShowBatteryTip] = useState(false);

	// ── Device Manager State ──
	// Tokens are grouped by platform: android, ios, web
	// DO NOT flatten into a single array — platform separation is intentional
	const [showDeviceManager, setShowDeviceManager] = useState(false);

	const handleClose_device_manager = usePopupBackHandler(
		showDeviceManager,
		"device-manager",
		() => setShowDeviceManager(false),
	);
	const [deviceTokens, setDeviceTokens] = useState<
		{
			id: string;
			token: string;
			platform: "android" | "ios" | "web";
			userName?: string;
			userMandalId?: string;
		}[]
	>([]);
	const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(
		new Set(),
	);
	const [managingDevices, setManagingDevices] = useState(false);
	const [activeDeviceTab, setActiveDeviceTab] = useState<
		"android" | "ios" | "web"
	>("android");
	const [deviceSearchQuery, setDeviceSearchQuery] = useState("");
	const [mandalFilter, setMandalFilter] = useState<string>("all");

	const SCREEN_OPTIONS = [
		{ value: "home", label: "Home" },
		{ value: "darshan", label: "Daily Darshan" },
		{ value: "activities", label: "Spiritual Activities" },
		{ value: "information", label: "Daily Information" },
		{ value: "quotes", label: "Daily Quotes" },
		{ value: "events", label: "Events / Calendar" },
		{ value: "books", label: "Book List" },
		{ value: "songs", label: "Bhajan List" },
		{ value: "lectures", label: "Audio Screen" },
		{ value: "library", label: "Authors and History" },
		{ value: "seva", label: "Seva Center" },
		{ value: "temple-timings", label: "Temple Timings" },
		{ value: "youtube", label: "YouTube" },
		{ value: "guru-maharaj", label: "Guru Maharaj" },
		{ value: "virahi-maharaj", label: "Virahi Maharaj" },
		{ value: "donate", label: "Donate" },
		{ value: "about", label: "About Us" },
		{ value: "settings", label: "Settings" },

		{ value: "downloaded", label: "Downloaded List" },
		{ value: "onboarding", label: "Onboarding" },
		{ value: "videos", label: "Videos" },
		{ value: "profile", label: "Profile Screen" },
		{ value: "photos", label: "Photos / Gallery" },
	];

	const addLog = (msg: string) => {
		const timestamp = new Date().toLocaleTimeString();
		setDiagnostics((prev) => [`[${timestamp}] ${msg}`, ...prev]);
	};

	const runDiagnostics = async () => {
		setDiagnostics([]);
		setShowDiagnostics(true);
		setIsMinimized(false);
		addLog("Starting diagnostics...");
		addLog(`Platform: ${Capacitor.getPlatform()}`);

		try {
			addLog("Checking Service Account JSON in Firestore...");
			const notifDoc = await getDoc(doc(db, "app_config", "notificationkey"));
			if (!notifDoc.exists()) {
				throw new Error("Service Account document not found.");
			}
			const saJson = notifDoc.data()?.servicekey;
			if (!saJson) throw new Error("Service Account key is empty.");
			addLog("Service Account JSON found.");

			addLog("Checking GitHub token in Firestore...");
			const tokenDoc = await getDoc(doc(db, "damtoken", "github"));
			if (!tokenDoc.exists()) {
				throw new Error("GitHub token document not found.");
			}
			const foundToken = tokenDoc.data()?.token?.trim();
			if (!foundToken) throw new Error("Token field is empty.");
			addLog("GitHub token found.");

			addLog("Verifying token with GitHub API...");
			const userResp = await fetch("https://api.github.com/user", {
				headers: { Authorization: `token ${foundToken}` },
			});

			if (!userResp.ok)
				throw new Error(`GitHub Auth Failed: ${userResp.status}`);
			const userData = await userResp.json();
			addLog(`Authenticated as: ${userData.login}`);
			addLog("✅ Success! All checks passed.");
		} catch (e: any) {
			addLog(`❌ Error: ${e.message}`);
		}
	};

	useEffect(() => {
		const loadConfig = async () => {
			// Load notification service account
			const notifDoc = await getDoc(doc(db, "app_config", "notificationkey"));
			if (notifDoc.exists())
				setServiceAccountJson(notifDoc.data()?.servicekey || "");

			// Load notification settings
			const settingsDoc = await getDoc(
				doc(db, "app_config", "notification_settings"),
			);
			if (settingsDoc.exists()) {
				const data = settingsDoc.data();
				if (typeof data.mandalUploadsSilent === "boolean") {
					setMandalUploadsSilent(data.mandalUploadsSilent);
				}
				if (typeof data.mandalUploadsEnabled === "boolean") {
					setMandalUploadsEnabled(data.mandalUploadsEnabled);
				}
				if (typeof data.youtubeUploadsEnabled === "boolean") {
					setYoutubeUploadsEnabled(data.youtubeUploadsEnabled);
				}
				if (data.selectedSound) {
					setSelectedSound(data.selectedSound);
				}
			}

			// Load GitHub token
			const tokenDoc = await getDoc(doc(db, "damtoken", "github"));
			if (tokenDoc.exists())
				setGithubToken(tokenDoc.data()?.token?.trim() || "");
		};
		loadConfig();

		// Load notification history in real-time
		let unsubSnapshot: (() => void) | null = null;
		import("firebase/firestore").then(({ onSnapshot }) => {
			unsubSnapshot = onSnapshot(
				doc(db, "app_config", "notif_history"),
				(docSnap) => {
					if (docSnap.exists() && docSnap.data().notifications) {
						setHistory(docSnap.data().notifications);
					}
				},
			);
		});

		// Battery tip: show hint if on Android native
		if (Capacitor.getPlatform() === "android") {
			setShowBatteryTip(true);
		}

		const fetchToken = async () => {
			if (Capacitor.isNativePlatform()) {
				// Native: use FCM plugin to get the actual FCM token
				try {
					await PushNotifications.requestPermissions();
					PushNotifications.addListener("registration", async (token) => {
						try {
							const { token: fcmToken } = await FCM.getToken();
							setFcmToken(fcmToken);
						} catch (err) {
							console.error("Could not fetch actual FCM token:", err);
							setFcmToken(token.value); // APNs fallback
						}
					});
					await PushNotifications.register();
				} catch (e) {
					console.log("Could not fetch FCM Token (native)", e);
				}
			} else {
				// Web: use Firebase messaging SDK to get web push token
				try {
					const { isSupported, getMessaging, getToken } = await import(
						"firebase/messaging"
					);
					const supported = await isSupported().catch(() => false);
					if (!supported) return;
					if (Notification.permission !== "granted") return;
					const messagingInst = getMessaging();
					const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
					let swReg: ServiceWorkerRegistration | undefined;
					if ("serviceWorker" in navigator) {
						swReg = await navigator.serviceWorker
							.register("/firebase-messaging-sw.js", { scope: "/" })
							.catch(() => undefined);
						if (swReg) await navigator.serviceWorker.ready;
					}
					const token = await getToken(messagingInst, {
						vapidKey: vapidKey || undefined,
						serviceWorkerRegistration: swReg,
					}).catch(() => null);
					if (token) setFcmToken(token);
				} catch (e) {
					console.log("Could not fetch FCM Token (web)", e);
				}
			}
		};
		fetchToken();

		return () => {
			// Cleanup blob URLs on unmount
			if (uploadedFileUrl) {
				URL.revokeObjectURL(uploadedFileUrl);
			}
			if (unsubSnapshot) unsubSnapshot();
		};
	}, [uploadedFileUrl]);

	const toggleMandalUploadsSilent = async (checked: boolean) => {
		setMandalUploadsSilent(checked);
		try {
			await setDoc(
				doc(db, "app_config", "notification_settings"),
				{
					mandalUploadsSilent: checked,
				},
				{ merge: true },
			);
			showToast(
				`Mandal uploads notifications are now ${checked ? "Silent" : "With Sound"}`,
				"success",
			);
		} catch (e) {
			console.error(e);
			showToast("Failed to save settings", "error");
			setMandalUploadsSilent(!checked); // Revert
		}
	};

	const toggleMandalUploadsEnabled = async (checked: boolean) => {
		setMandalUploadsEnabled(checked);
		try {
			await setDoc(
				doc(db, "app_config", "notification_settings"),
				{
					mandalUploadsEnabled: checked,
				},
				{ merge: true },
			);
			showToast(
				`Automatic Darshan/Activity Notifications are now ${checked ? "ON" : "OFF"}`,
				"success",
			);
		} catch (e) {
			console.error(e);
			showToast("Failed to save settings", "error");
			setMandalUploadsEnabled(!checked); // Revert
		}
	};

	const toggleYoutubeUploadsEnabled = async (checked: boolean) => {
		setYoutubeUploadsEnabled(checked);
		try {
			await setDoc(
				doc(db, "app_config", "notification_settings"),
				{
					youtubeUploadsEnabled: checked,
				},
				{ merge: true },
			);
			showToast(
				`Automatic YouTube Upload Notifications are now ${checked ? "ON" : "OFF"}`,
				"success",
			);
		} catch (e) {
			console.error(e);
			showToast("Failed to save settings", "error");
			setYoutubeUploadsEnabled(!checked); // Revert
		}
	};

	const handleSoundChange = async (sound: "notisound3" | "notisound") => {
		setSelectedSound(sound);
		try {
			await setDoc(
				doc(db, "app_config", "notification_settings"),
				{
					selectedSound: sound,
				},
				{ merge: true },
			);
			showToast(`Notification sound updated globally`, "success");
		} catch (e) {
			console.error(e);
			showToast("Failed to save sound settings", "error");
		}
	};

	const _saveKey = async () => {
		try {
			if (serviceAccountJson) {
				JSON.parse(serviceAccountJson); // Validate JSON
			}
			await setDoc(
				doc(db, "app_config", "notificationkey"),
				{ servicekey: serviceAccountJson },
				{ merge: true },
			);
			setStatus({ type: "success", msg: "Service Account saved" });
			setTimeout(() => setStatus(null), 3000);
		} catch (_e) {
			setStatus({ type: "error", msg: "Invalid JSON format" });
		}
	};

	const uploadFileToGitHub = async (file: File): Promise<string | null> => {
		if (!githubToken) {
			setStatus({ type: "error", msg: "GitHub token not configured" });
			return null;
		}

		try {
			setUploadingFile(true);
			setStatus({ type: "success", msg: "Uploading image..." });
			addLog("Starting image upload to GitHub via Worker...");

			const releaseResponse = await fetch(
				`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/notification-photostorage`,
				{
					headers: {
						Authorization: `token ${githubToken}`,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!releaseResponse.ok) {
				throw new Error('Release "notification-photostorage" not found');
			}

			const releaseData = await releaseResponse.json();
			const releaseId = releaseData.id;

			// Direct upload via Cloudflare Worker proxy
			const downloadUrl = await uploadFileViaWorker(
				file,
				releaseId,
				githubToken,
				undefined,
				{
					totalFiles: 1,
					currentIndex: 1,
				},
			);

			setStatus({ type: "success", msg: "Image uploaded successfully!" });
			addLog("Upload successful!");
			return downloadUrl;
		} catch (err: any) {
			setStatus({
				type: "error",
				msg: `Failed to upload image: ${err.message}`,
			});
			addLog(`Upload failed: ${err.message}`);
			return null;
		} finally {
			setUploadingFile(false);
		}
	};

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith("image/")) {
			setStatus({ type: "error", msg: "Please select an image file" });
			return;
		}

		// Upload to GitHub
		const downloadUrl = await uploadFileToGitHub(file);
		if (downloadUrl) {
			setUploadedFile(file);
			setUploadedFileUrl(downloadUrl);
			setImageUrl(""); // Clear URL input if file is selected
		}
	};

	const removeUploadedFile = () => {
		if (uploadedFileUrl) {
			URL.revokeObjectURL(uploadedFileUrl);
		}
		setUploadedFile(null);
		setUploadedFileUrl(null);
	};

	const getAccessToken = async (serviceAccount: any) => {
		const iat = Math.floor(Date.now() / 1000);
		const exp = iat + 3600; // 1 hour

		// Ensure newlines are correctly formatted
		const privateKeyString = serviceAccount.private_key.replace(/\\n/g, "\n");
		const privateKey = await importPKCS8(privateKeyString, "RS256");

		const jwt = await new SignJWT({
			iss: serviceAccount.client_email,
			sub: serviceAccount.client_email,
			aud: "https://oauth2.googleapis.com/token",
			scope: "https://www.googleapis.com/auth/firebase.messaging",
		})
			.setProtectedHeader({ alg: "RS256", typ: "JWT" })
			.setIssuedAt(iat)
			.setExpirationTime(exp)
			.sign(privateKey);

		const response = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion: jwt,
			}),
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.error_description || "Failed to get access token");
		}

		return data.access_token;
	};

	// Helper to send targeted FCM push
	const sendPushToTokens = async (tokens: string[]): Promise<number> => {
		const finalImageUrl2 =
			uploadedFileUrl && uploadedFile
				? uploadedFileUrl
				: imageUrl.trim() || undefined;

		const result = await sendPushNotification({
			tokens,
			title: title.trim(),
			body: body.trim(),
			imageUrl: finalImageUrl2,
			actionType,
			targetScreen: actionType === "screen" ? targetScreen : undefined,
			targetLink: actionType === "link" ? targetLink : undefined,
			silent: isSilent,
			sound: selectedSound,
		});

		return result.sent;
	};

	const fetchDeviceTokens = async () => {
		setManagingDevices(true);
		try {
			// Read from platform-separated documents: fcm_tokens/android, /ios, /web
			const [androidDoc, iosDoc, webDoc] = await Promise.all([
				getDoc(doc(db, "fcm_tokens", "android")),
				getDoc(doc(db, "fcm_tokens", "ios")),
				getDoc(doc(db, "fcm_tokens", "web")),
			]);

			const parseDoc = (snap: any, platform: "android" | "ios" | "web") =>
				snap.exists()
					? Object.entries(snap.data())
							.filter(([k]) => k !== "updatedAt")
							.map(([k, v]) => ({
								id: `${platform}:${k}`,
								token: v as string,
								platform,
							}))
					: [];

			const allTokens = [
				...parseDoc(androidDoc, "android"),
				...parseDoc(iosDoc, "ios"),
				...parseDoc(webDoc, "web"),
			] as {
				id: string;
				token: string;
				platform: "android" | "ios" | "web";
				userName?: string;
				userMandalId?: string;
			}[];

			// Map tokens to user names and mandal
			const usersSnap = await getDocs(collection(db, "users"));
			const tokenToUserMap = new Map<
				string,
				{ name: string; mandalId: string }
			>();
			usersSnap.forEach((doc) => {
				const data = doc.data();
				if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
					data.fcmTokens.forEach((t) => {
						if (t)
							tokenToUserMap.set(t, {
								name: data.realName || "Unknown",
								mandalId: data.mandalId || "",
							});
					});
				}
			});

			allTokens.forEach((device) => {
				if (tokenToUserMap.has(device.token)) {
					const u = tokenToUserMap.get(device.token)!;
					device.userName = u.name;
					device.userMandalId = u.mandalId;
				}
			});

			setDeviceTokens(allTokens);
			setSelectedDeviceIds(new Set());
		} catch (e) {
			console.error("Failed to fetch devices", e);
		}
		setManagingDevices(false);
	};

	const _deleteSelectedDevices = () => {
		if (selectedDeviceIds.size === 0) return;
		setConfirmDialog({
			message: `Delete ${selectedDeviceIds.size} device(s) from database?`,
			onConfirm: async () => {
				setManagingDevices(true);
				try {
					// Group deletes by platform document
					const byPlatform: Record<string, Record<string, any>> = {
						android: {},
						ios: {},
						web: {},
					};
					selectedDeviceIds.forEach((compositeId) => {
						const [platform, key] = compositeId.split(":");
						if (platform in byPlatform)
							byPlatform[platform][key] = deleteField();
					});
					await Promise.all(
						Object.entries(byPlatform)
							.filter(([, updates]) => Object.keys(updates).length > 0)
							.map(([platform, updates]) =>
								updateDoc(doc(db, "fcm_tokens", platform), updates),
							),
					);
					setDeviceTokens((prev) =>
						prev.filter((d) => !selectedDeviceIds.has(d.id)),
					);
					setSelectedDeviceIds(new Set());
					setStatus({ type: "success", msg: "Devices deleted successfully." });
				} catch (e) {
					console.error(e);
					showToast("Failed to delete devices.", "error");
				}
				setManagingDevices(false);
			},
		});
	};

	const sendToSelectedDevices = async () => {
		if (selectedDeviceIds.size === 0) return;
		if (!title.trim()) {
			showToast("Please enter a title on the main screen first.", "error");
			return;
		}
		setManagingDevices(true);
		try {
			const targetTokens = deviceTokens
				.filter((d) => selectedDeviceIds.has(d.id))
				.map((d) => d.token);
			const sentCount = await sendPushToTokens(targetTokens);
			setStatus({
				type: "success",
				msg: `✅ Sent to ${sentCount}/${targetTokens.length} selected device(s)!`,
			});
			handleClose_device_manager();
		} catch (e: any) {
			showToast(`Failed to send: ${e?.message || "Unknown error"}`, "error");
		}
		setManagingDevices(false);
	};

	const sendNotification = async () => {
		if (!serviceAccountJson) {
			setStatus({ type: "error", msg: "Service Account JSON is required" });
			return;
		}
		if (!title.trim()) {
			setStatus({ type: "error", msg: "Title is required" });
			return;
		}

		let serviceAccount;
		try {
			let parsed = JSON.parse(serviceAccountJson);
			if (typeof parsed === "string") {
				parsed = JSON.parse(parsed);
			}
			serviceAccount = parsed;
			if (
				!serviceAccount.project_id ||
				!serviceAccount.private_key ||
				!serviceAccount.client_email
			) {
				throw new Error("Missing required fields in Service Account JSON");
			}
		} catch (e) {
			console.error("JSON Parse Error:", e);
			setStatus({ type: "error", msg: "Invalid Service Account JSON" });
			return;
		}

		setSending(true);
		setStatus(null);

		// If scheduling mode is ON, save to Firestore instead of sending immediately
		if (scheduleMode) {
			if (!scheduledDate || !scheduledTime) {
				setStatus({
					type: "error",
					msg: "Please select both date and time to schedule.",
				});
				setSending(false);
				return;
			}

			const scheduleTimestamp = new Date(
				`${scheduledDate}T${scheduledTime}`,
			).getTime();
			if (Number.isNaN(scheduleTimestamp) || scheduleTimestamp <= Date.now()) {
				setStatus({
					type: "error",
					msg: "Please select a valid future date and time.",
				});
				setSending(false);
				return;
			}

			try {
				const finalImageUrl = uploadedFileUrl || imageUrl.trim();
				const scheduledData = {
					title: title.trim(),
					body: body.trim(),
					imageUrl: finalImageUrl || "",
					actionType,
					targetScreen: actionType === "screen" ? targetScreen : "",
					targetLink: actionType === "link" ? targetLink : "",
					scheduledAt: scheduleTimestamp,
					sent: false,
					createdAt: Date.now(),
				};

				const docRef = doc(collection(db, "scheduled_notifications"));
				await setDoc(docRef, scheduledData);

				setStatus({
					type: "success",
					msg: "Notification scheduled successfully!",
				});

				// Save to history as well
				const newEntry = {
					...scheduledData,
					sentAt: scheduleTimestamp,
					isScheduled: true,
				};
				const filteredHistory = history.filter(
					(h) => h.title !== newEntry.title || h.body !== newEntry.body,
				);
				const newHistory = [newEntry, ...filteredHistory].slice(0, 30);
				setHistory(newHistory);
				await setDoc(
					doc(db, "app_config", "notif_history"),
					{ notifications: newHistory },
					{ merge: true },
				);

				setTitle("");
				setBody("");
				setImageUrl("");
				setScheduleMode(false);
			} catch (e: any) {
				setStatus({
					type: "error",
					msg: e.message || "Failed to schedule notification",
				});
			}
			setSending(false);
			return;
		}

		try {
			const accessToken = await getAccessToken(serviceAccount);

			const notification: any = {
				title: title.trim(),
				body: body.trim(),
			};

			const data: any = {
				action_type: actionType,
				title: title.trim(),
				body: body.trim(),
			};

			if (actionType === "screen" && targetScreen) {
				data.target_screen = targetScreen;
			}
			if (actionType === "link" && targetLink) {
				data.target_link = targetLink;
			}

			const finalImageUrl = uploadedFileUrl || imageUrl.trim();
			if (finalImageUrl) {
				notification.image = finalImageUrl;
				data.image = finalImageUrl; // Ensure CustomFirebaseMessagingService receives it in data payload
			}

			if (isSilent) {
				data.silent = "true";
			}

			const payload = {
				message: {
					topic: "all",
					data, // Sending ONLY data payload guarantees Service Worker / Native Service handles it without duplication
					android: {
						priority: "high",
						notification: {
							title: title.trim(),
							body: body.trim(),
							channel_id: isSilent
								? "silent_alerts_v4"
								: selectedSound === "notisound3"
									? "push_notifications_v6"
									: "push_notifications_v4",
							...(isSilent ? {} : { sound: selectedSound }),
							...(finalImageUrl ? { image: finalImageUrl } : {}),
						},
					},
					apns: {
						headers: {
							"apns-priority": "10",
						},
						payload: {
							aps: {
								...(isSilent ? {} : { sound: `${selectedSound}.m4a` }),
								alert: {
									title: title.trim(),
									body: body.trim(),
								},
								"mutable-content": 1,
							},
						},
						...(finalImageUrl ? { fcm_options: { image: finalImageUrl } } : {}),
					},
				},
			};

			console.log("Sending payload:", payload);

			const res = await fetch(
				`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${accessToken}`,
					},
					body: JSON.stringify(payload),
				},
			);

			const responseData = await res.json();
			console.log("FCM Response:", responseData);

			if (res.ok && responseData.name) {
				setStatus({ type: "success", msg: "Notification sent successfully!" });

				// Save to history
				const newEntry = {
					title: title.trim(),
					body: body.trim(),
					imageUrl: finalImageUrl || "",
					actionType,
					targetScreen: actionType === "screen" ? targetScreen : "",
					targetLink: actionType === "link" ? targetLink : "",
					sentAt: Date.now(),
				};
				const filteredHistory = history.filter(
					(h) => h.title !== newEntry.title || h.body !== newEntry.body,
				);
				const newHistory = [newEntry, ...filteredHistory].slice(0, 30);
				setHistory(newHistory);
				await setDoc(
					doc(db, "app_config", "notif_history"),
					{ notifications: newHistory },
					{ merge: true },
				);

				setTitle("");
				setBody("");
				setImageUrl("");
			} else {
				setStatus({
					type: "error",
					msg: responseData.error?.message || "Failed to send notification.",
				});
			}
		} catch (e: any) {
			console.error("Send Error:", e);
			setStatus({
				type: "error",
				msg: e.message || "An unknown error occurred",
			});
		}
		setSending(false);
	};

	const previewImageUrl = uploadedFileUrl || imageUrl;

	return (
		<div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right">
			{/* Header */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 flex items-center justify-between shadow-sm z-10">
				<div className="flex items-center">
					<button
						onClick={onBack}
						className="p-2 -ml-2 mr-2 text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="m15 18-6-6 6-6" />
						</svg>
					</button>
					<Bell className="text-blue-600 mr-2" size={20} />
					<h2 className="text-lg font-bold text-slate-800 dark:text-white">
						Push Notification Sender
					</h2>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setShowHistory(true)}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm font-bold transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50"
					>
						<History size={16} /> History
					</button>
					<button
						onClick={runDiagnostics}
						className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-xs font-bold flex items-center gap-1"
						title="Run Diagnostics"
					>
						<AlertCircle size={16} className="text-orange-500" />
					</button>
				</div>
			</div>

			{/* Diagnostics Panel */}
			{showDiagnostics && (
				<div
					className={`bg-slate-900 text-white border-b border-slate-700 flex flex-col transition-all duration-300 ${
						isMinimized ? "h-auto" : "max-h-60"
					}`}
				>
					<div className="flex justify-between items-center p-2 bg-slate-800 border-b border-slate-700">
						<span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-ink-400">
							System Logs
						</span>
						<div className="flex items-center gap-1">
							<button
								onClick={() => setIsMinimized(!isMinimized)}
								className="text-slate-400 dark:text-ink-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
							>
								{isMinimized ? (
									<ChevronDown size={16} />
								) : (
									<ChevronUp size={16} />
								)}
							</button>
							<button
								onClick={() => setShowDiagnostics(false)}
								className="text-slate-400 dark:text-ink-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
							>
								<Check size={16} />
							</button>
						</div>
					</div>
					{!isMinimized && (
						<div className="overflow-y-auto p-3 text-xs font-mono space-y-1">
							{diagnostics.map((log, i) => (
								<div
									key={i}
									className="break-all border-b border-slate-800/50 pb-1 mb-1 last:border-0"
								>
									{log}
								</div>
							))}
						</div>
					)}
				</div>
			)}

			<div className="flex-1 overflow-y-auto p-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
				<div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 mb-6">
					{/* Notification Content */}
					<div className="space-y-4">
						<div>
							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
								Title *
							</label>
							<input
								className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
								placeholder="Notification Title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
							/>
						</div>

						<div>
							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
								Body Message
							</label>
							<textarea
								className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 h-24"
								placeholder="Notification content..."
								value={body}
								onChange={(e) => setBody(e.target.value)}
							/>
						</div>

						<div>
							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
								Image URL (Optional)
							</label>
							<div className="flex items-center gap-2">
								<ImageIcon
									size={18}
									className="text-slate-400 dark:text-ink-400"
								/>
								<input
									className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-sm"
									placeholder="https://..."
									value={imageUrl}
									disabled={!!uploadedFileUrl}
									onChange={(e) => setImageUrl(e.target.value)}
								/>
							</div>
						</div>

						<div>
							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-2">
								Or Upload Image File
							</label>
							<div className="flex flex-col gap-2">
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleFileUpload}
									className="hidden"
								/>
								<button
									onClick={() => fileInputRef.current?.click()}
									disabled={uploadingFile}
									className="w-full p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 font-medium disabled:opacity-50"
								>
									{uploadingFile ? (
										<>
											<Loader2 size={18} className="animate-spin" />
											Uploading to GitHub...
										</>
									) : (
										<>
											<Upload size={18} />
											Click to upload image (max 5MB)
										</>
									)}
								</button>
								{uploadedFile && (
									<div className="p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-xl flex items-center justify-between">
										<div className="flex items-center gap-2 min-w-0">
											<ImageIcon
												size={16}
												className="text-green-600 flex-shrink-0"
											/>
											<span className="text-sm font-medium text-green-700 dark:text-green-300 truncate">
												{uploadedFile.name}
											</span>
											<span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">
												({(uploadedFile.size / 1024).toFixed(1)}KB)
											</span>
										</div>
										<button
											onClick={removeUploadedFile}
											className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors flex-shrink-0"
										>
											<X size={16} className="text-green-600" />
										</button>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Action Settings */}
					<div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
						<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
							On Click Action
						</label>
						<div className="flex gap-4 mb-4">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="actionType"
									checked={actionType === "none"}
									onChange={() => setActionType("none")}
									className="text-blue-600"
								/>
								<span className="text-sm font-medium">None</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="actionType"
									checked={actionType === "screen"}
									onChange={() => setActionType("screen")}
									className="text-blue-600"
								/>
								<span className="text-sm font-medium">Open Screen</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="actionType"
									checked={actionType === "link"}
									onChange={() => setActionType("link")}
									className="text-blue-600"
								/>
								<span className="text-sm font-medium">Open Link</span>
							</label>
						</div>

						{actionType === "screen" && (
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									Target Screen
								</label>
								<div className="relative">
									<button
										type="button"
										onClick={() => setOpenScreenDropdown(!openScreenDropdown)}
										className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm flex justify-between items-center"
									>
										<span
											className={
												targetScreen
													? "text-slate-800 dark:text-white"
													: "text-slate-400"
											}
										>
											{SCREEN_OPTIONS.find((o) => o.value === targetScreen)
												?.label || "Select Screen..."}
										</span>
										<ChevronDown
											size={16}
											className={`text-slate-400 dark:text-ink-400 transition-transform ${openScreenDropdown ? "rotate-180" : ""}`}
										/>
									</button>
									{openScreenDropdown && (
										<div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
											{SCREEN_OPTIONS.map((opt) => (
												<button
													key={opt.value}
													type="button"
													onClick={() => {
														setTargetScreen(opt.value);
														setOpenScreenDropdown(false);
													}}
													className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
														targetScreen === opt.value
															? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 font-bold"
															: "text-slate-700 dark:text-slate-300"
													}`}
												>
													{opt.label}
												</button>
											))}
										</div>
									)}
								</div>
							</div>
						)}

						{actionType === "link" && (
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									Target URL
								</label>
								<div className="flex items-center gap-2">
									<LinkIcon
										size={18}
										className="text-slate-400 dark:text-ink-400"
									/>
									<input
										className="flex-1 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-sm"
										placeholder="https://..."
										value={targetLink}
										onChange={(e) => setTargetLink(e.target.value)}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Advanced Settings */}
					<div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
						<div className="flex flex-col gap-3">
							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={scheduleMode}
									onChange={(e) => setScheduleMode(e.target.checked)}
									className="rounded border-slate-300 dark:border-ink-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
								/>
								Schedule this Notification
							</label>

							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={isSilent}
									onChange={(e) => setIsSilent(e.target.checked)}
									className="rounded border-slate-300 dark:border-ink-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
								/>
								Send Silently (All Notification Silent)
							</label>

							<div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

							{!isSilent && (
								<>
									<div className="flex flex-col gap-2 my-2">
										<span className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block">
											Notification Sound
										</span>
										<div className="flex gap-4">
											<label className="flex items-center gap-2 cursor-pointer">
												<input
													type="radio"
													name="notificationSound"
													checked={selectedSound === "notisound3"}
													onChange={() => handleSoundChange("notisound3")}
													className="text-blue-600 focus:ring-blue-500"
												/>
												<span className="text-sm font-medium">
													New Sound (Default)
												</span>
											</label>
											<label className="flex items-center gap-2 cursor-pointer">
												<input
													type="radio"
													name="notificationSound"
													checked={selectedSound === "notisound"}
													onChange={() => handleSoundChange("notisound")}
													className="text-blue-600 focus:ring-blue-500"
												/>
												<span className="text-sm font-medium">Old Sound</span>
											</label>
										</div>
									</div>
									<div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
								</>
							)}

							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={mandalUploadsEnabled}
									onChange={(e) => toggleMandalUploadsEnabled(e.target.checked)}
									className="rounded border-slate-300 dark:border-ink-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
								/>
								Enable Automatic Mandal Notifications (Darshan/Activity)
							</label>

							{mandalUploadsEnabled && (
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase flex items-center gap-2 cursor-pointer mt-2">
									<input
										type="checkbox"
										checked={mandalUploadsSilent}
										onChange={(e) =>
											toggleMandalUploadsSilent(e.target.checked)
										}
										className="rounded border-slate-300 dark:border-ink-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
									/>
									Send as Silent Notification (Mandal Activity/Darshan)
								</label>
							)}

							<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase flex items-center gap-2 cursor-pointer mt-2">
								<input
									type="checkbox"
									checked={youtubeUploadsEnabled}
									onChange={(e) =>
										toggleYoutubeUploadsEnabled(e.target.checked)
									}
									className="rounded border-slate-300 dark:border-ink-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
								/>
								Enable Automatic YouTube Notifications
							</label>
						</div>
						{scheduleMode && (
							<div className="flex gap-4 animate-in fade-in slide-in-from-top-2">
								<div className="flex-1">
									<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
										Date
									</label>
									<input
										type="date"
										min={new Date().toISOString().split("T")[0]}
										value={scheduledDate}
										onChange={(e) => setScheduledDate(e.target.value)}
										className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
									/>
								</div>
								<div className="flex-1">
									<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
										Time
									</label>
									<input
										type="time"
										value={scheduledTime}
										onChange={(e) => setScheduledTime(e.target.value)}
										className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
									/>
								</div>
							</div>
						)}
					</div>

					{status && (
						<div
							className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
								status.type === "success"
									? "bg-green-50 text-green-700 border border-green-200"
									: "bg-red-50 text-red-700 border border-red-200"
							}`}
						>
							{status.type === "success" ? (
								<Check size={16} />
							) : (
								<AlertCircle size={16} />
							)}
							{status.msg}
						</div>
					)}

					<div className="flex gap-3 mt-6 flex-col">
						{/* Row 1: Target Devices + Send to All */}
						<div className="flex gap-3">
							<button
								onClick={() => {
									fetchDeviceTokens();
									setShowDeviceManager(true);
								}}
								className="flex-1 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
							>
								<Users size={18} />
								Target Devices
							</button>

							<button
								onClick={sendNotification}
								disabled={sending || !title.trim()}
								className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-blue-600/20"
							>
								{sending ? (
									<Loader2 size={18} className="animate-spin" />
								) : (
									<Send size={18} />
								)}
								{sending
									? scheduleMode
										? "Scheduling..."
										: "Sending..."
									: scheduleMode
										? "Schedule to All"
										: "Send to All"}
							</button>
						</div>

						{/* Row 2: Send to My Device */}
						<button
							onClick={async () => {
								if (!title.trim()) {
									showToast("Please enter a title first.", "error");
									return;
								}
								if (!fcmToken) {
									showToast(
										"This device does not have an active FCM token. Please restart the app.",
										"error",
									);
									return;
								}
								setSendingToDevice(true);
								try {
									await sendPushToTokens([fcmToken]);
									setStatus({
										type: "success",
										msg: `✅ Sent notification to your device!`,
									});
								} catch (e: any) {
									setStatus({ type: "error", msg: `Failed: ${e.message}` });
								} finally {
									setSendingToDevice(false);
								}
							}}
							disabled={sendingToDevice || !title.trim()}
							className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-emerald-600/20"
						>
							{sendingToDevice ? (
								<Loader2 size={18} className="animate-spin" />
							) : (
								<Bell size={18} />
							)}
							{sendingToDevice
								? "Sending..."
								: `📲 Send to My Device (${Capacitor.getPlatform()})`}
						</button>
					</div>
				</div>

				{/* Android Preview */}
				<div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
					<div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
						<Smartphone
							className="text-slate-400 dark:text-ink-400"
							size={20}
						/>
						<h3 className="font-bold text-lg text-slate-800 dark:text-white">
							Android Preview
						</h3>
					</div>

					<div className="flex flex-col gap-6 max-w-sm mx-auto">
						{/* Collapsed View Preview */}
						<div className="space-y-2">
							<span className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase px-1">
								Collapsed View
							</span>
							<div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 shadow-inner">
								<div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden">
									<div className="p-3 flex gap-3">
										<div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center shrink-0">
											<img
												src="/icon.webp"
												alt="App Icon"
												className="w-5 h-5 object-contain"
												onError={(e) =>
													(e.currentTarget.style.display = "none")
												}
											/>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex justify-between items-center mb-0.5">
												<span className="text-xs font-medium text-slate-500 dark:text-ink-300">
													CPBS Bhajans • now
												</span>
											</div>
											<h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
												{title || "Notification Title"}
											</h4>
											<p className="text-sm text-slate-600 dark:text-slate-300 truncate mt-0.5">
												{body || "Notification body text will appear here..."}
											</p>
										</div>
										{/* Collapsed Large Icon (Square) */}
										{previewImageUrl && (
											<div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-700">
												<img
													src={previewImageUrl}
													alt="Thumbnail"
													className="w-full h-full object-cover"
													onError={(e) =>
														(e.currentTarget.style.display = "none")
													}
												/>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Expanded View Preview */}
						<div className="space-y-2">
							<span className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase px-1">
								Expanded View
							</span>
							<div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 shadow-inner">
								<div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden">
									<div className="p-3 flex gap-3">
										<div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center shrink-0">
											<img
												src="/icon.webp"
												alt="App Icon"
												className="w-5 h-5 object-contain"
												onError={(e) =>
													(e.currentTarget.style.display = "none")
												}
											/>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex justify-between items-center mb-0.5">
												<span className="text-xs font-medium text-slate-500 dark:text-ink-300">
													CPBS Bhajans • now
												</span>
												<ChevronUp
													size={14}
													className="text-slate-400 dark:text-ink-400"
												/>
											</div>
											<h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
												{title || "Notification Title"}
											</h4>
											<p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
												{body || "Notification body text will appear here..."}
											</p>
										</div>
									</div>
									{/* Expanded Big Picture */}
									{previewImageUrl && (
										<div className="w-full h-48 bg-slate-200 dark:bg-slate-700">
											<img
												src={previewImageUrl}
												alt="Preview"
												className="w-full h-full object-cover"
												onError={(e) =>
													(e.currentTarget.style.display = "none")
												}
											/>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* ── HISTORY BOTTOM SHEET ── */}
			{showHistory && (
				<div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-h-[85vh] h-[85vh] sm:h-[600px] flex flex-col shadow-2xl animate-in slide-in-from-bottom-8 duration-300 border border-slate-200/20">
						{/* Modal Header */}
						<div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl z-10 sticky top-0">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
									<History size={20} />
								</div>
								<div>
									<h3 className="font-bold text-lg text-slate-800 dark:text-white leading-none">
										Sent Notifications
									</h3>
									<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
										Tap one to reload it
									</p>
								</div>
							</div>
							<button
								onClick={() => handleClose_notif_history()}
								className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-400 transition-colors"
							>
								<X size={18} />
							</button>
						</div>

						{/* Scrollable List */}
						<div className="overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex-1 space-y-4 bg-slate-50 dark:bg-slate-900/50">
							{history.length === 0 ? (
								<div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-3 pb-10">
									<History size={48} className="opacity-20" />
									<p className="text-center font-medium">
										No notifications sent yet.
									</p>
								</div>
							) : (
								history.map((h, i) => (
									<div
										key={i}
										className="p-4 border border-slate-200 dark:border-slate-700/60 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex flex-col gap-3 active:scale-[0.98] transition-transform"
									>
										<div className="flex justify-between items-start gap-2">
											{h.title ? (
												<h4 className="font-bold text-slate-800 dark:text-slate-200 text-base leading-tight">
													{h.title}
												</h4>
											) : (
												<h4 className="font-medium text-slate-400 dark:text-ink-400 text-sm">
													No Title
												</h4>
											)}
											{h.sentAt && (
												<span className="text-[10px] font-bold text-slate-400 dark:text-ink-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md whitespace-nowrap">
													{new Date(h.sentAt).toLocaleDateString()}
												</span>
											)}
										</div>

										{h.body && (
											<p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
												{h.body}
											</p>
										)}

										<div className="flex items-center gap-2 flex-wrap">
											{h.actionType !== "none" && (
												<span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
													{h.actionType === "screen"
														? `→ ${h.targetScreen}`
														: `🔗 Link`}
												</span>
											)}
											{h.imageUrl && (
												<span className="text-[10px] font-bold bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
													📷 Has Image
												</span>
											)}
										</div>

										<button
											onClick={() => {
												setTitle(h.title || "");
												setBody(h.body || "");
												setImageUrl(h.imageUrl || "");
												setActionType(h.actionType || "none");
												if (h.targetScreen) setTargetScreen(h.targetScreen);
												if (h.targetLink) setTargetLink(h.targetLink);
												handleClose_notif_history();
											}}
											className="mt-1 w-full py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-blue-100 dark:border-blue-800/50"
										>
											<Check size={16} /> Load This Notification
										</button>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			)}
			{/* ── DEVICE MANAGER BOTTOM SHEET ── */}
			{showDeviceManager && (
				<div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="w-full sm:max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-h-[90vh] h-[90vh] sm:h-[650px] flex flex-col shadow-2xl animate-in slide-in-from-bottom-8 duration-300 border border-slate-200/20">
						{/* Modal Header */}
						<div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl z-10 sticky top-0">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
									<Users size={20} />
								</div>
								<div>
									<h3 className="font-bold text-lg text-slate-800 dark:text-white leading-none">
										Registered Devices
									</h3>
									<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
										{deviceTokens.length} total active tokens
									</p>
								</div>
							</div>
							<button
								onClick={() => handleClose_device_manager()}
								className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-400 transition-colors"
							>
								<X size={18} />
							</button>
						</div>

						{/* ── Platform Tabs ── */}
						{(() => {
							const TABS: {
								key: "android" | "ios" | "web";
								icon: string;
								label: string;
							}[] = [
								{ key: "android", icon: "🤖", label: "Android" },
								{ key: "ios", icon: "🍎", label: "iOS" },
								{ key: "web", icon: "🌐", label: "Web" },
							];
							const tabTokens = deviceTokens.filter(
								(d) =>
									d.platform === activeDeviceTab &&
									(mandalFilter === "all" || d.userMandalId === mandalFilter) &&
									(!deviceSearchQuery ||
										(d.userName?.toLowerCase() || "").includes(
											deviceSearchQuery.toLowerCase().trim(),
										) ||
										d.token
											.toLowerCase()
											.includes(deviceSearchQuery.toLowerCase().trim())),
							);
							const _currentPlatform = Capacitor.getPlatform();

							return (
								<>
									{/* Tab Bar */}
									<div className="flex border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 shrink-0">
										{TABS.map((tab) => {
											const count = deviceTokens.filter(
												(d) => d.platform === tab.key,
											).length;
											const isActive = activeDeviceTab === tab.key;
											return (
												<button
													key={tab.key}
													onClick={() => setActiveDeviceTab(tab.key)}
													className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-sm font-bold border-b-2 transition-colors ${
														isActive
															? "border-blue-600 text-blue-600 dark:text-blue-400"
															: "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
													}`}
												>
													<span>
														{tab.icon} {tab.label}
													</span>
													<span
														className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
															isActive
																? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
																: "bg-slate-100 dark:bg-slate-800 text-slate-500"
														}`}
													>
														{count}
													</span>
												</button>
											);
										})}
									</div>

									{/* Per-Tab Action Bar */}
									<div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900 flex flex-col gap-3 shrink-0">
										<div className="flex justify-between items-center">
											<button
												onClick={() => {
													const tabIds = new Set(tabTokens.map((d) => d.id));
													const allTabSelected =
														tabIds.size > 0 &&
														[...tabIds].every((id) =>
															selectedDeviceIds.has(id),
														);
													const newSet = new Set(selectedDeviceIds);
													if (allTabSelected) {
														tabIds.forEach((id) => newSet.delete(id));
													} else {
														tabIds.forEach((id) => newSet.add(id));
													}
													setSelectedDeviceIds(newSet);
												}}
												className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
											>
												{tabTokens.length > 0 &&
												tabTokens.every((d) => selectedDeviceIds.has(d.id)) ? (
													<>
														<CheckSquare size={16} className="text-blue-600" />{" "}
														Deselect Tab
													</>
												) : (
													<>
														<Square size={16} /> Select Tab
													</>
												)}
											</button>
											{activeDeviceTab === "ios" && (
												<span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
													⚠️ Web push limited on iOS
												</span>
											)}
										</div>
										<div className="flex gap-2">
											<div className="relative flex-1">
												<Search
													className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ink-400"
													size={16}
												/>
												<input
													type="text"
													placeholder="Search by name or token..."
													value={deviceSearchQuery}
													onChange={(e) => setDeviceSearchQuery(e.target.value)}
													className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
												/>
											</div>
											<CustomDropdown
												value={mandalFilter}
												onChange={(val) => setMandalFilter(val)}
												options={MANDAL_LIST.map((m) => ({
													id: m.id,
													label:
														settingsLanguage === "hi"
															? m.shortNameHi
															: m.shortNameEn,
												}))}
												placeholder="All Mandals"
												className="w-1/3"
											/>
										</div>
									</div>

									{/* Device List for Active Tab */}
									<div className="overflow-y-auto p-4 flex-1 space-y-2 bg-slate-50 dark:bg-slate-900/50">
										{managingDevices ? (
											<div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-ink-400">
												<Loader2
													size={32}
													className="animate-spin text-blue-500"
												/>
												<p className="font-medium text-sm">
													Loading devices...
												</p>
											</div>
										) : tabTokens.length === 0 ? (
											<div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500 pb-10">
												<Users size={40} className="opacity-20" />
												<p className="text-center font-medium text-sm">
													No {activeDeviceTab} devices registered
												</p>
											</div>
										) : (
											[...tabTokens]
												.sort((a, b) => {
													const aIsThisDevice = a.token === fcmToken;
													const bIsThisDevice = b.token === fcmToken;
													if (aIsThisDevice && !bIsThisDevice) return -1;
													if (!aIsThisDevice && bIsThisDevice) return 1;

													const aHasName = !!a.userName;
													const bHasName = !!b.userName;
													if (aHasName && !bHasName) return -1;
													if (!aHasName && bHasName) return 1;

													return 0;
												})
												.map((d) => {
													const isSelected = selectedDeviceIds.has(d.id);
													const isThisDevice = d.token === fcmToken;
													return (
														<div
															key={d.id}
															onClick={() => {
																const newSet = new Set(selectedDeviceIds);
																if (isSelected) newSet.delete(d.id);
																else newSet.add(d.id);
																setSelectedDeviceIds(newSet);
															}}
															className={`p-3 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
																isSelected
																	? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50"
																	: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
															}`}
														>
															<div className="mt-0.5">
																{isSelected ? (
																	<CheckSquare
																		size={18}
																		className="text-blue-600"
																	/>
																) : (
																	<Square
																		size={18}
																		className="text-slate-300 dark:text-slate-600"
																	/>
																)}
															</div>
															<div className="flex-1 min-w-0">
																<div className="flex items-center gap-2 mb-1">
																	<span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
																		…{d.id.split(":")[1]}
																	</span>
																	{d.userName && (
																		<span className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
																			<User size={10} /> {d.userName}
																		</span>
																	)}
																	{isThisDevice && (
																		<span className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
																			📱 This Device
																		</span>
																	)}
																</div>
																<p
																	className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate w-full"
																	title={d.token}
																>
																	{d.token}
																</p>
															</div>
														</div>
													);
												})
										)}
									</div>
								</>
							);
						})()}

						{/* Bottom Action */}
						<div className="p-4 border-t border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0">
							<button
								onClick={sendToSelectedDevices}
								disabled={
									managingDevices ||
									selectedDeviceIds.size === 0 ||
									!title.trim()
								}
								className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-blue-600/20"
							>
								{managingDevices ? (
									<Loader2 size={18} className="animate-spin" />
								) : (
									<Send size={18} />
								)}
								{managingDevices
									? "Processing..."
									: `Send to ${selectedDeviceIds.size} Selected Device(s)`}
							</button>
							{selectedDeviceIds.size > 0 && !title.trim() && (
								<p className="text-center text-xs text-red-500 font-medium mt-2">
									* Enter a title on the main screen to send
								</p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

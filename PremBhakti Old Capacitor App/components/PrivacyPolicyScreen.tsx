import {
	AlertTriangle,
	ArrowLeft,
	Database,
	Globe,
	Languages,
	Loader2,
	Lock,
	ShieldCheck,
	Smartphone,
	Trash2,
	User,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface PrivacyPolicyScreenProps {
	onBack: () => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage?: "en" | "hi";
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
	onBack,
	scrollBarSide = "left",
	settingsLanguage = "hi",
}) => {
	const [lang, setLang] = useState<"en" | "hi">(settingsLanguage);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const { user, deleteAccount } = useAuth();
	const { showToast } = useToast();

	const handleDeleteAccount = async () => {
		if (!user) {
			showToast(
				lang === "hi"
					? "अकाउंट डिलीट करने के लिए पहले लॉगिन करें।"
					: "Please login first to delete your account.",
				"error",
			);
			return;
		}
		setIsDeleting(true);
		try {
			const success = await deleteAccount();
			if (success) {
				localStorage.clear();
				setShowDeleteConfirm(false);
				onBack();
			}
		} catch (error: any) {
			console.error("Error deleting account:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	const t = {
		title: lang === "hi" ? "गोपनीयता नीति" : "Privacy Policy",
		intro:
			lang === "hi"
				? "Prem Bhakti भजन ऐप आपकी गोपनीयता का सम्मान करता है। हम पारदर्शिता और सुरक्षा के लिए प्रतिबद्ध हैं।"
				: "Prem Bhakti Bhajan App respects your privacy. We are committed to transparency and security.",

		sections: [
			{
				icon: <Database size={20} className="text-blue-500" />,
				title: lang === "hi" ? "डेटा संग्रह (Data Collection)" : "Data Collection",
				content:
					lang === "hi"
						? 'जब आप Google के माध्यम से लॉग इन करते हैं, तो हम आपकी बुनियादी प्रोफ़ाइल जानकारी (नाम, ईमेल, प्रोफ़ाइल फ़ोटो) एकत्र करते हैं। हम ऐप के भीतर आपकी गतिविधि (जैसे लाइक) भी सुरक्षित रूप से सहेजते हैं। इसके अतिरिक्त, यदि आप "Google Drive बैकअप" सुविधा का उपयोग करते हैं, तो आपकी प्लेलिस्ट और सेटिंग्स सीधे आपके Google Drive खाते में सहेजी जाती हैं।'
						: 'When you log in via Google, we collect basic profile information (Name, Email, Profile Picture). We also securely store your activity within the app (such as Likes). Additionally, if you use the "Google Drive Backup" feature, your playlists and settings are saved directly to your Google Drive account.',
			},
			{
				icon: <Smartphone size={20} className="text-green-500" />,
				title: lang === "hi" ? "अनुमतियाँ (Permissions)" : "Permissions",
				content:
					lang === "hi"
						? "• स्टोरेज (Storage): इसका उपयोग केवल आपके द्वारा डाउनलोड की गई पीडीएफ पुस्तकों, ऑडियो ट्रैक और दर्शन छवियों को आपके डिवाइस में सहेजने के लिए किया जाता है।\n• इंटरनेट (Internet): इसका उपयोग ऑनलाइन सामग्री (दैनिक सुविचार, दर्शन, ऑडियो) लाने और Google सेवाओं से कनेक्ट करने के लिए किया जाता है।"
						: "• Storage: Used solely to save PDF books, audio tracks, and darshan images that you explicitly choose to download.\n• Internet: Used to fetch online content (Daily Quotes, Darshan, Audio) and connect to Google services.",
			},
			{
				icon: <Lock size={20} className="text-saffron-500" />,
				title: lang === "hi" ? "सुरक्षा (Security)" : "Security",
				content:
					lang === "hi"
						? "आपका डेटा (प्रोफाइल, लाइक) Google Firebase के सुरक्षित सर्वर पर संग्रहीत किया जाता है। हम आपके डेटा को किसी भी तीसरे पक्ष (Third Party) के साथ नहीं बेचते या साझा नहीं करते हैं। आपकी व्यक्तिगत बैकअप फ़ाइलें आपके स्वयं के Google Drive पर सुरक्षित रहती हैं।"
						: "Your data (profile, likes) is stored on Google Firebase secure servers. We do not sell or share your data with any third parties. Your personal backup files remain secure on your own Google Drive.",
			},
			{
				icon: <Globe size={20} className="text-purple-500" />,
				title:
					lang === "hi"
						? "तृतीय-पक्ष सेवाएँ (Third-Party Services)"
						: "Third-Party Services",
				content:
					lang === "hi"
						? "हम मुख्य रूप से प्रमाणीकरण (Authentication), डेटाबेस (Firestore) और बैकअप के लिए Google सेवाओं (Firebase, Google Drive API) का उपयोग करते हैं। मीडिया सामग्री वितरित करने के लिए अन्य क्लाउड सेवाओं (जैसे GitHub) का उपयोग किया जा सकता है। वेबसाइट पर, कितने लोग साइट देखते हैं यह समझने के लिए Google Analytics कुकीज़ का उपयोग करता है; इसमें आपका नाम या ईमेल नहीं भेजा जाता।"
						: "We primarily use Google Services (Firebase, Google Drive API) for authentication, database, and backups. Other cloud services (like GitHub) may be used strictly for delivering media content. On the website, Google Analytics uses cookies to count visits and see which pages are used; your name or email is not sent to it.",
			},
			{
				icon: <User size={20} className="text-red-500" />,
				title:
					lang === "hi" ? "डेटा हटाना (Data Deletion)" : "Data Deletion Rights",
				content:
					lang === "hi"
						? 'यदि आप ऐप में लॉग इन करते हैं (Google के माध्यम से), तो हम केवल बुनियादी प्रोफ़ाइल जानकारी संग्रहीत करते हैं। आप ऐप के "प्रोफाइल" अनुभाग में जाकर किसी भी समय "अकाउंट डिलीट करें" बटन का उपयोग करके अपना अकाउंट डी-एक्टिवेट कर सकते हैं। सुरक्षा कारणों से आपका डेटा 30 दिनों तक सुरक्षित रखा जाएगा, जिसके बाद इसे स्थायी रूप से मिटा दिया जाएगा।'
						: 'If you choose to log in (via Google), we store basic profile information. You have the right to deactivate your account at any time using the "Delete Account & Data" button located in the Profile section. For security reasons, your data will be retained for 30 days before being permanently deleted.',
			},
		],
		contact: lang === "hi" ? "संपर्क करें" : "Contact Us",
		contactDesc:
			lang === "hi"
				? "यदि आपके पास गोपनीयता नीति के बारे में कोई प्रश्न हैं, तो आप हमसे संपर्क कर सकते हैं।"
				: "If you have any questions regarding this Privacy Policy, you can contact us.",
	};

	return (
		<div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 font-hindi">
			{/* Header */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-10 sticky top-0">
				<div className="flex items-center gap-3">
					<button
						onClick={onBack}
						className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
					</button>
					<h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
						<ShieldCheck className="w-6 h-6 text-saffron-500" />
						{t.title}
					</h2>
				</div>

				<button
					onClick={() => setLang((prev) => (prev === "hi" ? "en" : "hi"))}
					className="flex items-center gap-1.5 bg-saffron-50 dark:bg-slate-800 border border-saffron-200 dark:border-slate-700 hover:bg-saffron-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors text-sm font-medium text-saffron-700 dark:text-saffron-400"
				>
					<Languages size={16} />
					<span>{lang === "hi" ? "English" : "हिंदी"}</span>
				</button>
			</div>

			{/* Content */}
			<div
				className={`flex-1 overflow-y-auto ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]`}
			>
				<div
					dir={scrollBarSide === "left" ? "ltr" : undefined}
					className="max-w-2xl mx-auto space-y-6"
				>
					<div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm font-medium leading-relaxed">
						{t.intro}
					</div>

					<div className="space-y-4">
						{t.sections.map((section, idx) => (
							<div
								key={idx}
								className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700"
							>
								<div className="flex items-center gap-3 mb-3">
									<div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
										{section.icon}
									</div>
									<h3 className="font-bold text-slate-800 dark:text-white text-lg">
										{section.title}
									</h3>
								</div>
								<p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
									{section.content}
								</p>
							</div>
						))}
					</div>

					<div className="text-center pt-6 pb-4">
						<p className="text-xs text-slate-400 dark:text-slate-500">
							{t.contactDesc}
							<br />
							Email: cpbssangh@gmail.com
						</p>
					</div>

					{/* Delete Account Section directly in Privacy Policy */}
					<div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
						<div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-5 border border-red-100 dark:border-red-900/30">
							<h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
								<AlertTriangle size={20} />
								{lang === "hi"
									? "अकाउंट और डेटा डिलीट करें"
									: "Delete Account & Data"}
							</h3>
							<p className="text-sm text-red-800/80 dark:text-red-300/80 mb-4 leading-relaxed font-medium">
								{lang === "hi"
									? "आप अपने अकाउंट को यहाँ से डी-एक्टिवेट कर सकते हैं। सुरक्षा कारणों से आपका डेटा 30 दिनों तक सुरक्षित रखा जाएगा, जिसके बाद इसे हमेशा के लिए मिटा दिया जाएगा।"
									: "You can deactivate your account from here. For security reasons, your data will be retained for 30 days before being permanently deleted."}
							</p>
							{user ? (
								<button
									onClick={() => setShowDeleteConfirm(true)}
									className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 py-3.5 rounded-xl transition-colors active:scale-95 shadow-sm"
								>
									<Trash2 size={18} />
									{lang === "hi" ? "मेरा अकाउंट डिलीट करें" : "Delete My Account"}
								</button>
							) : (
								<div className="bg-white/60 dark:bg-slate-800/60 p-3 rounded-xl border border-red-100 dark:border-red-900/30 text-center">
									<p className="text-sm font-bold text-slate-600 dark:text-slate-300">
										{lang === "hi"
											? "डेटा डिलीट करने के लिए कृपया पहले ऐप में लॉगिन करें।"
											: "Please log in to the app to delete your data."}
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
						<div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4 mx-auto">
							<AlertTriangle size={24} />
						</div>
						<h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-2">
							{lang === "hi" ? "अकाउंट डिलीट करें?" : "Delete Account?"}
						</h3>
						<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6 leading-relaxed">
							{lang === "hi"
								? "क्या आप वाकई अपना अकाउंट डिलीट करना चाहते हैं? आपका अकाउंट तुरंत डी-एक्टिवेट हो जाएगा और 30 दिनों के बाद आपका डेटा स्थायी रूप से मिटा दिया जाएगा।"
								: "Are you sure you want to delete your account? Your account will be deactivated immediately and your data will be permanently removed after 30 days."}
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowDeleteConfirm(false)}
								disabled={isDeleting}
								className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-ink-600 transition-colors active:scale-95"
							>
								{lang === "hi" ? "रद्द करें" : "Cancel"}
							</button>
							<button
								onClick={handleDeleteAccount}
								disabled={isDeleting}
								className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300 transition-colors flex items-center justify-center gap-2 shadow-sm"
							>
								{isDeleting ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<Trash2 size={16} />
								)}
								{lang === "hi" ? "डिलीट करें" : "Delete"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

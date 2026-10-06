import { Capacitor } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";
import {
	ArrowLeft,
	Building2,
	Check,
	ChevronRight,
	Copy,
	Download,
	Gift,
	HandHeart,
	Info,
	Languages,
	MessageCircle,
	QrCode,
	ShieldCheck,
	Sparkles,
	Star,
	User,
	Wheat,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { copyToClipboard } from "../utils/clipboard";
import { toLocalDateKey } from "../utils/dateFormatter";
import { CustomDateInput } from "./ui/CustomDateInput";

interface DonateScreenProps {
	isOpen: boolean;
	onClose: () => void;
	settingsLanguage: "en" | "hi";
}

type Step = "selection" | "payment" | "confirm";
type PaymentMethod = "upi" | "bank";

// --- CONTACT NUMBERS ---
const CONTACTS = {
	NAMAN: "919887880429",
	LUCKY: "919039484855",
};

const UPI_ID = "9660793593@sbi";

// --- DATA STRUCTURES ---

interface SevaItem {
	labelEn: string;
	labelHi: string;
	amount: number;
}

interface CartItem {
	id: string;
	sevaId: string;
	titleEn: string;
	titleHi: string;
	amount: number;
	customName?: string | null;
}

interface SevaOption {
	id: string;
	icon: React.ReactNode;
	color: string; // Tailwind color class for icon bg
	borderColor: string; // Tailwind border class
	titleEn: string;
	titleHi: string;
	descEn: string;
	descHi: string;
	bankContext: "general" | "gauseva";
	amounts?: number[];
	fixedItems?: SevaItem[];
	tagEn?: string;
	tagHi?: string;
}

const SEVA_OPTIONS: SevaOption[] = [
	{
		id: "anupam_seva",
		icon: <Sparkles size={28} />,
		color: "bg-pink-100 text-pink-600",
		borderColor: "border-pink-200 hover:border-pink-500",
		titleEn: "Temple Seva List",
		titleHi: "मंदिर अनुपम सेवा अवसर",
		descEn: "Fixed donation for Bhog, Aarti, Poshak etc.",
		descHi: "आरती, भोग, पोशाक एवं माला सेवा राशि।",
		bankContext: "general",
		tagEn: "Rate List",
		tagHi: "सूची",
		fixedItems: [
			{
				labelHi: "आरती सेवा (धूप, दीप, घी)",
				labelEn: "Aarti Seva (Dhup, Deep)",
				amount: 251,
			},
			{ labelHi: "बाल भोग सेवा", labelEn: "Bal Bhog Seva", amount: 501 },
			{ labelHi: "शयन भोग सेवा", labelEn: "Shayan Bhog Seva", amount: 501 },
			{
				labelHi: "नित्य पुष्प-माला सेवा",
				labelEn: "Nitya Pushp-Mala Seva",
				amount: 751,
			},
			{ labelHi: "संध्या भोग सेवा", labelEn: "Sandhya Bhog Seva", amount: 1100 },
			{
				labelHi: "एकादशी पुष्प-माला सेवा",
				labelEn: "Ekadashi Pushp-Mala Seva",
				amount: 1100,
			},
			{ labelHi: "राजभोग सेवा", labelEn: "Rajbhog Seva", amount: 2100 },
			{
				labelHi: "पोशाक सेवा (गुरु महाराज)",
				labelEn: "Poshak (Guru Maharaj)",
				amount: 2100,
			},
			{
				labelHi: "पोशाक सेवा (जगन्नाथ जी)",
				labelEn: "Poshak (Jagannath Ji)",
				amount: 5100,
			},
			{
				labelHi: "पोशाक सेवा (गोविंद देव जी)",
				labelEn: "Poshak (Govind Dev Ji)",
				amount: 15000,
			},
		],
	},
	{
		id: "gauseva",
		icon: <Wheat size={28} />,
		color: "bg-green-100 text-green-600",
		borderColor: "border-green-200 hover:border-green-500",
		titleEn: "Gau Seva (Cow Protection)",
		titleHi: "गौ सेवा (गौशाला)",
		descEn: "Feed and protect sacred cows.",
		descHi: "पवित्र गौमाता की सेवा और रक्षा।",
		bankContext: "gauseva",
		tagEn: "Highly Auspicious",
		tagHi: "अति शुभ",
		fixedItems: [
			{
				labelHi: "गौ ग्रास (हरा चारा)",
				labelEn: "Gau Grass (Green Fodder)",
				amount: 251,
			},
			{
				labelHi: "एक दिन की सेवा (चारा-दाना)",
				labelEn: "Full Day Cow Care",
				amount: 1100,
			},
			{
				labelHi: "औषधि सेवा (बीमार गौवंश)",
				labelEn: "Medicine Seva (Sick Cows)",
				amount: 2100,
			},
			{
				labelHi: "विशेष भोग (लापसी/गुड़)",
				labelEn: "Special Feast (Sweet)",
				amount: 3100,
			},
			{ labelHi: "मासिक गौ पालन", labelEn: "Monthly Adoption", amount: 5100 },
			{
				labelHi: "विशाल गौशाला भंडारा",
				labelEn: "Grand Gaushala Feast",
				amount: 11000,
			},
		],
	},
	{
		id: "annadan",
		icon: <Gift size={28} />,
		color: "bg-orange-100 text-orange-600",
		borderColor: "border-orange-200 hover:border-orange-500",
		titleEn: "Annadan (Prasadam)",
		titleHi: "अन्नदान (प्रसाद सेवा)",
		descEn: "Feed devotees and the needy.",
		descHi: "भक्तों और जरूरतमंदों को भोजन।",
		bankContext: "general",
		tagEn: "Most Popular",
		tagHi: "सबसे लोकप्रिय",
		fixedItems: [
			{ labelHi: "एक साधु भोजन", labelEn: "Single Sadhu Bhojan", amount: 251 },
			{
				labelHi: "बाल भोग (नाश्ता)",
				labelEn: "Bal Bhog (Breakfast)",
				amount: 1100,
			},
			{
				labelHi: "वैष्णव सेवा (लघु समूह)",
				labelEn: "Vaishnav Seva (Small Group)",
				amount: 2100,
			},
			{
				labelHi: "राजभोग सेवा (11 भक्त)",
				labelEn: "Rajbhog Seva (11 Devotees)",
				amount: 5100,
			},
			{
				labelHi: "पूर्ण भंडारा (51 भक्त)",
				labelEn: "Full Bhandara (51 Devotees)",
				amount: 11000,
			},
			{
				labelHi: "विशाल महोत्सव भंडारा",
				labelEn: "Grand Festival Feast",
				amount: 21000,
			},
		],
	},
	{
		id: "general",
		icon: <Building2 size={28} />,
		color: "bg-blue-100 text-blue-600",
		borderColor: "border-blue-200 hover:border-blue-500",
		titleEn: "Mandir Construction",
		titleHi: "मंदिर निर्माण सेवा",
		descEn: "Build a home for the Lord.",
		descHi: "प्रभु के धाम निर्माण में सहयोग।",
		bankContext: "general",
	},
];

const BANK_DETAILS = {
	general: {
		name: "Shri Krishna Chaitanya Prem Bhakti Sangh",
		bank: "HDFC Bank",
		acc: "99950056565656",
		ifsc: "HDFC0001055",
		branch: "Kota",
	},
	gauseva: {
		name: "Shree Krishna Chetnya Prem Bhakti Sankirtan Samiti",
		bank: "State Bank of India",
		acc: "37692935997",
		ifsc: "SBIN0011311",
		branch: "Kota",
	},
};

export const DonateScreen: React.FC<DonateScreenProps> = ({
	isOpen,
	onClose,
	settingsLanguage,
}) => {
	const { showToast } = useToast();
	const { user, profile, signInWithGoogle } = useAuth();
	// Only approved devotees may send the payment confirmation on WhatsApp or
	// see the Trust's contact numbers; everyone else is told to sign in and get
	// their profile approved first.
	const canSendConfirmation = !!user && profile?.isApproved === true;
	// State
	const [lang, setLang] = useState<"en" | "hi">("hi");
	const [step, setStep] = useState<Step>("selection");
	const [selectedSevaId, setSelectedSevaId] = useState<string | null>(null);

	const [amount, setAmount] = useState<number | "">("");
	const [customAmountStr, setCustomAmountStr] = useState<string>("");
	const [customSevaName, setCustomSevaName] = useState<string | null>(null); // For specific fixed items

	const [cart, setCart] = useState<CartItem[]>([]);
	const [showCart, setShowCart] = useState(false);
	// Back-button: showCart
	useEffect(() => {
		if (showCart)
			window.history.pushState({ isPopup: true, view: "donate-cart" }, "");
	}, [showCart]);
	useEffect(() => {
		const h = (e: PopStateEvent) => {
			if (showCart && e.state?.view !== "donate-cart") setShowCart(false);
		};
		window.addEventListener("popstate", h);
		return () => window.removeEventListener("popstate", h);
	}, [showCart]);
	const handleClose_Cart = () => {
		if (window.history.state?.view === "donate-cart") window.history.back();
		else setShowCart(false);
	};

	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");

	// UI Feedback State
	const [copiedText, setCopiedText] = useState<string | null>(null);
	const [donorName, setDonorName] = useState("");
	const [txnDate, setTxnDate] = useState(() => toLocalDateKey());
	const [showContactModal, setShowContactModal] = useState(false);
	// Back-button: showContactModal
	useEffect(() => {
		if (showContactModal)
			window.history.pushState({ isPopup: true, view: "contact-modal" }, "");
	}, [showContactModal]);
	useEffect(() => {
		const h = (e: PopStateEvent) => {
			if (showContactModal && e.state?.view !== "contact-modal")
				setShowContactModal(false);
		};
		window.addEventListener("popstate", h);
		return () => window.removeEventListener("popstate", h);
	}, [showContactModal]);
	const handleClose_ContactModal = () => {
		if (window.history.state?.view === "contact-modal") window.history.back();
		else setShowContactModal(false);
	};
	const [showHighAmountWarning, setShowHighAmountWarning] = useState(false);
	// Back-button: showHighAmountWarning
	useEffect(() => {
		if (showHighAmountWarning)
			window.history.pushState(
				{ isPopup: true, view: "high-amount-warning" },
				"",
			);
	}, [showHighAmountWarning]);
	const handleClose_high_amount_warning = () => {
		if (window.history.state?.view === "high-amount-warning")
			window.history.back();
		else setShowHighAmountWarning(false);
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_high_amount_warning is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const _h_high_amount_warning = (e: PopStateEvent) => {
			if (showHighAmountWarning && e.state?.view !== "high-amount-warning")
				handleClose_high_amount_warning();
		};
		window.addEventListener("popstate", _h_high_amount_warning);
		return () => window.removeEventListener("popstate", _h_high_amount_warning);
	}, [showHighAmountWarning]);

	const isHindi = lang === "hi";

	// --- Effects ---

	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_Cart, handleClose_ContactModal are recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (isOpen) {
			setLang(settingsLanguage === "hi" ? "hi" : "en");
			setStep("selection");
			setSelectedSevaId(null);
			setAmount("");
			setCustomAmountStr("");
			setCustomSevaName(null);
			setCart([]);
			handleClose_Cart();
			setDonorName("");
			handleClose_ContactModal();
		}
	}, [isOpen, settingsLanguage]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: handleClose_ContactModal is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		if (isOpen) {
			const handlePopState = () => {
				if (showContactModal) handleClose_ContactModal();
				else if (step === "confirm") setStep("payment");
				else if (step === "payment") setStep("selection");
				else onClose();
			};

			window.history.pushState(
				{ isPopup: true, view: "donate", step: "donate-root" },
				"",
			);
			window.addEventListener("popstate", handlePopState);
			return () => window.removeEventListener("popstate", handlePopState);
		}
	}, [isOpen, step, showContactModal, onClose]);

	if (!isOpen) return null;

	// --- Handlers ---

	const handleSevaSelect = (id: string) => {
		if (selectedSevaId === id) {
			setSelectedSevaId(null);
			setAmount("");
			setCustomSevaName(null);
		} else {
			setSelectedSevaId(id);
			setAmount("");
			setCustomAmountStr("");
			setCustomSevaName(null);
		}
	};

	const handleAmountSelect = (val: number) => {
		setAmount(val);
		setCustomAmountStr("");
		setCustomSevaName(null); // Clear specific item name if generic amount selected
	};

	const handleFixedItemSelect = (item: SevaItem) => {
		setAmount(item.amount);
		setCustomSevaName(isHindi ? item.labelHi : item.labelEn);
		setCustomAmountStr("");
	};

	const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setCustomAmountStr(val);
		const num = parseInt(val, 10);
		setAmount(Number.isNaN(num) ? "" : num);
		// Clear custom name when typing custom amount so receipt shows generic category
		setCustomSevaName(null);
	};

	const handleAddToCart = () => {
		if (amount && amount > 0 && selectedSevaId) {
			const seva = SEVA_OPTIONS.find((s) => s.id === selectedSevaId);
			if (seva) {
				const newItem: CartItem = {
					id: Date.now().toString(),
					sevaId: seva.id,
					titleEn: seva.titleEn,
					titleHi: seva.titleHi,
					amount: Number(amount),
					customName: customSevaName,
				};
				setCart((prev) => [...prev, newItem]);
				// Reset selection
				setAmount("");
				setCustomAmountStr("");
				setCustomSevaName(null);
				// Show cart briefly or just toast? Let's open cart drawer if implemented, or just toast
				// For now, maybe just feedback
			}
		}
	};

	const handleRemoveFromCart = (itemId: string) => {
		setCart((prev) => prev.filter((item) => item.id !== itemId));
	};

	const cartTotal = cart.reduce((sum, item) => sum + item.amount, 0);
	const currentTotal = amount ? Number(amount) : 0;
	const grandTotal = cartTotal + currentTotal;

	const handleProceed = () => {
		// If there is a current selection, add it to cart first?
		// OR if cart is empty, use current selection.
		// Strategy: If user clicks proceed and has pending amount, add to cart then proceed.

		if (currentTotal > 0 && selectedSevaId) {
			handleAddToCart();
			// After adding, cart is updated in next render, but we want to proceed immediately.
			// So we can't rely on 'cart' state immediately for the check.
			// Instead, we set step to payment.
			window.history.pushState(
				{ isPopup: true, view: "donate", step: "payment" },
				"",
			);
			setStep("payment");
		} else if (cart.length > 0) {
			window.history.pushState(
				{ isPopup: true, view: "donate", step: "payment" },
				"",
			);
			setStep("payment");
		}
	};

	const handleCopy = async (text: string) => {
		// copyToClipboard uses the native Capacitor Clipboard on Android; an
		// un-awaited navigator.clipboard.writeText() is rejected in the WebView
		// ("Write permission denied") and surfaced as a Crashlytics non-fatal.
		const copied = await copyToClipboard(text);
		if (copied) {
			setCopiedText(text);
			setTimeout(() => setCopiedText(null), 2000);
		}
	};

	// Determine active context for payment details
	// If cart has mixed bank contexts, we might default to General or show warning.
	// For simplicity, if mixed, use General.
	const uniqueContexts = Array.from(
		new Set(
			cart.map((item) => {
				const seva = SEVA_OPTIONS.find((s) => s.id === item.sevaId);
				return seva?.bankContext || "general";
			}),
		),
	);

	// If current selection exists, consider its context too (though we added it to cart in proceed)
	// Actually, in 'payment' step, we rely on 'cart' state.
	// Wait, handleProceed adds to cart. So in render of payment step, cart is populated.

	const activeBankContext =
		uniqueContexts.length === 1 && uniqueContexts[0] === "gauseva"
			? "gauseva"
			: "general";
	const activeBank = BANK_DETAILS[activeBankContext];

	// Properly formatted for Google Pay (GPay)
	const amountParam = cartTotal > 0 ? `&am=${cartTotal.toFixed(2)}` : "";
	const upiDeepLink = `upi://pay?pa=${UPI_ID}${amountParam}`;
	const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiDeepLink)}&bgcolor=ffffff`;

	const handleDownloadQR = async () => {
		// Check for high amount warning
		if (cartTotal > 1999) {
			setShowHighAmountWarning(true);
			return;
		}
		proceedWithDownload();
	};

	const proceedWithDownload = async () => {
		handleClose_high_amount_warning();
		try {
			if (Capacitor.isNativePlatform()) {
				// Request permissions to ensure download works on all Android versions
				try {
					await Filesystem.requestPermissions();
				} catch (permError) {
					console.warn(
						"Filesystem permission request failed or skipped",
						permError,
					);
				}

				const fileName = `prem-bhakti-seva-qr-${cartTotal}-${Date.now()}.png`;
				const uriResult = await Filesystem.getUri({
					path: fileName,
					directory: Directory.Documents,
				});
				const result = await FileTransfer.downloadFile({
					path: uriResult.uri,
					url: qrCodeUrl,
				});
				if (result.path) {
					showToast(
						isHindi
							? "QR कोड दस्तावेज़ फ़ोल्डर में सहेजा गया"
							: "QR Code saved to Documents folder",
						"success",
					);
				}
			} else {
				const response = await fetch(qrCodeUrl);
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = `prem-bhakti-seva-qr-${cartTotal}.png`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				window.URL.revokeObjectURL(url);
			}
		} catch (e) {
			console.error("QR Download failed", e);
			// Fallback for strict CORS environments or failures
			window.open(qrCodeUrl, "_blank", "noopener,noreferrer");
		}
	};

	const generateMessage = () => {
		const itemsList = cart
			.map((item) => {
				const baseTitle = isHindi ? item.titleHi : item.titleEn;
				const finalTitle = item.customName
					? `${baseTitle} (${item.customName})`
					: baseTitle;
				return `• ${finalTitle}: ₹${item.amount}`;
			})
			.join("\n");

		const method = paymentMethod === "upi" ? "UPI/QR" : "Bank Transfer";

		return isHindi
			? `हरे कृष्णा! मैंने सेवा अर्पण की है।\n\n• नाम: ${donorName}\n\nसेवा विवरण:\n${itemsList}\n\n• कुल राशि: ₹${cartTotal}\n• माध्यम: ${method}\n• दिनांक: \n\nकृपया रसीद प्रदान करें। (स्क्रीनशॉट संलग्न है)`
			: `Hare Krishna! I have offered Seva.\n\n• Name: ${donorName}\n\nSeva Details:\n${itemsList}\n\n• Total Amount: ₹${cartTotal}\n• Method: ${method}\n• Date: \n\nPlease verify. (Screenshot attached)`;
	};

	const openWhatsApp = (number: string) => {
		const url = `https://wa.me/${number}?text=${encodeURIComponent(generateMessage())}`;
		window.open(url, "_blank", "noopener,noreferrer");
		handleClose_ContactModal();
	};

	const handleBack = () => {
		window.history.back();
	};

	// --- RENDER ---

	return (
		<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-bottom duration-300 font-sans">
			{/* Background Pattern */}
			<div
				className="absolute inset-0 opacity-10 pointer-events-none"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
				}}
			></div>

			{/* Header */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between shadow-lg z-10 rounded-b-3xl border-b-2 border-ry-gold/40">
				<div className="flex items-center gap-3">
					<button
						onClick={handleBack}
						className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>
					<div>
						<h2 className="font-display text-xl font-semibold leading-none drop-shadow-md">
							{isHindi ? "सेवा समर्पण" : "Offer Seva"}
						</h2>
					</div>
				</div>

				<button
					onClick={() => setLang((prev) => (prev === "hi" ? "en" : "hi"))}
					data-tour="donate-lang"
					className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors text-xs font-bold border border-white/30"
				>
					<Languages size={14} />
					{isHindi ? "English" : "हिंदी"}
				</button>
			</div>

			{/* Progress Bar */}
			<div className="flex justify-center -mt-3 z-20 px-4">
				<div
					className="bg-white dark:bg-slate-800 rounded-full shadow-md px-4 py-1.5 flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700"
					data-tour="donate-steps"
				>
					<span
						className={
							step === "selection"
								? "text-saffron-600 dark:text-saffron-400"
								: ""
						}
					>
						{isHindi ? "चुनें" : "Select"}
					</span>
					<ChevronRight size={12} />
					<span
						className={
							step === "payment" ? "text-saffron-600 dark:text-saffron-400" : ""
						}
					>
						{isHindi ? "भुगतान" : "Pay"}
					</span>
					<ChevronRight size={12} />
					<span
						className={
							step === "confirm" ? "text-saffron-600 dark:text-saffron-400" : ""
						}
					>
						{isHindi ? "पुष्टि" : "Confirm"}
					</span>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="flex-1 overflow-y-auto scroll-container relative z-0">
				{/* --- STEP 1: SELECTION --- */}
				{step === "selection" && (
					<div className="p-4 pb-32 max-w-3xl mx-auto space-y-6">
						{/* Hero Card */}
						<div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-saffron-100 dark:border-slate-700 text-center relative overflow-hidden">
							<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-saffron-500 to-transparent"></div>
							<div className="w-16 h-16 bg-gradient-to-br from-saffron-100 to-orange-100 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center mx-auto mb-4 text-saffron-600 dark:text-saffron-400 shadow-inner">
								<HandHeart size={32} />
							</div>
							<h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 font-hindi">
								यत्करोषि यदश्नासि यज्जुहोषि ददासि यत्। <br />
								यत्तपस्यसि कौन्तेय तत्कुरुष्व मदर्पणम्॥
							</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
								हे कुन्तीपुत्र! तुम जो कुछ करते हो, जो कुछ खाते हो, जो कुछ अर्पित करते हो या
								दान देते हो और जो भी तपस्या करते हो, उसे मुझे अर्पित करते हुए करो।
							</p>
						</div>

						{/* Seva Options Grid */}
						<div>
							<h4 className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
								<Star size={12} className="text-saffron-500 fill-current" />
								{isHindi ? "सेवा का चयन करें" : "Choose a Cause"}
							</h4>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{SEVA_OPTIONS.map((seva) => {
									const isSelected = selectedSevaId === seva.id;
									return (
										<div
											key={seva.id}
											onClick={() => handleSevaSelect(seva.id)}
											data-tour="donate-cause"
											className={`
                                        relative overflow-hidden rounded-2xl border-2 cursor-pointer transition-all duration-300 group
                                        ${
																					isSelected
																						? "border-saffron-500 bg-white dark:bg-slate-800 shadow-xl ring-2 ring-saffron-200 dark:ring-saffron-900 scale-[1.01]"
																						: `bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:shadow-md ${seva.borderColor}`
																				}
                                    `}
										>
											{/* Tag */}
											{(isHindi ? seva.tagHi : seva.tagEn) && (
												<div className="absolute top-0 right-0 bg-gradient-to-bl from-saffron-500 to-orange-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl shadow-sm z-10">
													{isHindi ? seva.tagHi : seva.tagEn}
												</div>
											)}

											<div className="p-5 flex items-start gap-4">
												<div
													className={`
                                            w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm
                                            ${isSelected ? "bg-saffron-500 text-white" : seva.color}
                                        `}
												>
													{seva.icon}
												</div>
												<div className="flex-1 pt-1">
													<h4
														className={`font-bold text-lg mb-1 leading-tight ${isSelected ? "text-saffron-700 dark:text-saffron-400" : "text-slate-800 dark:text-slate-200"}`}
													>
														{isHindi ? seva.titleHi : seva.titleEn}
													</h4>
													<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
														{isHindi ? seva.descHi : seva.descEn}
													</p>
												</div>
												{isSelected && (
													<div className="absolute bottom-4 right-4 text-saffron-500 animate-in zoom-in">
														<Check size={24} strokeWidth={3} />
													</div>
												)}
											</div>

											{/* Expanded Selection Area */}
											{isSelected && (
												<div className="px-5 pb-5 pt-2 border-t border-dashed border-saffron-200 dark:border-slate-700 bg-saffron-50/50 dark:bg-slate-900/30 animate-in slide-in-from-top-2">
													<p className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-3 mt-2">
														{seva?.id === "general"
															? isHindi
																? "सेवा राशि भरें"
																: "Enter Seva Amount"
															: isHindi
																? "सेवा राशि चुनें"
																: "Select Seva Amount"}
													</p>

													{/* RENDER FIXED LIST IF AVAILABLE */}
													{seva.fixedItems ? (
														<div className="grid grid-cols-1 gap-2 mb-2">
															{seva.fixedItems.map((item, idx) => (
																<button
																	key={idx}
																	onClick={(e) => {
																		e.stopPropagation();
																		handleFixedItemSelect(item);
																	}}
																	className={`
                                                                flex justify-between items-center p-3 rounded-lg border text-sm transition-all active:scale-[0.98]
                                                                ${
																																	amount ===
																																		item.amount &&
																																	customSevaName ===
																																		(isHindi
																																			? item.labelHi
																																			: item.labelEn)
																																		? "bg-saffron-500 text-white border-saffron-500 shadow-md"
																																		: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-saffron-300"
																																}
                                                            `}
																>
																	<span className="font-bold text-left">
																		{isHindi ? item.labelHi : item.labelEn}
																	</span>
																	<span className="font-mono opacity-90 ml-2 whitespace-nowrap">
																		₹{item.amount}
																	</span>
																</button>
															))}
														</div>
													) : (
														/* RENDER GENERIC AMOUNTS IF NO FIXED LIST */
														<div className="flex flex-wrap gap-2 mb-4">
															{seva.amounts?.map((amt) => (
																<button
																	key={amt}
																	onClick={(e) => {
																		e.stopPropagation();
																		handleAmountSelect(amt);
																	}}
																	className={`
                                                                px-4 py-2 rounded-lg text-sm font-bold border transition-all active:scale-95
                                                                ${
																																	amount === amt
																																		? "bg-saffron-500 text-white border-saffron-500 shadow-lg shadow-saffron-500/30"
																																		: "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-saffron-300 hover:text-saffron-600"
																																}
                                                            `}
																>
																	₹{amt}
																</button>
															))}
														</div>
													)}

													{/* CUSTOM AMOUNT INPUT (Always Visible) */}
													<div className="relative mt-2">
														<div className="absolute inset-0 flex items-center mb-6 pointer-events-none">
															<div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
														</div>
														<div className="relative flex justify-center mb-3">
															{seva?.id !== "general" && (
																<span className="bg-saffron-50/50 dark:bg-slate-900/30 px-2 text-[10px] text-slate-400 dark:text-ink-400 font-bold uppercase tracking-wider backdrop-blur-sm">
																	{isHindi ? "या अन्य राशि" : "Or Custom Amount"}
																</span>
															)}
														</div>
														<div className="relative">
															<span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ink-400 font-bold">
																₹
															</span>
															<input
																type="number"
																placeholder={
																	isHindi
																		? "अन्य राशि लिखें..."
																		: "Enter custom amount..."
																}
																className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-saffron-500 transition-all placeholder:font-normal shadow-sm"
																value={customAmountStr}
																onChange={handleCustomAmountChange}
																onClick={(e) => e.stopPropagation()}
															/>
														</div>
													</div>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				)}

				{/* --- STEP 2: PAYMENT --- */}
				{step === "payment" && (
					<div className="p-4 pb-24 max-w-md mx-auto space-y-6">
						{/* Summary Card */}
						<div className="bg-gradient-to-br from-white to-orange-50 dark:from-slate-800 dark:to-slate-900 p-6 rounded-3xl border border-orange-100 dark:border-slate-700 text-center shadow-sm relative overflow-hidden">
							<div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-saffron-400 to-orange-600"></div>
							<p className="text-xs font-bold text-slate-400 dark:text-ink-400 uppercase tracking-widest mb-1">
								{isHindi ? "कुल सहयोग राशि" : "Total Donation Amount"}
							</p>
							<div className="text-5xl font-bold text-slate-800 dark:text-white mb-3 font-mono tracking-tight">
								₹{cartTotal}
							</div>

							{/* Items List Summary */}
							<div className="flex flex-col gap-2 mt-4 max-h-40 overflow-y-auto">
								{cart.map((item) => (
									<div
										key={item.id}
										className="inline-flex items-center justify-between gap-2 bg-white dark:bg-slate-700 px-4 py-1.5 rounded-full text-xs font-bold text-saffron-700 dark:text-saffron-300 shadow-sm border border-saffron-100 dark:border-slate-600"
									>
										<div className="flex items-center gap-2 truncate">
											{/* Find icon for this item */}
											{SEVA_OPTIONS.find((s) => s.id === item.sevaId)?.icon}
											<span className="truncate max-w-[150px]">
												{item.customName
													? `${isHindi ? item.titleHi : item.titleEn} - ${item.customName}`
													: isHindi
														? item.titleHi
														: item.titleEn}
											</span>
										</div>
										<span>₹{item.amount}</span>
									</div>
								))}
							</div>
						</div>

						{/* Method Tabs */}
						<div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
							<button
								onClick={() => setPaymentMethod("upi")}
								className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${paymentMethod === "upi" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
							>
								<QrCode size={18} /> UPI / QR
							</button>
							<button
								onClick={() => setPaymentMethod("bank")}
								className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${paymentMethod === "bank" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
							>
								<Building2 size={18} /> {isHindi ? "बैंक खाता" : "Bank Transfer"}
							</button>
						</div>

						{/* Content Box */}
						<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm min-h-[300px] flex flex-col items-center justify-center relative">
							<div className="absolute top-2 right-3 flex gap-2">
								<ShieldCheck size={16} className="text-green-500" />
								<span className="text-[10px] text-green-600 font-bold uppercase tracking-wide">
									Secure
								</span>
							</div>

							{paymentMethod === "upi" ? (
								<>
									<div className="bg-white p-2 rounded-xl border-2 border-slate-100 shadow-sm mb-4">
										<img
											src={qrCodeUrl}
											alt="UPI QR"
											className="w-48 h-48 object-contain"
										/>
									</div>
									<p className="text-xs text-slate-400 dark:text-ink-400 font-medium mb-4 text-center">
										{isHindi
											? "किसी भी UPI ऐप से स्कैन करें"
											: "Scan with any UPI App"}
									</p>

									<button
										onClick={handleDownloadQR}
										className="w-full bg-[#5f259f] hover:bg-[#4e1e82] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 mb-2"
									>
										<Download size={20} />
										<span>
											{isHindi ? "QR कोड डाउनलोड करें" : "Download QR Code"}
										</span>
									</button>
									<p className="text-[11px] text-[#5f259f] dark:text-[#a874e6] font-bold mb-5 text-center bg-[#5f259f]/10 py-1.5 px-3 rounded-full">
										⚠️{" "}
										{isHindi
											? "यह QR केवल PhonePe ऐप में काम करेगा"
											: "This QR will only work in PhonePe app"}
									</p>

									<div
										onClick={() => handleCopy(UPI_ID)}
										className="flex flex-col items-center justify-center gap-1 w-full bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95 mb-2"
									>
										<p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
											{isHindi ? "UPI आईडी कॉपी करें" : "Copy UPI ID"}
										</p>
										<div className="flex items-center gap-3">
											<span className="text-xl font-mono font-bold text-slate-800 dark:text-slate-100 tracking-wide">
												{UPI_ID}
											</span>
											{copiedText === UPI_ID ? (
												<Check
													size={24}
													strokeWidth={3}
													className="text-green-500"
												/>
											) : (
												<Copy size={20} className="text-blue-500" />
											)}
										</div>
									</div>
								</>
							) : (
								<div className="w-full space-y-5">
									<div className="space-y-1.5">
										<p className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase">
											Beneficiary Name
										</p>
										<div className="flex justify-between items-start bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
											<p className="font-bold text-slate-800 dark:text-white text-sm leading-snug">
												{activeBank.name}
											</p>
											<button
												onClick={() => handleCopy(activeBank.name)}
												className="p-1 text-slate-400 dark:text-ink-400 hover:text-blue-500"
											>
												<Copy size={16} />
											</button>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
											<p className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1">
												Bank
											</p>
											<p className="text-sm font-bold text-slate-700 dark:text-slate-300">
												{activeBank.bank}
											</p>
										</div>
										<div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
											<p className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1">
												Branch
											</p>
											<p className="text-sm font-bold text-slate-700 dark:text-slate-300">
												{activeBank.branch}
											</p>
										</div>
									</div>

									<div className="space-y-3">
										<div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
											<div>
												<p className="text-[10px] font-bold text-blue-400 uppercase">
													Account No.
												</p>
												<p className="font-mono font-bold text-lg text-blue-900 dark:text-blue-100 tracking-wide">
													{activeBank.acc}
												</p>
											</div>
											<button
												onClick={() => handleCopy(activeBank.acc)}
												className="p-2 bg-white dark:bg-blue-800 rounded-lg text-blue-500 hover:text-blue-700 shadow-sm"
											>
												<Copy size={16} />
											</button>
										</div>

										<div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
											<div>
												<p className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase">
													IFSC Code
												</p>
												<p className="font-mono font-bold text-slate-700 dark:text-slate-200">
													{activeBank.ifsc}
												</p>
											</div>
											<button
												onClick={() => handleCopy(activeBank.ifsc)}
												className="p-2 text-slate-400 dark:text-ink-400 hover:text-blue-500"
											>
												<Copy size={16} />
											</button>
										</div>
									</div>
								</div>
							)}
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => {
									window.history.pushState(
										{ isPopup: true, view: "donate", step: "confirm" },
										"",
									);
									setStep("confirm");
								}}
								className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 transition-all active:scale-95 animate-pulse"
							>
								{isHindi ? "भुगतान कर दिया? आगे बढ़ें" : "I have Paid, Proceed"}
								<ChevronRight size={20} />
							</button>
						</div>
					</div>
				)}

				{/* --- STEP 3: CONFIRMATION --- */}
				{step === "confirm" && !canSendConfirmation && (
					<div className="p-4 pb-24 max-w-md mx-auto space-y-6">
						<div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-start gap-4 shadow-sm">
							<div className="bg-amber-100 dark:bg-amber-800 rounded-full p-2 text-amber-700 dark:text-amber-300 shrink-0">
								<ShieldCheck size={24} />
							</div>
							<div className="space-y-2">
								<p className="text-sm font-bold text-amber-900 dark:text-amber-100">
									{isHindi
										? "सेवा अर्पण के लिए धन्यवाद! 🙏"
										: "Thank you for your Seva! 🙏"}
								</p>
								<p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
									{isHindi
										? "अगर आपको भुगतान की पुष्टि (रसीद) चाहिए, तो ऐप में लॉगिन करें और अपनी प्रोफाइल मंज़ूर करवाएं। प्रोफाइल मंज़ूर होने के बाद आप यहीं से पुष्टि भेज सकेंगे।"
										: "If you need a confirmation (receipt) of your payment, please sign in to the app and get your profile approved. Once your profile is approved, you can send the confirmation from here."}
								</p>
							</div>
						</div>

						{!user && (
							<button
								onClick={() => signInWithGoogle()}
								className="w-full bg-gradient-to-r from-saffron-500 to-orange-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-saffron-500/30 transition-all active:scale-95"
							>
								<User size={20} />
								{isHindi ? "लॉगिन करें" : "Sign In"}
							</button>
						)}
					</div>
				)}

				{step === "confirm" && canSendConfirmation && (
					<div className="p-4 pb-24 max-w-md mx-auto space-y-6">
						<div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-start gap-4 shadow-sm">
							<div className="bg-blue-100 dark:bg-blue-800 rounded-full p-2 text-blue-600 dark:text-blue-300 shrink-0">
								<Info size={24} />
							</div>
							<p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
								{isHindi
									? "कृपया नीचे अपना विवरण भरें। यह जानकारी व्हाट्सएप के माध्यम से ट्रस्ट को भेजी जाएगी ताकि आपकी रसीद बनाई जा सके।"
									: "Please fill in your details below. This information will be sent to the Trust via WhatsApp to generate your receipt."}
							</p>
						</div>

						<div className="space-y-5 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-2 ml-1 flex items-center gap-1">
									<User size={12} />
									{isHindi ? "आपका नाम" : "Your Name"}
								</label>
								<input
									type="text"
									value={donorName}
									onChange={(e) => setDonorName(e.target.value)}
									className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-saffron-500 font-bold transition-all"
									placeholder={
										isHindi ? "अपना नाम लिखें" : "Enter your full name"
									}
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-2 ml-1">
									{isHindi ? "भुगतान दिनांक" : "Payment Date"}
								</label>
								<CustomDateInput
									value={txnDate}
									onChange={setTxnDate}
									isHindi={isHindi}
								/>
							</div>
						</div>

						<button
							onClick={() => setShowContactModal(true)}
							disabled={!donorName.trim()}
							className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
						>
							<MessageCircle size={22} className="fill-white" />
							{isHindi ? "व्हाट्सएप पर भेजें" : "Send via WhatsApp"}
						</button>
					</div>
				)}
			</div>

			{/* Floating Action Button (Only in Selection Step) */}
			{step === "selection" && (
				<div className="absolute bottom-6 left-0 right-0 p-4 z-20 flex flex-col gap-3 animate-in slide-in-from-bottom-4 items-center">
					{/* Cart Summary if items exist */}
					{cart.length > 0 && (
						<div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-2">
							<div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
								<span className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider">
									{isHindi ? "सेवा कार्ट" : "Seva Cart"} ({cart.length})
								</span>
								<span className="text-sm font-bold text-slate-800 dark:text-slate-200">
									₹{cartTotal}
								</span>
							</div>
							<div className="max-h-32 overflow-y-auto p-2 space-y-2">
								{cart.map((item) => (
									<div
										key={item.id}
										className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg text-sm"
									>
										<div className="flex-1 min-w-0 mr-2">
											<p className="font-medium text-slate-700 dark:text-slate-300 truncate">
												{isHindi ? item.titleHi : item.titleEn}
											</p>
											{item.customName && (
												<p className="text-xs text-slate-500 dark:text-ink-300 truncate">
													{item.customName}
												</p>
											)}
										</div>
										<div className="flex items-center gap-3">
											<span className="font-mono font-bold text-slate-600 dark:text-slate-400">
												₹{item.amount}
											</span>
											<button
												onClick={() => handleRemoveFromCart(item.id)}
												className="text-red-400 hover:text-red-600 p-1"
											>
												<X size={14} />
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					<div className="flex gap-3 w-full max-w-sm">
						{/* Add to Cart Button - Only visible if amount is selected */}
						{amount !== "" && (
							<button
								onClick={handleAddToCart}
								className="flex-1 bg-white dark:bg-slate-800 text-saffron-600 dark:text-saffron-400 border-2 border-saffron-500 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95"
							>
								<span className="text-xl">+</span>
								<span>{isHindi ? "जोड़ें" : "Add"}</span>
							</button>
						)}

						{/* Proceed Button */}
						{(cart.length > 0 || amount !== "") && (
							<button
								onClick={handleProceed}
								className="flex-[2] bg-gradient-to-r from-saffron-500 to-orange-600 text-white py-3 rounded-xl font-bold shadow-xl shadow-saffron-500/40 flex items-center justify-between px-6 transition-transform hover:scale-105 active:scale-95"
							>
								<span className="flex flex-col items-start">
									<span className="text-[10px] opacity-90 uppercase tracking-wider font-semibold">
										{isHindi ? "कुल राशि" : "Total"}
									</span>
									<span className="text-xl leading-none">₹{grandTotal}</span>
								</span>
								<div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
									<ChevronRight size={20} />
								</div>
							</button>
						)}
					</div>
				</div>
			)}

			{/* High Amount Warning Modal */}
			{showHighAmountWarning && (
				<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 transform scale-100 transition-all animate-in zoom-in-95 duration-200">
						<div className="flex justify-center mb-4 text-amber-500">
							<Info size={48} />
						</div>
						<h3 className="font-bold text-lg text-center text-slate-800 dark:text-white mb-2">
							{isHindi ? "महत्वपूर्ण सूचना" : "Important Notice"}
						</h3>
						<p className="text-sm text-center text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
							{isHindi
								? "₹2000 से अधिक राशि के लिए, गैलरी से QR कोड स्कैन करना विफल हो सकता है (UPI सीमा के कारण)।"
								: "For amounts above ₹2000, scanning QR from gallery might fail due to UPI limits."}
						</p>

						<div className="space-y-3">
							<button
								onClick={() => {
									handleCopy(UPI_ID);
									handleClose_high_amount_warning();
								}}
								className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
							>
								<Copy size={18} />
								{isHindi ? "UPI ID कॉपी करें" : "Copy UPI ID Instead"}
							</button>

							<button
								onClick={proceedWithDownload}
								className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold transition-colors"
							>
								{isHindi ? "फिर भी डाउनलोड करें" : "Download Anyway"}
							</button>

							<button
								onClick={() => handleClose_high_amount_warning()}
								className="w-full text-slate-400 dark:text-ink-400 text-xs font-medium hover:text-slate-600 py-2"
							>
								{isHindi ? "रद्द करें" : "Cancel"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* WhatsApp Contact Selection Modal */}
			{showContactModal && canSendConfirmation && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-2xl shadow-2xl p-6 transform scale-100 transition-all animate-in zoom-in-95 duration-200">
						<div className="flex justify-between items-center mb-4">
							<h3 className="font-bold text-lg text-slate-800 dark:text-white">
								{isHindi ? "किसको भेजें?" : "Select Contact"}
							</h3>
							<button
								onClick={() => handleClose_ContactModal()}
								className="p-1 text-slate-400 dark:text-ink-400"
							>
								<X size={20} />
							</button>
						</div>

						<div className="space-y-3">
							<button
								onClick={() => openWhatsApp(CONTACTS.NAMAN)}
								className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
							>
								<div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
									<MessageCircle size={20} />
								</div>
								<div className="text-left">
									<div className="font-bold text-slate-800 dark:text-white">
										{isHindi
											? "नारायण दास (नमन प्रभुजी)"
											: "Narayan Das (Naman Prabhuji)"}
									</div>
									<div className="text-xs text-slate-500 dark:text-ink-300 font-mono">
										{CONTACTS.NAMAN.replace(/^91/, "+91 ")}
									</div>
								</div>
							</button>

							<button
								onClick={() => openWhatsApp(CONTACTS.LUCKY)}
								className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
							>
								<div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
									<MessageCircle size={20} />
								</div>
								<div className="text-left">
									<div className="font-bold text-slate-800 dark:text-white">
										{isHindi
											? "ललित कृष्णा दास (लकी प्रभुजी)"
											: "Lalit Krishna Das (Lucky Prabhuji)"}
									</div>
									<div className="text-xs text-slate-500 dark:text-ink-300 font-mono">
										{CONTACTS.LUCKY.replace(/^91/, "+91 ")}
									</div>
								</div>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

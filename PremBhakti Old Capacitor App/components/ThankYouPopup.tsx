import { Heart } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ThankYouPopupProps {
	isOpen: boolean;
	onClose: () => void;
	settingsLanguage: "en" | "hi";
}

const AUTO_CLOSE_MS = 2500;

export const ThankYouPopup: React.FC<ThankYouPopupProps> = ({
	isOpen,
	onClose,
	settingsLanguage,
}) => {
	const isHindi = settingsLanguage === "hi";

	useEffect(() => {
		if (!isOpen) return;
		const timer = setTimeout(onClose, AUTO_CLOSE_MS);
		return () => clearTimeout(timer);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const t = {
		title: isHindi ? "राधेश्याम 🙏" : "Radheshyam 🙏",
		message: isHindi
			? "आपकी महिमा गुरु महाराज जी के चरणों में सादर अर्पित की गई। आपकी भक्ति के लिए धन्यवाद।"
			: "Your glorification has been offered at Guru Maharaj Ji's feet. Thank you for your devotion.",
	};

	return createPortal(
		<div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="w-full max-w-xs rounded-3xl border border-ry-gold/30 bg-ry-cream dark:bg-slate-800 p-7 text-center shadow-2xl animate-in zoom-in-95">
				<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ry-maroon shadow-md">
					<Heart size={26} className="text-ry-cream" fill="currentColor" />
				</div>
				<h3 className="font-serif text-lg font-bold text-ry-maroon dark:text-ry-gold">
					{t.title}
				</h3>
				<p className="mt-2 text-sm leading-relaxed text-ry-brown dark:text-slate-300">
					{t.message}
				</p>
			</div>
		</div>,
		document.body,
	);
};

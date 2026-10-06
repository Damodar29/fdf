import {
	ArrowLeft,
	FileText,
	HeartHandshake,
	Languages,
	Scale,
	ScrollText,
	ShieldAlert,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

interface TermsOfServiceScreenProps {
	onBack: () => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage?: "en" | "hi";
}

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({
	onBack,
	scrollBarSide = "left",
	settingsLanguage = "hi",
}) => {
	const [lang, setLang] = useState<"en" | "hi">(settingsLanguage);

	const t = {
		title: lang === "hi" ? "सेवा की शर्तें" : "Terms of Service",
		intro:
			lang === "hi"
				? "Prem Bhakti भजन ऐप का उपयोग करने के लिए धन्यवाद। ऐप का उपयोग करके, आप निम्नलिखित शर्तों से सहमत होते हैं।"
				: "Thank you for using the Prem Bhakti Bhajan App. By using the app, you agree to the following terms and conditions.",

		sections: [
			{
				icon: <ScrollText size={20} className="text-blue-500" />,
				title: lang === "hi" ? "ऐप का उद्देश्य (App Purpose)" : "App Purpose",
				content:
					lang === "hi"
						? "यह ऐप विशुद्ध रूप से आध्यात्मिक और भक्ति उद्देश्यों के लिए बनाया गया है। इसमें भजन, कीर्तन, आध्यात्मिक पुस्तकें और श्री चैतन्य प्रेम भक्ति संघ (CPBS) से संबंधित जानकारी शामिल है।"
						: "This app is created purely for spiritual and devotional purposes. It contains bhajans, kirtans, spiritual books, and information related to Shree Chaitanya Prem Bhakti Sangh (CPBS).",
			},
			{
				icon: <Scale size={20} className="text-green-500" />,
				title: lang === "hi" ? "उपयोग की शर्तें (Usage Terms)" : "Usage Terms",
				content:
					lang === "hi"
						? "• आप ऐप में उपलब्ध सामग्री (ऑडियो, पीडीएफ, चित्र) का उपयोग व्यक्तिगत और आध्यात्मिक लाभ के लिए कर सकते हैं।\n• किसी भी सामग्री का व्यावसायिक (Commercial) उपयोग सख्त वर्जित है।"
						: "• You may use the content (audio, PDF, images) available in the app for personal and spiritual benefit.\n• Commercial use of any content is strictly prohibited.",
			},
			{
				icon: <HeartHandshake size={20} className="text-ry-gold" />,
				title:
					lang === "hi"
						? "उपयोगकर्ता खाता और डेटा (User Account & Data)"
						: "User Account & Data",
				content:
					lang === "hi"
						? "जब आप Google के माध्यम से लॉगिन करते हैं, तो हम आपकी बुनियादी प्रोफ़ाइल (नाम, ईमेल) और ऐप गतिविधि (लाइक) एकत्र करते हैं। खाता डिलीट करने का अनुरोध करने पर, सुरक्षा कारणों से डेटा 30 दिनों तक सुरक्षित रखा जाता है। ऐप में किसी भी प्रकार की अभद्र भाषा या अनुचित सामग्री पोस्ट करने पर एडमिनिस्ट्रेटर को आपका खाता बिना किसी पूर्व सूचना के निलंबित (Suspend) या हटाने का अधिकार है।"
						: "When you log in via Google, we collect your basic profile (Name, Email) and app activity (Likes). Upon account deletion request, data is retained for 30 days for security purposes. The administrators reserve the right to suspend or delete any account without prior notice in case of inappropriate behavior, abusive language, or spam in the community features.",
			},
			{
				icon: <ShieldAlert size={20} className="text-purple-500" />,
				title:
					lang === "hi"
						? "दायित्व की सीमा (Limitation of Liability)"
						: "Limitation of Liability",
				content:
					lang === "hi"
						? "हम ऐप को त्रुटि-मुक्त और निरंतर उपलब्ध रखने का प्रयास करते हैं, लेकिन हम किसी भी तकनीकी समस्या, डेटा हानि, या सेवा में रुकावट के लिए जिम्मेदार नहीं होंगे।"
						: "We strive to keep the app error-free and continuously available, but we will not be held liable for any technical issues, data loss, or service interruptions.",
			},
		],
		contact: lang === "hi" ? "संपर्क करें" : "Contact Us",
		contactDesc:
			lang === "hi"
				? "यदि आपके पास इन शर्तों के बारे में कोई प्रश्न हैं, तो आप हमसे संपर्क कर सकते हैं।"
				: "If you have any questions regarding these terms, you can contact us.",
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
						<FileText className="w-6 h-6 text-ry-gold" />
						{t.title}
					</h2>
				</div>

				<button
					onClick={() => setLang((prev) => (prev === "hi" ? "en" : "hi"))}
					className="flex items-center gap-1.5 bg-ry-sand dark:bg-slate-800 border border-ry-gold/40 dark:border-slate-700 hover:bg-ry-cream dark:hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors text-sm font-medium text-ry-maroon dark:text-ry-gold"
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
									<h3 className="font-bold text-slate-800 dark:text-white">
										{section.title}
									</h3>
								</div>
								<p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line ml-11">
									{section.content}
								</p>
							</div>
						))}
					</div>

					<div className="mt-8 text-center p-6 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
						<h4 className="font-bold text-slate-800 dark:text-white mb-2">
							{t.contact}
						</h4>
						<p className="text-sm text-slate-500 dark:text-slate-400">
							{t.contactDesc}
							<br />
							<a
								href="mailto:contact@chaitanyaprembhakti.org"
								className="text-blue-500 font-medium hover:underline mt-1 inline-block"
							>
								contact@chaitanyaprembhakti.org
							</a>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

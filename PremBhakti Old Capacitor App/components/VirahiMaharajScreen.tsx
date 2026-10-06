import DOMPurify from "dompurify";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { db } from "../services/firebase";

interface VirahiMaharajScreenProps {
	onBack: () => void;
}

export const VirahiMaharajScreen: React.FC<VirahiMaharajScreenProps> = ({
	onBack,
}) => {
	const [content, setContent] = useState<string>("");
	const [loading, setLoading] = useState(true);

	const CACHE_KEY = "virahi_maharaj_cache";

	useEffect(() => {
		// 1. Initial Load from Cache (shows immediately)
		const cachedData = localStorage.getItem(CACHE_KEY);
		if (cachedData) {
			setContent(cachedData);
			setLoading(false);
		}

		const fetchContent = async () => {
			if (!navigator.onLine) {
				setLoading(false);
				return; // Skip fetching if offline
			}
			try {
				const docRef = doc(db, "app_config", "virahi_maharaj");
				const docSnap = await getDoc(docRef);
				if (docSnap.exists() && docSnap.data().content) {
					const freshContent = docSnap.data().content;
					setContent(freshContent);
					localStorage.setItem(CACHE_KEY, freshContent);
				}
			} catch (error) {
				console.error("Error fetching Virahi Maharaj content:", error);
			} finally {
				setLoading(false);
			}
		};
		fetchContent();
	}, []);

	return (
		<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto font-sans">
			{/* Background Pattern */}
			<div
				className="absolute inset-0 opacity-10 pointer-events-none"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
				}}
			></div>

			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-3 z-10 sticky top-0 shadow-lg rounded-b-3xl">
				<button
					onClick={onBack}
					className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
				>
					<ArrowLeft className="w-6 h-6" />
				</button>
				<h2 className="font-display text-xl font-semibold tracking-wide leading-none drop-shadow-md">
					Virahi Maharaj Ji
				</h2>
			</div>

			<div className="p-4 space-y-6 max-w-3xl mx-auto w-full pb-20 relative z-0">
				{/* Hero Image */}
				<div className="aspect-video w-full bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-700">
					<img
						src="/444.webp"
						alt="Virahi Maharaj Ji Main"
						className="w-full h-full object-cover"
					/>
				</div>

				{/* Biography Section */}
				<div className="text-slate-700 dark:text-slate-300">
					{loading ? (
						<div className="flex justify-center items-center py-12">
							<Loader2 className="w-8 h-8 animate-spin text-ry-gold" />
						</div>
					) : content ? (
						<div
							className="prose dark:prose-invert prose-slate max-w-none space-y-4"
							dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
						/>
					) : (
						<div className="space-y-4">
							<h3>🪔 दिव्य प्राकट्य एवं प्रारंभिक जीवन</h3>
							प्रातः स्मरणीय परम पूज्य श्री विरही जी महाराज का पावन प्राकट्य अफगानिस्तान
							की पवित्र भूमि में उस समय हुआ, जब भारतवर्ष में अंग्रेजों का शासन काल था तथा देश
							का विभाजन भी नहीं हुआ था। प्रारंभ से ही उनका जीवन सरलता, सात्विकता एवं
							आध्यात्मिक प्रवृत्ति से ओतप्रोत था। कालांतर में वे भारत पधारे और देहरादून में अपनी
							आजीविका के लिए निवास करने लगे। सांसारिक जीवन का निर्वहन करते हुए वे
							प्रतिष्ठित कंपनी "सर्वे ऑफ इंडिया" में कार्यरत रहे तथा उनका विवाह भी संपन्न
							हुआ।
							<h3>👨‍👩‍👦 पारिवारिक जीवन</h3>
							परम भाग्यवती धर्मपत्नी से उन्हें रामदास एवं श्यामदास नामक दो सुपुत्रों की
							प्राप्ति हुई। पारिवारिक उत्तरदायित्वों का निर्वहन करते हुए भी उनका मन सदैव
							भगवद्-भक्ति एवं संत-संग की ओर उन्मुख रहा।
							<h3>🌿 आध्यात्मिक प्रेरणा एवं संस्थापन</h3>
							तत्पश्चात श्री चैतन्य गौड़ीय मठ के प्रतिष्ठाता परम गुरुदेव श्रीमद् भक्तिदयित माधव
							गोस्वामी महाराज जी से उनका साक्षात्कार हुआ। उनकी दिव्य शिक्षाओं से प्रेरित
							होकर श्री विरही जी महाराज ने “श्री चैतन्य प्रेम भक्ति संघ” की स्थापना की।
							उन्होंने अजमेर को अपना प्रमुख प्रचार-केन्द्र बनाया तथा परिवार सहित वहीं निवास
							करते हुए भक्ति प्रचार-प्रसार के कार्य में संलग्न हो गए।
							<h3>🌺 प्रचार-प्रसार एवं सेवा कार्य</h3>
							श्री चैतन्य महाप्रभु की शिक्षाओं का प्रचार-प्रसार मुख्यतः मध्यप्रदेश एवं राजस्थान
							के विभिन्न क्षेत्रों में किया गया। उनके अथक प्रयासों से अनेक स्थानों पर भक्ति की
							धारा प्रवाहित हुई। उन्होंने कोटा, दमोह, सागर आदि स्थानों पर मठ-मंदिरों की
							स्थापना कर धर्म एवं संस्कृति के संरक्षण में महत्वपूर्ण योगदान दिया। एक प्रभावशाली
							प्रचारक के रूप में उन्होंने असंख्य श्रद्धालुओं को दीक्षित कर उन्हें भक्ति मार्ग पर
							अग्रसर किया।
							<h3>📖 साहित्यिक योगदान</h3>
							उनके द्वारा रचित “श्री गौरांग भजन माला” के भजन आज भी भक्तगणों द्वारा अत्यंत
							श्रद्धा एवं भावपूर्वक गाए जाते हैं, जो साधकों के हृदय में भक्ति भाव का संचार करते
							हैं।
							<h3>गोलोकधाम प्रस्थान</h3>
							अपने जीवन की अंतिम लीला उन्होंने श्री गुरुधाम सागर में संपन्न की, जहाँ आज भी
							उनका पावन समाधि स्थल विद्यमान है। उनके आदर्श, उपदेश एवं भक्ति भाव आज भी
							असंख्य भक्तों के लिए प्रेरणास्रोत बने हुए हैं।
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

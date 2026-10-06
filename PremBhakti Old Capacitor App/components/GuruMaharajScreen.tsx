import DOMPurify from "dompurify";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { db } from "../services/firebase";

interface GuruMaharajScreenProps {
	onBack: () => void;
}

export const GuruMaharajScreen: React.FC<GuruMaharajScreenProps> = ({
	onBack,
}) => {
	const [content, setContent] = useState<string>("");
	const [loading, setLoading] = useState(true);

	const CACHE_KEY = "guru_maharaj_cache";

	useEffect(() => {
		// 1. Initial Load from Cache
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
				const docRef = doc(db, "app_config", "guru_maharaj");
				const docSnap = await getDoc(docRef);
				if (docSnap.exists() && docSnap.data().content) {
					const freshContent = docSnap.data().content;
					setContent(freshContent);
					localStorage.setItem(CACHE_KEY, freshContent);
				}
			} catch (error) {
				console.error("Error fetching Guru Maharaj content:", error);
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
					Guru Maharaj Ji
				</h2>
			</div>

			<div className="p-4 space-y-6 max-w-3xl mx-auto w-full pb-20 relative z-0">
				{/* Hero Image */}
				<div className="aspect-video w-full bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-700">
					<img
						src="/222.webp"
						alt="Guru Maharaj Ji Main"
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
							<h3 className="text-lg font-semibold text-ry-gold dark:text-ry-gold mt-6 mb-2">
								🪔 दिव्य प्राकट्य एवं बाल्यकाल
							</h3>
							<p>
								नित्य स्मरणीय, अनंत करुणामय गुरु महाराज जी का पावन प्राकट्य वर्ष 1932 में
								देवभूमि उत्तराखंड के चमोली ज़िले के ग्राम सीमली (सीतल) में हुआ। बचपन से ही
								उनके व्यक्तित्व में विलक्षण आध्यात्मिक तेज झलकता था। सांसारिक विषयों में उनकी
								विशेष रुचि नहीं थी; उनका चित्त सदैव भगवद्-भक्ति, नाम-स्मरण एवं संत-संग की
								ओर आकर्षित रहता था।
							</p>

							<h3 className="text-lg font-semibold text-ry-gold dark:text-ry-gold mt-6 mb-2">
								🌿 वैराग्य एवं दीक्षा
							</h3>

							<p>
								केवल 14 वर्ष की अल्पायु में ही उन्होंने अपने जीवन के परम लक्ष्य को पहचान
								लिया। भगवान प्राप्ति की तीव्र लालसा ने उन्हें गृहत्याग के लिए प्रेरित किया।
								परिवार एवं सांसारिक मोह-माया का त्याग कर वे पूर्णतः भक्ति मार्ग में प्रवृत्त
								हो गए।
							</p>

							<p>
								उन्होंने श्री चैतन्य महाप्रभु की दिव्य शिक्षाओं को आत्मसात किया एवं श्री चैतन्य
								गौड़ीय मठ में रहकर समर्पित भाव से सेवा कार्य किया।
							</p>

							<p>
								परम गुरुदेव श्रीमद् भक्तिदयित माधव गोस्वामी महाराज से उन्होंने विधिवत् वैष्णव
								दीक्षा ग्रहण की। उनकी आज्ञा अनुसार अपने वरिष्ठ गुरुभाई श्री वासुदेव शरण
								विरही जी महाराज के सान्निध्य में रहकर उनकी गुरुवत सेवा करते हुए
								प्रचार-प्रसार का दायित्व संभाला।
							</p>

							<h3 className="text-lg font-semibold text-ry-gold dark:text-ry-gold mt-6 mb-2">
								🌺 प्रचार-प्रसार एवं आध्यात्मिक सेवा
							</h3>

							<p>
								गुरु महाराज जी एक अत्यंत प्रभावशाली, ओजस्वी एवं कुशल प्रचारक थे। उन्होंने अनेक
								नगरों एवं प्रदेशों में भक्ति आंदोलन को नई ऊर्जा प्रदान की। उनके प्रयासों से
								विभिन्न स्थानों पर भव्य धार्मिक उत्सव प्रारंभ हुए, जो आज भी अत्यंत श्रद्धा एवं
								उत्साह के साथ मनाए जाते हैं:
							</p>

							<ul className="list-disc pl-5 space-y-1">
								<li>भरतपुर – श्री नरसिंह चतुर्दशी महोत्सव</li>
								<li>भोपाल – श्री जगन्नाथ रथ यात्रा</li>
								<li>सागर – श्री राधाष्टमी एवं गुरु पूर्णिमा उत्सव</li>
								<li>दमोह – श्री शरद पूर्णिमा महोत्सव</li>
								<li>कोटा – श्री कृष्ण जन्माष्टमी एवं श्री गौर पूर्णिमा उत्सव</li>
							</ul>

							<p>
								उन्होंने गौसेवा को विशेष महत्व देते हुए गौशाला की स्थापना की। साथ ही अनेक
								स्थानों पर श्रीमद्भागवत सप्ताह का आयोजन कर हजारों श्रद्धालुओं के जीवन में
								आध्यात्मिक चेतना का संचार किया।
							</p>

							<h3 className="text-lg font-semibold text-ry-gold dark:text-ry-gold mt-6 mb-2">
								🌼 शिष्य परंपरा एवं प्रभाव
							</h3>

							<p>
								गुरु महाराज जी से दीक्षित असंख्य भक्त आज भी उनके उपदेशों का पालन करते हुए
								भजन-साधना, नाम-संकीर्तन तथा धर्म-प्रचार में संलग्न हैं। उनका जीवन त्याग,
								सेवा, करुणा एवं निष्काम भक्ति का जीवंत उदाहरण है। उनके व्यक्तित्व का प्रभाव
								आज भी शिष्यों एवं भक्तों के हृदय में प्रेरणा के रूप में विद्यमान है।
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

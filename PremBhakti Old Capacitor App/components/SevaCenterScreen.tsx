import { collection, getDocs } from "firebase/firestore";
import {
	ArrowLeft,
	BookOpen,
	Building2,
	Clock,
	Heart,
	HeartHandshake,
	Languages,
	MapPin,
	MessageCircle,
	Navigation,
	Phone,
	Sparkles,
	Utensils,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useSharedFirebase } from "../context/SharedFirebaseContext";
import { db } from "../services/firebase";
import type { TempleTiming } from "../src/types/mandal";

interface SevaCenterScreenProps {
	onBack: () => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage?: "en" | "hi";
	onOpenDonate?: () => void;
	onOpenTempleTimings?: (mandalId?: string) => void;
}

interface CenterData {
	id: string;
	nameHi: string;
	nameEn: string;
	addressHi: string;
	addressEn: string;
	phone: string;
	locationUrl?: string;
	isWhatsappLocation?: boolean;
	locationPhone?: string;
}

const CENTERS: CenterData[] = [
	{
		id: "kota",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति धाम",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Dham",
		addressHi: "OCF 5, गणेश नगर, कोटा, राजस्थान",
		addressEn: "OCF 5, Ganesh Nagar, Kota, Rajasthan",
		phone: "9636943046, 9828235583",
		locationUrl: "https://maps.app.goo.gl/qFPr5dTKrK8MrGg6A",
	},
	{
		id: "vrindavan",
		nameHi: "श्री चैतन्य प्रेम भक्ति संघ आश्रम",
		nameEn: "Shree Chaitanya Prem Bhakti Sangh Ashram",
		addressHi: "गोपाल खार, परिक्रमा मार्ग, वृंदावन",
		addressEn: "Gopal Khar, Parikrama Marg, Vrindavan",
		phone: "9039484855, 9887880429",
		locationUrl: "https://maps.app.goo.gl/ikVk7U5WXGWc3Qxb9",
	},
	{
		id: "sagar",
		nameHi: "श्री गुरुधाम",
		nameEn: "Shri Gurudham",
		addressHi: "भूतेश्वर पथ, सागर, मध्य प्रदेश",
		addressEn: "Bhuteshwar Path, Sagar, M.P.",
		phone: "8839123276",
		locationUrl: "https://maps.app.goo.gl/gaPkLkDFvxoLvGRA6",
	},
	{
		id: "damoh",
		nameHi: "श्री गौर राधा रमण मंदिर",
		nameEn: "Shri Gaur Radha Raman Mandir",
		addressHi: "उमा मिस्त्री की तलैया, दमोह, मध्य प्रदेश",
		addressEn: "Uma Mistri Ki Talaiya, Damoh, M.P.",
		phone: "9407542046, 8770665363",
		locationUrl: "https://maps.app.goo.gl/bBHqbcv8zYz1TBpy8",
	},
	{
		id: "harrai",
		nameHi: "श्री श्री गौर राधा गोपीनाथ जू मंदिर",
		nameEn: "Shri Shri Gaur Radha Gopinath Ju Mandir",
		addressHi: "बटका रोड, हर्रई, छिंदवाड़ा, मध्य प्रदेश",
		addressEn: "Batka Road, Harrai, Chhindwara, M.P.",
		phone: "9424324565, 6260583949",
		locationUrl: "https://maps.app.goo.gl/NpX8xg8m5M7UbwMfA",
	},
	{
		id: "khurai",
		nameHi: "श्री श्री राधा कृष्ण सदन",
		nameEn: "Shri Shri Radha Krishna Sadan",
		addressHi: "शास्त्री वार्ड, खुरई, मध्य प्रदेश",
		addressEn: "Shastri Ward, Khurai, M.P.",
		phone: "9926927164",
		locationUrl: "https://maps.app.goo.gl/CtPXT5BrRcjGMawE6",
	},
	{
		id: "bhopal",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति संकीर्तन मंडल",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Sankirtan Mandal",
		addressHi: "गौर कृष्ण कुंज, कंफर्ट पार्क, अयोध्या बायपास, भोपाल",
		addressEn: "Gaur Krishna Kunj, Comfort Park, Ayodhya Bypass, Bhopal",
		phone: "9406523141",
		locationUrl: "https://maps.app.goo.gl/P2UjL51YCuVBHUE28",
	},
	{
		id: "bharatpur",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति संकीर्तन मंडल",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Sankirtan Mandal",
		addressHi: "विदेह कौर कालोनी, भरतपुर, राजस्थान",
		addressEn: "Videh Kaur Colony, Bharatpur, Rajasthan",
		phone: "8003987027",
		locationPhone: "9887880429", // Naman Prabhuji for location
		isWhatsappLocation: true,
	},
	{
		id: "bangaon",
		nameHi: 'श्री "विरही" सत्संग भवन',
		nameEn: 'Shri "Virahi" Satsang Bhawan',
		addressHi: "ग्राम बनगांव, मध्य प्रदेश",
		addressEn: "Gram Bangaon, M.P.",
		phone: "8770665363, 9755050177",
		locationPhone: "9755050177",
		isWhatsappLocation: true,
	},
	{
		id: "jhansi",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति संकीर्तन मंडल",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Sankirtan Mandal",
		addressHi: "झांसी",
		addressEn: "Jhansi",
		phone: "9521254309",
		locationPhone: "9521254309",
		isWhatsappLocation: true,
	},
	{
		id: "nariaoli",
		nameHi: "श्री कृष्ण चैतन्य प्रेम भक्ति संकीर्तन मंडल",
		nameEn: "Shri Krishna Chaitanya Prem Bhakti Sankirtan Mandal",
		addressHi: "नारयावली",
		addressEn: "Nariaoli",
		phone: "9893371463",
		locationPhone: "9893371463",
		isWhatsappLocation: true,
	},
];

export const SevaCenterScreen: React.FC<SevaCenterScreenProps> = ({
	onBack,
	scrollBarSide = "left",
	settingsLanguage = "hi",
	onOpenDonate,
	onOpenTempleTimings,
}) => {
	const [lang, setLang] = useState<"en" | "hi">(settingsLanguage || "hi");
	const isHindi = lang === "hi";
	const [_timingsData, setTimingsData] = useState<
		Record<string, TempleTiming[]>
	>({});
	const [allowedMandals, setAllowedMandals] = useState<string[]>([]);
	const { dbMandals: sharedMandals, loadingMandals } = useSharedFirebase();

	useEffect(() => {
		if (settingsLanguage) {
			setLang(settingsLanguage);
		}
	}, [settingsLanguage]);

	useEffect(() => {
		const fetchAllowedMandals = async () => {
			try {
				const snapshot = await getDocs(collection(db, "admin_roles"));
				const allowed = new Set<string>();
				snapshot.forEach((doc) => {
					const data = doc.data();
					if (
						data.role === "mandal" &&
						data.mandalId &&
						data.permissions?.includes("timings")
					) {
						allowed.add(data.mandalId);
					}
				});
				setAllowedMandals(Array.from(allowed));
			} catch (error) {
				console.error("Error fetching allowed mandals:", error);
			}
		};
		fetchAllowedMandals();
	}, []);

	useEffect(() => {
		if (loadingMandals) return;

		const timings: Record<string, TempleTiming[]> = {};
		sharedMandals.forEach((mandalData) => {
			if (mandalData.templeTimings && mandalData.templeTimings.length > 0) {
				timings[mandalData.id] = mandalData.templeTimings.sort(
					(a: TempleTiming, b: TempleTiming) => a.order - b.order,
				);
			}
		});
		setTimingsData(timings);
	}, [sharedMandals, loadingMandals]);

	const t = {
		title: isHindi ? "सेवा और केंद्र परिचय" : "Our Seva & Centers",
		subtitle: isHindi
			? "श्री चैतन्य प्रेम भक्ति संघ"
			: "Shree Chaitanya Prem Bhakti Sangh",
		centerInfo: isHindi ? "हमारे प्रमुख केंद्र" : "Our Main Centers",
		addressLabel: isHindi ? "पता:" : "Address:",
		getDirections: isHindi ? "मैप पर देखें" : "Get Directions",
		askLocation: isHindi ? "लोकेशन मांगें" : "Ask Location",
		contact: isHindi ? "संपर्क:" : "Contact:",

		ourSeva: isHindi ? "हमारी सेवा गतिविधियाँ" : "Our Seva Activities",
		sevaIntro: isHindi
			? "श्री चैतन्य प्रेम भक्ति संघ का उद्देश्य श्री चैतन्य महाप्रभु के संदेश को जन-जन तक पहुँचाना है। हमारी प्रमुख सेवाएँ निम्नलिखित हैं:"
			: "The mission of Shree Chaitanya Prem Bhakti Sangh is to spread the message of Sri Chaitanya Mahaprabhu. Our diverse seva activities include:",

		seva1: isHindi ? "हरिनाम प्रचार" : "Preaching",
		seva2: isHindi ? "विग्रह सेवा" : "Deity Seva",
		seva3: isHindi ? "अन्नदान" : "Prasadam",

		donateBtn: isHindi ? "सेवा सहयोग / दान करें" : "Offer Seva / Donate",
		joinUs: isHindi ? "हमसे जुड़ें" : "Join Us",
		joinUsDesc: isHindi
			? "आप भी इस ईश्वरीय कार्य में अपना योगदान दे सकते हैं। तन, मन या धन से सेवा अर्पण कर अपने जीवन को सफल बनाएं।"
			: "You too can contribute to this divine cause. Offer your service through body, mind, or wealth and make your life successful.",
	};

	const handleLocationClick = (center: CenterData) => {
		if (center.isWhatsappLocation) {
			const targetNumber =
				center.locationPhone || center.phone.split(",")[0].trim();
			const msg = isHindi
				? `हरे कृष्णा! कृपया ${center.nameHi} (${center.addressHi}) की लोकेशन भेजें।`
				: `Hare Krishna! Please send the location for ${center.nameEn} (${center.addressEn}).`;
			window.open(
				`https://wa.me/91${targetNumber}?text=${encodeURIComponent(msg)}`,
				"_blank",
				"noopener,noreferrer",
			);
		} else if (center.locationUrl) {
			window.open(center.locationUrl, "_blank", "noopener,noreferrer");
		}
	};

	const handleCall = (number: string) => {
		window.open(`tel:${number.replace(/\s+/g, "")}`, "_self");
	};

	return (
		<div className="fixed inset-0 z-50 bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-right duration-300 font-sans">
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
						onClick={onBack}
						className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>
					<h2 className="font-display text-xl font-semibold flex items-center gap-2 tracking-wide leading-none drop-shadow-md">
						<Building2 className="w-6 h-6" />
						{t.title}
					</h2>
				</div>

				<button
					onClick={() => setLang((prev) => (prev === "hi" ? "en" : "hi"))}
					data-tour="seva-lang"
					className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors text-xs font-bold border border-white/30"
				>
					<Languages size={14} />
					{isHindi ? "English" : "हिंदी"}
				</button>
			</div>

			{/* Content */}
			<div
				className={`flex-1 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-0`}
			>
				<div
					dir={scrollBarSide === "left" ? "ltr" : undefined}
					className="max-w-4xl mx-auto space-y-6 mt-2"
				>
					{/* Hero Image / Banner - Solid Gold Premium Look */}
					<div className="bg-gradient-to-br from-ry-gold to-orange-600 rounded-3xl p-8 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-6 border border-orange-400/50">
						{/* Background Texture Overlay */}
						<div
							className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-overlay"
							style={{
								backgroundImage:
									"url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
							}}
						></div>

						<div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

						<div className="relative z-10 text-center">
							<div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/40 shadow-sm">
								<HeartHandshake className="w-8 h-8 text-white" />
							</div>
							<h3 className="font-heading text-2xl mb-2 tracking-wide">
								{t.subtitle}
							</h3>
							<p className="text-white/90 font-bold text-xs uppercase tracking-widest">
								{isHindi ? "मंदिर एवं प्रचार केंद्र" : "Temples & Preaching Centers"}
							</p>
						</div>
					</div>

					{/* 1. Center List */}
					<div>
						<h3 className="text-lg font-bold text-ry-gold dark:text-ry-gold mb-4 flex items-center gap-2 px-2 uppercase tracking-wider text-sm">
							<MapPin className="w-5 h-5" />
							{t.centerInfo}
						</h3>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{CENTERS.map((center, index) => (
								<div
									key={center.id}
									className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-ry-gold/40 dark:border-slate-700 shadow-sm animate-fade-in-up hover:border-ry-gold hover:shadow-md transition-all flex flex-col h-full"
									data-tour="seva-center"
									style={{ animationDelay: `${index * 50}ms` }}
								>
									<div className="flex-1 flex flex-col gap-4 justify-between">
										{/* Name & Address */}
										<div>
											<div className="flex gap-4">
												<div className="w-12 h-12 bg-ry-cream dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0 text-ry-gold dark:text-ry-gold border border-ry-gold/40 dark:border-slate-600">
													<Building2 size={24} />
												</div>
												<div className="flex-1 min-w-0 pt-1">
													<h4 className="text-base font-bold text-slate-800 dark:text-white leading-tight break-words">
														{isHindi ? center.nameHi : center.nameEn}
													</h4>
													<p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-snug font-medium break-words">
														{isHindi ? center.addressHi : center.addressEn}
													</p>
												</div>
											</div>
											<div className="h-px bg-ry-cream dark:bg-slate-700 w-full my-4" />
										</div>

										{/* Actions Area */}
										<div className="flex flex-col gap-2.5">
											{/* Phone Numbers List */}
											<div className="flex flex-wrap gap-2">
												{center.phone.split(",").map((num, idx) => (
													<button
														key={idx}
														onClick={() => handleCall(num.trim())}
													data-tour="seva-call"
														className="flex items-center gap-2 text-xs font-mono font-bold text-ry-gold dark:text-ry-gold bg-ry-sand dark:bg-slate-700 px-3 py-2.5 rounded-xl border border-ry-gold/40 dark:border-slate-600 hover:bg-ry-cream dark:hover:bg-slate-600 transition-all active:scale-95 shadow-sm flex-1 justify-center whitespace-nowrap"
													>
														<Phone size={14} />
														<span>{num.trim()}</span>
													</button>
												))}
											</div>

											{/* Location Button */}
											<button
												onClick={() => handleLocationClick(center)}
												data-tour="seva-directions"
												className="w-full flex items-center justify-center gap-2 text-xs font-bold px-4 py-3 rounded-xl transition-colors bg-ry-cream dark:bg-slate-700 text-ry-maroon dark:text-ry-gold hover:bg-ry-gold/40 dark:hover:bg-slate-600 border border-ry-gold/40 dark:border-slate-600 shadow-sm"
											>
												{center.isWhatsappLocation ? (
													<MessageCircle size={16} />
												) : (
													<Navigation size={16} />
												)}
												{center.isWhatsappLocation
													? t.askLocation
													: t.getDirections}
											</button>

											{/* Temple Timings Button */}
											{allowedMandals.includes(center.id) && (
												<button
													onClick={() => onOpenTempleTimings?.(center.id)}
													className="w-full mt-3 flex items-center justify-center gap-2 text-xs font-bold px-4 py-3 rounded-xl transition-colors bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50 shadow-sm"
												>
													<Clock size={16} />
													{isHindi ? "दैनिक दर्शन समय" : "Daily Darshan Timings"}
												</button>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* 2. Our Seva (Impact Grid Style) */}
					<div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-ry-gold/40 dark:border-slate-700 shadow-sm relative overflow-hidden">
						{/* Background Texture Overlay */}
						<div
							className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-multiply dark:opacity-10 dark:mix-blend-screen"
							style={{
								backgroundImage:
									"url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
							}}
						></div>

						<div className="relative z-10">
							<h3 className="text-lg font-bold text-ry-gold dark:text-ry-gold mb-3 flex items-center gap-2 uppercase tracking-wider text-sm">
								<HeartHandshake className="w-5 h-5" />
								{t.ourSeva}
							</h3>
							<p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm mb-6 font-medium">
								{t.sevaIntro}
							</p>

							<div className="grid grid-cols-3 gap-3 w-full">
								{/* 1. Preaching */}
								<div className="bg-ry-sand dark:bg-slate-700 p-4 rounded-2xl border border-ry-cream dark:border-slate-600 flex flex-col items-center gap-3 text-center transition-colors hover:bg-ry-cream dark:hover:bg-slate-600">
									<div className="text-ry-gold dark:text-ry-gold bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm border border-ry-cream dark:border-slate-600">
										<BookOpen size={22} />
									</div>
									<span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-tight">
										{t.seva1}
									</span>
								</div>

								{/* 2. Deity Seva */}
								<div className="bg-ry-sand dark:bg-slate-700 p-4 rounded-2xl border border-ry-cream dark:border-slate-600 flex flex-col items-center gap-3 text-center transition-colors hover:bg-ry-cream dark:hover:bg-slate-600">
									<div className="text-ry-gold dark:text-ry-gold bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm border border-ry-cream dark:border-slate-600">
										<Sparkles size={22} />
									</div>
									<span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-tight">
										{t.seva2}
									</span>
								</div>

								{/* 3. Prasadam */}
								<div className="bg-ry-sand dark:bg-slate-700 p-4 rounded-2xl border border-ry-cream dark:border-slate-600 flex flex-col items-center gap-3 text-center transition-colors hover:bg-ry-cream dark:hover:bg-slate-600">
									<div className="text-ry-gold dark:text-ry-gold bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm border border-ry-cream dark:border-slate-600">
										<Utensils size={22} />
									</div>
									<span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-tight">
										{t.seva3}
									</span>
								</div>
							</div>

							{/* Donate Button inside Seva */}
							<div className="mt-6 pt-5 border-t border-ry-cream dark:border-slate-700">
								<button
									onClick={onOpenDonate}
									className="w-full bg-gradient-to-r from-ry-gold to-orange-600 hover:from-ry-gold hover:to-orange-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transform transition-all active:scale-95"
								>
									<Heart size={18} className="fill-white animate-pulse" />
									<span>{t.donateBtn}</span>
								</button>
							</div>
						</div>
					</div>

					{/* 3. Join Us Footer */}
					<div className="bg-ry-sand dark:bg-slate-800 p-6 rounded-3xl border border-ry-gold/40 dark:border-slate-700 shadow-sm">
						<h3 className="text-lg font-bold text-ry-gold dark:text-ry-gold mb-2 flex items-center gap-2">
							<Sparkles size={18} />
							{t.joinUs}
						</h3>
						<p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium">
							{t.joinUsDesc}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

import {
	Building2,
	Heart,
	History,
	Info,
	Languages,
	Sparkles,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface AboutScreenProps {
	isOpen: boolean;
	onClose: () => void;
	onOpenDonate: () => void;
	onOpenSevaCenter?: () => void;
	scrollBarSide?: "left" | "right";
	settingsLanguage: "en" | "hi";
}

export const AboutScreen: React.FC<AboutScreenProps> = ({
	isOpen,
	onClose,
	onOpenDonate,
	onOpenSevaCenter,
	scrollBarSide = "left",
	settingsLanguage,
}) => {
	const [lang, setLang] = useState<"hi" | "en">(settingsLanguage);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		setLang(settingsLanguage);
	}, [settingsLanguage, isOpen]);

	if (!isOpen) return null;

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
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between shadow-lg z-10 sticky top-0 rounded-b-3xl border-b-2 border-ry-gold/40">
				<div className="flex items-center gap-3">
					<button
						onClick={onClose}
						className="p-2 -ml-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
						type="button"
					>
						<X className="w-6 h-6" />
					</button>
					<h2 className="font-display text-xl font-semibold flex items-center gap-2 tracking-wide leading-none drop-shadow-md">
						<Info className="w-5 h-5" />
						{lang === "hi"
							? "श्री चैतन्य प्रेम भक्ति संघ"
							: "Shri Chaitanya Prem Bhakti Sangh"}
					</h2>
				</div>

				<button
					onClick={() => setLang((prev) => (prev === "hi" ? "en" : "hi"))}
					className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors text-xs font-bold border border-white/30"
				>
					<Languages size={14} />
					<span>{lang === "hi" ? "English" : "हिंदी"}</span>
				</button>
			</div>

			{/* Content - Scrollbar Applied */}
			<div
				className={`flex-1 overflow-y-auto scroll-container ${scrollBarSide === "left" ? "left-scrollbar" : ""} relative z-0`}
			>
				<div
					dir={scrollBarSide === "left" ? "ltr" : undefined}
					className="max-w-4xl mx-auto p-5 pb-[calc(2rem+env(safe-area-inset-bottom))]"
				>
					<div className="flex flex-col landscape:flex-row landscape:items-start landscape:gap-12">
						{/* Left Col (Landscape): Hero Logo & Actions */}
						<div className="flex flex-col items-center justify-center landscape:sticky landscape:top-0 landscape:w-1/3">
							{/* Hero Logo Section */}
							<div className="flex flex-col items-center justify-center pt-4 pb-2 animate-fade-in-up">
								<div className="w-20 h-20 bg-gradient-to-br from-ry-maroon to-ink-800 border border-ry-gold/40 rounded-2xl shadow-lg flex items-center justify-center mb-4 transform rotate-3">
									<svg
										viewBox="0 0 100 220"
										className="h-12 w-auto text-white fill-current drop-shadow-sm transform -rotate-3"
									>
										<path
											d="M30 10v85q0 40 20 40t20-40V10"
											fill="none"
											stroke="currentColor"
											strokeWidth="12"
											strokeLinecap="round"
										/>
										<path
											d="M50 135 C28 135, 20 165, 50 200 C80 165, 72 135, 50 135 Z"
											fill="currentColor"
										/>
									</svg>
								</div>
								<h1 className="text-2xl font-bold text-slate-800 dark:text-white text-center leading-tight">
									Shree Chaitanya
									<br />
									<span className="text-ry-maroon dark:text-ry-gold">
										Prem Bhakti Sangh
									</span>
								</h1>
							</div>

							{/* Top Action Buttons */}
							<div
								className="flex flex-col gap-3 w-full mt-6 animate-fade-in-up"
								style={{ animationDelay: "50ms" }}
							>
								{/* Support Button (Top) */}
								<button
									onClick={onOpenDonate}
									className="w-full bg-ry-maroon hover:bg-ink-800 text-ry-gold py-4 landscape:py-3 rounded-xl font-bold text-lg shadow-lg shadow-ry-maroon/30 border border-ry-gold/40 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
								>
									<Heart size={22} className="fill-current" />
									<span>
										{lang === "en"
											? "Support Seva / Donate"
											: "सेवा सहयोग / दान करें"}
									</span>
								</button>

								{/* Centers Button */}
								{onOpenSevaCenter && (
									<button
										onClick={onOpenSevaCenter}
										className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all shadow-sm"
									>
										<Building2 size={18} />
										<span>
											{lang === "en"
												? "View Our Centers & Seva"
												: "हमारे केंद्र और सेवा देखें"}
										</span>
									</button>
								)}
							</div>
						</div>

						{/* Right Col (Landscape): Main Text Content */}
						<div className="space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed text-[15px] sm:text-base mt-8 landscape:mt-0 landscape:w-2/3">
							{/* Introduction Section */}
							{lang === "en" ? (
								<div
									className="space-y-4 animate-fade-in-up"
									style={{ animationDelay: "100ms" }}
								>
									<p>
										<strong className="text-saffron-600 dark:text-saffron-400 font-bold text-lg block mb-1">
											Shree Chaitanya Prem Bhakti Sangh
										</strong>
										is a Gaudiya Vaishnava community formed to preach the Holy
										Names of the Lord across the northwestern and central
										regions of India.
									</p>
									<p>
										Gaudiya Vaishnavism is based on the life and teachings of
										Shri Chaitanya Mahaprabhu, who is also known as{" "}
										<span className="font-semibold text-slate-800 dark:text-slate-100">
											Gauranga Mahaprabhu
										</span>
										.
									</p>
									<div className="flex gap-4 items-start bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
										<Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
										<p className="text-sm">
											Vaishnavism signifies the worship of Lord Vishnu and His
											incarnations, while 'Gauda' refers to the region of West
											Bengal, the birthplace of this divine tradition.
										</p>
									</div>
									<p>
										Shri Chaitanya Mahaprabhu rejuvenated the culture of Krishna
										bhakti in India during the fifteenth century.
									</p>
									<p>
										This movement is traditionally known as the{" "}
										<span className="font-medium text-gold-700 dark:text-gold-300">
											Brahma-Madhva-Gaudiya Vaishnava Sampradaya
										</span>
										.
									</p>
									<p>
										The ultimate goal of this movement is to develop a loving,
										eternal relationship with the Supreme Lord, Shri Krishna.
									</p>
								</div>
							) : (
								<div
									className="space-y-4 animate-fade-in-up"
									style={{ animationDelay: "100ms" }}
								>
									<p>
										<strong className="text-saffron-600 dark:text-saffron-400 font-bold text-lg block mb-1 font-hindi">
											श्री चैतन्य प्रेम भक्ति संघ
										</strong>
										मूल रूप से एक गौड़ीय वैष्णव समुदाय है जिसका गठन देश के उत्तर-पश्चिमी और
										मध्य भागों में भगवान के पवित्र नामों का प्रचार करने के उद्देश्य से किया
										गया था।
									</p>
									<p>
										गौड़ीय वैष्णव धर्म भगवान चैतन्य के जीवन और शिक्षाओं पर आधारित है, जिन्हें{" "}
										<span className="font-semibold text-slate-800 dark:text-slate-100">
											गौरांग महाप्रभु
										</span>{" "}
										के नाम से भी जाना जाता है।
									</p>
									<div className="flex gap-4 items-start bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
										<Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
										<p className="text-sm">
											वैष्णववाद का अर्थ है 'भगवान विष्णु और उनके अवतारों की भक्ति', जबकि
											'गौड़' पश्चिम बंगाल के उस क्षेत्र को संदर्भित करता है जहाँ से इस
											संप्रदाय की उत्पत्ति हुई।
										</p>
									</div>
									<p>
										श्री चैतन्य महाप्रभु ने पंद्रहवीं शताब्दी में भारत में श्रीकृष्ण भक्ति की
										संस्कृति को पुनर्जीवित किया।
									</p>
									<p>
										इस आंदोलन को मूल रूप से{" "}
										<span className="font-medium text-gold-700 dark:text-gold-300">
											ब्रह्म-माध्व-गौड़ीय वैष्णव संप्रदाय
										</span>{" "}
										कहा जाता है।
									</p>
									<p>
										इस आंदोलन का अंतिम लक्ष्य सर्वोच्च भगवान श्री कृष्ण के साथ प्रेमपूर्ण संबंध
										विकसित करना है।
									</p>
								</div>
							)}

							{/* Mahamantra Card */}
							<div
								className="my-8 animate-fade-in-up"
								style={{ animationDelay: "200ms" }}
							>
								<div className="relative bg-gradient-to-br from-saffron-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 p-6 rounded-2xl border border-saffron-200 dark:border-slate-700 text-center shadow-sm overflow-hidden group">
									<div className="absolute top-0 right-0 w-24 h-24 bg-saffron-500/10 rounded-full blur-2xl group-hover:bg-saffron-500/20 transition-colors"></div>
									<div className="relative z-10">
										<p className="mb-3 text-xs font-bold text-saffron-600 dark:text-saffron-400 uppercase tracking-widest">
											{lang === "en" ? "The Mahamantra" : "महामंत्र"}
										</p>
										<p className="text-lg sm:text-2xl font-hindi font-bold text-slate-800 dark:text-white leading-relaxed">
											हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे
											<br />
											हरे राम हरे राम राम राम हरे हरे
										</p>
									</div>
								</div>
								<div className="mt-4 text-center px-4">
									<p className="text-sm text-slate-500 dark:text-slate-400">
										{lang === "en"
											? "Shri Chaitanya Mahaprabhu promoted the Mahamantra as the most effective means of self-purification in this age of Kali."
											: "श्री चैतन्य महाप्रभु ने इस कलियुग में आत्म-शुद्धि के सबसे प्रभावी साधन के रूप में महामंत्र का प्रचार किया।"}
									</p>
									<p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
										{lang === "en"
											? "Srimad Bhagavad Gita and Shri Bhagavata Purana are the primary scriptures followed by Gaudiya Vaishnavas."
											: "श्रीमद्भगवद्गीता और श्री भागवत पुराण, गौड़ीय वैष्णवों द्वारा पालन किए जाने वाले प्रमुख ग्रंथ हैं।"}
									</p>
								</div>
							</div>

							{/* Timeline / History Section */}
							<div
								className="relative pt-4 pb-2 animate-fade-in-up"
								style={{ animationDelay: "300ms" }}
							>
								<div className="absolute left-3.5 top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

								<h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 pl-10 flex items-center gap-2">
									<History size={16} />{" "}
									{lang === "en" ? "Our Lineage" : "गुरु परंपरा"}
								</h3>

								<div className="space-y-8">
									{lang === "en" ? (
										<>
											<TimelineItem
												year="1920"
												title="Establishment of Gaudiya Math"
												content="The first preaching center was established on September 6, 1920, by Sri Srimad Bhaktisiddhanta Saraswati Goswami 'Prabhupada', and was named 'Gaudiya Math'."
											/>
											<TimelineItem
												title="Srila Bhaktisiddhanta Saraswati Goswami Prabhupada"
												content={
													<>
														<p className="mb-2">
															Srila Bhaktisiddhanta Saraswati Goswami Prabhupada
															appeared in Shri Kshetra Dham (Jagannatha Puri) on
															February 6, 1874, as the son of Srila
															Sac-cid-ananda Bhaktivinoda Thakura.
														</p>
														<p className="mb-2">
															He preached Shri Chaitanya Mahaprabhu’s message of
															Divine Love across India with immense vigor,
															opposing philosophical deviations and social
															barriers to provide spiritual fulfillment for all.
														</p>
														<p>
															He established the central Gaudiya Math in
															Mayapur, West Bengal, which grew into a dynamic
															missionary movement with sixty-four branches
															across India during his presence.
														</p>
													</>
												}
											/>
											<TimelineItem
												year="1904"
												title="Srila Bhakti Dayita Madhava Goswami Maharaja"
												content={
													<>
														<p className="mb-2">
															Srila Bhakti Dayita Madhava Goswami Maharaja
															appeared in Kanchanpara on November 18, 1904, on
															the auspicious Utthan Ekadashi tithi.
														</p>
														<p className="mb-2">
															He was a dearmost disciple and successor of Srila
															Prabhupada. He established many large preaching
															centers and founded the All India Shri Chaitanya
															Gaudiya Math in Kolkata in 1953.
														</p>
														<p>
															One of his most significant contributions was
															recovering the appearance site of his spiritual
															master, Srila Prabhupada, in Shri Jagannatha Puri.
														</p>
													</>
												}
											/>
											<TimelineItem
												title="Shri Vasudev Sharan 'Virahi' Ji Maharaja"
												isLast
												content={
													<>
														<p className="mb-2">
															Following the orders of his spiritual master,{" "}
															<strong className="text-saffron-600 dark:text-saffron-400">
																Sri Sri 108 Shri Vasudev Sharan 'Virahi' Ji
																Maharaja
															</strong>{" "}
															expanded the mission significantly in Central and
															Northwestern India.
														</p>
														<p>
															He established the{" "}
															<strong>
																'Shree Chaitanya Prem Bhakti Sangh'
															</strong>{" "}
															to provide a dedicated platform for spiritual
															practices based entirely on the pure teachings of
															Lord Chaitanya.
														</p>
													</>
												}
											/>
										</>
									) : (
										<>
											<TimelineItem
												year="1920"
												title="गौड़ीय मठ की स्थापना"
												content="पहला प्रचार केंद्र 6 सितंबर 1920 को श्री श्रीमद् भक्तिसिद्धांत सरस्वती गोस्वामी 'प्रभुपाद' द्वारा स्थापित किया गया था, जिसे 'गौड़ीय मठ' नाम दिया गया।"
											/>
											<TimelineItem
												title="श्रील भक्तिसिद्धांत सरस्वती गोस्वामी प्रभुपाद"
												content={
													<>
														<p className="mb-2">
															श्रील भक्तिसिद्धांत सरस्वती गोस्वामी प्रभुपाद 6 फरवरी 1874
															को श्रील सच्चिदानंद भक्तिविनोद ठाकुर के पुत्र के रूप में श्री
															क्षेत्र धाम (जगन्नाथ पुरी) में प्रकट हुए।
														</p>
														<p className="mb-2">
															उन्होंने पूरे भारत में श्री चैतन्य महाप्रभु के भगवद प्रेम के संदेश
															का बड़े जोश के साथ प्रचार किया और सभी के लिए आध्यात्मिक
															कल्याण का मार्ग प्रशस्त किया।
														</p>
														<p>
															उन्होंने मायापुर में गौड़ीय मठ की स्थापना की, जो बाद में सभी
															शाखाओं का मूल केंद्र बना। उनके समय में पूरे भारत में चौंसठ
															शाखाएं सक्रिय थीं।
														</p>
													</>
												}
											/>
											<TimelineItem
												year="1904"
												title="श्रील भक्ति दयित माधव गोस्वामी महाराज"
												content={
													<>
														<p className="mb-2">
															श्रील भक्ति दयित माधव गोस्वामी महाराज का प्राकट्य 18
															नवंबर, 1904 को पवित्र उत्थान एकादशी तिथि पर कंचनपाड़ा में
															हुआ था।
														</p>
														<p className="mb-2">
															वे श्रील प्रभुपाद के प्रिय शिष्य और उत्तराधिकारी थे। उन्होंने
															1953 में कोलकाता में 'अखिल भारतीय श्री चैतन्य गौड़ीय मठ'
															की स्थापना की।
														</p>
														<p>
															उनका एक महत्वपूर्ण योगदान श्री जगन्नाथ पुरी में अपने गुरुदेव
															श्रील प्रभुपाद के प्राकट्य स्थल को पुनः प्राप्त कर वहां भव्य
															मंदिर स्थापित करना था।
														</p>
													</>
												}
											/>
											<TimelineItem
												title="श्री वासुदेव शरण 'विरही' जी महाराज"
												isLast
												content={
													<>
														<p className="mb-2">
															अपने गुरुदेव के आदेशानुसार, उनके प्रिय शिष्य{" "}
															<strong className="text-saffron-600 dark:text-saffron-400">
																श्री श्री 108 श्री वासुदेव शरण 'विरही' जी महाराज
															</strong>{" "}
															ने देश के उत्तर-पश्चिम और मध्य क्षेत्रों में प्रचार का व्यापक
															विस्तार किया।
														</p>
														<p>
															उन्होंने <strong>'श्री चैतन्य प्रेम भक्ति संघ'</strong> की
															स्थापना की, जो पूरी तरह से भगवान चैतन्य की शिक्षाओं और
															शुद्ध भक्ति के सिद्धांतों पर आधारित है।
														</p>
													</>
												}
											/>
										</>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Bottom Actions */}
					<div className="pt-8 text-center landscape:pt-4">
						<button
							onClick={onOpenDonate}
							className="w-full bg-saffron-500 hover:bg-saffron-600 text-white py-4 landscape:py-3 rounded-xl font-bold text-lg shadow-lg shadow-saffron-500/30 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
						>
							<Heart size={22} className="fill-current" />
							<span>
								{lang === "en" ? "Support Seva / Donate" : "सेवा सहयोग / दान करें"}
							</span>
						</button>

						<div className="mt-8 text-center opacity-60">
							<div className="w-16 h-1 bg-gradient-to-r from-saffron-300 to-saffron-500 dark:from-slate-700 dark:to-slate-600 rounded-full mx-auto mb-3"></div>
							<span className="text-saffron-600 dark:text-saffron-400 font-logo text-2xl tracking-wide">
								RadheShyam
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

// Helper Component for Timeline
const TimelineItem: React.FC<{
	year?: string;
	title: string;
	content: React.ReactNode;
	isLast?: boolean;
}> = ({ year, title, content, isLast }) => (
	<div className="relative pl-10">
		{/* Dot */}
		<div className="absolute left-0 top-1 w-7 h-7 bg-white dark:bg-slate-900 border-4 border-saffron-200 dark:border-slate-600 rounded-full flex items-center justify-center z-10">
			<div className="w-2.5 h-2.5 bg-saffron-500 rounded-full"></div>
		</div>

		{/* Content */}
		<div
			className={`pb-8 ${isLast ? "" : "border-b border-slate-100 dark:border-slate-800"}`}
		>
			{year && (
				<span className="text-xs font-bold text-saffron-500 dark:text-saffron-400 bg-saffron-50 dark:bg-slate-800 px-2 py-0.5 rounded mb-1 inline-block">
					{year}
				</span>
			)}
			<h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
				{title}
			</h4>
			<div className="text-slate-600 dark:text-slate-300">{content}</div>
		</div>
	</div>
);

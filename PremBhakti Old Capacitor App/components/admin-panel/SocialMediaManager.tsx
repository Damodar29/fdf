import { doc, getDoc, setDoc } from "firebase/firestore";
import { Save, User } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import { validateAndFormatUrl } from "../../utils/url";

export const SocialMediaManager: React.FC<{
	showToast: (text: string, type?: "success" | "error") => void;
	settingsLanguage?: "en" | "hi";
}> = ({ showToast, settingsLanguage = "hi" }) => {
	const [social, setSocial] = useState({
		isYoutubeLive: false,
		youtubeLiveLink: "",
		isFacebookLive: false,
		facebookLiveLink: "",
		isInstagramLive: false,
		instagramLiveLink: "",
	});
	const [savingSocial, setSavingSocial] = useState(false);

	const isHindi = settingsLanguage === "hi";
	const t = {
		title: isHindi ? "सोशल मीडिया लाइव" : "Social Media Live",
		youtubeActive: isHindi ? "यूट्यूब लाइव सक्रिय" : "YouTube Live Active",
		youtubeLink: isHindi ? "यूट्यूब लिंक" : "YouTube Link",
		facebookActive: isHindi ? "फेसबुक लाइव सक्रिय" : "Facebook Live Active",
		facebookLink: isHindi ? "फेसबुक लिंक" : "Facebook Link",
		instagramActive: isHindi ? "इंस्टाग्राम लाइव सक्रिय" : "Instagram Live Active",
		instagramLink: isHindi ? "इंस्टाग्राम लिंक" : "Instagram Link",
		saving: isHindi ? "सहेजा जा रहा है..." : "Saving...",
		saveBtn: isHindi ? "सोशल मीडिया कॉन्फ़िगरेशन सहेजें" : "Save Social Media Config",
	};

	useEffect(() => {
		getDoc(doc(db, "app_config", "social_media")).then((d) => {
			if (d.exists()) setSocial(d.data() as any);
		});
	}, []);

	const saveSocial = async () => {
		// Validate URLs
		let validYoutube = social.youtubeLiveLink;
		let validFacebook = social.facebookLiveLink;
		let validInstagram = social.instagramLiveLink;

		if (social.isYoutubeLive && social.youtubeLiveLink) {
			const valid = validateAndFormatUrl(social.youtubeLiveLink);
			if (!valid) {
				showToast("Please enter a valid YouTube Live Link.", "error");
				return;
			}
			validYoutube = valid;
		}
		if (social.isFacebookLive && social.facebookLiveLink) {
			const valid = validateAndFormatUrl(social.facebookLiveLink);
			if (!valid) {
				showToast("Please enter a valid Facebook Live Link.", "error");
				return;
			}
			validFacebook = valid;
		}
		if (social.isInstagramLive && social.instagramLiveLink) {
			const valid = validateAndFormatUrl(social.instagramLiveLink);
			if (!valid) {
				showToast("Please enter a valid Instagram Live Link.", "error");
				return;
			}
			validInstagram = valid;
		}

		const updatedSocial = {
			...social,
			youtubeLiveLink: validYoutube,
			facebookLiveLink: validFacebook,
			instagramLiveLink: validInstagram,
		};

		setSavingSocial(true);
		try {
			await setDoc(doc(db, "app_config", "social_media"), updatedSocial);
			showToast("Social Media config saved successfully!");
		} catch (e) {
			console.error(e);
			showToast("Failed to save Social Media config.", "error");
		}
		setSavingSocial(false);
	};

	return (
		<div className="h-full overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right">
			<div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
				<div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
					<User className="text-pink-600" size={20} />
					<h3 className="font-bold text-lg text-slate-800 dark:text-white">
						{t.title}
					</h3>
				</div>

				<div className="space-y-4">
					<div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								className="w-5 h-5 rounded border-slate-300 dark:border-ink-700 text-red-600 focus:ring-red-500"
								checked={social.isYoutubeLive}
								onChange={(e) =>
									setSocial({ ...social, isYoutubeLive: e.target.checked })
								}
							/>
							<span className="font-bold text-slate-700 dark:text-slate-300">
								{t.youtubeActive}
							</span>
						</label>
						<input
							className="w-full p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-sm"
							placeholder={t.youtubeLink}
							value={social.youtubeLiveLink}
							onChange={(e) =>
								setSocial({ ...social, youtubeLiveLink: e.target.value })
							}
						/>
					</div>

					<div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								className="w-5 h-5 rounded border-slate-300 dark:border-ink-700 text-blue-600 focus:ring-blue-500"
								checked={social.isFacebookLive}
								onChange={(e) =>
									setSocial({ ...social, isFacebookLive: e.target.checked })
								}
							/>
							<span className="font-bold text-slate-700 dark:text-slate-300">
								{t.facebookActive}
							</span>
						</label>
						<input
							className="w-full p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-sm"
							placeholder={t.facebookLink}
							value={social.facebookLiveLink}
							onChange={(e) =>
								setSocial({ ...social, facebookLiveLink: e.target.value })
							}
						/>
					</div>

					<div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								className="w-5 h-5 rounded border-slate-300 dark:border-ink-700 text-pink-600 focus:ring-pink-500"
								checked={social.isInstagramLive}
								onChange={(e) =>
									setSocial({ ...social, isInstagramLive: e.target.checked })
								}
							/>
							<span className="font-bold text-slate-700 dark:text-slate-300">
								{t.instagramActive}
							</span>
						</label>
						<input
							className="w-full p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-sm"
							placeholder={t.instagramLink}
							value={social.instagramLiveLink}
							onChange={(e) =>
								setSocial({ ...social, instagramLiveLink: e.target.value })
							}
						/>
					</div>
				</div>

				<button
					onClick={saveSocial}
					disabled={savingSocial}
					className="w-full bg-pink-600 hover:bg-pink-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
				>
					<Save size={18} /> {savingSocial ? t.saving : t.saveBtn}
				</button>
			</div>
		</div>
	);
};

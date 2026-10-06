import {
	Calendar,
	CheckCircle2,
	Eye,
	MapPin,
	Sparkles,
	User,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import type { FamilyMember, UserProfile } from "../../context/AuthContext";
import { ProfileQrCode } from "./ProfileQrCode";
import { ThumbImg } from "../ui/ThumbImg";
import { THUMB } from "../../utils/imageThumb";

interface ProfilePreviewModalProps {
	isHindi: boolean;
	profile: UserProfile | null;
	photoPreview: string | null;
	formData: {
		realName: string;
		dikshaName: string;
		guruSelection: string;
		guruNameCustom: string;
		dikshaDate: string;
		mandalId: string;
		personalExperience: string;
		familyMembers: FamilyMember[];
		phoneNumber: string;
	};
	guruDisplayName: string;
	mandalDisplayName: string;
	onClose: () => void;
}

export const ProfilePreviewModal: React.FC<ProfilePreviewModalProps> = ({
	isHindi,
	profile,
	photoPreview,
	formData,
	guruDisplayName,
	mandalDisplayName,
	onClose,
}) => {
	const shortId = profile?.shortId || profile?.uid?.slice(0, 8) || "";

	const displayName = formData.realName || profile?.realName || "";
	const dikshaName = formData.dikshaName || profile?.dikshaName || "";
	const isApproved = profile?.isApproved || false;

	return (
		<div
			className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
			onClick={onClose}
		>
			<div
				className="bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 w-full max-w-sm max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="bg-ry-maroon dark:bg-black p-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Eye size={18} className="text-ry-gold" />
						<h3 className="font-bold text-ry-gold text-sm">
							{isHindi ? "प्रोफाइल प्रीव्यू" : "Profile Preview"}
						</h3>
					</div>
					<button
						onClick={onClose}
						className="p-2 text-ry-gold/60 hover:text-ry-gold rounded-full transition"
					>
						<X size={18} />
					</button>
				</div>

				{/* Profile Card */}
				<div className="p-5">
					{/* Photo + Name */}
					<div className="flex flex-col items-center mb-5">
						<div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl mb-3">
							{photoPreview ? (
								<ThumbImg
									src={photoPreview}
									thumbWidth={THUMB.tile}
									alt="Profile"
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="w-full h-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
									<User size={36} className="text-pink-400" />
								</div>
							)}
						</div>
						<h3 className="text-lg font-bold text-slate-800 dark:text-white">
							{displayName || "—"}
						</h3>
						{dikshaName && (
							<p className="text-sm text-slate-500 dark:text-slate-400">
								{dikshaName}
							</p>
						)}
						{isApproved && (
							<span className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full">
								<CheckCircle2 size={12} />
								{isHindi ? "सत्यापित सदस्य" : "Verified Member"}
							</span>
						)}
					</div>

					{/* Details */}
					<div className="space-y-2.5">
						{guruDisplayName && (
							<div className="flex items-center gap-3 bg-white dark:bg-slate-800/50 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-800">
								<Sparkles size={14} className="text-amber-500 shrink-0" />
								<div>
									<p className="text-[10px] text-slate-400 dark:text-ink-400 uppercase font-bold">
										{isHindi ? "गुरु" : "Guru"}
									</p>
									<p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
										{guruDisplayName}
									</p>
								</div>
							</div>
						)}
						{mandalDisplayName && (
							<div className="flex items-center gap-3 bg-white dark:bg-slate-800/50 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-800">
								<MapPin size={14} className="text-pink-500 shrink-0" />
								<div>
									<p className="text-[10px] text-slate-400 dark:text-ink-400 uppercase font-bold">
										{isHindi ? "मंडल" : "Mandal"}
									</p>
									<p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
										{mandalDisplayName}
									</p>
								</div>
							</div>
						)}
						{formData.dikshaDate && (
							<div className="flex items-center gap-3 bg-white dark:bg-slate-800/50 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-800">
								<Calendar size={14} className="text-blue-500 shrink-0" />
								<div>
									<p className="text-[10px] text-slate-400 dark:text-ink-400 uppercase font-bold">
										{isHindi ? "दीक्षा तिथि" : "Diksha Date"}
									</p>
									<p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
										{formData.dikshaDate}
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Family Members Count */}
					{formData.familyMembers.length > 0 && (
						<div className="mt-3 flex items-center gap-2 bg-purple-50 dark:bg-purple-500/10 rounded-xl px-3 py-2.5 border border-purple-100 dark:border-purple-800/30">
							<Users size={14} className="text-purple-500 shrink-0" />
							<span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
								{formData.familyMembers.length}{" "}
								{isHindi ? "परिवार के सदस्य" : "Family Members"}
							</span>
						</div>
					)}

					{/* Experience */}
					{formData.personalExperience && (
						<div className="mt-3 bg-white dark:bg-slate-800/50 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-800">
							<p className="text-[10px] text-slate-400 dark:text-ink-400 uppercase font-bold mb-1">
								{isHindi ? "अनुभव" : "Experience"}
							</p>
							<p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-4">
								{formData.personalExperience}
							</p>
						</div>
					)}

					{/* QR Code */}
					<div className="mt-5 flex flex-col items-center pt-4 border-t border-slate-100 dark:border-slate-800">
						<p className="text-[10px] text-slate-400 dark:text-ink-400 uppercase font-bold mb-2">
							{isHindi ? "प्रोफाइल QR कोड" : "Profile QR Code"}
						</p>
						{shortId ? (
							<>
								{/* White card in both themes: a QR code needs dark-on-light. */}
								<div className="rounded-2xl bg-white p-2 shadow-sm border border-slate-200 dark:border-slate-700">
									<ProfileQrCode
										value={`Prem Bhakti Devotee ID: ${shortId}`}
										badge="Prem Bhakti"
										size={200}
									/>
								</div>
								<p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono font-bold tracking-wider">
									ID: {shortId}
								</p>
							</>
						) : (
							<p className="text-xs text-slate-400 dark:text-ink-400">
								{isHindi
									? "प्रोफाइल सहेजने के बाद QR कोड दिखेगा"
									: "The QR code appears once the profile is saved"}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

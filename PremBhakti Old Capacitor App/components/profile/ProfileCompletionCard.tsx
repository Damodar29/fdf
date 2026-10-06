import {
	BookOpen,
	Calendar,
	Camera,
	MapPin,
	Phone,
	Sparkles,
	User,
	Users,
} from "lucide-react";
import type React from "react";
import { useMemo } from "react";

interface ProfileCompletionCardProps {
	isHindi: boolean;
	realName: string;
	dikshaName: string;
	guruSelection: string;
	dikshaDate: string;
	mandalId: string;
	photoPreview: string | null;
	phoneNumber: string;
	isAspiringSelected: boolean;
	/** Saved on the profile at once (not part of the form). */
	gender?: string;
}

interface CompletionField {
	key: string;
	labelHi: string;
	labelEn: string;
	weight: number;
	filled: boolean;
	icon: React.ReactNode;
}

export const ProfileCompletionCard: React.FC<ProfileCompletionCardProps> = ({
	isHindi,
	realName,
	dikshaName,
	guruSelection,
	dikshaDate,
	mandalId,
	photoPreview,
	phoneNumber,
	isAspiringSelected,
	gender,
}) => {
	const fields = useMemo<CompletionField[]>(
		() => [
			{
				key: "name",
				labelHi: "नाम भरें",
				labelEn: "Add your name",
				weight: 15,
				filled: !!realName.trim(),
				icon: <User size={12} />,
			},
			{
				key: "dikshaName",
				labelHi: "दीक्षित नाम भरें",
				labelEn: "Add Diksha name",
				weight: 10,
				filled: !!dikshaName.trim(),
				icon: <BookOpen size={12} />,
			},
			{
				key: "guru",
				labelHi: "गुरु चुनें",
				labelEn: "Select Guru",
				weight: 15,
				filled: !!guruSelection,
				icon: <Sparkles size={12} />,
			},
			{
				key: "dikshaDate",
				labelHi: "दीक्षा तिथि भरें",
				labelEn: "Add Diksha date",
				weight: 10,
				filled: isAspiringSelected || !!dikshaDate,
				icon: <Calendar size={12} />,
			},
			{
				key: "mandal",
				labelHi: "मंडल चुनें",
				labelEn: "Select Mandal",
				weight: 15,
				filled: !!mandalId.trim(),
				icon: <MapPin size={12} />,
			},
			{
				key: "photo",
				labelHi: "फोटो जोड़ें",
				labelEn: "Add photo",
				weight: 15,
				filled: !!photoPreview,
				icon: <Camera size={12} />,
			},
			{
				key: "phone",
				labelHi: "फोन नंबर जोड़ें",
				labelEn: "Add phone number",
				weight: 10,
				filled:
					!!phoneNumber && phoneNumber !== "+91" && phoneNumber.length >= 13,
				icon: <Phone size={12} />,
			},
			{
				key: "gender",
				labelHi: "लिंग चुनें",
				labelEn: "Select gender",
				weight: 10,
				filled: gender === "male" || gender === "female",
				icon: <Users size={12} />,
			},
		],
		[
			realName,
			dikshaName,
			guruSelection,
			dikshaDate,
			mandalId,
			photoPreview,
			phoneNumber,
			isAspiringSelected,
			gender,
		],
	);

	const { percent, missingTips } = useMemo(() => {
		let totalWeight = 0;
		let filledWeight = 0;
		const tips: CompletionField[] = [];

		for (const f of fields) {
			totalWeight += f.weight;
			if (f.filled) filledWeight += f.weight;
			else tips.push(f);
		}

		return {
			percent:
				totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0,
			missingTips: tips.slice(0, 3),
		};
	}, [fields]);

	// SVG ring properties
	const radius = 40;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference - (percent / 100) * circumference;

	const ringColor =
		percent < 40 ? "#ef4444" : percent < 70 ? "#f59e0b" : "#10b981";
	const ringColorBg =
		percent < 40
			? "rgba(239,68,68,0.15)"
			: percent < 70
				? "rgba(245,158,11,0.15)"
				: "rgba(16,185,129,0.15)";

	// Nothing left to fill: one slim row instead of the big card.
	if (percent === 100) {
		return (
			<div
				className="flex-1 min-w-[140px] flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-700/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2"
				data-tour="profile-completion"
			>
				<Sparkles
					size={15}
					className="shrink-0 text-emerald-600 dark:text-emerald-400"
				/>
				<span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 leading-snug">
					{isHindi ? "प्रोफाइल पूर्ण" : "Profile complete"}
				</span>
			</div>
		);
	}

	return (
		<div
			className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4"
			data-tour="profile-completion"
		>
			<div className="flex items-center gap-4">
				{/* Circular Ring */}
				<div className="relative shrink-0">
					<svg width="96" height="96" className="transform -rotate-90">
						{/* Background circle */}
						<circle
							cx="48"
							cy="48"
							r={radius}
							fill="none"
							stroke={ringColorBg}
							strokeWidth="7"
						/>
						{/* Progress circle */}
						<circle
							cx="48"
							cy="48"
							r={radius}
							fill="none"
							stroke={ringColor}
							strokeWidth="7"
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
							className="transition-all duration-1000 ease-out"
						/>
					</svg>
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="text-lg font-bold" style={{ color: ringColor }}>
							{percent}%
						</span>
					</div>
				</div>

				{/* Tips */}
				<div className="flex-1 min-w-0">
					<p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
						{isHindi ? "प्रोफाइल पूर्णता" : "Profile Completion"}
					</p>
					<div className="space-y-1.5">
						{missingTips.map((tip) => (
							<div
								key={tip.key}
								className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
							>
								<div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400 dark:text-ink-400">
									{tip.icon}
								</div>
								<span className="truncate">
									{isHindi ? tip.labelHi : tip.labelEn}:{" "}
									<span className="font-bold text-pink-500">
										+{tip.weight}%
									</span>
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

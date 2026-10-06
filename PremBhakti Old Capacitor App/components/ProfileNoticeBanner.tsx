import { AlertTriangle, ChevronRight, UserPlus } from "lucide-react";
import type React from "react";
import { useAuth } from "../context/AuthContext";
import { triggerHaptic } from "../utils/haptic";
import { rejectionAlerts } from "../utils/reviewAlerts";

const SHOWN = 3;

/**
 * Top of Home: the devotee's profile, or a family member they added by hand,
 * was sent back by the admins (with the reason), and family link requests
 * waiting for an answer. Linked accounts' rejections are not shown here —
 * those people fix their own profile. Renders nothing when all is well.
 *
 * Warm yellow on purpose, not red: it asks for a fix, it is not an error.
 */
export const ProfileNoticeBanner: React.FC<{
	isHindi: boolean;
	onOpenProfile: () => void;
}> = ({ isHindi, onOpenProfile }) => {
	const { user, profile, pendingFamilyRequests } = useAuth();
	if (!user) return null;
	const alerts = rejectionAlerts(profile);
	if (alerts.length === 0 && pendingFamilyRequests === 0) return null;

	const open = () => {
		triggerHaptic("light");
		onOpenProfile();
	};

	return (
		<div className="w-full max-w-5xl mx-auto space-y-2">
			{alerts.length > 0 && (
				<button
					type="button"
					onClick={open}
					className="w-full text-left rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-3.5 shadow-sm active:scale-[0.99] transition"
				>
					<div className="flex items-center gap-2 mb-2">
						<span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
							<AlertTriangle size={17} />
						</span>
						<p className="flex-1 font-bold text-sm text-amber-900 dark:text-amber-200 leading-snug">
							{alerts.length === 1 && alerts[0].kind === "self"
								? isHindi
									? "आपकी प्रोफ़ाइल में सुधार ज़रूरी है"
									: "Your profile needs changes"
								: isHindi
									? "प्रोफ़ाइल में सुधार ज़रूरी है"
									: "Profile changes needed"}
						</p>
					</div>
					<ul className="space-y-1.5">
						{alerts.slice(0, SHOWN).map((a) => (
							<li
								key={a.memberId || "self"}
								className="text-[13px] leading-snug text-amber-900/90 dark:text-amber-100/90"
							>
								<b>
									{a.kind === "self"
										? isHindi
											? "आपकी प्रोफ़ाइल"
											: "Your profile"
										: isHindi
											? `${a.name || "परिवार सदस्य"} (परिवार सदस्य)`
											: `${a.name || "Family member"} (family member)`}
								</b>
								{a.note ? (
									<>
										{isHindi ? " — कारण: " : " — reason: "}
										<span className="italic">“{a.note}”</span>
									</>
								) : isHindi ? (
									" — स्वीकार नहीं हुई"
								) : (
									" — not approved"
								)}
							</li>
						))}
						{alerts.length > SHOWN && (
							<li className="text-[12px] text-amber-800/80 dark:text-amber-200/70">
								{isHindi
									? `+${alerts.length - SHOWN} और`
									: `+${alerts.length - SHOWN} more`}
							</li>
						)}
					</ul>
					<span className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300">
						{isHindi ? "प्रोफ़ाइल खोलकर ठीक करें" : "Open profile to fix"}
						<ChevronRight size={14} />
					</span>
				</button>
			)}

			{pendingFamilyRequests > 0 && (
				<button
					type="button"
					onClick={open}
					className="w-full flex items-center gap-3 text-left rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3 shadow-sm active:scale-[0.99] transition"
				>
					<span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
						<UserPlus size={16} />
					</span>
					<span className="flex-1 min-w-0">
						<span className="block font-bold text-sm text-blue-900 dark:text-blue-100">
							{isHindi
								? `${pendingFamilyRequests} परिवार लिंक अनुरोध आया है`
								: `${pendingFamilyRequests} family link request${pendingFamilyRequests > 1 ? "s" : ""} waiting`}
						</span>
						<span className="block text-[12px] text-blue-800/80 dark:text-blue-200/70">
							{isHindi
								? "कोई आपको अपने परिवार में जोड़ना चाहते हैं — देखें और जवाब दें"
								: "Someone wants to add you to their family — see and answer"}
						</span>
					</span>
					<ChevronRight
						size={18}
						className="text-blue-500 dark:text-blue-300 shrink-0"
					/>
				</button>
			)}
		</div>
	);
};

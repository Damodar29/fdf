import { User } from "lucide-react";
import type React from "react";
import { useAuth } from "../context/AuthContext";
import { rejectionAlerts } from "../utils/reviewAlerts";
import { ThumbImg } from "./ui/ThumbImg";

/**
 * What goes inside a profile button: the devotee's photo (or a User icon),
 * the family-request count and the review-status dot. Shared by the phone
 * header (JanmashtamiHeader) and the floating desktop/landscape buttons on
 * Home, so both always show the same thing. The parent button must be
 * `relative` — the badges are positioned against it.
 */
export const ProfileButtonIcon: React.FC<{
	/** Classes for the User icon shown when there is no photo. */
	iconClassName?: string;
	/** Border colour of the photo ring; leave out for no ring. */
	photoBorderClassName?: string;
	/** Size of the photo (default matches the 24 px icon). */
	photoSizeClassName?: string;
	/** Border around the badges, matching the button's background. */
	badgeRingClassName: string;
	/** Where the review-status dot sits, and its size. */
	statusDotClassName?: string;
	/** Where the family-request count sits. */
	requestBadgePositionClassName?: string;
}> = ({
	iconClassName,
	photoBorderClassName,
	photoSizeClassName = "w-6 h-6",
	badgeRingClassName,
	statusDotClassName = "top-1.5 right-1.5 w-2.5 h-2.5",
	requestBadgePositionClassName = "top-0.5 left-0.5",
}) => {
	const { user, profile, pendingFamilyRequests } = useAuth();
	// Their own profile or a family member they added was rejected (linked
	// accounts don't count — those people fix their own profile).
	const needsFix = rejectionAlerts(profile).length > 0;

	return (
		<>
			{profile?.photoURL ? (
				// Only show custom-uploaded photo (no Google account photo fallback)
				<ThumbImg
					src={profile.photoURL}
					alt=""
					className={`${photoSizeClassName} rounded-full object-cover ${photoBorderClassName ? `border ${photoBorderClassName}` : ""}`}
				/>
			) : (
				<User size={24} strokeWidth={2} className={iconClassName} />
			)}
			{pendingFamilyRequests > 0 && (
				// Family link requests waiting for an answer.
				<span
					className={`absolute ${requestBadgePositionClassName} min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-4 text-center border ${badgeRingClassName}`}
				>
					{pendingFamilyRequests > 9 ? "9+" : pendingFamilyRequests}
				</span>
			)}
			{user && (
				<span
					className={`absolute ${statusDotClassName} rounded-full border-2 ${badgeRingClassName} ${
						needsFix
							? "bg-red-500 animate-pulse"
							: profile?.isApproved
								? "bg-success"
								: "bg-gold-300 animate-pulse"
					}`}
				/>
			)}
		</>
	);
};

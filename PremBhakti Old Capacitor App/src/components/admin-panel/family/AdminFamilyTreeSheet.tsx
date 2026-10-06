import type React from "react";
import { useMemo, useState } from "react";
import { FamilyTreeView } from "../../../../components/profile/FamilyTreeView";
import { useToast } from "../../../../context/ToastContext";
import {
	familyTreeFor,
	type NetworkProfile,
} from "../../../../utils/familyNetwork";
import { useAdminBack } from "../../../hooks/useAdminBack";
import { usePopupBackHandler } from "../../../hooks/usePopupBackHandler";
import {
	type DevoteeEditTarget,
	EditProfileButton,
	useOpenDevoteeEdit,
} from "../devoteeEditLink";

/**
 * Admin: any devotee's family tree, as they see it in their own Profile.
 * Tapping a linked person shows the tree from that person's side; back (or
 * the arrow) returns to the previous person. "Edit" in the header, or a tap
 * on someone added by hand, closes the tree and opens that profile's edit
 * screen.
 */
export const AdminFamilyTreeSheet: React.FC<{
	/** Whose tree to open; null = closed. */
	startUid: string | null;
	profiles: NetworkProfile[];
	isHindi: boolean;
	onClose: () => void;
	/**
	 * Opens an edit screen. Devotee Management passes its own (the tree sits
	 * on its edit screen); elsewhere the Admin Panel's is used.
	 */
	onOpenProfile?: (target: DevoteeEditTarget) => void;
	/** After an edit screen opened from here closes (reload if `changed`). */
	onProfileClosed?: (changed: boolean) => void;
}> = ({
	startUid,
	profiles,
	isHindi,
	onClose,
	onOpenProfile,
	onProfileClosed,
}) => {
	const { showToast } = useToast();
	const openFromPanel = useOpenDevoteeEdit();
	const openProfile =
		onOpenProfile ||
		(openFromPanel
			? (t: DevoteeEditTarget) => openFromPanel(t, onProfileClosed)
			: null);
	// People viewed since opening, the current one last.
	const [trail, setTrail] = useState<string[]>([]);
	const [openedFor, setOpenedFor] = useState<string | null>(null);
	if (startUid !== openedFor) {
		setOpenedFor(startUid);
		setTrail(startUid ? [startUid] : []);
	}
	const open = !!startUid && trail.length > 0;
	const close = usePopupBackHandler(open, "admin-family-tree", onClose);
	const goBack = () => setTrail((t) => t.slice(0, -1));
	// Back steps to the previous person before closing the tree.
	useAdminBack(open && trail.length > 1, goBack);

	const byUid = useMemo(
		() => new Map(profiles.map((p) => [p.uid, p])),
		[profiles],
	);
	const current = trail[trail.length - 1];
	const tree = useMemo(
		() => (current ? familyTreeFor(current, byUid) : null),
		[current, byUid],
	);
	if (!open || !tree) return null;

	const name = tree.me.name || (isHindi ? "भक्त" : "Devotee");
	/** Close the tree, then open `target`'s edit screen. */
	const edit = (target: DevoteeEditTarget) => {
		if (!openProfile) return;
		close();
		openProfile(target);
	};
	return (
		<FamilyTreeView
			key={current}
			isHindi={isHindi}
			me={tree.me}
			people={tree.people}
			onClose={() => close()}
			onBack={trail.length > 1 ? goBack : undefined}
			headerAction={
				onOpenProfile ? (
					<button
						type="button"
						onClick={() => edit({ uid: current })}
						className="shrink-0 min-h-touch px-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold active:scale-95"
					>
						{isHindi ? "एडिट" : "Edit"}
					</button>
				) : (
					<EditProfileButton
						target={{ uid: current }}
						isHindi={isHindi}
						name={name}
						before={() => close()}
						onClosed={onProfileClosed}
					/>
				)
			}
			labels={{
				title: isHindi ? `${name} का परिवार` : `${name}'s family`,
				me: isHindi ? "इनकी ओर से" : "Viewing as",
				ownGeneration: isHindi ? `${name} की पीढ़ी` : `${name}'s generation`,
				tapHint: openProfile
					? isHindi
						? "लिंक्ड व्यक्ति पर दबाकर उनकी ओर से वृक्ष देखें; हाथ से जोड़े सदस्य पर दबाकर उनकी प्रोफाइल एडिट करें।"
						: "Tap a linked person to see the tree from their side; tap someone added by hand to edit them."
					: isHindi
						? "लिंक्ड व्यक्ति पर दबाकर उनकी ओर से वृक्ष देखें।"
						: "Tap a linked person to see the tree from their side.",
			}}
			onPersonTap={(person) => {
				if (!person.key.startsWith("l_")) {
					// Hand-added members are "m_<id>" in the current person's list.
					if (openProfile && person.key.startsWith("m_")) {
						edit({ uid: current, memberId: person.key.slice(2) });
						return;
					}
					showToast(
						isHindi
							? "यह सदस्य हाथ से जोड़ा गया है — इनका अपना अकाउंट नहीं है"
							: "Added by hand — they have no account of their own",
						"info",
					);
					return;
				}
				const uid = person.key.slice(2);
				if (!byUid.has(uid)) return;
				setTrail((t) => [...t, uid]);
			}}
		/>
	);
};

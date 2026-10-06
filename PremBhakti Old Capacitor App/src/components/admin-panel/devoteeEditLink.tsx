import { Pencil } from "lucide-react";
import type React from "react";
import { createContext, useContext } from "react";

/** A devotee's own profile, or one family member they added by hand. */
export type DevoteeEditTarget = { uid: string; memberId?: string };

/**
 * Opens Devotee Management's edit screen for `target` on top of the current
 * admin screen; closing it returns to where the admin was. `onClosed` gets
 * `changed` = the users list changed meanwhile (reload what you show).
 */
export type OpenDevoteeEdit = (
	target: DevoteeEditTarget,
	onClosed?: (changed: boolean) => void,
) => void;

export const DevoteeEditContext = createContext<OpenDevoteeEdit | null>(null);

/** Null outside the Admin Panel (e.g. a test harness): hide edit links then. */
export const useOpenDevoteeEdit = () => useContext(DevoteeEditContext);

/**
 * Small "Edit" button next to a devotee's name anywhere in the admin panel.
 * Renders nothing when there is no edit screen to open.
 */
export const EditProfileButton: React.FC<{
	target: DevoteeEditTarget;
	isHindi: boolean;
	/** Whose profile, for screen readers. */
	name?: string;
	onClosed?: (changed: boolean) => void;
	/** Runs first, e.g. to close the popup the button sits in. */
	before?: () => void;
	/** Icon only (list rows); otherwise icon + "Edit". */
	iconOnly?: boolean;
	className?: string;
}> = ({ target, isHindi, name, onClosed, before, iconOnly, className }) => {
	const open = useOpenDevoteeEdit();
	if (!open) return null;
	const label = isHindi
		? `${name ? `${name} की ` : ""}प्रोफाइल एडिट करें`
		: `Edit ${name ? `${name}'s ` : ""}profile`;
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				before?.();
				open(target, onClosed);
			}}
			title={label}
			aria-label={label}
			className={
				className ||
				(iconOnly
					? "shrink-0 min-w-touch min-h-touch flex items-center justify-center rounded-full text-blue-500 dark:text-blue-400 active:bg-blue-50 dark:active:bg-blue-900/20"
					: "shrink-0 min-h-touch px-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5 active:scale-95")
			}
		>
			<Pencil size={iconOnly ? 16 : 14} />
			{!iconOnly && (isHindi ? "एडिट" : "Edit")}
		</button>
	);
};

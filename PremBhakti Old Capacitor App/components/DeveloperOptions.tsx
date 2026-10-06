import { Database, Settings as SettingsIcon } from "lucide-react";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import type { Bhajan, Book, EventData, LectureData } from "../types";

// The admin CMS is ~26k lines that only admins ever open. Loading it lazily
// keeps it out of the chunk every devotee downloads and parses with Settings.
const AdminPanel = React.lazy(() =>
	import("./AdminPanel").then((m) => ({ default: m.AdminPanel })),
);

const AdminPanelLoading = () => (
	<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-100 dark:bg-slate-900">
		<div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
	</div>
);

interface DeveloperOptionsProps {
	onAddBhajan?: () => void;
	onResetData?: () => void;
	onImportData?: (json: string) => boolean;
	allBhajans: Bhajan[];
	allBooks?: Book[];
	books?: Book[];
	allLectures?: LectureData[];
	lectures?: LectureData[];
	events?: EventData[];
	onUpdateBhajans?: (data: Bhajan[]) => void;
	onUpdateBooks?: (data: Book[]) => void;
	onUpdateLectures?: (data: LectureData[]) => void;
	onUpdateEvents?: (data: EventData[]) => void;
	settingsLanguage: "en" | "hi";
	autoOpen?: boolean;
	onAdminPanelToggle?: (isOpen: boolean) => void;
	adminPanelRef?: React.RefObject<{ popScreen: () => boolean }>;
}

export const DeveloperOptions: React.FC<DeveloperOptionsProps> = ({
	allBhajans,
	allBooks,
	books,
	allLectures,
	lectures,
	events,
	onUpdateBhajans,
	onUpdateBooks,
	onUpdateLectures,
	onUpdateEvents,
	settingsLanguage,
	autoOpen,
	onAdminPanelToggle,
	adminPanelRef,
}) => {
	const [showAdminPanel, setShowAdminPanel] = useState(false);

	React.useEffect(() => {
		if (onAdminPanelToggle) {
			onAdminPanelToggle(showAdminPanel);
		}
	}, [showAdminPanel, onAdminPanelToggle]);

	React.useEffect(() => {
		if (autoOpen) {
			setShowAdminPanel(true);
		}
	}, [autoOpen]);

	// Translations internal to this component
	const t = {
		en: {
			devSectionTitle: "Data Management",
			devSectionDesc:
				"Manage content including Audio Links, Books, and Lectures.",
			openContentManager: "Open Content Manager",
		},
		hi: {
			devSectionTitle: "डेटा प्रबंधन",
			devSectionDesc: "ऑडियो लिंक, किताबें और प्रवचन प्रबंधित करें।",
			openContentManager: "कंटेंट मैनेजर खोलें",
		},
	}[settingsLanguage];

	const handleOpenManager = () => {
		setShowAdminPanel(true);
	};

	const handleCloseAdminPanel = () => {
		setShowAdminPanel(false);
	};

	return (
		<>
			<div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-saffron-200 dark:border-slate-700 overflow-hidden animate-fade-in-up">
				<div className="bg-saffron-50 dark:bg-slate-800/80 p-3 border-b border-saffron-100 dark:border-slate-700">
					<h3 className="text-xs font-bold text-saffron-700 dark:text-saffron-400 uppercase tracking-wider flex items-center gap-2">
						<Database size={14} /> {t.devSectionTitle}
					</h3>
				</div>
				<div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700">
					{t.devSectionDesc}
				</div>

				{/* Main Content Manager Trigger */}
				<button
					onClick={handleOpenManager}
					className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition-colors border-b border-slate-100 dark:border-slate-700"
				>
					<SettingsIcon size={18} /> {t.openContentManager}
				</button>
			</div>

			{/* Admin Panel Modal — portaled to <body> so its `fixed inset-0` overlay
			    escapes the Settings screen's animated (transformed) wrapper, which
			    would otherwise become its containing block and confine it below
			    the Settings header instead of covering the full viewport. */}
			{showAdminPanel &&
				createPortal(
					<React.Suspense fallback={<AdminPanelLoading />}>
						<AdminPanel
							isOpen={showAdminPanel}
							onClose={handleCloseAdminPanel}
							bhajans={allBhajans || []}
							allBooks={allBooks || books || []}
							allLectures={allLectures || lectures || []}
							events={events || []}
							settingsLanguage={settingsLanguage}
							onUpdateBhajans={onUpdateBhajans || (() => {})}
							onUpdateBooks={onUpdateBooks || (() => {})}
							onUpdateLectures={onUpdateLectures || (() => {})}
							onUpdateEvents={onUpdateEvents || (() => {})}
							ref={adminPanelRef}
						/>
					</React.Suspense>,
					document.body,
				)}
		</>
	);
};

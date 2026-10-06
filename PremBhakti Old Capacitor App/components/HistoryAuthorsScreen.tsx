import { History, Info, Languages, Users, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../context/DataContext";
import type {
	Bhajan,
	BhajanAudio,
	Book,
	HistoryEntry,
	LectureData,
	ScriptType,
} from "../types";
import { useTourUiAction } from "../src/tour/tourBus";
import { triggerHaptic } from "../utils/haptic";
import { BackupRestoreSection } from "./BackupRestoreSection";
import { CategoryList } from "./CategoryList";
import { HistoryList } from "./HistoryList";

interface HistoryAuthorsScreenProps {
	// History Props
	historyItems: HistoryEntry[];
	books: Book[];
	lectures: LectureData[];
	bhajans: Bhajan[];
	onClearHistory: () => void;
	onOpenBook: (book: Book) => void;
	onOpenLecture: (
		lecture: LectureData,
		targetTrack?: BhajanAudio,
		contextQueue?: BhajanAudio[],
	) => void;
	onOpenBhajan: (
		bhajan: Bhajan,
		contextQueue?: BhajanAudio[],
		queueName?: string,
	) => void;

	// Settings
	script: ScriptType;
	searchQuery: string;
	scrollBarSide?: "left" | "right";

	// Language
	settingsLanguage: "en" | "hi";
	onSettingsLanguageChange: (lang: "en" | "hi") => void;
}

type LibraryTab = "history" | "authors";
type InfoType = "backup" | "restore";

export const HistoryAuthorsScreen: React.FC<HistoryAuthorsScreenProps> = ({
	historyItems,
	books,
	lectures,
	bhajans,
	onClearHistory,
	onOpenBook,
	onOpenLecture,
	onOpenBhajan,
	script,
	searchQuery,
	scrollBarSide = "left",
	settingsLanguage,
	onSettingsLanguageChange,
}) => {
	const { backupUserData, restoreUserData } = useData();
	const [activeTab, setActiveTab] = useState<LibraryTab>("history");
	const [animDirection, setAnimDirection] = useState<"left" | "right" | "none">(
		"none",
	);

	const [activeInfoType, setActiveInfoType] = useState<InfoType | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (activeInfoType) {
			const id = `info-lib-${Date.now()}`;
			window.history.pushState({ isPopup: true, modalId: id }, "");
			const handler = () => setActiveInfoType(null);
			window.addEventListener("popstate", handler);
			return () => {
				window.removeEventListener("popstate", handler);
				if (window.history.state?.modalId === id) window.history.back();
			};
		}
	}, [activeInfoType]);

	// Translations
	const t = {
		history: settingsLanguage === "hi" ? "इतिहास" : "History",
		authors: settingsLanguage === "hi" ? "रचयिता" : "Authors",

		backupRestore:
			settingsLanguage === "hi" ? "बैकअप और रिस्टोर" : "Backup & Restore",
		backupData: settingsLanguage === "hi" ? "डेटा बैकअप" : "Backup Data",
		savePlaylists:
			settingsLanguage === "hi"
				? "प्लेलिस्ट और संपादन सहेजें"
				: "Save Playlists & Edits",
		restoreData: settingsLanguage === "hi" ? "डेटा रिस्टोर" : "Restore Data",
		importBackup:
			settingsLanguage === "hi" ? "बैकअप फ़ाइल आयात करें" : "Import Backup File",
		close: settingsLanguage === "hi" ? "बंद करें" : "Close",

		backupInfoTitle:
			settingsLanguage === "hi" ? "बैकअप जानकारी" : "Backup Information",
		backupInfoContent:
			settingsLanguage === "hi"
				? "यह सुविधा एक सुरक्षित बैकअप फ़ाइल बनाती है जिसमें शामिल हैं:\n\n• आपकी बनाई गई प्लेलिस्ट\n• ऐप सेटिंग्स\n• आपके द्वारा संपादित/व्यक्तिगत किए गए भजन\n\nफ़ाइल आपके डिवाइस के 'Documents' फ़ोल्डर में सहेजी जाएगी।"
				: "This feature creates a secure backup file containing:\n\n• Your created Playlists\n• App Settings\n• Bhajans you have personalized/edited\n\nThe file will be saved to your device's Documents folder (or prompted to share/save via system dialog).",

		restoreInfoTitle:
			settingsLanguage === "hi" ? "रिस्टोर जानकारी" : "Restore Information",
		restoreInfoContent:
			settingsLanguage === "hi"
				? "अपने डिवाइस स्टोरेज से पहले बनाई गई CPBS बैकअप फ़ाइल (.json) चुनें:\n\n• प्लेलिस्ट और सेटिंग्स\n• आपके व्यक्तिगत/संपादित भजन\n\nनोट: यह डेटा मर्ज करता है, लेकिन यदि बैकअप नया है तो मौजूदा स्थानीय संपादन ओवरराइट हो सकते हैं।"
				: "Select a previously created CPBS Backup file (.json) from your device storage to restore:\n\n• Playlists & Settings\n• Your personalized/edited Bhajans\n\nNote: This merges data, but existing local edits might be overwritten if the backup is newer.",
	};

	const getInfoContent = () => {
		if (activeInfoType === "backup") {
			return { title: t.backupInfoTitle, content: t.backupInfoContent };
		}
		if (activeInfoType === "restore") {
			return { title: t.restoreInfoTitle, content: t.restoreInfoContent };
		}
		return { title: "", content: "" };
	};

	const scrollPositions = useRef<Record<LibraryTab, number>>({
		history: 0,
		authors: 0,
	});

	const tabs: LibraryTab[] = ["history", "authors"];

	const handleTabChange = (tab: LibraryTab) => {
		if (tab === activeTab) return;

		// Save current scroll position
		const scrollContainer = document.querySelector(".scroll-container");
		if (scrollContainer) {
			scrollPositions.current[activeTab] = scrollContainer.scrollTop;
		}

		const currentIndex = tabs.indexOf(activeTab);
		const newIndex = tabs.indexOf(tab);
		setAnimDirection(newIndex > currentIndex ? "right" : "left");
		setActiveTab(tab);
	};

	// The guided tour shows the Authors tab for one step, then comes back.
	useTourUiAction((action) => {
		if (action.type === "library-tab") handleTabChange(action.tab);
	});

	useEffect(() => {
		// Restore scroll position when activeTab changes
		const scrollContainer = document.querySelector(".scroll-container");
		if (scrollContainer) {
			// Use setTimeout to ensure DOM has rendered the new tab content before scrolling
			setTimeout(() => {
				scrollContainer.scrollTo({
					top: scrollPositions.current[activeTab],
					behavior: "instant",
				});
			}, 10);
		}
	}, [activeTab]);

	const _handleRestoreClick = () => {
		fileInputRef.current?.click();
	};

	const _handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			if (content) {
				restoreUserData(content);
			}
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	return (
		<div className="flex flex-col h-full bg-transparent">
			{/* Top Tabs */}
			<div
				className="flex bg-transparent backdrop-blur-md border-b border-saffron-200 dark:border-slate-700 sticky top-0 z-20 items-center overflow-x-auto no-scrollbar"
				data-tour="library-tabs"
			>
				<div className="flex-1 flex w-full">
					<TabButton
						active={activeTab === "history"}
						onClick={() => handleTabChange("history")}
						label={t.history}
						icon={<History size={18} />}
					/>
					<TabButton
						active={activeTab === "authors"}
						onClick={() => handleTabChange("authors")}
						label={t.authors}
						icon={<Users size={18} />}
					/>
				</div>
			</div>

			<div
				className={`flex-1 overflow-y-auto ${scrollBarSide === "left" ? "left-scrollbar" : ""}`}
			>
				<div
					key={activeTab}
					className={
						animDirection === "right"
							? "animate-slide-in-right"
							: animDirection === "left"
								? "animate-slide-in-left"
								: ""
					}
				>
					{activeTab === "history" && (
						<div className="pb-8">
							{/* Backup & Restore Section */}
							<BackupRestoreSection settingsLanguage={settingsLanguage} />

							<HistoryList
								historyItems={historyItems}
								books={books}
								lectures={lectures}
								bhajans={bhajans}
								onClearHistory={onClearHistory}
								onOpenBook={onOpenBook}
								onOpenLecture={onOpenLecture}
								onOpenBhajan={onOpenBhajan}
								script={script}
								searchQuery={searchQuery}
								settingsLanguage={settingsLanguage}
							/>
						</div>
					)}
					{activeTab === "authors" && (
						<CategoryList
							bhajans={bhajans.filter(
								(b) =>
									!searchQuery ||
									b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
									b.titleIAST
										?.toLowerCase()
										.includes(searchQuery.toLowerCase()) ||
									b.firstLine
										?.toLowerCase()
										.includes(searchQuery.toLowerCase()) ||
									b.firstLineIAST
										?.toLowerCase()
										.includes(searchQuery.toLowerCase()),
							)}
							onSelect={(b) => {
								const contextQueue: BhajanAudio[] = [];
								bhajans.forEach((bhajan) => {
									if (bhajan.audio && bhajan.audio.length > 0) {
										contextQueue.push({
											...bhajan.audio[0],
											bhajanTitle: bhajan.title,
											parentBhajan: bhajan,
										});
									}
								});
								onOpenBhajan(
									b,
									contextQueue.length > 0 ? contextQueue : undefined,
									"Authors List",
								);
							}}
							script={script}
						/>
					)}
				</div>
			</div>

			{/* Info Modal */}
			{activeInfoType &&
				createPortal(
					<div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
						<div className="bg-saffron-50/50 dark:bg-slate-800 w-full max-w-xs landscape:max-w-md rounded-3xl p-6 shadow-2xl relative border border-saffron-200 dark:border-slate-700 animate-in zoom-in-95 landscape:max-h-[90vh] overflow-y-auto">
							<button
								onClick={() => setActiveInfoType(null)}
								className="absolute top-4 right-4 p-2 text-slate-400 dark:text-ink-400 hover:text-saffron-600 bg-white dark:bg-slate-700 rounded-full shadow-sm transition-colors"
							>
								<X size={18} />
							</button>
							<div className="flex flex-col items-center text-center mt-2">
								<div className="w-14 h-14 bg-saffron-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-saffron-600 mb-4 border border-saffron-200">
									<Info size={28} />
								</div>

								<h3 className="text-xl font-bold text-saffron-600 mb-3">
									{getInfoContent().title}
								</h3>

								<button
									onClick={() => {
										triggerHaptic("light");
										onSettingsLanguageChange(
											settingsLanguage === "en" ? "hi" : "en",
										);
									}}
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-saffron-100 dark:bg-slate-700 text-saffron-600 hover:bg-saffron-200 transition-colors mb-5"
								>
									<Languages size={14} />
									<span className="text-xs font-bold uppercase">
										{settingsLanguage === "en"
											? "Switch to Hindi"
											: "Switch to English"}
									</span>
								</button>

								<div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-left bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-saffron-200 shadow-inner w-full">
									{getInfoContent().content}
								</div>
								<button
									onClick={() => setActiveInfoType(null)}
									className="mt-6 w-full py-3 bg-saffron-500 hover:brightness-110 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
								>
									{t.close}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
};

const TabButton = ({
	active,
	onClick,
	label,
	icon,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	icon: React.ReactNode;
}) => (
	<button
		onClick={onClick}
		className={`flex-1 py-2 sm:py-3.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm font-bold border-b-[3px] transition-all ${active ? "border-saffron-500 text-saffron-600 bg-saffron-50 dark:bg-slate-800" : "border-transparent text-slate-400 dark:text-ink-400 hover:text-saffron-600 hover:bg-saffron-50 dark:hover:text-saffron-500"}`}
	>
		{icon} <span>{label}</span>
	</button>
);

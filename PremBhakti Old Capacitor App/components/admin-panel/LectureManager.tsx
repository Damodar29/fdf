import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Edit2,
	Eye,
	EyeOff,
	Plus,
	RefreshCw,
	Save,
	Search,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { InterruptedWriteBanner } from "../../src/components/admin-panel/InterruptedWriteBanner";
import { ProcessingBlockerModal } from "../../src/components/admin-panel/ProcessingBlockerModal";
import { usePopupBackHandler } from "../../src/hooks/usePopupBackHandler";
import {
	rebuildLectureBundle,
	saveLectureToFirebase,
} from "../../src/utils/githubLectureStorage";
import type { BhajanAudio, LectureData } from "../../types";
import { validateAndFormatUrl } from "../../utils/url";
import { B2UploadButton } from "./B2UploadButton";

export const LectureManager: React.FC<{
	allLectures: LectureData[];
	onUpdateList: (list: LectureData[]) => void;
	showToast: (text: string, type?: "success" | "error") => void;
	settingsLanguage?: "en" | "hi";
}> = ({ allLectures, onUpdateList, showToast, settingsLanguage = "hi" }) => {
	const [draft, setDraft] = useState<LectureData | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [progressMsg, setProgressMsg] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [isRebuilding, setIsRebuilding] = useState(false);
	const [rebuildStatus, setRebuildStatus] = useState<{
		ok: boolean;
		msg: string;
	} | null>(null);
	const [rebuildProgressMsg, setRebuildProgressMsg] = useState("");

	const closeDraft = usePopupBackHandler(!!draft, "lecture-mgr-editor", () =>
		setDraft(null),
	);

	const isHindi = settingsLanguage === "hi";
	const t = {
		addLecture: isHindi ? "प्रवचन जोड़ें" : "Add Lecture",
		editLecture: isHindi ? "प्रवचन संपादित करें" : "Edit Lecture",
		title: isHindi ? "शीर्षक" : "Title",
		date: isHindi ? "दिनांक" : "Date",
		description: isHindi ? "विवरण" : "Description",
		audioTracks: isHindi ? "ऑडियो ट्रैक्स" : "Audio Tracks",
		addAudio: isHindi ? "+ ऑडियो जोड़ें" : "+ Add Audio",
		speakerName: isHindi ? "वक्ता का नाम" : "Speaker Name",
		audioUrl: isHindi ? "ऑडियो यूआरएल" : "Audio URL",
		saveCloud: isHindi ? "Cloud पर सहेजें" : "Save to Cloud",
		lecturesCount: isHindi ? "प्रवचन" : "Lectures",
		addNew: isHindi ? "नया जोड़ें" : "Add New",
		back: isHindi ? "पीछे" : "Back",
		noDate: isHindi ? "कोई दिनांक नहीं" : "No Date",
		tracks: isHindi ? "ट्रैक्स" : "Tracks",
		hide: isHindi ? "Cloud से छुपाएं" : "Hide from Cloud",
		restore: isHindi ? "पुनः दिखाएं" : "Restore",
		hidden: isHindi ? "छुपा हुआ" : "Hidden",
		searchPlaceholder: isHindi ? "प्रवचन खोजें..." : "Search lectures...",
	};

	const _filteredLectures = useMemo(() => {
		if (!searchQuery.trim()) return allLectures;
		const q = searchQuery.toLowerCase();
		return allLectures.filter(
			(l) =>
				l.title.toLowerCase().includes(q) ||
				(l.description || "").toLowerCase().includes(q) ||
				l.id.toLowerCase().includes(q),
		);
	}, [allLectures, searchQuery]);

	const handleRebuildBundle = async () => {
		setIsRebuilding(true);
		setRebuildStatus(null);
		setRebuildProgressMsg("Starting rebuild...");
		try {
			const result = await rebuildLectureBundle((msg) =>
				setRebuildProgressMsg(msg),
			);
			const failMsg =
				result.failed.length > 0
					? ` (${result.failed.length} failed: ${result.failed.join(", ")})`
					: "";
			setRebuildStatus({
				ok: true,
				msg: `✅ Rebuilt bundle with ${result.rebuilt} lectures!${failMsg} Now press Force Sync.`,
			});
			showToast(
				`Bundle rebuilt with ${result.rebuilt} lectures! Now do Force Sync.`,
				"success",
			);
		} catch (e: any) {
			setRebuildStatus({ ok: false, msg: `❌ Failed: ${e.message}` });
			showToast(`Rebuild failed: ${e.message}`, "error");
		} finally {
			setIsRebuilding(false);
			setRebuildProgressMsg("");
		}
	};

	const startEdit = (lecture?: LectureData) => {
		if (lecture) {
			setDraft({ ...lecture });
		} else {
			const existingIds = new Set(
				allLectures
					.map((l) => parseInt(l.id, 10))
					.filter((num) => !Number.isNaN(num) && num > 0),
			);
			let nextIdNum = 1;
			while (existingIds.has(nextIdNum)) {
				nextIdNum++;
			}
			const newId = String(nextIdNum).padStart(3, "0");
			setDraft({ id: newId, title: "", description: "", audio: [] });
		}
	};

	const saveToCloud = async (lectureToSave: LectureData) => {
		if (!lectureToSave.title) {
			showToast("Title is required", "error");
			return;
		}

		// Safeguard against ID collision
		const isNew = !allLectures.find((l) => l.id === draft?.id);
		if (isNew && allLectures.some((l) => l.id === lectureToSave.id)) {
			showToast(
				`Error: Lecture ID #${lectureToSave.id} already exists!`,
				"error",
			);
			return;
		}

		// Validate all audio URLs
		let hasInvalidUrl = false;
		const validatedAudio = lectureToSave.audio?.map((track) => {
			const validUrl = validateAndFormatUrl(track.url);
			if (validUrl === null) hasInvalidUrl = true;
			return { ...track, url: validUrl || track.url };
		});

		if (hasInvalidUrl) {
			showToast("Please enter valid URLs for all audio tracks.", "error");
			return;
		}

		const finalLecture = { ...lectureToSave, audio: validatedAudio };
		setIsSaving(true);
		try {
			// Build newList first (local source of truth) to avoid stale cloud read
			const exists = allLectures.find((l) => l.id === finalLecture.id);
			const newList = exists
				? allLectures.map((l) => (l.id === finalLecture.id ? finalLecture : l))
				: [...allLectures, finalLecture];

			// Pass newList so cloud bundle uses local state (avoids race condition)
			await saveLectureToFirebase(finalLecture, setProgressMsg, newList);
			onUpdateList(newList);
			localStorage.setItem("cpbs_all_lectures", JSON.stringify(newList));
			showToast("Lecture saved to Cloud!", "success");
			setDraft(null);
		} catch (e: any) {
			showToast(`Failed to save: ${e.message}`, "error");
		} finally {
			setIsSaving(false);
			setProgressMsg("");
		}
	};

	const toggleVisibility = async (lecture: LectureData) => {
		const updated = { ...lecture, isHidden: !lecture.isHidden };
		setIsSaving(true);
		try {
			// Build newList before cloud save so we pass authoritative bundle base
			const newList = allLectures.map((l) =>
				l.id === updated.id ? updated : l,
			);
			// Pass newList so cloud bundle uses local state (avoids race condition)
			await saveLectureToFirebase(updated, setProgressMsg, newList);
			onUpdateList(newList);
			localStorage.setItem("cpbs_all_lectures", JSON.stringify(newList));
			showToast(
				updated.isHidden ? "Lecture hidden from users." : "Lecture restored!",
				"success",
			);
			if (draft?.id === updated.id) setDraft(updated);
		} catch (e: any) {
			showToast(`Failed to update visibility: ${e.message}`, "error");
		} finally {
			setIsSaving(false);
			setProgressMsg("");
		}
	};

	const addAudioToDraft = () => {
		if (!draft) return;
		setDraft({
			...draft,
			audio: [
				...(draft.audio || []),
				{ id: `aud-${Date.now()}`, singer: "", url: "" },
			],
		});
	};

	const updateAudioInDraft = (
		idx: number,
		field: keyof BhajanAudio,
		val: string,
	) => {
		if (!draft?.audio) return;
		const newAudio = [...draft.audio];
		newAudio[idx] = { ...newAudio[idx], [field]: val };
		setDraft({ ...draft, audio: newAudio });
	};

	const removeAudioFromDraft = (idx: number) => {
		if (!draft?.audio) return;
		setDraft({ ...draft, audio: draft.audio.filter((_, i) => i !== idx) });
	};

	const moveAudioInDraft = (idx: number, dir: "up" | "down") => {
		if (!draft?.audio) return;
		const newAudio = [...draft.audio];
		if (dir === "up" && idx > 0) {
			[newAudio[idx - 1], newAudio[idx]] = [newAudio[idx], newAudio[idx - 1]];
		} else if (dir === "down" && idx < newAudio.length - 1) {
			[newAudio[idx + 1], newAudio[idx]] = [newAudio[idx], newAudio[idx + 1]];
		}
		setDraft({ ...draft, audio: newAudio });
	};

	// --- EDITOR ---
	if (draft) {
		return (
			<>
				<div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right">
					{/* Toolbar */}
					<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
						<button
							onClick={closeDraft}
							disabled={isSaving}
							className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors active:scale-95 disabled:opacity-50"
						>
							<ArrowLeft size={18} /> {t.back}
						</button>
						<div className="flex gap-2 items-center">
							{/* Hide/Restore toggle — only for existing lectures */}
							{allLectures.find((l) => l.id === draft.id) && (
								<button
									onClick={() => toggleVisibility(draft)}
									disabled={isSaving}
									className={`p-2 rounded-full transition-colors disabled:opacity-50 ${draft.isHidden ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20" : "text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:bg-slate-700"}`}
									title={draft.isHidden ? t.restore : t.hide}
								>
									{draft.isHidden ? <Eye size={20} /> : <EyeOff size={20} />}
								</button>
							)}
							<button
								onClick={() => saveToCloud(draft)}
								disabled={isSaving}
								className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-sm flex items-center gap-2"
							>
								{isSaving ? (
									<>
										<span className="animate-spin text-lg">↻</span>{" "}
										{progressMsg || "Saving..."}
									</>
								) : (
									<>
										<Save size={16} /> {t.saveCloud}
									</>
								)}
							</button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
						<div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									{t.title}
								</label>
								<input
									className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
									value={draft.title}
									onChange={(e) =>
										setDraft({ ...draft, title: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									{t.date}
								</label>
								<input
									className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
									value={draft.date || ""}
									onChange={(e) => setDraft({ ...draft, date: e.target.value })}
									placeholder="YYYY-MM-DD"
								/>
							</div>
							<div>
								<label className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase block mb-1">
									{t.description}
								</label>
								<textarea
									className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 h-24 resize-none"
									value={draft.description}
									onChange={(e) =>
										setDraft({ ...draft, description: e.target.value })
									}
								/>
							</div>
						</div>

						<div className="flex justify-between items-center px-1 mb-1">
							<h4 className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider">
								{t.audioTracks}
							</h4>
							<button
								onClick={addAudioToDraft}
								className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg font-bold"
							>
								{t.addAudio}
							</button>
						</div>

						<div className="space-y-3">
							{draft.audio?.map((audio, idx) => (
								<div
									key={idx}
									className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
								>
									<div className="flex gap-2">
										<input
											className="flex-1 p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
											placeholder={t.speakerName}
											value={audio.singer}
											onChange={(e) =>
												updateAudioInDraft(idx, "singer", e.target.value)
											}
										/>
										<div className="flex gap-1 shrink-0">
											<button
												onClick={() => moveAudioInDraft(idx, "up")}
												disabled={idx === 0}
												className="p-2 text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-ink-700 disabled:opacity-30 rounded-lg"
											>
												<ChevronUp size={16} />
											</button>
											<button
												onClick={() => moveAudioInDraft(idx, "down")}
												disabled={idx === (draft.audio?.length || 0) - 1}
												className="p-2 text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-ink-700 disabled:opacity-30 rounded-lg"
											>
												<ChevronDown size={16} />
											</button>
											<button
												onClick={() => removeAudioFromDraft(idx)}
												className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
											>
												<Trash2 size={16} />
											</button>
										</div>
									</div>
									<div className="flex gap-2 mt-2">
										<input
											className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
											placeholder={t.audioUrl}
											value={audio.url}
											onChange={(e) =>
												updateAudioInDraft(idx, "url", e.target.value)
											}
										/>
										<B2UploadButton
											folderPath={`Local Data Uploaded from App/lectures/${draft.id ? `${draft.id} ` : ""}${draft.title || "Untitled"} by ${audio.singer.trim() || "Unknown"}/`}
											accept=".m4a"
											disabled={!audio.singer.trim()}
											disabledMessage="Please enter a Speaker Name or Title first!"
											onUploadComplete={(newUrl, file) => {
												updateAudioInDraft(idx, "url", newUrl);
												if (!audio.singer) {
													const nameWithoutExt = file.name.replace(
														/\.[^/.]+$/,
														"",
													);
													updateAudioInDraft(idx, "singer", nameWithoutExt);
												}
											}}
											showToast={showToast}
										/>
									</div>
									<div className="text-[10px] text-slate-500 dark:text-ink-300 mt-1">
										* Please upload .m4a files only
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
				<ProcessingBlockerModal
					isVisible={isSaving}
					viewId="lecture-save-blocker"
					title={isHindi ? "कथा सेव हो रही है…" : "Saving lecture…"}
					message={progressMsg}
					isHindi={isHindi}
				/>
			</>
		);
	}

	// --- LIST ---
	return (
		<>
			<div className="h-full flex flex-col">
				<InterruptedWriteBanner
					tag="lecturedata"
					busy={isSaving || isRebuilding}
					isHindi={isHindi}
					fixHintEn={'press "Rebuild Bundle" below'}
					fixHintHi={'नीचे "Bundle Rebuild करें" दबाएं'}
				/>
				<div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 flex gap-2">
					<div className="relative flex-1">
						<Search
							className="absolute left-3 top-2.5 text-slate-400 dark:text-ink-400"
							size={18}
						/>
						<input
							className="w-full bg-slate-100 dark:bg-slate-900 rounded-lg py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={t.searchPlaceholder}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
					<button
						onClick={() => startEdit()}
						className="bg-blue-600 text-white px-3 rounded-lg text-sm font-bold flex items-center gap-1 shadow-sm"
					>
						<Plus size={18} /> {t.addNew}
					</button>
				</div>

				{/* ── REBUILD BUNDLE (Advanced Tool) ── */}
				<div className="mx-3 mt-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
					<div className="flex items-center justify-between">
						<p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
							🔧 {isHindi ? "Advanced Tools" : "Advanced Tools"}
						</p>
						<button
							onClick={handleRebuildBundle}
							disabled={isRebuilding || isSaving}
							className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
						>
							<RefreshCw
								size={13}
								className={isRebuilding ? "animate-spin" : ""}
							/>
							{isRebuilding
								? isHindi
									? "Rebuild हो रहा है..."
									: "Rebuilding..."
								: isHindi
									? "Bundle Rebuild करें"
									: "Rebuild Bundle"}
						</button>
					</div>

					{isRebuilding && rebuildProgressMsg && (
						<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-ink-300">
							<div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0" />
							<span>{rebuildProgressMsg}</span>
						</div>
					)}

					{rebuildStatus && (
						<div
							className={`flex items-start gap-2 p-2.5 rounded-lg text-xs font-medium ${
								rebuildStatus.ok
									? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
									: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
							}`}
						>
							{rebuildStatus.ok ? (
								<CheckCircle2 size={13} className="shrink-0 mt-0.5" />
							) : (
								<AlertTriangle size={13} className="shrink-0 mt-0.5" />
							)}
							<span>{rebuildStatus.msg}</span>
						</div>
					)}
				</div>

				<div className="flex-1 overflow-y-auto p-3 space-y-3">
					{allLectures.map((lecture) => (
						<div
							key={lecture.id}
							className={`p-4 rounded-xl border flex justify-between items-center shadow-sm transition-colors ${
								lecture.isHidden
									? "bg-slate-100 dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600"
									: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
							}`}
						>
							<div className="flex-1 min-w-0 pr-4">
								<h4 className="font-bold text-slate-800 dark:text-white truncate flex items-center gap-2">
									{lecture.title}
									{lecture.isHidden && (
										<span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500 dark:text-ink-300 shrink-0">
											{t.hidden}
										</span>
									)}
								</h4>
								<div className="flex items-center gap-2 text-xs text-slate-400 dark:text-ink-400 mt-1">
									<span>{lecture.date || t.noDate}</span>
									<span>•</span>
									<span>
										{lecture.audio?.length || 0} {t.tracks}
									</span>
								</div>
							</div>
							<div className="flex gap-2 shrink-0 items-center">
								<button
									onClick={() => toggleVisibility(lecture)}
									disabled={isSaving}
									className={`p-2.5 rounded-lg transition-colors disabled:opacity-40 ${lecture.isHidden ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-ink-300"}`}
									title={lecture.isHidden ? t.restore : t.hide}
								>
									{lecture.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
								</button>
								<button
									onClick={() => startEdit(lecture)}
									className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-blue-600 dark:text-blue-400"
								>
									<Edit2 size={18} />
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
			<ProcessingBlockerModal
				isVisible={isRebuilding}
				viewId="lecture-rebuild-blocker"
				title={isHindi ? "बंडल रीबिल्ड हो रहा है…" : "Rebuilding bundle…"}
				message={rebuildProgressMsg}
				isHindi={isHindi}
			/>
			<ProcessingBlockerModal
				isVisible={isSaving}
				viewId="lecture-save-blocker"
				title={isHindi ? "कथा सेव हो रही है…" : "Saving lecture…"}
				message={progressMsg}
				isHindi={isHindi}
			/>
		</>
	);
};

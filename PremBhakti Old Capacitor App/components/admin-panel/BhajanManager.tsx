import {
	ArrowLeft,
	BookOpen,
	Check,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Edit2,
	Eye,
	EyeOff,
	FileText,
	Hash,
	Music,
	PlayCircle,
	Plus,
	RotateCcw,
	Save,
	Search,
	Trash2,
	User,
	X as XIcon,
} from "lucide-react";
import type React from "react";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useSettings } from "../../context/SettingsContext";
import { InterruptedWriteBanner } from "../../src/components/admin-panel/InterruptedWriteBanner";
import { ProcessingBlockerModal } from "../../src/components/admin-panel/ProcessingBlockerModal";
import { useAdminBack } from "../../src/hooks/useAdminBack";
import {
	BhajanSaveError,
	fetchCloudBhajanIds,
	formatSongNumber,
	isSameSongNumber,
	loadLatestBhajansIfChanged,
	saveBhajanToFirebase,
} from "../../src/utils/githubBhajanStorage";
import type { Bhajan, BhajanAudio } from "../../types";
import {
	calculateSearchScore,
	convertToIAST,
	getListFirstLine,
	smartNormalize,
	transliterateForSearch,
} from "../../utils/textProcessor";
import { validateAndFormatUrl } from "../../utils/url";
import { B2UploadButton } from "./B2UploadButton";

const DEV_WHATSAPP = "919826154640";

// The app's own reading screen, reused for "Preview" in the editor (loaded
// only when an admin opens a preview).
const BhajanReader = lazy(() =>
	import("../BhajanReader").then((m) => ({ default: m.BhajanReader })),
);

const normalizeBhajanForCloudSave = (bhajan: Bhajan): Bhajan => {
	// Strip "bhajan-" prefix from id and songNumber if present
	const rawSongNum = String(bhajan.songNumber || bhajan.id || "")
		.replace(/^bhajan-/i, "")
		.trim();
	const rawId = String(bhajan.id || "")
		.replace(/^bhajan-/i, "")
		.trim();

	const numericSongNumber = rawSongNum.replace(/\D/g, "");
	const normalizedId = numericSongNumber || rawId;

	return {
		...bhajan,
		id: normalizedId,
		songNumber: numericSongNumber || normalizedId,
	};
};

export const BhajanManager: React.FC<{
	bhajans: Bhajan[];
	searchQuery: string;
	setSearchQuery: (s: string) => void;
	selectedBhajan: Bhajan | null;
	onSelectBhajan: (b: Bhajan | null) => void;
	onUpdateList: (list: Bhajan[]) => void;
	showToast: (text: string, type?: "success" | "error") => void;
	settingsLanguage?: "en" | "hi";
}> = ({
	bhajans,
	searchQuery,
	setSearchQuery,
	selectedBhajan,
	onSelectBhajan,
	onUpdateList,
	showToast,
	settingsLanguage = "hi",
}) => {
	const isHindi = settingsLanguage === "hi";
	const tList = {
		searchPlaceholder: isHindi ? "खोजें..." : "Search to edit...",
		add: isHindi ? "जोड़ें" : "Add",
		audioCount: isHindi ? "ऑडियो" : "Audio",
	};

	const filtered = useMemo(() => {
		if (!searchQuery.trim()) {
			return [...bhajans].sort((a, b) => {
				const extractNum = (str?: string) => {
					if (!str) return 0;
					const match = str.match(/\d+/);
					return match ? parseInt(match[0], 10) : 0;
				};
				const numA = extractNum(a.songNumber || a.id);
				const numB = extractNum(b.songNumber || b.id);
				return numA - numB;
			});
		}
		return bhajans
			.map((b) => ({
				bhajan: b,
				score: calculateSearchScore(b, searchQuery, "devanagari"),
			}))
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.bhajan);
	}, [bhajans, searchQuery]);

	const [isSaving, setIsSaving] = useState(false);
	const [progressMsg, setProgressMsg] = useState("");

	const [isRebuilding, setIsRebuilding] = useState(false);
	const [rebuildStatus, setRebuildStatus] = useState<{
		ok: boolean;
		msg: string;
	} | null>(null);
	const [rebuildProgressMsg, setRebuildProgressMsg] = useState("");

	const handleRebuildBundle = async () => {
		setIsRebuilding(true);
		setRebuildStatus(null);
		setRebuildProgressMsg("Starting rebuild...");
		try {
			const { rebuildBhajanBundle } = await import(
				"../../src/utils/githubBhajanStorage"
			);
			const result = await rebuildBhajanBundle((msg) =>
				setRebuildProgressMsg(msg),
			);
			onUpdateList(result.bhajans);
			setRebuildStatus({
				ok: true,
				msg: `✅ Rebuilt bundle with ${result.rebuilt} bhajans! Now press Force Sync.`,
			});
			showToast(
				`Bundle rebuilt with ${result.rebuilt} bhajans! Now do Force Sync.`,
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

	// A bhajan created with "+ Add" has nothing in the cloud to compare against.
	// Remembered at open time: once the list refreshes, another admin's bhajan
	// with the same number must not make this one look like an existing bhajan.
	const [editingNew, setEditingNew] = useState(false);
	// Bumped to re-open the editor on a newer cloud copy (conflict → "Load latest").
	const [editorRevision, setEditorRevision] = useState(0);
	const [conflict, setConflict] = useState<{
		kind: "changed" | "deleted";
		cloud: Bhajan | null;
		pending: Bhajan;
	} | null>(null);
	useAdminBack(!!conflict, () => setConflict(null));

	const openEditor = (bhajan: Bhajan, isNew: boolean) => {
		setEditingNew(isNew);
		onSelectBhajan(bhajan);
	};

	const handleSave = async (updatedBhajan: Bhajan, overwrite = false) => {
		const base = editingNew ? null : selectedBhajan;
		setIsSaving(true);
		try {
			// Checks the cloud (song number, other admins' edits) and applies only
			// this change on top of the latest cloud data.
			const result = await saveBhajanToFirebase(
				updatedBhajan,
				setProgressMsg,
				{ base, overwrite },
			);
			onUpdateList(result.bhajans);
			setConflict(null);
			showToast("Bhajan saved successfully to Cloud!", "success");
			onSelectBhajan(null);
		} catch (e: any) {
			if (e instanceof BhajanSaveError) {
				// The editor keeps the draft; the list behind it gets the cloud data.
				if (e.latest) onUpdateList(e.latest);
				if (e.kind === "changed" || e.kind === "deleted") {
					setConflict({
						kind: e.kind,
						cloud: e.cloud ?? null,
						pending: updatedBhajan,
					});
					return;
				}
				// Nothing was written (song number taken, or another save running).
				showToast(e.message, "error");
				return;
			}
			showToast(`Failed to save: ${e.message}`, "error");
		} finally {
			setIsSaving(false);
			setProgressMsg("");
		}
	};

	const handleToggleVisibility = async (bhajan: Bhajan) => {
		if (editingNew) {
			showToast(
				isHindi
					? "पहले भजन सेव करें, फिर छुपाएँ।"
					: "Save the bhajan first, then hide it.",
				"error",
			);
			return;
		}
		setIsSaving(true);
		try {
			const updatedBhajan = { ...bhajan, isHidden: !bhajan.isHidden };
			const result = await saveBhajanToFirebase(updatedBhajan, setProgressMsg, {
				base: bhajan,
			});
			onUpdateList(result.bhajans);
			showToast(
				updatedBhajan.isHidden
					? "Bhajan hidden from users."
					: "Bhajan restored locally and globally!",
				"success",
			);

			if (selectedBhajan?.id === bhajan.id) {
				onSelectBhajan(
					result.bhajans.find((b) => b.id === bhajan.id) ?? updatedBhajan,
				);
			}
		} catch (e: any) {
			if (e instanceof BhajanSaveError && e.latest) onUpdateList(e.latest);
			showToast(
				e instanceof BhajanSaveError && e.kind === "changed"
					? isHindi
						? "किसी और एडमिन ने यह भजन बदला है। पहले भजन सेव करें (तुलना दिखेगी), फिर छुपाएँ।"
						: "Another admin changed this bhajan. Save it first (you'll see both versions), then hide it."
					: `Failed to update visibility: ${e.message}`,
				"error",
			);
		} finally {
			setIsSaving(false);
			setProgressMsg("");
		}
	};

	// Step 3: the list is checked against the cloud whenever this screen opens,
	// so nobody edits an old copy. Editing waits until the check is done.
	const [freshness, setFreshness] = useState<
		"checking" | "downloading" | "fresh" | "failed"
	>("checking");
	const checkFreshness = useCallback(async () => {
		setFreshness("checking");
		try {
			const latest = await loadLatestBhajansIfChanged(() =>
				setFreshness("downloading"),
			);
			if (latest) onUpdateList(latest);
			setFreshness("fresh");
		} catch {
			setFreshness("failed");
		}
	}, [onUpdateList]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per screen open — onUpdateList is a new function on every Admin Panel render
	useEffect(() => {
		void checkFreshness();
	}, []);
	const listBusy = freshness === "checking" || freshness === "downloading";

	const [isPreparingNew, setIsPreparingNew] = useState(false);
	const handleAddNew = async () => {
		// The next free number is taken from the cloud too, so two admins adding
		// at the same time don't both get it (Save checks again anyway).
		setIsPreparingNew(true);
		let ids = bhajans.map((b) => b.id);
		try {
			ids = ids.concat(await fetchCloudBhajanIds());
		} catch {
			showToast(
				isHindi
					? "क्लाउड से नंबर जाँच नहीं पाए — सेव करते समय फिर जाँचा जाएगा।"
					: "Couldn't check numbers in the cloud — they'll be checked again on Save.",
				"error",
			);
		} finally {
			setIsPreparingNew(false);
		}
		const existingIds = new Set(
			ids
				.map((id) => {
					const match = id.match(/(\d+)/);
					return match ? parseInt(match[0], 10) : 0;
				})
				.filter((num) => num > 0),
		);

		let nextIdNum = 1;
		while (existingIds.has(nextIdNum)) {
			nextIdNum++;
		}
		const nextId = formatSongNumber(String(nextIdNum));

		const newBhajan: Bhajan = {
			id: nextId,
			songNumber: nextId,
			title: "", // Empty title so user can type
			titleIAST: "",
			content: "",
			contentIAST: "",
			firstLine: "",
			firstLineIAST: "",
			searchIndex: "",
			searchTokens: [],
			audio: [],
		};
		openEditor(newBhajan, true);
	};

	if (selectedBhajan) {
		return (
			<>
				<BhajanEditor
					key={`${selectedBhajan.id}-${editorRevision}`}
					bhajan={selectedBhajan}
					bhajans={bhajans}
					isNew={editingNew}
					onSave={(b) => handleSave(b)}
					onToggleVisibility={() => handleToggleVisibility(selectedBhajan)}
					onCancel={() => onSelectBhajan(null)}
					showToast={showToast}
					isHindi={isHindi}
					isSaving={isSaving}
					progressMsg={progressMsg}
				/>
				<ProcessingBlockerModal
					isVisible={isSaving}
					viewId="bhajan-save-blocker"
					title={isHindi ? "भजन सेव हो रहा है…" : "Saving bhajan…"}
					message={progressMsg}
					isHindi={isHindi}
				/>
				{conflict &&
					createPortal(
						<div className="fixed inset-0 z-[75] bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
							<div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 max-h-[90vh] flex flex-col">
								<h3 className="font-bold text-lg text-red-600 dark:text-red-400">
									{conflict.kind === "changed"
										? isHindi
											? "किसी और एडमिन ने यह भजन बदला है"
											: "Another admin changed this bhajan"
										: isHindi
											? "यह भजन अब क्लाउड में नहीं है"
											: "This bhajan is no longer in the cloud"}
								</h3>
								<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
									{conflict.kind === "changed"
										? isHindi
											? "आपके एडिटर खोलने के बाद क्लाउड में यह भजन बदल गया। अभी कुछ सेव नहीं हुआ है। क्लाउड वाला वर्ज़न नीचे है:"
											: "It changed in the cloud after you opened the editor. Nothing has been saved yet. The cloud version is below:"
										: isHindi
											? "किसी ने इसे हटा दिया या इसका नंबर बदल दिया। अभी कुछ सेव नहीं हुआ है।"
											: "Someone deleted it or changed its number. Nothing has been saved yet."}
								</p>
								{conflict.cloud && (
									<div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-y-auto min-h-0">
										<div className="font-bold font-hindi text-slate-800 dark:text-slate-100">
											#{conflict.cloud.songNumber ?? conflict.cloud.id}{" "}
											{conflict.cloud.title}
										</div>
										{conflict.cloud.author && (
											<div className="text-xs text-slate-500 dark:text-slate-400 font-hindi">
												{conflict.cloud.author}
											</div>
										)}
										<div className="mt-2 text-sm font-hindi whitespace-pre-wrap text-slate-700 dark:text-slate-300">
											{conflict.cloud.content}
										</div>
										<div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
											{isHindi ? "ऑडियो" : "Audio"}:{" "}
											{conflict.cloud.audio?.length || 0}
										</div>
									</div>
								)}
								<div className="mt-4 flex flex-col gap-2 shrink-0">
									{conflict.cloud && (
										<button
											type="button"
											onClick={() => {
												const cloud = conflict.cloud;
												setConflict(null);
												if (!cloud) return;
												setEditingNew(false);
												setEditorRevision((r) => r + 1);
												onSelectBhajan(cloud);
											}}
											className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
										>
											{isHindi
												? "क्लाउड वाला खोलें (मेरे बदलाव हटेंगे)"
												: "Open the cloud version (drops my edits)"}
										</button>
									)}
									<button
										type="button"
										onClick={() => {
											const pending = conflict.pending;
											setConflict(null);
											void handleSave(pending, true);
										}}
										className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm"
									>
										{conflict.kind === "changed"
											? isHindi
												? "मेरा वर्ज़न सेव करें (उनका बदलाव हटेगा)"
												: "Save mine anyway (replaces theirs)"
											: isHindi
												? "मेरा वर्ज़न फिर से बनाएँ"
												: "Save mine anyway (creates it again)"}
									</button>
									<button
										type="button"
										onClick={() => setConflict(null)}
										className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm"
									>
										{isHindi ? "रद्द करें (एडिट जारी रखें)" : "Cancel (keep editing)"}
									</button>
								</div>
							</div>
						</div>,
						document.body,
					)}
			</>
		);
	}

	return (
		<>
			<div className="h-full flex flex-col">
				<InterruptedWriteBanner
					tag="bhajandata"
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
							placeholder={tList.searchPlaceholder}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
					<button
						type="button"
						onClick={handleAddNew}
						disabled={listBusy || isPreparingNew}
						className="bg-blue-600 text-white px-3 rounded-lg font-bold flex items-center gap-1 shadow-sm disabled:opacity-50"
					>
						{isPreparingNew ? (
							<span className="animate-spin text-lg leading-none">↻</span>
						) : (
							<Plus size={18} />
						)}{" "}
						{tList.add}
					</button>
				</div>
				{freshness !== "fresh" && (
					<div
						className={`mx-2 mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${freshness === "failed" ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"}`}
					>
						{freshness === "failed" ? (
							<>
								<span className="flex-1">
									{isHindi
										? "यह पक्का नहीं हो पाया कि यह सबसे नया डेटा है (इंटरनेट देखें)। सेव करते समय क्लाउड से फिर जाँच होगी।"
										: "Couldn't confirm this is the latest data (check the internet). Saving still checks the cloud."}
								</span>
								<button
									type="button"
									onClick={() => void checkFreshness()}
									className="shrink-0 px-2 py-1 rounded-md bg-amber-600 text-white"
								>
									{isHindi ? "फिर जाँचें" : "Retry"}
								</button>
							</>
						) : (
							<>
								<span className="animate-spin text-base leading-none">↻</span>
								<span>
									{freshness === "downloading"
										? isHindi
											? "क्लाउड से नए भजन आ रहे हैं…"
											: "Downloading the latest bhajans…"
										: isHindi
											? "सबसे नया डेटा जाँच रहे हैं…"
											: "Checking for the latest data…"}
								</span>
							</>
						)}
					</div>
				)}
				<div
					className={`flex-1 overflow-y-auto p-2 space-y-2 ${listBusy ? "opacity-50 pointer-events-none" : ""}`}
				>
					{filtered.map((b) => (
						<button
							key={b.id}
							type="button"
							disabled={listBusy}
							onClick={() => {
								/* No Haptics */ openEditor(b, false);
							}}
							className={`w-full text-left p-3 rounded-lg border ${b.isHidden ? "bg-slate-100 dark:bg-slate-900 border-dashed border-slate-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"} flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group`}
						>
							<div className="truncate flex-1 min-w-0 pr-2">
								<div className="font-bold text-sm truncate group-hover:text-blue-600 transition-colors flex items-center gap-2">
									{b.songNumber ? (
										<span className="inline-block w-8 text-xs text-slate-400 dark:text-ink-400 font-mono">
											#{b.songNumber}
										</span>
									) : null}
									{b.title}
									{b.isHidden && (
										<span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500 dark:text-ink-300">
											Hidden
										</span>
									)}
								</div>
								<div className="text-[10px] text-slate-400 dark:text-ink-400 truncate pl-0.5">
									{getListFirstLine(b.firstLine, b.content)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								{b.audio && b.audio.length > 0 && (
									<span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
										{b.audio.length} {tList.audioCount}
									</span>
								)}
								<ChevronRight
									size={18}
									className="text-slate-400 dark:text-ink-400"
								/>
							</div>
						</button>
					))}
				</div>

				{/* ── REBUILD BUNDLE (Advanced Tool) ── */}
				<div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<button
								type="button"
								onClick={handleRebuildBundle}
								disabled={isRebuilding || isSaving}
								className={`px-4 py-2 rounded-lg font-bold text-sm text-white flex items-center gap-2 transition-colors ${isRebuilding ? "bg-slate-400 dark:bg-slate-600 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 active:scale-95"}`}
							>
								<RotateCcw
									size={16}
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
							{isRebuilding && rebuildProgressMsg && (
								<div className="mt-2 text-[10px] text-slate-500 font-mono animate-pulse flex items-center gap-2">
									<span>{rebuildProgressMsg}</span>
								</div>
							)}
							{rebuildStatus && (
								<div
									className={`mt-2 text-xs font-bold p-2 rounded ${
										rebuildStatus.ok
											? "bg-green-100 text-green-700"
											: "bg-red-100 text-red-700"
									}`}
								>
									{rebuildStatus.msg}
								</div>
							)}
						</div>
					</div>
					<p className="text-[10px] text-slate-400 dark:text-ink-400 mt-2">
						* Use this ONLY if the main Bhajan bundle is stuck or not showing
						new edits. It will scan all individual files in Firebase Storage and
						reconstruct the master bundle.
					</p>
				</div>
			</div>
			<ProcessingBlockerModal
				isVisible={isRebuilding}
				viewId="bhajan-rebuild-blocker"
				title={isHindi ? "बंडल रीबिल्ड हो रहा है…" : "Rebuilding bundle…"}
				message={rebuildProgressMsg}
				isHindi={isHindi}
			/>
		</>
	);
};

// --- HELPER FOR BHAJAN SAVING ---
const prepareBhajanForSave = (bhajan: Bhajan): Bhajan => {
	const titleIAST = convertToIAST(bhajan.title);
	const contentIAST = convertToIAST(bhajan.content);
	const authorIAST = bhajan.author ? convertToIAST(bhajan.author) : undefined;

	const lines = bhajan.content
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const firstLine = lines.length > 0 ? lines[0] : bhajan.title;
	const firstLineIAST = convertToIAST(firstLine);

	const combinedText = `${bhajan.title} ${bhajan.content} ${bhajan.author || ""}`;
	const transliteratedText = transliterateForSearch(combinedText);
	const normalizedIndex = smartNormalize(transliteratedText);

	const searchIndex = `${bhajan.songNumber || ""} ${combinedText.toLowerCase()} ${normalizedIndex}`;

	const rawTokens = transliteratedText.toLowerCase().split(/[\s,।॥!?-]+/);
	const searchTokens = rawTokens
		.filter((t) => t.length > 2)
		.map((t) => smartNormalize(t));
	const _uniqueTokens = Array.from(new Set(searchTokens));

	return {
		...bhajan,
		titleIAST,
		contentIAST,
		authorIAST,
		firstLine,
		firstLineIAST,
		searchIndex,
		searchTokens,
	};
};

const AudioEditItem: React.FC<{
	audio: BhajanAudio;
	bhajanTitle: string;
	bhajanNumber: string;
	isFirst: boolean;
	isLast: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onUpdate: (a: BhajanAudio) => void;
	onRemove: (id: string) => void;
	showToast: (text: string, type?: "success" | "error") => void;
}> = ({
	audio,
	bhajanTitle,
	bhajanNumber,
	isFirst,
	isLast,
	onMoveUp,
	onMoveDown,
	onUpdate,
	onRemove,
	showToast,
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [singer, setSinger] = useState(audio.singer);
	const [url, setUrl] = useState(audio.url);
	// Back cancels this row's edit (like the X) instead of closing the editor.
	useAdminBack(isEditing, () => setIsEditing(false));

	if (isEditing) {
		return (
			<div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-blue-500 shadow-sm space-y-2 mb-2">
				<input
					className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none"
					placeholder="Singer Name"
					value={singer}
					onChange={(e) => setSinger(e.target.value)}
				/>
				<div className="flex gap-2">
					<input
						className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none"
						placeholder="Audio URL"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
					/>
					<B2UploadButton
						folderPath={`Local Data Uploaded from App/audios/${bhajanNumber ? `${bhajanNumber} ` : ""}${bhajanTitle || "Untitled"} by ${singer.trim() || "Unknown"}/`}
						accept=".m4a"
						disabled={!singer.trim()}
						disabledMessage="Please enter a Singer Name first!"
						onUploadComplete={(newUrl) => setUrl(newUrl)}
						showToast={showToast}
					/>
				</div>
				<div className="text-[10px] text-slate-500 dark:text-ink-300 mt-1">
					* Please upload .m4a files only
				</div>
				<div className="flex justify-end gap-2 pt-1">
					<button
						onClick={() => setIsEditing(false)}
						className="p-1.5 text-slate-500 dark:text-ink-300"
					>
						<XIcon size={16} />
					</button>
					<button
						onClick={() => {
							const validUrl = validateAndFormatUrl(url);
							if (validUrl === null) {
								showToast("Please enter a valid Audio URL.", "error");
								return;
							}
							onUpdate({ ...audio, singer, url: validUrl });
							setIsEditing(false);
						}}
						className="p-1.5 bg-blue-600 text-white rounded"
					>
						<Check size={16} />
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center mb-2">
			<div className="flex items-center gap-3 overflow-hidden">
				<div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 shrink-0">
					<PlayCircle size={16} />
				</div>
				<div className="truncate min-w-0">
					<div className="font-bold text-sm truncate">{audio.singer}</div>
					<div className="text-[10px] text-slate-400 dark:text-ink-400 truncate">
						{audio.url}
					</div>
				</div>
			</div>
			<div className="flex gap-1 shrink-0 items-center">
				<button
					onClick={onMoveUp}
					disabled={isFirst}
					className="p-2 text-slate-500 dark:text-ink-300 hover:text-slate-800 disabled:opacity-30 bg-slate-50 dark:bg-slate-700/50 rounded-full"
				>
					<ChevronUp size={14} />
				</button>
				<button
					onClick={onMoveDown}
					disabled={isLast}
					className="p-2 text-slate-500 dark:text-ink-300 hover:text-slate-800 disabled:opacity-30 bg-slate-50 dark:bg-slate-700/50 rounded-full"
				>
					<ChevronDown size={14} />
				</button>
				<button
					onClick={() => setIsEditing(true)}
					className="p-2 text-blue-500 bg-slate-50 dark:bg-slate-700/50 rounded-full"
				>
					<Edit2 size={14} />
				</button>
				<button
					onClick={() => onRemove(audio.id)}
					className="p-2 text-red-500 bg-slate-50 dark:bg-slate-700/50 rounded-full"
				>
					<Trash2 size={14} />
				</button>
			</div>
		</div>
	);
};

// --- Bhajan Editor Component ---
const BhajanEditor: React.FC<{
	bhajans: Bhajan[];
	bhajan: Bhajan;
	/** Opened with "+ Add" — not in the cloud yet. */
	isNew: boolean;
	onSave: (b: Bhajan) => void;
	onToggleVisibility: () => void;
	onCancel: () => void;
	showToast: (text: string, type?: "success" | "error") => void;
	isHindi?: boolean;
	isSaving?: boolean;
	progressMsg?: string;
}> = ({
	bhajans,
	bhajan,
	isNew,
	onSave,
	onToggleVisibility,
	onCancel,
	showToast,
	isHindi,
	isSaving,
	progressMsg,
}) => {
	// Local Draft State
	const [draft, setDraft] = useState<Bhajan>(bhajan);
	const [editTab, setEditTab] = useState<"text" | "audio">("text");
	const [newAudioUrl, setNewAudioUrl] = useState("");
	const [newAudioSinger, setNewAudioSinger] = useState("");

	// Preview: the unsaved draft on the real reading screen. Read-only — it
	// never saves, and Back closes it (not the editor), so the draft is kept.
	const [showPreview, setShowPreview] = useState(false);
	useAdminBack(showPreview, () => setShowPreview(false));
	const {
		fontSize,
		setFontSize,
		script,
		darkMode,
		handleThemeChange,
		keepAwake,
		devMode,
		scrollBarSide,
		settingsLanguage,
	} = useSettings();
	const previewBhajan = useMemo(
		() => (showPreview ? prepareBhajanForSave(draft) : null),
		[showPreview, draft],
	);

	useEffect(() => {
		setDraft((prev) => ({ ...prev, isHidden: bhajan.isHidden }));
	}, [bhajan.isHidden]);

	const t = {
		back: isHindi ? "पीछे" : "Back",
		send: isHindi ? "भेजें" : "Send",
		save: isHindi ? "सहेजें" : "Save",
		textTab: isHindi ? "पाठ और विवरण" : "Text & Details",
		audioTab: isHindi ? "ऑडियो" : "Audio",
		titleDev: isHindi ? "शीर्षक (देवनागरी)" : "Title (Devanagari)",
		songNum: isHindi ? "गीत क्र." : "Song #",
		authorDev: isHindi ? "लेखक (देवनागरी)" : "Author (Devanagari)",
		content: isHindi ? "सामग्री / बोल" : "Content / Lyrics",
		linkedAudio: isHindi ? "लिंक किए गए ऑडियो" : "Linked Audio Tracks",
		noAudio: isHindi ? "कोई ऑडियो ट्रैक लिंक नहीं है।" : "No audio tracks linked.",
		addNewAudio: isHindi ? "नया ऑडियो जोड़ें" : "Add New Audio",
		singerName: isHindi ? "गायक का नाम" : "Singer Name",
		url: isHindi ? "यूआरएल" : "URL (MP3 / Drive Link)",
		addTrack: isHindi ? "ट्रैक जोड़ें" : "Add Track",
		preview: isHindi ? "पूर्वावलोकन" : "Preview",
		numberRequired: isHindi
			? "गीत क्रमांक डालें (1 या उससे बड़ा)।"
			: "Enter a song number (1 or more).",
		numberTaken: isHindi ? "पहले से किसी और भजन का है:" : "already belongs to:",
	};

	// Step 1: the song number is checked while typing. "72" and "072" are the
	// same number; numbers below 100 are saved as three digits (072), as before.
	const songNumber = formatSongNumber(draft.songNumber || "");
	const numberOwner = useMemo(
		() =>
			songNumber
				? bhajans.find(
						(b) =>
							(isNew || b.id !== bhajan.id) &&
							isSameSongNumber(b.id, songNumber),
					)
				: undefined,
		[bhajans, bhajan.id, isNew, songNumber],
	);
	const numberProblem = !songNumber
		? t.numberRequired
		: numberOwner
			? `#${songNumber} ${t.numberTaken} ${numberOwner.title}`
			: "";

	// Changing an existing bhajan's number replaces its old file — asked first.
	const [confirmRenumber, setConfirmRenumber] = useState(false);
	useAdminBack(confirmRenumber, () => setConfirmRenumber(false));

	// Handlers for Text
	const updateField = (field: keyof Bhajan, value: string) => {
		setDraft((prev) => ({ ...prev, [field]: value }));
	};

	// Handlers for Audio
	const handleAddAudio = () => {
		if (!newAudioUrl || !newAudioSinger) return;

		const validUrl = validateAndFormatUrl(newAudioUrl);
		if (validUrl === null) {
			showToast("Please enter a valid Audio URL.", "error");
			return;
		}

		const newTrack: BhajanAudio = {
			id: `audio-${Date.now()}`,
			singer: newAudioSinger,
			url: validUrl,
		};
		setDraft((prev) => ({ ...prev, audio: [...(prev.audio || []), newTrack] }));
		setNewAudioUrl("");
		setNewAudioSinger("");
	};

	const handleUpdateAudioTrack = (updatedTrack: BhajanAudio) => {
		setDraft((prev) => ({
			...prev,
			audio:
				prev.audio?.map((a) => (a.id === updatedTrack.id ? updatedTrack : a)) ||
				[],
		}));
	};

	const handleRemoveAudioTrack = (trackId: string) => {
		setDraft((prev) => ({
			...prev,
			audio: prev.audio?.filter((a) => a.id !== trackId) || [],
		}));
	};

	const handleMoveAudio = (idx: number, dir: "up" | "down") => {
		if (!draft.audio) return;
		const newAudio = [...draft.audio];
		if (dir === "up" && idx > 0) {
			[newAudio[idx - 1], newAudio[idx]] = [newAudio[idx], newAudio[idx - 1]];
		} else if (dir === "down" && idx < newAudio.length - 1) {
			[newAudio[idx + 1], newAudio[idx]] = [newAudio[idx], newAudio[idx + 1]];
		}
		setDraft((prev) => ({ ...prev, audio: newAudio }));
	};

	const saveNow = () => {
		setConfirmRenumber(false);
		const readyToSave = normalizeBhajanForCloudSave(
			prepareBhajanForSave({ ...draft, songNumber }),
		);
		onSave(readyToSave);
	};

	const commitSave = () => {
		if (!draft.title.trim()) {
			showToast("Title is required", "error");
			return;
		}
		if (numberProblem) {
			showToast(numberProblem, "error");
			return;
		}
		if (!isNew && songNumber !== bhajan.id) {
			setConfirmRenumber(true);
			return;
		}
		saveNow();
	};

	const _sendToWhatsapp = () => {
		if (!draft.title.trim()) {
			showToast("Title is required", "error");
			return;
		}
		const readyToSave = prepareBhajanForSave(draft);

		let cleanId = readyToSave.songNumber;
		const numericId = cleanId
			? cleanId.replace(/\D/g, "")
			: readyToSave.id.replace(/\D/g, "");
		cleanId = numericId || readyToSave.id || "NEW";

		const msg = `Please update this Bhajan:\n([id:"${cleanId}"] [title:"${readyToSave.title}"] [author:"${readyToSave.author || ""}"] [content:"${readyToSave.content}"])`;
		window.open(
			`https://wa.me/${DEV_WHATSAPP}?text=${encodeURIComponent(msg)}`,
			"_blank",
			"noopener,noreferrer",
		);
	};

	return (
		<div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right">
			{/* Toolbar */}
			<div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
				<button
					onClick={onCancel}
					className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors active:scale-95"
				>
					<ArrowLeft size={18} /> {t.back}
				</button>
				<div className="flex gap-2 items-center">
					<button
						type="button"
						onClick={() => setShowPreview(true)}
						disabled={isSaving}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-saffron-50 dark:bg-slate-700 text-saffron-700 dark:text-saffron-400 border border-saffron-200 dark:border-slate-600 font-bold text-sm hover:bg-saffron-100 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors active:scale-95"
						title={t.preview}
					>
						<BookOpen size={16} /> {t.preview}
					</button>
					<button
						type="button"
						onClick={onToggleVisibility}
						disabled={isSaving}
						className={`p-2 rounded-full transition-colors ${draft.isHidden ? "text-amber-600 hover:bg-amber-50" : "text-slate-400 dark:text-ink-400 hover:text-slate-600"}`}
						title={draft.isHidden ? "Restore from Hidden" : "Hide Bhajan"}
					>
						{draft.isHidden ? <EyeOff size={20} /> : <Eye size={20} />}
					</button>
					<button
						type="button"
						onClick={commitSave}
						disabled={isSaving || !!numberProblem}
						className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-sm flex items-center gap-2"
					>
						{isSaving ? (
							<span className="animate-spin text-lg">↻</span>
						) : (
							<Save size={16} />
						)}
						{isSaving ? progressMsg || "Saving..." : t.save}
					</button>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex p-2 gap-2 bg-slate-100 dark:bg-slate-900">
				<button
					onClick={() => setEditTab("text")}
					className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${editTab === "text" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-500 dark:text-ink-300"}`}
				>
					<FileText size={16} /> {t.textTab}
				</button>
				<button
					onClick={() => setEditTab("audio")}
					className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${editTab === "audio" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-500 dark:text-ink-300"}`}
				>
					<Music size={16} /> {t.audioTab} ({draft.audio?.length || 0})
				</button>
			</div>

			{/* Shown on both tabs: it is why Save is disabled. */}
			{numberProblem && (
				<div className="mx-2 mb-1 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300 font-hindi">
					{numberProblem}
				</div>
			)}

			{/* Content Form */}
			<div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
				{editTab === "text" ? (
					<div className="space-y-4 max-w-2xl mx-auto">
						<div className="flex gap-4">
							<div className="flex-1">
								<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block">
									{t.titleDev}
								</label>
								<input
									value={draft.title}
									onChange={(e) => updateField("title", e.target.value)}
									className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-lg"
									placeholder="Bhajan Title"
								/>
							</div>
							<div className="w-24">
								<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block flex items-center gap-1">
									<Hash size={10} /> {t.songNum}
								</label>
								<input
									value={draft.songNumber || ""}
									inputMode="numeric"
									onChange={(e) =>
										updateField("songNumber", e.target.value.replace(/\D/g, ""))
									}
									onBlur={() => {
										if (songNumber) updateField("songNumber", songNumber);
									}}
									className={`w-full p-3 bg-white dark:bg-slate-800 border rounded-xl font-mono text-center ${numberProblem ? "border-red-500 ring-1 ring-red-500" : "border-slate-200 dark:border-slate-700"}`}
									placeholder="#"
								/>
							</div>
						</div>

						<div>
							<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block flex items-center gap-1">
								<User size={12} /> {t.authorDev}
							</label>
							<input
								value={draft.author || ""}
								onChange={(e) => updateField("author", e.target.value)}
								className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
								placeholder="Author Name"
							/>
						</div>

						<div className="flex-1 flex flex-col min-h-[400px]">
							<label className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase mb-1 block">
								{t.content}
							</label>
							<textarea
								value={draft.content}
								onChange={(e) => updateField("content", e.target.value)}
								className="w-full flex-1 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-hindi leading-loose resize-none focus:ring-2 focus:ring-blue-500 outline-none"
								placeholder="Paste lyrics here..."
							/>
						</div>
					</div>
				) : (
					<div className="max-w-xl mx-auto">
						<h3 className="text-xs font-bold uppercase text-slate-500 dark:text-ink-300 mb-3">
							{t.linkedAudio}
						</h3>
						{draft.audio && draft.audio.length > 0 ? (
							draft.audio.map((audio, idx) => (
								<AudioEditItem
									key={audio.id || idx}
									audio={audio}
									bhajanTitle={draft.title}
									bhajanNumber={draft.songNumber || draft.id}
									isFirst={idx === 0}
									isLast={idx === (draft.audio?.length || 0) - 1}
									onMoveUp={() => handleMoveAudio(idx, "up")}
									onMoveDown={() => handleMoveAudio(idx, "down")}
									onUpdate={handleUpdateAudioTrack}
									onRemove={handleRemoveAudioTrack}
									showToast={showToast}
								/>
							))
						) : (
							<div className="text-center py-8 text-slate-400 dark:text-ink-400 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
								<Music size={24} className="mx-auto mb-2 opacity-50" />
								<p className="text-sm">{t.noAudio}</p>
							</div>
						)}

						<div className="mt-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
							<h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
								<Plus size={16} className="text-blue-600" /> {t.addNewAudio}
							</h4>
							<div className="space-y-3">
								<input
									className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
									placeholder={t.singerName}
									value={newAudioSinger}
									onChange={(e) => setNewAudioSinger(e.target.value)}
								/>
								<div className="flex gap-2">
									<input
										className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
										placeholder={t.url}
										value={newAudioUrl}
										onChange={(e) => setNewAudioUrl(e.target.value)}
									/>
									<B2UploadButton
										folderPath={`Local Data Uploaded from App/audios/${draft.songNumber || draft.id ? `${draft.songNumber || draft.id} ` : ""}${draft.title || "Untitled"} by ${newAudioSinger.trim() || "Unknown"}/`}
										accept=".m4a"
										disabled={!newAudioSinger.trim()}
										disabledMessage="Please enter a Singer Name first!"
										onUploadComplete={(url, file) => {
											setNewAudioUrl(url);
											if (!newAudioSinger) {
												const nameWithoutExt = file.name.replace(
													/\.[^/.]+$/,
													"",
												);
												setNewAudioSinger(nameWithoutExt);
											}
										}}
										showToast={showToast}
									/>
								</div>
								<div className="text-[10px] text-slate-500 dark:text-ink-300 mb-2">
									* Please upload .m4a files only
								</div>
								<button
									onClick={handleAddAudio}
									disabled={!newAudioUrl || !newAudioSinger}
									className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-lg transition-colors"
								>
									{t.addTrack}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{confirmRenumber &&
				createPortal(
					<div className="fixed inset-0 z-[75] bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
						<div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5">
							<h3 className="font-bold text-lg text-slate-800 dark:text-white">
								{isHindi ? "गीत क्रमांक बदलें?" : "Change the song number?"}
							</h3>
							<p className="mt-2 text-sm text-slate-600 dark:text-slate-300 font-hindi">
								{isHindi
									? `यह भजन #${bhajan.id} से #${songNumber} हो जाएगा। #${bhajan.id} अब नहीं रहेगा — जिन्होंने इसे अपनी सूची में सेव किया है, उनकी सूची से यह हट सकता है।`
									: `This bhajan moves from #${bhajan.id} to #${songNumber}. #${bhajan.id} will no longer exist — it may disappear from lists where people saved it.`}
							</p>
							<div className="mt-4 flex gap-2">
								<button
									type="button"
									onClick={() => setConfirmRenumber(false)}
									className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm"
								>
									{isHindi ? "रद्द करें" : "Cancel"}
								</button>
								<button
									type="button"
									onClick={saveNow}
									className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
								>
									{isHindi ? "हाँ, बदलें" : "Yes, change it"}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{previewBhajan &&
				createPortal(
					// Above the admin panel (z-60); the reader's own popups sit at z-70.
					<div className="fixed inset-0 z-[65]">
						<Suspense
							fallback={
								<div className="fixed inset-0 bg-paper dark:bg-slate-950 flex items-center justify-center">
									<span className="animate-spin text-2xl text-saffron-500">
										↻
									</span>
								</div>
							}
						>
							<BhajanReader
								bhajan={previewBhajan}
								previewMode
								onBack={() => setShowPreview(false)}
								fontSize={fontSize}
								onChangeFontSize={setFontSize}
								searchQuery=""
								script={script}
								darkMode={darkMode}
								onToggleTheme={() => handleThemeChange(!darkMode)}
								keepAwake={keepAwake}
								devMode={devMode}
								scrollBarSide={scrollBarSide}
								settingsLanguage={settingsLanguage}
							/>
						</Suspense>
					</div>,
					document.body,
				)}
		</div>
	);
};

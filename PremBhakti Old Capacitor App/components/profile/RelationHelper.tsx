import { Check, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { getRelationLabel } from "../../src/constants/relations";
import type {
	LinkedFamilyInfo,
	RelationReason,
} from "../../utils/familyChains";
import { relationQuestions } from "../../utils/relationQuestions";
import { ThumbImg } from "../ui/ThumbImg";
import { RelationPicker } from "./RelationPicker";

/** A linked member as the profile screen holds it. */
export interface HelperMember extends LinkedFamilyInfo {
	realName?: string;
	dikshaName?: string;
	photoURL?: string;
}

interface Props {
	isHindi: boolean;
	members: HelperMember[];
	/** My relations for my linked members (live — they update as I answer). */
	myRelations?: Record<string, string>;
	via?: Record<string, string>;
	myGender?: string;
	onSaveGender: (gender: "male" | "female") => Promise<void>;
	/** Saves my relation for each uid; false when it could not be saved. */
	onSave: (values: Record<string, string>) => Promise<boolean>;
	/** Change one relation (the profile's own relation sheet). */
	onEdit: (id: string) => void;
	onClose: () => void;
}

/** "review" = everyone's relation, to look over or change any time. */
type Phase = "gender" | "easy" | "one" | "review";

/**
 * "Complete relations": the linked family members the devotee hasn't said
 * anything about, as a few quick questions — mostly one tap each. Only their
 * own side is asked; the other side fills itself in on the server when it is
 * certain (syncFamilyLinkGroups). A guess is never saved without a tap.
 */
export const RelationHelper: React.FC<Props> = ({
	isHindi,
	members,
	myRelations,
	via,
	myGender,
	onSaveGender,
	onSave,
	onEdit,
	onClose,
}) => {
	const live = useMemo(
		() => relationQuestions(members, myRelations, via),
		[members, myRelations, via],
	);
	const liveById = useMemo(() => new Map(live.map((q) => [q.id, q])), [live]);

	// Who is asked is fixed when the helper opens, so answering one question
	// never reshuffles the rest. Options are worked out live, though — an
	// answer can make the next one clearer.
	const [start] = useState(() => live);
	const easyIds = start.filter((q) => q.options.length === 1).map((q) => q.id);
	const listEasy = easyIds.length >= 2;
	const [queue, setQueue] = useState<string[]>(() =>
		start.filter((q) => !listEasy || q.options.length !== 1).map((q) => q.id),
	);
	// Nothing left to ask: straight to the list of everyone's relation.
	const nextAfterGender: Phase =
		start.length === 0 ? "review" : listEasy ? "easy" : "one";
	const [phase, setPhase] = useState<Phase>(() =>
		myGender !== "male" && myGender !== "female" ? "gender" : nextAfterGender,
	);
	const [unticked, setUnticked] = useState<Set<string>>(new Set());
	const [handled, setHandled] = useState<Set<string>>(new Set());
	const [savedCount, setSavedCount] = useState(0);
	const [skippedCount, setSkippedCount] = useState(0);
	const [busy, setBusy] = useState(false);
	const [other, setOther] = useState(false);
	const [otherValue, setOtherValue] = useState("");

	const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
	const nameOf = (id: string) =>
		byId.get(id)?.realName || byId.get(id)?.dikshaName || "—";
	const label = (rel: string) => getRelationLabel(rel, isHindi) || rel;

	const reasonText = (reason: RelationReason | null, id: string) => {
		if (!reason) return "";
		if (reason.kind === "theyCallMe")
			return isHindi
				? `इन्होंने आपको अपना “${label(reason.relation)}” बताया है`
				: `They added you as their “${label(reason.relation)}”`;
		const viaName = nameOf(reason.viaId);
		if (reason.kind === "connected")
			return reason.theirs
				? isHindi
					? `ये ${viaName} (आपके लिए “${label(reason.mine)}”) के “${label(reason.theirs)}” हैं`
					: `They are ${viaName}'s “${label(reason.theirs)}” — ${viaName} is your “${label(reason.mine)}”`
				: isHindi
					? `ये ${viaName} (आपके लिए “${label(reason.mine)}”) को अपना “${label(reason.memberCalls || "")}” बताते हैं`
					: `They call ${viaName} (your “${label(reason.mine)}”) their “${label(reason.memberCalls || "")}”`;
		return isHindi
			? `क्योंकि ये ${viaName} के “${label(reason.theirs)}” हैं, और ${viaName} आपके लिए “${label(reason.mine)}”`
			: `Because ${nameOf(id)} is ${viaName}'s “${label(reason.theirs)}”, and ${viaName} is your “${label(reason.mine)}”`;
	};

	// Still unanswered and still one answer (an earlier answer may change that).
	const easyLeft = easyIds.filter(
		(id) => liveById.get(id)?.options.length === 1,
	);
	const easyChanged = easyIds.filter(
		(id) => liveById.has(id) && !easyLeft.includes(id),
	);
	const remaining = queue.filter((id) => !handled.has(id) && liveById.has(id));
	const current = remaining[0];
	const done = phase === "one" && !current;

	const afterGender = () => setPhase(nextAfterGender);

	const saveGender = async (g: "male" | "female") => {
		setBusy(true);
		await onSaveGender(g);
		setBusy(false);
		afterGender();
	};

	const confirmEasy = async () => {
		const values: Record<string, string> = {};
		for (const id of easyLeft) {
			const only = liveById.get(id)?.options[0];
			if (only && !unticked.has(id)) values[id] = only;
		}
		setBusy(true);
		const ok = Object.keys(values).length === 0 ? true : await onSave(values);
		setBusy(false);
		if (!ok) return;
		setSavedCount((n) => n + Object.keys(values).length);
		// The ones marked wrong are asked one by one, with all the choices.
		setQueue((q) => [
			...easyLeft.filter((id) => unticked.has(id)),
			...easyChanged,
			...q,
		]);
		setPhase("one");
	};

	const answer = async (id: string, value: string) => {
		if (!value) return;
		setBusy(true);
		const ok = await onSave({ [id]: value });
		setBusy(false);
		if (!ok) return;
		setSavedCount((n) => n + 1);
		setHandled((s) => new Set(s).add(id));
		setOther(false);
		setOtherValue("");
	};

	const skip = (id: string) => {
		setSkippedCount((n) => n + 1);
		setHandled((s) => new Set(s).add(id));
		setOther(false);
		setOtherValue("");
	};

	const avatar = (id: string, size: string) => {
		const m = byId.get(id);
		return m?.photoURL ? (
			<ThumbImg
				src={m.photoURL}
				alt=""
				className={`${size} rounded-full object-cover shrink-0 border-2 border-white dark:border-slate-800 shadow-sm`}
			/>
		) : (
			<span
				className={`${size} rounded-full shrink-0 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center`}
			>
				{nameOf(id).charAt(0).toUpperCase()}
			</span>
		);
	};

	const total = queue.length;
	const step = Math.min(total, total - remaining.length + 1);

	let body: React.ReactNode;
	if (phase === "gender") {
		body = (
			<div className="space-y-4">
				<div>
					<p className="text-base font-bold text-slate-800 dark:text-white">
						{isHindi ? "पहले एक बात — आप…" : "First — are you…"}
					</p>
					<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-1">
						{isHindi
							? "इससे आपके परिवारवालों की तरफ़ के कई रिश्ते अपने-आप भर जाते हैं।"
							: "This fills in many relations on your family's side by itself."}
					</p>
				</div>
				<div className="grid grid-cols-2 gap-2">
					{(["male", "female"] as const).map((g) => (
						<button
							key={g}
							type="button"
							disabled={busy}
							onClick={() => saveGender(g)}
							className="min-h-[52px] rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold active:scale-95 transition"
						>
							{g === "male"
								? isHindi
									? "पुरुष"
									: "Male"
								: isHindi
									? "महिला"
									: "Female"}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={afterGender}
					className="w-full min-h-touch text-sm font-bold text-slate-500 dark:text-slate-400"
				>
					{isHindi ? "छोड़ें" : "Skip"}
				</button>
			</div>
		);
	} else if (phase === "easy") {
		const ticked = easyLeft.filter((id) => !unticked.has(id)).length;
		body = (
			<div className="space-y-3">
				<div>
					<p className="text-base font-bold text-slate-800 dark:text-white">
						{isHindi ? "ये रिश्ते लगभग तय हैं" : "These look clear"}
					</p>
					<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-1">
						{isHindi
							? "जो ग़लत लगे, उसका ✓ हटा दें — उसे अलग से पूछेंगे।"
							: "Untick any that look wrong — we'll ask about those separately."}
					</p>
				</div>
				<ul className="space-y-2">
					{easyLeft.map((id) => {
						const q = liveById.get(id);
						const on = !unticked.has(id);
						return (
							<li key={id}>
								<button
									type="button"
									aria-pressed={on}
									onClick={() =>
										setUnticked((s) => {
											const next = new Set(s);
											if (next.has(id)) next.delete(id);
											else next.add(id);
											return next;
										})
									}
									className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition ${
										on
											? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50"
											: "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 opacity-70"
									}`}
								>
									{avatar(id, "w-10 h-10")}
									<span className="flex-1 min-w-0">
										<span className="block text-sm font-bold text-slate-800 dark:text-white truncate">
											{nameOf(id)}
										</span>
										<span className="block text-xs font-bold text-blue-700 dark:text-blue-300">
											{label(q?.options[0] || "")}
										</span>
										{q?.reason && (
											<span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
												{reasonText(q.reason, id)}
											</span>
										)}
									</span>
									<span
										className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center border-2 ${
											on
												? "bg-blue-500 border-blue-500 text-white"
												: "border-slate-300 dark:border-slate-600"
										}`}
									>
										{on && <Check size={16} />}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
				<button
					type="button"
					disabled={busy}
					onClick={confirmEasy}
					className="w-full min-h-[52px] rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold active:scale-95 transition flex items-center justify-center gap-2"
				>
					{busy ? (
						<Loader2 size={18} className="animate-spin" />
					) : (
						<Check size={18} />
					)}
					{ticked > 0
						? isHindi
							? `सब सही हैं — ${ticked} भरें`
							: `All correct — fill ${ticked}`
						: isHindi
							? "आगे बढ़ें"
							: "Next"}
				</button>
			</div>
		);
	} else if (phase === "review") {
		body = (
			<div className="space-y-3">
				<div>
					<p className="text-base font-bold text-slate-800 dark:text-white">
						{live.length === 0
							? isHindi
								? "सबके रिश्ते भरे हुए हैं ✓"
								: "Every relation is filled in ✓"
							: isHindi
								? "आपके परिवार के रिश्ते"
								: "Your family's relations"}
					</p>
					<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-1">
						{isHindi
							? "किसी का रिश्ता बदलना या भरना हो तो उनके नाम पर दबाएँ।"
							: "Tap a name to change or fill in their relation."}
					</p>
				</div>
				<ul className="space-y-2">
					{members.map((m) => {
						const rel = myRelations?.[m.id];
						return (
							<li key={m.id}>
								<button
									type="button"
									onClick={() => onEdit(m.id)}
									className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:scale-[0.99] transition"
								>
									{avatar(m.id, "w-10 h-10")}
									<span className="flex-1 min-w-0">
										<span className="block text-sm font-bold text-slate-800 dark:text-white truncate">
											{nameOf(m.id)}
										</span>
										<span
											className={`block text-xs font-bold ${
												rel
													? "text-blue-700 dark:text-blue-300"
													: "text-amber-600 dark:text-amber-400"
											}`}
										>
											{rel
												? label(rel)
												: isHindi
													? "रिश्ता नहीं भरा"
													: "Not filled in"}
										</span>
									</span>
									<ChevronRight size={18} className="shrink-0 text-slate-400" />
								</button>
							</li>
						);
					})}
				</ul>
				<button
					type="button"
					onClick={onClose}
					className="w-full min-h-[52px] rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold active:scale-95 transition"
				>
					{isHindi ? "ठीक है" : "OK"}
				</button>
			</div>
		);
	} else if (done) {
		body = (
			<div className="text-center space-y-3 py-4">
				<Sparkles className="mx-auto text-amber-400" size={40} />
				<p className="text-lg font-bold text-slate-800 dark:text-white">
					{savedCount > 0
						? isHindi
							? `हो गया! ${savedCount} रिश्ते भरे 🙏`
							: `Done! ${savedCount} relation${savedCount === 1 ? "" : "s"} filled 🙏`
						: isHindi
							? "अभी के लिए बस इतना"
							: "That's all for now"}
				</p>
				{skippedCount > 0 && (
					<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
						{isHindi
							? `${skippedCount} बाकी हैं — जब पता हो, प्रोफ़ाइल में उनके नाम पर “रिश्ता जोड़ें” दबाएँ।`
							: `${skippedCount} left — when you know, tap “Add relation” on their name in your profile.`}
					</p>
				)}
				<button
					type="button"
					onClick={onClose}
					className="w-full min-h-[52px] rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold active:scale-95 transition"
				>
					{isHindi ? "ठीक है" : "OK"}
				</button>
				<button
					type="button"
					onClick={() => setPhase("review")}
					className="w-full min-h-touch text-sm font-bold text-blue-600 dark:text-blue-400"
				>
					{isHindi ? "सबके रिश्ते देखें" : "See everyone's relation"}
				</button>
			</div>
		);
	} else {
		const q = liveById.get(current);
		// No name worked out: "relative" still fits anyone in the linked family.
		const options = q?.options.length ? q.options : ["relative"];
		body = (
			<div className="space-y-4">
				{total > 1 && (
					<div className="flex items-center gap-2">
						<div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
							<div
								className="h-full bg-blue-500 transition-all"
								style={{ width: `${((step - 1) / total) * 100}%` }}
							/>
						</div>
						<span className="text-[11px] font-bold text-slate-400 tabular-nums">
							{step} / {total}
						</span>
					</div>
				)}
				<div className="flex items-center gap-3">
					{avatar(current, "w-14 h-14")}
					<div className="min-w-0">
						<p className="text-base font-bold text-slate-800 dark:text-white truncate">
							{nameOf(current)}
						</p>
						<p className="text-sm text-slate-600 dark:text-slate-300">
							{isHindi ? "ये आपके क्या लगते हैं?" : "How are they related to you?"}
						</p>
					</div>
				</div>
				{q?.reason && (
					<p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
						💡 {reasonText(q.reason, current)}
					</p>
				)}
				{!other && (
					<div className="grid gap-2">
						{options.map((rel) => (
							<button
								key={rel}
								type="button"
								disabled={busy}
								onClick={() => answer(current, rel)}
								className="min-h-[52px] px-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-200 font-bold text-left flex items-center justify-between gap-2 active:scale-[0.98] transition disabled:opacity-50"
							>
								{label(rel)}
								<ChevronRight size={18} className="shrink-0 opacity-60" />
							</button>
						))}
						<button
							type="button"
							disabled={busy}
							onClick={() => setOther(true)}
							className="min-h-[48px] px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold text-left"
						>
							{options.length > 0
								? isHindi
									? "कुछ और…"
									: "Something else…"
								: isHindi
									? "रिश्ता चुनें…"
									: "Pick the relation…"}
						</button>
					</div>
				)}
				{other && (
					<div className="space-y-3">
						<RelationPicker
							value={otherValue}
							onChange={setOtherValue}
							isHindi={isHindi}
							accent="blue"
							suggestions={options}
						/>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => {
									setOther(false);
									setOtherValue("");
								}}
								className="flex-1 min-h-touch rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
							>
								{isHindi ? "वापस" : "Back"}
							</button>
							<button
								type="button"
								disabled={busy || !otherValue}
								onClick={() => answer(current, otherValue)}
								className="flex-[2] min-h-touch rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2"
							>
								{busy ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<Check size={16} />
								)}
								{isHindi ? "सहेजें" : "Save"}
							</button>
						</div>
					</div>
				)}
				<button
					type="button"
					disabled={busy}
					onClick={() => skip(current)}
					className="w-full min-h-touch text-sm font-bold text-slate-500 dark:text-slate-400"
				>
					{isHindi ? "पता नहीं / बाद में" : "Not sure / later"}
				</button>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center sm:p-4">
			<button
				type="button"
				aria-label={isHindi ? "बंद करें" : "Close"}
				onClick={onClose}
				className="absolute inset-0 w-full h-full cursor-default"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={isHindi ? "रिश्ते पूरे करें" : "Complete relations"}
				className="relative bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300"
			>
				<div className="flex items-center justify-between gap-3 mb-4">
					<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
						<Sparkles size={18} className="text-blue-500" />
						{isHindi ? "रिश्ते पूरे करें" : "Complete relations"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						aria-label={isHindi ? "बंद करें" : "Close"}
						className="min-w-touch min-h-touch flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
					>
						<X size={20} />
					</button>
				</div>
				{body}
			</div>
		</div>
	);
};

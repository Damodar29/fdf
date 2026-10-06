import {
	ArrowLeft,
	GitBranch,
	Layers,
	Link2,
	Network,
	User,
	X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
	getRelationLabel,
	relationGeneration,
} from "../../src/constants/relations";
import { ThumbImg } from "../ui/ThumbImg";

export interface FamilyTreePerson {
	key: string;
	name: string;
	photoURL?: string;
	/** How this person is related to the devotee (their own view). */
	relation?: string;
	/** An app account linked to the devotee (vs a member they added by hand). */
	linked: boolean;
	/** Key of the person this one was linked through (automatic family links). */
	via?: string;
	/** Likely relation when none is set (e.g. through the person in between). */
	suggested?: string;
}

interface FamilyTreeViewProps {
	isHindi: boolean;
	me: { name: string; photoURL?: string };
	people: FamilyTreePerson[];
	onClose: () => void;
	/** Tap on a person to set their relation; omit to make cards plain. */
	onPersonTap?: (person: FamilyTreePerson) => void;
	/**
	 * Admin view (Family Explorer): the tree is someone else's, so "You" is
	 * replaced by these. Leave out for the devotee's own tree.
	 */
	labels?: {
		title?: string;
		/** Caption under the centre person instead of "You". */
		me?: string;
		/** Row name for the centre's generation instead of "Your generation". */
		ownGeneration?: string;
		/** Hint above the tree when onPersonTap is given. */
		tapHint?: string;
	};
	/** Shows a back arrow in the header (admin: back to the previous person). */
	onBack?: () => void;
	/** Extra button in the header, before Close (admin: edit this profile). */
	headerAction?: React.ReactNode;
}

type View = "generations" | "connections";

const GENERATIONS: { level: number; en: string; hi: string }[] = [
	{ level: 3, en: "Great-grandparents", hi: "परदादा / परनाना" },
	{ level: 2, en: "Grandparents", hi: "दादा-दादी / नाना-नानी" },
	{ level: 1, en: "Parents' generation", hi: "माता-पिता की पीढ़ी" },
	{ level: 0, en: "Your generation", hi: "आपकी पीढ़ी" },
	{ level: -1, en: "Children", hi: "बच्चे" },
	{ level: -2, en: "Grandchildren", hi: "पोते-पोती / नाती-नातिन" },
	{ level: -3, en: "Great-grandchildren", hi: "परपोते / परनाती" },
];

// Spouse first beside "You", then siblings and cousins.
const SPOUSE = new Set(["husband", "wife"]);

/** "मौसेरा भाई" for a set relation, "मौसेरा भाई?" for a likely one. */
const captionFor = (p: FamilyTreePerson, isHindi: boolean) => {
	if (p.relation) return getRelationLabel(p.relation, isHindi);
	if (p.suggested) return `${getRelationLabel(p.suggested, isHindi)}?`;
	return isHindi ? "रिश्ता?" : "Relation?";
};

const Avatar: React.FC<{
	name: string;
	photoURL?: string;
	size: "sm" | "md";
	highlight?: boolean;
	dashed?: boolean;
}> = ({ name, photoURL, size, highlight, dashed }) => (
	<div
		className={`relative ${size === "md" ? "w-14 h-14" : "w-10 h-10"} shrink-0 rounded-full overflow-hidden border-2 shadow-sm ${
			highlight
				? "border-pink-500 ring-4 ring-pink-500/20"
				: dashed
					? "border-dashed border-slate-300 dark:border-slate-600"
					: "border-white dark:border-slate-700"
		} bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}
	>
		{photoURL ? (
			<ThumbImg src={photoURL} alt="" className="w-full h-full object-cover" />
		) : name.trim() ? (
			<span
				className={`${size === "md" ? "text-lg" : "text-sm"} font-bold text-slate-500 dark:text-ink-300`}
			>
				{name.trim().charAt(0).toUpperCase()}
			</span>
		) : (
			<User size={size === "md" ? 22 : 16} className="text-slate-400" />
		)}
	</div>
);

const LinkedTag: React.FC<{ isHindi: boolean }> = ({ isHindi }) => (
	<span
		className="inline-flex items-center gap-0.5 text-[9px] text-blue-500"
		title={isHindi ? "ऐप पर लिंक्ड" : "Linked on the app"}
	>
		<Link2 size={9} />
		{isHindi ? "लिंक्ड" : "Linked"}
	</span>
);

/** One person in the generation view. */
const PersonCard: React.FC<{
	person?: FamilyTreePerson;
	name: string;
	photoURL?: string;
	caption: string;
	highlight?: boolean;
	isHindi: boolean;
	onTap?: () => void;
}> = ({ person, name, photoURL, caption, highlight, isHindi, onTap }) => {
	const guessed = !!person && !person.relation;
	const body = (
		<>
			<Avatar
				name={name}
				photoURL={photoURL}
				size="md"
				highlight={highlight}
				dashed={guessed}
			/>
			<p className="mt-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-tight line-clamp-2 break-words">
				{name || "—"}
			</p>
			<p
				className={`text-[10px] leading-tight mt-0.5 ${
					highlight
						? "text-pink-500 font-bold"
						: guessed
							? "text-amber-600 dark:text-amber-400 italic"
							: "text-slate-500 dark:text-slate-400"
				}`}
			>
				{caption}
			</p>
			{person?.linked && <LinkedTag isHindi={isHindi} />}
		</>
	);
	const className = "w-[84px] flex flex-col items-center text-center";
	return onTap ? (
		<button
			type="button"
			onClick={onTap}
			className={`${className} rounded-2xl p-1 -m-1 active:scale-95 transition`}
		>
			{body}
		</button>
	) : (
		<div className={className}>{body}</div>
	);
};

/** One row of the connections view, with its branch below. */
const ConnectionNode: React.FC<{
	person: FamilyTreePerson;
	childrenOf: (key: string) => FamilyTreePerson[];
	seen: Set<string>;
	isHindi: boolean;
	onPersonTap?: (person: FamilyTreePerson) => void;
}> = ({ person, childrenOf, seen, isHindi, onPersonTap }) => {
	// A marker loop in old data must not recurse forever.
	const kids = childrenOf(person.key).filter((k) => !seen.has(k.key));
	const nextSeen = new Set([...seen, ...kids.map((k) => k.key)]);
	const row = (
		<>
			<Avatar
				name={person.name}
				photoURL={person.photoURL}
				size="sm"
				dashed={!person.relation}
			/>
			<span className="min-w-0 flex-1 text-left">
				<span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
					{person.name || "—"}
				</span>
				<span className="flex items-center gap-1.5 flex-wrap">
					<span
						className={`text-[11px] ${
							person.relation
								? "text-slate-500 dark:text-slate-400"
								: "text-amber-600 dark:text-amber-400 italic"
						}`}
					>
						{captionFor(person, isHindi)}
					</span>
					{person.linked && <LinkedTag isHindi={isHindi} />}
					{kids.length > 0 && (
						<span className="text-[10px] text-slate-400 dark:text-ink-400">
							{isHindi
								? `· ${kids.length} इनके ज़रिए`
								: `· ${kids.length} through them`}
						</span>
					)}
				</span>
			</span>
		</>
	);
	return (
		<li className="relative before:absolute before:-left-3 before:top-6 before:w-3 before:h-px before:bg-pink-300 dark:before:bg-pink-800">
			{onPersonTap ? (
				<button
					type="button"
					onClick={() => onPersonTap(person)}
					className="w-full min-h-touch flex items-center gap-3 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 px-3 py-2 active:scale-[0.98] transition"
				>
					{row}
				</button>
			) : (
				<div className="w-full min-h-touch flex items-center gap-3 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 px-3 py-2">
					{row}
				</div>
			)}
			{kids.length > 0 && (
				<ul className="mt-2 ml-5 pl-3 border-l-2 border-pink-200 dark:border-pink-900 space-y-2">
					{kids.map((kid) => (
						<ConnectionNode
							key={kid.key}
							person={kid}
							childrenOf={childrenOf}
							seen={nextSeen}
							isHindi={isHindi}
							onPersonTap={onPersonTap}
						/>
					))}
				</ul>
			)}
		</li>
	);
};

/**
 * The devotee's family two ways: by generation (grandparents on top, then
 * parents, their own generation, children, grandchildren), or by connection
 * (who is linked through whom). A person without a relation is placed by a
 * likely one ("?") when there is one, else listed apart with a hint.
 */
export const FamilyTreeView: React.FC<FamilyTreeViewProps> = ({
	isHindi,
	me,
	people,
	onClose,
	onPersonTap,
	labels,
	onBack,
	headerAction,
}) => {
	const [view, setView] = useState<View>("generations");
	const meCaption = labels?.me || (isHindi ? "आप" : "You");

	const byLevel = new Map<number | null, FamilyTreePerson[]>();
	for (const person of people) {
		const level = relationGeneration(person.relation || person.suggested);
		byLevel.set(level, [...(byLevel.get(level) || []), person]);
	}
	const sameGen = byLevel.get(0) || [];
	byLevel.set(0, [
		...sameGen.filter((p) => SPOUSE.has(p.relation || "")),
		...sameGen.filter((p) => !SPOUSE.has(p.relation || "")),
	]);
	const rows = GENERATIONS.filter(
		(g) => g.level === 0 || (byLevel.get(g.level)?.length ?? 0) > 0,
	);
	const unplaced = byLevel.get(null) || [];

	// Connections: people linked through someone hang under that person.
	const keys = new Set(people.map((p) => p.key));
	const isDirect = (p: FamilyTreePerson) =>
		!p.via || !keys.has(p.via) || p.via === p.key;
	const childrenOf = (key: string) =>
		people.filter((p) => p.via === key && p.key !== key);
	const direct = people.filter(isDirect);
	// Anyone a loop of "linked through" markers would hide goes on top level.
	const reached = new Set(direct.map((p) => p.key));
	for (let i = 0, queue = [...reached]; i < queue.length; i++) {
		for (const kid of childrenOf(queue[i])) {
			if (reached.has(kid.key)) continue;
			reached.add(kid.key);
			queue.push(kid.key);
		}
	}
	direct.push(...people.filter((p) => !reached.has(p.key)));
	const anyVia = people.some((p) => !isDirect(p));

	const tab = (id: View, icon: React.ReactNode, hi: string, en: string) => (
		<button
			type="button"
			onClick={() => setView(id)}
			aria-pressed={view === id}
			className={`flex-1 min-h-touch flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${
				view === id
					? "bg-pink-500 text-white shadow-sm"
					: "text-slate-600 dark:text-slate-300"
			}`}
		>
			{icon}
			{isHindi ? hi : en}
		</button>
	);

	return createPortal(
		<div className="fixed inset-0 z-[300] bg-ry-sand dark:bg-ink-900 flex flex-col animate-in fade-in duration-200">
			<div className="shrink-0 flex items-center gap-3 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
				{onBack ? (
					<button
						type="button"
						onClick={onBack}
						aria-label={isHindi ? "पीछे" : "Back"}
						className="min-w-touch min-h-touch -ml-2 flex items-center justify-center rounded-full text-slate-500 dark:text-ink-300 active:scale-95"
					>
						<ArrowLeft size={20} />
					</button>
				) : (
					<Network size={20} className="text-pink-500 shrink-0" />
				)}
				<h2 className="flex-1 min-w-0 truncate font-bold text-slate-800 dark:text-white">
					{labels?.title || (isHindi ? "परिवार वृक्ष" : "Family Tree")}
				</h2>
				{headerAction}
				<button
					type="button"
					onClick={onClose}
					aria-label={isHindi ? "बंद करें" : "Close"}
					className="p-2 rounded-full text-slate-500 dark:text-ink-300 bg-slate-100 dark:bg-slate-800 active:scale-95"
				>
					<X size={18} />
				</button>
			</div>

			<div className="shrink-0 px-4 pt-3">
				<div className="max-w-lg mx-auto flex gap-1 p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
					{tab(
						"generations",
						<Layers size={14} />,
						"पीढ़ी के अनुसार",
						"By generation",
					)}
					{tab(
						"connections",
						<GitBranch size={14} />,
						"कौन किसके ज़रिए",
						"Who through whom",
					)}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-5">
				<div className="max-w-lg mx-auto">
					{people.length > 0 && (
						<p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mb-4 leading-snug">
							{onPersonTap
								? labels?.tapHint
									? `${labels.tapHint} ${isHindi ? "“?” = संभावित रिश्ता।" : "“?” = likely relation."}`
									: isHindi
										? "किसी पर दबाकर उसका रिश्ता चुनें। “?” = संभावित रिश्ता।"
										: "Tap someone to set their relation. “?” = likely relation."
								: isHindi
									? "“?” = संभावित रिश्ता।"
									: "“?” = likely relation."}
						</p>
					)}

					{view === "generations" ? (
						<div className="flex flex-col items-center">
							{rows.map((gen, index) => (
								<div
									key={gen.level}
									className="w-full flex flex-col items-center"
								>
									{index > 0 && (
										<div className="w-px h-6 bg-pink-300 dark:bg-pink-800" />
									)}
									<div
										className={`w-full rounded-3xl border px-3 py-3 ${
											gen.level === 0
												? "bg-pink-50/70 dark:bg-pink-500/5 border-pink-200 dark:border-pink-900"
												: "bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
										}`}
									>
										<p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-400 text-center mb-2">
											{gen.level === 0 && labels?.ownGeneration
												? labels.ownGeneration
												: isHindi
													? gen.hi
													: gen.en}
										</p>
										<div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
											{gen.level === 0 && (
												<PersonCard
													name={me.name}
													photoURL={me.photoURL}
													caption={meCaption}
													highlight
													isHindi={isHindi}
												/>
											)}
											{(byLevel.get(gen.level) || []).map((p) => (
												<PersonCard
													key={p.key}
													person={p}
													name={p.name}
													photoURL={p.photoURL}
													caption={captionFor(p, isHindi)}
													isHindi={isHindi}
													onTap={onPersonTap ? () => onPersonTap(p) : undefined}
												/>
											))}
										</div>
									</div>
								</div>
							))}

							{unplaced.length > 0 && (
								<div className="w-full mt-6 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 px-3 py-3">
									<p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-400 text-center">
										{isHindi
											? "अन्य / रिश्ता नहीं चुना"
											: "Others / relation not set"}
									</p>
									<p className="text-[10px] text-slate-400 dark:text-ink-400 text-center mb-2">
										{isHindi
											? "रिश्ता चुनने पर ये सही पीढ़ी में दिखेंगे"
											: "Set a relation to place them in the tree"}
									</p>
									<div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
										{unplaced.map((p) => (
											<PersonCard
												key={p.key}
												person={p}
												name={p.name}
												photoURL={p.photoURL}
												caption={captionFor(p, isHindi)}
												isHindi={isHindi}
												onTap={onPersonTap ? () => onPersonTap(p) : undefined}
											/>
										))}
									</div>
								</div>
							)}
						</div>
					) : (
						<div>
							<div className="flex items-center gap-3 rounded-2xl bg-pink-50/80 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-900 px-3 py-2">
								<Avatar
									name={me.name}
									photoURL={me.photoURL}
									size="sm"
									highlight
								/>
								<span className="min-w-0">
									<span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
										{me.name || "—"}
									</span>
									<span className="text-[11px] font-bold text-pink-500">
										{meCaption}
									</span>
								</span>
							</div>
							{direct.length > 0 && (
								<ul className="mt-2 ml-5 pl-3 border-l-2 border-pink-200 dark:border-pink-900 space-y-2">
									{direct.map((p) => (
										<ConnectionNode
											key={p.key}
											person={p}
											childrenOf={childrenOf}
											seen={new Set([p.key])}
											isHindi={isHindi}
											onPersonTap={onPersonTap}
										/>
									))}
								</ul>
							)}
							{!anyVia && people.length > 0 && (
								<p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 text-center leading-snug">
									{labels?.me
										? isHindi
											? `सब सीधे ${me.name || "इनसे"} से जुड़े हैं।`
											: `Everyone is linked to ${me.name || "them"} directly.`
										: isHindi
											? "सब सीधे आपसे जुड़े हैं। किसी और के ज़रिए जुड़े लोग उनके नीचे दिखेंगे।"
											: "Everyone is linked to you directly. People linked through someone appear under them."}
								</p>
							)}
						</div>
					)}

					{people.length === 0 && (
						<p className="mt-6 text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed">
							{labels?.me
								? isHindi
									? "इनके परिवार में अभी कोई नहीं है।"
									: "No family members yet."
								: isHindi
									? "अभी परिवार में कोई नहीं है। परिवार के सदस्य जोड़ें या उनके अकाउंट लिंक करें।"
									: "No family yet. Add family members or link their accounts."}
						</p>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
};

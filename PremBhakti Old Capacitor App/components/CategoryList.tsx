import { ChevronRight, Users } from "lucide-react";
import React, { useMemo } from "react";
import { useData } from "../context/DataContext";
import type { Bhajan, ScriptType } from "../types";

interface CategoryListProps {
	bhajans: Bhajan[];
	onSelect: (bhajan: Bhajan) => void;
	script: ScriptType;
}

export const CategoryList: React.FC<CategoryListProps> = ({
	bhajans,
	onSelect,
	script,
}) => {
	const { knownAuthors } = useData();

	const groupedData = useMemo(() => {
		const groups: Record<string, Bhajan[]> = {};
		const miscKey = "Uncategorized";

		// Group directly by bhajan.author (now inline in each bhajan)
		bhajans.forEach((bhajan) => {
			const authorKey = bhajan.author || miscKey;
			if (!groups[authorKey]) groups[authorKey] = [];
			groups[authorKey].push(bhajan);
		});

		// Sort Keys: Known Authors first, then others, then Misc at bottom
		const keys = Object.keys(groups).sort((a, b) => {
			if (a === miscKey) return 1;
			if (b === miscKey) return -1;
			const nameA = knownAuthors[a]?.deva || a;
			const nameB = knownAuthors[b]?.deva || b;
			return nameA.localeCompare(nameB, "hi");
		});

		return { groups, keys, miscKey };
	}, [bhajans, knownAuthors]);

	const [expandedCategory, setExpandedCategory] = React.useState<string | null>(
		null,
	);

	const toggleCategory = (category: string) => {
		setExpandedCategory((prev) => (prev === category ? null : category));
	};

	const getCategoryDisplayName = (key: string) => {
		if (key === groupedData.miscKey) {
			return script === "iast" ? "Uncategorized" : "विविध / अन्य";
		}

		// Look up in KNOWN_AUTHORS
		if (knownAuthors[key]) {
			return script === "iast"
				? knownAuthors[key].iast
				: knownAuthors[key].deva;
		}

		return key;
	};

	return (
		<div className="pb-2 pt-2 landscape:lg:grid landscape:lg:grid-cols-2 landscape:lg:gap-3 landscape:lg:px-3 landscape:lg:items-start">
			{groupedData.keys.map((categoryKey, index) => {
				const delayStyle = { animationDelay: `${index * 30}ms` };
				const count = groupedData.groups[categoryKey].length;

				return (
					<div
						key={categoryKey}
						className="mb-2 bg-transparent border-y border-saffron-200 dark:border-slate-700 landscape:lg:mb-0 landscape:lg:border landscape:lg:rounded-2xl landscape:lg:overflow-hidden animate-fade-in-up opacity-0 fill-mode-forwards"
						style={delayStyle}
					>
						<button
							onClick={() => toggleCategory(categoryKey)}
							data-tour="library-author"
							className="w-full flex items-center justify-between p-4 hover:bg-saffron-50 dark:hover:bg-slate-800/50 transition-colors active:bg-saffron-100 dark:active:bg-slate-800"
						>
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-full bg-saffron-100 dark:bg-slate-800 text-saffron-600 dark:text-saffron-400 flex items-center justify-center">
									<Users size={16} />
								</div>
								<div className="text-left">
									<h3 className="font-bold text-slate-800 dark:text-slate-200">
										{getCategoryDisplayName(categoryKey)}
									</h3>
									<p className="text-xs text-slate-600 dark:text-slate-400">
										{count} {script === "iast" ? "Songs" : "भजन"}
									</p>
								</div>
							</div>
							<ChevronRight
								className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${expandedCategory === categoryKey ? "rotate-90" : ""}`}
							/>
						</button>

						{expandedCategory === categoryKey && (
							<ul className="divide-y divide-saffron-100 dark:divide-slate-800 border-t border-saffron-200 dark:border-slate-700 bg-transparent">
								{groupedData.groups[categoryKey].map((bhajan, bIndex) => (
									<li
										key={bhajan.id}
										className="animate-fade-in"
										style={{ animationDelay: `${bIndex * 20}ms` }}
									>
										<button
											onClick={() => onSelect(bhajan)}
											className="w-full text-left py-3 px-4 pl-14 hover:bg-saffron-50 dark:hover:bg-slate-800/50 transition-colors active:bg-saffron-100 dark:active:bg-slate-800"
										>
											<div className="text-slate-800 dark:text-slate-200 font-medium">
												{script === "iast" ? bhajan.titleIAST : bhajan.title}
											</div>
											<div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
												{script === "iast"
													? bhajan.firstLineIAST
													: bhajan.firstLine}
											</div>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				);
			})}
		</div>
	);
};

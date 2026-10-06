import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export const DeleteWithConfirm = ({
	onDelete,
	className,
	iconSize = 18,
}: {
	onDelete: () => void;
	className?: string;
	iconSize?: number;
}) => {
	const [confirming, setConfirming] = useState(false);

	useEffect(() => {
		if (confirming) {
			const timer = setTimeout(() => setConfirming(false), 3000);
			return () => clearTimeout(timer);
		}
	}, [confirming]);

	if (confirming) {
		return (
			<button
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onDelete();
				}}
				className={
					className ||
					"p-2 px-3 bg-red-600 text-white rounded-lg text-xs font-bold animate-in fade-in"
				}
			>
				Confirm?
			</button>
		);
	}

	return (
		<button
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				setConfirming(true);
			}}
			className={
				className ||
				"p-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
			}
		>
			<Trash2 size={iconSize} />
		</button>
	);
};

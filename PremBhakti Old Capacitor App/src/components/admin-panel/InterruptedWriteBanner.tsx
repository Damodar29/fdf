/**
 * Warns the admin when the last save / rebuild for a data type never finished
 * (app closed or killed mid-way, or it failed after starting to write). The
 * marker is set by markWriteStarted() and cleared by markWriteFinished() in
 * utils/firebaseDataStorage.ts.
 */

import { AlertTriangle } from "lucide-react";
import type React from "react";
import { getPendingWrite } from "../../../utils/firebaseDataStorage";

interface InterruptedWriteBannerProps {
	/** Storage tag, e.g. "bhajandata" */
	tag: string;
	/** Hide while an operation is running (its own marker is expected then). */
	busy: boolean;
	isHindi?: boolean;
	/** What fixes it, e.g. "press Rebuild Bundle" */
	fixHintEn: string;
	fixHintHi: string;
}

export const InterruptedWriteBanner: React.FC<InterruptedWriteBannerProps> = ({
	tag,
	busy,
	isHindi,
	fixHintEn,
	fixHintHi,
}) => {
	if (busy) return null;
	const pending = getPendingWrite(tag);
	if (!pending) return null;
	const when = new Date(pending.startedAt).toLocaleString(
		isHindi ? "hi-IN" : "en-IN",
	);
	return (
		<div className="mx-4 mt-3 mb-1 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 flex gap-2 text-amber-800 dark:text-amber-200">
			<AlertTriangle size={18} className="shrink-0 mt-0.5" />
			<p className="text-xs font-medium leading-relaxed">
				{isHindi
					? `पिछला काम ("${pending.label}", ${when}) पूरा नहीं हुआ — शायद ऐप बीच में बंद हो गया। डेटा अधूरा हो सकता है, कृपया ${fixHintHi}।`
					: `The last operation ("${pending.label}", ${when}) did not finish — the app was probably closed mid-way. Data may be incomplete; please ${fixHintEn}.`}
			</p>
		</div>
	);
};

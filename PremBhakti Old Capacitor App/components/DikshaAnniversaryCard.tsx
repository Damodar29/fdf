import { doc, getDoc } from "firebase/firestore";
import { Flower2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebase";
import { MANDAL_LIST } from "../src/types/mandal";
import {
	anniversaryYears,
	istToday,
	parseDikshaDate,
} from "../utils/dikshaDate";
import { THUMB } from "../utils/imageThumb";
import { safeLocalGet, safeLocalSet } from "../utils/safeLocalSet";
import { useThumbSrc } from "./ui/ThumbImg";

/** One devotee in diksha_anniversaries/{day} (see functions/src/dikshaAnniversary.ts). */
interface AnniversaryEntry {
	name: string;
	dikshaName?: string;
	photoURL?: string;
	mandalId?: string;
	customMandalName?: string;
	years: number;
}

const CACHE_KEY = "diksha_anniversaries_v1";
// An empty or missing day is asked again after this long (the list is made
// just after midnight, so an early opener would otherwise miss it all day).
const EMPTY_RETRY_MS = 60 * 60 * 1000;

interface Cached {
	id: string;
	fetchedAt: number;
	devotees: AnniversaryEntry[];
}

const readCache = (): Cached | null => {
	try {
		const raw = safeLocalGet(CACHE_KEY);
		return raw ? (JSON.parse(raw) as Cached) : null;
	} catch {
		return null;
	}
};

/** Today's list: one read a day per device (cached), none when offline. */
function useTodaysAnniversaries(dayId: string) {
	const [devotees, setDevotees] = useState<AnniversaryEntry[]>(() => {
		const cached = readCache();
		return cached?.id === dayId ? cached.devotees : [];
	});

	useEffect(() => {
		const cached = readCache();
		if (
			cached?.id === dayId &&
			(cached.devotees.length > 0 ||
				Date.now() - cached.fetchedAt < EMPTY_RETRY_MS)
		) {
			setDevotees(cached.devotees);
			return;
		}
		let cancelled = false;
		getDoc(doc(db, "diksha_anniversaries", dayId))
			.then((snap) => {
				const list = snap.exists()
					? (snap.data().devotees as AnniversaryEntry[] | undefined)
					: undefined;
				const clean = Array.isArray(list)
					? list.filter((d) => d && typeof d.name === "string")
					: [];
				safeLocalSet(
					CACHE_KEY,
					JSON.stringify({ id: dayId, fetchedAt: Date.now(), devotees: clean }),
				);
				if (!cancelled) setDevotees(clean);
			})
			.catch((e) => {
				console.warn("[Diksha] anniversaries not loaded", e);
				// Offline: try again next visit. Refused (rules not deployed
				// yet): don't ask on every Home visit — retry after an hour.
				if (e?.code !== "permission-denied") return;
				safeLocalSet(
					CACHE_KEY,
					JSON.stringify({ id: dayId, fetchedAt: Date.now(), devotees: [] }),
				);
			});
		return () => {
			cancelled = true;
		};
	}, [dayId]);

	return devotees;
}

/**
 * Photo as a CSS background, not an <img>: no long-press "save image", no
 * drag, nothing to tap open. (A screenshot can't be prevented.)
 */
const ProtectedAvatar: React.FC<{ name: string; photoURL?: string }> = ({
	name,
	photoURL,
}) => {
	// A small resized copy, not the full upload. A CSS background has no error
	// event, so a hidden probe <img> tells us when to fall back to the original.
	const thumb = useThumbSrc(photoURL, THUMB.small);
	return (
		<div
			role="img"
			aria-label={name}
			className="w-16 h-16 rounded-full border-[3px] border-gold-300 dark:border-gold-300/60 shadow-md bg-cream-100 dark:bg-ink-700 bg-cover bg-center flex items-center justify-center select-none pointer-events-none"
			style={
				thumb.src
					? {
							backgroundImage: `url("${thumb.src.replace(/"/g, "%22")}")`,
							WebkitTouchCallout: "none",
						}
					: { WebkitTouchCallout: "none" }
			}
		>
			{thumb.onError && (
				<img src={thumb.src} alt="" hidden onError={thumb.onError} />
			)}
			{!photoURL && (
				<span className="text-xl font-bold text-krishna-600 dark:text-gold-300">
					{name.trim().charAt(0).toUpperCase()}
				</span>
			)}
		</div>
	);
};

const mandalLabel = (d: AnniversaryEntry, isHindi: boolean) => {
	if (d.mandalId === "custom") return d.customMandalName || "";
	const m = MANDAL_LIST.find((x) => x.id === d.mandalId);
	return m ? (isHindi ? m.shortNameHi : m.shortNameEn) : "";
};

const yearsLabel = (years: number, isHindi: boolean) =>
	isHindi ? `${years} वर्ष` : `${years} ${years === 1 ? "year" : "years"}`;

/**
 * Home screen: devotees whose diksha anniversary is today, for everyone to
 * see, with a greeting of its own for a devotee whose day it is. Renders
 * nothing on other days.
 */
export const DikshaAnniversaryCard: React.FC<{ isHindi: boolean }> = ({
	isHindi,
}) => {
	const today = istToday();
	const devotees = useTodaysAnniversaries(today.id);
	const { profile } = useAuth();

	// The devotee's own day, worked out on the device — no need to find them
	// in the public list.
	const myYears =
		profile?.isApproved && !profile.isAspiring
			? anniversaryYears(parseDikshaDate(profile.dikshaDate), today)
			: 0;

	if (devotees.length === 0 && myYears < 1) return null;

	return (
		<section
			className="relative overflow-hidden rounded-3xl border border-gold-300/60 dark:border-gold-300/25 bg-gradient-to-b from-cream-50 to-cream-100 dark:from-ink-800 dark:to-ink-800/80 shadow-lg"
			onContextMenu={(e) => e.preventDefault()}
			aria-label={isHindi ? "आज दीक्षा वर्षगांठ" : "Diksha anniversaries today"}
			data-tour="home-diksha"
		>
			<div className="px-5 pt-5 pb-4 text-center">
				<div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-gold-100 dark:bg-gold-300/10 text-gold-700 dark:text-gold-300">
					<Flower2 size={22} />
				</div>
				<h2 className="font-display text-lg font-semibold text-krishna-700 dark:text-gold-300">
					{isHindi ? "आज दीक्षा वर्षगांठ" : "Diksha anniversary today"}
				</h2>

				{myYears >= 1 && (
					<div className="mt-3 rounded-2xl border border-gold-300 dark:border-gold-300/40 bg-gold-50 dark:bg-gold-300/10 px-4 py-3">
						<p className="text-sm font-bold text-gold-800 dark:text-gold-200 leading-relaxed">
							{isHindi
								? `🌸 आज आपकी दीक्षा को ${myYears} वर्ष पूर्ण हुए!`
								: `🌸 Today marks ${myYears} ${myYears === 1 ? "year" : "years"} since your diksha!`}
						</p>
						<p className="mt-1 text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
							{isHindi
								? "गुरु महाराज जी की कृपा और प्रेम सदा आप पर बरसता रहे। राधेश्याम 🙏"
								: "May Guru Maharaj Ji's grace and love always be with you. Radheshyam 🙏"}
						</p>
					</div>
				)}

				{devotees.length > 0 && (
					<p className="mt-2 text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
						{isHindi
							? "आज इन भक्तों की दीक्षा वर्षगांठ है — सभी को हार्दिक बधाई! राधेश्याम 🙏"
							: "Today is the diksha anniversary of these devotees — heartfelt wishes to all! Radheshyam 🙏"}
					</p>
				)}
			</div>

			{devotees.length > 0 && (
				<div className="flex gap-3 overflow-x-auto px-5 pb-5 snap-x scrollbar-hide">
					{devotees.map((d, i) => (
						<div
							key={`${d.name}-${i}`}
							className="snap-start shrink-0 w-24 flex flex-col items-center text-center"
						>
							<ProtectedAvatar name={d.name} photoURL={d.photoURL} />
							<p className="mt-1.5 text-xs font-bold text-ink-900 dark:text-cream-50 leading-tight line-clamp-2 break-words">
								{d.name}
							</p>
							{mandalLabel(d, isHindi) && (
								<p className="text-[10px] text-ink-500 dark:text-ink-400 leading-tight truncate w-full">
									{mandalLabel(d, isHindi)}
								</p>
							)}
							<span className="mt-1 inline-flex items-center rounded-full bg-gold-100 dark:bg-gold-300/10 border border-gold-300/60 dark:border-gold-300/25 px-2 py-0.5 text-[10px] font-bold text-gold-800 dark:text-gold-300">
								{yearsLabel(d.years, isHindi)}
							</span>
						</div>
					))}
				</div>
			)}
		</section>
	);
};

import { GitMerge, Loader2, X } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import type { UserProfile } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import { samePerson } from "../../../../utils/personMatch";
import { usePopupBackHandler } from "../../../hooks/usePopupBackHandler";
import type { LoginInfo } from "../loginMethods";
import { loginSummary } from "../LoginMethodsBar";
import { mergeProfiles } from "./cleanupWrites";
import { Avatar, mandalLabel, personName, Tag } from "./PersonBits";

const FIELDS: [keyof UserProfile, string, string][] = [
	["realName", "नाम", "Name"],
	["dikshaName", "दीक्षित नाम", "Diksha name"],
	["guruName", "गुरु", "Guru"],
	["dikshaDate", "दीक्षा तिथि", "Diksha date"],
	["phoneNumber", "फ़ोन", "Phone"],
	["email", "ईमेल", "Email"],
	["photoURL", "फ़ोटो", "Photo"],
	["gender", "लिंग", "Gender"],
	["mandalId", "मंडल", "Mandal"],
	["personalExperience", "अनुभव", "Experience"],
];

const blank = (v: unknown) =>
	v === undefined ||
	v === null ||
	(typeof v === "string" && (!v.trim() || v.trim() === "+91"));

/** How complete a profile is — the fuller one is suggested to keep. */
const fullness = (p: UserProfile, login?: LoginInfo) =>
	(p.isApproved ? 100 : 0) +
	FIELDS.filter(([f]) => !blank(p[f])).length * 5 +
	(p.linkedFamilyMembers?.length || 0) * 3 +
	(p.familyMembers?.length || 0) * 2 +
	(login?.google ? 2 : 0) +
	(login?.phone ? 2 : 0);

/**
 * Two profiles of one devotee → one. The admin picks which to keep (the
 * fuller one is picked first), sees exactly what will happen, then confirms.
 */
export const MergeSheet: React.FC<{
	a: UserProfile;
	b: UserProfile;
	logins: Record<string, LoginInfo> | null;
	isHindi: boolean;
	onClose: () => void;
	onDone: () => void;
}> = ({ a, b, logins, isHindi, onClose, onDone }) => {
	const { showToast } = useToast();
	const [keepUid, setKeepUid] = useState(() =>
		fullness(b, logins?.[b.uid]) > fullness(a, logins?.[a.uid]) ? b.uid : a.uid,
	);
	const [moveLogins, setMoveLogins] = useState(true);
	const [working, setWorking] = useState(false);
	const close = usePopupBackHandler(true, "cleanup-merge", onClose);

	const keep = keepUid === a.uid ? a : b;
	const drop = keepUid === a.uid ? b : a;
	const keepLogin = logins?.[keep.uid];
	const dropLogin = logins?.[drop.uid];

	const plan = useMemo(() => {
		const filled = FIELDS.filter(
			([f]) => blank(keep[f]) && !blank(drop[f]),
		).map(([, hi, en]) => (isHindi ? hi : en));
		const keepMembers = keep.familyMembers || [];
		const members = (drop.familyMembers || []).filter(
			(m) => !keepMembers.some((k) => samePerson(k, m)) && !samePerson(m, keep),
		);
		const links = (drop.linkedFamilyMembers || []).filter(
			(x) => x !== keep.uid && !(keep.linkedFamilyMembers || []).includes(x),
		);
		let login: "move" | "stuck" | "none" | "unknown" = "none";
		if (!logins) login = "unknown";
		else if (dropLogin && (dropLogin.google || dropLogin.phone)) {
			const canGoogle = dropLogin.google && !keepLogin?.google;
			const canPhone = dropLogin.phone && !keepLogin?.phone;
			const blocked =
				(dropLogin.google && !canGoogle) ||
				(dropLogin.phone && !canPhone) ||
				dropLogin.password ||
				!keepLogin;
			login = blocked ? "stuck" : "move";
		}
		return {
			filled,
			members,
			links,
			approval: !keep.isApproved && !!drop.isApproved,
			login,
		};
	}, [keep, drop, logins, keepLogin, dropLogin, isHindi]);

	const run = async () => {
		setWorking(true);
		try {
			const r = await mergeProfiles(keep.uid, drop.uid, moveLogins);
			const moved = r.logins.moved.length > 0;
			showToast(
				isHindi
					? `एक कर दिया ✅${moved ? " — दोनों लॉगिन अब एक ही खाते में" : r.logins.left.length ? " — पुराने लॉगिन से खोलने पर सही लॉगिन बताया जाएगा" : ""}`
					: `Merged ✅${moved ? " — both logins now open one account" : r.logins.left.length ? " — the old login will be told which login to use" : ""}`,
				"success",
			);
			if (r.logins.error)
				showToast(
					isHindi
						? "प्रोफ़ाइल एक हो गई, पर लॉगिन जोड़ने में दिक्कत आई — merge log देखें।"
						: "Profiles merged, but moving the login failed — see the merge log.",
					"error",
				);
			onDone();
			close();
		} catch (e) {
			const code = (e as { code?: string })?.code || "";
			console.error("[Merge] failed", e);
			showToast(
				code === "functions/permission-denied"
					? isHindi
						? "सिर्फ़ सुपर एडमिन एक कर सकते हैं"
						: "Only super admins can merge"
					: isHindi
						? "एक नहीं हो सका, कुछ नहीं बदला — दोबारा कोशिश करें (फ़ंक्शन deploy है?)"
						: "Could not merge, nothing changed — try again (is the function deployed?)",
				"error",
			);
		} finally {
			setWorking(false);
		}
	};

	const option = (p: UserProfile) => {
		const login = logins?.[p.uid];
		const selected = p.uid === keepUid;
		return (
			<button
				key={p.uid}
				type="button"
				onClick={() => setKeepUid(p.uid)}
				aria-pressed={selected}
				className={`w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 transition ${
					selected
						? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/10"
						: "border-slate-200 dark:border-slate-700"
				}`}
			>
				<Avatar photoURL={p.photoURL} name={personName(p)} size="w-12 h-12" />
				<div className="flex-1 min-w-0 space-y-0.5">
					<p className="text-sm font-bold text-slate-800 dark:text-white truncate">
						{personName(p)}
					</p>
					<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
						{[
							p.dikshaName && p.dikshaName !== p.realName ? p.dikshaName : "",
							mandalLabel(p, isHindi),
							p.dikshaDate,
						]
							.filter(Boolean)
							.join(" · ")}
					</p>
					<p className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
						{login
							? `${isHindi ? "लॉगिन" : "Login"}: ${loginSummary(login, isHindi)}`
							: logins
								? isHindi
									? "लॉगिन खाता नहीं"
									: "No login account"
								: ""}
					</p>
					<div className="flex flex-wrap gap-1 pt-0.5">
						{p.isApproved ? (
							<Tag tone="emerald">{isHindi ? "स्वीकृत" : "Approved"}</Tag>
						) : (
							<Tag tone="amber">{isHindi ? "लंबित" : "Pending"}</Tag>
						)}
						{(p.linkedFamilyMembers?.length || 0) > 0 && (
							<Tag tone="blue">🔗 {p.linkedFamilyMembers?.length}</Tag>
						)}
						{(p.familyMembers?.length || 0) > 0 && (
							<Tag>👪 {p.familyMembers?.length}</Tag>
						)}
					</div>
				</div>
				<span
					className={`shrink-0 text-[11px] font-bold ${selected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}
				>
					{selected
						? isHindi
							? "✓ यही रखें"
							: "✓ Keep"
						: isHindi
							? "चुनें"
							: "Pick"}
				</span>
			</button>
		);
	};

	return (
		<div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-3">
			<button
				type="button"
				tabIndex={-1}
				aria-label={isHindi ? "बंद करें" : "Close"}
				onClick={() => !working && close()}
				className="absolute inset-0 bg-black/60 cursor-default"
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4"
			>
				<div className="flex items-center justify-between gap-3">
					<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
						<GitMerge size={18} className="text-emerald-500" />
						{isHindi ? "दोनों प्रोफ़ाइल एक करें" : "Merge the two profiles"}
					</h3>
					<button
						type="button"
						onClick={close}
						disabled={working}
						aria-label={isHindi ? "बंद करें" : "Close"}
						className="min-w-touch min-h-touch -mr-2 flex items-center justify-center text-slate-400"
					>
						<X size={20} />
					</button>
				</div>

				<div className="space-y-2">
					<p className="text-xs font-bold text-slate-500 dark:text-slate-400">
						{isHindi ? "कौन-सी प्रोफ़ाइल रखनी है?" : "Which profile to keep?"}
					</p>
					{option(a)}
					{option(b)}
				</div>

				<div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-1.5 text-[12px] text-slate-700 dark:text-slate-200">
					<p className="font-bold">{isHindi ? "क्या होगा:" : "What happens:"}</p>
					<ul className="space-y-1 list-disc pl-4">
						<li>
							{isHindi
								? `“${personName(keep)}” रहेगी; “${personName(drop)}” वाली प्रोफ़ाइल हट जाएगी (उसका डेटा रिकॉर्ड में सुरक्षित रहेगा)।`
								: `“${personName(keep)}” stays; the “${personName(drop)}” profile goes (its data stays on record).`}
						</li>
						{plan.filled.length > 0 && (
							<li>
								{isHindi
									? `खाली जगहें भरेंगी: ${plan.filled.join(", ")} (जो भरा है वह नहीं बदलेगा)`
									: `Empty fields filled: ${plan.filled.join(", ")} (nothing filled is changed)`}
							</li>
						)}
						{plan.approval && (
							<li>
								{isHindi
									? "स्वीकृति (approval) भी आ जाएगी"
									: "Approval carries over"}
							</li>
						)}
						{plan.members.length > 0 && (
							<li>
								{isHindi
									? `परिवारजन जुड़ेंगे: ${plan.members.map((m) => m.realName).join(", ")}`
									: `Family members added: ${plan.members.map((m) => m.realName).join(", ")}`}
							</li>
						)}
						{plan.links.length > 0 && (
							<li>
								{isHindi
									? `${plan.links.length} जुड़े खाते (और उनके रिश्ते) इस खाते पर आ जाएँगे`
									: `${plan.links.length} linked account(s) (with relations) move to this one`}
							</li>
						)}
						{plan.login === "move" && moveLogins && (
							<li className="text-emerald-700 dark:text-emerald-400">
								{isHindi
									? `दूसरा लॉगिन (${dropLogin ? loginSummary(dropLogin, true) : ""}) भी इसी खाते में जुड़ जाएगा — भक्त किसी से भी लॉगिन करें, यही प्रोफ़ाइल खुलेगी।`
									: `The other login (${dropLogin ? loginSummary(dropLogin, false) : ""}) is added to this account — either login opens this profile.`}
							</li>
						)}
						{plan.login === "stuck" && (
							<li className="text-amber-700 dark:text-amber-400">
								{isHindi
									? "दोनों खातों में एक ही तरह का लॉगिन है (जैसे दो Google ईमेल) — एक खाते में एक ही रह सकता है। पुराने लॉगिन से खोलने पर भक्त को बताया जाएगा कि किससे लॉगिन करें।"
									: "Both accounts use the same kind of login (e.g. two Google emails) — an account can hold only one. Opening the old login tells the devotee which login to use."}
							</li>
						)}
						{plan.login === "unknown" && (
							<li>
								{isHindi
									? "लॉगिन जानकारी नहीं मिली — हो सका तो दूसरा लॉगिन इसी खाते में जुड़ जाएगा।"
									: "Login details not loaded — the other login is added to this account when possible."}
							</li>
						)}
					</ul>
				</div>

				{plan.login !== "none" && plan.login !== "stuck" && (
					<label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 min-h-touch">
						<input
							type="checkbox"
							checked={moveLogins}
							onChange={(e) => setMoveLogins(e.target.checked)}
							className="mt-0.5 w-5 h-5 accent-emerald-500 shrink-0"
						/>
						{isHindi
							? "दूसरा लॉगिन भी इसी खाते में जोड़ें (सुझाया गया)"
							: "Also add the other login to this account (recommended)"}
					</label>
				)}

				<button
					type="button"
					onClick={run}
					disabled={working}
					className="w-full min-h-touch rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2"
				>
					{working ? (
						<Loader2 size={18} className="animate-spin" />
					) : (
						<GitMerge size={18} />
					)}
					{isHindi ? "हाँ, दोनों को एक करें" : "Yes, merge them"}
				</button>
			</div>
		</div>
	);
};

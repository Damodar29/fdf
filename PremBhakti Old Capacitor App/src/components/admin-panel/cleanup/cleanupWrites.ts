/**
 * Writes behind Admin → "Duplicates & problems". Each one reads the current
 * profile inside a transaction first, so a fix never overwrites a change the
 * devotee (or another admin) made since the list was loaded.
 */
import {
	deleteField,
	doc,
	FieldPath,
	getDoc,
	runTransaction,
	setDoc,
	writeBatch,
} from "firebase/firestore";
import type { FamilyMember } from "../../../../context/AuthContext";
import { auth, db, functions } from "../../../../services/firebase";
import { normalizeRelation } from "../../../constants/relations";
import { familyLinkArgs, familyUnlinkArgs } from "../DevoteeProfileManager";

const userRef = (uid: string) => doc(db, "users", uid);

/**
 * Removes hand-added members from one profile. `fillKeep`: copy the photo /
 * diksha details of a removed repeat into the entry that stays, when it has
 * none.
 */
export async function removeMembers(
	uid: string,
	memberIds: string[],
	fillKeep?: { keepId: string; fromId: string },
): Promise<void> {
	await runTransaction(db, async (tx) => {
		const snap = await tx.get(userRef(uid));
		if (!snap.exists()) throw new Error("profile missing");
		const list: FamilyMember[] = Array.isArray(snap.data().familyMembers)
			? snap.data().familyMembers
			: [];
		let next = list;
		if (fillKeep) {
			const from = list.find((m) => m.id === fillKeep.fromId);
			if (from)
				next = next.map((m) =>
					m.id !== fillKeep.keepId
						? m
						: {
								...m,
								...(!m.photoURL && from.photoURL
									? { photoURL: from.photoURL }
									: {}),
								...(!m.dikshaDate && from.dikshaDate
									? { dikshaDate: from.dikshaDate }
									: {}),
								...(!m.dikshaName && from.dikshaName
									? { dikshaName: from.dikshaName }
									: {}),
								...(!m.guruName && from.guruName
									? { guruName: from.guruName }
									: {}),
								...(!m.relation && from.relation
									? { relation: from.relation }
									: {}),
							},
				);
		}
		next = next.filter((m) => !memberIds.includes(m.id));
		tx.update(userRef(uid), { familyMembers: next });
	});
}

/**
 * A member added by hand who is also a linked account: drop the hand-added
 * entry, keeping its relation on the link when the link has none.
 */
export async function dropTwinMember(
	uid: string,
	memberId: string,
	linkedUid: string,
): Promise<void> {
	await runTransaction(db, async (tx) => {
		const snap = await tx.get(userRef(uid));
		if (!snap.exists()) throw new Error("profile missing");
		const data = snap.data();
		const list: FamilyMember[] = Array.isArray(data.familyMembers)
			? data.familyMembers
			: [];
		const member = list.find((m) => m.id === memberId);
		const relation = normalizeRelation(member?.relation);
		const hasRelation = !!data.linkedFamilyRelations?.[linkedUid];
		tx.update(
			userRef(uid),
			"familyMembers",
			list.filter((m) => m.id !== memberId),
			...(relation && !hasRelation
				? [
						new FieldPath("linkedFamilyRelations", linkedUid),
						relation,
						new FieldPath("linkedFamilyRelationsAuto", linkedUid),
						deleteField(),
					]
				: []),
		);
	});
}

/** Links two accounts both ways (as an admin force-link does). */
export async function linkAccounts(
	a: string,
	b: string,
	relationAB = "",
	relationBA = "",
): Promise<void> {
	const batch = writeBatch(db);
	batch.update(userRef(a), ...familyLinkArgs(b, normalizeRelation(relationAB)));
	batch.update(userRef(b), ...familyLinkArgs(a, normalizeRelation(relationBA)));
	await batch.commit();
}

/** Removes one side of a link (and its relation / "linked through" marks). */
export async function removeLinkEntry(uid: string, otherUid: string) {
	const batch = writeBatch(db);
	batch.update(userRef(uid), ...familyUnlinkArgs(otherUid));
	await batch.commit();
}

/** A link to a merged account: point it at the account it was merged into. */
export async function relinkToMerged(
	uid: string,
	mergedUid: string,
	targetUid: string,
	relation: string,
) {
	const batch = writeBatch(db);
	batch.update(userRef(uid), ...familyUnlinkArgs(mergedUid));
	if (targetUid !== uid) {
		batch.update(userRef(uid), ...familyLinkArgs(targetUid, relation));
		batch.update(userRef(targetUid), ...familyLinkArgs(uid, ""));
	}
	await batch.commit();
}

/** Who hid an item ("not a problem" / "skip") and when. */
export interface IgnoreMeta {
	at?: number;
	by?: string;
}

const ignoredRef = () => doc(db, "admin_cleanup", "ignored");

/** Everything hidden so far: key → who / when. Empty when it can't be read. */
export async function loadIgnored(): Promise<Record<string, IgnoreMeta>> {
	const snap = await getDoc(ignoredRef()).catch(() => null);
	const keys = snap?.exists() ? snap.data()?.keys : null;
	return keys && typeof keys === "object"
		? (keys as Record<string, IgnoreMeta>)
		: {};
}

/** "Not a problem": hidden for every admin (admin_cleanup/ignored). */
export async function ignoreIssue(key: string) {
	await setDoc(
		ignoredRef(),
		{
			keys: {
				[key]: {
					at: Date.now(),
					by: auth.currentUser?.email || auth.currentUser?.phoneNumber || "",
				},
			},
		},
		{ merge: true },
	);
}

/** Brings hidden items back, for every admin. */
export async function unignoreIssues(keys: string[]) {
	if (keys.length === 0) return;
	await setDoc(
		ignoredRef(),
		{ keys: Object.fromEntries(keys.map((k) => [k, deleteField()])) },
		{ merge: true },
	);
}

/** "By … · date" line for a hidden item. */
export function ignoredBy(
	meta: IgnoreMeta | undefined,
	isHindi: boolean,
): string {
	if (!meta) return "";
	const date = meta.at
		? new Date(meta.at).toLocaleDateString(isHindi ? "hi-IN" : "en-IN", {
				day: "numeric",
				month: "short",
				year: "numeric",
			})
		: "";
	return [meta.by, date].filter(Boolean).join(" · ");
}

export interface MergeResult {
	filled: string[];
	linksMoved: number;
	relinked: number;
	membersAdded: number;
	logins: {
		moved: string[];
		left: string[];
		hint?: { google?: string; phone?: string };
		error?: string;
	};
}

/** Two profiles of one devotee → one (adminMergeProfiles, super admins). */
export async function mergeProfiles(
	keepUid: string,
	dropUid: string,
	moveLogins: boolean,
): Promise<MergeResult> {
	const { httpsCallable } = await import("firebase/functions");
	const res = await httpsCallable<unknown, MergeResult>(
		functions,
		"adminMergeProfiles",
		{ timeout: 120_000 },
	)({ keepUid, dropUid, moveLogins });
	return res.data;
}

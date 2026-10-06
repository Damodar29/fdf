// Emulator tests for family linking (functions/src/index.ts). Run from the repo
// root with `npm run test:family` — needs Java 21+ on PATH (firebase-tools
// requirement). Uses the offline demo project "demo-family": never touches
// production data.
//
// The Functions emulator skips ID-token signature checks, so unsigned JWTs
// stand in for signed-in devotees.
const path = require("node:path");
const admin = require(
	path.join(__dirname, "..", "node_modules", "firebase-admin"),
);

const PROJECT = "demo-family";
admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

const FN = `http://127.0.0.1:5001/${PROJECT}/us-central1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (cond, msg) => {
	if (cond) console.log(`  PASS ${msg}`);
	else {
		failures++;
		console.log(`  FAIL ${msg}`);
	}
};

// The Functions emulator skips ID-token signature checks, so an unsigned JWT
// with the right claims stands in for a signed-in devotee.
let uidCounter = 0;
async function signUp() {
	const uid = `testUser${Date.now().toString(36)}${uidCounter++}`;
	const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
	const now = Math.floor(Date.now() / 1000);
	const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({
		iss: `https://securetoken.google.com/${PROJECT}`,
		aud: PROJECT,
		auth_time: now,
		user_id: uid,
		sub: uid,
		uid,
		iat: now,
		exp: now + 3600,
		firebase: { identities: {}, sign_in_provider: "custom" },
	})}.`;
	return { uid, token };
}

async function call(name, token, data) {
	const res = await fetch(`${FN}/${name}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ data }),
	});
	return res.json();
}

const user = async (u) =>
	(await db.collection("users").doc(u.uid).get()).data();

async function makeUser(name, phone, extra = {}) {
	const u = await signUp();
	u.name = name;
	await db
		.collection("users")
		.doc(u.uid)
		.set({
			uid: u.uid,
			realName: name,
			phoneNumber: phone,
			role: "user",
			isApproved: false,
			...extra,
		});
	return u;
}

async function pendingRequestId(from, to) {
	const snap = await db
		.collection("familyLinkRequests")
		.where("fromUserId", "==", from.uid)
		.where("toUserId", "==", to.uid)
		.where("status", "==", "pending")
		.get();
	return snap.docs[0]?.id;
}

async function waitFor(fn, ms = 8000) {
	const start = Date.now();
	while (Date.now() - start < ms) {
		if (await fn()) return true;
		await sleep(250);
	}
	return false;
}

const links = async (u) => (await user(u)).linkedFamilyMembers || [];

(async () => {
	const A = await makeUser("Asha", "+919000000001", { gender: "female" });
	const B = await makeUser("Bhanu", "+919000000002");
	const C = await makeUser("Chetan", "+919000000003");
	const D = await makeUser("Deepa", "9000000004"); // admin-style bare number
	const E = await makeUser("Eshan", "+919000000005", { isDeleted: true });
	const F = await makeUser("Farah", "+919000000006");
	const G = await makeUser("Gopal", "+919000000007");
	const H = await makeUser("Hari", "+919000000008");

	console.log("1. Request with relation, accept with relation");
	let r = await call("sendFamilyLinkRequest", A.token, {
		phoneNumber: "+919000000002",
		relation: "father",
	});
	check(r.result?.success === true, `send A→B ok (${JSON.stringify(r)})`);
	const reqAB = await pendingRequestId(A, B);
	check(!!reqAB, "pending request stored");
	const reqDoc = (
		await db.collection("familyLinkRequests").doc(reqAB).get()
	).data();
	check(reqDoc.fromRelation === "father", "request carries fromRelation");
	check(
		reqDoc.fromUserGender === "female",
		"request carries the sender's gender",
	);
	r = await call("respondToFamilyLinkRequest", B.token, {
		requestId: reqAB,
		accept: true,
		relation: "son",
	});
	check(r.result?.success === true, `B accepts (${JSON.stringify(r)})`);
	let a = await user(A);
	let b = await user(B);
	check(a.linkedFamilyMembers?.includes(B.uid), "A linked to B");
	check(b.linkedFamilyMembers?.includes(A.uid), "B linked to A");
	check(
		a.linkedFamilyRelations?.[B.uid] === "father",
		"A's relation for B = father",
	);
	check(b.linkedFamilyRelations?.[A.uid] === "son", "B's relation for A = son");

	console.log(
		"2. Group merge: C links B ⇒ C also linked with A (no relation copied)",
	);
	r = await call("sendFamilyLinkRequest", C.token, {
		phoneNumber: "+919000000002",
		relation: "wife",
	});
	check(r.result?.success === true, "send C→B ok");
	r = await call("respondToFamilyLinkRequest", B.token, {
		requestId: await pendingRequestId(C, B),
		accept: true,
	});
	check(r.result?.success === true, "B accepts C");
	const merged = await waitFor(async () => (await links(A)).includes(C.uid));
	check(merged, "A auto-linked to C");
	await sleep(1500);
	a = await user(A);
	const c = await user(C);
	check(c.linkedFamilyMembers?.includes(A.uid), "C auto-linked to A");
	check(
		a.linkedFamilyVia?.[C.uid] === B.uid,
		`A sees C via B (${a.linkedFamilyVia?.[C.uid]})`,
	);
	check(
		c.linkedFamilyVia?.[A.uid] === B.uid,
		`C sees A via B (${c.linkedFamilyVia?.[A.uid]})`,
	);
	check(!a.linkedFamilyRelations?.[C.uid], "A has no copied relation for C");
	check(!c.linkedFamilyRelations?.[A.uid], "C has no copied relation for A");
	check(
		c.linkedFamilyRelations?.[B.uid] === "wife",
		"C's own relation for B kept",
	);

	console.log("3. Bare-digit phone found; D joins the whole group");
	r = await call("sendFamilyLinkRequest", A.token, {
		phoneNumber: "+919000000004",
	});
	check(
		r.result?.success === true,
		`send A→D (bare number) ok (${JSON.stringify(r)})`,
	);
	r = await call("respondToFamilyLinkRequest", D.token, {
		requestId: await pendingRequestId(A, D),
		accept: true,
	});
	const dMerged = await waitFor(async () => {
		const l = await links(D);
		return l.includes(A.uid) && l.includes(B.uid) && l.includes(C.uid);
	});
	check(dMerged, "D linked to A, B, C");
	check(
		(await links(B)).includes(D.uid) && (await links(C)).includes(D.uid),
		"B and C linked to D",
	);

	console.log("4. Unlink sticks and clears labels");
	r = await call("unlinkFamilyMember", A.token, { targetUserId: C.uid });
	check(r.result?.success === true, "A unlinks C");
	await sleep(3000);
	a = await user(A);
	const c2 = await user(C);
	check(!a.linkedFamilyMembers.includes(C.uid), "A no longer linked to C");
	check(!c2.linkedFamilyMembers.includes(A.uid), "C no longer linked to A");
	check(
		!a.linkedFamilyVia?.[C.uid] && !c2.linkedFamilyVia?.[A.uid],
		"via markers cleared",
	);
	check(
		a.linkedFamilyRelations?.[B.uid] === "father",
		"other relations untouched",
	);

	console.log("5. Reverse pending request");
	r = await call("sendFamilyLinkRequest", F.token, {
		phoneNumber: "+919000000001",
	});
	check(r.result?.success === true, "send F→A ok");
	r = await call("sendFamilyLinkRequest", A.token, {
		phoneNumber: "+919000000006",
	});
	check(
		r.error?.status === "FAILED_PRECONDITION",
		`A→F refused: ${r.error?.message}`,
	);

	console.log("6. Deleted user not found; self; already linked");
	r = await call("sendFamilyLinkRequest", A.token, {
		phoneNumber: "+919000000005",
	});
	check(r.error?.status === "NOT_FOUND", `deleted user: ${r.error?.message}`);
	r = await call("sendFamilyLinkRequest", A.token, {
		phoneNumber: "+919000000001",
	});
	check(r.error?.status === "INVALID_ARGUMENT", `self: ${r.error?.message}`);
	r = await call("sendFamilyLinkRequest", A.token, {
		phoneNumber: "+919000000002",
	});
	check(
		r.error?.status === "ALREADY_EXISTS",
		`already linked: ${r.error?.message}`,
	);
	r = await call("sendFamilyLinkRequest", "not-a-token", {
		phoneNumber: "+919000000002",
	});
	check(
		r.error?.status === "UNAUTHENTICATED",
		`bad token: ${r.error?.message}`,
	);

	console.log("7. A one-sided (forged) link does not merge anyone");
	await db
		.collection("users")
		.doc(G.uid)
		.update({ linkedFamilyMembers: [A.uid] });
	await sleep(3000);
	check(
		!(await links(A)).includes(G.uid),
		"A untouched by G's one-sided entry",
	);
	check((await links(G)).length === 1, "G gained nobody from A's family");

	console.log("8. Admin-style force link (two separate writes) merges");
	await db
		.collection("users")
		.doc(H.uid)
		.update({
			linkedFamilyMembers: admin.firestore.FieldValue.arrayUnion(B.uid),
		});
	await sleep(700);
	await db
		.collection("users")
		.doc(B.uid)
		.update({
			linkedFamilyMembers: admin.firestore.FieldValue.arrayUnion(H.uid),
		});
	const hMerged = await waitFor(async () => {
		const l = await links(H);
		return [A.uid, C.uid, D.uid].every((u) => l.includes(u));
	});
	check(hMerged, "H linked to B's whole family (A, C, D)");
	await sleep(2000);
	check(
		!(await links(C)).includes(A.uid),
		"C↔A unlink still respected after later merges",
	);

	console.log("9. Rejected request");
	r = await call("respondToFamilyLinkRequest", A.token, {
		requestId: await pendingRequestId(F, A),
		accept: false,
	});
	check(r.result?.success === true, "A rejects F");
	check(!(await links(A)).includes(F.uid), "F not linked");

	console.log("10. Linked profiles come back without the phone number");
	await db
		.collection("users")
		.doc(B.uid)
		.update({ fcmTokens: ["secret-token"], email: "b@example.com" });
	r = await call("getLinkedFamilyProfiles", A.token, {});
	const members = r.result?.members || [];
	const bCard = members.find((m) => m.id === B.uid);
	check(!!bCard, `A gets B (${JSON.stringify(r).slice(0, 200)})`);
	check(bCard?.realName === "Bhanu", "name included");
	check(
		bCard?.theirRelationForMe === "son",
		`B's relation for A included (${bCard?.theirRelationForMe})`,
	);
	check(
		members.every(
			(m) => !("phoneNumber" in m) && !("fcmTokens" in m) && !("email" in m),
		),
		"no phone number, email or tokens in any member",
	);
	check(!members.some((m) => m.id === C.uid), "unlinked C not returned");
	r = await call("getLinkedFamilyProfiles", G.token, {});
	check(
		(r.result?.members || []).length === 0,
		"G's one-sided entry reveals nothing about A",
	);
	r = await call("getLinkedFamilyProfiles", "not-a-token", {});
	check(r.error?.status === "UNAUTHENTICATED", "needs login");

	console.log("11. The other side of a relation is filled in when certain");
	const FP = admin.firestore.FieldPath;
	const del = admin.firestore.FieldValue.delete;
	const relOf = async (owner, other) =>
		(await user(owner)).linkedFamilyRelations?.[other.uid];
	// What the app does when a devotee picks a relation themselves.
	const setOwnRelation = (owner, other, value) =>
		db
			.collection("users")
			.doc(owner.uid)
			.update(
				new FP("linkedFamilyRelations", other.uid),
				value || del(),
				new FP("linkedFamilyRelationsAuto", other.uid),
				del(),
			);
	const linkWith = async (from, to, relation) => {
		const res = await call("sendFamilyLinkRequest", from.token, {
			phoneNumber: (await user(to)).phoneNumber,
			relation,
		});
		check(res.result?.success === true, `send ${from.name}→${to.name}`);
		const acc = await call("respondToFamilyLinkRequest", to.token, {
			requestId: await pendingRequestId(from, to),
			accept: true,
		});
		check(acc.result?.success === true, `${to.name} accepts`);
	};

	const P = await makeUser("Prem", "+919000000011", { gender: "male" });
	const Q = await makeUser("Quila", "+919000000012", { gender: "female" });
	await linkWith(P, Q, "sister");
	check(
		await waitFor(async () => (await relOf(Q, P)) === "brother"),
		`Q's relation for P filled = brother (${await relOf(Q, P)})`,
	);
	check(
		(await user(Q)).linkedFamilyRelationsAuto?.[P.uid] === "brother",
		"marked as filled-in",
	);
	check((await relOf(P, Q)) === "sister", "P's own relation kept");

	await setOwnRelation(P, Q, "bhabhi"); // P: devar or jeth — not certain
	check(
		await waitFor(async () => (await relOf(Q, P)) === undefined),
		`filled-in value taken back when no longer certain (${await relOf(Q, P)})`,
	);
	await setOwnRelation(P, Q, "sister");
	check(
		await waitFor(async () => (await relOf(Q, P)) === "brother"),
		"filled in again after P fixes it",
	);

	await setOwnRelation(Q, P, "cousin"); // Q's own choice now
	await sleep(3000);
	check((await relOf(P, Q)) === "sister", "Q's choice never changes P's");
	await setOwnRelation(P, Q, "mother");
	await sleep(3000);
	check(
		(await relOf(Q, P)) === "cousin",
		`Q's own choice not overwritten (${await relOf(Q, P)})`,
	);

	console.log("12. Gender set later fills what was unknown");
	const R = await makeUser("Ravi", "+919000000013"); // gender not set
	const S = await makeUser("Sita", "+919000000014", { gender: "female" });
	await linkWith(R, S, "sister");
	await sleep(3000);
	check(
		(await relOf(S, R)) === undefined,
		"no guess while R's gender is unknown",
	);
	await db.collection("users").doc(R.uid).update({ gender: "male" });
	check(
		await waitFor(async () => (await relOf(S, R)) === "brother"),
		`filled once R is male (${await relOf(S, R)})`,
	);

	console.log("13. Certain without genders; wrong gender refused");
	const T = await makeUser("Tarun", "+919000000015");
	const U = await makeUser("Uma", "+919000000016");
	await linkWith(T, U, "wife");
	check(
		await waitFor(async () => (await relOf(U, T)) === "husband"),
		"wife ⇒ husband even without genders",
	);
	const V = await makeUser("Varun", "+919000000017", { gender: "male" });
	const W = await makeUser("Wasim", "+919000000018", { gender: "male" });
	await linkWith(V, W, "sister"); // W is male: contradiction
	await sleep(3000);
	check((await relOf(W, V)) === undefined, "no fill for a contradiction");

	console.log("14. Unlink clears the filled-in record");
	r = await call("unlinkFamilyMember", T.token, { targetUserId: U.uid });
	check(r.result?.success === true, "T unlinks U");
	const u = await user(U);
	check(
		!u.linkedFamilyRelations?.[T.uid] &&
			!u.linkedFamilyRelationsAuto?.[T.uid],
		"relation and record gone",
	);

	console.log("15. Find a hand-added member on the app and link by account");
	const guru = "Shri Guru";
	const M1 = await makeUser("Mohan Lal Sharma", "+919000000021", {
		dikshaDate: "10/07/2025",
		guruName: guru,
	});
	await makeUser("Mohan Gone", "+919000000022", {
		dikshaDate: "10/07/2025",
		guruName: guru,
		isDeleted: true,
	});
	await makeUser("Mohan Other Guru", "+919000000023", {
		dikshaDate: "10/07/2025",
		guruName: "Someone Else",
	});
	const N1 = await makeUser("Nisha", "+919000000024");
	r = await call("searchDevoteesForFamilyLink", N1.token, {
		realName: "mohan sharma", // typed differently from "Mohan Lal Sharma"
		dikshaDate: "10/07/2025",
		guruName: guru,
	});
	const found = r.result?.results || [];
	check(
		found.length === 1 && found[0].id === M1.uid,
		`only the active, same-guru Mohan found (${JSON.stringify(found.map((f) => f.realName))})`,
	);
	check(found[0]?.alreadyLinked === false, "not linked yet");
	check(
		found.every((f) => !("phoneNumber" in f)),
		"no phone number in results",
	);
	r = await call("sendFamilyLinkRequest", N1.token, {
		targetUserId: M1.uid,
		relation: "father",
	});
	check(r.result?.success === true, `request by account id (${JSON.stringify(r)})`);
	const reqByUid = await pendingRequestId(N1, M1);
	check(!!reqByUid, "request stored");
	r = await call("sendFamilyLinkRequest", N1.token, {
		targetUserId: "no-such-user",
	});
	check(r.error?.status === "NOT_FOUND", `unknown id refused: ${r.error?.message}`);
	r = await call("sendFamilyLinkRequest", N1.token, { targetUserId: N1.uid });
	check(r.error?.status === "INVALID_ARGUMENT", "self refused");
	r = await call("sendFamilyLinkRequest", N1.token, {
		targetUserId: "a/b",
	});
	check(r.error?.status === "INVALID_ARGUMENT", "path-like id refused");
	await call("respondToFamilyLinkRequest", M1.token, {
		requestId: reqByUid,
		accept: true,
	});
	r = await call("searchDevoteesForFamilyLink", N1.token, {
		realName: "Mohan",
		dikshaDate: "10/07/2025",
		guruName: guru,
	});
	check(
		r.result?.results?.[0]?.alreadyLinked === true,
		"shown as already linked after accepting",
	);

	console.log("16. Linked profiles carry relations within the family only");
	// P ↔ Q linked (section 11). Link Q ↔ R2 so P gets R2 via Q.
	const R2 = await makeUser("Rekha", "+919000000025", { gender: "female" });
	await linkWith(Q, R2, "daughter");
	await waitFor(async () => (await links(P)).includes(R2.uid));
	await sleep(1500);
	r = await call("getLinkedFamilyProfiles", P.token, {});
	const qCard = (r.result?.members || []).find((m) => m.id === Q.uid);
	check(
		qCard?.familyRelations?.[R2.uid] === "daughter",
		`Q's relation for R2 included (${JSON.stringify(qCard?.familyRelations)})`,
	);
	check(
		!(P.uid in (qCard?.familyRelations || {})),
		"relation for the caller not repeated in familyRelations",
	);
	check(
		Object.keys(qCard?.familyRelations || {}).every((uid) =>
			[...(r.result?.members || []).map((m) => m.id)].includes(uid),
		),
		"only people in the caller's own family",
	);

	console.log("17. Find on the app across Hindi/English, typos and date formats");
	const guru2 = "Shri Guru Two";
	const V1 = await makeUser("Vishakha Shrivastava", "+919000000031", {
		dikshaName: "विशाखा दासी",
		dikshaDate: "2019-04-14", // stored the old way
		guruName: guru2,
		email: "vishakha@example.com",
	});
	await makeUser("Vaishali Gupta", "+919000000032", {
		dikshaDate: "14/04/2019",
		guruName: guru2,
	});
	const V3 = await makeUser("Vishaka Srivastav", "+919000000033", {
		dikshaDate: "14/4/2019",
		guruName: guru2,
	});
	const S1 = await makeUser("Searcher", "+919000000034");
	r = await call("searchDevoteesForFamilyLink", S1.token, {
		realName: "विशाखा श्रीवास्तव",
		dikshaDate: "14/04/2019",
		guruName: guru2,
	});
	const found2 = r.result?.results || [];
	const ids2 = found2.map((f) => f.id);
	check(
		ids2.includes(V1.uid) && ids2.includes(V3.uid) && ids2.length === 2,
		`Hindi name finds both spellings, not Vaishali (${JSON.stringify(found2.map((f) => f.realName))})`,
	);
	check(ids2[0] === V1.uid, "exact spelling ranked first");
	check(
		found2.every((f) => !("phoneNumber" in f) && !("email" in f)),
		"no phone number or email in results",
	);
	r = await call("searchDevoteesForFamilyLink", S1.token, {
		realName: "Someone",
		dikshaName: "Vishakha dasi", // the hand-added member's diksha name
		dikshaDate: "14-04-2019",
		guruName: guru2,
	});
	check(
		(r.result?.results || []).some((f) => f.id === V1.uid),
		"found by diksha name in another script and date format",
	);

	console.log("18. Link by email (Google login)");
	// a) The profile's own email field, typed in other letter case.
	r = await call("sendFamilyLinkRequest", S1.token, {
		email: "  Vishakha@Example.COM ",
		relation: "sister",
	});
	check(r.result?.success === true, `by profile email (${JSON.stringify(r)})`);
	check(!!(await pendingRequestId(S1, V1)), "request stored for V1");
	const emailReqDoc = (
		await db
			.collection("familyLinkRequests")
			.where("fromUserId", "==", S1.uid)
			.where("toUserId", "==", V1.uid)
			.get()
	).docs[0]?.data();
	check(
		emailReqDoc && !JSON.stringify(emailReqDoc).includes("@"),
		"request does not store the email",
	);
	// b) Only the login knows the email (profile field empty).
	const G1 = await makeUser("Gopal", "+919000000035");
	await admin.auth().createUser({ uid: G1.uid, email: "gopal@gmail.com" });
	r = await call("sendFamilyLinkRequest", S1.token, { email: "gopal@gmail.com" });
	check(r.result?.success === true, `by Google login email (${JSON.stringify(r)})`);
	check(!!(await pendingRequestId(S1, G1)), "request stored for G1");
	// c) A merged account leads to the profile it was merged into.
	const Kept = await makeUser("Kanha", "+919000000036");
	const OldAcc = await makeUser("Kanha old", "", { mergedIntoUid: Kept.uid });
	await admin.auth().createUser({ uid: OldAcc.uid, email: "kanha@gmail.com" });
	r = await call("sendFamilyLinkRequest", S1.token, { email: "kanha@gmail.com" });
	check(r.result?.success === true, "merged account's email accepted");
	check(!!(await pendingRequestId(S1, Kept)), "request goes to the kept profile");
	// d) Refusals.
	r = await call("sendFamilyLinkRequest", S1.token, { email: "nobody@example.com" });
	check(r.error?.status === "NOT_FOUND", `unknown email: ${r.error?.message}`);
	r = await call("sendFamilyLinkRequest", S1.token, { email: "not-an-email" });
	check(r.error?.status === "INVALID_ARGUMENT", "invalid email refused");
	await admin.auth().createUser({ uid: S1.uid, email: "searcher@gmail.com" });
	r = await call("sendFamilyLinkRequest", S1.token, { email: "searcher@gmail.com" });
	check(r.error?.status === "INVALID_ARGUMENT", "own email refused");
	r = await call("sendFamilyLinkRequest", S1.token, { email: "gopal@gmail.com" });
	check(r.error?.status === "ALREADY_EXISTS", "second request refused");

	console.log("19. Link by phone: login number or profile number");
	// a) A Google login that typed its number into the profile.
	const P1 = await makeUser("Prabhu", "+919000000041");
	await admin.auth().createUser({ uid: P1.uid, email: "prabhu@gmail.com" });
	r = await call("sendFamilyLinkRequest", S1.token, { phoneNumber: "9000000041" });
	check(r.result?.success === true, `by profile phone (${JSON.stringify(r)})`);
	check(!!(await pendingRequestId(S1, P1)), "request stored for P1");
	// b) A phone login whose profile phone field is empty.
	const P2 = await makeUser("Pinky", "");
	await admin.auth().createUser({ uid: P2.uid, phoneNumber: "+919000000042" });
	r = await call("sendFamilyLinkRequest", S1.token, {
		phoneNumber: "+91 90000 00042",
	});
	check(r.result?.success === true, `by login phone (${JSON.stringify(r)})`);
	check(!!(await pendingRequestId(S1, P2)), "request stored for P2");
	// c) A spaced spelling saved from the admin panel.
	const P3 = await makeUser("Pallavi", "+91 90000 00043");
	r = await call("sendFamilyLinkRequest", S1.token, { phoneNumber: "+919000000043" });
	check(r.result?.success === true, "spaced profile spelling found");
	check(!!(await pendingRequestId(S1, P3)), "request stored for P3");
	// d) Login number beats someone else's profile field holding it.
	const P4typed = await makeUser("Typed it", "+919000000044");
	const P4login = await makeUser("Logs in with it", "");
	await admin.auth().createUser({ uid: P4login.uid, phoneNumber: "+919000000044" });
	r = await call("sendFamilyLinkRequest", S1.token, { phoneNumber: "9000000044" });
	check(r.result?.success === true, "shared number accepted");
	check(!!(await pendingRequestId(S1, P4login)), "goes to the login owner");
	check(!(await pendingRequestId(S1, P4typed)), "not to the typed copy");
	// e) A merged phone login leads to the kept profile.
	const Kept2 = await makeUser("Radha", "+919000000046");
	const Old2 = await makeUser("Radha old", "", { mergedIntoUid: Kept2.uid });
	await admin.auth().createUser({ uid: Old2.uid, phoneNumber: "+919000000045" });
	r = await call("sendFamilyLinkRequest", S1.token, { phoneNumber: "9000000045" });
	check(r.result?.success === true, "merged phone login accepted");
	check(!!(await pendingRequestId(S1, Kept2)), "request goes to the kept profile");
	r = await call("sendFamilyLinkRequest", S1.token, { phoneNumber: "9000000049" });
	check(r.error?.status === "NOT_FOUND", `unknown phone: ${r.error?.message}`);

	console.log("20. adminListLoginMethods (super admins only)");
	const tokenWith = (claims) => {
		const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
		const now = Math.floor(Date.now() / 1000);
		const uid = `adm${uidCounter++}`;
		return `${b64({ alg: "none", typ: "JWT" })}.${b64({
			iss: `https://securetoken.google.com/${PROJECT}`,
			aud: PROJECT,
			auth_time: now,
			user_id: uid,
			sub: uid,
			iat: now,
			exp: now + 3600,
			firebase: { identities: {}, sign_in_provider: "custom" },
			...claims,
		})}.`;
	};
	r = await call("adminListLoginMethods", S1.token, {});
	check(r.error?.status === "PERMISSION_DENIED", "devotee refused");
	await db.collection("admin_roles").doc("mandal@example.com").set({ role: "mandal" });
	r = await call(
		"adminListLoginMethods",
		tokenWith({ email: "mandal@example.com" }),
		{},
	);
	check(r.error?.status === "PERMISSION_DENIED", "mandal admin refused");
	const BothAcc = await makeUser("Both", "");
	await admin.auth().importUsers([
		{
			uid: BothAcc.uid,
			email: "both@gmail.com",
			phoneNumber: "+919000000047",
			providerData: [
				{ uid: "g-both", providerId: "google.com", email: "both@gmail.com" },
				{ uid: "+919000000047", providerId: "phone", phoneNumber: "+919000000047" },
			],
		},
	]);
	r = await call(
		"adminListLoginMethods",
		tokenWith({ email: "damodar@cpbs.com" }),
		{},
	);
	const listed = r.result?.users || [];
	check(listed.length > 0, `super admin gets the list (${listed.length})`);
	const both = listed.find((u) => u.u === BothAcc.uid);
	check(
		both?.p.includes("g") && both?.p.includes("p"),
		`Google + phone on one account (${JSON.stringify(both)})`,
	);
	const phoneOnly = listed.find((u) => u.u === P2.uid);
	check(
		phoneOnly?.p === "p" && phoneOnly?.ph === "+919000000042",
		`phone login with its number (${JSON.stringify(phoneOnly)})`,
	);
	r = await call(
		"adminListLoginMethods",
		tokenWith({ phone_number: "+919887880429" }),
		{},
	);
	check(Array.isArray(r.result?.users), "super admin by phone allowed");

	console.log("21. Linked family sees each other's hand-added members");
	const Ma = await makeUser("Mausi", "+919000000051", { gender: "female" });
	const Pa = await makeUser("Mausa", "+919000000052", { gender: "male" });
	await db.collection("users").doc(Ma.uid).update({
		linkedFamilyMembers: [Pa.uid],
		linkedFamilyRelations: { [Pa.uid]: "husband" },
	});
	await db.collection("users").doc(Pa.uid).update({
		linkedFamilyMembers: [Ma.uid],
		familyMembers: [
			{ id: "x", realName: "Kamla Devi", relation: "mother", phoneNumber: "+919999999999" },
			{ id: "y", realName: "Rejected One", relation: "brother", approvalStatus: "rejected" },
		],
	});
	r = await call("getLinkedFamilyProfiles", Ma.token, {});
	const paSeen = (r.result?.members || []).find((m) => m.id === Pa.uid);
	check(paSeen?.handAdded?.length === 1, `one hand-added member shared (${JSON.stringify(paSeen?.handAdded)})`);
	check(paSeen?.handAdded?.[0]?.realName === "Kamla Devi", "it is Kamla Devi, with her relation");
	check(
		!JSON.stringify(paSeen?.handAdded || []).includes("9999999999"),
		"no phone number shared",
	);

	console.log("22. adminMergeProfiles: one devotee, two accounts");
	const superTok = tokenWith({ email: "damodar@cpbs.com" });
	const Keep = await makeUser("Vishakha", "+919000000061");
	await admin.auth().createUser({ uid: Keep.uid, phoneNumber: "+919000000061" });
	const F1 = await makeUser("Friend One", "+919000000062");
	const F2 = await makeUser("Sister", "+919000000063");
	const F3 = await makeUser("Cousin", "+919000000064");
	const Drop = await makeUser("विशाखा", "", {
		dikshaDate: "05/03/2010",
		photoURL: "https://example.com/v.jpg",
		isApproved: true,
		approvalDate: 123,
		familyMembers: [{ id: "g", realName: "Grandma Ji", relation: "grandmother_maternal" }],
	});
	await admin.auth().importUsers([
		{
			uid: Drop.uid,
			email: "vishakha@gmail.com",
			providerData: [{ uid: "g-vish", providerId: "google.com", email: "vishakha@gmail.com" }],
		},
	]);
	await db.collection("users").doc(Keep.uid).update({
		linkedFamilyMembers: [F1.uid],
		linkedFamilyRelations: { [F1.uid]: "brother" },
	});
	await db.collection("users").doc(F1.uid).update({ linkedFamilyMembers: [Keep.uid] });
	await db.collection("users").doc(Drop.uid).update({
		linkedFamilyMembers: [F2.uid],
		linkedFamilyRelations: { [F2.uid]: "sister" },
	});
	await db.collection("users").doc(F2.uid).update({
		linkedFamilyMembers: [Drop.uid],
		linkedFamilyRelations: { [Drop.uid]: "sister" },
	});
	const reqRef = await db.collection("familyLinkRequests").add({
		fromUserId: F3.uid,
		toUserId: Drop.uid,
		status: "pending",
		createdAt: Date.now(),
	});
	r = await call("adminMergeProfiles", Keep.token, { keepUid: Keep.uid, dropUid: Drop.uid });
	check(r.error?.status === "PERMISSION_DENIED", "devotee cannot merge");
	r = await call("adminMergeProfiles", superTok, { keepUid: Keep.uid, dropUid: Drop.uid });
	check(!!r.result, `merged (${JSON.stringify(r.result || r.error)})`);
	const k = await user(Keep);
	const dz = await user(Drop);
	check(k.dikshaDate === "05/03/2010" && k.photoURL === "https://example.com/v.jpg", "empty fields filled from the other profile");
	check(k.realName === "Vishakha", "existing name not overwritten");
	check(k.isApproved === true, "approval carried over");
	check((k.familyMembers || []).some((m) => m.realName === "Grandma Ji"), "hand-added member moved");
	check(k.linkedFamilyMembers.includes(F1.uid) && k.linkedFamilyMembers.includes(F2.uid), "both families linked to the kept account");
	check(k.linkedFamilyRelations?.[F2.uid] === "sister", "relation moved with the link");
	const f2 = await user(F2);
	check(f2.linkedFamilyMembers.includes(Keep.uid) && !f2.linkedFamilyMembers.includes(Drop.uid), "relative now linked to the kept account");
	check(f2.linkedFamilyRelations?.[Keep.uid] === "sister" && !f2.linkedFamilyRelations?.[Drop.uid], "relative's relation moved too");
	check(dz.mergedIntoUid === Keep.uid && dz.isDeleted === true, "other profile marked merged");
	check(dz.realName === "विशाखा", "other profile's data kept");
	const req = (await reqRef.get()).data();
	check(req.toUserId === Keep.uid, "pending request now for the kept account");
	check(r.result?.logins?.moved?.includes("google"), `Google login moved (${JSON.stringify(r.result?.logins)})`);
	const keepAuth = await admin.auth().getUser(Keep.uid);
	check(
		keepAuth.providerData.some((p) => p.providerId === "google.com") && keepAuth.phoneNumber === "+919000000061",
		"kept account now has Google and phone",
	);
	let dropAuthGone = false;
	try {
		await admin.auth().getUser(Drop.uid);
	} catch (e) {
		dropAuthGone = e.code === "auth/user-not-found";
	}
	check(dropAuthGone, "the second login account is gone");
	const log = await db.collection("admin_merge_log").where("dropUid", "==", Drop.uid).get();
	check(log.size === 1 && log.docs[0].data().keepUid === Keep.uid, "merge logged");
	r = await call("adminMergeProfiles", superTok, { keepUid: Keep.uid, dropUid: Drop.uid });
	check(r.error?.status === "FAILED_PRECONDITION", "cannot merge twice");

	console.log("23. Two Google accounts: the login stays, with a hint");
	const K2 = await makeUser("Gita", "+919000000071");
	const D2 = await makeUser("Gita", "+919000000071");
	await admin.auth().importUsers([
		{ uid: K2.uid, email: "gita.one@gmail.com", providerData: [{ uid: "g-gita1", providerId: "google.com", email: "gita.one@gmail.com" }] },
		{ uid: D2.uid, email: "gita.two@gmail.com", providerData: [{ uid: "g-gita2", providerId: "google.com", email: "gita.two@gmail.com" }] },
	]);
	r = await call("adminMergeProfiles", superTok, { keepUid: K2.uid, dropUid: D2.uid });
	check(r.result?.logins?.left?.includes("google"), `Google login left (${JSON.stringify(r.result?.logins)})`);
	const d2 = await user(D2);
	check(d2.mergedLoginHint?.google === "gi•••@gmail.com", `hint saved (${JSON.stringify(d2.mergedLoginHint)})`);
	check(!!(await admin.auth().getUser(D2.uid)), "second login still exists");

	console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
	process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});

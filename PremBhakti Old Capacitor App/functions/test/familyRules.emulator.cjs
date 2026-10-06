// Rules checks for firestore.rules (family fields) and storage.rules (the
// automatic online backup), via the emulators' REST APIs with unsigned test
// tokens. Run from the repo root with `npm run test:rules` (Java 21+ needed).
const path = require("node:path");
const admin = require(
	path.join(__dirname, "..", "node_modules", "firebase-admin"),
);
const PROJECT = "demo-family";
admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

let failures = 0;
const check = (cond, msg) => {
	console.log(`  ${cond ? "PASS" : "FAIL"} ${msg}`);
	if (!cond) failures++;
};

const tokenFor = (uid) => {
	const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
	const now = Math.floor(Date.now() / 1000);
	return `${b64({ alg: "none", typ: "JWT" })}.${b64({
		iss: `https://securetoken.google.com/${PROJECT}`,
		aud: PROJECT,
		sub: uid,
		user_id: uid,
		iat: now,
		exp: now + 3600,
		auth_time: now,
		firebase: { sign_in_provider: "phone" },
	})}.`;
};

async function patch(uid, asUid, fields, mask) {
	const qs = mask
		.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`)
		.join("&");
	const res = await fetch(`${BASE}/users/${uid}?${qs}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${tokenFor(asUid)}`,
		},
		body: JSON.stringify({ fields }),
	});
	return res.status;
}

(async () => {
	await db
		.collection("users")
		.doc("ruleA")
		.set({ uid: "ruleA", role: "user", realName: "A" });
	await db
		.collection("users")
		.doc("ruleB")
		.set({ uid: "ruleB", role: "user", realName: "B" });

	let st = await patch(
		"ruleA",
		"ruleA",
		{
			linkedFamilyMembers: {
				arrayValue: { values: [{ stringValue: "ruleB" }] },
			},
		},
		["linkedFamilyMembers"],
	);
	check(st === 403, `devotee cannot write own linkedFamilyMembers (${st})`);

	st = await patch(
		"ruleA",
		"ruleA",
		{
			linkedFamilyVia: {
				mapValue: { fields: { ruleB: { stringValue: "x" } } },
			},
		},
		["linkedFamilyVia"],
	);
	check(st === 403, `devotee cannot write own linkedFamilyVia (${st})`);

	st = await patch(
		"ruleA",
		"ruleA",
		{
			linkedFamilyRelations: {
				mapValue: { fields: { ruleB: { stringValue: "father" } } },
			},
		},
		["linkedFamilyRelations.ruleB"],
	);
	check(st === 200, `devotee can set own relation label (${st})`);

	st = await patch("ruleA", "ruleA", { realName: { stringValue: "A2" } }, [
		"realName",
	]);
	check(st === 200, `normal profile edit still allowed (${st})`);

	st = await patch(
		"ruleB",
		"ruleA",
		{
			linkedFamilyRelations: {
				mapValue: { fields: { ruleA: { stringValue: "x" } } },
			},
		},
		["linkedFamilyRelations.ruleA"],
	);
	check(st === 403, `devotee cannot write someone else's labels (${st})`);

	// Linked family members must not read each other's profile (phone number).
	await db
		.collection("users")
		.doc("ruleB")
		.update({ linkedFamilyMembers: ["ruleA"], phoneNumber: "+919000000009" });
	st = await fetch(`${BASE}/users/ruleB`, {
		headers: { Authorization: `Bearer ${tokenFor("ruleA")}` },
	}).then((r) => r.status);
	check(st === 403, `linked member cannot read the profile doc (${st})`);
	st = await fetch(`${BASE}/users/ruleA`, {
		headers: { Authorization: `Bearer ${tokenFor("ruleA")}` },
	}).then((r) => r.status);
	check(st === 200, `devotee can still read own profile (${st})`);

	// The app clears the "filled in automatically" record when a devotee picks
	// a relation themselves.
	st = await patch("ruleA", "ruleA", {}, ["linkedFamilyRelationsAuto.ruleB"]);
	check(st === 200, `devotee can clear own filled-in record (${st})`);

	// ── diksha_anniversaries: readable by all, written only by the server ──
	await db
		.collection("diksha_anniversaries")
		.doc("2026-09-27")
		.set({ date: "2026-09-27", devotees: [{ name: "A", years: 3 }] });
	st = await fetch(`${BASE}/diksha_anniversaries/2026-09-27`).then(
		(r) => r.status,
	);
	check(st === 200, `anyone (even signed out) can read today's list (${st})`);
	st = await fetch(`${BASE}/diksha_anniversaries/2026-09-27`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${tokenFor("ruleA")}`,
		},
		body: JSON.stringify({ fields: { date: { stringValue: "x" } } }),
	}).then((r) => r.status);
	check(st === 403, `a devotee cannot write the list (${st})`);

	// ── storage.rules: user_backups/{uid} is private to that devotee ──
	const STORAGE = `http://127.0.0.1:9199/v0/b/${PROJECT}.appspot.com/o`;
	const backupPath = (owner) =>
		encodeURIComponent(`user_backups/${owner}/prem-bhakti-backup.json`);
	const upload = (asUid, owner, type = "application/json") =>
		fetch(`${STORAGE}?name=${backupPath(owner)}`, {
			method: "POST",
			headers: {
				"Content-Type": type,
				Authorization: `Bearer ${tokenFor(asUid)}`,
			},
			body: type === "application/json" ? '{"isUserBackup":true}' : "x",
		}).then((r) => r.status);
	const download = (asUid, owner) =>
		fetch(`${STORAGE}/${backupPath(owner)}?alt=media`, {
			headers: { Authorization: `Bearer ${tokenFor(asUid)}` },
		}).then((r) => r.status);

	st = await upload("ruleA", "ruleA");
	check(st === 200, `devotee can save own online backup (${st})`);
	st = await download("ruleA", "ruleA");
	check(st === 200, `devotee can read own online backup (${st})`);
	st = await download("ruleB", "ruleA");
	check(st === 403, `another devotee cannot read it (${st})`);
	st = await upload("ruleB", "ruleA");
	check(st === 403, `another devotee cannot overwrite it (${st})`);
	st = await upload("ruleA", "ruleA", "text/plain");
	check(st === 403, `only JSON is accepted (${st})`);

	console.log(failures === 0 ? "\nRULES OK" : `\n${failures} FAILED`);
	process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});

// Rules checks for user_last_seen/{uid} (when a devotee last opened the app),
// via the Firestore emulator's REST API with unsigned test tokens. Run from the
// repo root with `npm run test:rules` (Java 21+ needed).
const PROJECT = "demo-family";
const DB = `projects/${PROJECT}/databases/(default)`;
const BASE = `http://127.0.0.1:8080/v1/${DB}/documents`;
const ADMIN_EMAIL = "damodar@cpbs.com";

let failures = 0;
const check = (cond, msg) => {
	console.log(`  ${cond ? "PASS" : "FAIL"} ${msg}`);
	if (!cond) failures++;
};

const tokenFor = (uid, email) => {
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
		...(email ? { email, email_verified: true } : {}),
		firebase: { sign_in_provider: email ? "google.com" : "phone" },
	})}.`;
};

const headers = (asUid, email) => ({
	"Content-Type": "application/json",
	...(asUid ? { Authorization: `Bearer ${tokenFor(asUid, email)}` } : {}),
});

/** What setDoc(ref, { lastSeenAt: serverTimestamp() }) sends. */
async function writeServerTime(uid, asUid) {
	const res = await fetch(`${BASE}:commit`, {
		method: "POST",
		headers: headers(asUid),
		body: JSON.stringify({
			writes: [
				{
					update: { name: `${DB}/documents/user_last_seen/${uid}`, fields: {} },
					updateTransforms: [
						{ fieldPath: "lastSeenAt", setToServerValue: "REQUEST_TIME" },
					],
				},
			],
		}),
	});
	return res.status;
}

async function writeFields(uid, asUid, fields) {
	const res = await fetch(`${BASE}/user_last_seen/${uid}`, {
		method: "PATCH",
		headers: headers(asUid),
		body: JSON.stringify({ fields }),
	});
	return res.status;
}

async function read(uid, asUid, email) {
	const res = await fetch(`${BASE}/user_last_seen/${uid}`, {
		headers: headers(asUid, email),
	});
	return res.status;
}

(async () => {
	let st = await writeServerTime("seenA", "seenA");
	check(st === 200, `owner can record their last seen (${st})`);

	st = await writeServerTime("seenA", "seenA");
	check(st === 200, `owner can update it again (${st})`);

	st = await writeServerTime("seenA", "seenB");
	check(st === 403, `another user cannot write it (${st})`);

	st = await writeServerTime("seenA", null);
	check(st === 403, `signed-out cannot write it (${st})`);

	st = await writeFields("seenA", "seenA", {
		lastSeenAt: { timestampValue: "2020-01-01T00:00:00Z" },
	});
	check(st === 403, `owner cannot fake a time (${st})`);

	st = await writeFields("seenA", "seenA", {
		lastSeenAt: { timestampValue: new Date().toISOString() },
		note: { stringValue: "x" },
	});
	check(st === 403, `owner cannot add other fields (${st})`);

	st = await read("seenA", "seenA");
	check(st === 403, `owner cannot read it (admin-only) (${st})`);

	st = await read("seenA", "adminUid", ADMIN_EMAIL);
	check(st === 200, `admin can read it (${st})`);

	console.log(failures ? `\n${failures} FAILED` : "\nAll last-seen rules checks passed");
	process.exit(failures ? 1 : 0);
})();

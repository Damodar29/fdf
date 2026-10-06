// Rules checks for user_prefs/{uid} (guided tour progress), via the Firestore
// emulator's REST API with unsigned test tokens. Run from the repo root with
// `npm run test:rules` (Java 21+ needed).
const PROJECT = "demo-family";
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

const headers = (asUid) => ({
	"Content-Type": "application/json",
	...(asUid ? { Authorization: `Bearer ${tokenFor(asUid)}` } : {}),
});

const progress = (entries) => ({
	mapValue: {
		fields: Object.fromEntries(
			Object.entries(entries).map(([k, v]) => [k, { integerValue: String(v) }]),
		),
	},
});

/** PATCH with an update mask = what setDoc(..., { merge: true }) sends. */
async function write(uid, asUid, fields, mask) {
	const qs = (mask || Object.keys(fields))
		.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`)
		.join("&");
	const res = await fetch(`${BASE}/user_prefs/${uid}?${qs}`, {
		method: "PATCH",
		headers: headers(asUid),
		body: JSON.stringify({ fields }),
	});
	return res.status;
}

async function read(uid, asUid) {
	const res = await fetch(`${BASE}/user_prefs/${uid}`, {
		headers: headers(asUid),
	});
	return res.status;
}

(async () => {
	const now = { timestampValue: new Date().toISOString() };

	let st = await write("prefA", "prefA", {
		tourProgress: progress({ core: 1 }),
		updatedAt: now,
	});
	check(st === 200, `owner can create own tour progress (${st})`);

	st = await write(
		"prefA",
		"prefA",
		{ tourProgress: progress({ bhajans: 1 }), updatedAt: now },
		["tourProgress.bhajans", "updatedAt"],
	);
	check(st === 200, `owner can merge one chapter in (${st})`);

	st = await read("prefA", "prefA");
	check(st === 200, `owner can read own tour progress (${st})`);

	st = await write("prefA", "prefA", { tourProgress: progress({}) });
	check(st === 200, `owner can reset (empty progress) (${st})`);

	st = await read("prefA", "prefB");
	check(st === 403, `another user cannot read it (${st})`);

	st = await read("prefA", null);
	check(st === 403, `a signed-out visitor cannot read it (${st})`);

	st = await write("prefA", "prefB", {
		tourProgress: progress({ core: 9 }),
		updatedAt: now,
	});
	check(st === 403, `another user cannot write it (${st})`);

	st = await write("prefC", null, { tourProgress: progress({ core: 1 }) });
	check(st === 403, `a signed-out visitor cannot create one (${st})`);

	st = await write(
		"prefA",
		"prefA",
		{ tourProgress: progress({ core: 1 }), isAdmin: { booleanValue: true } },
		["tourProgress", "isAdmin"],
	);
	check(st === 403, `extra keys are rejected (${st})`);

	st = await write("prefA", "prefA", {
		tourProgress: { stringValue: "all" },
	});
	check(st === 403, `tourProgress must be a map (${st})`);

	st = await write("prefA", "prefA", {
		tourProgress: progress({ core: 1 }),
		updatedAt: { stringValue: "yesterday" },
	});
	check(st === 403, `updatedAt must be a timestamp (${st})`);

	console.log(
		failures === 0 ? "\nUSER_PREFS RULES OK" : `\n${failures} FAILED`,
	);
	process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});

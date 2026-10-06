import { useCallback, useEffect, useState } from "react";
import { functions } from "../../../services/firebase";
import { safeLocalGet, safeLocalSet } from "../../../utils/safeLocalSet";

/** How one account logs in, from Firebase Auth (adminListLoginMethods). */
export interface LoginInfo {
	google: boolean;
	phone: boolean;
	/** Email + password (admin-made accounts). */
	password: boolean;
	/** The number the account logs in with (not the profile's phone field). */
	loginPhone?: string;
	/** The email the account logs in with (Google). */
	loginEmail?: string;
	lastSignIn?: number;
	created?: number;
}

export type LoginKind = "google" | "phone" | "both" | "other";

export const loginKind = (l: LoginInfo): LoginKind =>
	l.google && l.phone
		? "both"
		: l.google
			? "google"
			: l.phone
				? "phone"
				: "other";

type Raw = {
	u: string;
	p: string;
	ph?: string;
	em?: string;
	ls?: number;
	cr?: number;
};

const CACHE_KEY = "cpbs_admin_login_methods_v1";
// Login methods change rarely; asking Firebase Auth again a few times a day
// is plenty (one function call each time).
const TTL = 6 * 60 * 60 * 1000;

const toMap = (raw: Raw[]): Record<string, LoginInfo> => {
	const map: Record<string, LoginInfo> = {};
	for (const r of raw) {
		if (!r || typeof r.u !== "string") continue;
		const p = typeof r.p === "string" ? r.p : "";
		map[r.u] = {
			google: p.includes("g"),
			phone: p.includes("p"),
			password: p.includes("e"),
			loginPhone: r.ph,
			loginEmail: r.em,
			lastSignIn: r.ls,
			created: r.cr,
		};
	}
	return map;
};

const readCache = (): { at: number; raw: Raw[] } | null => {
	try {
		const c = JSON.parse(safeLocalGet(CACHE_KEY) || "");
		if (typeof c?.at === "number" && Array.isArray(c.raw)) return c;
	} catch {}
	return null;
};

let memory: { at: number; map: Record<string, LoginInfo> } | null = null;

/**
 * Every account's login method, for super admins. Kept on this device for
 * 6 hours; `refresh()` asks again. `error` is "denied" for a non-super admin
 * (the screens then simply show nothing).
 */
export const useLoginMethods = (enabled: boolean) => {
	const [state, setState] = useState<{
		map: Record<string, LoginInfo> | null;
		at: number;
		loading: boolean;
		error: "" | "denied" | "failed";
	}>(() => {
		if (memory) return { ...memory, loading: false, error: "" };
		const c = readCache();
		return c
			? { map: toMap(c.raw), at: c.at, loading: false, error: "" }
			: { map: null, at: 0, loading: false, error: "" };
	});

	const load = useCallback(async (force: boolean) => {
		const cached = memory || readCache();
		if (!force && cached && Date.now() - cached.at < TTL) return;
		setState((s) => ({ ...s, loading: true, error: "" }));
		try {
			const { httpsCallable } = await import("firebase/functions");
			const res = await httpsCallable<unknown, { users: Raw[]; at: number }>(
				functions,
				"adminListLoginMethods",
				{ timeout: 120000 },
			)({});
			const raw = Array.isArray(res.data?.users) ? res.data.users : [];
			const at = Date.now();
			safeLocalSet(CACHE_KEY, JSON.stringify({ at, raw }));
			memory = { at, map: toMap(raw) };
			setState({ map: memory.map, at, loading: false, error: "" });
		} catch (e) {
			const code = (e as { code?: string })?.code;
			console.warn("[LoginMethods] not loaded", code || e);
			setState((s) => ({
				...s,
				loading: false,
				error:
					code === "functions/permission-denied" ||
					code === "functions/unauthenticated"
						? "denied"
						: "failed",
			}));
		}
	}, []);

	useEffect(() => {
		if (enabled) load(false);
	}, [enabled, load]);

	return {
		map: enabled ? state.map : null,
		at: state.at,
		loading: state.loading,
		error: state.error,
		refresh: () => load(true),
	};
};

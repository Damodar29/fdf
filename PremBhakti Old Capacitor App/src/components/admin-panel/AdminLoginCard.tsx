import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2, Shield } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { auth } from "../../../services/firebase";

/**
 * Shown in the Content Manager when no admin account is signed in.
 *
 * A super admin's Google login (the profile login) turns Developer Mode on
 * without a password, but the admin screens read and write through the admin
 * login — without it the Content Manager used to open completely empty.
 */
export const AdminLoginCard: React.FC<{
	isHindi: boolean;
	onSignedIn: () => void;
}> = ({ isHindi, onSignedIn }) => {
	const [email, setEmail] = useState("damodar@cpbs.com");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email.trim() || !password) return;
		setBusy(true);
		setError("");
		try {
			await signInWithEmailAndPassword(auth, email.trim(), password);
			setPassword("");
			onSignedIn();
		} catch (err) {
			console.error("[AdminLogin] sign-in failed", err);
			setError(
				isHindi
					? "लॉगिन नहीं हुआ — ईमेल या पासवर्ड गलत है।"
					: "Could not sign in — wrong email or password.",
			);
		} finally {
			setBusy(false);
		}
	};

	const input =
		"w-full min-h-touch rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

	return (
		<div className="p-4 overflow-y-auto">
			<form
				onSubmit={submit}
				className="max-w-sm mx-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-3"
			>
				<div className="flex items-center gap-3">
					<span className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
						<Shield size={22} />
					</span>
					<div>
						<h3 className="font-bold text-slate-800 dark:text-white">
							{isHindi ? "एडमिन लॉगिन चाहिए" : "Admin sign-in needed"}
						</h3>
						<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
							{isHindi
								? "डेवलपर मोड चालू है, पर इस डिवाइस पर एडमिन खाता लॉगिन नहीं है। इसके बिना कंटेंट मैनेजर कुछ पढ़ या बदल नहीं सकता।"
								: "Developer Mode is on, but no admin account is signed in on this device. Without it the Content Manager can't read or change anything."}
						</p>
					</div>
				</div>
				<input
					type="email"
					autoComplete="username"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-label={isHindi ? "एडमिन ईमेल" : "Admin email"}
					className={input}
				/>
				<input
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder={isHindi ? "पासवर्ड" : "Password"}
					aria-label={isHindi ? "पासवर्ड" : "Password"}
					className={input}
				/>
				{error && (
					<p className="text-xs text-red-600 dark:text-red-400">{error}</p>
				)}
				<button
					type="submit"
					disabled={busy || !password}
					className="w-full min-h-touch rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
				>
					{busy && <Loader2 size={16} className="animate-spin" />}
					{isHindi ? "लॉगिन करें" : "Sign in"}
				</button>
			</form>
		</div>
	);
};

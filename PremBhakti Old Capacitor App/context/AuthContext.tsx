import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
	deleteUser,
	type User as FirebaseUser,
	signOut as firebaseSignOut,
	GoogleAuthProvider,
	getRedirectResult,
	linkWithCredential,
	linkWithPopup,
	type OAuthCredential,
	onAuthStateChanged,
	PhoneAuthProvider,
	RecaptchaVerifier,
	signInWithCredential,
	signInWithPhoneNumber,
	signInWithPopup,
	signInWithRedirect,
} from "firebase/auth";
import {
	collection,
	doc,
	getDoc,
	onSnapshot,
	query,
	setDoc,
	updateDoc,
	where,
} from "firebase/firestore";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
	profileDb as db,
	auth as defaultAuth,
	getCurrentFcmToken,
	profileAuth,
	setOnFcmTokenReady,
} from "../services/firebase";
import { linkedFamilyCacheKey } from "../utils/linkedFamilyCache";
import { useSettings } from "./SettingsContext";
import { useToast } from "./ToastContext";

export interface ProfileEditRecord {
	timestamp: number;
	changes: Array<{ field: string; old: string; new: string }>;
	status: "pending" | "reviewed";
}

/**
 * One admin decision on a profile, kept so the admin's edit-history screen can
 * show who approved or rejected what, when, and why. Written by the admin
 * panel only (arrayUnion); older decisions from before this existed are not in it.
 */
export interface ReviewLogEntry {
	/** When (ms). */
	t: number;
	a: "approved" | "rejected" | "revoked" | "reviewed";
	/** The reason given with a rejection. */
	note?: string;
	/** Set when the decision was about one hand-added family member (their name). */
	member?: string;
	/** Which admin (email name before the @). */
	by?: string;
}

export interface UserProfile {
	uid: string;
	shortId?: string;
	email: string | null;
	realName: string;
	dikshaName: string;
	guruName: string;
	dikshaDate: string;
	mandalId: string;
	photoURL?: string;
	phoneNumber?: string;
	isAspiring?: boolean;
	submittedForReview?: boolean;
	isApproved: boolean;
	rejectionNote?: string;
	createdAt: number;
	submissionDate?: number;
	approvalDate?: number;
	resubmitted?: boolean;
	hasPendingEdits?: boolean;
	editHistory?: ProfileEditRecord[];
	reviewLog?: ReviewLogEntry[];
	isDeleted?: boolean;
	deletedAt?: number;
	scheduledDeletionDate?: number;
	/**
	 * Set by an admin merge (adminMergeProfiles): this was a second profile of
	 * the same devotee and now lives on in that account.
	 */
	mergedIntoUid?: string;
	/** Merged profile whose login could not move: how to sign in instead (masked). */
	mergedLoginHint?: { google?: string; phone?: string };
	/** Accounts merged into this one. */
	mergedFrom?: string[];
	/**
	 * Timestamp of when this user last saw (completed or dismissed) the profile
	 * OnboardingWizard. Server-side twin of the device-local
	 * `onboarding_dismissed_{uid}` localStorage key, so a returning user is not
	 * shown the welcome wizard again on a new device / after clearing app data.
	 * Absence means "never seen"; presence means "do not show again".
	 */
	onboardingSeenAt?: number;
	fcmTokens?: string[];
	personalExperience?: string;
	customMandalName?: string;
	familyMembers?: FamilyMember[];
	linkedFamilyMembers?: string[];
	/**
	 * uid → how THIS devotee is related to that linked account ("father", or
	 * custom text). Each side sets its own; it is never copied across a link.
	 */
	linkedFamilyRelations?: Record<string, string>;
	/** Relations the syncFamilyLinkGroups function filled in (uid → relation). */
	linkedFamilyRelationsAuto?: Record<string, string>;
	/**
	 * uid → the uid of the family member through whom that account was linked
	 * automatically (family groups merge when two members link). Server-managed.
	 */
	linkedFamilyVia?: Record<string, string>;
	/** Optional; only used to suggest relations ("they call you Father → Son/Daughter"). */
	gender?: "male" | "female";
	// Role-based access control
	role?: "super_admin" | "mandal_admin" | "user";
	mandalAdminFor?: string; // mandalId (only set when role === 'mandal_admin')
}

export interface FamilyMember {
	id: string;
	realName: string;
	dikshaName: string;
	guruName: string;
	dikshaDate: string;
	isAspiring: boolean;
	photoURL?: string; // optional — per-member photo in Firebase Storage
	relation?: string; // how this member is related to the devotee — see src/constants/relations.ts
	/** Why they are added by hand, not linked — see src/constants/familyMemberReasons.ts. */
	noAppReason?: "shared_phone" | "cannot_use" | "other";
	/** Admin review of this member — see utils/familyApproval.ts. Absent = follows the devotee's status. */
	approvalStatus?: "pending" | "approved" | "rejected";
	rejectionNote?: string;
	approvalDate?: number;
}

/**
 * True when this devotee has actually started building a profile.
 *
 * `!!profile` is NOT the same question any more: dismissing the profile
 * welcome wizard writes `onboardingSeenAt` (see above), which creates a
 * minimal `users/{uid}` document with every content field still empty. UI
 * that used to branch on `!profile` to say "create your profile" must ask
 * this instead, or such a devotee is told their profile is merely "awaiting
 * approval" and is given no way to finish it.
 *
 * `realName` and `photoURL` are deliberately not part of the test: realName is
 * defaulted to the Google display name when the document is created, so even a
 * placeholder has one.
 *
 * This is the single definition of "blank placeholder" — ProfileScreen's
 * welcome-wizard gate is its exact complement, so the two can never disagree
 * about the same document.
 */
export function hasStartedProfile(profile: UserProfile | null): boolean {
	if (!profile) return false;
	return Boolean(
		profile.submittedForReview ||
			profile.isApproved ||
			profile.rejectionNote ||
			profile.mandalId ||
			profile.dikshaName ||
			profile.guruName ||
			profile.dikshaDate ||
			profile.personalExperience ||
			(profile.familyMembers?.length ?? 0) > 0,
	);
}

export interface ConflictData {
	currentProfile: UserProfile; // Currently logged-in user's profile
	otherProfile: UserProfile; // The other account's profile
	otherUid: string; // UID of the other (to-be-deleted) account
	credential: any; // Credential to sign into the other account
}

interface AuthContextType {
	user: FirebaseUser | null;
	profile: UserProfile | null;
	loading: boolean;
	/**
	 * True only once a REAL Firestore snapshot has resolved for the current uid
	 * (from cache or server), for both the "document exists" and "does not exist"
	 * outcomes. Unlike `loading`, this is never flipped by the safety timeout, so
	 * `profileLoaded && !profile` is a trustworthy "this user genuinely has no
	 * profile" verdict. Consumers that branch on newness (e.g. the onboarding
	 * wizard gate) must use this instead of `!loading`.
	 */
	profileLoaded: boolean;
	signInWithGoogle: () => Promise<boolean>;
	sendOtp: (phoneNumber: string) => Promise<boolean>;
	verifyOtp: (otp: string) => Promise<boolean>;
	// Account linking
	linkGoogleAccount: () => Promise<{
		success: boolean;
		conflict?: ConflictData;
	}>;
	sendLinkOtp: (phoneNumber: string) => Promise<boolean>;
	verifyAndLinkOtp: (
		otp: string,
	) => Promise<{ success: boolean; conflict?: ConflictData }>;
	resolveAccountMerge: (
		conflictData: ConflictData,
		keepData: Partial<UserProfile>,
	) => Promise<boolean>;
	signOut: () => Promise<void>;
	updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
	deleteAccount: () => Promise<boolean>;
	sendFamilyLinkRequest: (
		phoneNumber: string,
		relation?: string,
		/** Instead of the phone number: an account found with "find on the app". */
		targetUserId?: string,
		/** Instead of the phone number: the email of their (Google) login. */
		email?: string,
	) => Promise<{ success: boolean; error?: string; code?: string }>;
	/** Family link requests waiting for this devotee's answer (live). */
	pendingFamilyRequests: number;
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	profile: null,
	loading: true,
	profileLoaded: false,
	signInWithGoogle: async () => false,
	sendOtp: async () => false,
	verifyOtp: async () => false,
	linkGoogleAccount: async () => ({ success: false }),
	sendLinkOtp: async () => false,
	verifyAndLinkOtp: async () => ({ success: false }),
	resolveAccountMerge: async () => false,
	signOut: async () => {},
	updateProfile: async () => false,
	deleteAccount: async () => false,
	sendFamilyLinkRequest: async () => ({
		success: false,
		error: "Not initialized",
	}),
	pendingFamilyRequests: 0,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [user, setUser] = useState<FirebaseUser | null>(null);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	// Definitive "a real snapshot has resolved for this uid" flag. Deliberately
	// NOT touched by the loading safety timeout — see AuthContextType.profileLoaded.
	const [profileLoaded, setProfileLoaded] = useState(false);
	const [pendingFamilyRequests, setPendingFamilyRequests] = useState(0);

	// Live count of family link requests waiting for this devotee — drives the
	// badge on the header's profile button, so a request is noticed without
	// opening the profile.
	useEffect(() => {
		const uid = user?.uid;
		if (!uid) {
			setPendingFamilyRequests(0);
			return;
		}
		return onSnapshot(
			query(
				collection(db, "familyLinkRequests"),
				where("toUserId", "==", uid),
				where("status", "==", "pending"),
			),
			(snap) => setPendingFamilyRequests(snap.size),
			(err) => console.warn("[Auth] Family request listener failed:", err),
		);
	}, [user?.uid]);
	const { showToast, hideToast } = useToast();
	const { settingsLanguage } = useSettings();

	// Track previous approval status to detect changes
	const prevApprovedRef = useRef<boolean | null>(null);
	// OTP state for Phone Login
	const otpVerificationIdRef = useRef<string | null>(null);
	const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
	// OTP state for Phone Linking (separate from login)
	const linkOtpVerificationIdRef = useRef<string | null>(null);
	const linkRecaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
	// Holds the active profile onSnapshot unsubscribe function.
	// Must be a ref (not state) so it is accessible inside the onAuthStateChanged callback
	// without causing re-renders. Firebase ignores return values from async auth callbacks,
	// so we must clean up the previous listener manually before creating a new one.
	const unsubProfileRef = useRef<(() => void) | undefined>(undefined);
	// Holds the pending "release the loading state" safety timer. Must be re-armed
	// on every sign-in: a single mount-time timer left later sign-ins with no
	// safety net at all (loading could stay true forever if a snapshot never came).
	const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearLoadingTimeout = () => {
		if (loadingTimeoutRef.current) {
			clearTimeout(loadingTimeoutRef.current);
			loadingTimeoutRef.current = null;
		}
	};

	/**
	 * Safety timeout: if onSnapshot takes too long (slow network, offline device),
	 * release the loading state so the UI renders instead of a blank screen.
	 *
	 * IMPORTANT: this only relaxes `loading`. It must NEVER set `profileLoaded`,
	 * because "we gave up waiting" is not the same answer as "this user has no
	 * profile" — conflating the two is what made the onboarding wizard pop up for
	 * already-onboarded users on a slow cold start.
	 */
	const armLoadingTimeout = () => {
		clearLoadingTimeout();
		loadingTimeoutRef.current = setTimeout(() => {
			loadingTimeoutRef.current = null;
			setLoading((prev) => {
				if (prev) {
					console.warn(
						"[Auth] Loading timeout — forcing loading=false after 6s (profileLoaded stays false).",
					);
					return false;
				}
				return prev;
			});
		}, 6000);
	};

	const cleanupRecaptcha = (kind: "login" | "link") => {
		if (Capacitor.isNativePlatform()) return;
		const ref =
			kind === "login" ? recaptchaVerifierRef : linkRecaptchaVerifierRef;
		try {
			ref.current?.clear();
		} catch (_) {}
		ref.current = null;
		const id =
			kind === "login" ? "recaptcha-container" : "link-recaptcha-container";
		document.getElementById(id)?.remove();
	};

	const refreshCurrentUser = async () => {
		if (!profileAuth.currentUser) return;
		await profileAuth.currentUser.reload();
		setUser(profileAuth.currentUser);
	};

	const waitForProfileUser = async (timeoutMs = 4000) => {
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			if (profileAuth.currentUser) return profileAuth.currentUser;
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		return profileAuth.currentUser;
	};

	const isAuthProviderConflict = (error: any) =>
		error?.code === "auth/credential-already-in-use" ||
		error?.code === "auth/account-exists-with-different-credential" ||
		error?.code === "auth/email-already-in-use";

	const handleProviderConflict = (message: string) => {
		showToast(message, "error");
		return { success: false };
	};

	// Handle OAuth redirect result (web-only — popup blocked → redirect fallback).
	// Not applicable on native; skip to avoid an unnecessary network round-trip.
	useEffect(() => {
		if (Capacitor.isNativePlatform()) return;
		getRedirectResult(profileAuth)
			.then((result) => {
				if (result?.user) {
					// Redirect sign-in completed — onAuthStateChanged will fire next,
					// but log here so we can confirm the flow worked.
					console.log(
						"[Auth] Redirect sign-in completed for:",
						result.user.email,
					);
				}
			})
			.catch((error) => {
				// Ignore user-cancelled redirects; log everything else
				if (
					error?.code !== "auth/popup-closed-by-user" &&
					error?.code !== "auth/cancelled-popup-request"
				) {
					console.error(
						"[Auth] Redirect result error:",
						error?.code,
						error?.message,
					);
				}
			});
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: clearLoadingTimeout is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		// Arm the initial safety net for the very first auth resolution.
		armLoadingTimeout();

		const unsubscribe = onAuthStateChanged(profileAuth, async (currentUser) => {
			// Always clean up the previous profile listener before creating a new one.
			// Firebase ignores return values from async callbacks, so we use a ref.
			// Without this, every auth state change (token refresh, app resume, sign-in)
			// stacks a new onSnapshot listener — causing duplicate toasts + memory leaks.
			if (unsubProfileRef.current) {
				unsubProfileRef.current();
				unsubProfileRef.current = undefined;
			}

			setUser(currentUser);
			if (currentUser) {
				setLoading(true); // Ensure loading is true while fetching profile so UI doesn't jump to empty state
				// The incoming uid's profile has not resolved yet. Reset the verdict so
				// consumers cannot read a previous account's answer as this account's.
				setProfileLoaded(false);
				armLoadingTimeout(); // re-arm per sign-in, not once per mount
				// Fetch profile
				const profileRef = doc(db, "users", currentUser.uid);

				// Subscribe to profile changes and store the cleanup in a ref
				unsubProfileRef.current = onSnapshot(
					profileRef,
					(docSnap) => {
						// Read metadata up front: the exists() checks below narrow
						// docSnap's type, after which TypeScript no longer sees
						// `metadata` on it.
						const resolvedFromCache = docSnap.metadata.fromCache;

						if (docSnap.exists()) {
							const newProfile = docSnap.data() as UserProfile;

							// Detect approval status change
							if (
								prevApprovedRef.current === false &&
								newProfile.isApproved === true
							) {
								showToast(
									"🎉 Your profile has been approved! You can now like and comment.",
									"success",
								);
							}
							if (
								prevApprovedRef.current === true &&
								newProfile.isApproved === false &&
								newProfile.rejectionNote
							) {
								showToast(
									`❌ Profile rejected: ${newProfile.rejectionNote}`,
									"error",
								);
							}
							prevApprovedRef.current = newProfile.isApproved;

							// Add FCM Token to profile if not present (handles case where
							// token is ready before profile snapshot arrives).
							// Keep only the last 5 unique tokens to prevent unbounded Firestore growth.
							const currentFcmToken = getCurrentFcmToken();
							if (currentFcmToken) {
								const currentTokens = newProfile.fcmTokens || [];
								if (!currentTokens.includes(currentFcmToken)) {
									const updatedTokens = [
										...currentTokens,
										currentFcmToken,
									].slice(-5);
									updateDoc(profileRef, {
										fcmTokens: updatedTokens,
									}).catch((err) =>
										console.error("Failed to save FCM token to profile", err),
									);
									newProfile.fcmTokens = updatedTokens;
								}
							}

							setProfile(newProfile);
						} else {
							setProfile(null); // Profile not created yet
							prevApprovedRef.current = null;
						}
						// A real snapshot resolved — but "this document does not exist"
						// straight out of the offline cache is NOT a trustworthy answer:
						// on a new device (or after clearing app data) Firestore reports a
						// missing doc from cache while offline, which would have told the
						// Profile screen that a long-standing devotee is a brand-new user.
						// An *existing* doc from cache is fine — it can only suppress the
						// welcome wizard, never trigger it.
						if (docSnap.exists() || !resolvedFromCache) {
							setProfileLoaded(true);
						}
						// Release the UI regardless, so nothing can hang on a spinner.
						clearLoadingTimeout();
						setLoading(false);
					},
					(error) => {
						console.error("Error fetching profile:", error);
						// Deliberately leave profileLoaded false: we do NOT know whether
						// this user has a profile, so nothing may infer newness from it.
						clearLoadingTimeout();
						setLoading(false);
					},
				);

				// Register FCM token callback — fires once when the token becomes available.
				// This handles the case where the token arrives AFTER the profile is already loaded.
				setOnFcmTokenReady((fcmToken) => {
					getDoc(profileRef)
						.then((snap) => {
							if (!snap.exists()) return;
							const existingTokens: string[] = snap.data()?.fcmTokens || [];
							if (!existingTokens.includes(fcmToken)) {
								// Keep last 5 tokens only
								const updatedTokens = [...existingTokens, fcmToken].slice(-5);
								updateDoc(profileRef, {
									fcmTokens: updatedTokens,
								}).catch((err) =>
									console.error("[FCM] Failed to save token on ready:", err),
								);
							}
						})
						.catch(() => {});
				});
			} else {
				setProfile(null);
				prevApprovedRef.current = null;
				// Signed out: there is no uid to have a verdict about.
				setProfileLoaded(false);
				clearLoadingTimeout();
				setLoading(false);
			}
		});

		return () => {
			clearLoadingTimeout();
			unsubscribe();
			// Also clean up any active profile listener when the component unmounts
			if (unsubProfileRef.current) unsubProfileRef.current();
		};
	}, []);

	const signInWithGoogle = async () => {
		showToast("Google से कनेक्ट हो रहा है...", "loading");
		const provider = new GoogleAuthProvider();
		provider.setCustomParameters({
			prompt: "select_account",
		});

		try {
			if (Capacitor.isNativePlatform()) {
				// Use Native Google Sign-In via Firebase Authentication plugin (v7 compatible)
				// NOTE: With Google Play App Signing (ASbG), the plugin may authenticate
				// the user natively without returning an idToken. We must handle both cases.
				let result;
				try {
					result = await FirebaseAuthentication.signInWithGoogle({
						skipNativeAuth: true,
					});
				} catch (nativeError: any) {
					hideToast();
					const errMsg = (nativeError as any)?.message || "";
					// Error code 12501 = user cancelled the Google account picker
					const userCancelled =
						errMsg.includes("12501") || errMsg.toLowerCase().includes("cancel");
					if (!userCancelled) {
						console.error(
							"[Auth] Native Google Sign-In error:",
							(nativeError as any)?.code,
							errMsg,
						);
						showToast("Sign-in failed. Please try again.", "error");
					}
					return false;
				}

				hideToast();

				// Case 1: Plugin returned an idToken → use it to sign in to the web SDK
				if (result.credential?.idToken) {
					const credential = GoogleAuthProvider.credential(
						result.credential.idToken,
					);
					const authResult = await signInWithCredential(
						profileAuth,
						credential,
					);
					return !!authResult.user;
				}

				// Case 2: With App Signing by Google (ASbG), the native Firebase SDK may
				// have already authenticated the user without exposing the idToken.
				// onAuthStateChanged fires asynchronously, so currentUser may not be set
				// immediately. Poll for up to 3 seconds before giving up.
				if (profileAuth.currentUser) {
					console.log(
						"[Auth] Native sign-in: user already authenticated (ASbG mode, immediate).",
					);
					return true;
				}
				// Wait up to 3s for onAuthStateChanged to update currentUser
				const waitForUser = await new Promise<boolean>((resolve) => {
					let attempts = 0;
					const interval = setInterval(() => {
						attempts++;
						if (profileAuth.currentUser) {
							clearInterval(interval);
							console.log(
								`[Auth] Native sign-in: user resolved after ${attempts * 300}ms (ASbG mode).`,
							);
							resolve(true);
						} else if (attempts >= 10) {
							// 10 × 300ms = 3s max
							clearInterval(interval);
							resolve(false);
						}
					}, 300);
				});
				if (waitForUser) return true;

				// Case 3: Neither idToken nor currentUser after 3s — genuine failure
				console.error(
					"[Auth] Google Sign-In: no idToken and no currentUser after 3s. Full result:",
					JSON.stringify(result),
				);
				showToast(
					"Sign-in failed. Please update the app or contact support.",
					"error",
				);
				return false;
			} else {
				// Web / PWA
				const result = await signInWithPopup(profileAuth, provider);
				hideToast();
				return !!result.user;
			}
		} catch (error: any) {
			hideToast();
			console.error(
				"Google sign in error:",
				error?.code,
				error?.message,
				error,
			);
			if (error.code === "auth/popup-blocked") {
				showToast("Popup blocked by browser. Trying redirect...", "warning");
				await signInWithRedirect(profileAuth, provider);
			} else if (
				error.code !== "auth/popup-closed-by-user" &&
				error.code !== "auth/cancelled-popup-request" &&
				error.message !== "The user canceled the sign-in flow."
			) {
				showToast(
					`Sign-in failed: ${error.message || error.code || "Unknown error"}`,
					"error",
				);
			}
			return false;
		}
	};

	// ─── Phone OTP Login ─────────────────────────────────────────────────────
	const sendOtp = async (phoneNumber: string): Promise<boolean> => {
		if (!phoneNumber.trim()) {
			showToast("Phone number required", "warning");
			return false;
		}
		// Ensure E.164 format (+91XXXXXXXXXX)
		const formatted = phoneNumber.startsWith("+")
			? phoneNumber
			: `+91${phoneNumber}`;
		showToast("OTP भेजा जा रहा है...", "loading");
		try {
			if (Capacitor.isNativePlatform()) {
				// Native (v7): signInWithPhoneNumber returns void.
				// We MUST await all listener attachments BEFORE invoking signInWithPhoneNumber
				// to prevent race conditions where events fire before listeners are ready.
				const verificationId = await new Promise<string | null>(
					async (resolve) => {
						let sentHandle: any = null;
						let failHandle: any = null;
						let completedHandle: any = null;
						let isResolved = false;

						const cleanup = () => {
							sentHandle?.remove?.();
							failHandle?.remove?.();
							completedHandle?.remove?.();
						};

						const timeoutId = setTimeout(() => {
							if (!isResolved) {
								isResolved = true;
								cleanup();
								resolve(null);
							}
						}, 60000); // 60 seconds timeout for SMS delivery

						sentHandle = await FirebaseAuthentication.addListener(
							"phoneCodeSent" as any,
							(event: any) => {
								if (!isResolved) {
									isResolved = true;
									clearTimeout(timeoutId);
									cleanup();
									resolve(event?.verificationId ?? null);
								}
							},
						);

						failHandle = await FirebaseAuthentication.addListener(
							"phoneVerificationFailed" as any,
							(error: any) => {
								console.error("[Auth] Native phoneVerificationFailed:", error);
								if (!isResolved) {
									isResolved = true;
									clearTimeout(timeoutId);
									cleanup();
									resolve(null);
								}
							},
						);

						completedHandle = await FirebaseAuthentication.addListener(
							"phoneVerificationCompleted" as any,
							(event: any) => {
								console.log("[Auth] Native phoneVerificationCompleted:", event);
								if (!isResolved) {
									isResolved = true;
									clearTimeout(timeoutId);
									cleanup();
									// With skipNativeAuth enabled, a completion event without a
									// verificationId cannot be safely transferred to profileAuth.
									resolve(event?.verificationId || null);
								}
							},
						);

						// Trigger the OTP send after listeners are registered
						try {
							await FirebaseAuthentication.signInWithPhoneNumber({
								phoneNumber: formatted,
								skipNativeAuth: true,
							});
						} catch (err: any) {
							console.error("[Auth] Native signInWithPhoneNumber error:", err);
							if (!isResolved) {
								isResolved = true;
								clearTimeout(timeoutId);
								cleanup();
								resolve(null);
							}
						}
					},
				);

				if (verificationId) {
					otpVerificationIdRef.current = verificationId;
					hideToast();
					showToast("OTP भेजा गया ✅", "success");
					return true;
				}
				hideToast();
				showToast("OTP नहीं भेजा जा सका। दोबारा कोशिश करें।", "error");
				return false;
			} else {
				// Web: invisible reCAPTCHA
				if (recaptchaVerifierRef.current) {
					try {
						recaptchaVerifierRef.current.clear();
					} catch (_) {}
					recaptchaVerifierRef.current = null;
				}
				const oldContainer = document.getElementById("recaptcha-container");
				if (oldContainer) oldContainer.remove();

				const container = document.createElement("div");
				container.id = "recaptcha-container";
				document.body.appendChild(container);

				const verifier = new RecaptchaVerifier(
					profileAuth,
					"recaptcha-container",
					{
						size: "invisible",
						callback: () => {},
						"expired-callback": () => {
							try {
								recaptchaVerifierRef.current?.clear();
							} catch (_) {}
							recaptchaVerifierRef.current = null;
						},
					},
				);
				recaptchaVerifierRef.current = verifier;
				await verifier.render();

				const confirmation = await signInWithPhoneNumber(
					profileAuth,
					formatted,
					verifier,
				);
				otpVerificationIdRef.current = confirmation.verificationId;
				hideToast();
				showToast("OTP भेजा गया ✅", "success");
				return true;
			}
		} catch (error: any) {
			hideToast();
			if (!Capacitor.isNativePlatform()) {
				cleanupRecaptcha("login");
			}
			console.error(
				"[Auth] sendOtp error:",
				error?.code,
				error?.message,
				error,
			);

			const code = error?.code || "";
			if (code === "auth/invalid-phone-number") {
				showToast("फोन नंबर सही नहीं है। +91 के साथ 10 अंक डालें।", "error");
			} else if (code === "auth/too-many-requests") {
				showToast("बहुत अधिक प्रयास हो गए। कुछ देर बाद दोबारा कोशिश करें।", "error");
			} else if (code === "auth/quota-exceeded") {
				showToast("SMS limit पहुँच गई। बाद में कोशिश करें।", "error");
			} else if (code === "auth/network-request-failed") {
				showToast("Internet connection check करें और दोबारा कोशिश करें।", "error");
			} else if (code === "auth/operation-not-allowed") {
				showToast(
					"Phone Login Firebase Console में चालू नहीं है। एडमिन से संपर्क करें।",
					"error",
				);
			} else if (code === "auth/unauthorized-domain") {
				showToast("यह डोमेन Firebase में authorized नहीं है।", "error");
			} else if (code === "auth/captcha-check-failed") {
				showToast(
					import.meta.env.DEV && !Capacitor.isNativePlatform()
						? "यह नंबर Firebase Console में test phone number नहीं है (dev mode)।"
						: "reCAPTCHA verification failed. दोबारा कोशिश करें।",
					"error",
				);
			} else if (code === "auth/invalid-app-credential") {
				showToast(
					Capacitor.isNativePlatform()
						? "Android App Verification (SHA-1) failed. कृपया सेटिंग्स जांचें।"
						: import.meta.env.DEV
							? "Dev mode में सिर्फ़ Firebase Console के test phone number से OTP चलता है।"
							: "reCAPTCHA verification failed. दोबारा कोशिश करें।",
					"error",
				);
			} else {
				showToast("OTP नहीं भेजा जा सका। दोबारा कोशिश करें।", "error");
			}
			return false;
		}
	};

	const verifyOtp = async (otp: string): Promise<boolean> => {
		// Bug fix: was `!ref && ref !== 'INSTANT_VERIFIED'` which is always false when ref is null.
		// Correct logic: block if ref is null (no OTP sent) AND it's also not INSTANT_VERIFIED.
		if (!otpVerificationIdRef.current) {
			showToast("पहले OTP भेजें", "warning");
			return false;
		}
		if (!otp.trim() || otp.length !== 6) {
			showToast("6-digit OTP enter करें", "warning");
			return false;
		}
		showToast("Verifying...", "loading");
		try {
			if (Capacitor.isNativePlatform()) {
				const verificationId = otpVerificationIdRef.current!;
				if (verificationId === "INSTANT_VERIFIED") {
					hideToast();
					otpVerificationIdRef.current = null;
					showToast(
						"Auto verification could not sync. Please request OTP again.",
						"error",
					);
					return false;
				}

				const nativeResult =
					(await FirebaseAuthentication.confirmVerificationCode({
						verificationId,
						verificationCode: otp,
					})) as any;
				const nativeCredential = nativeResult?.credential;
				if (
					nativeCredential?.verificationId &&
					nativeCredential?.verificationCode
				) {
					const cred = PhoneAuthProvider.credential(
						nativeCredential.verificationId,
						nativeCredential.verificationCode,
					);
					await signInWithCredential(profileAuth, cred);
				} else {
					const cred = PhoneAuthProvider.credential(verificationId, otp);
					await signInWithCredential(profileAuth, cred);
				}
				if (!profileAuth.currentUser && !(await waitForProfileUser())) {
					hideToast();
					showToast("Verification failed", "error");
					return false;
				}

				hideToast();
				showToast("Login successful ✅", "success");
				otpVerificationIdRef.current = null;
				cleanupRecaptcha("login");
				return true;
			}

			// Web: use PhoneAuthProvider credential
			const credential = PhoneAuthProvider.credential(
				otpVerificationIdRef.current!,
				otp,
			);

			// If user is already signed in (e.g., Google), link the phone to that account
			if (profileAuth.currentUser) {
				try {
					await linkWithCredential(profileAuth.currentUser, credential);
					await refreshCurrentUser();
					hideToast();
					showToast("Phone number linked to your account ✅", "success");
					otpVerificationIdRef.current = null;
					cleanupRecaptcha("login");
					return true;
				} catch (linkErr: any) {
					if (isAuthProviderConflict(linkErr)) {
						hideToast();
						showToast(
							settingsLanguage === "hi"
								? "यह फ़ोन नंबर किसी अन्य खाते से जुड़ा हुआ है। कृपया उस फ़ोन खाते से लॉगिन करें।"
								: "This phone number is linked to another account. Please login with that account.",
							"error",
						);
						otpVerificationIdRef.current = null;
						cleanupRecaptcha("login");
						return false;
					}
					throw linkErr;
				}
			}

			// No current user — fresh sign in with phone
			const authResult = await signInWithCredential(profileAuth, credential);
			hideToast();
			showToast("Login successful ✅", "success");
			otpVerificationIdRef.current = null;
			cleanupRecaptcha("login");
			return !!authResult.user;
		} catch (error: any) {
			hideToast();
			console.error("[Auth] verifyOtp error:", error?.code, error?.message);
			if (error?.code === "auth/invalid-verification-code") {
				showToast("OTP गलत है। फिर से check करें।", "error");
			} else if (error?.code === "auth/code-expired") {
				showToast("OTP expire हो गया। फिर से भेजें।", "error");
				otpVerificationIdRef.current = null;
			} else {
				showToast(
					"Verification failed: " +
						(error?.message || error?.code || "Unknown"),
					"error",
				);
			}
			return false;
		}
	};

	// ─── Account Linking ──────────────────────────────────────────────────

	/**
	 * Helper: fetch a Firestore profile by UID.
	 */
	const fetchProfileByUid = async (
		uid: string,
	): Promise<UserProfile | null> => {
		try {
			const snap = await getDoc(doc(db, "users", uid));
			return snap.exists() ? (snap.data() as UserProfile) : null;
		} catch {
			return null;
		}
	};

	/**
	 * Link Google to the currently logged-in account (phone or Google).
	 * Returns { success: true } on direct link.
	 * Returns { success: false, conflict } when the Google account is a
	 * DIFFERENT Firebase UID that already has its own Firestore profile.
	 */
	const linkGoogleAccount = async (): Promise<{
		success: boolean;
		conflict?: ConflictData;
	}> => {
		if (!profileAuth.currentUser) {
			showToast("Pehle login karein", "warning");
			return { success: false };
		}
		const provider = new GoogleAuthProvider();
		provider.setCustomParameters({ prompt: "select_account" });
		showToast("Google se connect ho raha hai...", "loading");
		try {
			// Try to link directly
			if (Capacitor.isNativePlatform()) {
				const nativeResult = await FirebaseAuthentication.signInWithGoogle({
					skipNativeAuth: true,
				});
				if (nativeResult?.credential?.idToken) {
					const cred = GoogleAuthProvider.credential(
						nativeResult.credential.idToken,
					);
					await linkWithCredential(profileAuth.currentUser, cred);
					await refreshCurrentUser();
					hideToast();
					showToast("Google account link ho gaya ✅", "success");
					return { success: true };
				}
				hideToast();
				showToast("Google sign-in failed", "error");
				return { success: false };
			} else {
				await linkWithPopup(profileAuth.currentUser, provider);
				await refreshCurrentUser();
				hideToast();
				showToast("Google account link ho gaya ✅", "success");
				return { success: true };
			}
		} catch (err: any) {
			hideToast();
			if (isAuthProviderConflict(err)) {
				return handleProviderConflict(
					settingsLanguage === "hi"
						? "यह Google खाता किसी अन्य खाते से जुड़ा हुआ है। कृपया उस Google खाते से लॉगिन करें और सपोर्ट टीम से खाता मर्ज करने का अनुरोध करें।"
						: "This Google account is linked to another account. Please login with that Google account and contact support for a merge request.",
				);
			}
			if (
				err?.code === "auth/credential-already-in-use" ||
				err?.code === "auth/email-already-in-use"
			) {
				// Google account exists as a SEPARATE Firebase account.
				// Get the credential from the error to sign into that account.
				const otherCredential = err?.credential as OAuthCredential | null;
				if (!otherCredential || !profile) {
					showToast(
						"Yeh Google account kisi aur se link hai. Contact support.",
						"error",
					);
					return { success: false };
				}
				// Sign into the OTHER account to get its profile
				try {
					const otherUserResult = await signInWithCredential(
						profileAuth,
						otherCredential,
					);
					const otherUid = otherUserResult.user.uid;
					const otherProfile = await fetchProfileByUid(otherUid);
					// Sign back into the CURRENT account
					// (We need the current user's credential — re-fetch via getRedirectResult or just keep current)
					// Since linkWithPopup failed, profileAuth is now the OTHER user.
					// We need to re-auth as current user — but current session is lost.
					// Strategy: store conflict data and let user resolve, signing back into current
					// by using the stored verificationId or simply noting the UIDs.
					return {
						success: false,
						conflict: {
							currentProfile: profile,
							otherProfile: otherProfile || ({ uid: otherUid } as UserProfile),
							otherUid,
							credential: otherCredential,
						},
					};
				} catch (innerErr) {
					console.error(
						"[Auth] linkGoogleAccount conflict fetch error:",
						innerErr,
					);
					showToast(
						"Account link karne mein error. Dobara try karein.",
						"error",
					);
					return { success: false };
				}
			} else if (err?.code === "auth/provider-already-linked") {
				showToast("Google account pehle se linked hai ✅", "success");
				return { success: true };
			} else if (
				err?.code !== "auth/popup-closed-by-user" &&
				err?.code !== "auth/cancelled-popup-request"
			) {
				console.error(
					"[Auth] linkGoogleAccount error:",
					err?.code,
					err?.message,
				);
				showToast(
					`Google link failed: ${err?.code || err?.message || "Unknown"}`,
					"error",
				);
			}
			return { success: false };
		}
	};

	/**
	 * Send OTP for LINKING a phone number to the current account.
	 * Uses a separate verifier ref from the login OTP flow.
	 */
	const sendLinkOtp = async (phoneNumber: string): Promise<boolean> => {
		if (!profileAuth.currentUser) {
			showToast("Pehle login karein", "warning");
			return false;
		}
		if (!phoneNumber.trim()) {
			showToast("Phone number required", "warning");
			return false;
		}
		const formatted = phoneNumber.startsWith("+")
			? phoneNumber
			: `+91${phoneNumber}`;
		showToast("OTP bheja ja raha hai...", "loading");
		try {
			if (Capacitor.isNativePlatform()) {
				// Native: reuse the same listener pattern
				const verificationId = await new Promise<string | null>(
					async (resolve) => {
						let sentHandle: any = null;
						let failHandle: any = null;
						let isResolved = false;
						const timeoutId = setTimeout(() => {
							if (!isResolved) {
								isResolved = true;
								sentHandle?.remove?.();
								failHandle?.remove?.();
								resolve(null);
							}
						}, 60000);
						sentHandle = await FirebaseAuthentication.addListener(
							"phoneCodeSent" as any,
							(event: any) => {
								if (!isResolved) {
									isResolved = true;
									clearTimeout(timeoutId);
									sentHandle?.remove?.();
									failHandle?.remove?.();
									resolve(event?.verificationId ?? null);
								}
							},
						);
						failHandle = await FirebaseAuthentication.addListener(
							"phoneVerificationFailed" as any,
							(error: any) => {
								console.error("[Auth] linkOtp phoneVerificationFailed:", error);
								if (!isResolved) {
									isResolved = true;
									clearTimeout(timeoutId);
									sentHandle?.remove?.();
									failHandle?.remove?.();
									resolve(null);
								}
							},
						);
						try {
							await FirebaseAuthentication.signInWithPhoneNumber({
								phoneNumber: formatted,
								skipNativeAuth: true,
							});
						} catch (_err: any) {
							if (!isResolved) {
								isResolved = true;
								clearTimeout(timeoutId);
								sentHandle?.remove?.();
								failHandle?.remove?.();
								resolve(null);
							}
						}
					},
				);
				if (verificationId) {
					linkOtpVerificationIdRef.current = verificationId;
					hideToast();
					showToast("OTP bheja gaya ✅", "success");
					return true;
				}
				hideToast();
				showToast("OTP nahi bheja ja saka. Dobara try karein.", "error");
				return false;
			} else {
				// Web reCAPTCHA
				if (linkRecaptchaVerifierRef.current) {
					try {
						linkRecaptchaVerifierRef.current.clear();
					} catch (_) {}
					linkRecaptchaVerifierRef.current = null;
				}
				const oldEl = document.getElementById("link-recaptcha-container");
				if (oldEl) oldEl.remove();
				const container = document.createElement("div");
				container.id = "link-recaptcha-container";
				document.body.appendChild(container);
				const verifier = new RecaptchaVerifier(
					profileAuth,
					"link-recaptcha-container",
					{
						size: "invisible",
						callback: () => {},
						"expired-callback": () => {
							try {
								linkRecaptchaVerifierRef.current?.clear();
							} catch (_) {}
							linkRecaptchaVerifierRef.current = null;
						},
					},
				);
				linkRecaptchaVerifierRef.current = verifier;
				await verifier.render();
				const confirmation = await signInWithPhoneNumber(
					profileAuth,
					formatted,
					verifier,
				);
				linkOtpVerificationIdRef.current = confirmation.verificationId;
				hideToast();
				showToast("OTP bheja gaya ✅", "success");
				return true;
			}
		} catch (error: any) {
			hideToast();
			if (!Capacitor.isNativePlatform()) {
				cleanupRecaptcha("link");
			}
			console.error("[Auth] sendLinkOtp error:", error?.code, error?.message);
			const code = error?.code || "";
			if (code === "auth/provider-already-linked") {
				showToast("Yeh phone number pehle se linked hai ✅", "success");
				return false;
			} else if (code === "auth/invalid-phone-number") {
				showToast(
					"Phone number sahi nahi hai. +91 ke saath 10 ank dalein.",
					"error",
				);
			} else if (code === "auth/too-many-requests") {
				showToast(
					"Bahut adhik prayas ho gaye. Kuch der baad dobara try karein.",
					"error",
				);
			} else {
				showToast(`OTP nahi bheja ja saka: ${code || error?.message}`, "error");
			}
			return false;
		}
	};

	/**
	 * Verify OTP and LINK the phone number to the current logged-in account.
	 * Returns { success: true } on direct link.
	 * Returns { success: false, conflict } when phone belongs to a different Firebase account.
	 */
	const verifyAndLinkOtp = async (
		otp: string,
	): Promise<{ success: boolean; conflict?: ConflictData }> => {
		if (!profileAuth.currentUser) return { success: false };
		if (!linkOtpVerificationIdRef.current) {
			showToast("Pehle OTP bhejein", "warning");
			return { success: false };
		}
		if (!otp.trim() || otp.length !== 6) {
			showToast("6-digit OTP enter karein", "warning");
			return { success: false };
		}
		showToast("Verifying...", "loading");
		try {
			const credential = PhoneAuthProvider.credential(
				linkOtpVerificationIdRef.current,
				otp,
			);
			await linkWithCredential(profileAuth.currentUser, credential);
			await refreshCurrentUser();
			hideToast();
			showToast("Phone number link ho gaya ✅", "success");
			linkOtpVerificationIdRef.current = null;
			cleanupRecaptcha("link");
			return { success: true };
		} catch (err: any) {
			hideToast();
			if (isAuthProviderConflict(err)) {
				return handleProviderConflict(
					settingsLanguage === "hi"
						? "यह फ़ोन नंबर किसी अन्य खाते से जुड़ा हुआ है। कृपया उस फ़ोन खाते से लॉगिन करें और सपोर्ट टीम से खाता मर्ज करने का अनुरोध करें।"
						: "This phone number is linked to another account. Please login with that phone account and contact support for a merge request.",
				);
			} else if (err?.code === "auth/provider-already-linked") {
				showToast("Yeh phone number pehle se linked hai ✅", "success");
				linkOtpVerificationIdRef.current = null;
				return { success: true };
			} else if (err?.code === "auth/invalid-verification-code") {
				showToast("OTP galat hai. Phir se check karein.", "error");
			} else if (err?.code === "auth/code-expired") {
				showToast("OTP expire ho gaya. Phir se bhejein.", "error");
				linkOtpVerificationIdRef.current = null;
			} else {
				console.error(
					"[Auth] verifyAndLinkOtp error:",
					err?.code,
					err?.message,
				);
				showToast(
					`Verification failed: ${err?.message || err?.code || "Unknown"}`,
					"error",
				);
			}
			return { success: false };
		}
	};

	/**
	 * Resolve a merge conflict by:
	 * 1. Updating the CURRENT user's profile with the chosen data
	 * 2. Soft-deleting the OTHER profile in Firestore
	 * 3. Deleting the OTHER Firebase Auth account
	 * 4. The current user now has both providers linked
	 *
	 * IMPORTANT: At the time this is called, profileAuth.currentUser is the
	 * OTHER account (we signed into it to fetch its profile). We need to
	 * re-sign-into the CURRENT account before updating its profile.
	 * Strategy: the caller passes `conflictData.currentProfile` uid, and we
	 * use the current session to do the updates.
	 */
	const resolveAccountMerge = async (
		conflictData: ConflictData,
		keepData: Partial<UserProfile>,
	): Promise<boolean> => {
		showToast(
			"Safe merge abhi client se available nahi hai. Pehle dono accounts verify karke admin/support merge flow use karein.",
			"warning",
		);
		console.warn("[Auth] Unsafe client-side merge blocked.", {
			currentUid: conflictData.currentProfile?.uid,
			otherUid: conflictData.otherUid,
			requestedFields: Object.keys(keepData || {}),
		});
		return false;

		/* Historical client-side merge implementation (disabled):
        showToast('Accounts merge ho rahe hain...', 'loading');
        try {
            const currentUid = conflictData.currentProfile.uid;
            const otherUid = conflictData.otherUid;

            // Step 1: Soft-delete the other profile
            await setDoc(doc(db, 'users', otherUid), {
                isDeleted: true,
                deletedAt: Date.now(),
                mergedIntoUid: currentUid,
                scheduledDeletionDate: Date.now() + (365 * 24 * 60 * 60 * 1000 * 10),
            }, { merge: true });

            // Step 2: Delete the other Firebase Auth user
            // profileAuth.currentUser at this point MAY be the other user (from conflict sign-in)
            const currentAuthUser = profileAuth.currentUser;
            if (currentAuthUser && currentAuthUser.uid === otherUid) {
                await deleteUser(currentAuthUser);
                if (Capacitor.isNativePlatform()) {
                    await FirebaseAuthentication.signOut().catch(() => {});
                    await firebaseSignOut(defaultAuth).catch(() => {});
                }
            }

            // Step 3: Update the CURRENT (kept) profile with chosen data
            // We need to re-authenticate as the current user.
            // Since we're in an undefined auth state now, update Firestore directly.
            const mergedFamilyMembers = [
                ...(conflictData.currentProfile.familyMembers || []),
                ...(conflictData.otherProfile.familyMembers || []).filter(
                    om => !(conflictData.currentProfile.familyMembers || []).some(cm => cm.id === om.id)
                )
            ];

            await setDoc(doc(db, 'users', currentUid), {
                ...keepData,
                familyMembers: mergedFamilyMembers,
                uid: currentUid,
            }, { merge: true });

            hideToast();
            showToast('Accounts merge ho gaye ✅ Dobara login karein.', 'success');
            // Force a sign-out so the user re-authenticates cleanly
            await firebaseSignOut(profileAuth).catch(() => {});
            await firebaseSignOut(defaultAuth).catch(() => {});
            if (Capacitor.isNativePlatform()) {
                await FirebaseAuthentication.signOut().catch(() => {});
            }
            setUser(null);
            setProfile(null);
            return true;
        } catch (error: any) {
            hideToast();
            console.error('[Auth] resolveAccountMerge error:', error);
            showToast('Merge failed: ' + (error?.message || error?.code || 'Unknown'), 'error');
            return false;
        }
        */
	};

	const signOut = async () => {
		try {
			setOnFcmTokenReady(null); // Bug #22 fix: clear stale callback (null is accepted by firebase.ts)
			await firebaseSignOut(profileAuth);
			// Also sign out of defaultAuth on native so the two instances stay in sync
			if (Capacitor.isNativePlatform()) {
				await firebaseSignOut(defaultAuth).catch(() => {});
				await FirebaseAuthentication.signOut().catch((e) =>
					console.warn("Native sign out error:", e),
				);
			}

			setUser(null);
			setProfile(null);
			setProfileLoaded(false);
			prevApprovedRef.current = null;
		} catch (error) {
			console.error("Sign out error:", error);
		}
	};

	const updateProfile = async (data: Partial<UserProfile>) => {
		if (!user) return false;

		try {
			const profileRef = doc(db, "users", user.uid);
			const sanitizeSelfProfileData = (
				input: Partial<UserProfile>,
				isCreate: boolean,
			) => {
				// Remove any undefined values deeply so Firestore doesn't crash
				const removeUndefined = (obj: any): any => {
					if (Array.isArray(obj)) {
						return obj.map((v) =>
							v === undefined ? null : removeUndefined(v),
						);
					} else if (obj !== null && typeof obj === "object") {
						return Object.fromEntries(
							Object.entries(obj)
								.filter(([_, v]) => v !== undefined)
								.map(([k, v]) => [k, removeUndefined(v)]),
						);
					}
					return obj;
				};

				const next = removeUndefined(input) as Partial<UserProfile> &
					Record<string, unknown>;
				const blocked = [
					"role",
					"mandalAdminFor",
					"approvalDate",
					"isDeleted",
					"deletedAt",
					"scheduledDeletionDate",
					"mergedIntoUid",
					// Bug #11 fix: users cannot modify their own linkedFamilyMembers;
					// linking must go through the familyLinkRequests flow (Cloud Function).
					"linkedFamilyMembers",
					"linkedFamilyVia",
				];
				if (!isCreate) blocked.push("isApproved");
				blocked.forEach((key) => delete next[key]);
				return next as Partial<UserProfile>;
			};

			// If profile doesn't exist, create it with default values
			if (!profile) {
				const newProfile: UserProfile = {
					uid: user.uid,
					role: "user",
					shortId: Math.floor(100000 + Math.random() * 900000).toString(),
					email: user.email,
					realName: user.displayName || "",
					dikshaName: "",
					guruName: "",
					dikshaDate: "",
					mandalId: "",
					phoneNumber: "",
					isAspiring: false,
					submittedForReview: false,
					isApproved: false,
					rejectionNote: "",
					createdAt: Date.now(),
					submissionDate: Date.now(),
					resubmitted: false,
					customMandalName: "",
					familyMembers: [],
					...sanitizeSelfProfileData(data, true),
				};
				await setDoc(profileRef, newProfile, { merge: true });
			} else {
				await setDoc(profileRef, sanitizeSelfProfileData(data, false), {
					merge: true,
				});
			}

			return true;
		} catch (error) {
			console.error("Error updating profile:", error);
			showToast("Failed to save profile", "error");
			return false;
		}
	};

	const sendFamilyLinkRequest = async (
		phoneNumber: string,
		relation?: string,
		targetUserId?: string,
		email?: string,
	): Promise<{ success: boolean; error?: string; code?: string }> => {
		if (!user || !profile) return { success: false, error: "Not logged in" };
		const isHindi = settingsLanguage === "hi";

		try {
			const { httpsCallable } = await import("firebase/functions");
			// profileFunctions, not `functions`: the devotee is signed in on
			// profileAuth, and a callable only carries its own app's login.
			const { profileFunctions } = await import("../services/firebase");
			const sendReqFn = httpsCallable(
				profileFunctions,
				"sendFamilyLinkRequest",
			);

			await sendReqFn(
				targetUserId
					? { targetUserId, relation: relation || "" }
					: email
						? { email, relation: relation || "" }
						: { phoneNumber, relation: relation || "" },
			);

			return { success: true };
		} catch (err: any) {
			console.error("sendFamilyLinkRequest error:", err);

			let errorMsg = isHindi ? "अनुरोध भेजने में त्रुटि" : "Error sending request";
			if (err.code === "functions/not-found" && targetUserId) {
				errorMsg = isHindi
					? "यह भक्त अब ऐप पर उपलब्ध नहीं है"
					: "This devotee is no longer on the app";
			} else if (err.code === "functions/not-found" && email) {
				errorMsg = isHindi
					? "इस ईमेल से कोई उपयोगकर्ता नहीं मिला"
					: "No user found with this email";
			} else if (
				err.code === "functions/invalid-argument" &&
				email &&
				!err.message.includes("yourself")
			) {
				errorMsg = isHindi ? "सही ईमेल डालें" : "Enter a valid email";
			} else if (err.code === "functions/not-found") {
				errorMsg = isHindi
					? "इस नंबर पर कोई उपयोगकर्ता नहीं मिला"
					: "No user found with this phone number";
			} else if (
				err.code === "functions/invalid-argument" &&
				err.message.includes("yourself")
			) {
				errorMsg = isHindi
					? "आप खुद को परिवार में नहीं जोड़ सकते"
					: "You cannot link to yourself";
			} else if (
				err.code === "functions/already-exists" &&
				err.message.includes("Already linked")
			) {
				errorMsg = isHindi
					? "यह उपयोगकर्ता पहले से आपके परिवार में जुड़ा है"
					: "This user is already linked to your family";
			} else if (err.code === "functions/already-exists") {
				errorMsg = isHindi
					? "आपने पहले से इस उपयोगकर्ता को अनुरोध भेजा हुआ है"
					: "You already sent a request to this user";
			} else if (err.code === "functions/failed-precondition") {
				errorMsg = isHindi
					? "इन्होंने आपको पहले ही अनुरोध भेजा है — ऊपर 'लंबित अनुरोध' में स्वीकार करें"
					: "They already sent you a request — accept it under Pending Requests";
			} else if (err.code === "functions/unauthenticated") {
				errorMsg = isHindi ? "कृपया दोबारा लॉगिन करें" : "Please log in again";
			}

			return {
				success: false,
				error: errorMsg,
				code:
					typeof err?.code === "string"
						? err.code.replace("functions/", "")
						: undefined,
			};
		}
	};

	const deleteAccount = async () => {
		if (!user) return false;
		const deletedUid = user.uid;
		try {
			// Soft delete: Mark Firestore profile as deleted with  retention policy
			const profileRef = doc(db, "users", user.uid);
			const deletionData = {
				isDeleted: true,
				deletedAt: Date.now(),
				scheduledDeletionDate: Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000, // 10 years from now
			};
			await setDoc(profileRef, deletionData, { merge: true });

			// The automatic online backup belongs to this account only. Must run
			// while still signed in — storage.rules only let the owner delete it.
			await import("../utils/backup/onlineBackup")
				.then(({ deleteOnlineBackup }) => deleteOnlineBackup(deletedUid))
				.catch((e) => console.warn("Online backup cleanup failed:", e));

			// Delete Firebase Auth user so they are completely removed from Auth and logged out
			await deleteUser(user);

			if (Capacitor.isNativePlatform()) {
				await firebaseSignOut(defaultAuth).catch(() => {});
				await FirebaseAuthentication.signOut().catch((e) =>
					console.warn("Native sign out error on delete:", e),
				);
			}

			setUser(null);
			setProfile(null);
			setProfileLoaded(false);
			// Drop this account's device-local profile keys. Without this they leak
			// forever — including a full unsaved draft of a deleted account.
			try {
				localStorage.removeItem(`onboarding_dismissed_${deletedUid}`);
				localStorage.removeItem(`profile_draft_${deletedUid}`);
				localStorage.removeItem(`cpbs_linked_family_v1_${deletedUid}`);
				localStorage.removeItem(linkedFamilyCacheKey(deletedUid));
			} catch {
				/* localStorage unavailable — nothing to clean */
			}
			showToast("Account deleted successfully", "success");
			return true;
		} catch (error: any) {
			console.error("Delete account error:", error);
			if (error.code === "auth/requires-recent-login") {
				showToast(
					"Please sign out and sign in again to verify your identity before deleting your account.",
					"warning",
				);
			} else {
				showToast("Failed to delete account. Please contact support.", "error");
			}
			return false;
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				profile,
				loading,
				profileLoaded,
				signInWithGoogle,
				sendOtp,
				verifyOtp,
				linkGoogleAccount,
				sendLinkOtp,
				verifyAndLinkOtp,
				resolveAccountMerge,
				signOut,
				updateProfile,
				deleteAccount,
				sendFamilyLinkRequest,
				pendingFamilyRequests,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

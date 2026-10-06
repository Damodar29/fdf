import {
	collection,
	deleteDoc,
	deleteField,
	doc,
	FieldPath,
	getDoc,
	onSnapshot,
	query,
	updateDoc,
	where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
	AlertTriangle,
	ArrowLeft,
	Camera,
	CheckCircle,
	CheckCircle2,
	ChevronDown,
	Crop,
	Edit2,
	Eye,
	Image as ImageIcon,
	Info,
	Languages,
	Link2,
	Loader2,
	Network,
	Lock,
	Mail,
	MapPin,
	Phone,
	Plus,
	RefreshCw,
	Search,
	Sparkles,
	Trash2,
	User,
	Users,
	WifiOff,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	ConflictData,
	FamilyMember,
	UserProfile,
} from "../context/AuthContext";
import { hasStartedProfile, useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import {
	profileDb as db,
	profileStorage as storage,
} from "../services/firebase";
// Bug #16 / #17: shared utility modules
// import { compressImage } from '../src/utils/imageUtils';
import {
	deriveGuruSelection,
	GURU_OPTIONS,
	type GuruOptionId,
	resolveGuruName,
} from "../src/constants/guru";
import {
	getRelationLabel,
	normalizeRelation,
	relationGender,
	suggestInverseRelations,
} from "../src/constants/relations";
import { MANDAL_LIST } from "../src/types/mandal";
import {
	getFamilyMemberStatus,
	memberNeedsReview,
	mergeReviewState,
	withMemberStatus,
} from "../utils/familyApproval";
// Shared back-gesture latch: `history.back()` is async, so every pop in this file
// goes through it or a second gesture mid-traversal pops one entry too many.
import { afterHistorySettles, popHistory } from "../utils/historyPop";
// Bug #9 fix: every localStorage write in this file must go through safeLocalSet,
// because Android WebView throws QuotaExceededError at ~5 MB and an uncaught
// throw white-screens the app.
import {
	safeLocalGet,
	safeLocalRemove,
	safeLocalSet,
} from "../utils/safeLocalSet";

import { AdminStatusTimeline } from "./profile/AdminStatusTimeline";
import { FamilyMemberCard } from "./profile/FamilyMemberCard";
import { FamilyTreeView } from "./profile/FamilyTreeView";
import { relationSuggestionsFor } from "../utils/familyChains";
import { relationQuestions } from "../utils/relationQuestions";
import { RelationHelper } from "./profile/RelationHelper";
import { findLinkedTwin, repeatedHandAddedIds } from "../utils/familyDedupe";
import { sharedFamilyMembers } from "../utils/sharedFamily";
import { THUMB } from "../utils/imageThumb";
import {
	planLinkedFamily,
	readLinkedFamily,
	saveLinkedFamily,
	savedAgo,
} from "../utils/linkedFamilyCache";
import { CachedImage } from "./CachedImage";
import {
	NO_APP_REASONS,
	type NoAppReason,
} from "../src/constants/familyMemberReasons";
import { OnboardingWizard } from "./profile/OnboardingWizard";
import { PhotoCropper } from "./profile/PhotoCropper";
/* ── New Companion Components ── */
import { ProfileCompletionCard } from "./profile/ProfileCompletionCard";
import { ProfilePreviewModal } from "./profile/ProfilePreviewModal";
import { RelationPicker } from "./profile/RelationPicker";
import { SuccessAnimation } from "./profile/SuccessAnimation";
import { CustomDateInput } from "./ui/CustomDateInput";
import { summarizeFamily } from "../utils/familyChangeSummary";
import { rejectionAlerts } from "../utils/reviewAlerts";
import { ThumbImg } from "./ui/ThumbImg";

/* ─────────────────────────────────────────────
   Photos are cropped by the devotee in PhotoCropper before upload.
───────────────────────────────────────────── */
const withPhotoVersion = (url: string) =>
	`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;

/* ─────────────────────────────────────────────
   Date format helpers
───────────────────────────────────────────── */
const toDateInputFormat = (dateStr: string) => {
	if (!dateStr) return "";
	if (dateStr.includes("/")) {
		const parts = dateStr.split("/");
		if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
	}
	if (dateStr.includes("-")) {
		const parts = dateStr.split("-");
		if (parts.length === 3 && parts[0].length === 2)
			return `${parts[2]}-${parts[1]}-${parts[0]}`;
	}
	return dateStr;
};
const fromDateInputFormat = (dateStr: string) => {
	if (!dateStr) return "";
	const parts = dateStr.split("-");
	if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
	return dateStr;
};

/* ─────────────────────────────────────────────
   Spiritual Master Options — imported from shared constants
   See: src/constants/guru.ts
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export const ProfileScreen: React.FC<{ onClose: () => void }> = ({
	onClose,
}) => {
	const {
		user,
		profile,
		loading,
		profileLoaded,
		signInWithGoogle,
		linkGoogleAccount,
		sendLinkOtp,
		verifyAndLinkOtp,
		resolveAccountMerge,
		signOut,
		updateProfile,
		deleteAccount,
		sendOtp,
		verifyOtp,
		sendFamilyLinkRequest,
	} = useAuth();
	const { settingsLanguage } = useSettings();
	const { showToast } = useToast();

	/* ── UI State ── */
	const [isSaving, setIsSaving] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [showPhotoOptions, setShowPhotoOptions] = useState(false);
	const [showMandalSelector, setShowMandalSelector] = useState(false);
	const [showGuruSelector, setShowGuruSelector] = useState(false);
	const [showFamilyMemberModal, setShowFamilyMemberModal] = useState(false);
	const [showFamilyGuruSelector, setShowFamilyGuruSelector] = useState(false);
	const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(
		null,
	);
	const [memberForm, setMemberForm] = useState<{
		realName: string;
		dikshaName: string;
		guruSelection: GuruOptionId | "";
		guruNameCustom: string;
		dikshaDate: string;
		isAspiring: boolean;
		photoURL: string;
		relation: string;
		noAppReason: NoAppReason | "";
	}>({
		realName: "",
		dikshaName: "",
		guruSelection: "",
		guruNameCustom: "",
		dikshaDate: "",
		isAspiring: false,
		photoURL: "",
		relation: "",
		noAppReason: "",
	});
	// Adding opens on "who is this?" first: someone with the app on their own
	// phone should be linked, not added by hand.
	const [memberAddStep, setMemberAddStep] = useState<"choose" | "form">(
		"form",
	);
	// "Link instead" closes this popup first; the link sheet opens once its
	// history entry is gone (two popups swapping in one tick fight over history).
	const linkAfterMemberModalRef = useRef(false);
	const [memberPhotoPreview, setMemberPhotoPreview] = useState<string | null>(
		null,
	);
	const [isMemberUploading, setIsMemberUploading] = useState(false);
	// Photo waiting in the cropper. `revoke`: an object URL we must release.
	const [cropRequest, setCropRequest] = useState<{
		src: string;
		target: "profile" | "member";
		revoke?: boolean;
	} | null>(null);

	// Account Linking state
	const [showLinkPhoneModal, setShowLinkPhoneModal] = useState(false);
	const [linkPhone, setLinkPhone] = useState("+91");
	const [linkOtpCode, setLinkOtpCode] = useState("");
	const [linkOtpSent, setLinkOtpSent] = useState(false);
	const [linkLoading, setLinkLoading] = useState(false);
	const [conflictData, setConflictData] = useState<ConflictData | null>(null);
	const [mergeKeep, setMergeKeep] = useState<
		Record<string, "current" | "other">
	>({});

	// Linked Family Members
	const [pendingLinkRequests, setPendingLinkRequests] = useState<any[]>([]);
	const [linkedMembersData, setLinkedMembersData] = useState<any[]>([]);
	const [isRespondingToRequest, setIsRespondingToRequest] = useState<
		string | null
	>(null);

	// Send Link Request state
	const [showSendLinkModal, setShowSendLinkModal] = useState(false);
	const [sendLinkPhone, setSendLinkPhone] = useState("+91");
	// Find the other devotee by phone number or by their Google login email.
	const [sendLinkBy, setSendLinkBy] = useState<"phone" | "email">("phone");
	const [sendLinkEmail, setSendLinkEmail] = useState("");
	const sendLinkReady =
		sendLinkBy === "email"
			? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendLinkEmail.trim())
			: sendLinkPhone.length >= 13;
	const [sendLinkRelation, setSendLinkRelation] = useState("");
	const [sendLinkLoading, setSendLinkLoading] = useState(false);
	// Linked member whose relation is being edited (null = sheet closed)
	const [relationEditTarget, setRelationEditTarget] = useState<{
		uid: string;
		name: string;
	} | null>(null);
	const [relationEditValue, setRelationEditValue] = useState("");
	const [relationSaving, setRelationSaving] = useState(false);
	// Incoming request being accepted (the sheet asks for our side's relation).
	const [acceptTarget, setAcceptTarget] = useState<any | null>(null);
	const [acceptRelation, setAcceptRelation] = useState("");
	// "Complete relations" helper (components/profile/RelationHelper.tsx).
	const [showRelationHelper, setShowRelationHelper] = useState(false);
	// Just accepted a link: open the helper once that person shows up.
	const helperAfterAcceptRef = useRef<string | null>(null);
	const [showFamilyTree, setShowFamilyTree] = useState(false);
	const [genderSaving, setGenderSaving] = useState(false);
	// "Find on the app" for a hand-added family member.
	const [findTarget, setFindTarget] = useState<FamilyMember | null>(null);
	const [findResults, setFindResults] = useState<any[] | null>(null);
	const [findSendingId, setFindSendingId] = useState<string | null>(null);
	const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
	const [sentLinkRequests, setSentLinkRequests] = useState<any[]>([]);

	// Fetch incoming link requests real-time
	useEffect(() => {
		if (!user) return;
		const q = query(
			collection(db, "familyLinkRequests"),
			where("toUserId", "==", user.uid),
			where("status", "==", "pending"),
		);
		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const reqs: any[] = [];
				snapshot.forEach((d) => reqs.push({ id: d.id, ...d.data() }));
				setPendingLinkRequests(reqs);
			},
			(err) => {
				console.error("Failed to listen to link requests", err);
			},
		);
		return () => unsubscribe();
	}, [user]);
	// Fetch SENT link requests real-time
	useEffect(() => {
		if (!user) return;
		const qSent = query(
			collection(db, "familyLinkRequests"),
			where("fromUserId", "==", user.uid),
		);
		const unsubSent = onSnapshot(
			qSent,
			(snapshot) => {
				const reqs: any[] = [];
				snapshot.forEach((d) => reqs.push({ id: d.id, ...d.data() }));
				setSentLinkRequests(reqs);
			},
			(err) => {
				console.error("Failed to listen to sent link requests", err);
			},
		);
		return () => unsubSent();
	}, [user]);

	// Linked members' details. A copy is kept on the device: it shows at once,
	// works offline, and the server is asked again only when that copy is old
	// or someone new was linked (saves a function call per profile visit).
	const myUid = user?.uid;
	const linkedIdsKey = (profile?.linkedFamilyMembers || []).join(",");
	// "loading" = nothing to show yet, "refreshing" = showing the saved copy
	// while fetching, "offline" = fetch not possible/failed, saved copy shown.
	const [linkedStatus, setLinkedStatus] = useState<
		"idle" | "loading" | "refreshing" | "offline"
	>("idle");
	const [linkedSavedAt, setLinkedSavedAt] = useState<number | null>(null);
	const [linkedRetryTick, setLinkedRetryTick] = useState(0);
	const linkedForceRef = useRef(false);
	const retryLinkedMembers = useCallback(() => {
		linkedForceRef.current = true;
		setLinkedRetryTick((t) => t + 1);
	}, []);
	// Back online after a failed/skipped fetch → try again by itself.
	useEffect(() => {
		if (linkedStatus !== "offline") return;
		const onOnline = () => setLinkedRetryTick((t) => t + 1);
		window.addEventListener("online", onOnline);
		return () => window.removeEventListener("online", onOnline);
	}, [linkedStatus]);
	useEffect(() => {
		let cancelled = false;
		const ids = linkedIdsKey ? linkedIdsKey.split(",") : [];
		const fetchLinkedMembers = async () => {
			if (!myUid || ids.length === 0) {
				setLinkedMembersData([]);
				setLinkedStatus("idle");
				return;
			}
			const saved = readLinkedFamily(myUid);
			const plan = planLinkedFamily(saved, ids);
			const force = linkedForceRef.current;
			linkedForceRef.current = false;
			if (saved) {
				setLinkedMembersData(plan.members);
				setLinkedSavedAt(saved.at);
			} else {
				setLinkedMembersData([]);
				setLinkedSavedAt(null);
			}
			if (!plan.needsFetch && !force) {
				setLinkedStatus("idle");
				return;
			}
			if (typeof navigator !== "undefined" && navigator.onLine === false) {
				setLinkedStatus("offline");
				return;
			}
			const hasShown = plan.members.length > 0;
			setLinkedStatus(hasShown ? "refreshing" : "loading");
			const done = (members: any[]) => {
				if (cancelled) return;
				setLinkedMembersData(members);
				saveLinkedFamily(myUid, ids, members);
				setLinkedSavedAt(Date.now());
				setLinkedStatus("idle");
			};
			// Through the server, which returns everything the family list needs
			// except the phone number: linked devotees may no longer read each
			// other's whole profile document.
			try {
				const { httpsCallable } = await import("firebase/functions");
				const { profileFunctions } = await import("../services/firebase");
				// Slow internet: give up after 20 s (default is 70 s) and keep
				// showing the saved copy with a retry button.
				const res = await httpsCallable<unknown, { members: any[] }>(
					profileFunctions,
					"getLinkedFamilyProfiles",
					{ timeout: 20_000 },
				)();
				done(Array.isArray(res.data?.members) ? res.data.members : []);
				return;
			} catch (err) {
				// Server function not reachable (e.g. not deployed yet) — fall back
				// to reading the profiles directly while the old rules allow it.
				console.warn("[Family] getLinkedFamilyProfiles failed", err);
			}
			if (cancelled) return;
			if (typeof navigator !== "undefined" && navigator.onLine === false) {
				setLinkedStatus("offline");
				return;
			}
			try {
				// Fetched in parallel — family groups merge on linking, so this list
				// can be several people long.
				let failedReads = 0;
				const fetched = await Promise.all(
					ids.map(async (uid) => {
						try {
							const docSnap = await getDoc(doc(db, "users", uid));
							if (!docSnap.exists()) return null;
							const d = docSnap.data();
							// A deleted or merged account is no longer a real family member.
							if (d.isDeleted === true || d.mergedIntoUid) return null;
							return {
								id: uid,
								realName: d.realName || "",
								dikshaName: d.dikshaName || "",
								guruName: d.guruName || "",
								dikshaDate: d.dikshaDate || "",
								photoURL: d.photoURL || "",
								isAspiring: d.isAspiring || false,
								personalExperience: d.personalExperience || "",
								gender:
									d.gender === "male" || d.gender === "female" ? d.gender : "",
								// How THEY described us — drives the suggested relation.
								theirRelationForMe:
									(myUid && d.linkedFamilyRelations?.[myUid]) || "",
								// …and the rest of our linked family (chain suggestions).
								familyRelations: Object.fromEntries(
									Object.entries(d.linkedFamilyRelations || {}).filter(
										([k, v]) =>
											k !== myUid &&
											typeof v === "string" &&
											ids.includes(k),
									),
								),
								reviewStatus: d.isApproved
									? "approved"
									: d.rejectionNote
										? "rejected"
										: "pending",
								rejectionNote: d.isApproved ? "" : d.rejectionNote || "",
								// Same as the server's handAddedForFamily: no phone,
								// no member an admin rejected.
								handAdded: (Array.isArray(d.familyMembers)
									? d.familyMembers
									: []
								)
									.filter(
										(m: any) =>
											m?.id &&
											(m.realName || m.dikshaName) &&
											m.approvalStatus !== "rejected",
									)
									.map((m: any) => ({
										id: m.id,
										realName: m.realName || "",
										dikshaName: m.dikshaName || "",
										guruName: m.guruName || "",
										dikshaDate: m.dikshaDate || "",
										isAspiring: m.isAspiring === true,
										photoURL: m.photoURL || "",
										relation: m.relation || "",
									})),
							};
						} catch (innerErr) {
							console.error(`Failed to fetch linked member ${uid}`, innerErr);
							failedReads++;
							return null;
						}
					}),
				);
				const found = fetched.filter((m) => m !== null);
				// Every read failed (offline, rules) — keep the saved copy instead
				// of replacing the family with an empty list.
				if (failedReads > 0 && found.length === 0) {
					if (!cancelled) setLinkedStatus("offline");
					return;
				}
				done(found);
			} catch (err) {
				console.error("Failed to process linked members", err);
				if (!cancelled) setLinkedStatus("offline");
			}
		};
		fetchLinkedMembers();
		return () => {
			cancelled = true;
		};
	}, [linkedIdsKey, myUid, linkedRetryTick]);

	// Phone Login state
	const [showPhoneLoginModal, setShowPhoneLoginModal] = useState(false);
	const [loginPhone, setLoginPhone] = useState("+91");
	const [loginOtpCode, setLoginOtpCode] = useState("");
	const [loginOtpSent, setLoginOtpSent] = useState(false);
	const [loginOtpLoading, setLoginOtpLoading] = useState(false);
	const [loginOtpTimer, setLoginOtpTimer] = useState(0);
	const loginOtpVerificationInFlightRef = useRef(false);
	const linkOtpVerificationInFlightRef = useRef(false);

	// ═══ NEW STATE ═══
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [showSaveSuccess, setShowSaveSuccess] = useState(false);
	const [showPreviewModal, setShowPreviewModal] = useState(false);
	const [otpResendTimer, setOtpResendTimer] = useState(0);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});
	const [submitAttempted, setSubmitAttempted] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
	const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
	const [langOverride, setLangOverride] = useState<"hi" | "en" | null>(null);

	// Language: override takes priority, else use settings
	const isHindiBase = settingsLanguage === "hi";
	const isHindiEffective =
		langOverride !== null ? langOverride === "hi" : isHindiBase;
	// Replace all usages of isHindi with isHindiEffective below, but keep `isHindi` as alias for convenience
	const isHindi = isHindiEffective;

	const fileInputRef = useRef<HTMLInputElement>(null);
	const cameraInputRef = useRef<HTMLInputElement>(null);
	const memberFileInputRef = useRef<HTMLInputElement>(null);
	const familySectionRef = useRef<HTMLDivElement>(null);
	const loadedRef = useRef(false); // Bug #5 fix: moved before first use (onboarding useEffect ~line 382)
	// uid that loadedRef/formData/photoPreview currently belong to. The screen stays
	// mounted across sign-out (it renders the not-logged-in view), and it hosts both
	// a Logout and a Google sign-in button, so a full account switch can happen
	// inside one mount. Without this, account A's form data stayed in state and the
	// auto-save wrote it into account B's Firestore document.
	const loadedForUidRef = useRef<string | null>(null);
	// Serialized snapshot of formData exactly as it was hydrated. The auto-save
	// compares against this so an untouched form never writes anything — that is
	// what used to create a phantom users/{uid} document after 15 idle seconds.
	const baselineFormRef = useRef<string | null>(null);
	// True once the form has been hydrated from a real Firestore document, so a
	// document that arrives late (slow snapshot, or an offline cache miss that
	// resolves once connectivity returns) can still replace a draft-only
	// hydration exactly once.
	const hydratedFromProfileRef = useRef(false);
	// Ensures the onboarding-wizard decision is made at most once per uid.
	const onboardingDecidedForUidRef = useRef<string | null>(null);
	// uid whose "onboarding seen" flag has already been written, so the X button,
	// the hardware back button and a wizard completion can never queue duplicate
	// Firestore writes for the same decision.
	const onboardingSeenWrittenRef = useRef<string | null>(null);
	// Installed by OnboardingWizard. Returns true if it consumed a back press
	// (closed one of its bottom sheets, or stepped back), false if the press
	// should close the wizard entirely.
	const onboardingBackRef = useRef<(() => boolean) | null>(null);
	// Set while we ourselves are popping the wizard's history entry, so the
	// popstate handler does not mistake our own close for a user back press and
	// route it into the wizard.
	const onboardingClosingRef = useRef(false);
	// True while the wizard's history entry is on the stack and still ours to
	// take back. Without it, a close path could pop an entry that a back press
	// had already consumed — one dead back press, then App.tsx tears down the
	// whole ProfileScreen.
	const onboardingEntryRef = useRef(false);
	// One shared history entry for the four full-screen overlays that had none.
	const overlayEntryRef = useRef(false);
	const overlaySelfClosingRef = useRef(false);

	/* ── Back-gesture bookkeeping for every history entry this screen owns ──
	   `history.pushState` is synchronous but `history.back()` is not: until the
	   browser dispatches `popstate`, `window.history.state` still names the entry
	   we are trying to leave. Every close path here decides what to pop by reading
	   that state, so a second gesture inside that window (a double-tapped X, or an
	   X tap followed by a hardware back press) used to read the same stale state,
	   conclude the same popup was still on top, and queue a *second* traversal.
	   The first pop closed the popup; the second popped the `profile` entry itself,
	   App.tsx unmounted the whole ProfileScreen, and the devotee landed on Home
	   with unsaved edits gone.

	   `poppingRef` holds the views whose traversal we have asked for but not yet
	   seen land, newest last. Every pop this file performs goes through
	   `popOwnEntry`, so the queue length always equals the number of outstanding
	   traversals and one `shift()` per popstate keeps the two in step. (A popstate
	   from some other screen's raw `history.back()` shifts one of ours early, which
	   only relaxes the guard to the old behaviour for a few milliseconds — and no
	   other screen can be popping while this full-screen one is on top.)
	*/
	const poppingRef = useRef<string[]>([]);
	useEffect(() => {
		const release = () => {
			poppingRef.current.shift();
		};
		window.addEventListener("popstate", release);
		return () => window.removeEventListener("popstate", release);
	}, []);

	/** Give one of our history entries back, and remember it is on its way out. */
	const popOwnEntry = useCallback((view: string) => {
		poppingRef.current.push(view);
		popHistory();
	}, []);

	/* ── Form State ── */
	const createEmptyForm = () => ({
		realName: "",
		dikshaName: "",
		guruSelection: "" as GuruOptionId | "",
		guruNameCustom: "",
		dikshaDate: "",
		mandalId: "",
		isCustomMandal: false,
		phoneNumber: "+91",
		personalExperience: "",
		familyMembers: [] as FamilyMember[],
	});
	const [formData, setFormData] = useState(createEmptyForm);

	/**
	 * Hydrate the form and record the baseline in one step, so the auto-save can
	 * tell "the user changed something" apart from "we pre-filled the form".
	 * (Google sign-ups get realName pre-filled from displayName, so a plain
	 * "is any field non-empty?" check would have been useless here.)
	 */
	const applyHydratedForm = (next: ReturnType<typeof createEmptyForm>) => {
		baselineFormRef.current = JSON.stringify(next);
		setFormData(next);
	};

	/**
	 * Takes back the wizard's history entry, if it is still ours to take.
	 * Declared before the reset effect below, which needs it when an account
	 * switch closes the wizard out from under the user.
	 */
	const popOnboardingEntry = useCallback(() => {
		if (!onboardingEntryRef.current) return;
		onboardingEntryRef.current = false;
		if (window.history.state?.view === "profile-onboarding") {
			onboardingClosingRef.current = true;
			popOwnEntry("profile-onboarding");
		}
	}, [popOwnEntry]);

	/* ── Reset all per-user form state when the signed-in uid changes ── */
	// biome-ignore lint/correctness/useExhaustiveDependencies: createEmptyForm is recreated every render; as deps they re-ran this hook on every render (render loop / flicker)
	useEffect(() => {
		const uid = user?.uid ?? null;
		if (loadedForUidRef.current === uid) return;
		loadedForUidRef.current = uid;
		loadedRef.current = false;
		hydratedFromProfileRef.current = false;
		baselineFormRef.current = null;
		setFormData(createEmptyForm());
		setPhotoPreview(null);
		setDraftSavedAt(null);
		setLastSavedAt(null);
		setFormErrors({});
		setSubmitAttempted(false);
		// The wizard belonged to the previous account. Close it *and* give back
		// its history entry, or the next back press does nothing at all.
		popOnboardingEntry();
		setShowOnboarding(false);
	}, [user?.uid, popOnboardingEntry]);

	/**
	 * Records that this user has now seen the welcome wizard — on the device
	 * (instant, works offline) *and* on the server, so a new phone or a reinstall
	 * does not show it again (bug #8).
	 *
	 * Writing `onboardingSeenAt` creates a minimal `users/{uid}` document for a
	 * user who has none. That is intentional: it is the only way to remember the
	 * dismissal across devices. The created doc carries `submittedForReview:
	 * false`, so it stays out of the admin review queue.
	 *
	 * Idempotent per uid, because the X button, the hardware back button and a
	 * wizard completion can all reach this in quick succession.
	 */
	const markOnboardingSeen = useCallback(
		(uid: string) => {
			if (onboardingSeenWrittenRef.current === uid) return;
			onboardingSeenWrittenRef.current = uid;
			// Bug #9 fix: safeLocalSet, not localStorage.setItem. The raw call threw
			// QuotaExceededError *after* the wizard had already closed, so the flag
			// was never written and the wizard came straight back.
			safeLocalSet(`onboarding_dismissed_${uid}`, "1");
			// Fire-and-forget. updateProfile swallows its own errors; if it fails
			// (offline) the device-local flag above still suppresses the wizard.
			void updateProfile({ onboardingSeenAt: Date.now() });
		},
		[updateProfile],
	);

	/** Closes the wizard for good. Assumes its history entry is already gone. */
	const dismissOnboarding = useCallback(() => {
		setShowOnboarding(false);
		if (user) markOnboardingSeen(user.uid);
	}, [user, markOnboardingSeen]);

	/**
	 * The wizard's X button. Pops our own history entry (so the next back press
	 * doesn't land on a stale one) and closes. Note this must NOT be routed
	 * through the wizard's back handler — X means "close", not "go back a step".
	 */
	const handleOnboardingDismiss = useCallback(() => {
		popOnboardingEntry();
		dismissOnboarding();
	}, [dismissOnboarding, popOnboardingEntry]);

	/* ── Back-button support for popups ── */
	useEffect(() => {
		if (showDeleteConfirm)
			window.history.pushState(
				{ isPopup: true, view: "profile-delete-confirm" },
				"",
			);
	}, [showDeleteConfirm]);

	useEffect(() => {
		if (showPhotoOptions)
			window.history.pushState(
				{ isPopup: true, view: "profile-photo-options" },
				"",
			);
	}, [showPhotoOptions]);

	useEffect(() => {
		if (showGuruSelector)
			window.history.pushState(
				{ isPopup: true, view: "profile-guru-selector" },
				"",
			);
	}, [showGuruSelector]);

	useEffect(() => {
		if (showMandalSelector)
			window.history.pushState(
				{ isPopup: true, view: "profile-mandal-selector" },
				"",
			);
	}, [showMandalSelector]);

	useEffect(() => {
		if (showFamilyMemberModal)
			window.history.pushState(
				{ isPopup: true, view: "profile-family-modal" },
				"",
			);
	}, [showFamilyMemberModal]);

	useEffect(() => {
		if (showFamilyGuruSelector)
			window.history.pushState(
				{ isPopup: true, view: "profile-family-guru-selector" },
				"",
			);
	}, [showFamilyGuruSelector]);

	/* ── Back-button support for the onboarding wizard ──
	   Bug #1 fix. The wizard is a full-screen overlay but owned no history entry,
	   so Android back popped the *profile* entry instead: App.tsx then unmounted
	   ProfileScreen wholesale, `onDismiss` never ran, the "seen" flag was never
	   written, and the wizard reappeared on every single open.

	   "profile-onboarding" is deliberately NOT in App.tsx's allow-list, so
	   App.tsx's own popstate handler ignores it and leaves this file in charge.
	*/
	useEffect(() => {
		if (showOnboarding && !onboardingEntryRef.current) {
			onboardingEntryRef.current = true;
			onboardingClosingRef.current = false;
			window.history.pushState(
				{ isPopup: true, view: "profile-onboarding" },
				"",
			);
		}
	}, [showOnboarding]);

	/* ── Back-button support for the four remaining full-screen overlays ──
	   Send-link, link-phone, the merge-conflict sheet and the profile preview had
	   no history entry at all, so back closed the entire ProfileScreen from
	   underneath them.

	   They share ONE entry rather than owning one each, on purpose. They are
	   mutually exclusive, and one of them hands over to another in the same commit
	   (link-phone closes while the merge-conflict sheet opens, ~:3800/:3840). With
	   an entry each, that hand-over would fire an async `history.back()` and a
	   synchronous `pushState` in the same tick — the traversal then eats the entry
	   that was just pushed. A shared entry makes a hand-over a no-op: the count
	   never reaches zero, so history is never touched.
	*/
	const closeSendLinkModal = useCallback(() => setShowSendLinkModal(false), []);
	const closeLinkPhoneModal = useCallback(
		() => setShowLinkPhoneModal(false),
		[],
	);
	const closeConflictModal = useCallback(() => setConflictData(null), []);
	const closePreviewModal = useCallback(() => setShowPreviewModal(false), []);
	const closeRelationEditor = useCallback(
		() => setRelationEditTarget(null),
		[],
	);
	const closeAcceptSheet = useCallback(() => setAcceptTarget(null), []);
	const closeRelationHelper = useCallback(() => setShowRelationHelper(false), []);
	const closeFamilyTree = useCallback(() => setShowFamilyTree(false), []);
	const closeFindSheet = useCallback(() => {
		setFindTarget(null);
		setFindResults(null);
	}, []);

	const anyOverlayOpen =
		showSendLinkModal ||
		showLinkPhoneModal ||
		!!conflictData ||
		showPreviewModal ||
		!!relationEditTarget ||
		!!acceptTarget ||
		showFamilyTree ||
		!!findTarget ||
		showRelationHelper;

	// Refreshed after every render so the popstate listener (which only
	// re-subscribes when the overlays go open ↔ closed) always closes whichever
	// overlay is on screen right now.
	const closeOpenOverlaysRef = useRef<() => void>(() => {});
	useEffect(() => {
		closeOpenOverlaysRef.current = () => {
			if (showSendLinkModal) closeSendLinkModal();
			if (showLinkPhoneModal) closeLinkPhoneModal();
			if (conflictData) closeConflictModal();
			if (showPreviewModal) closePreviewModal();
			if (relationEditTarget) closeRelationEditor();
			if (acceptTarget) closeAcceptSheet();
			if (showFamilyTree) closeFamilyTree();
			if (findTarget) closeFindSheet();
			if (showRelationHelper) closeRelationHelper();
		};
	});

	useEffect(() => {
		if (anyOverlayOpen && !overlayEntryRef.current) {
			overlayEntryRef.current = true;
			// Must be cleared here, not only in the popstate handler: that handler
			// is unsubscribed in the very commit that closes the last overlay, so a
			// self-close leaves the flag set with nobody left to clear it — and the
			// next genuine back press would then be swallowed.
			overlaySelfClosingRef.current = false;
			window.history.pushState({ isPopup: true, view: "profile-overlay" }, "");
		} else if (!anyOverlayOpen && overlayEntryRef.current) {
			// Closed from app code (a button, or a success path) — take our entry
			// back so we don't leave a back press that does nothing.
			overlayEntryRef.current = false;
			if (window.history.state?.view === "profile-overlay") {
				overlaySelfClosingRef.current = true;
				popOwnEntry("profile-overlay");
			}
		}
	}, [anyOverlayOpen, popOwnEntry]);

	useEffect(() => {
		if (!anyOverlayOpen) return;
		const handler = (e: PopStateEvent) => {
			if (e.state?.view === "profile-overlay") return;
			if (overlaySelfClosingRef.current) {
				overlaySelfClosingRef.current = false;
				return;
			}
			// The user popped our entry, so don't pop it again on the way out.
			overlayEntryRef.current = false;
			closeOpenOverlaysRef.current();
		};
		window.addEventListener("popstate", handler);
		return () => window.removeEventListener("popstate", handler);
	}, [anyOverlayOpen]);

	useEffect(() => {
		const handler = (e: PopStateEvent) => {
			if (showDeleteConfirm && e.state?.view !== "profile-delete-confirm")
				setShowDeleteConfirm(false);
			if (showPhotoOptions && e.state?.view !== "profile-photo-options")
				setShowPhotoOptions(false);
			if (showGuruSelector && e.state?.view !== "profile-guru-selector")
				setShowGuruSelector(false);
			if (showMandalSelector && e.state?.view !== "profile-mandal-selector")
				setShowMandalSelector(false);
			if (showFamilyMemberModal && e.state?.view !== "profile-family-modal")
				setShowFamilyMemberModal(false);
			if (
				showFamilyGuruSelector &&
				e.state?.view !== "profile-family-guru-selector"
			)
				setShowFamilyGuruSelector(false);
			if (showOnboarding && e.state?.view !== "profile-onboarding") {
				if (onboardingClosingRef.current) {
					// We popped this entry ourselves (X button / completion).
					onboardingClosingRef.current = false;
				} else if (onboardingBackRef.current?.()) {
					// The wizard consumed the press — it closed one of its bottom
					// sheets or stepped back. Restore its history entry so the next
					// back press lands here again instead of tearing down the whole
					// ProfileScreen.
					window.history.pushState(
						{ isPopup: true, view: "profile-onboarding" },
						"",
					);
				} else {
					// Back on the first step = dismiss, same as the X button. The user
					// already popped our entry, so don't pop it a second time.
					onboardingEntryRef.current = false;
					dismissOnboarding();
				}
			}
		};
		window.addEventListener("popstate", handler);
		return () => window.removeEventListener("popstate", handler);
	}, [
		showDeleteConfirm,
		showPhotoOptions,
		showGuruSelector,
		showMandalSelector,
		showFamilyMemberModal,
		showFamilyGuruSelector,
		showOnboarding,
		dismissOnboarding,
	]);

	/* ── The one safe way to close a popup that owns a history entry ──
	   Each of these popups closes by giving its history entry back, so that open
	   state and the history stack always agree. `poppingRef` (declared above with
	   the full explanation) is what keeps a second close inside the traversal
	   window from popping the `profile` entry along with it.

	   The guard is per popup, not global: the family-member modal can have the
	   family guru selector stacked on top of it, and closing both in one gesture is
	   legitimate — each owns an entry, so each needs its own pop. What must never
	   happen is the *same* popup asking twice.
	*/
	const closePopup = useCallback(
		(view: string, close: () => void) => {
			// Already on its way out — a second ask would cost us the `profile` entry.
			if (poppingRef.current.includes(view)) return;
			// `history.state` names our entry, or it still names a sibling popup whose
			// traversal hasn't landed yet — in which case ours is the entry directly
			// underneath, so one more pop removes exactly ours.
			if (
				window.history.state?.view === view ||
				poppingRef.current.length > 0
			) {
				popOwnEntry(view);
				return;
			}
			// No entry of ours on top (e.g. it was already popped by a back press),
			// so close directly instead of walking history.
			close();
		},
		[popOwnEntry],
	);

	const handleCloseDeleteConfirm = () => {
		closePopup("profile-delete-confirm", () => setShowDeleteConfirm(false));
	};

	const handleClosePhotoOptions = () => {
		closePopup("profile-photo-options", () => setShowPhotoOptions(false));
	};

	const handleCloseGuruSelector = () => {
		closePopup("profile-guru-selector", () => setShowGuruSelector(false));
	};

	const handleCloseMandalSelector = () => {
		closePopup("profile-mandal-selector", () => setShowMandalSelector(false));
	};

	const handleCloseFamilyMemberModal = () => {
		closePopup("profile-family-modal", () => setShowFamilyMemberModal(false));
	};

	const handleCloseFamilyGuruSelector = () => {
		closePopup("profile-family-guru-selector", () =>
			setShowFamilyGuruSelector(false),
		);
	};

	/* ═══ Onboarding Wizard Trigger ═══
	   Decides ONCE per account whether this is a genuinely new devotee.

	   Bug fixes baked in here:
	   • #6 — gates on `profileLoaded` (set only by a real Firestore snapshot,
	     never by AuthContext's 6-second safety timeout) instead of `!loading`.
	     A slow snapshot can no longer make a returning user look brand new.
	   • #8 — honours the server-side `profile.onboardingSeenAt` first, so a new
	     phone / reinstall / cleared app data no longer resurrects the wizard.
	   • #2 heal — a completely blank, never-submitted document (the artefact the
	     old 15-second auto-save used to mint) no longer suppresses the wizard
	     forever. Those users get it exactly once; `onboardingSeenAt` then closes
	     it for good.
	*/
	useEffect(() => {
		const uid = user?.uid;
		if (!uid) return;

		// Wait for a definitive answer from Firestore before judging newness.
		if (!profileLoaded) return;

		// One decision per account, per mount. This is what stops any later
		// profile write — including the wizard's own `onboardingSeenAt` — from
		// re-opening the wizard underneath the user.
		if (onboardingDecidedForUidRef.current === uid) return;
		onboardingDecidedForUidRef.current = uid;

		// Already seen: server flag first (survives reinstall), then the
		// device-local flag as the offline fallback.
		if (profile?.onboardingSeenAt) return;
		if (safeLocalGet(`onboarding_dismissed_${uid}`)) {
			// Dismissed on this device before the server-side flag existed. Promote
			// it now, so this devotee's *next* phone starts out already-seen too.
			markOnboardingSeen(uid);
			return;
		}

		// `realName` and `photoURL` are deliberately NOT part of this test:
		// AuthContext defaults realName to the Google display name, so even a
		// phantom document has one. `hasStartedProfile` is the single definition
		// of "has any real content", shared with the comment screens and the
		// admin review queue so they can never disagree about one document.
		const isBlankLegacyDoc = !!profile && !hasStartedProfile(profile);

		if (!profile || isBlankLegacyDoc) setShowOnboarding(true);
	}, [user?.uid, profile, profileLoaded, markOnboardingSeen]);

	const handleOnboardingComplete = useCallback(() => {
		// Pop the wizard's history entry too, otherwise the next back press would
		// be silently swallowed by a stale entry.
		popOnboardingEntry();
		setShowOnboarding(false);
		if (user) markOnboardingSeen(user.uid);
		// Bug #24 fix: Onboarding wizard collects data into formData but does NOT auto-save.
		// Show a clear prompt so the user knows to tap Save to persist their profile.
		showToast(
			settingsLanguage === "hi"
				? "✅ जानकारी भरी गई! अब 'सेव करें' बटन दबाएं"
				: "✅ Details filled! Now tap the Save button to submit",
			"success",
		);
	}, [
		user,
		markOnboardingSeen,
		popOnboardingEntry,
		settingsLanguage,
		showToast,
	]);

	/* ═══ NEW: OTP Resend Countdown ═══ */
	// Bug #15 fix: use a ref-based interval so the effect only starts/stops,
	// not re-triggers on every tick (avoids missed restart when value goes 0 → 60).
	const otpResendTimerRef = useRef(otpResendTimer);
	useEffect(() => {
		otpResendTimerRef.current = otpResendTimer;
	}, [otpResendTimer]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (otpResendTimer <= 0) return;
		const timer = setInterval(() => {
			if (otpResendTimerRef.current <= 1) {
				clearInterval(timer);
				setOtpResendTimer(0);
			} else {
				setOtpResendTimer((prev) => prev - 1);
			}
		}, 1000);
		return () => clearInterval(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [otpResendTimer > 0]);

	/* Phone Login OTP countdown */
	const loginOtpTimerRef = useRef(loginOtpTimer);
	useEffect(() => {
		loginOtpTimerRef.current = loginOtpTimer;
	}, [loginOtpTimer]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (loginOtpTimer <= 0) return;
		const timer = setInterval(() => {
			if (loginOtpTimerRef.current <= 1) {
				clearInterval(timer);
				setLoginOtpTimer(0);
			} else {
				setLoginOtpTimer((prev) => prev - 1);
			}
		}, 1000);
		return () => clearInterval(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loginOtpTimer > 0]);

	/* ── Back button closes Phone Login modal ── */
	const closePhoneLoginModal = useCallback(() => {
		// Same shape (and the same double-tap latch) as the six selector modals
		// above: pop our own entry and let the popstate listener flip the state, so
		// open and closed always agree with the history stack.
		closePopup("profile-phone-login", () => setShowPhoneLoginModal(false));
	}, [closePopup]);

	useEffect(() => {
		if (!showPhoneLoginModal) return;
		// `isPopup` and `view` are load-bearing, not decoration. App.tsx's
		// closeTopmostView only routes a back press into history when the top entry
		// is a popup, and its popstate handler unmounts ProfileScreen for any view
		// that isn't "profile" — so the old bare `{ modal: "phoneLogin" }` meant
		// back closed the entire profile screen instead of this modal.
		window.history.pushState(
			{ isPopup: true, view: "profile-phone-login", modal: "phoneLogin" },
			"",
		);
		const handlePop = () => setShowPhoneLoginModal(false);
		window.addEventListener("popstate", handlePop);
		return () => window.removeEventListener("popstate", handlePop);
	}, [showPhoneLoginModal]);

	/* ═══ NEW: Form Validation (real-time on blur / submit attempt) ═══ */
	const validateForm = useCallback((): Record<string, string> => {
		const errors: Record<string, string> = {};
		if (!formData.realName.trim())
			errors.realName = isHindi ? "नाम आवश्यक है" : "Name is required";
		if (!formData.mandalId.trim())
			errors.mandalId = isHindi ? "मंडल आवश्यक है" : "Mandal is required";
		if (
			formData.phoneNumber === "+91" ||
			formData.phoneNumber.length < 13 ||
			!/^\+91[6-9]\d{9}$/.test(formData.phoneNumber)
		)
			errors.phoneNumber = isHindi
				? "सही फोन नंबर दर्ज करें"
				: "Enter a valid phone number";
		if (!formData.guruSelection)
			errors.guruSelection = isHindi ? "गुरु / स्थिति चुनें" : "Select Guru / Status";
		if (formData.guruSelection === "other" && !formData.guruNameCustom.trim())
			errors.guruNameCustom = isHindi ? "गुरु का नाम दर्ज करें" : "Enter Guru name";
		if (
			formData.guruSelection &&
			formData.guruSelection !== "aspiring" &&
			!formData.dikshaDate
		)
			errors.dikshaDate = isHindi ? "दीक्षा तिथि दर्ज करें" : "Enter Diksha date";
		return errors;
	}, [formData, isHindi]);

	const handleFieldBlur = useCallback(
		(fieldName: string) => {
			if (!submitAttempted) return;
			const errors = validateForm();
			setFormErrors((prev) => {
				const next = { ...prev };
				if (errors[fieldName]) next[fieldName] = errors[fieldName];
				else delete next[fieldName];
				return next;
			});
		},
		[submitAttempted, validateForm],
	);

	/* ═══ NEW: Family Member Reorder ═══ */
	const handleMoveUp = useCallback((idx: number) => {
		if (idx <= 0) return;
		setFormData((prev) => {
			const updated = [...prev.familyMembers];
			[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
			return { ...prev, familyMembers: updated };
		});
	}, []);

	const handleMoveDown = useCallback((idx: number) => {
		setFormData((prev) => {
			if (idx >= prev.familyMembers.length - 1) return prev;
			const updated = [...prev.familyMembers];
			[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
			return { ...prev, familyMembers: updated };
		});
	}, []);

	/* ═══ NEW: Family duplicate detection ═══ */
	const checkDuplicateMember = useCallback(
		(name: string, editIdx: number | null): boolean => {
			return formData.familyMembers.some(
				(m, i) =>
					i !== editIdx &&
					m.realName.trim().toLowerCase() === name.trim().toLowerCase(),
			);
		},
		[formData.familyMembers],
	);

	/* ═══ NEW: Phone masking helper ═══ */
	const maskPhone = (phone: string): string => {
		if (!phone || phone.length < 10) return phone;
		const digits = phone.replace(/\D/g, "");
		if (digits.length >= 12) {
			return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} XXXXX`;
		}
		return `${phone.slice(0, phone.length - 5)} XXXXX`;
	};

	/* ═══ NEW: Memoized display names for preview ═══ */
	const guruDisplayName = useMemo(
		() => resolveGuruName(formData.guruSelection, formData.guruNameCustom),
		[formData.guruSelection, formData.guruNameCustom],
	);
	const mandalDisplayName = useMemo(() => {
		if (!formData.mandalId) return "";
		const found = MANDAL_LIST.find((m) => m.id === formData.mandalId);
		return found
			? isHindi
				? found.shortNameHi
				: found.shortNameEn
			: formData.mandalId;
	}, [formData.mandalId, isHindi]);

	const openAddMember = () => {
		setEditingMemberIndex(null);
		setMemberForm({
			realName: "",
			dikshaName: "",
			guruSelection: "",
			guruNameCustom: "",
			dikshaDate: "",
			isAspiring: true,
			photoURL: "",
			relation: "",
			noAppReason: "",
		});
		setMemberAddStep("choose");
		setMemberPhotoPreview(null);
		setShowFamilyMemberModal(true);
	};

	const openEditMember = (idx: number) => {
		const m = formData.familyMembers[idx];
		const { selection, custom } = deriveGuruSelection(m.guruName || "");
		setEditingMemberIndex(idx);
		setMemberForm({
			realName: m.realName,
			dikshaName: m.dikshaName,
			guruSelection: selection,
			guruNameCustom: custom,
			dikshaDate: m.dikshaDate,
			isAspiring: m.isAspiring,
			photoURL: m.photoURL || "",
			relation: m.relation || "",
			noAppReason: m.noAppReason || "",
		});
		setMemberAddStep("form");
		setMemberPhotoPreview(m.photoURL || null);
		setShowFamilyMemberModal(true);
	};

	useEffect(() => {
		if (showFamilyMemberModal || !linkAfterMemberModalRef.current) return;
		linkAfterMemberModalRef.current = false;
		setSendLinkPhone("+91");
		setSendLinkEmail("");
		setSendLinkRelation("");
		setShowSendLinkModal(true);
	}, [showFamilyMemberModal]);

	/* ═══ NEW: Family Link Handlers ═══ */
	const handleRespondToRequest = async (
		requestId: string,
		accept: boolean,
		relation = "",
	): Promise<boolean> => {
		setIsRespondingToRequest(requestId);
		try {
			const { httpsCallable } = await import("firebase/functions");
			// profileFunctions targets the same project as `functions`, but sends the
			// devotee's profileAuth login. Through `functions` (the main app, where
			// devotees are not signed in) every call arrived unauthenticated and was
			// rejected — which is why linking never worked.
			const { profileFunctions } = await import("../services/firebase");
			const respondFn = httpsCallable(
				profileFunctions,
				"respondToFamilyLinkRequest",
			);
			const result = await respondFn({
				requestId,
				accept,
				relation: normalizeRelation(relation),
			});
			if ((result.data as { success?: boolean })?.success === false) {
				// The sender's account was deleted; the server closed the request.
				showToast(
					isHindi
						? "यह खाता अब मौजूद नहीं है, अनुरोध बंद कर दिया गया"
						: "That account no longer exists — the request was closed",
					"info",
				);
				return false;
			}
			showToast(
				isHindi
					? accept
						? "लिंक स्वीकार कर लिया गया — अब उनका रिश्ता भी चुन सकते हैं"
						: "लिंक अस्वीकार कर दिया गया"
					: accept
						? "Link accepted — you can now set how you're related"
						: "Link request rejected",
				"success",
			);
			return true;

			// Note: If accepted, AuthContext listener will naturally update profile.linkedFamilyMembers,
			// which in turn will trigger the useEffect to fetch linked members.
		} catch (e: any) {
			console.error(e);
			showToast(e.message || "Failed to respond to request", "error");
			return false;
		} finally {
			setIsRespondingToRequest(null);
		}
	};

	const handleUnlinkFamilyMember = async (linkedUserId: string) => {
		if (
			!confirm(
				isHindi
					? "क्या आप इस लिंक्ड अकाउंट को हटाना चाहते हैं?"
					: "Do you want to unlink this account?",
			)
		)
			return;
		setIsUnlinking(linkedUserId);
		try {
			const { httpsCallable } = await import("firebase/functions");
			const { profileFunctions } = await import("../services/firebase");
			const unlinkFn = httpsCallable(profileFunctions, "unlinkFamilyMember");
			await unlinkFn({ targetUserId: linkedUserId });

			showToast(
				isHindi ? "लिंक्ड अकाउंट हटा दिया गया" : "Linked account removed",
				"success",
			);
		} catch (e: any) {
			console.error(e);
			showToast(e.message || "Failed to unlink account", "error");
		} finally {
			setIsUnlinking(null);
		}
	};

	const openRelationEditor = (uid: string, name: string) => {
		setRelationEditValue(profile?.linkedFamilyRelations?.[uid] || "");
		setRelationEditTarget({ uid, name });
	};

	// Saved at once, like relation labels — it is not reviewable profile
	// content. The syncFamilyLinkGroups function uses it to fill relations.
	const saveGender = async (value: "male" | "female") => {
		if (!user || profile?.gender === value) return;
		setGenderSaving(true);
		try {
			await updateDoc(doc(db, "users", user.uid), { gender: value });
		} catch (e) {
			console.error("Gender save failed", e);
			showToast(isHindi ? "सहेजा नहीं जा सका" : "Could not save", "error");
		} finally {
			setGenderSaving(false);
		}
	};

	// A hand-added member may have their own account: look for it by name,
	// diksha date and guru (searchDevoteesForFamilyLink).
	const openFindOnApp = async (idx: number) => {
		const member = formData.familyMembers[idx];
		if (!member) return;
		setFindTarget(member);
		setFindResults(null);
		try {
			const { httpsCallable } = await import("firebase/functions");
			const { profileFunctions } = await import("../services/firebase");
			const res = await httpsCallable<unknown, { results: any[] }>(
				profileFunctions,
				"searchDevoteesForFamilyLink",
			)({
				realName: member.realName,
				dikshaName: member.dikshaName || "",
				dikshaDate: member.dikshaDate,
				guruName: member.guruName,
			});
			setFindResults(Array.isArray(res.data?.results) ? res.data.results : []);
		} catch (e) {
			console.error("Find on app failed", e);
			setFindResults([]);
			showToast(
				isHindi
					? "खोज नहीं हो सकी। इंटरनेट जाँचें और दोबारा कोशिश करें।"
					: "Search failed. Check the internet and try again.",
				"error",
			);
		}
	};

	// A hand-added member who is also a linked account — added twice
	// (utils/familyDedupe.ts decides, carefully).
	const linkedTwinName = (m: FamilyMember): string | undefined => {
		const twin = findLinkedTwin(
			m,
			linkedMembersData,
			profile?.linkedFamilyRelations,
		);
		return twin ? twin.realName || twin.dikshaName : undefined;
	};
	// Hand-added members entered twice in the same list.
	const repeatedMemberIds = repeatedHandAddedIds(formData.familyMembers);
	// People my linked relatives added by hand — shown to me too, read-only.
	const sharedPeople = sharedFamilyMembers(linkedMembersData, {
		realName: formData.realName,
		dikshaName: formData.dikshaName,
		dikshaDate: formData.dikshaDate,
		handAdded: formData.familyMembers,
		relations: profile?.linkedFamilyRelations,
	});

	// Linked members I have not given a relation yet (the helper's questions).
	const openRelationQuestions = useMemo(
		() =>
			relationQuestions(
				linkedMembersData,
				profile?.linkedFamilyRelations,
				profile?.linkedFamilyVia,
			),
		[linkedMembersData, profile?.linkedFamilyRelations, profile?.linkedFamilyVia],
	);
	// Right after accepting a link: once the new relative has loaded, ask about
	// them (and anyone else the link brought in) — the moment it makes sense.
	useEffect(() => {
		const uid = helperAfterAcceptRef.current;
		if (!uid || linkedStatus !== "idle") return;
		if (!linkedMembersData.some((m) => m.id === uid)) return;
		helperAfterAcceptRef.current = null;
		if (openRelationQuestions.length > 0) setShowRelationHelper(true);
	}, [linkedMembersData, linkedStatus, openRelationQuestions.length]);

	/** My relations for several linked members at once (the helper). */
	const saveMyRelations = async (
		values: Record<string, string>,
	): Promise<boolean> => {
		if (!user) return false;
		const pairs: unknown[] = [];
		for (const [uid, rel] of Object.entries(values)) {
			const value = normalizeRelation(rel);
			if (!value) continue;
			pairs.push(
				new FieldPath("linkedFamilyRelations", uid),
				value,
				// Their own choice, so the automatic fill-in leaves it alone.
				new FieldPath("linkedFamilyRelationsAuto", uid),
				deleteField(),
			);
		}
		if (pairs.length === 0) return true;
		try {
			await updateDoc(
				doc(db, "users", user.uid),
				...(pairs as [FieldPath, unknown, ...unknown[]]),
			);
			return true;
		} catch (e) {
			console.error("Failed to save relations", e);
			showToast(
				isHindi
					? "सहेजा नहीं जा सका — इंटरनेट देखकर दोबारा कोशिश करें"
					: "Could not save — check the internet and try again",
				"error",
			);
			return false;
		}
	};

	const sendLinkToFound = async (targetUid: string) => {
		if (!findTarget) return;
		setFindSendingId(targetUid);
		const result = await sendFamilyLinkRequest(
			"",
			normalizeRelation(findTarget.relation),
			targetUid,
		);
		setFindSendingId(null);
		if (result.success) {
			closeFindSheet();
			showToast(
				isHindi
					? "अनुरोध भेज दिया गया ✅ उनके स्वीकार करते ही खाते जुड़ जाएँगे।"
					: "Request sent ✅ The accounts link once they accept.",
				"success",
			);
		} else {
			showToast(
				result.error || (isHindi ? "त्रुटि हुई" : "Error occurred"),
				"error",
			);
		}
	};

	const handleSaveLinkedRelation = async () => {
		if (!user || !relationEditTarget) return;
		const value = normalizeRelation(relationEditValue);
		setRelationSaving(true);
		try {
			// Straight to the devotee's own document rather than through
			// updateProfile: a relation label is not reviewable profile content, and
			// it must not wait for the main Save button.
			await updateDoc(
				doc(db, "users", user.uid),
				new FieldPath("linkedFamilyRelations", relationEditTarget.uid),
				value || deleteField(),
				// Their own choice now, so the automatic fill-in leaves it alone.
				new FieldPath("linkedFamilyRelationsAuto", relationEditTarget.uid),
				deleteField(),
			);
			closeRelationEditor();
			showToast(isHindi ? "रिश्ता सहेजा गया ✅" : "Relation saved ✅", "success");
		} catch (e) {
			console.error("Failed to save relation", e);
			showToast(
				isHindi ? "रिश्ता सहेजा नहीं जा सका" : "Could not save the relation",
				"error",
			);
		} finally {
			setRelationSaving(false);
		}
	};

	const handleSaveMember = () => {
		if (editingMemberIndex === null && !memberForm.noAppReason) {
			showToast(
				isHindi
					? "कृपया बताएँ कि ये ख़ुद प्रोफ़ाइल क्यों नहीं बना सकते"
					: "Please say why they can't make their own profile",
				"warning",
			);
			return;
		}
		if (!memberForm.realName.trim()) {
			showToast(isHindi ? "नाम आवश्यक है" : "Name is required", "warning");
			return;
		}
		// ═══ NEW: Duplicate detection ═══
		if (checkDuplicateMember(memberForm.realName, editingMemberIndex)) {
			showToast(
				isHindi
					? "⚠️ इस नाम का सदस्य पहले से है"
					: "⚠️ A member with this name already exists",
				"warning",
			);
			return;
		}
		if (!memberForm.guruSelection) {
			showToast(
				isHindi
					? "कृपया दीक्षा गुरु / स्थिति चुनें"
					: "Please select Diksha Guru / Status",
				"warning",
			);
			return;
		}
		const isAsp = memberForm.guruSelection === "aspiring";
		if (!isAsp && !memberForm.dikshaDate) {
			showToast(
				isHindi ? "कृपया दीक्षा की तिथि दर्ज करें" : "Please enter Diksha date",
				"warning",
			);
			return;
		}
		const guruName = resolveGuruName(
			memberForm.guruSelection,
			memberForm.guruNameCustom,
		);
		const newMember: FamilyMember = {
			id:
				editingMemberIndex !== null
					? formData.familyMembers[editingMemberIndex].id
					: Date.now().toString(),
			realName: memberForm.realName.trim(),
			dikshaName: memberForm.dikshaName.trim(),
			guruName,
			dikshaDate: isAsp ? "" : memberForm.dikshaDate,
			isAspiring: isAsp,
			...(normalizeRelation(memberForm.relation)
				? { relation: normalizeRelation(memberForm.relation) }
				: {}),
			...(memberForm.noAppReason
				? { noAppReason: memberForm.noAppReason }
				: {}),
			photoURL:
				memberPhotoPreview ||
				// Bug #25 fix: preserve existing photo when editing a member.
				// If no new photo selected (memberPhotoPreview is null), keep the
				// previously saved photoURL — including any admin-uploaded photo.
				(editingMemberIndex !== null
					? formData.familyMembers[editingMemberIndex]?.photoURL || ""
					: ""),
		};
		// A new member, or a change to anything the admin reviews, goes back for
		// review; otherwise (e.g. only the relation changed) the admin's decision
		// stands. See utils/familyApproval.ts.
		const before =
			editingMemberIndex !== null
				? formData.familyMembers[editingMemberIndex]
				: undefined;
		const reviewed: FamilyMember = memberNeedsReview(before, newMember)
			? withMemberStatus(newMember, "pending")
			: {
					...newMember,
					...(before?.approvalStatus
						? { approvalStatus: before.approvalStatus }
						: {}),
					...(before?.rejectionNote
						? { rejectionNote: before.rejectionNote }
						: {}),
					...(before?.approvalDate
						? { approvalDate: before.approvalDate }
						: {}),
				};
		setFormData((prev) => {
			const updated = [...prev.familyMembers];
			if (editingMemberIndex !== null) {
				updated[editingMemberIndex] = reviewed;
			} else {
				updated.push(reviewed);
			}
			return { ...prev, familyMembers: updated };
		});
		handleCloseFamilyMemberModal();
	};

	const handleDeleteMember = (idx: number) => {
		const name = formData.familyMembers[idx]?.realName || "";
		if (
			!confirm(
				isHindi
					? `क्या आप ${name ? `"${name}" को ` : "इस सदस्य को "}हटाना चाहते हैं?`
					: `Remove ${name ? `"${name}"` : "this member"} from your family list?`,
			)
		)
			return;
		setFormData((prev) => ({
			...prev,
			familyMembers: prev.familyMembers.filter((_, i) => i !== idx),
		}));
	};

	/* ── Load profile into form ── */
	// loadedRef is declared above with other refs (Bug #5 fix)
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		// Wait for the profile subscription to settle. `loading` also goes false on
		// AuthContext's 6-second safety net, so a real profile can still arrive
		// after we have hydrated — see the re-hydration branch below.
		if (loading || !user) return;
		if (loadedRef.current) {
			// Already hydrated. Only one situation justifies doing it again: we
			// hydrated with no document (from the draft, or from nothing) and the
			// real document has now turned up. Before this, `loadedRef` blocked that
			// forever and the devotee was left staring at a blank form.
			if (!profile || hydratedFromProfileRef.current) return;
		}

		/**
		 * Values to fall back on for fields the profile leaves empty. On a first
		 * hydration that is the saved draft; on a re-hydration it is whatever is on
		 * screen right now, so anything typed in the meantime survives.
		 */
		type DraftFallback = Record<string, any> & { _savedAt?: number };
		const readFallback = (): DraftFallback | null => {
			if (loadedRef.current) return { ...formData };
			try {
				const draftStr = localStorage.getItem(`profile_draft_${user.uid}`);
				if (!draftStr) return null;
				const parsed = JSON.parse(draftStr);
				return parsed && typeof parsed === "object" ? parsed : null;
			} catch {
				return null;
			}
		};

		if (profile) {
			const { selection, custom } = deriveGuruSelection(profile.guruName || "");
			const storedMandalValue =
				profile.mandalId === "custom"
					? profile.customMandalName || ""
					: profile.mandalId || "";
			const isStoredCustomMandal =
				!!storedMandalValue &&
				!MANDAL_LIST.some((m) => m.id === storedMandalValue);
			const next = {
				realName: profile.realName || "",
				dikshaName: profile.dikshaName || "",
				guruSelection: selection,
				guruNameCustom: custom,
				dikshaDate: profile.dikshaDate || "",
				mandalId: storedMandalValue,
				isCustomMandal: isStoredCustomMandal,
				phoneNumber:
					profile.phoneNumber && profile.phoneNumber !== "+91"
						? profile.phoneNumber
						: user?.phoneNumber || "+91",
				personalExperience: profile.personalExperience || "",
				familyMembers: profile.familyMembers || [],
			};

			// Anything the devotee ends up seeing that is NOT in this document counts
			// as unsaved, so the baseline the auto-save diffs against is the
			// document-derived form — never the merged result. Otherwise a document
			// arriving mid-sentence made the words already on screen look "already
			// saved", and the auto-save stopped pushing them.
			const documentOnly = JSON.stringify(next);

			// Bug #7 fix: the draft used to be readable only when no document
			// existed, so as soon as one appeared — including the phantom docs the
			// old auto-save created — everything the user had typed was stranded in
			// localStorage forever.
			//
			// Two different situations share this step, and they need different
			// precedence:
			//  • First hydration — the fallback is a saved draft from an earlier
			//    visit. The document is the fresher of the two, so it wins and the
			//    draft only fills the gaps it leaves.
			//  • Late re-hydration — the fallback is what is on screen right now.
			//    Only the fields the devotee has actually touched since hydration win
			//    outright (they may be mid-sentence); the rest of what is on screen is
			//    just the earlier draft, so the document still wins there.
			// A stale draft must never resurface inside a submitted or approved
			// profile in either situation, so gap-filling is switched off for those.
			const isLiveForm = loadedRef.current;
			const allowGapFill = !(profile.submittedForReview || profile.isApproved);
			const fallback = isLiveForm || allowGapFill ? readFallback() : null;
			if (fallback) {
				let recovered = false;
				const baseline: Record<string, any> | null = (() => {
					if (!isLiveForm || !baselineFormRef.current) return null;
					try {
						return JSON.parse(baselineFormRef.current);
					} catch {
						return null;
					}
				})();
				// "Has the devotee touched this field since the form was hydrated?"
				// A live form with no readable baseline means we cannot tell, so assume
				// yes: losing what someone typed is far worse than showing a slightly
				// stale document.
				const isEdited = (key: keyof typeof next) =>
					isLiveForm &&
					(!baseline ||
						JSON.stringify(fallback[key as string]) !==
							JSON.stringify(baseline[key as string]));
				// "+91" is the bare dial-code placeholder the form starts with, not a
				// phone number, so it counts as empty on both sides.
				const isPlaceholder = (key: keyof typeof next, value: unknown) =>
					!value || (key === "phoneNumber" && value === "+91");
				const takeString = (key: keyof typeof next) => {
					const incoming = fallback[key as string];
					if (typeof incoming !== "string") return;
					// Mid-edit: their own value wins, including a field they have just
					// deliberately cleared.
					if (isEdited(key)) {
						(next as any)[key] = incoming;
						return;
					}
					if (!allowGapFill) return;
					// Otherwise the document wins wherever it has a value, and the draft
					// only fills a gap it leaves behind.
					if (!incoming.trim() || isPlaceholder(key, incoming)) return;
					if (!isPlaceholder(key, next[key])) return;
					if (incoming === next[key]) return;
					(next as any)[key] = incoming;
					recovered = true;
				};
				takeString("realName");
				takeString("dikshaName");
				takeString("dikshaDate");
				// Recovering the phone number matters more than the rest: a document
				// created by the dismissal flag or the auto-save carries
				// `phoneNumber: ""`, and Save refuses to submit without a valid one.
				takeString("phoneNumber");
				takeString("personalExperience");
				// Guru is two coupled fields (selection + custom name), so they always
				// move together — as do mandal's display value and its "is custom" flag.
				if (isEdited("guruSelection") || isEdited("guruNameCustom")) {
					next.guruSelection = fallback.guruSelection || "";
					next.guruNameCustom = fallback.guruNameCustom || "";
				} else if (
					allowGapFill &&
					fallback.guruSelection &&
					!next.guruSelection
				) {
					next.guruSelection = fallback.guruSelection;
					next.guruNameCustom = fallback.guruNameCustom || "";
					recovered = true;
				}
				if (isEdited("mandalId") || isEdited("isCustomMandal")) {
					next.mandalId = fallback.mandalId || "";
					next.isCustomMandal = !!fallback.isCustomMandal;
				} else if (allowGapFill && fallback.mandalId && !next.mandalId) {
					next.mandalId = fallback.mandalId;
					next.isCustomMandal = !!fallback.isCustomMandal;
					recovered = true;
				}
				if (isEdited("familyMembers")) {
					next.familyMembers = Array.isArray(fallback.familyMembers)
						? fallback.familyMembers
						: [];
				} else if (
					allowGapFill &&
					Array.isArray(fallback.familyMembers) &&
					fallback.familyMembers.length > 0 &&
					next.familyMembers.length === 0
				) {
					next.familyMembers = fallback.familyMembers;
					recovered = true;
				}
				if (recovered && fallback._savedAt) setDraftSavedAt(fallback._savedAt);
			}

			baselineFormRef.current = documentOnly;
			setFormData(next);
			if (profile.photoURL) setPhotoPreview(profile.photoURL);
			hydratedFromProfileRef.current = true;
			loadedRef.current = true;
		} else {
			const draft = readFallback();
			const { _savedAt, ...rest } = draft ?? {};
			const next = {
				...createEmptyForm(),
				...(draft ? rest : {}),
				realName: (draft?.realName as string) || user.displayName || "",
				phoneNumber:
					draft?.phoneNumber && draft.phoneNumber !== "+91"
						? draft.phoneNumber
						: user.phoneNumber || "+91",
			} as ReturnType<typeof createEmptyForm>;
			// The draft is parsed JSON: it can be half-written (a quota failure
			// mid-write) or hand-edited. `rest` is spread in wholesale above, so
			// re-assert the two shapes the renderer would crash on.
			if (!Array.isArray(next.familyMembers)) next.familyMembers = [];
			next.isCustomMandal = !!next.isCustomMandal;
			applyHydratedForm(next);
			if (draft) setDraftSavedAt(_savedAt || Date.now());
			loadedRef.current = true;
		}
		// `formData` is read (via readFallback) but deliberately not a dependency:
		// this must not re-run while the user types.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [profile, user, loading]);

	/* ── Auto-save Draft (localStorage & Firestore) ── */
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps restored to the original (pre auto-fix) list — the auto-fix added per-render functions / dropped trigger deps
	useEffect(() => {
		if (!user || isSaving || !loadedRef.current) return;

		// Bug #2 fix: never write anything until the user has actually changed
		// something. `baselineFormRef` holds the form exactly as it was hydrated,
		// so simply opening the Profile screen and leaving it alone for 15 seconds
		// no longer mints a phantom users/{uid} document — which used to suppress
		// the welcome wizard for that account for good.
		// A plain "is any field filled in?" test would not have worked: Google
		// sign-ups arrive with realName already pre-filled from displayName.
		if (baselineFormRef.current === null) return;
		const serialized = JSON.stringify(formData);
		if (serialized === baselineFormRef.current) return;

		const timer = setTimeout(() => {
			try {
				const draft = {
					...formData,
					_savedAt: Date.now(),
				};
				const draftKey = `profile_draft_${user.uid}`;
				const draftPayload = JSON.stringify(draft);
				// Bug #9 fix: this rewrites the entire form (family members and the
				// personal-experience essay included) every 15 seconds, so it is the
				// most likely single cause of a full localStorage quota. It must not
				// be able to throw.
				const draftSaved = safeLocalSet(draftKey, draftPayload);
				if (draftSaved) setDraftSavedAt(Date.now());

				// `loading` is also released by AuthContext's 6-second safety net, so
				// `profile` can still be null here for a devotee who definitely has a
				// document — a new phone on a slow network, say. Writing in that state
				// took updateProfile's "create" branch: a fresh shortId, a reset
				// createdAt/submissionDate, empty strings over their diksha details and
				// `submittedForReview: false`, which silently pulled a waiting devotee
				// out of the admin review queue. `profileLoaded` is only true once a real
				// snapshot resolved, so it is the only safe licence to write. Nothing is
				// lost by waiting: the draft above is saved, and the profile arriving
				// re-runs this effect.
				if (!profileLoaded) return;

				// ONLY auto-save to Firestore if they haven't submitted yet!
				// If they have already submitted or are approved, we must wait for them
				// to click "Save" so that `hasPendingEdits` and history are recorded properly.
				if (!profile?.submittedForReview && !profile?.isApproved) {
					// Resolve guruName here too — formData only has guruSelection/guruNameCustom,
					// NOT the resolved guruName string. Without this, auto-save would create a
					// profile doc with guruName: """ even if the user already selected a guru.
					const autoSaveGuruName = resolveGuruName(
						formData.guruSelection,
						formData.guruNameCustom,
					);
					// Bug #26 fix: pass ONLY UserProfile-typed fields to updateProfile.
					// Previously `...formData` spread was leaking UI-only fields
					// (guruSelection, guruNameCustom, isCustomMandal) into Firestore.
					updateProfile({
						realName: formData.realName,
						dikshaName: formData.dikshaName,
						guruName: autoSaveGuruName,
						dikshaDate: formData.dikshaDate || null,
						mandalId: formData.isCustomMandal ? "custom" : formData.mandalId,
						customMandalName: formData.isCustomMandal ? formData.mandalId : "",
						phoneNumber:
							formData.phoneNumber === "+91" ? "" : formData.phoneNumber,
						personalExperience: formData.personalExperience,
						familyMembers: mergeReviewState(
							formData.familyMembers || [],
							profile?.familyMembers,
						),
						isApproved: false,
						submittedForReview: false,
					})
						.then((saved) => {
							// updateProfile reports a failed write by resolving false rather
							// than rejecting, so this has to be checked: if the write did not
							// land, the draft is the only copy left and must stay.
							if (!saved) return;
							/* The server has the form now, so the draft's one job — holding
							   work Firestore never received — is done. Dropping it is also
							   what stops a *stale* draft from gap-filling a value the
							   document has deliberately moved past: on a full quota
							   safeLocalSet leaves the PREVIOUS form in place, which is how a
							   family member the devotee had just deleted came back on the
							   next open.
							   Only the copy this write actually covers, though — a later
							   debounce may already have replaced it with newer text whose own
							   write is still in flight. */
							if (!draftSaved || safeLocalGet(draftKey) === draftPayload)
								safeLocalRemove(draftKey);
						})
						.catch((e) =>
							console.warn("Silent firestore draft save failed:", e),
						);
				}

				// This form state is now persisted, so it becomes the new baseline.
				// Otherwise every later profile snapshot (an FCM-token write is
				// enough) re-armed the debounce and produced another byte-identical
				// write of the same data.
				// Only if the draft actually landed, though: safeLocalSet swallows a
				// quota error, and re-baselining after a failed write would make the
				// devotee's next keystroke look like "no change" and quietly drop the
				// edit that filled the quota.
				if (draftSaved) baselineFormRef.current = serialized;
			} catch (e) {
				console.warn("Draft save failed:", e);
			}
		}, 15000); // 15s debounce — saves after 15s of inactivity

		return () => clearTimeout(timer);
		// Bug #5 fix: `profile` belongs in here. Without it the 15-second callback
		// closed over whatever `profile` was when the timer was armed, so a photo
		// upload that set `submittedForReview: true` could be silently undone by an
		// already-armed timer writing `submittedForReview: false` — quietly pulling
		// the devotee back out of the admin review queue.
	}, [formData, user, isSaving, profile, profileLoaded]);

	/* ── Field change handlers ── */
	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		if (name === "dikshaDate") {
			setFormData((prev) => ({ ...prev, [name]: fromDateInputFormat(value) }));
		} else if (name === "phoneNumber") {
			// Always keep +91 prefix
			const cleaned = value.startsWith("+91") ? value : "+91";
			// Only digits after +91, max 10 more chars
			const after91 = cleaned.slice(3).replace(/\D/g, "").slice(0, 10);
			setFormData((prev) => ({ ...prev, phoneNumber: `+91${after91}` }));
		} else {
			setFormData((prev) => ({ ...prev, [name]: value }));
		}
	};

	/* ── Photo Upload ── */
	// Every photo goes through the cropper first, so the devotee chooses what is
	// in the frame. (It used to be a blind centre square, which cut off heads in
	// tall photos.) Opened only once the closing menu's history pop has landed.
	const openCropper = (request: NonNullable<typeof cropRequest>) =>
		afterHistorySettles(() => setCropRequest(request));

	const closeCropper = () => {
		setCropRequest((current) => {
			if (current?.revoke) URL.revokeObjectURL(current.src);
			return null;
		});
	};

	const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		handleClosePhotoOptions();
		if (fileInputRef.current) fileInputRef.current.value = "";
		if (cameraInputRef.current) cameraInputRef.current.value = "";
		if (!file || !user) return;

		if (!file.type.startsWith("image/")) {
			showToast(
				isHindi ? "कृपया एक इमेज फ़ाइल चुनें" : "Please select an image file",
				"warning",
			);
			return;
		}
		openCropper({
			src: URL.createObjectURL(file),
			target: "profile",
			revoke: true,
		});
	};

	const handleAdjustPhoto = () => {
		const current = photoPreview || profile?.photoURL;
		handleClosePhotoOptions();
		if (current) openCropper({ src: current, target: "profile" });
	};

	const uploadProfilePhoto = async (compressed: Blob): Promise<boolean> => {
		if (!user) return false;
		setIsUploading(true);
		setUploadProgress(0);
		// Simulate progress
		const progressInterval = setInterval(() => {
			setUploadProgress((prev) =>
				prev < 85 ? prev + Math.random() * 15 : prev,
			);
		}, 300);
		try {
			const photoRef = ref(storage, `profile_photos/${user.uid}/profile.jpg`);
			await uploadBytes(photoRef, compressed, { contentType: "image/jpeg" });
			setUploadProgress(100);
			clearInterval(progressInterval);
			// Versioned so a re-cropped photo gets a new URL and no cached copy of
			// the old crop is shown anywhere (Storage ignores the extra parameter).
			const downloadURL = withPhotoVersion(await getDownloadURL(photoRef));

			const newHistory = profile?.editHistory ? [...profile.editHistory] : [];
			const changes = [
				{ field: "photoURL", old: profile?.photoURL || "", new: downloadURL },
			];
			newHistory.push({
				timestamp: Date.now(),
				changes,
				status: "pending",
			});

			// Uploading a photo counts as an edit that needs review — but only for a
			// profile the devotee has actually submitted before. Bug #3 fix: doing it
			// unconditionally pushed an otherwise-empty profile into the admin review
			// queue *and* switched off the draft auto-save (see the guard in the
			// auto-save effect), so everything they went on to type was lost.
			//
			// `!profile` is not the test — by the time the wizard reaches the photo
			// step a document may well exist, minted by the dismissal flag
			// (`onboardingSeenAt`) or by the auto-save. "Has this devotee ever
			// submitted?" is the question that actually matters.
			const isEstablishedProfile =
				!showOnboarding &&
				Boolean(profile?.submittedForReview || profile?.isApproved);
			await updateProfile({
				photoURL: downloadURL,
				submittedForReview: isEstablishedProfile,
				hasPendingEdits: isEstablishedProfile,
				editHistory: newHistory,
			});
			setPhotoPreview(downloadURL);
			showToast(
				isEstablishedProfile
					? isHindi
						? "फोटो अपलोड हो गई ✅ समीक्षा के लिए भेजी गई"
						: "Photo uploaded ✅ Sent for review"
					: isHindi
						? "फोटो अपलोड हो गई ✅"
						: "Photo uploaded ✅",
				"success",
			);
			return true;
		} catch (error) {
			console.error("Photo upload error:", error);
			showToast(isHindi ? "फोटो अपलोड विफल" : "Photo upload failed", "error");
			return false;
		} finally {
			clearInterval(progressInterval);
			setIsUploading(false);
		}
	};

	const handleRemovePhoto = async () => {
		handleClosePhotoOptions();
		if (!user || !profile?.photoURL) return;
		setIsUploading(true);
		try {
			const newHistory = profile?.editHistory ? [...profile.editHistory] : [];
			const changes = [
				{ field: "photoURL", old: profile?.photoURL || "", new: "" },
			];
			newHistory.push({
				timestamp: Date.now(),
				changes,
				status: "pending",
			});

			// Removing photo → also pull back from review queue
			await updateProfile({
				photoURL: "",
				submittedForReview: false,
				hasPendingEdits: true,
				editHistory: newHistory,
			});
			setPhotoPreview(null);
			showToast(isHindi ? "फोटो हटा दी गई" : "Photo removed", "success");
		} catch (_error) {
			showToast(
				isHindi ? "फोटो हटाने में विफल" : "Failed to remove photo",
				"error",
			);
		} finally {
			setIsUploading(false);
		}
	};

	/* ── Family Member Photo Upload ── */
	const handleMemberPhotoSelect = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0];
		if (memberFileInputRef.current) memberFileInputRef.current.value = "";
		if (!file || !user) return;
		if (!file.type.startsWith("image/")) {
			showToast(
				isHindi ? "कृपया एक इमेज फ़ाइल चुनें" : "Please select an image file",
				"warning",
			);
			return;
		}
		openCropper({
			src: URL.createObjectURL(file),
			target: "member",
			revoke: true,
		});
	};

	const uploadMemberPhoto = async (compressed: Blob): Promise<boolean> => {
		if (!user) return false;
		setIsMemberUploading(true);
		try {
			// Bug #6 fix: Use Date.now() for new members so concurrent uploads
			// don't overwrite each other. The final memberId (Date.now().toString())
			// in handleSaveMember matches this since both are time-based.
			const tempId = `temp_${Date.now()}`;
			const memberId =
				editingMemberIndex !== null
					? formData.familyMembers[editingMemberIndex].id
					: tempId;
			const photoRef = ref(
				storage,
				`profile_photos/${user.uid}/family_${memberId}.jpg`,
			);
			await uploadBytes(photoRef, compressed, { contentType: "image/jpeg" });
			// Versioned so a re-cropped photo gets a new URL and no cached copy of
			// the old crop is shown anywhere (Storage ignores the extra parameter).
			const downloadURL = withPhotoVersion(await getDownloadURL(photoRef));
			setMemberPhotoPreview(downloadURL);
			showToast(
				isHindi ? "फोटो अपलोड हो गई ✅" : "Photo uploaded ✅",
				"success",
			);
			return true;
		} catch (error) {
			console.error("Member photo upload error:", error);
			showToast(isHindi ? "फोटो अपलोड विफल" : "Photo upload failed", "error");
			return false;
		} finally {
			setIsMemberUploading(false);
		}
	};

	/* ── Save Profile ── */
	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitAttempted(true);

		// ═══ NEW: Use centralized validation with inline errors ═══
		const errors = validateForm();
		setFormErrors(errors);
		if (Object.keys(errors).length > 0) {
			const firstError = Object.values(errors)[0];
			showToast(firstError, "warning");
			return;
		}

		const isAspiring = formData.guruSelection === "aspiring";

		const guruName = resolveGuruName(
			formData.guruSelection,
			formData.guruNameCustom,
		);
		const hasPhoto = !!photoPreview;

		const wasRejected = !!profile?.rejectionNote;
		const wasResubmitted = profile?.resubmitted || false;
		const wasApproved = profile?.isApproved || false;

		// Detect changes if profile exists
		const changes: Array<{ field: string; old: string; new: string }> = [];
		if (profile) {
			if ((profile.realName || "").trim() !== formData.realName.trim())
				changes.push({
					field: "realName",
					old: profile.realName || "",
					new: formData.realName.trim(),
				});
			if ((profile.dikshaName || "") !== formData.dikshaName)
				changes.push({
					field: "dikshaName",
					old: profile.dikshaName || "",
					new: formData.dikshaName,
				});
			if ((profile.guruName || "") !== guruName)
				changes.push({
					field: "guruName",
					old: profile.guruName || "",
					new: guruName,
				});
			const newDikshaDate = isAspiring ? "" : formData.dikshaDate;
			if ((profile.dikshaDate || "") !== newDikshaDate)
				changes.push({
					field: "dikshaDate",
					old: profile.dikshaDate || "",
					new: newDikshaDate,
				});
			const finalMandalId = formData.isCustomMandal
				? "custom"
				: formData.mandalId.trim();
			if ((profile.mandalId || "") !== finalMandalId)
				changes.push({
					field: "mandalId",
					old: profile.mandalId || "",
					new: finalMandalId,
				});
			const finalCustomMandal = formData.isCustomMandal
				? formData.mandalId.trim()
				: "";
			if ((profile.customMandalName || "") !== finalCustomMandal)
				changes.push({
					field: "customMandalName",
					old: profile.customMandalName || "",
					new: finalCustomMandal,
				});
			const newPhone =
				formData.phoneNumber === "+91" ? "" : formData.phoneNumber;
			if ((profile.phoneNumber || "") !== newPhone)
				changes.push({
					field: "phoneNumber",
					old: profile.phoneNumber || "",
					new: newPhone,
				});
			if (!!profile.isAspiring !== isAspiring)
				changes.push({
					field: "isAspiring",
					old: profile.isAspiring ? "Yes" : "No",
					new: isAspiring ? "Yes" : "No",
				});
			if (
				(profile.personalExperience || "") !==
				(formData.personalExperience || "")
			)
				changes.push({
					field: "personalExperience",
					old: profile.personalExperience || "",
					new: formData.personalExperience || "",
				});
			// The family list as the admin will see it in the edit history: who
			// was added, removed or changed (it used to be just "..." → "...").
			const familyBefore = summarizeFamily(profile.familyMembers);
			const familyAfter = summarizeFamily(
				mergeReviewState(formData.familyMembers, profile.familyMembers),
			);
			if (familyBefore !== familyAfter) {
				changes.push({
					field: "familyMembers",
					old: familyBefore,
					new: familyAfter,
				});
			}
		}

		const newHistory = profile?.editHistory ? [...profile.editHistory] : [];
		let hasPendingEdits = profile?.hasPendingEdits || false;

		if (changes.length > 0) {
			newHistory.push({
				timestamp: Date.now(),
				changes,
				status: "pending",
			});
			hasPendingEdits = true;
		}

		setIsSaving(true);
		const success = await updateProfile({
			realName: formData.realName.trim(),
			dikshaName: formData.dikshaName,
			guruName,
			dikshaDate: isAspiring ? "" : formData.dikshaDate,
			mandalId: formData.isCustomMandal ? "custom" : formData.mandalId.trim(),
			customMandalName: formData.isCustomMandal ? formData.mandalId.trim() : "",
			phoneNumber: formData.phoneNumber === "+91" ? "" : formData.phoneNumber,
			personalExperience: formData.personalExperience,
			isAspiring,
			familyMembers: mergeReviewState(
				formData.familyMembers,
				profile?.familyMembers,
			),
			// Always mark submitted for review when user saves (photo is optional for submission)
			submittedForReview: true,
			// Only set to false if it was rejected or pending. If it was already approved, keep it approved!
			isApproved: !!wasApproved,
			rejectionNote: "",
			// Bug #13 fix: only update submissionDate when saving for the first time or when there are changes
			submissionDate:
				!profile || changes.length > 0
					? Date.now()
					: profile.submissionDate || Date.now(),
			resubmitted: wasRejected ? true : wasResubmitted,
			hasPendingEdits,
			editHistory: newHistory,
		});

		if (success) {
			if (wasApproved) {
				// Bug #19 fix: for already-approved profiles, the success animation provides
				// clear feedback. Only show toast for the admin-review case (changes pending),
				// not for no-change saves, to avoid double feedback.
				if (changes.length > 0) {
					showToast(
						isHindi
							? "प्रोफाइल अपडेट हो गई ✅ व्यवस्थापक बदलाव की समीक्षा करेंगे"
							: "Profile updated ✅ Admin will review changes",
						"success",
					);
				}
				// No toast for no-change saves — the success animation is enough
			} else {
				// Not yet approved: show informational toast (no animation shown here)
				showToast(
					hasPhoto
						? isHindi
							? "प्रोफाइल सुरक्षित किया गया और समीक्षा के लिए भेजा गया ✅"
							: "Profile saved and sent for review ✅"
						: isHindi
							? "प्रोफाइल सुरक्षित किया गया। स्वीकृति के लिए फोटो भी अपलोड करें 📸"
							: "Profile saved. Please upload photo for approval 📸",
					"success",
				);
			}
			// ═══ NEW: Success animation + clear draft + update lastSavedAt ═══
			setShowSaveSuccess(true);
			setLastSavedAt(Date.now());
			setFormErrors({});
			setSubmitAttempted(false);
			// Everything on screen is now the saved truth, so re-baseline: without
			// this the auto-save would consider the form "changed" and re-create the
			// draft file we are about to delete, 15 seconds from now.
			baselineFormRef.current = JSON.stringify(formData);
			try {
				if (user) localStorage.removeItem(`profile_draft_${user.uid}`);
			} catch {
				/* ignore */
			}
		}
		setIsSaving(false);
	};

	/* ── Delete Account ── */
	const handleDeleteAccount = async () => {
		setIsDeleting(true);
		const success = await deleteAccount();
		if (success) onClose();
		setIsDeleting(false);
		handleCloseDeleteConfirm();
	};

	const handleCancelLinkRequest = async (requestId: string) => {
		const wasPending =
			sentLinkRequests.find((r) => r.id === requestId)?.status === "pending";
		try {
			await deleteDoc(doc(db, "familyLinkRequests", requestId));
			// An answered request is just being cleared from the list.
			if (wasPending)
				showToast(
					isHindi ? "अनुरोध रद्द कर दिया गया" : "Request cancelled",
					"success",
				);
		} catch (err) {
			console.error("Cancel link request error:", err);
			showToast(
				isHindi ? "रद्द करने में त्रुटि" : "Error cancelling request",
				"error",
			);
		}
	};

	/* ── Progress ── */
	const isAspiringSelected = formData.guruSelection === "aspiring";
	// ═══ NEW: Allow editing approved profile ═══
	const [isEditingApproved, setIsEditingApproved] = useState(false);
	const isApprovedProfile =
		(profile?.isApproved || false) && !isEditingApproved;

	/* ─────────────── Render ─────────────── */

	if (loading) {
		return (
			<div className="fixed inset-0 z-[200] bg-ry-sand dark:bg-ink-900 flex items-center justify-center">
				<Loader2 className="animate-spin text-pink-500 w-10 h-10" />
			</div>
		);
	}

	return (
		<>
			<div className="fixed inset-0 z-[200] bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-bottom-full duration-300 font-sans">
				{/* ── Header ── */}
				<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-3 sticky top-0 z-10 shadow-sm">
					<button
						onClick={onClose}
						className="p-2 -ml-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>
					<h2 className="font-display text-xl font-semibold leading-none drop-shadow-md flex-1">
						{isHindi ? "भक्त प्रोफाइल" : "Devotee Profile"}
					</h2>
					{/* ═══ NEW: Language toggle in header ═══ */}
					{user && (
						<button
							onClick={() =>
								setLangOverride(
									langOverride === "hi"
										? "en"
										: langOverride === "en"
											? null
											: "hi",
								)
							}
							aria-label={isHindi ? "भाषा बदलें" : "Change language"}
							className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors text-xs font-bold border border-white/30"
						>
							<Languages size={14} />
							{langOverride === "hi"
								? "EN"
								: langOverride === "en"
									? "Auto"
									: "HI"}
						</button>
					)}
					{user && (
						<button
							onClick={signOut}
							className="text-xs font-bold text-red-500 bg-white px-3 py-1.5 rounded-full active:scale-95 transition"
						>
							{isHindi ? "लॉग आउट" : "Logout"}
						</button>
					)}
				</div>

				<div
					id="profile-scroll-container"
					className="flex-1 overflow-y-auto p-5 pb-[calc(4rem+env(safe-area-inset-bottom))]"
				>
					{/* ════════ NOT LOGGED IN ════════ */}
					{!user ? (
						<div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto text-center space-y-6">
							<div className="w-24 h-24 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center text-pink-500">
								<User size={48} />
							</div>
							<div>
								<h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
									{isHindi ? "आपका स्वागत है" : "Welcome"}
								</h3>
								<p className="text-slate-500 dark:text-slate-400 text-sm">
									{isHindi
										? "लाइक करने के लिए कृपया अपनी प्रोफाइल बनाएं।"
										: "Please create your profile to like."}
								</p>
							</div>
							<button
								onClick={signInWithGoogle}
								className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"
								data-tour="profile-login"
							>
								<svg className="w-5 h-5" viewBox="0 0 24 24">
									<path
										fill="#4285F4"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="#34A853"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="#FBBC05"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="#EA4335"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
								{isHindi ? "Google से लॉगिन करें" : "Login with Google"}
							</button>

							{/* Divider */}
							<div className="flex items-center gap-3">
								<div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
								<span className="text-xs text-slate-400 dark:text-ink-400 font-medium">
									{isHindi ? "या" : "OR"}
								</span>
								<div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
							</div>

							{/* Phone OTP Login */}
							<button
								onClick={() => {
									setLoginPhone("+91");
									setLoginOtpCode("");
									setLoginOtpSent(false);
									setLoginOtpTimer(0);
									setShowPhoneLoginModal(true);
								}}
								className="w-full bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/30 text-pink-700 dark:text-pink-300 font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
							>
								<Phone size={18} className="text-pink-500" />
								{isHindi ? "Phone OTP से लॉगिन करें" : "Login with Phone OTP"}
							</button>
						</div>
					) : (
						/* ════════ LOGGED IN ════════ */
						<div className="max-w-md mx-auto">
							{/* This login's profile was merged into the devotee's other account */}
							{profile?.mergedIntoUid && (
								<div className="mb-5 rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-2">
									<p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
										<Info size={16} className="shrink-0" />
										{isHindi
											? "आपकी दो प्रोफ़ाइल थीं — अब एक कर दी गई हैं"
											: "You had two profiles — they are now one"}
									</p>
									<p className="text-xs text-amber-900/80 dark:text-amber-100/80 leading-relaxed">
										{isHindi
											? "आपकी सारी जानकारी और परिवार अब आपके दूसरे खाते में है। उसे देखने के लिए लॉग आउट करके इससे लॉगिन करें:"
											: "All your details and family are now in your other account. Log out and sign in with:"}
									</p>
									<ul className="text-xs font-bold text-amber-900 dark:text-amber-100 space-y-0.5">
										{profile.mergedLoginHint?.google && (
											<li>Google: {profile.mergedLoginHint.google}</li>
										)}
										{profile.mergedLoginHint?.phone && (
											<li>
												{isHindi ? "फ़ोन" : "Phone"}: {profile.mergedLoginHint.phone}
											</li>
										)}
										{!profile.mergedLoginHint?.google &&
											!profile.mergedLoginHint?.phone && (
												<li>
													{isHindi
														? "अपने दूसरे लॉगिन (Google या फ़ोन) से"
														: "your other login (Google or phone)"}
												</li>
											)}
									</ul>
									<button
										type="button"
										onClick={signOut}
										className="w-full min-h-touch rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold active:scale-95 transition"
									>
										{isHindi ? "लॉग आउट करें" : "Log out"}
									</button>
								</div>
							)}
							{/* ── Photo Section ── */}
							<div className="flex flex-col items-center mb-6">
								<div
									className={`relative w-28 h-28 rounded-full overflow-hidden ${isApprovedProfile ? "" : "cursor-pointer"} group bg-rose-100 dark:bg-rose-900/30 border-4 border-white dark:border-slate-900 shadow-xl`}
									onClick={() =>
										!isApprovedProfile && setShowPhotoOptions(true)
									}
									data-tour="profile-photo"
								>
									{photoPreview ? (
										// Bug #23 fix: only show custom-uploaded photo, never Google account photo
										<ThumbImg
											src={photoPreview}
											thumbWidth={THUMB.tile}
											alt="Profile"
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center">
											<User size={40} className="text-rose-400" />
										</div>
									)}
									<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
										{isUploading ? (
											<Loader2 size={28} className="text-white animate-spin" />
										) : (
											<Camera size={28} className="text-white drop-shadow-md" />
										)}
									</div>
									<div className="absolute bottom-1 right-1 w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 z-10">
										<Camera size={16} className="text-white" />
									</div>
								</div>

								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handlePhotoSelect}
									className="hidden"
								/>
								<input
									ref={cameraInputRef}
									type="file"
									accept="image/*"
									capture="user"
									onChange={handlePhotoSelect}
									className="hidden"
								/>

								{/* ═══ NEW: Upload Progress Bar ═══ */}
								{isUploading && (
									<div className="w-full max-w-[220px] mt-3">
										<div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
											<div
												className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-300 ease-out"
												style={{ width: `${uploadProgress}%` }}
											/>
										</div>
										<p className="text-[10px] text-slate-400 dark:text-ink-400 text-center mt-1">
											{Math.round(uploadProgress)}%
										</p>
									</div>
								)}

								<button
									type="button"
									onClick={() => setShowPreviewModal(true)}
									data-tour="profile-preview"
									className="mt-3 inline-flex items-center gap-1.5 min-h-touch px-4 rounded-full text-xs font-bold text-pink-600 dark:text-pink-300 bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/30 active:scale-95 transition"
								>
									<Eye size={14} />
									{isHindi ? "प्रोफाइल का पूर्वावलोकन" : "Preview profile"}
								</button>
							</div>

							{/* Needs attention: family link requests to answer, hand-added
							    members the admin sent back, linked family whose own profile
							    was not approved. (The devotee's own review is just below.) */}
							{(() => {
								const memberAlerts = rejectionAlerts(profile).filter(
									(a) => a.kind === "member",
								);
								const linkedRejected = linkedMembersData.filter(
									(m) => m.reviewStatus === "rejected",
								);
								if (
									pendingLinkRequests.length === 0 &&
									memberAlerts.length === 0 &&
									linkedRejected.length === 0
								)
									return null;
								return (
									<div className="mb-5 space-y-2">
										{pendingLinkRequests.map((req) => (
											<div
												key={req.id}
												className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3"
											>
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 border-2 border-blue-300 dark:border-blue-600">
														{req.fromUserPhoto ? (
															<ThumbImg
																src={req.fromUserPhoto}
																alt=""
																className="w-full h-full object-cover"
															/>
														) : (
															<span className="w-full h-full flex items-center justify-center text-sm font-bold text-slate-500">
																{(req.fromUserName || "?").charAt(0).toUpperCase()}
															</span>
														)}
													</div>
													<p className="flex-1 min-w-0 text-[13px] leading-snug text-blue-900 dark:text-blue-100">
														<span className="block text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
															🔔 {isHindi ? "परिवार लिंक अनुरोध" : "Family link request"}
														</span>
														<b>{req.fromUserName || (isHindi ? "कोई भक्त" : "A devotee")}</b>
														{req.fromRelation
															? isHindi
																? ` आपको अपना "${getRelationLabel(req.fromRelation, true)}" बताकर जोड़ना चाहते हैं`
																: ` wants to add you as their ${getRelationLabel(req.fromRelation, false)}`
															: isHindi
																? " आपको परिवार में जोड़ना चाहते हैं"
																: " wants to link you as family"}
													</p>
												</div>
												<div className="flex gap-2 mt-2.5">
													<button
														type="button"
														disabled={isRespondingToRequest === req.id}
														onClick={() => {
															setAcceptRelation("");
															setAcceptTarget(req);
														}}
														className="flex-1 min-h-touch rounded-xl bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50"
													>
														{isRespondingToRequest === req.id ? (
															<Loader2 size={15} className="animate-spin" />
														) : (
															<CheckCircle size={15} />
														)}
														{isHindi ? "स्वीकार करें" : "Accept"}
													</button>
													<button
														type="button"
														disabled={isRespondingToRequest === req.id}
														onClick={() => handleRespondToRequest(req.id, false)}
														className="flex-1 min-h-touch rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50"
													>
														<X size={15} />
														{isHindi ? "मना करें" : "Decline"}
													</button>
												</div>
											</div>
										))}

										{(memberAlerts.length > 0 || linkedRejected.length > 0) && (
											<div className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-3">
												<p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">
													<AlertTriangle size={16} className="shrink-0" />
													{isHindi
														? "परिवार की प्रोफ़ाइल में सुधार ज़रूरी"
														: "Family profiles need changes"}
												</p>
												<ul className="space-y-2">
													{memberAlerts.map((a) => {
														const idx = formData.familyMembers.findIndex(
															(m) => m.id === a.memberId,
														);
														return (
															<li
																key={a.memberId}
																className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/40 rounded-xl p-2.5"
															>
																<p className="flex-1 min-w-0 text-[13px] leading-snug text-amber-900 dark:text-amber-100">
																	<b>{a.name || (isHindi ? "परिवार सदस्य" : "Family member")}</b>
																	<span className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
																		{isHindi ? " (आपके जोड़े हुए)" : " (added by you)"}
																	</span>
																	<span className="block mt-0.5">
																		{a.note
																			? `${isHindi ? "कारण" : "Reason"}: “${a.note}”`
																			: isHindi
																				? "स्वीकार नहीं हुए"
																				: "Not approved"}
																	</span>
																</p>
																{idx >= 0 && (
																	<button
																		type="button"
																		onClick={() => openEditMember(idx)}
																		className="shrink-0 min-h-[36px] px-3 rounded-lg bg-amber-500 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition"
																	>
																		<Edit2 size={12} />
																		{isHindi ? "ठीक करें" : "Fix"}
																	</button>
																)}
															</li>
														);
													})}
													{linkedRejected.map((m) => (
														<li
															key={m.id}
															className="bg-white/70 dark:bg-slate-900/40 rounded-xl p-2.5 text-[13px] leading-snug text-amber-900 dark:text-amber-100"
														>
															<b>{m.realName || m.dikshaName}</b>
															<span className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
																{isHindi ? " (ऐप पर जुड़े)" : " (linked on the app)"}
															</span>
															<span className="block mt-0.5">
																{m.rejectionNote
																	? `${isHindi ? "कारण" : "Reason"}: “${m.rejectionNote}”`
																	: isHindi
																		? "प्रोफ़ाइल स्वीकार नहीं हुई"
																		: "Profile not approved"}
															</span>
															<span className="block mt-1 text-[11px] text-amber-700/80 dark:text-amber-300/70">
																{isHindi
																	? "ये अपने फ़ोन से अपनी प्रोफ़ाइल ठीक करेंगे — उन्हें बता दें।"
																	: "They fix it from their own phone — let them know."}
															</span>
														</li>
													))}
												</ul>
											</div>
										)}
									</div>
								);
							})()}

							{/* Completion + review status: full cards while something is
							    left to do, one slim row each once it is done. */}
							<div className="flex flex-wrap gap-2 mb-5">
								<ProfileCompletionCard
									isHindi={isHindi}
									realName={formData.realName}
									dikshaName={formData.dikshaName}
									guruSelection={formData.guruSelection}
									dikshaDate={formData.dikshaDate}
									mandalId={formData.mandalId}
									photoPreview={photoPreview}
									phoneNumber={formData.phoneNumber}
									isAspiringSelected={isAspiringSelected}
									gender={profile?.gender}
								/>

								{/* ═══ NEW: Admin Status Timeline ═══ */}
								<AdminStatusTimeline
									isHindi={isHindi}
									isApproved={profile?.isApproved || false}
									submittedForReview={profile?.submittedForReview}
									rejectionNote={profile?.rejectionNote}
									submissionDate={profile?.submissionDate}
									approvalDate={profile?.approvalDate}
									resubmitted={profile?.resubmitted}
									hasPendingEdits={profile?.hasPendingEdits}
								/>
							</div>

							{/* ════ CONNECTED ACCOUNTS ════ */}
							{user &&
								(() => {
									const providers = user.providerData.map((p) => p.providerId);
									const hasGoogle = providers.includes("google.com");
									const hasPhone = providers.includes("phone");
									return (
										<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-5">
											<h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
												<Lock
													size={14}
													className="text-slate-400 dark:text-ink-400"
												/>
												{isHindi ? "जुड़े हुए खाते" : "Connected Accounts"}
											</h4>
											<div className="space-y-2.5">
												{/* Google row */}
												<div className="flex items-center justify-between gap-3">
													<div className="flex items-center gap-2.5">
														<div className="w-8 h-8 rounded-full bg-white dark:bg-ink-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
															<svg className="w-4 h-4" viewBox="0 0 24 24">
																<path
																	fill="#4285F4"
																	d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
																/>
																<path
																	fill="#34A853"
																	d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
																/>
																<path
																	fill="#FBBC05"
																	d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
																/>
																<path
																	fill="#EA4335"
																	d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
																/>
															</svg>
														</div>
														<div>
															<p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
																Google
															</p>
															{hasGoogle && user.email && (
																<p className="text-[10px] text-slate-400 dark:text-ink-400">
																	{user.email}
																</p>
															)}
														</div>
													</div>
													{hasGoogle ? (
														<span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full">
															<CheckCircle2 size={10} />{" "}
															{isHindi ? "जुड़ा है" : "Linked"}
														</span>
													) : (
														<button
															type="button"
															onClick={async () => {
																const result = await linkGoogleAccount();
																if (!result.success && result.conflict) {
																	const defaults: Record<
																		string,
																		"current" | "other"
																	> = {};
																	[
																		"realName",
																		"dikshaName",
																		"guruName",
																		"dikshaDate",
																		"mandalId",
																		"personalExperience",
																		"photoURL",
																	].forEach((f) => {
																		defaults[f] = "current";
																	});
																	setMergeKeep(defaults);
																	setConflictData(result.conflict);
																}
															}}
															className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-full active:scale-95 transition whitespace-nowrap"
														>
															+ {isHindi ? "Google जोड़ें" : "Link Google"}
														</button>
													)}
												</div>
												{/* Phone row */}
												<div className="flex items-center justify-between gap-3">
													<div className="flex items-center gap-2.5">
														<div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
															<Phone
																size={14}
																className="text-slate-500 dark:text-ink-300"
															/>
														</div>
														<div>
															<p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
																{isHindi ? "फ़ोन नंबर" : "Phone Number"}
															</p>
															{hasPhone && user.phoneNumber && (
																<p className="text-[10px] text-slate-400 dark:text-ink-400">
																	{user.phoneNumber}
																</p>
															)}
														</div>
													</div>
													{hasPhone ? (
														<span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full">
															<CheckCircle2 size={10} />{" "}
															{isHindi ? "जुड़ा है" : "Linked"}
														</span>
													) : (
														<button
															type="button"
															onClick={() => {
																setLinkPhone("+91");
																setLinkOtpCode("");
																setLinkOtpSent(false);
																setShowLinkPhoneModal(true);
															}}
															className="text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10 px-3 py-1.5 rounded-full active:scale-95 transition whitespace-nowrap"
														>
															+ {isHindi ? "Phone जोड़ें" : "Link Phone"}
														</button>
													)}
												</div>
											</div>
										</div>
									);
								})()}

							{/* ═══ NEW: Account Linking Banner ═══ */}
							{user && user.providerData.length === 1 && (
								<div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-3 mb-5 flex items-start gap-2.5">
									<Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
									<div>
										<p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
											{isHindi ? "💡 सुरक्षा बढ़ाएं" : "💡 Improve Security"}
										</p>
										<p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">
											{isHindi
												? "ऊपर एक और लॉगिन विधि (Google / Phone) जोड़ें ताकि खाता सुरक्षित रहे।"
												: "Link another sign-in method (Google / Phone) above to keep your account safe."}
										</p>
									</div>
								</div>
							)}

							{/* ════ FORM ════ */}
							<form
								id="profile-form"
								onSubmit={handleSave}
								className="space-y-5"
							>
								{/* Name */}
								<div>
									<div className="flex justify-between items-center mb-1.5 ml-1 pr-1">
										<label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
											{isHindi ? "नाम" : "Name"}{" "}
											<span className="text-red-500">*</span>
										</label>
										<span className="text-[10px] font-medium text-slate-400 dark:text-ink-400">
											{(formData.realName || "").length}/50
										</span>
									</div>
									<div className="relative">
										<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
											<User
												size={18}
												className="text-slate-400 dark:text-ink-400"
											/>
										</div>
										<input
											type="text"
											name="realName"
											value={formData.realName}
											onChange={handleChange}
											onBlur={() => handleFieldBlur("realName")}
											maxLength={50}
											disabled={isApprovedProfile}
											className={`w-full bg-white dark:bg-slate-900 border ${formErrors.realName ? "border-red-400 ring-2 ring-red-200 dark:ring-red-500/20" : "border-slate-200 dark:border-slate-800"} rounded-2xl pl-11 pr-4 py-3.5 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white ${isApprovedProfile ? "opacity-60 cursor-not-allowed" : ""}`}
											placeholder={
												isHindi ? "अपना नाम दर्ज करें" : "Enter your name"
											}
										/>
									</div>
									{formErrors.realName && (
										<p className="text-xs text-red-500 mt-1 ml-1">
											{formErrors.realName}
										</p>
									)}
								</div>

								{/* Diksha Name */}
								<div>
									<div className="flex justify-between items-center mb-1.5 ml-1 pr-1">
										<label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
											{isHindi ? "दीक्षित नाम (Diksha Name)" : "Diksha Name"}
										</label>
										<span className="text-[10px] font-medium text-slate-400 dark:text-ink-400">
											{(formData.dikshaName || "").length}/50
										</span>
									</div>
									<input
										type="text"
										name="dikshaName"
										value={formData.dikshaName}
										onChange={handleChange}
										maxLength={50}
										disabled={isApprovedProfile}
										className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white ${isApprovedProfile ? "opacity-60 cursor-not-allowed" : ""}`}
										placeholder={isHindi ? "यदि लागू हो" : "If applicable"}
									/>
								</div>

								{/* Gender — saved at once, not part of the review */}
								{user && (
									<div id="profile-gender" data-tour="profile-gender">
										<p className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
											{isHindi ? "लिंग" : "Gender"}
										</p>
										<div className="grid grid-cols-2 gap-2">
											{(
												[
													["male", "पुरुष", "Male"],
													["female", "महिला", "Female"],
												] as const
											).map(([value, hi, en]) => (
												<button
													type="button"
													key={value}
													disabled={genderSaving}
													aria-pressed={profile?.gender === value}
													onClick={() => saveGender(value)}
													className={`min-h-touch rounded-2xl border text-sm font-bold transition active:scale-[0.98] disabled:opacity-60 ${
														profile?.gender === value
															? "bg-pink-500 border-pink-500 text-white"
															: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
													}`}
												>
													{isHindi ? hi : en}
												</button>
											))}
										</div>
										<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 ml-1 leading-snug">
											{isHindi
												? "इससे परिवार के रिश्ते अपने-आप सही भरते हैं। चुनते ही सहेज लिया जाता है।"
												: "Helps fill in family relations correctly. Saved as soon as you pick."}
										</p>
									</div>
								)}

								{/* ── Spiritual Master ── */}
								<div>
									<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
										{isHindi ? "दीक्षा गुरु / स्थिति" : "Diksha Guru / Status"}{" "}
										<span className="text-red-500">*</span>
									</label>
									<button
										type="button"
										onClick={() =>
											!isApprovedProfile && setShowGuruSelector(true)
										}
										disabled={isApprovedProfile}
										className={`w-full bg-white dark:bg-slate-900 border rounded-2xl px-4 py-3.5 transition-all outline-none text-left flex items-center justify-between gap-2 ${
											formData.guruSelection
												? "border-pink-400 dark:border-pink-600 text-slate-800 dark:text-white"
												: "border-slate-200 dark:border-slate-800 text-slate-400"
										} ${isApprovedProfile ? "opacity-60 cursor-not-allowed" : ""}`}
									>
										<span className="truncate text-sm leading-tight">
											{formData.guruSelection
												? isHindi
													? GURU_OPTIONS.find(
															(o) => o.id === formData.guruSelection,
														)?.labelHi
													: GURU_OPTIONS.find(
															(o) => o.id === formData.guruSelection,
														)?.labelEn
												: isHindi
													? "गुरु महाराज चुनें"
													: "Select Guru Maharaj"}
										</span>
										<ChevronDown
											size={18}
											className="text-slate-400 dark:text-ink-400 shrink-0"
										/>
									</button>

									{/* Custom guru name input */}
									{formData.guruSelection === "other" && (
										<div className="mt-2">
											<input
												type="text"
												name="guruNameCustom"
												value={formData.guruNameCustom}
												onChange={(e) =>
													setFormData((prev) => ({
														...prev,
														guruNameCustom: e.target.value,
													}))
												}
												maxLength={50}
												disabled={isApprovedProfile}
												className={`w-full bg-white dark:bg-slate-900 border border-pink-300 dark:border-pink-700 rounded-2xl px-4 py-3 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white text-sm ${isApprovedProfile ? "opacity-60 cursor-not-allowed" : ""}`}
												placeholder={
													isHindi
														? "गुरु महाराज का नाम यहाँ टाइप करें..."
														: "Type Guru Maharaj's name here..."
												}
											/>
											<div className="text-right mt-1 pr-1">
												<span className="text-[10px] font-medium text-slate-400 dark:text-ink-400">
													{(formData.guruNameCustom || "").length}/50
												</span>
											</div>
										</div>
									)}

									{formData.guruSelection === "aspiring" && (
										<p className="text-xs text-blue-500 dark:text-blue-400 mt-1.5 ml-1">
											🌱{" "}
											{isHindi
												? "आकांक्षी के लिए दीक्षा की तिथि आवश्यक नहीं है"
												: "Initiation date is not required for aspiring"}
										</p>
									)}
								</div>

								{/* ── Initiation Date — only when non-aspiring guru selected ── */}
								{formData.guruSelection && !isAspiringSelected && (
									<div>
										<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
											{isHindi ? "दीक्षा की तिथि" : "Diksha Date"}{" "}
											<span className="text-red-500">*</span>
										</label>
										<CustomDateInput
											value={toDateInputFormat(formData.dikshaDate)}
											onChange={(val) =>
												setFormData((prev) => ({
													...prev,
													dikshaDate: fromDateInputFormat(val),
												}))
											}
											disabled={isApprovedProfile}
											isHindi={isHindi}
										/>
									</div>
								)}

								{/* ── Mandal ── */}
								<div>
									<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
										{isHindi ? "मंडल" : "Mandal"}{" "}
										<span className="text-red-500">*</span>
									</label>

									{/* Dropdown — hidden when custom mandal is checked */}
									{!formData.isCustomMandal && (
										<div className="relative">
											<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
												<MapPin
													size={18}
													className="text-slate-400 dark:text-ink-400"
												/>
											</div>
											<button
												type="button"
												onClick={() =>
													!isApprovedProfile && setShowMandalSelector(true)
												}
												disabled={isApprovedProfile}
												className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 transition-all outline-none text-left flex items-center justify-between ${
													!formData.mandalId
														? "text-slate-400"
														: "text-slate-800 dark:text-white"
												} ${isApprovedProfile ? "opacity-60 cursor-not-allowed" : ""}`}
											>
												<span className="truncate">
													{!formData.mandalId
														? isHindi
															? "मंडल चुनें"
															: "Select Mandal"
														: isHindi
															? MANDAL_LIST.find(
																	(m) => m.id === formData.mandalId,
																)?.shortNameHi
															: MANDAL_LIST.find(
																	(m) => m.id === formData.mandalId,
																)?.shortNameEn}
												</span>
												<ChevronDown
													size={18}
													className="text-slate-400 dark:text-ink-400 shrink-0"
												/>
											</button>
										</div>
									)}

									{/* Custom mandal text input — shown when checkbox is ticked */}
									{formData.isCustomMandal && (
										<div className="relative mt-2">
											<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
												<MapPin size={18} className="text-pink-500" />
											</div>
											<input
												type="text"
												value={formData.mandalId}
												onChange={(e) =>
													setFormData((prev) => ({
														...prev,
														mandalId: e.target.value,
													}))
												}
												maxLength={20}
												disabled={isApprovedProfile}
												className={`w-full bg-white dark:bg-slate-900 border border-pink-400 dark:border-pink-600 rounded-2xl pl-11 pr-14 py-3.5 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white ${isApprovedProfile ? "opacity-60 cursor-not-allowed" : ""}`}
												placeholder={
													isHindi
														? "अपने मंडल का नाम लिखें..."
														: "Type your Mandal name..."
												}
											/>
											<div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
												<span
													className={`text-xs font-bold ${formData.mandalId.length >= 20 ? "text-red-500" : "text-slate-400 dark:text-ink-400"}`}
												>
													{formData.mandalId.length}/20
												</span>
											</div>
										</div>
									)}

									{/* "Not in list" checkbox */}
									{!isApprovedProfile && (
										<label className="flex items-center gap-2 mt-2.5 ml-0.5 cursor-pointer group">
											<div
												onClick={() =>
													setFormData((prev) => ({
														...prev,
														isCustomMandal: !prev.isCustomMandal,
														mandalId: !prev.isCustomMandal ? "" : prev.mandalId,
													}))
												}
												className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
													formData.isCustomMandal
														? "bg-pink-500 border-pink-500"
														: "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 group-hover:border-pink-400"
												}`}
											>
												{formData.isCustomMandal && (
													<svg
														width="11"
														height="9"
														viewBox="0 0 11 9"
														fill="none"
													>
														<path
															d="M1 4L4 7L10 1"
															stroke="white"
															strokeWidth="2"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
													</svg>
												)}
											</div>
											<span className="text-[12px] text-slate-600 dark:text-slate-400 leading-tight">
												{isHindi
													? "यदि आपका मंडल लिस्ट में नहीं है, यहाँ क्लिक करें"
													: "If your Mandal is not in the list, click here"}
											</span>
										</label>
									)}
								</div>

								{/* ── Phone Number ── */}
								<div>
									<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
										{isHindi ? "फोन नंबर" : "Phone Number"}{" "}
										<span className="text-red-500">*</span>
									</label>
									<div className="relative">
										<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
											<Phone
												size={18}
												className="text-slate-400 dark:text-ink-400"
											/>
										</div>
										<input
											type="tel"
											name="phoneNumber"
											value={formData.phoneNumber}
											onChange={handleChange}
											onBlur={() => handleFieldBlur("phoneNumber")}
											inputMode="tel"
											maxLength={13}
											className={`w-full bg-white dark:bg-slate-900 border ${formErrors.phoneNumber ? "border-red-400 ring-2 ring-red-200 dark:ring-red-500/20" : "border-slate-200 dark:border-slate-800"} rounded-2xl pl-11 pr-4 py-3.5 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white tracking-wider`}
											placeholder="+91XXXXXXXXXX"
										/>
									</div>
									{formErrors.phoneNumber && (
										<p className="text-xs text-red-500 mt-1 ml-1">
											{formErrors.phoneNumber}
										</p>
									)}
									<p className="text-[11px] text-slate-400 dark:text-ink-400 mt-1.5 ml-1 flex items-center gap-1">
										<Lock size={10} className="shrink-0" />
										{isHindi
											? "यह नंबर पूरी तरह सुरक्षित है और किसी को भी नहीं दिखाया जाएगा।"
											: "This number is completely secure and will not be shown to anyone."}
									</p>
									<p className="text-[10px] text-slate-400 dark:text-ink-400 mt-1 ml-1">
										{isHindi
											? 'यह आपका संपर्क फ़ोन है। आपका वेरिफ़ाइड (प्रमाणित) लॉगिन फ़ोन ऊपर "Connected Accounts" में दिखाई देता है।'
											: "This is your contact phone. Your verified login phone is shown above in Connected Accounts."}
									</p>
								</div>

								{/* ── Personal Experience (Optional) ── */}
								<div>
									<div className="flex justify-between items-center mb-1.5 ml-1 pr-1">
										<label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
											{isHindi
												? "आपका अनुभव (वैकल्पिक)"
												: "Your Experience (Optional)"}
										</label>
										<span className="text-[10px] font-medium text-slate-400 dark:text-ink-400">
											{(formData.personalExperience || "").length}/500
										</span>
									</div>
									<textarea
										name="personalExperience"
										value={formData.personalExperience || ""}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												personalExperience: e.target.value,
											}))
										}
										rows={3}
										maxLength={500}
										className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white resize-none"
										placeholder={
											isHindi
												? "गुरु महाराज जी के साथ अपने अनुभव या दीक्षा कैसे हुई, इसके बारे में लिखें..."
												: "Write about your experience with Guru Maharaj Ji, how you got diksha, etc..."
										}
									/>
									<p className="text-[12px] text-slate-500 dark:text-ink-300 mt-2 ml-1 leading-relaxed">
										{isHindi
											? "गुरु महाराज जी के साथ अपने अनुभव या दीक्षा कैसे हुई, इसके बारे में लिखें..."
											: "Write about your experience with Guru Maharaj Ji, how you got diksha, etc..."}
									</p>
									<p className="text-[11px] text-slate-400 dark:text-ink-400 mt-1.5 ml-1">
										{isHindi
											? "यह जानकारी आप कभी भी बदल सकते हैं।"
											: "You can update this information at any time."}
									</p>
								</div>

								{/* ════ LINKED FAMILY ACCOUNTS ════ */}
								<div className="pt-1 scroll-mt-24" id="profile-family-links">
									<div className="flex items-center justify-between mb-3">
										<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
											<Users size={16} className="text-blue-500" />
											{isHindi ? "ऐप पर जुड़ा परिवार" : "Family on the app"}
											{pendingLinkRequests.length > 0 && (
												<span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 min-w-[18px] text-center animate-pulse">
													{pendingLinkRequests.length}
												</span>
											)}
											{linkedStatus === "refreshing" && (
												<Loader2
													size={13}
													className="animate-spin text-blue-400"
													aria-label={isHindi ? "अपडेट हो रहा है" : "Updating"}
												/>
											)}
										</label>
										<button
											type="button"
											onClick={() => {
												setSendLinkPhone("+91");
												setSendLinkEmail("");
												setSendLinkRelation("");
												setShowSendLinkModal(true);
											}}
											data-tour="profile-family-link"
											className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-full active:scale-95 transition-all border border-blue-200 dark:border-blue-500/30"
										>
											<Plus size={14} />
											{isHindi ? "लिंक करें" : "Link"}
										</button>
									</div>
									<p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2 mb-3 ml-1 leading-snug">
										{isHindi
											? "जो परिवारजन अपने फ़ोन पर यह ऐप चलाते हैं — उनका खाता यहाँ लिंक करें।"
											: "Family who run this app on their own phone — link their account here."}
									</p>

									{/* Pending incoming requests */}
									{pendingLinkRequests.length > 0 && (
										<div className="mb-3 space-y-2">
											<p className="text-[11px] font-bold text-red-500 uppercase tracking-wider ml-1">
												🔔 {isHindi ? "लंबित अनुरोध" : "Pending Requests"}
											</p>
											{pendingLinkRequests.map((req) => (
												<div
													key={req.id}
													className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-2xl p-3"
												>
													<div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 border-2 border-red-300 dark:border-red-700">
														{req.fromUserPhoto ? (
															<ThumbImg
																src={req.fromUserPhoto}
																alt={req.fromUserName}
																className="w-full h-full object-cover"
															/>
														) : (
															<div className="w-full h-full flex items-center justify-center">
																<span className="text-sm font-bold text-slate-500 dark:text-ink-300">
																	{(req.fromUserName || "?")
																		.charAt(0)
																		.toUpperCase()}
																</span>
															</div>
														)}
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-bold text-slate-800 dark:text-white truncate">
															{req.fromUserName ||
																(isHindi ? "अज्ञात" : "Unknown")}
														</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-400">
															{req.fromRelation
																? isHindi
																	? `आपको अपना "${getRelationLabel(req.fromRelation, true)}" बताकर जोड़ना चाहते हैं`
																	: `Wants to add you as their ${getRelationLabel(req.fromRelation, false)}`
																: isHindi
																	? "परिवार में जोड़ने का अनुरोध"
																	: "Wants to link as family"}
														</p>
													</div>
													<div className="flex gap-1.5 shrink-0">
														<button
															type="button"
															aria-label={isHindi ? "स्वीकार करें" : "Accept"}
															title={isHindi ? "स्वीकार करें" : "Accept"}
															disabled={isRespondingToRequest === req.id}
															onClick={() => {
																setAcceptRelation("");
																setAcceptTarget(req);
															}}
															className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center active:scale-95 transition disabled:opacity-50 shadow-sm"
														>
															{isRespondingToRequest === req.id ? (
																<Loader2 size={14} className="animate-spin" />
															) : (
																<CheckCircle size={14} />
															)}
														</button>
														<button
															type="button"
															aria-label={isHindi ? "अस्वीकार करें" : "Reject"}
															title={isHindi ? "अस्वीकार करें" : "Reject"}
															disabled={isRespondingToRequest === req.id}
															onClick={() =>
																handleRespondToRequest(req.id, false)
															}
															className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center active:scale-95 transition disabled:opacity-50"
														>
															<X size={14} />
														</button>
													</div>
												</div>
											))}
										</div>
									)}

									{/* The "complete relations" helper — always here, so it can be
									    opened any time: a card while relations are missing, a small
									    row (to look over / change them) once all are filled. */}
									{linkedMembersData.length > 0 && openRelationQuestions.length === 0 && (
										<button
											type="button"
											data-tour="profile-relation-helper"
											onClick={() => setShowRelationHelper(true)}
											className="w-full mb-3 min-h-touch flex items-center gap-2 text-left text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-3 py-2 active:scale-[0.99] transition"
										>
											<Sparkles size={14} className="shrink-0" />
											<span className="flex-1">
												{isHindi
													? "सभी रिश्ते भरे हैं ✓ — देखें या बदलें"
													: "All relations filled in ✓ — view or change"}
											</span>
										</button>
									)}
									{openRelationQuestions.length > 0 && (
										<div
											data-tour="profile-relation-helper"
											className="mb-3 flex items-center gap-3 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 p-3"
										>
											<span className="w-10 h-10 shrink-0 rounded-xl bg-blue-500 text-white flex items-center justify-center">
												<Sparkles size={18} />
											</span>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-bold text-slate-800 dark:text-white leading-snug">
													{isHindi
														? `${openRelationQuestions.length} लोगों का रिश्ता बाकी है`
														: `${openRelationQuestions.length} relation${openRelationQuestions.length > 1 ? "s" : ""} to fill in`}
												</p>
												<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
													{isHindi
														? "कुछ आसान सवाल — ज़्यादातर बस एक टैप"
														: "A few quick questions — mostly one tap"}
												</p>
											</div>
											<button
												type="button"
												onClick={() => setShowRelationHelper(true)}
												className="shrink-0 min-h-touch px-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold active:scale-95 transition"
											>
												{isHindi ? "पूरा करें" : "Complete"}
											</button>
										</div>
									)}

									{/* No internet / server not reachable: saved copy (if any) is shown */}
									{linkedStatus === "offline" && (
										<div className="mb-2 flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
											<WifiOff size={14} className="shrink-0" />
											<span className="flex-1 leading-snug">
												{linkedMembersData.length > 0
													? isHindi
														? `इंटरनेट नहीं है — सहेजी हुई सूची दिख रही है${linkedSavedAt ? ` (${savedAgo(linkedSavedAt, true)})` : ""}`
														: `No internet — showing the saved list${linkedSavedAt ? ` (${savedAgo(linkedSavedAt, false)})` : ""}`
													: isHindi
														? "इंटरनेट नहीं है — जुड़ते ही परिवार दिख जाएगा"
														: "No internet — your family will show once you're online"}
											</span>
											<button
												type="button"
												onClick={retryLinkedMembers}
												className="shrink-0 min-h-touch inline-flex items-center gap-1 font-bold text-amber-900 dark:text-amber-100 px-2 rounded-lg active:scale-95 transition"
											>
												<RefreshCw size={12} />
												{isHindi ? "फिर कोशिश" : "Retry"}
											</button>
										</div>
									)}

									{/* First load (nothing saved yet) — slow internet shows this */}
									{linkedStatus === "loading" && linkedMembersData.length === 0 && (
										<div
											className="space-y-2"
											role="status"
											aria-label={isHindi ? "परिवार लोड हो रहा है" : "Loading family"}
										>
											{[0, 1].map((i) => (
												<div
													key={i}
													className="flex items-center gap-3 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-3 animate-pulse"
												>
													<div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 shrink-0" />
													<div className="flex-1 space-y-1.5">
														<div className="h-3 w-2/5 rounded bg-blue-100 dark:bg-blue-900/40" />
														<div className="h-2.5 w-1/4 rounded bg-blue-100 dark:bg-blue-900/40" />
													</div>
												</div>
											))}
											<p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-ink-400">
												<Loader2 size={12} className="animate-spin" />
												{isHindi ? "परिवार लोड हो रहा है…" : "Loading your family…"}
											</p>
										</div>
									)}

									{/* Already linked members */}
									{linkedMembersData.length > 0 ? (
										<div className="space-y-2">
											{linkedMembersData.map((member) => (
												<div
													key={member.id}
													className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-3"
												>
													<div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 border-2 border-blue-300 dark:border-blue-700">
														{member.photoURL ? (
															<CachedImage
																src={member.photoURL}
																thumbWidth={THUMB.small}
																alt={member.realName}
																className="w-full h-full object-cover"
															/>
														) : (
															<div className="w-full h-full flex items-center justify-center">
																<span className="text-sm font-bold text-slate-500 dark:text-ink-300">
																	{(member.realName || "?")
																		.charAt(0)
																		.toUpperCase()}
																</span>
															</div>
														)}
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-bold text-slate-800 dark:text-white truncate">
															{member.realName || member.dikshaName}
														</p>
														{member.reviewStatus === "rejected" && (
															<p className="text-[10px] font-medium text-amber-700 dark:text-amber-300 leading-snug">
																⚠️{" "}
																{isHindi
																	? "प्रोफ़ाइल स्वीकार नहीं हुई"
																	: "Profile not approved"}
																{member.rejectionNote
																	? ` — ${member.rejectionNote}`
																	: ""}
															</p>
														)}
														{member.dikshaName &&
															member.dikshaName !== member.realName && (
																<p className="text-[10px] text-slate-400 dark:text-ink-400 truncate">
																	{member.dikshaName}
																</p>
															)}
														<div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
															<button
																type="button"
																onClick={() =>
																	openRelationEditor(
																		member.id,
																		member.realName || member.dikshaName,
																	)
																}
																className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full active:scale-95 transition ${
																	profile?.linkedFamilyRelations?.[member.id]
																		? "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/20"
																		: "text-blue-500 border border-dashed border-blue-300 dark:border-blue-700"
																}`}
															>
																{profile?.linkedFamilyRelations?.[member.id] ? (
																	<>
																		{getRelationLabel(
																			profile.linkedFamilyRelations[member.id],
																			isHindi,
																		)}
																		<Edit2 size={9} />
																	</>
																) : (
																	<>
																		<Plus size={10} />
																		{isHindi ? "रिश्ता जोड़ें" : "Add relation"}
																	</>
																)}
															</button>
															{profile?.linkedFamilyVia?.[member.id] ? (
																<span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-ink-400 min-w-0">
																	<Link2 size={10} className="shrink-0" />
																	<span className="truncate">
																		{(() => {
																			const via = linkedMembersData.find(
																				(m) =>
																					m.id ===
																					profile.linkedFamilyVia?.[member.id],
																			);
																			const viaName = via
																				? via.realName || via.dikshaName
																				: "";
																			return isHindi
																				? viaName
																					? `${viaName} के ज़रिए`
																					: "परिवार के ज़रिए"
																				: viaName
																					? `via ${viaName}`
																					: "via family";
																		})()}
																	</span>
																</span>
															) : (
																<span className="text-[10px] text-blue-500 font-medium">
																	{isHindi ? "✓ लिंक्ड" : "✓ Linked"}
																</span>
															)}
														</div>
													</div>
													<button
														type="button"
														disabled={isUnlinking === member.id}
														onClick={() => handleUnlinkFamilyMember(member.id)}
														className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-400 flex items-center justify-center active:scale-95 transition disabled:opacity-50 shrink-0"
														title={isHindi ? "लिंक हटाएं" : "Unlink"}
														aria-label={isHindi ? "लिंक हटाएं" : "Unlink"}
													>
														{isUnlinking === member.id ? (
															<Loader2 size={14} className="animate-spin" />
														) : (
															<Trash2 size={13} />
														)}
													</button>
												</div>
											))}
										</div>
									) : (
										linkedStatus === "idle" &&
										pendingLinkRequests.length === 0 &&
										sentLinkRequests.length === 0 && (
											<div className="border-2 border-dashed border-blue-200 dark:border-blue-800/40 rounded-2xl p-4 text-center">
												<p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
													{isHindi
														? '👆 "लिंक करें" दबाएँ और परिवार के उस सदस्य का फ़ोन नंबर डालें जो यह ऐप चलाते हैं'
														: '👆 Tap "Link" and enter their phone number to connect family accounts'}
												</p>
											</div>
										)
									)}

									{/* People the linked family added by hand — shared, read-only */}
									{sharedPeople.length > 0 && (
										<div className="mt-3" data-tour="profile-family-shared">
											<p className="text-[11px] font-bold text-slate-400 dark:text-ink-400 uppercase tracking-wider ml-1 mb-1">
												👪 {isHindi ? "परिवार द्वारा जोड़े गए" : "Added by your family"}
											</p>
											<p className="text-[11px] text-slate-500 dark:text-slate-400 ml-1 mb-2 leading-snug">
												{isHindi
													? "जिन्हें आपके जुड़े परिवारजनों ने अपनी प्रोफ़ाइल में जोड़ा है। इन्हें वही बदल सकते हैं जिन्होंने जोड़ा है।"
													: "People your linked family added to their profiles. Only the one who added them can change them."}
											</p>
											<div className="space-y-2">
												{sharedPeople.map((s) => {
													const owners = s.owners.map((o) => o.name).join(", ");
													const theirRel = s.owners[0]?.relation;
													const theirLabel = getRelationLabel(theirRel, isHindi);
													const fem = relationGender(theirRel) === "female";
													return (
														<div
															key={s.key}
															className="flex items-center gap-3 bg-violet-50/70 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/40 rounded-2xl p-3"
														>
															<div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
																{s.member.photoURL ? (
																	<CachedImage
																		src={s.member.photoURL}
																		thumbWidth={THUMB.small}
																		alt={s.member.realName}
																		className="w-full h-full object-cover"
																	/>
																) : (
																	<div className="w-full h-full flex items-center justify-center">
																		<span className="text-sm font-bold text-slate-500 dark:text-ink-300">
																			{(s.member.realName || s.member.dikshaName || "?")
																				.charAt(0)
																				.toUpperCase()}
																		</span>
																	</div>
																)}
															</div>
															<div className="flex-1 min-w-0">
																<p className="text-sm font-bold text-slate-800 dark:text-white truncate">
																	{s.member.realName || s.member.dikshaName}
																</p>
																<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
																	{isHindi
																		? `${owners} ने जोड़ा${theirLabel ? ` — ${s.owners.length > 1 ? "रिश्ता" : fem ? "उनकी" : "उनके"} ${theirLabel}` : ""}`
																		: `Added by ${owners}${theirLabel ? ` — ${s.owners.length > 1 ? "as" : "their"} ${theirLabel.toLowerCase()}` : ""}`}
																</p>
																{(s.relation || s.suggestions.length > 0) && (
																	<span className="inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-500/20">
																		{s.relation
																			? `${isHindi ? "आपके लिए" : "For you"}: ${getRelationLabel(s.relation, isHindi)}`
																			: `${isHindi ? "शायद" : "Maybe"}: ${s.suggestions
																					.slice(0, 2)
																					.map((r) => getRelationLabel(r, isHindi))
																					.join(" / ")}`}
																	</span>
																)}
															</div>
														</div>
													);
												})}
											</div>
										</div>
									)}

									{/* Sent Requests section */}
									{sentLinkRequests.length > 0 && (
										<div className="mt-3">
											<p className="text-[11px] font-bold text-slate-400 dark:text-ink-400 uppercase tracking-wider ml-1 mb-2">
												📤 {isHindi ? "भेजे गए अनुरोध" : "Sent Requests"}
											</p>
											<div className="space-y-2">
												{sentLinkRequests.map((req) => (
													<div
														key={req.id}
														className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-3"
													>
														<div className="flex-1 min-w-0">
															<p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
																{req.toUserName ||
																	(isHindi ? "उपयोगकर्ता" : "User")}
															</p>
															<div className="flex items-center gap-1.5 mt-0.5">
																{req.status === "pending" && (
																	<span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
																		🕐 {isHindi ? "प्रतीक्षारत" : "Pending"}
																	</span>
																)}
																{req.status === "accepted" && (
																	<span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
																		✅ {isHindi ? "स्वीकृत" : "Accepted"}
																	</span>
																)}
																{req.status === "rejected" && (
																	<span className="text-[10px] font-bold text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
																		❌ {isHindi ? "अस्वीकृत" : "Rejected"}
																	</span>
																)}
																{req.fromRelation && (
																	<span className="text-[10px] text-slate-400 dark:text-ink-400 truncate">
																		{getRelationLabel(
																			req.fromRelation,
																			isHindi,
																		)}
																	</span>
																)}
															</div>
														</div>
														<button
															type="button"
															onClick={() => handleCancelLinkRequest(req.id)}
															className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-ink-400 flex items-center justify-center active:scale-95 transition shrink-0"
															title={
																req.status === "pending"
																	? isHindi
																		? "अनुरोध रद्द करें"
																		: "Cancel request"
																	: isHindi
																		? "सूची से हटाएं"
																		: "Remove from list"
															}
															aria-label={
																req.status === "pending"
																	? isHindi
																		? "अनुरोध रद्द करें"
																		: "Cancel request"
																	: isHindi
																		? "सूची से हटाएं"
																		: "Remove from list"
															}
														>
															<X size={14} />
														</button>
													</div>
												))}
											</div>
										</div>
									)}
								</div>

								{/* ── Family Members ── */}
								<div className="pt-2" ref={familySectionRef}>
									<div className="flex items-center justify-between mb-3">
										<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
											<Users size={16} className="text-pink-500" />
											{isHindi ? "अन्य परिवारजन" : "Other family members"}
											{formData.familyMembers.length > 0 && (
												<span className="text-[10px] font-bold text-white bg-pink-500 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
													{formData.familyMembers.length}
												</span>
											)}
										</label>
										<button
											type="button"
											onClick={openAddMember}
											data-tour="profile-family-add"
											className="flex items-center gap-1.5 text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10 px-3 py-1.5 rounded-full active:scale-95 transition-all border border-pink-200 dark:border-pink-500/30"
										>
											<Plus size={14} />
											{isHindi ? "जोड़ें" : "Add"}
										</button>
									</div>
									<p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2 mb-3 ml-1 leading-snug">
										{isHindi
											? "जो ख़ुद अपनी प्रोफ़ाइल नहीं बना सकते — जैसे घर में एक ही फ़ोन है, या फ़ोन नहीं चला पाते।"
											: "Those who can't make their own profile — e.g. one phone at home, or can't use a phone."}
									</p>

									{formData.familyMembers.length === 0 ? (
										<div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-center">
											<Users
												size={28}
												className="text-slate-300 dark:text-slate-600 mx-auto mb-2"
											/>
											<p className="text-xs text-slate-400 dark:text-slate-500">
												{isHindi
													? "जो परिवारजन ख़ुद अपनी प्रोफ़ाइल नहीं बना सकते, उन्हें यहाँ जोड़ें (वैकल्पिक)"
													: "Add family members who can't make their own profile (optional)"}
											</p>
										</div>
									) : (
										<div className="flex flex-col gap-2">
											{formData.familyMembers.map((m, idx) => (
												<FamilyMemberCard
													key={m.id}
													member={m}
													// Review status only means something once the profile
													// has been sent to the admins.
													status={
														profile &&
														(profile.submittedForReview || profile.isApproved)
															? getFamilyMemberStatus(m, profile)
															: undefined
													}
													index={idx}
													total={formData.familyMembers.length}
													isHindi={isHindi}
													onEdit={openEditMember}
													onDelete={handleDeleteMember}
													onMoveUp={handleMoveUp}
													onMoveDown={handleMoveDown}
													onFindOnApp={
														user &&
														!m.isAspiring &&
														m.dikshaDate &&
														m.guruName &&
														(!m.noAppReason || m.noAppReason === "other")
															? openFindOnApp
															: undefined
													}
													linkedTwinName={linkedTwinName(m)}
													repeated={repeatedMemberIds.has(m.id)}
												/>
											))}
										</div>
									)}
								</div>

								{/* ── Family tree (+ a nudge to set gender, which fills relations) ── */}
								{user && (
									<div className="flex flex-col gap-2">
										<button
											type="button"
											onClick={() => setShowFamilyTree(true)}
											data-tour="profile-family-tree"
											className="w-full flex items-center justify-center gap-2 text-sm font-bold text-pink-600 dark:text-pink-300 bg-pink-50/70 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/30 rounded-2xl py-2.5 active:scale-[0.98] transition"
										>
											<Network size={16} />
											{isHindi ? "परिवार वृक्ष देखें" : "View family tree"}
										</button>
										{!profile?.gender && (
											<button
												type="button"
												onClick={() =>
													document
														.getElementById("profile-gender")
														?.scrollIntoView({ behavior: "smooth", block: "center" })
												}
												className="text-left text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2"
											>
												{isHindi
													? "ऊपर अपना लिंग चुनें — तब परिवार के रिश्ते अपने-आप भर सकेंगे।"
													: "Pick your gender above — then family relations can fill in automatically."}
											</button>
										)}
									</div>
								)}

								{/* ═══ NEW: Draft saved / last saved indicator ═══ */}
								<div className="flex items-center justify-between mt-1 px-1">
									{draftSavedAt ? (
										<p className="text-[10px] text-slate-400 dark:text-ink-400">
											💾 {isHindi ? "प्रारूप सुरक्षित:" : "Draft saved:"}{" "}
											{new Date(draftSavedAt).toLocaleTimeString("en-IN", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									) : (
										<span />
									)}
									{lastSavedAt && (
										<p className="text-[10px] text-emerald-500">
											✅ {isHindi ? "अंतिम बार सुरक्षित:" : "Last saved:"}{" "}
											{new Date(lastSavedAt).toLocaleTimeString("en-IN", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									)}
								</div>

								{!photoPreview && !isSaving && (
									<div className="flex items-center justify-center gap-1.5 mt-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold py-2 px-3 rounded-lg border border-red-100 dark:border-red-900/30">
										<AlertTriangle size={14} />
										{isHindi
											? "ध्यान दें: स्वीकृति के लिए फोटो अपलोड करना अनिवार्य है!"
											: "Action Required: Photo upload is mandatory for approval!"}
									</div>
								)}
							</form>

							{/* WhatsApp Support */}
							<div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
								<p className="text-sm text-green-800 dark:text-green-300 font-medium mb-1">
									{isHindi
										? "किसी भी समस्या के लिए WhatsApp करें"
										: "WhatsApp for any issues"}
								</p>
								<a
									href="https://wa.me/919826154640"
									target="_blank"
									rel="noopener noreferrer"
									className="text-green-600 dark:text-green-400 font-bold hover:underline text-lg flex items-center gap-2"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										fill="currentColor"
										viewBox="0 0 16 16"
									>
										<path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
									</svg>
									+91 9826154640
								</a>
							</div>

							{/* Delete Account */}
							<div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
								<button
									onClick={() => setShowDeleteConfirm(true)}
									className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 py-3 rounded-2xl transition-colors active:scale-95"
								>
									<Trash2 size={16} />
									{isHindi ? "अकाउंट डिलीट करें" : "Delete Account"}
								</button>
								<p className="text-center text-xs text-slate-400 dark:text-ink-400 mt-3 px-4">
									{isHindi
										? "आपका सारा डेटा, फोटो, और लाइक हमेशा के लिए डिलीट हो जाएंगे।"
										: "All your data, photos, and likes will be permanently deleted."}
								</p>
							</div>
						</div>
					)}
				</div>

				{/* ── Save / Request Edit: pinned at the bottom so it is always reachable ── */}
				{user && (
					<div
						className="flex-none border-t border-slate-200 dark:border-slate-800 bg-ry-sand dark:bg-ink-900 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
						data-tour="profile-save"
					>
						<div className="max-w-md mx-auto">
							{profile?.isApproved && !isEditingApproved ? (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										setIsEditingApproved(true);

										const scrollContainer = document.getElementById(
											"profile-scroll-container",
										);
										if (scrollContainer) {
											scrollContainer.scrollTo({
												top: 0,
												behavior: "smooth",
											});
										}

										showToast(
											isHindi
												? "अब आप अपनी प्रोफाइल एडिट कर सकते हैं"
												: "You can now edit your profile",
											"success",
										);
									}}
									className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
								>
									<Edit2 size={18} />
									{isHindi
										? "प्रोफाइल एडिट करने का अनुरोध करें"
										: "Request Profile Edit"}
								</button>
							) : (
								<button
									type="submit"
									form="profile-form"
									disabled={isSaving}
									className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
								>
									{isSaving && <Loader2 size={20} className="animate-spin" />}
									{isSaving
										? isHindi
											? "सहेज रहे हैं..."
											: "Saving..."
										: photoPreview
											? isHindi
												? "प्रोफाइल सहेजें और समीक्षा के लिए भेजें ✅"
												: "Save & Send for Review ✅"
											: isHindi
												? "प्रोफाइल सहेजें"
												: "Save Profile"}
								</button>
							)}
						</div>
					</div>
				)}

				{/* ════════ DELETE CONFIRM MODAL ════════ */}
				{showDeleteConfirm && (
					<div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
						<div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
							<div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4 mx-auto">
								<AlertTriangle size={24} />
							</div>
							<h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-2">
								{isHindi ? "अकाउंट डिलीट करें?" : "Delete Account?"}
							</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-2">
								{isHindi
									? "क्या आप वाकई अपना अकाउंट डिलीट करना चाहते हैं? आपका अकाउंट तुरंत डी-एक्टिवेट हो जाएगा।"
									: "Are you sure you want to delete your account? Your account will be deactivated immediately."}
							</p>
							<p className="text-xs text-red-500/80 dark:text-red-400/80 text-center mb-6 px-2 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">
								{isHindi
									? "सुरक्षा कारणों से आपका डेटा 30 दिनों तक सुरक्षित रखा जाएगा, जिसके बाद इसे हमेशा के लिए मिटा दिया जाएगा।"
									: "For security reasons, your data will be kept for 30 days, after which it will be permanently deleted."}
							</p>
							<div className="flex gap-3">
								<button
									onClick={handleCloseDeleteConfirm}
									disabled={isDeleting}
									className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-ink-600 transition-colors active:scale-95"
								>
									{isHindi ? "रद्द करें" : "Cancel"}
								</button>
								<button
									onClick={handleDeleteAccount}
									disabled={isDeleting}
									className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300 transition-colors flex items-center justify-center gap-2"
								>
									{isDeleting ? (
										<Loader2 size={16} className="animate-spin" />
									) : (
										<Trash2 size={16} />
									)}
									{isHindi ? "डिलीट करें" : "Delete"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* ════════ PHOTO OPTIONS SHEET ════════ */}
				{showPhotoOptions && (
					<div
						className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center p-4 pb-8 animate-in fade-in duration-200"
						onClick={handleClosePhotoOptions}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
								<h3 className="font-bold text-slate-800 dark:text-white px-2">
									{isHindi ? "प्रोफाइल फोटो बदलें" : "Change Profile Photo"}
								</h3>
								<button
									onClick={handleClosePhotoOptions}
									className="p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors bg-white dark:bg-slate-700 shadow-sm"
								>
									<X size={18} />
								</button>
							</div>

							{/* 🌟 Visual Examples 🌟 */}
							<div className="px-4 pt-4 pb-2">
								<div className="bg-amber-50/80 dark:bg-amber-900/10 rounded-2xl p-3 border border-amber-200/50 dark:border-amber-700/30">
									<p className="text-[12px] font-bold text-amber-700 dark:text-amber-500 mb-3 flex items-center gap-1.5 justify-center">
										<Camera size={14} />{" "}
										{isHindi
											? "फोटो कैसी होनी चाहिए?"
											: "How should the photo be?"}
									</p>

									<div className="flex gap-4 justify-center items-start mb-1">
										{/* GOOD Example */}
										<div className="flex flex-col items-center gap-2 group animate-in fade-in zoom-in duration-500 delay-100">
											<div className="relative">
												<div className="w-16 h-16 rounded-full border-[3px] border-green-500 p-0.5 overflow-hidden bg-white dark:bg-ink-800 shadow-md">
													<img
														src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=fde047"
														alt="Good"
														className="w-full h-full object-cover rounded-full"
													/>
												</div>
												<div className="absolute -bottom-1.5 -right-1.5 bg-green-500 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-800 shadow-sm">
													<CheckCircle size={16} />
												</div>
											</div>
											<span className="text-[10px] font-bold text-green-700 dark:text-green-500 text-center leading-tight">
												{isHindi ? "स्पष्ट चेहरा" : "Clear face"}
												<br />({isHindi ? "अकेले" : "alone"})
											</span>
										</div>

										{/* Divider */}
										<div className="w-px h-16 bg-amber-200/50 dark:bg-amber-700/30 mt-2"></div>

										{/* BAD Examples Column */}
										<div className="flex gap-3">
											{/* Group Photo */}
											<div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-500 delay-200">
												<div className="relative">
													<div className="w-12 h-12 rounded-full border-[2.5px] border-red-500 p-0.5 overflow-hidden bg-white dark:bg-ink-800 shadow-sm flex items-center justify-center relative">
														<img
															src="https://api.dicebear.com/7.x/notionists/svg?seed=Aneka&backgroundColor=ffc8c8"
															className="w-8 h-8 absolute -left-2 z-10 rounded-full border border-white"
														/>
														<img
															src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=c8d4ff"
															className="w-8 h-8 absolute -right-2 z-0 rounded-full"
														/>
													</div>
													<div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-800">
														<X size={12} />
													</div>
												</div>
												<span className="text-[9px] font-bold text-red-600 dark:text-red-400 text-center leading-tight">
													{isHindi ? "ग्रुप" : "Group"}
													<br />
													{isHindi ? "फोटो" : "photo"}
												</span>
											</div>

											{/* Blurry Photo */}
											<div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-500 delay-300">
												<div className="relative">
													<div className="w-12 h-12 rounded-full border-[2.5px] border-red-500 p-0.5 overflow-hidden bg-white dark:bg-ink-800 shadow-sm">
														<img
															src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=fde047"
															alt="Blurry"
															className="w-full h-full object-cover rounded-full blur-[2.5px] opacity-80"
														/>
													</div>
													<div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-800">
														<X size={12} />
													</div>
												</div>
												<span className="text-[9px] font-bold text-red-600 dark:text-red-400 text-center leading-tight">
													{isHindi ? "धुंधली" : "Blurry"}
													<br />
													{isHindi ? "फोटो" : "photo"}
												</span>
											</div>
										</div>
									</div>

									<p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 mt-3 text-center font-bold">
										{isHindi
											? "अपलोड के बाद एडमिन द्वारा जांच की जाएगी"
											: "Will be checked by admin after upload"}
									</p>
								</div>
							</div>

							<div className="p-2 flex flex-col gap-1">
								<button
									onClick={() => cameraInputRef.current?.click()}
									className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all text-left group"
								>
									<div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 group-hover:scale-110 transition-transform shadow-sm border border-pink-200/50 dark:border-pink-800/50">
										<Camera size={20} />
									</div>
									<span className="font-semibold text-slate-700 dark:text-slate-200 text-base">
										{isHindi ? "कैमरा से फोटो लें" : "Take photo with camera"}
									</span>
								</button>
								<button
									onClick={() => fileInputRef.current?.click()}
									className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all text-left group"
								>
									<div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shadow-sm border border-blue-200/50 dark:border-blue-800/50">
										<ImageIcon size={20} />
									</div>
									<span className="font-semibold text-slate-700 dark:text-slate-200 text-base">
										{isHindi ? "गैलरी से चुनें" : "Choose from gallery"}
									</span>
								</button>
								{photoPreview && (
									<button
										type="button"
										onClick={handleAdjustPhoto}
										className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all text-left group"
									>
										<div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform shadow-sm border border-amber-200/50 dark:border-amber-800/50">
											<Crop size={20} />
										</div>
										<span className="font-semibold text-slate-700 dark:text-slate-200 text-base">
											{isHindi ? "मौजूदा फोटो सेट करें" : "Adjust current photo"}
										</span>
									</button>
								)}
								{photoPreview && (
									<button
										onClick={handleRemovePhoto}
										className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10 active:scale-[0.98] transition-all text-left group mt-1 border-t border-slate-100 dark:border-slate-700/50"
									>
										<div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform shadow-sm border border-red-200/50 dark:border-red-800/50">
											<Trash2 size={20} />
										</div>
										<span className="font-semibold text-red-600 dark:text-red-400 text-base">
											{isHindi ? "फोटो हटाएं" : "Remove photo"}
										</span>
									</button>
								)}
							</div>
						</div>
					</div>
				)}

				{/* ════════ GURU SELECTOR SHEET ════════ */}
				{showGuruSelector && (
					<div
						className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center p-4 pb-8 animate-in fade-in duration-200"
						onClick={handleCloseGuruSelector}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[75vh] animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 shrink-0">
								<h3 className="font-bold text-slate-800 dark:text-white px-2 flex items-center gap-2 text-sm">
									🙏{" "}
									{isHindi
										? "दीक्षा गुरु / स्थिति चुनें"
										: "Select Diksha Guru / Status"}
								</h3>
								<button
									onClick={handleCloseGuruSelector}
									className="p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors bg-white dark:bg-slate-700 shadow-sm"
								>
									<X size={18} />
								</button>
							</div>
							<div className="overflow-y-auto p-2 flex flex-col gap-1">
								{GURU_OPTIONS.map((option) => {
									const isSelected = formData.guruSelection === option.id;
									const isAspire = option.id === "aspiring";
									const isOther = option.id === "other";
									return (
										<button
											key={option.id}
											onClick={() => {
												setFormData((prev) => ({
													...prev,
													guruSelection: option.id as GuruOptionId,
												}));
												handleCloseGuruSelector();
											}}
											className={`w-full flex items-center gap-3 p-4 rounded-2xl active:scale-[0.98] transition-all text-left group ${
												isSelected
													? "bg-pink-50 dark:bg-pink-500/10"
													: "hover:bg-slate-50 dark:hover:bg-slate-700/50"
											}`}
										>
											<div
												className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
													isSelected
														? "bg-pink-100 dark:bg-pink-500/20"
														: isAspire
															? "bg-green-100 dark:bg-green-900/30"
															: isOther
																? "bg-slate-100 dark:bg-slate-700"
																: "bg-amber-100 dark:bg-amber-900/30"
												}`}
											>
												{isAspire ? "🌱" : isOther ? "✏️" : "🙏"}
											</div>
											<div className="flex-1 min-w-0">
												<p
													className={`font-semibold text-sm leading-tight ${
														isSelected
															? "text-pink-700 dark:text-pink-400"
															: "text-slate-800 dark:text-slate-200"
													}`}
												>
													{isHindi ? option.labelHi : option.labelEn}
												</p>
												{isAspire && (
													<p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
														दीक्षा की तिथि आवश्यक नहीं
													</p>
												)}
												{isOther && (
													<p className="text-xs text-slate-400 dark:text-ink-400 mt-0.5">
														{isHindi ? "स्वयं नाम टाइप करें" : "Type name manually"}
													</p>
												)}
											</div>
											{isSelected && (
												<CheckCircle
													size={20}
													className="text-pink-500 shrink-0"
												/>
											)}
										</button>
									);
								})}
							</div>
						</div>
					</div>
				)}

				{/* ════════ MANDAL SELECTOR SHEET ════════ */}
				{showMandalSelector && (
					<div
						className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center p-4 pb-8 animate-in fade-in duration-200"
						onClick={handleCloseMandalSelector}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 shrink-0">
								<h3 className="font-bold text-slate-800 dark:text-white px-2 flex items-center gap-2">
									<MapPin size={18} className="text-pink-500" />
									{isHindi ? "अपना मंडल चुनें" : "Choose your Mandal"}
								</h3>
								<button
									onClick={handleCloseMandalSelector}
									className="p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors bg-white dark:bg-slate-700 shadow-sm"
								>
									<X size={18} />
								</button>
							</div>
							<div className="overflow-y-auto p-2 flex flex-col gap-1">
								{MANDAL_LIST.map((m) => (
									<button
										key={m.id}
										onClick={() => {
											setFormData((prev) => ({ ...prev, mandalId: m.id }));
											handleCloseMandalSelector();
										}}
										className={`w-full flex items-center gap-3 p-3.5 rounded-2xl active:scale-[0.98] transition-all text-left group ${
											formData.mandalId === m.id
												? "bg-pink-50 dark:bg-pink-500/10"
												: "hover:bg-slate-50 dark:hover:bg-slate-700/50"
										}`}
									>
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
												formData.mandalId === m.id
													? "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400"
													: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
											}`}
										>
											{m.shortNameHi?.charAt(0) || m.shortNameEn?.charAt(0)}
										</div>
										<div className="flex-1">
											<p
												className={`font-semibold text-sm ${
													formData.mandalId === m.id
														? "text-pink-700 dark:text-pink-400"
														: "text-slate-700 dark:text-slate-300"
												}`}
											>
												{isHindi ? m.shortNameHi : m.shortNameEn}
											</p>
										</div>
										{formData.mandalId === m.id && (
											<CheckCircle
												size={18}
												className="text-pink-500 shrink-0"
											/>
										)}
									</button>
								))}
							</div>
						</div>
					</div>
				)}

				{/* ════════ FAMILY MEMBER MODAL ════════ */}
				{showFamilyMemberModal && (
					<div
						className="fixed inset-0 bg-black/60 z-[110] flex items-end justify-center p-4 pb-8 animate-in fade-in duration-200"
						onClick={handleCloseFamilyMemberModal}
					>
						<div
							className="bg-ry-sand dark:bg-ink-900 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
							onClick={(e) => e.stopPropagation()}
						>
							{/* Header */}
							<div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-white dark:bg-slate-900/80 shrink-0">
								<h3 className="font-bold text-slate-800 dark:text-white px-1 flex items-center gap-2 text-sm">
									<Users size={16} className="text-pink-500" />
									{editingMemberIndex !== null
										? isHindi
											? "सदस्य संपादित करें"
											: "Edit Member"
										: memberAddStep === "choose"
											? isHindi
												? "ये कौन हैं?"
												: "Who are they?"
											: isHindi
												? "परिवार का सदस्य जोड़ें"
												: "Add Family Member"}
								</h3>
								<button
									onClick={handleCloseFamilyMemberModal}
									className="p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors bg-slate-100 dark:bg-slate-700 shadow-sm"
								>
									<X size={18} />
								</button>
							</div>

							{memberAddStep === "choose" ? (
								<div className="overflow-y-auto p-4 space-y-3">
									<button
										type="button"
										onClick={() => {
											linkAfterMemberModalRef.current = true;
											handleCloseFamilyMemberModal();
										}}
										className="w-full text-left rounded-2xl border-2 border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 p-4 active:scale-[0.98] transition"
									>
										<span className="flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
											<Link2 size={16} />
											{isHindi
												? "ये अपने फ़ोन पर यह ऐप चलाते हैं"
												: "They run this app on their own phone"}
										</span>
										<span className="block mt-1 text-xs text-blue-700/80 dark:text-blue-300/80 leading-snug">
											{isHindi
												? "तो उनका खाता लिंक करें — उनकी फ़ोटो, नाम और बदलाव अपने-आप दिखेंगे। (सही तरीका)"
												: "Then link their account — their photo, name and changes show up by themselves. (The right way)"}
										</span>
									</button>

									<p className="pt-2 text-xs font-bold text-slate-600 dark:text-slate-300 ml-1">
										{isHindi
											? "ये ख़ुद अपनी प्रोफ़ाइल नहीं बना सकते, क्योंकि…"
											: "They can't make their own profile, because…"}
									</p>
									{NO_APP_REASONS.map((r) => (
										<button
											type="button"
											key={r.id}
											onClick={() => {
												setMemberForm((prev) => ({ ...prev, noAppReason: r.id }));
												setMemberAddStep("form");
											}}
											className="w-full min-h-touch flex items-center gap-3 text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 active:scale-[0.98] transition"
										>
											<span className="text-lg" aria-hidden="true">
												{r.emoji}
											</span>
											{isHindi ? r.hi : r.en}
										</button>
									))}
								</div>
							) : (
							<div className="overflow-y-auto p-4 space-y-4">
								{/* Why they are added by hand (asked in the first step) */}
								<div>
									<p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 ml-1">
										{isHindi
											? "ये ख़ुद प्रोफ़ाइल क्यों नहीं बना सकते?"
											: "Why can't they make their own profile?"}
									</p>
									<div className="flex flex-wrap gap-1.5">
										{NO_APP_REASONS.map((r) => (
											<button
												type="button"
												key={r.id}
												aria-pressed={memberForm.noAppReason === r.id}
												onClick={() =>
													setMemberForm((prev) => ({ ...prev, noAppReason: r.id }))
												}
												className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition active:scale-95 ${
													memberForm.noAppReason === r.id
														? "bg-pink-500 border-pink-500 text-white"
														: "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
												}`}
											>
												{r.emoji} {isHindi ? r.hi : r.en}
											</button>
										))}
									</div>
								</div>

								{/* ── Member Photo ── */}
								<div className="flex flex-col items-center py-2">
									<div
										className="relative group cursor-pointer"
										onClick={() => memberFileInputRef.current?.click()}
									>
										{/* Avatar circle */}
										<div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-lg bg-pink-100 dark:bg-pink-900/30">
											{memberPhotoPreview ? (
												<ThumbImg
													src={memberPhotoPreview}
													thumbWidth={THUMB.tile}
													alt="Member"
													className="w-full h-full object-cover"
												/>
											) : (
												<div className="w-full h-full flex items-center justify-center">
													{memberForm.realName.trim() ? (
														<span className="text-2xl font-bold text-pink-500">
															{memberForm.realName
																.trim()
																.charAt(0)
																.toUpperCase()}
														</span>
													) : (
														<User size={32} className="text-pink-400" />
													)}
												</div>
											)}
											{/* Hover overlay */}
											<div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
												{isMemberUploading ? (
													<Loader2
														size={22}
														className="text-white animate-spin"
													/>
												) : (
													<Camera size={22} className="text-white" />
												)}
											</div>
										</div>
										{/* Camera badge */}
										<div className="absolute bottom-0 right-0 w-7 h-7 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md">
											<Camera size={13} className="text-white" />
										</div>
									</div>

									<input
										ref={memberFileInputRef}
										type="file"
										accept="image/*"
										onChange={handleMemberPhotoSelect}
										className="hidden"
									/>

									<p className="text-[10px] text-slate-400 dark:text-ink-400 mt-2 text-center">
										{isHindi
											? "फोटो जोड़ने के लिए टैप करें (वैकल्पिक)"
											: "Tap to add photo (optional)"}
									</p>

									{/* Remove photo option */}
									{memberPhotoPreview && (
										<div className="mt-1 flex items-center gap-3">
											<button
												type="button"
												onClick={() =>
													openCropper({
														src: memberPhotoPreview,
														target: "member",
													})
												}
												className="text-[10px] text-amber-600 hover:text-amber-700 transition font-medium"
											>
												{isHindi ? "फोटो सेट करें" : "Adjust photo"}
											</button>
											<button
												type="button"
												onClick={() => setMemberPhotoPreview(null)}
												className="text-[10px] text-red-400 hover:text-red-500 transition font-medium"
											>
												{isHindi ? "फोटो हटाएं" : "Remove photo"}
											</button>
										</div>
									)}
								</div>

								{/* Name */}
								<div>
									<div className="flex justify-between items-center mb-1.5 ml-1 pr-1">
										<label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
											{isHindi ? "नाम" : "Name"}{" "}
											<span className="text-red-500">*</span>
										</label>
										<span className="text-[10px] font-medium text-slate-400 dark:text-ink-400">
											{memberForm.realName.length}/50
										</span>
									</div>
									<div className="relative">
										<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
											<User
												size={16}
												className="text-slate-400 dark:text-ink-400"
											/>
										</div>
										<input
											type="text"
											value={memberForm.realName}
											onChange={(e) =>
												setMemberForm((prev) => ({
													...prev,
													realName: e.target.value,
												}))
											}
											maxLength={50}
											className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white text-sm"
											placeholder={isHindi ? "सदस्य का नाम" : "Member's name"}
										/>
									</div>
								</div>

								{/* Relation */}
								<RelationPicker
									value={memberForm.relation}
									onChange={(relation) =>
										setMemberForm((prev) => ({ ...prev, relation }))
									}
									isHindi={isHindi}
									label={
										isHindi
											? "आपसे क्या रिश्ता है?"
											: "How are they related to you?"
									}
								/>

								{/* Diksha Name */}
								<div>
									<div className="flex justify-between items-center mb-1.5 ml-1 pr-1">
										<label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
											{isHindi ? "दीक्षित नाम" : "Diksha Name"}
										</label>
										<span className="text-[10px] font-medium text-slate-400 dark:text-ink-400">
											{memberForm.dikshaName.length}/50
										</span>
									</div>
									<input
										type="text"
										value={memberForm.dikshaName}
										onChange={(e) =>
											setMemberForm((prev) => ({
												...prev,
												dikshaName: e.target.value,
											}))
										}
										maxLength={50}
										className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white text-sm"
										placeholder={isHindi ? "यदि लागू हो" : "If applicable"}
									/>
								</div>

								{/* Guru / Status */}
								<div>
									<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
										{isHindi ? "दीक्षा गुरु / स्थिति" : "Diksha Guru / Status"}{" "}
										<span className="text-red-500">*</span>
									</label>
									<button
										type="button"
										onClick={() => setShowFamilyGuruSelector(true)}
										className={`w-full bg-white dark:bg-slate-900 border rounded-2xl px-4 py-3 transition-all outline-none text-left flex items-center justify-between gap-2 text-sm ${
											memberForm.guruSelection
												? "border-pink-400 dark:border-pink-600 text-slate-800 dark:text-white"
												: "border-slate-200 dark:border-slate-800 text-slate-400"
										}`}
									>
										<span className="truncate leading-tight">
											{memberForm.guruSelection
												? isHindi
													? GURU_OPTIONS.find(
															(o) => o.id === memberForm.guruSelection,
														)?.labelHi
													: GURU_OPTIONS.find(
															(o) => o.id === memberForm.guruSelection,
														)?.labelEn
												: isHindi
													? "गुरु महाराज चुनें"
													: "Select Guru Maharaj"}
										</span>
										<ChevronDown
											size={16}
											className="text-slate-400 dark:text-ink-400 shrink-0"
										/>
									</button>

									{memberForm.guruSelection === "other" && (
										<input
											type="text"
											value={memberForm.guruNameCustom}
											onChange={(e) =>
												setMemberForm((prev) => ({
													...prev,
													guruNameCustom: e.target.value,
												}))
											}
											maxLength={50}
											className="mt-2 w-full bg-white dark:bg-slate-900 border border-pink-300 dark:border-pink-700 rounded-2xl px-4 py-3 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white text-sm"
											placeholder={
												isHindi
													? "गुरु महाराज का नाम..."
													: "Guru Maharaj's name..."
											}
										/>
									)}
									{memberForm.guruSelection === "aspiring" && (
										<p className="text-xs text-blue-500 dark:text-blue-400 mt-1.5 ml-1">
											🌱{" "}
											{isHindi
												? "दीक्षा की तिथि आवश्यक नहीं है"
												: "Initiation date is not required"}
										</p>
									)}
								</div>

								{/* Diksha Date */}
								{memberForm.guruSelection &&
									memberForm.guruSelection !== "aspiring" && (
										<div>
											<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
												{isHindi ? "दीक्षा की तिथि" : "Diksha Date"}{" "}
												<span className="text-red-500">*</span>
											</label>
											<CustomDateInput
												value={toDateInputFormat(memberForm.dikshaDate)}
												onChange={(val) =>
													setMemberForm((prev) => ({
														...prev,
														dikshaDate: fromDateInputFormat(val),
													}))
												}
												isHindi={isHindi}
											/>
										</div>
									)}
							</div>
							)}

							{/* Save button (not on the first step) */}
							{memberAddStep === "form" && (
							<div className="p-4 pt-2 border-t border-slate-200 dark:border-slate-700/50 shrink-0">
								<button
									type="button"
									onClick={handleSaveMember}
									className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
								>
									<CheckCircle size={18} />
									{editingMemberIndex !== null
										? isHindi
											? "बदलाव सहेजें"
											: "Save Changes"
										: isHindi
											? "सदस्य जोड़ें"
											: "Add Member"}
								</button>
							</div>
							)}
						</div>
					</div>
				)}

				{/* ════════ FAMILY GURU SELECTOR SHEET ════════ */}
				{showFamilyGuruSelector && (
					<div
						className="fixed inset-0 bg-black/60 z-[120] flex items-end justify-center p-4 pb-8 animate-in fade-in duration-200"
						onClick={handleCloseFamilyGuruSelector}
					>
						<div
							className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[75vh] animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 shrink-0">
								<h3 className="font-bold text-slate-800 dark:text-white px-2 flex items-center gap-2 text-sm">
									🙏{" "}
									{isHindi
										? "दीक्षा गुरु / स्थिति चुनें"
										: "Select Diksha Guru / Status"}
								</h3>
								<button
									onClick={handleCloseFamilyGuruSelector}
									className="p-2 text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors bg-white dark:bg-slate-700 shadow-sm"
								>
									<X size={18} />
								</button>
							</div>
							<div className="overflow-y-auto p-2 flex flex-col gap-1">
								{GURU_OPTIONS.map((option) => {
									const isSelected = memberForm.guruSelection === option.id;
									const isAspire = option.id === "aspiring";
									const isOther = option.id === "other";
									return (
										<button
											key={option.id}
											onClick={() => {
												setMemberForm((prev) => ({
													...prev,
													guruSelection: option.id as GuruOptionId,
													isAspiring: option.id === "aspiring",
												}));
												handleCloseFamilyGuruSelector();
											}}
											className={`w-full flex items-center gap-3 p-4 rounded-2xl active:scale-[0.98] transition-all text-left group ${
												isSelected
													? "bg-pink-50 dark:bg-pink-500/10"
													: "hover:bg-slate-50 dark:hover:bg-slate-700/50"
											}`}
										>
											<div
												className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
													isSelected
														? "bg-pink-100 dark:bg-pink-500/20"
														: isAspire
															? "bg-green-100 dark:bg-green-900/30"
															: isOther
																? "bg-slate-100 dark:bg-slate-700"
																: "bg-amber-100 dark:bg-amber-900/30"
												}`}
											>
												{isAspire ? "🌱" : isOther ? "✏️" : "🙏"}
											</div>
											<div className="flex-1 min-w-0">
												<p
													className={`font-semibold text-sm leading-tight ${isSelected ? "text-pink-700 dark:text-pink-400" : "text-slate-800 dark:text-slate-200"}`}
												>
													{isHindi ? option.labelHi : option.labelEn}
												</p>
												{isAspire && (
													<p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
														दीक्षा की तिथि आवश्यक नहीं
													</p>
												)}
												{isOther && (
													<p className="text-xs text-slate-400 dark:text-ink-400 mt-0.5">
														{isHindi ? "स्वयं नाम टाइप करें" : "Type name manually"}
													</p>
												)}
											</div>
											{isSelected && (
												<CheckCircle
													size={20}
													className="text-pink-500 shrink-0"
												/>
											)}
										</button>
									);
								})}
							</div>
						</div>
					</div>
				)}
			</div>

			{/* ═══ PHOTO CROPPER ═══ */}
			{cropRequest && (
				<PhotoCropper
					src={cropRequest.src}
					isHindi={isHindi}
					onCancel={closeCropper}
					onConfirm={(blob) =>
						cropRequest.target === "profile"
							? uploadProfilePhoto(blob)
							: uploadMemberPhoto(blob)
					}
				/>
			)}

			{/* ═══ SEND LINK REQUEST MODAL ═══ */}
			{showSendLinkModal && (
				<div
					className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-4"
					onClick={() => setShowSendLinkModal(false)}
				>
					<div
						className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-5">
							<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
								<Users size={18} className="text-blue-500" />
								{isHindi ? "परिवार जोड़ें" : "Link Family Account"}
							</h3>
							<button
								type="button"
								onClick={() => setShowSendLinkModal(false)}
								aria-label={isHindi ? "बंद करें" : "Close"}
								className="text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
							>
								<X size={20} />
							</button>
						</div>
						{/* Find them by the phone number or the Google email they log in with */}
						<div
							className="grid grid-cols-2 gap-1 p-1 mb-3 bg-slate-100 dark:bg-slate-800 rounded-xl"
							role="tablist"
							aria-label={isHindi ? "कैसे ढूँढें" : "Find by"}
						>
							{(["phone", "email"] as const).map((by) => (
								<button
									key={by}
									type="button"
									role="tab"
									aria-selected={sendLinkBy === by}
									onClick={() => setSendLinkBy(by)}
									className={`min-h-touch flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
										sendLinkBy === by
											? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm"
											: "text-slate-500 dark:text-slate-400"
									}`}
								>
									{by === "phone" ? <Phone size={13} /> : <Mail size={13} />}
									{by === "phone"
										? isHindi
											? "फ़ोन नंबर"
											: "Phone number"
										: isHindi
											? "ईमेल (Google)"
											: "Email (Google)"}
								</button>
							))}
						</div>
						<p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
							{sendLinkBy === "phone"
								? isHindi
									? "उनका फ़ोन नंबर डालें — जिससे वे लॉगिन करते हैं, या जो उन्होंने अपनी प्रोफाइल में लिखा है। उन्हें अपनी प्रोफाइल में अनुरोध मिलेगा।"
									: "Enter their phone number — the one they log in with, or the one written in their profile. They will receive a request."
								: isHindi
									? "वे जिस Google खाते से ऐप में लॉगिन करते हैं, उसका ईमेल डालें। उन्हें अपनी प्रोफाइल में अनुरोध मिलेगा।"
									: "Enter the email of the Google account they log in to the app with. They will receive a request."}
						</p>
						{sendLinkBy === "phone" ? (
							<div className="flex gap-2 mb-4">
								<span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
									+91
								</span>
								<input
									type="tel"
									value={sendLinkPhone.replace(/^\+91/, "")}
									onChange={(e) => {
										setSendLinkPhone(
											`+91${e.target.value.replace(/\D/g, "").slice(0, 10)}`,
										);
									}}
									placeholder={isHindi ? "10 अंक डालें" : "Enter 10 digits"}
									maxLength={10}
									inputMode="numeric"
									aria-label={isHindi ? "फ़ोन नंबर" : "Phone number"}
									className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-400 transition"
								/>
							</div>
						) : (
							<div className="mb-4">
								<input
									type="email"
									value={sendLinkEmail}
									onChange={(e) => setSendLinkEmail(e.target.value.slice(0, 254))}
									placeholder="name@gmail.com"
									inputMode="email"
									autoComplete="off"
									autoCapitalize="none"
									spellCheck={false}
									aria-label={isHindi ? "ईमेल" : "Email"}
									className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-blue-400 transition"
								/>
							</div>
						)}
						<div className="mb-4">
							<RelationPicker
								value={sendLinkRelation}
								onChange={setSendLinkRelation}
								isHindi={isHindi}
								accent="blue"
								label={
									isHindi ? "ये आपके क्या लगते हैं?" : "How are they related to you?"
								}
							/>
						</div>
						<button
							type="button"
							onClick={async () => {
								if (!sendLinkReady) return;
								setSendLinkLoading(true);
								const result = await sendFamilyLinkRequest(
									sendLinkBy === "email" ? "" : sendLinkPhone,
									normalizeRelation(sendLinkRelation),
									undefined,
									sendLinkBy === "email" ? sendLinkEmail.trim() : undefined,
								);
								setSendLinkLoading(false);
								if (result.success) {
									setShowSendLinkModal(false);
									setSendLinkPhone("+91");
									setSendLinkEmail("");
									setSendLinkRelation("");
									showToast(
										isHindi ? "अनुरोध भेज दिया गया ✅" : "Request sent ✅",
										"success",
									);
								} else {
									showToast(
										result.error || (isHindi ? "त्रुटि हुई" : "Error occurred"),
										"error",
									);
								}
							}}
							disabled={sendLinkLoading || !sendLinkReady}
							className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95 flex items-center justify-center gap-2"
						>
							{sendLinkLoading ? (
								<Loader2 size={18} className="animate-spin" />
							) : (
								<Users size={18} />
							)}
							{sendLinkLoading
								? isHindi
									? "खोज रहे हैं..."
									: "Searching..."
								: isHindi
									? "अनुरोध भेजें"
									: "Send Request"}
						</button>
						<p className="text-[10px] text-slate-400 dark:text-ink-400 text-center mt-3">
							{isHindi
								? "नोट: उन्हें स्वीकार करना होगा। स्वीकृति के बाद वे आपके परिवार में जुड़ जाएंगे।"
								: "Note: They must accept the request. After acceptance, they will be linked to your family."}
						</p>
					</div>
				</div>
			)}

			{/* ═══ ACCEPT LINK REQUEST SHEET ═══ */}
			{acceptTarget && (
				<div
					className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-4"
					onClick={closeAcceptSheet}
				>
					<div
						className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-2 gap-3">
							<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 min-w-0">
								<CheckCircle size={18} className="text-emerald-500 shrink-0" />
								<span className="truncate">
									{acceptTarget.fromUserName ||
										(isHindi ? "परिवार अनुरोध" : "Family request")}
								</span>
							</h3>
							<button
								type="button"
								onClick={closeAcceptSheet}
								aria-label={isHindi ? "बंद करें" : "Close"}
								className="text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
							>
								<X size={20} />
							</button>
						</div>
						<p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
							{acceptTarget.fromRelation
								? isHindi
									? `इन्होंने आपको अपना "${getRelationLabel(acceptTarget.fromRelation, true)}" बताया है। ये आपके क्या लगते हैं? (वैकल्पिक)`
									: `They added you as their ${getRelationLabel(acceptTarget.fromRelation, false)}. How are they related to you? (optional)`
								: isHindi
									? "ये आपके क्या लगते हैं? (वैकल्पिक)"
									: "How are they related to you? (optional)"}
						</p>
						<RelationPicker
							value={acceptRelation}
							onChange={setAcceptRelation}
							isHindi={isHindi}
							accent="blue"
							suggestions={suggestInverseRelations(
								acceptTarget.fromRelation,
								acceptTarget.fromUserGender,
							)}
						/>
						<button
							type="button"
							disabled={isRespondingToRequest === acceptTarget.id}
							onClick={async () => {
								const ok = await handleRespondToRequest(
									acceptTarget.id,
									true,
									acceptRelation,
								);
								if (ok) {
									// Ask about the rest of the family they bring along.
									helperAfterAcceptRef.current = acceptTarget.fromUserId || null;
									closeAcceptSheet();
								}
							}}
							className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95 flex items-center justify-center gap-2"
						>
							{isRespondingToRequest === acceptTarget.id ? (
								<Loader2 size={18} className="animate-spin" />
							) : (
								<CheckCircle size={18} />
							)}
							{isHindi ? "स्वीकार करें" : "Accept"}
						</button>
					</div>
				</div>
			)}

			{/* ═══ FAMILY TREE ═══ */}
			{showFamilyTree && (
				<FamilyTreeView
					isHindi={isHindi}
					me={{
						name: formData.realName || formData.dikshaName || "",
						photoURL: photoPreview || profile?.photoURL,
					}}
					people={(() => {
						// Everyone once: a hand-added member who is also linked shows
						// as the linked account (lending it their relation and photo
						// if it has none); one entered twice by hand shows once.
						const myRelations = profile?.linkedFamilyRelations;
						const twinOf = new Map<string, FamilyMember>();
						const handAdded = formData.familyMembers.filter((m) => {
							if (repeatedMemberIds.has(m.id)) return false;
							const twin = findLinkedTwin(m, linkedMembersData, myRelations);
							if (twin && !twinOf.has(twin.id)) {
								twinOf.set(twin.id, m);
								return false;
							}
							return true;
						});
						return [
							...handAdded.map((m) => ({
								key: `m_${m.id}`,
								name: m.realName,
								photoURL: m.photoURL,
								relation: m.relation,
								linked: false,
							})),
							// Added by hand by a linked relative: under that relative,
							// placed by the relation worked out through them.
							...sharedPeople.map((s) => ({
								key: s.key,
								name: s.member.realName || s.member.dikshaName || "",
								photoURL: s.member.photoURL,
								linked: false,
								via: `l_${s.owners[0].id}`,
								suggested: s.relation || s.suggestions[0],
							})),
							...linkedMembersData.map((m) => {
								const viaUid = profile?.linkedFamilyVia?.[m.id];
								const twin = twinOf.get(m.id);
								return {
									key: `l_${m.id}`,
									name: m.realName || m.dikshaName,
									photoURL: m.photoURL || twin?.photoURL,
									relation: myRelations?.[m.id],
									linked: true,
									via: viaUid ? `l_${viaUid}` : undefined,
									// Placed by a likely relation until one is set — first
									// the one given to their hand-added double.
									suggested: myRelations?.[m.id]
										? undefined
										: twin?.relation ||
											relationSuggestionsFor(
												m.id,
												linkedMembersData,
												myRelations,
												viaUid,
											)[0],
								};
							}),
						];
					})()}
					onClose={closeFamilyTree}
					onPersonTap={(person) => {
						// The tree covers the whole screen: close it, then open the
						// relation sheet (linked) or the member form (added by hand).
						if (person.key.startsWith("l_")) {
							const uid = person.key.slice(2);
							closeFamilyTree();
							openRelationEditor(uid, person.name);
						} else if (person.key.startsWith("s_")) {
							// Added by a linked relative: only they can change it.
							const owners = sharedPeople
								.find((s) => s.key === person.key)
								?.owners.map((o) => o.name)
								.join(", ");
							showToast(
								isHindi
									? `${owners || "परिवार"} ने जोड़ा है — इन्हें वही बदल सकते हैं।`
									: `Added by ${owners || "your family"} — only they can change this.`,
								"info",
							);
						} else if (!isApprovedProfile) {
							const idx = formData.familyMembers.findIndex(
								(m) => `m_${m.id}` === person.key,
							);
							if (idx >= 0) {
								closeFamilyTree();
								openEditMember(idx);
							}
						}
					}}
				/>
			)}

			{/* ═══ FIND A HAND-ADDED MEMBER ON THE APP ═══ */}
			{findTarget && (
				<div
					className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-4"
					onClick={closeFindSheet}
				>
					<div
						className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm max-h-[80vh] overflow-y-auto p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-2 gap-3">
							<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 min-w-0">
								<Search size={18} className="text-blue-500 shrink-0" />
								<span className="truncate">{findTarget.realName}</span>
							</h3>
							<button
								type="button"
								onClick={closeFindSheet}
								aria-label={isHindi ? "बंद करें" : "Close"}
								className="text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
							>
								<X size={20} />
							</button>
						</div>
						<p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
							{isHindi
								? "एक ही दीक्षा तिथि और गुरु वाले मिलते-जुलते नाम। सही व्यक्ति को अनुरोध भेजें — उनके स्वीकार करने पर खाते जुड़ जाएँगे।"
								: "Similar names with the same diksha date and guru. Send a request to the right person — the accounts link once they accept."}
						</p>
						{findResults === null ? (
							<div className="flex justify-center py-6">
								<Loader2 className="animate-spin text-blue-500" size={24} />
							</div>
						) : findResults.length === 0 ? (
							<p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
								{isHindi
									? "ऐप पर कोई मिलता-जुलता भक्त नहीं मिला। फ़ोन नंबर से लिंक करके देखें।"
									: "No matching devotee found on the app. Try linking by phone number."}
							</p>
						) : (
							<div className="space-y-2">
								{findResults.map((r) => (
									<div
										key={r.id}
										className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3"
									>
										<div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
											{r.photoURL ? (
												<ThumbImg
													src={r.photoURL}
													alt=""
													className="w-full h-full object-cover"
												/>
											) : (
												<User size={18} className="text-slate-400" />
											)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-bold text-slate-800 dark:text-white truncate">
												{r.realName || r.dikshaName}
											</p>
											{r.dikshaName && r.dikshaName !== r.realName && (
												<p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
													{r.dikshaName}
												</p>
											)}
										</div>
										{r.alreadyLinked ? (
											<span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
												{isHindi ? "✓ लिंक्ड" : "✓ Linked"}
											</span>
										) : (
											<button
												type="button"
												disabled={!!findSendingId}
												onClick={() => sendLinkToFound(r.id)}
												className="shrink-0 min-h-touch px-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
											>
												{findSendingId === r.id ? (
													<Loader2 size={14} className="animate-spin" />
												) : (
													<Link2 size={14} />
												)}
												{isHindi ? "अनुरोध भेजें" : "Send request"}
											</button>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			{/* ═══ COMPLETE RELATIONS HELPER ═══ */}
			{showRelationHelper && (
				<RelationHelper
					isHindi={isHindi}
					members={linkedMembersData}
					myRelations={profile?.linkedFamilyRelations}
					via={profile?.linkedFamilyVia}
					myGender={profile?.gender}
					onSaveGender={saveGender}
					onSave={saveMyRelations}
					onEdit={(id) => {
						const m = linkedMembersData.find((x) => x.id === id);
						// Same commit: the shared back-button entry just carries over.
						closeRelationHelper();
						openRelationEditor(id, m?.realName || m?.dikshaName || "");
					}}
					onClose={closeRelationHelper}
				/>
			)}

			{/* ═══ LINKED MEMBER RELATION SHEET ═══ */}
			{relationEditTarget && (
				<div
					className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-4"
					onClick={closeRelationEditor}
				>
					<div
						className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-2 gap-3">
							<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 min-w-0">
								<Users size={18} className="text-blue-500 shrink-0" />
								<span className="truncate">
									{relationEditTarget.name || (isHindi ? "सदस्य" : "Member")}
								</span>
							</h3>
							<button
								type="button"
								onClick={closeRelationEditor}
								aria-label={isHindi ? "बंद करें" : "Close"}
								className="text-slate-400 dark:text-ink-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
							>
								<X size={20} />
							</button>
						</div>
						<p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
							{isHindi
								? "ये आपके क्या लगते हैं? अगर पक्का पता हो (जैसे आप पुरुष हैं और ये बहन), तो उनकी तरफ़ आपका रिश्ता अपने-आप भर जाएगा — वे उसे बदल सकते हैं।"
								: "How are they related to you? When it's certain (you're male, they're your sister), their side is filled in for you — they can change it."}
						</p>
						<RelationPicker
							value={relationEditValue}
							onChange={setRelationEditValue}
							isHindi={isHindi}
							accent="blue"
							suggestions={relationSuggestionsFor(
								relationEditTarget.uid,
								linkedMembersData,
								profile?.linkedFamilyRelations,
								profile?.linkedFamilyVia?.[relationEditTarget.uid],
							)}
						/>
						<button
							type="button"
							onClick={handleSaveLinkedRelation}
							disabled={relationSaving}
							className="mt-4 w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95 flex items-center justify-center gap-2"
						>
							{relationSaving ? (
								<Loader2 size={18} className="animate-spin" />
							) : (
								<CheckCircle size={18} />
							)}
							{isHindi ? "सहेजें" : "Save"}
						</button>
					</div>
				</div>
			)}

			{/* ═══ PHONE LOGIN MODAL ═══ */}
			{showPhoneLoginModal && (
				<div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-4">
					<div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
						<div className="flex items-center justify-between mb-5">
							<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
								<Phone size={18} className="text-pink-500" />
								{isHindi ? "Phone से लॉगिन" : "Login with Phone"}
							</h3>
							<button
								onClick={closePhoneLoginModal}
								className="text-slate-400 dark:text-ink-400 hover:text-slate-600 transition"
							>
								<X size={20} />
							</button>
						</div>
						{!loginOtpSent ? (
							<div className="space-y-3">
								<p className="text-xs text-slate-500 dark:text-slate-400">
									{isHindi
										? "अपना फोन नंबर दर्ज करें, OTP से वेरिफाई करें।"
										: "Enter your phone number and verify via OTP."}
								</p>
								<div className="flex gap-2">
									<span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
										+91
									</span>
									<input
										type="tel"
										value={loginPhone.replace(/^\+91/, "")}
										onChange={(e) =>
											setLoginPhone(
												`+91${e.target.value.replace(/\D/g, "").slice(0, 10)}`,
											)
										}
										placeholder={isHindi ? "10 अंक डालें" : "Enter 10 digits"}
										maxLength={10}
										className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-pink-400 transition"
									/>
								</div>
								<button
									onClick={async () => {
										if (loginPhone.length < 13) return;
										setLoginOtpLoading(true);
										const ok = await sendOtp(loginPhone);
										if (ok) {
											setLoginOtpCode("");
											setLoginOtpSent(true);
											setLoginOtpTimer(30);
										}
										setLoginOtpLoading(false);
									}}
									disabled={loginOtpLoading || loginPhone.length < 13}
									className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95"
								>
									{loginOtpLoading ? (
										<Loader2 size={18} className="animate-spin mx-auto" />
									) : isHindi ? (
										"OTP भेजें"
									) : (
										"Send OTP"
									)}
								</button>
							</div>
						) : (
							<div className="space-y-3">
								<p className="text-xs text-center text-slate-500 dark:text-slate-400">
									{isHindi ? "OTP भेजा गया:" : "OTP sent to:"}{" "}
									<span className="font-bold text-slate-700 dark:text-slate-200 tracking-wider">
										{maskPhone(loginPhone)}
									</span>
									<button
										onClick={() => {
											setLoginOtpCode("");
											setLoginOtpTimer(0);
											setLoginOtpSent(false);
										}}
										className="ml-2 text-pink-500 font-bold underline text-xs"
									>
										{isHindi ? "बदलें" : "Change"}
									</button>
								</p>
								<input
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									autoComplete="one-time-code"
									value={loginOtpCode}
									onChange={(e) => {
										const nextOtp = e.target.value
											.replace(/\D/g, "")
											.slice(0, 6);
										setLoginOtpCode(nextOtp);
										// Typing or pasting all six digits should not require
										// a second tap on the Verify button.
										if (
											nextOtp.length === 6 &&
											!loginOtpLoading &&
											!loginOtpVerificationInFlightRef.current
										) {
											void (async () => {
												loginOtpVerificationInFlightRef.current = true;
												setLoginOtpLoading(true);
												const ok = await verifyOtp(nextOtp);
												setLoginOtpLoading(false);
												loginOtpVerificationInFlightRef.current = false;
												if (ok) {
													closePhoneLoginModal();
													setLoginOtpCode("");
													setLoginOtpSent(false);
												}
											})();
										}
									}}
									placeholder="6-digit OTP"
									className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-bold tracking-widest text-center text-slate-800 dark:text-white outline-none focus:border-emerald-400 transition"
								/>
								<button
									onClick={async () => {
										if (loginOtpVerificationInFlightRef.current) return;
										loginOtpVerificationInFlightRef.current = true;
										setLoginOtpLoading(true);
										const ok = await verifyOtp(loginOtpCode);
										setLoginOtpLoading(false);
										loginOtpVerificationInFlightRef.current = false;
										if (ok) {
											closePhoneLoginModal();
											setLoginOtpCode("");
											setLoginOtpSent(false);
										} else
											showToast(
												isHindi
													? "गलत OTP, दोबारा कोशिश करें"
													: "Wrong OTP, try again",
												"error",
											);
									}}
									disabled={loginOtpLoading || loginOtpCode.length < 6}
									className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95"
								>
									{loginOtpLoading ? (
										<Loader2 size={18} className="animate-spin mx-auto" />
									) : isHindi ? (
										"वेरिफाई करें"
									) : (
										"Verify & Login"
									)}
								</button>
								{/* Resend OTP */}
								<div className="flex items-center justify-center">
									{loginOtpTimer > 0 ? (
										<p className="text-xs text-slate-400 dark:text-ink-400">
											{isHindi
												? `पुन: भेजें ${loginOtpTimer}s में`
												: `Resend in ${loginOtpTimer}s`}
										</p>
									) : (
										<button
											type="button"
											onClick={async () => {
												setLoginOtpLoading(true);
												const ok = await sendOtp(loginPhone);
												if (ok) {
													setLoginOtpCode("");
													setLoginOtpTimer(30);
												}
												setLoginOtpLoading(false);
											}}
											disabled={loginOtpLoading}
											className="text-xs font-bold text-pink-500 hover:text-pink-600 disabled:opacity-50 transition underline"
										>
											{isHindi ? "मुझे OTP फिर से भेजें" : "Resend OTP"}
										</button>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ═══ LINK PHONE MODAL ═══ */}
			{showLinkPhoneModal && (
				<div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-4">
					<div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
						<div className="flex items-center justify-between mb-5">
							<h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
								<Phone size={18} className="text-pink-500" />
								{isHindi ? "Phone Number जोड़ें" : "Link Phone Number"}
							</h3>
							<button
								onClick={() => setShowLinkPhoneModal(false)}
								className="text-slate-400 dark:text-ink-400 hover:text-slate-600 transition"
							>
								<X size={20} />
							</button>
						</div>
						{!linkOtpSent ? (
							<div className="space-y-3">
								<p className="text-xs text-slate-500 dark:text-slate-400">
									{isHindi
										? "OTP se phone number verify karein aur is account se link karein."
										: "Verify your phone number via OTP to link it with this account."}
								</p>
								<div className="flex gap-2">
									<span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
										+91
									</span>
									<input
										type="tel"
										value={linkPhone.replace(/^\+91/, "")}
										onChange={(e) =>
											setLinkPhone(
												`+91${e.target.value.replace(/\D/g, "").slice(0, 10)}`,
											)
										}
										placeholder="10 अंक डालें"
										maxLength={10}
										className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-pink-400 transition"
									/>
								</div>
								<button
									onClick={async () => {
										if (linkPhone.length < 13) return;
										setLinkLoading(true);
										const ok = await sendLinkOtp(linkPhone);
										if (ok) {
											setLinkOtpCode("");
											setLinkOtpSent(true);
											setOtpResendTimer(30);
										}
										setLinkLoading(false);
									}}
									disabled={linkLoading || linkPhone.length < 13}
									className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95"
								>
									{linkLoading ? (
										<Loader2 size={18} className="animate-spin mx-auto" />
									) : isHindi ? (
										"OTP भेजें"
									) : (
										"Send OTP"
									)}
								</button>
							</div>
						) : (
							<div className="space-y-3">
								{/* ═══ NEW: Masked phone display ═══ */}
								<p className="text-xs text-center text-slate-500 dark:text-slate-400">
									{isHindi ? "OTP भेजा गया:" : "OTP sent to:"}{" "}
									<span className="font-bold text-slate-700 dark:text-slate-200 tracking-wider">
										{maskPhone(linkPhone)}
									</span>
									<button
										onClick={() => {
											setLinkOtpCode("");
											setOtpResendTimer(0);
											setLinkOtpSent(false);
										}}
										className="ml-2 text-pink-500 font-bold underline text-xs"
									>
										{isHindi ? "बदलें" : "Change"}
									</button>
								</p>
								<input
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									autoComplete="one-time-code"
									value={linkOtpCode}
									onChange={(e) => {
										const nextOtp = e.target.value
											.replace(/\D/g, "")
											.slice(0, 6);
										setLinkOtpCode(nextOtp);
										if (
											nextOtp.length === 6 &&
											!linkLoading &&
											!linkOtpVerificationInFlightRef.current
										) {
											void (async () => {
												linkOtpVerificationInFlightRef.current = true;
												setLinkLoading(true);
												const result = await verifyAndLinkOtp(nextOtp);
												setLinkLoading(false);
												linkOtpVerificationInFlightRef.current = false;
												if (result.success) {
													setShowLinkPhoneModal(false);
													setLinkOtpCode("");
													setLinkOtpSent(false);
												} else if (result.conflict) {
													const defs: Record<string, "current" | "other"> = {};
													[
														"realName",
														"dikshaName",
														"guruName",
														"dikshaDate",
														"mandalId",
														"personalExperience",
														"photoURL",
													].forEach((field) => {
														defs[field] = "current";
													});
													setMergeKeep(defs);
													setConflictData(result.conflict);
													setShowLinkPhoneModal(false);
												}
											})();
										}
									}}
									placeholder="6-digit OTP"
									className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-bold tracking-widest text-center text-slate-800 dark:text-white outline-none focus:border-emerald-400 transition"
								/>
								<button
									onClick={async () => {
										if (linkOtpVerificationInFlightRef.current) return;
										linkOtpVerificationInFlightRef.current = true;
										setLinkLoading(true);
										const result = await verifyAndLinkOtp(linkOtpCode);
										setLinkLoading(false);
										linkOtpVerificationInFlightRef.current = false;
										if (result.success) {
											setShowLinkPhoneModal(false);
											setLinkOtpCode("");
											setLinkOtpSent(false);
										} else if (result.conflict) {
											const defs: Record<string, "current" | "other"> = {};
											[
												"realName",
												"dikshaName",
												"guruName",
												"dikshaDate",
												"mandalId",
												"personalExperience",
												"photoURL",
											].forEach((f) => {
												defs[f] = "current";
											});
											setMergeKeep(defs);
											setConflictData(result.conflict);
											setShowLinkPhoneModal(false);
										}
									}}
									disabled={linkLoading || linkOtpCode.length < 6}
									className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95"
								>
									{linkLoading ? (
										<Loader2 size={18} className="animate-spin mx-auto" />
									) : (
										"Verify & Link"
									)}
								</button>

								{/* ═══ NEW: Resend OTP countdown ═══ */}
								<div className="flex items-center justify-center">
									{otpResendTimer > 0 ? (
										<p className="text-xs text-slate-400 dark:text-ink-400">
											{isHindi
												? `पुन: भेजें ${otpResendTimer}s में`
												: `Resend in ${otpResendTimer}s`}
										</p>
									) : (
										<button
											type="button"
											onClick={async () => {
												setLinkLoading(true);
												const ok = await sendLinkOtp(linkPhone);
												if (ok) {
													setLinkOtpCode("");
													setOtpResendTimer(30);
												}
												setLinkLoading(false);
											}}
											disabled={linkLoading}
											className="text-xs font-bold text-pink-500 hover:text-pink-600 disabled:opacity-50 transition underline"
										>
											{isHindi ? "मुझे OTP फिर से भेजें" : "Resend OTP"}
										</button>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ═══ MERGE CONFLICT DIALOG ═══ */}
			{conflictData &&
				(() => {
					const cur = conflictData.currentProfile;
					const oth = conflictData.otherProfile;
					type FieldDef = {
						key: keyof UserProfile;
						label: string;
						labelHi: string;
					};
					const fields: FieldDef[] = [
						{ key: "realName", label: "Name", labelHi: "नाम" },
						{ key: "dikshaName", label: "Diksha Name", labelHi: "दीक्षित नाम" },
						{ key: "guruName", label: "Guru", labelHi: "गुरु" },
						{ key: "dikshaDate", label: "Diksha Date", labelHi: "दीक्षा तिथि" },
						{ key: "mandalId", label: "Mandal", labelHi: "मंडल" },
						{ key: "personalExperience", label: "Experience", labelHi: "अनुभव" },
						{ key: "photoURL", label: "Photo", labelHi: "फोटो" },
					];
					return (
						<div className="fixed inset-0 z-[300] bg-black/70 flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
							<div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom duration-300 my-2">
								<div className="p-5 border-b border-slate-100 dark:border-slate-800">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-full flex items-center justify-center">
											<AlertTriangle size={20} className="text-amber-500" />
										</div>
										<div>
											<h3 className="font-bold text-slate-800 dark:text-white text-base">
												{isHindi ? "दो अलग Accounts मिले" : "Two Accounts Found"}
											</h3>
											<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
												{isHindi
													? "कौन सी details रखनी हैं? एक-एक field चुनें।"
													: "Choose which details to keep for each field."}
											</p>
										</div>
									</div>
								</div>
								<div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-5 pt-4 pb-2">
									<p className="text-[10px] font-bold text-slate-400 dark:text-ink-400 uppercase tracking-wider">
										Field
									</p>
									<p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider text-center">
										{isHindi ? "मेरा खाता" : "My Account"}
									</p>
									<p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider text-center">
										{isHindi ? "दूसरा खाता" : "Other Account"}
									</p>
								</div>
								<div className="px-5 pb-4 space-y-2 max-h-[50vh] overflow-y-auto">
									{fields.map(({ key, label, labelHi }) => {
										const curVal = String(cur[key] || "");
										const othVal = String(oth[key] || "");
										const isSame = curVal === othVal || (!curVal && !othVal);
										const isPhoto = key === "photoURL";
										return (
											<div
												key={key}
												className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center py-2 border-b border-slate-50 dark:border-slate-800/50 last:border-0"
											>
												<p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
													{isHindi ? labelHi : label}
												</p>
												{isSame ? (
													<div className="col-span-2 text-center">
														<span className="text-[10px] text-slate-400 dark:text-ink-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
															{isHindi ? "दोनों समान" : "Same"}{" "}
															{curVal
																? `· ${isPhoto ? "📷" : curVal.slice(0, 18)}`
																: "· खाली"}
														</span>
													</div>
												) : (
													<>
														<button
															type="button"
															onClick={() =>
																setMergeKeep((p) => ({
																	...p,
																	[key]: "current",
																}))
															}
															className={`rounded-xl px-2 py-2 text-[10px] text-center transition border ${mergeKeep[key] === "current" ? "border-blue-400 bg-blue-50 dark:bg-blue-500/10 font-bold text-blue-700 dark:text-blue-400" : "border-slate-200 dark:border-slate-700 text-slate-500"}`}
														>
															{isPhoto ? (curVal ? "📷" : "—") : curVal || "—"}
															{mergeKeep[key] === "current" && (
																<span className="block text-[9px] mt-0.5">
																	✓
																</span>
															)}
														</button>
														<button
															type="button"
															onClick={() =>
																setMergeKeep((p) => ({ ...p, [key]: "other" }))
															}
															className={`rounded-xl px-2 py-2 text-[10px] text-center transition border ${mergeKeep[key] === "other" ? "border-purple-400 bg-purple-50 dark:bg-purple-500/10 font-bold text-purple-700 dark:text-purple-400" : "border-slate-200 dark:border-slate-700 text-slate-500"}`}
														>
															{isPhoto ? (othVal ? "📷" : "—") : othVal || "—"}
															{mergeKeep[key] === "other" && (
																<span className="block text-[9px] mt-0.5">
																	✓
																</span>
															)}
														</button>
													</>
												)}
											</div>
										);
									})}
								</div>
								<div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
									<div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3">
										<p className="text-[11px] text-amber-700 dark:text-amber-400">
											⚠️{" "}
											{isHindi
												? "Merge ke baad dusra account permanently delete ho jayega."
												: "After merging, the other account will be permanently deleted."}
										</p>
									</div>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => setConflictData(null)}
											className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl transition active:scale-95"
										>
											{isHindi ? "रद्द करें" : "Cancel"}
										</button>
										<button
											type="button"
											onClick={async () => {
												const curP = conflictData.currentProfile;
												const othP = conflictData.otherProfile;
												const keepData: Record<string, unknown> = {};
												fields.forEach(({ key }) => {
													const cv = curP[key];
													const ov = othP[key];
													const same =
														String(cv || "") === String(ov || "") ||
														(!cv && !ov);
													keepData[key as string] = same
														? cv
														: mergeKeep[key] === "other"
															? ov
															: cv;
												});
												const ok = await resolveAccountMerge(
													conflictData,
													keepData as Partial<UserProfile>,
												);
												if (ok) setConflictData(null);
											}}
											className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-xl transition active:scale-95"
										>
											{isHindi ? "Accounts Merge करें" : "Merge Accounts"}
										</button>
									</div>
								</div>
							</div>
						</div>
					);
				})()}

			{/* ═══ NEW: Onboarding Wizard (new users only) ═══ */}
			{showOnboarding && (
				<OnboardingWizard
					isHindi={isHindi}
					formData={{
						realName: formData.realName,
						dikshaName: formData.dikshaName,
						guruSelection: formData.guruSelection,
						guruNameCustom: formData.guruNameCustom,
						dikshaDate: formData.dikshaDate,
						mandalId: formData.mandalId,
						isCustomMandal: formData.isCustomMandal,
						phoneNumber: formData.phoneNumber,
					}}
					mandalList={MANDAL_LIST}
					guruOptions={GURU_OPTIONS}
					onFormChange={(updates) =>
						setFormData((prev) => ({ ...prev, ...updates }))
					}
					onPhotoSelect={handlePhotoSelect}
					onComplete={handleOnboardingComplete}
					onDismiss={handleOnboardingDismiss}
					backHandlerRef={onboardingBackRef}
					photoPreview={photoPreview}
					isUploading={isUploading}
				/>
			)}

			{/* ═══ NEW: Profile Preview Modal ═══ */}
			{showPreviewModal && (
				<ProfilePreviewModal
					isHindi={isHindi}
					profile={profile}
					photoPreview={photoPreview}
					formData={{
						realName: formData.realName,
						dikshaName: formData.dikshaName,
						guruSelection: formData.guruSelection,
						guruNameCustom: formData.guruNameCustom,
						dikshaDate: formData.dikshaDate,
						mandalId: formData.mandalId,
						personalExperience: formData.personalExperience,
						familyMembers: formData.familyMembers,
						phoneNumber: formData.phoneNumber,
					}}
					guruDisplayName={guruDisplayName}
					mandalDisplayName={mandalDisplayName}
					onClose={() => setShowPreviewModal(false)}
				/>
			)}

			{/* ═══ NEW: Save Success Animation ═══ */}
			{showSaveSuccess && (
				<SuccessAnimation
					isHindi={isHindi}
					onDone={() => setShowSaveSuccess(false)}
				/>
			)}
		</>
	);
};

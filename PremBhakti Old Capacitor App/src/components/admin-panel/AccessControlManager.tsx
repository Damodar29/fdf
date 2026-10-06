import { getApps, initializeApp } from "firebase/app";
import {
	createUserWithEmailAndPassword,
	getAuth,
	sendPasswordResetEmail,
} from "firebase/auth";
import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	setDoc,
} from "firebase/firestore";
import {
	CheckSquare,
	Edit2,
	Key,
	Mail,
	Plus,
	Save,
	Settings,
	Shield,
	Square,
	Trash2,
	Users,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "../../../services/firebase";
import { SUPER_ADMIN_EMAILS } from "../../../src/constants/admins";
import { useAdminBack } from "../../hooks/useAdminBack";
import { usePopupBackHandler } from "../../hooks/usePopupBackHandler";
import { type AdminRole, MANDAL_LIST } from "../../types/mandal";

const AVAILABLE_PERMISSIONS = [
	{ id: "local_data", label: "Local Data (Bhajans, Books, Lectures)" },
	{ id: "info_screen", label: "Information Screen" },
	{ id: "social_media", label: "Social Media Live" },
	{ id: "banners", label: "Banner Manager" },
	{ id: "gallery_activity_ui", label: "Gallery and Activity UI" },
	{ id: "gallery_editor", label: "Gallery Editor" },
	{ id: "notification_sender", label: "Notification Sender" },
];

const MANDAL_PERMISSIONS = [
	{ id: "weekly", label: "Weekly Program" },
	{ id: "activity", label: "Activity Gallery" },
	{ id: "darshan", label: "Darshan" },
	{ id: "timings", label: "Temple Timings" },
];

export const AccessControlManager: React.FC = () => {
	const [roles, setRoles] = useState<AdminRole[]>([]);
	const [loading, setLoading] = useState(true);
	const [newEmail, setNewEmail] = useState("");
	const [roleType, setRoleType] = useState<"mandal" | "custom">("mandal");
	const [mandals, setMandals] = useState<
		{ id: string; name: string; email?: string }[]
	>([...MANDAL_LIST]);
	const [newMandalId, setNewMandalId] = useState(
		[...MANDAL_LIST].reverse()[0].id,
	);
	const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [editingEmail, setEditingEmail] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<{
		text: string;
		type: "success" | "error";
	} | null>(null);
	const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

	// New states for User Management tab
	const [activeTab, setActiveTab] = useState<"roles" | "users">("roles");
	const [newUserEmailAuth, setNewUserEmailAuth] = useState("");
	const [newUserPassword, setNewUserPassword] = useState("");
	const [creatingUser, setCreatingUser] = useState(false);
	const [userToDelete, setUserToDelete] = useState<string | null>(null);
	const [authUsers, setAuthUsers] = useState<string[]>([]);
	const [deletedAuthUsers, setDeletedAuthUsers] = useState<string[]>([]);
	const [showEmailDropdown, setShowEmailDropdown] = useState(false);

	const closeEmailDropdown = usePopupBackHandler(
		showEmailDropdown,
		"email-dropdown",
		() => setShowEmailDropdown(false),
	);
	const closeUserToDelete = usePopupBackHandler(
		!!userToDelete,
		"user-delete",
		() => setUserToDelete(null),
	);
	const closeRoleToDelete = usePopupBackHandler(
		!!roleToDelete,
		"role-delete",
		() => setRoleToDelete(null),
	);
	const emailInputRef = useRef<HTMLInputElement>(null);

	const showToast = (text: string, type: "success" | "error" = "success") => {
		setToastMessage({ text, type });
		setTimeout(() => setToastMessage(null), 3000);
	};

	useEffect(() => {
		const fetchMandals = async () => {
			try {
				const snap = await getDocs(collection(db, "mandals"));
				const firestoreMandals = snap.docs.map((d) => ({
					id: d.id,
					name: d.data().name,
				}));
				const combined: { id: string; name: string; email?: string }[] = [
					...MANDAL_LIST,
				];
				firestoreMandals.forEach((m) => {
					if (!combined.find((x) => x.id === m.id)) {
						combined.push(m);
					}
				});
				setMandals(combined);
				if (!newMandalId) setNewMandalId(combined[combined.length - 1].id);
			} catch (e) {
				console.error("Error fetching mandals:", e);
			}
		};
		fetchMandals();
		fetchRoles();
		fetchAuthUsers();
	}, []);

	const fetchAuthUsers = async () => {
		try {
			const snapshot = await getDocs(collection(db, "auth_users"));
			const active: string[] = [];
			const deleted: string[] = [];
			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.isDeleted) {
					deleted.push(doc.id);
				} else {
					active.push(doc.id);
				}
			});
			setAuthUsers(active);
			setDeletedAuthUsers(deleted);
		} catch (error) {
			console.error("Error fetching auth users:", error);
		}
	};

	const initializeDefaultRoles = async () => {
		const superAdmins = [
			...SUPER_ADMIN_EMAILS,
			"super@cpbs.com",
			"sanatan@cpbs.org",
		];
		const mandalAdmins = [
			"semra@cpbs.com",
			"gaisabaad@cpbs.com",
			"bharatpur@cpbs.com",
			"indore@cpbs.com",
			"khurai@cpbs.com",
			"bhopal@cpbs.com",
			"harrai@cpbs.com",
			"sagar@cpbs.com",
			"damoh@cpbs.com",
			"kota@cpbs.com",
			"jhansi@cpbs.com",
			"nariaoli@cpbs.com",
		];

		try {
			let addedAny = false;

			// Add super admins
			for (const email of superAdmins) {
				const docRef = doc(db, "admin_roles", email);
				const docSnap = await getDoc(docRef);
				if (!docSnap.exists()) {
					await setDoc(docRef, { role: "super" });
					addedAny = true;
				}
			}

			// Add mandal admins
			for (const email of mandalAdmins) {
				const docRef = doc(db, "admin_roles", email);
				const docSnap = await getDoc(docRef);
				if (!docSnap.exists()) {
					await setDoc(docRef, {
						role: "mandal",
						mandalId: email.split("@")[0],
					});
					addedAny = true;
				}
			}

			// Add other defaults
			const notifRef = doc(db, "admin_roles", "notification@cpbs.com");
			if (!(await getDoc(notifRef)).exists()) {
				await setDoc(notifRef, {
					role: "custom",
					permissions: ["notification_sender"],
				});
				addedAny = true;
			}

			const mediaRef = doc(db, "admin_roles", "media@cpbs.com");
			if (!(await getDoc(mediaRef)).exists()) {
				await setDoc(mediaRef, {
					role: "custom",
					permissions: ["social_media", "gallery_editor"],
				});
				addedAny = true;
			}

			if (addedAny) {
				console.log("Initialized missing default roles in Firestore.");
			}
			return addedAny;
		} catch (error) {
			console.error("Error initializing roles:", error);
			return false;
		}
	};

	const fetchRoles = async () => {
		setLoading(true);
		try {
			let snapshot = await getDocs(collection(db, "admin_roles"));

			// If collection is empty, sync defaults automatically
			if (snapshot.empty) {
				console.log("Collection empty, syncing default roles...");
				await initializeDefaultRoles();
				snapshot = await getDocs(collection(db, "admin_roles"));
			}

			const fetchedRoles: AdminRole[] = [];

			snapshot.forEach((doc) => {
				const data = doc.data();
				fetchedRoles.push({
					email: doc.id,
					role: data.role,
					mandalId: data.mandalId,
					permissions: data.permissions,
				} as AdminRole);
			});

			// Sort to keep super admins at top
			fetchedRoles.sort((a, b) => {
				if (a.role === "super" && b.role !== "super") return -1;
				if (a.role !== "super" && b.role === "super") return 1;
				return a.email.localeCompare(b.email);
			});

			setRoles(fetchedRoles);
		} catch (error) {
			console.error("Error fetching roles:", error);
			showToast("Failed to fetch roles from Firebase.", "error");
		}
		setLoading(false);
	};

	const togglePermission = (permId: string) => {
		setSelectedPermissions((prev) =>
			prev.includes(permId)
				? prev.filter((p) => p !== permId)
				: [...prev, permId],
		);
	};

	const handleEditRole = (role: AdminRole) => {
		setEditingEmail(role.email);
		setNewEmail(role.email);
		setRoleType(role.role === "mandal" ? "mandal" : "custom");
		if (role.role === "mandal" && role.mandalId) {
			setNewMandalId(role.mandalId);
			setSelectedPermissions(
				role.permissions || ["weekly", "activity", "darshan", "timings"],
			);
		} else if (role.role === "custom" && role.permissions) {
			setSelectedPermissions(role.permissions);
		} else {
			setSelectedPermissions([]);
		}
		// Scroll to top to see the form
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handleCancelEdit = () => {
		setEditingEmail(null);
		setNewEmail("");
		setRoleType("mandal");
		setNewMandalId([...mandals].reverse()[0]?.id || "");
		setSelectedPermissions([]);
	};
	// Hardware back cancels an open edit (like "Cancel Edit").
	useAdminBack(!!editingEmail, handleCancelEdit);

	const handleRoleTypeChange = (type: "mandal" | "custom") => {
		setRoleType(type);
		if (type === "mandal") {
			setSelectedPermissions(["weekly", "activity", "darshan", "timings"]); // Default all for mandal
		} else {
			setSelectedPermissions([]);
		}
	};

	const handleAddRole = async () => {
		if (!newEmail.trim()) return;
		setSaving(true);
		try {
			const roleData: any = { role: roleType };
			if (roleType === "mandal") {
				roleData.mandalId = newMandalId;
				roleData.permissions = selectedPermissions;
			} else {
				roleData.permissions = selectedPermissions;
			}
			await setDoc(
				doc(db, "admin_roles", newEmail.trim().toLowerCase()),
				roleData,
			);

			// Reset form
			handleCancelEdit();
			fetchRoles();
			showToast(
				`Access ${editingEmail ? "updated" : "granted"} successfully!`,
				"success",
			);
		} catch (error) {
			console.error("Error saving role:", error);
			showToast(
				`Failed to ${editingEmail ? "update" : "grant"} access.`,
				"error",
			);
		}
		setSaving(false);
	};

	const handleRemoveRole = (email: string) => {
		setRoleToDelete(email);
	};

	const confirmRemoveRole = async () => {
		if (!roleToDelete) return;
		try {
			await deleteDoc(doc(db, "admin_roles", roleToDelete));
			if (editingEmail === roleToDelete) {
				handleCancelEdit();
			}
			fetchRoles();
			showToast("Access removed successfully!", "success");
		} catch (error) {
			console.error("Error removing role:", error);
			showToast("Failed to remove access.", "error");
		}
		closeRoleToDelete();
	};

	// --- User & Password Management Functions ---
	const handleCreateFirebaseUser = async () => {
		if (!newUserEmailAuth.trim() || !newUserPassword.trim()) return;
		if (newUserPassword.length < 6) {
			showToast("Password must be at least 6 characters.", "error");
			return;
		}

		setCreatingUser(true);
		try {
			const config = auth.app.options;
			let secondaryApp;
			const apps = getApps();
			secondaryApp = apps.find((a) => a.name === "SecondaryApp");
			if (!secondaryApp) {
				secondaryApp = initializeApp(config, "SecondaryApp");
			}
			const secondaryAuth = getAuth(secondaryApp);

			await createUserWithEmailAndPassword(
				secondaryAuth,
				newUserEmailAuth.trim(),
				newUserPassword,
			);
			await secondaryAuth.signOut(); // Sign out the secondary instance

			// Save to auth_users collection so it appears in the dropdown
			await setDoc(
				doc(db, "auth_users", newUserEmailAuth.trim().toLowerCase()),
				{
					email: newUserEmailAuth.trim().toLowerCase(),
					createdAt: new Date().toISOString(),
				},
			);
			fetchAuthUsers();

			setNewUserEmailAuth("");
			setNewUserPassword("");
			showToast("User created successfully in Firebase Auth!", "success");
		} catch (error: any) {
			console.error("Error creating user:", error);
			showToast(error.message || "Failed to create user.", "error");
		}
		setCreatingUser(false);
	};

	const confirmRemoveAuthUser = async () => {
		if (!userToDelete) return;
		try {
			// Mark as deleted in auth_users collection
			await setDoc(
				doc(db, "auth_users", userToDelete),
				{ isDeleted: true },
				{ merge: true },
			);
			// Also remove their role if they have one
			await deleteDoc(doc(db, "admin_roles", userToDelete));

			fetchAuthUsers();
			fetchRoles();
			showToast("User removed successfully!", "success");
		} catch (error) {
			console.error("Error removing user:", error);
			showToast("Failed to remove user.", "error");
		}
		closeUserToDelete();
	};

	const handleRetainUser = async (email: string) => {
		try {
			await setDoc(
				doc(db, "auth_users", email),
				{ isDeleted: false },
				{ merge: true },
			);
			fetchAuthUsers();
			showToast("User retained successfully!", "success");
		} catch (error) {
			console.error("Error retaining user:", error);
			showToast("Failed to retain user.", "error");
		}
	};

	const knownEmails = Array.from(
		new Set([...authUsers, ...roles.map((r) => r.email)]),
	).sort();
	const availableForGrantEmails = knownEmails.filter(
		(email) => roles.find((r) => r.email === email)?.role !== "super",
	);
	const allManageableEmails = Array.from(
		new Set([...knownEmails, ...deletedAuthUsers]),
	).sort((a, b) => {
		const aDeleted = deletedAuthUsers.includes(a);
		const bDeleted = deletedAuthUsers.includes(b);
		if (aDeleted && !bDeleted) return 1;
		if (!aDeleted && bDeleted) return -1;
		return a.localeCompare(b);
	});

	return (
		<div className="h-full overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right pb-[env(safe-area-inset-bottom)]">
			<div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 gap-4">
					<div className="flex items-center gap-2">
						<Shield className="text-indigo-600" size={20} />
						<h3 className="font-bold text-lg text-slate-800 dark:text-white">
							Access Control
						</h3>
					</div>

					<div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
						<button
							onClick={() => setActiveTab("roles")}
							className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
								activeTab === "roles"
									? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
							}`}
						>
							<Settings size={16} /> Roles
						</button>
						<button
							onClick={() => setActiveTab("users")}
							className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
								activeTab === "users"
									? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
							}`}
						>
							<Users size={16} /> Users & Passwords
						</button>
					</div>
				</div>

				{activeTab === "roles" ? (
					<>
						{/* Add New Role */}
						<div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
							<div className="flex items-center justify-between">
								<h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
									{editingEmail
										? `Edit Access for ${editingEmail}`
										: "Grant Access"}
								</h4>
								{editingEmail && (
									<button
										onClick={handleCancelEdit}
										className="text-xs text-slate-500 dark:text-ink-300 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
									>
										Cancel Edit
									</button>
								)}
							</div>

							<div className="flex gap-4 mb-2">
								<label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
									<input
										type="radio"
										name="roleType"
										checked={roleType === "mandal"}
										onChange={() => handleRoleTypeChange("mandal")}
										className="text-indigo-600"
									/>
									Mandal Admin
								</label>
								<label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
									<input
										type="radio"
										name="roleType"
										checked={roleType === "custom"}
										onChange={() => handleRoleTypeChange("custom")}
										className="text-indigo-600"
									/>
									Custom Admin
								</label>
							</div>

							<div className="flex flex-col sm:flex-row gap-3">
								<div className="flex-1 min-w-0 relative">
									<input
										ref={emailInputRef}
										type="email"
										placeholder="Admin Email (e.g. user@cpbs.com)"
										className="w-full p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50"
										value={newEmail}
										onChange={(e) => {
											setNewEmail(e.target.value);
											setShowEmailDropdown(true);
										}}
										onFocus={() => !editingEmail && setShowEmailDropdown(true)}
										onBlur={() => setTimeout(() => closeEmailDropdown(), 200)}
										disabled={!!editingEmail}
										autoComplete="off"
									/>
									{showEmailDropdown &&
										!editingEmail &&
										availableForGrantEmails.filter((e) =>
											e.toLowerCase().includes(newEmail.toLowerCase()),
										).length > 0 && (
											<div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
												{availableForGrantEmails
													.filter((e) =>
														e.toLowerCase().includes(newEmail.toLowerCase()),
													)
													.map((email) => (
														<div
															key={email}
															className="p-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer truncate"
															onClick={() => {
																setNewEmail(email);
																closeEmailDropdown();
															}}
														>
															{email}
														</div>
													))}
											</div>
										)}
								</div>

								{roleType === "mandal" && (
									<select
										className="flex-1 sm:flex-none sm:w-48 min-w-0 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm truncate"
										value={newMandalId}
										onChange={(e) => setNewMandalId(e.target.value)}
									>
										{[...mandals].reverse().map((m) => (
											<option key={m.id} value={m.id}>
												{m.name}
											</option>
										))}
									</select>
								)}

								<button
									onClick={handleAddRole}
									disabled={
										saving ||
										!newEmail.trim() ||
										selectedPermissions.length === 0
									}
									className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
								>
									{editingEmail ? (
										<>
											<Save size={18} /> Save
										</>
									) : (
										<>
											<Plus size={18} /> Add
										</>
									)}
								</button>
							</div>

							<div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
								<h5 className="text-xs font-bold text-slate-500 dark:text-ink-300 uppercase tracking-wider mb-3">
									Select Permissions{" "}
									{roleType === "mandal" ? "for Mandal Folders" : ""}
								</h5>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{(roleType === "mandal"
										? MANDAL_PERMISSIONS
										: AVAILABLE_PERMISSIONS
									).map((perm) => (
										<button
											key={perm.id}
											onClick={() => togglePermission(perm.id)}
											className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-left"
										>
											{selectedPermissions.includes(perm.id) ? (
												<CheckSquare className="text-indigo-600" size={18} />
											) : (
												<Square
													className="text-slate-400 dark:text-ink-400"
													size={18}
												/>
											)}
											<span className="text-sm text-slate-700 dark:text-slate-300">
												{perm.label}
											</span>
										</button>
									))}
								</div>
							</div>
						</div>

						{/* List Existing Roles */}
						<div>
							<h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3">
								Current Access List
							</h4>
							{loading ? (
								<p className="text-slate-500 dark:text-ink-300 text-sm">
									Loading...
								</p>
							) : roles.length === 0 ? (
								<p className="text-slate-500 dark:text-ink-300 text-sm">
									No custom access granted yet.
								</p>
							) : (
								<div className="space-y-2">
									{roles.map((role) => (
										<div
											key={role.email}
											className={`flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border ${editingEmail === role.email ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200 dark:border-slate-700"} gap-4`}
										>
											<div>
												<div className="font-bold text-sm text-slate-800 dark:text-white">
													{role.email}
												</div>
												<div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1">
													{role.role === "super"
														? "Super Admin"
														: role.role === "mandal"
															? `Mandal Admin: ${mandals.find((m) => m.id === role.mandalId)?.name || role.mandalId}`
															: "Custom Admin"}
												</div>
												{role.role !== "super" && role.permissions && (
													<div className="flex flex-wrap gap-1 mt-2">
														{role.permissions.map((p) => {
															const permLabel =
																role.role === "mandal"
																	? MANDAL_PERMISSIONS.find((mp) => mp.id === p)
																			?.label
																	: AVAILABLE_PERMISSIONS.find(
																			(ap) => ap.id === p,
																		)?.label;
															return (
																<span
																	key={p}
																	className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-1 rounded-full font-medium"
																>
																	{permLabel || p}
																</span>
															);
														})}
													</div>
												)}
											</div>
											{!SUPER_ADMIN_EMAILS.includes(role.email) && (
												<div className="flex items-center gap-2 self-start sm:self-center">
													<button
														onClick={() => handleEditRole(role)}
														className="p-2 text-slate-500 dark:text-ink-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
														title="Edit Role"
													>
														<Edit2 size={18} />
													</button>
													<button
														onClick={() => handleRemoveRole(role.email)}
														className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
														title="Remove Role"
													>
														<Trash2 size={18} />
													</button>
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>

						<div className="text-xs text-slate-500 dark:text-ink-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 mt-4">
							<strong>Note:</strong> Super admins cannot be removed or edited.
							You can edit or remove other admins above.
						</div>
					</>
				) : (
					<div className="space-y-8 animate-in fade-in duration-300">
						{/* Create Firebase User */}
						<div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
							<div>
								<h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
									<Plus size={16} className="text-indigo-600" /> Create New
									Firebase User
								</h4>
								<p className="text-xs text-slate-500 dark:text-ink-300 mt-1">
									If an admin doesn't have a Firebase Authentication account
									yet, create one here before granting them a role.
								</p>
							</div>

							<div className="flex flex-col sm:flex-row gap-3">
								<input
									type="email"
									placeholder="Email Address"
									className="flex-1 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
									value={newUserEmailAuth}
									onChange={(e) => setNewUserEmailAuth(e.target.value)}
								/>
								<input
									type="text"
									placeholder="Temporary Password (min 6 chars)"
									className="flex-1 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
									value={newUserPassword}
									onChange={(e) => setNewUserPassword(e.target.value)}
								/>
								<button
									onClick={handleCreateFirebaseUser}
									disabled={
										creatingUser ||
										!newUserEmailAuth.trim() ||
										newUserPassword.length < 6
									}
									className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
								>
									{creatingUser ? "Creating..." : "Create User"}
								</button>
							</div>
						</div>

						{/* Delete User List */}
						<div>
							<h4 className="font-bold text-sm text-slate-800 dark:text-white mb-3 flex items-center gap-2">
								<Users size={16} className="text-indigo-600" /> Manage Existing
								Users
							</h4>
							<p className="text-xs text-slate-500 dark:text-ink-300 mb-4">
								Delete dummy users from the system. This will remove them from
								the dropdown list and revoke any roles assigned to them.
							</p>

							{loading ? (
								<p className="text-slate-500 dark:text-ink-300 text-sm">
									Loading users...
								</p>
							) : allManageableEmails.length === 0 ? (
								<p className="text-slate-500 dark:text-ink-300 text-sm">
									No users found.
								</p>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{allManageableEmails.map((email) => {
										const role = roles.find((r) => r.email === email);
										const isDeleted = deletedAuthUsers.includes(email);
										return (
											<div
												key={email}
												className={`flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border ${isDeleted ? "border-red-200 dark:border-red-900/30 opacity-75" : "border-slate-200 dark:border-slate-700"}`}
											>
												<div className="overflow-hidden">
													<div
														className={`font-bold text-sm truncate ${isDeleted ? "text-red-500 dark:text-red-400 line-through" : "text-slate-800 dark:text-white"}`}
														title={email}
													>
														{email}
													</div>
													<div className="text-xs text-slate-500 dark:text-ink-300 mt-1">
														{isDeleted
															? "Deleted User"
															: role
																? role.role === "super"
																	? "Super Admin"
																	: role.role === "mandal"
																		? "Mandal Admin"
																		: "Custom Admin"
																: "No Role Assigned"}
													</div>
												</div>
												{isDeleted ? (
													<button
														onClick={() => handleRetainUser(email)}
														className="ml-3 p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors flex-shrink-0 flex items-center gap-2 text-xs font-medium"
														title="Retain User"
													>
														<Save size={14} /> Retain
													</button>
												) : role?.role === "super" ? (
													<div
														className="ml-3 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-lg text-xs font-medium cursor-not-allowed"
														title="Super Admins cannot be deleted"
													>
														Protected
													</div>
												) : (
													<button
														onClick={() => setUserToDelete(email)}
														className="ml-3 p-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg transition-colors flex-shrink-0 flex items-center gap-2 text-xs font-medium"
														title="Delete User"
													>
														<Trash2 size={14} /> Delete
													</button>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Delete Auth User Confirmation Modal */}
			{userToDelete && (
				<div
					className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
					onClick={() => closeUserToDelete()}
				>
					<div
						className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-700"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 mx-auto">
							<Trash2 className="text-red-600 dark:text-red-400" size={24} />
						</div>
						<h3 className="text-xl font-bold text-center text-slate-800 dark:text-white mb-2">
							Delete User?
						</h3>
						<p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-6">
							Are you sure you want to delete <strong>{userToDelete}</strong>?
							This will remove them from the dropdown list and revoke any roles
							assigned to them.
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => closeUserToDelete()}
								className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={() => {
									confirmRemoveAuthUser();
									closeUserToDelete();
								}}
								className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm shadow-red-600/20"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{roleToDelete && (
				<div
					className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
					onClick={() => closeRoleToDelete()}
				>
					<div
						className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
							Remove Access?
						</h3>
						<p className="text-slate-600 dark:text-slate-300 mb-6">
							Are you sure you want to remove access for{" "}
							<strong>{roleToDelete}</strong>? They will no longer be able to
							access the admin panel.
						</p>
						<div className="flex gap-3 justify-end">
							<button
								onClick={() => closeRoleToDelete()}
								className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={() => {
									confirmRemoveRole();
									closeRoleToDelete();
								}}
								className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
							>
								Remove
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Toast Notification */}
			{toastMessage && (
				<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
					<div
						className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
							toastMessage.type === "success"
								? "bg-emerald-500 text-white"
								: "bg-red-500 text-white"
						}`}
					>
						{toastMessage.type === "success" ? (
							<CheckSquare size={18} />
						) : (
							<Square size={18} />
						)}
						<span className="font-medium text-sm">{toastMessage.text}</span>
					</div>
				</div>
			)}
		</div>
	);
};

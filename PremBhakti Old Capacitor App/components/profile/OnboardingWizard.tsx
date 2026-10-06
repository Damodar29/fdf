import {
	ArrowLeft,
	ArrowRight,
	Camera,
	CheckCircle,
	ChevronDown,
	Image as ImageIcon,
	Loader2,
	MapPin,
	Sparkles,
	User,
	Users,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CustomDateInput } from "../ui/CustomDateInput";
import { ThumbImg } from "../ui/ThumbImg";
import { THUMB } from "../../utils/imageThumb";

/* ── Types ── */
type GuruOptionId =
	| "virahi"
	| "chakradhar"
	| "harekrishna"
	| "other"
	| "aspiring";

interface WizardFormData {
	realName: string;
	dikshaName: string;
	guruSelection: GuruOptionId | "";
	guruNameCustom: string;
	dikshaDate: string;
	mandalId: string;
	isCustomMandal: boolean;
	phoneNumber: string;
}

interface MandalItem {
	id: string;
	name: string;
	shortNameEn: string;
	shortNameHi: string;
}

interface GuruOption {
	id: string;
	name: string;
	short: string;
	labelHi: string;
	labelEn: string;
}

interface OnboardingWizardProps {
	isHindi: boolean;
	formData: WizardFormData;
	mandalList: MandalItem[];
	guruOptions: readonly GuruOption[];
	onFormChange: (updates: Partial<WizardFormData>) => void;
	onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onComplete: () => void;
	onDismiss: () => void;
	/**
	 * Bug #1 fix: ProfileScreen owns this wizard's single history entry and routes
	 * every Android back press through the handler installed here. Returning true
	 * means "I consumed the press" (a bottom sheet was open, or we stepped back);
	 * returning false tells ProfileScreen to dismiss the wizard.
	 */
	backHandlerRef?: React.MutableRefObject<(() => boolean) | null>;
	photoPreview: string | null;
	isUploading: boolean;
}

const STEPS = [
	{ key: "basic", iconEn: "Basic Info", iconHi: "मूल जानकारी" },
	{ key: "diksha", iconEn: "Diksha Details", iconHi: "दीक्षा विवरण" },
	{ key: "photo", iconEn: "Photo", iconHi: "फोटो" },
	{ key: "family", iconEn: "Family", iconHi: "परिवार" },
];

/* ── Date helpers (same as ProfileScreen) ── */
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

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
	isHindi,
	formData,
	mandalList,
	guruOptions,
	onFormChange,
	onPhotoSelect,
	onComplete,
	onDismiss,
	backHandlerRef,
	photoPreview,
	isUploading,
}) => {
	const [step, setStep] = useState(0);
	const [showGuruSheet, setShowGuruSheet] = useState(false);
	const [showMandalSheet, setShowMandalSheet] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const fileInputRef = useRef<HTMLInputElement>(null);
	const cameraInputRef = useRef<HTMLInputElement>(null);

	/* ── Hardware back button (bug #1) ──
	   Close a bottom sheet if one is open, else walk back a step. Only a back
	   press on the very first step falls through to ProfileScreen, which then
	   dismisses the wizard. Before this, back popped the profile's own history
	   entry and destroyed the entire ProfileScreen without ever running
	   `onDismiss`, so the "seen" flag was never written.
	*/
	useEffect(() => {
		if (!backHandlerRef) return;
		backHandlerRef.current = () => {
			if (showMandalSheet) {
				setShowMandalSheet(false);
				return true;
			}
			if (showGuruSheet) {
				setShowGuruSheet(false);
				return true;
			}
			if (step > 0) {
				setStep((s) => s - 1);
				return true;
			}
			return false;
		};
		return () => {
			backHandlerRef.current = null;
		};
	}, [backHandlerRef, step, showGuruSheet, showMandalSheet]);

	const isAspiring = formData.guruSelection === "aspiring";

	const validateStep = useCallback((): boolean => {
		const e: Record<string, string> = {};
		if (step === 0) {
			if (!formData.realName.trim())
				e.realName = isHindi ? "नाम आवश्यक है" : "Name is required";
		}
		if (step === 1) {
			if (!formData.guruSelection)
				e.guru = isHindi ? "गुरु / स्थिति चुनें" : "Select Guru / Status";
			if (formData.guruSelection === "other" && !formData.guruNameCustom.trim())
				e.guruCustom = isHindi ? "गुरु का नाम दर्ज करें" : "Enter Guru name";
			if (!isAspiring && formData.guruSelection && !formData.dikshaDate)
				e.dikshaDate = isHindi ? "दीक्षा तिथि दर्ज करें" : "Enter Diksha date";
			if (!formData.mandalId.trim())
				e.mandal = isHindi ? "मंडल चुनें" : "Select Mandal";
		}
		setErrors(e);
		return Object.keys(e).length === 0;
	}, [step, formData, isHindi, isAspiring]);

	const nextStep = () => {
		if (!validateStep()) return;
		if (step < STEPS.length - 1) setStep(step + 1);
		else onComplete();
	};

	const prevStep = () => {
		if (step > 0) setStep(step - 1);
	};

	const _progressPercent = ((step + 1) / STEPS.length) * 100;

	return (
		<div className="fixed inset-0 z-[250] bg-ry-sand dark:bg-ink-900 flex flex-col animate-in slide-in-from-bottom-full duration-300 font-sans">
			{/* Header */}
			<div className="flex-none bg-gradient-to-r from-saffron-500 to-orange-500 text-ry-cream shadow-md border-b-2 border-ry-gold/40 border-b-2 border-ry-gold/40 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
				<div className="flex items-center gap-3 mb-3">
					<button
						onClick={onDismiss}
						className="p-2 -ml-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
					>
						<X className="w-6 h-6" />
					</button>
					<h2 className="font-display text-lg font-semibold leading-none drop-shadow-md flex-1">
						{isHindi ? "🙏 नमस्कार! प्रोफाइल बनाएं" : "🙏 Welcome! Create Profile"}
					</h2>
				</div>
				{/* Progress Bar */}
				<div className="flex items-center gap-2">
					{STEPS.map((s, i) => (
						<div
							key={s.key}
							className="flex-1 flex flex-col items-center gap-1"
						>
							<div
								className={`h-1.5 w-full rounded-full transition-all duration-500 ${
									i <= step ? "bg-ry-gold" : "bg-ry-gold/20"
								}`}
							/>
							<span
								className={`text-[9px] font-medium transition-colors ${i <= step ? "text-ry-gold" : "text-ry-gold/40"}`}
							>
								{isHindi ? s.iconHi : s.iconEn}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-5">
				<div className="max-w-sm mx-auto">
					{/* Step 0: Basic Info */}
					{step === 0 && (
						<div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
							<div className="text-center mb-6">
								<div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
									<User size={32} className="text-pink-500" />
								</div>
								<h3 className="text-xl font-bold text-slate-800 dark:text-white">
									{isHindi ? "अपना परिचय दें" : "Tell us about yourself"}
								</h3>
								<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
									{isHindi
										? "बस कुछ बुनियादी जानकारी"
										: "Just some basic information"}
								</p>
							</div>

							<div>
								<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
									{isHindi ? "नाम" : "Name"}{" "}
									<span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									value={formData.realName}
									onChange={(e) => onFormChange({ realName: e.target.value })}
									maxLength={50}
									className={`w-full bg-white dark:bg-slate-900 border ${errors.realName ? "border-red-400 ring-2 ring-red-200" : "border-slate-200 dark:border-slate-800"} rounded-2xl px-4 py-3.5 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white`}
									placeholder={isHindi ? "अपना नाम दर्ज करें" : "Enter your name"}
								/>
								{errors.realName && (
									<p className="text-xs text-red-500 mt-1 ml-1">
										{errors.realName}
									</p>
								)}
							</div>

							<div>
								<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
									{isHindi ? "दीक्षित नाम" : "Diksha Name"}
								</label>
								<input
									type="text"
									value={formData.dikshaName}
									onChange={(e) => onFormChange({ dikshaName: e.target.value })}
									maxLength={50}
									className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white"
									placeholder={isHindi ? "यदि लागू हो" : "If applicable"}
								/>
							</div>

							<div>
								<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
									{isHindi ? "फोन नंबर" : "Phone Number"}{" "}
									<span className="text-red-500">*</span>
								</label>
								<input
									type="tel"
									value={formData.phoneNumber}
									onChange={(e) => {
										const cleaned = e.target.value.startsWith("+91")
											? e.target.value
											: "+91";
										const after91 = cleaned
											.slice(3)
											.replace(/\D/g, "")
											.slice(0, 10);
										onFormChange({ phoneNumber: `+91${after91}` });
									}}
									inputMode="tel"
									maxLength={13}
									className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all outline-none text-slate-800 dark:text-white tracking-wider"
									placeholder="+91XXXXXXXXXX"
								/>
							</div>
						</div>
					)}

					{/* Step 1: Diksha Details */}
					{step === 1 && (
						<div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
							<div className="text-center mb-6">
								<div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
									<Sparkles size={32} className="text-amber-600" />
								</div>
								<h3 className="text-xl font-bold text-slate-800 dark:text-white">
									{isHindi ? "दीक्षा विवरण" : "Diksha Details"}
								</h3>
							</div>

							{/* Guru */}
							<div>
								<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
									{isHindi ? "दीक्षा गुरु / स्थिति" : "Diksha Guru / Status"}{" "}
									<span className="text-red-500">*</span>
								</label>
								<button
									type="button"
									onClick={() => setShowGuruSheet(true)}
									className={`w-full bg-white dark:bg-slate-900 border ${errors.guru ? "border-red-400" : formData.guruSelection ? "border-pink-400 dark:border-pink-600" : "border-slate-200 dark:border-slate-800"} rounded-2xl px-4 py-3.5 transition-all outline-none text-left flex items-center justify-between gap-2`}
								>
									<span
										className={`truncate text-sm ${formData.guruSelection ? "text-slate-800 dark:text-white" : "text-slate-400"}`}
									>
										{formData.guruSelection
											? isHindi
												? guruOptions.find(
														(o) => o.id === formData.guruSelection,
													)?.labelHi
												: guruOptions.find(
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
								{errors.guru && (
									<p className="text-xs text-red-500 mt-1 ml-1">
										{errors.guru}
									</p>
								)}

								{formData.guruSelection === "other" && (
									<input
										type="text"
										value={formData.guruNameCustom}
										onChange={(e) =>
											onFormChange({ guruNameCustom: e.target.value })
										}
										maxLength={50}
										className={`mt-2 w-full bg-white dark:bg-slate-900 border ${errors.guruCustom ? "border-red-400" : "border-pink-300 dark:border-pink-700"} rounded-2xl px-4 py-3 text-sm outline-none text-slate-800 dark:text-white`}
										placeholder={
											isHindi ? "गुरु महाराज का नाम..." : "Guru Maharaj's name..."
										}
									/>
								)}
								{isAspiring && (
									<p className="text-xs text-blue-500 dark:text-blue-400 mt-1.5 ml-1">
										🌱{" "}
										{isHindi
											? "दीक्षा की तिथि आवश्यक नहीं है"
											: "Initiation date is not required"}
									</p>
								)}
							</div>

							{/* Diksha Date */}
							{formData.guruSelection && !isAspiring && (
								<div>
									<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
										{isHindi ? "दीक्षा की तिथि" : "Diksha Date"}{" "}
										<span className="text-red-500">*</span>
									</label>
									<CustomDateInput
										value={toDateInputFormat(formData.dikshaDate)}
										onChange={(val) =>
											onFormChange({
												dikshaDate: fromDateInputFormat(val),
											})
										}
										isHindi={isHindi}
									/>
									{errors.dikshaDate && (
										<p className="text-xs text-red-500 mt-1 ml-1">
											{errors.dikshaDate}
										</p>
									)}
								</div>
							)}

							{/* Mandal */}
							<div>
								<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
									{isHindi ? "मंडल" : "Mandal"}{" "}
									<span className="text-red-500">*</span>
								</label>
								{!formData.isCustomMandal ? (
									<button
										type="button"
										onClick={() => setShowMandalSheet(true)}
										className={`w-full bg-white dark:bg-slate-900 border ${errors.mandal ? "border-red-400" : "border-slate-200 dark:border-slate-800"} rounded-2xl px-4 py-3.5 transition-all outline-none text-left flex items-center justify-between`}
									>
										<span
											className={
												formData.mandalId
													? "text-slate-800 dark:text-white"
													: "text-slate-400"
											}
										>
											{formData.mandalId
												? isHindi
													? mandalList.find((m) => m.id === formData.mandalId)
															?.shortNameHi
													: mandalList.find((m) => m.id === formData.mandalId)
															?.shortNameEn
												: isHindi
													? "मंडल चुनें"
													: "Select Mandal"}
										</span>
										<ChevronDown
											size={18}
											className="text-slate-400 dark:text-ink-400 shrink-0"
										/>
									</button>
								) : (
									<input
										type="text"
										value={formData.mandalId}
										onChange={(e) => onFormChange({ mandalId: e.target.value })}
										maxLength={80}
										className="w-full bg-white dark:bg-slate-900 border border-pink-400 dark:border-pink-600 rounded-2xl px-4 py-3.5 outline-none text-slate-800 dark:text-white"
										placeholder={
											isHindi ? "अपने मंडल का नाम..." : "Your Mandal name..."
										}
									/>
								)}
								{errors.mandal && (
									<p className="text-xs text-red-500 mt-1 ml-1">
										{errors.mandal}
									</p>
								)}
								<label className="flex items-center gap-2 mt-2.5 ml-0.5 cursor-pointer">
									<div
										onClick={() =>
											onFormChange({
												isCustomMandal: !formData.isCustomMandal,
												mandalId: "",
											})
										}
										className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${formData.isCustomMandal ? "bg-pink-500 border-pink-500" : "border-slate-300 dark:border-slate-600"}`}
									>
										{formData.isCustomMandal && (
											<svg width="11" height="9" viewBox="0 0 11 9" fill="none">
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
									<span className="text-[12px] text-slate-600 dark:text-slate-400">
										{isHindi
											? "मंडल लिस्ट में नहीं है"
											: "My Mandal is not in the list"}
									</span>
								</label>
							</div>
						</div>
					)}

					{/* Step 2: Photo */}
					{step === 2 && (
						<div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5 text-center">
							<div className="mb-6">
								<div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
									<Camera size={32} className="text-blue-500" />
								</div>
								<h3 className="text-xl font-bold text-slate-800 dark:text-white">
									{isHindi ? "प्रोफाइल फोटो" : "Profile Photo"}
								</h3>
								<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
									{isHindi
										? "स्पष्ट चेहरे की फोटो अपलोड करें"
										: "Upload a clear face photo"}
								</p>
							</div>

							<div className="flex flex-col items-center gap-4">
								{photoPreview ? (
									<div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl">
										<ThumbImg
											src={photoPreview}
											thumbWidth={THUMB.tile}
											alt="Profile"
											className="w-full h-full object-cover"
										/>
									</div>
								) : (
									<div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl flex items-center justify-center">
										{isUploading ? (
											<Loader2
												size={36}
												className="text-pink-500 animate-spin"
											/>
										) : (
											<User
												size={48}
												className="text-slate-300 dark:text-slate-600"
											/>
										)}
									</div>
								)}

								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={onPhotoSelect}
									className="hidden"
								/>
								<input
									ref={cameraInputRef}
									type="file"
									accept="image/*"
									capture="user"
									onChange={onPhotoSelect}
									className="hidden"
								/>

								<div className="flex gap-3 justify-center">
									<button
										type="button"
										onClick={() => cameraInputRef.current?.click()}
										disabled={isUploading}
										className="flex items-center gap-2 bg-pink-500 text-white font-bold px-5 py-3 rounded-2xl active:scale-95 transition-all shadow-md disabled:opacity-50"
									>
										<Camera size={18} />
										{isHindi ? "कैमरा" : "Camera"}
									</button>
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										disabled={isUploading}
										className="flex items-center gap-2 bg-blue-500 text-white font-bold px-5 py-3 rounded-2xl active:scale-95 transition-all shadow-md disabled:opacity-50"
									>
										<ImageIcon size={18} />
										{isHindi ? "गैलरी" : "Gallery"}
									</button>
								</div>

								<p className="text-xs text-slate-400 dark:text-ink-400">
									{isHindi
										? "फोटो बाद में भी जोड़ सकते हैं"
										: "You can also add a photo later"}
								</p>
							</div>
						</div>
					)}

					{/* Step 3: Family (Skip) */}
					{step === 3 && (
						<div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5 text-center">
							<div className="mb-6">
								<div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
									<Users size={32} className="text-purple-500" />
								</div>
								<h3 className="text-xl font-bold text-slate-800 dark:text-white">
									{isHindi ? "परिवार के सदस्य" : "Family Members"}
								</h3>
								<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
									{isHindi
										? "आप बाद में प्रोफाइल से जोड़ सकते हैं"
										: "You can add them later from your profile"}
								</p>
							</div>

							<div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-8">
								<Users
									size={48}
									className="text-slate-300 dark:text-slate-600 mx-auto mb-3"
								/>
								<p className="text-sm text-slate-500 dark:text-slate-400">
									{isHindi
										? "प्रोफाइल सेव करने के बाद परिवार के सदस्य जोड़ें"
										: "Add family members after saving your profile"}
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Footer Navigation */}
			<div className="flex-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-black/50 backdrop-blur-lg">
				<div className="max-w-sm mx-auto flex gap-3">
					{step > 0 && (
						<button
							onClick={prevStep}
							className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl active:scale-95 transition-all"
						>
							<ArrowLeft size={18} />
							{isHindi ? "पीछे" : "Back"}
						</button>
					)}
					<button
						onClick={nextStep}
						className={`flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-md ${step === 0 ? "w-full" : ""}`}
					>
						{step === STEPS.length - 1
							? isHindi
								? "प्रोफाइल सहेजें ✅"
								: "Save Profile ✅"
							: step === 2 && !photoPreview
								? isHindi
									? "बाद में जोड़ें →"
									: "Add Later →"
								: isHindi
									? "आगे"
									: "Next"}
						{step < STEPS.length - 1 && <ArrowRight size={18} />}
					</button>
				</div>
			</div>

			{/* Guru Selector Sheet */}
			{showGuruSheet && (
				<div
					className="fixed inset-0 bg-black/60 z-[300] flex items-end justify-center p-4 pb-8 animate-in fade-in duration-200"
					onClick={() => setShowGuruSheet(false)}
				>
					<div
						className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[75vh] animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 shrink-0">
							<h3 className="font-bold text-slate-800 dark:text-white px-2 text-sm">
								🙏 {isHindi ? "गुरु चुनें" : "Select Guru"}
							</h3>
							<button
								onClick={() => setShowGuruSheet(false)}
								className="p-2 text-slate-400 dark:text-ink-400 rounded-full bg-white dark:bg-slate-700 shadow-sm"
							>
								<X size={18} />
							</button>
						</div>
						<div className="overflow-y-auto p-2 flex flex-col gap-1">
							{guruOptions.map((option) => {
								const isSelected = formData.guruSelection === option.id;
								return (
									<button
										key={option.id}
										onClick={() => {
											onFormChange({
												guruSelection: option.id as GuruOptionId,
											});
											setShowGuruSheet(false);
										}}
										className={`w-full flex items-center gap-3 p-4 rounded-2xl active:scale-[0.98] transition-all text-left ${isSelected ? "bg-pink-50 dark:bg-pink-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
									>
										<div
											className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${isSelected ? "bg-pink-100 dark:bg-pink-500/20" : option.id === "aspiring" ? "bg-green-100 dark:bg-green-900/30" : option.id === "other" ? "bg-slate-100 dark:bg-slate-700" : "bg-amber-100 dark:bg-amber-900/30"}`}
										>
											{option.id === "aspiring"
												? "🌱"
												: option.id === "other"
													? "✏️"
													: "🙏"}
										</div>
										<p
											className={`flex-1 font-semibold text-sm ${isSelected ? "text-pink-700 dark:text-pink-400" : "text-slate-800 dark:text-slate-200"}`}
										>
											{isHindi ? option.labelHi : option.labelEn}
										</p>
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

			{/* Mandal Selector Sheet */}
			{showMandalSheet && (
				<div
					className="fixed inset-0 bg-black/60 z-[300] flex items-end justify-center p-4 pb-8 animate-in fade-in duration-200"
					onClick={() => setShowMandalSheet(false)}
				>
					<div
						className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 shrink-0">
							<h3 className="font-bold text-slate-800 dark:text-white px-2 flex items-center gap-2">
								<MapPin size={18} className="text-pink-500" />{" "}
								{isHindi ? "मंडल चुनें" : "Select Mandal"}
							</h3>
							<button
								onClick={() => setShowMandalSheet(false)}
								className="p-2 text-slate-400 dark:text-ink-400 rounded-full bg-white dark:bg-slate-700 shadow-sm"
							>
								<X size={18} />
							</button>
						</div>
						<div className="overflow-y-auto p-2 flex flex-col gap-1">
							{mandalList.map((m) => (
								<button
									key={m.id}
									onClick={() => {
										onFormChange({ mandalId: m.id });
										setShowMandalSheet(false);
									}}
									className={`w-full flex items-center gap-3 p-3.5 rounded-2xl active:scale-[0.98] transition-all text-left ${formData.mandalId === m.id ? "bg-pink-50 dark:bg-pink-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
								>
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${formData.mandalId === m.id ? "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}
									>
										{m.shortNameHi?.charAt(0) || m.shortNameEn?.charAt(0)}
									</div>
									<p
										className={`flex-1 font-semibold text-sm ${formData.mandalId === m.id ? "text-pink-700 dark:text-pink-400" : "text-slate-700 dark:text-slate-300"}`}
									>
										{isHindi ? m.shortNameHi : m.shortNameEn}
									</p>
									{formData.mandalId === m.id && (
										<CheckCircle size={18} className="text-pink-500 shrink-0" />
									)}
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

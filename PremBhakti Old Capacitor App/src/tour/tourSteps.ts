/**
 * tourSteps.ts — every chapter of the guided product tour.
 *
 * A chapter runs by itself the first time its screen opens (its `trigger`).
 * Adding a chapter = one entry below + `data-tour="…"` attributes on the
 * elements it points at. Nothing else needs to change.
 *
 * Versioning: when a step is added to a chapter that people have already
 * seen, give the new step `since: <new version>` and raise the chapter's
 * `version`. People who saw the old version then get only the new steps,
 * under a "What's new" label; everyone else gets the whole chapter.
 *
 * Text rules: pure Hindi (Devanagari) and English, never Roman Hindi. Titles
 * about 4–5 words, descriptions one or two short lines.
 */
import type { AppTab } from "../../types";
import { getRecentSearches } from "../../utils/recentSearches";
import { emitTourUi } from "./tourBus";

export interface LocalizedText {
	hi: string;
	en: string;
}

export type ChapterId =
	| "core"
	| "bhajans"
	| "audio"
	| "books"
	| "library"
	| "reader"
	| "bookReader"
	| "profile"
	| "profileGuest"
	| "menu"
	| "settings"
	| "information"
	| "events"
	| "darshan"
	| "templeTimings"
	| "seva"
	| "donate"
	| "videos";

/** The full-screen view on top of the tabs, or null when a tab is showing. */
export type TourOverlay =
	| "reader"
	| "book"
	| "profile"
	| "settings"
	| "menu"
	| "information"
	| "events"
	| "darshan"
	| "temple-timings"
	| "seva"
	| "donate"
	| "videos"
	/** Anything else (About, Quotes, Activities, editor…) — no chapter. */
	| "other";

export interface TourState {
	activeTab: AppTab;
	overlay: TourOverlay | null;
	isLoggedIn: boolean;
}

export type TourStep = {
	id: string;
	/** `[data-tour="…"]` selector; null = a centred card with no highlight. */
	target: string | null;
	title: LocalizedText;
	desc: LocalizedText;
	/** Skip at once when the element is not on screen (no 2.5 s wait). */
	optional?: boolean;
	/** Chapter version that introduced this step (default 1). */
	since?: number;
	/** Checked before `onEnter`; false skips the step without touching the UI. */
	when?: () => boolean;
	/** Get the screen ready before the step is shown (e.g. switch a sub-tab). */
	onEnter?: () => void;
	/** Undo what `onEnter` opened. */
	onExit?: () => void;
};

export type TourChapter = {
	id: ChapterId;
	/** Raise when steps are added; saved progress stores this number. */
	version: number;
	trigger: (state: TourState) => boolean;
	/**
	 * "Screen is ready" marker: the chapter starts only after this has been on
	 * screen for a moment. Defaults to the first non-optional step's target.
	 */
	probe?: string;
	steps: TourStep[];
};

const t = (id: string) => `[data-tour="${id}"]`;

const onTab = (tab: AppTab) => (s: TourState) =>
	s.overlay === null && s.activeTab === tab;
const onOverlay = (overlay: TourOverlay) => (s: TourState) =>
	s.overlay === overlay;

const hasRecentSearches = () => {
	try {
		return getRecentSearches().length > 0;
	} catch {
		return false;
	}
};

export const TOUR_CHAPTERS: TourChapter[] = [
	// ── Home, header and bottom navigation ────────────────────────────────
	{
		id: "core",
		version: 1,
		trigger: onTab("home"),
		// Fixed in portrait and landscape alike (the landscape profile button
		// scrolls with the page).
		probe: t("nav-home"),
		steps: [
			{
				id: "welcome",
				target: null,
				title: {
					hi: "प्रेम भक्ति में आपका स्वागत है",
					en: "Welcome to Prem Bhakti",
				},
				desc: {
					hi: "आइए, कुछ ही पलों में देखें कि ऐप में क्या कहाँ है।",
					en: "Let us take a short look at where everything is in the app.",
				},
			},
			{
				id: "menu",
				target: t("header-menu"),
				optional: true,
				title: { hi: "मुख्य मेनू", en: "Main menu" },
				desc: {
					hi: "सूचना, सहयोग, मंदिर का समय, डाउनलोड्स, ऐप अपडेट, सुझाव और बाकी सुविधाएँ यहाँ मिलेंगी।",
					en: "Notices, donations, temple timings, downloads, app updates, feedback and more are here.",
				},
			},
			{
				id: "profile",
				target: t("header-profile"),
				title: { hi: "आपकी प्रोफाइल", en: "Your profile" },
				desc: {
					hi: "अपनी भक्त प्रोफाइल बनाएँ और परिवार के सदस्यों को जोड़ें। कोने का बिंदु बताता है — हरा: स्वीकृत, पीला: जाँच बाकी, लाल: कुछ ठीक करना है।",
					en: "Create your devotee profile and add your family members. The dot on it shows: green — approved, yellow — waiting for review, red — something to fix.",
				},
			},
			{
				id: "settings",
				target: t("header-settings"),
				title: { hi: "सेटिंग्स", en: "Settings" },
				desc: {
					hi: "अक्षरों का आकार, भाषा और रंग-रूप यहाँ से बदलें।",
					en: "Change text size, language and dark mode here.",
				},
			},
			{
				id: "aavirbhav",
				target: t("home-aavirbhav"),
				optional: true,
				title: { hi: "आविर्भाव महोत्सव", en: "Aavirbhav Mahotsav" },
				desc: {
					hi: "गुरु महाराज जी की महिमा में अपने भाव लिखें और दूसरों के भाव पढ़ें।",
					en: "Write your glorification of Guru Maharaj Ji and read what others shared.",
				},
			},
			{
				id: "hero",
				target: t("home-hero"),
				optional: true,
				title: { hi: "हमारे गुरुजन", en: "Our Gurus" },
				desc: {
					hi: "चित्र पर दबाकर गुरु महाराज जी और विरही जी महाराज के बारे में पढ़ें।",
					en: "Tap a picture to read about Guru Maharaj Ji and Virahi Ji Maharaj.",
				},
			},
			{
				id: "diksha-anniversary",
				target: t("home-diksha"),
				optional: true,
				title: { hi: "आज दीक्षा वर्षगांठ", en: "Diksha anniversaries" },
				desc: {
					hi: "जिन भक्तों की आज दीक्षा वर्षगांठ है, वे यहाँ दिखते हैं। आपकी वर्षगांठ पर आपके लिए विशेष शुभकामना भी।",
					en: "Devotees whose diksha anniversary is today appear here — with a special greeting on your own day.",
				},
			},
			{
				id: "banner",
				target: t("home-banner"),
				optional: true,
				title: { hi: "नई घोषणाएँ", en: "Announcements" },
				desc: {
					hi: "आयोजनों और नई बातों की सूचना यहाँ दिखती है।",
					en: "News about events and new features appears here.",
				},
			},
			{
				id: "grid",
				target: t("home-grid"),
				title: { hi: "सब कुछ एक जगह", en: "Everything in one place" },
				desc: {
					hi: "हर मेनू ऐप का एक हिस्सा खोलता है। आगे मुख्य खाने एक-एक करके दिखाए गए हैं।",
					en: "Each tile opens a part of the app. The main ones are shown one by one next.",
				},
			},
			{
				id: "activities",
				target: t("home-activities"),
				title: { hi: "हमारी गतिविधियाँ", en: "Our Activities" },
				desc: {
					hi: "हर मंडल का साप्ताहिक कार्यक्रम, और उसकी फ़ोटो व वीडियो।",
					en: "Each mandal's weekly programme, with its photos and videos.",
				},
			},
			{
				id: "darshan",
				target: t("home-darshan"),
				title: { hi: "ठाकुर जी के दर्शन", en: "Deity Darshan" },
				desc: {
					hi: "हर मंदिर से ठाकुर जी के दर्शन। नई तस्वीरें आने पर यहाँ NEW दिखता है।",
					en: "Darshan of Thakur Ji from every temple. NEW shows here when fresh photos arrive.",
				},
			},
			{
				id: "calendar",
				target: t("home-calendar"),
				title: { hi: "वैष्णव कैलेंडर", en: "Vaishnav Calendar" },
				desc: {
					hi: "उत्सवों और एकादशी व्रत की तिथियाँ, महीने के अनुसार।",
					en: "Dates of festivals and Ekadashi fasts, month by month.",
				},
			},
			{
				id: "quotes",
				target: t("home-quotes"),
				title: { hi: "नित्य वाणी", en: "Daily Quotes" },
				desc: {
					hi: "हर दिन एक नई वाणी; पिछले दिनों की वाणियाँ भी पढ़ सकते हैं।",
					en: "A new quote every day; you can read earlier days' quotes too.",
				},
			},
			{
				id: "videos",
				target: t("home-videos"),
				title: { hi: "वीडियो", en: "Videos" },
				desc: {
					hi: "प्रवचनों और कार्यक्रमों के वीडियो, संग्रहों में रखे हुए।",
					en: "Videos of talks and programmes, kept in collections.",
				},
			},
			{
				id: "photos",
				target: t("home-photos"),
				title: { hi: "पिछले कार्यक्रम", en: "Past events" },
				desc: {
					hi: "बीते उत्सवों और कार्यक्रमों की फ़ोटो और वीडियो।",
					en: "Photos and videos from earlier festivals and programmes.",
				},
			},
			{
				id: "centres",
				target: t("home-centres"),
				title: { hi: "हमारे केंद्र", en: "Our Centres" },
				desc: {
					hi: "सभी मंदिरों और केंद्रों के पते, फ़ोन नंबर और रास्ता।",
					en: "Addresses, phone numbers and directions for every temple and centre.",
				},
			},
			{
				id: "information",
				target: t("home-information"),
				title: { hi: "जानकारी", en: "Information" },
				desc: {
					hi: "संघ की सूचनाएँ और घोषणाएँ। नई सूचना आने पर निशान दिखता है।",
					en: "Notices and announcements from the Sangh. A mark shows when there is a new one.",
				},
			},
			{
				id: "social",
				target: t("home-social"),
				title: { hi: "यूट्यूब और सोशल मीडिया", en: "YouTube and social media" },
				desc: {
					hi: "यहाँ और पास के खानों से संघ के यूट्यूब, इंस्टाग्राम और फ़ेसबुक पन्ने खोलें।",
					en: "This tile and the ones beside it open the Sangh's YouTube, Instagram and Facebook pages.",
				},
			},
			{
				id: "downloads",
				target: t("home-downloads"),
				title: { hi: "डाउनलोड्स", en: "Downloads" },
				desc: {
					hi: "डाउनलोड किए भजन, कथाएँ और ग्रंथ; ये बिना इंटरनेट भी चलते हैं।",
					en: "Bhajans, kathas and books you downloaded; they work without internet.",
				},
			},
			{
				id: "help",
				target: t("home-help"),
				title: { hi: "ऐप कैसे उपयोग करें", en: "How to use the app" },
				desc: {
					hi: "यह परिचय दोबारा देखना हो, तो यहाँ से कभी भी देख सकते हैं।",
					en: "You can take this guided tour again from here, anytime.",
				},
			},
			{
				id: "nav-books",
				target: t("nav-books"),
				title: { hi: "ग्रंथ", en: "Books" },
				desc: {
					hi: "पवित्र ग्रंथ पढ़ें; एक बार डाउनलोड करके बिना इंटरनेट भी।",
					en: "Read holy books; download once and read even without internet.",
				},
			},
			{
				id: "nav-audio",
				target: t("nav-audio"),
				title: { hi: "ऑडियो", en: "Audio" },
				desc: {
					hi: "कीर्तन और कथाएँ सुनें, अपनी प्लेलिस्ट बनाएँ।",
					en: "Listen to kirtans and kathas, and make your own playlists.",
				},
			},
			{
				id: "nav-home",
				target: t("nav-home"),
				title: { hi: "होम", en: "Home" },
				desc: {
					hi: "कहीं से भी यहाँ दबाकर इसी मुख्य पन्ने पर लौट आएँ।",
					en: "Tap here from anywhere to come back to this main page.",
				},
			},
			{
				id: "nav-bhajans",
				target: t("nav-bhajans"),
				title: { hi: "भजन", en: "Bhajans" },
				desc: {
					hi: "सभी भजनों की सूची; नाम या किसी पंक्ति से खोजें।",
					en: "The full bhajan list; search by name or by any line.",
				},
			},
			{
				id: "nav-library",
				target: t("nav-library"),
				title: { hi: "इतिहास", en: "History" },
				desc: {
					hi: "हाल में खोले गए भजन, और लेखकों के अनुसार भजन यहाँ मिलेंगे।",
					en: "Recently opened items, and bhajans grouped by their authors.",
				},
			},
			{
				id: "mini-player",
				target: t("mini-player"),
				optional: true,
				title: { hi: "चल रहा ऑडियो", en: "Now playing" },
				desc: {
					hi: "यहाँ से ऑडियो रोकें या चलाएँ; दबाकर पूरा भजन खोलें।",
					en: "Pause or play from here; tap it to open the full bhajan.",
				},
			},
		],
	},

	// ── Bhajans tab ───────────────────────────────────────────────────────
	{
		id: "bhajans",
		version: 1,
		trigger: onTab("songs"),
		steps: [
			{
				id: "search",
				target: t("bhajans-search"),
				title: { hi: "भजन खोजें", en: "Search bhajans" },
				desc: {
					hi: "यहाँ दबाकर भजन का नाम या कोई पंक्ति लिखें, हिंदी या अंग्रेज़ी में।",
					en: "Tap here and type a bhajan's name or any line, in Hindi or English.",
				},
			},
			{
				id: "voice",
				target: t("bhajans-voice"),
				optional: true,
				title: { hi: "बोलकर खोजें", en: "Search by voice" },
				desc: {
					hi: "यह बटन दबाकर भजन का नाम बोलें, ऐप उसे ढूँढ देगा।",
					en: "Press this button and say the bhajan's name; the app will find it.",
				},
			},
			{
				id: "recent",
				target: t("bhajans-recent"),
				optional: true,
				when: hasRecentSearches,
				onEnter: () => emitTourUi({ type: "bhajans-search", open: true }),
				onExit: () => emitTourUi({ type: "bhajans-search", open: false }),
				title: { hi: "पिछली खोजें", en: "Recent searches" },
				desc: {
					hi: "आपकी पिछली खोजें यहाँ दिखती हैं; चाहें तो इन्हें मिटा भी सकते हैं।",
					en: "Your recent searches appear here, and you can clear them anytime.",
				},
			},
			{
				id: "filter",
				target: t("bhajans-filter"),
				title: { hi: "फ़िल्टर और संग्रह", en: "Filter & Collections" },
				desc: {
					hi: "यहाँ भजनों की कई तैयार सूचियाँ पहले से बनी हैं। आगे देखिए इसमें क्या-क्या है।",
					en: "Several ready-made bhajan lists are already here. See what is inside next.",
				},
			},
			{
				id: "filter-nitya",
				target: t("bhajans-filter-nitya"),
				onEnter: () => emitTourUi({ type: "bhajans-filter", open: true }),
				onExit: () => emitTourUi({ type: "bhajans-filter", open: false }),
				title: {
					hi: "प्रातः और सायं नित्य क्रिया",
					en: "Morning and evening Nitya Kriya",
				},
				desc: {
					hi: "सुबह और शाम की नित्य क्रिया के सारे भजन, सही क्रम में। चुनते ही सूची उसी क्रम में दिखती है।",
					en: "All the bhajans of the morning and evening Nitya Kriya, in the right order. Pick one and the list follows that order.",
				},
			},
			{
				id: "filter-collections",
				target: t("bhajans-filter-collections"),
				onEnter: () => emitTourUi({ type: "bhajans-filter", open: true }),
				onExit: () => emitTourUi({ type: "bhajans-filter", open: false }),
				title: { hi: "मेरे संग्रह", en: "My Collections" },
				desc: {
					hi: "आपकी अपनी सूचियाँ। 'कस्टम सूची' से नई बनाएँ, फिर भजन पढ़ते समय तारे से उसमें भजन जोड़ें।",
					en: "Your own lists. Create one with 'Custom List', then add bhajans to it with the star while reading.",
				},
			},
			{
				id: "filter-categories",
				target: t("bhajans-filter-categories"),
				onEnter: () => emitTourUi({ type: "bhajans-filter", open: true }),
				onExit: () => emitTourUi({ type: "bhajans-filter", open: false }),
				title: { hi: "श्रेणियाँ", en: "Categories" },
				desc: {
					hi: "बधाई, होली, झूलन, आरतियाँ, अष्टक और स्तोत्र जैसी तैयार सूचियाँ। 'सभी भजन' से पूरी सूची पर लौटें।",
					en: "Ready-made lists such as Badhai, Holi, Jhulan, Aartis, and Ashtakas & Stotras. 'All Bhajans' brings the full list back.",
				},
			},
			{
				id: "filter-lang",
				target: t("bhajans-filter-lang"),
				optional: true,
				onEnter: () => emitTourUi({ type: "bhajans-filter", open: true }),
				onExit: () => emitTourUi({ type: "bhajans-filter", open: false }),
				title: { hi: "भाषा बदलें", en: "Change language" },
				desc: {
					hi: "यह बटन ऐप की भाषा हिंदी और अंग्रेज़ी के बीच बदलता है।",
					en: "This button switches the app between Hindi and English.",
				},
			},
			{
				id: "az",
				target: t("bhajans-az"),
				optional: true,
				title: { hi: "अक्षर से सीधे पहुँचें", en: "Jump by letter" },
				desc: {
					hi: "किसी अक्षर को दबाकर उसी अक्षर से शुरू होने वाले भजनों पर पहुँचें।",
					en: "Tap a letter to jump straight to bhajans that start with it.",
				},
			},
			{
				id: "az-toggle",
				target: t("bhajans-az-toggle"),
				optional: true,
				title: { hi: "हिंदी या अंग्रेज़ी अक्षर", en: "Hindi or English letters" },
				desc: {
					hi: "पट्टी के ऊपर का यह बटन अक्षरों को अंग्रेज़ी (A–Z) और हिंदी (अ, आ, क…) के बीच बदलता है; भजन उसी क्रम में सज जाते हैं।",
					en: "This button at the top of the bar switches the letters between English (A–Z) and Hindi (अ, आ, क…); bhajans are grouped the same way.",
				},
			},
			{
				id: "item",
				target: t("bhajans-item"),
				title: { hi: "भजन खोलें", en: "Open a bhajan" },
				desc: {
					hi: "भजन पर दबाकर उसे पढ़ें; संगीत-चिह्न वाले भजन सुन भी सकते हैं।",
					en: "Tap a bhajan to read it; ones with a music mark can also be heard.",
				},
			},
		],
	},

	// ── Audio tab ─────────────────────────────────────────────────────────
	{
		id: "audio",
		version: 1,
		trigger: onTab("lectures"),
		steps: [
			{
				id: "tabs",
				target: t("audio-tabs"),
				title: { hi: "चार हिस्से", en: "Four sections" },
				desc: {
					hi: "कीर्तन: भजनों की रिकॉर्डिंग। कथा: प्रवचन। गायक: किसी गायक के सारे भजन। प्लेलिस्ट: आपकी अपनी सूचियाँ।",
					en: "Kirtan: recorded bhajans. Katha: talks. Singers: all bhajans by one singer. Playlists: your own lists.",
				},
			},
			{
				id: "search",
				target: t("audio-search"),
				optional: true,
				title: { hi: "ऑडियो खोजें", en: "Search audio" },
				desc: {
					hi: "भजन या कथा का नाम लिखकर जल्दी ढूँढें।",
					en: "Type the name of a bhajan or katha to find it quickly.",
				},
			},
			{
				id: "item",
				target: t("audio-item"),
				optional: true,
				title: { hi: "सुनें और सहेजें", en: "Listen and save" },
				desc: {
					hi: "भजन पर दबाएँ: उसके सभी गायक खुलेंगे। गायक के नाम पर दबाकर सुनें; पास के डाउनलोड बटन से बिना इंटरनेट सुनने के लिए सहेजें।",
					en: "Tap a bhajan to see all its singers. Tap a singer to listen; the download button beside it saves it for listening offline.",
				},
			},
			{
				id: "queue",
				target: t("audio-queue"),
				optional: true,
				title: { hi: "आगे क्या बजेगा", en: "Up next" },
				desc: {
					hi: "यहाँ देखें कि आगे कौन-से भजन बजेंगे।",
					en: "See which tracks will play next.",
				},
			},
			{
				id: "playlists",
				target: t("audio-create-playlist"),
				onEnter: () => emitTourUi({ type: "audio-subtab", tab: "playlists" }),
				onExit: () => emitTourUi({ type: "audio-subtab", tab: "bhajans" }),
				title: { hi: "अपनी प्लेलिस्ट", en: "Your playlists" },
				desc: {
					hi: "यहाँ नई प्लेलिस्ट बनाएँ; किसी को हटाना हो तो उसके पास का हटाने वाला बटन दबाएँ।",
					en: "Create a new playlist here. To remove one, use the delete button beside it.",
				},
			},
		],
	},

	// ── Books tab ─────────────────────────────────────────────────────────
	{
		id: "books",
		version: 1,
		trigger: onTab("books"),
		steps: [
			{
				id: "search",
				target: t("books-search"),
				title: { hi: "ग्रंथ खोजें", en: "Search books" },
				desc: {
					hi: "ग्रंथ का नाम लिखकर जल्दी ढूँढें।",
					en: "Type a book's name to find it quickly.",
				},
			},
			{
				id: "item",
				target: t("books-item"),
				title: { hi: "ग्रंथ चुनें", en: "Choose a book" },
				desc: {
					hi: "किसी ग्रंथ पर दबाकर उसे पढ़ने या डाउनलोड करने का विकल्प पाएँ।",
					en: "Tap a book to read it or download it.",
				},
			},
			{
				id: "download",
				target: t("books-download"),
				optional: true,
				title: { hi: "डाउनलोड करें", en: "Download" },
				desc: {
					hi: "एक बार डाउनलोड करें, फिर बिना इंटरनेट कभी भी पढ़ें।",
					en: "Download once, then read anytime without internet.",
				},
			},
			{
				id: "cancel",
				target: t("books-cancel"),
				optional: true,
				title: { hi: "डाउनलोड रोकें", en: "Stop a download" },
				desc: {
					hi: "डाउनलोड चलते समय प्रगति यहाँ दिखती है; यह बटन उसे रोक देता है।",
					en: "Progress shows while a book downloads; this button stops it.",
				},
			},
			{
				id: "downloaded",
				target: t("books-downloaded"),
				optional: true,
				title: { hi: "फ़ोन में सहेजा हुआ", en: "Saved on your phone" },
				desc: {
					hi: "यह चिह्न बताता है कि ग्रंथ डाउनलोड हो चुका है।",
					en: "This mark means the book is already downloaded.",
				},
			},
			{
				id: "read",
				target: t("books-read"),
				optional: true,
				title: { hi: "पढ़ना शुरू करें", en: "Start reading" },
				desc: {
					hi: "डाउनलोड हुए ग्रंथ को यहाँ से सीधे खोलें।",
					en: "Open a downloaded book straight from here.",
				},
			},
		],
	},

	// ── History & Authors tab ─────────────────────────────────────────────
	{
		id: "library",
		version: 1,
		trigger: onTab("library"),
		steps: [
			{
				id: "tabs",
				target: t("library-tabs"),
				title: { hi: "इतिहास और लेखक", en: "History and Authors" },
				desc: {
					hi: "ऊपर से चुनें: हाल में खोले गए भजन-ग्रंथ, या लेखकों के अनुसार भजन।",
					en: "Choose from the top: recently opened items, or bhajans by author.",
				},
			},
			{
				id: "history",
				target: t("library-history"),
				optional: true,
				title: { hi: "हाल में खोले गए", en: "Recently opened" },
				desc: {
					hi: "जो भजन, कथा या ग्रंथ आपने खोले, वे यहाँ दिखते हैं; दबाकर फिर खोलें।",
					en: "Bhajans, kathas and books you opened show here; tap to open again.",
				},
			},
			{
				id: "clear",
				target: t("library-clear"),
				optional: true,
				title: { hi: "इतिहास मिटाएँ", en: "Clear history" },
				desc: {
					hi: "पूरी सूची हटानी हो तो यह बटन दबाएँ।",
					en: "Press this to clear the whole list.",
				},
			},
			{
				id: "author",
				target: t("library-author"),
				optional: true,
				onEnter: () => emitTourUi({ type: "library-tab", tab: "authors" }),
				onExit: () => emitTourUi({ type: "library-tab", tab: "history" }),
				title: { hi: "लेखक", en: "Authors" },
				desc: {
					hi: "किसी लेखक पर दबाकर उनके लिखे सभी भजन देखें।",
					en: "Tap an author to see all the bhajans they wrote.",
				},
			},
		],
	},

	// ── Bhajan reader ─────────────────────────────────────────────────────
	{
		id: "reader",
		version: 1,
		trigger: onOverlay("reader"),
		steps: [
			{
				id: "back",
				target: t("reader-back"),
				title: { hi: "वापस जाएँ", en: "Go back" },
				desc: {
					hi: "सूची पर लौटने के लिए यह तीर या फ़ोन का बैक बटन दबाएँ।",
					en: "Press this arrow or your phone's back button to return.",
				},
			},
			{
				id: "font",
				target: t("reader-font"),
				title: { hi: "अक्षरों का आकार", en: "Text size" },
				desc: {
					hi: "अक्षर बड़े-छोटे करें और पंक्तियों की दूरी बदलें; दो उँगलियों से फैलाकर भी। यहीं 'बुक मोड' चालू करके पन्ने को बड़ा कर खिसका सकते हैं।",
					en: "Change text size and line spacing, or pinch with two fingers. Turn on 'Book Mode' here to zoom and move the page around.",
				},
			},
			{
				id: "view",
				target: t("reader-view"),
				title: { hi: "पढ़ने का ढंग", en: "Page layout" },
				desc: {
					hi: "हर बार दबाने पर अगला ढंग: बीच में, बाईं ओर, दोनों ओर बराबर, और चौड़े पन्ने पर बीच में या बाईं ओर।",
					en: "Each tap picks the next layout: centred, left, justified, then wide page centred or left.",
				},
			},
			{
				id: "theme",
				target: t("reader-theme"),
				title: { hi: "उजला या गहरा रंग", en: "Light or dark" },
				desc: {
					hi: "आँखों के आराम के लिए उजला या गहरा रंग चुनें।",
					en: "Switch between light and dark colours for easier reading.",
				},
			},
			{
				id: "audio",
				target: t("reader-audio"),
				optional: true,
				title: { hi: "भजन सुनें", en: "Listen" },
				desc: {
					hi: "इस भजन का ऑडियो यहाँ से चलाएँ; एक से अधिक हों तो गायक चुनें।",
					en: "Play this bhajan's audio; choose a singer if there are several.",
				},
			},
			{
				id: "save",
				target: t("reader-save"),
				optional: true,
				title: { hi: "अपनी सूची में रखें", en: "Save to your list" },
				desc: {
					hi: "तारे को दबाकर यह भजन अपनी किसी सूची में जोड़ें।",
					en: "Tap the star to add this bhajan to one of your lists.",
				},
			},
			{
				id: "share",
				target: t("reader-share"),
				optional: true,
				title: { hi: "साझा करें", en: "Share" },
				desc: {
					hi: "यह भजन परिवार और मित्रों को भेजें।",
					en: "Send this bhajan to family and friends.",
				},
			},
		],
	},

	// ── Book (PDF) reader ─────────────────────────────────────────────────
	{
		id: "bookReader",
		version: 1,
		trigger: onOverlay("book"),
		steps: [
			{
				id: "slider",
				target: t("book-slider"),
				title: { hi: "पन्ने बदलें", en: "Turn pages" },
				desc: {
					hi: "इस पट्टी को खिसकाकर किसी भी पन्ने पर पहुँचें।",
					en: "Slide this bar to reach any page.",
				},
			},
			{
				id: "pages",
				target: t("book-pages"),
				title: { hi: "आगे और पीछे", en: "Next and previous" },
				desc: {
					hi: "एक-एक पन्ना आगे या पीछे जाने के लिए ये बटन दबाएँ।",
					en: "Use these to move one page forward or back.",
				},
			},
			{
				id: "zoom",
				target: t("book-zoom"),
				title: { hi: "बड़ा या छोटा करें", en: "Zoom" },
				desc: {
					hi: "पन्ने को बड़ा या छोटा करें; दो उँगलियों से भी कर सकते हैं।",
					en: "Zoom the page in or out; you can also pinch with two fingers.",
				},
			},
			{
				id: "bookmark",
				target: t("book-bookmark"),
				optional: true,
				title: { hi: "निशान लगाएँ", en: "Bookmark" },
				desc: {
					hi: "इस पन्ने पर निशान लगाएँ, ताकि बाद में यहीं से पढ़ सकें।",
					en: "Mark this page so you can continue from here later.",
				},
			},
		],
	},

	// ── Profile (signed in) ───────────────────────────────────────────────
	{
		id: "profile",
		// 2: relation helper + people added by the family (shown as "What's new"
		// to those who saw version 1).
		version: 2,
		trigger: (s) => s.overlay === "profile" && s.isLoggedIn,
		steps: [
			{
				id: "completion",
				target: t("profile-completion"),
				title: { hi: "प्रोफाइल कितनी पूरी है", en: "Profile progress" },
				desc: {
					hi: "यहाँ दिखता है कि प्रोफाइल कितनी भरी है और क्या बाकी है।",
					en: "This shows how complete your profile is and what is left.",
				},
			},
			{
				id: "photo",
				target: t("profile-photo"),
				optional: true,
				title: { hi: "अपनी फ़ोटो", en: "Your photo" },
				desc: {
					hi: "यहाँ दबाकर अपनी फ़ोटो लगाएँ या बदलें।",
					en: "Tap here to add or change your photo.",
				},
			},
			{
				id: "preview",
				target: t("profile-preview"),
				optional: true,
				title: { hi: "प्रोफाइल का पूर्वावलोकन", en: "Preview your profile" },
				desc: {
					hi: "देखें कि आपकी प्रोफाइल कैसी दिखती है, साथ में आपका QR कोड।",
					en: "See how your profile looks, along with your QR code.",
				},
			},
			{
				id: "gender",
				target: t("profile-gender"),
				optional: true,
				title: { hi: "लिंग", en: "Gender" },
				desc: {
					hi: "इसे चुनने से परिवार के रिश्ते अपने-आप सही भरते हैं — जैसे बहन को जोड़ें तो उनकी तरफ़ आप “भाई” दिखेंगे।",
					en: "Choosing it fills family relations correctly — add your sister and you show as her “brother”.",
				},
			},
			{
				id: "family-link",
				target: t("profile-family-link"),
				optional: true,
				title: { hi: "ऐप पर जुड़ा परिवार", en: "Family on the app" },
				desc: {
					hi: "जो परिवारजन अपने फ़ोन पर यह ऐप चलाते हैं, उनका खाता उनके फ़ोन नंबर (लॉगिन वाला या प्रोफ़ाइल में लिखा) या Google ईमेल से यहाँ लिंक करें।",
					en: "Family who run this app on their own phone: link their account here with their phone number (login or profile one) or Google email.",
				},
			},
			{
				id: "family-relation-helper",
				target: t("profile-relation-helper"),
				optional: true,
				since: 2,
				title: { hi: "रिश्ते पूरे करें", en: "Complete relations" },
				desc: {
					hi: "जुड़े परिवारजनों के रिश्ते कुछ आसान सवालों में भरें — ज़्यादातर बस एक टैप। जब चाहें यहीं से सबके रिश्ते देखें या बदलें।",
					en: "Fill in your linked family's relations with a few quick questions — mostly one tap. Look over or change them here any time.",
				},
			},
			{
				id: "family-shared",
				target: t("profile-family-shared"),
				optional: true,
				since: 2,
				title: { hi: "परिवार द्वारा जोड़े गए", en: "Added by your family" },
				desc: {
					hi: "जुड़े हुए परिवारजनों ने जिन्हें अपनी प्रोफ़ाइल में जोड़ा है, वे आपको भी यहाँ दिखते हैं — आपसे उनका रिश्ता अपने-आप निकाला जाता है। इन्हें वही बदल सकते हैं जिन्होंने जोड़ा है।",
					en: "People your linked family added to their profiles show here for you too, with your relation to them worked out. Only the one who added them can change them.",
				},
			},
			{
				id: "family-add",
				target: t("profile-family-add"),
				optional: true,
				title: { hi: "अन्य परिवारजन", en: "Other family members" },
				desc: {
					hi: "जो परिवारजन ख़ुद अपनी प्रोफ़ाइल नहीं बना सकते, उन्हें यहाँ जोड़ें।",
					en: "Add family members here who can't make their own profile.",
				},
			},
			{
				id: "family-member",
				target: t("profile-family-member"),
				optional: true,
				title: { hi: "सदस्य का कार्ड", en: "Member card" },
				desc: {
					hi: "हर सदस्य यहाँ दिखता है; बदलने या हटाने के बटन साथ में हैं।",
					en: "Each member shows here, with buttons to edit or remove them.",
				},
			},
			{
				id: "family-tree",
				target: t("profile-family-tree"),
				optional: true,
				title: { hi: "परिवार वृक्ष", en: "Family tree" },
				desc: {
					hi: "परिवार को पीढ़ी के अनुसार, या कौन किसके ज़रिए जुड़ा है, इस तरह देखें। किसी पर दबाकर रिश्ता चुनें।",
					en: "See your family by generation, or by who is linked through whom. Tap someone to set their relation.",
				},
			},
			{
				id: "save",
				target: t("profile-save"),
				optional: true,
				title: { hi: "सहेजें या एडिट करें", en: "Save or edit" },
				desc: {
					hi: "प्रोफाइल भरकर यहाँ से सहेजें। मंज़ूर हो चुकी प्रोफाइल बदलनी हो तो पहले यहाँ “एडिट का अनुरोध” दबाएँ, फिर बदलकर सहेजें।",
					en: "Fill in your profile and save it here. To change an approved profile, first tap “Request Profile Edit” here, then make your changes and save.",
				},
			},
		],
	},

	// ── Profile (signed out) ──────────────────────────────────────────────
	{
		id: "profileGuest",
		version: 1,
		trigger: (s) => s.overlay === "profile" && !s.isLoggedIn,
		steps: [
			{
				id: "login",
				target: t("profile-login"),
				title: { hi: "प्रोफाइल बनाएँ", en: "Create your profile" },
				desc: {
					hi: "गूगल या फ़ोन नंबर से जुड़कर अपनी भक्त प्रोफाइल बनाएँ।",
					en: "Sign in with Google or your phone number to create your devotee profile.",
				},
			},
		],
	},

	// ── Side menu ─────────────────────────────────────────────────────────
	{
		id: "menu",
		version: 1,
		trigger: onOverlay("menu"),
		steps: [
			{
				id: "profile",
				target: t("menu-profile"),
				optional: true,
				title: { hi: "भक्त प्रोफाइल", en: "Devotee profile" },
				desc: {
					hi: "अपनी प्रोफाइल यहाँ से खोलें।",
					en: "Open your profile from here.",
				},
			},
			{
				id: "information",
				target: t("menu-information"),
				title: { hi: "सूचना", en: "Notices" },
				desc: {
					hi: "संघ की सूचनाएँ और घोषणाएँ पढ़ें। नई सूचना आने पर यहाँ निशान दिखता है।",
					en: "Read notices and announcements from the Sangh. A mark shows here when a new one arrives.",
				},
			},
			{
				id: "donate",
				target: t("menu-donate"),
				title: { hi: "सहयोग करें", en: "Donate" },
				desc: {
					hi: "सेवा और मंदिर के कार्यों में यूपीआई या बैंक से सहयोग करें।",
					en: "Support seva and temple work by UPI or bank transfer.",
				},
			},
			{
				id: "timings",
				target: t("menu-timings"),
				title: { hi: "मंदिर दर्शन समय", en: "Temple Timings" },
				desc: {
					hi: "हर मंदिर की आरती और दर्शन का समय, पता और रास्ता।",
					en: "Aarti and darshan times for each temple, with address and directions.",
				},
			},
			{
				id: "downloads",
				target: t("menu-downloads"),
				title: { hi: "डाउनलोड्स / ऑफलाइन", en: "Downloads / Offline" },
				desc: {
					hi: "डाउनलोड किए भजन, कथाएँ और ग्रंथ; ये बिना इंटरनेट भी चलते हैं।",
					en: "Bhajans, kathas and books you downloaded; they work without internet.",
				},
			},
			{
				id: "update",
				target: t("menu-update"),
				title: { hi: "ऐप अपडेट", en: "App updates" },
				desc: {
					hi: "नया संस्करण आने पर यहाँ चमकता निशान दिखेगा; दबाकर अपडेट करें।",
					en: "A glowing mark shows here when a new version is ready; tap to update.",
				},
			},
			{
				id: "share",
				target: t("menu-share"),
				title: { hi: "ऐप शेयर करें", en: "Share the app" },
				desc: {
					hi: "यह ऐप परिवार और मित्रों को भेजें।",
					en: "Send this app to family and friends.",
				},
			},
			{
				id: "about",
				target: t("menu-about"),
				title: { hi: "हमारे बारे में", en: "About us" },
				desc: {
					hi: "संघ और गुरु परंपरा के बारे में पढ़ें।",
					en: "Read about the Sangh and its tradition.",
				},
			},
			{
				id: "privacy",
				target: t("menu-privacy"),
				title: { hi: "गोपनीयता नीति", en: "Privacy Policy" },
				desc: {
					hi: "आपकी जानकारी कैसे रखी और सुरक्षित की जाती है, यहाँ पढ़ें।",
					en: "Read how your information is kept and protected.",
				},
			},
			{
				id: "help",
				target: t("menu-help"),
				title: { hi: "उपयोग कैसे करें", en: "How to use" },
				desc: {
					hi: "ये सुझाव, परिचय स्लाइड्स या वीडियो दोबारा देखने के लिए यहाँ दबाएँ।",
					en: "Tap here to see these tips, the intro slides or the video guide again.",
				},
			},
			{
				id: "feedback",
				target: t("menu-feedback"),
				title: { hi: "सुझाव / संपर्क", en: "Feedback / Queries" },
				desc: {
					hi: "सुझाव या प्रश्न व्हाट्सऐप पर भेजें; एक दिन में उत्तर मिलता है।",
					en: "Send a suggestion or question on WhatsApp; you get a reply within a day.",
				},
			},
			{
				id: "settings",
				target: t("menu-settings"),
				optional: true,
				title: { hi: "सेटिंग्स", en: "Settings" },
				desc: {
					hi: "अक्षरों का आकार, भाषा और रंग-रूप यहाँ से बदलें।",
					en: "Change text size, language and colours here.",
				},
			},
		],
	},

	// ── Settings ──────────────────────────────────────────────────────────
	{
		id: "settings",
		version: 1,
		trigger: onOverlay("settings"),
		steps: [
			{
				id: "ui-scale",
				target: t("settings-uiscale"),
				title: { hi: "अक्षरों का आकार", en: "Text size" },
				desc: {
					hi: "पूरे ऐप के अक्षर और बटन बड़े या छोटे करें।",
					en: "Make the text and buttons across the app bigger or smaller.",
				},
			},
			{
				id: "theme",
				target: t("settings-theme"),
				title: { hi: "रंग-रूप", en: "Theme" },
				desc: {
					hi: "उजला, गहरा, या 'ऑटो': शाम 6 से सुबह 6 बजे तक अपने-आप गहरा रंग।",
					en: "Light, dark, or 'Auto': dark by itself from 6 PM to 6 AM.",
				},
			},
			{
				id: "colors",
				target: t("settings-colors"),
				title: { hi: "रंग थीम", en: "Colour themes" },
				desc: {
					hi: "ऐप का मुख्य रंग बदलें; कई रंगों में से चुनें।",
					en: "Change the app's main colour; choose from several.",
				},
			},
			{
				id: "language",
				target: t("settings-language"),
				title: { hi: "ऐप की भाषा", en: "App language" },
				desc: {
					hi: "ऐप के सारे शब्द हिंदी या अंग्रेज़ी में देखें।",
					en: "See the whole app in Hindi or English.",
				},
			},
			{
				id: "script",
				target: t("settings-script"),
				title: { hi: "भजन की लिपि", en: "Bhajan script" },
				desc: {
					hi: "भजन देवनागरी में पढ़ें या अंग्रेज़ी अक्षरों में।",
					en: "Read bhajans in Devanagari or in English letters.",
				},
			},
			{
				id: "az-side",
				target: t("settings-azside"),
				title: { hi: "अक्षर-पट्टी की जगह", en: "Letter bar side" },
				desc: {
					hi: "भजन सूची की अक्षर-पट्टी बाईं या दाईं ओर रखें।",
					en: "Keep the bhajan list's letter bar on the left or the right.",
				},
			},
			{
				id: "scroll-side",
				target: t("settings-scrollside"),
				title: { hi: "सरकाने की पट्टी", en: "Scroll bar side" },
				desc: {
					hi: "पन्ना सरकाने वाली पट्टी बाईं या दाईं ओर रखें।",
					en: "Keep the scroll bar on the left or the right.",
				},
			},
			{
				id: "keep-awake",
				target: t("settings-keepawake"),
				title: { hi: "स्क्रीन जगी रहे", en: "Keep screen on" },
				desc: {
					hi: "पढ़ते समय स्क्रीन अपने-आप बंद नहीं होगी।",
					en: "The screen will not switch off while you read.",
				},
			},
			{
				id: "haptics",
				target: t("settings-haptics"),
				title: { hi: "कंपन", en: "Vibrations" },
				desc: {
					hi: "बटन दबाने पर हल्का कंपन चालू या बंद करें।",
					en: "Turn the light vibration on button taps on or off.",
				},
			},
			{
				id: "feedback",
				target: t("settings-feedback"),
				title: { hi: "सुझाव / संपर्क", en: "Feedback" },
				desc: {
					hi: "कोई सुझाव या समस्या हो, तो व्हाट्सऐप पर संपर्क करें।",
					en: "Have a suggestion or a problem? Contact us on WhatsApp.",
				},
			},
			{
				id: "replay",
				target: t("settings-replay"),
				title: { hi: "सुझाव फिर से देखें", en: "See these tips again" },
				desc: {
					hi: "ये सारे सुझाव कभी भी फिर से देखने के लिए यहाँ दबाएँ।",
					en: "Tap here anytime to see all these tips again.",
				},
			},
			{
				id: "backup",
				target: t("settings-backup"),
				title: { hi: "बैकअप और रिस्टोर", en: "Backup & Restore" },
				desc: {
					hi: "एक बार Google Drive बैकअप चालू करें; फिर प्लेलिस्ट, बुकमार्क, इतिहास और सेटिंग्स अपने-आप सहेजी जाती हैं और नए फ़ोन पर वापस आ जाती हैं।",
					en: "Turn on Google Drive backup once; your playlists, bookmarks, history and settings are then saved by themselves and come back on a new phone.",
				},
			},
			{
				id: "cache",
				target: t("settings-cache"),
				optional: true,
				title: { hi: "ऐप कैश मिटाएँ", en: "Clear app cache" },
				desc: {
					hi: "ऐप ठीक से न चले, तो यह दबाएँ। खुलने वाली सूची में चुनें कि क्या मिटाना है; पहले से चुने विकल्प सुरक्षित हैं।",
					en: "If the app misbehaves, tap this. In the list that opens, choose what to clear; the ones already ticked are safe.",
				},
			},
		],
	},

	// ── Smaller screens ───────────────────────────────────────────────────
	{
		id: "information",
		version: 1,
		trigger: onOverlay("information"),
		steps: [
			{
				id: "item",
				target: t("info-item"),
				title: { hi: "सूचनाएँ", en: "Notices" },
				desc: {
					hi: "किसी सूचना पर दबाकर पूरी पढ़ें; लाल निशान वाली सूचनाएँ नई हैं।",
					en: "Tap a notice to read it in full; the red NEW mark means unread.",
				},
			},
			{
				id: "back",
				target: t("info-back"),
				title: { hi: "वापस जाएँ", en: "Go back" },
				desc: {
					hi: "होम पर लौटने के लिए यह तीर या फ़ोन का बैक बटन दबाएँ।",
					en: "Press this arrow or your phone's back button to return home.",
				},
			},
		],
	},
	{
		id: "events",
		version: 1,
		trigger: onOverlay("events"),
		steps: [
			{
				id: "month",
				target: t("events-month"),
				title: { hi: "महीना बदलें", en: "Change month" },
				desc: {
					hi: "तीरों से आगे-पीछे के महीने देखें; गोल तीर आज की तारीख पर लौटाता है।",
					en: "Use the arrows to change month; the round arrow brings you back to today.",
				},
			},
			{
				id: "grid",
				target: t("events-grid"),
				optional: true,
				title: { hi: "उत्सव और एकादशी", en: "Festivals and Ekadashi" },
				desc: {
					hi: "रंगीन तारीखों पर उत्सव या एकादशी है; तारीख दबाकर विवरण नीचे देखें।",
					en: "Coloured dates have festivals or Ekadashi; tap a date to see details below.",
				},
			},
			{
				id: "view",
				target: t("events-view"),
				title: { hi: "कैलेंडर या सूची", en: "Calendar or list" },
				desc: {
					hi: "कैलेंडर और सूची के बीच बदलें।",
					en: "Switch between the calendar and a simple list.",
				},
			},
			{
				id: "lang",
				target: t("events-lang"),
				title: { hi: "भाषा", en: "Language" },
				desc: {
					hi: "कैलेंडर हिंदी या अंग्रेज़ी में पढ़ें।",
					en: "Read the calendar in Hindi or English.",
				},
			},
		],
	},
	{
		id: "darshan",
		version: 1,
		trigger: onOverlay("darshan"),
		steps: [
			{
				id: "mandal",
				target: t("darshan-mandal"),
				title: { hi: "मंदिर चुनें", en: "Choose a temple" },
				desc: {
					hi: "मंदिर पर दबाकर दर्शन करें। तस्वीरें अपने-आप आगे बढ़ती हैं: दाईं ओर दबाएँ तो अगली, बाईं ओर तो पिछली; दबाकर रखें तो रुकेंगी; दो उँगलियों से बड़ा करें।",
					en: "Tap a temple for darshan. Photos move on by themselves: tap the right side for next, the left for previous, hold to pause, pinch to zoom.",
				},
			},
			{
				id: "grid",
				target: t("darshan-grid"),
				title: { hi: "नए दर्शन", en: "Fresh darshan" },
				desc: {
					hi: "रंगीन घेरे और लाल निशान वाले मंदिरों में नई तस्वीरें आई हैं।",
					en: "Temples with a coloured ring and a red NEW mark have new photos.",
				},
			},
		],
	},
	{
		id: "templeTimings",
		version: 1,
		trigger: onOverlay("temple-timings"),
		steps: [
			{
				id: "select",
				target: t("temple-select"),
				title: { hi: "मंदिर चुनें", en: "Choose a temple" },
				desc: {
					hi: "यहाँ से मंदिर चुनें और उसका पता व समय देखें।",
					en: "Pick a temple here to see its address and timings.",
				},
			},
			{
				id: "directions",
				target: t("temple-directions"),
				optional: true,
				title: { hi: "रास्ता देखें", en: "Get directions" },
				desc: {
					hi: "मंदिर तक पहुँचने का रास्ता यहाँ से देखें।",
					en: "Find the way to the temple from here.",
				},
			},
			{
				id: "schedule",
				target: t("temple-schedule"),
				title: { hi: "दैनिक समय-सारणी", en: "Daily schedule" },
				desc: {
					hi: "आरती और दर्शन का समय; अगला कार्यक्रम ऊपर दिखता है।",
					en: "Aarti and darshan times; the next one is shown at the top.",
				},
			},
		],
	},
	{
		id: "seva",
		version: 1,
		trigger: onOverlay("seva"),
		steps: [
			{
				id: "center",
				target: t("seva-center"),
				title: { hi: "हमारे केंद्र", en: "Our centres" },
				desc: {
					hi: "हर कार्ड में मंदिर या केंद्र का नाम और पता है।",
					en: "Each card shows a temple or centre with its address.",
				},
			},
			{
				id: "call",
				target: t("seva-call"),
				title: { hi: "फ़ोन करें", en: "Call" },
				desc: {
					hi: "नंबर दबाकर सीधे फ़ोन करें।",
					en: "Tap a number to call directly.",
				},
			},
			{
				id: "directions",
				target: t("seva-directions"),
				title: { hi: "रास्ता", en: "Directions" },
				desc: {
					hi: "'मैप पर देखें' से केंद्र तक का रास्ता खोलें; जहाँ 'लोकेशन मांगें' लिखा हो, वहाँ व्हाट्सऐप पर पता पूछें।",
					en: "'Get Directions' opens the way on the map; where it says 'Ask Location', ask for the address on WhatsApp.",
				},
			},
			{
				id: "lang",
				target: t("seva-lang"),
				title: { hi: "भाषा", en: "Language" },
				desc: {
					hi: "यह पन्ना हिंदी या अंग्रेज़ी में पढ़ें।",
					en: "Read this page in Hindi or English.",
				},
			},
		],
	},
	{
		id: "donate",
		version: 1,
		trigger: onOverlay("donate"),
		steps: [
			{
				id: "steps",
				target: t("donate-steps"),
				title: { hi: "तीन सरल चरण", en: "Three simple steps" },
				desc: {
					hi: "1. सेवा चुनें  2. यूपीआई या बैंक से भुगतान करें  3. अपना विवरण भरें, जो रसीद के लिए व्हाट्सऐप से ट्रस्ट को जाता है (इसके लिए प्रोफाइल मंज़ूर होनी चाहिए)।",
					en: "1. Choose a seva  2. Pay by UPI or bank transfer  3. Fill in your details, sent to the Trust on WhatsApp for your receipt (needs an approved profile).",
				},
			},
			{
				id: "cause",
				target: t("donate-cause"),
				title: { hi: "सेवा चुनें", en: "Choose a seva" },
				desc: {
					hi: "सेवा पर दबाकर राशि चुनें या अपनी राशि लिखें। एक से अधिक सेवाएँ भी साथ जोड़ सकते हैं।",
					en: "Tap a seva and pick an amount or type your own. You can add more than one seva together.",
				},
			},
			{
				id: "lang",
				target: t("donate-lang"),
				title: { hi: "भाषा", en: "Language" },
				desc: {
					hi: "यह पन्ना हिंदी या अंग्रेज़ी में पढ़ें।",
					en: "Read this page in Hindi or English.",
				},
			},
		],
	},
	{
		id: "videos",
		version: 1,
		trigger: onOverlay("videos"),
		steps: [
			{
				id: "folder",
				target: t("videos-folder"),
				title: { hi: "वीडियो संग्रह", en: "Video collections" },
				desc: {
					hi: "वीडियो संग्रहों में रखे हैं; किसी संग्रह पर दबाकर देखें।",
					en: "Videos are kept in collections; tap one to watch.",
				},
			},
			{
				id: "share",
				target: t("videos-share"),
				optional: true,
				title: { hi: "साझा करें", en: "Share" },
				desc: {
					hi: "पूरा संग्रह परिवार और मित्रों को भेजें।",
					en: "Send a whole collection to family and friends.",
				},
			},
		],
	},
];

/** Buttons and labels on the tooltip card. */
export const TOUR_UI_TEXT = {
	back: { hi: "पीछे", en: "Back" },
	next: { hi: "आगे", en: "Next" },
	skip: { hi: "छोड़ें", en: "Skip" },
	done: { hi: "हो गया", en: "Done" },
	whatsNew: { hi: "नया क्या है", en: "What's new" },
	backAgain: {
		hi: "ये सुझाव आपके काम के हैं। बंद करने के लिए बैक बटन फिर से दबाएँ।",
		en: "These tips are here to help. Press Back again to close them.",
	},
	stepOf: {
		hi: (n: number, total: number) => `चरण ${n}, कुल ${total}`,
		en: (n: number, total: number) => `Step ${n} of ${total}`,
	},
} as const;

/**
 * The steps to show for a chapter, given the version the person has seen.
 * Never seen → every step. Older version → only steps added since. Current
 * version → nothing (the chapter only comes back through Replay).
 */
export function stepsToShow(
	chapter: TourChapter,
	seenVersion: number,
): { steps: TourStep[]; isWhatsNew: boolean } {
	if (seenVersion >= chapter.version) return { steps: [], isWhatsNew: false };
	if (seenVersion <= 0) return { steps: chapter.steps, isWhatsNew: false };
	return {
		steps: chapter.steps.filter((s) => (s.since ?? 1) > seenVersion),
		isWhatsNew: true,
	};
}

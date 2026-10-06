export interface AuthorDef {
	deva: string; // The full name displayed when App is in Hindi mode
	iast: string; // The full name displayed when App is in English mode
}

/**
 * AUTHOR DISPLAY DEFINITIONS
 *
 * NOTE: This file is for "Display Names" only.
 * To change which songs belong to which author, edit 'data/authorMappings.ts'.
 *
 * The 'Key' (left side) here must match the key used in 'data/authorMappings.ts'.
 */

export const KNOWN_AUTHORS: Record<string, AuthorDef> = {
	// Popular / Ancient Poets
	सूरदास: { deva: "सूरदासजी", iast: "Sūradās Jī" },
	तुलसीदास: { deva: "तुलसीदासजी", iast: "Tulasīdās Jī" },
	मीरा: { deva: "मीराबाईजी", iast: "Mīrābāī Jī" },
	कबीर: { deva: "कबीरदासजी", iast: "Kabīrdās Jī" },
	रसखान: { deva: "रसखानजी", iast: "Rasakhān Jī" },
	चन्द्रसखी: { deva: "चन्द्रसखीजी", iast: "Candrasakhī Jī" },
	चंद्रसखी: { deva: "चन्द्रसखीजी", iast: "Candrasakhī Jī" },
	"चंद्र सखी": { deva: "चन्द्रसखीजी", iast: "Candrasakhī Jī" },
	विद्यापति: { deva: "विद्यापतिजी", iast: "Vidyāpati Jī" },
	जयदेव: { deva: "जयदेव गोस्वामीजी", iast: "Jayadeva Gosvāmī Jī" },
	सूरज: { deva: "सूरजदासजी", iast: "Sūrajadās Jī" },
	नारायण: { deva: "नारायण दासजी", iast: "Nārāyaṇa Dās Jī" },
	सुखदास: { deva: "सुखदासजी", iast: "Sukhadās Jī" },
	ताजली: { deva: "ताज बेगम", iast: "Tāj Begam" },
	हरिदास: { deva: "स्वामी हरिदासजी", iast: "Svāmī Haridās Jī" },
	"हित हरिवंश": { deva: "हित हरिवंश महाप्रभु", iast: "Hita Harivaṃśa Mahāprabhu" },
	नागरिदास: { deva: "नागरिदासजी", iast: "Nāgaridās Jī" },
	"ललित लहैती": { deva: "ललित लहैतीजी", iast: "Lalit Lahaitī Jī" },
	ध्रुवदास: { deva: "ध्रुवदासजी", iast: "Dhruvadās Jī" },

	// Gaudiya Acharyas & Associates
	"रूप गोस्वामी": { deva: "रूपगोस्वामी जी", iast: "Rūpa Gosvāmī Jī" },
	सनातन: { deva: "सनातनगोस्वामी जी", iast: "Sanātana Gosvāmījī" },
	जीव: { deva: "जीवगोस्वामी जी", iast: "Jīva Gosvāmī Jī" },
	रघुनाथ: { deva: "रघुनाथदास गोस्वामी", iast: "Raghunātha Dāsa Gosvāmī" },
	कृष्णदास: { deva: "कृष्णदास कविराज गोस्वामी", iast: "Kṛṣṇadāsa Kavirāja Gosvāmī" },
	नरोत्तम: { deva: "नरोत्तमदास ठाकुर", iast: "Narottama Dāsa Ṭhākura" },
	विश्वनाथ: {
		deva: "विश्वनाथ चक्रवर्ती ठाकुर",
		iast: "Viśvanātha Cakravartī Ṭhākura",
	},
	बलदेव: { deva: "बलदेवविद्याभूषण जी", iast: "Baladeva Vidyābhūṣaṇa" },
	भक्तिविनोद: { deva: "भक्तिविनोद ठाकुर", iast: "Bhaktivinoda Ṭhākura" },
	जगन्नाथ: { deva: "जगन्नाथदास बाबाजी", iast: "Jagannātha Dāsa Bābājī Mahārāja" },
	"गौर किशोर": {
		deva: "गौरकिशोरदास बाबाजी",
		iast: "Gaura Kiśora Dāsa Bābājī Mahārāja",
	},
	"भक्ति सिद्धान्त": {
		deva: "भक्तिसिद्धान्त गोस्वामी जी",
		iast: "Bhaktisiddhānta Sarasvatī Gosvāmī Mahārāja",
	},
	सरस्वती: {
		deva: "भक्तिसिद्धान्त गोस्वामी जी",
		iast: "Bhaktisiddhānta Sarasvatī Gosvāmī Mahārāja",
	},
	श्रीनिवास: { deva: "श्रीनिवास आचार्य", iast: "Śrīnivāsa Ācārya" },
	श्यामानन्द: { deva: "श्यामानन्द प्रभु", iast: "Śyāmānanda Prabhu" },
	लोचन: { deva: "लोचनदासजी", iast: "Locanadās Jī" },
	वासुदेव: { deva: "वासुदेवघोषजी", iast: "Vāsudeva Ghoṣa Jī" },
	मुरारी: { deva: "मुरारीगुप्तजी", iast: "Murārigupta Jī" },
	गोविन्द: { deva: "गोविन्ददासजी", iast: "Govindadās Jī" },
	व्यास: { deva: "व्यासदासजी", iast: "Vyāsadās Jī" },
	नयनानन्द: { deva: "नयनानन्ददास", iast: "Nayanānanda Dāsa" },
	शेखर: { deva: "शेखरराय", iast: "Kavi Śekhara" },
	यदुनाथ: { deva: "यदुनाथ दास", iast: "Yadunātha Dāsa" },
	वृन्दावनदास: { deva: "वृन्दावनदास ठाकुर", iast: "Vṛndāvana Dāsa Ṭhākura" },
	शिवानन्द: { deva: "शिवानन्दसेन", iast: "Śivānanda Sena" },
	घनश्याम: { deva: "घनश्यामदास", iast: "Ghanayśyāma Dāsa" },
	मनोहर: { deva: "मनोहरदास", iast: "Manohara Dāsa" },
	राधावल्लभ: { deva: "राधावल्लभ दास जी", iast: "Rādhāvallabha Dāsa" },
	माधव: { deva: "माधवदास", iast: "Mādhava Dāsa" },
	परमानन्द: { deva: "परमानन्ददासजी", iast: "Paramānandadās Jī" },
	कुम्भन: { deva: "कुम्भनदासजी", iast: "Kumbhanadās Jī" },
	नरहरि: { deva: "नरहरि सरकार", iast: "Narahari Sarakāra" },
	वंशीवदन: { deva: "वंशीवदन ठाकुर", iast: "Vaṃśīvadana Ṭhākura" },

	// CPBS Lineage & Local Poets
	विरही: { deva: "विरही जी महाराज", iast: "Śrī Virahī Mahārāja Jī" },
	बिरही: { deva: "विरही जी महाराज", iast: "Śrī Virahī Mahārāja Jī" },
	मधुसूदन: { deva: "मधुसूदनदास(मामाजी)", iast: "Madhusūdana Dās (Māmājī)" },
	"दास मधुसूदन": { deva: "मधुसूदनदास(मामाजी)", iast: "Madhusūdana Dās (Māmājī)" },
	"मधुसूदन दास": { deva: "मधुसूदनदास(मामाजी)", iast: "Madhusūdana Dās (Māmājī)" },
	घासीराम: { deva: "घासीराम दास जी", iast: "Ghāsīrāmadās Jī" },
	अभयराम: { deva: "अभयराम दास जी", iast: "Abhayarāma Dās Jī" },
	"कमल नैन": { deva: "कमलनैन दास जी", iast: "Kamalanainadās Jī" },
	"बृज निधि": { deva: "बृजनिधि जी", iast: "Bṛja Nidhi Jī" },
	बनवारी: { deva: "बनवारी दासजी", iast: "Banavārīdās Jī" },
	लोकनाथ: { deva: "लोकनाथदास गोस्वामीजी", iast: "Lokanātha Dāsa Gosvāmījī" },
	देवकीनंदन: { deva: "देवकीनंदन दास जी", iast: "Devakīnandanadās Jī" },
	"सरस माधुरी": { deva: "सरस माधुरी जी", iast: "Sarasa Mādhurī Jī" },
	नृसिंह: { deva: "देव नृसिंह दास जी", iast: "Deva Nṛsiṁha Dāsa" },
	पुरूषोत्तम: { deva: "पुरुषोत्तम दास जी", iast: "Puruṣottama Dāsa Jī" },
};

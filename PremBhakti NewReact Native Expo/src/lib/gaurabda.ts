import {
	Body,
	GeoVector,
	MakeTime,
	Observer,
	SearchRiseSet,
	type Vector,
} from "astronomy-engine";

export interface PanchangEvent {
	name: string;
	endTime: string;
}

export interface GaurabdaDetails {
	tithi: PanchangEvent;
	masa: string;
	masaGaudiya: string;
	gaurabdaYear: number;
	paksa: string;
	naksatra: PanchangEvent;
	yoga: PanchangEvent;
	brahmaMuhurta: string;
	sunrise: string;
	noon: string;
	sunset: string;
}

export const LOCATIONS = [
	// Madhya Pradesh
	{ name: "Bhopal, Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
	{ name: "Indore, Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
	{ name: "Jabalpur, Madhya Pradesh", lat: 23.1815, lng: 79.9864 },
	{ name: "Gwalior, Madhya Pradesh", lat: 26.2124, lng: 78.1772 },
	{ name: "Sagar, Madhya Pradesh", lat: 23.8388, lng: 78.7378 },
	{ name: "Damoh, Madhya Pradesh", lat: 23.8322, lng: 79.4441 },
	{ name: "Vidisha, Madhya Pradesh", lat: 23.5251, lng: 77.8081 },
	{ name: "Chhatarpur, Madhya Pradesh", lat: 24.916, lng: 79.5812 },

	// Rajasthan
	{ name: "Jaipur, Rajasthan", lat: 26.9124, lng: 75.7873 },
	{ name: "Kota, Rajasthan", lat: 25.2138, lng: 75.8648 },

	// Uttar Pradesh
	{ name: "Vrindavan, Uttar Pradesh", lat: 27.565, lng: 77.6593 },

	// West Bengal
	{ name: "Mayapur, West Bengal", lat: 23.425, lng: 88.393 },
	{ name: "Kolkata, West Bengal", lat: 22.5726, lng: 88.3639 },

	// Chhattisgarh
	{ name: "Raipur, Chhattisgarh", lat: 21.2514, lng: 81.6296 },
	{ name: "Bhilai, Chhattisgarh", lat: 21.1938, lng: 81.3509 },
	{ name: "Bilaspur, Chhattisgarh", lat: 22.0797, lng: 82.1409 },

	// Odisha
	{ name: "Puri, Odisha", lat: 19.8135, lng: 85.8312 },
];

const TITHI_NAMES = [
	"Pratipat",
	"Dvitiya",
	"Tritiya",
	"Chaturthi",
	"Panchami",
	"Shasti",
	"Saptami",
	"Ashtami",
	"Navami",
	"Dashami",
	"Ekadashi",
	"Dvadashi",
	"Trayodashi",
	"Chaturdashi",
	"Purnima",
	"Pratipat",
	"Dvitiya",
	"Tritiya",
	"Chaturthi",
	"Panchami",
	"Shasti",
	"Saptami",
	"Ashtami",
	"Navami",
	"Dashami",
	"Ekadashi",
	"Dvadashi",
	"Trayodashi",
	"Chaturdashi",
	"Amavasya",
];

const NAKSATRA_NAMES = [
	"Ashvini",
	"Bharani",
	"Krittika",
	"Rohini",
	"Mrigashirsha",
	"Ardra",
	"Punarvasu",
	"Pushya",
	"Ashlesha",
	"Magha",
	"Purva Phalguni",
	"Uttara Phalguni",
	"Hasta",
	"Chitra",
	"Swati",
	"Vishakha",
	"Anuradha",
	"Jyeshtha",
	"Mula",
	"Purva Ashadha",
	"Uttara Ashadha",
	"Shravana",
	"Dhanishta",
	"Shatabhisha",
	"Purva Bhadrapada",
	"Uttara Bhadrapada",
	"Revati",
];

const YOGA_NAMES = [
	"Vishkumbha",
	"Priti",
	"Ayushman",
	"Saubhagya",
	"Shobhana",
	"Atiganda",
	"Sukarma",
	"Dhriti",
	"Shula",
	"Ganda",
	"Vriddhi",
	"Dhruva",
	"Vyaghata",
	"Harshana",
	"Vajra",
	"Siddhi",
	"Vyatipata",
	"Variyan",
	"Parigha",
	"Shiva",
	"Siddha",
	"Sadhya",
	"Shubha",
	"Shukla",
	"Brahma",
	"Indra",
	"Vaidhriti",
];

const MASA_NAMES = [
	"Caitra",
	"Vaisakha",
	"Jyeshtha",
	"Ashadha",
	"Shravana",
	"Bhadrapada",
	"Ashvina",
	"Kartika",
	"Margashirsha",
	"Pausha",
	"Magha",
	"Phalguna",
];

const GAUDIYA_MASA_NAMES = [
	"Visnu",
	"Madhusudana",
	"Trivikrama",
	"Vamana",
	"Sridhara",
	"Hrishikesha",
	"Padmanabha",
	"Damodara",
	"Kesava",
	"Narayana",
	"Madhava",
	"Govinda",
];

// Fixed J2000 Lahiri Ayanamsha (Astronomy Engine uses J2000 coordinates)
const J2000_LAHIRI_AYANAMSHA = 23.85305;

const formatTime = (date: Date | null) => {
	if (!date) return "--:--:--";
	return date.toLocaleTimeString("en-IN", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
};

// --- 1. Math & Celestial Helpers ---

function getSiderealLongitude(vec: Vector): number {
	// J2000 mean obliquity
	const obl = (23.4392911 * Math.PI) / 180;
	const cosObl = Math.cos(obl);
	const sinObl = Math.sin(obl);

	const x = vec.x;
	const y = vec.y * cosObl + vec.z * sinObl;

	let lon = (Math.atan2(y, x) * 180) / Math.PI;
	if (lon < 0) lon += 360;

	return (lon - J2000_LAHIRI_AYANAMSHA + 360) % 360;
}

function getElongation(date: Date): number {
	const time = MakeTime(date);
	const sun = getSiderealLongitude(GeoVector(Body.Sun, time, true));
	const moon = getSiderealLongitude(GeoVector(Body.Moon, time, true));
	return (moon - sun + 360) % 360;
}

function getPanchangIndices(date: Date) {
	const astroTime = MakeTime(date);

	const sunVec = GeoVector(Body.Sun, astroTime, true);
	const moonVec = GeoVector(Body.Moon, astroTime, true);

	const sunSidereal = getSiderealLongitude(sunVec);
	const moonSidereal = getSiderealLongitude(moonVec);

	const diff = (moonSidereal - sunSidereal + 360) % 360;
	const tithiIndex = Math.floor(diff / 12);

	const naksatraIndex = Math.floor(moonSidereal / (360 / 27));

	const yogaAngle = (sunSidereal + moonSidereal) % 360;
	const yogaIndex = Math.floor(yogaAngle / (360 / 27));

	return { tithiIndex, naksatraIndex, yogaIndex, sunSidereal };
}

// --- 2. Boundary / End Time Finders (Optimized with Binary Search) ---

function findEndTime(
	startDate: Date,
	type: "tithi" | "naksatra" | "yoga",
	currentIndex: number,
): Date {
	let low = startDate.getTime();
	// Safely look ahead 2 days (48 hours). Events never exceed ~28 hours.
	let high = low + 2 * 24 * 60 * 60 * 1000;

	const maxVal = type === "tithi" ? 30 : 27;

	// Binary search down to 1-second precision
	while (high - low > 1000) {
		const mid = Math.floor((low + high) / 2);
		const midDate = new Date(mid);
		const indices = getPanchangIndices(midDate);
		const currentAtMid = indices[`${type}Index`];

		// Handle wrap-around (e.g., Purnima index 29 transitioning to Pratipat index 0)
		let diff = currentAtMid - currentIndex;
		if (diff < 0) diff += maxVal;

		if (diff === 0) {
			low = mid; // Boundary is further ahead
		} else {
			high = mid; // Boundary has been passed, look behind
		}
	}
	return new Date(low);
}

function findNewMoon(startDate: Date, forward: boolean): Date {
	const d = new Date(startDate.getTime());
	const stepDays = forward ? 1 : -1;

	let prevElon = getElongation(d);

	// Step day-by-day to locate the 24-hour window of the New Moon
	for (let i = 0; i < 35; i++) {
		d.setDate(d.getDate() + stepDays);
		const currentElon = getElongation(d);

		// Detect crossing the 0 / 360 boundary
		const crossed = forward
			? currentElon < prevElon && prevElon > 300
			: currentElon > prevElon && currentElon > 300;

		if (crossed) {
			// Binary search the specific 24-hour window for 1-second precision
			let low = forward ? d.getTime() - 24 * 60 * 60 * 1000 : d.getTime();
			let high = forward ? d.getTime() : d.getTime() + 24 * 60 * 60 * 1000;

			while (high - low > 1000) {
				const mid = Math.floor((low + high) / 2);
				const midElon = getElongation(new Date(mid));

				// Adjust for wrap-around during binary search
				if (midElon > 180) {
					// Before New Moon
					low = mid;
				} else {
					// After New Moon
					high = mid;
				}
			}
			return new Date(low);
		}
		prevElon = currentElon;
	}
	return startDate; // Fallback if not found (should mathematically never happen)
}

// --- 3. Main Calculator ---

export function calculateGaurabdaDetails(
	date: Date,
	latitude: number,
	longitude: number,
): GaurabdaDetails {
	const observer = new Observer(latitude, longitude, 0);

	// Start search from midnight local time to find the sunrise of the *current* day
	const startOfDay = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);
	const astroTimeStartOfDay = MakeTime(startOfDay);

	// --- SUN EVENTS FIRST (Needed for Sunrise Rule) ---
	const sunriseEvent = SearchRiseSet(
		Body.Sun,
		observer,
		+1,
		astroTimeStartOfDay,
		1,
	);
	const sunsetEvent = SearchRiseSet(
		Body.Sun,
		observer,
		-1,
		astroTimeStartOfDay,
		1,
	);

	const sunriseDate = sunriseEvent?.date ?? null;
	const sunsetDate = sunsetEvent?.date ?? null;

	let noonDate: Date | null = null;
	if (sunriseDate && sunsetDate) {
		noonDate = new Date((sunriseDate.getTime() + sunsetDate.getTime()) / 2);
	}

	let brahmaMuhurta: Date | null = null;
	if (sunriseDate) {
		brahmaMuhurta = new Date(sunriseDate.getTime() - 96 * 60 * 1000);
	}

	// --- THE SUNRISE RULE ---
	// Panchang details are dictated by what is active at Sunrise.
	const referenceDate = sunriseDate || date;
	const current = getPanchangIndices(referenceDate);

	// Tithi, Paksa, Naksatra, Yoga names (determined at Sunrise)
	const tithiName = TITHI_NAMES[current.tithiIndex];
	const paksa = current.tithiIndex < 15 ? "Gaura (Shukla)" : "Krishna";
	const naksatraName = NAKSATRA_NAMES[current.naksatraIndex];
	const yogaName = YOGA_NAMES[current.yogaIndex];

	// Calculate End Times starting from the reference point
	const tithiEnd = findEndTime(referenceDate, "tithi", current.tithiIndex);
	const naksatraEnd = findEndTime(
		referenceDate,
		"naksatra",
		current.naksatraIndex,
	);
	const yogaEnd = findEndTime(referenceDate, "yoga", current.yogaIndex);

	// --- MASA & ADHIKA MASA LOGIC ---
	const prevNM = findNewMoon(referenceDate, false);
	const nextNM = findNewMoon(referenceDate, true);

	const prevNMSunSidereal = getSiderealLongitude(
		GeoVector(Body.Sun, MakeTime(prevNM), true),
	);
	const nextNMSunSidereal = getSiderealLongitude(
		GeoVector(Body.Sun, MakeTime(nextNM), true),
	);

	const prevRashi = Math.floor(prevNMSunSidereal / 30);
	const nextRashi = Math.floor(nextNMSunSidereal / 30);

	const isAdhika = prevRashi === nextRashi;

	// FIX: If Adhika, it takes the name of the *upcoming* transit index
	const amantaMasaIndex = isAdhika ? (nextRashi + 1) % 12 : nextRashi;

	let purnimantaMasaIndex = amantaMasaIndex;
	if (paksa === "Krishna") {
		purnimantaMasaIndex = (amantaMasaIndex + 1) % 12;
	}

	const masa = isAdhika
		? `Adhika ${MASA_NAMES[purnimantaMasaIndex]}`
		: MASA_NAMES[purnimantaMasaIndex];
	const masaGaudiya = isAdhika
		? "Purusottama"
		: GAUDIYA_MASA_NAMES[purnimantaMasaIndex];

	// --- GAURABDA YEAR ---
	let gaurabdaYear = date.getFullYear() - 1486;

	// Adjust if before Gaura Purnima (If we are in late winter lunar months before Caitra)
	if (
		date.getMonth() < 4 &&
		(purnimantaMasaIndex >= 9 || purnimantaMasaIndex === 11)
	) {
		gaurabdaYear -= 1;
	}

	return {
		tithi: { name: tithiName, endTime: formatTime(tithiEnd) },
		masa,
		masaGaudiya,
		gaurabdaYear,
		paksa,
		naksatra: { name: naksatraName, endTime: formatTime(naksatraEnd) },
		yoga: { name: yogaName, endTime: formatTime(yogaEnd) },
		brahmaMuhurta: formatTime(brahmaMuhurta),
		sunrise: formatTime(sunriseDate),
		noon: formatTime(noonDate),
		sunset: formatTime(sunsetDate),
	};
}

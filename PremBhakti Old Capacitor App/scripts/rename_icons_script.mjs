import fs from "node:fs";
import path from "node:path";

const publicDir = "./public";
const homeScreenPath = "./components/HomeScreen.tsx";

const mappings = [
	["vaishnav.calender.webp", "icon-vaishnav-calendar.webp"],
	["vaishnav.calender.dark.webp", "icon-vaishnav-calendar-dark.webp"],
	["donate.webp", "icon-donate.webp"],
	["donate.dark.webp", "icon-donate-dark.webp"],
	["our.centers.webp", "icon-our-centers.webp"],
	["our.centers.dark.webp", "icon-our-centers-dark.webp"],
	["daily.information.webp", "icon-daily-quotes.webp"],
	["daily.information.dark.webp", "icon-daily-quotes-dark.webp"],
	["aboutUs.webp", "icon-about-us.webp"],
	["aboutUs.dark.webp", "icon-about-us-dark.webp"],
	["ytlogo.webp", "icon-youtube.webp"],
	["ytlogo.dark.webp", "icon-youtube-dark.webp"],
	["music.webp", "icon-bhajan-list.webp"],
	["music.dark.webp", "icon-bhajan-list-dark.webp"],
	["fblogo.webp", "icon-facebook.webp"],
	["fblogo.dark.webp", "icon-facebook-dark.webp"],
	["instlogo.webp", "icon-instagram.webp"],
	["instlogo.dark.webp", "icon-instagram-dark.webp"],
	["gallryic.webp", "icon-deity-darshan.webp"],
	["activityic.webp", "icon-our-activities.webp"],
	["activityic.dark.webp", "icon-our-activities-dark.webp"],
	["touse.webp", "icon-how-to-use.webp"],
	["touse.dark.webp", "icon-how-to-use-dark.webp"],
	["videos.webp", "icon-videos.webp"],
	["videos.dark.webp", "icon-videos-dark.webp"],
	["Audio.webp", "icon-audios.webp"],
	["Audio.dark.webp", "icon-audios-dark.webp"],
	["Books.webp", "icon-books.webp"],
	["Books.dark.webp", "icon-books-dark.webp"],
	["Library.webp", "icon-library.webp"],
	["Library.dark.webp", "icon-library-dark.webp"],
	["profile.webp", "icon-devotee-profile.webp"],
	["profile.dark.webp", "icon-devotee-profile-dark.webp"],
	["information.webp", "icon-information.webp"],
	["information.dark.webp", "icon-information-dark.webp"],
	["temple.webp", "icon-temple-timing.webp"],
	["temple.dark.webp", "icon-temple-timing-dark.webp"],
	["share.webp", "icon-share-app.webp"],
	["share.dark.webp", "icon-share-app-dark.webp"],
	["downloads.webp", "icon-downloads.webp"],
	["downloads.dark.webp", "icon-downloads-dark.webp"],
	["feedback.webp", "icon-feedback.webp"],
	["feedback.dark.webp", "icon-feedback-dark.webp"],
];

function renameFiles() {
	for (const [oldName, newName] of mappings) {
		const oldPath = path.join(publicDir, oldName);
		const newPath = path.join(publicDir, newName);

		if (fs.existsSync(oldPath)) {
			try {
				fs.renameSync(oldPath, newPath);
				console.log(`Renamed: ${oldName} -> ${newName}`);
			} catch (err) {
				console.error(`Failed to rename ${oldName}:`, err.message);
			}
		} else {
			console.log(`File not found, skipping rename: ${oldName}`);
		}
	}
}

function updateCode() {
	if (!fs.existsSync(homeScreenPath)) {
		console.error(`File not found: ${homeScreenPath}`);
		return;
	}

	let content = fs.readFileSync(homeScreenPath, "utf8");
	let updatedCount = 0;

	for (const [oldName, newName] of mappings) {
		// Replace "/oldName" with "/newName" globally
		const searchString = `/${oldName}`;
		const replaceString = `/${newName}`;

		if (content.includes(searchString)) {
			content = content.split(searchString).join(replaceString);
			updatedCount++;
		}
	}

	fs.writeFileSync(homeScreenPath, content, "utf8");
	console.log(`Updated ${updatedCount} icon references in HomeScreen.tsx`);
}

renameFiles();
updateCode();
console.log("Renaming and updating complete!");

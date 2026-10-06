import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import puppeteer from "puppeteer";

async function downloadImage(url, filename) {
	return new Promise((resolve, reject) => {
		https
			.get(url, (res) => {
				if (res.statusCode !== 200) {
					reject(new Error(`Failed to download image: ${res.statusCode}`));
					return;
				}
				const filePath = path.join(process.cwd(), "public", filename);
				const fileStream = fs.createWriteStream(filePath);
				res.pipe(fileStream);
				fileStream.on("finish", () => {
					fileStream.close();
					resolve();
				});
			})
			.on("error", reject);
	});
}

async function scrapeProfileImages() {
	console.log("Launching browser...");
	const browser = await puppeteer.launch({
		headless: "new",
		executablePath:
			"C:\\\\Users\\\\damod\\\\.cache\\\\puppeteer\\\\chrome\\\\win64-149.0.7827.22\\\\chrome-win64\\\\chrome.exe",
	});
	const page = await browser.newPage();

	try {
		// Facebook
		console.log("Navigating to Facebook...");
		await page.goto("https://www.facebook.com/chaitanyaprembhakti", {
			waitUntil: "networkidle2",
		});
		const fbOgImage = await page
			.$eval('meta[property="og:image"]', (el) => el.content)
			.catch(() => null);
		if (fbOgImage) {
			console.log("Found FB Image URL:", fbOgImage);
			await downloadImage(fbOgImage.replace(/&amp;/g, "&"), "fb_profile.webp");
			console.log("Downloaded FB Profile Image");
		} else {
			console.log("FB og:image not found");
		}

		// Instagram
		console.log("Navigating to Instagram...");
		await page.goto("https://www.instagram.com/chaitanya_prem_bhakti/?hl=en", {
			waitUntil: "networkidle2",
		});
		const igOgImage = await page
			.$eval('meta[property="og:image"]', (el) => el.content)
			.catch(() => null);
		if (igOgImage) {
			console.log("Found IG Image URL:", igOgImage);
			await downloadImage(igOgImage.replace(/&amp;/g, "&"), "ig_profile.webp");
			console.log("Downloaded IG Profile Image");
		} else {
			console.log("IG og:image not found");
		}
	} catch (err) {
		console.error("Error during scraping:", err);
	} finally {
		await browser.close();
	}
}

scrapeProfileImages();

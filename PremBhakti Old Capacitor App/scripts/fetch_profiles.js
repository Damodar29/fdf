const https = require("node:https");
const _fs = require("node:fs");

function fetchOgImage(url, prefix) {
	https
		.get(url, (res) => {
			let data = "";
			res.on("data", (chunk) => (data += chunk));
			res.on("end", () => {
				const match = data.match(/<meta property="og:image" content="([^"]+)"/);
				if (match) {
					const imgUrl = match[1].replace(/&amp;/g, "&");
					console.log(`${prefix} OG Image:`, imgUrl);
				} else {
					console.log(`${prefix} OG Image not found`);
					// Let's just dump first 1000 chars of HTML
					console.log(data.substring(0, 1000));
				}
			});
		})
		.on("error", (err) => console.log("Error:", err.message));
}

fetchOgImage("https://www.facebook.com/chaitanyaprembhakti", "FB");
fetchOgImage("https://www.instagram.com/chaitanya_prem_bhakti/?hl=en", "IG");

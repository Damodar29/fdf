const ftp = require("basic-ftp");
const path = require("node:path");

async function deploy() {
	const client = new ftp.Client();
	client.ftp.verbose = true;
	try {
		console.log("Connecting to FTP...");
		await client.access({
			host: "138.201.124.171",
			user: "chaitanyaprembha",
			password: "aMKGD&=q%3_E",
			secure: false,
		});

		console.log("Connected! Uploading dist folder to public_html...");

		// Ensure public_html exists (it should by default on cPanel)
		await client.ensureDir("public_html");

		// Clear old files if necessary, but uploadFromDir usually overwrites
		// Upload dist folder contents to public_html
		await client.uploadFromDir(path.join(__dirname, "dist"));

		console.log("Upload completed successfully!");
	} catch (err) {
		console.error("FTP Error:", err);
	}
	client.close();
}

deploy();

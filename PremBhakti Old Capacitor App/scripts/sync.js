const { execSync } = require("node:child_process");

console.log("🚀 Starting GitHub Sync...");

try {
	// 1. Stage all changes
	console.log("\n[1/3] Files ko Git me add kar raha hu (git add .)...");
	execSync("git add .", { stdio: "inherit" });

	// 2. Commit changes
	// Check if there are changes to commit
	try {
		const date = new Date().toLocaleString("en-IN");
		console.log(`\n[2/3] Changes ko save kar raha hu (git commit)...`);
		execSync(`git commit -m "Auto-sync on ${date}"`, { stdio: "inherit" });
	} catch (commitError) {
		if (commitError.stdout?.toString().includes("nothing to commit")) {
			console.log(
				"\n⚠️ Koi naye changes nahi hain upload karne ke liye. Sab kuch pehle se sync hai!",
			);
			process.exit(0);
		} else if (commitError.status === 1) {
			// Exit code 1 for git commit usually means nothing to commit
			console.log(
				"\n⚠️ Koi naye changes nahi hain upload karne ke liye. Sab kuch pehle se sync hai!",
			);
			process.exit(0);
		} else {
			throw commitError; // Re-throw if it's a real error
		}
	}

	// 3. Push to GitHub
	console.log(
		"\n[3/3] GitHub par upload kar raha hu (git push origin main)...",
	);
	execSync("git push origin main", { stdio: "inherit" });

	console.log(
		"\n✅ SUCCESS! Aapka saara code GitHub par successfully upload (sync) ho gaya hai.",
	);
} catch (error) {
	console.error("\n❌ ERROR: Kuch gadbad hui hai upload karne mein:");
	console.error(error.message);
}

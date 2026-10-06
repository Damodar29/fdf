/**
 * patch-media-session.cjs
 * ─────────────────────────────────────────────────────────────────────
 * Post-install patch for @capgo/capacitor-media-session.
 *
 * Android 12+ (API 31) throws ForegroundServiceStartNotAllowedException
 * when a foreground service is started while the app is in the background.
 * The plugin's MediaSessionService.ensureNotificationAndForeground() calls
 * startForeground() without a try/catch, crashing the app.
 *
 * This patch wraps the startForeground() calls in a try/catch that logs
 * the error instead of letting the app crash.
 * ─────────────────────────────────────────────────────────────────────
 */

const fs = require("node:fs");
const path = require("node:path");

const targetPath = path.join(
	__dirname,
	"..",
	"node_modules",
	"@capgo",
	"capacitor-media-session",
	"android",
	"src",
	"main",
	"java",
	"com",
	"capgo",
	"mediasession",
	"MediaSessionService.java",
);

if (!fs.existsSync(targetPath)) {
	console.log(`[patch-media-session] File not found, skipping: ${targetPath}`);
	process.exit(0);
}

let source = fs.readFileSync(targetPath, "utf8");

// ── Check if already patched ──────────────────────────────────────────────────
if (source.includes("ForegroundServiceStartNotAllowedException")) {
	console.log("[patch-media-session] Already patched, skipping.");
	process.exit(0);
}

// ── Patch: wrap startForeground() calls in try/catch ──────────────────────────
// The original code in ensureNotificationAndForeground():
//
//   if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
//       startForeground(NOTIFICATION_ID, notificationBuilder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
//   } else {
//       startForeground(NOTIFICATION_ID, notificationBuilder.build());
//   }
//
// We replace it with a try/catch that catches the Android 12+ exception.

const oldBlock = `        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notificationBuilder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notificationBuilder.build());
        }`;

const newBlock = `        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notificationBuilder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notificationBuilder.build());
            }
        } catch (Exception e) {
            // Android 12+ throws ForegroundServiceStartNotAllowedException when
            // starting a foreground service while the app is in the background.
            // Catch it gracefully instead of crashing the app.
            Log.w(TAG, "startForeground failed (likely background restriction on Android 12+): " + e.getMessage());
        }`;

if (source.includes(oldBlock)) {
	source = source.replace(oldBlock, newBlock);
	fs.writeFileSync(targetPath, source, "utf8");
	console.log(
		"[patch-media-session] ✅ Successfully patched startForeground() with try/catch.",
	);
} else {
	console.log(
		"[patch-media-session] ⚠️  Could not find the exact code block to patch. The plugin may have been updated.",
	);
	console.log(
		"[patch-media-session]    Please verify MediaSessionService.java manually.",
	);
}

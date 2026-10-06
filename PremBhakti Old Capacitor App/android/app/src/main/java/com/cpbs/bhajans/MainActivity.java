package com.cpbs.bhajans;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.cpbs.bhajans.plugins.BigPictureNotificationPlugin;
import com.cpbs.bhajans.plugins.NativeDownloadPlugin;
import com.cpbs.bhajans.plugins.NativeUploadPlugin;
import com.cpbs.bhajans.plugins.CrashlyticsPlugin;
import com.cpbs.bhajans.plugins.DriveAuthPlugin;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import androidx.fragment.app.DialogFragment;
import androidx.fragment.app.Fragment;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    // ── GMS Dialog Guard ────────────────────────────────────────────────────────
    // Set to true after first successful GMS warmup. Reset in onStop() so next
    // foreground transition triggers a fresh warmup if GMS went stale.
    private boolean gmsWarmedUp = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BigPictureNotificationPlugin.class);
        registerPlugin(NativeDownloadPlugin.class);
        registerPlugin(NativeUploadPlugin.class);
        registerPlugin(CrashlyticsPlugin.class);
        registerPlugin(DriveAuthPlugin.class);
        super.onCreate(savedInstanceState);

        // ── One-time cache migration for users upgrading to Version 41 ──
        android.content.SharedPreferences prefs = getSharedPreferences("AppPrefs",
                android.content.Context.MODE_PRIVATE);
        int lastRunVersion = prefs.getInt("last_native_run_version", 0);
        int currentVersion = BuildConfig.VERSION_CODE;

        if (lastRunVersion < 41) {
            android.util.Log.i(TAG, "[AppUpgrade] Version < 41 detected. Running one-time cache migration.");

            // 1. Clear Capacitor SharedPreferences caches (gh_ and firestore_cache_ keys)
            android.content.SharedPreferences capPrefs = getSharedPreferences("CapacitorStorage",
                    android.content.Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = capPrefs.edit();
            for (String key : capPrefs.getAll().keySet()) {
                if (key.startsWith("firestore_cache_") || key.startsWith("gh_")
                        || key.equals("cpbs_cache_last_cleanup")) {
                    editor.remove(key);
                }
            }
            editor.apply();

            // 2. Clear the WebView's app cache directory
            clearCacheDir(getCacheDir());

            // 3. *** CRITICAL FIX ***
            // Clear WebView's IndexedDB — this is where Firestore's persistentLocalCache
            // stores its data. A corrupt/old Firestore IndexedDB from a previous app version
            // causes firebase.ts createFirestore() to fall back to memoryLocalCache(),
            // which results in DailyDarshanScreen and ActivitiesScreen showing
            // "Something went wrong" on first open after an update.
            // We ONLY clear the IndexedDB folder, NOT localStorage (user settings are safe).
            java.io.File webViewDataDir = new java.io.File(getApplicationInfo().dataDir, "app_webview");
            java.io.File indexedDbDir = new java.io.File(webViewDataDir, "Default/IndexedDB");
            clearCacheDir(indexedDbDir);

            prefs.edit().putInt("last_native_run_version", currentVersion).apply();
            android.util.Log.i(TAG, "[AppUpgrade] Migration complete.");
        } else if (lastRunVersion != currentVersion) {
            // Future updates — just save the new version
            prefs.edit().putInt("last_native_run_version", currentVersion).apply();
        }

        // Request POST_NOTIFICATIONS permission on Android 13+ so upload progress shows
        // in the status bar
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (androidx.core.content.ContextCompat.checkSelfPermission(this,
                    android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                androidx.core.app.ActivityCompat.requestPermissions(this,
                        new String[] { android.Manifest.permission.POST_NOTIFICATIONS }, 101);
            }
        }

        // ── WebView performance tuning for low-end devices ─────────────────────
        // Must be called after super.onCreate() so the Bridge/WebView is initialized.
        configureWebView();

        // Handle notification if app was opened from one (fresh start)
        Intent intent = getIntent();
        if (intent != null) {
            if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) {
                clearNotificationExtras(intent);
                setIntent(intent);
            } else {
                BigPictureNotificationPlugin.handleIntent(intent);
                scheduleNotificationExtrasCleanup();
            }
        }
    }

    /**
     * Configures the Capacitor WebView for low-end devices
     * (Snapdragon 4xx / Helio G85, 2-3 GB RAM).
     *
     * Key changes vs defaults:
     * - setDomStorageEnabled: Required for Firebase JS SDK internal caching
     * - OVER_SCROLL_NEVER: Removes costly overscroll glow effect on low-end GPUs
     *
     * Deliberately NOT set here (see inline notes below):
     * - LAYER_TYPE_HARDWARE — caused blank first frames
     * - LOAD_CACHE_ELSE_NETWORK — served stale bundles after an OTA push
     */
    private void configureWebView() {
        try {
            WebView wv = getBridge().getWebView();
            if (wv == null)
                return;

            // ── Do NOT force a hardware layer on the WebView ─────────────────────
            // wv.setLayerType(View.LAYER_TYPE_HARDWARE, null) used to be set here
            // "for smooth animations". It does the opposite of what it advertises:
            // it makes the WebView render into an off-screen FBO instead of using
            // WebView's own accelerated tiled draw path. On many devices the first
            // frame then comes up blank and only repaints once something forces a
            // redraw — locking and unlocking the phone being the classic trigger.
            // The window already has android:hardwareAccelerated="true" in the
            // manifest, which is what actually provides GPU compositing.

            // Disable overscroll glow effect (expensive on Mali/Adreno 4xx GPUs)
            wv.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);

            WebSettings settings = wv.getSettings();

            // ── Cache mode: leave at the default (LOAD_DEFAULT) ──────────────────
            // LOAD_CACHE_ELSE_NETWORK used to be set here for "instant reloads".
            // It serves any cached entry regardless of freshness, which breaks OTA
            // updates: after a Capgo bundle swap the WebView can serve a stale
            // index.html that references hash-named JS chunks no longer on disk,
            // producing a white screen. LOAD_DEFAULT still serves from cache, but
            // honours HTTP cache headers so a changed index.html is picked up.
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);

            // Required for Firebase JS SDK internal caching and localStorage
            settings.setDomStorageEnabled(true);
            // Note: setDatabaseEnabled() is deprecated since API 19 and a no-op
            // since API 30 — removed to avoid WebView thread warnings on Android 8 devices.

        } catch (Exception e) {
            // Non-fatal: app works without tuning, just less optimized
            android.util.Log.w(TAG, "WebView tuning failed (non-fatal): " + e.getMessage());
        }
    }

    @Override
    public void onResume() {
        super.onResume();

        // ── 1. Resume WebView JS engine ──────────────────────────────────────────
        // On some OEM devices (Xiaomi MIUI, Samsung OneUI), JS timers fire at
        // reduced frequency after backgrounding. wv.onResume() restores normal
        // timer resolution so audio playback and UI updates work correctly.
        try {
            WebView wv = getBridge().getWebView();
            if (wv != null)
                wv.onResume();
        } catch (Exception e) {
            android.util.Log.w(TAG, "WebView onResume failed (non-fatal): " + e.getMessage());
        }

        // ── 2. CRITICAL: Dismiss any GMS error dialogs silently ──────────────────
        //
        // ROOT CAUSE of "Something went wrong - Check that Google Play is enabled":
        //
        // When app resumes from background/recents, Firebase Auth internally checks
        // GMS availability. If the GMS connection is stale (common after 30+ min in
        // background on low-RAM devices), the GMS SDK queues an ErrorDialogFragment
        // to show "Something went wrong". Pressing CLOSE just closes the dialog —
        // there is NO user-actionable fix, making it completely confusing.
        //
        // PREVIOUS WRONG FIX: We called makeGooglePlayServicesAvailable() which
        // ITSELF shows this dialog when the connection is stale. That was the bug.
        //
        // CORRECT FIX: Scan the FragmentManager, find any GMS ErrorDialogFragments,
        // and dismiss them before they become visible. The app continues to work
        // normally because Firestore uses experimentalForceLongPolling which does
        // NOT require an active GMS connection.
        dismissGmsErrorDialogs();

        // ── 3. Warm up Firebase Auth on resume (not just onStart) ────────────────
        // This eliminates the race condition where: user quickly switches to app →
        // onStart fires → WebView loads → Firebase JS SDK starts GMS check →
        // BEFORE onStart's warmup completes. Running warmup in onResume ensures
        // it happens at the right time in the Activity lifecycle.
        if (!gmsWarmedUp) {
            warmUpFirebaseAuth();
        }
    }

    /**
     * Silently dismiss any GMS/Firebase error dialogs queued for display.
     *
     * This is the primary defense against the "Something went wrong" dialog.
     * We find ErrorDialogFragment instances (shown by GMS SDK or Firebase Auth
     * internally) and dismiss them before the user sees them.
     *
     * WHY THIS IS SAFE:
     * - The dialog has only a CLOSE button — no actionable resolution for user.
     * - App continues working via Firestore's experimentalForceLongPolling.
     * - GMS connection re-establishes itself automatically within seconds.
     * - Users with fully working GMS never see the dialog anyway.
     */
    private void dismissGmsErrorDialogs() {
        try {
            List<Fragment> fragments = getSupportFragmentManager().getFragments();
            for (Fragment fragment : fragments) {
                if (fragment == null)
                    continue;
                String className = fragment.getClass().getName();

                // Match GMS ErrorDialogFragment and Firebase Auth internal dialogs.
                // The obfuscated class names (zza, zzb, etc.) are GMS internal classes
                // that vary by GMS version — matching by tag is more reliable.
                boolean isGmsDialog = className.contains("ErrorDialogFragment")
                        || className.contains("SupportErrorDialogFragment");

                boolean hasGmsTag = fragment.getTag() != null
                        && (fragment.getTag().contains("GooglePlayServices")
                                || fragment.getTag().contains("gms_")
                                || fragment.getTag().contains("google_play"));

                if ((isGmsDialog || hasGmsTag) && fragment instanceof DialogFragment) {
                    android.util.Log.i(TAG,
                            "Silently dismissing GMS error dialog: " + className
                                    + " tag=" + fragment.getTag());
                    try {
                        ((DialogFragment) fragment).dismissAllowingStateLoss();
                    } catch (Exception innerEx) {
                        android.util.Log.w(TAG,
                                "Could not dismiss GMS fragment: " + innerEx.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.w(TAG,
                    "dismissGmsErrorDialogs failed (non-fatal): " + e.getMessage());
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        // ── Background Audio Fix ────────────────────────────────────────────────
        // Capacitor's BridgeActivity.onStop() calls bridge.onStop() → webView.onPause()
        // which suspends the JS engine AND pauses all HTML <audio> elements.
        // Calling wv.onResume() immediately counteracts this and keeps audio alive
        // during background execution. WebView is not visible so no rendering cost.
        // The MediaSession service lifecycle is handled separately by stopMediaService().
        try {
            WebView wv = getBridge().getWebView();
            if (wv != null)
                wv.onResume();
        } catch (Exception e) {
            android.util.Log.w(TAG, "WebView re-resume in onStop failed (non-fatal): " + e.getMessage());
        }

        // Reset warmup flag so next foreground transition performs a fresh warmup.
        // After 30+ min in background, GMS connection goes stale and needs re-warming.
        gmsWarmedUp = false;

        // Clean notification extras when the user leaves the app so that any
        // subsequent relaunch from the home screen icon has a clean Intent.
        Intent currentIntent = getIntent();
        if (currentIntent != null) {
            clearNotificationExtras(currentIntent);
            setIntent(currentIntent);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        // ── GMS Availability Check — SILENT, no dialogs ─────────────────────────
        //
        // IMPORTANT: We do NOT call makeGooglePlayServicesAvailable() here.
        // That method INTERNALLY calls showErrorDialogFragment() when GMS is stale,
        // which was the root cause of the "Something went wrong" dialog.
        //
        // Strategy: Check availability silently. If available → warm up Firebase.
        // If NOT available → log it and do nothing. The app recovers on its own
        // via Firestore's experimentalForceLongPolling (no GMS required).
        // Any dialogs GMS tries to show get intercepted in onResume().

        GoogleApiAvailability gmsApi = GoogleApiAvailability.getInstance();
        int resultCode = gmsApi.isGooglePlayServicesAvailable(this);

        if (resultCode == ConnectionResult.SUCCESS) {
            android.util.Log.d(TAG, "GMS available on onStart. Pre-warming Firebase Auth.");
            warmUpFirebaseAuth();
        } else {
            // GMS temporarily unavailable (stale connection after process death,
            // or GMS updating in background). This is normal and self-healing.
            // DO NOT call makeGooglePlayServicesAvailable() — that shows the dialog.
            android.util.Log.w(TAG,
                    "GMS not available on onStart (code=" + resultCode
                            + ": " + gmsApi.getErrorString(resultCode)
                            + "). App will use Firestore long-polling fallback. "
                            + "Any GMS dialogs will be dismissed in onResume().");
        }
    }

    /**
     * Pre-warms the Firebase Auth GMS connection using the cached token.
     *
     * Uses force=false (cached token) because we just need to establish the
     * GMS IPC channel, not actually contact auth servers. force=true was
     * causing an unnecessary network round-trip on every app resume.
     */
    private void warmUpFirebaseAuth() {
        try {
            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            if (user != null) {
                user.getIdToken(false) // false = use cached token, just warm up GMS IPC
                        .addOnSuccessListener(result -> {
                            android.util.Log.d(TAG, "Firebase Auth GMS warm-up complete.");
                            gmsWarmedUp = true;
                        })
                        .addOnFailureListener(e -> android.util.Log.w(TAG,
                                "Firebase Auth warm-up failed (non-fatal, app still works): "
                                        + e.getMessage()));
            } else {
                // Anonymous / not logged in — GMS warmup not needed
                android.util.Log.d(TAG, "No Firebase user — skipping GMS warm-up.");
                gmsWarmedUp = true;
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "warmUpFirebaseAuth threw (non-fatal): " + e.getMessage());
            gmsWarmedUp = true; // Prevent infinite retry loop
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) {
            clearNotificationExtras(intent);
            setIntent(intent);
            return;
        }
        setIntent(intent);

        // Handle notification if app was already running in background
        BigPictureNotificationPlugin.handleIntent(intent);
        scheduleNotificationExtrasCleanup();
    }

    /**
     * Clears all push notification, FCM, BigPicture, and deep link extras from the Intent.
     * This prevents Android from re-delivering stale notification extras when the app is
     * closed and later freshly opened from the home screen launcher icon.
     */
    private void clearNotificationExtras(Intent intent) {
        if (intent == null) return;
        String[] keysToClear = {
            "google.message_id",
            "google.sent_time",
            "google.ttl",
            "google.original_priority",
            "google.delivered_priority",
            "from",
            "gcm.notification.data",
            "gcm.n.e",
            "gcm.notification.title",
            "gcm.notification.body",
            "collapse_key",
            "action_type",
            "target_screen",
            "target_link",
            "target_mandal",
            "target_date",
            "target_info_id",
            "type",
            "screen",
            "link",
            "notification_action",
            "notification_screen",
            "notification_link",
            "bhajanId",
            "lectureId",
            "videoFolder",
            "videoId"
        };
        for (String key : keysToClear) {
            intent.removeExtra(key);
        }
        android.util.Log.i(TAG, "Stale notification extras cleared from Intent.");
    }



    /**
     * Schedules removal of notification extras from getIntent() after 3 seconds so that
     * plugins can read the launch notification on initial startup, but subsequent app
     * relaunches from the home screen icon will never re-trigger the stale notification.
     */
    private void scheduleNotificationExtrasCleanup() {
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            if (isFinishing() || isDestroyed()) return;
            Intent currentIntent = getIntent();
            if (currentIntent != null) {
                clearNotificationExtras(currentIntent);
                setIntent(currentIntent);
            }
        }, 3000);
    }

    /**
     * Recursively deletes all files in the given directory.
     */
    private void clearCacheDir(java.io.File dir) {
        if (dir == null || !dir.isDirectory()) return;
        java.io.File[] children = dir.listFiles();
        // listFiles() can return null if the OS removes the dir between
        // isDirectory() and listFiles() — guard to prevent NullPointerException.
        if (children == null) return;
        try {
            for (java.io.File child : children) {
                if (child.isDirectory()) {
                    clearCacheDir(child);
                }
                child.delete();
            }
        } catch (Exception e) {
            android.util.Log.e(TAG, "Failed to clear cache dir", e);
        }
    }
}

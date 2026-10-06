package com.cpbs.bhajans;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.StrictMode;
import androidx.appcompat.app.AppCompatDelegate;
import com.cpbs.bhajans.BuildConfig;

public class MainApplication extends Application {

        // Channel IDs are version-specific so Android creates a fresh channel
        // (with correct sound) on every app update. Existing channels cannot
        // have their sound changed — only a new channel ID forces a reset.

        public static final String PUSH_CHANNEL_ID_V6 = "push_notifications_v6";
        public static final String QUOTE_CHANNEL_ID = "daily_quote_v6";
        public static final String SILENT_CHANNEL_ID = "silent_alerts_v4";

        @Override
        public void onCreate() {
                super.onCreate();

                // ── Force Light Mode ──────────────────────────────────────────────────
                // Web app dark mode support nahi hai. Agar Android dark mode mein ho,
                // toh status bar / nav bar native UI galat color mein dikhta hai.
                // MODE_NIGHT_NO se hamesha light mode enforce hota hai — status bar
                // aur nav bar par dark icons aur cream background sahi dikhte hain.
                // IMPORTANT: Must be called AFTER super.onCreate() — calling it before
                // super triggers a uiMode config-change cascade on dark-mode devices
                // (Xiaomi MIUI, Vivo FuntouchOS) that can cause a screen flicker on boot.
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
                // ─────────────────────────────────────────────────────────────────────

                // ── StrictMode (DEBUG only) ───────────────────────────────────────────
                // Catches accidental main-thread disk/network I/O and unclosed Closeables
                // during development. Zero cost in release builds — stripped by R8.
                if (BuildConfig.DEBUG) {
                        StrictMode.setThreadPolicy(new StrictMode.ThreadPolicy.Builder()
                                        .detectAll() // disk reads/writes, network, slow calls
                                        .penaltyLog() // Logcat only — never crash release builds
                                        .build());
                        StrictMode.setVmPolicy(new StrictMode.VmPolicy.Builder()
                                        .detectLeakedSqlLiteObjects()
                                        .detectLeakedClosableObjects()
                                        .penaltyLog()
                                        .build());
                }
                // ─────────────────────────────────────────────────────────────────────

                // Register ALL notification channels here, at the earliest possible
                // point in the app lifecycle. This ensures channels exist before any
                // notification arrives — even if it arrives via AlarmManager (no Activity)
                // or FCM while the app is killed (service-only wake).
                createNotificationChannels();
        }

        private void createNotificationChannels() {
                // minSdkVersion = 26 = Build.VERSION_CODES.O, so NotificationChannel is
                // ALWAYS available — no SDK_INT guard needed.
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null)
                        return;


                android.net.Uri soundUri2 = android.net.Uri.parse(
                                android.content.ContentResolver.SCHEME_ANDROID_RESOURCE
                                                + "://" + getPackageName() + "/raw/notisound3");

                android.media.AudioAttributes audioAttr = new android.media.AudioAttributes.Builder()
                                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                                .build();



                // ── 1b. FCM Push Notifications channel (with new sound) ───────────────────
                NotificationChannel pushChannelV6 = new NotificationChannel(
                                PUSH_CHANNEL_ID_V6,
                                "Push Notifications",
                                NotificationManager.IMPORTANCE_HIGH);
                pushChannelV6.setDescription("Admin-sent push notifications with new sound");
                pushChannelV6.setSound(soundUri2, audioAttr);
                pushChannelV6.enableVibration(true);
                pushChannelV6.enableLights(true);
                nm.createNotificationChannel(pushChannelV6);

                // ── 2. Daily Quote / BigPicture Notifications channel (with sound) ────
                NotificationChannel quoteChannel = new NotificationChannel(
                                QUOTE_CHANNEL_ID,
                                "Daily Quote",
                                NotificationManager.IMPORTANCE_HIGH);
                quoteChannel.setDescription("Daily spiritual quote notifications");
                quoteChannel.setSound(soundUri2, audioAttr);
                quoteChannel.enableVibration(true);
                quoteChannel.enableLights(true);
                nm.createNotificationChannel(quoteChannel);

                // ── 3. Silent Notifications channel (no sound, no vibration) ──────────
                // Used for: Info Screen updates, Darshan, Activity alerts
                NotificationChannel silentChannel = new NotificationChannel(
                                SILENT_CHANNEL_ID,
                                "Updates & Alerts",
                                NotificationManager.IMPORTANCE_DEFAULT);
                silentChannel.setDescription("Silent updates: info screen, darshan, activities");
                silentChannel.setSound(null, null); // no sound
                silentChannel.enableVibration(false); // no vibration
                silentChannel.enableLights(false);
                nm.createNotificationChannel(silentChannel);
        }
}

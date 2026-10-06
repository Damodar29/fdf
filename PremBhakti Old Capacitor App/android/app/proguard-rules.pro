# ─── Capacitor Core ───────────────────────────────────────────────────────────
# Keep all plugin classes — they are referenced by name from JavaScript at runtime
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# ─── App Plugin Classes ───────────────────────────────────────────────────────
-keep class com.cpbs.bhajans.** { *; }

# ─── Firebase ─────────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─── Firebase Messaging ───────────────────────────────────────────────────────
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }

# ─── WebView JavaScript Interface ─────────────────────────────────────────────
# JS can call @JavascriptInterface methods by name — must not be renamed/removed
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── AndroidX / AppCompat ────────────────────────────────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**

# ─── Capacitor Community Plugins ─────────────────────────────────────────────
-keep class com.capacitorjs.** { *; }
-keep class com.capgo.** { *; }

# ─── Debugging: preserve line numbers in crash stack traces ──────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ─── Suppress common warnings from third-party libs ──────────────────────────
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**

# ─── Facebook SDK (referenced by capacitor-firebase-authentication plugin) ────
# We do not use Facebook login, but the plugin bundles a FacebookAuthProviderHandler
# that references the Facebook SDK. Since we don't include the Facebook SDK as a
# dependency, R8 would fail without these rules. -dontwarn suppresses the errors
# so R8 can still safely strip out the unused Facebook auth code.
-dontwarn com.facebook.**
-keep class com.facebook.** { *; }

package com.cpbs.bhajans.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import android.util.Log;

@CapacitorPlugin(name = "Crashlytics")
public class CrashlyticsPlugin extends Plugin {

    @PluginMethod
    public void log(PluginCall call) {
        String message = call.getString("message");
        try {
            if (message != null) {
                FirebaseCrashlytics.getInstance().log(message);
                call.resolve();
            } else {
                call.reject("Must provide a message");
            }
        } catch (Exception e) {
            // Fallback logging if Firebase fails
            Log.e("CrashlyticsPlugin", "Failed to log message", e);
            call.resolve(); // Still resolve to prevent app crash
        }
    }

    @PluginMethod
    public void setUserId(PluginCall call) {
        String userId = call.getString("userId");
        try {
            if (userId != null) {
                FirebaseCrashlytics.getInstance().setUserId(userId);
                call.resolve();
            } else {
                call.reject("Must provide a userId");
            }
        } catch (Exception e) {
            Log.e("CrashlyticsPlugin", "Failed to set user ID", e);
            call.resolve(); // Still resolve to prevent app crash
        }
    }

    @PluginMethod
    public void recordException(PluginCall call) {
        String message = call.getString("message");
        String stack = call.getString("stack");

        try {
            if (message != null) {
                // Truncate to prevent oversized payloads from crashing Crashlytics internals.
                // Firebase Crashlytics has internal limits; cap early to be safe.
                if (message.length() > 1024) {
                    message = message.substring(0, 1024) + "…";
                }
                if (stack != null && stack.length() > 4096) {
                    stack = stack.substring(0, 4096) + "…";
                }

                FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();

                // Log the full JS stack trace to Crashlytics "Logs" tab first.
                // Crashlytics calls Java's getStackTrace() internally which shows
                // the Java creation site, NOT the JS stack. Logging it explicitly
                // ensures it's always visible in the Crashlytics dashboard.
                if (stack != null && !stack.isEmpty()) {
                    crashlytics.log("JS Stack Trace:\n" + stack);
                }
                crashlytics.recordException(new JavaScriptException(message, stack));
                call.resolve();
            } else {
                call.reject("Must provide a message");
            }
        } catch (Exception e) {
            // Fallback logging if Firebase fails
            Log.e("CrashlyticsPlugin", "Failed to record exception", e);
            call.resolve(); // Still resolve to prevent app crash
        }
    }

    /**
     * Custom exception class to display JavaScript errors in Crashlytics.
     * The stack is logged separately via crashlytics.log() before recording.
     */
    private static class JavaScriptException extends Exception {
        private final String jsStack;

        public JavaScriptException(String message, String jsStack) {
            super(message);
            this.jsStack = jsStack;
        }

        @Override
        public String toString() {
            return "JavaScriptException: " + getMessage()
                    + (jsStack != null ? "\n" + jsStack : "");
        }
    }
}

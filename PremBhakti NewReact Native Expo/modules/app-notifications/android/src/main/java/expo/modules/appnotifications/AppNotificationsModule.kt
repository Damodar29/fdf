package expo.modules.appnotifications

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Notification taps and the notification setting, for src/lib/notifications.ts.
 * A tap opens the app with the push data as intent extras (PushMessagingService,
 * or FCM itself for pushes shown while the app was closed).
 */
class AppNotificationsModule : Module() {
  private fun tapData(intent: Intent?): Map<String, String>? {
    val extras = intent?.extras ?: return null
    if (!extras.containsKey("google.message_id")) return null
    val data = mutableMapOf<String, String>()
    for (key in extras.keySet()) {
      @Suppress("DEPRECATION")
      val value = extras.get(key)
      if (value is String) data[key] = value
    }
    // Read once: a later launch from the home screen must not repeat it.
    intent.replaceExtras(Bundle())
    return data
  }

  override fun definition() = ModuleDefinition {
    Name("AppNotifications")
    Events("onNotificationTap")

    OnCreate {
      appContext.reactContext?.let { Channels.createAll(it) }
    }

    /** The push the app was opened from, once. */
    Function("takeLaunchData") {
      tapData(appContext.currentActivity?.intent)
    }

    OnNewIntent { intent ->
      tapData(intent)?.let { sendEvent("onNotificationTap", it) }
    }

    Function("areEnabled") {
      val context = appContext.reactContext ?: return@Function false
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    Function("openSettings") {
      appContext.reactContext?.let { context ->
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      null
    }
  }
}

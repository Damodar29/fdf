package expo.modules.appnotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri

/** The Capacitor app's notification channels (MainApplication.createNotificationChannels). */
object Channels {
  const val PUSH = "push_notifications_v6"
  const val QUOTE = "daily_quote_v6"
  const val SILENT = "silent_alerts_v4"

  fun soundUri(context: Context): Uri =
    Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/raw/notisound3")

  private fun audio() = AudioAttributes.Builder()
    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
    .build()

  fun createAll(context: Context) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    nm.createNotificationChannel(
      NotificationChannel(PUSH, "Push Notifications", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Admin-sent push notifications with new sound"
        setSound(soundUri(context), audio())
        enableVibration(true)
        enableLights(true)
      },
    )
    nm.createNotificationChannel(
      NotificationChannel(QUOTE, "Daily Quote", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Daily spiritual quote notifications"
        setSound(soundUri(context), audio())
        enableVibration(true)
        enableLights(true)
      },
    )
    nm.createNotificationChannel(
      NotificationChannel(SILENT, "Updates & Alerts", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Silent updates: info screen, darshan, activities"
        setSound(null, null)
        enableVibration(false)
        enableLights(false)
      },
    )
  }

  /** A push may name its own channel; it is created like the Capacitor app did when new. */
  fun ensure(context: Context, id: String) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    if (nm.getNotificationChannel(id) != null) return
    if (id == PUSH || id == QUOTE || id == SILENT) {
      createAll(context)
      return
    }
    nm.createNotificationChannel(
      NotificationChannel(id, "Push Notifications", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Admin-sent push notifications"
        setSound(soundUri(context), audio())
      },
    )
  }
}

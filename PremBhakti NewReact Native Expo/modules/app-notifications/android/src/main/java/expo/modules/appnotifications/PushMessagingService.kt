package expo.modules.appnotifications

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URI
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Port of the Capacitor app's CustomFirebaseMessagingService: every push is
 * shown by the app itself (also in the foreground), on the same channels with
 * the same sound, text first and then upgraded to a big picture once the
 * image is downloaded. A tap opens the app with the push data as intent
 * extras (read by AppNotificationsModule).
 */
class PushMessagingService : FirebaseMessagingService() {
  companion object {
    // IDs above the media session (1), BigPicture (1001) and upload (9001) notifications.
    private val counter = AtomicInteger(2000)

    // Image downloads off the FCM thread (it has a ~20s deadline), at most 3 at a time.
    private val executor = ThreadPoolExecutor(
      1, 3, 60L, TimeUnit.SECONDS,
      LinkedBlockingQueue(50),
      ThreadPoolExecutor.DiscardOldestPolicy(),
    )
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)

    var title = "Prem Bhakti"
    var body = ""
    var imageUrl: String? = null
    var channelId = Channels.PUSH

    remoteMessage.notification?.let { n ->
      n.title?.let { title = it }
      n.body?.let { body = it }
      n.imageUrl?.let { imageUrl = it.toString() }
      n.channelId?.let { channelId = it }
    }

    val data = remoteMessage.data
    if (data.containsKey("image")) imageUrl = data["image"]
    else if (data.containsKey("imageUrl")) imageUrl = data["imageUrl"]
    data["title"]?.let { title = it }
    data["body"]?.let { body = it }
    data["channel_id"]?.let { channelId = it }

    // Info, darshan and activity updates arrive without sound.
    val isSilent = data["silent"] == "true"
    show(title, body, imageUrl, data, remoteMessage.messageId, isSilent, channelId)
  }

  private fun show(
    title: String,
    body: String,
    imageUrl: String?,
    data: Map<String, String>,
    messageId: String?,
    isSilent: Boolean,
    payloadChannelId: String,
  ) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = if (isSilent) Channels.SILENT else payloadChannelId
    Channels.ensure(this, channel)

    val intent = (packageManager.getLaunchIntentForPackage(packageName) ?: Intent()).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      for ((k, v) in data) putExtra(k, v)
      // Marks the intent as a notification tap (AppNotificationsModule).
      putExtra("google.message_id", messageId ?: "local_${System.currentTimeMillis()}")
    }
    val pending = PendingIntent.getActivity(
      this,
      System.currentTimeMillis().toInt(),
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_ONE_SHOT,
    )

    val builder = NotificationCompat.Builder(this, channel)
      // The Capacitor app used the full-colour launcher icon here, which Android
      // draws as a white square; a white silhouette shows properly.
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setColor(androidx.core.content.ContextCompat.getColor(this, R.color.notification_accent))
      .setContentTitle(title)
      .setContentText(body)
      .setAutoCancel(true)
      .setContentIntent(pending)
      .setPriority(if (isSilent) NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_HIGH)
    if (!isSilent) builder.setSound(Channels.soundUri(this))

    val id = counter.getAndIncrement()
    // Text first (always visible, even on a slow network), then the picture.
    manager.notify(id, builder.build())
    if (imageUrl.isNullOrEmpty()) return

    executor.execute {
      var bitmap = download(imageUrl) ?: return@execute
      try {
        val maxDim = 1024
        if (bitmap.width > maxDim || bitmap.height > maxDim) {
          val scale = minOf(maxDim.toFloat() / bitmap.width, maxDim.toFloat() / bitmap.height)
          bitmap = Bitmap.createScaledBitmap(bitmap, Math.round(bitmap.width * scale), Math.round(bitmap.height * scale), true)
        }
        // Square thumbnail for the collapsed view; it morphs into the full picture when expanded.
        val minDim = minOf(bitmap.width, bitmap.height)
        val square = Bitmap.createBitmap(bitmap, (bitmap.width - minDim) / 2, (bitmap.height - minDim) / 2, minDim, minDim)
        val thumb = Bitmap.createScaledBitmap(square, 256, 256, true)
        square.recycle()
        builder.setLargeIcon(thumb)
          .setStyle(NotificationCompat.BigPictureStyle().bigPicture(bitmap).bigLargeIcon(null as Bitmap?))
        manager.notify(id, builder.build())
      } catch (e: Exception) {
        Log.e("FCM", "Error processing notification bitmap", e)
        FirebaseCrashlytics.getInstance().recordException(e)
      }
    }
  }

  private fun download(src: String): Bitmap? {
    var connection: HttpURLConnection? = null
    return try {
      connection = (URI.create(src).toURL().openConnection() as HttpURLConnection).apply {
        doInput = true
        connectTimeout = 15000
        readTimeout = 15000
        connect()
      }
      connection.inputStream.use { BitmapFactory.decodeStream(it) }
    } catch (e: Exception) {
      Log.e("FCM", "getBitmapFromURL failed: ${e.message}")
      null
    } finally {
      connection?.disconnect()
    }
  }

  override fun onNewToken(token: String) {
    super.onNewToken(token)
    // Same document the app and the admin panel use: fcm_tokens/android.
    try {
      val data = hashMapOf<String, Any>(
        token.substring(maxOf(0, token.length - 20)) to token,
        "updatedAt" to System.currentTimeMillis(),
      )
      FirebaseFirestore.getInstance().collection("fcm_tokens").document("android")
        .set(data, SetOptions.merge())
        .addOnFailureListener { Log.w("FCM", "Token save failed, retried when the network is back", it) }
    } catch (e: Exception) {
      Log.e("FCM", "Failed to save refreshed token", e)
    }
  }
}

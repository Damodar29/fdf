package expo.modules.uiscale

import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactApplication
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UiScaleModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("UiScale")

    /** The scale the app is currently laid out with. */
    Function("getScale") {
      val context = appContext.reactContext ?: return@Function 1.0
      UiScale.load(context).toDouble()
    }

    /** Saves the new UI size and reloads the JS so React Native lays out with it. */
    Function("setScale") { scale: Double ->
      val context = appContext.reactContext ?: return@Function
      if (UiScale.load(context) == scale.toFloat().coerceIn(UiScale.MIN, UiScale.MAX)) return@Function
      UiScale.save(context, scale.toFloat())
      val activity = appContext.currentActivity
      Handler(Looper.getMainLooper()).post {
        UiScale.apply(activity ?: context)
        (context.applicationContext as? ReactApplication)?.reactHost?.reload("App UI Size changed")
      }
    }
  }
}

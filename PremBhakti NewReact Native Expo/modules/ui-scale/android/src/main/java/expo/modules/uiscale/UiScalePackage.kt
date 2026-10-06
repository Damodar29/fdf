package expo.modules.uiscale

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Applies the saved UI size before React Native starts, again once the
 * activity exists (its display gives the real screen size), and after any
 * configuration change — React Native re-reads the unscaled metrics then.
 */
class UiScalePackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(
      object : ApplicationLifecycleListener {
        private var application: Application? = null

        override fun onCreate(application: Application) {
          this.application = application
          UiScale.apply(application)
        }

        override fun onConfigurationChanged(newConfig: Configuration) {
          // Runs before the activity's own handler, which resets the metrics.
          val app = application ?: return
          Handler(Looper.getMainLooper()).post { UiScale.apply(app) }
        }
      },
    )

  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(
      object : ReactActivityLifecycleListener {
        override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
          UiScale.apply(activity)
        }
      },
    )
}

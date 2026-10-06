package expo.modules.uiscale

import android.content.Context
import android.util.DisplayMetrics
import com.facebook.react.uimanager.DisplayMetricsHolder
import kotlin.math.roundToInt

/**
 * Settings → "App UI Size". The Capacitor app scaled the root font size, so
 * every rem (text, spacing, icons) grew or shrank together. The native
 * equivalent is the density React Native lays out with: scaling it scales
 * every dp and sp in the app the same way.
 *
 * The value lives in SharedPreferences so it is known before React Native
 * starts; React Native reads the density once per instance, so a change is
 * applied by reloading the JS (see UiScaleModule).
 */
object UiScale {
  private const val PREFS = "prem_bhakti_ui"
  private const val KEY = "ui_scale"
  const val MIN = 0.85f
  const val MAX = 1.15f

  fun load(context: Context): Float =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getFloat(KEY, 1f).coerceIn(MIN, MAX)

  fun save(context: Context, scale: Float) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putFloat(KEY, scale.coerceIn(MIN, MAX))
      .commit()
  }

  /** Re-reads the real metrics and hands React Native scaled copies of them. */
  fun apply(context: Context) {
    DisplayMetricsHolder.initDisplayMetrics(context)
    val scale = load(context)
    if (scale == 1f) return
    DisplayMetricsHolder.setWindowDisplayMetrics(scaled(DisplayMetricsHolder.getWindowDisplayMetrics(), scale))
    DisplayMetricsHolder.setScreenDisplayMetrics(scaled(DisplayMetricsHolder.getScreenDisplayMetrics(), scale))
  }

  // A copy: the window metrics are the live object of the app's Resources.
  @Suppress("DEPRECATION")
  private fun scaled(source: DisplayMetrics, scale: Float) =
    DisplayMetrics().apply {
      setTo(source)
      density = source.density * scale
      scaledDensity = source.scaledDensity * scale
      densityDpi = (source.densityDpi * scale).roundToInt()
    }
}

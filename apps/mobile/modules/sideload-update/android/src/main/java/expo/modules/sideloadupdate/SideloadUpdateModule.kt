package expo.modules.sideloadupdate

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SideloadUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SideloadUpdate")

    // The package that installed this app: "com.android.vending" for Google
    // Play, a browser or file manager for a sideloaded APK, null for adb or
    // when Android won't say.
    Function("installerPackageName") {
      installerPackageName()
    }
  }

  private fun installerPackageName(): String? {
    return try {
      val context = appContext.reactContext ?: return null
      val pm = context.packageManager
      val pkg = context.packageName
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        pm.getInstallSourceInfo(pkg).installingPackageName
      } else {
        @Suppress("DEPRECATION")
        pm.getInstallerPackageName(pkg)
      }
    } catch (e: Exception) {
      null
    }
  }
}

package com.autisync.securevoult.autofill

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.view.autofill.AutofillManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** What the JavaScript app can ask of the autofill side (src/services/autofill.ts). */
class SecureVoultAutofillModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun manager(): AutofillManager? = context.getSystemService(AutofillManager::class.java)

  override fun definition() = ModuleDefinition {
    Name("SecureVoultAutofill")

    Function<Boolean>("isSupported") {
      manager()?.isAutofillSupported == true
    }

    /** True when SecureVoult is the phone's chosen autofill service. */
    Function<Boolean>("isEnabled") {
      manager()?.hasEnabledAutofillServices() == true
    }

    Function<Unit>("openSettings") {
      val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).setData(Uri.parse("package:${context.packageName}"))
      val activity = appContext.currentActivity
      try {
        if (activity != null) activity.startActivity(intent)
        else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      } catch (_: Exception) {
        // Some phones hide that screen: open the general autofill settings instead.
        val fallback = Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(fallback)
      }
      Unit
    }

    AsyncFunction("setLogins") { json: String ->
      VaultCache.write(context, json)
    }

    AsyncFunction<Unit>("clear") {
      VaultCache.clear(context)
      PendingSaves.takeAll(context)
    }

    AsyncFunction<String>("takeSavedLogins") {
      PendingSaves.takeAll(context)
    }
  }
}

package com.autisync.securevoult.autofill

import android.app.PendingIntent
import android.content.Intent
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.widget.RemoteViews
import android.widget.Toast

/**
 * Called by Android when a login form appears in another app or a browser.
 *
 * Nothing secret is touched here: the reply is a single "Fill with SecureVoult"
 * suggestion. Choosing it opens [AutofillAuthActivity], which asks for the
 * fingerprint / screen lock before reading any login.
 */
class SecureVoultAutofillService : AutofillService() {

  override fun onFillRequest(request: FillRequest, cancellationSignal: CancellationSignal, callback: FillCallback) {
    try {
      val structure = request.fillContexts.lastOrNull()?.structure ?: return callback.onSuccess(null)
      val form = FieldParser.parse(structure)
      // Never fill into SecureVoult itself, and only where there is a login form.
      if (form.packageName == packageName || !form.isLogin) return callback.onSuccess(null)

      val builder = FillResponse.Builder()
      if (VaultCache.exists(this)) {
        val auth = Intent(this, AutofillAuthActivity::class.java)
          .putExtra(AutofillAuthActivity.EXTRA_DOMAIN, form.webDomain)
          .putExtra(AutofillAuthActivity.EXTRA_PACKAGE, form.packageName)
        // Mutable: Android adds the screen structure to it when the suggestion is chosen.
        val pending = PendingIntent.getActivity(this, (System.nanoTime() and 0x7fffffffL).toInt(), auth,
          PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_MUTABLE)
        val where = form.webDomain?.let { Domains.baseDomain(it) } ?: appLabel(form.packageName)
        builder.setAuthentication(form.allIds.toTypedArray(), pending.intentSender, presentation(this.packageName, "Fill with SecureVoult", where))
      }
      // Offer to save what gets typed (only when there's a password box).
      if (form.passwordIds.isNotEmpty()) {
        val save = SaveInfo.Builder(
          if (form.usernameIds.isNotEmpty()) SaveInfo.SAVE_DATA_TYPE_PASSWORD or SaveInfo.SAVE_DATA_TYPE_USERNAME else SaveInfo.SAVE_DATA_TYPE_PASSWORD,
          form.passwordIds.toTypedArray(),
        )
        if (form.usernameIds.isNotEmpty()) save.setOptionalIds(form.usernameIds.toTypedArray())
        builder.setSaveInfo(save.build())
      } else if (!VaultCache.exists(this)) {
        return callback.onSuccess(null)
      }
      callback.onSuccess(builder.build())
    } catch (e: Exception) {
      callback.onSuccess(null)
    }
  }

  override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
    try {
      val structure = request.fillContexts.lastOrNull()?.structure ?: return callback.onSuccess()
      val form = FieldParser.parse(structure)
      val password = form.passwordValue
      if (password.isNullOrEmpty() || form.packageName == packageName) return callback.onSuccess()
      PendingSaves.add(this, form.usernameValue ?: "", password, form.webDomain?.let { Domains.baseDomain(it) }, if (form.webDomain == null) form.packageName else null)
      Toast.makeText(this, "Saved. It's added to SecureVoult the next time you open the app.", Toast.LENGTH_LONG).show()
      callback.onSuccess()
    } catch (e: Exception) {
      callback.onFailure("SecureVoult couldn't save this login.")
    }
  }

  private fun appLabel(pkg: String): String = try {
    packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
  } catch (_: Exception) { pkg }

  companion object {
    fun presentation(ownPackage: String, title: String, subtitle: String?): RemoteViews =
      RemoteViews(ownPackage, R.layout.sv_autofill_item).apply {
        setTextViewText(R.id.sv_title, title)
        setTextViewText(R.id.sv_subtitle, subtitle ?: "")
      }
  }
}

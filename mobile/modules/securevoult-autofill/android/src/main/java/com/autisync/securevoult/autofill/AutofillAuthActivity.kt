package com.autisync.securevoult.autofill

import android.app.assist.AssistStructure
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import android.widget.Toast
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * The check before any login leaves SecureVoult: fingerprint, face or screen
 * lock unlocks the Keystore key, the logins for this site or app are read,
 * and Android shows them for the user to pick.
 */
class AutofillAuthActivity : FragmentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (savedInstanceState != null) return // prompt already showing (rotation)

    val cipher = try {
      VaultCache.unlockCipher()
    } catch (e: KeyPermanentlyInvalidatedException) {
      VaultCache.clear(this)
      return fail("A new fingerprint was added. Open SecureVoult once to turn autofill back on.")
    } catch (e: Exception) {
      return fail("Open SecureVoult once to turn autofill on.")
    }

    val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        val unlocked = result.cryptoObject?.cipher ?: return fail(null)
        try {
          finishWith(VaultCache.read(this@AutofillAuthActivity, unlocked))
        } catch (e: Exception) {
          fail("SecureVoult couldn't read its autofill data. Open the app to refresh it.")
        }
      }

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        fail(null)
      }
    })

    val where = intent.getStringExtra(EXTRA_DOMAIN)?.let { Domains.baseDomain(it) } ?: intent.getStringExtra(EXTRA_PACKAGE)
    val info = BiometricPrompt.PromptInfo.Builder()
      .setTitle("Fill with SecureVoult")
      .setSubtitle(where ?: "")
      .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
      .build()
    prompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
  }

  private fun finishWith(logins: List<AutofillLogin>) {
    val structure = assistStructure() ?: return fail(null)
    val form = FieldParser.parse(structure)
    val domain = intent.getStringExtra(EXTRA_DOMAIN) ?: form.webDomain
    val pkg = intent.getStringExtra(EXTRA_PACKAGE) ?: form.packageName

    val ranked = rank(logins, domain, pkg)
    if (ranked.isEmpty()) return fail("No logins saved in SecureVoult yet.")

    val response = FillResponse.Builder()
    var added = 0
    for ((login, label) in ranked) {
      if (added >= MAX_DATASETS) break
      val view = SecureVoultAutofillService.presentation(packageName, login.name.ifBlank { label }, listOf(login.username.ifBlank { "(no username)" }, label).filter { it.isNotBlank() }.joinToString(" · "))
      val ds = Dataset.Builder(view)
      var hasValue = false
      if (login.username.isNotEmpty()) for (id in form.usernameIds) { ds.setValue(id, AutofillValue.forText(login.username), view); hasValue = true }
      if (login.password.isNotEmpty()) for (id in form.passwordIds) { ds.setValue(id, AutofillValue.forText(login.password), view); hasValue = true }
      if (!hasValue) continue
      response.addDataset(ds.build())
      added++
    }
    if (added == 0) return fail("Nothing to fill on this screen.")
    setResult(RESULT_OK, Intent().putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, response.build()))
    finish()
  }

  /**
   * Logins for this place first:
   *  - a website: saved for this exact address first (calls.autisync.com), then
   *    the rest of the same site (autisync.com), each labelled with its address;
   *  - an app: logins saved for that app, then logins whose site name is in the
   *    app's package name (com.facebook.katana ↔ facebook.com), marked "suggested".
   * When nothing matches, every login, so the user can still pick one.
   */
  private fun rank(logins: List<AutofillLogin>, domain: String?, pkg: String): List<Pair<AutofillLogin, String>> {
    val byName = logins.sortedBy { it.name.lowercase() }
    if (!domain.isNullOrBlank()) {
      val host = domain.lowercase().removePrefix("www.")
      val site = Domains.baseDomain(host)
      val exact = byName.filter { host in it.hosts }
      val sameSite = byName.filter { it !in exact && site in it.domains }
      val label = { l: AutofillLogin -> l.hosts.firstOrNull { Domains.baseDomain(it) == site } ?: site }
      if (exact.isNotEmpty() || sameSite.isNotEmpty()) return exact.map { it to host } + sameSite.map { it to label(it) }
    } else if (pkg.isNotBlank()) {
      val forApp = byName.filter { pkg in it.apps }
      if (forApp.isNotEmpty()) return forApp.map { it to "" }
      val words = Domains.packageWords(pkg)
      val guessed = byName.filter { l -> l.domains.any { Domains.siteName(it).lowercase() in words } }
      if (guessed.isNotEmpty()) return guessed.map { it to "suggested" }
    }
    return byName.map { it to (it.domains.firstOrNull() ?: "") }
  }

  @Suppress("DEPRECATION")
  private fun assistStructure(): AssistStructure? =
    if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(AutofillManager.EXTRA_ASSIST_STRUCTURE, AssistStructure::class.java)
    else intent.getParcelableExtra(AutofillManager.EXTRA_ASSIST_STRUCTURE)

  private fun fail(message: String?) {
    if (message != null) Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    setResult(RESULT_CANCELED)
    finish()
  }

  companion object {
    const val EXTRA_DOMAIN = "com.autisync.securevoult.autofill.DOMAIN"
    const val EXTRA_PACKAGE = "com.autisync.securevoult.autofill.PACKAGE"
    private const val MAX_DATASETS = 40
  }
}

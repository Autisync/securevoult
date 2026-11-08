package com.autisync.securevoult.autofill

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec

/** One login as the app hands it over. */
data class AutofillLogin(
  val id: String,
  val name: String,
  val username: String,
  val password: String,
  val domains: List<String>,
  /** Exact addresses (calls.autisync.com); older caches have none. */
  val hosts: List<String>,
  val apps: List<String>,
)

/**
 * The logins the autofill service can offer, kept encrypted on the phone.
 *
 * Writing needs no unlock (the app does it whenever the vault changes): a fresh
 * AES-256-GCM key encrypts the list, and that key is wrapped with the PUBLIC
 * half of an RSA key in the Android Keystore. Reading needs the PRIVATE half,
 * which the Keystore only uses right after a fingerprint or screen-lock check
 * (one check per use) and throws away if a new fingerprint is added.
 */
object VaultCache {
  private const val KEYSTORE = "AndroidKeyStore"
  private const val RSA_ALIAS = "securevoult_autofill_rsa"
  private const val FILE = "sv_autofill.json"
  private const val RSA_MODE = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding"
  // MGF1 with SHA-1 is what the Keystore supports on every Android version; the OAEP digest is SHA-256.
  private val OAEP = OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT)

  private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
  private fun file(ctx: Context) = File(ctx.noBackupFilesDir, FILE)

  fun exists(ctx: Context): Boolean = file(ctx).exists() && keyStore().containsAlias(RSA_ALIAS)

  private fun ensureKey() {
    val ks = keyStore()
    if (ks.containsAlias(RSA_ALIAS)) return
    val spec = KeyGenParameterSpec.Builder(RSA_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setKeySize(2048)
      .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA1)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
      .setUserAuthenticationRequired(true)
      .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
      .setInvalidatedByBiometricEnrollment(true)
      .build()
    KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, KEYSTORE).apply { initialize(spec) }.generateKeyPair()
  }

  @Synchronized
  fun write(ctx: Context, loginsJson: String) {
    // Validate before storing.
    JSONArray(loginsJson)
    ensureKey()
    val cert = keyStore().getCertificate(RSA_ALIAS)
    // Public-key operations run outside the Keystore, so they need no unlock.
    val pub = KeyFactory.getInstance(cert.publicKey.algorithm).generatePublic(X509EncodedKeySpec(cert.publicKey.encoded))
    val aes = ByteArray(32).also { SecureRandom().nextBytes(it) }
    try {
      val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
      val gcm = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, SecretKeySpec(aes, "AES"), GCMParameterSpec(128, iv)) }
      val ct = gcm.doFinal(loginsJson.toByteArray(Charsets.UTF_8))
      val wrapped = Cipher.getInstance(RSA_MODE).apply { init(Cipher.ENCRYPT_MODE, pub, OAEP) }.doFinal(aes)
      val out = JSONObject()
        .put("v", 1)
        .put("wk", b64(wrapped))
        .put("iv", b64(iv))
        .put("ct", b64(ct))
      val f = file(ctx)
      val tmp = File(f.parentFile, "$FILE.tmp")
      tmp.writeText(out.toString())
      if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) }
    } finally {
      aes.fill(0)
    }
  }

  @Synchronized
  fun clear(ctx: Context) {
    file(ctx).delete()
    try { keyStore().deleteEntry(RSA_ALIAS) } catch (_: Exception) {}
  }

  /** A cipher ready to unwrap the key, to hand to BiometricPrompt. Throws if the key is gone or invalidated. */
  fun unlockCipher(): Cipher {
    val key = keyStore().getKey(RSA_ALIAS, null) as? PrivateKey ?: throw IllegalStateException("No autofill key")
    return Cipher.getInstance(RSA_MODE).apply { init(Cipher.DECRYPT_MODE, key, OAEP) }
  }

  /** Reads the logins with a cipher the user has just unlocked. */
  fun read(ctx: Context, unlocked: Cipher): List<AutofillLogin> {
    val o = JSONObject(file(ctx).readText())
    val aes = unlocked.doFinal(unb64(o.getString("wk")))
    try {
      val gcm = Cipher.getInstance("AES/GCM/NoPadding").apply {
        init(Cipher.DECRYPT_MODE, SecretKeySpec(aes, "AES"), GCMParameterSpec(128, unb64(o.getString("iv"))))
      }
      val arr = JSONArray(String(gcm.doFinal(unb64(o.getString("ct"))), Charsets.UTF_8))
      return (0 until arr.length()).map { i ->
        val l = arr.getJSONObject(i)
        AutofillLogin(
          id = l.optString("id"),
          name = l.optString("name"),
          username = l.optString("username"),
          password = l.optString("password"),
          domains = l.optJSONArray("domains").strings(),
          hosts = l.optJSONArray("hosts").strings(),
          apps = l.optJSONArray("apps").strings(),
        )
      }
    } finally {
      aes.fill(0)
    }
  }

  private fun JSONArray?.strings(): List<String> = if (this == null) emptyList() else (0 until length()).map { optString(it) }.filter { it.isNotBlank() }
  internal fun b64(b: ByteArray): String = Base64.encodeToString(b, Base64.NO_WRAP)
  internal fun unb64(s: String): ByteArray = Base64.decode(s, Base64.NO_WRAP)
}

/**
 * Logins typed into other apps that the user asked SecureVoult to save. Kept
 * encrypted with a Keystore AES key (no unlock needed, so saving is instant)
 * until the app next opens the vault and adds them.
 */
object PendingSaves {
  private const val ALIAS = "securevoult_pending_aes"
  private const val FILE = "sv_pending_saves.json"

  private fun file(ctx: Context) = File(ctx.noBackupFilesDir, FILE)

  private fun key(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
    val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .build()
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply { init(spec) }.generateKey()
  }

  @Synchronized
  fun add(ctx: Context, username: String, password: String, domain: String?, packageName: String?) {
    val item = JSONObject()
      .put("username", username)
      .put("password", password)
      .put("savedAt", System.currentTimeMillis())
    if (!domain.isNullOrBlank()) item.put("domain", domain)
    if (!packageName.isNullOrBlank()) item.put("packageName", packageName)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
    val ct = cipher.doFinal(item.toString().toByteArray(Charsets.UTF_8))
    val list = readRaw(ctx)
    list.put(JSONObject().put("iv", VaultCache.b64(cipher.iv)).put("ct", VaultCache.b64(ct)))
    // Keep the last 50 at most.
    while (list.length() > 50) list.remove(0)
    file(ctx).writeText(list.toString())
  }

  @Synchronized
  fun takeAll(ctx: Context): String {
    val raw = readRaw(ctx)
    val out = JSONArray()
    if (raw.length() > 0) {
      val k = key()
      for (i in 0 until raw.length()) {
        try {
          val o = raw.getJSONObject(i)
          val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, k, GCMParameterSpec(128, VaultCache.unb64(o.getString("iv")))) }
          out.put(JSONObject(String(c.doFinal(VaultCache.unb64(o.getString("ct"))), Charsets.UTF_8)))
        } catch (_: Exception) { /* unreadable entry: drop it */ }
      }
    }
    file(ctx).delete()
    return out.toString()
  }

  private fun readRaw(ctx: Context): JSONArray =
    try { if (file(ctx).exists()) JSONArray(file(ctx).readText()) else JSONArray() } catch (_: Exception) { JSONArray() }
}

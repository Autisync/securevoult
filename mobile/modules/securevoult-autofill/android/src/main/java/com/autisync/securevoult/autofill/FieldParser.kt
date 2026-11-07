package com.autisync.securevoult.autofill

import android.app.assist.AssistStructure
import android.text.InputType
import android.view.View
import android.view.autofill.AutofillId

/**
 * Finds the username and password boxes on a screen, and which website
 * (Chrome and other browsers) or app the screen belongs to.
 */
class ParsedForm(
  val usernameIds: List<AutofillId>,
  val passwordIds: List<AutofillId>,
  val webDomain: String?,
  val packageName: String,
  /** Values typed in, for "save this login". */
  val usernameValue: String?,
  val passwordValue: String?,
) {
  val allIds: List<AutofillId> get() = usernameIds + passwordIds
  val isLogin: Boolean get() = passwordIds.isNotEmpty() || usernameIds.isNotEmpty()
}

object FieldParser {
  private val USER_WORDS = Regex("user|login|email|e-mail|account|identifier|phone|mobile|utilizador|usuario|correo", RegexOption.IGNORE_CASE)
  private val PASS_WORDS = Regex("pass|pwd|senha|contrase|mot de passe|passwort|pin\\b", RegexOption.IGNORE_CASE)
  private val NOT_LOGIN = Regex("search|captcha|promo|coupon|otp|code|verification|cvv|card", RegexOption.IGNORE_CASE)

  fun parse(structure: AssistStructure): ParsedForm {
    val users = mutableListOf<AutofillId>()
    val passwords = mutableListOf<AutofillId>()
    val textFields = mutableListOf<AssistStructure.ViewNode>()
    var webDomain: String? = null
    var userValue: String? = null
    var passValue: String? = null

    fun visit(node: AssistStructure.ViewNode) {
      if (webDomain == null && !node.webDomain.isNullOrBlank()) webDomain = node.webDomain
      val id = node.autofillId
      if (id != null && node.autofillType == View.AUTOFILL_TYPE_TEXT && node.visibility == View.VISIBLE) {
        when (classify(node)) {
          Kind.PASSWORD -> { passwords.add(id); node.autofillValue?.takeIf { it.isText }?.textValue?.toString()?.let { if (it.isNotEmpty()) passValue = it } }
          Kind.USERNAME -> { users.add(id); node.autofillValue?.takeIf { it.isText }?.textValue?.toString()?.let { if (it.isNotEmpty()) userValue = it } }
          Kind.OTHER_TEXT -> textFields.add(node)
          Kind.IGNORE -> {}
        }
      }
      for (i in 0 until node.childCount) visit(node.getChildAt(i))
    }
    for (i in 0 until structure.windowNodeCount) visit(structure.getWindowNodeAt(i).rootViewNode)

    // A password box with no recognisable username: the text box just before it.
    if (users.isEmpty() && passwords.isNotEmpty() && textFields.isNotEmpty()) {
      val candidate = textFields.last()
      candidate.autofillId?.let { users.add(it) }
      candidate.autofillValue?.takeIf { it.isText }?.textValue?.toString()?.let { if (it.isNotEmpty()) userValue = it }
    }

    return ParsedForm(
      usernameIds = users.distinct(),
      passwordIds = passwords.distinct(),
      webDomain = webDomain,
      packageName = structure.activityComponent?.packageName ?: "",
      usernameValue = userValue,
      passwordValue = passValue,
    )
  }

  private enum class Kind { USERNAME, PASSWORD, OTHER_TEXT, IGNORE }

  private fun classify(node: AssistStructure.ViewNode): Kind {
    val hints = node.autofillHints?.map { it.lowercase() } ?: emptyList()
    if (hints.any { it.contains("password") }) return Kind.PASSWORD
    if (hints.any { it == View.AUTOFILL_HINT_USERNAME.lowercase() || it.contains("email") || it == "username" || it.contains("phone") }) return Kind.USERNAME
    if (hints.any { it.contains("creditcard") || it.contains("postal") || it.contains("otp") }) return Kind.IGNORE

    // Web pages: the HTML input's type and autocomplete attributes.
    node.htmlInfo?.let { html ->
      if (!html.tag.equals("input", ignoreCase = true)) return@let
      val attrs = html.attributes?.associate { (it.first ?: "").lowercase() to (it.second ?: "").lowercase() } ?: emptyMap()
      val type = attrs["type"] ?: "text"
      val auto = attrs["autocomplete"] ?: ""
      val name = "${attrs["name"] ?: ""} ${attrs["id"] ?: ""}"
      when {
        type == "password" -> return Kind.PASSWORD
        type == "hidden" || type == "checkbox" || type == "radio" || type == "submit" || type == "search" -> return Kind.IGNORE
        auto.contains("username") || auto.contains("email") || type == "email" -> return Kind.USERNAME
        auto.contains("one-time-code") || auto.startsWith("cc-") -> return Kind.IGNORE
        NOT_LOGIN.containsMatchIn(name) -> return Kind.IGNORE
        USER_WORDS.containsMatchIn(name) -> return Kind.USERNAME
      }
    }

    val input = node.inputType
    val cls = input and InputType.TYPE_MASK_CLASS
    val variation = input and InputType.TYPE_MASK_VARIATION
    if (cls == InputType.TYPE_CLASS_TEXT && (variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
        variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD || variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD)) return Kind.PASSWORD
    if (cls == InputType.TYPE_CLASS_NUMBER && variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD) return Kind.PASSWORD
    if (cls == InputType.TYPE_CLASS_TEXT && (variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS ||
        variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS)) return Kind.USERNAME

    val words = listOfNotNull(node.idEntry, node.hint, node.contentDescription?.toString()).joinToString(" ")
    if (words.isNotBlank()) {
      if (NOT_LOGIN.containsMatchIn(words)) return Kind.IGNORE
      if (PASS_WORDS.containsMatchIn(words)) return Kind.PASSWORD
      if (USER_WORDS.containsMatchIn(words)) return Kind.USERNAME
    }
    return if (cls == InputType.TYPE_CLASS_TEXT || node.className?.contains("EditText") == true) Kind.OTHER_TEXT else Kind.IGNORE
  }
}

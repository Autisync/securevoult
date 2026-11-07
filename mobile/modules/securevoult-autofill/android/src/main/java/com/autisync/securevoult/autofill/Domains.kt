package com.autisync.securevoult.autofill

/**
 * Site matching, the same rules as the web app and extension (src/lib/domain.ts):
 * "accounts.google.co.uk" → "google.co.uk"; customer subdomains on shared hosts
 * (alice.github.io) stay separate sites.
 */
object Domains {
  private val TWO_PART = Regex("^(co|com|org|net|gov|ac|edu|ltd|plc|me|sch|nhs|police|nom|gob|gv|or|ne|go|in|it|ed)\\.[a-z]{2}$")
  private val IPV4 = Regex("^\\d+\\.\\d+\\.\\d+\\.\\d+$")
  private val SHARED_HOSTS = listOf(
    "github.io", "gitlab.io", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "web.app", "firebaseapp.com",
    "herokuapp.com", "onrender.com", "fly.dev", "railway.app", "glitch.me", "repl.co", "replit.app", "appspot.com",
    "azurewebsites.net", "cloudfront.net", "s3.amazonaws.com", "blogspot.com", "wordpress.com", "wixsite.com",
    "squarespace.com", "webflow.io", "framer.website", "myshopify.com", "ngrok.io", "ngrok-free.app", "trycloudflare.com",
    "duckdns.org", "no-ip.org", "sharepoint.com", "zendesk.com", "freshdesk.com", "atlassian.net", "my.salesforce.com",
  )

  fun baseDomain(host: String): String {
    val h = host.lowercase().removePrefix("www.").removeSuffix(".")
    if (h.isEmpty() || IPV4.matches(h) || h == "localhost" || h.contains(':')) return h
    val parts = h.split('.')
    for (shared in SHARED_HOSTS) {
      if (h.endsWith(".$shared")) {
        val n = shared.split('.').size + 1
        return parts.takeLast(n).joinToString(".")
      }
    }
    if (parts.size <= 2) return h
    val last2 = parts.takeLast(2).joinToString(".")
    return parts.takeLast(if (TWO_PART.matches(last2)) 3 else 2).joinToString(".")
  }

  /** "google.co.uk" → "google": the part people recognise, for guessing an app's website. */
  fun siteName(base: String): String {
    val parts = base.split('.')
    if (parts.size <= 1) return base
    val last2 = parts.takeLast(2).joinToString(".")
    return if (parts.size >= 3 && TWO_PART.matches(last2)) parts[parts.size - 3] else parts[parts.size - 2]
  }

  private val GENERIC = setOf("com", "org", "net", "android", "app", "apps", "mobile", "www", "client", "main", "prod", "release", "co", "uk", "io")

  /** Package name segments worth comparing with a site name: com.facebook.katana → facebook, katana. */
  fun packageWords(pkg: String): Set<String> =
    pkg.lowercase().split('.', '_', '-').filter { it.length >= 3 && it !in GENERIC }.toSet()
}

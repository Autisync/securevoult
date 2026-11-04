/** Site matching for autofill. Kept tiny: the extension's content script imports it. */

/** "accounts.google.co.uk" → "google.co.uk". Small built-in list of two-part endings. */
export function baseDomain(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!h || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h === 'localhost' || h.includes(':')) return h;
  const parts = h.split('.');
  // Hosting where every customer gets a subdomain: alice.github.io and
  // mallory.github.io are different sites, so keep the customer's label.
  for (const shared of SHARED_HOSTS) {
    if (h.endsWith(`.${shared}`)) {
      const n = shared.split('.').length + 1;
      return parts.slice(-n).join('.');
    }
  }
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join('.');
  const twoPart = /^(co|com|org|net|gov|ac|edu|ltd|plc|me|sch|nhs|police|nom|gob|gv|or|ne|go|in|it|ed)\.[a-z]{2}$/.test(last2);
  return parts.slice(twoPart ? -3 : -2).join('.');
}

const SHARED_HOSTS = [
  'github.io', 'gitlab.io', 'vercel.app', 'netlify.app', 'pages.dev', 'workers.dev', 'web.app', 'firebaseapp.com',
  'herokuapp.com', 'onrender.com', 'fly.dev', 'railway.app', 'glitch.me', 'repl.co', 'replit.app', 'appspot.com',
  'azurewebsites.net', 'cloudfront.net', 's3.amazonaws.com', 'blogspot.com', 'wordpress.com', 'wixsite.com',
  'squarespace.com', 'webflow.io', 'framer.website', 'myshopify.com', 'ngrok.io', 'ngrok-free.app', 'trycloudflare.com',
  'duckdns.org', 'no-ip.org', 'sharepoint.com', 'zendesk.com', 'freshdesk.com', 'atlassian.net', 'my.salesforce.com',
];

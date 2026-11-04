# Phase 1 - Foundation Gate

- Overall: **PASS**
- Passed: 6
- Failed: 0

## Step Results

| Step | Status | Exit Code |
|---|---|---|
| npm run env:check | PASS | 0 |
| npm run type-check | PASS | 0 |
| npm run api:error-contract-check | PASS | 0 |
| npm run build | PASS | 0 |
| npm run extension:build | PASS | 0 |
| npm run extension:check | PASS | 0 |

## npm run env:check

```text

> env:check
> node scripts/check-env.js


[check-env]  SecureVoult -- Environment Variable Check


-- Firebase (client) --
  [ok]  NEXT_PUBLIC_FIREBASE_API_KEY
  [ok]  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  [ok]  NEXT_PUBLIC_FIREBASE_PROJECT_ID
  [ok]  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  [ok]  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  [ok]  NEXT_PUBLIC_FIREBASE_APP_ID

-- Firebase Admin (server-side only) --
  [ok]  FIREBASE_ADMIN_PROJECT_ID
  [ok]  FIREBASE_ADMIN_CLIENT_EMAIL
  [ok]  FIREBASE_ADMIN_PRIVATE_KEY

-- MongoDB --
  [ok]  MONGODB_URI

-- Stripe --
  [ok]  STRIPE_SECRET_KEY
  [ok]  STRIPE_WEBHOOK_SECRET
  [ok]  STRIPE_PRICE_PRO_MONTHLY
  [ok]  STRIPE_PRICE_PRO_YEARLY
  [ok]  STRIPE_PRICE_COMPANY_MONTHLY
  [ok]  STRIPE_PRICE_COMPANY_YEARLY

-- HaveIBeenPwned --
  [optional]  HIBP_API_KEY  -- not set
       https://haveibeenpwned.com/API/Key  (optional -- breach email checks return notConfigured without it)

-- App URL --
  [ok]  NEXT_PUBLIC_APP_URL


[ok]  All environment variables are set.


```

## npm run type-check

```text

> type-check
> tsc --noEmit


```

## npm run api:error-contract-check

```text

> api:error-contract-check
> node scripts/check-api-error-contract.mjs

API error contract check: PASS

```

## npm run build

```text

> build
> next build

▲ Next.js 16.2.4 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 23.4s
  Running TypeScript ...
  Finished TypeScript in 43s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/46) ...
  Generating static pages using 7 workers (11/46) 
  Generating static pages using 7 workers (22/46) 
  Generating static pages using 7 workers (34/46) 
✓ Generating static pages using 7 workers (46/46) in 2.1s
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/admin/activities
├ ƒ /api/admin/breach-findings
├ ƒ /api/admin/breach-findings/email-check
├ ƒ /api/admin/breach-findings/paste-check
├ ƒ /api/admin/breach-findings/scan-all
├ ƒ /api/admin/companies
├ ƒ /api/admin/incidents
├ ƒ /api/admin/overview
├ ƒ /api/admin/sessions
├ ƒ /api/admin/system-health
├ ƒ /api/admin/users
├ ƒ /api/admin/users/force-password-reset
├ ƒ /api/auth/login
├ ƒ /api/auth/passkey/credentials
├ ƒ /api/auth/passkey/login/challenge
├ ƒ /api/auth/passkey/login/verify
├ ƒ /api/auth/passkey/register/challenge
├ ƒ /api/auth/passkey/register/verify
├ ƒ /api/auth/register
├ ƒ /api/auth/sync-user
├ ƒ /api/billing/downgrade
├ ƒ /api/billing/upgrade-intent
├ ƒ /api/billing/webhook
├ ƒ /api/companies/[id]/invites
├ ƒ /api/companies/[id]/invites/[inviteId]
├ ƒ /api/companies/[id]/members
├ ƒ /api/companies/[id]/members/[uid]
├ ƒ /api/entries
├ ƒ /api/extension/download
├ ƒ /api/health
├ ƒ /api/invites/redeem
├ ƒ /api/security/breach-history
├ ƒ /api/security/scan
├ ƒ /api/sessions
├ ƒ /api/sessions/revoke
├ ƒ /api/sso/config
├ ƒ /api/sso/login
├ ƒ /api/sso/metadata/[companyId]
├ ƒ /api/vault
├ ƒ /api/vault/entries/share
├ ƒ /api/vault/share
├ ○ /cookies
├ ○ /dpa
├ ○ /privacy
├ ○ /security
├ ○ /support
├ ○ /tempobook/storyboards/49e4214b-9de5-4dff-93a1-c061a73be598
└ ○ /terms


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


```

## npm run extension:build

```text

> extension:build
> node scripts/build-extension-popup.mjs

🎨 Step 1/3 — Generating Tailwind CSS…
   ✅ extension-package/popup.styles.css written

📦 Step 2/3 — Bundling popup.js with esbuild…
   Inlining: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   ✅ extension-package/popup.bundle.js written

🔗 Step 3/3 — Patching extension pages with app URL: http://localhost:3000
   ✅ extension pages patched

✅ Extension build complete!


--- STDERR ---
Browserslist: caniuse-lite is outdated. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme

Rebuilding...

Done in 1898ms.

```

## npm run extension:check

```text

> extension:check
> node -e "const m=require('./extension-package/manifest.json');const hostPermissions=(m.host_permissions??[]).join(', ')||'(none)';const contentScriptMatches=(m.content_scripts??[]).flatMap((script)=>script.matches??[]);console.log('Extension:',m.name,'v'+m.version,'MV'+m.manifest_version);console.log('Permissions:',m.permissions.join(', '));console.log('Host permissions:',hostPermissions);console.log('Content script matches:',contentScriptMatches.join(', ')||'(none)');"

Extension: SecureVoult v1.0.0 MV3
Permissions: storage, activeTab, tabs, contextMenus
Host permissions: https://*/*
Content script matches: https://*/*

```
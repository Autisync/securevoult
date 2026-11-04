# Phase 1 - Foundation Gate

- Overall: **FAIL**
- Passed: 0
- Failed: 1

## Step Results

| Step | Status | Exit Code |
|---|---|---|
| npm run env:check | FAIL | 1 |

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
  [missing]  HIBP_API_KEY  -- MISSING
       https://haveibeenpwned.com/API/Key  (optional -- breach email checks return notConfigured without it)

-- App URL --
  [ok]  NEXT_PUBLIC_APP_URL

[error]  One or more required variables are missing.
    Copy .env.example -> .env.local and fill in the values.


```
# Phase 1 - Foundation Gate

- Overall: **FAIL**
- Passed: 2
- Failed: 1

## Step Results

| Step | Status | Exit Code |
|---|---|---|
| npm run env:check | PASS | 0 |
| npm run type-check | PASS | 0 |
| npm run build | FAIL | 1 |

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

## npm run build

```text

> build
> next build

  Suggestion: Wait for the build to complete.

[audit] Retrying npm run build after transient Next.js build lock.

> build
> next build

  Suggestion: Wait for the build to complete.

--- STDERR ---
⨯ Another next build process is already running.

  This could be:
  - A next build still in progress
  - A previous build that didn't exit cleanly


[audit] Retried npm run build once after transient Next.js build lock.
⨯ Another next build process is already running.

  This could be:
  - A next build still in progress
  - A previous build that didn't exit cleanly


```
# QA Summary — SecureVoult Platform Pass

**Date:** April 2026  
**Scope:** Web app, browser extension, desktop scaffold, mobile preview, landing page, legal pages, pricing

---

## What is actually usable today

| Platform | Status | Notes |
|---|---|---|
| Web application | **Live** | Full vault, security centre, breach monitoring, import/export, admin panel, passkeys, billing settings |
| Browser extension (Chrome/Edge/Brave/Opera) | **Beta** | Manual/unpacked install; autofill, save-login, popup vault; store submissions not yet submitted |
| Firefox extension | **In development** | MV2 manifest exists; `about:debugging` temporary install only |
| Desktop app (Electron) | **In development** | Scaffold loads `localhost:3000` in dev mode; production auth flow not wired |
| iOS app | **In development** | Expo scaffold; Expo Go testing only; no TestFlight build configured |
| Android app | **In development** | Expo scaffold; Expo Go testing only; no Play Store build configured |
| Safari extension | **Planned** | Requires Xcode 15+ and Apple Developer account |

---

## Bugs fixed this pass

### Naming inconsistency — "Business" vs "Company"
- **Problem:** `plans.ts` defines plan ID `'company'` / display name `'Company'`. LandingPage used "Business" everywhere.
- **Fix:** Renamed throughout LandingPage — pricing card, plan status badge, roadmap item, plan-to-platform table header.

### Plan-to-platform table: Passkeys shown as "Roadmap"
- **Problem:** Table showed passkeys as "🗓 Roadmap" for Pro and Company. In reality, `PLAN_LIMITS.pro.passkeys = true`, `PLAN_LIMITS.company.passkeys = true`, and PasskeySettings component is fully implemented.
- **Fix:** Changed to "✓ Live (Pro+)" for Pro, "✓ Live" for Company.

### Plan-to-platform table: Admin panel shown as "Roadmap" for Company
- **Problem:** `PLAN_LIMITS.company.adminPanel = true` and the AdminPanel component is implemented. Table incorrectly showed "🗓 Roadmap".
- **Fix:** Changed to "✓ Live (planned)" reflecting it exists but gating is pending Stripe.

### Pricing card — Company plan features misaligned
- **Problem:** Company pricing card listed "Shared vaults" and "User management" which are stubs not in `PLAN_META.company.features`.
- **Fix:** Replaced with `PLAN_META.company.features` values: Company admin dashboard, Team breach monitoring, Incident tracking, Audit logs, Security policy enforcement.

### Pro plan pricing card — Passkeys not listed
- **Problem:** Pro plan pricing bullets were missing Passkeys / biometric login despite being live for Pro.
- **Fix:** Added "Passkeys / biometric login" to Pro plan features list.

### Extension beta CTA — broken link
- **Problem:** "View install guide" button linked to `/security#contact`, which is the responsible disclosure contact form — completely wrong destination.
- **Fix:** Replaced with "Get install help" mailto link to `waitlist@securevoult.com`.

### Browser extension — Free plan sync claim
- **Problem:** Plan-to-platform table showed "✓ Beta" for Free users' extension access, implying vault sync. `PLAN_LIMITS.free.extensionSync = false`.
- **Fix:** Free shows "✓ Beta" (can install and use), Pro/Company show "✓ Beta + sync" (vault sync included).

### Roadmap item label
- **Problem:** Roadmap section listed "Business / Teams plan" as a roadmap item.
- **Fix:** Changed to "Company plan" to match `PLAN_META.company.name`.

---

## Known remaining issues (not blocking)

| Issue | Notes |
|---|---|
| Stripe price IDs missing | Pro/Company plans show "Coming soon" — need real Stripe price IDs to enable checkout |
| Passkeys gating via Stripe | PasskeySettings `planAllows` prop wired from user plan — works correctly once paid plans are enabled |
| Vault sharing stub | `VaultSharing` component exists; E2E key-exchange protocol not implemented |
| Multiple vaults | No `maxVaults` field in PLAN_LIMITS; feature not yet implemented |
| Desktop production URL | `APP_URL` is `null` when not in dev mode — static export required for distribution builds |
| Mobile TestFlight | EAS Build not configured; Expo Go only |
| Extension store submissions | Chrome Web Store, Edge Add-ons, Firefox AMO not yet submitted |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Must be replaced with real service account key before production |
| `app.securevoult.com` DNS | Domain referenced in desktop scaffold and legal pages but not configured |

---

## Files updated this pass (Session 8 additions)

| File | Change |
|---|---|
| `src/components/LandingPage.tsx` | Fixed widespread UTF-8 double-encoding corruption (em-dashes `—`, middle dots `·`, smart quotes rendered as mojibake across 20+ strings) |
| `src/components/LandingPage.tsx` | Roadmap: Company plan status "Planned" → "In development" (UI code exists; billing not wired) |
| `src/components/LandingPage.tsx` | Roadmap: Firefox extension "store submission planned" → "not yet started" |
| `src/components/LandingPage.tsx` | Browser extension grid card: Firefox note "store submission planned" → "not yet submitted" |
| `public/content.js` | Fixed UTF-8 encoding corruption in em-dashes and box-drawing characters |
| `extension-package/content.js` | Re-synced from fixed `public/content.js` |
| `extension-package/manifest.json` | Name "Secure Password Manager" → "SecureVoult"; title "Password Manager" → "SecureVoult"; version "1.0.0" → "1.0.0-beta"; description updated |
| `extension-package/INSTALL.md` | Intro: store submissions "in progress" → "not yet started" (consistent with individual sections) |
| `desktop/main.js` | `disable-features=OutOfBlinkCors` now only applied when `ELECTRON_ENV === 'development'` (security: was applied unconditionally in production) |
| `src/components/PasskeySettings.tsx` | Removed dead `Tablet` import (imported but never referenced in `deviceIcon()`) |
| `src/components/EntryCard.tsx` | `parseInt(localStorage)` guarded: NaN and out-of-range values fall back to 30s |
| `src/components/EntryCard.tsx` | `window.open(entry.url)` now gated behind `/^https?:\/\//` to prevent `javascript:` URI injection |
| `src/components/EntryDetailPanel.tsx` | Same `window.open` URL scheme guard applied to "Open website" button |
| `src/components/VaultInterface.tsx` | Breach scan session flag now set only after a successful API response (previously set before, so a network failure permanently suppressed future scans) |
| `src/app/api/entries/route.ts` | GET/POST return `303 + Location: /api/vault` instead of `200 + entries: []` (prevents callers from misinterpreting empty array as "no entries") |

---

## QA checklist — Session 8 results

| Area | Result |
|---|---|
| TypeScript | ✅ exit 0 |
| `npm run extension:check` | ✅ SecureVoult v1.0.0-beta MV3, correct permissions |
| LandingPage encoding | ✅ All mojibake fixed — em-dashes, middle dots, quotes render correctly |
| Extension manifest branding | ✅ Name and title match product name |
| Desktop CORS security | ✅ `disable-features=OutOfBlinkCors` guarded behind dev mode only |
| XSS via `javascript:` URL | ✅ Both `EntryCard` and `EntryDetailPanel` validate `https?://` before `window.open` |
| Breach scan retry on failure | ✅ Network failure no longer permanently suppresses the session scan |
| Entries route clarity | ✅ Returns 303 redirect hint instead of misleading 200 with empty array |

---



| File | Change |
|---|---|
| `src/components/PlanGate.tsx` | Hardcoded `£6`/`£8` prices replaced with `PLAN_PRICING` constant; added `PLAN_PRICING` import |
| `src/components/BillingSettings.tsx` | "Manage billing" button was dead (no onClick) — now shows informative toast with support email |
| `extension-package/INSTALL.md` | Removed "in progress" store submission claims → "not yet submitted" |
| `extension-package/content.js` | Replaced outdated unbranded version with production quality script from `public/content.js` |
| `extension-package/background.js` | Replaced outdated version with production quality script from `public/background.js` |
| `public/content.js` | Removed duplicate old code that had been appended after the production IIFE |
| `desktop/main.js` | Added `did-fail-load` handler with a helpful in-window error page when production build is missing |
| `src/app/terms/page.tsx` | "Premium and Teams plans" → "Pro and Company plans" |
| `docs/platform-release-checklist.md` | "Business: planned" → "Company: live" in plan status row |
| `docs/testing-extension.md` | "in progress" → "not yet submitted" in known issues table |
| `docs/qa-summary.md` | Updated throughout |

---

| File | Change |
|---|---|
| `src/components/LandingPage.tsx` | Business→Company rename, plan features aligned with plans.ts, passkeys row fixed, admin panel row fixed, extension CTA link fixed |
| `docs/testing-web.md` | Created — 10 test flows for web app |
| `docs/testing-extension.md` | Created — unpacked install, 6 test flows, permissions table |
| `docs/testing-desktop.md` | Created — Electron dev start, security checklist, limitations |
| `docs/testing-mobile.md` | Created — Expo start, biometric testing, EAS next steps |
| `docs/platform-release-checklist.md` | Created — 80+ pre-launch checkboxes across all platforms |
| `package.json` | Added: `verify`, `desktop:dev`, `desktop:build`, `mobile:start`, `mobile:ios`, `mobile:android`, `extension:check` |
| `README.md` | Platform status table (14 rows), public routes table, platform limitations table |

---

## QA checklist pass results

| Area | Result |
|---|---|
| TypeScript | ✅ exit 0 |
| `npm run extension:check` | ✅ MV3, correct permissions |
| Legal pages public routing | ✅ `/privacy` `/terms` `/cookies` `/dpa` `/security` — no auth gate |
| Landing page public at `/` | ✅ |
| Authenticated users can preview public site | ✅ `landing_preview` view state in `page.tsx` |
| Pricing plan naming consistent with `plans.ts` | ✅ Free / Pro / Company / Enterprise |
| Plan-to-platform table accuracy | ✅ Fixed — matches PLAN_LIMITS |
| Platform claims on landing page | ✅ Live / Beta / In development / Planned — no overclaims |
| Desktop security defaults | ✅ `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` |
| Extension permissions | ✅ Minimal, all justified |

---

## Blockers before broader public launch

1. Stripe price IDs — Pro and Company plans cannot be activated without them
2. Firebase Admin private key — placeholder in `.env.local`
3. Extension store submissions — no store installs available yet
4. `app.securevoult.com` domain — not configured
5. EAS Build — mobile apps cannot be distributed without it

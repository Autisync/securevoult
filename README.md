# SecureVoult

A zero-knowledge password manager with a Next.js 14 web app, browser extension, and Expo mobile companion.

---

## Architecture

| Layer | Technology |
|---|---|
| Auth | Firebase Auth (email/password + Google OAuth) |
| Server-side auth verification | Firebase Admin SDK (`firebase-admin`) |
| Database | MongoDB via Mongoose |
| Vault encryption | AES-256-GCM + PBKDF2 (Web Crypto API, client-side only) |
| Web frontend | Next.js 14 App Router, Tailwind CSS, Radix UI |
| Browser extension | Chrome Extension Manifest V3 (Chromium) / MV2 (Firefox) |
| Mobile | Expo (React Native) |
| Desktop | Electron — wraps the Next.js web app in a native window |

> **Zero-knowledge design:** Vault contents are encrypted client-side before being sent to the server. The server stores only an opaque encrypted blob — it never sees plaintext passwords or vault contents.

---

## Prerequisites

- Node.js 18+
- A [Firebase project](https://console.firebase.google.com) with Authentication enabled
- A MongoDB database (MongoDB Atlas recommended)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/securevoult.git
cd securevoult
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

- **Firebase client keys** — from Firebase Console → Project Settings → General → Your apps
- **Firebase Admin credentials** — from Firebase Console → Project Settings → Service Accounts → Generate new private key
- **MONGODB_URI** — your MongoDB Atlas connection string

### 3. Firebase Admin private key format

When pasting `FIREBASE_ADMIN_PRIVATE_KEY` into `.env.local`, replace all literal newlines in the key with `\n`:

```
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

### 4. Run in development

```bash
npm run dev
```

App starts at [http://localhost:3000](http://localhost:3000).

### 5. Build for production

```bash
npm run build
npm run start
```

### 6. Type-check & lint

```bash
npm run type-check
npm run lint
```

---

## User flow

1. **Sign up** with email/password or Google — creates a real Firebase account
2. **Set master password** — derives an AES-256 key via PBKDF2; the master password is never sent to the server
3. **Vault is created** — empty encrypted blob is saved to MongoDB
4. **Unlock vault** — enter master password; decryption happens entirely in the browser
5. **Add, edit, delete entries** — vault is re-encrypted and synced after each change

---

## API endpoints

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/api/auth/sync-user` | Firebase Bearer token | Upsert user profile in MongoDB |
| `GET` | `/api/vault` | Firebase Bearer token | Retrieve encrypted vault blob |
| `POST` | `/api/vault` | Firebase Bearer token + rate limit | Save encrypted vault blob |
| `GET` | `/api/health` | — | Service readiness check |
| `GET` | `/api/admin/users` | Firebase Bearer token + `admin` role | List users |
| `PUT` | `/api/admin/users` | Firebase Bearer token + `admin` role | Update user role/status |
| `GET` | `/api/admin/activities` | Firebase Bearer token + `admin` role | Audit log |

> All protected routes verify the Firebase ID token server-side via `firebase-admin`. **No route uses `atob()` or manual JWT decoding for authentication.**  
> Admin role is enforced server-side: the MongoDB `role` field is looked up after token verification — it is never derived from client-supplied claims.

---

## Security model

| Concern | Implementation |
|---|---|
| Authentication | Firebase Auth (email/password + Google OAuth) — all token verification via `firebase-admin` with `checkRevoked: true` |
| Session identity | Verified Firebase UID — server never trusts client-asserted identity |
| Session registry | `Session` model (MongoDB) tracks `clientType`, `userAgent`, `ipAddress`, `lastSeenAt`, `isRevoked`; 90-day TTL auto-expiry |
| Session revocation | `requireAuthenticatedUser` checks `X-Session-Id` header against revocation registry on every request; fails-open on DB error so Firebase token still gates all access |
| Device management | `GET /api/sessions` lists active sessions; `POST /api/sessions/revoke` revokes one or all-other sessions; enforced ownership checks |
| Vault encryption | AES-256-GCM + PBKDF2 (100,000 iterations, SHA-256), Web Crypto API, client-side only |
| Server storage | Opaque encrypted blob — server stores no plaintext secrets |
| Admin access | `requireVerifiedAdmin` shared helper: token verification + DB role check; never derived from client claims |
| Rate limiting | In-memory sliding window (Redis-upgradeable) on: auth sync, vault read/write, session ops, admin browse, admin mutations |
| Stale-write protection | `POST /api/vault` returns 409 when client version is behind server version |
| Extension trust | Messages validated by action shape; duplicate listener registrations removed; `lastSubmittedCredentials` cleared immediately on prompt dismiss/confirm/deny |
| XSS in extension | User-controlled values (domain, username) HTML-escaped; `showToast` builds DOM via `textContent` — no innerHTML with external data |
| Error responses | Shared `api-error.ts` helper; internal details stripped in production |

---

## Known security gaps (before production launch)

| Gap | Notes |
|---|---|
| Rate limiting | Current implementation is in-process (per Node.js instance). For multi-region or serverless deployments, swap to Redis/Upstash using the `RateLimitStore` interface in `src/lib/rate-limit.ts` |
| 2FA / TOTP | Firebase multi-factor enrollment not yet implemented in the UI |
| Vault sharing E2E | `VaultSharing` component + `/api/vault/share` stub exist; full key-exchange protocol not implemented |
| Passkeys / WebAuthn | Not yet implemented; would replace master password for vault unlock |
| PDF recovery kit | Currently HTML download; PDF rendering (jsPDF / Puppeteer) would be more portable |
| Breach monitoring scheduler | Current scan is per-session on vault unlock; proactive background scan needs a cron job / queue |
| Audit log exposure | `AdminActivity.details` stores raw query params — review what goes into `details` before exposing the admin panel to multiple operators |

---

## Phase 2 roadmap

- 2FA / TOTP support via Firebase multi-factor auth
- Redis-backed rate limiting for multi-region deployments
- Secure vault sharing / team vaults (key exchange protocol)
- Passkeys / WebAuthn for vault unlock
- PDF recovery kit
- Breach monitoring scheduler
- Audit log UI

---

## Platform support status

| Platform | Status | Notes |
|---|---|---|
| Web app (Next.js) | **Live** | Fully functional — auth, vault, admin panel |
| Browser extension — Chrome | **Beta** | Manual unpacked install; Chrome Web Store submission in progress |
| Browser extension — Edge | **Beta** | Manual unpacked install; Edge Add-ons submission in progress |
| Browser extension — Brave | **Beta** | Compatible with Chrome MV3 manifest |
| Browser extension — Opera | **Beta** | Load via Chrome Web Store or unpacked |
| Browser extension — Firefox | **In development** | Separate MV2 manifest exists; AMO submission in progress |
| Browser extension — Safari | **Planned** | Requires Xcode conversion via `safari-web-extension-converter` |
| iOS app | **In development** | Expo scaffold with biometric unlock; TestFlight beta coming |
| Android app | **In development** | Beta APK sideload available; Play Store release planned |
| Windows desktop | **In development** | Electron scaffold; Windows Store submission planned |
| macOS desktop | **In development** | Electron scaffold (.dmg); Mac App Store submission planned |
| Linux desktop | **In development** | Electron scaffold (.AppImage / .deb / .rpm) |
| Passkeys / WebAuthn | **Planned** | Will replace master password for vault unlock |
| Business / Teams plan | **Planned** | Shared vaults, admin panel, user management |
| Enterprise SSO | **Roadmap** | SAML / OIDC integration |

---

## Public site routes

| Route | Description |
|---|---|
| `/` | Landing page — public, no auth required |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |
| `/cookies` | Cookie Policy |
| `/dpa` | Data Processing Agreement |
| `/security` | Security Disclosure & responsible disclosure policy |
| `/api/health` | Service health check — no auth required |

Legal pages are rendered as Next.js App Router RSC routes and are publicly accessible without authentication. They share the `LegalLayout` component (`src/components/LegalLayout.tsx`) for consistent header/footer/TOC rendering.

---

## Platform limitations (pre-launch)

| Limitation | Details |
|---|---|
| Extension stores | Not yet published to Chrome Web Store, Edge Add-ons, or Firefox AMO — manual install only |
| Mobile distribution | No App Store / Play Store listing yet — Expo builds only |
| Desktop distribution | Electron scaffold only — no signed releases or store submissions yet |
| Paid plans | Stripe integration scaffolded; Pro/Business plans disabled until store submission readiness |
| Vault sharing | `VaultSharing` component + `/api/vault/share` stub exist — full key-exchange protocol not implemented |
| Desktop auth | Electron loads `http://localhost:3000` in development; production auth flow to `app.securevoult.com` not yet wired |
| Safari extension | Requires Xcode 15+ and Apple Developer account for conversion and distribution |

# Platform Release Checklist

Use this checklist before publishing or promoting any platform to users.

---

## Web application

- [ ] `.env.local` — all keys filled (Firebase, MongoDB, Stripe)
- [ ] `FIREBASE_ADMIN_PRIVATE_KEY` — real service account key (not placeholder)
- [ ] Firebase Auth — email/password and Google OAuth enabled in Firebase Console
- [ ] MongoDB Atlas — IP allowlist configured for production server
- [ ] `npm run build` — exits 0 with no errors
- [ ] `npm run type-check` — exits 0
- [ ] `npm run lint` — exits 0
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Admin panel role gating tested (non-admin cannot access `/api/admin/*`)
- [ ] Rate limiting tested (rapid requests return 429)
- [ ] Vault encrypt/decrypt round-trip tested
- [ ] Breach monitoring returns results for known-breached passwords
- [ ] GDPR export works (Settings → Export)
- [ ] Legal pages reachable without auth: `/privacy` `/terms` `/cookies` `/dpa` `/security`
- [ ] Cookie consent banner appears on first visit
- [ ] Dark theme renders correctly on all major sections

---

## Browser extension

- [ ] `extension-package/manifest.json` — version number updated
- [ ] `manifest_version: 3` for Chromium, `manifest_version: 2` for Firefox
- [ ] All permissions in manifest are justified (no over-permissioning)
- [ ] `host_permissions` scope reviewed — narrow if possible
- [ ] Extension loads unpacked in Chrome without errors
- [ ] Extension loads unpacked in Edge without errors
- [ ] Extension loads unpacked in Brave without errors
- [ ] Firefox: `manifest-firefox.json` swap tested — loads in `about:debugging`
- [ ] Autofill triggers correctly on login forms
- [ ] Save-login prompt appears after form submit
- [ ] Password generator context menu works
- [ ] Popup shows vault entries and search
- [ ] Keyboard shortcuts (`Ctrl+Shift+F`, `Ctrl+Shift+P`) work
- [ ] Extension icon appears in toolbar
- [ ] No `innerHTML` with user-controlled data (XSS check)
- [ ] Chrome Web Store submission checklist completed (privacy policy URL, screenshots, etc.)

---

## Desktop app (Electron)

- [ ] `desktop/` — `npm install` works cleanly
- [ ] `npm run desktop:dev` — Electron opens and loads `localhost:3000`
- [ ] `nodeIntegration: false` in `main.js` BrowserWindow config
- [ ] `contextIsolation: true` in `main.js`
- [ ] `sandbox: true` in `main.js`
- [ ] `preload.js` — contextBridge exposes only a minimal named API
- [ ] No raw Node.js APIs accessible from renderer
- [ ] `npm run build` (in `desktop/`) — builds without errors
- [ ] System tray icon appears (if applicable)
- [ ] Production URL set to `app.securevoult.com` (not `localhost:3000`)
- [ ] Code signing certificate configured (Windows: PFX; macOS: Developer ID)
- [ ] Auto-update server URL configured in `electron-builder` config

---

## iOS app

- [ ] `npx expo start` — Expo dev server starts without errors
- [ ] App loads in iOS Simulator
- [ ] App loads on physical iPhone via Expo Go
- [ ] Face ID / Touch ID biometric prompt appears on vault unlock
- [ ] Vault entries display correctly
- [ ] No crash on cold start
- [ ] `app.json` — correct bundle identifier (`com.securevoult.app`)
- [ ] App icons and splash screen set correctly
- [ ] EAS Build configured (`eas.json` present)
- [ ] TestFlight build uploaded and tested
- [ ] Apple App Store submission checklist completed (privacy labels, screenshots, etc.)

---

## Android app

- [ ] App loads in Android Emulator
- [ ] App loads on physical Android device via Expo Go
- [ ] Fingerprint / face unlock prompt appears on vault unlock
- [ ] Vault entries display correctly
- [ ] No crash on cold start
- [ ] `app.json` — correct package name (`com.securevoult.app`)
- [ ] Adaptive icons set
- [ ] EAS Build configured
- [ ] Beta APK tested on at least one physical device
- [ ] Google Play Store submission checklist completed (data safety form, screenshots, etc.)

---

## Legal / public routes

- [ ] `/privacy` — loads, TOC navigation works, contact email present
- [ ] `/terms` — loads, governing law section present
- [ ] `/cookies` — loads, cookie category table present
- [ ] `/dpa` — loads, Article 28 sub-processor table present
- [ ] `/security` — loads, responsible disclosure scope and contact email present
- [ ] Footer trust strip links all resolve correctly
- [ ] No `href="#"` placeholder links remain in footer or legal pages
- [ ] `privacy@securevoult.com` and `security@securevoult.com` resolve or forward correctly

---

## Pricing / public messaging

- [ ] Free plan CTA is active — other plan CTAs are disabled
- [ ] Plan status badges accurate (Free: live / Pro: live / Company: live / Enterprise: contact us)
- [ ] No App Store / Play Store / Mac App Store claims unless submissions are approved
- [ ] Extension described as Beta (not "Available" / "Live") until store submission approved
- [ ] Roadmap section statuses are current
- [ ] Platform cards accurately reflect current implementation state
- [ ] Waitlist email links (`waitlist@securevoult.com`) are functional

---

## Security review (pre-launch)

- [ ] No secrets in source code or committed `.env` files
- [ ] Rate limiting active on all auth and vault mutation endpoints
- [ ] CSRF protection in place for state-changing routes
- [ ] `X-Frame-Options` / CSP headers configured in `next.config.js`
- [ ] Admin routes gated by `requireVerifiedAdmin` (token verification + DB role check)
- [ ] `checkRevoked: true` used in all `verifyIdToken` calls
- [ ] Vault stale-write protection tested (409 on version conflict)
- [ ] Error responses strip internal details in production

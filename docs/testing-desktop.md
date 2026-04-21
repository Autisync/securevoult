# Testing Guide — Desktop App (Electron)

**Status: In Development — Scaffold**  
This is a functional Electron scaffold. Authentication and vault sync are not yet fully wired for production use.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | [nodejs.org](https://nodejs.org) |
| The web app running locally | `npm run dev` from project root |
| `desktop/` folder | Electron scaffold |

---

## Install Electron dependencies

```bash
cd desktop
npm install
```

---

## Start in development mode

1. Start the Next.js web app first (from project root):

```bash
npm run dev
```

2. In a second terminal, start Electron:

```bash
cd desktop
npm run dev
# or from project root:
npm run desktop:dev
```

Electron opens a native window loading `http://localhost:3000`.

---

## What to verify

### Window loads correctly

- The SecureVoult app should load inside the Electron window
- Verify navigation works (sign up / sign in / vault)
- Verify the window title is "SecureVoult"

### Security defaults

The desktop app is configured with secure defaults — verify in `desktop/main.js`:

| Setting | Expected |
|---|---|
| `nodeIntegration` | `false` |
| `contextIsolation` | `true` |
| `sandbox` | `true` |
| `webSecurity` | `true` (except in dev pointing to localhost) |
| Preload script | Only exposes specific safe APIs via `contextBridge` |

### Preload API surface

Check `desktop/preload.js` — the `contextBridge` should expose only a minimal, named API set. No raw Node.js APIs should be accessible from the renderer.

### System tray

- Verify the SecureVoult icon appears in the system tray/menu bar
- Verify tray menu shows: Open, Lock vault, Quit

---

## Build a local distributable (optional)

```bash
cd desktop
npm run build           # builds for your current OS
npm run build:win       # Windows NSIS installer
npm run build:mac       # macOS .dmg
npm run build:linux     # Linux AppImage + .deb
```

> Unsigned builds will show OS warnings. Code signing requires a certificate.

---

## Current limitations

| Limitation | Notes |
|---|---|
| Auth in production | Desktop loads `localhost:3000` in dev; production URL (`app.securevoult.com`) not yet wired |
| Biometric unlock | Scaffold only — `keytar` / OS credential store not integrated |
| Auto-update | `electron-builder` auto-update config present but update server not set up |
| Native notifications | Not yet implemented |
| Offline vault cache | Desktop relies on web app's service worker; no separate native cache |
| Windows Store / Mac App Store | Store submissions planned after auth flow is production-ready |

---

## Auth flow architecture (planned)

```
Electron renderer (Next.js web app)
    ↓  Firebase Auth (email/password / Google OAuth)
    ↓  Firebase ID token
    ↓  POST /api/auth/sync-user  → MongoDB user record
    ↓  Vault loaded via /api/vault
```

The renderer handles all auth — Electron's main process does NOT access the vault or Firebase directly. This preserves the zero-knowledge architecture.

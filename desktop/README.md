# SecureVoult Desktop App

> **Status: In Development — Scaffold**
>
> This is a functional Electron scaffold, not a production release.
> The authentication, vault sync, and update mechanisms are not yet fully wired.
> Do not distribute builds from this scaffold as a finished product.
> Store submissions (Windows Store, Mac App Store, Snap Store) are planned once the desktop
> auth flow is complete and the builds have been independently tested.

Zero-knowledge password manager — native desktop builds for Windows, macOS, and Linux.

Built with [Electron](https://electronjs.org) wrapping the SecureVoult Next.js web app. The vault encryption still runs entirely in the renderer (same Web Crypto as the browser) — no Node.js access is exposed to the vault UI.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 | Install via [nvm](https://github.com/nvm-sh/nvm) |
| npm | ≥ 10 | Bundled with Node |
| electron-builder | bundled | via devDependencies |

For **macOS signing** you'll also need Xcode Command Line Tools + an Apple Developer certificate.  
For **Windows signing** you need a code signing certificate (.pfx) and set `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`.

---

## Build the Next.js static export first

From the project root:

```bash
npm run build          # builds .next/
npx next export        # exports to out/   (requires output: 'export' in next.config.js)
```

> **Note:** The desktop app in dev mode loads `http://localhost:3000` directly. The static export is only needed for distribution builds.

---

## Development (hot reload)

```bash
# Terminal 1 — start Next.js dev server
cd ..
npm run dev

# Terminal 2 — start Electron pointing at dev server
cd desktop
npm install
npm run dev
```

---

## Building distributable packages

```bash
cd desktop
npm install

# All platforms (requires macOS for .dmg/.mas, Linux for .AppImage)
npm run build

# Windows only (.exe NSIS installer + portable)
npm run build:win

# macOS only (.dmg + .mas)
npm run build:mac

# Linux only (.AppImage + .deb + .rpm)
npm run build:linux
```

Output is written to `desktop/dist/`.

---

## Platform notes

### Windows
- NSIS installer (`SecureVoult Setup x.x.x.exe`) — standard install to `%LocalAppData%\Programs\SecureVoult`
- Portable build — single `.exe`, no install required
- Supports Windows Hello biometric unlock via the web app's WebAuthn/passkey layer

### macOS
- `.dmg` for direct distribution — drag to Applications
- `.mas` build for Mac App Store submission (requires Apple Developer Program + provisioning profile)
- Touch ID unlock via WebAuthn passkey layer in the vault
- Universal binary: x64 (Intel) + arm64 (Apple Silicon)

### Linux
- `.AppImage` — runs on any distribution without install: `chmod +x SecureVoult.AppImage && ./SecureVoult.AppImage`
- `.deb` — for Debian/Ubuntu: `sudo dpkg -i securevoult_x.x.x_amd64.deb`
- `.rpm` — for Fedora/RHEL: `sudo rpm -i securevoult-x.x.x.x86_64.rpm`
- Snap — for Ubuntu Snap Store

---

## Icons

Place icons in `desktop/icons/`:

| File | Size | Platform |
|------|------|---------|
| `icon.ico` | 256×256 multi-size | Windows |
| `icon.icns` | 1024×1024 | macOS |
| `icon.png` | 1024×1024 | Linux |
| `icon-tray.png` | 22×22 (or 44 for HiDPI) | Linux tray |

---

## Security model

- `contextIsolation: true` — renderer cannot access Electron/Node APIs directly  
- `nodeIntegration: false` — no Node.js in the renderer process  
- `sandbox: true` — renderer runs in OS-level sandbox  
- All navigation to external origins is intercepted and opened in the system browser  
- All `window.open()` calls are blocked and redirected to the system browser

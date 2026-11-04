# SecureVoult Browser Extension — Installation Guide

> **Status: Beta — Manual Install Only**
>
> The extension is functional but has not yet been submitted to any browser extension store.
> All installs below are **developer / unpacked loads** — this means:
> - Users must have Developer mode enabled
> - Extensions loaded this way do not auto-update
> - Store submissions to Chrome Web Store, Edge Add-ons, and Firefox AMO are **not yet started**
>
> When store listings go live, this document will be updated with direct install links.

---

## Chrome (stable)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `extension-package/` folder
5. The SecureVoult shield icon appears in your toolbar

> **Store install:** Chrome Web Store submission has not been submitted yet. When available, a direct install link will appear here.

---

## Microsoft Edge

Edge supports Chrome Web Store extensions natively.

1. Open `edge://extensions/`
2. Enable **Developer mode** (left sidebar toggle)
3. Click **Load unpacked**
4. Select this `extension-package/` folder

> **Store install:** Edge Add-ons store submission not yet submitted.

---

## Brave

Brave is Chromium-based and fully compatible with the Chrome MV3 manifest.

1. Open `brave://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this `extension-package/` folder

Or install directly from the Chrome Web Store inside Brave.

---

## Opera

1. Install the [Install Chrome Extensions](https://addons.opera.com/en/extensions/details/install-chrome-extensions/) Opera add-on
2. Then install from the Chrome Web Store — or:
3. Open `opera://extensions/` → **Developer mode** → **Load unpacked** → select this folder

---

## Firefox (Manifest V2)

Firefox uses a separate manifest. **Before loading**, rename or copy `manifest-firefox.json` to `manifest.json` (or load the dedicated Firefox build):

```bash
# From extension-package/
copy manifest.json manifest-mv3-backup.json
copy manifest-firefox.json manifest.json
```

Then:

1. Open `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on…**
4. Select the `manifest.json` file from this folder

> Temporary add-ons are removed when Firefox restarts. For a permanent install, the extension must be submitted to [addons.mozilla.org](https://addons.mozilla.org) (AMO) — not yet submitted.

**Signed build install (once published):**
```
Firefox → ⚙ Add-ons → Extensions → ⚙ gear icon → Install Add-on From File → select .xpi
```

---

## Safari (macOS / iOS)

Safari Web Extensions require conversion via Apple's tooling:

```bash
# Requires Xcode 15+ on macOS
xcrun safari-web-extension-converter extension-package/ \
  --project-location ./safari-extension \
  --app-name "SecureVoult" \
  --bundle-identifier com.securevoult.extension
```

This generates an Xcode project. Build and run it to sideload into Safari (requires a free or paid Apple Developer account).

For **iOS Safari**, the converted Xcode project also builds a containing iOS app — install it via TestFlight or Xcode.

> Production Safari extension: distribution via Mac App Store / App Store — not yet submitted.

---

## Keyboard shortcuts

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| Autofill current page | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Open vault popup | `Ctrl+Shift+P` | `Cmd+Shift+P` |

---

## Vault connection

The extension connects to your SecureVoult account at:

- **Production:** `https://app.securevoult.co.uk`
- **Local dev:** `http://localhost:3000`

All communication uses your Firebase ID token (Bearer). The extension never stores your master password — vault decryption happens locally in the popup.

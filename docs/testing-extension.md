# Testing Guide — Browser Extension

**Status: Beta** | Chrome · Edge · Brave · Opera — manual/unpacked install only  
**Firefox:** In development (MV2 manifest, AMO submission planned)  
**Safari:** Planned (requires Xcode conversion)

---

## Prerequisites

- The `extension-package/` folder from this repository
- A Chromium browser (Chrome, Edge, Brave, or Opera)
- Developer mode enabled in the browser

---

## Load the extension (Chrome / Edge / Brave)

1. Open your browser's extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
2. Enable **Developer mode** (toggle in the top-right or left sidebar)
3. Click **Load unpacked**
4. Select the `extension-package/` folder
5. The SecureVoult shield icon appears in the toolbar

```
extension-package/
├── manifest.json        ← MV3 (Chromium)
├── background.js        ← service worker
├── content.js           ← autofill injector
├── popup.html / popup.js
└── icons/
```

---

## Load the extension (Opera)

1. Install the [Install Chrome Extensions](https://addons.opera.com/en/extensions/details/install-chrome-extensions/) Opera add-on first
2. Then load unpacked from `opera://extensions/` → Developer mode → Load unpacked

---

## Load the extension (Firefox — MV2)

Firefox requires the separate MV2 manifest:

```bash
# From extension-package/
copy manifest.json manifest-mv3-backup.json
copy manifest-firefox.json manifest.json
```

1. Open `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on…**
4. Select `manifest.json` from `extension-package/`

> Temporary add-ons are removed on restart. Permanent install requires AMO submission.

---

## Test flows

### 1. Connect to your vault

1. Open the extension popup (click the shield icon)
2. Sign in with your SecureVoult account
3. Verify vault entries are visible in the popup

### 2. Autofill

1. Navigate to any login page (or use a test site like `example.com`)
2. Press `Ctrl+Shift+F` (`Cmd+Shift+F` on Mac) to trigger autofill
3. Verify the username/password fields are filled

### 3. Save-login prompt

1. Manually type a username + password on a login form
2. Submit the form
3. Verify the extension shows a **Save this login?** prompt
4. Accept — verify the entry appears in your vault

### 4. Password generator

1. Right-click on a password input field
2. Select **Generate password** from the context menu
3. Verify a strong password is inserted

### 5. Popup vault search

1. Open the popup
2. Search for an existing entry
3. Click **Copy password** — verify the password is in clipboard
4. Click **Fill** — verify it autofills the current page

### 6. Breach alert

1. Open the popup on any page
2. If a saved entry has a breached password, a red badge should appear
3. Click the entry to see breach details

---

## Keyboard shortcuts

| Action | Windows / Linux | macOS |
|---|---|---|
| Autofill current page | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Open vault popup | `Ctrl+Shift+P` | `Cmd+Shift+P` |

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Save encrypted session token and preferences locally |
| `activeTab` | Read the current page domain for autofill matching |
| `tabs` | Access page URL for autofill site detection |
| `contextMenus` | Right-click → Generate password |
| `scripting` | Inject autofill script into login pages |
| `http://*/* https://*/*` | Autofill on any site |

---

## Known limitations

| Issue | Notes |
|---|---|
| No auto-update | Unpacked extensions do not auto-update — reload manually after changes |
| Firefox restart | Temporary add-ons are removed on Firefox restart |
| Safari | Not yet converted; requires Xcode 15+ and Apple Developer account |
| Store submission | Chrome Web Store, Edge Add-ons, Firefox AMO — not yet submitted |

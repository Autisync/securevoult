# Store Listings — SecureVoult Browser Extension

This directory contains per-store listing metadata and submission guides.

| Store | Status | Guide |
|---|---|---|
| Chrome Web Store | Not yet submitted | [chrome/SUBMIT.md](chrome/SUBMIT.md) |
| Microsoft Edge Add-ons | Not yet submitted | [edge/SUBMIT.md](edge/SUBMIT.md) |
| Firefox AMO | Not yet submitted — MV2 port required | [firefox/SUBMIT.md](firefox/SUBMIT.md) |

## Preparing the ZIP

```powershell
# Windows — Chrome/Edge
Compress-Archive -Path extension-package\* -DestinationPath securevoult-chrome.zip

# macOS/Linux — Chrome/Edge
cd extension-package && zip -r ../securevoult-chrome.zip . -x "*.DS_Store"
```

## Before you submit

- [ ] Extension loads without errors in Chrome (chrome://extensions → Load unpacked)
- [ ] All screenshots created (see per-store screenshots/README.md)
- [ ] Privacy policy live at https://securevoult.co.uk/privacy
- [ ] Developer account created for each store
- [ ] Version bumped in extension-package/manifest.json
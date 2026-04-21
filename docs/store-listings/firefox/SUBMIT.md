# Submitting to Firefox

Store URL: https://addons.mozilla.org/developers/

## Upload steps

⚠️  Firefox requires Manifest Version 2 (MV2), not MV3.
   A separate manifest.json is needed. Key differences:
   - Replace "manifest_version": 3 → "manifest_version": 2
   - Replace "action" → "browser_action"
   - Replace "background.service_worker" → "background.scripts": ["background.js"]
   - Replace "host_permissions" → move into "permissions"
1. Create extension-package-firefox/ with the MV2 manifest
2. Zip it: Compress-Archive -Path extension-package-firefox\* -DestinationPath securevoult-firefox.zip
3. Go to: https://addons.mozilla.org/developers/
4. Click "Submit a New Add-on" → upload the ZIP
5. Fill in fields from firefox/listing.json
6. Source code submission is required by Mozilla for obfuscated scripts.
7. Review takes 1–4 weeks for first submission.

## Notes

- Firefox review is stricter and slower than Chrome/Edge.
- Mozilla requires source code if the extension is minified.
- Use browser.* API (with webextension-polyfill) instead of chrome.* for MV2.
- Consider using the webextension-polyfill package for cross-browser compatibility.
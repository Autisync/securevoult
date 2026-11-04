# Submitting to Chrome

Store URL: https://chrome.google.com/webstore/devconsole

## Upload steps

1. Zip the extension-package/ folder:
     cd extension-package && zip -r ../securevoult-chrome.zip . -x "*.DS_Store" -x "__MACOSX/*"
   On Windows:
     Compress-Archive -Path extension-package\* -DestinationPath securevoult-chrome.zip
2. Go to: https://chrome.google.com/webstore/devconsole
3. Click "New item" → upload securevoult-chrome.zip
4. Fill in fields from chrome/listing.json
5. Upload screenshots from chrome/screenshots/ folder
6. Submit for review (1-3 business days)

## Notes

- You need a Google developer account ($5 one-time fee).
- Manifest version 3 (MV3) is required — our manifest.json already uses MV3.
- Broad host permissions (host_permissions: https://*/*) will still receive manual review.
- Include a justification in the review notes: autofill requires access on secure login pages.
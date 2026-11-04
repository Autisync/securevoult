#!/usr/bin/env node
/**
 * scripts/prepare-store-listings.js
 *
 * Generates all store listing metadata files for:
 *   - Chrome Web Store
 *   - Microsoft Edge Add-ons
 *   - Firefox AMO (Add-ons for Firefox)
 *
 * Output: docs/store-listings/{chrome,edge,firefox}/
 *
 * Usage:  node scripts/prepare-store-listings.js
 *
 * After running this script:
 *   1. Chrome  → upload extension-package/ ZIP to https://chrome.google.com/webstore/devconsole
 *   2. Edge    → upload ZIP to https://partner.microsoft.com/en-us/dashboard/microsoftedge
 *   3. Firefox → upload XPI at https://addons.mozilla.org/developers/
 *
 * Note: Firefox requires a separate MV2 manifest. See docs/store-listings/firefox/NOTES.md
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const OUT_BASE  = path.join(ROOT, 'docs', 'store-listings');

// ── Shared copy ───────────────────────────────────────────────────────────────

const SHORT_DESC = 'Zero-knowledge password manager with autofill and breach monitoring.';

const LONG_DESC = `SecureVoult is a zero-knowledge, AES-256 encrypted password manager with browser autofill.

FEATURES
• Autofill login credentials on any website — one click or keyboard shortcut
• Save new login prompts appear automatically when you log in
• Zero-knowledge encryption: your master password never leaves your device
• AES-256 + PBKDF2 vault encryption (100,000 rounds)
• Breach monitoring: checks passwords against HaveIBeenPwned without revealing them
• Secure clipboard copy with configurable auto-clear timeout
• Works with Chrome, Edge, Brave, and Opera

PRIVACY
SecureVoult cannot read your passwords. Your vault is encrypted locally before it ever reaches our servers. We use k-anonymity (HIBP range API) for breach checks — we never send your actual password hashes to any external service.

PERMISSIONS EXPLAINED
• storage: Save your encrypted vault locally
• activeTab: Detect login forms on the current tab
• tabs: Navigate to the vault interface when requested
• contextMenus: Right-click "Fill with SecureVoult" shortcut
• https://*/*: Detect and fill login forms on secure websites

SETUP
Install the extension, click the toolbar icon, and sign in with your SecureVoult account. Your encrypted vault syncs automatically (Pro plan required for cross-device sync).

SOURCE / PRIVACY POLICY
https://securevoult.co.uk/privacy`;

// ── Screenshots spec ──────────────────────────────────────────────────────────
// Chrome: 1280×800 or 640×400 PNG/JPG, up to 5 screenshots
// Edge:   same requirements as Chrome
// Firefox: 780×585 minimum, up to 5 screenshots

const SCREENSHOT_SPEC = {
  required: [
    { name: '01-popup-vault',     desc: 'Extension popup showing the vault entry list' },
    { name: '02-autofill-badge',  desc: 'Autofill badge appearing on a login form' },
    { name: '03-save-login',      desc: 'Save-login prompt appearing after a successful login' },
    { name: '04-breach-warning',  desc: 'Breach monitoring warning for a compromised password' },
    { name: '05-popup-settings',  desc: 'Extension settings panel' },
  ],
  dimensions: {
    chrome:  '1280×800 or 640×400 (PNG/JPEG, max 1 MB each)',
    edge:    '1280×800 or 640×400 (PNG/JPEG, max 1 MB each)',
    firefox: 'Minimum 780×585 (PNG/JPEG)',
  },
};

// ── Per-store metadata ────────────────────────────────────────────────────────

const STORES = {
  chrome: {
    name:              'SecureVoult',
    summary:           SHORT_DESC,
    description:       LONG_DESC,
    category:          'Productivity',
    language:          'English (United Kingdom)',
    homepageUrl:       'https://securevoult.co.uk',
    supportUrl:        'https://securevoult.co.uk/security',
    privacyPolicyUrl:  'https://securevoult.co.uk/privacy',
    submitUrl:         'https://chrome.google.com/webstore/devconsole',
    uploadInstructions: [
      '1. Zip the extension-package/ folder:',
      '     cd extension-package && zip -r ../securevoult-chrome.zip . -x "*.DS_Store" -x "__MACOSX/*"',
      '   On Windows:',
      '     Compress-Archive -Path extension-package\\* -DestinationPath securevoult-chrome.zip',
      '2. Go to: https://chrome.google.com/webstore/devconsole',
      '3. Click "New item" → upload securevoult-chrome.zip',
      '4. Fill in fields from chrome/listing.json',
      '5. Upload screenshots from chrome/screenshots/ folder',
      '6. Submit for review (1-3 business days)',
    ],
    notes: [
      'You need a Google developer account ($5 one-time fee).',
      'Manifest version 3 (MV3) is required — our manifest.json already uses MV3.',
      'Broad host permissions (host_permissions: https://*/*) will still receive manual review.',
      'Include a justification in the review notes: autofill requires access on secure login pages.',
    ],
  },

  edge: {
    name:              'SecureVoult',
    shortDescription:  SHORT_DESC,
    longDescription:   LONG_DESC,
    category:          'Productivity',
    language:          'en-GB',
    developerName:     'SecureVoult Ltd',
    privacyPolicyUrl:  'https://securevoult.co.uk/privacy',
    supportUrl:        'https://securevoult.co.uk/security',
    websiteUrl:        'https://securevoult.co.uk',
    submitUrl:         'https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview',
    uploadInstructions: [
      '1. Use the same securevoult-chrome.zip (Edge uses the same MV3 format)',
      '2. Go to: https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview',
      '3. Click "Create extension" → upload the ZIP',
      '4. Fill in fields from edge/listing.json',
      '5. Submit for review (1-7 business days)',
    ],
    notes: [
      'Edge Add-ons accepts the identical Chrome MV3 ZIP — no changes needed.',
      'Microsoft requires a Partner Center account (free).',
      'Enable "Availability: All regions" unless you want to restrict distribution.',
    ],
  },

  firefox: {
    name:              'SecureVoult',
    summary:           SHORT_DESC.slice(0, 250),
    description:       LONG_DESC,
    categories:        ['security-privacy'],
    tags:              ['password-manager', 'autofill', 'encryption', 'security'],
    homepageUrl:       'https://securevoult.co.uk',
    supportUrl:        'https://securevoult.co.uk/security',
    privacyPolicyUrl:  'https://securevoult.co.uk/privacy',
    submitUrl:         'https://addons.mozilla.org/developers/',
    uploadInstructions: [
      '⚠️  Firefox requires Manifest Version 2 (MV2), not MV3.',
      '   A separate manifest.json is needed. Key differences:',
      '   - Replace "manifest_version": 3 → "manifest_version": 2',
      '   - Replace "action" → "browser_action"',
      '   - Replace "background.service_worker" → "background.scripts": ["background.js"]',
      '   - Replace "host_permissions" → move into "permissions"',
      '1. Create extension-package-firefox/ with the MV2 manifest',
      '2. Zip it: Compress-Archive -Path extension-package-firefox\\* -DestinationPath securevoult-firefox.zip',
      '3. Go to: https://addons.mozilla.org/developers/',
      '4. Click "Submit a New Add-on" → upload the ZIP',
      '5. Fill in fields from firefox/listing.json',
      '6. Source code submission is required by Mozilla for obfuscated scripts.',
      '7. Review takes 1–4 weeks for first submission.',
    ],
    notes: [
      'Firefox review is stricter and slower than Chrome/Edge.',
      'Mozilla requires source code if the extension is minified.',
      'Use browser.* API (with webextension-polyfill) instead of chrome.* for MV2.',
      'Consider using the webextension-polyfill package for cross-browser compatibility.',
    ],
  },
};

// ── Generate output files ─────────────────────────────────────────────────────

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  [file]  ${path.relative(ROOT, filePath)}`);
}

function main() {
  console.log('\n[store-listings]  SecureVoult -- Store Listing Generator\n');

  for (const [store, meta] of Object.entries(STORES)) {
    const dir = path.join(OUT_BASE, store);

    // 1. listing.json — copy-paste metadata for the store form
    write(path.join(dir, 'listing.json'), JSON.stringify(meta, null, 2));

    // 2. screenshots/README.md — what screenshots to make
    const screenshotLines = [
      `# ${store.charAt(0).toUpperCase() + store.slice(1)} Screenshots`,
      '',
      `Required dimensions: ${SCREENSHOT_SPEC.dimensions[store]}`,
      '',
      '## Required screenshots (in order)',
      '',
      ...SCREENSHOT_SPEC.required.map((s, i) =>
        `${i + 1}. **${s.name}.png** — ${s.desc}`
      ),
      '',
      '## Naming convention',
      'Save files as PNG named exactly as above, e.g. `01-popup-vault.png`.',
    ].join('\n');
    write(path.join(dir, 'screenshots', 'README.md'), screenshotLines);

    // 3. SUBMIT.md — step-by-step submission guide
    const submitLines = [
      `# Submitting to ${store.charAt(0).toUpperCase() + store.slice(1)}`,
      '',
      `Store URL: ${meta.submitUrl}`,
      '',
      '## Upload steps',
      '',
      ...(meta.uploadInstructions || []).map(s => s),
      '',
      '## Notes',
      '',
      ...(meta.notes || []).map(n => `- ${n}`),
    ].join('\n');
    write(path.join(dir, 'SUBMIT.md'), submitLines);
  }

  // 4. Top-level README
  const readmeLines = [
    '# Store Listings — SecureVoult Browser Extension',
    '',
    'This directory contains per-store listing metadata and submission guides.',
    '',
    '| Store | Status | Guide |',
    '|---|---|---|',
    '| Chrome Web Store | Not yet submitted | [chrome/SUBMIT.md](chrome/SUBMIT.md) |',
    '| Microsoft Edge Add-ons | Not yet submitted | [edge/SUBMIT.md](edge/SUBMIT.md) |',
    '| Firefox AMO | Not yet submitted — MV2 port required | [firefox/SUBMIT.md](firefox/SUBMIT.md) |',
    '',
    '## Preparing the ZIP',
    '',
    '```powershell',
    '# Windows — Chrome/Edge',
    'Compress-Archive -Path extension-package\\* -DestinationPath securevoult-chrome.zip',
    '',
    '# macOS/Linux — Chrome/Edge',
    'cd extension-package && zip -r ../securevoult-chrome.zip . -x "*.DS_Store"',
    '```',
    '',
    '## Before you submit',
    '',
    '- [ ] Extension loads without errors in Chrome (chrome://extensions → Load unpacked)',
    '- [ ] All screenshots created (see per-store screenshots/README.md)',
    '- [ ] Privacy policy live at https://securevoult.co.uk/privacy',
    '- [ ] Developer account created for each store',
    '- [ ] Version bumped in extension-package/manifest.json',
  ].join('\n');
  write(path.join(OUT_BASE, 'README.md'), readmeLines);

  console.log(`\n[ok]  Store listing files written to docs/store-listings/`);
  console.log('\n   Next steps:');
  console.log('   1. Create developer accounts (Chrome: $5 one-time, Edge: free, Firefox: free)');
  console.log('   2. Take screenshots and save them to the screenshots/ folders');
  console.log('   3. Follow the SUBMIT.md guide for each store');
  console.log('');
}

main();

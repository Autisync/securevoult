# Phase 2 - Platform Gate

- Overall: **PASS**
- Passed: 5
- Failed: 0

## Step Results

| Step | Status | Exit Code |
|---|---|---|
| npm --prefix desktop install | PASS | 0 |
| npm run desktop:build | PASS | 0 |
| npm --prefix mobile install | PASS | 0 |
| npx --prefix mobile expo config --type public | PASS | 0 |
| npm run extension:pack | PASS | 0 |

## npm --prefix desktop install

```text

up to date, audited 406 packages in 3s

63 packages are looking for funding
  run `npm fund` for details

12 vulnerabilities (2 low, 10 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.

```

## npm run desktop:build

```text

> desktop:build
> npm --prefix desktop run build


> securevoult-desktop@1.0.0 build
> electron-builder --publish never

  • electron-builder  version=25.1.8 os=10.0.26200
  • loaded configuration  file=package.json ("build" field)
  • executing @electron/rebuild  electronVersion=30.5.1 arch=x64 buildFromSource=false appDir=./
  • installing native dependencies  arch=x64
  • completed installing native dependencies
  • packaging       platform=win32 arch=x64 electron=30.5.1 appOutDir=dist\win-unpacked
  • updating asar integrity executable resource  executablePath=dist\win-unpacked\SecureVoult.exe
  • default Electron icon is used  reason=application icon is not set
  • signing with signtool.exe  path=dist\win-unpacked\SecureVoult.exe
  • deprecated field  fields=["signingHashAlgorithms"] reason=please move to win.signtoolOptions.<field_name>
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • executing @electron/rebuild  electronVersion=30.5.1 arch=arm64 buildFromSource=false appDir=./
  • installing native dependencies  arch=arm64
  • completed installing native dependencies
  • packaging       platform=win32 arch=arm64 electron=30.5.1 appOutDir=dist\win-arm64-unpacked
  • updating asar integrity executable resource  executablePath=dist\win-arm64-unpacked\SecureVoult.exe
  • signing with signtool.exe  path=dist\win-arm64-unpacked\SecureVoult.exe
  • deprecated field  fields=["signingHashAlgorithms"] reason=please move to win.signtoolOptions.<field_name>
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • building        target=nsis file=dist\SecureVoult Setup 1.0.0.exe archs=x64, arm64 oneClick=false perMachine=false
  • signing with signtool.exe  path=dist\win-arm64-unpacked\resources\elevate.exe
  • deprecated field  fields=["signingHashAlgorithms"] reason=please move to win.signtoolOptions.<field_name>
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=dist\win-unpacked\resources\elevate.exe
  • deprecated field  fields=["signingHashAlgorithms"] reason=please move to win.signtoolOptions.<field_name>
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=dist\__uninstaller-nsis-securevoult-desktop.exe
  • deprecated field  fields=["signingHashAlgorithms"] reason=please move to win.signtoolOptions.<field_name>
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=dist\SecureVoult Setup 1.0.0.exe
  • deprecated field  fields=["signingHashAlgorithms"] reason=please move to win.signtoolOptions.<field_name>
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • building block map  blockMapFile=dist\SecureVoult Setup 1.0.0.exe.blockmap
  • building        target=portable file=dist\SecureVoult 1.0.0.exe archs=x64
  • signing with signtool.exe  path=dist\SecureVoult 1.0.0.exe
  • deprecated field  fields=["signingHashAlgorithms"] reason=please move to win.signtoolOptions.<field_name>
  • no signing info identified, signing is skipped  signHook=false cscInfo=null

```

## npm --prefix mobile install

```text

up to date, audited 1212 packages in 5s

158 packages are looking for funding
  run `npm fund` for details

13 vulnerabilities (1 low, 12 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.

```

## npx --prefix mobile expo config --type public

```text
env: load .env.local
env: export NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN NEXT_PUBLIC_FIREBASE_PROJECT_ID NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID NEXT_PUBLIC_FIREBASE_APP_ID FIREBASE_ADMIN_PROJECT_ID FIREBASE_ADMIN_CLIENT_EMAIL FIREBASE_ADMIN_PRIVATE_KEY MONGODB_URI NEXT_PUBLIC_APP_URL STRIPE_SECRET_KEY NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_PRO_MONTHLY STRIPE_PRICE_PRO_YEARLY STRIPE_PRICE_COMPANY_MONTHLY STRIPE_PRICE_COMPANY_YEARLY ADMIN_EMAILS UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN

{
  name: [32m'SecureVoult'[39m,
  slug: [32m'securevoult'[39m,
  version: [32m'1.0.0'[39m,
  description: [90mundefined[39m,
  sdkVersion: [90mundefined[39m,
  platforms: [],
  android: {
    package: [32m'com.autisyncsorganization.securepasswordmanager'[39m
  }
}


--- STDERR ---
[33m[1mWarning: [22mRoot-level [1m"expo"[22m object found. Ignoring extra keys in Expo config: "name", "version", "main", "scripts", "dependencies", "devDependencies", "private", "extra"
[90mLearn more: https://expo.fyi/root-expo-object[0m[0m

```

## npm run extension:pack

```text

> extension:pack
> npm run extension:build && powershell -Command "Compress-Archive -Force -Path extension-package\* -DestinationPath securevoult-extension.zip; Write-Host 'Packed: securevoult-extension.zip'"


> extension:build
> node scripts/build-extension-popup.mjs

🎨 Step 1/3 — Generating Tailwind CSS…
   ✅ extension-package/popup.styles.css written

📦 Step 2/3 — Bundling popup.js with esbuild…
   Inlining: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   ✅ extension-package/popup.bundle.js written

🔗 Step 3/3 — Patching options.html with app URL: http://localhost:3000
   ✅ options.html patched

✅ Extension build complete!

Packed: securevoult-extension.zip

--- STDERR ---
Browserslist: caniuse-lite is outdated. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme

Rebuilding...

Done in 1086ms.

```
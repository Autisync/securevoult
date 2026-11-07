# SecureVoult for Android and iPhone

The phone app for SecureVoult (vault.autisync.com). Built with Expo (SDK 58) and
React Native. It opens the same zero-knowledge vault as the web app and the
Chrome extension: the master password never leaves the phone.

## What it does

- Sign in with the SecureVoult account (email + password, two-step codes).
- Unlock with the master password, or fingerprint / face after the first unlock.
- Every item kind: passwords, notes, cards, contact info, documents, bank accounts, Wi-Fi.
- Copy with one tap (cleared from the clipboard after 30 s), live 2FA codes,
  QR scanning for new 2FA secrets, password generator, favourites, trash.
- Works offline; changes upload when the phone is back online and merge item by
  item with changes from other devices.
- **Android autofill**: SecureVoult fills logins in other apps and in Chrome,
  after a fingerprint / screen-lock check, and offers to save new logins.
- Locks itself after leaving the app (5 minutes by default), blocks screenshots.

## How it's put together

| Folder | What |
|---|---|
| `src/core/` | Vault format, crypto, merge, 2FA codes. Same bytes as `../src/lib/vault-crypto.ts`. |
| `src/services/` | Server calls, sign-in, local copy, sync, fingerprint, clipboard, autofill bridge. |
| `src/state/session.tsx` | Locked / unlocked state and every action on the vault. |
| `src/app/` | Screens (Expo Router). |
| `modules/securevoult-autofill/` | The Android autofill service (Kotlin). |

Crypto: Argon2id from native libsodium, AES-256-GCM from `@noble/ciphers`,
random bytes from the OS. `npm run test:compat` checks the phone and web
implementations against each other.

The app reads its Firebase settings from `GET /api/app-config` on the server,
so nothing from the server's environment is copied into the app.

## Build

You need an Expo account (free) that is a member of `autisyncs-organization`.

```powershell
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview   # an APK to install on your phone
npx eas-cli@latest build --platform ios --profile preview       # needs the Apple Developer account
```

For the stores: `--profile production`, then `npx eas-cli@latest submit`.

Checks: `npm run typecheck` and `npm run test:compat`.

# Testing Guide — Mobile App (Expo / React Native)

**Status: In Development**  
iOS and Android apps are built with Expo. Biometric unlock is implemented in the scaffold; TestFlight and Play Store distribution are not yet configured.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| Expo CLI | `npm install -g expo-cli` or use `npx expo` |
| iOS Simulator | Xcode + Simulator (macOS only) |
| Android Emulator | Android Studio + AVD Manager |
| Physical device | iOS or Android + Expo Go app |

---

## Start the Expo dev server

```bash
# From project root:
npm run mobile:start

# Or directly:
npx expo start

# iOS simulator (macOS only):
npm run mobile:ios

# Android emulator:
npm run mobile:android
```

Expo opens a QR code. Scan with the **Expo Go** app on your device, or press `i` for iOS simulator / `a` for Android emulator.

---

## Expo Go (physical device — quickest path)

1. Install **Expo Go** from the App Store or Google Play
2. Run `npx expo start` in the project root
3. Scan the QR code with your device camera (iOS) or Expo Go (Android)
4. The app loads over your local network

> **Requirement:** Your device and development machine must be on the same Wi-Fi network.

---

## Test flows

### 1. App launch

- Verify the SecureVoult splash screen loads
- Verify navigation renders correctly (no layout errors)
- Verify dark theme is applied

### 2. Sign in

- Tap **Sign in**
- Enter your SecureVoult email + password
- Verify vault loads after authentication

### 3. Vault entries

- Verify entries are listed
- Tap an entry — verify details open
- Copy a password — verify clipboard receives the value

### 4. Biometric unlock

- Lock the vault
- Attempt to unlock — device should prompt for Face ID / Touch ID (iOS) or fingerprint (Android)
- Verify biometric prompt appears and vault unlocks on success

> **iOS Simulator note:** Face ID is simulated in Simulator. Go to Features → Face ID → Enrolled, then Features → Face ID → Matching Face.  
> **Android Emulator note:** Fingerprint is simulated in Extended controls → Fingerprint.

### 5. Offline access

- Lock the device's Wi-Fi
- Open the app — verify the vault is accessible from local cache
- Verify no crash or empty state

---

## App entry point

```
expo/App.js         ← main Expo component
app.json            ← Expo config (name, icons, splash, permissions)
```

---

## Current limitations

| Limitation | Notes |
|---|---|
| TestFlight / Play Store | Not yet configured — device testing via Expo Go only |
| Biometric to vault key | Scaffold wires biometric prompt; key derivation from biometric not yet production-ready |
| iOS autofill extension | AutoFill credential provider not yet built (requires native module) |
| Android Autofill Service | Not yet implemented as a native service |
| Push notifications | Not yet implemented |
| EAS Build | Not yet configured — local `npx expo start` only |

---

## Next steps toward TestFlight / Play Store

1. Install EAS CLI: `npm install -g eas-cli`
2. Configure `eas.json` build profiles
3. Run `eas build --platform ios` / `eas build --platform android`
4. Submit via `eas submit`

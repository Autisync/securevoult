# SecureVoult: road to replacing NordPass

## Done (phase 1)

- Argon2id (64 MiB, 3 passes) + a random vault key; the master password is
  never kept in memory after unlock. Older vaults upgrade on their next save.
- Change master password without re-encrypting; other devices pick it up.
- Sync that merges item by item: two devices editing at once, deletions,
  offline edits uploaded later. The server only accepts a save based on its
  latest version.
- Item types: logins (with extra addresses, 2FA codes, extra fields, password
  history), secure notes, payment cards, identities, Wi-Fi.
- Built-in 2FA codes (TOTP), shown live, copied or filled.
- Import from NordPass, Bitwarden, 1Password, LastPass, Dashlane, Proton Pass,
  Chrome/Edge, Firefox, any CSV. Duplicates skipped.
- Chrome extension: stays unlocked until auto-lock, menu under login fields,
  fills only on the login's own site and never into third-party frames,
  2FA code fields, save new logins and updated passwords, keyboard shortcut.
- Docker deployment with its own database and daily backups.

## Next

| Phase | What | Needs |
|---|---|---|
| 2 | **Android app with real autofill** (fills inside other apps and Chrome on the phone), fingerprint unlock | Native Android module (Kotlin AutofillService) in the Expo app; your Android phone to test |
| 3 | **Passkeys**: save and use passkeys in Chrome (the extension answers the site's WebAuthn request) | Extension work; sites that support passkeys to test |
| 4 | **iPhone app** with AutoFill (Credential Provider extension) and Face ID | A Mac with Xcode, Apple developer account |
| 5 | **Windows app**: tray icon, global shortcut, Windows Hello unlock (Electron shell already in `desktop/`) | Windows to test |
| 6 | **Sharing** items with family/team end-to-end (per-user key pairs) and **emergency access** | Server changes; second account to test |
| 7 | Breach alerts in the background, email masking, Firefox/Edge/Safari packages | |

Phase 2 first: it's the main thing NordPass does that SecureVoult can't yet.

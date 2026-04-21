# Testing Guide — Web Application

**Status: Live** | Full vault, autofill, breach monitoring, import/export

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| MongoDB Atlas cluster | Free tier works |
| Firebase project | Auth enabled (email/password + Google) |
| `.env.local` filled | See `.env.example` |

---

## Start the dev server

```bash
npm install
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

---

## Test flows

### 1. Sign up and vault setup

1. Go to `http://localhost:3000`
2. Click **Get started**
3. Register with email + password
4. Complete **Set master password** screen — use a memorable passphrase
5. Vault opens empty — confirm the UI loads without errors

### 2. Add and manage vault entries

1. Click **New entry**
2. Add a login (username, password, URL)
3. Verify entry appears in the vault list
4. Edit the entry — change password
5. Delete the entry — confirm it is removed

### 3. Password generator

1. In **New entry**, click the generator icon
2. Adjust length, symbols, numbers
3. Copy generated password — paste into the password field

### 4. Security centre

1. Add 2–3 entries — intentionally reuse a password in two entries
2. Go to **Security centre**
3. Verify the reused-password warning appears
4. Add a weak password — verify the weak-password warning appears

### 5. Breach monitoring

1. Add an entry with a known breached password (e.g. `password123`)
2. Open the vault — breach check runs on unlock
3. Verify the breach alert appears on the affected entry

> **Note:** Breach monitoring uses HaveIBeenPwned's k-anonymity API — only a 5-character hash prefix is sent. The full password never leaves the browser.

### 6. Import

1. Go to **Settings → Import**
2. Import a CSV from 1Password, Bitwarden, or LastPass
3. Verify entries appear in vault after import

### 7. Export

1. Go to **Settings → Export**
2. Download encrypted JSON backup
3. Download plain CSV — verify it contains your entries

### 8. Recovery kit

1. Go to **Settings → Recovery kit**
2. Download the HTML recovery sheet
3. Verify it includes your account email and recovery hints

### 9. Vault lock / unlock

1. Click **Lock vault**
2. Verify vault becomes inaccessible
3. Re-enter master password — verify vault decrypts successfully

### 10. Admin panel (role-gated)

1. In MongoDB, set your user's `role` field to `"admin"`
2. Reload app — **Admin** tab should appear
3. Verify user list and activity log are accessible

---

## API health check

```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok"}`

---

## Known limitations

| Limitation | Notes |
|---|---|
| 2FA / TOTP | Not yet implemented in UI |
| Passkeys | Scaffolded — not yet wired to vault unlock |
| Vault sharing E2E | Stub exists; key-exchange protocol not implemented |
| PDF recovery kit | HTML only; PDF rendering not yet implemented |
| Breach monitoring scheduler | Per-session only; no background cron job |

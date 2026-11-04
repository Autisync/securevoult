# Running SecureVoult on your own server

The web app, the API and the database run in Docker on your server. Sign-in
stays with Firebase (it only knows your email; it never sees the vault). Your
vault leaves your device already encrypted, so the server and its backups only
ever hold ciphertext.

## 1. Before you start

- A subdomain pointing at the server, for example `vault.autisync.com`.
- In the Firebase console, under Authentication → Settings → Authorized domains,
  add that subdomain.
- Your `.env.local` values (Firebase client keys, Firebase Admin service account).

## 2. Configure

On the server, inside the project folder:

```
cp .env.example .env.production
```

Fill in `.env.production`:

| Setting | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | same as `.env.local` |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | same as `.env.local` |
| `NEXT_PUBLIC_APP_URL` | `https://vault.autisync.com` (your subdomain) |
| `ADMIN_EMAILS` | your email; this also removes the free plan's 50-item limit for you |
| `MONGODB_URI` | leave empty: Docker sets it to its own database |
| Stripe, Upstash, HIBP | optional; leave empty for personal use |

## 3. Start

```
docker compose --env-file .env.production up -d --build
docker compose ps            # app, mongo and backup should be "running"/"healthy"
curl -s http://127.0.0.1:3100/api/health
```

The app listens only on `127.0.0.1:3100`. Point your HTTPS reverse proxy at it.

Caddy:

```
vault.autisync.com {
  reverse_proxy 127.0.0.1:3100
}
```

nginx (with your existing certificate setup):

```
location / {
  proxy_pass http://127.0.0.1:3100;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
}
```

Updates: `git pull && docker compose --env-file .env.production up -d --build`.
Never add `--remove-orphans` or `down -v`: `-v` deletes the database volume.

## On the Autisync server (Traefik)

DNS (`vault.autisync.com` → the server, proxied by Cloudflare) and the
Firebase authorised domain are already set. Traefik there already serves
app.autisync.com, so SecureVoult joins it instead of using port 3100:

```
cd ~ && git clone <repo> securevoult && cd securevoult
# put .env.production here (copied from your PC, see below)
docker compose -f docker-compose.yml -f docker-compose.traefik.yml --env-file .env.production up -d --build
docker compose ps
curl -s https://vault.autisync.com/api/health
```

Updates: `git pull` then the same `up -d --build` line.

Making `.env.production` on your PC, from `.env.local` (PowerShell, in the
project folder), then copying it to the server:

```
(Get-Content .env.local) -replace '^NEXT_PUBLIC_APP_URL=.*','NEXT_PUBLIC_APP_URL=https://vault.autisync.com' -replace '^MONGODB_URI=.*','MONGODB_URI=' -replace '^ADMIN_EMAILS=.*','ADMIN_EMAILS=you@example.com' | Set-Content .env.production
scp .env.production <user>@46.224.226.218:~/securevoult/.env.production
```

## 4. Backups

The `backup` service writes `./backups/securevoult-YYYY-MM-DD.archive.gz` once a
day and keeps 14. Copy that folder off the server now and then. Restore:

```
docker compose exec -T mongo mongorestore --archive --gzip --drop < backups/securevoult-2026-11-04.archive.gz
```

Separately, in the app: Settings → Import / Export → Encrypted backup. That
file opens with your master password and needs no server at all.

## 5. Chrome extension

On your PC, with `NEXT_PUBLIC_APP_URL` in `.env.local` set to your subdomain:

```
npm run extension:build
```

Chrome → `chrome://extensions` → Developer mode → Load unpacked → choose the
`extension-package` folder. Pin it, sign in, unlock once. It stays unlocked
until the auto-lock time you set in Settings (default 15 minutes), or until
Chrome closes.

## 6. Moving from NordPass

1. NordPass → Settings → Export items → CSV. Save it somewhere temporary.
2. SecureVoult → Settings → Import / Export → Import from another password manager.
   It recognises the NordPass file and brings over logins, notes, cards,
   identities, folders and extra fields. Importing twice is safe.
3. Check the count matches, open a few items, try autofill on two or three sites.
4. Delete the CSV (it holds every password in plain text) and empty the bin.
5. Keep NordPass for two weeks alongside, then cancel it.

Passkeys don't travel in a CSV. If the export also leaves out 2FA setup keys,
those sites need 2FA set up again: in the site's security settings choose
"can't scan the QR code?" and paste the key into the item.

## Checks

```
npm run test:core        # encryption, 2FA codes, merging, importers
npm run test:sync        # two devices, conflicts, offline, password change
npm run extension:build && npm run test:extension   # extension in a real Chromium
```

#!/usr/bin/env python3
"""
merge-env.py: puts the settings sent from the PC (.env.production.incoming)
into the server's .env.production without losing what only the server knows.

  python3 scripts/merge-env.py            (deploy.ps1 runs it on the server)

- Settings made on the server (email, the CRM tokens, masking, breach key:
  see SERVER_KEYS) always keep the server's value.
- Anything else the PC sends wins; settings the PC doesn't have are kept.
A backup of the old file is kept as .env.production.bak-<date>. Values are never printed.
"""
import os, re, sys, time

SERVER_KEYS = re.compile(r'^(SMTP_[A-Z_]+|MAIL_FROM|ALERT_EMAILS|STATUS_API_TOKEN|CRM_[A-Z_]+|MAILCOW_[A-Z_]+|MASK_DOMAIN|HIBP_API_KEY)$')

def read(path):
    out = {}
    if not os.path.exists(path):
        return out
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\r\n')
        if not line or line.lstrip().startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        out[k.strip()] = v
    return out

def main():
    live, incoming = '.env.production', '.env.production.incoming'
    if not os.path.exists(incoming):
        print('    no new settings from the PC: kept the server\'s file')
        return
    old, new = read(live), read(incoming)
    merged = dict(new)
    kept = 0
    for k, v in old.items():
        if SERVER_KEYS.match(k) and v.strip():
            merged[k] = v; kept += 1
        elif k not in new:
            merged[k] = v; kept += 1
    if os.path.exists(live):
        os.replace(live, f'{live}.bak-{time.strftime("%Y%m%d-%H%M%S")}')
    old_umask = os.umask(0o077)
    with open(live, 'w', encoding='utf-8') as f:
        f.write(''.join(f'{k}={v}\n' for k, v in merged.items()))
    os.umask(old_umask)
    os.chmod(live, 0o600)
    os.remove(incoming)
    # Keep the last 5 backups.
    baks = sorted(p for p in os.listdir('.') if p.startswith(f'{live}.bak-'))
    for p in baks[:-5]:
        os.remove(p)
    print(f'    settings merged: {len(new)} from the PC, {kept} kept from the server')

if __name__ == '__main__':
    sys.exit(main())

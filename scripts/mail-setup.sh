#!/usr/bin/env bash
# ============================================================================
# mail-setup.sh: SecureVoult's email, made by the CRM's Email hosting.
#
#   bash ~/securevoult/scripts/mail-setup.sh
#
# Asks the CRM (npm run securevoult:mail inside crm-backend) to put
# vault.autisync.com and mask.autisync.com on the mail server, write their DNS
# in Cloudflare and make the no-reply@vault.autisync.com mailbox. Then writes
# the sending settings into ~/securevoult/.env.production and restarts the app.
# autisync.com's own mail (Microsoft 365) is not touched. The mailbox password
# goes file to file and is never printed. Safe to run again (it makes a new one).
# ============================================================================
set -euo pipefail
SV_DIR="${SV_DIR:-$HOME/securevoult}"
CRM_STACK="${CRM_STACK:-$HOME/autisync}"
SV_ENV="$SV_DIR/.env.production"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m    %s\033[0m\n' "$*"; }
die()  { printf '\033[31mxx  %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$SV_ENV" ] || die "No $SV_ENV"
umask 077
tmp="$(mktemp)"; trap 'shred -u "$tmp" 2>/dev/null || rm -f "$tmp"' EXIT

say "Mail server and DNS (through the CRM)"
(cd "$CRM_STACK" && docker compose exec -T crm-backend npm run -s securevoult:mail) > "$tmp" \
  || die "The CRM step failed (see the message above). Nothing was changed in SecureVoult."

say "SecureVoult settings"
cp "$SV_ENV" "$SV_ENV.bak-$(date +%Y%m%d-%H%M%S)"
python3 - "$tmp" "$SV_ENV" <<'PY'
import json, sys
src, env = sys.argv[1], sys.argv[2]
raw = open(src).read().strip().splitlines()
data = json.loads(raw[-1])
want = {
    'SMTP_HOST': data['host'], 'SMTP_PORT': str(data['port']), 'SMTP_SECURE': 'true' if data['secure'] else 'false',
    'SMTP_USER': data['user'], 'SMTP_PASSWORD': data['password'], 'MAIL_FROM': f'"{data["from"]}"', 'MASK_DOMAIN': data['maskDomain'],
}
lines = [l for l in open(env).read().splitlines() if l.split('=', 1)[0] not in want]
lines += [f'{k}={v}' for k, v in want.items()]
open(env, 'w').write('\n'.join(lines) + '\n')
print(f"    sending as {data['from']} through {data['host']}")
PY
chmod 600 "$SV_ENV"

say "Restarting SecureVoult"
(cd "$SV_DIR" && docker compose -f docker-compose.yml -f docker-compose.traefik.yml --env-file .env.production up -d app >/dev/null) && ok "app restarted"
for i in $(seq 1 20); do curl -fsS http://127.0.0.1:3100/api/health >/dev/null 2>&1 && break; sleep 2; done

say "Done"
echo "    DNS can take a few minutes. Then: Admin console -> Security log -> Send test alert."

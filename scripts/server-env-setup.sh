#!/usr/bin/env bash
# ============================================================================
# server-env-setup.sh: connect SecureVoult to email, the CRM, email masking
# and breach checks, using the settings the CRM already has.
#
#   bash ~/securevoult/scripts/server-env-setup.sh
#
# Run it on the server, as the user that owns both ~/securevoult and
# ~/autisync (change with SV_DIR=... CRM_STACK=... in front).
#
# What it does (secrets are copied file to file, never printed):
#   1. Copies SMTP_* and MAILCOW_* from ~/autisync/crm.env into
#      ~/securevoult/.env.production.
#   2. Makes the shared tokens once (STATUS_API_TOKEN, the sign-up token,
#      the CRM heartbeat token) and writes each into both files.
#   3. Asks for things only you know: where alerts go, the Autisync tenant
#      id if the CRM doesn't know it, and an optional Have I Been Pwned key
#      (typing hidden). Enter keeps the current value.
#   4. Makes sure the CRM backend can see the new values, restarts it and
#      SecureVoult, and checks both.
# Each file is backed up first (*.bak-<date>). Safe to run again.
# ============================================================================
set -euo pipefail

SV_DIR="${SV_DIR:-$HOME/securevoult}"
CRM_STACK="${CRM_STACK:-$HOME/autisync}"
SV_ENV="$SV_DIR/.env.production"
CRM_ENV="$CRM_STACK/crm.env"
MASK_DOMAIN_DEFAULT="mask.autisync.com"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m    %s\033[0m\n' "$*"; }
warn() { printf '\033[33m    %s\033[0m\n' "$*"; }
die()  { printf '\033[31mxx  %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$SV_ENV" ]  || die "No $SV_ENV (set SV_DIR=...)"
[ -f "$CRM_ENV" ] || die "No $CRM_ENV on this server. If the CRM runs on another server, run this there with CRM_STACK=... and copy the SecureVoult part by hand, or tell Claude."

stamp="$(date +%Y%m%d-%H%M%S)"
umask 077
cp "$SV_ENV"  "$SV_ENV.bak-$stamp"
cp "$CRM_ENV" "$CRM_ENV.bak-$stamp"
ok "Backups: $SV_ENV.bak-$stamp and $CRM_ENV.bak-$stamp"

getvar() { # file name -> value (last one wins, quotes kept as written)
  grep -E "^$2=" "$1" 2>/dev/null | tail -1 | cut -d= -f2- || true
}
unq() { local v="$1"; v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"; printf '%s' "$v"; }
setvar() { # file name value
  local f="$1" n="$2" v="$3" tmp
  tmp="$(mktemp)"
  grep -v -E "^$n=" "$f" > "$tmp" || true
  printf '%s=%s\n' "$n" "$v" >> "$tmp"
  cat "$tmp" > "$f"; rm -f "$tmp"
}
token() { openssl rand -hex 24; }
need_token() { # file name -> keep a good one, else make one
  local v; v="$(unq "$(getvar "$1" "$2")")"
  if [ "${#v}" -ge 24 ]; then printf '%s' "$v"; else token; fi
}

# ── 1. Email (same mail server as the CRM) ───────────────────────────────────
say "Email settings from the CRM"
for k in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_SECURE SMTP_REJECT_UNAUTHORIZED; do
  v="$(getvar "$CRM_ENV" "$k")"
  if [ -n "$v" ]; then setvar "$SV_ENV" "$k" "$v"; ok "$k copied"; else warn "$k not set in the CRM (skipped)"; fi
done
smtp_user="$(unq "$(getvar "$CRM_ENV" SMTP_USER)")"
if [ -z "$(getvar "$SV_ENV" MAIL_FROM)" ] && [[ "$smtp_user" == *@* ]]; then
  setvar "$SV_ENV" MAIL_FROM "\"SecureVoult <$smtp_user>\""; ok "MAIL_FROM set to SecureVoult <$smtp_user>"
fi

cur="$(unq "$(getvar "$SV_ENV" ALERT_EMAILS)")"
read -r -p "    Who gets serious security alerts? (comma-separated; Enter = ${cur:-admin@autisync.com}): " alerts
alerts="${alerts:-${cur:-admin@autisync.com}}"
setvar "$SV_ENV" ALERT_EMAILS "$alerts"; ok "ALERT_EMAILS = $alerts"

# ── 2. Shared tokens (one value, written on both sides) ──────────────────────
say "Tokens between SecureVoult and the CRM"
status_tok="$(need_token "$SV_ENV" STATUS_API_TOKEN)"
setvar "$SV_ENV"  STATUS_API_TOKEN "$status_tok"
setvar "$CRM_ENV" SECUREVOULT_STATUS_TOKEN "$status_tok"
ok "STATUS_API_TOKEN = SECUREVOULT_STATUS_TOKEN"

signup_tok="$(unq "$(getvar "$CRM_ENV" PRODUCT_SIGNUP_TOKEN)")"
[ "${#signup_tok}" -ge 24 ] || signup_tok="$(need_token "$SV_ENV" CRM_PRODUCT_TOKEN)"
setvar "$CRM_ENV" PRODUCT_SIGNUP_TOKEN "$signup_tok"
setvar "$SV_ENV"  CRM_PRODUCT_TOKEN "$signup_tok"
ok "PRODUCT_SIGNUP_TOKEN = CRM_PRODUCT_TOKEN"

hb_tok="$(unq "$(getvar "$CRM_ENV" STATUS_HEARTBEAT_TOKEN)")"
if [ "${#hb_tok}" -lt 16 ]; then hb_tok="$(token)"; setvar "$CRM_ENV" STATUS_HEARTBEAT_TOKEN "$hb_tok"; warn "The CRM had no STATUS_HEARTBEAT_TOKEN: made one"; fi
setvar "$SV_ENV" CRM_STATUS_TOKEN "$hb_tok"
ok "CRM_STATUS_TOKEN = STATUS_HEARTBEAT_TOKEN"

setvar "$SV_ENV"  CRM_API_URL "https://api.autisync.com"
setvar "$CRM_ENV" SECUREVOULT_URL "https://vault.autisync.com"

tenant="$(unq "$(getvar "$CRM_ENV" PRODUCT_SIGNUP_TENANT_ID)")"
[ -n "$tenant" ] || tenant="$(unq "$(getvar "$CRM_ENV" INBOUND_MAIL_DEFAULT_TENANT_ID)")"
read -r -p "    Autisync's account id in the CRM, where sign-ups go (Enter = ${tenant:-none yet}): " t
tenant="${t:-$tenant}"
if [ -n "$tenant" ]; then setvar "$CRM_ENV" PRODUCT_SIGNUP_TENANT_ID "$tenant"; ok "PRODUCT_SIGNUP_TENANT_ID = $tenant"
else warn "No account id: sign-ups won't reach the CRM until PRODUCT_SIGNUP_TENANT_ID is set in $CRM_ENV"; fi

# ── 3. Email masking (mailcow) and breach checks ─────────────────────────────
say "Email masking and breach checks"
for k in MAILCOW_URL MAILCOW_API_KEY; do
  v="$(getvar "$CRM_ENV" "$k")"
  if [ -n "$v" ]; then setvar "$SV_ENV" "$k" "$v"; ok "$k copied from the CRM"; else warn "$k not in the CRM: masking stays off"; fi
done
cur="$(unq "$(getvar "$SV_ENV" MASK_DOMAIN)")"
read -r -p "    Domain for email masks (Enter = ${cur:-$MASK_DOMAIN_DEFAULT}): " md
setvar "$SV_ENV" MASK_DOMAIN "${md:-${cur:-$MASK_DOMAIN_DEFAULT}}"; ok "MASK_DOMAIN = ${md:-${cur:-$MASK_DOMAIN_DEFAULT}}"
read -r -s -p "    Have I Been Pwned API key (optional, typing hidden; Enter = keep / use the free service): " hibp; echo
if [ -n "$hibp" ]; then setvar "$SV_ENV" HIBP_API_KEY "$hibp"; ok "HIBP_API_KEY saved"; else ok "HIBP_API_KEY unchanged"; fi
unset hibp

chmod 600 "$SV_ENV" "$CRM_ENV"

# ── 4. The CRM backend must see the new values ───────────────────────────────
say "CRM backend"
compose_file="$CRM_STACK/docker-compose.yml"; [ -f "$compose_file" ] || compose_file="$CRM_STACK/compose.yml"
NEW_VARS="PRODUCT_SIGNUP_TOKEN PRODUCT_SIGNUP_TENANT_ID SECUREVOULT_URL SECUREVOULT_STATUS_TOKEN"
# When the stack fills ${VARS} from ~/autisync/.env, the values go there too.
if [ -f "$CRM_STACK/.env" ] && [ "$(readlink -f "$CRM_STACK/.env")" != "$(readlink -f "$CRM_ENV")" ] && grep -q '^STATUS_HEARTBEAT_TOKEN=' "$CRM_STACK/.env"; then
  cp "$CRM_STACK/.env" "$CRM_STACK/.env.bak-$stamp"
  for k in $NEW_VARS; do v="$(getvar "$CRM_ENV" "$k")"; [ -n "$v" ] && setvar "$CRM_STACK/.env" "$k" "$v"; done
  chmod 600 "$CRM_STACK/.env"; ok "Also written to $CRM_STACK/.env"
fi
# A compose file that lists each variable under environment: needs the new ones listed.
if grep -q 'STATUS_HEARTBEAT_TOKEN: \${STATUS_HEARTBEAT_TOKEN' "$compose_file" && ! grep -q 'PRODUCT_SIGNUP_TOKEN' "$compose_file"; then
  cp "$compose_file" "$compose_file.bak-$stamp"
  python3 - "$compose_file" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p).read()
def add(m):
    ind = m.group(1)
    extra = ''.join(f"\n{ind}{k}: ${{{k}:-}}" for k in ['PRODUCT_SIGNUP_TOKEN', 'PRODUCT_SIGNUP_TENANT_ID', 'SECUREVOULT_URL', 'SECUREVOULT_STATUS_TOKEN'])
    return m.group(0) + extra
s = re.sub(r'^([ \t]+)STATUS_HEARTBEAT_TOKEN: \$\{STATUS_HEARTBEAT_TOKEN[^\n]*', add, s, flags=re.M)
open(p, 'w').write(s)
PY
  ok "Listed the new variables in $compose_file (backup kept)"
fi
(cd "$CRM_STACK" && docker compose up -d crm-backend >/dev/null) && ok "crm-backend restarted"
sleep 6
if (cd "$CRM_STACK" && docker compose exec -T crm-backend sh -c 'test ${#PRODUCT_SIGNUP_TOKEN} -ge 24 && test ${#SECUREVOULT_STATUS_TOKEN} -ge 24'); then
  ok "crm-backend sees the tokens"
else
  warn "crm-backend does NOT see the tokens. Add these under crm-backend's environment: in $compose_file, then: cd $CRM_STACK && docker compose up -d crm-backend"
  for k in $NEW_VARS; do warn "  $k: \${$k}"; done
fi

# ── 5. SecureVoult ───────────────────────────────────────────────────────────
say "SecureVoult"
(cd "$SV_DIR" && docker compose -f docker-compose.yml -f docker-compose.traefik.yml --env-file .env.production up -d app >/dev/null) && ok "app restarted"
for i in $(seq 1 20); do curl -fsS http://127.0.0.1:3100/api/health >/dev/null 2>&1 && break; sleep 2; done
code="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $status_tok" http://127.0.0.1:3100/api/status || true)"
[ "$code" = 200 ] && ok "Status API answers with the token" || warn "Status API answered $code (check: docker compose logs --tail 50 app)"
unset status_tok signup_tok hb_tok

say "Done"
echo "    Next: Admin console -> Security log -> Send test alert, and CRM -> Settings -> SecureVoult."

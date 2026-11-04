# Deploys SecureVoult to https://vault.autisync.com from this PC.
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
#
# 1. Builds .env.production from .env.local (production address, own database,
#    admin account) and copies it to the server, readable only by you.
# 2. Pushes the code, then on the server: git pull, rebuild, restart.
# Nothing secret is printed.

$ErrorActionPreference = 'Stop'
$Server = 'helio@46.224.226.218'
$Key    = "$HOME\.ssh\id_ed25519"
$Dir    = '~/securevoult'
$Compose = 'docker compose -f docker-compose.yml -f docker-compose.traefik.yml --env-file .env.production'

Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host '1/3  Production settings'
(Get-Content .env.local) `
  -replace '^NEXT_PUBLIC_APP_URL=.*', 'NEXT_PUBLIC_APP_URL=https://vault.autisync.com' `
  -replace '^MONGODB_URI=.*', 'MONGODB_URI=' `
  -replace '^ADMIN_EMAILS=.*', 'ADMIN_EMAILS=admin@autisync.com' `
  -replace '^UPSTASH_REDIS_REST_URL=.*', 'UPSTASH_REDIS_REST_URL=' `
  -replace '^UPSTASH_REDIS_REST_TOKEN=.*', 'UPSTASH_REDIS_REST_TOKEN=' |
  Set-Content .env.production
scp -q -i $Key .env.production "${Server}:$Dir/.env.production"
ssh -i $Key $Server "chmod 600 $Dir/.env.production"

Write-Host '2/3  Code'
git push

Write-Host '3/3  Server: pull, rebuild, restart'
ssh -i $Key $Server "cd $Dir && git pull --ff-only && $Compose up -d --build && $Compose ps && sleep 8 && curl -s http://127.0.0.1:3100/api/health; echo"
Write-Host 'Done: https://vault.autisync.com'

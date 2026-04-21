#!/usr/bin/env bash
# scripts/build-all.sh
# ─────────────────────────────────────────────────────────────────────────────
# SecureVoult — build all platforms
#
# Usage:
#   ./scripts/build-all.sh [--web] [--desktop] [--mobile] [--extension] [--all]
#
# Flags (defaults to --all if none given):
#   --web        Build Next.js web app + static export
#   --desktop    Build Electron desktop (Windows/Linux; macOS requires macOS host)
#   --mobile     Build Expo mobile app (requires EAS CLI logged in)
#   --extension  Package browser extension ZIPs for Chrome/Edge and Firefox
#
# Prerequisites:
#   - Node.js ≥ 20, npm ≥ 10
#   - For desktop: electron-builder in desktop/node_modules (run npm i in desktop/)
#   - For mobile: npm install -g eas-cli && eas login
#   - For macOS .dmg/.mas: must run on macOS
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[build]${RESET} $*"; }
success() { echo -e "${GREEN}[done] ${RESET} $*"; }
warn()    { echo -e "${YELLOW}[warn] ${RESET} $*"; }

# ── Arg parsing ───────────────────────────────────────────────────────────────
BUILD_WEB=false; BUILD_DESKTOP=false; BUILD_MOBILE=false; BUILD_EXT=false

if [[ $# -eq 0 ]]; then
  BUILD_WEB=true; BUILD_DESKTOP=true; BUILD_MOBILE=true; BUILD_EXT=true
fi

for arg in "$@"; do
  case $arg in
    --web)       BUILD_WEB=true ;;
    --desktop)   BUILD_DESKTOP=true ;;
    --mobile)    BUILD_MOBILE=true ;;
    --extension) BUILD_EXT=true ;;
    --all)       BUILD_WEB=true; BUILD_DESKTOP=true; BUILD_MOBILE=true; BUILD_EXT=true ;;
    *) echo "Unknown flag: $arg" && exit 1 ;;
  esac
done

# ── 1. Web app ────────────────────────────────────────────────────────────────
if $BUILD_WEB; then
  info "Building Next.js web app..."
  npm run build
  info "Exporting static build to out/..."
  # Requires output: 'export' in next.config.js for full static export
  # If using server components with API routes, skip the export step and deploy .next/ to Vercel/Docker
  if grep -q "'export'" next.config.js 2>/dev/null || grep -q '"export"' next.config.js 2>/dev/null; then
    npx next export 2>/dev/null || warn "Static export skipped (API routes present — deploy .next/ to a Node server or Vercel)"
  else
    warn "Static export skipped — next.config.js does not set output: 'export'. Deploy .next/ to Vercel or a Node server."
  fi
  success "Web build complete → .next/"
fi

# ── 2. Desktop (Electron) ─────────────────────────────────────────────────────
if $BUILD_DESKTOP; then
  info "Building Electron desktop app..."
  cd "$ROOT_DIR/desktop"
  if [[ ! -d "node_modules" ]]; then
    info "Installing desktop dependencies..."
    npm install
  fi

  PLATFORM=$(uname -s)
  case $PLATFORM in
    Darwin) npm run build:mac  ; npm run build:linux 2>/dev/null || true ;;
    Linux)  npm run build:linux ;;
    MINGW*|CYGWIN*|MSYS*) npm run build:win ;;
    *) warn "Unknown platform '$PLATFORM' — running default build"; npm run build ;;
  esac

  success "Desktop builds → desktop/dist/"
  cd "$ROOT_DIR"
fi

# ── 3. Mobile (Expo / EAS) ────────────────────────────────────────────────────
if $BUILD_MOBILE; then
  info "Building mobile apps via EAS..."
  if ! command -v eas &>/dev/null; then
    warn "eas CLI not found. Install with: npm install -g eas-cli && eas login"
    warn "Skipping mobile build."
  else
    info "Building iOS..."
    eas build --platform ios  --profile production --non-interactive || warn "iOS build failed — check EAS credentials"
    info "Building Android..."
    eas build --platform android --profile production --non-interactive || warn "Android build failed — check EAS credentials"
    success "Mobile builds submitted to EAS"
  fi
fi

# ── 4. Browser extension ──────────────────────────────────────────────────────
if $BUILD_EXT; then
  info "Packaging browser extension..."

  EXT_SRC="$ROOT_DIR/extension-package"
  EXT_OUT="$ROOT_DIR/dist/extension"
  mkdir -p "$EXT_OUT"

  # Chrome / Edge / Brave / Opera (Manifest V3)
  info "  → Chrome/Edge/Brave/Opera (MV3)..."
  cp -r "$EXT_SRC" "$EXT_OUT/chrome-mv3"
  # Remove firefox-specific manifest
  rm -f "$EXT_OUT/chrome-mv3/manifest-firefox.json"
  cd "$EXT_OUT"
  zip -r "securevoult-chrome-mv3.zip" chrome-mv3/ -x "*.DS_Store" -x "__MACOSX/*"
  cd "$ROOT_DIR"

  # Firefox (Manifest V2)
  info "  → Firefox (MV2)..."
  cp -r "$EXT_SRC" "$EXT_OUT/firefox-mv2"
  # Swap manifests
  cp "$EXT_OUT/firefox-mv2/manifest-firefox.json" "$EXT_OUT/firefox-mv2/manifest.json"
  rm -f "$EXT_OUT/firefox-mv2/manifest-firefox.json"
  cd "$EXT_OUT"
  zip -r "securevoult-firefox-mv2.zip" firefox-mv2/ -x "*.DS_Store" -x "__MACOSX/*"
  cd "$ROOT_DIR"

  # Safari — generate Xcode project if on macOS
  if [[ "$(uname -s)" == "Darwin" ]]; then
    info "  → Safari (macOS) — converting with xcrun safari-web-extension-converter..."
    if command -v xcrun &>/dev/null; then
      xcrun safari-web-extension-converter "$EXT_SRC" \
        --project-location "$EXT_OUT/safari-extension" \
        --app-name "SecureVoult" \
        --bundle-identifier "com.securevoult.extension" \
        --no-open 2>/dev/null || warn "Safari conversion failed — Xcode 15+ required"
    else
      warn "xcrun not found — skipping Safari extension conversion"
    fi
  else
    warn "Safari extension conversion requires macOS — skipping"
  fi

  success "Extension packages → dist/extension/"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${RESET}"
echo -e "${GREEN}║   SecureVoult build complete         ║${RESET}"
echo -e "${GREEN}╚══════════════════════════════════════╝${RESET}"
$BUILD_WEB     && echo -e "  Web app          → ${CYAN}.next/${RESET}"
$BUILD_DESKTOP && echo -e "  Desktop          → ${CYAN}desktop/dist/${RESET}"
$BUILD_MOBILE  && echo -e "  Mobile (EAS)     → ${CYAN}EAS dashboard${RESET}"
$BUILD_EXT     && echo -e "  Extension ZIPs   → ${CYAN}dist/extension/${RESET}"
echo ""

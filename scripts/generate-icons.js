#!/usr/bin/env node
/**
 * scripts/generate-icons.js
 *
 * Generates all PNG icon sizes for every platform from public/icon.svg.
 * Requires sharp (already installed as a Next.js dep).
 *
 * Usage: node scripts/generate-icons.js
 *
 * Output:
 *   Web (public/)
 *     favicon-16x16.png
 *     favicon-32x32.png
 *     favicon-48x48.png
 *     apple-touch-icon.png        (180x180)
 *     android-chrome-192x192.png
 *     android-chrome-512x512.png
 *     og-image.png                (1200x630 — Open Graph)
 *
 *   Extension (extension-package/icons/)
 *     icon-16.png
 *     icon-32.png
 *     icon-48.png
 *     icon-128.png
 *
 *   Mobile (mobile/assets/)
 *     icon.png                    (1024x1024)
 *     adaptive-icon.png           (1024x1024, transparent bg for Android foreground)
 *     splash.png                  (1284x2778 — centred logo on dark bg)
 *     favicon.png                 (196x196)
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const ROOT       = path.join(__dirname, '..');
const SVG_SOURCE = path.join(ROOT, 'public', 'icon.svg');

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function icon(size, dest) {
  await sharp(SVG_SOURCE)
    .resize(size, size)
    .png()
    .toFile(dest);
  console.log(`  [ok]  ${path.relative(ROOT, dest)}  (${size}x${size})`);
}

/**
 * icon with transparent background (no dark rounded square from SVG —
 * just the shield+V strokes, suitable for Android adaptive icon foreground)
 */
async function adaptiveIcon(size, dest) {
  // For adaptive icon: render at 2x, then embed centred in transparent canvas
  const innerSize = Math.round(size * 0.6); // icon occupies 60% of the safe zone
  const svgBuf = fs.readFileSync(SVG_SOURCE);
  // Replace the bg rect fill with transparent
  const transparentSvg = svgBuf.toString('utf8')
    .replace(/fill="url\(#bg\)"/, 'fill="transparent"')
    .replace(/fill="url\(#bg\)"/g, 'fill="transparent"');

  const iconBuf = await sharp(Buffer.from(transparentSvg))
    .resize(innerSize, innerSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: iconBuf,
      gravity: 'centre',
    }])
    .png()
    .toFile(dest);
  console.log(`  [ok]  ${path.relative(ROOT, dest)}  (${size}x${size} transparent)`);
}

async function splash(width, height, iconSize, bgHex, dest) {
  const iconBuf = await sharp(SVG_SOURCE)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  const bg = hexToRgb(bgHex);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 255 },
    },
  })
    .composite([{
      input: iconBuf,
      gravity: 'centre',
    }])
    .png()
    .toFile(dest);
  console.log(`  [ok]  ${path.relative(ROOT, dest)}  (${width}x${height} splash)`);
}

async function ogImage(dest) {
  // 1200x630 Open Graph image: dark bg + centred logo
  const iconSize = 260;
  const iconBuf = await sharp(SVG_SOURCE)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  // Draw text via SVG overlay
  const textSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#60a5fa"/>
          <stop offset="100%" stop-color="#818cf8"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="#080d1a"/>
      <!-- Subtle grid lines -->
      <rect width="1200" height="630" fill="none" stroke="#1e293b" stroke-width="0.5"
            x="0" y="0"/>
      <!-- Brand name -->
      <text x="680" y="285" font-family="system-ui,sans-serif" font-weight="800"
            font-size="72" fill="#f1f5f9" text-anchor="middle" letter-spacing="-2">
        Secure
      </text>
      <text x="680" y="285" font-family="system-ui,sans-serif" font-weight="800"
            font-size="72" fill="url(#g)" text-anchor="middle" letter-spacing="-2"
            dx="270">
        Voult
      </text>
      <!-- Tagline -->
      <text x="680" y="350" font-family="system-ui,sans-serif" font-weight="400"
            font-size="28" fill="#94a3b8" text-anchor="middle" letter-spacing="0">
        Zero-knowledge encrypted password manager
      </text>
    </svg>
  `);

  await sharp({ create: { width: 1200, height: 630, channels: 4, background: { r: 8, g: 13, b: 26, alpha: 255 } } })
    .composite([
      { input: textSvg, top: 0, left: 0 },
      { input: iconBuf, top: Math.round((630 - iconSize) / 2), left: Math.round((1200 / 2 - 340) - iconSize / 2) },
    ])
    .png()
    .toFile(dest);
  console.log(`  [ok]  ${path.relative(ROOT, dest)}  (1200x630 og:image)`);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 8, g: 13, b: 26 };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n[icons]  Generating SecureVoult icons from public/icon.svg\n');

  if (!fs.existsSync(SVG_SOURCE)) {
    console.error('[error]  public/icon.svg not found');
    process.exit(1);
  }

  // ── Web ──
  console.log('-- Web (public/) --');
  ensure(path.join(ROOT, 'public'));
  await icon(16,  path.join(ROOT, 'public', 'favicon-16x16.png'));
  await icon(32,  path.join(ROOT, 'public', 'favicon-32x32.png'));
  await icon(48,  path.join(ROOT, 'public', 'favicon-48x48.png'));
  await icon(180, path.join(ROOT, 'public', 'apple-touch-icon.png'));
  await icon(192, path.join(ROOT, 'public', 'android-chrome-192x192.png'));
  await icon(512, path.join(ROOT, 'public', 'android-chrome-512x512.png'));
  await ogImage(  path.join(ROOT, 'public', 'og-image.png'));

  // ── Extension ──
  console.log('\n-- Extension (extension-package/icons/) --');
  ensure(path.join(ROOT, 'extension-package', 'icons'));
  await icon(16,  path.join(ROOT, 'extension-package', 'icons', 'icon-16.png'));
  await icon(32,  path.join(ROOT, 'extension-package', 'icons', 'icon-32.png'));
  await icon(48,  path.join(ROOT, 'extension-package', 'icons', 'icon-48.png'));
  await icon(128, path.join(ROOT, 'extension-package', 'icons', 'icon-128.png'));

  // ── Mobile ──
  console.log('\n-- Mobile (mobile/assets/) --');
  ensure(path.join(ROOT, 'mobile', 'assets'));
  await icon(1024, path.join(ROOT, 'mobile', 'assets', 'icon.png'));
  await icon(196,  path.join(ROOT, 'mobile', 'assets', 'favicon.png'));
  await adaptiveIcon(1024, path.join(ROOT, 'mobile', 'assets', 'adaptive-icon.png'));
  await splash(1284, 2778, 320, '#080d1a', path.join(ROOT, 'mobile', 'assets', 'splash.png'));

  console.log('\n[ok]  All icons generated.\n');
  console.log('   Reload your dev server (npm run dev) to pick up the new favicon.');
  console.log('   Reload your extension in chrome://extensions to pick up the new icons.\n');
}

main().catch((err) => {
  console.error('\n[error]', err.message);
  process.exit(1);
});

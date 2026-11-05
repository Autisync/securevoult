/**
 * Build script for the browser extension popup.
 *
 * Steps:
 *  1. Load NEXT_PUBLIC_* env vars from .env.local
 *  2. Run Tailwind CLI to generate popup.styles.css
 *  3. Run esbuild to bundle popup.js → popup.bundle.js (with env vars inlined)
 *  4. Patch options.html with the real app URL from NEXT_PUBLIC_APP_URL
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const extDir = resolve(root, 'extension-package');

function escapeForSingleQuotedJs(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Load env vars from .env.local ─────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(root, '.env.local');
  const vars = {};
  if (!existsSync(envPath)) {
    console.warn('⚠  .env.local not found — Firebase config will be empty');
    return vars;
  }
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (key.startsWith('NEXT_PUBLIC_')) vars[key] = val;
  }
  return vars;
}

const envVars = loadEnv();
const appUrl = envVars['NEXT_PUBLIC_APP_URL'] ?? 'https://vault.autisync.com';
const appOrigin = (() => {
  try {
    return new URL(appUrl).origin;
  } catch {
    return 'https://vault.autisync.com';
  }
})();

const extensionCsp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'wasm-unsafe-eval'",
  `connect-src 'self' ${appOrigin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://*.firebaseio.com https://api.stripe.com https://*.stripe.com`,
].join('; ');

// esbuild define map
const define = { 'process.env.NODE_ENV': JSON.stringify('production') };
for (const [k, v] of Object.entries(envVars)) {
  define[`process.env.${k}`] = JSON.stringify(v);
}
// Anything else under process.env is simply undefined in the extension
// (there is no `process` in a browser; a bare reference would crash it).
define['process.env'] = '{}';

console.log('🎨 Step 1/3 — Generating Tailwind CSS…');
try {
  execSync(
    `npx tailwindcss --config tailwind.config.ts -i src/app/globals.css -o extension-package/popup.styles.css --minify`,
    { cwd: root, stdio: 'inherit' }
  );
  console.log('   ✅ extension-package/popup.styles.css written');
} catch {
  console.error('❌ Tailwind CSS generation failed');
  process.exit(1);
}

console.log(`\n📦 Step 2/3 — Bundling popup.js with esbuild…`);
console.log(`   Inlining: ${Object.keys(envVars).join(', ') || '(no NEXT_PUBLIC_ vars found)'}`);

await build({
  entryPoints: [resolve(extDir, 'popup.js')],
  bundle: true,
  minify: true,
  sourcemap: false,
  platform: 'browser',
  format: 'iife',
  target: ['chrome110', 'firefox115', 'edge110'],
  outfile: resolve(extDir, 'popup.bundle.js'),
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.js': 'jsx',
    '.jsx': 'jsx',
    '.css': 'empty',   // CSS is handled by Tailwind CLI separately
    '.png': 'dataurl',
    '.svg': 'dataurl',
  },
  define,
  alias: {
    '@': resolve(root, 'src'),
  },
  logLevel: 'warning',
}).then(() => {
  console.log('   ✅ extension-package/popup.bundle.js written');
}).catch((err) => {
  console.error('❌ esbuild failed:', err.message);
  process.exit(1);
});

console.log('\n🧩 Background worker and page script…');
// The worker reuses the vault code with its own sign-in and storage modules.
const swAliases = {
  name: 'sw-aliases',
  setup(b) {
    b.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: resolve(root, 'extension-src/sw-auth.ts') }));
    b.onResolve({ filter: /^\.\/storage$/ }, (a) => (a.importer.endsWith('vault.ts') ? { path: resolve(root, 'extension-src/sw-storage.ts') } : undefined));
  },
};
for (const [entry, out, plugins] of [
  ['extension-src/background.ts', 'background.js', [swAliases]],
  ['extension-src/content.ts', 'content.js', []],
]) {
  await build({
    entryPoints: [resolve(root, entry)],
    bundle: true, minify: true, sourcemap: false, platform: 'browser', format: 'iife',
    target: ['chrome110', 'firefox115', 'edge110'],
    outfile: resolve(extDir, out),
    define, alias: { '@': resolve(root, 'src') }, plugins, logLevel: 'warning',
  });
  console.log(`   ✅ extension-package/${out} written`);
}

console.log(`\n🔗 Step 3/3 — Patching extension pages with app URL: ${appUrl}`);
const popupPath = resolve(extDir, 'popup.html');
let popupHtml = readFileSync(popupPath, 'utf-8');
popupHtml = popupHtml.replace(
  /(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,
  `$1${extensionCsp}$2`
);
writeFileSync(popupPath, popupHtml, 'utf-8');

const optionsPath = resolve(extDir, 'options.html');
let optionsHtml = readFileSync(optionsPath, 'utf-8');
optionsHtml = optionsHtml.replace(
  /(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,
  `$1${extensionCsp}$2`
);
writeFileSync(optionsPath, optionsHtml, 'utf-8');

const optionsScriptPath = resolve(extDir, 'options.js');
let optionsScript = readFileSync(optionsScriptPath, 'utf-8');
optionsScript = optionsScript.replace(
  /chrome\.tabs\.create\(\{ url: '[^']*' \}\);/,
  `chrome.tabs.create({ url: '${escapeForSingleQuotedJs(appUrl)}' });`
);
writeFileSync(optionsScriptPath, optionsScript, 'utf-8');
console.log('   ✅ extension pages patched');

console.log('\n✅ Extension build complete!\n');

